// Compile-only public annotations: inference must survive values declared through exported types.
import { create, z } from 'casai';
import type {
	TemplateConfig, TemplateToolConfig, ScriptConfig, ScriptToolConfig,
	TemplatePromptConfig, ScriptPromptConfig, FunctionPromptConfig,
	GenerateTextConfig, StreamTextConfig,
	GenerateObjectArrayConfig, GenerateObjectEnumConfig, GenerateObjectNoSchemaConfig, StreamObjectObjectConfig,
} from 'casai';
import type { LanguageModel, ToolExecutionOptions, JSONValue } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
const inputSchema = z.object({ name: z.string() });
const schema = z.object({ length: z.number() });
const contextSchema = z.object({ tenant: z.string() });

const templateConfig: TemplateConfig<{ name: string }> = { template: '{{ name }}', inputSchema };
const template = create.Template(templateConfig);
expectType<Promise<string>>(template({ name: 'Ada' }));
// @ts-expect-error Annotated template inputs keep the declared field type.
void template({ name: 123 });
// @ts-expect-error A potentially configured required input schema cannot allow omitted context.
void template();
// @ts-expect-error Annotated template schemas cannot change the declared field type.
const _wrongTemplate: TemplateConfig<{ name: string }> = { template: '{{ name }}', inputSchema: z.object({ name: z.number() }) };

const templateToolConfig: TemplateToolConfig<{ name: string }, { tenant: string }> = {
	template: '{{ name }}', inputSchema, contextSchema,
};
const templateTool = create.Template.asTool(templateToolConfig);
declare const executionOptions: ToolExecutionOptions<{ tenant: string }>;
expectType<PromiseLike<string>>(templateTool.execute({ name: 'Ada' }, executionOptions));
// @ts-expect-error Annotated template tool input fields do not widen.
void templateTool.execute({ name: 123 }, executionOptions);
// @ts-expect-error Annotated template tool context schemas retain their output contract.
void templateTool.execute({ name: 'Ada' }, { toolCallId: 'call', messages: [], context: { tenant: 123 } });

// The intersection makes schema presence explicit; ScriptConfig alone permits it to be absent.
const scriptConfig: ScriptConfig<{ name: string }, { length: number }> & { schema: typeof schema } = {
	script: 'return { length: name.length }', inputSchema, schema,
};
const script = create.Script(scriptConfig);
expectEqual<Awaited<ReturnType<typeof script>>, z.infer<typeof scriptConfig.schema>>();
expectType<Promise<{ length: number }>>(script('return { length: name.length }', { name: 'Ada' }));
// @ts-expect-error Annotated scripts retain their input field contract.
void script('return { length: name.length }', { name: false });
// @ts-expect-error Annotated script outputs retain their schema contract.
expectType<Promise<{ length: string }>>(script('return { length: name.length }', { name: 'Ada' }));
// @ts-expect-error Annotated script schemas must match the declared output.
const _wrongScript: ScriptConfig<{ name: string }, { length: number }> = { schema: z.object({ length: z.string() }) };

const scriptToolConfig: ScriptToolConfig<{ name: string }, { length: number }, { tenant: string }> & { script: string, schema: typeof schema } = {
	script: 'return { length: name.length }', inputSchema, schema, contextSchema,
};
const scriptTool = create.Script.asTool(scriptToolConfig);
expectType<PromiseLike<{ length: number }>>(scriptTool.execute({ name: 'Ada' }, executionOptions));
// @ts-expect-error Annotated script tools retain required input fields.
void scriptTool.execute({}, executionOptions);
// @ts-expect-error Annotated script tool contexts retain required fields.
void scriptTool.execute({ name: 'Ada' }, { toolCallId: 'call', messages: [], context: {} });
declare const maybeScriptToolConfig: ScriptToolConfig<{ name: string }, { length: number }>;
// @ts-expect-error An annotated tool config with an optional script cannot guarantee an executable tool.
create.Script.asTool(maybeScriptToolConfig);

