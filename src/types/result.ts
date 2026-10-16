import type { JSONValue, DeepPartial, ToolExecutionOptions, GenerateObjectResult, GenerateTextResult, InferGenerateOutput, ModelMessage, OutputInterface, StreamObjectResult, StreamTextResult, ToolSet } from 'ai';

import type { DefaultTextOutput, InferSchema, SchemaType } from './types.js';
import type { ContextSchemaConfig, DeclaredType, ToolContextFromConfig } from './config.js';

export type { AIOutput } from './types.js';
export type { GenerateTextResult, StreamTextResult } from 'ai';

export type ScriptResult = JSONValue;//@todo - remove, RESULT can be any type (union, etc...)

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

export type GenerateObjectResultAugmented<O> = GenerateObjectResult<O> & { readonly value: O };
export type StreamObjectResultAugmented<P, O, E> = StreamObjectResult<P, O, E> & {
	readonly value: Promise<O>;
};

//these are returned in a Promise
export type GenerateObjectResultAll<
	OUTPUT, //@out
	ENUM extends string = string
> =
	| GenerateObjectObjectResult<OUTPUT>
	| GenerateObjectArrayResult<OUTPUT>
	| GenerateObjectEnumResult<ENUM>
	| GenerateObjectNoSchemaResult;

export type GenerateObjectObjectResult<OUTPUT> = GenerateObjectResultAugmented<OUTPUT>;
export type GenerateObjectArrayResult<OUTPUT> = GenerateObjectResultAugmented<OUTPUT[]>;
export type GenerateObjectEnumResult<ENUM extends string> = GenerateObjectResultAugmented<ENUM>;
export type GenerateObjectNoSchemaResult = GenerateObjectResultAugmented<JSONValue>;

export type StreamObjectResultAll<OUTPUT> =
	| StreamObjectObjectResult<OUTPUT>
	| StreamObjectArrayResult<OUTPUT>
	| StreamObjectNoSchemaResult;

//These are returned as is without a promise, many of the properties are promises,
//this allows accessing individual fields as they arrive, rather than waiting for the entire object to complete.
export type StreamObjectObjectResult<OUTPUT> = StreamObjectResultAugmented<DeepPartial<OUTPUT>, OUTPUT, never>;
export type StreamObjectArrayResult<OUTPUT> = StreamObjectResultAugmented<OUTPUT[], OUTPUT[], AsyncIterableStream<OUTPUT>>;
export type StreamObjectNoSchemaResult = StreamObjectResultAugmented<JSONValue, JSONValue, never>;

type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>;

// A tool's input follows its final input schema; INPUT is only the fallback for configs without one.
export type ComponentToolFromConfig<INPUT, OUTPUT, TConfig> = ComponentTool<
	InferSchema<DeclaredType<TConfig, 'inputSchema'>, INPUT>, OUTPUT, ToolContextFromConfig<TConfig>>;

export interface ComponentTool<INPUT, OUTPUT, TOOL_CONTEXT = undefined> extends ContextSchemaConfig<TOOL_CONTEXT> {
	description?: string;
	inputSchema: SchemaType<INPUT>;
	execute: (input: INPUT, options: ToolExecutionOptions<TOOL_CONTEXT>) => PromiseLike<OUTPUT>;
	type?: 'function';
}
