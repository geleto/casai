import { create, z } from 'casai';
import { experimental_decide, experimental_streamSpeech } from 'ai';
import type { EmbeddingModel, Experimental_DecisionModel, Experimental_DecisionStatePart, RerankingModel, InferToolOutput, Experimental_RealtimeModel, LanguageModel, ModelMessage } from 'ai';
import { expectEqual } from './assert.js';

declare const model: Experimental_DecisionModel;
const questions = { route: { type: 'choice' as const, instructions: 'Route', criteria: { support: 'Help', billing: 'Pay' } } };
const parts = Object.freeze([{ type: 'text' as const, text: '{{ subject }}' }, { type: 'json' as const, value: { literal: '{{ unchanged }}' } }]);
void experimental_decide({ model, questions, state: parts });
const plain = create.Decision({ model, questions });
void plain(parts);
void plain.run({ state: parts });
const configured = create.Decision.withTemplate({ model, questions, state: parts });
void configured({ subject: 'configured' });
const template = create.Decision.withTemplate({ model, questions, state: 'default' });
void template(parts, { subject: 'replacement' });
void template.run({ state: parts, context: { subject: 'named' } });
declare const readonlyParts: readonly Experimental_DecisionStatePart[];
void template(readonlyParts, {});
void template.run({ state: readonlyParts });
void plain('state').then(_result => { expectEqual<typeof _result.answers.route.choice, 'support' | 'billing'>(); });
const protectedTemplate = create.Decision.withTemplate({ model, questions, state: parts,
	inputSchema: z.object({ subject: z.string() }), context: { secret: 'private' } });
void protectedTemplate(parts, { subject: 'valid' });
// @ts-expect-error A source does not supply required application context.
void protectedTemplate(parts);
// @ts-expect-error A source cannot hide replacement of private context.
void protectedTemplate(parts, { subject: 'value', secret: 'replacement' });
// @ts-expect-error Native text parts require a string.
void template([{ type: 'text', text: 42 }], {});
// @ts-expect-error Function sources do not replace template sources.
void template(() => 'text', {});

declare const speech: Parameters<typeof experimental_streamSpeech>[0]['model'];
declare const chunks: ReadableStream<string> | AsyncIterable<string> | Iterable<string>;
void experimental_streamSpeech({ model: speech, text: chunks });
const speak = create.StreamingSpeechGenerator({ model: speech });
void speak(chunks);
void speak.run({ text: chunks });
declare const streamOrArray: ReadableStream<string> | AsyncIterable<string> | string[];
void speak(streamOrArray);
const prepared = create.StreamingSpeechGenerator.withFunction({ model: speech, text: ({ subject }) => subject,
	inputSchema: z.object({ subject: z.string() }), context: { subject: 'default', secret: 'private' } });
void prepared(({ subject }) => subject, { subject: 'valid' });
// @ts-expect-error A native text stream is not preparation context or a function source.
void prepared(chunks);
declare const sourceOrContext: ((context: { subject: string }) => string) | { subject: string };
void prepared(sourceOrContext);
declare const sourceOrPrivateContext: ((context: { subject: string }) => string) | { subject: string; secret: string };
// @ts-expect-error Every possible context must preserve private bindings.
void prepared(sourceOrPrivateContext);

// A complete prepared bundle hides that branch's configured fallback documents.
declare const ranking: RerankingModel;
declare const rankedConfig:
	| { model: RerankingModel; promptType: 'function'; query: () => { query: string; documents: { prepared: boolean }[] }; documents: { ignored: boolean }[] }
	| { model: RerankingModel; promptType: 'function'; query: () => string; documents: { fallback: boolean }[] };
