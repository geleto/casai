// Compile-only result contracts for the public package and SDK interoperability.
import { create, z } from 'casai';
import type {
	GenerateTextResult as PublicGenerateTextResult, StreamTextResult as PublicStreamTextResult,
	GenerateObjectObjectResult, GenerateObjectArrayResult, GenerateObjectEnumResult, GenerateObjectNoSchemaResult, GenerateObjectResultAll,
	StreamObjectObjectResult, StreamObjectArrayResult, StreamObjectNoSchemaResult, StreamObjectResultAll,
} from 'casai';
import { Output } from 'ai';
import type { LanguageModel, UIMessage, InferUIMessageChunk, StreamTextResult as SDKStreamTextResult, GenerateTextResult as SDKGenerateTextResult, ModelMessage, AsyncIterableStream, DeepPartial, GenerateObjectResult, StreamObjectResult, JSONValue, ObjectStreamPart, UIMessageStreamOnEndCallback, OutputInterface, FinishReason, TextStreamPart } from 'ai';
import type { ServerResponse } from 'node:http';

import { expectType, expectEqual } from './assert.js';
declare const model: LanguageModel;
declare const response: ServerResponse;
const schema = z.object({ answer: z.number() });
const output = Output.object({ schema });
const runtimeContext = { requestId: 'request' };
const lookup = create.Function.asTool({
	inputSchema: z.object({ query: z.string() }), contextSchema: z.object({ factor: z.number() }),
	execute: ({ query }, { context }) => query.length * context.factor,
});
const tools = { lookup };
const parent = create.Config({ model, tools, toolsContext: { lookup: { factor: 2 } }, output, runtimeContext });
const streamer = create.TextStreamer({}, parent);
const objectGenerator = create.ObjectGenerator({ model, schema });
const objectStreamer = create.ObjectStreamer({ model, schema });

const result = streamer('Input.');
expectType<Omit<SDKStreamTextResult<typeof tools, typeof runtimeContext, typeof output>, 'response'>>(result);
expectType<PromiseLike<number>>(result.output.then(_value => _value.answer));
expectType<PromiseLike<string>>(result.finalStep.then(_value => _value.runtimeContext.requestId));
// @ts-expect-error Result output no longer leaks any.
expectType<PromiseLike<string>>(result.output.then(_value => _value.answer));
const generated = create.TextGenerator({}, parent)('Input.');
expectType<PromiseLike<Omit<SDKGenerateTextResult<typeof tools, typeof runtimeContext, typeof output>, 'response'>>>(generated);
expectEqual<Omit<typeof result, 'response'>, Omit<SDKStreamTextResult<typeof tools, typeof runtimeContext, typeof output>, 'response'>>();
expectEqual<Omit<Awaited<typeof generated>, 'response'>, Omit<SDKGenerateTextResult<typeof tools, typeof runtimeContext, typeof output>, 'response'>>();
expectEqual<Awaited<typeof generated>, PublicGenerateTextResult<typeof tools, typeof output, typeof runtimeContext>>();
expectEqual<typeof result, PublicStreamTextResult<typeof tools, typeof output, typeof runtimeContext>>();
// @ts-expect-error Default text output is a string.
expectType<PromiseLike<number>>(create.TextGenerator({ model })('Input.').then(_value => _value.output));

