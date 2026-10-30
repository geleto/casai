// Public inference and invalid neighbors for the consolidated factory signatures.
import { create, z } from 'casai';
import type { ConfigProvider } from 'casai';
import { Output } from 'ai';
import type { LanguageModel, StreamTextResult, Tool } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
declare const enabled: boolean;
const schema = z.object({ answer: z.number() });
const inputSchema = z.object({ value: z.string().transform(Number) });
const modelParent = create.Config({ model });
const objectParent = create.Config({ model, output: Output.object({ schema }) });
const _emptyConfig = create.Config({});
expectEqual<keyof typeof _emptyConfig.config, never>();
declare const opaqueConfig: object;
// @ts-expect-error A broad object annotation cannot guarantee an implementation.
create.Function(opaqueConfig);
declare const optionalImplementation: { execute?: () => number };
// @ts-expect-error Optional implementation cannot complete a Function.
create.Function(optionalImplementation);
// @ts-expect-error Shared settings must still fit at least one component family.
create.Config({ schema, prompt: 'Answer', tools: {} });

// Function sources can come from the call; tools must configure their source.
const suppliedSource = create.LLMAgent.withFunction({}, modelParent);
// @ts-expect-error An ordinary function agent without a configured prompt requires a call-time source.
void suppliedSource();
void suppliedSource(() => 'Answer');
create.LLMAgent.withFunction({}, modelParent);
create.LLMAgent.withFunction.asStream({}, modelParent);
create.LLMAgent.withFunction.asStream({}, objectParent);
const promptParent = create.Config({ model, prompt: () => 'Answer' });
create.LLMAgent.withFunction({ prompt: undefined }, promptParent);
create.LLMAgent.withFunction.asStream({ prompt: undefined }, promptParent);
create.LLMAgent.withFunction.asStream({ prompt: undefined, output: Output.object({ schema: schema }) }, promptParent);
declare const optionalPrompt: { prompt?: () => string };
create.LLMAgent.withFunction({ model, ...optionalPrompt });
create.LLMAgent.withFunction.asStream({ model, ...optionalPrompt });
create.LLMAgent.withFunction.asStream({ model, ...optionalPrompt, output: Output.object({ schema: schema }) });
create.LLMAgent.withFunction({}, promptParent);
create.LLMAgent.withFunction.asStream({}, promptParent);
create.LLMAgent.withFunction.asStream({ output: Output.object({ schema: schema }) }, promptParent);
create.LLMAgent.withFunction({ prompt: () => 'Answer' }, modelParent);
create.LLMAgent.withFunction.asStream({ prompt: () => 'Answer' }, modelParent);
create.LLMAgent.withFunction.asStream({ prompt: () => 'Answer' }, objectParent);

// Required fields must survive in every possible final configuration.
const maybePrompt = enabled ? { model, prompt: () => 'Answer' } : { model };
create.LLMAgent.withFunction.asStream({}, { config: maybePrompt });
create.LLMAgent.withFunction.asStream({ prompt: () => 'Answer' }, { config: maybePrompt });
const operation = create.Config({ execute: () => 1 });
// @ts-expect-error Omit the parent argument instead of explicitly passing undefined.
create.Function({ execute: () => 1 }, undefined);
declare const maybeOperation: typeof operation | undefined;
// @ts-expect-error Parent presence must be narrowed even when the child is complete.
create.Function({ execute: () => 1 }, maybeOperation);
if (maybeOperation) create.Function({ execute: () => 1 }, maybeOperation);
else create.Function({ execute: () => 1 });
// @ts-expect-error An inherited implementation cannot be cleared.
create.Function({ execute: undefined }, operation);
// @ts-expect-error A finished Function cannot omit its implementation.
create.Function({});
const _inheritedFunction = create.Function({}, operation);
expectEqual<Awaited<ReturnType<typeof _inheritedFunction>>, number>();

// The schema is inferred before context-dependent callbacks on every coded tool.
const conditionalContext = enabled ? { context: { offset: 2 } } : {};
const functionTool = create.Function.asTool({ inputSchema, ...conditionalContext, execute: ({ value, offset }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof offset, number | undefined>();
	return value + (offset ?? 0);
} });
expectType<PromiseLike<number>>(functionTool.execute({ value: 2 }, { toolCallId: 'call', messages: [], context: undefined }));
// @ts-expect-error Native execution receives parsed input.
functionTool.execute({ value: '2' }, { toolCallId: 'call', messages: [], context: undefined });
void functionTool({ value: '2' });

const inheritedInput = create.Config({ inputSchema, context: { value: '3' } });
const template = create.Template.asTool({ template: '{{ value }}', onInputAvailable: ({ input: _input }) => {
	expectEqual<typeof _input.value, number>();
} }, inheritedInput);
const script = create.Script.asTool({ script: 'return value', schema: z.number(), toModelOutput: ({ output }) => {
	expectEqual<typeof output, number>();
	return { type: 'text', value: String(output) };
} }, inheritedInput);
void template();
expectType<Promise<number>>(script());
// @ts-expect-error Configured input defaults still use raw schema inputs.
void template({ value: 3 });
// @ts-expect-error Configured input defaults still use raw schema inputs.
void script({ value: 3 });

