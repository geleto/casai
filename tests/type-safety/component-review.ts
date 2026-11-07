import { create, z } from 'casai';
import type { EmbeddingModel, ImageModel, RerankingModel, TranscriptionModel, SpeechModel, experimental_streamTranslate, Experimental_DecisionModel, Experimental_RealtimeModel } from 'ai';
import { expectEqual } from './assert.js';

declare const embedding: EmbeddingModel;
declare const ranking: RerankingModel;
declare const transcription: TranscriptionModel;
declare const speech: SpeechModel;
declare const translation: Parameters<typeof experimental_streamTranslate>[0]['model'];
declare const decision: Experimental_DecisionModel;
const format = { type: 'audio/pcm', rate: 24000 };
const audio = () => new ReadableStream<Uint8Array>();

// Empty children still complete and validate the inherited configuration.
// @ts-expect-error Missing model.
create.Embedder({});
// @ts-expect-error A fragment can omit the model, a completed component cannot.
create.Embedder({}, create.Config({ input: 'text' }));
// @ts-expect-error A raw configuration provider follows the same rule.
create.Embedder({}, { config: { input: 'text' } });
// @ts-expect-error Questions are fixed execution configuration.
create.Decision({}, create.Config({ model: decision }));
// @ts-expect-error Inherited settings must belong to the completed component.
create.Embedder({}, create.Config({ model: 'provider/model', temperature: 0.2 }));
const incompatible = { config: { model: embedding, promptType: 'function' as const,
	inputSchema: z.object({ value: z.string() }), input: ({ value }: { value: number }) => value.toFixed(2) } };
// @ts-expect-error Empty children must check inherited preparers against parsed input.
create.Embedder({}, incompatible);
// @ts-expect-error Nonempty children enforce the same contract.
create.Embedder({ debug: false }, incompatible);
void create.Embedder({}, create.Config({ model: embedding, input: 'text' }))();

// Object-shaped format arguments require a distinct context slot on prepared calls.
const transcribe = create.StreamingTranscriber.withFunction({ model: transcription, audio });
// @ts-expect-error One object is context, so this call lacks a format.
void transcribe(format);
// @ts-expect-error Undefined omits source; the next object is still context.
void transcribe(undefined, format);
void transcribe({}, format);
void transcribe(undefined, undefined, format);
void transcribe(audio, undefined, format);
void transcribe.run({ inputAudioFormat: format });
const translate = create.StreamingTranslator.withFunction({ model: translation, audio });
// @ts-expect-error A format cannot occupy the context slot.
void translate(format, 'fr');
void translate({}, format, 'fr');
void translate(undefined, undefined, format, 'fr');
const formatted = create.StreamingTranslator.withFunction({ model: translation, audio, inputAudioFormat: format });
void formatted('fr');
void formatted(undefined, 'fr');
const speak = create.SpeechGenerator.withFunction({ model: speech, text: () => 'hello' });
void speak('alloy');
void speak(undefined, 'alloy');
void speak({}, 'alloy');

// Completeness is a guarantee over every producer branch, on every entry path.
const mixed = { model: ranking, inputSchema: z.object({ paired: z.boolean() }),
	query: ({ paired }: { paired: boolean }) => paired ? { query: 'q', documents: ['a'] } : 'q' };
const rank = create.Reranker.withFunction(mixed);
// @ts-expect-error A string branch requires documents.
void rank({ paired: false });
// @ts-expect-error Named calls check the same branches.
void rank.run({ context: { paired: false } });
// @ts-expect-error A tool must be complete before it can be bound.
create.Reranker.withFunction.asTool(mixed);
void rank({ paired: false }, ['a']);
void rank.run({ context: { paired: false }, documents: ['a'] });
create.Reranker.withFunction.asTool({ ...mixed, documents: ['a'] });
const pair = create.Reranker.withFunction({ model: ranking, query: () => ({ query: 'q', documents: [{ title: 'a' }] }) });
const replacement = () => ({ query: 'q', documents: [{ replacement: 1 }] });
const _replaced = pair(replacement);
expectEqual<Awaited<typeof _replaced>['ranking'][number]['document'], { replacement: number }>();
void pair.run({ query: replacement });
// @ts-expect-error Replacing a complete producer with a string requires documents.
void pair(() => 'q');
const replaceMixed = () => Math.random() ? replacement() : 'q';
// @ts-expect-error Mixed replacement producers need documents too.
void pair(replaceMixed);
// @ts-expect-error Named replacement producers follow the same rule.
void pair.run({ query: replaceMixed });
void pair(replaceMixed, ['a']);
declare const optionalDocuments: string[] | undefined;
// @ts-expect-error Optional documents cannot guarantee the string branch's input.
void rank({ paired: true }, optionalDocuments);

