// Compile-only: explicit configuration annotations must retain native callback inference.
import { create, z } from 'casai';
import type { GenerateTextConfig, StreamTextConfig, GenerateObjectArrayConfig, StreamObjectArrayConfig, StreamObjectOnFinishEvent } from 'casai';
import { Output } from 'ai';
import type { LanguageModel, generateText, streamText, generateObject, streamObject } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
declare const completion: PromiseLike<void>;
const schema = z.object({ answer: z.number() });
const output = Output.object({ schema });
const runtimeContext = { requestId: 'request' };
const lookup = create.Function.asTool({
	inputSchema: z.object({ query: z.string() }),
	toolContextSchema: z.object({ factor: z.number() }),
	execute: ({ query }) => query.length,
});
const tools = { lookup };
const toolsContext = { lookup: { factor: 2 } };
type Generated = GenerateTextConfig<typeof tools, never, string, typeof output, typeof runtimeContext>;
type Streamed = StreamTextConfig<typeof tools, never, string, typeof output, typeof runtimeContext>;
type NativeGenerated = Parameters<typeof generateText<typeof tools, typeof runtimeContext, typeof output>>[0];
type NativeStreamed = Parameters<typeof streamText<typeof tools, typeof runtimeContext, typeof output>>[0];

// Compare every native property retained by Casai, including nested callbacks and arrays.
type NativeProperties = Exclude<keyof NativeGenerated, 'prompt' | 'messages' | 'abortSignal' | 'tools' | 'toolsContext'>;
type NativeStreamProperties = Exclude<keyof NativeStreamed, 'prompt' | 'messages' | 'abortSignal' | 'tools' | 'toolsContext'>;
expectEqual<Pick<Generated, NativeProperties>, Pick<NativeGenerated, NativeProperties>>();
expectEqual<Pick<Streamed, NativeStreamProperties>, Pick<NativeStreamed, NativeStreamProperties>>();

const generated: Generated = {
	model, tools, toolsContext, output, runtimeContext,
	onStart: event => {
		expectEqual<typeof event.runtimeContext.requestId, string>();
		expectEqual<typeof event.output, typeof output | undefined>();
		// @ts-expect-error Contextual callback arguments must not become any.
		expectType<number>(event.runtimeContext.requestId);
	},
	prepareStep: _options => {
		expectEqual<typeof _options.runtimeContext.requestId, string>();
		expectEqual<typeof _options.toolsContext.lookup.factor, number>();
		return { activeTools: ['lookup'], runtimeContext: { requestId: 'next' } };
	},
	onEnd: _event => {
		expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>();
		expectEqual<(typeof _event.staticToolResults)[number]['output'], number>();
		return completion;
	},
	toolApproval: { lookup: (input, _options) => {
		expectEqual<typeof input.query, string>();
		expectEqual<typeof _options.runtimeContext.requestId, string>();
		expectEqual<typeof _options.toolContext.factor, number>();
		return 'approved';
	} },
};
const streamed: Streamed = {
	model, tools, toolsContext, output, runtimeContext,
	onEnd: _event => {
		expectEqual<typeof _event.output, { answer: number } | undefined>();
		expectEqual<(typeof _event.staticToolResults)[number]['output'], number>();
		return completion;
	},
	onChunk: ({ chunk }) => {
		if (chunk.type === 'tool-call' && !chunk.dynamic) {
			expectEqual<typeof chunk.input.query, string>();
			// @ts-expect-error Tool input is specialized inside narrowed native chunks.
			expectType<number>(chunk.input.query);
		}
	},
	// @ts-expect-error prepareStep returns the declared runtime context type.
	prepareStep: () => ({ runtimeContext: { requestId: 123 } }),
};
create.TextGenerator(generated);
create.TextStreamer(streamed);

type Element = z.infer<typeof schema>;
type NativeObject = Parameters<typeof generateObject<typeof schema, 'array', Element[]>>[0];
type NativeObjectStream = Parameters<typeof streamObject<typeof schema, 'array', Element[]>>[0];
expectEqual<GenerateObjectArrayConfig<never, Element>['onFinish'], NativeObject['onFinish']>();
expectEqual<StreamObjectArrayConfig<never, Element>['onFinish'], NativeObjectStream['onFinish']>();
expectEqual<StreamObjectOnFinishEvent<typeof schema>, Parameters<NonNullable<Parameters<typeof streamObject<typeof schema>>[0]['onFinish']>>[0]>();

const objectStream: StreamObjectArrayConfig<never, Element> = {
	model, schema, output: 'array',
	onFinish: event => {
		expectEqual<typeof event.object, Element[] | undefined>();
		expectEqual<typeof event.callId, string>();
		expectEqual<typeof event.reasoning, string | undefined>();
		// @ts-expect-error The array element remains the schema's output.
		expectType<string>(event.object?.[0].answer);
		return completion;
	},
};
create.ObjectStreamer(objectStream);
