import type { FlexibleSchema, InferSchema as SDKInferSchema } from 'ai';
import type { z } from 'zod';

// Zod 3's tagged definition is excluded even through its Standard Schema surface.
// Native SDK tools keep the SDK's wider schema contract.
export type SchemaType<T> = FlexibleSchema<T> & { readonly _def?: object & { readonly typeName?: never } };

// Preserve concrete Zod output through schema intersections; SDK inference alone can widen it.
export type InferSchema<S, Fallback = unknown> = S extends z.core.$ZodType ? z.core.output<S>
	: S extends FlexibleSchema<unknown> ? SDKInferSchema<S> : Fallback;

type SchemaInput<S, Fallback> = '~input' extends keyof S ? S['~input'] extends infer I ? Exclude<I, undefined> : never
	: S extends { _input: infer I } | { _zod: { input: infer I } } ? 0 extends (1 & I) ? InferSchema<S, Fallback> : I
	: S extends { readonly '~standard': { readonly types?: { readonly input: infer I } } } ? I : InferSchema<S, Fallback>;

// An explicit SDK FlexibleSchema annotation erases raw input types; preserve
// native output inference there, and precise raw types for retained schemas.
export type InferInputSchema<S, Fallback = unknown> = [FlexibleSchema<InferSchema<S, Fallback>>] extends [S]
	? InferSchema<S, Fallback> : SchemaInput<S, Fallback>;

export type ContextFromSchema<TSchema> = InferSchema<TSchema, undefined>;
