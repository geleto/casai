import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { inspect, promisify } from 'node:util';
import { createAgentUIStream, generateText, isStepCount, NoObjectGeneratedError, NoOutputGeneratedError, Output, smoothStream, streamText, tool, ToolLoopAgent } from 'ai';
import type { Agent, AgentCallParameters, AgentStreamParameters, ModelMessage, TextStreamPart, ToolExecutionOptions, ToolSet } from 'ai';
import type { LanguageModelV3GenerateResult, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { z } from 'zod';
import { generateTextWithResult, streamTextWithResult } from '../src/augment-result.js';
import { create } from './cascada';

const usage = {
	inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 2, text: 2, reasoning: 0 },
};
type Step = Pick<LanguageModelV3GenerateResult, 'content'> & { reason?: LanguageModelV3GenerateResult['finishReason']['unified'] };
const text = (value: string): Step['content'][number] => ({ type: 'text', text: value });
const call = (providerExecuted = false): Step['content'][number] => ({
	type: 'tool-call', toolCallId: 'call', toolName: 'lookup', input: '{"query":"test"}', providerExecuted,
});
const lookup = tool({ inputSchema: z.object({ query: z.string() }), execute: ({ query }) => query.toUpperCase() });

function chunks(step: Step): LanguageModelV3StreamPart[] {
	const parts: LanguageModelV3StreamPart[] = [{ type: 'stream-start', warnings: [] }];
	for (const [index, part] of step.content.entries()) {
		if (part.type === 'text') {
			const id = String(index);
			parts.push({ type: 'text-start', id }, { type: 'text-delta', id, delta: part.text }, { type: 'text-end', id });
		} else if (part.type === 'tool-call' || part.type === 'tool-result' || part.type === 'tool-approval-request') parts.push(part);
		else throw new Error(`Unsupported fixture part: ${part.type}`);
	}
	parts.push({ type: 'finish', finishReason: { unified: step.reason ?? 'stop', raw: step.reason ?? 'stop' }, usage });
	return parts;
}

function mock(...steps: Step[]) {
	return new MockLanguageModelV3({
		doGenerate: steps.map(step => ({ content: step.content, finishReason: { unified: step.reason ?? 'stop', raw: step.reason ?? 'stop' }, usage, warnings: [] })),
		doStream: steps.map(step => ({ stream: convertArrayToReadableStream(chunks(step)) })),
	});
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = [];
	for await (const value of stream) values.push(value);
	return values;
}

async function value(value: unknown): Promise<unknown> {
	if (typeof value === 'object' && value !== null && Symbol.asyncIterator in value) {
		return collect(value as AsyncIterable<unknown>);
	}
	return await value;
}

function controlledModel() {
	let controller: ReadableStreamDefaultController<LanguageModelV3StreamPart>;
	const model = new MockLanguageModelV3({
		doStream: { stream: new ReadableStream({ start(stream) { controller = stream; } }) },
	});
	return {
		model,
		send(...parts: LanguageModelV3StreamPart[]) { for (const part of parts) controller.enqueue(part); },
		fail(error: unknown) { controller.enqueue({ type: 'error', error }); controller.close(); },
		start() {
			controller.enqueue({ type: 'stream-start', warnings: [] });
			controller.enqueue({ type: 'text-start', id: 'text' });
			controller.enqueue({ type: 'text-delta', id: 'text', delta: 'first' });
		},
		finish() {
			controller.enqueue({ type: 'text-delta', id: 'text', delta: ' last' });
			controller.enqueue({ type: 'text-end', id: 'text' });
			controller.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage });
			controller.close();
		},
	};
}

