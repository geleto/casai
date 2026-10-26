import {
	generateText,
} from 'ai';
import type {
	ToolSet,
	LanguageModel,
	ModelMessage,
	Tool,
	InferToolInput,
	InferToolOutput,
	JSONValue
} from 'ai';
import type { InferToolContext } from '@ai-sdk/provider-utils';
import type { ConfigureOptions } from 'cascada-engine';
import type * as types from './types.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type { ConfigCallbackKeys, TextCallbacks, CallbackConfigShape, ObjectCallbackShape } from './callbacks.js';
import type { Provisional } from './provisional.js';
import type { GenerateRequest, StreamRequest, GenerateObjectRequest, StreamObjectRequest, ComponentExecutionOptions } from './sdk.js';
export type { MergedConfig } from './merge.js';

export interface BaseConfig {
	debug?: boolean;
	description?: Tool['description'];
}

export interface ConfigProvider<T> {
	readonly config: T;
}

// Read each configuration alternative without assuming optional settings exist.
export type ConfigValue<T, K extends PropertyKey> = T extends unknown
	? K extends keyof T ? T[K] : undefined : never;

// SDK tool context of the final configuration, after parent overrides. Without a schema it is undefined.
export type ToolContextFromConfig<TConfig> = types.ContextFromSchema<ConfigValue<TConfig, 'toolContextSchema'>>;

export type ToolRegistry = Record<string, Tool | null | undefined>;
export type ResolvedTools<T> = string extends keyof T ? { [K in keyof T]: Extract<T[K], Tool> }
	: { [K in keyof T as [NonNullable<T[K]>] extends [never] ? never : K]-?: Extract<T[K], Tool> };
export type ToolsFromConfig<TConfig> = TConfig extends unknown ? 'tools' extends keyof TConfig
	? ResolvedTools<NonNullable<TConfig['tools']>> : EmptyMap : never;

export type OutputFromConfig<T> = [NonNullable<ConfigValue<T, 'output'>>] extends [never] ? types.DefaultTextOutput : NonNullable<ConfigValue<T, 'output'>> extends infer O extends types.AIOutput ? O : types.DefaultTextOutput;
// Unlike the SDK output generic, value accounts for a setting that can be absent at runtime.
export type ValueOutputFromConfig<T> = T extends unknown ? 'output' extends keyof T
	? OutputFromConfig<T> | (undefined extends T['output'] ? types.DefaultTextOutput : never)
	: types.DefaultTextOutput : never;
export type RuntimeContextFromConfig<T> = [NonNullable<ConfigValue<T, 'runtimeContext'>>] extends [never] ? Record<string, unknown> : NonNullable<ConfigValue<T, 'runtimeContext'>> extends infer C extends Record<string, unknown> ? C : Record<string, unknown>;

export type ObjectOutputFromConfig<T> = T extends { output: 'no-schema' } ? JSONValue
	: T extends { output: 'enum', enum: readonly (infer E)[] } ? E
	: T extends { output: 'array' } ? types.InferSchema<ConfigValue<T, 'schema'>>[]
	: types.InferSchema<ConfigValue<T, 'schema'>>;

export type MergedTools<TParentConfig, TConfig> = ToolsFromConfig<MergedConfig<TParentConfig, TConfig>>;

export interface ContextConfig<CONTEXT extends Record<string, any> | undefined = Record<string, any> | undefined> extends BaseConfig {
	context?: CONTEXT;
}

export interface RegistryConfig {
	tools?: ToolRegistry;
	toolsContext?: Record<string, unknown>;
}

export interface CascadaConfig<CONTEXT extends Record<string, any> | undefined = Record<string, any> | undefined> extends ContextConfig<CONTEXT> {
	filters?: types.CascadaFilters;
	renderOptions?: ConfigureOptions;
	loader?: types.CasaiAILoaders | undefined;
}

export interface LoaderConfig {
	loader: types.CasaiAILoaders;
}

// A loaded text prompt is the name of the prompt to load.
export interface NamedPromptConfig {
	prompt?: string;
}

// Only for use in Template
export interface TemplateConfig<
	INPUT extends Record<string, any>,
> extends CascadaConfig, RegistryConfig {
	template: string;
	inputSchema?: types.SchemaType<INPUT> | undefined;
	promptType?: types.TemplatePromptType;
}

// A loaded template's name can be configured or supplied at call time.
export type NamedTemplateConfig<INPUT extends Record<string, any>> = Omit<TemplateConfig<INPUT>, 'template'> & { template?: string } & LoaderConfig;

// Config for a Tool that uses the Template engine
export interface TemplateToolConfig<
	INPUT extends Record<string, any>,
	TOOL_CONTEXT = unknown,
