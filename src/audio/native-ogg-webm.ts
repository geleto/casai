import { ValidationError } from '../errors.js';
import type { FileAudioFormat } from './preparation.js';
import type { NativeAv, NativeDecoder, NativeInput, NativePacket, NativeStream } from './native-interface.js';

export const copyPauseMessage = 'The selected file copy cannot preserve this audio pause. Choose a fileAudioTarget that converts the track or use a raw PCM target.';
export const opusTime = { num: 1, den: 48000 };
const opusTrimMessage = 'The selected file copy cannot preserve this Opus playback trim. Choose a target that converts the track or use raw PCM.';

// RFC 6716 section 3.1. The TOC gives the coded length even when Matroska's
// millisecond BlockDuration is rounded or already excludes DiscardPadding.
function opusPacketSamples(packet: NativePacket) {
	const data = packet.data;
	if (!data?.length) throw new ValidationError('Missing Opus packet header.');
	const config = data[0] >> 3, code = data[0] & 3;
	const length = config < 12 ? [480, 960, 1920, 2880][config & 3] : config < 16 ? 480 << (config & 1) : 120 << (config & 3);
	const count = code === 3 ? data[1] & 63 : code === 0 ? 1 : 2;
	if (!count || count * length > 5760) throw new ValidationError('Invalid Opus packet duration.');
	return BigInt(count * length);
}

// Place the coded packets on the Opus sample clock. Compare each observed WebM
// timestamp to the rounded expected position; only their difference is a pause.
export async function* webmOpusPackets(av: NativeAv, stream: NativeStream, packets: AsyncIterable<NativePacket | null>, copy?: FileAudioFormat) {
	const clock = stream.timeBase, preSkip = BigInt(stream.codecpar.initialPadding);
	const ticks = (samples: bigint) => av.avRescaleQ(samples, opusTime, clock);
	let end: bigint | undefined, previous: bigint | undefined, jitter = false;
	let position = -preSkip, trimmedEnd = false;
	let held: NativePacket | null = null;
	function place(packet: NativePacket, delay: bigint) {
		const samples = opusPacketSamples(packet);
		const trim = packet.getSideData(av.AV_PKT_DATA_SKIP_SAMPLES);
		const head = BigInt(trim?.readUInt32LE(0) ?? 0), tail = BigInt(trim?.readUInt32LE(4) ?? 0);
		if (copy && (trimmedEnd || head && (previous !== undefined || head !== preSkip)
			|| tail && (tail >= samples || copy.format !== 'ogg' && copy.format !== 'opus'))) throw new ValidationError(opusTrimMessage);
		const gap = av.avRescaleQ(delay, clock, opusTime);
		if (copy && gap > 0n) throw new ValidationError(copyPauseMessage);
		position += gap;
		previous = packet.pts;
		end = end === undefined ? undefined : end + gap + samples;
		packet.timeBase = opusTime;
		packet.pts = packet.dts = position;
		// The Ogg muxer writes its final granule from the packet duration.
		packet.duration = copy ? samples - tail : samples;
		position += samples;
		trimmedEnd = tail > 0n;
	}
	try {
		for await (const packet of packets) {
			const late = held;
			held = packet;
			if (late) {
				try {
					const recovered = packet ? packet.pts >= late.pts && packet.pts <= ticks(end! + opusPacketSamples(late)) : jitter;
					place(late, recovered ? 0n : 1n);
				} catch (error) { late[Symbol.dispose](); throw error; }
				jitter = false;
				yield late;
			}
			if (!packet) { yield null; continue; }
			const observed = packet.pts;
			if (observed === av.AV_NOPTS_VALUE) end = undefined;
			else if (end === undefined || previous !== undefined && observed < previous) {
				end = previous === undefined && observed === ticks(-preSkip) ? -preSkip : av.avRescaleQ(observed, clock, opusTime);
				jitter = false;
			}
			const delta = end === undefined ? 0n : observed - ticks(end);
			if (delta === 1n && clock.num * 1000 === clock.den) continue;
			jitter = delta < 0n;
			place(packet, delta > 0n ? delta : 0n);
			held = null;
			yield packet;
		}
	} finally { held?.[Symbol.dispose](); }
}

// Ogg stores one end granule per page. Inside a page FFmpeg can place a short Vorbis
// window late. The preceding packet fixes its start and its own end granule stays intact.
export async function* oggVorbisPackets(av: NativeAv, packets: AsyncIterable<NativePacket | null>) {
	let end: bigint | undefined, page: bigint | undefined;
	for await (const packet of packets) {
		// FFmpeg supplies new decoder headers at a link boundary. One decoder
		// carries its previous overlap window across that boundary, changing the join.
		if (packet?.getSideData(av.AV_PKT_DATA_NEW_EXTRADATA)) {
			packet[Symbol.dispose]();
			throw new ValidationError('Cannot verify playback across a Vorbis section change. Export a flattened recording and pass it to .loadsAudio.');
		}
		if (packet && packet.pts !== av.AV_NOPTS_VALUE) {
			const duration = packet.duration, nextEnd = packet.pts + duration;
			if (packet.pos >= 0n && packet.pos === page && end !== undefined && duration > 0n && packet.pts > end) {
				if (packet.dts === packet.pts) packet.dts = end;
				packet.pts = end;
				packet.duration = nextEnd - end;
			}
			end = nextEnd; page = packet.pos;
		} else end = undefined;
		yield packet;
	}
}

