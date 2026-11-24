import type { NativeAv } from './native-interface.js';
import { movieHeaderBudget, observeMovieHeader, readMovieHeader, unverifiableMovie } from './movie-header.js';
import { ValidationError } from '../errors.js';

// Choose an I/O handle that can expose movie edits. FFmpeg still probes the actual bytes.
export function isMovieResource(av: NativeAv, source: string, format: string | undefined): boolean {
	const remote = /^https?:\/\//i.test(source);
	if (!remote && /^[a-z][a-z\d+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) return false;
	const mov = av.InputFormat.findInputFormat('mov');
	if (!mov) return false;
	if (format) return av.InputFormat.findInputFormat(format)?.name === mov.name;
	const pathname = remote ? new URL(source).pathname : source;
	const extension = /\.([a-z0-9]+)$/i.exec(pathname)?.[1];
	return extension !== undefined && (mov.extensions?.split(',').includes(extension.toLowerCase()) ?? false);
}

/** The pinned binding exposes protocol options and cancellation on Demuxer.open, but its
 * URL-backed AVIOContext is opaque. The data demuxer exposes bytes from that one native
 * protocol handle, including native byte seeks. MOV and the edit check share those bytes. */
export async function openMovieResource(av: NativeAv, url: string, options: Record<string, unknown>, signal?: AbortSignal) {
	const input = await av.Demuxer.open(url, { format: 'data', skipStreamInfo: true,
		options: { ...options, format_whitelist: 'data', raw_packet_size: 32768 }, signal });
	const context = input.getFormatContext();
	let start = 0, block: Buffer = Buffer.alloc(0), position = 0;
	let nextPacket: bigint | undefined = 0n;
	let furthestRead = 0;
	let header: Buffer | undefined, headerLength = 0, opening = true;
	let observed = 0, observer: ReturnType<typeof observeMovieHeader> | undefined = observeMovieHeader();
	let seekError: ValidationError | undefined;
	function cannotSeek(): never {
		seekError = new ValidationError('Could not seek to the requested movie data. Pass the original bytes, Blob or a seekable file or URL.');
		throw seekError;
	}

	async function readBlock(offset: number, length: number): Promise<Buffer> {
		signal?.throwIfAborted();
		if (header && offset < headerLength) return header.subarray(offset, Math.min(offset + length, headerLength));
		if (offset >= start && offset < start + block.length) return block.subarray(offset - start, offset - start + length);
		const requested = BigInt(offset);
		if (requested !== nextPacket) {
			av.FFmpegError.throwIfError(await context.seekFrame(-1, requested, av.AVSEEK_FLAG_BYTE), 'Seek movie resource');
		}
		// A server can ignore Range. The data demuxer may report a successful byte seek
		// and deliver the next sequential packet. Advance on that same handle to the requested byte.
		for (;;) {
			using packet = new av.Packet();
			packet.alloc();
			const result = await context.readFrame(packet);
			nextPacket = result >= 0 && packet.pos >= 0n ? packet.pos + BigInt(packet.size) : undefined;
			signal?.throwIfAborted();
			if (result === av.AVERROR_EOF) {
				if (offset < furthestRead) return cannotSeek();
				return Buffer.alloc(0);
			}
			av.FFmpegError.throwIfError(result, 'Read movie resource');
			if (packet.pos > requested) return cannotSeek();
			if (packet.pos < 0n || !packet.size) return unverifiableMovie();
			const packetStart = Number(packet.pos), data = packet.data!;
			if (observer && packetStart === observed) { observer.write(data); observed += data.length; }
			furthestRead = Math.max(furthestRead, packetStart + data.length);
			if (opening && packetStart === headerLength && headerLength < movieHeaderBudget) {
				header ??= Buffer.allocUnsafe(movieHeaderBudget);
				headerLength += data.copy(header, headerLength);
			}
			if (offset < packetStart + data.length) {
				start = packetStart;
				block = Buffer.from(data);
				return block.subarray(offset - start, offset - start + length);
			}
		}
	}
	return {
		input,
		get seekError() { return seekError; },
		read: async (size: number) => {
			const data = await readBlock(position, size);
			position += data.length;
			if (!opening && position >= headerLength) header = undefined;
			return data.length ? data : null;
		},
		seek(offset: bigint, whence: number) {
			// An unknown byte length is native-compatible. MOV can skip sized atoms with absolute seeks.
			if (whence !== av.AVSEEK_SET && whence !== av.AVSEEK_CUR) return -1n;
			const next = (whence === av.AVSEEK_CUR ? BigInt(position) : 0n) + offset;
			if (next < 0n || next > BigInt(Number.MAX_SAFE_INTEGER)) return -1n;
			position = Number(next);
			return next;
		},
		movieHeader: () => observer?.header ?? readMovieHeader(async (offset, length) => {
			let field = await readBlock(offset, length);
			while (field.length < length) {
				const rest = await readBlock(offset + field.length, length - field.length);
				if (!rest.length) break;
				field = Buffer.concat([field, rest]);
			}
			return field;
		}),
		releaseHeader() { observer = undefined; opening = false; if (position >= headerLength) header = undefined; },
	};
}
