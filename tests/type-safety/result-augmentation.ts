// Public factory result augmentation contracts.
/* eslint-disable @typescript-eslint/no-unused-vars -- Compile-only inference fixtures. */
import { Output } from 'ai';
import type { LanguageModel, StreamTextResult } from 'ai';
import { z } from 'zod';
import { create } from 'casai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
const output = Output.object({ schema: z.object({ n: z.string().transform(Number) }) });
type ArrayValue = Promise<number[]> | AsyncIterable<number[]> | AsyncIterable<number>;

const publicGenerated = create.TextGenerator({ model, prompt: 'test', output })();
const publicStream = create.TextStreamer({ model, prompt: 'test', output })();
const publicDefaultStream = create.TextStreamer({ model, prompt: 'test' })();
const publicArray = create.TextStreamer({ model, prompt: 'test', output: Output.array({ element: z.string().transform(Number) }) })();
expectEqual<Awaited<typeof publicGenerated>['value'], { n: number }>();
expectEqual<typeof publicStream.value, Promise<{ n: number }> | AsyncIterable<{ n: number }>>();
expectEqual<typeof publicDefaultStream.value, AsyncIterable<string>>();
expectEqual<typeof publicArray.value, ArrayValue>();
expectEqual<typeof publicStream.response, StreamTextResult<Record<string, never>, Record<string, unknown>, typeof output>['response']>();

// Known names stay precise; array delivery follows the final parsed value, not the native element stream.
const knownArray = { ...Output.array({ element: z.number() }), name: 'array' as const };
const customArray = { ...knownArray, name: 'custom' as const };
const customText = { ...Output.text(), name: 'text' as const, parseCompleteOutput: async () => ({ n: 1 }) };
const namedObject = create.TextStreamer({ model, output: { ...output, name: 'object' as const } })('test');
const namedArray = create.TextStreamer({ model, output: knownArray })('test');
const namedCustom = create.TextStreamer({ model, output: customArray })('test');
const namedText = create.TextStreamer({ model, output: customText })('test');
expectEqual<typeof namedObject.value, Promise<{ n: number }>>();
expectEqual<typeof namedArray.value, AsyncIterable<number>>();
expectEqual<typeof namedCustom.value, Promise<number[]>>();
expectEqual<typeof namedText.value, AsyncIterable<{ n: number }>>();

const erasedCustom = create.TextStreamer({ model, output: { ...customArray, name: 'custom' } })('test');
expectEqual<typeof erasedCustom.value, ArrayValue>();
// @ts-expect-error An erased name cannot guarantee iterable delivery.
expectType<AsyncIterable<number>>(erasedCustom.value);
const erasedText = create.TextStreamer({ model, output: { ...customText, name: 'text' } })('test');
expectEqual<typeof erasedText.value, Promise<{ n: number }> | AsyncIterable<{ n: number }>>();

// Output unions preserve each member's possible deliveries through direct calls and inherited configurations.
declare const flag: boolean;
const unionOutput = flag ? Output.text() : Output.array({ element: z.number() });
const parent = create.Config({ model, output: unionOutput });
const publicUnion = create.TextStreamer({}, parent)('test');
type UnionValue = Promise<string> | AsyncIterable<string> | ArrayValue;
expectEqual<typeof publicUnion.value, UnionValue>();
// @ts-expect-error Both runtime kinds are iterable; the SDK-erased types cannot promise a Promise.
expectType<Promise<string | number[]>>(publicUnion.value);
const knownUnion = create.TextStreamer({ model, output: flag ? { ...Output.text(), name: 'text' as const } : knownArray })('test');
expectEqual<typeof knownUnion.value, AsyncIterable<string> | AsyncIterable<number>>();

// An optional output can be absent. Only value includes the default text alternative.
const knownObject = { ...output, name: 'object' as const };
const optional: { model: LanguageModel, prompt: string, output?: typeof knownObject } = { model, prompt: 'test' };
const optionalGenerated = create.TextGenerator(optional)();
const optionalStream = create.TextStreamer(optional)();
expectEqual<Awaited<typeof optionalGenerated>['value'], { n: number } | string>();
expectEqual<typeof optionalStream.value, Promise<{ n: number }> | AsyncIterable<string>>();
expectEqual<Awaited<typeof optionalGenerated>['output'], { n: number }>();
expectEqual<typeof optionalStream.output, PromiseLike<{ n: number }>>();
// @ts-expect-error Optional output does not guarantee object delivery.
expectType<Promise<{ n: number }>>(optionalStream.value);
const optionalParent = create.Config(optional);
const inheritedOptional = create.TextStreamer({}, optionalParent)();
const inheritedGenerated = create.TextGenerator({}, optionalParent)();
expectEqual<typeof inheritedOptional.value, typeof optionalStream.value>();
expectEqual<Awaited<typeof inheritedGenerated>['value'], Awaited<typeof optionalGenerated>['value']>();
const requiredParent = create.Config({ model, output: knownObject });
const optionalChild: { output?: typeof knownArray } = {};
const inheritedRequired = create.TextStreamer(optionalChild, requiredParent)('test');
// Without exact optional properties, an optional child can explicitly clear its parent's output.
type InheritedValue = Promise<{ n: number }> | AsyncIterable<number>;
expectEqual<typeof inheritedRequired.value, { value?: undefined } extends { value?: never }
	? InheritedValue | AsyncIterable<string> : InheritedValue>();
const promisedElements = create.TextStreamer({ model, output: {
	...knownArray, parseCompleteOutput: async () => [Promise.resolve(1)],
} })('test');
expectEqual<typeof promisedElements.value, AsyncIterable<Promise<number>>>();

// Declared configuration unions retain branch-specific settings when inherited.
declare const unionChild: { output: typeof knownArray } | { description: string };
const inheritedBranches = create.TextStreamer(unionChild, requiredParent)('test');
const generatedBranches = create.TextGenerator(unionChild, requiredParent)('test');
expectEqual<typeof inheritedBranches.value, Promise<{ n: number }> | AsyncIterable<number>>();
expectEqual<typeof inheritedBranches.output, PromiseLike<{ n: number } | number[]>>();
expectEqual<Awaited<typeof generatedBranches>['value'], { n: number } | number[]>();
const runBranches = create.TextStreamer(unionChild, requiredParent).run({ prompt: 'test' });
expectEqual<typeof runBranches.value, typeof inheritedBranches.value>();
// @ts-expect-error A possible array branch prevents assuming only an object result.
expectType<PromiseLike<{ n: number }>>(inheritedBranches.output);
declare const unionParent: { model: LanguageModel, output: typeof knownObject } | { model: LanguageModel, output: typeof knownArray };
const inheritedBothBranches = create.TextStreamer(unionChild, { config: unionParent })('test');
expectEqual<typeof inheritedBothBranches.value, typeof inheritedBranches.value>();

declare const contextChild: { runtimeContext: { child: string } } | { description: string };
const contextBranches = create.TextStreamer(contextChild, create.Config({ model, runtimeContext: { parent: 1 } }))('test');
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
