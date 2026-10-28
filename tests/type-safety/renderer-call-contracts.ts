import { Output } from 'ai';
// Compile-only renderer boundaries: defaults may change, call arguments follow runtime dispatch.
import { create, z } from 'casai';
import type { LanguageModel, ModelMessage } from 'ai';
import type { ILoaderAny } from 'cascada-engine';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
const loader = (name: string) => name;
const schema = z.object({ answer: z.number() });
const messages: ModelMessage[] = [{ role: 'user', content: 'Answer.' }];

// Inline bodies are required at creation; named renderers may receive a name when called.
create.Template({ template: '' });
create.Script({ script: '' });
create.Script({ script: 'return 1', schema: z.number() });
const templateParent = create.Config({ template: 'Hello' });
const scriptParent = create.Config({ script: 'return 1' });
create.Template({}, templateParent);
create.Script({}, scriptParent);
create.Template({ template: 'Hello' }, create.Config({}));
create.Script({ script: 'return 1' }, create.Config({}));
// @ts-expect-error Inline scripts require a script body at creation.
create.Script({});
// @ts-expect-error An output schema cannot supply an inline script body.
create.Script({ schema: z.number() });
// @ts-expect-error An empty inherited config cannot supply a template body.
create.Template({}, create.Config({}));
// @ts-expect-error An empty inherited config cannot supply a script body.
create.Script({}, create.Config({}));
declare const optionalBody: { readonly config: { script?: string } };
// @ts-expect-error An optional inherited body cannot guarantee an inline script.
create.Script({}, optionalBody);
const namedTemplate = create.Template.loadsTemplate({ loader });
const namedScript = create.Script.loadsScript({ loader });
expectType<Promise<string>>(namedTemplate('source.njk'));
expectType<Promise<unknown>>(namedScript('source.casc'));
// @ts-expect-error A named template without a configured name requires a name when called.
void namedTemplate();
// @ts-expect-error A named script without a configured name requires a name when called.
void namedScript();

// Const inference must not lock renderer defaults to array lengths or nested literal values.
const template = create.Template({ template: '{{ list }} {{ settings.label }}', inputSchema: z.object({ list: z.array(z.number()), settings: z.object({ label: z.string(), flags: z.array(z.boolean()) }) }), context: { list: [1, 2], settings: { label: 'first', flags: [true] } } });
const script = create.Script({ script: 'return settings.label', inputSchema: z.object({ list: z.array(z.number()), settings: z.object({ label: z.string(), flags: z.array(z.boolean()) }) }), context: { list: [1, 2], settings: { label: 'first', flags: [true] } } });
const renderedText = create.LLMAgent.withTemplate({ model, prompt: '{{ list }}', inputSchema: z.object({ list: z.array(z.number()), nested: z.object({ value: z.number() }) }), context: { list: [1, 2], nested: { value: 1 } } });
const renderedStream = create.LLMAgent.withScript.asStream({ model, prompt: 'return nested.value', inputSchema: z.object({ list: z.array(z.number()), nested: z.object({ value: z.number() }) }), context: { list: [1, 2], nested: { value: 1 } } });
const renderedObject = create.LLMAgent.withScript({ model, prompt: 'return nested.value', inputSchema: z.object({ list: z.array(z.number()), nested: z.object({ value: z.number() }) }), context: { list: [1, 2], nested: { value: 1 } }, output: Output.object({ schema: schema }) });
const renderedObjectStream = create.LLMAgent.withTemplate.asStream({ model, prompt: '{{ list }}', inputSchema: z.object({ list: z.array(z.number()), nested: z.object({ value: z.number() }) }), context: { list: [1, 2], nested: { value: 1 } }, output: Output.object({ schema: schema }) });
void template({ list: [3], settings: { label: 'next', flags: [false, true] } });
void script({ list: [], settings: { label: 'next', flags: [] } });
void renderedText({ list: [3], nested: { value: 2 } });
void renderedStream({ list: [], nested: { value: 2 } });
void renderedObject.run({ context: { list: [3, 4, 5], nested: { value: 2 } } });
void renderedObjectStream.run({ context: { list: [3], nested: { value: 2 } } });
// @ts-expect-error Widening array literals preserves the element type.
void template({ list: ['wrong'] });
// @ts-expect-error Widening nested values preserves their primitive types.
void script({ settings: { label: 1, flags: [] } });
// @ts-expect-error Nested generator context retains number fields.
void renderedText({ nested: { value: 'wrong' } });
// @ts-expect-error Nested streamer run context retains number fields.
void renderedStream.run({ context: { nested: { value: 'wrong' } } });
const callbackContext = create.Template({ template: '{{ calculate(2) }}', context: { calculate: (value: number) => value + 1, date: new Date() } });
// @ts-expect-error Function and Date dependencies are private unless explicitly declared public.
void callbackContext({ calculate: (value: number) => value * 2, date: new Date() });
// @ts-expect-error Renderer context widening preserves callable argument contracts.
void callbackContext({ calculate: (value: string) => value.length });

