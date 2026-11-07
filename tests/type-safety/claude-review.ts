import { create, z } from 'casai';
import type { ComponentConfig } from 'casai';
import type { EmbeddingModel, ImageModel, LanguageModel, ModelMessage } from 'ai';
import { expectEqual } from './assert.js';

declare const embedding: EmbeddingModel;
declare const imageModel: ImageModel;
declare const languageModel: LanguageModel;
declare const uncheckedModel: any;

// A missing required setting and an unknown key must not cancel each other's diagnostics.
// @ts-expect-error Misspelled model.
create.Embedder({ modle: embedding });
// @ts-expect-error Missing model.
create.Embedder({});
// @ts-expect-error Unknown setting beside a valid model.
create.Embedder({ model: embedding, modle: embedding });
create.Embedder({ model: uncheckedModel });

declare const models: { [K in 'ImageGenerator' | 'Reranker' | 'Transcriber' | 'StreamingTranscriber' | 'SpeechGenerator' | 'StreamingSpeechGenerator' | 'StreamingTranslator' | 'VoiceSessionSetup' | 'Decision']: ComponentConfig<K>['model'] };
// @ts-expect-error Misspelled model.
create.ImageGenerator({ modle: models.ImageGenerator });
// @ts-expect-error Misspelled model.
create.Reranker({ modle: models.Reranker });
// @ts-expect-error Misspelled model.
create.Transcriber({ modle: models.Transcriber });
// @ts-expect-error Misspelled model.
create.StreamingTranscriber({ modle: models.StreamingTranscriber });
// @ts-expect-error Misspelled model.
create.SpeechGenerator({ modle: models.SpeechGenerator });
// @ts-expect-error Misspelled model.
create.StreamingSpeechGenerator({ modle: models.StreamingSpeechGenerator });
// @ts-expect-error Misspelled model.
create.StreamingTranslator({ modle: models.StreamingTranslator });
// @ts-expect-error Misspelled model.
create.VoiceSessionSetup({ modle: models.VoiceSessionSetup });
// @ts-expect-error Misspelled model; supplying another required setting must not hide it.
create.Decision({ modle: models.Decision, questions: { ready: { type: 'boolean' } } });

const agent = create.LLMAgent({ model: languageModel, prompt: 'configured' });

const payloadEmbed = create.Embedder.asTool({ model: embedding, context: { secret: 'private' },
	inputSchema: z.object({ input: z.string().transform(value => [value]) }) });
const _payloadResult = payloadEmbed({ input: 'hello' });
expectEqual<Awaited<typeof _payloadResult>, import('ai').EmbedManyResult>();
const _payloadRun = payloadEmbed.run({ context: { input: 'hello' } });
expectEqual<Awaited<typeof _payloadRun>, import('ai').EmbedManyResult>();
const _explicitSource = payloadEmbed.run({ input: 'literal', context: { input: 'hello' } });
expectEqual<Awaited<typeof _explicitSource>, import('ai').EmbedResult>();
const _positionalSource = payloadEmbed('literal', { input: 'hello' });
expectEqual<Awaited<typeof _positionalSource>, import('ai').EmbedResult>();
// @ts-expect-error Required payload remains required even with an authored source.
void payloadEmbed('literal');
// @ts-expect-error Payload uses schema input, not the transformed output.
void payloadEmbed({ input: ['hello'] });
// @ts-expect-error Private configured properties are not payload fields.
void payloadEmbed({ input: 'hello', secret: 'changed' });
const extraPayload = { input: 'hello', extra: true };
// @ts-expect-error Closed tools reject undeclared keys even in variables.
void payloadEmbed(extraPayload);
// @ts-expect-error Required payload cannot be omitted.
void payloadEmbed();
// @ts-expect-error Required payload cannot be omitted on named calls.
void payloadEmbed.run({});
const defaultPayload = create.Embedder.asTool({ model: embedding, context: { input: 'hello' }, inputSchema: z.object({ input: z.string().transform(value => [value]) }) });
expectEqual<Awaited<ReturnType<typeof defaultPayload>>, import('ai').EmbedResult | import('ai').EmbedManyResult>();
const _defaultResult = defaultPayload();
expectEqual<Awaited<typeof _defaultResult>, import('ai').EmbedManyResult>();
declare const maybeTool: true | undefined;
const optionalTool = create.Embedder({ model: embedding, asTool: maybeTool, input: 'configured', context: { input: 'payload' }, inputSchema: z.object({ input: z.string().transform(value => [value]) }) });
const _optionalToolResult = optionalTool();
expectEqual<Awaited<typeof _optionalToolResult>, import('ai').EmbedResult | import('ai').EmbedManyResult>();
const payloadImage = create.ImageGenerator.asTool({ model: imageModel, inputSchema: z.object({ prompt: z.string() }) });
void payloadImage({ prompt: 'cat' });
void payloadImage.run({ prompt: { text: 'authored', images: [] }, context: { prompt: 'payload' } });
// @ts-expect-error A plain tool object is payload; structured authored sources use run().
void payloadImage({ text: 'authored', images: [] });
const payloadAudio = create.Transcriber.asTool({ model: models.Transcriber, inputSchema: z.object({ audio: z.string() }) });
void payloadAudio({ audio: 'AQI=' });
void payloadAudio(new URL('https://example.com/audio.wav'), { audio: 'AQI=' });
declare const maybePrompt: string | undefined;
declare const maybeHistory: readonly ModelMessage[] | undefined;
void agent(maybePrompt);
void agent({}, maybeHistory);
void agent(maybePrompt, {}, maybeHistory);

