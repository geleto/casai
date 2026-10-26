import type { InferSchema, InferInputSchema } from './schema.js';
import type { FlexibleSchema } from 'ai';
import type { z } from 'zod/v4';
import type { Fields, NamedKeys, NonArrayObject } from './utils.js';

// Schema declaration discovery and object-shape checks. No component configuration is interpreted here.

export type ParsedSchemaOutput<TSchema> = TSchema extends FlexibleSchema<unknown> ? InferSchema<TSchema> : undefined;

type SchemaDeclarationKind<TSchema, TDepth extends unknown[] = [], AllowUnion extends boolean = false> = TDepth['length'] extends 12 ? 'dynamic'
	: TSchema extends z.core.$ZodObject ? 'object'
	: TSchema extends z.core.$ZodPipe<infer TInput, infer TOutput> ? SchemaDeclarationKind<TInput extends z.core.$ZodTransform ? TOutput : TInput, [...TDepth, 0], AllowUnion>
	: TSchema extends z.core.$ZodLazy<infer TInput> ? SchemaDeclarationKind<TInput, [...TDepth, 0], AllowUnion>
	: TSchema extends z.core.$ZodIntersection<infer TLeft, infer TRight> ? Exclude<SchemaDeclarationKind<TLeft | TRight, [...TDepth, 0]>, 'object'> extends never ? 'object' : 'dynamic'
	: TSchema extends { _zod: { def: { innerType: infer TInput } } } ? SchemaDeclarationKind<TInput, [...TDepth, 0], AllowUnion>
	: TSchema extends z.core.$ZodUnion<infer TBranches> ? AllowUnion extends true ? Exclude<SchemaDeclarationKind<TBranches[number], [...TDepth, 0]>, 'object'> extends never ? 'object' : 'unsupported' : 'unsupported'
	: TSchema extends z.core.$ZodTransform ? 'unsupported'
	: 'dynamic';

export type SchemaInputObject<TSchema> = unknown extends InferInputSchema<TSchema> ? Fields : NonArrayObject<InferInputSchema<TSchema>>;

export type SchemaOutputObject<TSchema> = unknown extends ParsedSchemaOutput<TSchema> ? Fields : NonArrayObject<ParsedSchemaOutput<TSchema>>;

type UnionSchemaBranches<TSchema> = TSchema extends z.core.$ZodUnion<infer TBranches> ? TBranches[number] : never;

export type SchemaInputNames<TSchema, TDepth extends unknown[] = []> = TDepth['length'] extends 12 ? NamedKeys<SchemaInputObject<TSchema>>
	: TSchema extends undefined ? never
	: TSchema extends z.core.$ZodObject<infer TShape> ? keyof TShape
	: TSchema extends z.core.$ZodLazy<infer TInput> ? SchemaInputNames<TInput, [...TDepth, 0]>
	: TSchema extends z.core.$ZodIntersection<infer TLeft, infer TRight> ? SchemaInputNames<TLeft, [...TDepth, 0]> | SchemaInputNames<TRight, [...TDepth, 0]>
	// Native input metadata skips a preprocessor's transform, retaining the next schema's raw declarations.
	: [UnionSchemaBranches<TSchema>] extends [never] ? TSchema extends z.core.$ZodPipe<infer TInput, infer TOutput> ? SchemaInputNames<TInput extends z.core.$ZodTransform ? TOutput : TInput, [...TDepth, 0]>
	: TSchema extends { _zod: { def: { innerType: infer TInput } } } ? SchemaInputNames<TInput, [...TDepth, 0]>
	: NamedKeys<SchemaInputObject<TSchema>> : SchemaInputNames<UnionSchemaBranches<TSchema>, [...TDepth, 0]>;

export type InputDeclarationKind<TSchema> = SchemaDeclarationKind<TSchema, [], true>;

