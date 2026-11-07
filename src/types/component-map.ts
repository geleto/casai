import type { PromptType } from './prompt.js';
import type { ToolSet } from 'ai';
import type { NativeInput, SourceComponentConfig, ComponentFactoryShape } from './component.js';

/** One entry per component; each module owns its type contract. */
interface Types<P extends PromptType = PromptType, T = unknown, A extends boolean = false, Input = unknown, Call = undefined, Tools extends ToolSet = ToolSet, Output = unknown> {
	LLMAgent: import('../factories/LLMAgent.js').Types<P, T, A, Input, Tools, Output>;
	Function: import('../factories/Function.js').Types<T, A>;
	Template: import('../factories/Template.js').Types<T, A, Input>;
	Script: import('../factories/Script.js').Types<T, A, Input, Output>;
	Decision: import('../factories/Decision.js').Types<P, T, A>;
	Embedder: import('../factories/Embedder.js').Types<P, T, A, Input>;
	Reranker: import('../factories/Reranker.js').Types<P, T, A, Input, Call>;
	ImageGenerator: import('../factories/ImageGenerator.js').Types<P, T, A>;
	Transcriber: import('../factories/Transcriber.js').Types<P, T, A>;
	StreamingTranscriber: import('../factories/StreamingTranscriber.js').Types<P, T, A>;
	SpeechGenerator: import('../factories/SpeechGenerator.js').Types<P, T, A>;
	StreamingSpeechGenerator: import('../factories/StreamingSpeechGenerator.js').Types<P, T, A>;
	StreamingTranslator: import('../factories/StreamingTranslator.js').Types<P, T, A>;
	VoiceSessionSetup: import('../factories/VoiceSessionSetup.js').Types<P, T, A>;
}

export type Definitions = { [K in keyof Types]: Types[K]['definition'] };
export type ComponentSettings<Runtime extends Record<string, unknown> = Record<string, unknown>> = { [K in keyof Types]: Types<PromptType, { runtimeContext: Runtime }>[K]['settings'] };
export type PreparedInputs = { [K in keyof Types]: Types[K] extends { preparedInput: infer I } ? I : NativeInput<K> };
export type TemplateInputs = { [K in keyof Types]: Types[K] extends { templateInput: infer I } ? I : string };
export type Results<T, Input, Call = undefined> = { [K in keyof Types]: Types<PromptType, T, false, Input, Call>[K]['result'] };
export type ToolResults<T, Input> = { [K in keyof Types]: Types<PromptType, T, false, Input>[K]['toolResult'] };
export type ToolInputs<T> = { [K in keyof Types]: Types<PromptType, T>[K] extends { toolInput: infer Input } ? Input : NativeInput<K> };
export type Components<P extends PromptType, T, A extends boolean> = { [K in keyof Types]: Types<P, T, A>[K]['component'] };
export type Configs<P extends PromptType> = { [K in keyof Types]: Types<P>[K] extends { config: infer C } ? C : SourceComponentConfig<K, P> };
export type ConfigShapes<Tools extends ToolSet, Input extends Record<string, any>, Output> = { [K in keyof Types]: Types<PromptType, unknown, false, Input, undefined, Tools, Output>[K] extends { configShape: infer S } ? S : ComponentFactoryShape<K, PromptType, true> };
export type RunChecks<P extends PromptType, T, R> = { [K in keyof Types]: Types<P, T, false, unknown, R>[K] extends { runCheck: infer Check } ? Check : unknown };
export type ToolRequirements<P extends PromptType, T> = { [K in keyof Types]: Types<P, T>[K] extends { toolRequired: infer Key } ? Key : never };
