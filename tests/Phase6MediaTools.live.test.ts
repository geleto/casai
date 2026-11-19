import assert from 'node:assert/strict';
import { createGoogle } from '@ai-sdk/google';
import { elevenlabs } from '@ai-sdk/elevenlabs';
import { openai } from '@ai-sdk/openai';
import { isStepCount } from 'ai';
import { LLMAgent, SpeechGenerator, Transcriber, z } from '../src/index.js';

describe('Phase 6 media tools (paid receiving-model acceptance)', function () {
	this.timeout(330000);
	it('lets the receiving model hear tool audio, with a changed-audio control and no transcript in its messages', async () => {
		assert.ok(process.env.GOOGLE_GENERATIVE_AI_API_KEY, 'Configure GOOGLE_GENERATIVE_AI_API_KEY in .env. Missing credentials are not a passing audio-tool check.');
		assert.ok(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY generates the small speech fixtures.');
		for (const [phrase, color, number] of [
			['The lantern is purple and the number is seven.', /purple/i, /seven|7/i],
			['The lantern is orange and the number is eleven.', /orange/i, /eleven|11/i],
		] as const) {
			const requests: string[] = [];
			const google = createGoogle({ fetch: async (input, init) => {
				assert.ok(typeof init?.body === 'string'); requests.push(init.body); return fetch(input, init);
			} });
			const recording = SpeechGenerator.asTool({
				model: openai.speech('gpt-4o-mini-tts'), voice: 'alloy', text: phrase,
				description: 'Return the available short recording.', inputSchema: z.object({}),
			});
			const listen = LLMAgent({
				model: google(process.env.CASAI_AUDIO_TOOL_MODEL ?? 'gemini-3.1-flash-lite'), tools: { recording }, stopWhen: isStepCount(3),
				reasoning: 'none', maxOutputTokens: 256, maxRetries: 0,
				prepareStep: ({ stepNumber }) => ({ toolChoice: stepNumber === 0 ? 'required' : 'none' }),
			});
			const result = await listen.run({ prompt: 'Listen to the recording tool and report the color and number spoken in it. Do not guess.', abortSignal: AbortSignal.timeout(150000) });
			assert.match(result.output, color); assert.match(result.output, number);
			assert.equal(result.steps.flatMap(step => step.toolResults).length, 1);
			assert.ok(requests.some(request => request.includes('functionResponse') && request.includes('inlineData') && /audio\/(mpeg|mp3)/.test(request)));
			assert.ok(requests.every(request => !request.includes(phrase)), 'The answer must come from audio, not a leaked transcript.');
		}
	});
});

describe('Phase 6 speech (paid ElevenLabs streaming acceptance)', function () {
	this.timeout(120000);
	it('cancels an active provider stream and releases its unfinished text input', async () => {
		assert.ok(process.env.ELEVENLABS_API_KEY, 'Configure ELEVENLABS_API_KEY in .env.');
		const abort = new AbortController();
		let notifyCancelled!: () => void;
		const cancelled = new Promise<void>(resolve => { notifyCancelled = resolve; });
		const text = new ReadableStream<string>({
			start(controller) { controller.enqueue('This short recording verifies cancellation after speech has begun. The input deliberately remains open so cancellation must release the unfinished text stream and close the native connection. '); },
			cancel() { notifyCancelled(); },
		});
		const live = await SpeechGenerator.asStream({ model: elevenlabs.speech('eleven_flash_v2_5'),
			voice: process.env.CASAI_ELEVENLABS_VOICE ?? 'JBFqnCBsd6RMkjVDRZzb', outputFormat: { type: 'audio/pcm', rate: 24000 } })
			.run({ text, abortSignal: AbortSignal.any([abort.signal, AbortSignal.timeout(45000)]) });
		const reader = live.audioStream.getReader();
		try {
			const first = await reader.read(); assert.equal(first.done, false); assert.ok(first.value.length > 0);
			abort.abort(new Error('cancel active speech'));
			await assert.rejects(async () => { while (!(await reader.read()).done) { /* Drain any already queued chunks. */ } }, /cancel active speech/);
			await assert.rejects(Promise.resolve(live.usage), /cancel active speech/);
			await cancelled;
		} finally { abort.abort(); reader.releaseLock(); }
	});
	it('collects native streaming speech and exposes incremental raw audio with its actual format', async () => {
		assert.ok(process.env.ELEVENLABS_API_KEY, 'Configure ELEVENLABS_API_KEY in .env. Missing credentials are not a passing streaming-speech check.');
		assert.ok(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY transcribes the generated control.');
		const model = elevenlabs.speech('eleven_flash_v2_5');
		const voice = process.env.CASAI_ELEVENLABS_VOICE ?? 'JBFqnCBsd6RMkjVDRZzb'; // George, a documented premade voice.
		const speak = SpeechGenerator({ model, voice, outputFormat: { type: 'audio/mpeg', rate: 44100 } });
		const completed = await speak.run({ text: ['The lantern is purple.'], abortSignal: AbortSignal.timeout(45000) });
		assert.equal(completed.audio.mediaType, 'audio/mpeg'); assert.equal(completed.audioFormat?.rate, 44100);
		const transcript = await Transcriber({ model: openai.transcription('gpt-4o-mini-transcribe') }).run({ audio: completed.audio.uint8Array, abortSignal: AbortSignal.timeout(45000) });
		assert.match(transcript.text, /purple/i);
		const live = await SpeechGenerator.asStream({ model, voice, outputFormat: { type: 'audio/pcm', rate: 24000 } }).run({ text: ['Hello ', 'from a streaming recording.'], abortSignal: AbortSignal.timeout(45000) });
		let audioBytes = 0;
		for await (const part of live.fullStream) {
			if (part.type === 'error') throw new Error('Native speech streaming failed.', { cause: part.error });
			if (part.type === 'audio') {
				assert.deepEqual(part.audioFormat, { type: 'audio/pcm', rate: 24000 });
				audioBytes += part.audio.byteLength;
			}
		}
		assert.ok(audioBytes > 0);
	});
});
