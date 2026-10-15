# LLMAgent and Component Composition: Design and Implementation

Status: target design awaiting implementation; merge-first parsing on direct and tool paths, private configured dependencies, parsed values at every schema boundary, native parser copying without a generic copy planner, and total timeout including asynchronous preparation are confirmed. [README.md](../README.md#internal-core-work-phase-1) describes the current factories. [README2.md](../README2.md) describes the intended API. Phase 1 is the internal SDK testing ground; Phase 1b establishes shared schema parsing and context isolation before final component integration in Phase 2. Phase 3 adds specialized AI operations. Phases 1-3 require no proposed Cascada features. Phase 4 integrates native Cascada streams and Template streaming; Phase 5 adds deferred out-of-order delivery. Cascada interruption, automatic nested cancellation, and workflow telemetry remain upstream work in [abort.md](abort.md) and [future.md](future.md).

Phase 1 is an internal implementation and experimentation step toward Phase 2, with no new package exports, public `.asAgent` API, compatibility release, or separately required publication. Casai has no released API compatibility commitment for this work. Build reusable execution machinery and exercise it through internal tests. Phase 2 is the target for the next feature release and replaces the Text/Object factories with `LLMAgent`, without compatibility aliases or staged deprecation. Update exports, examples, tests, documentation, and release notes together before that release. This plan creates no maintenance-branch or patch-release requirement based on the repository's version number alone. Keep implementation mappings in this document; user documentation presents the intended API without historical method comparisons. This filename distinguishes the design note from repository `AGENTS.md` instructions.

The SDK reference is the installed `ai@7.0.130`. Use its exported types and source when online examples differ.

## Decide the Core Now

**LLMAgent alone implements SDK Agent.** It accepts the SDK's literal text/conversation requests and returns genuine SDK generation and streaming results, with `version`, `id`, and `tools` compatibility properties. Use a shared language execution core backed directly by `generateText` and `streamText`. The SDK owns model requests, tool loops, termination, output parsing, events, usage, and provider cancellation. Casai owns configuration, prompt preparation, call-option validation, hooks, and additive history metadata.

**Every callable component has an ordinary call and `.run()`.** Each has a main property: `prompt` on LLMAgent, `template` on Template, `script` on Script, `execute` on Function, and the SDK input field on a specialized component. Input modifiers set its type, never its name. Ordinary calls take inputs, not execution settings. On a plain LLMAgent the first argument is always the new prompt, a string or message array, followed optionally by `messageHistory`. Rendered forms take source, context, and history as applicable. `.run()` takes named inputs and per-call settings, including `abortSignal` and `timeout` on Template, Script, and Function. All callable components expose `.config`. Streaming mode is inherited from a parent component and cannot be switched off by deriving a child; `.asStream` enables it on LLMAgent and Template. Independently called components keep their own mode. LLMAgent's SDK `.generate()` and `.stream()` explicitly select their operation regardless of the ordinary-call mode.

**Resolve configuration and call inputs before schema processing.** Config fragments and configured context can be incomplete. Preserve established merge/override laws and require what remains missing through call types. Keys declared by `inputSchema` are application/tool input; undeclared configured keys are private execution dependencies outside that schema. Resolve final application input from configured values and call arguments, then parse once and use the returned value. Model arguments can override configured application values, but cannot replace private dependencies or trusted tool context. Custom callbacks must not mutate inputs; preserve native parser copying and the accepted native `.readonly()` behavior. Every schema boundary, including outputs, stream elements, and custom options, uses its parsed value. See [Phase 1b](#phase-1b-schema-parsing-and-context-isolation).

**Template, Script, and Function use native Casai contracts.** Their calls return what the template or program produces: a string, or a text stream with `.asStream`, for Template; the program's value for Script and Function, which is a stream when their schema declares one. Reuse context, input validation, compatible configuration inheritance, and tool adaptation. Do not manufacture SDK steps, usage, assistant messages, or UI events, or maintain parallel native and SDK output schemas. Template remains text-only. Script and Function produce native structured values.

Workflow interchange happens at an application's input/value boundary: extract `.value` from an LLMAgent result in an explicit adapter, written as application code rather than provided by Casai, then give a coded implementation the same input and returned value type. Streaming interchange needs an adapter with declared stream capabilities; a plain complete-value function does not gain them implicitly. See [the public composition examples](../README2.md#interchanging-components-in-workflows).

Keep SDK result fields unchanged. Add `value` for final application output and `messageHistory` for conversation state. Execution mode changes delivery, never output selection: collecting a successful `value` stream must yield the same data as that execution's final parsed `output`. Unrestricted loops buffer candidate output until finality is known. Keep SDK `stream` for live execution events and `steps` for completed step records, with no new activity aliases. See [the output and result contract](#output-and-result-contract).

The direct SDK backend exposes function settings such as `onChunk`, `onError`, and `onAbort` that the installed `ToolLoopAgent` settings type does not expose. Preserve those contracts. `ToolLoopAgent` with one step would also be valid; step count is independent of Agent assignability. The [Agent contract](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent) requires neither that class nor a particular stopping condition.

A custom model/provider is not needed for native composition. If a concrete application later needs coded logic behind the SDK chat protocol, assess an explicit opt-in adapter separately. A provider backed by the public `LanguageModelV4` contract would let the SDK construct real results; do not commit to a Casai adapter or hand-built SDK result emulation now. See [custom provider guidance](https://ai-sdk.dev/providers/community-providers/custom-providers).

## Phase Dependencies and Implementation Order

Phases 1–3 can use the installed engine and SDK without new Cascada features. Phase 2 workstreams share only their actual prerequisites; they are not a queue of temporary API migrations. Phase 3 breadth and Phase 4 native streaming have separate dependencies, so specialized components need not gate engine integration if its APIs become available. Phase 5 and separately recorded future features remain deferred.

| Phase | Depends on | Implementation scope |
| :--- | :--- | :--- |
| 1: Internal SDK behavior probes | Current components, installed engine, and SDK | Deliver the shared deadline scope early; prove final-output selection, safe additive result properties, lazy history, and preparation cancellation in thin internal fixtures; no intermediate API |
| 1b: Schema parsing and context isolation | Existing merge/source rules, installed schema/SDK interfaces, and the shared deadline scope delivered early in Phase 1; not the remaining SDK probes | Own merged-input parsing, private dependency binding, SDK tool default projection, native-copy verification, and shared parsed-value semantics; no generic copy planner |
| 2a: Coded component conventions and JavaScript streams | Phase 1b for context preparation; current code and installed Cascada, including its existing loop sharing; no new engine features | Named/flat context, stream kinds, lazy schema validation, collectors, Function producers, finite-stream tool collection, and cooperative JavaScript cancellation |
| 2b: `LLMAgent` | Reusable Phase 1 code, Phase 1b context preparation, and the shared stream primitives actually needed | Final language-generation API, SDK-compatible consumption, and final-output `value`; does not wait for all coded-component features |
| 2c: Tool continuations | 2b | Approval and external-result continuations |
| 3: Specialized components | Phase 2 and the applicable SDK APIs; no new Cascada features | Operation adapters and result types derived from SDK contracts and the agreed tool-result mappings; recheck experimental APIs against the implementation version |
| 4: Cascada streaming integration | Phase 2 stream infrastructure and new Cascada capabilities | Integrate native `stream`/`tstream` channels, live Script returns, Template streaming, runtime kinds, source-order snapshots, and Cascada-owned validation and native failure semantics |
| 5: Out-of-order streaming | Phase 4, and Cascada's positioned streams (`at()` and positioned views) | Deferred |
| Future features | Cascada's telemetry and context channels, and async context tracking | See [abort.md](abort.md) and [future.md](future.md) |

### Design Status

The target contracts retain named input objects, flat implementation context, fallback tool-function bindings, separate model arguments and application-supplied tool data, and final-output `value` with buffering when needed. Streams use ordinary consumption with lazy validation and no added replay guarantee. Cascada owns its complete-value and native `stream`/`tstream` error semantics: a complete return is healthy or poison/failure, and a stream ends at its first error after any valid prefix. Casai forwards those contracts rather than defining different consumer views. Stream schemas and tool collection apply only to a root stream; object field order has no calling semantics.

Remaining implementation work includes schema/type integration, finality detection with SDK-compatible consumption and buffering, and specialized adapters. The Cascada runtime bridge follows in Phase 4; it does not block the JavaScript stream contracts in Phase 2. These do not reopen the settled public call conventions. See [tool execution context](#tool-execution-context) and [the result contract](#output-and-result-contract).

Phase 1 is ready to implement. The review decisions are settled, including preservation of native SDK/Zod limitations and union typing when explicit SDK output types do not identify `value` delivery precisely. Start with the shared invocation deadline scope, then the internal SDK fixture and required result/finality/history probes. Their completion remains implementation work; this readiness statement does not claim those integration checks have already passed.

### Error Types

Add no new Casai error types. `ConfigError` covers Casai-invalid configuration/calls, unknown or undecided approvals in `resume()`, and unknown tools in `executeTool()`. Preserve SDK error types and causes for SDK-owned failures. Cascada owns poison propagation and native return behavior: complete objects are healthy or a poison/failure outcome, while `stream`/`tstream` terminates at the first error after any valid prefix. Casai adds no poison scanner, partial-object repair, consumer-dependent stream behavior, or separate export protocol. Ordinary JavaScript Function producers still need their declared schema validation, and LLMAgent `value` needs SDK failure adaptation. See [Phase 4 lifecycle](#lifecycle).

### Confirmed Schema and Context Decisions

- Undeclared configured keys are private execution dependencies. Direct application calls retain existing overrides; registry/model arguments cannot replace those dependencies. Do not put private bindings into the SDK argument parser's returned value.
- Configured declared input values and schema defaults can satisfy required fields on every entry path. Merge configured application values with call/model arguments before the single parse. Advertise only the model arguments still required; do not require a model to resupply a configured value.
- Every schema boundary uses its parsed result: inputs, trusted context, outputs, stream elements, and custom call options. SDK-owned results are not parsed again by Casai.
- Remove the generic schema-guided copy planner. Casai's own preparation and execution leave caller context, nested application data, configured values, and shared schema defaults unchanged. Rely on verified native parser behavior and pure callback contracts; unchanged references may remain shared. Native SDK/Zod `.readonly()` freezing, including borrowed/default values and invalid-input cases, is an accepted limitation. Do not add schema rejection, copying, or freeze-prevention machinery to compensate for behavior also present in native Agent.

## Phase 1: Build the Internal Shared Core

Phase 1 is a small internal SDK testing ground, not a release or an intermediate component API. It owns the shared invocation deadline scope and delivers that small reusable primitive before the remaining SDK probes. Phase 1b owns the production merged-input correction and final context boundary; its source/parsing work can proceed alongside the fixtures and reuses that deadline scope for asynchronous preparation. Neither workstream waits for the other's full completion. Introduce no new production factory, package export, legacy modifier, or public `.asAgent` surface. A local experiment may use a thin Agent adapter, but it creates no compatibility or migration commitment.

Use normalized SDK requests and a small test-only fixture implementing the actual `Agent<never, TOOLS, RUNTIME_CONTEXT, OUTPUT>` interface. Assignability and UI-helper invocation are baseline checks. The fixture also needs small internal probes for the difficult integration behavior: selecting final application output, adding fields without breaking SDK result receivers/stream teeing, and assembling lazy history from that same execution. It needs no public callable, `.run()`, `.config`, inheritance system, override matrix, or temporary validation API. A test-only preparation callback exercises one-time asynchronous preparation and cancellation through the shared deadline scope. Build final public conventions once in Phase 2.

Keep resolution, preparation, SDK execution, and result adaptation as clear boundaries. Return genuine SDK results and retain one execution in the requested mode. Use SDK output specifications directly and leave the stopping default to the SDK. Do not build generic machinery merely to fill an empty stage.

### Phase 1 Input-Validation Correction

Current Template, Script, and Function direct calls can reject empty call context when `name: 'Ada'` is configured and `inputSchema` requires `name`. Resolve context before checking it so configured and call-time values jointly satisfy the schema. Preserve existing parent/child and call override laws, including shallow map merging, whole-value replacement, and inherited schema replacement. Configuration may remain incomplete; call types require whatever is still missing without forcing call-suppliable values such as `prompt` into configuration.

Use one shared preparation boundary for Template, Script, Function, and rendered LLM calls, including `.run()`. Implement its schema application with [Phase 1b](#phase-1b-schema-parsing-and-context-isolation), not a temporary adapter that discards parsed values. Direct callable-tool invocation follows the direct-call contract; actual SDK tool execution uses its separate already-parsed entry point. `_toolCallOptions` may remain optional metadata but cannot authorize a validation bypass.

**Coverage audit:** `tests/LLMRun.test.ts` rejects `.run({})` despite configured `name`; `tests/Engines.unit.test.ts` similarly rejects omitted Script input despite configured `name`. Correct those expectations. Existing tests that discard schema replacements or type callbacks from raw input must also change when Phase 1b lands: the confirmed target now uses the schema-produced invocation context while preserving the shared originals. Preserve useful error-before-side-effect, validation-count, cause, override, and isolation checks.

Regressions cover configured requirements completed by calls, fields split across parent/child/call, valid overrides of invalid placeholders, invalid final overrides, and missing final fields failing before execution. Pair runtime checks with TS7/TS6 source/declaration and exact-optional checks. Phase 1b adds parsing, copying, and input/output-type cases to this lasting coverage. Use local producers and mock models only; register new mock-only files in `test:local`.

### Phase 1 Completion

Complete the internal SDK probes independently of Phase 1b. The [input-resolution correction](#phase-1-input-validation-correction) is a handoff to that workstream, not a Phase 1 fixture dependency. Use focused mock probes and type checks to establish:

- SDK Agent assignability and UI-helper interoperability for literal conversations.
- Genuine incremental `streamText` and direct `generateText`, with one execution and native results, callbacks, tool context, and cancellation.
- Coexistence of SDK event/text views and final-result promises, including different access orders.
- Required risk probes: implement a small internal final-output projection/collector, additive result properties, and lazy history over genuine SDK results. Verify intermediate text/array output versus final output, custom output parsers, and every row of the [output-eligibility table](#output-availability-and-failures) in both SDK modes. Include resolved provider tools with same-step answers, unresolved approvals/client/deferred tools, truncated and empty output, final parsing failure, and a completed step followed by a failed continuation. Interleave native stream views, final-result promises, the candidate final-output view, and lazy history; preserve SDK receivers/teeing and execute once. These focused proofs do not require the complete public Phase 2 adapter.
- Deliver and test the shared deadline scope once, then use it for one-time asynchronous preparation within the total timeout, including no backend start after cancellation/deadline expiry and no fresh full timeout when preparation ends. Phase 1b reuses this primitive; it does not build a second timer/preparation adapter.

Retain useful core code and regression tests. Discard experimental adapters that do not serve the final design. Register lasting mock-only files in `test:local`; run focused checks and keep the existing checks green. Do not add paid calls, legacy parity tests, or a temporary factory/modifier matrix.

### Transition and Check Discipline

Apart from the shared Phase 1/1b context-preparation correction, leave the old public API on its current implementation until its replacement is ready. Do not update legacy Text/Object factories to intermediate conventions only to remove them in Phase 2. Reuse the corrected preparation utilities without routing the old API through the new SDK core. Build other final shared modules and adapt Template, Script, Function, and LLMAgent directly to their target contracts, updating implementations and tests together. Keep checks green through intentional contract corrections; preserving assertions for known bugs is not compatibility. Remove obsolete Text/Object factories, types, tests, and documentation when LLMAgent replaces them.

## Phase 1b: Schema Parsing and Context Isolation

This internal foundation precedes final Phase 2 integration; it is not another public API or release. Resolve inputs before parsing, use the parsed value at every schema boundary, and keep Casai's own operations from mutating shared originals while preserving native parser semantics. Phase 1b supplies reusable source resolution/parsing and uses the shared deadline scope delivered early in Phase 1; later phases integrate these helpers into their final components. It introduces no generic copy planner, schema interpreter, Zod patch, or separate validation-only adapter.

### Context Sources and Preparation

Use the schema's discoverable top-level declarations to distinguish two parts of configured `context`: declared fields are application-input defaults; configured fields declared by neither `inputSchema` nor `contextSchema` are private execution dependencies, such as clients and helpers. Declared `contextSchema` fields retain their separate trusted source and never become inferred dependency fallbacks. Where ownership cannot be discovered, require explicit supported source declarations or reject the ambiguous configuration rather than running callbacks to infer keys. Do not add a mandatory helper namespace.

1. Resolve configuration/inheritance using the existing shallow merge laws. On a direct application call, merge configured and call-time context first, retaining the established application override behavior. Extract the configured dependency names and declared trusted fields for their separate source paths; other call-only keys remain application input and follow the schema's strict/strip/passthrough policy.
2. On a registry/model call, accept its object as application arguments only. Merge configured declared input defaults with those arguments, with call/model values overriding defaults. Bind private dependencies from application configuration, and trusted data from the owning run's `toolsContext`; model keys never supply or replace either source.
3. Apply the application-input schema to that final merged input once. Do not validate incomplete fragments first, discard parsed replacements, or restore raw configured input after parsing. Schema defaults, stripping, coercions, and non-mutating transforms take effect at this boundary. Parse trusted context once at its own boundary.
4. Assemble the flat execution context from parsed application values and the selected private/trusted bindings. Exclude reserved private/trusted names from the application binding first, including when a trusted value is optional or absent. Direct application overrides of configured dependencies come from the direct-call merge; registry arguments cannot override them. Add fallback tools only for absent execution bindings. Never modify the SDK's recorded argument object during this assembly.
5. Start the shared deadline before awaiting schema work or preparation. Rendering, prompt functions, and implementation callbacks consume the prepared context, and no stage writes it back into shared `.config` or caller objects. Calls and `.run()` are stateless with respect to shared application data; Cascada's `!` sequences intentional external effects, not context mutation.

A configured dependency is outside `inputSchema`, so it survives a plain stripping schema without being declared as a model argument or requiring passthrough. Undeclared caller-only data still follows the selected schema policy. This partition changes neither parent/child merging nor the direct application's ability to override configured values; it distinguishes the application's source from model-controlled arguments.

### SDK Tool Boundary and Configured Defaults

The SDK automatically applies a registered tool's schema and records its returned value as public tool-call `input`. A thin Casai-owned SDK schema wrapper therefore does only the necessary source work: validate the raw argument object's shape, merge configured declared application defaults with those arguments, invoke the original parser once, and return the parsed application input. Private helpers and trusted context are not passed through or returned by that parser. The separate `execute` wrapper binds them afterward and does not parse model arguments again.

Derive the registered model-facing object schema from the original input schema without mutating it. Retain all declared argument fields so a model can override configured values, but remove a top-level `required` entry when the resolved configured application map supplies a non-`undefined` value. Preserve the original schema's own defaults/optional requirements and constraints. Do not put private keys or values into the advertised schema. Keep component `.config.inputSchema` unchanged; the SDK-facing descriptor owns the derived schema and merge-aware validator. An unsupported/opaque schema representation needs a clear supported projection or configuration error, not a hand-written replacement validator or guessed required fields. Casai must not trial-parse configuration fragments or invoke callbacks/default factories to discover ownership, required keys, or default values. Supported native SDK/Zod conversion may itself evaluate pure default factories while producing JSON Schema; allow that native behavior rather than patching the converter. The final merged invocation parse remains authoritative, including for invalid configured placeholders that a valid call can override. Metadata conversion is not an invocation parse, and callback/default-factory invocation counts are not an exactly-once contract. Never reuse a metadata-time factory result as invocation state or cache it into component context.

For example, with `inputSchema: z.object({ language: z.string() })` and configured `context: { language: 'English', db }`, model arguments `{}` parse as `{ language: 'English' }`, and `{ language: 'French' }` override the configured input. The execution context also contains the configured `db`; SDK history/UI/next-step messages do not. `language` is a declared public input and its resolved value may appear in SDK tool-call records. Private data belongs in dependency/trusted bindings, not a model-facing schema field.

A local mock has demonstrated empty arguments, configured declared defaults, schema defaults, overriding model arguments, one schema invocation, and private dependency exclusion from history and the next model request. Keep these as lasting regression requirements, including consistency of advertised requirements and native SDK events/refinements. Rebuild only invocation-specific descriptors where needed; never mutate shared tool definitions or cache per-run values on a schema.

Keep parsed execution context separate from conversation persistence. Casai assembles that context for the invocation; SDK tool records contain the parsed public application arguments, not the flat context with private dependencies/trusted bindings. History is assembled from messages and SDK response messages, not by serializing execution context. "Parse once" here excludes redundant parsing inside Casai's execution wrapper; it does not prohibit native SDK validation of historical UI messages or approvals on later requests.

**Accepted native SDK UI round-trip limitation:** a local probe using unmodified `ToolLoopAgent` in `ai@7.0.130`, with `z.object({ n: z.string().transform(Number) })`, executed `{ n: "3" }` as `{ n: 3 }` and recorded the parsed input in UI history. A second `createAgentUIStream` call rejected that historical number against the string-input schema before invoking the agent. Direct `.generate()` and `.stream()` continuations using completed SDK model-message history succeeded; those paths did not reparse the completed historical tool arguments. Private `toolsContext` data stayed outside both histories. The SDK carries raw `inputSchemaInput` for relevant approval records, but ordinary completed UI tool parts do not have that same raw-input path. Casai accepts this native SDK behavior without a workaround or additional schema restriction; fixing it is not a phase-completion requirement. Keep focused comparisons with native Agent behavior, including approval continuations, and recheck on SDK upgrades rather than requiring the current failure forever. A possible upstream bug report is separate follow-up work.

| Entry path | Schema application owner |
| :--- | :--- |
| Direct calls and `.run()` on Template, Script, Function, and rendered AI components | Casai resolves source maps and explicitly invokes the supported parser once before rendering/callback execution |
| Actual SDK tool invocation | SDK invokes the merge-aware application-input wrapper once; the separate `execute` entry binds private/trusted sources without reparsing arguments |
| Injected coded-component tool invocation | Casai explicitly uses the same merge-first application parser and private/trusted source rules |
| Trusted tool context | Parse `contextSchema` once from its designated source; keep it out of public model arguments |
| Literal SDK Agent `.generate()` / `.stream()` | Preserve literal messages; do not render or validate Casai prompt context. SDK model-output and tool-argument schemas retain their own native owners |

Explicit SDK tools and `Output` objects keep their native schema interfaces/results. The merge-aware projection is for Casai-owned component-tool input; it does not rewrite opaque application-supplied SDK objects. `_toolCallOptions` is optional metadata, never authority to bypass parsing.

### Native Parsing, Purity, and Types

Casai's own preparation and execution must not mutate caller context, nested application data, configured values, or shared schema defaults. Both installed Zod 3 and Zod 4 create new declared object/array containers on their ordinary structural parsing paths; do not pre-copy those containers again. This is not a copying guarantee for every wrapper or default: Zod 4 object defaults can retain nested references, and a default factory can return an existing object directly. Opaque values, functions, clients, passthrough branches, and default-provided values may remain shared. Preserve native parser behavior, including the accepted freezing cases below.

Custom validators, refinements, preprocessors, transforms, and default/catch factories MUST be pure: do not change received/shared data or perform external effects. A transform that changes an object or array returns a new one and copies each nested path it changes; unchanged branches may be shared. For example, return `{ ...value, profile: { ...value.profile, name: value.profile.name.trim() } }` rather than assigning to `value.profile.name`. Return a fresh structured default when it should be independently owned, including any nested objects that will be affected. Component implementations have the same no-mutation obligation for their input data; intentional external operations belong in execution, not schema callbacks.

**Accepted native freezing behavior:** `.readonly()` freezes the parser's returned value. A successful structural parse ordinarily freezes a new container, but opaque values and objects supplied by default/catch factories or pure transforms can retain shared identity. In installed Zod 4.6.5, even `z.string().readonly().safeParse(sharedObject)` freezes the invalid object; a failed union branch can likewise freeze a value before another branch succeeds. A shallow context merge does not protect a nested borrowed value. These behaviors are inherited from the parser, not introduced by Casai. Unmodified `ToolLoopAgent.generate()` and `.stream()` in `ai@7.0.130` reproduce borrowed-option freezing, shared-default freezing, and freezing before invalid options are rejected. Accept native SDK/Zod behavior without a Casai rejection layer, copy planner, parser patch, or completion gate. This supersedes the earlier proposal to reject unsafe `.readonly()` combinations. Custom callback purity remains required.

The earlier selective-copy proposal would shallow-copy schema-selected containers and their ancestors before native parsing, sharing unaffected branches; it would not implement validation or transformation. That can protect some borrowed input containers, but duplicates native copying on ordinary structural paths and cannot protect a shared object introduced later by a schema default. Do not restore it to compensate for the accepted native behavior. Focus isolation work on Casai's own merging, source binding, and invocation state.

Input/configuration and producer-return types describe schema inputs; implementations and consumers see the corresponding schema outputs. For context, infer required application fields remaining after configuration, then combine parsed application types with private/trusted binding types. Direct application dependency overrides retain their established inferred types. Model-tool requirements reflect the derived schema. For an output schema, a producer may return a string that the caller receives as a number after parsing; stream producers/consumers follow the same input/output distinction per element. `prepareCall` receives parsed custom options. Preserve exact-optional/union behavior without widening to `any` or changing unrelated merge rules.

### Phase 1b Verification and Completion

Use local schema probes and mock models, not paid calls. Cover:

- Native Zod 3/4 defaults, nested objects/arrays, stripping, passthrough, coercions, transforms, and async checks. Verify ordinary structural parsing preserves originals using both deep-frozen and unfrozen fixtures. Characterize static defaults with shared nested values, fresh/shared default/catch factories, `.readonly()` wrapper ordering, invalid inputs, and failed union branches. Compare with native SDK Agent behavior without adding Casai restrictions. Frozen fixtures alone hide freezing; not every native parse returns fresh references. The focused [native behavior probes](../tests/NativeSchemaBehavior.unit.test.ts) preserve this evidence; review version-specific expectations on upgrades.
- No generic pre-copy planner or whole-context deep clone; native declared containers may be new and safe opaque references may remain shared. Casai's ownership/projection logic does not invoke callbacks or perform speculative parsing. Probe native JSON Schema conversion separately from invocation parsing: pure default factories may run during conversion, their results must not become cached invocation context, and no exactly-once factory/callback count is promised. Invocation parsing still resolves the final merged input once per Casai-owned boundary.
- Direct, `.run()`, injected-tool, and actual SDK-tool calls resolve configured required fields before one application parse. Cover omitted/empty arguments, partial defaults, schema defaults, invalid placeholders overridden by valid calls, invalid final overrides, and explicit context-property `undefined` versus omission.
- Model-facing required fields match configured/defaulted input capabilities. Private dependency/trusted-context sentinels never enter SDK schemas, parsed tool arguments, history, UI chunks, or the next model request. Configured public inputs can be overridden and may appear in native tool records; originals and shared tool/schema objects stay unchanged.
- Reuse native Agent probes for completed model-message history, a second UI turn, and approval continuations with type-changing/non-idempotent transforms. Distinguish fresh argument parsing from SDK-owned history revalidation, and verify public parsed arguments versus private/trusted execution context. Compare Casai with native SDK behavior; the inherited UI round-trip limitation requires no Casai workaround and does not block completion. Recheck the comparison when upgrading the SDK.
- Configured undeclared helpers survive strict/strip input parsing as private bindings. Direct application overrides work; registry/model attempts cannot replace private bindings, even through passthrough. Undeclared caller-only keys follow strict/strip/passthrough normally. Optional trusted fields do not fall back to application data.
- Every schema boundary uses its parsed result with preserved causes and no redundant Casai parse. Stream parsing is lazy in the existing consumer pass, forwards parsed elements, and retains one producer, native failure timing, backpressure, and cleanup. Reuse SDK/Cascada parsing already done for that same contract.
- Runtime/types agree for raw inputs, parsed callbacks, configured required fields, private/trusted dependencies, transformed outputs/elements, and parsed custom options. Use existing TS7/TS6 source/declaration and exact-optional checks. Keep the deadline scope active before async parsing and prevent later stages after failure/cancellation.

Land the production resolution correction with this final boundary; integrate it into Phase 2a/2b and Phase 3 preparers without an intermediate public API. Output/stream and call-option sites adopt the same parsed-value rule when their owning final components land. Phase 4 must reuse Cascada's schema-produced values at its native boundary rather than adding a Casai transformation pass. Stricter future Cascada context protection remains compatible with this contract, not a prerequisite for it.

## Phase 2: The Target Release

Phase 2 builds the final base-component API and replaces the Text/Object factories for the next feature release. The 2a/2b labels below are workstreams, not a requirement to update every coded component before starting LLMAgent. Extract only the shared primitives each slice needs; implement both against the final contracts. 2c follows the conversation-history support. Phase 1 contributes evidence and reusable code, not a temporary API to migrate. Release documentation describes the final API and changes from the old factories.

| Step | Scope | Depends on |
| :--- | :--- | :--- |
| [2a: Coded component conventions and JavaScript streams](#phase-2a-coded-component-conventions-and-javascript-streams) | Shared renderer/tool code, stream schemas and collectors, and Function stream producers | Phase 1b for context preparation; current code and installed Cascada for independent modules, which can start alongside Phase 1 |
| [2b: LLMAgent](#phase-2b-llmagent) | The final language-generation factory and `value` streams, replacing the Text and Object factories | Reusable Phase 1 core, Phase 1b context preparation, and the needed shared stream primitives; not all of 2a |
| [2c: Tool continuations](#phase-2c-tool-continuations) | `resume()`, with approvals and external tool results | 2b's `messageHistory` |

### Phase 2a: Coded Component Conventions and JavaScript Streams

Implement the final coded-component contracts directly. Shared preparation, execution options, and the small stream-kind/collector modules can be developed alongside LLMAgent. Do not make all coded-component features prerequisites for a literal LLMAgent, and do not migrate legacy LLM factories to these contracts. Land focused slices with their tests:

1. **Use `renderOptions` for Cascada settings** in the target component paths; reserve `options` for SDK custom call options.
2. **Reuse Phase 1/1b context resolution, isolation, and schema processing**, as described in [Reuse Casai Preparation](#reuse-casai-preparation-and-isolate-runs). Extend it to the final entry paths without reintroducing call-only validation, discarding parsed context, or repeating schema application. Use the separate tool `execute` boundary, never a context marker, to identify already-validated SDK input.
3. **Pass execution options to Function callbacks and `.withFunction` preparers** as their second argument, including the invocation signal and SDK tool metadata where applicable. Forward signals without mutating shared components.
4. **Retain flat implementation context and the current shallow inheritance laws.** Preserve the distinction between registry arguments and application-supplied tool data; see [tool execution context](#tool-execution-context). Runtime and inferred merged types must agree.
5. **Add `tools` and `toolsContext`** to Template, Script, and Function using the existing fallback-binding design. Ordinary context may contain any application functions, API clients, helpers, and components; no component-only execution restriction or mandatory tool namespace is introduced.
6. **Accept Cascada object-literal and keyword calls** through the shared final argument normalizer.
7. **Build JavaScript stream primitives**: declared text/element kinds, lazy schemas, and collectors. LLMAgent can use these without waiting for all Function producer features.
8. **Support Function stream producers and tools**: validate in one consumer pass, propagate failures and cooperative cancellation, and collect finite root streams only on tool execution.
9. **Share environments and compiled code** where useful, as described below. This optimization is not a prerequisite for the final invocation API or LLMAgent.

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
| Declare stream kind and apply component schemas | Validate healthy values lazily in the consumer's pass; reuse Cascada's native validation |
| Select final LLMAgent output | Adapt SDK results into `value`, buffering candidates only when finality requires it |
| Surface terminal SDK failures through `value` | Preserve raw SDK protocols while rejecting failed Casai output consumption |
| Collect explicit results and finite tool outputs | Use the existing collectors and one producer execution |
| Forward cancellation and cleanup | Pass execution options and propagate iterator closure; runtimes own scheduling and shared-source cleanup |

Cascada owns source-order assembly, poison propagation, and complete-value/native-stream failure. Casai uses the engine contract directly without constructing internal/public consumer views. SDK branching and buffering retain their native contracts. Neither engine behavior nor final-answer buffering creates a general Casai replay promise.

#### Stream Schemas and Collection

Phase 2a defines text and element stream kinds in Casai's JavaScript wrappers, including empty streams; never infer kind by inspecting items. Both are async iterables. Phase 2b reuses these kinds for LLMAgent `value`. Phase 4 maps them to Cascada's native `tstream` and `stream` without changing public schemas or collectors.

- `textStreamSchema()` declares a text stream, corresponding to Cascada `tstream`, and checks string chunks. `collectTextStream()` joins them, returning `''` when empty.
- `streamSchema(elementSchema)` declares an element stream, corresponding to Cascada `stream`, and validates elements lazily. `collectStream()` collects them in order, returning `[]` when empty.

Stream schemas describe only a root stream: a Function's returned stream, or a Script's returned `stream`/`tstream`. A JavaScript stream nested in a returned object is an opaque value: Casai doesn't validate its elements, and an output schema that mentions it uses an opaque schema such as `z.custom<AsyncIterable<T>>()`. In Phase 4, Cascada first resolves a native channel assignment to its source-order snapshot; an ordinary output schema then validates the resulting array or string. JavaScript stream references stay opaque and are not recursively drained by that validation or by tool adaptation.

Export both schemas and helpers in Phase 2a. A Function returning a plain JavaScript async iterable acquires its declared runtime kind at the schema boundary. Keep the JavaScript representation internal and adapt it to Cascada's runtime protocol in Phase 4, preserving lazy iteration and producer identity. Do not wait for that protocol to implement or test Function producers, validators, collectors, and tool adapters.

Parse in one pass as the caller consumes the returned stream. Where needed, a lazy wrapper reads one producer element, applies its declared schema, and forwards the parsed element. The stream wrapper and parsed element may be new objects; neither duplicates producer execution, starts another source reader, nor retains replay history. Collection consumes this parsed view without another validation pass. Reuse native SDK/Cascada parsing already performed for that output contract, preserving stream-kind metadata. Do not read merely to construct a wrapper.

```text
producer -> lazy schema validation -> caller
```

Text schemas parse string chunks; element schemas parse complete healthy elements at their declared boundary and forward the parsed values. Reuse parsing already done by Cascada or the SDK; a producer crossing another adapter is not a reason for another parse. Failures stop JavaScript iteration after the valid prefix without yielding the failed element. Whole-result checks still require completion; do not promise whole-stream validity from a prefix.

Stream schemas do not promise that the entire result is valid before the first element is delivered. Whole-result checks can only be finalized at completion; guaranteeing complete validity before exposure requires explicit collection. Ordinary streaming adds no such eager pass or buffer.

Callers explicitly choose collection helpers, which also accept plain async iterables and consume them in their current state. Casai collects a finite Function stream for a tool according to its schema kind: text joins into a string; elements collect into an array. A Casai tool's `execute` never returns an async iterable to the SDK, which would treat each chunk as a preliminary result and keep only the last one. Tool adapters collect only a root stream; any other result, including an object containing streams, is returned as the component produced it, and making it suitable for a tool is the component's job. Collection consumes the validated stream; it does not rerun the producer or repeat that boundary's validation. Cascada channel returns and source-order snapshots join this contract in Phase 4.

#### Function Producer Contract and Types

Use one `execute` callback. A streaming Function returns an async iterable whose kind is declared by `schema`; no mode flag is needed. Its second argument contains execution options, including cancellation and model-tool metadata when applicable. Validated tool-context fields join its flat first-argument context, while execution metadata stays in the second argument.

Every `.withFunction` preparer uses the same `(context, executionOptions)` callback convention, including specialized components that prepare audio or other non-text inputs. Forward the invocation signal during preparation; check cancellation before starting the backend, and do not start it after preparation has been cancelled. This is cooperative JavaScript cancellation and does not depend on automatic Cascada propagation.

`textStreamSchema()` requires a (promised) `AsyncIterable<string>`; `streamSchema(elementSchema)` requires a (promised) iterable whose producer element type is accepted by that schema. The public stream yields parsed elements of the schema output type and throws on failure, so consumers need no `T | PoisonError` union. Once Phase 2b is available, a Function can forward an LLMAgent's native output stream, retaining final-output selection, any required buffering, and terminal failures. SDK event and transcription streams remain separate protocols.

#### Calling Components from Cascada

Implement this with Phase 2's call-argument normalization. Context inputs use one named object. Cascada accepts object-literal calls such as `multiply({ a: 6, b: 7 })` directly; keyword calls such as `multiply(a=6, b=7)` arrive as `{ a: 6, b: 7, __hasKeywordArgs: true }`. Remove the marker before validation, otherwise `.strict()` schemas reject it and it appears as a template variable, and treat the object as the final input or context argument. Keyword calls then work with each component's positional conventions, such as `greeting('Welcome {{ name }}.', name='Ada')` for a Template's `(template, context)`. On `.run()`, the keyword object is the argument object: `agent.run(context={ topic: 'recycling' }, temperature=0.2)`.

Cascada's marked keyword object is a trailing context argument even when history precedes it: `agent(messageHistory, topic="recycling")` normalizes to the rendered JavaScript call `agent({ topic: "recycling" }, messageHistory)`. This exception applies only to the marked keyword form; JavaScript `agent(messageHistory, context)` and Cascada's equivalent unmarked object-literal form are invalid for rendered agents. Recognize the marker before removing it and applying the ordinary argument order.

Do not map plain positional values to schema fields. `lookupOrder({ orderId: 123, quantity: 2, accountId: 1 })` and `lookupOrder(orderId=123, quantity=2, accountId=1)` are equivalent direct component calls in Cascada. Fields are matched by name, optional fields can be omitted, and schema/property order has no invocation semantics. Existing positional main-input/source/context/history forms remain unchanged; named field inputs introduce no string-versus-source ambiguity. Source overrides can also use explicit fields in `.run()`.

#### Phase 2a Stream Verification

Use local JavaScript producers and the installed Cascada engine; these checks must not require future engine exports. When environment sharing is implemented, verify reuse across source changes, separate compilation entries for source and template/script mode, and new environments for changed loader/filter/render options; that optimization is not an LLMAgent prerequisite. Verify text/element kinds including empty streams, lazy checks exactly once without schema transformations, producer return types, collectors on Casai and plain async iterables, normal completion, producer/validation failure, early exit and cooperative cancellation, and finite Function tool collection from one execution. Check that an unread validation wrapper performs no source acquisition or pulls, that each requested element passes through one source reader and one schema parse, and that collection neither re-executes the producer nor repeats validation. Returning a consumed input stream must not restore its consumed prefix. Verify native iteration/locking behavior without a Casai replay or reader-locking layer. Existing Cascada loops must consume these iterables without native stream channels, implicit text rendering, or channel snapshots; with default engine sharing, two Script loops each receive every element. Stream schemas and tool collection apply only at the root. Register mock-only files in `test:local`. Phase 2b adds SDK-backed stream and Function-forwarding checks.

### Phase 2b: LLMAgent

Expose `LLMAgent` through a named export and `create`. Each returned component is callable, has `.run()` and `.config`, and implements the SDK's `Agent` interface. The ordinary call and `.run()` are the Casai calls and run in the component's mode. `.generate()` and `.stream()` exist only for the SDK interface: they take the SDK's call arguments with a literal conversation, never prepare the configured prompt, and always generate or always stream. Document them only with SDK integration.

| Factory form | Ordinary call and `.run()` | SDK `.generate()` | SDK `.stream()` |
| :--- | :--- | :--- | :--- |
| `LLMAgent` | Generate | Generate | Stream |
| `LLMAgent.asStream` | Stream | Generate | Stream |

Support `.withText` (the default), `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, and `.loadsScript`, followed optionally by `.asStream` and then `.asTool`. Streaming and tool adaptation are independent capabilities. A component derived from a streaming parent stays streaming even through the base factory; no reverse-mode modifier is added. There is no `.asAgent` modifier. Preserve configuration inheritance, call parsing, schemas, history, and override isolation.

LLMAgent follows the call conventions shared by every model component:

- Ordinary calls take inputs only, by position, in the order main property, context, secondary input; settings go to `.run()`. The specialized components of Phase 3 follow the same rule.
- A call-time main property has the configured property's type, so `.run({ prompt })` on a `.withTemplate` LLMAgent is a template, just like the configured source. Literal SDK requests go through the SDK methods.
- Casai uses `messageHistory` wherever it stores or passes a conversation: the call input, the result field, and the execution options' copy of the SDK's tool-call `messages`. `messages` remains only in the SDK methods' arguments.
- Results add `value` and top-level `messageHistory`; see [the result contract](#output-and-result-contract).
- `options` carries SDK custom call options in configuration, `.run()`, and the SDK methods.
- LLMAgent has no configured `messages`. Fixed guidance belongs in `instructions`, and examples or trimming applied to each request belong in a `prepareCall` hook. Phase 1's internal fixture also omits configured `messages`; only the old factories have that legacy setting until they are removed.

The `output` setting selects text, object, array, choice, or JSON. Normalize an omitted value to `Output.text()` at runtime and in inferred types. Text and structured output share the same engine and result family. Build `value` streams on 2a's JavaScript stream infrastructure, with the SDK consumption behavior described [below](#stream-consumption). No new Cascada channels or rendering exports are needed.

`LLMAgent.asTool` and rendered combinations expose completed application output to a model. Streaming components can also be tools: consume their one execution, apply the same output-availability and failure rules as `value`, and return validated final output, preserving the completed tool-result contract. Do not rerun generation or return an iterable as the tool result. Direct calls retain their full SDK result and inherited streaming mode. Nested agents can themselves use tools and `stopWhen`.

Replace the current Text/Object factories with public LLMAgent on the internal Phase 1 core, updating examples, exports, types, tests, and documentation together. No public migration layer or temporary `.asAgent` removal is required. Preserve desired loop policies explicitly in examples; Phase 1 introduces no different default to migrate. 2b is complete when the final factory with and without `.asStream`, all supported output kinds, prompt modifiers, the call-argument rules, tool adaptation, and SDK helper integration use the core.

#### Modifier Combinations

From Phase 2 on, use at most one input modifier, followed optionally by `.asStream`, followed optionally by `.asTool`. For example, `create.LLMAgent.withTemplate.asStream.asTool(...)` is valid. A tool derived from an already-streaming parent retains that ordinary-call mode and collects only when executed as a tool.

Only LLMAgent and Template expose `.asStream`; Script and Function return streams declared by their schemas, and StreamingTranscriber always streams. Finite streams can become completed tools. A live operation without a completion boundary cannot be implicitly drained into a result. Keep runtime modifier properties and TypeScript chains aligned. Phase 1 adds no public factory or tool modifier; old non-agent tool factories can remain until Phase 2 replaces them.

#### Updating Demos for Phase 2

Keep implementation and migration guidance here; README2 documents the resulting API for first-time users. Here, demos/examples mean README examples and their tests, plus application-owned external experiments; the repository has no demo directory. Apply these mappings where those examples use the old API:

| Current demo API | Target API |
| :--- | :--- |
| `TextGenerator` / `TextStreamer` | `LLMAgent` / `LLMAgent.asStream`, default text output |
| `ObjectGenerator({ schema })` | `LLMAgent({ output: Output.object({ schema }) })` |
| `ObjectStreamer({ schema })` | `LLMAgent.asStream({ output: Output.object({ schema }) })` |
| Object `output: 'array'`, with element `schema` | `output: Output.array({ element: schema })` |
| Object `output: 'enum'`, with `enum` values | `output: Output.choice({ options: values })` |
| Object `output: 'no-schema'` | `output: Output.json()` |
| `.object` / `.partialObjectStream` | `.value` / `.partialOutputStream` |
| `.text`, `.object`, or `.textStream` read as the component's output | `.value` |
| `.run({ messages: history, ... })` | `.run({ messageHistory: history, ... })`; `messages` belongs to the SDK methods, with the SDK's complete-conversation meaning |
| Configured `messages` | `instructions` for fixed guidance; a `prepareCall` hook for examples added to each request |
| Cascada `options` | `renderOptions` |
| Direct call to a `Function.asTool`, unvalidated | Validate the resolved application input once without modifying it |
| `inputSchema` checks only call-time input | Resolve configured/call input, separate private dependencies, parse the final application input once, and execute with parsed values while preserving shared originals |
| Function callback second argument only on model tool calls | Always present: execution options with `abortSignal`, plus `toolCallId` and `messageHistory` on model tool calls |
| `messages` in tool execution options and `_toolCallOptions` | `messageHistory` |
| Tool context in `options.context` or `_toolCallOptions.context` | Casai implementations read validated tool-context fields in their flat context; plain SDK tools keep their native execution-options contract |

The Object mappings apply to old non-agent factories only; the Phase 1 internal core already accepts SDK `Output` and returns SDK results without object aliases. Keep model, prompts, tools, and other applicable settings. Both the internal core and the final factory use the SDK one-step default; examples needing a longer loop supply their desired `stopWhen` explicitly.

Before the next feature release, remove old Text/Object factories, finish the Phase 2 types and checks, and rewrite README examples and any owned external examples for the final API. Record the removal of old factories, the new `LLMAgent`/`.asStream` surface, modern SDK `Output`/results, promise-based agent streaming, `messageHistory`, custom `options`, `renderOptions`, isolated merged-context parsing with schema-produced values, and final tool/cancellation behavior in the release notes. Phases 1 and 1b add no public API to document or deprecate; no compatibility release, migration aliases, or deprecation cycle is required.

### SDK Inputs and Settings

These are final Phase 2 contracts, not requirements for the Phase 1 fixture.

| Configuration or override group | Target API rule |
| :--- | :--- |
| Fixed SDK contract | Configure `output` once; default to text. Per-call `output` changes are rejected |
| Casai preparation | Configure the source, `context`, `inputSchema`, loaders, filters, and `renderOptions`; `id` is metadata. Renderer/schema changes are not `.run()` overrides |
| Replaceable SDK values | `.run()` admits the requested operation's public SDK settings: model-call settings, `model`, `instructions`, `allowSystemInMessages`, retry/timeout/headers, `providerOptions`, `runtimeContext`, tool selection/order/approval settings, `include`, `telemetry`, and current experimental settings. Apply the callback/control policies below; exclude SDK `_internal` settings |
| Tool maps | Configure `tools` and conditional `toolsContext`; `.run()` can replace existing tools with compatible signatures, clear entries with null/undefined, and supply typed per-tool context. Merge by tool name with whole-entry replacement, never nested merging; strip cleared entries before SDK execution |
| Cancellation | Accept `abortSignal` only per invocation, including `.run()` and SDK methods. Reject it in constructor configuration. Configured `timeout` is allowed and a defined call timeout replaces it |
| Unsupported keys | Reject Casai-incompatible and fixed-contract overrides, including `.run({ output })`, `.run({ messages })`, and rendering setup changes. Delegate SDK-owned value validation rather than duplicating its schema |

Derive the SDK-setting projections from the installed public `generateText`/`streamText` parameter types and SDK Agent parameter types, omitting Casai input keys and explicitly fixed, deprecated, or internal keys. Keep the SDK responsible for validation it already performs, including model settings, model messages, registered tool arguments/context, and output parsing. Do not maintain a second exhaustive runtime schema or unknown-key whitelist for SDK-owned settings. Casai validates its own incompatible settings, reserved/legacy keys, fixed contracts, required values, and input/preparation rules before calling the SDK. The SDK is not a general unknown-property validator; TypeScript still rejects unsupported settings in typed calls. Preserve SDK error types and causes, and ensure asynchronous validation failures remain observable through the SDK's documented promises, events, and callbacks and Casai's final-value projection. Constructor settings can include streaming-only settings; only streaming execution applies them. Native methods keep the narrower SDK Agent request type. Treat undefined call values as not supplied before resolution.

### SDK Settings and Tool Context Boundary

Separate Casai preparation, SDK execution settings, and metadata explicitly; never spread the complete component configuration into an SDK request. In particular, configured `prompt` belongs to Casai preparation, `renderOptions` belongs to Cascada from day one, and neither `context`, `inputSchema`, `filters`, nor `id` is a model-call setting. The prepared Casai input or native literal request supplies exactly one SDK `prompt`/`messages` field; a native `messages` request must not retain the configured Casai `prompt`. Use `options` only for SDK custom call options; Cascada configuration uses `renderOptions`.

Reject deprecated top-level setting aliases in new configuration and Casai `.run()`: use `instructions`, `telemetry`, `repairToolCall`, and `include`, not `system`, `experimental_telemetry`, `experimental_repairToolCall`, `experimental_include`, or `includeRawChunks`. Constructor/Casai callbacks use stable names too. Native SDK calls still accept callback aliases exposed by the actual Agent parameter types; normalize stable/deprecated names once, with SDK precedence. This rule does not reject currently experimental SDK settings or rewrite opaque provider/tool data and SDK-owned hook return contracts.

Preserve the SDK's conditional `toolsContext` contract: tools with required context need configured entries; a context type including `undefined` makes its entry optional, and tools without concrete context need no entry. Carry configured `toolsContext` into every SDK operation, including native/UI-helper calls whose Agent parameters cannot supply it. `.run()` context overrides use configured tool names and their context types, replacing each supplied entry wholly while retaining other entries. SDK tool-context validation/defaults/transforms remain SDK-owned; do not parse them a second time or infer them from rendering context, `runtimeContext`, or custom options. Native Casai tools retain this boundary.

Retain the existing shallow parent/child merge policy and its corresponding inferred types. Each supplied tool definition replaces the entire definition under that name; never merge its fields. After resolving configuration and invocation overrides, remove tool entries explicitly set to null/undefined before exposing or forwarding the effective SDK registry. The effective tool types and required context entries must match the remaining tools. This deliberate normalization has a concrete purpose: SDK tool preparation expects actual tool objects, not removal markers. Do not apply it to arbitrary application context or duplicate SDK validation.

Keep fresh effective settings, immutable shared configuration, one execution in the requested mode, output/result/event fidelity, lifecycle callback composition, and direct SDK cancellation. Check cancellation before starting the SDK backend. Forward SDK tool signals through the final component-tool adapters. Engine interruption and automatic nested cancellation remain upstream work.

### Phase 2c: Tool Continuations

Add `resume({ messageHistory, approvals, toolResults, ...settings })` and the `approvals` and `toolResults` fields of `.run()`, as described in [Phase 2 call arguments](#phase-2-call-arguments). They need 2b's `messageHistory`, and nothing else depends on them, so they come last. `resume()` only normalizes the continuation input, then runs an ordinary execution.

## Loop Policy Is Separate from the Interface

Resolve configured and per-call settings, including Phase 2 inheritance, then pass an explicit `stopWhen` through unchanged. If it remains absent, add no Casai condition and let `generateText` / `streamText` use their one-step default. This is the same policy in Phase 1 and Phase 2, with or without `.asStream`; the SDK's separate `ToolLoopAgent` class instead defaults to twenty steps. Examples needing longer loops configure their condition explicitly. Add no hidden limit or loop counter.

Do not insert an effective fallback predicate into `.config`, track default-condition provenance, or inspect arbitrary stopping predicates. Under the final-output rules below, knowing that the SDK default applies does not improve the release decision: tool-free terminal output may stream, while possible tool calls require buffering until output eligibility is known. Pass stopping conditions to the SDK unchanged.

A one-step policy can execute tools; it does not automatically continue with another model call using their results. A step limit counts model steps, not individual tool calls. It is an upper bound, not a promise to run that many steps. Normal completion, pending external tool results, or approval requirements can end an execution earlier. SDK `prepareStep` remains available in either policy.

Providing the `Agent` interface and selecting a stopping condition are independent decisions. Phase 1 checks the interface through internal fixtures; Phase 2 exposes it on LLMAgent. On both paths, `stopWhen` controls continuation and takes a condition such as `isStepCount(1)`, not a numeric count. Template, Script, and Function do not implement this interface or acquire a model-driven loop; their native execution modes are independent of LLMAgent stopping conditions. No internal agent-mode flag or separate `loopCount` setting is introduced.

Accept the SDK's full `stopWhen` contract, including custom predicates and arrays of conditions. Resolve it from the Phase 1 explicit configuration object, or Phase 2 configuration inheritance, and isolated per-call overrides, then pass it to the SDK. Do not inspect the condition to infer an agent mode or change the component's type, rendering, result shape, hooks, or SDK methods. SDK compatibility remains available with every stopping condition. In particular, `createAgentUIStream` and `createAgentUIStreamResponse` must work with `isStepCount(1)`: this limits model steps per invocation, not chat turns. Tool parts can be emitted within that step; synthesis after tool execution requires another model step.

## Entry Paths and One Execution Core

### Phase 1: SDK Testing Ground

The Phase 1 fixture forwards normalized literal SDK requests to generation/streaming. A preparation callback may exercise the preparation boundary separately; no Casai callable or `.run()` parser is required. Final input/settings rules belong to [Phase 2](#sdk-inputs-and-settings).

SDK helper fields whose values are undefined must not accidentally clear configured timeouts, transforms, or callbacks. Keep this behavior in the final invocation resolver and preserve the existing configuration merge laws; ordinary calls normalize into the same named inputs as `.run()`.

### Phase 2: Casai Calls and SDK Calls

Phase 2 provides Casai calls and literal SDK calls because their input protocols differ. The ordinary call resolves its positional arguments by type into the same argument object as `.run()`; both run in the component's mode:

```text
Ordinary call / .run(arguments)
  -> normalize arguments; an undefined field counts as not supplied
  -> resolve configuration and call inputs, validate merged application context once, then prepare the effective prompt once
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
| Other settings | The shared core's replaceable SDK settings, tool maps, callbacks, and invocation controls defined in [SDK inputs/settings](#sdk-inputs-and-settings) and [callback/control policies](#sdk-callback-and-control-policies), with custom options added in 2b |

- Resolve the prompt by the same configuration/override rules on the ordinary call and `.run()`: a supplied prompt replaces the configured prompt, and an omitted/undefined prompt retains it. `messageHistory` is the conversation before that resolved prompt; its presence never suppresses configured preparation. Thus `.run({ messageHistory })` prepares and runs the configured prompt when one exists, including normal input validation. Only when no effective prompt exists does the call send the supplied history without adding a new turn. An empty history does not change prompt resolution; if both prompt and history are absent or empty, report an invalid invocation. Fixed `instructions`, custom options validation, and request hooks still apply. `.run()` exposes more named settings than the ordinary call, not different input-resolution rules.
- On a plain LLMAgent, use `agent(prompt, messageHistory?)`. The first argument is a string or `ModelMessage[]` prompt; one array is always prompt messages, and two arrays are new messages followed by history. Arrays carry no history marker and variable names have no runtime significance. History-only invocation uses `.run({ messageHistory })`. Rendered forms retain `(source?, context, messageHistory?)`, with Cascada keyword context allowed last. Do not reinterpret a lone array as history on another modifier.
- `messageHistory` in the result records the conversation, not the request. When `prepareCall` adds example turns or trims history before sending, it changes only what is sent.
- At the top-level invocation/settings layer, `undefined` means not supplied. This does not apply inside a supplied `context` map: an own `name: undefined` is an explicit shallow override. With configured `name: 'Ada'` and `z.string().default('x')`, `{ name: undefined }` resolves to `undefined` and then parses as `'x'`; omitting the property retains `'Ada'`. `null` likewise remains a supplied value, accepted or rejected by its schema. Preserve the existing runtime/type spread rules and add matching regressions. The inheritance rule that explicit `undefined` clears a parent value applies only to configuration inheritance; otherwise SDK helpers would clear configured callbacks, timeouts, and options on every request.
- Call-time lifecycle observers compose under the shared [callback/control policies](#sdk-callback-and-control-policies); normalize native SDK aliases once without promising serial observer completion.
- Contract-defining settings stay fixed: `output`, schemas, `promptType`, `filters`, `renderOptions`, and `loader`.
- `approvals` and `toolResults` continue a conversation whose last turn ended in tool approval requests or tool calls without results. They require `messageHistory`, exclude `prompt`, and append one `tool` message with SDK `tool-approval-response` and `tool-result` parts; nothing is rendered and no user turn is added. Match each decision and result against the calls still pending in `messageHistory`, and reject unknown, duplicate, or already-resolved IDs and pending non-automatic requests left without a decision. Each result entry has exactly one of the own properties `output` or `error`. `output` is the completed application result that the tool's `execute` would return, not an already-encoded SDK result part; a present `output: undefined` is still a success value. Convert successes through the registered tool's `toModelOutput` with the matched call ID and input. Without that converter, including for an unregistered external tool, use the SDK default: text for strings and JSON-normalized output for other values. Convert `error` through the SDK error-text path, bypassing the success converter. Reject contradictory decisions/results, including a success supplied for a denied call, before executing anything. An approved call with an external result must not execute again. Persistence and deduplication across requests belong to the application.

`resume({ messageHistory, approvals, toolResults, ...settings })` is the public continuation method. It runs in the component's mode, generating or streaming on `.asStream`; `.run()` accepts the same fields. Its result carries `messageHistory` like any other call, so applications can persist it between requests. SDK UI helpers don't use it: the UI client sends approval responses within the complete conversation.

Type `.run()`'s argument object from the component's input modifier, and the SDK methods with the SDK's call parameters, where neither `prompt` nor `messages` requires Casai `context`. Required rendering inputs apply only to the Casai path. Verify both paths in types and runtime behavior; do not rely on parameter bivariance to hide an extra rendering-context requirement.

Shared instructions belong in `instructions`. Prompt modifiers affect the Casai prompt only. Preserve supported SDK prompt settings, including validation of system-message placement.

Every invocation starts one execution in its requested mode, potentially with multiple steps. `.stream()` uses real incremental streaming and `.generate()` uses generation directly, whatever the component's mode. Do not route through the opposite default operation, buffer a complete generation into one artificial SDK stream, or generate again after consuming a stream. The final-output `value` projection can buffer candidate output as specified below; it still consumes one genuine SDK streaming execution. Factory construction starts no execution.

Streaming is required by the basic SDK `Agent` interface. Native `.generate()` delegates to `generateText()` and native `.stream()` delegates to `streamText()` through a promise-returning wrapper. Awaiting the latter yields a live stream handle; it does not drain the stream. Phase 1 verifies SDK UI helpers with its internal Agent fixture; every public Phase 2 `LLMAgent` form supports them directly.

### Tool Execution Context

Casai implementations receive one flat context assembled from parsed application input, private configured dependencies, and separately parsed trusted tool data. `inputSchema` declares application/model input; `contextSchema` declares trusted fields. Configured keys declared by neither are private dependencies. Do not require a helper namespace or advertise helpers as model arguments.

**Direct component calls** take one named object, for example `scale({ value: 2, factor: 3 })` with `value` in `inputSchema` and `factor` in `contextSchema`. `.run({ context: { value: 2, factor: 3 } })` is equivalent; Cascada object and keyword forms normalize to that object. Merge configured/call data using the existing rules, then route known private/trusted names to their sources before parsing application input. The application can override configured dependencies on this direct path; model arguments cannot.

**Registry/model calls** provide application arguments only. The component supplies private dependencies from configuration and the owning run supplies trusted fields through its `toolsContext` entry, as VoiceSessionSetup does through server execution options. Neither source can be supplied or replaced through argument keys. Plain SDK tools keep native `execute(input, options)`, including `options.context`; flat assembly is the Casai component implementation contract.

Use these source and parsing rules:

1. Context schemas accept and produce objects. Where flat sources must be partitioned, require discoverable, disjoint top-level ownership. Permit plain shapes and shape-preserving wrappers/refinements; reject root-level transforms/preprocessors or opaque schemas where that partition cannot be established. Defaults, coercions, and nested transforms remain supported. Do not execute callbacks to discover field ownership.
2. Extract known private/trusted bindings from a direct application's merged context. For registry calls, obtain those bindings only from their application-owned source, never from arguments. Other caller-only keys stay in application input, subject to normal strict/strip/passthrough behavior. Private dependencies bypass `inputSchema` so they survive its stripping and do not make strict data schemas reject helper configuration.
3. Merge configured declared application defaults with call/model arguments, preserving existing override rules, then apply `inputSchema` once. Configuration or schema defaults can complete required fields even with empty arguments. Use the parsed result, not raw defaults merged back afterward. Parse `contextSchema` separately once from its designated source.
4. For model calls, register the [merge-aware SDK schema](#sdk-tool-boundary-and-configured-defaults): its advertised requirements reflect configured application defaults, its validator merges and parses once, and its returned value contains only application input. Such declared/defaulted fields are public SDK arguments; private helper/trusted data stay outside SDK history/events. The separate `execute` wrapper binds those sources without reparsing. Injected coded-tool wrappers use the same merge-first parser explicitly.
5. Assemble the execution context without mutating recorded SDK arguments. Exclude all reserved private/trusted names from the application binding first, even when a trusted field is optional or absent, then add the selected private/trusted source values. A final spread alone would leave a spoofed optional field behind. Add fallback tools only where the resulting context lacks an own name. Never mutate caller objects, shared configuration, tool definitions, or environments.

The Function callback's second argument carries execution options, including `abortSignal` and SDK tool metadata (`toolCallId` and `messageHistory`, the SDK's `messages`) when applicable. SDK `runtimeContext` remains separate. `_toolCallOptions` is optional rendering metadata, never proof of already-parsed arguments: use the separate SDK `execute` boundary. Schema/property order does not define argument positions or change merge precedence.

### Tools in Coded Components

Template, Script, and Function accept configured `tools` and `toolsContext` with the same inheritance rules as LLMAgent. Their `.run()` also accepts per-call `toolsContext`, typed against the configured tool contracts. Merge that map by tool name; a supplied entry replaces the whole context value for that tool, and an omitted entry retains its configured value. Validate the effective trusted source with the selected tool's `contextSchema` on invocation. Tool wrappers capture the owning run's resolved map, so concurrent requests remain isolated without deriving components or mutating shared configuration. `toolsContext` is execution data, not rendering input or model-supplied arguments. Tool definitions and schemas stay fixed on coded-component `.run()`.

Tool functions are fallback bindings in a fresh shallow copy of the effective context:

1. Resolve source ownership and parse final application/trusted inputs as described above, then assemble the flat execution context with private configured dependencies before adding fallback tools.
2. Add a callable tool wrapper only if its name is not already an own property of the merged context. Values of `undefined`, `null`, or a non-function still shadow the tool.
3. Never mutate configured context, caller input, tool definitions, or the shared Cascada environment. No global registration or environment inheritance is required.

A shadowed name keeps the application value; calling a non-function fails normally without falling back to the tool. Shadowing affects this convenience binding, not the model's registered tool set. Applications needing both can register the tool under a different name.

Each injected wrapper resolves declared application defaults and arguments, applies `inputSchema` once, and separately parses trusted `toolsContext` through `contextSchema`. It binds private configured dependencies and invokes `execute` once with the assembled flat context. Its return is the completed tool result. A Casai component's root stream is collected by kind: text joins into a string, and elements collect into an array. A plain SDK tool whose `execute` yields an async iterable follows the SDK convention: each yield is a preliminary result and the last one is final. Do not reparse arguments after flat assembly; plain SDK tools retain native execution options.

A plain SDK tool needs an `execute` handler and receives a generated `toolCallId`, an empty `messages` list, and the caller's signal when available. No model made this call, so approval policies do not apply and no chat tool-call events are manufactured. A component explicitly supplied in `context` instead uses its ordinary callable and full result, and shadows an injected tool of the same name.

### Preparing New Turns Without Rendering History

For rendered chat, supply the new message as data in `context` and previously prepared model messages in `messageHistory`, for example `chat({ message: userText }, messageHistory)` or `.run({ context: { message: userText }, messageHistory })`. The configured template owns the source; user text is a variable value, never an additional template to evaluate. No reserved `message` context field is introduced: the application chooses its input schema and variable names.

Validate and prepare only the new call input. Snapshot and reuse history unchanged, then return the dynamic history, rendered prompt messages, and generated messages in top-level `messageHistory` for the application to persist. Script/function preparation may produce multiple new model messages; preserve their roles, content parts, and tool identifiers rather than converting them to one string. Preparation still runs once per invocation, not once per tool-loop step.

Do not infer newness from the last user message in an SDK conversation. The SDK methods' `prompt: ModelMessage[]` and `messages` carry no Casai preparation boundary, and retries, regeneration, tool results, or approvals may include an already-rendered user turn. SDK-shaped requests remain literal. An application that needs new-turn rendering identifies the new input separately and maintains prepared `messageHistory`: it regenerates by calling again with the same input and the earlier history, and continues tool calls with `resume()`. Original UI messages may be stored separately for display. This requires no mutable conversation state inside the shared component or hidden automatic rendering in UI helpers.

## Reuse Casai Preparation and Isolate Runs

Build the new core independently of the legacy entry path in `src/llm-component.ts`, using safe existing preparation utilities or an explicit backend descriptor. Its current SDK-function identity checks must not select the new core's message and result behavior. Phase 2a can refactor shared preparation with its callers/tests; Phase 2b removes the legacy entry path with the old factories.

Organize the shared machinery in four stages: resolve the invocation (configuration, settings, and mode), prepare its input (validation, rendering, and history), execute the operation (the SDK call or native producer), and adapt its result (augmentation, `value`, and tool completion). Keep tool completion in one dedicated adapter and final-answer selection inside the SDK integration layer, so specialized components don't copy LLMAgent logic.

Reuse Phase 1/1b source resolution, native schema parsing, and immutable invocation assembly. Phase 2 adds the final public call conventions and flat tool-context integration; it must not duplicate that shared correction. The following rules govern those paths:

- Ordinary calls and `.run()` resolve configured/call application input, separate private/trusted sources, apply each schema once, and execute with parsed values plus the selected bindings. Configuration and schema defaults can satisfy requirements on direct and tool paths. Call types model missing raw input; implementation types model parsed input with private/trusted dependencies. Preserve existing merge laws. Literal SDK methods skip rendering context; their tool wrappers still follow the merge-first contract. `_toolCallOptions` never authorizes a parse bypass. Unrelated merge/type changes require confirmation.
- A context field named `prompt` remains data. Function prompts keep context-only calls and function-valued prompt overrides, through `.run({ prompt })` or the first argument. There is no new `input` envelope.
- Tool context from `toolsContext` has its own isolation and schema boundary; expose its parsed fields in the flat Casai context as described in [tool execution context](#tool-execution-context). SDK `runtimeContext` is independent of rendering context.
- Phase 2 combines explicit `messageHistory` with the prepared or literal new turn, with no configured `messages`. On the SDK path, a complete `prompt` or `messages` conversation is a literal input block without an added configured prompt. Resolve the assembly to one SDK prompt/messages argument. Phase 1 does not implement this Casai history convention; its SDK methods already accept a complete conversation.
- Phase 1's baseline fixture returns unmodified SDK results; its required augmentation probes add candidate properties to those same genuine results. Do not reuse the old `response.messages` override. Phase 2 exposes top-level `messageHistory` while `response.messages`, `finalStep.response.messages`, `responseMessages`, and callback response fields keep their SDK meaning. It contains explicit dynamic history, the prepared/literal input block, and generated messages across all steps. Request changes made by `prepareCall` do not appear in it. On a stream, expose it as a lazy completion promise without consuming a stream merely to augment it. A terminal execution failure or abort rejects Casai `messageHistory`; SDK fields keep their own completion/error behavior. A legitimate pause for tool approval or an external tool result keeps resumable history and completed steps available even when `value` has no final output. Do not infer whole-execution failure solely from unavailable output or reconstruct a successful partial turn after an abort. A complete SDK conversation is already an input block; include it once and do not infer a new-turn delta. Verify both `[...input, ...result.responseMessages]` and continuation through `messageHistory` without duplicated input.

Build a fresh effective settings object per invocation using the existing shallow map merges and whole-value replacement rules. Never mutate the component's `.config`, `.tools`, or shared SDK settings. Snapshot history before asynchronous preparation, as existing components do. Isolation does not require deep-cloning models, tools, or arbitrary user objects; it requires that Casai's merge and preparation code never write run-specific state into shared objects.

Pass function settings such as `temperature` and `model` directly to `generateText` / `streamText` after resolution. Phase 1 native methods accept only the SDK Agent call parameters: preserve that type instead of casting Casai `.run()` options to them. Phase 2 `.run()` accepts the [call-argument object](#phase-2-call-arguments); the SDK methods keep the SDK Agent call parameters.

### SDK Callback and Control Policies

Use this policy in the final shared core and public LLMAgent; add no legacy replacement or augmented-event adapter. Constructor/Casai `.run()` settings use current names. Native SDK callback aliases are canonicalized once per request, with the stable name taking precedence, before composing configured and call-level observers. Install only the canonical callbacks once.

| Setting | Configuration and Casai `.run()` | Native SDK request |
| :--- | :--- | :--- |
| `onStart`, `onStepStart`, `onToolExecutionStart`, `onToolExecutionEnd`, `onStepEnd`, `onEnd` | Combine configured and call-level lifecycle observers | Combine configured observers with request observers; accept the aliases in the actual SDK Agent parameters |
| `onLanguageModelCallStart`, `onLanguageModelCallEnd` | Combine configured and call-level observers | Use configured observers; Agent request parameters expose no per-call override |
| Streaming `onChunk`, `onAbort` | Combine observers and preserve the SDK's await/processing boundary | Use configured observers; no Agent request override |
| Streaming `onError` | A defined call handler replaces the configured handler; pass its return value and failure behavior to the SDK | Use the configured handler; no Agent request override |
| `prepareStep`, `repairToolCall`, `experimental_download` | A defined call function replaces the configured function; preserve the SDK hook contract and result | Use configured hooks; no Agent request override |
| `experimental_refineToolInput` | Replace the whole map when supplied, preserving tool names and input signatures; never compose refinement functions as observers | Use the configured map |
| `toolApproval`, including its function/map forms | Replace the whole supplied setting; preserve SDK approval decisions and errors | Use the configured setting |
| Streaming `experimental_transform` | Replace the whole function/list when supplied, preserving list order and SDK stream semantics | `.stream()` accepts the same replacement; `.generate()` has no transform override |
| `telemetry`, including nested integrations/callbacks | Replace the whole object; the SDK owns its nested dispatch semantics | Use the configured telemetry settings |
| Phase 2b `prepareCall` | Replace the configured function when supplied through Casai `.run()`; invoke once and use its complete prepared settings | Use the configured hook; Agent parameters expose no override |

For combined observers, invoke both sources concurrently, await all settlements, and ignore observer failures as the installed SDK does; do not promise serial completion order. In particular, an `onChunk` observer promise still delays stream processing until it settles. Control hooks are not observer lists: never discard an `onError` retry decision, compose transformations implicitly, or swallow hook failures beyond the SDK's own behavior. An undefined override retains the configured setting. Streaming-only settings apply only to streaming execution, including native `.stream()` on a complete component. Do not classify a function by its JavaScript type alone; use this setting-specific table and the installed SDK contracts.

## Custom Call Options and Hooks (Phase 2b)

Implement this section only in Phase 2b. Phase 1 uses `CALL_OPTIONS = never` and SDK callbacks/`prepareStep`, without `callOptionsSchema`, `prepareCall`, or a temporary custom-options API.

Infer SDK `CALL_OPTIONS` from `callOptionsSchema`, separately from Casai input inferred from `inputSchema`. Default to `never` when no custom options contract exists. Use the SDK's public schema and hook types where applicable; validation and `prepareCall` are orchestration owned by Casai when calling the core functions directly, not features supplied by the `Agent` interface alone.

SDK methods and UI helpers use `options`. Phase 2a renames Cascada's setting to `renderOptions`; Phase 2b then uses `options` for custom call options everywhere. A call's options replace the configured value as a whole; never derive them from rendering context.

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

When call options are required, the ordinary call needs configured `options` defaults; otherwise callers must supply them per call through `.run()`. Enforce the requirement in types and before model execution. Configured `options` apply whenever a call does not supply its own, including calls from SDK helpers; native method types still follow the actual SDK Agent parameters. `callOptionsSchema` is fixed at creation.

SDK tool execution has no Casai custom-options argument. Consequently, `LLMAgent.asTool` with required custom options needs sufficient configured `options` defaults; reject an unusable final tool configuration in types and at creation. Applications needing request-specific options can explicitly bind a tool wrapper that calls `.run({ options, ... })`. Do not infer custom options from tool arguments, rendering context, or SDK tool execution metadata. This requirement and its tests belong to Phase 2b, where agent tools and custom options are introduced together.

Parse resolved custom options before invoking `prepareCall`, using the returned options including defaults/coercions/transforms. Call/configuration options use schema input types; the hook receives the output type. Run it once per invocation after input preparation or literal native request assembly. Follow the installed SDK hook contract: it receives resolved settings and returns complete prepared settings, not an implicitly merged override. Preserve other settings explicitly, including literal conversation, model, tools, and output. Keep contract-defining settings fixed and the call's signal in effect. SDK `prepareStep` runs per model step; rendering is not repeated per step.

## Uniform Schema Parsing

A schema at any boundary produces the value crossing that boundary: application input, trusted context, Script/Function output, stream element, or SDK custom option. Use its returned value, including defaults, stripping, coercions, and transforms. Context source ownership is separate: private configured dependencies bypass the application-input schema and are bound afterward. Strict/strip/passthrough govern application data, not whether a configured client/helper survives. Preserve caller/shared objects and existing merge rules.

Use supported SDK schema adapters rather than implementing validation/transformation. SDK-owned boundaries apply their schemas automatically; coded/rendered input and native output paths apply the same parser explicitly. A schema with no runtime validator does not acquire one through `asSchema`. Preserve causes, required async checks, and original schema objects. All custom callbacks treat inputs as read-only, returning structured replacements where needed. Native Zod copies declared containers; omit generic pre-copy machinery and restrict operations that mutate borrowed opaque references.

For streams, parse lazily per element in the existing consumption pass and forward the parsed value, keeping one producer and native cleanup/failure semantics. Do not duplicate a parse already performed by the SDK or Cascada. Type producers/configuration from schema input and consumers/implementation callbacks from output. SDK incremental parsing may run more than once internally; Casai adds no extra parse or promise of exactly-once SDK validation.

Explicit SDK `Output`/tool objects retain native behavior and JSON decoding, with no hidden-schema rewriting or revalidation of their parsed results. Result fields remain native. Phase 4 must use schema-produced values at Cascada's native boundary rather than compensate with an extra Casai transform. Opaque validators must satisfy the same no-mutation contract; unsafe borrowed-reference operations require an explicit restriction, not a claimed universal isolation mechanism.

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

The Phase 1 internal core uses these SDK output specifications directly, including for structured output. No Object agent factories or automatic legacy configuration translation are needed. When updating old examples, rewrite their `schema`/string-output settings explicitly using the [example mappings](#updating-demos-for-phase-2); that is application migration, not library compatibility machinery.

Agent calls retain all modern SDK result fields, getters, streams, methods, tool events, and metadata. Phase 1 returns the original SDK result and separately proves additive candidate properties in its internal risk fixtures. Phase 2 integrates and exposes `value` and history metadata without redefining SDK fields, flattening lazy getters, losing method receivers, or consuming streams; every Phase 2 call returns the augmented result, including calls through the SDK methods.

Every Casai processing step over an SDK result needs a concrete public-contract reason. Final-answer selection, tool completion, and assembled conversation history provide such reasons; redundant parsing, renamed activity views, or emulating existing SDK behavior do not. Keep SDK fields untouched and reuse SDK validation and event delivery wherever they already satisfy the required contract.

For result adaptation, prefer additive properties on the original SDK result, with lazy getters where needed. The installed stream result's `teeStream()` assigns a new `this.baseStream` each time it creates a view. A naive `Object.create(result)` wrapper can shadow that assignment and leave the original stream locked; any facade must preserve SDK receivers and state. A correctly forwarding Proxy can work, so do not claim that every Proxy fails, but no such facade is needed here. Phase 1 must prove candidate `value`, SDK `stream`/text views, final-result promises, lazy history, and UI-helper consumption against one execution, including different access orders and cancellation. Phase 2b reuses those proofs and adds public factory, entry-path, and type integration checks; it does not postpone the core feasibility checks until after Phase 1.

### Final Application Output

Keep `value` beside the SDK fields. It represents the final application output, excluding intermediate commentary and tool activity. The actual invocation mode chooses its delivery, including SDK methods: `agent.stream()` streams even on a complete component, and `streamingAgent.generate()` produces a complete value.

| Output kind | Complete `value` | Streaming `value` |
| :--- | :--- | :--- |
| Text | Final string | Native `tstream` of final-output text |
| Array | Final validated array | Native `stream` of final-output elements |
| Object | Final validated object | Promise of that object |
| Choice | Final validated choice | Promise of that choice |
| JSON | Final parsed JSON | Promise of that JSON |

**Verified typing constraint:** completed values infer correctly from native SDK output specifications, including Zod transforms. The installed SDK types do not always identify the output kind: `Output.text()`, `Output.choice({ options: someStringArray })`, and `Output.object({ schema: z.string() })` all have exactly `Output<string, string, never>`, and `name` is typed as `string`. Runtime names differ, but TypeScript cannot infer different delivery types from identical types. Also, `Output.array({ element })` and an object output whose schema returns an array have the same completed value type; only the former declares streamed elements. These facts are verified with TS6/TS7 in [the output inference probes](../tests/type-safety/sdk-output-inference.ts).

**Confirmed delivery typing:** preserve the runtime table and use a union of the possible delivery types when an explicit SDK output specification does not identify its kind statically. For the indistinguishable string-output specifications above, streaming `value` is a text stream or `Promise<string>`. Preserve the inferred application/element types inside that union; do not widen them to `any` or guess the kind from the completed value's shape. When the kind is known, retain its precise delivery type, including the default text output when no explicit specification is supplied. Complete invocations retain their inferred completed value type. Consumers narrow an ambiguous `value` through its async-iterable capability or use the SDK's final `output` promise directly.

Native Agent exposes separate `output`, `textStream`, and `elementStream` properties with fixed delivery contracts; keep those interfaces unchanged. The accepted union affects Casai's `value` typing only. Add no output wrapper, kind selector, schema rewrite, or execution to recover erased type information. Runtime delivery continues to follow the configured output kind and the finality/availability rules below.

**Collection invariant:** successful collection of streaming `value` yields the same application data as the same execution's final parsed SDK `output`. This compares views of one execution, not outputs of separate model calls. Native streams preserve output order and runtime kind. Partial object/array snapshots remain on SDK `partialOutputStream`; they are not completed `value` elements. Never concatenate intermediate answers into the final value or fall back to an earlier step's output when the loop stops without final output.

Output and element schemas may transform values, but their callbacks must be deterministic and non-mutating when incremental collection must equal the final parsed output. Explicit SDK `Output` objects retain native semantics. The SDK may check elements repeatedly during partial updates and final output; Casai adds no redundant pass or exactly-once claim. Keep stateful enrichment in explicit application code. If a native parser offers no stable incremental representation, reuse final SDK output rather than promising an unstable prefix.

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
| Tool calls remain possible, or effective tool/provider continuation state is uncertain | Eligible final output is not proven in advance, regardless of the stopping condition | Buffer until SDK execution establishes the final step, then release only eligible final output |

A tool without a local `execute` still matters: approvals, client-side tools, and deferred provider results can affect continuation and output availability. Do not equate “no executable tools” with “no tool calls possible.” Observe effective hook results without invoking hooks twice. Treat arbitrary stopping conditions as SDK-owned; do not inspect their bodies, call them against synthetic steps, or track whether the default was used. Even with proven terminality, buffer any prefix that retries or output transforms could replace.

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

Use one Casai output-availability rule in both modes and tool adaptation. Eligibility is a protocol decision about the completed execution, its final step, and unresolved tool work; it is not a guess about whether prose sounds like commentary or answers the user's question. Finality permits selecting a step; eligibility and the SDK's final parser determine whether its output can complete successfully. Never fall back to an earlier step.

Apply the following rules in order. The table describes Casai views when an SDK result exists: a rejected `generateText` call still rejects, and Casai must not manufacture a result or history handle for it. "Available history" means the completed exchange exposed by the SDK, not a guarantee that it contains a valid application answer.

| Completed execution or final-step state | Casai `value` in either mode | Casai `messageHistory` |
| :--- | :--- | :--- |
| Unrecovered execution error, abort, timeout, or final `finishReason: 'error'`, including after an earlier successful step | Fail with the reported failure/abort reason. If the SDK reports only an error finish reason without a cause, use `NoOutputGeneratedError`; never return recorded text as success | Reject with the same execution failure; do not assemble a successful partial turn |
| Execution paused with an unresolved approval, client tool result, or supported deferred provider result, even when text is present or the finish reason is `stop` | No eligible output: `NoOutputGeneratedError` | Available for continuation |
| Final finish reason is `tool-calls`, including when local tools have executed or been denied and a stopping condition prevents another step | No eligible output: `NoOutputGeneratedError`; accompanying text is not a final answer | Available; resolved tool calls must not be executed again |
| Final finish reason is `stop`, with no unresolved tool work | Reuse final SDK parsed `output`. Empty text is valid if that parser accepts it | Available |
| Final finish reason is `length`, `content-filter`, or `other`, with nonempty final-step text and no unresolved tool work | Reuse final SDK parsed `output` if it succeeds. Preserve the finish reason; this does not promise an untruncated or semantically complete answer | Available |
| Final finish reason is `length`, `content-filter`, or `other`, with empty final-step text | No eligible output: `NoOutputGeneratedError`, matching generation's availability rule even if streaming's raw `output` resolves | Available if the SDK completed the exchange |
| An otherwise eligible final step fails SDK output parsing or validation | Propagate that native output error; never report successful collection or return an earlier parsed output | Remains available if the execution itself completed and the SDK exposes its messages; output validation failure alone does not erase the exchange |

A completed provider-executed tool and answer in the same final step do not disqualify the answer. Nor does a resolved local tool call by itself: use the finish reason and unresolved-work rules, not `toolCalls.length > 0`. An earlier step's tool use likewise does not disqualify a later answer. Match calls, approvals/denials, final results, and tool errors through SDK identifiers and content/history; preliminary results do not resolve a call. Only provider mechanisms with a declared deferred-result contract imply deferred work from an absent result. Do not invent a provider continuation protocol or infer pending work from every provider tool event.

Unavailable complete `value` access throws; a stream-valued `value` rejects during iteration, and a promised `value` rejects. A successful streamed value must pass the same terminal and final-parse checks before closing successfully. Delivered prefixes remain delivered if a later check fails. Recovered provider attempts and recoverable `tool-error` events do not automatically fail the execution; resolved tool errors can be followed by an eligible answer. Preserve native SDK errors, result fields, event delivery, and validation without revalidating transformed output. Keep history's execution outcome separate from output availability, and retain that outcome once settled so a later abort cannot retroactively invalidate a completed result.

Phase 1 probes every row in generation and streaming, including different getter/consumer access orders. Confirm the necessary terminal evidence through supported SDK results, callbacks, and consumed events without creating an eager unused stream branch or another execution. Phase 2b reuses these probes for public `value`, history, and tool completion. A local SDK 7.0.130 probe found that nonempty text can make both native `output` views succeed even with `finishReason: 'error'`, while empty `length`/`content-filter`/`other` endings differ between generation and streaming. Those observations justify the explicit eligibility checks; they are not promises to preserve in Casai `value`.

**Installed SDK regression cases:** mock probes against `ai@7.0.130` found that a two-step text stream included `"Let me check. "` before final `"It is 18 C."`, while final `output` held only the answer. With intermediate array `["draft"]` and final array `["final", "second"]`, SDK `elementStream` yielded `["draft", "second"]` while final `output` was correct. Stopping after a tool call made generation's `output` throw `NoOutputGeneratedError`, but streaming's `output` returned intermediate text. These are version-specific observations to recheck during implementation, not behavior to preserve in Casai `value`. The adapter cannot simply alias raw SDK text/element streams or assume that native output availability is identical in both modes.

### Legacy Contracts Are Not Agent Contracts

Neither the Phase 1 internal fixture nor Phase 2 LLMAgent adds `.object`/`.partialObjectStream` aliases or old object callback/event shapes. Phase 1 tests use SDK `Output`, `.output`, and `.partialOutputStream`; Phase 2 examples use `.value` for application output. Existing non-agent factories can retain their old paths while the replacement is built, but do not adapt those contracts into the new core or mix their configurations and parents with agents.

Top-level output `schema`, string-valued output modes, `mode`, and `repairText` (including `experimental_repairText`) are outside the new core/agent configuration contract. Reject supplied legacy output settings rather than translating or silently ignoring them. Phase 2 removes the old factories, types, and family-based Config inference instead of broadening them to serve both legacy and modern Object APIs.

## Async Contract and Types

Phase 2 public agents use promise-based calls, including plain streaming, `.run()`, and SDK methods; the Phase 1 fixture exercises the promise-based SDK methods only. A streaming promise resolves to the live result, not completed output. Do not implement configuration-dependent immediate-versus-promised return types to match the old TextStreamer. In Phase 2 the `.asStream` component retains this same contract, and preparation errors reject consistently.

Native `.generate()` and `.stream()` always return `PromiseLike` as required by the SDK `Agent` interface. This requirement applies to the native method, not the Casai callable. Wrapping a stream handle in a promise does not wait for the stream to complete. Preserve lazy consumption, abort behavior, and native error timing.

Extend the actual SDK `Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>` type, with type-only imports, rather than copying a simplified interface. Import it under its own name; Casai exports no `Agent` factory, so no alias is needed. Add the appropriate Casai callable, `.run()`, `.config`, and metadata contracts. Infer tools, runtime context, output, and callbacks from the final inherited configuration; do not hard-code rendering context as SDK runtime context.

The Phase 1 SDK fixture and Phase 2 public LLMAgent provide `readonly version: 'agent-v1'`, `readonly id: string | undefined`, and `readonly tools: TOOLS`, normalizing absent tools to `{}`. Keep output/schema contracts, `promptType`, and renderer setup fixed through per-call arguments; constrain tool overrides to the existing tool signatures. Phase 1 uses internal modern settings/types with no legacy parents or new package exports. Phase 2 adds final configuration inheritance and updates `Config` validation/inference after removing legacy Text/Object configuration families and callback shapes. Components hold no hidden conversation state, and effective stopping defaults are not written into `.config`.

## Phase 2 Verification

Phase 1 has its own focused [completion gate](#phase-1-completion) above; this full public-API matrix must not become a gate for internal fixtures. Use mock models and register new mock-only files in `test:local`. Cover these boundaries in focused tests and the existing type-checking workflow. Run each final API slice's checks when it lands: the coded-component, tool, keyword-call, and [JavaScript stream checks](#phase-2a-stream-verification) with 2a, the `resume()` items with 2c, and the rest with 2b.

- Both SDK modes and the correct default operation on LLMAgent with and without `.asStream`, with every supported output kind. Reuse the Phase 1 core checks rather than introducing temporary factory families.
- Real incremental streaming through `LLMAgent`'s SDK `.stream()` and direct generation through `LLMAgent.asStream`'s SDK `.generate()`, with only one execution in the selected mode.
- Phase 2 call arguments: call-time prompts typed by every input modifier and prepared like the configured prompt, `messageHistory`, string/message-array prompts in first position, two-array calls, `.run({ messageHistory })` retaining configured preparation and validation, history-only execution only without an effective prompt, identical prompt resolution with empty history or omitted/empty context, and Cascada keyword context after history, rejecting the unmarked reversed JavaScript/Cascada form, `undefined` as not supplied, and configured `options` defaults. On the SDK path: literal `prompt` and `messages` never rendered or validated as input, and the exact `createAgentUIStream` call shape against every input modifier.
- New-turn rendering with previously rendered history unchanged; user text containing template syntax treated as data; script/function preparation returning multiple messages; reuse of prepared messages for regeneration and tool/approval continuations; top-level full-conversation history without guessing which input messages are new, and unchanged SDK response/responseMessages/callback fields without duplicated input.
- The same SDK one-step default as Phase 1, text as the default output, a single-step tool call versus an explicitly configured continuing tool loop, inherited/explicit stopping conditions (including custom predicates and arrays), isolated run overrides, and approval/external-result continuations. Verify that `.config` contains no injected stopping predicate and that spreading settings preserves execution behavior.
- Existing modifier, loader, parent, input-schema, prompt-override, function-prompt, history, and tool-adapter contracts.
- Complete modern output and event fidelity, schema validation, rejection of unsupported legacy options, and absence of legacy result aliases and history overrides.
- Native methods bypassing Casai preparation while retaining Phase 2b custom call-option validation and hooks; UI helper compatibility with tool and approval messages. Retain Phase 1's literal-request and undefined-override core checks.
- Concurrent runs with different model settings, tools, callbacks, context, and history; unchanged component configuration afterward. For LLMAgent and Template/Script/Function, verify configured required/optional `toolsContext`, per-call inference, merge-by-name with whole-entry replacement, validation, wrapper capture, and isolation across concurrent requests; coded-component tool definitions/schemas remain fixed. Cover whole-tool replacement and null/undefined removal after merging: no stale fields or cleared entries reach the SDK, exposed tool names and required contexts match the effective registry, and runtime behavior agrees with inferred types. Native Agent/UI-helper calls use configured SDK tool context without requiring rendering context.
- Every row of the shared callback/control table: observer composition without duplicates, concurrent/all-settled observer semantics, native alias precedence, rejected deprecated Casai settings, control replacement and return values, `onChunk` processing barriers, retry-capable `onError`, `onAbort`, cancellation, and transform-list replacement/order. Reject configured `abortSignal` and fixed output/render-setting overrides while retaining allowed per-call controls.
- Promise-based agent streaming on every entry path and no consumption merely to return a stream result. Verify inherited streaming mode without changing independently invoked child components.
- Required custom call options, configured defaults on Casai/SDK/UI-helper paths, sufficient defaults for registered agent tools, rejection of unusable agent tool configurations, actual SDK Agent assignability, output/tool/runtime-context inference, and invalid overrides under exact optional property types.
- Reuse Phase 1b tests: resolve final input and private/trusted sources, parse once, and use parsed values. Cover configured/schema defaults with empty direct and SDK arguments, valid overrides of invalid placeholders, missing raw inputs, parsed callback types, stripping/coercions/transforms, and unchanged shared originals. Model-facing requirements match configured capabilities. Preserve existing inheritance; incomplete fragments need not independently satisfy the schema.
- The Function and `.withFunction` preparer execution-options argument on direct and tool calls, including specialized preparers, signal forwarding during preparation, and no backend invocation after cancellation; equivalent JavaScript/Cascada named objects and Cascada keywords with marker removal, reordered/omitted optional fields, unchanged source/context/history forms, and no schema-ordered positional expansion.
- `.run()` on every callable component matching ordinary-call mode/result, coded execution settings, Function `.config`, and rejection of positional execution settings.
- Separate argument/context parsing followed by the same flat implementation context on direct and registered-tool calls. Cover trusted optional/defaulted fields, attempts to supply trusted fields through registry arguments or transforms, existing source precedence applied to parsed values, and unchanged plain SDK tool execution options.
- Fallback tools: injection after validation, configured/call-time shadowing including `undefined` and non-functions, shallow-copy isolation across concurrent calls, and unchanged model tool registration. Distinguish root text/element stream collection from SDK preliminary tool results: consume the latter once and return only the final yielded value, propagate producer failure, and preserve SDK empty-iterable behavior. Do not collect preliminary results into an array or execute twice.
- Explicit tool `execute` boundaries identifying already-parsed model input; a direct call carrying `_toolCallOptions` remains validated. No context-key or temporary WeakSet validation-bypass mechanism.
- No configured `messages` on LLMAgent, and `messageHistory` unchanged by `prepareCall` request changes.
- SDK-compatible consumption after Phase 2b augmentation: repeated stream-valued getter access produces independent views of one execution; final-result promises drive completion; later views replay buffered data; cancelling one view preserves others. Interleave `value`, SDK `stream`/text views, lazy `messageHistory`, final promises, and UI-helper consumption; preserve SDK result receivers/state and execute once. Verify Function forwarding and finite-stream tool collection without another execution.
- `value` in each actual invocation mode and output kind, with successful text/array collection equal to the same execution's parsed `output`. Cover intermediate commentary, intermediate structured output, finality proved before emission versus candidate buffering, custom stop conditions, and unchanged SDK/UI event delivery while `value` waits.
- Delivery types preserve precise known/default output kinds and use the confirmed union for ambiguous explicit SDK output types. Cover explicit text versus widened choice/string-schema output, exact completed/element types, narrowing through async iteration, inherited output configuration, and complete versus streaming SDK methods. Preserve native SDK result-property types.
- Every output/stream/custom-option boundary uses its parsed value with matching input/output types. Cover deterministic transforms, lazy parsed stream elements, parsed `prepareCall` options, and native SDK final-output availability/fallback. Never rewrite or reparse explicit SDK `Output` results; retain final collection equality and the documented unsupported stateful incremental case.
- Finality proofs: no tools, tools disabled by `toolChoice` or `activeTools` after hooks, hooks that re-enable tools, default and explicit stopping conditions without provenance tracking, approval denials without local `execute`, and deferred provider results. Buffer when proof is unavailable, distinguish a terminal step from an eligible answer, and preserve retry/transform prefix stability.
- Reuse every row of the [output-eligibility table](#output-availability-and-failures), including same-step resolved tools, unresolved approvals/client/deferred results, truncated versus empty endings, error finish reasons with recorded text, and final parser failures. Intermediate array elements never leak into final output, and tool-call termination reports no eligible output consistently in both modes and tool adaptation. Legitimate pauses retain steps and resumable history; a failed continuation never substitutes an earlier successful step. Output parsing failure alone does not invalidate a completed exchange exposed by the SDK.
- Terminal error/abort/validation rejection after a delivered prefix, valid empty outputs, recovered tool/provider errors, retries and transforms without abandoned/duplicated output, lazy branch creation, cancellation while buffering, and no extra model execution or simulated typing.
- Native SDK result types remain unchanged: `steps` is an array or its promise, `stream` exists only on streaming results, and no additional activity aliases are exposed. Verify `onStepEnd` notifications, final-step metadata, and output parsing without revalidating transformed values.
- `resume()` and the `approvals` / `toolResults` fields in both modes: persisted history, pending-only matching, unknown/duplicate/already-resolved IDs, undecided and automatic requests, mutually exclusive success/error fields, explicit undefined success, custom `toModelOutput` and default conversion, error-text conversion, contradictory denial/success pairs, and no re-execution when an approved call already has an external result.

Phase 2 reuses the core behavior tests and adds final factory, `.asStream`, default-output, tool-output, and updated demo contracts. Verify that the final factory exposes both SDK methods with and without `.asStream`, under single-step and multi-step policies, supports `.asStream.asTool` and inherited streaming tool mode, runs `.run()` in the component's mode, and has no `.asAgent` modifier. Neither phase requires paid LLM calls to verify these boundaries.

## Cancellation, Timeouts, and Usage

**Total timeout includes asynchronous preparation.** Resolve the effective timeout without changing inheritance/override rules and establish one invocation deadline before awaiting validation, loaders, `.withFunction`, `prepareCall`, or other preparation. A numeric timeout or SDK `timeout.totalMs` covers preparation plus execution. Input fully awaited by the caller before invocation is outside that budget; synchronous work is not promised preemption.

Represent the total limit by one invocation-local absolute end time and its cancellation signal, created before asynchronous schema processing or preparation. The SDK call reuses that signal; omit the already-owned total timeout at backend dispatch instead of calculating and starting another SDK total timer. Forward SDK step/first-chunk/chunk/tool limits unchanged. Keep public/configured timeout settings intact. Where a parent deadline is explicitly available, choose the earlier parent/child end time; reuse the parent signal/timer unless the child introduces an earlier deadline. Automatic nested propagation remains future work. Check cancellation after awaited preparation and before dispatch. A timeout object without a total limit creates no total deadline. A live stream handle does not end the scope: release owned timers/listeners only on execution/producer completion, failure, or closure. Work ignoring cancellation may continue, but its late result must not start another stage or become a successful result.

For example, `timeout: 10_000` establishes one deadline at invocation entry. Three seconds of preparation leave at most seven seconds before that same signal aborts; no replacement seven-second timer is passed to the SDK. A child deadline cannot extend its parent's. The shared scope is developed and tested early in Phase 1, reused by Phase 1b, and integrated with public call settings in Phase 2. It does not imply automatic nested propagation or Cascada interruption.

Phase 1 owns the shared deadline primitive; its fixtures use that scope for preparation and forward its cancellation to the SDK. Phase 1b reuses it before asynchronous schema/preparation work through internal execution options; it adds no public `.run()` API and need not wait for the remaining Phase 1 SDK probes. Phase 2a integrates that scope into coded-component `.run()`, cooperative Function cancellation, and explicit SDK-to-component tool-signal forwarding; Phase 2b integrates it into LLMAgent. New core/agent configuration rejects `abortSignal` until configured-signal combination is implemented, while configured timeout retains its established replacement behavior. SDK tool-signal forwarding does not depend on automatic Cascada propagation. Engine interruption/cleanup and automatic nested propagation remain upstream work. LLMAgent reports its own SDK usage and callbacks.

Cancellation that reaches every nested call automatically, aborted calls producing poison, stopping in-flight work when a stream consumer leaves, and usage for whole workflows are future features, recorded in [abort.md](abort.md) and [future.md](future.md). Workflow usage will come from Cascada's global telemetry channel, so Casai needs no call-tracking mechanism of its own. Both global channels need async context tracking, which also carries them through plain JavaScript such as Function callbacks. With them, every component, including Template, Script, and Function, will accept `abortSignal` and `timeout` in its configuration.

Verify with mocks that async schema work, preparation, and execution use one deadline signal; no new total timer starts at SDK dispatch, non-total SDK limits are retained, and `.config` is untouched. Test cancellation before dispatch, ignored late results, no unnecessary child deadline when a parent is earlier, and lifetime through stream completion. Also verify public `.run()` integration, explicit tool-signal forwarding, Function/preparer signals, and owned cleanup with controlled local async work.

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
- No phase exposes a public `.asAgent` modifier. `.asStream` belongs to `LLMAgent` until Phase 4 extends it to Template; Script, Function, and specialized components do not use it. Phase 4's coded components keep native contracts. None of these features adds Agent assignability or a tool loop to a specialized operation.

Modifiers apply only where their output fits the operation's input. Text/template preparation targets decision text state, a single embedding value, the reranking query, image prompt text, speech text, or voice-session instructions. A text or template modifier produces one string, so it never prepares an embedding batch; Script and Function preparers can return a string array for `embedMany`.

Each component's main property is the field named after the input it prepares: `state` (Decision), `value` (Embedder), `query` (Reranker), `prompt` (ImageGenerator), `audio` (Transcriber, StreamingTranscriber), `text` (SpeechGenerator), and `instructions` (VoiceSessionSetup). As on LLMAgent, a call-time value in that field has the configured value's type and replaces it for one call. Keep separately configured documents, image references, and masks intact when preparing text. `.loadsText` and `.loadsTemplate` use the normal text loader contract.

Script and function preparation can return the component's typed input: native decision state; a string or string array for embeddings; a query string or explicit `{ query, documents }` for reranking; an SDK image prompt; recorded audio values; a live audio stream; speech text; or session instructions. Only these declared input fields can come from a renderer; arbitrary configuration and fixed result contracts cannot be replaced through its output. For an explicit reranking input object, its query and documents form one prepared input and must not be mixed with another input's documents.

Parameterize preparation validation by the operation's input type. The existing language prompt validator (`string | ModelMessage[]`) cannot validate audio streams, embedding batches, or image-editing input. Preserve non-JSON values, binary data, and streams without cloning, stringifying, or consuming them. `.withScript` and `.loadsScript` return values directly; a `.withFunction` preparer receives the context and, as its second argument, the call's execution options. Generalizing preparation must not weaken existing language-message validation.

Rendered variants take rendering context in the ordinary call and `.run({ context, ...settings })`. Resolve configured/call input and private/trusted sources, then apply each input schema once before preparation consumes the parsed context plus bindings. Ordinary calls take no settings, so argument keys never classify context versus settings. Renderer type and result-defining contracts stay fixed at creation; per-call main properties follow the selected renderer's convention. Runtime state remains invocation-local.

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
- Preserve structured inputs and binary data. Phase 1's literal SDK message input retains image/file parts; Phase 2 extends the full script/function preparation surface to messages containing those parts. Phase 3 adds dedicated image generation/editing, not image-input support from scratch.
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
- **Future:** distinct `stream` and `tstream` channels with live return, plus `renderStringStream` returning `tstream`. A script declares `stream s` or `tstream s`, emits through `s(value)`, and returns it live with `return s`. Channels follow source order. Assigning a channel takes a snapshot of its emitted prefix, an array for `stream` and a string for `tstream`; a JavaScript stream assignment instead retains its reference. Native stream error termination, healthy complete returns, schema validation, and cleanup belong to Cascada, not a Casai consumer-dependent adapter.

Template rendering and native Script channel returns depend on these upstream capabilities. Existing loops already consume Phase 2 JavaScript streams. Casai matches text/element schema kinds to native `tstream`/`stream`, requires Script return kinds to match their schemas, and uses Cascada's ordinary rendering and return APIs. Cascada owns snapshots, validation, error handling, and native stream termination. Confirm the actual upstream APIs when implementing Phase 4; no separate internal-call/export boundary protocol is a Casai prerequisite.

### Composition and Template Rendering

The parent's mode does not switch a child's ordinary call. A child streams when it was created with `.asStream`, or is a Script or Function whose schema declares a stream. A Template forwards a child text stream while streaming and collects it during complete rendering, from the same source. A child LLMAgent's `value` contains only final application output in either parent mode; unknown loop finality may delay delivery without changing the resulting text.

Assignments, filters, property access, function arguments, and Script intermediate calls preserve the child's declared contract. A regular LLMAgent's `value` is its complete output; a streaming LLMAgent's `value` is its stream in both parent modes, and reading a final SDK value intentionally waits.

Do not detect LLMAgent results at text-rendering boundaries. A template reads `.value` explicitly, as a Script does, and renders the string or forwards the native stream it gets. Transcription events are not text; a template adapts them explicitly. Preserve the producer, declared kind, and consumption state across JavaScript/Cascada boundaries. Necessary schema or result adapters may return a different stream object without duplicating its producer.

Cascada delivers selected output in logical source order while independent producers run concurrently. It releases each available prefix and buffers later positions at gaps; Casai forwards that output without collecting the entire workflow to simulate streaming. Intermediate values stay internal until selected for output.

### Lifecycle

Awaiting a streaming call returns its live handle without draining it. Extend the existing [consumption contract](#stream-consumption) by using Cascada's native `stream`/`tstream` behavior directly:

- **Complete returns:** Cascada returns a complete healthy value or its poison/failure outcome. Casai does not accept partially failed objects and inspect or repair them itself.
- **Stream returns:** Cascada delivers healthy text/elements in source order and terminates at the first error. Preserve any delivered prefix; do not yield the failed item or later items. This behavior belongs to the native stream type, not to a Casai distinction between Script and JavaScript consumers.
- **Schema parsing:** pass declared schemas through the engine's supported API and use its parsed healthy values/elements. Do not reparse SDK/Cascada results, scan poison, or invent internal-call hooks. If the upstream API only validates without returning parsed values, align that API before Phase 4 rather than add a Casai transformation pass. JavaScript Function producers use Phase 2's lazy parser because Cascada does not produce those values.
- **Ownership and cleanup:** preserve the engine's backpressure, signal, closure, and ownership contracts. Returned streams remain live after the call resolves. Casai forwards supported cancellation and closure; the runtime owns shared-source cleanup, and interrupting an in-flight await still needs cooperation.
- **Collection:** collectors and tool adapters consume the returned stream once and propagate failure; they never report a successful partial string/array after an error. SDK events and transcription retain their SDK protocols.

Local recovery before producing a returned value remains Cascada language behavior. Casai does not add a promise that a parent can resume an already-failed returned stream, provide parallel strict/recoverable views, or infer the consumer from context or call stacks. No separate boundary-protocol feasibility project is required by this plan.

### Phase 4 Verification

Use local mocks and producers, with type checks; register new mock-only files in `test:local`. Reuse Phase 2 stream tests and add the following integration checks:

- Template with and without `.asStream`; no `.asStream` on Script and Function; `.run()` on every coded component, but no SDK `.generate()` or `.stream()`; no coded SDK Agent assignability.
- Bridge text/element schemas to native `tstream`/`stream`: retain kind through nested/empty streams, reject Script channel-kind mismatches, and forward schema-produced values from one native parsing boundary without another Casai parse.
- Script `stream`/`tstream` channels returned live versus assigned: an assignment takes a snapshot of the elements emitted before it in source order, as an array or a string, while an assigned JavaScript stream stays a reference.
- The same Template source through `renderString` and `renderStringStream`, forwarding and collecting streaming children, and logical prefix delivery.
- Stable nested call, assignment, filter, and argument types; intermediate outputs staying internal. Passing through an already-consumed JavaScript stream must not restore its contents or introduce replay. A returned live channel remains usable after the component call resolves.
- A native stream with a valid prefix followed by an error stops at that error, including through nested Script/Template calls and Function consumers. No failed or later item is delivered. Complete results follow Cascada's healthy-value-or-poison/failure contract.
- Healthy values/elements cross the declared native schema boundary as parsed values, lazily for streams. Test deterministic coercions/transforms and native failure forwarding without scanners, duplicate parsing, or consumer-dependent adapters.
- Verify native iterator/producer failure, lazy iteration, backpressure, supported cancellation through tool calls, early exit, ordered gaps, and runtime-owned cleanup without adding replay, cursor registries, or extra tee branches.
- Unchanged SDK results and events; final-output identity through streaming/complete Templates and forwarded Functions, including buffered tool loops; and `.asTool` collection of finite streaming LLMAgents, Templates, Scripts, and Functions without a second execution or an output-availability bypass.

### Upstream Integration Work

Phase 2 implements JavaScript stream kinds, lazy schemas, collectors, and producer failure. Phase 4 uses Cascada's live-return/rendering APIs, native kinds, ordered snapshots, validation, error termination, and cleanup contracts. Casai connects its schemas and execution options without a separate internal/public stream protocol. Shared iteration is already installed. New interruption/cleanup capabilities stay coordinated with [abort.md](abort.md); keep planned APIs distinct from installed exports.

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
