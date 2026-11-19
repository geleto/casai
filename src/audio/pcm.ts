import { ValidationError } from '../errors.js';
import type { AudioBytes } from '../audio.js';
import { resamplePcm16Auto, runPcm, streamingPcmWorker } from './pcm-pool.js';
import { yieldAudioWork } from './buffer-copy.js';
import { claimLiveInput } from '../runtime/live-input.js';
export { isPcmSamples, sampleFormat } from './pcm-format.js';

export interface PcmFormat {
	sampleRate: number;
	channels: number;
	encoding: 'pcm_u8' | 'pcm_s16le' | 'pcm_s24le' | 'pcm_s32le' | 'pcm_f32le' | 'pcm_f64le';
}
/** Headerless samples have no rate or channel count. A numeric sample array supplies its encoding. */
export type PcmSourceFormat = Omit<PcmFormat, 'encoding'> & { encoding?: PcmFormat['encoding'] };
export type PcmSamples = Int16Array | Int32Array | Float32Array | Float64Array;


export function asMonoPcm16(bytes: Uint8Array, format: PcmFormat, signal?: AbortSignal) {
	if (format.channels === 1 && format.encoding === 'pcm_s16le') return bytes;
	if (format.channels === 1 && format.encoding === 'pcm_f32le' && bytes.byteOffset % 4 === 0 && bytes.length % 4 === 0) {
		return float32ToPcm16(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4), signal);
	}
	return runPcm('monoPcm16', async copy => [await copy(bytes), format], signal);
}
const bytesOf = (audio: AudioBytes) => audio instanceof Uint8Array ? audio : new Uint8Array(audio);
function positiveInteger(value: number, name: string) {
	if (!Number.isSafeInteger(value) || value <= 0) throw new ValidationError(`${name} must be a positive integer.`);
}

/** Clamp and encode samples in a worker, preserving the SDK PCM16 arithmetic. */
export function float32ToPcm16(samples: Float32Array, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
	return runPcm('float32ToPcm16', async copy => {
		const input = await copy(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
		return [new Float32Array(input.buffer, input.byteOffset, input.byteLength / 4)];
	}, signal);
}

/**
 * @experimental SDK-compatible linear resampling in workers; mono PCM16, without an anti-aliasing filter.
 * Parallel results may use shared backing memory. All workers finish writing before the promise resolves.
 */
export async function resamplePcm16(audio: AudioBytes, inputRate: number, outputRate: number, signal?: AbortSignal): Promise<Uint8Array> {
	signal?.throwIfAborted();
	positiveInteger(inputRate, 'inputRate'); positiveInteger(outputRate, 'outputRate');
	const bytes = bytesOf(audio);
	if (bytes.byteLength % 2) throw new ValidationError('PCM16 ends with an incomplete sample.');
	if (inputRate === outputRate) return bytes;
	const ratio = inputRate / outputRate;
	return resamplePcm16Auto(bytes, ratio, Math.round(bytes.byteLength / 2 / ratio), signal);
}

interface PcmStream<T> { audio: ReadableStream<T>; close?: (reason?: unknown) => Promise<void> }

/** A converter owns its source reader and worker even while the SDK holds the output reader. */
export function preparePcmStream(audio: ReadableStream<Uint8Array>, inputRate: number, outputRate: number, format?: PcmFormat, signal?: AbortSignal): PcmStream<Uint8Array>;
export function preparePcmStream(audio: ReadableStream<Uint8Array | string>, inputRate: number, outputRate: number, format?: PcmFormat, signal?: AbortSignal): PcmStream<Uint8Array | string>;
export function preparePcmStream(audio: ReadableStream<Uint8Array | string>, inputRate: number, outputRate: number, format?: PcmFormat, signal?: AbortSignal): PcmStream<Uint8Array | string> {
	positiveInteger(inputRate, 'inputRate'); positiveInteger(outputRate, 'outputRate');
	const ratio = inputRate / outputRate;
	const mono16 = !format || format.channels === 1 && format.encoding === 'pcm_s16le';
	if (ratio === 1 && mono16) return { audio };
	signal?.throwIfAborted();
	claimLiveInput(audio);
	const layout = mono16 && Number.isInteger(ratio) ? undefined : format ?? { sampleRate: inputRate, channels: 1, encoding: 'pcm_s16le' };
	const worker = streamingPcmWorker();
	let reader: ReadableStreamDefaultReader<Uint8Array | string> | undefined;
	let pending: Uint8Array | string = new Uint8Array(0);
	let closing: Promise<void> | undefined;
	let output: ReadableStreamDefaultController<Uint8Array>;
	const abort = () => { void close(signal!.reason).catch(() => { /* Preserve the abort reason. */ }); };
	const close = (reason?: unknown) => closing ??= (async () => {
		signal?.removeEventListener('abort', abort);
		pending = new Uint8Array(0);
		output.error(reason ?? new DOMException('Audio conversion ended.', 'AbortError'));
		try { await worker.close(reason); } finally {
			try { await (reader ? reader.cancel(reason) : audio.cancel(reason)); }
			finally { reader?.releaseLock(); }
		}
	})();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) { output = controller; },
		async pull(controller) {
			try {
				reader ??= audio.getReader();
				while (!closing) {
					let block: Uint8Array | string | undefined;
					if (!pending.length) {
						const item = await reader.read();
						// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Cancellation can arrive while awaiting input.
						if (closing) return;
						if (!item.done) {
							pending = item.value;
							if (!pending.length) { await yieldAudioWork(); continue; }
						}
					}
					if (pending.length) {
						// The worker keeps base64 quartets across pieces of the same producer chunk.
						block = typeof pending === 'string' ? pending.slice(0, 32768) : pending.subarray(0, 32768);
						pending = typeof pending === 'string' ? pending.slice(block.length) : pending.subarray(block.length);
					}
					const result = await worker.resample(block, ratio, layout, typeof pending === 'string' && pending.length > 0);
					if (!block) await worker.close();
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Cancellation can arrive during processing or shutdown.
					if (closing) return;
					if (result.length) controller.enqueue(result);
					if (!block) {
						controller.close(); reader.releaseLock();
						signal?.removeEventListener('abort', abort);
						closing = Promise.resolve();
					}
					if (!block || result.length) return;
				}
			} catch (error) {
				await close(error).catch(() => { /* Preserve the conversion error. */ });
			}
		},
		cancel: close,
	}, { highWaterMark: 0 });
	signal?.addEventListener('abort', abort, { once: true });
	return { audio: stream, close };
}

/** Parse a PCM WAV in a worker, preserving its PCM bytes and format; shared input may yield a shared view. */
export function readWav(audio: AudioBytes, signal?: AbortSignal): Promise<{ audio: Uint8Array; format: PcmFormat }> {
	return runPcm('readWav', async copy => [await copy(bytesOf(audio))], signal);
}
/** Wrap known PCM in a WAV container off the calling thread; no conversion or inferred format. */
export function writeWav(audio: AudioBytes, format: PcmFormat, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
	return runPcm('writeWav', async copy => [await copy(bytesOf(audio)), format], signal);
}
