// Consumer-only tool input, execution-context and toolsContext contracts.
import { create, z } from 'casai';
import type { FunctionToolConfig, TemplateToolConfig, ScriptToolConfig } from 'casai';
import { tool as sdkTool } from 'ai';
import type { LanguageModel, ToolExecutionOptions } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
declare const choose: boolean;
const inputSchema = z.object({ value: z.number() });
const contextSchema = z.object({ factor: z.number() });
const options: ToolExecutionOptions<{ factor: number }> = { toolCallId: 'call', messages: [], context: { factor: 2 } };
const noContext: ToolExecutionOptions<undefined> = { toolCallId: 'call', messages: [], context: undefined };
// @ts-expect-error Function tool implementations must match their output schema even without callback parameters.
create.Function.asTool({ inputSchema, schema: z.number(), execute: () => 'wrong' });
const parsedTool = create.Function.asTool({ inputSchema: z.object({ value: z.string().transform(Number), fallback: z.string().default('default') }), execute: ({ value, fallback: _fallback }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof _fallback, string>();
	return value;
} });
void parsedTool.execute({ value: 1, fallback: 'parsed' }, noContext);
// @ts-expect-error Tool execute receives schema output already parsed by the SDK.
void parsedTool.execute({ value: 'raw', fallback: 'parsed' }, noContext);
// @ts-expect-error Parsed defaulted tool input fields are required by execute.
void parsedTool.execute({ value: 1 }, noContext);
const transformedOutputTool = create.Function.asTool({ inputSchema, schema: z.string().transform(Number), execute: ({ value }) => String(value) });
expectType<Promise<number>>(transformedOutputTool({ value: 1 }, noContext));
expectType<Promise<number>>(transformedOutputTool.execute({ value: 1 }, noContext));
// @ts-expect-error Tool implementations return unparsed output for Casai's output validation.
create.Function.asTool({ inputSchema, schema: z.string().transform(Number), execute: () => 123 });
const multiply = create.Function.asTool({
	inputSchema, contextSchema, context: { offset: 1 }, schema: z.number(),
	execute: ({ value, offset }, { context, toolCallId, messages, abortSignal }) => {
		expectEqual<typeof value, number>();
		expectEqual<typeof offset, number>();
		expectEqual<typeof context, { factor: number }>();
		expectType<string>(toolCallId);
		expectType<AbortSignal | undefined>(abortSignal);
		expectType<number>(messages.length);
		// @ts-expect-error SDK tool context is independently schema-typed.
		expectType<string>(context.factor);
		return value * context.factor + offset;
	},
});
expectType<Promise<number>>(multiply({ value: 1 }, options));
expectType<Promise<number>>(multiply.execute({ value: 1 }, options));
expectEqual<Parameters<typeof multiply>, Parameters<typeof multiply.execute>>();
void multiply({ value: 1, offset: 3 }, options);
void multiply.execute({ value: 1, offset: 3 }, options);
// @ts-expect-error Tool calls require their input-schema fields.
void multiply({}, options);
// @ts-expect-error Tool execute requires its input-schema fields too.
void multiply.execute({}, options);
// @ts-expect-error Tool inputs do not widen to any.
void multiply({ value: 'wrong' }, options);
// @ts-expect-error Configured context overrides retain their types.
void multiply.execute({ value: 1, offset: 'wrong' }, options);
// @ts-expect-error Direct Function tool calls use the same configured override types as execute.
void multiply({ value: 1, offset: 'wrong' }, options);
// @ts-expect-error Direct tool calls require SDK execution options.
void multiply({ value: 1 });
// @ts-expect-error Tool execute requires SDK execution options.
void multiply.execute({ value: 1 });
// @ts-expect-error Required SDK tool context cannot be undefined.
void multiply.execute({ value: 1 }, noContext);
// @ts-expect-error SDK tool context factors must be numeric.
void multiply({ value: 1 }, { ...options, context: { factor: 'wrong' } });
// @ts-expect-error SDK execution options require a tool call ID.
void multiply({ value: 1 }, { messages: [], context: { factor: 2 } });

