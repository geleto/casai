/* eslint-disable no-constant-condition -- Unreachable branches verify compile-time errors. */
import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { ModelMessage } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { create, ConfigError, ScriptError, TemplateError, race, z } from './cascada';

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
	const streamed = result as { partialObjectStream?: AsyncIterable<unknown>, textStream?: AsyncIterable<unknown> };
	const stream = streamed.partialObjectStream ?? streamed.textStream;
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
const factoryNames = ['TextGenerator', 'TextStreamer', 'ObjectGenerator', 'ObjectStreamer'] as const;

describe('LLM call contracts without providers', () => {
	describe('loaded templates', () => {
		for (const factoryName of factoryNames) {
			const streaming = factoryName.endsWith('Streamer');
			it(`should render loaded ${factoryName} templates with merged context and one-off names`, async () => {
				const loaded: string[] = [];
				const loader = { load: (name: string) => {
					loaded.push(name);
					return `${name}: {{ greeting }} {{ name }}`;
				} };
				const model = mockModel(answer);
				const config = { model, loader, prompt: 'default', context: { greeting: 'Hello', name: 'Configured' } };
				const component = factoryName === 'TextGenerator' ? create.TextGenerator.loadsTemplate(config)
					: factoryName === 'TextStreamer' ? create.TextStreamer.loadsTemplate(config)
						: factoryName === 'ObjectGenerator' ? create.ObjectGenerator.loadsTemplate({ ...config, schema })
							: create.ObjectStreamer.loadsTemplate({ ...config, schema });
				await settle(await component({ name: 'First' }));
				await settle(await component('other', { name: 'Second' }));
				await settle(await component.run({ prompt: 'other', context: { greeting: 'Hi' } }));
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
			const generator = create.TextGenerator.withTemplate({
				model, prompt: '{{ value }}', context: { value: '<b> & "text"' }, options: { autoescape: true },
			});
			await generator();
			expect(promptTexts(model)).to.deep.equal([['<b> & "text"']]);
		});

		it('reports malformed script prompt output as a configuration validation error', async () => {
			const model = mockModel('DONE');
			const generator = create.TextGenerator.withScript({ model, prompt: 'return [{content: "Invalid message"}]' });
			await rejects(() => generator(), (error: unknown) => error instanceof ConfigError && error.message.includes('Output validation failed'));
			expect(model.doGenerateCalls).to.have.length(0);
		});

		it('should render template prompts with the component filters, options and loader', async () => {
			const model = mockModel('DONE');
			const generator = create.TextGenerator.withTemplate({
				model,
				loader: { load: (name: string) => name === 'signature' ? '-- {{ author | upper }}' : null },
				filters: { upper: (value: string) => value.toUpperCase() },
				options: { trimBlocks: true },
				context: { author: 'ada' },
				prompt: '{% if true %}\n{{ "Summary" | upper }}{% endif %}\n{% include "signature" with context %}',
			});
			await generator();
			expect(promptTexts(model)).to.deep.equal([['SUMMARY-- ADA']]);
		});

		it('should run script prompts with the component filters and loader', async () => {
			const model = mockModel('DONE');
			const generator = create.TextGenerator.withScript({
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
			const generator = create.TextGenerator.withTemplate({ model, options: { throwOnUndefined: true }, prompt: 'Hello {{ missing }}' });
			await rejects(() => generator(), TemplateError);
			expect(model.doGenerateCalls).to.have.length(0);
		});

		it('should report a missing template or script prompt when none is configured or supplied', async () => {
			const model = mockModel('DONE');
			const template = create.TextGenerator.withTemplate({ model });
			const script = create.TextGenerator.withScript({ model });
			await rejects(() => (template as unknown as (context: object) => Promise<unknown>)({ topic: 'tests' }), (error: unknown) => {
				expect(error).to.be.instanceOf(TemplateError);
				expect((error as Error).message).to.match(/No template prompt provided/);
				return true;
			});
			await rejects(() => (script as unknown as (context: object) => Promise<unknown>)({ topic: 'tests' }), (error: unknown) => {
				expect(error).to.be.instanceOf(ScriptError);
				expect((error as Error).message).to.match(/No script provided/);
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
			const generator = create.TextGenerator.loadsText({
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
			const generator = create.TextGenerator.loadsText({ model, prompt: 'default', loader: { load: async () => {
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
				const component = factoryName === 'TextGenerator' ? create.TextGenerator.loadsText(config)
					: factoryName === 'TextStreamer' ? create.TextStreamer.loadsText(config)
						: factoryName === 'ObjectGenerator' ? create.ObjectGenerator.loadsText({ ...config, schema })
							: create.ObjectStreamer.loadsText({ ...config, schema });
				await settle(await component.run({}));
				await settle(await component.run({ prompt: 'other-empty' }));
				expect(promptTexts(model, factoryName.endsWith('Streamer'))).to.deep.equal([[''], ['']]);
			});

			it(`rejects invalid loaded-text run overrides before loading or calling ${factoryName}`, async () => {
				const model = mockModel(answer);
				const loaded: string[] = [];
				const config = { model, prompt: 'default', loader: { load: (name: string) => { loaded.push(name); return 'Configured.'; } } };
				const component = factoryName === 'TextGenerator' ? create.TextGenerator.loadsText(config)
					: factoryName === 'TextStreamer' ? create.TextStreamer.loadsText(config)
						: factoryName === 'ObjectGenerator' ? create.ObjectGenerator.loadsText({ ...config, schema })
							: create.ObjectStreamer.loadsText({ ...config, schema });
				for (const override of [
					{ prompt: null }, { prompt: 42 }, { prompt: '' },
					{ prompt: [{ role: 'user', content: 'Messages are not a resource name.' }] },
					{ messages: [{ role: 'invalid', content: 'Invalid history.' }] },
					{ context: { unused: true } },
				]) {
					await rejects(async () => { await component.run(override as never); }, ConfigError);
				}
				expect(loaded).to.deep.equal([]);
				expect(model.doGenerateCalls).to.have.length(0);
				expect(model.doStreamCalls).to.have.length(0);
			});
		}

		it('loads empty text and preserves literal template syntax', async () => {
			const model = mockModel('DONE');
			const literal = '  {{ untouched }} {% include "missing" %}\n';
			const generator = create.TextGenerator.loadsText({
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
			const first = create.TextGenerator.loadsText({ model, loader, prompt: 'name' });
			const second = create.TextGenerator.loadsText({ model, loader, prompt: 'name' });
			await first();
			value = 'Changed';
			await second();
			await first();
			expect(promptTexts(model)).to.deep.equal([['Original'], ['Changed'], ['Original']]);
		});

		it('honors noCache when loading a configured text prompt repeatedly', async () => {
			let calls = 0;
			const model = mockModel('DONE');
			const generator = create.TextGenerator.loadsText({
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
				const generator = create.TextGenerator.loadsText({
					model, prompt: 'name', loader: race([loader, { load: () => null }], groupName),
				});
				await generator();
				value = 'Changed';
				loader.emit('update', 'name');
				await generator();
				expect(promptTexts(model)).to.deep.equal([['Original'], ['Changed']]);
			});
		}

		it('should reject context arguments, which a plain-text prompt cannot use', async () => {
			const model = mockModel('DONE');
			const context = { topic: 'tests' };
			const contextError = /'context' object cannot be provided/;
			const loader = { load: () => 'Loaded.' };
			// Generators and loaded prompts return promises, so they reject.
			const pending = [
				create.TextGenerator({ model, prompt: 'Configured.' }),
				create.ObjectGenerator({ model, schema, prompt: 'Configured.' }),
				create.TextStreamer.loadsText({ model, loader, prompt: 'name' }),
			];
			for (const component of pending) {
				const call = component as unknown as (...args: unknown[]) => Promise<unknown>;
				await rejects(() => call(context), contextError);
				await rejects(() => call('Prompt.', context), contextError);
				await rejects(async () => await component.run({ context } as never), contextError);
			}
			// A plain-text streamer returns its result directly, so it throws.
			const streamer = create.TextStreamer({ model, prompt: 'Configured.' });
			const stream = streamer as unknown as (...args: unknown[]) => unknown;
			expect(() => stream(context)).to.throw(ConfigError, contextError);
			expect(() => stream('Prompt.', context)).to.throw(ConfigError, contextError);
			expect(() => streamer.run({ context } as never)).to.throw(ConfigError, contextError);
			expect(model.doGenerateCalls).to.have.length(0);
			expect(model.doStreamCalls).to.have.length(0);
			if (false) {
				// @ts-expect-error Plain-text components accept a prompt and messages, not context.
				void create.TextGenerator({ model, prompt: 'Configured.' })(context);
				// @ts-expect-error A plain-text run has no context to render.
				void create.TextGenerator({ model, prompt: 'Configured.' }).run({ context });
			}
		});

		it('should validate call-time and run-time messages before calling the model', async () => {
			const model = mockModel('DONE');
			const invalid = [{ role: 'user', content: 42 }] as unknown as ModelMessage[];
			const messageError = /invalid message objects/;
			const text = create.TextGenerator({ model, prompt: 'Configured.' });
			const streamer = create.TextStreamer({ model, prompt: 'Configured.' });
			const template = create.TextGenerator.withTemplate({ model, prompt: 'Configured.' });
			const loaded = create.TextGenerator.loadsText({ model, loader: { load: () => 'Loaded.' }, prompt: 'name' });
			for (const reject of [
				() => text(invalid), () => text.run({ messages: invalid }),
				() => template('Prompt.', invalid), () => template.run({ messages: invalid }),
				() => loaded.run({ messages: invalid }),
			]) {
				await rejects(reject, (error: unknown) => error instanceof ConfigError && error.message.includes('invalid message objects'));
			}
			expect(() => streamer('Prompt.', invalid)).to.throw(ConfigError, messageError);
			expect(() => streamer.run({ messages: invalid })).to.throw(ConfigError, messageError);
			expect(model.doGenerateCalls).to.have.length(0);
			expect(model.doStreamCalls).to.have.length(0);
		});

		it('should reject a loaded text prompt that is not a name', async () => {
			const model = mockModel('DONE');
			const loader = { load: (name: string) => `Loaded ${name}.` };
			const prompt: ModelMessage[] = [{ role: 'user', content: 'Array.' }];
			expect(() => create.TextGenerator.loadsText({ model, loader, prompt } as never)).to.throw(ConfigError, /must be the name of the prompt/);
			expect(() => create.ObjectStreamer.loadsText({ model, schema, loader, prompt } as never)).to.throw(ConfigError, /must be the name of the prompt/);
			const generator = create.TextGenerator.loadsText({ model, loader, prompt: 'name' });
			await rejects(async () => await generator.run({ prompt } as never), (error: unknown) => error instanceof ConfigError && error.message.includes('must be the name of the prompt'));
			expect(model.doGenerateCalls).to.have.length(0);
			await generator.run({ prompt: 'other' });
			expect(promptTexts(model)).to.deep.equal([['Loaded other.']]);
			if (false) {
				// @ts-expect-error A loaded text prompt is a name, not messages.
				create.TextGenerator.loadsText({ model, loader, prompt });
				// @ts-expect-error A run-time loaded text prompt is a name, not messages.
				void generator.run({ prompt });
			}
		});

		it('should return plain-text streams directly and rendered or loaded streams as promises', async () => {
			const model = mockModel('DONE');
			const text = create.TextStreamer({ model, prompt: 'Inline.' });
			const direct = text();
			expect(direct).not.to.be.instanceOf(Promise);
			expect((await collect(direct.textStream)).join('')).to.equal('DONE');
			const run = text.run({ prompt: 'Run.' });
			expect(run).not.to.be.instanceOf(Promise);
			expect((await collect(run.textStream)).join('')).to.equal('DONE');
			const objects = create.ObjectStreamer({ model: mockModel(answer), schema, prompt: 'Inline.' })();
			expect(objects).not.to.be.instanceOf(Promise);
			expect(await collect(objects.partialObjectStream)).to.deep.include({ answer: 4 });

			const rendered: (() => Promise<{ textStream: AsyncIterable<string> }>)[] = [
				create.TextStreamer.withTemplate({ model, prompt: 'Hello {{ name }}', context: { name: 'Ada' } }),
				create.TextStreamer.withScript({ model, prompt: 'return "Hello " ~ name', context: { name: 'Ada' } }),
				create.TextStreamer.withFunction({ model, prompt: () => 'Hello Ada' }),
				create.TextStreamer.loadsText({ model, prompt: 'greeting', loader: { load: () => 'Hello Ada' } }),
			];
			for (const component of rendered) {
				const pending = component();
				expect(pending).to.be.instanceOf(Promise);
				expect((await collect((await pending).textStream)).join('')).to.equal('DONE');
			}
			expect(promptTexts(model, true)).to.deep.equal([['Inline.'], ['Run.'], ['Hello Ada'], ['Hello Ada'], ['Hello Ada'], ['Hello Ada']]);
			if (false) {
				// Rendered and loaded streamers resolve their prompt before they can stream.
				const _rendered: Promise<{ textStream: AsyncIterable<string> }> = create.TextStreamer.withTemplate({ model, prompt: 'Hello' })();
				const _loaded: Promise<{ textStream: AsyncIterable<string> }> = create.TextStreamer.loadsText({ model, prompt: 'greeting', loader: { load: () => 'Hello' } })();
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
				const messages: ModelMessage[] = [{ role: 'user', content: 'Configured.' }];
				const component = streaming ? create.TextStreamer.loadsText({ model, loader, messages }) : create.TextGenerator.loadsText({ model, loader, messages });
				await settle(await component());
				await settle(await component([{ role: 'assistant', content: 'Earlier.' }]));
				await settle(await component('named'));
				const response = await (await component.run({ messages: [{ role: 'user', content: 'Run.' }] })).response;
				expect(response.messageHistory).to.deep.equal([{ role: 'user', content: 'Run.' }, ...response.messages]);
				expect(promptTexts(model, streaming)).to.deep.equal([
					['Configured.'],
					['Configured.', 'Earlier.'],
					['Configured.', 'Loaded named.'],
					['Configured.', 'Run.'],
				]);
				expect(loaded).to.deep.equal(['named']);

				const empty = streaming ? create.TextStreamer.loadsText({ model, loader }) : create.TextGenerator.loadsText({ model, loader });
				// @ts-expect-error Missing prompts are also rejected at runtime.
				await rejects(async () => await empty.run({}), /Either 'prompt' \(string or messages array\) or 'messages' must be provided/);
			});
		}
	});

	describe('run overrides', () => {
		for (const promptType of ['template', 'script'] as const) {
			it(`should reject a non-string prompt override for a ${promptType} prompt`, async () => {
				const model = mockModel('DONE');
				const generator = promptType === 'template'
					? create.TextGenerator.withTemplate({ model, prompt: 'Configured.' })
					: create.TextGenerator.withScript({ model, prompt: 'return "Configured."' });
				const prompt: ModelMessage[] = [{ role: 'user', content: 'Array.' }];
				await rejects(async () => await generator.run({ prompt } as never), (error: unknown) => {
					expect(error).to.be.instanceOf(ConfigError);
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
				const streaming = factoryName.endsWith('Streamer');
				const model = mockModel(answer);
				const parent = create.Config({ topP: 0.8, topK: 5, presencePenalty: 0.1, frequencyPenalty: 0.2, seed: 7, headers: { 'x-parent': 'parent' } });
				const config = { model, prompt: 'Settings.', maxOutputTokens: 20, providerOptions: { mock: { flag: true } } };
				const component = factoryName === 'TextGenerator' ? create.TextGenerator(config, parent)
					: factoryName === 'TextStreamer' ? create.TextStreamer(config, parent)
						: factoryName === 'ObjectGenerator' ? create.ObjectGenerator({ ...config, schema }, parent)
							: create.ObjectStreamer({ ...config, schema }, parent);
				await settle(await component());
				await settle(await component.run({ topP: 0.5, maxOutputTokens: 30 }));
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
					? create.TextStreamer({ model, prompt: 'List facts.', stopSequences: ['###'] })
					: create.TextGenerator({ model, prompt: 'List facts.', stopSequences: ['###'] });
				await settle(await component());
				await settle(await component.run({ stopSequences: ['END'] }));
				expect((streaming ? model.doStreamCalls : model.doGenerateCalls).map(call => call.stopSequences)).to.deep.equal([['###'], ['END']]);
			});
		}
	});

	it('should forward SDK chunk and step callbacks', async () => {
		const chunks: string[] = [];
		const steps: string[] = [];
		const streamer = create.TextStreamer({
			model: mockModel('DONE', ['DO', 'NE']), prompt: 'Input.',
			onChunk: ({ chunk }) => { if (chunk.type === 'text-delta') chunks.push(chunk.text); },
			onStepFinish: step => { steps.push(`stream:${step.text}`); },
		});
		await collect(streamer().textStream);
		const generator = create.TextGenerator({ model: mockModel('DONE'), prompt: 'Input.', onStepFinish: step => { steps.push(`generate:${step.text}`); } });
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
			const generator = create.TextGenerator.withTemplate.asTool({ inputSchema, model, prompt: 'Value {{ value }}' });
			for (const component of [template, script, generator]) {
				await rejects(async () => await (component as (input: object) => Promise<unknown>)(invalid), (error: unknown) => {
					expect(error).to.be.instanceOf(ConfigError);
					expect((error as Error).message).to.match(/Input context validation failed[\s\S]*value/);
					return true;
				});
			}
			expect(model.doGenerateCalls).to.have.length(0);
			expect(await template.execute(invalid, options)).to.equal('Value two');
			expect(await script.execute(invalid, options)).to.equal('Value two');
			expect(await generator.execute(invalid, options)).to.equal('DONE');
			expect(promptTexts(model)).to.deep.equal([['Value two']]);

			// A Function tool is its own execute function.
			const fn = create.Function.asTool({ inputSchema, execute: ({ value }) => `Value ${value}` });
			expect(fn.execute).to.equal(fn);
			expect(await fn(invalid, options)).to.equal('Value two');
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
			const result = await create.TextGenerator({ model, tools: { action }, prompt: 'Use the tool.' })();
			expect(executions).to.equal(0);
			expect(result.toolResults).to.have.length(0);
			expect(result.content.map(part => part.type)).to.deep.equal(['tool-call', 'tool-error']);
		});
	});

	it('should expose factory aliases and keep streamers out of tool use', () => {
		expect(create.TextGenerator.withText).to.equal(create.TextGenerator);
		expect(create.TextGenerator.withText.asTool).to.equal(create.TextGenerator.asTool);
		expect(create.ObjectGenerator.withText).to.equal(create.ObjectGenerator);
		expect(create.ObjectGenerator.withText.asTool).to.equal(create.ObjectGenerator.asTool);
		expect(create.TextStreamer.withText).to.equal(create.TextStreamer);
		expect(create.ObjectStreamer.withText).to.equal(create.ObjectStreamer);
		expect(create.Script.loadsScriptAsTool).to.equal(create.Script.loadsScript.asTool);
		for (const streamer of [create.TextStreamer, create.ObjectStreamer]) {
			for (const factory of [streamer, streamer.withTemplate, streamer.withScript, streamer.withFunction, streamer.loadsText, streamer.loadsTemplate, streamer.loadsScript]) {
				expect(factory).not.to.have.property('asTool');
			}
		}
		// A stream cannot be a tool result, so the streamer types have no asTool modifier either.
		const _textTools: 'asTool' extends keyof typeof create.TextStreamer ? never : true = true;
		const _objectTools: 'asTool' extends keyof typeof create.ObjectStreamer.withTemplate ? never : true = true;
	});
});
