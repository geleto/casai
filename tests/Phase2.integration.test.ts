import { Output } from 'ai';
import assert from 'node:assert/strict';
import { asSchema, generateText, isStepCount, jsonSchema, streamText, tool, ToolLoopAgent } from 'ai';
import type { LanguageModel, Tool, ToolExecutionOptions } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { executeTool, validateTypes } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { create, ValidationError, streamSchema, textStreamSchema, collectStream, collectTextStream } from './cascada.js';
import { modelFor } from './fixtures/phase2-security-sdk.js';

describe('Phase 2 production execution', () => {
	it('requires trusted context for every possible registry before native tool execution', async () => {
		let entries = 0;
		const secured = tool({ inputSchema: z.object({}), contextSchema: z.object({ tenant: z.string() }),
			execute: (_input, { context }) => { entries++; return context.tenant; } });
		function settings(enabled: boolean, model: LanguageModel):
			| { model: LanguageModel; prompt: string; tools: { secured: typeof secured } }
			| { model: LanguageModel; prompt: string } {
			return enabled ? { model, prompt: 'ready', tools: { secured } } : { model, prompt: 'ready' };
		}
		const generation = modelFor({}, 'secured');
		// @ts-expect-error The selected runtime branch deliberately omits required tool context.
		await assert.rejects(create.LLMAgent(settings(true, generation))());
		const streaming = modelFor({}, 'secured');
		const errors: unknown[] = [];
		// @ts-expect-error Streaming must reject the same incomplete configuration statically.
		const result = (await create.LLMAgent.asStream({ ...settings(true, streaming), onError: ({ error }) => { errors.push(error); } })());
		const failure = (await collectStream(result.stream)).find(part => part.type === 'error');
		assert.ok(failure);
		assert.deepEqual(errors, [failure.error]);
		assert.equal(entries, 0);
		assert.equal(generation.doGenerateCalls.length, 1);
		assert.equal(streaming.doStreamCalls.length, 1);
		const absent = settings(false, modelFor(undefined));
		assert(!('tools' in absent));
		assert.equal((await create.LLMAgent(absent)()).value, 'done');
		const configured = create.LLMAgent({ model: modelFor({}, 'secured'), prompt: 'ready', tools: { secured }, toolsContext: { secured: { tenant: 'trusted' } } });
		const completed = await configured();
		assert.equal(completed.toolResults[0]?.output, 'trusted');
		assert.equal(entries, 1);
	});

	it('keeps conditional renderer registries paired with their trusted context', async () => {
		const secured = tool({ inputSchema: z.object({}), contextSchema: z.object({ tenant: z.string() }), execute: (_input, { context }) => context.tenant });
		const simple = tool({ inputSchema: z.object({}), execute: () => 'simple' });
		function registry(enabled: boolean): { secured: typeof secured } | { simple: typeof simple } {
			return enabled ? { secured } : { simple };
		}
		// @ts-expect-error A registry alternative can require trusted context.
		await assert.rejects(create.Template({ template: '{{ secured({}) }}', tools: registry(true) })(), /context/i);
		// @ts-expect-error Script checks the same alternatives.
		await assert.rejects(create.Script({ script: 'return secured({})', tools: registry(true) })(), /context/i);
		function settings(enabled: boolean): { tools: { secured: typeof secured }; toolsContext: { secured: { tenant: string } } } | { tools: { simple: typeof simple } } {
			return enabled ? { tools: { secured }, toolsContext: { secured: { tenant: 'trusted' } } } : { tools: { simple } };
		}
		for (const enabled of [false, true]) {
			const name = enabled ? 'secured' : 'simple';
			assert.equal(await create.Template({ template: `{{ ${name}({}) }}`, ...settings(enabled) })(), enabled ? 'trusted' : 'simple');
			assert.equal(await create.Script({ script: `return ${name}({})`, ...settings(enabled) })(), enabled ? 'trusted' : 'simple');
		}
	});

	it('checks branch-only inherited descriptor hooks against a replaced schema', async () => {
		const text = z.object({ value: z.string() });
		const numeric = z.object({ value: z.number() });
		let hooks = 0;
		let bodies = 0;
		function settings(enabled: boolean): { inputSchema: typeof text; execute: () => string; onInputAvailable: (event: { input: { value: string } }) => void }
			| { inputSchema: typeof text; execute: () => string } {
			const execute = () => { bodies++; return 'ready'; };
			return enabled ? { inputSchema: text, execute, onInputAvailable: event => { hooks++; event.input.value.toUpperCase(); } } : { inputSchema: text, execute };
		}
		const parent = create.Config(settings(true));
		// @ts-expect-error The inherited string hook is incompatible with numeric application input.
		const invalid = create.Function.asTool({ inputSchema: numeric }, parent);
		await assert.rejects(new ToolLoopAgent({ model: modelFor({ value: 3 }), tools: { probe: invalid } }).generate({ prompt: 'run' }), /toUpperCase/);
		assert.equal(hooks, 1);
		assert.equal(bodies, 0);
		const valid = create.Function.asTool({ inputSchema: numeric, onInputAvailable: event => { event.input.value.toFixed(); } }, parent);
		await new ToolLoopAgent({ model: modelFor({ value: 3 }), tools: { probe: valid } }).generate({ prompt: 'run' });
		assert.equal(bodies, 1);
	});

	it('preserves native lifecycle error handling while rejecting incompatible inherited hooks statically', async () => {
		const text = z.object({ value: z.string() });
		const numeric = z.object({ value: z.number() });
		const model = new MockLanguageModelV3({ doGenerate: {
			content: [{ type: 'text', text: '{"value":3}' }], finishReason: { unified: 'stop', raw: 'stop' }, warnings: [],
			usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
		}, doStream: () => Promise.resolve({ stream: convertArrayToReadableStream([
			{ type: 'stream-start', warnings: [] }, { type: 'text-start', id: 'text' },
			{ type: 'text-delta', id: 'text', delta: '{"value":3}' }, { type: 'text-end', id: 'text' },
			{ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } } },
		]) }) });
		let started = 0;
		let finished = 0;
		function settings(enabled: boolean): { model: LanguageModel; prompt: string; output: ReturnType<typeof Output.object<z.output<typeof text>>>; onEnd: (event: { output?: { value: string } | undefined }) => void }
			| { model: LanguageModel; prompt: string; output: ReturnType<typeof Output.object<z.output<typeof text>>> } {
			return enabled ? { model, prompt: 'ready', output: Output.object({ schema: text }), onEnd: event => { started++; event.output?.value.toUpperCase(); finished++; } }
				: { model, prompt: 'ready', output: Output.object({ schema: text }) };
		}
		const parent = create.LLMAgent.asStream(settings(true));
		// @ts-expect-error A possible string callback cannot consume a numeric result.
		const invalid = create.LLMAgent.asStream({ output: Output.object({ schema: numeric }) }, parent);
		assert.deepEqual(await (await invalid()).value, { value: 3 });
		assert.equal(started, 1);
		assert.equal(finished, 0); // Native notify swallows the hook error; generation itself succeeds.
		const valid = create.LLMAgent.asStream({ onEnd: event => { assert.equal(event.output?.value, 3); finished++; }, output: Output.object({ schema: numeric }) }, parent);
		await (await valid()).value;
		assert.equal(finished, 1);
	});

	it('rejects forbidden settings in a selected configuration alternative at construction', async () => {
		function settings(enabled: boolean): { execute: () => number; contextSchema: undefined } | { execute: () => number } {
			return enabled ? { execute: () => 1, contextSchema: undefined } : { execute: () => 1 };
		}
		// @ts-expect-error Every possible configuration must exclude the SDK-only setting.
		assert.throws(() => create.Function(settings(true)), /toolContextSchema/);
		// @ts-expect-error Reusable fragments have the same forbidden-setting rule.
		assert.throws(() => create.Config(settings(true)), /toolContextSchema/);
		const absent = settings(false);
		assert(!('contextSchema' in absent));
		assert.equal(await create.Function(absent)(), 1);
		function runSettings(enabled: boolean): { temperature: number; contextSchema: undefined } | { temperature: number } {
			return enabled ? { temperature: 0, contextSchema: undefined } : { temperature: 0 };
		}
		const model = modelFor(undefined);
		const generator = create.LLMAgent({ model, prompt: 'ready' });
		// @ts-expect-error Named invocation settings reject the same forbidden branch.
		await assert.rejects(generator.run(runSettings(true)), /toolContextSchema/);
		assert.equal(model.doGenerateCalls.length, 0);
		assert.equal((await generator.run({ temperature: 0 })).value, 'done');
	});

	it('distinguishes absent trusted context from present null after parsing', async () => {
		let entries = 0;
		// @ts-expect-error Present null cannot become a flat execution context.
		const invalid = create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.null(), execute: () => { entries++; return 1; } });
		const bound = invalid.bindToolContext(null);
		await assert.rejects(async () => bound.tool.execute!({}, { toolCallId: 'null', messages: [], context: null }), /Expected an object context/);
		assert.equal(entries, 0);
		const absent = create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.undefined(), execute: () => 1 }).bindToolContext(undefined);
		assert.equal(await absent.tool.execute!({}, { toolCallId: 'absent', messages: [], context: undefined }), 1);
		const parsed = create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.null().transform(() => ({ tenant: 'trusted' })), execute: () => 2 }).bindToolContext(null);
		assert.equal(await parsed.tool.execute!({}, { toolCallId: 'parsed', messages: [], context: { tenant: 'trusted' } }), 2);
	});

	it('preserves parsed output when a schema exists in only one configuration branch', async () => {
		const schema = z.string().transform(text => text.length);
		function settings(parsed: boolean): { schema: typeof schema; execute: () => string } | { execute: () => string } {
			return parsed ? { schema, execute: () => 'hello' } : { execute: () => 'hello' };
		}
		for (const parsed of [false, true]) {
			const config = settings(parsed);
			const expected = parsed ? 5 : 'hello';
			const component = create.Function(config);
			assert.equal(await component(), expected);
			assert.equal(await component.run({}), expected);
			assert.equal(await create.Function({}, create.Config(config))(), expected);
			const child = create.Function.asTool({ inputSchema: z.object({}), ...config });
			assert.equal(await child.execute({}, { toolCallId: 'conditional', messages: [], context: undefined }), expected);
			const bound = child.bindToolContext({});
			assert.equal(await bound.tool.execute!({}, { toolCallId: 'bound', messages: [], context: bound.context }), expected);
			const owner = create.Function({ tools: { child }, execute: async ({ child }) => {
				const result = await child({});
				return typeof result === 'string' ? result.toUpperCase() : result;
			} });
			assert.equal(await owner(), parsed ? 5 : 'HELLO');
		}
	});

	it('protects private bindings supplied by only one inherited configuration branch', async () => {
		// eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type -- Exercise a genuinely absent context key.
		function settings(present: boolean): { context: { user: string } } | Record<never, never> {
			return present ? { context: { user: 'private' } } : {};
		}
		for (const present of [false, true]) {
			const render = create.Template({ inputSchema: z.looseObject({ value: z.number() }), template: '{{ value }}' }, { config: settings(present) });
			// Erase runtime arguments only; the compiler regression rejects this possible private replacement.
			const call = () => render({ value: 2, user: 'replacement' } as never);
			if (present) await assert.rejects(call, /Private input keys: user/);
			else assert.equal(await call(), '2');
			assert.equal(await render({ value: 2, extra: true }), '2');
		}
	});

	it('keeps closed schema alternatives closed beside an open branch', async () => {
		const inputSchema = z.union([
			z.strictObject({ kind: z.literal('closed'), value: z.number() }),
			z.looseObject({ kind: z.literal('open'), value: z.number() }),
		]);
		let entries = 0;
		const operation = create.Function({ inputSchema, execute: ({ value }) => { entries++; return value; } });
		const template = create.Template({ inputSchema, template: '{{ value }}' });
		const script = create.Script({ inputSchema, script: 'return value' });
		const model = modelFor(undefined);
		const generator = create.LLMAgent.withTemplate({ inputSchema, model, prompt: '{{ value }}' });
		const streamer = create.LLMAgent.withScript.asStream({ inputSchema, model, prompt: 'return "ready"' });
		const object = create.LLMAgent.withTemplate({ inputSchema, model, prompt: '{{ value }}', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
		const objectStream = create.LLMAgent.withScript.asStream({ inputSchema, model, prompt: 'return "ready"', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
		const invalid = { kind: 'closed', value: 2, extra: true };
		assert.equal(inputSchema.safeParse(invalid).success, false);
		for (const component of [operation, template, script, generator, streamer, object, objectStream]) {
			await assert.rejects((component as (input: object) => Promise<unknown>)(invalid), /Application input validation failed/);
		}
		const rejected = { context: invalid } as never;
		for (const call of [() => operation.run(rejected), () => template.run(rejected), () => script.run(rejected),
			() => generator.run(rejected), () => streamer.run(rejected), () => object.run(rejected), () => objectStream.run(rejected)]) {
			await assert.rejects(call(), /Application input validation failed/);
		}
		assert.equal(entries, 0);
		assert.equal(model.doGenerateCalls.length, 0);
		assert.equal(model.doStreamCalls.length, 0);
		const valid = { kind: 'open' as const, value: 2, extra: true };
		assert.deepEqual(inputSchema.parse(valid), valid);
		assert.equal(await operation(valid), 2);
		assert.equal(await template(valid), '2');
		assert.equal(await script(valid), 2);
		assert.equal((await generator(valid)).value, 'done');
		assert.equal(await collectTextStream((await streamer(valid)).value), 'done');
		assert.equal(await operation({ kind: 'closed', value: 2 }), 2);
	});

	it('checks mixed closed branches after shallow default merging and preserves native stripping', async () => {
		const inputSchema = z.union([
			z.strictObject({ kind: z.literal('closed'), value: z.number() }),
			z.looseObject({ kind: z.literal('open'), value: z.number(), extra: z.boolean() }),
		]);
		const component = create.Function({ inputSchema, context: { kind: 'open' as const, value: 2, extra: true }, execute: ({ value }) => value });
		// @ts-expect-error The configured extra remains present after changing the discriminator.
		await assert.rejects(component({ kind: 'closed' }), /Application input validation failed/);
		assert.equal(await component(), 2);
		assert.equal(await component({ kind: 'open' }), 2);
		const stripping = create.Function({ inputSchema: z.union([
			z.object({ kind: z.literal('closed'), value: z.number() }),
			z.looseObject({ kind: z.literal('open'), value: z.number() }),
		]), execute: input => Object.hasOwn(input, 'extra') });
		// @ts-expect-error Closed caller types reject extras even though native parsing strips them.
		assert.equal(await stripping({ kind: 'closed', value: 2, extra: true }), false);
		assert.equal(await stripping({ kind: 'open', value: 2, extra: true }), true);
	});

	it('requires object tool context for Casai while retaining native scalar context support', async () => {
		const model = modelFor(undefined);
		// @ts-expect-error Casai execution merges parsed context fields into an object.
		const component = create.LLMAgent.asTool({ model, prompt: 'ready', inputSchema: z.object({}), toolContextSchema: z.string() });
		const options = { toolCallId: 'context', messages: [], context: 'native context' };
		await assert.rejects(async () => component.execute({}, options), /Expected an object context/);
		assert.equal(model.doGenerateCalls.length, 0);
		const native = {
			inputSchema: z.object({}), contextSchema: z.string(),
			execute: (_input: object, options: ToolExecutionOptions<string>) => options.context,
		} satisfies Tool<object, string, string>;
		assert.deepEqual(await collectStream(executeTool({ tool: native, input: {}, options })), [{ type: 'final', output: 'native context' }]);
	});

	it('rejects branch-only private keys before rendering or provider dispatch', async () => {
		const model = modelFor(undefined);
		const config = { inputSchema: z.looseObject({ value: z.number() }), context: { user: 'private' } };
		const template = create.Template({ ...config, template: '{{ value }}' });
		const script = create.Script({ ...config, script: 'return value' });
		const generator = create.LLMAgent.withTemplate({ ...config, model, prompt: '{{ value }}' });
		const streamer = create.LLMAgent.withScript.asStream({ ...config, model, prompt: 'return "ready"' });
		const object = create.LLMAgent.withTemplate({ ...config, model, prompt: '{{ value }}', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
		const objectStream = create.LLMAgent.withTemplate.asStream({ ...config, model, prompt: '{{ value }}', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
		// This runtime matrix erases heterogeneous call signatures; compiler fixtures check concrete callers.
		for (const component of [template, script, generator, streamer, object, objectStream]) {
			await assert.rejects((component as (input: object) => Promise<unknown>)({ value: 1, user: 'admin' }), /Private input keys: user/);
		}
		const rejected = { context: { value: 1, user: 'admin' } } as never;
		for (const call of [() => template.run(rejected), () => script.run(rejected),
			() => generator.run(rejected), () => streamer.run(rejected), () => object.run(rejected), () => objectStream.run(rejected)]) {
			await assert.rejects(call(), /Private input keys: user/);
		}
		assert.equal(model.doGenerateCalls.length, 0);
		assert.equal(model.doStreamCalls.length, 0);
		assert.equal(await template({ value: 1, extra: 'allowed' }), '1');
		assert.equal(await script({ value: 1, extra: 'allowed' }), 1);
		assert.equal((await generator({ value: 1, extra: 'allowed' })).value, 'done');
		assert.equal(await collectTextStream((await streamer({ value: 1, extra: 'allowed' })).value), 'done');
	});

	it('accepts union arguments with optional declared tool fields', async () => {
		const inputSchema = z.object({ value: z.number(), extra: z.string().optional() });
		const operation = create.Function.asTool({ inputSchema, context: { user: 'private' }, execute: ({ value }) => value });
		const alternatives: ({ value: number } | { value: number; extra: string })[] = [{ value: 1 }, { value: 2, extra: 'allowed' }];
		for (const input of alternatives) {
			assert.deepEqual(inputSchema.parse(input), input);
			assert.equal(await operation(input), input.value);
			assert.equal(await operation.run({ context: input }), input.value);
			const owner = create.Function({ tools: { operation }, execute: ({ operation }) => operation(input) });
			assert.equal(await owner(), input.value);
		}
	});

	it('requires input declarations only when application context needs partitioning', async () => {
		const model = modelFor(undefined);
		const opaque = z.union([z.object({ value: z.number() }), z.union([z.object({ value: z.number() }), z.object({ value: z.number() })])]);
		const config = { model, inputSchema: opaque, context: { user: 'private' } };
		const schema = z.object({ answer: z.string() });
		const unsupported = [
			// @ts-expect-error Deliberately exercise runtime rejection of unsupported partitioning.
			create.LLMAgent.withTemplate({ ...config, prompt: '{{ value }}' }),
			// @ts-expect-error Script prompts use the same application boundary.
			create.LLMAgent.withScript({ ...config, prompt: 'return value' }),
			// @ts-expect-error Function preparers use the same application boundary.
			create.LLMAgent.withFunction({ ...config, prompt: ({ value }) => String(value) }),
			// @ts-expect-error Streamers also partition input before dispatch.
			create.LLMAgent.withTemplate.asStream({ ...config, prompt: '{{ value }}' }),
			// @ts-expect-error Object generators also partition input before dispatch.
			create.LLMAgent.withTemplate({ ...config, prompt: '{{ value }}', output: Output.object({ schema: schema }) }),
			// @ts-expect-error Object streamers also partition input before dispatch.
			create.LLMAgent.withTemplate.asStream({ ...config, prompt: '{{ value }}', output: Output.object({ schema: schema }) }),
		];
		for (const component of unsupported) await assert.rejects((component as (input: object) => Promise<unknown>)({ value: 1 }), /declared object branches/);
		assert.equal(model.doGenerateCalls.length, 0);
		assert.equal(model.doStreamCalls.length, 0);
		assert.deepEqual(opaque.parse({ value: 1 }), { value: 1 });
		const described = jsonSchema<{ value: number }>({ type: 'object', properties: { value: { type: 'number' } }, required: ['value'] }, {
			validate(value) {
				const parsed = opaque.safeParse(value);
				return parsed.success ? { success: true, value: parsed.data } : { success: false, error: parsed.error };
			},
		});
		const sourceFree = create.LLMAgent.withTemplate({ model, inputSchema: opaque, prompt: '{{ value }}' });
		const declared = create.LLMAgent.withTemplate({ ...config, inputSchema: z.object({ value: z.number() }), prompt: '{{ value }}' });
		const metadata = create.LLMAgent.withTemplate({ ...config, inputSchema: described, prompt: '{{ value }}' });
		for (const call of [() => sourceFree({ value: 1 }), () => declared({ value: 1 }), () => metadata({ value: 1 })]) assert.equal((await call()).value, 'done');
		assert.equal(model.doGenerateCalls.length, 3);
	});

	it('preserves both conditional input branches and their private ownership', async () => {
		for (const enabled of [false, true]) {
			const inputSchema = enabled ? z.object({ value: z.string().transform(Number) }) : undefined;
			const component = create.Function({ inputSchema, context: { value: '5' }, execute: ({ value }) => value });
			const expected = enabled ? 5 : '5';
			assert.equal(await component(), expected);
			assert.equal(await component.run({}), expected);
			// Deliberately bypass the conservative type to exercise each actual ownership boundary.
			const override = { value: '7' } as never;
			if (enabled) {
				assert.equal(await component(override), 7);
				assert.equal(await component.run({ context: override }), 7);
			} else {
				await assert.rejects(component(override), /Private input keys: value/);
				await assert.rejects(component.run({ context: override }), /Private input keys: value/);
			}
			const parent = create.Config({ inputSchema, context: { value: '5' } });
			assert.equal(await create.Function({ execute: ({ value }) => value }, parent)(), expected);
			const unconfigured = create.Function({ inputSchema, execute: ({ value }) => value });
			assert.equal(await unconfigured({ value: '7' }), enabled ? 7 : '7');
			const generator = create.LLMAgent.withFunction({
				model: modelFor(undefined), inputSchema, context: { value: '5' },
				prompt: ({ value }) => {
					assert.equal(value, expected);
					return String(value);
				},
			});
			assert.equal((await generator()).value, 'done');
		}
	});

	it('preserves native descriptions and compatible inherited replacements', async () => {
		const fragment = create.Config({
			toolContextSchema: z.object({ tenant: z.string() }),
			description: ({ context }) => `Tenant ${context.tenant.toUpperCase()}`,
		});
		const operation = create.Function.asTool({ inputSchema: z.object({}), execute: () => 'ok' }, fragment);
		const replacement = create.Function.asTool({
			toolContextSchema: z.object({ tenant: z.number() }),
			description: ({ context }) => `Tenant ${context.tenant.toFixed(0)}`,
		}, operation);
		const model = modelFor(undefined);
		const original = operation.bindToolContext({ tenant: 'alpha' });
		const changed = replacement.bindToolContext({ tenant: 3 });
		await generateText({ model, prompt: 'done', tools: { probe: original.tool }, toolsContext: { probe: original.context } });
		await generateText({ model, prompt: 'done', tools: { probe: changed.tool }, toolsContext: { probe: changed.context } });
		for (const [index, expected] of ['Tenant ALPHA', 'Tenant 3'].entries()) {
			const descriptor = model.doGenerateCalls[index].tools?.[0];
			assert(descriptor?.type === 'function');
			assert.equal(descriptor.description, expected);
		}
	});

	it('preserves raw and parsed results when an output schema is conditional', async () => {
		for (const enabled of [false, true]) {
			const schema = enabled ? z.string().transform(value => value.length) : undefined;
			const component = create.Function({ schema, execute: () => 'hello' });
			const expected = enabled ? 5 : 'hello';
			assert.equal(await component(), expected);
			assert.equal(await component.run({}), expected);
			const child = create.Function.asTool({ inputSchema: z.object({}), schema, execute: () => 'hello' });
			assert.equal(await child.execute({}, { context: undefined, toolCallId: 'conditional', messages: [] }), expected);
			const owner = create.Function({ tools: { child }, execute: ({ child }) => child({}) });
			assert.equal(await owner(), expected);
		}
	});

	it('requires complete input when configured alternatives each miss a field', async () => {
		const inputSchema = z.object({ a: z.number(), b: z.number() });
		const alternatives: ({ a: number } | { b: number })[] = [{ a: 1 }, { b: 1 }];
		for (const context of alternatives) {
			const script = create.Script({ context, inputSchema, script: 'return a + b' });
			const template = create.Template({ context, inputSchema, template: '{{ a + b }}' });
			const model = modelFor(undefined);
			const generator = create.LLMAgent.withTemplate({ model, context, inputSchema, prompt: '{{ a + b }}' });
			await assert.rejects(script(undefined as never), /Application input validation failed/);
			await assert.rejects(template(undefined as never), /Application input validation failed/);
			await assert.rejects(generator.run({} as never), /Application input validation failed/);
			assert.equal(model.doGenerateCalls.length, 0);
			assert.equal(await script({ a: 2, b: 3 }), 5);
			assert.equal(await template({ a: 2, b: 3 }), '5');
			assert.equal((await generator.run({ context: { a: 2, b: 3 } })).value, 'done');
		}
	});

	it('uses configured declared defaults and parsed values without restoring removed fields', async () => {
		let parses = 0;
		const dependency = { name: 'private' };
		const component = create.Function({
			context: { amount: '4', dependency },
			inputSchema: z.object({ amount: z.string() }).transform(({ amount }) => {
				parses++;
				return { doubled: Number(amount) * 2 };
			}),
			execute: context => ({ doubled: context.doubled, dependency: context.dependency, restored: 'amount' in context, options: context._toolOptions }),
		});
		assert.deepEqual(await component(), { doubled: 8, dependency, restored: false, options: {} });
		assert.deepEqual(await component.run({ context: { amount: '6' } }), { doubled: 12, dependency, restored: false, options: {} });
		assert.equal(parses, 2);
		assert.equal(component.config.context.dependency, dependency);
	});

	for (const mode of ['generate', 'stream'] as const) {
		it(`${mode}: protects private bindings and public transport through a real SDK call`, async () => {
			let entries = 0;
			const component = create.Function.asTool({
				context: { factor: 3, user: 'private-sentinel' },
				inputSchema: z.object({ factor: z.number() }),
				execute: context => { entries++; return context.factor; },
			});
			const model = modelFor({ user: 'admin' });
			const config = { model, tools: { probe: component }, prompt: 'go', stopWhen: isStepCount(2) };
			const result = mode === 'generate' ? await generateText(config) : streamText(config);
			const steps = await result.steps;
			assert.equal(entries, 0);
			assert.equal(steps.length, 2);
			assert(!JSON.stringify(steps.flatMap(step => step.response.messages)).includes('private-sentinel'));
			assert(!JSON.stringify(mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls).includes('private-sentinel'));
			assert(!JSON.stringify(await asSchema(component.inputSchema).jsonSchema).includes('private-sentinel'));
		});

		it(`${mode}: binds incoming public defaults above configuration and below explicit arguments`, async () => {
			const seen: number[] = [];
			const component = create.Function.asTool({
				context: { factor: 3 },
				inputSchema: z.object({ factor: z.number() }),
				toolContextSchema: z.object({ factor: z.number(), user: z.string() }),
				execute: context => { seen.push(context.factor); return context.factor; },
			});
			for (const input of [{}, { factor: 3 }]) {
				const binding = component.bindToolContext({ factor: 5, user: 'private-sentinel' });
				const config = { model: modelFor(input), tools: { probe: binding.tool }, toolsContext: { probe: binding.context }, prompt: 'go', stopWhen: isStepCount(2) };
				const result = mode === 'generate' ? await generateText(config) : streamText(config);
				await result.steps;
				assert(!JSON.stringify(await asSchema(binding.tool.inputSchema).jsonSchema).includes('private-sentinel'));
			}
			assert.deepEqual(seen, [5, 3]);
		});
	}

	it('guards ordinary, run, injected and transformed forwarding destinations', async () => {
		let entries = 0;
		const child = create.Function({
			context: { user: 'private-sentinel' },
			execute: context => { entries++; return context.user; },
		});
		await assert.rejects(child({ user: 'admin' } as never), /Private input keys: user/);
		// @ts-expect-error Exercise runtime rejection of a private replacement too.
		await assert.rejects(child.run({ context: { user: 'admin' } }), /Private input keys: user/);
		const toolChild = create.Function.asTool({
			context: { user: 'private-sentinel' },
			inputSchema: z.object({ value: z.string() }).transform(({ value }) => ({ user: value })),
			execute: () => { entries++; },
		});
		const parent = create.Function({
			tools: { child: toolChild },
			execute: context => context.child({ value: 'admin' }),
		});
		await assert.rejects(parent(), /Private input keys: user/);
		assert.equal(entries, 0);
	});

	it('keeps native scalar tools and native generator completion semantics', async () => {
		const native = tool({
			inputSchema: z.number(),
			contextSchema: z.object({ factor: z.number() }),
			async *execute(input, { context }) { yield -1; yield input * context.factor; },
		});
		const component = create.Function({ tools: { native }, toolsContext: { native: { factor: 3 } }, execute: context => context.native(4) });
		assert.equal(await component(), 12);
	});

	it('normalizes keyword calls before parsing and never trusts a metadata marker', async () => {
		const component = create.Function({
			inputSchema: z.object({ value: z.number() }).strict(),
			execute: context => ({ value: context.value, metadata: context._toolOptions }),
		});
		assert.deepEqual(await component({ value: 2, __hasKeywordArgs: true } as never), { value: 2, metadata: {} });
		await assert.rejects(component({ value: 'invalid', _toolCallOptions: {} } as never), ValidationError);
		const open = create.Function({ inputSchema: z.looseObject({ value: z.number() }), execute: context => context._toolOptions });
		assert.deepEqual(await open({ value: 2, _toolOptions: { toolCallId: 'forged', messages: [] } }), {});
	});

	for (const kind of ['Script', 'Template'] as const) {
		it(`${kind}: normalizes coded run keywords and retains the settings boundary`, async () => {
			const inputSchema = z.object({ value: z.number() }).strict();
			const children = [
				create.Function({ inputSchema, execute: ({ value }) => value * 2 }),
				create.Script({ inputSchema, script: 'return value * 2' }),
				create.Template({ inputSchema, template: '{{ value * 2 }}' }),
			];
			for (const child of children) {
				const context = { child, settings: { context: { value: 3 } }, data: { value: 3 } };
				for (const expression of ['child(value=3)', 'child.run(settings)', 'child.run(context=data)']) {
					const result = kind === 'Script'
						? await create.Script({ context, script: `return ${expression}` })()
						: await create.Template({ context, template: `{{ ${expression} }}` })();
					assert.equal(String(result), '6');
				}
				const render = (expression: string) => kind === 'Script'
					? create.Script({ context, script: `return ${expression}` })()
					: create.Template({ context, template: `{{ ${expression} }}` })();
				await assert.rejects(render('child.run(context=data, typo=1)'), /Unknown run settings: typo/);
				await assert.rejects(render('child.run(settings, context=data)'), /context object or named arguments/);
				await assert.rejects(render('child.run(settings, settings)'), /one settings object/);
			}
		});

		it(`${kind}: snapshots source settings before asynchronous preparation`, async () => {
			let release!: () => void;
			const pending = new Promise<void>(resolve => { release = resolve; });
			const inputSchema = z.object({}).refine(async () => { await pending; return true; });
			if (kind === 'Script') {
				const component = create.Script({ script: 'return "configured"', inputSchema });
				const settings = { script: 'return "first"' };
				const first = component.run(settings);
				settings.script = 'return "second"';
				const second = component.run(settings);
				release();
				assert.deepEqual(await Promise.all([first, second]), ['first', 'second']);
				assert.equal(await component(), 'configured');
			} else {
				const component = create.Template({ template: 'configured', inputSchema });
				const settings = { template: 'first' };
				const first = component.run(settings);
				settings.template = 'second';
				const second = component.run(settings);
				release();
				assert.deepEqual(await Promise.all([first, second]), ['first', 'second']);
				assert.equal(await component(), 'configured');
			}
		});

		it(`${kind}: renders prepared values, supports run and injected tools`, async () => {
			const config = {
				context: { raw: '4', private: 'secret' },
				inputSchema: z.object({ raw: z.string() }).transform(({ raw }) => ({ value: Number(raw) })),
				tools: { double: tool({ inputSchema: z.object({ value: z.number() }), execute: ({ value }) => value * 2 }) },
			};
			if (kind === 'Script') {
				const component = create.Script({ ...config, script: 'return double(value=value)' });
				assert.equal(await component.run({}), 8);
			} else {
				const component = create.Template({ ...config, template: '{{ double(value=value) }}' });
				assert.equal(await component.run({}), '8');
			}
		});
	}

	it('parses stream elements lazily and collects declared tool streams', async () => {
		let pulls = 0;
		async function* values() { pulls++; yield '2'; yield '3'; }
		const schema = streamSchema(z.string().transform(Number));
		const component = create.Function({ schema, execute: () => values() });
		const result = await component();
		assert.equal(pulls, 0);
		assert.deepEqual(await collectStream(result), [2, 3]);
		const text = create.Function.asTool({ inputSchema: z.object({}), schema: textStreamSchema(), execute: async function* () { yield 'a'; yield 'b'; } });
		const input = await validateTypes({ schema: text.inputSchema, value: {} });
		assert.equal(await text.execute(input, { toolCallId: 'test', messages: [], context: undefined }), 'ab');
	});
});