// Native callbacks retain their runtime-context generic in direct and inherited calls.
const embed = create.Embedder({ model: embedding, runtimeContext: { requestId: 'r' },
	onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } });
create.Embedder({ onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } }, embed);
void embed.run({ input: 'x', onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } });
create.Reranker({ model: ranking, runtimeContext: { requestId: 'r' },
	onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } });
create.Decision({ model: decision, questions: {}, runtimeContext: { requestId: 'r' },
	onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } });

const fragment = create.Config({ promptType: 'function', inputSchema: z.object({ count: z.string().transform(Number) }),
	context: { prefix: 'private' }, input: ({ count, prefix }) => {
		expectEqual<typeof count, number>();
		expectEqual<typeof prefix, string>();
		return prefix + String(count);
	} });
void create.Embedder({ model: embedding }, fragment)({ count: '2' });
const inheritedFragment = create.Config({ input: ({ count }) => { expectEqual<typeof count, number>(); return String(count); } }, fragment);
void create.Embedder({ model: embedding }, inheritedFragment)({ count: '2' });

type EmbedEnd = NonNullable<Parameters<typeof import('ai').embedMany<{ requestId: string }>>[0]['onEnd']>;
const end: EmbedEnd = _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); };
const events = create.Config({ model: embedding, runtimeContext: { requestId: 'r' }, onEnd: end });
create.Embedder({}, events);
create.Embedder({ onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } }, events);
expectEqual<typeof events.config.onEnd, EmbedEnd>();
const neutral = create.Config({ onEnd: (_event: { unrelated: true }) => { /* A different event contract. */ } });
// @ts-expect-error The consuming component checks inherited callback contracts.
create.Embedder({ model: embedding }, neutral);
// @ts-expect-error An empty child must check inherited callbacks too.
create.Embedder({}, create.Config({ model: embedding }, neutral));
create.Embedder({ model: embedding, runtimeContext: { requestId: 'r' },
	onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } }, neutral);
const invalidEvents = create.Config({ model: embedding, runtimeContext: { requestId: 'r' }, onEnd: (_event: { unrelated: true }) => { /* A different event contract. */ } });
create.Embedder({ onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } }, invalidEvents);
declare const optionalEnd: { onEnd?: EmbedEnd };
// @ts-expect-error An optional override can retain the incompatible parent callback.
create.Embedder(optionalEnd, invalidEvents);
create.Embedder(optionalEnd, events);
declare const optionalRuntime: { runtimeContext?: { requestId: number } };
create.Embedder({ ...optionalRuntime, onEnd: _event => {
	expectEqual<typeof _event.runtimeContext.requestId, string | number>();
} }, create.Config({ model: embedding, runtimeContext: { requestId: 'r' } }));
const agentEvents = create.Config({ model: 'provider/model', runtimeContext: { requestId: 'r' }, onEnd: (_event: { unrelated: true }) => { /* A different event contract. */ } });
create.LLMAgent({ onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } }, agentEvents);
// @ts-expect-error An inherited callback must match its completed LLMAgent owner too.
create.LLMAgent({}, agentEvents);
// @ts-expect-error Owner-neutral fragments require SDK event parameter annotations.
create.Config({ onEnd: _event => { /* Requires an explicit event annotation. */ } });

