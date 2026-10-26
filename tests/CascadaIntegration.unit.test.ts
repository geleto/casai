import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { spawnSync } from 'node:child_process';
import { isStepCount, ToolLoopAgent } from 'ai';
import { AsyncEnvironment } from 'cascada-engine';
import { create, z } from './cascada.js';
import { modelFor } from './fixtures/phase2-security-sdk.js';

// Actual renderer baseline for the installed engine. Passing these tests does
// not establish the future chain-resolution compiler/runtime handoff.
describe('Cascada renderer state and forwarding integration', () => {
	it('characterizes unhandled async helper rejection under native thenable argument resolution', function () {
		this.timeout(15000);
		const child = spawnSync(process.execPath, ['--unhandled-rejections=throw', '--import=tsx/esm', '--conditions=casai-source', '--input-type=module', '--eval', `
			import { create, z } from 'casai';
			import { tool } from 'ai';
			const then = tool({ inputSchema: z.object({}), execute: () => 1 });
			await create.Script({ tools: { then }, context: { child: () => { console.log('BODY_ENTERED'); return 1; } },
				script: 'return child({ then: then })' })();
		`], { cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 10000 });
		assert.equal(child.error, undefined);
		assert.equal(child.status, 1);
		assert.match(child.stderr, /ValidationError: A registered tool accepts one input value/);
		assert.doesNotMatch(child.stdout, /BODY_ENTERED/);
	});

	it('characterizes native resolution of callable then arguments before a child receives them', async () => {
		let resolved = 0, entered = 0;
		const context = {
			then: (resolve: (value: { value: number }) => void) => { resolved++; resolve({ value: 7 }); },
			child: (input: { value: number }) => { entered++; assert.deepEqual(input, { value: 7 }); return input.value; },
		};
		const engine = new AsyncEnvironment();
		assert.equal(await engine.renderScriptString('return child({ then: then })', context), 7);
		assert.equal(entered, 1);
		assert.ok(resolved > 0, 'Native argument resolution consumes then before invoking the child.');
	});

	for (const kind of ['Script', 'Template'] as const) for (const route of ['configured', 'registered'] as const) {
		for (const sequential of [false, true]) it(`${kind} ${route} calls preserve ${sequential ? 'explicit ordering' : 'native concurrency'}`, async () => {
			const state = { count: 0, active: 0, maximum: 0 };
			const counter = create.Function.asTool({ inputSchema: z.object({ amount: z.number() }), context: { state },
				execute: async ({ amount, state: received }) => {
					assert.equal(received, state);
					state.active++;
					state.maximum = Math.max(state.maximum, state.active);
					const before = state.count;
					await nextTurn();
					state.active--;
					// The unmarked neighbor only computes a value; active/maximum
					// are test instrumentation, not application side effects.
					if (!sequential) return amount * 2;
					state.count = before + amount;
					return state.count;
				} });
			const bindings = route === 'configured' ? { context: { counter } } : { tools: { counter } };
			const marker = sequential ? '!' : '';
			const owner = kind === 'Script'
				? create.Script({ script: `var first = counter${marker}(amount=1)\nvar second = counter${marker}(amount=2)\nreturn [first, second]` }, { config: bindings })
				: create.Template({ template: `{{ counter${marker}(amount=1) }}|{{ counter${marker}(amount=2) }}` }, { config: bindings });
			const result = await owner();
			assert.deepEqual(result, kind === 'Script' ? sequential ? [1, 3] : [2, 4] : sequential ? '1|3' : '2|4');
			assert.equal(state.maximum, sequential ? 1 : 2);
			assert.equal(state.active, 0);
			assert.equal(state.count, sequential ? 3 : 0);
			if (sequential) {
				// Reuse is sequential across completed renders, not a global lock.
				assert.deepEqual(await owner(), kind === 'Script' ? [4, 6] : '4|6');
				assert.equal(state.count, 6);
				assert.equal(state.maximum, 1);
			}
		});

		for (const mode of ['generate', 'stream'] as const) it(`${kind} ${route} forwarding protects private state in SDK ${mode}`, async () => {
			const state = { count: 0 };
			let entered = 0;
			const privateContext = { state, user: 'renderer-private-user' };
			const execute = (input: typeof privateContext & { amount: number }) => {
				entered++;
				assert.equal(input.state, state);
				assert.equal(input.user, privateContext.user);
				return state.count += input.amount;
			};
			const bindings = route === 'configured'
				? { context: { counter: create.Function({ inputSchema: z.looseObject({ amount: z.number() }), context: privateContext, execute }) } }
				: { tools: { counter: create.Function.asTool({ inputSchema: z.object({ amount: z.number() }), context: privateContext, execute }) } };
			const inputSchema = z.object({ payload: z.unknown() });
			const outer = kind === 'Script'
				? create.Script.asTool({ inputSchema, script: 'return counter!(payload)' }, { config: bindings })
				: create.Template.asTool({ inputSchema, template: '{{ counter!(payload) }}' }, { config: bindings });
			for (const attack of [true, false]) {
				const payload = attack ? { amount: 2, state: { count: 9000 }, user: 'admin' } : { amount: 2 };
				const model = modelFor({ payload }, 'outer');
				const agent = new ToolLoopAgent({ model, tools: { outer }, stopWhen: isStepCount(2) });
				const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
				const steps = await result.steps;
				assert.ok(steps[0].content.some(part => part.type === (attack ? 'tool-error' : 'tool-result')));
				assert.equal(entered, attack ? 0 : 1);
				assert.equal(state.count, attack ? 0 : 2);
				if (!attack) assert.equal(steps[0].toolResults[0].output, kind === 'Script' ? 2 : '2');
			}
		});
	}
});
