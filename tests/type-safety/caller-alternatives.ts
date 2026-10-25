import { create, z } from 'casai';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

declare const model: LanguageModel;
declare const choose: boolean;
declare const valid: { extra: number } | { other: number };
declare const invalid: { value: number } | { value: number; extra: string };
declare const ownUndefined: { value: number } | { value: number; extra: undefined };
const inputSchema = z.object({ value: z.number() }).catchall(z.number());
const context = { value: 1 };
const operation = create.Function({ inputSchema, context, execute: ({ value }) => value });
const script = create.Script({ inputSchema, context, script: 'return value' });
const template = create.Template({ inputSchema, context, template: '{{ value }}' });
const text = create.TextGenerator.withTemplate({ inputSchema, context, model, prompt: '{{ value }}' });
const stream = create.TextStreamer.withScript({ inputSchema, context, model, prompt: 'return value' });
const object = create.ObjectGenerator.withFunction({ inputSchema, context, model, schema: z.object({ answer: z.number() }), prompt: ({ value }) => String(value) });
const objectStream = create.ObjectStreamer.withTemplate({ inputSchema, context, model, schema: z.object({ answer: z.number() }), prompt: '{{ value }}' });

// Every concrete caller retains all alternatives before complete-input validation.
void operation(valid);
void script(valid);
void template(valid);
void text(valid);
void stream(valid);
void object(valid);
void objectStream(valid);
// @ts-expect-error A string extra cannot hide in another argument alternative.
void operation(invalid);
// @ts-expect-error Script checks the complete argument union.
void script(invalid);
// @ts-expect-error Template checks the complete argument union.
void template(invalid);
// @ts-expect-error Rendered model calls check the complete argument union.
void text(invalid);
// @ts-expect-error Streaming callers retain the numeric catchall.
void stream(invalid);
// @ts-expect-error Function preparers retain the numeric catchall.
void object(invalid);
// @ts-expect-error Object streams retain the numeric catchall.
void objectStream(invalid);
// @ts-expect-error Own undefined is a present invalid catchall value.
void operation(ownUndefined);
// @ts-expect-error Optional renderer inputs cannot erase invalid union branches.
void template(ownUndefined);
void template('{{ value }}', valid);
// @ts-expect-error Explicit source does not weaken context validation.
void template('{{ value }}', invalid);
void text([], valid);
// @ts-expect-error A history argument does not weaken context validation.
void text([], invalid);

void operation.run({ context: valid });
void script.run({ context: valid });
void template.run({ context: valid });
// @ts-expect-error Named calls validate every context alternative too.
void operation.run({ context: invalid });
// @ts-expect-error Named renderer calls use the same complete-input check.
void template.run({ context: ownUndefined });
void operation();
void operation(undefined);
void script(undefined);
void template(undefined);
void text(undefined);
void stream(undefined);
void object(undefined);
void objectStream(undefined);
void template('{{ value }}', undefined);
void text([], undefined);
void operation.run();
void operation.run(undefined);

const tool = create.Function.asTool({ inputSchema: z.object({ value: z.number(), extra: z.string().optional() }), execute: ({ value }) => value });
declare const open: { value: number } | { value: number; extra: string };
create.Function({ tools: { tool }, toolsContext: { tool: { value: 1 } }, execute: async ({ tool }) => {
	void tool();
	return tool(open);
} });

// Contextual callback inference survives complete-argument capture.
const callbacks = create.Function({ inputSchema: z.looseObject({ value: z.number(), map: z.function({ input: [z.number()], output: z.number() }).optional() }),
	context: { db: true }, execute: ({ value, map }) => map ? map(value) : value });
void callbacks({ value: 1, map: value => {
	expectEqual<typeof value, number>();
	return value * 2;
} });
void callbacks.run({ context: { value: 1, map: value => {
	expectEqual<typeof value, number>();
	return value * 2;
} } });
// @ts-expect-error Contextual callbacks cannot hide a private binding.
void callbacks({ value: 1, db: false, map: value => value });
// @ts-expect-error Named callback inputs cannot hide a private binding either.
void callbacks.run({ context: { value: 1, db: false, map: value => value } });
// @ts-expect-error The callback still must return its declared type.
void callbacks({ value: 1, map: value => String(value) });
const rendererCallbacks = create.Template({ inputSchema: z.object({ factor: z.string(), map: z.custom<(value: number) => number>() }),
	context: { factor: '3', db: true }, template: '{{ map(factor) }}' });
