import { isArrayBuffer } from '@ai-sdk/provider-utils';
import type { AudioBufferSource } from '../audio.js';
import { ValidationError } from '../errors.js';
import { sampleEncoding, validatePcmLayout } from './pcm-format.js';

/** A task boundary, not a microtask: let timers, I/O and other workflows progress. */
export function yieldAudioWork(): Promise<void> {
	if (typeof setImmediate === 'function') return new Promise(resolve => { setImmediate(resolve); });
	const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
	if (scheduler?.yield) return scheduler.yield();
	return new Promise(resolve => {
		// One-shot ports avoid timer clamping without retaining an idle channel or a scheduling queue.
		const { port1, port2 } = new MessageChannel();
		port1.onmessage = () => { port1.close(); port2.close(); resolve(); };
		port2.postMessage(null);
	});
}

const copyStep = 256 * 1024, turnBytes = 1024 * 1024;

export async function copyAudioPlanes(recording: AudioBufferSource, copy: (bytes: Uint8Array) => Promise<Uint8Array>) {
	const { length, numberOfChannels: channels, sampleRate } = recording;
	validatePcmLayout({ channels, sampleRate }, ValidationError);
	if (!Number.isSafeInteger(length) || length < 0) throw new ValidationError('AudioBuffer length must be a nonnegative integer.');
	const planes: Uint8Array[] = [];
	for (let channel = 0; channel < channels; channel++) {
		const samples = recording.getChannelData(channel);
		if (sampleEncoding(samples) !== 'pcm_f32le' || samples.length !== length) {
			throw new ValidationError('Each AudioBuffer channel must contain its declared number of Float32 samples.');
		}
		planes.push(await copy(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength)));
	}
	return planes;
}

/** One preparation owns one copy budget and transfer list, including across small/empty chunks. */
export function createAudioInput(allocate: (byteLength: number) => Promise<Uint8Array<ArrayBuffer>>, signal?: AbortSignal) {
	const transfer: ArrayBuffer[] = [];
	let copied = 0, started = performance.now();
	async function checkpoint(size = 0) {
		signal?.throwIfAborted();
		copied += size;
		if (copied >= turnBytes || performance.now() - started >= 1) {
			await yieldAudioWork();
			copied = 0; started = performance.now();
			signal?.throwIfAborted();
		}
	}
	function copy(input: Uint8Array): Promise<Uint8Array>;
	function copy(input: Uint8Array | string): Promise<Uint8Array | string>;
	async function copy(input: Uint8Array | string): Promise<Uint8Array | string> {
		await checkpoint();
		// Workers only read input. Shared views retain their offsets and never enter the transfer list.
		if (typeof input === 'string' || !isArrayBuffer(input.buffer)) return input;
		// Large zero-filled allocations also belong off the calling thread.
		const output = input.byteLength > copyStep ? await allocate(input.byteLength) : new Uint8Array(input.byteLength);
		for (let start = 0; start < input.byteLength;) {
			signal?.throwIfAborted();
			const part = input.subarray(start, start + Math.min(copyStep, turnBytes - copied));
			output.set(part, start);
			start += part.byteLength;
			await checkpoint(part.byteLength);
		}
		transfer.push(output.buffer);
		return output;
	}
	return { copy, transfer };
}
