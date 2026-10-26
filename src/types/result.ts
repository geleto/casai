import type { DefaultTextOutput, NativeGenerateObjectResult, NativeStreamObjectResult } from './sdk.js';
import type { InferSchema } from './schema.js';
import type { ConfigValue } from './config.js';
import type { FlexibleSchema, JSONValue, GenerateObjectResult, GenerateTextResult, InferGenerateOutput, ModelMessage, OutputInterface, StreamTextResult, ToolSet } from 'ai';
import type { ParsedSchemaOutput } from './schema-shape.js';
import type { StreamSchema } from '../streams.js';

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

// Preserve the SDK's distinct partial and element types for each output mode.
export type StreamObjectResultFromConfig<Config> = Config extends { output: 'no-schema' } ? StreamObjectNoSchemaResult
	: Config extends { output: 'array' } ? StreamObjectArrayResult<InferSchema<ConfigValue<Config, 'schema'>>>
	: StreamObjectObjectResult<InferSchema<ConfigValue<Config, 'schema'>>>;

export type ComponentResult<TConfig, TOutputSchema = ConfigValue<TConfig, 'schema'>> = TOutputSchema extends FlexibleSchema<unknown> ? ParsedSchemaOutput<TOutputSchema>
	: TConfig extends { execute: (...args: any[]) => infer TResult } ? Awaited<TResult> : unknown;

export type CollectedResult<TConfig, TOutputSchema = ConfigValue<TConfig, 'schema'>> = TOutputSchema extends StreamSchema<any, infer TElement, infer TKind> ? TKind extends 'text' ? string : TElement[] : ComponentResult<TConfig, TOutputSchema>;
