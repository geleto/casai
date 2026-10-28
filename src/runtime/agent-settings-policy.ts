import type { GenerateRequest, StreamRequest } from '../types/sdk.js';

// Casai's overlapping policies for SDK dispatch, configuration validation and hook types.
type NativeSetting = keyof StreamRequest;
type NativeObserver = Extract<NativeSetting, `on${string}` | `experimental_on${string}`>;

export const observers = ['onStart', 'onStepStart', 'onLanguageModelCallStart', 'onLanguageModelCallEnd',
	'onToolExecutionStart', 'onToolExecutionEnd', 'onStepEnd', 'onEnd', 'onChunk', 'onAbort'] as const satisfies readonly NativeObserver[];
export const aliases = { onStart: 'experimental_onStart', onStepStart: 'experimental_onStepStart', onStepEnd: 'onStepFinish', onEnd: 'onFinish',
	onLanguageModelCallStart: 'experimental_onLanguageModelCallStart', onLanguageModelCallEnd: 'experimental_onLanguageModelCallEnd',
	onToolExecutionStart: 'experimental_onToolCallStart', onToolExecutionEnd: 'experimental_onToolCallFinish' } as const satisfies Partial<Record<typeof observers[number], NativeObserver>>;
export const protectedSettings = ['output', 'abortSignal', 'toolApproval', 'experimental_toolApprovalSecret', 'telemetry', ...observers] as const satisfies readonly NativeSetting[];
export const streamingSettings = ['onChunk', 'onAbort', 'onError', 'experimental_transform', 'streamRetries'] as const satisfies readonly Exclude<NativeSetting, keyof GenerateRequest>[];

// Historical names remain explicit even after their SDK declarations disappear.
export const retiredSettings = ['enum', 'schemaName', 'schemaDescription', 'callOptionsSchema', 'system', 'experimental_telemetry',
	'experimental_repairToolCall', 'experimental_include', 'includeRawChunks', 'repairText', 'experimental_repairText', '_internal', ...Object.values(aliases)] as const;
export const agentSourceConflicts = ['template', 'script', 'execute', 'schema'] as const;
export const fixedSettings = ['output', 'inputSchema', 'toolContextSchema', 'promptType', 'filters', 'renderOptions', 'loader', 'id', 'streaming', 'asTool'] as const;
export const incompatibleAgentSettings = ['messages', 'options', 'mode', ...retiredSettings, ...agentSourceConflicts] as const;
