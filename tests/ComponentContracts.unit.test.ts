/* eslint-disable no-constant-condition -- Unreachable branches verify compile-time errors. */
import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import type { ModelMessage } from 'ai';
import { jsonSchema } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { create, ConfigError, ModelMessageSchema, PromptStringOrMessagesSchema, z } from './cascada';
import type { ConfigProvider } from './cascada';
import { extractCallArguments } from '../src/call-arguments.js';

describe('Component boundary contracts', () => {
	describe('optional invocation arguments', () => {
		const messages: ModelMessage[] = [{ role: 'user', content: 'Earlier question' }];
		const context = { topic: 'contracts' };

		it('accepts omitted arguments and explicit undefined placeholders', () => {
			expect(extractCallArguments()).to.deep.equal({ prompt: undefined, messages: undefined, context: undefined });
			expect(extractCallArguments(undefined, messages, context)).to.deep.equal({ prompt: undefined, messages, context });
			expect(extractCallArguments(undefined, context)).to.deep.equal({ prompt: undefined, messages: undefined, context });
		});

		it('preserves empty prompt, message and context arguments without coercion', () => {
			const emptyMessages: ModelMessage[] = [];
			const emptyContext = {};
			const result = extractCallArguments('', emptyMessages, emptyContext);
			expect(result.prompt).to.equal('');
			expect(result.messages).to.equal(emptyMessages);
			expect(result.context).to.equal(emptyContext);
		});

		it('accepts context before messages without copying either argument', () => {
			const result = extractCallArguments(context, messages);
			expect(result.messages).to.equal(messages);
			expect(result.context).to.equal(context);
		});

		it('rejects a third context when the first argument already supplied context', () => {
			expect(() => extractCallArguments(context, messages, context)).to.throw('Context provided multiple times');
		});
	});

	describe('documented config inheritance rules', () => {
		it('replaces options and providerOptions objects rather than merging their fields', () => {
			const parentOptions = { autoescape: true, trimBlocks: true };
			const childOptions = { trimBlocks: false };
			const parentProvider = { example: { inherited: true } };
			const childProvider = { other: { selected: true } };
			const parent = create.Config({ options: parentOptions, providerOptions: parentProvider });
			const child = create.Config({ options: childOptions, providerOptions: childProvider }, parent);
			expect(child.config.options).to.equal(childOptions);
			expect(child.config.options).to.deep.equal({ trimBlocks: false });
			expect(child.config.providerOptions).to.equal(childProvider);
			expect(parent.config.options).to.equal(parentOptions);
			expect(parent.config.providerOptions).to.equal(parentProvider);
		});

		it('clears ordinary schema settings with explicit undefined', () => {
			const schema = z.object({ value: z.number() });
			const parent = create.Config({ schema, inputSchema: schema, contextSchema: schema });
			const child = create.Config({ schema: undefined, inputSchema: undefined, contextSchema: undefined }, parent);
			expect(child.config).to.have.property('schema', undefined);
			expect(child.config).to.have.property('inputSchema', undefined);
			expect(child.config).to.have.property('contextSchema', undefined);
			expect(parent.config.schema).to.equal(schema);
		});

		it('retains inherited maps for empty child maps and clears individual context entries', () => {
			const upper = (value: string) => value.toUpperCase();
			const parent = create.Config({ context: { language: 'en', retained: 3 }, filters: { upper } });
			const empty = create.Config({ context: {}, filters: {} }, parent);
			const cleared = create.Config({ context: { language: undefined } }, empty);
			expect(empty.config.context).to.deep.equal({ language: 'en', retained: 3 });
			expect(empty.config.filters.upper).to.equal(upper);
			expect(cleared.config.context).to.deep.equal({ language: undefined, retained: 3 });
			expect(parent.config.context.language).to.equal('en');
		});

		for (const childMessages of [undefined, []]) {
			it(`retains inherited messages for ${childMessages === undefined ? 'undefined' : 'empty'} child messages`, () => {
				const messages: ModelMessage[] = [{ role: 'user', content: 'Keep this message' }];
				const parent = create.Config({ messages });
				const child = create.Config({ messages: childMessages }, parent);
				expect(child.config.messages).to.deep.equal(messages);
				expect(child.config.messages).not.to.equal(messages);
				expect(parent.config.messages).to.equal(messages);
			});
		}

		for (const childLoader of [undefined, []]) {
			it(`retains an inherited loader chain for ${childLoader === undefined ? 'undefined' : 'empty'} child loaders`, async () => {
				const loader = { load: (name: string) => `Loaded ${name}` };
				const parent = create.Config({ loader });
				const child = create.Config({ loader: childLoader }, parent);
				expect(child.config.loader).to.deep.equal([loader]);
				expect(await create.Template.loadsTemplate({ template: 'contract' }, child)()).to.equal('Loaded contract');
				expect(parent.config.loader).to.deep.equal([loader]);
			});
		}
	});

	describe('required model values', () => {
		const factories: {
			name: string;
			build: (config: Record<string, unknown>, parent?: ConfigProvider<{ model: MockLanguageModelV3 }>) => unknown;
		}[] = [
			{ name: 'TextGenerator', build: (config, parent) => create.TextGenerator(config as never, parent as never) },
			{ name: 'TextStreamer', build: (config, parent) => create.TextStreamer(config as never, parent as never) },
			{ name: 'ObjectGenerator', build: (config, parent) => create.ObjectGenerator({ output: 'no-schema', ...config } as never, parent as never) },
			{ name: 'ObjectStreamer', build: (config, parent) => create.ObjectStreamer({ output: 'no-schema', ...config } as never, parent as never) },
		];
		for (const { name, build } of factories) {
			for (const model of [undefined, null]) {
				it(`rejects ${String(model)} models in ${name} configs and inherited overrides`, () => {
					const parent = create.Config({ model: new MockLanguageModelV3() });
					expect(() => build({ model, prompt: 'Question' })).to.throw(ConfigError, /require a 'model' property/);
					expect(() => build({ model, prompt: 'Question' }, parent)).to.throw(ConfigError, /require a 'model' property/);
				});
			}
		}
	});

	describe('public message and prompt schemas', () => {
		const validMessages: { name: string, message: ModelMessage }[] = [
			{ name: 'system text', message: { role: 'system', content: 'Instruction', providerOptions: { example: { cache: true } } } },
			{ name: 'user multipart content', message: { role: 'user', content: [
				{ type: 'text', text: 'Read these files' },
				{ type: 'image', image: new Uint8Array([1, 2]), mediaType: 'image/png' },
				{ type: 'file', data: { type: 'text', text: 'Document content' }, filename: 'note.txt', mediaType: 'text/plain' },
			] } },
			{ name: 'assistant reasoning and tool calls', message: { role: 'assistant', content: [
				{ type: 'text', text: 'Calculating' },
				{ type: 'reasoning', text: 'Use the calculator' },
				{ type: 'tool-call', toolCallId: 'call-1', toolName: 'calculate', input: { value: 2 }, providerExecuted: true },
				{ type: 'tool-result', toolCallId: 'call-1', toolName: 'calculate', output: { type: 'json', value: 4 } },
			] } },
			{ name: 'tool results', message: { role: 'tool', content: [
				{ type: 'tool-result', toolCallId: 'call-1', toolName: 'calculate', output: { type: 'text', value: '4' } },
			] } },
			{ name: 'assistant custom provider parts', message: { role: 'assistant', content: [
				{ type: 'custom', kind: 'example.state', providerOptions: { example: { opaque: 'retained' } } },
			] } },
			{ name: 'assistant reasoning files', message: { role: 'assistant', content: [
				{ type: 'reasoning-file', data: { type: 'data', data: new Uint8Array([3, 4]) }, mediaType: 'image/png' },
			] } },
			{ name: 'assistant tool approval requests', message: { role: 'assistant', content: [
				{ type: 'tool-approval-request', approvalId: 'approval-1', toolCallId: 'call-1', reason: 'Review calculation', isAutomatic: false, signature: 'signature', inputSchemaInput: { value: '2' } },
			] } },
			{ name: 'tool approval responses', message: { role: 'tool', content: [
				{ type: 'tool-approval-response', approvalId: 'approval-1', approved: false, reason: 'Declined', providerExecuted: true },
			] } },
		];

		for (const { name, message } of validMessages) {
			it(`accepts and preserves ${name} in schemas and reusable configs`, () => {
				expect(ModelMessageSchema.parse(message)).to.deep.equal(message);
				expect(PromptStringOrMessagesSchema.parse([message])).to.deep.equal([message]);
				expect(create.Config({ messages: [message] }).config.messages).to.deep.equal([message]);
				expect(create.Config({ prompt: [message] }).config.prompt).to.deep.equal([message]);
			});
		}

		const invalidMessages: { name: string, message: unknown }[] = [
			{ name: 'unknown roles', message: { role: 'developer', content: 'Instruction' } },
			{ name: 'multipart system content', message: { role: 'system', content: [{ type: 'text', text: 'Instruction' }] } },
			{ name: 'user reasoning content', message: { role: 'user', content: [{ type: 'reasoning', text: 'Reasoning' }] } },
			{ name: 'assistant image content', message: { role: 'assistant', content: [{ type: 'image', image: 'aGVsbG8=' }] } },
			{ name: 'tool text content', message: { role: 'tool', content: 'Result' } },
			{ name: 'tool text parts', message: { role: 'tool', content: [{ type: 'text', text: 'Result' }] } },
			{ name: 'malformed text parts', message: { role: 'user', content: [{ type: 'text', text: 42 }] } },
			{ name: 'files without media types', message: { role: 'user', content: [{ type: 'file', data: 'aGVsbG8=' }] } },
			{ name: 'custom parts without provider-qualified kinds', message: { role: 'assistant', content: [{ type: 'custom', kind: 'state' }] } },
			{ name: 'reasoning files without media types', message: { role: 'assistant', content: [{ type: 'reasoning-file', data: 'aGVsbG8=' }] } },
			{ name: 'approval requests without call IDs', message: { role: 'assistant', content: [{ type: 'tool-approval-request', approvalId: 'approval-1' }] } },
			{ name: 'approval requests with invalid metadata', message: { role: 'assistant', content: [{ type: 'tool-approval-request', approvalId: 'approval-1', toolCallId: 'call-1', isAutomatic: 'yes' }] } },
			{ name: 'approval responses without decisions', message: { role: 'tool', content: [{ type: 'tool-approval-response', approvalId: 'approval-1' }] } },
			{ name: 'approval responses with invalid decisions', message: { role: 'tool', content: [{ type: 'tool-approval-response', approvalId: 'approval-1', approved: 'yes' }] } },
		];

		for (const { name, message } of invalidMessages) {
			it(`rejects ${name} in schemas, configured messages and prompts`, () => {
				expect(ModelMessageSchema.safeParse(message).success).to.equal(false);
				expect(PromptStringOrMessagesSchema.safeParse([message]).success).to.equal(false);
				expect(() => create.Config({ messages: [message] } as never)).to.throw(ConfigError, /invalid message objects/);
				expect(() => create.Config({ prompt: [message] } as never)).to.throw(ConfigError, /invalid message objects/);
			});
		}

		it('keeps provider extension fields while validating known message fields', () => {
			const message = { role: 'user', content: [{ type: 'text', text: 'Hello', extension: { id: 'part' } }], extension: { id: 'message' } };
			expect(ModelMessageSchema.parse(message)).to.deep.equal(message);
		});

		it('accepts plain prompt strings and rejects non-prompt scalar values', () => {
			expect(PromptStringOrMessagesSchema.parse('')).to.equal('');
			expect(PromptStringOrMessagesSchema.parse('Question')).to.equal('Question');
			for (const invalid of [null, undefined, 42, true, { role: 'user', content: 'Question' }]) {
				expect(PromptStringOrMessagesSchema.safeParse(invalid).success).to.equal(false);
			}
		});

		it('inherits an inferred message-array Config prompt into a text generator', async () => {
			const messages: ModelMessage[] = [{ role: 'user', content: 'Question' }];
			const parent = create.Config({ prompt: messages });
			const inferredMessages: ModelMessage[] = parent.config.prompt;
			const model = new MockLanguageModelV3({
				doGenerate: {
					content: [{ type: 'text', text: 'Answer' }],
					finishReason: { unified: 'stop', raw: 'stop' },
					usage: {
						inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
						outputTokens: { total: 1, text: 1, reasoning: 0 },
					},
					warnings: [],
				},
			});
			const generator = create.TextGenerator({ model }, parent);
			expect((await generator()).text).to.equal('Answer');
			expect(model.doGenerateCalls[0].prompt).to.have.length(1);
			expect(model.doGenerateCalls[0].prompt[0]).to.deep.include({ role: 'user', content: [{ type: 'text', text: 'Question' }] });
			expect(inferredMessages).to.equal(messages);
			if (false) {
				// @ts-expect-error Template prompts must be strings rather than message arrays.
				create.Config({ promptType: 'template', prompt: messages });
				// @ts-expect-error Script prompts must be strings rather than message arrays.
				create.Config({ promptType: 'script', prompt: messages });
				// @ts-expect-error Inferred Config prompt arrays retain their array type.
				const _prompt: string = parent.config.prompt;
			}
		});
	});

	describe('Function validation effects', () => {
		it('rejects invalid nested input before executing user code and reports the field path', async () => {
			let calls = 0;
			const fn = create.Function({
				inputSchema: z.object({ entries: z.array(z.object({ value: z.number() })) }),
				execute: ({ entries }) => {
					calls++;
					return entries.length;
				},
			});
			await rejects(async () => await fn({ entries: [{ value: 'invalid' }] } as never), (error: unknown) => {
				expect(error).to.be.instanceOf(ConfigError);
				expect((error as Error).message).to.include('entries.0.value');
				return true;
			});
			expect(calls).to.equal(0);
			expect(await fn({ entries: [{ value: 3 }] })).to.equal(1);
			expect(calls).to.equal(1);
		});

		it('returns parsed output without mutating the implementation result', async () => {
			const raw = { answer: 4, internal: 'private' };
			const fn = create.Function({ schema: z.object({ answer: z.number() }), execute: () => raw });
			const result = await fn({});
			expect(result).to.deep.equal({ answer: 4 });
			expect(result).not.to.equal(raw);
			expect(raw).to.deep.equal({ answer: 4, internal: 'private' });
		});

		it('merges call input without allowing callback mutation to overwrite configured context', async () => {
			const context = { value: 1, retained: true };
			const fn = create.Function({
				context,
				execute: input => {
					const value = input.value;
					input.value = 99;
					return value;
				},
			});
			const input = { value: 3 };
			expect(await fn(input)).to.equal(3);
			expect(await fn({})).to.equal(1);
			expect(context).to.deep.equal({ value: 1, retained: true });
			expect(input).to.deep.equal({ value: 3 });
		});
	});

	describe('Script output inference', () => {
		it('infers nested schema outputs with configured callbacks and inherited configs', async () => {
			const schema = z.object({ docs: z.array(z.object({ filename: z.string(), similarity: z.number() })) });
			const config = {
				schema,
				context: { filename: 'document.txt', score: async () => 0.5 },
				script: 'return { docs: [{ filename: filename, similarity: score() }] }',
			};
			const standalone = await create.Script(config)();
			const inherited = await create.Script({}, create.Config(config))();
			const filename: string = standalone.docs[0].filename;
			const similarity: number = inherited.docs[0].similarity;
			expect([filename, similarity]).to.deep.equal(['document.txt', 0.5]);
			if (false) {
				// @ts-expect-error Nested schema output values retain their actual types.
				const _filename: number = standalone.docs[0].filename;
				// @ts-expect-error Inherited nested output values retain their actual types.
				const _similarity: string = inherited.docs[0].similarity;
			}
		});

		it('infers execute outputs from standalone, inherited and loaded Script tool schemas', async () => {
			const inputSchema = z.object({ value: z.number() });
			const schema = z.object({ answer: z.number() });
			const options = { toolCallId: 'script-inference', messages: [], context: undefined };
			const standalone = create.Script.asTool({ inputSchema, schema, script: 'return { answer: value * 2 }' });
			const inherited = create.Script.asTool({ script: 'return { answer: value * 3 }' }, create.Config({ inputSchema, schema }));
			const loaded = create.Script.loadsScript.asTool({
				inputSchema, schema, script: 'answer', loader: { load: () => 'return { answer: value * 4 }' },
			});
			const standaloneResult = await standalone.execute({ value: 2 }, options);
			const inheritedResult = await inherited.execute({ value: 2 }, options);
			const loadedResult = await loaded.execute({ value: 2 }, options);
			const standaloneAnswer: number = standaloneResult.answer;
			const inheritedAnswer: number = inheritedResult.answer;
			const loadedAnswer: number = loadedResult.answer;
			expect([standaloneAnswer, inheritedAnswer, loadedAnswer]).to.deep.equal([4, 6, 8]);
			if (false) {
				// @ts-expect-error Script tool execute follows its output schema.
				const _standalone: string = standaloneResult.answer;
				// @ts-expect-error An inherited schema types Script tool execute output.
				const _inherited: string = inheritedResult.answer;
				// @ts-expect-error Loaded Script tools retain the output schema type.
				const _loaded: string = loadedResult.answer;
			}
		});
	});

	describe('AI SDK schema contracts', () => {
		for (const asynchronous of [false, true]) {
			const mode = asynchronous ? 'asynchronous' : 'synchronous';

			it(`validates ${mode} SDK input schemas before execution without replacing call-time input`, async () => {
				const events: string[] = [];
				const schemaError = new Error('A numeric value is required');
				const validate = (input: unknown) => {
					events.push('validate');
					const parsed = z.object({ value: z.number() }).safeParse(input);
					if (!parsed.success) return { success: false as const, error: schemaError };
					return { success: true as const, value: { value: parsed.data.value + 100 } };
				};
				const inputSchema = jsonSchema<{ value: number }>({ type: 'object', properties: { value: { type: 'number' } }, required: ['value'] }, {
					validate: asynchronous ? async input => validate(input) : validate,
				});
				const fn = create.Function({
					inputSchema, context: { offset: 3 },
					execute: ({ value, offset }) => {
						events.push('execute');
						return value + offset;
					},
				});
				const result: number = await fn({ value: 2 });
				expect(result).to.equal(5);
				expect(events).to.deep.equal(['validate', 'execute']);
				await rejects(async () => await fn({ value: 'invalid' } as never), (error: unknown) => {
					expect(error).to.be.instanceOf(ConfigError);
					expect((error as ConfigError).cause).to.equal(schemaError);
					return true;
				});
				expect(events).to.deep.equal(['validate', 'execute', 'validate']);
				await rejects(async () => await fn(undefined as never), ConfigError);
			});

			it(`returns parsed ${mode} SDK output and preserves schema failure causes`, async () => {
				const schemaError = new Error('A non-negative result is required');
				const validate = (output: unknown) => typeof output === 'number' && output >= 0
					? { success: true as const, value: output + 10 }
					: { success: false as const, error: schemaError };
				const schema = jsonSchema<number>({ type: 'number' }, { validate: asynchronous ? async output => validate(output) : validate });
				const parent = create.Config({ schema });
				const fn = create.Function({ execute: ({ value }: { value: number }) => value }, parent);
				const result: number = await fn({ value: 2 });
				expect(result).to.equal(12);
				await rejects(async () => await fn({ value: -1 }), (error: unknown) => {
					expect(error).to.be.instanceOf(ConfigError);
					expect((error as ConfigError).message).to.include('Output validation failed');
					expect((error as ConfigError).cause).to.equal(schemaError);
					return true;
				});
			});

			it(`parses ${mode} SDK output schemas for direct tool calls and execute`, async () => {
				let validations = 0;
				const validate = (output: unknown) => {
					validations++;
					return typeof output === 'number'
						? { success: true as const, value: output + 1 }
						: { success: false as const, error: new Error('Expected a number') };
				};
				const tool = create.Function.asTool({
					inputSchema: z.object({ value: z.number() }),
					schema: jsonSchema<number>({ type: 'number' }, { validate: asynchronous ? async output => validate(output) : validate }),
					execute: ({ value }) => value * 2,
				});
				const options = { toolCallId: 'schema-contract', messages: [], context: undefined };
				expect(await tool({ value: 2 }, options)).to.equal(5);
				expect(await tool.execute({ value: 3 }, options)).to.equal(7);
				expect(validations).to.equal(2);
			});
		}

		it('accepts SDK schema metadata without a local validator', async () => {
			const fn = create.Function({
				inputSchema: jsonSchema<{ value: number }>({ type: 'object', properties: { value: { type: 'number' } } }),
				schema: jsonSchema<number>({ type: 'number' }),
				execute: ({ value }) => value * 2,
			});
			expect(await fn({ value: 2 })).to.equal(4);
		});

		for (const kind of ['Template', 'Script'] as const) {
			for (const asynchronous of [false, true]) {
				it(`validates ${asynchronous ? 'asynchronous' : 'synchronous'} SDK input schemas for ${kind} before rendering`, async () => {
					const events: string[] = [];
					const schemaError = new Error('A numeric value is required');
					const validate = (input: unknown) => {
						events.push('validate');
						const parsed = z.object({ value: z.number() }).safeParse(input);
						return parsed.success ? { success: true as const, value: parsed.data } : { success: false as const, error: schemaError };
					};
					const inputSchema = jsonSchema<{ value: number }>({ type: 'object', properties: { value: { type: 'number' } }, required: ['value'] }, {
						validate: asynchronous ? async input => validate(input) : validate,
					});
					const context = { compute: (value: number) => { events.push('render'); return value * 3; } };
					const component = kind === 'Template'
						? create.Template({ inputSchema, context, template: '{{ compute(value) }}' })
						: create.Script({ inputSchema, context, script: 'return compute(value)' });
					expect(await component({ value: 2 })).to.equal(kind === 'Template' ? '6' : 6);
					expect(events).to.deep.equal(['validate', 'render']);
					await rejects(async () => await component({ value: 'invalid' } as never), ConfigError);
					await rejects(async () => await component(undefined as never), ConfigError);
					expect(events).to.deep.equal(['validate', 'render', 'validate', 'validate']);
				});
			}

			it(`rejects concrete scalar SDK input schemas at ${kind} construction`, () => {
				const inputSchema = jsonSchema<{ value: number }>({ type: 'number' });
				const build = () => kind === 'Template'
					? create.Template({ inputSchema, template: 'Ready' })
					: create.Script({ inputSchema, script: 'return "Ready"' });
				expect(build).to.throw(ConfigError, /AI SDK object schema/);
			});

			it(`accepts composed SDK input schema metadata without a local validator for ${kind}`, async () => {
				const inputSchema = jsonSchema<{ value?: number }>({ anyOf: [{ type: 'object' }, { type: 'null' }] });
				const component = kind === 'Template'
					? create.Template({ inputSchema, template: 'Ready' })
					: create.Script({ inputSchema, script: 'return "Ready"' });
				expect(await component({})).to.equal('Ready');
				expect(await component(undefined as never)).to.equal('Ready');
			});

			it(`accepts object unions and deferred SDK input schema metadata for ${kind}`, async () => {
				const schemas = [
					jsonSchema<{ value?: number }>({ type: ['object', 'null'] }),
					jsonSchema<{ value?: number }>(Promise.resolve({ type: 'object' as const })),
				];
				for (const inputSchema of schemas) {
					const component = kind === 'Template'
						? create.Template({ inputSchema, template: 'Ready' })
						: create.Script({ inputSchema, script: 'return "Ready"' });
					expect(await component({})).to.equal('Ready');
				}
			});
		}
	});
});
