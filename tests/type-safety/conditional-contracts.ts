import { Output } from 'ai';
import { create, z } from 'casai';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

declare const enabled: boolean;
declare const model: LanguageModel;

// A present schema property can explicitly describe two execution possibilities.
const schema = enabled ? z.string().transform(value => value.length) : undefined;
const component = create.Function({ schema, execute: () => 'hello' });
expectEqual<Awaited<ReturnType<typeof component>>, string | number>();
expectEqual<Awaited<ReturnType<typeof component.run>>, string | number>();
// @ts-expect-error Parsing may replace the producer's string with a number.
const _stringResult: Promise<string> = component();
const tool = create.Function.asTool({ inputSchema: z.object({}), schema, execute: () => 'hello' });
expectEqual<Awaited<ReturnType<typeof tool.execute>>, string | number>();
create.Function({
	tools: { tool },
	execute: async ({ tool }) => {
		const value = await tool({});
		expectEqual<typeof value, string | number>();
		// @ts-expect-error Registered helpers preserve conditional output parsing.
		const _text: string = value;
		return value;
	},
});
const raw = create.Function({ schema: undefined, execute: () => 'hello' });
const _parsed = create.Function({ schema: z.string().transform(value => value.length), execute: () => 'hello' });
expectEqual<Awaited<ReturnType<typeof raw>>, string>();
expectEqual<Awaited<ReturnType<typeof _parsed>>, number>();
const _inherited = create.Function({ schema }, raw);
expectEqual<Awaited<ReturnType<typeof _inherited>>, string | number>();

// Neither branch guarantees complete input, even though both aid completion.
declare const context: { a: number } | { b: number };
const inputSchema = z.object({ a: z.number(), b: z.number() });
const script = create.Script({ context, inputSchema, script: 'return a + b' });
const template = create.Template({ context, inputSchema, template: '{{ a + b }}' });
const generator = create.LLMAgent.withTemplate({ model, context, inputSchema, prompt: '{{ a + b }}' });
const streamer = create.LLMAgent.withScript.asStream({ model, context, inputSchema, prompt: 'return a + b' });
const preparer = create.LLMAgent.withFunction({ model, context, inputSchema, prompt: ({ a, b }) => String(a + b) });
const objectGenerator = create.LLMAgent.withTemplate({ model, context, inputSchema, prompt: '{{ a + b }}', output: Output.object({ schema: z.object({ answer: z.string() }) }) });
const objectStreamer = create.LLMAgent.withFunction.asStream({ model, context, inputSchema, prompt: ({ a, b }) => String(a + b), output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Both required fields must exist after the merge.
void script();
// @ts-expect-error An alternate source does not supply application input.
void script('return a + b');
// @ts-expect-error Explicit empty input does not complete either branch.
void script({});
// @ts-expect-error Templates use the same complete-input requirement.
void template();
// @ts-expect-error Rendered generators cannot omit incomplete input.
void generator();
// @ts-expect-error Named calls cannot omit incomplete input.
void generator.run({});
// @ts-expect-error Explicit empty input also remains invalid.
void generator.run({ context: {} });
// @ts-expect-error Rendered streamers cannot omit incomplete input.
void streamer();
// @ts-expect-error Named streamer calls preserve the requirement.
void streamer.run({});
// @ts-expect-error Function preparer runs preserve the requirement too.
void preparer.run({});
// @ts-expect-error Object generator shorthand preserves the requirement.
void objectGenerator();
// @ts-expect-error Object generator runs preserve the requirement.
void objectGenerator.run({});
// @ts-expect-error Object streamer runs preserve the requirement.
void objectStreamer.run({});
void script({ a: 2, b: 3 });
void template({ a: 2, b: 3 });
void generator({ a: 2, b: 3 });
void generator.run({ context: { a: 2, b: 3 } });
void preparer.run({ context: { a: 2, b: 3 } });
void streamer.run({ context: { a: 2, b: 3 } });
void objectGenerator.run({ context: { a: 2, b: 3 } });
void objectStreamer.run({ context: { a: 2, b: 3 } });
declare const complete: { a: number, b: number } | { a: number, b: number, privateValue: boolean };
void create.Script({ context: complete, inputSchema, script: 'return a + b' })();
void create.Template({ context: complete, inputSchema, template: '{{ a + b }}' })();
void create.LLMAgent.withTemplate({ model, context: complete, inputSchema, prompt: '{{ a + b }}' }).run({});
const parent = create.Config({ context, inputSchema });
// @ts-expect-error Inheritance does not turn partial alternatives into complete input.
void create.Script({ script: 'return a + b' }, parent)();
void create.Script({ context: { a: 2, b: 3 }, script: 'return a + b' }, parent)();
