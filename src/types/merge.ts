import type { ILoaderAny } from 'cascada-engine';

// eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type -- An absent map has no keys.
export type EmptyMap = Record<never, never>;

// These maps merge by key. Values within each map are replaced, not deep-merged.
export const configMapKeys = ['context', 'filters', 'tools', 'toolsContext'] as const;
type ConfigMapKey = typeof configMapKeys[number];

type Value<T, K extends PropertyKey> = K extends keyof T ? T[K] : never;

// With exactOptionalPropertyTypes, an optional property is absent or holds its declared type, never an implicit undefined.
type ExactOptionalProperties = { value?: undefined } extends { value?: never } ? false : true;

// An absent child property keeps the parent value; only an undefined the child can actually hold removes it.
type OptionalValue<B, K extends keyof B> = ExactOptionalProperties extends true ? Required<Pick<B, K>>[K] : B[K];

type SpreadValue<A, B, K extends PropertyKey> = K extends keyof B
	? EmptyMap extends Pick<B, K> ? K extends keyof A ? A[K] | OptionalValue<B, K> : B[K] : B[K]
	: Value<A, K>;

/** Object spread that preserves optional properties and possible parent values. */
export type MergedProperties<A, B> = {
	[K in keyof A]: SpreadValue<A, B, K>;
} & {
	[K in keyof B]: SpreadValue<A, B, K>;
};

// An optional finite map can be absent, so its new entries are optional.
type MapValue<T> = [NonNullable<T>] extends [never] ? EmptyMap : NonNullable<T> extends object
	? undefined extends T ? string extends keyof NonNullable<T> ? NonNullable<T> : Partial<NonNullable<T>>
	: NonNullable<T> : EmptyMap;

type ProcessedValue<K, T> = K extends 'loader' ? ILoaderAny[] | (undefined extends T ? undefined : never) : T;
export type ProcessedConfig<T> = { [K in keyof T]: ProcessedValue<K, T[K]> };

type ArrayElement<T> = T extends readonly (infer ELEMENT)[] ? ELEMENT : never;
type MergedValue<A, B, K extends PropertyKey> = K extends 'loader'
	// mergeConfigs normalizes a supplied or inherited loader chain, including explicit undefined.
	? ILoaderAny[]
	: K extends 'messages'
	? 'messages' extends keyof A ? 'messages' extends keyof B
	? (ArrayElement<A['messages']> | ArrayElement<B['messages']>)[] : SpreadValue<A, B, K> : SpreadValue<A, B, K>
	: K extends keyof A & keyof B
	? K extends ConfigMapKey ? MergedProperties<MapValue<A[K]>, MapValue<B[K]>>
	: SpreadValue<A, B, K>
	: SpreadValue<A, B, K>;

/** The shared config merge policy, matching mergeConfigs at runtime. */
export type MergedConfig<A, B> = {
	[K in keyof A]: MergedValue<A, B, K>;
} & {
	[K in keyof B]: MergedValue<A, B, K>;
};
