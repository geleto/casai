import type { EmptyMap } from './assert.js';
import { Output } from 'ai';
import { create, z } from 'casai';
import type { LanguageModel, ModelMessage } from 'ai';
import type { StreamTextResult, GenerateTextResult } from 'casai';
import { expectType, expectEqual } from './assert.js';

declare const model: LanguageModel;
const schema = z.object({ answer: z.number() });
const structuredOutput = Output.object({ schema });
const loader = (name: string) => name;
const messages: ModelMessage[] = [{ role: 'user', content: 'Answer.' }];
const parent = create.Config({ model });

type NoTools = EmptyMap;

// Plain prompts accept strings or messages. Only configured prompts/history allow omission.
const text = create.LLMAgent({ model, prompt: 'Answer.' });
const stream = create.LLMAgent.asStream({ model, prompt: messages });
const object = create.LLMAgent({ model, prompt: messages, output: Output.object({ schema: schema }) });
const objectStream = create.LLMAgent.asStream({ model, prompt: 'Answer.', output: Output.object({ schema: schema }) });
void text();
void text('Replace.', messages);
void text(messages);
void text(undefined);
void stream();
void stream('Replace.');
void object();
void object(messages);
void objectStream();
void objectStream(messages);
void text(undefined, messages);
// A new prompt array can be supplied separately from history.
void text(messages, messages);
// A new prompt array can be supplied separately from history.
void stream(messages, messages);
// A new prompt array can be supplied separately from history.
void object(messages, messages);
// A new prompt array can be supplied separately from history.
void objectStream(messages, messages);
// @ts-expect-error A scalar is neither a prompt nor message history.
void text(123);
// Literal agents accept the same context as prepared agents.
void stream({ topic: 'math' });
// Named application context can follow an explicit prompt.
void object('Replace.', { topic: 'math' });
// @ts-expect-error Plain prompts have no third positional argument.
void objectStream('Replace.', messages, {});

const unconfiguredText = create.LLMAgent({ model });
const unconfiguredStream = create.LLMAgent.asStream({}, parent);
const unconfiguredObject = create.LLMAgent({ output: Output.object({ schema: schema }) }, parent);
const unconfiguredObjectStream = create.LLMAgent.asStream({ model, output: Output.object({ schema: schema }) });
void unconfiguredText('Answer.');
void unconfiguredStream(messages);
void unconfiguredObject(messages);
void unconfiguredObjectStream('Answer.');
void unconfiguredText.run({ prompt: 'Answer.' });
void unconfiguredStream.run({ messageHistory: messages });
void unconfiguredObject.run({ messageHistory: messages });
void unconfiguredObjectStream.run({ prompt: 'Answer.' });
// @ts-expect-error An unconfigured generator needs a prompt or messages.
void unconfiguredText();
// @ts-expect-error An unconfigured text streamer needs a prompt or messages.
void unconfiguredStream();
// @ts-expect-error An unconfigured object generator needs a prompt or messages.
void unconfiguredObject();
// @ts-expect-error An unconfigured object streamer needs a prompt or messages.
void unconfiguredObjectStream();
// @ts-expect-error An unconfigured generator run needs a prompt or messages.
void unconfiguredText.run({});
// @ts-expect-error An unconfigured text streamer run needs a prompt or messages.
void unconfiguredStream.run({});
// @ts-expect-error An unconfigured object generator run needs a prompt or messages.
void unconfiguredObject.run({});
// @ts-expect-error An unconfigured object streamer run needs a prompt or messages.
void unconfiguredObjectStream.run({});

// Streamers return SDK results directly for plain prompts.
expectType<ReadableStream<string>>((await stream()).textStream);
expectType<PromiseLike<string>>((await stream()).text);
expectType<PromiseLike<{ answer: number }>>((await objectStream()).output);
// All stream calls return promises.
expectType<Promise<unknown>>(stream());
// Explicit structured streams also await preparation before returning.
expectType<Promise<unknown>>(objectStream());

