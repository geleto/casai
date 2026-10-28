// Consumer-only public input, trusted context, and native descriptor contracts.
import { create, z } from 'casai';
import type { ComponentTool, ComponentExecutionOptions, FunctionToolConfig, TemplateToolConfig, ScriptToolConfig } from 'casai';
import { Output, tool as sdkTool } from 'ai';
import type { InferToolOutput, JSONValue, LanguageModel, Tool, ToolExecutionOptions } from 'ai';
import type { LoaderInterface } from 'cascada-engine';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
declare const choose: boolean;
const inputSchema = z.object({ value: z.number() });
const contextSchema = z.object({ factor: z.number() });
const options: ToolExecutionOptions<{ factor: number }> = { toolCallId: 'call', messages: [], context: { factor: 2 } };
const noContext: ToolExecutionOptions<undefined> = { toolCallId: 'call', messages: [], context: undefined };
// @ts-expect-error Producers must satisfy the raw output schema even without callback parameters.
create.Function.asTool({ inputSchema, schema: z.number(), execute: () => 'wrong' });
const parsedTool = create.Function.asTool({ inputSchema: z.object({ value: z.string().transform(Number), fallback: z.string().default('default') }), execute: ({ value, fallback: _fallback }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof _fallback, string>();
	return value;
} });
void parsedTool({ value: '1' });
void parsedTool.execute({ value: 1, fallback: 'parsed' }, noContext);
// @ts-expect-error Native execution receives parsed arguments.
void parsedTool.execute({ value: 'raw', fallback: 'parsed' }, noContext);
// @ts-expect-error Parsed schema defaults are present at native execution.
void parsedTool.execute({ value: 1 }, noContext);
const transformedOutputTool = create.Function.asTool({ inputSchema, schema: z.string().transform(Number), execute: ({ value }) => String(value) });
expectType<Promise<number>>(transformedOutputTool({ value: 1 }));
expectType<PromiseLike<number>>(transformedOutputTool.execute({ value: 1 }, noContext));
// @ts-expect-error Producers return raw output; Casai parses it.
create.Function.asTool({ inputSchema, schema: z.string().transform(Number), execute: () => 123 });
const multiply = create.Function.asTool({
	inputSchema, toolContextSchema: contextSchema, context: { offset: 1, factor: 1 }, schema: z.number(),
	execute: ({ value, offset, factor, _toolOptions }) => {
		expectEqual<typeof value, number>();
		expectEqual<typeof offset, number>();
		expectEqual<typeof factor, number>();
		expectEqual<typeof _toolOptions, ComponentExecutionOptions>();
		expectType<string | undefined>(_toolOptions.toolCallId);
		expectType<AbortSignal | undefined>(_toolOptions.abortSignal);
		// @ts-expect-error Trusted context is flat and excluded from execution metadata.
		expectType<unknown>(_toolOptions.context);
		return value * factor + offset;
	},
});
expectType<Promise<number>>(multiply({ value: 1 }));
expectType<PromiseLike<number>>(multiply.execute({ value: 1 }, options));
// @ts-expect-error Ordinary arguments cannot replace a private configured dependency.
void multiply({ value: 1, offset: 3 });
// @ts-expect-error Native public arguments contain only schema output.
void multiply.execute({ value: 1, offset: 3 }, options);
// @ts-expect-error Required public input is not configured here.
void multiply({});
// @ts-expect-error Native execution requires the complete parsed input.
void multiply.execute({}, options);
// @ts-expect-error Public input retains its declared type.
void multiply({ value: 'wrong' });
// @ts-expect-error Ordinary calls do not accept native execution options.
void multiply({ value: 1 }, options);
// @ts-expect-error Native execution requires options.
void multiply.execute({ value: 1 });
// @ts-expect-error Native context remains independently required.
void multiply.execute({ value: 1 }, noContext);
// @ts-expect-error The native context must match its schema output.
void multiply.execute({ value: 1 }, { ...options, context: { factor: 'wrong' } });
const inherited = create.Function.asTool({}, multiply);
void inherited.execute({ value: 2 }, options);
// @ts-expect-error Inheritance preserves input types.
void inherited({ value: 'wrong' });
// @ts-expect-error Inheritance preserves the native context requirement.
void inherited.execute({ value: 1 }, noContext);
// Configured factor still satisfies the body when the context schema is removed or changes unrelated fields.
create.Function.asTool({ toolContextSchema: undefined }, multiply);
create.Function.asTool({ toolContextSchema: z.object({ label: z.string() }) }, multiply);
// @ts-expect-error A context override cannot change the type of a dependency consumed by the inherited body.
create.Function.asTool({ toolContextSchema: z.object({ factor: z.string() }) }, multiply);
// @ts-expect-error An inherited body cannot consume changed public input.
create.Function.asTool({ inputSchema: z.object({ value: z.string() }) }, multiply);
// @ts-expect-error An inherited producer must satisfy its output schema.
create.Function.asTool({ schema: z.string() }, multiply);
const replacement = create.Function.asTool({
	inputSchema: z.object({ label: z.string() }), toolContextSchema: z.object({ suffix: z.string() }), context: { suffix: '!' }, schema: z.string(),
	execute: ({ label, offset: _offset, suffix }) => {
		expectEqual<typeof label, string>();
		expectEqual<typeof _offset, number>();
		expectEqual<typeof suffix, string>();
		return label + suffix;
	},
}, multiply);
expectType<PromiseLike<string>>(replacement.execute({ label: 'child' }, { ...options, context: { suffix: '!' } }));
// @ts-expect-error Replacing the schema replaces its input names.
void replacement.execute({ value: 1 }, { ...options, context: { suffix: '!' } });
// @ts-expect-error Replacing the context schema replaces its native output contract.
void replacement.execute({ label: 'child' }, options);
const contextFree = create.Function.asTool({ inputSchema, execute: ({ value, _toolOptions }) => {
	expectEqual<typeof _toolOptions, ComponentExecutionOptions>();
	return value;
} });
void contextFree.execute({ value: 1 }, noContext);
// @ts-expect-error Unspecified native context retains its undefined type.
void contextFree.execute({ value: 1 }, options);
const optional = create.Function.asTool({ inputSchema, context: { factor: undefined as number | undefined }, toolContextSchema: contextSchema.optional(), execute: ({ value, factor }) => value * (factor ?? 1) });
void optional.execute({ value: 1 }, options);
void optional.execute({ value: 1 }, noContext);
// @ts-expect-error Optional context validates a present value.
void optional.execute({ value: 1 }, { ...options, context: { factor: 'wrong' } });
const declaredConfig: FunctionToolConfig<typeof inputSchema, undefined, undefined, undefined, { factor: number }> & { toolContextSchema: typeof contextSchema } = {
	inputSchema, toolContextSchema: contextSchema, execute: context => context.value * ('factor' in context ? context.factor : 1),
};
const declaredTool = create.Function.asTool(declaredConfig);
const declaredChild = create.Function.asTool({}, { config: declaredConfig });
void declaredChild.execute({ value: 1 }, options);
// @ts-expect-error Annotations retain their declared native context.
void declaredTool.execute({ value: 1 }, noContext);
// @ts-expect-error ConfigProvider inheritance retains the native context.
void declaredChild.execute({ value: 1 }, noContext);
const conditional = choose ? { toolContextSchema: contextSchema } : {};
const conditionalTool = create.Function.asTool({ inputSchema, context: { factor: 1 }, ...conditional, execute: ({ value, factor }) => value * factor });
const conditionalChild = create.Function.asTool({}, conditionalTool);
void conditionalChild.execute({ value: 1 }, options);
// @ts-expect-error Conditional schemas still reject unrelated context types.
void conditionalChild.execute({ value: 1 }, { ...options, context: 'wrong' });