const inherited = create.Function.asTool({}, multiply);
void inherited.execute({ value: 2 }, options);
// @ts-expect-error Empty tool children retain their input schema.
void inherited.execute({ value: 'wrong' }, options);
// @ts-expect-error Empty tool children retain their execution context schema.
void inherited.execute({ value: 1 }, noContext);
// @ts-expect-error Inherited implementations must accept changed tool context.
create.Function.asTool({ contextSchema: z.object({ label: z.string() }) }, multiply);
// @ts-expect-error Inherited implementations cannot lose required tool context.
create.Function.asTool({ contextSchema: undefined }, multiply);
// @ts-expect-error Inherited implementations must accept changed input fields.
create.Function.asTool({ inputSchema: z.object({ value: z.string() }) }, multiply);
// @ts-expect-error Inherited implementations must produce the replacement schema output.
create.Function.asTool({ schema: z.string() }, multiply);
const replacement = create.Function.asTool({
	inputSchema: z.object({ label: z.string() }), contextSchema: z.object({ suffix: z.string() }), schema: z.string(),
	execute: ({ label, offset: _offset }, { context }) => {
		expectEqual<typeof label, string>();
		expectEqual<typeof _offset, number>();
		expectEqual<typeof context, { suffix: string }>();
		return label + context.suffix;
	},
}, multiply);
expectType<Promise<string>>(replacement.execute({ label: 'child' }, { ...options, context: { suffix: '!' } }));
// @ts-expect-error The replacement input schema removes old input fields.
void replacement.execute({ value: 1 }, { ...options, context: { suffix: '!' } });
// @ts-expect-error The replacement context schema removes the old context shape.
void replacement.execute({ label: 'child' }, options);

const contextFree = create.Function.asTool({ inputSchema, execute: ({ value }, { context: _context }) => {
	expectEqual<typeof _context, undefined>();
	return value;
} });
void contextFree.execute({ value: 1 }, noContext);
// @ts-expect-error Schema-free tools have undefined SDK context.
void contextFree.execute({ value: 1 }, options);
const unknownContext = create.Function.asTool({ inputSchema, contextSchema: z.unknown(), execute: (_input, { context }) => {
	expectEqual<typeof context, unknown>();
	// @ts-expect-error Unknown tool context cannot be read without narrowing.
	expectType<number>(context);
	return context;
} });
void unknownContext.execute({ value: 1 }, { ...options, context: 'arbitrary' });
const optional = create.Function.asTool({ inputSchema, contextSchema: contextSchema.optional(), execute: ({ value }, { context }) => value * (context?.factor ?? 1) });
void optional.execute({ value: 1 }, options);
void optional.execute({ value: 1 }, noContext);
// @ts-expect-error Optional context still validates the present shape.
void optional.execute({ value: 1 }, { ...options, context: { factor: 'wrong' } });

const declaredConfig: FunctionToolConfig<typeof inputSchema, undefined, undefined, undefined, { factor: number }> = {
	inputSchema, contextSchema, execute: ({ value }, { context }) => value * context.factor,
};
const declaredTool = create.Function.asTool(declaredConfig);
const declaredChild = create.Function.asTool({}, { config: declaredConfig });
void declaredChild.execute({ value: 1 }, options);
// @ts-expect-error Optional config metadata does not erase a declared context contract.
void declaredTool.execute({ value: 1 }, noContext);
// @ts-expect-error ConfigProvider inheritance retains declared context contracts.
void declaredChild.execute({ value: 1 }, noContext);
const conditional = choose ? { contextSchema } : {};
const conditionalTool = create.Function.asTool({ inputSchema, ...conditional, execute: ({ value }, { context }) => value * (context?.factor ?? 1) });
const conditionalChild = create.Function.asTool({}, conditionalTool);
void conditionalChild.execute({ value: 1 }, options);
// @ts-expect-error Conditional schema composition still rejects unrelated context shapes.
void conditionalChild.execute({ value: 1 }, { ...options, context: 'wrong' });

