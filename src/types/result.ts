import type { JSONValue, FlexibleSchema, ToolExecuteFunction, GenerateObjectResult, GenerateTextResult, InferGenerateOutput, ModelMessage, OutputInterface, StreamObjectResult, StreamTextResult, ToolSet } from 'ai';
import type { NativeGenerateObjectResult, NativeStreamObjectResult } from './sdk.js';

import type { DefaultTextOutput, InferSchema } from './types.js';
import type { ConfigValue, ToolContextFromConfig } from './config.js';
import type { FunctionTool } from '@ai-sdk/provider-utils';

export type { AIOutput } from './types.js';
export type { GenerateTextResult, StreamTextResult } from 'ai';

export type ScriptResult = unknown;

type ElementValues<V> = V extends AsyncIterable<infer E> | Iterable<infer E> ? AsyncIterable<E> : never;
type StreamValueForName<N extends string, V> = string extends N ? Promise<V> | AsyncIterable<V> | ElementValues<V>
	: N extends 'text' ? AsyncIterable<V> : N extends 'array' ? ElementValues<V> : Promise<V>;
// Distribute over output unions before deciding delivery. An erased name can denote any custom output kind.
type StreamValue<O extends OutputInterface> = O extends unknown ? StreamValueForName<O['name'], InferGenerateOutput<O>> : never;

// V includes any default output alternative without changing the SDK's O-based property types.
export type GenerateTextResultAugmented<T extends ToolSet = ToolSet, O extends OutputInterface = DefaultTextOutput, C extends Record<string, unknown> = Record<string, unknown>, V extends OutputInterface = O> =
	GenerateTextResult<T, C, O> & { readonly value: InferGenerateOutput<V>, readonly messageHistory: ModelMessage[] };

export type StreamTextResultAugmented<T extends ToolSet = ToolSet, O extends OutputInterface = DefaultTextOutput, C extends Record<string, unknown> = Record<string, unknown>, V extends OutputInterface = O> =
	StreamTextResult<T, C, O> & { readonly value: StreamValue<V>, readonly messageHistory: Promise<ModelMessage[]> };

type ObjectResultWithValue<Result extends { readonly object: unknown }> = Result & { readonly value: Result['object'] };
export type GenerateObjectResultAugmented<O> = ObjectResultWithValue<GenerateObjectResult<O>>;
export type StreamObjectResultAugmented<P, O, E> = ObjectResultWithValue<StreamObjectResult<P, O, E>>;

//these are returned in a Promise
export type GenerateObjectResultAll<
	OUTPUT, //@out
	ENUM extends string = string
> =
	| GenerateObjectObjectResult<OUTPUT>
	| GenerateObjectArrayResult<OUTPUT>
	| GenerateObjectEnumResult<ENUM>
	| GenerateObjectNoSchemaResult;

export type GenerateObjectObjectResult<OUTPUT> = ObjectResultWithValue<NativeGenerateObjectResult<FlexibleSchema<OUTPUT>, 'object'>>;
export type GenerateObjectArrayResult<OUTPUT> = ObjectResultWithValue<NativeGenerateObjectResult<FlexibleSchema<OUTPUT>, 'array'>>;
export type GenerateObjectEnumResult<ENUM extends string> = ObjectResultWithValue<NativeGenerateObjectResult<FlexibleSchema<ENUM>, 'enum'>>;
export type GenerateObjectNoSchemaResult = ObjectResultWithValue<NativeGenerateObjectResult<FlexibleSchema<JSONValue>, 'no-schema'>>;

export type StreamObjectResultAll<OUTPUT> =
	| StreamObjectObjectResult<OUTPUT>
	| StreamObjectArrayResult<OUTPUT>
	| StreamObjectNoSchemaResult;

//These are returned as is without a promise, many of the properties are promises,
//this allows accessing individual fields as they arrive, rather than waiting for the entire object to complete.
export type StreamObjectObjectResult<OUTPUT> = ObjectResultWithValue<NativeStreamObjectResult<FlexibleSchema<OUTPUT>, 'object'>>;
export type StreamObjectArrayResult<OUTPUT> = ObjectResultWithValue<NativeStreamObjectResult<FlexibleSchema<OUTPUT>, 'array'>>;
export type StreamObjectNoSchemaResult = ObjectResultWithValue<NativeStreamObjectResult<FlexibleSchema<JSONValue>, 'no-schema'>>;

// Native descriptor arguments are parsed. Ordinary calls retain raw input types.
export type ComponentToolFromConfig<INPUT, OUTPUT, TConfig> = ComponentTool<InferSchema<ConfigValue<TConfig, 'inputSchema'>, INPUT>, OUTPUT, ToolContextFromConfig<TConfig>> & {
	bindToolContext: import('./application.js').BindToolContext<TConfig, OUTPUT>;
};
export type ComponentTool<INPUT, OUTPUT, TOOL_CONTEXT = undefined> =
	Omit<FunctionTool<INPUT, OUTPUT, TOOL_CONTEXT>, 'execute' | 'outputSchema'> & Required<Pick<FunctionTool<INPUT, OUTPUT, TOOL_CONTEXT>, 'type'>> & {
	execute: (...args: Parameters<ToolExecuteFunction<INPUT, OUTPUT, TOOL_CONTEXT>>) => PromiseLike<OUTPUT>;
};
