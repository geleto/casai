import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mock } from 'node:test';
import { Worker } from 'node:worker_threads';
import { MockTranscriptionModelV4, MockSpeechModelV4, Experimental_MockStreamingSpeechModelV4, Experimental_MockSpeechTranslationModelV4, convertArrayToReadableStream } from 'ai/test';
import { NoSpeechGeneratedError, experimental_streamTranslate as streamTranslate } from 'ai';
import { Config, Transcriber, SpeechGenerator, Translator, ConfigError, ValidationError, z } from '../src/index.js';
import { concatAudio } from '../src/audio.js';
import { streamMode, toolMode } from '../src/config/modifiers.js';
import { claimLiveInput } from '../src/runtime/live-input.js';

const format = { type: 'audio/pcm', rate: 24000 };
const transcript = { text: 'hello', segments: [], language: 'en', durationInSeconds: 1 };
const response = { timestamp: new Date(0), modelId: 'mock' };
function model() {
	const doGenerateCalls: unknown[] = [], doStreamCalls: object[] = [];
	return Object.assign(new MockTranscriptionModelV4({
		doGenerate: async request => { doGenerateCalls.push(request); return { ...transcript, warnings: [], response }; },
		doStream: async request => {
			doStreamCalls.push(request);
			const { audio } = request;
			for await (const _chunk of audio) { /* Consume the one supplied recording. */ }
			return { stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, { type: 'finish', ...transcript }]) };
		},
	}), { doGenerateCalls, doStreamCalls });
}