const rank = create.Reranker(rankedConfig);
const _ranked = rank();
expectEqual<Awaited<typeof _ranked>['ranking'][number]['document'], { prepared: boolean } | { fallback: boolean }>();
const _namedRanked = rank.run();
expectEqual<Awaited<typeof _namedRanked>['ranking'][number]['document'], { prepared: boolean } | { fallback: boolean }>();
const _omittedRanked = rank(undefined);
expectEqual<Awaited<typeof _omittedRanked>['ranking'][number]['document'], { prepared: boolean } | { fallback: boolean }>();
const _changedQuery = rank.run({ query: () => 'changed' });
expectEqual<Awaited<typeof _changedQuery>['ranking'][number]['document'], { ignored: boolean } | { fallback: boolean }>();
const replacements: { replacement: boolean }[] = [{ replacement: true }];
const _changedDocuments = rank.run({ documents: replacements });
expectEqual<Awaited<typeof _changedDocuments>['ranking'][number]['document'], { replacement: boolean }>();

const rankedTool = create.Reranker.withFunction.asTool({ inputSchema: z.object({}), toModelOutput: ({ output: _output }) => {
	expectEqual<typeof _output[number]['document'], { prepared: boolean } | { fallback: boolean }>();
	return { type: 'text', value: 'ranked' };
} }, { config: rankedConfig });
expectEqual<Awaited<ReturnType<typeof rankedTool.execute>>[number]['document'], { prepared: boolean } | { fallback: boolean }>();
expectEqual<InferToolOutput<typeof rankedTool>[number]['document'], { prepared: boolean } | { fallback: boolean }>();
create.Function({ tools: { rankedTool }, execute: async ({ rankedTool }) => {
	const result = await rankedTool({});
	expectEqual<typeof result[number]['document'], { prepared: boolean } | { fallback: boolean }>();
	return result;
} });

const fallbackDocuments: { configured: boolean }[] = [{ configured: true }];
const fixedRanker = create.Reranker.withFunction({ model: ranking, query: () => ({ query: 'fixed', documents: fallbackDocuments }) });
declare const runChoice: { query: () => { query: string; documents: { prepared: boolean }[] } } | { documents: { replacement: boolean }[] };
const _runChoice = fixedRanker.run(runChoice);
expectEqual<Awaited<typeof _runChoice>['ranking'][number]['document'], { prepared: boolean } | { replacement: boolean }>();

// An absent source override cannot introduce another mode's result into this branch.
declare const sourceModes:
	| { promptType: 'function'; query: () => { query: string; documents: { prepared: true }[] }; documents: { ignored: true }[] }
	| { promptType: 'async-template'; query: string; documents: { fallback: true }[] };
const mixedRanker = create.Reranker({ model: ranking }, { config: sourceModes });
const _mixedDefault = mixedRanker();
const _mixedRun = mixedRanker.run({});
const _mixedUndefined = mixedRanker.run({ query: undefined });
expectEqual<Awaited<typeof _mixedDefault>['ranking'][number]['document'], { prepared: true } | { fallback: true }>();
expectEqual<Awaited<typeof _mixedRun>['ranking'][number]['document'], { prepared: true } | { fallback: true }>();
expectEqual<Awaited<typeof _mixedUndefined>['ranking'][number]['document'], { prepared: true } | { fallback: true }>();

// A first array in a prepared Reranker call is documents, not a replacement preparer.
declare const optionalDocuments: string[] | undefined;
const _optionalFirst = fixedRanker(optionalDocuments);
expectEqual<Awaited<typeof _optionalFirst>['ranking'][number]['document'], string | { configured: boolean }>();
const _optionalAfterSource = fixedRanker(undefined, optionalDocuments);
expectEqual<Awaited<typeof _optionalAfterSource>['ranking'][number]['document'], string | { configured: boolean }>();
const _optionalNamed = fixedRanker.run({ documents: optionalDocuments });
expectEqual<Awaited<typeof _optionalNamed>['ranking'][number]['document'], string | { configured: boolean }>();
const _ordinaryTool = rankedTool(optionalDocuments);
expectEqual<Awaited<typeof _ordinaryTool>['ranking'][number]['document'], string | { prepared: boolean } | { fallback: boolean }>();