// Template and script renderers accept context, or a prompt plus context/history.
const templateText = create.LLMAgent.withTemplate({ model, prompt: '{{ topic }}' });
const templateStream = create.LLMAgent.withTemplate.asStream({ prompt: '{{ topic }}' }, parent);
const templateObject = create.LLMAgent.withTemplate({ model, prompt: '{{ topic }}', output: Output.object({ schema: schema }) });
const templateObjectStream = create.LLMAgent.withTemplate.asStream({ prompt: '{{ topic }}', output: Output.object({ schema: schema }) }, parent);
const scriptText = create.LLMAgent.withScript({ model, prompt: 'return topic' });
const scriptStream = create.LLMAgent.withScript.asStream({ prompt: 'return topic' }, parent);
const scriptObject = create.LLMAgent.withScript({ model, prompt: 'return topic', output: Output.object({ schema: schema }) });
const scriptObjectStream = create.LLMAgent.withScript.asStream({ prompt: 'return topic', output: Output.object({ schema: schema }) }, parent);
void templateText({ topic: 'math' });
void templateStream('Replacement {{ topic }}', { topic: 'math' });
void templateObject('Replacement {{ topic }}', { topic: 'math' }, messages);
void templateObjectStream({ topic: 'math' });
void scriptText({ topic: 'math' });
void scriptStream('return topic', { topic: 'math' }, messages);
void scriptObject('return topic', { topic: 'math' });
void scriptObjectStream();
expectEqual<ReturnType<typeof templateStream>, Promise<StreamTextResult<NoTools>>>();
expectEqual<ReturnType<typeof scriptObjectStream>, Promise<StreamTextResult<NoTools, typeof structuredOutput>>>();
// @ts-expect-error Template invocation accepts a string or context object.
void templateText(123);
// @ts-expect-error Template history must be an array of messages.
void templateStream('Replace.', 123, {});
// @ts-expect-error Template context must be an object.
void templateObject('Replace.', messages, 123);
// @ts-expect-error A rendered stream result requires awaiting rendering.
expectType<unknown>(templateObjectStream().object);
// @ts-expect-error Script invocation accepts a string or context object.
void scriptText(123);
// @ts-expect-error Script context must be an object.
void scriptStream('return 1', false);
// @ts-expect-error An object script invocation accepts a string or context object.
void scriptObject(false);
// @ts-expect-error A rendered stream result requires awaiting rendering.
expectType<unknown>(scriptObjectStream().object);

// Omitted rendered prompts must be supplied at invocation.
const needsTemplate = create.LLMAgent.withTemplate({ model });
const needsScript = create.LLMAgent.withScript.asStream({ model, output: Output.object({ schema: schema }) });
void needsTemplate('{{ topic }}', { topic: 'math' });
void needsScript('return topic', { topic: 'math' });
// @ts-expect-error No template was configured.
void needsTemplate();
// @ts-expect-error No script was configured.
void needsScript();
void needsTemplate.run({ prompt: '{{ topic }}', context: { topic: 'math' } });
void needsScript.run({ prompt: 'return topic', context: { topic: 'math' } });
// @ts-expect-error A rendered run still needs an unconfigured template.
void needsTemplate.run({ context: { topic: 'math' } });
// @ts-expect-error A rendered run still needs an unconfigured script.
void needsScript.run({ context: { topic: 'math' } });

