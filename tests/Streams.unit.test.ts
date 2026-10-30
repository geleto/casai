import assert from 'node:assert/strict';
import { createTextStreamResponse } from 'ai';
import { create, z, ValidationError, textStreamSchema, streamSchema, collectStream, collectTextStream, toReadableStream, makeSharedIterable } from './cascada';

describe('Component streams', () => {
	it('keeps a collected stream paired with direct and inherited configurations when another branch has no schema', async () => {
		const schema = textStreamSchema();
		const chunks = async function* () { yield 'a'; yield 'b'; };
		for (const inherited of [false, true]) for (const streaming of [true, false]) {
			const config: { schema: typeof schema; execute: typeof chunks } | { execute: () => string } = streaming
				? { schema, execute: chunks }
				: { execute: () => 'ab' };
			const operation = inherited
				? create.Function.asTool({ inputSchema: z.object({}) }, create.Config(config))
				: create.Function.asTool({ inputSchema: z.object({}), ...config });
			const ordinary = await operation();
			assert.equal(typeof ordinary === 'string' ? ordinary : await collectTextStream(ordinary), 'ab');
			const options = { context: undefined, toolCallId: 'paired', messages: [] };
			assert.equal((await operation.execute({}, options)).toUpperCase(), 'AB');
			const bound = operation.bindToolContext({});
			assert.ok(bound.tool.execute);
			assert.equal(await bound.tool.execute({}, { ...options, context: bound.context }), 'ab');
			const owner = create.Function({ tools: { operation }, execute: async ({ operation }) => (await operation({})).toUpperCase() });
			assert.equal(await owner(), 'AB');
			assert.equal(await create.Script({ tools: { operation }, script: 'return operation({})' })(), 'ab');
		}
	});

	it('collects only the stream branch of a conditional output schema on every tool path', async () => {
		for (const streaming of [true, false]) {
			const mixed = create.Function.asTool({
				inputSchema: z.object({}), schema: streaming ? textStreamSchema() : z.number(),
				execute: () => streaming ? (async function* () { yield 'a'; yield 'b'; })() : 7,
			});
			const ordinary = await mixed();
			assert.equal(typeof ordinary === 'number' ? ordinary : await collectTextStream(ordinary), streaming ? 'ab' : 7);
			const options = { context: undefined, toolCallId: 'mixed', messages: [] };
			assert.equal(await mixed.execute({}, options), streaming ? 'ab' : 7);
			const binding = mixed.bindToolContext({});
			assert.ok(binding.tool.execute);
			assert.equal(await binding.tool.execute({}, { ...options, context: binding.context }), streaming ? 'ab' : 7);
			const owner = create.Function({ tools: { mixed }, execute: async ({ mixed }) => {
				const value = await mixed({});
				return typeof value === 'number' ? value : value.toUpperCase();
			} });
			assert.equal(await owner(), streaming ? 'AB' : 7);
			assert.equal(await create.Script({ tools: { mixed }, script: 'return mixed({})' })(), streaming ? 'ab' : 7);
			assert.equal(await create.Template({ tools: { mixed }, template: '{{ mixed({}) }}' })(), streaming ? 'ab' : '7');
		}
	});

	it('parses each consumed element lazily and closes the producer on failure', async () => {
		let acquired = 0, parsed = 0, closed = 0;
		const source = {
			async *[Symbol.asyncIterator]() {
				acquired++;
				try { yield '2'; yield 'bad'; yield '4'; } finally { closed++; }
			},
		};
		const component = create.Function({
			schema: streamSchema(z.string().transform(value => { parsed++; return Number(value); }).pipe(z.number())),
			execute: () => source,
		});
		const values = await component();
		assert.equal(acquired, 0);
		assert.equal(parsed, 0);
		const iterator = values[Symbol.asyncIterator]();
		assert.deepEqual(await iterator.next(), { value: 2, done: false });
		await assert.rejects(iterator.next(), error => error instanceof ValidationError && error.message === 'Stream element validation failed.' && error.cause instanceof Error);
		assert.equal(parsed, 2);
		assert.equal(closed, 1);
	});

	it('preserves re-iteration and the consumption of single-use sources', async () => {
		let parsed = 0;
		const schema = streamSchema(z.string().transform(value => { parsed++; return Number(value); }));
		const source = { async *[Symbol.asyncIterator]() { yield '3'; } };
		const repeatable = await create.Function({ schema, execute: () => source })();
		assert.deepEqual(await collectStream(repeatable), [3]);
		assert.deepEqual(await collectStream(repeatable), [3]);
		const single = await create.Function({ schema, execute: () => source[Symbol.asyncIterator]() })();
		assert.deepEqual(await collectStream(single), [3]);
		assert.deepEqual(await collectStream(single), []);
		assert.equal(parsed, 3);
	});

	it('preserves producer failures after the valid prefix', async () => {
		const failure = new Error('producer failed');
		const component = create.Function({ schema: textStreamSchema(), execute: async function* () { yield 'prefix'; throw failure; } });
		const iterator = (await component())[Symbol.asyncIterator]();
		assert.equal((await iterator.next()).value, 'prefix');
		await assert.rejects(iterator.next(), error => error === failure);
	});

	it('rejects invalid text elements and invalid stream roots', async () => {
		const text = create.Function({ schema: textStreamSchema(), execute: async function* () { yield 1 as never; } });
		await assert.rejects(async () => collectTextStream(await text()), /Text stream element validation failed/);
		const invalid = create.Function({ schema: textStreamSchema(), execute: () => 1 as never });
		await assert.rejects(invalid(), /Output validation failed/);
	});

	it('collects only a declared tool root, after one producer execution', async () => {
		let executions = 0, parsed = 0;
		const component = create.Function.asTool({
			inputSchema: z.object({}), schema: streamSchema(z.string().transform(value => { parsed++; return Number(value); })),
			execute: async function* () { executions++; yield '2'; yield '3'; },
		});
		const ordinary = await component();
		assert.equal(executions, 0);
		assert.deepEqual(await collectStream(ordinary), [2, 3]);
		const collected = await component.execute({}, { toolCallId: 'stream', messages: [], context: undefined });
		assert.deepEqual(collected, [2, 3]);
		assert.equal(executions, 2);
		assert.equal(parsed, 4);
		const text = create.Function.asTool({ inputSchema: z.object({}), schema: textStreamSchema(), execute: async function* () { yield 'a'; yield 'b'; } });
		assert.equal(await text.execute({}, { toolCallId: 'text', messages: [], context: undefined }), 'ab');
		assert.equal(await collectTextStream({ async *[Symbol.asyncIterator]() { /* Empty text stream. */ } }), '');
	});

	it('rejects undeclared tool roots without acquiring them and leaves nested iterables opaque', async () => {
		let acquired = 0;
		const source = { async *[Symbol.asyncIterator]() { acquired++; yield 1; } };
		// Erased outputs require the runtime check.
		const component = create.Function.asTool({ inputSchema: z.object({}), execute: (): unknown => source });
		await assert.rejects(async () => await component.execute({}, { toolCallId: 'undeclared', messages: [], context: undefined }), /requires textStreamSchema/);
		assert.equal(acquired, 0);
		assert.equal(await component(), source);
		const opaque = create.Function.asTool({ inputSchema: z.object({}), schema: z.any(), execute: () => source });
		await assert.rejects(async () => { await opaque.execute({}, { toolCallId: 'opaque', messages: [], context: undefined }); }, /requires textStreamSchema/);
		assert.equal(acquired, 0);
		const failure = new Error('body failed');
		const throwing = create.Function.asTool({ inputSchema: z.object({}), execute: (): never => { throw failure; } });
		await assert.rejects(async () => await throwing.execute({}, { toolCallId: 'throwing', messages: [], context: undefined }), error => error === failure);
		const nested = create.Function.asTool({ inputSchema: z.object({}), execute: () => ({ source }) });
		assert.equal((await nested.execute({}, { toolCallId: 'nested', messages: [], context: undefined })).source, source);
		assert.equal(acquired, 0);
	});

	it('exposes Script stream schemas and collects their tool output', async () => {
		const chunks = async function* () { yield 'a'; yield 'b'; };
		const script = create.Script.asTool({ inputSchema: z.object({}), context: { chunks }, script: 'return chunks()', schema: textStreamSchema() });
		assert.equal(await collectTextStream(await script()), 'ab');
		assert.equal(await script.execute({}, { toolCallId: 'script-stream', messages: [], context: undefined }), 'ab');
	});

	it('supports SDK response helpers with an explicit conversion', async () => {
		const component = create.Function({ schema: textStreamSchema(), execute: async function* () { yield 'hello'; yield ' world'; } });
		const response = createTextStreamResponse({ stream: toReadableStream(await component()) });
		assert.equal(await response.text(), 'hello world');
	});

	it('forwards cancellation to the active iterator and ignores cleanup failure like the SDK', async () => {
		let reason: unknown;
		const source: AsyncIterable<string> = {
			[Symbol.asyncIterator]() {
				return {
					next: async () => ({ value: 'chunk', done: false }),
					return: async value => { reason = value; throw new Error('cleanup failed'); },
				};
			},
		};
		const reader = toReadableStream(source).getReader();
		assert.equal((await reader.read()).value, 'chunk');
		await reader.cancel('finished');
		assert.equal(reason, 'finished');
	});

	it('cancels a pending read without enqueuing after closure', async () => {
		let resolve!: (result: IteratorResult<string>) => void;
		let returned = 0;
		const source: AsyncIterable<string> = {
			[Symbol.asyncIterator]() {
				return {
					next: () => new Promise(done => { resolve = done; }),
					return: async () => { returned++; return { done: true, value: undefined }; },
				};
			},
		};
		const reader = toReadableStream(source).getReader();
		const read = reader.read();
		await Promise.resolve();
		await reader.cancel();
		resolve({ done: false, value: 'late' });
		assert.deepEqual(await read, { done: true, value: undefined });
		assert.equal(returned, 1);
	});

	it('does not acquire a source when cancelled before the first pull', async () => {
		let acquired = 0;
		const source = { async *[Symbol.asyncIterator]() { acquired++; yield 1; } };
		const stream = toReadableStream(source);
		await new Promise(resolve => setTimeout(resolve, 0));
		assert.equal(acquired, 0);
		await stream.cancel();
		assert.equal(acquired, 0);
	});

	it('does not prefetch the next item while a reader is idle', async () => {
		let pulled = 0;
		const source = { async *[Symbol.asyncIterator]() { while (true) { pulled++; yield pulled; } } };
		const reader = toReadableStream(source).getReader();
		await new Promise(resolve => setTimeout(resolve, 0));
		assert.equal(pulled, 0);
		assert.equal((await reader.read()).value, 1);
		await new Promise(resolve => setTimeout(resolve, 0));
		assert.equal(pulled, 1);
		await reader.cancel();
	});

	it('propagates iterator acquisition and next failures', async () => {
		const failure = new Error('source failed');
		const acquisition = { [Symbol.asyncIterator](): AsyncIterator<string> { throw failure; } };
		await assert.rejects(toReadableStream(acquisition).getReader().read(), error => error === failure);
		const source = { async *[Symbol.asyncIterator]() { throw failure; yield 'unreachable'; } };
		await assert.rejects(toReadableStream(source).getReader().read(), error => error === failure);
	});

	it('shares validation once and closes only the cancelled reader until owner disposal', async () => {
		let parsed = 0, closed = 0;
		const component = create.Function({
			schema: streamSchema(z.number().transform(value => { parsed++; return value * 2; })),
			execute: async function* () { try { yield 1; yield 2; yield 3; } finally { closed++; } },
		});
		const shared = makeSharedIterable(await component());
		const reader = toReadableStream(shared).getReader();
		assert.equal((await reader.read()).value, 2);
		await reader.cancel();
		assert.equal(closed, 0);
		assert.deepEqual(await collectStream(shared), [2, 4, 6]);
		assert.equal(parsed, 3);
		await shared.dispose();
		assert.equal(closed, 1);
	});
});
