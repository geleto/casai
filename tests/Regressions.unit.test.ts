/* eslint-disable no-constant-condition -- Unreachable branches verify compile-time errors. */
import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { ModelMessage } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { create, ConfigError, race, z } from './cascada';

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
	const parent = create.Config({ model: model(), schema: z.object({}) });
	// @ts-expect-error Explicit undefined removes the required output schema.
	create.ObjectGenerator({ schema: undefined }, parent);
	// @ts-expect-error An array stream also requires a defined output schema.
	create.ObjectStreamer({ schema: undefined, output: 'array' }, parent);
	// @ts-expect-error A tool must expose a defined input schema to the SDK.
	create.Template.asTool({ template: 'Input.', inputSchema: undefined });
	// @ts-expect-error A script tool must expose a defined input schema to the SDK.
	create.Script.asTool({ script: 'return 1', inputSchema: undefined });
	// @ts-expect-error A text tool must expose a defined input schema to the SDK.
	create.TextGenerator.withTemplate.asTool({ model: model(), prompt: 'Input.', inputSchema: undefined });
	// @ts-expect-error An object tool must expose a defined input schema to the SDK.
	create.ObjectGenerator.withTemplate.asTool({ prompt: 'Input.', inputSchema: undefined }, parent);
}

describe('Regressions across component boundaries', () => {
	describe('raw configuration validation', () => {
		const factories = [
			{ name: 'Function', build: (config: never, parent?: never) => create.Function(config, parent) },
			{ name: 'Template', build: (config: never, parent?: never) => create.Template(config, parent as never) },
			{ name: 'Script', build: (config: never, parent?: never) => create.Script(config, parent as never) },
			{ name: 'TextGenerator', build: (config: never, parent?: never) => create.TextGenerator(config, parent as never) },
			{ name: 'TextStreamer', build: (config: never, parent?: never) => create.TextStreamer(config, parent as never) },
			{ name: 'ObjectGenerator', build: (config: never, parent?: never) => create.ObjectGenerator(config, parent as never) },
			{ name: 'ObjectStreamer', build: (config: never, parent?: never) => create.ObjectStreamer(config, parent as never) },
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
				const config = { model: mock, prompt: 'Input.', messages: [{ role: 'user', content: 'Earlier.' } satisfies ModelMessage] };
				const component = streaming ? create.TextStreamer(config) : create.TextGenerator(config);
				for (const messages of [null, {}, false, 42]) {
					expect(() => streaming ? create.TextStreamer({ messages } as never, component) : create.TextGenerator({ messages } as never, component))
						.to.throw(ConfigError, /invalid message objects/);
					await rejects(async () => await component.run({ messages } as never), ConfigError);
				}
				expect(mock.doGenerateCalls).to.have.length(0);
				expect(mock.doStreamCalls).to.have.length(0);
			});
		}

		for (const factory of ['TextGenerator', 'TextStreamer', 'ObjectGenerator', 'ObjectStreamer'] as const) {
			it(`rejects non-object ${factory} run overrides before loading or rendering`, async () => {
				const mock = model();
				let loads = 0;
				const config = { model: mock, prompt: 'Input.', loader: { load: () => { loads++; return 'Input.'; } } };
				const objectConfig = { ...config, schema: z.object({}) };
				const components = factory === 'TextGenerator' ? [create.TextGenerator({ model: mock, prompt: 'Input.' }), create.TextGenerator.withTemplate(config), create.TextGenerator.loadsText(config)]
					: factory === 'TextStreamer' ? [create.TextStreamer({ model: mock, prompt: 'Input.' }), create.TextStreamer.withTemplate(config), create.TextStreamer.loadsText(config)]
						: factory === 'ObjectGenerator' ? [create.ObjectGenerator({ model: mock, prompt: 'Input.', schema: objectConfig.schema }), create.ObjectGenerator.withTemplate(objectConfig), create.ObjectGenerator.loadsText(objectConfig)]
							: [create.ObjectStreamer({ model: mock, prompt: 'Input.', schema: objectConfig.schema }), create.ObjectStreamer.withTemplate(objectConfig), create.ObjectStreamer.loadsText(objectConfig)];
				for (const component of components) {
					for (const invalid of [undefined, null, [], 'config', 42]) {
						await rejects(async () => await component.run(invalid as never), ConfigError);
					}
				}
				expect(loads).to.equal(0);
				expect(mock.doGenerateCalls).to.have.length(0);
				expect(mock.doStreamCalls).to.have.length(0);
			});
		}
	});

	describe('required schema values', () => {
		for (const output of ['object', 'array'] as const) {
			for (const streaming of [false, true]) {
				it(`rejects cleared schemas for ${output} ${streaming ? 'streams' : 'generators'} at creation`, () => {
					const parent = create.Config({ model: model(), schema: z.object({ value: z.number() }) });
					for (const schema of [undefined, null]) {
						expect(() => streaming ? create.ObjectStreamer({ schema, output } as never, parent) : create.ObjectGenerator({ schema, output } as never, parent))
							.to.throw(ConfigError, /requires a 'schema'/);
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
					() => create.TextGenerator.withTemplate.asTool({ inputSchema, model: model(), prompt: 'Input.' } as never, parent),
					() => create.ObjectGenerator.withTemplate.asTool({ inputSchema, model: model(), schema: z.object({}), prompt: 'Input.' } as never, parent),
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
					() => create.TextGenerator.withTemplate.asTool({ prompt: source, inputSchema, model: model() } as never),
					() => create.ObjectGenerator.withTemplate.asTool({ prompt: source, inputSchema, model: model(), schema: z.object({}) } as never),
				];
				for (const build of builds) expect(build).to.throw(ConfigError, /required property/);
			}
		});
	});

	describe('empty call-time history', () => {
		for (const factory of ['TextGenerator', 'TextStreamer', 'ObjectGenerator', 'ObjectStreamer'] as const) {
			for (const loaded of [false, true]) {
				it(`retains configured messages in ${loaded ? 'loaded' : 'plain'} ${factory} calls with empty history`, async () => {
					const mock = model('{}');
					const messages: ModelMessage[] = [{ role: 'user', content: 'Configured input.' }];
					const config = { model: mock, messages };
					const loadedConfig = { ...config, loader: { load: () => 'Input.' } };
					const component = factory === 'TextGenerator' ? loaded ? create.TextGenerator.loadsText(loadedConfig) : create.TextGenerator(config)
						: factory === 'TextStreamer' ? loaded ? create.TextStreamer.loadsText(loadedConfig) : create.TextStreamer(config)
							: factory === 'ObjectGenerator' ? loaded ? create.ObjectGenerator.loadsText({ ...loadedConfig, output: 'no-schema' }) : create.ObjectGenerator({ ...config, output: 'no-schema' })
								: loaded ? create.ObjectStreamer.loadsText({ ...loadedConfig, output: 'no-schema' }) : create.ObjectStreamer({ ...config, output: 'no-schema' });
					const result = await component([]);
					if ('textStream' in result) for await (const _part of result.textStream) { /* drain */ }
					if ('partialObjectStream' in result) for await (const _part of result.partialObjectStream) { /* drain */ }
					const calls = factory.endsWith('Streamer') ? mock.doStreamCalls : mock.doGenerateCalls;
					expect(calls).to.have.length(1);
					expect(calls[0].prompt.map(message => message.content)).to.deep.equal([[{ type: 'text', text: 'Configured input.' }]]);
				});
			}
		}

		for (const streaming of [false, true]) {
			it(`validates the replacement rather than the configured message prompt for ${streaming ? 'streams' : 'generators'}`, async () => {
				const mock = model();
				const prompt: ModelMessage[] = [{ role: 'user', content: 'Configured input.' }];
				const component = streaming ? create.TextStreamer({ model: mock, prompt }) : create.TextGenerator({ model: mock, prompt });
				await rejects(async () => await component(''), ConfigError);
				expect(mock.doGenerateCalls).to.have.length(0);
				expect(mock.doStreamCalls).to.have.length(0);
			});
		}
	});

	describe('processed loader groups', () => {
		for (const named of [false, true]) {
			it(`deduplicates inherited ${named ? 'named' : 'anonymous'} racers against child loaders`, async () => {
				const calls: string[] = [];
				const first = { load: () => { calls.push('first'); return null; } };
				const second = { load: () => { calls.push('second'); return null; } };
				const parent = create.Config({ loader: race([first, second], named ? 'remote' : undefined) });
				const child = create.Config({ loader: first }, parent);
				const component = create.TextGenerator.loadsText({ model: model(), prompt: 'missing' }, child);
				await rejects(() => component(), /Failed to load prompt/);
				expect(calls).to.deep.equal(['first', 'second']);
			});

			it(`reuses unchanged ${named ? 'named' : 'anonymous'} race loaders across calls`, async () => {
				const source = Object.assign(new EventEmitter(), { load: () => 'Input.' });
				const other = { load: () => null };
				const parent = create.Config({ loader: race([source, other], named ? 'remote' : undefined) });
				const component = create.TextGenerator.loadsText({ model: model(), prompt: 'input' }, parent);
				const subscriptions = source.listenerCount('update');
				for (let call = 0; call < 3; call++) await component();
				expect(source.listenerCount('update')).to.equal(subscriptions);
			});
		}

		it('preserves anonymous race membership across several levels of partial deduplication', async () => {
			const calls: string[] = [];
			const member = (name: string) => ({ load: () => { calls.push(name); return null; } });
			const first = member('first');
			const second = member('second');
			const third = member('third');
			const parent = create.Config({ loader: race([first, second, third]) });
			const child = create.Config({ loader: first }, parent);
			const grandchild = create.Config({ loader: second }, child);
			const component = create.TextGenerator.loadsText({ model: model(), prompt: 'missing' }, grandchild);
			await rejects(() => component(), /Failed to load prompt/);
			expect(calls).to.deep.equal(['second', 'first', 'third']);
		});
	});

	describe('conversation snapshots', () => {
		for (const streaming of [false, true]) {
			for (const loaded of [false, true]) {
				it(`includes empty ${loaded ? 'loaded' : 'rendered'} prompts in ${streaming ? 'streamed' : 'generated'} history when submitted to the SDK`, async () => {
					const mock = model();
					const component = loaded
						? streaming ? create.TextStreamer.loadsText({ model: mock, prompt: 'empty', loader: { load: () => '' } }) : create.TextGenerator.loadsText({ model: mock, prompt: 'empty', loader: { load: () => '' } })
						: streaming ? create.TextStreamer.withFunction({ model: mock, prompt: () => '' }) : create.TextGenerator.withFunction({ model: mock, prompt: () => '' });
					const call: () => ReturnType<typeof component> = component;
					const result = await call();
					await result.text;
					const response = await result.response;
					expect(response.messages).to.deep.equal([{ role: 'user', content: '' }, ...(await result.responseMessages)]);
					expect(response.messageHistory).to.deep.equal(response.messages);
				});
			}
			it(`keeps ${streaming ? 'streamed' : 'generated'} history consistent with the submitted request`, async () => {
				const history: ModelMessage[] = [{ role: 'user', content: 'Earlier.' }];
				const originalHistory = [...history];
				const component = streaming ? create.TextStreamer({ model: model() }) : create.TextGenerator({ model: model() });
				const result = await component('Input.', history);
				await result.text;
				history.push({ role: 'assistant', content: 'Added after the request.' });
				const response = await result.response;
				expect(response.messageHistory).to.deep.equal([...originalHistory, ...response.messages]);
			});

			it(`snapshots function-returned messages for ${streaming ? 'streamed' : 'generated'} response metadata`, async () => {
				const prompt: ModelMessage[] = [{ role: 'user', content: 'Input.' }];
				const originalPrompt = [...prompt];
				const config = { model: model(), prompt: () => prompt };
				const component = streaming ? create.TextStreamer.withFunction(config) : create.TextGenerator.withFunction(config);
				const result = await component();
				await result.text;
				prompt.push({ role: 'user', content: 'Added after the request.' });
				expect((await result.response).messages).to.deep.equal([...originalPrompt, ...(await result.responseMessages)]);
			});

			it(`snapshots configured message prompts for ${streaming ? 'streamed' : 'generated'} response metadata`, async () => {
				const prompt: ModelMessage[] = [{ role: 'user', content: 'Input.' }];
				const originalPrompt = [...prompt];
				const config = { model: model(), prompt };
				const component = streaming ? create.TextStreamer(config) : create.TextGenerator(config);
				const result = await component();
				await result.text;
				prompt.push({ role: 'user', content: 'Added after the request.' });
				expect((await result.response).messages).to.deep.equal([...originalPrompt, ...(await result.responseMessages)]);
			});

			it(`keeps ${streaming ? 'streamed' : 'generated'} history consistent while an async prompt is pending`, async () => {
				let entered!: () => void;
				let release!: () => void;
				const started = new Promise<void>(resolve => { entered = resolve; });
				const waiting = new Promise<void>(resolve => { release = resolve; });
				const history: ModelMessage[] = [{ role: 'user', content: 'Earlier.' }];
				const mock = model();
				const config = {
					model: mock, messages: [{ role: 'user', content: 'Configured.' } satisfies ModelMessage],
					prompt: async () => { entered(); await waiting; return 'Input.'; },
				};
				const component = streaming ? create.TextStreamer.withFunction(config) : create.TextGenerator.withFunction(config);
				const pending = component.run({ messages: history });
				await started;
				history.push({ role: 'assistant', content: 'Added while rendering.' });
				release();
				const result = await pending;
				await result.text;
				const call = streaming ? mock.doStreamCalls[0] : mock.doGenerateCalls[0];
				const submitted = call.prompt.slice(1).map(({ role, content }) => ({
					role, content: typeof content === 'string' ? content : content.map(part => part.type === 'text' ? part.text : '').join(''),
				}));
				expect((await result.response).messageHistory).to.deep.equal([...submitted, ...(await result.responseMessages)]);
			});
		}

		it('keeps saved stream callback history consistent with the returned response', async () => {
			const history: ModelMessage[] = [{ role: 'user', content: 'Earlier.' }];
			const originalHistory = [...history];
			let callbackResponse: { messages: ModelMessage[], messageHistory: ModelMessage[] } | undefined;
			const component = create.TextStreamer({ model: model(), onEnd: event => { callbackResponse = event.response; } });
			const result = component('Input.', history);
			await result.text;
			history.length = 0;
			const response = await result.response;
			expect(callbackResponse?.messageHistory).to.deep.equal([...originalHistory, ...response.messages]);
			expect(response.messageHistory).to.deep.equal(callbackResponse?.messageHistory);
		});
	});
});
