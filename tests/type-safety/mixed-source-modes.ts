import { create, z } from 'casai';
import type { LLMAgentConfig } from 'casai';
import type { EmbedResult, EmbeddingModel, ImageModel, LanguageModel, ModelMessage, RerankingModel, SpeechModel, TranscriptionModel, Experimental_RealtimeModel } from 'ai';
import { expectEqual, type EmptyMap } from './assert.js';

declare const model: LanguageModel;
declare const speech: SpeechModel;
declare const transcription: TranscriptionModel;
declare const history: ModelMessage[];
declare const sourceModes: { model: EmbeddingModel; promptType: 'text'; input: string }
	| { model: EmbeddingModel; promptType: 'function'; input: () => string };

const mixed = create.Embedder(sourceModes);
const _configured = mixed();
expectEqual<Awaited<typeof _configured>, EmbedResult>();
const _omitted = mixed(undefined);
expectEqual<Awaited<typeof _omitted>, EmbedResult>();
void mixed.run();
void mixed.run({});
const _namedOmission = mixed.run({ input: undefined, headers: { 'x-trace': 'test' } });
expectEqual<Awaited<typeof _namedOmission>, EmbedResult>();
// @ts-expect-error Strings cannot replace a function source.
void mixed('replacement');
// @ts-expect-error Functions cannot replace a literal source.
void mixed(() => 'replacement');
// @ts-expect-error Arrays are literal inputs, not preparation context.
void mixed(['replacement']);
// @ts-expect-error Named overrides follow the same source contracts.
void mixed.run({ input: 'replacement' });
declare const replacement: string | (() => string);
// @ts-expect-error A union-valued argument must work in every source mode too.
void mixed(replacement);
// @ts-expect-error Context is not positional payload on the literal branch.
void mixed({});

const _toolInput = z.object({ input: z.string().transform(value => value.toUpperCase()) });
declare const toolModes: { model: EmbeddingModel; promptType: 'text'; input: string; inputSchema: typeof _toolInput }
	| { model: EmbeddingModel; promptType: 'function'; input: (context: { input: string }) => string; inputSchema: typeof _toolInput };
const mixedTool = create.Embedder.asTool(toolModes);
expectEqual<Awaited<ReturnType<typeof mixedTool.execute>>, number[]>();
void mixedTool.run({ context: { input: 'value' } });
void mixedTool.execute({ input: 'parsed' }, { toolCallId: 'test', messages: [], context: undefined });
create.Function({ tools: { mixedTool }, execute: ({ mixedTool }) => mixedTool({ input: 'value' }) });
// @ts-expect-error Tool payload remains required on ordinary named calls.
void mixedTool.run({});
// Plain and prepared tools both accept their application payload.
void mixedTool({ input: 'value' });

declare const sameMode: { model: EmbeddingModel; input: string } | { model: EmbeddingModel; input: string[] };
const literal = create.Embedder(sameMode);
void literal('replacement');
void literal(['replacement']);
void literal.run({ input: 'replacement' });

// A mode property can itself be a union, including an omitted mode's default.
declare const stringModes: { model: EmbeddingModel; promptType: 'text' | 'async-template'; input: string };
const rendered = create.Embedder(stringModes);
void rendered();
void rendered('replacement');
void rendered.run({ input: 'replacement' });
void rendered.run({ headers: {} });
declare const optionalMode: { model: EmbeddingModel; promptType?: 'async-template'; input: string };
const optional = create.Embedder(optionalMode);
expectEqual<typeof optional.config.promptType, 'text' | 'async-template'>();
void optional();
void optional('replacement');
// @ts-expect-error An omitted mode defaults to literal input and cannot consume positional context.
void optional({});
declare const optionalFunction: { model: EmbeddingModel; promptType?: 'function' };
const unresolved = create.Embedder(optionalFunction);
// @ts-expect-error This is a literal source on one possible branch only.
void unresolved('replacement');
// @ts-expect-error This is a function source on one possible branch only.
void unresolved(() => 'replacement');

declare const unpaired: { model: EmbeddingModel; promptType: 'text' | 'function'; input: string | (() => string) };
// @ts-expect-error Independent field unions do not guarantee a source compatible with the chosen mode.
create.Embedder(unpaired);
declare const invalidBranch: { model: EmbeddingModel; promptType: 'text'; input: string }
	| { model: EmbeddingModel; promptType: 'function'; input: string };
// @ts-expect-error A valid literal branch cannot conceal a malformed function branch.
create.Embedder(invalidBranch);
const _loader = { load: (name: string) => name };
declare const loaded: { model: EmbeddingModel; promptType: 'text'; input: string }
	| { model: EmbeddingModel; promptType: 'text-name'; input: string; loader: typeof _loader };
