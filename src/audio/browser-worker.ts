import { isArrayBuffer } from '@ai-sdk/provider-utils';
import { ConfigError, ValidationError } from '../errors.js';
import { isAudioBufferSource, isWebBlob, isWebStream } from '../runtime/web-input.js';
import { createAudioInput, copyAudioPlanes } from './buffer-copy.js';
import { claimAudioUpload } from './upload.js';
import type { PcmFormat } from './pcm.js';
import type { AudioSource, PrepareAudioSettings, PreparedAudio, PreparedAudioFor } from './preparation.js';

export type BrowserSource = string | Blob | Uint8Array | Uint8Array[] | ReadableStream<Uint8Array>;
export type BrowserRequest = { type: 'open'; source: BrowserSource; layout?: PcmFormat | undefined; settings: Omit<PrepareAudioSettings, 'abortSignal'> }
	| { type: 'allocate'; byteLength: number } | { type: 'read' } | { type: 'close' };
export type BrowserReply = { value?: unknown; done?: boolean } | { failure: { name: string; message: string; code?: number } } | { closed: true };

function deferred<T>() {
	let resolve!: (value: T) => void, reject!: (error: unknown) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

interface Lease { worker: Worker; url: string; code: string }
let idle: { lease: Lease; timer: ReturnType<typeof setTimeout> } | undefined;
function terminate(lease: Lease) {
	lease.worker.terminate();
	URL.revokeObjectURL(lease.url);
}
function acquire(code: string): Lease {
	if (idle?.lease.code === code) {
		const { lease, timer } = idle;
		clearTimeout(timer); idle = undefined;
		return lease;
	}
	if (typeof Worker === 'undefined') throw new ConfigError('Browser audio preparation requires a dedicated worker.');
	const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
	try { return { worker: new Worker(url), url, code }; }
	catch (error) { URL.revokeObjectURL(url); throw error; }
}
function release(lease: Lease) {
	if (idle) { terminate(lease); return; }
	function expire() {
		if (idle?.lease !== lease) return;
		clearTimeout(idle.timer); idle = undefined;
		terminate(lease);
	}
	lease.worker.onerror = expire;
	idle = { lease, timer: setTimeout(expire, 5000) };
}

export function browserResourceURL(source: string | URL): string {
	let url: URL | undefined;
	try { url = new URL(typeof source === 'string' ? source : source.href); } catch { /* Report the supported source forms below. */ }
	if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
		throw new ValidationError('Browser audio resources require an absolute HTTP(S) URL. For a configured translation use translate(undefined, undefined, \'fr\') or .run({ targetLanguage }).');
	}
	url.hash = '';
	return url.href;
}

