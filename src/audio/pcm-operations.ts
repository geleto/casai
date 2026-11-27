import type { AudioBytes } from '../audio.js';
import type { PcmFormat } from './pcm.js';
import { ValidationError } from '../errors.js';
import { pcmFrameSize as frameSize, sampleBytes } from './pcm-format.js';
import { convertBase64ToUint8Array } from '@ai-sdk/provider-utils';
export { convertUint8ArrayToBase64 as toBase64 } from '@ai-sdk/provider-utils';
export { resamplePcm16Range as resample } from './pcm-resample.js';

/** Allocate large input staging in a worker, then transfer it for bounded filling. */
export function allocate(byteLength: number): Uint8Array<ArrayBuffer> {
	return new Uint8Array(byteLength);
}

/** Allocate final parallel output in a worker as well as writing its samples there. */
export function allocateShared(byteLength: number): Uint8Array<SharedArrayBuffer> {
	return new Uint8Array(new SharedArrayBuffer(byteLength));
}

const integerEncodings: Partial<Record<number, PcmFormat['encoding']>> = { 8: 'pcm_u8', 16: 'pcm_s16le', 24: 'pcm_s24le', 32: 'pcm_s32le' };
const floatEncodings: Partial<Record<number, PcmFormat['encoding']>> = { 32: 'pcm_f32le', 64: 'pcm_f64le' };
const bytesOf = (audio: AudioBytes) => audio instanceof Uint8Array ? audio : new Uint8Array(audio);

/** Clamp to [-1, 1] and truncate to PCM16, matching the SDK audio encoder. */
export function float32ToPcm16(samples: Float32Array): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(samples.length * 2);
	const view = new DataView(bytes.buffer);
	for (let i = 0; i < samples.length; i++) {
		view.setInt16(i * 2, encodeSample(samples[i]), true);
	}
	return bytes;
}

function encodeSample(sample: number): number {
	const value = Math.max(-1, Math.min(1, sample));
	return value < 0 ? value * 32768 : value * 32767;
}

/** Web Audio exposes one Float32 array per channel. Make one interleaved recording in the worker. */
export function interleaveChannels(planes: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const samples = new Float32Array(planes[0].byteLength / 4 * planes.length);
	for (const [channel, plane] of planes.entries()) {
		const values = new Float32Array(plane.buffer, plane.byteOffset, plane.byteLength / 4);
		for (let i = 0; i < values.length; i++) samples[i * planes.length + channel] = values[i];
	}
	return new Uint8Array(samples.buffer);
}

/** Read interleaved frames in their declared endianness, including unaligned byte views. */
export function monoPcm16(bytes: Uint8Array, format: PcmFormat): Uint8Array {
	const frame = frameSize(format);
	if (bytes.length % frame) throw new ValidationError('PCM ends with an incomplete audio frame.');
	if (format.encoding === 'pcm_s16le' && format.channels === 1) return bytes;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const width = sampleBytes[format.encoding];
	const read = {
		pcm_u8: (i: number) => (view.getUint8(i) - 128) / 128,
		pcm_s16le: (i: number) => view.getInt16(i, true) / 32768,
		pcm_s24le: (i: number) => ((view.getInt8(i + 2) << 16) | view.getUint16(i, true)) / 8388608,
		pcm_s32le: (i: number) => view.getInt32(i, true) / 2147483648,
		pcm_f32le: (i: number) => view.getFloat32(i, true),
		pcm_f64le: (i: number) => view.getFloat64(i, true),
	}[format.encoding];
	const result = new Uint8Array(bytes.length / frame * 2), output = new DataView(result.buffer);
	for (let i = 0, offset = 0; i < bytes.length; i += frame, offset += 2) {
		let sum = 0;
		for (let c = 0; c < format.channels; c++) sum += read(i + c * width);
		output.setInt16(offset, encodeSample(sum / format.channels), true);
	}
	return result;
}

