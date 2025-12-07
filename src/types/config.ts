import {
	generateText, generateObject, streamText, streamObject,
	ToolSet,
	StreamObjectOnFinishCallback,
	ModelMessage,
	Tool,
	ToolCallOptions
} from 'ai';
import { ConfigureOptions } from 'cascada-engine';
import {
	TemplatePromptType, ScriptPromptType, /*, LLMPromptType */
	SchemaType, CascadaFilters, CasaiAILoaders,
	FunctionPromptType,
	PromptFunction,
	AnyPromptSource,
	ExecuteFunction,
	InferSchema
} from './types';

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

// @todo - INPUT generic parameter for context
export interface ContextConfig extends BaseConfig {
	context?: Record<string, any>;
}

export const ContextConfigKeys: (keyof ContextConfig)[] = ['context', 'debug'] as const;

// Shared for scripts and
// @todo - INPUT generic parameter for context
export interface CascadaConfig extends ContextConfig {
	filters?: CascadaFilters;
	options?: ConfigureOptions;
	loader?: CasaiAILoaders;
}

export const CascadaConfigKeys: (keyof CascadaConfig)[] = ['context', 'filters', 'options', 'loader', 'debug'] as const;

export interface LoaderConfig {
	loader: CasaiAILoaders;
}

// Only for use in Template
export interface TemplateConfig<
	INPUT extends Record<string, any>,
> extends CascadaConfig {
	template: string;
	inputSchema?: SchemaType<INPUT>;
	promptType?: TemplatePromptType;
}

export const TemplateConfigKeys = ['template', 'inputSchema', 'promptType', ...CascadaConfigKeys] as const;

// Config for a Tool that uses the Template engine
export interface TemplateToolConfig<
	INPUT extends Record<string, any>,
> extends TemplateConfig<INPUT> {
	inputSchema: SchemaType<INPUT>;//required
	description?: string;
}

// Config for prompts that are rendered with templates (as part of the whole generate/stream Text/Object/Function config)
export interface TemplatePromptConfig extends CascadaConfig {
	prompt?: string;//the string containing the template, can be specified in the caller
	messages?: ModelMessage[];
	promptType?: TemplatePromptType;
}

// Only for use in Script
export interface ScriptConfig<
	INPUT extends Record<string, any>,
	OUTPUT
> extends CascadaConfig {
	script?: string;
	schema?: SchemaType<OUTPUT>;
	inputSchema?: SchemaType<INPUT>;
	promptType?: ScriptPromptType;
};

export const ScriptConfigKeys = ['script', 'schema', 'inputSchema', 'promptType', ...CascadaConfigKeys] as const;

// Config for a Tool that uses the Script engine
export interface ScriptToolConfig<
	INPUT extends Record<string, any>,
	OUTPUT
> extends ScriptConfig<INPUT, OUTPUT> {
	inputSchema: SchemaType<INPUT>;//required
	description?: string;
}

export type OptionalTemplatePromptConfig = TemplatePromptConfig | { promptType: 'text' | 'text-name' };

// Config for prompts that are rendered with scripts (as part of the whole generate/stream Text/Object/Function config)
export interface ScriptPromptConfig extends CascadaConfig {
	prompt?: string;//the string containing the script, can be specified in the caller
	messages?: ModelMessage[];
	promptType?: ScriptPromptType;
}

export type OptionalScriptPromptConfig = ScriptPromptConfig | { promptType: 'text' | 'text-name' };

//@todo OptionalGeneratedPromptConfig or OptionalRenderedPromptConfig
export type OptionalPromptConfig = OptionalTemplatePromptConfig | OptionalScriptPromptConfig | OptionalFunctionPromptConfig;

// Config for prompts that are rendered with functions (as part of the whole generate/stream Text/Object/Function config)
export interface FunctionPromptConfig extends ContextConfig {
	prompt: PromptFunction;//The prompt is a function that returns a string or ModelMessage[]
	messages?: ModelMessage[];
	promptType?: FunctionPromptType;
}

export type OptionalFunctionPromptConfig = FunctionPromptConfig | { promptType: 'text' | 'text-name' };

export type PromptConfig = TemplatePromptConfig | ScriptPromptConfig | FunctionPromptConfig;

/**
 * The basic configuration required for a vercel function tool derived from a renderer
 * This is the Tool config for all .asTool except for the Function.asTool
 */
export interface ToolConfig<INPUT extends Record<string, any>, OUTPUT> {
	type?: 'function';
	description?: string;
	inputSchema: SchemaType<INPUT>;//the only required property
	execute?: (args: INPUT, options: ToolCallOptions) => PromiseLike<OUTPUT>;
}

// Config types
// All of them are partials because they can be requested in pieces,
// and because doing Partial on the zod schema property makes it do deepPartial on it's properties which breaks it

// The first argument of generateText
export type GenerateTextConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends AnyPromptSource = string,
> = Omit<Parameters<typeof generateText<TOOLS>>[0], 'prompt'>
	& BaseConfig
	& { prompt?: PROMPT, inputSchema?: SchemaType<INPUT> };

// The first argument of streamText
export type StreamTextConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends AnyPromptSource = string,
> = Omit<Parameters<typeof streamText<TOOLS>>[0], 'prompt'>
	& BaseConfig
	& { prompt?: PROMPT, inputSchema?: SchemaType<INPUT> };

