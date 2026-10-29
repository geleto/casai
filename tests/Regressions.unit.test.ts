import { runtimeRun } from './fixtures/runtime-call.js';
import { Output } from 'ai';
/* eslint-disable no-constant-condition -- Unreachable branches verify compile-time errors. */
import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { jsonSchema } from 'ai';
import type { ModelMessage } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { create, ConfigError, ValidationError, z } from './cascada';

function model(text = 'DONE'): MockLanguageModelV3 {
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	const finishReason = { unified: 'stop', raw: 'stop' } as const;
	return new MockLanguageModelV3({
		doGenerate: { content: [{ type: 'text', text }], finishReason, usage, warnings: [] },
		doStream: async () => ({ stream: convertArrayToReadableStream([
			{ type: 'stream-start', warnings: [] },
			{ type: 'text-start', id: 'text' },
			{ type: 'text-delta', id: 'text', delta: text },
			{ type: 'text-end', id: 'text' },
			{ type: 'finish', finishReason, usage },
		]) }),
	});
}

if (false) {
	const parent = create.Config({ model: model(), output: Output.object({ schema: z.object({}) }) });
	// @ts-expect-error Explicit undefined removes the required output schema.
	create.LLMAgent({ output: Output.object({ schema: undefined }) }, parent);
	// @ts-expect-error An array stream also requires a defined output schema.
	create.LLMAgent.asStream({ output: Output.array({ element: undefined }) }, parent);
	// @ts-expect-error A tool must expose a defined input schema to the SDK.
	create.Template.asTool({ template: 'Input.', inputSchema: undefined });
	// @ts-expect-error A script tool must expose a defined input schema to the SDK.
	create.Script.asTool({ script: 'return 1', inputSchema: undefined });
	// @ts-expect-error A text tool must expose a defined input schema to the SDK.
	create.LLMAgent.withTemplate.asTool({ model: model(), prompt: 'Input.', inputSchema: undefined });
	// @ts-expect-error An object tool must expose a defined input schema to the SDK.
	create.LLMAgent.withTemplate.asTool({ prompt: 'Input.', inputSchema: undefined }, parent);
}

