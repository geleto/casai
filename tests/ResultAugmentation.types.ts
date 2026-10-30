// Compile-only checks for public result types and non-exact factory inputs, using the source project's settings.
/* eslint-disable @typescript-eslint/no-unused-vars -- Compile-only inference fixtures. */
import { Output, tool } from 'ai';
import type { Agent, ModelMessage, LanguageModel, StreamTextResult, GenerateTextResult } from 'ai';
import { z } from 'zod';
import { create } from 'casai';
import { expectEqual, expectType } from './type-safety/assert.js';

declare const model: LanguageModel;
const tools = { lookup: tool({ inputSchema: z.object({ n: z.number() }), execute: ({ n }) => n * 2 }) };
const runtimeContext = { requestId: 'request' };
const output = Output.object({ schema: z.object({ n: z.string().transform(Number) }) });
const messages: ModelMessage[] = [{ role: 'user', content: 'test' }];
const agent = create.LLMAgent({ model, tools, runtimeContext, output });
const generated = agent.generate({ messages });
const streamed = agent.stream({ messages });
type Generated = Awaited<typeof generated>;
type Streamed = Awaited<typeof streamed>;
expectEqual<Generated['output'], { n: number }>();
expectEqual<Streamed['output'], PromiseLike<{ n: number }>>();
expectEqual<Streamed['finalStep'], StreamTextResult<typeof tools, typeof runtimeContext, typeof output>['finalStep']>();
expectEqual<Generated['steps'], GenerateTextResult<typeof tools, typeof runtimeContext, typeof output>['steps']>();

const choices: string[] = ['yes', 'no'];
const choice = create.LLMAgent({ model, output: Output.choice({ options: choices }) }).stream({ messages });
const text = create.LLMAgent({ model, output: Output.text() }).stream({ messages });
const defaultText = create.LLMAgent({ model }).stream({ messages });
const array = create.LLMAgent({ model, output: Output.array({ element: z.string().transform(Number) }) }).stream({ messages });
const arrayObject = create.LLMAgent({ model, output: Output.object({ schema: z.array(z.number()) }) }).stream({ messages });
expectEqual<Awaited<typeof choice>['output'], PromiseLike<string>>();
expectEqual<Awaited<typeof text>['output'], Awaited<typeof choice>['output']>();
expectEqual<Awaited<typeof defaultText>['output'], PromiseLike<string>>();
type ArrayValue = PromiseLike<number[]>;
expectEqual<Awaited<typeof array>['output'], ArrayValue>();
expectEqual<Awaited<typeof arrayObject>['output'], ArrayValue>();

expectType<Agent<never, typeof tools, typeof runtimeContext, typeof output>>(agent);

// @ts-expect-error The completed schema output is numeric, not the raw string.
expectType<PromiseLike<{ output: { n: string } }>>(generated);
// Output unions preserve each member's possible deliveries.
declare const flag: boolean;
const unionOutput = flag ? Output.text() : Output.array({ element: z.number() });
const unionResult = await create.LLMAgent({ model, output: unionOutput }).stream({ messages });
expectEqual<typeof unionResult.output, PromiseLike<string | number[]>>();

// Explicit undefined is accepted with non-exact optional properties; exact consumers keep the SDK restriction.
const knownOutput = { ...output, name: 'object' as const };
const maybeOutput = flag ? knownOutput : undefined;
const explicitUndefined = await create.LLMAgent.asStream({ model, output: maybeOutput })('test');
expectEqual<typeof explicitUndefined.output, PromiseLike<{ n: number } | string>>();
const outputParent = create.Config({ model, output: knownOutput });
const clearedParent = await create.LLMAgent.asStream({ output: undefined }, outputParent)('test');
expectEqual<typeof clearedParent.output, PromiseLike<string>>();