type Message = UIMessage<{ traceId: string }, { progress: { percentage: number } }, { lookup: { input: { query: string }, output: number } }>;
expectType<ReadableStream<InferUIMessageChunk<Message>>>(result.toUIMessageStream<Message>({
	messageMetadata: ({ part }) => {
		expectType<string>(part.type);
		return { traceId: 'trace' };
	},
	onEnd: _event => {
		expectType<string | undefined>(_event.responseMessage.metadata?.traceId);
		// @ts-expect-error UI message callbacks retain explicit message metadata.
		expectType<number>(_event.responseMessage.metadata?.traceId);
	},
	onError: _error => { expectType<unknown>(_error); return '_error'; },
}));
expectType<Response>(result.toUIMessageStreamResponse<Message>({ consumeSseStream: ({ stream }) => { expectType<ReadableStream<string>>(stream); } }));
expectType<Promise<void>>(result.pipeUIMessageStreamToResponse<Message>(response, { onFinish: _event => { expectType<Message>(_event.responseMessage); } }));
expectType<Promise<void>>(result.pipeTextStreamToResponse(response, { status: 200 }));
expectType<Response>(result.toTextStreamResponse({ headers: { 'x-test': '_value' } }));
expectType<PromiseLike<void>>(result.consumeStream({ onError: _error => {
	// @ts-expect-error SDK error callbacks receive unknown.
	expectType<Error>(_error);
} }));
// @ts-expect-error UI stream error serialization must return a string.
result.toUIMessageStream({ onError: () => 123 });
// @ts-expect-error Metadata callbacks must match the requested UIMessage metadata.
result.toUIMessageStream<Message>({ messageMetadata: () => ({ traceId: 123 }) });
// @ts-expect-error UI completion observers cannot resolve arbitrary values.
result.toUIMessageStream<Message>({ onFinish: async () => 123 });
// @ts-expect-error Response methods validate their options.
result.toTextStreamResponse({ status: '200' });
expectType<PromiseLike<Response>>(objectGenerator('Input.').then(_value => _value.toJsonResponse({ status: 200 })));
// @ts-expect-error Object result methods retain SDK option validation.
void objectGenerator('Input.').then(_value => _value.toJsonResponse({ status: '200' }));
expectType<Response>(objectStreamer('Input.').toTextStreamResponse({ status: 200 }));
expectType<Promise<void>>(objectStreamer('Input.').pipeTextStreamToResponse(response));

// Exact positive assertions catch widening to any as well as incorrect concrete types.
interface Answer { answer: number }
expectEqual<typeof result.output, PromiseLike<Answer>>();
expectEqual<Awaited<typeof generated>['output'], Answer>();
expectEqual<Awaited<typeof generated>['finalStep']['runtimeContext'], typeof runtimeContext>();
expectEqual<typeof result.partialOutputStream, AsyncIterableStream<DeepPartial<Answer>>>();
expectEqual<typeof result.experimental_partialOutputStream, typeof result.partialOutputStream>();
expectEqual<typeof result.elementStream, AsyncIterableStream<never>>();
expectEqual<typeof result.fullStream, typeof result.stream>();
expectEqual<typeof result.textStream, AsyncIterableStream<string>>();
void result.staticToolCalls.then(calls => {
	expectEqual<(typeof calls)[number]['input'], { query: string }>();
	// @ts-expect-error Promised tool calls retain input types.
	expectType<number>(calls[0].input.query);
});
void result.staticToolResults.then(results => {
	expectEqual<(typeof results)[number]['output'], number>();
	// @ts-expect-error Promised tool results retain output types.
	expectType<string>(results[0].output);
});
void result.steps.then(_steps => {
	expectEqual<(typeof _steps)[number]['runtimeContext'], typeof runtimeContext>();
	expectEqual<(typeof _steps)[number]['staticToolCalls'][number]['input'], { query: string }>();
});
void result.response.then(_value => {
	expectEqual<typeof _value.messages, ModelMessage[]>();
	expectEqual<typeof _value.messageHistory, ModelMessage[]>();
});
void generated.then(_value => {
	expectEqual<typeof _value.response.messages, ModelMessage[]>();
	expectEqual<typeof _value.response.messageHistory, ModelMessage[]>();
	expectEqual<typeof _value.staticToolResults[number]['output'], number>();
});
void result.partialOutputStream.pipeTo(new WritableStream({
	write: partial => {
		expectEqual<typeof partial, DeepPartial<Answer>>();
		// @ts-expect-error Partial object output is not text.
		expectType<string>(partial.answer);
	},
}));
void result.stream.pipeTo(new WritableStream({ write: part => {
	if (part.type === 'tool-call' && !part.dynamic) {
		expectEqual<typeof part.input, { query: string }>();
		// @ts-expect-error Stream discriminators preserve tool input types.
		expectType<number>(part.input.query);
	}
} }));

