import assert from 'node:assert/strict';
import { asSchema, jsonSchema } from 'ai';
import { lazySchema, validateTypes } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { create, ConfigError } from './cascada';
import type { SchemaType } from './cascada';
import { inputNames, contextNames } from '../src/schema.js';
import type { JSONSchema } from '../src/schema.js';

function configured(schema: SchemaType<any>, context: Record<string, unknown>) {
	return create.Function.asTool({ inputSchema: schema, context, execute: value => value });
}
const metadata = async (schema: SchemaType<any>, context: Record<string, unknown>) => await asSchema(configured(schema, context).inputSchema).jsonSchema;
const object: JSONSchema = { type: 'object', properties: { value: { type: 'number' } }, required: ['value'], additionalProperties: false };

describe('Schema presence in configuration', () => {
	it('preserves raw input and absent defaults when an optional input schema is omitted', async () => {
		const inputSchema = z.object({ value: z.string().transform(Number), count: z.number().default(1) });
		for (const settings of [{}, { inputSchema }, { inputSchema: undefined }] satisfies { inputSchema?: typeof inputSchema | undefined }[]) {
			const component = create.Function({ ...settings, execute: ({ value, count }) => ({ value, count }) });
			assert.deepEqual(await component({ value: '2' }), settings.inputSchema ? { value: 2, count: 1 } : { value: '2', count: undefined });
		}
	});

	it('preserves unparsed output for ordinary, named, tool and registered calls', async () => {
		const schema = z.string().transform(Number);
		for (const settings of [{}, { schema }, { schema: undefined }] satisfies { schema?: typeof schema | undefined }[]) {
			const component = create.Function({ ...settings, execute: () => '2' });
			const tool = create.Function.asTool({ ...settings, inputSchema: z.object({}), execute: () => '2' });
			const owner = create.Function({ tools: { tool }, execute: ({ tool }) => tool({}) });
			const expected = settings.schema ? 2 : '2';
			assert.equal(await component(), expected);
			assert.equal(await component.run({}), expected);
			assert.equal(await tool.execute({}, { toolCallId: 'presence', messages: [], context: undefined }), expected);
			assert.equal(await owner(), expected);
		}
	});

	it('inherits an omitted schema and removes an explicitly undefined schema', async () => {
		const schema = z.string().transform(Number);
		const parent = create.Config({ schema });
		const inherited = create.Function({ execute: () => '2' }, parent);
		const removed = create.Function({ schema: undefined, execute: () => '2' }, parent);
		assert.equal(await inherited(), 2);
		assert.equal(await removed(), '2');
		for (const settings of [{}, { schema }] satisfies { schema?: typeof schema }[]) {
			const fragment = create.Config(settings);
			const child = create.Function({ execute: () => '2' }, fragment);
			assert.equal(await child(), settings.schema ? 2 : '2');
			assert.equal(await create.Function({ schema, execute: () => '2' }, fragment)(), 2);
		}
	});

	it('keeps configured data private when an optional input parser is absent', async () => {
		const _inputSchema = z.object({ value: z.string().transform(Number) });
		const settings: { inputSchema?: typeof _inputSchema } = {};
		const component = create.Function({ ...settings, context: { value: '2' }, execute: ({ value }) => value });
		assert.equal(await component(), '2');
		// Deliberately bypass caller typing to verify the unchanged runtime boundary.
		await assert.rejects(() => (component as (input: unknown) => Promise<unknown>)({ value: '3' }));
	});
});

