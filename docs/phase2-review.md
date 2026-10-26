# Phase 2 whole-surface review

## Schema presence and callback inference (2026-10-26)

Optional schema annotations no longer imply that a parser is present. `ConfigValue` reads the actual property type, and the ordinary configuration merge preserves omission, explicit `undefined`, and inherited alternatives. The former `DeclaredConfig` and `DeclaredSchemaValue` normalization is removed. A possible input parser contributes both raw and parsed callback values, including absent schema defaults; a possible output parser contributes both producer and parsed results. Annotated fixtures that require a parser now state that presence explicitly, while `satisfies` preserves concrete supplied schemas without widening the configuration.

The inference pipeline separates schema-property presence from schema values. One shared `SchemaConfigInferShape` infers optional keys, then uses that information to select required or optional value slots; `ConfigSchemas` reconstructs those properties without changing their modifiers. `NoInfer` prevents a value slot from overriding the independently inferred presence. This preserves existing unannotated conditional spreads without an annotation requirement or new runtime machinery. It also replaces the input-presence overload dimension: ordinary Function has two context specializations instead of four, Config has two signatures instead of four, and function preparers lose their duplicated input-presence specializations. Descriptor and preparer helpers reuse the reconstructed schemas rather than declaring separate optional-schema interpretations.

The consumer inventory covers all eight factories, inherited configuration, function preparers, descriptor callbacks, ordinary/named/tool calls, result types and registered helpers. Function preparer validation retains its own callback input when a configuration alternative has no parser. Conditional Function output callbacks account for the producer's unparsed schema input, and final tool callback validation uses the actual completed result. Concrete Zod intersections retain their output through the shared schema inference helper. Config checks its family shape separately from inferring the actual argument, so a provisional constraint cannot swallow invalid supplied settings; both raw and merged fragment contracts remain checked. The runtime surface fixture now groups correlated output settings and callbacks in the same conditional branch instead of describing impossible cross-products of the two component families.

Verification: the full source/build/emitted-consumer/exact-optional type gate passes. TS7 editor checks pass for source and declarations in both optional modes, including optional/defaulted body fields, unannotated conditional spreads and definite-schema neighbors. Five targeted production mutations are caught: optional schema presence, conditional input inference, configuration-value distribution, inherited alternatives and complete fragment validation. On the same four unchanged public consumer files (configuration, SDK callbacks, descriptors and conditional contracts), cold instantiations rise from 12,305,088 to 14,173,913 (15.2%); compiler memory falls from 2,078,860K to 1,944,786K. Wall-clock timings vary with machine load and are not used to claim a speedup. The independent production budget workload remains within its 2x ceiling (390,588 current instantiations versus 419,566 at its recorded baseline). The annotation consumer file is excluded from the before/after comparison because its intended schema-presence contract changes in this correction.

The final cleaned implementation passes the complete type gate again, scoped typed lint and whitespace checks, and all 197 mock-only runtime tests across schema preparation, configuration merging, function preparers and the LLM factory surface. The conditional-input mutation is rechecked after the final helper formatting change. The closing consumer review confirms that conditional spreads remain unannotated, optional schemas retain possible absence, definite schemas retain precise callbacks, and no runtime merge or parsing behavior changes. No important findings remain open within this schema-presence review; this is not a claim that the broader Phase 2 integration is complete.

## Configuration inference shape simplification (2026-10-25)

The follow-up inventory covers every remaining `Fragment` identifier in production types and their factory/test consumers. `ConfigFragmentDefinition` becomes `ConfigInferDefinition`: its schema/context/registry composition now also replaces the duplicate expressions in Function's ordinary and tool callback helpers. `ChildDefinition` becomes a private implementation detail. `FragmentCallbackInput` and `FragmentExecuteContext` become `AnyConfigCallbackInput` and `AnyConfigExecuteContext`, consistent with the existing family-specific input/context helpers. Their internal callback unions follow the same `Any…` naming; callbacks themselves are contracts, so adding `Infer` to every name would obscure their role. `FunctionFragmentConfig` becomes `FunctionConfigShape`, since it supplies the deferred Function branch of the family shape rather than an inferred result. `ValidateConfigFragment` retains its name: it validates incomplete reusable configurations, not inference. Explanatory prose still uses “fragment” with that meaning.

The callback input now names its generic parameters descriptively and reuses one `Final` parameter instead of repeating the final-config merge; its union-key calculation reuses the identical shared utility. Callback-only helpers no longer export internal details. The composition order, union distribution, inference barriers, callback variance and validation predicates remain unchanged. These are internal type reorganizations, with no new root export or runtime behavior.

Follow-up verification: the full source/build/emitted-consumer/exact-optional type gate passes in 98.1 seconds; TS7 editor checks pass for source and declarations in both optional-property modes. Scoped typed lint and whitespace checks pass. The same five-file cold profile passes with 12,461,474 instantiations, versus 12,461,741 immediately before this follow-up (24.1 seconds, with variable machine load). The closing inventory finds only the intentionally retained fragment validator and explanatory prose; historical review entries retain their original dated names.

The factory constraint review traced every `TConfig`/`TParentConfig` through Config, TextGenerator/TextStreamer, ObjectGenerator/ObjectStreamer, Function, Template and Script, including inherited settings, modifier overloads, callback specialization and final validation. `AnyConfig` remains the union of supported configuration values: it also supplies validation contracts, so putting deferred callbacks and provisional inference into that union would mix two different responsibilities. The former `ConfigFragmentShape` now owns the complete fragment inference composition under the user-selected name `AnyConfigInferShape`. Config's constraint is simply `TConfig extends configs.AnyConfigInferShape<TOOLS, INPUT, OUTPUT, ENUM>`.

Repeated text, object and tool inference compositions and their text/object parent variants live beside it in `types/config.ts`, using the same `ConfigInferShape` naming. Required/partial boundaries, intersections, modifier fields, overload order and resolved-config validation remain unchanged. Config still infers its parent as `object` before checking the family shape, avoiding premature distribution through the unresolved family union. Simple existing constraints remain direct; there is no additional mode selector or new public root export.

Isolated pre-change probes compiled the same five public consumer files (configuration, SDK callbacks, descriptors, conditional contracts and annotations). Restoring `Partial<AnyConfig>` produced 27 errors; removing tool shaping produced two, removing callback shaping produced 15, and removing provisional inference produced 25. These failures include lost contextual callback types, lost rejection of incompatible inherited descriptions and rejected valid calls. The retained rules therefore have concrete consumers; this change centralizes their composition without reverting their behavior.

The full source/build/emitted-consumer/exact-optional type gate passes (93.3 seconds). TS7 editor checks pass for source and declarations in both optional-property modes, covering callback/body/call completion and named diagnostics; scoped typed lint and whitespace checks also pass. On the identical cold five-file compiler workload, instantiations decrease from 12,490,248 to 12,461,741 (about 0.23%); elapsed times were 25.9 and 14.9 seconds, respectively, but variable machine load makes those timings unsuitable as a speedup claim. The closing consumer pass found no stale shape names or additional required constraint changes. This is a type-only change; runtime behavior and dependencies are unchanged.

## AI SDK runtime reuse evaluation (2026-10-25)

This second evaluation extends the type-ownership pass to runtime code. It inventories the public exports of installed `ai` 7.0.130 and `@ai-sdk/provider-utils` 5.0.56, then traces every production module through generation, schema processing, tool binding/execution, results, streams, configuration, errors and Cascada rendering/loading. SDK implementations inspected include `ToolLoopAgent`, its Agent parameters, core generation/streaming, tool-call parsing/execution/context validation, output specifications and public utility implementations. No private SDK import or dependency upgrade was introduced.

| Area / candidate | Decision and reason |
| --- | --- |
| Non-array object admission: `isRecord` | Adopted in context admission and configuration validation. It exactly preserves current admission, including class instances and null-prototype objects, and supplies native narrowing without a cast. Do not substitute it for the narrower plain-object snapshot/metadata predicate. |
| Executable tool recognition: `isExecutableTool` / `ExecutableTool` | Adopted for injected helper selection and registered-name protection. This removes the reconstructed executable-tool type assertion and keeps native provider/non-executing descriptors unchanged. A context assertion remains at the heterogeneous registry's erased generic boundary. |
| Model loops, retries, provider dispatch, usage and structured output parsing | Already delegated to `generateText`, `streamText`, `generateObject`, `streamObject` and native output specifications. No local provider/retry/output-parser implementation to replace. |
| General Agent facade: `ToolLoopAgent` | Keep for the planned LLMAgent integration, not as a substitution beneath retiring factories. It defaults to 20 steps versus the core functions' one step, composes lifecycle callbacks, has its own call-options preparation, and exposes different call/stream forms. Swapping it in would change contracts rather than remove duplicate execution. |
| Native tool execution: `executeTool` | Already reused for injected third-party tools, including scalar/promise/preliminary/final output handling. Casai collected stream outputs deliberately differ from native tools' last-yielded final output. |
| Tool construction: `tool()` | The SDK implementation returns its argument unchanged. Wrapping Casai's descriptor in it would not replace binding, parsed-entry execution, closed-input admission, configured-default projection or metadata forwarding. Native descriptor types already supply the contract. |
| Tool-call/context pipeline | SDK owns model calls, approval/history revalidation, context parsing, lifecycle/telemetry, provider error conversion and timeouts. Internal `executeToolCall`/`validateToolContext` are not public replacements for injected calls; they also introduce lifecycle, timeout and unwrapping behavior outside the injected-call contract. |
| Schema conversion and parsing: `asSchema`, `jsonSchema`, `safeValidateTypes` | Already reused. Keep the small stage-error/result-envelope wrapper: it protects private diagnostics and preserves application objects with callable `then`. The native throwing `validateTypes` unwraps the value and assimilates such objects; a native control demonstrates that difference. |
| Input declarations/default projection | Retain Casai logic. Native conversion supplies metadata but does not select configured public defaults, reserve private names, enforce Casai's closed top-level tool contract before preprocessing, or relax required fields under immutable per-run bindings. Replacing declaration discovery with conversion would also exclude supported non-JSON local fields. |
| Message schemas and prompt validation | Already use the SDK validator after the previous approved change. Casai retains creation/invocation error classification, prepared-prompt parsing and its distinct source/history call forms. No duplicate message schema remains. |
| Output and response views | Already preserve SDK result methods, completed output, streams and `responseMessages`. Casai `value` eligibility/finality and history prefix are additional contracts; native `textStream`, `elementStream`, output promises, UI conversion or `pruneMessages` do not establish the same guarantees. Existing result/approval/retry tests remain the relevant acceptance controls. |
| Iterable conversion: `convertAsyncIteratorToReadableStream` | Retain `toReadableStream`. Native conversion accepts an already-acquired iterator and prefetches with the default queue strategy; Casai delays acquisition, uses high-water mark zero and checks cancellation after pending reads. A public option for demand-only/lazy conversion would make this a future reuse candidate. An extra adapter today would recreate the machinery. |
| Collection: `consumeStream` | Not equivalent to the public collectors. It discards values, catches read failures and optionally reports them through `onError`; Casai collects values/text and rejects on producer failure. Wrapping it would add stream conversion and buffering without reducing the collector. |
| Iterable detection / stream wrappers | The SDK's `isAsyncIterable`, `createAsyncIterableStream` and `asAsyncIterableStream` implementations are internal, not public root exports. Keep the small protocol check and use standard streams; do not deep-import them. Shared iteration remains delegated to Cascada's public `makeSharedIterable`. |
| Context stability: `isDeepEqualData` | Not equivalent. It accepts freshly allocated but deeply equal dependencies and ignores symbol keys; fixed bindings require shallow reference identity plus enumerable symbol-aware presence. Native/local controls demonstrate both differences. |
| Configuration filtering: `removeUndefinedEntries` | Not equivalent. Despite its name it drops both null and undefined. Casai preserves own undefined/private bindings, explicit null/undefined tool removals, and established merge semantics. |
| General value resolution: `resolve` | Not suitable for context/default data: it invokes function values and assimilates thenables. Casai must distinguish executable source from application/trusted data structurally. |
| JSON/error helpers | Native JSON parsing/serialization and `getErrorMessage` do not replace descriptor-only default annotations or stage-specific causes. The annotation selector avoids getters/toJSON and omits unsupported values; generic serialization changes that behavior. Keep native errors on native paths and Casai errors for Casai-owned failures. |
| Callback/configuration merging | Casai overrides callbacks and uses explicit shallow map/message/loader policies. Agent callback composition and native nullable filtering differ. Internal merge helpers are not public generic configuration APIs. |
| Cancellation and deadlines | Native request options are forwarded unchanged; cooperative checks/forwarding stay local. Do not add SDK delay/retry helpers, controllers, timers or signal merging to emulate the deferred shared-deadline design. |
| Rendering, loaders, UI, other modalities | Rendering and loaders already reuse Cascada. SDK download/network helpers are not named template loaders. UI transport uses native result/Agent APIs where applicable; there is no replacement UI transport here. Embedding, audio, images, realtime, batch and middleware APIs have no duplicate production implementation to remove and remain feature-scope work. |

The new `SDKReuse.unit.test.ts` supplies native controls for record admission, shallow identity/symbol protection, own undefined/null bindings, safe-validation envelopes, stream prefetch and collector failure propagation. Existing registry/config/stream tests exercise the two adopted helpers through production consumers. The final reverse pass checks each local wrapper against its owning guarantee, rather than treating the existence of an SDK helper as sufficient evidence for replacement. No additional behavior-changing replacement is recommended in the current scope; the concrete future candidates are Agent adoption through the planned API and a native stream-conversion option that preserves Casai's demand-only contract.

Verification: 369 focused mock tests pass across the new native controls, registry, configuration, streams, schema preparation, tool lifecycle and result augmentation. The full source/build/emitted-consumer/exact-optional type gate and scoped typed lint pass. Isolated source copies demonstrate that substituting native deep equality, the throwing validator or the prefetching stream converter fails the corresponding behavioral assertion; the unchanged baseline passes. The subsequent complete consumer-to-owner pass found no further equivalent public SDK replacement worth adopting. No public behavior, merge law, validation order or error classification changed in this pass.

## SDK type ownership audit (2026-10-25)

The user requested a complete check for types that copy AI SDK contracts. The audit covered every production source module, public export, factory modifier, configuration and callback type, result alias, validator and downstream execution/renderer consumer. The installed SDK's callable requests/results, `ToolLoopAgent`/`Agent`, tool executor types, schema inference, prompt standardization and message validators supplied the comparison. This is a type-ownership audit, not a new whole-implementation or phase-completion claim.

| Surface | Ownership after this pass |
| --- | --- |
| Text settings, lifecycle callbacks, tool approvals, stream transforms and result members | Specialized native request/result types; existing callback inference and alias inventory retained. |
| Object settings and callbacks | Each output mode instantiates the actual SDK request. No copied schema-name/description fields or reconstructed finish events. Casai alone owns optional prepared prompts, application input schemas, invocation-only cancellation, required non-default modes and readonly enum authoring. Explicit `output: undefined` continues selecting object mode. |
| Object result variants | Instantiated native function return types plus Casai's `value` view. This removes the copied `AsyncIterableStream` type and partial/element selection rules. No-schema `partialObjectStream` now correctly has the SDK's `DeepPartial<JSONValue>` element type. |
| Native tool descriptors and execution metadata | Specialized native `Tool`/`FunctionTool`, `ToolExecuteFunction` argument tuples and `ToolExecutionOptions` projections. A Casai executor deliberately requires a function and returns a promise for the collected result; arbitrary native sync/stream returns are not substituted for that guarantee. `never`-returning bodies remain callable. |
| Default text output and conversation snapshot | Derived from `Output.text` and the native request. The known default `name: 'text'` refinement is Casai's delivery guarantee. |
| Model messages and validation | Public `ModelMessage` stays native; `ModelMessageSchema` is now an identity re-export of `ai.modelMessageSchema`. `PromptStringOrMessagesSchema` composes it with the Casai string-prompt alternative. All copied message and part schemas were removed. |
| Schema output inference | Concrete Zod schemas use Zod's `core.output`; other supported schemas use SDK `InferSchema`. Direct SDK-only inference widened annotated concrete Zod intersections with `undefined`; existing annotation/descriptor tests caught this. |
| Raw schema input and schema admission | Retained Casai adaptation: SDK schema types can erase raw inputs, while Casai distinguishes raw callers from parsed consumers, rejects Zod 3 direct schemas, and declares custom stream inputs. No trial parsing or replacement validation was added. |
| Application context, registry bindings, defaults, inheritance and security admission | Casai-specific merging/provenance/callability contracts; native tool inputs/context/output remain inferred through SDK types. These are not equivalent to an SDK tool's raw executor signature. |
| Prompt/render/load APIs, call forms, result delivery/history, stream collectors and errors | Casai or Cascada behavior composed with native message, schema and result types. Generic TypeScript utilities and erased runtime capability views are not copied SDK interfaces. |

The user explicitly approved adopting native message validation after a concrete comparison: it rejects malformed media/tool outputs/provider options, accepts undotted custom kinds, and strips extra properties in parsed values. This supersedes the older message-validator deferral recorded below. Native runtime custom-kind acceptance remains broader than its TypeScript type. The installed validator also strips `providerExecuted` from parsed approval responses; no local schema patch compensates for that native discrepancy. Configuration validation, like native prompt standardization, checks messages without replacing the originals. Exported `.parse()` and Function/Script preparers use native parsed values. Tests retain source objects and distinguish these paths.

Public consumer checks compare all retained native settings and result members for all seven object variants, plus executor tuples and optional metadata. Existing factory, annotation, callback, schema, inheritance, source/emitted and exact-optional cases remain active. Focused runtime checks exercise schemas, configuration, direct calls, run overrides and function/script preparers, including zero-dispatch failures. Future SDK changes still require these compatibility checks; deriving a type does not by itself prove runtime support for a new SDK feature.

Verification: the complete source/build/emitted-consumer/exact-optional gate passes in 102.5 seconds; 397 focused mock tests and scoped typed lint pass. Isolated mutation checks detect omission of a native object setting, reintroduction of the old no-schema partial result type, and erasure of executor context. The subsequent complete pass from native declarations through public types and downstream consumers found no remaining avoidable SDK contract copy or unresolved type-ownership issue; retained adaptations are listed above. No paid model calls or unrelated execution changes were introduced.

## SDK-derived configuration callbacks (2026-10-25)

The callback follow-up traced public configuration annotations, inferred factory/fragment/run callbacks, native tool descriptor callbacks and exported event aliases. Inferred text callbacks already use resolved tools, output and runtime context; explicit `GenerateTextConfig` and `StreamTextConfig` annotations previously fixed the latter two to broad defaults. Both now accept optional `OUTPUT` and `RUNTIME_CONTEXT` parameters after their existing parameters, preserving existing annotation compatibility. Their native settings and callbacks reuse the same specialized SDK request aliases as factory inference.

Object `onFinish` contracts and the public stream-object event alias now derive from the installed `generateObject`/`streamObject` functions. This avoids reconstructing their return contracts or relying on the older exported stream callback alias, whose event differs from the actual function's current contract. Casai prompt and implementation callbacks retain their own context contracts; native tool properties already derive from specialized SDK `Tool` members.

The new public consumer fixture compares every retained text-request property with its specialized SDK counterpart, checks inline runtime context, tools, parsed tool input/results, structured stream output and callback returns, and feeds annotated configurations into the factories. Object-array callback equality and native event fields also cover SDK `PromiseLike<void>` returns. Existing callback inventory, inheritance, run overrides and both optional-property modes remain part of the type gate. No runtime behavior, merge order or schema processing changed.

Verification: the full source/build/emitted-consumer/exact-optional gate passes in 64.6 seconds. Scoped typed lint passes. An isolated baseline and three mutations verify that the new consumer tests detect erased generator runtime context, erased stream structured output and erased object-finish results. The subsequent public-consumer and native-contract pass found no further actionable callback specialization gap in this scope. Runtime tests were not repeated for these type-only changes.

## Unknown/any specialization audit (2026-10-25)

The audit inventoried the public entry point and all factory overloads, reusable configuration annotations, SDK/descriptor callback reconstruction, injected helpers, result views and stream utilities, then traced their runtime consumers through schema preparation, engines and LLM dispatch. It distinguishes erased runtime boundaries and inference constraints from places where an available type was being discarded.

- `parseSchema` now preserves the schema's output type in its result envelope. `validateAndParseOutput` distinguishes required, absent and optional schemas; it no longer asserts that a transformed output has the producer's original type. Public component signatures already described parsed outputs; the internal helper now agrees with them. Prompt rendering consumes typed parsed results without assertions.
- `FunctionPromptConfig<Context, Prompt>` and its underlying prompt-function type allow reusable annotated callbacks to specialize their argument and return form. Existing defaults remain unchanged. Factory-inferred callbacks continue deriving their context from resolved configuration and schemas.
- `StreamObjectOnFinishEvent` accepts the native `FlexibleSchema` contract instead of only Classic Zod and SDK schemas. It preserves output inference for Standard Schema, Zod Mini and SDK schemas, plus native Zod 3 output-event support; this does not relax Casai component schema admission.
- Explicit `bindToolContext()` results retain the captured context type when no parser exists; an optional parser preserves the union of parsed and captured context types. Native descriptor executors still receive parsed context, while the paired binding context remains raw.
- JSON default annotations now return `JSONValue | undefined`. Prepared LLM execution requires `PreparedExecutionContext`. Redundant filter/output assertions were removed, and native description properties no longer specialize unrelated input/output parameters with `any`.

Retained deliberately: raw invocation/schema-inspection values and caught errors are `unknown`; runtime tool registries have heterogeneous, erased values; native output-kind erasure remains native; unschematized Script results remain unknown. Generic callback-matching constraints, schema-admission wildcards and provisional inference shapes are not callback argument types presented to users. Replacing their permissive constraints indiscriminately can reject narrower callback parameters or named context interfaces. Public `Context` and unspecified configuration defaults retain their compatibility contract; explicit specialization and factory inference provide precision where information exists. Existing precise `collectStream`, `toReadableStream`, result augmentation and SDK callback mappings need no added generics.

New exact-equality and negative checks cover schema transformation, absent/optional schemas, specialized reusable string/message prompts, native finish events, raw injected helper arguments and parsed SDK tool-call/result callbacks. The follow-up inspection found no further actionable erasure in this scoped audit; this is not a new whole-implementation completion claim.

Verification: 146 focused mock tests pass across schema identity, streams, function prompts, engines and registered tools. The final source/build/emitted-consumer/exact-optional gate passes in 98.2 seconds. Isolated copies detect all four type mutations: erased schema output, erased validated output, erased prompt context/return specialization and erased captured binding context. Internal helper assertions are checked through source; public helper/callback assertions are checked through the package in both source and emitted modes. The optional context default retains explicit `undefined` compatibility. Scoped typed lint passes; source and exact-optional checks were repeated successfully after test-fixture cleanup.

## Execution contract organization (2026-10-25)

`ExecutionConfig` and `PreparedToolRegistry` now live in `src/types/execution.ts`; the configuration view reuses `ToolRegistry`. `PreparedExecutionContext` describes the assembled fields and required `_toolOptions` metadata, allowing the LLM tool adapter to consume that metadata without an assertion. The private executor contract requires `Promise<unknown>`, matching every existing implementation. Private binding helpers are named `BindableComponentTool` and `ComponentToolBinding`, distinguishing them from the public generic `ComponentTool`. `ComponentExecutionOptions` remains in `types/sdk.ts` without a context generic because it omits the only SDK property affected by that generic. These changes preserve runtime behavior and public callable contracts.

Verification: the complete source/build/emitted-consumer/exact-optional type gate passes in 131.8 seconds, and scoped typed lint passes. Runtime tests were not repeated for these erased type declarations, type-only imports and assertion removal.

## Structural loader and tool recognition (2026-10-25)

Loader recognition now inspects the existing `loaders` array and `groupName`; processed named loaders also have a callable `load` method. Both the original symbol tags and the intermediate `loaderKind` enum have been removed. Native race loaders without Casai group metadata remain ordinary loaders. Loader grouping, deduplication and native Cascada execution remain unchanged. Components expose their internal binding operation through the non-enumerable `_bindToolContext` method, distinct from the public `bindToolContext` result. Registry preparation recognizes and calls that method; spreading a component still loses the internal method and is rejected. This replaces the versioned symbol protocol and its incompatible-version diagnostic and mutation checks. Earlier entries describing shared symbol identity are superseded; no `Symbol.for` usage remains in production source.

Verification: 141 focused loader, registry, tool-lifecycle and interoperability tests pass. The complete source/build/emitted-consumer/exact-optional type gate passes in 112.5 seconds, and scoped typed lint passes. The spread-rejection mutation is detected with the updated anchor. Loader merge rules and tool preparation/validation order are unchanged.

Follow-up verification after removing the intermediate loader enum: all 94 focused loader tests pass, including structural group merging, unchanged processed-loader reuse, and native race loaders without Casai group metadata. The complete source/build/emitted-consumer/exact-optional type gate passes in 111.0 seconds; scoped typed lint passes. Tool detection already checks its actual binding method. The two erased type-only symbols remain because they support callback inference and helper contract compatibility rather than runtime identification.

## Agreed naming and type organization cleanup (2026-10-25)

SDK-derived implementation types now live in `src/types/sdk.ts`: native `PrepareStepFunction` supplies the step callback contract, alongside its argument type, SDK request aliases and the existing public `ComponentExecutionOptions` adaptation. Implementation modules import these types; the public execution-options export retains its name and structure. Prompt-mode variables and parameters use `promptType` (and `TPromptType` for generics), while output-kind and application discriminants retain their separate meanings. The internal registry interface is named `PreparedToolRegistry`. The Function callback branches are named `InputSchemaFunctionExecuteContext` and `NoInputSchemaFunctionExecuteContext`; their function-property and method syntax intentionally retain the existing variance rules. The latter name refers only to the absence of an input schema, since an output schema may still be configured.

`ConfigFragmentDefinition` (formerly `FragmentDefinition`) moved beside `ChildDefinition` in `src/types/function-config.ts`. These helpers and the adjacent Function callback helpers use descriptive schema, configured-context, tool-registry and actual-config parameter names, preserving their merge expressions and inference behavior. Redundant error re-exports were removed from `validate.ts` and the engine modules; `index.ts` exports the error classes directly from `errors.ts`. The public-constructor identity check now targets that central module. Error recognition now uses `instanceof`; the global error markers and `.isInstance` guards, cross-copy error tests and associated mutation cases were removed. Replacing prompt-type strings with an enum remains a separate unresolved decision.

Verification: all 461 selected mock tests pass across error exports, configuration inheritance, function preparers, LLM modes, registered tools and result augmentation. The complete source/build/emitted-consumer/exact-optional type gate passes in 122.3 seconds; changed-file typed lint passes in 28.8 seconds. The refactor preserves call/configuration acceptance and runtime behavior apart from renaming the debug field from `kind` to `promptType`. Full coverage and unrelated editor/mutation matrices were not repeated for these naming and type-location changes.

The subsequent error-marker removal passes 153 focused mock tests covering error boundaries, component interoperability and LLM surfaces, plus the complete source/build/emitted-consumer/exact-optional type gate (131.9 seconds). Error recognition uses constructor identity through `instanceof`; cross-copy error recognition is no longer a Casai guarantee.

## Error ownership refinement (2026-10-25)

The user requested centralized error definitions and correction of the broad `ConfigError` classification. `src/errors.ts` now owns `ConfigError`, `ValidationError`, `ScriptError` and `TemplateError`; the public exports and existing internal re-exports share the same constructors. `ValidationError` is a separate class for invalid call arguments and Casai-owned application input, trusted context, preparer output, component output and stream-element validation. `ConfigError` retains configuration and schema/binding capability failures, including lazy declaration/projection failures and missing stream-schema declarations. Existing runtime-validation consumers must update their catches. Earlier entries below describe the former broad `ConfigError` contract and cross-copy error guards; the naming cleanup above supersedes the latter.

The first pass inventoried creation/inheritance, shorthand and `.run()` arguments, explicit and owner-created bindings, SDK descriptors, injected tools, prompt renderers, output adapters and lazy stream consumption. Shared validators now receive the error constructor for their owning boundary without changing parsing, merge order or callback execution. The subsequent pass checked all remaining `ConfigError` sites, public exports, source/declaration consumers, native SDK wrapping, cross-copy guards and downstream renderer causes. SDK `safeValidateTypes`, tool argument parsing and tool-context execution retain their existing native errors; Casai preserves safe stage summaries and trusted diagnostic causes. The generated security matrix explicitly distinguishes unsupported open tool schemas from invalid arguments instead of accepting one broad error class for both.

Focused counterfactuals detect swapping validation/configuration classes, breaking either cross-copy brand, duplicating message validation and removing private-key, undeclared-input or call-envelope checks. No new error translation around SDK execution, error hierarchy, parser, cancellation mechanism or merge policy was introduced. The review process now calls out shared-validator ownership, lazy configuration failures, sibling-brand rejection and mutation-anchor updates.

Verification: source/build/emitted-consumer/exact-optional type checks pass, as does an emitted-package runtime smoke check. The initial source check took 50.7 seconds (44.6 seconds compiler time, approximately 4.4 GB reported compiler memory); build and both declaration-consumer profiles took 53.3 seconds together. Full typed lint passes in 220.0 seconds. The final source recheck and coverage run pass in 25.3 seconds, with **1,531 mock tests**, **99.26% statements/lines, 96.07% branches and 100% functions**, and the separate augmentation threshold intact. `errors.ts` has 100% coverage in every category. All eight selected runtime mutations are detected in 14.1 seconds. Final inspection of the complete error surface and its consumers found no additional unresolved issue. No paid calls, dependency changes or unrelated editor/type-mutation matrices were needed.

## Final external-review corrections (2026-10-25)

The final external review found no new medium-or-higher defect and reconfirmed the preceding fixes. The user requested correction of every agreed item regardless of phase. This follow-through keeps normal async call and merge contracts intact; it adds three small runtime/API corrections and makes the native limitations explicit.

- **Accurate thenable failure documentation:** an isolated subprocess running actual Script forwarding (`child({ then: then })`) terminates with exit code 1 and the unhandled helper argument error under Node's default rejection policy; the child body never runs. The earlier native control deliberately settled its thenable and did not characterize this failure. README now states both unresolved calls and possible process termination. Moving argument checks outside async functions would change the call contract, so no synchronous-throw conversion or legacy Cascada patch was added.
- **Thenable tool context is unsupported:** a new paired characterization reproduces raw private data on the injected path and resolved private data on the SDK path, while binding selects public defaults before native resolution. A positive control resolves the entry before binding and gets identical defaults and private values on both paths. README covers `toolsContext`, explicit binding and schema-produced context. There is no new parser, runtime rejection policy or attempt to suppress native Promise semantics.
- **Cross-copy error recognition:** `ConfigError.isInstance(unknown)` uses a global brand, following native SDK error guards. Tests catch actual validation failures from an independently loaded Casai component in both directions and reject unrelated/name-only errors. A public type assertion verifies narrowing through source and emitted declarations. Native `instanceof` remains constructor-specific; the documented cross-copy check is the new guard.
- **Incompatible protocol diagnostics:** a callable with `bindToolContext` but no compatible internal protocol now reports an incompatible Casai tool binding. Plain descriptor copies still report the existing spread error. No foreign-component downgrade or new binding path was introduced.
- **Required model at invocation:** shared LLM call validation rejects an undefined/null merged model with `ConfigError` before its function-preparer early return. Regressions cover all four factory families and seven preparation modes, with preparation/provider counters remaining zero. Other undefined replacement settings keep their existing semantics: README explicitly distinguishes clearing `system` from `prompt`'s invocation fallback.
- **Status ownership:** the plan links to this ledger rather than copying test counts and previous-round summaries. The remaining intentionally invalid JavaScript-only parent/signal inputs keep ordinary `TypeError` behavior; types already reject them, and extra shape validation would not protect a model-controlled boundary.

This pass also corrects the previous ledger's overly broad claim about bound injected context: the Casai envelope fix works there, but it does not make thenable tool-context entries equivalent to native SDK execution. The review process now requires failure-mode controls as well as successful thenable controls, and compares raw binding selection with native context resolution.

Verification: the TS7 source/build/emitted/exact-optional gate passes in 64.0 seconds. **1,525 mock tests** pass; the coverage command takes 19.5 seconds and retains **99.26% statements/lines, 96.05% branches and 100% functions**, including the separate augmentation threshold. All three new runtime mutations are detected in 14.0 seconds: removing shared error identity, restoring the misleading protocol diagnostic, and removing invocation model validation each fails its focused regression. No paid calls or upstream changes were made. The existing paired-package evidence remains applicable; no package layout or dependency contract changed.

Changed-file typed lint passes after adding braces to the thenable characterization's void-returning resolver callback; the initial pass took 23.4 seconds and the affected-file recheck 9.4 seconds. No production semantics or lint rules changed for that correction. Final inspection found no additional issue in the changed consumers; the native limitations and deliberately invalid developer-input cases above remain explicit rather than claimed fixed.

## Forwarded values and duplicate-module follow-up (2026-10-25)

Independent checks of the latest external review confirmed two runtime defects. Both Casai-owned defects are now corrected in the implementation follow-through below; the findings describe their pre-fix behavior. The earlier assembly envelope fixed its own boundary, but did not establish safe forwarding through the rest of preparation. The review itself used bounded stdin-only probes and inspected the installed native validators; production changes and integration checks followed the user's request to fix the findings.

### 1. Medium: callable `then` is still assimilated during input preparation

An owner with an injected `then` helper forwards `{ then: context.then }` to an ordinary Function child. Both no-schema and `z.looseObject({})` children remain pending, never enter their bodies, and produce an unhandled rejection from the helper receiving Promise resolution's two arguments. The previous fix covered assembly only. `prepare.parse` returns application data bare from an async function; schema-backed parsing also returns it bare through `parseSchema` and native `validateTypes`. `incoming()` has another bare-data async return to include in the correction.

The external review's statement that ordinary calls run no native SDK code is inaccurate: schema-backed calls use native `validateTypes`. A paired control demonstrates that native `safeValidateTypes` retains the value inside a success envelope without invoking `then`, whereas `validateTypes` assimilates it. Casai can use the existing safe utility and retain an internal envelope across its own preparation boundaries, preserving native validation errors and parsed values. Merely switching utilities and returning `result.value` from another async function would reproduce the defect. Keep native descriptor executors as parsed-input entry points; do not introduce a name blacklist or reinterpret ordinary JavaScript result thenables.

Required regression coverage must forward the same generated helper into a second component, across no-schema/open-schema input, ordinary/run, SDK/injected and renderer paths. Measure first-statement body entry, helper calls, completion and unhandled rejection separately. Include trusted-context preparation rather than stopping at application parsing. Explicit `JSON.stringify(context)` invoking a `toJSON` helper is JavaScript's serialization protocol; no Casai-owned serialization defect was established here, and an input envelope would not change that behavior.

