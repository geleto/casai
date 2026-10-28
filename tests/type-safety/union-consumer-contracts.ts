import { Output } from 'ai';
import { create, z, textStreamSchema, streamSchema } from 'casai';
import { jsonSchema } from 'ai';
import type { LanguageModel } from 'ai';
import type { InferToolOutput } from '@ai-sdk/provider-utils';
import { expectEqual } from './assert.js';

declare const enabled: boolean;
declare const model: LanguageModel;
const loader = (name: string) => name;

// Collection distributes over schema alternatives; ordinary calls keep their stream.
const mixed = create.Function.asTool({
	inputSchema: z.object({}), schema: enabled ? textStreamSchema() : z.number(),
	execute: () => enabled ? (async function* () { yield 'ab'; })() : 7,
	toModelOutput: ({ output }) => {
		expectEqual<typeof output, string | number>();
		return { type: 'text', value: String(output) };
	},
});
expectEqual<Awaited<ReturnType<typeof mixed>>, AsyncIterable<string> | number>();
expectEqual<Awaited<ReturnType<typeof mixed.execute>>, string | number>();
const _binding = mixed.bindToolContext({});
expectEqual<InferToolOutput<typeof _binding.tool>, string | number>();
create.Function({ tools: { mixed }, execute: async ({ mixed }) => {
	const value = await mixed({});
	expectEqual<typeof value, string | number>();
	if (typeof value !== 'number') {
		// @ts-expect-error The completed tool value is text, not the producer iterable.
		const _producer: AsyncIterable<string> = value;
	}
	return value;
} });
create.LLMAgent.withFunction({ model, tools: { mixed }, prompt: async ({ mixed }) => {
	const value = await mixed({});
	expectEqual<typeof value, string | number>();
	return String(value);
} });
const _elementOrScalar = create.Script.asTool({
	inputSchema: z.object({}), script: 'return result',
	context: { result: enabled ? (async function* () { yield '2'; })() : false },
	schema: enabled ? streamSchema(z.string().transform(Number)) : z.boolean(),
});
expectEqual<Awaited<ReturnType<typeof _elementOrScalar.execute>>, number[] | boolean>();
const _streamKinds = create.Function.asTool({
	inputSchema: z.object({}), schema: enabled ? textStreamSchema() : streamSchema(z.number()),
	execute: () => enabled ? (async function* () { yield 'ab'; })() : (async function* () { yield 2; })(),
});
expectEqual<Awaited<ReturnType<typeof _streamKinds.execute>>, string | number[]>();

