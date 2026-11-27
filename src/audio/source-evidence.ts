import { ValidationError } from '../errors.js';

/** Bound the retained prefix for recording headers and length-linked frame sequences. */
export const audioPrefixBytes = 4096;

export function audioMediaType(value: string | undefined): string | undefined {
	const type = value?.split(';', 1)[0].trim().toLowerCase();
	if (!type || type === 'application/octet-stream') return undefined;
	return ({ 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/vnd.wave': 'audio/wav',
		'audio/x-flac': 'audio/flac', 'audio/x-aiff': 'audio/aiff', 'audio/mp3': 'audio/mpeg', 'audio/x-m4a': 'audio/mp4',
		'application/ogg': 'audio/ogg', 'video/ogg': 'audio/ogg', 'video/webm': 'audio/webm',
		'video/mp4': 'audio/mp4', 'video/x-matroska': 'audio/x-matroska' } as Record<string, string>)[type] ?? type;
}

export function encodedAudioType(type: string | undefined): boolean {
	return type !== undefined && type !== 'audio/pcm';
}

export function checkMimeLayout(type: string, rate: number | undefined, channels: number | undefined): void {
	for (const [, key, value] of type.matchAll(/;\s*(rate|channels)\s*=\s*"?([^";\s]+)"?/gi)) {
		const expected = key.toLowerCase() === 'rate' ? rate : channels;
		if (expected !== undefined && Number(value) !== expected) throw new ValidationError('The supplied audio MIME layout conflicts with sourceFormat or inputAudioFormat.');
	}
}

function textAt(bytes: Uint8Array, offset: number, text: string): boolean {
	if (offset + text.length > bytes.length) return false;
	for (let i = 0; i < text.length; i++) if (bytes[offset + i] !== text.charCodeAt(i)) return false;
	return true;
}

type HeaderEvidence = string | number | undefined;

function movieHeaderEvidence(bytes: Uint8Array, view: DataView, offset: number, end: number): HeaderEvidence {
	const limit = Math.min(bytes.length, end);
	while (offset + 8 <= end) {
		if (offset + 8 > limit) return offset + 8;
		let size = view.getUint32(offset), body = offset + 8;
		if (size === 1) {
			if (body + 8 > end) return undefined;
			if (body + 8 > limit) return body + 8;
			size = Number(view.getBigUint64(body));
			body += 8;
		} else if (size === 0) size = end - offset;
		if (!Number.isSafeInteger(size) || size < body - offset || size > end - offset) return undefined;
		if (textAt(bytes, offset + 4, 'mvhd')) {
			if (size < body - offset + 100) return undefined;
			if (body + 1 > limit) return body + 1;
			const version = bytes[body], timescale = body + (version === 1 ? 20 : 12);
			if (version > 1 || size < body - offset + (version === 1 ? 112 : 100)) return undefined;
			if (timescale + 4 > limit) return timescale + 4;
			return view.getUint32(timescale) > 0 ? 'video/quicktime' : undefined;
		}
		offset += size;
	}
	return undefined;
}

function movieEvidence(bytes: Uint8Array, view: DataView): HeaderEvidence {
	if (bytes.length < 8) return undefined;
	for (let offset = 0;;) {
		if (offset + 8 > bytes.length) return offset + 8;
		const fileType = textAt(bytes, offset + 4, 'ftyp'), movie = textAt(bytes, offset + 4, 'moov');
		if (!fileType && !movie && !['free', 'skip', 'wide', 'mdat'].some(type => textAt(bytes, offset + 4, type))) return undefined;
		let size = view.getUint32(offset), body = offset + 8;
		if (size === 1) {
			if (body + 8 > bytes.length) return body + 8;
			size = Number(view.getBigUint64(body));
			body += 8;
		}
		if (!Number.isSafeInteger(offset + size + 8) || (size < body - offset && !(movie && size === 0))) return undefined;
		if (fileType) {
			if (size < body - offset + 8 || size % 4 !== 0) return undefined;
			if (body + 8 > bytes.length) return body + 8;
			if (textAt(bytes, body, 'qt  ')) return 'video/quicktime';
			if (['isom', 'iso2', 'iso5', 'iso6', 'mp41', 'mp42', 'M4A ', 'M4B '].some(brand => textAt(bytes, body, brand))) return 'audio/mp4';
			return 'ftyp';
		}
		if (movie) return movieHeaderEvidence(bytes, view, body, size ? offset + size : Number.MAX_SAFE_INTEGER);
		offset += size;
	}
}

