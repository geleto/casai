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
const objectParent = create.Config({ model, schema });
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

// A prepared prompt must exist after inheritance; the caller cannot supply it.
// @ts-expect-error The inherited model does not supply a prompt function.
create.TextGenerator.withFunction({}, modelParent);
// @ts-expect-error Streaming has the same creation-time requirement.
create.TextStreamer.withFunction({}, modelParent);
// @ts-expect-error An output schema does not supply a prompt function.
create.ObjectStreamer.withFunction({}, objectParent);
const promptParent = create.Config({ model, prompt: () => 'Answer' });
// @ts-expect-error Explicit undefined clears the inherited prompt.
create.TextGenerator.withFunction({ prompt: undefined }, promptParent);
// @ts-expect-error Explicit undefined clears the inherited streaming prompt.
create.TextStreamer.withFunction({ prompt: undefined }, promptParent);
// @ts-expect-error Explicit undefined clears the inherited object prompt.
create.ObjectStreamer.withFunction({ schema, prompt: undefined }, promptParent);
declare const optionalPrompt: { prompt?: () => string };
// @ts-expect-error An optional callback cannot guarantee a prepared prompt.
create.TextGenerator.withFunction({ model, ...optionalPrompt });
// @ts-expect-error An optional callback cannot guarantee a prepared prompt.
create.TextStreamer.withFunction({ model, ...optionalPrompt });
// @ts-expect-error An optional callback cannot guarantee a prepared prompt.
create.ObjectStreamer.withFunction({ model, schema, ...optionalPrompt });
create.TextGenerator.withFunction({}, promptParent);
create.TextStreamer.withFunction({}, promptParent);
create.ObjectStreamer.withFunction({ schema }, promptParent);
create.TextGenerator.withFunction({ prompt: () => 'Answer' }, modelParent);
create.TextStreamer.withFunction({ prompt: () => 'Answer' }, modelParent);
create.ObjectStreamer.withFunction({ prompt: () => 'Answer' }, objectParent);

// Required fields must survive in every possible final configuration.
const maybePrompt = enabled ? { model, prompt: () => 'Answer' } : { model };
// @ts-expect-error One actual parent branch lacks a prompt callback.
create.TextStreamer.withFunction({}, { config: maybePrompt });
create.TextStreamer.withFunction({ prompt: () => 'Answer' }, { config: maybePrompt });
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
const _generated = create.TextGenerator({ onStart: event => {
	expectType<typeof output | undefined>(event.output);
}, onFinish: _event => {
	expectEqual<typeof _event.runtimeContext.requestId, string>();
} }, textParent);
expectEqual<Awaited<ReturnType<typeof _generated>>['value'], { answer: number }>();
const streaming = create.TextStreamer({}, textParent);
expectType<StreamTextResult<typeof textTools, { requestId: string }, typeof output>>(streaming('Answer'));
const prepared = create.TextStreamer.withFunction({ prompt: () => 'Answer' }, textParent);
expectType<Promise<Awaited<ReturnType<typeof streaming>>>>(prepared());
// Inline parent selectors are contextualized against the effective child registry.
create.TextGenerator({ tools: { lookup: functionTool } }, { config: { model, activeTools: ['lookup'] } });
create.TextStreamer({ tools: { lookup: functionTool } }, { config: { model, activeTools: ['lookup'] } });
// @ts-expect-error Parent selectors cannot name a missing tool.
create.TextGenerator({ tools: { lookup: functionTool } }, { config: { model, activeTools: ['missing'] } });
// @ts-expect-error Parent selectors cannot name a missing tool.
create.TextStreamer({ tools: { lookup: functionTool } }, { config: { model, activeTools: ['missing'] } });
const objectStream = create.ObjectStreamer({ output: 'array' }, objectParent);
// @ts-expect-error Selecting array mode must not hide an explicit schema removal.
create.ObjectStreamer({ schema: undefined, output: 'array' }, objectParent);
// @ts-expect-error Generators must capture the same child override in exact-optional mode.
create.ObjectGenerator({ schema: undefined, output: 'array' }, objectParent);
expectEqual<Awaited<ReturnType<typeof objectStream>['object']>, { answer: number }[]>();
expectType<AsyncIterable<{ answer: number }>>(objectStream('Answer').elementStream);
const objectPrepared = create.ObjectStreamer.withFunction({ output: 'array', prompt: () => 'Answer' }, objectParent);
expectType<Promise<ReturnType<typeof objectStream>>>(objectPrepared());

