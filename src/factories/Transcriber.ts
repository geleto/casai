import { transcribe, experimental_streamTranscribe as streamTranscribe } from 'ai';
import type { TranscriptionResult, StreamTranscriptionResult } from 'ai';
import { sourceMode, streamMode } from '../config/modifiers.js';
import { ConfigError, ValidationError } from '../errors.js';
import type { AudioCallFormat, AudioFormat, CheckPcmLayout, PcmInputSettings, RawAudio, SuppliedAudio } from '../audio.js';
import { releaseOnAudioFinish, validateAudioSettings, withAudioInput } from '../audio/input.js';
import { createComponentRuntime, type RuntimeComponentConfig } from '../runtime/component-call.js';
import { isPlainObject } from '../schema.js';
import { isWebStream } from '../runtime/web-input.js';
import { createComponentFactory, audioInputModifiers, audioInputModes, type SourceFactory } from './component-factory.js';
import type { PromptType } from '../types/prompt.js';
import type { ConfigValue } from '../types/config.js';
import type { ConfigForMode } from '../types/factory-config.js';
import type { InvalidNativeRequest, ResolvedRunConfig } from '../types/config-validation.js';
import type { UnionKeys, ExclusiveUnion } from '../types/utils.js';
import type { AudioFormatArguments, BaseRunSettings, CallableComponent, SourceArguments, SourceSettings, SourceComponentConfig, Configured } from '../types/component.js';
import type { AudioSource, CheckLoadedFormat, LoadedPcmFormat, MediaSettings, FileAudioTarget } from '../audio/preparation.js';

type NativeFile = Parameters<typeof transcribe>[0];
type FileSettings = Omit<NativeFile, '_internal' | 'audio'> & PcmInputSettings & { audio: NativeFile['audio'] | SuppliedAudio; inputAudioFormat?: undefined };
type RawSettings = Omit<Parameters<typeof streamTranscribe>[0], '_internal' | 'audio'> & PcmInputSettings & { audio: RawAudio };
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Inline this shape in exported consumer declarations.
type NoMedia = { mediaSettings?: undefined; fileAudioTarget?: undefined };
type LoadedRaw = Omit<RawSettings, 'audio' | 'inputAudioFormat'> & { audio: AudioSource; inputAudioFormat: LoadedPcmFormat; mediaSettings?: MediaSettings; fileAudioTarget?: undefined; download?: undefined };
type LoadedFile = Omit<FileSettings, 'audio' | 'download'> & { audio: AudioSource; mediaSettings?: MediaSettings; fileAudioTarget: FileAudioTarget; download?: undefined };
type Settings = (FileSettings | RawSettings) & NoMedia | LoadedRaw | LoadedFile;
type RawDelivery<T, S = RawSettings> = [T] extends [{ [streamMode]: true }] ? S : Omit<S, 'includeRawChunks'>;
type NativeSettings<T> = true extends ConfigValue<T, typeof streamMode> ? RawDelivery<T>
	: Exclude<ConfigValue<T, 'inputAudioFormat'>, undefined> extends never ? FileSettings | Omit<RawSettings, 'includeRawChunks'> : Omit<RawSettings, 'includeRawChunks'>;
type SelectedSettings<T> = ConfigValue<T, typeof sourceMode> extends 'audio-resource'
	? true extends ConfigValue<T, typeof streamMode> ? RawDelivery<T, LoadedRaw>
		: Exclude<ConfigValue<T, 'fileAudioTarget'>, undefined> extends never ? Omit<LoadedRaw, 'includeRawChunks'> : LoadedFile
	: NativeSettings<T> & NoMedia;
// Broad annotations retain the selector that makes each native settings alternative callable.
type CompletedConfig<P extends PromptType> = ExclusiveUnion<P extends 'audio-resource'
	? (SourceComponentConfig<'Transcriber', P, unknown, LoadedFile> & Pick<LoadedFile, 'fileAudioTarget'>)
		| (SourceComponentConfig<'Transcriber', P, unknown, Omit<LoadedRaw, 'includeRawChunks'>> & Pick<LoadedRaw, 'inputAudioFormat'>)
	: SourceComponentConfig<'Transcriber', P, unknown, FileSettings & NoMedia>
		| (SourceComponentConfig<'Transcriber', P, unknown, Omit<RawSettings, 'includeRawChunks'> & NoMedia> & Pick<RawSettings, 'inputAudioFormat'>)>;

