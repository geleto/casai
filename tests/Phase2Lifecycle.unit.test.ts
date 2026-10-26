// Design-boundary probes only. These are not production Phase 2 stream helpers.
import assert from 'node:assert/strict';
import { z } from 'zod/v4';
import { ToolLoopAgent, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { safeValidateTypes, validateTypes } from '@ai-sdk/provider-utils';
import type { FlexibleSchema } from '@ai-sdk/provider-utils';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { ValidationError } from '../src/errors.js';

// One possible lazy parser using the native Standard Schema normalization path.
// Stream kind discovery and public factory inference are separate design obligations.
function lazyElements<I, O>(schema: StandardSchemaV1<I, O>): StandardSchemaV1<AsyncIterable<I>, AsyncIterable<O>> {
	return { '~standard': { version: 1, vendor: 'phase2-lifecycle-probe', validate(value) {
		if (value === null || typeof value !== 'object' || !(Symbol.asyncIterator in value)) {
			return { issues: [{ message: 'Expected an async iterable.' }] };
		}
		const source = value as AsyncIterable<I>;
		return { value: { async *[Symbol.asyncIterator]() {
			for await (const element of source) {
				let parsed: O;
				try {
					parsed = await validateTypes({ schema, value: element });
				} catch (error) {
					throw new ValidationError('Stream element validation failed.', error instanceof Error ? error : undefined);
				}
				yield parsed;
			}
		} } };
	} } };
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
	const result: T[] = [];
	for await (const value of source) result.push(value);
	return result;
}

describe('Phase 2 lifecycle review probes', () => {
	it('keeps output parsing lazy and respects re-iterable versus single-use sources', async () => {
		let acquired = 0;
		let parsed = 0;
		const source = { async *[Symbol.asyncIterator]() { acquired++; yield '2'; } };
		const schema = lazyElements(z.string().transform(value => { parsed++; return Number(value); }));
		const nativeSchema: FlexibleSchema<AsyncIterable<number>> = schema;
		const output = await validateTypes({ schema: nativeSchema, value: source });
		assert.equal(acquired, 0);
		const unread = output[Symbol.asyncIterator]();
		assert.equal(acquired, 0);
		await unread.return?.();
		assert.equal(acquired, 0);
		assert.deepEqual(await collect(output), [2]);
		assert.deepEqual(await collect(output), [2]);
		assert.equal(acquired, 2);
		assert.equal(parsed, 2);
		const once = source[Symbol.asyncIterator]();
		const singleUse = await validateTypes({ schema, value: once });
		assert.deepEqual(await collect(singleUse), [2]);
		assert.deepEqual(await collect(singleUse), []);
	});

	it('wraps lazy element validation failures at the actual boundary and closes its iterator', async () => {
		let closed = 0;
		async function* source() { try { yield '2'; yield 'invalid'; } finally { closed++; } }
		const output = await validateTypes({ schema: lazyElements(z.string().regex(/^\d+$/).transform(Number)), value: source() });
		const iterator = output[Symbol.asyncIterator]();
		assert.deepEqual(await iterator.next(), { done: false, value: 2 });
		await assert.rejects(iterator.next(), error => error instanceof ValidationError && error.cause instanceof Error);
		assert.equal(closed, 1);
	});

	it('preserves producer failures and closes on consumer exit without reparsing', async () => {
		const failure = new Error('producer failed');
		async function* failed() { yield 2; throw failure; }
		const output = await validateTypes({ schema: lazyElements(z.number()), value: failed() });
		await assert.rejects(collect(output), error => error === failure);
		let closed = 0;
		async function* source() { try { yield 2; yield 3; } finally { closed++; } }
		const early = await validateTypes({ schema: lazyElements(z.number()), value: source() });
		for await (const value of early) { assert.equal(value, 2); break; }
		assert.equal(closed, 1);
	});

	it('characterizes native inputExamples using parsed types while advertising unparsed arguments', async () => {
		const inputSchema = z.object({ value: z.string().transform(Number) });
		const native = tool({ inputSchema, inputExamples: [{ input: { value: 2 } }], execute: input => input });
		assert.equal((await safeValidateTypes({ schema: inputSchema, value: native.inputExamples![0].input })).success, false);
		assert.equal((await safeValidateTypes({ schema: inputSchema, value: { value: '2' } })).success, true);
		const model = new MockLanguageModelV3({ doGenerate: async () => ({
			content: [{ type: 'text', text: 'done' }], finishReason: { unified: 'stop', raw: 'stop' },
			usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [],
		}) });
		await new ToolLoopAgent({ model, tools: { native } }).generate({ prompt: 'done' });
		const advertised = model.doGenerateCalls[0].tools?.find(entry => entry.type === 'function' && entry.name === 'native');
		assert.ok(advertised?.type === 'function');
		assert.deepEqual(advertised.inputExamples, native.inputExamples);
	});
});
