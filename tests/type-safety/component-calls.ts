import { sourceModes } from '../fixtures/source-modes.js';
import { create, z } from 'casai';
import type { EmbedResult, EmbedManyResult, Experimental_RealtimeModel } from 'ai';
import type { EmbeddingModelV4, ImageModelV4, RerankingModelV4, TranscriptionModelV4, SpeechModelV4 } from '@ai-sdk/provider';
import { expectEqual, expectType, type EmptyMap } from './assert.js';

declare const embeddings: EmbeddingModelV4;
declare const images: ImageModelV4;
declare const ranking: RerankingModelV4;
declare const transcription: TranscriptionModelV4;
declare const speech: SpeechModelV4;
declare const live: ReadableStream<Uint8Array>;
declare const unionInput: string | string[];
const format = { type: 'audio/pcm', rate: 24000 };

const embedder = create.Embedder({ model: embeddings });
expectType<Promise<EmbedResult>>(embedder('one'));
expectType<Promise<EmbedManyResult>>(embedder(['one', 'two']));
expectType<Promise<EmbedResult | EmbedManyResult>>(embedder(unionInput));
expectType<Promise<EmbedResult>>(embedder.run({ input: 'one' }));
expectType<Promise<EmbedManyResult>>(embedder.run({ input: ['one'], maxParallelCalls: 2 }));
// @ts-expect-error Input remains required.
void embedder();
// @ts-expect-error Input remains required on named calls.
void embedder.run();
// @ts-expect-error No native value/values operation aliases.
void embedder.run({ value: 'one' });
// @ts-expect-error Configuration needs a model.
create.Embedder({ input: 'one' });
const configured = create.Embedder({ model: embeddings, input: ['one'] });
expectType<Promise<EmbedManyResult>>(configured());
expectType<Promise<EmbedManyResult>>(configured.run());
const scalar = create.Embedder({ input: 'two' }, configured);
expectType<Promise<EmbedResult>>(scalar());
declare const optionalBatch: string[] | undefined;
const _optionalCall = scalar(optionalBatch);
const _optionalRun = scalar.run({ input: optionalBatch });
expectEqual<Awaited<typeof _optionalCall>, EmbedResult | EmbedManyResult>();
expectEqual<Awaited<typeof _optionalRun>, EmbedResult | EmbedManyResult>();
const prepared = create.Embedder.withFunction({ model: embeddings, context: { prefix: 'prefix' }, inputSchema: z.object({ count: z.string().transform(Number) }),
	input: ({ count, prefix, _toolOptions }) => {
		expectEqual<typeof count, number>();
		expectEqual<typeof prefix, string>();
		expectType<AbortSignal | undefined>(_toolOptions.abortSignal);
		return Array.from({ length: count }, () => prefix);
	} });
expectType<Promise<EmbedManyResult>>(prepared({ count: '2' }));
// @ts-expect-error Raw input is a string before transformation.
void prepared({ count: 2 });
// @ts-expect-error Required preparation context.
void prepared();
// @ts-expect-error Closed context rejects unrelated fields.
void prepared({ count: '2', extra: true });
// @ts-expect-error Private bindings cannot be replaced.
void prepared({ count: '2', prefix: 'stolen' });
const annotated = create.Embedder.withFunction({ model: embeddings, input: ({ count }: { count: number }) => Array.from({ length: count }, () => 'one') });
void annotated({ count: 2 });
// @ts-expect-error Annotated no-schema preparers still require their payload.
void annotated();
// @ts-expect-error Annotated no-schema preparers retain argument types.
void annotated({ count: '2' });
const privatePrepared = create.Embedder.withFunction({ model: embeddings, context: { prefix: 'configured' }, input: ({ prefix, _toolOptions }) => {
	expectEqual<typeof prefix, string>();
	expectType<AbortSignal | undefined>(_toolOptions.abortSignal);
	return prefix;
} });
void privatePrepared();
const defaultTemplate = create.Embedder.withTemplate({ model: embeddings, input: '{{ subject }}', inputSchema: z.object({ subject: z.string() }), context: { subject: 'default', password: 'secret' } });
declare const sourceOrContext: string | { subject: string };
declare const sourceOrAttack: string | { subject: string; password: string };
void defaultTemplate(sourceOrContext);
// @ts-expect-error Every branch must respect the private context boundary.
void defaultTemplate(sourceOrAttack);
const plainPayload = create.Embedder({ model: embeddings, input: 'authored', inputSchema: z.object({ input: z.string() }) });
void plainPayload.run({ context: { input: 'payload' } });
// @ts-expect-error Authored operation input is not a payload default.
void plainPayload('replacement source');
// @ts-expect-error A required payload is independent of source settings.
void plainPayload.run({ input: 'replacement source' });
const embedTool = create.Embedder.asTool({ model: embeddings, inputSchema: z.object({ input: z.string() }), toModelOutput: ({ output }) => {
	expectEqual<typeof output, number[]>();
	return { type: 'json', value: output };
} });
expectType<PromiseLike<number[]>>(embedTool.execute({ input: 'one' }, { toolCallId: 'id', messages: [], context: undefined }));
// @ts-expect-error Plain tools use the documented field name.
create.Embedder.asTool({ model: embeddings, inputSchema: z.object({ text: z.string() }) });
// @ts-expect-error Payload schemas must produce the native operation input type.
create.Embedder.asTool({ model: embeddings, inputSchema: z.object({ input: z.number() }) });
// @ts-expect-error A transformed field must still produce native input.
create.ImageGenerator.asTool({ model: images, inputSchema: z.object({ prompt: z.string().transform(Number) }) });
// @ts-expect-error A plain tool cannot publish provider settings.
create.ImageGenerator.asTool({ model: images, inputSchema: z.object({ prompt: z.string(), n: z.number() }) });

