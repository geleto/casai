import { create, z, type Component, type ComponentConfig } from 'casai';
import { expectEqual, expectType } from './assert.js';

const inputSchema = z.object({ amount: z.string().transform(Number) });
const context = { amount: '2', secret: 'private' };
const fn = create.Function({ inputSchema, context, execute: input => input.amount });
const template = create.Template({ inputSchema, context, template: '{{ amount }}' });
const script = create.Script({ inputSchema, context, script: 'return amount', schema: z.number() });

// The same public lookup covers existing components without changing their inferred contracts.
expectEqual<Component<'Function', 'function', typeof fn.config>, typeof fn>();
declare const mappedTemplate: Component<'Template', 'async-template', typeof template.config>;
declare const mappedScript: Component<'Script', 'async-script', typeof script.config>;
expectType<typeof template>(mappedTemplate);
expectType<typeof mappedTemplate>(template);
expectType<typeof script>(mappedScript);
expectType<typeof mappedScript>(script);
interface AgentConfig { model: string; prompt: string }
declare const mappedAgent: Component<'LLMAgent', 'text', AgentConfig>;
expectType<Promise<string>>(mappedAgent().then(result => result.text));
void mappedAgent.generate({ prompt: 'Hello' });
void mappedAgent.stream({ messages: [] });
void mappedAgent.resume([]);

const tool = create.Function.asTool({ inputSchema, context, execute: input => input.amount });
expectEqual<Component<'Function', 'function', typeof tool.config, true>, typeof tool>();
void tool({ amount: '3' });
expectType<Promise<number>>(fn({ amount: '3' }));
// @ts-expect-error Application arguments retain their raw schema input type.
void fn({ amount: 3 });
declare const mappedFunction: Component<'Function', 'function', typeof fn.config>;
// @ts-expect-error Shared component types do not allow replacing private context.
void mappedFunction({ secret: 'replacement' });

expectType<ComponentConfig<'Function'>>({ execute: () => 1 });
expectType<ComponentConfig<'Template'>>({ template: 'Hello' });
expectType<ComponentConfig<'Script'>>({ script: 'return 1' });
expectType<ComponentConfig<'LLMAgent'>>({ model: 'provider/model', prompt: 'Hello' });
// @ts-expect-error Each definition keeps its own configuration contract.
expectType<ComponentConfig<'Template'>>({ prompt: 'Hello' });

// Ordinary annotations must remain consumable by their factories without implying tool mode.
declare const embedding: ComponentConfig<'Embedder'>['model'];
declare const image: ComponentConfig<'ImageGenerator'>['model'];
declare const ranking: ComponentConfig<'Reranker'>['model'];
declare const speech: ComponentConfig<'SpeechGenerator'>['model'];
declare const transcription: ComponentConfig<'Transcriber'>['model'];
declare const liveSpeech: ComponentConfig<'StreamingSpeechGenerator'>['model'];
declare const translation: ComponentConfig<'StreamingTranslator'>['model'];
declare const realtime: ComponentConfig<'VoiceSessionSetup'>['model'];
declare const decision: ComponentConfig<'Decision'>['model'];
const embeddingConfig: ComponentConfig<'Embedder'> = { model: embedding };
const imageConfig: ComponentConfig<'ImageGenerator'> = { model: image };
const rankingConfig: ComponentConfig<'Reranker'> = { model: ranking };
const speechConfig: ComponentConfig<'SpeechGenerator'> = { model: speech };
const transcriptionConfig: ComponentConfig<'Transcriber'> = { model: transcription };
const liveTranscriptionConfig: ComponentConfig<'StreamingTranscriber'> = { model: transcription };
const liveSpeechConfig: ComponentConfig<'StreamingSpeechGenerator'> = { model: liveSpeech };
const translationConfig: ComponentConfig<'StreamingTranslator'> = { model: translation };
const voiceConfig: ComponentConfig<'VoiceSessionSetup'> = { model: realtime };
const decisionConfig: ComponentConfig<'Decision'> = { model: decision, questions: {} };
create.Embedder(embeddingConfig);
create.ImageGenerator(imageConfig);
create.Reranker(rankingConfig);
create.SpeechGenerator(speechConfig);
create.Transcriber(transcriptionConfig);
create.StreamingTranscriber(liveTranscriptionConfig);
create.StreamingSpeechGenerator(liveSpeechConfig);
create.StreamingTranslator(translationConfig);
create.VoiceSessionSetup(voiceConfig);
create.Decision(decisionConfig);
// @ts-expect-error Ordinary annotations do not select tool mode.
expectType<ComponentConfig<'Embedder'>>({ model: embedding, asTool: true });
const embeddingTool = create.Embedder({ model: embedding, asTool: true, inputSchema: z.object({ input: z.string() }) });
expectType<PromiseLike<number[]>>(embeddingTool.execute({ input: 'text' }, { toolCallId: 'call', messages: [], context: undefined }));
// @ts-expect-error A factory selecting tool mode still needs its application schema.
create.Embedder({ model: embedding, asTool: true });
