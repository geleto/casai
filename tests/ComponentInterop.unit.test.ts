import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isStepCount } from 'ai';
import * as local from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';

describe('Independent Casai instances', () => {
	const workspace = fileURLToPath(new URL('../', import.meta.url));
	const cache = join(workspace, 'node_modules/.cache/casai');
	let directory: string;
	let foreign: typeof local;
	before(async () => {
		mkdirSync(cache, { recursive: true });
		directory = mkdtempSync(join(cache, 'instance-'));
		writeFileSync(join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
		cpSync(join(workspace, 'src'), join(directory, 'src'), { recursive: true });
		foreign = await import(pathToFileURL(join(directory, 'src/index.ts')).href) as typeof local;
		assert.notEqual(foreign.create.Function, local.create.Function);
	});
	after(() => {
		assert.equal(dirname(resolve(directory)), resolve(cache));
		rmSync(directory, { recursive: true, force: true });
	});

	it('preserves foreign component binding and guards through injected and SDK consumers', async () => {
		for (const [author, owner] of [[foreign, local], [local, foreign]]) {
			let entered = 0;
			const db = {};
			const operation = author.create.Function.asTool({ inputSchema: author.z.object({ factor: author.z.number() }),
				context: { factor: 3, db }, execute: input => { entered++; assert.equal(input.db, db); return input.factor; } });
			const tools = { operation }, toolsContext = { operation: { factor: 5 } };
			const caller = owner.create.Function({ tools, toolsContext, execute: ({ operation }) => operation({}) });
			assert.equal(await caller(), 5);
			assert.equal(await caller.run({}), 5);
			assert.equal(await owner.create.Script({ tools, toolsContext, script: 'return operation({})' })(), 5);
			assert.equal(await owner.create.Template({ tools, toolsContext, template: '{{ operation({}) }}' })(), '5');
			for (const factory of ['generate', 'stream'] as const) {
				const settings = { model: modelFor({}, 'operation'), prompt: 'go', tools, toolsContext, stopWhen: isStepCount(2) };
				const component = factory === 'generate' ? owner.create.LLMAgent(settings) : owner.create.LLMAgent.asStream(settings);
				const result = await component();
				const steps = await result.steps;
				assert.equal(steps[0].toolResults[0].output, 5);
			}
			assert.equal(entered, 6);
			// Runtime negative: static calls already reject the private field.
			const unsafe = owner.create.Function({ tools, toolsContext, execute: ({ operation }) =>
				(operation as (input: object) => Promise<unknown>)({ db: 'untrusted' }) });
			await assert.rejects(unsafe(), /Undeclared tool input keys: db/);
			assert.equal(entered, 6);
			// eslint-disable-next-line @typescript-eslint/no-misused-spread -- Exercise the explicitly unsupported descriptor copy.
			const spread = { ...operation };
			assert.equal(typeof Reflect.get(operation, '_bindToolContext'), 'function');
			assert.equal('_bindToolContext' in spread, false);
			const makeInvalid = owner.create.Function as unknown as (config: object) => () => Promise<unknown>;
			await assert.rejects(makeInvalid({ tools: { spread }, execute: () => 1 })(), /Do not spread Casai components/);
		}
	});

	it('preserves already-bound descriptors and their context across instances', async () => {
		for (const [author, owner] of [[foreign, local], [local, foreign]]) {
			const operation = author.create.Function.asTool({ inputSchema: author.z.object({ factor: author.z.number() }),
				context: { factor: 3 }, execute: input => input.factor });
			const binding = operation.bindToolContext({ factor: 5 });
			const tools = { operation: binding.tool };
			const caller = owner.create.Function({ tools, toolsContext: { operation: binding.context },
				// Native descriptors erase configured-default typing; exercise the runtime binding contract.
				execute: ({ operation }) => (operation as (input: object) => Promise<unknown>)({}) });
			assert.equal(await caller(), 5);
			assert.equal(await caller(), 5);
			const changed = owner.create.Function({ tools, toolsContext: { operation: { factor: 7 } },
				execute: () => { throw new Error('A mismatched binding must fail before execution.'); } });
			await assert.rejects(changed(), /Bound tool context 'operation' must match its binding/);
			assert.equal(await caller(), 5);
		}
	});

	it('collects foreign text and element stream schemas', async () => {
		for (const [author, owner] of [[foreign, local], [local, foreign]]) {
			const text = owner.create.Function.asTool({ inputSchema: owner.z.object({}), schema: author.textStreamSchema(),
				execute: async function* () { yield 'hello'; yield ' world'; } });
			const elements = owner.create.Function.asTool({ inputSchema: owner.z.object({}), schema: author.streamSchema(author.z.string().transform(Number)),
				execute: async function* () { yield '2'; yield '3'; } });
			const caller = owner.create.Function({ tools: { text, elements }, execute: async ({ text, elements }) => [await text({}), await elements({})] });
			assert.deepEqual(await caller(), ['hello world', [2, 3]]);
			assert.equal(await text.execute({}, { toolCallId: 'text', messages: [], context: undefined }), 'hello world');
			assert.deepEqual(await elements.execute({}, { toolCallId: 'elements', messages: [], context: undefined }), [2, 3]);
		}
	});
});
