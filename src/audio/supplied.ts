import { ValidationError } from '../errors.js';
import { isAudioBufferSource, isWebBlob, isWebStream, isWebURL } from '../runtime/web-input.js';
import { convertBase64ToUint8Array, detectMediaType, isArrayBuffer, isUint8Array } from '@ai-sdk/provider-utils';
import type { AudioFormat } from '../audio.js';
import { asMonoPcm16, isPcmSamples, preparePcmStream, readWav, resamplePcm16, sampleFormat, writeWav, type PcmFormat, type PcmSourceFormat } from './pcm.js';
import { runPcm } from './pcm-pool.js';
import { copyAudioPlanes } from './buffer-copy.js';
import { pcmFrameSize } from './pcm-format.js';
import { checkPreparedAudioBytes, defaultPreparedAudioBytes } from './preparation.js';
import { audioContainer, audioMediaType, checkMimeLayout, encodedAudioType } from './source-evidence.js';

function pcmRate(target: AudioFormat): number {
	if (target.type !== 'audio/pcm' || !Number.isSafeInteger(target.rate) || target.rate! <= 0) {
		throw new ValidationError('PCM conversion requires an inputAudioFormat target with type "audio/pcm" and a positive sample rate.');
	}
	return target.rate!;
}

function checkPcmOutput(inputBytes: number, format: PcmFormat, target: AudioFormat | undefined, limit: number) {
	const outputBytes = target
		? Math.round(inputBytes / pcmFrameSize(format) / (format.sampleRate / pcmRate(target))) * 2
		: 44 + inputBytes + (inputBytes & 1);
	checkPreparedAudioBytes(outputBytes, limit);
}

/** Prepare only supplied media. URLs and native file inputs keep the SDK's own download rules. */
export async function prepareSuppliedAudio(audio: unknown, target?: AudioFormat, source?: PcmSourceFormat, signal?: AbortSignal, limit = defaultPreparedAudioBytes): Promise<{ audio: unknown; mediaType?: string | undefined; close?: (reason?: unknown) => Promise<void> }> {
	let format: PcmFormat | undefined;
	if (isAudioBufferSource(audio)) {
		const recording = audio;
		format = { encoding: 'pcm_f32le', channels: recording.numberOfChannels, sampleRate: recording.sampleRate };
		checkPcmOutput(recording.length * pcmFrameSize(format), format, target, limit);
		audio = await runPcm('interleaveChannels', async copy => [await copyAudioPlanes(recording, copy)], signal);
	} else if (isPcmSamples(audio)) {
		if (!source) throw new ValidationError('Headerless sample arrays require sourceFormat.sampleRate and sourceFormat.channels.');
		format = sampleFormat(source, audio);
		audio = new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength);
	}
	const file = isWebBlob(audio) ? audio : undefined;
	if (file) audio = await file.arrayBuffer();
	signal?.throwIfAborted();
	const base64WithLayout = !target && typeof audio === 'string' && source !== undefined;
	if (!target && typeof audio === 'string') {
		// The SDK needs these bytes anyway. Give it the same decoded recording that we inspect.
		try { audio = convertBase64ToUint8Array(audio); }
		catch { return { audio }; } // Native transcription reports its own invalid-base64 error and telemetry.
		source = undefined;
	}
	if (!target && isWebURL(audio)) return { audio: audio instanceof URL ? audio : new URL((audio as URL).href) };
	if (isWebStream(audio) && source) {
		if (!target) throw new ValidationError('A headerless PCM stream requires inputAudioFormat.');
		format = sampleFormat(source, audio);
		return preparePcmStream(audio as ReadableStream<Uint8Array | string>, format.sampleRate, pcmRate(target), format, signal);
	}
	let bytes: Uint8Array;
	if (isUint8Array(audio)) bytes = new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength);
	else if (isArrayBuffer(audio)) bytes = new Uint8Array(audio);
	else {
		if (source) throw new ValidationError('A direct sourceFormat requires supplied PCM samples.');
		return { audio };
	}
	let mediaType: string | undefined;
	if (!format) {
		const container = audioContainer(bytes);
		const declared = audioMediaType(file?.type);
		if (!container && file && declared === 'audio/pcm') {
			checkMimeLayout(file.type, source?.sampleRate ?? target?.rate, source?.channels ?? (target ? 1 : undefined));
		}
		mediaType = container === 'ID3' ? declared ?? (target ? undefined : detectMediaType({ data: bytes, topLevelType: 'audio' }))
			: container === 'ftyp' ? declared : container ?? declared;
		if (container === 'audio/wav') {
			if (!target) return { audio: bytes, mediaType: 'audio/wav' };
			({ audio: bytes, format } = await readWav(bytes, signal));
		} else if (container || encodedAudioType(mediaType)) {
			// Native raw mu-law/A-law targets can consume matching supplied bytes without PCM reinterpretation.
			if (!container && target && target.type === mediaType && (mediaType === 'audio/pcmu' || mediaType === 'audio/pcma')) {
				checkMimeLayout(file!.type, target.rate, 1);
				return { audio: bytes };
			}
			if (target) throw new ValidationError(container
				? 'For raw model input, pass an uncompressed WAV or described PCM. Use .loadsAudio to decode other recording formats.'
				: 'The declared Blob MIME type is incompatible with raw model input. Supply correctly labeled raw audio or use .loadsAudio to decode an encoded recording.');
			if (!mediaType) throw new ValidationError('The AI SDK cannot accurately label this supplied audio container. Use .loadsAudio.');
			return { audio: bytes, mediaType };
		} else if (source) format = sampleFormat(source, audio);
		else {
			if (base64WithLayout) {
				throw new ValidationError('Cannot identify the base64 recording. For headerless PCM, pass decoded bytes with sourceFormat.');
			}
			if (target && mediaType && audioMediaType(target.type) !== mediaType) throw new ValidationError('The supplied audio MIME type does not match inputAudioFormat.');
			return { audio: bytes, mediaType };
		}
	}
	checkPcmOutput(bytes.byteLength, format, target, limit);
	if (!target) return { audio: await writeWav(bytes, format, signal), mediaType: 'audio/wav' };
	const rate = pcmRate(target);
	return { audio: await resamplePcm16(await asMonoPcm16(bytes, format, signal), format.sampleRate, rate, signal) };
}
