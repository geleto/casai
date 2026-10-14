# LLMAgent and Component Composition: Design and Implementation

Status: agreed core API, awaiting implementation. [README.md](../README.md#agents-with-asagent) describes the current factories and planned Phase 1 `.asAgent` addition. [README2.md](../README2.md) describes the intended API. Phase 2 introduces JavaScript stream infrastructure and Function stream producers before `LLMAgent`, which implements the AI SDK Agent interface. Phase 3 adds specialized AI operations. Phases 1–3 require no proposed Cascada features. Phase 4 integrates the established stream contracts into Cascada: Template gains streaming rendering, and Script gains live stream-channel returns. Coded components do not implement SDK Agent or its chat protocol. Phase 5 adds the deferred out-of-order extension. Cascada interruption, automatic nested cancellation, and workflow telemetry remain upstream work, recorded in [abort.md](abort.md) and [future.md](future.md).

Phase 1 ships as a compatible release: the existing Text/Object factories keep their behavior, and `.asAgent` is an addition. Phase 2 is the next, breaking release. It replaces the Phase 1 Text/Object factory surface, including `.asAgent`, without compatibility aliases or staged deprecation, and demos are rewritten for it. Keep implementation mappings in this document; user documentation presents the intended API without historical method comparisons. This filename distinguishes the design note from repository `AGENTS.md` instructions.

The SDK reference is the installed `ai@7.0.130`. Use its exported types and source when online examples differ.

## Decide the Core Now

**LLMAgent alone implements SDK Agent.** It accepts the SDK's literal text/conversation requests and returns genuine SDK generation and streaming results, with `version`, `id`, and `tools` compatibility properties. Use a shared language execution core backed directly by `generateText` and `streamText`. The SDK owns model requests, tool loops, termination, output parsing, events, usage, and provider cancellation. Casai owns configuration, prompt preparation, call-option validation, hooks, and additive history metadata.

**Every callable component has an ordinary call and `.run()`.** Each has a main property: `prompt` on LLMAgent, `template` on Template, `script` on Script, `execute` on Function, and the SDK input field on a specialized component. Input modifiers set its type, never its name. Ordinary calls take inputs, not execution settings. On a plain LLMAgent the first argument is always the new prompt, a string or message array, followed optionally by `messageHistory`. Rendered forms take source, context, and history as applicable. `.run()` takes named inputs and per-call settings, including `abortSignal` and `timeout` on Template, Script, and Function. All callable components expose `.config`. Streaming mode is inherited from a parent component and cannot be switched off by deriving a child; `.asStream` enables it on LLMAgent and Template. Independently called components keep their own mode. LLMAgent's SDK `.generate()` and `.stream()` explicitly select their operation regardless of the ordinary-call mode.

**Template, Script, and Function use native Casai contracts.** Their calls return what the template or program produces: a string, or a text stream with `.asStream`, for Template; the program's value for Script and Function, which is a stream when their schema declares one. Reuse context, input validation, compatible configuration inheritance, and tool adaptation. Do not manufacture SDK steps, usage, assistant messages, or UI events, or maintain parallel native and SDK output schemas. Template remains text-only. Script and Function produce native structured values.

Workflow interchange happens at an application's input/value boundary: extract `.value` from an LLMAgent result in an explicit adapter, written as application code rather than provided by Casai, then give a coded implementation the same input and returned value type. Streaming interchange needs an adapter with declared stream capabilities; a plain complete-value function does not gain them implicitly. See [the public composition examples](../README2.md#interchanging-components-in-workflows).

Keep SDK result fields unchanged. Add `value` for final application output and `messageHistory` for conversation state. Execution mode changes delivery, never output selection: collecting a successful `value` stream must yield the same data as that execution's final parsed `output`. Unrestricted loops buffer candidate output until finality is known. Keep SDK `stream` for live execution events and `steps` for completed step records, with no new activity aliases. See [the output and result contract](#output-and-result-contract).

The direct SDK backend exposes function settings such as `onChunk`, `onError`, and `onAbort` that the installed `ToolLoopAgent` settings type does not expose. Preserve those contracts. `ToolLoopAgent` with one step would also be valid; step count is independent of Agent assignability. The [Agent contract](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent) requires neither that class nor a particular stopping condition.

A custom model/provider is not needed for native composition. If a concrete application later needs coded logic behind the SDK chat protocol, assess an explicit opt-in adapter separately. A provider backed by the public `LanguageModelV4` contract would let the SDK construct real results; do not commit to a Casai adapter or hand-built SDK result emulation now. See [custom provider guidance](https://ai-sdk.dev/providers/community-providers/custom-providers).

## Phase Dependencies and Implementation Order

Build all Casai-only functionality before requiring new Cascada features. Phases 1–3 use the installed engine and SDK; Phase 4 integrates new Cascada streaming capabilities. Phase 5 and the separately recorded future features remain deferred.

| Phase | Depends on | Implementation scope |
| :--- | :--- | :--- |
| 1: `.asAgent`, a compatible release | The installed `ai@7` and current Cascada | Shared generation/streaming core and compatible agent adapters |
| 2a: Coded component conventions and JavaScript streams | Current code and installed Cascada, including its existing loop sharing; no new engine features | Named/flat context, stream kinds, lazy schema validation, collectors, Function producers, finite-stream tool collection, and cooperative JavaScript cancellation |
| 2b: `LLMAgent` | The Phase 1 core and 2a stream infrastructure | Final-output `value` streams, SDK-compatible consumption, and output-availability normalization |
| 2c: Tool continuations | 2b | Approval and external-result continuations |
| 3: Specialized components | Phase 2 and the applicable SDK APIs; no new Cascada features | Operation adapters and result types derived from SDK contracts and the agreed tool-result mappings; recheck experimental APIs against the implementation version |
| 4: Cascada streaming integration | Phase 2 stream infrastructure and new Cascada capabilities | Integrate native `stream`/`tstream` channels, live Script returns, Template streaming, runtime kinds, source-order snapshots, and Cascada-owned validation hooks and JavaScript export boundaries |
| 5: Out-of-order streaming | Phase 4, and Cascada's positioned streams (`at()` and positioned views) | Deferred |
| Future features | Cascada's telemetry and context channels, and async context tracking | See [abort.md](abort.md) and [future.md](future.md) |

### Design Status

The core call and result contracts are settled: named input objects, flat implementation context, fallback tool-function bindings, separate validation of tool arguments and application-supplied tool data, and final-output `value` with buffering when finality is unknown. Streams use ordinary consumption; Casai adds no replay guarantee. Validation runs lazily in the consumer's pass. Cascada owns local poison recovery and its JavaScript export boundary: native JavaScript receives either a complete valid value or a failure, and a stream's valid prefix followed by failure on unrecovered poison. Cascada streams follow source order, stream schemas apply only to a root stream, and tools collect only a root stream. Object field order has no calling semantics; no schema-ordered positional argument mapping is added.

Remaining implementation work includes schema/type integration, finality detection with SDK-compatible consumption and buffering, and specialized adapters. The Cascada runtime bridge follows in Phase 4; it does not block the JavaScript stream contracts in Phase 2. These do not reopen the settled public call conventions. See [tool execution context](#tool-execution-context) and [the result contract](#output-and-result-contract).

### Error Types

Add no new Casai error types. `ConfigError` covers invalid calls, unknown or undecided approvals in `resume()`, and unknown tools in `executeTool()`. Cascada owns poison handling, including across component calls. Inside Cascada, poison affects dependent values, fields, or elements as narrowly as possible. A poisoned element does not end Cascada iteration; a full-stream source failure does. At its native JavaScript boundary, Cascada rejects a complete returned value containing unrecovered poison. For a stream, reaching an affected element rejects the next read and fails that exported stream as a whole: preserve the delivered prefix, yield neither the failed element nor later elements, and preserve the cause. A nested poisoned field counts too. Casai uses this engine boundary without implementing its own poison scanner or conversion. Casai still adapts SDK execution failures for LLMAgent `value` and validates ordinary JavaScript producer output. See [Phase 4 lifecycle](#lifecycle).

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

Phase 1 also fixes a validation bypass. Casai skips input validation when a call's context contains `_toolCallOptions` (`src/validate.ts`), and any direct caller can add that key, for example through `component(request.body)`. Mark the context object that the tool wrapper creates, in a module-private `WeakSet`, and check the mark instead of the key. This is a few lines in the tool wrapper and the three validators; 2a's separate `execute` wrapper later replaces them.

## Phase 2: The Breaking Release

Phase 2 replaces the Phase 1 surface with the final API. It ships as one breaking release, built in three steps; each step passes its own tests before the next begins.

| Step | Scope | Depends on |
| :--- | :--- | :--- |
| [2a: Coded component conventions and JavaScript streams](#phase-2a-coded-component-conventions-and-javascript-streams) | Shared renderer/tool code, stream schemas and collectors, and Function stream producers | Current code and installed Cascada only; it can be built alongside Phase 1 |
| [2b: LLMAgent](#phase-2b-llmagent) | The final language-generation factory and `value` streams, replacing the Text and Object factories | Phase 1's core and 2a stream infrastructure |
| [2c: Tool continuations](#phase-2c-tool-continuations) | `resume()`, with approvals and external tool results | 2b's `messageHistory` |

### Phase 2a: Coded Component Conventions and JavaScript Streams

These changes go through the renderer and tool code that every component shares, so the Phase 1 generators use them too until 2b replaces those generators. Implement two separately reviewable batches within 2a: shared call conventions (items 1–7), then JavaScript stream infrastructure (items 8–9). Each batch has focused checks; 2b depends on both. Build them in this order:

1. **Share environments and compiled code**, as described [below](#sharing-environments-and-compiled-code). It is internal and changes no behavior. Derived variants that share rendering setup can reuse compiled code and loader caches; per-request settings belong in `.run()`.
2. **Rename Cascada's `options` to `renderOptions`** on every component. 2b uses `options` for SDK custom call options; the Phase 1 `callOptions` setting is not carried forward.
3. **Parse input once per call path**, as described in [Reuse Casai Preparation](#reuse-casai-preparation-and-isolate-runs). Tools get a separate `execute` wrapper, so a direct call to a `Function.asTool` is validated, and tool calls are identified without any marker in the context.
4. **Pass execution options to Function callbacks and `.withFunction` preparers** as their second argument on every call: the call's `abortSignal`, plus `toolCallId` and `messageHistory`, the SDK's `messages`, on model tool calls. A preparer that fetches documents or opens audio can then pass the signal on. See [the Function contract](#function-producer-contract-and-types).
5. **Build one flat implementation context.** Direct calls take named fields in one object. Tool-registry calls obtain model/caller arguments and trusted tool data separately. Validate each source once, then merge parsed data into the component context; see [tool execution context](#tool-execution-context).
6. **Add `tools` and `toolsContext`** to Template, Script, and Function, calling each tool as a model would. See [tools in coded components](#tools-in-coded-components).
7. **Accept Cascada object-literal and keyword calls** as equivalent named input objects. See [calling components from Cascada](#calling-components-from-cascada).
8. **Build JavaScript stream infrastructure**: distinct text/element kinds, `textStreamSchema()`, `streamSchema(elementSchema)`, and their collectors. These require no new Cascada exports.
9. **Support Function stream producers and tools**: wrap the callback's async iterable once, validate elements lazily, propagate producer failures and cooperative cancellation, and collect finite streams only on tool execution.

Template, Script, and Function keep ordinary calls and gain `.run()`: Template takes `{ template?, context?, toolsContext?, abortSignal?, timeout? }`, Script takes `{ script?, context?, toolsContext?, abortSignal?, timeout? }`, and Function takes `{ context?, toolsContext?, abortSignal?, timeout? }`. The Function callback and schemas stay fixed at creation. These calls return the same value or stream as ordinary invocation. Every callable, including Function and tool forms, exposes resolved configuration through `.config`; SDK tool properties remain directly accessible. Implement execution-option handling and cooperative cancellation in the JavaScript/SDK paths now. New Cascada interruption and cleanup support, and automatic nested propagation, are not prerequisites for 2a; retain their separate upstream scope. Accepting a signal does not promise that unsupported engine work can be interrupted.

#### Sharing Environments and Compiled Code

Cache environments and compiled code separately. An environment is keyed by the settings that configure it: `loader`, `filters`, and `renderOptions`. A component derived from a parent that keeps those settings shares the parent's environment, including its cache of loaded resources. Compiled code is keyed by environment, source, and template/script mode, so a changed source compiles again within the shared environment; only a change to those three settings creates a new environment. Casai never changes an environment after creating it, so sharing is safe. Settings that don't affect rendering, such as `abortSignal`, `timeout`, context values, or model settings, never cause recompilation. Do not move compiled code between environments. Today each component creates its own environment, so this replaces that behavior.

#### Stream Ownership and Runtime Responsibilities

Casai streams use ordinary consumption. Passing a stream to a component permits that component to consume it. Returning the same source does not rewind it or restore consumed items: it may have unread items, be exhausted, or have been closed. A fresh producer returns a fresh consumable stream. Casai adds no replay cache, cursor registry, or custom concurrent-reader locking policy. Native source contracts still apply.

Cascada's installed engine already shares async iteration within its loops by default. Several loops over the same source can each read the retained sequence; this is engine behavior, not a Casai return-value guarantee. Passing that source to JavaScript or returning it retains native consumption behavior. JavaScript callers can explicitly request sharing through Cascada's `makeSharedIterable`; its `replayAsyncIterables: false` environment option selects native loop consumption. Casai need not disable internal loop sharing to preserve ordinary JavaScript stream consumption.

Cascada owns its shared buffer, cursors, and source lifetime. Closing a shared cursor closes only that reader; render completion does not dispose the source. Explicit disposal belongs to the source owner, including when a stream escapes through a return. Casai forwards cancellation and closure through its adapters according to the underlying contract, without introducing another shared-source manager. Runtime sharing does not copy native properties or Casai stream-kind metadata automatically; integration must retain the declared kind without promising object identity for adapted streams.

| Casai responsibility | Implementation boundary |
| :--- | :--- |
| Choose complete or streaming execution | Call the appropriate SDK or Cascada API; invoke Function producers once |
| Declare stream kind and apply component schemas | Validate healthy values lazily in the consumer's pass; use Cascada's validation hooks inside the engine |
| Select final LLMAgent output | Adapt SDK results into `value`, buffering candidates only when finality requires it |
| Surface terminal SDK failures through `value` | Preserve raw SDK protocols while rejecting failed Casai output consumption |
| Collect explicit results and finite tool outputs | Use the existing collectors and one producer execution |
| Forward cancellation and cleanup | Pass execution options and propagate iterator closure; runtimes own scheduling and shared-source cleanup |

Cascada owns source-order assembly, internal poison propagation, and poison-to-failure conversion at its JavaScript export boundary. Casai integrates with those APIs rather than constructing parallel internal/public stream views itself. SDK branching and buffering retain their native contracts. These engine behaviors and final-answer candidate buffering do not create a general Casai replay promise.

#### Stream Schemas and Collection

Phase 2a defines text and element stream kinds in Casai's JavaScript wrappers, including empty streams; never infer kind by inspecting items. Both are async iterables. Phase 2b reuses these kinds for LLMAgent `value`. Phase 4 maps them to Cascada's native `tstream` and `stream` without changing public schemas or collectors.

- `textStreamSchema()` declares a text stream, corresponding to Cascada `tstream`, and checks string chunks. `collectTextStream()` joins them, returning `''` when empty.
- `streamSchema(elementSchema)` declares an element stream, corresponding to Cascada `stream`, and validates elements lazily. `collectStream()` collects them in order, returning `[]` when empty.

Stream schemas describe only a root stream: a Function's returned stream, or a Script's returned `stream`/`tstream`. A JavaScript stream nested in a returned object is an opaque value: Casai doesn't validate its elements, and an output schema that mentions it uses an opaque schema such as `z.custom<AsyncIterable<T>>()`. In Phase 4, Cascada first resolves a native channel assignment to its source-order snapshot; an ordinary output schema then validates the resulting array or string. JavaScript stream references stay opaque and are not recursively drained by that validation or by tool adaptation.

Export both schemas and helpers in Phase 2a. A Function returning a plain JavaScript async iterable acquires its declared runtime kind at the schema boundary. Keep the JavaScript representation internal and adapt it to Cascada's runtime protocol in Phase 4, preserving lazy iteration and producer identity. Do not wait for that protocol to implement or test Function producers, validators, collectors, and tool adapters.

Validate in one pass as the caller consumes the returned stream. Where validation is needed, return a lazy wrapper whose sole reader of the original source pulls an element, validates/transforms it, and forwards the parsed value. The application consumes that wrapper. Its object identity may differ from the producer's stream, but it neither duplicates the producer nor creates a second read of the source, a tee, or a replay buffer. An unread wrapper does not acquire or pull the producer merely to validate its elements.

```text
producer -> lazy schema validation -> caller
```

Text schemas check string chunks; element schemas parse each healthy element once at their declared schema boundary. Reuse validation already performed by Cascada or the SDK for the same output contract instead of adding a redundant wrapper or parse. A different declared schema remains a separate validation boundary. Non-stream schemas parse completed values once. For ordinary JavaScript producers, producer or validation failures reject iteration and collection after any valid prefix; forward early closure to the source according to its contract. Inside Cascada, the engine controls poison-aware validation and export failure, as described in [Lifecycle](#lifecycle). Casai must not turn an internal poisoned element into a source failure through its own wrapper.

Stream schemas do not promise that the entire result is valid before the first element is delivered. Whole-result checks can only be finalized at completion; guaranteeing complete validity before exposure requires explicit collection. Ordinary streaming adds no such eager pass or buffer.

Callers explicitly choose collection helpers, which also accept plain async iterables and consume them in their current state. Casai collects a finite Function stream for a tool according to its schema kind: text joins into a string; elements collect into an array. A Casai tool's `execute` never returns an async iterable to the SDK, which would treat each chunk as a preliminary result and keep only the last one. Tool adapters collect only a root stream; any other result, including an object containing streams, is returned as the component produced it, and making it suitable for a tool is the component's job. Collection consumes the validated stream; it does not rerun the producer or repeat that boundary's validation. Cascada channel returns and source-order snapshots join this contract in Phase 4.

#### Function Producer Contract and Types

Use one `execute` callback. A streaming Function returns an async iterable whose kind is declared by `schema`; no mode flag is needed. Its second argument contains execution options, including cancellation and model-tool metadata when applicable. Validated tool-context fields join its flat first-argument context, while execution metadata stays in the second argument.

Every `.withFunction` preparer uses the same `(context, executionOptions)` callback convention, including specialized components that prepare audio or other non-text inputs. Forward the invocation signal during preparation; check cancellation before starting the backend, and do not start it after preparation has been cancelled. This is cooperative JavaScript cancellation and does not depend on automatic Cascada propagation.

`textStreamSchema()` requires a (promised) `AsyncIterable<string>`; `streamSchema(elementSchema)` requires a (promised) iterable whose producer element type is accepted by that schema. The public stream yields parsed elements and throws on failure, so consumers need no `T | PoisonError` union. Once Phase 2b is available, a Function can forward an LLMAgent's native output stream, retaining final-output selection, any required buffering, and terminal failures. SDK event and transcription streams remain separate protocols.

#### Calling Components from Cascada

Implement this with Phase 2's call-argument normalization. Context inputs use one named object. Cascada accepts object-literal calls such as `multiply({ a: 6, b: 7 })` directly; keyword calls such as `multiply(a=6, b=7)` arrive as `{ a: 6, b: 7, __hasKeywordArgs: true }`. Remove the marker before validation, otherwise `.strict()` schemas reject it and it appears as a template variable, and treat the object as the final input or context argument. Keyword calls then work with each component's positional conventions, such as `greeting('Welcome {{ name }}.', name='Ada')` for a Template's `(template, context)`. On `.run()`, the keyword object is the argument object: `agent.run(context={ topic: 'recycling' }, temperature=0.2)`.

Cascada's marked keyword object is a trailing context argument even when history precedes it: `agent(messageHistory, topic="recycling")` normalizes to the rendered JavaScript call `agent({ topic: "recycling" }, messageHistory)`. This exception applies only to the marked keyword form; JavaScript `agent(messageHistory, context)` and Cascada's equivalent unmarked object-literal form are invalid for rendered agents. Recognize the marker before removing it and applying the ordinary argument order.

Do not map plain positional values to schema fields. `lookupOrder({ orderId: 123, quantity: 2, accountId: 1 })` and `lookupOrder(orderId=123, quantity=2, accountId=1)` are equivalent direct component calls in Cascada. Fields are matched by name, optional fields can be omitted, and schema/property order has no invocation semantics. Existing positional main-input/source/context/history forms remain unchanged; named field inputs introduce no string-versus-source ambiguity. Source overrides can also use explicit fields in `.run()`.

#### Phase 2a Stream Verification

Use local JavaScript producers and the installed Cascada engine; these checks must not require future engine exports. Verify environment reuse across source changes, separate compilation entries for source and template/script mode, and new environments for changed loader/filter/render options. Verify text/element kinds including empty streams, lazy parsing and transforms exactly once, producer return types, collectors on Casai and plain async iterables, normal completion, producer/validation failure, early exit and cooperative cancellation, and finite Function tool collection from one execution. Check that an unread validation wrapper performs no source acquisition or pulls, that each requested element passes through one source reader and one schema parse, and that collection neither re-executes the producer nor repeats validation. Returning a consumed input stream must not restore its consumed prefix. Verify native iteration/locking behavior without a Casai replay or reader-locking layer. Existing Cascada loops must consume these iterables without native stream channels, implicit text rendering, or channel snapshots; with default engine sharing, two Script loops each receive every element. Stream schemas and tool collection apply only at the root. Register mock-only files in `test:local`. Phase 2b adds SDK-backed stream and Function-forwarding checks.

### Phase 2b: LLMAgent

Expose `LLMAgent` through a named export and `create`. Each returned component is callable, has `.run()` and `.config`, and implements the SDK's `Agent` interface. The ordinary call and `.run()` are the Casai calls and run in the component's mode. `.generate()` and `.stream()` exist only for the SDK interface: they take the SDK's call arguments with a literal conversation, never prepare the configured prompt, and always generate or always stream. Document them only with SDK integration.

| Factory form | Ordinary call and `.run()` | SDK `.generate()` | SDK `.stream()` |
| :--- | :--- | :--- | :--- |
| `LLMAgent` | Generate | Generate | Stream |
| `LLMAgent.asStream` | Stream | Generate | Stream |

Support `.withText` (the default), `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, and `.loadsScript`, followed optionally by `.asStream` and then `.asTool`. Streaming and tool adaptation are independent capabilities. A component derived from a streaming parent stays streaming even through the base factory; no reverse-mode modifier is added. There is no `.asAgent` modifier. Preserve configuration inheritance, call parsing, schemas, history, and override isolation.

LLMAgent follows the call conventions shared by every model component:

- Ordinary calls take inputs only, by position, in the order main property, context, secondary input; settings go to `.run()`. The specialized components of Phase 3 follow the same rule.
- A call-time main property has the configured property's type, so `.run({ prompt })` on a `.withTemplate` LLMAgent is a template, as in Phase 1. Literal SDK requests go through the SDK methods.
- Casai uses `messageHistory` wherever it stores or passes a conversation: the call input, the result field, and the execution options' copy of the SDK's tool-call `messages`. `messages` remains only in the SDK methods' arguments.
- Results add `value` and top-level `messageHistory`; see [the result contract](#output-and-result-contract).
- `options` carries SDK custom call options in configuration, `.run()`, and the SDK methods.
- LLMAgent has no configured `messages`. Fixed guidance belongs in `instructions`, and examples or trimming applied to each request belong in a `prepareCall` hook. Phase 1 keeps configured `messages`, as the compatible release.

The `output` setting selects text, object, array, choice, or JSON. Normalize an omitted value to `Output.text()` at runtime and in inferred types. Text and structured output share the same engine and result family. Build `value` streams on 2a's JavaScript stream infrastructure, with the SDK consumption behavior described [below](#stream-consumption). No new Cascada channels or rendering exports are needed.

`LLMAgent.asTool` and rendered combinations expose completed application output to a model. Streaming components can also be tools: consume their one execution, apply the same output-availability and failure rules as `value`, and return validated final output, preserving the completed tool-result contract. Do not rerun generation or return an iterable as the tool result. Direct calls retain their full SDK result and inherited streaming mode. Nested agents can themselves use tools and `stopWhen`.

Replace the Phase 1 Text/Object factory surface as part of this development change, updating demos, exports, types, tests, and documentation together. No public migration layer is required. Preserve explicit or inherited stopping conditions in demos; add `isStepCount(20)` where a demo relied on Phase 1's `.asAgent` fallback. 2b is complete when the final factory with and without `.asStream`, all supported output kinds, prompt modifiers, the call-argument rules, tool adaptation, and SDK helper integration use the Phase 1 core.

#### Modifier Combinations

From Phase 2 on, use at most one input modifier, followed optionally by `.asStream`, followed optionally by `.asTool`. For example, `create.LLMAgent.withTemplate.asStream.asTool(...)` is valid. A tool derived from an already-streaming parent retains that ordinary-call mode and collects only when executed as a tool.

Only LLMAgent and Template expose `.asStream`; Script and Function return streams declared by their schemas, and StreamingTranscriber always streams. Finite streams can become completed tools. A live operation without a completion boundary cannot be implicitly drained into a result. Keep runtime modifier properties and TypeScript chains aligned. Phase 1 retains its compatible generator-only tool support.

#### Updating Demos for Phase 2

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
| `.object` / `.partialObjectStream` | `.value` / `.partialOutputStream` |
| `.text`, `.object`, or `.textStream` read as the component's output | `.value` |
| `.run({ messages: history, ... })` | `.run({ messageHistory: history, ... })`; `messages` belongs to the SDK methods, with the SDK's complete-conversation meaning |
| Configured `messages` | `instructions` for fixed guidance; a `prepareCall` hook for examples added to each request |
| `callOptions` | `options` |
| Cascada `options` | `renderOptions` |
| Direct call to a `Function.asTool`, unvalidated | Validated and parsed through `inputSchema`, like other direct calls |
| `inputSchema` validation-only on direct calls | Parse once, apply defaults/transforms and the schema's unknown-key policy, partitioning declared tool-context fields first |
| Function callback second argument only on model tool calls | Always present: execution options with `abortSignal`, plus `toolCallId` and `messageHistory` on model tool calls |
| `messages` in tool execution options and `_toolCallOptions` | `messageHistory` |
| Tool context in `options.context` or `_toolCallOptions.context` | Casai implementations read validated tool-context fields in their flat context; plain SDK tools keep their native execution-options contract |

The Object mappings also apply to their Phase 1 `.asAgent` variants. Keep model, prompts, tools, and other applicable settings. Phase 1 object-result aliases are not carried into the final factory. The final factory defaults to one step, with or without `.asStream`; preserve explicit or inherited stopping conditions and configure `isStepCount(20)` where a demo relied on Phase 1's fallback.

### Phase 2c: Tool Continuations

Add `resume({ messageHistory, approvals, toolResults, ...settings })` and the `approvals` and `toolResults` fields of `.run()`, as described in [Phase 2 call arguments](#phase-2-call-arguments). They need 2b's `messageHistory`, and nothing else depends on them, so they come last. `resume()` only normalizes the continuation input, then runs an ordinary execution.

## Loop Policy Is Separate from the Interface

For the new core, resolve inherited and local settings before selecting a fallback:

- Phase 1 `.asAgent` components: `isStepCount(20)` if no stopping condition was supplied or inherited.
- Phase 2 `LLMAgent`, with or without `.asStream`: `isStepCount(1)` if no stopping condition was supplied or inherited. This matches the `generateText` / `streamText` default, so an LLMAgent without `stopWhen` behaves like those functions; document that equivalence and that `ToolLoopAgent` instead defaults to `isStepCount(20)`.
- Explicit configuration or per-call conditions take precedence; do not add another hidden limit.

A one-step policy can execute tools; it does not automatically continue with another model call using their results. A step limit counts model steps, not individual tool calls. It is an upper bound, not a promise to run that many steps. Normal completion, pending external tool results, or approval requirements can end an execution earlier. SDK `prepareStep` remains available in either policy.

Providing the `Agent` interface and selecting a stopping condition are independent decisions. In Phase 1, `.asAgent` supplies the interface and a multi-step fallback. In Phase 2, every language-generation component supplies the interface without a modifier. On both paths, `stopWhen` controls continuation and takes a condition such as `isStepCount(1)`, not a numeric count. Template, Script, and Function do not implement this interface or acquire a model-driven loop; their native execution modes are independent of LLMAgent stopping conditions. No internal agent-mode flag or separate `loopCount` setting is introduced.

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

### Phase 2: Casai Calls and SDK Calls

Phase 2 keeps the two entry paths of Phase 1, because the SDK methods now serve only the SDK interface. The ordinary call resolves its positional arguments by type into the same argument object as `.run()`; both run in the component's mode:

```text
Ordinary call / .run(arguments)
  -> normalize arguments; an undefined field counts as not supplied
  -> validate raw call-time context, then prepare the call-time or configured prompt once
  -> assemble messageHistory, then the prepared prompt
  -> validate custom call options and run prepareCall, if configured
  -> generateText / streamText
  -> Casai result/history augmentation

SDK .generate(SDK arguments) / .stream(SDK arguments)
  -> combine configured SDK settings with the call's literal prompt or messages
  -> validate custom call options and run prepareCall, if configured
  -> generateText / streamText
  -> SDK result with top-level messageHistory added
```

The SDK path never prepares the configured prompt, validates `inputSchema`, or renders anything: SDK helpers pass user conversations, and rendering them would run user text as template code. It uses the configured model, tools, output, instructions, loop policy, configured `options` defaults, and hooks. In the installed `ai@7.0.130`, `createAgentUIStream` calls `agent.stream({ prompt: modelMessages, options, abortSignal, timeout, experimental_sandbox, experimental_transform, onStepEnd })`: the conversation arrives as `prompt`, and keys are present even when their value is `undefined`.

### Phase 2 Call Arguments

`.run()` takes these fields; the ordinary call resolves its positional arguments into the first three:

| Field | Meaning |
| :--- | :--- |
| `prompt` | The new turn, replacing the configured prompt. Its type follows the input modifier: literal text or model messages on a plain agent; a template, script, function, or resource name on a rendered one |
| `context` | Rendering input for template, script, and function forms |
| `messageHistory` | Already-prepared conversation history, placed before the new turn |
| `options` | SDK custom call options, validated by `callOptionsSchema`; replaces configured `options` as a whole |
| `approvals`, `toolResults` | Continuation input used with `messageHistory`: `{ approvalId, approved, reason? }` decisions and `{ toolCallId, output }` or `{ toolCallId, error }` results for tool calls the application executed |
| Other settings | Per-call overrides permitted today by Phase 1 `.run()`, including model settings, tools, callbacks, `stopWhen`, and cancellation |

- The prompt is the new turn and `messageHistory` the messages before it. A supplied prompt replaces the configured prompt and follows its input modifier. `.run({ messageHistory })`, also with execution settings, is explicitly history-only: suppress the configured prompt, skip rendering and its input validation, and add no new turn. `.run({ context, messageHistory })` explicitly prepares the configured source for a rendered component. An ordinary zero-input call still uses its configured prompt. Fixed `instructions`, custom options validation, and request hooks apply to history-only calls as usual. An explicitly supplied empty `messageHistory: []` is still history-only; it does not fall back to the configured prompt. To prepare a new turn with empty history, supply `prompt` or, for a rendered component using its configured source, `context` explicitly.
- On a plain LLMAgent, use `agent(prompt, messageHistory?)`. The first argument is a string or `ModelMessage[]` prompt; one array is always prompt messages, and two arrays are new messages followed by history. Arrays carry no history marker and variable names have no runtime significance. History-only invocation uses `.run({ messageHistory })`. Rendered forms retain `(source?, context, messageHistory?)`, with Cascada keyword context allowed last. Do not reinterpret a lone array as history on another modifier.
- `messageHistory` in the result records the conversation, not the request. When `prepareCall` adds example turns or trims history before sending, it changes only what is sent.
- At call time, `undefined` means not supplied. The inheritance rule that explicit `undefined` clears a parent value applies only to configuration inheritance; otherwise SDK helpers would clear configured callbacks, timeouts, and options on every request.
- Call-time callbacks compose with configured callbacks in SDK order, including deprecated-alias resolution, without duplicate installation.
- Contract-defining settings stay fixed: `output`, schemas, `promptType`, `filters`, `renderOptions`, and `loader`.
- `approvals` and `toolResults` continue a conversation whose last turn ended in tool approval requests or tool calls without results. They require `messageHistory`, exclude `prompt`, and append one `tool` message with SDK `tool-approval-response` and `tool-result` parts; nothing is rendered and no user turn is added. Match each decision and result against the calls still pending in `messageHistory`, and reject unknown, duplicate, or already-resolved IDs and pending non-automatic requests left without a decision. Each result entry has exactly one of the own properties `output` or `error`. `output` is the completed application result that the tool's `execute` would return, not an already-encoded SDK result part; a present `output: undefined` is still a success value. Convert successes through the registered tool's `toModelOutput` with the matched call ID and input. Without that converter, including for an unregistered external tool, use the SDK default: text for strings and JSON-normalized output for other values. Convert `error` through the SDK error-text path, bypassing the success converter. Reject contradictory decisions/results, including a success supplied for a denied call, before executing anything. An approved call with an external result must not execute again. Persistence and deduplication across requests belong to the application.

`resume({ messageHistory, approvals, toolResults, ...settings })` is the public continuation method. It runs in the component's mode, generating or streaming on `.asStream`; `.run()` accepts the same fields. Its result carries `messageHistory` like any other call, so applications can persist it between requests. SDK UI helpers don't use it: the UI client sends approval responses within the complete conversation.

Type `.run()`'s argument object from the component's input modifier, and the SDK methods with the SDK's call parameters, where neither `prompt` nor `messages` requires Casai `context`. Required rendering inputs apply only to the Casai path. Verify both paths in types and runtime behavior; do not rely on parameter bivariance to hide an extra rendering-context requirement.

Shared instructions belong in `instructions`. Prompt modifiers affect the Casai prompt only. Preserve supported SDK prompt settings, including validation of system-message placement.

Every invocation starts one execution in its requested mode, potentially with multiple steps. `.stream()` uses real incremental streaming and `.generate()` uses generation directly, whatever the component's mode. Do not route through the opposite default operation, buffer a complete generation into one artificial SDK stream, or generate again after consuming a stream. The final-output `value` projection can buffer candidate output as specified below; it still consumes one genuine SDK streaming execution. Factory construction starts no execution.

Streaming is required by the basic SDK `Agent` interface. Native `.generate()` delegates to `generateText()` and native `.stream()` delegates to `streamText()` through a promise-returning wrapper. Awaiting the latter yields a live stream handle; it does not drain the stream. Phase 1 `.asAgent` components and every Phase 2 `LLMAgent` form can therefore be used directly with SDK UI streaming helpers.

### Tool Execution Context

Casai implementations receive one flat context. `inputSchema` declares caller/model input fields; `contextSchema` declares application-supplied tool-context fields. A Function reads both by destructuring its first argument, and a Template or Script reads them as ordinary variables. Validate the sources separately before merging them; a schema describes data shape, not its provenance.

**Direct component calls** take one named object containing both sets of fields, for example `scale({ value: 2, factor: 3 })` with `value` declared in `inputSchema` and `factor` in `contextSchema`. `.run({ context: { value: 2, factor: 3 } })` is the named invocation equivalent. In Cascada, `scale({ value: 2, factor: 3 })` and `scale(value=2, factor=3)` normalize to the same object. The application supplies any privileged fields on this direct path; an object key by itself does not establish authorization.

**Calls through a tool registry** accept arguments governed by `inputSchema`. The owning LLMAgent or coded component supplies trusted data from its `toolsContext` entry; VoiceSessionSetup does the same through its server execution options. Registry callers cannot replace that source by adding trusted-field names to their arguments. Model calls and injected tool wrappers follow this rule alike. Plain SDK tools keep their native `execute(input, options)` interface, including `options.context`; flattening is the Casai implementation contract.

Use these validation and merge rules:

1. Casai named input/context schemas must describe objects. Where a direct call combines `inputSchema` and `contextSchema` fields, their declared top-level field sets must be discoverable and disjoint. Reject overlapping declarations or an ambiguous schema partition with `ConfigError` at creation rather than guessing from property order. Both schemas must expose plain object shapes with stable declared top-level keys. Field-level defaults, coercions, and transforms are supported, as are refinements whose object shape remains discoverable. Reject object-level reshaping, key renaming, and opaque schemas whose field ownership cannot be established with `ConfigError` at creation; do not execute a user transform to discover its keys. This restriction applies to the combined flat-call partition, not to unrelated output schemas. Move whole-object reshaping into the implementation when that partition is needed.
2. For a direct call, extract declared `contextSchema` fields into a separate raw tool-context object. Pass the remaining fields to `inputSchema`, so strict input schemas do not reject legitimate tool-context fields. Leave other unknown keys with the input: the input schema decides whether to reject, remove, or preserve them. Do not silently project unknown input keys away before strict validation.
3. Parse each raw source exactly once, retaining defaults and transforms. Required `inputSchema` fields must come from call-time input; configured context does not satisfy them. Direct calls supply the `contextSchema` fields explicitly. Calls without `inputSchema` retain ordinary application context unchanged.
4. On model calls the SDK supplies already-parsed arguments and tool context to the separate Casai `execute` wrapper. Injected tool wrappers validate their two raw sources once themselves. Neither path re-enters direct-call validation. Ensure that declared trusted fields can only come from the trusted source, even when an input schema allows extra keys or a trusted field is optional.
5. Create a fresh shallow context by merging configured context, parsed input, then parsed tool context. Declared trusted fields must come from the parsed tool-context source: remove those names from configured/input bindings before that merge so an omitted trusted field cannot fall back to another source. Trusted data wins any remaining runtime collision. Add tool-function fallbacks only for names absent from that effective context. Never mutate the caller's object, shared configuration, tool definitions, or the environment.

The Function callback's second argument carries execution options, including `abortSignal` and, on model tool calls, `toolCallId` and `messageHistory` (the SDK's `messages`). SDK `runtimeContext` remains independent. `_toolCallOptions` is optional in rendering context and must never identify whether validation can be bypassed: use the separate tool `execute` wrapper. Schema field order and inherited property order do not define argument positions or change merge precedence.

### Tools in Coded Components

Template, Script, and Function accept configured `tools` and `toolsContext` with the same inheritance rules as LLMAgent. Their `.run()` also accepts per-call `toolsContext`, typed against the configured tool contracts. Merge that map by tool name; a supplied entry replaces the whole context value for that tool, and an omitted entry retains its configured value. Validate the effective trusted source with the selected tool's `contextSchema` on invocation. Tool wrappers capture the owning run's resolved map, so concurrent requests remain isolated without deriving components or mutating shared configuration. `toolsContext` is execution data, not rendering input or model-supplied arguments. Tool definitions and schemas stay fixed on coded-component `.run()`.

Tool functions are fallback bindings in a fresh shallow copy of the effective context:

1. Validate and partition inputs as described above, then build the flat context from configured values, parsed input, and parsed tool data before adding helpers.
2. Add a callable tool wrapper only if its name is not already an own property of the merged context. Values of `undefined`, `null`, or a non-function still shadow the tool.
3. Never mutate configured context, caller input, tool definitions, or the shared Cascada environment. No global registration or environment inheritance is required.

A shadowed name keeps the application value; calling a non-function fails normally without falling back to the tool. Shadowing affects this convenience binding, not the model's registered tool set. Applications needing both can register the tool under a different name.

Each injected wrapper parses arguments with `inputSchema` and trusted data from `toolsContext` with `contextSchema`, then invokes `execute` once. Its return is the completed tool result. A Casai component's root stream is collected by kind: text joins into a string, and elements collect into an array. A plain SDK tool whose `execute` returns an async iterable follows the SDK convention: each yielded value is a preliminary result, and the last one is the result. Casai tools merge those parsed values into their flat implementation context without a second validation pass; plain SDK tools retain their native execution-options interface.

A plain SDK tool needs an `execute` handler and receives a generated `toolCallId`, an empty `messages` list, and the caller's signal when available. No model made this call, so approval policies do not apply and no chat tool-call events are manufactured. A component explicitly supplied in `context` instead uses its ordinary callable and full result, and shadows an injected tool of the same name.

### Preparing New Turns Without Rendering History

For rendered chat, supply the new message as data in `context` and previously prepared model messages in `messageHistory`, for example `chat({ message: userText }, messageHistory)` or `.run({ context: { message: userText }, messageHistory })`. The configured template owns the source; user text is a variable value, never an additional template to evaluate. No reserved `message` context field is introduced: the application chooses its input schema and variable names.

Validate and prepare only the new call input. Snapshot and reuse history unchanged, then return the dynamic history, rendered prompt messages, and generated messages in top-level `messageHistory` for the application to persist. Script/function preparation may produce multiple new model messages; preserve their roles, content parts, and tool identifiers rather than converting them to one string. Preparation still runs once per invocation, not once per tool-loop step.

Do not infer newness from the last user message in an SDK conversation. The SDK methods' `prompt: ModelMessage[]` and `messages` carry no Casai preparation boundary, and retries, regeneration, tool results, or approvals may include an already-rendered user turn. SDK-shaped requests remain literal. An application that needs new-turn rendering identifies the new input separately and maintains prepared `messageHistory`: it regenerates by calling again with the same input and the earlier history, and continues tool calls with `resume()`. Original UI messages may be stored separately for display. This requires no mutable conversation state inside the shared component or hidden automatic rendering in UI helpers.

## Reuse Casai Preparation and Isolate Runs

Extract explicit preparation and result-adaptation operations from `src/llm-component.ts`, or use an explicit backend descriptor. Its current SDK-function identity checks must not be the mechanism for selecting the new core's message and result behavior.

Organize the shared machinery in four stages: resolve the invocation (configuration, settings, and mode), prepare its input (validation, rendering, and history), execute the operation (the SDK call or native producer), and adapt its result (augmentation, `value`, and tool completion). Keep tool completion in one dedicated adapter and final-answer selection inside the SDK integration layer, so specialized components don't copy LLMAgent logic.

Reuse call parsing and validation, renderer caching, loader resolution, configuration merging, and tool adaptation. Preserve these rules:

- `inputSchema` validates raw call-time context before configured context merges. Configured context cannot satisfy required input fields. Ordinary calls and `.run()` parse once; SDK methods bypass this schema, and model-tool `execute` receives already-parsed input. Preserve defaults and transforms without double parsing. Direct calls partition declared tool-context fields first and leave other unknown keys to `inputSchema`; honor its reject/strip/passthrough behavior rather than restoring keys it removed. Give Function tools a separate `execute` wrapper so direct calls are validated.
- A context field named `prompt` remains data. Function prompts keep context-only calls and function-valued prompt overrides, through `.run({ prompt })` or the first argument. There is no new `input` envelope.
- Tool context from `toolsContext` has its own schema and source boundary; expose its parsed fields in the flat Casai context as described in [tool execution context](#tool-execution-context). SDK `runtimeContext` is independent of rendering context.
- Phase 1 assembles configured messages, dynamic history, then the rendered or literal prompt. Phase 2 drops configured messages, and dynamic history uses `messageHistory`; on the SDK path, a complete `prompt` or `messages` conversation is a literal input block without an added configured prompt. Resolve the assembly to one SDK prompt/messages argument.
- Phase 1 Casai calls retain the current history augmentation while native SDK results remain unmodified. Phase 2 removes the `response.messages` override: `response.messages`, `finalStep.response.messages`, `responseMessages`, and callback response fields keep their SDK meaning. Add top-level `messageHistory` containing explicit dynamic history, the prepared/literal input block, and generated messages across all steps. Request changes made by `prepareCall` do not appear in it. On a stream, expose it as a lazy completion promise without consuming a stream merely to augment it. A terminal execution failure or abort rejects Casai `messageHistory`; SDK fields keep their own completion/error behavior. A legitimate pause for tool approval or an external tool result keeps resumable history and completed steps available even when `value` has no final output. Do not infer whole-execution failure solely from unavailable output or reconstruct a successful partial turn after an abort. A complete SDK conversation is already an input block; include it once and do not infer a new-turn delta. Verify both `[...input, ...result.responseMessages]` and continuation through `messageHistory` without duplicated input.

Build a fresh effective settings object per invocation using the existing shallow map merges and whole-value replacement rules. Never mutate the component's `.config`, `.tools`, or shared SDK settings. Snapshot history before asynchronous preparation, as existing components do. Isolation does not require deep-cloning models, tools, or arbitrary user objects; it requires that Casai's merge and preparation code never write run-specific state into shared objects.

Pass function settings such as `temperature` and `model` directly to `generateText` / `streamText` after resolution. Phase 1 native methods accept only the SDK Agent call parameters: preserve that type instead of casting Casai `.run()` options to them. Phase 2 `.run()` accepts the [call-argument object](#phase-2-call-arguments); the SDK methods keep the SDK Agent call parameters.

In Phase 1, merge `.run()` callback overrides once with ordinary Casai replacement semantics and install each resulting callback once; on the native path, compose configured and call-level lifecycle callbacks. In Phase 2, every call composes them. Composition follows SDK order, including its deprecated-alias resolution, without accidental duplicate installation. Streaming-only settings apply to streaming execution; both SDK methods remain available regardless of the component's mode.

## Custom Call Options and Hooks

Infer SDK `CALL_OPTIONS` from `callOptionsSchema`, separately from Casai input inferred from `inputSchema`. Default to `never` when no custom options contract exists. Use the SDK's public schema and hook types where applicable; validation and `prepareCall` are orchestration owned by Casai when calling the core functions directly, not features supplied by the `Agent` interface alone.

SDK methods and UI helpers use `options`. In Phase 1, Casai configuration and `.run()` use the distinct setting `callOptions`, because `options` belongs to Cascada on the existing factories. Phase 2 renames Cascada's setting to `renderOptions` and uses `options` for custom call options everywhere. A call's options replace the configured value as a whole; never derive them from rendering context.

```typescript
// Phase 2, given a callOptionsSchema requiring accountId:
await researcher.run({
  context: { topic: 'battery recycling' },
  options: { accountId: 'example-account' },
});

// The SDK methods take a literal prompt, skipping rendering and context validation.
await researcher.generate({
  prompt: 'Research battery recycling.',
  options: { accountId: 'example-account' },
});
```

When call options are required, the ordinary call needs configured defaults (`callOptions` in Phase 1, `options` in Phase 2); otherwise callers must supply them per call. Enforce the requirement in types and before model execution. Phase 1 native methods require their own explicit `options`, independent of Casai defaults. In Phase 2, configured `options` apply whenever a call does not supply its own, including calls from SDK helpers. `callOptionsSchema` is fixed at creation.

Validate custom options before invoking `prepareCall`, preserving the SDK's parsed-options semantics. Run that hook once per invocation, after input preparation (after request assembly on the Phase 1 native path). Follow the installed SDK hook contract: it receives resolved settings and returns the complete prepared settings, not an implicitly merged partial override. Preserve the rest of the settings explicitly when changing instructions, including the literal conversation, model, tools, and output. Keep contract-defining settings fixed and the call's `abortSignal` in effect. `prepareStep` belongs to the SDK and runs per model step. Rendering is never repeated for each tool-loop step.

## Output and Result Contract

The language-generation core uses genuine `GenerateTextResult` / `StreamTextResult` with SDK `Output`. These specifications belong to LLMAgent; native Script/Function use one `schema`, and Template produces text. The Phase 2 factory accepts SDK specifications with or without `.asStream`:

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

Casai calls retain all modern SDK result fields, getters, streams, methods, tool events, and metadata. Add history metadata without redefining SDK fields, flattening lazy getters, losing method receivers, or consuming streams. Phase 1 native methods return the original SDK result without Casai augmentation; in Phase 2 every call returns the augmented result, including calls through the SDK methods.

### Final Application Output

Keep `value` beside the SDK fields. It represents the final application output, excluding intermediate commentary and tool activity. The actual invocation mode chooses its delivery, including SDK methods: `agent.stream()` streams even on a complete component, and `streamingAgent.generate()` produces a complete value.

| Output kind | Complete `value` | Streaming `value` |
| :--- | :--- | :--- |
| Text | Final string | Native `tstream` of final-output text |
| Array | Final validated array | Native `stream` of final-output elements |
| Object | Final validated object | Promise of that object |
| Choice | Final validated choice | Promise of that choice |
| JSON | Final parsed JSON | Promise of that JSON |

**Collection invariant:** successful collection of streaming `value` yields the same application data as the same execution's final parsed SDK `output`. This compares views of one execution, not outputs of separate model calls. Native streams preserve output order and runtime kind. Partial object/array snapshots remain on SDK `partialOutputStream`; they are not completed `value` elements. Never concatenate intermediate answers into the final value or fall back to an earlier step's output when the loop stops without final output.

The invariant for incremental delivery requires pure, deterministic output and element schemas: the same raw input produces the same parsed value without side effects. The SDK can validate completed array elements repeatedly during partial updates and again for final `output`. Casai adds no redundant parsing of its own; it cannot promise that the SDK invokes a schema only once. Keep validators inexpensive and perform stateful enrichment, such as assigning random IDs, after validation. Purity is an application contract, not something Casai tries to detect by inspecting functions or running probe validations.

Incremental delivery also requires a reliable append-only representation of the final parsed output. Where the output contract provides no such representation, wait for and reuse the final SDK `output`. For text/array `value` streams, release that final string or its elements after completion; object, choice, and JSON outputs retain their promised final values. Preserve the output kind, execute only once, and do not imitate incremental delivery with timers. This fallback does not change SDK partial-output or event streams.

### Loop Finality and Buffering

An unrestricted tool loop cannot guarantee both final-step-only output and immediate token delivery: text emitted now may belong to a step that later calls a tool and continues. An append-only stream cannot retract it. Preserve output selection and buffer when needed:

1. Stream text or completed array elements incrementally when the answer-producing invocation is known to be terminal.
2. Otherwise retain candidate output until finality is established. Discard intermediate candidates from `value` when execution continues.
3. Release only final output, applying output availability and validation before successful completion. An unrestricted loop may emit nothing through `value` until it finishes; release buffered output without artificial typing delays.
4. Keep SDK `stream` live throughout. Selection must not rerun generation, synthesize activity events, or eagerly create unused branches.

Establish finality from execution control, never from prompt instructions, the absence of tool calls so far, or inspection of an arbitrary `stopWhen` predicate. When it cannot be proved, buffer. Retry and transform handling must preserve the collection invariant: abandoned-attempt text cannot silently become final output. Follow the SDK's consumption, branching, buffering, and cancellation behavior rather than adding a separate Casai limit policy. Final-output selection still needs candidate buffering; avoid retaining additional copies of unrelated activity beyond the SDK views.

Use this conservative list of finality proofs after `prepareCall` and the current `prepareStep` have resolved:

| Effective execution state | What is known | Release through `value` |
| :--- | :--- | :--- |
| No tool calls are possible in the actual step request, and no deferred provider-tool results can cause continuation | This model step is terminal. Examples: no effective tools, `activeTools: []`, or effective `toolChoice: 'none'`, provided tool callers/provider mechanisms introduce no other continuation path | Incremental final-answer output is eligible, subject to stable retry/transform output and final validation |
| Casai's own one-step fallback remains the effective stopping condition | No second model step will run | This alone does not prove an answer exists. If tools remain possible, buffer until the step ends and passes the output-availability rule; never release commentary from a tool/approval-only ending |
| Neither proof above applies, including opaque stopping conditions or uncertain effective tool/provider state | Finality is not proven in advance | Buffer until SDK execution establishes the final step, then release only eligible final output |

A tool without a local `execute` still matters: approvals, client-side tools, and deferred provider results can affect continuation and output availability. Do not equate “no executable tools” with “no tool calls possible.” Observe effective hook results without invoking hooks twice. An explicit `isStepCount(1)` is an opaque SDK predicate unless its identity/provenance is known; do not inspect its function body or call it against synthetic steps. Casai's fallback is known only while hooks and overrides leave it in effect. Even with proven terminality, buffer any prefix that retries or output transforms could replace.

A local mock against the installed SDK 7.0.130 with a tool lacking `execute` and an automatic denial produced two model steps. A separate one-step tool call returned commentary in the raw streaming `output`. These cases require the stricter proof and eligibility checks above.

Applications needing immediate final-answer streaming can use an explicit research/tool phase followed by a single-step answer writer. This is application composition, not an implicit Casai call, new modifier, or hidden synthesis phase. Do not silently add a model call, disable tools, or change stopping conditions. See [the README example](../README2.md#final-answer-streaming-in-tool-loops).

### Execution Events, Steps, and Conversation State

Preserve SDK getters, methods, and events unchanged:

| Property | Complete result | Streaming result |
| :--- | :--- | :--- |
| `output` | Native SDK parsed output | Promise of native SDK parsed output |
| `stream` | Absent | Native SDK execution-event stream |
| `steps` | Array of completed step records | Promise of that array |
| `finalStep` | Final step record | Promise of that record |
| `responseMessages` | Messages produced during this invocation | Promise of those messages |
| `messageHistory` | Casai continuation history: prior messages, new prompt, and produced messages | Promise of that history |

SDK `textStream` includes newly generated assistant text across steps, excluding input history, tool-result objects, and separate reasoning events. `elementStream` and `partialOutputStream` retain their SDK semantics. They are not aliases for final-output `value`. `steps` never becomes an async iterable; use `onStepEnd` for step-completion notifications and `stream` for incremental activity. SDK UI helpers consume `stream`, so buffering `value` does not delay their execution events. Add no `conversation`, `loopStream`, `intermediateStream`, or `events` alias, and do not synthesize a replay stream on complete results.

### Stream Consumption

Follow the installed SDK's language-result ownership model for LLMAgent `value`. A stream handle is consumable; accessing a stream-valued result getter again creates a fresh view of the same buffered execution, not another model call or a reset of the earlier handle. SDK final-result getters such as `output` and `steps` drive consumption automatically, so callers need not drain a stream first. A view obtained afterward replays buffered data through the SDK's existing mechanism. `value` retains Casai's final-output selection and terminal-error behavior under that consumption model; it does not establish a replay guarantee for arbitrary component streams.

Reuse SDK branching and buffering where applicable. The SDK retains a branch for later views, so the prohibition on unnecessary branches means no additional eager, unused Casai branches; it does not forbid the SDK's own replay mechanism. Breaking iteration closes that consumer according to its stream contract; it must not implicitly abort other views of the execution. Request cancellation uses the invocation signal.

Function streams, and later native Script/Template streams, are directly returned stream handles rather than result objects with replay getters. Preserve ordinary consumption and cleanup. Passing a stream to a component permits consumption; returning that source does not restore unread status or consumed items. A lazy validation wrapper can change the returned object while retaining one producer and one pass, as described under [stream schemas](#stream-schemas-and-collection). StreamingTranscriber keeps the SDK's separate single-owner contract for potentially unbounded audio; it does not gain language-result replay.

### Output Availability and Failures

Use one Casai output-availability rule in both modes and tool adaptation. If execution ends at a tool call, approval request, or other state without eligible final output, complete `value` access throws `NoOutputGeneratedError`; streamed `value` iteration or its promised value rejects. Do not treat intermediate commentary as a final answer. A legitimate pause is resumable: its completed steps and `messageHistory` remain available. Empty text remains valid when it is a valid completed text output; do not add a non-empty-output requirement.

Terminal execution failure, abort, timeout, or unrecovered final-output validation failure rejects native iteration. Delivered output remains delivered. Surface final SDK validation errors before successful stream completion, reusing parsed output without revalidating already transformed values. Recovered provider attempts and recoverable `tool-error` events do not automatically fail the whole call. Native SDK fields and event streams retain their own errors and completion behavior; Casai output normalization must not rewrite them.

**Installed SDK regression cases:** mock probes against `ai@7.0.130` found that a two-step text stream included `"Let me check. "` before final `"It is 18 C."`, while final `output` held only the answer. With intermediate array `["draft"]` and final array `["final", "second"]`, SDK `elementStream` yielded `["draft", "second"]` while final `output` was correct. Stopping after a tool call made generation's `output` throw `NoOutputGeneratedError`, but streaming's `output` returned intermediate text. These are version-specific observations to recheck during implementation, not behavior to preserve in Casai `value`. The adapter cannot simply alias raw SDK text/element streams or assume that native output availability is identical in both modes.

### Phase 1 Compatibility

Phase 1 Object `.asAgent` calls add non-destructive `.object` and `.partialObjectStream` aliases for `.output` and `.partialOutputStream`, preserving their promise/stream behavior. These aliases do not recreate the old object event, reasoning, or callback shapes: `.asAgent` opts into modern SDK results. Ordinary Object components retain their existing contracts in Phase 1. Native methods return SDK results without aliases.

Phase 2 uses modern contracts directly, without those aliases or old object event/callback shapes. Update demos to use `Output`, `.value`, and `.partialOutputStream`.

Legacy-only object options such as `mode` and `repairText` (including its deprecated `experimental_repairText` alias) have no direct equivalent in the core. Reject them on Phase 1 `.asAgent` and on the Phase 2 factory, in types and runtime validation, rather than silently ignoring them. Phase 2 also replaces top-level output `schema` and string-valued output modes with SDK `Output` specifications. Do not claim a universally equivalent replacement for old object-only behavior.

## Async Contract and Types

Generation is promise-based. In Phase 1, Casai plain-text streaming with no additional call preparation remains immediate. Existing rendered/loaded/function prompt paths remain promise-based. Configuring `callOptionsSchema` or `prepareCall` selects a promise-based preparation path, even when a particular schema or hook happens to finish synchronously. `.run()` return types follow its effective preparation requirements. Types must not advertise an immediate result when asynchronous preparation is possible.

In Phase 2, the ordinary call and `.run()` of an `.asStream` component, and the SDK `.stream()`, always return a promise for the live stream result, so the return type no longer depends on configuration and preparation errors always reject.

Native `.generate()` and `.stream()` always return `PromiseLike` as required by the SDK `Agent` interface. This requirement applies to the native method, not the Casai callable. Wrapping a stream handle in a promise does not wait for the stream to complete. Preserve lazy consumption, abort behavior, and native error timing.

Extend the actual SDK `Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>` type, with type-only imports, rather than copying a simplified interface. Import it under its own name; Casai exports no `Agent` factory, so no alias is needed. Add the appropriate Casai callable, `.run()`, `.config`, and metadata contracts. Infer tools, runtime context, output, and callbacks from the final inherited configuration; do not hard-code rendering context as SDK runtime context.

Expose `readonly version: 'agent-v1'`, `readonly id: string | undefined`, and `readonly tools: TOOLS`, normalizing absent tools to `{}`. Keep output/schema contracts, `promptType`, and renderer setup fixed through per-call arguments; constrain tool overrides to the existing tool signatures. Add new settings to `Config` validation and inference as well as the factory types. Components hold no hidden conversation state.

## Verification for Phases 1 and 2

Use mock models and register new mock-only files in `test:local`. Cover these boundaries in focused tests and the existing type-checking workflow. Run each Phase 2 step's checks when the step lands: the coded-component, tool, keyword-call, and [JavaScript stream checks](#phase-2a-stream-verification) with 2a, the `resume()` items with 2c, and the rest with 2b.

- Both SDK modes and the correct default operation on all four Phase 1 `.asAgent` factories and on the Phase 2 factory with and without `.asStream`, with every supported output kind.
- Real incremental streaming through `LLMAgent`'s SDK `.stream()` and direct generation through `LLMAgent.asStream`'s SDK `.generate()`, with only one execution in the selected mode.
- Phase 2 call arguments: call-time prompts typed by every input modifier and prepared like the configured prompt, `messageHistory`, string/message-array prompts in first position, two-array calls, history-only `.run()` suppressing configured preparation even with empty history, explicit prompt/context starting a new turn with empty history, and Cascada keyword context after history, rejecting the unmarked reversed JavaScript/Cascada form, `undefined` as not supplied, and configured `options` defaults. On the SDK path: literal `prompt` and `messages` never rendered or validated as input, and the exact `createAgentUIStream` call shape against every input modifier.
- New-turn rendering with previously rendered history unchanged; user text containing template syntax treated as data; script/function preparation returning multiple messages; reuse of prepared messages for regeneration and tool/approval continuations; top-level full-conversation history without guessing which input messages are new, and unchanged SDK response/responseMessages/callback fields without duplicated input.
- Phase-specific defaults (twenty steps in Phase 1, one in Phase 2), text as the default for text/universal factories, a single-step tool call versus a continuing tool loop, inherited/explicit stopping conditions (including custom predicates and arrays), isolated run overrides, and approval/external-result continuations.
- Existing modifier, loader, parent, input-schema, prompt-override, function-prompt, history, and tool-adapter contracts.
- Complete modern output and event fidelity, Phase 1 object aliases, schema validation, and rejection of unsupported legacy options.
- Phase 1 native methods bypassing Casai preparation while retaining custom call-option validation and hooks; UI helper compatibility with tool and approval messages in both phases.
- Concurrent runs with different model settings, tools, callbacks, context, and history; unchanged component configuration afterward. For Template/Script/Function, verify per-call `toolsContext` inference, merge-by-name with whole-entry replacement, validation, wrapper capture, and isolation across concurrent requests; tool definitions/schemas remain fixed.
- Phase 1 callback replacement/composition and Phase 2 composition, without duplicates; preservation of `onChunk`, `onError`, `onAbort`, cancellation, and streaming transforms.
- Phase 1 immediate plain streaming versus asynchronous preparation, promise-only streaming in Phase 2, promised SDK streaming, and no consumption merely to return a stream result. Verify inherited streaming mode without changing independently invoked child components.
- Required custom call options, native options independence, actual SDK Agent assignability, output/tool/runtime-context inference, and invalid overrides under exact optional property types.
- Input parsed once per path, including type-changing transforms and direct Function tool validation. Cover direct flat-object partitioning, strict/strip/passthrough input policies, declared schema overlaps, undiscoverable partitions, rejected top-level reshaping, supported field-level defaults/coercions/transforms, and configured context not satisfying required input fields.
- The Function and `.withFunction` preparer execution-options argument on direct and tool calls, including specialized preparers, signal forwarding during preparation, and no backend invocation after cancellation; equivalent JavaScript/Cascada named objects and Cascada keywords with marker removal, reordered/omitted optional fields, unchanged source/context/history forms, and no schema-ordered positional expansion.
- `.run()` on every callable component matching ordinary-call mode/result, coded execution settings, Function `.config`, and rejection of positional execution settings.
- Separate argument/context validation followed by the same flat implementation context on direct and registered-tool calls. Cover trusted optional fields, attempts to supply trusted fields through registry arguments, parsed-value merge precedence, and unchanged plain SDK tool execution options.
- Fallback tools: injection after validation, configured/call-time shadowing including `undefined` and non-functions, shallow-copy isolation across concurrent calls, and unchanged model tool registration. Distinguish root text/element stream collection from SDK preliminary tool results: consume the latter once and return only the final yielded value, propagate producer failure, and preserve SDK empty-iterable behavior. Do not collect preliminary results into an array or execute twice.
- `_toolCallOptions` only on model tool calls, and a direct call carrying that key still validated.
- No configured `messages` on LLMAgent, and `messageHistory` unchanged by `prepareCall` request changes.
- SDK-compatible consumption: repeated stream-valued getter access produces independent views of one execution; final-result promises drive completion; later views replay buffered data; cancelling one view preserves others. Verify Function forwarding and finite-stream tool collection without another execution.
- `value` in each actual invocation mode and output kind, with successful text/array collection equal to the same execution's parsed `output`. Cover intermediate commentary, intermediate structured output, finality proved before emission versus candidate buffering, custom stop conditions, and unchanged SDK/UI event delivery while `value` waits.
- Output-schema purity: deterministic coercions/transforms preserve collection equality despite repeated SDK validation; Casai adds no parsing pass. Retain a stateful-transform counterexample as a documented unsupported incremental case, without attempting runtime purity detection. Verify final-output fallback when no stable incremental representation is available.
- Finality proofs: no tools, tools disabled by `toolChoice` or `activeTools` after hooks, hooks that re-enable tools, Casai's unchanged one-step fallback, opaque custom predicates, approval denials without local `execute`, and deferred provider results. Distinguish a terminal step from an eligible answer and preserve retry/transform prefix stability.
- The installed-SDK regression cases above: intermediate array elements never leak into final output, and tool-call termination reports no eligible output consistently in both modes and tool adaptation. Legitimate approval/external-result pauses retain steps and resumable history; do not substitute an earlier successful step.
- Terminal error/abort/validation rejection after a delivered prefix, valid empty outputs, recovered tool/provider errors, retries and transforms without abandoned/duplicated output, lazy branch creation, cancellation while buffering, and no extra model execution or simulated typing.
- Native SDK result types remain unchanged: `steps` is an array or its promise, `stream` exists only on streaming results, and no additional activity aliases are exposed. Verify `onStepEnd` notifications, final-step metadata, and output parsing without revalidating transformed values.
- `resume()` and the `approvals` / `toolResults` fields in both modes: persisted history, pending-only matching, unknown/duplicate/already-resolved IDs, undecided and automatic requests, mutually exclusive success/error fields, explicit undefined success, custom `toModelOutput` and default conversion, error-text conversion, contradictory denial/success pairs, and no re-execution when an approved call already has an external result.

Phase 2 reuses the core behavior tests and adds final factory, `.asStream`, default-output, tool-output, and updated demo contracts. Verify that the final factory exposes both SDK methods with and without `.asStream`, under single-step and multi-step policies, supports `.asStream.asTool` and inherited streaming tool mode, runs `.run()` in the component's mode, and has no `.asAgent` modifier. Neither phase requires paid LLM calls to verify these boundaries.

## Cancellation, Timeouts, and Usage

Every callable accepts `abortSignal` and `timeout` through `.run()`; coded components receive this entry point in Phase 2a. Implement option handling, cooperative Function cancellation, and SDK/tool signal forwarding before new Cascada work. Cascada execution interruption and owned-work cleanup need upstream support, but do not block Phases 1–3. Automatic propagation from arbitrary Script/Template/Function calls into nested components remains planned. LLMAgent reports its own SDK usage and callbacks.

Cancellation that reaches every nested call automatically, aborted calls producing poison, stopping in-flight work when a stream consumer leaves, and usage for whole workflows are future features, recorded in [abort.md](abort.md) and [future.md](future.md). Workflow usage will come from Cascada's global telemetry channel, so Casai needs no call-tracking mechanism of its own. Both global channels need async context tracking, which also carries them through plain JavaScript such as Function callbacks. With them, every component, including Template, Script, and Function, will accept `abortSignal` and `timeout` in its configuration.

Verify, with mocks, per-call `abortSignal` and `timeout` on every component with `.run()`, forwarding of the SDK tool `abortSignal` through `.asTool`, and the Function callback's `abortSignal`.

## Phase 3: Specialized Components

Add the following factories after the language-generation API is established. All APIs in this section are planned, not implemented exports. Reuse Casai's component infrastructure with operation-specific SDK backends and result types; these components do not use the language-generation loop core merely because they invoke a model.

[README2.md](../README2.md#the-casai-components) is the public guide to these target components. Specialized components follow the common call convention. The [ordinary call](#ordinary-calls) takes the operation's main input by position. `.run()` takes the corresponding SDK input fields, listed in the table below, and permitted per-call settings by name. Resolve defaults from component configuration, preserve fixed result-defining contracts, and isolate overrides. The Embedder's ordinary call accepts a string or an array. Support all applicable input and tool modifiers according to the contracts below. VoiceSessionSetup prepares browser connections and executes server tools; a live VoiceSession remains a separate future contract.

| Factory | `.run()` input fields | Backend / responsibility |
| :--- | :--- | :--- |
| [Decision](../README2.md#decision) | `state` | `experimental_decide`: named choice, boolean, and score questions against shared state |
| [Embedder](../README2.md#embedder) | `value` or `values` | `embed` for a string; `embedMany` for a string array |
| [Reranker](../README2.md#reranker) | `query`, `documents`, `topN` | `rerank`: rank candidate documents against a query |
| [ImageGenerator](../README2.md#imagegenerator) | `prompt` | `generateImage`, including editing and multiple images where supported |
| [Transcriber](../README2.md#transcriber) | `audio` | `transcribe`: recorded audio to a completed transcript |
| [StreamingTranscriber](../README2.md#streamingtranscriber) | `audio` | `experimental_streamTranscribe`: live raw audio to incremental transcript events |
| [SpeechGenerator](../README2.md#speechgenerator) | `text` | `generateSpeech`: text to audio |
| [VoiceSessionSetup](../README2.md#voicesessionsetup) | `context`; also `.executeTool()` | Server half of a browser realtime session: token and session configuration, plus server-side tool execution |

Decision, StreamingTranscriber, and VoiceSessionSetup wrap experimental SDK features (`experimental_decide`, `experimental_streamTranscribe`, and the realtime API). Export them as `Experimental_Decision`, `Experimental_StreamingTranscriber`, and `Experimental_VoiceSessionSetup`, following the SDK's capitalized `Experimental_` convention, and drop the prefix when the SDK stabilizes the feature.

Specialized components have no `.generate()` or `.stream()`. Those names belong to LLMAgent's SDK interface, which these components do not implement.

These names describe different operations and lifecycles, rather than variants distinguished only by a stopping condition. `Decision` is preferred to `DecisionAgent`: its result is a set of decision answers, and it does not implement the SDK Agent contract. OpenAI's Decisions endpoint does not accept tools. Lack of tools alone does not disqualify an agent; a language-generation agent can have an empty tool set. See the [Decisions reference](https://developers.openai.com/api/reference/resources/decisions/methods/create).

### Phase 3 Modifier Contracts

Support every existing modifier with meaningful semantics for the component. The [README2 support matrix](../README2.md#modifier-support) specifies the planned combinations; it is a requirement for Phase 3, not an inventory of undecided features.

- `Decision`, `Embedder`, `Reranker`, `ImageGenerator`, and `SpeechGenerator` support `.withText`, `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, `.loadsScript`, and `.asTool`.
- `Transcriber` supports `.withScript`, `.withFunction`, `.loadsScript`, and `.asTool`. `StreamingTranscriber` supports those preparation modifiers, but `.asTool` is available only after `.withScript`, `.withFunction`, or `.loadsScript`. The preparer turns named tool arguments into a bounded raw-audio stream; the tool collects the completed transcript. The plain factory exposes no `.asTool` in either types or runtime modifier properties.
- `VoiceSessionSetup` supports all seven text/script/function/loading modifiers for preparing session instructions. It has no `.asTool`.
- The `.asAgent` factory modifier remains exclusive to Phase 1. `.asStream` belongs to `LLMAgent` until Phase 4 extends it to Template; Script, Function, and specialized components do not use it. Phase 4's coded components keep native contracts. None of these features adds Agent assignability or a tool loop to a specialized operation.

Modifiers apply only where their output fits the operation's input. Text/template preparation targets decision text state, a single embedding value, the reranking query, image prompt text, speech text, or voice-session instructions. A text or template modifier produces one string, so it never prepares an embedding batch; Script and Function preparers can return a string array for `embedMany`.

Each component's main property is the field named after the input it prepares: `state` (Decision), `value` (Embedder), `query` (Reranker), `prompt` (ImageGenerator), `audio` (Transcriber, StreamingTranscriber), `text` (SpeechGenerator), and `instructions` (VoiceSessionSetup). As on LLMAgent, a call-time value in that field has the configured value's type and replaces it for one call. Keep separately configured documents, image references, and masks intact when preparing text. `.loadsText` and `.loadsTemplate` use the normal text loader contract.

Script and function preparation can return the component's typed input: native decision state; a string or string array for embeddings; a query string or explicit `{ query, documents }` for reranking; an SDK image prompt; recorded audio values; a live audio stream; speech text; or session instructions. Only these declared input fields can come from a renderer; arbitrary configuration and fixed result contracts cannot be replaced through its output. For an explicit reranking input object, its query and documents form one prepared input and must not be mixed with another input's documents.

Parameterize preparation validation by the operation's input type. The existing language prompt validator (`string | ModelMessage[]`) cannot validate audio streams, embedding batches, or image-editing input. Preserve non-JSON values, binary data, and streams without cloning, stringifying, or consuming them. `.withScript` and `.loadsScript` return values directly; a `.withFunction` preparer receives the context and, as its second argument, the call's execution options. Generalizing preparation must not weaken existing language-message validation.

Rendered variants take rendering context in the ordinary call and in `.run({ context, ...settings })`, with raw call-time `inputSchema` validation before configured context merges. Ordinary calls take no settings, so no argument is ever classified as context or settings by inspecting its keys. Renderer type and result-defining contracts remain fixed at creation; call-time main properties follow the selected renderer's ordinary Casai convention. Runtime settings remain isolated per invocation.

Transcribers have no text/template modifiers for their audio payload. Even a base64 string is audio data rather than prompt text, and a text loader does not open a raw-audio stream. Script/function preparation can fetch audio or create a stream, while `inputAudioFormat` and other settings use the ordinary configuration path. Do not consume live input while preparing the call. Voice instructions are prepared once for each new session, never for every incoming audio chunk, and the session owns connection cleanup and cancellation.

Completed-result components support `.asTool` after any of their applicable input modifiers. Reuse description/input-schema requirements, validation, execution context, and callable-tool composition. Without an input modifier, tool arguments are the operation input; with one, they are the preparation context. The `execute` result goes to the application and UI, and the SDK tool option `toModelOutput` decides what the model receives:

| Component | Tool arguments without a modifier | `toModelOutput` default | `execute` result |
| :--- | :--- | :--- | :--- |
| Decision | `{ state }` | Answers | Answers |
| Embedder | `{ value }` or `{ values }` | Vectors | Vectors |
| Reranker | `{ query }` only; candidates from configured `documents` or a preparer | Top `topN` `{ document, score }` entries | The same entries |
| ImageGenerator | `{ prompt }` | Content output with image file parts | `{ mediaType, base64 }` per image |
| Transcriber | `{ audio }`, as a URL | Transcript text | Transcript text, segments, and metadata |
| StreamingTranscriber | No plain tool form; requires a preparer whose context is defined by `inputSchema` | Final transcript text | Final transcript text, segments, and metadata |
| SpeechGenerator | `{ text }` | A short text confirmation | `{ mediaType, base64 }` |

`.asTool` accepts a user `toModelOutput`, for example to send text instead of images to models that can't read images in tool results; the SDK exposes no image-input capability flag for an automatic check. Image content in tool results is converted by the installed Anthropic provider and OpenAI's Responses API, so no prompt rewriting is needed. Keep `execute` results serializable for UI tool parts. Preserve full results for direct invocation; a universal `.output` accessor or binary-to-string conversion is insufficient. A StreamingTranscriber tool takes serializable named preparation arguments validated by `inputSchema`, such as `{ recordingId }`, never a model-supplied stream. Its script/function preparer opens a fresh raw-audio stream for each execution, with finite input or an explicit normal completion boundary and the configured audio format. Do not share a consumable audio source across tool calls. Collect the final transcript once, not concatenated partial/final events; direct component calls retain the live SDK result. Do not drain an indefinitely open voice session to manufacture a tool result.

### Ordinary Calls

Each specialized component's ordinary call follows the common rule: inputs by position, settings only through `.run()`.

- Plain form, without an input modifier: `component(input)`, where `input` is the operation's main input. Reranker takes `(query, documents?)`. The main input can itself be an object or an array, such as an Embedder batch or an image-editing prompt, so plain forms resolve arguments by position, not type.
- With a text, template, or script modifier: `component(context)` or `component(main, context)`, where `main` is a one-off template, script, or resource name, as on Template and Script. With `.withFunction`: `component(context)`.
- The order is always main property, context, secondary input, so a rendered Reranker takes `reranker(context, documents)`.
- From Cascada, keyword arguments arrive as a final object. A rendered component's `route(customer=name)` passes context. A plain component takes them through `.run()`: `speaker.run(text='Hello', voice='alloy')`.

| Component | Plain ordinary call | `.run()` | Example |
| :--- | :--- | :--- | :--- |
| Decision | `(state)` | `{ state, ...settings }` | `route('My order arrived damaged.')` |
| Embedder | `(valueOrValues)` | `{ value }` or `{ values }`, with settings | `embedder(['First', 'Second'])` |
| ImageGenerator | `(prompt)` | `{ prompt, ...settings }` | `illustrator('A watercolor workshop')` |
| Transcriber | `(audio)` | `{ audio, ...settings }` | `transcriber(recordedAudio)` |
| StreamingTranscriber | `(audio)`; `inputAudioFormat` is usually configured | `{ audio, ...settings }` | `transcriberStream(audioStream)` |
| SpeechGenerator | `(text)` | `{ text, ...settings }` | `speaker('Your replacement is on its way.')` |
| Reranker | `(query, documents?)` | `{ query, documents?, topN?, ...settings }` | `reranker(question, candidates)` |
| VoiceSessionSetup | `(instructions?)`; rendered forms take context | `{ instructions?, context?, ...settings }` | `support({ company: 'Acme' })` |

Reranker candidates usually change on every call, so they come second; with configured documents, `reranker(question)` is enough. VoiceSessionSetup's ordinary call prepares a browser session; `executeTool()` stays a named method.

### Embedder Calls and Results

Accept a string or an array of strings directly. No `value` wrapper is required on the callable. The array always means a batch; never concatenate it into one input or reinterpret it as message parts.

```typescript
// Proposed Phase 3 API. embeddingModel is supplied by the application.
const embedder = create.Embedder({ model: embeddingModel });

const one = await embedder('First document');
console.log(one.embedding); // number[]

const many = await embedder(['First document', 'Second document']);
console.log(many.embeddings); // number[][], in input order

// Per-call settings go through .run(), with the SDK input field names.
await embedder.run({ values: ['First document', 'Second document'], maxParallelCalls: 2 });
await embedder.run({ value: 'Another document', abortSignal: AbortSignal.timeout(5_000) });
```

Implement string and array overloads with their corresponding SDK result types. On the plain component, `.run()` accepts exactly one of `value` or `values`. Settings apply to that invocation only; neither form mutates `.config`. Rendered variants follow the [modifier contracts](#phase-3-modifier-contracts): text and template preparation yields one value, while script/function preparation yields one value or a batch. Do not change the existing LLMAgent context argument convention.

Delegate to `embed` / `embedMany`, preserving SDK settings, usage, warnings, metadata, and responses. Let the SDK handle batch splitting and concurrency; do not implement batches as unrelated calls to `embed`. Keep batch-only settings such as `maxParallelCalls` on the array path. A future multimodal input form must be explicit and preserve the meaning of `string[]`. See [SDK embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings).

### Reranking and Decisions

Reranking commonly improves RAG after initial retrieval: retrieve candidates using vector, keyword, or hybrid search, rerank them against the query, then provide the best candidates to the answering agent. It also serves ordinary search and recommendation workflows. `Reranker` uses the SDK's `query`, `documents`, and `topN` semantics and preserves original indices, relevance scores, and document values. It does not create embeddings or manage a vector database. See [SDK reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking).

`Decision` preserves the SDK's named questions, answers, optional distributions, provider metadata, and refusal/error behavior. It can be composed before an agent for routing or exposed through a tool adapter. Choosing an enum or `Output.choice()` on an LLMAgent continues to use language generation; it does not select the Decisions endpoint. The installed SDK exposes `experimental_decide`; provider capabilities and experimental contracts must be checked against the version used for implementation. See [SDK decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions).

### Transcription and Voice

Streaming transcription is supported by the installed `ai@7.0.130` as `experimental_streamTranscribe`. `StreamingTranscriber` requires a model that supports streaming, raw audio chunks, and the matching `inputAudioFormat`. Preserve transcript delta/partial/final events and final transcript metadata. Return the live SDK result without waiting for completion; asynchronous Casai preparation may require a promise for that handle. Unsupported models must report an error rather than silently buffer a complete recording.

The SDK result's `fullStream` has a single consumer. Access it before final-result promises when both events and the final transcript are needed; awaiting a final result first consumes the stream internally. Casai must not consume it during preparation or result augmentation. See [SDK streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription).

Keep this native transcription contract rather than adding `textStream` or `partialOutputStream` aliases, and add no Casai `value`: when transcription is stopped or fails, its stream ends as the SDK ends it. How live transcription ends is less deterministic than the other components, whether it is stopped or fails, and the transcript received up to that point is still needed, so it is kept rather than discarded by a whole-stream failure. Incremental consumers handle transcript events explicitly; a workflow can await `text` for the final transcript. Phase 4 does not automatically forward transcription events into a Template or Script text stream. A future adapter would need explicit event and consumption semantics.

`Transcriber` handles complete recordings and returns the SDK transcript result. `SpeechGenerator` preserves generated audio, media information, and provider metadata. Neither operation is a persistent conversation. See [SDK speech generation](https://ai-sdk.dev/docs/ai-sdk-core/speech).

`VoiceSessionSetup` is the server half of the SDK's browser realtime design. In the installed SDK, the browser session (`AbstractRealtimeSession`) owns connection, audio capture and playback, text input, interruption (`cancelResponse`), and tool-call delivery (`onToolCall`, `addToolOutput`). The server creates a short-lived client secret through the provider, with `sessionConfig` carrying instructions and voice, and returns a `RealtimeSetupResponse` of `{ token, url, expiresAt, tools }`.

- The ordinary call, or `.run({ context, ...settings })`, validates input, prepares `instructions` once, builds tool definitions with `getRealtimeToolDefinitions`, creates the client secret, and returns the setup response. Each call starts an independent session; the component stores no session state.
- `executeTool({ toolCallId, toolName, args }, { toolsContext, abortSignal })` receives the browser call separately from trusted server settings. Resolve the tool in the server-owned configuration used for that session, parse arguments and selected trusted context separately, and execute once with cancellation. Reject unknown or unavailable tools. Bind both HTTP routes to the same server-owned tool configuration; retain/recover session-specific configuration in the application, not mutable component state or browser arguments. Casai callbacks receive the validated fields in their flat context under the common tool-execution contract.

Casai handles no audio or browser transport. A separate live `VoiceSession` contract remains planned: realtime models declare a `server-websocket` connection (OpenAI's Live API requires it), and the SDK exports audio encoding and resampling helpers. A server session would accept a raw audio input stream with its format, matching StreamingTranscriber, and return session events with output audio, transcripts, and interruptions. Casai would own the provider connection and the session loop that the browser class implements today; applications bridge their own transport. It is not a `StreamTextResult` or an implementation of the SDK Agent interface. See [SDK realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime).

### Shared Infrastructure and Capability Boundaries

- Reuse configuration inheritance, isolated overrides, all applicable modifiers, validation and rendering, cancellation, telemetry, and errors. Keep backend-specific models, settings, inputs, and results typed rather than exposing one universal options object.
- Preserve structured inputs and binary data. Existing image/file message parts and script/function prompts returning messages already support image understanding through compatible language models; retain this in Phases 1 and 2. Phase 3 adds dedicated image generation/editing, not image-input support from scratch.
- Preserve full results, including generated files/content, usage, provider metadata, and operation-specific streams. LLMAgent `output` remains an SDK parsing specification, not a switch to image, embedding, or decision endpoints.
- Specialized components do not implement the SDK Agent interface or expose `.asAgent`, `.asStream`, `.generate()`, or `.stream()`; StreamingTranscriber always streams. Tool composition is independent of Agent assignability. A tool adapter must explicitly map the operation's result, including media where applicable; it cannot universally read `.output`.
- Keep approvals and continuations supported on language agents. Future background jobs and resumable operations need explicit execution state/handles; do not store them in shared `.config` or simulate them by buffering streams. Their exact public APIs are outside this phase's factory naming decisions.

### Phase 3 Verification

Use mock backends and the existing type-checking workflow. Verify string versus array embedding overloads, one vector per input in order, SDK batch delegation, batch-only settings, explicit `.run()` input selection, `.run()` matching the ordinary call on every specialized component, ordinary calls rejecting settings, and concurrent override isolation. Cover decision distributions/refusals and reranking indices; image edits and multiple outputs; binary/message preservation; streaming transcript events, cancellation, error propagation, final metadata, and single-consumer behavior, preparer-only transcription tools accepting named arguments, opening independent bounded streams per call, collecting once and rejecting failures; and VoiceSessionSetup calls creating independent sessions with prepared instructions and tool definitions, and `executeTool()` validating arguments and server-supplied context separately, forwarding cancellation, using the session tool configuration, and rejecting unknown/unavailable tools. Verify the `Experimental_` export names. Confirm that specialized components retain their own result contracts without being advertised as SDK Agents. Register new mock-only tests in `test:local`; these checks need no paid model calls.

Cover every checked modifier combination, inline versus loaded preparation, the correct source field, single-value template preparation for Embedder with batches only from script/function preparers, structured preparation validation, context/override separation, and tool argument and result mappings, including `toModelOutput` defaults, user overrides, and image content. Verify that audio streams remain unconsumed, session instructions are prepared once per connection, and unsupported text/audio combinations, plain StreamingTranscriber tool forms, and unbounded live-session/tool combinations are rejected in types and runtime validation where determinable. Runtime failure or cancellation must reject collection rather than turn an incomplete transcription into success.

### Specialized Result Implementation

The supported operations, modifier combinations, preparation destinations, call forms, and tool-result mappings above are agreed. Derive concrete adapter types from the SDK result types and those projections. Script/Function tool results already follow `schema`, and LLMAgent tool results follow `output`, collecting stream results when needed. Specialized result typing is implementation work rather than a new output-schema design.

- **Specialized callable signatures:** Decided in [ordinary calls](#ordinary-calls).
- **Specialized tool result types:** Implement the agreed projections with SDK-derived types, including transcript metadata and the model-facing confirmation text.
- **Live VoiceSession server sessions:** A [future feature](future.md); the Phase 3 VoiceSessionSetup component returns setup and separately executes server tools.

Keep adapter types and README2 examples aligned during implementation. Live VoiceSession remains separately deferred; it is not a prerequisite for the selected Phase 3 factories.

## Phase 4: Cascada Streaming Integration

Integrate the Phase 2 JavaScript stream contracts with new Cascada capabilities. Template gains streaming rendering, and Script gains native stream channels with live return. Function producers, stream schemas, collectors, finite Function/LLMAgent tool collection, and LLMAgent `value` already belong to Phase 2; do not postpone them to this phase. Coded components retain native values and streams and do not manufacture SDK results or events.

### Execution Modes

Only components whose engine can run in two ways have `.asStream`:

| Component | Complete | Streaming | `.asStream` |
| :--- | :--- | :--- | :--- |
| LLMAgent | SDK `generateText` | SDK `streamText` | Yes |
| Template | Cascada `renderString` | Future Cascada `renderStringStream` | Yes |
| Script | Runs once and returns its value | Returns a live `stream` or `tstream` channel with a matching schema | No |
| Function | Calls `execute` once and returns its value | `execute` returns an async iterable when its schema declares a stream | No |

Script and Function have no `.asStream`: their schema declares their return. LLMAgent and Template inherit streaming mode from a parent; deriving through the base factory does not turn it off. No reverse-mode modifier is added. Calling an independent child inside a workflow instead preserves that child's own mode. Each invocation executes once, including when a tool adapter collects it.

LLMAgent delegates the requested SDK mode directly. A provider offering both methods does not guarantee native incremental output for every model; SDK streaming simulation may be configured explicitly, and Casai does not add that fallback silently. See [SDK middleware](https://ai-sdk.dev/docs/ai-sdk-core/middleware#simulate-streaming).

### Cascada Capabilities

- **Implemented in the installed engine:** loops consume JavaScript async iterables from context, including async generators, with automatic sharing by default. The public `makeSharedIterable` helper provides explicit JavaScript replay; values passed to JavaScript or returned from a script otherwise retain native consumption. This is existing [runtime behavior](#stream-ownership-and-runtime-responsibilities), not a new Phase 2a dependency. Calls into JavaScript functions pass keyword arguments as one trailing object marked `__hasKeywordArgs` (`runtime.makeKeywordArgs`).
- **Future:** distinct `stream` and `tstream` channels with live return, plus `renderStringStream` returning `tstream`. A script declares `stream s` or `tstream s`, emits through `s(value)`, and returns it live with `return s`. Channels follow sequential semantics: each iteration and each assignment sees the elements emitted before it in source order, whatever the concurrency. Assigning a channel takes a snapshot of that prefix, an array for `stream` and a string for `tstream`, and native code receives it as a plain array or string. A JavaScript stream held in a variable is a reference instead; its iteration follows the engine's sharing option and native JavaScript consumption rules. Cascada must provide the component-call and validation hooks that preserve local poison internally and its native export boundary that fails streams at unrecovered poison. An actual source failure remains terminal for every consumer.

Template rendering and native Script channel returns depend on these upstream capabilities. Existing loops can already consume the JavaScript streams implemented in Phase 2. Casai integrates text/element kinds across native and JavaScript calls, requires Script channel kinds to match their schemas, and makes every streaming Template return text. Cascada implements source-order snapshots, poison-aware validation, and export failure. Casai uses those APIs rather than implementing their semantics itself. Confirm the actual upstream exports and semantics before implementing the integration.

### Composition and Template Rendering

The parent's mode does not switch a child's ordinary call. A child streams when it was created with `.asStream`, or is a Script or Function whose schema declares a stream. A Template forwards a child text stream while streaming and collects it during complete rendering, from the same source. A child LLMAgent's `value` contains only final application output in either parent mode; unknown loop finality may delay delivery without changing the resulting text.

Assignments, filters, property access, function arguments, and Script intermediate calls preserve the child's declared contract. A regular LLMAgent's `value` is its complete output; a streaming LLMAgent's `value` is its stream in both parent modes, and reading a final SDK value intentionally waits.

Do not detect LLMAgent results at text-rendering boundaries. A template reads `.value` explicitly, as a Script does, and renders the string or forwards the native stream it gets. Transcription events are not text; a template adapts them explicitly. Preserve the producer, declared kind, and consumption state across JavaScript/Cascada boundaries. Necessary schema or result adapters may return a different stream object without duplicating its producer.

Cascada delivers selected output in logical source order while independent producers run concurrently. It releases each available prefix and buffers later positions at gaps; Casai forwards that output without collecting the entire workflow to simulate streaming. Intermediate values stay internal until selected for output.

### Lifecycle

Extend the established [stream consumption contract](#stream-consumption) to Cascada-produced handles. Awaiting a streaming call returns its live handle without draining it. Casai uses Cascada's export and validation APIs and preserves the underlying ownership, backpressure, and cleanup contracts. It adds no replay buffer, poison scanner, or parallel set of consumer views. The responsibilities below belong to Cascada unless explicitly assigned to Casai.

- **Local poison in Cascada:** poison everything dependent on an error, but keep its scope as narrow as possible. A parent Script receives a child's poisoned elements or partially poisoned objects and can inspect, repair, or skip affected data. Later unaffected elements remain available. Returning from a child Script does not itself turn local poison into a whole-stream failure. Templates retain the same internal error semantics.
- **Complete native JavaScript returns:** reject the entire returned value if it contains unrecovered poison, including a nested field or array element. Do not expose partially poisoned objects to JavaScript callbacks or application code.
- **Native JavaScript stream returns:** yield the valid prefix. At the first unrecovered poisoned or invalid element in logical output order, reject the next read with its cause and fail that exported stream as a whole. Neither that element nor later elements is yielded. A poisoned field makes the current element invalid for JavaScript. Function callbacks are JavaScript consumers even when invoked from Cascada. Their types remain streams of validated values, without a poison union.
- **Validation integration:** Casai supplies the declared schema and parser; Cascada's hook detects existing poison before invoking that ordinary JavaScript validator. Healthy values/elements are parsed once at their schema boundary, lazily for streams. Cascada preserves a partially poisoned value unchanged for recovery; it does not run its whole-object validator or attempt to transform unaffected fields separately. Such a value is not claimed to satisfy the parsed schema, and its unaffected fields are not guaranteed to have undergone schema transformations. Repaired data is validated at its next declared output-schema boundary; do not replay a child's transform retroactively. Cascada converts a validator failure into poison for the value governed by that schema and rejects remaining poison at its JavaScript boundary. Casai's ordinary JavaScript stream wrapper only handles normal producer values and schema failures; it is not an internal poison-aware stream adapter.
- **Full-stream source failure:** an iterator throw, source abort/timeout, or fatal producer termination ends the source for every consumer. Cascada handles that through its iterator/operation failure semantics, including `IteratorThrew`, but cannot resume a closed producer. This differs from receiving a poisoned element. Do not wait indefinitely for an unfinished position after cancellation.
- **Cleanup:** Cascada closes a failed exported view and stops its owned work when cancellation support permits. Its local poison failure must not cancel other Cascada consumers or unrelated branches. Casai forwards execution signals and closure through its own adapters according to the underlying contract; it does not dispose shared sources merely because a render or reader ends. Returned live streams remain consumable after the call resolves. Interrupting an in-flight `await` additionally needs producer cooperation.
- **Collection:** Casai's JavaScript collectors and tool adapters consume the returned validated stream and propagate its failures instead of returning successful partial strings/arrays. They neither inspect poison nor repeat validation. Cascada may recover local poison before exporting its completed result or stream.

The remaining upstream requirement is an explicit Cascada-aware call/return and validation integration. A child Script called by a parent must remain inside Cascada's poison model; routing it through a strict native JavaScript return prematurely would prevent recovery. Actual JavaScript consumers, including Function callbacks, use Cascada's strict export boundary. Casai selects the documented integration API and passes schemas and execution options. It does not infer the consumer from `this`, user context fields, or the call stack, or manufacture both views itself. Preserve producer identity, declared kind, and validation state without promising wrapper identity, replay, or duplicate validation. Internal engine adapters must preserve poison as an element rather than implicitly awaiting a thenable poisoned value; the exact hooks and their implementation belong to Cascada.

Phase 2 already handles JavaScript producer/validation failures and LLMAgent terminal failures. Phase 4 integrates Cascada's local recovery across component calls and engine-owned native JavaScript output boundaries. SDK event/transcription streams retain their protocols. Native operations create no synthetic model steps.

### Phase 4 Verification

Use local mocks and producers, with type checks; register new mock-only files in `test:local`. Reuse Phase 2 stream tests and add the following integration checks:

- Template with and without `.asStream`; no `.asStream` on Script and Function; `.run()` on every coded component, but no SDK `.generate()` or `.stream()`; no coded SDK Agent assignability.
- Bridge the established text/element schemas to native `tstream`/`stream`: preserve kind through nested calls and empty streams, reject mismatched Script channel kinds, and retain per-element parsing exactly once across the boundary.
- Script `stream`/`tstream` channels returned live versus assigned: an assignment takes a snapshot of the elements emitted before it in source order, as an array or a string, while an assigned JavaScript stream stays a reference.
- The same Template source through `renderString` and `renderStringStream`, forwarding and collecting streaming children, and logical prefix delivery.
- Stable nested call, assignment, filter, and argument types; intermediate outputs staying internal. Passing through an already-consumed JavaScript stream must not restore its contents or introduce replay. A returned live channel remains usable after the component call resolves.
- A child Script emitting valid, poisoned, valid elements: a parent Script can repair or skip the second and consume the third. JavaScript, including a Function callback, receives the first, then fails on the second with no third element. Partially poisoned objects retain usable fields inside Cascada; complete native JavaScript returns containing poison reject wholly.
- Healthy elements are parsed once through the engine's validation hook; partially poisoned elements never reach ordinary validators and retain their original unaffected fields without promised transforms. A parent can repair data and validate it at its own declared output boundary. Verify that Cascada makes validator failure poison only its governed value and that its strict export failure leaves other internal readers recoverable where engine sharing is used. These are integration checks, not a second implementation of poison rules in Casai.
- An actual source iterator throw, abort, or fatal termination ends the stream for every consumer, unlike an individual poisoned element; no consumer can resume a closed source. Verify lazy iteration, backpressure, cancellation through tool calls, early exit, ordered gaps, and runtime-owned cleanup isolation without a Casai replay cache, cursor registry, or extra tee branches.
- Unchanged SDK results and events; final-output identity through streaming/complete Templates and forwarded Functions, including buffered tool loops; and `.asTool` collection of finite streaming LLMAgents, Templates, Scripts, and Functions without a second execution or an output-availability bypass.

### Upstream Integration Work

Phase 2 settles and implements JavaScript stream kinds, lazy schemas, typed iteration, collectors, and producer/validation failure. In this phase, Cascada supplies live-return/rendering exports, native kind identification, ordered rendering, source-order snapshots, poison-aware validation and internal component-call hooks, and strict native JavaScript export boundaries. Casai connects its component calls, schemas, and execution options to those APIs. Shared iteration is already installed and does not require a Casai replay layer. Cleanup that requires new cancellation support stays coordinated with [abort.md](abort.md). Keep planned Cascada capabilities distinct from installed exports.

## Phase 5: Out-of-Order Streaming

Deferred until ordered native streaming is established and an application needs positioned delivery. Keep the direction from [Cascada's streaming proposal](https://github.com/geleto/cascada/blob/master/docs/cascada/streaming.md#javascript-stream-integration), without committing public property names or payloads now. The stream schemas belong to Phase 2a, and native Script channels and their runtime bridge belong to Phase 4; positioned views and `at()` remain separate proposed capabilities, not installed exports.

### Ordered and Unordered Output Properties

An ordered stream waits at a gap; a positioned view could expose a ready chunk before preceding positions finish. Both must assemble the same final text or array. Limit the proposal to text chunks and complete array elements. Preserve SDK events/UI transport and LLMAgent's existing partial-output getters; do not add unordered partial objects.

Use immediate hierarchical positions when possible, spelling a future JavaScript field `indexPath`. A flat index may depend on unfinished nested regions; do not promise both coordinates or a `Promise<number>` payload until the upstream protocol supports a reliable combined record and an application actually needs it. Network transport requires a concrete serializable position protocol.

### Integration Constraints to Retain

- Position-aware loop integration should preserve ordinary Script/Template loop bodies and raw item values. JavaScript may consume an explicit positioned record. Recognize a source protocol, not incidental application fields named `chunk`, `index`, or `indexPath`.
- Ordered and positioned views must refer to the same producer/emission; repeated identical chunks are distinct. A wrapper around already-ordered output cannot recover earlier availability.
- Preserve source-order visibility, guard rollback, and cancellation. Provisional output cannot leak through a positioned view. Final text/arrays remain logically ordered.
- Define one-consumer/branch behavior, backpressure, bounded buffering, early exit, failure, and unresolved positions before advertising additional result properties. Do not create hidden eager tee branches.
- Define duplicate/missing position errors and cleanup rather than allowing completion to hang. Compare paths numerically, not as strings or JavaScript arrays.

Revisit the proposed paired stream properties and positioned producer helpers after those prerequisites. The core remains useful with ordinary ordered async iterables, and independent workflow operations remain concurrent.