const loading = create.Embedder(loaded);
void loading();
void loading('source');
void loading.run({ input: 'source' });
declare const partialModes: { model: EmbeddingModel; promptType: 'text' }
	| { model: EmbeddingModel; promptType: 'function'; input: () => string };
const partial = create.Embedder(partialModes);
// @ts-expect-error Only one possible branch has a configured source.
void partial();
// @ts-expect-error Named omission needs a source on every branch too.
void partial.run({});

// Explicit modifiers select one mode, including when inheriting a mixed-mode parent.
void create.Embedder.withFunction({ input: () => 'replacement' }, { config: sourceModes })();
void create.Embedder.withText({ input: 'replacement' }, { config: sourceModes })();
if (sourceModes.promptType === 'text') void create.Embedder(sourceModes)('replacement');

declare const agentModes: { model: LanguageModel; promptType: 'text'; prompt: string }
	| { model: LanguageModel; promptType: 'function'; prompt: () => string };
const agent = create.LLMAgent(agentModes);
void agent();
void agent(history);
void agent(undefined);
void agent({}, history);
void agent(undefined, {}, history);
void agent.run();
void agent.run({});
void agent.run({ messageHistory: history, headers: {} });
void agent.resume(history);
void agent.generate({ prompt: 'Native calls bypass source rendering.' });
// @ts-expect-error A string is not an authored function source on every branch.
void agent('replacement');
// @ts-expect-error A function is not a literal prompt on every branch.
void agent(() => 'replacement');
// @ts-expect-error Named sources must also work in every possible mode.
void agent.run({ prompt: 'replacement' });
declare const invalidAgent: { model: LanguageModel; promptType: 'text'; prompt: string }
	| { model: LanguageModel; promptType: 'function'; prompt: string };
// @ts-expect-error LLMAgent checks each configured source against its own mode too.
create.LLMAgent(invalidAgent);
declare const agentLoaded: { model: LanguageModel; promptType: 'text'; prompt: string }
	| { model: LanguageModel; promptType: 'text-name'; prompt: string; loader: typeof _loader };
void create.LLMAgent(agentLoaded)('source');
declare const agentStrings: { model: LanguageModel; promptType: 'text' | 'async-template'; prompt: string };
const stringAgent = create.LLMAgent(agentStrings);
void stringAgent('replacement');
void stringAgent('replacement', {}, history);
void stringAgent.run({ prompt: 'replacement', messageHistory: history });
const annotated: LLMAgentConfig<EmptyMap, EmptyMap, () => string> = { model, promptType: 'function', prompt: () => 'ready' };
void create.LLMAgent(annotated)(() => 'replacement');
const annotatedLiteral: LLMAgentConfig<EmptyMap, EmptyMap, string> = { model, prompt: 'ready' };
void create.LLMAgent(annotatedLiteral)('replacement');

const _input = z.object({ name: z.string() });
declare const schemaModes: { model: EmbeddingModel; promptType: 'text'; input: string; inputSchema: typeof _input }
	| { model: EmbeddingModel; promptType: 'async-template'; input: string; inputSchema: typeof _input };
const withContext = create.Embedder(schemaModes);
void withContext.run({ context: { name: 'Ada' } });
// @ts-expect-error Required context must be present regardless of the selected mode.
void withContext.run({});
// @ts-expect-error Literal shorthand cannot carry required context.
void withContext({ name: 'Ada' });
const _callbacks = z.object({ factor: z.number(), map: z.custom<(value: number) => number>() });
declare const preparedModes: { model: EmbeddingModel; promptType: 'async-template' | 'async-script'; input: string; inputSchema: typeof _callbacks; context: { factor: number } };
const prepared = create.Embedder(preparedModes);
void prepared({ map: value => { expectEqual<typeof value, number>(); return value * 2; } });
void prepared.run({ context: { map: value => { expectEqual<typeof value, number>(); return value * 2; } } });

declare const rankModes: { model: RerankingModel; promptType: 'text'; query: string; documents: string[] }
	| { model: RerankingModel; promptType: 'function'; query: () => { query: string; documents: { id: number }[] } };
const rank = create.Reranker(rankModes);
const _ranked = rank();
expectEqual<Awaited<typeof _ranked>['ranking'][number]['document'], string | { id: number }>();
void rank.run({});
void rank(['replacement'], 1);
void rank.run({ documents: ['replacement'], topN: 1 });
// @ts-expect-error A string cannot replace the query preparer.
void rank('replacement');

declare const imageModes: { model: ImageModel; promptType: 'text'; images: Uint8Array[] }
	| { model: ImageModel; promptType: 'function'; prompt: () => string; images: Uint8Array[] };
