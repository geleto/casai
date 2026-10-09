import { create, z } from 'casai';
import type { LanguageModel, ModelMessage } from 'ai';
import type { StreamTextResult, StreamObjectObjectResult, GenerateTextResult, GenerateObjectObjectResult } from 'casai';
import { expectType, expectEqual } from './assert.js';

declare const model: LanguageModel;
const schema = z.object({ answer: z.number() });
const loader = (name: string) => name;
const messages: ModelMessage[] = [{ role: 'user', content: 'Answer.' }];
const parent = create.Config({ model });
// eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type -- No configured tools means no names, including an index signature.
type NoTools = Record<never, never>;

// Plain prompts accept strings or messages. Only configured prompts/history allow omission.
const text = create.TextGenerator({ model, prompt: 'Answer.' });
const stream = create.TextStreamer({ model, messages });
const object = create.ObjectGenerator({ model, schema, prompt: messages });
const objectStream = create.ObjectStreamer({ model, schema, prompt: 'Answer.' });
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
// @ts-expect-error Plain text calls cannot supply message history twice.
void text(messages, messages);
// @ts-expect-error Plain text stream calls cannot supply message history twice.
void stream(messages, messages);
// @ts-expect-error Plain object calls cannot supply message history twice.
void object(messages, messages);
// @ts-expect-error Plain object stream calls cannot supply message history twice.
void objectStream(messages, messages);
// @ts-expect-error A scalar is neither a prompt nor message history.
void text(123);
// @ts-expect-error Plain prompts do not take positional context.
void stream({ topic: 'math' });
// @ts-expect-error The second plain-prompt argument is message history.
void object('Replace.', { topic: 'math' });
// @ts-expect-error Plain prompts have no third positional argument.
void objectStream('Replace.', messages, {});

const unconfiguredText = create.TextGenerator({ model });
const unconfiguredStream = create.TextStreamer({}, parent);
const unconfiguredObject = create.ObjectGenerator({ schema }, parent);
const unconfiguredObjectStream = create.ObjectStreamer({ model, schema });
void unconfiguredText('Answer.');
void unconfiguredStream(messages);
void unconfiguredObject(messages);
void unconfiguredObjectStream('Answer.');
void unconfiguredText.run({ prompt: 'Answer.' });
void unconfiguredStream.run({ messages });
void unconfiguredObject.run({ messages });
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
expectType<ReadableStream<string>>(stream().textStream);
expectType<PromiseLike<string>>(stream().text);
expectType<PromiseLike<{ answer: number }>>(objectStream().object);
// @ts-expect-error A plain text stream result is not itself a promise.
expectType<unknown>(stream().then);
// @ts-expect-error A plain object stream result is not itself a promise.
expectType<unknown>(objectStream().then);

// Template and script renderers accept context, or a prompt plus context/history.
const templateText = create.TextGenerator.withTemplate({ model, prompt: '{{ topic }}' });
const templateStream = create.TextStreamer.withTemplate({ prompt: '{{ topic }}' }, parent);
const templateObject = create.ObjectGenerator.withTemplate({ model, schema, prompt: '{{ topic }}' });
const templateObjectStream = create.ObjectStreamer.withTemplate({ schema, prompt: '{{ topic }}' }, parent);
const scriptText = create.TextGenerator.withScript({ model, prompt: 'return topic' });
const scriptStream = create.TextStreamer.withScript({ prompt: 'return topic' }, parent);
const scriptObject = create.ObjectGenerator.withScript({ model, schema, prompt: 'return topic' });
const scriptObjectStream = create.ObjectStreamer.withScript({ schema, prompt: 'return topic' }, parent);
void templateText({ topic: 'math' });
void templateStream('Replacement {{ topic }}', { topic: 'math' });
void templateObject('Replacement {{ topic }}', messages, { topic: 'math' });
void templateObjectStream({ topic: 'math' });
void scriptText({ topic: 'math' });
void scriptStream('return topic', messages, { topic: 'math' });
void scriptObject('return topic', { topic: 'math' });
void scriptObjectStream();
expectEqual<ReturnType<typeof templateStream>, Promise<StreamTextResult<NoTools>>>();
expectEqual<ReturnType<typeof scriptObjectStream>, Promise<StreamObjectObjectResult<{ answer: number }>>>();
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
const needsTemplate = create.TextGenerator.withTemplate({ model });
const needsScript = create.ObjectStreamer.withScript({ model, schema });
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
const loadedText = create.TextGenerator.loadsText({ model, loader, prompt: 'answer.txt' });
const loadedTextStream = create.TextStreamer.loadsText({ loader, prompt: 'answer.txt' }, parent);
const loadedObject = create.ObjectGenerator.loadsText({ model, schema, loader, prompt: 'answer.txt' });
const loadedObjectStream = create.ObjectStreamer.loadsText({ schema, loader, prompt: 'answer.txt' }, parent);
const loadedTemplate = create.TextGenerator.loadsTemplate({ model, loader, prompt: 'answer.njk' });
const loadedTemplateStream = create.TextStreamer.loadsTemplate({ loader, prompt: 'answer.njk' }, parent);
const loadedTemplateObject = create.ObjectGenerator.loadsTemplate({ model, schema, loader, prompt: 'answer.njk' });
const loadedTemplateObjectStream = create.ObjectStreamer.loadsTemplate({ schema, loader, prompt: 'answer.njk' }, parent);
const loadedScript = create.TextGenerator.loadsScript({ model, loader, prompt: 'answer.casc' });
const loadedScriptStream = create.TextStreamer.loadsScript({ loader, prompt: 'answer.casc' }, parent);
const loadedScriptObject = create.ObjectGenerator.loadsScript({ model, schema, loader, prompt: 'answer.casc' });
const loadedScriptObjectStream = create.ObjectStreamer.loadsScript({ schema, loader, prompt: 'answer.casc' }, parent);
void loadedText();
void loadedTextStream();
void loadedObject('other.txt');
void loadedObjectStream('other.txt');
void loadedTemplate({ topic: 'math' });
void loadedTemplateStream('other.njk', { topic: 'math' });
void loadedTemplateObject('other.njk', messages, { topic: 'math' });
void loadedTemplateObjectStream();
void loadedScript({ topic: 'math' });
void loadedScriptStream('other.casc', { topic: 'math' });
void loadedScriptObject('other.casc', messages, { topic: 'math' });
void loadedScriptObjectStream();
expectEqual<ReturnType<typeof loadedTextStream>, Promise<StreamTextResult<NoTools>>>();
expectEqual<ReturnType<typeof loadedTemplateStream>, Promise<StreamTextResult<NoTools>>>();
expectEqual<ReturnType<typeof loadedScriptObjectStream>, Promise<StreamObjectObjectResult<{ answer: number }>>>();
// @ts-expect-error Loaded text config stores a filename, not messages.
create.TextGenerator.loadsText({ model, loader, prompt: messages });
// @ts-expect-error A loaded template requires a loader.
create.TextStreamer.loadsTemplate({ model, prompt: 'answer.njk' });
// @ts-expect-error A loaded object script requires a loader.
create.ObjectGenerator.loadsScript({ model, schema, prompt: 'answer.casc' });
// @ts-expect-error Loaded scripts use string filenames.
create.ObjectStreamer.loadsScript({ model, schema, loader, prompt: messages });

