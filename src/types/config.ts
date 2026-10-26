import type { ContextFromSchema, InferSchema, SchemaType } from './schema.js';
import type { EmptyMap, Context, Fields } from './utils.js';
import type { DefaultTextOutput, AIOutput, GenerateRequest, StreamRequest, GenerateObjectRequest, StreamObjectRequest, ObjectOutputSettingKeys } from './sdk.js';
import type { CascadaFilters } from './cascada.js';
import type { CasaiAILoaders } from '../loaders.js';
import type { TemplatePromptType, ScriptPromptType, TextPromptType, PromptValue, PromptFunction, FunctionPromptType, AnyPromptSource } from './prompt.js';
import type { FunctionImplementation, FunctionToolImplementation } from './function-config.js';
import type { generateText, Tool, ToolSet, LanguageModel, ModelMessage, InferToolInput, InferToolOutput, JSONValue } from 'ai';
import type { InferToolContext } from '@ai-sdk/provider-utils';
import type { ConfigureOptions } from 'cascada-engine';
import type { ConfigCallbackKeys, TextCallbacks, CallbackConfigShape, ObjectCallbackShape } from './callbacks.js';
import type { Provisional } from './provisional.js';

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
export type ToolContextFromConfig<TConfig> = ContextFromSchema<ConfigValue<TConfig, 'toolContextSchema'>>;

export type ToolRegistry = Record<string, Tool | null | undefined>;
// Authoring entries can remove an inherited tool with null or undefined.
type ConfiguredTools<TOOLS extends ToolSet> = { [K in keyof TOOLS]: TOOLS[K] | null | undefined };
type ResolvedTools<T> = string extends keyof T ? { [K in keyof T]: Extract<T[K], Tool> }
	: { [K in keyof T as [NonNullable<T[K]>] extends [never] ? never : K]-?: Extract<T[K], Tool> };
export type ToolsFromConfig<TConfig> = TConfig extends unknown ? 'tools' extends keyof TConfig
	? ResolvedTools<NonNullable<TConfig['tools']>> : EmptyMap : never;

export type OutputFromConfig<T> = [NonNullable<ConfigValue<T, 'output'>>] extends [never] ? DefaultTextOutput : NonNullable<ConfigValue<T, 'output'>> extends infer O extends AIOutput ? O : DefaultTextOutput;
// Unlike the SDK output generic, value accounts for a setting that can be absent at runtime.
export type ValueOutputFromConfig<T> = T extends unknown ? 'output' extends keyof T
	? OutputFromConfig<T> | (undefined extends T['output'] ? DefaultTextOutput : never)
	: DefaultTextOutput : never;
export type RuntimeContextFromConfig<T> = [NonNullable<ConfigValue<T, 'runtimeContext'>>] extends [never] ? Record<string, unknown> : NonNullable<ConfigValue<T, 'runtimeContext'>> extends infer C extends Record<string, unknown> ? C : Record<string, unknown>;

export type ObjectOutputFromConfig<T> = T extends { output: 'no-schema' } ? JSONValue
	: T extends { output: 'enum', enum: readonly (infer E)[] } ? E
	: T extends { output: 'array' } ? InferSchema<ConfigValue<T, 'schema'>>[]
	: InferSchema<ConfigValue<T, 'schema'>>;

// Resolved configuration values shared by caller, execution and binding types.
export type PossibleExecutableToolNames<TTools extends ToolRegistry> = { [K in keyof TTools]-?: NonNullable<TTools[K]> extends { execute?: infer TExecute }
	? Extract<TExecute, (...args: any[]) => any> extends never ? never : K : never }[keyof TTools];

export type ExecutableToolNames<TTools extends ToolRegistry> = { [K in keyof TTools]-?: [TTools[K]] extends [{ execute: (...args: any[]) => any }] ? K : never }[keyof TTools];

export type ConfiguredToolNames<TTools extends ToolRegistry> = { [K in keyof TTools]-?: Extract<TTools[K], Tool> extends never ? never : K }[keyof TTools];

