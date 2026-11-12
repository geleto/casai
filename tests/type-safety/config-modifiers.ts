/* eslint-disable @typescript-eslint/no-unsafe-call -- Negative checks intentionally call unavailable modifier methods. */
import { Config, create, z } from 'casai';
import type { LanguageModel, EmbeddingModel } from 'ai';
import type { LLMAgentConfig, TemplateConfig, ScriptConfig, TemplateToolConfig, ScriptToolConfig } from 'casai';
import { expectEqual, type EmptyMap as Empty } from './assert.js';

declare const model: LanguageModel;
declare const embedding: EmbeddingModel;
declare const choose: boolean;
// @ts-expect-error Contextual return typing cannot invent configuration fields.
const _invented: { config: { context: { missing: true } } } = Config({ context: { present: 1 } });
const inputSchema = z.object({ count: z.string().transform(Number) });
const prepared = Config.withFunction({ inputSchema, prompt: context => {
	expectEqual<typeof context.count, number>();
	// @ts-expect-error Function preparers consume parsed schema values.
	const _raw: string = context.count;
	return String(context.count);
} });
const agent = create.LLMAgent({ model }, Config({}, prepared));
void agent({ count: '2' });
// @ts-expect-error Inherited context remains required.
void agent();
// @ts-expect-error Invocation inputs describe schema input.
void agent({ count: 2 });
// @ts-expect-error The selected source cannot be replaced with text.
void agent('replacement', { count: '2' });
void create.LLMAgent.withText({ model, prompt: 'literal' }, prepared)({ count: '2' });
Config({ prompt: context => {
	expectEqual<typeof context.count, number>();
	return String(context.count);
} }, prepared);
Config({ ...prepared.config, prompt: context => {
	expectEqual<typeof context.count, number>();
	return String(context.count);
} });

const toolDefaults = Config.withTemplate.asTool({ inputSchema, prompt: '{{ count }}' });
const tool = create.LLMAgent({ model }, toolDefaults);
expectEqual<typeof tool.config.asTool, true>();
void tool({ count: '2' });
void tool.execute({ count: 2 }, { toolCallId: 'call', messages: [], context: undefined });
// @ts-expect-error Tool fragments preserve the SDK Tool interface rather than Agent methods.
void tool.generate({ prompt: 'literal' });
// @ts-expect-error Input remains required after an intermediate fragment.
void create.LLMAgent({ model }, Config({}, toolDefaults))();

const streaming = Config.withFunction.asStream({ inputSchema, prompt: ({ count }) => String(count) });
const stream = create.LLMAgent({ model }, streaming);
expectEqual<typeof stream.config.streaming, true>();
void stream({ count: '2' }).then(result => result.textStream);
const _enabled = Config.asTool({ asTool: undefined });
expectEqual<typeof _enabled.config.asTool, true>();
const _enabledStream = Config.asStream({ streaming: undefined });
expectEqual<typeof _enabledStream.config.streaming, true>();
const _enabledParent = Config.asTool({}, Config({ asTool: undefined }));
expectEqual<typeof _enabledParent.config.asTool, true>();
const delivery = choose ? toolDefaults : streaming;
void create.LLMAgent({ model }, Config({}, delivery))({ count: '2' });

const mode = choose ? Config.withText({ input: 'literal' }) : Config.withFunction({ input: () => 'prepared' });
const mixed = create.Embedder({ model: embedding }, Config({}, mode));
void mixed();
void mixed.run({});
// @ts-expect-error Replacement must be valid for both possible source modes.
void mixed('replacement');
// @ts-expect-error Neither union branch may weaken named source checking.
void mixed.run({ input: () => 'replacement' });
void create.Embedder.withText({ model: embedding, input: 'replacement' }, mode)('another');
void create.Embedder.withText({ ...Config.withFunction({ input: () => 'prepared' }).config, model: embedding, input: 'replacement' })('another');
void create.Embedder.withFunction({ ...Config.withText({ input: 'literal' }).config, model: embedding, input: () => 'replacement' })();
void create.Template.withTemplate({ ...Config.withText({}).config, template: 'replacement' })();
void create.Script.withScript({ ...Config.withFunction({}).config, script: 'return 1' })();
Config.withTemplate({ ...Config.withFunction({}).config, template: 'replacement' });
Config.withScript({ ...Config.withText({}).config, script: 'return 1' });
// @ts-expect-error A base renderer must still support the retained source mode.
create.Template({ ...Config.withText({}).config, template: 'invalid' });
// @ts-expect-error A base script must still support the retained source mode.
create.Script({ ...Config.withFunction({}).config, script: 'return 1' });