// Function prompts accept sync/async strings or message arrays, and context-only calls.
const functionText = create.TextGenerator.withFunction({ model, prompt: () => 'Answer.' });
const functionStream = create.TextStreamer.withFunction({ prompt: async () => messages }, parent);
const functionObject = create.ObjectGenerator.withFunction({ model, schema, prompt: () => messages });
const functionObjectStream = create.ObjectStreamer.withFunction({ schema, prompt: async () => 'Answer.' }, parent);
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
expectEqual<typeof _objectRun, Promise<GenerateObjectObjectResult<{ answer: number }>>>();
expectEqual<typeof _templateStreamRun, Promise<StreamTextResult<NoTools>>>();
expectEqual<typeof _scriptObjectStreamRun, Promise<StreamObjectObjectResult<{ answer: number }>>>();
expectEqual<typeof _functionStreamRun, Promise<StreamTextResult<NoTools>>>();
// @ts-expect-error Function prompts accept context, not positional prompt replacements.
void functionText('Replace.');
// @ts-expect-error Function prompts reject arrays even when no input schema is configured.
void functionText(messages);
// @ts-expect-error One-off run contexts are objects, not message arrays.
void functionText.run({ context: messages });
// @ts-expect-error Function prompts accept one context argument.
void functionStream({}, messages);
// @ts-expect-error Function prompt replacements must remain callbacks.
void functionObject.run({ prompt: 'Replace.' });
// @ts-expect-error Function prompt callbacks must return string or message arrays.
create.ObjectStreamer.withFunction({ model, schema, prompt: () => 123 });
// @ts-expect-error Async prompt callbacks must resolve to valid prompts.
create.TextGenerator.withFunction({ model, prompt: async () => ({ content: 'Answer.' }) });
// @ts-expect-error A function prompt is required at creation or inherited from a parent.
create.TextStreamer.withFunction({ model });
// @ts-expect-error A function prompt cannot be a string at creation.
create.ObjectGenerator.withFunction({ model, schema, prompt: 'Answer.' });

const inheritedFunctionPrompt = create.Config({ model, prompt: () => messages });
void create.TextGenerator.withFunction({}, inheritedFunctionPrompt)();
void create.TextStreamer.withFunction({}, inheritedFunctionPrompt)();
void create.ObjectGenerator.withFunction({ schema }, inheritedFunctionPrompt)();
void create.ObjectStreamer.withFunction({ schema }, inheritedFunctionPrompt)();

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
const defaultPrompt = create.TextGenerator.withTemplate({ model, inputSchema: defaultInput, prompt: '{{ topic }}' });
void defaultPrompt();
void defaultPrompt.run({});
// @ts-expect-error Defaults do not make incompatible supplied field types valid.
void defaultPrompt({ topic: 123 });

const rawInput = z.object({ value: z.string().transform(Number) });
const rawTemplate = create.Template({ inputSchema: rawInput, template: '{{ value }}' });
const rawScript = create.Script({ inputSchema: rawInput, script: 'return value', schema: z.string() });
const rawObject = create.ObjectGenerator.withTemplate({ model, schema, inputSchema: rawInput, prompt: '{{ value }}' });
const rawObjectStream = create.ObjectStreamer.withScript({ model, schema, inputSchema: rawInput, prompt: 'return value' });
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
