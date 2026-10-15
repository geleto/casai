// Compile-only evidence for the Phase 1 output-delivery design.
// These assertions describe the installed SDK, not a new Casai public API.
/* eslint-disable @typescript-eslint/no-unused-vars -- Compile-only fixtures are intentionally consumed through typeof. */
import { Output, ToolLoopAgent } from 'ai';
import type { OutputInterface, LanguageModel, AsyncIterableStream } from 'ai';
import { z as z3 } from 'zod/v3';
import { z as z4 } from 'zod/v4';
import { expectEqual } from './assert.js';

const text = Output.text();
const options: string[] = ['yes', 'no'];
const choice = Output.choice({ options });
const literalChoice = Output.choice({ options: ['yes', 'no'] });
const stringObject = Output.object({ schema: z4.string() });
const object = Output.object({ schema: z4.object({ answer: z4.number() }) });
const array = Output.array({ element: z4.number() });
const arrayObject = Output.object({ schema: z4.array(z4.number()) });
const transformed3 = Output.object({ schema: z3.object({ n: z3.string().transform(Number) }) });
const transformed4 = Output.object({ schema: z4.object({ n: z4.string().transform(Number) }) });
const transformedArray = Output.array({ element: z4.string().transform(Number) });

// The completed data type is inferred, including schema transformations.
expectEqual<Awaited<ReturnType<typeof text.parseCompleteOutput>>, string>();
expectEqual<Awaited<ReturnType<typeof literalChoice.parseCompleteOutput>>, 'yes' | 'no'>();
expectEqual<Awaited<ReturnType<typeof object.parseCompleteOutput>>, { answer: number }>();
expectEqual<Awaited<ReturnType<typeof transformed3.parseCompleteOutput>>, { n: number }>();
expectEqual<Awaited<ReturnType<typeof transformed4.parseCompleteOutput>>, { n: number }>();
expectEqual<Awaited<ReturnType<typeof transformedArray.parseCompleteOutput>>, number[]>();

// No conditional type can distinguish identical types. Runtime mode information
// exists in name, but the SDK widens that property to string on every factory.
expectEqual<typeof text, OutputInterface<string, string, never>>();
expectEqual<typeof text, typeof choice>();
expectEqual<typeof text, typeof stringObject>();
expectEqual<typeof text.name, string>();
expectEqual<typeof literalChoice.name, string>();

// @ts-expect-error The SDK does not retain a literal mode discriminant.
const _textName: 'text' = text.name;
// @ts-expect-error Final element types reflect the transform, not raw input.
const _rawArray: Awaited<ReturnType<typeof transformedArray.parseCompleteOutput>> = ['3'];

// Checking only the final array type also loses the distinction between an
// element stream and a single structured output containing an array.
expectEqual<Awaited<ReturnType<typeof array.parseCompleteOutput>>, Awaited<ReturnType<typeof arrayObject.parseCompleteOutput>>>();
expectEqual<typeof array, OutputInterface<number[], number[], number>>();
expectEqual<typeof arrayObject, OutputInterface<number[], (number | undefined)[], never>>();

// A literal tag can carry the missing information without changing SDK methods.
// This proves feasibility only; it does not choose a Casai tagging API.
const taggedText = { ...text, name: 'text' as const };
expectEqual<typeof taggedText.name, 'text'>();
expectEqual<Awaited<ReturnType<typeof taggedText.parseCompleteOutput>>, string>();

// Native Agent avoids a mode-dependent value property. Its separate views have
// the same delivery types for text and choice, so this ambiguity is not a defect
// in Agent's result contract.
declare const model: LanguageModel;
const textAgent = new ToolLoopAgent({ model, output: text });
const choiceAgent = new ToolLoopAgent({ model, output: choice });
type TextResult = Awaited<ReturnType<typeof textAgent.stream>>;
type ChoiceResult = Awaited<ReturnType<typeof choiceAgent.stream>>;
expectEqual<TextResult, ChoiceResult>();
expectEqual<TextResult['output'], PromiseLike<string>>();
expectEqual<TextResult['textStream'], AsyncIterableStream<string>>();
expectEqual<TextResult['elementStream'], AsyncIterableStream<never>>();
expectEqual<ChoiceResult['output'], PromiseLike<string>>();