const agentModes = choose ? Config.withText({ prompt: 'literal' }) : Config.withFunction({ prompt: () => 'prepared' });
const mixedAgent = create.LLMAgent({ model }, agentModes);
void mixedAgent();
// @ts-expect-error A union of fragment providers retains both source contracts.
void mixedAgent('replacement');
const templateModes = choose ? Config.withTemplate({ template: 'inline' }) : Config.loadsTemplate({ template: 'entry', loader: { load: () => 'loaded' } });
void create.Template({}, templateModes)();
const functionModes = choose ? Config({ execute: () => 1 }) : Config.asTool({ execute: () => 2, inputSchema: z.object({}) });
void create.Function({}, functionModes)();

Config.loadsTemplate.asTool({});
Config.loadsScript.asStream({});
Config.loadsText({});
// @ts-expect-error The consuming component requires a loader and source for a loaded tool.
create.LLMAgent({ model, inputSchema: z.object({}) }, Config.loadsTemplate.asTool({}));
// @ts-expect-error A Config modifier still has to fit one component configuration.
Config.withText({ script: 'return 1' });
// @ts-expect-error Streaming settings do not apply to coded Function fragments.
Config.asStream({ execute: () => 'hello' });
// @ts-expect-error A source modifier is not compatible with Function execute.
Config.withFunction({ execute: () => 'hello' });
// @ts-expect-error A loaded source cannot hide unrelated specialized fields.
Config.loadsScript({ input: 'entry', documents: ['a'] });
// @ts-expect-error Complete and streaming tool flags have no compatible current owner.
Config.asStream({}, toolDefaults);
// @ts-expect-error The restriction applies in both inheritance directions.
Config.asTool({}, streaming);
// @ts-expect-error Empty fragments cannot combine unsupported delivery modes either.
Config.asStream({}, Config.asTool({}));
// @ts-expect-error Empty fragments retain the same restriction in the other direction.
Config.asTool({}, Config.asStream({}));
// @ts-expect-error An empty child must check the inherited component shape after selecting delivery.
Config.asStream({}, Config({ execute: () => 1 }));
// @ts-expect-error An empty child must check the inherited coded source after selecting its mode.
Config.withFunction({}, Config({ template: 'inline' }));
// @ts-expect-error Explicit flags cannot bypass modifier compatibility.
Config({ asTool: true, streaming: true });
// @ts-expect-error A component must support the inherited delivery modifier.
create.Embedder({ model: embedding, input: 'hello' }, Config.asStream({}));
// @ts-expect-error Canonical modifier ordering is source, streaming, tool.
Config.asTool.withText({});
// @ts-expect-error No current component implements a streaming tool modifier chain.
Config.withFunction.asStream.asTool({});

const raw = { promptType: 'text' as const };
// @ts-expect-error Supplied parents retain structural checking even when the child replaces a field.
Config({ debug: true }, { config: { debug: 'invalid' } });
// @ts-expect-error Function parent inference must retain the existing structural check too.
create.Function({ debug: true, execute: () => 1 }, { config: { debug: 'invalid' } });
// @ts-expect-error Authored promptType is rejected through variables.
Config(raw);
// @ts-expect-error Source modifiers cannot hide an authored promptType.
Config.withText({ ...raw });
// @ts-expect-error Even an undefined authored key is rejected.
create.LLMAgent.withTemplate({ model, promptType: undefined, prompt: 'hello' });
// @ts-expect-error Parent configuration cannot restore the removed public field.
create.LLMAgent({ model }, { config: raw });
// @ts-expect-error Selected mode metadata is no longer a public named config property.
type _RemovedSource = typeof agent.config.promptType;
// @ts-expect-error The removed setting cannot be supplied at invocation.
void agent.run({ promptType: 'text', context: { count: '2' } });

const application = Config.withTemplate.asTool({ inputSchema: z.object({ promptType: z.string() }), template: '{{ promptType }}' });
void create.Template({}, application)({ promptType: 'data' });

