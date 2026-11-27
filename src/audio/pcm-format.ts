import { type ConfigError, ValidationError } from '../errors.js';
import type { PcmFormat, PcmSamples, PcmSourceFormat } from './pcm.js';

// Use the intrinsic typed-array brand just as the SDK does for Uint8Array.
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
export function sampleEncoding(samples: unknown): PcmFormat['encoding'] | undefined {
	if (!ArrayBuffer.isView(samples)) return undefined;
	switch (Reflect.get(typedArrayPrototype, Symbol.toStringTag, samples)) {
		case 'Float32Array': return 'pcm_f32le';
		case 'Float64Array': return 'pcm_f64le';
		case 'Int16Array': return 'pcm_s16le';
		case 'Int32Array': return 'pcm_s32le';
		default: return undefined;
	}
}
export function isPcmSamples(audio: unknown): audio is PcmSamples {
	return sampleEncoding(audio) !== undefined;
}
export function sampleFormat(source: PcmSourceFormat, samples: unknown): PcmFormat {
	const encoding = sampleEncoding(samples);
	if (encoding && source.encoding && encoding !== source.encoding) throw new ValidationError('sourceFormat.encoding conflicts with the sample array type.');
	const selected = encoding ?? source.encoding;
	if (!selected) throw new ValidationError('Headerless PCM bytes require sourceFormat.encoding. A numeric sample array supplies its encoding.');
	const format = { sampleRate: source.sampleRate, channels: source.channels, encoding: selected };
	pcmFrameSize(format);
	return format;
}

export const sampleBytes = { pcm_u8: 1, pcm_s16le: 2, pcm_s24le: 3, pcm_s32le: 4, pcm_f32le: 4, pcm_f64le: 8 } as const;
export function validatePcmLayout(format: PcmSourceFormat, ErrorClass: typeof ConfigError | typeof ValidationError, requireEncoding = false): void {
	for (const key of ['sampleRate', 'channels'] as const) {
		if (!Number.isSafeInteger(format[key]) || format[key] <= 0) throw new ErrorClass(`${key} must be a positive integer.`);
	}
	if ((requireEncoding || format.encoding !== undefined) && !Object.hasOwn(sampleBytes, format.encoding!)) throw new ErrorClass('Unsupported PCM sample encoding.');
}
export function pcmFrameSize(format: PcmFormat): number {
	validatePcmLayout(format, ValidationError, true);
	return sampleBytes[format.encoding] * format.channels;
}
