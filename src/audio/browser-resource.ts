import { ValidationError } from '../errors.js';

export class AudioResourceRequestError extends Error {
	constructor(status: number) { super(`Audio resource request failed (HTTP ${status}).`); }
}

// Validate one representation within UrlSource's fetch boundary. A partial body is small
// enough to check its decoded length before the demuxer sees any of its bytes.
const rangeBytes = 256 * 1024;
export function audioResourceFetch(signal: AbortSignal, observeFullBody: (body: ReadableStream<Uint8Array>) => ReadableStream<Uint8Array>): typeof fetch {
	let representation: { url: string; etag: string | null; size?: number } | undefined;
	return async (resource, init) => {
		const headers = new Headers(init?.headers);
		const range = /^bytes=(\d+)-(\d*)$/.exec(headers.get('Range') ?? '');
		const start = Number(range?.[1] ?? 0);
		const end = Math.min(start + rangeBytes - 1, range?.[2] ? Number(range[2]) : Infinity);
		headers.set('Range', `bytes=${start}-${end}`);
		const response = await fetch(resource, { ...init, headers, signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal });
		try {
			if (response.status !== 200 && response.status !== 206 && response.status !== 416) {
				throw new AudioResourceRequestError(response.status);
			}
			const etag = response.headers.get('ETag');
			const strong = etag && /^"[\x21\x23-\x7e\x80-\xff]*"$/.test(etag) ? etag : null;
			if (representation && (!strong || representation.etag !== strong || representation.url !== response.url)) {
				throw new ValidationError('Combining audio ranges requires the same resource and a consistent strong ETag.');
			}
			if (response.status === 200) {
				if (representation) throw new ValidationError('The audio server stopped honoring byte ranges.');
				representation = { url: response.url, etag: strong };
				if (!response.body) return response;
				// A range on a full response does not describe its length (RFC 9110, section 14.4).
				const fullHeaders = new Headers(response.headers);
				fullHeaders.delete('Content-Range');
				const full = new Response(observeFullBody(response.body), { status: 200, statusText: response.statusText, headers: fullHeaders });
				// UrlSource distinguishes basic and CORS responses when interpreting Content-Length.
				return Object.defineProperties(full, {
					type: { value: response.type }, url: { value: response.url }, redirected: { value: response.redirected },
				});
			}
			if (response.status === 416) {
				const total = /^bytes \*\/(\d+)$/.exec(response.headers.get('Content-Range') ?? '');
				if (!total || representation?.size === undefined || Number(total[1]) !== representation.size || start < representation.size) {
					throw new ValidationError('Inconsistent end of the audio resource.');
				}
				return response;
			}
			const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') ?? '');
			const first = Number(match?.[1]), last = Number(match?.[2]), size = Number(match?.[3]);
			if (!match || first !== start || last < first || last > end || last >= size || !Number.isSafeInteger(size)
				|| representation && representation.size !== size || !response.body) {
				throw new ValidationError('Invalid or unreadable audio Content-Range.');
			}
			const coding = response.headers.get('Content-Encoding');
			const length = last - first + 1;
			if (coding && coding.toLowerCase() !== 'identity' || response.headers.has('Content-Length') && Number(response.headers.get('Content-Length')) !== length) {
				throw new ValidationError('The audio range does not describe the decoded response bytes.');
			}
			representation = { url: response.url, etag: strong, size };
			const bytes = new Uint8Array(length), reader = response.body.getReader();
			let offset = 0;
			try {
				for (;;) {
					const item = await reader.read();
					if (item.done) break;
					if (item.value.length > length - offset) throw new ValidationError('Audio response exceeds its byte range.');
					bytes.set(item.value, offset); offset += item.value.length;
				}
				if (offset !== length) throw new ValidationError('Incomplete audio byte range.');
			} finally { reader.releaseLock(); }
			const resultHeaders = new Headers(response.headers);
			resultHeaders.delete('Content-Encoding');
			return new Response(bytes, { status: 206, headers: resultHeaders });
		} catch (error) {
			await response.body?.cancel().catch(() => { /* The response can already be errored. */ });
			throw error;
		}
	};
}
