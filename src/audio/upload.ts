import { isArrayBuffer, isUint8Array } from '@ai-sdk/provider-utils';
import { ValidationError } from '../errors.js';
import { audioPrefixBytes, audioContainer } from './source-evidence.js';
import { claimLiveInput } from '../runtime/live-input.js';

/** Keep ownership of the original reader on this side of the worker transfer. */
export function claimAudioUpload(source: ReadableStream<Uint8Array>) {
	claimLiveInput(source);
	const reader = source.getReader();
	let buffer: Uint8Array = new Uint8Array(0);
	let closing: Promise<void> | undefined, failure: { error: unknown } | undefined;
	function close(reason?: unknown) {
		return closing ??= reader.cancel(reason).finally(() => { reader.releaseLock(); });
	}
	const stream = new ReadableStream<Uint8Array>({
		async pull(target) {
			try {
				if (!buffer.length) {
					const item = await reader.read();
					if (closing) return;
					if (item.done) {
						reader.releaseLock();
						closing = Promise.resolve();
						target.close();
						return;
					}
					if (!isUint8Array(item.value)) throw new ValidationError('Encoded audio streams must contain Uint8Array chunks.');
					buffer = item.value;
				}
				// Stream transfer clones ordinary backing buffers, even for a tiny view.
				const part = buffer.subarray(0, 65536);
				target.enqueue(isArrayBuffer(part.buffer) ? Uint8Array.from(part) : part);
				buffer = buffer.subarray(part.length);
			} catch (error) {
				failure = { error };
				target.error(new Error('Recording upload failed.'));
				await close(error).catch(() => { /* The source can already be errored. */ });
			}
		},
		// The host knows the original signal or provider failure. A remote cancel has a cloned reason.
	}, { highWaterMark: 0 });
	return { stream, close, get failure() { return failure; } };
}

/** Keep the caller's reader and replay both the examined prefix and the rest of its last chunk. */
export async function readAudioPrefix(reader: ReadableStreamDefaultReader<Uint8Array>, signal?: AbortSignal,
	nextLength: (bytes: Uint8Array) => number | undefined = bytes => bytes.length < audioPrefixBytes && !audioContainer(bytes) ? audioPrefixBytes : undefined) {
	let prefix = new Uint8Array(audioPrefixBytes);
	let length = 0, remainder: Uint8Array = new Uint8Array(0), eof = false;
	let requested = audioPrefixBytes;
	for (;;) {
		if (!remainder.length) {
			const item = await reader.read();
			signal?.throwIfAborted();
			if (item.done) { eof = true; break; }
			remainder = item.value;
		}
		const count = Math.min(requested - length, remainder.length);
		prefix.set(remainder.subarray(0, count), length); length += count;
		remainder = remainder.subarray(count);
		if (length < audioPrefixBytes || length === requested) {
			const next = nextLength(prefix.subarray(0, length));
			if (next === undefined) break;
			requested = next;
			if (requested > prefix.length) {
				const larger = new Uint8Array(requested);
				larger.set(prefix); prefix = larger;
			}
		}
	}
	return { prefix: prefix.subarray(0, length), remainder, eof };
}