const oggSettingsMessage = 'Cannot verify the decoder settings at this Ogg section change. Export a flattened recording and pass it to .loadsAudio.';

// Even readFrame() has a native packet queue. Verify that the reader position
// observed with each OpusHead belongs to that link before releasing its packets.
export async function* oggOpusPackets(av: NativeAv, input: NativeInput, stream: NativeStream, decoder: NativeDecoder | undefined, signal?: AbortSignal) {
	let started = false, end: bigint | undefined, trimmedEnd = false, offset = 0n;
	const header = stream.codecpar.extradata;
	const context = input.getFormatContext();
	let headerReadAt: bigint | undefined = context.pbBytes, page = -1n, covered = 0n, pendingBytes = 0;
	const pending: NativePacket[] = [];
	function* release() {
		pendingBytes = 0;
		pending.reverse();
		while (pending.length) yield pending.pop()!;
	}
	try {
		for (;;) {
			signal?.throwIfAborted();
			const packet = new av.Packet();
			let handedOff = false;
			try {
				packet.alloc();
				const result = await context.readFrame(packet);
				signal?.throwIfAborted();
				if (result === av.AVERROR_EOF) {
					if (pending.length) throw new ValidationError(oggSettingsMessage);
					yield null;
					return;
				}
				av.FFmpegError.throwIfError(result, 'Read Ogg audio packet');
				if (packet.streamIndex !== stream.index) continue;
				packet.timeBase = stream.timeBase;
				const trim = packet.getSideData(av.AV_PKT_DATA_SKIP_SAMPLES);
				const head = trim?.readUInt32LE(0) ?? 0;
				if (started && (head || trimmedEnd || packet.getSideData(av.AV_PKT_DATA_STRINGS_METADATA))) {
					if (!decoder) {
						throw new ValidationError('Cannot verify the trim between Ogg sections in a single Opus packet copy. Choose a target that converts the track or use raw PCM.');
					}
					// Pre-skip and the informational input rate may differ. A decoder reset
					// cannot apply a new gain or mapping, or distinguish a tag-only update.
					const current = stream.codecpar.extradata;
					if (pending.length || !head && !trimmedEnd || end === undefined || packet.pts === av.AV_NOPTS_VALUE || !header || !current
						|| !header.subarray(0, 10).equals(current.subarray(0, 10)) || !header.subarray(16).equals(current.subarray(16))) {
						throw new ValidationError(oggSettingsMessage);
					}
					headerReadAt = context.pbBytes;
					// A logical stream starts with a fresh Opus prediction state.
					decoder.getCodecContext()!.flushBuffers();
					offset = end - BigInt(head) - packet.pts;
				}
				if (packet.pts !== av.AV_NOPTS_VALUE) packet.pts += offset;
				if (packet.dts !== av.AV_NOPTS_VALUE) packet.dts += offset;
				end = packet.pts === av.AV_NOPTS_VALUE ? undefined : packet.pts + packet.duration;
				started = true;
				trimmedEnd = !!trim?.readUInt32LE(4);
				handedOff = true;
				if (headerReadAt === undefined) yield packet;
				else {
					pending.push(packet);
					pendingBytes += packet.size;
					// FFmpeg reports the page at which the packet starts. Every Ogg
					// page has a 27-byte header and one lacing byte per 255 payload
					// bytes plus a terminator. Continuation pages only add overhead.
					if (page !== packet.pos) { page = packet.pos; covered = page + 27n; }
					covered += BigInt(packet.size + Math.floor(packet.size / 255) + 1);
					if (page >= 0n && headerReadAt >= 0n && covered >= headerReadAt) {
						headerReadAt = undefined;
						yield* release();
					} else if (pending.length >= 255 || pendingBytes >= 256 * 1024) throw new ValidationError(oggSettingsMessage);
				}
			} finally { if (!handedOff) packet[Symbol.dispose](); }
		}
	} finally { for (const packet of pending) packet[Symbol.dispose](); }
}

// Matroska laces the identification, comment and setup packets. Keep both
// decoder headers byte-for-byte and replace the comment packet.
export function cleanVorbisHeaders(data: Buffer | null): Buffer | undefined {
	if (data?.[0] !== 2 || data[1] !== 30) return undefined;
	let identification = 2, commentSize = 0;
	while (identification < data.length) {
		const lace = data[identification++];
		commentSize += lace;
		if (lace < 255) break;
	}
	const comment = identification + 30, setup = comment + commentSize;
	if (data.toString('latin1', identification, identification + 7) !== '\x01vorbis' || data.toString('latin1', comment, comment + 7) !== '\x03vorbis'
		|| data.toString('latin1', setup, setup + 7) !== '\x05vorbis') return undefined;
	const empty = Buffer.alloc(16);
	empty.write('\x03vorbis', 'latin1');
	empty[15] = 1; // Zero vendor length, zero comments, framing bit set.
	return Buffer.concat([Buffer.from([2, 30, empty.length]), data.subarray(identification, comment), empty, data.subarray(setup)]);
}
