import {
	generateText, generateObject, streamText, streamObject,
} from 'ai';
import type {
	ToolSet,
	LanguageModel,
	ModelMessage,
	Tool,
	InferToolInput,
	InferToolOutput,
	GenerateObjectEndEvent,
	JSONValue
} from 'ai';
import type { InferToolContext } from '@ai-sdk/provider-utils';
import type { ConfigureOptions } from 'cascada-engine';
import type * as types from './types.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type { ConfigCallbackKeys, TextCallbacks, ObjectFinishCallback } from './callbacks.js';
export type { MergedConfig } from './merge.js';

// Some of the hacks here are because Parameters<T> helper type only returns the last overload type
// https://github.com/microsoft/TypeScript/issues/54223
// This is a problem because generateObject and streamObject have multiple overloads with different config and return types
// To overcome this:
// I get the generateText config type and exclude all properties specific only to it to get the base config type
// Then I add the specific properties for each function/overload - which are not many
// This is much less likely to break in future Vercel versions than copy/pasting the whole type definitions

export interface BaseConfig {
	debug?: boolean;
	description?: Tool['description'];
}

export interface ConfigProvider<T> {
	readonly config: T;
}

// Inspect each configuration alternative. An optional declared key does not add
// undefined to its contract, but a branch without that key does.
export type DeclaredType<T, K extends PropertyKey> = T extends unknown ? K extends keyof T
	? EmptyMap extends Pick<T, K> ? ([NonNullable<T[K]>] extends [never] ? undefined : NonNullable<T[K]>) : T[K]
	: undefined : never;

// SDK tool context of the final configuration, after parent overrides. Without a schema it is undefined.
export type ToolContextFromConfig<TConfig> = types.ContextFromSchema<DeclaredType<TConfig, 'toolContextSchema'>>;

export type ToolRegistry = Record<string, Tool | null | undefined>;
export type ResolvedTools<T> = string extends keyof T ? { [K in keyof T]: Extract<T[K], Tool> }
	: { [K in keyof T as [NonNullable<T[K]>] extends [never] ? never : K]-?: Extract<T[K], Tool> };
export type ToolsFromConfig<TConfig> = TConfig extends unknown ? 'tools' extends keyof TConfig
	? ResolvedTools<NonNullable<TConfig['tools']>> : EmptyMap : never;

export type OutputFromConfig<T> = [NonNullable<DeclaredType<T, 'output'>>] extends [never] ? types.DefaultTextOutput : NonNullable<DeclaredType<T, 'output'>> extends infer O extends types.AIOutput ? O : types.DefaultTextOutput;
// Unlike the SDK output generic, value accounts for a setting that can be absent at runtime.
export type ValueOutputFromConfig<T> = T extends unknown ? 'output' extends keyof T
	? OutputFromConfig<T> | (undefined extends T['output'] ? types.DefaultTextOutput : never)
	: types.DefaultTextOutput : never;
export type RuntimeContextFromConfig<T> = [NonNullable<DeclaredType<T, 'runtimeContext'>>] extends [never] ? Record<string, unknown> : NonNullable<DeclaredType<T, 'runtimeContext'>> extends infer C extends Record<string, unknown> ? C : Record<string, unknown>;

export type ObjectOutputFromConfig<T> = T extends { output: 'no-schema' } ? JSONValue
	: T extends { output: 'enum', enum: readonly (infer E)[] } ? E
	: T extends { output: 'array' } ? types.InferSchema<DeclaredType<T, 'schema'>>[]
	: types.InferSchema<DeclaredType<T, 'schema'>>;

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
export interface FunctionPromptConfig extends ContextConfig {
	prompt: types.PromptFunction;//The prompt is a function that returns a string or ModelMessage[]
	messages?: ModelMessage[] | undefined;
	promptType?: types.FunctionPromptType;
}

export type OptionalFunctionPromptConfig = FunctionPromptConfig | { promptType: 'text' | 'text-name' };


// The default accepts schemas before inference; concrete tools default to undefined context.
export interface ToolContextSchemaConfig<TOOL_CONTEXT = unknown> { toolContextSchema?: types.SchemaType<TOOL_CONTEXT> | undefined }

// Description depends only on native context, independently of input/output tool variants.
export type ToolProperties<I = any, O = any, C = any> = Partial<Pick<Tool<I, O, C>,
	'title' | 'deferLoading' | 'providerOptions' | 'metadata' | 'strict' | 'inputExamples' | 'toModelOutput' | 'onInputStart' | 'onInputDelta' | 'onInputAvailable' | 'needsApproval'>> & { description?: Tool<any, any, C>['description'] };
export type ToolConfigShape<T> = T extends unknown ? Omit<T, keyof ToolProperties> & { [K in keyof ToolProperties]?: unknown } : never;

/** Configuration for renderer-based .asTool factories, which supply their own type and execute. */

export interface ToolConfig<INPUT extends Record<string, any>, OUTPUT, TOOL_CONTEXT = unknown> extends ToolContextSchemaConfig<TOOL_CONTEXT>, ToolProperties<INPUT, OUTPUT, TOOL_CONTEXT> {
	inputSchema: types.SchemaType<INPUT>;//the only required property
}

