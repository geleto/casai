import type { SchemaType } from './types.js';

export type UnionKeys<T> = T extends unknown ? keyof T : never;

// A successful alternative must not erase another alternative's failure.
export type InvalidUnionMembers<T, Shape> = T extends unknown
	? [StrictUnionSubtype<T, Shape>] extends [never] ? T : never : never;

export type Override<A, B> = {
	[K in keyof A | keyof B]: K extends keyof B
	? B[K] extends never
	? K extends keyof A ? A[K] : never
	: B[K]
	: K extends keyof A ? A[K] : never;
};

// Ensures T is an exact match of one of the union members in U
// Prevents extra properties and mixing properties from different union types
export type StrictUnionSubtype<T, U> = U extends any
	? T extends U
	? Exclude<keyof T, keyof U> extends never ? T : never
	: never
	: never;

export type InferParameters<T extends SchemaType<any>> = import('./types.js').InferSchema<T>;

export type EnsurePromise<T> = T extends Promise<any> ? T : Promise<T>;

export type ConditionalPromise<T, IsAsync extends boolean> = IsAsync extends true ? Promise<T> : T;