// Output strategies specialize complete, partial, and element streams independently.
const arrayOutput = Output.array({ element: schema });
const arrayText = create.TextStreamer({ model, output: arrayOutput })('Input.');
expectEqual<typeof arrayText.output, PromiseLike<Answer[]>>();
expectEqual<typeof arrayText.partialOutputStream, AsyncIterableStream<Answer[]>>();
expectEqual<typeof arrayText.elementStream, AsyncIterableStream<Answer>>();
void arrayText.elementStream.pipeTo(new WritableStream({ write: element => {
	expectEqual<typeof element.answer, number>();
	// @ts-expect-error Element streams expose schema-derived elements.
	expectType<string>(element.answer);
} }));
const _choiceText = create.TextGenerator({ model, output: Output.choice({ options: ['yes', 'no'] as const }) })('Input.');
expectEqual<Awaited<typeof _choiceText>['output'], 'yes' | 'no'>();
const _jsonText = create.TextStreamer({ model, output: Output.json() })('Input.');
expectEqual<Awaited<typeof _jsonText.output>, JSONValue>();
const _defaultText = create.TextStreamer({ model })('Input.');
expectEqual<typeof _defaultText.output, PromiseLike<string>>();
expectEqual<typeof _defaultText.partialOutputStream, AsyncIterableStream<string>>();
expectEqual<typeof _defaultText.elementStream, AsyncIterableStream<never>>();

// Object results preserve each output strategy, including partial-object streams.
const _generatedObject = objectGenerator('Input.');
expectEqual<Awaited<typeof _generatedObject>, GenerateObjectResult<Answer>>();
const streamedObject = objectStreamer('Input.');
expectEqual<typeof streamedObject, StreamObjectResult<DeepPartial<Answer>, Answer, never>>();
expectEqual<typeof streamedObject.object, Promise<Answer>>();
expectEqual<typeof streamedObject.elementStream, never>();
expectEqual<typeof streamedObject.fullStream, AsyncIterableStream<ObjectStreamPart<DeepPartial<Answer>>>>();
void streamedObject.object.then(_value => {
	expectEqual<typeof _value.answer, number>();
	// @ts-expect-error Final generated object fields retain the schema.
	expectType<string>(_value.answer);
});
void streamedObject.partialObjectStream.pipeTo(new WritableStream({ write: partial => {
	expectEqual<typeof partial.answer, number | undefined>();
	// @ts-expect-error Partial fields can be absent.
	expectType<number>(partial.answer);
} }));
const _arrayObjects = create.ObjectStreamer({ model, schema, output: 'array' })('Input.');
expectEqual<typeof _arrayObjects.object, Promise<Answer[]>>();
expectEqual<typeof _arrayObjects.partialObjectStream, AsyncIterableStream<Answer[]>>();
expectEqual<typeof _arrayObjects.elementStream, AsyncIterableStream<Answer>>();
const _enumObjects = create.ObjectGenerator({ model, output: 'enum', enum: ['yes', 'no'] as const })('Input.');
expectEqual<Awaited<typeof _enumObjects>['object'], 'yes' | 'no'>();
const _jsonObjects = create.ObjectStreamer({ model, output: 'no-schema' })('Input.');
expectEqual<typeof _jsonObjects.object, Promise<JSONValue>>();
expectEqual<typeof _jsonObjects.partialObjectStream, AsyncIterableStream<JSONValue>>();
expectEqual<Awaited<typeof _generatedObject>, GenerateObjectObjectResult<Answer>>();
expectEqual<typeof streamedObject, StreamObjectObjectResult<Answer>>();
expectEqual<typeof _arrayObjects, StreamObjectArrayResult<Answer>>();
expectEqual<Awaited<typeof _enumObjects>, GenerateObjectEnumResult<'yes' | 'no'>>();
expectEqual<typeof _jsonObjects, StreamObjectNoSchemaResult>();
expectEqual<GenerateObjectArrayResult<Answer>, GenerateObjectResult<Answer[]>>();
expectEqual<GenerateObjectNoSchemaResult, GenerateObjectResult<JSONValue>>();
expectEqual<GenerateObjectResultAll<Answer, 'yes' | 'no'>, GenerateObjectObjectResult<Answer> | GenerateObjectArrayResult<Answer> | GenerateObjectEnumResult<'yes' | 'no'> | GenerateObjectNoSchemaResult>();
expectEqual<StreamObjectResultAll<Answer>, StreamObjectObjectResult<Answer> | StreamObjectArrayResult<Answer> | StreamObjectNoSchemaResult>();

