import type { EmptyMap, DistributiveOmit, Fields, NamedKeys } from './utils.js';
import type { CallbackContextFromConfig, ConfigValue, ContextFromConfig, InputConfigAlternatives, PossibleExecutableToolNames, ToolRegistry, ToolRegistryFromConfig, ToolsContextFromConfig } from './config.js';
import type { MergedProperties } from './merge.js';
import type { ParsedSchemaOutput, SchemaInputNames, SchemaInputObject, SchemaOutputObject } from './schema-shape.js';
import type { BoundContextDefaults, InjectedToolHelpers } from './tool-binding.js';
import type { ComponentExecutionOptions } from './sdk.js';
import type { FlexibleSchema, ToolSet } from 'ai';
/** The configuration fields consumed by the shared execution pipeline. */
export interface ExecutionConfig {
	context?: Fields;
	inputSchema?: FlexibleSchema<unknown>;
	toolContextSchema?: FlexibleSchema<unknown>;
	tools?: ToolRegistry;
	toolsContext?: Fields;
}

/** Parsed application values, trusted bindings and invocation metadata. */
export interface PreparedExecutionContext extends Fields {
	_toolOptions: ComponentExecutionOptions;
}

export interface PreparedToolRegistry {
	tools: ToolSet;
	toolsContext: Fields;
	helpers(options: ComponentExecutionOptions): Fields;
	assertContext(value: unknown): void;
}

// Accepted public data cannot replace private fields, including through an open index signature.
type ParsedExecutionContext<TInputSchema, TDefaults, TTools extends ToolRegistry, TContexts = EmptyMap> = DistributiveOmit<MergedProperties<SchemaOutputObject<TInputSchema>, DistributiveOmit<TDefaults, SchemaInputNames<TInputSchema>>>, '_toolOptions' | Extract<PossibleExecutableToolNames<TTools>, NamedKeys<TTools>>>
	& (string extends keyof TTools ? EmptyMap : InjectedToolHelpers<TInputSchema, TDefaults, TTools, TContexts>) & { _toolOptions: ComponentExecutionOptions };

// Rebuild injected fields from the final config. Intersecting them with a
// retained callback's old helper signatures would restore obsolete overloads.
// A dependency missing in one configuration is readable as undefined, without
// mixing the values of the configurations where it is present.
type ExecutionDefaults<TConfig, TAllConfigs> = ContextFromConfig<TConfig> & Partial<Record<Exclude<NamedKeys<ContextFromConfig<TAllConfigs>>, NamedKeys<ContextFromConfig<TConfig>>>, never>>;

// Ordinary bodies receive parsed public values, configured private bindings and tool helpers.
export type ExecutionContext<TConfig, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema }
	? BranchExecutionContext<TAlternative, TInputSchema, ExecutionDefaults<TAlternative, TConfig>> : never;

type BranchExecutionContext<TConfig, TInputSchema, TDefaults> = [Exclude<TInputSchema, undefined>] extends [never]
	? DistributiveOmit<CallbackContextFromConfig<TConfig>, '_toolOptions' | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>>> & DistributiveOmit<TDefaults, '_toolOptions' | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>>>
		& InjectedToolHelpers<undefined, TDefaults, ToolRegistryFromConfig<TConfig>, ToolsContextFromConfig<TConfig>> & { _toolOptions: ComponentExecutionOptions }
	: ParsedExecutionContext<Exclude<TInputSchema, undefined>, TDefaults, ToolRegistryFromConfig<TConfig>, ToolsContextFromConfig<TConfig>>
		| (undefined extends TInputSchema
			? DistributiveOmit<MergedProperties<SchemaInputObject<Exclude<TInputSchema, undefined>>, TDefaults>, '_toolOptions' | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>>>
				& InjectedToolHelpers<undefined, TDefaults, ToolRegistryFromConfig<TConfig>, ToolsContextFromConfig<TConfig>> & { _toolOptions: ComponentExecutionOptions }
			: never);

export type BoundExecutionContext<TConfig, TRawContext = undefined, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema }
	? ParsedExecutionContext<TInputSchema, BoundContextDefaults<ExecutionDefaults<TAlternative, TConfig>, ConfigValue<TAlternative, 'toolContextSchema'>, TRawContext>, ToolRegistryFromConfig<TAlternative>, ToolsContextFromConfig<TAlternative>> : never;

// Tool context is absent on ordinary calls. Preserve that absence even when an
// empty parsed object contributes a never index signature to the context union.
type OrdinaryToolContext<TConfig, TContext = ExecutionContext<TConfig>> = TContext extends unknown ? TContext & {
	[P in NamedKeys<ParsedSchemaOutput<ConfigValue<TConfig, 'toolContextSchema'>>> as P extends keyof TContext ? [TContext[P]] extends [never] ? P : never : never]?: never;
} : never;

export type ToolExecutionContext<TConfig> = OrdinaryToolContext<TConfig> | BoundExecutionContext<TConfig>;
