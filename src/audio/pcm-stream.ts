import { convertBase64ToUint8Array } from '@ai-sdk/provider-utils';
import { ValidationError } from '../errors.js';
import { monoPcm16, concatAudio } from './pcm-operations.js';
import { createStreamResampler, resamplePcm16Range } from './pcm-resample.js';
import type { PcmFormat } from './pcm.js';
import { pcmFrameSize } from './pcm-format.js';

/** Keep partial source frames and interpolation lookahead inside the stream's worker. */
export function createPcmStreamConverter() {
	const downsample = createStreamResampler();
	let partial: Uint8Array = new Uint8Array(0), lookahead: Uint8Array = new Uint8Array(0);
	let frames = 0, emitted = 0;
	let quartet = '';
	return (input: Uint8Array | string | undefined, ratio: number, format?: PcmFormat, moreBase64 = false): Uint8Array => {
		if (typeof input === 'string' && (moreBase64 || quartet)) {
			const text = quartet + input.replace(/[\t\n\f\r ]/g, '');
			// Keep the final (possibly padded) quartet until the producer chunk ends.
			const end = moreBase64 ? Math.max(0, Math.floor((text.length - 1) / 4) * 4) : text.length;
			quartet = text.slice(end);
			input = text.slice(0, end);
			if (quartet && input.endsWith('=')) throw new ValidationError('Invalid base64 padding in an audio chunk.');
		}
		let bytes = typeof input === 'string' ? convertBase64ToUint8Array(input) : input;
		if (format) {
			if (!bytes && partial.length) throw new ValidationError('PCM ends with an incomplete audio frame.');
			if (bytes) {
				if (partial.length) bytes = concatAudio([partial, bytes]);
				const end = bytes.length - bytes.length % pcmFrameSize(format);
				partial = bytes.slice(end);
				bytes = monoPcm16(bytes.subarray(0, end), format);
			}
		}
		if (ratio === 1) return bytes ?? new Uint8Array(0);
		if (Number.isInteger(ratio)) return downsample(bytes, ratio);
		// Fractional interpolation needs one sample past the last position. At EOF repeat the last sample.
		const start = Math.min(frames, Math.floor(emitted * ratio));
		const samples = bytes && lookahead.length ? concatAudio([lookahead, bytes]) : bytes ?? lookahead;
		frames += (bytes?.length ?? 0) / 2;
		const finalCount = Math.round(frames / ratio);
		const end = bytes ? Math.max(emitted, Math.min(finalCount, Math.ceil((frames - 1) / ratio))) : finalCount;
		const result = resamplePcm16Range(samples, ratio, emitted, end - emitted, start, frames);
		emitted = end;
		lookahead = samples.slice((Math.floor(emitted * ratio) - start) * 2);
		return result;
	};
}
