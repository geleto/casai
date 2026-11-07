import { create, z } from 'casai';
import { Output } from 'ai';
import type { LanguageModel, EmbeddingModel, RerankingModel, InferToolInput, InferToolOutput, ModelMessage } from 'ai';
import { expectEqual } from './assert.js';

declare const model: LanguageModel;
declare const flag: true | undefined;
const open = z.looseObject({ value: z.string() });
const closed = z.object({ value: z.string() });
type Choice = { inputSchema: typeof open; asTool?: undefined } | { inputSchema: typeof closed; asTool: true };
declare const choice: Choice;

const fn = create.Function({ execute: ({ value }: { value: string }) => value }, { config: choice });
const template = create.Template({ template: '{{ value }}' }, { config: choice });
const script = create.Script({ script: 'return value', schema: z.string() }, { config: choice });
const agent = create.LLMAgent({ model, prompt: 'Fixed' }, { config: choice });
expectEqual<Awaited<ReturnType<typeof fn>>, string>();
expectEqual<Awaited<ReturnType<typeof template>>, string>();
expectEqual<Awaited<ReturnType<typeof script>>, string>();
void fn({ value: 'ok' });
void template({ value: 'ok' });
void script({ value: 'ok' });
void agent({ value: 'ok' });
// @ts-expect-error Every alternative requires its declared input.
void fn({});
// @ts-expect-error The closed tool alternative rejects additional fields.
void template({ value: 'ok', extra: true });

// @ts-expect-error An optional tool flag must still enforce closed input.
create.Function({ inputSchema: open, execute: ({ value }) => value, asTool: flag });
// @ts-expect-error An optional tool flag must still enforce closed input.
create.Template({ inputSchema: open, template: '{{ value }}', asTool: flag });
// @ts-expect-error An optional tool flag must still enforce closed input.
create.Script({ inputSchema: open, script: 'return value', asTool: flag });
// @ts-expect-error An optional tool flag must still enforce closed input.
create.LLMAgent({ model, inputSchema: open, prompt: 'Fixed', asTool: flag });
const _optionalFunction = create.Function({ inputSchema: closed, execute: ({ value }) => value, asTool: flag });
expectEqual<Awaited<ReturnType<typeof _optionalFunction>>, string>();
create.Template({ inputSchema: closed, template: '{{ value }}', asTool: flag });
create.Script({ inputSchema: closed, script: 'return value', asTool: flag });
create.LLMAgent({ model, inputSchema: closed, prompt: 'Fixed', asTool: flag });
// @ts-expect-error An explicit modifier turns both parent branches into tools.
create.Function.asTool({ execute: ({ value }: { value: string }) => value }, { config: choice });
// @ts-expect-error An explicit modifier turns both parent branches into tools.
create.Template.asTool({ template: '{{ value }}' }, { config: choice });
// @ts-expect-error An explicit modifier turns both parent branches into tools.
create.Script.asTool({ script: 'return value' }, { config: choice });
// @ts-expect-error An explicit modifier turns both parent branches into tools.
create.LLMAgent.asTool({ model, prompt: 'Fixed' }, { config: choice });

const empty = z.object({});
declare const outputs: { execute: () => AsyncIterable<string>; asTool?: undefined }
	| { execute: () => string; inputSchema: typeof empty; asTool: true };
const _resultChoice = create.Function({}, { config: outputs });
expectEqual<Awaited<ReturnType<typeof _resultChoice>>, AsyncIterable<string> | string>();

const _declaredTool = create.Function.asTool({ inputSchema: closed, schema: z.string(), execute: ({ value }) => value,
	toModelOutput: ({ output }) => { expectEqual<typeof output, string>(); return { type: 'text', value: output }; } });
expectEqual<Awaited<ReturnType<typeof _declaredTool>>, string>();

const textOutput = ({ output }: { output: string }) => ({ type: 'text' as const, value: output });
declare const validDescriptor: { inputSchema: typeof open; asTool?: undefined }
	| { inputSchema: typeof closed; asTool: true; toModelOutput: typeof textOutput };
