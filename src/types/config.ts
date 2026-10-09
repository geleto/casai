import {
	generateText, generateObject, streamText, streamObject,
} from 'ai';
import type {
	ToolSet,
	LanguageModel,
	ModelMessage,
	ToolExecutionOptions,
	Tool,
	InferToolInput,
	InferToolOutput,
	GenerateObjectEndEvent,
	JSONValue
} from 'ai';
import type { ConfigureOptions } from 'cascada-engine';
import type * as types from './types.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type { AugmentedResponse } from './result.js';
import type { ConfigCallbackKeys, TextCallbacks, RuntimeContextFromConfig, ObjectFinishCallback } from './callbacks.js';
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
	description?: string;//useful for future OpenTelemetry, error logging, etc.
}

export interface ConfigProvider<T> {
	readonly config: T;
}

// An optional key in a declared config type does not add undefined to the declared type.
export type DeclaredType<T, K extends PropertyKey> = K extends keyof T
	? EmptyMap extends Pick<T, K> ? ([NonNullable<T[K]>] extends [never] ? undefined : NonNullable<T[K]>) : T[K]
	: undefined;

// SDK tool context of the final configuration, after parent overrides. Without a schema it is undefined.
export type ToolContextFromConfig<TConfig> = types.ContextFromSchema<DeclaredType<TConfig, 'contextSchema'>>;

export type ToolsFromConfig<TConfig> = 'tools' extends keyof TConfig
	? Extract<Required<NonNullable<TConfig['tools']>>, ToolSet> : EmptyMap;

export type MergedTools<TParentConfig, TConfig> = ToolsFromConfig<MergedConfig<TParentConfig, TConfig>>;

// @todo - INPUT generic parameter for context
export interface ContextConfig<CONTEXT extends Record<string, any> | undefined = Record<string, any> | undefined> extends BaseConfig {
	context?: CONTEXT;
}

export const ContextConfigKeys: (keyof ContextConfig)[] = ['context', 'debug'] as const;

// Shared for scripts and
// @todo - INPUT generic parameter for context
export interface CascadaConfig<CONTEXT extends Record<string, any> | undefined = Record<string, any> | undefined> extends ContextConfig<CONTEXT> {
	filters?: types.CascadaFilters;
	options?: ConfigureOptions;
	loader?: types.CasaiAILoaders | undefined;
}

export const CascadaConfigKeys: (keyof CascadaConfig)[] = ['context', 'filters', 'options', 'loader', 'debug'] as const;

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
> extends CascadaConfig {
	template: string;
	inputSchema?: types.SchemaType<INPUT>;
	promptType?: types.TemplatePromptType;
}

export const TemplateConfigKeys = ['template', 'inputSchema', 'promptType', ...CascadaConfigKeys] as const;

// A loaded template's name can be configured or supplied at call time.
export type NamedTemplateConfig<INPUT extends Record<string, any>> = Omit<TemplateConfig<INPUT>, 'template'> & { template?: string } & LoaderConfig;

// Config for a Tool that uses the Template engine
export interface TemplateToolConfig<
	INPUT extends Record<string, any>,
	TOOL_CONTEXT = unknown,
> extends TemplateConfig<INPUT>, ContextSchemaConfig<TOOL_CONTEXT> {
	inputSchema: types.SchemaType<INPUT>;//required
	description?: string;
}

export type FinalTemplateConfigShape = Partial<TemplateConfig<any> & ToolConfig<any, any> & { loader?: any }>;

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
> extends CascadaConfig {
	script?: string;
	schema?: types.SchemaType<OUTPUT>;
	inputSchema?: types.SchemaType<INPUT>;
	promptType?: types.ScriptPromptType;
};

export const ScriptConfigKeys = ['script', 'schema', 'inputSchema', 'promptType', ...CascadaConfigKeys] as const;

// Config for a Tool that uses the Script engine
export interface ScriptToolConfig<
	INPUT extends Record<string, any>,
	OUTPUT,
	TOOL_CONTEXT = unknown,
> extends ScriptConfig<INPUT, OUTPUT>, ContextSchemaConfig<TOOL_CONTEXT> {
	inputSchema: types.SchemaType<INPUT>;//required
	description?: string;
}

export type FinalScriptConfigShape = Partial<ScriptConfig<any, any> & ScriptToolConfig<any, any> & { loader?: any }>;

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

export type PromptConfig = TemplatePromptConfig | ScriptPromptConfig | FunctionPromptConfig;

