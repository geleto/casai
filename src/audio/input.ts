import { detectMediaType, isArrayBuffer, isUint8Array, type ProviderOptions } from '@ai-sdk/provider-utils';
import type { AsyncIterableStream } from 'ai';
import { sourceMode, streamMode, toolMode } from '../config/modifiers.js';
import { type ConfigError, ValidationError } from '../errors.js';
import { claimLiveInput } from '../runtime/live-input.js';
import { isAudioBufferSource, isWebBlob, isWebStream } from '../runtime/web-input.js';
import { isPlainObject } from '../schema.js';
import { readableIterator } from '../streams.js';
import { sdkRequest, type PreparedComponentCall } from '../runtime/component-call.js';
import type { Fields } from '../types/utils.js';
import { validatePreparedAudioLimit, validatePreparationSettings, type AudioSource, type PrepareAudioSettings } from './preparation.js';
import { describeBlob, isTranscriptionFile, recordingUpload, type RecordingSdk } from './transcription-file.js';
import { prepareSuppliedAudio, streamAudioBytes } from './supplied.js';
import { isPcmSamples, type PcmSourceFormat } from './pcm.js';
import { validatePcmLayout } from './pcm-format.js';
import { audioMediaType, preparedAudioTypes } from './source-evidence.js';
import type { AudioFormat } from '../audio.js';

/** A positional record can supply a Web Audio buffer on an ordinary call. On tools it supplies context. */
export function isAudioArgument(value: unknown, config: { [toolMode]?: boolean | undefined }) {
	return !isPlainObject(value) || !config[toolMode] && isAudioBufferSource(value);
}

/** Both construction and invocation check the selected source and SDK delivery. */
export function validateAudioSettings(settings: Record<PropertyKey, any>, fileTranscription: boolean, ErrorClass: typeof ConfigError | typeof ValidationError): void {
	if (!settings[streamMode] && settings.includeRawChunks !== undefined) throw new ErrorClass('includeRawChunks requires .asStream.');
	if (settings[sourceMode] !== 'audio-resource') {
		validatePreparedAudioLimit(settings.maxPreparedAudioBytes, ErrorClass);
		if (settings.sourceFormat !== undefined) validatePcmLayout(settings.sourceFormat as PcmSourceFormat, ErrorClass);
		if (settings.mediaSettings !== undefined || settings.fileAudioTarget !== undefined) throw new ErrorClass('mediaSettings and fileAudioTarget require .loadsAudio.');
		return;
	}
	validatePreparationSettings(settings, ErrorClass);
	if (settings.download !== undefined) throw new ErrorClass('The SDK download hook is not used by .loadsAudio. Use native mediaSettings.options for media access.');
	if (!fileTranscription && settings.fileAudioTarget !== undefined) throw new ErrorClass('fileAudioTarget requires Transcriber.loadsAudio.');
	const providerOptions = settings.providerOptions as Partial<ProviderOptions> | undefined;
	if (settings.fileAudioTarget !== undefined && providerOptions?.elevenlabs?.sourceUrl != null) {
		throw new ErrorClass('providerOptions.elevenlabs.sourceUrl replaces the prepared file. Remove it from Transcriber.loadsAudio or use ordinary Transcriber for the provider URL.');
	}
	if (fileTranscription && settings[toolMode] && settings.inputAudioFormat === undefined && settings.fileAudioTarget === undefined) throw new ErrorClass('Transcriber.loadsAudio.asTool requires inputAudioFormat or fileAudioTarget in its configuration.');
}

function rawStream(audio: unknown): ReadableStream<Uint8Array | string> {
	if (isWebStream(audio)) return audio as ReadableStream<Uint8Array | string>;
	if (!(audio instanceof Uint8Array || audio instanceof ArrayBuffer)) throw new ValidationError('Raw audio requires bytes or a ReadableStream and inputAudioFormat.');
	return streamAudioBytes(audio instanceof Uint8Array ? audio : new Uint8Array(audio));
}

type CloseAudio = (reason?: unknown) => Promise<void>;

/** Forward cancellation from the selected result view on browsers missing the SDK's transform hook. */
function ownedAudioView<T>(source: ReadableStream<T>, close: CloseAudio): AsyncIterableStream<T> {
	const reader = source.getReader();
	let cancelled = false;
	const view = new ReadableStream<T>({
		async pull(controller) {
			try {
				const result = await reader.read();
				if (cancelled) return;
				if (!result.done) controller.enqueue(result.value);
				else { reader.releaseLock(); controller.close(); }
			} catch (error) {
				if (cancelled) return;
				reader.releaseLock(); controller.error(error);
			}
		},
		async cancel(reason) {
			cancelled = true;
			const cleanup = close(reason).catch(() => { /* Keep native output cancellation authoritative. */ });
			try { await reader.cancel(reason); }
			finally { reader.releaseLock(); await cleanup; }
		},
	}, { highWaterMark: 0 });
	return Object.assign(view, {
		[Symbol.asyncIterator]: () => readableIterator(view),
	});
}

/** Both native SDK results settle duration on finish and reject it on failure or cancellation.
 * Reading it is passive only after the application has claimed a native result view. */
export function releaseOnAudioFinish<R extends { readonly durationInSeconds: PromiseLike<number | undefined>; readonly fullStream: AsyncIterableStream<unknown> }>(result: R, close?: CloseAudio): R {
	if (!close) return result;
	let observed = false;
	return new Proxy(result, {
		get(target, key, receiver) {
			const value: unknown = Reflect.get(target, key, receiver);
			if (!observed && (key === 'fullStream' || value instanceof Promise)) {
				observed = true;
				void Promise.resolve(target.durationInSeconds).then(() => close(), (error: unknown) => close(error)).catch(() => { /* Preserve the native result. */ });
			}
			return key === 'fullStream' ? ownedAudioView(value as ReadableStream<unknown>, close) : value;
		},
	});
}