// Configured bindings come from the final config, not the retained callback's old types.
const privateParent = create.Embedder.withFunction({ model: embedding, context: { prefix: 'old' }, input: ({ prefix }) => prefix.toUpperCase() });
// @ts-expect-error A retained inferred preparer still needs its private string.
create.Embedder({ context: { prefix: 42 } }, privateParent);
// @ts-expect-error Clearing a dependency cannot make the retained preparer valid.
create.Embedder({ context: { prefix: undefined } }, privateParent);
create.Embedder.withFunction({ context: { prefix: 42 }, input: ({ prefix }) => {
	expectEqual<typeof prefix, number>();
	const value: number = prefix;
	return value.toFixed(1);
} }, privateParent);
const privateFunction = create.Function({ context: { prefix: 'old' }, execute: ({ prefix }) => prefix.toUpperCase() });
// @ts-expect-error Function uses the same resolved execution context.
create.Function({ context: { prefix: undefined } }, privateFunction);
create.Function({ context: { prefix: 42 }, execute: ({ prefix }) => prefix.toFixed(1) }, privateFunction);
const privateAgent = create.LLMAgent.withFunction({ model: 'provider/model', context: { prefix: 'old' }, prompt: ({ prefix }) => prefix.toUpperCase() });
// @ts-expect-error LLMAgent checks the retained preparer's dependency too.
create.LLMAgent({ context: { prefix: 42 } }, privateAgent);
create.LLMAgent.withFunction({ context: { prefix: 42 }, prompt: ({ prefix }) => {
	expectEqual<typeof prefix, number>();
	const value: number = prefix;
	return value.toFixed(1);
} }, privateAgent);

// Same-mode alternatives retain ordinary replacement calls; explicit modifiers select a mode.
declare const sameMode: { model: EmbeddingModel; input: string } | { model: EmbeddingModel; input: string[] };
const combined = create.Embedder(sameMode);
void combined('replacement');
void combined(['replacement']);
void combined.run({ input: 'replacement' });
declare const modes: { model: EmbeddingModel; promptType: 'text'; input: string }
	| { model: EmbeddingModel; promptType: 'function'; input: () => string };
void create.Embedder.withFunction({ input: () => 'replacement' }, { config: modes })();
if (modes.promptType === 'text') void create.Embedder(modes)('replacement');

// Plain tools need a parsed native input or a configured fallback.
// @ts-expect-error Empty application input supplies no native embedding input.
create.Embedder.asTool({ model: embedding, inputSchema: z.object({}) });
// @ts-expect-error A schema-valid omission cannot supply required native input.
create.Embedder.asTool({ model: embedding, inputSchema: z.object({ input: z.string().optional() }) });
// @ts-expect-error A root transform may remove the native input field.
create.Embedder.asTool({ model: embedding, inputSchema: z.object({ input: z.string() }).transform(() => ({})) });
// @ts-expect-error Only a declared public input field selects the plain tool's operation input.
create.Embedder.asTool({ model: embedding, inputSchema: z.object({}).transform(() => ({ input: 'undeclared' })) });
create.Embedder.asTool({ model: embedding, input: 'fallback', inputSchema: z.object({ input: z.string().optional() }) });
const fixedTool = create.Embedder.asTool({ model: embedding, input: 'fallback', inputSchema: z.object({}) });
const _fixedResult = fixedTool.execute({}, { toolCallId: 'fixed', messages: [], context: undefined });
expectEqual<Awaited<typeof _fixedResult>, number[]>();
create.Embedder.asTool({ model: embedding, inputSchema: z.object({ input: z.string().default('fallback') }) });
create.Embedder.asTool({ model: embedding, context: { input: 'default' }, inputSchema: z.object({ input: z.string() }) });
// @ts-expect-error A fallback does not make a defined incompatible output native input.
create.Embedder.asTool({ model: embedding, input: 'fallback', inputSchema: z.object({ input: z.number().optional() }) });
declare const imageModel: ImageModel;
create.ImageGenerator.asTool({ model: imageModel, images: [new Uint8Array([1])], inputSchema: z.object({}) });
// @ts-expect-error An image tool without images or prompt has no source.
create.ImageGenerator.asTool({ model: imageModel, inputSchema: z.object({}) });
// @ts-expect-error Reranker still needs its query alongside configured documents.
create.Reranker.asTool({ model: ranking, documents: ['a'], inputSchema: z.object({ query: z.string().optional() }) });

