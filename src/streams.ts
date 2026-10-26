import type { SchemaType, InferInputSchema, InferSchema } from './types/schema.js';
import type { Schema } from 'ai';
import { jsonSchema } from 'ai';
import { ConfigError, ValidationError } from './errors.js';
import { parseSchema, validateSchemaVersion } from './schema.js';

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

function declaredStream<INPUT, OUTPUT, KIND extends 'text' | 'elements'>(kind: KIND, parse: (value: unknown) => OUTPUT | PromiseLike<OUTPUT>): StreamSchema<INPUT, OUTPUT, KIND> {
	return Object.assign(jsonSchema<AsyncIterable<OUTPUT>>({}, {
		validate(value) {
			if (!isAsyncIterable(value)) return { success: false, error: new ValidationError('Expected an async iterable.') };
			return { success: true, value: {
				async *[Symbol.asyncIterator]() {
					for await (const item of value) yield await parse(item);
				},
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
				iterator ??= source[Symbol.asyncIterator]();
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
