// Compile-only checks for schema results and public callback/helper specialization.
import { create, z } from 'casai';
import type { FunctionPromptConfig, StreamObjectOnFinishEvent } from 'casai';
import { jsonSchema } from 'ai';
import type { GenerateObjectEndEvent, LanguageModel } from 'ai';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import * as mini from 'zod/mini';
import { z as z3 } from 'zod/v3';
import { expectEqual, expectType } from './assert.js';

const transformed = z.string().transform(Number);
declare const _standard: StandardSchemaV1<string, { count: number }>;
const _native = jsonSchema<{ count: number }>({ type: 'object' });
const _miniature = mini.object({ count: mini.number() });
const _legacyNative = z3.object({ count: z3.number() });
expectEqual<StreamObjectOnFinishEvent<typeof _standard>, GenerateObjectEndEvent<{ count: number }>>();
expectEqual<StreamObjectOnFinishEvent<typeof _native>, GenerateObjectEndEvent<{ count: number }>>();
expectEqual<StreamObjectOnFinishEvent<typeof _miniature>, GenerateObjectEndEvent<{ count: number }>>();
// This alias describes native SDK output events, which retain native Zod 3 support.
expectEqual<StreamObjectOnFinishEvent<typeof _legacyNative>, GenerateObjectEndEvent<{ count: number }>>();

const prompt = {
	context: { name: 'Ada' },
	prompt: input => {
		expectEqual<typeof input, { name: string }>();
		// @ts-expect-error The specialized prompt context has no undeclared fields.
		expectType<unknown>(input.missing);
		return input.name;
	},
} satisfies FunctionPromptConfig<{ name: string }, string>;
declare const model: LanguageModel;
create.TextGenerator.withFunction({ model, ...prompt });
// @ts-expect-error A specialized prompt callback must return the declared prompt form.
const _wrongPrompt: FunctionPromptConfig<{ name: string }, string> = { prompt: () => [] };
const _absentContext: FunctionPromptConfig = { context: undefined, prompt: () => 'Ready.' };

const _messagesPrompt = {
	prompt: async ({ name }) => [{ role: 'user', content: name }],
} satisfies FunctionPromptConfig<{ name: string }, import('ai').ModelMessage[]>;
expectEqual<Awaited<ReturnType<typeof _messagesPrompt.prompt>>[number]['content'], string>();

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
create.TextGenerator({ model, prompt: 'Calculate.', tools: { operation }, onStepEnd: _event => {
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