// Rendered LLM calls distinguish valid message history from context arrays.
const optionalPrompt = create.LLMAgent.withTemplate({ model });
const optionalObjectPrompt = create.LLMAgent.withScript.asStream({ model, output: Output.object({ schema: schema }) });
void optionalPrompt('{{ topic }}', { topic: 'math' }, messages);
void optionalObjectPrompt('return topic', { topic: 'math' }, messages);
void renderedText({ list: [3] }, messages);
void renderedStream({ nested: { value: 2 } }, messages);
void renderedObject({}, messages);
void renderedObjectStream(undefined, { list: [3] }, messages);
// @ts-expect-error An unconfigured renderer still requires a prompt before history/context.
void optionalPrompt(messages, { topic: 'math' });
// @ts-expect-error Numeric arrays are invalid message history and cannot be context.
void renderedText([1, 2, 3]);
// @ts-expect-error Numeric arrays cannot masquerade as script context.
void renderedStream('return 1', [1, 2, 3]);
// @ts-expect-error Arrays in the third position cannot be context.
void renderedObject('return 1', messages, [1, 2, 3]);
// @ts-expect-error A message array cannot be provided twice.
void renderedObjectStream(messages, messages);
// @ts-expect-error Callable values cannot serve as renderer contexts.
void renderedText(() => 'context');

// Exposed configs contain normalized loaders for standalone and inherited components.
const configuredTemplate = create.Template({ template: 'Hello', loader });
const _configuredScript = create.Script({ script: 'return 1', loader });
const _loadedText = create.LLMAgent.loadsText({ model, loader, prompt: 'answer' });
const _loadedStream = create.LLMAgent.loadsScript.asStream({ model, loader, prompt: 'answer' });
const _loadedObject = create.LLMAgent.loadsTemplate({ model, loader, prompt: 'answer', output: Output.object({ schema: schema }) });
const _loadedObjectStream = create.LLMAgent.loadsText.asStream({ model, loader, prompt: 'answer', output: Output.object({ schema: schema }) });
expectEqual<typeof configuredTemplate.config.loader, ILoaderAny[]>();
expectEqual<typeof _configuredScript.config.loader, ILoaderAny[]>();
expectEqual<typeof _loadedText.config.loader, ILoaderAny[]>();
expectEqual<typeof _loadedStream.config.loader, ILoaderAny[]>();
expectEqual<typeof _loadedObject.config.loader, ILoaderAny[]>();
expectEqual<typeof _loadedObjectStream.config.loader, ILoaderAny[]>();
expectEqual<typeof namedTemplate.config.loader, ILoaderAny[]>();
expectEqual<typeof namedScript.config.loader, ILoaderAny[]>();
// @ts-expect-error A processed loader chain is no longer a raw loader callback.
expectType<(name: string) => string>(configuredTemplate.config.loader);
const loaderParent = create.Config({ loader });
const _inheritedTemplate = create.Template({ template: 'Hello' }, loaderParent);
expectEqual<typeof _inheritedTemplate.config.loader, ILoaderAny[]>();

