// Native dependency probes for Phase 2. No Casai protection is implemented here.
import assert from 'node:assert/strict';
import { Output, ToolLoopAgent } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { asSchema } from '@ai-sdk/provider-utils';
import { z as z3 } from 'zod/v3';
import { z as z4 } from 'zod/v4';

function mockModel() {
	const finishReason = { unified: 'stop', raw: 'stop' } as const;
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	return new MockLanguageModelV3({
		doGenerate: { content: [{ type: 'text', text: 'ok' }], finishReason, usage, warnings: [] },
		doStream: { stream: convertArrayToReadableStream([
			{ type: 'stream-start', warnings: [] },
			{ type: 'text-start', id: 'text' },
			{ type: 'text-delta', id: 'text', delta: 'ok' },
			{ type: 'text-end', id: 'text' },
			{ type: 'finish', finishReason, usage },
		]) },
	});
}

describe('Native schema copying and output metadata', () => {
	for (const [version, runtimeZod] of [['Zod 3', z3], ['Zod 4', z4]] as const) {
		// These cases use the common runtime API. The two libraries' incompatible
		// generic schema definitions cannot share a callable union; type inference
		// is checked with the actual version-specific types in sdk-output-inference.
		const z = runtimeZod as unknown as typeof z4;
		describe(version, () => {
			for (const frozen of [false, true]) {
				it(`copies declared paths and preserves originals (${frozen ? 'frozen' : 'mutable'})`, async () => {
					const input = { profile: { name: ' Ada ' }, items: [{ n: '3' }], extra: { shared: true } };
					if (frozen) {
						Object.freeze(input.profile);
						Object.freeze(input.items[0]);
						Object.freeze(input.items);
						Object.freeze(input.extra);
						Object.freeze(input);
					}
					const schema = z.object({
						profile: z.object({ name: z.string().trim() }),
						items: z.array(z.object({ n: z.string().transform(Number) })),
						count: z.number().default(2),
					}).passthrough().refine(async () => true);
					const result = await asSchema(schema).validate!(input);
					assert.equal(result.success, true);
					const parsed = result.value;
					assert.equal(parsed.profile.name, 'Ada');
					assert.equal(parsed.items[0]?.n, 3);
					assert.equal(parsed.count, 2);
					assert.notEqual(parsed, input);
					assert.notEqual(parsed.profile, input.profile);
					assert.notEqual(parsed.items, input.items);
					assert.notEqual(parsed.items[0], input.items[0]);
					assert.equal(parsed.extra, input.extra);
					assert.deepEqual(input, { profile: { name: ' Ada ' }, items: [{ n: '3' }], extra: { shared: true } });
					for (const value of [input, input.profile, input.items, input.items[0], input.extra]) {
						assert.equal(Object.isFrozen(value), frozen);
						assert.equal(Object.isSealed(value), frozen);
					}
				});
			}

			it('strips unknown keys only from the parsed container', () => {
				const input = { n: '3', extra: { intact: true } };
				const parsed = z.object({ n: z.coerce.number() }).parse(input);
				assert.deepEqual(parsed, { n: 3 });
				assert.deepEqual(input, { n: '3', extra: { intact: true } });
			});

			it('preserves opaque clients and functions with non-mutating validators', () => {
				class Client { status = 'ready'; }
				const input = { client: new Client(), callback: () => 'ok' };
				const parsed = z.object({ client: z.instanceof(Client), callback: z.unknown() }).parse(input);
				assert.equal(parsed.client, input.client);
				assert.equal(parsed.callback, input.callback);
				assert.equal(Object.isFrozen(input.client), false);
			});

			it('supports pure replacements that copy the changed path and share other paths', () => {
				const input = { profile: { name: ' Ada ' }, untouched: { shared: true } };
				const schema = z.custom<typeof input>().transform(value => ({
					...value, profile: { ...value.profile, name: value.profile.name.trim() },
				}));
				const parsed = schema.parse(input);
				assert.equal(parsed.profile.name, 'Ada');
				assert.equal(input.profile.name, ' Ada ');
				assert.notEqual(parsed.profile, input.profile);
				assert.equal(parsed.untouched, input.untouched);
			});

			it('freezes an owned structural result on successful readonly parsing', () => {
				const input = { n: 3 };
				const parsed = z.object({ n: z.number() }).readonly().parse(input);
				assert.notEqual(parsed, input);
				assert.equal(Object.isFrozen(parsed), true);
				assert.equal(Object.isFrozen(input), false);
			});

			it('demonstrates freezing a borrowed opaque value, even through the SDK validator', async () => {
				const borrowed = { n: 3 };
				const input = { borrowed };
				const result = await asSchema(z.object({ borrowed: z.unknown().readonly() })).validate!(input);
				assert.equal(result.success, true);
				assert.equal(Object.isFrozen(borrowed), true);
				assert.equal(Object.isFrozen(input), false);
			});

			it('demonstrates a shared catch fallback being frozen', () => {
				const shared = { n: 3 };
				const parsed = z.object({ n: z.number() }).catch(() => shared).readonly().parse('invalid');
				assert.equal(parsed, shared);
				assert.equal(Object.isFrozen(shared), true);
			});

			it('demonstrates a pure transform returning a shared object that readonly freezes', () => {
				const shared = { n: 3 };
				const parsed = z.string().transform(() => shared).readonly().parse('input');
				assert.equal(parsed, shared);
				assert.equal(Object.isFrozen(shared), true);
			});

			it('characterizes static and factory defaults without assuming deep copying', () => {
				const shared = { nested: { n: 3 } };
				const inner = z.object({ nested: z.object({ n: z.number() }) });
				const staticParsed = inner.default(shared).parse(undefined);
				const factoryParsed = inner.default(() => shared).parse(undefined);
				assert.notEqual(staticParsed, shared);
				assert.equal(staticParsed.nested === shared.nested, version === 'Zod 4');
				assert.equal(factoryParsed === shared, version === 'Zod 4');
				assert.equal(factoryParsed.nested === shared.nested, version === 'Zod 4');
				assert.equal(Object.isFrozen(shared), false);
				assert.equal(Object.isFrozen(shared.nested), false);
			});

			it('characterizes a shared default outside the input copy boundary', () => {
				const shared = { n: 3 };
				const input = {};
				const schema = z.object({ value: z.object({ n: z.number() }).default(() => shared).readonly() });
				const parsed = schema.parse(structuredClone(input));
				assert.deepEqual(input, {});
				assert.equal(parsed.value === shared, version === 'Zod 4');
				assert.equal(Object.isFrozen(shared), version === 'Zod 4');
			});

			it('keeps fresh defaults separate on successive parses', () => {
				const schema = z.object({ n: z.number() }).default(() => ({ n: 3 })).readonly();
				const first = schema.parse(undefined);
				const second = schema.parse(undefined);
				assert.notEqual(first, second);
				assert.equal(Object.isFrozen(first), true);
				assert.equal(Object.isFrozen(second), true);
			});

			it('characterizes freezing on invalid input and unsuccessful union branches', () => {
				const invalidString = { n: 3 };
				assert.equal(z.string().readonly().safeParse(invalidString).success, false);
				assert.equal(Object.isFrozen(invalidString), version === 'Zod 4');
				const invalidObject: unknown[] = [];
				assert.equal(z.object({ n: z.number() }).readonly().safeParse(invalidObject).success, false);
				assert.equal(Object.isFrozen(invalidObject), version === 'Zod 4');
				const unionInput = { n: 3 };
				const result = z.union([z.string().readonly(), z.object({ n: z.number() })]).safeParse(unionInput);
				assert.equal(result.success, true);
				assert.equal(Object.isFrozen(unionInput), version === 'Zod 4');
			});

			it('characterizes failed nested readonly parsing after a shallow context merge', async () => {
				const context = { payload: { n: 3 } };
				const prepared = { ...context };
				const result = await asSchema(z.object({ payload: z.string().readonly() })).validate!(prepared);
				assert.equal(result.success, false);
				assert.equal(Object.isFrozen(context.payload), version === 'Zod 4');
				assert.equal(Object.isFrozen(context), false);
			});
		});
	}

	it('Zod 4 prefault parses a shared fallback before readonly freezes its copy', () => {
		const shared = { nested: { n: 3 } };
		const schema = z4.object({ nested: z4.object({ n: z4.number() }) }).prefault(() => shared).readonly();
		const parsed = schema.parse(undefined);
		assert.notEqual(parsed, shared);
		assert.notEqual(parsed.nested, shared.nested);
		assert.equal(Object.isFrozen(shared), false);
		assert.equal(Object.isFrozen(shared.nested), false);
		assert.equal(Object.isFrozen(parsed), true);
	});

	it('Zod 4 readonly/default wrapper order changes which value is frozen', () => {
		const shared = { n: 3 };
		const parsed = z4.object({ n: z4.number() }).readonly().default(() => shared).parse(undefined);
		assert.equal(parsed, shared);
		assert.equal(Object.isFrozen(parsed), false);
	});

	it('distinguishes output modes at runtime, including an array inside object output', () => {
		const text = Output.text();
		const choice = Output.choice({ options: ['yes', 'no'] });
		const object = Output.object({ schema: z4.string() });
		const array = Output.array({ element: z4.number() });
		const arrayObject = Output.object({ schema: z4.array(z4.number()) });
		assert.deepEqual([text.name, choice.name, object.name, array.name, arrayObject.name], ['text', 'choice', 'object', 'array', 'object']);
		for (const output of [text, choice, object, arrayObject]) {
			assert.equal(output.createElementStreamTransform(), undefined);
		}
		assert.ok(array.createElementStreamTransform() instanceof TransformStream);
	});

	for (const mode of ['generate', 'stream'] as const) {
		it(`native ToolLoopAgent.${mode} freezes a borrowed readonly option`, async () => {
			const borrowed = { n: 3 };
			const agent = new ToolLoopAgent({
				model: mockModel(),
				callOptionsSchema: z4.object({ payload: z4.unknown().readonly() }),
				prepareCall: settings => {
					assert.equal(settings.options?.payload, borrowed);
					return settings;
				},
			});
			const result = await agent[mode]({ prompt: 'test', options: { payload: borrowed } });
			assert.equal(await result.output, 'ok');
			assert.equal(Object.isFrozen(borrowed), true);
		});

		it(`native ToolLoopAgent.${mode} can freeze caller data before rejecting invalid options`, async () => {
			const model = mockModel();
			const borrowed = { n: 3 };
			const agent = new ToolLoopAgent({
				model,
				callOptionsSchema: z4.object({ payload: z4.string().readonly() }),
			});
			await assert.rejects(() => agent[mode]({
				prompt: 'test',
				// @ts-expect-error Exercise invalid input from a JavaScript caller.
				options: { payload: borrowed },
			}));
			assert.equal(Object.isFrozen(borrowed), true);
			assert.equal(model.doGenerateCalls.length + model.doStreamCalls.length, 0);
		});

		it(`native ToolLoopAgent.${mode} freezes a shared object supplied by a default factory`, async () => {
			const shared = { n: 3 };
			const agent = new ToolLoopAgent({
				model: mockModel(),
				callOptionsSchema: z4.object({ payload: z4.unknown().default(() => shared).readonly() }),
			});
			// @ts-expect-error Native call-options types describe parsed values; exercise the raw default boundary.
			const result = await agent[mode]({ prompt: 'test', options: { payload: undefined } });
			assert.equal(await result.output, 'ok');
			assert.equal(Object.isFrozen(shared), true);
		});
	}
});
