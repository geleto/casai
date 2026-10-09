import type { ToolExecutionOptions } from 'ai';
import type { EmptyMap, MergedConfig } from './merge.js';
import type * as types from './types.js';
import type * as configs from './config.js';
import type { DeclaredType, ToolContextFromConfig } from './config.js';

type PropertyType<T, K extends PropertyKey> = K extends keyof T ? T[K] : undefined;
// A required present branch preserves undefined in values supplied to context.
export type ContextSetting<CONTEXT> = { context: CONTEXT } | { context?: never };

// Configured context is a runtime value, so context that may be absent has optional fields.
type ConfiguredContext<CONTEXT> = [NonNullable<CONTEXT>] extends [never] ? undefined
	: undefined extends CONTEXT ? Partial<NonNullable<CONTEXT>> : CONTEXT;

export type InputSchemaOf<T> = Extract<DeclaredType<T, 'inputSchema'>, types.SchemaType<Record<string, any>> | undefined>;
export type ToolInputSchemaOf<T> = Extract<InputSchemaOf<T>, types.SchemaType<Record<string, any>>>;
export type OutputSchemaOf<T> = Extract<DeclaredType<T, 'schema'>, types.SchemaType<any> | undefined>;
export type ContextOf<T> = Extract<ConfiguredContext<PropertyType<T, 'context'>>, Record<string, any> | undefined>;
type ConfiguredContextOf<T> = Extract<PropertyType<T, 'context'>, Record<string, any> | undefined>;
export type ExecuteOf<T> = Extract<PropertyType<T, 'execute'>, (...args: any) => any>;

// A parent's optional schema keys state its contract, so they merge as present.
type DeclaredKeys = 'schema' | 'contextSchema';
export type DeclaredConfig<T> = Omit<T, DeclaredKeys> & { [K in DeclaredKeys & keyof T]: DeclaredType<T, K> };

type OpenInput = Record<string, any>;
type ContextKeys<T> = [NonNullable<ContextOf<T>>] extends [never] ? never : keyof NonNullable<ContextOf<T>>;

// Without an input schema, execute's own parameter defines the input; an untyped one leaves it open.
// The wrapper always merges an object, so optional/nullable callback parameters still require their fields.
type ExecuteInput<T> = ExecuteOf<T> extends (input: infer INPUT, ...args: any) => any
	? unknown extends INPUT ? OpenInput : [NonNullable<INPUT>] extends [never] ? OpenInput : NonNullable<INPUT>
	: OpenInput;

type InputWithoutContext<INPUT, KEYS extends PropertyKey> = INPUT extends unknown ? Omit<INPUT, KEYS> : never;
type ExecuteCallInput<INPUT, KEYS extends PropertyKey> = INPUT extends unknown
	? Omit<INPUT, KEYS> & Partial<Pick<INPUT, KEYS & keyof INPUT>> : never;

type SchemaInput<TInputSchema, T, AsTool extends boolean = false> = TInputSchema extends types.SchemaType<any>
	? AsTool extends true ? types.InferSchema<TInputSchema> : types.InferContextInputSchema<TInputSchema>
	: InputWithoutContext<ExecuteInput<T>, ContextKeys<T>>;

// What execute receives: the schema input or, without a schema, the input execute declares, plus configured context.
export type DeclaredInput<T, AsTool extends boolean = false> = types.InputWithContext<SchemaInput<InputSchemaOf<T>, T, AsTool>, ContextOf<T>, InputSchemaOf<T>, AsTool extends true ? false : true>;

// What callers pass: the schema input or, without a schema, what execute needs; configured fields become optional.
type SchemaCallInput<TInputSchema, T> = TInputSchema extends types.SchemaType<any>
	? types.InputWithContext<types.InferContextInputSchema<TInputSchema>, ContextOf<T>, TInputSchema, true, true>
	: ExecuteCallInput<ExecuteInput<T>, ContextKeys<T>>;
export type CallInput<T> = SchemaCallInput<InputSchemaOf<T>, T>;

