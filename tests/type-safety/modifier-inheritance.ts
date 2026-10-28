import { create, z } from 'casai';
import type { Agent, LanguageModel, Tool } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
const inputSchema = z.object({ name: z.string() });
const template = create.Template.loadsTemplate.asTool({ inputSchema, template: 'entry', loader: { load: () => '{{ name }}' } });
const script = create.Script.loadsScript.asTool({ inputSchema, script: 'entry', schema: z.string(), loader: { load: () => 'return name' } });
const fn = create.Function.asTool({ inputSchema, execute: ({ name }) => name });
const agent = create.LLMAgent.withTemplate.asStream.asTool({ model, inputSchema, prompt: '{{ name }}' });

const childTemplate = create.Template({}, create.Config({}, template));
const childScript = create.Script({}, create.Config({}, script));
const childFunction = create.Function({}, create.Config({}, fn));
const childAgent = create.LLMAgent({}, create.Config({}, agent));
expectType<Tool<{ name: string }, string, undefined>>(childTemplate);
expectType<Tool<{ name: string }, string, undefined>>(childScript);
expectType<Tool<{ name: string }, string, undefined>>(childFunction);
expectType<Tool<{ name: string }, string, undefined>>(childAgent);
expectEqual<typeof childTemplate.config.promptType, 'async-template-name'>();
expectEqual<typeof childScript.config.promptType, 'async-script-name'>();
expectEqual<typeof childAgent.config.promptType, 'async-template'>();
expectEqual<typeof childAgent.config.streaming, true>();
expectEqual<typeof childFunction.config.asTool, true>();
// @ts-expect-error An inherited tool keeps the separate tool interface.
expectType<Agent>(childAgent);
// @ts-expect-error A tool's fixed input schema cannot be cleared through the base factory.
create.Function({ inputSchema: undefined }, fn);
// @ts-expect-error Inherited tool admission still requires a declared input schema.
create.Template({ inputSchema: undefined }, template);
// @ts-expect-error Inherited tool admission still requires a declared input schema.
create.Script({ inputSchema: undefined }, script);
// @ts-expect-error Inherited tool admission still requires a declared input schema.
create.LLMAgent({ inputSchema: undefined }, agent);
// Loader chains retain inherited loaders when the child adds none.
create.Template({ loader: undefined }, template);
create.Script({ loader: undefined }, script);

const inlineTemplate = create.Template.withTemplate({ template: '{{ name }}' }, template);
const inlineScript = create.Script.withScript({ script: 'return name' }, script);
const literalAgent = create.LLMAgent.withText({}, agent);
expectEqual<typeof inlineTemplate.config.promptType, 'async-template'>();
expectEqual<typeof inlineScript.config.promptType, 'async-script'>();
expectEqual<typeof literalAgent.config.promptType, 'text'>();
expectEqual<typeof literalAgent.config.streaming, true>();
expectEqual<typeof literalAgent.config.asTool, true>();
expectType<Tool<{ name: string }, string, undefined>>(inlineTemplate);
expectType<Tool<{ name: string }, string, undefined>>(inlineScript);
expectType<Tool<{ name: string }, string, undefined>>(literalAgent);

const optionalTool = Math.random() ? create.Config({}, fn) : create.Config({ inputSchema, execute: ({ name }) => name });
const possibleTool = create.Function({}, optionalTool);
// @ts-expect-error A conditional tool parent does not guarantee the Tool surface.
expectType<Tool>(possibleTool);

const functionSource = create.LLMAgent.withFunction({ model, inputSchema: z.object({ amount: z.string().transform(Number) }), prompt: ({ amount }) => String(amount) });
const inheritedFunctionSource = create.LLMAgent({ prompt: context => {
	expectEqual<typeof context.amount, number>();
	// @ts-expect-error Inherited function prompts retain the parsed context shape.
	expectType<unknown>(context.missing);
	return String(context.amount);
} }, create.Config({}, functionSource));
void inheritedFunctionSource({ amount: '4' });

declare const prepare: (context: { amount: number }) => PromiseLike<string>;
const promisedSource = create.LLMAgent.withFunction({ model, inputSchema: z.object({ amount: z.string().transform(Number) }), prompt: prepare });
void create.LLMAgent({}, create.Config({}, promisedSource))({ amount: '4' });
