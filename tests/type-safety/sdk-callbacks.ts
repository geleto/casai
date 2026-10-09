// Compile-only consumer contracts; this module must never execute.
import { create, z, FileSystemLoader } from 'casai';
import { Output } from 'ai';
import type { LanguageModel, ModelMessage, generateText, streamText, generateObject, streamObject, GenerateObjectStartEvent, GenerateObjectStepStartEvent, GenerateObjectStepEndEvent, GenerateObjectEndEvent, Telemetry, JSONSchema7 } from 'ai';
import type { GenerateObjectObjectConfig, StreamObjectArrayConfig } from 'casai';

import { expectType, expectEqual } from './assert.js';
declare const model: LanguageModel;
const schema = z.object({ answer: z.number() });
const output = Output.object({ schema });
const runtimeContext = { requestId: 'request' };
const lookup = create.Function.asTool({
	inputSchema: z.object({ query: z.string() }), contextSchema: z.object({ factor: z.number() }),
	execute: ({ query }, { context }) => query.length * context.factor,
});
const tools = { lookup };
const toolsContext = { lookup: { factor: 2 } };
const parent = create.Config({ model, tools, toolsContext, output, runtimeContext, prompt: 'Answer.' });

const streamer = create.TextStreamer({
	onStart: _event => {
		expectEqual<typeof _event.runtimeContext.requestId, string>();
		expectType<typeof output | undefined>(_event.output);
		// @ts-expect-error Runtime context stays typed under inheritance.
		expectType<number>(_event.runtimeContext.requestId);
	},
	onStepStart: _event => {
		expectEqual<typeof _event.runtimeContext.requestId, string>();
		expectEqual<typeof _event.toolsContext.lookup.factor, number>();
		// @ts-expect-error Tool context stays typed.
		expectType<string>(_event.toolsContext.lookup.factor);
	},
	onStepEnd: _event => {
		expectEqual<(typeof _event.staticToolCalls)[number]['input']['query'], string>();
		// @ts-expect-error Tool input stays typed in step callbacks.
		expectType<number>(_event.staticToolCalls[0].input.query);
	},
	onEnd: _event => {
		expectType<number | undefined>(_event.output?.answer);
		expectType<ModelMessage[]>(_event.response.messageHistory);
		expectEqual<(typeof _event.staticToolResults)[number]['output'], number>();
		// @ts-expect-error Structured output stays typed in completion callbacks.
		expectType<string>(_event.output?.answer);
	},
	onFinish: _event => {
		// @ts-expect-error The alias has the same tool input contract as onEnd.
		expectType<number>(_event.staticToolCalls[0].input.query);
	},
	onChunk: ({ chunk }) => {
		if (chunk.type === 'tool-call' && !chunk.dynamic) {
			expectType<string>(chunk.input.query);
			// @ts-expect-error Narrowed chunks keep tool input types.
			expectType<number>(chunk.input.query);
		}
	},
	onAbort: _event => {
		// @ts-expect-error Abort callbacks retain the previous steps' tool types.
		expectType<number>(_event.steps[0].staticToolCalls[0].input.query);
	},
	prepareStep: _options => {
		expectType<string>(_options.runtimeContext.requestId);
		expectType<number>(_options.toolsContext.lookup.factor);
		return { activeTools: ['lookup'], runtimeContext: { requestId: 'next' } };
	},
	stopWhen: [({ steps: _steps }) => {
		// @ts-expect-error Callbacks in arrays retain tool output types.
		expectType<string>(_steps[0].staticToolResults[0].output);
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
	toolApproval: { lookup: (input, _options) => {
		expectType<string>(input.query);
		expectType<number>(_options.toolContext.factor);
		expectType<string>(_options.runtimeContext.requestId);
		return 'approved';
	} },
	experimental_transform: [({ tools: available, stopStream }) => {
		expectType<typeof lookup>(available.lookup);
		stopStream();
		return new TransformStream();
	}],
}, parent);

streamer.run({ onEnd: _event => {
	expectType<number | undefined>(_event.output?.answer);
	// @ts-expect-error run() callbacks use the final configured tools.
	expectType<number>(_event.staticToolCalls[0].input.query);
} });
void create.TextGenerator({ onEnd: _event => {
	expectEqual<(typeof _event.staticToolCalls)[number]['input']['query'], string>();
	// @ts-expect-error Generator callbacks use inherited tool types too.
	expectType<string>(_event.staticToolResults[0].output);
} }, parent).run({ prepareStep: _options => {
	// @ts-expect-error run() retains the configured runtime context.
	expectType<number>(_options.runtimeContext.requestId);
	return { activeTools: ['lookup'] };
} });

// A child combines new tools with the parent's tools, and replacements change callback contracts.
const extra = create.Function.asTool({ inputSchema: z.object({ count: z.number() }), execute: ({ count }) => String(count) });
create.TextGenerator({ tools: { extra }, prepareStep: () => ({ activeTools: ['lookup', 'extra'] as const }), onEnd: _event => {
	for (const call of _event.staticToolCalls) {
		if (call.toolName === 'extra') {
			expectType<number>(call.input.count);
			// @ts-expect-error Added tools do not widen the merged callback contract.
			expectType<string>(call.input.count);
		} else expectType<string>(call.input.query);
	}
} }, parent);
const replacement = create.Function.asTool({ inputSchema: z.object({ query: z.number() }), contextSchema: z.object({ factor: z.number() }), execute: ({ query }) => String(query) });
create.TextGenerator({ tools: { lookup: replacement }, onEnd: _event => {
	expectType<number>(_event.staticToolCalls[0].input.query);
	// @ts-expect-error Replaced tools change callback inputs.
	expectEqual<(typeof _event.staticToolCalls)[number]['input']['query'], string>();
} }, parent);

// Shared fragments preserve inline callback types before they become a component.
create.Config({ onEnd: _event => {
	// @ts-expect-error A child fragment retains inherited tools.
	expectType<number>(_event.staticToolCalls[0].input.query);
} }, parent);
const objectParent = create.Config({ model, schema, prompt: 'Answer.' });
create.Config({ onFinish: _event => {
	expectEqual<typeof _event.object, { answer: number } | undefined>();
	// @ts-expect-error A schema-bearing fragment retains its object type.
	expectType<string>(_event.object?.answer);
} }, objectParent);

const objectGenerator = create.ObjectGenerator({ onFinish: _event => {
	expectEqual<typeof _event.object, { answer: number } | undefined>();
	// @ts-expect-error Generated objects follow the inherited schema.
	expectType<string>(_event.object?.answer);
} }, objectParent);
const objectStreamer = create.ObjectStreamer({ model, schema, prompt: 'Answer.', onFinish: _event => {
	expectEqual<typeof _event.object, { answer: number } | undefined>();
	expectType<string>(_event.callId);
	// @ts-expect-error Streamed objects follow the schema and can be undefined.
	expectType<string>(_event.object?.answer);
} });
objectStreamer.run({ onFinish: _event => {
	// @ts-expect-error run() retains the generated object's schema.
	expectType<string>(_event.object?.answer);
} });
create.ObjectStreamer({ model, schema, output: 'array', onFinish: _event => {
	expectType<number | undefined>(_event.object?.[0].answer);
	// @ts-expect-error Array output wraps the schema's element type.
	expectType<string>(_event.object?.[0].answer);
} });
create.ObjectGenerator({ model, output: 'enum', enum: ['red', 'blue'] as const, onFinish: _event => {
	expectType<'red' | 'blue' | undefined>(_event.object);
	// @ts-expect-error Enum completion values retain their literal union.
	expectType<'green'>(_event.object);
} });
create.ObjectStreamer({ model, output: 'no-schema', onFinish: _event => {
	// @ts-expect-error Schemaless JSON cannot be assumed to be a number.
	expectType<number>(_event.object);
} });
const annotatedObject: GenerateObjectObjectConfig<never, { answer: number }> = { model, schema, onFinish: _event => {
	// @ts-expect-error Exported config types specialize the same callback.
	expectType<string>(_event.object?.answer);
} };
create.ObjectGenerator(annotatedObject);
const annotatedArray: StreamObjectArrayConfig<never, { answer: number }> = { model, schema, output: 'array', onFinish: _event => {
	// @ts-expect-error Exported array config types specialize the same callback.
	expectType<string>(_event.object?.[0].answer);
} };
create.ObjectStreamer(annotatedArray);

// Rendered and loaded factories share the same callback contracts.
create.TextGenerator.withTemplate({ model, tools, toolsContext, prompt: '{{ topic }}', onEnd: _event => {
	// @ts-expect-error Template rendering preserves tool input types.
	expectType<number>(_event.staticToolCalls[0].input.query);
} });
create.ObjectStreamer.withFunction({ model, schema, prompt: () => 'Input.', onFinish: _event => {
	// @ts-expect-error Function prompts preserve schema types.
	expectType<string>(_event.object?.answer);
} });
create.ObjectGenerator.loadsText({ schema, loader: new FileSystemLoader('tests'), onFinish: _event => {
	// @ts-expect-error Loaded prompts preserve schema types.
	expectType<string>(_event.object?.answer);
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

const inheritedFinish = create.ObjectGenerator({ model, schema, onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } });
// @ts-expect-error Replacing a schema must also replace an incompatible inherited callback.
create.ObjectGenerator({ schema: z.object({ label: z.string() }) }, inheritedFinish);
create.ObjectGenerator({ schema: z.object({ label: z.string() }), onFinish: _event => { expectType<string | undefined>(_event.object?.label); } }, inheritedFinish);


// Exact optional consumer settings reject explicitly absent callbacks.
objectStreamer.run({});
// @ts-expect-error Optional callbacks cannot require arbitrary event types.
objectStreamer.run({ onFinish: (_event: number) => undefined });
const inheritedText = create.TextGenerator({ onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input']['query'], string>(); } }, parent);
// @ts-expect-error A tool replacement also requires replacing incompatible inherited callbacks.
create.TextGenerator({ tools: { lookup: replacement } }, inheritedText);

// Alias callbacks are independently contextualized; SDK additions must update this inventory.
type Callback = (...args: any[]) => any;
type CallbackKeys<T> = { [K in keyof T]-?: Extract<NonNullable<T[K]>, Callback | readonly Callback[]> extends never ? never : K }[keyof T];
type TextSDK = Parameters<typeof streamText<typeof tools, typeof runtimeContext, typeof output>>[0];
type TextEvent<K extends keyof TextSDK> = Parameters<Extract<NonNullable<TextSDK[K]>, Callback>>[0];
type TextCallbackNames = 'toolApproval' | 'stopWhen' | 'prepareStep' | 'repairToolCall' | 'experimental_repairToolCall'
	| 'experimental_transform' | 'experimental_download' | 'onChunk' | 'onError' | 'onEnd' | 'onFinish' | 'onAbort'
	| 'onStepEnd' | 'onStepFinish' | 'onStart' | 'experimental_onStart' | 'onStepStart' | 'experimental_onStepStart'
	| 'onLanguageModelCallStart' | 'experimental_onLanguageModelCallStart' | 'onLanguageModelCallEnd' | 'experimental_onLanguageModelCallEnd'
	| 'onToolExecutionStart' | 'onToolExecutionEnd' | 'experimental_onToolCallStart' | 'experimental_onToolCallFinish';
expectEqual<CallbackKeys<TextSDK>, TextCallbackNames>();
expectEqual<CallbackKeys<Parameters<typeof generateText>[0]>, Exclude<TextCallbackNames, 'experimental_transform' | 'onChunk' | 'onError' | 'onAbort'>>();
type ObjectCallbackNames = 'repairText' | 'experimental_repairText' | 'experimental_download' | 'onStart' | 'experimental_onStart'
	| 'onStepStart' | 'experimental_onStepStart' | 'onStepEnd' | 'onStepFinish' | 'onFinish';
expectEqual<CallbackKeys<Parameters<typeof generateObject>[0]>, ObjectCallbackNames>();
expectEqual<CallbackKeys<Parameters<typeof streamObject>[0]>, ObjectCallbackNames | 'onError'>();

create.TextStreamer({
	experimental_onStart: _event => { expectEqual<typeof _event, TextEvent<'onStart'>>(); },
	experimental_onStepStart: _event => { expectEqual<typeof _event, TextEvent<'onStepStart'>>(); },
	onStepFinish: _event => { expectEqual<typeof _event, TextEvent<'onStepEnd'>>(); },
	onLanguageModelCallStart: _event => { expectEqual<typeof _event, TextEvent<'onLanguageModelCallStart'>>(); },
	experimental_onLanguageModelCallStart: _event => { expectEqual<typeof _event, TextEvent<'onLanguageModelCallStart'>>(); },
	onLanguageModelCallEnd: _event => { expectEqual<typeof _event, TextEvent<'onLanguageModelCallEnd'>>(); },
	experimental_onLanguageModelCallEnd: _event => { expectEqual<typeof _event, TextEvent<'onLanguageModelCallEnd'>>(); },
	onToolExecutionStart: _event => { expectEqual<typeof _event, TextEvent<'onToolExecutionStart'>>(); },
	experimental_onToolCallStart: _event => { expectEqual<typeof _event, TextEvent<'onToolExecutionStart'>>(); },
	onToolExecutionEnd: _event => { expectEqual<typeof _event, TextEvent<'onToolExecutionEnd'>>(); },
	experimental_onToolCallFinish: _event => { expectEqual<typeof _event, TextEvent<'onToolExecutionEnd'>>(); },
	onError: _event => { expectEqual<typeof _event.error, unknown>(); return { retry: true }; },
	experimental_repairToolCall: async _options => {
		expectEqual<typeof _options, TextEvent<'repairToolCall'>>();
		return _options.toolCall;
	},
	experimental_download: async requests => {
		expectEqual<typeof requests, { url: URL, isUrlSupportedByModel: boolean }[]>();
		return requests.map(() => ({ data: new Uint8Array(), mediaType: 'text/plain' }));
	},
	toolApproval: _options => {
		expectEqual<typeof _options.runtimeContext, typeof runtimeContext>();
		expectEqual<typeof _options.tools, typeof tools | undefined>();
		if (!_options.toolCall.dynamic) expectEqual<typeof _options.toolCall.input, { query: string }>();
		return 'user-approval';
	},
}, parent);

// Object callbacks other than finish use the SDK's fixed lifecycle events.
create.ObjectGenerator({
	model, schema,
	onStart: _event => { expectEqual<typeof _event, GenerateObjectStartEvent>(); },
	experimental_onStart: _event => { expectEqual<typeof _event, GenerateObjectStartEvent>(); },
	onStepStart: _event => { expectEqual<typeof _event, GenerateObjectStepStartEvent>(); },
	experimental_onStepStart: _event => { expectEqual<typeof _event, GenerateObjectStepStartEvent>(); },
	onStepEnd: _event => { expectEqual<typeof _event, GenerateObjectStepEndEvent>(); },
	onStepFinish: _event => { expectEqual<typeof _event, GenerateObjectStepEndEvent>(); },
	onFinish: _event => { expectEqual<typeof _event, GenerateObjectEndEvent<{ answer: number }>>(); },
	repairText: async _options => { expectEqual<typeof _options.text, string>(); return _options.text; },
	experimental_repairText: async _options => { expectEqual<typeof _options.text, string>(); return null; },
});
objectStreamer.run({ onError: _event => { expectEqual<typeof _event.error, unknown>(); } });
void objectGenerator.run({ onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } });

// Nested telemetry callbacks retain the SDK's own broad event contracts.
create.TextGenerator({ model, telemetry: { integrations: {
	onStart: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onStart']>>[0]>(); },
	onStepStart: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onStepStart']>>[0]>(); },
	onLanguageModelCallStart: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onLanguageModelCallStart']>>[0]>(); },
	onLanguageModelCallEnd: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onLanguageModelCallEnd']>>[0]>(); },
	onToolExecutionStart: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onToolExecutionStart']>>[0]>(); },
	onToolExecutionEnd: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onToolExecutionEnd']>>[0]>(); },
	onStepEnd: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onStepEnd']>>[0]>(); },
	onStepFinish: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onStepFinish']>>[0]>(); },
	onObjectStepStart: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onObjectStepStart']>>[0]>(); },
	onObjectStepEnd: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onObjectStepEnd']>>[0]>(); },
	onEnd: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onEnd']>>[0]>(); },
	onAbort: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onAbort']>>[0]>(); },
	onError: _error => { expectEqual<typeof _error, unknown>(); },
	executeLanguageModelCall: _options => _options.execute(),
	executeTool: _options => _options.execute(),
} } });
create.ObjectStreamer({ model, schema, experimental_telemetry: { integrations: [{
	onError: _error => { expectEqual<typeof _error, unknown>(); },
	executeTool: _options => _options.execute(),
}] } });

// Nested SDK test hooks also retain their callback return contracts.
create.TextGenerator({ model, _internal: { generateId: () => 'id', generateCallId: () => 'call', now: () => 0 } });
create.TextStreamer({ model, _internal: { generateId: () => 'id', generateCallId: () => 'call', now: () => 0 } });
create.ObjectGenerator({ model, schema, _internal: { generateId: () => 'id', currentDate: () => new Date() } });
create.ObjectStreamer({ model, schema, _internal: { generateId: () => 'id', currentDate: () => new Date(), now: () => 0 } });
// @ts-expect-error Identifier hooks return strings.
create.TextGenerator({ model, _internal: { generateCallId: () => 123 } });
// @ts-expect-error Clock hooks return numbers.
create.TextStreamer({ model, _internal: { now: () => new Date() } });
// @ts-expect-error Object-generation date hooks return Date values.
create.ObjectGenerator({ model, schema, _internal: { currentDate: () => 123 } });
// @ts-expect-error Object-stream clock hooks return numbers.
create.ObjectStreamer({ model, schema, _internal: { now: () => 'now' } });

// PromiseLike return support follows each SDK callback's declared contract.
declare const voidThenable: PromiseLike<void>;
declare const booleanThenable: PromiseLike<boolean>;
create.TextGenerator({ model, onEnd: () => voidThenable, stopWhen: () => booleanThenable });
create.ObjectStreamer({ model, schema, onFinish: () => voidThenable });
// @ts-expect-error Object error handlers specifically require a full Promise when async.
objectStreamer.run({ onError: () => voidThenable });
// @ts-expect-error Text-repair callbacks specifically require a full Promise.
create.ObjectGenerator({ model, schema, repairText: () => ({ then: () => undefined }) });
// The SDK text error handler union contains plain void, permitting ignored sync/async returns.
create.TextStreamer({ model, onError: async () => 123 });
// @ts-expect-error Generic telemetry wrappers must preserve the execute callback's result type.
create.TextGenerator({ model, telemetry: { integrations: { executeTool: async () => 123 } } });

// Every callback family checks return types, including aliases and nested functions.
// @ts-expect-error Lifecycle observers return void or PromiseLike<void>.
create.TextGenerator({ model, onStart: () => 123 });
// @ts-expect-error Deprecated lifecycle aliases retain return checking.
create.TextGenerator({ model, experimental_onStart: async () => 123 });
// @ts-expect-error Step-start observers cannot return values.
create.TextGenerator({ model, onStepStart: () => 'start' });
// @ts-expect-error Step-completion observers cannot return values.
create.TextGenerator({ model, onStepFinish: async () => true });
// @ts-expect-error Model-call observers cannot return values.
create.TextGenerator({ model, onLanguageModelCallStart: () => 123 });
// @ts-expect-error Parsed model-response observers cannot return values.
create.TextGenerator({ model, onLanguageModelCallEnd: async () => 123 });
// @ts-expect-error Tool-execution observers cannot return values.
create.TextGenerator({ model, onToolExecutionStart: () => 123 });
// @ts-expect-error Tool-execution completion observers cannot return values.
create.TextStreamer({ onToolExecutionEnd: async () => 123 }, parent);
// @ts-expect-error Chunk observers cannot return arbitrary values.
streamer.run({ onChunk: async () => 123 });
// @ts-expect-error Abort observers cannot return arbitrary values.
streamer.run({ onAbort: () => 123 });
// @ts-expect-error A stop condition must return a boolean.
streamer.run({ stopWhen: () => 123 });
// @ts-expect-error Step preparation rejects an invalid tool choice.
streamer.run({ prepareStep: () => ({ toolChoice: { type: 'tool', toolName: 'missing' } }) });
// @ts-expect-error Transform callbacks must produce a TransformStream.
streamer.run({ experimental_transform: [() => 123] });
// @ts-expect-error Transforms preserve the SDK event stream's input and output element types.
streamer.run({ experimental_transform: () => new TransformStream<string, number>() });
// @ts-expect-error Download callbacks return downloaded binary data or null.
create.TextGenerator({ model, experimental_download: async () => [{ data: 'text', mediaType: 'text/plain' }] });
// @ts-expect-error Tool approval callbacks return a valid approval status.
streamer.run({ toolApproval: { lookup: () => true } });
// @ts-expect-error Generic tool approval callbacks return a valid approval status.
create.TextGenerator({ toolApproval: () => 123 }, parent);
// @ts-expect-error Refiners must reference a configured tool.
streamer.run({ experimental_refineToolInput: { missing: () => ({ query: 'input' }) } });
// @ts-expect-error Extra refiner keys cannot hide alongside valid configured keys.
streamer.run({ experimental_refineToolInput: { lookup: input => input, missing: () => ({ query: 'input' }) } });
// @ts-expect-error Approval maps can only configure existing tools.
streamer.run({ toolApproval: { lookup: 'approved', missing: 'approved' } });
// @ts-expect-error Factory input-refinement maps only accept configured tool names.
create.TextGenerator({ experimental_refineToolInput: { lookup: input => input, missing: () => ({ query: 'input' }) } }, parent);
// @ts-expect-error Shared fragments cannot retain an unknown refiner key.
create.Config({ experimental_refineToolInput: { lookup: input => input, missing: () => ({ query: 'input' }) } }, parent);
// @ts-expect-error Standalone factories reject extra approval-map names.
create.TextGenerator({ model, tools, toolsContext, toolApproval: { lookup: 'approved', missing: 'approved' } });
// @ts-expect-error Shared fragments reject extra approval-map names.
create.Config({ toolApproval: { lookup: 'approved', missing: 'approved' } }, parent);
declare const refiners: { lookup?: (input: { query: string }) => PromiseLike<{ query: string }> };
streamer.run({ experimental_refineToolInput: refiners });
create.TextGenerator({ experimental_refineToolInput: refiners }, parent);
declare const approval: NonNullable<TextSDK['toolApproval']>;
streamer.run({ toolApproval: approval });
type LookupApproval = Exclude<NonNullable<TextSDK['toolApproval']>, Callback>['lookup'];
declare const optionalApprovalCallbacks: { lookup?: Extract<LookupApproval, Callback> };
declare const optionalApprovalStatuses: { lookup?: Exclude<LookupApproval, Callback> };
create.TextGenerator({ model, tools, toolsContext, runtimeContext, toolApproval: optionalApprovalCallbacks });
create.TextGenerator({ model, tools, toolsContext, runtimeContext, toolApproval: optionalApprovalStatuses });
const deferredOptionalCallbacks = create.Config({ toolApproval: optionalApprovalCallbacks });
const deferredOptionalStatuses = create.Config({ toolApproval: optionalApprovalStatuses });
create.TextStreamer({ model, tools, toolsContext, runtimeContext }, deferredOptionalCallbacks);
create.TextStreamer({ model, tools, toolsContext, runtimeContext }, deferredOptionalStatuses);
streamer.run({ toolApproval: optionalApprovalCallbacks });
streamer.run({ toolApproval: optionalApprovalStatuses });
// The SDK approval-status union explicitly includes undefined, including in exact consumers.
streamer.run({ toolApproval: { lookup: undefined } });
create.TextGenerator({ model, tools, toolsContext, toolApproval: { lookup: undefined } });
const deferredRefiners = create.Config({ experimental_refineToolInput: { lookup: (input: { query: string }) => input } });
create.TextGenerator({ model, tools, toolsContext }, deferredRefiners);
// @ts-expect-error Deferred refiner names must exist in the consuming component's final tools.
create.TextGenerator({ model, tools: { extra } }, deferredRefiners);
// @ts-expect-error Deferred refiners must match the consuming tool's input type.
create.TextGenerator({ model, tools: { lookup: replacement }, toolsContext }, deferredRefiners);
const deferredApproval = create.Config({ toolApproval: { lookup: 'approved' as const } });
create.TextStreamer({ model, tools, toolsContext }, deferredApproval);
// @ts-expect-error Deferred approval names must exist in the consuming component's final tools.
create.TextStreamer({ model, tools: { extra } }, deferredApproval);
const deferredApprovalCallback = create.Config({ toolApproval: { lookup: (input: { query: string }) => input.query ? 'approved' : 'denied' } });
create.TextGenerator({ model, tools, toolsContext }, deferredApprovalCallback);
// @ts-expect-error Deferred approval callback inputs must match the eventual tool schema.
create.TextGenerator({ model, tools: { lookup: replacement }, toolsContext }, deferredApprovalCallback);
create.Config({ toolApproval: { lookup: (_input, _options) => {
	expectEqual<typeof _input, unknown>();
	expectEqual<typeof _options.runtimeContext, Record<string, unknown>>();
	return 'approved';
} } });
create.Config({ toolApproval: { lookup: undefined } });
// @ts-expect-error Approval configurations are maps or callbacks even before tools are provided.
create.Config({ toolApproval: 123 });
// @ts-expect-error Approval-map statuses follow the SDK contract even in incomplete fragments.
create.Config({ toolApproval: { lookup: 123 } });
// @ts-expect-error Approval callback return types do not depend on the unresolved input type.
create.Config({ toolApproval: { lookup: (_input: { query: string }) => 123 } });
// @ts-expect-error Async approval callbacks must still resolve an SDK approval status.
create.Config({ toolApproval: { lookup: async (_input: { query: string }) => true } });
// @ts-expect-error Download callback parameters are not text.
create.ObjectGenerator({ model, schema, experimental_download: async (_requests: string) => [] });
// @ts-expect-error Object lifecycle observers cannot return arbitrary values.
create.ObjectGenerator({ model, schema, onStepEnd: async () => 123 });
// @ts-expect-error Object repair callbacks must return a promise.
void objectGenerator.run({ experimental_repairText: () => null });
// @ts-expect-error Telemetry callbacks retain nested return validation.
create.TextGenerator({ model, telemetry: { integrations: { onError: () => 123 } } });
// @ts-expect-error Object error observers use void | Promise<void>, so returns are validated.
objectStreamer.run({ onError: () => 123 });

// Every prompt factory overload supplies the same inferred callback context.
const loader = new FileSystemLoader('tests');
create.TextGenerator.withText({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.withTemplate({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.withScript({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.loadsText({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.loadsTemplate({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.loadsScript({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.withFunction({ prompt: () => 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.withText.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.withTemplate.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.withScript.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.loadsText.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.loadsTemplate.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.loadsScript.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextGenerator.withFunction.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: () => 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextStreamer.withText({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextStreamer.withTemplate({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextStreamer.withScript({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextStreamer.loadsText({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextStreamer.loadsTemplate({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextStreamer.loadsScript({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.TextStreamer.withFunction({ prompt: () => 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.ObjectGenerator.withText({ prompt: 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.withTemplate({ prompt: 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.withScript({ prompt: 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.loadsText({ prompt: 'input', loader, onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.loadsTemplate({ prompt: 'input', loader, onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.loadsScript({ prompt: 'input', loader, onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.withFunction({ prompt: () => 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.withText.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.withTemplate.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.withScript.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.loadsText.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.loadsTemplate.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.loadsScript.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectGenerator.withFunction.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: () => 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectStreamer.withText({ prompt: 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectStreamer.withTemplate({ prompt: 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectStreamer.withScript({ prompt: 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectStreamer.loadsText({ prompt: 'input', loader, onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectStreamer.loadsTemplate({ prompt: 'input', loader, onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectStreamer.loadsScript({ prompt: 'input', loader, onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);
create.ObjectStreamer.withFunction({ prompt: () => 'input', onFinish: _event => { expectEqual<typeof _event.object, { answer: number } | undefined>(); } }, objectParent);

// SDK public lifecycle hooks are singular; arrays belong to stop conditions, transforms, and telemetry integrations.
// @ts-expect-error Completion observers cannot be supplied as callback arrays.
streamer.run({ onEnd: [() => undefined] });
// @ts-expect-error Tool-execution observers cannot be supplied as callback arrays.
create.TextGenerator({ model, onToolExecutionStart: [() => undefined] });
create.TextGenerator({ model, telemetry: { integrations: [{
	onStart: (_event: GenerateObjectStartEvent) => { expectEqual<typeof _event, GenerateObjectStartEvent>(); },
	executeLanguageModelCall: async _options => {
		expectEqual<typeof _options.callId, string>();
		return await _options.execute();
	},
}, {
	onStepEnd: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onStepEnd']>>[0]>(); },
	executeTool: _options => {
		expectEqual<typeof _options.toolCallId, string>();
		return _options.execute().then(value => value);
	},
}] } });
// @ts-expect-error Every integration in the array validates observer return values.
create.TextGenerator({ model, telemetry: { integrations: [{ onError: () => undefined }, { onStepEnd: async () => 123 }] } });
// @ts-expect-error Model-call wrappers preserve the generic execute result, including inside arrays.
create.TextGenerator({ model, telemetry: { integrations: [{ executeLanguageModelCall: async () => 'response' }] } });
// @ts-expect-error Step observers are contravariant even though SDK operation-level telemetry observers are bivariant.
create.TextGenerator({ model, telemetry: { integrations: [{ onStepEnd: (_event: { text: 'only-this-text' }) => undefined }] } });

// Tool names and dynamic flags narrow heterogeneous callback inputs and tool-result/error unions.
create.TextStreamer({ model, tools: { lookup, extra }, toolsContext, onToolExecutionStart: ({ toolCall }) => {
	if (toolCall.dynamic) {
		expectEqual<typeof toolCall.input, unknown>();
		// @ts-expect-error Dynamic inputs must be validated before using static fields.
		expectType<{ query: string }>(toolCall.input);
	} else if (toolCall.toolName === 'lookup') {
		expectEqual<typeof toolCall.input, { query: string }>();
	} else {
		expectEqual<typeof toolCall.input, { count: number }>();
		// @ts-expect-error Narrowing one tool must exclude the other tool's input.
		expectType<unknown>(toolCall.input.query);
	}
}, onToolExecutionEnd: ({ toolOutput }) => {
	if (toolOutput.type === 'tool-error') {
		expectEqual<typeof toolOutput.error, unknown>();
		// @ts-expect-error Failed tool executions do not provide a successful output.
		expectType<unknown>(toolOutput.output);
	} else if (toolOutput.dynamic) {
		expectEqual<typeof toolOutput.output, unknown>();
	} else if (toolOutput.toolName === 'lookup') {
		expectEqual<typeof toolOutput.output, number>();
	} else {
		expectEqual<typeof toolOutput.output, string>();
	}
} });
// @ts-expect-error A hook for all calls cannot require only one static tool variant.
create.TextGenerator({ model, tools: { lookup, extra }, toolsContext, onToolExecutionStart: (_event: { toolCall: { toolName: 'lookup', input: { query: string } } }) => undefined });
streamer.run({ repairToolCall: async ({ toolCall, inputSchema }) => {
	expectEqual<typeof toolCall.input, string>();
	const _jsonSchema = await inputSchema({ toolName: 'lookup' });
	expectEqual<typeof _jsonSchema, JSONSchema7>();
	// @ts-expect-error Nested schema lookup callbacks require a string tool name.
	await inputSchema({ toolName: 123 });
	return { ...toolCall, input: '{"query":"repaired"}' };
} });

// Parsed schema transforms and discriminated unions flow through completion callbacks.
const variantSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('count'), value: z.string().transform(Number) }),
	z.object({ kind: z.literal('label'), value: z.string() }),
]);
type Variant = { kind: 'count', value: number } | { kind: 'label', value: string };
create.ObjectStreamer({ model, schema: variantSchema, onFinish: _event => {
	expectEqual<typeof _event.object, Variant | undefined>();
	const object = _event.object;
	if (object?.kind === 'count') {
		expectEqual<typeof object.value, number>();
		// @ts-expect-error Object callbacks expose parsed values rather than transform inputs.
		expectType<string>(object.value);
	} else if (object) expectEqual<typeof object.value, string>();
} });
create.TextStreamer({ model, output: Output.object({ schema: variantSchema }), onEnd: _event => {
	expectEqual<typeof _event.output, Variant | undefined>();
	const object = _event.output;
	if (object?.kind === 'count') expectEqual<typeof object.value, number>();
} });
// @ts-expect-error A completion observer cannot require only one possible schema union member.
create.ObjectGenerator({ model, schema: variantSchema, onFinish: (_event: GenerateObjectEndEvent<Extract<Variant, { kind: 'count' }>>) => undefined });
