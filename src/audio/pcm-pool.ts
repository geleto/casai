import { ConfigError } from '../errors.js';
import { isArrayBuffer } from '@ai-sdk/provider-utils';
import type { PcmFormat } from './pcm.js';
import { createAudioInput } from './buffer-copy.js';
import { pcmWorkerError, type PcmJob, type PcmMethod, type PcmValue, type PcmWorker } from './pcm-worker-code.js';

const maxWorkers = 4, samplesPerJob = 256 * 1024;
interface Pending { resolve: (value: PcmValue) => void; reject: (error: unknown) => void }
interface Slot { worker: PcmWorker; pending?: Pending; failure?: { error: unknown } }
interface Lane {
	slot?: Slot;
	queued: number;
	tail: Promise<void>;
	closing: Promise<void>;
	idle?: ReturnType<typeof setTimeout>;
}
const lanes: Lane[] = [];

function closeLane(lane: Lane, error?: unknown): Promise<void> {
	clearTimeout(lane.idle);
	const slot = lane.slot;
	if (slot) {
		delete lane.slot;
		slot.failure = { error };
		slot.pending?.reject(error); delete slot.pending;
		lane.closing = Promise.resolve(slot.worker.close());
	}
	return lane.closing;
}
function dispatch<K extends PcmMethod>(slot: Slot, job: PcmJob<K>, transfer: ArrayBuffer[]): Promise<PcmValue<K>> {
	// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Preserve the worker's rejection value.
	if (slot.failure) return Promise.reject(slot.failure.error);
	return new Promise<PcmValue>((resolve, reject) => {
		slot.pending = { resolve, reject };
		slot.worker.postMessage(job as PcmJob, transfer);
	}) as Promise<PcmValue<K>>;
}
async function createSlot(fail: (error: unknown) => void): Promise<Slot> {
	const backend = await import('#pcm-worker');
	if (!backend.availableParallelism()) throw new ConfigError('Audio processing requires Web Workers (allow blob: workers in browser CSP) or Node worker threads.');
	const slot: Slot = { worker: backend.createPcmWorker(response => {
		const pending = slot.pending; delete slot.pending;
		if ('error' in response) pending?.reject(pcmWorkerError(response));
		else pending?.resolve(response.value);
	}, fail) };
	return slot;
}
async function schedule<T>(action: (slot: Slot) => Promise<T>): Promise<T> {
	const backend = await import('#pcm-worker');
	let lane = lanes.reduce<Lane | undefined>((least, current) => !least || current.queued < least.queued ? current : least, undefined);
	if (!lane || lane.queued && lanes.length < Math.min(maxWorkers, backend.availableParallelism())) {
		lane = { queued: 0, tail: Promise.resolve(), closing: Promise.resolve() }; lanes.push(lane);
	}
	const selected = lane;
	selected.queued++; clearTimeout(selected.idle);
	const result = selected.tail.then(async () => {
		try {
			await selected.closing;
			selected.slot ??= await createSlot(error => { void closeLane(selected, error).catch(() => { /* Preserve the worker failure. */ }); });
			return await action(selected.slot);
		} catch (error) {
			await closeLane(selected, error).catch(() => { /* Preserve the processing failure. */ });
			throw error;
		}
	});
	selected.tail = result.then(() => undefined, () => undefined);
	return result.finally(() => {
		if (--selected.queued === 0 && selected.slot) {
			selected.idle = setTimeout(() => { void closeLane(selected).catch(() => { /* Idle workers own no result. */ }); }, 5000);
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Browser timers are numeric.
			selected.idle.unref?.();
		}
	});
}