create.Function({ execute: ({ value }: { value: string }) => value }, { config: validDescriptor });
create.Template({ template: '{{ value }}' }, { config: validDescriptor });
create.Script({ script: 'return value', schema: z.string() }, { config: validDescriptor });
create.LLMAgent({ model, prompt: 'Fixed' }, { config: validDescriptor });
// @ts-expect-error The possible ordinary component does not support SDK descriptor properties.
create.Function({ inputSchema: closed, schema: z.string(), execute: ({ value }) => value, asTool: flag, toModelOutput: textOutput });
// @ts-expect-error The possible ordinary component does not support SDK descriptor properties.
create.Template({ inputSchema: closed, template: '{{ value }}', asTool: flag, toModelOutput: textOutput });
// @ts-expect-error The possible ordinary component does not support SDK descriptor properties.
create.Script({ inputSchema: closed, schema: z.string(), script: 'return value', asTool: flag, toModelOutput: textOutput });
// @ts-expect-error The possible ordinary component does not support SDK descriptor properties.
create.LLMAgent({ model, inputSchema: closed, prompt: 'Fixed', asTool: flag, toModelOutput: textOutput });

const _badClosed = z.object({ value: z.number() });
declare const badCallback: { inputSchema: typeof open; execute: (arg: { value: string }) => string; asTool?: undefined }
	| { inputSchema: typeof _badClosed; execute: (arg: { value: string }) => string; asTool: true };
// @ts-expect-error The tool branch implementation must consume its own parsed schema.
create.Function({}, { config: badCallback });

declare const badStream: { execute: () => string; asTool?: undefined }
	| { execute: () => AsyncIterable<string>; inputSchema: typeof empty; asTool: true };
// @ts-expect-error Only the ordinary alternative may return an undeclared stream.
create.Function({}, { config: badStream });

declare const pairedResults: { inputSchema: typeof open; execute: (input: { value: string }) => number; asTool?: undefined }
	| { inputSchema: typeof closed; execute: (input: { value: string }) => string; asTool: true };
const resultModes = create.Function({}, { config: pairedResults });
if ('execute' in resultModes) {
	expectEqual<Awaited<ReturnType<typeof resultModes.execute>>, string>();
	expectEqual<InferToolInput<typeof resultModes>, { value: string }>();
	expectEqual<InferToolOutput<typeof resultModes>, string>();
}

if ('execute' in template) expectEqual<InferToolInput<typeof template>, { value: string }>();
const _numberSchema = z.number();
const _stringSchema = z.string();
declare const scriptModes: { script: string; schema: typeof _numberSchema; inputSchema: typeof open; asTool?: undefined }
	| { script: string; schema: typeof _stringSchema; inputSchema: typeof closed; asTool: true };
const scripted = create.Script({}, { config: scriptModes });
if ('execute' in scripted) {
	expectEqual<InferToolInput<typeof scripted>, { value: string }>();
	expectEqual<InferToolOutput<typeof scripted>, string>();
}

const _ordinaryOutput = Output.object({ schema: z.object({ ordinary: z.number() }) });
const _toolOutput = Output.object({ schema: z.object({ tool: z.string() }) });
declare const agentModes: { output: typeof _ordinaryOutput; inputSchema: typeof open; asTool?: undefined }
	| { output: typeof _toolOutput; inputSchema: typeof closed; asTool: true };
const llm = create.LLMAgent({ model, prompt: 'Fixed' }, { config: agentModes });
if ('execute' in llm) {
	expectEqual<InferToolInput<typeof llm>, { value: string }>();
	expectEqual<InferToolOutput<typeof llm>, { tool: string }>();
}

declare const ranking: RerankingModel;
const _openQuery = z.looseObject({ query: z.string() });
const _closedQuery = z.object({ query: z.string() });
declare const rankingModes: { documents: { ordinary: number }[]; inputSchema: typeof _openQuery; asTool?: undefined }
	| { documents: { tool: string }[]; inputSchema: typeof _closedQuery; asTool: true };
const rank = create.Reranker({ model: ranking, query: 'Fixed' }, { config: rankingModes });
if ('execute' in rank) {
	expectEqual<InferToolInput<typeof rank>, { query: string }>();
	expectEqual<InferToolOutput<typeof rank>[number]['document'], { tool: string }>();
}

// @ts-expect-error Completed validation rejects unknown parent properties with an empty child.
create.Function({}, { config: { execute: () => 'value', typo: true } });
// @ts-expect-error Completed validation rejects unknown parent properties with an empty child.
create.Template({}, { config: { template: 'value', typo: true } });
// @ts-expect-error Completed validation rejects unknown parent properties with an empty child.
create.Script({}, { config: { script: 'return 1', typo: true } });
// @ts-expect-error Completed validation rejects unknown parent properties with an empty child.
create.LLMAgent({}, { config: { model, prompt: 'value', typo: true } });

