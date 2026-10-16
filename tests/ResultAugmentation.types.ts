// Compile-only checks for SDK wrappers and non-exact factory inputs, using the source project's settings.
/* eslint-disable @typescript-eslint/no-unused-vars -- Compile-only inference fixtures. */
import { Output, tool } from 'ai';
import type { Agent, AgentCallParameters, AgentStreamParameters, LanguageModel, StreamTextResult, GenerateTextResult } from 'ai';
import { z } from 'zod';
import { create } from 'casai';
import { generateTextWithResult, streamTextWithResult } from '../src/augment-result.js';
import { expectEqual, expectType } from './type-safety/assert.js';

declare const model: LanguageModel;
const tools = { lookup: tool({ inputSchema: z.object({ n: z.number() }), execute: ({ n }) => n * 2 }) };
const runtimeContext = { requestId: 'request' };
const output = Output.object({ schema: z.object({ n: z.string().transform(Number) }) });
const generated = generateTextWithResult({ model, prompt: 'test', tools, runtimeContext, output });
const streamed = streamTextWithResult({ model, prompt: 'test', tools, runtimeContext, output });
type Generated = Awaited<typeof generated>;
type Streamed = Awaited<typeof streamed>;
expectEqual<Generated['value'], { n: number }>();
expectEqual<Generated['output'], { n: number }>();
expectEqual<Streamed['value'], Promise<{ n: number }> | AsyncIterable<{ n: number }>>();
expectEqual<Streamed['output'], PromiseLike<{ n: number }>>();
expectEqual<Streamed['finalStep'], StreamTextResult<typeof tools, typeof runtimeContext, typeof output>['finalStep']>();
expectEqual<Generated['steps'], GenerateTextResult<typeof tools, typeof runtimeContext, typeof output>['steps']>();

const choices: string[] = ['yes', 'no'];
const choice = streamTextWithResult({ model, prompt: 'test', output: Output.choice({ options: choices }) });
const text = streamTextWithResult({ model, prompt: 'test', output: Output.text() });
const defaultText = streamTextWithResult({ model, prompt: 'test' });
const array = streamTextWithResult({ model, prompt: 'test', output: Output.array({ element: z.string().transform(Number) }) });
const arrayObject = streamTextWithResult({ model, prompt: 'test', output: Output.object({ schema: z.array(z.number()) }) });
expectEqual<Awaited<typeof choice>['value'], AsyncIterable<string> | Promise<string>>();
expectEqual<Awaited<typeof text>['value'], Awaited<typeof choice>['value']>();
expectEqual<Awaited<typeof defaultText>['value'], AsyncIterable<string>>();
type ArrayValue = Promise<number[]> | AsyncIterable<number[]> | AsyncIterable<number>;
expectEqual<Awaited<typeof array>['value'], ArrayValue>();
expectEqual<Awaited<typeof arrayObject>['value'], ArrayValue>();

const agent = {
	version: 'agent-v1' as const, id: undefined, tools,
	generate: (call: AgentCallParameters<never, typeof tools, typeof runtimeContext>) => generateTextWithResult({ model, tools, runtimeContext, output, ...call }),
	stream: async (call: AgentStreamParameters<never, typeof tools, typeof runtimeContext>) => streamTextWithResult({ model, tools, runtimeContext, output, ...call }),
} satisfies Agent<never, typeof tools, typeof runtimeContext, typeof output>;
expectType<Agent<never, typeof tools, typeof runtimeContext, typeof output>>(agent);

// @ts-expect-error The completed schema output is numeric, not the raw string.
expectType<PromiseLike<{ value: { n: string } }>>(generated);
// @ts-expect-error Literal SDK requests must provide prompt or messages.
void generateTextWithResult({ model });
// @ts-expect-error SDK requests do not accept both prompt and messages.
void streamTextWithResult({ model, prompt: 'test', messages: [] });

// Output unions preserve each member's possible deliveries.
declare const flag: boolean;
const unionOutput = flag ? Output.text() : Output.array({ element: z.number() });
const unionResult = streamTextWithResult({ model, prompt: 'test', output: unionOutput });
expectEqual<typeof unionResult.value, Promise<string> | AsyncIterable<string> | ArrayValue>();

// Explicit undefined is accepted with non-exact optional properties; exact consumers keep the SDK restriction.
const knownOutput = { ...output, name: 'object' as const };
const maybeOutput = flag ? knownOutput : undefined;
const explicitUndefined = create.TextStreamer({ model, output: maybeOutput })('test');
expectEqual<typeof explicitUndefined.value, Promise<{ n: number }> | AsyncIterable<string>>();
const outputParent = create.Config({ model, output: knownOutput });
const clearedParent = create.TextStreamer({ output: undefined }, outputParent)('test');
expectEqual<typeof clearedParent.value, AsyncIterable<string>>();
