// Public factory result augmentation contracts.
/* eslint-disable @typescript-eslint/no-unused-vars -- Compile-only inference fixtures. */
import { Output } from 'ai';
import type { LanguageModel, StreamTextResult } from 'ai';
import { z } from 'zod';
import { create } from 'casai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
const output = Output.object({ schema: z.object({ n: z.string().transform(Number) }) });
type ArrayValue = PromiseLike<number[]>;

const publicGenerated = create.LLMAgent({ model, prompt: 'test', output })();
const publicStream = await create.LLMAgent.asStream({ model, prompt: 'test', output })();
const publicDefaultStream = await create.LLMAgent.asStream({ model, prompt: 'test' })();
const publicArray = await create.LLMAgent.asStream({ model, prompt: 'test', output: Output.array({ element: z.string().transform(Number) }) })();
expectEqual<Awaited<typeof publicGenerated>['output'], { n: number }>();
expectEqual<typeof publicStream.output, PromiseLike<{ n: number }>>();
expectEqual<typeof publicDefaultStream.output, PromiseLike<string>>();
expectEqual<typeof publicArray.output, ArrayValue>();
expectEqual<typeof publicStream.response, StreamTextResult<Record<string, never>, Record<string, unknown>, typeof output>['response']>();

// Known names stay precise; array delivery follows the final parsed value, not the native element stream.
const knownArray = { ...Output.array({ element: z.number() }), name: 'array' as const };
const customArray = { ...knownArray, name: 'custom' as const };
const customText = { ...Output.text(), name: 'text' as const, parseCompleteOutput: async () => ({ n: 1 }) };
const namedObject = await create.LLMAgent.asStream({ model, output: { ...output, name: 'object' as const } })('test');
const namedArray = await create.LLMAgent.asStream({ model, output: knownArray })('test');
const namedCustom = await create.LLMAgent.asStream({ model, output: customArray })('test');
const namedText = await create.LLMAgent.asStream({ model, output: customText })('test');
expectEqual<typeof namedObject.output, PromiseLike<{ n: number }>>();
expectEqual<typeof namedArray.output, PromiseLike<number[]>>();
expectEqual<typeof namedCustom.output, PromiseLike<number[]>>();
expectEqual<typeof namedText.output, PromiseLike<{ n: number }>>();

const erasedCustom = await create.LLMAgent.asStream({ model, output: { ...customArray, name: 'custom' } })('test');
expectEqual<typeof erasedCustom.output, ArrayValue>();
// @ts-expect-error An erased name cannot guarantee iterable delivery.
expectType<AsyncIterable<number>>(erasedCustom.output);
const erasedText = await create.LLMAgent.asStream({ model, output: { ...customText, name: 'text' } })('test');
expectEqual<typeof erasedText.output, PromiseLike<{ n: number }>>();

// Output unions preserve each member's possible deliveries through direct calls and inherited configurations.
declare const flag: boolean;
const unionOutput = flag ? Output.text() : Output.array({ element: z.number() });
const parent = create.Config({ model, output: unionOutput });
const publicUnion = await create.LLMAgent.asStream({}, parent)('test');
type UnionValue = PromiseLike<string | number[]>;
expectEqual<typeof publicUnion.output, UnionValue>();
expectType<PromiseLike<string | number[]>>(publicUnion.output);
const knownUnion = await create.LLMAgent.asStream({ model, output: flag ? { ...Output.text(), name: 'text' as const } : knownArray })('test');
expectEqual<typeof knownUnion.output, PromiseLike<string | number[]>>();

