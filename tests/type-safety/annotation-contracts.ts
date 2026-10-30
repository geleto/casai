import type { EmptyMap } from './assert.js';
// Compile-only public annotations: inference must survive values declared through exported types.
import { create, z } from 'casai';
import type {
	TemplateConfig, TemplateToolConfig, ScriptConfig, ScriptToolConfig,
	LLMAgentConfig,
} from 'casai';
import type { LanguageModel, ToolExecutionOptions, JSONValue, OutputInterface, ModelMessage } from 'ai';
import { Output } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
const inputSchema = z.object({ name: z.string() });
const schema = z.object({ length: z.number() });
const contextSchema = z.object({ tenant: z.string() });

const templateConfig: TemplateConfig<{ name: string }> = { template: '{{ name }}', inputSchema };
const template = create.Template.withTemplate(templateConfig);
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
const templateTool = create.Template.withTemplate.asTool(templateToolConfig);
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
const script = create.Script.withScript(scriptConfig);
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
const scriptTool = create.Script.withScript.asTool(scriptToolConfig);
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
const tools = { lookup: create.Function.asTool({ inputSchema, execute: ({ name }) => name }) };
const namedText: LLMAgentConfig<typeof tools> = { model, tools, activeTools: ['lookup'] };
const namedStream: LLMAgentConfig<typeof tools> = { model, tools, activeTools: ['lookup'] };
create.LLMAgent(namedText);
create.LLMAgent.asStream(namedStream);
create.Config(namedText);
create.Config(namedStream);

// Preserve presence in annotations when output is fixed, rather than optional.
type OutputConfig<O extends OutputInterface> = LLMAgentConfig<EmptyMap, EmptyMap, string, O> & { output: O; streaming?: never };
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
