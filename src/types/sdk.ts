import type { asSchema, Output, StreamTextOnEndCallback, generateText, streamText, generateObject, streamObject, FlexibleSchema, OutputInterface, PrepareStepFunction, ToolExecutionOptions, ToolSet } from 'ai';
import type { InferSchema } from './schema.js';
import type { UnionKeys } from './utils.js';

// SDK contracts used by the implementation, kept separate from execution code.
export type PrepareStep = PrepareStepFunction<ToolSet>;
export type PrepareStepOptions = Parameters<PrepareStep>[0];

/** Invocation metadata. Parsed trusted context is already in the component context. */
// The SDK's context generic affects only the omitted context property.
export type ComponentExecutionOptions = Omit<ToolExecutionOptions<unknown>, 'context' | 'toolCallId' | 'messages'>
	& Partial<Pick<ToolExecutionOptions<unknown>, 'toolCallId' | 'messages'>>;

export type GenerateRequest<Tools extends ToolSet = ToolSet, RuntimeContext extends Record<string, unknown> = Record<string, unknown>, Output extends OutputInterface = OutputInterface> =
	Parameters<typeof generateText<Tools, RuntimeContext, Output>>[0];

export type StreamRequest<Tools extends ToolSet = ToolSet, RuntimeContext extends Record<string, unknown> = Record<string, unknown>, Output extends OutputInterface = OutputInterface> =
	Parameters<typeof streamText<Tools, RuntimeContext, Output>>[0];

export type ObjectOutputMode = NonNullable<Parameters<typeof generateObject>[0]['output']>;
export type GenerateObjectRequest<Schema extends FlexibleSchema<unknown> = FlexibleSchema<unknown>, Mode extends ObjectOutputMode = ObjectOutputMode, Result = unknown> =
	Parameters<typeof generateObject<Schema, Mode, Result>>[0];
export type StreamObjectRequest<Schema extends FlexibleSchema<unknown> = FlexibleSchema<unknown>, Mode extends ObjectOutputMode = ObjectOutputMode, Result = unknown> =
	Parameters<typeof streamObject<Schema, Mode, Result>>[0];

// Native settings that exist only for particular object output modes.
export type ObjectOutputSettingKeys = Exclude<UnionKeys<GenerateObjectRequest>, keyof GenerateObjectRequest>;

export type NativeGenerateObjectResult<Schema extends FlexibleSchema<unknown>, Mode extends ObjectOutputMode> =
	Awaited<ReturnType<typeof generateObject<Schema, Mode>>>;
export type NativeStreamObjectResult<Schema extends FlexibleSchema<unknown>, Mode extends ObjectOutputMode> =
	ReturnType<typeof streamObject<Schema, Mode>>;

export type ConversationRequest = Partial<Pick<GenerateRequest, 'prompt' | 'messages'>>;

// Extract the callback from the callable API; older named SDK aliases can differ.
export type ObjectFinishCallback<Result, Streaming extends boolean = false> = NonNullable<(
	Streaming extends true
		? StreamObjectRequest<FlexibleSchema<Result>, 'object', Result>
		: GenerateObjectRequest<FlexibleSchema<Result>, 'object', Result>
)['onFinish']>;

export type JSONSchema = Awaited<ReturnType<typeof asSchema>['jsonSchema']>;

export type AIOutput<OUTPUT = any, PARTIAL = any, ELEMENT = any> = Output.Output<OUTPUT, PARTIAL, ELEMENT>;

// The omitted SDK output has a known kind; explicit specifications keep their native types.
export type DefaultTextOutput = ReturnType<typeof Output.text> & { name: 'text' };

export type StreamObjectOnFinishEvent<SCHEMA extends FlexibleSchema<unknown>> =
	Parameters<ObjectFinishCallback<InferSchema<SCHEMA>, true>>[0];

export type StreamTextOnFinishEvent<TOOLS extends ToolSet = Record<string, never>, OUTPUT extends AIOutput = AIOutput<string, string, never>, RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>> =
	Parameters<StreamTextOnEndCallback<TOOLS, RUNTIME_CONTEXT, OUTPUT>>[0];
