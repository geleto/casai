import { ValidationError } from '../errors.js';

export const movieHeaderBudget = 256 * 1024;
type ReadMovie = (offset: number, length: number) => Uint8Array | Promise<Uint8Array>;
type Scan<T> = Generator<{ offset: number; length: number }, T, Uint8Array>;
interface Track { id?: number; handler?: string; timescale?: number; edits?: DataView }
export interface MovieHeader { fragmented: boolean; timescale: number; tracks: Track[] }

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const fourCC = (bytes: Uint8Array, offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));

export function unverifiableMovie(): never {
	throw new ValidationError('Cannot verify the selected track\'s movie playback edits. Export a flattened recording and pass it to .loadsAudio.');
}

// Both the seekable reader and the upload observer follow these same forward-only reads.
// Skip sample tables and media payloads. Only track IDs, clocks and edit fields survive opening.
function* scanMovie(): Scan<MovieHeader> {
	const movie: MovieHeader = { fragmented: false, timescale: 0, tracks: [] };
	let retained = 0;
	function* children(parent: string, offset: number, end: number, track?: Track): Scan<void> {
		while (offset < end) {
			if (end - offset < 8) return unverifiableMovie();
			const head = yield { offset, length: 8 };
			const type = fourCC(head, 4);
			let size = view(head).getUint32(0), body = offset + 8;
			if (size === 1) {
				if (end - body < 8) return unverifiableMovie();
				size = Number(view(yield { offset: body, length: 8 }).getBigUint64(0));
				body += 8;
			} else if (!size) size = end - offset;
			if (size < body - offset || size > end - offset) return unverifiableMovie();
			const next = offset + size;
			if (!parent && type === 'moov') {
				yield* children(type, body, next);
				return;
			}
			if (parent === 'moov' && type === 'trak') {
				const entry: Track = {};
				yield* children(type, body, next, entry);
				retained += 12 + (entry.edits?.byteLength ?? 0);
				if (retained > movieHeaderBudget) throw new ValidationError('Movie track metadata exceeds the inspection budget.');
				movie.tracks.push(entry);
			} else if (parent === 'trak' && (type === 'edts' || type === 'mdia')) {
				yield* children(type, body, next, track);
			} else if (parent === 'moov' && type === 'mvex') {
				movie.fragmented = true;
			} else if (parent === 'moov' && type === 'mvhd' || parent === 'trak' && type === 'tkhd' || parent === 'mdia' && type === 'mdhd') {
				const data = yield { offset: body, length: Math.min(24, next - body) };
				const field = data[0] === 1 ? 20 : 12;
				if (data[0] <= 1 && data.length >= field + 4) {
					const value = view(data).getUint32(field);
					if (type === 'mvhd') movie.timescale = value;
					else if (type === 'tkhd') track!.id = value;
					else track!.timescale = value;
				}
			} else if (parent === 'mdia' && type === 'hdlr' && next - body >= 12) {
				track!.handler = fourCC(yield { offset: body + 8, length: 4 }, 0);
			} else if (parent === 'edts' && type === 'elst') {
				const data = yield { offset: body, length: Math.min(48, next - body) };
				track!.edits = view(track!.edits ? new Uint8Array(0) : Uint8Array.from(data));
			}
			offset = next;
		}
	}
	yield* children('', 0, Number.MAX_SAFE_INTEGER);
	return movie;
}

export async function readMovieHeader(source: Uint8Array | ReadMovie): Promise<MovieHeader> {
	const scan = scanMovie();
	let step = scan.next();
	while (!step.done) {
		const { offset, length } = step.value;
		const data = typeof source === 'function' ? await source(offset, length) : source.subarray(offset, offset + length);
		if (data.length !== length) return unverifiableMovie();
		step = scan.next(data);
	}
	return step.value;
}

// Input can split even a box size across reads. The same 48-byte scratch serves every field.
export function observeMovieHeader() {
	const scan = scanMovie(), field = new Uint8Array(48);
	let step = scan.next(), position = 0, error: unknown;
	return {
		get header() { return step.done ? step.value : undefined; },
		write(bytes: Uint8Array) {
			const end = position + bytes.length;
			try {
				while (!error && !step.done && step.value.offset < end) {
					const { offset, length } = step.value;
					const from = Math.max(position, offset);
					field.set(bytes.subarray(from - position, Math.min(end, offset + length) - position), from - offset);
					if (offset + length > end) break;
					step = scan.next(field.subarray(0, length));
				}
			} catch (cause) { error = cause; } // Probing can still identify a non-movie.
			position = end;
		},
		finish() {
			if (error instanceof Error) throw error;
			if (!step.done) throw new ValidationError('Movie initialization is unavailable on this upload. Pass the original bytes, Blob or a seekable file or URL.');
			return step.value;
		},
	};
}

export function selectedMovieEdit(header: MovieHeader, trackId: number, nativeEdits: boolean) {
	const matches = header.tracks.filter(track => track.id === trackId);
	if (!trackId || matches.length !== 1) return unverifiableMovie();
	const track = matches[0];
	const data = track.edits;
	if (!data) return;
	if (data.byteLength < 8 || data.getUint8(0) > 1) return unverifiableMovie();
	const count = data.getUint32(4);
	if (!count) return;
	const wide = data.getUint8(0) === 1, width = wide ? 8 : 4, entry = 2 * width + 4;
	const duration = (i: number) => wide ? data.getBigUint64(i) : BigInt(data.getUint32(i));
	const mediaTime = (i: number) => wide ? data.getBigInt64(i + width) : BigInt(data.getInt32(i + width));
	const unitRate = (i: number) => data.getUint32(i + 2 * width) === 0x10000;
	if (data.byteLength < 8 + entry) return unverifiableMovie();
	const indexed = nativeEdits && !header.fragmented;
	const empty = mediaTime(8) === -1n;
	let i = 8;
	if (empty) {
		if (!indexed || count !== 2 || !unitRate(i)) return unverifiableMovie();
		i += entry;
	} else if (count !== 1) {
		if (indexed) return 'splice'; // Native indexed splices also pass the packet-boundary check.
		return unverifiableMovie();
	}
	if (data.byteLength < i + entry || !unitRate(i) || mediaTime(i) < 0n || !header.timescale || !track.timescale) return unverifiableMovie();
	return { indexed, empty, duration: duration(i) + (empty ? duration(8) : 0n), timescale: header.timescale,
		mediaStart: mediaTime(i), mediaScale: track.timescale };
}