const rendererParent = create.Config({ inputSchema, toolContextSchema: contextSchema });
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
// Source-free object unions retain native validation.
create.Template.asTool({ inputSchema: z.union([inputSchema, z.object({ name: z.string() })]), template: 'Ready' });
// @ts-expect-error Tool arguments require declared root fields, including source-free tools.
create.Script.asTool({ inputSchema: z.record(z.string(), z.number()), script: 'return 1' });
// Dynamic keys remain supported beneath a declared field.
create.Script.asTool({ inputSchema: z.object({ values: z.record(z.string(), z.number()) }), script: 'return values' });
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
const templateConfig: TemplateToolConfig<{ value: number }, { factor: number }> & { toolContextSchema: typeof contextSchema } = { inputSchema, toolContextSchema: contextSchema, template: '{{ value }}' };
const scriptConfig: ScriptToolConfig<{ value: number }, number, { factor: number }> & { script: string; schema: z.ZodNumber; toolContextSchema: typeof contextSchema } = { inputSchema, toolContextSchema: contextSchema, script: 'return value', schema: z.number() };
const annotatedTemplate = create.Template.withTemplate.asTool(templateConfig);
const annotatedScript = create.Script.withScript.asTool(scriptConfig);
void annotatedTemplate.execute({ value: 1 }, options);
void annotatedScript.execute({ value: 1 }, options);
// @ts-expect-error Annotated renderer configs preserve declared input types.
void annotatedTemplate.execute({ value: 'wrong' }, options);
// @ts-expect-error Annotated script configs preserve declared context types.
void annotatedScript.execute({ value: 1 }, noContext);
declare const maybeScript: ScriptToolConfig<{ value: number }, number, { factor: number }>;
// @ts-expect-error An annotated config with a possibly absent script cannot complete a Script tool.
create.Script.asTool(maybeScript);

