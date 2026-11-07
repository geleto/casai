import assert from 'node:assert/strict';
import { createOpenAI } from '@ai-sdk/openai';
import { embed as nativeEmbed, jsonSchema, tool } from 'ai';
import { AsyncEnvironment } from 'cascada-engine';
import { MockEmbeddingModelV4, MockSpeechModelV4, MockTranscriptionModelV4, Experimental_MockStreamingSpeechModelV4, convertArrayToReadableStream } from 'ai/test';
import { create, z, ValidationError } from './cascada';

const format = { type: 'audio/pcm', rate: 24000 };
const metadata = { toolCallId: 'review', messages: [], context: undefined };

describe('component dispatch boundaries', () => {
	it('keeps an authored model-output formatter on a native component tool', async () => {
		const model = new MockSpeechModelV4({ doGenerate: async () => ({ audio: 'AQI=', warnings: [], response: { timestamp: new Date(0), modelId: 'speech' } }) });
		const toModelOutput = (_options: { toolCallId: string; input: unknown; output: unknown }) => ({ type: 'text' as const, value: 'stored in application' });
		const speak = create.SpeechGenerator.asTool({ model, inputSchema: z.object({ text: z.string() }), toModelOutput });
		const output = await speak.execute({ text: 'hello' }, metadata);
		assert.equal(speak.toModelOutput, toModelOutput);
		assert.deepEqual(speak.toModelOutput({ toolCallId: 'review', input: { text: 'hello' }, output }), { type: 'text', value: 'stored in application' });
	});

	it('forwards cancellation from a native descriptor to the provider', async () => {
		const controller = new AbortController();
		const reason = new Error('stopped by caller');
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values, abortSignal }) => {
			assert.ok(abortSignal);
			controller.abort(reason);
			assert.equal(abortSignal.reason, reason);
			return { embeddings: values.map(() => [1]), warnings: [] };
		} });
		const embed = create.Embedder.asTool({ model, inputSchema: z.object({ input: z.string() }) });
		await embed.execute({ input: 'hello' }, { ...metadata, abortSignal: controller.signal });
		assert.equal(model.doEmbedCalls.length, 1);
	});

	it('does not run a preparer or a registered executor after pre-abort', async () => {
		let entries = 0;
		const controller = new AbortController(); controller.abort(new Error('already stopped'));
		const embed = create.Embedder.withFunction({ model: new MockEmbeddingModelV4(), input: () => { entries++; return 'text'; } });
		await assert.rejects(embed.run({ abortSignal: controller.signal }), /already stopped/);
		const fn = create.Function.asTool({ inputSchema: z.object({}), execute: () => { entries++; return 'value'; } });
		const owner = create.Function({ tools: { fn }, execute: ({ fn }) => fn({}) });
		await assert.rejects(owner.run({ abortSignal: controller.signal }), /already stopped/);
		assert.equal(entries, 0);
	});

	it('keeps SDK batch parallelism under the configured limit', async () => {
		let running = 0, peak = 0;
		const model = new MockEmbeddingModelV4({ maxEmbeddingsPerCall: 1, supportsParallelCalls: true,
			doEmbed: async ({ values }) => {
				peak = Math.max(peak, ++running);
				await new Promise<void>(resolve => setImmediate(resolve));
				running--;
				return { embeddings: values.map(value => [value.length]), warnings: [] };
			} });
		const embed = create.Embedder({ model, maxParallelCalls: 1 });
		assert.deepEqual((await embed(['a', 'bb', 'ccc'])).embeddings, [[1], [2], [3]]);
		assert.equal(peak, 1);
	});

	it('forwards streaming speech voice and claims its source once', async () => {
		const voices: (string | undefined)[] = [];
		const model = new Experimental_MockStreamingSpeechModelV4({ doStream: async ({ text, voice }) => {
			voices.push(voice);
			for await (const _part of text) { /* Consume the native input. */ }
			return { stream: convertArrayToReadableStream([{ type: 'audio', audio: 'AQI=', audioFormat: format }, { type: 'finish' }]) };
		} });
		const source = convertArrayToReadableStream(['hello']);
		const speak = create.StreamingSpeechGenerator({ model });
		const first = await speak(source, 'alloy');
		for await (const _chunk of first.audioStream) { /* Complete the native output. */ }
		await assert.rejects(speak(source, 'nova'), ValidationError);
		assert.deepEqual(voices, ['alloy']);
	});

	it('keeps streaming transcription model output textual', async () => {
		const model = new MockTranscriptionModelV4({ doStream: async () => ({ stream: convertArrayToReadableStream([
			{ type: 'finish', text: 'done', segments: [], language: 'en' },
		]) }) });
		const transcribe = create.StreamingTranscriber.withFunction.asTool({ model, inputAudioFormat: format, inputSchema: z.object({}),
			audio: () => convertArrayToReadableStream([new Uint8Array([1])]) });
		const output = await transcribe.execute({}, metadata);
		assert.deepEqual(await transcribe.toModelOutput?.({ toolCallId: 'review', input: {}, output }), { type: 'text', value: 'done' });
	});

	it('keeps token expiration outside native session configuration', async () => {
		const sessions: unknown[] = [];
		const model = Object.assign(createOpenAI({ apiKey: 'fixture' }).experimental_realtime('test'), {
			doCreateClientSecret: async (options: { sessionConfig: unknown; expiresAfterSeconds?: number }) => {
				sessions.push(options);
				return { token: 'token', url: 'https://example.test', expiresAt: 10 };
			},
		});
		const voice = create.VoiceSessionSetup({ model, instructions: 'hello', expiresAfterSeconds: 60 });
		assert.deepEqual(await voice.prepareSessionConfig(), { instructions: 'hello' });
		await voice();
		assert.deepEqual(sessions, [{ sessionConfig: { instructions: 'hello' }, expiresAfterSeconds: 60 }]);
	});

	it('checks cancellation after asynchronous realtime tool definitions', async () => {
		const controller = new AbortController();
		let entries = 0;
		const lookup = tool({ inputSchema: jsonSchema({}, { validate: value => ({ success: true, value }) }) });
		const inputSchema = jsonSchema(() => { controller.abort(new Error('cancelled during definitions')); return { type: 'object', properties: {} }; });
		const model = Object.assign(createOpenAI({ apiKey: 'fixture' }).experimental_realtime('test'), {
			doCreateClientSecret: async () => { entries++; return { token: 'token', url: 'https://example.test', expiresAt: 1 }; },
		});
		const voice = create.VoiceSessionSetup({ model,
			tools: { lookup: { ...lookup, inputSchema } } });
		await assert.rejects(voice.run({ abortSignal: controller.signal }), /cancelled during definitions/);
		assert.equal(entries, 0);
	});

	it('keeps plain non-tool shorthand source-first', async () => {
		const embed = create.Embedder({ model: new MockEmbeddingModelV4(), input: 'ready' });
		const workflow = create.Script({ script: 'return embed(input="replacement")', context: { embed } });
		await assert.rejects(workflow(), /Use .run\(\)/);
	});

	it('uses parsed payloads on ordinary, named and injected plain tool calls', async () => {
		let parses = 0;
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const embed = create.Embedder.asTool({ model, context: { input: 'default', secret: 'private' },
			inputSchema: z.object({ input: z.string().transform(value => { parses++; return value.toUpperCase(); }) }) });
		assert.deepEqual((await embed({ input: 'hello' })).embedding, [5]);
		await embed.run({ context: { input: 'named' } });
		await embed();
		await embed('authored');
		await embed.run({ input: 'override', context: { input: 'payload' } });
		const direct = create.Script({ script: 'return embed(input="direct").embedding', context: { embed } });
		assert.deepEqual(await direct(), [6]);
		const registered = create.Script({ script: 'return embed(input="registered")', tools: { embed } });
		assert.deepEqual(await registered(), [10]);
		assert.equal(await create.Template({ template: '{{ embed(input="template")[0] }}', tools: { embed } })(), '8');
		assert.deepEqual(model.doEmbedCalls.map(call => call.values), [['HELLO'], ['NAMED'], ['DEFAULT'], ['authored'], ['override'], ['DIRECT'], ['REGISTERED'], ['TEMPLATE']]);
		assert.equal(parses, 8);
		await assert.rejects(async () => { await Reflect.apply(embed, undefined, [{ input: 'x', secret: 'changed' }]); }, /Undeclared tool input keys: secret/);
		await assert.rejects(async () => { await Reflect.apply(embed, undefined, [{ input: 'x', extra: true }]); }, /Undeclared/);
		assert.equal(embed.config.context.input, 'default');
		assert.equal(embed.config.context.secret, 'private');
	});

	it('matches native unknown-setting handling and forwards new native session settings without Casai fields', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async () => ({ embeddings: [[1]], warnings: [] }) });
		const unknownSettings = { futureSetting: true, mode: 'native', options: {}, messages: [], approve: true };
		const native = await nativeEmbed({ model, value: 'hello', ...unknownSettings });
		const fragment: unknown = Reflect.apply(create.Config, undefined, [unknownSettings]);
		const component = Reflect.apply(create.Embedder, undefined, [{ model, input: 'hello' }, fragment]) as ReturnType<typeof create.Embedder>;
		assert.deepEqual((await Reflect.apply(component.run, undefined, [unknownSettings])).embedding, native.embedding);
		await assert.rejects(async () => { await Reflect.apply(component.run, undefined, [{ inputSchema: z.object({}) }]); }, /Configuration-only/);
		let sent: unknown;
		const realtime = { specificationVersion: 'v4', provider: 'test', modelId: 'voice', doCreateClientSecret: async ({ sessionConfig }: { sessionConfig: unknown }) => {
			sent = sessionConfig; return { clientSecret: 'token' };
		} };
		const voice = Reflect.apply(create.VoiceSessionSetup.withTemplate, undefined, [{ model: realtime, instructions: '{{ name }}',
			context: { name: 'Ada' }, inputSchema: z.object({ name: z.string() }), filters: {}, renderOptions: {}, description: 'author only', futureSetting: 'configured' }]) as ReturnType<typeof create.VoiceSessionSetup>;
		await Reflect.apply(voice.run, undefined, [{ futureSetting: 'call' }]);
		assert.deepEqual(sent, { instructions: 'Ada', futureSetting: 'call' });
	});

	it('preserves native none and null values; omitted named fields need neither placeholder', async () => {
		const env = new AsyncEnvironment();
		assert.deepEqual(await env.renderScriptString('return [none, null]', {}), [null, null]);
		assert.equal(await env.renderTemplateString('{{ none == null }}', {}), 'true');
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const embed = create.Embedder({ model, input: 'configured' });
		assert.deepEqual(await create.Script({ script: 'return embed.run().embedding', context: { embed } })(), [10]);
	});
});