// Read output declarations, not raw context input types. Bound type recursion
// only; runtime retains discoverable names and terminates cycles by identity.
export type SchemaOutputNames<TSchema, TDepth extends unknown[] = []> = TDepth['length'] extends 12 ? never
	: TSchema extends z.core.$ZodObject<infer TShape> ? keyof TShape
	: TSchema extends z.core.$ZodLazy<infer TInput> ? SchemaOutputNames<TInput, [...TDepth, 0]>
	: TSchema extends z.core.$ZodPipe<any, infer TOutput> ? SchemaOutputNames<TOutput, [...TDepth, 0]>
	: TSchema extends z.core.$ZodIntersection<infer TLeft, infer TRight> ? SchemaOutputNames<TLeft, [...TDepth, 0]> | SchemaOutputNames<TRight, [...TDepth, 0]>
	: TSchema extends { _zod: { def: { innerType: infer TInput } } } ? SchemaOutputNames<TInput, [...TDepth, 0]>
	: [UnionSchemaBranches<TSchema>] extends [never] ? never
	: SchemaOutputNames<UnionSchemaBranches<TSchema>, [...TDepth, 0]>;

type ValidateObjectSchemaOutput<TSchema> = unknown extends ParsedSchemaOutput<TSchema> ? unknown : [Exclude<ParsedSchemaOutput<TSchema>, undefined>] extends [NonArrayObject<ParsedSchemaOutput<TSchema>>]
	? unknown : { readonly 'Schema must produce an object context': never };

export type ValidateContextSchema<TSchema> = [SchemaInputObject<TSchema>] extends [never] ? { readonly 'Application input must be an object': never }
	: [SchemaOutputObject<TSchema>] extends [never] ? { readonly 'Schema must produce an object context': never } : ValidateObjectSchemaOutput<TSchema>;

export type ValidateToolContextSchema<TContextSchema> = [Exclude<TContextSchema, undefined>] extends [never] ? unknown : ValidateObjectSchemaOutput<Exclude<TContextSchema, undefined>>;

// Mixed schemas retain both policies: no global extra-key ban, but closed
// alternatives still require an exact effective-branch match.
export type HasClosedInput<TSchema, TInput = SchemaInputObject<TSchema>> = TInput extends unknown ? string extends keyof TInput ? false : true : never;

// Ordinary calls can merge union defaults. SDK tool projection cannot rewrite
// root alternatives; keep that restriction at tool construction/binding only.
export type HasRootSchemaAlternatives<TSchema, TDepth extends unknown[] = []> = TDepth['length'] extends 12 ? false
	: TSchema extends z.core.$ZodUnion ? true
	: TSchema extends z.core.$ZodPipe<infer TInput, infer TOutput> ? HasRootSchemaAlternatives<TInput extends z.core.$ZodTransform ? TOutput : TInput, [...TDepth, 0]>
	: TSchema extends z.core.$ZodLazy<infer TInput> ? HasRootSchemaAlternatives<TInput, [...TDepth, 0]>
	: TSchema extends z.core.$ZodIntersection<infer TLeft, infer TRight> ? HasRootSchemaAlternatives<TLeft | TRight, [...TDepth, 0]>
	: TSchema extends { _zod: { def: { innerType: infer TInput } } } ? HasRootSchemaAlternatives<TInput, [...TDepth, 0]> : false;

// Inspect raw object policies, including preprocessors whose raw type is unknown.
// Opaque schemas retain runtime metadata admission; no callbacks discover shapes.
export type HasOpenRootInput<TSchema, TDepth extends unknown[] = []> = unknown extends TSchema ? false : TDepth['length'] extends 12 ? false
	: TSchema extends z.core.$ZodObject<infer _Shape, infer TPolicy> ? string extends keyof TPolicy['in'] ? TPolicy['in'][string] extends never ? false : true : false
	: TSchema extends z.core.$ZodRecord ? true
	: TSchema extends z.core.$ZodPipe<infer TInput, infer TOutput> ? HasOpenRootInput<TInput extends z.core.$ZodTransform ? TOutput : TInput, [...TDepth, 0]>
	: TSchema extends z.core.$ZodLazy<infer TInput> ? HasOpenRootInput<TInput, [...TDepth, 0]>
	: TSchema extends z.core.$ZodUnion<infer TBranches> ? HasOpenRootInput<TBranches[number], [...TDepth, 0]>
	: TSchema extends z.core.$ZodIntersection<infer TLeft, infer TRight> ? HasOpenRootInput<TLeft | TRight, [...TDepth, 0]>
	: TSchema extends { _zod: { def: { innerType: infer TInput } } } ? HasOpenRootInput<TInput, [...TDepth, 0]>
	: false;
