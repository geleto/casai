import { streamMode } from '../fixtures/source-modes.js';
import type { EmptyMap } from './assert.js';
// Compile-only public annotations: inference must survive values declared through exported types.
import { create, z } from 'casai';
import type {
	TemplateConfig, TemplateToolConfig, ScriptConfig, ScriptToolConfig,
	LLMAgentConfig, ComponentConfig,
} from 'casai';
import type { LanguageModel, ToolExecutionOptions, JSONValue, OutputInterface, ModelMessage } from 'ai';
import { Output } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
const inputSchema = z.object({ name: z.string() });
const schema = z.object({ length: z.number() });
const contextSchema = z.object({ tenant: z.string() });

const templateConfig: TemplateConfig<{ name: string }> = { template: '{{ name }}', inputSchema };
const template = create.Template(templateConfig);
create.Template.withTemplate(templateConfig);
export const annotatedTemplate = (config: ComponentConfig<'Template'>) => create.Template(config);
export const annotatedTypedTemplate = (config: TemplateConfig<{ name: string }>) => create.Template(config);
expectType<Promise<string>>(annotatedTypedTemplate(templateConfig)({ name: 'Ada' }));
expectType<Promise<string>>(template({ name: 'Ada' }));
// @ts-expect-error Annotated template inputs keep the declared field type.
void template({ name: 123 });
// @ts-expect-error A potentially configured required input schema cannot allow omitted context.
void template();
// @ts-expect-error Annotated template schemas cannot change the declared field type.
const _wrongTemplate: TemplateConfig<{ name: string }> = { template: '{{ name }}', inputSchema: z.object({ name: z.number() }) };

const templateToolConfig: TemplateToolConfig<{ name: string }, { tenant: string }> & { toolContextSchema: typeof contextSchema } = {
	template: '{{ name }}', inputSchema, toolContextSchema: contextSchema,
};
const templateTool = create.Template.asTool(templateToolConfig);
create.Template.withTemplate.asTool(templateToolConfig);
declare const executionOptions: ToolExecutionOptions<{ tenant: string }>;
expectType<PromiseLike<string>>(templateTool.execute({ name: 'Ada' }, executionOptions));
// @ts-expect-error Annotated template tool input fields do not widen.
void templateTool.execute({ name: 123 }, executionOptions);
// @ts-expect-error Annotated template tool context schemas retain their output contract.
void templateTool.execute({ name: 'Ada' }, { toolCallId: 'call', messages: [], context: { tenant: 123 } });

// The intersection makes schema presence explicit; ScriptConfig alone permits it to be absent.
const scriptConfig: ScriptConfig<{ name: string }, { length: number }> & { script: string, schema: typeof schema } = {
	script: 'return { length: name.length }', inputSchema, schema,
};
const script = create.Script(scriptConfig);
create.Script.withScript(scriptConfig);
export const annotatedScript = (config: ComponentConfig<'Script'>) => create.Script(config);
export const annotatedTypedScript = (config: typeof scriptConfig) => create.Script(config);
expectType<Promise<{ length: number }>>(annotatedTypedScript(scriptConfig)({ name: 'Ada' }));
// @ts-expect-error Inline renderer annotations require source at construction.
annotatedScript({});
// @ts-expect-error Inline template annotations require source at construction too.
annotatedTemplate({});
expectEqual<Awaited<ReturnType<typeof script>>, z.infer<typeof scriptConfig.schema>>();
expectType<Promise<{ length: number }>>(script('return { length: name.length }', { name: 'Ada' }));
// @ts-expect-error Annotated scripts retain their input field contract.
void script('return { length: name.length }', { name: false });
// @ts-expect-error Annotated script outputs retain their schema contract.
expectType<Promise<{ length: string }>>(script('return { length: name.length }', { name: 'Ada' }));
// @ts-expect-error Annotated script schemas must match the declared output.
const _wrongScript: ScriptConfig<{ name: string }, { length: number }> = { schema: z.object({ length: z.string() }) };