const reranker = create.Reranker({ model: ranking });
const _ranked = reranker('q', [{ title: 'document' }], 1);
expectEqual<Awaited<typeof _ranked>['ranking'][number]['document'], { title: string }>();
const defaultRanker = create.Reranker({ model: ranking, query: 'q', documents: [{ title: 'configured' }] });
expectType<Promise<import('ai').RerankResult<string>>>(defaultRanker(undefined, ['replacement']));
declare const forwardedRanking: [query: undefined, documents: string[], topN?: number];
expectType<Promise<import('ai').RerankResult<string>>>(defaultRanker(...forwardedRanking));
declare const optionalRanking: [query: undefined, documents?: string[], topN?: number];
const _optionalRanking = defaultRanker(...optionalRanking);
expectEqual<Awaited<typeof _optionalRanking>['ranking'][number]['document'], string | { title: string }>();
// @ts-expect-error An optional document slot can retain configured objects.
expectType<Promise<import('ai').RerankResult<string>>>(_optionalRanking);
declare const queryOrDocuments: string | string[];
const _queryOrDocuments = defaultRanker(queryOrDocuments);
expectEqual<Awaited<typeof _queryOrDocuments>['ranking'][number]['document'], string | { title: string }>();
const _optionalDocuments = defaultRanker.run({ documents: optionalBatch });
const _optionalPositionalDocuments = defaultRanker(undefined, optionalBatch);
expectEqual<Awaited<typeof _optionalDocuments>['ranking'][number]['document'], string | { title: string }>();
expectEqual<Awaited<typeof _optionalPositionalDocuments>['ranking'][number]['document'], string | { title: string }>();
// @ts-expect-error Missing documents.
void reranker('q');
const pair = create.Reranker.withFunction({ model: ranking, query: () => ({ query: 'q', documents: [{ title: 'doc' }] }) });
expectType<Promise<import('ai').RerankResult<string>>>(pair(undefined, undefined, ['replacement']));
declare const optionalPreparedRanking: [source: undefined, context?: EmptyMap, documents?: string[], topN?: number];
const _optionalPreparedRanking = pair(...optionalPreparedRanking);
expectEqual<Awaited<typeof _optionalPreparedRanking>['ranking'][number]['document'], string | { title: string }>();
void pair();
void pair.run({ query: () => 'override', documents: ['doc'] });
// @ts-expect-error A replacement query string needs documents.
void pair.run({ query: () => 'override' });
const queryFunction = create.Reranker.withFunction({ model: ranking, query: () => 'q' });
void queryFunction.run({ query: () => ({ query: 'q', documents: ['doc'] }) });
// @ts-expect-error A configured query string still needs documents.
void queryFunction.run();
void pair.run({ documents: ['different'] });
void pair({}, ['different']);
expectType<Promise<import('ai').RerankResult<string>>>(pair({}, ['different']));
expectType<Promise<import('ai').RerankResult<{ replacement: number }>>>(pair.run({ documents: [{ replacement: 1 }] }));
declare const optionalDocuments: string[] | undefined;
expectType<Promise<import('ai').RerankResult<string | { title: string }>>>(pair.run({ documents: optionalDocuments }));
const scriptPair = create.Reranker.withScript({ model: ranking, query: 'return {query: "q", documents: ["d"]}' });
void scriptPair();
void scriptPair.run();
create.Reranker.withScript.asTool({ model: ranking, inputSchema: z.object({}), query: 'return {query: "q", documents: ["d"]}' });
const query = create.Reranker.withTemplate({ model: ranking, query: 'q' });
void query(['doc']);
void query('q {{ suffix }}', { suffix: 's' }, ['doc'], 1);

