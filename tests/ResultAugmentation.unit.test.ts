import { runtimeRun } from './fixtures/runtime-call.js';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { inspect, promisify } from 'node:util';
import { createAgentUIStream, generateText, hasToolCall, isStepCount, NoObjectGeneratedError, NoOutputGeneratedError, Output, streamText, tool, ToolLoopAgent } from 'ai';
import type { ModelMessage, OutputInterface, StopCondition, ToolExecutionOptions, ToolSet } from 'ai';
import type { LanguageModelV3GenerateResult, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { z } from 'zod';
import { generateTextWithResult as generatePrepared, generateToolOutput, streamTextWithResult as streamPrepared } from '../src/runtime/augment-result.js';
import { create } from './cascada';
import { mcpApprovalReplay } from './fixtures/openai-mcp.js';

// Protocol tests start at the normalized internal boundary. Public entry-point ownership is tested below.
function conversation(content: string): ModelMessage[] { return [{ role: 'user', content }]; }
function generateTextWithResult<T extends ToolSet, C extends Record<string, unknown> = Record<string, unknown>, O extends OutputInterface | undefined = undefined>(
	request: Parameters<typeof generatePrepared<T, C, O>>[0], history: ModelMessage[] = request.messages,
) { return generatePrepared(request, history); }
function streamTextWithResult<T extends ToolSet, C extends Record<string, unknown> = Record<string, unknown>, O extends OutputInterface | undefined = undefined>(
	request: Parameters<typeof streamPrepared<T, C, O>>[0], history: ModelMessage[] = request.messages,
) { return streamPrepared(request, history); }

const usage = {
	inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 2, text: 2, reasoning: 0 },
};
type Step = Pick<LanguageModelV3GenerateResult, 'content'> & { reason?: LanguageModelV3GenerateResult['finishReason']['unified']; raw?: string };
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
		doGenerate: steps.map(step => ({ content: step.content, finishReason: { unified: step.reason ?? 'stop', raw: step.raw ?? step.reason ?? 'stop' }, usage, warnings: [] })),
		doStream: steps.map(step => ({ stream: convertArrayToReadableStream(chunks(step)) })),
	});
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = [];
	for await (const value of stream) values.push(value);
	return values;
}
describe('SDK result augmentation', () => {
	it('can copy, serialize and inspect a paused generation without reading final output', async () => {
		const result = await generateTextWithResult({
			model: mock({ content: [call()], reason: 'tool-calls' }), messages: conversation('question'),
			tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }) }) },
		});
		assert.throws(() => result.output, NoOutputGeneratedError);
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
				const result = await create.LLMAgent.asStream({
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
		const agent = create.LLMAgent({ model, tools, id: 'fixture' });
		const generated = await agent.generate({ messages: conversation('literal {{ source }}') });
		assert.equal(generated.output, 'one');
		assert.deepEqual(generated.messageHistory[0], { role: 'user', content: 'literal {{ source }}' });
		const ui = await createAgentUIStream({ agent, uiMessages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'literal {{ next }}' }] }] });
		const events = await collect(ui);
		assert.ok(events.some(part => part.type === 'text-delta' && part.delta === 'one'));
		assert.equal(model.doGenerateCalls.length, 1);
		assert.equal(model.doStreamCalls.length, 1);
	});

	for (const execution of ['generate', 'stream'] as const) {
		for (const messagesField of ['messages', 'prompt'] as const) {
			it(`${execution} snapshots a literal ${messagesField} conversation for execution and history`, async () => {
				const model = mock({ content: [text('answer')] });
				const messages: ModelMessage[] = [{ role: 'user', content: 'original' }];
				const settings = messagesField === 'messages' ? { messages } : { prompt: messages };
				const agent = create.LLMAgent({ model });
				const pending = execution === 'generate' ? agent.generate(settings) : agent.stream(settings);
				assert.equal(settings[messagesField], messages);
				messages.push({ role: 'user', content: 'late' });
				const result = await pending;
				await result.output;
				const request = execution === 'generate' ? model.doGenerateCalls[0] : model.doStreamCalls[0];
				assert.deepEqual(request.prompt.map(message => message.content), [[{ type: 'text', text: 'original' }]]);
				assert.deepEqual(await result.messageHistory, [{ role: 'user', content: 'original' }, ...await result.responseMessages]);
			});
		}
	}

	for (const aliases of [false, true]) {
		it(`preserves native callback receivers with ${aliases ? 'deprecated' : 'canonical'} names`, async () => {
			for (const augmented of [false, true]) {
				const receivers: { step: unknown[], call: unknown[], chunk: unknown[] } = { step: [], call: [], chunk: [] };
				const observer = (kind: keyof typeof receivers) => function (this: unknown) { receivers[kind].push(this); };
				const settings = { model: mock({ content: [text('answer')] }), onChunk: observer('chunk'), onLanguageModelCallStart: observer('call') };
				const call = { messages: conversation('test'),
					...(aliases ? { experimental_onStepStart: observer('step') } : { onStepStart: observer('step') }) };
				const result = augmented ? await create.LLMAgent(settings).stream(call) : streamText({ ...settings, ...call });
				await result.consumeStream();
				assert.equal(receivers.step.length, 1);
				assert.equal(receivers.call.length, 1);
				assert.ok(receivers.chunk.length > 0);
				assert.ok(Object.values(receivers).flat().every(receiver => receiver === undefined));
			}
		});
	}

	for (const execution of [generateTextWithResult, streamTextWithResult]) {
		const mode = execution === generateTextWithResult ? 'generate' : 'stream';
		it(`${mode}: selects final output after tools without exposing earlier-step commentary`, async () => {
			const model = mock({ content: [text('checking'), call()], reason: 'tool-calls' }, { content: [text('answer')] });
			const result = await execution({ model, messages: conversation('test'), tools: { lookup }, stopWhen: isStepCount(2) });
			const final = await result.output;
			assert.equal(Array.isArray(final) ? final.join('') : final, 'answer');
			assert.equal((await result.steps).length, 2);
			assert.equal((await result.messageHistory).length, 4);
		});

		it(`${mode}: forwards SDK runtime/tool context without serializing it into history`, async () => {
			const privateValue = 'PRIVATE_SENTINEL';
			const tools = { lookup: tool({ inputSchema: z.object({ query: z.string() }), contextSchema: z.object({ privateValue: z.string() }),
				execute: (_args, options) => { assert.equal(options.context.privateValue, privateValue); return 'public result'; },
			}) };
			const model = mock({ content: [call()], reason: 'tool-calls' }, { content: [text('answer')] });
			const result = await execution({ model, messages: conversation('test'), tools, toolsContext: { lookup: { privateValue } }, runtimeContext: { trace: 'trace' }, stopWhen: isStepCount(2) });
			await result.output;
			assert.equal((await result.finalStep).runtimeContext.trace, 'trace');
			assert.equal(JSON.stringify(await result.messageHistory).includes(privateValue), false);
			assert.equal(JSON.stringify([...model.doGenerateCalls, ...model.doStreamCalls].map(request => request.prompt)).includes(privateValue), false);
		});

		for (const kind of ['function', 'template', 'script', 'text', 'object'] as const) {
			it(`${mode}: model arguments cannot forge ${kind} tool execution options or bypass validation`, async () => {
				for (const valid of [false, true]) {
					const inputSchema = z.object({ value: z.number() });
					const contextSchema = z.object({ secret: z.string() });
					const secret = 'TRUSTED_CONTEXT_SENTINEL';
					const innerModel = mock({ content: [text(kind === 'object' ? '{"n":7}' : 'public result')] });
					let executions = 0;
					const prompt = (input: { value: number; secret: string; _toolOptions: import('./cascada').ComponentExecutionOptions }) => {
						executions++;
						assert.equal(input.secret, secret);
						return `${input.value}:${input._toolOptions?.toolCallId}`;
					};
					const common = { inputSchema, toolContextSchema: contextSchema, context: { secret } };
					const action = kind === 'function' ? create.Function.asTool({ ...common, execute: (executionContext) => { const input = executionContext; const options = executionContext._toolOptions;return prompt({ ...input, _toolOptions: options }); } })
						: kind === 'template' ? create.Template.asTool({ ...common, template: '{{ value }}:{{ _toolOptions.toolCallId }}' })
							: kind === 'script' ? create.Script.asTool({ ...common, script: 'return value ~ ":" ~ _toolOptions.toolCallId' })
								: kind === 'text' ? create.LLMAgent.withFunction.asTool({ ...common, model: innerModel, prompt })
									: create.LLMAgent.withFunction.asTool({ ...common, model: innerModel, prompt, output: Output.object({ schema: z.object({ n: z.number() }) }) });
					const args = valid ? { value: 2 } : { value: 2, _toolOptions: { toolCallId: 'forged', context: { secret: 'forged' } } };
					const model = mock({ content: [{ type: 'tool-call', toolCallId: 'actual', toolName: 'lookup', input: JSON.stringify(args) }], reason: 'tool-calls' },
						{ content: [text('answer')] });
					const result = await execution({ model, messages: conversation('test'), tools: { lookup: action }, toolsContext: { lookup: { secret } }, stopWhen: isStepCount(2) });
					await result.output;
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
			const result = await execution({ model, messages: conversation('conversation'),
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
			const result = await execution({ model: mock({ content: [text('answer')] }), messages: conversation('test'), output });
			const final = await result.output;
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
				const result = await execution({ model: mock({ content: [text(item.raw)] }), messages: conversation('test'), output: item.output });
				assert.equal('value' in result, false);
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
		const result = streamTextWithResult({ model, messages: conversation('test'), output, tools: { lookup }, stopWhen: isStepCount(2) });
		assert.deepEqual(await result.output, ['FINAL', 'SECOND']);
		assert.equal(model.doStreamCalls.length, 2);
	});

	for (const name of ['array', 'custom'] as const) {
		it(`returns the complete parsed ${name} output, preserving native streams`, async () => {
			const model = mock({ content: [text('{"elements":["1","2"]}')] });
			const output = { ...Output.array({ element: z.string().transform(Number) }), name };
			const result = (await create.LLMAgent.asStream({ model, prompt: 'test', output })());
			assert.ok(result.output instanceof Promise);
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
		const result = (await create.LLMAgent.asStream({ model, output })('test'));
		assert.deepEqual([...await result.output], [1, 2]);
		assert.deepEqual([...await result.output], []);
		assert.equal(await result.output, parsed);
		assert.equal(parses, 1);
		assert.equal(model.doStreamCalls.length, 1);
	});

	it('reuses the completed array and preserves its native iterators', async () => {
		const output = { ...Output.array({ element: z.number() }), name: 'array' as const };
		const model = mock({ content: [text('{"elements":[1,2]}')] });
		const result = (await create.LLMAgent.asStream({ model, output })('test'));
		const first = (await result.output)[Symbol.iterator]();
		assert.deepEqual(first.next(), { value: 1, done: false });
		assert.equal('value' in result, false);
		assert.deepEqual(await result.output, [1, 2]);
		assert.equal(model.doStreamCalls.length, 1);
	});

	it('does not reinterpret a custom parser based on its output name', async () => {
		const parsed = { n: 1 };
		const output = { ...Output.text(), name: 'array' as const, parseCompleteOutput: async () => parsed };
		const result = (await create.LLMAgent.asStream({ model: mock({ content: [text('answer')] }), output })('test'));
		assert.equal(await result.output, parsed);
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
			const result = (await create.LLMAgent.asStream({ model: mock({ content: [text('{"elements":[1]}')] }), output })('test'));
			assert.equal(await result.output, parsed);
			assert.equal(closed, 0);
			const reader = Symbol.asyncIterator in parsed ? parsed[Symbol.asyncIterator]!() : parsed[Symbol.iterator]();
			assert.equal((await reader.next()).value, element);
			await reader.return();
			assert.equal(closed, 1);
			assert.equal(await result.output, parsed);
			assert.equal(parses, 1);
		});
	}

	it('retains structured values from a custom text parser without parsing again', async () => {
		let parses = 0;
		const output = { ...Output.text(), parseCompleteOutput: async ({ text }: { text: string }) => { parses++; return { answer: text }; } };
		const result = (await create.LLMAgent.asStream({ model: mock({ content: [text('answer')] }), prompt: 'test', output })());
		assert.deepEqual(await result.output, { answer: 'answer' });
		assert.equal(parses, 1);
	});

	it('keeps preliminary tool results out of the completed exchange', async () => {
		const model = mock({ content: [call()], reason: 'tool-calls' }, { content: [text('answer')] });
		const result = streamTextWithResult({ model, messages: conversation('test'), stopWhen: isStepCount(2), tools: {
			lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: async function* () { yield 'partial'; yield 'done'; } }),
		} });
		const events = await collect(result.stream);
		assert.ok(events.some(part => part.type === 'tool-result' && part.preliminary && part.output === 'partial'));
		assert.deepEqual(await result.output, 'answer');
		assert.equal(JSON.stringify(await result.messageHistory).includes('partial'), false);
	});

	it('keeps history when final output parsing fails after a completed exchange', async () => {
		const output = Output.object({ schema: z.object({ n: z.number() }).refine(() => false) });
		const result = streamTextWithResult({ model: mock({ content: [text('{"n":3}')] }), messages: conversation('test'), output });
		await assert.rejects(async () => result.output);
		assert.equal((await result.messageHistory).length, 2);
		await assert.rejects(generateTextWithResult({ model: mock({ content: [text('{"n":3}')] }), messages: conversation('test'), output }));
	});

	for (const [kind, output] of [['object', Output.object({ schema: z.object({ n: z.number() }) })],
		['array', Output.array({ element: z.number() })]] as const) {
		for (const reason of ['stop', 'length', 'content-filter', 'other'] as const) {
			for (const executable of [false, true]) {
				it(`preserves native eager ${kind} parsing with ${reason} and a ${executable ? 'local' : 'client'} tool`, async () => {
					const settings = () => {
						const state = { executions: 0, messages: [] as ModelMessage[] };
						return { state, request: {
							model: mock({ content: [text('Let me check.'), call()], reason }), messages: conversation('test'), output,
							tools: { lookup: executable
								? tool({ inputSchema: z.object({ query: z.string() }), execute: () => { state.executions++; return 'done'; } })
								: tool({ inputSchema: z.object({ query: z.string() }) }),
							},
							onEnd: ({ responseMessages }: { responseMessages: ModelMessage[] }) => { state.messages = responseMessages; },
						} };
					};
					for (const generate of [generateText, generateTextWithResult]) {
						const { request, state } = settings();
						await assert.rejects(generate === generateText ? generateText(request) : generateTextWithResult(request), NoObjectGeneratedError);
						assert.equal(state.executions, executable && reason === 'stop' ? 1 : 0);
						assert.equal(state.messages.length, executable && reason === 'stop' ? 2 : 1);
						assert.equal(request.model.doGenerateCalls.length, 1);
					}
					const { request, state } = settings();
					const result = streamTextWithResult(request);
					await assert.rejects(async () => result.output, NoObjectGeneratedError);
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
		const result = streamTextWithResult({ model: mock({ content: [text('{"elements":["one"]}')] }), messages: conversation('test'),
			output: Output.array({ element: z.string(), minItems: 2 }),
		});
		await assert.rejects(async () => result.output);
		assert.equal((await result.messageHistory).length, 2);
	});

	it('does not create a final-output parsing pass just to add properties or read history', async () => {
		let parses = 0;
		const output = { ...Output.text(), parseCompleteOutput: async ({ text }: { text: string }) => { parses++; return text; } };
		const result = streamTextWithResult({ model: mock({ content: [text('answer')] }), messages: conversation('test'), output });
		assert.equal(parses, 0);
		await result.messageHistory;
		assert.equal(parses, 0);
		assert.equal(await result.output, 'answer');
		assert.equal(parses, 1);
	});

	it('preserves a thrown SDK transform failure after native-only consumption', async () => {
		const error = new Error('transform failed');
		const result = streamTextWithResult({ model: mock({ content: [text('answer')] }), messages: conversation('test'),
			experimental_transform: () => new TransformStream({ transform() { throw error; } }),
		});
		await assert.rejects(async () => result.output, reason => reason === error);
		await assert.rejects(async () => result.responseMessages, reason => reason === error);
		await assert.rejects(result.messageHistory, reason => reason === error);
	});

	it('characterizes native Agent error loss when the provider fails before returning a stream', async () => {
		const error = new Error('provider connection failed');
		const model = new MockLanguageModelV3({ doGenerate: async () => { throw error; }, doStream: async () => { throw error; } });
		const agent = new ToolLoopAgent({ model, maxRetries: 0 });
		await assert.rejects(agent.generate({ messages: conversation('test') }), reason => reason === error);
		const logged: unknown[] = [];
		const original = console.error;
		console.error = error => { logged.push(error); };
		try {
			const result = await agent.stream({ messages: conversation('test') });
			await assert.rejects(async () => result.output, reason => NoOutputGeneratedError.isInstance(reason) && reason.cause === undefined);
			await assert.rejects(async () => result.responseMessages, reason => reason === error);
		} finally { console.error = original; }
		assert.deepEqual(logged, [error]);
		assert.equal(model.doGenerateCalls.length, 1);
		assert.equal(model.doStreamCalls.length, 1);
	});

	it('preserves a generation continuation failure instead of manufacturing a result', async () => {
		const error = new Error('continuation failed');
		let calls = 0;
		const model = new MockLanguageModelV3({ doGenerate: async () => {
			if (calls++ > 0) throw error;
			return { content: [text('earlier'), call()], finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage, warnings: [] };
		} });
		await assert.rejects(generateTextWithResult({ model, messages: conversation('test'), tools: { lookup }, stopWhen: isStepCount(2), maxRetries: 0 }), reason => reason === error);
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
		await assert.rejects(generateTextWithResult({ model, messages: conversation('test'), abortSignal: controller.signal }), reason => reason === error);
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
				const request = { model, messages: conversation('test'), abortSignal: controller.signal, tools: {
					lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: async (_input, options) => {
						started();
						await wait;
						if (cooperative) options.abortSignal?.throwIfAborted();
						return 'done';
					} }),
				}, stopWhen: isStepCount(1) };
				const pending = mode === 'sdk' ? generateText(request) : mode === 'agent'
					? new ToolLoopAgent({ model, tools: request.tools, stopWhen: request.stopWhen }).generate({ messages: conversation('test'), abortSignal: controller.signal })
					: generateTextWithResult(request);
				await ready;
				controller.abort(reason);
				release();
				const result = await pending;
				assert.equal(result.finishReason, 'tool-calls');
				assert.equal(result.steps[0].content.some(part => part.type === (cooperative ? 'tool-error' : 'tool-result')), true);
				if ('value' in result) assert.throws(() => result.output, NoOutputGeneratedError);
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
				const execute: (request: Parameters<typeof streamTextWithResult>[0]) => ReturnType<typeof streamText> = augmented ? streamTextWithResult : streamText;
				const result = execute({ model, messages: conversation('test'), abortSignal: controller.signal, tools: {
					lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: async (_input, options) => {
						started();
						await wait;
						if (cooperative) options.abortSignal?.throwIfAborted();
						return 'done';
					} }),
				} });
				const failedSteps = assert.rejects(async () => result.steps, error => error === reason);
				const failedOutput = assert.rejects(async () => result.output, error => error === reason);
				await ready;
				controller.abort(reason);
				release();
				await failedSteps;
				await failedOutput;
				await assert.rejects(async () => result.responseMessages, error => error === reason);
				if ('messageHistory' in result) await assert.rejects(async () => result.messageHistory, error => error === reason);
				assert.equal(model.doStreamCalls.length, 1);
			}
		});
	}

	it('forwards the complete timeout configuration to the SDK without mutation', async () => {
		const configured = Object.freeze({ totalMs: 500, stepMs: 300, toolMs: 200 });
		for (const execute of [generateTextWithResult, streamTextWithResult]) {
			let timeout: unknown;
			const result = await execute({ model: mock({ content: [text('answer')] }), messages: conversation('test'), timeout: configured,
				onStart: event => { timeout = event.timeout; },
			});
			await result.output;
			assert.equal(timeout, configured);
			assert.deepEqual(configured, { totalMs: 500, stepMs: 300, toolMs: 200 });
		}
	});

});
describe('Public generator and streamer augmentation', () => {
	for (const streaming of [false, true]) {
		for (const renderer of ['text', 'template', 'script', 'function', 'loaded-text', 'loaded-template', 'loaded-script']) {
			it(`${streaming ? 'streamer' : 'generator'}: ${renderer} returns native output and dynamic history from one execution`, async () => {
				const model = mock({ content: [text('answer')] });
				const config = { model, instructions: 'Static instruction.' };
				const input = { ...config, context: { input: 'question' } };
				const textConfig = { ...config, prompt: 'question' };
				const templateConfig = { ...input, prompt: '{{ input }}' };
				const scriptConfig = { ...input, prompt: 'return input' };
				const functionConfig = { ...config, prompt: () => 'question' };
				const loadedText = { ...config, prompt: 'source', loader: { load: () => 'question' } };
				const loadedTemplate = { ...input, prompt: 'source', loader: { load: () => '{{ input }}' } };
				const loadedScript = { ...input, prompt: 'source', loader: { load: () => 'return input' } };
				const component = renderer === 'text' ? streaming ? create.LLMAgent.asStream(textConfig) : create.LLMAgent(textConfig)
					: renderer === 'template' ? streaming ? create.LLMAgent.withTemplate.asStream(templateConfig) : create.LLMAgent.withTemplate(templateConfig)
						: renderer === 'script' ? streaming ? create.LLMAgent.withScript.asStream(scriptConfig) : create.LLMAgent.withScript(scriptConfig)
							: renderer === 'function' ? streaming ? create.LLMAgent.withFunction.asStream(functionConfig) : create.LLMAgent.withFunction(functionConfig)
								: renderer === 'loaded-text' ? streaming ? create.LLMAgent.loadsText.asStream(loadedText) : create.LLMAgent.loadsText(loadedText)
									: renderer === 'loaded-template' ? streaming ? create.LLMAgent.loadsTemplate.asStream(loadedTemplate) : create.LLMAgent.loadsTemplate(loadedTemplate)
										: streaming ? create.LLMAgent.loadsScript.asStream(loadedScript) : create.LLMAgent.loadsScript(loadedScript);
				const history: ModelMessage[] = [{ role: 'assistant', content: 'Earlier answer.' }];
				const result = await runtimeRun(component, { messageHistory: history });
				assert.deepEqual(await result.output, 'answer');
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
			const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
			const result = await component();
			assert.deepEqual(await result.output, { n: 3 });
			assert.equal(parses, 1);
		});
	}
});

describe('Result augmentation in tools and templates', () => {
	for (const [name, factory, object] of [
		['generate', create.LLMAgent, false], ['generate-structured', create.LLMAgent, true],
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
				// This runtime matrix intentionally erases the different factory signatures.
				const factoryValue: unknown = factory[modifier].asTool;
				const build = factoryValue as (config: object) => {
					execute(args: typeof input, options: ToolExecutionOptions<undefined>): PromiseLike<unknown>;
				};
				const nested = build({ model, inputSchema: z.object({ query: z.string() }),
					prompt: modifier === 'withFunction' ? ({ query }: typeof input) => query : modifier.startsWith('loads') ? 'source' : source,
					...(object && { output: Output.object({ schema: z.object({ n: z.number() }) }) }),
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
			const nested = create.LLMAgent.withFunction.asTool({ model, inputSchema: z.object({ query: z.string() }),
				prompt: ({ query }) => query, tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }) }) },
			});
			const direct = await nested({ query: 'test' });
			assert.equal('value' in direct, false);
			const outerModel = mock({ content: [call()], reason: 'tool-calls' }, { content: [text('Outer answer.')] });
			const outer = await generateTextWithResult({ model: outerModel, messages: conversation('test'), tools: { lookup: nested }, stopWhen: isStepCount(2) });
			const failure = outer.steps[0].content.find(part => part.type === 'tool-error');
			assert.ok(failure?.type === 'tool-error');
			assert.ok(NoOutputGeneratedError.isInstance(failure.error));
			const sent = outerModel.doGenerateCalls[1].prompt.find(message => message.role === 'tool');
			assert.ok(sent?.role === 'tool');
			assert.equal(sent.content[0].type, 'tool-result');
			assert.equal(sent.content[0].output.type, 'error-text');
			assert.equal(outer.output, 'Outer answer.');
			assert.equal(model.doGenerateCalls.length, 2);
		});
	}

	it('reports a nested approval pause as an outer tool error without forwarding inner history', async () => {
		const innerMessages: ModelMessage[] = [];
		let executions = 0;
		const nested = create.LLMAgent.asTool({ model: mock({ content: [call()], reason: 'tool-calls' }),
			prompt: 'test', inputSchema: z.object({ query: z.string() }),
			tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }), needsApproval: true,
				execute: () => { executions++; return 'done'; } }) },
			onEnd: event => { innerMessages.push(...event.responseMessages); },
		});
		const outer = await generateTextWithResult({ model: mock({ content: [call()], reason: 'tool-calls' }, { content: [text('answer')] }),
			messages: conversation('test'), tools: { lookup: nested }, stopWhen: isStepCount(2),
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
		const nested = create.LLMAgent.withFunction.asTool({ model, inputSchema: z.object({ query: z.string() }),
			prompt: ({ query }) => query,
			output: Output.object({ schema: z.object({ n: z.string().transform(value => { parses++; return Number(value); }) }) }),
		});
		assert.deepEqual((await nested({ query: 'test' })).output, { n: 7 });
		const result: { n: number } = await nested.execute({ query: 'test' }, { toolCallId: 'outer', messages: [], context: undefined });
		assert.deepEqual(result, { n: 7 });
		const outerModel = mock({ content: [call()], reason: 'tool-calls' }, { content: [text('answer')] });
		const outer = await generateTextWithResult({ model: outerModel, messages: conversation('test'), tools: { lookup: nested }, stopWhen: isStepCount(2) });
		assert.deepEqual(outer.steps[0].toolResults[0].output, { n: 7 });
		const sent = outerModel.doGenerateCalls[1].prompt.find(message => message.role === 'tool');
		assert.ok(sent?.role === 'tool');
		assert.equal(sent.content[0].type, 'tool-result');
		assert.deepEqual(sent.content[0].output, { type: 'json', value: { n: 7 } });
		assert.equal(parses, 3);
		assert.equal(model.doGenerateCalls.length, 3);
	});

});
describe('LLMAgent tool completion boundary', () => {
	const options = { toolCallId: 'outer', messages: [], context: undefined };
	it('native generation consults stop conditions only when another step is eligible', async () => {
		// SDK-only canary for the tool adapter's cutoff observation; a final step
		// count alone cannot distinguish a cutoff from natural completion.
		for (const withTool of [false, true]) {
			let checks = 0;
			const model = mock({ content: [text('answer'), ...withTool ? [call()] : []] });
			const result = await generateText({ model, prompt: 'question', tools: { lookup },
				stopWhen: ({ steps }) => { checks++; assert.equal(steps.length, 1); return true; },
			});
			assert.equal(result.output, 'answer');
			assert.equal(result.steps.length, 1);
			assert.equal(checks, Number(withTool));
			assert.equal(result.toolResults.length, Number(withTool));
		}
		const model = mock({ content: [call(), text('draft')] }, { content: [text('answer')] });
		const result = await generateText({ model, prompt: 'question', tools: { lookup } });
		assert.equal(model.doGenerateCalls.length, 1);
		assert.equal(result.output, 'draft'); // Native default is still one model step.
	});
	for (const kind of ['default', 'limit', 'predicate', 'array', 'terminal'] as const) {
		it(`rejects a ${kind} stop-condition cutoff even with schema-valid output and settled calls`, async () => {
			let checks = 0, executions = 0, parses = 0;
			const condition: StopCondition<ToolSet> = async () => { checks++; return true; };
			const stopWhen = kind === 'default' ? undefined : kind === 'limit' ? isStepCount(2)
				: kind === 'terminal' ? hasToolCall('lookup') : kind === 'array' ? [condition, () => false] : condition;
			const model = mock({ content: [text('{"answer":"draft"}'), call()] }, { content: [text('{"answer":"draft"}'), call()] });
			const nested = create.LLMAgent.asTool({ model, prompt: 'question', inputSchema: z.object({}), stopWhen,
				output: Output.object({ schema: z.object({ answer: z.string() }).transform(value => { parses++; return value; }) }),
				tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: () => { executions++; return 'done'; } }) },
			});
			await assert.rejects(async () => nested.execute({}, options), error => NoOutputGeneratedError.isInstance(error) && error.message.includes('stop condition'));
			assert.equal(model.doGenerateCalls.length, kind === 'limit' ? 2 : 1);
			assert.equal(executions, kind === 'limit' ? 2 : 1);
			assert.equal(parses, 1);
			assert.equal(checks, kind === 'predicate' || kind === 'array' ? 1 : 0);
		});
	}
	for (const withTool of [false, true]) it(`accepts natural completion on the last allowed step, earlier tool=${withTool}`, async () => {
		let checks = 0;
		const limit = isStepCount(withTool ? 2 : 1);
		const model = mock(...withTool ? [{ content: [call()], reason: 'tool-calls' as const }, { content: [text('answer')] }] : [{ content: [text('answer')] }]);
		const nested = create.LLMAgent.asTool({ model, tools: { lookup }, prompt: 'question', inputSchema: z.object({}),
			stopWhen: async input => { checks++; return limit(input); },
		});
		assert.equal(await nested.execute({}, options), 'answer');
		assert.equal(checks, Number(withTool));
		assert.equal(model.doGenerateCalls.length, withTool ? 2 : 1);
	});
	it('observes native concurrent stop predicates once and does not overwrite a true decision with false', async () => {
		let release!: () => void;
		const started = new Promise<void>(resolve => { release = resolve; });
		const calls: string[] = [];
		const nested = create.LLMAgent.asTool({ model: mock({ content: [call(), text('draft')] }), tools: { lookup },
			prompt: 'question', inputSchema: z.object({}), stopWhen: [
				async () => { calls.push('first'); await started; return false; },
				() => { calls.push('second'); release(); return true; },
			],
		});
		await assert.rejects(async () => nested.execute({}, options), /stop condition/);
		assert.deepEqual(calls, ['first', 'second']);
	});
	for (const cutoff of [false, true]) it(`uses the hook-selected stop condition, cutoff=${cutoff}`, async () => {
		let configuredChecks = 0, selectedChecks = 0;
		const model = mock({ content: [call(), text('draft')] }, { content: [text('answer')] });
		const nested = create.LLMAgent.asTool({ model, tools: { lookup }, prompt: 'question', inputSchema: z.object({}),
			stopWhen: () => { configuredChecks++; return true; },
			prepareCall: request => ({ ...request, stopWhen: () => { selectedChecks++; return cutoff; } }),
		});
		if (cutoff) await assert.rejects(async () => nested.execute({}, options), /stop condition/);
		else assert.equal(await nested.execute({}, options), 'answer');
		assert.equal(configuredChecks, 0);
		assert.equal(selectedChecks, 1);
		assert.equal(model.doGenerateCalls.length, cutoff ? 1 : 2);
	});
	for (const native of [false, true]) for (const asynchronous of [false, true]) it(`preserves stop predicate failure timing, native=${native}, asynchronous=${asynchronous}`, async () => {
		const error = new Error('stop predicate failed');
		let laterCalls = 0;
		const config = { model: mock({ content: [call(), text('draft')] }), tools: { lookup }, prompt: 'question',
			stopWhen: [asynchronous ? async () => { throw error; } : () => { throw error; },
				() => { laterCalls++; return false; }] };
		await assert.rejects(async () => native ? generateText(config) : create.LLMAgent.asTool({ ...config, inputSchema: z.object({}) }).execute({}, options), reason => reason === error);
		assert.equal(laterCalls, Number(asynchronous));
	});
	for (const omitted of [false, true]) it(`uses the native default when the call hook clears stopWhen, omitted=${omitted}`, async () => {
		let configuredChecks = 0;
		const nested = create.LLMAgent.asTool({ model: mock({ content: [call(), text('draft')] }), tools: { lookup }, prompt: 'question', inputSchema: z.object({}),
			stopWhen: () => { configuredChecks++; return false; },
			prepareCall: ({ stopWhen: _stopWhen, ...request }) => omitted ? request : { ...request, stopWhen: undefined },
		});
		await assert.rejects(async () => nested.execute({}, options), /stop condition/);
		assert.equal(configuredChecks, 0);
	});
	it('keeps cutoff state local to concurrent tool invocations', async () => {
		const model = new MockLanguageModelV3({ doGenerate: async ({ prompt }) => ({
			content: prompt.some(message => message.role === 'tool') ? [text('answer')] : [call(), text('draft')],
			finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [],
		}) });
		const nested = create.LLMAgent.asTool({ model, tools: { lookup }, prompt: 'question', inputSchema: z.object({ cutoff: z.boolean() }),
			prepareCall: (request, _config, context) => ({ ...request, stopWhen: () => context.cutoff }),
		});
		const [cutoff, complete] = await Promise.allSettled([nested.execute({ cutoff: true }, options), nested.execute({ cutoff: false }, options)]);
		assert.ok(cutoff.status === 'rejected' && NoOutputGeneratedError.isInstance(cutoff.reason) && cutoff.reason.message.includes('stop condition'));
		assert.deepEqual(complete, { status: 'fulfilled', value: 'answer' });
		assert.equal(model.doGenerateCalls.length, 3);
	});
	for (const injected of [false, true]) it(`delivers a cutoff as a tool failure to its caller, injected=${injected}`, async () => {
		const innerModel = mock({ content: [call(), text('draft')] });
		const nested = create.LLMAgent.asTool({ model: innerModel, tools: { lookup }, prompt: 'question', inputSchema: z.object({}) });
		if (injected) {
			const owner = create.Function({ tools: { nested }, execute: ({ nested }) => nested({}) });
			await assert.rejects(owner(), /stop condition/);
		} else {
			const outerModel = mock({ content: [{ type: 'tool-call', toolCallId: 'outer', toolName: 'nested', input: '{}' }], reason: 'tool-calls' }, { content: [text('handled')] });
			const result = await generateText({ model: outerModel, prompt: 'question', tools: { nested }, stopWhen: isStepCount(2) });
			assert.equal(result.output, 'handled');
			assert.ok(result.steps[0].content.some(part => part.type === 'tool-error' && NoOutputGeneratedError.isInstance(part.error) && part.error.message.includes('stop condition')));
		}
		assert.equal(innerModel.doGenerateCalls.length, 1);
		assert.equal('resume' in nested, false);
	});
	for (const entry of ['ordinary', 'run', 'generate', 'stream'] as const) it(`keeps native cutoff results on the ${entry} entry path`, async () => {
		const model = mock({ content: [call(), text('draft')] });
		const config = { model, tools: { lookup }, prompt: 'question', inputSchema: z.object({}) };
		const result = entry === 'ordinary' ? await create.LLMAgent.asTool(config)()
			: entry === 'run' ? await create.LLMAgent.asTool(config).run({})
				: entry === 'generate' ? await create.LLMAgent(config).generate({ messages: conversation('question') })
					: await create.LLMAgent(config).stream({ messages: conversation('question') });
		assert.equal(await result.output, 'draft');
		assert.equal((await result.steps).length, 1);
	});
	it('awaits a native async approval policy and all inner steps as one tool invocation', async () => {
		let enter!: () => void;
		let decide!: (value: 'approved') => void;
		const entered = new Promise<void>(resolve => { enter = resolve; });
		const decision = new Promise<'approved'>(resolve => { decide = resolve; });
		let executions = 0;
		const model = mock({ content: [call()], reason: 'tool-calls' }, { content: [text('answer')] });
		const nested = create.LLMAgent.asTool({ model, prompt: 'question', inputSchema: z.object({}), stopWhen: isStepCount(2),
			tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: () => { executions++; return 'done'; } }) },
			toolApproval: async () => { enter(); return decision; },
		});
		const running = nested.execute({}, options);
		await entered;
		assert.equal(executions, 0);
		assert.equal(model.doGenerateCalls.length, 1);
		decide('approved');
		assert.equal(await running, 'answer');
		assert.equal(executions, 1);
		assert.equal(model.doGenerateCalls.length, 2);
	});
	for (const approved of [true, false]) for (const injected of [true, false]) {
		it(`settles a provider approval sent by a step hook, approved=${approved}, injected=${injected}`, async () => {
			const replay = mcpApprovalReplay({ complete: approved, bridge: true });
			let executions = 0;
			const nested = create.LLMAgent.asTool({ model: replay.model, prompt: 'Search.', inputSchema: z.object({}), maxRetries: 0, stopWhen: isStepCount(2),
				tools: { ...replay.tools, bridge: tool({ inputSchema: z.object({}), execute: () => { executions++; return 'next'; } }) },
				// Exercise a hook installed by prepareCall, after configuration resolution.
				prepareCall: request => ({ ...request, prepareStep: async ({ stepNumber, messages }) => stepNumber === 1
					? { messages: [...messages, { role: 'tool', content: [
						{ type: 'tool-approval-response', approvalId: 'mcpr_fixture', approved, providerExecuted: true },
					] }] } : undefined }),
			});
			const owner = create.Function({ tools: { nested }, execute: async ({ nested }) => nested({}) });
			assert.equal(await (injected ? owner() : nested.execute({}, options)), 'done');
			assert.equal(executions, 1);
			assert.equal(replay.requests.length, 2);
			assert.deepEqual(replay.requests[1].input.filter(part => part.type === 'mcp_approval_response'), [
				{ type: 'mcp_approval_response', approval_request_id: 'mcpr_fixture', approve: approved },
			]);
		});
	}
	it('captures the decision position before a hook edits its response-message copy', async () => {
		const replay = mcpApprovalReplay({ complete: true, bridge: true });
		const nested = create.LLMAgent.asTool({ model: replay.model, prompt: 'Search.', inputSchema: z.object({}), maxRetries: 0, stopWhen: isStepCount(2),
			tools: { ...replay.tools, bridge: tool({ inputSchema: z.object({}), execute: () => 'next' }) },
			prepareStep: ({ stepNumber, messages, responseMessages }) => {
				if (stepNumber !== 1) return;
				assert.ok(responseMessages.length > 0);
				responseMessages.length = 0;
				return { messages: [...messages, { role: 'tool', content: [
					{ type: 'tool-approval-response', approvalId: 'mcpr_fixture', approved: true, providerExecuted: true },
				] }] };
			},
		});
		assert.equal(await nested.execute({}, options), 'done');
		assert.equal(replay.requests.length, 2);
		assert.deepEqual(replay.requests[1].input.filter(part => part.type === 'mcp_approval_response'), [
			{ type: 'mcp_approval_response', approval_request_id: 'mcpr_fixture', approve: true },
		]);
	});
	for (const decision of ['missing', 'unknown', 'local', 'provider'] as const) for (const deferred of [false, true]) {
		it(`hook approval completion respects ${decision} decisions and deferred=${deferred}`, async () => {
			const model = mock({ content: [call(true), { type: 'tool-approval-request', approvalId: 'approval', toolCallId: 'call' },
				{ type: 'tool-call', toolCallId: 'bridge', toolName: 'bridge', input: '{}' }], reason: 'tool-calls' }, { content: [text('answer')] });
			const nested = create.LLMAgent.asTool({ model, prompt: 'question', inputSchema: z.object({}), stopWhen: isStepCount(2), tools: {
				lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true, supportsDeferredResults: deferred,
					inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }),
				bridge: tool({ inputSchema: z.object({}), execute: () => 'next' }),
			}, prepareStep: ({ stepNumber, messages }) => stepNumber === 1 ? { messages: [...messages, { role: 'tool', content:
				decision === 'missing' ? [] : [{ type: 'tool-approval-response', approvalId: decision === 'unknown' ? 'other' : 'approval',
					approved: true, providerExecuted: decision !== 'local' }] }] } : undefined });
			if (decision === 'provider' && !deferred) assert.equal(await nested.execute({}, options), 'answer');
			else await assert.rejects(async () => nested.execute({}, options), /pending/);
			assert.equal(model.doGenerateCalls.length, 2);
		});
	}
	for (const early of [false, true]) it(`hook approvals cannot settle a later definition, supplied before first call=${early}`, async () => {
		const model = mock({ content: [call(true), { type: 'tool-approval-request', approvalId: 'approval', toolCallId: 'call' },
			{ type: 'tool-call', toolCallId: 'bridge', toolName: 'bridge', input: '{}' }], reason: 'tool-calls' },
		{ content: early ? [text('answer')] : [call(true), { type: 'tool-approval-request', approvalId: 'new-approval', toolCallId: 'call' }, text('answer')] });
		const nested = create.LLMAgent.asTool({ model, prompt: 'question', inputSchema: z.object({}), stopWhen: isStepCount(2), tools: {
			lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
				inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }),
			bridge: tool({ inputSchema: z.object({}), execute: () => 'next' }),
		}, prepareStep: ({ stepNumber, messages }) => stepNumber === (early ? 0 : 1) ? { messages: [...messages, { role: 'tool', content: [
			{ type: 'tool-approval-response', approvalId: 'approval', approved: true, providerExecuted: true },
		] }] } : undefined });
		await assert.rejects(async () => nested.execute({}, options), /pending/);
		assert.equal(model.doGenerateCalls.length, 2);
	});
	it('an old hook approval cannot settle a redefined call even when sent after the new request', async () => {
		const first: Step = { content: [call(true), { type: 'tool-approval-request', approvalId: 'old', toolCallId: 'call' },
			{ type: 'tool-call', toolCallId: 'bridge-1', toolName: 'bridge', input: '{}' }], reason: 'tool-calls' };
		const second: Step = { content: [call(true), { type: 'tool-approval-request', approvalId: 'new', toolCallId: 'call' },
			{ type: 'tool-call', toolCallId: 'bridge-2', toolName: 'bridge', input: '{}' }], reason: 'tool-calls' };
		for (const approvalId of ['old', 'new']) {
			const nested = create.LLMAgent.asTool({ model: mock(first, second, { content: [text('answer')] }), prompt: 'question', inputSchema: z.object({}),
				stopWhen: isStepCount(3), tools: {
					lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
						inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }),
					bridge: tool({ inputSchema: z.object({}), execute: () => 'next' }),
				}, prepareStep: ({ stepNumber, messages }) => stepNumber === 2 ? { messages: [...messages, { role: 'tool', content: [
					{ type: 'tool-approval-response', approvalId, approved: true, providerExecuted: true },
				] }] } : undefined });
			if (approvalId === 'new') assert.equal(await nested.execute({}, options), 'answer');
			else await assert.rejects(async () => nested.execute({}, options), /pending/);
		}
	});
	it('keeps hook decisions local to concurrent invocations of one tool', async () => {
		const first: Step = { content: [call(true), { type: 'tool-approval-request', approvalId: 'approval', toolCallId: 'call' },
			{ type: 'tool-call', toolCallId: 'bridge', toolName: 'bridge', input: '{}' }], reason: 'tool-calls' };
		const model = new MockLanguageModelV3({ doGenerate: async ({ prompt }) => ({
			content: prompt.some(message => message.role === 'tool') ? [text('answer')] : first.content,
			finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [],
		}) });
		const nested = create.LLMAgent.asTool({ model, prompt: 'question', inputSchema: z.object({ approve: z.boolean() }), stopWhen: isStepCount(2), tools: {
			lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
				inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }),
			bridge: tool({ inputSchema: z.object({}), execute: () => 'next' }),
		}, prepareStep: async ({ stepNumber, messages }, _config, context) => stepNumber === 1 && context.approve
			? { messages: [...messages, { role: 'tool', content: [{ type: 'tool-approval-response', approvalId: 'approval', approved: true, providerExecuted: true }] }] }
			: undefined });
		const [approved, waiting] = await Promise.allSettled([nested.execute({ approve: true }, options), nested.execute({ approve: false }, options)]);
		assert.deepEqual(approved, { status: 'fulfilled', value: 'answer' });
		assert.equal(waiting.status, 'rejected');
		assert.ok(waiting.status === 'rejected' && NoOutputGeneratedError.isInstance(waiting.reason));
		assert.equal(model.doGenerateCalls.length, 4);
	});
	for (const deferred of [false, true]) it(`hook settlement preserves native empty text output, deferred=${deferred}`, async () => {
		const nested = create.LLMAgent.asTool({ prompt: 'question', inputSchema: z.object({}), stopWhen: isStepCount(2), tools: {
			lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true, supportsDeferredResults: deferred,
				inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }),
			bridge: tool({ inputSchema: z.object({}), execute: () => 'next' }),
		}, model: mock({ content: [call(true), { type: 'tool-approval-request', approvalId: 'approval', toolCallId: 'call' },
			{ type: 'tool-call', toolCallId: 'bridge', toolName: 'bridge', input: '{}' }], reason: 'tool-calls' },
		{ content: deferred ? [{ type: 'tool-result', toolCallId: 'call', toolName: 'lookup', result: 'done' }] : [] }),
		prepareStep: ({ stepNumber, messages }) => stepNumber === 1 ? { messages: [...messages, { role: 'tool', content: [
			{ type: 'tool-approval-response', approvalId: 'approval', approved: true, providerExecuted: true },
		] }] } : undefined });
		assert.equal(await nested.execute({}, options), '');
	});
	it('preserves native failure when a step fails after the hook supplies approval', async () => {
		const error = new Error('step failed');
		const model = mock({ content: [call(true), { type: 'tool-approval-request', approvalId: 'approval', toolCallId: 'call' },
			{ type: 'tool-call', toolCallId: 'bridge', toolName: 'bridge', input: '{}' }, text('unfinished')], reason: 'stop' });
		const nested = create.LLMAgent.asTool({ model, prompt: 'question', inputSchema: z.object({}), stopWhen: isStepCount(2), tools: {
			lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
				inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }),
			bridge: tool({ inputSchema: z.object({}), execute: () => 'next' }),
		}, prepareStep: ({ stepNumber, messages }) => stepNumber === 1 ? {
			model: new MockLanguageModelV3({ doGenerate: () => { throw error; } }),
			messages: [...messages, { role: 'tool', content: [
				{ type: 'tool-approval-response', approvalId: 'approval', approved: true, providerExecuted: true },
			] }],
		} : undefined, maxRetries: 0 });
		await assert.rejects(async () => nested.execute({}, options), reason => reason === error);
	});
	for (const kind of ['local', 'provider', 'deferred'] as const) it(`a result cannot settle a later same-ID ${kind} call in this run`, async () => {
		const provider = kind !== 'local';
		const tools = { lookup: provider ? tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
			supportsDeferredResults: kind === 'deferred', inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }) : tool({ inputSchema: z.object({ query: z.string() }) }) };
		const nested = create.LLMAgent.asTool({ model: mock({ content: [
			call(true), { type: 'tool-result', toolCallId: 'call', toolName: 'lookup', result: 'old result' },
			{ type: 'tool-call', toolCallId: 'bridge', toolName: 'bridge', input: '{}' },
		], reason: 'tool-calls' }, { content: [call(provider), { type: 'tool-approval-request', approvalId: 'new-approval', toolCallId: 'call' }, text('answer')] }),
		prompt: 'question', tools: { ...tools, bridge: tool({ inputSchema: z.object({}), execute: () => 'next' }) }, inputSchema: z.object({}), stopWhen: isStepCount(2) });
		await assert.rejects(async () => nested.execute({}, options), /pending/);
	});
	it('a new non-deferred definition resets Casai wait without bypassing an SDK cutoff', async () => {
		const nested = create.LLMAgent.asTool({ model: mock({ content: [call(true)], reason: 'tool-calls' }, { content: [
			{ type: 'tool-call', toolCallId: 'call', toolName: 'completed', input: '{}', providerExecuted: true }, text('answer'),
		] }), prompt: 'question', inputSchema: z.object({}), stopWhen: isStepCount(2), tools: {
			lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true, supportsDeferredResults: true, inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }),
			completed: tool({ type: 'provider', id: 'fixture.completed', args: {}, isProviderExecuted: true, inputSchema: z.object({}), outputSchema: z.unknown() }),
		} });
		await assert.rejects(async () => nested.execute({}, options), /stop condition/);
	});
	it('the tool adapter accepts the SDK response type\'s string-content representation', async () => {
		const model = mock({ content: [text('answer')] });
		const result = await generateText({ model, prompt: 'question' });
		// Native generation emits arrays today; its public response type also permits text strings.
		result.response.messages[0].content = 'answer';
		assert.equal(generateToolOutput(result, undefined), 'answer');
		assert.equal(model.doGenerateCalls.length, 1);
	});
	it('the tool adapter keeps an unclassified response approval pending', async () => {
		const result = await generateText({ model: mock({ content: [text('answer')] }), prompt: 'question' });
		// Exercise the adapter's conservative fallback, not a claim that this
		// installed SDK emits approvals without their call definitions.
		result.response.messages[0].content = [{ type: 'tool-approval-request', approvalId: 'unknown', toolCallId: 'unknown' }];
		assert.throws(() => generateToolOutput(result, undefined, [{ responseMessageCount: 1, approvalIds: ['unknown'] }]), /pending/);
	});
	it('a template consumes native live text, including intermediate commentary, with one execution', async () => {
		const model = mock({ content: [text('checking'), call()], reason: 'tool-calls' }, { content: [text('answer')] });
		const writer = create.LLMAgent.asStream({ model, tools: { lookup }, stopWhen: isStepCount(2) });
		const render = create.Template({ context: { writer }, template: '{% for chunk in writer("question").textStream %}{{ chunk }}{% endfor %}' });
		assert.equal(await render(), 'checkinganswer');
		assert.equal(model.doStreamCalls.length, 2);
	});
	for (const streaming of [false, true]) it(`native output can satisfy a schema with unresolved work, streaming=${streaming}`, async () => {
		const output = Output.object({ schema: z.object({ answer: z.string() }) });
		const config = { model: mock({ content: [text('{"answer":"Looks complete"}'), call()] }), output,
			tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }) }) } };
		const result = await (streaming ? create.LLMAgent.asStream(config)('question') : create.LLMAgent(config)('question'));
		assert.deepEqual(await result.output, { answer: 'Looks complete' });
		assert.equal((await result.toolCalls).length, 1);
		assert.equal((await result.toolResults).length, 0);
		assert.equal('value' in result, false);
	});
	it('rejects that schema-valid incomplete output as a tool, and accepts a settled neighbor', async () => {
		for (const settled of [false, true]) {
			let parses = 0;
			const nested = create.LLMAgent.asTool({ model: mock({ content: [text('{"answer":"Looks complete"}'), call()] }, { content: [text('{"answer":"Looks complete"}')] }), stopWhen: isStepCount(2),
				inputSchema: z.object({}), prompt: 'question', output: Output.object({ schema: z.object({ answer: z.string() }).transform(value => { parses++; return value; }) }),
				tools: { lookup: settled ? lookup : tool({ inputSchema: z.object({ query: z.string() }) }) } });
			if (settled) assert.deepEqual(await nested.execute({}, options), { answer: 'Looks complete' });
			else await assert.rejects(async () => nested.execute({}, options), /tool results or approvals are pending/);
			assert.equal(parses, 1);
		}
	});
	for (const reason of ['stop', 'length', 'content-filter', 'other', 'error', 'tool-calls'] as const) for (const answer of ['', 'answer']) {
		it(`tool completion with ${reason} and ${answer ? 'nonempty' : 'empty'} text`, async () => {
			const nested = create.LLMAgent.asTool({ model: mock({ content: [text(answer)], reason }), inputSchema: z.object({}), prompt: 'question' });
			if (reason === 'error' || reason === 'tool-calls' || reason !== 'stop' && answer === '') await assert.rejects(async () => nested.execute({}, options), NoOutputGeneratedError);
			else assert.equal(await nested.execute({}, options), answer);
		});
	}
	it('rejects an explicit provider pause even with text and no pending tools', async () => {
		const nested = create.LLMAgent.asTool({ model: mock({ content: [text('Working.')], raw: 'pause_turn' }), inputSchema: z.object({}), prompt: 'question' });
		await assert.rejects(async () => nested.execute({}, options), /provider paused/);
	});
	for (const deferred of [false, true]) for (const policy of ['generic', 'per-tool'] as const) for (const resolved of [false, true]) {
		it(`tool provider automatic approval: deferred=${deferred}, ${policy}, result=${resolved}`, async () => {
			const provider = tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
				supportsDeferredResults: deferred, inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() });
			const nested = create.LLMAgent.asTool({ inputSchema: z.object({}), prompt: 'question', tools: { lookup: provider },
				toolApproval: policy === 'generic' ? () => 'approved' : { lookup: 'approved' },
				model: mock({ content: [call(true), ...resolved ? [{ type: 'tool-result' as const, toolCallId: 'call', toolName: 'lookup', result: 'done' }] : [], text('answer')] }) });
			if (deferred && !resolved) await assert.rejects(async () => nested.execute({}, options), /pending/);
			else assert.equal(await nested.execute({}, options), 'answer');
		});
	}
	for (const deferred of [false, true]) for (const resolved of [false, true]) {
		it(`a later user-approval request preserves provider result settlement: deferred=${deferred}, result=${resolved}`, async () => {
			const nested = create.LLMAgent.asTool({ inputSchema: z.object({}), prompt: 'question',
				tools: { lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
					supportsDeferredResults: deferred, inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }) },
				toolApproval: () => 'user-approval', model: mock({ content: [call(true),
					...resolved ? [{ type: 'tool-result' as const, toolCallId: 'call', toolName: 'lookup', result: 'done' }] : [], text('answer')] }) });
			if (resolved) assert.equal(await nested.execute({}, options), 'answer');
			else await assert.rejects(async () => nested.execute({}, options), /pending/);
		});
	}
	for (const deferred of [false, true]) for (const decision of ['approved', 'denied', 'user-approval'] as const) {
		it(`a provider request followed by SDK ${decision} retains its completion rule, deferred=${deferred}`, async () => {
			const nested = create.LLMAgent.asTool({ inputSchema: z.object({}), prompt: 'question',
				tools: { lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
					supportsDeferredResults: deferred, inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }) },
				toolApproval: () => decision, model: mock({ content: [call(true),
					{ type: 'tool-approval-request', approvalId: 'provider-approval', toolCallId: 'call' }, text('answer')] }) });
			if (decision === 'denied') assert.equal(await nested.execute({}, options), 'answer');
			else await assert.rejects(async () => nested.execute({}, options), /pending/);
		});
	}
	for (const injected of [false, true]) it(`rejects an automatic provider approval that was never sent, injected=${injected}`, async () => {
		const step: Step = { content: [call(true), { type: 'tool-approval-request', approvalId: 'provider-approval', toolCallId: 'call' }, text('Waiting for approval.')] };
		const model = mock(step, step);
		const nested = create.LLMAgent.asTool({ model, prompt: 'question', inputSchema: z.object({}), stopWhen: isStepCount(20),
			tools: { lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
				inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }) }, toolApproval: { lookup: 'approved' } });
		const result = await nested();
		assert.equal(result.output, 'Waiting for approval.');
		const parts = result.responseMessages.flatMap(message => typeof message.content === 'string' ? [] : [...message.content]);
		assert.equal(parts.some(part => part.type === 'tool-result'), false);
		const decisions = parts.filter(part => part.type === 'tool-approval-response');
		assert.equal(decisions.length, 1);
		assert.notEqual(decisions[0].approvalId, 'provider-approval');
		assert.equal(model.doGenerateCalls.length, 1);
		const owner = create.Function({ tools: { nested }, execute: ({ nested }) => nested({}) });
		await assert.rejects(async () => injected ? owner() : nested.execute({}, options), /pending/);
		assert.equal(model.doGenerateCalls.length, 2, 'Each invocation makes only one provider request.');
	});
	for (const policy of ['approved', 'user-approval'] as const) for (const selected of ['retained', 'provider', 'sdk', 'both'] as const) {
		it(`matches each provider approval ID across hook transport: ${policy}, ${selected}`, async () => {
			const model = mock({ content: [call(true), { type: 'tool-approval-request', approvalId: 'provider-approval', toolCallId: 'call' },
				{ type: 'tool-call', toolCallId: 'bridge', toolName: 'bridge', input: '{}' }], reason: 'tool-calls' }, { content: [text('answer')] });
			let sdkApprovalId: string | undefined;
			const nested = create.LLMAgent.asTool({ model, prompt: 'question', inputSchema: z.object({}), stopWhen: isStepCount(2),
				tools: {
					lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
						inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }),
					bridge: tool({ inputSchema: z.object({}), execute: () => 'next' }),
				}, toolApproval: { lookup: policy }, prepareStep: ({ stepNumber, messages, responseMessages }) => {
					if (stepNumber === 0) return;
					const requests = responseMessages.flatMap(message => typeof message.content === 'string' ? [] : [...message.content])
						.filter(part => part.type === 'tool-approval-request');
					sdkApprovalId = requests.find(part => part.approvalId !== 'provider-approval')?.approvalId;
					assert.ok(sdkApprovalId);
					const ids = selected === 'both' ? ['provider-approval', sdkApprovalId] : selected === 'provider' ? ['provider-approval'] : selected === 'sdk' ? [sdkApprovalId] : [];
					return { messages: [...messages, ...ids.length ? [{ role: 'tool' as const, content: ids.map(approvalId => ({
						type: 'tool-approval-response' as const, approvalId, approved: true, providerExecuted: true,
					})) }] : []] };
				} });
			if (selected === 'both' || policy === 'approved' && selected === 'provider') assert.equal(await nested.execute({}, options), 'answer');
			else await assert.rejects(async () => nested.execute({}, options), /pending/);
			assert.equal(model.doGenerateCalls.length, 2);
			const sent = model.doGenerateCalls[1].prompt.flatMap(message => message.role === 'tool' ? message.content : [])
				.filter(part => part.type === 'tool-approval-response').map(part => part.approvalId);
			assert.equal(sent.includes('provider-approval'), selected === 'provider' || selected === 'both');
			assert.equal(sent.includes(sdkApprovalId!), policy === 'approved' || selected === 'sdk' || selected === 'both');
		});
	}
	for (const kind of ['local', 'provider', 'deferred'] as const) {
		it(`a denied ${kind} call emitted by this run is settled`, async () => {
			let executions = 0;
			const provider = kind !== 'local';
			const tools = { lookup: provider ? tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
				supportsDeferredResults: kind === 'deferred', inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() })
				: tool({ inputSchema: z.object({ query: z.string() }), execute: () => { executions++; return 'done'; } }) };
			const nested = create.LLMAgent.asTool({ model: mock({ content: [call(provider), text('answer')] }, { content: [text('answer')] }), tools, stopWhen: isStepCount(2),
				prompt: 'question', inputSchema: z.object({}), toolApproval: () => 'denied' });
			assert.equal(await nested.execute({}, options), 'answer');
			assert.equal(executions, 0);
		});
	}
	for (const rendered of [false, true]) it(`a hook may remove incoming work without blocking tool output, rendered=${rendered}`, async () => {
		const history: ModelMessage[] = [{ role: 'user', content: 'original' }, { role: 'assistant', content: [
			{ type: 'tool-call', toolCallId: 'old', toolName: 'lookup', input: { query: 'old' } },
			{ type: 'tool-approval-request', approvalId: 'old-approval', toolCallId: 'old' },
		] }];
		const original = JSON.stringify(history);
		const model = mock({ content: [text('answer')] });
		const config = { model, inputSchema: z.object({}) };
		const nested = rendered
			? create.LLMAgent.withFunction.asTool({ ...config, prompt: () => history, prepareCall: request => ({ ...request, messages: conversation('trimmed') }) })
			: create.LLMAgent.asTool({ ...config, prompt: history, prepareCall: request => ({ ...request, messages: conversation('trimmed') }) });
		assert.equal(await nested.execute({}, options), 'answer');
		assert.deepEqual(model.doGenerateCalls[0].prompt, [{ role: 'user', content: [{ type: 'text', text: 'trimmed' }], providerOptions: undefined }]);
		assert.equal(JSON.stringify(history), original);
	});
	it('incoming deferred provider work follows native handling even when sent to the model', async () => {
		const model = mock({ content: [text('answer')] });
		const nested = create.LLMAgent.asTool({ model, prompt: [{ role: 'user', content: 'original' }, { role: 'assistant', content: [
			{ type: 'tool-call', toolCallId: 'old', toolName: 'lookup', input: { query: 'old' }, providerExecuted: true },
		] }], inputSchema: z.object({}), tools: { lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true,
			supportsDeferredResults: true, inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }) } });
		assert.equal(await nested.execute({}, options), 'answer');
		assert.equal(model.doGenerateCalls[0].prompt[1].role, 'assistant');
	});
	for (const approved of [false, true]) it(`native incoming approval outcomes need no response-local call definition, approved=${approved}`, async () => {
		let executions = 0;
		const nested = create.LLMAgent.asTool({ model: mock({ content: [text('answer')] }), inputSchema: z.object({}), prompt: [
			{ role: 'user', content: 'original' }, { role: 'assistant', content: [
				{ type: 'tool-call', toolCallId: 'old', toolName: 'lookup', input: { query: 'old' } },
				{ type: 'tool-approval-request', approvalId: 'old-approval', toolCallId: 'old' },
			] }, { role: 'tool', content: [{ type: 'tool-approval-response', approvalId: 'old-approval', approved }] },
		], tools: { lookup: tool({ inputSchema: z.object({ query: z.string() }), execute: () => { executions++; return 'done'; } }) } });
		assert.equal(await nested.execute({}, options), 'answer');
		assert.equal(executions, approved ? 1 : 0);
	});
});

