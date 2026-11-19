import * as finite from './pcm-operations.js';
import { createPcmStreamConverter } from './pcm-stream.js';
import type { PcmJob, PcmResponse, PcmValue } from './pcm-worker-code.js';
type BrowserPort = Pick<MessagePort, 'onmessage' | 'postMessage'>;
declare const self: BrowserPort | undefined;

function serve(port: BrowserPort | import('node:worker_threads').MessagePort) {
	const operations = { ...finite, resampleStream: createPcmStreamConverter() };
	port.onmessage = ({ data }: { data: PcmJob }) => {
		try {
			const value = Reflect.apply(operations[data.type], undefined, data.args) as PcmValue;
			const audio = typeof value === 'string' ? undefined : 'audio' in value ? value.audio : value;
			// Shared output stays shared; only owned ArrayBuffers can be transferred.
			port.postMessage({ value } satisfies PcmResponse, audio?.buffer instanceof ArrayBuffer ? [audio.buffer] : []);
		} catch (error) { port.postMessage({ error, name: error instanceof Error ? error.name : undefined } satisfies PcmResponse); }
	};
}

if (typeof self !== 'undefined') serve(self);
else void import('node:worker_threads').then(({ parentPort }) => { serve(parentPort!); });