// Select concrete components when their generic call contracts differ.
declare const chooseTemplate: boolean;
const templateRenderer = create.Template({ template: 'Ready' });
const scriptRenderer = create.Script({ script: 'return "Ready"' });
const mixedRenderer = chooseTemplate ? templateRenderer : scriptRenderer;
interface RendererInput { topic: string }
declare const rendererInput: RendererInput;
void mixedRenderer();
void (chooseTemplate ? templateRenderer(rendererInput) : scriptRenderer(rendererInput));
void (chooseTemplate ? templateRenderer('Ready', rendererInput) : scriptRenderer('Ready', rendererInput));
const textRenderer = create.LLMAgent.withTemplate({ model, prompt: '{{ topic }}' });
const objectRenderer = create.LLMAgent.withScript.asStream({ model, prompt: 'return topic', output: Output.object({ schema: schema }) });
const mixedLLM = chooseTemplate ? textRenderer : objectRenderer;
void mixedLLM();
void (chooseTemplate ? textRenderer(rendererInput) : objectRenderer(rendererInput));
void (chooseTemplate ? textRenderer(rendererInput, messages) : objectRenderer(rendererInput, messages));
void (chooseTemplate ? textRenderer('{{ topic }}', rendererInput, messages) : objectRenderer('{{ topic }}', rendererInput, messages));
void (chooseTemplate ? textRenderer.run({ context: rendererInput }) : objectRenderer.run({ context: rendererInput }));
const mixedScriptFunction = chooseTemplate ? create.Script({ script: 'return 1', schema: z.number() }) : create.Function({ execute: () => 1 });
expectType<Promise<number>>(mixedScriptFunction());

// Open context shapes still reject values dispatched as messages or callbacks.
const openTemplate = create.Template({ template: 'Ready' });
const openScript = create.Script({ script: 'return "Ready"' });
const openText = create.LLMAgent.withTemplate({ model, prompt: 'Ready' });
const openTextStream = create.LLMAgent.withScript.asStream({ model, prompt: 'return "Ready"' });
const openObject = create.LLMAgent.withTemplate({ model, prompt: 'Ready', output: Output.object({ schema: schema }) });
const openObjectStream = create.LLMAgent.withScript.asStream({ model, prompt: 'return "Ready"', output: Output.object({ schema: schema }) });
// @ts-expect-error Numeric arrays cannot be standalone template context.
void openTemplate([1, 2]);
// @ts-expect-error Callbacks cannot be standalone template context.
void openTemplate(() => 'Ready');
// @ts-expect-error Numeric arrays cannot be standalone script context.
void openScript([1, 2]);
// @ts-expect-error Callbacks cannot be standalone script context.
void openScript(() => 'Ready');
// @ts-expect-error Numeric arrays are neither message history nor text renderer context.
void openText([1, 2]);
// @ts-expect-error Callbacks cannot be text renderer context.
void openText(() => 'Ready');
// @ts-expect-error Numeric arrays are neither message history nor streamed text renderer context.
void openTextStream([1, 2]);
// @ts-expect-error Callbacks cannot be streamed text renderer context.
void openTextStream(() => 'Ready');
// @ts-expect-error Numeric arrays are neither message history nor object renderer context.
void openObject([1, 2]);
// @ts-expect-error Callbacks cannot be object renderer context.
void openObject(() => 'Ready');
// @ts-expect-error Numeric arrays are neither message history nor streamed object renderer context.
void openObjectStream([1, 2]);
// @ts-expect-error Callbacks cannot be streamed object renderer context.
void openObjectStream(() => 'Ready');