// Result output follows the selected SDK output, including in inherited callbacks.
const output = Output.object({ schema });
const textTools = { lookup: functionTool };
const textParent = create.Config({ model, output, tools: textTools, runtimeContext: { requestId: 'request' } });
const _generated = create.LLMAgent({ onStart: event => {
	expectType<typeof output | undefined>(event.output);
}, onEnd: _event => {
	expectEqual<typeof _event.runtimeContext.requestId, string>();
} }, textParent);
expectEqual<Awaited<ReturnType<typeof _generated>>['output'], { answer: number }>();
const streaming = create.LLMAgent.asStream({}, textParent);
expectType<StreamTextResult<typeof textTools, { requestId: string }, typeof output>>(await streaming('Answer'));
const prepared = create.LLMAgent.withFunction.asStream({ prompt: () => 'Answer' }, textParent);
expectType<Promise<Awaited<ReturnType<typeof streaming>>>>(prepared());
// Inline parent selectors are contextualized against the effective child registry.
create.LLMAgent({ tools: { lookup: functionTool } }, { config: { model, activeTools: ['lookup'] } });
create.LLMAgent.asStream({ tools: { lookup: functionTool } }, { config: { model, activeTools: ['lookup'] } });
// @ts-expect-error Parent selectors cannot name a missing tool.
create.LLMAgent({ tools: { lookup: functionTool } }, { config: { model, activeTools: ['missing'] } });
// @ts-expect-error Parent selectors cannot name a missing tool.
create.LLMAgent.asStream({ tools: { lookup: functionTool } }, { config: { model, activeTools: ['missing'] } });
const objectStream = create.LLMAgent.asStream({ output: Output.array({ element: schema }) }, objectParent);
// @ts-expect-error Selecting array mode must not hide an explicit schema removal.
create.LLMAgent.asStream({ output: Output.array({ element: undefined }) }, objectParent);
// @ts-expect-error Generators must capture the same child override in exact-optional mode.
create.LLMAgent({ output: Output.array({ element: undefined }) }, objectParent);
expectEqual<Awaited<Awaited<ReturnType<typeof objectStream>>['output']>, { answer: number }[]>();
expectType<AsyncIterable<{ answer: number }>>((await objectStream('Answer')).elementStream);
const objectPrepared = create.LLMAgent.withFunction.asStream({ output: Output.array({ element: schema }), prompt: () => 'Answer' }, objectParent);
expectType<ReturnType<typeof objectStream>>(objectPrepared());

// A return annotation cannot invent a parent; ambiguous parent presence must narrow.
const _annotated: ConfigProvider<{ model: LanguageModel }> = create.LLMAgent({ model });
const _annotatedStream: ConfigProvider<{ model: LanguageModel }> = create.LLMAgent.asStream({ model });
const _annotatedFunction: ConfigProvider<{ execute: () => number }> = create.Function({ execute: () => 1 });
const _annotatedFunctionTool: ConfigProvider<{ inputSchema: typeof inputSchema }> = create.Function.asTool({ inputSchema, execute: ({ value }) => value });
const _annotatedTemplate: ConfigProvider<{ template: string }> = create.Template({ template: 'Answer' });
const _annotatedScript: ConfigProvider<{ script: string }> = create.Script({ script: 'return 1' });
const _annotatedObjectStream: ConfigProvider<{ output: typeof output }> = create.LLMAgent.asStream({ model, output: Output.object({ schema: schema }) });
const _annotatedCall: () => Promise<number> = create.Function({ execute: () => 1 });
const _annotatedNativeTool: Tool<{ value: number }, number> = create.Function.asTool({ inputSchema, execute: ({ value }) => value });
declare const optionalParent: [] | [typeof modelParent];
// @ts-expect-error A possibly absent parent cannot satisfy model requirements.
create.LLMAgent({}, ...optionalParent);
// @ts-expect-error A possibly absent parent cannot satisfy model requirements.
create.LLMAgent.asStream({}, ...optionalParent);
declare const optionalInputParent: [] | [typeof inheritedInput];
// @ts-expect-error A possibly absent parent cannot satisfy required tool inputs.
create.Template.asTool({ template: '{{ value }}' }, ...optionalInputParent);
// @ts-expect-error A possibly absent parent cannot satisfy required tool inputs.
create.Script.asTool({ script: 'return value' }, ...optionalInputParent);
declare const optionalOperation: [] | [typeof operation];
// @ts-expect-error A possibly absent parent cannot supply the implementation.
create.Function({}, ...optionalOperation);