### 2. Medium-low: local symbols break interoperability between Casai instances

Loading source and emitted Casai modules together reproduces both reported failures: a genuine foreign component is rejected as a spread descriptor, and a foreign `textStreamSchema()` is not recognized when collecting tool output. `bindComponent` and `streamKind` use module-local symbols; loader identity already uses the global symbol registry.

Do not resolve component detection by silently treating the foreign component as a native tool. A control with configured `factor: 3` and owner tool context `{ factor: 5 }` loses automatic binding under that fallback and rejects with `Incoming public defaults require bindToolContext()`. Passing the originating component's explicit bound tool/context pair works and returns `5`. The correction should preserve binding through a compatible shared internal identity/protocol, along with stream-kind recognition. Verify both runtime behavior and emitted-type interoperability; this review proves the runtime failure, not a complete cross-version compatibility policy. Keep the existing rejection of descriptor spreads.

### Smaller findings and qualifications

- `.run({ prompt: undefined })` clears configured literal/rendered LLM prompts, while Template's undefined source override falls back. Reproduced. The Phase 3 invocation contract explicitly keeps the configured prompt for undefined overrides; current general configuration merging deliberately permits undefined replacement. Resolve this as a narrow invocation rule, preserving configuration/context merge semantics, rather than changing shared merging incidentally.
- Stripping descriptor names from ordinary LLM requests has no collision with a current SDK option. This is a future-compatibility consideration, not a demonstrated current defect. `description` is also ordinary Casai configuration, so stripping only on tool forms is not sufficient by itself.
- Native runtime message validation accepts undotted custom-part kinds, while Casai rejects them. Native TypeScript defines the kind as `${string}.${string}`, so Casai agrees with the SDK type. Native validation reuse is worth considering in validation-only paths, but replacing the exported/preparer schema wholesale would also strip extra fields; preserve existing passthrough and parsed-consumer contracts.
- README2's pending Function-integration wording and the plan's current status/count were stale and are corrected in this follow-up. Historical dated results remain unchanged. The empty `src/core` directory has no tracked content.

Why these escaped: the previous correction tested a generated context reaching its immediate body, not that same value crossing a second component's asynchronous parsing boundaries. Existing duplicate-installation controls covered schema protocols, not Casai component binding and stream markers. The review process now requires those compositions and checks that a proposed native fallback preserves Casai's extra binding guarantees. The focused corroboration was not another complete surface review; the implementation follow-through below closes the Casai defects.

### Corrections and verification

`parseSchema` now uses native `safeValidateTypes` and retains its result envelope. Preparation returns parsed application input inside an envelope and exposes its existing prepared facts rather than asynchronously unwrapping incoming context. All consumers were updated: ordinary calls, bound/injected execution, SDK argument validation, output validation, prompt preparers and stream elements. Only preparation keeps data wrapped; normal component results retain native Promise semantics. SDK application errors retain native details, while trusted-context errors retain their stage-only message and diagnostic cause. No new parser, copying policy, reserved name or validation bypass was added.

Component binding uses a versioned global symbol so compatible module copies retain automatic context binding. Stream schemas use a structural marker shared by runtime and emitted declarations; a global symbol alone would retain a module-specific unique-symbol type. Runtime tests load an independent source copy, and the clean-package harness loads two physical packages. Both directions preserve configured/bound defaults, private rejection, descriptor-spread rejection, generation/streaming tool execution, and text/element collection. Emitted consumers also check raw/parsed stream results, private binding types and retained callbacks whose helpers may omit bound defaults.

LLM invocation normalization removes an undefined `prompt` override before merging; explicit sources, including empty strings, retain their established behavior. All four LLM factories and seven preparation modes have regressions. Configuration inheritance and context merging are unchanged.

The native message-validator experiment was reverted: an existing regression explicitly requires provider-qualified custom kinds in schemas, configured messages and prompts, agreeing with native TypeScript. Switching only validation-only consumers to the looser native runtime schema would split that contract; replacing every schema would additionally change passthrough behavior. The descriptor filter is also unchanged: there is no current SDK collision, and ordinary Casai configuration includes `description`. Neither speculative change improved the implementation enough to justify changing its contract.

An additional native control establishes an upstream boundary: the linked Cascada engine resolves callable `then` argument objects before the child receives them, including nested objects in a separate probe. A direct `AsyncEnvironment` reproduction uses no Casai component. The new renderer regression forwards the helper function and constructs the object in host code, thereby testing Casai preparation independently. Native SDK trusted-context validation likewise unwraps its value. Preserve these native limitations and reassess them at the newer compiler/runtime handoff; no legacy engine patch or Casai workaround was added. Ordinary host calls and Casai-owned input/context preparation retain their data. This does not establish SDK/injected equivalence for thenable trusted context; the final external-review follow-through above records that unsupported case.

Verification: the full TS7 source/build/emitted/exact-optional gate passes (final incremental run: 10.0 seconds). **1,493 mock tests** pass in 21.5 seconds for the coverage command, with **99.25% statements/lines, 96% branches and 100% functions**, including the separate augmentation threshold. All seven targeted runtime mutations are detected in 13.5 seconds, covering the three envelope boundaries, component and stream identity, undefined prompt fallback and native SDK application diagnostics. The clean paired-package check, extended with a second physical Casai copy and independent declarations, passes in 25.6 seconds. No paid calls, upstream edits, link changes or version bumps occurred. Follow-up consumer inspection and the complete mock gate found no further important issue in these corrections; this is not a new independent whole-phase security review.

Changed-file typed lint also passes in 14.9 seconds. The first attempt found an intentionally invalid spread in the rejection test, now annotated at that expression; the other fixture finding disappeared with the reverted message-validator experiment. All lint rules remain enabled for production code.

The empty `src/core` cleanup was rejected by automatic approval review as `blocked by policy`; it remains and has no Git entry to unstage. All generated probe/package/mutation directories were cleaned by their harnesses.

## Async preparation and native option audit (2026-10-25)

This review found one medium runtime defect and one low-priority obsolete API setting after the preceding completion pass. Both are now corrected; the findings below describe the pre-fix behavior, and the implementation follow-through records verification. The review started from the current public surface and execution owners, then split into independent type/configuration, schema/security and lifecycle/native-consumer passes. Compiler probes were sequential and bounded; no full compiler, lint, coverage or paid-provider gate was repeated during the review itself.

### 1. Medium: an injected tool named `then` prevents execution

Owner: `src/execution.ts:169-184`, consumed by ordinary preparation at line 199 and SDK tool execution at line 219.

```ts
const lookup = tool({ inputSchema: z.object({}), execute: () => 1 });
const owner = create.Function({
  tools: { then: lookup },
  execute: () => 42,
});
await owner();
```

The public API accepts this configuration. Assembly adds the helper as the context's own `then` property and returns that context from an async function. JavaScript consequently invokes the helper as `then(resolve, reject)`. The injected helper rejects its two arguments, producing an unhandled rejection; the preparation promise remains pending and the component body never runs. The owner need not invoke the helper itself. A `lookup`-named registry control completes without calling its helper, and a native `ToolLoopAgent` successfully invokes a tool named `then`.

This is Casai's generated context crossing an additional asynchronous boundary, rather than a caller supplying a thenable. Native SDK handling of caller-supplied callable `then` values is a separate accepted native limitation. Independent reproductions cover Function shorthand and `.run()`, Script, Template, rendered LLM preparation and raw Casai descriptor execution. Literal LLM dispatch without context assembly succeeds.

Recommended correction: return `{ context: execution }` from `assemble` and destructure it at its two consumers. An independent in-memory experiment changed only those three expressions in the actual module: preparation completed, the helper remained callable and returned the expected value, and ordinary execution metadata stayed unchanged. No name blacklist, new public option or generic copying mechanism is needed. Add regression controls that detect both unfinished preparation and unhandled rejections, with a body-entry counter independent of callback assertions.

### 2. Low: Object factories advertise an ignored `mode` option

Owners: the seven Object configuration shapes in `src/types/config.ts:244-339`, `ValidateObjectMode` in `src/types/config-validation.ts:279`, and inherited shapes in `src/factories/ObjectGenerator.ts:38` / `ObjectStreamer.ts:34`.

Both factories accept `mode: 'auto' | 'json' | 'tool'` (with a narrower no-schema form), but installed SDK 7 `generateObject` and `streamObject` have no such option. Their implementations unconditionally select JSON response format at `ai/src/generate-object/generate-object.ts:410` and `stream-object.ts:614`. Four mock captures confirmed identical JSON model requests for `mode: 'tool'` and `mode: 'json'` in generation and streaming, without tools or a tool choice. Native compiler controls reject the setting; Casai accepts it.

Remove the obsolete setting and its dedicated type validation instead of extending its conditional-configuration checks. It provides no execution capability and adds a misleading choice and unnecessary type machinery. This is a low-priority simplification in the retiring factories, not a private-data defect; removal is a public type-surface change to resolve when applying the review.

### Verification, exclusions and subsequent pass

