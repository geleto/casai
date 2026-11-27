import { ValidationError } from '../errors.js';
import { browserFile } from './browser-file.js';
import type { PcmFormat } from './pcm.js';
import { pcmFrameSize } from './pcm-format.js';
import { concatAudio, interleaveChannels, monoPcm16, wavHeader } from './pcm-operations.js';
import { createPcmStreamConverter } from './pcm-stream.js';
import { checkPreparedAudioBytes, defaultPreparedAudioBytes, type FileAudioFormat, type PrepareAudioSettings } from './preparation.js';

const storageFormats = {
	pcm_u8: 'u8', pcm_s16le: 's16', pcm_s24le: 's32', pcm_s32le: 's32', pcm_f32le: 'flt', pcm_f64le: 'dbl',
} as const;

export function browserTargetSupported(target: FileAudioFormat) {
	if (target.format === 'wav' && Object.hasOwn(storageFormats, target.codec)) {
		return target.sampleFormat === undefined || target.sampleFormat === storageFormats[target.codec as PcmFormat['encoding']];
	}
	return target.sampleFormat === undefined && (target.format === 'webm' && target.codec === 'libopus'
		|| (target.format === 'ipod' || target.format === 'mp4') && target.codec === 'aac');
}

type Samples = Uint8Array | Uint8Array[] | AsyncIterable<Uint8Array>;

async function* framesOf(samples: Samples, stride: number, block: number) {
	if (Array.isArray(samples)) {
		for (let pos = 0; pos < samples[0].length; pos += block * 4) {
			yield interleaveChannels(samples.map(plane => plane.subarray(pos, pos + block * 4)));
		}
		return;
	}
	let tail: Uint8Array = new Uint8Array(0);
	for await (const chunk of samples instanceof Uint8Array ? [samples] : samples) {
		const bytes = tail.length ? concatAudio([tail, chunk]) : chunk;
		const end = bytes.length - bytes.length % stride;
		for (let pos = 0; pos < end; pos += block * stride) yield bytes.subarray(pos, Math.min(pos + block * stride, end));
		tail = bytes.slice(end);
	}
	if (tail.length) throw new ValidationError('PCM ends with an incomplete audio frame.');
}

// Each retained channel needs its own interpolation history. Both paths use the ordinary PCM16 converter.
function pcm16Converter(source: PcmFormat, channels: number, ratio: number) {
	const scalar = { ...source, channels: 1 };
	if (ratio === 1 && channels > 1) return (bytes?: Uint8Array) => bytes ? monoPcm16(bytes, scalar) : new Uint8Array(0);
	const converters = Array.from({ length: channels }, createPcmStreamConverter);
	if (channels === 1) return (bytes?: Uint8Array) => converters[0](bytes, ratio, source);
	return (bytes?: Uint8Array) => {
		const input = bytes && monoPcm16(bytes, scalar);
		const view = input && new DataView(input.buffer, input.byteOffset, input.byteLength);
		const lanes = converters.map((convert, channel) => {
			let plane: Uint8Array | undefined;
			if (view) {
				plane = new Uint8Array(view.byteLength / channels);
				const dst = new DataView(plane.buffer);
				for (let i = 0; i < plane.length; i += 2) dst.setInt16(i, view.getInt16(i * channels + 2 * channel, true), true);
			}
			const lane = convert(plane, ratio);
			return new DataView(lane.buffer, lane.byteOffset, lane.byteLength);
		});
		const output = new Uint8Array(lanes[0].byteLength * channels), dst = new DataView(output.buffer);
		for (const [channel, lane] of lanes.entries()) {
			for (let i = 0; i < lane.byteLength; i += 2) dst.setInt16(i * channels + 2 * channel, lane.getInt16(i, true), true);
		}
		return output;
	};
}

/** Decoded recordings, described bytes and worker-owned channel planes share the same sample path. */
export async function* prepareDecodedAudio(samples: Samples, source: PcmFormat, settings: PrepareAudioSettings, byteLength?: number) {
	const stride = pcmFrameSize(source);
	const sizeIn = samples instanceof Uint8Array ? samples.length : byteLength;
	const knownFrames = Array.isArray(samples) ? samples[0].byteLength / 4 : sizeIn === undefined ? undefined : sizeIn / stride;
	if (knownFrames !== undefined && !Number.isInteger(knownFrames)) throw new ValidationError('PCM ends with an incomplete audio frame.');
	const file = settings.fileAudioTarget;
	const copy = file && [file, ...file.alternatives ?? []].find(profile => profile.format === 'wav' && profile.codec === source.encoding
		&& browserTargetSupported(profile) && (profile.channels ?? source.channels) === source.channels && (profile.rate ?? source.sampleRate) === source.sampleRate);
	const profile = copy ?? file;
	if (profile && (profile.format !== 'wav' || !Object.hasOwn(storageFormats, profile.codec))) {
		throw new ValidationError('The samples cannot be copied to the requested file target.');
	}
	const encoding = profile ? profile.codec as PcmFormat['encoding'] : 'pcm_s16le';
	const rate = settings.inputAudioFormat?.rate ?? profile?.rate ?? source.sampleRate;
	const channels = profile ? profile.channels ?? source.channels : 1;
	const target = { encoding, channels, sampleRate: rate }, targetStride = pcmFrameSize(target);
	const ratio = source.sampleRate / rate;
	const identity = encoding === source.encoding && ratio === 1 && channels === source.channels;
	if (!identity && (encoding !== 'pcm_s16le' || channels !== 1 && channels !== source.channels)) {
		throw new ValidationError('The browser cannot preserve this PCM layout in the requested WAV. Choose the source layout or mono PCM16.');
	}
	const budget = settings.maxPreparedAudioBytes ?? defaultPreparedAudioBytes;
	const fileLimit = file?.maxBytes ?? budget;
	function check(frames: number) {
		const count = Math.round(frames / ratio), bytes = count * targetStride;
		checkPreparedAudioBytes(bytes, budget);
		const size = 44 + bytes + (bytes & 1);
		if (file && size > fileLimit) throw new ValidationError('Prepared WAV exceeds the file byte limit.');
		if (file?.maxDurationSeconds !== undefined && count / rate > file.maxDurationSeconds) throw new ValidationError('Prepared WAV exceeds fileAudioTarget.maxDurationSeconds.');
		return size;
	}
	const size = check(knownFrames ?? 0);
	const output = file && browserFile(fileLimit, size);
	const block = Math.max(1, Math.floor(Math.min(65536 / stride, 65536 / targetStride * ratio)));
	const convert = identity ? undefined : pcm16Converter(source, channels, ratio);
	let frames = 0, written = 0;
	function* emit(bytes: Uint8Array) {
		if (output) output.write(44 + written, bytes);
		else for (let pos = 0; pos < bytes.length; pos += 65536) yield bytes.subarray(pos, pos + 65536);
		written += bytes.length;
	}
	if (!file) yield { format: settings.inputAudioFormat };
	for await (const bytes of framesOf(samples, stride, block)) {
		frames += bytes.length / stride;
		if (knownFrames === undefined) check(frames);
		yield* emit(convert ? convert(bytes) : bytes);
	}
	if (convert) yield* emit(convert());
	if (output) {
		output.write(0, wavHeader(written, target));
		if (written & 1) output.write(44 + written, Uint8Array.of(0));
		return { audio: output.bytes(), format: { format: 'wav', codec: encoding, rate, channels, sampleFormat: storageFormats[encoding] } };
	}
	return undefined;
}
