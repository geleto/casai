import { generateSpeech, experimental_streamSpeech as streamSpeech, DefaultGeneratedFile } from 'ai';
import type { SpeechResult as NativeSpeechResult, Experimental_StreamSpeechResult as StreamSpeechResult } from 'ai';
import { streamMode } from '../config/modifiers.js';
import { audioBase64, concatAudio, type AudioFormat } from '../audio.js';
import { ConfigError, ValidationError } from '../errors.js';
import { createComponentFactory, textModifiers, textModes, type SourceFactory } from './component-factory.js';
import { createComponentRuntime, sdkRequest, type RuntimeComponentConfig } from '../runtime/component-call.js';
import { claimLiveInput } from '../runtime/live-input.js';
import { isWebStream } from '../runtime/web-input.js';
import type { ToolInvocation } from '../types/execution.js';
import type { Fields, UnionKeys, DistributiveOmit, ExclusiveUnion } from '../types/utils.js';
import type { PromptType } from '../types/prompt.js';
import type { FilePayload } from '../types/result.js';
import type { ConfigValue } from '../types/config.js';
import type { CallableComponent, SourceArguments, SourceSettings, BaseRunSettings, RunInput, SourceComponentConfig } from '../types/component.js';
import type { ConfigForMode } from '../types/factory-config.js';
import type { InvalidNativeRequest, ResolvedRunConfig } from '../types/config-validation.js';

type CompleteSettings = Omit<Parameters<typeof generateSpeech>[0], '_internal'>;
type StreamSettings = Omit<Parameters<typeof streamSpeech>[0], '_internal'>;
type CollectedSettings = Omit<StreamSettings, 'includeRawChunks'>;
type StreamDelivery<T> = [T] extends [{ [streamMode]: true }] ? StreamSettings : CollectedSettings;
type CompletedConfig<P extends PromptType> = ExclusiveUnion<SourceComponentConfig<'SpeechGenerator', P, unknown, CompleteSettings>
	| (SourceComponentConfig<'SpeechGenerator', P, unknown, CollectedSettings> & { outputFormat: NonNullable<CollectedSettings['outputFormat']> })>;
type Settings = CompleteSettings | StreamSettings;
type ConfiguredText<T, Text = ConfigValue<T, 'text'>> = Text extends (...args: never[]) => infer R ? Awaited<R> : Text;
type SelectedSettings<T> = true extends ConfigValue<T, typeof streamMode> ? StreamDelivery<T>
	: [Exclude<ConfigValue<T, 'outputFormat'>, undefined>] extends [never]
		? [Exclude<ConfiguredText<T>, string | undefined>] extends [never] ? CompleteSettings | CollectedSettings : CollectedSettings
		: ConfigValue<T, 'outputFormat'> extends string | undefined ? CompleteSettings : CollectedSettings;
type ScriptMode = 'async-script' | 'async-script-name';
type RequestSettings<P, Input, Format, Stream> = Stream extends true ? StreamSettings
	: Format extends string ? CompleteSettings : Format extends undefined
		? P extends ScriptMode ? CompleteSettings | CollectedSettings : Input extends string ? CompleteSettings : CollectedSettings : CollectedSettings;
// Optional delivery must support each native request, including complete string speech.
type InvalidDeliveryRequest<P, T, Input, Format, Stream = ConfigValue<T, typeof streamMode>> = Stream extends unknown
	? InvalidNativeRequest<Omit<T, 'text' | 'outputFormat'> & { text: Input; outputFormat: Format },
		DistributiveOmit<RequestSettings<P, Input, Format, Stream>, P extends ScriptMode ? 'text' : never>,
		Exclude<UnionKeys<Settings>, P extends ScriptMode ? 'text' : never>> : never;
type InvalidRequest<P, T, Input, Format = ConfigValue<T, 'outputFormat'>> = T extends unknown ? Input extends unknown ? Format extends unknown
	? InvalidDeliveryRequest<P, T, Input, Format> : never : never : never;
// Cascada's return type is opaque to TypeScript; its native text shape is checked at dispatch.
// Streaming source/run types already fix the operation; completed calls still choose at invocation.
type CheckRequest<P, T, Input> = [T] extends [{ [streamMode]: true }] ? unknown : [InvalidRequest<P, T, Input>] extends [never] ? unknown : 'Speech settings do not match the selected native request.';

// Named calls may replace the format and select another native operation.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Keep inferred application declarations portable.
type Calls<P extends PromptType, T> = {
	arguments: SourceArguments<'SpeechGenerator', P, T, [voice?: string | undefined]>;
	settings: BaseRunSettings<'SpeechGenerator', T, SourceSettings<'SpeechGenerator', P, Omit<T, 'outputFormat'>>,
		true extends ConfigValue<T, typeof streamMode> ? StreamDelivery<T> : CompleteSettings | CollectedSettings>;
};

