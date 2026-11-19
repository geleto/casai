import { experimental_streamTranslate as streamTranslate } from 'ai';
import type { Experimental_StreamTranslationResult as StreamTranslationResult } from 'ai';
import { sourceMode, streamMode } from '../config/modifiers.js';
import { audioBase64, concatAudio, type AudioCallFormat, type CheckPcmLayout, type PcmInputSettings, type RawAudio } from '../audio.js';
import { ConfigError, ValidationError } from '../errors.js';
import { createComponentFactory, audioInputModifiers, audioInputModes, type SourceFactory } from './component-factory.js';
import { createComponentRuntime, type RuntimeComponentConfig } from '../runtime/component-call.js';
import { validateAudioSettings, withAudioInput } from '../audio/input.js';
import { isPlainObject } from '../schema.js';
import type { ToolInvocation } from '../types/execution.js';
import type { Fields, OptionalUndefined } from '../types/utils.js';
import type { PromptType } from '../types/prompt.js';
import type { ConfigValue } from '../types/config.js';
import type { ConfigForMode } from '../types/factory-config.js';
import type { CallableComponent, SourceArguments, SourceSettings, BaseRunSettings, Configured, RequiredSetting, AudioFormatArguments, SourceComponentConfig } from '../types/component.js';
import type { AudioSource, CheckLoadedFormat, LoadedPcmFormat, MediaSettings } from '../audio/preparation.js';

type Settings = Omit<Parameters<typeof streamTranslate>[0], '_internal' | 'audio'> & PcmInputSettings & { audio: RawAudio };
type LoadedSettings = Omit<Settings, 'audio' | 'inputAudioFormat'> & { audio: AudioSource; inputAudioFormat: LoadedPcmFormat; mediaSettings?: MediaSettings; fileAudioTarget?: undefined; download?: undefined };
type SelectedSettings<T> = ConfigValue<T, typeof sourceMode> extends 'audio-resource' ? LoadedSettings : Settings & { mediaSettings?: undefined; fileAudioTarget?: undefined };
/** One completed translation, preserving native final values and collected raw audio bytes. */
export type TranslationResult = { readonly [K in Exclude<keyof StreamTranslationResult, 'fullStream'>]: Awaited<StreamTranslationResult[K]> } & { readonly audio: Uint8Array<ArrayBuffer> };
export type TranslationToolResult = Pick<TranslationResult, 'sourceText' | 'translationText' | 'durationInSeconds'> & { audio: string };
export const definition = {
	name: 'Translator', defaultMode: 'text', main: 'audio', modifiers: audioInputModifiers, toolModes: audioInputModes,
	required: ['model'], toolRequired: ['inputAudioFormat', 'targetLanguage'], asStream: true,
} as const;

type TranslationArguments<T, Format> = OptionalUndefined<[
	...AudioFormatArguments<T, Format>, ...Configured<T, 'targetLanguage'> extends true ? [targetLanguage?: string] : [targetLanguage: string]]
	| (Configured<T, 'inputAudioFormat'> extends true ? Configured<T, 'targetLanguage'> extends true ? [targetLanguage?: string] : [targetLanguage: string] : never)>;
// A type alias keeps inferred application declarations portable (TS4023 with a private interface).
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Calls<P extends PromptType, T, Format = P extends 'audio-resource' ? LoadedPcmFormat : Settings['inputAudioFormat']> = {
	arguments: SourceArguments<'Translator', P, T, TranslationArguments<T, Format>>;
	settings: BaseRunSettings<'Translator', T, SourceSettings<'Translator', P, T>
		& RequiredSetting<T, 'inputAudioFormat', Format> & RequiredSetting<T, 'targetLanguage', string>>;
};
export interface Types<P extends PromptType, T, A extends boolean, Input = unknown, Call = undefined> {
	definition: typeof definition;
	settings: LoadedSettings | Settings;
	config: SourceComponentConfig<'Translator', P, unknown, [T] extends [{ [streamMode]: true }]
		? P extends 'audio-resource' ? LoadedSettings : Settings : Omit<P extends 'audio-resource' ? LoadedSettings : Settings, 'includeRawChunks'>>;
	selectedSettings: [T] extends [{ [streamMode]: true }] ? SelectedSettings<T> : Omit<SelectedSettings<T>, 'includeRawChunks'>;
	component: CallableComponent<'Translator', P, T, A, { [M in P]: Calls<M, ConfigForMode<T, M, P>> }>;
	result: [T] extends [{ [streamMode]: true }] ? StreamTranslationResult
		: true extends ConfigValue<T, typeof streamMode> ? StreamTranslationResult | TranslationResult : TranslationResult;
	toolResult: TranslationToolResult;
	toolInput: RawAudio;
	callCheck: CheckPcmLayout<Input, T> & (P extends 'audio-resource' ? CheckLoadedFormat<P, AudioCallFormat<P, T, Call>> : unknown);
	toolCheck: CheckPcmLayout<Input, T>;
	runCheck: CheckPcmLayout<import('../types/component.js').RunInput<'Translator', P, T, Call>, import('../types/config-validation.js').ResolvedRunConfig<T, Call>>
		& (P extends 'audio-resource' ? CheckLoadedFormat<P, ConfigValue<Call, 'inputAudioFormat'>> : unknown);
}
async function collect(result: StreamTranslationResult, signal?: AbortSignal): Promise<TranslationResult> {
	const chunks: (Uint8Array | string)[] = [];
	for await (const part of result.fullStream) {
		if (part.type === 'audio' && part.audio.length > 0) chunks.push(part.audio);
	}
	const [sourceText, translationText, durationInSeconds, usage, warnings, response, providerMetadata] = await Promise.all([
		result.sourceText, result.translationText, result.durationInSeconds, result.usage, result.warnings, result.response, result.providerMetadata,
	]);
	return { audio: await concatAudio(chunks, signal), sourceText, translationText, durationInSeconds, usage, warnings, response, providerMetadata };
}
function validate(config: Record<PropertyKey, unknown>) {
	validateAudioSettings(config, false, ConfigError);
}
function create(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields, tool?: ToolInvocation) {
		const prepared = await runtime.prepare(raw, tool);
		validateAudioSettings(prepared.settings, false, ValidationError);
		if (prepared.settings.inputAudioFormat === undefined || prepared.settings.targetLanguage === undefined) throw new ValidationError('Translator requires inputAudioFormat and targetLanguage.');
		return withAudioInput(prepared, async settings => {
			const stream = streamTranslate(settings as Parameters<typeof streamTranslate>[0]);
			if (config[streamMode]) return stream;
			const signal = prepared.context._toolOptions.abortSignal;
			const result = await collect(stream, signal);
			return tool ? { sourceText: result.sourceText, translationText: result.translationText, audio: await audioBase64(result.audio, signal), durationInSeconds: result.durationInSeconds } : result;
		});
	}
	return runtime.callable(invoke, args => {
		const call = runtime.arguments(args, { literal: first => !isPlainObject(first) && (config[sourceMode] === 'audio-resource' || typeof first !== 'string') });
		call.take('inputAudioFormat', isPlainObject);
		call.take('targetLanguage', value => typeof value === 'string');
		return call.done();
	}, ({ output }) => ({ type: 'text', value: (output as TranslationToolResult).translationText }));
}

/** Speech translation using the SDK's experimental streaming API, collected unless .asStream is selected. */
export const Translator = createComponentFactory(definition, create, validate) as SourceFactory<'Translator'>;
