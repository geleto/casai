import { create, z } from 'casai';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

declare const enabled: boolean;
declare const model: LanguageModel;
const broad = z.object({ value: z.union([z.string(), z.number()]) });
const narrow = z.object({ value: z.string() });
const selected = enabled ? broad : narrow;
const fn = create.Function({ inputSchema: selected, execute: ({ value }) => value });
void fn({ value: 'shared' });
void fn.run({ context: { value: 'shared' } });
// @ts-expect-error The selected parser may require a string.
void fn({ value: 1 });
// @ts-expect-error Run must satisfy every possible selected parser.
void fn.run({ context: { value: 1 } });
expectEqual<Awaited<ReturnType<typeof fn>>, string | number>();

const left = z.object({ left: z.string() });
const right = z.object({ right: z.number() });
const separate = create.Function({ inputSchema: enabled ? left : right, execute: () => 1 });
// @ts-expect-error The right parser's required input is missing.
void separate({ left: 'only' });
// @ts-expect-error Both closed contracts must be satisfied; their extra keys conflict.
void separate({ left: 'only', right: 1 });
const intrinsic = create.Function({ inputSchema: z.union([left, right]), execute: () => 1 });
void intrinsic({ left: 'one branch' });
void intrinsic({ right: 1 });
const selectedUnion = create.Function({ inputSchema: enabled ? z.union([left, right]) : left, execute: () => 1 });
void selectedUnion({ left: 'shared branch' });
// @ts-expect-error Selecting a union parser does not open the other selected parser.
void selectedUnion({ right: 1 });
const configuredEither = create.Function({ inputSchema: enabled ? left : right, context: { left: 'ready', right: 1 }, execute: input => {
	expectEqual<typeof input.left, string>();
	expectEqual<typeof input.right, number>();
	return input.right;
} });
void configuredEither();
void configuredEither.run();
// @ts-expect-error A configured field is private when the other parser is selected.
void configuredEither({ left: 'replacement' });

const publicKey = z.looseObject({ key: z.string().transform(Number) });
const privateKey = z.looseObject({ query: z.string().optional() });
const inputSchema = enabled ? publicKey : privateKey;
const config = { inputSchema, context: { key: '4' } };
const retained = create.Function({ ...config, execute: ({ key }) => {
	expectEqual<typeof key, string | number>();
	return key;
} });
void retained();
void retained.run();
void retained({ query: 'allowed' });
// @ts-expect-error key is private under one selected schema.
void retained({ key: '5' });
// @ts-expect-error Named calls cannot replace a possibly private binding.
void retained.run({ context: { key: '5' } });
const parent = create.Config(config);
const inherited = create.Function({ execute: ({ key }) => {
	expectEqual<typeof key, string | number>();
	return key;
} }, parent);
void inherited();
// @ts-expect-error Inheritance preserves the schema selection.
void inherited({ key: '5' });

const script = create.Script({ ...config, script: 'return key' });
const template = create.Template({ ...config, template: '{{ key }}' });
void script();
void template({ query: 'allowed' });
// @ts-expect-error Renderer shorthand checks each selected parser's private names.
void script({ key: '5' });
// @ts-expect-error Named renderer calls have the same contract.
void script.run({ context: { key: '5' } });
// @ts-expect-error Template shorthand checks each selected parser.
void template({ key: '5' });
// @ts-expect-error Template run checks each selected parser.
void template.run({ context: { key: '5' } });
const text = create.TextGenerator.withFunction({ ...config, model, prompt: ({ key }) => {
	expectEqual<typeof key, string | number>();
	return String(key);
} });
const stream = create.TextStreamer.withTemplate({ ...config, model, prompt: '{{ key }}' });
const object = create.ObjectGenerator.withScript({ ...config, model, prompt: 'return key', schema: z.object({ answer: z.string() }) });
const objectStream = create.ObjectStreamer.withFunction({ ...config, model, schema: z.object({ answer: z.string() }), prompt: ({ key }) => {
	expectEqual<typeof key, string | number>();
	return String(key);
} });
void text();
void text.run({});
void stream();
void object();
void objectStream();
// @ts-expect-error Function preparers preserve selected-schema privacy.
void text({ key: '5' });
// @ts-expect-error LLM run checks the selected schema too.
void text.run({ context: { key: '5' } });
// @ts-expect-error Streamed renderer calls preserve privacy.
void stream({ key: '5' });
// @ts-expect-error Object renderers preserve privacy.
void object({ key: '5' });
// @ts-expect-error Object streamer named calls preserve privacy.
void objectStream.run({ context: { key: '5' } });

const child = create.Function.asTool({ ...config, inputSchema: enabled ? publicKey.strip() : privateKey.strip(), execute: ({ key }) => {
	expectEqual<typeof key, string | number>();
	return key;
} });
void child();
child.bindToolContext({});
// @ts-expect-error Tool components retain the ordinary-call contract.
void child({ key: '5' });
create.Function({ tools: { child }, execute: async ({ child }) => {
	// @ts-expect-error Injected helpers enforce every selected schema.
	await child({ key: '5' });
	const result = await child();
	expectEqual<typeof result, string | number>();
	return result;
} });

// Keep whole-config correlations: each schema has its own valid configured value.
declare const correlated: { inputSchema: typeof narrow; context: { value: string } }
	| { inputSchema: z.ZodObject<{ value: z.ZodNumber }>; context: { value: number } };
const paired = create.Function({ execute: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return value;
} }, { config: correlated });
void paired();
void paired.run();
// @ts-expect-error This override is incompatible with the numeric selection.
void paired({ value: 'wrong selection' });

declare const pairedOwnership: { inputSchema: typeof publicKey; context: { key: string } }
	| { inputSchema: typeof privateKey; context: { key: number } };
create.Function({ execute: ({ key }) => {
	// Both actual selections produce numbers, by parsing or private configuration.
	expectEqual<typeof key, number>();
	return key;
} }, { config: pairedOwnership });

const _empty = z.object({});
declare const pairedPrivate: { inputSchema: typeof _empty; context: { tenant: string }; execute: (input: { tenant: string }) => string }
	| { inputSchema: typeof _empty; context: { tenant: number }; execute: (input: { tenant: number }) => number };
const conditionalTool = create.Function.asTool({}, { config: pairedPrivate });
conditionalTool.bindToolContext({});
// @ts-expect-error Each selected implementation must accept the bound private dependency.
conditionalTool.bindToolContext({ tenant: 2 });
// @ts-expect-error Registry binding must preserve that same pairing.
create.Function({ tools: { conditionalTool }, toolsContext: { conditionalTool: { tenant: 'replacement' } }, execute: () => 1 });

const unionParser = z.union([z.object({ x: z.number().optional() }), z.object({ y: z.string().optional() })]);
const defaultParser = z.object({ factor: z.number() });
const projection = create.Function.asTool({ inputSchema: enabled ? unionParser : defaultParser, context: { factor: 3 }, execute: ({ factor }) => factor });
void projection();
projection.bindToolContext({});
// @ts-expect-error x would be a public default in the native union parser.
projection.bindToolContext({ x: 2 });
// @ts-expect-error Every selected parser must support object application input.
create.Function({ inputSchema: enabled ? z.string().transform(value => ({ value })) : narrow, execute: () => 1 });