declare const embedding: EmbeddingModel;
declare const realtime: Experimental_RealtimeModel;
declare const toolMode: true | undefined;
const openInput = z.looseObject({ input: z.string() });
const closedInput = z.object({ input: z.string() });
create.Embedder({ model: embedding, input: 'fixed', inputSchema: openInput });
// @ts-expect-error Possible tool mode must enforce the closed root contract.
create.Embedder({ model: embedding, input: 'fixed', inputSchema: openInput, asTool: toolMode });
// @ts-expect-error Possible plain tool mode must produce native input.
create.Embedder({ model: embedding, input: 'fixed', inputSchema: z.object({ input: z.number() }), asTool: toolMode });
// @ts-expect-error Possible plain tool mode must use the native input field.
create.Embedder({ model: embedding, input: 'fixed', inputSchema: z.object({ custom: z.string() }), asTool: toolMode });
create.Embedder({ model: embedding, input: 'fixed', inputSchema: closedInput, asTool: toolMode });
// @ts-expect-error Live speech cannot become a tool on any branch.
create.StreamingSpeechGenerator({ model: speech, text: 'fixed', inputSchema: z.object({}), asTool: toolMode });
// @ts-expect-error Voice sessions cannot become a tool on any branch.
create.VoiceSessionSetup({ model: realtime, inputSchema: z.object({}), asTool: toolMode });
declare const inputChoice: { inputSchema: typeof openInput; asTool?: undefined } | { inputSchema: typeof closedInput; asTool: true };
create.Embedder({ model: embedding, input: 'fixed' }, { config: inputChoice });

const secretContext = z.object({ secret: z.string() });
const noInput = z.object({});
create.Embedder.withFunction({ model: embedding, inputSchema: noInput, toolContextSchema: secretContext, context: { secret: 1 }, input: ({ secret }) => {
	expectEqual<typeof secret, number>();
	return String(secret);
} });
create.Embedder.withFunction.asTool({ model: embedding, inputSchema: noInput, toolContextSchema: secretContext, context: { secret: 1 }, input: ({ secret }) => {
	expectEqual<typeof secret, number | string>();
	return String(secret);
} });
create.Embedder.withFunction({ asTool: true, model: embedding, inputSchema: noInput, toolContextSchema: secretContext, context: { secret: 1 }, input: ({ secret }) => {
	expectEqual<typeof secret, number | string>();
	return String(secret);
} });
const toolParent = create.Config({ asTool: true, model: embedding, inputSchema: noInput, toolContextSchema: secretContext, context: { secret: 1 } });
create.Embedder.withFunction({ input: ({ secret }) => {
	expectEqual<typeof secret, number | string>();
	// @ts-expect-error A bound tool invocation can supply a string.
	const _number: number = secret;
	return String(secret);
} }, toolParent);
create.Embedder.withFunction({ asTool: toolMode, model: embedding, inputSchema: noInput, toolContextSchema: secretContext, context: { secret: 1 }, input: ({ secret }) => {
	expectEqual<typeof secret, number | string>();
	return String(secret);
} });

// Invocation-only callbacks see ordinary context, including on a tool component.
const boundEmbedder = create.Embedder.withFunction.asTool({ model: embedding, inputSchema: noInput,
	toolContextSchema: secretContext, context: { secret: 1 }, input: ({ secret }) => String(secret) });
const ordinarySource = ({ secret }: { secret: number }) => secret.toFixed();
void boundEmbedder(ordinarySource);
void boundEmbedder.run({ input: ordinarySource });
void boundEmbedder(({ secret }) => {
	expectEqual<typeof secret, number>();
	return secret.toFixed();
});
void boundEmbedder.run({ input: ({ secret }) => {
	expectEqual<typeof secret, number>();
	return secret.toFixed();
} });
// @ts-expect-error Ordinary calls do not receive the bound tool context.
void boundEmbedder(({ secret }: { secret: string }) => secret.toUpperCase());
// @ts-expect-error A named replacement also receives the configured ordinary binding.
void boundEmbedder.run({ input: ({ secret }: { secret: string }) => secret.toUpperCase() });
// @ts-expect-error Stored preparers must still support bound tool execution.
create.Embedder.withFunction.asTool({ model: embedding, inputSchema: noInput, toolContextSchema: secretContext, context: { secret: 1 }, input: ordinarySource });
const boundRanker = create.Reranker.withFunction.asTool({ model: ranking, inputSchema: noInput,
	toolContextSchema: secretContext, context: { secret: 1 }, query: ({ secret }) => ({ query: String(secret), documents: ['configured'] }) });
