import { ValidationError } from '../errors.js';

/** A muxer may rewrite earlier header bytes. Bound its highest write before growing storage. */
export function browserFile(limit: number, initialSize = 0) {
	let bytes = new Uint8Array(initialSize), length = 0;
	return {
		write(position: number, data: Uint8Array) {
			const end = position + data.length;
			if (end > limit) throw new ValidationError('Prepared audio exceeds the file byte limit.');
			if (end > bytes.length) {
				const next = new Uint8Array(Math.min(limit, Math.max(end, 8192, bytes.length * 2)));
				next.set(bytes); bytes = next;
			}
			bytes.set(data, position); length = Math.max(length, end);
		},
		bytes: () => bytes.subarray(0, length),
	};
}
