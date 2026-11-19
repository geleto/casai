import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { PcmWorker, PcmResponse } from './pcm-worker-code.js';
import { pcmWorkerSource } from './worker-sources.js';

export { availableParallelism };
export function createPcmWorker(receive: (response: PcmResponse) => void, fail: (error: unknown) => void): PcmWorker {
	const worker = new Worker(pcmWorkerSource, { eval: true });
	let closed = false;
	worker.on('message', (response: PcmResponse) => { worker.unref(); receive(response); });
	worker.on('messageerror', fail);
	worker.on('error', fail);
	worker.on('exit', code => { if (!closed) fail(new Error(`PCM worker exited unexpectedly (${code}).`)); });
	return {
		postMessage: (request, transfer) => { worker.ref(); worker.postMessage(request, transfer); },
		async close() { closed = true; await worker.terminate(); },
	};
}
