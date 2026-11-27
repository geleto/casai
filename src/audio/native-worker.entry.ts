import { prepareNativeAudio, type NativeAudioSource } from './native-pipeline.js';
import { interleaveChannels } from './pcm-operations.js';
import type { NativeAv } from './native-interface.js';
import type { PrepareAudioSettings } from './preparation.js';
import type { MessagePort } from 'node:worker_threads';

export type NativeRequest = { type: 'open'; source: NativeAudioSource | Uint8Array[]; settings: Omit<PrepareAudioSettings, 'abortSignal'>; blobType?: string | undefined }
	| { type: 'allocate'; byteLength: number } | { type: 'read' } | { type: 'close' };
export type NativeResponse = { value: unknown } | { error: unknown; name?: string | undefined; properties?: Record<string, unknown> | undefined };

// Native handles remain in this worker until graceful shutdown, never abrupt termination.
async function serve(port: MessagePort, filename: string) {
	const abort = new AbortController();
	let pipeline: ReturnType<typeof prepareNativeAudio> | undefined;
	async function close() {
		// Interrupt a pending native or uploaded read before waiting for the iterator to unwind.
		abort.abort();
		await pipeline?.return(undefined);
	}
	function reply(value?: unknown, transfer: ArrayBuffer[] = []) {
		port.postMessage({ value } satisfies NativeResponse, transfer);
	}
	function failure(error: unknown) {
		// FFmpeg's code is a prototype getter backed by a native handle, which cannot cross isolates.
		const properties = error instanceof Error ? error.name === 'FFmpegError' && 'code' in error
			? { code: error.code } : Object.fromEntries(Object.entries(error)) : undefined;
		port.postMessage({ error, name: error instanceof Error ? error.name : undefined, properties } satisfies NativeResponse);
	}
	try {
		const av = await import(filename) as NativeAv;
		port.on('message', (request: NativeRequest) => {
			void (async () => {
				try {
					if (request.type === 'close') {
						await close();
						port.close(); return;
					}
					if (request.type === 'allocate') {
						const value = new Uint8Array(request.byteLength);
						reply(value, [value.buffer]);
					} else {
						if (request.type === 'open') {
							const source = Array.isArray(request.source) ? interleaveChannels(request.source) : request.source;
							pipeline = prepareNativeAudio(av, source, { ...request.settings, abortSignal: abort.signal } as PrepareAudioSettings, request.blobType);
						}
						const step = await pipeline!.next();
						const bytes = step.done ? step.value?.audio : step.value instanceof Uint8Array ? step.value : undefined;
						reply(step.value, bytes ? [bytes.buffer] : []);
						if (step.done) port.close();
					}
				} catch (error) {
					await close().catch(() => { /* Preserve the original failure. */ });
					failure(error); port.close();
				}
			})();
		});
		reply(); // The first reply confirms the native module loaded, before the host claims any input.
	} catch (error) { failure(error); port.close(); }
}

void import('node:worker_threads').then(({ parentPort, workerData }) => {
	parentPort!.on('message', (port: MessagePort | null) => {
		if (port) void serve(port, workerData as string);
		else parentPort!.close();
	});
});
