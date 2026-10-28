import type { ResolvedOutput } from './sdk.js';
import type { ConfigValue } from './config.js';
import type { FlexibleSchema, GenerateTextResult, InferGenerateOutput, ModelMessage, OutputInterface, StreamTextResult, ToolSet } from 'ai';
import type { ParsedSchemaOutput } from './schema-shape.js';
import type { StreamSchema } from '../streams.js';

export type ScriptResult = unknown;

export type CompletedOutput<O> = O extends OutputInterface ? InferGenerateOutput<O> : string;
type StreamValue<O> = O extends OutputInterface ? Promise<InferGenerateOutput<O>> : AsyncIterable<string>;

// Native SDK properties retain their own delivery types.
export type GenerateTextResultAugmented<T extends ToolSet = ToolSet, O extends OutputInterface | undefined = undefined, C extends Record<string, unknown> = Record<string, unknown>> =
	GenerateTextResult<T, C, ResolvedOutput<O>> & { readonly value: CompletedOutput<O>, readonly messageHistory: ModelMessage[] };

export type StreamTextResultAugmented<T extends ToolSet = ToolSet, O extends OutputInterface | undefined = undefined, C extends Record<string, unknown> = Record<string, unknown>> =
	StreamTextResult<T, C, ResolvedOutput<O>> & { readonly value: StreamValue<O>, readonly messageHistory: Promise<ModelMessage[]> };

export type ComponentResult<TConfig, TOutputSchema = ConfigValue<TConfig, 'schema'>> = TOutputSchema extends FlexibleSchema<unknown> ? ParsedSchemaOutput<TOutputSchema>
	: TConfig extends { execute: (...args: any[]) => infer TResult } ? Awaited<TResult> : unknown;

export type CollectedResult<TConfig, TOutputSchema = ConfigValue<TConfig, 'schema'>> = TOutputSchema extends StreamSchema<any, infer TElement, infer TKind> ? TKind extends 'text' ? string : TElement[] : ComponentResult<TConfig, TOutputSchema>;
