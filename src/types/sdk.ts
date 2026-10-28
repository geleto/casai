import type { asSchema, Output, StreamTextOnEndCallback, generateText, streamText, OutputInterface, PrepareStepFunction, ToolExecutionOptions, ToolSet } from 'ai';

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

export type ConversationRequest = Partial<Pick<GenerateRequest, 'prompt' | 'messages'>>;

export type JSONSchema = Awaited<ReturnType<typeof asSchema>['jsonSchema']>;

export type AIOutput<OUTPUT = any, PARTIAL = any, ELEMENT = any> = Output.Output<OUTPUT, PARTIAL, ELEMENT>;

// Omitted output uses the SDK's native text type; explicit specifications retain theirs.
export type ResolvedOutput<O extends OutputInterface | undefined> = [Exclude<O, undefined>] extends [never]
	? ReturnType<typeof Output.text> : Exclude<O, undefined>;

export type StreamTextOnFinishEvent<TOOLS extends ToolSet = Record<string, never>, OUTPUT extends AIOutput = AIOutput<string, string, never>, RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>> =
	Parameters<StreamTextOnEndCallback<TOOLS, RUNTIME_CONTEXT, OUTPUT>>[0];
