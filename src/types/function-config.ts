import type { ApplicationShape, CollectedResult, ExecutionContext, ToolExecutionContext } from './application.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type * as types from './types.js';
import type * as configs from './config.js';
import type { ConfigValue, ToolContextFromConfig } from './config.js';

// Infer property presence separately from schema values. This preserves optional
// keys in conditional spreads without assuming that their parsers will run.
type SchemaKey = 'inputSchema' | 'schema' | 'toolContextSchema';
type SchemaSetting<T, K extends SchemaKey, S> = EmptyMap extends Pick<NoInfer<T>, keyof T & K>
	? Partial<Record<K, S>> : Record<K, S>;
export type SchemaConfigInferShape<T, Input, Output, Context> =
	Pick<{ [K in keyof T]: unknown }, keyof T & SchemaKey>
	& SchemaSetting<T, 'inputSchema', Input> & SchemaSetting<T, 'schema', Output> & SchemaSetting<T, 'toolContextSchema', Context>;
export type ConfigSchemas<T, Input, Output, Context> = Pick<{
	[K in keyof T]: K extends 'inputSchema' ? Input : K extends 'schema' ? Output : Context;
}, keyof T & SchemaKey>;

type PropertyType<T, K extends PropertyKey> = K extends keyof T ? T[K] : undefined;
// A required present branch preserves undefined in values supplied to context.
export type ContextSetting<CONTEXT> = { context: CONTEXT } | { context?: never };

// Configured context is a runtime value, so context that may be absent has optional fields.
type ConfiguredContext<CONTEXT> = [NonNullable<CONTEXT>] extends [never] ? undefined
	: undefined extends CONTEXT ? Partial<NonNullable<CONTEXT>> : CONTEXT;

export type InputSchemaOf<T> = Extract<ConfigValue<T, 'inputSchema'>, types.SchemaType<Record<string, any>> | undefined>;
export type ToolInputSchemaOf<T> = Extract<InputSchemaOf<T>, types.SchemaType<Record<string, any>>>;
export type OutputSchemaOf<T> = Extract<ConfigValue<T, 'schema'>, types.SchemaType<any> | undefined>;
export type ContextOf<T> = Extract<ConfiguredContext<PropertyType<T, 'context'>>, Record<string, any> | undefined>;
type ConfiguredContextOf<T> = Extract<PropertyType<T, 'context'>, Record<string, any> | undefined>;
export type ExecuteOf<T> = Extract<PropertyType<T, 'execute'>, (...args: any) => any>;

export type DeclaredInput<T, AsTool extends boolean = false> = AsTool extends true ? ToolExecutionContext<T> : ExecutionContext<T>;
export type CallInput<T> = ApplicationShape<T>;

type DeclaredOutput<S, Present = Exclude<S, undefined>> = [Present] extends [never] ? unknown
	: PromiseLike<types.InferInputSchema<Present, any>> | types.InferInputSchema<Present, any>;

// The execute a config defines through its declared schemas and context.
export type DeclaredExecute<T> = (
	input: DeclaredInput<T, true>
) => DeclaredOutput<OutputSchemaOf<T>>;

export type DeclaredFunctionExecute<T> = (input: DeclaredInput<T>) => DeclaredOutput<OutputSchemaOf<T>>;

// The contract each final config defines. A schema fixes execute's input and output; without one, execute defines them.
export type ExpectedFunctionConfig<T> = Omit<configs.FunctionConfig<InputSchemaOf<T>, OutputSchemaOf<T>, ConfiguredContextOf<T>>, 'execute'>
	& { execute: DeclaredFunctionExecute<T> };
export type ExpectedToolConfig<T> = Omit<configs.FunctionToolConfig<ToolInputSchemaOf<T>, OutputSchemaOf<T>, ConfiguredContextOf<T>, ContextOf<T>, ToolContextFromConfig<T>>, 'execute' | keyof configs.ToolProperties>
	& { execute: DeclaredExecute<T> }
	& configs.ToolProperties<types.InferSchema<InputSchemaOf<T>>, CollectedResult<T>, ToolContextFromConfig<T>>;

// Assemble only known schema settings, configured context and registry for
// callback inference. The ordinary merge preserves omission versus undefined.
export type ConfigInferDefinition<Parent, Schemas, Context, Tools, ToolsContext> =
	Parent extends unknown ? MergedConfig<Omit<Parent, 'execute'>, Schemas
		& ([Context] extends [undefined] ? EmptyMap : { context: Context })
		& { tools: Tools; toolsContext: ToolsContext }> : never;

// Function-property syntax checks the callback against the input schema's contract.
interface InputSchemaFunctionExecuteContext<T> {
	execute?: (input: DeclaredInput<T>) => DeclaredOutput<OutputSchemaOf<T>>;
}

// Method syntax deliberately permits bivariant parameters: without an input schema,
// callback annotations can define additional input fields. An output schema may still exist.
interface NoInputSchemaFunctionExecuteContext<T> {
	execute?(input: DeclaredInput<T>): DeclaredOutput<OutputSchemaOf<T>>;
}

// Include an inferred annotation when available; comparing an optional parameter only to OpenInput loses its fields.
export type FunctionExecuteContext<T, TActual = EmptyMap> = InputSchemaOf<T> extends types.SchemaType<any>
	? InputSchemaFunctionExecuteContext<T>
	: NoInputSchemaFunctionExecuteContext<MergedConfig<T, Pick<TActual, 'execute' & keyof TActual>>>;

// Without a guaranteed output parser, native callbacks may receive its raw input.
export type ToolExecuteContext<T> = {
	execute?: (input: DeclaredInput<T, true>) => DeclaredOutput<OutputSchemaOf<T>>;
} & configs.ToolProperties<types.InferSchema<InputSchemaOf<T>>,
	CollectedResult<T & { execute: () => DeclaredOutput<OutputSchemaOf<T>> }>, ToolContextFromConfig<T>>;

// A reusable fragment may become an ordinary Function or an SDK tool. Explicit callback
// annotations select one contract; the consuming factory checks that choice after merging.
type AnyConfigExecute<T> = {
	callback(input: DeclaredInput<T> | DeclaredInput<T, true>): DeclaredOutput<OutputSchemaOf<T>>;
}['callback'];

export type AnyConfigExecuteContext<T, TActual = EmptyMap,
	TResolved = MergedConfig<T, Pick<TActual, 'execute' & keyof TActual>>,
> = 'toolContextSchema' extends keyof T ? ToolExecuteContext<TResolved> : { execute?: AnyConfigExecute<TResolved> } & Pick<configs.ToolProperties<any, any, ToolContextFromConfig<TResolved>>, 'description'>;
