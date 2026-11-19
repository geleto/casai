import assert from 'node:assert/strict';
import { sdkPcm } from './pcm-reference.js';
import { asMonoPcm16, float32ToPcm16, resamplePcm16, preparePcmStream, readWav, writeWav, type PcmFormat } from '../src/audio/pcm.js';
import { ValidationError } from '../src/index.js';
import { concatAudio } from '../src/audio.js';

async function collect(stream: ReadableStream<Uint8Array>) {
	const chunks: Uint8Array[] = [];
	for await (const chunk of stream) chunks.push(chunk);
	return (await concatAudio(chunks));
}
function chunks(bytes: Uint8Array, size: number) {
	let position = 0;
	return new ReadableStream<Uint8Array>({ pull(controller) {
		if (position === bytes.length) controller.close();
		else { controller.enqueue(bytes.subarray(position, position + size)); position = Math.min(position + size, bytes.length); }
	} }, { highWaterMark: 0 });
}
describe('Explicit PCM and WAV preparation', () => {
	it('imports native helpers lazily and rejects unavailable browser execution before reading media', async () => {
		const native = await import('../src/audio/native.js');
		assert.equal(typeof native.prepareAudio, 'function');
		const browser = await import('../src/audio/native-unavailable.js');
		let reads = 0;
		const audio = new ReadableStream<Uint8Array>({ pull() { reads++; } }, { highWaterMark: 0 });
		await assert.rejects(browser.prepareAudio(audio, { inputAudioFormat: { type: 'audio/pcm', rate: 24000 } }), {
			name: 'ConfigError',
			message: /Node\.js.*node-av.*PCM.*WAV.*Transcriber.*\.loadsAudio/,
		});
		assert.equal(reads, 0);
	});
	it('converts unaligned bounded byte views and clips PCM16 samples', async () => {
		const storage = Uint8Array.of(99, 0, 128, 0, 0, 255, 127, 1, 0, 99);
		const format = { channels: 2, sampleRate: 48000, encoding: 'pcm_s16le' } as const;
		assert.deepEqual(await asMonoPcm16(storage.subarray(1, 9), format), Uint8Array.of(0, 192, 255, 63));
		assert.deepEqual((await float32ToPcm16(Float32Array.of(-2, -0.5, 0, 0.5, 2))), Uint8Array.of(0, 128, 0, 192, 0, 0, 255, 63, 255, 127));
		await assert.rejects(async () => (await asMonoPcm16(new Uint8Array(1), format)), ValidationError);
	});
	it('matches native SDK interpolation, Float32 rounding and EOF behavior without mutating input', async () => {
		for (const count of [0, 1, 2, 7, 101, 65536]) {
			const storage = new Uint8Array(count * 2 + 2), view = new DataView(storage.buffer);
			for (let i = 0; i < count; i++) view.setInt16(1 + i * 2, (i * 32749) % 65536 - 32768, true);
			const input = storage.subarray(1, -1), original = storage.slice();
			for (const [from, to] of [[48000, 24000], [44100, 24000], [24000, 44100], [8000, 48000], [48000, 11025]]) {
				const expected = sdkPcm(input, from, to);
				assert.deepEqual(await resamplePcm16(input, from, to), expected, `${count} samples, ${from} -> ${to}`);
			}
			assert.equal(await resamplePcm16(input, 24000, 24000), input);
			assert.deepEqual(storage, original);
		}
		await assert.rejects(resamplePcm16(new Uint8Array(3), 48000, 24000), ValidationError);
	});
	for (const ratio of [2, 3, 4, 6]) it(`matches finite SDK resampling across chunk splits and every EOF remainder (ratio ${ratio})`, async function () {
		this.timeout(60000);
		for (let count = 0; count < 20; count++) {
			const pcm = (await float32ToPcm16(Float32Array.from({ length: count }, (_, i) => Math.sin(i))));
			const expected = await resamplePcm16(pcm, 24000 * ratio, 24000);
			for (const size of [1, 3, 7, 64]) {
				assert.deepEqual(await collect(preparePcmStream(chunks(pcm, size), 24000 * ratio, 24000).audio), expected);
			}
		}
	});
	it('keeps reads lazy and forwards cancellation before and during consumption', async () => {
		let reads = 0, cancelled: unknown;
		const source = () => new ReadableStream<Uint8Array>({ pull() { reads++; }, cancel(reason) { cancelled = reason; } }, { highWaterMark: 0 });
		const first = preparePcmStream(source(), 48000, 24000).audio;
		await Promise.resolve(); assert.equal(reads, 0);
		await first.cancel('abandoned'); assert.equal(cancelled, 'abandoned');
		const second = preparePcmStream(source(), 48000, 24000).audio.getReader();
		const pending = second.read(); await Promise.resolve(); await Promise.resolve();
		assert.equal(reads, 1); await second.cancel('stopped'); assert.equal(cancelled, 'stopped');
		assert.equal((await pending).done, true);
	});
	it('copies a Buffer chunk remainder so the source can reuse its storage after delivery', async () => {
		const input = Buffer.from([1, 0, 2, 0, 3, 0]);
		const expected = await resamplePcm16(input, 48000, 24000);
		const source = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(input); controller.close(); } });
		const reader = preparePcmStream(source, 48000, 24000).audio.getReader();
		const first = (await reader.read()).value!;
		input.fill(255);
		const tail = (await reader.read()).value!;
		assert.deepEqual((await concatAudio([first, tail])), expected);
		assert.equal((await reader.read()).done, true);
	});
	it('allows cancellation between empty PCM chunks', async () => {
		let reads = 0, cancelled: unknown;
		const source = new ReadableStream<Uint8Array>({ pull(controller) {
			if (++reads === 1) setImmediate(() => { void reader.cancel('stop'); });
			assert(reads < 1000, 'Empty input must yield to the caller');
			controller.enqueue(new Uint8Array(0));
		}, cancel(reason) { cancelled = reason; } }, { highWaterMark: 0 });
		const reader = preparePcmStream(source, 48000, 24000).audio.getReader();
		assert((await reader.read()).done);
		// The pending read finishes as cancellation begins. Await the underlying source cleanup.
		await new Promise<void>(resolve => { setImmediate(resolve); });
		assert.equal(cancelled, 'stop'); assert.equal(source.locked, false);
	});
	it('rejects a partial final sample and preserves source failures', async () => {
		await assert.rejects(collect(preparePcmStream(chunks(new Uint8Array(7), 3), 48000, 24000).audio), ValidationError);
		const failure = new Error('source failed');
		await assert.rejects(collect(preparePcmStream(new ReadableStream({ pull() { throw failure; } }), 48000, 24000).audio), error => error === failure);
		assert.deepEqual(await collect(preparePcmStream(chunks(new Uint8Array(), 1), 44100, 24000).audio), new Uint8Array(0));
		await assert.rejects(resamplePcm16(new Uint8Array(), 0, 24000), ValidationError);
		const source = chunks(new Uint8Array(2), 2); assert.equal(preparePcmStream(source, 24000, 24000).audio, source);
	});
	it('round-trips all supported PCM layouts without normalizing channels or precision', async () => {
		for (const [encoding, size] of Object.entries({ pcm_u8: 1, pcm_s16le: 2, pcm_s24le: 3, pcm_s32le: 4, pcm_f32le: 4, pcm_f64le: 8 })) {
			for (const channels of [1, 2, 6]) {
				const format: PcmFormat = { encoding: encoding as PcmFormat['encoding'], channels, sampleRate: 48000 };
				const audio = Uint8Array.from({ length: size * channels * 7 }, (_, i) => i % 256);
				assert.deepEqual((await readWav((await writeWav(audio, format)))), { audio, format });
			}
		}
	});
	it('reads padded ancillary chunks, bounded views and extensible PCM headers', async () => {
		const original = (await writeWav(Uint8Array.of(16, 2, 48, 4), { encoding: 'pcm_s16le', channels: 2, sampleRate: 96000 }));
		const wav = new Uint8Array(original.length + 10); wav.set(original.subarray(0, 12));
		wav.set([74, 85, 78, 75, 1, 0, 0, 0, 99, 0], 12); wav.set(original.subarray(12), 22);
		new DataView(wav.buffer).setUint32(4, wav.length - 8, true);
		const storage = new Uint8Array(wav.length + 2); storage.set(wav, 1);
		assert.deepEqual((await readWav(storage.subarray(1, -1))), (await readWav(original)));
		const extended = new Uint8Array(original.length + 24); extended.set(original.subarray(0, 36)); extended.set(original.subarray(36), 60);
		const view = new DataView(extended.buffer); view.setUint32(4, extended.length - 8, true); view.setUint32(16, 40, true);
		view.setUint16(20, 0xfffe, true); view.setUint16(36, 22, true); view.setUint16(38, 16, true); view.setUint32(40, 3, true);
		extended.set([1, 0, 0, 0, 0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 155, 113], 44);
		assert.deepEqual((await readWav(extended)), (await readWav(original)));
		view.setUint16(38, 12, true);
		assert.deepEqual((await readWav(extended)), (await readWav(original)));
		view.setUint32(16, 0xffffffff, true); await assert.rejects(async () => (await readWav(extended)), ValidationError);
		await assert.rejects(async () => (await readWav(original.subarray(0, -1))), ValidationError);
		await assert.rejects(async () => (await writeWav(new Uint8Array(3), { encoding: 'pcm_s16le', channels: 1, sampleRate: 24000 })), ValidationError);
	});
});