// Every named prompt modifier keeps its loader and prompt-name contracts.
const loadedText = create.LLMAgent.loadsText({ model, loader, prompt: 'answer.txt' });
const loadedTextStream = create.LLMAgent.loadsText.asStream({ loader, prompt: 'answer.txt' }, parent);
const loadedObject = create.LLMAgent.loadsText({ model, loader, prompt: 'answer.txt', output: Output.object({ schema: schema }) });
const loadedObjectStream = create.LLMAgent.loadsText.asStream({ loader, prompt: 'answer.txt', output: Output.object({ schema: schema }) }, parent);
const loadedTemplate = create.LLMAgent.loadsTemplate({ model, loader, prompt: 'answer.njk' });
const loadedTemplateStream = create.LLMAgent.loadsTemplate.asStream({ loader, prompt: 'answer.njk' }, parent);
const loadedTemplateObject = create.LLMAgent.loadsTemplate({ model, loader, prompt: 'answer.njk', output: Output.object({ schema: schema }) });
const loadedTemplateObjectStream = create.LLMAgent.loadsTemplate.asStream({ loader, prompt: 'answer.njk', output: Output.object({ schema: schema }) }, parent);
const loadedScript = create.LLMAgent.loadsScript({ model, loader, prompt: 'answer.casc' });
const loadedScriptStream = create.LLMAgent.loadsScript.asStream({ loader, prompt: 'answer.casc' }, parent);
const loadedScriptObject = create.LLMAgent.loadsScript({ model, loader, prompt: 'answer.casc', output: Output.object({ schema: schema }) });
const loadedScriptObjectStream = create.LLMAgent.loadsScript.asStream({ loader, prompt: 'answer.casc', output: Output.object({ schema: schema }) }, parent);
void loadedText();
void loadedTextStream();
void loadedObject('other.txt');
void loadedObjectStream('other.txt');
void loadedTemplate({ topic: 'math' });
void loadedTemplateStream('other.njk', { topic: 'math' });
void loadedTemplateObject('other.njk', { topic: 'math' }, messages);
void loadedTemplateObjectStream();
void loadedScript({ topic: 'math' });
void loadedScriptStream('other.casc', { topic: 'math' });
void loadedScriptObject('other.casc', { topic: 'math' }, messages);
void loadedScriptObjectStream();
expectEqual<ReturnType<typeof loadedTextStream>, Promise<StreamTextResult<NoTools>>>();
expectEqual<ReturnType<typeof loadedTemplateStream>, Promise<StreamTextResult<NoTools>>>();
expectEqual<ReturnType<typeof loadedScriptObjectStream>, Promise<StreamTextResult<NoTools, typeof structuredOutput>>>();
// @ts-expect-error Loaded text config stores a filename, not messages.
create.LLMAgent.loadsText({ model, loader, prompt: messages });
// @ts-expect-error A loaded template requires a loader.
create.LLMAgent.loadsTemplate.asStream({ model, prompt: 'answer.njk' });
// @ts-expect-error A loaded object script requires a loader.
create.LLMAgent.loadsScript({ model, prompt: 'answer.casc', output: Output.object({ schema: schema }) });
// @ts-expect-error Loaded scripts use string filenames.
create.LLMAgent.loadsScript.asStream({ model, loader, prompt: messages, output: Output.object({ schema: schema }) });

// Function prompts accept sync/async strings or message arrays, and context-only calls.
const functionText = create.LLMAgent.withFunction({ model, prompt: () => 'Answer.' });
const functionStream = create.LLMAgent.withFunction.asStream({ prompt: async () => messages }, parent);
const functionObject = create.LLMAgent.withFunction({ model, prompt: () => messages, output: Output.object({ schema: schema }) });
const functionObjectStream = create.LLMAgent.withFunction.asStream({ prompt: async () => 'Answer.', output: Output.object({ schema: schema }) }, parent);
void functionText();
void functionStream({ topic: 'math' });
void functionObject({ topic: 'math' });
void functionObjectStream();
interface PromptContext { topic: string }
declare const typedPromptContext: PromptContext;
void functionText(typedPromptContext);
void functionText.run({ context: typedPromptContext });
void functionText.run({ prompt: async () => messages });
void functionStream.run({ prompt: () => 'Replace.' });
void functionObject.run({ prompt: () => messages });
void functionObjectStream.run({ prompt: async () => 'Replace.' });
expectEqual<ReturnType<typeof functionStream>, Promise<StreamTextResult<NoTools>>>();
const _textRun = text.run({});
const _objectRun = object.run({});
const _templateStreamRun = templateStream.run({});
const _scriptObjectStreamRun = scriptObjectStream.run({});
const _functionStreamRun = functionStream.run({});
expectEqual<typeof _textRun, Promise<GenerateTextResult<NoTools>>>();
expectEqual<typeof _objectRun, Promise<GenerateTextResult<NoTools, typeof structuredOutput>>>();
expectEqual<typeof _templateStreamRun, Promise<StreamTextResult<NoTools>>>();
expectEqual<typeof _scriptObjectStreamRun, Promise<StreamTextResult<NoTools, typeof structuredOutput>>>();
expectEqual<typeof _functionStreamRun, Promise<StreamTextResult<NoTools>>>();
// @ts-expect-error Function prompts accept context, not positional prompt replacements.
void functionText('Replace.');
// @ts-expect-error Function prompts reject arrays even when no input schema is configured.
void functionText(messages);
// @ts-expect-error One-off run contexts are objects, not message arrays.
void functionText.run({ context: messages });
// Function prompts accept context followed by history.
void functionStream({}, messages);
// @ts-expect-error Function prompt replacements must remain callbacks.
void functionObject.run({ prompt: 'Replace.' });
// @ts-expect-error Function prompt callbacks must return string or message arrays.
create.LLMAgent.withFunction.asStream({ model, prompt: () => 123, output: Output.object({ schema: schema }) });
// @ts-expect-error Async prompt callbacks must resolve to valid prompts.
create.LLMAgent.withFunction({ model, prompt: async () => ({ content: 'Answer.' }) });
// An ordinary function source may be supplied at call time.
create.LLMAgent.withFunction.asStream({ model });
// @ts-expect-error A function prompt cannot be a string at creation.
create.LLMAgent.withFunction({ model, prompt: 'Answer.', output: Output.object({ schema: schema }) });

