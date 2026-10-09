// Compile-only consumer checks: accepted fragments stay reusable; incompatible settings stay rejected.
import { create, z } from 'casai';
import type { ILoaderAny } from 'cascada-engine';
import type { LanguageModel, ModelMessage } from 'ai';

import { expectType, expectEqual } from './assert.js';
declare const model: LanguageModel;
declare const replacementModel: LanguageModel;

const schema = z.object({ answer: z.number() });
const inputSchema = z.object({ name: z.string() });
const parent = create.Config({ context: { offset: 4 }, debug: true });

// Config fragments defer requirements until a concrete factory is selected.
create.Config({});
const schemaOnly = create.Config({ schema });
const modelOnly = create.Config({ model });
create.ObjectGenerator({ model }, schemaOnly);
create.ObjectStreamer({ model }, schemaOnly);
create.TextGenerator({}, modelOnly);
create.TextStreamer({}, modelOnly);
create.ObjectGenerator({ schema }, modelOnly);
create.ObjectStreamer({ schema }, modelOnly);
create.Config({ inputSchema });
create.Config({ output: 'object' });
create.Config({ output: 'array' });
create.Config({ output: 'enum' });
create.Config({ output: 'no-schema' });
create.Config({ model, schema, output: undefined });
create.Config({ model, schema, output: 'array', schemaName: 'Answer', schemaDescription: 'The answer' });
create.Config({ model, output: 'enum', enum: ['YES', 'NO'] as const, mode: 'tool' });
create.Config({ model, output: 'no-schema', mode: 'json' });
// @ts-expect-error Enum fragments cannot declare an object schema.
create.Config({ output: 'enum', enum: ['YES'], schema });
// @ts-expect-error Schemaless fragments cannot declare an object schema.
create.Config({ output: 'no-schema', schema });
// @ts-expect-error Schemaless fragments accept only JSON mode.
create.Config({ output: 'no-schema', mode: 'tool' });
// @ts-expect-error Array fragments cannot declare enum alternatives.
create.Config({ output: 'array', enum: ['YES'] });
// @ts-expect-error Enum fragments cannot declare schema metadata.
create.Config({ output: 'enum', enum: ['YES'], schemaName: 'Answer' });

// Standalone and inherited fragments must fit one component family.
// @ts-expect-error No configuration accepts template and script together.
create.Config({ template: 'Hello', script: 'return 1' });
// @ts-expect-error Template configurations do not accept a model.
create.Config({ template: 'Hello', model });
// @ts-expect-error Template configurations do not accept an output schema.
create.Config({ template: 'Hello', schema });
// @ts-expect-error Script configurations do not accept a model.
create.Config({ script: 'return 1', model });
// @ts-expect-error Script configurations do not accept an object output mode.
create.Config({ script: 'return 1', output: 'array' });
// @ts-expect-error Object configurations do not accept text-generation tools.
create.Config({ output: 'array', tools: {} });
// @ts-expect-error An object schema and text-generation tools fit no single component.
create.Config({ model, schema, tools: {} });
// @ts-expect-error A shared schema and tools fit no single component.
create.Config({ schema, tools: {} });
// @ts-expect-error A shared schema and tool contexts fit no single component.
create.Config({ schema, toolsContext: {} });
// @ts-expect-error Inheriting unrelated context does not make incompatible fragment settings valid.
create.Config({ template: 'Hello', model }, parent);
// @ts-expect-error Compatibility is checked across the merged parent and child.
create.Config({ model }, create.Config({ template: 'Hello' }));
// @ts-expect-error Compatibility is checked when the incompatible setting comes from the parent.
create.Config({ template: 'Hello' }, modelOnly);
// @ts-expect-error Inherited schemas still prohibit text-generation tools.
create.Config({ tools: {} }, schemaOnly);
// @ts-expect-error Unknown properties cannot be hidden in a generic fragment.
create.Config({ unknownSetting: true });
// @ts-expect-error Unknown child properties are rejected with a parent too.
create.Config({ unknownSetting: true }, parent);