describe('Regressions across component boundaries', () => {
	describe('raw configuration validation', () => {
		const factories = [
			{ name: 'Function', build: (config: never, parent?: never): unknown => Reflect.apply(create.Function, undefined, [config, parent]) },
			{ name: 'Template', build: (config: never, parent?: never): unknown => Reflect.apply(create.Template, undefined, [config, parent]) },
			{ name: 'Script', build: (config: never, parent?: never): unknown => Reflect.apply(create.Script, undefined, [config, parent]) },
			{ name: 'generate', build: (config: never, parent?: never): unknown => Reflect.apply(create.LLMAgent, undefined, [config, parent]) },
			{ name: 'stream', build: (config: never, parent?: never): unknown => Reflect.apply(create.LLMAgent.asStream, undefined, [config, parent]) },
			{ name: 'generate-structured', build: (config: never, parent?: never): unknown => Reflect.apply(create.LLMAgent, undefined, [config, parent]) },
			{ name: 'stream-structured', build: (config: never, parent?: never): unknown => Reflect.apply(create.LLMAgent.asStream, undefined, [config, parent]) },
		];
		for (const { name, build } of factories) {
			it(`rejects non-object ${name} configs before normalization or inheritance`, () => {
				const parent = create.Config({});
				for (const invalid of [undefined, null, [], 'config', 42]) {
					expect(() => build(invalid as never)).to.throw(ConfigError, 'Config must be an object.');
					expect(() => build(invalid as never, parent as never)).to.throw(ConfigError, 'Config must be an object.');
				}
			});
		}

		for (const streaming of [false, true]) {
			it(`rejects malformed inherited ${streaming ? 'streamer' : 'generator'} messages before merging`, async () => {
				const mock = model();
				const config = { model: mock, prompt: [{ role: 'user', content: 'Earlier.' } satisfies ModelMessage] };
				const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
				for (const messages of [null, {}, false, 42]) {
					expect(() => streaming ? create.LLMAgent.asStream({ prompt: messages } as never, component) : create.LLMAgent({ prompt: messages } as never, component))
						.to.throw(ConfigError, /invalid message objects/);
					await rejects(async () => await runtimeRun(component, { messageHistory: messages }), ValidationError);
				}
				expect(mock.doGenerateCalls).to.have.length(0);
				expect(mock.doStreamCalls).to.have.length(0);
			});
		}

		for (const factory of ['generate', 'stream', 'generate-structured', 'stream-structured'] as const) {
			it(`rejects non-object ${factory} run overrides before loading or rendering`, async () => {
				const mock = model();
				let loads = 0;
				const config = { model: mock, prompt: 'Input.', loader: { load: () => { loads++; return 'Input.'; } } };
				const objectConfig = { ...config, output: Output.object({ schema: z.object({}) }) };
				const components = factory === 'generate' ? [create.LLMAgent({ model: mock, prompt: 'Input.' }), create.LLMAgent.withTemplate(config), create.LLMAgent.loadsText(config)]
					: factory === 'stream' ? [create.LLMAgent.asStream({ model: mock, prompt: 'Input.' }), create.LLMAgent.withTemplate.asStream(config), create.LLMAgent.loadsText.asStream(config)]
						: factory === 'generate-structured' ? [create.LLMAgent({ model: mock, prompt: 'Input.', output: objectConfig.output }), create.LLMAgent.withTemplate(objectConfig), create.LLMAgent.loadsText(objectConfig)]
							: [create.LLMAgent.asStream({ model: mock, prompt: 'Input.', output: objectConfig.output }), create.LLMAgent.withTemplate.asStream(objectConfig), create.LLMAgent.loadsText.asStream(objectConfig)];
				for (const component of components) {
					for (const invalid of [null, [], 'config', 42]) {
						await rejects(async () => await runtimeRun(component, invalid as never), ValidationError);
					}
				}
				expect(loads).to.equal(0);
				expect(mock.doGenerateCalls).to.have.length(0);
				expect(mock.doStreamCalls).to.have.length(0);
			});
		}
	});

	describe('required schema values', () => {
		for (const output of [Output.object({ schema: z.object({ value: z.number() }) }), Output.array({ element: z.number() })]) {
			for (const streaming of [false, true]) {
				it(`rejects retired schema fields with native ${output.name} output, streaming=${streaming}`, () => {
					const parent = create.Config({ model: model(), output });
					for (const schema of [undefined, null]) {
						expect(() => streaming ? create.LLMAgent.asStream({ schema } as never, parent) : create.LLMAgent({ schema } as never, parent))
							.to.throw(ConfigError, /schema/);
					}
				});
			}
		}

		it('rejects cleared input schemas in every tool factory', () => {
			const parent = create.Config({ inputSchema: z.object({}) });
			for (const inputSchema of [undefined, null]) {
				const builds = [
					() => create.Function.asTool({ inputSchema, execute: () => 'DONE' } as never, parent),
					() => create.Template.asTool({ inputSchema, template: 'DONE' } as never, parent),
					() => create.Script.asTool({ inputSchema, script: 'return "DONE"' } as never, parent),
					() => create.LLMAgent.withTemplate.asTool({ inputSchema, model: model(), prompt: 'Input.' } as never, parent),
					() => create.LLMAgent.withTemplate.asTool({ inputSchema, model: model(), output: Output.object({ schema: z.object({}) }), prompt: 'Input.' } as never, parent),
				];
				for (const build of builds) expect(build).to.throw(ConfigError, /inputSchema/);
			}
		});

		it('rejects cleared sources in renderer tool factories', () => {
			const inputSchema = z.object({});
			for (const source of [undefined, null]) {
				const builds = [
					() => create.Template.asTool({ template: source, inputSchema } as never),
					() => create.Script.asTool({ script: source, inputSchema } as never),
					() => create.LLMAgent.withTemplate.asTool({ prompt: source, inputSchema, model: model() } as never),
					() => create.LLMAgent.withTemplate.asTool({ prompt: source, inputSchema, model: model(), output: Output.object({ schema: z.object({}) }) } as never),
				];
				for (const build of builds) expect(build).to.throw(ConfigError, /required property|configured prompt|source must be a string/);
			}
		});
	});

	describe('empty call-time history', () => {
		for (const factory of ['generate', 'stream', 'generate-structured', 'stream-structured'] as const) {
			for (const loaded of [false, true]) {
				it(`retains configured messages in ${loaded ? 'loaded' : 'plain'} ${factory} calls with empty history`, async () => {
					const mock = model('{}');
					const messages: ModelMessage[] = [{ role: 'user', content: 'Configured input.' }];
					const config = { model: mock, prompt: messages };
					const loadedConfig = { ...config, prompt: 'source', loader: { load: () => 'Configured input.' } };
					const component = factory === 'generate' ? loaded ? create.LLMAgent.loadsText(loadedConfig) : create.LLMAgent(config)
						: factory === 'stream' ? loaded ? create.LLMAgent.loadsText.asStream(loadedConfig) : create.LLMAgent.asStream(config)
							: factory === 'generate-structured' ? loaded ? create.LLMAgent.loadsText({ ...loadedConfig, output: Output.json() }) : create.LLMAgent({ ...config, output: Output.json() })
								: loaded ? create.LLMAgent.loadsText.asStream({ ...loadedConfig, output: Output.json() }) : create.LLMAgent.asStream({ ...config, output: Output.json() });
					const result = await runtimeRun(component, { messageHistory: [] });
					if ('textStream' in result) for await (const _part of result.textStream) { /* drain */ }
					if ('partialOutputStream' in result) for await (const _part of result.partialOutputStream) { /* drain */ }
					const calls = factory.startsWith('stream') ? mock.doStreamCalls : mock.doGenerateCalls;
					expect(calls).to.have.length(1);
					expect(calls[0].prompt.map(message => message.content)).to.deep.equal([[{ type: 'text', text: 'Configured input.' }]]);
				});
			}
		}

		for (const streaming of [false, true]) {
			it(`uses an empty replacement rather than the configured message prompt for ${streaming ? 'streams' : 'generators'}`, async () => {
				const mock = model();
				const prompt: ModelMessage[] = [{ role: 'user', content: 'Configured input.' }];
				const component = streaming ? create.LLMAgent.asStream({ model: mock, prompt }) : create.LLMAgent({ model: mock, prompt });
				const call: (prompt: string) => ReturnType<typeof component> = component;
				const result = await call('');
				await result.messageHistory;
				const calls = streaming ? mock.doStreamCalls : mock.doGenerateCalls;
				expect(calls).to.have.length(1);
				expect(calls[0].prompt.map(({ role, content }) => ({ role, content }))).to.deep.equal([{ role: 'user', content: [{ type: 'text', text: '' }] }]);
			});
		}
	});

	describe('sequential text loaders', () => {
		for (const factory of ['generate', 'stream', 'generate-structured', 'stream-structured'] as const) {
			for (const run of [false, true]) {
				for (const outcome of ['miss', 'throw', 'reject'] as const) {
					it(`${factory}.loadsText ${run ? 'run' : 'call'} ${outcome === 'miss' ? 'falls back after a miss' : `propagates a loader ${outcome} without fallback`}`, async () => {
						const mock = model('{"n":1}');
						const failure = new Error('Loader error');
						const loads: string[] = [];
						const loader = [
							{ load: () => {
								loads.push('first');
								if (outcome === 'throw') throw failure;
								return outcome === 'reject' ? Promise.reject(failure) : null;
							} },
							{ load: () => { loads.push('fallback'); return 'Input.'; } },
						];
						const config = { model: mock, loader, prompt: 'input.txt' };
						const objectConfig = { ...config, output: Output.object({ schema: z.object({ n: z.number() }) }) };
						const component = factory === 'generate' ? create.LLMAgent.loadsText(config)
							: factory === 'stream' ? create.LLMAgent.loadsText.asStream(config)
								: factory === 'generate-structured' ? create.LLMAgent.loadsText(objectConfig)
									: create.LLMAgent.loadsText.asStream(objectConfig);
						const invoke = () => run ? runtimeRun(component, { prompt: 'input.txt' }) : component();
						if (outcome === 'miss') {
							const result = await invoke();
							if ('partialOutputStream' in result) for await (const _part of result.partialOutputStream) { /* Native object streams require consumption. */ }
							expect(await ('object' in result ? result.value : result.output)).to.deep.equal(factory.endsWith('-structured') ? { n: 1 } : '{"n":1}');
							const calls = factory.startsWith('stream') ? mock.doStreamCalls : mock.doGenerateCalls;
							expect(calls).to.have.length(1);
							expect(calls[0].prompt[0].content).to.deep.equal([{ type: 'text', text: 'Input.' }]);
						} else {
							await rejects(invoke, error => error === failure);
							expect(mock.doGenerateCalls).to.have.length(0);
							expect(mock.doStreamCalls).to.have.length(0);
						}
						// A failure must not be mistaken for a missing source.
						expect(loads).to.deep.equal(outcome === 'miss' ? ['first', 'fallback'] : ['first']);
					});
				}
			}
		}
	});

	describe('conversation snapshots', () => {
		for (const factory of ['generate', 'stream', 'generate-structured', 'stream-structured'] as const) {
			for (const modifier of ['withTemplate', 'withScript', 'withFunction', 'loadsTemplate', 'loadsScript'] as const) {
				it(`snapshots ${factory}.${modifier} run prompt before asynchronous validation`, async () => {
					let release!: () => void;
					const gate = new Promise<void>(resolve => { release = resolve; });
					const inputSchema = jsonSchema<Record<string, unknown>>({ type: 'object' }, {
						validate: async input => { await gate; return { success: true, value: input as Record<string, unknown> }; },
					});
					const mock = model('{"answer":4}');
					// This runtime matrix intentionally erases the different factory signatures.
					const factoryValue: unknown = factory.startsWith('stream') ? create.LLMAgent[modifier].asStream : create.LLMAgent[modifier];
					const build = factoryValue as (config: object) => {
						run(config: { prompt: string | (() => string), context: object }): Promise<{
							messageHistory?: ModelMessage[] | Promise<ModelMessage[]>;
							partialOutputStream?: AsyncIterable<unknown>;
							value: unknown;
						}>;
					};
					const prompt = (word: string) => modifier === 'withFunction' ? () => word
						: modifier === 'withScript' ? `return "${word}"` : word;
					const component = build({ model: mock, inputSchema, prompt: prompt('configured'),
						...(factory.endsWith('-structured') && { output: Output.object({ schema: z.object({ answer: z.number() }) }) }),
						...(modifier.startsWith('loads') && { loader: { load: (name: string) => modifier === 'loadsScript' ? `return "${name}"` : name } }),
					});
					const settings = { prompt: prompt('first'), context: {} };
					const pending = runtimeRun(component, settings);
					settings.prompt = prompt('second');
					release();
					const result = await pending;
					const stream = result.partialOutputStream;
					if (stream) for await (const _part of stream) { /* drain */ }
					if (result.messageHistory) await result.messageHistory;
					await result.value;
					const request = factory.startsWith('stream') ? mock.doStreamCalls[0] : mock.doGenerateCalls[0];
					expect(request.prompt.map(message => message.content)).to.deep.equal([[{ type: 'text', text: 'first' }]]);
				});
			}
		}

		for (const factory of ['generate', 'stream', 'generate-structured', 'stream-structured'] as const) {
			it(`snapshots ${factory}.run() history before preparation without configured messages`, async () => {
				const history: ModelMessage[] = [{ role: 'user', content: 'Earlier.' }];
				const original = [...history];
				let release!: () => void;
				const gate = new Promise<void>(resolve => { release = resolve; });
				const mock = model('{"answer":4}');
				const config = { model: mock, prompt: async () => { await gate; return 'Input.'; } };
				const schema = z.object({ answer: z.number() });
				const component = factory === 'generate' ? create.LLMAgent.withFunction(config)
					: factory === 'stream' ? create.LLMAgent.withFunction.asStream(config)
						: factory === 'generate-structured' ? create.LLMAgent.withFunction({ ...config, output: Output.object({ schema: schema }) })
							: create.LLMAgent.withFunction.asStream({ ...config, output: Output.object({ schema: schema }) });
				const pending = runtimeRun(component, { messageHistory: history });
				history.splice(0, history.length, { role: 'user', content: 'Changed after invocation.' });
				release();
				const result = await pending;
				if ('partialOutputStream' in result) for await (const _part of result.partialOutputStream) { /* drain */ }
				if ('messageHistory' in result) await result.messageHistory;
				await result.value;
				const request = factory.startsWith('stream') ? mock.doStreamCalls[0] : mock.doGenerateCalls[0];
				expect(request.prompt.map(message => message.content)).to.deep.equal([
					[{ type: 'text', text: 'Earlier.' }], [{ type: 'text', text: 'Input.' }],
				]);
				if ('messageHistory' in result) expect(await result.messageHistory).to.deep.equal([
					...original, { role: 'user', content: 'Input.' }, ...await result.responseMessages,
				]);
				expect(history).to.deep.equal([{ role: 'user', content: 'Changed after invocation.' }]);
			});
		}

		for (const streaming of [false, true]) {
			for (const renderer of ['template', 'script', 'loaded-text']) {
				for (const entry of ['call', 'call-with-source', 'run']) {
					it(`snapshots history at ${renderer} ${entry} entry for ${streaming ? 'streams' : 'generators'}`, async () => {
						const history: ModelMessage[] = [{ role: 'user', content: 'Earlier.' }];
						const original = [...history];
						const mock = model();
						const config = { model: mock, instructions: 'Configured.' };
						const component = renderer === 'template'
							? streaming ? create.LLMAgent.withTemplate.asStream({ ...config, prompt: 'Input.' }) : create.LLMAgent.withTemplate({ ...config, prompt: 'Input.' })
							: renderer === 'script'
								? streaming ? create.LLMAgent.withScript.asStream({ ...config, prompt: 'return "Input."' }) : create.LLMAgent.withScript({ ...config, prompt: 'return "Input."' })
								: streaming ? create.LLMAgent.loadsText.asStream({ ...config, prompt: 'source', loader: { load: async () => 'Input.' } }) : create.LLMAgent.loadsText({ ...config, prompt: 'source', loader: { load: async () => 'Input.' } });
						const invoke: (sourceOrContext: object | string, history: ModelMessage[]) => ReturnType<typeof component> = component;
						const source = renderer === 'script' ? 'return "Input."' : renderer === 'template' ? 'Input.' : 'source';
						const pending = entry === 'call' ? invoke({}, history)
							: entry === 'call-with-source' ? invoke(source, history) : runtimeRun(component, { messageHistory: history });
						history.splice(0, history.length, { role: 'user', content: 'Changed after invocation.' });
						const result = await pending;
						await result.text;
						const request = streaming ? mock.doStreamCalls[0] : mock.doGenerateCalls[0];
						expect(request.prompt.map(message => message.content)).to.deep.equal([
							'Configured.', [{ type: 'text', text: 'Earlier.' }], [{ type: 'text', text: 'Input.' }],
						]);
						expect(await result.messageHistory).to.deep.equal([...original, { role: 'user', content: 'Input.' }, ...await result.responseMessages]);
					});
				}
			}

			for (const loaded of [false, true]) {
				it(`includes empty ${loaded ? 'loaded' : 'rendered'} prompts in ${streaming ? 'streamed' : 'generated'} history when submitted to the SDK`, async () => {
					const mock = model();
					const component = loaded
						? streaming ? create.LLMAgent.loadsText.asStream({ model: mock, prompt: 'empty', loader: { load: () => '' } }) : create.LLMAgent.loadsText({ model: mock, prompt: 'empty', loader: { load: () => '' } })
						: streaming ? create.LLMAgent.withFunction.asStream({ model: mock, prompt: () => '' }) : create.LLMAgent.withFunction({ model: mock, prompt: () => '' });
					const call: () => ReturnType<typeof component> = component;
					const result = await call();
					await result.text;
					const response = await result.response;
					expect(response.messages).to.deep.equal(await result.responseMessages);
					expect(await result.messageHistory).to.deep.equal([{ role: 'user', content: '' }, ...response.messages]);
				});
			}
			it(`keeps ${streaming ? 'streamed' : 'generated'} history consistent with the submitted request`, async () => {
				const history: ModelMessage[] = [{ role: 'user', content: 'Earlier.' }];
				const originalHistory = [...history];
				const component = streaming ? create.LLMAgent.asStream({ model: model() }) : create.LLMAgent({ model: model() });
				const call: (prompt: string, history: ModelMessage[]) => ReturnType<typeof component> = component;
				const result = await call('Input.', history);
				await result.text;
				history.push({ role: 'assistant', content: 'Added after the request.' });
				const response = await result.response;
				expect(await result.messageHistory).to.deep.equal([...originalHistory, { role: 'user', content: 'Input.' }, ...response.messages]);
			});

			it(`snapshots function-returned messages for ${streaming ? 'streamed' : 'generated'} response metadata`, async () => {
				const prompt: ModelMessage[] = [{ role: 'user', content: 'Input.' }];
				const originalPrompt = [...prompt];
				const config = { model: model(), prompt: () => prompt };
				const component = streaming ? create.LLMAgent.withFunction.asStream(config) : create.LLMAgent.withFunction(config);
				const result = await component();
				await result.text;
				prompt.push({ role: 'user', content: 'Added after the request.' });
				expect(await result.messageHistory).to.deep.equal([...originalPrompt, ...(await result.responseMessages)]);
			});

			it(`snapshots configured message prompts for ${streaming ? 'streamed' : 'generated'} response metadata`, async () => {
				const prompt: ModelMessage[] = [{ role: 'user', content: 'Input.' }];
				const originalPrompt = [...prompt];
				const config = { model: model(), prompt };
				const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
				const result = await component();
				await result.text;
				prompt.push({ role: 'user', content: 'Added after the request.' });
				expect(await result.messageHistory).to.deep.equal([...originalPrompt, ...(await result.responseMessages)]);
			});

			it(`keeps ${streaming ? 'streamed' : 'generated'} history consistent while an async prompt is pending`, async () => {
				let entered!: () => void;
				let release!: () => void;
				const started = new Promise<void>(resolve => { entered = resolve; });
				const waiting = new Promise<void>(resolve => { release = resolve; });
				const history: ModelMessage[] = [{ role: 'user', content: 'Earlier.' }];
				const mock = model();
				const config = {
					model: mock, instructions: 'Configured.',
					prompt: async () => { entered(); await waiting; return 'Input.'; },
				};
				const component = streaming ? create.LLMAgent.withFunction.asStream(config) : create.LLMAgent.withFunction(config);
				const pending = runtimeRun(component, { messageHistory: history });
				await started;
				history.push({ role: 'assistant', content: 'Added while rendering.' });
				release();
				const result = await pending;
				await result.text;
				const call = streaming ? mock.doStreamCalls[0] : mock.doGenerateCalls[0];
				const submitted = call.prompt.slice(1).map(({ role, content }) => ({
					role, content: typeof content === 'string' ? content : content.map(part => part.type === 'text' ? part.text : '').join(''),
				}));
				expect(await result.messageHistory).to.deep.equal([...submitted, ...(await result.responseMessages)]);
			});
		}

		it('keeps callback responses native while snapshotting dynamic history', async () => {
			const history: ModelMessage[] = [{ role: 'user', content: 'Earlier.' }];
			const originalHistory = [...history];
			let callbackResponse: { messages: ModelMessage[] } | undefined;
			const component = create.LLMAgent.asStream({ model: model(), onEnd: event => { callbackResponse = event.response; } });
			const result = (await component('Input.', history));
			await result.text;
			history.length = 0;
			const response = await result.response;
			expect(callbackResponse?.messages).to.deep.equal(response.messages);
			expect(callbackResponse).not.to.have.property('messageHistory');
			expect(await result.messageHistory).to.deep.equal([...originalHistory, { role: 'user', content: 'Input.' }, ...response.messages]);
		});
	});
});
