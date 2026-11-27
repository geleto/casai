import type { SchemaType, InferInputSchema, InferSchema } from './types/schema.js';
import type { Schema } from 'ai';
import { jsonSchema } from 'ai';
import { ConfigError, ValidationError } from './errors.js';
import { parseSchema, validateSchemaVersion } from './schema.js';
import { isWebStream } from './runtime/web-input.js';

export { makeSharedIterable } from 'cascada-engine';

// A structural marker preserves runtime and declaration compatibility across copies.
const streamKind = '~casaiStream';
export interface StreamSchema<INPUT, OUTPUT, KIND extends 'text' | 'elements'> extends Schema<AsyncIterable<OUTPUT>> {
	readonly [streamKind]: KIND;
	readonly '~input'?: AsyncIterable<INPUT>;
}

export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
	return value !== null && (typeof value === 'object' || typeof value === 'function')
		&& Symbol.asyncIterator in value && typeof value[Symbol.asyncIterator] === 'function';
}

/** A reader can cancel a pending read, including before the producer's first event. */
export function readableIterator<T>(stream: ReadableStream<T>): AsyncIterableIterator<T> & AsyncDisposable {
	const reader = stream.getReader();
	let finished: Promise<void> | undefined;
	const done = { done: true, value: undefined } as const;
	function finish(cancel: boolean, reason?: unknown) {
		return finished ??= (cancel ? reader.cancel(reason) : Promise.resolve()).finally(() => { reader.releaseLock(); });
	}
	return {
		[Symbol.asyncIterator]() { return this; },
		[Symbol.asyncDispose]() { return finish(true); },
		async next() {
			if (finished) return done;
			try {
				const result = await reader.read();
				if (!result.done) return { done: false, value: result.value };
			} catch (error) { await finish(false); throw error; }
			await finish(false);
			return done;
		},
		async return(value?: unknown) { await finish(true, value); return { done: true, value }; },
		async throw(error?: unknown) { await finish(true, error); throw error; },
	};
}

function sourceIterator<T>(source: AsyncIterable<T>): AsyncIterator<T> {
	// The standard Web iterator queues return() behind next(). Preserve custom iterators.
	if (isWebStream(source) && source[Symbol.asyncIterator] === source.values) return readableIterator(source as ReadableStream<T>);
	return source[Symbol.asyncIterator]();
}

function checkedIterator<T>(source: AsyncIterable<unknown>, parse: (value: unknown) => T | PromiseLike<T>) {
	let input: AsyncIterator<unknown> | undefined;
	let cancelled = false;
	async function cancel(reason?: unknown) {
		if (cancelled) return;
		cancelled = true;
		await input?.return?.(reason);
	}
	// Web streams serialize concurrent reads and settle outstanding reads on cancellation.
	return readableIterator(new ReadableStream<T>({
		async pull(controller) {
			input ??= sourceIterator(source);
			const item = await input.next();
			if (cancelled) return;
			if (item.done) { controller.close(); return; }
			try {
				const parsed = await parse(item.value);
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- validation can be asynchronous.
				if (!cancelled) controller.enqueue(parsed);
			} catch (error) {
				try { await cancel(); } catch { /* Preserve the validation error. */ }
				throw error;
			}
		},
		cancel,
	}, { highWaterMark: 0 }));
}

function declaredStream<INPUT, OUTPUT, KIND extends 'text' | 'elements'>(kind: KIND, parse: (value: unknown) => OUTPUT | PromiseLike<OUTPUT>): StreamSchema<INPUT, OUTPUT, KIND> {
	return Object.assign(jsonSchema<AsyncIterable<OUTPUT>>({}, {
		validate(value) {
			if (!isAsyncIterable(value)) return { success: false, error: new ValidationError('Expected an async iterable.') };
			return { success: true, value: {
				[Symbol.asyncIterator]: () => checkedIterator(value, parse),
			} };
		},
	}), { [streamKind]: kind });
}

export function textStreamSchema(): StreamSchema<string, string, 'text'> {
	return declaredStream('text', value => {
		if (typeof value !== 'string') throw new ValidationError('Text stream element validation failed.');
		return value;
	});
}

export function streamSchema<S extends SchemaType<unknown>>(schema: S): StreamSchema<InferInputSchema<S>, InferSchema<S>, 'elements'> {
	validateSchemaVersion(schema);
	return declaredStream('elements', async value => (await parseSchema(schema, value, 'Stream element')).value as InferSchema<S>);
}

export async function collectStream<T>(source: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = [];
	for await (const value of source) values.push(value);
	return values;
}

export async function collectTextStream(source: AsyncIterable<string>): Promise<string> {
	let text = '';
	for await (const value of source) text += value;
	return text;
}

export async function toolOutput(value: unknown, schema: unknown): Promise<unknown> {
	if (!isAsyncIterable(value)) return value;
	const kind = schema && typeof schema === 'object' && streamKind in schema ? schema[streamKind] : undefined;
	if (kind === 'text') return collectTextStream(value as AsyncIterable<string>);
	if (kind === 'elements') return collectStream(value);
	throw new ConfigError('A tool returning an async iterable requires textStreamSchema() or streamSchema().');
}

export function toReadableStream<T>(source: AsyncIterable<T>): ReadableStream<T> {
	let iterator: AsyncIterator<T> | undefined;
	let cancelled = false;
	return new ReadableStream<T>({
		async pull(controller) {
			if (cancelled) return;
			try {
				iterator ??= sourceIterator(source);
				const result = await iterator.next();
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cancel can run while next is pending.
				if (cancelled) return;
				if (result.done) controller.close();
				else controller.enqueue(result.value);
			} catch (error) {
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cancel can run before the pending read rejects.
				if (!cancelled) controller.error(error);
			}
		},
		async cancel(reason) {
			cancelled = true;
			try {
				await iterator?.return?.(reason);
			} catch {
				// Match the SDK bridge: cancellation does not fail on producer cleanup.
			}
		},
	}, { highWaterMark: 0 });
}
