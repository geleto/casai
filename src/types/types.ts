import { ModelMessage, Schema, StreamObjectOnFinishCallback, StreamTextOnFinishCallback, ToolCallOptions, ToolSet } from 'ai';//do not confuze the 'ai' Schema type with the 'zod' Schema type
import { z } from 'zod';
import { InferParameters } from './utils';
import { ILoaderAny } from 'cascada-engine';
import { RaceGroup, RaceLoader } from '../loaders';

// Template types
export type Context = Record<string, any>;
export type Filters = Record<string, (input: any, ...args: any[]) => any>;

// export type SchemaType<T> = z.Schema<T, z.ZodTypeDef, any> | Schema<T>;
export type SchemaType<T> =
	| z.ZodType<T, any, any>
	| Schema<T>;

//@todo - see InferSchema in the Vercel AI SDK
/*export type InferSchema<TSchema> =
	TSchema extends z.ZodType<infer T, any, any>
	? T
	: TSchema extends Schema<infer O>
	? O
	: Record<string, any>;*/

export type InferSchema<TSchema, TFallback = unknown> =
	TSchema extends { _output: infer O } ? O : // Zod v3
	TSchema extends { '~output': infer O } ? O : // Zod v4
	TSchema extends { _type: infer O } ? O : // Vercel AI SDK Schema
	TSchema extends () => { _type: infer T } ? T : // LazySchema - match function returning Schema
	TFallback;

// Same properties as in the Vercel AI SDK
export type ToolExecuteFunction<
	INPUT extends Record<string, any> | undefined,
	OUTPUT,
	CONTEXT extends Record<string, any> | undefined
> = (input: INPUT & (CONTEXT extends undefined ? unknown : CONTEXT), options: ToolCallOptions) => /*AsyncIterable<OUTPUT> |*/ PromiseLike<OUTPUT> | OUTPUT;

// Like ToolExecuteFunction but without ToolCallOptions
export type ExecuteFunction<
	INPUT extends Record<string, any> | undefined,
	OUTPUT,
	CONTEXT extends Record<string, any> | undefined
> = (input: INPUT & (CONTEXT extends undefined ? unknown : CONTEXT)) => /*AsyncIterable<OUTPUT> |*/ PromiseLike<OUTPUT> | OUTPUT;

// Define the possible prompt types
export type TemplatePromptType = 'template' | 'async-template' | 'template-name' | 'async-template-name';
export type ScriptPromptType = 'script' | 'async-script' | 'script-name' | 'async-script-name';
export type FunctionPromptType = 'function';

export type PromptType = TemplatePromptType | ScriptPromptType | FunctionPromptType | 'text' | 'text-name';
export type RequiredPromptType = Exclude<PromptType, undefined>;

export type AnyPromptSource = string | ModelMessage[] | PromptFunction<string | ModelMessage[]>;

export type PromptFunction<PR extends string | ModelMessage[] = string | ModelMessage[]> =
	(context: Context) => PR | Promise<PR>;

//export type LLMPromptType = TemplatePromptType | 'text';

// Define PromptOrMessage after importing config types

//export type PromptOrMessage = { prompt: string } | { messages: NonNullable<GenerateTextConfig['messages']> };

// Utility types
export type StreamObjectOnFinishEvent<SCHEMA extends z.ZodTypeAny | Schema<any>> =
	Parameters<StreamObjectOnFinishCallback<InferParameters<SCHEMA>>>[0];

export type StreamTextOnFinishEvent<TOOLS extends ToolSet = Record<string, never>> =
	Parameters<StreamTextOnFinishCallback<TOOLS>>[0];

export type EmptyObject = Record<string, never>;

export type CascadaFilters = Record<string, (input: any, ...args: any[]) => any>;

export type CascadaLoaders = ILoaderAny | ILoaderAny[];
export type CasaiAILoaders = ILoaderAny | RaceGroup | RaceLoader | (ILoaderAny | RaceGroup | RaceLoader)[];