// Basic values are checked before a fragment is used by a factory.
create.Config({ messages: [{ role: 'user', content: 'Hello' }] });
create.Config({ prompt: [{ role: 'user', content: 'Hello' }] });
create.Config({ enum: ['YES', 'NO'] });
// @ts-expect-error Config requires an object.
create.Config(undefined);
// @ts-expect-error Config requires a non-null object.
create.Config(null);
// @ts-expect-error Arrays are not configuration objects.
create.Config([]);
// @ts-expect-error Primitive strings are not configuration objects.
create.Config('config');
// @ts-expect-error Primitive numbers are not configuration objects.
create.Config(42);
// @ts-expect-error Only supported output modes may be declared.
create.Config({ output: 'invalid' });
// @ts-expect-error Enum choices must be an array.
create.Config({ enum: 'YES' });
// @ts-expect-error Enum choices must all be strings.
create.Config({ output: 'enum', enum: ['YES', 42] });
// @ts-expect-error Messages must be an array.
create.Config({ messages: 'Hello' });
// @ts-expect-error Messages cannot be null.
create.Config({ messages: null });
// @ts-expect-error Message roles must belong to the SDK message union.
create.Config({ messages: [{ role: 'unknown', content: 'Hello' }] });
// @ts-expect-error Message content cannot be numeric.
create.Config({ messages: [{ role: 'user', content: 42 }] });
// @ts-expect-error Message-array prompts must contain valid SDK messages.
create.Config({ prompt: [{ role: 'user', content: 42 }] });
// @ts-expect-error Malformed child messages cannot be concealed by valid parent messages.
create.Config({ messages: false }, create.Config({ messages: [{ role: 'user', content: 'Previous' }] }));
// @ts-expect-error Debug is a boolean setting.
create.Config({ debug: 'yes' });
// @ts-expect-error Description is a string setting.
create.Config({ description: 42 });

// Merging maps preserves exact keys, replaces individual values, and retains parent keys.
const merged = create.Config({ context: { label: 'child', offset: 'replacement' }, debug: false }, parent);
expectType<string>(merged.config.context.offset);
expectType<string>(merged.config.context.label);
expectType<boolean>(merged.config.debug);
expectEqual<typeof merged.config.context.offset, string>();
expectEqual<typeof merged.config.context.label, string>();
// @ts-expect-error A child map value replaces the parent's number.
expectType<number>(merged.config.context.offset);
// @ts-expect-error Absent map keys are not invented during merging.
expectType<unknown>(merged.config.context.missing);

const nestedParent = create.Config({ context: { entry: { count: 4, old: true }, retained: 1 } });
const nestedChild = create.Config({ context: { entry: { label: 'new' } } }, nestedParent);
expectType<string>(nestedChild.config.context.entry.label);
expectType<number>(nestedChild.config.context.retained);
// @ts-expect-error Map values replace whole nested objects; their properties are not deep-merged.
expectType<unknown>(nestedChild.config.context.entry.count);
// @ts-expect-error Replaced nested values do not retain unrelated old properties.
expectType<unknown>(nestedChild.config.context.entry.old);

const preserved = create.Config({ context: undefined }, parent);
expectType<number>(preserved.config.context.offset);
expectEqual<typeof preserved.config.context.offset, number>();
// @ts-expect-error Explicit undefined preserves a parent map without erasing its entry types.
expectType<string>(preserved.config.context.offset);

declare const optionalContext: { context?: { label: string } };
const optionalMerged = create.Config(optionalContext, parent);
expectType<number>(optionalMerged.config.context.offset);
expectType<string | undefined>(optionalMerged.config.context.label);
expectEqual<typeof optionalMerged.config.context.label, string | undefined>();
// @ts-expect-error An optional child map does not guarantee a new entry.
expectType<string>(optionalMerged.config.context.label);

const messagesParent = create.Config({ messages: [{ role: 'user', content: 'First' }] });
const messagesChild = create.Config({ messages: [{ role: 'assistant', content: 'Second' }] }, messagesParent);
expectType<ModelMessage[]>(messagesChild.config.messages);
expectType<'user' | 'assistant'>(messagesChild.config.messages[0].role);
// @ts-expect-error Concatenated messages retain possible parent roles.
expectType<'assistant'>(messagesChild.config.messages[0].role);
const keptMessages = create.Config({ messages: undefined }, messagesParent);
expectType<ModelMessage[]>(keptMessages.config.messages);
expectEqual<typeof keptMessages.config.messages[0]['role'], 'user'>();
const emptyMessages = create.Config({ messages: [] }, messagesParent);
expectType<ModelMessage[]>(emptyMessages.config.messages);

const loaderParent = create.Config({ loader: { load: (name: string) => name } });
expectType<ILoaderAny[]>(loaderParent.config.loader);
const loaderChild = create.Config({ loader: { load: (name: string) => name.toUpperCase() } }, loaderParent);
expectType<ILoaderAny[]>(loaderChild.config.loader);
// @ts-expect-error Processed loader configuration exposes an array, not a single loader.
expectType<ILoaderAny>(loaderChild.config.loader);
const keptLoader = create.Config({ loader: undefined }, loaderParent);
expectType<ILoaderAny[]>(keptLoader.config.loader);
const emptyLoader = create.Config({ loader: [] }, loaderParent);
expectType<ILoaderAny[]>(emptyLoader.config.loader);

