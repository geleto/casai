import { ConfigError, ValidationError } from '../errors.js';
import type { BrowserRequest, BrowserReply } from './browser-worker.js';
import type { AudioFormat } from '../audio.js';
import type { FileAudioFormat } from './preparation.js';
import { AudioResourceRequestError } from './browser-resource.js';

export type Open = Extract<BrowserRequest, { type: 'open' }>;
type Chunk = { format: AudioFormat } | Uint8Array;
type FileResult = { audio: Uint8Array<ArrayBuffer>; format: FileAudioFormat } | undefined;
export type Pipeline = Generator<Chunk, FileResult> | AsyncGenerator<Chunk, FileResult>;

export function serveBrowserAudio(prepare: (request: Open, signal: AbortSignal) => Pipeline) {
	self.onmessage = ({ data: port }: MessageEvent<MessagePort>) => {
		const abort = new AbortController();
		let pipeline: Pipeline | undefined;
		const reply = (message: BrowserReply, transfer: Transferable[] = []) => { port.postMessage(message, transfer); };
		async function close() {
			abort.abort();
			await pipeline?.return(undefined);
		}
		port.onmessage = ({ data }: MessageEvent<BrowserRequest>) => {
			void (async () => {
				try {
					if (data.type === 'close') {
						await close();
						reply({ closed: true }); port.close();
					} else if (data.type === 'allocate') {
						const bytes = new Uint8Array(data.byteLength);
						reply({ value: bytes }, [bytes.buffer]);
					} else {
						if (data.type === 'open') pipeline = prepare(data, abort.signal);
						const { done, value } = await pipeline!.next();
						if (abort.signal.aborted) return;
						if (value instanceof Uint8Array) {
							// The worker can still be reading from the backing buffer on the next pull.
							const chunk = Uint8Array.from(value);
							reply({ value: chunk }, [chunk.buffer]);
						} else {
							const file = value && 'audio' in value ? value.audio : undefined;
							reply({ done: !!done, value }, file ? [file.buffer] : []);
						}
						if (done) port.close();
					}
				} catch (error) {
					await close().catch(() => { /* Preserve the original failure. */ });
					const known = error instanceof ConfigError || error instanceof ValidationError;
					const dom = error instanceof DOMException && ['AbortError', 'DataError', 'EncodingError', 'InvalidStateError',
						'NetworkError', 'NotReadableError', 'NotSupportedError', 'OperationError', 'SecurityError'].includes(error.name) ? error : undefined;
					const message = known || error instanceof AudioResourceRequestError ? error.message : error instanceof TypeError && error.message === 'Failed to fetch'
						? 'Failed to fetch' : 'Browser audio preparation failed.';
					reply({ failure: dom ? { name: dom.name, message, code: dom.code }
						: { name: known ? error.name : error instanceof TypeError ? 'TypeError' : 'Error', message } });
					port.close();
				}
			})();
		};
		reply({});
	};
}