describe('SDK result augmentation', () => {
	it('can copy, serialize and inspect a paused generation without reading final output', async () => {
		const result = await generateTextWithResult({
			model: mock({ content: [call()], reason: 'tool-calls' }), prompt: 'question',
			tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }) }) },
		});
		assert.throws(() => result.value, NoOutputGeneratedError);
		for (const copy of [{ ...result }, Object.assign({}, result)]) {
			assert.equal('value' in copy, false);
			assert.equal('messageHistory' in copy, false);
		}
		assert.doesNotThrow(() => JSON.stringify(result));
		assert.doesNotThrow(() => inspect(result));
		assert.equal(result.messageHistory.length, 2);
	});

	it('can copy, serialize and inspect a failed stream without leaking rejections', async function () {
		this.timeout(10_000);
		// Keep leaked rejections fatal without interfering with Mocha's handlers.
		await promisify(execFile)(process.execPath, [
			'--import=tsx', '--conditions=casai-source', '--unhandled-rejections=strict', '--input-type=module', '--eval', `
				import { create } from 'casai';
				import { Output } from 'ai';
				import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
				import { z } from 'zod';
				import { inspect } from 'node:util';
				const model = new MockLanguageModelV3({ doStream: { stream: convertArrayToReadableStream([
					{ type: 'stream-start', warnings: [] },
					{ type: 'error', error: new Error('Provider failed') },
				]) } });
				const result = create.TextStreamer({
					model, output: Output.object({ schema: z.object({ n: z.number() }) }), onError() {},
				})('question');
				void { ...result };
				Object.assign({}, result);
				JSON.stringify(result);
				inspect(result);
				await result.consumeStream();
				await new Promise(resolve => setImmediate(resolve));
			`,
		]);
	});

	it('implements the SDK Agent interface and works with UI helpers on literal conversations', async () => {
		const model = mock({ content: [text('one')] }, { content: [text('two')] });
		const tools = {};
		const agent = {
			version: 'agent-v1' as const, id: 'fixture', tools,
			generate: (options: AgentCallParameters<never>) => generateTextWithResult({ model, ...options }),
			stream: async (options: AgentStreamParameters<never, typeof tools>) => streamTextWithResult({ model, ...options }),
		} satisfies Agent<never, typeof tools, Record<string, unknown>, ReturnType<typeof Output.text>>;
		const generated = await agent.generate({ prompt: 'literal {{ source }}' });
		assert.equal(generated.value, 'one');
		assert.deepEqual(generated.messageHistory[0], { role: 'user', content: 'literal {{ source }}' });
		const ui = await createAgentUIStream({ agent, uiMessages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'literal {{ next }}' }] }] });
		const events = await collect(ui);
		assert.ok(events.some(part => part.type === 'text-delta' && part.delta === 'one'));
		assert.equal(model.doGenerateCalls.length, 1);
		assert.equal(model.doStreamCalls.length, 1);
	});

	for (const execution of [generateTextWithResult, streamTextWithResult]) {
		for (const messagesField of ['messages', 'prompt'] as const) {
			it(`${execution.name} snapshots a literal ${messagesField} conversation for execution and history`, async () => {
				const model = mock({ content: [text('answer')] });
				const messages: ModelMessage[] = [{ role: 'user', content: 'original' }];
				const settings = messagesField === 'messages' ? { model, messages } : { model, prompt: messages };
				const pending = execution(settings);
				assert.equal(settings[messagesField], messages);
				messages.push({ role: 'user', content: 'late' });
				const result = await pending;
				await result.output;
				const request = execution === generateTextWithResult ? model.doGenerateCalls[0] : model.doStreamCalls[0];
				assert.deepEqual(request.prompt.map(message => message.content), [[{ type: 'text', text: 'original' }]]);
				assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'original' }, ...await result.responseMessages]);
			});
		}
	}

	it('keeps streaming output delivery tied to the executed output setting', async () => {
		const output = Output.object({ schema: z.object({ n: z.number() }) });
		const request: Parameters<typeof streamTextWithResult>[0] = { model: mock({ content: [text('{"n":7}')] }), prompt: 'test', output };
		const result = streamTextWithResult(request);
		request.output = Output.text();
		assert.equal(Symbol.asyncIterator in result.value, false);
		assert.equal(result.value, result.value);
		assert.deepEqual(await result.value, { n: 7 });
		assert.deepEqual(await result.output, { n: 7 });
	});

	for (const aliases of [false, true]) {
		it(`preserves native callback receivers with ${aliases ? 'deprecated' : 'canonical'} names`, async () => {
			for (const augmented of [false, true]) {
				const receivers: { step: unknown[], call: unknown[], chunk: unknown[] } = { step: [], call: [], chunk: [] };
				const observer = (kind: keyof typeof receivers) => function (this: unknown) { receivers[kind].push(this); };
				const settings = { model: mock({ content: [text('answer')] }), prompt: 'test', onChunk: observer('chunk'),
					...(aliases ? { experimental_onStepStart: observer('step'), experimental_onLanguageModelCallStart: observer('call') }
						: { onStepStart: observer('step'), onLanguageModelCallStart: observer('call') }),
				};
				const result = augmented ? streamTextWithResult(settings) : streamText(settings);
				await result.consumeStream();
				assert.equal(receivers.step.length, 1);
				assert.equal(receivers.call.length, 1);
				assert.ok(receivers.chunk.length > 0);
				assert.ok(Object.values(receivers).flat().every(receiver => receiver === undefined));
			}
		});
	}

	for (const order of ['output-first', 'value-first', 'together'] as const) {
		it(`reuses one SDK execution and lazy history with ${order} access`, async () => {
			const model = mock({ content: [text('answer')] });
			const messages: ModelMessage[] = [{ role: 'user', content: 'question' }];
			const result = streamTextWithResult({ model, messages });
			messages.push({ role: 'user', content: 'later' });
			if (order === 'output-first') assert.equal(await result.output, 'answer');
			if (order === 'value-first') assert.deepEqual(await value(result.value), ['answer']);
			const [final, nativeText, history, events] = await Promise.all([
				value(result.value), collect(result.textStream), result.messageHistory, collect(result.stream),
			]);
			assert.deepEqual(final, ['answer']);
			assert.equal(nativeText.join(''), 'answer');
			assert.equal(history.length, 2);
			assert.equal((await result.response).messages.length, 1);
			assert.equal((await result.steps).length, 1);
			assert.ok(events.some(part => part.type === 'finish'));
			assert.equal(result.messageHistory, result.messageHistory);
			assert.equal(model.doStreamCalls.length, 1);
			assert.equal(model.doGenerateCalls.length, 0);
		});
	}

	it('returns a live result and emits terminal default text before the provider finishes', async () => {
		const source = controlledModel();
		const result = create.TextStreamer({ model: source.model, prompt: 'question' })();
		assert.ok(Symbol.asyncIterator in result.value);
		const iterator = result.value[Symbol.asyncIterator]();
		source.start();
		assert.deepEqual(await iterator.next(), { value: 'first', done: false });
		source.finish();
		assert.deepEqual(await iterator.next(), { value: ' last', done: false });
		assert.equal((await iterator.next()).done, true);
		assert.equal(await result.output, 'first last');
	});

	for (const transform of ['smooth', 'uppercase'] as const) {
		it(`streams default text incrementally through a ${transform} transform`, async () => {
			const source = controlledModel();
			const result = streamTextWithResult({ model: source.model, prompt: 'test',
				experimental_transform: transform === 'smooth' ? smoothStream({ delayInMs: null })
					: () => new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>({ transform(part, controller) {
						controller.enqueue(part.type === 'text-delta' ? { ...part, text: part.text.toUpperCase() } : part);
					} }),
			});
			const iterator = result.value[Symbol.asyncIterator]();
			let delivered = false;
			const pending = iterator.next().then(part => { delivered = true; return part; });
			source.start();
			if (transform === 'smooth') source.send({ type: 'text-delta', id: 'text', delta: ' ' });
			const native = result.textStream[Symbol.asyncIterator]();
			await native.next();
			await delay(0);
			const beforeFinish = delivered;
			source.finish();
			const first = await pending;
			const rest = await collect({ [Symbol.asyncIterator]: () => iterator });
			await native.return?.();
			assert.equal(beforeFinish, true);
			assert.equal(first.value, transform === 'smooth' ? 'first ' : 'FIRST');
			assert.equal([first.value, ...rest].join(''), await result.output);
			assert.equal(source.model.doStreamCalls.length, 1);
		});
	}

	for (const feature of ['tool-callers', 'deferred-provider'] as const) {
		it(`buffers with ${feature} while native text remains live`, async () => {
			const deferred = feature === 'deferred-provider';
			const source = controlledModel();
			const tools = { lookup: deferred ? tool({ type: 'provider', id: 'fixture.lookup', args: {},
				isProviderExecuted: true, supportsDeferredResults: true, inputSchema: z.object({ query: z.string() }) }) : lookup };
			const result = streamTextWithResult({ model: source.model, prompt: 'test', tools, toolChoice: 'none',
				...(!deferred && { experimental_toolCallers: { lookup: ['AI_SDK_DIRECT_TOOL_CALL'] } }),
			});
			const iterator = result.value[Symbol.asyncIterator]();
			let delivered = false;
			const pending = iterator.next().then(part => { delivered = true; return part; });
			const unavailable = deferred ? assert.rejects(pending, NoOutputGeneratedError) : undefined;
			source.start();
			const native = result.textStream[Symbol.asyncIterator]();
			assert.equal((await native.next()).value, 'first');
			await delay(0);
			const beforeFinish = delivered;
			if (deferred) source.send({ type: 'tool-call', toolCallId: 'call', toolName: 'lookup', input: '{"query":"test"}', providerExecuted: true });
			source.finish();
			if (deferred) await unavailable;
			else assert.deepEqual(await pending, { value: 'first last', done: false });
			await native.return?.();
			await iterator.return?.();
			assert.equal(beforeFinish, false);
			assert.equal(source.model.doStreamCalls.length, 1);
		});
	}

	it('closing one value iterator preserves SDK views and later value readers', async () => {
		const source = controlledModel();
		const result = streamTextWithResult({ model: source.model, prompt: 'question' });
		assert.ok(Symbol.asyncIterator in result.value);
		const iterator = result.value[Symbol.asyncIterator]();
		source.start();
		assert.equal((await iterator.next()).value, 'first');
		const closed = iterator.return?.();
		source.finish();
		await closed;
		assert.deepEqual(await value(result.value), ['first', ' last']);
		assert.equal((await collect(result.textStream)).join(''), 'first last');
	});

	it('streams a stable prefix and reuses final SDK text after overlapping blocks', async () => {
		const source = controlledModel();
		let resolveProcessed: () => void;
		const processed = new Promise<void>(resolve => { resolveProcessed = resolve; });
		const result = create.TextStreamer({ model: source.model, prompt: 'question', onChunk: ({ chunk }) => {
			if (chunk.type === 'text-end' && chunk.id === 'other') resolveProcessed();
		} })();
		const iterator = result.value[Symbol.asyncIterator]();
		source.start();
		assert.equal((await iterator.next()).value, 'first');
		let delivered = false;
		const next = iterator.next().then(part => { delivered = true; return part; });
		source.send(
			{ type: 'text-start', id: 'other' }, { type: 'text-delta', id: 'other', delta: ' OTHER' },
			{ type: 'text-delta', id: 'text', delta: ' middle' }, { type: 'text-end', id: 'other' },
		);
		await processed;
		assert.equal(delivered, false);
		source.finish();
		assert.deepEqual(await next, { value: ' middle last OTHER', done: false });
		assert.equal((await iterator.next()).done, true);
		assert.equal(await result.output, 'first middle last OTHER');
		assert.equal((await collect(result.value)).join(''), await result.output);
		assert.equal((await collect(result.textStream)).join(''), 'first OTHER middle last');
		assert.equal(source.model.doStreamCalls.length, 1);
	});

	for (const overlap of [false, true]) {
		it(`preserves text-block order with ${overlap ? 'an empty overlapping' : 'a completed preceding'} block`, async () => {
			const parts: LanguageModelV3StreamPart[] = [
				{ type: 'stream-start', warnings: [] }, { type: 'text-start', id: 'first' },
				...overlap ? [] : [{ type: 'text-delta' as const, id: 'first', delta: 'first' }, { type: 'text-end' as const, id: 'first' }],
				{ type: 'text-start', id: 'second' }, { type: 'text-delta', id: 'second', delta: 'second' }, { type: 'text-end', id: 'second' },
				...overlap ? [{ type: 'text-end' as const, id: 'first' }] : [],
				{ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
			];
			const model = new MockLanguageModelV3({ doStream: { stream: convertArrayToReadableStream(parts) } });
			const result = streamTextWithResult({ model, prompt: 'test' });
			assert.deepEqual(await collect(result.value), overlap ? ['second'] : ['first', 'second']);
			assert.equal((await collect(result.value)).join(''), await result.output);
		});
	}

	it('preserves failures after a stable prefix and overlapping text', async () => {
		const error = new Error('overlapping stream failed');
		const source = controlledModel();
		const result = streamTextWithResult({ model: source.model, prompt: 'test', onError: () => { /* Expected failure. */ } });
		const iterator = result.value[Symbol.asyncIterator]();
		source.start();
		assert.equal((await iterator.next()).value, 'first');
		source.send({ type: 'text-start', id: 'other' }, { type: 'text-delta', id: 'other', delta: 'unfinished' });
		source.fail(error);
		await assert.rejects(iterator.next(), caught => caught === error);
		assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'test' }, ...await result.responseMessages]);
	});

	for (const execution of [generateTextWithResult, streamTextWithResult]) {
		const mode = execution === generateTextWithResult ? 'generate' : 'stream';
		for (const reason of ['stop', 'length', 'content-filter', 'other', 'tool-calls', 'error'] as const) {
			for (const answer of ['', 'answer']) {
				it(`${mode}: ${reason} with ${answer ? 'nonempty' : 'empty'} output`, async () => {
					const model = mock({ content: answer ? [text(answer)] : [], reason });
					const request = execution({ model, prompt: 'test' });
					const available = reason === 'stop' || (answer !== '' && reason !== 'tool-calls' && reason !== 'error');
					const result = await request;
					if (available) {
						const final = await value(result.value);
						assert.equal(Array.isArray(final) ? final.join('') : final, answer);
					} else {
						const message = reason === 'error' ? /finished with an error but reported no cause/
							: reason === 'tool-calls' ? /ended with tool calls and no final application output/
								: new RegExp(`finished with '${reason}' and no text output`);
						await assert.rejects(async () => value(result.value), error => NoOutputGeneratedError.isInstance(error) && message.test(error.message));
					}
					assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'test' }, ...await result.responseMessages]);
				});
			}
		}

		it(`${mode}: selects final output after tools without exposing earlier-step commentary`, async () => {
			const model = mock({ content: [text('checking'), call()], reason: 'tool-calls' }, { content: [text('answer')] });
			const result = await execution({ model, prompt: 'test', tools: { lookup }, stopWhen: isStepCount(2) });
			const final = await value(result.value);
			assert.equal(Array.isArray(final) ? final.join('') : final, 'answer');
			assert.equal((await result.steps).length, 2);
			assert.equal((await result.messageHistory).length, 4);
		});

		for (const needsApproval of [false, true]) {
			it(`${mode}: retains history while waiting for ${needsApproval ? 'approval' : 'an external result'}`, async () => {
				const model = mock({ content: [text('commentary'), call()] });
				const pendingTool = tool({ inputSchema: z.object({ query: z.string() }), outputSchema: z.string(), needsApproval });
				const result = await execution({ model, prompt: 'test', tools: { lookup: pendingTool } });
				await assert.rejects(async () => value(result.value), error => NoOutputGeneratedError.isInstance(error)
					&& error.message.includes('tool results or approvals are pending'));
				assert.ok((await result.messageHistory).length >= 2);
			});
		}

		it(`${mode}: accepts an answer alongside a resolved local tool`, async () => {
			const model = mock({ content: [call(), text('answer')] });
			const result = await execution({ model, prompt: 'test', tools: { lookup } });
			const final = await value(result.value);
			assert.equal(Array.isArray(final) ? final.join('') : final, 'answer');
		});

		for (const deferred of [false, true]) {
			for (const resolved of [false, true]) {
				it(`${mode}: handles a ${resolved ? 'resolved' : 'unresolved'} provider tool with deferred=${deferred}`, async () => {
					const provider = tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
						supportsDeferredResults: deferred, inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() });
					const content = [call(true), ...(resolved ? [{ type: 'tool-result' as const, toolCallId: 'call', toolName: 'lookup', result: { answer: 3 } }] : []), text('answer')];
					const result = await execution({ model: mock({ content }), prompt: 'test', tools: { lookup: provider } });
					if (deferred && !resolved) await assert.rejects(async () => value(result.value), NoOutputGeneratedError);
					else {
						const final = await value(result.value);
						assert.equal(Array.isArray(final) ? final.join('') : final, 'answer');
					}
					assert.ok((await result.messageHistory).length >= 2);
				});
			}
		}

		it(`${mode}: retains denied tool calls for continuation without executing them`, async () => {
			let calls = 0;
			const result = await execution({ model: mock({ content: [call()], reason: 'tool-calls' }), prompt: 'test',
				tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: () => { calls++; return 'result'; } }) },
				toolApproval: { lookup: 'denied' },
			});
			await assert.rejects(async () => value(result.value), NoOutputGeneratedError);
			assert.ok((await result.messageHistory).length >= 2);
			assert.equal(calls, 0);
		});

		for (const resolution of ['missing', 'response', 'history']) {
			it(`${mode}: carries deferred work between invocations with its result ${resolution}`, async () => {
				const provider = tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
					supportsDeferredResults: true, inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() });
				const tools = { lookup: provider };
				const first = await execution({ model: mock({ content: [call(true)], reason: 'tool-calls' }), prompt: 'test', tools });
				const messages = [...await first.messageHistory];
				if (resolution === 'history') messages.push({ role: 'tool', content: [
					{ type: 'tool-result', toolCallId: 'call', toolName: 'lookup', output: { type: 'text', value: 'done' } },
				] });
				const snapshot = JSON.stringify(messages);
				const second = await execution({ model: mock({ content: [
					...(resolution === 'response' ? [{ type: 'tool-result' as const, toolCallId: 'call', toolName: 'lookup', result: 'done' }] : []), text('answer'),
				] }), messages, tools });
				if (resolution === 'missing') await assert.rejects(async () => value(second.value), NoOutputGeneratedError);
				else assert.deepEqual(await value(second.value), mode === 'stream' ? ['answer'] : 'answer');
				assert.equal(await second.output, 'answer');
				assert.deepEqual(await second.messageHistory, [...messages, ...await second.responseMessages]);
				assert.equal(JSON.stringify(messages), snapshot);
			});
		}

		for (const approved of [false, true]) {
			it(`${mode}: resolves an incoming local approval before the first model step with approved=${approved}`, async () => {
				let executions = 0;
				const tools = { lookup: tool({ inputSchema: z.object({ query: z.string() }), needsApproval: true,
					execute: () => { executions++; return 'done'; },
				}) };
				const first = await execution({ model: mock({ content: [call()], reason: 'tool-calls' }), prompt: 'test', tools });
				const messages = [...await first.messageHistory];
				const request = messages.flatMap(message => message.role === 'assistant' && typeof message.content !== 'string' ? message.content : [])
					.find(part => part.type === 'tool-approval-request');
				assert.ok(request?.type === 'tool-approval-request');
				messages.push({ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: request.approvalId, approved }] });
				const snapshot = JSON.stringify(messages);
				const second = await execution({ model: mock({ content: [text('answer')] }), messages, tools });
				assert.deepEqual(await value(second.value), mode === 'stream' ? ['answer'] : 'answer');
				assert.equal(executions, approved ? 1 : 0);
				assert.equal(JSON.stringify(messages), snapshot);
			});
		}

		it(`${mode}: accepts an incoming provider approval denial without requiring a provider result`, async () => {
			const tools = { lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
				inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }) };
			const messages: ModelMessage[] = [
				{ role: 'user', content: 'test' },
				{ role: 'assistant', content: [
					{ type: 'tool-call', toolCallId: 'call', toolName: 'lookup', input: { query: 'test' }, providerExecuted: true },
					{ type: 'tool-approval-request', toolCallId: 'call', approvalId: 'approval' },
				] },
				{ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: 'approval', approved: false }] },
			];
			const result = await execution({ model: mock({ content: [text('answer')] }), messages, tools });
			assert.deepEqual(await value(result.value), mode === 'stream' ? ['answer'] : 'answer');
			const history = await result.messageHistory;
			assert.ok(history.some(message => message.role === 'tool' && message.content.some(part => part.type === 'tool-approval-response' && !part.approved)));
			if (mode === 'stream') assert.equal((await result.responseMessages).some(message => message.role === 'tool'
				&& message.content.some(part => part.type === 'tool-result' && part.toolCallId === 'call')), false);
		});

		it(`${mode}: retains an unresolved provider approval from incoming history`, async () => {
			const tools = { lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
				inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }) };
			const first = await execution({ model: mock({ content: [call(true),
				{ type: 'tool-approval-request', toolCallId: 'call', approvalId: 'approval' },
			], reason: 'tool-calls' }), prompt: 'test', tools });
			const second = await execution({ model: mock({ content: [text('answer')] }), messages: await first.messageHistory, tools });
			await assert.rejects(async () => value(second.value), NoOutputGeneratedError);
			assert.equal(await second.output, 'answer');
			assert.ok((await second.messageHistory).length > 2);
		});

		it(`${mode}: checks SDK input history independently of dynamic history and request trimming`, async () => {
			const tools = { lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
				supportsDeferredResults: true, inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }) };
			const first = await execution({ model: mock({ content: [call(true)], reason: 'tool-calls' }), prompt: 'test', tools });
			const second = await execution({ model: mock({ content: [text('answer')] }), prompt: await first.messageHistory, tools,
				prepareStep: () => ({ messages: [{ role: 'user', content: 'trimmed request' }] }),
			}, []);
			await assert.rejects(async () => value(second.value), NoOutputGeneratedError);
			assert.deepEqual(await second.messageHistory, await second.responseMessages);
		});

		it(`${mode}: allows an answer after a recoverable tool error`, async () => {
			const model = mock({ content: [call()], reason: 'tool-calls' }, { content: [text('recovered')] });
			const result = await execution({ model, prompt: 'test', stopWhen: isStepCount(2),
				tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: (): string => { throw new Error('tool failure'); } }) },
			});
			const final = await value(result.value);
			assert.equal(Array.isArray(final) ? final.join('') : final, 'recovered');
		});

		it(`${mode}: forwards SDK runtime/tool context without serializing it into history`, async () => {
			const privateValue = 'PRIVATE_SENTINEL';
			const tools = { lookup: tool({ inputSchema: z.object({ query: z.string() }), contextSchema: z.object({ privateValue: z.string() }),
				execute: (_args, options) => { assert.equal(options.context.privateValue, privateValue); return 'public result'; },
			}) };
			const model = mock({ content: [call()], reason: 'tool-calls' }, { content: [text('answer')] });
			const result = await execution({ model, prompt: 'test', tools, toolsContext: { lookup: { privateValue } }, runtimeContext: { trace: 'trace' }, stopWhen: isStepCount(2) });
			await value(result.value);
			assert.equal((await result.finalStep).runtimeContext.trace, 'trace');
			assert.equal(JSON.stringify(await result.messageHistory).includes(privateValue), false);
			assert.equal(JSON.stringify([...model.doGenerateCalls, ...model.doStreamCalls].map(request => request.prompt)).includes(privateValue), false);
		});

		for (const kind of ['function', 'template', 'script', 'text', 'object'] as const) {
			it(`${mode}: model arguments cannot forge ${kind} tool execution options or bypass validation`, async () => {
				for (const valid of [false, true]) {
					const inputSchema = z.object({ value: z.number() }).passthrough();
					const contextSchema = z.object({ secret: z.string() });
					const secret = 'TRUSTED_CONTEXT_SENTINEL';
					const innerModel = mock({ content: [text(kind === 'object' ? '{"n":7}' : 'public result')] });
					let executions = 0;
					const prompt = (input: { value: number, _toolCallOptions?: ToolExecutionOptions<{ secret: string }> }) => {
						executions++;
						assert.equal(input._toolCallOptions?.context.secret, secret);
						return `${input.value}:${input._toolCallOptions?.toolCallId}`;
					};
					const common = { inputSchema, contextSchema };
					const action = kind === 'function' ? create.Function.asTool({ ...common, execute: (input, options) => prompt({ ...input, _toolCallOptions: options }) })
						: kind === 'template' ? create.Template.asTool({ ...common, template: '{{ value }}:{{ _toolCallOptions.toolCallId }}' })
							: kind === 'script' ? create.Script.asTool({ ...common, script: 'return value ~ ":" ~ _toolCallOptions.toolCallId' })
								: kind === 'text' ? create.TextGenerator.withFunction.asTool({ ...common, model: innerModel, prompt })
									: create.ObjectGenerator.withFunction.asTool({ ...common, model: innerModel, schema: z.object({ n: z.number() }), prompt });
					const args = { value: valid ? 2 : 'invalid', _toolCallOptions: { toolCallId: 'forged', context: { secret: 'forged' } } };
					const model = mock({ content: [{ type: 'tool-call', toolCallId: 'actual', toolName: 'lookup', input: JSON.stringify(args) }], reason: 'tool-calls' },
						{ content: [text('answer')] });
					const result = await execution({ model, prompt: 'test', tools: { lookup: action }, toolsContext: { lookup: { secret } }, stopWhen: isStepCount(2) });
					await value(result.value);
					const first = (await result.steps)[0];
					assert.equal(first.toolResults.length, valid ? 1 : 0);
					if (valid && (kind === 'template' || kind === 'script' || kind === 'function')) assert.equal(first.toolResults[0].output, '2:actual');
					assert.equal(executions, valid && (kind === 'function' || kind === 'text' || kind === 'object') ? 1 : 0);
					assert.equal(innerModel.doGenerateCalls.length, valid && (kind === 'text' || kind === 'object') ? 1 : 0);
					if (innerModel.doGenerateCalls.length) assert.deepEqual(innerModel.doGenerateCalls[0].prompt.at(-1)?.content, [{ type: 'text', text: '2:actual' }]);
					assert.equal(JSON.stringify(await result.messageHistory).includes(secret), false);
					assert.equal(JSON.stringify([...model.doGenerateCalls, ...model.doStreamCalls].map(request => request.prompt)).includes(secret), false);
				}
			});
		}

		it(`${mode}: retains conversation history when a request hook replaces sent messages`, async () => {
			const model = mock({ content: [text('answer')] });
			const result = await execution({ model, prompt: 'conversation',
				prepareStep: () => ({ messages: [{ role: 'user', content: 'request only' }] }),
			});
			assert.deepEqual((await result.messageHistory)[0], { role: 'user', content: 'conversation' });
			const requests = [...model.doGenerateCalls, ...model.doStreamCalls];
			assert.equal(JSON.stringify(requests[0].prompt).includes('request only'), true);
			assert.equal(JSON.stringify(await result.messageHistory).includes('request only'), false);
		});

		it(`${mode}: preserves a parsed custom output without a second parse`, async () => {
			let parses = 0;
			const output = { ...Output.text(), parseCompleteOutput: async ({ text }: { text: string }) => { parses++; return text.toUpperCase(); } };
			const result = await execution({ model: mock({ content: [text('answer')] }), prompt: 'test', output });
			const final = await value(result.value);
			assert.equal(Array.isArray(final) ? final.join('') : final, 'ANSWER');
			assert.equal(await result.output, 'ANSWER');
			assert.equal(parses, 1);
		});

		it(`${mode}: keeps object, choice and JSON values complete`, async () => {
			const cases = [
				{ output: Output.object({ schema: z.object({ n: z.string().transform(Number) }) }), raw: '{"n":"3"}', expected: { n: 3 } },
				{ output: Output.choice({ options: ['yes', 'no'] }), raw: '{"result":"yes"}', expected: 'yes' },
				{ output: Output.json(), raw: '{"n":3}', expected: { n: 3 } },
			];
			for (const item of cases) {
				const result = await execution({ model: mock({ content: [text(item.raw)] }), prompt: 'test', output: item.output });
				assert.equal(result.value, result.value);
				assert.deepEqual(await result.value, item.expected);
				assert.deepEqual(await result.output, item.expected);
			}
		});
	}

	it('collects only the final parsed array, including transformed elements', async () => {
		const output = Output.array({ element: z.string().transform(word => word.toUpperCase()) });
		const model = mock(
			{ content: [text('{"elements":["draft"]}'), call()], reason: 'tool-calls' },
			{ content: [text('{"elements":["final","second"]}')] },
		);
		const result = streamTextWithResult({ model, prompt: 'test', output, tools: { lookup }, stopWhen: isStepCount(2) });
		assert.deepEqual(await value(result.value), ['FINAL', 'SECOND']);
		assert.deepEqual(await value(result.value), ['FINAL', 'SECOND']);
		assert.deepEqual(await result.output, ['FINAL', 'SECOND']);
		assert.equal(model.doStreamCalls.length, 2);
	});

	for (const name of ['array', 'custom'] as const) {
		it(`uses the ${name} output name for delivery, preserving parsed arrays and native streams`, async () => {
			const model = mock({ content: [text('{"elements":["1","2"]}')] });
			const output = { ...Output.array({ element: z.string().transform(Number) }), name };
			const result = create.TextStreamer({ model, prompt: 'test', output })();
			assert.equal(Symbol.asyncIterator in result.value, name === 'array');
			assert.deepEqual(await value(result.value), [1, 2]);
			assert.deepEqual(await result.output, [1, 2]);
			assert.deepEqual(await collect(result.elementStream), [1, 2]);
			assert.equal(model.doStreamCalls.length, 1);
		});
	}

	it('retains single-use consumption of a custom parsed array iterator', async () => {
		let parses = 0;
		const parsed = [1, 2][Symbol.iterator]();
		const output = { ...Output.text(), name: 'array' as const,
			parseCompleteOutput: async () => { parses++; return parsed; },
		};
		const model = mock({ content: [text('answer')] });
		const result = create.TextStreamer({ model, output })('test');
		assert.deepEqual(await collect(result.value), [1, 2]);
		assert.deepEqual(await collect(result.value), []);
		assert.equal(await result.output, parsed);
		assert.equal(parses, 1);
		assert.equal(model.doStreamCalls.length, 1);
	});

	it('closes an ordinary array value view and preserves fresh readers', async () => {
		const output = { ...Output.array({ element: z.number() }), name: 'array' as const };
		const model = mock({ content: [text('{"elements":[1,2]}')] });
		const result = create.TextStreamer({ model, output })('test');
		const first = result.value[Symbol.asyncIterator]();
		assert.deepEqual(await first.next(), { value: 1, done: false });
		await first.return?.();
		assert.deepEqual(await collect(result.value), [1, 2]);
		assert.deepEqual(await result.output, [1, 2]);
		assert.equal(model.doStreamCalls.length, 1);
	});

	it('requires an iterable parsed result for custom array delivery', async () => {
		const parsed = { n: 1 };
		const output = { ...Output.text(), name: 'array' as const, parseCompleteOutput: async () => parsed };
		const result = create.TextStreamer({ model: mock({ content: [text('answer')] }), output })('test');
		assert.equal(await result.output, parsed);
		await assert.rejects(async () => value(result.value), TypeError);
	});

	for (const asynchronous of [false, true]) {
		it(`preserves promise-valued elements and closes a custom ${asynchronous ? 'async' : 'sync'} array iterator`, async () => {
			const element = Promise.resolve(1);
			let parses = 0;
			let closed = 0;
			const iterator = () => ({
				next: () => ({ done: false as const, value: element }),
				return: () => { closed++; return { done: true as const, value: undefined }; },
			});
			const parsed = asynchronous ? { [Symbol.asyncIterator]: () => {
				const source = iterator();
				return { next: async () => source.next(), return: async () => source.return() };
			} } : { [Symbol.iterator]: iterator };
			const output = { ...Output.array({ element: z.number() }), name: 'array' as const,
				parseCompleteOutput: async () => { parses++; return parsed; },
			};
			const result = create.TextStreamer({ model: mock({ content: [text('{"elements":[1]}')] }), output })('test');
			const unused = result.value[Symbol.asyncIterator]();
			await unused.return?.();
			assert.equal(parses, 0);
			assert.equal((await unused.next()).done, true);
			for await (const actual of result.value) {
				assert.equal(actual, element);
				break;
			}
			assert.equal(closed, 1);
			assert.equal(await result.output, parsed);
			assert.equal(parses, 1);
		});
	}

	it('retains structured values from a custom text parser without parsing again', async () => {
		let parses = 0;
		const output = { ...Output.text(), parseCompleteOutput: async ({ text }: { text: string }) => { parses++; return { answer: text }; } };
		const result = create.TextStreamer({ model: mock({ content: [text('answer')] }), prompt: 'test', output })();
		assert.deepEqual(await value(result.value), [{ answer: 'answer' }]);
		assert.deepEqual(await result.output, { answer: 'answer' });
		assert.equal(parses, 1);
	});

	it('tracks deferred provider results across steps', async () => {
		for (const resolved of [false, true]) {
			const provider = tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
				supportsDeferredResults: true, inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() });
			const first = chunks({ content: [call(true)], reason: 'tool-calls' });
			const second = chunks({ content: [...(resolved ? [{ type: 'tool-result' as const, toolCallId: 'call', toolName: 'lookup', result: 'done' }] : []), text('answer')] });
			const model = new MockLanguageModelV3({ doStream: [
				{ stream: convertArrayToReadableStream(first) }, { stream: convertArrayToReadableStream(second) },
			] });
			const result = streamTextWithResult({ model, prompt: 'test', tools: { lookup: provider }, stopWhen: isStepCount(2) });
			const steps = await result.steps;
			assert.equal(steps.length, 2);
			if (resolved) assert.deepEqual(await value(result.value), ['answer']);
			else await assert.rejects(async () => value(result.value), NoOutputGeneratedError);
		}
	});

	it('keeps preliminary tool results out of the completed exchange', async () => {
		const model = mock({ content: [call()], reason: 'tool-calls' }, { content: [text('answer')] });
		const result = streamTextWithResult({ model, prompt: 'test', stopWhen: isStepCount(2), tools: {
			lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: async function* () { yield 'partial'; yield 'done'; } }),
		} });
		const events = await collect(result.stream);
		assert.ok(events.some(part => part.type === 'tool-result' && part.preliminary && part.output === 'partial'));
		assert.deepEqual(await value(result.value), ['answer']);
		assert.equal(JSON.stringify(await result.messageHistory).includes('partial'), false);
	});

	it('keeps history when final output parsing fails after a completed exchange', async () => {
		const output = Output.object({ schema: z.object({ n: z.number() }).refine(() => false) });
		const result = streamTextWithResult({ model: mock({ content: [text('{"n":3}')] }), prompt: 'test', output });
		await assert.rejects(async () => value(result.value));
		assert.equal((await result.messageHistory).length, 2);
		await assert.rejects(generateTextWithResult({ model: mock({ content: [text('{"n":3}')] }), prompt: 'test', output }));
	});

	for (const [kind, output] of [['object', Output.object({ schema: z.object({ n: z.number() }) })],
		['array', Output.array({ element: z.number() })]] as const) {
		for (const reason of ['stop', 'length', 'content-filter', 'other'] as const) {
			for (const executable of [false, true]) {
				it(`preserves native eager ${kind} parsing with ${reason} and a ${executable ? 'local' : 'client'} tool`, async () => {
					const settings = () => {
						const state = { executions: 0, messages: [] as ModelMessage[] };
						return { state, request: {
							model: mock({ content: [text('Let me check.'), call()], reason }), prompt: 'test', output,
							tools: { lookup: executable
								? tool({ inputSchema: z.object({ query: z.string() }), execute: () => { state.executions++; return 'done'; } })
								: tool({ inputSchema: z.object({ query: z.string() }) }),
							},
							onEnd: ({ responseMessages }: { responseMessages: ModelMessage[] }) => { state.messages = responseMessages; },
						} };
					};
					for (const generate of [generateText, generateTextWithResult]) {
						const { request, state } = settings();
						await assert.rejects(generate(request), NoObjectGeneratedError);
						assert.equal(state.executions, executable && reason === 'stop' ? 1 : 0);
						assert.equal(state.messages.length, executable && reason === 'stop' ? 2 : 1);
						assert.equal(request.model.doGenerateCalls.length, 1);
					}
					const { request, state } = settings();
					const result = streamTextWithResult(request);
					await assert.rejects(async () => value(result.value), executable && reason === 'stop' ? NoObjectGeneratedError : NoOutputGeneratedError);
					await assert.rejects(async () => result.output, NoObjectGeneratedError);
					assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'test' }, ...await result.responseMessages]);
					assert.equal((await result.messageHistory).length, executable && reason === 'stop' ? 3 : 2);
					assert.equal(state.executions, executable && reason === 'stop' ? 1 : 0);
					assert.equal(request.model.doStreamCalls.length, 1);
				});
			}
		}
	}

	it('rejects whole-array validation after otherwise valid elements', async () => {
		const result = streamTextWithResult({ model: mock({ content: [text('{"elements":["one"]}')] }), prompt: 'test',
			output: Output.array({ element: z.string(), minItems: 2 }),
		});
		await assert.rejects(async () => value(result.value));
		assert.equal((await result.messageHistory).length, 2);
	});

	it('does not create a final-output parsing pass just to add properties or read history', async () => {
		let parses = 0;
		const output = { ...Output.text(), parseCompleteOutput: async ({ text }: { text: string }) => { parses++; return text; } };
		const result = streamTextWithResult({ model: mock({ content: [text('answer')] }), prompt: 'test', output });
		assert.equal(parses, 0);
		await result.messageHistory;
		assert.equal(parses, 0);
		assert.deepEqual(await value(result.value), ['answer']);
		assert.equal(parses, 1);
	});

	it('preserves a thrown SDK transform failure after native-only consumption', async () => {
		const error = new Error('transform failed');
		const result = streamTextWithResult({ model: mock({ content: [text('answer')] }), prompt: 'test',
			experimental_transform: () => new TransformStream({ transform() { throw error; } }),
		});
		await assert.rejects(async () => result.output, reason => reason === error);
		await assert.rejects(async () => result.responseMessages, reason => reason === error);
		await assert.rejects(result.messageHistory, reason => reason === error);
	});

	for (const changed of ['finish', 'finish-step', 'both'] as const) {
		for (const nativeFirst of [false, true]) for (const explicit of [false, true]) {
			it(`rejects a transformed ${changed} error with ${nativeFirst ? 'native' : 'value'} first and ${explicit ? 'explicit' : 'default'} output`, async () => {
				const result = streamTextWithResult({ model: mock({ content: [text('answer')] }), prompt: 'test',
					...(explicit && { output: Output.text() }),
					experimental_transform: () => new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>({ transform(part, controller) {
						if ((part.type === 'finish' || part.type === 'finish-step') && (changed === 'both' || part.type === changed)) {
							controller.enqueue({ ...part, finishReason: 'error' });
						} else controller.enqueue(part);
					} }),
				});
				if (nativeFirst) assert.equal(await result.output, 'answer');
				await assert.rejects(async () => value(result.value), NoOutputGeneratedError);
				assert.equal(await result.output, 'answer');
				assert.equal(await result.finishReason, changed === 'finish-step' ? 'stop' : 'error');
				assert.equal((await result.steps).at(-1)?.finishReason, changed === 'finish' ? 'stop' : 'error');
				assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'test' }, ...await result.responseMessages]);
			});
		}
	}

	it('preserves SDK normalization when a provider stream omits its finish event', async () => {
		const model = new MockLanguageModelV3({ doStream: { stream: convertArrayToReadableStream(chunks({ content: [text('unfinished')] }).slice(0, -1)) } });
		const result = streamTextWithResult({ model, prompt: 'test', onError: () => { /* Expected failure. */ } });
		assert.equal(await result.output, 'unfinished');
		assert.equal(await result.finishReason, 'other');
		assert.equal((await result.messageHistory).length, 2);
	});

	it('reports the original terminal error after a delivered prefix', async () => {
		const error = new Error('provider failed');
		const parts = chunks({ content: [text('prefix')] }).slice(0, -1);
		parts.push({ type: 'error', error });
		const model = new MockLanguageModelV3({ doStream: { stream: convertArrayToReadableStream(parts) } });
		const result = streamTextWithResult({ model, prompt: 'test', onError: () => { /* Expected failure. */ } });
		assert.ok(Symbol.asyncIterator in result.value);
		const iterator = result.value[Symbol.asyncIterator]();
		assert.equal((await iterator.next()).value, 'prefix');
		await assert.rejects(iterator.next(), reason => reason === error);
		assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'test' }, ...await result.responseMessages]);
	});

	it('characterizes native Agent error loss when the provider fails before returning a stream', async () => {
		const error = new Error('provider connection failed');
		const model = new MockLanguageModelV3({ doGenerate: async () => { throw error; }, doStream: async () => { throw error; } });
		const agent = new ToolLoopAgent({ model, maxRetries: 0 });
		await assert.rejects(agent.generate({ prompt: 'test' }), reason => reason === error);
		const result = await agent.stream({ prompt: 'test' });
		await assert.rejects(async () => result.output, reason => NoOutputGeneratedError.isInstance(reason) && reason.cause === undefined);
		await assert.rejects(async () => result.responseMessages, reason => reason === error);
		assert.equal(model.doGenerateCalls.length, 1);
		assert.equal(model.doStreamCalls.length, 1);
	});

	for (const kind of ['default', 'text', 'array', 'object'] as const) {
		for (const order of ['value-first', 'native-first', 'concurrent'] as const) {
			it(`preserves the provider connection error in ${kind} value with ${order} consumption`, async () => {
				const error = new Error('provider connection failed');
				const model = new MockLanguageModelV3({ doStream: async () => { throw error; } });
				const result = create.TextStreamer({ model, prompt: 'test', maxRetries: 0, onError: () => undefined,
					...(kind !== 'default' && { output: kind === 'array' ? Output.array({ element: z.number() })
						: kind === 'object' ? Output.object({ schema: z.object({ n: z.number() }) }) : Output.text() }),
				})();
				const nativeFailure = () => assert.rejects(async () => result.output, reason => NoOutputGeneratedError.isInstance(reason) && reason.cause === undefined);
				if (order === 'native-first') await nativeFailure();
				const historyError = result.messageHistory.catch((reason: unknown) => reason);
				const nativeHistoryError = Promise.resolve(result.responseMessages).catch((reason: unknown) => reason);
				await Promise.all([
					assert.rejects(async () => value(result.value), reason => reason === error),
					...(order === 'concurrent' ? [nativeFailure(), collect(result.stream), collect(result.textStream)] : []),
				]);
				await nativeFailure();
				assert.equal(await historyError, await nativeHistoryError);
				assert.ok(await historyError instanceof Error);
				assert.equal(model.doStreamCalls.length, 1);
			});
		}
	}

	for (const withCause of [false, true]) {
		it(`preserves a native rejection ${withCause ? 'with its own cause' : 'of another error type'} despite an earlier error chunk`, async () => {
			const reported = new Error('reported error');
			const nativeError = withCause ? new NoOutputGeneratedError({ cause: new Error('native cause') }) : new Error('native transform failure');
			let observed!: () => void;
			const received = new Promise<void>(resolve => { observed = resolve; });
			const model = new MockLanguageModelV3({ doStream: { stream: convertArrayToReadableStream([{ type: 'error', error: reported }]) } });
			const result = streamTextWithResult({ model, prompt: 'test', output: Output.object({ schema: z.object({ n: z.number() }) }),
				onError: () => undefined,
				onChunk: ({ chunk }) => { if (chunk.type === 'error' && chunk.error === reported) observed(); },
				experimental_transform: () => new TransformStream({ transform(part, controller) { controller.enqueue(part); },
					async flush() { await received; throw nativeError; },
				}),
			});
			await assert.rejects(async () => value(result.value), reason => reason === nativeError);
			await assert.rejects(async () => result.steps, reason => reason === nativeError);
		});
	}

	for (const invalid of ['missing-start', 'unknown-id', 'after-end']) {
		it(`excludes the ${invalid} delta from value when the SDK excludes it from final output`, async () => {
			const parts: LanguageModelV3StreamPart[] = [{ type: 'stream-start', warnings: [] }];
			if (invalid !== 'missing-start') parts.push({ type: 'text-start', id: 'text' }, { type: 'text-delta', id: 'text', delta: 'answer' });
			if (invalid === 'after-end') parts.push({ type: 'text-end', id: 'text' });
			parts.push({ type: 'text-delta', id: invalid === 'unknown-id' ? 'unknown' : 'text', delta: 'phantom' },
				{ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage });
			const settings = () => ({ model: new MockLanguageModelV3({ doStream: { stream: convertArrayToReadableStream(parts) } }),
				prompt: 'test', onError: () => undefined,
			});
			const native = streamText(settings());
			const result = streamTextWithResult(settings());
			assert.ok(Symbol.asyncIterator in result.value);
			assert.equal((await collect(result.value)).join(''), await native.output);
			assert.equal(await result.output, await native.output);
			assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'test' }, ...await native.responseMessages]);
		});
	}

	it('does not substitute a successful earlier step when a continuation fails inside its stream', async () => {
		const error = new Error('continuation failed');
		const model = new MockLanguageModelV3({ doStream: [
			{ stream: convertArrayToReadableStream(chunks({ content: [text('earlier'), call()], reason: 'tool-calls' })) },
			{ stream: convertArrayToReadableStream([{ type: 'error', error }]) },
		] });
		const result = streamTextWithResult({ model, prompt: 'test', tools: { lookup }, stopWhen: isStepCount(2), onError: () => { /* Expected failure. */ } });
		await assert.rejects(async () => value(result.value), reason => reason === error);
		assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'test' }, ...await result.responseMessages]);
	});

	for (const phase of ['prepareStep', 'model']) {
		for (const reason of ['stop', 'tool-calls'] as const) {
			it(`preserves native completed steps after a ${reason} step when ${phase} fails before returning a stream`, async () => {
				const error = new Error('continuation setup failed');
				const errors: unknown[] = [];
				const request = () => {
					let calls = 0;
					return {
						model: new MockLanguageModelV3({ doStream: async () => {
							if (calls++ > 0) throw error;
							return { stream: convertArrayToReadableStream(chunks({ content: [text('earlier'), call()], reason })) };
						} }),
						prompt: 'test', tools: { lookup }, stopWhen: isStepCount(2), maxRetries: 0,
						prepareStep: ({ stepNumber }: { stepNumber: number }) => {
							if (phase === 'prepareStep' && stepNumber === 1) throw error;
							return undefined;
						},
						onError: ({ error }: { error: unknown }) => { errors.push(error); },
					};
				};
				const native = streamText(request());
				const result = streamTextWithResult(request());
				assert.equal(await native.output, 'earlier');
				assert.equal(await result.output, await native.output);
				assert.equal((await result.steps).length, 1);
				assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'test' }, ...await native.responseMessages]);
				if (reason === 'stop') assert.deepEqual(await value(result.value), ['earlier']);
				else await assert.rejects(async () => value(result.value), NoOutputGeneratedError);
				assert.deepEqual(errors, [error, error]);
			});
		}
	}

	it('preserves a generation continuation failure instead of manufacturing a result', async () => {
		const error = new Error('continuation failed');
		let calls = 0;
		const model = new MockLanguageModelV3({ doGenerate: async () => {
			if (calls++ > 0) throw error;
			return { content: [text('earlier'), call()], finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage, warnings: [] };
		} });
		await assert.rejects(generateTextWithResult({ model, prompt: 'test', tools: { lookup }, stopWhen: isStepCount(2), maxRetries: 0 }), reason => reason === error);
		assert.equal(calls, 2);
	});

	it('forwards native generation cancellation and preserves its reason', async () => {
		const controller = new AbortController();
		const error = new Error('cancel generation');
		const model = new MockLanguageModelV3({ doGenerate: async request => {
			assert.equal(request.abortSignal, controller.signal);
			controller.abort(error);
			request.abortSignal?.throwIfAborted();
			return { content: [text('late')], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] };
		} });
		await assert.rejects(generateTextWithResult({ model, prompt: 'test', abortSignal: controller.signal }), reason => reason === error);
		assert.equal(model.doGenerateCalls.length, 1);
	});

	for (const cooperative of [false, true]) {
		it(`preserves native generation cancellation during a ${cooperative ? 'cooperative' : 'non-cooperative'} tool`, async () => {
			for (const mode of ['sdk', 'agent', 'casai'] as const) {
				const controller = new AbortController();
				const reason = new Error('user cancelled');
				let started!: () => void;
				let release!: () => void;
				const ready = new Promise<void>(resolve => { started = resolve; });
				const wait = new Promise<void>(resolve => { release = resolve; });
				const model = mock({ content: [call()], reason: 'tool-calls' });
				const request = { model, prompt: 'test', abortSignal: controller.signal, tools: {
					lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: async (_input, options) => {
						started();
						await wait;
						if (cooperative) options.abortSignal?.throwIfAborted();
						return 'done';
					} }),
				}, stopWhen: isStepCount(1) };
				const pending = mode === 'sdk' ? generateText(request) : mode === 'agent'
					? new ToolLoopAgent({ model, tools: request.tools, stopWhen: request.stopWhen }).generate({ prompt: 'test', abortSignal: controller.signal })
					: generateTextWithResult(request);
				await ready;
				controller.abort(reason);
				release();
				const result = await pending;
				assert.equal(result.finishReason, 'tool-calls');
				assert.equal(result.steps[0].content.some(part => part.type === (cooperative ? 'tool-error' : 'tool-result')), true);
				if ('value' in result) assert.throws(() => result.value, NoOutputGeneratedError);
				if ('messageHistory' in result) assert.deepEqual(result.messageHistory, [{ role: 'user', content: 'test' }, ...result.responseMessages]);
				assert.equal(model.doGenerateCalls.length, 1);
			}
		});

		it(`preserves the native abort reason while a ${cooperative ? 'cooperative' : 'non-cooperative'} streaming tool runs`, async () => {
			for (const augmented of [false, true]) {
				const controller = new AbortController();
				const reason = new Error('user cancelled');
				let started!: () => void;
				let release!: () => void;
				const ready = new Promise<void>(resolve => { started = resolve; });
				const wait = new Promise<void>(resolve => { release = resolve; });
				const model = mock({ content: [call()], reason: 'tool-calls' });
				const execute = augmented ? streamTextWithResult : streamText;
				const result = execute({ model, prompt: 'test', abortSignal: controller.signal, tools: {
					lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: async (_input, options) => {
						started();
						await wait;
						if (cooperative) options.abortSignal?.throwIfAborted();
						return 'done';
					} }),
				} });
				const failedSteps = assert.rejects(async () => result.steps, error => error === reason);
				const failedValue = 'value' in result ? assert.rejects(async () => value(result.value), error => error === reason) : undefined;
				await ready;
				controller.abort(reason);
				release();
				await failedSteps;
				await failedValue;
				await assert.rejects(async () => result.responseMessages, error => error === reason);
				if ('messageHistory' in result) await assert.rejects(async () => result.messageHistory, error => error === reason);
				assert.equal(model.doStreamCalls.length, 1);
			}
		});
	}

	it('preserves retry control and excludes abandoned output', async () => {
		const error = new Error('retry');
		const model = new MockLanguageModelV3({ doStream: [
			{ stream: convertArrayToReadableStream([...chunks({ content: [text('abandoned')] }).slice(0, -1), { type: 'error', error }]) },
			{ stream: convertArrayToReadableStream(chunks({ content: [text('recovered')] })) },
		] });
		let errors = 0;
		const result = streamTextWithResult({ model, prompt: 'test', streamRetries: 0, onError: event => {
			assert.equal(event.error, error);
			errors++;
			return { retry: true };
		} });
		assert.deepEqual(await value(result.value), ['recovered']);
		assert.equal(errors, 1);
		assert.equal(model.doStreamCalls.length, 2);
	});

	for (const retry of ['automatic', 'callback']) {
		for (const hasTerminalCause of [false, true]) {
			it(`scopes errors to the final ${retry} retry attempt ${hasTerminalCause ? 'with' : 'without'} a cause`, async () => {
				const discarded = new Error('discarded attempt');
				const terminal = new Error('terminal attempt');
				const model = new MockLanguageModelV3({ doStream: [
					{ stream: convertArrayToReadableStream([...chunks({ content: [text('abandoned')] }).slice(0, -1), { type: 'error', error: discarded }]) },
					{ stream: convertArrayToReadableStream(hasTerminalCause
						? [{ type: 'error', error: terminal }]
						: chunks({ content: [text('final')], reason: 'error' })) },
				] });
				let starts = 0;
				let legacyStarts = 0;
				const result = streamTextWithResult({ model, prompt: 'test', streamRetries: retry === 'automatic' ? 1 : 0,
					...(retry === 'automatic' ? { onLanguageModelCallStart: () => { starts++; } } : {}),
					experimental_onLanguageModelCallStart: () => { legacyStarts++; },
					onError: ({ error }) => error === discarded && retry === 'callback' ? { retry: true } : undefined,
				});
				const expected = (error: unknown) => hasTerminalCause ? error === terminal : NoOutputGeneratedError.isInstance(error);
				await assert.rejects(async () => value(result.value), expected);
				assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'test' }, ...await result.responseMessages]);
				assert.equal(model.doStreamCalls.length, 2);
				assert.equal(starts, retry === 'automatic' ? 2 : 0);
				assert.equal(legacyStarts, retry === 'callback' ? 2 : 0);
			});
		}
	}

	it('uses effective prepareStep settings for incremental finality without rerunning hooks', async () => {
		const source = controlledModel();
		let preparations = 0;
		let starts = 0;
		const result = streamTextWithResult({ model: source.model, prompt: 'test', tools: { lookup },
			prepareStep: () => { preparations++; return { toolChoice: 'none' }; },
			onStepStart: () => { starts++; },
		});
		assert.ok(Symbol.asyncIterator in result.value);
		const iterator = result.value[Symbol.asyncIterator]();
		source.start();
		assert.equal((await iterator.next()).value, 'first');
		source.finish();
		await collect({ [Symbol.asyncIterator]: () => iterator });
		assert.equal(preparations, 1);
		assert.equal(starts, 1);
	});

	it('buffers when prepareStep re-enables tools while native SDK events remain live', async () => {
		const source = controlledModel();
		const result = streamTextWithResult({ model: source.model, prompt: 'test', tools: { lookup }, toolChoice: 'none',
			prepareStep: () => ({ toolChoice: 'auto' }),
		});
		assert.ok(Symbol.asyncIterator in result.value);
		const iterator = result.value[Symbol.asyncIterator]();
		let delivered = false;
		const pending = iterator.next().then(chunk => { delivered = true; return chunk; });
		source.start();
		const native = result.textStream[Symbol.asyncIterator]();
		assert.equal((await native.next()).value, 'first');
		assert.equal(delivered, false);
		source.finish();
		assert.equal((await pending).value, 'first last');
		await collect({ [Symbol.asyncIterator]: () => native });
		await iterator.return?.();
	});

	for (const controls of ['toolChoice-none', 'activeTools-empty', 'no-tools'] as const) {
		for (const nativeFirst of [false, true]) {
			it(`rejects value when a provider continues despite ${controls}, with ${nativeFirst ? 'native' : 'value'} consumption first`, async () => {
				const model = mock(
					{ content: [text('intermediate'), call()], reason: 'tool-calls' },
					{ content: [text('final')] },
				);
				let executions = 0;
				const tools: ToolSet = controls === 'no-tools' ? {} : { lookup: tool({ inputSchema: z.object({ query: z.string() }),
					execute: () => { executions++; return 'done'; },
				}) };
				const result = create.TextStreamer({ model, tools, stopWhen: isStepCount(2),
					...(controls === 'toolChoice-none' ? { toolChoice: 'none' as const } : { activeTools: [] }),
				})('test');
				if (nativeFirst) assert.equal(await result.output, 'final');
				const iterator = result.value[Symbol.asyncIterator]();
				assert.equal((await iterator.next()).value, 'intermediate');
				await assert.rejects(collect({ [Symbol.asyncIterator]: () => iterator }), NoOutputGeneratedError);
				assert.equal(await result.output, 'final');
				assert.deepEqual(await collect(result.textStream), ['intermediate', 'final']);
				assert.equal((await result.messageHistory).at(-1)?.role, 'assistant');
				assert.equal(model.doStreamCalls.length, 2);
				assert.equal(Boolean(model.doStreamCalls[0].tools?.length), controls === 'toolChoice-none');
				assert.equal(executions, controls === 'toolChoice-none' ? 1 : 0);
			});
		}
	}

	it('forwards the complete timeout configuration to the SDK without mutation', async () => {
		const configured = Object.freeze({ totalMs: 500, stepMs: 300, toolMs: 200 });
		for (const execute of [generateTextWithResult, streamTextWithResult]) {
			let timeout: unknown;
			const result = await execute({ model: mock({ content: [text('answer')] }), prompt: 'test', timeout: configured,
				onStart: event => { timeout = event.timeout; },
			});
			await result.output;
			assert.equal(timeout, configured);
			assert.deepEqual(configured, { totalMs: 500, stepMs: 300, toolMs: 200 });
		}
	});

	it('preserves SDK total timeout failure in value and native message availability', async () => {
		const source = controlledModel();
		const result = streamTextWithResult({ model: source.model, prompt: 'test', timeout: 30 });
		assert.ok(Symbol.asyncIterator in result.value);
		const iterator = result.value[Symbol.asyncIterator]();
		source.start();
		assert.equal((await iterator.next()).value, 'first');
		await assert.rejects(iterator.next(), { name: 'TimeoutError' });
		await assert.rejects(async () => result.responseMessages, { name: 'TimeoutError' });
		await assert.rejects(result.messageHistory, { name: 'TimeoutError' });
	});

	it('retains completed native results after a late abort or timeout', async () => {
		const controller = new AbortController();
		const result = streamTextWithResult({ model: mock({ content: [text('answer')] }), prompt: 'test', abortSignal: controller.signal, timeout: 40 });
		assert.equal(await result.output, 'answer');
		await delay(55);
		controller.abort(new Error('late'));
		assert.deepEqual(await value(result.value), ['answer']);
		assert.equal((await result.messageHistory).length, 2);
	});

	it('preserves SDK step-timeout reasons and invokes the abort callback once', async () => {
		const source = controlledModel();
		let reason: unknown;
		let aborts = 0;
		const result = streamTextWithResult({ model: source.model, prompt: 'test', timeout: { stepMs: 20 },
			onAbort: event => { reason = event.reason; aborts++; },
		});
		source.start();
		await assert.rejects(async () => value(result.value), error => error === reason && error instanceof DOMException && error.name === 'TimeoutError');
		await assert.rejects(async () => result.responseMessages, error => error === reason);
		await assert.rejects(result.messageHistory, error => error === reason);
		assert.equal(aborts, 1);
	});
});

