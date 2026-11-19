import { ValidationError } from '../errors.js';

/** Linear PCM16 interpolation with SDK-compatible Float32 rounding, without intermediate sample arrays. */
export function resamplePcm16Range(
	input: Uint8Array, ratio: number, outputStart: number, count: number,
	inputStart = 0, totalSamples = input.byteLength / 2,
	output: Uint8Array = new Uint8Array(count * 2),
): Uint8Array {
	const source = new DataView(input.buffer, input.byteOffset, input.byteLength);
	const target = new DataView(output.buffer, output.byteOffset, output.byteLength);
	for (let i = 0; i < count; i++) {
		const position = (outputStart + i) * ratio, left = Math.floor(position);
		const right = Math.min(left + 1, totalSamples - 1), fraction = position - left;
		const a = source.getInt16((left - inputStart) * 2, true) / 32768;
		const b = source.getInt16((right - inputStart) * 2, true) / 32768;
		// The SDK stores interpolated samples in Float32Array before encoding them.
		const value = Math.fround(a * (1 - fraction) + b * fraction);
		target.setInt16(i * 2, value * (value < 0 ? 32768 : 32767), true);
	}
	return output;
}
/** One ordered stream worker. Only the first sample of an integer-ratio group contributes to its output. */
export function createStreamResampler() {
	let buffered = 0;
	const firstSample = new Uint8Array(2);
	return (input: Uint8Array | undefined, ratio: number): Uint8Array<ArrayBuffer> => {
		const group = ratio * 2;
		if (!input) {
			if (buffered % 2) throw new ValidationError('PCM16 ends with an incomplete sample.');
			const output = new Uint8Array(Math.round(buffered / group) * 2);
			resamplePcm16Range(firstSample, ratio, 0, output.length / 2, 0, 1, output);
			return output;
		}
		const count = Math.floor((buffered + input.length) / group);
		const output = new Uint8Array(count * 2);
		let start = 0, written = 0;
		if (buffered) {
			start = Math.min(group - buffered, input.length);
			if (buffered === 1 && start) firstSample[1] = input[0];
			buffered += start;
			if (buffered < group) return output;
			resamplePcm16Range(firstSample, ratio, 0, 1, 0, 1, output);
			written = 1;
		}
		const whole = count - written;
		if (whole) {
			resamplePcm16Range(input.subarray(start), ratio, 0, whole, 0, whole * ratio, output.subarray(written * 2));
			start += whole * group;
		}
		buffered = input.length - start;
		firstSample.set(input.subarray(start, start + 2));
		return output;
	};
}
