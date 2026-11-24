import { ValidationError } from '../errors.js';

export const movieHeaderBudget = 256 * 1024;
type ReadMovie = (offset: number, length: number) => Buffer | Promise<Buffer>;
type Scan<T> = Generator<{ offset: number; length: number }, T, Buffer>;
interface Track { id?: number; timescale?: number; edits?: Buffer }
export interface MovieHeader { fragmented: boolean; timescale: number; tracks: Map<number, Track | undefined> }

export function unverifiableMovie(): never {
	throw new ValidationError('Cannot verify the selected track\'s movie playback edits. Export a flattened recording and pass it to .loadsAudio.');
}

// Both the seekable reader and the upload observer follow these same forward-only reads.
// Skip sample tables and media payloads. Only track IDs, clocks and edit fields survive opening.
function* scanMovie(): Scan<MovieHeader> {
	const movie: MovieHeader = { fragmented: false, timescale: 0, tracks: new Map() };
	let retained = 0;
	function* children(parent: string, offset: number, end: number, track?: Track): Scan<void> {
		while (offset < end) {
			if (end - offset < 8) return unverifiableMovie();
			const head = yield { offset, length: 8 };
			const type = head.toString('latin1', 4, 8);
			let size = head.readUInt32BE(), body = offset + 8;
			if (size === 1) {
				if (end - body < 8) return unverifiableMovie();
				size = Number((yield { offset: body, length: 8 }).readBigUInt64BE());
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
				if (entry.id !== undefined) {
					retained += 8 + (entry.edits?.length ?? 0);
					if (retained > movieHeaderBudget) throw new ValidationError('Movie track metadata exceeds the inspection budget.');
					movie.tracks.set(entry.id, movie.tracks.has(entry.id) ? undefined : entry);
				}
			} else if (parent === 'trak' && (type === 'edts' || type === 'mdia')) {
				yield* children(type, body, next, track);
			} else if (parent === 'moov' && type === 'mvex') {
				movie.fragmented = true;
			} else if (parent === 'moov' && type === 'mvhd' || parent === 'trak' && type === 'tkhd' || parent === 'mdia' && type === 'mdhd') {
				const data = yield { offset: body, length: Math.min(24, next - body) };
				const field = data[0] === 1 ? 20 : 12;
				if (data[0] <= 1 && data.length >= field + 4) {
					const value = data.readUInt32BE(field);
					if (type === 'mvhd') movie.timescale = value;
					else if (type === 'tkhd') track!.id = value;
					else track!.timescale = value;
				}
			} else if (parent === 'edts' && type === 'elst') {
				const data = yield { offset: body, length: Math.min(48, next - body) };
				track!.edits = track!.edits ? Buffer.alloc(0) : Buffer.from(data);
			}
			offset = next;
		}
	}
	yield* children('', 0, Number.MAX_SAFE_INTEGER);
	return movie;
}

export async function readMovieHeader(source: Buffer | ReadMovie): Promise<MovieHeader> {
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
	const scan = scanMovie(), field = Buffer.allocUnsafe(48);
	let step = scan.next(), position = 0, error: unknown;
	return {
		get header() { return step.done ? step.value : undefined; },
		write(bytes: Buffer) {
			const end = position + bytes.length;
			try {
				while (!error && !step.done && step.value.offset < end) {
					const { offset, length } = step.value;
					const from = Math.max(position, offset);
					bytes.copy(field, from - offset, from - position, Math.min(end, offset + length) - position);
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
	const track = header.tracks.get(trackId);
	if (!track) return unverifiableMovie();
	const data = track.edits;
	if (!data) return;
	if (data.length < 8 || data[0] > 1) return unverifiableMovie();
	const count = data.readUInt32BE(4);
	if (!count) return;
	const wide = data[0] === 1, width = wide ? 8 : 4, entry = 2 * width + 4;
	const duration = (i: number) => wide ? data.readBigUInt64BE(i) : BigInt(data.readUInt32BE(i));
	const mediaTime = (i: number) => wide ? data.readBigInt64BE(i + width) : BigInt(data.readInt32BE(i + width));
	const unitRate = (i: number) => data.readUInt32BE(i + 2 * width) === 0x10000;
	if (data.length < 8 + entry) return unverifiableMovie();
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
	if (data.length < i + entry || !unitRate(i) || mediaTime(i) < 0n || !header.timescale || !track.timescale) return unverifiableMovie();
	return { indexed, empty, duration: duration(i) + (empty ? duration(8) : 0n), timescale: header.timescale,
		mediaStart: mediaTime(i), mediaScale: track.timescale };
}
