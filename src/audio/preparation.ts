import type { AudioFormat, SuppliedAudio } from '../audio.js';
import type { PcmSourceFormat } from './pcm.js';
import { type ConfigError, ValidationError } from '../errors.js';
import type { ConfigValue } from '../types/config.js';
import { preparedAudioTypes } from './source-evidence.js';
import { validatePcmLayout } from './pcm-format.js';

export type AudioSource = string | URL | SuppliedAudio | ReadableStream<Uint8Array>;
export const defaultPreparedAudioBytes = 32 * 1024 * 1024;
export const recordingUnavailable = 'Browser encoded recording preparation requires a qualified codec worker. Supply decoded PCM samples or open the recording with .loadsAudio on Node.js.';
export function validatePreparedAudioLimit(value: unknown, ErrorClass: typeof ConfigError | typeof ValidationError): void {
	if (value !== undefined && (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)) throw new ErrorClass('maxPreparedAudioBytes must be a positive integer.');
}
export function checkPreparedAudioBytes(bytes: number, limit: number): void {
	if (bytes > limit) throw new ValidationError('Audio preparation exceeds maxPreparedAudioBytes.');
}
export interface LoadedPcmFormat { type: 'audio/pcm' | (string & {}); rate: number }
export type LoadedFormatAnnotation<P> = P extends 'audio-resource' ? { inputAudioFormat?: { type: 'audio/pcm'; rate: number } | undefined } : unknown;
// Keep widened native format variables usable while checking every known literal.
export type CheckLoadedFormat<Mode, Format, Mime = Exclude<ConfigValue<Format, 'type'>, undefined>> =
	Mode extends 'audio-resource' ? string extends Mime ? unknown : [Mime] extends ['audio/pcm'] ? unknown
		: 'Native raw preparation requires a rate-bearing audio/pcm target.' : unknown;
/** Native FFmpeg demuxer options. Names, values and units retain their native meaning. */
export interface MediaSettings {
	track?: number;
	format?: string | undefined;
	options?: Record<string, string | number | bigint | boolean | null | undefined>;
}
/**
 * One accepted encoded recording. Omitted sample constraints preserve native properties where supported.
 * Copy/remux compatibility uses inspected native metadata; it does not certify every packet's format.
 */
export interface FileAudioFormat {
	/** Use wav, flac, ogg, opus, mp3, mp4, ipod, adts or webm for file transcription. */
	format: string;
	/** Native audio encoder name; also identifies compatible source audio for copying. */
	codec: string;
	/** Required sample rate in Hz; omit to preserve the source rate where the encoder supports it. */
	rate?: number;
	/** Required channel count; omit to preserve the source channel layout where supported. */
	channels?: number;
	/** Native sample format name, such as s16 or s32; omit for the encoder's native choice. */
	sampleFormat?: string | undefined;
}
export interface FileAudioTarget extends FileAudioFormat {
	/** Additional accepted formats that may be copied; otherwise convert to the primary format. */
	alternatives?: readonly FileAudioFormat[];
	/** Maximum completed encoded file size in bytes, including its container headers. */
	maxBytes?: number;
	/** Maximum selected/encoded audio duration in seconds, including codec padding. */
	maxDurationSeconds?: number;
}
export type AudioTarget = { inputAudioFormat: AudioFormat; fileAudioTarget?: undefined }
	| { fileAudioTarget: FileAudioTarget; inputAudioFormat?: undefined };
export type PrepareAudioSettings = AudioTarget & {
	maxPreparedAudioBytes?: number | undefined;
	mediaSettings?: MediaSettings | undefined;
	sourceFormat?: PcmSourceFormat | undefined;
	abortSignal?: AbortSignal | undefined;
};
export interface PreparedAudio<Output extends Uint8Array | ReadableStream<Uint8Array> = Uint8Array | ReadableStream<Uint8Array>> {
	readonly audio: Output;
	readonly format: Output extends Uint8Array ? FileAudioFormat : AudioFormat;
	/** Own the handle until downstream consumption finishes, or close it when abandoning/cancelling. */
	readonly close: (reason?: unknown) => Promise<void>;
	[Symbol.asyncDispose](): Promise<void>;
}
export type PreparedAudioFor<T extends PrepareAudioSettings> = PreparedAudio<T extends { inputAudioFormat: AudioFormat } ? ReadableStream<Uint8Array> : Uint8Array<ArrayBuffer>>;

export function validatePreparationSettings(settings: Partial<Pick<PrepareAudioSettings, 'mediaSettings' | 'inputAudioFormat' | 'fileAudioTarget' | 'sourceFormat' | 'maxPreparedAudioBytes'>>, ErrorClass: typeof ConfigError | typeof ValidationError): void {
	validatePreparedAudioLimit(settings.maxPreparedAudioBytes, ErrorClass);
	if (settings.sourceFormat !== undefined) validatePcmLayout(settings.sourceFormat, ErrorClass);
	const track = settings.mediaSettings?.track;
	if (track !== undefined && (!Number.isSafeInteger(track) || track < 0)) throw new ErrorClass('mediaSettings.track must be a non-negative container stream index.');
	if (settings.inputAudioFormat !== undefined && settings.fileAudioTarget !== undefined) throw new ErrorClass('Choose inputAudioFormat or fileAudioTarget, not both.');
	const raw = settings.inputAudioFormat;
	if (raw !== undefined && (raw.type !== 'audio/pcm' || !Number.isSafeInteger(raw.rate) || raw.rate! <= 0)) throw new ErrorClass('Native raw preparation requires { type: "audio/pcm", rate: positiveInteger } and produces mono PCM16 little-endian.');
	const file = settings.fileAudioTarget as FileAudioTarget | null | undefined;
	if (file !== undefined) {
		const alternatives = file?.alternatives;
		if (alternatives !== undefined && !Array.isArray(alternatives)) throw new ErrorClass('fileAudioTarget.alternatives must be an array of file profiles.');
		const profiles = alternatives as readonly FileAudioFormat[] | undefined;
		for (const target of [file, ...profiles ?? []]) {
			if (typeof target?.format !== 'string' || !target.format || typeof target.codec !== 'string' || !target.codec) throw new ErrorClass('fileAudioTarget requires native format and codec names.');
			if (!Object.hasOwn(preparedAudioTypes, target.format)) throw new ErrorClass('The AI SDK cannot accurately label this fileAudioTarget container. Choose a supported output such as wav, flac or webm.');
			if (target.sampleFormat !== undefined && (typeof target.sampleFormat !== 'string' || !target.sampleFormat)) throw new ErrorClass('fileAudioTarget.sampleFormat must be a native sample format name.');
			for (const key of ['rate', 'channels'] as const) {
				if (target[key] !== undefined && (!Number.isSafeInteger(target[key]) || target[key] <= 0)) throw new ErrorClass(`fileAudioTarget.${key} must be a positive integer.`);
			}
		}
	}
	for (const key of ['maxBytes', 'maxDurationSeconds'] as const) {
		const value = settings.fileAudioTarget?.[key];
		if (value !== undefined && (!Number.isFinite(value) || value <= 0 || key === 'maxBytes' && !Number.isSafeInteger(value))) throw new ErrorClass(`fileAudioTarget.${key} must be positive${key === 'maxBytes' ? ' and an integer' : ''}.`);
	}
}
