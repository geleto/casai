import {
	GenerateObjectResult, StreamObjectResult, JSONValue, DeepPartial,
} from 'ai';
import type {
	GenerateTextResult,
	StreamTextResult,
	ToolCallOptions,
	ToolSet,
	ModelMessage,
} from 'ai';
import { Output as AIOutputValues } from 'ai';
import { SchemaType } from './types';

// Extract the Output interface from the return type of the helper function
// This avoids copy-pasting the interface definition
export type AIOutput = ReturnType<typeof AIOutputValues.object>;

// Result types
export type {
	// Keep object-related exports as-is
	GenerateTextResult,
	StreamTextResult,
} from 'ai';

export type ScriptResult = JSONValue;//@todo - remove, RESULT can be any type (union, etc...)

// Augmented text result types with lazy messageHistory
// Augmented text result types with lazy messageHistory
export type GenerateTextResultAugmented<TOOLS extends ToolSet = ToolSet, OUTPUT extends AIOutput = AIOutput> =
	GenerateTextResult<TOOLS, OUTPUT> & {
		response: GenerateTextResult<TOOLS, OUTPUT>['response'] & {
			messageHistory: ModelMessage[];
		};
	};

export type StreamTextResultAugmented<TOOLS extends ToolSet = ToolSet, OUTPUT extends AIOutput = AIOutput> =
	StreamTextResult<TOOLS, OUTPUT> & {
		response: StreamTextResult<TOOLS, OUTPUT>['response'] extends PromiseLike<infer R>
		? Promise<R & { messageHistory: ModelMessage[] }>
		: StreamTextResult<TOOLS, OUTPUT>['response'];
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

export interface ComponentTool<INPUT, OUTPUT> {
	description?: string;
	inputSchema: SchemaType<INPUT>;
	execute: (args: INPUT, options: ToolCallOptions) => PromiseLike<OUTPUT>;
	type?: 'function';
}