// Ordinary option objects replace their parent's whole value instead of merging nested provider data.
const providerParent = create.Config({ model, providerOptions: { vendor: { old: true, count: 1 } } });
const providerChild = create.Config({ providerOptions: { vendor: { label: 'new' } } }, providerParent);
expectEqual<typeof providerChild.config.providerOptions.vendor.label, string>();
// @ts-expect-error Provider options are replaced as a whole; old nested keys are unavailable.
expectType<unknown>(providerChild.config.providerOptions.vendor.old);

const extraSettings = { unknownSetting: true };
// @ts-expect-error Unknown keys are rejected when supplied through an existing variable.
create.Config(extraSettings);
// @ts-expect-error Spreading an existing object does not conceal its unknown keys.
create.Config({ model, ...extraSettings });

// Static text factories require a model and reject settings from other component families.
create.TextGenerator({ model });
create.TextStreamer({ model });
create.TextGenerator({ model, prompt: 'Hello', maxOutputTokens: 10, debug: true });
create.TextStreamer({ model, messages: [{ role: 'user', content: 'Hello' }] });
// @ts-expect-error A concrete generator requires a model.
create.TextGenerator({ prompt: 'Hello' });
// @ts-expect-error A concrete streamer requires a model.
create.TextStreamer({ prompt: 'Hello' });
// @ts-expect-error A parent without a model does not satisfy a generator's required setting.
create.TextGenerator({ prompt: 'Hello' }, create.Config({ debug: true }));
// @ts-expect-error A parent without a model does not satisfy a streamer's required setting.
create.TextStreamer({ prompt: 'Hello' }, create.Config({ debug: true }));
// @ts-expect-error An empty inherited fragment still cannot supply a required model.
create.TextGenerator({}, create.Config({}));
// @ts-expect-error An empty child must not skip a streamer's required model validation.
create.TextStreamer({}, create.Config({}));
// @ts-expect-error Explicit undefined clears the inherited model.
create.TextGenerator({ model: undefined }, modelOnly);
// @ts-expect-error Explicit null cannot satisfy an inherited required model.
create.TextStreamer({ model: null }, modelOnly);
declare const uncertainModelParent: { readonly config: { model: LanguageModel | undefined } };
// @ts-expect-error A required inherited model must be present for every possible value.
create.TextGenerator({}, uncertainModelParent);
create.TextGenerator({ model }, uncertainModelParent);
create.TextGenerator({ model, onStart: event => { expectType<object>(event); } }, create.Config({}));
create.TextGenerator({ onStart: event => { expectType<object>(event); } }, modelOnly);
declare const unionModelParent: { readonly config: { model: LanguageModel } | { debug: boolean } };
create.TextGenerator({ model }, unionModelParent);
// @ts-expect-error Every parent union alternative must supply the required model.
create.TextGenerator({}, unionModelParent);

// Empty child configs must validate inherited factory requirements just like nonempty children.
const promptParent = create.Config({ model, prompt: 'Answer.' });
const inputParent = create.Config({ model, inputSchema });
create.TextGenerator.asTool({ inputSchema }, promptParent);
create.TextGenerator.asTool({ prompt: 'Answer.' }, inputParent);
create.TextGenerator.asTool({}, create.Config({ model, prompt: 'Answer.', inputSchema }));
create.TextGenerator.loadsText({ loader: { load: (name: string) => name } }, promptParent);
create.TextGenerator.loadsText({}, create.Config({ model, prompt: 'answer', loader: { load: (name: string) => name } }));
create.TextGenerator.withFunction({ prompt: () => 'Answer.' }, modelOnly);
create.TextGenerator.withFunction({}, create.Config({ model, prompt: () => 'Answer.' }));
declare const typedFunctionParent: { readonly config: { model: LanguageModel, inputSchema: typeof inputSchema, prompt: (context: { name: string }) => string } };
create.TextGenerator.withFunction({}, typedFunctionParent);
create.TextStreamer.withFunction({}, typedFunctionParent);
create.TextGenerator.withFunction({ inputSchema, prompt: _context => {
	expectEqual<typeof _context.name, string>();
	// @ts-expect-error Requiring an inherited prompt must preserve contextual input typing.
	expectEqual<typeof _context.name, number>();
	return 'Answer.';
} }, modelOnly);
// @ts-expect-error A text tool requires inputSchema even when the child has no settings.
create.TextGenerator.asTool({}, promptParent);
// @ts-expect-error A text tool requires prompt even when the child has no settings.
create.TextGenerator.asTool({}, inputParent);
// @ts-expect-error Loaded text requires a loader even when the child has no settings.
create.TextGenerator.loadsText({}, promptParent);
// @ts-expect-error Loaded text streams require a loader too.
create.TextStreamer.loadsText({}, promptParent);
// @ts-expect-error Loaded template prompts require a loader.
create.TextGenerator.loadsTemplate({}, promptParent);
// @ts-expect-error Loaded script prompts require a loader.
create.TextStreamer.loadsScript({}, promptParent);
// @ts-expect-error Template-prompt text tools require inputSchema.
create.TextGenerator.withTemplate.asTool({}, promptParent);
// @ts-expect-error Script-prompt text tools require prompt.
create.TextGenerator.withScript.asTool({}, inputParent);
// @ts-expect-error Function-prompt generators require a function prompt.
create.TextGenerator.withFunction({}, modelOnly);
// @ts-expect-error Function-prompt streamers require a function prompt.
create.TextStreamer.withFunction({}, modelOnly);
// @ts-expect-error A string prompt cannot satisfy an inherited function-prompt requirement.
create.TextGenerator.withFunction({}, promptParent);
// @ts-expect-error Function-prompt text tools require prompt too.
create.TextGenerator.withFunction.asTool({}, inputParent);

