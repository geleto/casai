import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { convertArrayToReadableStream, MockTranscriptionModelV4, Experimental_MockSpeechTranslationModelV4 } from 'ai/test';
import { Config, ConfigError, Transcriber, Translator, ValidationError, z } from '../src/index.js';
import { writeWav, readWav, type PcmFormat } from '../src/audio/pcm.js';
import { concatAudio } from '../src/audio.js';
import { createPcmStreamConverter } from '../src/audio/pcm-stream.js';
import { sdkPcm } from './pcm-reference.js';

const target = { type: 'audio/pcm', rate: 24000 };
const stereo = { channels: 2, sampleRate: 48000, encoding: 'pcm_f32le' } as const;
const transcript = { text: 'heard', segments: [], language: 'en', durationInSeconds: 0.01 };
function capture() {
	const raw: Uint8Array[] = [], files: Uint8Array[] = [];
	const model = new MockTranscriptionModelV4({
		doStream: async request => {
			assert.deepEqual({ ...request.inputAudioFormat }, target);
			assert(!('sourceFormat' in request));
			assert(!('maxPreparedAudioBytes' in request));
			const parts = []; for await (const part of request.audio) parts.push(part);
			raw.push(await concatAudio(parts));
			return { stream: convertArrayToReadableStream([{ type: 'finish', ...transcript }]) };
		},
		doGenerate: async ({ audio, mediaType }) => {
			assert.equal(mediaType, 'audio/wav');
			files.push(typeof audio === 'string' ? Buffer.from(audio, 'base64') : audio);
			return { ...transcript, warnings: [], response: { timestamp: new Date(0), modelId: 'test' } };
		},
	});
	return { model, raw, files };
}

