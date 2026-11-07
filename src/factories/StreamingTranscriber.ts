import type { PromptType } from '../types/prompt.js';
import type { ConfigForMode } from '../types/factory-config.js';
import type { CallableComponent, SourceArguments, SourceSettings, BaseRunSettings, AudioFormatArguments, RequiredSetting } from '../types/component.js';
import { experimental_streamTranscribe } from 'ai';
import type { StreamTranscriptionResult } from 'ai';
import { createComponentFactory, audioModifiers, preparedModes } from './component-factory.js';
import { createComponentRuntime } from '../runtime/component-call.js';
import type { RuntimeComponentConfig } from '../runtime/component-call.js';
import type { ToolInvocation } from '../types/execution.js';
import type { Fields } from '../types/utils.js';
import { claimLiveInput } from '../runtime/live-input.js';
import { isPlainObject } from '../schema.js';
import type { TranscriptSnapshot } from './Transcriber.js';

type Settings = Omit<Parameters<typeof experimental_streamTranscribe>[0], '_internal'>;
export const definition = {
	name: 'StreamingTranscriber', defaultMode: 'text', main: 'audio', modifiers: audioModifiers, toolModes: preparedModes, required: ['model'], toolRequired: ['inputAudioFormat'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;

async function transcript(result: StreamTranscriptionResult) {
	const [text, segments, language, durationInSeconds] = await Promise.all([
		result.text, result.segments, result.language, result.durationInSeconds,
	]);
	return { text, segments, language, durationInSeconds };
}

export interface Calls<P extends PromptType, T> {
	arguments: SourceArguments<'StreamingTranscriber', P, T, AudioFormatArguments<T, Settings['inputAudioFormat']>>;
	settings: BaseRunSettings<'StreamingTranscriber', T, SourceSettings<'StreamingTranscriber', P, T> & RequiredSetting<T, 'inputAudioFormat', Settings['inputAudioFormat']>>;
}

export interface Types<P extends PromptType, T, A extends boolean> {
	definition: typeof definition;
	settings: Settings;
	component: CallableComponent<'StreamingTranscriber', P, T, A, { [M in P]: Calls<M, ConfigForMode<T, M, P>> }>;
	result: StreamTranscriptionResult;
	toolResult: TranscriptSnapshot;
}

function createStreamingTranscriber(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields, tool?: ToolInvocation) {
		const settings = runtime.request(await runtime.prepare(raw, tool)) as Settings;
		claimLiveInput(settings.audio);
		const result = experimental_streamTranscribe(settings);
		return tool ? transcript(result) : result;
	}
	return runtime.callable(invoke, args => {
		const call = runtime.arguments(args, { literal: first => !isPlainObject(first) && typeof first !== 'string' });
		call.take('inputAudioFormat', isPlainObject);
		return call.done();
	}, ({ output }) => ({ type: 'text', value: (output as { text: string }).text }));
}

type Factory = import('./component-factory.js').SourceFactory<'StreamingTranscriber'>;
/** @experimental Uses the AI SDK's experimental streaming transcription API. */
export const StreamingTranscriber = createComponentFactory(definition, createStreamingTranscriber) as Factory;