> extends Omit<TemplateConfig<INPUT>, 'description'>, ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<INPUT, string, TOOL_CONTEXT> {
	inputSchema: types.SchemaType<INPUT>;//required
}

export type FinalTemplateConfigShape = Partial<ToolConfigShape<TemplateConfig<any> & ToolConfig<any, any, any>> & { loader?: any }>;

// Config for prompts that are rendered with templates (as part of the whole generate/stream Text/Object/Function config)
export interface TemplatePromptConfig extends CascadaConfig {
	prompt?: string;//the string containing the template, can be specified in the caller
	messages?: ModelMessage[] | undefined;
	promptType?: types.TemplatePromptType;
}

// Only for use in Script
export interface ScriptConfig<
	INPUT extends Record<string, any>,
	OUTPUT
> extends CascadaConfig, RegistryConfig {
	script?: string;
	schema?: types.SchemaType<OUTPUT>;
	inputSchema?: types.SchemaType<INPUT> | undefined;
	promptType?: types.ScriptPromptType;
};

// Config for a Tool that uses the Script engine
export interface ScriptToolConfig<
	INPUT extends Record<string, any>,
	OUTPUT,
	TOOL_CONTEXT = unknown,
> extends Omit<ScriptConfig<INPUT, OUTPUT>, 'description'>, ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<INPUT, OUTPUT, TOOL_CONTEXT> {
	inputSchema: types.SchemaType<INPUT>;//required
}

export type FinalScriptConfigShape = Partial<ToolConfigShape<ScriptToolConfig<any, any, any>> & { loader?: any }>;

export type OptionalTemplatePromptConfig = TemplatePromptConfig | { promptType: 'text' | 'text-name' };

// Config for prompts that are rendered with scripts (as part of the whole generate/stream Text/Object/Function config)
export interface ScriptPromptConfig extends CascadaConfig {
	prompt?: string;//the string containing the script, can be specified in the caller
	messages?: ModelMessage[] | undefined;
	promptType?: types.ScriptPromptType;
}

export type OptionalScriptPromptConfig = ScriptPromptConfig | { promptType: 'text' | 'text-name' };

//@todo OptionalGeneratedPromptConfig or OptionalRenderedPromptConfig
export type OptionalPromptConfig = OptionalTemplatePromptConfig | OptionalScriptPromptConfig | OptionalFunctionPromptConfig;

// Config for prompts that are rendered with functions (as part of the whole generate/stream Text/Object/Function config)
/** Reusable prompt callbacks can declare their context and returned prompt form. */
export interface FunctionPromptConfig<
	CONTEXT extends types.Context = types.Context,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
> extends ContextConfig<CONTEXT | undefined> {
	prompt: types.PromptFunction<PROMPT, CONTEXT>;
	messages?: ModelMessage[] | undefined;
	promptType?: types.FunctionPromptType;
}

export type OptionalFunctionPromptConfig = FunctionPromptConfig | { promptType: 'text' | 'text-name' };


// The default accepts schemas before inference; concrete tools default to undefined context.
export interface ToolContextSchemaConfig<TOOL_CONTEXT = unknown> { toolContextSchema?: types.SchemaType<TOOL_CONTEXT> | undefined }

// Description depends only on native context, independently of input/output tool variants.
export type ToolProperties<I = any, O = any, C = any> = Partial<Pick<Tool<I, O, C>,
	'title' | 'deferLoading' | 'providerOptions' | 'metadata' | 'strict' | 'inputExamples' | 'toModelOutput' | 'onInputStart' | 'onInputDelta' | 'onInputAvailable' | 'needsApproval'>> & { description?: Tool<unknown, unknown, C>['description'] };
export type ToolConfigShape<T> = T extends unknown ? Omit<T, keyof ToolProperties> & { [K in keyof ToolProperties]?: unknown } : never;

/** Configuration for renderer-based .asTool factories, which supply their own type and execute. */

export interface ToolConfig<INPUT extends Record<string, any>, OUTPUT, TOOL_CONTEXT = unknown> extends ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<INPUT, OUTPUT, TOOL_CONTEXT> {
	inputSchema: types.SchemaType<INPUT>;//the only required property
}

// Config types
// All of them are partials because they can be requested in pieces,
// and because doing Partial on the zod schema property makes it do deepPartial on it's properties which breaks it

// The first argument of generateText. Optional specialization preserves native callback inference.
export type GenerateTextConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
	OUTPUT extends types.AIOutput = types.AIOutput,
	RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>,