// All UI-result callback options validate arguments, metadata, and returned values.
const uiStream = result.toUIMessageStream<Message>({
	generateMessageId: () => 'message-id',
	messageMetadata: () => undefined,
	onFinish: _event => {
		expectEqual<typeof _event, Parameters<UIMessageStreamOnEndCallback<Message>>[0]>();
	},
});
expectEqual<typeof uiStream, AsyncIterableStream<InferUIMessageChunk<Message>>>();
void uiStream.pipeTo(new WritableStream({ write: chunk => {
	if (chunk.type === 'message-metadata') expectEqual<typeof chunk.messageMetadata, { traceId: string }>();
} }));
// @ts-expect-error Message identifiers are strings.
result.toUIMessageStream({ generateMessageId: () => 123 });
// @ts-expect-error UI end callbacks cannot require a different event shape.
result.toUIMessageStream<Message>({ onEnd: (_event: string) => undefined });
// @ts-expect-error UI original messages use the requested metadata type.
result.toUIMessageStream<Message>({ originalMessages: [{ id: 'message', role: 'assistant', parts: [], metadata: { traceId: 123 } }] });
// @ts-expect-error Response streams expose text SSE chunks.
result.toUIMessageStreamResponse({ consumeSseStream: (_options: { stream: ReadableStream<number> }) => undefined });
// @ts-expect-error Stream piping requires a Node ServerResponse.
void result.pipeUIMessageStreamToResponse('response');
// @ts-expect-error Object stream piping validates response options.
void streamedObject.pipeTextStreamToResponse(response, { status: '200' });
// @ts-expect-error Text stream response options validate header value types.
result.toTextStreamResponse({ headers: { 'x-test': 123 } });
// The SDK's consumeStream callback returns plain void, so ignored values are accepted.
result.consumeStream({ onError: () => 123 });

// SDK output specifications carry typed parsing methods through configured callbacks.
declare const parseContext: Parameters<typeof output.parseCompleteOutput>[1];
expectEqual<ReturnType<typeof output.parseCompleteOutput>, Promise<Answer>>();
expectEqual<ReturnType<typeof output.parsePartialOutput>, Promise<{ partial: DeepPartial<Answer> } | undefined>>();
void output.parseCompleteOutput({ text: '{"answer":4}' }, parseContext).then(_value => {
	expectEqual<typeof _value.answer, number>();
});
// @ts-expect-error Output parsers consume text.
void output.parseCompleteOutput({ text: 123 }, parseContext);
// @ts-expect-error Parser contexts preserve SDK finish-reason contracts.
void output.parseCompleteOutput({ text: 'output' }, { ...parseContext, finishReason: 123 });
create.TextGenerator({ model, output, onStart: _event => {
	if (_event.output) {
		expectEqual<typeof _event.output, typeof output>();
		expectEqual<ReturnType<typeof _event.output.parseCompleteOutput>, Promise<Answer>>();
		// @ts-expect-error Configuration event output methods keep argument validation.
		void _event.output.parsePartialOutput({ text: 123 });
	}
} });

// UI callbacks preserve data/tool part unions and the operation outcome discriminator.
declare const voidThenable: PromiseLike<void>;
result.toUIMessageStream<Message>({ onEnd: _event => {
	expectEqual<typeof _event.isCancelled, true | undefined>();
	if (_event.outcome.status === 'failed') {
		expectEqual<typeof _event.outcome.error, unknown>();
		// @ts-expect-error UI stream failures can carry any thrown value.
		expectType<Error>(_event.outcome.error);
	} else {
		// @ts-expect-error Successful, aborted, and unknown outcomes do not expose a failure error.
		expectType<unknown>(_event.outcome.error);
	}
	for (const part of _event.responseMessage.parts) {
		if (part.type === 'data-progress') {
			expectEqual<typeof part.data.percentage, number>();
			// @ts-expect-error Data parts retain the requested UI message payload.
			expectType<string>(part.data.percentage);
		} else if (part.type === 'tool-lookup' && part.state === 'output-available') {
			expectEqual<typeof part.input.query, string>();
			expectEqual<typeof part.output, number>();
			// @ts-expect-error Successful UI tool invocations do not have an execution error.
			expectType<string>(part.errorText);
		} else if (part.type === 'tool-lookup' && part.state === 'output-error') {
			expectEqual<typeof part.errorText, string>();
			// @ts-expect-error Failed UI tool invocations cannot guarantee an output.
			expectType<number>(part.output);
		}
	}
	return voidThenable;
} });
result.toUIMessageStreamResponse<Message>({ consumeSseStream: () => voidThenable, onEnd: () => voidThenable });
// @ts-expect-error Metadata extraction is synchronous even though completion observers support PromiseLike.
result.toUIMessageStream<Message>({ messageMetadata: async () => ({ traceId: 'trace' }) });
// @ts-expect-error UI error serialization must return a string synchronously.
result.toUIMessageStream({ onError: async () => 'error' });
// @ts-expect-error SSE consumer observers cannot return a nonvoid value.
result.toUIMessageStreamResponse({ consumeSseStream: async () => 123 });

