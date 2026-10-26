import assert from 'node:assert/strict';
import { asSchema, jsonSchema, isStepCount, tool } from 'ai';
import { validateTypes } from '@ai-sdk/provider-utils';
import { MockLanguageModelV3 } from 'ai/test';
import type { ModelMessage, Tool } from 'ai';
import * as mini from 'zod/mini';
import { create, ConfigError, ValidationError, collectTextStream, z } from './cascada';
import type { ComponentExecutionOptions } from './cascada';
import { mergeConfigs, processConfig } from '../src/config-utils.js';
import { inputNames } from '../src/schema.js';
import { explicitMetadata } from './fixtures/phase2-api-schemas.js';
import { modelFor } from './fixtures/phase2-security-sdk.js';

describe('Review configuration and metadata corrections', () => {
	it('requires input when the selected configuration supplies no public default', async () => {
		const inputSchema = z.object({ value: z.number() });
		for (const hasDefault of [true, false]) {
			const config = hasDefault ? { inputSchema, context: { value: 1 } } : { inputSchema };
			const model = modelFor(undefined);
			const template = create.Template({ template: '{{ value }}' }, { config });
			const script = create.Script({ script: 'return value' }, { config });
			const text = create.TextGenerator.withTemplate({ model, prompt: '{{ value }}' }, { config });
			const stream = create.TextStreamer.withTemplate({ model, prompt: '{{ value }}' }, { config });
			// Runtime-only calls exercise the missing-input branch rejected by types.
			const components: unknown[] = [template, script, text, stream];
			for (const component of components) {
				const call = component as () => Promise<unknown>;
				if (hasDefault) {
					const result = await call();
					if (component === stream) await (result as { text: Promise<string> }).text;
				} else await assert.rejects(call(), /Application input validation failed/);
			}
			if (!hasDefault) {
				assert.equal(model.doGenerateCalls.length, 0);
				assert.equal(model.doStreamCalls.length, 0);
			}
			assert.equal(await template({ value: 2 }), '2');
			assert.equal(await script({ value: 2 }), 2);
			assert.equal((await text({ value: 2 })).text, 'done');
			assert.equal(await (await stream({ value: 2 })).text, 'done');
		}
	});

	it('validates the concrete alternatives used by union-valued callers', async () => {
		const inputSchema = z.object({ value: z.number() }).catchall(z.number());
		let executions = 0;
		const operation = create.Function.asTool({ inputSchema: z.object({ value: z.number(), extra: z.number().optional(), other: z.number().optional() }), context: { value: 1, db: 'private' }, execute: ({ value }) => {
			executions++;
			return value;
		} });
		const template = create.Template({ inputSchema, context: { value: 1, db: 'private' }, template: '{{ value }}' });
		const owner = create.Function({ inputSchema: z.object({ input: z.custom<object>() }), tools: { operation },
			execute: ({ operation, input }) => (operation as (input: object) => Promise<number>)(input) });
		const calls = [
			(input: object) => (operation as (input: object) => Promise<unknown>)(input),
			(input: object) => (operation.run as (settings: { context: object }) => Promise<unknown>)({ context: input }),
			(input: object) => (template as (input: object) => Promise<unknown>)(input),
			(input: object) => (template.run as (settings: { context: object }) => Promise<unknown>)({ context: input }),
			(input: object) => owner({ input }),
		];
		for (const call of calls) {
			for (const input of [{ extra: 2 }, { other: 3 }, { value: 1 }]) assert.equal(String(await call(input)), '1');
			const before = executions;
			for (const input of [{ value: 1, extra: 'invalid' }, { value: 1, db: 'untrusted' }]) {
				await assert.rejects(call(input), ValidationError);
			}
			assert.equal(executions, before);
		}
	});

	it('checks projection against the defaults belonging to each selected parser', async () => {
		const unionParser = z.union([z.object({ x: z.number().optional() }), z.object({ y: z.string().optional() })]);
		const defaultParser = z.object({ factor: z.number() });
		for (const inputSchema of [unionParser, defaultParser]) {
			const component = create.Function.asTool({ inputSchema, context: { factor: 3 }, execute: ({ factor }) => factor });
			assert.equal(await component(), 3);
			const bound = component.bindToolContext({});
			const input = await validateTypes({ value: {}, schema: bound.tool.inputSchema });
			assert.equal(await bound.tool.execute!(input, { toolCallId: 'projection', messages: [], context: bound.context }), 3);
		}
	});

	it('keeps selected parsers distinct from a native union parser', async () => {
		const left = z.object({ left: z.string() }), right = z.object({ right: z.number() });
		const input = { left: 'one branch' };
		assert.equal(z.union([left, right]).safeParse(input).success, true);
		for (const inputSchema of [left, right]) {
			const component = create.Function({ inputSchema, execute: () => 'ran' });
			const call = component as (input: object) => Promise<string>;
			if (inputSchema.safeParse(input).success) assert.equal(await call(input), 'ran');
			else await assert.rejects(call(input), /Application input validation failed/);
		}
	});

	it('assembles configured fields according to each selected parser on direct and tool paths', async () => {
		const publicKey = z.object({ key: z.string().transform(Number) });
		const privateKey = z.object({ query: z.string().optional() });
		for (const inputSchema of [publicKey, privateKey]) {
			let executions = 0;
			const component = create.Function.asTool({ inputSchema, context: { key: '4' }, execute: ({ key }) => {
				executions++;
				return key;
			} });
			const expected = inputSchema === publicKey ? 4 : '4';
			assert.equal(await component(), expected);
			assert.equal(await component.run(), expected);
			const owner = create.Function({ tools: { component }, execute: ({ component }) => component() });
			assert.equal(await owner(), expected);
			const bound = component.bindToolContext({});
			const parsed = await validateTypes({ value: {}, schema: bound.tool.inputSchema });
			assert.equal(await bound.tool.execute!(parsed, { toolCallId: 'selected', messages: [], context: bound.context }), expected);
			const call = component as (input: object) => Promise<unknown>;
			if (inputSchema === publicKey) assert.equal(await call({ key: '5' }), 5);
			else {
				await assert.rejects(call({ key: '5' }), /Undeclared tool input keys: key/);
				await assert.rejects(validateTypes({ value: { key: '5' }, schema: bound.tool.inputSchema }), /Undeclared tool input keys: key/);
				assert.equal(executions, 4);
			}
		}
	});

	it('requires component initialization instead of spreading tool descriptors', async () => {
		const multiply = create.Function.asTool({ inputSchema: z.object({ value: z.number(), factor: z.number() }), context: { factor: 2 },
			execute: input => input.value * input.factor });
		const child = create.Function.asTool({ description: 'Scale a value' }, multiply);
		const owner = create.Function({ tools: { child }, toolsContext: { child: { factor: 5 } }, execute: input => input.child({ value: 2 }) });
		assert.equal(await owner(), 10);
		assert.equal(child.description, 'Scale a value');
		// eslint-disable-next-line @typescript-eslint/no-misused-spread -- Intentionally bypass component initialization to test rejection.
		const copied = { ...multiply, description: 'Scale a value' };
		const functionFactory: unknown = create.Function;
		const build = functionFactory as (config: object) => () => Promise<unknown>;
		const generatorFactory: unknown = create.TextGenerator;
		const buildGenerator = generatorFactory as (config: object) => () => Promise<unknown>;
		for (const toolsContext of [undefined, { copied: { factor: 5 } }]) {
			const invalid = build({ tools: { copied }, toolsContext, execute: () => 'unused' });
			await assert.rejects(invalid(), /Do not spread Casai components/);
			const model = modelFor(undefined);
			const generator = buildGenerator({ model, prompt: 'go', tools: { copied } });
			await assert.rejects(generator(), /Do not spread Casai components/);
			assert.equal(model.doGenerateCalls.length, 0);
		}
	});

	it('discovers non-JSON local declarations without converting field schemas', async () => {
		const when = new Date(), callback = () => 7, db = { trusted: true };
		const object = z.object({ name: z.string(), when: z.date(), callback: z.custom<() => number>() });
		const miniature = mini.object({ name: mini.string(), when: mini.date(), callback: mini.custom<() => number>() });
		const schemas = [object, z.preprocess(value => value, object), z.lazy(() => object),
			z.preprocess(value => value, z.union([object, object])), z.lazy(() => z.union([object, object])),
			z.intersection(object, z.object({ name: z.string() })),
			mini.pipe(mini.transform(value => value), miniature), mini.lazy(() => miniature), mini.intersection(miniature, mini.object({ name: mini.string() }))];
		for (const inputSchema of schemas) {
			assert.deepEqual(await inputNames(inputSchema), ['name', 'when', 'callback']);
			assert.equal((await inputSchema.parseAsync({ name: 'Ada', when, callback })).when, when);
			await assert.rejects(async () => asSchema(inputSchema).jsonSchema, /cannot be represented in JSON Schema/);
			const component = create.Function({ inputSchema, context: { db, name: 'Ada' }, execute: input => {
				assert.equal(input.db, db); assert.equal(input.when, when); return `${input.name}${input.callback()}`;
			} });
			assert.equal(await component({ when, callback }), 'Ada7');
			assert.equal(await component.run({ context: { when, callback, name: 'Grace' } }), 'Grace7');
			const helper = tool({ inputSchema: z.object({}), execute: () => 'helper' });
			const withHelper = create.Function({ inputSchema, tools: { helper }, execute: input => input.helper({}) });
			assert.equal(await withHelper({ name: 'Ada', when, callback }), 'helper');
		}
	});

	it('keeps unsupported union tool projection separate from local and private-only calls', async () => {
		const inputSchema = z.union([z.object({ x: z.number() }), z.object({ y: z.string() })]);
		const local = create.Function({ inputSchema, context: { x: 1, db: true }, execute: input => input });
		assert.equal((await local()).db, true);
		const privateOnly = create.Function.asTool({ inputSchema, context: { db: true }, execute: input => input });
		assert.deepEqual(await asSchema(privateOnly.inputSchema).jsonSchema, await asSchema(inputSchema).jsonSchema);
		// JavaScript callers retain a lazy metadata error, before any provider request.
		const toolFactory: unknown = create.Function.asTool;
		const build = toolFactory as (config: object) => Tool;
		const invalid = build({ inputSchema, context: { x: 1 }, execute: () => 'unused' });
		await assert.rejects(Promise.resolve(asSchema(invalid.inputSchema).jsonSchema), /independent object schema/);
		const bindContext: unknown = privateOnly.bindToolContext;
		const bind = bindContext as (context: object) => { tool: Tool };
		await assert.rejects(Promise.resolve(asSchema(bind({ x: 2 }).tool.inputSchema).jsonSchema), /independent object schema/);
		const model = modelFor(undefined);
		const owner = create.TextGenerator({ model, prompt: 'go', tools: { invalid } });
		await assert.rejects(owner(), /independent object schema/);
		assert.equal(model.doGenerateCalls.length, 0);
	});

	it('preserves private symbol bindings and rejects their replacement', async () => {
		const key = Symbol('dependency'), resource = { trusted: true };
		const component = create.Function({ context: { [key]: resource }, execute: input => input[key] });
		assert.equal(await component(), resource);
		await assert.rejects(component({ [key]: {} } as never), /Private input keys: Symbol\(dependency\)/);
		const operation = create.Function.asTool({ inputSchema: z.object({}), context: { [key]: resource }, execute: input => input[key] });
		const bound = operation.bindToolContext({ [key]: resource });
		assert.equal(await bound.tool.execute!({}, { context: bound.context, messages: [], toolCallId: 'symbols' }), resource);
		const model = modelFor(undefined);
		const generator = create.TextGenerator({ model, prompt: 'go', tools: { operation }, toolsContext: { operation: { [key]: resource } },
			// Intentionally replace fixed context through an untyped native hook.
			prepareStep: () => ({ toolsContext: { operation: { [key]: { trusted: false } } } } as never) });
		await assert.rejects(generator(), /cannot change/);
		assert.equal(model.doGenerateCalls.length, 0);
		const owner = create.Function({ tools: { operation }, toolsContext: { operation: { [key]: resource } }, execute: input => input.operation() });
		assert.equal(await owner(), resource);
		const transformed = create.Function.asTool({ inputSchema: z.object({}).transform(() => ({ [key]: { trusted: false } })),
			context: { [key]: resource }, execute: input => input[key] });
		await assert.rejects(validateTypes({ schema: transformed.inputSchema, value: {} }), /Private input keys: Symbol\(dependency\)/);
	});

	it('names injected tools in validation errors without exposing private values', async () => {
		const native = tool({ inputSchema: z.object({ value: z.number() }), contextSchema: z.object({ token: z.number() }), execute: () => 1 });
		const component = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: input => input.value });
		for (const [operation, context, boundary] of [[native, { token: 1 }, 'input'], [component, undefined, 'input'],
			[native, { token: 'PRIVATE_SENTINEL' }, 'context']] as const) {
			const functionFactory: unknown = create.Function;
			const build = functionFactory as (config: object) => () => Promise<unknown>;
			const owner = build({ tools: { action: operation }, toolsContext: { action: context },
				execute: async (input: { action: (value: object) => Promise<unknown> }) => input.action({ value: boundary === 'input' ? 'bad' : 1 }) });
			await assert.rejects(owner(), error => error instanceof ValidationError && error.message === `Tool 'action' ${boundary} validation failed.`
				&& error.cause instanceof Error && !error.message.includes('PRIVATE_SENTINEL'));
		}
	});

	it('uses preprocessor input declarations for defaults, private bindings and transformed output', async () => {
		for (const inputSchema of [
			z.preprocess(value => value, z.object({ name: z.string().transform(value => value.length) })),
			mini.pipe(mini.transform(value => value), mini.object({ name: mini.pipe(mini.string(), mini.transform(value => value.length)) })),
		]) {
			const db = { trusted: true };
			const component = create.Function.asTool({ inputSchema, context: { name: 'Ada', db },
				execute: input => { assert.equal(input.db, db); return input.name; } });
			assert.deepEqual(await inputNames(inputSchema), ['name']);
			assert.equal(await component(), 3);
			assert.equal(await component.run({ context: { name: 'Grace' } }), 5);
			await assert.rejects(component({ db: {} } as never), /Undeclared tool input keys: db/);
			await assert.rejects(component({ name: 4 }), /Application input validation failed/);
			const bare = await validateTypes({ schema: component.inputSchema, value: {} });
			assert.deepEqual(bare, { name: 3 });
			assert.equal(await component.execute(bare, { toolCallId: 'bare', messages: [], context: undefined }), 3);
			const bound = component.bindToolContext({ name: 'Grace', db });
			const parsed = await validateTypes({ schema: bound.tool.inputSchema, value: {} });
			assert.deepEqual(parsed, { name: 5 });
			assert.equal(await bound.tool.execute!(parsed, { toolCallId: 'bound', messages: [], context: bound.context }), 5);
			await assert.rejects(validateTypes({ schema: bound.tool.inputSchema, value: { db: {} } }), /Undeclared tool input keys: db/);
			const owner = create.Function({ tools: { component }, toolsContext: { component: { name: 'Grace', db } },
				execute: input => input.component({}) });
			assert.equal(await owner(), 5);
		}
		const renamed = z.preprocess(value => value, z.object({ name: z.string() }).transform(({ name }) => ({ label: name })));
		const component = create.Function({ inputSchema: renamed, context: { name: 'Ada', db: true }, execute: input => input });
		assert.deepEqual(await component(), { label: 'Ada', db: true, _toolOptions: {} });
		const privateOnly = create.Function({ inputSchema: renamed, context: { db: true }, execute: input => input.label });
		assert.equal(await privateOnly({ name: 'Grace' }), 'Grace');
		assert.equal(await privateOnly({ name: 'Grace', db: false } as never), 'Grace', 'Native stripping removes the extra before private collision checks.');
		await assert.rejects(privateOnly({}), /Application input validation failed/);
	});

	it('snapshots configured message arrays while retaining nested message identity', async () => {
		const message: ModelMessage = { role: 'user', content: 'original' };
		for (const path of ['root', 'child', 'parent', 'both'] as const) {
			const messages: ModelMessage[] = [message];
			const model = modelFor(undefined);
			const settings = { model, messages };
			const component = path === 'root' ? create.TextGenerator(settings)
				: path === 'child' ? create.TextGenerator(settings, create.Config({}))
					: path === 'parent' ? create.TextGenerator({ model }, create.Config({ messages }))
						: create.TextGenerator(settings, create.Config({ messages: [{ role: 'user', content: 'parent' }] }));
			messages.push({ role: 'user', content: 'later' });
			messages[0] = { role: 'user', content: 'replaced' };
			assert.equal(component.config.messages.at(-1), message);
			await component();
			assert.ok(!JSON.stringify(model.doGenerateCalls).includes('later'));
			assert.ok(!JSON.stringify(model.doGenerateCalls).includes('replaced'));
			assert.ok(JSON.stringify(model.doGenerateCalls).includes('original'));
		}
		assert.deepEqual(processConfig({ messages: undefined }), { messages: undefined });
		assert.deepEqual(mergeConfigs({}, { messages: undefined }), { messages: undefined });
		assert.deepEqual(mergeConfigs({ messages: undefined }, {}), { messages: undefined });
		assert.deepEqual(mergeConfigs({ messages: undefined }, { messages: undefined }), { messages: [] });
	});

	it('captures context getters at creation and calls configured functions per invocation', async () => {
		let reads = 0, current = 'initial';
		const component = create.Function({ context: { get captured() { reads++; return current; }, live: () => current },
			execute: input => [input.captured, input.live()] });
		assert.equal(reads, 1);
		current = 'next';
		assert.deepEqual(await component(), ['initial', 'next']);
		assert.deepEqual(await component(), ['initial', 'next']);
		assert.equal(reads, 1);
	});

	it('creates injected tool IDs without browser secure-context crypto APIs', async () => {
		const crypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
		const metadata: ComponentExecutionOptions[] = [];
		const native = tool({ inputSchema: z.object({}), execute: (_input, options) => { metadata.push(options); return 1; } });
		const component = create.Function.asTool({ inputSchema: z.object({}), execute: input => { metadata.push(input._toolOptions); return 2; } });
		const owner = create.Function({ tools: { native, component }, execute: async input => [await input.native({}), await input.component()] });
		try {
			Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
			assert.deepEqual(await owner(), [1, 2]);
			assert.deepEqual(await owner(), [1, 2]);
		} finally {
			if (crypto) Object.defineProperty(globalThis, 'crypto', crypto);
			else Reflect.deleteProperty(globalThis, 'crypto');
		}
		assert.equal(new Set(metadata.map(value => value.toolCallId)).size, 4);
		for (const value of metadata) { assert.ok(value.toolCallId); assert.deepEqual(value.messages, []); }
	});

	for (const factory of [create.TextGenerator, create.TextStreamer, create.ObjectGenerator, create.ObjectStreamer]) {
		it(`labels Script and Function prompt failures before ${factory.name || 'LLM'} dispatch`, async () => {
			const model = modelFor(undefined);
			// Runtime family matrix; precise callback consumers are checked by test:types.
			const modifiers: unknown = factory;
			const make = modifiers as Record<string, (config: object) => () => unknown>;
			for (const [mode, prompt] of [['withScript', 'return [{ content: "invalid" }]'], ['loadsScript', 'invalid.script'], ['withFunction', () => [{ content: 'invalid' }]]] as const) {
				const component = make[mode]({ model, prompt, loader: { load: () => 'return [{ content: "invalid" }]' },
					...(factory === create.ObjectGenerator || factory === create.ObjectStreamer ? { schema: z.object({}) } : {}) });
				await assert.rejects(async () => component(), (error: unknown) => {
					assert.ok(error instanceof ValidationError); assert.equal(error.message, 'Prompt output validation failed.'); return true;
				});
			}
			assert.equal(model.doGenerateCalls.length + model.doStreamCalls.length, 0);
		});
	}

	it('explains missing partition metadata without probing validation', async () => {
		let parses = 0;
		let bodies = 0;
		const declared = z.object({ value: z.number() });
		const standard = { '~standard': { version: 1 as const, vendor: 'custom', validate(value: unknown) {
			parses++;
			return declared['~standard'].validate(value);
		} } };
		const plain = create.Function({ inputSchema: standard, execute: input => input.value });
		assert.equal(await plain({ value: 2 }), 2);
		assert.equal(parses, 1);
		assert.throws(() => asSchema(standard).jsonSchema, /vendor 'custom'.*JSON Schema/);
		const helper = tool({ inputSchema: z.object({}), execute: () => 1 });
		for (const sources of [
			{ context: { privateDependency: true } },
			{ toolContextSchema: z.object({ privateDependency: z.boolean().optional() }) },
			{ tools: { helper } },
		]) {
			const component = create.Function.asTool({ inputSchema: standard, ...sources, execute: () => { bodies++; return 1; } });
			const expected = (error: unknown) => {
				assert.ok(error instanceof ConfigError);
				assert.match(error.message, /partitioning.*explicit input metadata/);
				assert.match(error.cause!.message, /vendor 'custom'.*JSON Schema/);
				return true;
			};
			await assert.rejects(component({ value: 2 }), expected);
			await assert.rejects(component.run({ context: { value: 2 } }), expected);
			await assert.rejects(validateTypes({ schema: component.bindToolContext({}).tool.inputSchema, value: { value: 2 } }),
				(error: unknown) => { assert.match(String(error), /partitioning.*explicit input metadata/); return true; });
		}
		assert.equal(parses, 1);
		assert.equal(bodies, 0);
		const described = explicitMetadata(standard, { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] });
		const supported = create.Function({ inputSchema: described, context: { value: 3, privateDependency: true }, execute: input => input.value });
		assert.equal(await supported(), 3);
		assert.equal(parses, 2);
	});

	it('preserves rejected metadata causes and supported union declarations', async () => {
		for (const reason of [new Error('Metadata unavailable'), 'Metadata unavailable']) {
			// eslint-disable-next-line @typescript-eslint/only-throw-error -- Characterize native metadata rejecting a non-Error value.
			const schema = jsonSchema(async () => { throw reason; });
			await assert.rejects(inputNames(schema), (error: unknown) => {
				assert.ok(error instanceof ConfigError);
				assert.equal(error.cause?.message, 'Metadata unavailable');
				if (reason instanceof Error) assert.equal(error.cause, reason);
				return true;
			});
		}
		assert.deepEqual(await inputNames(jsonSchema({ anyOf: [
			{ type: 'object', properties: { a: {} } }, { type: 'object', properties: { b: {} } },
		] })), ['a', 'b']);
		await assert.rejects(inputNames(jsonSchema({ allOf: [{ type: 'object' }] })), ConfigError);
	});

	it('rejects obsolete rendering options through configurations and inheritance', async () => {
		const model = new MockLanguageModelV3();
		const factories: [unknown, object][] = [
			[create.Config, {}], [create.Function, { execute: () => 1 }],
			[create.Template, { template: '{{ value }}' }], [create.Script, { script: 'return value' }],
			[create.TextGenerator, { model, prompt: 'ready' }],
			[create.TextGenerator.withTemplate, { model, prompt: '{{ value }}' }],
			[create.TextStreamer.withScript, { model, prompt: 'return value' }],
			[create.ObjectGenerator.withTemplate, { model, prompt: '{{ value }}', schema: z.object({}) }],
			[create.ObjectStreamer.withScript, { model, prompt: 'return value', schema: z.object({}) }],
		];
		for (const [factory, config] of factories) {
			const make = factory as (config: object, parent?: object) => unknown;
			for (const options of [undefined, { autoescape: true }]) {
				assert.throws(() => make({ ...config, options }), /Use 'renderOptions'/);
				assert.throws(() => make(config, { config: { options } }), /Use 'renderOptions'/);
			}
		}
		const escaped = create.Template({ template: '{{ value }}', renderOptions: { autoescape: true } });
		assert.equal(await escaped({ value: '<b>' }), '&lt;b&gt;');
		const data = create.Function({ context: { options: { value: 3 } }, execute: input => input.options.value });
		assert.equal(await data(), 3);
		await assert.rejects(create.TextGenerator({ model, prompt: 'ready' }).run({ options: {} } as never), /Use 'renderOptions'/);
		assert.equal(model.doGenerateCalls.length, 0);
	});

	it('snapshots configuration maps on standalone and one-sided inherited paths', () => {
		const resource = { value: 1 };
		const settings = { context: { resource }, tools: { action: () => 1 }, toolsContext: { action: { factor: 2 } }, filters: { label: () => 'one' } };
		const snapshots = [processConfig(settings), mergeConfigs({}, settings), mergeConfigs(settings, {}), mergeConfigs(settings, settings)];
		for (const snapshot of snapshots) {
			for (const key of ['context', 'tools', 'toolsContext', 'filters'] as const) {
				assert.notEqual(snapshot[key], settings[key]);
				assert.deepEqual(snapshot[key], settings[key]);
			}
			assert.equal(snapshot.context.resource, resource);
			assert.equal(snapshot.toolsContext.action, settings.toolsContext.action);
		}
		assert.deepEqual(processConfig({ context: undefined }), { context: undefined });
		assert.deepEqual(mergeConfigs({}, { context: undefined }), { context: undefined });
		assert.deepEqual(mergeConfigs({ context: undefined }, {}), { context: undefined });
	});

	for (const inherited of [false, true]) it(`keeps ordinary and SDK dependencies consistent with inherited=${inherited}`, async () => {
		const resource = { value: 1 };
		const settings = { context: { resource }, inputSchema: z.object({}), execute: (input: { resource: { value: number } }) => input.resource.value };
		const component = inherited ? create.Function.asTool(settings, create.Config({})) : create.Function.asTool(settings);
		settings.context.resource = { value: 99 };
		const options = { toolCallId: 'test', messages: [], context: undefined };
		assert.equal(await component(), 1);
		assert.equal(await component.execute(await validateTypes({ schema: component.inputSchema, value: {} }), options), 1);
		resource.value = 2;
		assert.equal(await component.run({}), 2);
		assert.equal(await component.execute(await validateTypes({ schema: component.inputSchema, value: {} }), options), 2);
	});

	it('captures renderer registries, context maps and filters before caller edits', async () => {
		const action = tool({ inputSchema: z.object({}), contextSchema: z.object({ value: z.number() }),
			execute: (_input, options) => options.context.value });
		const settings = { tools: { action }, toolsContext: { action: { value: 3 } },
			filters: { label: (value: number) => `[${value}]` } };
		const parent = create.Config(settings);
		const component = create.Template.asTool({ template: '{{ action({}) | label }}', inputSchema: z.object({}) }, parent);
		settings.tools.action = tool({ inputSchema: z.object({}), contextSchema: z.object({ value: z.number() }), execute: () => 99 });
		settings.toolsContext.action = { value: 9 };
		settings.filters.label = () => 'changed';
		assert.equal(await component(), '[3]');
		assert.equal(await component.execute({}, { toolCallId: 'test', messages: [], context: undefined }), '[3]');
	});

	it('binds run-only registries forwarded through Cascada keyword arguments', async () => {
		const seen: number[] = [];
		const scale = create.Function.asTool({ inputSchema: z.object({ factor: z.number() }), context: { factor: 1 },
			execute: input => { seen.push(input.factor); return input.factor; } });
		const model = modelFor({}, 'scale');
		const component = create.TextGenerator({ model, prompt: 'ready', stopWhen: isStepCount(2) });
		const owner = create.Script({ context: { component, registry: { scale }, contexts: { scale: { factor: 5 } } },
			script: 'var result = component.run(tools=registry, toolsContext=contexts)\nreturn result.value' });
		assert.equal(await owner(), 'done');
		assert.deepEqual(seen, [5]);
	});

	for (const streaming of [false, true]) for (const rendered of [false, true]) {
		it(`binds run-only registries with streaming=${streaming}, rendered=${rendered}`, async () => {
			const seen: number[] = [];
			const scale = create.Function.asTool({ inputSchema: z.object({ value: z.number(), factor: z.number() }),
				context: { factor: 1 }, execute: input => { seen.push(input.factor); return input.value * input.factor; } });
			const model = modelFor({ value: 2 }, 'scale');
			const config = { model, prompt: 'ready', stopWhen: isStepCount(2) };
			const component = streaming
				? rendered ? create.TextStreamer.withTemplate(config) : create.TextStreamer(config)
				: rendered ? create.TextGenerator.withTemplate(config) : create.TextGenerator(config);
			// This deliberately exercises JavaScript callers: typed run overrides retain configured tool names.
			const result = await component.run({ tools: { scale }, toolsContext: { scale: { factor: 5 } } } as never);
			const value = result.value;
			assert.equal(typeof value === 'string' ? value : await collectTextStream(value), 'done');
			assert.deepEqual(seen, [5]);
			assert.equal((streaming ? model.doStreamCalls : model.doGenerateCalls).length, 2);
		});
	}

	for (const streaming of [false, true]) it(`guards run-only step context with streaming=${streaming}`, async () => {
		const scale = create.Function.asTool({ inputSchema: z.object({ factor: z.number() }), execute: input => input.factor });
		const model = modelFor({}, 'scale');
		const config = { model, prompt: 'ready' };
		const errors: unknown[] = [];
		const component = streaming ? create.TextStreamer({ ...config, onError: ({ error }) => { errors.push(error); } }) : create.TextGenerator(config);
		await assert.rejects(async () => {
			const result = await component.run({ tools: { scale }, toolsContext: { scale: { factor: 5 } },
				prepareStep: () => ({ toolsContext: { scale: { factor: 9 } } }) } as never);
			const value = result.value;
			if (typeof value !== 'string') await collectTextStream(value);
		}, /cannot change within an invocation/);
		if (streaming) assert.match(String(errors[0]), /cannot change within an invocation/);
		assert.equal((streaming ? model.doStreamCalls : model.doGenerateCalls).length, 0);
	});
});
