import type { ContextFromSchema, InferSchema, SchemaType } from './schema.js';
import type { EmptyMap, Fields } from './utils.js';
import type { LoaderInput } from '../loaders.js';
import type { TemplatePromptType, ScriptPromptType } from './prompt.js';
import type { FunctionImplementation, FunctionToolImplementation } from './function-config.js';
import type { Tool, ToolSet } from 'ai';
import type { ConfigureOptions } from 'cascada-engine';
import type { CallbackConfigShape } from './callbacks.js';
import type { Provisional } from './provisional.js';

export interface BaseConfig {
	debug?: boolean;
	description?: Tool['description'];
}

export interface ModifierConfig { asTool?: true | undefined }

export interface ConfigProvider<T> {
	readonly config: T;
}

// Read each configuration alternative without assuming optional settings exist.
export type ConfigValue<T, K extends PropertyKey> = T extends unknown
	? K extends keyof T ? T[K] : undefined : never;

// SDK tool context of the final configuration, after parent overrides. Without a schema it is undefined.
export type ToolContextFromConfig<TConfig> = ContextFromSchema<ConfigValue<TConfig, 'toolContextSchema'>>;

export type ToolRegistry = { [K in keyof ToolSet]: ToolSet[K] | null | undefined };
type ResolvedTools<T> = { [K in keyof T as [NonNullable<T[K]>] extends [never] ? never : K]-?: Extract<T[K], ToolSet[string]> };
export type ToolsFromConfig<TConfig> = TConfig extends unknown ? 'tools' extends keyof TConfig
	? ResolvedTools<NonNullable<TConfig['tools']>> : EmptyMap : never;

export type RuntimeContextFromConfig<T> = [NonNullable<ConfigValue<T, 'runtimeContext'>>] extends [never] ? Record<string, unknown> : NonNullable<ConfigValue<T, 'runtimeContext'>> extends infer C extends Record<string, unknown> ? C : Record<string, unknown>;

// Resolved configuration values shared by caller, execution and binding types.
export type PossibleExecutableToolNames<TTools extends ToolRegistry> = TTools extends unknown ? { [K in keyof TTools]-?: NonNullable<TTools[K]> extends { execute?: infer TExecute }
	? Extract<TExecute, (...args: any[]) => any> extends never ? never : K : never }[keyof TTools] : never;

// A helper is guaranteed only when every possible registry entry has an executor.
export type ExecutableToolNames<TTools extends ToolRegistry, Keys extends keyof TTools = keyof TTools> = { [K in Keys]-?: [TTools[K]] extends [{ execute: (...args: any[]) => any }] ? K : never }[Keys];

export type ConfiguredToolNames<TTools extends ToolRegistry> = TTools extends unknown ? { [K in keyof TTools]-?: [NonNullable<TTools[K]>] extends [never] ? never : K }[keyof TTools] : never;

// Discover context across configurations, then make its fields optional if any branch lacks it.
export type ContextFromConfig<TConfig, TContext = TConfig extends unknown ? 'context' extends keyof TConfig ? TConfig['context'] : undefined : never> =
	[NonNullable<TContext>] extends [never] ? EmptyMap : NonNullable<TContext> extends object
		? undefined extends TContext ? Partial<NonNullable<TContext>> : NonNullable<TContext> : EmptyMap;

// Preserve authored null/undefined entries here; ToolsFromConfig describes resolved SDK tools.
export type ToolRegistryFromConfig<TConfig> = Extract<ContextFromConfig<TConfig, ConfigValue<TConfig, 'tools'>>, ToolRegistry>;

export type ToolsContextFromConfig<TConfig> = ContextFromConfig<TConfig, ConfigValue<TConfig, 'toolsContext'>>;

export type InputSchemaFromConfig<TConfig> = ConfigValue<TConfig, 'inputSchema'>;

// A selected parser must accept the call whichever alternative is selected.
// Keep a native union schema intact: it is one parser accepting either branch.
type InputSchemaAlternatives<TConfig, TInputSchema = Exclude<InputSchemaFromConfig<TConfig>, undefined>> = [TInputSchema] extends [never] ? { config: TConfig; schema: undefined }
	: TInputSchema extends unknown ? { config: TConfig; schema: TInputSchema | Extract<InputSchemaFromConfig<TConfig>, undefined> } : never;

export type InputConfigAlternatives<TConfig> = TConfig extends unknown ? InputSchemaAlternatives<TConfig> : never;

export type CallbackFromConfig<T> = T extends unknown ? Extract<T[keyof T & import('./component.js').Main<import('./component.js').ComponentKind>], (...args: any[]) => any> : never;
export type CallbackContextFromConfig<T> = T extends unknown
	? CallbackFromConfig<T> extends (context: infer Input, ...args: any[]) => any ? unknown extends Input ? Fields : NonNullable<Input> : Fields : never;

interface ContextConfig<CONTEXT extends Record<string, any> | undefined = Record<string, any> | undefined> extends BaseConfig {
	context?: CONTEXT;
}

interface RegistryConfig {
	tools?: ToolRegistry | undefined;
	toolsContext?: Record<string, unknown> | undefined;
}

export interface CascadaConfig<CONTEXT extends Record<string, any> | undefined = Record<string, any> | undefined> extends ContextConfig<CONTEXT> {
	filters?: Record<string, (input: any, ...args: any[]) => any>;
	renderOptions?: ConfigureOptions;
	loader?: LoaderInput | undefined;
}

export interface LoaderConfig {
	loader: LoaderInput;
}

// Only for use in Template
export interface TemplateConfig<
	INPUT extends Record<string, any>,