// A return annotation cannot invent a parent; ambiguous parent presence must narrow.
const _annotated: ConfigProvider<{ model: LanguageModel }> = create.TextGenerator({ model });
const _annotatedStream: ConfigProvider<{ model: LanguageModel }> = create.TextStreamer({ model });
const _annotatedFunction: ConfigProvider<{ execute: () => number }> = create.Function({ execute: () => 1 });
const _annotatedFunctionTool: ConfigProvider<{ inputSchema: typeof inputSchema }> = create.Function.asTool({ inputSchema, execute: ({ value }) => value });
const _annotatedTemplate: ConfigProvider<{ template: string }> = create.Template({ template: 'Answer' });
const _annotatedScript: ConfigProvider<{ script: string }> = create.Script({ script: 'return 1' });
const _annotatedObjectStream: ConfigProvider<{ schema: typeof schema }> = create.ObjectStreamer({ model, schema });
const _annotatedCall: () => Promise<number> = create.Function({ execute: () => 1 });
const _annotatedNativeTool: Tool<{ value: number }, number> = create.Function.asTool({ inputSchema, execute: ({ value }) => value });
declare const optionalParent: [] | [typeof modelParent];
// @ts-expect-error A possibly absent parent cannot satisfy model requirements.
create.TextGenerator({}, ...optionalParent);
// @ts-expect-error A possibly absent parent cannot satisfy model requirements.
create.TextStreamer({}, ...optionalParent);
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
const numericPrompt = create.TextGenerator.withFunction({ model, inputSchema, prompt: ({ value }) => value.toFixed(1) });
const stringPrompt = create.TextGenerator.withFunction({ model, inputSchema: stringInput, prompt: ({ value }) => value.toUpperCase() });
const prompts = { config: enabled ? numericPrompt.config : stringPrompt.config };
const promptAlternatives = prompts.config;
const inheritedTextPrompt = create.TextGenerator.withFunction({}, prompts);
const inheritedTextStreamPrompt = create.TextStreamer.withFunction({}, prompts);
const inheritedObjectPrompt = create.ObjectGenerator.withFunction({ schema }, prompts);
const inheritedObjectStreamPrompt = create.ObjectStreamer.withFunction({ schema }, prompts);
const inheritedTextPromptTool = create.TextGenerator.withFunction.asTool({}, prompts);
const inheritedObjectPromptTool = create.ObjectGenerator.withFunction.asTool({ schema }, prompts);
void inheritedTextPrompt({ value: '4' });
void inheritedTextStreamPrompt({ value: '4' });
void inheritedObjectPrompt({ value: '4' });
void inheritedObjectStreamPrompt({ value: '4' });
void inheritedTextPromptTool({ value: '4' });
void inheritedObjectPromptTool({ value: '4' });
expectEqual<Awaited<ReturnType<typeof inheritedObjectPrompt>>['object'], { answer: number }>();
// @ts-expect-error Each selected parser consumes raw string input.
void inheritedTextPrompt({ value: 4 });
// @ts-expect-error The output schema does not relax the preparer's raw input.
void inheritedObjectPrompt({ value: 4 });

const incompletePrompts = { config: enabled ? promptAlternatives : { model, inputSchema } };
// @ts-expect-error A successful alternative must not hide a missing prompt.
create.TextGenerator.withFunction({}, incompletePrompts);
// @ts-expect-error Streaming must validate every retained prompt alternative.
create.TextStreamer.withFunction({}, incompletePrompts);
// @ts-expect-error An output schema cannot supply the missing prompt.
create.ObjectGenerator.withFunction({ schema }, incompletePrompts);
// @ts-expect-error An output schema cannot supply the missing streaming prompt.
create.ObjectStreamer.withFunction({ schema }, incompletePrompts);
const incompatiblePrompts = { config: enabled ? promptAlternatives
	: { model, inputSchema, prompt: ({ value }: { value: boolean }) => String(value) } };
// @ts-expect-error One incompatible callback invalidates the complete configuration.
create.TextGenerator.withFunction({}, incompatiblePrompts);
// @ts-expect-error Tool callbacks must also fit their own selected input schema.
create.ObjectGenerator.withFunction.asTool({ schema }, incompatiblePrompts);
// @ts-expect-error Replacing the input schema must recheck both retained callbacks.
create.TextStreamer.withFunction({ inputSchema: z.object({ value: z.boolean() }) }, prompts);