const _replacementBundle = boundRanker(({ secret }: { secret: number }) => ({ query: secret.toFixed(), documents: [{ replacement: true }] }));
expectEqual<Awaited<typeof _replacementBundle>['ranking'][number]['document'], { replacement: boolean }>();
const _inferredBundle = boundRanker(({ secret }) => ({ query: secret.toFixed(), documents: [{ replacement: true }] }));
expectEqual<Awaited<typeof _inferredBundle>['ranking'][number]['document'], { replacement: true }>();
// @ts-expect-error A query-only replacement must still supply documents.
void boundRanker(({ secret }) => secret.toFixed());
declare const language: LanguageModel;
const boundAgent = create.LLMAgent.withFunction.asTool({ model: language, inputSchema: noInput,
	toolContextSchema: secretContext, context: { secret: 1 }, prompt: ({ secret }) => String(secret) });
void boundAgent(ordinarySource);
void boundAgent.run({ prompt: ordinarySource });
void boundAgent.run({
	prepareCall: (request, _config, { secret }) => {
		expectEqual<typeof secret, number>();
		secret.toFixed();
		return request;
	},
	prepareStep: (_step, _config, { secret }) => {
		expectEqual<typeof secret, number>();
		secret.toFixed();
		return {};
	},
});
// @ts-expect-error Bound context is absent on ordinary Agent calls.
void boundAgent(({ secret }: { secret: string }) => secret.toUpperCase());
// @ts-expect-error Bound context is absent from per-invocation Agent hooks.
void boundAgent.run({ prepareCall: (request, _config, _context: { secret: string }) => request });

const _booleanSecret = z.object({ secret: z.boolean() });
declare const secretChoice:
	| { model: EmbeddingModel; asTool?: undefined; inputSchema: typeof noInput; toolContextSchema: typeof _booleanSecret; context: { secret: number } }
	| { model: EmbeddingModel; asTool: true; inputSchema: typeof noInput; toolContextSchema: typeof secretContext; context: { secret: string } };
create.Embedder.withFunction({ input: ({ secret }) => {
	expectEqual<typeof secret, number | string>();
	return typeof secret === 'number' ? secret.toFixed() : secret.toUpperCase();
} }, { config: secretChoice });

// Enabled modes stay enabled when a child supplies undefined, even with conditional parents.
declare const possibleTool: { asTool: true | undefined };
declare const optionalTool: { asTool?: true };
const retainedTool = create.Config({ asTool: undefined }, { config: possibleTool });
expectEqual<typeof retainedTool.config.asTool, true | undefined>();
const _retainedOptionalTool = create.Config({ asTool: undefined }, { config: optionalTool });
expectEqual<typeof _retainedOptionalTool.config.asTool, true | undefined>();
// @ts-expect-error The inherited possible tool still requires an input schema.
create.Function({ execute: () => 1 }, retainedTool);
declare const streamingParent: { model: LanguageModel; prompt: string; streaming: true | undefined };
const retainedStreaming = create.Config({ streaming: undefined }, { config: streamingParent });
expectEqual<typeof retainedStreaming.config.streaming, true | undefined>();
void create.LLMAgent({}, retainedStreaming)().then(_result => {
	expectEqual<typeof _result.text, string | PromiseLike<string>>();
	expectEqual<typeof _result.messageHistory, ModelMessage[] | Promise<ModelMessage[]>>();
});
const _definiteTool = create.Config({ asTool: undefined }, create.Config({ asTool: true }));
expectEqual<typeof _definiteTool.config.asTool, true>();
const _definiteStream = create.Config({ streaming: undefined }, create.Config({ streaming: true }));
expectEqual<typeof _definiteStream.config.streaming, true>();
const _clearedInput = create.Config({ input: undefined }, create.Config({ input: 'clear' }));
expectEqual<typeof _clearedInput.config.input, undefined>();