> = Omit<GenerateRequest<TOOLS, RUNTIME_CONTEXT, OUTPUT>, 'prompt' | 'messages' | 'abortSignal' | 'toolsContext' | 'tools'>
	& BaseConfig
	& { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined }; toolsContext?: import('./application.js').ToolContexts<TOOLS> }
	& { prompt?: PROMPT, messages?: ModelMessage[] | undefined, inputSchema?: types.SchemaType<INPUT> | undefined };

export type StreamTextConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
	OUTPUT extends types.AIOutput = types.AIOutput,
	RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>,
> = Omit<StreamRequest<TOOLS, RUNTIME_CONTEXT, OUTPUT>, 'prompt' | 'messages' | 'abortSignal' | 'toolsContext' | 'tools'>
	& BaseConfig
	& { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined }; toolsContext?: import('./application.js').ToolContexts<TOOLS> }
	& { prompt?: PROMPT, messages?: ModelMessage[] | undefined, inputSchema?: types.SchemaType<INPUT> | undefined };

export type FinalGenerateTextConfigShape = Partial<ConfigShape<GenerateTextConfig<any, any, any>> & { model: LanguageModel }>;

export type FinalStreamTextConfigShape = Partial<ConfigShape<StreamTextConfig<any, any, any>> & { model: LanguageModel }>;

// Factory validation shapes cover any tool set, whose context type is not yet known.
export type TextConfigShape<TConfig> = Omit<TConfig, 'toolsContext' | 'tools'> & { toolsContext?: unknown }
	& ('tools' extends keyof TConfig ? { tools?: { [K in keyof NonNullable<TConfig['tools']>]: NonNullable<TConfig['tools']>[K] | null | undefined } } : EmptyMap);

// SDK context requirements are the same for text generators and streamers.
export interface ToolsContextConfig<TOOLS extends ToolSet> { toolsContext?: import('./application.js').ToolContexts<TOOLS> }

// A run can replace implementations while preserving its tool input, output and context types.
export type TextRunConfig<TShape, TOOLS extends ToolSet, TConfig = { tools: TOOLS }, Streaming extends boolean = false> =
	Omit<TShape, 'tools' | 'toolsContext' | 'runtimeContext' | 'activeTools' | 'toolChoice' | 'toolOrder' | ConfigCallbackKeys> &
	Pick<Parameters<typeof generateText<TOOLS>>[0], 'activeTools' | 'toolChoice' | 'toolOrder'> & TextCallbacks<TConfig, TOOLS, Streaming> & {
	runtimeContext?: RuntimeContextFromConfig<TConfig>;
	tools?: { [K in keyof TOOLS]?: Tool<InferToolInput<TOOLS[K]>, InferToolOutput<TOOLS[K]>, InferToolContext<TOOLS[K]>> | TOOLS[K] };
	toolsContext?: Partial<NonNullable<ToolsContextConfig<TOOLS>['toolsContext']>>;
};

// Key validation also applies to callbacks whose argument types depend on the tool set.
export type ConfigShape<TConfig> = { [Property in keyof TConfig]?: unknown };

// Casai adds preparation/input settings and requires an explicit non-default output mode.
// All native fields, including mode-specific schemas and callbacks, come from the SDK.
type ObjectConfig<Request extends { output?: unknown }, INPUT extends Record<string, any>, PROMPT extends types.AnyPromptSource, OptionalOutput extends boolean = false> =
	Omit<Request, 'prompt' | 'messages' | 'abortSignal' | 'output'> & BaseConfig
	& { prompt?: PROMPT; messages?: ModelMessage[] | undefined; inputSchema?: types.SchemaType<INPUT> | undefined }
	& (OptionalOutput extends true ? { output?: Request['output'] | undefined } : Required<Pick<Request, 'output'>>);

export type GenerateObjectBaseConfig<
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
	RESULT = unknown,
> = Omit<ObjectConfig<GenerateObjectRequest<types.SchemaType<RESULT>, 'no-schema', RESULT>, INPUT, PROMPT>, 'output'>;

export type GenerateObjectObjectConfig<
	INPUT extends Record<string, any>, OUTPUT, PROMPT extends types.AnyPromptSource = string,
> = ObjectConfig<GenerateObjectRequest<types.SchemaType<OUTPUT>, 'object', OUTPUT>, INPUT, PROMPT, true>;

export type GenerateObjectArrayConfig<
	INPUT extends Record<string, any>, OUTPUT, PROMPT extends types.AnyPromptSource = string,
> = ObjectConfig<GenerateObjectRequest<types.SchemaType<OUTPUT>, 'array', OUTPUT[]>, INPUT, PROMPT>;