// Config types
// All of them are partials because they can be requested in pieces,
// and because doing Partial on the zod schema property makes it do deepPartial on it's properties which breaks it

// The first argument of generateText
export type GenerateTextConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
> = Omit<Parameters<typeof generateText<TOOLS, Record<string, unknown>, types.AIOutput>>[0], 'prompt' | 'messages' | 'abortSignal' | 'toolsContext' | 'tools'>
	& BaseConfig
	& { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined }; toolsContext?: import('./application.js').ToolContexts<TOOLS> }
	& { prompt?: PROMPT, messages?: ModelMessage[] | undefined, inputSchema?: types.SchemaType<INPUT> | undefined };

export type StreamTextConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
> = Omit<Parameters<typeof streamText<TOOLS, Record<string, unknown>, types.AIOutput>>[0], 'prompt' | 'messages' | 'abortSignal' | 'toolsContext' | 'tools'>
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

// Derive shared SDK settings from the no-schema overload; specialize output below.
export type GenerateObjectBaseConfig<
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
	RESULT = unknown,
> = Omit<Parameters<typeof generateObject>[0], 'output' | 'prompt' | 'messages' | 'onFinish' | 'abortSignal'>
	& BaseConfig
	& { prompt?: PROMPT, messages?: ModelMessage[] | undefined, inputSchema?: types.SchemaType<INPUT> | undefined, onFinish?: (event: GenerateObjectEndEvent<RESULT>) => void | PromiseLike<void> };

export type GenerateObjectObjectConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends types.AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT, OUTPUT> & {
	output?: 'object' | undefined;
	schema: types.SchemaType<OUTPUT>;
	schemaName?: string;
	schemaDescription?: string;
}

export type GenerateObjectArrayConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends types.AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT, OUTPUT[]> & {
	output: 'array';
	schema: types.SchemaType<OUTPUT>;
	schemaName?: string;
	schemaDescription?: string;
}

export type GenerateObjectEnumConfig<
	INPUT extends Record<string, any>,
	ENUM extends string = string,
	PROMPT extends types.AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT, ENUM> & {
	output: 'enum';
	enum: readonly ENUM[];
}

export type GenerateObjectNoSchemaConfig<
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT, JSONValue> & {
	output: 'no-schema';
}

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

// Derive shared SDK settings from the no-schema overload; specialize output below.
export type StreamObjectBaseConfig<
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
	RESULT = unknown,
> = Omit<Parameters<typeof streamObject>[0], 'output' | 'prompt' | 'messages' | 'onFinish' | 'abortSignal'>
	& BaseConfig
	& {
		//Bring back the removed onFinish and prompt properties
		prompt?: PROMPT;
		messages?: ModelMessage[] | undefined;
		onFinish?: ObjectFinishCallback<RESULT, true>;
		inputSchema?: types.SchemaType<INPUT> | undefined;
	};

export type StreamObjectObjectConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends types.AnyPromptSource = string
> = StreamObjectBaseConfig<INPUT, PROMPT, OUTPUT> & {
	output?: 'object' | undefined;
	schema: types.SchemaType<OUTPUT>;
	schemaName?: string;
	schemaDescription?: string;
}

export type StreamObjectArrayConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends types.AnyPromptSource = string
> = StreamObjectBaseConfig<INPUT, PROMPT, OUTPUT[]> & {
	output: 'array';
	schema: types.SchemaType<OUTPUT>;
	schemaName?: string;
	schemaDescription?: string;
}

export type StreamObjectNoSchemaConfig<
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string
> = StreamObjectBaseConfig<INPUT, PROMPT, JSONValue> & {
	output: 'no-schema';
}

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
export type LLMRunConfig = Partial<BaseConfig> & {
	messages?: ModelMessage[] | undefined;
	prompt?: types.AnyPromptSource;
	context?: types.Context;
	abortSignal?: AbortSignal;
};

// For the .run argument - disallow all properties that ...
export const fixedRunSettings = [
	'schema', 'output', 'enum',
	'inputSchema', 'toolContextSchema', 'promptType',
	'filters', 'renderOptions', 'loader',
] as const;
export type RunConfigDisallowedProperties = typeof fixedRunSettings[number];

//@todo - Check
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
	| FunctionFragmentConfig;

// Any Function or Function.asTool config. Config types and checks execute from the schemas the config declares.
export type FunctionFragmentConfig = Omit<FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any> | undefined,
	Record<string, any> | undefined, Record<string, any> | undefined, any>, 'inputSchema' | 'execute' | keyof ToolProperties>
	& { inputSchema: types.SchemaType<Record<string, any>> | undefined; execute?: unknown }
	& { [K in keyof ToolProperties]?: unknown };

// Infer the tool map independently, then validate its context with a useful diagnostic.
export type AnyConfigShape<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT, ENUM extends string,
	TShape = AnyConfig<TOOLS, INPUT, OUTPUT, ENUM>> = TShape extends unknown
	? 'toolsContext' extends keyof TShape ? TextConfigShape<TShape> : TShape
	: never;

// Config supplies callback context after independently inferring schemas and tools.
export type ConfigFragmentShape<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT, ENUM extends string> =
	Partial<AnyConfigShape<TOOLS, INPUT, OUTPUT, ENUM>>;