// Discover context across configurations, then make its fields optional if any branch lacks it.
export type ContextFromConfig<TConfig, TContext = TConfig extends unknown ? 'context' extends keyof TConfig ? TConfig['context'] : undefined : never> =
	[NonNullable<TContext>] extends [never] ? EmptyMap : NonNullable<TContext> extends object
		? undefined extends TContext ? Partial<NonNullable<TContext>> : NonNullable<TContext> : EmptyMap;

// Preserve authored null/undefined entries here; ToolsFromConfig describes resolved SDK tools.
export type ToolRegistryFromConfig<TConfig> = [Extract<NonNullable<ConfigValue<TConfig, 'tools'>>, ToolRegistry>] extends [never] ? EmptyMap : Extract<NonNullable<ConfigValue<TConfig, 'tools'>>, ToolRegistry>;

export type ToolsContextFromConfig<TConfig> = [NonNullable<ConfigValue<TConfig, 'toolsContext'>>] extends [never] ? EmptyMap : NonNullable<ConfigValue<TConfig, 'toolsContext'>>;

export type InputSchemaFromConfig<TConfig> = ConfigValue<TConfig, 'inputSchema'>;

// A selected parser must accept the call whichever alternative is selected.
// Keep a native union schema intact: it is one parser accepting either branch.
type InputSchemaAlternatives<TConfig, TInputSchema = Exclude<InputSchemaFromConfig<TConfig>, undefined>> = [TInputSchema] extends [never] ? { config: TConfig; schema: undefined }
	: TInputSchema extends unknown ? { config: TConfig; schema: TInputSchema | Extract<InputSchemaFromConfig<TConfig>, undefined> } : never;

export type InputConfigAlternatives<TConfig> = TConfig extends unknown ? InputSchemaAlternatives<TConfig> : never;

export type CallbackContextFromConfig<TConfig> = TConfig extends { execute: (context: infer TContextInput, ...args: any[]) => any } | { prompt: (context: infer TContextInput, ...args: any[]) => any }
	? unknown extends TContextInput ? Fields : NonNullable<TContextInput> : Fields;

interface ContextConfig<CONTEXT extends Record<string, any> | undefined = Record<string, any> | undefined> extends BaseConfig {
	context?: CONTEXT;
}

interface RegistryConfig {
	tools?: ToolRegistry;
	toolsContext?: Record<string, unknown>;
}

export interface CascadaConfig<CONTEXT extends Record<string, any> | undefined = Record<string, any> | undefined> extends ContextConfig<CONTEXT> {
	filters?: CascadaFilters;
	renderOptions?: ConfigureOptions;
	loader?: CasaiAILoaders | undefined;
}