const inheritedFunctionPrompt = create.Config({ model, prompt: () => messages });
void create.LLMAgent.withFunction({}, inheritedFunctionPrompt)();
void create.LLMAgent.withFunction.asStream({}, inheritedFunctionPrompt)();
void create.LLMAgent.withFunction({ output: Output.object({ schema: schema }) }, inheritedFunctionPrompt)();
void create.LLMAgent.withFunction.asStream({ output: Output.object({ schema: schema }) }, inheritedFunctionPrompt)();

// Input validation keeps raw values; Zod field defaults permit an empty context.
const defaultInput = z.object({ topic: z.string().default('math') });
const defaultFunction = create.Function({ inputSchema: defaultInput, execute: ({ topic }) => topic ?? 'math' });
void defaultFunction();
void defaultFunction({ topic: 'science' });
// @ts-expect-error Optional Function input fields retain their declared types.
void defaultFunction({ topic: 123 });
const noInputFunction = create.Function({ execute: () => 'value' });
void noInputFunction();
void create.Template({ inputSchema: defaultInput, template: '{{ topic }}' })();
void create.Script({ inputSchema: defaultInput, script: 'return topic' })();
const defaultPrompt = create.LLMAgent.withTemplate({ model, inputSchema: defaultInput, prompt: '{{ topic }}' });
void defaultPrompt();
void defaultPrompt.run({});
// @ts-expect-error Defaults do not make incompatible supplied field types valid.
void defaultPrompt({ topic: 123 });

const rawInput = z.object({ value: z.string().transform(Number) });
const rawTemplate = create.Template({ inputSchema: rawInput, template: '{{ value }}' });
const rawScript = create.Script({ inputSchema: rawInput, script: 'return value', schema: z.string() });
const rawObject = create.LLMAgent.withTemplate({ model, inputSchema: rawInput, prompt: '{{ value }}', output: Output.object({ schema: schema }) });
const rawObjectStream = create.LLMAgent.withScript.asStream({ model, inputSchema: rawInput, prompt: 'return value', output: Output.object({ schema: schema }) });
void rawTemplate({ value: '1' });
void rawScript({ value: '1' });
void rawObject({ value: '1' });
void rawObjectStream.run({ context: { value: '1' } });
// @ts-expect-error Ordinary templates receive unparsed input.
void rawTemplate({ value: 1 });
// @ts-expect-error Ordinary scripts receive unparsed input.
void rawScript({ value: 1 });
// @ts-expect-error Object generation template calls receive unparsed input.
void rawObject({ value: 1 });
// @ts-expect-error Rendered streamer runs receive unparsed input.
void rawObjectStream.run({ context: { value: 1 } });



export { structuredOutput };