- TS7 probes pass through source (10.1 seconds), emitted declarations (0.34 seconds) and emitted exact-optional declarations (0.28 seconds). They include uncast acceptance of the `then` registry, native versus Casai `mode` controls and valid neighbors. Temporary probe directories were removed.
- Lifecycle/native-consumer review passed 424 focused mock tests and a new deterministic matrix of 192 valid text-block interleavings. Each generated case compared Casai's final value with independently assembled text and native SDK output after one execution.
- Schema/security review passed 83 focused tests and a new matrix of 64 private-collision rejections plus 32 valid controls. Cases cross lazy/readonly/optional schemas, declared-absent versus own-undefined private names, prototype-shaped names, transformed output collisions and ordinary/bound SDK paths. Body entry is measured before assertions. No new private-data bypass was confirmed.
- An apparent undeclared-stream union typing defect was dropped: the [stream policy](plan.md#stream-schemas-and-collection) intentionally reserves union-valued and erased outputs for runtime rejection. The stream branch rejects without consumption. Native Zod inherited `constructor` behavior was likewise separated from Casai enforcement.
- The subsequent consumer pass covered configuration inheritance, loaders, callable forms, helper injection, descriptors, renderer/preparer paths, SDK callbacks and results, stream ownership, and exported types. It found no further confirmed actionable issue beyond the two findings above. These findings were open when the review finished; the implementation follow-through below closes them. The newer Cascada compiler handoff and joint-release checks remain separately tracked obligations.

Why these escaped earlier passes: prototype-shaped-name tests did not cross generated function properties with JavaScript Promise resolution; Object mode tests checked Casai's own declared contract without verifying that the current native SDK still consumes the setting. The review process now explicitly covers both omissions.

### Implementation follow-through (2026-10-25)

The user requested both corrections. `assemble` now returns an internal `{ context }` envelope, and its two consumers destructure it. The execution context and helper identities are unchanged; no helper name is forbidden. Regressions cover an unused helper, explicit helper invocation through ordinary/run/descriptor calls, Script/Template and function-prepared LLM execution, with a native SDK control. Entry and helper-call counts establish that preparation itself does not invoke the helper.

Removed the seven `mode` properties, the dedicated `ValidateObjectMode` type, and mode entries from inherited run-setting shapes. A single configuration check rejects the obsolete top-level setting before dispatch, including reusable fragments, inheritance and run settings. Application data is unaffected. Updated type assertions retain schema metadata and result inference across inherited output choices while rejecting the removed property, including a conditional parent. README documents the removal.

Verification: 192 focused tests pass; both targeted runtime mutations are detected in 18.2 seconds. TS7 source, build, emitted-consumer and exact-optional profiles pass in 52.7 seconds; changed-file typed lint passes in 93.5 seconds. The first compiler attempt found two runtime-negative fixture casts that needed to cover both factory arguments; those were corrected without changing production types. The mutation harness now accepts an optional name filter while preserving its default complete matrix, so unrelated mutations need not be repeated for a local correction. Full mock coverage passes **1,460 tests** in **20.8 seconds**, retaining **99.25% statements/lines, 95.97% branches and 100% functions** and the separate augmentation threshold. No paid calls ran. Follow-up source/consumer inspection found no further issue introduced by these fixes.

## Casai completion follow-through and upstream boundary (2026-10-25)

The user kept the new compiler/runtime cutover with Cascada. This pass closes actionable Casai findings and prepares a reproducible handoff; it does not claim that Casai has run on the new kernel. No upstream files, package links or release versions changed.

### Findings and corrections

Three type checks lost keys present in only one configuration alternative: tool selections (`toolChoice`, `activeTools`, `toolOrder`), tool approval/refinement map names, and new tool names in `.run()` replacement registries. Definite invalid settings were rejected while equivalent conditional values compiled. The shared guards now check each complete configuration with its own registry and collect errors before converting success to `unknown`. Run checks use the merged configuration, and replacement-name admission uses all supplied union keys. No execution or private-boundary policy changes.

A valid neighboring case also exposed template-parent inference that independently inferred only one alternative's tool map. The contextual helper now derives selections from the already-inferred parent configuration; TextGenerator/TextStreamer remove that redundant generic. Literal, template and function preparer controls retain correlated alternatives and inline selection inference. The regression fixture is `tests/type-safety/configuration-alternative-guards.ts`; the type mutation harness includes counterfactuals for all three guards.

### Integration and independent review

- `tests/CascadaIntegration.unit.test.ts` adds 16 actual current-engine cases: Script/Template, configured/injected components, asynchronous shared-state sequencing with `!`, pure unmarked concurrency, sequential render reuse, and SDK generation/streaming forwarding into ordinary/open or registered/closed child inputs.
- Negative forwarding cases count entry before any body assertion. Independent in-memory removal of the private guard makes all four configured forwarding cases fail; removal of `!` makes all four sequencing cases fail. This corrected a test weakness where an assertion inside an unsafely entered body could mimic boundary rejection.
- The independent runtime pass traced every factory family/modifier, configuration/source/preparation path, bound/bare/injected execution, schema/result/stream consumer and native SDK lifecycle. Its 210 focused tests and independent 16-case renderer run pass; no additional production runtime/security defect was found. The subsequent type/config consumer pass found no further confirmed issue in the corrected selectors, callbacks, parent inference or run checks.
- A bounded speculative Config-fragment approval-return probe did not complete; it is not reported as a defect or as passing evidence. Finished factories already check final callback branches. This review does not claim exhaustive proof of arbitrary TypeScript inputs.
- The package harness supports `npm run test:package -- --engine C:\Projects\cascada` (built directory or tarball), preserving the default published-dependency mode. It installs outside the workspace, verifies tarball resolution and SDK utility deduplication, checks emitted consumer types, and executes Function, Script/Template with injected tools, and explicit stream sharing. No publication or version bump is involved.

### Settled verification

- Full mock coverage: **1,455 tests**, 53.6 seconds for the command; **99.25% statements/lines, 95.97% branches and 100% functions**, including the separate augmentation threshold. No paid provider calls.
- TS7 source, build, emitted-consumer and exact-optional profiles pass. The exact-optional completion was reconfirmed incrementally in 2.7 seconds after the earlier command session ended. Changed-file lint passes; its two fixture-only style findings were corrected and the fixture recheck passed in 35.8 seconds.
- All three new type-guard mutations are detected (28.8 seconds for the targeted harness). The representative caller workload has 451,922 production instantiations versus 419,566 at baseline, within the 2x budget; the registry contract adds 6,263 instantiations to 559,324. These are bounded workload measurements, not whole-project compile timings.
- The expanded clean paired-package check passes in **51.7 seconds**, with both local tarballs installed outside the workspace and an explicit consumer compiler. It resolves `ai@7.0.153`, `zod@4.6.7` and one deduplicated `@ai-sdk/provider-utils@5.0.68`. Emitted types, parsed Function defaults, Script/Template injected calls and explicit stream sharing pass. The engine is the current built development candidate, not the future kernel-integrated release.
- The earlier 44-runtime-mutation gate remains applicable: the final corrections only change types and tests. This pass additionally ran eight renderer counterfactual cases against the actual guard and `!` sequencing. The independent follow-up found no further confirmed actionable issue. Casai-side prerequisites for Phase 3 development are complete; the external acceptance work below remains explicit.

### External obligations

The linked engine is `C:/Projects/cascada` at `2c7161fe`. The separate kernel at `C:/Projects/cascada-chain-resolution` (`a343e41`) exports `Execution`, `ContextChain` and `externalState`, but no engine compiler/renderer API. Its `docs/runtime-evolution-plan.md` Phase 8 tracks the cross-repository cutover. Future acceptance must verify generated code uses that kernel, including sequencing standalone Function endpoints and closure-held state; kernel-only tests or a current-engine link cannot establish it. Reuse the real renderer/forwarding suite and complete the [handoff checklist](plan.md#phase-2-existing-component-foundations) then. Final release candidates still need the compatible engine dependency minimum and a clean paired-package check.

Cleanup of the verified `.review-pending/` tree was rejected by automatic approval review as "blocked by policy." It contains disposable earlier probes/logs and remains unstaged for manual deletion.

## Configuration and SDK boundary follow-up (2026-10-25)

This follow-up implements the actionable findings from the external review and distinguishes contract choices from defects. It is not a new whole-phase signoff; the Cascada handoff and coordinated-release package checks remain separate gates.

| Finding | Resolution |
| --- | --- |
| Mutable `.config` versus snapshots | Configuration settings stay fixed by authoring contract, without freezing/proxies. Deliberately mutable referenced context state and closures are supported; `!` orders effectful Cascada calls. The user confirmed that shared state objects or closures are sufficient. Existing bindings retain their selected top-level values; top-level context replacements do not update existing SDK descriptors. The question is closed without runtime changes. [Current state contract](plan.md#context-sources-and-preparation). |
| Per-run binding | Retained: it lets workflow-supplied public defaults participate in SDK validation before approval/execution while explicit arguments win. Private-only context would simplify it by removing an agreed feature; no such API change was made. |
| Repeated message validation | Ordinary/named calls normalize once, merge once and validate invocation messages once before native SDK validation. A getter-count regression compares with native `generateText`. |
| Recomputed preparation facts | No new cache. Mutable context-derived data must stay invocation/binding-local. Schema-only discovery caching remains a possible measured optimization; repeated reads alone do not justify more lifetime/invalidation machinery. |
| Casai configuration in SDK requests | Strip known component settings and outer descriptor metadata at dispatch. Preserve native model settings, including `providerOptions`, and unknown future SDK options. A capturing native-executor boundary test checks both sides. |
| Injected execution options | Preserve native options (including sandbox/signal), replace child call ID/messages, and select the child's own trusted context. Documentation and identity assertions now match. |
| Pre-aborted preparation | Check before Casai application/context preparation and retain the later execution/dispatch checks. Tests pair valid/invalid input with zero parser/preparer/body/provider calls and exact abort identity. SDK-owned validation before executors stays native. |
| Cascada release version | Still a coordinated-release gate, not a reason to bump unfinished packages now. |
| Keyword marker / diagnostic noise | Only native `__hasKeywordArgs === true` denotes keywords. Expected SDK error logs are captured and asserted locally; no global suppression or production error scrubbing. |
| Larger cleanup | Keep native descriptor `type: 'function'`, existing family-specific run forms and retiring factory types. Avoid factoring small source/engine checks into a new abstraction. Historical plan/evidence consolidation is documentation maintenance, not another runtime mechanism. `.review-pending/` remains untracked for deletion. |

The focused checks cover shorthand/named calls, SDK executors, bound and injected tools, all four LLM factories, cancellation, message history, sandbox/context forwarding, native approval replay logging and state-reference behavior. Verification: the full mock coverage gate passed 1,435 tests in 40.2 seconds (99.25% statements/lines, 95.97% branches, 100% functions). The subsequent four literal-prompt cancellation cases pass in the 108-test LLM call suite. All 44 runtime mutations are detected. The early LLM cancellation mutation initially survived because the shared preparation guard covered rendered calls; the added literal-prompt/history cases test its distinct responsibility. Source, build, emitted-consumer and exact-optional compiler profiles passed in 613.6 seconds. No editor/type-mutation matrix was repeated for these runtime changes, and no paid tests ran.

Changed-file lint passes: the initial run identified an unused import and unnecessary non-null assertion, both removed; the final affected-file recheck took 71.6 seconds. All intended changes are staged. The mutation harness cleaned its own isolated copies; the pre-existing `.review-pending/` files remain untracked for user deletion.

## Tool-context alternatives and empty-input review (2026-10-24)

**Two medium-priority type defects were confirmed and corrected.** No new runtime private-data bypass was reproduced. The reproductions below describe the pre-fix behavior; the follow-up verification records the corrections. The newer-Cascada integration and coordinated-release package gates remain separate.

The review used independent schema/security, execution/output and public-type passes, plus a root audit of configuration, coded calls, engines, loaders and downstream consumers. Each pass compared its owner with native behavior and revisited consumers after its initial findings. The focus was combinations absent from earlier examples: selecting a trusted-context parser, and combining an empty public input with a private dependency available only on SDK calls.

### 1. Medium: selected tool-context schemas weaken binding and registry admission

Owners: `src/types/application.ts:118` (`RawContext`), `:129` (`InvalidContext`), `:138` (`ToolContexts`) and `:283` (`BindToolContext`).

```ts
declare const enabled: boolean;
const operation = create.Function.asTool({
  inputSchema: z.object({}),
  toolContextSchema: enabled ? z.object({ factor: z.number() }) : undefined,
  execute: () => 1,
});

operation.bindToolContext({});                  // Incorrectly accepted.
operation.bindToolContext({ factor: 'wrong' }); // Incorrectly accepted.
create.Function({
  tools: { operation },
  execute: ({ operation }) => operation({}),
}); // Incorrectly accepts missing toolsContext when the parser is present.
```

The entire schema union is tested against `Schema`. Including `undefined` falls back to `object | undefined`, losing required fields and their types. Selecting between two object schemas instead produces a union of accepted contexts: factor-only context is accepted for `factorSchema | tenantSchema`, even when the actual selection requires `tenant`. This confuses a choice of parsers with one intrinsic `z.union(...)` parser.

Confirmed consumers include direct binding, injected-owner construction, coded-owner `.run({ toolsContext })`, TextGenerator construction and its `.run()`. Runtime rejects the invalid contexts before the tool body; generated owners reject before provider dispatch. Definite-schema controls correctly reject the same mistakes statically. A context containing both required fields works with either stripping parser, and an actual union schema correctly accepts either alternative. Native inferred `tool(...)` rejects the selected-schema construction; an explicit native union context annotation admits it, reflecting that broader annotation rather than Casai's retained schema contract.

The shared raw-context contract now intersects the accepted inputs of each selected parser, retaining whole-configuration correlations. A genuine union schema remains one parser. Permissive raw types contribute no constraint rather than erasing a stricter selected parser. This needs no additional runtime guard, input schema or public mode. Regressions cross conditional presence, selected schemas, raw-to-parsed context transforms, missing/undefined entries, finished versus reusable configurations, binding, registries and run overrides.

### 2. Medium: an empty public shape hides an absent ordinary-call dependency

Owners: `src/types/application.ts:144` (`Execution`), `:242` (`BoundExecutionContext`) and `:244` (`ToolExecutionContext`), consumed by `src/types/function-config.ts:85` (`ToolExecuteContext`).

```ts
const operation = create.Function.asTool({
  inputSchema: z.object({}),
  toolContextSchema: z.object({ factor: z.number() }),
  execute: ({ factor }) => factor.toFixed(),
});

await operation();     // Compiles, then throws: factor is undefined.
await operation.run(); // Same failure.
```

The callback infers `factor` as exactly `number`. Ordinary calls do not receive or validate incoming tool context, so they assemble no such field. Zod's empty-object output contributes `Record<string, never>`; combining the ordinary and bound contexts produces `never | number`, erasing the ordinary path's absence. This violates the existing requirement that the shared implementation be valid on ordinary calls too.

Supplying `context: { factor: 1 }` fixes the example. With a nonempty public shape, the compiler correctly rejects unguarded access to the tool-only dependency. Native empty-object parsing alone gives `never` and rejects `.toFixed()`; native tools also do not expose Casai's extra context-free ordinary caller. The defect belongs to Casai's composition of those execution alternatives, not native tool-context validation.

The ordinary execution alternative now preserves absence for known tool-context names whose ordinary value is `never`. Truly absent keys retain native property-access errors and `in` narrowing; genuine non-never index signatures and configured/public values remain unchanged. Regressions cover empty/nonempty inputs, configured and unconfigured dependencies, definite/conditional context schemas, inherited callbacks, ordinary calls and `.run()`, and tool function preparers, with successful SDK-context execution as a neighbor.

### Correction follow-through

The valid inherited-registry neighbor exposed one related inference omission: registry validation ran before an inline callback's child configuration had been inferred. `ValidateToolsContext` now uses the existing `ValidateResolved` helper, as the surrounding configuration validators already do. Final inherited requirements remain enforced. Both definite and conditional context-schema cases, successful callback inference, and rejection of missing final context are checked.

Five targeted type mutations are detected: collapsing parser selection, dropping registry requirements, allowing a permissive raw type to erase requirements, dropping ordinary-path absence, and reverting deferred inherited validation. Representative ordinary workload instantiations are 456,777 versus the pre-integration 419,566 (1.09x); registry workloads with/without helper contracts are 568,791/562,528 (1.01x), within both 2x budgets. No runtime implementation changed.

The complete `npm run test:types` gate passes: source consumers, build, emitted consumers and exact-optional API consumers. The original failures and valid inherited/configured neighbors also pass a focused non-exact emitted-declaration check (0.41s). Full mock coverage passes **1,426 tests**, with **99.25% statement/line coverage, 95.70% branches and 100% functions**, including the augmentation gate. All changed TypeScript files pass lint with the existing rules; the final test-only assertion adjustment also passes focused source and exact-optional declaration checks. Existing nonempty `in`-guard callbacks continue to compile; an empty child still produces the intended missing-registry-context diagnostic. The subsequent independent consumer pass found no additional actionable defect.

### Evidence and follow-through

| Surface | Evidence and outcome |
| --- | --- |
| Public callers, binding and registry types | Both defects compile in an uncast emitted-declaration consumer, including positive and negative controls; both optional-property modes pass (0.38s / 0.45s). A focused direct-source Function consumer also passes (0.49s). These are successful counterexample reproductions, not correct-contract tests. |
| Binding, injected and model consumers | Assertions verify invalid context rejection before execution/provider dispatch, valid complete-context and intrinsic-union neighbors, and both ordinary-call crashes for finding 2. Every runtime assertion reaches the final completion marker. |
| Input preparation and security | Traced raw tool-key rejection, configured defaults, output-name reservations, parsed/final collision guards, bound/bare/native/injected paths and execution metadata. Root-default, codec and metadata-composition probes found no additional defect. |
| LLM execution, results and streams | All four factory runtime tails, prepared dispatch, history/finality/cancellation, renderers and stream ownership reviewed against native SDK owners. Six new native-controlled probes and 96 focused existing checks pass. |
| Configuration, engines and loaders | Inspected parent/child map ownership, source overrides, named-resource delegation and race-loader lifecycle. Native weak subscriptions rule out the suspected retained-listener leak. No additional actionable finding confirmed. |
| Existing gates | `npm run test:types` passes with warm caches in 3.89s. Full mock coverage passes 1,424 tests in 24.2s: 99.25% statements/lines, 95.70% branches, 100% functions, including the augmentation gate. These green baselines demonstrate the missing test dimensions. |

Nonfindings were retained explicitly. Whole-root input defaults do not fill fields in normalized `{}` input; omission is rejected statically, matching native validation of `{}`. The web-stream adapter's ownership of producer failures matches the native SDK bridge; schema failures and early consumer closure do close the source. Configured prompt-array sharing follows the current documented shallow configuration policy. Known continuation, transformed-history, erased native typing and cross-execution side-effect limits remain accepted limitations.

The initial subsequent consumer passes found no further important issue but left the two defects above unresolved. The correction pass traced binding, registry construction and overrides, injected helpers, Function/Config callbacks, inheritance and tool function preparers again. Native descriptor callbacks retain parsed SDK context types. No paid model calls were needed. The local Cascada link still resolves to `C:/Projects/cascada`; newer-renderer and packed-release acceptance were not re-established by these probes.

Earlier reviews exercised selected **application** schemas and usually gave callback examples a configured dependency or a nonempty public shape. They did not cross selected **tool-context** schemas with every binding consumer, or empty-object index signatures with alternate execution paths. The review process now explicitly requires both dimensions. One stale test-command sentence in `AGENTS.md` was also removed: `npm test` is the mock-only source runtime command, not the type-plus-paid suite.

Temporary reproductions and logs are under `.review-pending/review-2026-10-24-*`; they remain outside the staged change set. The examples and evidence above are retained independently of those disposable files.

## Closed tool-input contract revision (2026-10-23)

The user approved closed top-level public input for Casai-created tools and rejection of undeclared raw arguments before parsing/preprocessing. Dynamic data belongs inside declared parameters. Ordinary non-tool components and native SDK tools retain their contracts; trusted context need not be closed. See the [decision record](plan.md#remaining-phase-2-decisions).

The shared preparation path now enforces this policy on tool-component ordinary/named calls, bare/bound SDK validation and injected calls. Every Casai descriptor uses the existing preparation wrapper; the no-dependency schema-identity shortcut was removed. `.config.inputSchema` and native `contextSchema` retain their original schemas. Known open Zod Classic/Mini roots and root record/catchall contracts are rejected by factory types and runtime declaration discovery. Root records with enum keys also use catchall metadata; use an explicitly named object shape at the root. SDK/Standard schemas use runtime metadata admission; original Standard input metadata is inspected before the SDK's provider-oriented normalization. Unknown raw keys fail before application callbacks, while post-parse and final-context private guards remain necessary for transforms, native refinement and forwarding. No public mode, additional schema or state was added.

Verification: all **1,424 mock tests** pass with **99.25% statement/line coverage, 95.70% branches and 100% functions**. All **37 runtime mutations** are detected, including the new raw-key, Zod/metadata admission and Standard-normalization mutations. The final 42 focused schema/lifecycle checks, including inheritance, deep wrappers and history revalidation, pass. The added runtime fixture also passes its normal compiler profile; the public type fixture passes the exact-optional declaration profile. Full source type checking, source/emitted public-type checks, build and exact-optional-property checks pass. A final rebuild and focused source/declaration check also pass after the root-record admission correction. Changed production, runtime-test and type-test files pass lint after local formatting/unused-expression corrections. The full lint run was stopped under memory pressure and is not counted as a pass. All **24 targeted type mutations** are detected. Ordinary workload instantiations are 468,871 versus the pre-integration 419,566 (1.12x); registry workloads with/without the existing helper contract are 594,166/587,903 (1.01x), both within the 2x limits. Editor completion and diagnostics pass against source and declarations in both optional-property modes.

The consumer pass covers Function, Script, Template and rendered Text/Object generators; non-rendered LLM calls accept prompt/history rather than application context and retain their existing forms. Native `.execute` remains the parsed-input entry point. The raw-key rule also applies to SDK history revalidation: transformed root names outside the raw declaration set are rejected, including a characterized case where native stripping could discard them and apply defaults. This follows the approved rejection rule; no history bypass or parallel replay mechanism is added. The test migration keeps ordinary open-input cases, native open-helper replacement checks, nested forwarding attacks and transform-created private collisions. It replaces the obsolete Casai-open-helper private-reservation mutation with closed-tool admission: undeclared extras are no longer valid calls to such a tool. Broad/unknown SDK or preprocessor input types still rely on runtime name enforcement. A native TS7 declaration probe also shows that a conditional empty closed/open Zod object can collapse to the closed type before Casai sees it; runtime admission remains authoritative for that erased policy. Concrete preserved schema alternatives are checked individually; concrete closed input types retain excess-key diagnostics. This is a bounded input protection contract, not a sandbox for trusted transforms or automatic redaction of tool outputs.

The separate newer-Cascada handoff and coordinated-release package checks remain unchanged. Historical results below describe their corresponding earlier implementation, not this revision.

## Development follow-through and invocation alternatives (2026-10-22)

Phase 2 is a development milestone, not a release. The shared Casai corrections below precede dependent Phase 3 work. The newer Cascada compiler/renderer handoff still needs actual Casai integration and an independent review when available; the current link to `C:/Projects/cascada` and kernel-only checks do not establish that result. Clean installation of both packed release candidates belongs before the coordinated release.

The user accepted narrowing variables holding different components in exchange for complete checking of union-valued input. Function, renderers and injected helpers now share one caller type, with overloads for the existing positional forms. Supplied-key inference preserves contextual callbacks and configured omissions; mapped/intersection arguments retain their actual type when no key slot is inferred. Explicit private names remain protected beside broad index signatures. Optional positional tuples explicitly include `undefined`, preserving established calls under exact-optional checking. Coded `.run()` reuses the existing settings validator. This changes no runtime merge, parsing or private-binding policy, and adds no configuration-spread feature.

The consumer pass also corrected branch-only `.run()` context validation: a union containing an absent-context branch could hide private or invalid values in another branch. Every alternative now contributes its checks. Paired runtime cases verify accepted extras/defaults, rejection before provider dispatch, and valid versus malicious forwarding through ordinary child calls in native generation and streaming.

The final configuration-alternative pass found a separate omitted-call defect in renderer tuple construction. Distributing whole configurations before deciding required input allowed one configured branch to contribute a zero-argument overload even when another branch still required input. Coded and model renderer tuples now retain the whole configuration for that decision. Compiler cases cover all seven component families, explicit-source and named calls, and genuinely alternative configurations that both satisfy omission. Paired runtime cases verify the native missing-input failure before model dispatch. This is a static correction; runtime parsing already rejected the invalid branch.

The full consumer checks also found that LLM `.run()` replacement descriptors used the producer-facing raw context map. SDK executors and hooks instead consume parsed context. `TextRunConfig` now imports the SDK's `InferToolContext` directly and drops the redundant mapper. Tests cover tools without a context schema, wider raw context producing the same parsed type, incompatible parsed context, literal model registries and coded preparers. Generation and streaming runtime cases retain raw binding input and execute with the parsed number. The counterfactual restores the old mapper and rejects valid replacements; an identical replacement schema/configuration would take the original-descriptor fallback and miss this defect.

Helper substitution now recognizes schema-provided omissions as well as configured defaults. Optional fields still require any configured value to be valid, and a field required by one input-union branch is not universally omittable. Replacements retain accepted explicit values, including `undefined`. Keeping raw discriminants at the root of the existing type-only contract also preserves compatible object-to-union replacements; ordinary native function assignability accepts the same comparison. No runtime symbol, state or schema was added. Raw-input, branch-key, constrained-extra, default and private-reservation mutations still detect unsafe substitutions.

Final verification passes on the corrected candidate: **`npm run check`**, all four TS7 source/declaration editor modes and the complete **57-mutation type gate**. The check includes the full source/declaration and exact-optional type pipeline, lint and **1,410 mock tests**, with **99.25% statements/lines, 95.63% branches and 100% functions** covered, including the separate augmentation gate. The runtime gate detected all **33 mutations**; subsequent corrections change types and erase to unchanged execution logic. The implementation-wrapper cleanup rebuilt with identical runtime output and all 36 declaration files unchanged; the later omission correction changes only the two renderer call-signature declarations. Earlier failed or interrupted checks are not counted as passes. No paid model calls ran.

The final ordinary-call workload uses **468,547 / 419,566 instantiations (1.12x)**. The separate registry workload uses **592,585 with the helper contract versus 586,322 without it (1.01x)**. Both remain within the 2x budget. An earlier isolated four-LLM comparison measured 3,097,269 source instantiations versus 3,102,474 before the caller correction, and 52,037 in its declaration consumer. Removing redundant internal factory return casts reduced that source workload to 2,937,216; those casts and unused private creator generics were removed. Explicit `unknown` test-cast boundaries offered no improvement and were discarded. These are bounded workloads, not universal latency guarantees.

The editor harness now closes its owned input transport, waits for child output to close, and defaults to failure until every mode finishes. Native probes verify normal cleanup and a forced assertion failure. This prevents an unresolved shutdown RPC from letting an idle Node process falsely exit successfully. Interrupted and failed runs are excluded from passing evidence; memory-heavy checks run sequentially.

The follow-through covers exports, all factory families/modifiers, configuration and schema ownership, ordinary/named/tool/injected/prepared paths, renderers and output/stream consumers. The final consumer pass after the requiredness correction found no further important issue in this Casai scope. No additional runtime defect was confirmed. Shared Casai correctness work and local verification are complete, so independent Phase 3 development may proceed. Whole-phase signoff still requires the newer renderer integration and its subsequent independent review; packed-consumer verification remains a coordinated release gate.

Intended changes are staged. Temporary probes, discarded experiments and ignored review logs remain unstaged for the user's manual deletion; their inventory is `.review-pending/DELETE-LIST.txt`.

## Compiler target and helper-contract follow-through (2026-10-22)

This subsection records the earlier checkpoint. Its outstanding caller work is addressed by the development follow-through above.

The supported consumer compiler is now TS7, with 7.0.2 as the tested minimum. Source, emitted declarations, optional-property checks, editor checks and the packed consumer use that compiler. TS6 remains an internal development dependency because the installed typed ESLint stack requires its JavaScript compiler API. It is no longer a consumer compatibility target. The editor fixture now drives the actual TS7 language server; a minimal native probe characterized its successful shutdown message and exit status so that shutdown noise does not hide assertion failures or fail the enclosing command.

The user confirmed the existing parent argument for whole configuration alternatives: `create.Function({ execute }, { config: choice })`. It retains schema/default correlations. No child-spread inference feature or component/descriptor spread support is being added. The isolated factory-signature experiments were discarded.

The integrated helper-substitution correction adds an internal, optional type-only contract to inferred injected helpers. It records raw input alternatives, allowed keys and constrained open fields, guaranteed configured omissions, private reservations and completed result types. It adds no runtime symbol, schema, state or binding path; the emitted `application.js` remains an empty module. This addresses the demonstrated gap in generic-function assignability while retaining compatible widening and newly supplied callbacks. The regression matrix also crosses inheritance and run overrides with conditional defaults, selected parsers, mixed open/closed unions, native helpers and shadowed helpers.

Verification passes with the locked AI SDK 7.0.130/provider-utils 5.0.56 and TS7 7.0.2: the full `test:types` pipeline, source/declaration editor checks in both optional-property modes, all **45 type mutations**, and **22 registry mock tests**. Five new mutations independently remove raw-input, branch-key, constrained-extra, default-guarantee and private-reservation information; each admits an invalid public factory call and is detected. Type instantiations remain within the 2x budget: **498,092 / 419,566 (1.19x)** on the existing ordinary-call workload. The separate 12-registry workload measures **889,991 with the helper contract versus 892,725 without it**. These are bounded workload measurements, not a universal compiler-performance claim. The first new completion assertion incorrectly requested a key already present in its object literal; moving it to an empty argument object, with a separate valid call, resolves that fixture error. No runtime-production code changed and no paid model calls ran; earlier runtime mutation and coverage counts remain historical evidence.

Focused lint passes on the changed production type owner and registry tests. All intended source, tests and documentation are staged. Temporary comparisons, discarded experiments and ignored review logs remain for the user's requested manual deletion; their inventory is `.review-pending/DELETE-LIST.txt`.

A separate caller-inference defect remains open. Function rejects some valid whole-argument unions with branch-only open/catchall fields. Renderer shorthand can infer only common fields and miss an invalid catchall value in a union such as `{ value: number } | { value: number; extra: string }`; the shared complete-input predicate rejects the full union when explicitly given it. Runtime schema validation still owns acceptance. Tuple-capture experiments corrected these isolated calls but broke required-input behavior or callability through unions of components, so none was retained. Private-key regressions remain separate obligations and must not be weakened to fix this inference gap.

The user deferred caller signatures to a focused follow-up. A public-consumer reproduction compiles with the emitted TS7 declarations:

```ts
import { create, z } from 'casai';
declare const input: { value: number } | { value: number; extra: string };
const renderer = create.Template({
  template: '{{ value }}', context: { value: 1 },
  inputSchema: z.object({ value: z.number() }).catchall(z.number()),
});
renderer(input); // Should reject the possible string-valued extra statically.
```

Execution of the concrete `{ value: 1, extra: 'invalid' }` branch rejects with `ConfigError: Application input validation failed.`; `{ value: 1 }` renders `1`. The shared predicate rejects the whole union directly, confirming that this is call inference rather than a missing schema constraint. Preserve both valid union calls and required input through mixed component unions when correcting it.

Casai and Cascada will release together. The missing published `makeSharedIterable` export is therefore a coordinated release gate, not a request to patch the older engine. The current local link points to `C:/Projects/cascada`; the newer `C:/Projects/cascada-chain-resolution` kernel still needs its compiler/renderer handoff and Casai acceptance tests. Once the integrated engine is packaged, rerun the clean packed-consumer check without workspace linking. Whole-phase signoff still requires those gates, the caller-inference correction and a subsequent integrated review.

## Selected-schema correction and consumer follow-through (2026-10-22)

The selected-`inputSchema` defect below is corrected in the shared type layer. Each complete configuration and selected parser keeps its declarations, defaults and private bindings together. Caller checks intersect those contracts; callback types retain the possible assembled execution contexts. An intrinsic `z.union(...)` remains one parser accepting either branch. No runtime parser, schema, binding state or security mechanism was added.

The consumer trace also corrected the adjacent places that could recombine those alternatives:

- Parent callback reconstruction removes the old callback per configuration alternative, retaining schema/default pairings. Configured fields absent in another alternative remain readable as optional dependencies without mixing present values between configurations.
- Binding compatibility checks each selected implementation separately. Injected helpers capture the native completed output before distributing configuration, preserving transformed output types.
- Tool projection checks defaults against the same selected parser. A native union parser with private `factor` and a separate object parser with public `factor` no longer create a false projection failure. Conversely, every selected parser must admit object application input; a valid object parser cannot hide a scalar-input alternative.

The dedicated `tests/type-safety/selected-schema-contracts.ts` consumer covers Function, Script, Template and all four retained LLM families, ordinary/run calls, inheritance, preparation callbacks, injected helpers, binding, native unions, required fields, incompatible values, configured omissions and private collisions. Existing conditional-schema and optional-context fixtures remain part of the verification. One older intersection fixture was corrected: intersecting a nonempty object with `z.object({})` gives an impossible native `Record<string, never>` input. A preprocessor alternative had previously hidden that restriction. The fixture now uses a compatible nonempty intersection; Casai does not reinterpret Zod's native input types.

The full `npm run test:types` pipeline passes with TS7/TS6, source consumers, build, emitted declarations and exact-optional checks. The focused runtime suites pass **80 mock tests**, including native union-versus-selected parsing, direct/run/injected/bound execution, parsed-versus-private retained fields and selected projection. All **40 type mutations** are detected, including seven new faults for the selected-schema family. The old configured-context mutation now checks retained optional callback fields: per-alternative caller checks independently retain private-key protection. Type instantiations remain below the 2x budget: **497,409 / 419,566 (1.19x)** for TS7 and **388,483 / 275,385 (1.41x)** for TS6. Editor checks pass against source and declarations in both optional-property modes. Lint passes on the changed implementation and tests, after correcting one type-only fixture variable's name.

Early broad compiler checks exposed and corrected helper-output and optional-dependency inference regressions; those failed runs are not completion evidence. Initial type experiments that rebuilt whole configurations or returned unions of generic signatures were removed. The final approach carries only the configuration/parser pairing and keeps one callable signature. No runtime production code changed, so the prior runtime-mutation and coverage results are historical evidence, not rerun claims; no paid model calls were made.

The final consumer follow-through also characterized a **pre-existing child-configuration inference restriction**. Given a whole configuration alternative whose schemas and configured values differ, `create.Function({ ...config, execute: () => 1 })` can produce TS2769. Supplying the same alternative through the existing parent argument works, including the precise callback case in `selected-schema-contracts.ts`. In-memory TS6 probes reproduced the rejection against both the pre-fix and corrected implementations; a minimal native SDK `tool` configuration choice is rejected too, with no Casai-only context property involved. This remains part of the factory-inference gate, not a new regression or a runtime security bypass. No descriptor-spread support or new initialization form was added to compensate.

Automatic approval review rejected removal of the temporary comparison files as **“blocked by policy.”** These remain **untracked and unstaged** in the project root: `.review-selected-baseline/`, `.review-selected-baseline.cjs`, `.review-selected-probe.ts`, `.review-selected-full-probe.ts`, `.review-selected-slice.ts`, `.review-selected-small.ts`, `.review-selected-import.ts` and `.review-selected-helper.ts`. The mutation harness removed its own isolated directories normally.

The existing helper-substitution/inference gates, newer Cascada handoff and package-distribution blocker remain separate open work. This correction does not establish whole-phase signoff.

## Independent integrated review: selected schema alternatives (2026-10-22)

This evaluation found **one new medium-priority type-contract defect with caller and callback manifestations**. No new runtime private-binding replacement or disclosure was reproduced. Production code is unchanged. The confirmed defect and the existing helper-substitution, newer-runtime and package-distribution gates prevent a clean Phase 2 signoff.

### Strategy and refinement

The first pass inventoried exports, factory modifiers, Config/inheritance, ordinary and named calls, schema/default preparation, bare/bound/injected tools, hidden renderers, cancellation, streams/results and package consumers. Independent parallel reviews covered schema/execution owners, public types and factory/stream consumers. Native comparisons followed the installed SDK's Agent/ToolLoopAgent, schema normalization, tool/context execution, callbacks, approval/history and stream owners, alongside Cascada's rendering and iterable contracts.

The second pass started from consumers and interactions, rather than repeating the feature inventory. In particular, it distinguished alternatives **inside one parser** from a configuration that can select **different parsers**. Previous conditional-schema regressions covered `Schema | undefined`, and intrinsic Zod unions covered either-branch validation. Neither establishes the contract of `SchemaA | SchemaB`. This refinement found the type defect below; the runtime still uses the concrete selected schema correctly.

### Finding: selected schemas are flattened into one permissive caller contract

`ApplicationInput`, `PublicNames`, `PrivateKeys` and `ApplicationCaller` in `src/types/application.ts` combine different possible schemas before enforcing the selected schema's contract. `CanInvoke` then accepts an effective input matching one member of that combined input union. `PrivateNames` subtracts declarations from every alternative together. This is appropriate for a single supported union schema's declaration policy, but not for an unknown choice of parser.

For example, these ordinary calls and `.run()` calls compile through Function, Script and Template:

```ts
const publicSchema = z.looseObject({ key: z.string().optional() });
const privateSchema = z.looseObject({ query: z.string().optional() });
function selectedSchema(publicKey: boolean) {
  return publicKey ? publicSchema : privateSchema;
}
const component = create.Function({
  inputSchema: selectedSchema(false),
  context: { key: 'trusted' },
  execute: () => 1,
});
component({ key: 'caller' });
component.run({ context: { key: 'caller' } });
```

The selected private schema causes both calls to reject with `Private input keys: key` before execution. Selecting the public schema permits the override; omitting it retains the configured value. A concrete private-schema component already rejects the invalid call statically. The runtime guard is effective, so this is an accepted-call/type mismatch, not a model security bypass.

The same problem is not limited to private data:

- Choosing between `z.object({ left: z.string() })` and `z.object({ right: z.number() })` admits `{ left: 'only-left' }` even when the selected parser requires `right`.
- Choosing between a string-or-number field schema and a string-only field schema admits `{ value: 1 }` for the string-only branch. `{ value: 'shared valid' }` is a valid neighbor under either selection.
- A real `z.union([leftSchema, rightSchema])` correctly accepts either input and must retain that behavior. Tightening all union inputs would fix the wrong contract.

**The same premature combination also loses valid callback fields.** With configured `{ key: '4' }`, one schema declaring `key: z.string().transform(Number)`, and another declaring only optional `query`, every execution has `key`: parsed number under the first schema and configured private string under the second. The inferred Function callback context instead drops `key` from the second alternative, so `const key: string | number = context.key` produces TS2339. `Execution` globally omits every possible public name from configured bindings before assembling the branch-specific parsed output.

Correct this in the shared type owners by preserving complete selected-schema/configuration alternatives. Calls must be valid under every possible selected contract; callback/result types must include each possible assembled execution context. Keep intrinsic schema unions, correlated whole-configuration alternatives, configured omissions and existing runtime merge/validation rules intact. No additional schema, runtime parse, ownership tracker or factory-specific runtime branch is justified. This review does not implement that type change.

### Complete consumer pass and existing gates

| Surface | Result of this evaluation |
| :--- | :--- |
| Exports, configuration, inheritance and all factory/modifier paths | Re-inventoried runtime and public type consumers. The selected-schema finding affects shared caller/context typing; recent configuration snapshots and forbidden-setting corrections remain effective. |
| Application/schema/default/private preparation | Shared owners and direct/run, bare/bound/injected paths preserve parsed values, configured defaults and private checks. No new runtime bypass was reproduced. |
| SDK lifecycle and publication | Native validation, context revalidation, callbacks, approval/history and final execution remain their established owners. Actual subsequent requests were inspected in focused production checks. |
| Renderers, source/settings, metadata and cancellation | Prepared internal handoff, keyword normalization, signal forwarding and invocation-local binding checks pass their focused consumers. The selected newer chain-resolution compiler/renderer handoff remains unimplemented acceptance work. |
| Output, lazy streams, result/history/native/UI consumers | Focused failure, cleanup, consumer-order and native-comparison tests pass. Union-valued undeclared streams deliberately retain a runtime check under the plan's explicit exception; their static admission is not a new defect. |
| Public types and retained helper consumers | New selected-schema caller/context mismatch above. Previously documented generic helper substitution and valid open/catchall argument-union inference restrictions remain open. |
| Distribution | `node_modules/cascada-engine` still links to `C:\Projects\cascada`. The previous isolated published-engine import failure remains an open gate; this review did not rerun the network package installation or claim a distributable build. |

The final reverse-consumer pass found no further important defect beyond the selected-schema family and the already recorded gates. This ends the evaluation, **not** the requirement for a clean pass after corrections. Phase 2 remains open.

The shared runtime preparation architecture continues to fit the requirements. The useful simplification is to give selected alternatives one shared type-checking/assembly policy, rather than adding another set of per-factory exceptions. The already documented duplicate LLM `.run()` merge and shorthand extraction remain a nonblocking cleanup; no behavior failure was attributed to them. A suspected configured prompt-array race was excluded: valid literal invocation dispatch copies the prompt array synchronously, and constructor ownership is not promised for that nested field.

### Verification

The selected-schema caller probes and their valid/concrete-negative controls compile with **TS7 and TS6 against source in the configured default optional-property mode, and against current emitted declarations in both optional-property modes**: six passing configurations. Passing here demonstrates missing diagnostics for the counterexamples, not correct behavior. The retained-key callback probe produces the same sole TS2339 in all six configurations. Fourteen relevant emitted type aliases were compared with current source using normalized TypeScript AST output and match. Focused compiler fixtures imported the exported factory definitions directly to avoid unrelated aggregate-import cost; no compiler casts establish the findings. Interrupted exploratory checks and a full-source exact-optional check with existing diagnostics are not counted as passing evidence.

Focused mock-only runs passed in four groups: **109**, **122**, **356** and **185** tests. These groups overlap and are not an additive unique-test count. They cover production integration, schema capability/identity, ownership/security lifecycle, tool context/registries, all 28 LLM family/modifier combinations, stream helpers, result augmentation, invocation/history, renderer engines and workflows. Four Phase2Lifecycle tests are native/design characterizations, not production integration evidence. Expected native failure diagnostics were observed separately from test assertions.

An independent reverse-consumer probe crossed inherited public defaults, a root transform removing the raw field, private symbol bindings, ordinary/run calls, bare/bound native generation and streaming, and injected Function/Script/Template consumers. It recorded **12 application parses and 10 successful executions**, plus two blocked private collisions. Each successful invocation parsed once; removed defaults stayed absent; bound public values did not become configured-default annotations; private symbol values stayed out of subsequent provider requests.

All **33 existing production runtime mutations** were detected against isolated source copies, covering defaults, both private enforcement paths, parsed-value consumption, metadata authority, snapshots, declarations, projection consumers and stream/run behavior. These mutations validate their existing protections; they do not detect the newly missing selected-schema type checks. Temporary probes and mutation copies were removed, and `git diff --check` passes. No paid model calls or whole-suite run were used, and no production implementation or dependency was changed.


## Declaration capability, projection admission and component copies (2026-10-22)

The next Claude review identified two runtime/type mismatches and several smaller gaps. The fixes retain one application schema and the existing binding contract:

- **Local declarations:** bounded Zod 4 discovery follows preprocessors, cached lazy schemas and object intersections without converting field schemas. One-level object unions also work through wrappers. Classic/Mini Date and custom/function fields retain native local parsing with configuration or injected helpers. Input capability/name types mirror these declarations. A follow-up consumer check also found lazy output schemas hiding optional private names; both ordinary and bound calls now reserve them, including deep wrappers and recursive alternatives. Final boundary inspection removed an unsafe depth cutoff introduced during this fix; runtime output discovery now terminates cycles by identity without dropping known private names.
- **Tool projection:** known root unions with configured or bound public defaults are rejected by tool factory, explicit binding, owner registry and run types. Ordinary components and private-only union tools remain valid. Unknown metadata still fails lazily before provider dispatch; no eager metadata conversion or general union projector was added. Older compiler fixtures that advertised unsupported union-default tools now follow the projection contract, retaining valid object-schema/conditional-default neighbors.
- **Component copies:** the user rejected spreading components as another initialization pattern. Casai registry admission rejects copies that retain `bindToolContext` but lose callable/internal binding identity. Configuration plus an optional parent remains the supported customization path. Native SDK APIs outside Casai do not acquire a new copying guard.
- **Execution and consumption:** enumerable symbol bindings survive selection, comparison and private-collision checks. The web-stream bridge uses zero prefetch and acquires/advances the iterator only on a read, retaining native cancellation cleanup. Injected validation diagnostics include the tool name without exposing values; malformed LLM call envelopes and missing renderer sources use `ConfigError`. LLM run keywords normalize into the existing single-settings-object envelope, and mixed arguments are rejected rather than ignored.
- **Simplification and documents:** removed unused internal aliases/types, two unused inferred-input parameters, and streamer-only tool flags. Still-used descriptor input parameters remain. Direct declaration lookup measured approximately 1 to 3 microseconds in a focused local probe; no additional cache was justified. The plan's current status, deleted-file link and stale implementation instructions are corrected; historical ledger pointers no longer claim to be the latest review. The review process now crosses each supported structural schema form with non-JSON fields and separates local declaration capability from model projection.

Native comparison followed the installed Zod lazy cache and input metadata processors, SDK tool preparation/execution, and native stream conversion. The follow-up consumer pass traced declaration discovery through ordinary/run, bare/bound/injected tools, renderer preparation and SDK dispatch; it kept local parsing separate from provider metadata. Registry context identity checks cover symbol entries too. Direct SDK binding pairs retain their documented fixed-context host contract; no additional executor check was added for deliberately replacing that context.

Verification completed on 2026-10-22:

- TS7/TS6 source and public-consumer checks, build, emitted declarations and both optional-property modes pass. Both compilers also pass the final two edited runtime-test files. Editor checks pass for source/declarations in both optional modes, including the new projection and copied-component diagnostics. Old union-default positives and a duplicate editor-fixture variable were corrected without weakening production guards.
- Lint passes across the complete source/test file set in batches and focused rechecks. The initial monolithic run and diagnostic retries were interrupted, not counted as passing. Tracing isolated expensive assertion lint on generic factory double casts; runtime-negative fixtures now use annotated `unknown` boundaries. An unsuccessful common-schema annotation experiment was reverted. Only intentional invalid-spread test lines have local lint annotations; no production rule was disabled.
- Final `npm run test:coverage` passes **1,399 mock tests**, with **99.27% statements/lines, 95.63% branches and 100% functions**, including the separate augmentation gate. Earlier child-process timeouts did not recur in the sequential run. The output contains no private sentinels; native diagnostic logging remains characterized separately. No paid model calls were made. Newly changed runtime statements are covered; retained uncovered paths belong to existing loader, unsupported-mode and native-precondition cases.
- All **33 runtime mutations** and **33 type mutations** are detected. Added faults cover structural discovery, private symbol preservation, lazy/deep private reservations, stream prefetch, run envelopes, copied components and projection admission. The intersection mutation was retargeted after a shared-helper refactor made its old first-match replacement hit the wrong owner. Type instantiations remain within the 2x budget: **498,467 / 419,566 (1.19x)** for TS7 and **391,560 / 275,385 (1.42x)** for TS6.
- `git diff --check` passes. Mutation directories were removed by their bounded cleanup paths. The deleted renderer-input alias's stale generated files were removed, and the final build has no JavaScript output without a matching source file. No unsuccessful implementation experiment or compatibility shim remains.

No unresolved API decision remains for these corrections. The newer chain-resolution handoff, published engine/packed-import blocker and broader helper-substitution gates remain open. The local engine still links to `C:\Projects\cascada`; the fresh-package check from the preceding entry was not rerun. This follow-up does not establish whole-phase signoff.

## Preprocessors, configuration snapshots and diagnostic sinks (2026-10-21–22)

The third Claude follow-up identified four implementation/documentation gaps plus a native logging limitation. The corrections preserve the existing ownership and security contracts:

- **Preprocessors:** type admission now defers transform-first pipelines to runtime metadata capability. Public-name inference follows Zod's native input JSON Schema rule: skip the preprocessor transform, then read the next schema's input declarations. Merely admitting the schema would have left configured public defaults incorrectly private in callback and call types. Raw input remains the schema's native input type, normally `unknown`; Casai does not infer value restrictions from metadata. Classic/Mini runtime consumers cover configured/defaulted input, private-only configuration, ordinary/run/bare/bound/injected paths, retained private collisions, native stripping and renamed output. Compiler consumers check parsed body types, public overrides and private-key negatives.
- **Configuration:** root and one-sided inherited `messages` arrays are copied, preserving parent-first concatenation and explicit-undefined behavior. Message objects remain shared. The now-redundant post-merge message copy in LLM invocation was removed. README describes both array ownership and context-getter capture at construction, and distinguishes functions evaluated during execution. No recursive snapshot or freeze was added.
- **Prompt validation:** the shared Script prompt renderer validates its returned value with the same `Prompt output` stage as Function preparers. ScriptEngine no longer needs a prompt-only output schema. Standalone Script output validation retains its own stage. The family matrix covers inline/loaded Script and Function preparers before Text/Object generation and streaming dispatch.
- **Injected call IDs:** registry helpers use the SDK's `generateId`, which has no secure-context Web Crypto requirement. Native and Casai injected calls run with global crypto unavailable, retain native metadata, and receive distinct nonempty IDs. These are correlation IDs, not security tokens.
- **Diagnostics:** the approval-continuation regression captures ToolLoopAgent's native default `console.error` and verifies that its error cause contains the private fixture value. The same failed binding through Casai TextStreamer verifies that an explicit execution `onError` receives the original error and prevents default logging. UI formatting alone does not control execution logging. README and plan explain the sensitive diagnostic sink without adding error scrubbing. The installed ToolLoopAgent has no public execution `onError` option; native streamText/streamObject and Casai's streaming factories do.

Provider-utils now uses `^5.0.56`, consistent with the already-approved tested-minimum policy. The lock retains the tested 5.0.56 installation. The isolated package check asserts that Casai and the fresh SDK resolve the same utility package; this does not promise that all possible future dependency trees deduplicate.

Native inspection followed Zod's `pipeProcessor` input-mode selection, SDK ID generation, ToolLoopAgent settings and stream delegation, and streamText/streamObject default error handlers. The subsequent consumer pass revisited all construction/inheritance owners, raw/parsed input consumers, helper and SDK bindings, all prompt renderers, error causes and model/UI/log sinks. No additional production behavior or new protection layer was needed. The review process now explicitly includes these interactions.

Verification completed on 2026-10-22:

- The complete `test:types` stage of `npm run check` passes: TS7/TS6 source, public consumers, build, emitted declarations and both optional-property modes. Both compilers also pass a final focused check of the three test files changed during lint/runtime verification.
- Lint passes across the completed full scan and focused rechecks of corrected test files. The monolithic `check` stopped at test-only lint diagnostics; after correcting them, lint and coverage were completed separately. No production fix was needed for these diagnostics.
- `npm run test:coverage` passes **1,387 mock tests**, with **99.34% statements/lines, 95.85% branches and 100% functions**, including the separate augmentation gate. Two old parent-message identity assertions were updated to require copied arrays with shared nested messages. All newly added runtime branches are covered; retained uncovered lines belong to existing loader/unsupported-mode/native preconditions. The captured output contains no private sentinels. Another invalid-context fixture now asserts an explicit execution error handler instead of printing its native diagnostic cause. No paid model calls were made.
- All **24 runtime mutations** and **30 type mutations** are detected. The added cases independently remove root/one-sided message snapshots, restore secure-context crypto IDs, mislabel prompt validation, reject preprocessor metadata capability, and lose preprocessor public names. Editor checks pass against source and declarations in both optional modes, including parsed preprocessor fields and absence of removed defaults. Type instantiations remain within the 2× budget: **471,177 / 419,566 (1.12×)** for TS7 and **368,591 / 275,385 (1.34×)** for TS6.
- `npm run test:package` passes its build, manifest/deduplication assertions and isolated declaration consumer. The fresh installation resolves **ai 7.0.148, provider-utils 5.0.65 and Zod 4.6.7**, with one shared utility installation. Runtime import still fails because published **cascada-engine 0.6.2** lacks `makeSharedIterable`. The local link remains `C:\Projects\cascada`; it was not substituted into the isolated package or patched. Local runtime checks retain the tested SDK/utility/Zod minimum versions.
- `git diff --check` passes. Temporary mutation/package directories were removed by their bounded cleanup paths; no temporary implementation or compatibility shim remains.

No unresolved API decision remains for these five findings. Whole-phase helper typing and the Cascada runtime/publication handoff remain separate open gates; this follow-up does not establish whole-phase signoff.

## Configuration, metadata and packaging follow-up (2026-10-21)

The next Claude review identified four actionable runtime/diagnostic gaps and one documentation ambiguity. The fixes stay in the existing owners; no new schema, adapter, state mechanism or public overload was added.

- **Input declarations:** `inputNames` wraps failed SDK metadata acquisition in the existing partitioning `ConfigError`, preserving the native cause. Local Standard Schema validation still works without conversion when partitioning is unnecessary. Tests add private configuration, optional declared context and registered helpers independently, check ordinary/run/bound validation, and verify that failed discovery never probes the validator or enters the body. Explicit metadata restores configured defaults; one-level object unions remain supported, while unsupported composition retains its existing rejection.
- **Obsolete rendering settings:** shared configuration validation rejects top-level `options`, including explicit `undefined` and inherited settings, with `renderOptions` guidance. The factory matrix covers Config, coded components and LLM renderers; an actual autoescape neighbor and application `context.options` remain valid. LLM run settings use the same guard; coded run settings already reject unknown keys. No compatibility alias was added.
- **Direct Object schemas:** the earlier user-approved Zod 4-only rule includes ObjectGenerator/ObjectStreamer `schema`. README and plan now state this explicitly. A native `output: Output.object({ schema })` specification remains governed by the SDK. Existing runtime/type regressions cover this distinction; production behavior did not change for this finding.
- **Effective registries:** LLM dispatch checks invocation settings rather than the original registry. Untyped JavaScript and Cascada run-only registries receive the same per-run binding and fixed-context check as configured tools. Generation/streaming and literal/rendered consumers assert the bound public default and a real second model request; prepareStep replacement fails before any request. Public types still restrict run overrides to configured names.
- **Configuration ownership:** `processConfig` copies the four configuration map containers, and `mergeConfigs` also copies one-sided inherited maps. Ordinary and bare SDK calls retain the same dependency after the author replaces an original map entry. Mutating a nested resource remains observable on both paths. Renderer tests exercise inherited tools, toolsContext and filters. This is a shallow binding snapshot, with no deep copy or freeze.

Native comparison inspected installed ToolLoopAgent settings, provider-utils schema normalization and Standard Schema conversion, core generate/stream dispatch, prepareStep and tool-context validation. Native conversion owns the original error; Casai adds guidance only when its partitioning requires declarations. Native per-step context replacement remains subject to Casai's already-established fixed binding lifetime. The consumer pass traced all factory construction/inheritance owners, ordinary and named calls, bare/bound/injected descriptors, and literal/rendered generation and streaming. Existing private guards, approval/history handling, parsed-value execution and output delivery are unchanged.

The user approved tested minimum peer versions: `ai: ^7.0.130` and `zod: ^4.6.5`. Zod is a peer with an exact development version, TypeScript is development-only, and unused ts-node is removed. Provider-utils stays pinned to the installed SDK's 5.0.56. The lockfile contains no dependency version upgrades. Default lint now sets the same 8 GB heap used by previous successful checks. The packed consumer installs its own compiler explicitly and checks the dependency manifest before checking declarations and runtime import.

Verification:

- `npm run check` completed all TS7/TS6 source, public-consumer, emitted-declaration and exact-optional checks, then completed the full default 8 GB lint scan without an allocation failure. Lint reported four diagnostics in two changed files: an untyped map spread, the intentional non-Error metadata rejection, and two unnecessary awaits of native result values. Those were corrected; both affected files pass a focused recheck with every lint rule enabled. The full check pipeline was not rerun after these lint-only corrections. The subsequent package build also passes.
- The separately completed `npm run test:coverage` passes **1,379 mock tests**, with **99.34% statements/lines, 95.75% branches and 100% functions**, plus the separate augmentation gate. The changed runtime branches are covered; the remaining configuration-copy uncovered line belongs to the existing loader normalization. No paid model calls were made.
- All **20 production runtime mutations** are detected against the final files. The five added mutations cover metadata error ownership, obsolete options, standalone/inherited map snapshots and effective registry binding. The metadata mutation uses a single-line match so CRLF checkout does not invalidate the fixture. `git diff --check` passes.
- `npm run test:package` passes its build, dependency-manifest assertions and isolated declaration consumer with its explicitly installed compiler. The fresh installation resolves **ai 7.0.148 / Zod 4.6.7**, with one deduplicated Zod; local runtime/type verification used **ai 7.0.130 / Zod 4.6.5**. Runtime import still fails because published **cascada-engine 0.6.2** lacks `makeSharedIterable`. No runtime compatibility claim for that fresh installation follows from declaration success. The workspace link remains `C:\Projects\cascada`; it was not substituted into the isolated consumer.

The broader helper-substitution/open-argument typing gates and selected Cascada runtime/publication handoff remain open. These corrections do not establish whole-phase signoff. There is no unresolved API decision for the findings addressed in this follow-up.

## Schema identity and production-evidence correction (2026-10-21)

The follow-up confirmed the Claude findings against production: absent declared private names were lost for a separate Zod 3 installation, Mini, Zod 3 refinements and context intersections; Cascada keyword/history calls regressed; prepared SDK tools lost useful application-validation details; LLM provider options reached two unrelated destinations; and Function retained its caller's settings object. The security reproduction reached bodies in generation and streaming, on bare and bound descriptors. Existing private values remained protected.

### Corrections and bounded guarantees

- The user chose Zod 4-only support for Casai component schemas. Zod 3 discovery and type branches were removed; directly supplied Zod 3 input/output/tool-context/stream-element schemas are rejected at construction and in types. SDK/Standard schemas, native third-party tools and native SDK output specifications retain their contracts. Zod 4 discovery uses core definitions rather than constructor identity. Classic/Mini, separate installations, wrappers, declared pipeline outputs and known union/intersection members retain discoverable private names. Raw input selection and output reservations remain separate. Opaque transforms are not unwrapped as output declarations and no parser/default callback runs for discovery. Public type discovery follows core shapes, including Mini and intersections. A declared output pipe supplies explicit names after a transform.
- Keyword normalization only removes the keyword envelope and rejects an additional context object; each real caller retains its own positional validation. Existing history-before-context forms are preserved on retiring LLM renderers.
- The SDK application's parse retains native validation details. Direct/injected failures keep ConfigError and its cause; binding/private-context preparation and output failures retain stage-only public messages. The migrated nested-validation and approval-continuation checks inspect actual next requests/UI errors and native causes.
- Confirmed by the user: providerOptions on TextGenerator/ObjectGenerator configures the inner model only. Coded tool descriptors retain native providerOptions; an additional LLM tool setting is deferred to LLMAgent design. Streamer factories do not expose asTool.
- processConfig now makes the shallow settings snapshot for both Function and reusable Config. External resource references remain shared. The redundant incomingObject wrapper was removed, and per-run registry overrides reuse the existing configuration check with its disabled/inherited-entry distinction.

### Prototype retirement and evidence mapping

Old algorithm/feasibility prototypes, their seven runtime suites, four type sketches and five checker/editor scripts were removed. Their historical design reports remain explicitly labeled. Production acceptance no longer counts the isolated implementations. This is a replacement of evidence, not a claim that native characterization tests are production coverage.

| Retired evidence | Current owning checks |
| --- | --- |
| Default resolution, public API and composed call sketches | SchemaPreparation, Phase2.integration, Registry, ToolContext, ConfigMerge and the public type-safety consumer suite: complete merge, raw/parsed values, inheritance, optional/default values, union admission, metadata and fixed configuration |
| Private/hybrid boundaries and generated candidate | Phase2ProductionSecurity and SchemaIdentity: actual factories, forwarding, absent declarations, own keys, transformed input, separate installations, repair and state binding |
| Prototype transport/continuation failures | ProductionSecurityLifecycle and ToolLifecycle: bare final guards, nested input/output errors, failed binding approval continuation, next requests and UI errors |
| Native selection/signing/UI limits | Phase2NativeSecurityControls and the production generated suite: native controls alongside real Casai descriptors, replay, signed tampering, pre-prepareCall approval validation and transformed UI history |
| Prototype editor/mutation/type checkers | phase2-production editor/types/mutations; public source/emitted consumers, both compiler/optional modes and real production guard mutations |

SchemaIdentity's runtime matrix uses separate physical module copies and native validation controls; its adversarial dynamic factory calls deliberately erase static types. schema-identity.ts uses concrete public consumers. These are distinct checks. An additional experiment imported copied Zod 3 declarations under an independent package identity to prevent TypeScript deduplication. Even the native control, `tool({ inputSchema: z.object({ value: z.number(), factor: z.string().transform(Number) }), execute: input => input.factor * input.value })`, failed with TS2589 under TS7 and lost its callback inference. Earlier combined source probes timed out. This does not establish separate-installation static compatibility; the unsuccessful checker and speculative structural Zod 3 type rewrite were removed. Runtime protection is independent of that native type limitation.

### Evaluation status

The complete **`npm run test:types` passes**: TS7/TS6 source and public-consumer checks, build, emitted declarations and exact optional-property checks. All **four production editor modes** pass against the final build (source/declarations, each with exact optional properties off/on), including completions, callback inference and named diagnostics. Full lint passes with the documented **8 GB heap**, with every rule enabled. Earlier interrupted checks and timed-out experiments are not counted as passes; the final compiler, lint and mutation checks ran sequentially after the runtime-fixture assertion cleanup described below.

The final runtime coverage gate passes **1,365 mock tests**, with **99.33% statements/lines, 95.70% branches and 100% functions**, including the separate augmentation gate. All **15 production runtime mutations** are detected. These cover both final collision enforcement and the declarations that supply its protected names, unsupported-version rejection, SDK error details, keyword/history calls, configuration snapshots and provider-option ownership. All **28 type mutations** are detected: nine focused shared-owner mutations and 19 public-consumer mutations, including removal of the Zod 3 exclusion. The shared-owner probes complement the exported-factory matrix rather than replacing it. No paid model calls were made.

The final fixed compiler-cost workload uses **470,614 / 419,566** TS7 and **368,039 / 275,385** TS6 production/baseline instantiations, within the 2x budget. These replace the earlier-snapshot measurements for this correction. A separate same-source import comparison measured 2,997,272 instantiations without the Zod 3 type exclusion and 3,039,961 with it (1.4% higher). Concurrent wall-clock measurements are not treated as a reliable cost comparison.

### Consumer pass and simplifications

The subsequent pass traced the changes through configuration fragments and inheritance, all factory families/modifiers, ordinary and named calls, hidden renderers, bare/bound and injected tools, native hooks/approvals, output and lazy-element validation, result/history/error transport, and source/emitted public types. Configuration and stream constructors own direct schema-version rejection; native tool registries and native output specifications keep their SDK contracts. Schema discovery only reads declarations, while native validation supplies parsed values. Application-validation details are exposed only on the SDK public-input boundary; trusted-context and nested component failures retain their existing public summaries. The actual generation/streaming tests inspect subsequent provider requests as well as errors, hooks and body counts. The type pass caught and corrected one compatibility detail in the version restriction: `toolContextSchema: undefined` must still clear an inherited schema under exact optional properties. Its public assertion now checks the narrowed Casai schema type, with explicit undefined retained. The outstanding whole-phase gates below remain open.

The small wrapper and duplicate registry check were removed. Settings copying belongs in shared `processConfig`, which also corrects reusable Config fragments. A broader declaration cache was not added: preparation already caches within a binding, and component-wide caching would introduce another lifetime without demonstrated benefit. Native SDK Schema objects cache metadata; that does not imply every freshly normalized Standard Schema wrapper does. A universal caller wrapper would hide the different positional contracts. Removing the second LLM `.run()` merge cleanly needs a broader lifecycle change; adding a mode flag solely to save that merge did not justify the complexity. The unsuccessful duplicate-Zod type experiment was removed. No peer-dependency migration, freeze/proxy layer or new public option was introduced.

The final verification also corrected a test-path inconsistency: the generated production suite now uses the package entry point, allowing the runner's export condition to select source or the built package. A long lint investigation localized expensive redundant-assertion comparisons in intentional runtime type erasure, rather than an equivalent public compiler slowdown. The generated suite checks in 0.584 seconds with TS7 (325,876 instantiations) and 6.13 seconds with TS6 (230,196 instantiations). Making the runtime factory's existing `unknown` boundary explicit reduces its full-rule lint run to 6.4 seconds. The identity fixture uses the same explicit boundary for dynamically selected factories and imported modules. Paired public call checks retain concrete schemas and rejection assertions, all lint rules remain enabled, and the unsuccessful branch-cast experiment was reverted.

The broader helper-substitution, open-argument inference and selected runtime/publication gates from earlier reviews remain separate. This correction does not declare whole-phase signoff.


## Remaining configuration-alternative guards (2026-10-21)

This evaluation found **two additional medium type-contract defects and two lower-priority admission gaps**, addressed in the correction follow-up below. The original evaluation changed no production code. The earlier corrections remain effective on their covered cases. These findings do not reproduce a private-binding replacement or confidentiality bypass; they admit configurations whose real selected branch fails during construction or native execution.

### Strategy and refinement

The pass started again from exports, all factory modifiers, ordinary/named calls, original configuration and inheritance, bare/bound descriptors, injected registries, hidden preparers, engines, output/stream consumers and package distribution. Parallel independent reviews covered schema/execution owners, LLM/results, and coded components/streams; each repeated its review from consumers back to requirements. Installed SDK Agent/ToolLoopAgent, schema/context validation, tool execution, hooks, approval/history and stream owners supplied the native comparison. Installed Cascada supplied the renderer, call/context and iterable comparison.

The first pass found no new runtime enforcement defect in those slices. The next pass moved alternatives beyond the already-corrected application/output schema extraction: tool registries, unknown settings and inherited descriptor callbacks can each be present in only one **whole configuration** branch. The resulting tests ask whether *every possible configuration* satisfies the final component contract, rather than whether a valid branch survives filtering. Valid concrete, absent-branch, inherited and native neighbors distinguish a type omission from an invalid runtime test. No new runtime validation layer is warranted.

### Findings

1. **Medium: conditional registries can lose required tool context.** `ToolsFromConfig` in `src/types/config.ts:49` checks whether `tools` belongs to `keyof TConfig`; a whole-configuration union can have tools in one branch only. It then produces an empty registry for `ValidateToolsContext`, allowing both literal `TextGenerator` and `TextStreamer` construction without the required context:

   ```ts
   const secured = tool({
     inputSchema: z.object({}),
     contextSchema: z.object({ tenant: z.string() }),
     execute: (_input, { context }) => context.tenant,
   });
   function settings(enabled: boolean):
     | { model: LanguageModel; prompt: string; tools: { secured: typeof secured } }
     | { model: LanguageModel; prompt: string } {
     return enabled
       ? { model, prompt: 'ready', tools: { secured } }
       : { model, prompt: 'ready' };
   }
   const component = create.TextGenerator(settings(true)); // Incorrectly accepted.
   ```

   The same omission compiles through a reusable Config parent and TextStreamer. Native `generateText` and `ToolLoopAgent` reject the same whole-configuration settings; a concrete Casai registry and the coded Function factory also reject that shape. With a mock model selecting `secured`, the accepted component performs one provider request and then fails native context validation with `undefined`, before any tool body. Generation rejects; streaming publishes an error part, so merely awaiting partial steps would miss the failure. Supplying the required entry succeeds and returns the trusted tenant; the actual no-registry branch also succeeds.

   Moving the alternatives into the registry itself exposes another route: `tools: { secured } | { simple }`, where `simple` has no required context. Template and Script accept a missing context in default and exact optional-property modes; Function additionally accepts it in emitted exact-optional mode. An actual Template/Script call to `secured({})` then fails tool-context validation; configured-context neighbors return the trusted tenant. Mapped `PossibleToolNames`/`ContextErrors` and registry validation also depend on keys common to the alternatives. Native `generateText`/`ToolLoopAgent` accept this nested-registry shape too, so that variant includes an inherited SDK union limitation, rather than a Casai-only native divergence. Casai's explicit finished-component requirement still needs paired admission. Preserve valid correlated registry/context alternatives instead of requiring one uncorrelated global context map.

   Retain possible registry settings and validate their fixed requirements through the shared setting/registry owners. Audit `ContextMapFromConfig` alongside that extraction. Literal calls need registry admission even though they deliberately do not prepare application context. Keep the native context-validation boundary and absent `undefined` representation unchanged.

2. **Medium: branch-only inherited callbacks evade schema compatibility checks.** `IncompatibleKeys` in `src/types/config-validation.ts:71` intersects keys common to all final alternatives; `ValidateDescriptor` in `src/types/callbacks.ts:51` likewise selects only common keys. A callback inherited from just one branch disappears from both checks when the child replaces its schema:

   ```ts
   const text = z.object({ value: z.string() });
   const numeric = z.object({ value: z.number() });
   function parentSettings(hasHook: boolean):
     | { inputSchema: typeof text; execute: () => string;
         onInputAvailable: (event: { input: { value: string } }) => void }
     | { inputSchema: typeof text; execute: () => string } {
     return hasHook
       ? { inputSchema: text, execute: () => 'ready',
           onInputAvailable: event => { event.input.value.toUpperCase(); } }
       : { inputSchema: text, execute: () => 'ready' };
   }
   const parent = create.Config(parentSettings(true));
   create.Function.asTool({ inputSchema: numeric }, parent); // Incorrectly accepted.
   ```

   A real native ToolLoopAgent call with `{ value: 3 }` invokes the retained hook and throws `input.value.toUpperCase is not a function` before the body executes. A concrete inherited mismatch and the equivalent native `tool({ ...parentSettings(true), inputSchema: numeric })` fail compiler checking. Replacing the hook with a numeric callback works, and retaining the original string schema works. Check callback compatibility for every inherited alternative after the final schema merge; do not discard optional branch-only properties before that comparison. Keep native hook execution and `.config` callback identity unchanged.

   The same omission exists in lifecycle `ValidateCallbacks` at `src/types/callbacks.ts:98`. A branch-only inherited ObjectGenerator `onFinish` expecting a string-valued object survives a numeric schema replacement. Runtime invokes it with `{ value: 3 }`; its string operation throws, but native `notify` swallows lifecycle errors, so generation succeeds while the callback's remaining work is skipped. The direct concrete Casai mismatch rejects. Native default-generic `generateObject` also accepts this variation; explicitly fixing its schema generic rejects it. This is the same Casai final-callback guard gap alongside a native inference limitation, with a different native error channel from descriptor hooks. It does not justify wrapping or changing native notification behavior.

3. **Low: a forbidden setting in only one configuration alternative is accepted statically.** A function returning `{ execute, contextSchema: undefined } | { execute }` compiles through Function, Config and an inherited Function parent. The analogous model/prompt union compiles through TextGenerator and TextStreamer. Runtime construction correctly throws the prescribed `ConfigError` when the forbidden branch is selected, and the absent-key neighbor succeeds. This violates the explicit type/runtime rejection requirement, without bypassing runtime enforcement.

   `ValidateFinalConfig` loses branch-only unknown keys through `keyof TConfig` / `keyof TParent`; Text validators use non-distributive `Omit`. Config fragment admission has another form of the same quantifier error: `StrictUnionSubtype` filters invalid alternatives, and checking that its result is not `never` proves only that **some** branch is valid. Correct the existing admission predicates to reject any invalid alternative. This is not grounds for a recursive key ban or another runtime guard; native nested tools and application fields of that name remain valid.

4. **Low: a null-only tool-context schema passes the object admission check.** `ObjectAdmission` in `src/types/application.ts:65` removes both `undefined` and `null` with `NonNullable`. For `z.null()`, that turns the checked output into `never`, which trivially passes the object comparison. `create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.null(), execute: () => 1 }).bindToolContext(null)` therefore compiles, although binding preparation always fails with `Expected an object context` before body entry. The valid `z.undefined()` neighbor prepares and executes successfully. This is a small static authoring-contract gap: absent incoming `undefined` is supported, while present `null` cannot be flattened. Preserve that distinction in the existing type predicate; no additional runtime restriction or schema walker is needed.

### Consumer pass, remaining gates and simplification

The subsequent consumer pass rechecked configuration fragments/inheritance, all coded and Text/Object entry families, application preparation/private assembly, bare/bound/registered calls, native hooks and approvals, loaded renderers, cancellation, parsed output/stream collection, native history/result views and package exports. No further important runtime defect was confirmed. A suspected `.run()` addition of unconfigured tool names was rejected by the existing type guard and withdrawn. An attempted `never[]` tool-result counterexample was also withdrawn: the SDK retains dynamic tool-result types, and the corresponding native conditional context contract is stricter than that assumption.

The shared preparation pipeline and native execution ownership remain appropriate. The concrete simplification opportunity is consistent alternative-preserving settings and admission checks in shared type owners; factory-specific exceptions, another schema, runtime callback wrappers or additional parsing would increase complexity without addressing these defects. Preserve correlations in valid configuration alternatives rather than globally combining every callback with every possible schema.

Previously open important gates remain open: generic registered-helper substitution can invalidate retained raw/default/private-name call contracts; valid open/catchall whole-argument unions retain an inference restriction; the selected newer chain-resolution compiler/renderer handoff is incomplete; and published-engine/isolated package compatibility is not established by the linked workspace engine. The installed junction still points to `C:\Projects\cascada`. A current-renderer probe preserves an own configured `__proto__: undefined` in Function but returns `Object.prototype` through Script, matching native AsyncEnvironment; this belongs to the selected newer-runtime acceptance work, not a legacy-runtime patch.

The investigation reached no additional important finding after the final complete consumer pass. **This is not a clean Phase 2 signoff:** the confirmed defects and existing acceptance gates remain unresolved. Corrections need paired permanent runtime/type regressions and another complete consumer pass.

### Verification

The full mock suite passes **1,649 tests**, with **99.33% statements/lines, 95.59% branches and 100% functions**, including the separate augmentation gate. All **seven production runtime mutations** are detected. Independent focused runs additionally passed 220 schema/execution/lifecycle tests, 125 coded/stream/registry tests and 420 LLM/result tests; these overlap the full suite and are not additional unique tests. Counterexamples use exported signatures without casts and native/concrete negative controls. New runtime probes cover actual body/callback/provider counts, the streaming error part and valid neighbors. No paid model calls or production fixes were made.

The complete **`npm run test:types` passes**. The conditional-registry and inherited-descriptor/forbidden-setting probes pass in all six configurations: TS7/TS6 source, emitted declarations and emitted exact optional properties. Passing means the counterexamples are currently accepted while their concrete/native rejection controls remain enforced. Separate Template/Script nested-registry probes pass the same six modes; the additional Function nested-registry case is specifically accepted under emitted exact optional properties. Supplemental lifecycle and null-context counterexamples pass TS7 source checking and runtime assertions with valid neighbors; no six-mode claim is made for those additions. Temporary exploratory probes are removed after verification rather than becoming tests that institutionalize the unsound contracts.

**`npm run test:package` fails** after installing the tarball outside the workspace with published `cascada-engine@0.6.2`: importing Casai throws `SyntaxError` because that package does not export `makeSharedIterable`, re-exported by `dist/streams.js`. This reconfirms the existing release blocker; the local engine junction masks it. **Default `npm run lint` again exhausts the 4 GB Node heap**, consistent with the earlier documented whole-tree memory limitation. The complete documented **8 GB lint invocation passes** (`node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js src tests`); no default-command success is claimed. Review-document whitespace checks pass.

### Correction follow-up

The four findings are corrected in shared type owners. Registry extraction preserves whole-configuration alternatives; one registry validator checks required context and bound dependency compatibility across complete configurations, nested registry/context maps and individual tool alternatives. Incomplete reusable fragments remain supported, and existing inherited contexts for disabled tools retain their runtime contract. The duplicate registry admission check in application preparation types was removed. The reverse-consumer pass found the same branch-only forbidden-key omission in LLM `.run()` settings; its shared key check is corrected too, with a paired runtime rejection before provider dispatch. Coded `.run()` already rejected that case.

Final Function, descriptor and lifecycle checks derive each branch's expected callback contract before collecting failures. Success contributes `never`, so a valid branch cannot erase an incompatible callback. Unknown-key admission includes branch-only properties, and Config fragment admission requires every possible fragment to fit a supported component shape. Object-mode key validation checks settings against each final branch's own mode. Tool-context object admission excludes supported absent `undefined`, while retaining present `null` for rejection; a raw null transformed into an object remains supported.

`tests/type-safety/configuration-alternative-guards.ts` pairs all four rejections with concrete and correlated valid alternatives, including object/enum mode changes. Six integration regressions exercise actual native context failures, streamed errors, descriptor hook failure before body entry, swallowed native lifecycle errors, forbidden-key construction and parsed null/undefined context behavior. No runtime adapter, callback wrapper, extra schema, altered merge order or additional parsing was introduced.

The positive-mode comparison caught and corrected an intermediate overrestriction before integration: flattening all keys against common output-shape keys rejected a valid object/enum configuration union. Separate baseline probes also confirmed existing direct-inline inference restrictions for some correlated Text/Function and callback configurations. This correction preserves their supported inherited forms; it does not claim to resolve those broader inference limitations.

The complete `npm run test:types` passes: TS7/TS6 source and public-consumer checks, build, emitted declarations and both exact-optional checks. Mock coverage passes **1,655 tests**, retaining **99.33% statements/lines, 95.59% branches and 100% functions**, including the augmentation gate. The final named-call regression is also covered by a passing **33-test** focused integration run. The unchanged caller workload remains below the 2× instantiation budget: **563,528 / 419,566** for TS7 and **430,072 / 275,385** for TS6. Compiler-heavy checks are expensive; interrupted and timed-out exploratory runs do not count as passing verification.

All four editor modes pass (source/declarations, default/exact optional properties), including callback completion and diagnostics naming the rejected context, hook and setting. The new public fixture also passes explicit TS7/TS6 default-mode declaration checks, completing its six source/declaration/compiler combinations. Full lint passes with the documented 8 GB heap; a subsequent focused lint also covers the final mutation-fixture edits. All **27 type mutations** are detected: **nine shared-owner mutations** and **18 existing public-consumer mutations**. The shared-owner probes complement the full exported-factory matrix; they do not independently prove factory wiring. Whitespace checks pass. No paid model calls were made.

The reverse-consumer pass rechecked the changed admission owners through fragments, inherited and conditional registries, coded and LLM construction, named overrides, descriptor/lifecycle hooks and emitted consumers. It found and corrected the named-call omission above; no further important defect was confirmed in these changed paths. The earlier helper-substitution, argument-union inference, selected-runtime and isolated-package gates remain open; fixing these four findings does not establish whole-phase signoff.

## Alternative-state and reverse-consumer review (2026-10-21)

This pass found **two new medium type-contract defects**, corrected in the follow-up below. The original review changed no production code. The runtime probes retain schema validation and private-field rejection; neither finding demonstrates a model-controlled private-binding or confidentiality bypass. Earlier helper-substitution, valid argument-union inference, selected-runtime and packaging gates remain open.

### Method and evidence boundaries

Start from the exports and execution owners, not the existing test cases. Map each guarantee to its direct, named, descriptor, bound, injected, renderer and result consumers, then review in reverse from those consumers. State what must hold across alternatives: every possible call/configuration state must be safe, one complete effective schema branch must accept the input, and returned types must include every possible parsed result. Vary where the alternatives occur: field values, whole argument objects, schemas, whole configurations and registry entries. These positions are not interchangeable in TypeScript.

The pass reread argument/configuration resolution, schema declaration discovery and projection, preparation/assembly, binding/registry execution, coded engines and prompt renderers, all factory dispatch families, stream utilities, augmentation and public type owners. Native comparisons used the installed SDK Agent/tool contracts, `ToolLoopAgent`, context validation and tool execution. Existing mock assertions cover provider HTTP/SSE fixtures, approvals/history/UI continuation, error transport, generated private-boundary combinations and cancellation. New probes used real exported signatures without casts and paired invalid states with valid neighbors.

### Findings

1. **A schema present in only one whole-configuration branch disappears from result inference.** `DeclaredType` in `src/types/config.ts:38` asks whether a setting belongs to `keyof T`, which contains only the keys common to a configuration union. `DeclaredConfig` in `src/types/function-config.ts:37` also uses non-distributive `Omit`. The runtime preserves and applies the selected schema, but the public result type can advertise only the unparsed producer result:

   ```ts
   const schema = z.string().transform(text => text.length);
   function settings(parsed: boolean):
     | { schema: typeof schema; execute: () => string }
     | { execute: () => string } {
     return parsed
       ? { schema, execute: () => 'hello' }
       : { execute: () => 'hello' };
   }
   const component = create.Function(settings(true));
   const value: string = await component(); // Compiles; actual value is 5.
   ```

   This reproduces through ordinary calls, `.run()`, a reusable Config parent, `.asTool.execute`, the bound descriptor's inferred output and injected helpers. A registered owner can compile `(await child({})).toUpperCase()` and then throw `TypeError`; the schema-absent neighbor returns `'HELLO'`. Equality checks establish `string`, rather than a fallback to `any`. The same whole-object key loss affects configured private names: an inherited `{ context: { user: string } } | {}` allows a typed public `user` override, which runtime correctly rejects when the binding exists. `Configured` in `application.ts:163` needs the same branch-preservation audit.

   This differs from the already-corrected `schema: S | undefined` property: here the **entire configuration** is a union and one branch has no schema key. Preserve alternatives before extracting settings and deriving results/dependencies; ensure inherited configuration normalization does not discard them first. Keep runtime parsing and the distinction between optional annotated contracts and genuinely absent branches unchanged. No new adapter or author-supplied schema is required.

2. **An open schema branch disables closed-branch excess-field checks.** `Closed` in `src/types/application.ts:70` summarizes the entire input union as open if any branch has a string index signature. `CanInvoke` then skips the effective closed-branch check for every branch:

   ```ts
   const inputSchema = z.union([
     z.strictObject({ kind: z.literal('closed'), value: z.number() }),
     z.looseObject({ kind: z.literal('open'), value: z.number() }),
   ]);
   const component = create.Function({ inputSchema, execute: ({ value }) => value });
   component({ kind: 'closed', value: 2, extra: true }); // Incorrectly accepted by types.
   ```

   Compiler probes reproduce this through Function, Script and Template, all four rendered LLM families, a function preparer, and their named calls. Runtime Function/Template/TextGenerator shorthand and run calls reject the closed-extra input before body/provider execution, matching native Zod parsing; the open-branch neighbor succeeds. A further source/runtime probe changes a configured open discriminator to the closed branch: a configured field declared only by the open branch survives the shallow merge, is accepted by the caller type and is rejected by the strict runtime branch. Closed-only schemas still reject the extra statically, and identified private names remain rejected even in the mixed union.

   The confirmed policy requires effective closed union branches to reject undeclared fields, including stripping shapes whose runtime removes them. An unrelated open alternative must not authorize extras for a discriminated closed alternative. Apply branch-specific admission to the effective merged input, retaining open/catchall value types and configured omissions. The correction belongs in the existing type check, not runtime parsing or provider strictness.

### Reverse consumer pass

| Surface | Result and evidence |
| :--- | :--- |
| Exports, configuration fragments, inheritance and original `.config` | Finding 1 identifies loss of whole-configuration alternatives. The selected runtime configuration still retains its schema and parsed value. Configuration compatibility and reserved-name/signal checks were traced separately. |
| Shorthand, named calls, source/history selection and callable inference | Finding 2 crosses all coded and rendered LLM families; new positive/negative probes distinguish mixed branches from the already-open valid argument-union restriction. Source/control normalization and immutable invocation snapshots remain enforced. |
| Declaration discovery, default selection, schema parsing, projection and private assembly | Rechecked runtime ownership and final parsed-value guards. Production generated/security suites pass. Conditional configured-private probes reject at runtime. No new runtime boundary bypass was reproduced. |
| Bare/bound descriptors, registry helpers, native callbacks, approvals and continuation | Finding 1 propagates into completed helper/output types. Native context validation and executable normalization remain owned by SDK utilities. Existing lifecycle/UI/next-request checks and binding guard mutations pass. Generic helper substitution remains a separate open gate. |
| Script/Template, loaded sources, function preparers and cancellation | Read actual engine/preparer construction and prepared-context consumption, with mock loader/cache, metadata and forwarding assertions. Prompt escaping remains deliberately disabled; standalone template escaping is configurable. The newer chain-resolution integration is still unverified. |
| Output validation, live/collected streams, result/history getters and utilities | Finding 1 concerns type inference, not a second parse or execution. Existing mixed stream/scalar, cleanup, completion-error and provider-adapter tests pass. A suspected undeclared iterable-union admission defect was ruled out: the plan explicitly assigns union-valued outputs to the runtime root check, which rejects before acquiring the iterator. Native tools retain their different preliminary/final-result protocol. |
| Distribution and public declarations | The linked engine still targets `C:\Projects\cascada`; this is not evidence of the selected chain-resolution handoff or a supported published consumer installation. Source/declaration probes expose both new defects. |

No additional runtime enforcement layer is justified by these findings. The architecture still benefits from one preparation path and native execution ownership. The actionable simplification is to make shared type extraction preserve alternatives consistently, rather than adding factory-specific exceptions. A subsequent complete pass after correction must retain the prior open gates; this is not a clean completion review.

### Verification

`npm run test:coverage` passes **1,645 mock tests**, with **99.33% statements/lines, 95.59% branches and 100% functions**, including the separate augmentation gate. The uncovered shared branches were inspected: they remain structural/native-precondition fallbacks rather than evidence of unchecked public success paths; no coverage exclusions or contrived invalid configuration were added. All **seven runtime fault mutations** are detected. New runtime probes exercise both configuration branches, the compiled helper crash, closed/open input neighbors, zero provider calls on invalid input, and undeclared-stream rejection before acquisition. The main compiler counterexamples pass in **six configurations**: TS7/TS6 source, emitted declarations, and emitted exact-optional checks. Passing demonstrates that the unsafe calls/result assumptions are currently accepted, while neighboring `@ts-expect-error` assertions still enforce closed-only/private-key rules. The additional shallow-merge/runtime probe also type-checks against source. The complete **`npm run test:types` passes**. No paid model calls were made, and no production code or permanent tests were changed in this review.

The test gap was an incomplete position-of-alternatives matrix: previous cases varied a schema-valued property and a uniformly closed or uniformly open input shape. They did not move absence to a whole configuration branch or mix open and closed discriminated branches. The review process now requires those distinct cases and an explicit per-branch guarantee before choosing a conditional-type test. Temporary probes are removed after verification; future corrections need permanent paired runtime/type regressions rather than assertions that institutionalize the current unsound types.

### Correction follow-up

Shared setting extraction and inherited-configuration normalization now preserve whole-configuration alternatives. Context discovery retains names present in any alternative while keeping fields optional when context may be absent. Results therefore include parsed and unparsed outcomes, and possibly present private bindings cannot disappear from caller validation. Optional annotated schema contracts retain their existing semantics.

Mixed open/closed schemas now check each effective merged input against a compatible complete branch. Open and catchall alternatives retain their extra-field behavior; closed alternatives reject extras statically, including stripping schemas. Configured fields surviving a discriminator override participate in the same check. Runtime parsing, merge order and SDK execution are unchanged.

Distributing inherited configuration exposed excessive generic expansion in `Config`'s broad parent constraint. The factory now infers the parent before applying that same shape constraint. Negative tests include a union with one invalid parent alternative: validating only its merged fragment would be insufficient. This changes inference order, not which parent settings are permitted.

Permanent regressions cover direct/named calls, reusable parents, bare/bound tool output and injected helpers, all rendered LLM families, function preparers, strict/stripping/open/catchall branches, configured discriminator changes and valid neighboring calls. The reverse consumer check also retained optional-context callback access, declared optional schemas, no-schema open calls and inherited callback inference. New editor assertions check narrowed result completion and diagnostics naming the rejected extra; four type mutations independently remove branch preservation and mixed-branch enforcement.

Verification: the full `npm run test:types` passes, including TS7/TS6 source, emitted declarations and exact optional-property checks. All four source/declaration editor configurations pass, and all **18 type mutations** are detected. `npm run test:coverage` passes **1,649 mock tests**, with **99.33% statements/lines, 95.59% branches and 100% functions**, including the separate augmentation gate. Final representative instantiation counts are **677,149 / 419,566** for TS7 and **436,351 / 275,385** for TS6 (production/baseline), within the 2× budget and below the preceding correction's counts. Lint passes for the changed production and TypeScript test files. No paid model calls were made.

The separate generic helper-substitution, valid open argument-union inference, selected chain-resolution runtime and published-consumer gates remain open. These two corrections do not establish whole-phase readiness.

## Union consumers and shared admission (2026-10-21)

This implementation review found **three new medium type-contract defects**, now fixed in the correction follow-up below. The original review made no production changes. The runtime counterexamples continue to reject private replacement before rendering or model dispatch; this pass did not reproduce a new model-controlled private-binding or confidentiality bypass. The previously reported generic helper-substitution question remains separate and unresolved.

### Method

The pass inventoried exports, configuration/inheritance, all factory modifiers, shorthand and named calls, tool descriptors/binding, registry helpers, prompt engines, output collection, native result augmentation and public utility consumers. It then compared the owners of each shared invariant across those consumers. New probes crossed unions with a different consumer, instead of only adding another concrete schema or direct-call example:

- One possible input branch introduces a private name; compare Function, renderer shorthand, coded run and LLM run.
- One possible output schema declares a stream while another declares a scalar; compare ordinary results, collected descriptor results and injected helpers.
- One schema needs unsupported ownership discovery; compare coded factories with every retiring LLM family, and source-free parsing with private-context partitioning.

Installed SDK `ToolLoopAgent`, tool/execute/schema types and implementations supplied native comparisons. No provider calls were made. The existing mock suite includes HTTP/SSE provider-adapter fixtures, real SDK approval/history/UI transport, generated production security cases and invocation-isolation checks; their assertions were inspected alongside the new probes. Existing accepted native limitations were not reclassified as Casai defects.

### Findings

1. **Mixed stream/non-stream output schemas expose the producer stream type after collection.** `CollectedResult` in `src/types/application.ts:194` tests the entire schema union against `StreamSchema`. If one alternative is an ordinary schema, it falls back to `ComponentResult` for both alternatives, retaining `AsyncIterable` even though tool execution collects the stream:

   ```ts
   function operation(streaming: boolean) {
     return create.Function.asTool({
       inputSchema: z.object({}),
       schema: streaming ? textStreamSchema() : z.number(),
       execute: () => streaming
         ? (async function* () { yield 'a'; yield 'b'; })()
         : 7,
     });
   }
   // Ordinary calls correctly produce AsyncIterable<string> | number.
   // SDK execute and registered helpers advertise that same union,
   // but actually return string | number.
   ```

   A registered Function body can narrow its helper result with `typeof value !== 'number'` and call `value[Symbol.asyncIterator]()`. This compiles and throws because the actual value is `'ab'`. The scalar alternative succeeds. Native completed-output inference retains `string | number`. The correction belongs in the shared collected-result type: distribute over schema alternatives before selecting their completed result. Keep ordinary producer results and runtime collection unchanged, and check descriptor callbacks as well as helper return types.

2. **Renderer shorthand and LLM run types miss private names present in only one argument-union branch.** `CheckApplication` in `src/types/application.ts:175` passes `keyof A` to its private-key check. That returns only keys common to all alternatives:

   ```ts
   type Input = { value: number } | { value: number; user: string };
   const render = create.Template({
     template: '{{ value }}',
     inputSchema: z.looseObject({ value: z.number() }),
     context: { user: 'private' },
   });
   function invoke(input: Input) {
     return render(input); // Accepted, including the possible private user key.
   }
   ```

   The same issue reproduces for Script and rendered TextGenerator shorthand and `TextGenerator.run({ context: input })`. Function shorthand and coded `.run()` reject the same union through their separate key-inference path. Runtime rejects the private branch with `Private input keys: user` before body/provider execution; the public-only neighbor succeeds. This is missing promised static protection, not a runtime privilege escalation. Enumerate possible supplied keys across alternatives in the shared check, while retaining whole-union complete-input validation and the schema's normal extra-field behavior.

3. **LLM factories omit the shared schema-admission gate.** `ValidateGenerateTextConfig`, `ValidateStreamTextConfig` and `ValidateObjectConfig` in `src/types/config-validation.ts` do not apply `ComponentAdmission`; the function-preparer check in `src/types/function-prompt.ts:37` checks raw context shape and callback compatibility but does not establish declaration capability. Consequently a Zod 3 intersection plus unrelated private context is admitted by TextGenerator, TextStreamer, ObjectGenerator and ObjectStreamer, although every invocation rejects during partitioning before provider dispatch. Text template, script and function preparers reproduce the issue. Function and Template already reject the same unsupported definition at construction-time type checking.

   The intersection parses ordinary application values successfully, both natively and in a source-free Casai renderer. A declared object schema with the same private configuration also succeeds. Thus the fix is not a general intersection ban or a parser change: apply the existing capability check at every factory boundary that actually prepares application context. The omission also admits `TextGenerator.asTool({ ..., toolContextSchema: z.string() })`, whose typed native execution rejects the non-object parsed context before model dispatch. Include ordinary rendered paths and tool forms, preserve native tools' separate context contract, and leave literal ordinary calls' scope unchanged.

### Correction follow-up (2026-10-21)

The three findings above are corrected in the shared type owners. `CollectedResult` distributes over each schema alternative, including the corresponding non-stream fallback. `CheckApplication` enumerates all possible supplied keys. The three LLM configuration validators now invoke the existing `ComponentAdmission` for rendered and tool forms, leaving literal ordinary calls outside that application-context check. No runtime pipeline, schema, merge rule or adapter changed.

Permanent compiler regressions cover all four LLM families, template/script/function preparers, loaded sources, generator tool forms and inheritance. They pair unsupported partitioning with source-free parsing, declared objects, explicit metadata and executor-free registry entries. Mixed text/element/scalar result types are checked through ordinary calls, descriptors, binding, callbacks and injected helpers. Runtime regressions exercise both actual output alternatives, real SDK generate/stream conversion and subsequent requests, private rejection before provider dispatch, and native scalar context versus Casai object context. The production mutation runner independently reverses each correction.

The valid-neighbor checks uncovered a **separate existing Function argument-inference restriction**, which the user asked to investigate:

```ts
declare const input: { value: number } | { value: number; extra: string };
const operation = create.Function({
  inputSchema: z.looseObject({ value: z.number() }),
  execute: ({ value }) => value,
});
operation(input); // Rejected, although both alternatives are valid at runtime.
```

The key-inference path in `CallValue` requires every possibly supplied key through `Pick<I, Extract<K, keyof I>>`. That makes the branch-only `extra` key required. Function shorthand, coded run and injected helpers share this restriction; renderer shorthand accepts the valid union. This is over-restrictive typing, not a runtime private-boundary bypass.

Two minimal relaxations were tested and **reverted**. Removing the `Pick` check admits a union containing a string extra against a numeric catchall. Making it `Partial` still admits an explicit-undefined extra and rejects valid unions with disjoint numeric catchall keys. The generic argument can be inferred from a narrower alternative, so simply weakening the key constraint loses value information. A correction needs a focused inference proof covering whole argument unions, independently captured keys, configured omissions, catchall value types, private rejection and callback contextual typing. First explore whether the renderer's argument-inference approach can be reused, rather than adding another exceptional key check; that reuse is not yet proven. The existing checks remain in production. Compiler characterization cases are explicitly marked as a known restriction, with runtime tests confirming that the valid branches work; those expected errors do not redefine the intended API contract. This investigation is separate from the earlier unresolved generic helper-substitution gate.

Verification: the complete `npm run test:types` passes against source and emitted declarations with TS7/TS6 and exact optional-property checks. The production editor matrix passes in all four source/declaration and optional-property combinations, including the new mixed-result completion and named union-key/admission diagnostics. `npm run test:coverage` passes **1,645 mock tests** with **99.33% statements/lines, 95.59% branches and 100% functions**. All **14 type mutations** and **seven runtime mutations** are caught. Representative instantiation counts remain below the 2× budget: TS7 **690,555 / 419,566** and TS6 **448,169 / 275,385** (production/baseline). Whole-repository lint passes with `node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js src tests`; the default 4 GB invocation exhausted its heap. This follow-up closes the three reported defects, not the remaining inference or upstream-runtime gates.

### Original reverse consumer pass

| Surface and owner | Evidence and disposition |
| :--- | :--- |
| Config/inheritance, schema/context declarations, original Function config | Read merge, provisional/contextual types, validation and factory entry points; existing absence/descriptor fixes remain present. No additional configuration change proposed. |
| Ordinary/shorthand/run calls and source selection | Traced argument normalization, settings snapshots and prepared entry. Finding 2 identifies a differing type consumer; actual private rejection and zero provider requests are asserted. |
| Input declaration discovery, defaults, parsing, projection and private assembly | Read `schema.ts` and `execution.ts`, including lazy preparation and actual-context final checks. Existing production generated and native-parser cases pass. Finding 3 identifies missing factory admission, not a weakened runtime check. |
| Binding/registries, native hooks, approval, history and errors | Rechecked descriptor/context pairing and native execution ownership. Existing tests assert approval-time parsed values, body counts, safe errors, actual continuation requests and absence of sentinels from UI/history/requests. Generic helper substitution remains an earlier open gate. |
| Script/Template, loaded sources and all LLM preparation modes | Traced engine construction/caching, prepared-context consumption and explicit cancellation forwarding. New partition probes cover all four LLM families. Object preparation registries remain deferred. |
| Outputs, stream utilities, callbacks and downstream helpers | Read collection, lazy parsing/cleanup, native result augmentation and delivery types. Finding 1 is a new mixed-output consumer error; concrete stream/scalar tests alone do not detect it. |
| Packaging and selected runtime | The installed engine remains a junction to `C:\Projects\cascada`. The selected chain-resolution compiler handoff and distributable-engine gate are not closed by this review or the local linked tests. |

The reverse pass retains all three findings and the earlier helper-substitution/upstream gates. It is not a clean completion pass. The simplest corrections reuse the existing type owners; no new runtime adapter, schema, provenance tracker, freezing or proxy is warranted by these findings.

### Verification and next checks

`npm run test:coverage` passes **1,638 tests**, with **99.33% statements/lines, 95.59% branches and 100% functions**; the separate augmentation threshold also passes. Remaining uncovered paths are chiefly native/structural precondition and defensive error branches, including the unsupported-renderer fallback introduced by the switch; no invalid production calls or coverage exclusions were added to reach them. The production fault runner catches all **seven** existing runtime mutations, covering defaults, private guards, parsed-value consumption, metadata authority, keyword normalization, snapshots and step-context stability.

The new temporary probes execute the three counterexamples with valid neighbors and native comparisons. The same public calls compile with TS7 and TS6 against source and emitted declarations, including emitted consumers with exact optional properties: **six successful compiler configurations**, with no casts hiding the findings or unrelated diagnostics. Compiler negatives confirm that the existing Function/coded-run guards and coded-factory admission reject their corresponding cases. The complete `npm run test:types` suite also passes. Temporary probes/logs were removed. Production files and permanent regression tests are unchanged; fixes must add paired compiler/runtime regressions, verify source/emitted declarations and both optional modes, and repeat the complete consumer pass.

Earlier reviews checked conditional schema presence and each concrete output kind, but not mixed schema kinds after tool collection. The union-key check was tested through Function/coded run and nested registry maps, without carrying the same value through renderer shorthand and LLM run. Capability checks were proven in the shared/coded implementation without proving that every LLM factory actually invoked them. The review process now explicitly requires these cross-consumer checks.

## Absence, conditional schemas and descriptor consumers (2026-10-20)

This further implementation review found **three new medium typing issues**. They are separate from the unresolved generic helper-substitution cases below. The shared runtime still rejects incomplete application input and protects private bindings; no new model-controlled private replacement or disclosure was reproduced.

### Strategy

The pass first traced exports/modifiers to their runtime and type owners, then varied facts that disappear before a consumer runs: an omitted argument, a schema that may be absent, and a callback inherited after its context contract changes. For each case it compared a rejected or failing expression with a valid neighbor. Compiler probes used actual public factory calls and downstream operations, not only assignability of internal types. Descriptor callbacks were compared with the installed SDK's `Tool` and native `tool()` inference. Runtime probes used real renderers and mock SDK execution, including assertions that preparation failures made zero provider requests.

This adds an absence/consumer check to the prior feature and substitution matrices. A guard expressed only in an optional argument cannot validate a call that supplies no argument. A conditional schema requires separate raw and parsed possibilities. A list of selected SDK callbacks can silently omit a callback that lives on a shared configuration base.

### Findings

1. **Conditional schemas produce unsound implementation and result types.** `ComponentResult` in `src/types/application.ts:187` checks the entire `schema | undefined` union against `Schema`; when that fails it uses the producer's raw return type. The runtime correctly applies the schema when present:

   ```ts
   declare const enabled: boolean;
   const schema = enabled ? z.string().transform(value => value.length) : undefined;
   const component = create.Function({ schema, execute: () => 'hello' });
   const result: string = await component(); // Accepted.
   result.toUpperCase(); // Throws when enabled: the actual result is 5.
   ```

   The same mismatch reaches `.run()`, `.asTool.execute()` and the result of an injected registered helper. The inverse input problem also reproduces: with a present `inputSchema` property whose value is `z.object({ value: z.string().transform(Number) }) | undefined`, the body infers `value` as a number even when the schema is absent and receives a raw string. A body calling `value.toFixed(1)` compiles and throws. `Output<S>` discards the absent branch instead of representing that execution possibility.

   These probes use required configuration properties with explicitly conditional values, not an optional property in a reusable annotated schema contract. Definite-schema and definite-undefined controls behave correctly. Preserve the conditional alternatives through producer/body/result typing; do not change runtime parsing or force an extra parse.

2. **Omitted renderer input bypasses the complete-input type check for union-valued defaults.** `CallShape` deliberately uses `Partial<I>` for alternative configured contexts, relying on a later effective-input check. `ContextArguments`, `RendererArguments` and `RunContext` in `src/types/input.ts:7` decide whether arguments are optional from that preliminary shape alone. `ComponentCall` cannot enforce a constraint on an optional parameter that is omitted; LLM run validation checks effective input only when the supplied settings contain `context`.

   ```ts
   declare const context: { a: number } | { b: number };
   const inputSchema = z.object({ a: z.number(), b: z.number() });
   const script = create.Script({ context, inputSchema, script: 'return a + b' });
   await script(); // Accepted, although neither configured branch is complete.
   ```

   The same omission compiles for Template and rendered TextGenerator/TextStreamer/ObjectGenerator shorthand calls, and for rendered LLM `.run({})`, including function preparers. Ten actual calls in the probe fail application validation before rendering/provider dispatch. Supplying `{ a: 2, b: 3 }` succeeds; explicit empty context is already rejected. Function shorthand/run, function-preparer shorthand and coded Script/Template `.run({})` correctly reject omission. Use the shared effective-input proof to decide whether an argument may be omitted; retain the preliminary shape for inference/completion.

3. **`description` is missing from schema-aware descriptor callback inference and compatibility checks.** `ToolProperties` in `src/types/config.ts:170` and the callback lists in `src/types/callbacks.ts:12` omit it. Function configuration instead inherits `BaseConfig.description` from a generic `Tool` whose context is erased. A valid inline description receives an implicit-any diagnostic, and annotating a reusable description still does not protect it against incompatible inherited schema replacement:

   ```ts
   const parent = create.Function.asTool({
     inputSchema: z.object({}),
     toolContextSchema: z.object({ tenant: z.string() }),
     description: ({ context }: { context: { tenant: string } }) =>
       context.tenant.toUpperCase(),
     execute: () => 'ok',
   });
   const child = create.Function.asTool({
     toolContextSchema: z.object({ tenant: z.number() }),
   }, parent); // Accepted while retaining the string-dependent description.
   ```

   Native ToolLoopAgent with `child` and `{ tenant: 3 }` throws before its first provider call. The parent succeeds. Native `tool()` contextualizes the string field and rejects the equivalent descriptor/schema replacement. Both schemas in this comparison are untransformed, so the documented native raw-context description limitation is not involved. Include this SDK property in the existing descriptor inference/checking owner; do not wrap or change native callback execution.

### Reverse consumer pass and evidence

| Surface | Result of this pass |
| :--- | :--- |
| Config, inheritance, factory modifiers and shorthand/run requirements | Traced final configuration and callback ownership. Findings 1 and 2 expose conditional/omitted values; finding 3 exposes an inherited descriptor callback. Existing fixed-setting and source-snapshot corrections remain intact. |
| Application preparation, schema discovery/projection and private isolation | Read `execution.ts`/`schema.ts` and their consumers; reran generated production ownership/forwarding, native schema, error transport and lifecycle tests. No new runtime boundary failure reproduced. Bounded discovery and accepted absent-name/native-parser limits remain unchanged. |
| Tool registration, binding and SDK lifecycle | Traced `prepareRegistry`, `defineTool`, native context validation and `executeTool`. Original/changed description behavior compared through native ToolLoopAgent. The earlier raw-helper/union-default/private-reservation substitution questions remain open. |
| Script/Template engines, all four retiring LLM families and prompt renderers | Traced source loading, prepared-context handoff, dispatch, signals and native result selection. Real renderer probes distinguish omitted arguments from explicit empty/complete input. Object preparation registries remain deferred. |
| Outputs, streams, callbacks and downstream consumers | Read augmentation/collection/conversion owners; reran result, provider-adapter, lazy-element, cancellation/cleanup and history/UI tests. Finding 1 is a type disagreement with correct parsing, rather than a runtime output-conversion defect. |
| Public types and SDK comparison | Concrete unsafe calls compile while runtime operations fail; valid neighbors and expected compiler negatives distinguish the missing checks. Description inference/compatibility is compared directly with native `tool()`. |
| Packaging and selected runtime integration | Previously documented published-engine and chain-resolution compiler/renderer gates remain open. A linked engine and passing local tests do not establish distribution readiness. |

`npm run test:coverage` passes **1,634 tests**, with **99.37% lines/statements, 100% functions and 95.59% branches**; both coverage gates pass. The focused counterexamples and valid neighbors compile with TS7 and TS6 against source, and against built declarations with both optional-property modes. Expected compiler errors verify the already-correct neighboring boundaries and native description checks. The unsafe expressions themselves need no casts or suppressed diagnostics. All runtime counterexamples also reproduce against both source and the built package.

`npm run test:types` passes its complete source/build/declaration matrix. Temporary probes were removed after recording the reproductions; no paid model calls were made. The standard suite's success demonstrates that the existing regression set does not detect these additional contracts, rather than invalidating the counterexamples.

No production behavior or API has been changed in this review. These findings need paired compiler regressions and runtime neighbors when corrected. Existing passing mutation checks concern the guards they mutate; they do not establish the three newly missing type contracts. Whole-phase signoff remains withheld pending these corrections, the earlier substitution question, the external gates and the required subsequent complete pass.

### Corrections and inference follow-up

The initial authorized correction made two small type changes, with no runtime merge or parsing changes:

- `ComponentResult` distributes over a conditional output schema. Function shorthand/run, tool execution and registered-helper results include both the producer's raw result and the schema's parsed result when the schema may be absent.
- Renderer shorthand and LLM run types use the existing complete-input proof to decide whether context may be omitted. The preliminary `CallShape` remains available for inference. Incomplete configured alternatives require input; complete alternatives and repaired inherited defaults still allow omission.

The new `type-safety/conditional-contracts.ts` checks these cases, their valid neighbors and inherited configurations. Two runtime regressions in `Phase2.integration.test.ts` exercise both output-schema branches and both incomplete configured alternatives. The production type-mutation fixture independently removes each correction.

**The conditional-input contract is confirmed.** A conditional input schema changes ownership as well as parsing: with configured `{ value: '5' }`, a present schema declaring `value` allows `{ value: '7' }`, while an absent schema makes `value` private and rejects the override. Omitting input succeeds in both cases, producing a number or string respectively. A conservative conditional-component type must account for both allowed-call contracts and both execution contexts; simply unioning parsed/raw result fields does not cover this case. The user confirmed retaining conditional schemas: calls must be safe in both alternatives, and bodies/results must represent both raw and parsed possibilities. Branch-specific calls remain available when schema presence is statically known at construction. Optional properties in annotated configuration contracts retain their existing interpretation.

The first follow-up found an inference obstacle: the optional `inputSchema?: TInputSchema` inference slot drops `undefined` from a supplied conditional schema. A focused Function probe inferred the inline callback as receiving only the parsed number; after adding the raw execution alternative, final compatibility checking rejected that valid callback. Changing only the execution union or recovering `undefined` from the completed configuration did not repair contextual inference. That incomplete attempt was removed and work paused for discussion.

After the user authorized exploration, isolated probes compared whole-setting inference, required/optional parameter unions and specialized call signatures. Whole-setting inference regressed conditional spreads or fragment validation; parameter unions did not preserve the needed contextual inference through real factories. Specializing schema/context presence before call inference works with the existing declaration and validation machinery. Each generic signature is defined once and intersected in its required/optional forms, replacing duplicated overload declarations. The integrated change removes roughly 150 lines of source declarations and adds no runtime path or public API.

`ApplicationInput` checks the defined schema alternative, private-name checks retain configured names when absence is possible, and execution contexts include raw and parsed alternatives. The absent branch does not invent schema defaults or transformed fields. Conditional output producers must still satisfy the schema's raw input when that schema is present. The ordinary Function, Config and four function-preparer factory signatures preserve the conditional value during contextual inference; already-required tool input schemas keep their existing signatures.

Descriptions now participate in the existing native descriptor callback inference and inherited compatibility checks. Their type comes from SDK `Tool`, with no Casai callback wrapper. Provisional shapes defer the context-dependent description type until configuration is resolved; final validation still checks native property and return types. Redundant return-alias constraints and competing base-interface description declarations were removed. Native raw-context behavior for descriptions remains unchanged.

The exact-optional consumer checks also required explicit `undefined` in ordinary input-schema settings and removal of tool-only schema requiredness from reusable fragment shapes. Finished tool descriptors still require a definite schema. Description settings retain the former SDK-indexed optional-property type, including explicit `undefined`; selecting the SDK property with `Pick` alone had narrowed that existing contract under exact optional properties. These are declaration corrections, not changes to runtime validation or configuration merging.

New public consumer fixtures cover direct/run calls, inherited fragments, configured omission, private collisions, defaults, renamed transforms, optional annotations, all preparer families, inline description inference and incompatible inherited description reuse. Editor checks and independent type mutations exercise the exported signatures. Runtime neighbors execute both conditional branches, ordinary/configured/inherited calls, prompt preparation and actual SDK description resolution.

Before this inference follow-up, the retained corrections passed `npm run test:types`, all **17** production integration tests, and lint for the changed source/test files. The fixture also passed emitted-declaration checks in the default optional mode and exact-optional mode with both compilers. All **eight** type mutations were detected. That compiler-cost workload used **596,274 / 419,566** TS7 and **434,323 / 275,385** TS6 production/baseline instantiations, within the 2x budget. Runtime execution bodies were not changed by either correction.

**Follow-up verification:** full source and API-fixture checks passed with TS7 and TS6, followed by build and default package-consumer checking. The initial strict-optional run exposed the shape mismatches described above; after correcting them and rebuilding, the complete emitted strict-optional suite passed with both compilers. The new conditional-input and description fixtures additionally passed final source checks and emitted checks in both optional modes with both compilers. Editor completion, quick info and named diagnostics passed against source and declarations in both optional modes. Changed-source/test lint and whitespace checks passed.

All **19** production integration tests pass. The fault runners detect **seven runtime mutations** and **11 type mutations**. The final representative compiler workload uses **690,371 / 419,566** TS7 and **447,948 / 275,385** TS6 production/baseline instantiations, within the 2x bound. Temporary exploration files were removed; no paid model calls were made. These three review findings are corrected. The separate generic registered-helper substitution question, external packaging/runtime gates and subsequent complete review remain open; this is not whole-phase signoff.

## Implementation-contract review (2026-10-20)

This pass applies `review-process.md` to the integrated implementation, including the five corrections recorded below. It starts from exports, factory dispatch, schema/preparation owners and downstream consumers, then compares those paths with the plan and native SDK implementation. It found **three medium typing issues**; the correction pass below fixes the private-binding mismatch and the reproduced loss of default guarantees, while broader helper substitution remains open. None demonstrates a model-controlled private-binding bypass. The shared runtime preparation architecture remains appropriate.

### New findings

1. **Registry context bypasses the compatibility check enforced by explicit binding.** `RawContext` in `src/types/application.ts` becomes `object | undefined` for a Casai tool without `toolContextSchema`. `RegistryCheck`, `ToolContexts` and `ValidateToolsContext` consequently accept an incoming private property of the wrong type. For example:

   ```ts
   const action = create.Function.asTool({
     inputSchema: z.object({}),
     context: { db: () => 'trusted' },
     execute: ({ db }) => db(),
   });
   action.bindToolContext({ db: 'wrong' }); // Correctly rejected by TypeScript.
   const owner = create.Function({
     tools: { action },
     toolsContext: { action: { db: 'wrong' } }, // Incorrectly accepted.
     execute: ({ action }) => action({}),
   });
   await owner(); // TypeError: db is not a function.
   ```

   A configured owner without that override also accepts `owner.run({ toolsContext: { action: { db: 'wrong' } } })` and fails identically. A callable replacement succeeds. Explicit binding already checks that the assembled execution context remains compatible with the implementation; internal registration should retain that same check when the original Casai configuration is available. This requires no new runtime schema or restriction on native SDK tools whose context information has been erased. It is a type-safety defect in an application-owned channel, not permission for model arguments to replace `db`.

2. **Context overrides and inheritance can remove defaults that an existing helper contract relies on.** `Helper` correctly makes input optional when the owner's captured `toolsContext` supplies it, but override validation checks only the child's raw context contract. It does not preserve the default guarantees used to type the existing body:

   ```ts
   const action = create.Function.asTool({
     inputSchema: z.object({ value: z.number() }),
     execute: ({ value }) => value,
   });
   const owner = create.Function({
     tools: { action }, toolsContext: { action: { value: 4 } },
     execute: ({ action }) => action({}),
   });
   await owner(); // 4
   await owner.run({ toolsContext: { action: {} } }); // Compiles; validation fails.
   ```

   Whole-entry replacement is the intended runtime merge rule. Restoring the old default would therefore be the wrong fix. The same failure compiles through `create.Function({ toolsContext: { action: {} } }, owner)` with the inherited body, and through a TextGenerator `.withFunction` preparer followed by the equivalent `.run()` override. Preserve the input/default guarantees consumed by the retained body or preparer when checking substitution. A generic callable-assignability check alone is not sufficient evidence: the current final-factory compatibility check already accepts the inherited counterexample. Replacing `value` with another valid number is a valid neighbor; a newly supplied body may establish a different helper contract.

3. **LLM tool replacement compares parsed SDK input while retained preparers call raw Casai input.** `TextRunConfig` in `src/types/config.ts:223` admits a replacement through `Tool<InferToolInput<...>, ...>`. A Casai tool with raw `{ value: string }` transformed to `{ value: number }` and another with raw `{ value: number }` therefore look compatible at that boundary. With matching `toolContextSchema` types, this compiles:

   ```ts
   // fromText parses { value: string } into { value: number }.
   // fromNumber accepts { value: number }; both return number.
   const owner = create.TextGenerator.withFunction({
     model, tools: { action: fromText }, toolsContext: { action: { factor: 1 } },
     prompt: async ({ action }) => String(await action({ value: '4' })),
   });
   await owner.run({ tools: { action: fromNumber } }); // Compiles; preparation fails.
   ```

   The original run succeeds; the replacement rejects the existing preparer's string input before any model call. Each tool succeeds independently in native ToolLoopAgent with its own valid raw arguments, returning `4`. This is a Casai helper-substitution mismatch, not an SDK parsing bug. Both original schemas are available on the Casai components, so the accepted limitation for erased native schemas does not explain it. Check the raw helper contract as well as the SDK descriptor contract when retaining a coded preparer; preserve the native-only replacement behavior where no coded helper depends on it.

The six concrete failures above compile with TS7 and TS6 against source and emitted declarations, including exact-optional declaration consumers. They reproduce without unsafe-input casts; the intentionally invalid explicit `bindToolContext` call is marked as an expected compiler error to demonstrate the existing stronger boundary. Successful neighboring calls establish that the failures arise from substitution rather than a broken initial component.

### Surface ledger and native comparisons

| Boundary | Implementation and exercised consumer | Result |
| :--- | :--- | :--- |
| Exports, Config, inheritance, factory overloads and modifiers | `index.ts`, all factory creators, configuration validators and merged public signatures; ordinary calls, `.run()`, inline/named sources and `.asTool` | Existing entry-path corrections hold. Inherited helper assumptions expose finding 2. Retiring Object factories still deliberately lack preparation registries. |
| Application input and private bindings | `schema.ts`, `preparation.parse/assemble`, direct and prepared execution; generated ownership/forwarding cases, open/strict/stripping schemas and transformations | No additional private replacement or public-transport leak reproduced. Actual/declared-name protection and accepted absent-name authoring limits remain distinct. |
| Schema capabilities and projection | Public Zod declarations, SDK/Standard normalization, lazy metadata, required-field relaxation, configured annotations and reference rejection | Existing declaration/projection cases pass. Bounded composition, native default/readonly behavior and metadata-only local-validation limitations remain accepted. |
| Registries, helper consumers and binding | `prepareRegistry`, `defineTool`, `Helper`, context validation and raw/parsed descriptor types; Function bodies, inherited bodies and function preparers | Findings 1–3. Runtime selects the requested context/tool correctly; the accepted public types fail to preserve the consumer's contract. |
| Native SDK tool lifecycle | Installed ToolLoopAgent, `parse-tool-call`, `validate-tool-context`, `execute-tool-call` and provider-utils `executeTool`; native comparisons plus approval/history/UI/error tests | Native parsing, preliminary/final results and independent context boundaries remain delegated. Undefined/equivalent/replaced step-context regressions pass. |
| Renderers, source ownership and cancellation | Coded call/run normalizers, direct prepared engines, loaded resources, prompt renderers and SDK dispatch | Keyword settings and asynchronous source snapshots pass through real renderers. Explicit cooperative signal forwarding remains intact; no automatic propagation or legacy-runtime patch was added. |
| Output, streams and final consumers | Output parsing, lazy element validation, root tool collection, readable conversion and native result augmentation; response helpers, failures, early close and shared-source disposal | Existing tests pass, including provider-adapter HTTP/SSE fixtures and stream failure cases. Native replay and completion limitations remain documented. |
| Public compiler behavior | Source/declaration callers, known Casai raw schemas, merged context/default guarantees and native descriptor substitutions | New probes reveal six accepted failing calls grouped into three findings. Existing compiler fixtures alone do not detect these contracts. |
| Distribution and runtime handoff | Dependency manifest and engine link | Link still points to `C:\Projects\cascada`. The selected newer compiler/renderer integration and a distributable engine exporting `makeSharedIterable` remain the previously recorded external gates; local coverage does not close them. |

The main architectural improvement is to give known Casai registry substitutions one compatibility owner: context compatibility, guaranteed public defaults, raw helper inputs and native descriptor inputs serve different consumers and must survive together. Reuse the retained configuration and schemas; do not add another author-written schema, runtime freeze/proxy, origin tracking or a second execution pipeline.

There is also a small, nonblocking simplification in `llm-component.ts`: `.run()` merges configuration for call validation and then `invoke()` merges it again; shorthand calls extract the same argument tuple inside validation and again for invocation. A later focused cleanup can resolve once and validate/dispatch those facts, preserving error timing and snapshot behavior. This pass found no behavioral failure attributable to that duplication.

### Verification and disposition

`npm run test:coverage` passes **1,632 tests**, with **99.37% lines/statements, 100% functions and 95.50% branches**; both coverage gates pass. All seven existing production runtime mutations are detected. Those mutations verify the earlier protections, not the three newly missing substitution checks. The targeted probe asserts all six failing calls and their successful neighbors, with native ToolLoopAgent comparisons for the differing raw schemas.

`npm run test:types` also passes: TS7/TS6 source checks and source safety suites, the production build, emitted-declaration checks and both exact-optional suites. The separate new probe passes both compilers against source and emitted declarations, with exact-optional declaration checks too; that success demonstrates the missing diagnostics for its runtime-failing calls. No production code was changed in this review. Temporary probes were removed after verification; the counterexamples above retain their essential public call shapes. No paid model calls were made.

The reverse consumer pass confirms that the new findings share a registry/type boundary, rather than requiring a runtime architecture replacement. They were unresolved at the end of the review; the correction status follows below. A correction must add compiler negatives with valid substitution neighbors, run them through source/emitted declarations and both optional-property modes, then repeat the complete consumer pass. The external runtime/distribution gates remain open independently.

### Correction pass and remaining design question

The clear corrections are shared type changes; runtime merging and validation are unchanged:

- Internal registry binding now reuses the compatibility check from `bindToolContext`. Constructors, reusable Config fragments, renderers and `.run()` reject known private dependencies with incompatible types. No additional runtime schema is introduced.
- An unschematized Function's final execution-context type now removes injected fields from the old callback parameter before adding the final helpers and execution options. Previously, intersecting the two helper signatures retained the obsolete overload. The reproduced inherited missing-default call is now rejected, including spreading `owner.config` into a fresh factory and explicitly reusing `owner.config.execute`. A newly supplied callback can use the replacement registry.
- Coded and LLM `.run()` compare the injected helper signatures as well as validating the context map. This rejects removing the reproduced required default and removing an executor that a preparer is entitled to call. Native scalar/array helpers, valid replacement values, helper shadowing and registries used only by the model remain supported.

The inherited counterexample originally attributed to generic function comparison also involved the stale context intersection. An isolated comparison of its helper types rejects the missing-default replacement correctly. Inspecting that composition eliminated a larger experimental source/default interpreter; it was not retained.

**The general helper-substitution proof is still open.** Separate probes confirm that generic callable assignability does not reject all changes to raw schema input, union defaults or private-name admission. The string-to-number versus number-only case in finding 3 remains accepted. Further examples are:

```ts
// The original helper allows { a: 3 } using its bound kind: 'a'.
// After replacement, kind: 'b' and b remain while the old call supplies a.
branchOwner.run({ toolsContext: {
  action: { kind: 'b', b: 'other' },
} });

// The original open helper permits { value: 3, tenant: 'application field' }.
// A new private tenant binding makes that existing call fail at runtime.
openOwner.run({ toolsContext: {
  action: { tenant: 'private' },
} });
```

Here `action` in the first owner has input `z.union([z.strictObject({ kind: z.literal('a'), a: z.number() }), z.strictObject({ kind: z.literal('b'), b: z.string() })])` and initial bound context `{ kind: 'a', a: 1 }`. In the second it has input `z.looseObject({ value: z.number() })` and initially no private `tenant`. These are incompatible trusted substitutions that can make retained code fail; the runtime still rejects the invalid application input/private collision.

Before adding more type machinery, the user was asked whether to preserve context-dependent helper omission and prove an explicit internal type contract, or explore simpler helper argument rules. The user requested an explanation before deciding and prefers retaining as much type information as possible. Simpler helper argument rules would change the agreed API and would not by themselves solve raw-input variance. Neither API change nor a compile-time marker has been implemented. The original omission behavior is retained. The fixes above do not constitute closure of finding 3 or of every variant of finding 2.

Regression coverage is in `tests/type-safety/registry-substitution.ts`, the production editor/type-mutation fixtures and `tests/Registry.unit.test.ts`. `npm run test:types` and `npm run lint` pass. The registry file passes **21 tests**. The editor fixture passes against source and emitted declarations in both optional-property modes; the new compiler fixture additionally passes against emitted declarations in the default optional mode with TS7 and TS6. All **six type mutations** are detected, including removal of the shared binding check, run-helper comparison and stale-signature correction. The unchanged workload uses **583,034 / 419,566** TS7 and **421,184 / 275,385** TS6 production/baseline instantiations, within the 2x budget.

An additional exploratory compile of the implementation source with `exactOptionalPropertyTypes: true` fails in unchanged source such as `call-arguments.ts`; this is not the repository's configured source-build mode. Exact-optional consumer verification uses emitted declarations, plus editor checks of the consuming source file. No full-source exact-optional build success is claimed. No paid model calls or runtime execution changes were made in this correction pass.

## Post-integration review (2026-10-20)

This review evaluates the integrated source, rather than treating the earlier prototypes or passing integration suite as sufficient evidence. It identified **five medium findings**, corrected in the follow-up below. The shared preparation architecture does not need replacement. The existing upstream compiler/runtime and published-package gates remain open. This section supersedes the earlier implementation pass's no-additional-mismatch conclusion.

### Findings before correction

1. **Injected helper result inference uses the wrong result contract.** `Helper` in `src/types/application.ts` derives every Casai tool result from `CollectedResult<Config>`. That handles Function/Script outputs, but a Template or TextGenerator helper becomes `unknown`, and an ObjectGenerator with `output: 'array'` becomes one schema element instead of an array. Enum ObjectGenerator and custom-output TextGenerator helpers also become `unknown`. For an array schema `{ x: number }`, `(await arrayTool({})).x.toFixed()` compiles but throws on the actual `[{ x: 2 }]` result. The native descriptor already has the correct completed output type. Reuse that result type while retaining Casai's raw-input and configured-omission machinery, rather than adding a second factory-kind result interpreter.

   The incorrect inference reproduces in Function bodies, `.withFunction` preparers and reusable Config callbacks. TS7 and TS6 reproduce it through source and emitted declarations; emitted checks cover both optional-property modes. The unsafe array expression compiles in those supported configurations and fails against a mock model at runtime. Native `InferToolOutput<typeof arrayTool>` correctly accepts an array, and the Function stream helper retains its correct collected array type.

2. **Cascada keyword calls to coded `.run()` are not normalized.** Function, Script and Template pass their `.run()` parameter directly to `runSettings`, whereas shorthand calls use `namedArguments`. Consequently `child.run(context={"value": 3})` fails with `Unknown run settings: __hasKeywordArgs`. This reproduces for all three child families from both real Script and Template renderers. `child(value=3)` and `child.run(settings)` with an ordinary settings object succeed. Normalize the coded settings envelope before checking its allowed keys, retaining rejection of genuinely unknown settings and mixed/extra positional arguments.

3. **The fixed-context guard rejects the SDK's unchanged-context result.** `src/llm-component.ts` calls `registry.assertContext` whenever a `prepareStep` result owns `toolsContext`; `assertContext` then treats `undefined` as an empty map. With a nonempty captured Casai binding, `prepareStep: () => ({ toolsContext: undefined })` therefore fails before tool execution. Both native generation and streaming instead use `prepareStepResult?.toolsContext ?? toolsContext`. Native ToolLoopAgent executes the same bound tool successfully in both modes. Check effective replacements only; an explicit undefined must retain the selected map. Existing rejection of a genuinely changed bound entry must remain.

4. **Coded `.run()` does not type-check the effective tool-context map.** `ApplicationRun` accepts `Partial<ToolContexts<...>>` without validating the inferred override map. With the default `exactOptionalPropertyTypes: false`, `{ toolsContext: { child: undefined } }` compiles even when the child's context schema requires an object; invocation then fails with `Tool context validation failed`. In either optional mode, a variable containing a valid child entry plus an unknown `typo` entry compiles and fails at runtime with `Unknown toolsContext entries: typo`. The existing LLM `.run()` checker and its compiler regressions already reject these cases. Reuse the effective-map/name validation principle for coded calls, preserving legitimate partial updates and explicit undefined for schemas that accept it.

   Both compiler versions reproduce the emitted-consumer cases, and the default source check also accepts the invalid overrides. Exact optional mode rejects the required-entry clearing but still accepts the unknown entry through a variable. Configured context and an optional-context schema are successful runtime neighbors. These are missing caller diagnostics; the runtime boundary still rejects the invalid map.

5. **Script/Template `.run()` retains the caller's settings object across preparation.** `runSettings` returns its original object. The factories validate the source, await `prepareExecution`, then reread `settings.script` or `settings.template`. If the caller edits/reuses that object while validation is pending, the already-entered invocation executes the later source. Both real renderers reproduce this with a schema that awaits a test barrier: a call entered with `selected` executes `later-mutation`. This differs from the LLM invocation's existing top-level settings snapshot. Capture the settings/source before the first await; a shallow snapshot is sufficient, with no nested cloning, freezing or proxy.

### Surface and evidence

| Boundary reviewed | Evidence and disposition |
| :--- | :--- |
| Exports, factories/modifiers, ordinary calls, inherited configuration and `.config` | Traced to configuration validation, shared preparation and original implementation/source ownership. Retained current LLM forms and deferred Object preparer registries. |
| Input declarations, defaults, transforms and private ownership | Read the production schema/preparation owners and paired type rules. Focused production security checks exercise generated ownership cases, forwarding and actual SDK publication. No new model-controlled private-binding bypass was reproduced. |
| Bare/bound descriptors, registries and SDK lifecycle | Traced native normalization, context execution, native preliminary results and step-context replacement. Finding 3 is a native-semantics mismatch; external pairing/approval-history responsibilities remain documented host contracts. |
| Cascada calls and coded `.run()` | Executed all three coded child families from Script and Template with shorthand keywords, object settings and keyword settings. Finding 2 is a Casai entry-path omission; no legacy-engine patch is proposed. |
| Raw/parsed caller types, helper results and context overrides | Checked actual Function, Config and preparer consumers against source/emitted declarations. Findings 1 and 4 were not detected by the original compiler fixtures; the follow-up adds the missing consumers. |
| Invocation isolation, cancellation and rendering | Traced signal forwarding and preparation/renderer handoff. Finding 5 affects borrowed top-level source settings; it does not require deep-copy or shared-state enforcement. |
| Outputs, stream collection, cleanup and result consumers | Read stream helpers and native executor ownership; ran lazy validation, cleanup, declared collection and lifecycle tests. Native result augmentation remains delegated to its existing owner. |
| Distribution and newer runtime handoff | The existing linked engine is useful local evidence, not proof of the selected chain-resolution compiler integration or a published consumer installation. Previously documented gates remain unresolved. |

The focused command ran `Registry.unit`, `Phase2.integration`, `Phase2ProductionSecurity.unit`, `Streams.unit`, `ToolLifecycle.unit` and `SchemaPreparation.unit`: **131 tests passed**. Separate temporary runtime/type probes reproduced the findings above; they were removed after recording their results. No paid model calls or production edits were made. Source exact-optional compilation is not this repository's configured implementation check; the supported consumer check uses emitted declarations with exact optional mode.

A proposed `.run()` defect involving newly introduced LLM tool names was discarded: the public contract deliberately allows replacement only of configured names. A Template parser limitation in a nested inline object literal was also separated from the Casai keyword defect; the valid comparison uses a settings variable.

The missed simplifications are concrete: infer completed helper output from the native descriptor, share argument normalization at every coded entry, capture settings once, and reuse effective-map validation instead of maintaining a weaker coded-call rule. Existing native execution, one preparation owner and direct prepared renderers are appropriate. No additional security wrapper, freeze, proxy, origin tracking or general schema interpreter is justified by these findings.

The follow-up below verifies the fixes with these counterexamples and valid neighbors, then revisits the consumer ledger. The original tests' passing counts alone did not close these findings or the external release gates.

### Correction and follow-up

The five corrections preserve the existing contracts:

- Injected helper input/output inference uses the SDK's native tool utilities. Casai retains its raw/default-aware caller signature, while the completed result comes from the descriptor.
- One coded `.run()` normalizer handles Cascada keywords, rejects additional arguments and unknown settings, and shallow-copies the settings before preparation. Function, Script and Template use this entry. Source selection is therefore stable across concurrent calls that reuse one settings object.
- Step preparation checks context replacements only when a new map is supplied. An undefined map retains the binding, matching native generation and streaming.
- Coded call types infer the actual override map and reuse the existing merged-context validator. The shared name check also considers every union branch; an unknown name appearing in only one possible map must not disappear through `keyof`. Whole-map undefined preserves configured entries, and an entry whose schema accepts undefined remains valid.

Runtime regressions exercise all three coded child families from both real renderers, genuine invalid-envelope neighbors, concurrent source settings, and native ToolLoopAgent comparisons. Compiler cases cover Function/Config/preparer helper results, mixed coded-family callers, raw transformed context, partial maps, optional contexts, union names and inline callback inference. Editor checks cover context-field completion, named diagnostics and completed helper output.

The full mock coverage run passes **1,632 tests**, with **99.37% lines/statements, 100% functions and 95.50% branches**. All seven runtime mutations are detected, including independent removal of keyword normalization, settings capture and the native no-op correction. All three type mutations are detected: private-key protection, effective run-context validation and completed helper output. The representative compiler-cost check remains below its 2x limit: **574,448 / 419,566** instantiations for TS7 and **414,161 / 275,385** for TS6 (production/baseline).

The complete compiler matrix passes: TS7 and TS6 source checks and source safety suites, the production build, emitted-declaration checks, and both exact-optional suites. All four editor modes pass (source/emitted declarations, with/without exact optional properties). The whole-tree lint scan identified only two regression-fixture issues; both were corrected and checked separately.

The closing consumer pass revisited every ledger row, including all coded entry points, registered helpers, native step-context handling, configuration inheritance and the shared type validator's LLM consumers. No additional important unresolved finding was identified in these Casai corrections. The selected newer-runtime compiler/renderer handoff, distributable engine/package verification and independent integrated review remain external acceptance gates. No paid model calls were made.

## Production integration (2026-10-20)

The earlier sections are dated design/prototype evidence. The current implementation now has one production preparation owner (`src/execution.ts`), one bounded declaration/schema owner (`src/schema.ts`), and explicit JavaScript stream utilities (`src/streams.ts`). Function, Template, Script and the existing LLM factory entry paths consume those owners. Prompt renderers receive prepared values directly; they no longer construct hidden components or restore raw defaults. Native SDK execution and result augmentation remain the execution owners.

The production regressions are `Phase2.integration.test.ts`, `Phase2ProductionSecurity.unit.test.ts`, `ToolLifecycle.unit.test.ts`, `Registry.unit.test.ts`, `Streams.unit.test.ts`, the revised existing factory suites, and `type-safety/phase2-production.ts`. The generated production matrix exercises 16,128 schema/key/ownership combinations and 243 forwarding combinations. SDK tests cover generation and streaming, public transport, approvals and continuation, safe owned errors, UI/history and subsequent model requests. Registry tests cover removal/orphans, native absent context, prototype-shaped names and fixed bindings. Stream tests distinguish lazy validation from producer failure and iterator cleanup from owner disposal.

`tests/fixtures/phase2-production-mutations.cjs` copies production files into an isolated workspace and verifies that regressions in source priority, private guards, parsed-value consumption and metadata authority fail the production tests. All four mutations were detected. The production editor harness checks public completion and named diagnostics through source and emitted declarations in both optional-property modes.

The implementation pass corrected additional consumer mismatches: native descriptor callback inference; inherited empty child configurations; exact-optional native Tool compatibility; configured-context overload registry checking; helper inference inside reusable Config fragments; executor-free native descriptor fallback typing; inline callback/default inference; permissive/never-returning output types incorrectly classified as streams; optional schema annotations incorrectly adding undefined to callback context; collected stream output types in native callbacks; and runtime rejection of fixed LLM `.run()` settings. These are paired with compiler/editor or runtime regressions. The native `FunctionTool` type replaces a hand-written union extraction. Config fragments are plain `{ config }` providers, and generator tool creation uses the common constructor directly.

The final output-consumer pass also applied undeclared-root-stream admission to custom Text/Object generator outputs, including inheritance. The shared runtime executor already rejected these results without acquiring an iterator; the generator signatures had omitted that check. Ordinary generator output and nested iterables retain native behavior. Compiler negatives have ordinary-call and child-override positives, and an erased-schema runtime case verifies rejection without consumption.

| Production entry / consumer | Enforcement owner and final sink | Evidence |
| :--- | :--- | :--- |
| Function callable and `.run()` | `namedArguments` / `runSettings` → `prepareExecution` → original configured implementation → output parser | Configured omissions, parsed-value replacement, private/closed input checks, metadata spoofing, output error cause and signature tests. |
| Template / Script callable, `.run()`, inline and loaded forms | Same preparation → engine with prepared context only | Coded integration, engine/loader regressions, source-envelope rejection, helper keywords and cancellation. The newer runtime's write protection remains unverified through its compiler. |
| Bare/bound native SDK descriptors | Native schema parsing → final `preparation.assemble` guard → component body | Production SDK generation/streaming, refinement, hooks, approvals, history/UI and subsequent-request assertions. |
| Injected native/Casai registries | Captured registry → normalized arguments → native parsing or binding preparation → native executor/shared component sink | Absent context, scalar/array/preliminary results, prototype-shaped names, removal/orphans, fixed contexts, no-executor behavior and forwarding tests. |
| Existing LLM factories, all seven modifiers and generator tools | `_createLLMComponent` → shared preparation → direct prompt renderer → native SDK → existing result augmentation | Existing modifier matrix plus parsed input, fixed settings, metadata, cancellation, final tool value and lifecycle regressions. No Object preparation registry was added. |
| Output and stream consumers | Native result owner or `validateAndParseOutput`; lazy stream parser; explicit root tool collection | Parsed output/element types, producer errors, early close/cancel, empty streams, SDK response conversion and explicit shared-source disposal. |
| Config/parent/call/descriptor types | Merged original configuration, `application.ts`, native descriptor types and independently inferred callbacks | Both compiler versions, source/emitted declarations, optional-property modes, editor completion/diagnostics and measured type cost are checked separately below. |

The current engine link points to `C:\Projects\cascada`. `C:\Projects\cascada-chain-resolution` contains the newer execution kernel but does not yet contain its compiler/renderer integration. No legacy-runtime security patch has been added. `npm run test:package` installs a tarball outside the repository: published `cascada-engine@0.6.2` fails package import because it does not export `makeSharedIterable`. This is a release blocker, not a passing distribution test. Once the integrated engine is available, update the minimum `cascada-engine` dependency and lockfile to that supported release. The selected newer runtime handoff, its real Script/Template protection tests, a successful packed-consumer check against that distributable engine, and an independent integrated review remain required before whole-phase closure.

The final mock run passed **1,626 tests**. Runtime coverage is **99.37% lines/statements, 100% functions and 95.39% branches**, clearing the unchanged gates; the separate augmentation-core gate passed too. The shared execution/schema owners have full line/function coverage. Retained engine initialization/error/debug branches and native-precondition guards are not replaced with contrived tests merely to reach 100% branches.

All three `test:phase2-production` checks passed: source/declaration editor checks in both optional modes (including reusable fragments), all four runtime mutations, and the compiler-cost/private-key type mutation check. The compiler-cost fixture compares the same workload with fixed baseline commit `a1791a2ea9a4d9439e8bab57ced7ed76153d9e50`, rather than the mutable Git index. TS7 instantiations increased from 419,566 to 558,191 (1.33×); TS6 from 275,385 to 410,114 (1.49×), both below the 2× budget. Measured check times were 1.158/0.900 seconds and 2.92/4.76 seconds respectively; timing is environment-dependent.

The compiler matrix passes: TS7 and TS6 source checks, both source safety suites, the production build, emitted-declaration checks, and the TS7/TS6 exact-optional suites. The last emitted check caught accidental inference in an intentionally erased runtime-test schema after lint suggested removing its explicit generic; restoring that deliberate erasure and rerunning the emitted/exact checks completed the matrix. Whole-tree lint and the focused check of that fixture pass. No paid model tests were run. After the corrections, a subsequent consumer pass found no additional mismatch in the Casai paths above; this is an internal review of that scope, not an independent review or closure of the external runtime/distribution gates.

**Historical surface audit (2026-10-19):** see [2026-10-19 follow-up](#complete-surface-audit-2026-10-19). It distinguishes current production behavior, candidate evidence and remaining integration gates. Earlier findings below retain their dated dispositions rather than being silently rewritten as current blockers.

**Subsequent external review:** see [migration, diagnostics and prototype-key reconciliation](#external-review-reconciliation-2026-10-19). It corrects documentation and candidate evidence without claiming another completed production audit.

**Historical consumer-first pass (2026-10-19):** see [change-impact and failure-transport review](#consumer-first-review-2026-10-19). It found and corrected a private-context error leak in the composed candidate's native injected-tool path; production integration remains required.

**Historical external reconciliation (2026-10-19):** see [binding continuation and call envelopes](#binding-continuation-and-call-envelope-follow-up-2026-10-19). It reproduces and corrects another candidate error leak, this time before any provider request, and narrows the proposed unknown-settings fix to Casai-owned coded calls.

**2026-10-19 dictionary pass:** see [dictionary boundaries and consumer audit](#dictionary-boundary-and-whole-surface-pass-2026-10-19). It found inconsistent own-property handling in default projection, registry lookup/insertion, binding checks and helper typing. The corrections are in the proofs and plan; production gates remain open.

**2026-10-20 follow-up:** the [partial-context-knowledge review](#partial-context-knowledge-review-2026-10-20) found and corrected a security-relevant mixed-union bypass in the proofs. An opaque branch must not erase known private names from another branch. This supersedes the earlier all-or-nothing discovery characterization.

**Historical security exploration (2026-10-20):** the [generated security and consumer review](#generated-security-and-consumer-review-2026-10-20) expands executable evidence, distinguishes native approval integrity from replay, and records the user's cross-execution host-contract clarification. No new private-binding bypass was reproduced in that bounded pass; production integration and independent review remain outstanding.

**Historical mechanism assessment:** the [protection assessment](phase2-protection-assessment.md) evaluates further defenses, distinguishes tool selection/approval from authorization across continuations and coded forwarding, and assigns shared enforcement to implementation slices plus a final integrated review. New native comparisons clarify limitations without adding an approval engine or changing the candidate adapter.

Review date: 2026-10-18. This reviews the design and its implementation obligations, not a completed Phase 2 implementation. The authoritative contracts remain in [plan.md](plan.md#phase-2-existing-component-foundations). The existing default-resolution and SDK-binding fixtures are prototypes; no production runtime or public types were changed in this pass.

**Subsequent API/type proof:** the two pre-integration gates recorded below now have a bounded executable resolution in [phase2-public-api-proof.md](phase2-public-api-proof.md). The user confirmed rejection of extras for strict and stripping closed shapes. Exported candidate signatures, emitted declarations, editor checks, and native binding/UI consumers pass. This ledger's original findings and 105-check validation remain the historical review evidence; the follow-up has 117 runtime checks and a separate repeatable API checker. Production integration and the required complete consumer pass are still outstanding.

## Strategy and evidence rules

The earlier review concentrated on the input algorithm and then treated adjacent coverage as evidence for integration. That missed runtime/type capability disagreement, public signature ergonomics, and consumers outside the executor. This pass uses two independent inventories and follows the full lifecycle:

1. Map every Phase 2 requirement to runtime and type owners, including internal factory construction and future consumers of the shared contract.
2. Start independently at package exports, all factory modifiers and call forms, callbacks, result readers, and SDK/Cascada consumers; map each back to a requirement.
3. Trace construction/inheritance, argument normalization, preparation, binding, execution, result parsing/iteration, tool conversion, and the next conversation turn. Record what information each boundary actually has.
4. Pair runtime and type cases using the same schema instances. Cross defaults with transforms, open schemas with private configuration, removals with dependent contexts, and binding with approvals/UI helpers. Successful algebra alone does not prove a public signature.
5. Compare suspected restrictions with the installed native implementation. Use local model mocks and small probes, including a successful neighbor for a rejection. Distinguish SDK limitations from restrictions introduced by Casai.
6. After corrections, repeat the inventory from consumers. Keep unresolved gates visible rather than treating a large passing count as readiness.

Evidence labels below mean: **demonstrated** by a bounded executable probe; **specified** but still requiring production integration; **native** behavior intentionally retained; **gate** requiring an API/type design proof. A negative characterization passing does not make the characterized call supported. No finite review can establish the absence of all defects.

## Findings and disposition

| Finding | Consequence / evidence | Disposition |
| :--- | :--- | :--- |
| High: runtime declaration discovery and public types are not joined | Root-union input with unrelated configured `db` passes the assignability proof but cannot be partitioned by the runtime fixture. Zod 3 intersections differ from the tested Zod 4 conversion. `CheckedCaller` also does not establish completion, contextual typing, or emitted factory signatures. | **Existing gate remains.** Prove supported schema admission and actual public signatures together before integrating the shared input adapter. Do not silently weaken omission or union guarantees. |
| High: external descriptor/context binding is still not a finished API | Registering the absent-context descriptor with a different native context can silently retain the wrong public default. Executor checks occur after hooks/approval and see parsed, not necessarily raw, context. | **Existing gate remains.** Finalize the public binding signature, default binding behavior, honest raw context types, and mismatch responsibility. Casai owner boundaries enforce immutable selections; native consumers need the explicit matching pair. |
| High: UI helpers inspect the exposed registry before the proposed dispatch binding exists | `createAgentUIStream` validates approval history using `agent.tools` before invoking `stream` or `prepareCall`. Raw `{}` previously parsed to `{ factor: 5 }` rejects if exposed tools supply `3`, even if `prepareCall` would supply `5`. Native tools using only Zod defaults reproduce it. | **New handoff omission corrected.** The binding/API gate includes the registry visible before helper entry. Phase 3 must expose matching immutable bindings through Agent `tools`; request-specific configuration can supply them. Native pre-invocation rejection remains. A matching-binding probe executes exactly once with `5`. |
| Medium: registry removal must reach dependent context validation | `mergeConfigs` independently merges `tools` and `toolsContext`; removing a tool leaves its inherited context entry. `ValidateToolsContext` currently checks extra names against the complete map. Removing requiredness alone can therefore still reject a removed tool's leftover context. | **Implementation obligation clarified.** Effective binding/validation selects remaining tool names while `.config` retains its established merge. Newly supplied unknown names remain invalid; same-name replacement still validates inherited context. Do not rewrite SDK selection policies automatically. |
| Medium: lazy output parsing needs lifecycle-specific error and iteration rules | Initial output validation cannot catch a later element failure. A single generator wrapper can silently make a re-iterable source single-use. A broad iteration catch can replace a producer error with `ConfigError`. | **Contract made explicit; bounded probe passes.** Parse in the consumer pass, preserve source iteration semantics, close on consumer exit/validation failure, wrap only element-validation failures with their cause, and retain producer error identity. Production stream schemas/kind inference and factory adapters remain to implement. |
| Medium: native input-example types do not describe raw transformed input | With a string-to-number input transform, SDK `inputExamples` accepts a number in TypeScript and sends it unchanged although the parser requires a string. Native runtime and compiler checks agree on this mismatch. | **Accepted native limitation documented.** Preserve native property types and transport; no inverse-transform or example-rewriting machinery. The general raw-producer rule does not override native descriptor properties. |
| Low: scope summaries still required deferred LLM work | The dependency table still assigned new positional LLM calls to Phase 2; the surface conclusion still called Object preparer-tool rejection required Phase 2 work. | **Corrected.** Phase 2 fixes shared internals on existing forms. New positional APIs and the full LLM preparer registry belong to Phase 3, as the user decided. |

The other Claude findings remain accounted for: overlap complexity is the cost of the confirmed public-default priority, strict-mode incompatibility can be caused by Casai projection, approved public defaults must remain stable, forwarding entire execution context can fail strict child schemas or expose data, error ownership differs by boundary, nested forwarding uses explicit child `.run()`, and Casai tools intentionally collect completed stream results. These are not silently reopened as new requirements.

## Requirement-to-consumer ledger

Paths below are relative to `src/` unless stated otherwise. These cover all current runtime/declaration source files; rows group their related consumers. They do not claim every proposed implementation has already been tested.

| Surface and entry paths | Runtime and type owners | Evidence and remaining work |
| :--- | :--- | :--- |
| Named exports, `create`, public aliases, errors and third-party re-exports | `index.ts`, `factories/factories.ts`, `types/types.ts`, `types/result.ts` | **Specified.** Add stream helpers/schemas and metadata type; rename Casai context-schema type without renaming native Tool fields. Script without a schema becomes `unknown`; completed tool types differ from live iterable types. Verify source and emitted declarations. Unchanged loader/message/result re-exports remain native. |
| Reusable Config, parent components, final required configuration | `factories/Config.ts`, `config-utils.ts`, `types/merge.ts`, `types/provisional.ts`, `types/config-validation.ts`, `validate.ts` | **Demonstrated core / specified integration.** Preserve shallow precedence, optional/union guarantees, whole-entry replacement, loader/message laws, incomplete fragments and usable shorthand. Current field/type checks need the rename and new effective registry handling. No construction-time schema trial parsing. |
| Function plain/tool, shorthand and `.run()` | `factories/Function.ts`, `types/function-config.ts`, `types/types.ts`, `types/input.ts` | **Specified + input gate.** Direct calls take raw input; native `execute` takes parsed input. Remove implementation-recovery WeakMap/synthetic type path. Infer one flat implementation context including metadata/helpers. An output schema types producer input and consumer output separately; awaited iterable output is checked before tool conversion. |
| Template inline/loaded/tool, Script inline/loaded/tool and exported `loadsScriptAsTool` alias | `factories/Template.ts`, `factories/Script.ts`, `TemplateEngine.ts`, `ScriptEngine.ts`, `renderer-tool.ts` | **Specified + input gate.** Add coded `.run()` and per-run registries; parse before engines without remerging raw defaults. Loaded tools require configured source and loader; ordinary calls retain source-taking forms. Template remains text-only in Phase 2. Script's JavaScript iterable return is distinct from Phase 6 native channels. |
| Four current LLM factories × seven modifiers, ordinary/`.run()` and parent/source overrides | `factories/TextGenerator.ts`, `TextStreamer.ts`, `ObjectGenerator.ts`, `ObjectStreamer.ts`, `llm-component.ts`, `call-arguments.ts` | **Existing matrix / specified corrections.** `withText`, `withTemplate`, `withScript`, `withFunction`, `loadsText`, `loadsTemplate`, `loadsScript`; default text aliases included. Preserve existing positional and synchronous/asynchronous return forms. Fix shared parsing, metadata, capture and cancellation; defer new LLM APIs to Phase 3. No new streamer `.asTool` surface. |
| All existing generator tool modifiers, including default/`withText.asTool` and `loadsText.asTool` | Generator factories, `renderer-tool.ts`, `llm-component.ts`, `types/result.ts` | **Existing mismatch characterized / specified.** Parsed SDK input must enter internal prepared execution, not public `.run({ context })`. Literal prompts remain literal; raw arguments cannot become executable source. Text tools return parsed final `value`; Object tools preserve their native completed value. |
| Hidden template/script/function prompt preparers | `prompt-renderers.ts`, engines, `types/function-prompt.ts`, `types/renderer-input.ts`, `types/schemas.ts` | **Specified.** They consume the owner's prepared context and signal, without a second application parse, metadata reset, stale registry reconstruction, or restored raw defaults. Validate preparer string/message result separately from model output. Explicit application calls to another component remain independent schema boundaries. |
| Raw public input, configured omissions and schema admission | `types/input.ts`, `types/function-config.ts`, `types/renderer-input.ts`, `types/types.ts`, `types/utils.ts`, shared preparation to be added | **Bounded demonstration / gate.** All named raw fields select defaults, not only required fields. Caller input is not filtered. Parse final application values; private configuration stays out. Ordinary calls and `.run` must share capabilities and requirements; union algebra does not prove schema introspection or editor usability. |
| Schema protocols and mutation behavior | `validate.ts`, `types/types.ts`, `types/schemas.ts`, `types/renderer-input.ts` | **Native comparisons / specified.** Use SDK normalization for Zod 3/4, SDK/lazy SDK, and Standard Schema. Current lazy/Standard input fallthrough and concrete-object gates need correction. Local parsing does not force metadata conversion. Preserve native defaults, copying and readonly/freezing limitations; callbacks remain pure. |
| Tool descriptors, binding, native callbacks, model schema projection | `renderer-tool.ts`, Function and generator adapters, `types/config.ts`, `types/result.ts`, `types/callbacks.ts` | **Bounded demonstration / gate.** One bound schema/executor pair, original native context schema and callbacks, parsed public input, private exclusion. Full reference/root-constraint projection guards are still production work. `strict`, description timing, examples and native context input-type erasure retain documented limits. |
| Coded registries, shadowing, injected invocation and nested forwarding | Coded factories, prompt preparers, new common runner, `types/config.ts`, `types/config-validation.ts`, `types/function-prompt.ts` | **Specified.** Resolve removal before binding/inference; normalize keywords before schemas. Inject only for absent own properties after parsing. Native tools can have scalar/array input, absent executors and preliminary results; Casai tools return completed values. Preserve direct-generator versus promised-generator native distinction. Nested tools receive explicit selected `.run` settings, not ambient context. |
| Execution metadata and cancellation | `llm-component.ts`, coded factories, `renderer-tool.ts`, `types/config.ts`, `types/types.ts`, `validate.ts` | **Specified / existing native comparisons.** Reserved `_toolOptions` originates in invocation authority; input markers cannot bypass validation. Native context omitted; ID/messages optional for ordinary calls. Forward signal and check before execution/dispatch. Await preparation normally; no listener/controller/race/tracker. Arbitrary context functions do not acquire implicit forwarding. |
| Loaders, filters, engine configuration and compiled code | `loaders.ts`, both engines, loaded LLM paths, key lists in `types/config.ts` | **Native / specified rename.** `renderOptions` replaces Casai engine `options` everywhere. Retain relative origin, race identity/deduplication, reload/noCache and per-component inline compilation. Invocation data must not be retained in an environment. Sharing compatible compiled resources is optional, not a global cache requirement. |
| Output parsing, stream schemas, consumers, collection and cleanup | `validateAndParseOutput`, `ScriptEngine.ts`, Function/tool adapters, `types/schemas.ts`, `types/result.ts`, new public helpers | **Bounded lifecycle demonstration / specified.** Root text/element kinds handle empty streams; no inspection of first item. Lazy transforms forward parsed elements; collectors do not parse again. Independent component schemas each apply. Undeclared root iterables are valid ordinary outputs but rejected by Casai tools without acquisition; nested streams stay opaque. Native Cascada replay/source disposal remains owner-controlled. |
| Native model results, history, UI conversion and subsequent turns | `augment-result.ts`, generator adapters, `types/result.ts`, installed SDK Agent/UI/approval modules | **Existing native coverage / new UI constraint demonstrated.** Reuse one execution; preserve callbacks, result receivers, history availability and Phase 1 output eligibility. Private defaults never enter public argument records. Completed transformed-input UI limitation and native cancellation/continuation limits remain accepted. Exposed tools must match approval binding before UI-helper entry. |
| Packaging, examples, tests and future consumers | `package.json`, `tests/type-safety`, README/README2, plan Phases 3/4/6/7 | **Specified / documentation corrected.** New mock file registered. Public API proof needs source and built declarations, both compilers, exact optional modes and completion/contextual inference. Phase 3 consumes preparation/binding; Phase 4 consumes approval stability; Phase 6 owns native channels; Phase 7 owns implicit deadlines. |

## Native references and executable evidence

- Installed SDK `agent/tool-loop-agent.ts`, Agent/Tool types, `generate-text` execution and approval paths, `prompt/prepare-tools.ts`, `ui/validate-ui-messages.ts`, and `agent/create-agent-ui-stream.ts` establish ordering and ownership. `provider-utils` schema normalization and tool types establish metadata, raw/parsed erasure, context and example behavior. No native API was inferred solely from its name.
- `tests/Phase2DefaultResolution.unit.test.ts` and `tests/fixtures/phase2-default-resolution.ts` compare the proposed selection approaches, supported declarations, transforms, private exclusion, undefined and open inputs. `tests/type-safety/phase2-default-resolution.ts` proves the bounded merge algebra and documents where capability/public signatures remain unproven.
- `tests/Phase2InputAdapter.unit.test.ts` compares fixed/deferred candidates with immutable binding across generation and streaming, approvals, concurrent contexts, lifecycle parsing, native callback identity, raw context, and history privacy. Two new UI approval checks use typed SDK UI messages and a successful matching-binding neighbor, including exact execution count/output.
- `tests/Phase2Lifecycle.unit.test.ts` adds a small Standard Schema lazy-output candidate: no early iterator acquisition, re-iterable/single-use behavior, parsed elements, validation failure cause/cleanup, producer error identity and early exit. Its native example probe is paired with compiler checks. This is not an exported stream helper or a proof of public stream-kind inference.
- Existing `ComponentContracts`, `Engines`, `FunctionPrompt`, `ToolContext`, and `LLMSurface` tests were inspected as consumers, including assertions that currently expect discarded parsed input. Those expectations must change with production integration; passing them today cannot prove the target behavior. Existing provider/result and native schema tests remain references for unchanged runtime ownership. Earlier full-local results are historical, not rerun claims for this pass.

## Second pass and readiness

After the plan corrections, the consumer-side pass returned to exports and aliases, every factory family/modifier, hidden preparers, literal/loaded tool dispatch, callback typing, registry replacement/removal, stream readers and collectors, exposed Agent tools, and continuation. It also checked phase summary tables and README2 against the authoritative contract. The new corrections close the identified specification omissions without adding a second execution or schema interpreter.

This is **not a clean implementation-readiness pass**: the public schema/signature gate and external binding API gate remain important unresolved work. The latter now explicitly includes pre-invocation UI consumers. Full projection and production consumer integration remain specified but unimplemented. A subsequent complete pass after those changes is required; rerunning only these probes cannot discharge it.

No new user policy decision is required by the findings resolved here. The next task is the isolated public API/type proof, presenting any capability restriction or changed behavior for discussion before production integration. Independently specified metadata/configuration cleanup, keyword normalization, and stream primitives can proceed under the plan's dependency table.

## Validation

Focused mock runtime command:

```sh
npm run test:file -- tests/Phase2DefaultResolution.unit.test.ts tests/Phase2InputAdapter.unit.test.ts tests/Phase2Lifecycle.unit.test.ts
```

Final verification has 105 passing checks: 29 default-resolution, 72 SDK-binding/native comparisons, and four lifecycle probes. Some intentionally characterize unsupported cases. The focused runtime/type fixtures compile with TS7 and TS6; the type-only fixture also passes both compilers with exact optional properties enabled. ESLint and `git diff --check` pass. These are focused compiler checks, not a new build or an emitted-public-signature proof.

A temporary mutation replaced the lazy per-iterator output view with one shared generator. The lifetime test failed with an empty result where `[2]` was required, detecting the unintended single-use behavior. The temporary copy was removed and the original suites passed again. No production source was mutated. No paid model calls or whole-suite run were used.

## API/type follow-up

The follow-up checked the two gates from their consumers: shorthand/run/empty calls; inline callback completion; reusable fragments and inherited implementations; raw/parsed results; bound injected calls; direct native tool registries; immutable context replacement; generation/streaming histories; and UI validation before `prepareCall`. Source and both emitted declaration sets were checked with TS6/TS7 and both optional modes. The runtime schema instances are shared with the compiler cases, including explicit metadata authoring. This closes the isolated feasibility gates for the supported design, without asserting that factory-specific integration is already correct.

It caught issues missed by the algebra-only checks: inline callbacks could invalidate omission inference; schema unions could infer a `never` implementation context; Zod 4's preprocess handle differs from the classic transform handle; strict and stripping schemas have identical types; a complete discriminator-changing argument retains old configured branch fields; and indiscriminately spreading raw context destroys opaque instances such as Dates. The candidate and accepted plan now account for these. Native transformed-context setting types remain erased, explicitly characterized rather than hidden by a false public type.

The approved closed-shape rule is the only new user policy choice in this proof. The proposed binding method is `bindToolContext(raw)` with an honest `{ tool, context }` pair. Internal injected-call and registry helpers are fixture mechanisms, not extra package exports. Full model-schema projection, production source overloads, errors, callback forwarding, stream integration, and all factory consumers remain implementation work. Do not replace the later whole-surface review with another run of this bounded fixture.

## Third pass

Review date: 2026-10-18. This pass re-read the revised plan, proofs, and public candidate after the API/type follow-up. It ran four local probes and one type-cost measurement; no model calls were made and temporary probe files were removed.

| Finding | Evidence | Disposition |
| :--- | :--- | :--- |
| High: open input schemas let model arguments replace trusted tool-context fields | Bound context `{ userId: 'alice' }` with model arguments `{ query, userId: 'admin' }` executes as `admin` through `z.looseObject` and through a plain SDK `jsonSchema()` validator, which JSON Schema leaves open by default. A stripping `z.object` keeps `alice`. Native SDK tools receive arguments and context separately. | **Decision pending.** A fix changes the confirmed precedence for undeclared argument keys and needs user confirmation. |
| High: a bare descriptor given native `toolsContext` fails before the model call | Non-overlapping input `{ query }` and required context `{ userId }`: `ToolLoopAgent` throws `Type validation failed: Value: undefined` with zero model calls, because the bare descriptor parses its absent context during preparation. The `bindToolContext` pair succeeds. | **Decision pending:** an unbound bare descriptor versus the current absent-context binding. README2 now documents `bindToolContext` and the unsupported combination. |
| High: union-input tools cannot combine source partitioning with faithful model metadata | Partitioning needs declarations whenever any configured or bound source exists, including unrelated private `{ db }`. The supported explicit wrapper flattens the union in the single metadata channel that the model also sees. | **Decision pending:** read the union of root branch property names for partitioning only. |
| Medium: the closed-shape rule rejects wider non-literal arguments | `stripping(body)` with `body: { value: number; requestId: string }` and a non-fresh object literal are both rejected. The error names a guard property rather than `requestId`. | **Partly fixed:** the signature gate now requires diagnostics that name rejected keys. Whether wider variables should be rejected awaits confirmation. |
| Medium: type-check cost is unbudgeted | `tests/type-safety/result-augmentation.ts` alone: about 4.0M instantiations, 22 s, and 1 GB with TypeScript 7. Isolated candidate: 0.38M instantiations and 1.1 s. | **Fixed in plan:** budget criterion added to the signature gate. |
| Medium: public stream representation versus response helpers | SDK `createTextStreamResponse` takes `ReadableStream<string>`; Casai stream kinds are async iterables that preserve re-iterable sources. | **Decision pending.** |
| Medium: the injected runner reparses fixed binding context on each call | The candidate's `invoke` parses the captured context per call after binding preparation has parsed it. | **Decision pending:** reuse would make default-factory results per binding instead of per call on the injected path. |
| Medium: stale gate and scope statements | AGENTS.md and several plan passages still described open feasibility gates, an unnamed binding operation, Phase 2 rendered positional normalization, or changes to retiring factory APIs. README2 lacked `bindToolContext`. | **Fixed.** |
| Low: configured default values are not visible to the model | Projection removes `required` without advertising the value used on omission. | **Decision pending.** |
| Low: the step-hook check rejected an unchanged original entry | Binding snapshots plain maps, so identity against the snapshot rejects the caller's original object. | **Fixed:** shallow own-key `Object.is` comparison in plan, proof, and fixture, with a regression test. Restoring identity comparison fails that test. |
| Low: bound descriptors inside Casai registries were unspecified | No rule for `bindToolContext().tool` in an owner's `tools` or as a parent. | **Fixed:** treated as a native tool whose owner supplies the pair's `context`; use components, not bound descriptors, as parents. |
| Low: approval does not propagate through coded calls | A component exposed as a model tool can call an approval-gated tool through its injected wrapper. | **Fixed:** consequence documented in the plan and README2. |
| Low: positional context combined with Cascada keywords was unspecified | `fn({ a: 1 }, b=2)` had no defined normalization. | **Fixed:** rejected with `ConfigError` rather than merged; verification item added. |

Validation: `tests/Phase2PublicAPI.unit.test.ts` passes all 12 checks, including the new regression assertions in the step-hook test. `npm run test:phase2-api` passed TS7/TS6 source, emitted declarations, editor checks, and its mutations. ESLint passed on the changed test files. This pass is not a clean readiness pass: the pending decisions above change binding, partitioning, or merge behavior.

## Private-data follow-up, 2026-10-19

The user confirmed that model arguments must never replace private execution data and accepted private-only bare native context (2B). Trusted implementations must still be able to forward dependencies. The [dedicated investigation](phase2-private-boundary-review.md) records the threat boundary, known-slot candidate, generation/streaming/approval probes, explicit counterexamples, and remaining decisions. No production factory changed.

The follow-up found boundaries beyond the original open-schema example: absent optional private output names; root transforms; native input refinement after validation; nested calls using ordinary override rules; nested secrets inside root-public defaults; and a check of all step histories rather than only the final SDK response. Removing either candidate guard is caught by targeted mutations. The investigation suite also reproduces cases the candidate does not solve; passing it is not security clearance.

The user asked for review of the newer sibling chain-resolution runtime and selected it over patching the installed engine. Its managed copy-on-write protects imported storage but permits different logical values; freezing the host object does not prevent that change. Existing read-only entry capability prevents writes through the selected reference. Recommend reusing that capability for supplied context while keeping local working values writable. It does not identify trusted data after flattening/forwarding. Keep the final input/ownership design open until absent private slots and ordinary-call forwarding are resolved, then repeat the complete consumer review. The prior feasibility gate remains valid only for its bounded older policy.

The subsequent authorized [hybrid evaluation](phase2-private-boundary-review.md#hybrid-evaluation-closed-input-plus-protected-open-input) demonstrates optional-name protection using supported existing context declarations and a common guard for ordinary child calls. Opaque output/type-only absent names still defeat unrestricted flat input. Metadata-only closed JSON Schema and provider strictness do not establish local rejection. The report includes a source-to-consumer security surface trace and a bounded caller-type sketch; it explicitly leaves final API admission, factory typing and production integration open. No mandatory namespace, extra author schema, or production security fix was adopted.

## Implementation entry status, 2026-10-19

The subsequent user clarification accepts protection of actual private properties, including own `undefined`, and supported declared private names. Names absent from runtime data/declarations but present only in types or author intent are an explicit authoring limitation; they do not require a mandatory namespace, globally closed input or opaque-schema rejection. Provider strictness is independently documented with verified installed-adapter defaults. See the [confirmed contract](phase2-private-boundary-review.md#confirmed-authoring-boundary-and-recommendation).

**Correction after the subsequent review:** independent configuration/metadata and stream work can proceed, but the claim that no further policy decision blocks the shared Function/input slice was premature. The subsequent user response accepts the explicit-declaration direction and confirms registered-tool protection; the subsequent clarification resolves this without a blanket private-protection bypass. The private-key sketch must be composed with configured-omission and closed-shape callable inference before shared integration. The earlier proof remains bounded evidence, not a whole-phase readiness declaration. See [current decisions and sequencing](plan.md#remaining-phase-2-decisions).

## Reconciliation after the current-source review, 2026-10-19

The follow-up rechecked the review against source, native SDK behavior, earlier user choices and the sibling runtime plan. The [investigation addendum](phase2-private-boundary-review.md#review-reconciliation-and-current-source-probes-2026-10-19) records the local reproductions. The documentation reconciliation changes no production source or proof fixture and does not claim any previously missing integration now passes.

| Finding / earlier decision | Current disposition |
| :--- | :--- |
| Current parsed-input discard, forgeable marker and open-schema private replacement | Confirmed against current source. All are Phase 2 correctness/security obligations. The user confirmed delivery within Phase 2, without a separate maintenance release/advisory decision. A marker-only fix is insufficient. |
| No-schema configured defaults | Existing overrides are demonstrated. Explicit public declaration is the accepted direction, so no-schema configured names remain protected; the resolved contract adds no blanket private-protection bypass. This changes compatibility and needs paired runtime/type checks. |
| Authoritative merge algorithm and conflicting status text | Corrected: schema-backed ordinary calls reject retained private collisions, tools check the final execution boundary, and readiness distinguishes settled policy, missing proof and production work. |
| Newer runtime | User selection retained. Its compiler cutover remains planned; renderer integration is a completion dependency. No legacy-runtime patches adopted. Fresh raw SDK `__proto__` input is rejected natively; the old-runtime reproduction applies to ordinary calls. |
| Caller shadowing of registered tools | Confirmed: reject retained undeclared collisions with executable fallback names, preserve configured/trusted and explicitly public shadowing. No blanket reservation of built-ins. |
| 3a: bounded union declaration names | Restored as selected work: one level of declared object branches; no branch selection, lossy metadata or union-tool public-default projection. Candidate source-free union regression recorded. Paired runtime/types still required. |
| Closed-shape wider-variable rejection | Retain the user's confirmed policy; this is not a renewed question. Named diagnostics and composed private/omission checks remain required. |
| 5c: stream conversion/sharing | Restored as explicit `toReadableStream` plus native `makeSharedIterable` re-export, with no automatic replay and native owner disposal. Installed exports and SDK converter behavior inspected; production implementation/tests pending. |
| 6: injected context reuse | Restored: reuse the Casai binding's parsed context for injected calls only. Plain native tools and native SDK lifecycle parsing remain unchanged. |
| 7: advertised configured defaults | Restored with configuration-origin, public-field and JSON-data limits, excluding bound-context overrides and private values. Full metadata/validation tests pending. |
| Stripping migration and collision diagnostics | Migration note added; use parsed fields and report offending keys without private values. Do not add non-native stripping warnings. |

Why the previous pass missed these: isolated schema-backed security cases were treated as evidence for no-schema factories; the private-key type sketch was not composed with the actual public callable; later clarifications did not reach the authoritative algorithm and all examples; native model JSON parsing was conflated with ordinary object entry; earlier decisions were not tracked through every consumer. The next complete pass must cross these boundaries and audit the decision ledger. Do not declare a clean pass while these policy/proof/integration gates remain.

## User follow-up: strictness, tool names and delivery

The user confirmed registered-tool-name protection and directed all current-source corrections into Phase 2, closing those policy/delivery questions. The explicit-public-declaration direction is accepted; the follow-up asks whether it is equivalent to strict schema/provider mode and whether an unrestricted option is useful. The plan now distinguishes those controls: schema openness permits unrelated extras, provider strictness governs generation where supported, and private-collision protection remains independent. No new blanket override flag has been adopted. The no-schema and tool-name callable composition is still unproven; this decision update changes documentation, not implementation or test results.

## Override policy resolved

The strictness discussion resolves the remaining policy question: allow unrelated extras through the existing open/catchall schema behavior, but add no blanket private-protection bypass. Configured/trusted overrides require explicit public declarations; no-schema configured names and executable registered-tool names remain protected. Provider strictness remains independent. The composed runtime/callable proof and complete production integration are still outstanding; this closes policy discussion, not those acceptance gates.

## Combined runtime/callable proof, 2026-10-19

The authorized [combined proof](phase2-composed-api-proof.md) now joins public-default omission, private/excess-key checks, no-schema callbacks, bounded root union declarations, immutable binding and registered helpers in one exported candidate used by runtime and type consumers. Thirty mock-only runtime tests pass, as do TS7/TS6 source/emitted-declaration checks in both optional-property modes, source/declaration editor checks, and eight targeted mutations. The representative current-Function comparison measured 13.4% more type instantiations in TS7 and 14.6% in TS6, within the provisional proof budget.

The composed work found and corrected open-index named-type erasure, supplied-key inference, explicit default overrides beside inline callbacks, loss of raw/default-aware Casai helper types, and optional helper-shadow types. The subsequent pass checked configured `undefined`, optional executors, erased native tools, direct SDK pre-approval/refinement boundaries, no-schema model forwarding, and actual helper own-property behavior. No unresolved policy choice was found in this bounded surface.

This closes the focused feasibility gate and permits the shared Function slice. It does not implement or certify existing factories. The candidate explicitly bounds fragment inheritance and metadata projection; final inherited implementation/schema compatibility, full projection/annotations, every factory/preparer/UI consumer, production-wide type cost and the selected Cascada compiler/renderer handoff remain integration acceptance work. Preserve historical results above as dated evidence. A complete post-integration review is still required before Phase 2 completion.

## Complete surface audit, 2026-10-19

This pass starts from all package exports and factory dispatch paths as well as the Phase 2 requirements. It reviews the implementation surface of the plan; most of the new functionality still exists only in test candidates. No production factory or runtime was changed. The contract remains coherent enough to implement in slices, but a whole-phase implementation approval is not warranted.

### New findings and corrections

1. **Medium — parsed `undefined` was confused with omitted raw input in the combined candidate.** `component({ inputSchema: z.object({ value: z.number() }).transform(() => undefined), execute: ... })({ value: 2 })` entered the body. The shared `object()` helper normalized `undefined` to `{}`, and the admission type accepted an output with no object alternative. Native validation correctly returned `undefined`; the defect was Casai's subsequent normalization. The candidate now checks the actual application result, and its types reject guaranteed non-object outputs. Runtime tests cover `undefined`, `null`, array and scalar replacements through ordinary calls, `.run()`, bound invocation, SDK argument validation and injected registry invocation, with a zero-body-entry assertion and a valid optional-object neighbor. The plan now explicitly distinguishes this from permitted absence in raw arguments and native tool context. No new API policy is required.
2. **Medium — the isolated proof did not pass the real repository compiler configuration.** `npm run check` initially stopped at `phase2-composed-api.ts:253` with TS7030. The isolated runner enabled `strict` but omitted `noImplicitReturns`; its native-tool loop lacked a final return statement. The candidate now explicitly returns `undefined` after the loop, retaining native empty-result behavior, and the checker includes `noImplicitReturns`. The full repository checks are part of this pass rather than inferred from isolated compiler success.
3. **Low — the native-helper packaging obligation was missing.** The candidate imports public `validateTypes`/`executeTool` from `@ai-sdk/provider-utils`; `ai` re-exports `asSchema` but does not re-export those helpers. `provider-utils` is currently available transitively, not declared by Casai. Copying the candidate directly into production could depend on workspace hoisting. The plan now requires direct runtime dependency declaration for any such retained imports and an isolated packed-package/declaration smoke test. This is an integration requirement, not a new dependency added by this review.
4. **Low — older status wording still contradicted the resolved policy.** The plan's opening principle said the private boundary was under investigation, a summary still said schema-only admission, and later paragraphs described ownership as unsettled. Updated these to distinguish the confirmed policy from outstanding production verification, and identified the older source-free security candidate explicitly. No policy was reopened.

### Complete surface ledger

| Surface and consumers | Evidence checked in this pass | Status / remaining acceptance |
| :--- | :--- | :--- |
| Package exports, `create`, public configuration/result types | `src/index.ts`, factory namespace, manifest, emitted-consumer scripts; existing exports still describe the old APIs | **Specified:** export the new schemas/collectors/converter/shared helper/options type, rename configuration types consistently, and verify isolated package consumption. |
| `Config`, every parent path and canonical `.config` | `Config.ts`, `config-utils.ts`, `types/merge.ts`, config validators; current Function still has root config plus implementation-recovery state | **Specified:** canonical config and forbidden-name checks; whole-map/entry inheritance laws retained. Complete schema/implementation inheritance must be composed with the new callable guards. |
| Function ordinary calls and `.run()` | Current Function dispatch, function/input types, combined runtime/type candidate | **Demonstrated in candidate:** omissions, raw/parsed distinction, no-schema privacy, open/closed inputs, helper shadow types and object-result rejection. **Unimplemented:** real `.run()` and final inherited overloads. |
| Script and Template, inline/loaded/source overrides/tools | Both factories and engines, `RendererCall`, admission gates, loader tests | **Specified:** remove duplicate raw merges, preserve empty/overridden sources, add `.run()`, use parsed contexts and the shared adapter. Source-less ordinary forms and configured-source tool requirements must agree in runtime and types. |
| All four existing LLM factories | Seven modifiers each (`withText`, `withTemplate`, `withScript`, `withFunction`, `loadsText`, `loadsTemplate`, `loadsScript`), generator tool adapters, shared dispatch; native-comparison matrix exercises ordinary/run, inheritance and concurrent calls | **Baseline/native:** current call order and result timing retained. **Specified:** shared preparation corrections across every path, including literal/loaded-text tools. No new Object registry or LLM positional API in Phase 2. |
| Hidden preparers and execution metadata | `prompt-renderers.ts`, both engines, `llm-component.ts`, renderer tools, function-prompt/callback types | **Specified:** one prepared handoff, no restored defaults, no new parse/metadata/wrapper set inside hidden preparers, original signal preserved. Current public-call routing and `_toolCallOptions` bypass remain production work. |
| Public defaults and private ownership | Combined/default-resolution/private/hybrid candidates; native schema normalization and parsed replacements | **Demonstrated within declared bounds:** source priority, omission, transforms, private collisions, no-schema forwarding, declared optional private names, root unions. **Accepted limits:** erased absent names, public root objects, opaque metadata and native copying/freezing. |
| SDK descriptors, binding and callbacks | Installed Tool/Agent/ToolLoopAgent and native parser/executor/context modules; binding/approval/UI tests | **Demonstrated in isolated proofs:** binding pairs, raw context versus parsed executor context, approval continuation, matching exposed UI registry and pre-dispatch mismatch check. **Specified:** full projector/restrictions/default annotations, optional SDK properties and every production `.asTool` modifier. |
| Coded tool registries and execution | Native `executeTool`, composed helpers, removal/shadowing cases, type consumers | **Partly demonstrated:** scalar/array native inputs, Casai raw schemas/defaults, optional shadows, native preliminary results. **Unimplemented:** real per-run `toolsContext` overrides, inherited orphan-entry validation and capture before awaits across all owners. No model lifecycle/approval synthesis for coded calls. |
| Cancellation and invocation isolation | `docs/abort.md`, current dispatch signal checks, scope/capture contracts and concurrency baseline tests | **Specified:** explicit signal forwarding only, captured wrappers, immediate checks and post-preparation check; no native render interruption, controllers, races or implicit forwarding. Production prepared handoff remains a gate. |
| Output schemas and streams | `validateAndParseOutput`, result aliases, lifecycle lazy-parser tests, native iterable normalization and web-stream conversion implementation | **Demonstrated:** lazy element replacement, valid prefix then failure, closure, producer error identity and re-iterable/single-use distinction. **Unimplemented:** public stream-kind/raw-output typing, tool collection, converters, shared-reader integration and package exports. |
| Results, history, UI and provider protocols | `augment-result.ts`, generator tool return paths, current SDK/provider fixture tests; native response and approval validation | **Baseline/native:** one execution, parsed final `value`, history independent of eligibility, SDK receiver/error/stream contracts. Preserve them when integrating bindings; no separate native-history workaround or new Phase 2 Agent API. |
| Loaders, filters, environment reuse and `renderOptions` | Both engines, prompt key projection, loaders/race identity and environment tests | **Baseline:** native named-resource cache/update/relative-import behavior. **Specified:** complete rename and invocation-local prepared context. Shared-environment optimization remains optional. |
| New Cascada runtime and language entry | Sibling `runtime-evolution-plan.md` Phase 8 still says planned cross-repository integration; current engine dependency is 0.6.2 | **External gate:** prove compiler/renderer handoff, read-only entry behavior, keyword normalization, imported own properties and escaped iterable behavior with the selected runtime. Kernel tests or old-renderer success do not discharge this gate; no legacy patch. |
| Source/declarations/editor/tests | Actual `npm run check`, combined checker, exact-optional consumers, meaningful guard mutations and cost workload | **Verification:** record final results below. Full production type cost and actual factory completion remain integration checks; prototype costs are not a package-wide performance promise. |

### Subsequent consumer pass and disposition

After the corrections, re-traced the paths from `.run()`/ordinary callers, generator descriptors, injected helpers, engine/preparer dispatch, result/history readers and package consumers back to their owning requirements. The new object-result check is before public arguments or a body can observe an invalid replacement; it does not change omitted-input filling or optional native context. Removing it is a targeted mutation. The compiler correction retains the SDK's final-value protocol, and no production dependency or runtime behavior was changed.

The important remaining work is already assigned: final factory/inheritance typing, complete model projection, per-invocation registry capture, prepared renderer/tool dispatch, stream API/type integration, and the newer runtime handoff. These are implementation acceptance gates, not newly discovered policy questions. There is no basis for claiming that all Phase 2 functionality is implemented or that the complete integrated surface has passed. The accepted native/authoring limitations remain visible in the plan.

Why the new issues escaped earlier passes: tests concentrated on successful object transforms and private collisions, while an optional-source helper was reused after parsing; isolated compiler flags differed from the repository; and workspace imports were not traced into the published manifest. The review process now includes all three checks.

`npm run test:phase2-composed` passed: 31 runtime checks; TS7/TS6 source and cross-compiler emitted consumers in both optional-property modes; source/declaration editor checks; and all nine mutations, including removal of the new parsed-`undefined` guard. The same 24-case cost workload measured 567,669 / 644,081 instantiations for current/candidate in TS7 and 394,900 / 452,778 in TS6, within the provisional 2x budget. These are bounded workload results, not production-wide performance guarantees. Temporary proof artifacts were cleaned up.

`npm run check` passed after the corrections: TS7/TS6 source and type-safety checks, build, built-declaration consumers, exact optional properties, lint and **1,428 mock-only runtime tests**. Coverage is 99.26% statements/lines, 95.80% branches and 100% functions; the separate augmentation threshold also passed. Inspected the remaining uncovered production locations: engine fallback/precondition branches and diagnostic paths remain baseline code, not untested new Phase 2 implementation. No coverage exclusion or contrived branch-only test was added. `git diff --check` passed. No paid model calls were made.

## External review reconciliation, 2026-10-19

The subsequent external review found valid migration and documentation omissions and one candidate error mismatch. Its findings do not require a new public policy decision. Re-read the cited examples and assertions, the authoritative preparation/registry contracts, native secure JSON and UI-message validation, and the selected runtime's property access/write implementation. The full production integration gates above remain open.

| External finding | Disposition and correction |
| :--- | :--- |
| No-schema protection missing from examples and existing tests | Confirmed. README2's target greeting now declares `name`; public/private parsing prose is corrected. README's current-behavior example has a migration note. The plan now inventories the affected runtime files and also compiler positives omitted from the review, including Function, renderer and tool configured overrides. Update existing behavior assertions with their owning implementation slices. |
| Adding a plain object schema can drop unrelated variables | Confirmed. Document `z.looseObject` / Zod 3 passthrough when those variables must survive. A paired runtime/type case demonstrates no-schema rejection, closed-schema stripping/type rejection, open-schema preservation, configured omission and continued private protection. This recipe preserves extras, not the old ability to override every configured field. |
| Stale merge, context-validation, runtime-dependency and proof-status wording | Corrected in the plan, README2 and the investigation addendum. Casai injected calls reuse binding-parsed context; native stages retain their own boundaries. JavaScript streams need no Phase 6 channels, but the selected newer renderer handoff remains required. |
| Prototype keys on ordinary/UI paths | The path distinction is valid. A new three-payload probe confirms native UI object validation can retain keys rejected by secure JSON parsing. Composed binding plus the newer kernel did not expose the absent declared private field or pollute prototypes. Record these inputs in the actual renderer/continuation gate; do not add the proposed temporary old-runtime blacklist. See the [qualified probe evidence](phase2-private-boundary-review.md#prototype-key-and-diagnostic-follow-up-2026-10-19). |
| Collision rejection discloses private names | Document the existing diagnostic contract: names are not secrets, values are not included, and matching values never authorize a private override. The runtime case now includes a matching sentinel as well as own `undefined`. |
| Candidate leaks native output-validation error on ordinary calls | Confirmed and corrected in the fixture. Wrap only its owned output parse in `ConfigError`, preserving the native cause; leave body failures unchanged. Regression coverage reaches ordinary, `.run()`, binding, descriptor and registered-helper execution, plus successful transformed output. A mutation removing this error boundary is caught. |

The review's request to reconcile assertions in paid-test files is correct; it does not make paid calls necessary to verify local argument resolution. `Script.test.ts` mixes local and paid cases, and its cited merge assertion itself uses no model. Move local contracts into mock-only coverage; update any retained provider examples too. Construction-time configuration replacement and unrelated new arguments must remain supported.

Why this escaped the previous pass: the new policy was checked in candidate tests but not traced far enough into existing positive compiler assertions and introductory examples. The migration advice identified public declarations without checking whether the chosen schema preserved other inputs. Successful output transforms did not establish output failure ownership. The review process now explicitly includes these checks.

The subsequent targeted consumer pass checked introductory examples, migration recipes, keyword calls, registry-context wording, error ownership and evidence-status links against the settled algorithm. This was reconciliation of an external review, not a new claim that the unimplemented production surface is complete. No production source or package API was changed; the implementation acceptance gates retain their prior scope.

`npm run test:phase2-composed` passed with **33 runtime tests**, TS7/TS6 source and cross-compiler emitted consumers in both optional-property modes, editor checks and **10 caught mutations**. The same cost workload remains 567,669 / 644,081 instantiations for current/candidate in TS7 and 394,900 / 452,778 in TS6, within budget. The separate runtime file also passed. No paid calls were made. The earlier full `npm run check` result above belongs to its recorded snapshot; this targeted follow-up does not claim a new full-suite run.

Targeted ESLint passed for all four changed proof/type files after replacing one assertion's regular expression with `includes`; the affected output-error test passed again. `git diff --check` passed. The prototype/UI/kernel probe ran from stdin and left no temporary source file.

## Consumer-first review, 2026-10-19

This pass starts from the changed behavior and its consumers, rather than treating the plan's existing headings or passing tests as a complete inventory. The method is now explicit in [the review process](review-process.md#run-a-change-impact-pass): list old/new behavior and valid neighbors; independently locate runtime/type/example consumers; assign owning slices and evidence; cross high-risk boundaries; inject failures and mutate guards; then reverse-check the ledger. No scan or finite suite proves the absence of every defect.

### New finding: private context in an injected tool's validation error

**Security-relevant prototype defect, fixed; production acceptance requirement added.** A plain native tool registered in a coded component had its `inputSchema` and `contextSchema` parsed with native `validateTypes`, but those two calls were outside the candidate's `ConfigError` boundaries. The immediate mismatch was an error class. The downstream consequence was more serious: native `TypeValidationError.message` includes the rejected value. When this validation runs inside an outer model tool, the SDK converts the thrown message into tool output for the next model request.

Reproduction uses a valid typed private context `{ apiKey: 'PRIVATE_CONTEXT_ERROR_SENTINEL', account: '' }` and a schema requiring a nonempty account. The inner executor never runs. In the previous unwrapped path, the second provider request contained the API-key sentinel. This requires no malicious validator or cast: a normal refinement/string constraint can fail on otherwise correctly typed runtime context.

The native comparison matters. In `ai/src/generate-text/execute-tool-call.ts`, native-owned context validation runs before the executor's tool-error conversion. An invalid context there rejects the native generation after one request. In the injected case, validation happens inside the outer executor, so `ai/src/prompt/create-tool-model-output.ts` converts the error message to model-visible `error-text`. Merely calling a native validator does not preserve its original lifecycle boundary.

The candidate now wraps only injected input/context validation as `ConfigError`, with a stage-only public message and the native error as cause. Actual SDK-owned validation, executor failures and preliminary-result producer failures retain their native behavior. This follows the existing error contract; it adds no schema, origin tracking, redaction framework or new public API. The plan now explicitly forbids concatenating private-context validation text into the public wrapper message. Trusted diagnostics can still inspect its cause.

Permanent regressions cover generation and streaming through the actual normalized next model request, assert two requests and zero inner-body entries, and retain the native cause locally. Removing the context error boundary makes both tests fail specifically because the private sentinel reaches the next request. A separate native counterexample characterizes the old behavior; its passing assertion documents a leak rather than claiming protection. An input-boundary mutation independently catches the error-class mismatch for public native arguments.

Why it escaped: earlier tests covered successful private context and failed application/output parsing in Casai-created tools. They did not combine a plain native helper, invalid private context and an outer model-tool execution. JSON serialization of Error objects can also hide their message; the assertions now inspect real provider requests and explicit error messages, not just serialized result objects.

### Change-to-consumer ledger

The following reverse pass covers Phase 2's full planned surface while keeping unimplemented work visible. Detailed production files remain in [the implementation inventory](plan.md#complete-implementation-surface); concrete migration consumers are now recorded for every API change, not only no-schema overrides.

| Behavior delta / retained contract | Consumer checks and disposition |
| :--- | :--- |
| Configured public defaults, private collisions, no-schema calls, native strip/open/strict behavior | Rechecked preparation, combined signatures and existing positive callers. An in-memory TypeScript-AST scan of Markdown call examples found no direct literal schema-less configured overrides in README2 or the plan; it found README's already labeled current-behavior Template example. This bounded scan does not cover aliases, spreads or arbitrary inheritance. Existing migration inventory owns the runtime/type changes. |
| Schema protocols, raw/parsed types, object-root results, unions and purity | Compared the candidate's native normalization with source validators and capability/type gates. Root transforms, source-free parsing, configured union remnants and native copy/freeze limits retain their existing evidence. Full production admission/projector integration remains assigned; no new policy choice. |
| Function `.config`, raw ordinary calls versus parsed native executor, inherited implementations | Traced current Function root properties/recovery, factory inheritance and `tool-contracts`/`public-contracts` assertions. The migration now explicitly includes replacing old call/execute equality and root-configuration expectations; final inherited factory typing remains an acceptance gate. |
| `toolContextSchema`, native descriptor callbacks and metadata | Checked native Tool/Agent ownership, configuration spelling, input examples and native/raw description context. Native `contextSchema` occurrences must remain; Casai construction/export assertions change. Full callback/descriptor and default-annotation integration remain assigned. |
| `_toolOptions`, keyword normalization and cancellation | Rechecked native options types, ordinary/injected/SDK option sources, reserved-field guards and call normalization. Current source/preparer second-argument/marker consumers are in the migration inventory. Explicit forwarding and post-preparation checks remain the scope; no timers, listeners or implicit context propagation. |
| Registry binding, per-run overrides, replacement/removal and shadows | Traced native versus Casai helper dispatch, supported scalar/array inputs, body/error normalization and captured context. Corrected the newly found error transport. Per-run owner maps, orphan handling, helper inference and bound-descriptor native treatment retain production gates. |
| Hidden preparers and retiring LLM factories | Rechecked `prompt-renderers.ts`, `llm-component.ts`, both engines, generator tool modifiers and current factory modifier exports. Prepared values/metadata must reach renderers once; literal/loaded-text tools retain their own boundary. Old LLM call forms and absence of Object registries remain intentional. |
| `renderOptions`, source requirements, loaders and caching | Traced engine options, copied configuration keys and `.run()`/type restrictions. Rename preserves whole-value replacement and escaping behavior. Source origin/loader/cache baselines and the selected new compiler/renderer handoff remain explicit acceptance work. |
| Output schemas, Script `unknown`, declared root streams and tool collection | Reviewed lazy-parser evidence, output ownership and exact result/export assertions. Ordinary versus collected results, producer failure identity and root-only iteration remain specified. Public schema/type/collector integration is not claimed from the candidate. |
| Web conversion, explicit sharing and stream lifetime | Re-read native iterator conversion and Cascada sharing/cleanup implementations. Pending pulls are not interrupted by ordinary `return`, reader closure is not owner disposal, and replay is source-scoped. Native semantics remain accepted; planned helper/runtime integration checks remain assigned. |
| SDK results, history, UI, approval and failure publication | Kept prior native result/approval/UI limitations. Added failure-message privacy checks in both execution modes and distinguished final response objects from actual next requests. The new renderer/prototype-key handoff gate remains open. |
| Packaging, exports, examples and compiler cost | Located exact `public-contracts` export assertions and current configuration consumers, verified helper dependency requirements, and re-ran the composed source/emitted/editor/cost checks. Packed-package consumption and whole-production type cost remain implementation gates. |

### Failure-owner matrix

| Boundary | Required behavior / evidence |
| :--- | :--- |
| Ordinary and `.run()` application validation | `ConfigError` with native cause; no body entry. Existing composed regressions retained. |
| Bound Casai injected application/context validation | Shared binding parser and owned error boundary; no second application parse. Existing binding tests remain relevant. |
| Lazy binding context validation, including approval revalidation before metadata | The later external reconciliation found this row was missing. Stage-only context error at the shared preparation source, native cause retained; check metadata, argument validator, injected call, generation rejection and streaming/UI publication with zero provider calls. |
| Plain native injected argument validation | Runner-owned `ConfigError`; native cause retained, executor not entered. Added direct and mutation checks. |
| Plain native injected private-context validation | Safe `ConfigError.message`, native cause locally, no private values in outer tool output/next request. Added generation/streaming and mutation checks. |
| Actual native SDK argument/context validation | Preserve native types and lifecycle. Direct-context native comparison rejects before an outer tool-error result can be formed. |
| Component output and lazy stream elements | `ConfigError` at the owning parse, including iteration time; prior output/lifecycle regressions retained. |
| Tool implementation or preliminary-result producer | Preserve original failure identity; the new wrapper does not catch execution. Added valid and failure neighbors. |
| Cascada rendering, UI serialization and complete production factories | Preserve owning native semantics while applying the shared boundaries; actual integrated tests remain acceptance gates, not satisfied by Function-only fixtures. |

### Subsequent pass and verification

Rechecked the changed error boundary against direct/injected/native entry, next-request conversion, cause handling, callback failures and producer iteration. Revisited all ledger rows after the correction; no further unresolved policy issue was found. Existing implementation gates are still open. The error finding must travel with the native-helper slice into actual factories; fixing an isolated candidate is not a production security fix. No production source was changed.

`npm run test:phase2-composed` passed with **37 runtime tests**, TS7/TS6 source and cross-compiler emitted consumers in both optional modes, source/declaration editor checks, and **12 caught mutations**. Cost stayed within budget: current/candidate instantiations were 567,689 / 644,101 for TS7 and 394,920 / 452,798 for TS6. Targeted ESLint passed. After strengthening the mutation to fail on actual private-value publication before checking error class, the runtime suite passed again and the mutation-only check was rerun. No paid model calls or new whole-suite run were used; earlier full-check results remain dated evidence.

## Binding continuation and call-envelope follow-up, 2026-10-19

Reconciled the next external review against the current candidate and installed SDK. This is a focused follow-up, not another completed whole-production audit. The previous pass missed a distinct entry into the shared lazy preparer; its successful next-request assertions could not observe a failure published before any provider request.

| External finding | Assessment and disposition |
| :--- | :--- |
| Binding context validation can disclose private values through approval-continuation errors | Confirmed medium security issue in the candidate. Reproduced before the correction in generation and streaming. The captured context parse now creates a stage-only `ConfigError` with the original native error as cause, before any consumer receives it. Carry into the shared preparation slice. |
| Unknown coded `.run()` keys can be silently dropped; data can be mistaken for settings/source | Confirmed missing coded-call rule, with a narrower correction than proposed. Specify rejection of unknown own top-level coded settings before work; the bounded Function candidate demonstrates it. Recognized source keys remain intentional source overrides, so this is a mistake detector, not a complete source-provenance defense. Do not pass/spread model data as settings. |
| Runtime string/object positional overload can turn model data into source | Valid documentation gap, not a new dispatch regression. Document an explicit data-field wrapper and add a current-renderer regression for string/object variants. Preserve trusted positional source overrides. Full new coded `.run()` and Cascada normalization coverage remains an integration obligation. |
| Injected bound-context error is labeled application input | Confirmed low diagnostic issue, corrected by the same source-level context boundary as the first finding. Metadata-first, input-validation-first and injected access now retain the context-stage summary and native cause. |
| No separate public helper for exercising registered-tool behavior | Documentation gap, not a missing API requirement. Explain mock-model SDK agents and owning Casai registries, and that native `execute` expects parsed input/context. Add no helper solely to duplicate SDK preparation. |

Two qualifications to the external recommendations matter. Phase 3 explicitly avoids a parallel runtime unknown-key whitelist for SDK settings; it does not already require one. Retiring LLM factories retain that delegated behavior. Also, native approval revalidation does not call `repairToolCall`: it must not repair an already approved operation. The new tests assert zero repair calls on this path; a generic statement about repair-hook exposure is not evidence that this continuation invokes one.

### Reproduction and correction

Start with a valid binding and obtain approval for a tool with empty public arguments. Continue with a fresh binding whose private context is `{ apiKey: 'PRIVATE_BINDING_ERROR_SENTINEL', account: '' }`, where `account` must be nonempty. Each binding remains immutable. In the installed SDK, `validateApprovedToolApprovals` invokes the argument validator before `prepareTools` requests metadata. Casai's lazy argument preparation therefore touches private context first. The unwrapped native `TypeValidationError` includes the rejected context in its message; `InvalidToolInputError` incorporates that text.

Before correction, generation rejected to the application with the private error. Streaming emitted a `tool-error` whose `error` is already a string containing the sentinel, then a stream error; there were zero provider requests, and response/history completion rejected. A UI `onError` returning the message exposed it in UI chunks. After correction, both the early tool-error text and later stream/UI failure text use the safe context-stage summary. Local causes still contain the native rejected value by design and must stay in trusted diagnostics. The actual SDK-owned native context schema is unchanged.

Regressions assert zero body entries and zero provider calls on failure, rejected response/step promises, actual `tool-output-error` and stream-error UI chunks under a message-surfacing handler, and absence of the sentinel from published text. A fresh valid binding executes the same approved input successfully. Separate first-consumer tests cover metadata, SDK argument validation and injected execution, preserving the SDK's own outer argument error. A mutation removing only the binding-context wrapper reopens the actual stream-text leak. The earlier plain-native injected-context mutation now targets its own validation expression so it cannot accidentally remove the new binding wrapper instead.

### Call-envelope limits and evidence

The coded settings lists are finite and Casai-owned: Template accepts `template`, `context`, `toolsContext`, `abortSignal`; Script substitutes `script`; Function has no source override. Unknown own keys, including own `undefined`, reject before parsing or execution. Nested `context` fields are still application data subject to the one input schema and private-binding rules. The candidate implements only its existing `context`/`abortSignal` subset; it does not claim per-run registry or source integration.

Unknown-key rejection cannot stop `template.run({ template: modelText })`: that object contains a valid source setting. Likewise, a positional string remains source. Correct examples use `component({ payload: modelValue })` or `.run({ context: { payload: modelValue } })` with an appropriate schema. A targeted existing-factory test checks ordinary and `.run()` rendering in generation/streaming modes with a string or an object containing a source-looking field; `{{ secret }}` remains literal model prompt data, not a second rendering. Final coded factories and the newer Cascada handoff must carry the same tests, including normalized named calls and legitimate trusted source overrides.

### Verification and remaining gates

`npm run test:phase2-composed` passed **41 runtime cases**, TS7/TS6 source and cross-compiler emitted consumers in both optional-property modes, editor checks and **14 caught mutations**. Current/candidate instantiations were 567,709 / 644,121 for TS7 and 394,931 / 452,809 for TS6, within the existing 2x bound. The targeted rendering test passed and its file type-checked with both compilers. Targeted lint and whitespace checks cover the changes. No production source or package API was changed; no paid calls or new full-suite run were made.

The process now explicitly crosses lazy first-consumer order with failure publication, including zero-request streaming/UI outcomes. The focused second pass checked all three consumers of binding preparation, the independent native injected boundary, safe messages versus trusted causes, settings recognition versus data wrappers, and native executor semantics. The earlier production gates remain open: final factories/inheritance, full projection, per-run registries, renderer handoff, streams, packaging and integrated type cost. These corrections need no new policy choice and are requirements of their owning implementation slices, not proof that Phase 2 is implemented.

## Dictionary-boundary and whole-surface pass, 2026-10-19

This pass started from exports, native execution owners and map operations, then compared the Phase 2 contract and its consumers. It revisited public calls/settings/source forms, configuration and inheritance, input/private preparation, schema projection, SDK/injected tools, callbacks, errors and approval/UI transport, renderer handoff, streams, and package/type consumers. The important new dimension was **how a name is read or written**, independent of where that name came from. Earlier prototype tests exercised application payloads and the runtime kernel, but missed schema and registry names used inside the adapter.

### Findings and corrections

| Finding | Reproduction and impact | Correction / evidence |
| :--- | :--- | :--- |
| Medium: projected requirements could count inherited values as configured defaults | With required public `factor` and `constructor`, configured `{ factor: 3 }` incorrectly advertised no required fields. `defaults.constructor` read `Object` from the prototype. `toString` had the same defect. Typed callers still required the string field, and omitted runtime input failed. | Remove a required entry only for an own selected non-undefined default. Corrected the combined, public, private and earlier binding projectors. Tests pair missing versus explicit own defaults, direct validation/calls and a real mock SDK call. |
| Registry context lookup and binding checks read inherited entries | An executable tool named `toString` or `constructor` received an inherited function when its `toolsContext` entry was absent; native SDK generation/streaming correctly supplied `undefined`. The public owner check also rejected an unchanged absent binding for those names. | Own-entry lookup, preserving missing/own `undefined`. Native comparison and injected tests plus the binding-check regression failed before correction and pass afterward. |
| Helper insertion invoked the `__proto__` setter | Registering a fallback with that valid name left no own helper and changed the execution context's prototype. This would also defeat the selected runtime's own-property lookup. | Define the helper as an own enumerable data property; preserve the normal execution prototype. The regression verifies own presence, prototype identity and successful invocation. No reserved-name ban or legacy-engine patch. |
| Helper types treated an inherited Object method as a configured shadow | An empty configured shape structurally satisfies `Record<'toString', unknown>`, despite not declaring the key. The candidate therefore suppressed the injected callable and inferred `never`. | Require a declared key before classifying a guaranteed shadow. Source/emitted and editor cases cover callable `toString`/`__proto__`, valid own `undefined` shadows, and missing required public `constructor`. A mutation removing the declared-key check fails. |

The registry issues form one own-entry correctness gap across lookup, insertion, consistency checks and typing. They are boundary-sensitive, but this pass did **not** demonstrate a new model-controlled private override or private-value disclosure: registry names are application configuration, and the existing private-collision checks remain required. The correction is small and follows native SDK own-entry lookup; it does not justify more general defensive machinery.

### Surface-to-evidence pass

| Surface | Evidence and disposition |
| :--- | :--- |
| Exports, factory modifiers, Config and inheritance | Re-inventoried `src/index.ts`, factory/config/type files against the migration and complete-surface tables. Existing new `.config`, configuration-name, result-type and required-configuration obligations remain assigned to their slices. No extra public API proposed. |
| Ordinary calls, `.run()`, positional/named source and data | Rechecked `call-arguments.ts`, current dispatch, coded settings lists and keyword-normalization contract. Preserve the explicit data wrapper and trusted source overrides; no unknown-key rule can infer data provenance from recognized setting names. Current LLM forms remain unchanged until Phase 3. |
| Public defaults, private names, parsing and schema capability | Reviewed the complete preparation algorithm and composed/default/hybrid fixtures. Fixed phantom defaults; retained strict/strip/open behavior, configured omissions, raw/parsed boundaries, root transforms and accepted absent-name limits. Full projector and final factory admission remain integration gates. |
| Registries, binding lifetime, fallback shadows and native execution | Audited dynamic reads/writes across the combined/public candidates, native `executeToolCall`/`executeTool`, configuration helpers and current renderer tools. Corrected all demonstrated own-entry sites, including the earlier projector copies; retained native scalar/preliminary-result contracts, context parse counts and per-run immutability. |
| Callback metadata, cancellation and preparation consumers | Traced `_toolOptions`, prompt renderers, engines and native execution options against the prepared-handoff requirements. No new timer/listener/tracking requirement. Final sibling/preparer integration remains assigned. |
| Error ownership, approval, history and UI | Re-ran the private-boundary/binding suites and inspected native validation, approval, execution-error and UI conversion modules. Existing safe summaries/native causes remain necessary. A focused import of the selected newer runtime's `createPoisonError` preserved the safe summary and separate cause; this is not a completed renderer handoff. |
| Stream schemas, collection, conversion and lifetime | Revisited the lifecycle candidate, native iterator normalization and stream contracts. Lazy validation, producer error identity, re-iterable/single-use distinction, finite root tool collection and owner disposal remain specified; public stream helpers and factory integration are still implementation work. |
| Types, declarations, examples, packaging and compiler cost | Added the missing prototype-named runtime/type/editor neighbors and independent mutations. Existing packed-consumer/direct-dependency and whole-production cost requirements remain open; workspace proof success does not close them. |

After correction, the reverse pass checked each changed primitive's other consumers: selected-default reads, owner context reads, binding comparisons, fallback writes, shadow typing, then their metadata, ordinary/injected/SDK and editor consumers. Fixed-key configuration indexing and native schema behavior were not blindly rewritten. No additional unresolved policy decision emerged from that pass. Production integration and the selected compiler/renderer handoff still prevent a whole-phase completion claim.

### Verification

The seven Phase 2 runtime proof files passed **222 cases**, including four new runtime regressions that first failed against the prior candidates. The combined callable checker passed source and emitted-declaration consumers under TS7 and TS6, both optional-property modes and editor inference; its runtime file passed **44 cases**. All **18 mutations** were caught, including independent removal of each new guard. The representative type-cost check passed its 2x instantiation ceiling: TS7 current/candidate **565,146 / 639,906**, TS6 **392,455 / 451,139**. This measures the isolated workload, not final production types.

Final targeted TS7/TS6 compilation and ESLint passed for the affected proof/type files, and `git diff --check` passed. The focused four-case regression run passed again after adding an actual mock SDK call for the required-field case. No production source, SDK or Cascada runtime was patched, and no paid model calls or full-suite run were used.

## Partial-context-knowledge review, 2026-10-20

This pass challenged the classifications used by the earlier reviews. It crossed partial context declarations with opaque branches, then followed every reason preparation needs application names back into factory admission. The wider pass revisited exports/configuration, ordinary/source/settings calls, tool binding and native execution owners, parsed-value handoff, failure/approval/UI paths, stream ownership and public type consumers. Existing production gaps remain implementation obligations rather than newly discovered defects.

### Findings

**High-priority security defect in the proofs: an opaque context-union branch erased known private names.** A context schema with one branch declaring optional `userId` and another branch using an opaque transform returned no declared names at all. With trusted `{ kind: 'declared' }` and open application input, model `{ userId: 'admin' }` reached the implementation as its flattened `userId`. The initial probe reproduced this in Zod 3 and 4, ordinary/bound calls, and SDK generation/streaming. These are names visible in an actual schema, not the accepted limitation for names existing only in author intent or erased types.

The correction retains the union of names from discoverable context branches. It does not execute transforms, infer opaque names, consult raw context metadata, add a schema, or globally close input. Known names remain reserved even when their branch is inactive; explicit application declarations still make them public. Native SDK comparison preserves the distinction: its separate `options.context` does not gain model `userId` from public arguments. This is a defect in Casai's proposed flattening adapter, not a new native SDK vulnerability.

Four new runtime regressions first failed against the old discovery rule. After correction, they cover ordinary calls, `.run()`, bound/injected calls, bare/bound SDK generation and streaming, and rejection before successful input/approval callbacks. Neighbors cover unrelated extras, trusted forwarding and explicitly public `userId`. Discovery checks cover reversed branch order, an empty declared branch, fully opaque alternatives, and zero callback evaluation. Callable negatives already protect retained private names; the added cases keep that fact paired with runtime enforcement. A mutation restoring the all-or-nothing aggregation must reproduce all three composed failures.

**Medium: static admission omitted other consumers of input declarations.** The candidate checked configured values when deciding whether an input schema needed supported declaration discovery. Runtime also requires it for declared private-context names and executable registry fallbacks. A Zod 3 intersection with no configured values therefore compiled with either source and then rejected an ordinary valid call. Native parsing and the source-free Casai call succeed; explicit faithful metadata makes the private/registry cases work too. New compiler negatives initially failed because the calls were accepted.

Admission now includes bounded known output declarations and potentially executable registry entries, through construction, inheritance and binding. The type accessor follows the same supported public schema handles and does not treat opaque output types as discovered runtime names. Valid neighbors retain opaque-context ordinary calls, description-only registries, removed inherited tools and explicit metadata. Binding an opaque schema can still require declarations when its actual parsed context supplies names. Separate context/registry admission mutations exercise the two missing triggers. This changes no merge rule or supported runtime schema policy.

### Why earlier reviews missed these cases

The security tests covered fully declared unions and opaque transforms separately. One discovery characterization even asserted that a mixed union should lose all names; it did not execute a model call against the resulting boundary. The type tests paired unsupported schemas with configured values but omitted two independent discovery triggers. The revised process checks partial knowledge, execution consequences of characterizations, and runtime/type trigger parity.

### Subsequent consumer pass and remaining gates

The reverse pass traced `contextOutputNames` through both the older hybrid candidate and the combined candidate, then into argument validation, native hooks/approval, final execution and ordinary child forwarding. It kept application-name partitioning separate: incomplete application metadata is not made safe by partial private-name knowledge. The admission correction was checked against context wrappers, opaque output, inherited/removed registries and binding; native parsing/result normalization and reserved metadata retain their existing owners.

No additional policy choice emerged. Final factory/source signatures, full metadata projection/default annotations, per-run registry/settings capture, prepared renderer/runtime handoff, stream API integration, packed consumers and production-wide type cost remain explicit acceptance gates. This pass changes plans and isolated proofs only, not production factories or runtime dependencies.

### Verification

The seven Phase 2 runtime proof files passed **227 cases**. The final combined checker passed **48 runtime cases**, source and cross-compiler emitted-declaration consumers under TS7/TS6 in both optional-property modes, editor checks, and **21 independently caught mutations**. The mixed-union mutation restores the demonstrated model/private bypass; separate admission mutations remove the context and registry triggers. Mutation copies are restored independently and the temporary check directory is removed.

The representative instantiation budget passed: TS7 current/candidate **567,547 / 642,968**; TS6 **394,909 / 453,870**, both below the 2x ceiling. The separately changed hybrid runtime test also type-checked with both compilers; individual context-wrapper admission probes rejected all three unsupported cases. Targeted ESLint and `git diff --check` passed. No paid model calls or full production-suite run were used. These results validate the bounded candidate, not final production integration or a guarantee that no further defects exist.

## Security attack-path review, 2026-10-20

**No new private-binding replacement or private-value disclosure was reproduced in this pass.** This is a scoped result for the plan and isolated adapters. Production factories and the selected Cascada compiler/renderer handoff remain acceptance gates; this is not a release security sign-off. Two additional type-contract defects were found while compiling valid security probes and corrected in the combined candidate.

### Method and evidence

The pass started from attacker-controlled sources and authority/disclosure sinks, rather than another traversal of feature headings. It distinguished replacement of a private binding, mutation of shared data, disclosure through metadata/history/errors, and source/control injection. For each path it checked which private names are known before parsing and which become available only at execution. Native `ToolLoopAgent`, argument parsing/refinement, approval revalidation, context validation, tool execution and error conversion were inspected alongside the existing native comparison tests. The selected chain-resolution runtime's error and method-dispatch code was inspected; no old-runtime patch or completed renderer integration is claimed.

| Attack path / invariant | Evidence and result |
| :--- | :--- |
| Fresh model/direct input replaces a configured or declared private name | Existing strict/strip/open, mixed declared/opaque union, parsed-transform, ordinary-child and no-schema tests still reject retained collisions. Configured public defaults and unrelated extras retain their selected behavior. |
| Actual bare context supplies a private name unavailable during argument preparation | New generation/streaming cases omit configured declarations and use either no context schema or an opaque context transform. Model `userId: 'admin'` and `null` never enter the body; unrelated extras succeed with the trusted identity intact. A mutation retaining only preparation-time reservations must fail these tests. This final guard cannot retroactively promise earlier hook rejection for names unknown at that earlier boundary. |
| Native refinement/history changes input after fresh parsing | Existing final-guard and approval-continuation regressions were rerun. Native approval verification/revalidation and separate execution context remain their SDK owners; no alternate history trust mechanism was added. |
| One owner/sibling silently supplies another tool's private data | New injected-call coverage checks that a child sees its own dependency and selected context entry, while the owner's private field, sibling context and `_toolOptions.context` stay absent. Explicit trusted binding remains valid. |
| Nested validation errors disclose private values | New generation/streaming cases forward a private value into failing native tool-input validation, or reject a component output containing a private field. Both failures traverse another registered component. Native causes actually contain the sentinel; safe summaries, the real next provider request, response history and UI tool errors do not. The next request and UI error are asserted to exist. Earlier binding/context and lazy-element failure checks remain separate owners. |
| Public defaults/metadata/history publish unrelated private configuration | Existing binding/history and projection proofs were rerun. Named structured defaults are intentionally public in their entirety; full configuration-default annotations and final projection remain implementation gates. |
| Application data becomes executable source or invocation authority | Rechecked the existing structural `.run()`/source and `_toolOptions` rules and current dispatch consumers. Recognized source settings still mean trusted source; final keyword normalization and newer-runtime renderer integration remain unimplemented acceptance work. |
| Shared data is modified across invocations | Existing invocation isolation/native parser behavior remains the contract. Custom callbacks must be pure; accepted native `.readonly()` behavior and explicitly authorized external effects are not reclassified as Casai security fixes. Selected runtime read-only access is not argument provenance. |

The new cases are combinations of earlier obligations, not new restrictions: no second schema, global private namespace, origin tracker, deep-copy/freeze policy or private-override opt-out was introduced. Private-name diagnostics and opaque/type-only absent-name authoring limits remain explicit. Native/body/producer errors are not universally scrubbed.

### Additional typing defects

**Medium: output-schema checking rejected valid context-dependent producers.** For example, `component({ inputSchema: z.object({}), context: { label: 'ready' }, schema: z.string(), execute: input => input.label })` was rejected even though the callback receives a string and returns the required raw output type. The separate return check evaluated an uninferred `R` as `unknown`. Constant-return callbacks in the earlier output tests did not expose this interaction. Constraining the callback's return position fixes inference while preserving wrong-output rejection, raw producer types and parsed consumer results. New positives/negatives cover parsed input, configured/inherited context, async/no-input-schema producers, registered consumption and editor completion.

**Medium: helper inference collapsed alternative registered definitions.** A registry entry selected between two callable components could become `never` because the conditional inferred a shared definition from the whole union. The helper now distributes over alternatives and retains their separate callable/result types. A common empty call succeeds and private replacement stays rejected. This does not promise every generic-overload union has every constituent's call signature; normal TypeScript common-call limitations remain. The runtime nested-failure test now uses the actual typed helpers without erasing this valid call.

### Subsequent consumer pass

The reverse pass revisited argument and executor reservations, bare versus bound ownership, native versus injected validation, intermediate forwarding and final error publication. The new security cases passed before the type-only corrections; this pass did not repair an undiscovered runtime guard. Return constraints were then checked through ordinary/no-schema/inherited factories, async producers, registered helpers, source/emitted consumers and editor inference. Security mutations distinguish removal of actual-context checking from removal of the entire executor guard, and loss of safe error text from loss of the error wrapper.

The plan and review process now explicitly require this attack-path ledger and positive callback/alternative checks. No user policy choice remains from these findings. Final factory/inheritance integration, full metadata projection, per-run settings/registries, renderer/runtime handoff, streams, packed consumers and production-wide type cost remain visible gates.

### Verification

The seven runtime proof files passed **232 cases**, including **53 combined-candidate cases**. `npm run test:phase2-composed` passed TS7/TS6 source and cross-compiler emitted-declaration consumers, both optional-property modes, editor checks and **25 independently caught mutations**. New mutation checks cover raw producer return constraints, registered alternatives, actual bare-context reservations and private validation message isolation; the existing injected-input/output mutations now exercise nested model/UI transport.

The representative current/candidate instantiation counts were **567,524 / 650,615** with TS7 and **394,896 / 464,526** with TS6, below the existing 2x proof bound. Targeted lint and final source compilation passed; three test-local identifiers were renamed solely to satisfy the unused-variable naming rule. Whitespace checks passed and temporary proof directories were removed. No production source, SDK/runtime dependency, paid model call or full production test suite was changed or run.

## Protective-mechanism assessment, 2026-10-20

This is an evidence/status and architectural-control assessment following the freezing and stateful-component discussion. It is not another complete attack-path pass, an independent audit, or production security clearance. It introduces no runtime protection or new public API.

### Four requested completion checks

| Check | Current evidence | Outstanding work |
| :--- | :--- | :--- |
| Shared protections on every real entry and renderer path | The combined fixture enforces parsed-input and final-context checks, including ordinary forwarding. Current `src/validate.ts` still has the older `_toolCallOptions` marker-based validation routing. | Integrate the shared pipeline into all affected production factories, internal preparers, registered wrappers and the selected compiler/renderer. Verify no consumer re-merges unchecked input or bypasses preparation. |
| Execution, approval, history, errors and next-model-request tests | Real installed SDK generation/streaming, UI and continuation behavior is exercised with mock providers around isolated adapters. Tests assert body counts, actual subsequent requests and private sentinels in real publication paths. | Repeat through the exported production components and renderer combinations, including full model-facing projection. Native SDK integration in a fixture is meaningful but does not close this gap. |
| Generated schema/key/forwarding combinations | Existing files contain curated nested matrices, fixed special-name cases, and independently removed guards; the last recorded combined runner caught 25 deliberate faults. | No broad generated schema/path suite was found in the Phase 2 files. Add bounded reproducible generation with an oracle independent of the implementation, valid neighbors and minimized failures; retain runtime/type pairing. |
| Stable bindings versus intentionally mutable state, then independent integrated review | Binding capture/concurrent-isolation and native parser shared-reference cases exist. Recent stateful-body documentation and exploratory shallow-freeze examples do not establish the actual component/state contract. | Verify authorized effects, immutable dependency bindings and native ownership on real SDK/Cascada paths. The integrated implementation does not yet exist to receive the requested independent review. |

### Controls and recommendations

The threat is model-controlled application data reaching private authority, executable/control settings or unintended disclosure. Configuration, schemas and implementation callbacks remain trusted application code; this assessment does not turn Casai into a sandbox for arbitrary native code.

| Mechanism | Protection and limits | Recommendation/status |
| :--- | :--- | :--- |
| One shared parsed-input boundary plus final private-collision guard | Blocks retained private replacements, including transforms, native refinement/history and private fields discovered only at execution. Cannot reserve a name that has no runtime value/declaration. | Required; demonstrated in the candidate, not integrated everywhere. Keep known names even when other declarations are opaque. |
| Separate application input, trusted context, source and execution controls until the final body context | Prevents caller data from selecting trusted settings or fabricating validation provenance. Ordinary forwarding must meet the same argument rules. | Required; remove public marker-based bypasses and reuse internal prepared execution. No model-origin tracker or second author schema. |
| Own-entry maps and safe property construction | Prevents inherited keys/setters from changing defaults, registries or authority. Fresh JSON alone does not cover UI objects or schema-produced values. | Required; candidate corrections exist. Verify the complete renderer handoff instead of adding a blanket key blacklist. |
| Invocation snapshots and stable descriptor/context binding | Avoids top-level capture races and disagreement between advertised defaults, approved arguments and execution. Shallow snapshots do not isolate nested state. | Required under the existing binding contract. Do not silently relax it because effectful bodies are allowed. |
| Selected trusted dependencies and registered tools only | Avoids automatically forwarding owner/sibling authority into a child. A trusted implementation may explicitly forward needed dependencies. | Required and partly demonstrated. Application authors should provide the least authority the operation needs; Casai cannot infer policy inside arbitrary callbacks. |
| Safe Casai-owned validation summaries and separate native causes | Prevents automatic disclosure through owned input/context/output errors, including outer-tool conversion. Does not sanitize arbitrary body errors, deliberate results, custom logging or prompts. | Required; retain real provider/history/UI transport assertions and native error ownership. No universal secret scrubber. |
| Shallow freeze of the final Casai-owned context; shallow readonly callback types | Can catch accidental top-level assignment, deletion or replacement. Does not repair an unsafe merge, freeze nested state or establish Cascada read-only semantics. Types alone do not enforce runtime safety. | Subsequently deferred by the user. No automatic freezing or readonly type change is part of the current security work. |
| Native Cascada read-only references and supported effect scopes | Protect supported language writes while allowing explicitly authorized external operations at the right scope. Neither provides argument provenance or cross-execution coordination. | Reuse native facilities; actual compiler/renderer integration remains a gate. The ownership constraint below must be honored. |
| Closed local input schemas and provider strict mode | Reduce accepted/generated argument shapes. Provider metadata alone does not perform local validation, authorize private overrides, or constrain trusted transforms. | Available author choices, supplementary to mandatory local protection. Do not force a closed schema or silently alter native strictness. |
| Operation authorization and SDK approval | A correctly bound identity still needs authorization for the requested action/resource. Approval can gate an operation; it does not replace permission checks or isolate mutable state. | Use application/service authorization and the existing native SDK approval contract. Add no parallel approval engine or implication that `!` is authorization. |
| Deep freeze/copy, pervasive proxies, global identity locks, taint tracking or a new stateful-tool API | These do not directly close the demonstrated substitution/disclosure gaps and introduce compatibility, identity, lifecycle or concurrency machinery. | Do not add as generic Phase 2 defenses. A future concrete requirement needs its own evidence and contract; shallow context freezing does not require them. |
| Executing untrusted generated source in a sandbox | Addresses a different trust boundary: code execution itself, rather than tool arguments passed to trusted implementations. | Do not implicitly promote model strings into source. If executing model-generated code becomes a product requirement, evaluate isolation separately; context freezing cannot supply it. |

### Stateful integration constraint

The selected sibling runtime's `docs/data-limitations.md`, under “Managed data ownership,” says that a mutation-capable external identity must belong to one execution; the same external identity may be shared across independent executions only when observation-only. Its `docs/integration.md` also retains that single-execution ownership restriction. This is more specific than the existing “no global lock” explanation.

**Subsequent user clarification:** this restriction is a host contract, not cross-execution enforcement. `src/execution.js` owns a separate identity map for each execution; `src/external-mutation-tree.js` detects competing locations within that map. Sequential reuse after prior work has finished is acceptable. Concurrent side effects across independent executions remain the host's responsibility, while tracking across calls is planned upstream. No new Casai scheduler, freezing mechanism or legacy-runtime patch follows from this clarification.

### Next review and verification

Another targeted review is warranted now for state ownership and the chosen hardening mechanism, with bounded generated cases extending the shared adapter evidence. The decisive implementation review follows integration through real factories and renderers; repeating a clean fixture pass cannot substitute for it. No claim that all possible protective mechanisms or attacks have been exhausted follows from this assessment.

This pass read production routing, the combined fixture and its real SDK publication assertions, Phase 2 test matrices/mutation runner, installed native SDK execution/approval ownership, and the selected runtime's host contract. Only documentation/acceptance criteria changed. No runtime suite was rerun and no new passing test count is claimed.

## Generated security and consumer review, 2026-10-20

The user asked to continue strengthening the security evidence, defer freezing, and treat cross-execution state ownership as a host obligation. This pass adds executable tests and revisits production consumers. **No new private-binding replacement or private-value publication bypass was reproduced in the bounded candidate.** That is not a claim about the unintegrated production API or arbitrary trusted application code.

### Scope and independent expectations

The new `tests/Phase2SecurityGenerated.unit.test.ts` enumerates a finite grammar, with case IDs in failures:

- Four schema protocols: native Zod 3, native Zod 4, SDK schemas with validators, and Standard schemas with explicit raw metadata.
- Strict, stripping, open and catchall policies; plain/optional wrappers, async transforms creating a private-key collision, and transforms removing/renaming a public default.
- Nine key names, including prototype-shaped, numeric, dotted and generated non-ASCII names.
- Configured private bindings, actual incoming private bindings, and declared optional names absent before native context parsing.
- Ordinary, named `.run()`, and explicitly bound calls where applicable; omitted defaults, public overrides/unrelated extras, direct collisions and transform-created collisions.

This is **16,128 application scenarios** in 64 test groups. The expected private name and public fallback are declared by the test generator, not calculated with `inputNames`, `contextOutputNames`, `pickOwn` or the adapter's guard. Native validation supplies only the schema's parsed result. Each scenario checks whether execution is permitted, body-entry count, actual private identity, parsed public values, removed-default absence and source preservation. An omitted private name remains reserved without inventing a value.

The first run exposed two incorrect test assumptions, corrected against native behavior: parsing a declared optional `constructor`/`toString` can materialize the inherited native value, and native parsing can strip an extra `__proto__` before Casai sees it. The oracle now compares native parsed trusted context and native retained application keys. Stripped input may execute with the private binding intact; retained collisions may not. Neither observation justified a new Casai parser restriction or a security fix.

Additional tests cover **243 attack/valid-neighbor forwarding pairs** across one to three hops and ordinary, named and registered destinations, including actual schema-less leaves. The SDK matrix exercises 96 generation/streaming invocations with configured, bare actual and declared private context, body assertions, actual next-provider requests, full response-message histories and UI chunks. Separate native-path tests cover own registered tool selection, input repair, source/control-shaped application fields, private execution metadata, sequential stateful JavaScript/SDK calls, and approval continuation.

### Source-to-sink review

| Boundary | Evidence from this pass and retained checks | Remaining boundary |
| :--- | :--- | :--- |
| Fresh/parsed model arguments into private execution bindings | Generated local/SDK cases; final actual-context checks; retained mixed declared/opaque union and hook/refinement regressions | Complete production factory integration |
| Forwarded public values into another component | Generated one-to-three-hop direct/run/registered calls; no-schema destinations; typed companion private-name cases | Real injected keyword normalization and renderer handoff |
| Raw defaults restored after parsing | Root-removal scenarios and a mutation that restores raw defaults; direct inspection of current Function and engine merges | Replace known old merges in production and hidden preparers |
| Model-selected tool names into execution | Own registered names succeed, unregistered prototype-shaped/ordinary names do not execute, in native generation/streaming | Preserve SDK ownership during factory integration |
| Repair/refinement/approval history into execution | New repair probes; existing late-refinement, approval/private-input and UI tests; signed-history tampering rejects before effects | Real owner/UI registry projection and production forwarding of native settings |
| Data promoted into source, configuration or controls | New control-shaped data and metadata-spoof tests; re-traced `call-arguments.ts`, renderer adapter, factories and `llm-component.ts` | Current marker routing is a known unimplemented correction; literal/loaded renderer controls need real-path tests |
| Private values into schemas, records, errors or subsequent requests | New full SDK call/history/UI assertions; retained nested validation/error/stream-element tests | Full metadata projector and production owned-error handoff; arbitrary body/log/prompt publication remains application-owned |
| State changes or cross-invocation interference | New authorized sequential state changes with blocked identity/session replacement; retained independent binding/snapshot cases | Cascada compiler/effect-scope integration; concurrent external effects remain a host responsibility |
| Native parsing/default/copy behavior | Native comparisons in the generated oracle and retained parser probes | Preserve accepted native behavior; do not add freezing/copying machinery |

The consumer pass rechecked current `validate.ts`, `renderer-tool.ts`, Function execution, Script/Template factories and engine merges, prompt-renderer construction, LLM dispatch, argument normalization and error consumers against the existing source inventory. These still contain known Phase 2 migration work; a passing prototype does not protect those paths. Installed SDK parsing/repair, own-tool lookup, context validation, execution and approval revalidation/signing were traced to their owning modules. The selected runtime's identity maps and registration checks were read directly; no global cross-execution enforcement was inferred.

### Stateful approvals and scope limits

Native `ToolLoopAgent` and the Casai descriptor both execute an effect again when the same valid approved history is submitted in a new invocation. The comparison covers generation and streaming, with and without `experimental_toolApprovalSecret`. Signed input tampering is independently rejected with the native signature error and no extra effect. Signature integrity therefore does not imply replay prevention. The application/service owns operation authorization and any required idempotency/deduplication; Casai adds no approval store or parallel signing mechanism. README and plan now make this distinction explicit.

The user's clarification supersedes the earlier cross-execution wording: separate executions have separate identity maps, competing registrations are checked within one execution, and sequential reuse after completion is acceptable. Unsafe overlap is a host-contract violation rather than an automatically detected Casai condition. Future tracking across calls remains upstream work. No freezing or cross-execution scheduler was added.

A comprehensive assessment must also avoid expanding the claim: private binding protection does not authorize arbitrary queries/URLs/paths accepted by a trusted tool, make deliberately returned private data confidential, sandbox model-generated source, or impose a resource budget on arbitrary host code. Those operations need their own application/service permissions and existing native controls. Casai must not silently promote arguments into those authorities. The accepted absent/type-only private-name limitation remains explicit; tests do not relabel it as protection. No new author schema, private namespace or origin tracker is introduced.

### Evidence quality and remaining work

Three added semantic mutations discard parsed application output, restore raw public defaults, or exempt schema-less calls from both private checks. An initial mutation removing only the schema-less final check survived because the earlier check still enforced the same ordinary path; it was a redundant-check mutation, not evidence of an exploitable bypass. The revised exemption mutation tests the actual architectural regression and is caught. Existing independent mutations retain the separately necessary pre-approval and actual-context final checks.

The generated runtime suite is registered in `test:local` and the combined proof runner. Static companions exercise raw/parsed names, configured omission, prototype/non-ASCII private names and stateful callbacks through real callable overloads, including emitted declarations. Dynamic/adversarial fixture casts are labeled and do not stand in for those compiler checks.

This pass improves the third requested completion item (generated coverage) and supplies bounded sequential-state evidence for the fourth. It does not complete production integration, the selected renderer/compiler handoff, every schema combination or an independent implementation audit. Those remain assigned gates. The subsequent consumer pass found no additional candidate correction to make after the new checks; no production runtime, dependency or sibling runtime file changed.

### Verification

The final eight-file Phase 2 runtime run passed **317 tests**, including **85 generated/security test groups**. The 16,128 application scenarios and 243 forwarding pairs are inner cases, not additional Mocha test counts. Native signature-failure probes can print expected diagnostic errors through the SDK's default stream handler; the assertions consume the actual error parts and verify no extra effect. Existing private-cause diagnostics remain intentionally available to trusted local diagnostics.

`npm run test:phase2-composed` passed TS7/TS6 source checks, both optional-property modes, cross-compiler emitted consumers, editor checks and **28 caught semantic mutations**. The final approval-comparison additions also passed separate TS7/TS6 checks in both optional modes and the final runtime run above. Representative instantiation counts remain **567,524 / 650,615** for TS7 and **394,896 / 464,526** for TS6, below the existing 2x proof bound. Targeted ESLint and whitespace checks passed. No paid model calls, full production suite, automatic freeze, production integration or cross-execution scheduling was introduced.

## Protection mechanisms and integration sequencing, 2026-10-20

The user asked to assess the remaining protection options now and assign later enforcement work to the plan. The [mechanism assessment](phase2-protection-assessment.md) covers admission, private guards, structural prepared entry, maps, snapshots, forwarding, publication/errors, schema strictness, native selection/approval, history association, service permissions, state/concurrency, source/loader isolation, resource limits, diagnostics, distribution and proposed extra machinery. It separates demonstrated candidate behavior from native limitations, application responsibilities and production gates. Freezing remains deferred.

The important clarification is that native tool selection, approval and authentication are not a single permission boundary. New native/candidate probes in `tests/Phase2NativeSecurityControls.unit.test.ts` cover generation/streaming, provider settings, real body effects and valid neighbors:

- `activeTools: []` and empty direct caller routing block unexpected fresh direct model calls, but do not revoke an already approved registered call in incoming history. Native denial is rechecked on continuation; removing the executable tool prevents its local execution. `toolChoice: 'none'` is not a local execution denial.
- A valid signed approval can execute in a new invocation with different private tenant context under the same signing key. The signature authenticates public operation fields, not tenant/session ownership. No argument guard can infer the host's authenticated conversation association from that signature.
- A trusted native parent or Casai injected helper can call a child executor without the child's model-loop approval flow. Approval on the outer operation and indispensable service permissions remain the applicable controls.

These are native-scope findings, not new private replacement defects in the candidate. Earlier tests emphasized argument invariants, signature tampering and replay, but did not cross the same controls with continuation policy, private identity and coded forwarding. The review process now requires that lifecycle matrix. An initial source-only suspicion about streaming caller restrictions was rejected after the probe and the upstream parsing path established the actual behavior.

The plan now explicitly requires: establish shared enforcement in the Function slice, connect and test each consumer during its slice, close actual lifecycle/publication and selected runtime checks, then perform independent integrated review and a subsequent complete consumer pass. Internal handoffs, final guards, removal of legacy marker/raw-remerge paths and semantic mutations are concrete acceptance work. No production consumer row is closed by the fixture.

The new suite is included in `test:local` and the combined proof runner's runtime/source compiler checks. The current pass does not add production code, change merge/API behavior, introduce generic security machinery, or claim that every possible future improvement is exhausted.

Verification: **14 new runtime groups pass**, with TS7/TS6 source checks in both optional-property modes, targeted ESLint, runner syntax and whitespace checks. The adapter/signatures did not change; existing emitted/editor/mutation checks were not repeated. The closing consumer-to-obligation reread leaves the production gates explicitly open and found no additional justified mechanism to add to the selected design.
