import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isArrayBuffer, isUint8Array } from '@ai-sdk/provider-utils';
import { MessageChannel, Worker, type Transferable } from 'node:worker_threads';
import { ConfigError, ValidationError } from '../errors.js';
import { claimLiveInput } from '../runtime/live-input.js';
import { isWebBlob, isWebStream, isWebURL } from '../runtime/web-input.js';
import { validatePreparationSettings } from './preparation.js';
import type { AudioSource, PrepareAudioSettings, PreparedAudio, PreparedAudioFor } from './preparation.js';
import { createAudioInput } from './buffer-copy.js';
import type { NativeAudioSource } from './native-pipeline.js';
import type { NativeRequest, NativeResponse } from './native-worker.entry.js';
import { nativeWorkerSource } from './worker-sources.js';
import { isPcmSamples, sampleFormat } from './pcm.js';

function nativeFilename(): string {
	try { return createRequire(typeof __filename === 'string' ? __filename : import.meta.url).resolve('node-av'); }
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND' && (error as Error).message.includes("Cannot find module 'node-av'")) {
			throw new ConfigError('Native audio preparation requires node-av. Install the LGPL distribution with npm install node-av@npm:node-av-lgpl@7.1.0.', error as Error);
		}
		throw error;
	}
}

// Cache only a fully cleaned worker. Each invocation gets a separate MessagePort and native owner.
let idle: { worker: Worker; filename: string; timer: ReturnType<typeof setTimeout> } | undefined;
function takeWorker(filename: string): Worker {
	if (idle) {
		const previous = idle; idle = undefined; clearTimeout(previous.timer);
		if (previous.filename === filename) { previous.worker.ref(); return previous.worker; }
		previous.worker.postMessage(null);
	}
	const worker = new Worker(nativeWorkerSource, { eval: true, workerData: pathToFileURL(filename).href });
	const forget = () => { if (idle?.worker === worker) { clearTimeout(idle.timer); idle = undefined; } };
	// No invocation listener is present while cached or shutting down.
	worker.on('error', forget); worker.on('exit', forget);
	return worker;
}
function keepWorker(worker: Worker, filename: string): boolean {
	if (idle) return false;
	const timer = setTimeout(() => { idle = undefined; worker.postMessage(null); }, 5000);
	timer.unref(); worker.unref();
	idle = { worker, filename, timer };
	return true;
}