const historyTemplate = create.LLMAgent.withTemplate({ model: languageModel, prompt: 'Configured' });
void historyTemplate(maybeHistory);
void historyTemplate([{ role: 'user', content: '{{ literal }}' }]);
declare const sourceOrHistory: string | readonly ModelMessage[];
declare const previousHistory: ModelMessage[];
void historyTemplate(sourceOrHistory);
void agent(sourceOrHistory);
void agent(maybeHistory);
void agent(previousHistory);
void agent.run({ prompt: previousHistory, messageHistory: previousHistory });
declare const invalidHistoryArguments: [readonly ModelMessage[]] | [readonly ModelMessage[], readonly ModelMessage[]];
// @ts-expect-error Every tuple alternative must be valid; rendered agents take one history.
void historyTemplate(...invalidHistoryArguments);
// @ts-expect-error A second history is not a context object on a rendered agent.
void historyTemplate(previousHistory, previousHistory);
// @ts-expect-error Plain agents also accept one positional history, never two arrays.
void agent(previousHistory, previousHistory);
// @ts-expect-error Plain-agent history cannot precede positional context.
void agent(previousHistory, { text: 'value' });
void historyTemplate('New {{ text }}', { text: 'value' }, maybeHistory);
void historyTemplate.run({ prompt: [{ role: 'user', content: '{{ text }}' }], context: { text: 'value' } });
// @ts-expect-error Positional arrays are history, so context must precede them.
void historyTemplate([{ role: 'user', content: '{{ text }}' }], { text: 'value' });
const historyOnly = create.LLMAgent.withTemplate({ model: languageModel });
void historyOnly([{ role: 'user', content: 'literal' }]);
// @ts-expect-error Without a configured prompt, some history or new source is required.
void historyOnly();
const historyPayload = create.LLMAgent.withTemplate({ model: languageModel, inputSchema: z.object({ value: z.string() }) });
void historyPayload({ value: 'payload' }, [{ role: 'user', content: 'literal' }]);
// @ts-expect-error History cannot satisfy required application payload fields.
void historyPayload([{ role: 'user', content: 'literal' }]);
const _reflectedAgent: Parameters<typeof agent> = ['hello'];
const requiredPrompt = create.LLMAgent({ model: languageModel });
void requiredPrompt(previousHistory);
void requiredPrompt({}, previousHistory);
const requiredPayload = create.LLMAgent({ model: languageModel, inputSchema: z.object({ value: z.string() }) });
void requiredPayload({ value: 'payload' }, previousHistory);
// @ts-expect-error History cannot satisfy the required application payload on a plain agent.
void requiredPayload(previousHistory);
// @ts-expect-error Undefined cannot replace a missing configured prompt.
void requiredPrompt(maybePrompt);

const image = create.ImageGenerator({ model: imageModel });
void image('cat', ['reference'], 2);
void image(undefined, ['reference'], 2);
void image(['reference'], 2);
void image('cat', ['reference'], 'mask', 2);
const preparedImage = create.ImageGenerator.withTemplate({ model: imageModel, prompt: '{{ subject }}', inputSchema: z.object({ subject: z.string() }) });
void preparedImage({ subject: 'cat' }, ['reference'], 2);
// @ts-expect-error A numeric count does not supply the required context.
void preparedImage(2);

function timed<Args extends any[], Result>(fn: (...args: Args) => Promise<Result>) {
	return (...args: Args) => fn(...args);
}
function identity<F extends (...args: any[]) => Promise<any>>(fn: F): F { return fn; }
const embedder = create.Embedder({ model: embedding });
const _reflected: Parameters<typeof embedder> = ['hello'];
void timed(embedder)('hello');
void identity(embedder)('hello');
// @ts-expect-error Reflection must not erase native input checking.
void timed(embedder)(3);
const prepared = create.Embedder.withFunction({ model: embedding, inputSchema: z.object({ name: z.string() }), input: ({ name }) => name });
void timed(prepared)({ name: 'Ada' });
void identity(prepared)({ name: 'Ada' });
// @ts-expect-error Wrapping must not erase configured schema requirements.
void identity(prepared)({});
const _stringEmbedding = embedder('text');
const _listEmbedding = embedder(['text']);
expectEqual<Awaited<typeof _stringEmbedding>, import('ai').EmbedResult>();
expectEqual<Awaited<typeof _listEmbedding>, import('ai').EmbedManyResult>();
