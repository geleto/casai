// Compile-only probes: test:types checks these against src (TS7 and TS6) and dist.
import { create, z, FileSystemLoader } from './cascada';
import { Output } from 'ai';
import type { LanguageModel, ModelMessage, UIMessage, InferUIMessageChunk, StreamTextResult as SDKStreamTextResult, GenerateTextResult as SDKGenerateTextResult } from 'ai';
import type { ServerResponse } from 'node:http';
import type { GenerateObjectObjectConfig, StreamObjectArrayConfig } from './cascada';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Each probe explicitly supplies the expected type.
declare function expectType<T>(value: T): void;
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
const toolsContext = { lookup: { factor: 2 } };
const parent = create.Config({ model, tools, toolsContext, output, runtimeContext });

const streamer = create.TextStreamer({
	onStart: event => {
		expectType<string>(event.runtimeContext.requestId);
		expectType<typeof output | undefined>(event.output);
		// @ts-expect-error Runtime context stays typed under inheritance.
		expectType<number>(event.runtimeContext.requestId);
	},
	onStepStart: event => {
		expectType<string>(event.runtimeContext.requestId);
		expectType<number>(event.toolsContext.lookup.factor);
		// @ts-expect-error Tool context stays typed.
		expectType<string>(event.toolsContext.lookup.factor);
	},
	onStepEnd: event => {
		expectType<string>(event.staticToolCalls[0].input.query);
		// @ts-expect-error Tool input stays typed in step callbacks.
		expectType<number>(event.staticToolCalls[0].input.query);
	},
	onEnd: event => {
		expectType<number | undefined>(event.output?.answer);
		expectType<ModelMessage[]>(event.response.messageHistory);
		expectType<number>(event.staticToolResults[0].output);
		// @ts-expect-error Structured output stays typed in completion callbacks.
		expectType<string>(event.output?.answer);
	},
	onFinish: event => {
		// @ts-expect-error The alias has the same tool input contract as onEnd.
		expectType<number>(event.staticToolCalls[0].input.query);
	},
	onChunk: ({ chunk }) => {
		if (chunk.type === 'tool-call' && !chunk.dynamic) {
			expectType<string>(chunk.input.query);
			// @ts-expect-error Narrowed chunks keep tool input types.
			expectType<number>(chunk.input.query);
		}
	},
	onAbort: event => {
		// @ts-expect-error Abort callbacks retain the previous steps' tool types.
		expectType<number>(event.steps[0].staticToolCalls[0].input.query);
	},
	prepareStep: options => {
		expectType<string>(options.runtimeContext.requestId);
		expectType<number>(options.toolsContext.lookup.factor);
		return { activeTools: ['lookup'], runtimeContext: { requestId: 'next' } };
	},
	stopWhen: [({ steps }) => {
		// @ts-expect-error Callbacks in arrays retain tool output types.
		expectType<string>(steps[0].staticToolResults[0].output);
		return false;
	}],
	repairToolCall: async ({ tools: available, toolCall, inputSchema }) => {
		expectType<typeof lookup>(available.lookup);
		await inputSchema({ toolName: toolCall.toolName });
		return null;
	},
	experimental_refineToolInput: { lookup: input => {
		// @ts-expect-error Nested callbacks retain tool input types.
		expectType<number>(input.query);
		return { query: input.query.trim() };
	} },
	toolApproval: { lookup: (input, options) => {
		expectType<string>(input.query);
		expectType<number>(options.toolContext.factor);
		expectType<string>(options.runtimeContext.requestId);
		return 'approved';
	} },
	experimental_transform: [({ tools: available, stopStream }) => {
		expectType<typeof lookup>(available.lookup);
		stopStream();
		return new TransformStream();
	}],
}, parent);

streamer.run({ onEnd: event => {
	expectType<number | undefined>(event.output?.answer);
	// @ts-expect-error run() callbacks use the final configured tools.
	expectType<number>(event.staticToolCalls[0].input.query);
} });
void create.TextGenerator({ onEnd: event => {
	expectType<string>(event.staticToolCalls[0].input.query);
	// @ts-expect-error Generator callbacks use inherited tool types too.
	expectType<string>(event.staticToolResults[0].output);
} }, parent).run({ prepareStep: options => {
	// @ts-expect-error run() retains the configured runtime context.
	expectType<number>(options.runtimeContext.requestId);
	return { activeTools: ['lookup'] };
} });

