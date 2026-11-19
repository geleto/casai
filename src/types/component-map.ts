import type { PromptType } from './prompt.js';
import type { ToolSet } from 'ai';
import type { NativeInput, SourceComponentConfig, ComponentFactoryShape } from './component.js';

/** One entry per component; each module owns its type contract. */
interface Types<P extends PromptType = PromptType, T = unknown, A extends boolean = false, Input = unknown, Call = undefined, Tools extends ToolSet = ToolSet, Output = unknown> {
	LLMAgent: import('../factories/LLMAgent.js').Types<P, T, A, Input, Tools, Output>;
	Function: import('../factories/Function.js').Types<T, A>;
	Template: import('../factories/Template.js').Types<P, T, A, Input>;
	Script: import('../factories/Script.js').Types<P, T, A, Input, Output>;
	Decision: import('../factories/Decision.js').Types<P, T, A>;
	Embedder: import('../factories/Embedder.js').Types<P, T, A, Input>;
	Reranker: import('../factories/Reranker.js').Types<P, T, A, Input, Call>;
	ImageGenerator: import('../factories/ImageGenerator.js').Types<P, T, A>;
	Transcriber: import('../factories/Transcriber.js').Types<P, T, A, Input, Call>;
	SpeechGenerator: import('../factories/SpeechGenerator.js').Types<P, T, A, Input, Call>;
	Translator: import('../factories/Translator.js').Types<P, T, A, Input, Call>;
	VoiceAgentBackend: import('../factories/VoiceAgentBackend.js').Types<P, T, A>;
}

export type Definitions = { [K in keyof Types]: Types[K]['definition'] };
export type ComponentSettings<Runtime extends Record<string, unknown> = Record<string, unknown>, T = unknown> = {
	[K in keyof Types]: unknown extends T ? Types<PromptType, { runtimeContext: Runtime }>[K]['settings']
		: Types<PromptType, T & { runtimeContext: Runtime }>[K] extends { selectedSettings: infer S } ? S : Types<PromptType, { runtimeContext: Runtime }>[K]['settings']
};
export type PreparedInputs = { [K in keyof Types]: Types[K] extends { preparedInput: infer I } ? I : NativeInput<K> };
export type PreparedInput<K extends keyof Types, Input, T> = K extends 'ImageGenerator' ? import('../factories/ImageGenerator.js').PreparedImageInput<T>
	: Types[K] extends { preparedInput: infer I } ? I : Input;
export type TemplateInputs = { [K in keyof Types]: Types[K] extends { templateInput: infer I } ? I : string };
export type Results<T, Input, Call = undefined> = { [K in keyof Types]: Types<PromptType, T, false, Input, Call>[K]['result'] };
export type ToolResults<T, Input> = { [K in keyof Types]: Types<PromptType, T, false, Input>[K]['toolResult'] };
export type ToolInputs<T> = { [K in keyof Types]: Types<PromptType, T>[K] extends { toolInput: infer Input } ? Input : NativeInput<K> };
export type Components<P extends PromptType, T, A extends boolean> = { [K in keyof Types]: Types<P, T, A>[K]['component'] };
type ConfigSource<K extends keyof Types, P> = P extends PromptType ? P : Exclude<Definitions[K]['defaultMode'], undefined>;
// Keep source alternatives separate so only loaded annotations require a loader.
export type Configs<P extends PromptType | undefined, Stream extends boolean = false> = P extends unknown ? { [K in keyof Types]:
	(Types<ConfigSource<K, P>, Stream extends true ? import('../config/modifiers.js').EnabledStreamMode : unknown>[K] extends { config: infer C } ? C : SourceComponentConfig<K, ConfigSource<K, P>>)
	& import('../audio/preparation.js').LoadedFormatAnnotation<P>
	& (Extract<ConfigSource<K, P>, `${string}-name`> extends never ? unknown : import('./config.js').LoaderConfig) } : never;
export type ConfigShapes<Tools extends ToolSet, Input extends Record<string, any>, Output> = { [K in keyof Types]: Types<PromptType, unknown, false, Input, undefined, Tools, Output>[K] extends { configShape: infer S } ? S : ComponentFactoryShape<K, PromptType, true> };
// Only components with an operation-specific rule need their resolved invocation inputs.
export type CheckedComponent<Key extends 'callCheck' | 'runCheck' | 'toolCheck'> = { [K in keyof Types]: Key extends keyof Types[K] ? K : never }[keyof Types];
export type RunChecks<P extends PromptType, T, R> = { [K in CheckedComponent<'runCheck'>]: Types<P, T, false, unknown, R>[K]['runCheck'] };
export type CallChecks<P extends PromptType, T, Input, Call> = { [K in CheckedComponent<'callCheck'>]: Types<P, T, false, Input, Call>[K]['callCheck'] };
export type ToolRequirements<P extends PromptType, T> = { [K in keyof Types]: Types<P, T>[K] extends { toolRequired: infer Key } ? Key : never };
export type ToolChecks<P extends PromptType, T, Input> = { [K in CheckedComponent<'toolCheck'>]: Types<P, T, true, Input>[K]['toolCheck'] };
