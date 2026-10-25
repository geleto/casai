import type { ApplicationShape, CollectedResult, ExecutionContext, ToolExecutionContext } from './application.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type * as types from './types.js';
import type * as configs from './config.js';
import type { DeclaredType, ToolContextFromConfig } from './config.js';
import type { ResolvedConfig } from './provisional.js';

// Specialize required/optional inference before checking a call. An optional
// inference slot alone removes explicit undefined from conditional schemas.
// Factories intersect specializations so each generic signature is defined once.
export type InputSchemaSetting<S, Required extends boolean> = Required extends true
	? { inputSchema: S } : { inputSchema?: S };

// Optional properties in annotated configs declare a schema contract. A present
// property whose value can be undefined still describes a conditional schema.
export type DeclaredSchemaValue<A, K extends PropertyKey, S, D = ResolvedConfig<A>> =
	K extends keyof D ? EmptyMap extends Pick<D, K>
		? [NonNullable<S>] extends [never] ? undefined : NonNullable<S> : S : S;

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
// Normalize each alternative separately; Omit on the union would erase branch-only settings.
type DeclaredKeys = 'schema' | 'toolContextSchema';
export type DeclaredConfig<T> = T extends unknown ? Omit<T, DeclaredKeys> & { [K in DeclaredKeys & keyof T]: DeclaredType<T, K> } : never;

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
export type ExpectedToolConfig<T> = Omit<configs.FunctionToolConfig<ToolInputSchemaOf<T>, OutputSchemaOf<T>, ConfiguredContextOf<T>, ContextOf<T>, ToolContextFromConfig<T>>, 'execute'>
	& { execute: DeclaredExecute<T> };

// The properties a child sets through its separately inferred schema and context generics.
type ChildDeclarations<TInputSchema, TOutputSchema, CONTEXT, TContextSchema> =
	& ([TInputSchema] extends [never] ? EmptyMap : { inputSchema: TInputSchema })
	& ([TOutputSchema] extends [never] ? EmptyMap : { schema: TOutputSchema })
	& ([CONTEXT] extends [undefined] ? EmptyMap : { context: CONTEXT })
	& ([TContextSchema] extends [never] ? EmptyMap : { toolContextSchema: TContextSchema });

// The schemas and context a child's inline execute sees before the child config itself is inferred.
export type ChildDefinition<TParentDefinition, TInputSchema, TOutputSchema, CONTEXT, TContextSchema, Actual = EmptyMap> =
	TParentDefinition extends unknown ? MergedConfig<Omit<TParentDefinition, 'execute'>, ChildDeclarations<
		DeclaredSchemaValue<Actual, 'inputSchema', TInputSchema>,
		DeclaredSchemaValue<Actual, 'schema', TOutputSchema>, CONTEXT,
		DeclaredSchemaValue<Actual, 'toolContextSchema', TContextSchema>>> : never;

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

export type ToolExecuteContext<T> = {
	execute?: (input: DeclaredInput<T, true>) => DeclaredOutput<OutputSchemaOf<T>>;
} & configs.ToolProperties<types.InferSchema<InputSchemaOf<T>>, CollectedResult<T>, ToolContextFromConfig<T>>;

// A reusable fragment may become an ordinary Function or an SDK tool. Explicit callback
// annotations select one contract; the consuming factory checks that choice after merging.
type FragmentExecute<T> = {
	callback(input: DeclaredInput<T> | DeclaredInput<T, true>): DeclaredOutput<OutputSchemaOf<T>>;
}['callback'];

export type FragmentExecuteContext<T, TActual = EmptyMap,
	TResolved = MergedConfig<T, Pick<TActual, 'execute' & keyof TActual>>,
> = 'toolContextSchema' extends keyof T ? ToolExecuteContext<TResolved> : { execute?: FragmentExecute<TResolved> } & Pick<configs.ToolProperties<any, any, ToolContextFromConfig<TResolved>>, 'description'>;