// The default accepts schemas before inference; concrete tools default to undefined context.
export type ContextSchemaConfig<TOOL_CONTEXT = unknown> = Pick<Tool<any, any, TOOL_CONTEXT>, 'contextSchema'>;

/** Configuration for renderer-based .asTool factories, which supply their own type and execute. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- OUTPUT is kept for existing ToolConfig<INPUT, OUTPUT> references.
export interface ToolConfig<INPUT extends Record<string, any>, OUTPUT, TOOL_CONTEXT = unknown> extends ContextSchemaConfig<TOOL_CONTEXT> {
	description?: string;
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
> = Omit<Parameters<typeof generateText<TOOLS, Record<string, unknown>, types.AIOutput>>[0], 'prompt' | 'messages'>
	& BaseConfig
	& { prompt?: PROMPT, messages?: ModelMessage[] | undefined, inputSchema?: types.SchemaType<INPUT> };

// The first argument of streamText
type AugmentedStreamFinishCallback<CALLBACK> = CALLBACK extends (event: infer EVENT) => infer RESULT
	? (event: Omit<EVENT, 'response'> & {
		response: EVENT extends { response: infer RESPONSE } ? AugmentedResponse<RESPONSE> : never;
	}) => RESULT
	: never;

export type StreamTextConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
> = Omit<Parameters<typeof streamText<TOOLS, Record<string, unknown>, types.AIOutput>>[0], 'prompt' | 'messages' | 'onFinish' | 'onEnd'>
	& BaseConfig
	& {
		prompt?: PROMPT;
		messages?: ModelMessage[] | undefined;
		inputSchema?: types.SchemaType<INPUT>;
		onFinish?: AugmentedStreamFinishCallback<Parameters<typeof streamText<TOOLS, Record<string, unknown>, types.AIOutput>>[0]['onFinish']>;
		onEnd?: AugmentedStreamFinishCallback<Parameters<typeof streamText<TOOLS, Record<string, unknown>, types.AIOutput>>[0]['onEnd']>;
	};

export type FinalGenerateTextConfigShape = Partial<ConfigShape<GenerateTextConfig<any, any, any>> & { model: LanguageModel }>;

export type FinalStreamTextConfigShape = Partial<ConfigShape<StreamTextConfig<any, any, any>> & { model: LanguageModel }>;

// Factory validation shapes cover any tool set, whose context type is not yet known.
export type TextConfigShape<TConfig> = Omit<TConfig, 'toolsContext'> & { toolsContext?: unknown };

// SDK context requirements are the same for text generators and streamers.
export type ToolsContextConfig<TOOLS extends ToolSet> = Pick<GenerateTextConfig<TOOLS, never> & { toolsContext?: unknown }, 'toolsContext'>;

type RunToolContext<TOOLS extends ToolSet, K extends keyof TOOLS,
	Contexts = NonNullable<ToolsContextConfig<TOOLS>['toolsContext']>> = K extends keyof Contexts ? Contexts[K] : undefined;

// A run can replace implementations while preserving its tool input, output and context types.
export type TextRunConfig<TShape, TOOLS extends ToolSet, TConfig = { tools: TOOLS }, Streaming extends boolean = false> =
	Omit<TShape, 'tools' | 'toolsContext' | 'runtimeContext' | 'activeTools' | 'toolChoice' | 'toolOrder' | ConfigCallbackKeys> &
	Pick<Parameters<typeof generateText<TOOLS>>[0], 'activeTools' | 'toolChoice' | 'toolOrder'> & TextCallbacks<TConfig, TOOLS, Streaming> & {
	runtimeContext?: RuntimeContextFromConfig<TConfig>;
	tools?: { [K in keyof TOOLS]?: Tool<InferToolInput<TOOLS[K]>, InferToolOutput<TOOLS[K]>, RunToolContext<TOOLS, K>> | TOOLS[K] };
	toolsContext?: Partial<NonNullable<ToolsContextConfig<TOOLS>['toolsContext']>>;
};

// Key validation also applies to callbacks whose argument types depend on the tool set.
export type ConfigShape<TConfig> = { [Property in keyof TConfig]?: unknown };

// We get the last overload which is the no-schema overload and make it base by omitting the output and mode properties
export type GenerateObjectBaseConfig<
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
	RESULT = unknown,
> = Omit<Parameters<typeof generateObject>[0], 'output' | 'mode' | 'prompt' | 'messages' | 'onFinish'>
	& BaseConfig
	& { prompt?: PROMPT, messages?: ModelMessage[] | undefined, inputSchema?: types.SchemaType<INPUT>, onFinish?: (event: GenerateObjectEndEvent<RESULT>) => void | PromiseLike<void> };

export type GenerateObjectObjectConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends types.AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT, OUTPUT> & {
	output?: 'object' | undefined;
	schema: types.SchemaType<OUTPUT>;
	schemaName?: string;
	schemaDescription?: string;
	mode?: 'auto' | 'json' | 'tool';
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
	mode?: 'auto' | 'json' | 'tool';
}

export type GenerateObjectEnumConfig<
	INPUT extends Record<string, any>,
	ENUM extends string = string,
	PROMPT extends types.AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT, ENUM> & {
	output: 'enum';
	enum: readonly ENUM[];
	mode?: 'auto' | 'json' | 'tool';
}

export type GenerateObjectNoSchemaConfig<
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT, JSONValue> & {
	output: 'no-schema';
	mode?: 'json';
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

// We get the last overload which is the no-schema overload and make it base by omitting the output and mode properties
export type StreamObjectBaseConfig<
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string,
	RESULT = unknown,
> = Omit<Parameters<typeof streamObject>[0], 'output' | 'mode' | 'prompt' | 'messages' | 'onFinish'>
	& BaseConfig
	& {
		//Bring back the removed onFinish and prompt properties
		prompt?: PROMPT;
		messages?: ModelMessage[] | undefined;
		onFinish?: ObjectFinishCallback<RESULT, true>;
		inputSchema?: types.SchemaType<INPUT>;
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
	mode?: 'auto' | 'json' | 'tool';
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
	mode?: 'auto' | 'json' | 'tool';
}

export type StreamObjectNoSchemaConfig<
	INPUT extends Record<string, any>,
	PROMPT extends types.AnyPromptSource = string
> = StreamObjectBaseConfig<INPUT, PROMPT, JSONValue> & {
	output: 'no-schema';
	mode?: 'json';
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

export const FunctionConfigKeys: (keyof FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined>)[] = ['execute', 'schema', 'inputSchema', ...ContextConfigKeys] as const;

// The config for Function, the execute method accepts both INPUT and context object properties
//@todo - inputSchema and schema more in line with the Vercel AI SDK - using FlexibleSchema
export interface FunctionConfig<
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends types.SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	FINAL_CONTEXT extends Record<string, any> | undefined = CONTEXT,
> extends ContextConfig<CONTEXT> {
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
> extends ContextConfig<CONTEXT>, ContextSchemaConfig<TOOL_CONTEXT> {
	inputSchema: TInputSchema;
	schema?: TOutputSchema;
	execute: types.FunctionToolImplementation<
		TInputSchema, TOutputSchema, FINAL_CONTEXT,
		(input: types.InferSchema<TInputSchema, Record<string, any>> & (FINAL_CONTEXT extends undefined ? unknown : FINAL_CONTEXT),
			options: ToolExecutionOptions<TOOL_CONTEXT>)
			=> types.InferSchema<TOutputSchema>, TOOL_CONTEXT>;
}

// Shared configuration fields used by the LLM run() implementation.
export type LLMRunConfig = Partial<BaseConfig> & {
	messages?: ModelMessage[] | undefined;
	prompt?: types.AnyPromptSource;
	context?: types.Context;
};

// For the .run argument - disallow all properties that ...
export type RunConfigDisallowedProperties =
	| 'schema' | 'output' | 'enum' //... change the output type
	| 'inputSchema' | 'contextSchema' | 'promptType' //... define the component's input and rendering contracts
	| 'filters' | 'options' | 'loader'; ///... or are used to create the cascada environment

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
	) & Partial<ToolConfig<INPUT, OUTPUT>> &
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
	Record<string, any> | undefined, Record<string, any> | undefined, unknown>, 'execute'> & { execute?: unknown };

// Infer the tool map independently, then validate its context with a useful diagnostic.
export type AnyConfigShape<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT, ENUM extends string,
	TShape = AnyConfig<TOOLS, INPUT, OUTPUT, ENUM>> = TShape extends unknown
	? 'toolsContext' extends keyof TShape ? TextConfigShape<TShape> : TShape
	: never;

// Config supplies callback context after independently inferring schemas and tools.
export type ConfigFragmentShape<TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT, ENUM extends string> =
	Partial<AnyConfigShape<TOOLS, INPUT, OUTPUT, ENUM>>;