const scriptToolConfig: ScriptToolConfig<{ name: string }, { length: number }, { tenant: string }> & { script: string, schema: typeof schema, toolContextSchema: typeof contextSchema } = {
	script: 'return { length: name.length }', inputSchema, schema, toolContextSchema: contextSchema,
};
const scriptTool = create.Script.asTool(scriptToolConfig);
create.Script.withScript.asTool(scriptToolConfig);
expectType<PromiseLike<{ length: number }>>(scriptTool.execute({ name: 'Ada' }, executionOptions));
// @ts-expect-error Annotated script tools retain required input fields.
void scriptTool.execute({}, executionOptions);
// @ts-expect-error Annotated script tool contexts retain required fields.
void scriptTool.execute({ name: 'Ada' }, { toolCallId: 'call', messages: [], context: {} });
declare const maybeScriptToolConfig: ScriptToolConfig<{ name: string }, { length: number }>;
// @ts-expect-error An annotated tool config with an optional script cannot guarantee an executable tool.
create.Script.asTool(maybeScriptToolConfig);

const templatePrompt: { prompt: string } = { prompt: '{{ name }}' };
const scriptPrompt: { prompt: string } = { prompt: 'return name' };
const functionPrompt: { prompt: () => string | ModelMessage[] } = { prompt: () => 'Answer.' };
create.LLMAgent.withTemplate({ ...templatePrompt, model });
create.LLMAgent.withScript({ ...scriptPrompt, model });
create.LLMAgent.withFunction({ ...functionPrompt, model });
// @ts-expect-error Annotated template prompts cannot be functions.
const _wrongTemplatePrompt: { prompt: string } = { prompt: () => 'Answer.' };
// @ts-expect-error Annotated script prompts cannot be message arrays.
const _wrongScriptPrompt: { prompt: string } = { prompt: [{ role: 'user', content: 'Answer.' }] };
// @ts-expect-error Annotated function prompts cannot return arbitrary objects.
const _wrongFunctionPrompt: { prompt: () => string | ModelMessage[] } = { prompt: () => ({ answer: 42 }) };

const textConfig: LLMAgentConfig<EmptyMap, EmptyMap, string, ReturnType<typeof Output.text>> = {
	model, prompt: 'Answer.', onEnd: event => { expectType<string>(event.text); },
};
const text = create.LLMAgent(textConfig);
expectType<Promise<string>>(text('Answer.').then(result => result.text));
// @ts-expect-error Exported text configs validate SDK callback arguments.
const _wrongTextConfig: LLMAgentConfig<EmptyMap, EmptyMap, string, ReturnType<typeof Output.text>> = { model, onEnd: (_event: number) => undefined };

const streamConfig: LLMAgentConfig<EmptyMap, EmptyMap, string, ReturnType<typeof Output.text>> = {
	model, prompt: 'Answer.',
	onEnd: event => { expectType<string>(event.text); expectType<string>(event.response.messages[0].role); },
};
const stream = create.LLMAgent.asStream(streamConfig);
expectType<AsyncIterable<string>>((await stream('Answer.')).textStream);
// @ts-expect-error Exported streaming configs preserve native finish response types.
const _wrongStreamConfig: LLMAgentConfig<EmptyMap, EmptyMap, string, ReturnType<typeof Output.text>> = { model, onEnd: event => { expectType<number>(event.response.messages); } };

// Keep supplied fields with satisfies, or retain actual tool names in an annotation.
const textSettings = { model, prompt: 'Answer.' } satisfies LLMAgentConfig;
const streamSettings = { model, prompt: 'Answer.' } satisfies LLMAgentConfig;
create.LLMAgent(textSettings);
create.LLMAgent.asStream(streamSettings);
create.Config(textSettings);
create.Config(streamSettings);

