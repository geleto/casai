# LLMAgent API and Specialized Components: Design and Implementation

Status: agreed design, awaiting implementation, with unresolved details identified below. [README.md](../README.md#agents-with-asagent) describes Phase 1: `.asAgent` on the existing Text/Object factories. [README2.md](../README2.md) is the standalone user guide to the future API from Phases 2 to 5. Phase 2 exposes a single `LLMAgent` factory, with the `.asStream` modifier selecting streaming for its ordinary call and no `.asAgent` or `.run()`, using the same language-generation core as Phase 1. [Phase 3](#phase-3-specialized-components) adds decisions, embeddings, reranking, images, transcription, speech, and voice sessions. [Phase 4](#phase-4-streaming-template-script-and-function) adds ordered streaming to Template, Script, and Function. [Phase 5](#phase-5-out-of-order-streaming) augments existing output streams with Cascada's proposed indexed views and adopts tagged JavaScript producers for out-of-order delivery. This filename distinguishes the design note from repository `AGENTS.md` instructions.

Phase 2 has one language-generation factory, `LLMAgent`; `.asStream` replaces a separate streaming factory. Phase 1 retains `.asAgent` as an addition to the existing factories. Casai is in active development with demos that can be rewritten; Phase 2 does not need to preserve the Phase 1 public surface through compatibility aliases or staged deprecation.

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

## Phase 2: Expose `LLMAgent` and `.asStream`

Expose `LLMAgent` through a named export and `create`. Each returned component is callable, has `.config`, and implements the SDK's `Agent` interface. It has no `.run()`: `.generate()` and `.stream()` take Casai's named-argument object and serve as both the Casai explicit-call methods and the SDK interface methods. `.asStream` changes only the ordinary call:

| Factory form | Ordinary call | `.generate()` | `.stream()` |
| :--- | :--- | :--- | :--- |
| `LLMAgent` | Generate | Generate | Stream |
| `LLMAgent.asStream` | Stream | Generate | Stream |

Support `.withText` (the default), `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, and `.loadsScript`, followed optionally by `.asStream` or `.asTool`. The two cannot be combined. Keep configuration inheritance, call parsing, schemas, history, and override isolation. There is no `.asAgent` modifier and no `.run()` method on the final factory. [Phase 2 call arguments](#phase-2-call-arguments) defines the argument object, and [modifier combinations](#modifier-combinations) defines which chains exist.

Phase 2 renames Cascada's `options` setting to `renderOptions` on every component, so `options` can carry SDK custom call options in configuration and in `.generate()` / `.stream()`. The Phase 1 `callOptions` setting is not carried forward.

The `output` setting selects text, object, array, choice, or JSON. Normalize an omitted value to `Output.text()` at runtime and in inferred types. Text and structured output share the same engine and result family.

`LLMAgent.asTool` and combinations such as `LLMAgent.withTemplate.asTool` return the configured `.output` from tool execution, including a string for text. Direct invocation returns the complete result. An agent exposed as a tool can itself use tools and `stopWhen`. Reuse tool context validation and `_toolCallOptions`; `.asStream` components have no `.asTool`.

Replace the Phase 1 Text/Object factory surface as part of this development change, updating demos, exports, types, tests, and documentation together. No public migration layer is required. Preserve explicit or inherited stopping conditions in demos; add `isStepCount(20)` where a demo relied on Phase 1's `.asAgent` fallback. Phase 2 is complete when the final factory with and without `.asStream`, all supported output kinds, prompt modifiers, the call-argument rules, tool adaptation, and SDK helper integration use the Phase 1 core.

### Modifier Combinations

From Phase 2 on, every factory follows one composition rule, documented for users in [README2](../README2.md#combining-modifiers): at most one input modifier (`.withText`, `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, or `.loadsScript`), then at most one output modifier (`.asStream` or `.asTool`). The [README2 support matrix](../README2.md#modifier-support) lists which modifiers each component offers.

Build the chain so that invalid combinations do not exist. A factory reached through `.asStream` has no `.asTool` property, and one reached through `.asTool` has no `.asStream`; an input modifier exposes no second input modifier; components without a streaming operation have no `.asStream`. Types must match the runtime chain, so an invalid combination is a TypeScript error and an `undefined` property in JavaScript. Phase 1 keeps its own order: input modifier, `.asAgent`, then `.asTool` for generators.

### Updating Demos for Phase 2

Keep implementation and migration guidance here; README2 documents the resulting API for first-time users. Apply these mappings when updating demos:

| Current demo API | Target API |
| :--- | :--- |
| `TextGenerator` / `TextStreamer` | `LLMAgent` / `LLMAgent.asStream`, default text output |
| `TextGenerator.asAgent` / `TextStreamer.asAgent` | `LLMAgent` / `LLMAgent.asStream`, preserving the desired `stopWhen` |
| `ObjectGenerator({ schema })` | `LLMAgent({ output: Output.object({ schema }) })` |
| `ObjectStreamer({ schema })` | `LLMAgent.asStream({ output: Output.object({ schema }) })` |
| Object `output: 'array'`, with element `schema` | `output: Output.array({ element: schema })` |
| Object `output: 'enum'`, with `enum` values | `output: Output.choice({ options: values })` |
| Object `output: 'no-schema'` | `output: Output.json()` |
| `.object` / `.partialObjectStream` | `.output` / `.partialOutputStream` |
| `.run({ ... })` | `.generate({ ... })` or `.stream({ ... })` |
| `.run({ prompt })` with a template, script, function, or resource name | `.generate({ source })`; a call-time `prompt` is now literal |
| `.run({ messages: history, ... })` | `.generate({ history, ... })` or `.stream({ history, ... })`; call-time `messages` now has the SDK's complete-conversation meaning |
| `callOptions` | `options` |
| Cascada `options` | `renderOptions` |

The Object mappings also apply to their Phase 1 `.asAgent` variants. Keep model, prompts, tools, and other applicable settings. Phase 1 object-result aliases are not carried into the final factory. The final factory defaults to one step, with or without `.asStream`; preserve explicit or inherited stopping conditions and configure `isStepCount(20)` where a demo relied on Phase 1's fallback.

## Loop Policy Is Separate from the Interface

For the new core, resolve inherited and local settings before selecting a fallback:

- Phase 1 `.asAgent` components: `isStepCount(20)` if no stopping condition was supplied or inherited.
- Phase 2 `LLMAgent`, with or without `.asStream`: `isStepCount(1)` if no stopping condition was supplied or inherited.
- Explicit configuration or per-call conditions take precedence; do not add another hidden limit.

A one-step policy can execute tools; it does not automatically continue with another model call using their results. A step limit counts model steps, not individual tool calls. It is an upper bound, not a promise to run that many steps. Normal completion, pending external tool results, or approval requirements can end an execution earlier. SDK `prepareStep` remains available in either policy.

Providing the `Agent` interface and selecting a stopping condition are independent decisions. In Phase 1, `.asAgent` supplies the interface and a multi-step fallback. In Phase 2, every language-generation component supplies the interface without a modifier. On both paths, `stopWhen` controls continuation and takes a condition such as `isStepCount(1)`, not a numeric count. No internal agent-mode flag or separate `loopCount` setting is introduced.

Accept the SDK's full `stopWhen` contract, including custom predicates and arrays of conditions. Resolve it through ordinary configuration inheritance and isolated per-call overrides, then pass it to the SDK. Do not inspect the condition to infer an agent mode or change the component's type, rendering, result shape, hooks, or SDK methods. SDK compatibility remains available with every stopping condition.

## Entry Paths and One Execution Core

### Phase 1: Two Entry Paths

Phase 1 `.asAgent` components keep the existing `.run()` method next to the SDK methods:

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

Phase 1 native methods bypass Casai `inputSchema`, rendering-context merging, loaders/renderers, configured prompt/message insertion, and result augmentation. They still use the configured model, tools, output, instructions, loop policy, and hooks. They take exactly one of SDK `prompt` or `messages`; they do not reinterpret native `options` as rendering context. UI helpers use native `.stream()` with a complete converted conversation. Preserve tool results and approval messages without inserting the component's configured Casai prompt or history. `prepareCall` can explicitly customize that request on either path.

### Phase 2: One Entry Path

The ordinary call, `.generate()`, and `.stream()` share one path. The ordinary call parses its positional arguments into the same argument object:

```text
Ordinary call / .generate(arguments) / .stream(arguments)
  -> normalize arguments; an undefined field counts as not supplied
  -> call-time prompt or messages supplied: use it literally, skipping rendering and inputSchema validation
     otherwise: validate raw call-time context, then render/load the configured or `source` prompt once
  -> assemble configured messages, history, then the prompt
  -> validate custom call options and run prepareCall, if configured
  -> generateText / streamText
  -> Casai result/history augmentation
```

SDK code calls `.generate()` and `.stream()` with SDK arguments, so the argument object must accept them with their SDK meaning. In the installed `ai@7.0.130`, `createAgentUIStream` calls `agent.stream({ prompt: modelMessages, options, abortSignal, timeout, experimental_sandbox, experimental_transform, onStepEnd })`: the conversation arrives as `prompt`, and keys are present even when their value is `undefined`.

### Phase 2 Call Arguments

| Field | Meaning |
| :--- | :--- |
| `context` | Rendering input for template, script, and function forms |
| `history` | Already-prepared dynamic history, after configured `messages` and before the new prompt |
| `messages` | A complete literal conversation with SDK semantics; replaces the configured prompt without rendering |
| `source` | One-off template, script, preparer function, or resource name, prepared like the configured `prompt` |
| `prompt` | Literal text or model messages replacing the configured prompt; never rendered |
| `options` | SDK custom call options, validated by `callOptionsSchema`; replaces configured `options` as a whole |
| Other settings | Per-call overrides permitted today by `.run()`, including model settings, tools, callbacks, `stopWhen`, and cancellation |

- `source`, `prompt`, and `messages` are mutually exclusive. With a call-time `prompt` or `messages`, the configured source is not prepared, so `inputSchema` validation does not apply and `context` is not required. Both SDK input forms work with every input modifier, and their contents are not interpreted as template code.
- `history` accompanies Casai rendering context or a new literal `prompt`. It cannot accompany a complete `messages` request. Normalize positional history arrays to `history`, preserving the ordinary callable's Casai conventions. Configured static `messages` and `instructions` still apply; the call-time `messages` field is not a static-message override.
- At call time, `undefined` means not supplied. The inheritance rule that explicit `undefined` clears a parent value applies only to configuration inheritance; otherwise SDK helpers would clear configured callbacks, timeouts, and options on every request.
- Call-time callbacks compose with configured callbacks in SDK order, including deprecated-alias resolution, without duplicate installation.
- Contract-defining settings stay fixed: `output`, schemas, `promptType`, `filters`, `renderOptions`, and `loader`.

Type the argument object as a superset of the SDK call parameters: neither SDK `prompt` nor SDK `messages` requires Casai `context`. Required rendering inputs apply only to a prepared Casai call. Verify both SDK branches in types and runtime behavior; do not rely on parameter bivariance to hide an extra rendering-context requirement.

Shared instructions belong in `instructions`. Prompt modifiers affect the Casai prompt source only. Preserve supported SDK prompt settings, including validation of system-message placement.

Every invocation starts one execution in its requested mode, potentially with multiple steps. `.stream()` uses real incremental streaming and `.generate()` uses generation directly, whichever operation the ordinary call performs. Do not route through the opposite default operation, buffer a complete generation into one artificial chunk, or generate again after consuming a stream. Factory construction starts no execution.

Streaming is required by the basic SDK `Agent` interface. Native `.generate()` delegates to `generateText()` and native `.stream()` delegates to `streamText()` through a promise-returning wrapper. Awaiting the latter yields a live stream handle; it does not drain the stream. Phase 1 `.asAgent` components and every Phase 2 `LLMAgent` form can therefore be used directly with SDK UI streaming helpers.

### Preparing New Turns Without Rendering History

For rendered chat, supply the new message as data in `context` and previously prepared model messages in `history`, for example `.generate({ context: { message: userText }, history })`. The configured template owns the source; user text is a variable value, never an additional template to evaluate. No reserved `message` context field is introduced: the application chooses its input schema and variable names.

Validate and prepare only the new call input. Snapshot and reuse history unchanged, then return the rendered prompt messages and generated messages in `response.messageHistory` for the application to persist. Script/function preparation may produce multiple new model messages; preserve their roles, content parts, and tool identifiers rather than converting them to one string. Preparation still runs once per invocation, not once per tool-loop step.

Do not infer newness from the last user message in an SDK conversation. `prompt: ModelMessage[]` and `messages` carry no Casai preparation boundary, and retries, regeneration, tool results, or approvals may include an already-rendered user turn. SDK-shaped requests remain literal. An application that needs new-turn rendering must identify the new input separately, maintain prepared model history, and reuse it for continuations. Original UI messages may be stored separately for display. This requires no mutable conversation state inside the shared component or hidden automatic rendering in UI helpers.

## Reuse Casai Preparation and Isolate Runs

Extract explicit preparation and result-adaptation operations from `src/llm-component.ts`, or use an explicit backend descriptor. Its current SDK-function identity checks must not be the mechanism for selecting the new core's message and result behavior.

Reuse call parsing and validation, renderer caching, loader resolution, configuration merging, and tool adaptation. Preserve these rules:

- `inputSchema` validates raw call-time context before configured context merges. Keep required arguments, schema input types, and validation-only semantics. Configured context cannot satisfy required input fields.
- A context field named `prompt` remains data. Function prompts keep context-only calls and function-valued source overrides: `.run({ prompt })` in Phase 1, `source` in Phase 2. There is no new `input` envelope.
- Rendering `context`, SDK `runtimeContext`, and per-tool `toolsContext` remain independent.
- History assembly remains configured messages, dynamic history, then rendered/literal prompt. In Phase 2, named dynamic history uses `history`; a complete call-time `messages` request is a literal input block without an added configured prompt. Resolve the assembly to one SDK prompt/messages argument.
- Casai `response.messages` contains the prepared/literal input prompt block and generated messages; `response.messageHistory` prepends explicit dynamic history and excludes configured static messages. For a new-turn call, this is the current turn and full history respectively. A Phase 2 SDK request that supplies a complete conversation has no declared new-turn boundary: its input block is the whole supplied conversation, so `response.messages` must not be described as a new-turn delta. SDK `responseMessages` remains generated messages only. Preserve corresponding streaming completion augmentation. Phase 1 native results retain unmodified SDK history fields.

Build a fresh effective settings object per invocation using the existing shallow map merges and whole-value replacement rules. Never mutate the component's `.config`, `.tools`, or shared SDK settings. Snapshot history before asynchronous preparation, as existing components do. Isolation does not require deep-cloning models, tools, or arbitrary user objects; it requires that Casai's merge and preparation code never write run-specific state into shared objects.

Pass function settings such as `temperature` and `model` directly to `generateText` / `streamText` after resolution. Phase 1 native methods accept only the SDK Agent call parameters: preserve that type instead of casting Casai `.run()` options to them. Phase 2 `.generate()` / `.stream()` accept the full [call-argument object](#phase-2-call-arguments).

In Phase 1, merge `.run()` callback overrides once with ordinary Casai replacement semantics and install each resulting callback once; on the native path, compose configured and call-level lifecycle callbacks. In Phase 2, every call composes them. Composition follows SDK order, including its deprecated-alias resolution, without accidental duplicate installation. Streaming-only settings apply to streaming execution; both SDK methods remain available regardless of the component's default operation.

## Custom Call Options and Hooks

Infer SDK `CALL_OPTIONS` from `callOptionsSchema`, separately from Casai input inferred from `inputSchema`. Default to `never` when no custom options contract exists. Use the SDK's public schema and hook types where applicable; validation and `prepareCall` are orchestration owned by Casai when calling the core functions directly, not features supplied by the `Agent` interface alone.

SDK methods and UI helpers use `options`. In Phase 1, Casai configuration and `.run()` use the distinct setting `callOptions`, because `options` belongs to Cascada on the existing factories. Phase 2 renames Cascada's setting to `renderOptions` and uses `options` for custom call options everywhere. A call's options replace the configured value as a whole; never derive them from rendering context.

```typescript
// Phase 2, given a callOptionsSchema requiring accountId:
await researcher.generate({
  context: { topic: 'battery recycling' },
  options: { accountId: 'example-account' },
});

// SDK-shaped request: the literal prompt skips rendering and context validation.
await researcher.generate({
  prompt: 'Research battery recycling.',
  options: { accountId: 'example-account' },
});
```

When call options are required, the ordinary call needs configured defaults (`callOptions` in Phase 1, `options` in Phase 2); otherwise callers must supply them per call. Enforce the requirement in types and before model execution. Phase 1 native methods require their own explicit `options`, independent of Casai defaults. In Phase 2, configured `options` apply whenever a call does not supply its own, including calls from SDK helpers. `callOptionsSchema` is fixed at creation.

Validate custom options before invoking `prepareCall`, preserving the SDK's parsed-options semantics. Run that hook once per invocation, after input preparation (after request assembly on the Phase 1 native path). Forward its supported returned settings to the execution function. `prepareStep` belongs to the SDK and runs per model step. Rendering is never repeated for each tool-loop step.

## Output and Result Contract

The core uses modern `GenerateTextResult` / `StreamTextResult` with SDK `Output`. The Phase 2 factory accepts the same output specifications with or without `.asStream`:

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

Casai calls retain all modern SDK result fields, getters, streams, methods, tool events, and metadata. Add history augmentation without flattening lazy getters, losing method receivers, or consuming streams. Phase 1 native methods return the original SDK result without Casai augmentation; in Phase 2 every call returns the augmented result.

`.output` is the parsed output value, or its promise on a streaming result. `.partialOutputStream` exposes partial structured values; `.textStream` exposes SDK text output. The complete event stream includes tool and step events. Modern fields remain directly accessible on the result, so no nested native-result wrapper is needed.

Phase 1 Object `.asAgent` calls add non-destructive `.object` and `.partialObjectStream` aliases for `.output` and `.partialOutputStream`, preserving their promise/stream behavior. These aliases do not recreate the old object event, reasoning, or callback shapes: `.asAgent` opts into modern SDK results. Ordinary Object components retain their existing contracts in Phase 1. Native methods return SDK results without aliases.

Phase 2 uses modern contracts directly, without those aliases or old object event/callback shapes. Update demos to use `Output`, `.output`, and `.partialOutputStream`.

Legacy-only object options such as `mode` and `repairText` (including its deprecated `experimental_repairText` alias) have no direct equivalent in the core. Reject them on Phase 1 `.asAgent` and on the Phase 2 factory, in types and runtime validation, rather than silently ignoring them. Phase 2 also replaces top-level output `schema` and string-valued output modes with SDK `Output` specifications. Do not claim a universally equivalent replacement for old object-only behavior.

## Async Contract and Types

Generation is promise-based. In Phase 1, Casai plain-text streaming with no additional call preparation remains immediate. Existing rendered/loaded/function prompt paths remain promise-based. Configuring `callOptionsSchema` or `prepareCall` selects a promise-based preparation path, even when a particular schema or hook happens to finish synchronously. `.run()` return types follow its effective preparation requirements. Types must not advertise an immediate result when asynchronous preparation is possible.

In Phase 2, the `.asStream` ordinary call and `.stream()` always return a promise for the live stream result, so the return type no longer depends on configuration and preparation errors always reject.

Native `.generate()` and `.stream()` always return `PromiseLike` as required by the SDK `Agent` interface. This requirement applies to the native method, not the Casai callable. Wrapping a stream handle in a promise does not wait for the stream to complete. Preserve lazy consumption, abort behavior, and native error timing.

Extend the actual SDK `Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>` type, with type-only imports, rather than copying a simplified interface. Import it under its own name; Casai exports no `Agent` factory, so no alias is needed. Add the appropriate Casai callable, `.run()` (Phase 1 only), `.config`, and metadata contracts. Infer tools, runtime context, output, and callbacks from the final inherited configuration; do not hard-code rendering context as SDK runtime context.

Expose `readonly version: 'agent-v1'`, `readonly id: string | undefined`, and `readonly tools: TOOLS`, normalizing absent tools to `{}`. Keep output/schema contracts, `promptType`, and renderer setup fixed through per-call arguments; constrain tool overrides to the existing tool signatures. Add new settings to `Config` validation and inference as well as the factory types. Components hold no hidden conversation state.

## Verification for Phases 1 and 2

Use mock models and register new mock-only files in `test:local`. Cover these boundaries in focused tests and the existing type-checking workflow:

- Both SDK modes and the correct default operation on all four Phase 1 `.asAgent` factories and on the Phase 2 factory with and without `.asStream`, with every supported output kind.
- Real incremental streaming on `LLMAgent` and direct generation on `LLMAgent.asStream`, with only one execution in the selected mode.
- Phase 2 call arguments: literal SDK `prompt` and `messages` replacing the configured source without rendering or input validation, explicit `history` and positional normalization, rejection of conflicting input forms, `source` overrides for every modifier, `undefined` as not supplied, configured `options` defaults, and the exact `createAgentUIStream` call shape against every input modifier.
- New-turn rendering with previously rendered history unchanged; user text containing template syntax treated as data; script/function preparation returning multiple messages; reuse of prepared messages for regeneration and tool/approval continuations; full-conversation history augmentation without guessing which input messages are new.
- Phase-specific defaults (twenty steps in Phase 1, one in Phase 2), text as the default for text/universal factories, a single-step tool call versus a continuing tool loop, inherited/explicit stopping conditions (including custom predicates and arrays), isolated run overrides, and approval/external-result continuations.
- Existing modifier, loader, parent, input-schema, prompt-override, function-prompt, history, and tool-adapter contracts.
- Complete modern output and event fidelity, Phase 1 object aliases, schema validation, and rejection of unsupported legacy options.
- Phase 1 native methods bypassing Casai preparation while retaining custom call-option validation and hooks; UI helper compatibility with tool and approval messages in both phases.
- Concurrent runs with different model settings, tools, callbacks, context, and history; unchanged component configuration afterward.
- Phase 1 callback replacement/composition and Phase 2 composition, without duplicates; preservation of `onChunk`, `onError`, `onAbort`, cancellation, and streaming transforms.
- Phase 1 immediate plain streaming versus asynchronous preparation, promise-only streaming in Phase 2, promised SDK streaming, and no consumption merely to return a stream result.
- Required custom call options, native options independence, actual SDK Agent assignability, output/tool/runtime-context inference, and invalid overrides under exact optional property types.

Phase 2 reuses the core behavior tests and adds final factory, `.asStream`, default-output, tool-output, and updated demo contracts. Verify that the final factory exposes both SDK methods with and without `.asStream`, under single-step and multi-step policies, rejects `.asStream` combined with `.asTool`, and has no `.asAgent` modifier or `.run()` method. Neither phase requires paid LLM calls to verify these boundaries.

## Phase 3: Specialized Components

Add the following factories after the language-generation API is established. All APIs in this section are planned, not implemented exports. Reuse Casai's component infrastructure with operation-specific SDK backends and result types; these components do not use the language-generation loop core merely because they invoke a model.

[README2.md](../README2.md#the-casai-components) is the public guide to these target components. For request-based operations, expose a method named after the operation, as in the table below, taking the corresponding SDK input fields (`state`, `value`/`values`, `query`/`documents`, `prompt`, `audio`, or `text`) and permitted per-call settings. There is no `.run()`. Resolve defaults from component configuration, preserve fixed result-defining contracts, and isolate overrides. The direct Embedding overloads below add a convenient input-first form. Support all applicable input and tool modifiers according to the contracts below. Precise voice-session lifecycle methods remain an implementation-design decision.

| Factory | Method | Backend / responsibility |
| :--- | :--- | :--- |
| [Decision](../README2.md#decision) | `.decide()` | `experimental_decide`: named choice, boolean, and score questions against shared state |
| [Embedding](../README2.md#embedding) | `.embed()` | `embed` for a string; `embedMany` for a string array |
| [Reranker](../README2.md#reranker) | `.rerank()` | `rerank`: rank candidate documents against a query |
| [ImageGenerator](../README2.md#imagegenerator) | `.generate()` | `generateImage`, including editing and multiple images where supported |
| [Transcriber](../README2.md#transcriber) | `.transcribe()` | `transcribe`: recorded audio to a completed transcript |
| [StreamingTranscriber](../README2.md#streamingtranscriber) | `.stream()` | `experimental_streamTranscribe`: live raw audio to incremental transcript events |
| [SpeechGenerator](../README2.md#speechgenerator) | `.generate()` | `generateSpeech`: text to audio |
| [VoiceSession](../README2.md#voicesession) | Session lifecycle, to be specified | A live conversation with explicit connection, interruption, and closing |

ImageGenerator and SpeechGenerator's `.generate()` and StreamingTranscriber's `.stream()` are operation methods with their own inputs and results; these components do not implement the SDK Agent interface.

These names describe different operations and lifecycles, rather than variants distinguished only by a stopping condition. `Decision` is preferred to `DecisionAgent`: its result is a set of decision answers, and it does not implement the SDK Agent contract. OpenAI's Decisions endpoint does not accept tools. Lack of tools alone does not disqualify an agent; a language-generation agent can have an empty tool set. See the [Decisions reference](https://developers.openai.com/api/reference/resources/decisions/methods/create).

### Phase 3 Modifier Contracts

Support every existing modifier with meaningful semantics for the component. The [README2 support matrix](../README2.md#modifier-support) specifies the planned combinations; it is a requirement for Phase 3, not an inventory of undecided features.

- `Decision`, `Embedding`, `Reranker`, `ImageGenerator`, and `SpeechGenerator` support `.withText`, `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, `.loadsScript`, and `.asTool`.
- `Transcriber` supports `.withScript`, `.withFunction`, `.loadsScript`, and `.asTool`. `StreamingTranscriber` supports those same preparation modifiers, but has no `.asTool`.
- `VoiceSession` supports all seven text/script/function/loading modifiers for preparing session instructions. It has no `.asTool`.
- `.asAgent` remains exclusive to Phase 1. `.asStream` belongs to `LLMAgent` until Phase 4 extends it to Template, Script, and Function; specialized components do not use it. None of these modifiers manufactures Agent assignability or adds a tool loop to a specialized operation.

Text/template preparation targets decision text state, embedding values, the reranking query, image prompt text, speech text, or voice-session instructions. Embedding arrays remain batches; render each text/template value separately in order. Keep separately configured documents, image references, and masks intact when preparing text. `.loadsText` and `.loadsTemplate` use the normal text loader contract.

Script and function preparation can return the component's typed input: native decision state; a string or string array for embeddings; a query string or explicit `{ query, documents }` for reranking; an SDK image prompt; recorded audio values; a live audio stream; speech text; or session instructions. Only these declared input fields can come from a renderer; arbitrary configuration and fixed result contracts cannot be replaced through its output. For an explicit reranking input object, its query and documents form one prepared input and must not be mixed with another input's documents.

Parameterize preparation validation by the operation's input type. The existing language prompt validator (`string | ModelMessage[]`) cannot validate audio streams, embedding batches, or image-editing input. Preserve non-JSON values, binary data, and streams without cloning, stringifying, or consuming them. `.withScript` and `.loadsScript` return values directly; `.withFunction` retains Casai's context-only calls. Generalizing preparation must not weaken existing language-message validation.

Rendered variants use rendering context and their operation method with `{ context, ...overrides }`, with raw call-time `inputSchema` validation before configured context merges. Keep the plain Embedding `(textOrTexts, executionOverrides?)` signature distinct from rendered variants; do not guess whether the second argument is context or execution settings by inspecting its keys. Renderer type and result-defining contracts remain fixed at creation; source overrides follow the selected renderer's ordinary Casai convention. Runtime settings remain isolated per invocation.

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

// The named-argument form uses the SDK input field names.
await embedding.embed({ value: 'First document', maxRetries: 0 });
await embedding.embed({ values: ['First document', 'Second document'] });
```

Implement string and array overloads with their corresponding SDK result types. On the plain component, `.embed()` accepts exactly one of `value` or `values`. Its callable's second argument contains permitted execution overrides, not rendering context or another input. Apply it with the same isolation as `.embed()`; neither form mutates `.config`. Rendered variants follow the [modifier contracts](#phase-3-modifier-contracts) and preserve single-value versus batch results after preparation. Do not change the existing LLMAgent context argument convention.

Delegate to `embed` / `embedMany`, preserving SDK settings, usage, warnings, metadata, and responses. Let the SDK handle batch splitting and concurrency; do not implement batches as unrelated calls to `embed`. Keep batch-only settings such as `maxParallelCalls` on the array path. A future multimodal input form must be explicit and preserve the meaning of `string[]`. See [SDK embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings).

### Reranking and Decisions

Reranking commonly improves RAG after initial retrieval: retrieve candidates using vector, keyword, or hybrid search, rerank them against the query, then provide the best candidates to the answering agent. It also serves ordinary search and recommendation workflows. `Reranker` uses the SDK's `query`, `documents`, and `topN` semantics and preserves original indices, relevance scores, and document values. It does not create embeddings or manage a vector database. See [SDK reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking).

`Decision` preserves the SDK's named questions, answers, optional distributions, provider metadata, and refusal/error behavior. It can be composed before an agent for routing or exposed through a tool adapter. Choosing an enum or `Output.choice()` on an LLMAgent continues to use language generation; it does not select the Decisions endpoint. The installed SDK exposes `experimental_decide`; provider capabilities and experimental contracts must be checked against the version used for implementation. See [SDK decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions).

### Transcription and Voice

Streaming transcription is supported by the installed `ai@7.0.130` as `experimental_streamTranscribe`. `StreamingTranscriber` requires a model that supports streaming, raw audio chunks, and the matching `inputAudioFormat`. Preserve transcript delta/partial/final events and final transcript metadata. Return the live SDK result without waiting for completion; asynchronous Casai preparation may require a promise for that handle. Unsupported models must report an error rather than silently buffer a complete recording.

The SDK result's `fullStream` has a single consumer. Access it before final-result promises when both events and the final transcript are needed; awaiting a final result first consumes the stream internally. Casai must not consume it during preparation or result augmentation. See [SDK streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription).

Keep this native transcription contract rather than adding `textStream` or `partialOutputStream` aliases. Incremental consumers handle transcript events explicitly; a workflow can await `text` for the final transcript. Phase 4 does not automatically forward transcription events into a Template or Script text stream. A future adapter would need explicit event and consumption semantics.

`Transcriber` handles complete recordings and returns the SDK transcript result. `SpeechGenerator` preserves generated audio, media information, and provider metadata. Neither operation is a persistent conversation. See [SDK speech generation](https://ai-sdk.dev/docs/ai-sdk-core/speech).

`VoiceSession` owns an explicitly created live connection, audio exchange, conversation events, interruptions, tool exchanges where supported, and cleanup. Keep each session's state separate from reusable component configuration. Its transport and session lifecycle follow the selected realtime backend; it is not a `StreamTextResult` or an automatic implementation of the SDK Agent interface. See [SDK realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime). Precise session method signatures are deferred to its implementation design.

### Shared Infrastructure and Capability Boundaries

- Reuse configuration inheritance, isolated overrides, all applicable modifiers, validation and rendering, cancellation, telemetry, and errors. Keep backend-specific models, settings, inputs, and results typed rather than exposing one universal options object.
- Preserve structured inputs and binary data. Existing image/file message parts and script/function prompts returning messages already support image understanding through compatible language models; retain this in Phases 1 and 2. Phase 3 adds dedicated image generation/editing, not image-input support from scratch.
- Preserve full results, including generated files/content, usage, provider metadata, and operation-specific streams. LLMAgent `output` remains an SDK parsing specification, not a switch to image, embedding, or decision endpoints.
- Specialized components do not implement the SDK Agent interface or expose `.asAgent` / `.asStream`; method names such as ImageGenerator's `.generate()` describe their own operations. Tool composition is independent of Agent assignability. A tool adapter must explicitly map the operation's result, including media where applicable; it cannot universally read `.output`.
- Keep approvals and continuations supported on language agents. Future background jobs and resumable operations need explicit execution state/handles; do not store them in shared `.config` or simulate them by buffering streams. Their exact public APIs are outside this phase's factory naming decisions.

### Phase 3 Verification

Use mock backends and the existing type-checking workflow. Verify string versus array embedding overloads, one vector per input in order, SDK batch delegation, batch-only settings, explicit `.embed()` input selection, operation method names on every specialized component, and concurrent override isolation. Cover decision distributions/refusals and reranking indices; image edits and multiple outputs; binary/message preservation; streaming transcript events, cancellation, error propagation, final metadata, and single-consumer behavior; and independent voice-session state and cleanup. Confirm that specialized components retain their own result contracts without being advertised as SDK Agents. Register new mock-only tests in `test:local`; these checks need no paid model calls.

Cover every checked modifier combination, inline versus loaded preparation, the correct destination field, per-value embedding rendering, structured preparation validation, context/override separation, and tool result mappings including media. Verify that audio streams remain unconsumed, session instructions are prepared once per connection, and text/audio or live-session/tool combinations omitted from the matrix are rejected in types and runtime validation.

### Remaining Public API Details

The supported operations, modifier combinations, preparation destinations, operation method names, and their SDK input fields above are agreed. The following details still need concrete signatures before implementation and complete copyable reference examples:

- **Specialized callable and modifier signatures:** Specify ordinary callable overloads beyond Embedding, the configuration field holding each template/script/function source, loaded-name overrides, and batch-template inputs. Keep these distinct from the operation's prepared SDK input and from execution overrides. README2 uses the agreed operation methods where no ordinary overload has been specified.
- **Specialized tool adapters:** Define exactly how each tool's validated arguments map to the operation input and the precise return type of `.execute()`. Specify embedding batch shape, reranking scores and indices, transcript metadata, and image/audio content plus serializable metadata. The agreed semantic mappings do not yet define these exact public shapes. Direct component calls continue to return the full SDK result.
- **VoiceSession lifecycle:** Specify construction and connection calls, transport selection, sending/receiving audio and text, interruption, tool exchanges, and cleanup. Reusable configuration and live connection state remain separate.

These open details do not reduce the required modifier support or change the selected factories/backends. Resolve them in this design and add corresponding README2 examples together, rather than presenting guessed signatures as an implemented or agreed API.

## Phase 4: Streaming Template, Script, and Function

Planned. [README2](../README2.md#streaming) documents the agreed behavior; the open questions at the end of this section remain. Template gains streaming text output, and Script gains streaming text and structured output. `.asStream` extends to Template, Script, and Function with the same meaning as on `LLMAgent`: the ordinary call returns a promise for a live stream result.

| Component | Ordinary call | Ordinary call with `.asStream` | `.stream()` |
| :--- | :--- | :--- | :--- |
| Template | Complete text | Stream result | Stream result; same arguments as the ordinary call |
| Script | Complete value | Stream result | Stream result; same arguments as the ordinary call |
| Function | Callback result | Stream result returned by the callback | Not provided |

- Template and Script add `.stream()` but no `.generate()`, and neither has ever had a `.run()` method. Without `.asStream`, the ordinary call is the complete operation; with it, the complete value is the stream result's final value, so no separate method is needed. `LLMAgent` has `.generate()` because the SDK `Agent` interface requires it.
- Function has one operation, its callback, so it gets `.asStream` but no `.stream()`. `.asStream` requires the callback to return a stream, enforced in types and checked at runtime like `schema`. The callback may return a compatible text/structured stream result directly, such as one from `agent.stream(...)`, or any async iterable, including an async generator callback, which Casai wraps into a stream result. Native transcription results retain their separate contract and require explicit consumption or adaptation. `schema` validates the final value. A `.asStream` Function always streams, so the callback does not need to know a mode.
- `.asStream` cannot be combined with `.asTool`, as on `LLMAgent`.
- Components that only stream, such as StreamingTranscriber, already stream from their ordinary call and take no modifier.

LLMAgent and the Template, Script, and Function streaming forms share text/structured streaming conventions where applicable: they reuse the AI SDK property names, `textStream` and `text` for text and `partialOutputStream` and `output` for structured values, with final values as promises. A Template stream result has `textStream` and `text`; a Script stream result's `output` resolves to the returned value. String chunks from a `.asStream` Function become `textStream`, and `text` resolves to the joined chunks. These conventions do not replace StreamingTranscriber's native `fullStream` events or VoiceSession's session lifecycle.

Two mechanisms decide when nested work streams, and they combine:

- **The caller's mode propagates.** When a Template or Script streams, through `.stream()` or `.asStream`, the components it calls from its context run in streaming mode where they support the text/structured contract. Only output selected by template output expressions or the script's output mechanism is forwarded, subject to Cascada's ordering below. Propagation cannot switch a Function's callback; mark a Function with `.asStream` when it returns a stream.
- **`.asStream` on a nested component** makes its ordinary call stream even under a non-streaming caller. That caller waits for the final value when it needs it, as `.asStream` LLMAgents already behave inside Phase 2 Scripts.

Without either, nested components use their ordinary call, as in Phase 2, so existing behavior does not change. Template output expressions must work in both modes: an LLMAgent or other component result in an output position renders as its text, streamed when the render streams. Reading a final value such as `.output` waits for the complete value.

Phase 4 exposes ordered output. Nested work can run concurrently and produce chunks out of order internally, but Cascada buffers later output behind unfinished earlier positions. Only the next available prefix in logical output order is emitted. A missing earlier entry pauses delivery past that position until it is resolved; it does not require serializing independent work. In `{{ slowA() }}{{ fastB() }}`, `slowA` can stream incrementally while `fastB` waits behind it. The joined text stream must equal the final text for that execution. Intermediate results, such as a draft and critique used to produce a final answer, are not published merely because their components streamed.

Out-of-order delivery to consumers belongs to Phase 5. Before implementing Phase 4, specify cancellation and cleanup of nested producers, limits on buffered later output, and how a failed earlier position resolves or terminates delivery without hanging the stream.

Decide before implementation how a Script selects what it streams incrementally, for example a `text` or `data` channel, and what a streamed structured value means: partial objects, as with `partialOutputStream`, or an ordered stream of completed elements. Cascada's concurrent evaluation makes partial values harder to define than for a single model call. The same choice decides the final value Casai derives from an async iterable of non-text values returned by a `.asStream` Function: the last yielded value or the collected elements.

### Phase 4 Verification

Use mock models and the existing type-checking workflow, and register new mock-only tests in `test:local`. Cover:

- `.stream()` on Template and Script with the same arguments as the ordinary call, and `.asStream` on Template, Script, and Function changing only the ordinary call.
- The text/structured stream-result contract: `textStream` and `text` for Template output and text chunks, and `output` for a Script's returned value; native transcription streams remain separate and unconsumed.
- Propagation: a streaming Template or Script streams the LLMAgents it calls and forwards selected output in logical order, while a non-streaming one leaves nested calls on their ordinary call.
- Concurrent producers finishing out of order, incremental delivery of the available prefix, buffering at gaps, joined text matching final text, and intermediate results staying internal. Cover cancellation, failed earlier positions, and producer cleanup under the chosen lifecycle policy.
- A nested `.asStream` component under a non-streaming caller, and output expressions that render both complete and streamed results as text.
- Function `.asStream` with async generators, other async iterables, and returned stream results; rejection of non-stream callback results in types and at runtime; `schema` applied to the final value.
- No `.asStream` combined with `.asTool`, no `.stream()` on Function, and promise-only streaming that does not consume a stream merely to return it.

## Phase 5: Out-of-Order Streaming

Agreed for Phase 5, awaiting implementation after Phase 4, using the [JavaScript integration in Cascada's streaming proposal](https://github.com/geleto/cascada/blob/master/docs/cascada/streaming.md#javascript-stream-integration). The upstream `stream` channel, `indexed()`, `indexedPath()`, and `at()` integration are proposed, not yet implemented or exported. Ordinary JavaScript async iterable inputs are already supported. Casai exposes the upstream ordering semantics through augmented output streams; Cascada owns the ordering engine.

Chunk availability and logical position are independent. Work may produce a later chunk first; consumers can preview or process it immediately through an indexed view while ordinary iteration waits for preceding positions. All views describe the same source-ordered result.

### JavaScript Consumer Views

In these examples, `stream` is the planned live Cascada stream handle. The agreed Casai augmentation below exposes its views through existing output-stream properties. This is future functionality; current SDK streams do not provide these methods. A channel's `snapshot()` returns a materialized array, not this live handle.

| View | Yielded value | Delivery and position |
| :--- | :--- | :--- |
| `for await (const chunk of stream)` | Chunk | Source order; waits until the chunk and all preceding chunks are available |
| `stream.indexed()` | `{ chunk, index }` | Availability order; `index` is the zero-based flattened source position, as `number` or `Promise<number>` |
| `stream.indexedPath()` | `{ chunk, indexpath }` | Availability order; `indexpath` is an immediately available `number[]` describing hierarchical source position |

Nested concurrent regions may leave earlier item counts unknown. In that case, `indexed()` delivers the chunk with a promised index; the promise resolves once enough preceding structure is known to determine the flattened position. Chunk delivery must not wait for that promise. A consumer that awaits each index inside its loop delays its own consumption of later chunks; use `indexedPath()` when immediate position information is needed.

```javascript
// Proposed Cascada live-handle API, not an existing Casai result property.
for await (const { chunk, indexpath } of stream.indexedPath()) {
  previewAtPath(indexpath, chunk);
}
```

Index paths compare lexicographically by numeric elements. For example, `[1, 8, 9]` precedes `[2, 0]`, and a prefix such as `[1, 2]` precedes `[1, 2, 0]`. Do not compare arrays with JavaScript's `<` operator or use string sorting. Paths allow immediate placement or previews without waiting for a flat numeric index; a final reconstruction follows this logical order.

### Augmentation of Existing Output Streams

Augment the stream values already exposed on results. Preserve ordinary `AsyncIterable` and `ReadableStream` behavior, with indexed views as additional methods. This public surface and the rule of one selected consumer view per obtained handle are agreed. Bind them to the implemented Cascada API while resolving the lifecycle details listed below.

```typescript
type CasaiStream<T> = AsyncIterable<T> & ReadableStream<T> & {
  indexed(): AsyncIterable<IndexedChunk<T>> & ReadableStream<IndexedChunk<T>>;
  indexedPath(): AsyncIterable<IndexedPathChunk<T>> & ReadableStream<IndexedPathChunk<T>>;
};

type IndexedChunk<T> = { chunk: T; index: number | Promise<number> };
type IndexedPathChunk<T> = { chunk: T; indexpath: number[] };
```

The same output supports either consumption form, selected before reading:

```typescript
const result = await newsletter.stream({ topic: 'battery recycling' });
const text = result.textStream;

// Ordered delivery, preserving the existing call form:
for await (const chunk of text) {
  appendText(chunk);
}
```

```typescript
// Alternative for a fresh result/stream handle; not a replay of the loop above:
const result = await newsletter.stream({ topic: 'battery recycling' });
for await (const { chunk, indexpath } of result.textStream.indexedPath()) {
  previewAtPath(indexpath, chunk);
}
```

Both examples are alternative consumption patterns. Selecting a view must not start a second model or workflow execution. `.indexed()` is the corresponding alternative when flat positions are useful; callers must handle its potentially promised index.

| Existing output property | Augmentation | Meaning and limits |
| :--- | :--- | :--- |
| `textStream` | `CasaiStream<string>` | Indexes identify text chunks, not character or byte offsets. Cascada-backed output can expose ready chunks before earlier positions complete. |
| `elementStream` | `CasaiStream<Element>` where an element stream is supported | Indexes identify complete elements in their logical sequence. This is a natural fit for independent concurrent work producing ordered results. |
| `partialOutputStream` | `CasaiStream<PartialOutput>` as a sequence of snapshots | Indexes identify successive partial-output emissions, not object keys or JSON paths. Native SDK snapshots remain in their existing sequence; indexing does not define a merge of concurrent object updates. |

For a plain SDK or untagged JavaScript source wrapped by Casai, the existing order is the only known order. Expose the same methods with incremental numeric indices and paths such as `[index]`; these views preserve the source's delivery order. Concurrent Cascada composition and explicitly tagged producers supply the additional position information needed for out-of-order delivery.

Partial structured output needs a narrower promise than text or complete elements. Preserve the SDK's snapshot semantics and final parsing; do not merge snapshots in arrival order, treat `indexpath` as a JSON patch path, or present complete elements as partial objects. How a Cascada Script exposes concurrent structured updates remains the Phase 4 design question. Position annotations alone do not resolve it.

Keep final `.text` / `.output`, validation, usage, tools, callbacks, and metadata under their existing contracts. In particular, SDK final values retain their SDK semantics; they must not be redefined by concatenating whichever events a consumer chose to observe. Augment only the applicable output streams. Preserve SDK `stream` / `fullStream`, UI conversion, and StreamingTranscriber's native events without wrapping their event payloads in position records. Ordinary SDK consumers continue to receive the original chunk types.

### Implementation and Consumption Constraints

The installed SDK returns real `ReadableStream` objects with async iteration and uses lazy getters to create branches for text, partial output, and elements. Casai currently preserves these objects while augmenting response history. Extend that approach carefully:

- Decorate newly obtained output-stream objects or provide a compatible stream facade. Preserve `getReader`, `pipeTo`, cancellation, locking, and SDK method receivers. Do not spread the result into a plain object, replace a stream with an async-generator-only wrapper, or eagerly read every SDK getter.
- Build Cascada's ordered and indexed views over the position-aware source before its ordering buffer. An indexed wrapper over the already ordered text stream has lost the early-availability benefit. Do not drain the source or create an unused, buffering ordered branch merely to attach the extra methods.
- Enforce one selected consumer view per obtained handle: ordinary reading, `.indexed()`, or `.indexedPath()`. Select the view before consumption; switching views after reading starts, replaying consumed chunks, and competing readers on that handle are not supported. Preserve existing SDK getter/branch behavior; multiple independent views require explicit upstream-supported branching and must account for buffering.
- Final-value aggregation belongs to the execution, not to the chosen presentation order. Coordinate it with consumption so reading an indexed view does not starve final promises, and preserve existing automatic-consumption behavior without launching a second execution.
- Treat indices as positions within the selected output sequence, not stable identifiers across text, elements, snapshots, or executions. Filtering, combining, or splitting chunks needs a defined position mapping; arbitrary `pipeThrough()` transforms return ordinary streams unless they explicitly preserve or recompute the indexed contract.
- Resolve cancellation, early iterator exit, failed producers, and unresolved/rejected index promises through a common source lifecycle. The augmentation must not leave an unconsumed branch or independent producer running indefinitely.

Promised flat indices are an in-process JavaScript API. A network transport cannot serialize a `Promise<number>` as a useful position. Prefer immediate numeric `indexpath` values for out-of-order UI previews, or explicitly resolve indices or design later position updates. Existing SDK UI helpers keep their native protocol; transporting positioned workflow chunks requires an explicit application protocol or adapter.

### JavaScript Producers

Adopt Cascada's proposed `at(chunk, index)` helper to preserve logical positions on chunks produced by JavaScript:

```javascript
// `at` denotes Cascada's proposed helper; its export is not available yet.
async function* greetingChunks() {
  yield at('world', 1);
  yield at('Hello ', 0);
}
```

A Cascada text channel consuming this tagged source assembles `Hello world`, despite receiving `world` first. `index` accepts a number or `Promise<number>`; final ordering waits for the required index promises. Untagged async iterables continue to use yield order, so yielding these two strings without tags would assemble `worldHello `.

Preserve upstream position tags across Casai context-producer and Function `.asStream` boundaries. Do not stringify a tag as content, discard its position, or collect and reorder the whole source before exposing a live handle. Let Cascada interpret the tags and expose ordered or indexed views. Ordinary SDK text streams remain ordinary ordered sources; Casai cannot infer a different logical order from untagged chunks.

### Cascada Semantics and Casai Integration

The proposed Cascada `stream` channel holds an append-only sequence of values. `results(value)` emits one value, multiple arguments emit multiple values, and arrays expand only when spread. `snapshot()` and `toArray()` materialize visible items in source order. This sequence-of-items contract does not by itself settle Phase 4's separate question of partial structured output versus completed elements.

Preserve Cascada's source-order visibility and transactional recovery. Reads see only items visible at their source position; out-of-order delivery does not make later writes visible to earlier reads. Emissions inside a guard remain provisional until committed and are discarded on recovery, so indexed delivery must not leak rolled-back items. Poisoned items retain Cascada's item-value semantics rather than automatically becoming an iterator failure.

Keep ordinary `textStream` delivery ordered and retain Phase 4's final values. Selecting an indexed view changes delivery order and adds position information; it does not change which output the workflow publishes. StreamingTranscriber continues to expose its native transcription events, and SDK agent/UI streams retain their own contracts.

The output properties, indexed method shapes, ordering semantics, and rule of one consumer view per obtained handle are agreed. Before implementation, settle these remaining integration details against the implemented Cascada API:

- Bind the augmentation of `textStream`, supported `elementStream`, and snapshot-based `partialOutputStream` to upstream handles; decide whether Casai re-exports `at`. Do not advertise indexed methods on unaugmented SDK results or operation-specific transcription streams.
- Define explicit branching for independent consumers, cancellation, producer cleanup, and buffering limits within the agreed consumption rule. Do not promise replay or independent subscriptions without upstream support.
- Completion and failure behavior for unresolved or rejected index promises, duplicate positions, and missing positions, so reconstruction either completes or reports a defined failure instead of hanging.

### Phase 5 Verification

Use mock producers and the existing local/type-checking workflow; these checks need no paid model calls. Cover:

- Ordered iteration waiting at gaps while indexed views deliver ready chunks, with the same final source-ordered result.
- Numeric and promised flattened indices, including nested regions with unknown preceding item counts; ready chunks remain observable before their indices resolve.
- Immediate hierarchical paths and numeric lexicographic reconstruction, including prefix paths and multi-digit elements.
- Tagged JavaScript producers, promised indices, preservation through Function `.asStream` and context calls, and unchanged yield order for untagged sources.
- Augmented streams remaining assignable to SDK stream/result types and usable through ordinary iteration and Web Streams readers; SDK lazy getter/branch semantics and UI event payloads remaining intact.
- One execution regardless of the selected view, final-value promises completing under indexed consumption, and no hidden eager drain or unused branch created by augmentation.
- Rejection of competing readers and view switches after consumption starts on one handle, with explicit supported branches retaining independent consumption.
- Partial-output indices identifying snapshot emissions, complete-element indices identifying sequence elements, and paths not being treated as object update locations.
- Source-order visibility, guard recovery without leaked provisional items, and poisoned items following Cascada semantics.
- View ownership, cancellation, cleanup, buffer limits, and invalid or unresolved positions under the selected upstream lifecycle contract.
