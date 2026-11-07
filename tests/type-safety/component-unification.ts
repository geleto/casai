import { create, z } from 'casai';
import type { EmbeddingModel, Experimental_DecisionModel, Experimental_RealtimeModel, ImageModel, SpeechModel, RerankingModel } from 'ai';

declare const model: EmbeddingModel;
const inputSchema = z.object({ value: z.string().transform(Number) });
const context = { secret: 'private' };
const template = create.Template.asTool({ template: '{{ value }}', inputSchema, context });
const script = create.Script.asTool({ script: 'return value', schema: z.number(), inputSchema, context });
const embedder = create.Embedder.withTemplate.asTool({ model, input: '{{ value }}', inputSchema, context });

void template(undefined, { value: '1' });
void script(undefined, { value: '1' });
void embedder(undefined, { value: '1' });
void template.run({ template: undefined, context: { value: '1' } });
void script.run({ script: undefined, context: { value: '1' } });
void embedder.run({ input: undefined, context: { value: '1' } });
declare const source: string | undefined;
void template(source, { value: '1' });
void script(source, { value: '1' });
void embedder(source, { value: '1' });
const defaultTemplate = create.Template({ context: { value: '1' } }, template);
const defaultEmbedder = create.Embedder({ context: { value: '1' } }, embedder);
declare const sourceOrContext: string | { value: string } | undefined;
void defaultTemplate(sourceOrContext);
void defaultEmbedder(sourceOrContext);

interface Payload { value: string }
declare const payload: Payload;
void template('{{ value }}', payload);
void script('return value', payload);
void embedder('{{ value }}', payload);
interface PrivatePayload extends Payload { secret: string }
declare const privatePayload: PrivatePayload;
// @ts-expect-error Interface-typed context retains private-name checks after an authored source.
void defaultEmbedder('{{ value }}', privatePayload);
interface ExtraPayload extends Payload { extra: boolean }
declare const extraPayload: ExtraPayload;
// @ts-expect-error Interface-typed context retains closed input checks after an authored source.
void defaultEmbedder('{{ value }}', extraPayload);
declare const payloadUnion: Payload | PrivatePayload;
// @ts-expect-error Every possible interface-typed payload must respect private fields.
void defaultEmbedder('{{ value }}', payloadUnion);

declare const imageModel: ImageModel;
const imageTemplate = create.ImageGenerator.withTemplate.asTool({ model: imageModel, prompt: '{{ value }}', inputSchema, context: { value: '1', secret: 'private' } });
void imageTemplate({ text: '{{ value }}', images: [] }, payload);
// @ts-expect-error A complete source object does not hide private keys in the second argument.
void imageTemplate({ text: '{{ value }}', images: [] }, privatePayload);
// @ts-expect-error A complete source object does not hide undeclared keys in the second argument.
void imageTemplate({ text: '{{ value }}', images: [] }, extraPayload);

const callbackSchema = z.object({ factor: z.string(), map: z.custom<(value: number) => number>() });
const callbackEmbedder = create.Embedder.withTemplate({ model, input: '{{ map(factor) }}', inputSchema: callbackSchema, context: { factor: '3', secret: true } });
void callbackEmbedder({ map: value => value });
// @ts-expect-error Callback inference must not hide an explicit undefined public default.
void callbackEmbedder({ factor: undefined, map: value => value });
// @ts-expect-error Callback inference must not hide private fields.
void callbackEmbedder({ secret: false, map: value => value });

// @ts-expect-error A placeholder cannot hide a missing required application field.
void template(undefined);
// @ts-expect-error A placeholder cannot admit parsed output as raw input.
void script(undefined, { value: 1 });
// @ts-expect-error Forwarding preserves the private context boundary.
void template(undefined, { value: '1', secret: 'changed' });
// @ts-expect-error Forwarding preserves the closed tool contract.
void script(undefined, { value: '1', extra: true });
declare const mixed: { value: string } | { value: number };
// @ts-expect-error Every possible payload must satisfy the raw schema contract.
void template(undefined, mixed);
// @ts-expect-error Every possible payload must satisfy the raw schema contract.
void embedder(undefined, mixed);

const { config: templateConfig, run: templateRun } = template;
const { config: scriptConfig, run: scriptRun } = script;
const { config: embedderConfig, run: embedderRun } = embedder;
// @ts-expect-error Configuration handles have one readonly authoring contract.
template.config = templateConfig;
// @ts-expect-error Configuration handles have one readonly authoring contract.
script.config = scriptConfig;
// @ts-expect-error Configuration handles have one readonly authoring contract.
embedder.config = embedderConfig;
// @ts-expect-error Component methods are readonly across component families.
template.run = templateRun;
// @ts-expect-error Component methods are readonly across component families.
script.run = scriptRun;
// @ts-expect-error Component methods are readonly across component families.
embedder.run = embedderRun;

declare const decisionModel: Experimental_DecisionModel;
const decision = create.Decision({ model: decisionModel, questions: {} });
// @ts-expect-error Questions determine the configured result contract.
void decision.run({ state: 'state', questions: {} });
declare const voiceModel: Experimental_RealtimeModel;
const voice = create.VoiceSessionSetup({ model: voiceModel });
// @ts-expect-error The model is captured at component creation.
void voice.run({ model: voiceModel });
// @ts-expect-error Session configuration uses the same invocation policy.
void voice.prepareSessionConfig({ model: voiceModel });
// @ts-expect-error WebRTC setup uses the same invocation policy.
void voice.createWebRTCSession({ sdp: 'offer', model: voiceModel });

declare const rankingModel: RerankingModel;
const completeRanker = create.Reranker.withFunction({ model: rankingModel, query: () => ({ query: 'question', documents: ['owned'] }) });
void completeRanker(undefined, 1);
void completeRanker(1);
// @ts-expect-error A replacement query-only preparer still requires documents.
void completeRanker(() => 'replacement');
void completeRanker(() => 'replacement', ['documents']);
void completeRanker(undefined, ['competing']);

// Native literal inputs retain their SDK iterable contract, including arrays.
declare const streamingSpeechModel: SpeechModel;
void create.StreamingSpeechGenerator({ model: streamingSpeechModel })(['one', 'two']);
