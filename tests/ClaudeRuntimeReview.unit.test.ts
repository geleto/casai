import assert from 'node:assert/strict';
import { createOpenAI } from '@ai-sdk/openai';
import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';
import { MockEmbeddingModelV4, MockImageModelV4, MockRerankingModelV4, MockTranscriptionModelV4, convertArrayToReadableStream } from 'ai/test';
import { create, z, ConfigError, NotFoundError, ValidationError } from './cascada';
import { runtimeRun } from './fixtures/runtime-call.js';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const transcript = { text: 'hello', segments: [{ text: 'hello', startSecond: 0, endSecond: 1 }], language: 'en', durationInSeconds: 1 };
const response = { timestamp: new Date(0), modelId: 'fixture', headers: { 'set-cookie': 'server-secret', 'x-organization': 'private-organization' } };
const providerMetadata = { fixture: { secret: 'provider-private' } };

describe('component runtime review corrections', () => {
	it('exposes transcript application data to tools and keeps provider metadata on ordinary results', async () => {
		const model = new MockTranscriptionModelV4({ doGenerate: async () => ({ ...transcript, warnings: [], response, providerMetadata }) });
		const component = create.Transcriber.asTool({ model, inputSchema: z.object({ audio: z.string() }) });
		const result = await component.execute({ audio: 'AQI=' }, { toolCallId: 'transcript', messages: [], context: undefined });
		assert.deepEqual(result, transcript);
		assert.equal(JSON.stringify(result).includes('private'), false);
		const ordinary = await component.run({ audio: 'AQI=', context: { audio: 'AQI=' } });
		assert.deepEqual(ordinary.responses[0].headers, response.headers);
		assert.deepEqual(ordinary.providerMetadata, providerMetadata);
	});

	it('collects only transcript application fields from a single native streaming execution', async () => {
		let calls = 0;
		const model = new MockTranscriptionModelV4({ doStream: async () => {
			calls++;
			return { response, stream: convertArrayToReadableStream([{ type: 'finish', ...transcript, providerMetadata }]) };
		} });
		const audio = () => convertArrayToReadableStream([new Uint8Array([1, 2])]);
		const component = create.StreamingTranscriber.withFunction.asTool({ model, audio,
			inputAudioFormat: { type: 'audio/pcm', rate: 24000 }, inputSchema: z.object({}) });
		const result = await component.execute({}, { toolCallId: 'stream-transcript', messages: [], context: undefined });
		assert.deepEqual(result, transcript);
		const ordinary = await component();
		assert.deepEqual((await ordinary.responses)[0].headers, response.headers);
		assert.deepEqual(await ordinary.providerMetadata, providerMetadata);
		assert.equal(calls, 2);
	});

	it('uses the native tagged file representation for image tool output', async () => {
		const model = new MockImageModelV4({ doGenerate: async () => ({ images: [png], warnings: [], response }) });
		const image = create.ImageGenerator.asTool({ model, inputSchema: z.object({ prompt: z.string() }) });
		const output = await image.execute({ prompt: 'cat' }, { toolCallId: 'image', messages: [], context: undefined });
		assert.deepEqual(await image.toModelOutput?.({ output, input: { prompt: 'cat' }, toolCallId: 'image' }), {
			type: 'content', value: [{ type: 'file', data: { type: 'data', data: Buffer.from(png).toString('base64') }, mediaType: 'image/png' }],
		});
	});

	it('rejects separate non-array images without dropping them or dispatching a text-only request', async () => {
		let calls = 0;
		const model = new MockImageModelV4({ doGenerate: async () => { calls++; return { images: [png], warnings: [], response }; } });
		const image = create.ImageGenerator({ model, prompt: 'cat' });
		await assert.rejects(runtimeRun(image, { images: png }), ValidationError);
		const configured = Reflect.apply(create.ImageGenerator as unknown as (config: unknown) => unknown, undefined, [{ model, prompt: 'cat', images: png }]) as () => Promise<unknown>;
		await assert.rejects(configured(), ValidationError);
		assert.equal(calls, 0);
		await image.run({ images: [png] });
		await image.run({ images: [] });
		assert.equal(calls, 2);
	});

	it('retains fallback documents for a scripted query object and lets call documents win', async () => {
		const model = new MockRerankingModelV4({ doRerank: async () => ({ ranking: [{ index: 0, relevanceScore: 1 }], warnings: [] }) });
		const rank = create.Reranker.withScript({ model, query: 'return {query: "q"}', documents: ['configured'] });
		assert.equal((await rank()).ranking[0].document, 'configured');
		assert.equal((await rank.run({ documents: ['replacement'] })).ranking[0].document, 'replacement');
	});

	it('rejects voice registry errors through the promised executeTool result', async () => {
		const setup = create.VoiceSessionSetup({ model: createOpenAI({ apiKey: 'fixture' }).experimental_realtime('gpt-realtime') });
		let result: Promise<unknown> | undefined;
		assert.doesNotThrow(() => {
			result = Reflect.apply(setup.executeTool.bind(setup), setup, [{ toolCallId: 'call', toolName: 'missing', args: {} }, { toolsContext: { missing: {} } }]) as Promise<unknown>;
		});
		await assert.rejects(result!, ValidationError);
	});

	it('reports missing loaded sources as validation errors while retaining the native loader cause', async () => {
		const model = new MockEmbeddingModelV4();
		const embed = create.Embedder.loadsText({ model, loader: () => null, input: 'missing.txt' });
		await assert.rejects(embed(), (error: unknown) => {
			assert.ok(error instanceof ValidationError);
			assert.match(error.message, /^Failed to load source/);
			assert.ok(error.cause instanceof NotFoundError);
			return true;
		});
	});

	it('reuses input declarations selected during preparation instead of rediscovering them at dispatch', async () => {
		let declarations = 0;
		const inputSchema: StandardSchemaV1<{ input: string }, { input: string }> & StandardJSONSchemaV1 = { '~standard': {
			version: 1, vendor: 'fixture', validate: value => ({ value: value as { input: string } }),
			jsonSchema: { input: () => { declarations++; return { type: 'object', properties: { input: { type: 'string' } }, required: ['input'], additionalProperties: false }; }, output: () => ({}) },
		} };
		const model = new MockEmbeddingModelV4({ doEmbed: async () => ({ embeddings: [[1]], warnings: [] }) });
		const embed = create.Embedder.asTool({ model, inputSchema });
		assert.deepEqual(await embed.execute({ input: 'value' }, { toolCallId: 'embed', messages: [], context: undefined }), [1]);
		assert.equal(declarations, 1);
		const invalid = Reflect.apply(create.Embedder.asTool, undefined, [{ model, inputSchema: z.object({ custom: z.string() }) }]) as typeof embed;
		await assert.rejects(async () => { await invalid.execute({ input: 'value' }, { toolCallId: 'invalid', messages: [], context: undefined }); }, ConfigError);
	});
});