type DeclaredOutput<TOutputSchema> = TOutputSchema extends types.SchemaType<any>
	? PromiseLike<types.InferInputSchema<TOutputSchema, any>> | types.InferInputSchema<TOutputSchema, any>
	: unknown;

// The execute a config defines through its declared schemas and context.
export type DeclaredExecute<T> = (
	input: DeclaredInput<T, true>,
	options: ToolExecutionOptions<NoInfer<ToolContextFromConfig<T>>>,
) => DeclaredOutput<OutputSchemaOf<T>>;

export type DeclaredFunctionExecute<T> = (input: DeclaredInput<T>) => DeclaredOutput<OutputSchemaOf<T>>;

// The contract each final config defines. A schema fixes execute's input and output; without one, execute defines them.
export type ExpectedFunctionConfig<T> = Omit<configs.FunctionConfig<InputSchemaOf<T>, OutputSchemaOf<T>, ConfiguredContextOf<T>>, 'execute'>
	& { execute: DeclaredFunctionExecute<T> };
export type ExpectedToolConfig<T> = Omit<configs.FunctionToolConfig<ToolInputSchemaOf<T>, OutputSchemaOf<T>, ConfiguredContextOf<T>, ContextOf<T>, ToolContextFromConfig<T>>, 'execute'>
	& { execute: DeclaredExecute<T> };

// The properties a child sets through its separately inferred schema and context generics.
type ChildDeclarations<TInputSchema, TOutputSchema, CONTEXT, TContextSchema> =
	& ([TInputSchema] extends [never] ? EmptyMap : { inputSchema: TInputSchema })
	& ([TOutputSchema] extends [never] ? EmptyMap : { schema: TOutputSchema })
	& ([CONTEXT] extends [undefined] ? EmptyMap : { context: CONTEXT })
	& ([TContextSchema] extends [never] ? EmptyMap : { contextSchema: TContextSchema });

// The schemas and context a child's inline execute sees before the child config itself is inferred.
export type ChildDefinition<TParentDefinition, TInputSchema, TOutputSchema, CONTEXT, TContextSchema> =
	MergedConfig<Omit<TParentDefinition, 'execute'>, ChildDeclarations<TInputSchema, TOutputSchema, CONTEXT, TContextSchema>>;

// Without an input schema, callback annotations define input fields beyond configured context.
interface BivariantFunctionExecuteContext<T> {
	execute?(input: DeclaredInput<T>): DeclaredOutput<OutputSchemaOf<T>>;
}

// A property signature makes contextual callback returns checked even when execute takes no arguments.
// Without an input schema, annotations may declare additional input fields, so retain the bivariant input.
// Include an inferred annotation when available; comparing an optional parameter only to OpenInput loses its fields.
export type FunctionExecuteContext<T, TActual = EmptyMap> = InputSchemaOf<T> extends types.SchemaType<any>
	? { execute?: (input: DeclaredInput<T>) => DeclaredOutput<OutputSchemaOf<T>> }
	: BivariantFunctionExecuteContext<MergedConfig<T, Pick<TActual, 'execute' & keyof TActual>>>;

export interface ToolExecuteContext<T> {
	execute?: (input: DeclaredInput<T, true>, options: ToolExecutionOptions<NoInfer<ToolContextFromConfig<T>>>) => DeclaredOutput<OutputSchemaOf<T>>;
}

// A reusable fragment may become an ordinary Function or an SDK tool. Explicit callback
// annotations select one contract; the consuming factory checks that choice after merging.
type FragmentExecute<T> = {
	callback(input: DeclaredInput<T> | DeclaredInput<T, true>, options: ToolExecutionOptions<ToolContextFromConfig<T>>): DeclaredOutput<OutputSchemaOf<T>>;
}['callback'];

export type FragmentExecuteContext<T, TActual = EmptyMap,
	TResolved = MergedConfig<T, Pick<TActual, 'execute' & keyof TActual>>,
> = 'contextSchema' extends keyof T ? ToolExecuteContext<TResolved> : { execute?: FragmentExecute<TResolved> };