// Bare annotations retain broad tools. A string index also admits numeric property keys.
const broadAgentConfig: LLMAgentConfig = { model, prompt: 'Answer.', toolsContext: {} };
const broadAgent = create.LLMAgent(broadAgentConfig);
void broadAgent('Answer.');
export const annotatedTextAgent = (config: LLMAgentConfig) => create.LLMAgent.withText(config);
export const annotatedDefaultAgent = (config: LLMAgentConfig) => create.LLMAgent(config);
void annotatedDefaultAgent({ model })('hello');
void annotatedDefaultAgent({ model }).run({ prompt: 'hello' });
// @ts-expect-error A broad annotation does not guarantee a configured prompt.
void annotatedDefaultAgent({ model })();
export const annotatedAgent = (config: ComponentConfig<'LLMAgent'>) => create.LLMAgent(config);
export const annotatedStreamAgent = (config: ComponentConfig<'LLMAgent', 'text', 'stream'>) => create.LLMAgent.asStream(config);
export const annotatedFunctionAgent = (config: ComponentConfig<'LLMAgent', 'function'>) => create.LLMAgent.withFunction(config);
export const annotatedFunctionStreamAgent = (config: ComponentConfig<'LLMAgent', 'function', 'stream'>) => create.LLMAgent.withFunction.asStream(config);
const functionSettings: ComponentConfig<'LLMAgent', 'function'> = {
	model, prompt: context => {
		expectType<AbortSignal | undefined>(context._toolOptions.abortSignal);
		return 'Answer.';
	},
};
void annotatedFunctionAgent(functionSettings)(() => 'Answer.');
void annotatedFunctionStreamAgent(functionSettings).run({ prompt: () => 'Answer.' }).then(result => result.textStream);
// @ts-expect-error Annotation keeps prompt callbacks returning native prompt values.
const _invalidFunctionSettings: ComponentConfig<'LLMAgent', 'function'> = { model, prompt: () => 42 };
// @ts-expect-error The optional configured callback does not eliminate the call-time source requirement.
void annotatedFunctionAgent(functionSettings)();
export const annotatedTemplateAgent = (config: ComponentConfig<'LLMAgent', 'async-template'>) => create.LLMAgent.withTemplate(config);
export const annotatedScriptAgent = (config: ComponentConfig<'LLMAgent', 'async-script'>) => create.LLMAgent.withScript(config);
export const annotatedLoadedAgent = (config: ComponentConfig<'LLMAgent', 'text-name'>) => create.LLMAgent.loadsText(config);
export const annotatedLoadedTemplateAgent = (config: ComponentConfig<'LLMAgent', 'async-template-name'>) => create.LLMAgent.loadsTemplate(config);
export const annotatedLoadedScriptAgent = (config: ComponentConfig<'LLMAgent', 'async-script-name'>) => create.LLMAgent.loadsScript(config);
export const annotatedLoadedTemplate = (config: ComponentConfig<'Template', 'async-template-name'>) => create.Template.loadsTemplate(config);
export const annotatedLoadedScript = (config: ComponentConfig<'Script', 'async-script-name'>) => create.Script.loadsScript(config);
void annotatedLoadedTemplate({ loader: { load: () => 'loaded' } })('entry');
void annotatedLoadedScript({ loader: { load: () => 'return 1' } }).run({ script: 'entry' });
// @ts-expect-error Finished loaded annotations require a loader even if source is configured.
annotatedLoadedTemplate({ template: 'entry' });
// @ts-expect-error A loaded script requires its loader too.
annotatedLoadedScript({ script: 'entry' });
// @ts-expect-error Optional loaded source must be supplied at invocation.
void annotatedLoadedTemplate({ loader: { load: () => 'loaded' } })();
declare const embeddingModel: ComponentConfig<'Embedder'>['model'];
type EmbeddingSourceChoice = ComponentConfig<'Embedder', 'text' | 'text-name'>;
const inlineEmbedding: EmbeddingSourceChoice = create.Config.withText({ model: embeddingModel }).config;
const loadedEmbedding: EmbeddingSourceChoice = create.Config.loadsText({ model: embeddingModel, loader: { load: () => 'loaded' } }).config;
create.Embedder(inlineEmbedding);
create.Embedder(loadedEmbedding);
// @ts-expect-error Loaded annotation alternatives retain their loader requirement.
const _incompleteLoadedEmbedding: EmbeddingSourceChoice = create.Config.loadsText({ model: embeddingModel }).config;
void annotatedAgent({ model })('Answer.');
void annotatedStreamAgent({ model })('Answer.').then(result => result.textStream);
const tools = { lookup: create.Function.asTool({ inputSchema, execute: ({ name }) => name }) };
const namedText: LLMAgentConfig<typeof tools> = { model, tools, activeTools: ['lookup'] };
const namedStream: LLMAgentConfig<typeof tools> = { model, tools, activeTools: ['lookup'] };
create.LLMAgent(namedText);
create.LLMAgent.asStream(namedStream);
create.Config(namedText);
create.Config(namedStream);

