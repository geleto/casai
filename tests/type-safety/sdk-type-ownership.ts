import type { EmptyMap } from './assert.js';
// Compare complete native surfaces; Casai owns only its documented preparation and delivery additions.
import { Output, type generateText, type streamText, type ToolExecuteFunction, type ToolExecutionOptions } from 'ai';
import type { LLMAgentConfig, PrepareCallRequest, PrepareStep, ComponentTool, ComponentExecutionOptions, GenerateTextResult, StreamTextResult } from 'casai';
import { expectEqual, expectType } from './assert.js';

const output = Output.text();
type Native = Parameters<typeof streamText<EmptyMap, { requestId: string }, typeof output>>[0];
type Config = LLMAgentConfig<EmptyMap, EmptyMap, string, typeof output, { requestId: string }>;
// The public config drops native conversation/signal/aliases, and owns preparation and tool binding.
type Changed = 'prompt' | 'messages' | 'abortSignal' | 'tools' | 'toolsContext' | 'prepareStep' | 'output';
type Shared = Exclude<keyof Native & keyof Config, Changed>;
expectEqual<Pick<Config, Shared>, Pick<Native, Shared>>();
type Removed = 'system' | 'experimental_telemetry' | 'experimental_repairToolCall' | 'experimental_include' | 'includeRawChunks'
	| 'experimental_onStart' | 'experimental_onStepStart' | 'onStepFinish' | 'onFinish' | 'experimental_onLanguageModelCallStart' | 'experimental_onLanguageModelCallEnd' | 'experimental_onToolCallStart' | 'experimental_onToolCallFinish' | '_internal';
expectEqual<Extract<keyof Config, Removed | 'options' | 'callOptionsSchema'>, never>();
expectEqual<Exclude<keyof Native, keyof Config | Changed | Removed>, never>();

interface Definition { tools: EmptyMap; runtimeContext: { requestId: string }; output: typeof output }
type Request = PrepareCallRequest<Definition>;
type Protected = 'output' | 'abortSignal' | 'toolApproval' | 'experimental_toolApprovalSecret' | 'telemetry'
	| 'onStart' | 'onStepStart' | 'onLanguageModelCallStart' | 'onLanguageModelCallEnd' | 'onToolExecutionStart'
	| 'onToolExecutionEnd' | 'onStepEnd' | 'onEnd' | 'onChunk' | 'onAbort';
expectEqual<Extract<keyof Request, Protected | Removed | 'prompt' | 'options' | 'context'>, never>();
type Editable = Exclude<keyof Native & keyof Request, 'messages' | 'toolsContext' | 'prepareStep'>;
expectEqual<Pick<Request, Editable>, Pick<Native, Editable>>();
expectEqual<Parameters<PrepareStep<Definition>>[0], Parameters<NonNullable<Native['prepareStep']>>[0]>();
expectEqual<ReturnType<PrepareStep<Definition>>, ReturnType<NonNullable<Native['prepareStep']>>>();

expectEqual<Omit<GenerateTextResult<EmptyMap, typeof output, { requestId: string }>, 'value' | 'messageHistory'>,
	Awaited<ReturnType<typeof generateText<EmptyMap, { requestId: string }, typeof output>>>>();
expectEqual<Omit<StreamTextResult<EmptyMap, typeof output, { requestId: string }>, 'value' | 'messageHistory'>,
	ReturnType<typeof streamText<EmptyMap, { requestId: string }, typeof output>>>();

interface Answer { answer: number }
interface Context { tenant: string }
expectEqual<Parameters<ComponentTool<Answer, number, Context>['execute']>, Parameters<ToolExecuteFunction<Answer, number, Context>>>();
expectEqual<Parameters<ComponentTool<Answer, never, Context>['execute']>, Parameters<ToolExecuteFunction<Answer, never, Context>>>();
expectEqual<ComponentExecutionOptions, Omit<ToolExecutionOptions<unknown>, 'context' | 'toolCallId' | 'messages'> & Partial<Pick<ToolExecutionOptions<unknown>, 'toolCallId' | 'messages'>>>();
declare const options: ComponentExecutionOptions;
expectType<ToolExecutionOptions<unknown>['experimental_sandbox']>(options.experimental_sandbox);



export { output };