> extends CascadaConfig, RegistryConfig {
	template: string;
	inputSchema?: SchemaType<INPUT> | undefined;
	promptType?: TemplatePromptType;
}

// Config for a Tool that uses the Template engine
export interface TemplateToolConfig<
	INPUT extends Record<string, any>,
	TOOL_CONTEXT = unknown,
> extends ModifierConfig, Omit<TemplateConfig<INPUT>, 'description'>, ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<INPUT, string, TOOL_CONTEXT> {
	inputSchema: SchemaType<INPUT>;//required
}

// Only for use in Script
export interface ScriptConfig<
	INPUT extends Record<string, any>,
	OUTPUT
> extends CascadaConfig, RegistryConfig {
	script?: string;
	schema?: SchemaType<OUTPUT> | undefined;
	inputSchema?: SchemaType<INPUT> | undefined;
	promptType?: ScriptPromptType;
};

// Config for a Tool that uses the Script engine
export interface ScriptToolConfig<
	INPUT extends Record<string, any>,
	OUTPUT,
	TOOL_CONTEXT = unknown,
> extends ModifierConfig, Omit<ScriptConfig<INPUT, OUTPUT>, 'description'>, ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<INPUT, OUTPUT, TOOL_CONTEXT> {
	inputSchema: SchemaType<INPUT>;//required
}

// The default accepts schemas before inference; concrete tools default to undefined context.
export interface ToolContextSchemaConfig<TOOL_CONTEXT = unknown> { toolContextSchema?: SchemaType<TOOL_CONTEXT> | undefined }

// Description depends only on native context, independently of input/output tool variants.
export type ToolProperties<I = any, O = any, C = any> = Partial<Pick<Tool<I, O, C>,
	'title' | 'deferLoading' | 'providerOptions' | 'metadata' | 'strict' | 'inputExamples' | 'toModelOutput' | 'onInputStart' | 'onInputDelta' | 'onInputAvailable' | 'needsApproval'>> & { description?: Tool<unknown, unknown, C>['description'] };
export type ToolConfigShape<T> = T extends unknown ? Omit<T, keyof ToolProperties> & { [K in keyof ToolProperties]?: unknown } & ModifierConfig : never;

/** Configuration for renderer-based .asTool factories, which supply their own type and execute. */

export interface ToolConfig<INPUT extends Record<string, any>, OUTPUT, TOOL_CONTEXT = unknown> extends ModifierConfig, ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<INPUT, OUTPUT, TOOL_CONTEXT> {
	inputSchema: SchemaType<INPUT>;//the only required property
}

// Function bodies receive parsed input and configured context.
export interface FunctionConfig<
	TInputSchema extends SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	FINAL_CONTEXT extends Record<string, any> | undefined = CONTEXT,
> extends ContextConfig<CONTEXT>, RegistryConfig {
	inputSchema?: TInputSchema;
	schema?: TOutputSchema;
	execute: FunctionImplementation<
		TInputSchema, TOutputSchema, FINAL_CONTEXT,
		(input: InferSchema<TInputSchema, Record<string, any>> & (FINAL_CONTEXT extends undefined ? unknown : FINAL_CONTEXT))
			=> InferSchema<TOutputSchema>>;
}
// The config for Function.asTool, the execute method accepts both INPUT and context object properties
export interface FunctionToolConfig<
	TInputSchema extends SchemaType<Record<string, any>>, // required for tools
	TOutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	FINAL_CONTEXT extends Record<string, any> | undefined = CONTEXT,
	TOOL_CONTEXT = undefined,
> extends ModifierConfig, Omit<ContextConfig<CONTEXT>, 'description'>, RegistryConfig, ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<InferSchema<TInputSchema>, import('./result.js').CollectedResult<{ schema: TOutputSchema }>, TOOL_CONTEXT> {
	inputSchema: TInputSchema;
	schema?: TOutputSchema;
	execute: FunctionToolImplementation<
		TInputSchema, TOutputSchema, FINAL_CONTEXT,
		(input: InferSchema<TInputSchema, Record<string, any>> & (FINAL_CONTEXT extends undefined ? unknown : FINAL_CONTEXT))
			=> InferSchema<TOutputSchema>, TOOL_CONTEXT>;
}

// Every component contributes its own configuration shape to reusable fragments.
export type AnyConfig<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT> =
	import('./component-map.js').ConfigShapes<TOOLS, INPUT, OUTPUT>[import('./component.js').ComponentKind];

// Function settings admitted by AnyConfig. Schema-dependent callbacks are checked separately.
export type FunctionConfigShape = Omit<FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any> | undefined,
	Record<string, any> | undefined, Record<string, any> | undefined, any>, 'inputSchema' | 'execute' | keyof ToolProperties>
	& { inputSchema: SchemaType<Record<string, any>> | undefined; execute?: unknown }
	& { [K in keyof ToolProperties]?: unknown };

// Inference shapes defer schema-dependent callbacks until the complete config is known.
export type ConfigShape<T> = { [K in keyof T]?: unknown };
export type AnyConfigShape<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT,
	T = AnyConfig<TOOLS, INPUT, OUTPUT>> = T extends unknown ? Omit<T, 'toolsContext'> & { toolsContext?: unknown } : never;
export type ToolConfigInferShape<T> = Provisional<ParentToolConfigInferShape<T>>;
export type ParentToolConfigInferShape<T> = ToolConfigShape<Partial<T>>;
export type AnyConfigInferShape<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT> =
	Provisional<import('./factory-config.js').ConfigSourceInferShape<CallbackConfigShape<ToolConfigShape<Partial<AnyConfigShape<TOOLS, INPUT, OUTPUT>>>>>>;
