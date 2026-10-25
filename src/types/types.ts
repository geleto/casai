import type { ModelMessage, Schema, GenerateObjectEndEvent, StreamTextOnEndCallback, FlexibleSchema, InferSchema as SDKInferSchema, ToolSet, Output } from 'ai';//do not confuze the 'ai' Schema type with the 'zod' Schema type
import { z } from 'zod';
import type { ILoaderAny } from 'cascada-engine';
import type { RaceGroup, RaceLoader } from '../loaders.js';

export type AIOutput<OUTPUT = any, PARTIAL = any, ELEMENT = any> = Output.Output<OUTPUT, PARTIAL, ELEMENT>;

// The omitted SDK output has a known kind; explicit specifications keep their native types.
export type DefaultTextOutput = AIOutput<string, string, never> & { name: 'text' };

// Template types
export type Context = Record<string, any>;
export type Filters = Record<string, (input: any, ...args: any[]) => any>;

// Zod 3's tagged definition is excluded even through its Standard Schema surface.
// Native SDK tools keep the SDK's wider schema contract.
export type SchemaType<T> = FlexibleSchema<T> & { readonly _def?: object & { readonly typeName?: never } };
export type InferSchema<S, Fallback = unknown> = S extends { _output: infer O } ? O
	: S extends { _zod: { output: infer O } } ? O
	: S extends FlexibleSchema<unknown> ? SDKInferSchema<S> : Fallback;
type SchemaInput<S, Fallback> = '~input' extends keyof S ? S['~input'] extends infer I ? Exclude<I, undefined> : never
	: S extends { _input: infer I } | { _zod: { input: infer I } } ? 0 extends (1 & I) ? InferSchema<S, Fallback> : I
	: S extends { readonly '~standard': { readonly types?: { readonly input: infer I } } } ? I : InferSchema<S, Fallback>;
// An explicit SDK FlexibleSchema annotation erases raw input types; preserve
// native output inference there, and precise raw types for retained schemas.
export type InferInputSchema<S, Fallback = unknown> = [FlexibleSchema<InferSchema<S, Fallback>>] extends [S]
	? InferSchema<S, Fallback> : SchemaInput<S, Fallback>;

// Preprocessors can accept unknown values, but component context arguments are objects.
// An EmptyMap fallback lets callers distinguish known schema keys from an open input shape.
export type InferContextInputSchema<TSchema, TFallback = Context> = InferInputSchema<TSchema, TFallback> extends infer INPUT
	? unknown extends INPUT ? string extends keyof TFallback ? Record<string, unknown> : TFallback : ObjectContextInput<INPUT> : never;

type ObjectContextInput<T> = T extends readonly unknown[] | ((...args: any[]) => any) ? never : T extends object ? T : never;
export type ValidateContextInputSchema<TSchema, INPUT = InferInputSchema<TSchema, Context>> = unknown extends INPUT ? unknown
	: [ObjectContextInput<INPUT>] extends [never] ? 'Config Error: inputSchema must accept an object context before parsing.' : unknown;

export type ContextFromSchema<TSchema> = TSchema extends FlexibleSchema<infer CONTEXT> ? CONTEXT : undefined;

export type FunctionImplementation<
	InputSchema extends SchemaType<Record<string, any>> | undefined,
	OutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	ExecuteFunction extends (...args: any) => any = (...args: any) => any,
> = (context: import('./application.js').ExecutionContext<{ inputSchema: InputSchema; context: CONTEXT }>) => OutputSchema extends SchemaType<any>
	? InferInputSchema<OutputSchema> | PromiseLike<InferInputSchema<OutputSchema>> : ReturnType<ExecuteFunction>;

export type FunctionToolImplementation<
	InputSchema extends SchemaType<Record<string, any>>,
	OutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	ExecuteFunction extends (...args: any) => any = (...args: any) => any,
	TOOL_CONTEXT = undefined,
> = (context: import('./application.js').ToolExecutionContext<{ inputSchema: InputSchema; context: CONTEXT; toolContextSchema: TOOL_CONTEXT extends undefined ? undefined : FlexibleSchema<TOOL_CONTEXT> }>) => OutputSchema extends SchemaType<any>
	? InferInputSchema<OutputSchema> | PromiseLike<InferInputSchema<OutputSchema>> : ReturnType<ExecuteFunction>;

// Define the possible prompt types
export type TemplatePromptType = 'async-template' | 'async-template-name';
export type ScriptPromptType = 'async-script' | 'async-script-name';
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
	GenerateObjectEndEvent<InferSchema<SCHEMA>>;

export type StreamTextOnFinishEvent<TOOLS extends ToolSet = Record<string, never>, OUTPUT extends AIOutput = AIOutput<string, string, never>, RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>> =
	Parameters<StreamTextOnEndCallback<TOOLS, RUNTIME_CONTEXT, OUTPUT>>[0];


export type CascadaFilters = Record<string, (input: any, ...args: any[]) => any>;

export type CascadaLoaders = ILoaderAny | ILoaderAny[];
export type CasaiAILoaders = ILoaderAny | RaceGroup | RaceLoader | (ILoaderAny | RaceGroup | RaceLoader)[];