// An optional output can be absent. Native output includes the default text alternative.
const knownObject = { ...output, name: 'object' as const };
const optional: { model: LanguageModel, prompt: string, output?: typeof knownObject } = { model, prompt: 'test' };
const optionalGenerated = create.LLMAgent(optional)();
const optionalStream = await create.LLMAgent.asStream(optional)();
expectEqual<Awaited<typeof optionalGenerated>['output'], { n: number } | string>();
expectEqual<typeof optionalStream.output, PromiseLike<{ n: number } | string>>();
// @ts-expect-error Optional output does not guarantee object delivery.
expectType<PromiseLike<{ n: number }>>(optionalStream.output);
const optionalParent = create.Config(optional);
const inheritedOptional = await create.LLMAgent.asStream({}, optionalParent)();
const inheritedGenerated = create.LLMAgent({}, optionalParent)();
expectEqual<typeof inheritedOptional.output, typeof optionalStream.output>();
expectEqual<Awaited<typeof inheritedGenerated>['output'], Awaited<typeof optionalGenerated>['output']>();
const requiredParent = create.Config({ model, output: knownObject });
const optionalChild: { output?: typeof knownArray } = {};
const inheritedRequired = await create.LLMAgent.asStream(optionalChild, requiredParent)('test');
// Without exact optional properties, an optional child can explicitly clear its parent's output.
type InheritedValue = { n: number } | number[];
expectEqual<typeof inheritedRequired.output, PromiseLike<{ value?: undefined } extends { value?: never }
	? InheritedValue | string : InheritedValue>>();
const promisedElements = await create.LLMAgent.asStream({ model, output: {
	...knownArray, parseCompleteOutput: async () => [Promise.resolve(1)],
} })('test');
expectEqual<typeof promisedElements.output, PromiseLike<Promise<number>[]>>();

// Declared configuration unions retain branch-specific settings when inherited.
declare const unionChild: { output: typeof knownArray } | { description: string };
const inheritedBranches = await create.LLMAgent.asStream(unionChild, requiredParent)('test');
const generatedBranches = create.LLMAgent(unionChild, requiredParent)('test');
expectEqual<typeof inheritedBranches.output, PromiseLike<{ n: number } | number[]>>();
expectEqual<typeof inheritedBranches.output, PromiseLike<{ n: number } | number[]>>();
expectEqual<Awaited<typeof generatedBranches>['output'], { n: number } | number[]>();
const runBranches = await create.LLMAgent.asStream(unionChild, requiredParent).run({ prompt: 'test' });
expectEqual<typeof runBranches.output, typeof inheritedBranches.output>();
// @ts-expect-error A possible array branch prevents assuming only an object result.
expectType<PromiseLike<{ n: number }>>(inheritedBranches.output);
declare const unionParent: { model: LanguageModel, output: typeof knownObject } | { model: LanguageModel, output: typeof knownArray };
const inheritedBothBranches = await create.LLMAgent.asStream(unionChild, { config: unionParent })('test');
expectEqual<typeof inheritedBothBranches.output, typeof inheritedBranches.output>();

declare const contextChild: { runtimeContext: { child: string } } | { description: string };
const contextBranches = await create.LLMAgent.asStream(contextChild, create.Config({ model, runtimeContext: { parent: 1 } }))('test');
expectEqual<Awaited<typeof contextBranches.finalStep>['runtimeContext'], { parent: number } | { child: string }>();

// Parent and child map alternatives retain their correlations through shallow merging.
type Flatten<T> = T extends unknown ? { [K in keyof T]: T[K] } : never;
declare const mapParent: { context: { key: 'parent', a: 1 } | { key: 'parent', b: 2 } };
declare const mapChild: { context: { key: 'child', c: 3 } | { d: 4 } };
const mapBranches = create.Config(mapChild, create.Config(mapParent));
expectEqual<Flatten<typeof mapBranches.config.context>,
	{ key: 'child', a: 1, c: 3 } | { key: 'parent', a: 1, d: 4 }
	| { key: 'child', b: 2, c: 3 } | { key: 'parent', b: 2, d: 4 }>();
declare const correlatedChild: { context: { a: 2 } | { b: 2 } };
const correlated = create.Config(correlatedChild, create.Config({ context: { a: 1 as const, b: 1 as const } }));
// @ts-expect-error No branch changes both fields, so this combination is impossible.
expectType<typeof correlated.config.context>({ a: 2, b: 2 });
