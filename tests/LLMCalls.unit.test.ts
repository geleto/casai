import { runtimeRun } from './fixtures/runtime-call.js';
import { Output } from 'ai';
/* eslint-disable no-constant-condition -- Unreachable branches verify compile-time errors. */
import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { generateText, streamText, isStepCount, InvalidPromptError } from 'ai';
import type { ModelMessage, Tool } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { create, ConfigError, ValidationError, TemplateError, race, z } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';
import { validateMessagesArray } from '../src/config/validate.js';

const usage = {
	inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function mockModel(text: string, deltas = [text]): MockLanguageModelV3 {
	const finishReason = { unified: 'stop', raw: 'stop' } as const;
	return new MockLanguageModelV3({
		doGenerate: { content: [{ type: 'text', text }], finishReason, usage, warnings: [] },
		doStream: async () => ({
			stream: convertArrayToReadableStream([
				{ type: 'stream-start', warnings: [] },
				{ type: 'text-start', id: 'text' },
				...deltas.map(delta => ({ type: 'text-delta' as const, id: 'text', delta })),
				{ type: 'text-end', id: 'text' },
				{ type: 'finish', finishReason, usage },
			]),
		}),
	});
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = [];
	for await (const value of stream) values.push(value);
	return values;
}

// Generators resolve when complete; streams are drained so their calls finish.
async function settle(result: unknown): Promise<void> {
	const streamed = await result as { partialOutputStream?: AsyncIterable<unknown>, textStream?: AsyncIterable<unknown> };
	const stream = streamed.partialOutputStream ?? streamed.textStream;
	if (stream) await collect(stream);
}

// The text of each message, per model call.
function promptTexts(model: MockLanguageModelV3, streaming = false): string[][] {
	return (streaming ? model.doStreamCalls : model.doGenerateCalls).map(call => call.prompt.map(message => typeof message.content === 'string'
		? message.content
		: message.content.map(part => part.type === 'text' ? part.text : `[${part.type}]`).join('')));
}

const schema = z.object({ answer: z.number() });
const answer = '{"answer":4}';
const factoryNames = ['generate', 'stream', 'generate-structured', 'stream-structured'] as const;

describe('LLM call contracts without providers', () => {
	describe('inherited factory settings', () => {
		for (const transformed of [false, true]) it(`keeps each prompt paired with its parser, transformed=${transformed}`, async () => {
			const model = mockModel(answer);
			const parent = { config: transformed
				? { model, inputSchema: z.object({ value: z.string().transform(Number) }), prompt: ({ value }: { value: number }) => value.toFixed(1) }
				: { model, inputSchema: z.object({ value: z.string() }), prompt: ({ value }: { value: string }) => value.toUpperCase() } };
			const generatedText = create.LLMAgent.withFunction({}, parent);
			const streamedText = create.LLMAgent.withFunction.asStream({}, parent);
			const generatedObject = create.LLMAgent.withFunction({ output: Output.object({ schema: schema }) }, parent);
			const streamedObject = create.LLMAgent.withFunction.asStream({ output: Output.object({ schema: schema }) }, parent);
			for (const invoke of [
				() => generatedText({ value: '4' }), () => generatedText.run({ context: { value: '4' } }),
				() => streamedText({ value: '4' }), () => streamedText.run({ context: { value: '4' } }),
				() => generatedObject({ value: '4' }), () => generatedObject.run({ context: { value: '4' } }),
				() => streamedObject({ value: '4' }), () => streamedObject.run({ context: { value: '4' } }),
			]) await settle(await invoke());
			const expected = Array.from({ length: 4 }, () => [transformed ? '4.0' : '4']);
			expect(promptTexts(model)).to.deep.equal(expected);
			expect(promptTexts(model, true)).to.deep.equal(expected);
		});

		it('replaces complete output specifications without retaining old mode metadata', async () => {
			const model = mockModel(answer);
			const parent = create.Config({ model, output: Output.object({ schema: z.object({ old: z.string() }), name: 'Old', description: 'Old output' }) });
			const generator = create.LLMAgent({ output: Output.json() }, parent);
			const streamer = create.LLMAgent.asStream({ output: Output.json() }, parent);
			const settings = { model, output: Output.json(), prompt: 'Answer' };
			for (const result of [await generator('Answer'), await generateText(settings)]) expect(result.output).to.deep.equal({ answer: 4 });
			for (const result of [await streamer('Answer'), streamText(settings)]) expect(await result.output).to.deep.equal({ answer: 4 });
			expect(parent.config.output.name).to.equal('object');
		});

	});

	describe('prepared message transport', () => {
		function history(approved: boolean): ModelMessage[] {
			return [
				{ role: 'user', content: 'Search the web' },
				{ role: 'assistant', content: [
					{ type: 'tool-call', toolCallId: 'call', toolName: 'search', input: { query: 'Casai' }, providerExecuted: true },
					{ type: 'tool-approval-request', approvalId: 'approval', toolCallId: 'call' },
				] },
				{ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: 'approval', approved, reason: 'Reviewed', providerExecuted: true }] },
			];
		}
		function approvals(model: MockLanguageModelV3, streaming: boolean) {
			return (streaming ? model.doStreamCalls : model.doGenerateCalls).map(call => call.prompt.flatMap(message =>
				message.role === 'tool' ? message.content.filter(part => part.type === 'tool-approval-response') : []));
		}
		for (const approved of [true, false]) {
			const expected = [{ type: 'tool-approval-response', approvalId: 'approval', approved, reason: 'Reviewed' }];
			for (const streaming of [false, true]) it(`native SDK forwards provider approvals with approved=${approved}, streaming=${streaming}`, async () => {
				const model = mockModel('done');
				const settings = { model, messages: history(approved) };
				if (streaming) await settle(streamText(settings));
				else await generateText(settings);
				expect(approvals(model, streaming)).to.deep.equal([expected]);
			});
			for (const factoryName of factoryNames) for (const modifier of ['withFunction', 'withScript', 'loadsScript'] as const) {
				it(`${factoryName}.${modifier} preserves provider approvals with approved=${approved}`, async () => {
					const model = mockModel(answer);
					const messages = history(approved);
					const original = structuredClone(messages);
					// Exercise the common runtime transport across the distinct factory signatures.
					const factoryValue: unknown = (factoryName.startsWith('stream') ? create.LLMAgent[modifier].asStream : create.LLMAgent[modifier]);
					const factory = factoryValue as (config: object) => { (): unknown; run(settings: object): unknown };
					const component = factory({ model, context: { history: messages },
						prompt: modifier === 'withFunction' ? () => messages : modifier === 'withScript' ? 'return history' : 'history',
						...(modifier === 'loadsScript' ? { loader: { load: () => 'return history' } } : {}),
						...(factoryName.endsWith('structured') ? { output: Output.object({ schema }) } : {}),
					});
					await settle(await component());
					await settle(await runtimeRun(component, {}));
					expect(approvals(model, factoryName.startsWith('stream'))).to.deep.equal([expected, expected]);
					expect(messages).to.deep.equal(original);
				});
			}
		}
		for (const factoryName of factoryNames) for (const modifier of ['withFunction', 'withScript', 'loadsScript'] as const) {
			it(`${factoryName}.${modifier} rejects invalid prepared messages before dispatch`, async () => {
				const model = mockModel(answer);
				const messages = [{ role: 'user', content: 42 }];
				const factoryValue: unknown = (factoryName.startsWith('stream') ? create.LLMAgent[modifier].asStream : create.LLMAgent[modifier]);
				const factory = factoryValue as (config: object) => () => unknown;
				const component = factory({ model, context: { history: messages },
					prompt: modifier === 'withFunction' ? () => messages : modifier === 'withScript' ? 'return history' : 'history',
					...(modifier === 'loadsScript' ? { loader: { load: () => 'return history' } } : {}),
					...(factoryName.endsWith('structured') ? { output: Output.object({ schema }) } : {}),
				});
				await rejects(async () => { await component(); }, error => error instanceof ValidationError && error.message === 'Prompt output validation failed.');
				expect(model.doGenerateCalls.length + model.doStreamCalls.length).to.equal(0);
			});
		}
	});

	it('validates invocation history once in addition to native SDK validation', async () => {
		let reads = 0;
		const messages: ModelMessage[] = [{ get role() { reads++; return 'user' as const; }, content: 'earlier' }];
		validateMessagesArray(messages);
		const validationReads = reads;
		reads = 0;
		await generateText({ model: mockModel('done'), messages: [...messages, { role: 'user', content: 'go' }] });
		const nativeReads = reads;
		const component = create.LLMAgent({ model: mockModel('done'), prompt: 'go' });
		for (const call of [() => component(undefined, {}, messages), () => runtimeRun(component, { messageHistory: messages })]) {
			reads = 0;
			await call();
			expect(reads).to.equal(nativeReads + validationReads);
		}
	});

	it('keeps component and descriptor metadata outside the editable request', async () => {
		const providerOptions = { mock: { inner: true } };
		const component = create.LLMAgent.withTemplate.asTool({ model: mockModel('done'), prompt: 'go',
			context: { db: 'private' }, inputSchema: z.object({}), toolContextSchema: z.object({}),
			loader: [], filters: {}, renderOptions: {}, debug: false, description: 'outer', title: 'outer',
			metadata: { source: 'outer' }, strict: true, inputExamples: [{ input: {} }], maxOutputTokens: 7, providerOptions,
			prepareCall(request) {
				for (const key of ['context', 'inputSchema', 'toolContextSchema', 'promptType', 'loader', 'filters', 'renderOptions', 'debug',
					'description', 'title', 'metadata', 'strict', 'inputExamples', 'output', 'prepareCall']) expect(request).not.to.have.property(key);
				expect(request.providerOptions).to.equal(providerOptions);
				expect(request.maxOutputTokens).to.equal(7);
				expect(request.messages).to.deep.equal([{ role: 'user', content: 'go' }]);
				return request;
			},
		});
		await component();
	});

	for (const factoryName of factoryNames) it(`${factoryName} checks cancellation before invocation history validation`, async () => {
		const reason = new Error('already cancelled');
		const abortSignal = AbortSignal.abort(reason);
		let reads = 0;
		const model = mockModel(answer);
		// This runtime matrix intentionally erases the different factory signatures.
		const factoryValue: unknown = (factoryName.startsWith('stream') ? create.LLMAgent.asStream : create.LLMAgent);
		const factory = factoryValue as (config: object) => { run(settings: object): unknown };
		const component = factory({ model, prompt: 'go', ...(factoryName.endsWith('structured') ? { output: Output.object({ schema }) } : {}) });
		for (const role of ['user', 'invalid']) {
			const messages = [{ get role() { reads++; return role; }, content: 'earlier' }];
			await rejects(async () => { await runtimeRun(component, { messageHistory: messages, abortSignal }); }, error => error === reason);
		}
		expect(reads).to.equal(0);
		expect(model.doGenerateCalls.length + model.doStreamCalls.length).to.equal(0);
	});

	for (const factoryName of factoryNames) it(`${factoryName} checks cancellation before parsing, preparation and dispatch`, async () => {
		const reason = new Error('already cancelled');
		const abortSignal = AbortSignal.abort(reason);
		let parsed = 0, prepared = 0;
		const model = mockModel(answer);
		// This runtime matrix intentionally erases the different factory signatures.
		const factoryValue: unknown = (factoryName.startsWith('stream') ? create.LLMAgent.withFunction.asStream : create.LLMAgent.withFunction);
		const factory = factoryValue as (config: object) => { run(settings: object): unknown };
		const component = factory({ model, inputSchema: z.object({ value: z.number().transform(value => { parsed++; return value; }) }),
			prompt: () => { prepared++; return 'go'; }, ...(factoryName.endsWith('structured') ? { output: Output.object({ schema }) } : {}) });
		for (const value of [1, 'invalid']) {
			await rejects(async () => await runtimeRun(component, { context: { value }, abortSignal }), error => error === reason);
		}
		expect(parsed).to.equal(0);
		expect(prepared).to.equal(0);
		expect(model.doGenerateCalls.length + model.doStreamCalls.length).to.equal(0);
	});

	for (const factoryName of factoryNames) it(`${factoryName} validates every alternative of run settings`, async () => {
		const model = mockModel(answer);
		// This runtime matrix intentionally erases the different factory signatures.
		const factoryValue: unknown = (factoryName.startsWith('stream') ? create.LLMAgent.withTemplate.asStream : create.LLMAgent.withTemplate);
		const factory = factoryValue as (config: object) => unknown;
		const child = factory({ model, prompt: 'Value {{ value }}', inputSchema: z.looseObject({ value: z.number() }),
			context: { value: 1, user: 'private' }, ...(factoryName.endsWith('structured') ? { output: Output.object({ schema }) } : {}) }) as { run(settings: object): Promise<unknown> };
		const calls = factoryName.startsWith('stream') ? model.doStreamCalls : model.doGenerateCalls;
		for (const user of ['admin', undefined]) {
			await rejects(child.run({ context: { value: 2, user } }), /Private input keys: user/);
		}
		await rejects(child.run({ context: { value: 'invalid' } }), /Application input validation failed/);
		expect(calls).to.have.length(0);
		await settle(await child.run({ maxOutputTokens: 16 }));
		await settle(await child.run({ context: { value: 2, extra: 'allowed' } }));
		expect(promptTexts(model, factoryName.startsWith('stream'))).to.deep.equal([['Value 1'], ['Value 2']]);
	});

	for (const factoryName of factoryNames) it(`${factoryName} normalizes run keywords and rejects mixed settings`, async () => {
		const model = mockModel(answer);
		// This runtime matrix intentionally erases the different factory signatures.
		const factoryValue: unknown = (factoryName.startsWith('stream') ? create.LLMAgent.withTemplate.asStream : create.LLMAgent.withTemplate);
		const factory = factoryValue as (config: object) => unknown;
		const child = factory({ model, prompt: 'Topic {{ topic }}', ...(factoryName.endsWith('structured') ? { output: Output.object({ schema }) } : {}) });
		const owner = create.Script({ context: { child }, script: 'return child.run(context={ topic: "x" }, temperature=0.9)' });
		await settle(await owner());
		const calls = factoryName.startsWith('stream') ? model.doStreamCalls : model.doGenerateCalls;
		expect(calls).to.have.length(1);
		expect(calls[0].temperature).to.equal(0.9);
		expect(promptTexts(model, factoryName.startsWith('stream'))).to.deep.equal([['Topic x']]);
		const invalid = child as { run(...args: unknown[]): Promise<unknown> };
		await rejects(invalid.run({ context: { topic: 'x' } }, { temperature: 0.9, __hasKeywordArgs: true }), ValidationError);
		await rejects(invalid.run({}, {}), ValidationError);
		await rejects(invalid.run(42), ValidationError);
		await rejects(invalid.run(null), ValidationError);
		expect(calls).to.have.length(1);
	});

	it('classifies malformed call envelopes as configuration errors', async () => {
		const component = create.LLMAgent.withTemplate({ model: mockModel(answer), prompt: 'hello' }) as (...args: unknown[]) => Promise<unknown>;
		for (const args of [[42], [null], [{}, {}], [[], []], ['source', {}, {}], ['source', [], []]]) {
			await rejects(component(...args), ValidationError);
		}
	});

	for (const factoryName of ['generate', 'generate-structured'] as const) it(`${factoryName} keeps providerOptions on the inner model only`, async () => {
		const model = mockModel(answer);
		const providerOptions = { mock: { inner: true } };
		// This runtime matrix intentionally erases the different factory signatures.
		const factoryValue: unknown = (factoryName.startsWith('stream') ? create.LLMAgent.withTemplate.asStream : create.LLMAgent.withTemplate).asTool;
		const build = factoryValue as (config: object) => Tool & { bindToolContext(context: unknown): { tool: Tool; context: unknown } };
		const component = build({ model, prompt: 'Topic {{ topic }}', inputSchema: z.object({ topic: z.string() }),
			providerOptions, ...(factoryName.endsWith('structured') ? { output: Output.object({ schema }) } : {}) });
		for (const operation of [component, component.bindToolContext({}).tool]) {
			expect(operation).not.to.have.property('providerOptions');
			const outer = modelFor({ topic: 'x' });
			await generateText({ model: outer, prompt: 'go', tools: { probe: operation }, stopWhen: isStepCount(2) });
			expect(outer.doGenerateCalls[0].tools?.[0]).not.to.have.property('providerOptions');
		}
		const calls = factoryName.startsWith('stream') ? model.doStreamCalls : model.doGenerateCalls;
		expect(calls).to.have.length(2);
		for (const call of calls) expect(call.providerOptions).to.deep.equal(providerOptions);
		const coded = create.Function.asTool({ inputSchema: z.object({}), providerOptions, execute: () => 1 });
		expect(coded.providerOptions).to.equal(providerOptions);
		expect(coded.bindToolContext({}).tool.providerOptions).to.equal(providerOptions);
	});

	for (const factoryName of factoryNames) for (const modifier of ['withTemplate', 'withScript'] as const) {
		it(`${factoryName}.${modifier} preserves history with Cascada keyword context`, async () => {
			const model = mockModel(answer);
			const source = modifier === 'withTemplate' ? 'Topic {{ topic }}' : 'return "Topic " + topic';
			// This runtime matrix intentionally erases the different factory signatures.
			const factoryValue: unknown = (factoryName.startsWith('stream') ? create.LLMAgent[modifier].asStream : create.LLMAgent[modifier]);
			const factory = factoryValue as (config: object) => unknown;
			const child = factory({ model, prompt: source, ...(factoryName.endsWith('structured') ? { output: Output.object({ schema }) } : {}) });
			const history = [{ role: 'user', content: 'earlier' }];
			for (const call of ['child(history, topic="x")', 'child(source, history, topic="x")']) {
				const script = create.Script({ context: { child, source, history }, script: `return ${call}` });
				await settle(await script());
			}
			expect(promptTexts(model, factoryName.startsWith('stream'))).to.deep.equal([
				['earlier', 'Topic x'], ['earlier', 'Topic x'],
			]);
			const ambiguous = create.Script({ context: { child, history }, script: 'return child(history, { topic: "x" }, topic="y")' });
			await rejects(ambiguous(), /context object or named arguments/);
		});
	}

	describe('empty literal and prepared prompts', () => {
		for (const factoryName of factoryNames) {
			for (const modifier of ['withText', 'withTemplate', 'withScript', 'withFunction', 'loadsText', 'loadsTemplate', 'loadsScript'] as const) {
				it(`${factoryName}.${modifier} submits an empty user message with or without history`, async () => {
					const model = mockModel(answer);
					const source = modifier.includes('Script') ? 'return ""' : '';
					// This runtime matrix intentionally erases the different factory signatures.
					const factoryValue: unknown = (factoryName.startsWith('stream') ? create.LLMAgent[modifier].asStream : create.LLMAgent[modifier]);
					const build = factoryValue as (config: object) => {
						(context?: object, history?: ModelMessage[]): unknown;
						run(config: { messageHistory?: ModelMessage[] }): unknown;
					};
					const component = build({ model, ...(factoryName.endsWith('structured') && { output: Output.object({ schema }) }),
						prompt: modifier === 'withFunction' ? () => '' : modifier.startsWith('loads') ? 'source' : source,
						...(modifier.startsWith('loads') && { loader: { load: () => source } }),
					});
					const histories: (ModelMessage[] | undefined)[] = [undefined, [], [{ role: 'user', content: 'earlier' }]];
					for (const history of histories) {
						const result = await runtimeRun(component, history ? { messageHistory: history } : {});
						await settle(result);
						if (!factoryName.endsWith('structured')) {
							const textResult = result as { messageHistory: ModelMessage[] | Promise<ModelMessage[]>, responseMessages: ModelMessage[] | PromiseLike<ModelMessage[]> };
							expect(await textResult.messageHistory).to.deep.equal([
								...history ?? [], { role: 'user', content: '' }, ...await textResult.responseMessages,
							]);
						}
					}
					await settle(await component());
					if (modifier !== 'withFunction') {
						await settle(await component({}, []));
						await settle(await component({}, [{ role: 'user', content: 'earlier' }]));
					}
					expect(promptTexts(model, factoryName.startsWith('stream'))).to.deep.equal([
						[''], [''], ['earlier', ''], [''],
						...(modifier === 'withFunction' ? [] : [[''], ['earlier', '']]),
					]);
				});
			}
			it(`${factoryName} accepts a configured or one-off empty literal prompt`, async () => {
				const model = mockModel(answer);
				const config = { model, prompt: 'configured' };
				const component = factoryName === 'generate' ? create.LLMAgent(config)
					: factoryName === 'stream' ? create.LLMAgent.asStream(config)
						: factoryName === 'generate-structured' ? create.LLMAgent({ ...config, output: Output.object({ schema: schema }) }) : create.LLMAgent.asStream({ ...config, output: Output.object({ schema: schema }) });
				const invoke: (prompt: string) => Promise<unknown> = component;
				await settle(await invoke(''));
				await settle(await runtimeRun(component, { prompt: '', messageHistory: [] }));
				expect(promptTexts(model, factoryName.startsWith('stream'))).to.deep.equal([[''], ['']]);
				expect(component.config.prompt).to.equal('configured');
			});
		}
	});

	for (const factoryName of factoryNames) {
		it(`${factoryName} can prepare no new messages for a history-only continuation`, async () => {
			const model = mockModel(answer);
			const config = { model, prompt: () => [] };
			const component = factoryName === 'generate' ? create.LLMAgent.withFunction(config)
				: factoryName === 'stream' ? create.LLMAgent.withFunction.asStream(config)
					: factoryName === 'generate-structured' ? create.LLMAgent.withFunction({ ...config, output: Output.object({ schema: schema }) })
						: create.LLMAgent.withFunction.asStream({ ...config, output: Output.object({ schema: schema }) });
			const messages: ModelMessage[] = [{ role: 'user', content: 'Earlier.' }];
			const result = await runtimeRun(component, { messageHistory: messages });
			await settle(result);
			expect(promptTexts(model, factoryName.startsWith('stream'))).to.deep.equal([['Earlier.']]);
			if ('messageHistory' in result) expect(await result.messageHistory).to.deep.equal([...messages, ...await result.responseMessages]);
		});
	}

	describe('loaded templates', () => {
		for (const factoryName of factoryNames) {
			const streaming = factoryName.startsWith('stream');
			it(`should render loaded ${factoryName} templates with merged context and one-off names`, async () => {
				const loaded: string[] = [];
				const loader = { load: (name: string) => {
					loaded.push(name);
					return `${name}: {{ greeting }} {{ name }}`;
				} };
				const model = mockModel(answer);
				const config = { model, loader, prompt: 'default', inputSchema: z.object({ greeting: z.string(), name: z.string() }), context: { greeting: 'Hello', name: 'Configured' } };
				const component = factoryName === 'generate' ? create.LLMAgent.loadsTemplate(config)
					: factoryName === 'stream' ? create.LLMAgent.loadsTemplate.asStream(config)
						: factoryName === 'generate-structured' ? create.LLMAgent.loadsTemplate({ ...config, output: Output.object({ schema: schema }) })
							: create.LLMAgent.loadsTemplate.asStream({ ...config, output: Output.object({ schema: schema }) });
				const call = component as (...args: unknown[]) => ReturnType<typeof component>;
				await settle(await call({ name: 'First' }));
				await settle(await call('other', { name: 'Second' }));
				await settle(await runtimeRun(component, { prompt: 'other', context: { greeting: 'Hi' } }));
				await settle(await component());
				expect(promptTexts(model, streaming)).to.deep.equal([
					['default: Hello First'],
					['other: Hello Second'],
					['other: Hi Configured'],
					['default: Hello Configured'],
				]);
				// The environment caches the configured template after the first call.
				expect(loaded.filter(name => name === 'default')).to.have.length(1);
				expect(component.config.prompt).to.equal('default');
				expect(component.config.context).to.deep.equal({ greeting: 'Hello', name: 'Configured' });
			});
		}
	});

	describe('prompt rendering settings', () => {
		it('keeps HTML literal in LLM prompts even when escaping is requested', async () => {
			const model = mockModel('DONE');
			const generator = create.LLMAgent.withTemplate({
				model, prompt: '{{ value }}', context: { value: '<b> & "text"' }, renderOptions: { autoescape: true },
			});
			await generator();
			expect(promptTexts(model)).to.deep.equal([['<b> & "text"']]);
		});

		it('reports malformed script prompt output as a configuration validation error', async () => {
			const model = mockModel('DONE');
			const generator = create.LLMAgent.withScript({ model, prompt: 'return [{content: "Invalid message"}]' });
			await rejects(() => generator(), (error: unknown) => error instanceof ValidationError && error.message.includes('Prompt output validation failed'));
			expect(model.doGenerateCalls).to.have.length(0);
		});

		it('should render template prompts with the component filters, options and loader', async () => {
			const model = mockModel('DONE');
			const generator = create.LLMAgent.withTemplate({
				model,
				loader: { load: (name: string) => name === 'signature' ? '-- {{ author | upper }}' : null },
				filters: { upper: (value: string) => value.toUpperCase() },
				renderOptions: { trimBlocks: true },
				context: { author: 'ada' },
				prompt: '{% if true %}\n{{ "Summary" | upper }}{% endif %}\n{% include "signature" with context %}',
			});
			await generator();
			expect(promptTexts(model)).to.deep.equal([['SUMMARY-- ADA']]);
		});

		it('should run script prompts with the component filters and loader', async () => {
			const model = mockModel('DONE');
			const generator = create.LLMAgent.withScript({
				model,
				loader: { load: (name: string) => name === 'helpers' ? 'function sign(name)\n return "-- " ~ name\nendfunction' : null },
				filters: { upper: (value: string) => value.toUpperCase() },
				context: { author: 'ada' },
				prompt: 'from "helpers" import sign\nreturn ("Summary" | upper) ~ " " ~ sign(author | upper)',
			});
			await generator();
			expect(promptTexts(model)).to.deep.equal([['SUMMARY -- ADA']]);
		});

		it('should apply engine options such as throwOnUndefined before calling the model', async () => {
			const model = mockModel('DONE');
			const generator = create.LLMAgent.withTemplate({ model, renderOptions: { throwOnUndefined: true }, prompt: 'Hello {{ missing }}' });
			await rejects(() => generator(), TemplateError);
			expect(model.doGenerateCalls).to.have.length(0);
		});

		it('should report a missing template or script prompt when none is configured or supplied', async () => {
			const model = mockModel('DONE');
			const template = create.LLMAgent.withTemplate({ model });
			const script = create.LLMAgent.withScript({ model });
			await rejects(() => (template as unknown as (context: object) => Promise<unknown>)({ topic: 'tests' }), (error: unknown) => {
				expect(error).to.be.instanceOf(InvalidPromptError);
				expect((error as Error).message).to.match(/messages must not be empty/);
				return true;
			});
			await rejects(() => (script as unknown as (context: object) => Promise<unknown>)({ topic: 'tests' }), (error: unknown) => {
				expect(error).to.be.instanceOf(InvalidPromptError);
				expect((error as Error).message).to.match(/messages must not be empty/);
				return true;
			});
			expect(model.doGenerateCalls).to.have.length(0);
			await template('About {{ topic }}', { topic: 'tests' });
			await script('return "About " ~ topic', { topic: 'tests' });
			expect(promptTexts(model)).to.deep.equal([['About tests'], ['About tests']]);
		});
	});

	describe('plain-text calls', () => {
		it('defers named-text loading until a call and keeps one-off names local', async () => {
			const model = mockModel('DONE');
			const loaded: string[] = [];
			const generator = create.LLMAgent.loadsText({
				model, prompt: 'default', loader: { load: (name: string) => { loaded.push(name); return `Loaded ${name}.`; } },
			});
			expect(loaded).to.deep.equal([]);
			await generator('other');
			expect(loaded).to.deep.equal(['other']);
			await generator();
			await generator();
			expect(loaded).to.deep.equal(['other', 'default']);
			expect(promptTexts(model)).to.deep.equal([['Loaded other.'], ['Loaded default.'], ['Loaded default.']]);
		});

		it('retries a failed named-text load on the next call', async () => {
			const model = mockModel('DONE');
			const failure = new Error('Temporarily unavailable');
			let attempts = 0;
			const generator = create.LLMAgent.loadsText({ model, prompt: 'default', loader: { load: async () => {
				if (++attempts === 1) throw failure;
				return 'Recovered.';
			} } });
			await rejects(() => generator(), error => error === failure);
			expect(model.doGenerateCalls).to.have.length(0);
			await generator();
			expect(attempts).to.equal(2);
			expect(promptTexts(model)).to.deep.equal([['Recovered.']]);
		});

		for (const factoryName of factoryNames) {
			it(`accepts an empty loaded source through ${factoryName}.run()`, async () => {
				const model = mockModel(answer);
				const config = { model, prompt: 'empty', loader: { load: () => '' } };
				const component = factoryName === 'generate' ? create.LLMAgent.loadsText(config)
					: factoryName === 'stream' ? create.LLMAgent.loadsText.asStream(config)
						: factoryName === 'generate-structured' ? create.LLMAgent.loadsText({ ...config, output: Output.object({ schema: schema }) })
							: create.LLMAgent.loadsText.asStream({ ...config, output: Output.object({ schema: schema }) });
				await settle(await runtimeRun(component, {}));
				await settle(await runtimeRun(component, { prompt: 'other-empty' }));
				await settle(await runtimeRun(component, { prompt: '' }));
				expect(promptTexts(model, factoryName.startsWith('stream'))).to.deep.equal([[''], [''], ['']]);
			});

			it(`rejects invalid loaded-text run overrides before loading or calling ${factoryName}`, async () => {
				const model = mockModel(answer);
				const loaded: string[] = [];
				const config = { model, prompt: 'default', loader: { load: (name: string) => { loaded.push(name); return 'Configured.'; } } };
				const component = factoryName === 'generate' ? create.LLMAgent.loadsText(config)
					: factoryName === 'stream' ? create.LLMAgent.loadsText.asStream(config)
						: factoryName === 'generate-structured' ? create.LLMAgent.loadsText({ ...config, output: Output.object({ schema: schema }) })
							: create.LLMAgent.loadsText.asStream({ ...config, output: Output.object({ schema: schema }) });
				for (const override of [
					{ prompt: null }, { prompt: 42 },
					{ prompt: [{ role: 'user', content: 'Messages are not a resource name.' }] },
					{ messages: [{ role: 'invalid', content: 'Invalid history.' }] },
				]) {
					await rejects(async () => { await runtimeRun(component, override as never); }, ValidationError);
				}
				expect(loaded).to.deep.equal([]);
				expect(model.doGenerateCalls).to.have.length(0);
				expect(model.doStreamCalls).to.have.length(0);
			});
		}

		it('loads empty text and preserves literal template syntax', async () => {
			const model = mockModel('DONE');
			const literal = '  {{ untouched }} {% include "missing" %}\n';
			const generator = create.LLMAgent.loadsText({
				model, prompt: 'literal', loader: { load: (name: string) => name === 'literal' ? literal : '' },
			});
			await generator();
			await generator('empty');
			expect(promptTexts(model)).to.deep.equal([[literal], ['']]);
		});

		it('keeps text caches local to the component environment', async () => {
			let value = 'Original';
			const loader = { load: () => value };
			const model = mockModel('DONE');
			const first = create.LLMAgent.loadsText({ model, loader, prompt: 'name' });
			const second = create.LLMAgent.loadsText({ model, loader, prompt: 'name' });
			await first();
			value = 'Changed';
			await second();
			await first();
			expect(promptTexts(model)).to.deep.equal([['Original'], ['Changed'], ['Original']]);
		});

		it('honors noCache when loading a configured text prompt repeatedly', async () => {
			let calls = 0;
			const model = mockModel('DONE');
			const generator = create.LLMAgent.loadsText({
				model, prompt: 'name', loader: { load: (name: string) => ({ src: `Version ${++calls}`, path: name, noCache: true }) },
			});
			await generator();
			await generator();
			expect(promptTexts(model)).to.deep.equal([['Version 1'], ['Version 2']]);
		});

		for (const groupName of [undefined, 'remote']) {
			it(`invalidates loaded text when a member of an ${groupName ? 'named' : 'anonymous'} race updates`, async () => {
				let value = 'Original';
				const loader = Object.assign(new EventEmitter(), { load: (name: string) => ({ src: value, path: name, noCache: false }) });
				const model = mockModel('DONE');
				const generator = create.LLMAgent.loadsText({
					model, prompt: 'name', loader: race([loader, { load: () => null }], groupName),
				});
				await generator();
				value = 'Changed';
				loader.emit('update', 'name');
				await generator();
				expect(promptTexts(model)).to.deep.equal([['Original'], ['Changed']]);
			});
		}

		it('prepares and validates context on literal and loaded prompts even without hooks', async () => {
			let parsed = 0;
			const model = mockModel('DONE');
			const settings = { model, prompt: 'configured', inputSchema: z.object({ topic: z.string().transform(value => { parsed++; return value.toUpperCase(); }) }) };
			const agents = [create.LLMAgent(settings), create.LLMAgent.asStream(settings), create.LLMAgent.loadsText({ ...settings, loader: { load: () => 'Loaded.' } })];
			for (const agent of agents) {
				const invoke: (context: { topic: string }) => Promise<unknown> = agent;
				await settle(await invoke({ topic: 'test' }));
				await settle(await runtimeRun(agent, { context: { topic: 'test' } }));
				await rejects(invoke({ topic: 42 } as never), /Application input validation failed/);
			}
			expect(parsed).to.equal(6);
		});

		it('should validate call-time and run-time messages before calling the model', async () => {
			const model = mockModel('DONE');
			const invalid = [{ role: 'user', content: 42 }] as unknown as ModelMessage[];
			const messageError = /invalid message objects/;
			const text = create.LLMAgent({ model, prompt: 'Configured.' });
			const streamer = create.LLMAgent.asStream({ model, prompt: 'Configured.' });
			const template = create.LLMAgent.withTemplate({ model, prompt: 'Configured.' });
			const loaded = create.LLMAgent.loadsText({ model, loader: { load: () => 'Loaded.' }, prompt: 'name' });
			for (const reject of [
				() => text(undefined, {}, invalid), () => text.run({ messageHistory: invalid }),
				() => template('Prompt.', invalid), () => template.run({ messageHistory: invalid }),
				() => loaded.run({ messageHistory: invalid }),
			]) {
				await rejects(reject, (error: unknown) => error instanceof ValidationError && error.message.includes('invalid message objects'));
			}
			await rejects(streamer('Prompt.', invalid), messageError);
			await rejects(streamer.run({ messageHistory: invalid }), messageError);
			expect(model.doGenerateCalls).to.have.length(0);
			expect(model.doStreamCalls).to.have.length(0);
		});

		it('should reject a loaded text prompt that is not a name', async () => {
			const model = mockModel('DONE');
			const loader = { load: (name: string) => `Loaded ${name}.` };
			const prompt: ModelMessage[] = [{ role: 'user', content: 'Array.' }];
			expect(() => create.LLMAgent.loadsText({ model, loader, prompt } as never)).to.throw(ConfigError, /must be a string|must be a resource name/);
			expect(() => create.LLMAgent.loadsText.asStream({ model, output: Output.object({ schema }), loader, prompt } as never)).to.throw(ConfigError, /must be a string|must be a resource name/);
			const generator = create.LLMAgent.loadsText({ model, loader, prompt: 'name' });
			await rejects(async () => await generator.run({ prompt } as never), (error: unknown) => error instanceof ValidationError && error.message.includes('must be a resource name'));
			expect(model.doGenerateCalls).to.have.length(0);
			await generator.run({ prompt: 'other' });
			expect(promptTexts(model)).to.deep.equal([['Loaded other.']]);
			if (false) {
				// @ts-expect-error A loaded text prompt is a name, not messages.
				create.LLMAgent.loadsText({ model, loader, prompt });
				// @ts-expect-error A run-time loaded text prompt is a name, not messages.
				void generator.run({ prompt });
			}
		});

		it('returns promises for every streaming entry path', async () => {
			const model = mockModel('DONE');
			const text = create.LLMAgent.asStream({ model, prompt: 'Inline.' });
			const pendingText = text();
			expect(pendingText).to.be.instanceOf(Promise);
			const direct = await pendingText;
			expect(direct).not.to.be.instanceOf(Promise);
			expect((await collect(direct.textStream)).join('')).to.equal('DONE');
			const pendingRun = text.run({ prompt: 'Run.' });
			expect(pendingRun).to.be.instanceOf(Promise);
			const run = await pendingRun;
			expect(run).not.to.be.instanceOf(Promise);
			expect((await collect(run.textStream)).join('')).to.equal('DONE');
			const objects = (await create.LLMAgent.asStream({ model: mockModel(answer), prompt: 'Inline.', output: Output.object({ schema: schema }) })());
			expect(objects).not.to.be.instanceOf(Promise);
			expect(await collect(objects.partialOutputStream)).to.deep.include({ answer: 4 });

			const rendered: (() => Promise<{ textStream: AsyncIterable<string> }>)[] = [
				create.LLMAgent.withTemplate.asStream({ model, prompt: 'Hello {{ name }}', context: { name: 'Ada' } }),
				create.LLMAgent.withScript.asStream({ model, prompt: 'return "Hello " ~ name', context: { name: 'Ada' } }),
				create.LLMAgent.withFunction.asStream({ model, prompt: () => 'Hello Ada' }),
				create.LLMAgent.loadsText.asStream({ model, prompt: 'greeting', loader: { load: () => 'Hello Ada' } }),
			];
			for (const component of rendered) {
				const pending = component();
				expect(pending).to.be.instanceOf(Promise);
				expect((await collect((await pending).textStream)).join('')).to.equal('DONE');
			}
			expect(promptTexts(model, true)).to.deep.equal([['Inline.'], ['Run.'], ['Hello Ada'], ['Hello Ada'], ['Hello Ada'], ['Hello Ada']]);
			if (false) {
				// Rendered and loaded streamers resolve their prompt before they can stream.
				const _rendered: Promise<{ textStream: AsyncIterable<string> }> = create.LLMAgent.withTemplate.asStream({ model, prompt: 'Hello' })();
				const _loaded: Promise<{ textStream: AsyncIterable<string> }> = create.LLMAgent.loadsText.asStream({ model, prompt: 'greeting', loader: { load: () => 'Hello' } })();
			}
		});

		for (const streaming of [false, true]) {
			it(`should send messages alone from a loaded text ${streaming ? 'streamer' : 'generator'} without a prompt name`, async () => {
				const loaded: string[] = [];
				const loader = { load: (name: string) => {
					loaded.push(name);
					return `Loaded ${name}.`;
				} };
				const model = mockModel('DONE');
				const messages: ModelMessage[] = [{ role: 'user', content: 'History.' }];
				const component = streaming ? create.LLMAgent.loadsText.asStream({ model, loader }) : create.LLMAgent.loadsText({ model, loader });
				await settle(await runtimeRun(component, { messageHistory: messages }));
				const invoke: (prompt: string) => Promise<unknown> = component;
				await settle(await invoke('named'));
				const result = await runtimeRun(component, { messageHistory: [{ role: 'user', content: 'Run.' }] });
				expect(await result.messageHistory).to.deep.equal([{ role: 'user', content: 'Run.' }, ...await result.responseMessages]);
				expect(promptTexts(model, streaming)).to.deep.equal([['History.'], ['Loaded named.'], ['Run.']]);
				expect(loaded).to.deep.equal(['named']);

				const empty = streaming ? create.LLMAgent.loadsText.asStream({ model, loader, onError() { /* Exercise explicit error handling. */ } }) : create.LLMAgent.loadsText({ model, loader });
				await rejects(async () => {
					// @ts-expect-error The SDK rejects the missing conversation at execution.
					const result = await empty.run({});
					await result.text;
				}, /messages must not be empty|No output generated/);
			});
		}
	});

	describe('run overrides', () => {
		for (const promptType of ['template', 'script'] as const) {
			it(`should reject a non-string prompt override for a ${promptType} prompt`, async () => {
				const model = mockModel('DONE');
				const generator = promptType === 'template'
					? create.LLMAgent.withTemplate({ model, prompt: 'Configured.' })
					: create.LLMAgent.withScript({ model, prompt: 'return "Configured."' });
				const prompt: ModelMessage[] = [{ role: 'user', content: 'Array.' }];
				await rejects(async () => await runtimeRun(generator, { prompt }), (error: unknown) => {
					expect(error).to.be.instanceOf(ValidationError);
					expect((error as Error).message).to.match(/must be a string/);
					return true;
				});
				expect(model.doGenerateCalls).to.have.length(0);
				if (false) {
					// @ts-expect-error Template and script prompts are source strings.
					void generator.run({ prompt });
				}
			});
		}

		for (const factoryName of factoryNames) {
			it(`should forward generation settings from parents, components and run overrides in ${factoryName}`, async () => {
				const streaming = factoryName.startsWith('stream');
				const model = mockModel(answer);
				const parent = create.Config({ topP: 0.8, topK: 5, presencePenalty: 0.1, frequencyPenalty: 0.2, seed: 7, headers: { 'x-parent': 'parent' } });
				const config = { model, prompt: 'Settings.', maxOutputTokens: 20, providerOptions: { mock: { flag: true } } };
				const component = factoryName === 'generate' ? create.LLMAgent(config, parent)
					: factoryName === 'stream' ? create.LLMAgent.asStream(config, parent)
						: factoryName === 'generate-structured' ? create.LLMAgent({ ...config, output: Output.object({ schema: schema }) }, parent)
							: create.LLMAgent.asStream({ ...config, output: Output.object({ schema: schema }) }, parent);
				await settle(await component());
				await settle(await runtimeRun(component, { topP: 0.5, maxOutputTokens: 30 }));
				const [configured, overridden] = streaming ? model.doStreamCalls : model.doGenerateCalls;
				expect(configured).to.deep.include({
					topP: 0.8, topK: 5, presencePenalty: 0.1, frequencyPenalty: 0.2, seed: 7,
					maxOutputTokens: 20, providerOptions: { mock: { flag: true } },
				});
				expect(configured.headers).to.include({ 'x-parent': 'parent' });
				expect(overridden).to.deep.include({ topP: 0.5, maxOutputTokens: 30, topK: 5, seed: 7 });
				expect(component.config.topP).to.equal(0.8);
				expect(component.config.maxOutputTokens).to.equal(20);
			});
		}

		for (const streaming of [false, true]) {
			it(`should forward configured and run-time stop sequences in ${streaming ? 'streams' : 'generators'}`, async () => {
				const model = mockModel('DONE');
				const component = streaming
					? create.LLMAgent.asStream({ model, prompt: 'List facts.', stopSequences: ['###'] })
					: create.LLMAgent({ model, prompt: 'List facts.', stopSequences: ['###'] });
				await settle(await component());
				await settle(await runtimeRun(component, { stopSequences: ['END'] }));
				expect((streaming ? model.doStreamCalls : model.doGenerateCalls).map(call => call.stopSequences)).to.deep.equal([['###'], ['END']]);
			});
		}
	});

	it('should forward SDK chunk and step callbacks', async () => {
		const chunks: string[] = [];
		const steps: string[] = [];
		const streamer = create.LLMAgent.asStream({
			model: mockModel('DONE', ['DO', 'NE']), prompt: 'Input.',
			onChunk: ({ chunk }) => { if (chunk.type === 'text-delta') chunks.push(chunk.text); },
			onStepEnd: step => { steps.push(`stream:${step.text}`); },
		});
		await collect((await streamer()).textStream);
		const generator = create.LLMAgent({ model: mockModel('DONE'), prompt: 'Input.', onStepEnd: step => { steps.push(`generate:${step.text}`); } });
		await generator();
		expect(chunks).to.deep.equal(['DO', 'NE']);
		expect(steps).to.deep.equal(['stream:DONE', 'generate:DONE']);
	});

	describe('tool input validation', () => {
		const inputSchema = z.object({ value: z.number() });
		const invalid = { value: 'two' } as unknown as { value: number };
		const options = { toolCallId: 'direct', messages: [], context: undefined };

		it('should validate direct component calls and leave .execute() input to the SDK', async () => {
			const model = mockModel('DONE');
			const template = create.Template.asTool({ inputSchema, template: 'Value {{ value }}' });
			const script = create.Script.asTool({ inputSchema, script: 'return "Value " ~ value' });
			const generator = create.LLMAgent.withTemplate.asTool({ inputSchema, model, prompt: 'Value {{ value }}' });
			for (const component of [template, script, generator]) {
				await rejects(async () => await (component as (input: object) => Promise<unknown>)(invalid), (error: unknown) => {
					expect(error).to.be.instanceOf(ValidationError);
					expect((error as Error).message).to.match(/Application input validation failed/);
					return true;
				});
			}
			expect(model.doGenerateCalls).to.have.length(0);
			expect(await template.execute(invalid, options)).to.equal('Value two');
			expect(await script.execute(invalid, options)).to.equal('Value two');
			expect(await generator.execute(invalid, options)).to.equal('DONE');
			expect(promptTexts(model)).to.deep.equal([['Value two']]);

			// Native execute accepts already-parsed arguments; ordinary calls validate raw input.
			const fn = create.Function.asTool({ inputSchema, execute: ({ value }) => `Value ${value}` });
			expect(fn.execute).not.to.equal(fn);
			expect(await fn.execute(invalid, options)).to.equal('Value two');
		});

		it('should let the SDK reject invalid model-issued input before the tool runs', async () => {
			let executions = 0;
			const action = create.Function.asTool({ inputSchema, execute: ({ value }) => {
				executions++;
				return value;
			} });
			const model = new MockLanguageModelV3({ doGenerate: {
				content: [{ type: 'tool-call', toolCallId: 'invalid-call', toolName: 'action', input: '{"value":"two"}' }],
				finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage, warnings: [],
			} });
			const result = await create.LLMAgent({ model, tools: { action }, prompt: 'Use the tool.' })();
			expect(executions).to.equal(0);
			expect(result.toolResults).to.have.length(0);
			expect(result.content.map(part => part.type)).to.deep.equal(['tool-call', 'tool-error']);
		});
	});

	it('exposes source modifiers with both streaming and tool adaptation', () => {
		for (const factory of [create.LLMAgent, create.LLMAgent.withText, create.LLMAgent.withTemplate, create.LLMAgent.withScript,
			create.LLMAgent.withFunction, create.LLMAgent.loadsText, create.LLMAgent.loadsTemplate, create.LLMAgent.loadsScript]) {
			expect(factory.asTool).to.be.a('function');
			expect(factory.asStream).to.be.a('function');
			expect(factory.asStream.asTool).to.be.a('function');
			expect(factory).not.to.have.property('asAgent');
		}
	});
});