describe('Supplied audio through the component', () => {
	it('uses a WAV header before complete, partial, inherited and call-time raw defaults', async () => {
		const { model, raw, files } = capture();
		const samples = new Uint8Array(Int16Array.of(-1025, -3585, 1200, -1200).buffer);
		const layout = { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' } as const;
		const wav = await writeWav(samples, layout);
		for (const sourceFormat of [layout, { sampleRate: 8000, channels: 2 }]) {
			const component = Transcriber({ model, inputAudioFormat: target }, Config({ sourceFormat }));
			for (const audio of [wav, wav.buffer, new File([wav], 'input'), new Blob([wav], { type: 'audio/wav' })]) {
				await component(audio);
				assert.deepEqual(raw.at(-1), samples);
			}
			await Transcriber({ model }).run({ audio: wav, sourceFormat });
			assert.deepEqual(files.at(-1), wav);
		}
		const reused = Transcriber({ model, inputAudioFormat: target, sourceFormat: layout });
		await reused(wav); await reused(samples); await reused(wav);
		for (const audio of raw.slice(-3)) assert.deepEqual(audio, samples);
		const tool = Transcriber.withFunction.asTool({ model, inputAudioFormat: target, sourceFormat: { sampleRate: 1, channels: 2 },
			inputSchema: z.object({}), audio: () => wav });
		await tool.execute({}, { toolCallId: 'wav', messages: [], context: undefined });
		assert.deepEqual(raw.at(-1), samples);
		const translated = new Experimental_MockSpeechTranslationModelV4({ doStream: async ({ audio }) => {
			const chunks = []; for await (const chunk of audio) chunks.push(chunk);
			assert.deepEqual(await concatAudio(chunks), samples);
			return { stream: convertArrayToReadableStream([{ type: 'finish', sourceText: 'source', outputText: 'translated' }]) };
		} });
		await Translator({ model: translated, inputAudioFormat: target, targetLanguage: 'fr', sourceFormat: { sampleRate: 8000, channels: 2 } })(wav);
	});

	it('rejects strong encoded evidence consistently while accepting generic raw blobs and weak PCM prefixes', async () => {
		const { model, raw } = capture();
		const flac = new Uint8Array(42); flac.set([102, 76, 97, 67, 128, 0, 0, 34]);
		const component = Transcriber({ model, inputAudioFormat: target });
		for (const audio of [flac, flac.buffer, new File([flac], 'input', { type: 'audio/flac' }), new Blob([flac])]) {
			await assert.rejects(component(audio), /loadsAudio/);
		}
		await assert.rejects(component(new Blob([Uint8Array.of(255, 251, 0, 0)], { type: 'audio/mpeg' })), /loadsAudio/);
		await assert.rejects(component(new Blob([new Uint8Array(4)], { type: 'text/plain' })), /declared Blob MIME type/);
		assert.equal(raw.length, 0);
		for (const first of [-1025, -3585]) {
			const bytes = new Uint8Array(Int16Array.of(first, 0, 250, -250).buffer);
			for (const audio of [bytes, bytes.buffer, new Blob([bytes]), new Blob([bytes], { type: 'application/octet-stream' })]) {
				await component(audio); assert.deepEqual(raw.at(-1), bytes);
			}
		}
		await assert.rejects(component.run({ audio: new Uint8Array(4), sourceFormat: { sampleRate: 24000, channels: 1 } }), /sourceFormat.encoding/);
		// An explicit numeric representation remains raw even when its bytes resemble a container.
		const numeric = new Int16Array(flac.buffer);
		await component.run({ audio: numeric, sourceFormat: { sampleRate: 24000, channels: 1 } });
		assert.deepEqual(raw.at(-1), flac);
	});

	it('reads WAVs from streaming writers through their last complete frame', async () => {
		const { model, raw } = capture();
		const layout = { channels: 2, sampleRate: 48000, encoding: 'pcm_s16le' } as const;
		const wav = await writeWav(new Uint8Array(Int16Array.of(50, 100, 150, 200, 250, 300, 350, 400).buffer), layout);
		const transcribe = Transcriber({ model, inputAudioFormat: target, sourceFormat: stereo });
		await transcribe(wav);
		for (const size of [0, 0xffffffff]) {
			const recording = wav.slice(), header = new DataView(recording.buffer);
			header.setUint32(4, size, true); header.setUint32(40, size, true);
			await transcribe(recording);
			assert.deepEqual(raw.at(-1), raw[0]);
			await assert.rejects(transcribe(recording.subarray(0, -1)), ValidationError);
		}
		assert.equal(raw[0].length, 4);
	});

	it('decodes left-aligned integer samples in wider extensible WAV containers', async () => {
		const { model, raw } = capture();
		const transcribe = Transcriber({ model, inputAudioFormat: target, sourceFormat: stereo });
		for (const [bits, precision] of [[24, 20], [32, 24]]) {
			const width = bits / 8;
			const wav = Buffer.alloc(68 + 2 * width);
			wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
			wav.writeUInt32LE(40, 16); wav.writeUInt16LE(0xfffe, 20); wav.writeUInt16LE(1, 22);
			wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(24000 * width, 28);
			wav.writeUInt16LE(width, 32); wav.writeUInt16LE(bits, 34); wav.writeUInt16LE(22, 36);
			wav.writeUInt16LE(precision, 38); wav.writeUInt32LE(4, 40);
			wav.set(Buffer.from('0100000000001000800000aa00389b71', 'hex'), 44);
			wav.write('data', 60); wav.writeUInt32LE(2 * width, 64);
			wav.writeIntLE(-(2 ** (bits - 2)), 68, width); wav.writeIntLE(2 ** (bits - 2), 68 + width, width);
			await transcribe(wav);
			assert.deepEqual(raw.at(-1), Uint8Array.of(0, 0xc0, 0xff, 0x3f)); // PCM16 samples -16384 and 16383.
			for (const invalid of [0, bits + 1]) {
				wav.writeUInt16LE(invalid, 38); await assert.rejects(transcribe(wav), ValidationError);
			}
			wav.writeUInt16LE(precision, 38); wav.writeUInt32LE(3, 44);
			await assert.rejects(transcribe(wav), ValidationError);
		}
		assert.equal(raw.length, 2);
	});

	it('accepts complete WAV samples with an omitted final pad or stale average byte rate', async () => {
		const { model, raw } = capture();
		const transcribe = Transcriber({ model, inputAudioFormat: target });
		for (const encoding of ['pcm_u8', 'pcm_s24le'] as const) {
			const samples = encoding === 'pcm_u8' ? Uint8Array.of(64, 128, 192) : Uint8Array.of(0, 0, 192, 0, 0, 0, 0, 0, 64);
			const padded = await writeWav(samples, { encoding, sampleRate: target.rate, channels: 1 });
			await transcribe(padded);
			const reference = raw.at(-1)!;
			assert.equal(reference.length, 6);
			for (const countPad of [false, true]) {
				const file = Buffer.from(padded.subarray(0, -1));
				file.writeUInt32LE(file.length - 8 + Number(countPad), 4);
				file.writeUInt32LE(1, 28);
				await transcribe(file); assert.deepEqual(raw.at(-1), reference);
				await assert.rejects(transcribe(file.subarray(0, -1)), ValidationError);
				file.writeUInt16LE(7, 32); await assert.rejects(transcribe(file), ValidationError);
			}
		}
	});

	it('bounds finite PCM preparation before resampling and WAV wrapping while direct live input stays open-ended', async () => {
		const { model, raw, files } = capture();
		const sourceFormat = { channels: 1, sampleRate: 12000, encoding: 'pcm_s16le' } as const;
		const samples = new Uint8Array(32), wav = await writeWav(samples, sourceFormat);
		const transcribe = Transcriber({ model, inputAudioFormat: target }, Config({ maxPreparedAudioBytes: 64 }));
		await transcribe(wav);
		assert.equal(raw[0].length, 64);
		await assert.rejects(transcribe.run({ audio: wav, maxPreparedAudioBytes: 63 }), /maxPreparedAudioBytes/);
		const file = Transcriber({ model, sourceFormat, maxPreparedAudioBytes: wav.length });
		await file(samples); assert.deepEqual(files[0], wav);
		await assert.rejects(file.run({ audio: samples, maxPreparedAudioBytes: wav.length - 1 }), /maxPreparedAudioBytes/);
		const tool = Transcriber.withFunction.asTool({ model, inputAudioFormat: target, maxPreparedAudioBytes: 63,
			inputSchema: z.object({ maxPreparedAudioBytes: z.number() }), audio: () => wav });
		await assert.rejects(Promise.resolve(tool.execute({ maxPreparedAudioBytes: 128 }, { toolCallId: 'limit', messages: [], context: undefined })), /maxPreparedAudioBytes/);
		await transcribe.run({ audio: convertArrayToReadableStream([samples, samples, samples]), maxPreparedAudioBytes: 1 });
		assert.deepEqual(raw.map(bytes => bytes.length), [64, 96]);
		for (const invalid of [0, 1.5, Infinity]) assert.throws(() => Transcriber({ model, maxPreparedAudioBytes: invalid }), ConfigError);
		assert.throws(() => Reflect.apply(Transcriber, undefined, [{ model, maxPreparedAudioBytes: '64' }]), ConfigError);
		await assert.rejects(transcribe.run({ audio: wav, maxPreparedAudioBytes: -1 }), ValidationError);
		assert.equal(files.length, 1);
	});

	it('rejects missing and wrong SDK MIME labels and preserves the native URL download route', async () => {
		let calls = 0;
		const model = new MockTranscriptionModelV4({ doGenerate: async ({ mediaType }) => {
			calls++;
			assert.equal(mediaType, 'audio/basic');
			return { ...transcript, warnings: [], response: { timestamp: new Date(0), modelId: 'test' } };
		} });
		const component = Transcriber({ model });
		for (const bytes of [Uint8Array.of(1, 2, 3, 4), Uint8Array.of(255, 251, 0, 0)]) {
			await assert.rejects(component(new File([bytes], 'recording', { type: 'audio/basic' })), /accurately label/);
		}
		const matroska = Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, 0x8b, 0x42, 0x82, 0x88, ...Buffer.from('matroska'));
		await assert.rejects(component(matroska), /accurately label/);
		assert.equal(calls, 0);
		const url = new URL('https://example.invalid/recording');
		let downloads = 0;
		await Transcriber({ model, download: async ({ url: source }) => {
			assert.equal(source.href, url.href); downloads++;
			return { data: Uint8Array.of(255, 251, 0, 0), mediaType: 'audio/basic' };
		} })(url);
		assert.equal(downloads, 1); assert.equal(calls, 1);
	});

	it('requires structured container evidence and leaves truncated or weak prefixes usable as raw bytes', async () => {
		const { model, raw } = capture();
		const text = (value: string) => [...Buffer.from(value)];
		const ogg = new Uint8Array(27); ogg.set(text('OggS'));
		const id3 = Uint8Array.of(...text('ID3'), 4, 0, 0, 0, 0, 0, 0);
		const mp4 = Uint8Array.of(0, 0, 0, 24, ...text('ftypisom'), 0, 0, 0, 0, ...text('isommp42'));
		const webm = Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, ...text('webm'));
		const transcribe = Transcriber({ model, inputAudioFormat: target });
		for (const bytes of [ogg, id3, mp4, webm]) {
			await assert.rejects(transcribe(bytes), /loadsAudio/);
			const prefix = bytes.subarray(0, 4);
			await transcribe(prefix); assert.deepEqual(raw.at(-1), prefix);
		}
		const invalidVersion = ogg.slice(); invalidVersion[4] = 255;
		await transcribe(invalidVersion); assert.deepEqual(raw.at(-1), invalidVersion);
		const invalidTag = id3.slice(); invalidTag[6] = 128;
		await transcribe(invalidTag); assert.deepEqual(raw.at(-1), invalidTag);
		for (const id of ['RIFX', 'RF64', 'BW64']) {
			const header = Uint8Array.of(...text(id), 255, 255, 255, 255, ...text('WAVE'));
			await assert.rejects(transcribe(header), /loadsAudio/);
			await transcribe(header.subarray(0, 4)); assert.deepEqual(raw.at(-1), header.subarray(0, 4));
		}
	});
	it('requires multiple distinct transport-stream headers before rejecting PCM', async () => {
		const { model, raw } = capture();
		const transcribe = Transcriber({ model, inputAudioFormat: target });
		for (const [stride, offset] of [[188, 0], [192, 4], [204, 0]]) {
			const bytes = new Uint8Array(3 * stride);
			for (let i = 0; i < 3; i++) bytes.set([0x47, 0x40, 0, 0x10 + i], offset + stride * i);
			await assert.rejects(transcribe(bytes), /loadsAudio/);
			bytes[offset + 2 * stride + 3] = 0;
			await transcribe(bytes); assert.deepEqual(raw.at(-1), bytes);
			for (const [control, length] of [[0x22, 183], [0x32, 182]]) {
				bytes.set([control, length], offset + 2 * stride + 3);
				await assert.rejects(transcribe(bytes), /loadsAudio/);
				bytes[offset + 2 * stride + 4]++;
				await transcribe(bytes); assert.deepEqual(raw.at(-1), bytes);
			}
		}
		const constant = new Uint8Array(new Int16Array(400).fill(0x1047).buffer);
		await transcribe(constant); assert.deepEqual(raw.at(-1), constant);
	});
	it('follows variable frame lengths in MP3 and ADTS and retains incomplete sequences as PCM', async () => {
		const { model, raw } = capture();
		const transcribe = Transcriber({ model, inputAudioFormat: target });
		// Independent header/byte offsets for MPEG-1 VBR, MPEG-2, MPEG-2.5, and ADTS with and without CRC.
		for (const [first, second, secondAt, thirdAt] of [
			[[255, 251, 0x90, 0], [255, 251, 0xa2, 0], 417, 940],
			[[255, 243, 0x80, 0], [255, 243, 0x82, 0], 208, 417],
			[[255, 227, 0x80, 0], [255, 227, 0x82, 0], 417, 835],
			[[255, 253, 0xe4, 0], [255, 253, 0x86, 0], 1152, 1537],
			[[255, 245, 0x84, 0], [255, 245, 0x86, 0], 384, 769],
			[[255, 241, 76, 128, 1, 159, 252], [255, 240, 76, 128, 2, 31, 252], 12, 28],
		] as const) {
			const bytes = new Uint8Array(thirdAt + 8); bytes.set(first); bytes.set(second, secondAt); bytes.set(first, thirdAt);
			await assert.rejects(transcribe(bytes), /loadsAudio/);
			bytes[thirdAt] = 0; await transcribe(bytes); assert.deepEqual(raw.at(-1), bytes);
		}
		for (const bytes of [Uint8Array.of(255, 241, 0x7c, 0, 1, 159, 252, 0), Uint8Array.of(255, 240, 76, 0, 1, 0, 0, 0),
			Uint8Array.of(255, 251, 0xfc, 0), Uint8Array.of(255, 235, 0x90, 0)]) {
			await transcribe(bytes); assert.deepEqual(raw.at(-1), bytes);
		}
	});
	it('recognizes audio recording headers without reserving their short prefixes in raw PCM', async () => {
		const { model, raw } = capture();
		const transcribe = Transcriber({ model, inputAudioFormat: target });
		const ascii = (s: string) => Buffer.from(s, 'latin1');
		const hex = (s: string) => Buffer.from(s, 'hex');
		const headers = [
			...['#!AMR\n', '#!AMR-WB\n', '#!AMR_MC1.0\n', '#!AMR-WB_MC1.0\n', 'NIST_1A\n', 'nut/multimedia container\0',
				'Creative Voice File\x1a', '\0\nSMJPEG', 'MMMD\0\0\0\x20CNTI'].map(ascii),
			...['.RMF', '.RMP'].map(magic => Buffer.concat([ascii(magic), hex('0000001200000000000000000000')])),
			Buffer.concat([ascii('wvpk'), hex('180000000704'), Buffer.alloc(22)]),
			Buffer.concat([ascii('TTA1'), hex('01000100100080bb0000'), Buffer.alloc(8)]),
			...['.SoX', 'XoS.'].map(magic => Buffer.concat([ascii(magic), hex('0000001c'), Buffer.alloc(16), hex('0000000100000000')])),
			...['64a30300', '0001a364'].map(magic => Buffer.concat([hex(magic), hex('472c44000000000100000002')])),
			hex('000001ba2100010001800813000001bb'), hex('000001ba440004000401000457f8000001bb'),
		];
		for (const header of headers) {
			await assert.rejects(transcribe(header), /loadsAudio/, header.toString('hex'));
			const prefix = header.subarray(0, 4);
			await transcribe(prefix); assert.ok(Buffer.from(raw.at(-1)!).equals(prefix));
		}
		for (const magic of ['wvpk', 'TTA1', '.RMF', '.SoX', 'MMMD']) {
			const lookalike = Buffer.concat([ascii(magic), Buffer.alloc(32)]);
			await transcribe(lookalike); assert.ok(Buffer.from(raw.at(-1)!).equals(lookalike));
		}
	});
	it('follows AC-3, E-AC-3, DTS and LOAS frame sizes before selecting encoded handling', async () => {
		const { model, raw } = capture();
		const transcribe = Transcriber({ model, inputAudioFormat: target });
		for (const [hex, step, frames, wordSwapped] of [
			['0b7700000040', 128, 2, true], ['0b7700004040', 138, 2, false], ['0b7700004140', 140, 2, false],
			['0b7700008040', 192, 2, false], ['0b7700bf3287', 384, 2, true],
			['7ffe8001fc3c75b0b6c0', 1884, 2, true], ['1fffe80007f0000a1c00', 192, 2, true],
			['56e00d', 16, 3, false],
		] as const) {
			const header = Buffer.from(hex, 'hex');
			for (const wordOrder of wordSwapped ? [header, Buffer.from(header).swap16()] : [header]) {
				const bytes = Buffer.alloc(step * (frames - 1) + 10);
				for (let i = 0; i < frames; i++) wordOrder.copy(bytes, i * step);
				await assert.rejects(transcribe(bytes), /loadsAudio/, hex);
				bytes[step * (frames - 1)] = 0;
				await transcribe(bytes); assert.ok(Buffer.from(raw.at(-1)!).equals(bytes));
			}
		}
		for (const hex of ['0b770000ff40', '0b770000c040', '0b77c0073287', '0b770007f287', '0b77000732f8', '56e00000']) {
			const data = Buffer.from(hex, 'hex');
			await transcribe(data); assert.ok(Buffer.from(raw.at(-1)!).equals(data));
		}
	});
	it('distinguishes structured upload manifests and file headers from their raw lookalikes', async () => {
		const { model, raw } = capture();
		const transcribe = Transcriber({ model, inputAudioFormat: target });
		const flv = Buffer.from('464c5601050000000900000000', 'hex');
		for (const header of [flv, Buffer.from('3026b2758e66cf11a6d900aa0062ce6c', 'hex'),
			Buffer.from('ffconcat version 1.0\n'), Buffer.from('ffconcat version 1.0\r\n'),
			Buffer.from('#EXTM3U\n#EXT-X-TARGETDURATION:4\n'), Buffer.from('#EXTM3U\r\n#EXT-X-VERSION:3\r\n')]) {
			await assert.rejects(transcribe(header), /loadsAudio/);
		}
		for (const bytes of [Buffer.from('ffconcat version 1.0x'), Buffer.from('#EXTM3U\ntrack.wav\n'),
			Buffer.from('#EXTM3U.\n#EXT-X-VERSION:3'), Buffer.from(flv).fill(255, 8, 9), Buffer.from(flv).fill(1, 12)]) {
			await transcribe(bytes); assert.ok(Buffer.from(raw.at(-1)!).equals(bytes));
		}
	});
	it('checks the same SDK file MIME across base64 and foreign-realm bytes and preserves native file defaults', async () => {
		const { model, files, raw } = capture();
		const ebml = Uint8Array.of(26, 69, 223, 163, 139, 66, 130, 136, ...Buffer.from('matroska'));
		const wav = await writeWav(Uint8Array.of(1, 0), { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' });
		let downloads = 0;
		const file = Transcriber({ model, sourceFormat: stereo, download: async () => {
			downloads++; return { data: wav, mediaType: 'audio/wav' };
		} });
		for (const source of [ebml, Buffer.from(ebml).toString('base64'), runInNewContext('Uint8Array.from(bytes)', { bytes: ebml }) as Uint8Array]) {
			await assert.rejects(file(source), /accurately label/);
		}
		await file(new URL('https://example.invalid/audio'));
		await file(Buffer.from(wav).toString('base64'));
		await assert.rejects(file(Buffer.from([1, 0, 2, 0]).toString('base64')), /pass decoded bytes with sourceFormat/);
		assert.equal(downloads, 1); assert.deepEqual(files, [wav, wav]);
		const withLayout = Transcriber({ model, sourceFormat: { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' } });
		for (const first of [-1025, -3585]) {
			const bytes = new Uint8Array(Int16Array.of(first, 0, 250, -250).buffer);
			await assert.rejects(withLayout(Buffer.from(bytes).toString('base64')), /pass decoded bytes with sourceFormat/);
			await withLayout(bytes);
			assert.deepEqual((await readWav(files.at(-1)!)).audio, bytes);
		}
		assert.equal(files.length, 4);
		await Transcriber({ model, inputAudioFormat: target })(runInNewContext('Uint8Array.from(bytes).buffer', { bytes: wav }) as ArrayBuffer);
		assert.deepEqual(raw, [Uint8Array.of(1, 0)]);
		const samples = runInNewContext('new Int16Array([7, 31, 14]).subarray(1, 2)') as Int16Array;
		await Transcriber({ model, inputAudioFormat: target, sourceFormat: { sampleRate: 24000, channels: 1 } })(samples);
		assert.deepEqual(raw.at(-1), Uint8Array.of(31, 0));
	});

	it('keeps a trusted foreign recording and its format in their positional roles', async () => {
		const { model, raw, files } = capture();
		const first = await writeWav(Uint8Array.of(1, 0), { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' });
		const second = await writeWav(Uint8Array.of(7, 0), { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' });
		const override = runInNewContext('Uint8Array.from(bytes).buffer', { bytes: second }) as ArrayBuffer;
		const format = runInNewContext('({ type: "audio/pcm", rate: 24000 })') as typeof target;
		const tool = Transcriber.asTool({ model, audio: first, inputSchema: z.object({}) });
		await tool(override); await tool.run({ audio: override });
		await tool.execute({}, { toolCallId: 'configured', messages: [], context: undefined });
		await Transcriber({ model })(override, format);
		assert.deepEqual(files, [second, second, first]);
		assert.deepEqual(raw, [Uint8Array.of(7, 0)]);
	});

	it('distinguishes encoded families from exact labels and rejects incompatible companded layouts', async () => {
		const labels: string[] = [];
		const model = new MockTranscriptionModelV4({ doGenerate: async ({ mediaType }) => {
			labels.push(mediaType); return { ...transcript, warnings: [], response: { timestamp: new Date(0), modelId: 'test' } };
		} });
		const file = Transcriber({ model });
		const tagged = Uint8Array.of(73, 68, 51, 4, 0, 0, 0, 0, 0, 0, 255, 241, 76, 64);
		for (const source of [tagged, new File([tagged], 'tagged.aac', { type: 'audio/aac' })]) await file(source);
		const largeTag = new Uint8Array(10 + 160 * 1024 + 4);
		largeTag.set([73, 68, 51, 4, 0, 0, 0, 10, 0, 0]); largeTag.set([255, 251, 144, 0], largeTag.length - 4);
		await assert.rejects(file(new Blob([largeTag], { type: 'audio/mpeg' })), /accurately label/);
		const mov = Uint8Array.of(0, 0, 0, 20, ...Buffer.from('ftypqt  '), 0, 0, 0, 0, ...Buffer.from('qt  '));
		await assert.rejects(file(new Blob([mov], { type: 'video/quicktime' })), /accurately label/);
		assert.deepEqual(labels, ['audio/aac', 'audio/aac']);
		const raw = Transcriber({ model, inputAudioFormat: { type: 'audio/pcmu', rate: 16000 } });
		for (const type of ['audio/pcmu; rate=8000', 'audio/pcmu; channels="2"']) {
			await assert.rejects(raw(new Blob([new Uint8Array(8)], { type })), /MIME layout/);
		}
	});

	it('rejects missing streaming format before reading a supplied Blob', async () => {
		let reads = 0;
		class CountedBlob extends Blob {
			override arrayBuffer() { reads++; return super.arrayBuffer(); }
		}
		const { model } = capture(), live = Transcriber.asStream({ model });
		await assert.rejects(async () => Reflect.apply(live, undefined, [new CountedBlob()]) as Promise<unknown>, /requires inputAudioFormat/);
		assert.equal(reads, 0);
	});

	it('keeps significant base64 quartets across worker blocks and independent producer chunks', async () => {
		const { model, raw } = capture();
		const convert = Transcriber({ model, inputAudioFormat: target, sourceFormat: { channels: 1, sampleRate: 48000, encoding: 'pcm_s16le' } });
		const input = Uint8Array.from({ length: 120000 }, (_, i) => i * 31 % 251);
		await convert(input);
		const base64 = Buffer.from(input).toString('base64');
		const expected = Buffer.concat([raw[0], Uint8Array.of(0, 0)]);
		for (const separator of ['\n', '\r\n', ' ']) {
			const wrapped = base64.match(/.{1,76}/g)!.join(separator);
			await convert(convertArrayToReadableStream([wrapped, Buffer.from([0, 0, 0, 0]).toString('base64')]));
			assert.ok(expected.equals(raw.at(-1)!), `PCM changed with base64 separator ${JSON.stringify(separator)}`);
		}
	});
	it('checks a declared raw PCM layout against the source of a conversion or the direct model target', async () => {
		const { model, raw } = capture();
		const blob = new Blob([new Int16Array(48).fill(1200)], { type: 'audio/pcm;rate=48000;channels=2' });
		const transcribe = Transcriber({ model, inputAudioFormat: target });
		await assert.rejects(transcribe(blob), /MIME layout/);
		await assert.rejects(transcribe.run({ audio: blob, sourceFormat: { encoding: 'pcm_s16le', sampleRate: 48000, channels: 1 } }), /MIME layout/);
		assert.equal(raw.length, 0);
		const sourceFormat = { encoding: 'pcm_s16le', sampleRate: 48000, channels: 2 } as const;
		await transcribe.run({ audio: blob, sourceFormat });
		await transcribe.run({ audio: await blob.arrayBuffer(), sourceFormat });
		assert.equal(raw[0].byteLength, 24);
		assert.deepEqual(raw[0], raw[1]);
	});
	it('preserves matching native companded bytes and never reinterprets their MIME as linear PCM', async () => {
		const bytes = Uint8Array.of(1, 2, 3, 4);
		let calls = 0;
		const model = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
			calls++;
			const chunks = []; for await (const chunk of audio) chunks.push(chunk);
			assert.deepEqual(await concatAudio(chunks), bytes);
			return { stream: convertArrayToReadableStream([{ type: 'finish', ...transcript }]) };
		} });
		for (const type of ['audio/pcmu', 'audio/pcma']) {
			const audio = new File([bytes], 'raw', { type });
			const sourceFormat = { sampleRate: 48000, channels: 2, encoding: 'pcm_s16le' } as const;
			await Transcriber({ model, sourceFormat, inputAudioFormat: { type } })(audio);
			await assert.rejects(Transcriber({ model, sourceFormat, inputAudioFormat: target })(audio), /loadsAudio/);
		}
		assert.equal(calls, 2);
	});

	it('keeps the same samples for every chunk boundary and rejects a partial frame at EOF', () => {
		for (const inputRate of [16000, 24000, 44100, 48000]) for (let length = 0; length < 14; length++) {
			const bytes = new Uint8Array(Int16Array.from({ length }, (_, n) => (n - 6) * 2903).buffer);
			const format: PcmFormat = { channels: 1, sampleRate: inputRate, encoding: 'pcm_s16le' };
			const ratio = inputRate / target.rate;
			for (const step of [1, 5, 8]) {
				const convert = createPcmStreamConverter(), output = [];
				for (let i = 0; i < bytes.length; i += step) {
					const part = bytes.subarray(i, i + step);
					output.push(convert(i % 2 ? Buffer.from(part).toString('base64') : part, ratio, format));
				}
				output.push(convert(undefined, ratio, format));
				const expected = inputRate === target.rate ? bytes : sdkPcm(bytes, inputRate, target.rate);
				assert.deepEqual(new Uint8Array(Buffer.concat(output)), expected);
			}
		}
		const convert = createPcmStreamConverter();
		convert(Uint8Array.of(1), 1, stereo);
		assert.throws(() => convert(undefined, 1, stereo), /incomplete audio frame/);
	});
	it('reads WAV headers on a File, Blob, ArrayBuffer and unaligned bytes for ordinary, prepared and live calls', async () => {
		const { model, raw, files } = capture();
		const samples = Float32Array.from([.75, -.25, .5, .5, -1, 0, 0, 1]);
		const wav = await writeWav(new Uint8Array(samples.buffer), stereo);
		const storage = new Uint8Array(wav.length + 2); storage.set(wav, 1);
		const plain = Transcriber({ model }, Config({ inputAudioFormat: target }));
		const file = new File([wav], 'recording', { type: 'application/octet-stream' });
		await plain(file);
		await plain.run({ audio: storage.subarray(1, -1) });
		await Transcriber.withFunction({ model, inputAudioFormat: target, audio: () => wav.buffer })();
		const live = Transcriber.asStream({ model, inputAudioFormat: target });
		assert.equal(await (await live(new Blob([wav]))).text, 'heard');
		const expected = sdkPcm(new Uint8Array(Int16Array.from([8191, 16383, -16384, 16383]).buffer), 48000, 24000);
		for (const pcm of raw) assert.deepEqual(pcm, expected);
		assert.equal(raw.length, 4);
		await Transcriber({ model })(file);
		assert.deepEqual(new Uint8Array(files[0]), wav);
		assert.deepEqual(storage.subarray(1, -1), wav);
	});

	it('uses numeric array encoding and wraps described raw input as WAV for a file model', async () => {
		const { model, files } = capture();
		const describe = Transcriber({ model, sourceFormat: { sampleRate: 32000, channels: 1 } });
		for (const [data, encoding] of [[Int16Array.of(-1), 'pcm_s16le'], [Int32Array.of(-2), 'pcm_s32le'],
			[Float32Array.of(0.25), 'pcm_f32le'], [Float64Array.of(0.5), 'pcm_f64le']] as const) {
			await describe(data);
			const saved = await readWav(files.at(-1)!);
			assert.deepEqual(saved.format, { sampleRate: 32000, channels: 1, encoding });
			assert.deepEqual(saved.audio, new Uint8Array(data.buffer));
		}
	});

	it('converts every supported interleaved encoding with fractional rate changes across split stream frames', async () => {
		const { model, raw } = capture();
		for (const [encoding, width] of Object.entries({ pcm_u8: 1, pcm_s16le: 2, pcm_s24le: 3, pcm_s32le: 4, pcm_f32le: 4, pcm_f64le: 8 })) {
			const sourceFormat: PcmFormat = { sampleRate: width % 2 ? 44100 : 16000, channels: 2, encoding: encoding as PcmFormat['encoding'] };
			const bytes = new Uint8Array(103 * 2 * width), view = new DataView(bytes.buffer);
			const mono = new Int16Array(103);
			for (let i = 0; i < mono.length; i++) {
				const value = (i % 5 - 2) / 4;
				mono[i] = value * (value < 0 ? 32768 : 32767);
				for (let c = 0; c < 2; c++) {
					const off = (i * 2 + c) * width;
					if (encoding === 'pcm_u8') view.setUint8(off, 128 + value * 128);
					else if (encoding === 'pcm_s16le') view.setInt16(off, value * 32768, true);
					else if (encoding === 'pcm_s24le') view.setInt8(off + 2, value * 128);
					else if (encoding === 'pcm_s32le') view.setInt32(off, value * 2147483648, true);
					else if (encoding === 'pcm_f32le') view.setFloat32(off, value, true);
					else view.setFloat64(off, value, true);
				}
			}
			const component = Transcriber({ model, inputAudioFormat: target, sourceFormat });
			await component(bytes);
			const chunks: (string | Uint8Array)[] = [];
			for (let i = 0; i < bytes.length; i += 7) {
				const chunk = bytes.subarray(i, i + 7);
				chunks.push(i % 2 ? Buffer.from(chunk).toString('base64') : chunk);
			}
			const input = convertArrayToReadableStream(chunks);
			await component(input);
			const expected = sdkPcm(new Uint8Array(mono.buffer), sourceFormat.sampleRate, target.rate);
			assert.deepEqual(raw.at(-2), expected, encoding);
			assert.deepEqual(raw.at(-1), expected, encoding);
			await assert.rejects(component(input), /already been handed off/);
		}
	});

	it('keeps self-describing Web Audio samples together through tool source selection and file encoding', async () => {
		const { model, files } = capture();
		class TestBuffer {
			length = 2;
			sampleRate = 44100;
			numberOfChannels = 2;
			getChannelData(channel: number) { return channel ? Float32Array.of(0, -1) : Float32Array.of(1, 0.5); }
		}
		const previous = Object.getOwnPropertyDescriptor(globalThis, 'AudioBuffer');
		Object.defineProperty(globalThis, 'AudioBuffer', { configurable: true, value: TestBuffer });
		try {
			const longRecording = new TestBuffer();
			longRecording.length = longRecording.sampleRate * 600;
			longRecording.getChannelData = () => { throw new Error('Audio exceeded the default budget before reading channels.'); };
			await assert.rejects(Transcriber({ model })(longRecording as AudioBuffer), /maxPreparedAudioBytes/);
			const buffer = new TestBuffer() as AudioBuffer;
			const tool = Transcriber.asTool({ model, audio: buffer, inputSchema: z.object({}) });
			await tool(buffer, {});
			const saved = await readWav(files[0]);
			assert.deepEqual(saved.format, { sampleRate: 44100, channels: 2, encoding: 'pcm_f32le' });
			assert.deepEqual(new Float32Array(saved.audio.buffer, saved.audio.byteOffset, 4), Float32Array.of(1, 0, 0.5, -1));
		} finally {
			if (previous) Object.defineProperty(globalThis, 'AudioBuffer', previous);
			else Reflect.deleteProperty(globalThis, 'AudioBuffer');
		}
	});

	it('rejects missing or conflicting source information and unsupported conversion targets before dispatch', async () => {
		const { model, raw, files } = capture();
		const run = (settings: object) => Reflect.apply(Transcriber({ model }).run, undefined, [settings]) as Promise<unknown>;
		for (const settings of [
			{ audio: new File([Uint8Array.of(26, 69, 223, 163)], 'clip.webm', { type: 'audio/webm' }), inputAudioFormat: target },
			{ audio: Float32Array.of(1) }, { audio: new Uint8Array(4), sourceFormat: { sampleRate: 48000, channels: 1 } },
			{ audio: Float32Array.of(1), sourceFormat: { ...stereo, encoding: 'pcm_u8' } },
			{ audio: new ReadableStream(), sourceFormat: stereo },
			{ audio: new Uint8Array(4), sourceFormat: { ...stereo, channels: 0 }, inputAudioFormat: target },
			{ audio: new Uint8Array(4), sourceFormat: { ...stereo, encoding: 'unsupported' }, inputAudioFormat: target },
			{ audio: new Uint8Array(4), sourceFormat: stereo, inputAudioFormat: { type: 'audio/pcmu' } },
			{ audio: new Uint8Array(4), sourceFormat: stereo, inputAudioFormat: { type: 'audio/pcm' } },
		]) await assert.rejects(run(settings), ValidationError);
		assert.equal(files.length + raw.length, 0);
		await run({ audio: new Blob([Uint8Array.of(1, 0)], { type: 'audio/pcm' }), inputAudioFormat: target });
		assert.deepEqual(raw[0], Uint8Array.of(1, 0));
	});

	it('respects cancellation during a file read and cancels converted streams on early provider failure', async () => {
		const { model, raw } = capture();
		const abort = new AbortController(), reason = new Error('stop reading');
		class InterruptedFile extends Blob {
			override async arrayBuffer() { abort.abort(reason); return super.arrayBuffer(); }
		}
		await assert.rejects(Transcriber({ model, inputAudioFormat: target }).run({ audio: new InterruptedFile(), abortSignal: abort.signal }), error => error === reason);
		assert.equal(raw.length, 0);
		let cancelled: unknown;
		const stream = new ReadableStream<Uint8Array>({ cancel(error) { cancelled = error; throw new Error('source cleanup failed'); } }, { highWaterMark: 0 });
		const failed = new MockTranscriptionModelV4({ doStream: async () => { throw reason; } });
		await assert.rejects(Transcriber({ model: failed, inputAudioFormat: target, sourceFormat: stereo })(stream), error => error === reason);
		assert.equal(cancelled, reason);
	});

	it('releases a converted producer when a completed provider stops after its first chunk', async () => {
		const failure = new Error('provider stopped');
		for (const family of ['transcribe', 'translate']) for (const fail of [false, true]) {
			const reasons: unknown[] = [];
			const input = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array(128)); },
				cancel(reason: unknown) { reasons.push(reason); } }, { highWaterMark: 0 });
			async function readPrefix(audio: ReadableStream<Uint8Array | string>) {
				const reader = audio.getReader();
				assert.equal((await reader.read()).done, false);
				reader.releaseLock();
				if (fail) throw failure;
			}
			const options = { inputAudioFormat: target, sourceFormat: stereo };
			const call = family === 'transcribe'
				? Transcriber({ ...options, model: new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
					await readPrefix(audio); return { stream: convertArrayToReadableStream([{ type: 'finish', ...transcript }]) };
				} }) })(input)
				: Translator({ ...options, targetLanguage: 'fr', model: new Experimental_MockSpeechTranslationModelV4({ doStream: async ({ audio }) => {
					await readPrefix(audio); return { stream: convertArrayToReadableStream([{ type: 'finish', sourceText: 'source', outputText: 'translation' }]) };
				} }) })(input);
			if (fail) await assert.rejects(call, error => error === failure); else await call;
			assert.deepEqual(reasons, [fail ? failure : undefined]);
			assert.equal(input.locked, false);
		}
	});

	it('aborts an incremental conversion while its SDK reader is waiting for input', async () => {
		const abort = new AbortController(), reason = new Error('recording stopped');
		let start!: () => void, cancel!: (value: unknown) => void;
		const started = new Promise<void>(resolve => { start = resolve; });
		const cleanup = new Promise<unknown>(resolve => { cancel = resolve; });
		const input = new ReadableStream<Uint8Array>({
			pull: start, cancel,
		}, { highWaterMark: 0 });
		const { model } = capture();
		const stream = await Transcriber.asStream({ model, inputAudioFormat: target, sourceFormat: stereo }).run({ audio: input, abortSignal: abort.signal });
		const result = Promise.resolve(stream.text);
		await started;
		assert.equal(input.locked, true);
		abort.abort(reason);
		await assert.rejects(result, error => error === reason);
		assert.equal(await cleanup, reason);
		assert.equal(input.locked, false);
	});
});
