import { create, streamSchema, textStreamSchema, z } from 'casai';
import { Output } from 'ai';
import type { InferToolOutput, LanguageModel, OutputInterface } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
declare const flag: boolean;
const inputSchema = z.object({});
const chunks = async function* () { yield 'one'; };
const iterableOutput = { ...Output.text(), parseCompleteOutput: async (): Promise<AsyncIterable<string>> => chunks() };
const optionalOutput = flag ? iterableOutput : undefined;
const mixedOutput = flag ? iterableOutput : Output.text();
const mixedResult = { ...Output.text(), parseCompleteOutput: async () => flag ? chunks() : 'text' };

// Every known output branch must be usable as a completed tool result.
// @ts-expect-error An absent output alternative cannot hide the iterable branch.
create.LLMAgent.asTool({ model, prompt: 'ready', inputSchema, output: optionalOutput });
// @ts-expect-error A text output alternative cannot hide the iterable branch.
create.LLMAgent.asTool({ model, prompt: 'ready', inputSchema, output: mixedOutput });
// @ts-expect-error One output specification can itself parse to a union containing an iterable.
create.LLMAgent.asTool({ model, prompt: 'ready', inputSchema, output: mixedResult });
const parent = create.Config({ model, prompt: 'ready', output: optionalOutput });
// @ts-expect-error Inheritance retains every possible output branch.
create.LLMAgent.asTool({ inputSchema }, parent);
declare const optionalProperty: { output?: typeof iterableOutput };
// @ts-expect-error Optional property syntax has the same possible iterable result.
create.LLMAgent.asTool({ model, prompt: 'ready', inputSchema, ...optionalProperty });

// Ordinary agents retain native parsed values; replacing output removes the restriction.
const ordinary = create.LLMAgent({ model, output: mixedOutput });
const streaming = create.LLMAgent.asStream({ model, output: optionalOutput });
expectEqual<Awaited<ReturnType<typeof ordinary>>['output'], AsyncIterable<string> | string>();
expectEqual<Awaited<ReturnType<typeof streaming>>['output'], PromiseLike<AsyncIterable<string> | string>>();
create.LLMAgent.asTool({ inputSchema, output: Output.text() }, parent);
create.LLMAgent.asTool({ inputSchema, output: undefined }, parent);
// An iterable nested in a parsed object is a value, not a root stream to collect.
create.LLMAgent.asTool({ model, prompt: 'ready', inputSchema,
	output: { ...Output.text(), parseCompleteOutput: async () => ({ items: chunks() }) } });
declare const erasedOutput: OutputInterface<unknown>;
create.LLMAgent.asTool({ model, prompt: 'ready', inputSchema, output: erasedOutput });

// The same shared restriction applies to coded tools.
const mixedExecute = () => flag ? chunks() : 'text';
// @ts-expect-error A Function may return a root iterable without a collection schema.
create.Function.asTool({ inputSchema, execute: mixedExecute });
const mixedSchema = z.string().transform(mixedExecute);
// @ts-expect-error A parsed output union must not hide a root iterable either.
create.Function.asTool({ inputSchema, schema: mixedSchema, execute: () => 'text' });
// @ts-expect-error Script output schemas have the same tool restriction.
create.Script.asTool({ inputSchema, schema: mixedSchema, script: 'return "text"' });
create.Function({ execute: mixedExecute });
create.Script({ schema: mixedSchema, script: 'return "text"' });

// Keep each declared stream schema associated with its own output alternative.
const textSchema = textStreamSchema();
const schemaAlternatives = flag ? textSchema : z.string();
const schemaUnion = create.Function.asTool({ inputSchema, schema: schemaAlternatives, execute: mixedExecute });
expectType<PromiseLike<string>>(schemaUnion.execute({}, { toolCallId: 'call', messages: [], context: undefined }));
create.Script.asTool({ inputSchema, schema: schemaAlternatives, script: 'return "text"' });
declare const correlated: { schema: typeof textSchema; execute: typeof chunks } | { execute: () => string };
const correlatedTool = create.Function.asTool({ inputSchema, ...correlated });
expectEqual<InferToolOutput<typeof correlatedTool>, string>();
expectType<PromiseLike<string>>(correlatedTool.execute({}, { toolCallId: 'call', messages: [], context: undefined }));
const _boundCorrelated = correlatedTool.bindToolContext({});
expectEqual<InferToolOutput<typeof _boundCorrelated.tool>, string>();
expectEqual<Parameters<NonNullable<typeof correlatedTool.toModelOutput>>[0]['output'], string>();
const correlatedOwner = create.Function({ tools: { correlatedTool }, execute: ({ correlatedTool }) => {
	const output = correlatedTool({});
	expectEqual<typeof output, Promise<string>>();
	return output;
} });
expectType<Promise<string>>(correlatedOwner());

// Reusable fragments must retain the same pairing before the tool is constructed.
const correlatedFragment = create.Config(correlated);
const inheritedCorrelated = create.Function.asTool({ inputSchema }, correlatedFragment);
expectEqual<InferToolOutput<typeof inheritedCorrelated>, string>();
expectEqual<Awaited<ReturnType<typeof inheritedCorrelated>>, AsyncIterable<string> | string>();
const _inheritedBinding = inheritedCorrelated.bindToolContext({});
expectEqual<InferToolOutput<typeof _inheritedBinding.tool>, string>();
const inheritedOwner = create.Function({ tools: { inheritedCorrelated }, execute: ({ inheritedCorrelated }) => inheritedCorrelated({}) });
expectType<Promise<string>>(inheritedOwner());
declare const invalidStreamChoice: { schema: typeof textSchema; execute: () => string } | { execute: () => string };
// @ts-expect-error Only the schema-free branch accepts a string producer.
create.Config(invalidStreamChoice);
// @ts-expect-error Inheritance must not hide the invalid stream-schema branch.
create.Config({ debug: true }, { config: invalidStreamChoice });

const _numberSchema = streamSchema(z.string().transform(Number));
declare const mixed: { schema: typeof _numberSchema; execute: typeof chunks } | { execute: () => boolean };
const _mixedTool = create.Function.asTool({ inputSchema, ...mixed });
expectEqual<InferToolOutput<typeof _mixedTool>, number[] | boolean>();
expectEqual<Awaited<ReturnType<typeof _mixedTool>>, AsyncIterable<number> | boolean>();

const _parsedText = z.number().transform(String);
declare const scalarAlternatives: { schema: typeof _parsedText; execute: () => number } | { execute: () => boolean };
const _scalar = create.Function({ ...scalarAlternatives });
expectEqual<Awaited<ReturnType<typeof _scalar>>, string | boolean>();
declare const uncollected: { schema: typeof textSchema; execute: typeof chunks } | { execute: typeof mixedExecute };
// @ts-expect-error Only the first branch declares how its iterable is collected.
create.Function.asTool({ inputSchema, ...uncollected });
// @ts-expect-error An optional stream schema leaves a possible uncollected branch.
create.Function.asTool({ inputSchema, schema: flag ? textSchema : undefined, execute: chunks });
create.Function.asTool({ inputSchema, schema: flag ? textSchema : streamSchema(z.string()), execute: chunks });

export { ordinary, streaming };