export type TranscriptSnapshot = Pick<TranscriptionResult, 'text' | 'segments' | 'language' | 'durationInSeconds'>;
export const definition = {
	name: 'Transcriber', main: 'audio', defaultMode: 'text', modifiers: audioInputModifiers, toolModes: audioInputModes,
	required: ['model'], asStream: true,
} as const;

// A type alias keeps inferred application declarations portable (TS4023 with a private interface).
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Calls<P extends PromptType, T, Format = P extends 'audio-resource' ? LoadedPcmFormat : AudioFormat> = {
	arguments: true extends ConfigValue<T, typeof streamMode> ? SourceArguments<'Transcriber', P, T, AudioFormatArguments<T, Format>>
		: P extends 'audio-resource' ? Exclude<ConfigValue<T, 'fileAudioTarget'>, undefined> extends never
			? SourceArguments<'Transcriber', P, T, AudioFormatArguments<T, Format>> : SourceArguments<'Transcriber', P, T>
		: SourceArguments<'Transcriber', P, T, [inputAudioFormat?: AudioFormat | undefined]>;
	settings: BaseRunSettings<'Transcriber', T, SourceSettings<'Transcriber', P, T>
		& (true extends ConfigValue<T, typeof streamMode> ? import('../types/component.js').RequiredSetting<T, 'inputAudioFormat', Format>
			: P extends 'audio-resource' ? Exclude<ConfigValue<T, 'fileAudioTarget'>, undefined> extends never ? import('../types/component.js').RequiredSetting<T, 'inputAudioFormat', Format> : unknown : unknown)>;
};
type EffectiveFormat<T, Format> = Exclude<Format, undefined> | (undefined extends Format ? ConfigValue<T, 'inputAudioFormat'> : never);
type RequestSettings<P, T, Format> = P extends 'audio-resource'
	? true extends ConfigValue<T, typeof streamMode> ? RawDelivery<T, LoadedRaw> : Format extends undefined ? LoadedFile : Omit<LoadedRaw, 'includeRawChunks'>
	: true extends ConfigValue<T, typeof streamMode> ? RawDelivery<T> : Format extends undefined ? FileSettings : Omit<RawSettings, 'includeRawChunks'>;
// Every possible input must fit the selected request; checking the union once avoids repeated identical settings checks.
type InvalidRequest<P, T, Input, Format> = [Input] extends [never] ? never : T extends unknown ? Format extends unknown
	? InvalidNativeRequest<Omit<T, 'audio' | 'inputAudioFormat'> & { inputAudioFormat: Format;
		audio: P extends 'text' | 'function' | 'audio-resource' ? Input : RequestSettings<P, T, Format>['audio'] },
		RequestSettings<P, T, Format>, UnionKeys<Settings>> : never : never;
// A definite stream has one native operation, already enforced by its source and run settings.
type CheckRequest<P, T, Input, Format = ConfigValue<T, 'inputAudioFormat'>> = CheckLoadedFormat<P, Format> & ([T] extends [{ [streamMode]: true }] ? CheckPcmLayout<Input, T>
	: [InvalidRequest<P, T, Input, Format>] extends [never] ? CheckPcmLayout<Input, T>
		: 'Audio settings do not match the selected native request; raw audio requires inputAudioFormat.');
type ToolAudio<P, T, Source = ConfigValue<T, 'audio'>> = P extends 'function'
	? Source extends (...args: never[]) => infer Output ? Awaited<Output> : never
	: P extends 'text' ? Exclude<ConfigValue<import('../types/schema-shape.js').SchemaOutputObject<ConfigValue<T, 'inputSchema'>>, 'audio'>, undefined> | Source : never;
