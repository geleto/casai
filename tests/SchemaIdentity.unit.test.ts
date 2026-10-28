import assert from 'node:assert/strict';
import { copyFileSync, cpSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { z } from 'zod/v4';
import { z as z3 } from 'zod/v3';
import * as mini from 'zod/mini';
import { ToolLoopAgent, isStepCount } from 'ai';
import type { FlexibleSchema, Tool } from 'ai';
import { validateTypes } from '@ai-sdk/provider-utils';
import type { ExecutableTool } from '@ai-sdk/provider-utils';
import { create, streamSchema } from './cascada';
import { contextNames, inputNames } from '../src/schema.js';
import { modelFor } from './fixtures/phase2-security-sdk.js';

interface Case { name: string; schema: FlexibleSchema<unknown> }
type Fields = Record<string, unknown>;
type TestTool = Tool<Fields, unknown, unknown> & {
	execute: NonNullable<Tool<Fields, unknown, unknown>['execute']>;
	(input?: Fields): Promise<unknown>;
	run(settings: { context: Fields }): Promise<unknown>;
	bindToolContext(context: unknown): { tool: Tool<Fields, unknown, unknown>; context: unknown };
};
// This runtime matrix deliberately erases schema types. The exact public caller
// checks use concrete schemas in type-safety/schema-identity.ts.
type TestFactory = (config: object) => TestTool;
function runtimeFactory(factory: unknown): TestFactory { return factory as TestFactory; }
const makeTool = runtimeFactory(create.Function.asTool);
const makeScriptTool = runtimeFactory(create.Script.asTool);
const makeTemplateTool = runtimeFactory(create.Template.asTool);
function classicCases(api: typeof z): Case[] {
	const base = api.object({ userId: api.string().optional() });
	const schemas: unknown[] = [base, base.optional(), base.default({}), base.prefault({}), base.catch({}), base.readonly(), base.optional().nonoptional(),
		base.refine(() => true), base.and(api.object({})), base.and(api.object({}).transform(value => value)),
		api.union([base, api.object({}).transform(value => value)]), api.looseObject({}).transform(value => value).pipe(base),
	];
	return schemas.map((schema, index) => ({ name: `classic/${index}`, schema: schema as FlexibleSchema<unknown> }));
}
function miniCases(api: typeof mini): Case[] {
	const base = api.object({ userId: api.optional(api.string()) });
	const schemas: unknown[] = [base, api.optional(base), api._default(base, {}), api.prefault(base, {}), api.catch(base, {}), api.readonly(base),
		api.nonoptional(api.optional(base)), base.check(api.refine(() => true)), api.intersection(base, api.object({})),
		api.union([base, api.pipe(api.object({}), api.transform(value => value))]), api.pipe(api.looseObject({}), base),
	];
	return schemas.map((schema, index) => ({ name: `mini/${index}`, schema: schema as FlexibleSchema<unknown> }));
}

describe('Production schema identity and declaration boundaries', () => {
	let directory: string;
	let cases: Case[];
	let copies: { z: typeof z; z3: typeof z3; mini: typeof mini };
	before(async function () {
		this.timeout(60000);
		directory = mkdtempSync(join(tmpdir(), 'casai-schema-identity-'));
		const root = dirname(createRequire(import.meta.url).resolve('zod/package.json'));
		// Copy only runtime modules; declaration/source/docs copies add no identity evidence.
		for (const folder of ['v3', 'v4']) cpSync(join(root, folder), join(directory, 'zod', folder), {
			recursive: true, filter: source => statSync(source).isDirectory() || source.endsWith('.js') || source.endsWith('package.json'),
		});
		copyFileSync(join(root, 'package.json'), join(directory, 'zod', 'package.json'));
		const load = async (path: string): Promise<unknown> => await import(pathToFileURL(join(directory, 'zod', path)).href);
		copies = { z: (await load('v4/index.js') as { z: typeof z }).z, z3: (await load('v3/index.js') as { z: typeof z3 }).z,
			mini: await load('v4/mini/index.js') as typeof mini };
		assert.notEqual(copies.z3.ZodObject, z3.ZodObject);
		assert.notEqual(copies.z.ZodObject, z.ZodObject);
		cases = [...classicCases(z), ...miniCases(mini),
			...classicCases(copies.z), ...miniCases(copies.mini)].map((entry, index) => ({ ...entry, name: `${index}/${entry.name}` }));
	});
	after(() => {
		if (directory) {
			assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
			assert.ok(directory.includes('casai-schema-identity-'));
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it('rejects Zod 3 component schemas across installations without limiting native tools', async () => {
		const model = modelFor(undefined);
		const configFactory: unknown = create.Config;
		const constructors: [unknown, object, string[]][] = [
			[configFactory, {}, ['inputSchema', 'toolContextSchema', 'schema']],
			[create.Function, { execute: () => 1 }, ['inputSchema', 'schema']],
			[create.Function.asTool, { inputSchema: z.object({}), execute: () => 1 }, ['inputSchema', 'schema', 'toolContextSchema']],
			[create.Script, { script: 'return 1' }, ['inputSchema', 'schema']],
			[create.Script.asTool, { script: 'return 1', inputSchema: z.object({}) }, ['inputSchema', 'schema', 'toolContextSchema']],
			[create.Template.asTool, { template: 'ok', inputSchema: z.object({}) }, ['inputSchema', 'toolContextSchema']],
			[create.LLMAgent.withTemplate, { model, prompt: 'ok' }, ['inputSchema']],
			[create.LLMAgent.withFunction.asTool, { model, prompt: () => 'ok', inputSchema: z.object({}) }, ['inputSchema', 'toolContextSchema']],
			[create.LLMAgent.withTemplate.asStream, { model, prompt: 'ok' }, ['inputSchema']],
			[create.LLMAgent.withTemplate.asTool, { model, prompt: 'ok', inputSchema: z.object({}) }, ['inputSchema', 'toolContextSchema']],
			[create.LLMAgent.withTemplate.asStream, { model, prompt: 'ok' }, ['inputSchema']],
		];
		for (const api of [z3, copies.z3]) {
			const schema = api.object({ userId: api.string().optional() });
			for (const [factory, config, keys] of constructors) for (const key of keys) {
				assert.throws(() => (factory as (config: object) => unknown)({ ...config, [key]: schema }), /Casai schemas require Zod 4/, key);
			}
			assert.throws(() => (streamSchema as (schema: unknown) => unknown)(schema), /Casai schemas require Zod 4/);
			const inherited: unknown = create.Function;
			assert.throws(() => (inherited as (config: object, parent: object) => unknown)({ execute: () => 1 }, { config: { inputSchema: schema } }), /Casai schemas require Zod 4/);
		}
		// This checks native runtime delegation; Zod 3 inference belongs to the SDK.
		const native = { inputSchema: z3.object({ value: z3.number() }), execute: (input: { value: number }) => input.value * 2 } as unknown as ExecutableTool<Tool<{ value: number }, number>>;
		const owner = create.Function({ tools: { native }, execute: input => input.native({ value: 3 }) });
		assert.equal(await owner(), 6);
	});

	it('discovers declared output names across installations, wrappers and partial composition', async () => {
		for (const { name, schema } of cases) {
			assert.deepEqual(contextNames(schema), ['userId'], name);
			assert.deepEqual(await validateTypes({ schema, value: {} }), {}, name);
		}
		let evaluated = 0;
		for (const api of [z, copies.z]) {
			const transformed = api.object({ rawId: api.string().optional() }).transform(() => { evaluated++; return {}; });
			assert.deepEqual(contextNames(transformed), []);
			assert.deepEqual(contextNames(transformed.pipe(api.object({ userId: api.string().optional() }))), ['userId']);
		}
		assert.equal(evaluated, 0, 'Declaration discovery must not execute transformations.');
	});

	it('uses non-JSON input declarations locally without metadata conversion', async () => {
		for (const api of [z, copies.z]) {
			const schema = api.object({ when: api.date(), name: api.string() });
			const fn = create.Function({ inputSchema: schema, context: { name: 'Ada' }, execute: input => input.when });
			assert.equal((await fn({ when: new Date(0) })).getTime(), 0);
		}
		for (const api of [mini, copies.mini]) {
			const schema = api.object({ when: api.date(), name: api.string() });
			assert.deepEqual(await inputNames(schema), ['when', 'name']);
			const fn = create.Function({ inputSchema: schema, context: { name: 'Ada' }, execute: input => input.when });
			assert.equal((await fn({ when: new Date(0) })).getTime(), 0);
		}
		for (const api of [z, copies.z]) {
			const schema = api.object({ when: api.date(), name: api.string() }).pipe(api.object({ when: api.date(), name: api.string() }));
			assert.deepEqual(await inputNames(schema), ['when', 'name']);
			const fn = create.Function({ inputSchema: schema, context: { name: 'Ada' }, execute: input => input.when });
			assert.equal((await fn({ when: new Date(0) })).getTime(), 0);
		}
	});

	it('protects absent declarations through ordinary, run, injected and rendered calls', async () => {
		for (const { name, schema } of cases) {
			const child = makeTool({ inputSchema: z.object({ extra: z.string().optional() }), toolContextSchema: schema, execute: () => 'safe' });
			// Runtime attacks deliberately bypass the compiler; static neighbors are in schema-identity.ts.
			const input = { userId: 'attacker' };
			await assert.rejects(child(input), /Undeclared tool input keys: userId/, name);
			await assert.rejects(child.run({ context: input }), /Undeclared tool input keys: userId/, name);
			assert.equal(await child({ extra: 'allowed' }), 'safe', name);
			for (const coded of [
				makeScriptTool({ inputSchema: z.object({ extra: z.string().optional() }), toolContextSchema: schema, script: 'return "safe"' }),
				makeTemplateTool({ inputSchema: z.object({ extra: z.string().optional() }), toolContextSchema: schema, template: 'safe' }),
			]) {
				await assert.rejects(coded(input), /Undeclared tool input keys: userId/, name);
				await assert.rejects(coded.run({ context: input }), /Undeclared tool input keys: userId/, name);
				assert.equal(await coded({ extra: 'allowed' }), 'safe', name);
			}
			const owner = create.Function({ tools: { child }, toolsContext: { child: {} }, execute: input => input.child({ userId: 'attacker' }) });
			await assert.rejects(owner(), /Undeclared tool input keys: userId/, name);
			for (const renderer of [create.Script({ script: 'return child(userId="attacker")', tools: { child }, toolsContext: { child: {} } }),
				create.Template({ template: '{{ child(userId="attacker") }}', tools: { child }, toolsContext: { child: {} } })]) {
				await assert.rejects(renderer(), /Undeclared tool input keys: userId/, name);
			}
		}
	});

	for (const mode of ['generate', 'stream'] as const) it(`${mode}: protects bare and bound tools before hooks, approval and execution`, async () => {
		for (const { name, schema } of cases) for (const bound of [false, true]) {
			let entered = 0, hooks = 0, approvals = 0;
			const component = makeTool({ inputSchema: z.object({ extra: z.string().optional() }), toolContextSchema: schema,
				onInputAvailable: () => { hooks++; }, needsApproval: () => { approvals++; return false; }, execute: () => ++entered });
			const binding = bound ? component.bindToolContext({}) : { tool: component, context: {} };
			const model = modelFor({ userId: 'attacker' });
			const agent = new ToolLoopAgent({ model, tools: { probe: binding.tool }, toolsContext: { probe: binding.context } as never, stopWhen: isStepCount(2) });
			const result = await agent[mode]({ prompt: 'run' });
			const steps = await result.steps;
			assert.equal(entered, 0, name);
			assert.equal(hooks, 0, name);
			assert.equal(approvals, 0, name);
			assert.equal(steps.length, 2, name);
			const calls = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
			assert.equal(calls.length, 2, name);
			assert.match(JSON.stringify(calls[1].prompt), /Undeclared tool input keys: userId/, name);
		}
	});
});