/** Each finite operation borrows one worker; allocation and computation share the same bounded pool. */
export function runPcm<K extends PcmMethod>(type: K, prepare: (copy: ReturnType<typeof createAudioInput>['copy']) => Promise<PcmJob<K>['args']>, signal?: AbortSignal): Promise<PcmValue<K>> {
	return schedule(async slot => {
		signal?.throwIfAborted();
		const { copy, transfer } = createAudioInput(byteLength => dispatch(slot, { type: 'allocate', args: [byteLength] }, []), signal);
		const args = await prepare(copy);
		signal?.throwIfAborted();
		const result = await dispatch(slot, { type, args }, transfer);
		signal?.throwIfAborted();
		return result;
	});
}
export async function resamplePcm16Auto(bytes: Uint8Array, ratio: number, count: number, signal?: AbortSignal): Promise<Uint8Array> {
	if (!count) return new Uint8Array(0);
	const backend = await import('#pcm-worker');
	const workers = Math.max(1, Math.min(maxWorkers, backend.availableParallelism(), Math.floor(count / samplesPerJob)));
	const totalSamples = bytes.byteLength / 2;
	const output = workers > 1 && typeof SharedArrayBuffer === 'function'
		&& (typeof crossOriginIsolated === 'undefined' || crossOriginIsolated)
		? await schedule(slot => dispatch(slot, { type: 'allocateShared', args: [count * 2] }, [])) : undefined;
	const { copy } = createAudioInput(byteLength => schedule(slot => dispatch(slot, { type: 'allocate', args: [byteLength] }, [])), signal);
	async function* prepare() {
		for (let start = 0; start < count; start += samplesPerJob) {
			const end = Math.min(start + samplesPerJob, count);
			const inputStart = Math.floor(start * ratio), inputEnd = Math.min(totalSamples, Math.floor((end - 1) * ratio) + 2);
			const input = await copy(bytes.subarray(inputStart * 2, inputEnd * 2));
			yield { type: 'resample', args: [input, ratio, start, end - start, inputStart, totalSamples, output?.subarray(start * 2, end * 2)] } satisfies PcmJob<'resample'>;
		}
	}
	const jobs = prepare(), parts: Uint8Array[] = [];
	// One iterator serializes input copying under its budget. Consumers queue only their next bounded job.
	await Promise.all(Array.from({ length: workers }, async () => {
		for await (const job of jobs) {
			signal?.throwIfAborted();
			parts[job.args[2] / samplesPerJob] = await schedule(slot => dispatch(slot, job, job.args[0].buffer instanceof ArrayBuffer ? [job.args[0].buffer] : []));
		}
	}));
	// Completion messages publish each disjoint range; the caller receives only the finished buffer.
	signal?.throwIfAborted();
	if (output) return output;
	return parts.length === 1 ? parts[0] : schedule(slot => dispatch(slot, { type: 'concatAudio', args: [parts] }, parts.map(part => part.buffer).filter(buffer => buffer instanceof ArrayBuffer)));
}

/** One ordered worker per stream, independent of the finite queue and owned until EOF/cancellation. */
export function streamingPcmWorker() {
	let opening: Promise<Slot> | undefined, closing: Promise<void> | undefined, closeReason: unknown;
	const close = (reason: unknown = new DOMException('Audio stream was cancelled.', 'AbortError')) => closing ??= (async () => {
		closeReason = reason;
		const current = await opening?.catch(() => undefined);
		current?.pending?.reject(reason);
		if (current) { delete current.pending; await current.worker.close(); }
	})();
	return {
		async resample(input: Uint8Array | string | undefined, ratio: number, format?: PcmFormat, moreBase64 = false): Promise<Uint8Array> {
			if (!input && !opening) return new Uint8Array(0);
			const slot = await (opening ??= createSlot(error => { void close(error).catch(() => { /* Preserve the worker failure. */ }); }));
			if (closing) throw closeReason;
			const chunk = input && typeof input !== 'string' && isArrayBuffer(input.buffer) ? Uint8Array.from(input) : input;
			return dispatch(slot, { type: 'resampleStream', args: [chunk, ratio, format, moreBase64] }, chunk instanceof Uint8Array && chunk.buffer instanceof ArrayBuffer ? [chunk.buffer] : []);
		},
		close,
	};
}