export interface Types<P extends PromptType, T, A extends boolean, Input = unknown, Call = undefined> {
	definition: typeof definition;
	settings: Settings;
	config: true extends ConfigValue<T, typeof streamMode>
		? SourceComponentConfig<'Transcriber', P, unknown, P extends 'audio-resource' ? RawDelivery<T, LoadedRaw> : RawDelivery<T> & NoMedia>
		: CompletedConfig<P>;
	selectedSettings: SelectedSettings<T>;
	component: CallableComponent<'Transcriber', P, T, A, { [M in P]: Calls<M, ConfigForMode<T, M, P>> }>;
	result: [T] extends [{ [streamMode]: true }] ? StreamTranscriptionResult
		: true extends ConfigValue<T, typeof streamMode> ? StreamTranscriptionResult | TranscriptionResult : TranscriptionResult;
	toolResult: TranscriptSnapshot;
	toolInput: [Exclude<ConfigValue<T, 'inputAudioFormat'>, undefined>] extends [never] ? FileSettings['audio'] : RawAudio;
	callCheck: CheckRequest<P, T, Input, EffectiveFormat<T, AudioCallFormat<P, T, Call>>>;
	toolCheck: CheckPcmLayout<Input, T>;
	runCheck: CheckRequest<P, ResolvedRunConfig<T, Call>, import('../types/component.js').RunInput<'Transcriber', P, T, Call>>;
	toolRequired: P extends 'audio-resource' ? Configured<T, 'fileAudioTarget'> extends true ? never : 'inputAudioFormat'
		: [Extract<ToolAudio<P, T>, ReadableStream<unknown>>] extends [never] ? never : 'inputAudioFormat';
}

function validate(config: Record<PropertyKey, unknown>) {
	validateAudioSettings(config, true, ConfigError);
}

function validateCall(settings: RuntimeComponentConfig) {
	validateAudioSettings(settings, true, ValidationError);
	if (settings[streamMode] && settings.inputAudioFormat === undefined) throw new ValidationError('Transcriber.asStream requires inputAudioFormat.');
	if (settings[sourceMode] === 'audio-resource' && settings.inputAudioFormat === undefined && settings.fileAudioTarget === undefined) throw new ValidationError('Transcriber.loadsAudio requires inputAudioFormat or a configured fileAudioTarget.');
}

function create(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Record<string, unknown>, tool?: import('../types/execution.js').ToolInvocation) {
		const prepared = await runtime.prepare(raw, tool, validateCall);
		return withAudioInput(prepared, async (settings, close) => {
			let result: TranscriptionResult;
			if (settings.inputAudioFormat !== undefined) {
				const stream = streamTranscribe(settings as Parameters<typeof streamTranscribe>[0]);
				if (config[streamMode]) return releaseOnAudioFinish(stream, close);
				// Native result promises collect one stream and preserve native failure semantics.
				const [text, segments, language, durationInSeconds, warnings, responses, providerMetadata] = await Promise.all([
					stream.text, stream.segments, stream.language, stream.durationInSeconds, stream.warnings, stream.responses, stream.providerMetadata,
				]);
				result = { text, segments, language, durationInSeconds, warnings, responses, providerMetadata };
			} else {
				if (isWebStream(settings.audio)) throw new ValidationError('Raw audio requires inputAudioFormat.');
				result = await transcribe(settings as NativeFile);
			}
			if (!tool) return result;
			const { text, segments, language, durationInSeconds } = result;
			return { text, segments, language, durationInSeconds };
		});
	}
	return runtime.callable(invoke, args => {
		const call = runtime.arguments(args, { literal: first => !isPlainObject(first) });
		call.take('inputAudioFormat', isPlainObject);
		return call.done();
	}, ({ output }) => ({ type: 'text', value: (output as TranscriptSnapshot).text }));
}

/** Completed transcription, or native incremental delivery with .asStream (experimental SDK API). */
export const Transcriber = createComponentFactory(definition, create, validate) as SourceFactory<'Transcriber'>;
