import type { PromptType } from '../types/prompt.js';
import type { OptionalUndefined } from '../types/utils.js';
import type { ConfigForMode } from '../types/factory-config.js';
import type { CallableComponent, SourceArguments, SourceSettings, BaseRunSettings, Configured, RequiredSetting, AudioFormatArguments } from '../types/component.js';
import { experimental_streamTranslate } from 'ai';
import { createComponentFactory, audioModifiers } from './component-factory.js';
import { createComponentRuntime } from '../runtime/component-call.js';
import type { RuntimeComponentConfig } from '../runtime/component-call.js';
import type { Fields } from '../types/utils.js';
import { claimLiveInput } from '../runtime/live-input.js';
import { isPlainObject } from '../schema.js';

type Settings = Omit<Parameters<typeof experimental_streamTranslate>[0], '_internal'>;
export const definition = {
	name: 'StreamingTranslator', defaultMode: 'text', main: 'audio', modifiers: audioModifiers, toolModes: [], required: ['model'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;

type TranslationArguments<T> = OptionalUndefined<[
	...AudioFormatArguments<T, Settings['inputAudioFormat']>, ...Configured<T, 'targetLanguage'> extends true ? [targetLanguage?: string] : [targetLanguage: string]]
	| (Configured<T, 'inputAudioFormat'> extends true ? Configured<T, 'targetLanguage'> extends true ? [targetLanguage?: string] : [targetLanguage: string] : never)>;

export interface Calls<P extends PromptType, T> {
	arguments: SourceArguments<'StreamingTranslator', P, T, TranslationArguments<T>>;
	settings: BaseRunSettings<'StreamingTranslator', T, SourceSettings<'StreamingTranslator', P, T>
		& RequiredSetting<T, 'inputAudioFormat', Settings['inputAudioFormat']> & RequiredSetting<T, 'targetLanguage', string>>;
}

export interface Types<P extends PromptType, T, A extends boolean> {
	definition: typeof definition;
	settings: Settings;
	component: CallableComponent<'StreamingTranslator', P, T, A, { [M in P]: Calls<M, ConfigForMode<T, M, P>> }>;
	result: import('ai').Experimental_StreamTranslationResult;
	toolResult: never;
}

function createStreamingTranslator(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields) {
		const settings = runtime.request(await runtime.prepare(raw)) as Settings;
		claimLiveInput(settings.audio);
		return experimental_streamTranslate(settings);
	}
	return runtime.callable(invoke, args => {
		const call = runtime.arguments(args, { literal: first => !isPlainObject(first) && typeof first !== 'string' });
		call.take('inputAudioFormat', isPlainObject);
		call.take('targetLanguage', value => typeof value === 'string');
		return call.done();
	});
}

type Factory = import('./component-factory.js').SourceFactory<'StreamingTranslator'>;
/** @experimental Uses the AI SDK's experimental streaming translation API. */
export const StreamingTranslator = createComponentFactory(definition, createStreamingTranslator) as Factory;
