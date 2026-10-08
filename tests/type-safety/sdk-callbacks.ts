import { create, z } from 'casai';
import type { LanguageModel } from 'ai';

declare const model: LanguageModel;
const tool = create.Function.asTool({ inputSchema: z.object({ query: z.string() }), execute: ({ query }) => query.length });
const parent = create.Config({ model, tools: { tool } });
const generator = create.TextGenerator({ onEnd: event => {
	const _query: string = event.staticToolCalls[0].input.query;
	// @ts-expect-error Strict optional properties retain inherited callback types.
	const _wrong: number = event.staticToolCalls[0].input.query;
} }, parent);
void generator.run({ onEnd: event => {
	// @ts-expect-error Strict optional properties retain run callback types.
	const _wrong: string = event.staticToolResults[0].output;
} });
const object = create.ObjectStreamer({ model, schema: z.object({ answer: z.number() }), onFinish: event => {
	const _answer: number | undefined = event.object?.answer;
	// @ts-expect-error The finish event has a schema-typed optional object.
	const _wrong: string = event.object?.answer;
} });
object.run({});
// @ts-expect-error Optional SDK callbacks cannot be explicitly undefined under exact optional properties.
object.run({ onFinish: undefined });
// @ts-expect-error Optional callbacks cannot require arbitrary event types.
object.run({ onFinish: (_event: number) => undefined });
