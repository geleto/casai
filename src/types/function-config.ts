import type { ToolExecutionOptions } from 'ai';
import type { EmptyMap, MergedConfig } from './merge.js';
import type * as types from './types.js';
import type * as configs from './config.js';
import type { DeclaredType, ToolContextFromConfig } from './config.js';

type PropertyType<T, K extends PropertyKey> = K extends keyof T ? T[K] : undefined;

// Configured context is a runtime value, so context that may be absent has optional fields.
type ConfiguredContext<CONTEXT> = [NonNullable<CONTEXT>] extends [never] ? undefined
	: undefined extends CONTEXT ? Partial<NonNullable<CONTEXT>> : CONTEXT;

export type InputSchemaOf<T> = Extract<DeclaredType<T, 'inputSchema'>, types.SchemaType<Record<string, any>> | undefined>;
export type ToolInputSchemaOf<T> = Extract<InputSchemaOf<T>, types.SchemaType<Record<string, any>>>;
export type OutputSchemaOf<T> = Extract<DeclaredType<T, 'schema'>, types.SchemaType<any> | undefined>;
export type ContextOf<T> = Extract<ConfiguredContext<PropertyType<T, 'context'>>, Record<string, any> | undefined>;
export type ExecuteOf<T> = Extract<PropertyType<T, 'execute'>, (...args: any) => any>;

// A parent's optional schema keys state its contract, so they merge as present.
type DeclaredKeys = 'schema' | 'contextSchema';
export type DeclaredConfig<T> = Omit<T, DeclaredKeys> & { [K in DeclaredKeys & keyof T]: DeclaredType<T, K> };

type OpenInput = Record<string, any>;
type ContextInput<CONTEXT> = CONTEXT extends undefined ? unknown : CONTEXT;
type ContextKeys<T> = [NonNullable<ContextOf<T>>] extends [never] ? never : keyof NonNullable<ContextOf<T>>;

// Without an input schema, execute's own parameter defines the input; an untyped one leaves it open.
type ExecuteInput<T> = ExecuteOf<T> extends (input: infer INPUT, ...args: any) => any
	? unknown extends INPUT ? OpenInput : INPUT
	: OpenInput;

type SchemaInput<TInputSchema, T> = TInputSchema extends types.SchemaType<any>
	? types.InferSchema<TInputSchema>
	: Omit<ExecuteInput<T>, ContextKeys<T>>;

// What execute receives: the schema input or, without a schema, the input execute declares, plus configured context.
export type DeclaredInput<T> = SchemaInput<InputSchemaOf<T>, T> & ContextInput<ContextOf<T>>;

// What callers pass: the schema input or, without a schema, what execute needs; configured fields become optional.
type SchemaCallInput<TInputSchema, T> = TInputSchema extends types.SchemaType<any>
	? types.InferSchema<TInputSchema>
	: Omit<ExecuteInput<T>, ContextKeys<T>> & Partial<Pick<ExecuteInput<T>, ContextKeys<T> & keyof ExecuteInput<T>>>;
export type CallInput<T> = SchemaCallInput<InputSchemaOf<T>, T>;

type DeclaredOutput<TOutputSchema> = TOutputSchema extends types.SchemaType<any>
	? PromiseLike<types.InferSchema<TOutputSchema, any>> | types.InferSchema<TOutputSchema, any>
	: unknown;

// The execute a config defines through its declared schemas and context.
export type DeclaredExecute<T> = (
	input: DeclaredInput<T>,
	options: ToolExecutionOptions<NoInfer<ToolContextFromConfig<T>>>,
) => DeclaredOutput<OutputSchemaOf<T>>;

export type DeclaredFunctionExecute<T> = (input: DeclaredInput<T>) => DeclaredOutput<OutputSchemaOf<T>>;

// The contract each final config defines. A schema fixes execute's input and output; without one, execute defines them.
export type ExpectedFunctionConfig<T> = Omit<configs.FunctionConfig<InputSchemaOf<T>, OutputSchemaOf<T>, ContextOf<T>>, 'execute'>
	& { execute: DeclaredFunctionExecute<T> };
export type ExpectedToolConfig<T> = Omit<configs.FunctionToolConfig<ToolInputSchemaOf<T>, OutputSchemaOf<T>, ContextOf<T>, ContextOf<T>, ToolContextFromConfig<T>>, 'execute'>
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

// Contextual types for an inline execute. Method parameters are checked bivariantly, so an annotated
// callback is checked once, against the whole final config.
export interface FunctionExecuteContext<T> {
	execute?(input: DeclaredInput<T>): DeclaredOutput<OutputSchemaOf<T>>;
}

export interface ToolExecuteContext<T> {
	execute?(input: DeclaredInput<T>, options: ToolExecutionOptions<NoInfer<ToolContextFromConfig<T>>>): DeclaredOutput<OutputSchemaOf<T>>;
}
