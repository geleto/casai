import type { ModelMessage, Schema, GenerateObjectEndEvent, StreamTextOnEndCallback, ToolExecutionOptions, FlexibleSchema, ToolSet, Output } from 'ai';//do not confuze the 'ai' Schema type with the 'zod' Schema type
import { z } from 'zod';
import type { ILoaderAny } from 'cascada-engine';
import type { RaceGroup, RaceLoader } from '../loaders.js';
import type { AugmentedResponse } from './result.js';
import type { EmptyMap } from './merge.js';
import type { ValidateContextValue } from './input.js';

export type AIOutput<OUTPUT = any, PARTIAL = any, ELEMENT = any> = Output.Output<OUTPUT, PARTIAL, ELEMENT>;

// Template types
export type Context = Record<string, any>;
export type Filters = Record<string, (input: any, ...args: any[]) => any>;

// export type SchemaType<T> = z.Schema<T, z.ZodTypeDef, any> | Schema<T>;
export type SchemaType<T> =
	| z.ZodType<T, any>
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

// Ordinary component calls validate input without replacing it with parsed Zod output.
// Annotated schemas may leave their input generic as any; retain their declared output contract then.
export type InferInputSchema<TSchema, TFallback = unknown> = TSchema extends { _input: infer INPUT }
	? 0 extends (1 & INPUT) ? InferSchema<TSchema, TFallback> : INPUT
	: InferSchema<TSchema, TFallback>;

// Preprocessors can accept unknown values, but component context arguments are objects.
// An EmptyMap fallback lets callers distinguish known schema keys from an open input shape.
export type InferContextInputSchema<TSchema, TFallback = Context> = InferInputSchema<TSchema, TFallback> extends infer INPUT
	? unknown extends INPUT ? string extends keyof TFallback ? Record<string, unknown> : TFallback : ObjectContextInput<INPUT> : never;

type ObjectContextInput<T> = T extends readonly unknown[] | ((...args: any[]) => any) ? never : T extends object ? T : never;
export type ValidateContextInputSchema<TSchema, INPUT = InferInputSchema<TSchema, Context>> = unknown extends INPUT ? unknown
	: [ObjectContextInput<INPUT>] extends [never] ? 'Config Error: inputSchema must accept an object context before parsing.' : unknown;

export type ContextFromSchema<TSchema> = TSchema extends FlexibleSchema<infer CONTEXT> ? CONTEXT : undefined;

// Type for the callable function (caller)
// no context, only input as argumnent
// if no output is specified, it is inferred from the execute function
export type FunctionCaller<
	INPUT,
	OutputSchema extends SchemaType<any> | undefined,
	ExecuteFunction extends (...args: any) => any,
	FunctionOutput = OutputSchema extends SchemaType<any>
	? InferSchema<OutputSchema, any>
	: ReturnType<ExecuteFunction>//the return type of the execute function
> =
	<TInput extends INPUT = INPUT>(...args: (EmptyObject extends INPUT ? [input?: TInput] : [input: TInput]) & NoInfer<ValidateContextValue<TInput>>)
		=> /*AsyncIterable<OUTPUT> |*/ PromiseLike<FunctionOutput> | FunctionOutput;

// Type for the implementation function - has input and context as arguments
// if there is output schema - we use it as the return type
export type FunctionImplementation<
	InputSchema extends SchemaType<Record<string, any>> | undefined,
	OutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	ExecuteFunction extends (...args: any) => any = (...args: any) => any
> =
	(input: InputWithContext<InferContextInputSchema<InputSchema, Record<string, any>>, CONTEXT, InputSchema, true>)
		=> OutputSchema extends SchemaType<any>
		? /*AsyncIterable<OUTPUT> |*/ PromiseLike<InferInputSchema<OutputSchema, any>> | InferInputSchema<OutputSchema, any>
		: ReturnType<ExecuteFunction>;//no output schema - infer from implementation or default to any