const textTool = create.LLMAgent.withFunction.asTool({ model, inputSchema, context: { factor: 1 }, toolContextSchema: contextSchema, prompt: ({ value, factor, _toolOptions }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof _toolOptions, ComponentExecutionOptions>();
	return String(value * factor);
} });
expectType<PromiseLike<string>>(textTool.execute({ value: 1 }, options));
// @ts-expect-error Function-prompt LLM tools retain numeric schema input.
void textTool.execute({ value: 'wrong' }, options);
// @ts-expect-error Function-prompt LLM tools retain required SDK context.
void textTool.execute({ value: 1 }, noContext);
void textTool({ value: 1 });
const promptToolParent = create.Config({ model, inputSchema, toolContextSchema: contextSchema, context: { prefix: 'value=', factor: 1 } });
const inheritedPromptTool = create.LLMAgent.withFunction.asTool({ prompt: ({ value, prefix, factor, _toolOptions }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof prefix, string>();
	expectEqual<typeof _toolOptions, ComponentExecutionOptions>();
	// @ts-expect-error Ordinary direct component calls do not inject SDK execution options.
	expectType<ToolExecutionOptions<{ factor: number }>>(_toolOptions);
	return `${prefix}${value * factor}`;
} }, promptToolParent);
void inheritedPromptTool.execute({ value: 1 }, options);
// @ts-expect-error Inherited function-prompt tools retain the required execution context shape.
void inheritedPromptTool.execute({ value: 1 }, noContext);
// The configured factor continues to satisfy the inherited prompt.
create.LLMAgent.withFunction.asTool({ toolContextSchema: z.object({ suffix: z.string() }) }, inheritedPromptTool);
const transformedPromptTool = create.LLMAgent.withFunction.asTool({
	model, inputSchema: z.object({ value: z.string().transform(Number) }),
	prompt: ({ value }) => {
		expectEqual<typeof value, number>();
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
const generator = create.LLMAgent({ model, prompt: 'Multiply', toolsContext: { multiply: { factor: 2 } } }, toolsOnly);
const streamer = create.LLMAgent.asStream({ model, prompt: 'Multiply' }, complete);
void generator.run({});
void streamer.run({});
void generator.run({ toolsContext: { multiply: { factor: 3 } } });
// @ts-expect-error Concrete components require context for tools whose schemas require it.
create.LLMAgent({ model, prompt: 'Multiply' }, toolsOnly);
// @ts-expect-error Streamers require context for tools whose schemas require it too.
create.LLMAgent.asStream({ model, tools: { multiply }, toolsContext: {} });
// @ts-expect-error Supplied partial Config tool contexts must already match known schemas.
create.Config({ tools: { multiply }, toolsContext: { multiply: { factor: 'wrong' } } });
// @ts-expect-error Direct generator configs validate required tool context values.
create.LLMAgent({ model, tools: { multiply }, toolsContext: { multiply: { factor: 'wrong' } } });
// @ts-expect-error Run tool contexts retain their declared shapes.
void generator.run({ toolsContext: { multiply: { factor: 'wrong' } } });
// @ts-expect-error A required tool context cannot be cleared during a run.
void streamer.run({ toolsContext: { multiply: undefined } });
const unknownName = { toolsContext: { multiply: { factor: 2 }, typo: { factor: 2 } } };
// @ts-expect-error Extra tool context names cannot bypass checking through typed variables.
void generator.run(unknownName);
// @ts-expect-error Known tools reject unknown context names during creation too.
create.LLMAgent({ model, tools: { multiply }, ...unknownName });
// @ts-expect-error Config validates context names when its tools are known.
create.Config({ tools: { multiply }, ...unknownName });

const extra = create.Function.asTool({ inputSchema: z.object({ query: z.string() }), execute: ({ query }) => query.length });
const merged = create.LLMAgent({ tools: { extra }, prompt: 'Use both' }, generator);
void merged.run({ toolsContext: { multiply: { factor: 4 } } });
expectEqual<keyof typeof merged.config.tools, 'multiply' | 'extra'>();
// @ts-expect-error An inherited required context cannot be replaced by a wrong value.
create.LLMAgent.asStream({ model, tools: { extra }, toolsContext: { multiply: { factor: 'wrong' } } }, complete);
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
const nested = create.Function.asTool({ inputSchema, context: { request: { id: 'initial', authenticated: false } }, toolContextSchema: z.object({ request: z.object({ id: z.string(), authenticated: z.boolean() }) }), execute: ({ value, request }) => request.authenticated ? value : 0 });
const nestedGenerator = create.LLMAgent({ model, prompt: 'Use nested', tools: { nested }, toolsContext: { nested: { request: { id: 'original', authenticated: true } } } });
void nestedGenerator.run({ toolsContext: { nested: { request: { id: 'replacement', authenticated: false } } } });
// @ts-expect-error Each supplied tool context replaces its entire value without merging nested fields.
void nestedGenerator.run({ toolsContext: { nested: { request: { id: 'replacement' } } } });
// @ts-expect-error Child tool contexts replace their entire inherited value too.
create.LLMAgent({ toolsContext: { nested: { request: { id: 'replacement' } } } }, nestedGenerator);

const unionToolInput = z.discriminatedUnion('kind', [z.object({ kind:z.literal('text'), text:z.string() }), z.object({ kind:z.literal('count'), count:z.number() })]);
const unionTool = create.Function.asTool({ inputSchema:unionToolInput, context:{ db: true }, execute:input=>{
	if (input.kind === 'text')expectEqual<typeof input.text, string>();else expectEqual<typeof input.count, number>();
	return input.kind;
} });
void unionTool.execute({ kind:'text', text:'input' }, noContext);
void unionTool.execute({ kind:'count', count:1 }, noContext);
// @ts-expect-error Tool input union branches retain required fields.
void unionTool.execute({ kind:'text' }, noContext);
// @ts-expect-error Parsed tool branches retain their own value types.
void unionTool.execute({ kind:'count', count:'wrong' }, noContext);

// Tool outputs follow their final generation mode and schema, including inherited defaults.
const answerSchema = z.object({ answer: z.number() });
const objectTool = create.LLMAgent.asTool({ model, inputSchema, toolContextSchema: contextSchema, prompt: 'Answer', output: Output.object({ schema: answerSchema }) });
const arrayTool = create.LLMAgent.asTool({ model, inputSchema, prompt: 'Answer', output: Output.array({ element: answerSchema }) });
const enumTool = create.LLMAgent.asTool({ model, inputSchema, prompt: 'Answer', output: Output.choice({ options: ['yes', 'no'] }) });
const jsonTool = create.LLMAgent.asTool({ model, inputSchema, prompt: 'Answer', output: Output.json() });
expectEqual<Awaited<ReturnType<typeof objectTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof arrayTool.execute>>, { answer: number }[]>();
expectEqual<Awaited<ReturnType<typeof enumTool.execute>>, 'yes' | 'no'>();
expectEqual<Awaited<ReturnType<typeof jsonTool.execute>>, JSONValue>();
const objectToolParent = create.Config({ model, inputSchema, toolContextSchema: contextSchema, output: Output.object({ schema: answerSchema }), prompt: 'Answer' });
const _inheritedObjectTool = create.LLMAgent.asTool({}, objectToolParent);
const _inheritedArrayTool = create.LLMAgent.asTool({}, arrayTool);
const _inheritedEnumTool = create.LLMAgent.asTool({}, enumTool);
const _inheritedJsonTool = create.LLMAgent.asTool({}, jsonTool);
expectEqual<Awaited<ReturnType<typeof _inheritedObjectTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof _inheritedArrayTool.execute>>, { answer: number }[]>();
expectEqual<Awaited<ReturnType<typeof _inheritedEnumTool.execute>>, 'yes' | 'no'>();
expectEqual<Awaited<ReturnType<typeof _inheritedJsonTool.execute>>, JSONValue>();
const objectTemplateTool = create.LLMAgent.withTemplate.asTool({ model, inputSchema, toolContextSchema: contextSchema, prompt: '{{ value }}', output: Output.object({ schema: answerSchema }) });
const objectScriptTool = create.LLMAgent.withScript.asTool({ model, inputSchema, prompt: 'return value', output: Output.object({ schema: answerSchema }) });
const objectFunctionTool = create.LLMAgent.withFunction.asTool({ model, inputSchema, prompt: ({ value }) => String(value), output: Output.object({ schema: answerSchema }) });
expectEqual<Awaited<ReturnType<typeof objectTemplateTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof objectScriptTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof objectFunctionTool.execute>>, { answer: number }>();
declare const loader: LoaderInterface;
const loadedTextObjectTool = create.LLMAgent.loadsText.asTool({ model, inputSchema, prompt: 'answer.txt', loader, output: Output.object({ schema: answerSchema }) });
const loadedTemplateObjectTool = create.LLMAgent.loadsTemplate.asTool({ model, inputSchema, prompt: 'answer.njk', loader, output: Output.object({ schema: answerSchema }) });
const loadedScriptObjectTool = create.LLMAgent.loadsScript.asTool({ model, inputSchema, prompt: 'answer.casc', loader, output: Output.object({ schema: answerSchema }) });
expectEqual<Awaited<ReturnType<typeof loadedTextObjectTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof loadedTemplateObjectTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof loadedScriptObjectTool.execute>>, { answer: number }>();
const _inheritedTemplateObjectTool = create.LLMAgent.withTemplate.asTool({}, objectTemplateTool);
const _inheritedScriptObjectTool = create.LLMAgent.withScript.asTool({}, objectScriptTool);
const _inheritedFunctionObjectTool = create.LLMAgent.withFunction.asTool({}, objectFunctionTool);
const _inheritedLoadedTextObjectTool = create.LLMAgent.loadsText.asTool({}, loadedTextObjectTool);
const _inheritedLoadedTemplateObjectTool = create.LLMAgent.loadsTemplate.asTool({}, loadedTemplateObjectTool);
const _inheritedLoadedScriptObjectTool = create.LLMAgent.loadsScript.asTool({}, loadedScriptObjectTool);
expectEqual<Awaited<ReturnType<typeof _inheritedTemplateObjectTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof _inheritedScriptObjectTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof _inheritedFunctionObjectTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof _inheritedLoadedTextObjectTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof _inheritedLoadedTemplateObjectTool.execute>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof _inheritedLoadedScriptObjectTool.execute>>, { answer: number }>();
const _changedOutputObjectTool = create.LLMAgent.withTemplate.asTool({ output: Output.object({ schema: z.object({ answer: z.string() }) }) }, objectTemplateTool);
expectEqual<Awaited<ReturnType<typeof _changedOutputObjectTool.execute>>, { answer: string }>();
const scriptJsonTool = create.Script.asTool({ inputSchema, script: 'return { answer: value }' });
const _inheritedScriptJsonTool = create.Script.asTool({}, scriptJsonTool);
expectEqual<Awaited<ReturnType<typeof scriptJsonTool.execute>>, unknown>();
expectEqual<Awaited<ReturnType<typeof _inheritedScriptJsonTool.execute>>, unknown>();
expectEqual<Awaited<ReturnType<typeof scriptJsonTool>>, unknown>();
const _loadedScriptJsonTool = create.Script.loadsScript.asTool({ inputSchema, script: 'answer.casc', loader });
expectEqual<Awaited<ReturnType<typeof _loadedScriptJsonTool.execute>>, unknown>();
expectEqual<Awaited<ReturnType<typeof _loadedScriptJsonTool>>, unknown>();

// Public tools remain structurally compatible with both Casai and the AI SDK.
expectType<ComponentTool<{ value: number }, number, { factor: number }>>(multiply);
expectType<Tool<{ value: number }, number, { factor: number }>>(multiply);
expectType<ComponentTool<{ value: number }, string, { factor: number }>>(template);
expectType<Tool<{ value: number }, string, { factor: number }>>(template);
expectType<ComponentTool<{ value: number }, number, { factor: number }>>(script);
expectType<Tool<{ value: number }, number, { factor: number }>>(script);
expectType<ComponentTool<{ value: number }, string, { factor: number }>>(textTool);
expectType<Tool<{ value: number }, string, { factor: number }>>(textTool);
expectType<ComponentTool<{ value: number }, { answer: number }, { factor: number }>>(objectTool);
expectType<Tool<{ value: number }, { answer: number }, { factor: number }>>(objectTool);
// @ts-expect-error Typed object tool outputs cannot be widened to a different schema result.
expectType<Tool<{ value: number }, { answer: string }, { factor: number }>>(objectTool);

create.LLMAgent({ model, prompt: 'Use tools', tools: { template, script, textTool, objectTool }, toolsContext: {
	template: { factor: 2 }, script: { factor: 2 }, textTool: { factor: 2 }, objectTool: { factor: 2 },
}, onEnd: event => {
	for (const result of event.staticToolResults) {
		expectEqual<typeof result.input, { value: number }>();
		if (result.toolName === 'objectTool') {
			expectEqual<typeof result.output, { answer: number }>();
			// @ts-expect-error Object tool result fields preserve their schema type inside SDK callbacks.
			expectType<string>(result.output.answer);
		} else if (result.toolName === 'script') expectEqual<typeof result.output, number>();
		else expectEqual<typeof result.output, string>();
	}
} });
// @ts-expect-error Every tool family with a required contextSchema requires matching toolsContext.
create.LLMAgent({ model, prompt: 'Use tools', tools: { template, script, textTool, objectTool }, toolsContext: { template: { factor: 2 }, script: { factor: 2 }, textTool: { factor: 2 } } });

// Renderer tools without a JavaScript callback can replace execution context schemas freely.
const suffixSchema = z.object({ suffix: z.string() });
const suffixOptions: ToolExecutionOptions<{ suffix: string }> = { ...noContext, context: { suffix: '!' } };
const replacedTemplateContext = create.Template.asTool({ toolContextSchema: suffixSchema }, template);
const replacedObjectContext = create.LLMAgent.withTemplate.asTool({ toolContextSchema: suffixSchema }, objectTemplateTool);
const textTemplateTool = create.LLMAgent.withTemplate.asTool({ model, inputSchema, toolContextSchema: contextSchema, prompt: '{{ value }}' });
const replacedTextContext = create.LLMAgent.withTemplate.asTool({ toolContextSchema: suffixSchema }, textTemplateTool);
void replacedTemplateContext.execute({ value: 1 }, suffixOptions);
void replacedObjectContext.execute({ value: 1 }, suffixOptions);
void replacedTextContext.execute({ value: 1 }, suffixOptions);
// @ts-expect-error Replaced Template context schemas remove the previous factor context.
void replacedTemplateContext.execute({ value: 1 }, options);
// @ts-expect-error Replaced generator context schemas remove the previous factor context.
void replacedObjectContext.execute({ value: 1 }, options);
// @ts-expect-error Replaced text-generator context schemas remove the previous factor context.
void replacedTextContext.execute({ value: 1 }, options);

// Direct renderer calls validate raw values; SDK execute receives already parsed schema output.
const rawRendererInput = z.object({ value: z.string().transform(Number), fallback: z.string().default('default') });
const rawTemplateTool = create.Template.asTool({ inputSchema: rawRendererInput, template: '{{ value }}' });
const rawScriptTool = create.Script.asTool({ inputSchema: rawRendererInput, script: 'return value', schema: z.union([z.string(), z.number()]) });
const rawObjectTool = create.LLMAgent.withTemplate.asTool({ model, inputSchema: rawRendererInput, prompt: '{{ value }}', output: Output.object({ schema: answerSchema }) });
void rawTemplateTool({ value: '1' });
void rawScriptTool({ value: '1' });
void rawObjectTool({ value: '1' });
void rawTemplateTool.execute({ value: 1, fallback: 'parsed' }, noContext);
void rawScriptTool.execute({ value: 1, fallback: 'parsed' }, noContext);
void rawObjectTool.execute({ value: 1, fallback: 'parsed' }, noContext);
// @ts-expect-error Template direct calls take raw schema input.
void rawTemplateTool({ value: 1 });
// @ts-expect-error Script direct calls take raw schema input.
void rawScriptTool({ value: 1 });
// @ts-expect-error Object renderer direct calls take raw schema input.
void rawObjectTool({ value: 1 });
// @ts-expect-error Template execute takes parsed values, including defaulted fields.
void rawTemplateTool.execute({ value: '1', fallback: 'parsed' }, noContext);
// @ts-expect-error Script execute takes parsed values, including defaulted fields.
void rawScriptTool.execute({ value: 1 }, noContext);
// @ts-expect-error Object renderer execute takes parsed values.
void rawObjectTool.execute({ value: '1', fallback: 'parsed' }, noContext);

// Function/tool conversion preserves the original implementation and parsed result.
const regularFunction = create.Function({ inputSchema, schema: z.number(), execute: ({ value }) => value + 1 });
const convertedTool = create.Function.asTool({}, regularFunction);
const convertedBack = create.Function({}, convertedTool);
expectEqual<ReturnType<typeof convertedBack>, Promise<number>>();
expectEqual<ReturnType<typeof convertedTool.execute>, PromiseLike<number>>();
void convertedTool.execute({ value: 1 }, noContext);
void convertedBack({ value: 1 });
// @ts-expect-error Conversion back to Function restores the ordinary one-argument call contract.
void convertedBack({ value: 1 }, noContext);
// @ts-expect-error Conversion preserves the input schema.
void convertedBack({ value: 'wrong' });
// Both ordinary and native execution deliver parsed application input.
create.Function({}, parsedTool);
const rawConversionFunction = create.Function({ inputSchema: rawRendererInput, execute: ({ value }) => value + 1 });
// Conversion preserves the original implementation and schema.
create.Function.asTool({}, rawConversionFunction);

// Text tools return the parsed application value selected by the final merged output setting.
const parsedTextOutput = Output.object({ schema: z.object({ answer: z.string().transform(Number) }) });
const parsedTextConfig = { model, inputSchema, output: parsedTextOutput, prompt: 'Answer' };
const parsedTextTools = [
	create.LLMAgent.asTool(parsedTextConfig),
	create.LLMAgent.withText.asTool(parsedTextConfig),
	create.LLMAgent.withTemplate.asTool(parsedTextConfig),
	create.LLMAgent.withScript.asTool({ ...parsedTextConfig, prompt: 'return "Answer"' }),
	create.LLMAgent.loadsText.asTool({ ...parsedTextConfig, loader: {} as LoaderInterface }),
	create.LLMAgent.loadsTemplate.asTool({ ...parsedTextConfig, loader: {} as LoaderInterface }),
	create.LLMAgent.loadsScript.asTool({ ...parsedTextConfig, loader: {} as LoaderInterface }),
	create.LLMAgent.withFunction.asTool({ ...parsedTextConfig, prompt: () => 'Answer' }),
];
for (const parsedTextTool of parsedTextTools) {
	expectEqual<InferToolOutput<typeof parsedTextTool>, { answer: number }>();
	expectType<PromiseLike<{ answer: number }>>(parsedTextTool.execute({ value: 1 }, noContext));
	// @ts-expect-error Parsed application output is not raw JSON text.
	expectType<PromiseLike<string>>(parsedTextTool.execute({ value: 1 }, noContext));
}
const parsedTextParent = create.Config(parsedTextConfig);
const inheritedParsedTextTools = [
	create.LLMAgent.asTool({}, parsedTextParent),
	create.LLMAgent.withTemplate.asTool({}, parsedTextParent),
	create.LLMAgent.withScript.asTool({}, parsedTextParent),
	create.LLMAgent.loadsText.asTool({ loader: {} as LoaderInterface }, parsedTextParent),
	create.LLMAgent.loadsTemplate.asTool({ loader: {} as LoaderInterface }, parsedTextParent),
	create.LLMAgent.loadsScript.asTool({ loader: {} as LoaderInterface }, parsedTextParent),
	create.LLMAgent.withFunction.asTool({ prompt: () => 'Answer' }, parsedTextParent),
];
for (const inheritedTextTool of inheritedParsedTextTools) {
	expectEqual<InferToolOutput<typeof inheritedTextTool>, { answer: number }>();
	expectType<PromiseLike<{ answer: number }>>(inheritedTextTool.execute({ value: 1 }, noContext));
}
const overriddenTextTool = create.LLMAgent.asTool({ output: Output.array({ element: z.string().transform(Number) }) }, parsedTextParent);
expectEqual<InferToolOutput<typeof overriddenTextTool>, number[]>();
expectType<PromiseLike<number[]>>(overriddenTextTool.execute({ value: 1 }, noContext));
declare const optionalTextOutput: { output?: typeof parsedTextOutput };
const optionalTextTool = create.LLMAgent.asTool({ model, inputSchema, prompt: 'Answer', ...optionalTextOutput });
expectEqual<InferToolOutput<typeof optionalTextTool>, string | { answer: number }>();
expectType<PromiseLike<string | { answer: number }>>(optionalTextTool.execute({ value: 1 }, noContext));
