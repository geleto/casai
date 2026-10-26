import assert from 'node:assert/strict';
import { consumeStream, isDeepEqualData, jsonSchema } from 'ai';
import { convertAsyncIteratorToReadableStream, isRecord, removeUndefinedEntries, safeValidateTypes, validateTypes } from '@ai-sdk/provider-utils';
import { collectStream, toReadableStream } from './cascada';
import { parseSchema, requireContextObject, sameContext } from '../src/schema.js';
import { ValidationError } from '../src/errors.js';

describe('AI SDK reuse boundaries', () => {
	it('retains native record admission, including class instances and null-prototype objects', () => {
		class Resource { value = 1; }
		for (const value of [{}, Object.create(null), new Resource(), new Date(), [], null, undefined, 1, '', true, () => 1]) {
			if (isRecord(value)) assert.equal(requireContextObject(value), value);
			else assert.throws(() => requireContextObject(value), ValidationError);
		}
	});

	it('keeps context binding identity stricter than native deep data equality', () => {
		const dependency = { count: 1 };
		const left = { dependency };
		const replacement = { dependency: { count: 1 } };
		assert.equal(isDeepEqualData(left, replacement), true);
		assert.equal(sameContext(left, replacement), false);
		assert.equal(sameContext(left, { dependency }), true);
		const secret = Symbol('private');
		assert.equal(isDeepEqualData({ [secret]: 1 }, { [secret]: 2 }), true);
		assert.equal(sameContext({ [secret]: 1 }, { [secret]: 2 }), false);
	});

	it('keeps own undefined and null bindings that the native entry filter removes', () => {
		const bindings = { missing: undefined, empty: null, value: 1 };
		assert.deepEqual(removeUndefinedEntries(bindings), { value: 1 });
		assert.equal(sameContext(bindings, { ...bindings }), true);
		assert.equal(sameContext(bindings, removeUndefinedEntries(bindings)), false);
	});

	it('preserves thenable application data with the native safe-validation envelope', async () => {
		let calls = 0;
		const value = { then(resolve: (value: string) => void) { calls++; resolve('assimilated'); } };
		const schema = jsonSchema<typeof value>({});
		const safe = await safeValidateTypes({ schema, value });
		assert.equal(safe.success && safe.value, value);
		assert.equal((await parseSchema(schema, value)).value, value);
		assert.equal(calls, 0);
		const unwrapped: unknown = await validateTypes({ schema, value });
		assert.equal(unwrapped, 'assimilated');
		assert.equal(calls, 1);
	});

	it('distinguishes the native prefetching bridge from demand-only conversion', async () => {
		let nativePulls = 0, localPulls = 0;
		async function* nativeSource() { while (true) yield ++nativePulls; }
		async function* localSource() { while (true) yield ++localPulls; }
		const native = convertAsyncIteratorToReadableStream(nativeSource());
		const local = toReadableStream(localSource());
		try {
			await new Promise(resolve => setTimeout(resolve, 0));
			assert.equal(nativePulls, 1);
			assert.equal(localPulls, 0);
		} finally {
			await Promise.all([native.cancel(), local.cancel()]);
		}
	});

	it('keeps collection failures observable unlike native discard-only consumption', async () => {
		const failure = new Error('producer failed');
		const source: AsyncIterable<number> = {
			[Symbol.asyncIterator]() { return { next: () => Promise.reject(failure) }; },
		};
		const reported: unknown[] = [];
		await consumeStream({ stream: convertAsyncIteratorToReadableStream(source[Symbol.asyncIterator]()), onError: error => { reported.push(error); } });
		assert.deepEqual(reported, [failure]);
		await assert.rejects(collectStream(source), error => error === failure);
	});
});
