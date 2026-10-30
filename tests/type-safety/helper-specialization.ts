// Compile-only checks for schema results and public callback/helper specialization.
import { create, z } from 'casai';
import { Output, jsonSchema } from 'ai';
import type { LanguageModel } from 'ai';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import * as mini from 'zod/mini';
import { z as z3 } from 'zod/v3';
import { expectEqual } from './assert.js';

const transformed = z.string().transform(Number);
declare const _standard: StandardSchemaV1<string, { count: number }>;
const _native = jsonSchema<{ count: number }>({ type: 'object' });
const _miniature = mini.object({ count: mini.number() });
const _legacyNative = z3.object({ count: z3.number() });
declare const model: LanguageModel;
// SDK Output specifications retain their native schema contracts, including Zod 3.
const standardOutput = Output.object({ schema: _standard });
const nativeOutput = Output.object({ schema: _native });
const miniOutput = Output.object({ schema: _miniature });
const legacyOutput = Output.object({ schema: _legacyNative });
const standard = create.LLMAgent.asStream({ model, output: standardOutput });
const native = create.LLMAgent({ model, output: nativeOutput });
const miniature = create.LLMAgent({ model, output: miniOutput });
const legacy = create.LLMAgent({ model, output: legacyOutput });
expectEqual<Awaited<Awaited<ReturnType<typeof standard>>['output']>, { count: number }>();
expectEqual<Awaited<ReturnType<typeof native>>['output'], { count: number }>();
expectEqual<Awaited<ReturnType<typeof miniature>>['output'], { count: number }>();
expectEqual<Awaited<ReturnType<typeof legacy>>['output'], { count: number }>();

const operation = create.Function.asTool({
	inputSchema: z.object({ amount: transformed }), schema: transformed,
	execute: ({ amount }) => {
		expectEqual<typeof amount, number>();
		return String(amount);
	},
});
create.Function({ tools: { operation }, execute: ({ operation: helper }) => {
	const result = helper({ amount: '12' });
	expectEqual<typeof result, Promise<number>>();
	// @ts-expect-error Injected callers accept raw schema input, not parsed numbers.
	void helper({ amount: 12 });
	return result;
} });
create.LLMAgent({ model, prompt: 'Calculate.', tools: { operation }, onStepEnd: _event => {
	expectEqual<(typeof _event.staticToolCalls)[number]['input'], { amount: number }>();
	expectEqual<(typeof _event.staticToolResults)[number]['output'], number>();
} });

const bound = operation.bindToolContext({ trace: 'request' });
expectEqual<Parameters<NonNullable<typeof bound.tool.execute>>[1]['context'], { trace: string }>();
// @ts-expect-error The bound descriptor retains the captured context's property types.
void bound.tool.execute!({ amount: 12 }, { context: { trace: 12 }, toolCallId: 'call', messages: [] });
const _contextSchema = z.object({ trace: transformed });
declare const optionalContextSchema: typeof _contextSchema | undefined;
const _optionalContext = create.Function.asTool({
	inputSchema: z.object({}), toolContextSchema: optionalContextSchema, execute: () => 1,
}).bindToolContext({ trace: 'request' });
expectEqual<Parameters<NonNullable<typeof _optionalContext.tool.execute>>[1]['context'], { trace: number } | { trace: string }>();






export { standard, native, miniature, legacy };