function ebmlEvidence(bytes: Uint8Array, view: DataView): HeaderEvidence {
	if (bytes.length < 5 || view.getUint32(0) !== 0x1a45dfa3) return undefined;
	// Walk the EBML header to read DocType and follow padding by its declared width.
	const vint = (offset: number, id = false): { value: number; end: number } | undefined => {
		const first = bytes[offset];
		if (!first) return undefined;
		const width = Math.clz32(first) - 23;
		if (width > (id ? 4 : 8) || offset + width > bytes.length) return undefined;
		let value = id ? first : first & (0xff >> width);
		for (let i = 1; i < width; i++) value = value * 256 + bytes[offset + i];
		return Number.isSafeInteger(value) ? { value, end: offset + width } : undefined;
	};
	const header = vint(4);
	if (!header || !Number.isSafeInteger(header.end + header.value)) return undefined;
	const end = header.end + header.value;
	for (let offset = header.end; offset < end;) {
		const id = vint(offset, true), size = id && vint(id.end);
		if (!id || !size) {
			const fields = Math.min(end, offset + 12); // A four-byte ID and eight-byte size.
			return fields > bytes.length ? fields : undefined;
		}
		const next = size.end + size.value;
		if (next > end) return undefined;
		if (id.value === 0x4282) {
			if (size.value !== 4 && size.value !== 8) return undefined;
			if (next > bytes.length) return next;
			if (size.value === 4 && textAt(bytes, size.end, 'webm')) return 'audio/webm';
			if (size.value === 8 && textAt(bytes, size.end, 'matroska')) return 'audio/x-matroska';
		}
		offset = next;
	}
	return undefined;
}

/** Plausible box headers can request more bytes. Padding alone does not identify the source. */
export function paddedHeaderEvidence(bytes: Uint8Array, view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)): HeaderEvidence {
	return movieEvidence(bytes, view) ?? ebmlEvidence(bytes, view);
}

function transportStream(bytes: Uint8Array, stride: number, offset: number): boolean {
	// TS, M2TS and error-corrected TS have the same four-byte packet header.
	if (bytes.length < offset + 2 * stride + 5) return false;
	let varying = false;
	for (let packet = 0; packet < 3; packet++) {
		const start = offset + packet * stride, control = (bytes[start + 3] >> 4) & 3;
		if (bytes[start] !== 0x47 || control === 0) return false;
		if (control === 2 && bytes[start + 4] !== 183 || control === 3 && bytes[start + 4] > 182) return false;
		varying ||= bytes[start + 1] !== bytes[offset + 1] || bytes[start + 2] !== bytes[offset + 2] || bytes[start + 3] !== bytes[offset + 3];
	}
	return varying; // A repeating PCM sample can match every sync byte and control field.
}

const mpegRates = [44100, 48000, 32000];
const mp3Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const mp2Bitrates = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384];
const mpegLowRateBitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