/** Both audio-input components hand off one SDK request. Live delivery transfers consumption to the caller. */
export async function withAudioInput<R>(prepared: PreparedComponentCall, dispatch: (settings: Fields, close?: CloseAudio) => Promise<R>, transcription?: RecordingSdk): Promise<R> {
	const settings = sdkRequest(prepared, ['mediaSettings', 'fileAudioTarget', 'sourceFormat', 'maxPreparedAudioBytes']);
	const { fileAudioTarget, mediaSettings } = prepared.settings;
	const maxPreparedAudioBytes = prepared.settings.maxPreparedAudioBytes as number | undefined;
	const sourceFormat = prepared.settings.sourceFormat as PcmSourceFormat | undefined;
	const resource = prepared.settings[sourceMode] === 'audio-resource';
	let close: CloseAudio | undefined;
	let mediaType: string | undefined;
	if (settings.audio == null) throw new ValidationError('Audio input is required.');
	const streamFile = Boolean(prepared.settings[streamMode] && settings.inputAudioFormat === undefined);
	const explicit = transcription && isTranscriptionFile(settings.audio) ? settings.audio : undefined;
	const unnamedBytes = !streamFile && (resource || (explicit ? explicit.filename === undefined && isUint8Array(explicit.data) : isUint8Array(settings.audio) || isArrayBuffer(settings.audio)));
	const makeFile = transcription && settings.inputAudioFormat === undefined && (typeof settings.model !== 'string' || explicit || streamFile || unnamedBytes)
		? recordingUpload(transcription, settings.model, streamFile, unnamedBytes) : undefined;
	if (explicit && (resource || settings.inputAudioFormat !== undefined)) {
		throw new ValidationError('A transcription file supplies its own encoded input. Remove inputAudioFormat or .loadsAudio.');
	}
	if ((explicit || streamFile && (resource || isWebBlob(settings.audio))) && !makeFile) {
		throw new ValidationError('File delivery requires an AI SDK and transcription adapter with native recording upload support.');
	}
	if (streamFile && !explicit && !resource && !isWebBlob(settings.audio)) throw new ValidationError('Transcriber.asStream requires inputAudioFormat for live input or a transcription file.');
	const blobFile = !resource && makeFile && isWebBlob(settings.audio)
		? await describeBlob(settings.audio, makeFile, sourceFormat !== undefined && !streamFile, prepared.context._toolOptions.abortSignal) : undefined;
	if (explicit && makeFile) {
		settings.audio = makeFile(explicit.data, explicit);
	} else if (blobFile) {
		settings.audio = blobFile;
	} else if (resource) {
		if (isPcmSamples(settings.audio) && !sourceFormat) throw new ValidationError('Headerless sample arrays require sourceFormat.sampleRate and sourceFormat.channels.');
		const { openAudio } = await import('#prepared-audio');
		const owned = await openAudio(settings.audio as AudioSource, { inputAudioFormat: settings.inputAudioFormat, fileAudioTarget,
			mediaSettings, sourceFormat, maxPreparedAudioBytes, abortSignal: settings.abortSignal, supplied: prepared.supplied } as PrepareAudioSettings);
		close = owned.close;
		settings.audio = owned.audio;
		if ('format' in owned.format) mediaType = preparedAudioTypes[owned.format.format];
	} else {
		const supplied = await prepareSuppliedAudio(settings.audio, settings.inputAudioFormat as AudioFormat | undefined, sourceFormat, prepared.context._toolOptions.abortSignal, maxPreparedAudioBytes);
		close = supplied.close;
		settings.audio = supplied.audio;
		mediaType = supplied.mediaType;
	}
	// The SDK combines a supplied signal with its own using AbortSignal.any.
	if (close && prepared.settings[streamMode] && typeof AbortSignal.any === 'function') {
		const release = close;
		const abort = new AbortController();
		const signal = prepared.context._toolOptions.abortSignal;
		settings.abortSignal = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
		close = (...reasons: [reason?: unknown]) => {
			const cleaned = release(...reasons);
			if (reasons.length) abort.abort(reasons[0]);
			return cleaned;
		};
	}
	try {
		prepared.context._toolOptions.abortSignal?.throwIfAborted();
		if (settings.inputAudioFormat !== undefined) {
			const stream = rawStream(settings.audio);
			claimLiveInput(stream);
			settings.audio = stream;
		}
		else if (makeFile && mediaType && settings.audio instanceof Uint8Array) {
			settings.audio = makeFile(settings.audio, { mediaType });
		} else if (streamFile && !isTranscriptionFile(settings.audio)) {
			throw new ValidationError('Supply a transcription file with its MIME type or describe live audio with inputAudioFormat.');
		} else if (resource || mediaType) {
			// Byte-only adapters infer the upload label. Verify it before dispatch.
			const bytes = settings.audio instanceof ArrayBuffer ? new Uint8Array(settings.audio) : settings.audio as Uint8Array;
			const detected = audioMediaType(detectMediaType({ data: bytes, topLevelType: 'audio' }) ?? 'audio/wav');
			if (!mediaType || detected !== mediaType) throw new ValidationError('The AI SDK cannot accurately label this supplied audio container. Use .loadsAudio with a recognizable fileAudioTarget such as WAV or FLAC.');
		}
		const result = await dispatch(settings, close);
		if (!prepared.settings[streamMode]) await close?.();
		return result;
	} catch (error) {
		await close?.(error).catch(() => { /* Preserve the original failure or cancellation. */ });
		throw error;
	}
}