// A child combines new tools with the parent's tools, and replacements change callback contracts.
const extra = create.Function.asTool({ inputSchema: z.object({ count: z.number() }), execute: ({ count }) => String(count) });
create.TextGenerator({ tools: { extra }, prepareStep: () => ({ activeTools: ['lookup', 'extra'] as const }), onEnd: event => {
	for (const call of event.staticToolCalls) {
		if (call.toolName === 'extra') {
			expectType<number>(call.input.count);
			// @ts-expect-error Added tools do not widen the merged callback contract.
			expectType<string>(call.input.count);
		} else expectType<string>(call.input.query);
	}
} }, parent);
const replacement = create.Function.asTool({ inputSchema: z.object({ query: z.number() }), contextSchema: z.object({ factor: z.number() }), execute: ({ query }) => String(query) });
create.TextGenerator({ tools: { lookup: replacement }, onEnd: event => {
	expectType<number>(event.staticToolCalls[0].input.query);
	// @ts-expect-error Replaced tools change callback inputs.
	expectType<string>(event.staticToolCalls[0].input.query);
} }, parent);

// Shared fragments preserve inline callback types before they become a component.
create.Config({ onEnd: event => {
	// @ts-expect-error A child fragment retains inherited tools.
	expectType<number>(event.staticToolCalls[0].input.query);
} }, parent);
const objectParent = create.Config({ model, schema });
create.Config({ onFinish: event => {
	expectType<number | undefined>(event.object?.answer);
	// @ts-expect-error A schema-bearing fragment retains its object type.
	expectType<string>(event.object?.answer);
} }, objectParent);

const objectGenerator = create.ObjectGenerator({ onFinish: event => {
	expectType<number | undefined>(event.object?.answer);
	// @ts-expect-error Generated objects follow the inherited schema.
	expectType<string>(event.object?.answer);
} }, objectParent);
const objectStreamer = create.ObjectStreamer({ model, schema, onFinish: event => {
	expectType<number | undefined>(event.object?.answer);
	expectType<string>(event.callId);
	// @ts-expect-error Streamed objects follow the schema and can be undefined.
	expectType<string>(event.object?.answer);
} });
objectStreamer.run({ onFinish: event => {
	// @ts-expect-error run() retains the generated object's schema.
	expectType<string>(event.object?.answer);
} });
create.ObjectStreamer({ model, schema, output: 'array', onFinish: event => {
	expectType<number | undefined>(event.object?.[0].answer);
	// @ts-expect-error Array output wraps the schema's element type.
	expectType<string>(event.object?.[0].answer);
} });
create.ObjectGenerator({ model, output: 'enum', enum: ['red', 'blue'] as const, onFinish: event => {
	expectType<'red' | 'blue' | undefined>(event.object);
	// @ts-expect-error Enum completion values retain their literal union.
	expectType<'green'>(event.object);
} });
create.ObjectStreamer({ model, output: 'no-schema', onFinish: event => {
	// @ts-expect-error Schemaless JSON cannot be assumed to be a number.
	expectType<number>(event.object);
} });
const annotatedObject: GenerateObjectObjectConfig<never, { answer: number }> = { model, schema, onFinish: event => {
	// @ts-expect-error Exported config types specialize the same callback.
	expectType<string>(event.object?.answer);
} };
create.ObjectGenerator(annotatedObject);
const annotatedArray: StreamObjectArrayConfig<never, { answer: number }> = { model, schema, output: 'array', onFinish: event => {
	// @ts-expect-error Exported array config types specialize the same callback.
	expectType<string>(event.object?.[0].answer);
} };
create.ObjectStreamer(annotatedArray);

// Rendered and loaded factories share the same callback contracts.
create.TextGenerator.withTemplate({ model, tools, toolsContext, prompt: '{{ topic }}', onEnd: event => {
	// @ts-expect-error Template rendering preserves tool input types.
	expectType<number>(event.staticToolCalls[0].input.query);
} });
create.ObjectStreamer.withFunction({ model, schema, prompt: () => 'Input.', onFinish: event => {
	// @ts-expect-error Function prompts preserve schema types.
	expectType<string>(event.object?.answer);
} });
create.ObjectGenerator.loadsText({ schema, loader: new FileSystemLoader('tests'), onFinish: event => {
	// @ts-expect-error Loaded prompts preserve schema types.
	expectType<string>(event.object?.answer);
} }, create.Config({ model }));

// Invalid callback arguments and return values must fail at every entry point.
// @ts-expect-error Observer callbacks cannot return arbitrary values.
create.TextGenerator({ model, onEnd: () => 123 });
// @ts-expect-error A callback cannot require a different event type.
create.TextStreamer({ model, onChunk: (_event: number) => undefined });
// @ts-expect-error Stop conditions must return boolean, including async callbacks in arrays.
create.TextGenerator({ model, stopWhen: [async () => 'yes'] });
// @ts-expect-error Step preparation cannot enable nonexistent tools.
create.TextGenerator({ prepareStep: () => ({ activeTools: ['missing'] }) }, parent);
// @ts-expect-error run() retains callback return checking.
streamer.run({ onEnd: async () => 123 });
// @ts-expect-error run() cannot prepare a step with invalid runtime context.
streamer.run({ prepareStep: () => ({ runtimeContext: { requestId: 123 } }) });
// @ts-expect-error Nested input refiners cannot change tool input types.
streamer.run({ experimental_refineToolInput: { lookup: () => ({ query: 123 }) } });
// @ts-expect-error Repair callbacks return a repaired tool call or null asynchronously.
create.TextGenerator({ model, repairToolCall: () => null });
// @ts-expect-error Object repair callbacks cannot return numbers.
create.ObjectGenerator({ model, schema, repairText: async () => 123 });
// @ts-expect-error Object observers cannot return arbitrary values.
create.ObjectStreamer({ model, schema, onFinish: () => 123 });
// @ts-expect-error Shared fragments check observer return values too.
create.Config({ onEnd: async () => 123 }, parent);
// SDK error observers may return ignored values because one overload returns void.
create.TextStreamer({ model, onError: () => 123 });

