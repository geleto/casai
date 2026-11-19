import { detectMediaType } from '@ai-sdk/provider-utils';
import { sourceMode, streamMode, toolMode } from '../config/modifiers.js';
import { type ConfigError, ValidationError } from '../errors.js';
import { claimLiveInput } from '../runtime/live-input.js';
import { isWebStream } from '../runtime/web-input.js';
import { sdkRequest, type PreparedComponentCall } from '../runtime/component-call.js';
import type { Fields } from '../types/utils.js';
import { validatePreparedAudioLimit, validatePreparationSettings, type AudioSource, type PrepareAudioSettings } from './preparation.js';
import { prepareSuppliedAudio } from './supplied.js';
import { isPcmSamples, type PcmSourceFormat } from './pcm.js';
import { audioMediaType, preparedAudioTypes } from './source-evidence.js';
import type { AudioFormat } from '../audio.js';

/** Both construction and invocation check the selected source and SDK delivery. */
export function validateAudioSettings(settings: Record<PropertyKey, any>, fileTranscription: boolean, ErrorClass: typeof ConfigError | typeof ValidationError): void {
	if (!settings[streamMode] && settings.includeRawChunks !== undefined) throw new ErrorClass('includeRawChunks requires .asStream.');
	if (settings[sourceMode] !== 'audio-resource') {
		validatePreparedAudioLimit(settings.maxPreparedAudioBytes, ErrorClass);
		if (settings.mediaSettings !== undefined || settings.fileAudioTarget !== undefined) throw new ErrorClass('mediaSettings and fileAudioTarget require .loadsAudio.');
		return;
	}
	validatePreparationSettings(settings, ErrorClass);
	if (settings.download !== undefined) throw new ErrorClass('The SDK download hook is not used by .loadsAudio. Use native mediaSettings.options for media access.');
	if ((!fileTranscription || settings[streamMode]) && settings.fileAudioTarget !== undefined) throw new ErrorClass('fileAudioTarget requires completed Transcriber.loadsAudio delivery.');
	if (fileTranscription && settings[toolMode] && settings.inputAudioFormat === undefined && settings.fileAudioTarget === undefined) throw new ErrorClass('Transcriber.loadsAudio.asTool requires inputAudioFormat or fileAudioTarget in its configuration.');
}

function rawStream(audio: unknown): ReadableStream<Uint8Array | string> {
	if (isWebStream(audio)) return audio as ReadableStream<Uint8Array | string>;
	if (!(audio instanceof Uint8Array || audio instanceof ArrayBuffer)) throw new ValidationError('Raw audio requires bytes or a ReadableStream and inputAudioFormat.');
	const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
	let offset = 0;
	return new ReadableStream({
		pull(controller) {
			if (offset === bytes.byteLength) { controller.close(); return; }
			// 200 ms of 24 kHz mono PCM16; also aligns mono/stereo 8/16/24/32-bit frames.
			const end = Math.min(offset + 9600, bytes.byteLength);
			controller.enqueue(bytes.subarray(offset, end));
			offset = end;
		},
	});
}

/** Both audio-input components hand off one SDK request. Live delivery transfers consumption to the caller. */
export async function withAudioInput<R>(prepared: PreparedComponentCall, dispatch: (settings: Fields) => Promise<R>): Promise<R> {
	const settings = sdkRequest(prepared, ['mediaSettings', 'fileAudioTarget', 'sourceFormat', 'maxPreparedAudioBytes']);
	const { fileAudioTarget, mediaSettings } = prepared.settings;
	const maxPreparedAudioBytes = prepared.settings.maxPreparedAudioBytes as number | undefined;
	const sourceFormat = prepared.settings.sourceFormat as PcmSourceFormat | undefined;
	const resource = prepared.settings[sourceMode] === 'audio-resource';
	let close: ((reason?: unknown) => Promise<void>) | undefined;
	let mediaType: string | undefined;
	if (settings.audio == null) throw new ValidationError('Audio input is required.');
	if (resource) {
		if (settings.inputAudioFormat === undefined && fileAudioTarget === undefined) throw new ValidationError('Transcriber.loadsAudio requires inputAudioFormat or a configured fileAudioTarget.');
		if (isPcmSamples(settings.audio) && !sourceFormat) throw new ValidationError('Headerless sample arrays require sourceFormat.sampleRate and sourceFormat.channels.');
		const { prepareAudio } = await import('#native-audio');
		const owned = await prepareAudio(settings.audio as AudioSource, { inputAudioFormat: settings.inputAudioFormat, fileAudioTarget,
			mediaSettings, sourceFormat, maxPreparedAudioBytes, abortSignal: settings.abortSignal } as PrepareAudioSettings);
		close = owned.close;
		settings.audio = owned.audio;
		if ('format' in owned.format) mediaType = preparedAudioTypes[owned.format.format];
	} else {
		const supplied = await prepareSuppliedAudio(settings.audio, settings.inputAudioFormat as AudioFormat | undefined, sourceFormat, prepared.context._toolOptions.abortSignal, maxPreparedAudioBytes);
		close = supplied.close;
		settings.audio = supplied.audio;
		mediaType = supplied.mediaType;
	}
	try {
		prepared.context._toolOptions.abortSignal?.throwIfAborted();
		if (settings.inputAudioFormat !== undefined) {
			settings.audio = rawStream(settings.audio);
			claimLiveInput(settings.audio);
		}
		// Supplied-byte transcription has no MIME override. Compare the actual SDK rule, including its WAV default.
		else if (resource || mediaType) {
			const bytes = settings.audio instanceof ArrayBuffer ? new Uint8Array(settings.audio) : settings.audio as Uint8Array;
			const detected = audioMediaType(detectMediaType({ data: bytes, topLevelType: 'audio' }) ?? 'audio/wav');
			if (!mediaType || detected !== mediaType) throw new ValidationError('The AI SDK cannot accurately label this supplied audio container. Use .loadsAudio with a recognizable fileAudioTarget such as WAV or FLAC.');
		}
		const result = await dispatch(settings);
		if (!prepared.settings[streamMode]) await close?.();
		return result;
	} catch (error) {
		await close?.(error).catch(() => { /* Preserve the original failure or cancellation. */ });
		throw error;
	}
}