void rendererCallbacks({ map: value => value });
void rendererCallbacks.run({ context: { map: value => value } });
// @ts-expect-error A contextually typed callback cannot hide own undefined.
void rendererCallbacks({ factor: undefined, map: value => value });
// @ts-expect-error Supplied private names remain protected during callback inference.
void rendererCallbacks({ db: false, map: value => value });

// Mapped callback contexts and index signatures retain their named fields.
const privateChild = create.Function({ context: { userId: 'member' },
	execute: (input: { query: string; userId: string }) => input.userId });
create.Function.asTool({ inputSchema: z.object({ query: z.string() }), execute: input => privateChild(input) });
create.Function.asTool({ inputSchema: z.object({ query: z.string(), userId: z.string() }), execute: input => {
	// @ts-expect-error Forwarding does not make a named private replacement public.
	return privateChild(input);
} });
declare const indexedPublic: { query: string; [key: string]: unknown };
declare const indexedPrivate: { query: string; userId: string; [key: string]: unknown };
void privateChild(indexedPublic);
void privateChild.run({ context: indexedPublic });
// @ts-expect-error An index signature cannot hide an explicitly named private field.
void privateChild(indexedPrivate);
// @ts-expect-error Named calls preserve the same private-name check.
void privateChild.run({ context: indexedPrivate });

// Component alternatives may need narrowing; they must never weaken validation.
const required = create.Function({ inputSchema: z.object({ value: z.number() }), execute: ({ value }) => value });
const choice = choose ? required : operation;
// @ts-expect-error Different generic call contracts require narrowing here.
void choice({ value: 1 });
// @ts-expect-error A possible component still requires input.
void choice();
// @ts-expect-error Explicit undefined cannot satisfy a required application argument.
void required(undefined);
// @ts-expect-error Named calls retain the same required input.
void required.run(undefined);
// @ts-expect-error A union of components cannot hide an invalid catchall value.
void choice(invalid);
// @ts-expect-error Named calls also retain required input.
void choice.run();
// @ts-expect-error Named calls cannot hide the invalid alternative.
void choice.run({ context: invalid });
if (choose) void required({ value: 1 });
else void operation({ value: 1 });
const optionalChoice = choose ? operation : template;
void optionalChoice();
// @ts-expect-error Both optional components reject the invalid union.
void optionalChoice(invalid);
// @ts-expect-error Both optional components reject own undefined extras.
void optionalChoice(ownUndefined);

// A single renderer with conditional configuration must check every alternative.
const selectedDefaults = choose ? { inputSchema, context } : { inputSchema };
const selectedFunction = create.Function({ execute: ({ value }) => value }, { config: selectedDefaults });
const selectedScript = create.Script({ script: 'return value' }, { config: selectedDefaults });
const selectedTemplate = create.Template({ template: '{{ value }}' }, { config: selectedDefaults });
const selectedText = create.TextGenerator.withTemplate({ model, prompt: '{{ value }}' }, { config: selectedDefaults });
const selectedStream = create.TextStreamer.withScript({ model, prompt: 'return value' }, { config: selectedDefaults });
const selectedObject = create.ObjectGenerator.withTemplate({ model, prompt: '{{ value }}', schema: z.object({ answer: z.number() }) }, { config: selectedDefaults });
const selectedObjectStream = create.ObjectStreamer.withTemplate({ model, prompt: '{{ value }}', schema: z.object({ answer: z.number() }) }, { config: selectedDefaults });
void selectedFunction({ value: 2 });
void selectedScript({ value: 2 });
void selectedTemplate({ value: 2 });
void selectedText({ value: 2 });
void selectedStream({ value: 2 });
void selectedObject({ value: 2 });
void selectedObjectStream({ value: 2 });
// @ts-expect-error One selected configuration still needs caller input.
void selectedFunction();
// @ts-expect-error A renderer cannot take its zero-argument signature from just one configuration.
void selectedScript();
// @ts-expect-error Template input is required across the complete configuration.
void selectedTemplate();
// @ts-expect-error Text preparation retains the same required input.
void selectedText();
// @ts-expect-error Streaming preparation retains the same required input.
void selectedStream();
// @ts-expect-error Object preparation retains the same required input.
void selectedObject();
// @ts-expect-error Object streaming preparation retains the same required input.
void selectedObjectStream();
// @ts-expect-error An explicit source does not supply the missing application input.
void selectedTemplate('{{ value }}');
// @ts-expect-error Named calls retain the same completeness requirement.
void selectedTemplate.run({});
const completeDefaults = choose ? { inputSchema, context } : { inputSchema, context: { value: 2, db: 'private' } };
void create.Template({ template: '{{ value }}' }, { config: completeDefaults })();
void create.TextGenerator.withTemplate({ model, prompt: '{{ value }}' }, { config: completeDefaults })();