describe('Production schema declaration and projection boundaries', () => {
	for (const first of ['metadata', 'validation'] as const) it(`shares binding preparation when ${first} is the first consumer`, async () => {
		let parses = 0;
		const component = create.Function.asTool({ inputSchema: z.object({ factor: z.number() }), context: { factor: 3 },
			toolContextSchema: z.object({ factor: z.string() }).transform(async value => { parses++; await Promise.resolve(); return { factor: Number(value.factor) }; }),
			execute: input => input.factor });
		const raw = { factor: '5' };
		const binding = component.bindToolContext(raw);
		raw.factor = '9';
		const metadata = () => asSchema(binding.tool.inputSchema).jsonSchema;
		const validation = () => validateTypes({ schema: binding.tool.inputSchema, value: {} });
		const initial = first === 'metadata' ? metadata() : validation();
		await Promise.all([initial, metadata(), validation()]);
		assert.deepEqual(await validation(), { factor: 5 });
		assert.equal(parses, 1);
		assert.equal(component.config.context.factor, 3);
	});

	it('keeps the original schema while wrapping every SDK input boundary', async () => {
		const schema = z.object({ value: z.number() });
		const component = create.Function.asTool({ inputSchema: schema, execute: ({ value }) => value });
		assert.notEqual(component.inputSchema, schema);
		assert.equal(component.config.inputSchema, schema);
		await assert.rejects(validateTypes({ schema: component.inputSchema, value: { value: 1, extra: true } }), /Undeclared tool input keys: extra/);
	});

	it('discovers wrapped declarations without executing callbacks', async () => {
		let evaluated = 0;
		const base = z.object({ value: z.number() });
		const wrappers = [
			base.nullable(), base.default(() => { evaluated++; return { value: 1 }; }),
			base.prefault(() => { evaluated++; return { value: 1 }; }), base.catch(() => { evaluated++; return { value: 1 }; }),
			base.readonly(), base.optional().nonoptional(), base.transform(value => { evaluated++; return value; }),
			base.optional(), base.brand<'value'>(),
		];
		for (const schema of wrappers) assert.deepEqual(await inputNames(schema), ['value']);
		assert.equal(evaluated, 0);
		assert.deepEqual(contextNames(base.default({ value: 1 }).catch({ value: 2 })), ['value']);
		assert.deepEqual(contextNames(base.pipe(z.object({ value: z.number(), optionalPrivate: z.string().optional() }))), ['value', 'optionalPrivate']);
	});

	it('resolves lazy output declarations and leaves bounded fallback to metadata', async () => {
		const context = z.lazy(() => z.object({ user: z.string().optional() }));
		let wrapped: z.core.$ZodType = context;
		for (let i = 0; i < 12; i++) wrapped = new z.core.$ZodReadonly({ type: 'readonly', innerType: wrapped });
		const recursive: z.core.$ZodType = z.lazy(() => z.union([z.object({ user: z.string().optional() }), recursive]));
		for (const toolContextSchema of [context, wrapped, recursive]) {
			const operation = create.Function.asTool({ inputSchema: z.object({}), toolContextSchema, execute: input => input });
			await assert.rejects(operation({ user: 'admin' } as never), /Undeclared tool input keys: user/);
			await assert.rejects(validateTypes({ schema: operation.bindToolContext({}).tool.inputSchema, value: { user: 'admin' } }), /Undeclared tool input keys: user/);
			assert.deepEqual(contextNames(toolContextSchema), ['user']);
		}
		let deep: z.core.$ZodType = z.object({ value: z.number() });
		for (let i = 0; i < 12; i++) deep = new z.core.$ZodReadonly({ type: 'readonly', innerType: deep });
		assert.deepEqual(await inputNames(deep), ['value']);
		assert.deepEqual(contextNames(deep), ['value'], 'Known private names must not be discarded by a traversal cutoff.');
		await assert.rejects(inputNames(z.intersection(z.unknown(), z.object({ value: z.number() }))), ConfigError);
	});

	it('resolves promised and lazy metadata, including root declarations beside union branches', async () => {
		const schema = lazySchema(() => jsonSchema<Record<string, unknown>>(async () => ({
			properties: { root: { type: 'number' } }, required: ['root'],
			oneOf: [{ type: 'object', properties: { a: {} } }, { type: 'object', required: ['b'] }],
		})));
		assert.deepEqual(await inputNames(schema), ['root', 'a', 'b']);
		assert.deepEqual(await inputNames(jsonSchema({ type: 'object' })), []);
		assert.deepEqual(await inputNames(z.discriminatedUnion('kind', [
			z.object({ kind: z.literal('a'), a: z.string() }), z.object({ kind: z.literal('b'), b: z.number() }),
		])), ['kind', 'a', 'b']);
	});

	it('rejects unsupported partitioning without probing validators', async () => {
		for (const schema of [jsonSchema({ $ref: '#/$defs/input' }), jsonSchema({ type: 'number' }),
			jsonSchema({ allOf: [{ type: 'object' }] }), jsonSchema({ anyOf: [true] }),
			z.union([z.object({ value: z.number() }), z.union([z.object({ a: z.number() }), z.object({ b: z.number() })])])]) {
			await assert.rejects(inputNames(schema), ConfigError);
		}
		const unsupported = configured(jsonSchema({ anyOf: [{ type: 'object', properties: { value: {} }, additionalProperties: false }] }), { value: 1 });
		await assert.rejects(async () => await asSchema(unsupported.inputSchema).jsonSchema, /independent object schema/);
	});

	it('requires an object at raw and parsed context boundaries', async () => {
		const plain = create.Function({ execute: () => 1 });
		for (const value of [null, [], 'text', 1]) {
			await assert.rejects(plain(value as never), /object context/);
		}
		for (const value of [null, [], 'text', 1, undefined]) {
			const component = create.Function({
				inputSchema: jsonSchema<Record<string, unknown>>({}, { validate: () => ({ success: true, value: value as never }) }),
				execute: () => { throw new Error('Must not execute'); },
			});
			await assert.rejects(component({}), /object context/);
		}
	});

	it('annotates only faithful configured JSON values and never evaluates accessors', async () => {
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		let reads = 0;
		const accessor = Object.defineProperty({}, 'secret', { enumerable: true, get() { reads++; return 'private'; } });
		const invalid = [NaN, Infinity, undefined, new Date(), () => 1, cycle, accessor, [undefined], Array(1)];
		for (const value of invalid) {
			const projected = await metadata(jsonSchema({ type: 'object', properties: { value: {} }, additionalProperties: false }), { value });
			assert.deepEqual(projected.properties?.value, {});
		}
		assert.equal(reads, 0);
		for (const value of [null, true, 'text', 3, [1, 'text'], { nested: { value: 2 } }]) {
			const projected = await metadata(jsonSchema({ type: 'object', properties: { value: {} }, additionalProperties: false }), { value });
			assert.deepEqual(projected.properties?.value, { default: value });
		}
		const component = configured(jsonSchema(object), { value: 3 });
		const bound = component.bindToolContext({ value: 5 });
		const projected = await asSchema(bound.tool.inputSchema).jsonSchema;
		assert.deepEqual(projected.required, []);
		assert.deepEqual(projected.properties?.value, { type: 'number' });
		assert.deepEqual(object.required, ['value']);
	});

	it('rejects schema references only when required projection changes', async () => {
		const ref = { $ref: '#/$defs/value' };
		const positions: JSONSchema[] = [
			{ properties: { value: ref } }, { patternProperties: { '.*': ref } },
			{ $defs: { value: ref } }, { definitions: { value: ref } },
			{ properties: { value: { allOf: [ref] } } }, { properties: { value: { items: ref } } },
			{ properties: { value: { items: [ref] } } }, { properties: { value: { additionalProperties: ref } } },
			{ properties: { value: { dependencies: { other: ref } } } },
			{ properties: { default: ref } }, { properties: { enum: ref } }, { properties: { examples: ref } },
		];
		for (const nested of positions) {
			// Unsupported root constraints fail as well; none may be silently rewritten.
			await assert.rejects(metadata(jsonSchema({ ...object, ...nested, required: ['value'] }), { value: 1 }), ConfigError);
		}
		const unchanged = jsonSchema<Record<string, unknown>>({ ...object, properties: { value: ref } });
		assert.deepEqual(await metadata(unchanged, { value: undefined }), await asSchema(unchanged).jsonSchema);
		const literal = { ...object, properties: { value: { const: { $ref: 'data' } } }, examples: [{ $ref: 'data' }] };
		assert.deepEqual((await metadata(jsonSchema(literal), { value: 1 })).required, []);
		assert.deepEqual((await metadata(jsonSchema({ type: 'object', properties: { value: true }, additionalProperties: false }), { value: 1 })).properties, { value: true });
	});
});