describe('Public generator and streamer augmentation', () => {
	for (const streaming of [false, true]) {
		for (const renderer of ['text', 'template', 'script', 'function', 'loaded-text', 'loaded-template', 'loaded-script']) {
			it(`${streaming ? 'streamer' : 'generator'}: ${renderer} returns value and dynamic history from one execution`, async () => {
				const model = mock({ content: [text('answer')] });
				const config = { model, messages: [{ role: 'user', content: 'Static instruction.' } satisfies ModelMessage] };
				const input = { ...config, context: { input: 'question' } };
				const textConfig = { ...config, prompt: 'question' };
				const templateConfig = { ...input, prompt: '{{ input }}' };
				const scriptConfig = { ...input, prompt: 'return input' };
				const functionConfig = { ...config, prompt: () => 'question' };
				const loadedText = { ...config, prompt: 'source', loader: { load: () => 'question' } };
				const loadedTemplate = { ...input, prompt: 'source', loader: { load: () => '{{ input }}' } };
				const loadedScript = { ...input, prompt: 'source', loader: { load: () => 'return input' } };
				const component = renderer === 'text' ? streaming ? create.TextStreamer(textConfig) : create.TextGenerator(textConfig)
					: renderer === 'template' ? streaming ? create.TextStreamer.withTemplate(templateConfig) : create.TextGenerator.withTemplate(templateConfig)
						: renderer === 'script' ? streaming ? create.TextStreamer.withScript(scriptConfig) : create.TextGenerator.withScript(scriptConfig)
							: renderer === 'function' ? streaming ? create.TextStreamer.withFunction(functionConfig) : create.TextGenerator.withFunction(functionConfig)
								: renderer === 'loaded-text' ? streaming ? create.TextStreamer.loadsText(loadedText) : create.TextGenerator.loadsText(loadedText)
									: renderer === 'loaded-template' ? streaming ? create.TextStreamer.loadsTemplate(loadedTemplate) : create.TextGenerator.loadsTemplate(loadedTemplate)
										: streaming ? create.TextStreamer.loadsScript(loadedScript) : create.TextGenerator.loadsScript(loadedScript);
				const history: ModelMessage[] = [{ role: 'assistant', content: 'Earlier answer.' }];
				const result = await component.run({ messages: history });
				assert.deepEqual(await value(result.value), streaming ? ['answer'] : 'answer');
				assert.deepEqual(await result.messageHistory, [...history, { role: 'user', content: 'question' }, ...await result.responseMessages]);
				assert.deepEqual((await result.response).messages, (await result.finalStep).response.messages);
				assert.equal('messageHistory' in await result.response, false);
				assert.equal(model.doGenerateCalls.length, streaming ? 0 : 1);
				assert.equal(model.doStreamCalls.length, streaming ? 1 : 0);
			});
		}

		it(`${streaming ? 'streamer' : 'generator'} uses parsed structured output without parsing again`, async () => {
			let parses = 0;
			const output = Output.object({ schema: z.object({ n: z.string().transform(value => { parses++; return Number(value); }) }) });
			const config = { model: mock({ content: [text('{"n":"3"}')] }), prompt: 'question', output };
			const component = streaming ? create.TextStreamer(config) : create.TextGenerator(config);
			const result = await component();
			assert.deepEqual(await result.value, { n: 3 });
			assert.deepEqual(await result.output, { n: 3 });
			assert.equal(parses, 1);
		});
	}
});