// Explicit undefined clears an optional Script output parser in both compiler modes.
const scriptParent = create.Config({ script: 'return "raw"', schema: z.number() });
const _rawScript = create.Script({ schema: undefined }, scriptParent);
const _rawScriptTool = create.Script.asTool({ schema: undefined, inputSchema: z.object({}) }, scriptParent);
expectEqual<typeof _rawScript.config.schema, undefined>();
expectEqual<Awaited<ReturnType<typeof _rawScript>>, unknown>();
expectEqual<typeof _rawScriptTool.config.schema, undefined>();
expectEqual<Awaited<ReturnType<typeof _rawScriptTool.execute>>, unknown>();

// A changed output mode can clear obsolete settings without weakening its new requirements.
const objectWithMetadata = create.Config({ model, schema, schemaName: 'Answer', schemaDescription: 'An answer' });
const clearedObject = { schema: undefined, schemaName: undefined, schemaDescription: undefined };
const _json = create.ObjectGenerator({ ...clearedObject, output: 'no-schema' }, objectWithMetadata);
const _jsonStream = create.ObjectStreamer({ ...clearedObject, output: 'no-schema' }, objectWithMetadata);
expectEqual<Awaited<ReturnType<typeof _json>>['object'], import('ai').JSONValue>();
expectEqual<Awaited<ReturnType<typeof _jsonStream>['object']>, import('ai').JSONValue>();
const jsonFragment = create.Config({ ...clearedObject, output: 'no-schema' }, objectWithMetadata);
create.ObjectGenerator({}, jsonFragment);
create.ObjectStreamer({}, jsonFragment);
const enumFromObject = create.ObjectGenerator({ ...clearedObject, output: 'enum', enum: ['YES', 'NO'], onFinish: _event => {
	expectEqual<typeof _event.object, 'YES' | 'NO' | undefined>();
} }, objectWithMetadata);
expectEqual<Awaited<ReturnType<typeof enumFromObject>>['object'], 'YES' | 'NO'>();
const _objectFromEnum = create.ObjectGenerator({ output: 'object', enum: undefined, schema, onFinish: _event => {
	expectEqual<typeof _event.object, { answer: number } | undefined>();
} }, enumFromObject);
expectEqual<Awaited<ReturnType<typeof _objectFromEnum>>['object'], { answer: number }>();
create.ObjectGenerator.withFunction({ ...clearedObject, output: 'no-schema', prompt: () => 'Answer' }, objectWithMetadata);
create.ObjectStreamer.withFunction({ ...clearedObject, output: 'no-schema', prompt: () => 'Answer' }, objectWithMetadata);
create.ObjectGenerator.asTool({ ...clearedObject, output: 'no-schema', prompt: 'Answer', inputSchema }, objectWithMetadata);
// @ts-expect-error A retained schema is incompatible with no-schema output.
create.ObjectGenerator({ output: 'no-schema' }, objectWithMetadata);
// @ts-expect-error Clearing the schema does not clear its inherited metadata.
create.ObjectStreamer({ output: 'no-schema', schema: undefined }, objectWithMetadata);
// @ts-expect-error An enum from the old mode must be cleared too.
create.ObjectGenerator({ output: 'object', schema }, enumFromObject);
// @ts-expect-error New object mode still requires its schema.
create.ObjectGenerator({ output: 'object', enum: undefined }, enumFromObject);
// @ts-expect-error Arbitrary unknown settings remain invalid even when undefined.
create.ObjectGenerator({ model, output: 'no-schema', unknownSetting: undefined });
declare const optionalRemoval: { schema?: undefined };
// @ts-expect-error An optional removal may leave the old schema present.
create.ObjectGenerator({ ...optionalRemoval, output: 'no-schema' }, objectParent);
declare const invalidModeAlternative: { model: LanguageModel, output: 'no-schema' } | { model: LanguageModel, output: 'array' };
// @ts-expect-error Every complete configuration branch must satisfy its own required fields.
create.ObjectGenerator(invalidModeAlternative);
// @ts-expect-error Streamers have the same per-branch requirement.
create.ObjectStreamer(invalidModeAlternative);
