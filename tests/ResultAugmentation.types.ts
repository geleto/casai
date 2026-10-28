// Compile-only checks for normalized result types and non-exact factory inputs, using the source project's settings.
/* eslint-disable @typescript-eslint/no-unused-vars -- Compile-only inference fixtures. */
import { Output, tool } from 'ai';
import type { Agent, ModelMessage, LanguageModel, StreamTextResult, GenerateTextResult } from 'ai';
import { z } from 'zod';
import { create } from 'casai';
import { generateTextWithResult, streamTextWithResult } from '../src/augment-result.js';
import { expectEqual, expectType } from './type-safety/assert.js';

declare const model: LanguageModel;
const tools = { lookup: tool({ inputSchema: z.object({ n: z.number() }), execute: ({ n }) => n * 2 }) };
const runtimeContext = { requestId: 'request' };
const output = Output.object({ schema: z.object({ n: z.string().transform(Number) }) });
const messages: ModelMessage[] = [{ role: 'user', content: 'test' }];
const generated = generateTextWithResult({ model, messages, tools, runtimeContext, output }, messages);
const streamed = streamTextWithResult({ model, messages, tools, runtimeContext, output }, messages).result;
type Generated = Awaited<typeof generated>;
type Streamed = Awaited<typeof streamed>;
expectEqual<Generated['value'], { n: number }>();
expectEqual<Generated['output'], { n: number }>();
expectEqual<Streamed['value'], Promise<{ n: number }>>();
expectEqual<Streamed['output'], PromiseLike<{ n: number }>>();
expectEqual<Streamed['finalStep'], StreamTextResult<typeof tools, typeof runtimeContext, typeof output>['finalStep']>();
expectEqual<Generated['steps'], GenerateTextResult<typeof tools, typeof runtimeContext, typeof output>['steps']>();

const choices: string[] = ['yes', 'no'];
const choice = streamTextWithResult({ model, messages, output: Output.choice({ options: choices }) }, messages).result;
const text = streamTextWithResult({ model, messages, output: Output.text() }, messages).result;
const defaultText = streamTextWithResult({ model, messages }, messages).result;
const array = streamTextWithResult({ model, messages, output: Output.array({ element: z.string().transform(Number) }) }, messages).result;
const arrayObject = streamTextWithResult({ model, messages, output: Output.object({ schema: z.array(z.number()) }) }, messages).result;
expectEqual<Awaited<typeof choice>['value'], Promise<string>>();
expectEqual<Awaited<typeof text>['value'], Awaited<typeof choice>['value']>();
expectEqual<Awaited<typeof defaultText>['value'], AsyncIterable<string>>();
type ArrayValue = Promise<number[]>;
expectEqual<Awaited<typeof array>['value'], ArrayValue>();
expectEqual<Awaited<typeof arrayObject>['value'], ArrayValue>();

const agent = create.LLMAgent({ model, tools, runtimeContext, output });
expectType<Agent<never, typeof tools, typeof runtimeContext, typeof output>>(agent);

// @ts-expect-error The completed schema output is numeric, not the raw string.
expectType<PromiseLike<{ value: { n: string } }>>(generated);
// Output unions preserve each member's possible deliveries.
declare const flag: boolean;
const unionOutput = flag ? Output.text() : Output.array({ element: z.number() });
const unionResult = streamTextWithResult({ model, messages, output: unionOutput }, messages).result;
expectEqual<typeof unionResult.value, Promise<string> | ArrayValue>();

// Explicit undefined is accepted with non-exact optional properties; exact consumers keep the SDK restriction.
const knownOutput = { ...output, name: 'object' as const };
const maybeOutput = flag ? knownOutput : undefined;
const explicitUndefined = await create.LLMAgent.asStream({ model, output: maybeOutput })('test');
expectEqual<typeof explicitUndefined.value, Promise<{ n: number }> | AsyncIterable<string>>();
const outputParent = create.Config({ model, output: knownOutput });
const clearedParent = await create.LLMAgent.asStream({ output: undefined }, outputParent)('test');
expectEqual<typeof clearedParent.value, AsyncIterable<string>>();