// A single frame sync is also an ordinary PCM sample. Follow two declared frame
// lengths to a third consistent header before treating untagged AAC or MPEG audio as encoded.
function framedAudio(bytes: Uint8Array): string | undefined {
	if (bytes[0] !== 0xff) return undefined;
	const adts = (bytes[1] & 0xf6) === 0xf0;
	const version = (bytes[1] >> 3) & 3;
	const layer = (bytes[1] >> 1) & 3;
	const rateIndex = (bytes[2] >> 2) & 3;
	let offset = 0;
	for (let i = 0; i < 3; i++) {
		if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xfe) !== (bytes[1] & 0xfe)) return undefined;
		let length: number;
		if (adts) {
			if (offset + 7 > bytes.length || ((bytes[offset + 2] ^ bytes[2]) & 0xfd) || ((bytes[2] >> 2) & 15) > 12) return undefined;
			length = ((bytes[offset + 3] & 3) << 11) | (bytes[offset + 4] << 3) | (bytes[offset + 5] >> 5);
			if (length <= (bytes[offset + 1] & 1 ? 7 : 9)) return undefined;
		} else {
			if (offset + 4 > bytes.length || (bytes[1] & 0xe0) !== 0xe0 || (layer !== 1 && layer !== 2) || version === 1 || rateIndex === 3
				|| ((bytes[offset + 2] >> 2) & 3) !== rateIndex) return undefined;
			const bitrate = (version !== 3 ? mpegLowRateBitrates : layer === 2 ? mp2Bitrates : mp3Bitrates)[bytes[offset + 2] >> 4];
			if (!bitrate) return undefined;
			const rate = mpegRates[rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
			length = Math.floor((version === 3 || layer === 2 ? 144000 : 72000) * bitrate / rate) + ((bytes[offset + 2] >> 1) & 1);
		}
		offset += length;
	}
	return adts ? 'audio/aac' : 'audio/mpeg';
}

const ac3Bitrates = [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512, 576, 640];

// AC-3 and E-AC-3 share a sync word. Require a second valid header at the length
// declared by the first. A high-bitrate frame can occupy most of the retained prefix.
function dolbyAudio(bytes: Uint8Array): string | undefined {
	const swapped = bytes[0] === 0x77 ? 1 : 0;
	const header = (offset: number) => {
		const byte = (i: number) => bytes[offset + (i ^ swapped)];
		if (offset + 6 > bytes.length || byte(0) !== 0x0b || byte(1) !== 0x77) return 0;
		const id = byte(5) >> 3, rate = byte(4) >> 6;
		if (id > 10) {
			if (id > 16 || (byte(2) >> 6) === 3 || (rate === 3 && (byte(4) & 0x30) === 0x30)) return 0;
			return 2 * (1 + ((byte(2) & 7) << 8) + byte(3));
		}
		const sizeCode = byte(4) & 63, bitrate = ac3Bitrates[sizeCode >> 1];
		if (!bitrate || rate === 3) return 0;
		return rate === 1 ? 2 * (Math.floor(bitrate * 320 / 147) + (sizeCode & 1)) : bitrate * (rate === 0 ? 4 : 6);
	};
	const length = header(0);
	if (length < 7 || header(length) < 7 || bytes[5 ^ swapped] >> 3 !== bytes[length + (5 ^ swapped)] >> 3) return undefined;
	return bytes[5 ^ swapped] >> 3 > 10 ? 'audio/eac3' : 'audio/ac3';
}

function dtsAudio(bytes: Uint8Array, view: DataView): boolean {
	if (bytes.length < 10) return false;
	const sync = view.getUint32(0);
	const packed = sync === 0x1fffe800 || sync === 0xff1f00e8;
	if (!packed && sync !== 0x7ffe8001 && sync !== 0xfe7f0180) return false;
	const swapped = sync === 0xff1f00e8 || sync === 0xfe7f0180 ? 1 : 0;
	const byte = (i: number) => bytes[i ^ swapped];
	const size = 1 + (packed ? ((byte(6) & 3) << 12) | (byte(7) << 4) | ((byte(8) >> 2) & 15)
		: ((byte(5) & 3) << 12) | (byte(6) << 4) | (byte(7) >> 4));
	const next = packed ? Math.floor(size * 16 / 14) : size;
	return next >= 96 && next + 10 <= bytes.length && view.getUint32(next) === sync;
}

