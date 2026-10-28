import { runtimeRun } from './fixtures/runtime-call.js';
import assert from 'node:assert/strict';
import { tool, isStepCount, ToolLoopAgent } from 'ai';
import { safeValidateTypes, validateTypes } from '@ai-sdk/provider-utils';
import { create, z } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';

describe('Owned tool registries', () => {
	it('retains raw or parsed bound context according to the selected context schema', async () => {
		for (const contextSchema of [undefined, z.object({ trace: z.string().transform(Number) })]) {
			const configuredContext: { trace: string | number } = { trace: 0 };
			const operation = create.Function.asTool({
				inputSchema: z.object({}), toolContextSchema: contextSchema,
				context: configuredContext, execute: ({ trace }) => trace,
			});
			const bound = operation.bindToolContext({ trace: '12' });
			// Native descriptor execution receives context after the SDK parser.
			const context = contextSchema ? await validateTypes({ schema: contextSchema, value: bound.context }) : bound.context;
			const value = await bound.tool.execute!({}, { context, toolCallId: 'bound', messages: [] });
			assert.equal(value, contextSchema ? 12 : '12');
			assert.deepEqual(bound.context, { trace: '12' });
		}
	});

	it('characterizes unsupported thenable tool context across SDK and injected paths', async () => {
		const probe = create.Function.asTool({ inputSchema: z.object({ factor: z.number() }), context: { privateValue: 'configured' },
			execute: ({ factor, privateValue }) => ({ factor, privateValue }) });
		const raw = { factor: 5, privateValue: 'raw',
			then: (resolve: (value: { factor: number; privateValue: string }) => void) => { resolve({ factor: 9, privateValue: 'resolved' }); },
		};
		const tools = { probe }, toolsContext = { probe: raw };
		const injected = create.Function({ tools, toolsContext, execute: ({ probe }) => probe({}) });
		assert.deepEqual(await injected(), { factor: 5, privateValue: 'raw' });
		const owner = create.LLMAgent({ tools, toolsContext, model: modelFor({}), prompt: 'go', stopWhen: isStepCount(2) });
		const result = await owner();
		assert.deepEqual(result.steps[0].toolResults[0].output, { factor: 5, privateValue: 'resolved' });
		// Resolve before binding to give both paths the same stable object.
		const stable = await raw;
		const stableContext = { probe: stable };
		assert.deepEqual(await create.Function({ tools, toolsContext: stableContext, execute: ({ probe }) => probe({}) })(), stable);
		const sdk = await create.LLMAgent({ tools, toolsContext: stableContext, model: modelFor({}), prompt: 'go', stopWhen: isStepCount(2) })();
		assert.deepEqual(sdk.steps[0].toolResults[0].output, stable);
	});

	it('forwards then helpers through application parsing without invoking them during preparation', async () => {
		let entered = 0, called = 0;
		const then = tool({ inputSchema: z.object({}), execute: () => ++called });
		const execute = (input: { then: (input: Record<string, never>) => Promise<number> }) => { entered++; return input.then({}); };
		const plain = create.Function({ execute });
		const open = create.Function({ inputSchema: z.looseObject({}), execute: input => execute({ then: input.then as Parameters<typeof execute>[0]['then'] }) });
		type Input = Parameters<typeof execute>[0];
		const children = [
			{ call: (input: Input) => plain(input), run: (input: Input) => plain.run({ context: input }) },
			{ call: (input: Input) => open(input), run: (input: Input) => open.run({ context: input }) },
		];
		const unhandled: unknown[] = [];
		const onUnhandled = (error: unknown) => { unhandled.push(error); };
		process.on('unhandledRejection', onUnhandled);
		try {
			for (const child of children) {
				const owner = create.Function({ tools: { then }, execute: context => child.call({ then: context.then }) });
				assert.equal(await owner(), called);
				const named = create.Function({ tools: { then }, execute: context => child.run({ then: context.then }) });
				assert.equal(await named(), called);
				const sdk = create.Function.asTool({ inputSchema: z.object({}), tools: { then }, execute: context => child.call({ then: context.then }) });
				assert.equal(await sdk.execute({}, { toolCallId: 'forward', messages: [], context: undefined }), called);
				assert.equal(await create.Function({ tools: { sdk }, execute: ({ sdk }) => sdk({}) })(), called);
				const rendered = create.LLMAgent.withFunction({ model: modelFor(undefined), tools: { then },
					prompt: async context => String(await child.call({ then: context.then })) });
				assert.equal((await rendered()).text, 'done');
				// Cascada owns argument resolution. Construct the object in host code so
				// this isolates Casai forwarding from its native thenable-argument behavior.
				const context = { forward: (then: Input['then']) => child.call({ then }) };
				assert.equal(await create.Script({ tools: { then }, context, script: 'return forward(then)' })(), called);
				assert.equal(await create.Template({ tools: { then }, context, template: '{{ forward(then) }}' })(), String(called));
			}
			await new Promise<void>(resolve => setImmediate(resolve));
			assert.equal(entered, 14);
			assert.equal(called, 14);
			assert.deepEqual(unhandled, []);
		} finally { process.off('unhandledRejection', onUnhandled); }
	});

	it('retains callable then in bound and native trusted context and parsed SDK input', async () => {
		let assimilated = 0, entered = 0;
		const then = () => { assimilated++; throw new Error('Unexpected thenable assimilation'); };
		for (const toolContextSchema of [undefined, z.looseObject({})]) {
			const child = create.Function.asTool({ inputSchema: z.object({}), toolContextSchema, context: { then },
				execute: input => { entered++; assert.equal(input.then, then); return 7; } });
			const owner = create.Function({ tools: { child }, toolsContext: { child: { then } }, execute: ({ child }) => child({}) });
			assert.equal(await owner(), 7);
			const native = tool({ inputSchema: z.looseObject({}), contextSchema: toolContextSchema,
				execute: (input, options) => { entered++; assert.equal(input.then, then); assert.equal((options.context as { then: unknown }).then, then); return 7; } });
			assert.equal(await create.Function({ tools: { native }, toolsContext: { native: { then } },
				execute: ({ native }) => native({ then }) })(), 7);
		}
		// SDK input validation itself keeps parsed values inside a result envelope.
		// Keep the runtime-only thenable out of native Awaited type inference.
		const inputSchema = z.object({ value: z.number() }).transform(input => ({ ...input, then: then as unknown }));
		const transformed = create.Function.asTool({ inputSchema, execute: input => { entered++; assert.equal(input.then, then); return input.value; } });
		const parsed = await safeValidateTypes({ schema: transformed.inputSchema, value: { value: 9 } });
		assert.ok(parsed.success);
		assert.equal(await transformed.execute(parsed.value, { context: undefined, toolCallId: 'then', messages: [] }), 9);
		assert.equal(entered, 5);
		assert.equal(assimilated, 0);
	});

	it('keeps an unused then helper from being called by promise resolution', async () => {
		let entered = 0, called = 0;
		const then = tool({ inputSchema: z.object({}), execute: () => ++called });
		const owner = create.Function({ tools: { then }, execute: () => ++entered });
		assert.equal(await owner(), 1);
		assert.equal(await owner.run({}), 2);
		assert.equal(entered, 2);
		assert.equal(called, 0);
	});

	it('keeps then helpers callable through ordinary and SDK tool execution', async () => {
		let entered = 0, called = 0;
		const then = tool({ inputSchema: z.object({}), execute: () => ++called });
		const owner = create.Function.asTool({ inputSchema: z.object({}), tools: { then }, execute: async ({ then, _toolOptions }) => {
			entered++;
			return { value: await then({}), id: _toolOptions.toolCallId };
		} });
		assert.deepEqual(await owner(), { value: 1, id: undefined });
		assert.deepEqual(await owner.run({}), { value: 2, id: undefined });
		assert.deepEqual(await owner.execute({}, { toolCallId: 'outer', messages: [], context: undefined }), { value: 3, id: 'outer' });
		assert.equal(entered, 3);
		assert.equal(called, 3);
	});

	it('preserves then helpers through Script, Template and LLM preparation', async () => {
		let called = 0;
		const then = tool({ inputSchema: z.object({}), execute: () => { called++; return 11; } });
		const tools = { then };
		assert.equal(await create.Script({ tools, script: 'return then({})' })(), 11);
		assert.equal(await create.Template({ tools, template: '{{ then({}) }}' })(), '11');
		const model = modelFor(undefined);
		const rendered = create.LLMAgent.withFunction({ model, tools, prompt: async ({ then }) => String(await then({})) });
		assert.equal((await rendered()).text, 'done');
		assert.equal(called, 3);
		assert.deepEqual(model.doGenerateCalls[0].prompt[0].content, [{ type: 'text', text: '11' }]);
		// The SDK itself permits this tool name without introducing a context thenable.
		const native = new ToolLoopAgent({ model: modelFor({}, 'then'), tools, stopWhen: isStepCount(2) });
		assert.equal((await native.generate({ prompt: 'go' })).steps[0].toolResults[0].output, 11);
		assert.equal(called, 4);
	});

	it('forwards native execution options while giving injected calls their own metadata and context', async () => {
		const unused = () => { throw new Error('Sandbox operations are not used by this test.'); };
		const sandbox = { description: 'shared sandbox', readFile: unused, readBinaryFile: unused, readTextFile: unused,
			writeFile: unused, writeBinaryFile: unused, writeTextFile: unused, spawn: unused, run: unused };
		const abortSignal = new AbortController().signal;
		const child = tool({ inputSchema: z.object({}), contextSchema: z.object({ tenant: z.string() }),
			execute: (_input, options) => options });
		const owner = create.Function.asTool({ inputSchema: z.object({}), tools: { child },
			toolsContext: { child: { tenant: 'child tenant' } }, execute: ({ child }) => child({}) });
		const options = await owner.execute({}, { toolCallId: 'outer call', messages: [{ role: 'user', content: 'outer history' }],
			context: undefined, abortSignal, experimental_sandbox: sandbox });
		assert.equal(options.abortSignal, abortSignal);
		assert.equal(options.experimental_sandbox, sandbox);
		assert.notEqual(options.toolCallId, 'outer call');
		assert.ok(options.toolCallId);
		assert.deepEqual(options.messages, []);
		assert.deepEqual(options.context, { tenant: 'child tenant' });
		assert.equal((await owner()).experimental_sandbox, undefined);
	});

	it('treats only a true keyword marker as calling syntax', async () => {
		const ordinary = create.Function({ inputSchema: z.object({ __hasKeywordArgs: z.unknown() }), execute: input => input.__hasKeywordArgs });
		for (const value of [false, 0, 'marker', null, undefined]) assert.equal(await ordinary({ __hasKeywordArgs: value }), value);
		let parses = 0;
		const operation = create.Function.asTool({ inputSchema: z.object({ value: z.number() }).transform(input => { parses++; return input; }),
			execute: ({ value }) => value });
		const input = { value: 2, __hasKeywordArgs: false };
		await assert.rejects(operation(input as never), /Undeclared tool input keys: __hasKeywordArgs/);
		const owner = create.Function({ tools: { operation }, execute: ({ operation }) => operation(input as never) });
		await assert.rejects(owner(), /Undeclared tool input keys: __hasKeywordArgs/);
		assert.equal(parses, 0);
		assert.equal(await operation({ value: 2 }), 2);
	});

	it('checks cancellation before application and bound-context preparation', async () => {
		const reason = new Error('already cancelled');
		const abortSignal = AbortSignal.abort(reason);
		let parsed = 0, contexts = 0, entered = 0;
		const inputSchema = z.object({ value: z.number().transform(value => { parsed++; return value; }) });
		const operation = create.Function.asTool({ inputSchema,
			toolContextSchema: z.object({}).transform(value => { contexts++; return value; }),
			execute: () => ++entered });
		const script = create.Script({ inputSchema, script: 'return value' });
		const template = create.Template({ inputSchema, template: '{{ value }}' });
		for (const component of [operation, script, template]) {
			for (const value of [1, 'invalid']) await assert.rejects(runtimeRun(component, { context: { value } as never, abortSignal }), error => error === reason);
		}
		const binding = operation.bindToolContext({});
		await assert.rejects(binding.tool.execute!({ value: 1 }, { toolCallId: 'cancelled', messages: [], context: {}, abortSignal }) as Promise<unknown>, error => error === reason);
		assert.deepEqual([parsed, contexts, entered], [0, 0, 0]);
	});

	it('checks selected tool-context parsers before binding, injected execution and model dispatch', async () => {
		const factor = z.object({ factor: z.number() });
		const tenant = z.object({ tenant: z.string() });
		let executed = 0;
		function operation(kind: 'factor' | 'tenant' | 'absent') {
			return create.Function.asTool({ inputSchema: z.object({}),
				toolContextSchema: kind === 'factor' ? factor : kind === 'tenant' ? tenant : undefined,
				execute: () => ++executed });
		}
		const selected = operation('tenant');
		// Deliberately bypass type admission to verify the runtime trust boundary.
		const invalid = { factor: 2 } as never;
		const bound = selected.bindToolContext(invalid);
		await assert.rejects(validateTypes({ schema: bound.tool.inputSchema, value: {} }), /Tool context validation failed/);
		const owner = create.Function({ tools: { selected }, toolsContext: { selected: { factor: 2, tenant: 'both' } },
			execute: ({ selected }) => selected({}) });
		await assert.rejects(owner.run({ toolsContext: { selected: invalid } }), /Tool 'selected' context validation failed/);
		const model = modelFor({}, 'selected');
		const generated = create.LLMAgent({ model, prompt: 'go', tools: { selected },
			toolsContext: { selected: { factor: 2, tenant: 'both' } } });
		await assert.rejects(generated.run({ toolsContext: { selected: invalid } }), /Tool 'selected' context validation failed/);
		assert.equal(model.doGenerateCalls.length, 0);
		assert.equal(executed, 0);
		assert.equal(await owner(), 1);
		for (const kind of ['factor', 'tenant', 'absent'] as const) {
			const selected = operation(kind);
			const valid = selected.bindToolContext({ factor: 2, tenant: 'both' });
			assert.deepEqual(await validateTypes({ schema: valid.tool.inputSchema, value: {} }), {});
		}
		const union = create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.union([factor, tenant]), execute: () => 1 });
		for (const context of [{ factor: 2 }, { tenant: 'either' }]) {
			const bound = union.bindToolContext(context);
			assert.deepEqual(await validateTypes({ schema: bound.tool.inputSchema, value: {} }), {});
		}
	});

	it('keeps tool-only dependencies optional on ordinary empty-input calls', async () => {
		const guarded = create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.object({ factor: z.number() }),
			execute: ({ factor }) => factor?.toFixed() ?? 'ordinary' });
		assert.equal(await guarded(), 'ordinary');
		assert.equal(await guarded.run(), 'ordinary');
		assert.equal(await create.Function.asTool({}, guarded)(), 'ordinary');
		assert.equal(await guarded.execute({}, { toolCallId: 'sdk', messages: [], context: { factor: 2 } }), '2');
		const configured = create.Function.asTool({ inputSchema: z.object({}), context: { factor: 1 },
			toolContextSchema: z.object({ factor: z.string().transform(Number) }), execute: ({ factor }) => factor.toFixed() });
		assert.equal(await configured(), '1');
		assert.equal(await configured.run(), '1');
		const owner = create.Function({ tools: { configured }, toolsContext: { configured: { factor: '3' } },
			execute: ({ configured }) => configured({}) });
		assert.equal(await owner(), '3');
		assert.equal(await configured(), '1');
	});

	it('snapshots reusable settings without cloning external resources', async () => {
		const resource = { value: 1 };
		const settings = { context: { resource } };
		const parent = create.Config(settings);
		settings.context = { resource: { value: 99 } };
		const component = create.Function({ execute: input => input.resource.value }, parent);
		assert.equal(await component(), 1);
		resource.value = 2;
		assert.equal(await component(), 2);
	});

	it('does not inject or protect a fallback name when the native tool has no executor', async () => {
		const clientOnly = { inputSchema: z.object({}), outputSchema: z.number() };
		const owner = create.Function({ inputSchema: z.looseObject({}), tools: { clientOnly }, execute: input => input });
		assert.equal(Object.hasOwn(await owner(), 'clientOnly'), false);
		assert.equal((await owner({ clientOnly: 'ordinary extra' })).clientOnly, 'ordinary extra');
	});
	const inputSchema = z.object({ value: z.number() });
	const native = tool({ inputSchema, execute: ({ value }) => value * 2 });
	const action = create.Function.asTool({
		inputSchema: inputSchema.extend({ factor: z.number() }), context: { factor: 1 },
		toolContextSchema: z.object({ factor: z.number() }), execute: ({ value, factor }) => value * factor,
	});

	it('preserves compatible private bindings and whole-entry public-default replacements', async () => {
		const dependency = create.Function.asTool({
			inputSchema: z.object({}), context: { db: (): string => 'original' }, execute: ({ db }) => db(),
		});
		const owner = create.Function({ tools: { dependency }, execute: ({ dependency }) => dependency({}) });
		assert.equal(await owner(), 'original');
		assert.equal(await owner.run({ toolsContext: { dependency: { db: () => 'replacement' } } }), 'replacement');
		assert.equal(await owner(), 'original');

		const defaulted = create.Function.asTool({ inputSchema, execute: ({ value }) => value });
		const defaults = create.Function({
			tools: { defaulted }, toolsContext: { defaulted: { value: 4 } }, execute: ({ defaulted }) => defaulted({}),
		});
		assert.equal(await defaults.run({ toolsContext: { defaulted: { value: 5 } } }), 5);
		assert.equal(await defaults.run({ toolsContext: undefined }), 4);
		const child = create.Function({
			toolsContext: { defaulted: {} }, execute: ({ defaulted }) => defaulted({ value: 6 }),
		}, defaults);
		assert.equal(await child(), 6);
		assert.equal(await defaults(), 4);
	});

	it('preserves omitted helper arguments when a schema replaces configured defaults', async () => {
		const configured = create.Function.asTool({ inputSchema: z.object({ value: z.number(), factor: z.number() }),
			context: { factor: 2 }, execute: input => input.value * input.factor });
		const schema = z.object({ value: z.number(), factor: z.number().default(5) });
		const defaulted = create.Function.asTool({ inputSchema: schema, execute: input => input.value * input.factor });
		const owner = create.Function({ tools: { operation: configured }, execute: ({ operation }) => operation({ value: 3 }) });
		assert.equal(await owner(), 6);
		assert.equal(await create.Function({ tools: { operation: defaulted } }, owner)(), 15);
		assert.equal(await owner(), 6);
		let entries = 0;
		const invalid = create.Function.asTool({ inputSchema: schema, context: { factor: 'invalid' }, execute: input => {
			entries++;
			return input.value * input.factor;
		} });
		await assert.rejects(invalid({ value: 3 } as never), /Application input validation failed/);
		assert.equal(entries, 0);
	});

	it('binds raw context for replacement descriptors before executing with parsed context', async () => {
		const model = modelFor(undefined);
		const toolContextSchema = z.object({ factor: z.string().transform(Number) });
		const original = create.Function.asTool({ inputSchema, toolContextSchema, context: { factor: 1 },
			execute: input => input.value * input.factor });
		const factors: number[] = [];
		const replacement = create.Function.asTool({ inputSchema,
			toolContextSchema: z.object({ factor: z.union([z.string(), z.number()]).transform(Number) }), context: { factor: 1 }, execute: input => {
				factors.push(input.factor);
				return input.value * input.factor + 1;
			} });
		const config = { model, tools: { action: original }, toolsContext: { action: { factor: '3' } } };
		const generate = create.LLMAgent.withFunction({ ...config, prompt: async ({ action }) => String(await action({ value: 2 })) });
		const stream = create.LLMAgent.withFunction.asStream({ ...config, prompt: async ({ action }) => String(await action({ value: 2 })) });
		await generate.run({ tools: { action: replacement } });
		await (await stream.run({ tools: { action: replacement } })).text;
		assert.deepEqual(factors, [3, 3]);
		assert.deepEqual(model.doGenerateCalls[0].prompt[0].content, [{ type: 'text', text: '7' }]);
		assert.deepEqual(model.doStreamCalls[0].prompt[0].content, [{ type: 'text', text: '7' }]);
	});

	it('uses replacement raw contracts with newly supplied preparers while retaining SDK-only substitutions', async () => {
		const model = modelFor(undefined);
		const toolContextSchema = z.object({ factor: z.number() });
		const fromText = create.Function.asTool({
			inputSchema: z.object({ value: z.string().transform(Number) }), toolContextSchema,
			context: { factor: 1 }, execute: ({ value }) => value,
		});
		const fromNumber = create.Function.asTool({
			inputSchema, toolContextSchema, context: { factor: 1 }, execute: ({ value }) => value,
		});
		const wider = create.Function.asTool({
			inputSchema: z.object({ value: z.union([z.string(), z.number()]).transform(Number) }),
			toolContextSchema, context: { factor: 1 }, execute: ({ value }) => value,
		});
		const parent = create.LLMAgent.withFunction({
			model, tools: { operation: fromText }, toolsContext: { operation: { factor: 1 } },
			prompt: async ({ operation }) => String(await operation({ value: '4' })),
		});
		await parent();
		await parent.run({ tools: { operation: wider } });
		const child = create.LLMAgent.withFunction({
			tools: { operation: fromNumber }, prompt: async ({ operation }) => String(await operation({ value: 5 })),
		}, parent);
		await child();
		const nativeOnly = create.LLMAgent({
			model, prompt: 'ready', tools: { operation: fromText }, toolsContext: { operation: { factor: 1 } },
		});
		await nativeOnly.run({ tools: { operation: fromNumber } });
		assert.deepEqual(model.doGenerateCalls.map(call => call.prompt.map(({ role, content }) => ({ role, content }))), [
			[{ role: 'user', content: [{ type: 'text', text: '4' }] }],
			[{ role: 'user', content: [{ type: 'text', text: '4' }] }],
			[{ role: 'user', content: [{ type: 'text', text: '5' }] }],
			[{ role: 'user', content: [{ type: 'text', text: 'ready' }] }],
		]);
	});

	it('removes inherited tool entries without deleting unrelated inherited context', async () => {
		const parent = create.Function({ tools: { action, native }, toolsContext: { action: { factor: 3 } },
			context: { retained: true }, execute: () => 1 });
		for (const removal of [null, undefined]) {
			const child = create.Function({ tools: { action: removal }, execute: context => ({
				hasAction: Object.hasOwn(context, 'action'), retained: context.retained, result: context.native({ value: 2 }),
			}) }, parent);
			const result = await child();
			assert.equal(result.hasAction, false);
			assert.equal(result.retained, true);
			assert.equal(await result.result, 4);
			assert.deepEqual(child.config.toolsContext, { action: { factor: 3 } });
			assert.equal(parent.config.tools.action, action);
		}
	});

	it('rejects new unknown context entries while retaining inherited orphan entries', () => {
		const parent = create.Function({ tools: { action }, toolsContext: { action: { factor: 3 } }, execute: () => 1 });
		assert.throws(() => create.Function({ toolsContext: { typo: {} }, execute: () => 2 } as never, parent), /Unknown toolsContext entries: typo/);
		assert.throws(() => create.Function({ tools: { action: null }, toolsContext: { action: { factor: 4 } }, execute: () => 2 } as never, parent), /Unknown toolsContext entries: action/);
		const removed = create.Function({ tools: { action: null }, execute: () => 2 }, parent);
		assert.doesNotThrow(() => create.Function({ execute: () => 3 }, removed));
		const incomplete = create.Config({ toolsContext: { action: { factor: 2 } } });
		assert.throws(() => create.Function({ execute: () => 1 } as never, incomplete), /Unknown toolsContext entries: action/);
	});

	it('accepts only named invocation controls on coded run and preserves its registry', async () => {
		const owner = create.Function({ tools: { native }, execute: ({ native }) => native({ value: 2 }) });
		assert.equal(await owner.run({}), 4);
		await assert.rejects(owner.run({ tools: {} } as never), /Unknown run settings: tools/);
		await assert.rejects(owner.run({ toolsContext: { typo: {} } } as never), /Unknown toolsContext entries: typo/);
		assert.equal(await owner(), 4);
	});

	it('keeps LLM input/output and renderer contracts fixed on untyped run calls too', async () => {
		const model = modelFor(undefined);
		const generator = create.LLMAgent({ model, prompt: 'ready' });
		const streamer = create.LLMAgent.asStream({ model, prompt: 'ready' });
		for (const key of ['inputSchema', 'toolContextSchema', 'schema', 'output', 'enum', 'promptType', 'loader', 'filters', 'renderOptions']) {
			await assert.rejects(generator.run({ [key]: undefined } as never), /Unsupported (LLMAgent settings|configuration properties)/);
			await assert.rejects(streamer.run({ [key]: undefined } as never), /Unsupported (LLMAgent settings|configuration properties)/);
		}
		assert.equal(model.doGenerateCalls.length + model.doStreamCalls.length, 0);
	});

	it('rejects ambiguous keyword calls before application parsing', async () => {
		const operation = create.Function({ execute: () => 1 }) as (...args: unknown[]) => Promise<unknown>;
		await assert.rejects(operation({}, { value: 2, __hasKeywordArgs: true }), /context object or named arguments/);
		await assert.rejects(operation('source', {}, { value: 2, __hasKeywordArgs: true }), /context object or named arguments/);
		const owner = create.Function({ tools: { native }, execute: context =>
			(context.native as (...args: unknown[]) => Promise<unknown>)({ value: 1 }, { value: 2 }) });
		await assert.rejects(owner(), /one input value/);
	});

	it('handles empty native iterators and invocation defaults without inventing results', async () => {
		const empty = tool({ inputSchema: z.object({}), async *execute(): AsyncGenerator<number> { /* No preliminary or final values. */ } });
		const owner = create.Function({ tools: { empty }, execute: context => context.empty({}) });
		assert.equal(await owner.run(), undefined);
		const plain = create.Function({ execute: () => 1 });
		// @ts-expect-error Exercise runtime rejection of an unregistered tool context.
		await assert.rejects(plain.run({ toolsContext: { missing: {} } }), /Unknown toolsContext entries/);
	});

	it('forwards cancellation through native helper validation without entering its executor', async () => {
		const controller = new AbortController();
		let start!: () => void, release!: () => void;
		const started = new Promise<void>(resolve => { start = resolve; });
		const pending = new Promise<void>(resolve => { release = resolve; });
		let entries = 0;
		const cooperative = tool({
			inputSchema: z.number().refine(async () => { start(); await pending; return true; }),
			execute: () => { entries++; return 1; },
		});
		const owner = create.Function({ tools: { cooperative }, execute: context => context.cooperative(2) });
		const result = owner.run({ abortSignal: controller.signal });
		await started;
		const reason = new Error('stopped during validation');
		controller.abort(reason);
		release();
		await assert.rejects(result, error => error === reason);
		assert.equal(entries, 0);
	});

	for (const name of ['toString', 'constructor', '__proto__']) {
		it('uses own registry and context entries for ' + name, async () => {
			const tools = Object.fromEntries([[name, native]]);
			const owner = create.Function({ tools, execute: async context => {
				const helper = context[name];
				return helper({ value: 3 });
			} });
			assert.equal(await owner(), 6);
			const shadowed = create.Function({ context: Object.fromEntries([[name, undefined]]), tools,
				execute: context => ({ own: Object.hasOwn(context, name), value: context[name] }) });
			assert.deepEqual(await shadowed(), { own: true, value: undefined });
		});
	}

	it('preserves absent native context and does not read context from Object.prototype', async () => {
		const contexts: unknown[] = [];
		const native = tool({ inputSchema, execute: (_, options) => { contexts.push(options.context); return 1; } });
		// eslint-disable-next-line @typescript-eslint/no-base-to-string -- The registered helper shadows Object.toString and takes native tool input.
		const owner = create.Function({ tools: { toString: native }, execute: context => context.toString({ value: 1 }) });
		assert.equal(await owner(), 1);
		assert.deepEqual(contexts, [undefined]);
	});

	it('parses context once per Casai binding and once per native injected call', async () => {
		let parsedCasai = 0, parsedNative = 0;
		const casai = create.Function.asTool({
			inputSchema, context: { factor: 1 },
			toolContextSchema: z.object({ factor: z.number() }).transform(value => { parsedCasai++; return value; }),
			execute: ({ value, factor }) => value * factor,
		});
		const native = tool({ inputSchema, contextSchema: z.object({ factor: z.number() }).transform(value => { parsedNative++; return value; }),
			execute: ({ value }, { context }) => value * context.factor });
		const owner = create.Function({ tools: { casai, native }, toolsContext: { casai: { factor: 3 }, native: { factor: 4 } },
			execute: context => Promise.all([context.casai({ value: 2 }), context.casai({ value: 3 }), context.native({ value: 2 }), context.native({ value: 3 })]) });
		assert.deepEqual(await owner(), [6, 9, 8, 12]);
		assert.equal(parsedCasai, 1);
		assert.equal(parsedNative, 2);
		await owner();
		assert.equal(parsedCasai, 2);
	});

	for (const mode of ['generate', 'stream'] as const) {
		it(mode + ': retains bound context when prepareStep returns undefined context', async () => {
			for (const owner of ['casai', 'native'] as const) {
				const model = modelFor({ value: 2 }, 'action');
				const binding = action.bindToolContext({ factor: 3 });
				const config = { model, tools: { action: binding.tool }, toolsContext: { action: binding.context },
					prepareStep: () => ({ toolsContext: undefined }), stopWhen: isStepCount(2) };
				if (owner === 'native') {
					const agent = new ToolLoopAgent(config);
					const result = mode === 'generate' ? await agent.generate({ prompt: 'go' }) : await agent.stream({ prompt: 'go' });
					assert.equal((await result.steps)[0].toolResults[0].output, 6);
				} else {
					const settings = { ...config, prompt: 'go', tools: { action } };
					const result = await (mode === 'generate' ? create.LLMAgent(settings)() : create.LLMAgent.asStream(settings)());
					assert.equal((await result.steps)[0].toolResults[0].output, 6);
				}
			}
		});

		it(mode + ': rejects changed Casai binding context before model dispatch', async () => {
			const model = modelFor({ value: 2 }, 'action');
			const errors: unknown[] = [];
			const config = { model, prompt: 'go', tools: { action }, toolsContext: { action: { factor: 3 } },
				prepareStep: () => ({ toolsContext: { action: { factor: 5 } } }) };
			if (mode === 'generate') await assert.rejects(create.LLMAgent(config)(), /cannot change within an invocation/);
			else {
				const result = (await create.LLMAgent.asStream({ ...config, onError: ({ error }) => { errors.push(error); } })());
				await assert.rejects(async () => await result.text, /No output generated/);
				assert.match(String(errors[0]), /cannot change within an invocation/);
			}
			assert.equal(model.doGenerateCalls.length + model.doStreamCalls.length, 0);
		});

		it(mode + ': accepts an equivalent context snapshot and native context replacement', async () => {
			const native = tool({ inputSchema, contextSchema: z.object({ factor: z.number() }), execute: ({ value }, { context }) => value * context.factor });
			const model = modelFor({ value: 2 }, 'native');
			const config = { model, prompt: 'go', tools: { action, native }, toolsContext: { action: { factor: 3 }, native: { factor: 1 } },
				prepareStep: () => ({ toolsContext: { action: { factor: 3 }, native: { factor: 5 } } }), stopWhen: isStepCount(2) };
			const result = await (mode === 'generate' ? create.LLMAgent(config)() : create.LLMAgent.asStream(config)());
			assert.equal((await result.steps)[0].toolResults[0].output, 10);
		});
	}
});