// Whole parent alternatives keep each schema paired with its retained prompt callback.
const stringInput = z.object({ value: z.string() });
const numericPrompt = create.LLMAgent.withFunction({ model, inputSchema, prompt: ({ value }) => value.toFixed(1) });
const stringPrompt = create.LLMAgent.withFunction({ model, inputSchema: stringInput, prompt: ({ value }) => value.toUpperCase() });
const prompts = { config: enabled ? numericPrompt.config : stringPrompt.config };
const promptAlternatives = prompts.config;
const inheritedTextPrompt = create.LLMAgent.withFunction({}, prompts);
const inheritedTextStreamPrompt = create.LLMAgent.withFunction.asStream({}, prompts);
const inheritedObjectPrompt = create.LLMAgent.withFunction({ output: Output.object({ schema: schema }) }, prompts);
const inheritedObjectStreamPrompt = create.LLMAgent.withFunction.asStream({ output: Output.object({ schema: schema }) }, prompts);
const inheritedTextPromptTool = create.LLMAgent.withFunction.asTool({}, prompts);
const inheritedObjectPromptTool = create.LLMAgent.withFunction.asTool({ output: Output.object({ schema: schema }) }, prompts);
void inheritedTextPrompt({ value: '4' });
void inheritedTextStreamPrompt({ value: '4' });
void inheritedObjectPrompt({ value: '4' });
void inheritedObjectStreamPrompt({ value: '4' });
void inheritedTextPromptTool({ value: '4' });
void inheritedObjectPromptTool({ value: '4' });
expectEqual<Awaited<ReturnType<typeof inheritedObjectPrompt>>['output'], { answer: number }>();
// @ts-expect-error Each selected parser consumes raw string input.
void inheritedTextPrompt({ value: 4 });
// @ts-expect-error The output schema does not relax the preparer's raw input.
void inheritedObjectPrompt({ value: 4 });

const incompletePrompts = { config: enabled ? promptAlternatives : { model, inputSchema } };
create.LLMAgent.withFunction({}, incompletePrompts);
create.LLMAgent.withFunction.asStream({}, incompletePrompts);
create.LLMAgent.withFunction({ output: Output.object({ schema: schema }) }, incompletePrompts);
create.LLMAgent.withFunction.asStream({ output: Output.object({ schema: schema }) }, incompletePrompts);
const incompatiblePrompts = { config: enabled ? promptAlternatives
	: { model, inputSchema, prompt: ({ value }: { value: boolean }) => String(value) } };
// @ts-expect-error One incompatible callback invalidates the complete configuration.
create.LLMAgent.withFunction({}, incompatiblePrompts);
// @ts-expect-error Tool callbacks must also fit their own selected input schema.
create.LLMAgent.withFunction.asTool({ output: Output.object({ schema: schema }) }, incompatiblePrompts);
// @ts-expect-error Replacing the input schema must recheck both retained callbacks.
create.LLMAgent.withFunction.asStream({ inputSchema: z.object({ value: z.boolean() }) }, prompts);

// Explicit undefined clears an optional Script output parser in both compiler modes.
const scriptParent = create.Config({ script: 'return "raw"', schema: z.number() });
const _rawScript = create.Script({ schema: undefined }, scriptParent);
const _rawScriptTool = create.Script.asTool({ schema: undefined, inputSchema: z.object({}) }, scriptParent);
expectEqual<typeof _rawScript.config.schema, undefined>();
expectEqual<Awaited<ReturnType<typeof _rawScript>>, unknown>();
expectEqual<typeof _rawScriptTool.config.schema, undefined>();
expectEqual<Awaited<ReturnType<typeof _rawScriptTool.execute>>, unknown>();

// Replacing Output replaces its schema and metadata as one setting.
const objectWithMetadata = create.Config({ model, output: Output.object({ schema, name: 'Answer', description: 'An answer' }) });
const json = create.LLMAgent({ output: Output.json() }, objectWithMetadata);
const jsonStream = create.LLMAgent.asStream({ output: Output.json() }, objectWithMetadata);
expectEqual<Awaited<ReturnType<typeof json>>['output'], import('ai').JSONValue>();
expectEqual<Awaited<Awaited<ReturnType<typeof jsonStream>>['output']>, import('ai').JSONValue>();
const jsonFragment = create.Config({ output: Output.json() }, objectWithMetadata);
create.LLMAgent({}, jsonFragment);
create.LLMAgent.asStream({}, jsonFragment);
const choiceFromObject = create.LLMAgent({ onEnd: _event => {
	expectEqual<typeof _event.output, 'YES' | 'NO' | undefined>();
}, output: Output.choice({ options: ['YES', 'NO'] }) }, objectWithMetadata);
expectEqual<Awaited<ReturnType<typeof choiceFromObject>>['output'], 'YES' | 'NO'>();
const objectFromChoice = create.LLMAgent({ onEnd: _event => {
	expectEqual<typeof _event.output, { answer: number } | undefined>();
}, output: Output.object({ schema }) }, choiceFromObject);
expectEqual<Awaited<ReturnType<typeof objectFromChoice>>['output'], { answer: number }>();
create.LLMAgent.withFunction({ prompt: () => 'Answer', output: Output.json() }, objectWithMetadata);
create.LLMAgent.withFunction.asStream({ prompt: () => 'Answer', output: Output.json() }, objectWithMetadata);
create.LLMAgent.asTool({ prompt: 'Answer', inputSchema: z.object({}), output: Output.json() }, objectWithMetadata);





export { json, jsonStream, objectFromChoice };
