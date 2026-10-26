import type { FlexibleSchema } from 'ai';
import type { SchemaType, InferInputSchema, InferSchema } from './schema.js';
import type { EmptyMap } from './utils.js';
import type { CollectedResult } from './result.js';
import type { ExecutionContext, ToolExecutionContext } from './execution.js';
import type { MergedConfig } from './merge.js';
import type { ConfigValue, ToolContextFromConfig } from './config.js';
import type * as configs from './config.js';

type PropertyType<T, K extends PropertyKey> = K extends keyof T ? T[K] : undefined;

// Configured context is a runtime value, so context that may be absent has optional fields.
type ConfiguredContext<CONTEXT> = [NonNullable<CONTEXT>] extends [never] ? undefined
	: undefined extends CONTEXT ? Partial<NonNullable<CONTEXT>> : CONTEXT;

type InputSchemaOf<T> = Extract<ConfigValue<T, 'inputSchema'>, SchemaType<Record<string, any>> | undefined>;
type ToolInputSchemaOf<T> = Extract<InputSchemaOf<T>, SchemaType<Record<string, any>>>;
type OutputSchemaOf<T> = Extract<ConfigValue<T, 'schema'>, SchemaType<any> | undefined>;
type ContextOf<T> = Extract<ConfiguredContext<PropertyType<T, 'context'>>, Record<string, any> | undefined>;
type ConfiguredContextOf<T> = Extract<PropertyType<T, 'context'>, Record<string, any> | undefined>;

type DeclaredInput<T, AsTool extends boolean = false> = AsTool extends true ? ToolExecutionContext<T> : ExecutionContext<T>;

type DeclaredOutput<S, Present = Exclude<S, undefined>> = [Present] extends [never] ? unknown
	: PromiseLike<InferInputSchema<Present, any>> | InferInputSchema<Present, any>;

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
	& configs.ToolProperties<InferSchema<InputSchemaOf<T>>, CollectedResult<T>, ToolContextFromConfig<T>>;

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
export type FunctionExecuteContext<T, TActual = EmptyMap> = InputSchemaOf<T> extends SchemaType<any>
	? InputSchemaFunctionExecuteContext<T>
	: NoInputSchemaFunctionExecuteContext<MergedConfig<T, Pick<TActual, 'execute' & keyof TActual>>>;

// Without a guaranteed output parser, native callbacks may receive its raw input.
export type ToolExecuteContext<T> = {
	execute?: (input: DeclaredInput<T, true>) => DeclaredOutput<OutputSchemaOf<T>>;
} & configs.ToolProperties<InferSchema<InputSchemaOf<T>>,
	CollectedResult<T & { execute: () => DeclaredOutput<OutputSchemaOf<T>> }>, ToolContextFromConfig<T>>;

// A reusable fragment may become an ordinary Function or an SDK tool. Explicit callback
// annotations select one contract; the consuming factory checks that choice after merging.
type AnyConfigExecute<T> = {
	callback(input: DeclaredInput<T> | DeclaredInput<T, true>): DeclaredOutput<OutputSchemaOf<T>>;
}['callback'];

export type AnyConfigExecuteContext<T, TActual = EmptyMap,
	TResolved = MergedConfig<T, Pick<TActual, 'execute' & keyof TActual>>,
> = 'toolContextSchema' extends keyof T ? ToolExecuteContext<TResolved> : { execute?: AnyConfigExecute<TResolved> } & Pick<configs.ToolProperties<any, any, ToolContextFromConfig<TResolved>>, 'description'>;

export type FunctionImplementation<
	InputSchema extends SchemaType<Record<string, any>> | undefined,
	OutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	ExecuteFunction extends (...args: any) => any = (...args: any) => any,
> = (context: ExecutionContext<{ inputSchema: InputSchema; context: CONTEXT }>) => OutputSchema extends SchemaType<any>
	? InferInputSchema<OutputSchema> | PromiseLike<InferInputSchema<OutputSchema>> : ReturnType<ExecuteFunction>;

export type FunctionToolImplementation<
	InputSchema extends SchemaType<Record<string, any>>,
	OutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	ExecuteFunction extends (...args: any) => any = (...args: any) => any,
	TOOL_CONTEXT = undefined,
> = (context: ToolExecutionContext<{ inputSchema: InputSchema; context: CONTEXT; toolContextSchema: TOOL_CONTEXT extends undefined ? undefined : FlexibleSchema<TOOL_CONTEXT> }>) => OutputSchema extends SchemaType<any>
	? InferInputSchema<OutputSchema> | PromiseLike<InferInputSchema<OutputSchema>> : ReturnType<ExecuteFunction>;