// A custom SDK output can use different complete, partial, and element types.
const customOutput: OutputInterface<{ total: number }, string, boolean> = {
	name: 'custom', responseFormat: Promise.resolve({ type: 'text' }),
	parseCompleteOutput: async ({ text }, _context) => {
		expectEqual<typeof text, string>();
		expectEqual<typeof _context.finishReason, FinishReason>();
		return { total: text.length };
	},
	parsePartialOutput: async ({ text }) => ({ partial: text }),
	createElementStreamTransform: () => new TransformStream({ transform: (part, controller) => {
		expectEqual<typeof part.partialOutput, string | undefined>();
		// @ts-expect-error Custom transforms receive the partial type, not the complete type.
		expectType<{ total: number }>(part.partialOutput);
		controller.enqueue(Boolean(part.partialOutput));
	} }),
};
const customParent = create.Config({ model, output: customOutput });
const _customStream = create.TextStreamer({ onEnd: _event => {
	expectEqual<typeof _event.output, { total: number } | undefined>();
} }, customParent)('Input.');
expectEqual<typeof _customStream.output, PromiseLike<{ total: number }>>();
expectEqual<typeof _customStream.partialOutputStream, AsyncIterableStream<string>>();
expectEqual<typeof _customStream.elementStream, AsyncIterableStream<boolean>>();
const _customGenerated = create.TextGenerator({}, customParent)('Input.');
expectEqual<Awaited<typeof _customGenerated>['output'], { total: number }>();
declare const textPart: TextStreamPart<typeof tools>;
create.TextStreamer({ model, output: customOutput, onStart: _event => {
	const transform = _event.output?.createElementStreamTransform();
	if (transform) {
		expectEqual<typeof transform.readable, ReadableStream<boolean>>();
		void transform.writable.getWriter().write({ part: textPart, partialOutput: 'partial' });
		// @ts-expect-error Nested transform writers retain custom partial output types.
		void transform.writable.getWriter().write({ part: textPart, partialOutput: 123 });
	}
} });

// Parsed discriminated schema output narrows in both promised and streamed results.
const variantSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('count'), value: z.string().transform(Number) }),
	z.object({ kind: z.literal('label'), value: z.string() }),
]);
type Variant = { kind: 'count', value: number } | { kind: 'label', value: string };
void create.ObjectGenerator({ model, schema: variantSchema })('Input.').then(_value => {
	expectEqual<typeof _value.object, Variant>();
	if (_value.object.kind === 'count') {
		expectEqual<typeof _value.object.value, number>();
		// @ts-expect-error Object results expose transformed schema outputs.
		expectType<string>(_value.object.value);
	}
});
const variantText = create.TextStreamer({ model, output: Output.object({ schema: variantSchema }) })('Input.');
expectEqual<typeof variantText.output, PromiseLike<Variant>>();
expectEqual<typeof variantText.partialOutputStream, AsyncIterableStream<DeepPartial<Variant>>>();
void variantText.partialOutputStream.pipeTo(new WritableStream({ write: partial => {
	if (partial.kind === 'count') {
		expectEqual<typeof partial.value, number | undefined>();
		// @ts-expect-error Narrowing a partial variant does not make its fields required.
		expectType<number>(partial.value);
	}
} }));
