import type { ResolvedOutput } from './sdk.js';
import type { ConfigValue } from './config.js';
import type { FlexibleSchema, GenerateTextResult, InferGenerateOutput, ModelMessage, OutputInterface, StreamTextResult, ToolSet } from 'ai';
import type { ParsedSchemaOutput } from './schema-shape.js';
import type { StreamSchema } from '../streams.js';

export type ScriptResult = unknown;

export type CompletedOutput<O> = O extends OutputInterface ? InferGenerateOutput<O> : string;
// Native SDK properties retain their own delivery types.
export type GenerateTextResultAugmented<T extends ToolSet = ToolSet, O extends OutputInterface | undefined = undefined, C extends Record<string, unknown> = Record<string, unknown>> =
	GenerateTextResult<T, C, ResolvedOutput<O>> & { readonly messageHistory: ModelMessage[] };

export type StreamTextResultAugmented<T extends ToolSet = ToolSet, O extends OutputInterface | undefined = undefined, C extends Record<string, unknown> = Record<string, unknown>> =
	StreamTextResult<T, C, ResolvedOutput<O>> & { readonly messageHistory: Promise<ModelMessage[]> };

export type ComponentBranchResult<TConfig, TOutputSchema = ConfigValue<TConfig, 'schema'>> = TOutputSchema extends FlexibleSchema<unknown> ? ParsedSchemaOutput<TOutputSchema>
	: TConfig extends { execute: (...args: any[]) => infer TResult } ? Awaited<TResult> : unknown;

type CollectedBranchResult<TConfig, TOutputSchema = ConfigValue<TConfig, 'schema'>> = TOutputSchema extends StreamSchema<any, infer TElement, infer TKind> ? TKind extends 'text' ? string : TElement[] : ComponentBranchResult<TConfig, TOutputSchema>;

// Select each configuration before deriving its schema and implementation result.
export type ComponentResult<TConfig> = TConfig extends unknown ? ComponentBranchResult<TConfig> : never;
export type CollectedResult<TConfig> = TConfig extends unknown ? CollectedBranchResult<TConfig> : never;