export type FunctionToolCaller<
	InputSchema extends SchemaType<Record<string, any>>,
	OutputSchema extends SchemaType<any> | undefined,
	//TConfig extends configs.FunctionToolConfig<InputSchema, OutputSchema, undefined>,
	ExecuteFunction extends (...args: any) => any,
	TOOL_CONTEXT = undefined,
	FunctionOutput = OutputSchema extends SchemaType<any>
	? InferSchema<OutputSchema, any>
	: ReturnType<ExecuteFunction>//the return type of the execute function
> =
	(input: InferSchema<InputSchema, Record<string, any>>, options: ToolExecutionOptions<TOOL_CONTEXT>)
		=> Promise<Awaited<FunctionOutput>>;

// Type for the implementation function - has input and context as arguments
// if there is output schema - we use it as the return type
export type FunctionToolImplementation<
	InputSchema extends SchemaType<Record<string, any>>,
	OutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	ExecuteFunction extends (...args: any) => any = (...args: any) => any,
	TOOL_CONTEXT = undefined,
> =
	(input: InputWithContext<InferSchema<InputSchema>, CONTEXT, InputSchema>,
		options: ToolExecutionOptions<NoInfer<TOOL_CONTEXT>>) => OutputSchema extends SchemaType<any>
		? PromiseLike<InferInputSchema<OutputSchema, any>> | InferInputSchema<OutputSchema, any>
		: ReturnType<ExecuteFunction>;

type ContextWithoutInput<CONTEXT, INPUT> = CONTEXT extends unknown ? Omit<CONTEXT, keyof INPUT> : never;
type ContextKeys<CONTEXT> = CONTEXT extends unknown ? keyof CONTEXT : never;
type IsUnion<T, Whole = T> = T extends Whole ? [Whole] extends [T] ? false : true : never;
type StableContextKeys<CONTEXT, Whole = CONTEXT> = {
	[K in keyof CONTEXT & keyof Whole]-?: false extends (CONTEXT extends unknown ? [Whole[K]] extends [CONTEXT[K]] ? true : false : never) ? never : K;
}[keyof CONTEXT & keyof Whole];
// Partial discriminator changes can invalidate fields from the configured union's other branch.
type ContextOverrides<CONTEXT> = true extends IsUnion<CONTEXT>
	? CONTEXT | (Partial<Pick<CONTEXT, StableContextKeys<CONTEXT>>> & Partial<Record<Exclude<ContextKeys<CONTEXT>, StableContextKeys<CONTEXT>>, never>>)
	: Partial<CONTEXT>;
type ContextAfterInput<CONTEXT, INPUT, OptionalContext extends boolean> = [NonNullable<CONTEXT>] extends [never] ? unknown
	: OptionalContext extends true ? ContextOverrides<ContextWithoutInput<NonNullable<CONTEXT>, INPUT>>
	: undefined extends CONTEXT ? Partial<ContextWithoutInput<NonNullable<CONTEXT>, INPUT>> : ContextWithoutInput<NonNullable<CONTEXT>, INPUT>;

// Each union branch replaces its own configured fields before context is merged.
export type InputWithContext<INPUT, CONTEXT, SCHEMA, Raw extends boolean = false, OptionalContext extends boolean = false> = INPUT extends unknown
	? INPUT & ContextAfterInput<CONTEXT, SCHEMA extends SchemaType<any>
		? Raw extends true ? unknown extends InferInputSchema<SCHEMA> ? EmptyMap : INPUT : INPUT : EmptyMap, OptionalContext>
	: never;

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

type SDKStreamTextOnFinishEvent<TOOLS extends ToolSet> = Parameters<StreamTextOnEndCallback<TOOLS>>[0];

export type StreamTextOnFinishEvent<TOOLS extends ToolSet = Record<string, never>> =
	Omit<SDKStreamTextOnFinishEvent<TOOLS>, 'response'> & {
		response: AugmentedResponse<SDKStreamTextOnFinishEvent<TOOLS>['response']>;
	};

export type EmptyObject = Record<string, never>;

export type CascadaFilters = Record<string, (input: any, ...args: any[]) => any>;

export type CascadaLoaders = ILoaderAny | ILoaderAny[];
export type CasaiAILoaders = ILoaderAny | RaceGroup | RaceLoader | (ILoaderAny | RaceGroup | RaceLoader)[];