// Tool settings retain their concrete schema and absence of streaming through satisfies.
const agentToolSettings = { model, prompt: 'Answer.', inputSchema } satisfies LLMAgentConfig;
const annotatedAgentTool = create.LLMAgent.asTool(agentToolSettings);
void annotatedAgentTool.execute({ name: 'Ada' }, { toolCallId: 'test', messages: [], context: undefined });
// @ts-expect-error The concrete tool schema retains its required fields.
void annotatedAgentTool.execute({}, { toolCallId: 'test', messages: [], context: undefined });
declare const broadToolSettings: LLMAgentConfig & { prompt: string; inputSchema: typeof inputSchema };
// @ts-expect-error Broad ordinary settings can include streaming and erase the concrete tool contract.
create.LLMAgent.asTool(broadToolSettings);

// Preserve presence in annotations when output is fixed, rather than optional.
type OutputConfig<O extends OutputInterface> = LLMAgentConfig<EmptyMap, EmptyMap, string, O> & { output: O; [streamMode]?: never };
const arrayOutput = Output.array({ element: schema });
const arrayConfig: OutputConfig<typeof arrayOutput> = { model, output: arrayOutput };
const arrayAgent = create.LLMAgent(arrayConfig);
expectEqual<Awaited<ReturnType<typeof arrayAgent>>['output'], { length: number }[]>();
// @ts-expect-error An annotated array retains the element's field types.
const wrongArray: OutputConfig<typeof arrayOutput> = { model, output: Output.array({ element: z.object({ length: z.string() }) }) };

const choiceOutput = Output.choice({ options: ['short', 'long'] });
const choiceConfig: OutputConfig<typeof choiceOutput> = { model, output: choiceOutput };
const choiceAgent = create.LLMAgent(choiceConfig);
expectEqual<Awaited<ReturnType<typeof choiceAgent>>['output'], 'short' | 'long'>();
// @ts-expect-error An annotated choice retains its literal choices.
const wrongChoice: OutputConfig<typeof choiceOutput> = { model, output: Output.choice({ options: ['other'] }) };

const jsonOutput = Output.json();
const jsonConfig: OutputConfig<typeof jsonOutput> = { model, output: jsonOutput };
const jsonAgent = create.LLMAgent(jsonConfig);
expectEqual<Awaited<ReturnType<typeof jsonAgent>>['output'], JSONValue>();
// @ts-expect-error Legacy object-generation mode is not an LLMAgent setting.
const wrongJson: OutputConfig<typeof jsonOutput> = { model, output: jsonOutput, mode: 'tool' };

const objectOutput = Output.object({ schema });
const objectConfig: OutputConfig<typeof objectOutput> = { model, output: objectOutput };
const objectStream = create.LLMAgent.asStream(objectConfig);
expectEqual<Awaited<Awaited<ReturnType<typeof objectStream>>['output']>, { length: number }>();
// @ts-expect-error An annotated structured stream retains its final output type.
const wrongObject: OutputConfig<typeof objectOutput> = { model, output: Output.object({ schema: z.object({ length: z.boolean() }) }) };

// The wrapper always passes an object, even when execute itself accepts undefined.
const optionalExecute = create.Function({ execute: (input?: { value: number }) => input?.value ?? 0 });
expectEqual<ReturnType<typeof optionalExecute>, Promise<number>>();
expectType<Promise<number>>(optionalExecute({ value: 1 }));
// @ts-expect-error An optional callback parameter does not make its object fields optional.
void optionalExecute();
// @ts-expect-error The wrapper passes an object, so undefined cannot satisfy required fields.
void optionalExecute(undefined);
// @ts-expect-error Callback annotations preserve their field types.
void optionalExecute({ value: 'wrong' });
const optionalFields = create.Function({ execute: (input?: { value?: number }) => input?.value ?? 0 });
void optionalFields();
void optionalFields({ value: 1 });
const nullableExecute = create.Function({ execute: (input: { value: number } | null) => input?.value ?? 0 });
void nullableExecute({ value: 1 });
// @ts-expect-error A nullable callback parameter does not make null a valid context object.
void nullableExecute(null);
const optionalFragment = create.Config({ execute: (input?: { value: number }) => input?.value ?? 0 });
const inheritedOptionalExecute = create.Function({}, optionalFragment);
void inheritedOptionalExecute({ value: 1 });
// @ts-expect-error Fragments preserve required wrapper fields from optional callback parameters.
void inheritedOptionalExecute();
// @ts-expect-error Fragments preserve their callback annotation field types.
void inheritedOptionalExecute({ value: 'wrong' });










export { arrayAgent, wrongArray, choiceAgent, wrongChoice, jsonAgent, wrongJson, objectStream, wrongObject };
