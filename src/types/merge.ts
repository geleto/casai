import type { EmptyMap, UnionKeys } from './utils.js';
import type { LoaderGroup } from 'cascada-engine';
import type { sourceMode, RetainedSourceMode, ResolvedSourceMode, SourceModeSetting } from '../config/source-mode.js';

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

/** Object spread per union branch, preserving optional properties and possible parent values. */
export type MergedProperties<A, B> = A extends unknown ? B extends unknown ? {
	[K in keyof A]: SpreadValue<A, B, K>;
} & {
	[K in keyof B]: SpreadValue<A, B, K>;
} : never : never;

// An absent map contributes no entries; it does not replace parent entries with undefined.
type MapValue<T> = [T] extends [never] ? EmptyMap : T extends object ? T : EmptyMap;
type ReadableMap<T, Keys extends PropertyKey = UnionKeys<T>> = T extends unknown
	? Exclude<Keys, keyof T> extends never ? T : T & Partial<Record<Exclude<Keys, keyof T>, never>> : never;
type MergedMap<A, B, Result = MergedProperties<MapValue<A>, MapValue<B>>> = undefined extends A | B ? ReadableMap<Result> : Result;

type ProcessedValue<K, T> = K extends 'loader' ? LoaderGroup | (undefined extends T ? undefined : never) : T;
export type ProcessedConfig<T> = T extends unknown
	? typeof sourceMode extends keyof T
		? { [K in keyof T as K extends typeof sourceMode ? never : K]: ProcessedValue<K, T[K]> } & RetainedSourceMode<T>
		: 'loader' extends keyof T ? { [K in keyof T]: ProcessedValue<K, T[K]> } : T : never;

type LoaderValue<T> = 'loader' extends keyof T ? T['loader'] : undefined;

type MergedValue<A, B, K extends PropertyKey> = K extends 'loader'
	// Loaders combine or inherit; the result may be undefined if neither side supplies one.
	? LoaderGroup | (undefined extends LoaderValue<A> ? undefined extends LoaderValue<B> ? undefined : never : never)
	: K extends 'streaming' | 'asTool' ? A extends Record<K, true> ? true : B extends Record<K, true> ? true : SpreadValue<A, B, K> | Extract<Value<A, K> | Value<B, K>, true>
	: K extends keyof A & keyof B
	? K extends ConfigMapKey ? MergedMap<A[K], B[K]>
	: SpreadValue<A, B, K>
	: SpreadValue<A, B, K>;

/** The shared config merge policy per union branch, matching mergeConfigs at runtime. */
type MergedSourceMode<A, B> = typeof sourceMode extends keyof A | keyof B
	? A extends Record<typeof sourceMode, unknown> ? ResolvedSourceMode<MergedValue<A, B, typeof sourceMode>>
	: B extends Record<typeof sourceMode, unknown> ? ResolvedSourceMode<MergedValue<A, B, typeof sourceMode>>
	: SourceModeSetting<MergedValue<A, B, typeof sourceMode>> : unknown;

export type MergedConfig<A, B> = A extends unknown ? B extends unknown ? {
	[K in keyof A as K extends typeof sourceMode ? never : K]: MergedValue<A, B, K>;
} & {
	[K in keyof B as K extends typeof sourceMode ? never : K]: MergedValue<A, B, K>;
} & MergedSourceMode<A, B> : never : never;