const draw = create.ImageGenerator(imageModes);
void draw();
void draw(2);
void draw(new Uint8Array([1]));
void draw(undefined, new Uint8Array([1]));
void draw([new Uint8Array([1])]);
void draw.run({ mask: new Uint8Array([1]) });
void draw.run({ images: [new Uint8Array([1])], n: 2 });
// A string is text on the literal branch and a mask on the prepared branch.
void draw('mask.png');
// @ts-expect-error Named prompt is always a source replacement, never a mask.
void draw.run({ prompt: 'replacement' });
const _media = z.object({ text: z.string(), images: z.array(z.instanceof(Uint8Array)) });
declare const imageContextModes: { model: ImageModel; promptType: 'text'; context: { text: string } }
	| { model: ImageModel; promptType: 'async-template'; prompt: string; inputSchema: typeof _media };
// This object is authored source in the literal branch and declared public context in the template branch.
void create.ImageGenerator(imageContextModes)({ text: 'new', images: [new Uint8Array([1])] });

declare const voiceModes: { model: SpeechModel; promptType: 'text'; text: string }
	| { model: SpeechModel; promptType: 'function'; text: () => string };
const speak = create.SpeechGenerator(voiceModes);
void speak();
// A single string is text on the literal branch and voice on the function branch; both calls are valid.
void speak('alloy');
void speak.run({ voice: 'alloy' });
// @ts-expect-error Named text always means source and cannot replace the function.
void speak.run({ text: 'alloy' });

interface AudioFormat { type: string; rate: number }
declare const audioModes: { model: TranscriptionModel; promptType: 'text'; audio: ReadableStream<Uint8Array>; inputAudioFormat: AudioFormat }
	| { model: TranscriptionModel; promptType: 'function'; audio: () => ReadableStream<Uint8Array>; inputAudioFormat: AudioFormat };
const transcribe = create.StreamingTranscriber(audioModes);
void transcribe();
void transcribe.run({ inputAudioFormat: { type: 'audio/pcm', rate: 24000 } });
// @ts-expect-error Audio streams cannot replace a function preparer.
void transcribe(new ReadableStream<Uint8Array>());

declare const recordedModes: { model: TranscriptionModel; promptType: 'text'; audio: URL }
	| { model: TranscriptionModel; promptType: 'function'; audio: () => URL };
const recorded = create.Transcriber(recordedModes);
void recorded();
// @ts-expect-error Native URLs cannot become preparation context.
void recorded(new URL('https://example.test/audio'));
void create.Transcriber({ model: transcription })(new URL('https://example.test/audio'));
declare const speechModes: { model: SpeechModel; promptType: 'text'; text: string }
	| { model: SpeechModel; promptType: 'function'; text: () => string };
const liveSpeech = create.StreamingSpeechGenerator(speechModes);
void liveSpeech();
// @ts-expect-error Native text generators cannot become preparation context.
void liveSpeech((function* () { yield 'hello'; })());
// @ts-expect-error Native async text generators cannot become preparation context.
void liveSpeech((async function* () { yield 'hello'; })());
void create.StreamingSpeechGenerator({ model: speech })((function* () { yield 'hello'; })());
void create.StreamingSpeechGenerator({ model: speech })((async function* () { yield 'hello'; })());

declare const sessions: { model: Experimental_RealtimeModel; promptType: 'text' }
	| { model: Experimental_RealtimeModel; promptType: 'function'; instructions: () => string };
const session = create.VoiceSessionSetup(sessions);
void session();
void session.run({});
void session.prepareSessionConfig({ voice: 'alloy' });
void session.createWebRTCSession({ sdp: 'offer', voice: 'alloy' });
// @ts-expect-error Session helper methods use the same source rules as run().
void session.prepareSessionConfig({ instructions: 'replacement' });
// @ts-expect-error WebRTC setup cannot replace the instructions preparer with text either.
void session.createWebRTCSession({ sdp: 'offer', instructions: 'replacement' });

// Renderer requirements belong to each branch, even when the source types coincide.
declare const templateOptions: { promptType: 'async-template'; template: string }
	| { promptType: 'async-template-name'; loader: typeof _loader };
declare const scriptOptions: { promptType: 'async-script'; script: string }
	| { promptType: 'async-script-name'; loader: typeof _loader };
void create.Template(templateOptions)('entry');
void create.Script(scriptOptions)('entry');
// @ts-expect-error A loaded branch still needs its unresolved source.
void create.Template(templateOptions)();
// @ts-expect-error A loaded branch still needs its unresolved source.
void create.Script(scriptOptions)();
declare const completeTemplates: { promptType: 'async-template'; template: string }
	| { promptType: 'async-template-name'; template: string; loader: typeof _loader };
declare const completeScripts: { promptType: 'async-script'; script: string }
	| { promptType: 'async-script-name'; script: string; loader: typeof _loader };
void create.Template(completeTemplates)();
void create.Script(completeScripts)();
declare const missingLoader: { promptType: 'async-template'; template: string }
	| { promptType: 'async-template-name'; template: string };
// @ts-expect-error Checking branches separately must retain the loaded branch's requirement.
create.Template(missingLoader);