// Object and renderer families enforce the same requirements for empty child configs.
// @ts-expect-error Object generators require an output schema.
create.ObjectGenerator({}, modelOnly);
// @ts-expect-error Object streamers require a model.
create.ObjectStreamer({}, schemaOnly);
// @ts-expect-error Template tools require an input schema.
create.Template.asTool({}, create.Config({ template: 'Hello' }));
// @ts-expect-error Object tools require an input schema.
create.ObjectGenerator.asTool({}, create.Config({ model, schema, prompt: 'Answer.' }));
// @ts-expect-error Loaded object generators require a loader.
create.ObjectGenerator.loadsText({}, create.Config({ model, schema, prompt: 'answer' }));
// @ts-expect-error Loaded templates require a loader.
create.Template.loadsTemplate({}, create.Config({ template: 'answer' }));
// @ts-expect-error Loaded scripts require a loader.
create.Script.loadsScript({}, create.Config({ script: 'answer' }));
// @ts-expect-error Object tools require a prompt.
create.ObjectGenerator.asTool({}, create.Config({ model, schema, inputSchema }));
// @ts-expect-error Template tools require a template.
create.Template.asTool({}, create.Config({ inputSchema }));
// @ts-expect-error Script tools require a script.
create.Script.asTool({}, create.Config({ inputSchema }));
// @ts-expect-error Text generators do not use legacy object output modes.
create.TextGenerator({ model, output: 'object' });
// @ts-expect-error Text streamers cannot declare an object schema.
create.TextStreamer({ model, schema });
// @ts-expect-error Text generators cannot declare enum choices.
create.TextGenerator({ model, enum: ['YES'] });
// @ts-expect-error Text streamers do not use an object generation mode.
create.TextStreamer({ model, mode: 'json' });
// @ts-expect-error Text generators render their prompt rather than a template setting.
create.TextGenerator({ model, template: 'Hello' });
// @ts-expect-error Text streamers render their prompt rather than a script setting.
create.TextStreamer({ model, script: 'return "Hello"' });
// @ts-expect-error Factory keys are checked even for a previously bound object.
create.TextGenerator({ model, ...{ unknownSetting: true } });
// @ts-expect-error Inherited object-only settings are still forbidden for text.
create.TextGenerator({ model }, schemaOnly);
// @ts-expect-error Inherited template-only settings are still forbidden for text.
create.TextStreamer({ model }, create.Config({ template: 'Hello' }));

const text = create.TextGenerator({ model, prompt: 'Hello' });
const stream = create.TextStreamer({ model, prompt: 'Hello' });
void text.run({});
void text.run({ model: replacementModel, prompt: 'Changed', maxOutputTokens: 20 });
void stream.run({ messages: [{ role: 'user', content: 'Changed' }] });
// @ts-expect-error A run cannot change the output schema.
void text.run({ schema });
// @ts-expect-error A run cannot change the output mode.
void stream.run({ output: 'no-schema' });
// @ts-expect-error A run cannot change enum choices.
void text.run({ enum: ['YES'] });
// @ts-expect-error A run cannot change the input schema.
void stream.run({ inputSchema });
// @ts-expect-error A run cannot introduce an SDK tool context schema.
void text.run({ contextSchema: inputSchema });
// @ts-expect-error A run cannot change its prompt rendering mode.
void text.run({ promptType: 'async-template' });
// @ts-expect-error A run cannot introduce a loader.
void stream.run({ loader: { load: (name: string) => name } });
// @ts-expect-error A run cannot change renderer filters.
void text.run({ filters: { upper: (value: string) => value.toUpperCase() } });
// @ts-expect-error A run cannot change renderer options.
void stream.run({ options: { autoescape: true } });
// @ts-expect-error Unknown run properties are rejected.
void text.run({ unknownSetting: true });
// @ts-expect-error Run generation settings keep their declared value types.
void stream.run({ maxOutputTokens: '20' });
