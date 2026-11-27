import { ValidationError } from '../errors.js';
import { isAudioBufferSource, isWebBlob, isWebStream, isWebURL } from '../runtime/web-input.js';
import { convertBase64ToUint8Array, isArrayBuffer, isUint8Array } from '@ai-sdk/provider-utils';
import type { AudioFormat } from '../audio.js';
import { asMonoPcm16, isPcmSamples, preparePcmStream, readWav, resamplePcm16, sampleFormat, writeWav, type PcmFormat, type PcmSourceFormat } from './pcm.js';
import { runPcm } from './pcm-pool.js';
import { copyAudioPlanes } from './buffer-copy.js';
import { pcmFrameSize } from './pcm-format.js';
import { checkPreparedAudioBytes, defaultPreparedAudioBytes } from './preparation.js';
import { audioContainer, audioMediaType, audioPrefixBytes, checkMimeLayout, encodedAudioType } from './source-evidence.js';
import { taggedAudioType } from './transcription-file.js';

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

function declaredCodecs(type: string): string | undefined {
	const match = /;\s*codecs\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(type);
	return (match?.[1] ?? match?.[2])?.toLowerCase().split(',').map(codec => codec.trim()).sort().join(',');
}

/** Reuse inspected bytes and read an immutable Blob's remaining ranges only as the live consumer asks. */
export function streamAudioBytes(bytes: Uint8Array, file?: Blob): ReadableStream<Uint8Array> {
	const size = file?.size ?? bytes.byteLength;
	let offset = 0;
	return new ReadableStream({
		async pull(controller) {
			if (offset === size) { controller.close(); return; }
			// 200 ms of 24 kHz mono PCM16. A native Blob stream can yield a multi-megabyte part in one read.
			const end = Math.min(offset + 9600, offset < bytes.length ? bytes.length : size);
			const chunk = file && offset >= bytes.length ? new Uint8Array(await file.slice(offset, end).arrayBuffer()) : bytes.subarray(offset, end);
			if (chunk.byteLength !== end - offset) throw new ValidationError('The audio Blob ended before its declared size.');
			offset = end;
			controller.enqueue(chunk);
		},
	}, { highWaterMark: 0 });
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
	if (file) audio = await (target ? file.slice(0, audioPrefixBytes) : file).arrayBuffer();
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
		const targetType = audioMediaType(target?.type);
		if (!container && file && declared === 'audio/pcm') {
			checkMimeLayout(file.type, source?.sampleRate ?? target?.rate, source?.channels ?? (target ? 1 : undefined));
		}
		mediaType = container === 'ID3' ? declared ?? (targetType === 'audio/pcm' ? undefined : await taggedAudioType(bytes, file, signal))
			: container === 'ftyp' ? declared : container ?? declared;
		const companded = targetType === 'audio/pcmu' || targetType === 'audio/pcma';
		if (target && targetType === mediaType && (mediaType?.startsWith('audio/') || mediaType?.startsWith('video/'))
			&& mediaType !== 'audio/pcm' && !(companded && container)) {
			if (file && declared === mediaType) {
				checkMimeLayout(file.type, target.rate, companded ? 1 : undefined);
				const codecs = declaredCodecs(target.type), sourceCodecs = declaredCodecs(file.type);
				if (codecs !== undefined && sourceCodecs !== undefined && codecs !== sourceCodecs) throw new ValidationError('The supplied recording codecs conflict with inputAudioFormat.');
			}
			return { audio: file ? streamAudioBytes(bytes, file) : bytes };
		}
		if (container === 'audio/wav' && (!target || targetType === 'audio/pcm')) {
			if (!target) return { audio: bytes, mediaType: 'audio/wav' };
			if (file && file.size > bytes.length) bytes = new Uint8Array(await file.arrayBuffer());
			({ audio: bytes, format } = await readWav(bytes, signal));
		} else if (container || encodedAudioType(mediaType)) {
			if (target) throw new ValidationError(container
				? 'The recording does not match inputAudioFormat. Use its accepted format for direct input or use .loadsAudio to decode it.'
				: 'The declared Blob MIME type is incompatible with raw model input. Supply correctly labeled raw audio or use .loadsAudio to decode an encoded recording.');
			if (!mediaType) throw new ValidationError('The AI SDK cannot accurately label this supplied audio container. Use .loadsAudio.');
			return { audio: bytes, mediaType };
		} else if (source) {
			format = sampleFormat(source, audio);
			if (file && target) {
				checkPcmOutput(file.size, format, target, limit);
				if (file.size % pcmFrameSize(format)) throw new ValidationError('PCM ends with an incomplete audio frame.');
				return preparePcmStream(streamAudioBytes(bytes, file), format.sampleRate, pcmRate(target), format, signal);
			}
		} else {
			if (base64WithLayout) {
				throw new ValidationError('Cannot identify the base64 recording. For headerless PCM, pass decoded bytes with sourceFormat.');
			}
			if (target && mediaType && audioMediaType(target.type) !== mediaType) throw new ValidationError('The supplied audio MIME type does not match inputAudioFormat.');
			return { audio: file && target ? streamAudioBytes(bytes, file) : bytes, mediaType };
		}
	}
	checkPcmOutput(bytes.byteLength, format, target, limit);
	if (!target) return { audio: await writeWav(bytes, format, signal), mediaType: 'audio/wav' };
	const rate = pcmRate(target);
	return { audio: await resamplePcm16(await asMonoPcm16(bytes, format, signal), format.sampleRate, rate, signal) };
}