// Casai accepts readonly enum literals; the SDK invocation receives the same values.
export type GenerateObjectEnumConfig<
	INPUT extends Record<string, any>, ENUM extends string = string, PROMPT extends types.AnyPromptSource = string,
> = Omit<ObjectConfig<GenerateObjectRequest<types.SchemaType<ENUM>, 'enum', ENUM>, INPUT, PROMPT>, 'enum'>
	& { enum: Readonly<GenerateObjectRequest<types.SchemaType<ENUM>, 'enum', ENUM>['enum']> };

export type GenerateObjectNoSchemaConfig<
	INPUT extends Record<string, any>, PROMPT extends types.AnyPromptSource = string,
> = ObjectConfig<GenerateObjectRequest<types.SchemaType<JSONValue>, 'no-schema', JSONValue>, INPUT, PROMPT>;

export type GenerateObjectConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	ENUM extends string,
	PROMPT extends types.AnyPromptSource = string
> =
	GenerateObjectObjectConfig<INPUT, OUTPUT, PROMPT> |
	GenerateObjectArrayConfig<INPUT, OUTPUT, PROMPT> |
	GenerateObjectEnumConfig<INPUT, ENUM, PROMPT> |
	GenerateObjectNoSchemaConfig<INPUT, PROMPT>;

export interface FinalGenerateObjectConfigShape {
	output?: GenerateObjectConfig<any, any, any>['output'];
	schema?: types.SchemaType<any>;
	model?: LanguageModel;
	enum?: readonly string[];
}

export type StreamObjectBaseConfig<
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
	RESULT = unknown,
> = Omit<ObjectConfig<StreamObjectRequest<types.SchemaType<RESULT>, 'no-schema', RESULT>, INPUT, PROMPT>, 'output'>;

export type StreamObjectObjectConfig<
	INPUT extends Record<string, any>, OUTPUT, PROMPT extends types.AnyPromptSource = string,
> = ObjectConfig<StreamObjectRequest<types.SchemaType<OUTPUT>, 'object', OUTPUT>, INPUT, PROMPT, true>;

export type StreamObjectArrayConfig<
	INPUT extends Record<string, any>, OUTPUT, PROMPT extends types.AnyPromptSource = string,
> = ObjectConfig<StreamObjectRequest<types.SchemaType<OUTPUT>, 'array', OUTPUT[]>, INPUT, PROMPT>;

export type StreamObjectNoSchemaConfig<
	INPUT extends Record<string, any>, PROMPT extends types.AnyPromptSource = string,
> = ObjectConfig<StreamObjectRequest<types.SchemaType<JSONValue>, 'no-schema', JSONValue>, INPUT, PROMPT>;

export type StreamObjectConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends types.AnyPromptSource = string
> =
	StreamObjectObjectConfig<INPUT, OUTPUT, PROMPT> |
	StreamObjectArrayConfig<INPUT, OUTPUT, PROMPT> |
	StreamObjectNoSchemaConfig<INPUT, PROMPT>;

export interface FinalStreamObjectConfigShape {
	output?: StreamObjectConfig<any, any>['output'];
	schema?: types.SchemaType<any>;
	model?: LanguageModel;
}

// The config for Function, the execute method accepts both INPUT and context object properties
//@todo - inputSchema and schema more in line with the Vercel AI SDK - using FlexibleSchema
export interface FunctionConfig<
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends types.SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	FINAL_CONTEXT extends Record<string, any> | undefined = CONTEXT,
> extends ContextConfig<CONTEXT>, RegistryConfig {
	inputSchema?: TInputSchema;
	schema?: TOutputSchema;
	execute: types.FunctionImplementation<
		TInputSchema, TOutputSchema, FINAL_CONTEXT,
		(input: types.InferSchema<TInputSchema, Record<string, any>> & (FINAL_CONTEXT extends undefined ? unknown : FINAL_CONTEXT))
			=> types.InferSchema<TOutputSchema>>;
}
// The config for Function.asTool, the execute method accepts both INPUT and context object properties
export interface FunctionToolConfig<
	TInputSchema extends types.SchemaType<Record<string, any>>, // required for tools
	TOutputSchema extends types.SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	FINAL_CONTEXT extends Record<string, any> | undefined = CONTEXT,
	TOOL_CONTEXT = undefined,