/** One initialized port per call. Keep the original reader and its cancellation promise in this realm. */
export async function openBrowserWorker<T extends PrepareAudioSettings>(source: Exclude<AudioSource, URL>, settings: T, layout: PcmFormat | undefined, code: string): Promise<PreparedAudioFor<T>> {
	const { abortSignal: signal, fileAudioTarget, inputAudioFormat, maxPreparedAudioBytes, sourceFormat } = settings;
	signal?.throwIfAborted();
	if (isWebStream(source)) {
		const probe = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
		try { await structuredClone(probe, { transfer: [probe] }).cancel(); }
		catch { throw new ConfigError('Browser recording uploads require transferable ReadableStreams.'); }
		signal?.throwIfAborted();
	}
	const lease = acquire(code), { worker } = lease;
	const { port1: port, port2 } = new MessageChannel();
	let pending: ReturnType<typeof deferred<unknown>> | undefined = deferred<unknown>();
	const ready = pending.promise;
	const stopped = deferred<undefined>();
	let initialized = false, finished = false;
	let terminalError: unknown;
	let closing: Promise<void> | undefined, upload: ReturnType<typeof claimAudioUpload> | undefined;
	let output: ReadableStreamDefaultController<Uint8Array> | undefined;
	function close(...reasons: [reason?: unknown]) {
		if (!closing) {
			const reason: unknown = reasons.length ? reasons[0] : signal?.reason;
			const failure = reasons.length || signal?.aborted ? reason : new DOMException('Audio preparation ended.', 'AbortError');
			terminalError = failure;
			pending?.reject(failure); pending = undefined;
			if (!finished) output?.error(failure);
			signal?.removeEventListener('abort', abort);
			if (initialized && !finished) port.postMessage({ type: 'close' } satisfies BrowserRequest);
			else stopped.resolve(undefined);
			closing = Promise.all([stopped.promise, upload?.close(reason).catch(() => { /* Preserve the invocation failure. */ })]).then(() => {
				port.close();
				worker.onerror = null;
				if (finished && !signal?.aborted && reason === undefined) release(lease);
				else terminate(lease);
			});
		}
		return closing;
	}
	function abort() { void close(signal?.reason); }
	function fail(error: unknown) {
		stopped.resolve(undefined);
		void close(error);
	}
	worker.onerror = event => {
		event.preventDefault();
		// Startup happens before the worker receives a resource or any credentials.
		fail(!initialized && event.error instanceof Error ? event.error : new Error('Audio worker failed to start or run.'));
	};
	port.onmessageerror = () => { fail(new Error('Could not read the audio worker response.')); };
	port.onmessage = ({ data }: MessageEvent<BrowserReply>) => {
		if ('closed' in data) { stopped.resolve(undefined); return; }
		if ('failure' in data) {
			const { name, message, code } = data.failure;
			const error = name === 'ValidationError' ? new ValidationError(message) : name === 'ConfigError' ? new ConfigError(message)
				: code !== undefined ? new DOMException(message, name) : name === 'TypeError' ? new TypeError(message) : new Error(message);
			fail(upload?.failure ? upload.failure.error : error);
			return;
		}
		if (closing) { if (data.done) stopped.resolve(undefined); return; }
		initialized = true;
		finished = data.done === true;
		pending?.resolve(data.value); pending = undefined;
	};
	function request(message: BrowserRequest, transfer: Transferable[] = []): Promise<unknown> {
		signal?.throwIfAborted();
		if (closing) throw terminalError;
		pending = deferred<unknown>();
		try { port.postMessage(message, transfer); }
		catch (error) { pending = undefined; throw error; }
		return pending.promise;
	}
	signal?.addEventListener('abort', abort, { once: true });
	try {
		try { worker.postMessage(port2, [port2]); }
		catch (error) { port2.close(); fail(error); }
		await ready;
		signal?.throwIfAborted();
		let input: BrowserSource, transfer: Transferable[] = [];
		if (isWebStream(source)) {
			upload = claimAudioUpload(source);
			input = upload.stream; transfer = [input];
		} else if (isWebBlob(source)) input = source;
		else if (typeof source === 'string') input = source;
		else {
			const staging = createAudioInput(size => request({ type: 'allocate', byteLength: size }) as Promise<Uint8Array<ArrayBuffer>>, signal);
			if (isAudioBufferSource(source)) input = await copyAudioPlanes(source, staging.copy);
			else if (ArrayBuffer.isView(source)) input = await staging.copy(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
			else if (isArrayBuffer(source)) input = await staging.copy(new Uint8Array(source));
			else throw new ValidationError('Unsupported browser audio source.');
			transfer = staging.transfer;
		}
		const metadata = await request({ type: 'open', source: input, layout, settings: { inputAudioFormat, fileAudioTarget, sourceFormat, maxPreparedAudioBytes } }, transfer) as { format: PreparedAudio['format']; audio?: Uint8Array<ArrayBuffer> };
		if (metadata.audio) { await close(); signal?.throwIfAborted(); }
		const audio = metadata.audio ?? new ReadableStream<Uint8Array>({
			start(controller) { output = controller; },
			async pull(controller) {
				try {
					const bytes = await request({ type: 'read' }) as Uint8Array | undefined;
					if (closing) return;
					if (bytes) controller.enqueue(bytes);
					else { await close(); signal?.throwIfAborted(); controller.close(); }
				} catch (error) { controller.error(error); await close(error); }
			}, cancel: close,
		}, { highWaterMark: 0 });
		return { audio, format: metadata.format, close, [Symbol.asyncDispose]: close } as PreparedAudioFor<T>;
	} catch (error) { await close(error); throw signal?.aborted ? signal.reason : error; }
}
