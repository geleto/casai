# Agent API: Two-Step Design

Status: agreed direction, awaiting implementation. [README.md](../README.md#agents-with-asagent) documents Step 1; [README2.md](../README2.md) documents Step 2. This filename distinguishes the design note from repository `AGENTS.md` instructions.

The SDK reference is the installed `ai@7.0.130`. Use its exported types and source when online examples differ. This plan supersedes the earlier dedicated `AgentGenerator` / `AgentStreamer` proposal.

## Decide the Core Now

Implement the SDK's basic `Agent` interface in Casai, with a shared execution core backed directly by `generateText` and `streamText`. Do not use `ToolLoopAgent` as the backend. The SDK supports custom implementations of the [Agent contract](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent); it does not require that class or any particular step count.

Both SDK functions already execute model/tool loops and parse structured output. Casai owns configuration, preparation, interface adaptation, and result augmentation. The SDK owns model requests, tool execution, termination, output parsing, stream delivery, and cancellation. There is no Casai implementation of the tool loop.

Direct execution also preserves streaming settings such as `onChunk`, `onError`, and `onAbort`, which are not exposed by the installed `ToolLoopAgent` settings type. Preserve their actual `streamText` behavior and types instead of emulating them through an agent lifecycle callback.

Build this core in Step 1. Step 2 changes public factories and output configuration; it does not introduce a new execution engine.

## Step 1: Add `.asAgent` to Existing Factories

Add the factory modifier to `TextGenerator`, `TextStreamer`, `ObjectGenerator`, and `ObjectStreamer`. The ordinary factories retain their current APIs and behavior. Introduce no dedicated Agent factory names.

Canonical modifier order is prompt selection, then agent behavior, then optional tool adaptation: `create.ObjectGenerator.withTemplate.asAgent.asTool(config, parent)`. Support `.withText` (the default), `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, and `.loadsScript`. Streaming factories have no `.asTool`.

Each `.asAgent` component is callable, has `.run()` and `.config`, and implements both native SDK methods. Its factory selects only the default operation for the callable and `.run()`.

| Factory family | Output boundary | Default operation |
| :--- | :--- | :--- |
| Text generator/streamer with `.asAgent` | Default `Output.text()`; preserve explicitly configured SDK `output` | Generate/stream respectively |
| Object generator/streamer with `.asAgent` | Translate existing schema/output-mode configuration to SDK `Output` | Generate/stream respectively |

Object variants can be implemented first within this step, followed by the thin Text variants. Step 1 is complete when all four share the core, preserve Casai calling conventions, and pass the same SDK interoperability checks. The result and option boundary below is part of the new modifier's contract, not a change to ordinary Object components.

Generator tool adaptation retains the family convention: Text tool execution returns `.text`; Object tool execution returns the parsed `.output` value. Direct calls always return the complete result. Reuse existing tool context validation and `_toolCallOptions` handling.

## Step 2: Expose Universal `Generator` / `Streamer`

Expose `Generator` and `Streamer` through both named exports and `create`. Both use the Step 1 core and always implement the native SDK `Agent` interface, even without `.asAgent`.

The `output` setting selects text, object, array, choice, or JSON. Normalize an omitted value to `Output.text()` both at runtime and in inferred types. No separate text/object engine is needed. The callable and `.run()` still select generation or streaming according to the factory.

Keep all prompt modifiers, configuration inheritance, call parsing, schemas, history, and override isolation. `.asAgent` remains an execution-policy preset. `Generator.asTool` returns the configured `.output` from tool execution, including a string for text; `Streamer` has no tool adapter. This intentionally replaces the Text family's fixed `.text` tool extraction when users migrate to the universal factory.

Retain old factories during migration. Their compatibility adapters stay outside the core, and removal requires a separate breaking release. Step 2 is complete when the universal API, migration examples, and type contracts cover all supported output kinds and both execution modes.

## Loop Policy Is Separate from the Interface

For the new core, resolve inherited and local settings before selecting a fallback:

- `.asAgent`: `isStepCount(20)` if no stopping condition was supplied or inherited.
- Ordinary universal factories: `isStepCount(1)` if none was supplied or inherited.
- Explicit configuration or `.run()` conditions take precedence; do not add another hidden limit.

A one-step policy can execute tools; it does not automatically continue with another model call using their results. A multi-step limit is an upper bound, not a promise to run that many steps. Normal completion, pending external tool results, or approval requirements can end an execution earlier. SDK `prepareStep` remains available in either policy.

Providing the `Agent` interface and choosing a multi-step default are independent decisions. In Step 1 the modifier supplies both; in Step 2 every universal component already supplies the interface, and the modifier supplies only the policy.

## Two Entry Paths, One Execution Core

```text
Casai callable / .run()
  -> parse Casai arguments and validate raw call-time input
  -> resolve invocation settings, render/load once, assemble history
  -> validate custom call options and run prepareCall, if configured
  -> generateText / streamText
  -> Casai result/history augmentation and optional object aliases

Native .generate(SDK arguments) / .stream(SDK arguments)
  -> combine configured SDK settings with explicit native call arguments
  -> validate custom call options and run prepareCall, if configured
  -> generateText / streamText
  -> full, unmodified SDK result
```

Native methods bypass Casai `inputSchema`, rendering-context merging, loaders/renderers, configured prompt/message insertion, and result augmentation. They still use the configured model, tools, output, instructions, loop policy, and hooks. They take exactly one of SDK `prompt` or `messages`; they do not reinterpret native `options` as rendering context.

This is a deliberate preparation boundary, not a limitation imposed by the SDK interface. UI helpers use native `.stream()` with a complete converted conversation. Preserve tool results and approval messages without inserting the component's configured Casai prompt or history. `prepareCall` can explicitly customize that request on either path.

Shared instructions belong in `instructions`. Prompt modifiers affect the Casai prompt source only. Preserve supported SDK prompt settings, including validation of system-message placement.

Every invocation starts one execution in its requested mode, potentially with multiple steps. `.stream()` on a generator uses real incremental streaming; `.generate()` on a streamer uses generation directly. Do not route through the opposite default operation, buffer a complete generation into one artificial chunk, or generate again after consuming a stream. Factory construction starts no execution.

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

## Output and Compatibility Boundary

The shared core always uses modern `GenerateTextResult` / `StreamTextResult` with SDK `Output`. Text is an output specification, and structured data uses the same tool-capable engine. For Step 1 Object variants, translate creation-time configuration at the boundary:

| Object configuration | SDK output specification |
| :--- | :--- |
| `schema`, with omitted output mode or `'object'` | `Output.object({ schema, name: schemaName, description: schemaDescription })` |
| `output: 'array'`, with element `schema` | `Output.array({ element: schema, name: schemaName, description: schemaDescription })` |
| `output: 'enum'`, with `enum` | `Output.choice({ options: enum })` |
| `output: 'no-schema'` | `Output.json()` |

Omit optional properties when absent, following exact optional property types. Preserve supported output metadata. `inputSchema` still controls rendering input; it is unrelated to the output schema.

Casai calls retain all modern SDK result fields, getters, streams, methods, tool events, and metadata. Add history augmentation without flattening lazy getters or losing method receivers. On Step 1 Object variants, add non-destructive aliases: `.object` to `.output`, and `.partialObjectStream` to `.partialOutputStream`. These aliases preserve promise/stream behavior and must not drain or recreate a stream. Native methods return the original SDK result without those additions.

`.output` always means the parsed output value, or its promise on a streaming result. It is not the native result wrapper. Modern fields remain directly accessible on the result; no nested native-result escape hatch is required by this design.

The new `.asAgent` Object variants do not claim exact `generateObject` / `streamObject` result compatibility. For example, their complete event stream includes tool and step events, their text stream follows modern text-stream semantics, and reasoning and callback payloads follow modern SDK types. Common aliases cannot make the old and new protocols identical. Existing ordinary Object components keep their old contracts; the new modifier is an explicit opt-in to the richer result family.

Legacy-only object configuration such as `mode` and `repairText` (including its deprecated `experimental_repairText` alias) has no direct equivalent in this core. Reject it on the new modifier, at type and runtime validation boundaries, rather than silently ignoring it. Keep it on ordinary Object factories where currently supported. Migration uses modern `Output` and supported provider settings; do not pretend those are universally equivalent replacements. Do not promise the old JSON-only stream events or response helpers on an agent result.

## Async Contract and Types

Generation is promise-based. Casai plain-text streaming with no additional call preparation remains immediate. Existing rendered/loaded/function prompt paths remain promise-based. Configuring `callOptionsSchema` or `prepareCall` selects a promise-based preparation path, even when a particular schema or hook happens to finish synchronously. `.run()` return types follow its effective preparation requirements. Types must not advertise an immediate result when asynchronous preparation is possible.

Native `.generate()` and `.stream()` always return `PromiseLike` as required by the SDK `Agent` interface. This requirement applies to the native method, not the Casai callable. Wrapping a stream handle in a promise does not wait for the stream to complete. Preserve lazy consumption, abort behavior, and native error timing.

Extend the actual SDK `Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>` type, with type-only imports, rather than copying a simplified interface. Add the appropriate Casai callable, `.run()`, `.config`, and metadata contracts. Infer tools, runtime context, output, and callbacks from the final inherited configuration; do not hard-code rendering context as SDK runtime context.

Expose `readonly version: 'agent-v1'`, `readonly id: string | undefined`, and `readonly tools: TOOLS`, normalizing absent tools to `{}`. Keep output/schema contracts, `promptType`, and renderer setup fixed through `.run()`; constrain tool overrides to the existing tool signatures. Add new settings to `Config` validation and inference as well as the factory types. Components hold no hidden conversation state.

## Verification for Each Step

Use mock models and register new mock-only files in `test:local`. Cover these boundaries in focused tests and the existing type-checking workflow:

- All four Step 1 default operations and both native modes on each; Step 2's two factories with every supported output kind.
- Real incremental streaming on a generator and direct generation on a streamer, with only one execution in the selected mode.
- A single-step tool call versus a continuing tool loop, default policy selection, inherited/explicit stopping conditions, and approval/external-result continuations.
- Existing modifier, loader, parent, input-schema, prompt-override, function-prompt, history, and tool-adapter contracts.
- Complete modern output and event fidelity, object aliases, schema validation, and rejection of unsupported legacy options.
- Native methods bypassing Casai preparation while retaining custom call-option validation and hooks; UI helper compatibility with tool and approval messages.
- Concurrent runs with different model settings, tools, callbacks, context, and history; unchanged component configuration afterward.
- Callback replacement/composition without duplicates; preservation of `onChunk`, `onError`, `onAbort`, cancellation, and streaming transforms.
- Immediate plain streaming versus asynchronous preparation, promised native streaming, and no consumption merely to return a stream result.
- Required custom call options, native options independence, actual SDK Agent assignability, output/tool/runtime-context inference, and invalid overrides under exact optional property types.

Step 2 reuses the core behavior tests and adds public factory, migration, default-output, and universal tool-output contracts. Neither stage requires paid LLM calls to verify these boundaries.
