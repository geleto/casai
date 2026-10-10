# LLMAgent, Coded Agents, and Specialized Components: Design and Implementation

Status: agreed design, awaiting implementation, with unresolved details identified below. [README.md](../README.md#agents-with-asagent) describes Phase 1: `.asAgent` on the existing Text/Object factories. [README2.md](../README2.md) is the standalone user guide to the future API from Phases 2 to 5. Phase 2 exposes a single `LLMAgent` factory, with the `.asStream` modifier selecting streaming for its ordinary call and no `.asAgent` or `.run()`, using the same language-generation core as Phase 1. [Phase 3](#phase-3-specialized-components) adds decisions, embeddings, reranking, images, transcription, speech, and voice sessions. [Phase 4](#phase-4-streaming-template-script-and-function) adds ordered streaming and [direct Agent support](#direct-agent-support-for-coded-components) to Template, Script, and Function. All four components then share `.generate()` / `.stream()` and the SDK/UI contract, so coded workflows can replace LLMAgents. [Phase 5](#phase-5-out-of-order-streaming) adds unordered output-stream properties with both hierarchical and flat positions, using Cascada's planned ordering integration. Script and template loops consume these streams with ordinary loop syntax. This filename distinguishes the design note from repository `AGENTS.md` instructions.

Phase 2 has one language-generation factory, `LLMAgent`; `.asStream` replaces a separate streaming factory. Phase 1 retains `.asAgent` as an addition to the existing factories. Casai is in active development with demos that can be rewritten; Phase 2 does not need to preserve the Phase 1 public surface through compatibility aliases or staged deprecation.

The SDK reference is the installed `ai@7.0.130`. Use its exported types and source when online examples differ.

## Decide the Core Now

All four components—LLMAgent, Template, Script, and Function—support the AI SDK `Agent` interface directly. Each component is callable and exposes `.generate()` and `.stream()` with named arguments, plus the SDK-required `version`, `id`, and `tools` properties. The methods implement the SDK call and full result/stream contracts, with additional Casai arguments for application input and supported overrides. Share the Agent request/result infrastructure internally; ordinary calls retain component-specific argument and return-value conventions. There is no public conversion helper or additional factory modifier. User documentation describes the intended API on its own, without comparisons to earlier methods or migration guidance. Explain SDK interoperability and common operations first; keep the [compatibility properties](../README2.md#agent-properties) in the reference.

For language generation, use a shared execution core backed directly by `generateText` and `streamText`. Do not use `ToolLoopAgent` as the backend. The SDK supports custom implementations of the [Agent contract](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent); it does not require that class or any particular step count. Phase 4's coded components implement the same contract through their own execution engines; Agent support itself makes no model request.

Both SDK functions already execute model/tool loops and parse structured output. For LLMAgent, Casai owns configuration, preparation, interface adaptation, and result augmentation. The SDK owns model requests, tool execution, termination, output parsing, stream delivery, and cancellation. There is no Casai implementation of the tool loop. For coded components, Casai owns local execution and compatible result/event construction while reusing SDK output specifications and protocol contracts.

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

Providing the `Agent` interface and selecting a stopping condition are independent decisions. In Phase 1, `.asAgent` supplies the interface and a multi-step fallback. In Phase 2, every language-generation component supplies the interface without a modifier. On both paths, `stopWhen` controls continuation and takes a condition such as `isStepCount(1)`, not a numeric count. Phase 4 makes Template, Script, and Function implement the interface directly without introducing a model-driven loop or a stopping condition. No internal agent-mode flag or separate `loopCount` setting is introduced.

Accept the SDK's full `stopWhen` contract, including custom predicates and arrays of conditions. Resolve it through ordinary configuration inheritance and isolated per-call overrides, then pass it to the SDK. Do not inspect the condition to infer an agent mode or change the component's type, rendering, result shape, hooks, or SDK methods. SDK compatibility remains available with every stopping condition. In particular, `createAgentUIStream` and `createAgentUIStreamResponse` must work with `isStepCount(1)`: this limits model steps per invocation, not chat turns. Tool parts can be emitted within that step; synthesis after tool execution requires another model step.

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

The language-generation core uses modern `GenerateTextResult` / `StreamTextResult` with SDK `Output`. Phase 4's [coded components](#direct-agent-support-for-coded-components) implement the same public result types and output specifications on `.generate()` and `.stream()`. The Phase 2 factory accepts these specifications with or without `.asStream`:

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
- The `.asAgent` factory modifier remains exclusive to Phase 1. `.asStream` belongs to `LLMAgent` until Phase 4 extends it to Template, Script, and Function; specialized components do not use it. Phase 4's coded components implement Agent directly. None of these features adds Agent assignability or a tool loop to a specialized operation.

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

Planned. [README2](../README2.md#streaming) documents streaming, and the [replacement guide](../README2.md#replacing-an-llmagent-with-template-script-or-function) documents the shared SDK Agent contract. Template, Script, and Function themselves implement Agent, including loaded and streaming forms. Each exposes named `.generate()` and `.stream()` methods returning complete or live SDK results, respectively. `.asStream` extends to all three and changes only the ordinary call. Native incremental output is text or complete array elements. The exact Script live-output binding remains to be specified.

| Component | Ordinary call | Ordinary call with `.asStream` | `.generate()` | `.stream()` |
| :--- | :--- | :--- | :--- | :--- |
| Template | Complete text | Native text stream result | Complete SDK result | Live SDK result |
| Script | Complete native value | Native stream result | Complete SDK result | Live SDK result |
| Function | Callback result | Native stream result from the callback | Complete SDK result | Live SDK result |

- All three add `.generate()` and `.stream()` with a single named-argument object, not positional context/source arguments. They have no `.run()`. Ordinary calls keep their native input/output contracts and receive no SDK result wrapping or Agent output serialization when they return a complete value.
- Native `.asStream` handles preserve the producer's final value and schema semantics; the Agent methods additionally apply the fixed SDK `output` contract. Without `.asStream`, Template and Script's ordinary call is the complete operation; with it, await the stream result's final value.
- Function `.asStream` requires the callback to return a text or array-element stream, enforced in types and checked at runtime like `schema`. The callback may return a compatible stream result directly, such as one from `agent.stream(...)`, or an async iterable, including an async generator callback, which Casai wraps into a stream result. The configured output kind determines whether a yield is a text chunk or a complete array element; do not guess from its JavaScript type. Native transcription results retain their separate contract and require explicit consumption or adaptation. `schema` validates the native final value. Both Agent methods exist regardless of the modifier: `.stream()` emits a complete-value callback result when ready or forwards a streaming callback's output; `.generate()` collects a streaming callback's one execution when necessary.
- `.asStream` cannot be combined with `.asTool`, as on `LLMAgent`.
- Components that only stream, such as StreamingTranscriber, already stream from their ordinary call and take no modifier.

LLMAgent and the Template, Script, and Function streaming forms share text/array streaming conventions where applicable: `textStream` yields text chunks, while `elementStream` yields complete array elements. Final values are promises. Text chunks join into the final string; elements collect into the final array in logical order. `Output.array({ element })` defines one complete item and the array result; a yielded string is an array item when that output kind is selected. A yielded array is one element when the element schema itself describes an array. Standalone `Output.object(...)` and `Output.json()` values are complete outputs, without a native incremental-object-update protocol. LLMAgent retains the SDK's partial-output capability. Full SDK result compatibility is still required on coded Agent methods, including required partial-output getters derived from their text or complete-element source; this does not add mutable partial-object producers. These conventions do not replace StreamingTranscriber's native `fullStream` events or VoiceSession's session lifecycle.

Two mechanisms decide when nested work streams, and they combine:

- **The caller's mode propagates.** When a Template or Script streams, through `.stream()` or `.asStream`, the components it calls from its context run in streaming mode where they support the text/array-element contract. Only output selected by template output expressions or the script's output mechanism is forwarded, subject to Cascada's ordering below. Propagation does not change a Function's callback: a regular callback supplies its complete value when ready, while a Function marked `.asStream` supplies incremental output.
- **`.asStream` on a nested component** makes its ordinary call stream even under a non-streaming caller. That caller waits for the final value when it needs it, as `.asStream` LLMAgents already behave inside Phase 2 Scripts.

Without either, nested components use their ordinary call, as in Phase 2, so existing behavior does not change. Template output expressions must work in both modes: an LLMAgent or other component result in an output position renders as its text, streamed when the render streams. Reading a final value such as `.output` waits for the complete value.

Phase 4 exposes ordered output. Nested work can run concurrently and produce chunks out of order internally, but Cascada buffers later output behind unfinished earlier positions. Only the next available prefix in logical output order is emitted. A missing earlier entry pauses delivery past that position until it is resolved; it does not require serializing independent work. In `{{ slowA() }}{{ fastB() }}`, `slowA` can stream incrementally while `fastB` waits behind it. The joined text stream must equal the final text for that execution. Intermediate results, such as a draft and critique used to produce a final answer, are not published merely because their components streamed.

Out-of-order delivery to consumers belongs to Phase 5. Before implementing Phase 4, specify cancellation and cleanup of nested producers, limits on buffered later output, and how a failed earlier position resolves or terminates delivery without hanging the stream.

The output meanings are settled: text chunks join into one string, and an item sequence collects into an array. A Template renders JSON array text and its adapter publishes each completed, validated element. A Script must select a live text or item channel/handle for incremental output; a plain returned value becomes available only when complete. Settle the exact Script syntax/runtime binding before implementation. Reuse the same selected output in both modes: `.generate()` collects it and `.stream()` forwards it. No program mode flag or partial-object merge protocol is needed. A Function array stream likewise collects every complete yielded element, never just the last element.

### Direct Agent Support for Coded Components

Make every ordinary, loaded, streaming, and tool-adapted Template, Script, and Function component itself assignable to the installed `Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>` interface. Expose `version: 'agent-v1'`, `id: string | undefined`, `tools`, `.generate()`, and `.stream()` on the callable. Reuse shared request normalization, lifecycle, output parsing, and result/event construction internally. The interface is built into the component, without another factory modifier or a conversion step. Factory construction starts no execution.

The replacement boundary is `.generate()`, `.stream()`, `createAgentUIStream`, `createAgentUIStreamResponse`, and other consumers of the same Agent contract. Ordinary callable results retain their native shapes. A replacement must preserve the caller's application-input type when using `context`, custom-options type, output type, runtime-context type, and any tool declarations needed to validate existing UI history or render tool parts. LLMAgent model settings and stopping conditions are not part of the shared coded-component contract.

The common chat integration preserves the conversation-in/message-out protocol. A Template renders text from mapped variables and helper expressions; a Script exposes selected workflow output; a Function exposes its callback output. These are distinct response producers, with no implicit model interpretation or model-driven loop. The UI helper consumes `.stream()` even when an ordinary call returns a complete value. A static Template can ignore conversation input and supply a fixed assistant reply; other programs must implement their own history and response logic. Text/JSON becomes assistant text parts. Parsed structured output does not define a client widget, and local helper calls do not create UI tool cards automatically. Forward reasoning, source, file, and tool parts only when actual compatible SDK events exist and preserve the corresponding declarations. Document these differences in [README2's UI capability comparison](../README2.md#what-the-chat-ui-uses).

#### Component Configuration and Named Input

| Setting | Contract |
| :--- | :--- |
| `prepareInput` | Optional sync/async mapper from normalized Agent conversation, parsed custom options, and the effective abort signal to native call-time input; omitted means `{ messages }` |
| `output` | An SDK `Output` specification; omitted means `Output.text()` at runtime and in inference |
| `callOptionsSchema`, `options` | Fixed custom-options schema and optional defaults; reuse Phase 2 validation, parsed-options, replacement, and required-options rules |
| `tools` | Fixed typed SDK tool definitions; defaults to `{}`; reusable implementations can also be supplied explicitly as callable context helpers |
| `runtimeContext` | Fixed SDK lifecycle metadata, inferred separately from native rendering context; defaults to `{}` |
| `id` | Optional string; the callable always has an `id` property |

Put these settings in the existing factory configuration alongside `template`, `script`, or `execute`, with ordinary inheritance semantics. The resolved mapper, schemas, SDK output, and tool types are fixed at creation. Each invocation receives its own input, options, conversation snapshot, and execution state. Agent compatibility adds methods and properties without wrapping ordinary complete-value results or making a model request. Share implementation code rather than creating a second component object per factory.

Both `.generate()` and `.stream()` take one named-argument object that is a superset of the installed SDK call parameters. They accept SDK lifecycle callbacks, cancellation, timeouts, sandbox context, and streaming transforms where applicable, plus a Casai branch for explicit native input:

| Call branch | Input and preparation |
| :--- | :--- |
| SDK conversation | Exactly one of `prompt` or `messages`; normalize and map into native input, then execute the configured program |
| Explicit application input | `context` contains native call-time input; optional `source` overrides the template, script, resource name, or callback for that invocation; skip conversation mapping |

The two branches are mutually exclusive. Reject a conversation combined with `context`, `source`, or LLMAgent-only `history`. On the explicit branch, enforce the native context requirement from `inputSchema` or Function's declared callback input. Permit omitted context only when the native input contract permits it. Do not add positional `.stream(context)` / `.generate(context)` overloads or inspect native input fields to guess the call mode. Fields such as `prompt`, `messages`, and `options` inside `context`, or in ordinary calls, remain application data.

A string SDK `prompt` normalizes to one user `ModelMessage`; either array form retains all roles, media, tool identifiers, and content parts. Snapshot the conversation before asynchronous preparation. Validate and parse custom options first, then call configured `prepareInput` once with `{ messages, options, abortSignal }`, using `undefined` for absent options. The effective signal combines caller cancellation and the applicable timeout. Without a mapper, use `{ messages }` as native input and validate it normally. A component expecting other required fields needs a mapper for conversation/UI use; ordinary and explicit-context calls require no mapper. Missing required schema fields fail validation before execution.

Infer the mapper's return contract from the component's raw call input, including required fields and configured-context rules. Validate mapped or explicit input through the existing `inputSchema` before configured context merges. Preserve validation-only native input semantics; options use parsed-schema semantics. Required input fields cannot be supplied only through configured context. Without an `inputSchema`, Function's declared input type controls mapper compatibility. Every component must accept both SDK branches without an extra `context` requirement in its Agent signature; configuration determines how that conversation satisfies the native input contract.

For conversation calls, the configured template, script, resource name, or callback always remains the program. SDK `prompt` or `messages` is data for the mapper and cannot become a source override. LLMAgent's literal-prompt bypass of rendering/input validation does not apply here. An application may explicitly select a last user turn or retain the full conversation; Casai does not infer new-turn boundaries or discard history automatically. Ordinary calls and explicit-context Agent calls share native input preparation and execution; the latter add the public SDK output/result contract.

#### Output, Results, and Execution

Use the same SDK output specifications as LLMAgent. `Output.text()` and `Output.choice()` require string output. Structured Template output is rendered JSON text. Structured Script/Function output is a JSON-compatible returned value, serialized once before the SDK output parser. Reject non-serializable outputs unless the program converts them explicitly. Preserve schemas, refinements, transforms, and output metadata; do not infer an SDK `Output` specification from a native `schema`.

Native Script/Function `schema` parses the component result first. Configured `output` validates/parses the public Agent result afterward and applies only to `.generate()` / `.stream()` on coded components. Ordinary calls and native `.asStream` final values retain their existing `schema` and return-value semantics. Infer each boundary independently, including transformed output types. A component used only through the Agent methods can put its public validation solely in `output`; if both boundaries transform, the public schema must accept the native parsed value. A compatible SDK result already parsed under the same output contract must retain its parsed result without running that parser's transformations again.

Implement the complete `GenerateTextResult` and `StreamTextResult` contracts, including response messages, lazy final values, conversion/consumption methods, finish state, and the SDK `stream` event property. In the installed SDK, UI helpers read `result.stream`; a plain string, an async iterable, or an object with only `textStream` is not an Agent result. Use type-only SDK imports and verify assignability without assertions that hide missing fields.

Expose one local execution step when wrapping a native value in an Agent result. Required SDK metadata identifies that execution as `provider: 'casai'` with `modelId: 'template'`, `'script'`, or `'function'`; it does not impersonate a model provider. Report zero model tokens for the local step, measured execution timing, and empty reasoning/tool arrays unless actual compatible events exist. Populate required `steps`/`finalStep`, response identity, and lifecycle fields consistently. Preserve real steps, tool events, and usage when forwarding a compatible SDK result under the same contract. Do not infer nested model costs from arbitrary helper values or claim that an AI-using workflow is free.

Each `.generate()` or `.stream()` starts exactly one native execution. For Template and Script, select complete or streaming execution explicitly rather than consulting their ordinary-call default. For Function, respect the configured callback: a complete-value callback runs once and `.stream()` emits its value when ready; a streaming callback forwards incremental output, and `.generate()` drains that same one execution to obtain its final value. Never execute again after consumption, or split an already-complete answer into pretend incremental chunks. This fallback is specific to coded producers; LLMAgent continues to use native model streaming.

After input preparation, `.stream()` yields a live result before waiting for a complete-value callback or consuming its stream. Emit valid SDK start/text/step/finish, error, and abort events and apply requested transforms with their SDK semantics. Preserve selected output order, lazy final-value behavior, and streaming error timing. Text streams append string chunks; array streams publish complete elements once and collect them in logical order for the final array. A complete-only array producer publishes its elements after the array is ready; it cannot provide earlier item availability. Standalone object values are emitted once when complete. Native producers do not emit partial-object snapshots or patches.

Validate an array element before publishing it through `elementStream`, retain parsed element values, and reject invalid elements through the stream and final result. Final array bounds and native whole-result validation remain required; errors can reject completion after earlier valid items were emitted. Preserve schema transformations once per validation boundary. A whole-array transformation that changes item values or order requires buffering before publication or an explicit unsupported-contract error; do not change already-published items afterward.

Adapt native output to the configured SDK `Output` parser's actual representation. In the installed SDK, `Output.array` expects a JSON object containing an `elements` array, even though its parsed result is the array itself. Template authors can render ordinary JSON array text; the adapter supplies the SDK representation. Script/Function elements likewise serialize into one correctly framed SDK document for text/UI consumption, with the public final `output` remaining an array. Do not blindly pass `JSON.stringify(nativeArray)` to the SDK array parser, concatenate separate JSON documents, or reparse already-compatible transformed SDK output. Required SDK partial-output getters may expose derived array snapshots or a final complete object; they are compatibility views, not a native object-update feature.

Cancellation and timeouts cover mapping, native execution, nested cooperative producers, and consumption. The mapper receives the effective signal; applications can explicitly include it in the input their callback/helpers expect. Cancellation must close iterators and end the SDK stream even when underlying application work cannot be forcibly interrupted. Respect total/step/content timeouts where applicable and report unsupported requested capabilities instead of silently ignoring them. Native side effects are never automatically retried by the Agent implementation.

Compose lifecycle callbacks once with the Phase 2 alias/order rules, reporting the local step accurately. Optional fields supplied as `undefined` by UI helpers leave configured defaults intact. `runtimeContext` remains SDK metadata, separate from mapped rendering input. Sandbox context is forwarded only to executions/events that support it; the Agent implementation must not claim that arbitrary JavaScript has been sandboxed.

#### Tools, Callable Helpers, and SDK Events

`tools` supplies named SDK tool definitions, including descriptions, schemas, and execution handlers where available. SDK consumers use them for tool messages and UI history validation. On LLMAgent, the SDK handles model-selected tool calls. Coded components decide which functions to invoke through their program.

Reuse a callable component explicitly in context and its `.asTool` adaptation in the tool map, as in [README2's short Script and Function examples](../README2.md#calling-tools-from-coded-components). A Script calls the helper as a normal context method, such as `multiply({ a: a, b: b })`; a Template can render `{{ multiply({ a: a, b: b }) }}`. Function's callback receives the helper in its merged input. Use a normal Function for direct validated application calls and derive its tool form with `Function.asTool({ description }, helperFunction)`. This preserves one implementation and both call contracts, including the SDK tool execution options required by the tool form.

The `tools` configuration does not automatically inject a reserved namespace or flatten tool names into native input. Context helpers follow normal context inheritance and input-validation ordering. A plain SDK tool is an object and may have no local handler; application code must expose an explicit callable wrapper or the underlying function to use it in context. Do not make every SDK tool callable by assuming `.execute` exists or by inventing tool execution metadata.

Direct helper calls follow the helper's native validation and execution contract. They do not automatically create SDK tool-call/result events, receive SDK tool context, or apply model-driven tool approval. Only actual, schema-compatible tool events may be forwarded or recorded, and declared tool types must match them. Registering helpers in `tools` starts no tool loop.

Native `.asTool` remains a separate adaptation contract: tool execution returns the native complete value and does not return the Agent stream. Tool-adapted components retain both Agent methods, but the `.asStream` / `.asTool` factory chain remains unavailable. Specialized image, embedding, speech, transcription, and session components do not gain Agent support.

### Phase 4 Verification

Use mock models and the existing type-checking workflow, and register new mock-only tests in `test:local`. Cover:

- Named `.generate()` / `.stream()` on Template, Script, and Function, with explicit `context` and optional `source`; `.asStream` changing only the ordinary call, and no positional-method ambiguity when application input contains `prompt`, `messages`, or `options`.
- The text/array stream-result contract: joined `textStream` chunks and final text, complete validated `elementStream` items and their collected final array, and final native values for complete-only outputs. Include streaming JSON-array Templates, complete-object elements, string elements, nested-array elements, and empty arrays; native transcription streams remain separate and unconsumed.
- Propagation: a streaming Template or Script streams the LLMAgents it calls and forwards selected output in logical order, while a non-streaming one leaves nested calls on their ordinary call.
- Concurrent producers finishing out of order, incremental delivery of the available prefix, buffering at gaps, joined text matching final text, and intermediate results staying internal. Cover cancellation, failed earlier positions, and producer cleanup under the chosen lifecycle policy.
- A nested `.asStream` component under a non-streaming caller, and output expressions that render both complete and streamed results as text.
- Function `.asStream` with async generators, other async iterables, and returned stream results; rejection of non-stream callback results in types and at runtime; `schema` applied to the final value.
- No `.asStream` combined with `.asTool`; Function always having both Agent methods; tool execution retaining its complete native result; and promise-only streaming that does not consume a stream merely to return it.
- Every supported ordinary/loaded/streaming/tool-adapted coded component directly assignable to the installed SDK Agent type, with exact mapper input, options, output, tool, and runtime-context inference; incompatible mapper results and contracts rejected without type assertions.
- The same SDK `.generate()`/`.stream()` callers and unchanged `createAgentUIStream`/`createAgentUIStreamResponse` handlers working with LLMAgent or each coded replacement, including full event streams, generated assistant messages, and cancellation. Include a one-step LLMAgent, a static Template reply, mapped history input, and a complete-value Function reply; verify that native helper calls do not invent UI tool parts.
- String prompts and both conversation-array forms, role/media/tool preservation, default `{ messages }` input, explicit last-turn versus full-history mappers, literal program-source markers, and required input validation before configured context merges. Missing required mapped fields fail before execution, and explicit-context calls skip the mapper.
- Input validation-only behavior, parsed call options before mapping, native output schemas, public SDK output schemas, refinements and transforms, serialized JSON, non-serializable outputs, and no duplicate parsing of already-compatible SDK output. Ordinary calls keep raw results and do not perform Agent output parsing or serialization.
- Complete-value and streaming callbacks executing once under each SDK mode, live handles before complete callbacks finish, selected output order, correct SDK array framing, complete-only arrays/objects, and no re-execution or unnecessary draining. Verify element validation before publication, final array bounds/errors, and schema transformations without changing already-emitted items.
- Accurate local step/finish/callback metadata, zero local model tokens, preserved forwarded SDK usage/events, empty tool declarations, matching historical tool parts, and no invented tool loop or hidden model request.
- Reuse of one callable implementation as a context helper and an SDK tool; Function receiving typed helpers in merged context; retained native validation, explicit SDK execution options, no implicit namespace injection, and no invented tool events from ordinary helper calls.
- Isolation, exact optional property behavior, callback alias composition, streaming transforms, timeout/abort propagation through asynchronous mapping and producers, cleanup, and no automatic retries of native side effects.

## Phase 5: Out-of-Order Streaming

Agreed for Phase 5, awaiting implementation after Phase 4, using the [JavaScript integration in Cascada's streaming proposal](https://github.com/geleto/cascada/blob/master/docs/cascada/streaming.md#javascript-stream-integration). The upstream `stream` channel, `indexed()`, `indexedPath()`, and `at()` integration are proposed, not yet implemented or exported. Ordinary JavaScript async iterable inputs are already supported. Cascada owns the ordering engine; Casai exposes ordered and unordered stream properties on results.

Chunk availability and logical position are independent. Work may produce a later chunk first. JavaScript can receive it immediately with both its hierarchical path and its flat index, while ordinary ordered delivery waits for preceding positions. Both forms describe the same logical output. Script and template loops consume either form with ordinary loop syntax and retain logical output order.

### Ordered and Unordered Output Properties

Preserve the existing ordered output properties and add corresponding unordered properties. This replaces the earlier Casai design that attached `.indexed()` and `.indexedPath()` methods to each stream. Those method names remain part of the upstream proposal, not Casai's public stream contract.

```typescript
type OutputStream<T> = AsyncIterable<T> & ReadableStream<T>;

type UnorderedChunk<T> = {
  chunk: T;
  indexpath: number[];
  index: number | Promise<number>;
};

type UnorderedOutputStream<T> = OutputStream<UnorderedChunk<T>>;
```

| Ordered result property | Unordered result property | Chunk and position meaning |
| :--- | :--- | :--- |
| `textStream` | `unorderedTextStream` | String chunks; indices count chunks, not characters or bytes |
| `elementStream` | `unorderedElementStream` | Complete elements in logical sequence, where element streaming is supported |

In JavaScript, ordered streams yield their existing raw chunk types. Unordered streams yield `UnorderedChunk<T>` records in availability order. Both forms retain `ReadableStream` and async-iteration support. Accessing an unordered property must not start another model or workflow execution.

Keep final `.text` / `.output`, validation, usage, tools, callbacks, and metadata under their existing contracts. SDK final values must not be redefined by concatenating whichever events a consumer chose to observe. SDK `stream` / `fullStream`, UI conversion, and StreamingTranscriber's native events retain their original event payloads and contracts.

### JavaScript Consumption and Positions

```typescript
const result = await newsletter.stream({ context: { topic: 'battery recycling' } });
for await (const { chunk, indexpath, index } of result.unorderedTextStream) {
  previewAtPath(indexpath, chunk);
  const flatIndex = await index; // Works for both a number and a promise.
  recordPosition(flatIndex, chunk);
}
```

Use `result.textStream` and append its string chunks for ordered delivery instead. These are alternative consumption patterns, not a way to replay a consumed stream. Each obtained handle has one consumer; independent consumers require explicit supported branching.

Every unordered record carries both positions for the same emission:

- `indexpath` is available immediately and describes hierarchical source position.
- `index` is the zero-based position in the flattened logical sequence. It is a number when known, or a promise when earlier nested regions have not yet established their item counts.
- `await index` works for either type. Awaiting it inside a JavaScript loop pauses consumption of subsequent chunks; a consumer needing immediate previews can use the path and resolve flat positions separately.

Index paths compare lexicographically by numeric elements. For example, `[1, 8, 9]` precedes `[2, 0]`, and a prefix such as `[1, 2]` precedes `[1, 2, 0]`. Do not compare arrays with JavaScript's `<` operator or use string sorting. Paths allow placement without waiting for a flat index.

Obtain both coordinates from the same upstream emission. The Cascada proposal currently documents separate index and path views; implementation needs access to their shared position metadata or an upstream combined-record API. Do not zip two separately consumed views or match them by chunk value: repeated identical chunks are distinct emissions.

For a plain SDK or untagged JavaScript source wrapped by Casai, the existing order is the only known order. Its unordered property can yield sequential numeric indices and paths such as `[index]`, retaining the source's delivery order. Concurrent Cascada composition and explicitly positioned producers supply the information needed for actual out-of-order delivery.

### Consumption in Script and Template Loops

Unordered streams are consumed in Cascada script and template loops exactly like ordinary streams. Pass either the ordered or unordered handle through context; the loop syntax and body do not change. The loop variable receives the chunk value, not the JavaScript `{ chunk, indexpath, index }` envelope. Casai's integration supplies the position metadata to Cascada, which uses it to assemble output in logical order.

For a script, bind `source` to either `result.textStream` or `result.unorderedTextStream` and use:

```cascada
text output
for chunk in source
  output(chunk)
endfor
return output.snapshot()
```

For a template, the same choice of `source` works with:

```nunjucks
{% for chunk in source %}{{ chunk }}{% endfor %}
```

The examples are alternative consumers; do not consume the same handle twice. If an unordered source delivers `world` at position 1 before `Hello ` at position 0, both loops assemble `Hello world`. No manual unwrapping, sorting, awaiting indices, or special unordered-loop syntax is required. Streaming the parent preserves Phase 4's ordered delivery unless JavaScript explicitly consumes the parent's unordered output property.

The same rule applies to complete array elements: the loop variable receives the original value, with its logical stream position handled by Cascada. Loop bodies retain Cascada's usual concurrency semantics; ordered output does not impose sequential execution on unrelated external side effects.

Use Cascada's position-aware source protocol at the integration boundary. Preserve its source identity and position metadata through context and nested component calls; do not identify positioned streams merely by the presence of object fields named `chunk`, `index`, or `indexpath`. Ordinary async iterables yielding application objects with those fields remain ordinary value streams. JavaScript iteration of an unordered result property continues to expose the complete records.

### Implementation and Consumption Constraints

The installed SDK returns real `ReadableStream` objects with async iteration and uses lazy getters to create branches for text, partial output, and elements. Add unordered result properties while preserving existing stream getters and method receivers:

- Create unordered handles lazily. Preserve `getReader`, `pipeTo`, cancellation, locking, and the original SDK properties. Do not spread the result into a plain object, replace a stream with an async-generator-only wrapper, or eagerly read every SDK getter.
- Build ordered and unordered handles over the position-aware source before Cascada's ordering buffer. Wrapping an already ordered stream cannot recover earlier chunk availability. Do not drain the source or create an unused buffering branch merely to expose another property.
- Enforce one consumer per obtained handle. Selecting a different result property does not replay consumed chunks or grant competing readers on one handle. Preserve existing SDK getter/branch behavior; independent ordered and unordered consumers need explicit supported branching with a defined buffering policy.
- Coordinate final-value aggregation with either consumption order so final promises can complete without another execution. Position resolution must not depend on the consumer awaiting one record before it can request the rest of the source.
- Indices belong to the selected output sequence, not to stable identifiers across text, elements, or executions. Filtering, combining, or splitting chunks needs a defined position mapping. Arbitrary `pipeThrough()` transforms do not automatically retain Cascada's position-aware source protocol.
- Resolve cancellation, early iterator exit, failed producers, and unresolved/rejected index promises through a common source lifecycle. Do not leave an unconsumed branch or independent producer running indefinitely.

Unordered extensions apply to text chunks and complete array elements. Preserve the SDK's existing ordered partial-output getters on LLMAgent, without adding `unorderedPartialOutputStream` or a concurrent object-update/merge protocol. Position paths describe sequence positions, not JSON patch paths. Phase 4 still needs the exact Script binding for its selected live text or item output.

Promised flat indices are an in-process JavaScript API. A network transport cannot serialize a `Promise<number>` as a useful position. Prefer immediate paths for out-of-order UI previews, or resolve indices explicitly. Existing SDK UI helpers keep their native protocol; transporting positioned workflow chunks requires an explicit application protocol or adapter.

### JavaScript Producers

Adopt Cascada's proposed `at(chunk, index)` helper to preserve logical positions on chunks produced by JavaScript:

```javascript
// `at` denotes Cascada's proposed helper; its export is not available yet.
async function* greetingChunks() {
  yield at('world', 1);
  yield at('Hello ', 0);
}
```

The ordinary script/template loop forms above also apply to these recognized tagged sources. A text channel or template assembles `Hello world` despite receiving `world` first. `index` accepts a number or `Promise<number>`; final ordering waits for the required positions. Untagged async iterables retain yield order, so yielding the same two strings without tags assembles `worldHello `.

Preserve upstream position tags across Casai context-producer and Function `.asStream` boundaries. Do not stringify tags as content, discard their positions, or collect and reorder the entire source before exposing a live handle.

A JavaScript producer providing only `at(chunk, promisedIndex)` may not supply enough information for an immediate hierarchical path. Before exposing it through an unordered result property, obtain a path from the producer/upstream metadata or wait until its position is known. Do not fabricate an arrival-order path that disagrees with the eventual index. The concrete upstream mechanism for supplying both coordinates remains to be specified.

### Cascada Semantics and Remaining Integration Details

The proposed Cascada `stream` channel holds an append-only sequence of values. `results(value)` emits one value, multiple arguments emit multiple values, and arrays expand only when spread. `snapshot()` and `toArray()` materialize visible items in source order. This sequence-of-items contract matches Phase 4's complete-array-element output: streaming forwards the selected items, while generation collects their array. The binding exposing that live channel as a Script result remains to be specified; a snapshot itself is a materialized value, not a live handle.

Preserve Cascada's source-order visibility and transactional recovery. Reads see only items visible at their source position; out-of-order delivery does not make later writes visible to earlier reads. Emissions inside a guard remain provisional until committed and are discarded on recovery, so unordered delivery must not leak rolled-back items. Poisoned items retain Cascada's item-value semantics rather than automatically becoming an iterator failure.

The paired output properties, combined record shape, ordinary script/template loop consumption, ordering semantics, and rule of one consumer per obtained handle are agreed. Before implementation, settle:

- Access to both coordinates for each upstream emission, the protocol binding used by Cascada loops, and whether Casai re-exports `at`. Do not change ordinary application-object iteration or advertise the new properties on unaugmented SDK/transcription results.
- Explicit branching for independent consumers, cancellation, producer cleanup, and buffering limits. Do not promise replay or independent subscriptions without upstream support.
- Completion and failure behavior for unresolved or rejected index promises, duplicate positions, and missing positions, so reconstruction completes or reports a defined failure instead of hanging.

### Phase 5 Verification

Use mock producers and the existing local/type-checking workflow; these checks need no paid model calls. Cover:

- Ordered delivery waiting at gaps while unordered delivery exposes ready chunks, with the same final logical result.
- Both coordinates belonging to the same emission, including repeated identical chunks, promised flat indices, and nested regions with unknown preceding item counts.
- Immediate hierarchical paths and numeric lexicographic reconstruction, including prefix paths and multi-digit elements.
- Script and template loops with unchanged bodies accepting ordinary, unordered, and recognized tagged sources; raw loop values and logically ordered output; JavaScript receiving complete unordered records.
- Context/nested-component protocol preservation and ordinary object-valued iterables with `chunk`, `index`, or `indexpath` fields remaining unmodified.
- Tagged JavaScript producers, promised indices, preservation through Function `.asStream`, and unchanged yield order for untagged sources.
- Result compatibility with SDK stream types, ordinary iteration and Web Streams readers, lazy getter/branch behavior, and unchanged SDK UI/transcription event payloads.
- One execution regardless of the selected property, final-value promises completing under unordered consumption, and no hidden eager drain or unused branch.
- Rejection of competing readers on one handle, with explicit supported branches retaining independent consumption.
- Text-chunk and complete-element position semantics, source-order visibility, guard recovery without leaked provisional items, and poisoned-item behavior; no unordered partial-object extension.
- Cancellation, cleanup, buffer limits, and invalid or unresolved positions under the selected upstream lifecycle contract.
