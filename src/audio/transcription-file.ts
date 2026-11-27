import * as sdk from 'ai';
import { detectMediaType, isUint8Array } from '@ai-sdk/provider-utils';
import type { TranscriptionFile } from '../audio.js';
import { ValidationError } from '../errors.js';
import { isWebBlob, isWebStream } from '../runtime/web-input.js';
import { audioContainer, audioMediaType, audioPrefixBytes } from './source-evidence.js';

export function isTranscriptionFile(value: unknown): value is TranscriptionFile {
	return typeof value === 'object' && value !== null && 'type' in value && value.type === 'file' && 'data' in value
		&& (isWebBlob(value.data) || isUint8Array(value.data) || isWebStream(value.data));
}

type MakeFile = (data: TranscriptionFile['data'], options: { mediaType: string; filename?: string }) => TranscriptionFile;
export interface RecordingSdk { transcriptionFile?: MakeFile }
export const recordingSdk = sdk as typeof sdk & RecordingSdk;

/** Published SDKs can still execute ordinary recording and live audio calls. */
export function recordingUpload({ transcriptionFile: create }: RecordingSdk, model: unknown, stream: boolean, unnamedBytes: boolean): MakeFile | undefined {
	const method = stream ? 'doStreamFromFile' : 'doGenerateFromFile';
	if (typeof create === 'function' && (unnamedBytes || (typeof model === 'object' && model !== null && typeof Reflect.get(model, method) === 'function') || typeof model === 'string')) {
		return create;
	}
	return undefined;
}

/** Ordinary Blob inputs use the same bounded header evidence as byte input. Explicit descriptions are authoritative. */
export async function describeBlob(blob: Blob, create: MakeFile, hasPcmLayout: boolean, signal?: AbortSignal): Promise<TranscriptionFile | undefined> {
	const bytes = new Uint8Array(await blob.slice(0, audioPrefixBytes).arrayBuffer());
	signal?.throwIfAborted();
	const container = audioContainer(bytes);
	const label = audioMediaType(blob.type);
	const declared = label?.startsWith('audio/') || label?.startsWith('video/') ? label : undefined;
	const detected = detectMediaType({ data: bytes, topLevelType: 'audio' });
	let mediaType = container === 'ID3' ? declared ?? detected : container === 'ftyp' ? declared : container ?? declared ?? detected;
	if (container === 'ID3' && !mediaType && bytes.length < blob.size) {
		// An ID3v2 tag's four synchsafe bytes locate the first frame, even after large embedded artwork.
		const frame = 10 + bytes.subarray(6, 10).reduce((size, byte) => size * 128 + byte, 0);
		const end = frame + 16;
		if (frame < blob.size && end > bytes.length) {
			const signature = new Uint8Array(await blob.slice(frame, end).arrayBuffer());
			signal?.throwIfAborted();
			mediaType = detectMediaType({ data: signature, topLevelType: 'audio' });
		}
	}
	if (hasPcmLayout && !container && (mediaType == null || mediaType === 'audio/pcm')) return undefined;
	if (!mediaType?.includes('/') || mediaType === 'audio/pcm') {
		throw new ValidationError('Supply the encoded recording MIME using a transcription file, or describe raw samples with inputAudioFormat.');
	}
	return create(blob, { mediaType: mediaType === blob.type.split(';')[0].trim().toLowerCase() ? blob.type : mediaType });
}