/** Completed speech; collected native streams also retain their actual format and usage. */
export interface SpeechResult extends NativeSpeechResult {
	readonly audioFormat?: AudioFormat;
	readonly usage?: Awaited<StreamSpeechResult['usage']>;
}
export type SpeechToolResult = FilePayload & { audioFormat?: AudioFormat };
export const definition = {
	name: 'SpeechGenerator', defaultMode: 'text', main: 'text', modifiers: textModifiers, toolModes: textModes, required: ['model'], asStream: true,
} as const;
export interface Types<P extends PromptType, T, A extends boolean, Input = unknown, Call = undefined> {
	definition: typeof definition;
	settings: Settings;
	config: true extends ConfigValue<T, typeof streamMode> ? SourceComponentConfig<'SpeechGenerator', P, unknown, StreamDelivery<T>> : CompletedConfig<P>;
	selectedSettings: SelectedSettings<T>;
	component: CallableComponent<'SpeechGenerator', P, T, A, { [M in P]: Calls<M, ConfigForMode<T, M, P>> }>;
	result: [T] extends [{ [streamMode]: true }] ? StreamSpeechResult
		: true extends ConfigValue<T, typeof streamMode> ? StreamSpeechResult | SpeechResult : SpeechResult;
	toolResult: SpeechToolResult;
	callCheck: CheckRequest<P, T, Input>;
	toolCheck: CheckRequest<P, T, Input>;
	runCheck: CheckRequest<P, ResolvedRunConfig<T, Call>, RunInput<'SpeechGenerator', P, T, Call>>;
}

async function collect(result: StreamSpeechResult, signal?: AbortSignal): Promise<SpeechResult> {
	const chunks: Uint8Array[] = [];
	let audioFormat: AudioFormat | undefined;
	// Claim the stream before reading any final promises: the SDK exposes one consumer.
	for await (const part of result.fullStream) {
		if (part.type !== 'audio' || part.audio.byteLength === 0) continue;
		if (audioFormat && (audioFormat.type !== part.audioFormat.type || audioFormat.rate !== part.audioFormat.rate)) {
			throw new ValidationError('Cannot collect speech chunks with different audio formats. Use .asStream to consume them separately.');
		}
		audioFormat = part.audioFormat;
		chunks.push(part.audio);
	}
	const [usage, warnings, responses, providerMetadata] = await Promise.all([result.usage, result.warnings, result.responses, result.providerMetadata]);
	// Successful native completion guarantees nonempty audio with its emitted format.
	const mediaType = audioFormat!.type;
	const audio = Object.assign(new DefaultGeneratedFile({ data: await concatAudio(chunks, signal), mediaType }), {
		format: mediaType === 'audio/mpeg' ? 'mp3' : mediaType.split('/').at(-1)!,
	});
	return { audio, audioFormat: audioFormat!, usage, warnings, responses, providerMetadata };
}
function validate(config: { [streamMode]?: unknown; includeRawChunks?: unknown; outputFormat?: unknown }, ErrorClass: typeof ConfigError | typeof ValidationError) {
	if (!config[streamMode] && config.includeRawChunks !== undefined) throw new ErrorClass('includeRawChunks requires .asStream.');
	if (config[streamMode] && typeof config.outputFormat === 'string') throw new ErrorClass('SpeechGenerator.asStream outputFormat must be an object when supplied.');
}
function create(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields, tool?: ToolInvocation) {
		const prepared = await runtime.prepare(raw, tool, settings => { validate(settings, ValidationError); });
		const settings = sdkRequest(prepared);
		const signal = prepared.context._toolOptions.abortSignal;
		if (settings.text == null) throw new ValidationError('SpeechGenerator requires text.');
		if (typeof settings.outputFormat === 'string' && typeof settings.text !== 'string') {
			throw new ValidationError('A string outputFormat requires string text and completed delivery.');
		}
		let result: SpeechResult, collected = false;
		if (config[streamMode] || typeof settings.text !== 'string' || typeof settings.outputFormat === 'object' && settings.outputFormat !== null) {
			if (isWebStream(settings.text)) claimLiveInput(settings.text);
			const stream = streamSpeech(settings as StreamSettings);
			if (config[streamMode]) return stream;
			result = await collect(stream, signal);
			collected = true;
		} else result = await generateSpeech(settings as CompleteSettings);
		// Complete SDK files retain their native lazy views; Casai-owned collection encodes in its worker.
		return tool ? { mediaType: result.audio.mediaType, base64: collected ? await audioBase64(result.audio.uint8Array, signal) : result.audio.base64, ...(result.audioFormat ? { audioFormat: result.audioFormat } : {}) } : result;
	}
	return runtime.callable(invoke, args => {
		const call = runtime.arguments(args);
		call.take('voice', value => typeof value === 'string');
		return call.done();
	}, ({ output }) => {
		const file = output as SpeechToolResult;
		return { type: 'content', value: [{ type: 'file', data: { type: 'data', data: file.base64 }, mediaType: file.mediaType }] };
	});
}

/** Completed speech, or native incremental delivery with .asStream (experimental SDK API). */
export const SpeechGenerator = createComponentFactory(definition, create, config => { validate(config, ConfigError); }) as SourceFactory<'SpeechGenerator'>;
