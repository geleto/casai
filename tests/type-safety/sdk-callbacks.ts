import type { EmptyMap } from './assert.js';
// Compile-only consumer contracts; this module must never execute.
import { create, z, FileSystemLoader } from 'casai';
import { Output } from 'ai';
import type { LanguageModel, ModelMessage, generateText, streamText, Telemetry, JSONSchema7 } from 'ai';
import type { LLMAgentConfig, StreamTextOnFinishEvent } from 'casai';

import { expectType, expectEqual } from './assert.js';
declare const model: LanguageModel;
const schema = z.object({ answer: z.number() });
const output = Output.object({ schema });
const runtimeContext = { requestId: 'request' };
const lookup = create.Function.asTool({
	inputSchema: z.object({ query: z.string() }), context: { factor: 1 }, toolContextSchema: z.object({ factor: z.number() }),
	execute: ({ query, factor }) => query.length * factor,
});
const tools = { lookup };
const toolsContext = { lookup: { factor: 2 } };
const parent = create.Config({ model, tools, toolsContext, output, runtimeContext, prompt: 'Answer.' });

const streamer = create.LLMAgent.asStream({
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
		expectType<ModelMessage[]>(_event.response.messages);
		// @ts-expect-error SDK callback responses have no Casai history property.
		expectType<unknown>(_event.response.messageHistory);
		expectEqual<(typeof _event.staticToolResults)[number]['output'], number>();
		// @ts-expect-error Structured output stays typed in completion callbacks.
		expectType<string>(_event.output?.answer);
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

void streamer.run({ onEnd: _event => {
	expectType<number | undefined>(_event.output?.answer);
	// @ts-expect-error run() callbacks use the final configured tools.
	expectType<number>(_event.staticToolCalls[0].input.query);
} });
void create.LLMAgent({ onEnd: _event => {
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
create.LLMAgent({ tools: { extra }, prepareStep: () => ({ activeTools: ['lookup', 'extra'] as const }), onEnd: _event => {
	for (const call of _event.staticToolCalls) {
		if (call.toolName === 'extra') {
			expectType<number>(call.input.count);
			// @ts-expect-error Added tools do not widen the merged callback contract.
			expectType<string>(call.input.count);
		} else expectType<string>(call.input.query);
	}
} }, parent);
const replacement = create.Function.asTool({ inputSchema: z.object({ query: z.number() }), toolContextSchema: z.object({ factor: z.number() }), execute: ({ query }) => String(query) });
create.LLMAgent({ tools: { lookup: replacement }, onEnd: _event => {
	expectType<number>(_event.staticToolCalls[0].input.query);
	// @ts-expect-error Replaced tools change callback inputs.
	expectEqual<(typeof _event.staticToolCalls)[number]['input']['query'], string>();
} }, parent);

// Shared fragments preserve inline callback types before they become a component.
create.Config({ onEnd: _event => {
	// @ts-expect-error A child fragment retains inherited tools.
	expectType<number>(_event.staticToolCalls[0].input.query);
} }, parent);
const objectParent = create.Config({ model, output, prompt: 'Answer.' });
create.Config({ onEnd: _event => {
	expectEqual<typeof _event.output, { answer: number } | undefined>();
	// @ts-expect-error A schema-bearing fragment retains its object type.
	expectType<string>(_event.output?.answer);
} }, objectParent);

const objectGenerator = create.LLMAgent({ onEnd: _event => {
	expectEqual<typeof _event.output, { answer: number } | undefined>();
	// @ts-expect-error Generated objects follow the inherited schema.
	expectType<string>(_event.output?.answer);
} }, objectParent);
const objectStreamer = create.LLMAgent.asStream({ model, prompt: 'Answer.', onEnd: _event => {
	expectEqual<typeof _event.output, { answer: number } | undefined>();
	expectType<string>(_event.callId);
	// @ts-expect-error Streamed objects follow the schema and can be undefined.
	expectType<string>(_event.output?.answer);
}, output: Output.object({ schema: schema }) });
void objectStreamer.run({ onEnd: _event => {
	// @ts-expect-error run() retains the generated object's schema.
	expectType<string>(_event.output?.answer);
} });
create.LLMAgent.asStream({ model, onEnd: _event => {
	expectType<number | undefined>(_event.output?.[0].answer);
	// @ts-expect-error Array output wraps the schema's element type.
	expectType<string>(_event.output?.[0].answer);
}, output: Output.array({ element: schema }) });
create.LLMAgent({ model, onEnd: _event => {
	expectType<'red' | 'blue' | undefined>(_event.output);
	// @ts-expect-error Enum completion values retain their literal union.
	expectType<'green'>(_event.output);
}, output: Output.choice({ options: ['red', 'blue'] as const }) });
create.LLMAgent.asStream({ model, onEnd: _event => {
	// @ts-expect-error Schemaless JSON cannot be assumed to be a number.
	expectType<number>(_event.output);
}, output: Output.json() });
const annotatedObject: LLMAgentConfig<EmptyMap, EmptyMap, string, typeof output> & { model: LanguageModel } = { model, output, onEnd: _event => {
	// @ts-expect-error Exported config types specialize the same callback.
	expectType<string>(_event.output?.answer);
} };
create.LLMAgent(annotatedObject);
const arrayOutput = Output.array({ element: schema });
const annotatedArray: LLMAgentConfig<EmptyMap, EmptyMap, string, typeof arrayOutput> & { model: LanguageModel } = { model, output: arrayOutput, onEnd: _event => {
	// @ts-expect-error Exported array config types specialize the same callback.
	expectType<string>(_event.output?.[0].answer);
} };
create.LLMAgent.asStream(annotatedArray);

// Rendered and loaded factories share the same callback contracts.
create.LLMAgent.withTemplate({ model, tools, toolsContext, prompt: '{{ topic }}', onEnd: _event => {
	// @ts-expect-error Template rendering preserves tool input types.
	expectType<number>(_event.staticToolCalls[0].input.query);
} });
create.LLMAgent.withFunction.asStream({ model, prompt: () => 'Input.', onEnd: _event => {
	// @ts-expect-error Function prompts preserve schema types.
	expectType<string>(_event.output?.answer);
}, output: Output.object({ schema: schema }) });
create.LLMAgent.loadsText({ loader: new FileSystemLoader('tests'), onEnd: _event => {
	// @ts-expect-error Loaded prompts preserve schema types.
	expectType<string>(_event.output?.answer);
}, output: Output.object({ schema: schema }) }, create.Config({ model }));

// Invalid callback arguments and return values must fail at every entry point.
// @ts-expect-error Observer callbacks cannot return arbitrary values.
create.LLMAgent({ model, onEnd: () => 123 });
// @ts-expect-error A callback cannot require a different event type.
create.LLMAgent.asStream({ model, onChunk: (_event: number) => undefined });
// @ts-expect-error Stop conditions must return boolean, including async callbacks in arrays.
create.LLMAgent({ model, stopWhen: [async () => 'yes'] });
// @ts-expect-error Step preparation cannot enable nonexistent tools.
create.LLMAgent({ prepareStep: () => ({ activeTools: ['missing'] }) }, parent);
// @ts-expect-error run() retains callback return checking.
void streamer.run({ onEnd: async () => 123 });
// @ts-expect-error run() cannot prepare a step with invalid runtime context.
void streamer.run({ prepareStep: () => ({ runtimeContext: { requestId: 123 } }) });
// @ts-expect-error Nested input refiners cannot change tool input types.
void streamer.run({ experimental_refineToolInput: { lookup: () => ({ query: 123 }) } });
// @ts-expect-error Repair callbacks return a repaired tool call or null asynchronously.
create.LLMAgent({ model, repairToolCall: () => null });
// @ts-expect-error Object repair callbacks cannot return numbers.
create.LLMAgent({ model, repairText: async () => 123, output: Output.object({ schema: schema }) });
// @ts-expect-error Object observers cannot return arbitrary values.
create.LLMAgent.asStream({ model, onEnd: () => 123, output: Output.object({ schema: schema }) });
// @ts-expect-error Shared fragments check observer return values too.
create.Config({ onEnd: async () => 123 }, parent);
// SDK error observers may return ignored values because one overload returns void.
create.LLMAgent.asStream({ model, onError: () => 123 });

const inheritedFinish = create.LLMAgent({ model, onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); }, output: Output.object({ schema: schema }) });
// @ts-expect-error Replacing a schema must also replace an incompatible inherited callback.
create.LLMAgent({ output: Output.object({ schema: z.object({ label: z.string() }) }) }, inheritedFinish);
create.LLMAgent({ onEnd: _event => { expectType<string | undefined>(_event.output?.label); }, output: Output.object({ schema: z.object({ label: z.string() }) }) }, inheritedFinish);


// Exact optional consumer settings reject explicitly absent callbacks.
void objectStreamer.run({});
// @ts-expect-error Optional callbacks cannot require arbitrary event types.
void objectStreamer.run({ onEnd: (_event: number) => undefined });
const inheritedText = create.LLMAgent({ onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input']['query'], string>(); } }, parent);
// @ts-expect-error A tool replacement also requires replacing incompatible inherited callbacks.
create.LLMAgent({ tools: { lookup: replacement } }, inheritedText);

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
create.LLMAgent.asStream({
	onStart: _event => { expectEqual<typeof _event, TextEvent<'onStart'>>(); },
	onStepStart: _event => { expectEqual<typeof _event, TextEvent<'onStepStart'>>(); },
	onStepEnd: _event => { expectEqual<typeof _event, TextEvent<'onStepEnd'>>(); },
	onLanguageModelCallStart: _event => { expectEqual<typeof _event, TextEvent<'onLanguageModelCallStart'>>(); },
	onLanguageModelCallEnd: _event => { expectEqual<typeof _event, TextEvent<'onLanguageModelCallEnd'>>(); },
	onToolExecutionStart: _event => { expectEqual<typeof _event, TextEvent<'onToolExecutionStart'>>(); },
	onToolExecutionEnd: _event => { expectEqual<typeof _event, TextEvent<'onToolExecutionEnd'>>(); },
	onError: _event => { expectEqual<typeof _event.error, unknown>(); return { retry: true }; },
	repairToolCall: async _options => {
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

void objectStreamer.run({ onError: _event => { expectEqual<typeof _event.error, unknown>(); } });
void objectGenerator.run({ onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } });

// Nested telemetry callbacks retain the SDK's own broad event contracts.
create.LLMAgent({ model, telemetry: { integrations: {
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
create.LLMAgent.asStream({ model, telemetry: { integrations: [{
	onError: _error => { expectEqual<typeof _error, unknown>(); },
	executeTool: _options => _options.execute(),
}] }, output: Output.object({ schema: schema }) });

// Native test hooks and retired settings are absent from Casai configuration.
// @ts-expect-error Test hooks belong to the SDK internals.
create.LLMAgent({ model, _internal: { now: () => 0 } });
// @ts-expect-error Retired observer aliases are only accepted by native Agent entry points.
create.LLMAgent({ model, onFinish: () => { /* unsupported observer */ } });
// @ts-expect-error Telemetry uses its current native setting name.
create.LLMAgent({ model, experimental_telemetry: {} });

// PromiseLike return support follows each SDK callback's declared contract.
declare const voidThenable: PromiseLike<void>;
declare const booleanThenable: PromiseLike<boolean>;
create.LLMAgent({ model, onEnd: () => voidThenable, stopWhen: () => booleanThenable });
create.LLMAgent.asStream({ model, onEnd: () => voidThenable, output: Output.object({ schema: schema }) });
void objectStreamer.run({ onError: () => voidThenable });
// @ts-expect-error Text-repair callbacks specifically require a full Promise.
create.LLMAgent({ model, repairText: () => ({ then: () => undefined }), output: Output.object({ schema: schema }) });
// The SDK text error handler union contains plain void, permitting ignored sync/async returns.
create.LLMAgent.asStream({ model, onError: async () => 123 });
// @ts-expect-error Generic telemetry wrappers must preserve the execute callback's result type.
create.LLMAgent({ model, telemetry: { integrations: { executeTool: async () => 123 } } });

// Every callback family checks return types, including aliases and nested functions.
// @ts-expect-error Lifecycle observers return void or PromiseLike<void>.
create.LLMAgent({ model, onStart: () => 123 });
// @ts-expect-error Deprecated lifecycle aliases retain return checking.
create.LLMAgent({ model, onStart: async () => 123 });
// @ts-expect-error Step-start observers cannot return values.
create.LLMAgent({ model, onStepStart: () => 'start' });
// @ts-expect-error Step-completion observers cannot return values.
create.LLMAgent({ model, onStepEnd: async () => true });
// @ts-expect-error Model-call observers cannot return values.
create.LLMAgent({ model, onLanguageModelCallStart: () => 123 });
// @ts-expect-error Parsed model-response observers cannot return values.
create.LLMAgent({ model, onLanguageModelCallEnd: async () => 123 });
// @ts-expect-error Tool-execution observers cannot return values.
create.LLMAgent({ model, onToolExecutionStart: () => 123 });
// @ts-expect-error Tool-execution completion observers cannot return values.
create.LLMAgent.asStream({ onToolExecutionEnd: async () => 123 }, parent);
// @ts-expect-error Chunk observers cannot return arbitrary values.
void streamer.run({ onChunk: async () => 123 });
// @ts-expect-error Abort observers cannot return arbitrary values.
void streamer.run({ onAbort: () => 123 });
// @ts-expect-error A stop condition must return a boolean.
void streamer.run({ stopWhen: () => 123 });
// @ts-expect-error Step preparation rejects an invalid tool choice.
void streamer.run({ prepareStep: () => ({ toolChoice: { type: 'tool', toolName: 'missing' } }) });
// @ts-expect-error Transform callbacks must produce a TransformStream.
void streamer.run({ experimental_transform: [() => 123] });
// @ts-expect-error Transforms preserve the SDK event stream's input and output element types.
void streamer.run({ experimental_transform: () => new TransformStream<string, number>() });
// @ts-expect-error Download callbacks return downloaded binary data or null.
create.LLMAgent({ model, experimental_download: async () => [{ data: 'text', mediaType: 'text/plain' }] });
// @ts-expect-error Tool approval callbacks return a valid approval status.
void streamer.run({ toolApproval: { lookup: () => true } });
// @ts-expect-error Generic tool approval callbacks return a valid approval status.
create.LLMAgent({ toolApproval: () => 123 }, parent);
// @ts-expect-error Refiners must reference a configured tool.
void streamer.run({ experimental_refineToolInput: { missing: () => ({ query: 'input' }) } });
// @ts-expect-error Extra refiner keys cannot hide alongside valid configured keys.
void streamer.run({ experimental_refineToolInput: { lookup: input => input, missing: () => ({ query: 'input' }) } });
// @ts-expect-error Approval maps can only configure existing tools.
void streamer.run({ toolApproval: { lookup: 'approved', missing: 'approved' } });
// @ts-expect-error Factory input-refinement maps only accept configured tool names.
create.LLMAgent({ experimental_refineToolInput: { lookup: input => input, missing: () => ({ query: 'input' }) } }, parent);
// @ts-expect-error Shared fragments cannot retain an unknown refiner key.
create.Config({ experimental_refineToolInput: { lookup: input => input, missing: () => ({ query: 'input' }) } }, parent);
// @ts-expect-error Standalone factories reject extra approval-map names.
create.LLMAgent({ model, tools, toolsContext, toolApproval: { lookup: 'approved', missing: 'approved' } });
// @ts-expect-error Shared fragments reject extra approval-map names.
create.Config({ toolApproval: { lookup: 'approved', missing: 'approved' } }, parent);
declare const refiners: { lookup?: (input: { query: string }) => PromiseLike<{ query: string }> };
void streamer.run({ experimental_refineToolInput: refiners });
create.LLMAgent({ experimental_refineToolInput: refiners }, parent);
declare const approval: NonNullable<TextSDK['toolApproval']>;
void streamer.run({ toolApproval: approval });
type LookupApproval = Exclude<NonNullable<TextSDK['toolApproval']>, Callback>['lookup'];
declare const optionalApprovalCallbacks: { lookup?: Extract<LookupApproval, Callback> };
declare const optionalApprovalStatuses: { lookup?: Exclude<LookupApproval, Callback> };
create.LLMAgent({ model, tools, toolsContext, runtimeContext, toolApproval: optionalApprovalCallbacks });
create.LLMAgent({ model, tools, toolsContext, runtimeContext, toolApproval: optionalApprovalStatuses });
const deferredOptionalCallbacks = create.Config({ toolApproval: optionalApprovalCallbacks });
const deferredOptionalStatuses = create.Config({ toolApproval: optionalApprovalStatuses });
create.LLMAgent.asStream({ model, tools, toolsContext, runtimeContext }, deferredOptionalCallbacks);
create.LLMAgent.asStream({ model, tools, toolsContext, runtimeContext }, deferredOptionalStatuses);
void streamer.run({ toolApproval: optionalApprovalCallbacks });
void streamer.run({ toolApproval: optionalApprovalStatuses });
// The SDK approval-status union explicitly includes undefined, including in exact consumers.
void streamer.run({ toolApproval: { lookup: undefined } });
create.LLMAgent({ model, tools, toolsContext, toolApproval: { lookup: undefined } });
const deferredRefiners = create.Config({ experimental_refineToolInput: { lookup: (input: { query: string }) => input } });
create.LLMAgent({ model, tools, toolsContext }, deferredRefiners);
// @ts-expect-error Deferred refiner names must exist in the consuming component's final tools.
create.LLMAgent({ model, tools: { extra } }, deferredRefiners);
// @ts-expect-error Deferred refiners must match the consuming tool's input type.
create.LLMAgent({ model, tools: { lookup: replacement }, toolsContext }, deferredRefiners);
const deferredApproval = create.Config({ toolApproval: { lookup: 'approved' as const } });
create.LLMAgent.asStream({ model, tools, toolsContext }, deferredApproval);
// @ts-expect-error Deferred approval names must exist in the consuming component's final tools.
create.LLMAgent.asStream({ model, tools: { extra } }, deferredApproval);
const deferredApprovalCallback = create.Config({ toolApproval: { lookup: (input: { query: string }) => input.query ? 'approved' : 'denied' } });
create.LLMAgent({ model, tools, toolsContext }, deferredApprovalCallback);
// @ts-expect-error Deferred approval callback inputs must match the eventual tool schema.
create.LLMAgent({ model, tools: { lookup: replacement }, toolsContext }, deferredApprovalCallback);
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
create.LLMAgent({ model, experimental_download: async (_requests: string) => [], output: Output.object({ schema: schema }) });
// @ts-expect-error Object lifecycle observers cannot return arbitrary values.
create.LLMAgent({ model, onStepEnd: async () => 123, output: Output.object({ schema: schema }) });
// @ts-expect-error Object repair callbacks must return a promise.
void objectGenerator.run({ experimental_repairText: () => null });
// @ts-expect-error Telemetry callbacks retain nested return validation.
create.LLMAgent({ model, telemetry: { integrations: { onError: () => 123 } } });
void objectStreamer.run({ onError: () => 123 });

// Every prompt factory overload supplies the same inferred callback context.
const loader = new FileSystemLoader('tests');
create.LLMAgent.withText({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withTemplate({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withScript({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.loadsText({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.loadsTemplate({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.loadsScript({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withFunction({ prompt: () => 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withText.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withTemplate.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withScript.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.loadsText.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.loadsTemplate.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.loadsScript.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withFunction.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: () => 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withText.asStream({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withTemplate.asStream({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withScript.asStream({ prompt: 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.loadsText.asStream({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.loadsTemplate.asStream({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.loadsScript.asStream({ prompt: 'input', loader, onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withFunction.asStream({ prompt: () => 'input', onEnd: _event => { expectEqual<(typeof _event.staticToolCalls)[number]['input'], { query: string }>(); } }, parent);
create.LLMAgent.withText({ prompt: 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withTemplate({ prompt: 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withScript({ prompt: 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.loadsText({ prompt: 'input', loader, onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.loadsTemplate({ prompt: 'input', loader, onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.loadsScript({ prompt: 'input', loader, onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withFunction({ prompt: () => 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withText.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withTemplate.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withScript.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.loadsText.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.loadsTemplate.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.loadsScript.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: 'input', loader, onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withFunction.asTool({ inputSchema: z.object({ topic: z.string() }), prompt: () => 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withText.asStream({ prompt: 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withTemplate.asStream({ prompt: 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withScript.asStream({ prompt: 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.loadsText.asStream({ prompt: 'input', loader, onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.loadsTemplate.asStream({ prompt: 'input', loader, onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.loadsScript.asStream({ prompt: 'input', loader, onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);
create.LLMAgent.withFunction.asStream({ prompt: () => 'input', onEnd: _event => { expectEqual<typeof _event.output, { answer: number } | undefined>(); } }, objectParent);

// SDK public lifecycle hooks are singular; arrays belong to stop conditions, transforms, and telemetry integrations.
// @ts-expect-error Completion observers cannot be supplied as callback arrays.
void streamer.run({ onEnd: [() => undefined] });
// @ts-expect-error Tool-execution observers cannot be supplied as callback arrays.
create.LLMAgent({ model, onToolExecutionStart: [() => undefined] });
create.LLMAgent({ model, telemetry: { integrations: [{
	onStart: _event => { expectEqual<typeof _event, Parameters<NonNullable<Telemetry['onStart']>>[0]>(); },
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
create.LLMAgent({ model, telemetry: { integrations: [{ onError: () => undefined }, { onStepEnd: async () => 123 }] } });
// @ts-expect-error Model-call wrappers preserve the generic execute result, including inside arrays.
create.LLMAgent({ model, telemetry: { integrations: [{ executeLanguageModelCall: async () => 'response' }] } });
// @ts-expect-error Step observers are contravariant even though SDK operation-level telemetry observers are bivariant.
create.LLMAgent({ model, telemetry: { integrations: [{ onStepEnd: (_event: { text: 'only-this-text' }) => undefined }] } });

// Tool names and dynamic flags narrow heterogeneous callback inputs and tool-result/error unions.
create.LLMAgent.asStream({ model, tools: { lookup, extra }, toolsContext, onToolExecutionStart: ({ toolCall }) => {
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
create.LLMAgent({ model, tools: { lookup, extra }, toolsContext, onToolExecutionStart: (_event: { toolCall: { toolName: 'lookup', input: { query: string } } }) => undefined });
void streamer.run({ repairToolCall: async ({ toolCall, inputSchema }) => {
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
create.LLMAgent.asStream({ model, onEnd: _event => {
	expectEqual<typeof _event.output, Variant | undefined>();
	const object = _event.output;
	if (object?.kind === 'count') {
		expectEqual<typeof object.value, number>();
		// @ts-expect-error Object callbacks expose parsed values rather than transform inputs.
		expectType<string>(object.value);
	} else if (object) expectEqual<typeof object.value, string>();
}, output: Output.object({ schema: variantSchema }) });
create.LLMAgent.asStream({ model, output: Output.object({ schema: variantSchema }), onEnd: _event => {
	expectEqual<typeof _event.output, Variant | undefined>();
	const object = _event.output;
	if (object?.kind === 'count') expectEqual<typeof object.value, number>();
} });
// @ts-expect-error A completion observer cannot require only one possible schema union member.
create.LLMAgent({ model, onEnd: (_event: { output?: Extract<Variant, { kind: 'count' }> }) => undefined, output: Output.object({ schema: variantSchema }) });

// Tool selection settings always use the final tools, including inheritance, fragments, and run overrides.
create.LLMAgent({ activeTools: ['lookup'], toolChoice: { type: 'tool', toolName: 'lookup' }, toolOrder: ['lookup'] }, parent);
void streamer.run({ activeTools: ['lookup'], toolChoice: 'auto', toolOrder: ['lookup'] });
void streamer.run({ activeTools: [], toolChoice: 'none', toolOrder: [] });
create.Config({ activeTools: ['lookup'], toolChoice: { type: 'tool', toolName: 'lookup' }, toolOrder: ['lookup'] }, parent);
// @ts-expect-error Inherited active-tools lists cannot name an unconfigured tool.
create.LLMAgent({ activeTools: ['missing'] }, parent);
// @ts-expect-error Inherited tool-choice objects cannot name an unconfigured tool.
create.LLMAgent.asStream({ toolChoice: { type: 'tool', toolName: 'missing' } }, parent);
// @ts-expect-error Inherited tool ordering cannot name an unconfigured tool.
create.LLMAgent({ toolOrder: ['lookup', 'missing'] }, parent);
// @ts-expect-error Config fragments with known tools validate active-tool names immediately.
create.Config({ activeTools: ['missing'] }, parent);
// @ts-expect-error Config fragments with known tools validate tool-choice names immediately.
create.Config({ toolChoice: { type: 'tool', toolName: 'missing' } }, parent);
// @ts-expect-error Config fragments with known tools validate ordering names immediately.
create.Config({ toolOrder: ['missing'] }, parent);
// @ts-expect-error run() cannot enable an unconfigured tool.
void streamer.run({ activeTools: ['missing'] });
// @ts-expect-error run() cannot select an unconfigured tool.
void streamer.run({ toolChoice: { type: 'tool', toolName: 'missing' } });
// @ts-expect-error run() cannot order an unconfigured tool.
void streamer.run({ toolOrder: ['missing'] });
// @ts-expect-error Standalone selection validation must not widen a concrete tool map.
create.LLMAgent({ model, tools, toolsContext, activeTools: ['missing'] });
// @ts-expect-error Standalone tool-choice validation must not widen a concrete tool map.
create.LLMAgent({ model, tools, toolsContext, toolChoice: { type: 'tool', toolName: 'missing' } });
// @ts-expect-error Standalone ordering validation must not widen a concrete tool map.
create.LLMAgent.asStream({ model, tools, toolsContext, toolOrder: ['missing'] });
const deferredSelection = create.Config({ activeTools: ['lookup'] as const, toolChoice: { type: 'tool', toolName: 'lookup' } as const, toolOrder: ['lookup'] as const });
create.LLMAgent({ model, tools, toolsContext }, deferredSelection);
// @ts-expect-error A deferred selection must refer to tools in the consuming component.
create.LLMAgent({ model, tools: { extra } }, deferredSelection);
const selectedParent = create.Config({ tools, toolsContext, activeTools: ['lookup'] as const });
// @ts-expect-error An invalid selector inherited from an annotated provider must be checked too.
create.LLMAgent({ model }, { config: { tools, toolsContext, toolOrder: ['missing'] as const } });
create.LLMAgent({ model, tools: { extra }, activeTools: ['lookup', 'extra'], toolOrder: ['extra', 'lookup'] }, selectedParent);
declare const unknownSelection: readonly string[];
// @ts-expect-error A broad string list cannot guarantee that each selected tool exists.
void streamer.run({ activeTools: unknownSelection });
// @ts-expect-error Deferred fragments still reject malformed active-tools values before tools are supplied.
create.Config({ activeTools: 123 });
// @ts-expect-error Deferred fragments still reject malformed tool-choice values before tools are supplied.
create.Config({ toolChoice: 'missing' });
// @ts-expect-error Deferred fragments still require string tool-order names before tools are supplied.
create.Config({ toolOrder: [123] });

// Inline configured runtime values are defaults; later runs and steps retain their value types.
const inlineRuntime = create.LLMAgent({
	model, prompt: 'Answer.',
	runtimeContext: { requestId: 'initial', retry: 0, details: { enabled: true }, labels: ['initial'], now: new Date(), format: (value: number) => String(value) },
	onStart: _event => {
		expectEqual<typeof _event.runtimeContext.requestId, string>();
		expectEqual<typeof _event.runtimeContext.retry, number>();
		expectEqual<typeof _event.runtimeContext.details.enabled, boolean>();
		expectEqual<typeof _event.runtimeContext.labels[number], string>();
		expectEqual<typeof _event.runtimeContext.now, Date>();
		expectEqual<typeof _event.runtimeContext.format, (value: number) => string>();
	},
	prepareStep: () => ({ runtimeContext: { requestId: 'next', retry: 1, details: { enabled: false }, labels: ['next', 'again'], now: new Date(), format: value => String(value) } }),
});
void inlineRuntime.run({ runtimeContext: { requestId: 'next', retry: 2, details: { enabled: false }, labels: [], now: new Date(), format: value => String(value) } });
void inlineRuntime.run({ prepareStep: _options => {
	expectEqual<typeof _options.runtimeContext.requestId, string>();
	return { runtimeContext: { requestId: 'later', retry: 3, details: { enabled: false }, labels: ['later'], now: new Date(), format: value => String(value) } };
} });
// @ts-expect-error Widened runtime defaults retain their original value kinds.
void inlineRuntime.run({ runtimeContext: { requestId: 123, retry: 1, details: { enabled: false }, labels: [], now: new Date(), format: String } });
// @ts-expect-error Nested runtime defaults still enforce their field types.
void inlineRuntime.run({ prepareStep: () => ({ runtimeContext: { requestId: 'next', retry: 1, details: { enabled: 'yes' }, labels: [], now: new Date(), format: String } }) });
const inlineRuntimeStream = create.LLMAgent.asStream({ model, prompt: 'Answer.', runtimeContext: { requestId: 'initial' } });
void inlineRuntimeStream.run({ runtimeContext: { requestId: 'next' }, onEnd: _event => { expectEqual<typeof _event.runtimeContext.requestId, string>(); } });

// Incomplete fragments use the native event with unknown parsed output.
type FragmentFinish = StreamTextOnFinishEvent<EmptyMap, import('ai').OutputInterface<unknown, unknown, unknown>>;
const sharedFinish = create.Config({ onEnd: _event => {
	expectEqual<typeof _event, FragmentFinish>();
	expectEqual<typeof _event.output, unknown>();
	expectEqual<typeof _event.text, string>();
	// @ts-expect-error A fragment cannot assume the output selected by its consumer.
	expectType<{ answer: number }>(_event.output);
} });
create.LLMAgent({ model }, sharedFinish);
create.LLMAgent.asStream({ model }, sharedFinish);
create.LLMAgent({ model, output }, sharedFinish);
create.LLMAgent.asStream({ model, output }, sharedFinish);

// Explicit runtime-context unions keep their discriminants and correlated payloads.
type RuntimeVariant = { kind: 'count', value: number } | { kind: 'label', value: string };
declare const discriminatedRuntime: RuntimeVariant;
const variantRuntimeGenerator = create.LLMAgent({ model, prompt: 'Answer.', runtimeContext: discriminatedRuntime, onStart: _event => {
	const context = _event.runtimeContext;
	expectEqual<typeof context, RuntimeVariant>();
	if (context.kind === 'count') expectEqual<typeof context.value, number>();
	else expectEqual<typeof context.value, string>();
} });
void variantRuntimeGenerator.run({ runtimeContext: { kind: 'count', value: 2 } });
void variantRuntimeGenerator.run({ prepareStep: () => ({ runtimeContext: { kind: 'label' as const, value: 'next' } }) });
// @ts-expect-error Annotated runtime contexts retain their allowed discriminants.
void variantRuntimeGenerator.run({ runtimeContext: { kind: 'other', value: 2 } });
// @ts-expect-error Runtime-context payloads stay correlated with their discriminants.
void variantRuntimeGenerator.run({ prepareStep: () => ({ runtimeContext: { kind: 'count', value: 'wrong' } }) });
const variantRuntimeParent = create.Config({ model, prompt: 'Answer.', runtimeContext: discriminatedRuntime });
void create.LLMAgent.asStream({}, variantRuntimeParent).run({ runtimeContext: { kind: 'label', value: 'next' }, onEnd: _event => {
	expectEqual<typeof _event.runtimeContext, RuntimeVariant>();
} });
// @ts-expect-error Inherited annotated runtime-context unions are not widened to unrelated tags.
void create.LLMAgent.asStream({}, variantRuntimeParent).run({ runtimeContext: { kind: 'other', value: 2 } });

// Structural parents infer mutable runtime defaults just like Config-created parents.
const structuralRuntimeGenerator = create.LLMAgent.withTemplate({ prompt: 'Answer.' }, { config: { model, runtimeContext: { requestId: 'initial' } } });
void structuralRuntimeGenerator.run({ runtimeContext: { requestId: 'next' } });
const structuralRuntimeStreamer = create.LLMAgent.withTemplate.asStream({ prompt: 'Answer.' }, { config: { model, runtimeContext: { requestId: 'initial' } } });
void structuralRuntimeStreamer.run({ runtimeContext: { requestId: 'next' } });
create.LLMAgent.withTemplate({ prompt: 'Answer.' }, { config: { model, tools, toolsContext, runtimeContext: { requestId: 'initial' }, activeTools: ['lookup'], toolChoice: { type: 'tool', toolName: 'lookup' }, toolOrder: ['lookup'] } });
create.LLMAgent.withTemplate.asStream({ prompt: 'Answer.' }, { config: { model, tools, toolsContext, runtimeContext: { requestId: 'initial' }, activeTools: ['lookup'], toolChoice: { type: 'tool', toolName: 'lookup' }, toolOrder: ['lookup'] } });
create.LLMAgent.withTemplate({ prompt: 'Answer.', tools: { extra } }, { config: { model, tools, toolsContext, activeTools: ['lookup', 'extra'], toolOrder: ['extra', 'lookup'] } });
// @ts-expect-error Structural parent selector inference cannot admit unknown tool names.
create.LLMAgent.withTemplate.asStream({ prompt: 'Answer.' }, { config: { model, tools, toolsContext, activeTools: ['missing'] } });
// @ts-expect-error Structural parent defaults still retain their value kinds.
void structuralRuntimeStreamer.run({ runtimeContext: { requestId: 123 } });
