import assert from 'node:assert/strict';
import { asSchema, isStepCount, jsonSchema, ToolLoopAgent, tool } from 'ai';
import type { FlexibleSchema, Tool } from 'ai';
import { validateTypes } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import * as mini from 'zod/mini';
import { create } from './cascada';
import { inputNames } from '../src/schema.js';
import { modelFor } from './fixtures/phase2-security-sdk.js';
import { explicitMetadata } from './fixtures/phase2-api-schemas.js';

type Fields = Record<string, unknown>;
type RuntimeTool = Tool<Fields, unknown, unknown> & {
	(input: Fields): Promise<unknown>;
	run(settings: { context: Fields }): Promise<unknown>;
	bindToolContext(context: unknown): { tool: Tool<Fields, unknown, unknown>; context: unknown };
};
// The matrix exercises invalid runtime inputs; uncast factory admission is paired in type-safety.
function make(factory: unknown, config: object, parent?: { config: object }): RuntimeTool {
	return (factory as (config: object, parent?: { config: object }) => RuntimeTool)(config, parent);
}
const metadata = { type: 'object' as const, properties: { value: { type: 'number' as const } }, additionalProperties: false };

describe('Closed Casai tool inputs', () => {
	for (const kind of ['strip', 'strict', 'preprocess', 'sdk', 'standard'] as const) {
		it(`${kind}: rejects undeclared keys before validation on ordinary, named, bare and bound calls`, async () => {
			let parsed = 0, executed = 0;
			const base = z.object({ value: z.number() });
			const schema = kind === 'sdk' ? jsonSchema(metadata, { validate: value => { parsed++; return { success: true, value: value as Fields }; } })
				: kind === 'standard' ? explicitMetadata(base.transform(value => { parsed++; return value; }), metadata)
					: kind === 'preprocess' ? z.preprocess(value => { parsed++; return value; }, base)
						: (kind === 'strict' ? base.strict() : base).transform(value => { parsed++; return value; });
			const operation = make(create.Function.asTool, { inputSchema: schema, context: { value: 3 }, execute: () => ++executed });
			const binding = operation.bindToolContext({ value: 5 });
			const paths = [
				(input: Fields) => operation(input), (input: Fields) => operation.run({ context: input }),
				(input: Fields) => validateTypes({ schema: operation.inputSchema, value: input }),
				(input: Fields) => validateTypes({ schema: binding.tool.inputSchema, value: input }),
			];
			for (const invoke of paths) for (const key of ['userId', '__proto__', 'constructor', 'toString', '_toolOptions', Symbol('private')]) {
				await assert.rejects(() => invoke(Object.fromEntries([[key, 'attacker']])), /Undeclared tool input keys/);
			}
			assert.equal(parsed, 0);
			assert.equal(executed, 0);
			assert.equal(await operation({}), 1);
			assert.equal(parsed, 1);
			assert.deepEqual(await validateTypes({ schema: binding.tool.inputSchema, value: {} }), { value: 5 });
			assert.equal(parsed, 2);
		});
	}

	it('rejects open roots and open alternatives without traversing nested dictionaries', async () => {
		const open = z.looseObject({ value: z.number() });
		let wrappedOpen: z.ZodType = open, wrappedClosed: z.ZodType = z.object({ value: z.number() });
		for (let depth = 0; depth < 14; depth++) {
			wrappedOpen = wrappedOpen.readonly();
			wrappedClosed = wrappedClosed.readonly();
		}
		const schemas: FlexibleSchema<unknown>[] = [open, open.optional(), open.readonly(), z.lazy(() => open),
			z.preprocess((value: unknown) => value, open), open.transform(value => value), z.object({}).catchall(z.number()),
			z.union([z.object({ value: z.number() }), open]), z.intersection(z.object({}), open), mini.looseObject({}),
			z.record(z.string(), z.number()), mini.record(mini.string(), mini.number()),
			z.record(z.enum(['left', 'right']), z.number()),
			explicitMetadata(z.looseObject({ value: z.number() }), { ...metadata, additionalProperties: true }),
			jsonSchema({ ...metadata, additionalProperties: true }), jsonSchema({ type: 'object', properties: {} }),
			jsonSchema({ ...metadata, patternProperties: { '.*': {} } }), wrappedOpen,
		];
		for (const schema of schemas) {
			const operation = make(create.Function.asTool, { inputSchema: schema, execute: () => assert.fail('body must not run') });
			await assert.rejects(operation({ value: 1 }), /closed root object/);
			await assert.rejects(async () => await asSchema(operation.inputSchema).jsonSchema, /closed root object/);
		}
		const nested = z.object({ attributes: z.record(z.string(), z.unknown()), payload: z.looseObject({}) });
		assert.deepEqual(await inputNames(nested, true), ['attributes', 'payload']);
		assert.deepEqual(await inputNames(z.union([z.object({ a: z.number() }), z.object({ b: z.string() })]), true), ['a', 'b']);
		assert.deepEqual(await inputNames(z.intersection(z.object({ a: z.number() }), z.object({ b: z.string() })), true), ['a', 'b']);
		assert.deepEqual(await inputNames(mini.object({ value: mini.number() }), true), ['value']);
		assert.deepEqual(await inputNames(wrappedClosed, true), ['value']);
		const inherited = make(create.Function.asTool, {}, { config: { inputSchema: open, execute: () => 1 } });
		await assert.rejects(inherited({ value: 1 }), /closed root object/);
	});

	it('keeps nested public data separate from private bindings and retains transform collision checks', async () => {
		const operation = create.Function.asTool({ context: { userId: 'trusted' },
			inputSchema: z.object({ attributes: z.record(z.string(), z.string()) }),
			execute: ({ userId, attributes }) => ({ userId, attributes }) });
		assert.deepEqual(await operation({ attributes: { userId: 'public' } }), { userId: 'trusted', attributes: { userId: 'public' } });
		const transformed = create.Function.asTool({ context: { userId: 'trusted' },
			inputSchema: z.object({ alias: z.string() }).transform(({ alias }) => ({ userId: alias })), execute: () => assert.fail() });
		await assert.rejects(transformed({ alias: 'attacker' }), /Private input keys: userId/);
	});

	it('keeps parsed execution distinct from raw SDK history revalidation', async () => {
		const inputSchema = z.object({ alias: z.string().default('fallback') }).transform(({ alias }) => ({ label: alias }));
		const operation = create.Function.asTool({ inputSchema, execute: input => input.label });
		const parsed = await validateTypes({ schema: operation.inputSchema, value: {} });
		assert.equal(await operation.execute(parsed, { toolCallId: 'test', messages: [], context: undefined }), 'fallback');
		// Native stripping can discard a renamed history key and apply a default.
		assert.deepEqual(await validateTypes({ schema: inputSchema, value: parsed }), parsed);
		// Casai's approved raw-key rule also applies when the SDK revalidates history.
		await assert.rejects(validateTypes({ schema: operation.inputSchema, value: parsed }), /Undeclared tool input keys: label/);
	});

	it('enforces the boundary in every rendered component family and injected helper', async () => {
		let prepared = 0;
		const inputSchema = z.preprocess(value => { prepared++; return value; }, z.object({ value: z.number() }));
		const model = modelFor(undefined);
		const cases: [unknown, object][] = [
			[create.Function.asTool, { execute: () => 'ok' }],
			[create.Script.asTool, { script: 'return "ok"' }],
			[create.Template.asTool, { template: 'ok' }],
			[create.TextGenerator.withTemplate.asTool, { model, prompt: 'ok' }],
			[create.TextGenerator.withScript.asTool, { model, prompt: 'return "ok"' }],
			[create.TextGenerator.withFunction.asTool, { model, prompt: () => 'ok' }],
			[create.ObjectGenerator.withTemplate.asTool, { model, prompt: 'ok', schema: z.object({}) }],
			[create.ObjectGenerator.withScript.asTool, { model, prompt: 'return "ok"', schema: z.object({}) }],
		];
		for (const [factory, config] of cases) {
			const component = make(factory, { ...config, inputSchema });
			await assert.rejects(component({ value: 1, userId: 'attacker' }), /Undeclared tool input keys: userId/);
			await assert.rejects(component.run({ context: { value: 1, userId: 'attacker' } }), /Undeclared tool input keys: userId/);
			const owner = create.Script({ tools: { component }, script: 'return component(value=1, userId="attacker")' });
			await assert.rejects(owner(), /Undeclared tool input keys: userId/);
		}
		assert.equal(prepared, 0);
		assert.equal(model.doGenerateCalls.length + model.doStreamCalls.length, 0);
	});

	for (const mode of ['generate', 'stream'] as const) for (const bound of [false, true]) {
		it(`${mode}/${bound ? 'bound' : 'bare'}: rejects before completed-input hooks, approval and execution`, async () => {
			let parsed = 0, hooks = 0, approvals = 0, executed = 0;
			const probe = create.Function.asTool({ inputSchema: z.preprocess(value => { parsed++; return value; }, z.object({ value: z.number() })),
				toolContextSchema: z.object({ label: z.string() }), onInputAvailable: () => { hooks++; }, needsApproval: () => { approvals++; return true; }, execute: () => ++executed });
			const context = { label: 'fixed' };
			const binding = bound ? probe.bindToolContext(context) : { tool: probe, context };
			const model = modelFor({ value: 1, userId: 'attacker' });
			const agent = new ToolLoopAgent({ model, tools: { probe: binding.tool }, toolsContext: { probe: binding.context }, stopWhen: isStepCount(2) });
			const result = mode === 'generate' ? await agent.generate({ prompt: 'test' }) : await agent.stream({ prompt: 'test' });
			assert.equal(await result.text, 'done');
			assert.equal((await result.steps).length, 2);
			assert.deepEqual({ parsed, hooks, approvals, executed }, { parsed: 0, hooks: 0, approvals: 0, executed: 0 });
		});
	}

	it('preserves ordinary stripping/open schemas and native open tools', async () => {
		const strip = create.Function({ inputSchema: z.object({ value: z.number() }), execute: input => input.value });
		assert.equal(await strip({ value: 1, extra: true } as { value: number }), 1);
		const open = create.Function({ inputSchema: z.looseObject({ value: z.number() }), execute: input => input.extra });
		assert.equal(await open({ value: 1, extra: true }), true);
		const native = tool({ inputSchema: z.looseObject({}), execute: input => input.extra });
		const owner = create.Function({ tools: { native }, execute: input => input.native({ extra: true }) });
		assert.equal(await owner(), true);
	});
});
