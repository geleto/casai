import type { EmptyMap } from './assert.js';
import { Output } from 'ai';
import { create, z } from 'casai';
import type { InferToolOutput, LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

declare const model: LanguageModel;
const _transformed = z.string().transform(text => text.length);
declare const config: { schema: typeof _transformed; execute: () => string } | { execute: () => string };
const component = create.Function(config);
expectEqual<Awaited<ReturnType<typeof component>>, string | number>();
expectEqual<Awaited<ReturnType<typeof component.run>>, string | number>();
// @ts-expect-error A schema in one configuration branch can replace the producer result.
const _onlyString: Promise<string> = component();
const _inherited = create.Function({}, create.Config(config));
expectEqual<Awaited<ReturnType<typeof _inherited>>, string | number>();
// Final validation still checks supplied parents after inference.
// @ts-expect-error Parent fields must belong to a supported fragment.
create.Config({}, { config: { unknownSetting: true } });
// @ts-expect-error Invalid parent values cannot be deferred to invocation.
create.Config({}, { config: { model: 123 } });
declare const invalidParent: { model: LanguageModel } | { model: number };
// @ts-expect-error Every possible parent must have valid setting types.
create.Config({}, { config: invalidParent });
const tool = create.Function.asTool({ inputSchema: z.object({}), ...config });
expectEqual<Awaited<ReturnType<typeof tool.execute>>, string | number>();
const _bound = tool.bindToolContext({});
expectEqual<InferToolOutput<typeof _bound.tool>, string | number>();
create.Function({ tools: { tool }, execute: async ({ tool }) => {
	const result = await tool({});
	expectEqual<typeof result, string | number>();
	// @ts-expect-error A registered helper also returns the parsed alternative.
	result.toUpperCase(); // eslint-disable-line @typescript-eslint/no-unsafe-call -- Intentional compiler rejection.
	return typeof result === 'string' ? result.toUpperCase() : result;
} });


declare const parent: { context: { user: string } } | EmptyMap;
const inheritedPrivate = create.Template({ inputSchema: z.looseObject({ value: z.number() }), template: '{{ value }}' }, { config: parent });
void inheritedPrivate({ value: 2, extra: true });
// @ts-expect-error A binding present in any configuration alternative remains private.
void inheritedPrivate({ value: 2, user: 'replacement' });

const inputSchema = z.union([
	z.strictObject({ kind: z.literal('closed'), value: z.number() }),
	z.looseObject({ kind: z.literal('open'), value: z.number() }),
]);
const operation = create.Function({ inputSchema, execute: ({ value }) => value });
const template = create.Template({ inputSchema, template: '{{ value }}' });
const script = create.Script({ inputSchema, script: 'return value' });
const generator = create.LLMAgent.withTemplate({ model, inputSchema, prompt: '{{ value }}' });
const streamer = create.LLMAgent.withScript.asStream({ model, inputSchema, prompt: 'return value' });
const object = create.LLMAgent.withTemplate({ model, inputSchema, prompt: '{{ value }}', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
const objectStream = create.LLMAgent.withScript.asStream({ model, inputSchema, prompt: 'return value', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
const preparer = create.LLMAgent.withFunction({ model, inputSchema, prompt: ({ value }) => String(value) });
const closedExtra = { kind: 'closed' as const, value: 2, extra: true };
const openExtra = { kind: 'open' as const, value: 2, extra: true };
// @ts-expect-error The open alternative cannot authorize extras for the closed discriminator.
void operation(closedExtra);
// @ts-expect-error Named Function calls use the same effective branch.
void operation.run({ context: closedExtra });
// @ts-expect-error Renderer shorthand checks the effective closed branch.
void template(closedExtra);
// @ts-expect-error Named renderer calls check the effective closed branch.
void template.run({ context: closedExtra });
// @ts-expect-error Script shorthand checks the effective closed branch.
void script(closedExtra);
// @ts-expect-error Script run checks the effective closed branch.
void script.run({ context: closedExtra });
// @ts-expect-error Generator shorthand checks the effective closed branch.
void generator(closedExtra);
// @ts-expect-error Generator run checks the effective closed branch.
void generator.run({ context: closedExtra });
// @ts-expect-error Streamer shorthand checks the effective closed branch.
void streamer(closedExtra);
// @ts-expect-error Streamer run checks the effective closed branch.
void streamer.run({ context: closedExtra });
// @ts-expect-error Object generator shorthand checks the effective closed branch.
void object(closedExtra);
// @ts-expect-error Object generator run checks the effective closed branch.
void object.run({ context: closedExtra });
// @ts-expect-error Object streamer shorthand checks the effective closed branch.
void objectStream(closedExtra);
// @ts-expect-error Object streamer run checks the effective closed branch.
void objectStream.run({ context: closedExtra });
// @ts-expect-error Function preparer shorthand checks the effective closed branch.
void preparer(closedExtra);
// @ts-expect-error Function preparer run checks the effective closed branch.
void preparer.run({ context: closedExtra });
void operation(openExtra);
void operation({ kind: 'closed', value: 2 });
void template(openExtra);
void script(openExtra);
void generator(openExtra);
void streamer(openExtra);
void object(openExtra);
void objectStream(openExtra);
void preparer(openExtra);
void operation.run({ context: openExtra });
void generator.run({ context: openExtra });

const mixedTool = create.Function.asTool({ inputSchema: z.union([
	z.object({ kind: z.literal('closed'), value: z.number() }),
	z.object({ kind: z.literal('open'), value: z.number(), extra: z.boolean().optional() }),
]), execute: ({ value }) => value });
// @ts-expect-error The component's ordinary tool call uses the same closed-branch rule.
void mixedTool(closedExtra);
create.Function({ tools: { mixedTool }, execute: async ({ mixedTool }) => {
	// @ts-expect-error Injected helpers validate raw application input too.
	await mixedTool(closedExtra);
	return mixedTool(openExtra);
} });

const defaultsSchema = z.union([
	z.strictObject({ kind: z.literal('closed'), value: z.number() }),
	z.looseObject({ kind: z.literal('open'), value: z.number(), extra: z.boolean() }),
]);
const defaulted = create.Function({ inputSchema: defaultsSchema, context: { kind: 'open' as const, value: 2, extra: true }, execute: ({ value }) => value });
void defaulted();
void defaulted({ kind: 'open' });
// @ts-expect-error The configured extra survives a discriminator change and invalidates the closed branch.
void defaulted({ kind: 'closed' });

// Stripping and strict shapes have the same closed-shape caller policy.
const stripping = create.Function({ inputSchema: z.union([
	z.object({ kind: z.literal('closed'), value: z.number() }),
	z.looseObject({ kind: z.literal('open'), value: z.number() }),
]), execute: ({ value }) => value });
// @ts-expect-error A stripping branch still rejects extras in typed calls.
void stripping(closedExtra);
void stripping(openExtra);

// A numeric catchall allows its own values but cannot open the other branch.
const catchall = create.Function({ inputSchema: z.union([
	z.strictObject({ closed: z.literal(true) }),
	z.object({ value: z.number() }).catchall(z.number()),
]), execute: () => 1 });
void catchall({ closed: true });
void catchall({ value: 2, extra: 3 });
// @ts-expect-error Extra values must satisfy the selected catchall.
void catchall({ value: 2, extra: 'wrong' });
// @ts-expect-error The closed alternative does not allow extras either.
void catchall({ closed: true, extra: 3 });

// Unschematized callback input remains open; private bindings are still reserved.
const unschematized = create.Function({ execute: ({ value }: { value: number }) => value });
void unschematized({ value: 2, extra: true });