> extends Omit<ContextConfig<CONTEXT>, 'description'>, RegistryConfig, ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<types.InferSchema<TInputSchema>, import('./application.js').CollectedResult<{ schema: TOutputSchema }>, TOOL_CONTEXT> {
	inputSchema: TInputSchema;
	schema?: TOutputSchema;
	execute: types.FunctionToolImplementation<
		TInputSchema, TOutputSchema, FINAL_CONTEXT,
		(input: types.InferSchema<TInputSchema, Record<string, any>> & (FINAL_CONTEXT extends undefined ? unknown : FINAL_CONTEXT))
			=> types.InferSchema<TOutputSchema>, TOOL_CONTEXT>;
}

// Shared configuration fields used by the LLM run() implementation.
export type LLMRunConfig = Partial<BaseConfig> & Pick<ComponentExecutionOptions, 'abortSignal'> & {
	messages?: ModelMessage[] | undefined;
	prompt?: types.AnyPromptSource;
	context?: types.Context;
};

// For the .run argument - disallow all properties that ...
export const fixedRunSettings = [
	'schema', 'output', 'enum',
	'inputSchema', 'toolContextSchema', 'promptType',
	'filters', 'renderOptions', 'loader',
] as const;
export type RunConfigDisallowedProperties = typeof fixedRunSettings[number];

// The supported configuration families. This is the value contract; factory
// inference shapes below defer fields whose types depend on the final config.
export type AnyConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	ENUM extends string = string,
	PROMPT extends types.AnyPromptSource = types.AnyPromptSource
> =
	((// LLM Configs with template prompt
		| GenerateTextConfig<TOOLS, INPUT, PROMPT>
		| StreamTextConfig<TOOLS, INPUT, PROMPT>
		| GenerateObjectObjectConfig<INPUT, OUTPUT, PROMPT>
		| GenerateObjectArrayConfig<INPUT, OUTPUT, PROMPT>
		| GenerateObjectEnumConfig<INPUT, ENUM, PROMPT>
		| GenerateObjectNoSchemaConfig<INPUT, PROMPT>
		| StreamObjectObjectConfig<INPUT, OUTPUT, PROMPT>
		| StreamObjectArrayConfig<INPUT, OUTPUT, PROMPT>
		| StreamObjectNoSchemaConfig<INPUT, PROMPT>
	) & Partial<Omit<ToolConfig<INPUT, OUTPUT>, 'inputSchema'>> &
		(
			Pick<CascadaConfig, 'loader'> & (TemplatePromptConfig | ScriptPromptConfig | FunctionPromptConfig | { prompt?: PROMPT, promptType?: 'text' | 'text-name' })
		)
	) |
	((// Template/Script Engine Configs
		| TemplateConfig<INPUT>
		| TemplateToolConfig<INPUT>
		| ScriptToolConfig<INPUT, OUTPUT>
		| ScriptConfig<INPUT, OUTPUT>
	) & Pick<CascadaConfig, 'loader'>)
	| FunctionConfigShape;

// Function settings admitted by AnyConfig. Schema-dependent callbacks are checked separately.
export type FunctionConfigShape = Omit<FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any> | undefined,
	Record<string, any> | undefined, Record<string, any> | undefined, any>, 'inputSchema' | 'execute' | keyof ToolProperties>
	& { inputSchema: types.SchemaType<Record<string, any>> | undefined; execute?: unknown }
	& { [K in keyof ToolProperties]?: unknown };

// Infer the tool map independently, then validate its context with a useful diagnostic.
export type AnyConfigShape<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT, ENUM extends string,
	TShape = AnyConfig<TOOLS, INPUT, OUTPUT, ENUM>> = TShape extends unknown
	? 'toolsContext' extends keyof TShape ? TextConfigShape<TShape> : TShape
	: never;

// Factory shapes are inference constraints, not configuration annotations.
// Infer settings first, then specialize callbacks through the factory's input
// and validate the resolved config. Provisional only marks that first pass.
export type TextConfigInferShape<Config> = Provisional<CallbackConfigShape<Config>>;
export type ObjectConfigInferShape<Config> = Provisional<ObjectCallbackShape<Config>>;
export type ToolConfigInferShape<Config> = Provisional<ToolConfigShape<Config>>;

// Parents may supply incomplete settings. Their already-inferred data needs no
// provisional marker; only dependent callbacks/context are checked later.
export type ParentTextConfigInferShape<Config> = CallbackConfigShape<Partial<TextConfigShape<Config>>>;
export type ParentObjectConfigInferShape<Config> = ObjectCallbackShape<Partial<Config>>;

// A reusable fragment can belong to any family and may omit required settings.
// Keep its complete inference policy here rather than rebuilding it in overloads.
export type AnyConfigInferShape<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT, ENUM extends string> =
	Provisional<CallbackConfigShape<ToolConfigShape<Partial<AnyConfigShape<TOOLS, INPUT, OUTPUT, ENUM>>>>>;