const templatePrompt: TemplatePromptConfig = { prompt: '{{ name }}' };
const scriptPrompt: ScriptPromptConfig = { prompt: 'return name' };
const functionPrompt: FunctionPromptConfig = { prompt: () => 'Answer.' };
create.TextGenerator.withTemplate({ ...templatePrompt, model });
create.TextGenerator.withScript({ ...scriptPrompt, model });
create.TextGenerator.withFunction({ ...functionPrompt, model });
// @ts-expect-error Annotated template prompts cannot be functions.
const _wrongTemplatePrompt: TemplatePromptConfig = { prompt: () => 'Answer.' };
// @ts-expect-error Annotated script prompts cannot be message arrays.
const _wrongScriptPrompt: ScriptPromptConfig = { prompt: [{ role: 'user', content: 'Answer.' }] };
// @ts-expect-error Annotated function prompts cannot return arbitrary objects.
const _wrongFunctionPrompt: FunctionPromptConfig = { prompt: () => ({ answer: 42 }) };

const textConfig: GenerateTextConfig<Record<string, never>, never> = {
	model, prompt: 'Answer.', onEnd: event => { expectType<string>(event.text); },
};
const text = create.TextGenerator(textConfig);
expectType<Promise<string>>(text('Answer.').then(result => result.text));
// @ts-expect-error Exported text configs validate SDK callback arguments.
const _wrongTextConfig: GenerateTextConfig<Record<string, never>, never> = { model, onEnd: (_event: number) => undefined };

const streamConfig: StreamTextConfig<Record<string, never>, never> = {
	model, prompt: 'Answer.',
	onEnd: event => { expectType<string>(event.text); expectType<string>(event.response.messageHistory[0].role); },
};
const stream = create.TextStreamer(streamConfig);
expectType<AsyncIterable<string>>(stream('Answer.').textStream);
// @ts-expect-error Exported streaming configs preserve augmented finish history types.
const _wrongStreamConfig: StreamTextConfig<Record<string, never>, never> = { model, onEnd: event => { expectType<number>(event.response.messageHistory); } };

const arrayConfig: GenerateObjectArrayConfig<never, { length: number }> = { model, schema, output: 'array' };
const _array = create.ObjectGenerator(arrayConfig);
expectEqual<Awaited<ReturnType<typeof _array>>['object'], { length: number }[]>();
// @ts-expect-error Annotated array output schemas describe elements with the declared field types.
const _wrongArrayConfig: GenerateObjectArrayConfig<never, { length: number }> = { model, output: 'array', schema: z.object({ length: z.string() }) };

const enumConfig: GenerateObjectEnumConfig<never, 'short' | 'long'> = { model, output: 'enum', enum: ['short', 'long'] };
const _enumGenerator = create.ObjectGenerator(enumConfig);
expectEqual<Awaited<ReturnType<typeof _enumGenerator>>['object'], 'short' | 'long'>();
// @ts-expect-error Annotated enum choices must remain in the declared output union.
const _wrongEnumConfig: GenerateObjectEnumConfig<never, 'short' | 'long'> = { model, output: 'enum', enum: ['other'] };

const noSchemaConfig: GenerateObjectNoSchemaConfig<never> = { model, output: 'no-schema', mode: 'json' };
const _noSchema = create.ObjectGenerator(noSchemaConfig);
expectEqual<Awaited<ReturnType<typeof _noSchema>>['object'], JSONValue>();
// @ts-expect-error Annotated schemaless generation cannot use tool mode.
const _wrongNoSchemaConfig: GenerateObjectNoSchemaConfig<never> = { model, output: 'no-schema', mode: 'tool' };

const objectStreamConfig: StreamObjectObjectConfig<never, { length: number }> = { model, schema };
const _objectStream = create.ObjectStreamer(objectStreamConfig);
expectEqual<Awaited<ReturnType<typeof _objectStream>['object']>, { length: number }>();
// @ts-expect-error Annotated object streaming schemas retain their output field types.
const _wrongObjectStreamConfig: StreamObjectObjectConfig<never, { length: number }> = { model, schema: z.object({ length: z.boolean() }) };

// The wrapper always passes an object, even when execute itself accepts undefined.
const optionalExecute = create.Function({ execute: (input?: { value: number }) => input?.value ?? 0 });
expectType<number | PromiseLike<number>>(optionalExecute({ value: 1 }));
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