declare const badDescriptor: { inputSchema: typeof open; asTool?: undefined; toModelOutput: typeof textOutput }
	| { inputSchema: typeof closed; asTool: true };
// @ts-expect-error A tool alternative cannot authorize SDK descriptor fields on an ordinary alternative.
create.Function({ execute: ({ value }: { value: string }) => value }, { config: badDescriptor });
// @ts-expect-error A tool alternative cannot authorize SDK descriptor fields on an ordinary alternative.
create.Template({ template: '{{ value }}' }, { config: badDescriptor });
// @ts-expect-error A tool alternative cannot authorize SDK descriptor fields on an ordinary alternative.
create.Script({ script: 'return value' }, { config: badDescriptor });
// @ts-expect-error A tool alternative cannot authorize SDK descriptor fields on an ordinary alternative.
create.LLMAgent({ model, prompt: 'Fixed' }, { config: badDescriptor });

// An ordinary script alternative cannot widen the SDK result of a function tool.
declare const modeEmbedConfig:
	| { model: EmbeddingModel; promptType: 'async-script'; input: string; asTool?: undefined }
	| { model: EmbeddingModel; promptType: 'function'; input: () => string; inputSchema: typeof empty; asTool: true };
const modeEmbed = create.Embedder({}, { config: modeEmbedConfig });
void modeEmbed();
if ('execute' in modeEmbed) {
	expectEqual<InferToolOutput<typeof modeEmbed>, number[]>();
	create.Function({ tools: { modeEmbed }, execute: async ({ modeEmbed }) => {
		const result = await modeEmbed({});
		expectEqual<typeof result, number[]>();
		return result;
	} });
}

declare const modeRankConfig:
	| { model: RerankingModel; promptType: 'async-script'; query: string; asTool?: undefined }
	| { model: RerankingModel; promptType: 'function'; query: () => { query: string; documents: { tool: true }[] }; inputSchema: typeof empty; asTool: true };
const modeRank = create.Reranker({}, { config: modeRankConfig });
void modeRank();
if ('execute' in modeRank) {
	expectEqual<InferToolOutput<typeof modeRank>[number]['document'], { tool: true }>();
}

// A script that can actually run as the tool retains its native, untyped result alternatives.
declare const scriptToolConfig:
	| { model: EmbeddingModel; promptType: 'function'; input: () => string; asTool?: undefined }
	| { model: EmbeddingModel; promptType: 'async-script'; input: string; inputSchema: typeof empty; asTool: true };
const scriptTool = create.Embedder({}, { config: scriptToolConfig });
if ('execute' in scriptTool) expectEqual<InferToolOutput<typeof scriptTool>, number[] | number[][]>();

// Native Agent methods belong only to the non-tool configuration alternatives.
const _nativeOrdinaryInput = z.object({ ordinary: z.string() });
const _nativeToolInput = z.object({ tool: z.string() });
const _localTool = create.Function.asTool({ inputSchema: empty, execute: () => 'local' });
declare const nativeAgentModes:
	| { inputSchema: typeof _nativeOrdinaryInput; output: typeof _ordinaryOutput; tools: { local: typeof _localTool }; asTool?: undefined }
	| { inputSchema: typeof _nativeToolInput; output: typeof _toolOutput; asTool: true };
const nativeAgent = create.LLMAgent({ model, prompt: 'Fixed' }, { config: nativeAgentModes });
if ('generate' in nativeAgent) {
	expectEqual<keyof typeof nativeAgent.tools, 'local'>();
	void nativeAgent.generate({ prompt: 'continue', options: { ordinary: 'value' } }).then(_result => {
		expectEqual<typeof _result.output, { ordinary: number }>();
	});
	void nativeAgent.stream({ prompt: 'continue', options: { ordinary: 'value' } });
	const history: ModelMessage[] = [{ role: 'user', content: 'continue' }];
	void nativeAgent.resume(history, { context: { ordinary: 'value' } });
	// @ts-expect-error Native Agent methods cannot belong to the tool alternative.
	void nativeAgent.generate({ prompt: 'continue', options: { tool: 'value' } });
	// @ts-expect-error Common ordinary calls retain all possible configuration contracts.
	void nativeAgent({ ordinary: 'value' });
}