const image = create.ImageGenerator({ model: images });
void image('draw', 2);
void image(undefined, [new Uint8Array([1])], undefined, 2);
void image([new Uint8Array([1])]);
void image.run({ images: [new Uint8Array([1])] });
void create.ImageGenerator({ model: images, images: [new Uint8Array([1])] })();
// @ts-expect-error Required image input.
void image();
const complete = create.ImageGenerator.withFunction({ model: images, prompt: () => ({ images: [new Uint8Array([1])] }) });
void complete();
void complete.run({ prompt: () => 'override', images: [] });
void image.run({ prompt: { images: [] }, images: [] });
void complete.run({ images: [] });
const template = create.ImageGenerator.withTemplate({ model: images, prompt: { text: '{{ subject }}', images: [] }, inputSchema: z.object({ subject: z.string() }) });
const mask = new Uint8Array([1]);
const masked = create.ImageGenerator.withFunction({ model: images, images: [mask], context: { privateKey: 'secret' },
	inputSchema: z.object({ subject: z.string().default('configured') }), prompt: ({ subject }) => subject });
void masked(mask);
void masked(mask.buffer);
declare const binaryMask: Uint8Array | ArrayBuffer;
void masked(binaryMask);
void create.ImageGenerator({ model: images, prompt: 'configured', images: [mask] })(binaryMask);
void masked(undefined, mask);
void masked({ subject: 'tree' }, mask);
void masked(({ subject }) => subject, { subject: 'tree' }, mask);
void template({ subject: 'tree' }, mask);
// @ts-expect-error Media cannot satisfy required application context.
void template(mask);
// @ts-expect-error Media in the next slot must not hide undeclared context fields.
void masked({ subject: 'tree', extra: true }, mask);
// @ts-expect-error A mask cannot hide private-context replacement.
void masked({ subject: 'tree', privateKey: 'replacement' }, mask);
declare const maskOrContext: Uint8Array | { subject: string };
void masked(maskOrContext);
declare const maskOrPrivate: Uint8Array | { subject: string; privateKey: string };
// @ts-expect-error Every union branch must preserve private bindings.
void masked(maskOrPrivate);
const templateFragment = create.Config({}, template);
void create.ImageGenerator({}, templateFragment)({ subject: 'inherited' });
void create.ImageGenerator({}, create.Config({}, complete))();
void template({ subject: 'river' });
void template({ images: [], text: '{{ subject }}' }, { subject: 'bridge' });
// @ts-expect-error Required context stays required with an authored source override.
void template.run({ prompt: { images: [] } });
const fragments = create.Config({ images: [new Uint8Array([1])], mask: new Uint8Array([2]) });
const inherited = create.ImageGenerator({ model: images, prompt: 'draw', images: [] }, fragments);
expectType<Uint8Array>(inherited.config.mask);
const _cleared = create.ImageGenerator({ mask: undefined }, inherited);
expectEqual<typeof _cleared.config.mask, undefined>();

const liveTranscriber = create.StreamingTranscriber({ model: transcription });
void liveTranscriber(live, format);
void liveTranscriber.run({ audio: live, inputAudioFormat: format });
// @ts-expect-error Format is required.
void liveTranscriber(live);
// @ts-expect-error Audio is required.
void liveTranscriber.run({ inputAudioFormat: format });
// @ts-expect-error Plain live transcription has no tool modifier.
expectType<unknown>(create.StreamingTranscriber.asTool);
// @ts-expect-error Collected tools need configured format.
create.StreamingTranscriber.withFunction.asTool({ model: transcription, audio: () => live, inputSchema: z.object({}) });
const configuredLive = create.StreamingTranscriber({ model: transcription, audio: live });
void configuredLive(format);
void configuredLive(undefined, format);
const preparedLive = create.StreamingTranscriber.withFunction({ model: transcription, audio: () => live, inputAudioFormat: format });
void preparedLive();
const formatted = create.StreamingTranscriber.withFunction({ model: transcription, inputSchema: z.object({ name: z.string() }), audio: ({ name }) => { expectType<string>(name); return live; } });
void formatted({ name: 'recording' }, format);
// @ts-expect-error The format does not satisfy application context.
void formatted(format);
// @ts-expect-error Live speech has no collected-audio tool.
expectType<unknown>(create.StreamingSpeechGenerator.withFunction.asTool);
// @ts-expect-error Speech output format is named, not positional.
void create.SpeechGenerator({ model: speech })('hi', 'voice', 'mp3');
// @ts-expect-error Signals belong to invocations.
create.Transcriber({ model: transcription, abortSignal: new AbortController().signal });
// @ts-expect-error Inheritance cannot add a template mode to audio sources.
create.Transcriber({ model: transcription, ...sourceModes["async-template"].config, audio: 'template' });

declare const realtime: Experimental_RealtimeModel;
const voice = create.VoiceSessionSetup({ model: realtime });
void voice();
void voice.run({ voice: 'voice', turnDetection: null });
void voice.createWebRTCSession({ sdp: 'offer' });
void voice.prepareSessionConfig();
// @ts-expect-error No second token method.
expectType<unknown>(voice.createClientSecret);
// @ts-expect-error The native model owns relay credentials.
expectType<unknown>(voice.getServerWebSocketConfig);
// @ts-expect-error Instructions/tools/policy are configured server-side, with no raw envelope.
void voice.run({ sessionConfig: { tools: [] } });