// A branch-only private key must be rejected by every application-call consumer.
declare const input: { value: number } | { value: number; user: string };
declare const unrelated: { value: number } | { value: number; extra: string };
const config = { inputSchema: z.looseObject({ value: z.number() }), context: { user: 'private' } };
const script = create.Script({ ...config, script: 'return value' });
const template = create.Template({ ...config, template: '{{ value }}' });
const fn = create.Function({ ...config, execute: ({ value }) => value });
// @ts-expect-error A possible argument branch replaces the private user binding.
void script(input);
// @ts-expect-error Named calls protect the same binding.
void script.run({ context: input });
void script(unrelated);
// @ts-expect-error A possible argument branch replaces the private user binding.
void template(input);
// @ts-expect-error Named calls protect the same binding.
void template.run({ context: input });
void template(unrelated);
// @ts-expect-error A possible argument branch replaces the private user binding.
void fn(input);
// @ts-expect-error Named calls protect the same binding.
void fn.run({ context: input });
void fn(unrelated);
void fn.run({ context: unrelated });
void fn({ value: 1, extra: 'allowed' });
const helperWithExtras = create.Function.asTool({ ...config, inputSchema: z.object({ value: z.number(), extra: z.string().optional() }), execute: ({ value }) => value });
create.Function({ tools: { helperWithExtras }, execute: async ({ helperWithExtras }) => {
	// @ts-expect-error Helpers protect private branch-only names too.
	await helperWithExtras(input);
	return helperWithExtras(unrelated);
} });
const numericExtras = create.Function({
	inputSchema: z.object({ value: z.number() }).catchall(z.number()),
	context: { value: 1 }, execute: ({ value }) => value,
});
declare const validExtras: { extra: number } | { other: number };
void numericExtras(validExtras);
void numericExtras.run({ context: validExtras });
void numericExtras({ extra: 2 });
// @ts-expect-error Native catchall value types still constrain every union branch.
void numericExtras(unrelated);
declare const undefinedExtras: { value: number } | { value: number; extra: undefined };
// @ts-expect-error An explicit undefined extra must satisfy the numeric catchall too.
void numericExtras(undefinedExtras);
// @ts-expect-error A configured public default does not allow invalid overrides.
void numericExtras({ value: 'wrong' });
const textGenerator = create.LLMAgent.withTemplate({ ...config, model, prompt: '{{ value }}' });
// @ts-expect-error A private key in any possible branch is still private.
void textGenerator(input);
// @ts-expect-error The run validator must also enumerate branch-only keys.
void textGenerator.run({ context: input });
void textGenerator(unrelated);
void textGenerator.run({ context: unrelated });
const textStreamer = create.LLMAgent.withTemplate.asStream({ ...config, model, prompt: '{{ value }}' });
// @ts-expect-error A private key in any possible branch is still private.
void textStreamer(input);
// @ts-expect-error The run validator must also enumerate branch-only keys.
void textStreamer.run({ context: input });
void textStreamer(unrelated);
void textStreamer.run({ context: unrelated });
const objectGenerator = create.LLMAgent.withTemplate({ ...config, model, prompt: '{{ value }}', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error A private key in any possible branch is still private.
void objectGenerator(input);
// @ts-expect-error The run validator must also enumerate branch-only keys.
void objectGenerator.run({ context: input });
void objectGenerator(unrelated);
void objectGenerator.run({ context: unrelated });
const objectStreamer = create.LLMAgent.withTemplate.asStream({ ...config, model, prompt: '{{ value }}', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error A private key in any possible branch is still private.
void objectStreamer(input);
// @ts-expect-error The run validator must also enumerate branch-only keys.
void objectStreamer.run({ context: input });
void objectStreamer(unrelated);
void objectStreamer.run({ context: unrelated });

// Whole settings alternatives keep branch-only application contexts visible.
const defaultText = create.LLMAgent.withTemplate({ context: { value: 1 } }, textGenerator);
const defaultStream = create.LLMAgent.withTemplate.asStream({ context: { value: 1 } }, textStreamer);
const defaultObject = create.LLMAgent.withTemplate({ context: { value: 1 } }, objectGenerator);
const defaultObjectStream = create.LLMAgent.withTemplate.asStream({ context: { value: 1 } }, objectStreamer);
declare const privateSettings: { maxOutputTokens: number } | { context: { value: number; user: string } };
declare const undefinedPrivateSettings: { maxOutputTokens: number } | { context: { user: undefined } };
declare const validSettings: { maxOutputTokens: number } | { context: { value: number; extra: string } };
// @ts-expect-error The context-bearing alternative replaces a private binding.
void defaultText.run(privateSettings);
// @ts-expect-error Streaming uses the same complete-alternative check.
void defaultStream.run(privateSettings);
// @ts-expect-error Object generation must not skip a branch-only context.
void defaultObject.run(privateSettings);
// @ts-expect-error Object streaming must not skip a branch-only context.
void defaultObjectStream.run(privateSettings);
// @ts-expect-error Own undefined still replaces a private binding.
void defaultText.run(undefinedPrivateSettings);
void defaultText.run(validSettings);
void defaultStream.run(validSettings);
void defaultObject.run(validSettings);
void defaultObjectStream.run(validSettings);
const published = create.Template({
	template: '{{ value }}', context: config.context,
	inputSchema: z.looseObject({ value: z.number(), user: z.string().optional() }),
});
void published(input);
const closed = create.Template({ template: '{{ value }}', inputSchema: z.object({ value: z.number() }) });
// @ts-expect-error Closed shapes also reject undeclared branch-only keys.
void closed(unrelated);

// The capability gate concerns partitioning, not whether the native schema can parse.
const opaque = z.union([z.object({ value: z.number() }), z.union([z.object({ value: z.number() }), z.object({ value: z.number() })])]);
const privateConfig = { model, inputSchema: opaque, context: { user: 'private' } };
const inherited = create.Config(privateConfig);
const described = jsonSchema<{ value: number }>({ type: 'object', properties: { value: { type: 'number' } }, required: ['value'] }, {
	validate(value) {
		const parsed = opaque.safeParse(value);
		return parsed.success ? { success: true, value: parsed.data } : { success: false, error: parsed.error };
	},
});
// @ts-expect-error Partitioned opaque input needs declared metadata in LLMAgent.withTemplate.
create.LLMAgent.withTemplate({ ...privateConfig, prompt: 'value' });
// @ts-expect-error Partitioned opaque input needs declared metadata in LLMAgent.withScript.
create.LLMAgent.withScript({ ...privateConfig, prompt: 'value' });
// @ts-expect-error Partitioned opaque input needs declared metadata in LLMAgent.withFunction.
create.LLMAgent.withFunction({ ...privateConfig, prompt: ({ value }) => String(value) });
// @ts-expect-error Partitioned opaque input needs declared metadata in LLMAgent.loadsTemplate.
create.LLMAgent.loadsTemplate({ ...privateConfig, prompt: 'value', loader });
// @ts-expect-error Partitioned opaque input needs declared metadata in LLMAgent.loadsScript.
create.LLMAgent.loadsScript({ ...privateConfig, prompt: 'value', loader });
// @ts-expect-error Final admission includes inherited configured sources.
create.LLMAgent.withTemplate({ prompt: 'value' }, inherited);
create.LLMAgent.withTemplate({ model, inputSchema: opaque, prompt: 'value' });
create.LLMAgent.withTemplate({ ...privateConfig, inputSchema: described, prompt: 'value' });
create.LLMAgent.withFunction({ ...privateConfig, inputSchema: z.object({ value: z.number() }), prompt: ({ value, user }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof user, string>();
	return `${user}${value}`;
} });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready' });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.withTemplate.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready' });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.withScript.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready' });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.withFunction.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: () => 'ready' });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.loadsTemplate.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready', loader });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.loadsScript.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready', loader });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.loadsText.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready', loader });
// @ts-expect-error Partitioned opaque input needs declared metadata in streaming LLMAgent.withTemplate.
create.LLMAgent.withTemplate.asStream({ ...privateConfig, prompt: 'value' });
// @ts-expect-error Partitioned opaque input needs declared metadata in streaming LLMAgent.withScript.
create.LLMAgent.withScript.asStream({ ...privateConfig, prompt: 'value' });
// @ts-expect-error Partitioned opaque input needs declared metadata in streaming LLMAgent.withFunction.
create.LLMAgent.withFunction.asStream({ ...privateConfig, prompt: ({ value }) => String(value) });
// @ts-expect-error Partitioned opaque input needs declared metadata in streaming LLMAgent.loadsTemplate.
create.LLMAgent.loadsTemplate.asStream({ ...privateConfig, prompt: 'value', loader });
// @ts-expect-error Partitioned opaque input needs declared metadata in streaming LLMAgent.loadsScript.
create.LLMAgent.loadsScript.asStream({ ...privateConfig, prompt: 'value', loader });
// @ts-expect-error Final admission includes inherited configured sources.
create.LLMAgent.withTemplate.asStream({ prompt: 'value' }, inherited);
create.LLMAgent.withTemplate.asStream({ model, inputSchema: opaque, prompt: 'value' });
create.LLMAgent.withTemplate.asStream({ ...privateConfig, inputSchema: described, prompt: 'value' });
create.LLMAgent.withFunction.asStream({ ...privateConfig, inputSchema: z.object({ value: z.number() }), prompt: ({ value, user }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof user, string>();
	return `${user}${value}`;
} });
// @ts-expect-error Partitioned opaque input needs declared metadata in structured LLMAgent.withTemplate.
create.LLMAgent.withTemplate({ ...privateConfig, prompt: 'value', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Partitioned opaque input needs declared metadata in structured LLMAgent.withScript.
create.LLMAgent.withScript({ ...privateConfig, prompt: 'value', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Partitioned opaque input needs declared metadata in structured LLMAgent.withFunction.
create.LLMAgent.withFunction({ ...privateConfig, prompt: ({ value }) => String(value), output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Partitioned opaque input needs declared metadata in structured LLMAgent.loadsTemplate.
create.LLMAgent.loadsTemplate({ ...privateConfig, prompt: 'value', loader, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Partitioned opaque input needs declared metadata in structured LLMAgent.loadsScript.
create.LLMAgent.loadsScript({ ...privateConfig, prompt: 'value', loader, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Final admission includes inherited configured sources.
create.LLMAgent.withTemplate({ prompt: 'value', output: Output.object({ schema: z.object({ answer: z.string() }) }) }, inherited);
create.LLMAgent.withTemplate({ model, inputSchema: opaque, prompt: 'value', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
create.LLMAgent.withTemplate({ ...privateConfig, inputSchema: described, prompt: 'value', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
create.LLMAgent.withFunction({ ...privateConfig, inputSchema: z.object({ value: z.number() }), prompt: ({ value, user }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof user, string>();
	return `${user}${value}`;
}, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.withTemplate.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.withScript.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.withFunction.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: () => 'ready', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.loadsTemplate.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready', loader, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.loadsScript.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready', loader, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Casai merges tool context into an object; native scalar contexts are separate.
create.LLMAgent.loadsText.asTool({ model, inputSchema: z.object({}), toolContextSchema: z.string(), prompt: 'ready', loader, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Partitioned opaque input needs declared metadata in streaming structured LLMAgent.withTemplate.
create.LLMAgent.withTemplate.asStream({ ...privateConfig, prompt: 'value', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Partitioned opaque input needs declared metadata in streaming structured LLMAgent.withScript.
create.LLMAgent.withScript.asStream({ ...privateConfig, prompt: 'value', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Partitioned opaque input needs declared metadata in streaming structured LLMAgent.withFunction.
create.LLMAgent.withFunction.asStream({ ...privateConfig, prompt: ({ value }) => String(value), output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Partitioned opaque input needs declared metadata in streaming structured LLMAgent.loadsTemplate.
create.LLMAgent.loadsTemplate.asStream({ ...privateConfig, prompt: 'value', loader, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Partitioned opaque input needs declared metadata in streaming structured LLMAgent.loadsScript.
create.LLMAgent.loadsScript.asStream({ ...privateConfig, prompt: 'value', loader, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Final admission includes inherited configured sources.
create.LLMAgent.withTemplate.asStream({ prompt: 'value', output: Output.object({ schema: z.object({ answer: z.string() }) }) }, inherited);
create.LLMAgent.withTemplate.asStream({ model, inputSchema: opaque, prompt: 'value', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
create.LLMAgent.withTemplate.asStream({ ...privateConfig, inputSchema: described, prompt: 'value', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
create.LLMAgent.withFunction.asStream({ ...privateConfig, inputSchema: z.object({ value: z.number() }), prompt: ({ value, user }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof user, string>();
	return `${user}${value}`;
}, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
const helper = create.Function.asTool({ inputSchema: z.object({}), execute: () => 1 });
// @ts-expect-error Executable registry defaults also require input declarations.
create.LLMAgent.withTemplate({ model, inputSchema: opaque, tools: { helper }, prompt: 'ready' });
// @ts-expect-error Declared incoming private names require input declarations too.
create.LLMAgent.asTool({ model, inputSchema: opaque, toolContextSchema: z.object({ user: z.string() }), prompt: 'ready' });
// No executable fallback is installed for a descriptor with no executor.
create.LLMAgent.withTemplate({ model, inputSchema: opaque, tools: { helper: { inputSchema: z.object({}) } }, prompt: 'ready' });
