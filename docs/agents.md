# Agent component implementation design

Status: agreed design, awaiting implementation. The [README](../README.md#agent-and-streamingagent) defines the user-facing API. This note records implementation decisions that are not apparent from the examples. The SDK reference for this design is the installed `ai@7.0.130`; use its exported types and source when online documentation differs.

## Two entry paths, one default operation

Build both factories on one agent-component implementation, parameterized by `generate` or `stream`. The default affects the callable and `.run()` only. Both components expose both native SDK methods.

```text
component(...Casai arguments) / component.run(overrides)
  -> validate call-time input and resolve inherited configuration
  -> render/load the prompt and assemble Casai message history
  -> split SDK settings from SDK call arguments
  -> ToolLoopAgent.generate / ToolLoopAgent.stream
  -> augment the result using Casai's text-result conventions

component.generate(SDK arguments) / component.stream(SDK arguments)
  -> configured SDK agent, with the explicit SDK arguments
  -> native SDK result
```

Native methods intentionally bypass Casai preparation, including configured prompt/message insertion and result augmentation. They still use the SDK-compatible portion of the resolved factory configuration and execute SDK validation, `prepareCall`, and lifecycle hooks. Do not silently render native `prompt` strings as templates or infer rendering context from native `options`.

SDK UI helpers call the native `.stream()` method with a converted conversation. They must preserve that conversation, including tool results and approval messages, without automatically adding the component's configured Casai prompt. Native `prompt` and `messages` remain mutually exclusive.

## Reuse the existing Casai contracts

Reuse factory modifiers, parent configuration resolution, call parsing, validators, prompt renderers, and `.asTool` adaptation. Provide the factories through both the named exports and `create`; update `Config` fragment validation/inference to accept agent settings.

The current `src/llm-component.ts` uses SDK function identity checks to select message handling and result augmentation. Merely passing a bound agent method into that implementation would skip these behaviors. Extract explicit preparation and result-adaptation operations, or introduce an explicit backend capability descriptor, while retaining the existing text component behavior.

Input validation uses the raw call-time context, before configured context is merged. Preserve schema input types, required arguments, and the existing validation-only semantics of ordinary calls. Configured defaults cannot satisfy required input-schema fields. A field named `prompt` in a context object remains data. Function prompts keep their context-only callable and function-valued `.run({ prompt })` override.

Casai `context`, SDK `runtimeContext`, and SDK `toolsContext` remain distinct. Rendering context is not implicitly sent to tools or exposed as SDK runtime context. Follow the existing shallow map merges, scalar/object replacement, loader resolution, and message concatenation rules.

Casai history assembly remains: configured messages, then dynamic history, then the rendered or literal prompt. Compose this into one SDK prompt/messages argument. Returned Casai `response.messages` represents the current turn, and `response.messageHistory` includes the dynamic input history while excluding configured static messages. Preserve the corresponding streaming finish-event augmentation. Native methods return the SDK's unmodified history fields.

`Agent.asTool` keeps the `TextGenerator.asTool` contract: direct invocation returns the full result, and tool execution resolves to `.text`. Reuse `_toolCallOptions` and tool-context validation. `StreamingAgent` has no tool adapter. Structured generation remains available through the SDK `output` setting and the direct result; it does not change the text tool adapter's return type.

## Isolate each invocation's SDK settings

An SDK agent's call parameters are not the same as `generateText` or `streamText` settings. In particular, the public agent call type does not expose arbitrary overrides such as `temperature` or `model`. Do not cast a merged Casai run configuration to SDK call parameters or depend on undocumented forwarding of extra properties.

Resolve the effective Casai configuration for each invocation, then create a `ToolLoopAgent` with its effective SDK settings. Pass only SDK call arguments to `.generate()` or `.stream()`. Cache compiled renderers independently; constructing an SDK agent does not require recompiling the prompt. Keep a separately configured SDK delegate for the native methods if useful.

Do not mutate shared SDK settings, `.config`, or the public `.tools` map for a run override. Snapshot request history consistently before asynchronous validation/rendering, as the existing components do. Concurrent runs must not exchange overrides or dynamic history.

For Casai calls, resolve callback overrides with Casai's configuration merge policy before installing them on the invocation's agent. Do not also pass the same callback as a call-level callback: the SDK merges configured and call-level callbacks, which would execute it twice. Native methods keep that SDK callback-composition behavior.

`prepareCall` runs inside the SDK after Casai has prepared the request; `prepareStep` remains the per-step SDK hook. Rendering is performed once per invocation, not once per tool-loop step. Preserve abort signals, timeouts, streaming transforms, and the SDK's agent-specific options where supported by its public types.

## Custom SDK call options

Keep SDK `CALL_OPTIONS` separate from Casai input inferred from `inputSchema`. Infer it from `callOptionsSchema`, defaulting to `never` when no custom options contract exists. Native methods and UI helpers use the SDK's `options` argument without reinterpretation.

Casai already uses configuration `options` for Cascada. Use the distinct advanced setting `callOptions` in agent configuration and `.run()` to supply SDK call options after Casai preparation. It follows ordinary whole-value replacement, not context-map merging. Never populate it automatically from rendering context.

```typescript
// Assumes an agent whose SDK callOptionsSchema requires an accountId.
await agent.run({
  context: { topic: 'battery recycling' },
  callOptions: { accountId: 'example-account' },
});

// Native equivalent for SDK-ready input; Casai rendering does not run.
await agent.generate({
  prompt: 'Research battery recycling.',
  options: { accountId: 'example-account' },
});
```

When the SDK type requires call options, a Casai callable needs configured `callOptions`; otherwise callers must use `.run()` and provide them. Enforce this in types and reject missing required options before model execution. Configured `callOptions` belong only to Casai invocation: native methods retain the SDK signature and require their own explicit `options`. This keeps SDK interoperability independent of Casai defaults. `callOptionsSchema` is a creation-time contract and cannot change through `.run()`.

## Types, metadata, and results

Extend the actual SDK `Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>` interface with the appropriate Casai call signatures, `.run()`, `.config`, and component metadata. Use type-only imports. Do not reproduce a simplified SDK interface or hard-code rendering context as `RUNTIME_CONTEXT`.

Infer tools, SDK runtime context, structured output, and callback arguments from the final merged configuration, following the existing text components. `.run()` must preserve the fixed output and schema contracts and constrain tool overrides to the existing tool signatures. `inputSchema`, `callOptionsSchema`, `contextSchema`, `output`, `promptType`, and renderer setup cannot change per invocation.

Expose `readonly version: 'agent-v1'`, `readonly id: string | undefined`, and `readonly tools: TOOLS`. Normalize an absent tools map to `{}` so SDK helpers can inspect it. Delegate through arrow wrappers or bound methods; assigning unbound SDK instance methods would lose their receiver.

Casai `Agent` calls return promises of augmented generation results. Casai `StreamingAgent` calls return promises of augmented streaming results, even for plain text, because the SDK agent performs asynchronous preparation. Preserve lazy streaming and never drain a stream to assemble the initial result. Both native methods retain their SDK result types and `PromiseLike` signatures.

Agent instances do not retain conversation history across calls. The SDK owns tool-loop termination and its default `stopWhen`; Casai does not add a second loop or a competing step limit. Keep SDK instructions in `instructions`; prompt modifiers affect only the Casai `prompt` source.

## Focused implementation verification

Use mock models and register new mock-only test files in `test:local`. Cover these behavior boundaries:

- Both factories' default operations, with native generation and streaming available on either; awaitable plain-text streaming.
- Existing modifier, loader, inheritance, schema-input, prompt-override, and function-prompt contracts.
- Multi-step tool execution, stopping conditions, structured output, and the final-text tool adapter.
- Native methods bypassing Casai rendering, validation, history insertion, and augmentation; SDK hooks still execute.
- `createAgentUIStreamResponse` compatibility for both factories, preserving the supplied conversation.
- Concurrent `.run()` calls with different settings and history; callbacks execute once on the Casai path and retain native composition on the SDK path.
- Required custom call options, their separate configuration/run mapping, and native options independence.
- Type assignability to the real SDK agent interface, required Casai inputs, inherited tool/output/runtime-context inference, and invalid run overrides.

Run the focused mock tests and the existing type-checking workflow. These contracts do not require paid LLM tests.