export interface LoaderConfig {
	loader: CasaiAILoaders;
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
> extends Omit<TemplateConfig<INPUT>, 'description'>, ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<INPUT, string, TOOL_CONTEXT> {
	inputSchema: SchemaType<INPUT>;//required
}

// Config for prompts that are rendered with templates (as part of the whole generate/stream Text/Object/Function config)
export interface TemplatePromptConfig extends CascadaConfig {
	prompt?: string;//the string containing the template, can be specified in the caller
	messages?: ModelMessage[] | undefined;
	promptType?: TemplatePromptType;
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
> extends Omit<ScriptConfig<INPUT, OUTPUT>, 'description'>, ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<INPUT, OUTPUT, TOOL_CONTEXT> {
	inputSchema: SchemaType<INPUT>;//required
}

type OptionalTemplatePromptConfig = TemplatePromptConfig | { promptType: TextPromptType };

// Config for prompts that are rendered with scripts (as part of the whole generate/stream Text/Object/Function config)
export interface ScriptPromptConfig extends CascadaConfig {
	prompt?: string;//the string containing the script, can be specified in the caller
	messages?: ModelMessage[] | undefined;
	promptType?: ScriptPromptType;
}

type OptionalScriptPromptConfig = ScriptPromptConfig | { promptType: TextPromptType };

//@todo OptionalGeneratedPromptConfig or OptionalRenderedPromptConfig
export type OptionalPromptConfig = OptionalTemplatePromptConfig | OptionalScriptPromptConfig | OptionalFunctionPromptConfig;

// Config for prompts that are rendered with functions (as part of the whole generate/stream Text/Object/Function config)
/** Reusable prompt callbacks can declare their context and returned prompt form. */
export interface FunctionPromptConfig<
	CONTEXT extends Context = Context,
	PROMPT extends PromptValue = PromptValue,
> extends ContextConfig<CONTEXT | undefined> {
	prompt: PromptFunction<PROMPT, CONTEXT>;
	messages?: ModelMessage[] | undefined;
	promptType?: FunctionPromptType;
}

type OptionalFunctionPromptConfig = FunctionPromptConfig | { promptType: TextPromptType };

// The default accepts schemas before inference; concrete tools default to undefined context.
export interface ToolContextSchemaConfig<TOOL_CONTEXT = unknown> { toolContextSchema?: SchemaType<TOOL_CONTEXT> | undefined }

// Description depends only on native context, independently of input/output tool variants.
export type ToolProperties<I = any, O = any, C = any> = Partial<Pick<Tool<I, O, C>,
	'title' | 'deferLoading' | 'providerOptions' | 'metadata' | 'strict' | 'inputExamples' | 'toModelOutput' | 'onInputStart' | 'onInputDelta' | 'onInputAvailable' | 'needsApproval'>> & { description?: Tool<unknown, unknown, C>['description'] };
export type ToolConfigShape<T> = T extends unknown ? Omit<T, keyof ToolProperties> & { [K in keyof ToolProperties]?: unknown } : never;

/** Configuration for renderer-based .asTool factories, which supply their own type and execute. */

export interface ToolConfig<INPUT extends Record<string, any>, OUTPUT, TOOL_CONTEXT = unknown> extends ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<INPUT, OUTPUT, TOOL_CONTEXT> {
	inputSchema: SchemaType<INPUT>;//the only required property
}

// Config types
// All of them are partials because they can be requested in pieces,
// and because doing Partial on the zod schema property makes it do deepPartial on it's properties which breaks it

// The first argument of generateText. Optional specialization preserves native callback inference.
export type GenerateTextConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends AnyPromptSource = string,
	OUTPUT extends AIOutput = AIOutput,
	RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>,
> = Omit<GenerateRequest<TOOLS, RUNTIME_CONTEXT, OUTPUT>, 'prompt' | 'messages' | 'abortSignal' | 'toolsContext' | 'tools'>
	& BaseConfig
	& { tools?: ConfiguredTools<TOOLS>; toolsContext?: import('./tool-binding.js').ToolContexts<TOOLS> }
	& { prompt?: PROMPT, messages?: ModelMessage[] | undefined, inputSchema?: SchemaType<INPUT> | undefined };

export type StreamTextConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends AnyPromptSource = string,
	OUTPUT extends AIOutput = AIOutput,
	RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>,
> = Omit<StreamRequest<TOOLS, RUNTIME_CONTEXT, OUTPUT>, 'prompt' | 'messages' | 'abortSignal' | 'toolsContext' | 'tools'>
	& BaseConfig
	& { tools?: ConfiguredTools<TOOLS>; toolsContext?: import('./tool-binding.js').ToolContexts<TOOLS> }
	& { prompt?: PROMPT, messages?: ModelMessage[] | undefined, inputSchema?: SchemaType<INPUT> | undefined };

export type FinalGenerateTextConfigShape = Partial<ConfigShape<GenerateTextConfig<any, any, any>> & { model: LanguageModel }>;

// Factory validation shapes cover any tool set, whose context type is not yet known.
export type TextConfigShape<TConfig> = Omit<TConfig, 'toolsContext' | 'tools'> & { toolsContext?: unknown }
	& ('tools' extends keyof TConfig ? { tools?: { [K in keyof NonNullable<TConfig['tools']>]: NonNullable<TConfig['tools']>[K] | null | undefined } } : EmptyMap);

// SDK context requirements are the same for text generators and streamers.
export interface ToolsContextConfig<TOOLS extends ToolSet> { toolsContext?: import('./tool-binding.js').ToolContexts<TOOLS> }

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
type ObjectOutputSettings<Request, Settings = Pick<Request, ObjectOutputSettingKeys & keyof Request>> = {
	[K in keyof Settings]: EmptyMap extends Pick<Settings, K> ? Settings[K] | undefined : Settings[K]
} & Partial<Record<Exclude<ObjectOutputSettingKeys, keyof Request>, undefined>>;

type ObjectConfig<Request extends { output?: unknown }, INPUT extends Record<string, any>, PROMPT extends AnyPromptSource, OptionalOutput extends boolean = false> =
	Omit<Request, 'prompt' | 'messages' | 'abortSignal' | 'output' | ObjectOutputSettingKeys> & BaseConfig
	// Inheritance can explicitly clear settings belonging to the previous output mode.
	& ObjectOutputSettings<Request>
	& { prompt?: PROMPT; messages?: ModelMessage[] | undefined; inputSchema?: SchemaType<INPUT> | undefined }
	& (OptionalOutput extends true ? { output?: Request['output'] | undefined } : Required<Pick<Request, 'output'>>);

export type GenerateObjectBaseConfig<
	INPUT extends Record<string, any>,
	PROMPT extends AnyPromptSource = string,
	RESULT = unknown,
> = Omit<ObjectConfig<GenerateObjectRequest<SchemaType<RESULT>, 'no-schema', RESULT>, INPUT, PROMPT>, 'output' | ObjectOutputSettingKeys>;

export type GenerateObjectObjectConfig<
	INPUT extends Record<string, any>, OUTPUT, PROMPT extends AnyPromptSource = string,
> = ObjectConfig<GenerateObjectRequest<SchemaType<OUTPUT>, 'object', OUTPUT>, INPUT, PROMPT, true>;

export type GenerateObjectArrayConfig<
	INPUT extends Record<string, any>, OUTPUT, PROMPT extends AnyPromptSource = string,
> = ObjectConfig<GenerateObjectRequest<SchemaType<OUTPUT>, 'array', OUTPUT[]>, INPUT, PROMPT>;

// Casai accepts readonly enum literals; the SDK invocation receives the same values.
export type GenerateObjectEnumConfig<
	INPUT extends Record<string, any>, ENUM extends string = string, PROMPT extends AnyPromptSource = string,
> = Omit<ObjectConfig<GenerateObjectRequest<SchemaType<ENUM>, 'enum', ENUM>, INPUT, PROMPT>, 'enum'>
	& { enum: Readonly<GenerateObjectRequest<SchemaType<ENUM>, 'enum', ENUM>['enum']> };

export type GenerateObjectNoSchemaConfig<
	INPUT extends Record<string, any>, PROMPT extends AnyPromptSource = string,
> = ObjectConfig<GenerateObjectRequest<SchemaType<JSONValue>, 'no-schema', JSONValue>, INPUT, PROMPT>;

export type GenerateObjectConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	ENUM extends string,
	PROMPT extends AnyPromptSource = string
> =
	GenerateObjectObjectConfig<INPUT, OUTPUT, PROMPT> |
	GenerateObjectArrayConfig<INPUT, OUTPUT, PROMPT> |
	GenerateObjectEnumConfig<INPUT, ENUM, PROMPT> |
	GenerateObjectNoSchemaConfig<INPUT, PROMPT>;

export type StreamObjectBaseConfig<
	INPUT extends Record<string, any>,
	PROMPT extends AnyPromptSource = string,
	RESULT = unknown,
> = Omit<ObjectConfig<StreamObjectRequest<SchemaType<RESULT>, 'no-schema', RESULT>, INPUT, PROMPT>, 'output' | ObjectOutputSettingKeys>;

export type StreamObjectObjectConfig<
	INPUT extends Record<string, any>, OUTPUT, PROMPT extends AnyPromptSource = string,
> = ObjectConfig<StreamObjectRequest<SchemaType<OUTPUT>, 'object', OUTPUT>, INPUT, PROMPT, true>;

export type StreamObjectArrayConfig<
	INPUT extends Record<string, any>, OUTPUT, PROMPT extends AnyPromptSource = string,
> = ObjectConfig<StreamObjectRequest<SchemaType<OUTPUT>, 'array', OUTPUT[]>, INPUT, PROMPT>;

export type StreamObjectNoSchemaConfig<
	INPUT extends Record<string, any>, PROMPT extends AnyPromptSource = string,
> = ObjectConfig<StreamObjectRequest<SchemaType<JSONValue>, 'no-schema', JSONValue>, INPUT, PROMPT>;

export type StreamObjectConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends AnyPromptSource = string
> =
	StreamObjectObjectConfig<INPUT, OUTPUT, PROMPT> |
	StreamObjectArrayConfig<INPUT, OUTPUT, PROMPT> |
	StreamObjectNoSchemaConfig<INPUT, PROMPT>;

// The config for Function, the execute method accepts both INPUT and context object properties
//@todo - inputSchema and schema more in line with the Vercel AI SDK - using FlexibleSchema
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
> extends Omit<ContextConfig<CONTEXT>, 'description'>, RegistryConfig, ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<InferSchema<TInputSchema>, import('./result.js').CollectedResult<{ schema: TOutputSchema }>, TOOL_CONTEXT> {
	inputSchema: TInputSchema;
	schema?: TOutputSchema;
	execute: FunctionToolImplementation<
		TInputSchema, TOutputSchema, FINAL_CONTEXT,
		(input: InferSchema<TInputSchema, Record<string, any>> & (FINAL_CONTEXT extends undefined ? unknown : FINAL_CONTEXT))
			=> InferSchema<TOutputSchema>, TOOL_CONTEXT>;
}

// The supported configuration families. This is the value contract; factory
// inference shapes below defer fields whose types depend on the final config.
export type AnyConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	ENUM extends string = string,
	PROMPT extends AnyPromptSource = AnyPromptSource
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
			Pick<CascadaConfig, 'loader'> & (TemplatePromptConfig | ScriptPromptConfig | FunctionPromptConfig | { prompt?: PROMPT, promptType?: TextPromptType })
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
export type FunctionConfigShape = Omit<FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any> | undefined,
	Record<string, any> | undefined, Record<string, any> | undefined, any>, 'inputSchema' | 'execute' | keyof ToolProperties>
	& { inputSchema: SchemaType<Record<string, any>> | undefined; execute?: unknown }
	& { [K in keyof ToolProperties]?: unknown };

// Infer the tool map independently, then validate its context with a useful diagnostic.
export type AnyConfigShape<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT, ENUM extends string,
	TShape = AnyConfig<TOOLS, INPUT, OUTPUT, ENUM>> = TShape extends unknown
	? 'toolsContext' extends keyof TShape ? TextConfigShape<TShape> : TShape
	: never;

// Factory shapes are inference constraints, not configuration annotations.
// Infer settings first, then specialize callbacks through the factory's input
// and validate the resolved config. Provisional only marks that first pass.
export type TextConfigInferShape<Config> = Provisional<ParentTextConfigInferShape<Config>>;
export type ObjectConfigInferShape<Config> = Provisional<ParentObjectConfigInferShape<Config>>;
export type ToolConfigInferShape<Config> = Provisional<ParentToolConfigInferShape<Config>>;

// Parents may supply incomplete settings. Their already-inferred data needs no
// provisional marker; only dependent callbacks/context are checked later.
export type ParentTextConfigInferShape<Config> = CallbackConfigShape<Partial<TextConfigShape<Config>>>;
export type ParentObjectConfigInferShape<Config> = ObjectCallbackShape<Partial<Config>>;
export type ParentToolConfigInferShape<Config> = ToolConfigShape<Partial<Config>>;

// A reusable fragment can belong to any family and may omit required settings.
// Keep its complete inference policy here rather than rebuilding it in overloads.
export type AnyConfigInferShape<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT, ENUM extends string> =
	Provisional<CallbackConfigShape<ToolConfigShape<Partial<AnyConfigShape<TOOLS, INPUT, OUTPUT, ENUM>>>>>;