const rendererParent = create.Config({ inputSchema, contextSchema });
const template = create.Template.asTool({ template: '{{ value }}' }, rendererParent);
const script = create.Script.asTool({ script: 'return value', schema: z.number() }, rendererParent);
const emptyTemplateTool = create.Template.asTool({}, template);
const emptyScriptTool = create.Script.asTool({}, script);
expectEqual<typeof emptyTemplateTool.config.inputSchema, typeof inputSchema>();
expectEqual<typeof emptyScriptTool.config.inputSchema, typeof inputSchema>();
expectType<PromiseLike<number>>(emptyScriptTool.execute({ value: 1 }, options));
// @ts-expect-error Empty Template tool children retain schema input field types.
void emptyTemplateTool.execute({ value: 'wrong' }, options);
// @ts-expect-error Empty Script tool children retain schema input field types.
void emptyScriptTool.execute({ value: 'wrong' }, options);
// @ts-expect-error Template tools require ZodObject instances rather than object-output unions.
create.Template.asTool({ inputSchema: z.union([inputSchema, z.object({ name: z.string() })]), template: 'Ready' });
// @ts-expect-error Script tools require ZodObject instances rather than object-output records.
create.Script.asTool({ inputSchema: z.record(z.string(), z.number()), script: 'return 1' });
expectType<PromiseLike<string>>(template.execute({ value: 1 }, options));
expectType<PromiseLike<number>>(script.execute({ value: 1 }, options));
// @ts-expect-error Template tool execute uses its inherited input schema.
void template.execute({ value: 'wrong' }, options);
// @ts-expect-error Script tool execute uses its inherited input schema.
void script.execute({ value: 'wrong' }, options);
// @ts-expect-error Template tool context remains required.
void template.execute({ value: 1 }, noContext);
// @ts-expect-error Script tool context remains required.
void script.execute({ value: 1 }, noContext);
// @ts-expect-error Template tools require an input schema at creation.
create.Template.asTool({ template: 'Ready' });
// @ts-expect-error Script tools require an input schema at creation.
create.Script.asTool({ script: 'return 1' });
// @ts-expect-error Function tools require an input schema at creation.
create.Function.asTool({ execute: () => 1 });
const templateConfig: TemplateToolConfig<{ value: number }, { factor: number }> = { inputSchema, contextSchema, template: '{{ value }}' };
const scriptConfig: ScriptToolConfig<{ value: number }, number, { factor: number }> & { script: string } = { inputSchema, contextSchema, script: 'return value', schema: z.number() };
const annotatedTemplate = create.Template.asTool(templateConfig);
const annotatedScript = create.Script.asTool(scriptConfig);
void annotatedTemplate.execute({ value: 1 }, options);
void annotatedScript.execute({ value: 1 }, options);
// @ts-expect-error Annotated renderer configs preserve declared input types.
void annotatedTemplate.execute({ value: 'wrong' }, options);
// @ts-expect-error Annotated script configs preserve declared context types.
void annotatedScript.execute({ value: 1 }, noContext);
declare const maybeScript: ScriptToolConfig<{ value: number }, number, { factor: number }>;
// @ts-expect-error An annotated config with a possibly absent script cannot complete a Script tool.
create.Script.asTool(maybeScript);

