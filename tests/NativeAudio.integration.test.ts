import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { MessagePort, Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { runInNewContext } from 'node:vm';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { MockTranscriptionModelV4, Experimental_MockSpeechTranslationModelV4, convertArrayToReadableStream } from 'ai/test';
import { Config, create, Transcriber, Translator, ValidationError, ConfigError, z } from '../src/index.js';
import { writeWav, readWav, float32ToPcm16 } from '../src/audio/pcm.js';
import { prepareAudio } from '../src/audio/native.js';
import { concatAudio } from '../src/audio.js';

const target = { type: 'audio/pcm', rate: 24000 };
const pcm = (await float32ToPcm16(Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i * Math.PI / 24) / 3)));
const wav = (await writeWav(pcm, { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' }));
const native = await import(new URL('./fixtures/native-audio-media.mjs', import.meta.url).href) as {
	createAudioFile(path: string, samples: Uint8Array, settings: { codec: string; rate?: number; channels?: number; frameSamples?: number }): Promise<Uint8Array>;
	createVideoTracks(path: string, first?: Uint8Array, second?: Uint8Array): Promise<{ firstIndex: number; secondIndex: number }>;
	createPausedPcm(path: string, encoded?: Uint8Array, milliseconds?: number): Promise<{ bytes: Uint8Array; pauseAt: number }>;
	readAudioPackets(bytes: Uint8Array): Promise<{ seconds: number; data: Uint8Array }[]>;
	decodeMonoPcm(bytes: Uint8Array): Promise<Uint8Array>;
	assertMissingEncoderPacketsRejected(source: Uint8Array): Promise<void>;
	editMovie(bytes: Uint8Array, ranges: [number, number][]): Uint8Array;
	assertReleasedFramesOnDurationFailure(source: ReadableStream<Uint8Array>, settings: import('../src/audio/preparation.js').PrepareAudioSettings): Promise<void>;
	observeIO(action: (disposals: () => number, prepare: (source: ReadableStream<Uint8Array>, settings: import('../src/audio/preparation.js').PrepareAudioSettings) => ReturnType<typeof import('../src/audio/native-pipeline.js').prepareNativeAudio>) => Promise<void>, onCreate?: () => void): Promise<void>;
};
function bytesStream(bytes: Uint8Array, size = 17) {
	let position = 0;
	return new ReadableStream<Uint8Array>({ pull(controller) {
		if (position === bytes.length) controller.close();
		else { controller.enqueue(bytes.subarray(position, position + size)); position = Math.min(bytes.length, position + size); }
	} }, { highWaterMark: 0 });
}
async function consume(stream: ReadableStream<Uint8Array>) {
	const result: Uint8Array[] = [];
	for await (const chunk of stream) result.push(chunk);
	return (await concatAudio(result));
}
function captureTranscription() {
	const files: { audio: Uint8Array; mediaType: string }[] = [], raw: Uint8Array[] = [];
	let streamCalls = 0;
	const result = { text: 'heard', language: 'en', segments: [], durationInSeconds: 0.1 };
	const model = new MockTranscriptionModelV4({
		doGenerate: async ({ audio, mediaType }) => {
			files.push({ audio: typeof audio === 'string' ? Buffer.from(audio, 'base64') : audio, mediaType });
			return { ...result, warnings: [], response: { timestamp: new Date(0), modelId: 'mock' } };
		},
		doStream: async ({ audio }) => {
			streamCalls++;
			const chunks = []; for await (const chunk of audio) chunks.push(chunk);
			raw.push(await concatAudio(chunks));
			return { stream: convertArrayToReadableStream([{ type: 'finish', ...result }]) };
		},
	});
	return { model, files, raw, get streamCalls() { return streamCalls; } };
}
describe('Native audio preparation (LGPL integration)', function () {
	this.timeout(15000);
	let directory: string, filename: string;
	before(async () => {
		directory = await mkdtemp(resolve('tests/fixtures/native-audio-'));
		filename = resolve(directory, 'recording.wav'); await writeFile(filename, wav);
	});
	after(async () => { await rm(directory, { recursive: true, force: true }); });
	it('decodes AMR, SPHERE and untagged frames before applying a reusable PCM layout', async () => {
		const { model, raw } = captureTranscription();
		const sourceFormat = { encoding: 'pcm_s16le', sampleRate: 16000, channels: 2 } as const;
		const speech = Buffer.alloc(1024, 32);
		speech.write('NIST_1A\n   1024\nsample_count -i 2400\nsample_n_bytes -i 2\nchannel_count -i 1\nsample_byte_format -s2 01\nsample_rate -i 16000\nsample_coding -s3 pcm\nend_head\n');
		const amrFrame = Buffer.alloc(32, 0x55); amrFrame[0] = 0x3c;
		const recordings: [Uint8Array, number][] = [
			[Buffer.concat([speech, pcm.subarray(0, 4800)]), 16000],
			[Buffer.concat([Buffer.from('#!AMR\n'), ...Array<Buffer>(20).fill(amrFrame)]), 8000],
		];
		for (const codec of ['ac3', 'eac3', 'mp2']) {
			recordings.push([await native.createAudioFile(resolve(directory, 'frames.' + codec), pcm, { codec }), 48000]);
		}
		for (const [bytes, rate] of recordings) {
			const reference = await native.decodeMonoPcm(bytes);
			assert.ok(reference.length >= 320 && reference.some(Boolean));
			const transcribe = Transcriber.loadsAudio({ model, sourceFormat, inputAudioFormat: { type: 'audio/pcm', rate } });
			for (const source of [bytes, new Blob([Uint8Array.from(bytes)], { type: 'application/octet-stream' }), bytesStream(bytes, 37)]) {
				await transcribe(source); assert.deepEqual(raw.at(-1), reference);
			}
		}
	});
	it('keeps the final tone when large WavPack and TTA frames are encoded to MP3', async () => {
		const { model, files } = captureTranscription();
		const samples = Int16Array.from({ length: 96000 }, (_, i) => Math.round(10000 * Math.sin(2 * Math.PI * (i < 48000 ? 220 : 880) * i / 48000)));
		for (const [extension, codec] of [['wv', 'wavpack'], ['tta', 'tta']]) {
			const source = await native.createAudioFile(resolve(directory, 'large-frames.' + extension), new Uint8Array(samples.buffer), { codec });
			const originalSamples = (await native.decodeMonoPcm(source)).length / 2;
			for (const rate of [48000, 16000]) {
				await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'mp3', codec: 'libmp3lame', rate } })(source);
				const played = await native.decodeMonoPcm(files.at(-1)!.audio);
				const output = new Int16Array(played.buffer, played.byteOffset, played.length / 2);
				const expected = Math.round(originalSamples * rate / 48000);
				assert.ok(output.length >= expected && output.length <= expected + 1152, `${codec} at ${rate} Hz: ${output.length} for ${expected} samples`);
				let crossings = 0;
				for (let i = Math.floor(rate * 1.6); i < Math.floor(rate * 1.8); i++) if (output[i] < 0 && output[i + 1] >= 0) crossings++;
				assert.ok(Math.abs(crossings - 176) < 3, 'The final section must still contain 880 Hz');
			}
		}
	});
	it('retains every decoded frame when a RealMedia packet timestamps several frames together', async () => {
		const { model, files } = captureTranscription();
		const samples = Int16Array.from({ length: 16000 }, (_, i) => Math.round(10000 * Math.sin(i / (i < 8000 ? 8 : 3))));
		const source = await native.createAudioFile(resolve(directory, 'phone.rm'), new Uint8Array(samples.buffer), { codec: 'real_144', rate: 8000 });
		const original = await native.decodeMonoPcm(source);
		await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'flac', codec: 'flac' } })(source);
		const lossless = await native.decodeMonoPcm(files[0].audio);
		assert.deepEqual(lossless.subarray(0, original.length), original);
		assert.ok(lossless.subarray(original.length).every(byte => byte === 0));
		await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'ogg', codec: 'libopus' } })(source);
		const opus = await native.decodeMonoPcm(files[1].audio); // Opus decodes at 48 kHz.
		assert.ok(Math.abs(opus.length - original.length * 6) <= 1920);
		assert.ok(opus.subarray(48000 * 3, 48000 * 3.5).some(byte => byte > 16));
	});
	it('preserves a complete Vorbis conversion and copies its variable frames from a millisecond clock', async () => {
		const rate = 44100, { model, files, raw } = captureTranscription();
		const samples = Int16Array.from({ length: rate * 2 }, (_, i) => Math.round(12000 * Math.sin(2 * Math.PI * (i < rate ? 330 : 660) * i / rate)));
		const wav = await writeWav(new Uint8Array(samples.buffer), { sampleRate: rate, channels: 1, encoding: 'pcm_s16le' });
		const vorbis = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'ogg', codec: 'libvorbis' } });
		await vorbis(wav);
		const result = await native.decodeMonoPcm(files[0].audio);
		assert.ok(Math.abs(result.length / 2 - samples.length) <= 1024);
		const played = new Int16Array(result.buffer, result.byteOffset, result.length / 2);
		let crossings = 0;
		for (let i = Math.round(rate * 1.65); i < Math.round(rate * 1.85); i++) if (played[i] < 0 && played[i + 1] >= 0) crossings++;
		assert.ok(Math.abs(crossings - 132) < 3, 'The Vorbis file must retain the final 660 Hz section');
		await Transcriber.loadsAudio({ model, inputAudioFormat: { type: 'audio/pcm', rate } })(files[0].audio);
		assert.deepEqual(raw[0], result);
		await vorbis(files[0].audio);
		assert.deepEqual(await native.decodeMonoPcm(files[1].audio), result);
		await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'webm', codec: 'libvorbis' } })(wav);
		const continuous = files[2].audio;
		await vorbis(continuous);
		const before = await native.readAudioPackets(continuous), after = await native.readAudioPackets(files[3].audio);
		assert.deepEqual(after.map(p => p.data), before.map(p => p.data));
		const copied = await native.decodeMonoPcm(files[3].audio);
		assert.ok(Math.abs(copied.length - result.length) <= 2048);
		assert.deepEqual(copied.subarray(4000, -4000), result.subarray(4000, copied.length - 4000));
		const paused = await native.createPausedPcm(resolve(directory, 'paused-vorbis.webm'), continuous);
		await assert.rejects(vorbis(paused.bytes), /preserve.*pause/);
		// Fast changes alternate the encoder's short and long windows within the same Ogg page.
		const lowRate = 16000;
		const pulses = Int16Array.from({ length: 2 * lowRate }, (_, i) => i % 3840 < 960 ? 0 : Math.round(12000 * Math.sin(i / 4)));
		const shortWindows = await writeWav(new Uint8Array(pulses.buffer), { sampleRate: lowRate, channels: 1, encoding: 'pcm_s16le' });
		await vorbis(shortWindows);
		const pulseFile = files.at(-1)!.audio;
		await Transcriber.loadsAudio({ model, inputAudioFormat: { type: 'audio/pcm', rate: lowRate } })(pulseFile);
		assert.deepEqual(raw.at(-1), await native.decodeMonoPcm(pulseFile));
	});
	it('rejects an encoder that drops packets even when the remaining timestamps span the recording', async () => {
		const source = await writeWav(new Uint8Array(48000 * 2), { encoding: 'pcm_s16le', sampleRate: 48000, channels: 1 });
		await native.assertMissingEncoderPacketsRejected(source);
	});
	it('keeps continuous 44.1 kHz audio on coarse ASF and Matroska clocks and detects a real pause', async () => {
		const { model, files, raw } = captureTranscription();
		const samples = Int16Array.from({ length: 88200 }, (_, i) => 3000 + Math.round(2000 * Math.sin(i / 20)));
		const bytes = new Uint8Array(samples.buffer), rate = 44100;
		const wma = await native.createAudioFile(resolve(directory, 'coarse.wma'), bytes, { codec: 'wmav2', rate });
		const reference = await native.decodeMonoPcm(wma);
		await Transcriber.loadsAudio({ model, inputAudioFormat: { type: 'audio/pcm', rate } })(wma);
		assert.deepEqual(raw[0], reference);
		await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } })(wma);
		assert.deepEqual((await readWav(files[0].audio)).audio, reference);
		const matroska = await native.createAudioFile(resolve(directory, 'coarse.mka'), bytes, { codec: 'flac', rate });
		const flac = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'flac', codec: 'flac' } });
		await flac(matroska);
		assert.deepEqual(await native.readAudioPackets(files[1].audio).then(p => p.map(packet => packet.data)),
			await native.readAudioPackets(matroska).then(p => p.map(packet => packet.data)));
		assert.deepEqual(await native.decodeMonoPcm(files[1].audio), await native.decodeMonoPcm(matroska));
		const paused = await native.createPausedPcm(resolve(directory, 'coarse-pause.mka'), files[1].audio);
		await assert.rejects(flac(paused.bytes), /preserve.*pause/);
		await Transcriber.loadsAudio({ model, inputAudioFormat: { type: 'audio/pcm', rate } })(paused.bytes);
		const original = await native.decodeMonoPcm(matroska), withPause = raw[1];
		assert.ok(Math.abs((withPause.length - original.length) / 2 - rate) <= 45);
		assert.ok(withPause.subarray((paused.pauseAt + 50) * 2, (paused.pauseAt + rate - 50) * 2).every(byte => byte === 0));
		assert.deepEqual(withPause.subarray(-4000), original.subarray(-4000));
	});
	it('preserves the position and duration of an interior pause through raw decoding and file conversion', async () => {
		const { bytes, pauseAt } = await native.createPausedPcm(resolve(directory, 'paused.mka'));
		for (const rate of [48000, 24000]) {
			await using raw = await prepareAudio(bytes, { inputAudioFormat: { type: 'audio/pcm', rate } });
			const pcm = await consume(raw.audio);
			await using encoded = await prepareAudio(bytesStream(bytes, 517), { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', rate, maxDurationSeconds: 2 } });
			const copied = (await readWav(encoded.audio)).audio;
			assert.equal(copied.byteLength, pcm.byteLength);
			assert.ok(Buffer.from(copied).equals(pcm), 'The file and raw outputs must have identical samples');
			const samples = new Int16Array(pcm.buffer), start = pauseAt * rate / 48000;
			assert.equal(samples.length, 2 * rate);
			assert.equal(samples[start - 32], 1200); assert.equal(samples[start + 32], 0);
			assert.equal(samples[start + rate - 32], 0); assert.equal(samples[start + rate + 32], 1200);
		}
		await assert.rejects(prepareAudio(bytes, { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', maxDurationSeconds: 1.5 } }), /maxDurationSeconds/);
	});
	it('preserves exactly one clock tick of silence between PCM frames of known duration', async () => {
		const { model, files, raw } = captureTranscription(), rate = 48000;
		const samples = new Uint8Array(new Int16Array(rate).fill(1200).buffer);
		const aligned = await native.createAudioFile(resolve(directory, 'aligned.mka'), samples, { codec: 'pcm_s16le', rate, frameSamples: 960 });
		const { bytes, pauseAt } = await native.createPausedPcm(resolve(directory, 'one-tick.mka'), aligned, 1);
		const expected = new Uint8Array(samples.length + 96);
		expected.set(samples.subarray(0, pauseAt * 2)); expected.set(samples.subarray(pauseAt * 2), pauseAt * 2 + 96);
		await Transcriber.loadsAudio({ model, inputAudioFormat: { type: 'audio/pcm', rate } })(bytes);
		await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } })(bytes);
		assert.deepEqual(raw[0], expected);
		assert.deepEqual((await readWav(files[0].audio)).audio, expected);
	});
	it('preserves both channels across a pause when copying stereo PCM into WAV', async () => {
		const layout = { sampleRate: 48000, channels: 2, encoding: 'pcm_s16le' } as const;
		const silentSamples = layout.sampleRate * layout.channels;
		const input = Int16Array.from({ length: silentSamples }, (_, i) => (i % 2 ? -1 : 1) * (1 + i % 3000));
		const wav = await writeWav(new Uint8Array(input.buffer), layout);
		const { bytes, pauseAt } = await native.createPausedPcm(resolve(directory, 'paused-stereo.mka'), wav);
		await using copied = await prepareAudio(bytes, { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
		const { audio, format } = await readWav(copied.audio);
		assert.deepEqual(format, layout);
		const split = pauseAt * layout.channels;
		const expected = new Int16Array(input.length + silentSamples);
		expected.set(input.subarray(0, split));
		expected.set(input.subarray(split), split + silentSamples);
		assert.equal(audio.byteLength, expected.byteLength);
		assert.ok(Buffer.from(expected.buffer).equals(audio), 'Both channels must resume at their original samples after the pause');
	});
	it('retains a compressed pause in native conversion and rejects a copy that flattens it', async () => {
		const tone = new Uint8Array(new Int16Array(48000).fill(1200).buffer);
		const flac = await native.createAudioFile(resolve(directory, 'continuous.flac'), tone, { codec: 'flac' });
		const { bytes, pauseAt } = await native.createPausedPcm(resolve(directory, 'paused-flac.mka'), flac);
		await using flat = await prepareAudio(flac, { fileAudioTarget: { format: 'flac', codec: 'flac' } });
		assert.equal(flat.format.codec, 'flac');
		await using baseline = await prepareAudio(flac, { inputAudioFormat: { type: 'audio/pcm', rate: 48000 } });
		const original = await consume(baseline.audio);
		const upload = bytesStream(bytes);
		await assert.rejects(prepareAudio(upload, { fileAudioTarget: { format: 'flac', codec: 'flac' } }), /preserve.*pause/);
		assert.equal(upload.locked, false);
		await using converted = await prepareAudio(bytes, { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
		const samples = (await readWav(converted.audio)).audio;
		assert.equal(samples.byteLength, original.byteLength + 96000);
		assert.deepEqual(samples.subarray(0, pauseAt * 2), original.subarray(0, pauseAt * 2));
		assert.ok(samples.subarray(pauseAt * 2, pauseAt * 2 + 96000).every(byte => byte === 0));
		assert.deepEqual(samples.subarray(pauseAt * 2 + 96000), original.subarray(pauseAt * 2));
	});
	it('sends WebM with unchanged Opus packets and a timestamp-only pause through public file transcription', async () => {
		const tone = new Uint8Array(new Int16Array(48000).fill(1200).buffer);
		const opus = await native.createAudioFile(resolve(directory, 'continuous.ogg'), tone, { codec: 'libopus' });
		const { bytes } = await native.createPausedPcm(resolve(directory, 'paused-opus.webm'), opus);
		const source = await native.readAudioPackets(bytes);
		assert(source.some((packet, i) => i > 0 && packet.seconds - source[i - 1].seconds >= 1));
		const { model, files } = captureTranscription();
		const profile = { format: 'webm', codec: 'libopus' };
		const component = Transcriber.loadsAudio({ model, maxPreparedAudioBytes: 120000, fileAudioTarget: profile });
		await component(bytes);
		assert.equal(files[0].mediaType, 'audio/webm');
		assert(files[0].audio.length < 120000);
		assert.deepEqual(await native.readAudioPackets(files[0].audio), source);
		const exact = files[0].audio.length;
		await component.run({ audio: bytes, maxPreparedAudioBytes: 1, fileAudioTarget: { ...profile, maxBytes: exact } });
		assert.deepEqual(await native.readAudioPackets(files[1].audio), source);
		await assert.rejects(component.run({ audio: bytes, fileAudioTarget: { ...profile, maxBytes: exact - 1 } }), /file byte limit/);
		await assert.rejects(component.run({ audio: bytes, fileAudioTarget: { ...profile, maxDurationSeconds: 1.5 } }), /maxDurationSeconds/);
		assert.equal(files.length, 2);
	});
	it('copies continuous Opus across a rounded pre-skip and still rejects a real interior pause', async () => {
		const { model, files } = captureTranscription();
		const samples = new Uint8Array(Int16Array.from({ length: 48000 }, (_, i) => Math.round(12000 * Math.sin(i / 9))).buffer);
		const webm = await native.createAudioFile(resolve(directory, 'rounded.webm'), samples, { codec: 'libopus' });
		const original = await native.decodeMonoPcm(webm);
		const ogg = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'ogg', codec: 'libopus' } });
		await ogg(webm);
		assert.equal(files[0].mediaType, 'audio/ogg');
		const played = await native.decodeMonoPcm(files[0].audio);
		assert.deepEqual(played.subarray(0, original.length), original);
		assert.ok(played.length - original.length <= 48 * 2, 'The WebM packet clock has 1 ms precision');
		const unpaused = await native.createAudioFile(resolve(directory, 'before-gap.ogg'), samples, { codec: 'libopus' });
		const { bytes } = await native.createPausedPcm(resolve(directory, 'rounded-gap.webm'), unpaused);
		await assert.rejects(ogg(bytes), /preserve.*pause/);
		assert.equal(files.length, 1);
	});
	it('retains the recorded waveform when a requested file container exposes native encoder padding', async () => {
		const { model, files } = captureTranscription();
		const samples = new Uint8Array(Int16Array.from({ length: 12345 }, (_, i) => Math.round(12000 * Math.sin(i / 11) + 2000 * Math.cos(i / 17))).buffer);
		for (const [extension, codec, format, mediaType, offset] of [
			['m4a', 'aac', 'adts', 'audio/aac', 1024],
			['mp3', 'libmp3lame', 'wav', 'audio/wav', 1105],
		] as const) {
			// Twelve AAC frames end on an exact movie-clock tick. The only discarded samples are encoder priming.
			const source = await native.createAudioFile(resolve(directory, `primed.${extension}`), codec === 'aac' ? samples.subarray(0, 12288 * 2) : samples, { codec });
			const original = await native.decodeMonoPcm(source);
			await Transcriber.loadsAudio({ model, fileAudioTarget: { format, codec } })(source);
			assert.equal(files.at(-1)!.mediaType, mediaType);
			const playback = await native.decodeMonoPcm(files.at(-1)!.audio);
			assert.deepEqual(playback.subarray(offset * 2, offset * 2 + original.length), original);
			// The pinned AAC copy exposes one priming frame. This MP3 fixture also has 47 end samples.
			assert.equal((playback.length - original.length) / 2, offset + (codec === 'aac' ? 0 : 47));
			await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } })(source);
			assert.deepEqual((await readWav(files.at(-1)!.audio)).audio, original);
		}
	});
	it('applies movie playback edits before uploading AAC and preserves the requested file format', async () => {
		const { model, files } = captureTranscription();
		const rates = [350, 1150, 2200], rate = 48000;
		const tone = Int16Array.from({ length: 3 * rate }, (_, i) => Math.round(18000 * Math.sin(2 * Math.PI * rates[Math.floor(i / rate)] * i / rate)));
		const aac = await native.createAudioFile(resolve(directory, 'edited.m4a'), new Uint8Array(tone.buffer), { codec: 'aac' });
		function frequency(bytes: Uint8Array, second: number) {
			const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
			let upward = 0;
			for (let i = rate * (second + 0.25); i < rate * (second + 0.35); i++) {
				if (view.getInt16(i * 2, true) < 0 && view.getInt16((i + 1) * 2, true) >= 0) upward++;
			}
			return upward * 10;
		}
		for (const ranges of [[[1000, 3000]], [[1000, 2500]]] as [number, number][][]) {
			const edited = native.editMovie(aac, ranges), reference = await native.decodeMonoPcm(edited);
			for (const [format, mime] of [['adts', 'audio/aac'], ['mp4', 'audio/mp4']]) {
				await Transcriber.loadsAudio({ model, fileAudioTarget: { format, codec: 'aac' } })(edited);
				assert.equal(files.at(-1)!.mediaType, mime);
				const played = await native.decodeMonoPcm(files.at(-1)!.audio);
				assert.ok(Math.abs(played.length - reference.length) <= 2 * 1024 * 2, 'Only normal AAC frame padding fits this difference');
				for (const [second, hz] of [1150, 2200].entries()) {
					assert.ok(Math.abs(frequency(reference, second) - hz) <= 10);
					assert.ok(Math.abs(frequency(played, second) - hz) <= 10);
				}
			}
		}
		const alac = await native.createAudioFile(resolve(directory, 'variable-edit.m4a'), new Uint8Array(tone.buffer), { codec: 'alac' });
		for (const [file, codec] of [[alac, 'alac'], [aac, 'aac']] as const) {
			const edited = native.editMovie(file, [[0, 1000], [2000, 3000]]);
			for (const fileAudioTarget of [{ format: 'mp4', codec }, { format: 'wav', codec: 'pcm_s16le' }]) {
				await assert.rejects(Transcriber.loadsAudio({ model, fileAudioTarget })(edited), /playback edit.*flattened/);
			}
		}
		assert.equal(files.length, 4);
		const edited = native.editMovie(alac, [[100, 1300]]);
		await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', maxDurationSeconds: 1.2 } })(edited);
		assert.deepEqual((await readWav(files[4].audio)).audio, new Uint8Array(tone.buffer, rate / 10 * 2, rate * 1.2 * 2));
	});
	it('bounds generated PCM and buffered files', async () => {
		const { bytes } = await native.createPausedPcm(resolve(directory, 'byte-limit.mka'));
		const inputAudioFormat = { type: 'audio/pcm', rate: 48000 };
		await using exact = await prepareAudio(bytes, { inputAudioFormat, maxPreparedAudioBytes: 192000 });
		assert.equal((await consume(exact.audio)).length, 192000);
		const upload = bytesStream(bytes, 8192);
		await using limited = await prepareAudio(upload, { inputAudioFormat, maxPreparedAudioBytes: 191999 });
		await assert.rejects(consume(limited.audio), /maxPreparedAudioBytes/);
		assert.equal(upload.locked, false);
		const maxPreparedAudioBytes = 120000;
		await assert.rejects(prepareAudio(bytes, { maxPreparedAudioBytes, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } }), /byte limit/);
		await assert.rejects(prepareAudio(bytes, { maxPreparedAudioBytes, fileAudioTarget: { format: 'flac', codec: 'flac', maxBytes: 200000 } }), /maxPreparedAudioBytes/);
		await assert.rejects(prepareAudio(bytes, { maxPreparedAudioBytes: 0, inputAudioFormat }), ValidationError);
		const music = await writeWav(pcm, { sampleRate: 44100, channels: 1, encoding: 'pcm_s16le' });
		const opus = { format: 'webm', codec: 'libopus' };
		await assert.rejects(prepareAudio(music, { maxPreparedAudioBytes: 9800, fileAudioTarget: opus }), /maxPreparedAudioBytes/);
		await using resampled = await prepareAudio(music, { maxPreparedAudioBytes: 24000, fileAudioTarget: opus });
		assert.equal(resampled.format.rate, 48000);
	});
	it('recognizes native containers ahead of raw defaults and opens escaped file URL strings', async () => {
		const special = resolve(directory, 'space and #hash.wav'); await writeFile(special, wav);
		await using escaped = await prepareAudio(pathToFileURL(special).href, { inputAudioFormat: target });
		assert.equal((await consume(escaped.audio)).byteLength, 4800);
		await using local = await prepareAudio(`file:${relative(process.cwd(), special)}`, { inputAudioFormat: target });
		assert.equal((await consume(local.audio)).byteLength, 4800);
		for (const [suffix, codec] of [['aiff', 'pcm_s16be'], ['au', 'pcm_mulaw'], ['avi', 'pcm_s16le'], ['caf', 'pcm_s16le'], ['w64', 'pcm_s16le']]) {
			const bytes = await native.createAudioFile(resolve(directory, `header.${suffix}`), pcm, { codec });
			await using control = await prepareAudio(bytes, { inputAudioFormat: target });
			const expected = await consume(control.audio);
			for (const source of [bytes, new Blob([Uint8Array.from(bytes)]), bytesStream(bytes, 11)]) {
				await using decoded = await prepareAudio(source, { inputAudioFormat: target, sourceFormat: { sampleRate: 8000, channels: 2, encoding: 'pcm_s16le' } });
				assert.deepEqual(await consume(decoded.audio), expected);
			}
			await assert.rejects(Transcriber({ model: new MockTranscriptionModelV4(), inputAudioFormat: target })(bytes), /loadsAudio/);
		}
	});
	it('dispatches decoded transport streams, ASF and FLV when a raw default is configured', async () => {
		const { model, raw, files } = captureTranscription();
		const options = { model, inputAudioFormat: { type: 'audio/pcm', rate: 48000 },
			sourceFormat: { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' } } as const;
		const loaded = Transcriber.loadsAudio(options), ordinary = Transcriber(options);
		for (const [extension, codec] of [['ts', 'aac'], ['wma', 'wmav2'], ['flv', 'libmp3lame']]) {
			const bytes = await native.createAudioFile(resolve(directory, `upload.${extension}`), pcm, { codec });
			const reference = await native.decodeMonoPcm(bytes);
			assert.ok(reference.length && !Buffer.from(reference).equals(bytes));
			for (const source of [bytes, new Blob([Uint8Array.from(bytes)]), bytesStream(bytes, 137)]) {
				await loaded(source); assert.deepEqual(raw.at(-1), reference);
			}
			await assert.rejects(ordinary(bytes), /loadsAudio/);
			await assert.rejects(Transcriber({ model, sourceFormat: options.sourceFormat })(bytes), /accurately label/);
		}
		assert.equal(raw.length, 9); assert.equal(files.length, 0);
	});
	it('distinguishes untagged MP3 and ADTS recordings from single-frame PCM coincidences', async () => {
		const { model, raw, files } = captureTranscription();
		const sourceFormat = { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' } as const;
		const options = { model, sourceFormat, inputAudioFormat: { type: 'audio/pcm', rate: 48000 } };
		for (const [extension, codec, mime] of [['mp3', 'libmp3lame', 'audio/mpeg'], ['aac', 'aac', 'audio/aac']]) {
			let bytes = await native.createAudioFile(resolve(directory, `untagged.${extension}`), pcm, { codec });
			if (Buffer.from(bytes.subarray(0, 3)).toString() === 'ID3') {
				const size = bytes.subarray(6, 10).reduce((n, digit) => n * 128 + digit, 0);
				bytes = bytes.subarray(10 + size);
			}
			assert.equal(bytes[0], 255);
			const expected = await native.decodeMonoPcm(bytes);
			for (const source of [bytes, bytesStream(bytes, 23)]) {
				await Transcriber.loadsAudio(options)(source);
				assert.deepEqual(raw.at(-1), expected);
			}
			await assert.rejects(Transcriber(options)(bytes), /loadsAudio/);
			await Transcriber({ model, sourceFormat })(Buffer.from(bytes).toString('base64'));
			assert.equal(files.at(-1)?.mediaType, mime);
			assert.ok(Buffer.from(files.at(-1)!.audio).equals(bytes));
			const prefix = bytes.slice(0, 12);
			await Transcriber(options)(prefix); assert.ok(Buffer.from(raw.at(-1)!).equals(prefix));
		}
	});
	it('classifies self-describing uploads before reusable layouts across files, bytes and split-header streams', async () => {
		const partial = { sampleRate: 8000, channels: 2 };
		for (const size of [0, 0xffffffff]) {
			const recording = wav.slice(), header = new DataView(recording.buffer);
			header.setUint32(4, size, true); header.setUint32(40, size, true);
			await using prepared = await prepareAudio(bytesStream(recording, 11), { inputAudioFormat: { ...target, rate: 48000 }, sourceFormat: partial });
			assert.deepEqual(await consume(prepared.audio), pcm);
		}
		for (const source of [wav, wav.buffer, new Blob([wav]), new File([wav], 'no-extension'), bytesStream(wav, 1)]) {
			await using prepared = await prepareAudio(source, { inputAudioFormat: { ...target, rate: 48000 }, sourceFormat: partial });
			assert.deepEqual(await consume(prepared.audio), pcm);
			if (source instanceof ReadableStream) {
				assert.equal(source.locked, false);
				await assert.rejects(prepareAudio(source, { inputAudioFormat: target, sourceFormat: partial }), /already been handed off/);
			}
		}
		const flac = new Uint8Array(await native.createAudioFile(resolve(directory, 'classification.flac'), pcm, { codec: 'flac' }));
		await using baseline = await prepareAudio(flac, { inputAudioFormat: { ...target, rate: 48000 } });
		const expected = await consume(baseline.audio);
		assert.deepEqual(expected.subarray(0, pcm.length), pcm);
		for (const source of [flac, new File([flac], 'no-extension', { type: 'application/octet-stream' }), bytesStream(flac, 3)]) {
			await using prepared = await prepareAudio(source, { inputAudioFormat: { ...target, rate: 48000 }, sourceFormat: partial });
			assert.deepEqual(await consume(prepared.audio), expected);
		}
		for (const value of [-1025, -3585]) {
			const raw = new Uint8Array(new Int16Array(256).fill(value).buffer);
			for (const source of [raw, bytesStream(raw, 1)]) {
				await using prepared = await prepareAudio(source, { inputAudioFormat: target, sourceFormat: { ...partial, sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' } });
				assert.deepEqual(await consume(prepared.audio), raw);
			}
		}
		// Prefix classification must also retain the tail of an oversized producer chunk.
		const large = new Uint8Array(new Int16Array(32000).fill(-1025).buffer);
		const source = bytesStream(large, large.length);
		await using raw = await prepareAudio(source, { inputAudioFormat: target,
			sourceFormat: { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' } });
		assert.deepEqual(await consume(raw.audio), large);
		const incomplete = bytesStream(large);
		await assert.rejects(prepareAudio(incomplete, { inputAudioFormat: target, sourceFormat: partial }), /sourceFormat.encoding/);
		assert.equal(incomplete.locked, false);
		await assert.rejects(prepareAudio(incomplete, { inputAudioFormat: target }), /already been handed off/);
	});
	it('opens paths and URLs once with native probing, independent of sourceFormat', async () => {
		const sourceFormat = { sampleRate: 8000, channels: 2 };
		await using local = await prepareAudio(filename, { inputAudioFormat: { ...target, rate: 48000 }, sourceFormat });
		assert.deepEqual(await consume(local.audio), pcm);
		let requests = 0;
		const server = createServer((_request, response) => { requests++; response.writeHead(200, { 'content-length': wav.length }); response.end(wav); });
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		try {
			const url = new URL(`http://127.0.0.1:${(server.address() as { port: number }).port}/recording`);
			await using remote = await prepareAudio(url, { inputAudioFormat: { ...target, rate: 48000 }, sourceFormat });
			assert.deepEqual(await consume(remote.audio), pcm); assert.equal(requests, 1);
		} finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => { resolve(); })); }
		const rawFile = resolve(directory, 'raw'); await writeFile(rawFile, pcm);
		await using raw = await prepareAudio(rawFile, { inputAudioFormat: { ...target, rate: 48000 }, sourceFormat,
			mediaSettings: { format: 's16le', options: { sample_rate: 48000, ch_layout: 'mono' } } });
		assert.deepEqual(await consume(raw.audio), pcm);
	});
	it('uses encoded MIME for inconclusive uploads and explicit demuxers before reusable defaults', async () => {
		const encoded = new Uint8Array(await native.createAudioFile(resolve(directory, 'headerless.mp3'), pcm, { codec: 'libmp3lame' }));
		const id3Size = encoded[0] === 73 ? 10 + (encoded[6] * 2097152 + encoded[7] * 16384 + encoded[8] * 128 + encoded[9]) : 0;
		// Native MP3 probing skips leading padding. The bounded raw-layout classifier has no header at byte zero.
		const bytes = new Uint8Array(16 + encoded.length - id3Size);
		bytes.set(encoded.subarray(id3Size), 16);
		await assert.rejects(prepareAudio(bytes, { inputAudioFormat: target, sourceFormat: { sampleRate: 1, channels: 2 } }), /sourceFormat.encoding/);
		await using baseline = await prepareAudio(bytes, { inputAudioFormat: target });
		const expected = await consume(baseline.audio);
		await using uploaded = await prepareAudio(new File([bytes], 'upload', { type: 'audio/mpeg' }), {
			inputAudioFormat: target, sourceFormat: { sampleRate: 1, channels: 2 } });
		assert.deepEqual(await consume(uploaded.audio), expected);
		await using overridden = await prepareAudio(wav, { inputAudioFormat: { ...target, rate: 48000 },
			sourceFormat: { sampleRate: 1, channels: 2 }, mediaSettings: { format: 's16le', options: { sample_rate: 48000, ch_layout: 'mono' } } });
		assert.deepEqual(await consume(overridden.audio), wav, 'An explicit raw override deliberately includes the header bytes');
		await using numeric = await prepareAudio(new Int16Array(wav.buffer, wav.byteOffset, wav.length / 2), {
			inputAudioFormat: { ...target, rate: 48000 }, sourceFormat: { sampleRate: 48000, channels: 1 }, mediaSettings: { format: 'wav' } });
		assert.deepEqual(await consume(numeric.audio), wav, 'Numeric representations remain raw even beside a native override');
	});
	it('rejects a wrong prepared-file MIME and sends accurately labeled alternatives through the SDK', async () => {
		const labels: string[] = [];
		const model = new MockTranscriptionModelV4({ doGenerate: async ({ mediaType }) => {
			labels.push(mediaType);
			return { text: 'heard', segments: [], language: 'en', durationInSeconds: 0.1, warnings: [], response: { timestamp: new Date(0), modelId: 'test' } };
		} });
		assert.throws(() => Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'matroska', codec: 'flac' } }), ConfigError);
		assert.equal(labels.length, 0);
		for (const [format, codec, mime] of [
			['wav', 'pcm_s16le', 'audio/wav'], ['flac', 'flac', 'audio/flac'], ['webm', 'libopus', 'audio/webm'],
			['ogg', 'libopus', 'audio/ogg'], ['opus', 'libopus', 'audio/ogg'], ['mp3', 'libmp3lame', 'audio/mpeg'],
			['mp4', 'aac', 'audio/mp4'], ['ipod', 'aac', 'audio/mp4'], ['adts', 'aac', 'audio/aac'],
		]) {
			await Transcriber.loadsAudio({ model, fileAudioTarget: { format, codec } })(wav);
			assert.equal(labels.at(-1), mime);
		}
		await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'flac', codec: 'flac', alternatives: [{ format: 'wav', codec: 'pcm_s16le' }] } })(wav);
		assert.equal(labels.at(-1), 'audio/wav');
	});
	it('charges the native encoder sample width with or without an explicit sample format', async () => {
		const aac = await native.createAudioFile(resolve(directory, 'budget.m4a'), pcm, { codec: 'aac', rate: 16000 });
		const { model, files } = captureTranscription();
		const fileAudioTarget = { format: 'wav', codec: 'pcm_s16le', rate: 16000, channels: 1, maxBytes: 100000 };
		const transcribe = Transcriber.loadsAudio({ model, fileAudioTarget });
		await transcribe.run({ audio: aac, fileAudioTarget: { ...fileAudioTarget, sampleFormat: 's16' } });
		const baseline = files[0].audio, exact = (await readWav(baseline)).audio.length;
		await transcribe.run({ audio: aac, maxPreparedAudioBytes: exact });
		assert.deepEqual(files[1].audio, baseline);
		await assert.rejects(transcribe.run({ audio: aac, maxPreparedAudioBytes: exact - 1 }), /maxPreparedAudioBytes/);
		const float = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_f32le', maxBytes: 100000 } });
		await float.run({ audio: wav, maxPreparedAudioBytes: pcm.length * 2 });
		await assert.rejects(float.run({ audio: wav, maxPreparedAudioBytes: pcm.length * 2 - 1 }), /maxPreparedAudioBytes/);
		const surround = await writeWav(new Uint8Array(4800 * 6 * 2), { sampleRate: 48000, channels: 6, encoding: 'pcm_s16le' });
		const mp3 = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'mp3', codec: 'libmp3lame', maxBytes: 100000 } });
		const stereoBytes = 4800 * 2 * 2;
		await mp3.run({ audio: surround, maxPreparedAudioBytes: stereoBytes });
		await assert.rejects(mp3.run({ audio: surround, maxPreparedAudioBytes: stereoBytes - 1 }), /maxPreparedAudioBytes/);
		assert.equal(files.length, 4);
	});
	it('checks exact sample counts before raw provider dispatch and permits trimmed Opus at its actual size', async () => {
		const captured = captureTranscription();
		const flacSamples = pcm.subarray(0, 4608 * 2); // One complete native FLAC encoder block.
		const flac = await native.createAudioFile(resolve(directory, 'budget.flac'), flacSamples, { codec: 'flac' });
		const opus = await native.createAudioFile(resolve(directory, 'budget.ogg'), pcm, { codec: 'libopus' });
		for (const rate of [24000, 48000, 96000]) {
			const transcribe = Transcriber.loadsAudio({ model: captured.model, inputAudioFormat: { type: 'audio/pcm', rate } });
			for (const [audio, size] of [[wav, pcm.length], [flac, flacSamples.length]] as const) {
				const bytes = size * rate / 48000;
				const before: number = captured.streamCalls;
				await assert.rejects(transcribe.run({ audio, maxPreparedAudioBytes: bytes - 1 }), /maxPreparedAudioBytes/);
				if (rate >= 48000) assert.equal(captured.streamCalls, before);
				await transcribe.run({ audio, maxPreparedAudioBytes: bytes });
				assert.equal(captured.raw.at(-1)!.length, bytes);
			}
			const bytes = pcm.length * rate / 48000;
			await transcribe.run({ audio: opus, maxPreparedAudioBytes: bytes });
			assert.equal(captured.raw.at(-1)!.length, bytes);
		}
		const tiny = await writeWav(new Uint8Array(48 * 2), { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' });
		const downsample = Transcriber.loadsAudio({ model: captured.model, inputAudioFormat: { type: 'audio/pcm', rate: 24000 } });
		await downsample(tiny);
		const drained = captured.raw.at(-1)!.length;
		assert(drained > 0 && drained < 48);
		await downsample.run({ audio: tiny, maxPreparedAudioBytes: drained });
		assert.equal(captured.raw.at(-1)!.length, drained);
	});
	it('checks headerless PCM Blob parameters and explains native overrides for companded uploads', async () => {
		const captured = captureTranscription();
		const sourceFormat = { sampleRate: 8000, channels: 1, encoding: 'pcm_s16le' } as const;
		const transcribe = Transcriber.loadsAudio({ model: captured.model, sourceFormat, inputAudioFormat: { type: 'audio/pcm', rate: 16000 } });
		const second = new Uint8Array(16000);
		for (const type of ['audio/pcm;rate=16000', 'audio/pcm;channels=2']) {
			await assert.rejects(transcribe(new Blob([second], { type })), /MIME layout conflicts with sourceFormat/);
		}
		assert.equal(captured.streamCalls, 0);
		await transcribe(new Blob([second], { type: 'audio/pcm;rate=8000;channels=1' }));
		assert.equal(captured.raw.at(-1)!.length, 32000);
		const conflicting = new Blob([second], { type: 'audio/pcm;rate=16000' });
		const options = { sample_rate: 8000, ch_layout: 'mono' };
		await transcribe.run({ audio: conflicting, mediaSettings: { format: 's16le', options } });
		assert.equal(captured.raw.at(-1)!.length, 32000);
		for (const [type, format, zero] of [['audio/pcmu', 'mulaw', 255], ['audio/pcma', 'alaw', 213]] as const) {
			const audio = new Blob([new Uint8Array(8000).fill(zero)], { type });
			const before: number = captured.streamCalls;
			await assert.rejects(transcribe(audio), new RegExp(format + '.*sample_rate.*ch_layout'));
			assert.equal(captured.streamCalls - before, 0);
			await transcribe.run({ audio, mediaSettings: { format, options } });
			assert.equal(captured.raw.at(-1)!.length, 32000);
		}
		const networkOrder = new Blob([Uint8Array.of(0x20, 0, 0xe0, 0)], { type: 'audio/L16;rate=8000;channels=1' });
		const noLayout = Transcriber.loadsAudio({ model: captured.model, inputAudioFormat: { type: 'audio/pcm', rate: 8000 } });
		await assert.rejects(noLayout(new Blob([second], { type: 'audio/pcm' })), /sourceFormat.*encoding.*sampleRate.*channels/);
		for (const component of [noLayout, transcribe]) await assert.rejects(component(networkOrder), /s16be.*sample_rate.*ch_layout/);
		await noLayout.run({ audio: networkOrder, mediaSettings: { format: 's16be', options } });
		assert.deepEqual(captured.raw.at(-1), Uint8Array.of(0, 0x20, 0, 0xe0));
		for (const type of ['audio/pcmu', 'audio/L16', 'audio/pcm;rate=1']) {
			await transcribe(new Blob([wav], { type }));
			assert.equal(captured.raw.at(-1)!.length, pcm.length / 3);
		}
	});
	it('runs simultaneous native pipelines in owned workers while timers and Cascada continue', async () => {
		const large = await writeWav(new Uint8Array(48000 * 2 * 30), { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' });
		// eslint-disable-next-line @typescript-eslint/unbound-method -- Restored below and always invoked with its original receiver.
		const post = Worker.prototype.postMessage, portPost = MessagePort.prototype.postMessage, terminate = Worker.prototype.terminate;
		const owners = new Set<Worker>(), exited = new Set<Worker>();
		let allocations = 0;
		const NativeBytes = Uint8Array;
		globalThis.Uint8Array = new Proxy(NativeBytes, { construct(constructor, args: unknown[]) {
			if (typeof args[0] === 'number') assert(args[0] <= 256 * 1024, 'Native input staging is allocated in its worker');
			return Reflect.construct(constructor, args) as Uint8Array;
		} });
		Worker.prototype.postMessage = function (message: unknown, transfer) {
			if (message instanceof MessagePort) { owners.add(this); this.once('exit', () => exited.add(this)); }
			post.call(this, message, transfer);
		};
		MessagePort.prototype.postMessage = function (message: unknown, transfer) {
			if ((message as { type?: string } | undefined)?.type === 'allocate') allocations++;
			Reflect.apply(portPost, this, [message, transfer]);
		};
		Worker.prototype.terminate = function () { assert(!owners.has(this), 'Native workers must exit gracefully'); return terminate.call(this); };
		const script = create.Script({ script: 'return 2 + 3' });
		let ticks = 0, composed: Promise<unknown> | undefined;
		const timer = setInterval(() => { ticks++; composed ??= script(); }, 1);
		try {
			await Promise.all([
				(async () => {
					await using raw = await prepareAudio(large, { inputAudioFormat: { type: 'audio/pcm', rate: 16000 } });
					let size = 0; for await (const chunk of raw.audio) size += chunk.length;
					assert.equal(size, 16000 * 2 * 30);
				})(),
				(async () => {
					await using encoded = await prepareAudio(large, { fileAudioTarget: { format: 'wav', codec: 'pcm_s24le', rate: 32000 } });
					assert(encoded.audio.length > 32000 * 3 * 30);
				})(),
			]);
			assert.equal(owners.size, 2); assert(exited.size >= 1, 'At most one cleaned worker is retained');
			assert.equal(allocations, 2); assert(large.byteLength > 256 * 1024, 'Borrowed input remains attached');
			await using blob = await prepareAudio(new Blob([large]), { inputAudioFormat: target });
			assert.equal(blob.format.rate, target.rate);
			assert.equal(allocations, 2, 'The Blob already provided its own transferable buffer');
			assert(ticks > 1); assert.equal(await composed, 5);
		} finally { clearInterval(timer); Worker.prototype.postMessage = post; MessagePort.prototype.postMessage = portPost; Worker.prototype.terminate = terminate; globalThis.Uint8Array = NativeBytes; }
	});
	it('reuses a cleaned native worker with independent resources, settings and old handles', async () => {
		// eslint-disable-next-line @typescript-eslint/unbound-method -- Restored below and called with its original receiver.
		const post = Worker.prototype.postMessage;
		const owners: Worker[] = [];
		Worker.prototype.postMessage = function (message: unknown, transfer) { if (message instanceof MessagePort) owners.push(this); post.call(this, message, transfer); };
		try {
			const previous = new AbortController();
			const file = await prepareAudio(wav, { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' }, abortSignal: previous.signal });
			const raw = await prepareAudio(wav, { inputAudioFormat: { type: 'audio/pcm', rate: 16000 } });
			await file.close(); previous.abort(new Error('old invocation'));
			assert.equal((await consume(raw.audio)).length, 3200);
			const next = await prepareAudio(wav, { inputAudioFormat: { type: 'audio/pcm', rate: 48000 } });
			await raw.close(); await file.close();
			assert.deepEqual(await consume(next.audio), pcm); await next.close();
			assert.equal(owners.length, 3); assert.equal(new Set(owners).size, 1);
			assert.deepEqual((await readWav(file.audio)).audio, pcm, 'Earlier returned bytes stay usable');
		} finally { Worker.prototype.postMessage = post; }
	});
	it('honors an abort between the native file result and completed cleanup', async () => {
		const abort = new AbortController(), reason = new Error('cancel during cleanup');
		// eslint-disable-next-line @typescript-eslint/unbound-method -- Restored below and called with its original receiver.
		const post = MessagePort.prototype.postMessage;
		MessagePort.prototype.postMessage = function (message: unknown, transfer) {
			if ((message as { type?: string } | undefined)?.type === 'open') this.once('message', () => {
				queueMicrotask(() => { abort.abort(reason); });
			});
			Reflect.apply(post, this, [message, transfer]);
		};
		try {
			await assert.rejects(prepareAudio(filename, { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' }, abortSignal: abort.signal }), error => error === reason);
		} finally { MessagePort.prototype.postMessage = post; }
	});
	it('discards cancelled and failed workers without blocking or cancelling another invocation', async () => {
		// eslint-disable-next-line @typescript-eslint/unbound-method -- Restored below and called with its original receiver.
		const post = Worker.prototype.postMessage;
		const owners: Worker[] = [];
		Worker.prototype.postMessage = function (message: unknown, transfer) { if (message instanceof MessagePort) owners.push(this); post.call(this, message, transfer); };
		try {
			const active = await prepareAudio(wav, { inputAudioFormat: target });
			const abort = new AbortController(), reason = new Error('cancel only this invocation');
			let reading!: () => void;
			const started = new Promise<void>(resolve => { reading = resolve; });
			const source = new ReadableStream<Uint8Array>({ pull() { reading(); } }, { highWaterMark: 0 });
			const cancelled = prepareAudio(source, { inputAudioFormat: target, abortSignal: abort.signal });
			await started; abort.abort(reason);
			await assert.rejects(cancelled, error => error === reason);
			assert.notEqual(owners[0], owners[1]); assert.equal(source.locked, false);
			assert.equal((await consume(active.audio)).length, 4800); await active.close();
			await assert.rejects(prepareAudio(resolve(directory, 'missing-cache-input.wav'), { inputAudioFormat: target }));
			assert.equal(owners[2], owners[0], 'Successful owner was reusable after concurrent cancellation');
			const fresh = await prepareAudio(wav, { inputAudioFormat: target });
			assert.notEqual(owners[3], owners[2]); assert.notEqual(owners[3], owners[1]);
			assert.equal((await consume(fresh.audio)).length, 4800); await fresh.close();
		} finally { Worker.prototype.postMessage = post; }
	});
	it('expires the idle native worker gracefully after five seconds', async () => {
		// eslint-disable-next-line @typescript-eslint/unbound-method -- Restored below and called with its original receiver.
		const post = Worker.prototype.postMessage, terminate = Worker.prototype.terminate;
		let owner: Worker | undefined, exited: Promise<unknown[]> | undefined;
		Worker.prototype.postMessage = function (message: unknown, transfer) {
			// eslint-disable-next-line @typescript-eslint/no-this-alias -- Observe the worker identity outside the patched method.
			if (message instanceof MessagePort) { owner = this; exited = once(this, 'exit'); }
			post.call(this, message, transfer);
		};
		Worker.prototype.terminate = function () { assert.notEqual(this, owner, 'Idle native workers also close gracefully'); return terminate.call(this); };
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			await using prepared = await prepareAudio(wav, { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
			assert(prepared.audio.length > 0);
			assert(owner && exited);
			assert.deepEqual(await Promise.race([exited, new Promise((_, reject) => { timer = setTimeout(() => { reject(new Error('Idle native worker did not exit')); }, 8000); })]), [0]);
		} finally { clearTimeout(timer); Worker.prototype.postMessage = post; Worker.prototype.terminate = terminate; }
	});
	it('does not keep Node alive for the native idle cache', async () => {
		const entry = new URL('../src/audio/native.ts', import.meta.url).href;
		const code = `import { prepareAudio } from ${JSON.stringify(entry)};
		await using prepared = await prepareAudio(Buffer.from('${Buffer.from(wav).toString('base64')}', 'base64'), { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
		console.log('native-complete');`;
		const child = spawn(process.execPath, ['--import', 'tsx/esm', '--conditions=casai-source', '--input-type=module', '-e', code]);
		let completed = 0, errors = '';
		child.stdout.on('data', (data: Buffer) => { if (data.toString().includes('native-complete')) completed = performance.now(); });
		child.stderr.on('data', (data: Buffer) => { errors += data.toString(); });
		const timer = setTimeout(() => { child.kill(); }, 12000);
		try {
			assert.deepEqual(await once(child, 'close'), [0, null], errors);
			assert(completed > 0); assert(performance.now() - completed < 2000, 'Idle worker/timer must not retain the process');
		} finally { clearTimeout(timer); }
	});
	it('honors the host FFmpeg log level in a public upload worker', async () => {
		for (const level of ['AV_LOG_INFO', 'AV_LOG_QUIET']) {
			const code = `import assert from 'node:assert/strict';
			import { Log, ${level} } from 'node-av';
			import { Transcriber } from 'casai';
			import { MockTranscriptionModelV4 } from 'ai/test';
			Log.setLevel(${level});
			const model = new MockTranscriptionModelV4({ doGenerate: async () => ({
				text: 'ok', segments: [], warnings: [], response: { timestamp: new Date(), modelId: 'mock' }
			}) });
			const transcribe = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'mp4', codec: 'aac' } });
			assert.equal((await transcribe(Buffer.from('${Buffer.from(wav).toString('base64')}', 'base64'))).text, 'ok');
			assert.equal(Log.getLevel(), ${level});`;
			const { stderr } = await promisify(execFile)(process.execPath, ['--import', 'tsx/esm', '--conditions=casai-source', '--input-type=module', '-e', code], { timeout: 10000 });
			if (level === 'AV_LOG_INFO') assert.match(stderr, /Qavg:/, 'The native AAC encoder writes diagnostics at the host info level');
			else assert.doesNotMatch(stderr, /Qavg:/);
		}
	});
	it('reads shared finite and uploaded input without copying it on the calling thread', async () => {
		const shared = new Uint8Array(new SharedArrayBuffer(wav.length + 4)).subarray(1, -3); shared.set(wav);
		// eslint-disable-next-line @typescript-eslint/unbound-method -- Restored below; no copying is allowed in this scope.
		const set = Uint8Array.prototype.set, from = Uint8Array.from;
		const results: Uint8Array[][] = [];
		Uint8Array.prototype.set = () => { throw new Error('Shared native input must not be copied'); };
		Uint8Array.from = () => { throw new Error('Shared uploaded input must not be copied'); };
		try {
			for (const source of [shared, bytesStream(shared, shared.length)]) {
				await using prepared = await prepareAudio(source, { inputAudioFormat: target });
				const chunks: Uint8Array[] = [];
				for await (const chunk of prepared.audio) chunks.push(chunk);
				results.push(chunks);
			}
		} finally { Uint8Array.prototype.set = set; Uint8Array.from = from; }
		assert.deepEqual(await concatAudio(results[0]), await concatAudio(results[1]));
		assert.equal((await concatAudio(results[0])).length, 4800);
		assert.deepEqual(shared, wav);
	});
	it('aborts during bounded input copying before native media opening', async () => {
		const large = new Uint8Array(2 * 1024 * 1024), abort = new AbortController();
		const reason = new Error('cancel input staging');
		// eslint-disable-next-line @typescript-eslint/unbound-method -- Restored below and called with its original receiver.
		const set = Uint8Array.prototype.set, post = MessagePort.prototype.postMessage;
		let opens = 0, copied = 0;
		MessagePort.prototype.postMessage = function (message: unknown, transfer) {
			if ((message as { type?: string } | null)?.type === 'open') opens++;
			Reflect.apply(post, this, [message, transfer]);
		};
		Uint8Array.prototype.set = function (input, offset) { set.call(this, input, offset); copied++; abort.abort(reason); };
		try { await assert.rejects(prepareAudio(large, { inputAudioFormat: target, abortSignal: abort.signal }), error => error === reason); }
		finally { Uint8Array.prototype.set = set; MessagePort.prototype.postMessage = post; }
		assert.equal(opens, 0); assert.equal(copied, 1); assert.equal(large.byteLength, 2 * 1024 * 1024);
	});
	it('prepares paths, URLs, bounded bytes and probed streams through one owner', async () => {
		const padded = new Uint8Array(wav.length + 2); padded.set(wav, 1);
		for (const source of [filename, pathToFileURL(filename), padded.subarray(1, -1), wav.slice().buffer, bytesStream(wav)]) {
			await using prepared = await prepareAudio(source, { inputAudioFormat: target });
			assert.equal(prepared.track, 0); assert.deepEqual(prepared.format, target);
			const audio = await consume(prepared.audio); assert.equal(audio.length, 4800);
			assert.ok(audio.some(byte => byte !== 0)); await prepared.close(); await prepared.close();
		}
	});
	it('copies compatible samples, prefers an accepted alternative and converts otherwise', async () => {
		await using copy = await prepareAudio(wav, { fileAudioTarget: { format: 'flac', codec: 'flac', alternatives: [{ format: 'wav', codec: 'pcm_s16le' }] } });
		assert.deepEqual((await readWav(copy.audio)).audio, pcm);
		assert.equal(copy.format.rate, 48000);
		for (const limits of [{}, { maxDurationSeconds: 1 }]) {
			await using encoded = await prepareAudio(wav, { fileAudioTarget: { format: 'flac', codec: 'flac', ...limits } });
			await using decoded = await prepareAudio(encoded.audio, { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
			const roundTrip = (await readWav(decoded.audio)).audio;
			// node-av 7.1's native encoder pads the final fixed-size FLAC frame with silence.
			assert.deepEqual(roundTrip.subarray(0, pcm.length), pcm);
			assert.ok(roundTrip.subarray(pcm.length).every(byte => byte === 0));
		}
		await using stereo = await prepareAudio(wav, { fileAudioTarget: { format: 'wav', codec: 'pcm_s24le', rate: 32000, channels: 2 } });
		assert.deepEqual((await readWav(stereo.audio)).format, { sampleRate: 32000, channels: 2, encoding: 'pcm_s24le' });
		await using primary = await prepareAudio(wav, { fileAudioTarget: { format: 'adts', codec: 'aac', alternatives: [{ format: 'flac', codec: 'flac' }] } });
		assert('codec' in primary.format); assert.equal(primary.format.codec, 'aac');
	});
	it('prepares explicitly described floating-point samples and preserves selected tracks from video', async () => {
		const floats = Float32Array.from({ length: 2400 }, (_, i) => Math.sin(i / 12) / 3);
		await using raw = await prepareAudio(new Uint8Array(floats.buffer), { inputAudioFormat: target, sourceFormat: { sampleRate: 24000, channels: 1, encoding: 'pcm_f32le' } });
		assert.equal((await consume(raw.audio)).length, floats.length * 2);
		const container = resolve(directory, 'tracks.mkv');
		const otherPcm = (await float32ToPcm16(Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i / 7) / 4)));
		const { firstIndex, secondIndex } = await native.createVideoTracks(container, wav, (await writeWav(otherPcm, { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' })));
		await assert.rejects(prepareAudio(container, { inputAudioFormat: target, mediaSettings: { track: 0 } }), /not audio/);
		for (const [track, expected] of [[firstIndex, pcm], [secondIndex, otherPcm]] as const) {
			await using selected = await prepareAudio(container, { inputAudioFormat: { type: 'audio/pcm', rate: 48000 }, mediaSettings: { track } });
			assert.equal(selected.track, track); assert.deepEqual(await consume(selected.audio), expected);
		}
		await using best = await prepareAudio(container, { inputAudioFormat: { type: 'audio/pcm', rate: 48000 } });
		assert.equal(best.track, firstIndex); assert.deepEqual(await consume(best.audio), pcm);
	});
	it('decodes independent WebM/Opus and rejects media without usable audio or a required encoder', async () => {
		const opus = await native.createAudioFile(resolve(directory, 'audio.webm'), pcm, { codec: 'libopus' });
		await using prepared = await prepareAudio(opus, { inputAudioFormat: target });
		const decoded = await consume(prepared.audio);
		assert.ok(decoded.length >= 4800 && decoded.length < 6000);
		assert.ok(decoded.some(byte => byte !== 0));
		const video = resolve(directory, 'silent.mkv'); await native.createVideoTracks(video);
		await assert.rejects(prepareAudio(video, { inputAudioFormat: target }), ValidationError);
		await assert.rejects(prepareAudio(wav, { fileAudioTarget: { format: 'wav', codec: 'casai_missing_encoder' } }), /[Ee]ncoder/);
		await assert.rejects(prepareAudio(new Uint8Array([0, 1, 2, 3]), { inputAudioFormat: target }));
	});
	it('preserves native seeking and rejects the same seek-dependent file as a forward-only stream', async () => {
		// The CAF packet table is after its variable-size ALAC payload. Use complete codec blocks.
		const path = resolve(directory, 'seek.caf');
		const samples = Int16Array.from({ length: 60 * 4096 }, (_, i) => (i * 2377) % 62951 - 31800);
		const file = await native.createAudioFile(path, new Uint8Array(samples.buffer), { codec: 'alac' });
		for (const source of [path, file]) {
			await using prepared = await prepareAudio(source, { inputAudioFormat: target });
			assert.equal((await consume(prepared.audio)).length, samples.length);
		}
		await assert.rejects(async () => {
			await using prepared = await prepareAudio(bytesStream(file, 4096), { inputAudioFormat: target });
			await consume(prepared.audio);
		});
	});
	it('disposes native custom I/O after success, pre-adoption failure and adjacent abort', async () => {
		for (const mode of ['success', 'invalid-format', 'abort']) {
			const abort = new AbortController(), source = bytesStream(wav, 4096);
			await native.observeIO(async (disposals, prepare) => {
				const pipeline = prepare(source, { inputAudioFormat: target, abortSignal: abort.signal,
					mediaSettings: { format: mode === 'invalid-format' ? 'not_a_demuxer' : 'wav' } });
				if (mode === 'success') { await pipeline.next(); await pipeline.return(undefined); await pipeline.return(undefined); }
				else await assert.rejects(pipeline.next(), mode === 'abort' ? /abort before adoption/ : /format/);
				assert.ok(disposals() > 0, 'The native allocation must be disposed, not only the JavaScript reader.');
				assert.equal(source.locked, false);
			}, () => { if (mode === 'abort') abort.abort(new Error('abort before adoption')); });
		}
	});
	it('rejects changing raw frame layouts before incompatible samples reach the consumer', async () => {
		const samples = (await float32ToPcm16(Float32Array.from({ length: 24000 }, (_, i) => Math.sin(i / 20) / 3)));
		const first = await native.createAudioFile(resolve(directory, 'mono.flac'), samples, { codec: 'flac', rate: 24000 });
		const second = await native.createAudioFile(resolve(directory, 'stereo.flac'), new Uint8Array(24000 * 4), { codec: 'flac', rate: 24000, channels: 2 });
		const resources: Record<string, Uint8Array> = { '/mono.flac': first, '/stereo.flac': second };
		const server = createServer((request, response) => {
			const body = resources[request.url!];
			if (!body) { response.writeHead(404).end(); return; }
			response.writeHead(200, { 'content-length': body.length }); response.end(body);
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		try {
			await using single = await prepareAudio(first, { inputAudioFormat: target });
			const expected = await consume(single.audio);
			for (const changing of [false, true]) {
				resources['/index.m3u8'] = new TextEncoder().encode(`#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXTINF:1.056,\nmono.flac\n#EXT-X-DISCONTINUITY\n#EXTINF:1.056,\n${changing ? 'stereo' : 'mono'}.flac\n#EXT-X-ENDLIST\n`);
				await using prepared = await prepareAudio(`http://127.0.0.1:${(server.address() as { port: number }).port}/index.m3u8`, {
					inputAudioFormat: target, mediaSettings: { options: { allowed_extensions: 'ALL', extension_picky: 0 } },
				});
				const chunks: Uint8Array[] = [];
				const draining = (async () => { for await (const chunk of prepared.audio) chunks.push(chunk); })();
				if (changing) { await assert.rejects(draining, ValidationError); assert.deepEqual((await concatAudio(chunks)), expected); }
				else { await draining; assert.deepEqual((await concatAudio(chunks)), (await concatAudio([expected, expected]))); }
				await prepared.close();
			}
		} finally { await new Promise<void>((resolve, reject) => server.close(error => { if (error) reject(error); else resolve(); })); }
	});
	it('enforces track, target and finite provider limits with their documented errors', async () => {
		await assert.rejects(prepareAudio(resolve(directory, 'missing.wav'), { inputAudioFormat: target }), error => {
			assert(error instanceof Error && error.name === 'FFmpegError');
			assert('code' in error && typeof error.code === 'number' && error.code < 0);
			assert.match(error.message, /open input/);
			return true;
		});
		await assert.rejects(prepareAudio(wav, { inputAudioFormat: target, mediaSettings: { track: 1 } }), ValidationError);
		await assert.rejects(prepareAudio('missing.wav', { inputAudioFormat: { type: 'audio/pcm' } }), ValidationError);
		await assert.rejects(prepareAudio(wav, { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', maxBytes: 100 } }), ValidationError);
		await assert.rejects(prepareAudio(wav, { fileAudioTarget: { format: 'flac', codec: 'flac', maxDurationSeconds: 0.01 } }), ValidationError);
		await assert.rejects(prepareAudio(wav, { fileAudioTarget: { format: 'flac', codec: 'flac', maxDurationSeconds: 0.101 } }), ValidationError);
		// The resampler's final native frame can have no timestamp; packet durations still bound padding.
		await assert.rejects(prepareAudio(wav, { fileAudioTarget: { format: 'flac', codec: 'flac', rate: 22050, maxDurationSeconds: 0.101 } }), ValidationError);
		const abort = new AbortController(); abort.abort(new Error('cancelled before open'));
		await assert.rejects(prepareAudio(wav, { inputAudioFormat: target, abortSignal: abort.signal }), /cancelled before open/);
	});
	it('releases decoded frames when a duration limit interrupts conversion', async () => {
		await native.assertReleasedFramesOnDurationFailure(bytesStream(pcm, 4096), {
			sourceFormat: { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' },
			fileAudioTarget: { format: 'flac', codec: 'flac', maxDurationSeconds: 0.05 },
		});
	});
	it('accepts exact duration limits for remuxing and encoding, including a source without a known duration', async () => {
		const sourceFormat = { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' } as const;
		for (const [format, codec, samples] of [['wav', 'pcm_s16le', 48000], ['flac', 'flac', 46080]] as const) {
			// Ten whole FLAC frames need no padding. The raw stream has no inspected duration.
			const bytes = new Uint8Array(samples * 2), profile = { format, codec };
			const prepare = (maxDurationSeconds: number) => prepareAudio(bytesStream(bytes, 4096), {
				sourceFormat, fileAudioTarget: { ...profile, maxDurationSeconds },
			});
			await using file = await prepare(samples / sourceFormat.sampleRate);
			await using decoded = await prepareAudio(file.audio, { inputAudioFormat: { type: 'audio/pcm', rate: sourceFormat.sampleRate } });
			assert.deepEqual(await consume(decoded.audio), bytes);
			await assert.rejects(prepare((samples - 1) / sourceFormat.sampleRate), /maxDurationSeconds/);
		}
	});
	it('rejects an unrecognized prepared file before SDK transcription can label it as WAV', async () => {
		const mediaTypes: string[] = [];
		const model = new MockTranscriptionModelV4({ doGenerate: async ({ mediaType }) => {
			mediaTypes.push(mediaType);
			return { text: 'ok', language: 'en', durationInSeconds: 0.1, segments: [], warnings: [], response: { timestamp: new Date(), modelId: 'mock' } };
		} });
		const file = await native.createAudioFile(resolve(directory, 'unlabeled.aiff'), pcm, { codec: 'pcm_s16be' });
		assert.equal(Buffer.from(file.subarray(8, 12)).toString(), 'AIFF');
		await assert.rejects(Transcriber({ model })(file), /accurately label/);
		assert.deepEqual(mediaTypes, []);
		const profile = { format: 'wav', codec: 'pcm_s16le' };
		const transcribe = Transcriber.loadsAudio({ model, fileAudioTarget: profile });
		const unread = bytesStream(wav);
		for (const format of ['aiff', 'matroska', 'au']) {
			const unsupported = { format, codec: 'pcm_s16be' };
			for (const fileAudioTarget of [unsupported, { ...profile, alternatives: [unsupported] }]) {
				assert.throws(() => Transcriber.loadsAudio.asTool({ model, audio: file, inputSchema: z.object({}), fileAudioTarget }), ConfigError);
				await assert.rejects(transcribe.run({ audio: unread, fileAudioTarget }), ValidationError);
			}
		}
		assert.deepEqual(mediaTypes, []);
		await transcribe(unread); // Invalid overrides left this one-shot upload available.
		await transcribe(file);
		assert.deepEqual(mediaTypes, ['audio/wav', 'audio/wav']);
	});
	it('blocks nested resources from uploaded bytes and streams unless trusted options authorize them', async () => {
		const manifest = new TextEncoder().encode(`ffconcat version 1.0\nfile ${relative(process.cwd(), filename).replaceAll('\\', '/')}\n`);
		for (const streamed of [false, true]) for (const whitelist of [undefined, null, '']) {
			const options = { protocol_whitelist: whitelist };
			await assert.rejects(prepareAudio(streamed ? bytesStream(manifest) : manifest, { inputAudioFormat: target, mediaSettings: { options } }));
			assert.equal(options.protocol_whitelist, whitelist);
		}
		await using allowed = await prepareAudio(manifest, { inputAudioFormat: target, mediaSettings: { options: { protocol_whitelist: 'file' } } });
		assert.equal((await consume(allowed.audio)).length, 4800);
	});
	it('applies native playlist opening and child access rules with a reusable PCM layout', async () => {
		const path = resolve(directory, 'playlist-segment.ts');
		const encoded = await native.createAudioFile(path, pcm, { codec: 'aac' });
		const reference = await native.decodeMonoPcm(encoded);
		const segment = relative(process.cwd(), path).replaceAll('\\', '/');
		const { model, raw } = captureTranscription();
		const inputAudioFormat = { type: 'audio/pcm', rate: 48000 };
		const settings = { model, inputAudioFormat, sourceFormat: { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' } } as const;
		for (const [format, text] of [['concat', `ffconcat version 1.0\nfile ${segment}\n`],
			['hls', '#EXTM3U\r\n#EXT-X-TARGETDURATION:1\r\n#EXTINF:0.2,\r\nplaylist-segment.ts\r\n#EXT-X-ENDLIST\r\n']] as const) {
			const manifest = new TextEncoder().encode(text);
			await assert.rejects(Transcriber(settings)(manifest), /loadsAudio/);
			const loaded = Transcriber.loadsAudio(settings);
			for (const audio of [manifest, bytesStream(manifest, 3)]) {
				await assert.rejects(loaded(audio));
			}
			// Give HLS its original path so FFmpeg can resolve the segment relative to the playlist.
			if (format === 'hls') {
				const playlist = resolve(directory, 'recording.m3u8');
				await writeFile(playlist, manifest); await loaded(playlist);
			} else await loaded.run({ audio: manifest, mediaSettings: { options: { protocol_whitelist: 'file' } } });
			assert.deepEqual(raw.at(-1), reference);
		}
		assert.equal(raw.length, 2);
	});
	it('closes abandoned and cancelled handles, and aborts a pending custom I/O read', async () => {
		const abandoned = await prepareAudio(wav, { inputAudioFormat: target });
		await abandoned.close(); await assert.rejects(consume(abandoned.audio), /closed/);
		const large = (await writeWav(new Uint8Array(48000 * 2 * 30), { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' }));
		let position = 0, sourceCancelled: unknown;
		const source = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (position === large.length) controller.close();
				else { controller.enqueue(large.subarray(position, position + 65536)); position = Math.min(large.length, position + 65536); }
			},
			cancel(reason) { sourceCancelled = reason; },
		}, { highWaterMark: 0 });
		const cancelled = await prepareAudio(source, { inputAudioFormat: target, mediaSettings: { format: 'wav' } });
		const reader = cancelled.audio.getReader(); assert.equal((await reader.read()).done, false);
		assert.ok(position < large.length);
		try {
			const reason = new Error('transcription stopped');
			await reader.cancel(reason);
			assert.equal(sourceCancelled, reason); assert.equal(source.locked, false);
		} finally { await cancelled.close(); }
		let cancelReason: unknown;
		const signal = new AbortController();
		let reading!: () => void;
		const readStarted = new Promise<void>(resolve => { reading = resolve; });
		const blocked = prepareAudio(new ReadableStream<Uint8Array>({ pull() { reading(); }, cancel(reason) { cancelReason = reason; } }, { highWaterMark: 0 }), { inputAudioFormat: target, abortSignal: signal.signal });
		await readStarted; signal.abort(new Error('cancel pending read'));
		await assert.rejects(blocked, /cancel pending read/); assert.match(String(cancelReason), /cancel pending read/);
	});
	it('cancels while decoding is waiting for another uploaded chunk', async () => {
		const large = (await writeWav(new Uint8Array(48000 * 2 * 30), { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' }));
		let position = 0, block = false, cancelled = false;
		let notifyWaiting!: () => void;
		const waiting = new Promise<void>(resolve => { notifyWaiting = resolve; });
		const input = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (block) { notifyWaiting(); return; }
				controller.enqueue(large.subarray(position, position + 65536)); position += 65536;
			},
			cancel() { cancelled = true; },
		}, { highWaterMark: 0 });
		await using prepared = await prepareAudio(input, { inputAudioFormat: target, mediaSettings: { format: 'wav' } });
		block = true;
		const reader = prepared.audio.getReader();
		const draining = (async () => { while (!(await reader.read()).done) { /* Reach the pending native read. */ } })();
		await waiting; await reader.cancel(); await draining;
		assert.equal(cancelled, true); assert.equal(input.locked, false);
	});
	it('preserves source rejection identity across worker transport and releases its reader', async () => {
		for (const reason of [new Error('uploaded stream failed'), undefined]) {
			const source = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(reason); } }, { highWaterMark: 0 });
			await assert.rejects(prepareAudio(source, { inputAudioFormat: target }), error => error === reason);
			assert.equal(source.locked, false);
		}
		const large = await writeWav(new Uint8Array(2 * 1024 * 1024), { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' });
		const foreign = runInNewContext('Uint8Array.from(bytes)', { bytes: large }) as Uint8Array;
		let offset = 0;
		const reason = new Error('late upload failure');
		const source = new ReadableStream<Uint8Array>({ pull(controller) {
			if (offset >= large.length / 2) { controller.error(reason); return; }
			controller.enqueue(foreign.subarray(offset, offset + 65536)); offset += 65536;
		} }, { highWaterMark: 0 });
		await using live = await prepareAudio(source, { inputAudioFormat: target, mediaSettings: { format: 'wav' } });
		await assert.rejects(consume(live.audio), error => error === reason);
		assert.equal(source.locked, false);
	});
	it('interrupts a pending native HTTP read when the prepared stream is cancelled', async () => {
		const prefix = Buffer.alloc(256 * 1024);
		const server = createServer((_request, response) => { response.write(prefix); });
		let timedOut = false;
		// Let a broken implementation unwind too, while distinguishing a native interrupt from peer EOF.
		server.setTimeout(6000, socket => { timedOut = true; socket.destroy(); });
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		try {
			const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/samples`;
			await using prepared = await prepareAudio(url, { inputAudioFormat: target,
				mediaSettings: { format: 's16le', options: { sample_rate: 24000, ch_layout: 'mono', probesize: 32, analyzeduration: 1 } } });
			const reader = prepared.audio.getReader();
			let received = 0;
			while (received < prefix.length) {
				const { value } = await reader.read();
				assert.ok(value); received += value.byteLength;
			}
			const pending = reader.read();
			// Streams may post this pull after the preceding enqueue resolves.
			await new Promise<void>(resolve => { setImmediate(resolve); });
			await reader.cancel();
			assert.equal((await pending).done, true);
			assert.equal(timedOut, false);
		} finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => { resolve(); })); }
	});
	it('detects WAV without filename or MIME and infers the encoding of headerless sample arrays', async () => {
		const samples = new Float32Array(2400).fill(0.25);
		const sourceFormat = { channels: 1, sampleRate: 24000 };
		const wav = await writeWav(new Uint8Array(samples.buffer), { ...sourceFormat, encoding: 'pcm_f32le' });
		const model = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
			const parts = []; for await (const chunk of audio) { assert(chunk instanceof Uint8Array); parts.push(chunk); }
			const data = Buffer.concat(parts);
			assert.equal(data.length, 4800);
			assert(Math.abs(data.readInt16LE(0) - 8192) <= 1);
			assert(Math.abs(data.readInt16LE(data.length - 2) - 8192) <= 1);
			return { stream: convertArrayToReadableStream([{ type: 'finish', text: 'heard', segments: [] }]) };
		} });
		const transcribe = Transcriber.loadsAudio({ model, inputAudioFormat: { type: 'audio/pcm', rate: 24000 } });
		assert.equal((await transcribe(new File([wav], 'upload'))).text, 'heard');
		assert.equal((await transcribe.run({ audio: samples, sourceFormat })).text, 'heard');
	});
	it('rejects reused uploaded streams before another native or SDK handoff', async () => {
		let calls = 0;
		const model = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
			calls++;
			let size = 0; for await (const chunk of audio) { assert(chunk instanceof Uint8Array); size += chunk.length; }
			assert(size > 0);
			return { stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, { type: 'finish', text: 'recorded', segments: [], language: 'en', durationInSeconds: 0.1 }]) };
		} });
		const reused = (error: unknown) => error instanceof ValidationError && error.message.includes('already been handed off');
		for (const raw of [false, true]) {
			const mediaSettings = raw ? { format: 's16le', options: { sample_rate: 48000, ch_layout: 'mono' } } : undefined;
			const transcribe = Transcriber.loadsAudio({ model, inputAudioFormat: target, mediaSettings });
			const source = bytesStream(raw ? pcm : wav);
			await transcribe(source);
			assert.equal(source.locked, false);
			await assert.rejects(transcribe(source), reused);
			await assert.rejects(prepareAudio(source, { inputAudioFormat: target, mediaSettings }), reused);
			const standalone = bytesStream(raw ? pcm : wav);
			await using prepared = await prepareAudio(standalone, { inputAudioFormat: target, mediaSettings });
			await consume(prepared.audio);
			await assert.rejects(prepareAudio(standalone, { inputAudioFormat: target, mediaSettings }), reused);
			await assert.rejects(Transcriber({ model, inputAudioFormat: target })(standalone), reused);
		}
		assert.equal(calls, 2);
		const source = bytesStream(wav), abort = new AbortController(); abort.abort();
		await assert.rejects(prepareAudio(source, { inputAudioFormat: target, abortSignal: abort.signal }));
		await using prepared = await prepareAudio(source, { inputAudioFormat: target });
		await consume(prepared.audio);
	});
	it('rejects invalid settings before claiming an upload and lets explicit native formats override raw defaults', async () => {
		let reads = 0;
		const input = new ReadableStream<Uint8Array>({ pull(controller) { reads++; controller.enqueue(pcm); controller.close(); } }, { highWaterMark: 0 });
		const raw = { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' } as const;
		await assert.rejects(prepareAudio(input, { sourceFormat: raw, mediaSettings: { track: -1 }, inputAudioFormat: target }), ValidationError);
		await assert.rejects(Transcriber.loadsAudio({ model: captureTranscription().model, inputAudioFormat: target }).run({
			audio: input, sourceFormat: { ...raw, channels: 0 },
		}), ValidationError);
		assert.equal(reads, 0); assert.equal(input.locked, false);
		await using prepared = await prepareAudio(input, { sourceFormat: { sampleRate: 1, channels: 2 }, inputAudioFormat: target,
			mediaSettings: { track: 0, format: 's16le', options: { sample_rate: raw.sampleRate, ch_layout: 'mono' } } });
		assert.equal((await consume(prepared.audio)).length, pcm.length / 2);
		assert.equal(reads, 1);
	});
	it('can abort a native upload which has only produced empty chunks', async () => {
		const abort = new AbortController(), reason = new Error('stop empty upload');
		let reads = 0, cancellation: unknown;
		const input = new ReadableStream<Uint8Array>({ pull(controller) {
			if (++reads === 1) setImmediate(() => { abort.abort(reason); });
			assert(reads < 1000, 'The upload must yield to cancellation');
			controller.enqueue(new Uint8Array(0));
		}, cancel(value) { cancellation = value; } }, { highWaterMark: 0 });
		await assert.rejects(prepareAudio(input, { inputAudioFormat: target, abortSignal: abort.signal }), error => error === reason);
		assert.equal(cancellation, reason); assert.equal(input.locked, false);
	});
	it('keeps prepared streaming input alive after the call and protects configured tool resources', async () => {
		let captured: Uint8Array | undefined;
		const model = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
			await new Promise(resolve => setTimeout(resolve, 10));
			const chunks: Uint8Array[] = []; for await (const chunk of audio) { assert.ok(chunk instanceof Uint8Array); chunks.push(chunk); }
			captured = (await concatAudio(chunks));
			return { stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, { type: 'finish', text: 'recorded', segments: [], language: 'en', durationInSeconds: 0.1 }]) };
		} });
		const fragment = Config.loadsAudio({ audio: wav, inputAudioFormat: target });
		const live = Transcriber.asStream({ model }, fragment);
		assert.equal(await (await live()).text, 'recorded'); assert.ok(captured); assert.equal(captured.length, 4800);
		const tool = Transcriber.loadsAudio.asTool({ model, audio: wav, inputAudioFormat: target, inputSchema: z.object({ audio: z.string() }) });
		const result = await tool.execute({ audio: 'untrusted-other-file' }, { toolCallId: 'test', messages: [], context: undefined });
		assert.equal(result.text, 'recorded'); assert.ok(captured); assert.equal(captured.length, 4800);
		assert.throws(() => Reflect.apply(Transcriber.loadsAudio.asTool as unknown as (...args: unknown[]) => unknown, undefined, [{ model, inputAudioFormat: target }]), ConfigError);
	});
	it('distinguishes trusted uploaded tool sources from model-supplied application data', async () => {
		let captured = 0;
		const capture = async (audio: ReadableStream<Uint8Array | string>) => {
			captured = 0;
			for await (const chunk of audio) { assert(chunk instanceof Uint8Array); captured += chunk.length; }
		};
		const transcriptionModel = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
			await capture(audio);
			return { stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, { type: 'finish', text: 'recorded', segments: [], language: 'en', durationInSeconds: 0.1 }]) };
		} });
		const translationModel = new Experimental_MockSpeechTranslationModelV4({ doStream: async ({ audio }) => {
			await capture(audio);
			return { stream: convertArrayToReadableStream([{ type: 'audio', audio: 'AQI=' }, { type: 'finish', sourceText: 'recorded', outputText: 'translated', durationInSeconds: 0.1 }]) };
		} });
		const shared = { audio: wav, inputAudioFormat: target, inputSchema: z.object({ audio: z.string().optional() }) };
		const transcribe = Transcriber.loadsAudio.asTool({ model: transcriptionModel, ...shared });
		const translate = Translator.loadsAudio.asTool({ model: translationModel, targetLanguage: 'fr', ...shared });
		const replacement = await writeWav(new Uint8Array(pcm.length * 2), { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' });
		const replacementFile = resolve(directory, 'replacement.wav'); await writeFile(replacementFile, replacement);
		const foreign = runInNewContext('Uint8Array.from(bytes).buffer', { bytes: replacement }) as ArrayBuffer;
		type Replacement = Uint8Array | ArrayBuffer | string | URL | ReadableStream<Uint8Array>;
		for (const invoke of [
			(source: Replacement) => transcribe(source), (source: Replacement) => translate(source),
			(source: Replacement) => transcribe.run({ audio: source }), (source: Replacement) => translate.run({ audio: source }),
		]) for (const source of [replacement, foreign, replacementFile, pathToFileURL(replacementFile), bytesStream(replacement, 1024)]) {
			await invoke(source); assert.equal(captured, 9600);
		}
		await transcribe(bytesStream(replacement, 1024), { audio: 'context-is-not-the-source' }); assert.equal(captured, 9600);
		await translate(bytesStream(replacement, 1024), {}); assert.equal(captured, 9600);
		await Reflect.apply(transcribe, undefined, [bytesStream(replacement, 1024), { __hasKeywordArgs: true, audio: 'context-is-not-the-source' }]);
		assert.equal(captured, 9600);
		const options = { toolCallId: 'call', messages: [], context: undefined };
		await transcribe.execute({ audio: replacementFile }, options); assert.equal(captured, 4800);
		await translate.execute({ audio: replacementFile }, options); assert.equal(captured, 4800);
	});
	it('keeps native HTTP credentials separate from SDK model headers and denies uploaded network children', async () => {
		const requests: string[] = [];
		const server = createServer((request, response) => {
			requests.push(request.headers.authorization ?? '');
			if (request.headers.authorization !== 'Bearer source-secret') { response.writeHead(401).end(); return; }
			const start = Number(request.headers.range?.match(/bytes=(\d+)-/)?.[1] ?? 0);
			response.writeHead(start ? 206 : 200, { 'content-type': 'audio/wav', 'content-length': wav.length - start, 'accept-ranges': 'bytes', ...(start ? { 'content-range': `bytes ${start}-${wav.length - 1}/${wav.length}` } : {}) }); response.end(wav.subarray(start));
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		try {
			const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/recording.wav`;
			const mediaSettings = { options: { headers: 'Authorization: Bearer source-secret\r\n' } };
			await using prepared = await prepareAudio(url, { inputAudioFormat: target, mediaSettings });
			assert.equal((await consume(prepared.audio)).length, 4800); assert.ok(requests.length);
			const before = requests.length;
			const playlist = new TextEncoder().encode(`ffconcat version 1.0\nfile ${url}\n`);
			await assert.rejects(prepareAudio(playlist, { inputAudioFormat: target, mediaSettings: { options: { safe: 0, ...mediaSettings.options } } }));
			assert.equal(requests.length, before);
			let modelHeaders: unknown;
			const model = new MockTranscriptionModelV4({ doGenerate: async settings => {
				modelHeaders = settings.headers;
				return { text: 'ok', segments: [], language: 'en', durationInSeconds: 0.1, warnings: [], response: { timestamp: new Date(), modelId: 'test' } };
			} });
			const transcribe = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' }, mediaSettings, headers: { authorization: 'Bearer model-secret' } });
			assert.equal((await transcribe(url)).text, 'ok'); assert.equal((modelHeaders as Record<string, string>).authorization, 'Bearer model-secret');
			assert.ok(!JSON.stringify(modelHeaders).includes('source-secret'));
			assert.ok(requests.every(header => header === 'Bearer source-secret'));
		} finally { await new Promise<void>((resolve, reject) => server.close(error => { if (error) reject(error); else resolve(); })); }
	});
	it('hands audio to the provider before uploaded input ends and releases it on native dispatch failure', async () => {
		const large = (await writeWav(new Uint8Array(48000 * 2 * 30), { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' }));
		for (const streaming of [false, true]) {
			let position = 0, cancelled = false;
			const input = new ReadableStream<Uint8Array>({
				pull(controller) {
					if (position === large.length) controller.close();
					else { controller.enqueue(large.subarray(position, position + 65536)); position = Math.min(large.length, position + 65536); }
				},
				cancel() { cancelled = true; },
			}, { highWaterMark: 0 });
			const model = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
				assert.ok(position < large.length, 'The provider receives audio before the whole upload is consumed.');
				const reader = audio.getReader();
				try { assert.equal((await reader.read()).done, false); } finally { reader.releaseLock(); }
				throw new Error('provider dispatch failed');
			} });
			const settings = { model, inputAudioFormat: target, mediaSettings: { format: 'wav' } };
			if (streaming) await assert.rejects(async () => (await Transcriber.loadsAudio.asStream(settings)(input)).text, /provider dispatch failed/);
			else await assert.rejects(Transcriber.loadsAudio(settings)(input), /provider dispatch failed/);
			assert.equal(cancelled, true);
			// Native result promises can reject before their asynchronous cancellation finishes.
			for (let attempt = 0; input.locked && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
			assert.equal(input.locked, false);
		}
	});
	it('retains native HTTP seeking and authenticated HLS child requests', async () => {
		const samples = Int16Array.from({ length: 60 * 4096 }, (_, i) => (i * 2377) % 62951 - 31800);
		const caf = await native.createAudioFile(resolve(directory, 'recording.caf'), new Uint8Array(samples.buffer), { codec: 'alac' });
		const segment = await native.createAudioFile(resolve(directory, 'segment.ts'), pcm, { codec: 'aac' });
		const resources: Record<string, Uint8Array> = {
			'/recording.caf': caf, '/segment.ts': segment,
			'/playlist.m3u8': new TextEncoder().encode('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:0.2,\nsegment.ts\n#EXT-X-ENDLIST\n'),
		};
		const requests: { url: string; start: number; authorization?: string }[] = [];
		const server = createServer((request, response) => {
			const start = Number(request.headers.range?.match(/bytes=(\d+)-/)?.[1] ?? 0);
			requests.push({ url: request.url!, start, authorization: request.headers.authorization });
			if (request.headers.authorization !== 'Bearer playlist-secret') { response.writeHead(401).end(); return; }
			if (request.url === '/redirect') { response.writeHead(302, { location: '/playlist.m3u8' }).end(); return; }
			const bytes = resources[request.url!];
			if (!bytes) { response.writeHead(404).end(); return; }
			response.writeHead(request.headers.range ? 206 : 200, { 'content-length': bytes.length - start, 'accept-ranges': 'bytes',
				...(request.url === '/playlist.m3u8' ? { 'content-type': 'application/vnd.apple.mpegurl' } : {}),
				...(request.headers.range ? { 'content-range': `bytes ${start}-${bytes.length - 1}/${bytes.length}` } : {}) });
			response.end(bytes.subarray(start));
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		try {
			const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
			const mediaSettings = { options: { headers: 'Authorization: Bearer playlist-secret\r\n' } };
			await using seekable = await prepareAudio(base + '/recording.caf', { inputAudioFormat: target, mediaSettings });
			assert.equal((await consume(seekable.audio)).length, samples.length);
			assert.ok(requests.some(request => request.url === '/recording.caf' && request.start > 0), 'Native seeking issues an HTTP range request.');
			await using playlist = await prepareAudio(base + '/redirect', { inputAudioFormat: target, mediaSettings });
			assert.ok((await consume(playlist.audio)).length > 0);
			assert.ok(requests.some(request => request.url === '/segment.ts'));
			assert.ok(requests.some(request => request.url === '/playlist.m3u8'));
			assert.ok(requests.every(request => request.authorization === 'Bearer playlist-secret'));
		} finally { await new Promise<void>((resolve, reject) => server.close(error => { if (error) reject(error); else resolve(); })); }
	});
});
