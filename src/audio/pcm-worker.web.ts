import type { PcmWorker, PcmResponse } from './pcm-worker-code.js';
import { pcmWorkerSource } from './worker-sources.js';

export function availableParallelism(): number {
	if (typeof Worker === 'undefined') return 0;
	return typeof navigator === 'undefined' ? 1 : navigator.hardwareConcurrency || 1;
}
export function createPcmWorker(receive: (response: PcmResponse) => void, fail: (error: unknown) => void): PcmWorker {
	const url = URL.createObjectURL(new Blob([pcmWorkerSource], { type: 'text/javascript' }));
	let worker: Worker;
	try { worker = new Worker(url); }
	catch (error) { URL.revokeObjectURL(url); throw error; }
	worker.onmessage = (event: MessageEvent<PcmResponse>) => { receive(event.data); };
	worker.onmessageerror = () => { fail(new Error('Could not receive the PCM worker result.')); };
	worker.onerror = event => { event.preventDefault(); fail(event.error ?? new Error(event.message)); };
	return {
		postMessage: (request, transfer) => { worker.postMessage(request, transfer); },
		close() { worker.terminate(); URL.revokeObjectURL(url); },
	};
}
