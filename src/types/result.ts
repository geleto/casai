import {
	GenerateObjectResult, StreamObjectResult, JSONValue, DeepPartial,
} from 'ai';
import type {
	GenerateTextResult,
	StreamTextResult,
	ToolExecutionOptions,
	ToolSet,
	ModelMessage,
} from 'ai';

import type { InferSchema, SchemaType } from './types.js';
import type { ContextSchemaConfig, DeclaredType, ToolContextFromConfig } from './config.js';

import { AIOutput } from './types.js';
export { AIOutput };

// Result types
export type {
	// Keep object-related exports as-is
	GenerateTextResult,
	StreamTextResult,
} from 'ai';

export type ScriptResult = JSONValue;//@todo - remove, RESULT can be any type (union, etc...)

export type AugmentedResponse<RESPONSE> = Omit<RESPONSE, 'messages'> & {
	messages: ModelMessage[];
	messageHistory: ModelMessage[];
};

// Augmented text result types with lazy messages and messageHistory.
export type GenerateTextResultAugmented<TOOLS extends ToolSet = ToolSet, OUTPUT extends AIOutput = AIOutput, RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>> =
	Omit<GenerateTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>, 'response'> & {
		response: AugmentedResponse<GenerateTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>['response']>;
	};

export type StreamTextResultAugmented<TOOLS extends ToolSet = ToolSet, OUTPUT extends AIOutput = AIOutput, RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>> =
	Omit<StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>, 'response'> & {
		response: Promise<AugmentedResponse<Awaited<StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>['response']>>>;
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

export type GenerateObjectObjectResult<OUTPUT> = GenerateObjectResult<OUTPUT>;
export type GenerateObjectArrayResult<OUTPUT> = GenerateObjectResult<OUTPUT[]>;
export type GenerateObjectEnumResult<ENUM extends string> = GenerateObjectResult<ENUM>;
export type GenerateObjectNoSchemaResult = GenerateObjectResult<JSONValue>;

export type StreamObjectResultAll<OUTPUT> =
	| StreamObjectObjectResult<OUTPUT>
	| StreamObjectArrayResult<OUTPUT>
	| StreamObjectNoSchemaResult;

//These are returned as is without a promise, many of the properties are promises,
//this allows accessing individual fields as they arrive, rather than waiting for the entire object to complete.
export type StreamObjectObjectResult<OUTPUT> = StreamObjectResult<DeepPartial<OUTPUT>, OUTPUT, never>;
export type StreamObjectArrayResult<OUTPUT> = StreamObjectResult<OUTPUT[], OUTPUT[], AsyncIterableStream<OUTPUT>>;
export type StreamObjectNoSchemaResult = StreamObjectResult<JSONValue, JSONValue, never>;

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