const inheritedFinish = create.ObjectGenerator({ model, schema, onFinish: event => { expectType<number | undefined>(event.object?.answer); } });
// @ts-expect-error Replacing a schema must also replace an incompatible inherited callback.
create.ObjectGenerator({ schema: z.object({ label: z.string() }) }, inheritedFinish);
create.ObjectGenerator({ schema: z.object({ label: z.string() }), onFinish: event => { expectType<string | undefined>(event.object?.label); } }, inheritedFinish);

// Result functions, their callbacks, and their generic signatures stay SDK-compatible.
const result = streamer('Input.');
expectType<Omit<SDKStreamTextResult<typeof tools, typeof runtimeContext, typeof output>, 'response'>>(result);
expectType<PromiseLike<number>>(result.output.then(value => value.answer));
expectType<PromiseLike<string>>(result.finalStep.then(value => value.runtimeContext.requestId));
// @ts-expect-error Result output no longer leaks any.
expectType<PromiseLike<string>>(result.output.then(value => value.answer));
const inheritedText = create.TextGenerator({ onEnd: event => { expectType<string>(event.staticToolCalls[0].input.query); } }, parent);
// @ts-expect-error A tool replacement also requires replacing incompatible inherited callbacks.
create.TextGenerator({ tools: { lookup: replacement } }, inheritedText);
const generated = create.TextGenerator({}, parent)('Input.');
expectType<PromiseLike<Omit<SDKGenerateTextResult<typeof tools, typeof runtimeContext, typeof output>, 'response'>>>(generated);
// @ts-expect-error Default text output is a string.
expectType<PromiseLike<number>>(create.TextGenerator({ model })('Input.').then(value => value.output));

type Message = UIMessage<{ traceId: string }>;
expectType<ReadableStream<InferUIMessageChunk<Message>>>(result.toUIMessageStream<Message>({
	messageMetadata: ({ part }) => {
		expectType<string>(part.type);
		return { traceId: 'trace' };
	},
	onEnd: event => {
		expectType<string | undefined>(event.responseMessage.metadata?.traceId);
		// @ts-expect-error UI message callbacks retain explicit message metadata.
		expectType<number>(event.responseMessage.metadata?.traceId);
	},
	onError: error => { expectType<unknown>(error); return 'error'; },
}));
expectType<Response>(result.toUIMessageStreamResponse<Message>({ consumeSseStream: ({ stream }) => { expectType<ReadableStream<string>>(stream); } }));
expectType<Promise<void>>(result.pipeUIMessageStreamToResponse<Message>(response, { onFinish: event => { expectType<Message>(event.responseMessage); } }));
expectType<Promise<void>>(result.pipeTextStreamToResponse(response, { status: 200 }));
expectType<Response>(result.toTextStreamResponse({ headers: { 'x-test': 'value' } }));
expectType<PromiseLike<void>>(result.consumeStream({ onError: error => {
	// @ts-expect-error SDK error callbacks receive unknown.
	expectType<Error>(error);
} }));
// @ts-expect-error UI stream error serialization must return a string.
result.toUIMessageStream({ onError: () => 123 });
// @ts-expect-error Metadata callbacks must match the requested UIMessage metadata.
result.toUIMessageStream<Message>({ messageMetadata: () => ({ traceId: 123 }) });
// @ts-expect-error UI completion observers cannot resolve arbitrary values.
result.toUIMessageStream<Message>({ onFinish: async () => 123 });
// @ts-expect-error Response methods validate their options.
result.toTextStreamResponse({ status: '200' });
expectType<PromiseLike<Response>>(objectGenerator('Input.').then(value => value.toJsonResponse({ status: 200 })));
// @ts-expect-error Object result methods retain SDK option validation.
void objectGenerator('Input.').then(value => value.toJsonResponse({ status: '200' }));
expectType<Response>(objectStreamer('Input.').toTextStreamResponse({ status: 200 }));
expectType<Promise<void>>(objectStreamer('Input.').pipeTextStreamToResponse(response));