describe('Result augmentation in tools and templates', () => {
	for (const [name, factory, object] of [
		['TextGenerator', create.TextGenerator, false], ['ObjectGenerator', create.ObjectGenerator, true],
	] as const) {
		for (const modifier of ['withText', 'withTemplate', 'withScript', 'withFunction', 'loadsText', 'loadsTemplate', 'loadsScript'] as const) {
			it(`${name}.${modifier}.asTool forwards cancellation without affecting later calls`, async () => {
				const reason = { cancelled: true };
				const controller = new AbortController();
				const options = { toolCallId: 'outer', messages: [], context: undefined };
				const input = { query: 'test' };
				let started!: () => void;
				const ready = new Promise<void>(resolve => { started = resolve; });
				let waitForAbort = true;
				const model = new MockLanguageModelV3({ doGenerate: async request => {
					if (waitForAbort) {
						const signal = request.abortSignal;
						assert.ok(signal);
						await new Promise<void>((_resolve, reject) => {
							signal.addEventListener('abort', () => {
								// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Preserve arbitrary AbortSignal reasons by identity.
								reject(signal.reason);
							}, { once: true });
							started();
						});
					}
					return { content: [text(object ? '{"n":3}' : 'answer')], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] };
				} });
				const source = modifier.includes('Template') ? '{{ query }}' : modifier.includes('Script') ? 'return query' : 'test';
				const build = factory[modifier].asTool as (config: object) => {
					execute(args: typeof input, options: ToolExecutionOptions<undefined>): PromiseLike<unknown>;
				};
				const nested = build({ model, inputSchema: z.object({ query: z.string() }),
					prompt: modifier === 'withFunction' ? ({ query }: typeof input) => query : modifier.startsWith('loads') ? 'source' : source,
					...(object && { schema: z.object({ n: z.number() }) }),
					...(modifier.startsWith('loads') && { loader: { load: () => source } }),
				});
				const aborted = new AbortController();
				aborted.abort(reason);
				await assert.rejects(async () => nested.execute(input, { ...options, abortSignal: aborted.signal }), error => error === reason);
				assert.equal(model.doGenerateCalls.length, 0);
				const pending = nested.execute(input, { ...options, abortSignal: controller.signal });
				const rejected = assert.rejects(async () => pending, error => error === reason);
				await ready;
				controller.abort(reason);
				await rejected;
				waitForAbort = false;
				assert.deepEqual(await nested.execute(input, options), object ? { n: 3 } : 'answer');
				assert.equal(model.doGenerateCalls.length, 2);
			});
		}
	}

	for (const reason of ['tool-calls', 'stop', 'error'] as const) {
		it(`reports an unavailable nested ${reason} value to the outer model as a tool error`, async () => {
			const step: Step = { content: [text('Let me check.'), call()], reason };
			const model = mock(step, step);
			const nested = create.TextGenerator.withFunction.asTool({ model, inputSchema: z.object({ query: z.string() }),
				prompt: ({ query }) => query, tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }) }) },
			});
			const direct = await nested({ query: 'test' });
			assert.throws(() => direct.value, NoOutputGeneratedError);
			const outerModel = mock({ content: [call()], reason: 'tool-calls' }, { content: [text('Outer answer.')] });
			const outer = await generateTextWithResult({ model: outerModel, prompt: 'test', tools: { lookup: nested }, stopWhen: isStepCount(2) });
			const failure = outer.steps[0].content.find(part => part.type === 'tool-error');
			assert.ok(failure?.type === 'tool-error');
			assert.ok(NoOutputGeneratedError.isInstance(failure.error));
			const sent = outerModel.doGenerateCalls[1].prompt.find(message => message.role === 'tool');
			assert.ok(sent?.role === 'tool');
			assert.equal(sent.content[0].type, 'tool-result');
			assert.equal(sent.content[0].output.type, 'error-text');
			assert.equal(outer.value, 'Outer answer.');
			assert.equal(model.doGenerateCalls.length, 2);
		});
	}

	it('reports a nested approval pause as an outer tool error without forwarding inner history', async () => {
		const innerMessages: ModelMessage[] = [];
		let executions = 0;
		const nested = create.TextGenerator.asTool({ model: mock({ content: [call()], reason: 'tool-calls' }),
			prompt: 'test', inputSchema: z.object({ query: z.string() }),
			tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }), needsApproval: true,
				execute: () => { executions++; return 'done'; } }) },
			onEnd: event => { innerMessages.push(...event.responseMessages); },
		});
		const outer = await generateTextWithResult({ model: mock({ content: [call()], reason: 'tool-calls' }, { content: [text('answer')] }),
			prompt: 'test', tools: { lookup: nested }, stopWhen: isStepCount(2),
		});
		assert.ok(innerMessages.some(message => message.role === 'assistant' && typeof message.content !== 'string'
			&& message.content.some(part => part.type === 'tool-approval-request')));
		assert.ok(outer.steps[0].content.some(part => part.type === 'tool-error' && NoOutputGeneratedError.isInstance(part.error)));
		assert.equal(outer.messageHistory.some(message => message.role === 'assistant' && typeof message.content !== 'string'
			&& message.content.some(part => part.type === 'tool-approval-request')), false);
		assert.equal(executions, 0);
	});

	it('returns parsed application output from a text tool without parsing again', async () => {
		let parses = 0;
		const raw = '{"n":"7"}';
		const model = mock({ content: [text(raw)] }, { content: [text(raw)] }, { content: [text(raw)] });
		const nested = create.TextGenerator.withFunction.asTool({ model, inputSchema: z.object({ query: z.string() }),
			prompt: ({ query }) => query,
			output: Output.object({ schema: z.object({ n: z.string().transform(value => { parses++; return Number(value); }) }) }),
		});
		assert.deepEqual((await nested({ query: 'test' })).value, { n: 7 });
		const result: { n: number } = await nested.execute({ query: 'test' }, { toolCallId: 'outer', messages: [], context: undefined });
		assert.deepEqual(result, { n: 7 });
		const outerModel = mock({ content: [call()], reason: 'tool-calls' }, { content: [text('answer')] });
		const outer = await generateTextWithResult({ model: outerModel, prompt: 'test', tools: { lookup: nested }, stopWhen: isStepCount(2) });
		assert.deepEqual(outer.steps[0].toolResults[0].output, { n: 7 });
		const sent = outerModel.doGenerateCalls[1].prompt.find(message => message.role === 'tool');
		assert.ok(sent?.role === 'tool');
		assert.equal(sent.content[0].type, 'tool-result');
		assert.deepEqual(sent.content[0].output, { type: 'json', value: { n: 7 } });
		assert.equal(parses, 3);
		assert.equal(model.doGenerateCalls.length, 3);
	});

	it('consumes a streaming value with a template loop using one execution', async () => {
		const model = mock({ content: [text('answer')] });
		const writer = create.TextStreamer({ model });
		const render = create.Template({ template: 'Before {% for chunk in writer("test").value %}{{ chunk }}{% endfor %} after', context: { writer } });
		assert.equal(await render(), 'Before answer after');
		assert.equal(model.doStreamCalls.length, 1);
	});

	it('propagates unavailable streaming value through a template loop', async () => {
		const model = mock({ content: [text('Let me check.'), call()], reason: 'tool-calls' });
		const writer = create.TextStreamer({ model, tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }) }) } });
		const render = create.Template({ template: '{% for chunk in writer("test").value %}{{ chunk }}{% endfor %}', context: { writer } });
		await assert.rejects(render(), /ended with tool calls and no final application output/);
		assert.equal(model.doStreamCalls.length, 1);
	});
});