const textTool = create.TextGenerator.withFunction.asTool({ model, inputSchema, contextSchema, prompt: ({ value, _toolCallOptions }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof _toolCallOptions, ToolExecutionOptions<{ factor: number }> | undefined>();
	return String(value * (_toolCallOptions?.context.factor ?? 1));
} });
expectType<PromiseLike<string>>(textTool.execute({ value: 1 }, options));
// @ts-expect-error Function-prompt LLM tools retain numeric schema input.
void textTool.execute({ value: 'wrong' }, options);
// @ts-expect-error Function-prompt LLM tools retain required SDK context.
void textTool.execute({ value: 1 }, noContext);
void textTool({ value: 1 });
const promptToolParent = create.Config({ model, inputSchema, contextSchema, context: { prefix: 'value=' } });
const inheritedPromptTool = create.TextGenerator.withFunction.asTool({ prompt: ({ value, prefix, _toolCallOptions }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof prefix, string>();
	expectEqual<typeof _toolCallOptions, ToolExecutionOptions<{ factor: number }> | undefined>();
	// @ts-expect-error Ordinary direct component calls do not inject SDK execution options.
	expectType<ToolExecutionOptions<{ factor: number }>>(_toolCallOptions);
	return `${prefix}${value * (_toolCallOptions?.context.factor ?? 1)}`;
} }, promptToolParent);
void inheritedPromptTool.execute({ value: 1 }, options);
// @ts-expect-error Inherited function-prompt tools retain the required execution context shape.
void inheritedPromptTool.execute({ value: 1 }, noContext);
// @ts-expect-error An inherited function prompt must accept a replacement SDK context schema.
create.TextGenerator.withFunction.asTool({ contextSchema: z.object({ suffix: z.string() }) }, inheritedPromptTool);
const transformedPromptTool = create.TextGenerator.withFunction.asTool({
	model, inputSchema: z.object({ value: z.string().transform(Number) }),
	prompt: ({ value }) => {
		expectEqual<typeof value, string | number>();
		return String(value);
	},
});
void transformedPromptTool({ value: 'raw' });
void transformedPromptTool.execute({ value: 1 }, noContext);
// @ts-expect-error Direct hybrid calls validate raw input before rendering.
void transformedPromptTool({ value: 1 });
// @ts-expect-error Hybrid execute receives parsed SDK input.
void transformedPromptTool.execute({ value: 'raw' }, noContext);

const toolsOnly = create.Config({ tools: { multiply } });
const contextOnly = create.Config({ toolsContext: { multiply: { factor: 2 } } });
const complete = create.Config({ tools: { multiply } }, contextOnly);
const generator = create.TextGenerator({ model, prompt: 'Multiply', toolsContext: { multiply: { factor: 2 } } }, toolsOnly);
const streamer = create.TextStreamer({ model, prompt: 'Multiply' }, complete);
void generator.run({});
void streamer.run({});
void generator.run({ toolsContext: { multiply: { factor: 3 } } });
// @ts-expect-error Concrete components require context for tools whose schemas require it.
create.TextGenerator({ model, prompt: 'Multiply' }, toolsOnly);
// @ts-expect-error Streamers require context for tools whose schemas require it too.
create.TextStreamer({ model, tools: { multiply }, toolsContext: {} });
// @ts-expect-error Supplied partial Config tool contexts must already match known schemas.
create.Config({ tools: { multiply }, toolsContext: { multiply: { factor: 'wrong' } } });
// @ts-expect-error Direct generator configs validate required tool context values.
create.TextGenerator({ model, tools: { multiply }, toolsContext: { multiply: { factor: 'wrong' } } });
// @ts-expect-error Run tool contexts retain their declared shapes.
void generator.run({ toolsContext: { multiply: { factor: 'wrong' } } });
// @ts-expect-error A required tool context cannot be cleared during a run.
void streamer.run({ toolsContext: { multiply: undefined } });
const unknownName = { toolsContext: { multiply: { factor: 2 }, typo: { factor: 2 } } };
// @ts-expect-error Extra tool context names cannot bypass checking through typed variables.
void generator.run(unknownName);
// @ts-expect-error Known tools reject unknown context names during creation too.
create.TextGenerator({ model, tools: { multiply }, ...unknownName });
// @ts-expect-error Config validates context names when its tools are known.
create.Config({ tools: { multiply }, ...unknownName });