// Native aliases have the same inference and owner-neutral fragment contract as canonical callbacks.
create.Embedder({ model: embedding, runtimeContext: { requestId: 'r' }, experimental_onEnd: _event => {
	expectEqual<typeof _event.runtimeContext.requestId, string>();
} });
create.Reranker({ model: ranking, runtimeContext: { requestId: 'r' }, experimental_onEnd: _event => {
	expectEqual<typeof _event.runtimeContext.requestId, string>();
} });
const aliasEvents = create.Config({ model: embedding, runtimeContext: { requestId: 'r' }, experimental_onEnd: end });
create.Embedder({}, aliasEvents);
create.Embedder({ experimental_onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } }, aliasEvents);
const invalidAlias = create.Config({ experimental_onEnd: (_event: { unrelated: true }) => { /* A different owner. */ } });
// @ts-expect-error Completed components validate alias callbacks too.
create.Embedder({ model: embedding }, invalidAlias);
// @ts-expect-error Owner-neutral aliases also need explicit parameter annotations in fragments.
create.Config({ experimental_onEnd: _event => { /* Requires an annotation. */ } });

// Validate retained native settings after merging; definite overrides replace the old value.
const imageFragment = create.Config({ model: imageModel });
void create.Embedder({ model: embedding, input: 'x' }, imageFragment)();
void create.LLMAgent({ model: 'provider/model', prompt: 'x' }, imageFragment)();
// @ts-expect-error LLMAgent also checks retained native settings after merging.
create.LLMAgent({ prompt: 'x' }, imageFragment);
// @ts-expect-error An unchanged image model cannot execute embeddings.
create.Embedder({ input: 'x' }, imageFragment);
declare const optionalModel: { model?: EmbeddingModel };
// @ts-expect-error Optional replacement may leave the incompatible parent model.
create.Embedder({ ...optionalModel, input: 'x' }, imageFragment);
const incompatibleRetries = { config: { model: embedding, maxRetries: 'many' } };
create.Embedder({ maxRetries: 2, input: 'x' }, incompatibleRetries);
// @ts-expect-error Every retained native setting must match its owner.
create.Embedder({ input: 'x' }, incompatibleRetries);
const incompatibleAgentRetries = { config: { model: 'provider/model', maxRetries: 'many' } };
create.LLMAgent({ maxRetries: 2, prompt: 'x' }, incompatibleAgentRetries);
// @ts-expect-error Optional native settings must also be checked after the merge.
create.LLMAgent({ prompt: 'x' }, incompatibleAgentRetries);

// Each component-owned preparer retains the helper contract it was typed with.
const lookup = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: ({ value }) => value });
const helperDefaults = { tools: { lookup }, toolsContext: { lookup: { value: 3 } } };
const helperEmbedder = create.Embedder.withFunction({ ...helperDefaults, model: embedding, input: async ({ lookup }) => String(await lookup({})) });
void helperEmbedder.run({ toolsContext: { lookup: { value: 4 } } });
// @ts-expect-error Replacing this entry removes a default used by the preparer.
void helperEmbedder.run({ toolsContext: { lookup: {} } });
const helperRanker = create.Reranker.withFunction({ ...helperDefaults, model: ranking, documents: ['doc'], query: async ({ lookup }) => String(await lookup({})) });
void helperRanker.run({ toolsContext: { lookup: { value: 4 } } });
// @ts-expect-error Query preparers rely on the same helper guarantee.
void helperRanker.run({ toolsContext: { lookup: {} } });
const helperTranscriber = create.Transcriber.withFunction({ ...helperDefaults, model: transcription, audio: async ({ lookup }) => new Uint8Array([await lookup({})]) });
void helperTranscriber.run({ toolsContext: { lookup: { value: 4 } } });
// @ts-expect-error Audio preparers rely on the same helper guarantee.
void helperTranscriber.run({ toolsContext: { lookup: {} } });
const helperSpeech = create.SpeechGenerator.withFunction({ ...helperDefaults, model: speech, text: async ({ lookup }) => String(await lookup({})) });
void helperSpeech.run({ toolsContext: { lookup: { value: 4 } } });
// @ts-expect-error Text preparers rely on the same helper guarantee.
void helperSpeech.run({ toolsContext: { lookup: {} } });
const helperDecision = create.Decision.withFunction({ ...helperDefaults, model: decision, questions: {}, state: async ({ lookup }) => String(await lookup({})) });
void helperDecision.run({ toolsContext: { lookup: { value: 4 } } });
// @ts-expect-error State preparers rely on the same helper guarantee.
void helperDecision.run({ toolsContext: { lookup: {} } });
declare const realtime: Experimental_RealtimeModel;
const helperSession = create.VoiceSessionSetup.withFunction({ ...helperDefaults, model: realtime, instructions: async ({ lookup }) => String(await lookup({})) });
void helperSession.run({ toolsContext: { lookup: { value: 4 } } });
// @ts-expect-error Instruction preparers rely on the same helper guarantee.
void helperSession.run({ toolsContext: { lookup: {} } });