// We get the last overload which is the no-schema overload and make it base by omitting the output and mode properties
export type GenerateObjectBaseConfig<
	INPUT extends Record<string, any>,
	PROMPT extends AnyPromptSource = string
> = Omit<Parameters<typeof generateObject>[0], | 'output' | 'mode' | 'prompt'>
	& BaseConfig
	& { prompt?: PROMPT, inputSchema?: SchemaType<INPUT> };

export type GenerateObjectObjectConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT> & {
	output?: 'object' | undefined;
	schema: SchemaType<OUTPUT>;
	schemaName?: string;
	schemaDescription?: string;
	mode?: 'auto' | 'json' | 'tool';
}

export type GenerateObjectArrayConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT> & {
	output: 'array';
	schema: SchemaType<OUTPUT>;
	schemaName?: string;
	schemaDescription?: string;
	mode?: 'auto' | 'json' | 'tool';
}

export type GenerateObjectEnumConfig<
	INPUT extends Record<string, any>,
	ENUM extends string = string,
	PROMPT extends AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT> & {
	output: 'enum';
	enum: readonly ENUM[];
	mode?: 'auto' | 'json' | 'tool';
}

export type GenerateObjectNoSchemaConfig<
	INPUT extends Record<string, any>,
	PROMPT extends AnyPromptSource = string
> = GenerateObjectBaseConfig<INPUT, PROMPT> & {
	output: 'no-schema';
	mode?: 'json';
}

// We get the last overload which is the no-schema overload and make it base by omitting the output and mode properties
export type StreamObjectBaseConfig<
	INPUT extends Record<string, any>,
	PROMPT extends AnyPromptSource = string
> = Omit<Parameters<typeof streamObject>[0], | 'output' | 'mode' | 'prompt' | 'onFinish'>
	& BaseConfig
	& {
		//Bring back the removed onFinish and prompt properties
		prompt?: PROMPT;
		onFinish?: StreamObjectOnFinishCallback<any>;//@todo - use proper specialization
		inputSchema?: SchemaType<INPUT>;
	};

export type StreamObjectObjectConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends AnyPromptSource = string
> = StreamObjectBaseConfig<INPUT, PROMPT> & {
	output?: 'object' | undefined;
	schema: SchemaType<OUTPUT>;
	schemaName?: string;
	schemaDescription?: string;
	mode?: 'auto' | 'json' | 'tool';
}

export type StreamObjectArrayConfig<
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	PROMPT extends AnyPromptSource = string
> = StreamObjectBaseConfig<INPUT, PROMPT> & {
	output: 'array';
	schema: SchemaType<OUTPUT>;
	schemaName?: string;
	schemaDescription?: string;
	mode?: 'auto' | 'json' | 'tool';
}

export type StreamObjectNoSchemaConfig<
	INPUT extends Record<string, any>,
	PROMPT extends AnyPromptSource = string
> = StreamObjectBaseConfig<INPUT, PROMPT> & {
	output: 'no-schema';
	mode?: 'json';
}

export const FunctionConfigKeys: (keyof FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>)[] = ['execute', 'schema', 'inputSchema', ...ContextConfigKeys] as const;

// The config for Function, the execute method accepts both INPUT and context object properties
//@todo - inputSchema and schema more in line with the Vercel AI SDK - using FlexibleSchema
export interface FunctionConfig<
	TInputSchema extends SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	INPUT extends Record<string, any> = InferSchema<TInputSchema>,
	OUTPUT = InferSchema<TOutputSchema, any>,
> extends ContextConfig {
	context?: CONTEXT;
	inputSchema?: TInputSchema;
	schema?: TOutputSchema;
	execute: ExecuteFunction<INPUT, OUTPUT, CONTEXT>;
}
// The config for Function.asTool, the execute method accepts both INPUT and context object properties
export type FunctionToolConfig<
	TInputSchema extends SchemaType<Record<string, any>>, // required for tools
	TOutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	INPUT extends Record<string, any> = InferSchema<TInputSchema>,
	OUTPUT = InferSchema<TOutputSchema, any>
> =
	ContextConfig &
	Omit<Tool, 'execute' | 'inputSchema' | 'schema'> &
	FunctionConfig<TInputSchema, TOutputSchema, CONTEXT, INPUT, OUTPUT>;

// For the .run argument - disallow all properties that ...
export type RunConfigDisallowedProperties =
	| 'schema' | 'output' | 'enum' //... change the output type
	| 'filters' | 'options' | 'loader'; ///... or are used to create the cascada environment

//@todo - Check
export type AnyConfig<
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	ENUM extends string = string,
	PROMPT extends AnyPromptSource = string | ModelMessage[]
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
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	) & (ToolConfig<INPUT, OUTPUT> | {}) &
		(
			// eslint-disable-next-line @typescript-eslint/no-empty-object-type
			(LoaderConfig | {}) & (TemplatePromptConfig | ScriptPromptConfig | {})
		)
		| FunctionPromptConfig
	) |
	((// Template/Script Engine Configs
		| TemplateConfig<INPUT>
		| TemplateToolConfig<INPUT>
		| ScriptToolConfig<INPUT, OUTPUT>
		| ScriptConfig<INPUT, OUTPUT>
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	) & (LoaderConfig | {}))
	| FunctionToolConfig<any, any, Record<string, any> | undefined>//switch to any as getting schema from input/output is not bulletproof
	| FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>;//@todo - use the schema for the whole thing