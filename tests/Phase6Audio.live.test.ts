import assert from 'node:assert/strict';
import { openai } from '@ai-sdk/openai';
import { SpeechGenerator, Transcriber, Translator } from '../src/index.js';
import { prepareAudio } from '../src/audio/native.js';
import { concatAudio } from '../src/audio.js';

// Paid acceptance uses a few seconds of generated speech, never a private recording.
describe('Phase 6 audio (paid OpenAI acceptance)', function () {
	this.timeout(60000);
	let recording: Uint8Array, raw: Uint8Array;
	const inputAudioFormat = { type: 'audio/pcm', rate: 24000 };
	const signal = () => AbortSignal.timeout(45000);
	before(async () => {
		assert.ok(process.env.OPENAI_API_KEY, 'Configure OPENAI_API_KEY in .env before running paid acceptance.');
		const speak = SpeechGenerator({ model: openai.speech('gpt-4o-mini-tts'), voice: 'alloy' });
		const result = await speak.run({ text: 'The lantern is purple and the number is seven.', abortSignal: signal() });
		assert.equal(result.audio.mediaType, 'audio/mpeg');
		recording = result.audio.uint8Array;
		assert.ok(recording.length > 1000);
		await using prepared = await prepareAudio(recording, { inputAudioFormat, abortSignal: signal() });
		const chunks: Uint8Array[] = [];
		for await (const chunk of prepared.audio) chunks.push(chunk);
		raw = (await concatAudio(chunks));
		assert.ok(raw.length > 24000);
	});
	function assertTranscript(text: string) {
		assert.match(text, /purple/i); assert.match(text, /seven|7/i);
	}
	it('generates speech, transcribes encoded bytes and transcribes native-prepared encoded files', async () => {
		const model = openai.transcription('gpt-4o-mini-transcribe');
		assertTranscript((await Transcriber({ model }).run({ audio: recording, abortSignal: signal() })).text);
		const loaded = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', maxBytes: 1024 * 1024 } });
		assertTranscript((await loaded.run({ audio: recording, abortSignal: signal() })).text);
	});
	it('collects one native streaming transcription and retains incremental delivery', async () => {
		const settings = { model: openai.transcription('gpt-transcribe'), inputAudioFormat };
		assertTranscript((await Transcriber(settings).run({ audio: raw, abortSignal: signal() })).text);
		const result = await Transcriber.loadsAudio.asStream(settings).run({ audio: recording, abortSignal: signal() });
		assertTranscript(await result.text);
	});
	it('collects translated audio and text from one native session', async () => {
		const translate = Translator({ model: openai.translation('gpt-realtime-translate'), inputAudioFormat, targetLanguage: 'fr' });
		const result = await translate.run({ audio: raw, abortSignal: signal() });
		assert.ok(result.audio.length > 0);
		assert.match(result.translationText, /violet|pourpre/i);
		assert.match(result.translationText, /sept|7/i);
	});
	it('delivers incremental translated audio and text before reading final results', async () => {
		const result = await Translator.asStream({ model: openai.translation('gpt-realtime-translate'), inputAudioFormat, targetLanguage: 'fr' })
			.run({ audio: raw, abortSignal: signal() });
		let audioBytes = 0, text = '';
		for await (const part of result.fullStream) {
			if (part.type === 'error') throw new Error('Native translation failed.', { cause: part.error });
			if (part.type === 'audio') audioBytes += typeof part.audio === 'string' ? Buffer.from(part.audio, 'base64').length : part.audio.length;
			if (part.type === 'output-text-delta') text += part.delta;
		}
		assert.ok(audioBytes > 0);
		assert.match(text, /violet|pourpre/i); assert.match(text, /sept|7/i);
		assert.equal(await result.translationText, text);
		assert.ok((await result.response).modelId);
	});
});