// SDK-only canary: the tool adapter delegates these output eligibility rules to generation.
describe('Native generation output availability', () => {
	for (const reason of ['stop', 'length', 'content-filter', 'other', 'error', 'tool-calls'] as const) for (const answer of ['', 'answer']) {
		it(`${reason} with ${answer ? 'nonempty' : 'empty'} text`, async () => {
			const result = await generateText({ model: mock({ content: [text(answer)], reason }), prompt: 'question' });
			if (reason === 'tool-calls' || reason !== 'stop' && answer === '') assert.throws(() => result.output, NoOutputGeneratedError);
			else assert.equal(result.output, answer);
		});
	}
});

describe('Object result augmentation', () => {
	for (const streaming of [false, true]) {
		it(`${streaming ? 'streamer' : 'generator'} exposes the parsed object without a second parse`, async () => {
			let parses = 0;
			const schema = z.object({ n: z.string().transform(value => { parses++; return Number(value); }) });
			const model = mock({ content: [text('{"n":"3"}')] });
			const config = { model, prompt: 'question', output: Output.object({ schema }) };
			const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
			const result = await component();
			assert.equal('value' in { ...result }, false);
			assert.equal('value' in Object.assign({}, result), false);
			assert.doesNotThrow(() => JSON.stringify(result));
			assert.equal('value' in result, false);
			if ('partialOutputStream' in result) await collect(result.partialOutputStream);
			assert.deepEqual(await result.output, { n: 3 });
			assert.equal('value' in result, false);
			assert.equal(parses, 1);
			assert.equal(model.doGenerateCalls.length, streaming ? 0 : 1);
			assert.equal(model.doStreamCalls.length, streaming ? 1 : 0);
			assert.ok((await result.response).messages);
			assert.equal((await result.messageHistory).length, 2);
		});

		it(`${streaming ? 'streamer' : 'generator'} retains array output and native result views`, async () => {
			const model = mock({ content: [text('{"elements":[1,2]}')] });
			const config = { model, prompt: 'question', output: Output.array({ element: z.number() }) };
			const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
			const result = await component();
			assert.equal('value' in result, false);
			if ('elementStream' in result) assert.deepEqual(await collect(result.elementStream), [1, 2]);
			assert.deepEqual(await result.output, [1, 2]);
			assert.equal(model.doGenerateCalls.length + model.doStreamCalls.length, 1);
		});

		it(`${streaming ? 'streamer' : 'generator'} keeps no-schema JSON complete even when it is an array`, async () => {
			const config = { model: mock({ content: [text('[1,2]')] }), prompt: 'question', output: Output.json() };
			const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
			const result = await component();
			if ('textStream' in result) assert.deepEqual(await collect(result.textStream), ['[1,2]']);
			assert.deepEqual(await result.output, [1, 2]);
			assert.equal('value' in result, false);
		});
	}

	it('retains choice values and native response metadata', async () => {
		const result = await create.LLMAgent({ model: mock({ content: [text('{"result":"yes"}')] }), prompt: 'question', output: Output.choice({ options: ['yes', 'no'] }) })();
		assert.equal(result.output, 'yes');
		assert.equal(result.response.messages.at(-1)?.role, 'assistant');
	});

	it('forwards native validation failures through the completed streaming value', async () => {
		const result = (await create.LLMAgent.asStream({ model: mock({ content: [text('{"n":"invalid"}')] }), prompt: 'question', output: Output.object({ schema: z.object({ n: z.number() }) }) })());
		assert.equal('value' in result, false);
		await collect(result.stream);
		const error = await Promise.resolve(result.output).catch((error: unknown) => error);
		await assert.rejects(async () => result.output, caught => caught === error);
	});

	it('rejects array value when the completed array fails validation', async () => {
		const result = (await create.LLMAgent.asStream({ model: mock({ content: [text('{"elements":[1,"invalid"]}')] }), prompt: 'question', output: Output.array({ element: z.number() }) })());
		await collect(result.stream);
		await assert.rejects(async () => result.output);
		await assert.rejects(async () => result.output);
	});
});