describe('Object result augmentation', () => {
	for (const streaming of [false, true]) {
		it(`${streaming ? 'streamer' : 'generator'} exposes the parsed object without a second parse`, async () => {
			let parses = 0;
			const schema = z.object({ n: z.string().transform(value => { parses++; return Number(value); }) });
			const model = mock({ content: [text('{"n":"3"}')] });
			const config = { model, prompt: 'question', schema };
			const component = streaming ? create.ObjectStreamer(config) : create.ObjectGenerator(config);
			const result = await component();
			assert.equal('value' in { ...result }, false);
			assert.equal('value' in Object.assign({}, result), false);
			assert.doesNotThrow(() => JSON.stringify(result));
			assert.equal(result.value, result.value);
			assert.equal(result.value, result.object);
			if ('partialObjectStream' in result) await collect(result.partialObjectStream);
			assert.deepEqual(await result.value, { n: 3 });
			assert.equal(await result.value, await result.object);
			assert.equal(parses, 1);
			assert.equal(model.doGenerateCalls.length, streaming ? 0 : 1);
			assert.equal(model.doStreamCalls.length, streaming ? 1 : 0);
			assert.equal('messages' in await result.response, false);
			assert.equal('messageHistory' in result, false);
		});

		it(`${streaming ? 'streamer' : 'generator'} retains array output and native result views`, async () => {
			const model = mock({ content: [text('{"elements":[1,2]}')] });
			const config = { model, prompt: 'question', output: 'array' as const, schema: z.number() };
			const component = streaming ? create.ObjectStreamer(config) : create.ObjectGenerator(config);
			const result = await component();
			assert.equal(result.value, result.value);
			assert.equal(result.value, result.object);
			if ('elementStream' in result) assert.deepEqual(await collect(result.elementStream), [1, 2]);
			assert.deepEqual(await result.value, [1, 2]);
			assert.deepEqual(await result.object, [1, 2]);
			assert.equal(model.doGenerateCalls.length + model.doStreamCalls.length, 1);
		});

		it(`${streaming ? 'streamer' : 'generator'} keeps no-schema JSON complete even when it is an array`, async () => {
			const config = { model: mock({ content: [text('[1,2]')] }), prompt: 'question', output: 'no-schema' as const };
			const component = streaming ? create.ObjectStreamer(config) : create.ObjectGenerator(config);
			const result = await component();
			if ('textStream' in result) assert.deepEqual(await collect(result.textStream), ['[1,2]']);
			assert.deepEqual(await result.value, [1, 2]);
			assert.equal(await result.value, await result.object);
		});
	}

	it('retains enum values and native JSON responses', async () => {
		const result = await create.ObjectGenerator({
			model: mock({ content: [text('{"result":"yes"}')] }), prompt: 'question', output: 'enum', enum: ['yes', 'no'],
		})();
		assert.equal(result.value, 'yes');
		assert.equal(await result.toJsonResponse().json(), result.value);
	});

	it('returns an object stream immediately and forwards native validation failures through value', async () => {
		const result = create.ObjectStreamer({
			model: mock({ content: [text('{"n":"invalid"}')] }), prompt: 'question', schema: z.object({ n: z.number() }),
		})();
		assert.equal(result.value, result.value);
		assert.equal(result.value, result.object);
		await collect(result.fullStream);
		const error = await result.object.catch((error: unknown) => error);
		await assert.rejects(result.value, caught => caught === error);
	});

	it('rejects array value when the completed array fails validation', async () => {
		const result = create.ObjectStreamer({
			model: mock({ content: [text('{"elements":[1,"invalid"]}')] }), prompt: 'question', output: 'array', schema: z.number(),
		})();
		await collect(result.fullStream);
		await assert.rejects(result.value);
		await assert.rejects(result.object);
	});
});