function loasAudio(bytes: Uint8Array): boolean {
	let offset = 0;
	for (let frame = 0; frame < 3; frame++) {
		if (offset + 3 > bytes.length || bytes[offset] !== 0x56 || (bytes[offset + 1] & 0xe0) !== 0xe0) return false;
		const length = ((bytes[offset + 1] & 31) << 8) | bytes[offset + 2];
		if (length < 4) return false;
		offset += 3 + length;
	}
	return true;
}

/** A container or manifest selects encoded routing. Some signatures establish only the format family. */
export function audioContainer(bytes: Uint8Array): string | undefined {
	bytes = bytes.subarray(0, audioPrefixBytes);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (textAt(bytes, 0, '#!AMR\n') || textAt(bytes, 0, '#!AMR_MC1.0\n')) return 'audio/amr';
	if (textAt(bytes, 0, '#!AMR-WB\n') || textAt(bytes, 0, '#!AMR-WB_MC1.0\n')) return 'audio/amr-wb';
	if (textAt(bytes, 0, 'NIST_1A\n')) return 'audio/x-nist';
	if (textAt(bytes, 0, 'nut/multimedia container\0')) return 'video/x-nut';
	if (textAt(bytes, 0, 'Creative Voice File\x1a')) return 'audio/x-voc';
	if (textAt(bytes, 0, '\0\nSMJPEG')) return 'video/x-smjpeg';
	if (textAt(bytes, 0, 'MMMD') && textAt(bytes, 8, 'CNTI')) return 'application/vnd.smaf';
	if (bytes.length >= 18 && (textAt(bytes, 0, '.RMF') || textAt(bytes, 0, '.RMP')) && view.getUint32(4) >= 18 && view.getUint32(4) <= 0xffff) return 'application/vnd.rn-realmedia';
	if (bytes.length >= 32 && textAt(bytes, 0, 'wvpk') && view.getUint32(4, true) >= 24
		&& view.getUint16(8, true) >= 0x402 && view.getUint16(8, true) <= 0x410) return 'audio/wavpack';
	if (bytes.length >= 22 && textAt(bytes, 0, 'TTA1') && [1, 2].includes(view.getUint16(4, true))
		&& view.getUint16(6, true) && view.getUint16(8, true) && view.getUint32(10, true)) return 'audio/x-tta';
	if (bytes.length >= 32 && (textAt(bytes, 0, '.SoX') || textAt(bytes, 0, 'XoS.')) && view.getUint32(4) && view.getUint32(24)) return 'audio/x-sox';
	if (bytes.length >= 16 && ((textAt(bytes, 0, '\x64\xa3') && bytes[2] >= 1 && bytes[2] <= 4 && bytes[3] === 0)
		|| (bytes[0] === 0 && bytes[1] >= 1 && bytes[1] <= 3 && textAt(bytes, 2, '\xa3\x64')))
		&& view.getUint32(4) && view.getUint32(8)) return 'audio/x-ircam';
	if (textAt(bytes, 0, '\0\0\x01\xba')) {
		const next = (bytes[4] & 0xf1) === 0x21 ? 12 : (bytes[4] & 0xc4) === 0x44 ? 14 + (bytes[13] & 7) : 0;
		if (next && textAt(bytes, next, '\0\0\x01') && bytes[next + 3] >= 0xbb) return 'video/mpeg';
	}
	if (bytes[0] === 0x0b || bytes[0] === 0x77) {
		const dolby = dolbyAudio(bytes);
		if (dolby) return dolby;
	}
	if (dtsAudio(bytes, view)) return 'audio/vnd.dts';
	if (bytes[0] === 0x56 && loasAudio(bytes)) return 'audio/mp4a-latm';
	if (textAt(bytes, 0, 'ffconcat version 1.0') && (bytes[20] === 10 || textAt(bytes, 20, '\r\n'))) return 'ffconcat';
	if (textAt(bytes, 0, '#EXTM3U') && (bytes[7] === 10 || textAt(bytes, 7, '\r\n'))
		&& new TextDecoder().decode(bytes).includes('\n#EXT-X-')) return 'application/vnd.apple.mpegurl';
	if (textAt(bytes, 8, 'WAVE') && ['RIFF', 'RIFX', 'RF64', 'BW64'].some(id => textAt(bytes, 0, id))) return 'audio/wav';
	if (textAt(bytes, 0, 'RIFF') && textAt(bytes, 8, 'AVI ')) return 'video/vnd.avi';
	if (textAt(bytes, 0, '\x30\x26\xb2\x75\x8e\x66\xcf\x11\xa6\xd9\x00\xaa\x00\x62\xce\x6c')) return 'video/x-ms-asf';
	if (bytes.length >= 13 && textAt(bytes, 0, 'FLV\x01') && (bytes[4] & ~5) === 0) {
		const headerSize = view.getUint32(5);
		if (headerSize >= 9 && headerSize <= bytes.length - 4 && view.getUint32(headerSize) === 0) return 'video/x-flv';
	}
	if (transportStream(bytes, 188, 0) || transportStream(bytes, 192, 4) || transportStream(bytes, 204, 0)) return 'video/mp2t';
	if (textAt(bytes, 0, 'caff') && textAt(bytes, 4, '\x00\x01\x00\x00desc')) return 'audio/x-caf';
	if (textAt(bytes, 0, 'riff\x2e\x91\xcf\x11\xa5\xd6\x28\xdb\x04\xc1\x00\x00') && textAt(bytes, 24, 'wave')) return 'audio/x-w64';
	if (bytes.length >= 12 && textAt(bytes, 0, 'FORM') && view.getUint32(4) >= 4
		&& (textAt(bytes, 8, 'AIFF') || textAt(bytes, 8, 'AIFC'))) return 'audio/aiff';
	if (bytes.length >= 24 && textAt(bytes, 0, '.snd') && view.getUint32(4) >= 24
		&& view.getUint32(12) && view.getUint32(16) && view.getUint32(20)) return 'audio/basic';
	// A FLAC stream starts with a 34-byte STREAMINFO metadata block.
	if (bytes.length >= 42 && textAt(bytes, 0, 'fLaC') && (bytes[4] & 0x7f) === 0
		&& bytes[5] === 0 && bytes[6] === 0 && bytes[7] === 34) return 'audio/flac';
	if (bytes.length >= 27 && textAt(bytes, 0, 'OggS') && bytes[4] === 0 && bytes[5] <= 7
		&& bytes.length >= 27 + bytes[26]) return 'audio/ogg';
	if (bytes.length >= 10 && textAt(bytes, 0, 'ID3') && bytes[3] >= 2 && bytes[3] <= 4 && bytes[4] !== 255
		&& (bytes[5] & (0xff >> (bytes[3] === 2 ? 2 : bytes[3] === 3 ? 3 : 4))) === 0
		&& bytes.subarray(6, 10).every(value => value < 128)) return 'ID3';
	const container = paddedHeaderEvidence(bytes, view);
	if (typeof container === 'string') return container;
	// MXF permits a run-in before its header partition. A generic four-byte SMPTE label is insufficient.
	for (let i = bytes.indexOf(0x06); i >= 0 && i + 16 <= bytes.length; i = bytes.indexOf(0x06, i + 1)) {
		if (textAt(bytes, i, '\x06\x0e\x2b\x34\x02\x05\x01\x01\x0d\x01\x02\x01\x01\x02')
			&& bytes[i + 14] >= 1 && bytes[i + 14] <= 4 && bytes[i + 15] === 0) return 'application/mxf';
	}
	return framedAudio(bytes);
}

/** The muxer, not the input label, owns the format of prepared files. */
export const preparedAudioTypes: Readonly<Record<string, string | undefined>> = {
	wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/ogg',
	mp3: 'audio/mpeg', mp4: 'audio/mp4', ipod: 'audio/mp4', adts: 'audio/aac',
	webm: 'audio/webm',
};