/** Exclusive native worker ownership until cleanup; one cleaned worker may be reused briefly. */
export async function prepareAudio<T extends PrepareAudioSettings>(source: AudioSource, settings: T): Promise<PreparedAudioFor<T>> {
	validatePreparationSettings(settings, ValidationError);
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Validate JavaScript input before native I/O.
	if (!settings.inputAudioFormat && !settings.fileAudioTarget) throw new ValidationError('Audio preparation requires inputAudioFormat or fileAudioTarget.');
	settings.abortSignal?.throwIfAborted();
	const filename = nativeFilename();
	const worker = takeWorker(filename);
	const { port1: port, port2 } = new MessageChannel();
	let closed = false, ended = false, exited = false, expectedClose = false;
	let workerFailure: { error: unknown } | undefined, sourceFailure: { error: unknown } | undefined;
	let sourceReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	let closing: Promise<void> | undefined, sourceClosing: Promise<void> | undefined;
	interface Pending { resolve: (value: unknown) => void; reject: (error: unknown) => void }
	let pending: Pending | undefined;
	const ready = new Promise<unknown>((resolve, reject) => { pending = { resolve, reject }; });
	let resolveExit!: () => void;
	const exit = new Promise<void>(resolve => { resolveExit = resolve; });
	const closeSource = (reason: unknown = settings.abortSignal?.reason) => sourceClosing ??= (async () => {
		const ownedReader = sourceReader; sourceReader = undefined;
		if (ownedReader) {
			try { await ownedReader.cancel(reason); }
			finally { ownedReader.releaseLock(); }
		}
	})();
	function fail(error: unknown) {
		workerFailure = { error };
		pending?.reject(error); pending = undefined;
	}
	function onExit(code: number) {
		exited = true;
		if (!ended) {
			fail(workerFailure ? workerFailure.error : new Error(`Native audio worker exited unexpectedly (${code}).`));
			port.close();
		}
		resolveExit();
	}
	port.on('message', (message: NativeResponse) => {
		if ('error' in message) {
			let error = message.error;
			if (error instanceof Error) {
				Object.assign(error, message.properties);
				if (message.name) error.name = message.name;
				if (message.name === 'ValidationError') Object.setPrototypeOf(error, ValidationError.prototype);
			}
			error = settings.abortSignal?.aborted ? settings.abortSignal.reason : sourceFailure ? sourceFailure.error : error;
			fail(error);
		} else {
			pending?.resolve(message.value); pending = undefined;
		}
		if (!pending && !closed) { worker.unref(); port.unref(); }
	});
	worker.on('error', fail); worker.on('exit', onExit);
	const finished = new Promise<void>(resolve => port.once('close', resolve)).then(async () => {
		ended = true; worker.ref();
		settings.abortSignal?.removeEventListener('abort', abort);
		if (!expectedClose || pending) fail(workerFailure ? workerFailure.error : new Error('Native audio invocation closed unexpectedly.'));
		await closeSource().catch(() => { /* Native cleanup must finish when source cancellation rejects. */ });
		if (closed || settings.abortSignal?.aborted || workerFailure || exited || !keepWorker(worker, filename)) {
			if (!exited) worker.postMessage(null);
			await exit;
		}
		worker.off('error', fail); worker.off('exit', onExit);
	});
	function request(message: Exclude<NativeRequest, { type: 'close' }>, transfer: Transferable[] = []): Promise<unknown> {
		// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Preserve native/source rejection values.
		if (ended || workerFailure) return Promise.reject(workerFailure ? workerFailure.error : new DOMException('Prepared audio was closed.', 'AbortError'));
		worker.ref(); port.ref();
		return new Promise((resolve, reject) => {
			pending = { resolve, reject };
			try { port.postMessage(message, transfer); }
			catch (error) {
				pending = undefined;
				// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Preserve postMessage failures.
				reject(error);
			}
		});
	}
	async function close(reason?: unknown) {
		return closing ??= (async () => {
			if (ended) return finished;
			closed = true; expectedClose = true;
			controller?.error(settings.abortSignal?.aborted ? settings.abortSignal.reason : new DOMException('Prepared audio was closed.', 'AbortError'));
			await closeSource(reason).catch(() => { /* Preserve conversion/cancellation failures. */ });
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- The port can close while source cancellation is awaited.
			if (!ended) { worker.ref(); port.ref(); port.postMessage({ type: 'close' } satisfies NativeRequest); }
			await finished;
		})();
	}
	function abort() { void close(); }
	async function finish() {
		expectedClose = true; worker.ref(); port.ref();
		await finished;
		settings.abortSignal?.throwIfAborted();
	}
	settings.abortSignal?.addEventListener('abort', abort, { once: true });
	try {
		try { worker.postMessage(port2, [port2]); }
		catch (error) { fail(error); port2.close(); port.close(); }
		await ready;
		settings.abortSignal?.throwIfAborted();
		let input: NativeAudioSource, blobType: string | undefined, transfer: Transferable[] = [];
		if (isWebStream(source)) {
			claimLiveInput(source);
			let buffer: Uint8Array = new Uint8Array(0);
			input = new ReadableStream<Uint8Array>({
				async pull(target) {
					if (sourceClosing) return;
					try {
						const ownedReader = sourceReader ??= source.getReader();
						if (!buffer.length) {
							const item = await ownedReader.read();
							// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Shutdown can arrive while awaiting input.
							if (sourceClosing) return;
							if (item.done) { ownedReader.releaseLock(); sourceReader = undefined; target.close(); return; }
							if (!isUint8Array(item.value)) throw new ValidationError('Encoded audio streams must contain Uint8Array chunks.');
							buffer = item.value;
						}
						// Transferable streams clone their chunks; bound each crossing even for a huge producer chunk.
						const part = buffer.subarray(0, 65536);
						target.enqueue(isArrayBuffer(part.buffer) ? Uint8Array.from(part) : part); buffer = buffer.subarray(65536);
					} catch (error) {
						sourceFailure = { error }; target.error(error);
						await closeSource(error).catch(() => { /* The reader can already be errored. */ });
					}
				},
				cancel: closeSource,
			}, { highWaterMark: 0 });
			transfer = [input as unknown as Transferable];
		} else if (isWebBlob(source)) {
			blobType = source.type;
			const buffer = await source.arrayBuffer();
			input = new Uint8Array(buffer);
			transfer = [buffer];
		} else if (ArrayBuffer.isView(source) || isArrayBuffer(source)) {
			const preparation = createAudioInput(byteLength => request({ type: 'allocate', byteLength }) as Promise<Uint8Array<ArrayBuffer>>, settings.abortSignal);
			input = await preparation.copy(ArrayBuffer.isView(source) ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength) : new Uint8Array(source));
			transfer = preparation.transfer;
		} else if (typeof source === 'string' || isWebURL(source)) {
			const resource = typeof source === 'string' ? source : source.href;
			// node-av treats file:relative as a path literally beginning with "file:".
			input = /^file:/i.test(resource) ? resource[5] === '/' ? fileURLToPath(resource) : resolve(resource.slice(5)) : resource;
		} else throw new ValidationError('Audio preparation requires a path, URL, encoded bytes or a byte stream.');
		settings.abortSignal?.throwIfAborted();
		let sourceFormat = typeof input === 'string' ? undefined : settings.sourceFormat;
		let mediaSettings = settings.mediaSettings;
		if (isPcmSamples(source)) {
			if (!settings.sourceFormat) throw new ValidationError('Headerless sample arrays require sourceFormat.sampleRate and sourceFormat.channels.');
			const raw = sampleFormat(settings.sourceFormat, source);
			mediaSettings = { ...mediaSettings, format: raw.encoding.replace('pcm_', ''),
				options: { ...mediaSettings?.options, sample_rate: raw.sampleRate, ch_layout: `${raw.channels}c` } };
			sourceFormat = undefined;
		}
		const nativeSettings = { inputAudioFormat: settings.inputAudioFormat, fileAudioTarget: settings.fileAudioTarget,
			mediaSettings, sourceFormat, maxPreparedAudioBytes: settings.maxPreparedAudioBytes };
		const metadata = await request({ type: 'open', source: input, settings: nativeSettings, blobType }, transfer) as Pick<PreparedAudio, 'audio' | 'track' | 'format'>;
		settings.abortSignal?.throwIfAborted();
		if (metadata.audio instanceof Uint8Array) {
			await finish();
			return { ...metadata, close, [Symbol.asyncDispose]: close } as PreparedAudioFor<T>;
		}
		const audio = new ReadableStream<Uint8Array>({
			start(value) { controller = value; },
			async pull(target) {
				try {
					const chunk = await request({ type: 'read' }) as Uint8Array | undefined;
					if (closed) return;
					if (chunk === undefined) { await finish(); target.close(); } else target.enqueue(chunk);
				} catch (error) {
					if (!closed) target.error(error);
					await close();
				}
			},
			cancel: close,
		}, { highWaterMark: 0 });
		return { ...metadata, audio, close, [Symbol.asyncDispose]: close } as PreparedAudioFor<T>;
	} catch (error) { await close(); throw settings.abortSignal?.aborted ? settings.abortSignal.reason : error; }
}
