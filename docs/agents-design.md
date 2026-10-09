# Agent API and Specialized Components: Design and Implementation

Status: agreed design, awaiting implementation. [README.md](../README.md#agents-with-asagent) describes Phase 1: `.asAgent` on the existing Text/Object factories. [README2.md](../README2.md) describes Phase 2: `Agent` and `StreamingAgent` without `.asAgent`. These two phases use the same language-generation core. [Phase 3](#phase-3-specialized-components) adds decisions, embeddings, reranking, images, transcription, speech, and voice sessions. This filename distinguishes the design note from repository `AGENTS.md` instructions.

The Phase 2 factory names are `Agent` and `StreamingAgent`. Phase 1 retains `.asAgent` as an addition to the existing factories. Casai is in active development with demos that can be rewritten; Phase 2 does not need to preserve the Phase 1 public surface through compatibility aliases or staged deprecation.

The SDK reference is the installed `ai@7.0.130`. Use its exported types and source when online examples differ.

## Decide the Core Now

Implement the SDK's basic `Agent` interface in Casai, with a shared execution core backed directly by `generateText` and `streamText`. Do not use `ToolLoopAgent` as the backend. The SDK supports custom implementations of the [Agent contract](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent); it does not require that class or any particular step count.

Both SDK functions already execute model/tool loops and parse structured output. Casai owns configuration, preparation, interface adaptation, and result augmentation. The SDK owns model requests, tool execution, termination, output parsing, stream delivery, and cancellation. There is no Casai implementation of the tool loop.

Direct execution also preserves streaming settings such as `onChunk`, `onError`, and `onAbort`, which are not exposed by the installed `ToolLoopAgent` settings type. Preserve their actual `streamText` behavior and types instead of emulating them through an agent lifecycle callback.

Using `ToolLoopAgent` with `isStepCount(1)` would be valid and would not add an extra model step; the class itself delegates to these same SDK functions. The direct backend is selected for access to the full function settings and control over Casai preparation. Casai consequently owns custom call-option validation, `prepareCall`, and callback composition, which the class would otherwise provide.

## Phase 1: Add `.asAgent` and Build the Shared Core

Add `.asAgent` to `TextGenerator`, `TextStreamer`, `ObjectGenerator`, and `ObjectStreamer`. Their ordinary forms retain their current behavior during this phase. Extract and reuse Casai argument parsing, configuration resolution, prompt preparation, and history augmentation. Build one core with explicit generation and streaming operations backed by `generateText` and `streamText`, keeping output selection independent of execution mode.

Each `.asAgent` component is callable, has `.run()` and `.config`, and implements both native SDK methods. Support `.withText` (the default), `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, and `.loadsScript`, with `.asAgent` after the prompt modifier. For generators, optional `.asTool` comes last, as in `create.ObjectGenerator.withTemplate.asAgent.asTool(config, parent)`.

| Phase 1 factory | Output configuration | Callable and `.run()` |
| :--- | :--- | :--- |
| `TextGenerator.asAgent` | Default `Output.text()`; preserve an explicitly configured SDK `output` | Generate |
| `TextStreamer.asAgent` | Default `Output.text()`; preserve an explicitly configured SDK `output` | Stream |
| `ObjectGenerator.asAgent` | Translate existing schema/output modes to SDK `Output` | Generate |
| `ObjectStreamer.asAgent` | Translate existing schema/output modes to SDK `Output` | Stream |

`.asAgent` supplies `isStepCount(20)` only if no stopping condition was supplied or inherited. Explicit conditions and `.run()` overrides take precedence. Generator tool adaptation retains the family convention: Text tool execution returns `.text`; Object tool execution returns the parsed output. Direct invocation returns the complete result. Streaming factories have no `.asTool`.

Implement the Casai and native entry paths below, including isolated invocation settings and full SDK results. Object variants can be implemented first, followed by the thin Text variants. Phase 1 is complete when all four share the core and pass the Casai and SDK interoperability checks; it does not require publishing the Phase 2 factories early.

## Phase 2: Expose `Agent` / `StreamingAgent`

Expose both factories through named exports and `create`. Each returned component is callable, has `.run()` and `.config`, and implements the SDK's native `Agent` interface. The factory selects the default operation only:

| Factory | Callable and `.run()` | Native `.generate()` | Native `.stream()` |
| :--- | :--- | :--- | :--- |
| `Agent` | Generate | Generate | Stream |
| `StreamingAgent` | Stream | Generate | Stream |

Support `.withText` (the default), `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, and `.loadsScript`. Keep configuration inheritance, call parsing, schemas, history, and override isolation. There is no `.asAgent` modifier on the final factories.

The `output` setting selects text, object, array, choice, or JSON. Normalize an omitted value to `Output.text()` at runtime and in inferred types. Text and structured output share the same engine and result family.

`Agent.asTool` and combinations such as `Agent.withTemplate.asTool` return the configured `.output` from tool execution, including a string for text. Direct invocation returns the complete result. An agent exposed as a tool can itself use tools and `stopWhen`. Reuse tool context validation and `_toolCallOptions`; `StreamingAgent` has no `.asTool` modifier.

Replace the Phase 1 Text/Object factory surface as part of this development change, updating demos, exports, types, tests, and documentation together. No public migration layer is required. Preserve explicit or inherited stopping conditions in demos; add `isStepCount(20)` where a demo relied on Phase 1's `.asAgent` fallback. Phase 2 is complete when both final factories, all supported output kinds, prompt modifiers, tool adaptation, and SDK helper integration use the Phase 1 core.

## Loop Policy Is Separate from the Interface

For the new core, resolve inherited and local settings before selecting a fallback:

- Phase 1 `.asAgent` components: `isStepCount(20)` if no stopping condition was supplied or inherited.
- Phase 2 `Agent` and `StreamingAgent`: `isStepCount(1)` if no stopping condition was supplied or inherited.
- Explicit configuration or `.run()` conditions take precedence; do not add another hidden limit.

A one-step policy can execute tools; it does not automatically continue with another model call using their results. A step limit counts model steps, not individual tool calls. It is an upper bound, not a promise to run that many steps. Normal completion, pending external tool results, or approval requirements can end an execution earlier. SDK `prepareStep` remains available in either policy.

Providing the `Agent` interface and selecting a stopping condition are independent decisions. In Phase 1, `.asAgent` supplies the interface and a multi-step fallback. In Phase 2, every language-generation component supplies the interface without a modifier. On both paths, `stopWhen` controls continuation and takes a condition such as `isStepCount(1)`, not a numeric count. No internal agent-mode flag or separate `loopCount` setting is introduced.

Accept the SDK's full `stopWhen` contract, including custom predicates and arrays of conditions. Resolve it through ordinary configuration inheritance and isolated `.run()` overrides, then pass it to the SDK. Do not inspect the condition to infer an agent mode or change the component's type, rendering, result shape, hooks, or SDK methods. SDK compatibility remains available with every stopping condition.

## Two Entry Paths, One Execution Core

```text
Casai callable / .run()
  -> parse Casai arguments and validate raw call-time input
  -> resolve invocation settings, render/load once, assemble history
  -> validate custom call options and run prepareCall, if configured
  -> generateText / streamText
  -> Casai result/history augmentation and Phase 1 object aliases, where applicable

Native .generate(SDK arguments) / .stream(SDK arguments)
  -> combine configured SDK settings with explicit native call arguments
  -> validate custom call options and run prepareCall, if configured
  -> generateText / streamText
  -> full, unmodified SDK result
```

Native methods bypass Casai `inputSchema`, rendering-context merging, loaders/renderers, configured prompt/message insertion, and result augmentation. They still use the configured model, tools, output, instructions, loop policy, and hooks. They take exactly one of SDK `prompt` or `messages`; they do not reinterpret native `options` as rendering context.

This is a deliberate preparation boundary, not a limitation imposed by the SDK interface. UI helpers use native `.stream()` with a complete converted conversation. Preserve tool results and approval messages without inserting the component's configured Casai prompt or history. `prepareCall` can explicitly customize that request on either path.

Shared instructions belong in `instructions`. Prompt modifiers affect the Casai prompt source only. Preserve supported SDK prompt settings, including validation of system-message placement.

Every invocation starts one execution in its requested mode, potentially with multiple steps. `.stream()` on `Agent` uses real incremental streaming; `.generate()` on `StreamingAgent` uses generation directly. Do not route through the opposite default operation, buffer a complete generation into one artificial chunk, or generate again after consuming a stream. Factory construction starts no execution.

Streaming is required by the basic SDK `Agent` interface. Native `.generate()` delegates to `generateText()` and native `.stream()` delegates to `streamText()` through a promise-returning wrapper. Awaiting the latter yields a live stream handle; it does not drain the stream. Both Casai factories can therefore be used directly with SDK UI streaming helpers.

## Reuse Casai Preparation and Isolate Runs

Extract explicit preparation and result-adaptation operations from `src/llm-component.ts`, or use an explicit backend descriptor. Its current SDK-function identity checks must not be the mechanism for selecting the new core's message and result behavior.

Reuse call parsing and validation, renderer caching, loader resolution, configuration merging, and tool adaptation. Preserve these rules:

- `inputSchema` validates raw call-time context before configured context merges. Keep required arguments, schema input types, and validation-only semantics. Configured context cannot satisfy required input fields.
- A context field named `prompt` remains data. Function prompts keep context-only calls and function-valued `.run({ prompt })` overrides. There is no new `input` envelope.
- Rendering `context`, SDK `runtimeContext`, and per-tool `toolsContext` remain independent.
- History assembly remains configured messages, dynamic history, then rendered/literal prompt. Resolve this to one SDK prompt/messages argument.
- Casai `response.messages` represents the current turn; `response.messageHistory` includes dynamic input history and excludes configured static messages. Preserve corresponding streaming completion augmentation. Native results retain SDK history fields.

Build a fresh effective settings object per invocation using the existing shallow map merges and whole-value replacement rules. Never mutate the component's `.config`, `.tools`, or shared SDK settings. Snapshot history before asynchronous preparation, as existing components do. Isolation does not require deep-cloning models, tools, or arbitrary user objects; it requires that Casai's merge and preparation code never write run-specific state into shared objects.

Pass function settings such as `temperature` and `model` directly to `generateText` / `streamText` after resolution. The native Agent call type does not expose arbitrary model-setting overrides: preserve that type instead of casting Casai `.run()` options to SDK agent parameters.

For Casai calls, merge callback overrides once with ordinary Casai replacement semantics and install each resulting callback once. On the native path, compose configured and call-level lifecycle callbacks in SDK order, including its deprecated-alias resolution, without accidental duplicate installation. Streaming-only settings apply to streaming execution; both native modes remain available regardless of the component's default operation.

## Custom Call Options and Hooks

Infer SDK `CALL_OPTIONS` from `callOptionsSchema`, separately from Casai input inferred from `inputSchema`. Default to `never` when no custom options contract exists. Use the SDK's public schema and hook types where applicable; validation and `prepareCall` are orchestration owned by Casai when calling the core functions directly, not features supplied by the `Agent` interface alone.

Native methods and UI helpers use SDK `options`. Casai uses the distinct advanced setting `callOptions` in configuration or `.run()`, because `options` already belongs to Cascada. `callOptions` replaces its previous value as a whole; never derive it from rendering context.

```typescript
// Given a callOptionsSchema requiring accountId:
await researcher.run({
  context: { topic: 'battery recycling' },
  callOptions: { accountId: 'example-account' },
});

// Native request: no rendering or Casai context validation.
await researcher.generate({
  prompt: 'Research battery recycling.',
  options: { accountId: 'example-account' },
});
```

When call options are required, a Casai ordinary callable needs configured `callOptions`; otherwise callers must use `.run()` and supply them. Enforce the requirement in types and before model execution. Native methods retain the SDK signature and require their own explicit `options`, independent of Casai defaults. `callOptionsSchema` is fixed at creation.

Validate custom options before invoking `prepareCall`, preserving the SDK's parsed-options semantics. Run that hook once per invocation, after Casai preparation on the Casai path and after native request assembly on the native path. Forward its supported returned settings to the execution function. `prepareStep` belongs to the SDK and runs per model step. Rendering is never repeated for each tool-loop step.

## Output and Result Contract

The core uses modern `GenerateTextResult` / `StreamTextResult` with SDK `Output`. Both Phase 2 factories accept the same output specifications:

| Output kind | SDK output specification |
| :--- | :--- |
| Text, the default | `Output.text()` |
| Validated object | `Output.object({ schema })` |
| Array of validated elements | `Output.array({ element: schema })` |
| One allowed string | `Output.choice({ options: values })` |
| JSON without a fixed schema | `Output.json()` |

Preserve supported output metadata such as schema names and descriptions through the `Output` specification. Omit optional properties when absent, following exact optional property types. `inputSchema` still controls rendering input; it is unrelated to the output schema.

For Phase 1 Object variants, translate existing schema/output configuration outside the core:

| Phase 1 Object configuration | SDK output specification |
| :--- | :--- |
| `schema`, with omitted mode or `output: 'object'` | `Output.object({ schema, name: schemaName, description: schemaDescription })` |
| `output: 'array'`, with element `schema` | `Output.array({ element: schema, name: schemaName, description: schemaDescription })` |
| `output: 'enum'`, with `enum` values | `Output.choice({ options: values })` |
| `output: 'no-schema'` | `Output.json()` |

Casai calls retain all modern SDK result fields, getters, streams, methods, tool events, and metadata. Add history augmentation without flattening lazy getters, losing method receivers, or consuming streams. Native methods return the original SDK result without Casai augmentation.

`.output` is the parsed output value, or its promise on a streaming result. `.partialOutputStream` exposes partial structured values; `.textStream` exposes SDK text output. The complete event stream includes tool and step events. Modern fields remain directly accessible on the result, so no nested native-result wrapper is needed.

Phase 1 Object `.asAgent` calls add non-destructive `.object` and `.partialObjectStream` aliases for `.output` and `.partialOutputStream`, preserving their promise/stream behavior. These aliases do not recreate the old object event, reasoning, or callback shapes: `.asAgent` opts into modern SDK results. Ordinary Object components retain their existing contracts in Phase 1. Native methods return SDK results without aliases.

Phase 2 uses modern contracts directly, without those aliases or old object event/callback shapes. Update demos to use `Output`, `.output`, and `.partialOutputStream`.

Legacy-only object options such as `mode` and `repairText` (including its deprecated `experimental_repairText` alias) have no direct equivalent in the core. Reject them on Phase 1 `.asAgent` and on the Phase 2 factories, in types and runtime validation, rather than silently ignoring them. Phase 2 also replaces top-level output `schema` and string-valued output modes with SDK `Output` specifications. Do not claim a universally equivalent replacement for old object-only behavior.

## Async Contract and Types

Generation is promise-based. Casai plain-text streaming with no additional call preparation remains immediate. Existing rendered/loaded/function prompt paths remain promise-based. Configuring `callOptionsSchema` or `prepareCall` selects a promise-based preparation path, even when a particular schema or hook happens to finish synchronously. `.run()` return types follow its effective preparation requirements. Types must not advertise an immediate result when asynchronous preparation is possible.

Native `.generate()` and `.stream()` always return `PromiseLike` as required by the SDK `Agent` interface. This requirement applies to the native method, not the Casai callable. Wrapping a stream handle in a promise does not wait for the stream to complete. Preserve lazy consumption, abort behavior, and native error timing.

Extend the actual SDK `Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>` type, with type-only imports, rather than copying a simplified interface. Import it internally as `AISDKAgent` to distinguish it from Casai's `Agent` factory. Add the appropriate Casai callable, `.run()`, `.config`, and metadata contracts. Infer tools, runtime context, output, and callbacks from the final inherited configuration; do not hard-code rendering context as SDK runtime context.

Expose `readonly version: 'agent-v1'`, `readonly id: string | undefined`, and `readonly tools: TOOLS`, normalizing absent tools to `{}`. Keep output/schema contracts, `promptType`, and renderer setup fixed through `.run()`; constrain tool overrides to the existing tool signatures. Add new settings to `Config` validation and inference as well as the factory types. Components hold no hidden conversation state.

## Verification for Phases 1 and 2

Use mock models and register new mock-only files in `test:local`. Cover these boundaries in focused tests and the existing type-checking workflow:

- Both native modes and the correct default operation on all four Phase 1 `.asAgent` factories and both Phase 2 factories, with every supported output kind.
- Real incremental streaming on `Agent` and direct generation on `StreamingAgent`, with only one execution in the selected mode.
- Phase-specific defaults (twenty steps in Phase 1, one in Phase 2), text as the default for text/universal factories, a single-step tool call versus a continuing tool loop, inherited/explicit stopping conditions (including custom predicates and arrays), isolated run overrides, and approval/external-result continuations.
- Existing modifier, loader, parent, input-schema, prompt-override, function-prompt, history, and tool-adapter contracts.
- Complete modern output and event fidelity, Phase 1 object aliases, schema validation, and rejection of unsupported legacy options.
- Native methods bypassing Casai preparation while retaining custom call-option validation and hooks; UI helper compatibility with tool and approval messages.
- Concurrent runs with different model settings, tools, callbacks, context, and history; unchanged component configuration afterward.
- Callback replacement/composition without duplicates; preservation of `onChunk`, `onError`, `onAbort`, cancellation, and streaming transforms.
- Immediate plain streaming versus asynchronous preparation, promised native streaming, and no consumption merely to return a stream result.
- Required custom call options, native options independence, actual SDK Agent assignability, output/tool/runtime-context inference, and invalid overrides under exact optional property types.

Phase 2 reuses the core behavior tests and adds final factory, default-output, tool-output, and updated demo contracts. Verify that the final factories expose both SDK methods under single-step and multi-step policies and have no `.asAgent` modifier. Neither phase requires paid LLM calls to verify these boundaries.

## Phase 3: Specialized Components

Add the following factories after the language-generation API is established. All APIs in this section are planned, not implemented exports. Reuse Casai's component infrastructure with operation-specific SDK backends and result types; these components do not use the language-generation loop core merely because they invoke a model.

[README2.md](../README2.md#phase-3-specialized-components) is the public guide to these target components. For request-based operations, expose `.run()` with the corresponding SDK input fields (`state`, `query`/`documents`, `prompt`, `audio`, or `text`) and permitted per-call settings. Resolve defaults from component configuration, preserve fixed result-defining contracts, and isolate overrides. The direct Embedding overloads below add a convenient input-first form. Support all applicable input and tool modifiers according to the contracts below. Precise voice-session lifecycle methods remain an implementation-design decision.

| Factory | Backend / responsibility |
| :--- | :--- |
| [Decision](../README2.md#make-decisions) | `experimental_decide`: named choice, boolean, and score questions against shared state |
| [Embedding](../README2.md#embed-one-or-many-inputs) | `embed` for a string; `embedMany` for a string array |
| [Reranker](../README2.md#rerank-retrieved-documents) | `rerank`: rank candidate documents against a query |
| [ImageGenerator](../README2.md#generate-or-edit-images) | `generateImage`, including editing and multiple images where supported |
| [Transcriber](../README2.md#transcriber) | `transcribe`: recorded audio to a completed transcript |
| [StreamingTranscriber](../README2.md#streamingtranscriber) | `experimental_streamTranscribe`: live raw audio to incremental transcript events |
| [SpeechGenerator](../README2.md#generate-speech) | `generateSpeech`: text to audio |
| [VoiceSession](../README2.md#hold-a-voice-conversation) | A live conversation with explicit connection, interruption, and closing |

These names describe different operations and lifecycles, rather than variants distinguished only by a stopping condition. `Decision` is preferred to `DecisionAgent`: its result is a set of decision answers, and it does not implement the SDK Agent contract. OpenAI's Decisions endpoint does not accept tools. Lack of tools alone does not disqualify an agent; a language-generation agent can have an empty tool set. See the [Decisions reference](https://developers.openai.com/api/reference/resources/decisions/methods/create).

### Phase 3 Modifier Contracts

Support every existing modifier with meaningful semantics for the component. The [README2 support matrix](../README2.md#modifier-support) specifies the planned combinations; it is a requirement for Phase 3, not an inventory of undecided features.

- `Decision`, `Embedding`, `Reranker`, `ImageGenerator`, and `SpeechGenerator` support `.withText`, `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, `.loadsScript`, and `.asTool`.
- `Transcriber` supports `.withScript`, `.withFunction`, `.loadsScript`, and `.asTool`. `StreamingTranscriber` supports those same preparation modifiers, but has no `.asTool`.
- `VoiceSession` supports all seven text/script/function/loading modifiers for preparing session instructions. It has no `.asTool`.
- `.asAgent` remains exclusive to Phase 1. None of these modifiers manufactures Agent assignability or adds a tool loop to a specialized operation.

Text/template preparation targets decision text state, embedding values, the reranking query, image prompt text, speech text, or voice-session instructions. Embedding arrays remain batches; render each text/template value separately in order. Keep separately configured documents, image references, and masks intact when preparing text. `.loadsText` and `.loadsTemplate` use the normal text loader contract.

Script and function preparation can return the component's typed input: native decision state; a string or string array for embeddings; a query string or explicit `{ query, documents }` for reranking; an SDK image prompt; recorded audio values; a live audio stream; speech text; or session instructions. Only these declared input fields can come from a renderer; arbitrary configuration and fixed result contracts cannot be replaced through its output. For an explicit reranking input object, its query and documents form one prepared input and must not be mixed with another input's documents.

Parameterize preparation validation by the operation's input type. The existing language prompt validator (`string | ModelMessage[]`) cannot validate audio streams, embedding batches, or image-editing input. Preserve non-JSON values, binary data, and streams without cloning, stringifying, or consuming them. `.withScript` and `.loadsScript` return values directly; `.withFunction` retains Casai's context-only calls. Generalizing preparation must not weaken existing language-message validation.

Rendered variants use rendering context and explicit `.run({ context, ...overrides })`, with raw call-time `inputSchema` validation before configured context merges. Keep the plain Embedding `(textOrTexts, executionOverrides?)` signature distinct from rendered variants; do not guess whether the second argument is context or execution settings by inspecting its keys. Renderer type and result-defining contracts remain fixed at creation; source overrides follow the selected renderer's ordinary Casai convention. Runtime settings remain isolated per invocation.

Transcribers have no text/template modifiers for their audio payload. Even a base64 string is audio data rather than prompt text, and a text loader does not open a raw-audio stream. Script/function preparation can fetch audio or create a stream, while `inputAudioFormat` and other settings use the ordinary configuration path. Do not consume live input while preparing the call. Voice instructions are prepared once for each new session, never for every incoming audio chunk, and the session owns connection cleanup and cancellation.

Completed-result components support `.asTool` after any of their applicable input modifiers. Reuse description/input-schema requirements, validation, execution context, and callable-tool composition. Define typed mappings from validated tool arguments to operation inputs and from results to tool outputs. Map decisions to answers, embeddings to vectors, reranking to ranked documents/scores, transcription to transcript data, and image/speech generation to supported media content plus serializable metadata. Preserve full results for direct invocation. Media mappings need operation-specific serialization; a universal `.output` accessor or binary-to-string conversion is insufficient. StreamingTranscriber and VoiceSession must not be automatically drained or closed to synthesize a completed tool result.

### Embedding Calls and Results

Accept a string or an array of strings directly, with optional per-call settings as the second argument. No `value` wrapper is required on the callable. The array always means a batch; never concatenate it into one input or reinterpret it as message parts.

```typescript
// Proposed Phase 3 API. embeddingModel is supplied by the application.
const embedding = create.Embedding({ model: embeddingModel });

const one = await embedding('First document');
console.log(one.embedding); // number[]

const many = await embedding(['First document', 'Second document'], {
  maxParallelCalls: 2,
});
console.log(many.embeddings); // number[][], in input order

await embedding('Another document', {
  abortSignal: AbortSignal.timeout(5_000),
});

// The explicit run form uses the SDK input field names.
await embedding.run({ value: 'First document', maxRetries: 0 });
await embedding.run({ values: ['First document', 'Second document'] });
```

Implement string and array overloads with their corresponding SDK result types. On the plain component, `.run()` accepts exactly one of `value` or `values`. Its callable's second argument contains permitted execution overrides, not rendering context or another input. Apply it with the same isolation as `.run()`; neither form mutates `.config`. Rendered variants follow the [modifier contracts](#phase-3-modifier-contracts) and preserve single-value versus batch results after preparation. Do not change the existing Agent context argument convention.

Delegate to `embed` / `embedMany`, preserving SDK settings, usage, warnings, metadata, and responses. Let the SDK handle batch splitting and concurrency; do not implement batches as unrelated calls to `embed`. Keep batch-only settings such as `maxParallelCalls` on the array path. A future multimodal input form must be explicit and preserve the meaning of `string[]`. See [SDK embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings).

### Reranking and Decisions

Reranking commonly improves RAG after initial retrieval: retrieve candidates using vector, keyword, or hybrid search, rerank them against the query, then provide the best candidates to the answering agent. It also serves ordinary search and recommendation workflows. `Reranker` uses the SDK's `query`, `documents`, and `topN` semantics and preserves original indices, relevance scores, and document values. It does not create embeddings or manage a vector database. See [SDK reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking).

`Decision` preserves the SDK's named questions, answers, optional distributions, provider metadata, and refusal/error behavior. It can be composed before an agent for routing or exposed through a tool adapter. Choosing an enum or `Output.choice()` on an Agent continues to use language generation; it does not select the Decisions endpoint. The installed SDK exposes `experimental_decide`; provider capabilities and experimental contracts must be checked against the version used for implementation. See [SDK decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions).

### Transcription and Voice

Streaming transcription is supported by the installed `ai@7.0.130` as `experimental_streamTranscribe`. `StreamingTranscriber` requires a model that supports streaming, raw audio chunks, and the matching `inputAudioFormat`. Preserve transcript delta/partial/final events and final transcript metadata. Return the live SDK result without waiting for completion; asynchronous Casai preparation may require a promise for that handle. Unsupported models must report an error rather than silently buffer a complete recording.

The SDK result's `fullStream` has a single consumer. Access it before final-result promises when both events and the final transcript are needed; awaiting a final result first consumes the stream internally. Casai must not consume it during preparation or result augmentation. See [SDK streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription).

`Transcriber` handles complete recordings and returns the SDK transcript result. `SpeechGenerator` preserves generated audio, media information, and provider metadata. Neither operation is a persistent conversation. See [SDK speech generation](https://ai-sdk.dev/docs/ai-sdk-core/speech).

`VoiceSession` owns an explicitly created live connection, audio exchange, conversation events, interruptions, tool exchanges where supported, and cleanup. Keep each session's state separate from reusable component configuration. Its transport and session lifecycle follow the selected realtime backend; it is not a `StreamTextResult` or an automatic implementation of the SDK Agent interface. See [SDK realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime). Precise session method signatures are deferred to its implementation design.

### Shared Infrastructure and Capability Boundaries

- Reuse configuration inheritance, isolated overrides, all applicable modifiers, validation and rendering, cancellation, telemetry, and errors. Keep backend-specific models, settings, inputs, and results typed rather than exposing one universal options object.
- Preserve structured inputs and binary data. Existing image/file message parts and script/function prompts returning messages already support image understanding through compatible language models; retain this in Phases 1 and 2. Phase 3 adds dedicated image generation/editing, not image-input support from scratch.
- Preserve full results, including generated files/content, usage, provider metadata, and operation-specific streams. Agent `output` remains an SDK parsing specification, not a switch to image, embedding, or decision endpoints.
- Specialized components do not automatically expose Agent `.generate()` / `.stream()` or `.asAgent`. Tool composition is independent of Agent assignability. A tool adapter must explicitly map the operation's result, including media where applicable; it cannot universally read `.output`.
- Keep approvals and continuations supported on language agents. Future background jobs and resumable operations need explicit execution state/handles; do not store them in shared `.config` or simulate them by buffering streams. Their exact public APIs are outside this phase's factory naming decisions.

### Phase 3 Verification

Use mock backends and the existing type-checking workflow. Verify string versus array embedding overloads, one vector per input in order, SDK batch delegation, batch-only settings, explicit `.run()` input selection, and concurrent override isolation. Cover decision distributions/refusals and reranking indices; image edits and multiple outputs; binary/message preservation; streaming transcript events, cancellation, error propagation, final metadata, and single-consumer behavior; and independent voice-session state and cleanup. Confirm that specialized components retain their own result contracts without being advertised as SDK Agents. Register new mock-only tests in `test:local`; these checks need no paid model calls.

Cover every checked modifier combination, inline versus loaded preparation, the correct destination field, per-value embedding rendering, structured preparation validation, context/override separation, and tool result mappings including media. Verify that audio streams remain unconsumed, session instructions are prepared once per connection, and text/audio or live-session/tool combinations omitted from the matrix are rejected in types and runtime validation.
