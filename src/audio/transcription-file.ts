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

/** Resolve a registered V4 model once when an automatic Blob can use either native upload or bytes. */
export function recordingModelForBlob(id: string) {
	const provider = globalThis.AI_SDK_DEFAULT_PROVIDER ?? sdk.gateway;
	return 'specificationVersion' in provider && provider.specificationVersion === 'v4' && provider.transcriptionModel
		? provider.transcriptionModel(id) : id;
}

/** Published SDKs can still execute ordinary recording and live audio calls. */
export function recordingUpload({ transcriptionFile: create }: RecordingSdk, model: unknown, stream: boolean, unnamedBytes: boolean): MakeFile | undefined {
	const method = stream ? 'doStreamFromFile' : 'doGenerateFromFile';
	if (typeof create === 'function' && (unnamedBytes || (typeof model === 'object' && model !== null && typeof Reflect.get(model, method) === 'function') || typeof model === 'string')) {
		return create;
	}
	return undefined;
}

/** ID3 can prefix more than one encoding. Its length locates the first frame beyond a Blob's inspected prefix. */
export async function taggedAudioType(bytes: Uint8Array, blob?: Blob, signal?: AbortSignal): Promise<string | undefined> {
	const detected = detectMediaType({ data: bytes, topLevelType: 'audio' });
	if (detected || !blob || bytes.length >= blob.size) return detected;
	const frame = 10 + bytes.subarray(6, 10).reduce((size, byte) => size * 128 + byte, 0);
	if (frame >= blob.size || frame + 16 <= bytes.length) return undefined;
	const signature = new Uint8Array(await blob.slice(frame, frame + 16).arrayBuffer());
	signal?.throwIfAborted();
	return detectMediaType({ data: signature, topLevelType: 'audio' });
}

/** Ordinary Blob inputs use the same bounded header evidence as byte input. Explicit descriptions are authoritative. */
export async function describeBlob(blob: Blob, create: MakeFile, hasPcmLayout: boolean, signal?: AbortSignal): Promise<TranscriptionFile | undefined> {
	const bytes = new Uint8Array(await blob.slice(0, audioPrefixBytes).arrayBuffer());
	signal?.throwIfAborted();
	const container = audioContainer(bytes);
	const label = audioMediaType(blob.type);
	const declared = label?.startsWith('audio/') || label?.startsWith('video/') ? label : undefined;
	const mediaType = container === 'ID3' ? declared ?? await taggedAudioType(bytes, blob, signal)
		: container === 'ftyp' ? declared : container ?? declared ?? detectMediaType({ data: bytes, topLevelType: 'audio' });
	if (hasPcmLayout && !container && (mediaType == null || mediaType === 'audio/pcm')) return undefined;
	if (!mediaType?.includes('/') || mediaType === 'audio/pcm') {
		throw new ValidationError('Supply the encoded recording MIME using a transcription file, or describe raw samples with inputAudioFormat.');
	}
	return create(blob, { mediaType: mediaType === blob.type.split(';')[0].trim().toLowerCase() ? blob.type : mediaType });
}