const extra = create.Function.asTool({ inputSchema: z.object({ query: z.string() }), execute: ({ query }) => query.length });
const merged = create.TextGenerator({ tools: { extra }, prompt: 'Use both' }, generator);
void merged.run({ toolsContext: { multiply: { factor: 4 } } });
expectEqual<keyof typeof merged.config.tools, 'multiply' | 'extra'>();
// @ts-expect-error An inherited required context cannot be replaced by a wrong value.
create.TextStreamer({ model, tools: { extra }, toolsContext: { multiply: { factor: 'wrong' } } }, complete);
const compatible = sdkTool({ inputSchema, contextSchema, execute: ({ value }, { context }) => value * context.factor });
void generator.run({ tools: { multiply: compatible } });
void streamer.run({ tools: { multiply: compatible }, toolsContext: { multiply: { factor: 5 } } });
const wrongInput = sdkTool({ inputSchema: z.object({ label: z.string() }), contextSchema, execute: () => 1 });
const wrongOutput = sdkTool({ inputSchema, contextSchema, execute: ({ value }) => String(value) });
const wrongContext = sdkTool({ inputSchema, contextSchema: z.object({ suffix: z.string() }), execute: ({ value }) => value });
// @ts-expect-error Run tool replacements must retain the input type.
void generator.run({ tools: { multiply: wrongInput } });
// @ts-expect-error Run tool replacements must retain the output type.
void generator.run({ tools: { multiply: wrongOutput } });
// @ts-expect-error Run tool replacements must retain the context type.
void streamer.run({ tools: { multiply: wrongContext } });
// @ts-expect-error New run tool names require constructing a new component.
void generator.run({ tools: { extra } });
const extraNames = { tools: { multiply: compatible, extra } };
// @ts-expect-error Typed variables cannot introduce extra run tool names.
void streamer.run(extraNames);
const nested = create.Function.asTool({ inputSchema, contextSchema: z.object({ request: z.object({ id: z.string(), authenticated: z.boolean() }) }), execute: ({ value }, { context }) => context.request.authenticated ? value : 0 });
const nestedGenerator = create.TextGenerator({ model, prompt: 'Use nested', tools: { nested }, toolsContext: { nested: { request: { id: 'original', authenticated: true } } } });
void nestedGenerator.run({ toolsContext: { nested: { request: { id: 'replacement', authenticated: false } } } });
// @ts-expect-error Each supplied tool context replaces its entire value without merging nested fields.
void nestedGenerator.run({ toolsContext: { nested: { request: { id: 'replacement' } } } });
// @ts-expect-error Child tool contexts replace their entire inherited value too.
create.TextGenerator({ toolsContext: { nested: { request: { id: 'replacement' } } } }, nestedGenerator);

const unionToolInput = z.discriminatedUnion('kind', [z.object({ kind:z.literal('text'), text:z.string() }), z.object({ kind:z.literal('count'), count:z.number() })]);
const unionTool = create.Function.asTool({ inputSchema:unionToolInput, context:{ text:123, count:'default' }, execute:input=>{
	if (input.kind === 'text')expectEqual<typeof input.text, string>();else expectEqual<typeof input.count, number>();
	return input.kind;
} });
void unionTool.execute({ kind:'text', text:'input' }, noContext);
void unionTool({ kind:'count', count:1 }, noContext);
expectEqual<Parameters<typeof unionTool>, Parameters<typeof unionTool.execute>>();
// @ts-expect-error Tool input union branches retain required fields.
void unionTool.execute({ kind:'text' }, noContext);
// @ts-expect-error Parsed tool branches override configured defaults with their own input types.
void unionTool({ kind:'count', count:'wrong' }, noContext);