// Tool-only execution checks bindings, independently of the session's source/preparer.
void helperSession.executeTool({ toolCallId: 'call', toolName: 'lookup', args: { value: 4 } }, { toolsContext: { lookup: {} } });
const dependency = create.Function.asTool({ inputSchema: z.object({}), context: { db: (): string => 'safe' }, execute: ({ db }) => db() });
const toolSession = create.VoiceSessionSetup.withTemplate({ model: realtime, instructions: 'Help {{ company }}',
	inputSchema: z.object({ company: z.string() }), tools: { dependency } });
const toolCall = { toolCallId: 'call', toolName: 'dependency' as const, args: {} };
void toolSession.executeTool(toolCall);
void toolSession.executeTool(toolCall, undefined);
void toolSession.executeTool(toolCall, { abortSignal: new AbortController().signal });
void toolSession.executeTool(toolCall, { toolsContext: { dependency: { db: () => 'replacement' } } });
// @ts-expect-error A binding must preserve the tool's implementation dependencies.
void toolSession.executeTool(toolCall, { toolsContext: { dependency: { db: 'invalid' } } });
// @ts-expect-error The same replacement is invalid on the ordinary run path.
void toolSession.run({ context: { company: 'Acme' }, toolsContext: { dependency: { db: 'invalid' } } });
// @ts-expect-error Explicit binding enforces the same implementation contract.
dependency.bindToolContext({ db: 'invalid' });
declare const toolReplacement: { db: () => string } | { db: string };
// @ts-expect-error Every possible binding must preserve the implementation contract.
void toolSession.executeTool(toolCall, { toolsContext: { dependency: toolReplacement } });
const extraToolContext = { toolsContext: { dependency: { db: () => 'replacement' }, typo: {} } };
// @ts-expect-error Registry entry names are checked for variables too.
void toolSession.executeTool(toolCall, extraToolContext);

// Configuration clears sources/callbacks with undefined in either optional-property mode.
const sourceParent = create.Embedder({ model: embedding, input: 'configured', onEnd: () => undefined });
const clearedSource = create.Embedder({ input: undefined, onEnd: undefined }, sourceParent);
void clearedSource('replacement');
void clearedSource.run({ input: 'replacement' });
// @ts-expect-error A cleared source must be supplied at invocation.
void clearedSource();
create.Embedder({ model: embedding, input: undefined, experimental_onEnd: undefined });
create.Embedder.withText({ input: undefined }, sourceParent);
create.Embedder.withTemplate({ model: embedding, input: undefined });
create.ImageGenerator({ model: imageModel, prompt: undefined });
create.Reranker({ model: ranking, query: undefined });
const preparedSource = create.Embedder.withFunction({ model: embedding, input: () => 'configured' });
const clearedPreparer = create.Embedder.withFunction({ input: undefined }, preparedSource);
void clearedPreparer(() => 'replacement');
// @ts-expect-error A cleared preparer must be supplied at invocation.
void clearedPreparer();
// @ts-expect-error Defined sources must retain their native type.
create.Embedder({ model: embedding, input: 42 });
// @ts-expect-error Prepared tools still require a configured preparer.
create.Embedder.withFunction.asTool({ model: embedding, inputSchema: z.object({}), input: undefined });