// Every native source field follows its selector, including inherited values.
Config.withText({ input: ['one', 'two'] });
Config.withTemplate({ input: '{{ count }}' });
Config.withText({ audio: new Uint8Array() });
Config.withText({ instructions: [{ role: 'system', content: 'Native agent instructions.' }] });
Config.withFunction({ instructions: 'Native agent instructions.', prompt: () => 'prepared' });
Config.withTemplate({ instructions: [{ role: 'system', content: 'Native agent instructions.' }] });
Config.withFunction({ query: () => 'prepared' }, Config({ query: 'literal' }));
// @ts-expect-error Literal embedding input cannot be a preparer.
Config.withText({ input: () => 'prepared' });
// @ts-expect-error An embedding template is text, not a native input array.
Config.withTemplate({ input: ['literal'] });
// @ts-expect-error Literal speech input cannot be a preparer.
Config.withText({ text: () => 'prepared' });
// @ts-expect-error Literal audio input cannot be a preparer.
Config.withText({ audio: () => new Uint8Array() });
// @ts-expect-error Literal decision state cannot be a preparer.
Config.withText({ state: () => 'prepared' });
// @ts-expect-error Literal voice instructions cannot be a preparer.
Config.withText({ instructions: () => 'prepared' });
// @ts-expect-error Voice source interpretation must stay paired with the voice settings.
Config.withFunction({ instructions: 'literal', expiresAfterSeconds: 60 });
// @ts-expect-error Loaded audio sources name a resource.
Config.loadsScript({ audio: new Uint8Array() });
// @ts-expect-error Selecting function mode also checks inherited source values.
Config.withFunction({}, Config({ input: 'literal' }));
// @ts-expect-error A script source cannot retain an inherited function.
Config.withScript({}, Config.withFunction({ text: () => 'prepared' }));
// @ts-expect-error Function mode applies to inherited query values too.
Config.withFunction({}, Config({ query: 'literal' }));
const invalidPrompt = { ...Config.withText({}).config, prompt: () => 'prepared' };
// @ts-expect-error A valid union alternative must not erase another source failure.
Config(choose ? Config.withText({ prompt: 'literal' }).config : invalidPrompt);
const _emptyText = Config.withText({});
declare const fragmentWithMissingSource: typeof _emptyText.config | typeof invalidPrompt;
// @ts-expect-error A missing source in one branch cannot hide another branch's invalid source.
Config(fragmentWithMissingSource);
// @ts-expect-error The same union remains invalid when supplied as a parent.
Config({}, choose ? Config.withText({ prompt: 'literal' }) : { config: invalidPrompt });
const selectedMode = (choose ? Config.withText({}) : Config.withFunction({})).config;
// @ts-expect-error A source must satisfy every possible selected mode.
Config({ ...selectedMode, input: 'literal' });

// Public annotations retain a fragment's selected mode and default authored settings locally.
const annotatedLoaded: LLMAgentConfig<Empty, Empty, string> = Config.loadsText({ model, prompt: 'entry' }).config;
// @ts-expect-error A selected loaded mode still requires its loader.
create.LLMAgent(annotatedLoaded);
const loadedAgent = create.LLMAgent({ loader: { load: () => 'loaded' } }, { config: annotatedLoaded });
void loadedAgent('entry');
// @ts-expect-error Loaded sources cannot accept literal native messages as a replacement.
void loadedAgent.run({ prompt: [{ role: 'user', content: 'native' }] });
const annotatedTemplate: TemplateConfig<Empty> = { template: 'inline' };
void create.Template(annotatedTemplate)();
const annotatedScript: ScriptConfig<Empty, unknown> & { script: string } = { script: 'return 1' };
void create.Script(annotatedScript)();
const loadedTemplate: TemplateConfig<Empty> = Config.loadsTemplate({ template: 'entry' }).config;
// @ts-expect-error Renderer annotations must retain their loaded mode too.
create.Template(loadedTemplate);
void create.Template({ loader: { load: () => 'loaded' } }, { config: loadedTemplate })();
const loadedScript: ScriptConfig<Empty, unknown> & { script: string } = Config.loadsScript({ script: 'entry' }).config;
// @ts-expect-error Script annotations must retain their loaded mode too.
create.Script(loadedScript);
void create.Script({ loader: { load: () => 'return 1' } }, { config: loadedScript })();
void create.Script.withScript({ script: 'return 1' }, { config: loadedScript })();
const loadedTemplateTool: TemplateToolConfig<Empty> = Config.loadsTemplate.asTool({ template: 'entry', inputSchema: z.object({}) }).config;
// @ts-expect-error Tool annotations retain the same loader requirement.
create.Template.asTool(loadedTemplateTool);
void create.Template.asTool({ loader: { load: () => 'loaded' } }, { config: loadedTemplateTool })();
const loadedScriptTool: ScriptToolConfig<Empty, unknown> & { script: string } = Config.loadsScript.asTool({ script: 'entry', inputSchema: z.object({}) }).config;
// @ts-expect-error Script tool annotations retain the same loader requirement.
create.Script.asTool(loadedScriptTool);
void create.Script.asTool({ loader: { load: () => 'return 1' } }, { config: loadedScriptTool })();