describe('Phase 6 audio delivery', () => {
	it('claims a selected one-shot input by identity without acquiring or reading it', () => {
		const iterator = {
			[Symbol.asyncIterator]() { throw new Error('iterator acquired'); },
			next() { throw new Error('iterator read'); },
		};
		const node = Readable.from([Uint8Array.of(7)]);
		const web = new ReadableStream<Uint8Array>({}, { highWaterMark: 0 });
		try {
			for (const source of [iterator, node, web]) {
				claimLiveInput(source);
				assert.throws(() => { claimLiveInput(source); }, ValidationError);
			}
			assert.equal(web.locked, false);
			assert.equal(node.readableDidRead, false);
		} finally { node.destroy(); }
	});
	it('honors cancellation during completed translation assembly and speech tool encoding', async () => {
		const bytes = new Uint8Array(2 * 1024 * 1024);
		const translation = new Experimental_MockSpeechTranslationModelV4({ doStream: async () => ({
			stream: convertArrayToReadableStream([{ type: 'audio', audio: bytes }, { type: 'finish', sourceText: 'hello', outputText: 'bonjour' }]),
		}) });
		const speech = new Experimental_MockStreamingSpeechModelV4({ doStream: async () => ({
			stream: convertArrayToReadableStream([{ type: 'audio', audio: bytes, audioFormat: format }, { type: 'finish' }]),
		}) });
		for (const job of ['allocate', 'toBase64']) {
			const abort = new AbortController(), reason = new Error(job);
			// eslint-disable-next-line @typescript-eslint/unbound-method -- The observer calls the original method with the worker as receiver.
			const post = Worker.prototype.postMessage;
			const observed = mock.method(Worker.prototype, 'postMessage', function (this: Worker, message: { type?: string }, transfer: Parameters<typeof post>[1]) {
				if (message.type === job) abort.abort(reason);
				post.call(this, message, transfer);
			});
			try {
				const run = job === 'allocate'
					? Translator({ model: translation, inputAudioFormat: format, targetLanguage: 'fr' }).run({ audio: Uint8Array.of(0, 0), abortSignal: abort.signal })
					: SpeechGenerator.asTool({ model: speech, text: 'hello', outputFormat: format, inputSchema: z.object({}) })
						.execute({}, { toolCallId: 'test', messages: [], context: undefined, abortSignal: abort.signal });
				await assert.rejects(async () => run, error => error === reason);
			} finally { observed.mock.restore(); }
		}
	});
	it('clears loaded-only settings before direct file or raw calls', async () => {
		const sdk = model();
		const loaded = Config.loadsAudio({ fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' }, mediaSettings: { track: 0 } });
		const transcribe = Transcriber.withAudio({ model: sdk, fileAudioTarget: undefined, mediaSettings: undefined }, loaded);
		await transcribe(new Uint8Array(2));
		await transcribe.run({ audio: new Uint8Array(2) });
		await transcribe(new Uint8Array(2), format);
		assert.equal(sdk.doGenerateCalls.length, 2);
		assert.equal(sdk.doStreamCalls.length, 1);
	});
	it('uses explicit source placeholders for language and voice overrides', async () => {
		const languages: string[] = [], voices: (string | undefined)[] = [];
		const model = new Experimental_MockSpeechTranslationModelV4({ doStream: async ({ audio, targetLanguage }) => {
			languages.push(targetLanguage);
			for await (const chunk of audio) assert.deepEqual(chunk, Uint8Array.of(1, 2));
			return { stream: convertArrayToReadableStream([{ type: 'finish', sourceText: 'hello', outputText: 'bonjour' }]) };
		} });
		const translate = Translator.withScript({ model, audio: 'return recording', inputAudioFormat: format, context: { recording: Uint8Array.of(1, 2) } });
		await translate(undefined, 'fr');
		await translate({}, 'de');
		await translate.run({ targetLanguage: 'it' });
		assert.deepEqual(languages, ['fr', 'de', 'it']);
		const speechModel = new MockSpeechModelV4({ doGenerate: async ({ text, voice }) => {
			assert.equal(text, 'hello'); voices.push(voice);
			return { audio: 'AQI=', warnings: [], response };
		} });
		await SpeechGenerator({ model: speechModel, text: 'hello' })(undefined, 'alloy');
		assert.deepEqual(voices, ['alloy']);
	});
	it('permits an omitted streamed speech format and explains an invalid string format', async () => {
		let calls = 0;
		const model = new Experimental_MockStreamingSpeechModelV4({ doStream: async ({ outputFormat }) => {
			calls++; assert.equal(outputFormat, undefined);
			return { stream: convertArrayToReadableStream([{ type: 'audio', audio: 'AQI=', audioFormat: format }, { type: 'finish' }]) };
		} });
		const result = await SpeechGenerator.asStream({ model })('hello');
		for await (const _part of result.fullStream) { /* Consume the native result. */ }
		assert.throws(() => Reflect.apply(SpeechGenerator.asStream, undefined, [{ model, outputFormat: 'mp3' }]), {
			name: 'ConfigError', message: 'SpeechGenerator.asStream outputFormat must be an object when supplied.',
		});
		assert.equal(calls, 1);
	});
	it('preserves finite raw bytes in bounded frame-aligned chunks without changing caller streams', async () => {
		const captured: Uint8Array[][] = [];
		const inputs: ReadableStream<Uint8Array | string>[] = [];
		const sdk = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
			inputs.push(audio);
			const chunks: Uint8Array[] = [];
			for await (const chunk of audio) { assert(chunk instanceof Uint8Array); chunks.push(chunk); }
			captured.push(chunks);
			return { stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, { type: 'finish', ...transcript }]) };
		} });
		const source = Uint8Array.from({ length: 100002 }, (_, i) => i % 251);
		const original = source.slice();
		const transcribe = Transcriber({ model: sdk, inputAudioFormat: format });
		await transcribe(source); await transcribe(source.buffer);
		for (const chunks of captured) {
			assert(chunks.every(chunk => chunk.length <= 9600 && chunk.length % 6 === 0));
			assert.equal(chunks.at(-1)!.length, 4002);
			assert.deepEqual(Buffer.concat(chunks), Buffer.from(original));
		}
		assert.deepEqual(source, original);
		await assert.rejects(transcribe(inputs[0]), /already been handed off/);
		const callerStream = convertArrayToReadableStream([source]);
		await transcribe(callerStream);
		assert.deepEqual(captured[2], [source]);
		assert.equal(inputs[2], callerStream);
		const tool = Transcriber.asTool({ model: sdk, audio: new Uint8Array(2), inputAudioFormat: format, inputSchema: z.object({}) });
		await tool(convertArrayToReadableStream([source]));
		assert.deepEqual(captured[3], [source]);
	});
	it('uses either completed or streamed results when a Config spread is conditional', async () => {
		for (const enabled of [false, true]) {
			const sdk = model();
			const maybeLive = enabled ? Config.asStream({}).config : undefined;
			const result = await Transcriber({ model: sdk, inputAudioFormat: format, ...maybeLive })(new Uint8Array(2));
			assert.equal('fullStream' in result, enabled);
			assert.equal(await result.text, 'hello');
			assert.equal(sdk.doStreamCalls.length, 1);
		}
	});
	it('validates native preparation settings before opening resources, including inherited and invocation settings', async () => {
		const model = new MockTranscriptionModelV4();
		const fileAudioTarget = { format: 'wav', codec: 'pcm_s16le' };
		const construct = (settings: object) => Reflect.apply(Transcriber.loadsAudio as unknown as (...args: unknown[]) => unknown, undefined, [{ model, ...settings }]);
		for (const settings of [
			{ mediaSettings: { track: -1 } }, { mediaSettings: { track: 0.5 } },
			{ inputAudioFormat: { type: 'audio/pcm' } }, { inputAudioFormat: { type: 'audio/mpeg', rate: 24000 } },
			{ inputAudioFormat: { type: 'audio/pcm', rate: 24000 }, fileAudioTarget },
			{ fileAudioTarget: { format: 'wav' } }, { fileAudioTarget: { ...fileAudioTarget, rate: 0 } },
			{ fileAudioTarget: { ...fileAudioTarget, alternatives: [{ format: 'flac', codec: 'flac', channels: -1 }] } },
			{ fileAudioTarget: { ...fileAudioTarget, maxBytes: 0.5 } },
			{ fileAudioTarget: { ...fileAudioTarget, maxDurationSeconds: Infinity } },
			{ download: () => new Uint8Array() },
		]) assert.throws(() => construct(settings), ConfigError);
		const prepared = Transcriber.loadsAudio({ model, fileAudioTarget: { ...fileAudioTarget, alternatives: [{ format: 'flac', codec: 'flac' }], maxBytes: 1024, maxDurationSeconds: 1 } });
		await assert.rejects(prepared.run({ audio: 'unopened.wav', mediaSettings: { track: -1 } }), ValidationError);
		assert.throws(() => Transcriber.loadsAudio({ model, fileAudioTarget }, Config({ mediaSettings: { track: -1 } })), ConfigError);
	});
	it('selects file or raw execution from request shape and preserves completed fields', async () => {
		const sdk = model();
		const transcribe = Transcriber({ model: sdk });
		assert.equal((await transcribe(new Uint8Array(2))).text, 'hello');
		const result = await transcribe(new Uint8Array(2), format);
		assert.deepEqual(Object.keys(result).sort(), ['durationInSeconds', 'language', 'providerMetadata', 'responses', 'segments', 'text', 'warnings']);
		assert.equal(result.text, 'hello');
		assert.equal(sdk.doGenerateCalls.length, 1);
		assert.equal(sdk.doStreamCalls.length, 1);
	});
	it('retains delivery through parents and spreads without leaking metadata to the SDK', async () => {
		const sdk = model();
		const fragment = Config.asStream({ inputAudioFormat: format });
		assert.equal(Config({ ...Config({}).config }, fragment).config[streamMode], true);
		assert.equal(Config({}, Config.asTool({})).config[toolMode], true);
		const inherited = Transcriber({ model: sdk }, Config({}, fragment));
		const copied = Transcriber({ model: sdk, ...fragment.config });
		for (const component of [inherited, copied]) {
			const result = await component(new Uint8Array(2));
			assert.equal(await result.text, 'hello');
			assert.equal('streaming' in component.config, false);
			assert.equal('asTool' in component.config, false);
		}
		assert.equal(sdk.doStreamCalls.length, 2);
		assert.equal(sdk.doGenerateCalls.length, 0);
		for (const request of sdk.doStreamCalls) assert.equal(Object.getOwnPropertySymbols(request).length, 0);
	});
	it('collects native streaming for ordinary tools and exposes transcript text to the model', async () => {
		const sdk = model();
		const providerOptions = { example: { privateSetting: 'inner-model' } };
		const tool = Transcriber.withFunction.asTool({ model: sdk, providerOptions, inputAudioFormat: format, inputSchema: z.object({ size: z.number() }), audio: ({ size }) => new Uint8Array(size) });
		assert.equal(tool.providerOptions, undefined);
		const result = await tool.execute({ size: 2 }, { toolCallId: 'call', messages: [], context: undefined });
		assert.deepEqual(result, transcript);
		assert.deepEqual(await tool.toModelOutput!({ output: result, input: { size: 2 }, toolCallId: 'call' }), { type: 'text', value: 'hello' });
		assert.equal(sdk.doStreamCalls.length, 1);
		assert.deepEqual(Reflect.get(sdk.doStreamCalls[0], 'providerOptions'), providerOptions);
	});
	it('rejects removed settings and combined modifiers before dispatch', async () => {
		const sdk = model();
		const invoke = (factory: unknown, ...args: unknown[]) => Reflect.apply(factory as (...args: unknown[]) => unknown, undefined, args);
		for (const key of ['asTool', 'streaming', 'promptType']) {
			for (const value of [true, false, undefined]) {
				for (const settings of [{ [key]: value }, Object.create({ [key]: value }) as object]) {
					assert.throws(() => invoke(Config, settings), ConfigError);
					assert.throws(() => invoke(Transcriber, { model: sdk }, { config: settings }), ConfigError);
					await assert.rejects(invoke(Transcriber({ model: sdk }).run, settings) as Promise<unknown>, ValidationError);
				}
			}
		}
		const streaming = Config.asStream({});
		assert.throws(() => invoke(Transcriber.asTool, { model: sdk, inputSchema: z.object({}) }, streaming), ConfigError);
		assert.equal(sdk.doGenerateCalls.length + sdk.doStreamCalls.length, 0);
	});
	it('selects speech from request shape once and retains emitted format, usage and native file views', async () => {
		let completeCalls = 0, streamCalls = 0;
		const complete = new MockSpeechModelV4({ doGenerate: async () => {
			completeCalls++; return { audio: 'AQI=', warnings: [], response };
		} });
		assert.equal((await SpeechGenerator({ model: complete })('hello')).audio.base64, 'AQI=');
		const emitted = { type: 'audio/pcm', rate: 48000 };
		const usage = { inputCharacters: 5, outputTokens: 3, raw: { native: true } };
		const model = new Experimental_MockStreamingSpeechModelV4({ doStream: async ({ text }) => {
			streamCalls++; for await (const _chunk of text) { /* Drain native text. */ }
			return { stream: convertArrayToReadableStream([
				{ type: 'audio', audio: '', audioFormat: { type: 'audio/ignored' }, providerMetadata: { mock: { empty: true } } },
				{ type: 'audio', audio: 'AQI=', audioFormat: emitted }, { type: 'audio', audio: Uint8Array.of(3, 4), audioFormat: emitted },
				{ type: 'finish', usage, providerMetadata: { mock: { complete: true } } },
			]) };
		} });
		const speaker = SpeechGenerator({ model, outputFormat: format });
		const result = await speaker('hello', 'voice');
		assert.equal(result.audio.base64, 'AQIDBA=='); assert.deepEqual(result.audio.uint8Array, Uint8Array.of(1, 2, 3, 4));
		assert.deepEqual(result.audioFormat, emitted); assert.deepEqual(result.usage, usage); assert.equal(result.audio.format, 'pcm');
		assert.deepEqual(result.providerMetadata, { mock: { complete: true } });
		const chunks = ['one', 'two'];
		const speakChunks = SpeechGenerator({ model });
		assert.equal((await speakChunks(chunks)).audio.base64, 'AQIDBA==');
		assert.equal((await speakChunks(chunks)).audio.base64, 'AQIDBA==');
		const tool = SpeechGenerator.asTool({ model, outputFormat: format, inputSchema: z.object({ text: z.string() }) });
		const output = await tool.execute({ text: 'hello' }, { toolCallId: 'speech', messages: [], context: undefined });
		assert.deepEqual(output, { mediaType: 'audio/pcm', base64: 'AQIDBA==', audioFormat: emitted });
		assert.deepEqual(await tool.toModelOutput!({ output, input: { text: 'hello' }, toolCallId: 'speech' }), {
			type: 'content', value: [{ type: 'file', mediaType: 'audio/pcm', data: { type: 'data', data: 'AQIDBA==' } }],
		});
		assert.equal(completeCalls, 1); assert.equal(streamCalls, 4);
	});
	it('rejects incompatible speech delivery settings before preparing text or loading a script', async () => {
		let prepared = 0, loaded = 0, requests = 0;
		const model = new Experimental_MockStreamingSpeechModelV4({ doStream: async () => {
			requests++; return { stream: convertArrayToReadableStream([{ type: 'finish' }]) };
		} });
		const speak = SpeechGenerator.withFunction({ model, text: () => { prepared++; return 'hello'; } });
		const stream = SpeechGenerator.loadsScript.asStream({ model, text: 'text.cas', loader: () => { loaded++; return "return 'hello'"; } });
		await assert.rejects(speak.run({ includeRawChunks: true } as never), ValidationError);
		await assert.rejects(stream.run({ outputFormat: 'wav' } as never), ValidationError);
		assert.deepEqual([prepared, loaded, requests], [0, 0, 0]);
	});
	it('rejects invalid speech shape before dispatch, mixed formats and empty completion without retries', async () => {
		let requests = 0;
		const model = new Experimental_MockStreamingSpeechModelV4({ doStream: async () => {
			requests++; return { stream: convertArrayToReadableStream([
				{ type: 'audio', audio: 'AQI=', audioFormat: format },
				{ type: 'audio', audio: 'AwQ=', audioFormat: { ...format, rate: 48000 } }, { type: 'finish' },
			]) };
		} });
		const speaker = SpeechGenerator({ model, outputFormat: format });
		await assert.rejects(speaker('hello'), /different audio formats/); assert.equal(requests, 1);
		await assert.rejects(Reflect.apply(speaker.run as unknown as (settings: unknown) => Promise<unknown>, undefined, [{ text: ['hello'], outputFormat: 'mp3' }]), ValidationError);
		assert.equal(requests, 1);
		const empty = new Experimental_MockStreamingSpeechModelV4({ doStream: async () => ({ stream: convertArrayToReadableStream([{ type: 'finish' }]) }) });
		await assert.rejects(SpeechGenerator({ model: empty, outputFormat: format })('hello'), NoSpeechGeneratedError);
	});
	it('observes output-drain failures after native finish instead of returning partial audio', async () => {
		const failure = new Error('output transport failed after finish');
		const model = new Experimental_MockStreamingSpeechModelV4({ doStream: async () => {
			let position = 0;
			return { stream: new ReadableStream({ pull(controller) {
				if (position++ === 0) controller.enqueue({ type: 'audio', audio: 'AQI=', audioFormat: format });
				else if (position === 2) controller.enqueue({ type: 'finish' });
				else controller.error(failure);
			} }) };
		} });
		await assert.rejects(SpeechGenerator({ model, outputFormat: format })('hello'), error => error === failure);
	});
	it('collects authoritative translation text and bytes; tool formatting never replaces the application result', async () => {
		let calls = 0;
		const model = new Experimental_MockSpeechTranslationModelV4({ doStream: async ({ audio }) => {
			calls++; for await (const _chunk of audio) { /* Consume one finite recording. */ }
			return { stream: convertArrayToReadableStream([
				{ type: 'output-text-delta', delta: 'interim' }, { type: 'audio', audio: 'AQI=' }, { type: 'audio', audio: Uint8Array.of(3) },
				{ type: 'finish', sourceText: 'source', outputText: '', durationInSeconds: 0.1, providerMetadata: { mock: { final: true } } },
			]) };
		} });
		const translate = Translator({ model, inputAudioFormat: format, targetLanguage: 'fr' });
		const result = await translate(new Uint8Array(2));
		assert.equal(result.translationText, ''); assert.equal(result.sourceText, 'source');
		assert.deepEqual(result.audio, Uint8Array.of(1, 2, 3)); assert.deepEqual(result.providerMetadata, { mock: { final: true } });
		const tool = Translator.asTool({ model, inputAudioFormat: format, targetLanguage: 'fr', audio: new Uint8Array(2), inputSchema: z.object({}) });
		const output = await tool.execute({}, { toolCallId: 'translate', messages: [], context: undefined });
		assert.deepEqual(output, { sourceText: 'source', translationText: '', audio: 'AQID', durationInSeconds: 0.1 });
		assert.deepEqual(await tool.toModelOutput!({ output, input: {}, toolCallId: 'translate' }), { type: 'text', value: '' });
		assert.equal(calls, 2);
	});
	it('completes text-only translation without audio workers while nonempty assembly still requires them', async () => {
		let emptyAudioParts = false;
		const model = new Experimental_MockSpeechTranslationModelV4({ doStream: async ({ audio }) => {
			for await (const _chunk of audio) { /* Consume the recording once. */ }
			return { stream: convertArrayToReadableStream([
				...(emptyAudioParts ? [{ type: 'audio' as const, audio: '' }, { type: 'audio' as const, audio: new Uint8Array(0) }] : []),
				{ type: 'finish', sourceText: 'hello', outputText: emptyAudioParts ? '' : 'bonjour' },
			]) };
		} });
		const settings = { model, inputAudioFormat: format, targetLanguage: 'fr', audio: new Uint8Array(2) };
		const unavailable = new Error('Audio workers are unavailable');
		const post = mock.method(Worker.prototype, 'postMessage', () => { throw unavailable; });
		try {
			const tool = Translator.asTool({ ...settings, inputSchema: z.object({}) });
			for (emptyAudioParts of [false, true]) {
				const text = emptyAudioParts ? '' : 'bonjour';
				const native = streamTranslate({ ...settings, audio: convertArrayToReadableStream([settings.audio]) });
				assert.equal(await native.translationText, text);
				const result = await Translator(settings)();
				assert.equal(result.translationText, text);
				assert.deepEqual(result.audio, new Uint8Array(0));
				const output = await tool.execute({}, { toolCallId: 'text-only', messages: [], context: undefined });
				assert.deepEqual(output, { sourceText: 'hello', translationText: text, audio: '', durationInSeconds: undefined });
				assert.deepEqual(await tool.toModelOutput!({ output, input: {}, toolCallId: 'text-only' }), { type: 'text', value: text });
			}
			assert.equal(post.mock.callCount(), 0);
			await assert.rejects(concatAudio([Uint8Array.of(1)]), error => error === unavailable);
			assert.equal(post.mock.callCount(), 1);
		} finally { post.mock.restore(); }
	});
});