/** Read bounded RIFF/WAVE chunks without changing PCM samples. Other containers need native preparation. */
export function readWav(audio: AudioBytes): { audio: Uint8Array; format: PcmFormat } {
	const bytes = bytesOf(audio);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
	const invalid = () => new ValidationError('Invalid or unsupported PCM WAV container. Use .loadsAudio in Node.js for other WAV encodings.');
	if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw invalid();
	const riffSize = view.getUint32(4, true);
	const openRiff = riffSize === 0 || riffSize === 0xffffffff;
	const end = openRiff ? bytes.length : riffSize + 8;
	const available = Math.min(end, bytes.length);
	if (end < 12 || end > bytes.length + 1) throw invalid();
	let format: PcmFormat | undefined;
	const data: Uint8Array[] = [];
	for (let offset = 12; offset < end;) {
		if (offset + 8 > available) throw invalid();
		const kind = tag(offset), declared = view.getUint32(offset + 4, true), start = offset + 8;
		// Non-seekable WAV writers can leave the terminal data size unknown.
		const openData = kind === 'data' && (declared === 0xffffffff || (openRiff && declared === 0));
		const length = openData ? end - start : declared;
		const next = start + length + (openData ? 0 : length & 1);
		// Some writers omit the pad after the last odd data chunk. Every declared sample must exist.
		if (start + length > available || (next > available && kind !== 'data')) throw invalid();
		if (kind === 'fmt ') {
			if (length < 16 || format) throw invalid();
			let code = view.getUint16(start, true);
			const channels = view.getUint16(start + 2, true), sampleRate = view.getUint32(start + 4, true), bits = view.getUint16(start + 14, true);
			if (code === 0xfffe) {
				if (length < 40 || view.getUint16(start + 16, true) < 22) throw invalid();
				code = view.getUint32(start + 24, true);
				// Integer PCM is left-aligned when its precision is smaller than its storage width.
				const precision = view.getUint16(start + 18, true);
				if (!precision || precision > bits || code !== 1 && precision !== bits) throw invalid();
				const guidTail = [0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 155, 113];
				if (!guidTail.every((value, i) => bytes[start + 28 + i] === value)) throw invalid();
			}
			const encoding = code === 1 ? integerEncodings[bits] : code === 3 ? floatEncodings[bits] : undefined;
			if (!encoding) throw invalid();
			format = { sampleRate, channels, encoding };
			const size = frameSize(format);
			if (view.getUint16(start + 12, true) !== size) throw invalid();
		} else if (kind === 'data') data.push(bytes.subarray(start, start + length));
		offset = next;
	}
	if (!format || data.length === 0 || data.some(chunk => chunk.length % frameSize(format))) throw invalid();
	return { audio: data.length === 1 ? data[0] : concatAudio(data), format };
}

export function wavHeader(byteLength: number, format: PcmFormat): Uint8Array<ArrayBuffer> {
	const size = frameSize(format);
	if (byteLength % size) throw new ValidationError('PCM ends with an incomplete audio frame.');
	const padding = byteLength & 1;
	if (byteLength + padding > 0xffffffff - 36 || size > 65535 || format.channels > 65535 || format.sampleRate * size > 0xffffffff) throw new ValidationError('Audio exceeds the WAV container limits.');
	const output = new Uint8Array(44), view = new DataView(output.buffer);
	const tag = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) output[offset + i] = value.charCodeAt(i); };
	tag(0, 'RIFF'); view.setUint32(4, 36 + byteLength + padding, true); tag(8, 'WAVE');
	tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, format.encoding.startsWith('pcm_f') ? 3 : 1, true);
	view.setUint16(22, format.channels, true); view.setUint32(24, format.sampleRate, true); view.setUint32(28, format.sampleRate * size, true);
	view.setUint16(32, size, true); view.setUint16(34, sampleBytes[format.encoding] * 8, true);
	tag(36, 'data'); view.setUint32(40, byteLength, true);
	return output;
}

/** Wrap known PCM samples in a WAV container. No conversion or inferred format. */
export function writeWav(audio: AudioBytes, format: PcmFormat): Uint8Array<ArrayBuffer> {
	const bytes = bytesOf(audio);
	const header = wavHeader(bytes.length, format);
	const output = new Uint8Array(44 + bytes.length + (bytes.length & 1));
	output.set(header);
	output.set(bytes, 44);
	return output;
}

export function concatAudio(chunks: readonly (Uint8Array | string)[]): Uint8Array<ArrayBuffer> {
	const bytes = chunks.map(chunk => typeof chunk === 'string' ? convertBase64ToUint8Array(chunk) : chunk);
	const output = new Uint8Array(bytes.reduce((length, chunk) => length + chunk.byteLength, 0));
	let offset = 0;
	for (const chunk of bytes) { output.set(chunk, offset); offset += chunk.byteLength; }
	return output;
}
