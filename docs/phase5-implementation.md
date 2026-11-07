# Phase 5 implementation and verification

Implementation date: 2026-11-03. The installed reference is `ai@7.0.162`, `@ai-sdk/openai@4.0.108` and `@ai-sdk/provider-utils@5.0.74`. Development, peer and direct dependency floors and the lockfile now match that baseline. Earlier review notes retain their original version scope. The historical `docs/phase5-review.md` referenced by the plan is absent from this checkout; this record describes the implementation actually inspected and tested.

## Public surface and execution owners

The 2026-11-03 naming follow-up uses plain component names consistently in source files, factory declarations, named exports and `create`. Experimental AI SDK dependencies remain explicit in JSDoc and user guides; SDK identifiers are unchanged. The unreleased prefixed Casai names have no compatibility aliases.

| Export | Native owner and ordinary result | Tool execution result |
| --- | --- | --- |
| `Decision` | `experimental_decide`, native typed answers/distributions/metadata | Answers |
| `Embedder` | `embed` or `embedMany`, selected from the unified string/string-array `input` | One vector or vectors |
| `Reranker` | `rerank`, preserving document types and identity | Native ranking entries |
| `ImageGenerator` | `generateImage`, native files and metadata | `{ mediaType, base64 }[]` |
| `Transcriber` | `transcribe`, native transcript and metadata | `text`, `segments`, `language`, `durationInSeconds`; transcript text by default to the model |
| `StreamingTranscriber` | `experimental_streamTranscribe`, live SDK result | Prepared tools only: the same four application fields from existing final promises |
| `SpeechGenerator` | `generateSpeech`, native audio result | `{ mediaType, base64 }`; default model confirmation |
| `StreamingSpeechGenerator` | `experimental_streamSpeech`, live SDK result | No collected-audio tool |
| `StreamingTranslator` | `experimental_streamTranslate`, live SDK result | No collected-audio tool |
| `VoiceSessionSetup` | Native realtime model token creation; `prepareSessionConfig` and `createWebRTCSession` | `executeTool` uses the existing bound-tool runner |

Each component has shorthand and `.run()`, immutable configuration selection and inherited settings. Text-capable operations expose all meaningful existing source modifiers. Audio inputs expose native input, function, script and loaded-script preparation. Completed operations support `.asTool`; live transcription requires a configured preparer and format for tool execution. Specialized components add no Agent facade, `.asStream`, generation loop or universal result envelope. The export and modifier matrix is checked through source and emitted consumers, including exact optional properties.

Each specialized component has its own implementation file, owning its native settings, shorthand, dispatch, tool projection and operation-specific types. Shared construction and preparation helpers handle configuration, modifiers, source/context resolution and tool binding without component-name dispatch. The existing renderer now also prepares native non-message values and explicit structured text slots. It continues to delegate compilation, concurrency and loading to Cascada. Shared execution exposes its existing registry runner for voice calls, preserving actual call IDs, cancellation, raw argument validation, native executable-tool normalization and bound context. There is no new transport, approval loop, session store or audio runtime.

## Context and source boundary

Public defaults come only from schema-declared fields in `config.context`, followed by declared bound-tool-context defaults, followed by caller/model arguments. The shared boundary parses that merged application input and retains selected private dependencies separately. Configured and bound private names, including `username` and `password`, cannot be replaced by model arguments. Neither unrelated configuration fields nor private context fields become advertised defaults. Parsed values are used without a second application parse.

Native source fields are independent of that context. An ordinary `image('authored text')` does not parse the text through the payload schema; `.run({ prompt, context })` supplies both explicitly. A plain tool selects only its documented parsed operation-input field. Payload properties never spread into configuration or request settings. A private context field named `prompt` does not implicitly become the operation input. Custom public argument names and conversion of arbitrary application values use a preparer. `.asTool` components retain ordinary callable/native-result behavior as well as their SDK descriptor projection.

## Native inspection and interaction review

The implementation inspection followed installed ToolLoopAgent/Agent and tool contracts into argument/context validation, approval/history, native tool execution and streaming. Operation-specific inspection covered embedding batching, reranking documents, image prompt normalization, decision state/answers/refusal, recorded/live audio, realtime tool definitions and OpenAI token/Live WebRTC capabilities. Tests use native SDK mock models or the real provider adapter with fake fetch responses; no paid/provider-live tests were run.

The SDK upgrade changes several existing native behaviors. Fresh forbidden calls under `toolChoice: 'none'` now fail before tool execution. Missing local tool results can reject continuation before provider dispatch. Native stream error events and final promises retain their own timing. Native prompt standardization no longer performs the same deep envelope validation as the exported message schema; Casai's existing message-envelope validation remains explicit. Native-only canaries and affected comparison tests were updated instead of adding compatibility machinery.

The first implementation review corrected:

- Application defaults accidentally inferred from native source settings, and private same-named source selection.
- Required context, annotated no-schema preparer inference, configured image-only calls and inheritance through reusable `Config`.
- Script-produced reranker pairs and named source replacements that change whether separate documents/media are required or forbidden.
- Optional embedding and reranking replacements, which must include both supplied and configured result types and accept undefined omission in both optional-property modes.
- Union-valued source/context calls, which must check every context branch for private and undeclared fields.
- Descriptor callback output inference, using the same schema/source-derived projection as the returned tool.
- Native model completion unions expanding quadratically in generic intersections. A compact string union preserves native accepted values and bidirectional assignment without weakening caller or callback checks.

Image coverage crosses text updates, separate configured media, inherited mask clearing, invocation media replacement, empty split arrays, native complete objects, explicit/prepared bundle ownership, and actual SDK/injected tools. Native complete bundles retain their own empty-array behavior. The ordinary Config merger owns inheritance; invocation images reset a configured mask separately.

Structured source coverage preserves media, tool data and history; only explicit text slots render. Independent slots use normal concurrent renders while preserving native order. Existing marked Cascada keywords keep the rendered-agent history exception. Explicit structured sources can use an ordinary context object or named `.run({ prompt, context })`; no new arity or undefined discriminator was added.

Live stream coverage crosses operations, inheritance, frozen input identities, failed preparation, pre-cancellation and failed SDK attempts. One shared weak identity set records only actual ReadableStream handoff immediately before native dispatch. No reader, replay buffer, mutation, external-consumption detector or generic iterator registry was added. Live errors, partial events and final results remain native, including error events followed by successful completion.

Voice coverage checks native token/session fields, omission of empty tools, the native Live error for nonempty tools, unsupported capabilities, credential ownership, bound public defaults, private metadata exclusion, execution IDs, cancellation and per-call trusted context. `executeTool` returns execution output directly, without language-generation `toModelOutput`. Application routes own authentication, context matching, browser preference validation and JSON-null transport for completed undefined results.

## Verification ledger

| Check | Result |
| --- | --- |
| `npm run test:types` | Source, emitted consumers and exact-optional consumers pass; 95 README2 examples and 51 promoted/current README examples checked, 3 future examples skipped |
| `npm run test:coverage` | 1,757 passing; 99.85% statements/lines, 100% functions, 97.14% branches; existing global and per-file thresholds pass |
| `npm run lint` | Final full source/test lint passes with all configured rules enabled |
| `node tests/fixtures/phase2-production-mutations.cjs phase5` | All seven mutations detected: repeated stream handoff, retained stale mask, private source selection, skipped structured rendering, lost tool call ID, invalid audio modifier, missing prepared transcription tool |
| `node tests/fixtures/phase2-production-editor.cjs` | Source/declaration completion, callback types and named diagnostics pass in both optional-property modes |
| `node tests/fixtures/phase2-factory-cost.cjs` | All existing workloads and the three new comparison workloads pass; existing ceilings unchanged |
| `npm run test:package -- --engine C:/Projects/cascada` | Clean paired tarball installation, explicit consumer compiler, emitted declarations and runtime execution pass without workspace resolution |

Final measured first-batch/additional-component instantiations are 19,525/11,831 for function-prepared Embedder and 6,247/5,145 for the template ImageGenerator tool. Both remain within the unchanged 22,000/13,000 and 12,000/6,000 ceilings respectively. All other factory workloads pass their existing budgets. These are source workload measurements on the same compiler, not whole-application performance claims. Shared callback discovery keeps the existing structured-streaming LLMAgent within its original 2,300 additional-component limit (2,297 measured).

A subsequent complete pass re-inventoried exports, modifiers, shorthand/named calls, effective source overrides, native results, descriptor projections, inherited defaults, private bindings, preparation, streaming handoff and voice helpers. It traced ordinary, SDK-bound and injected consumers back to the existing owners and checked source/emitted declarations and documented examples. No important unresolved Phase 5 implementation finding remains; the separately tracked release boundary below remains open.

The review process now explicitly calls for native upgrade canaries, source/default provenance checks, native interface versus mock declaration comparisons in both optional-property modes, and bidirectional checks when simplifying large SDK unions. Existing coverage thresholds and type-cost ceilings were not relaxed.

## Release boundary

The workspace uses the built Cascada candidate in `C:/Projects/cascada`. The paired package check packs both candidates and installs them outside the workspace, without relying on links. This does not establish compatibility with published `cascada-engine@0.6.2`, which lacks existing required exports, or complete the separately tracked newer compiler/renderer handoff. Publish the coordinated engine version and raise Casai's engine floor before releasing the package. Phase 6 native Cascada streaming and the separately scoped server audio/session loop remain deferred.

## Simplification review (2026-11-03)

The final simplification moves component behavior into ten files under `src/factories`, following the existing component layout. The earlier review over-weighted shared dispatch and under-weighted how many unrelated branches a reader had to follow to understand one component. The component split removes that dispatch without adding a strategy framework or changing the public API.

### Ownership after the rewrite

- Each component owns its native settings and supported keys, source/tool modifiers, shorthand tail, SDK invocation, tool result projection and specialized callable types. ImageGenerator owns image/mask assembly; Reranker owns complete query/document pairs; VoiceSessionSetup owns its three additional methods.
- `src/factories/component-factory.ts` handles common construction and factory inference. Local component definitions supply capability facts to both runtime and types; shared modifier constants avoid repeating their spellings. No component-name conditionals select behavior.
- `src/runtime/component-call.ts` handles the common source/context prefix, configuration merging, source preparation, native request projection and callable/tool construction. Components supply only their actual syntax differences and call the SDK directly.
- `src/types/component.ts` retains common source, context, call and run types. `src/types/component-map.ts` is a type-only inventory connecting the existing generic public types to their owning components; it creates no runtime registry.
- `src/runtime/live-input.ts` holds the one shared ReadableStream identity set. All three live components claim inputs at the same boundary immediately before native dispatch.

The files contain implementations, not forwarding adapters. Ordinary calls, named calls and tool execution still converge on each component's invocation function. Components preserve native SDK results and use the existing Cascada renderer and bound-tool runner.

The ownership follow-up also moved Reranker document-result inference out of common call types, put tool-result projections and streaming-transcription tool requirements beside their implementations, and removed StreamingTranslator's dependency on a sibling component's argument type. Shared calls reuse `ContextArguments` from the existing input types; shared audio-format arguments live with call types, and the image/speech file payload lives with result types. Construction owns native-setting declarations, while invocation owns execution settings and preparation facts. Public transcript and voice result types export directly from their owning components. The helper names describe responsibilities, not a separate category of Casai components; the public generic types are `ComponentConfig` and `Component`.

### Shared mechanisms retained

Configuration still uses the ordinary shared Config merger. A shallow-overlay experiment passed the covered cases but introduced another merging convention without a measured performance need. That shortcut was rejected. Component key declarations continue to drive construction admission, named-call admission and native request projection; an exhaustive type check compares them with native settings.

The shared application-schema boundary, private-name protection, configured public-default selection and fixed tool bindings protect actual model-input and approval/history invariants. Native SDK parsing alone does not supply those Casai contracts. The plain-tool public-name check also remains necessary: a private context binding named like the native source must not silently become that source.

Complete image-bundle ownership, split media replacement and authored-source versus payload separation implement selected public semantics. Their complexity now lives with ImageGenerator. The stream identity set remains a small accidental-reuse guard; streaming and completion stay SDK-owned. Transcript tool snapshots consume existing native final promises, avoiding the competing fullStream view.

### Follow-up verification

The follow-up pass covered all ten exports, modifiers, shorthand/named/tool paths, inherited settings, source preparation, result projections, live handoff and voice helpers. It traced source and emitted consumers through the shared helpers and compared the moved dispatch with the previously inspected SDK owners. The shared modules contain no component-name dispatch, and exports point directly to the component files. The package gate also rejects obsolete generated modules after the rename.

Coverage exposed missing ordinary speech/transcription assertions after their shorthand handlers became separate functions. Tests now compare shorthand and named native calls, undefined forwarding, configured defaults, voice overrides and model-output projections. The complete modifier matrix and two policy mutations moved from the isolated experiment into maintained fixtures. Editor checks now include specialized modifier availability, parsed preparer context and tool formatter output.

The verification ledger above records the final checks: runtime coverage, source/emitted/exact-optional types, editor checks, all seven mutations, unchanged compiler budgets, full lint and clean paired-package installation. A subsequent complete pass found no important unresolved implementation issue. The separately tracked engine release boundary remains unchanged.

The review process now explicitly assesses how much unrelated code a reader must traverse for one component, alongside independent policy definitions and total machinery. Shared infrastructure does not require centralized component-name dispatch.

## Complete component inventory (2026-11-04)

The inventory now covers all fourteen callable components, including LLMAgent, Function, Template and Script. Each owns its definition, configuration and callable types. `ComponentKind`, `ComponentConfig` and `Component` cover that complete surface; reusable `Config` fragments take their alternatives from the same inventory. `Config` itself remains a fragment rather than a callable component. Factory signature aliases used only by their owning modules stay private.

All factories use `createComponentFactory` for configuration processing/inheritance, source selection, tool/stream modifier installation and registry validation. The duplicate LLMAgent and coded-component construction paths and separate Template/Script modifier builders are removed. Definition metadata supplies defaults and capabilities; component validators and executors retain their actual contracts. Function has no source modifier, Template/Script retain their fixed rendering modes, and LLMAgent retains native Agent methods, continuation and hook inference. The existing Script loader-tool alias is preserved. There is no runtime component registry or new SDK execution adapter.

The review crossed every public callable export with the type inventory and traced ordinary, named, inherited and tool calls through the shared constructor. Source and payload boundaries, private bindings and SDK dispatch are unchanged. Type assertions cover the older components through the public generic types, including parsed output, raw input and private-context protection. Three mutations remove inherited source selection, explicit tool mode and component validation; existing modifier and Phase 5 mutations cover the remaining changed construction paths.

Compiler profiling now includes the complete inventory even when importing one factory. Callable factories share a 450,000-instantiation import budget, replacing the earlier 400,000/800,000 family split; reusable Config fragments and native SDK controls retain their separate limits. Additional-instance limits are unchanged. The LLMAgent native-method first-specialization allowance is 8,000 (previously 7,300): explicit internal SDK types and deferred signature expansion shift some work from import to first use. This is an intentional budget reconciliation, not a claim that all old ceilings passed unchanged. No runtime validation, schema/inference assertion or compiler option was weakened.

Final verification passed:

- All 1,757 mock runtime tests; coverage remains 99.85% statements/lines, 100% functions and 97.06% branches, with unchanged coverage thresholds.
- Full `test:types`, including source and emitted declarations, both optional-property modes and checked README examples; TS7 editor completion/diagnostic checks also pass in all four profiles.
- Full lint identified eight local issues; the corrected files pass the follow-up lint run. The final construction mutations and all seven existing Phase 5 mutations are caught.
- All sixteen compiler-cost workloads pass the reconciled budgets. The native-method workload uses about 482,000 instantiations for twelve components versus the prior 500,000, despite the higher first-specialization delta after import work was reduced.
- The paired Cascada package installs and executes outside workspace resolution, and its declarations pass with an explicit consumer compiler. `git diff --check` is clean.

A subsequent complete ownership/consumer pass found no important unresolved issue. The pre-existing coordinated engine release boundary remains unchanged. Verification logs are under `.cache/phase5-components/all-components-*`.

## Shared component policies and call types (2026-11-04)

Completed factories now apply the same definition-owned requirements: fixed required settings, loader requirements, inline-source requirements and tool prerequisites. LLMAgent's configured tool prompt and StreamingTranscriber's tool audio format are declarations consumed by both runtime and types. Native request keys still come from SDK-owned settings; component-specific validation remains with its existing owner. Reusable Config fragments remain incomplete and continue using the ordinary configuration merger.

Template and Script share one renderer factory signature in `component-factory.ts`, alongside the shared source-factory signature and constructor. Their own files retain definitions and output contracts. Factory families reuse parent, final-configuration and source-mode resolution. Descriptor callbacks still infer parsed Script output; broad LLMAgent annotations retain their previous conditional required-setting behavior.

Template and Script use the common source/context parser and prepared-source argument tuples. Configured sources accept `(undefined, context)` and explicit undefined source fields in `.run()` under both optional-property modes. Readonly configuration handles and `.run` methods follow the same authoring contract across families, without runtime freezing. Decision and VoiceSessionSetup each declare their fixed invocation settings once for runtime and types.

The follow-up interaction pass found that omission and replacement can admit different positional tails: a configured Reranker preparer owns its complete query/documents pair. Shared tuples retain that distinction. Positional validation reuses the existing array/function role check so a documents array cannot masquerade as an open context object. Literal native inputs retain SDK assignability, including arrays supplied through native iterable contracts. Paired runtime/type cases and mutations cover this distinction, forwarding, private bindings, configured defaults and fixed settings.

Final verification passed on the settled implementation:

- All 1,760 runtime tests; coverage is 99.77% statements/lines, 100% functions and 97.47% branches. Coverage thresholds are unchanged.
- Full source, declaration, exact-optional and checked-guide type checks; all four source/declaration editor profiles; full lint.
- Six construction/call runtime mutations, seven existing Phase 5 runtime mutations, six factory-type mutations and three invocation-type mutations are caught.
- All sixteen compiler-cost workloads retain their existing limits. Consolidation trades some import work for per-instance work: Template imports change from 409,512 to 406,471 instantiations and additional instances from 2,916 to 3,137; Script changes from 409,617/3,031 to 406,471/3,191. Embedder changes from 399,423/11,837 to 414,244/12,004, and ImageGenerator from 401,649/5,156 to 423,191/5,347. These are modest increases in some workloads, not a claimed universal compiler-speed improvement.
- The paired Cascada package passes isolated installation, declaration compilation and execution. Removed helper-module artifacts are absent from source and generated output; `git diff --check` is clean.

A subsequent complete pass through all fourteen definitions, construction consumers, callable types, invocation policies and SDK dispatch owners found no important unresolved finding. Native result/lifecycle differences, bundle ownership and application/private-context separation remain deliberate component contracts. The review process now includes omission versus replacement tails explicitly. Logs are under `.cache/phase5-components/unification-*`.

## Simplification experiments after unification (2026-11-04)

Construction validation now owns the configured-cancellation prohibition for both fragments and completed components. Config relies on the ordinary merger's raw validation, then validates the completed fragment; debug output follows successful validation. Shared invocation keys and the prepared tool-invocation type live with execution, including LLMAgent's consumer. These changes remove duplicate policies without adding another construction or SDK execution path.

Template and Script share one renderer component declaration, replacing their separate callable wrappers and renderer-call alias. Their files still own definitions, configuration and result contracts. All callable families now reuse context selection and supplied-key accounting. Interface-typed payloads are accepted without an index signature, and source overrides preserve private/undeclared-key checks. Contextual callbacks retain configured public defaults; a context-specific inference overload shares the existing validation and result calculation with the general forwarding signature.

Each larger candidate was tested independently:

| Candidate | Decision | Evidence |
| --- | --- | --- |
| Move Template/Script onto the newer input-dependent callable signature | Reverted; retained the smaller shared renderer declaration | The migration changed reflected Script results and rejected configured-default callback calls. Repairing the prototype added handling without eliminating the older signature required by Function and LLMAgent. |
| Validate fragments only through common construction rules | Reverted | Twenty-two fragment checks failed, including inherited incompatible settings and source-mode mismatches. Types still rejected those fragments. Removing useful early validation or building a replacement compatibility system did not justify the reduction. |
| Share application-context selection across callable families | Kept | Interaction probes exposed newer-component drift for interface payloads and contextual callbacks. The shared rules preserve the runtime boundary and remove separate type interpretations. |
| Infer prepared calls by expanding every allowed tuple into an overload | Reverted | ImageGenerator grew to 9,282 instantiations per additional component against its unchanged 6,000 budget. Splitting every first-argument alternative also rejected valid forwarding unions. One context-inference overload plus the general signature preserves both contracts. |

Ordinary configuration merging, component-specific execution, native SDK ownership, source/payload separation and complete-bundle ownership remain unchanged. The remaining distinction between fixed-result callable signatures and input-dependent results is intentional; the experiments do not establish that every possible unification has been exhausted. The review process now checks interface payloads, overload diagnostics and tuple-expansion cost explicitly. Experiment snapshots and logs are under `.cache/phase5-components/simplification-*`.

All sixteen compiler workloads retain their existing limits. Compared with the preceding unification pass, additional Template/Script instances change from 3,137/3,191 to 3,147/3,201 instantiations, Embedder from 12,004 to 12,137, and ImageGenerator from 5,347 to 5,600. Import costs stay nearly unchanged. The retained inference correction costs modest additional checking; it is not a compiler-speed optimization. Source/declaration editor checks also preserve diagnostics naming private fields, which required keeping the general signature last.

Verification of the retained implementation passed: all 1,761 runtime tests, unchanged coverage thresholds (99.77% statements/lines, 100% functions, 97.47% branches), source/emitted/exact-optional and checked-guide types, all four editor profiles, six construction/runtime mutations and thirteen type mutations. Full-repository lint found only two stale type imports from the ownership move; both were removed and the affected file passed its lint rerun. The paired Cascada package passes isolated installation, declaration compilation and execution. The final ownership/consumer pass covered all fourteen callable definitions and their shared construction, context and invocation consumers, with no important unresolved finding. `git diff --check` is clean. Verified logs use the `simplification-*` prefix; failed prototype logs are retained separately as experiment evidence.

## Removing duplicate paths (2026-11-04)

This follow-up removes 39 net production lines (34 added, 73 removed), without new helpers or configuration options. Standalone construction now uses the ordinary merger with an empty parent; `processConfig` and its duplicate snapshot/loader processing are deleted. The factory applies modifiers to that freshly owned result before component creation, eliminating another copy. Config diagnostics come from the merger once, and their debug flag comes from the merged settings.

Plain-tool admission is a direct step with cached declaration lookup, replacing a nested asynchronous helper. Configured source fallback uses default parameters. The shared preparation result no longer carries `payloadInput`: tool execution supplies no invocation settings, so complete image payloads already follow the existing native-object path. A native comparison covers a schema-produced empty image bundle replacing configured images and mask. Named-call settings now reuse `ComponentRunSettings` instead of repeating its context/cancellation/tool-context fields.

The final pass covered all fourteen construction consumers, standalone/inherited map and loader rules, source omission, tool admission and image bundle ownership. Tests now exercise standalone snapshots through the public Config factory; obsolete mutations were removed or moved to the surviving merger. All 1,761 runtime tests pass, with 99.77% statements/lines, 100% functions and 97.41% branches. Source/declaration/exact-optional and guide checks, four editor profiles, 17 runtime mutations, three invocation-type mutations, all sixteen unchanged compiler budgets, lint on changed files and the isolated paired Cascada package pass. The additional native image-bundle assertion also passes its focused runtime/type checks. No important unresolved finding remains in this pass. Logs use `.cache/phase5-components/reduction-*`.

## Claude review experiments (2026-11-04)

This pass removes 109 net production lines relative to its starting working tree (ignoring line-ending and trailing-blank differences). The user confirmed two contract changes: reusable Config fragments receive common runtime checks, with component-specific checks at completion; explicit invocation media/documents override complete explicit or prepared bundles. These decisions supersede the earlier fragment-kind heuristic and competing-bundle rejection recorded above. Static fragment checks, ordinary configuration merging and the source/application/private-context boundaries remain intact.

| Proposal | Decision and evidence |
| --- | --- |
| U1/U2: configuration validation | Kept. Delete fragment kind guessing and duplicate prompt checks. Function, Template and Script use definition-owned closed settings; LLMAgent keeps native pass-through with its own retired-setting policy. Constructor signal/schema/name checks remain shared. Tests now assert the selected final-component boundary. |
| S1: bundle field overrides | Kept. One image field-override path covers configured, explicit and prepared bundles. New images drop the old mask unless the call supplies one; masks alone retain images. Untouched native empty bundles still preserve SDK edit semantics. Reranker invocation documents override prepared documents and determine the native result document type, including optional overrides. Remove complete-input conflict checks and ImageGenerator's corresponding type machinery. Reranker still needs configured-versus-replacement tails and a query-only document requirement; they are not conflict checks. |
| D2: image fallback | Kept. Remove the unreachable configured-text fallback; source resolution already selects configured input. |
| S2: type registry | Kept after a prototype and compiler checks. A single registry indexes module-owned Types interfaces; selectors supply the few default fields. Avoid an additional generic base hierarchy. The registry change alone removes 11 lines across its owners. Public root types and contextual inference remain checked in source and declarations. |
| C1/C2: runtime and setting ownership | Keep the smaller bound runtime: preparation, native request assembly, argument parsing and callable creation share one component definition. Fixed and common invocation keys are resolved once. Image request keys still exclude its flat media conveniences; VoiceSessionSetup retains signal-free session configuration and cancellation checks around asynchronous tool definition preparation. Constructor, SDK-request and invocation policies have different meanings and remain distinct. No new provider-options policy is added. |
| U3: one runtime for coded and native components | Prototyped and reverted. Sharing preparation and callable assembly was feasible, but preserving coded components required custom rendering, descriptor/provider-option handling and output collection. The corrected prototype still changed four existing argument-error cases from promise rejection to synchronous throw. Retaining it would need further policy or wrapping and did not provide a convincing reduction. |
| S3: one callable-type engine | Retried and reverted. Moving Template/Script onto CallableComponent rejected existing valid renderer calls and changed reflected Script/tool contracts (13 source-check diagnostics). Removing complete-bundle conflicts did not remove these inference differences. |
| D3: three-state tool-support flag | Prototyped and reverted. The modifier matrix passed, but the flag added runtime/type translation and one net line. Explicit supported-mode arrays reuse the existing source modes directly. |
| D1: shallow invocation merge | Not applied, following the user's prior decision to retain the common configuration merger. |

Verification logs are under .cache/phase5-components/claude-*. The final runtime suite passes 1,739 tests with unchanged thresholds: 99.84% statements/lines, 100% functions and 97.70% branches. The lower test count reflects replacing obsolete fragment-specific rejection cases with the selected completion checks. Source, emitted, exact-optional and guide types pass; six type mutations and nineteen runtime mutations are caught. All sixteen existing compiler budgets pass without increasing limits (ImageGenerator marginal instantiations: 5,862/6,000; Embedder: 12,208/13,000).

All four editor profiles pass (source/declarations, both optional-property modes). Lint passes for all changed source and test files after correcting two test callbacks with unsafe implicit returns. The isolated packed consumer passes with the paired Cascada package; final source/declaration/exact-optional checks also pass after keeping TranscriptSnapshot directly defined by the native SDK shape. The final focused runtime checks pass 59 cases. A subsequent complete pass over all fourteen definitions, fragment/completion boundaries, source/context handling, invocation policies, native requests and public type consumers found no important unresolved finding. git diff --check is clean.

## Further simplification review (2026-11-04)

This is a review with isolated experiments, not another production rewrite. The inventory covers all fourteen callable components, reusable Config fragments, modifiers, ordinary/named/tool calls, VoiceSessionSetup methods and exported types. It follows factory definitions into configuration merging, context preparation, source rendering, native dispatch, output consumers and declaration inference. The current user-approved fragment and bundle-override contracts take precedence over earlier review records.

| Finding | Proposed simplification and evidence |
| --- | --- |
| One representation of effective execution settings | `PreparedComponentCall` carries both `input` and settings whose main field can still contain authored source. `request()` overlays the input again; Reranker passes query separately while updating documents, ImageGenerator supplies another input override, and VoiceSessionSetup repeats the overlay. Put the rendered value in the freshly merged invocation settings, then let each component finish its native fields there. Remove the separate input member and request input parameter. Retain the ordinary merger, original configuration, supplied-field provenance and separate application/trusted context. The isolated prototype changes four files with no net line reduction; its benefit is one invariant and fewer overlays. All 1,739 runtime tests and source/build/emitted/exact-optional type checks pass. Removing the rendered assignment causes both selected structured-source integration tests to fail. |
| One callable/runtime assembly for coded and native components | Revisit U3: its four previous failures were invalid-call diagnostics becoming synchronous throws, not failures of valid calls. Making the common callable and `.run()` wrappers async passes all 1,739 runtime tests without changing assertions, plus source/build/emitted/exact-optional types. Installed native `ToolLoopAgent.generate/stream`, image, speech, transcription and rerank entry points are async too. The six-file prototype adds two net lines but removes a second preparation/call/run/tool assembly. Preserve coded rendering/autoescape, schema output and stream collection, native descriptor `type: 'function'`, and the real distinction between descriptor-owned and inner-SDK provider options. LLMAgent's history/hooks/continuation remain separate. Adopting promise rejection for newer components' malformed calls is an explicit contract choice, not a claimed behavior-preserving implementation. |
| Derive repeated configuration type entries | Ten module-owned Types records repeat `SourceComponentConfig<K, P>` and `ComponentFactoryShape<K, PromptType, true>`. Use those as registry selector defaults, as already done for prepared/template inputs, retaining explicit older-component overrides. The isolated prototype removes 20 net production lines across eleven files, passes source/build/emitted/exact-optional types and all sixteen existing compiler budgets without increases. ImageGenerator and Embedder marginal counts remain 5,862 and 12,208. This does not require a generic base hierarchy or moving component behavior back into a central switch. |
| Retire unused legacy public vocabulary if compatibility is unnecessary | `Script.loadsScriptAsTool` duplicates `.loadsScript.asTool`; ordinary coded components alone expose the legacy `FunctionCall`/`Template`/`Script` type labels. Searches found declarations, tests and the README2 alias explanation, but no production consumers in Casai or the installed Cascada source. Removing them reduces API concepts and a runtime-unification exception. They are public APIs, so this remains a compatibility decision; native SDK tool `type: 'function'` must stay. No deletion was prototyped. |

The two small structural/type reductions are recommended. Runtime consolidation is now a viable candidate under the explicit async invocation rule; the previous U3 rejection was too conservative about malformed-call timing. These experiments were run independently, not combined. They establish feasibility, not integration sign-off: no fresh combined editor, coverage or packed-consumer gate is claimed. Logs and isolated source trees are under `.cache/phase5-simplification-review`; `all-types-result.json` and the runtime result JSON files record successful process exit statuses.

Retain the load-bearing distinctions: fixed-result versus input-dependent callable inference (the earlier S3 experiment broke valid renderer calls and reflected Script/tool results), Reranker configured/replacement document requirements, image split clearing versus native complete-bundle semantics, and private/public context partitioning. Voice session configuration must remain signal-free with cancellation checked around asynchronous tool-definition preparation. The small shared ReadableStream reuse registry implements the selected single-use contract; binding snapshots and comparisons preserve fixed public defaults through native tool validation. These are not generic brand registries or defensive clone planners. Cheap argument diagnostics can stay without making their historical failure timing an architectural requirement.

The follow-up pass traced these proposals through all fourteen owners and downstream consumers; no additional simplification justified new policy or machinery. Findings remain proposals above. Production source and tests were not changed in this review. The review process now distinguishes supported semantic failures from malformed-call timing before rejecting a prototype, and checks duplicate prepared representations before adding adapters.

## Shared invocation simplifications retained (2026-11-04)

The user authorized implementation of the clear reductions and evaluation of the remaining proposals. All four are retained after combining and checking them. This pass removes 21 net production lines relative to that starting tree; the main gain is fewer representations and assembly paths.

- The effective source now lives in invocation-local settings. ImageGenerator and Reranker finish their native fields there; VoiceSessionSetup selects its signal-free session fields from the same representation. The separate prepared input and request override parameter are gone. Original configuration, supplied-field provenance, application parsing and trusted context remain separate, and the ordinary configuration merger is retained.
- Function, Template and Script now use the common runtime for preparation, callable/`.run()` construction and tool binding. Their module still owns Cascada rendering, autoescape and output validation. Definition-owned fixed settings preserve their invocation surface. Native request keys distinguish inner SDK provider options from coded-tool descriptor options without a new policy flag. Output stream collection reuses the existing bound-tool runner. LLMAgent keeps its native history/hooks/continuation pipeline, and callable-type engines keep their established inference contracts.
- Registry defaults replace the ten identical config/config-shape pairs. Each module retains its genuinely distinct settings, inputs, results and callable types.
- The redundant `Script.loadsScriptAsTool` alias and ordinary coded component type labels are removed from implementation, types, tests and guides. `.loadsScript.asTool` remains the canonical form, and SDK tools retain `type: 'function'`. The now-local source argument parser is no longer exported. Calls and `.run()` consistently reject promises on invocation errors; construction errors remain synchronous.

Verification passes for all 1,739 runtime tests with unchanged coverage thresholds: 99.84% statements/lines, 100% functions and 97.69% branches. Source, emitted, exact-optional and checked-guide types pass, as do all four editor profiles, all sixteen compiler-cost budgets and full-repository lint. Marginal ImageGenerator and Embedder costs remain 5,862/6,000 and 12,208/13,000. Twenty-six runtime mutations are caught, including new independent mutations of resolved source assignment, descriptor provider options, coded output parsing and tool stream collection. The isolated package installs and passes declarations/execution with the paired Cascada package; the existing coordinated engine release dependency is unchanged. `git diff --check` is clean.

The subsequent complete pass covers all fourteen component owners, reusable fragments, source modes, ordinary/named/bound/injected calls, media/document overrides, output consumers, VoiceSessionSetup methods and generic type consumers. It found no important unresolved implementation issue. No compatibility adapters, component-kind dispatch table or parallel SDK execution machinery were introduced. Evidence is under `.cache/phase5-simplification-review/implementation-k9MkFy`.

## Independent implementation audit (2026-11-04)

This audit found five issues in the retained implementation, resolved in the follow-up below. The audit itself superseded the preceding clean-review conclusion without changing production source or tests. The inventory includes all fourteen callable components, Config, modifiers, shorthand/named/tool entry points, VoiceSessionSetup methods, native results and exported type consumers. The pass follows configuration, source/context preparation, SDK dispatch and result consumption, comparing the installed SDK's agent/tool protocols and relevant native functions. Existing source/payload separation and the user-approved fragment and bundle-override decisions remain the reference contracts.

### 1. Empty child configuration bypasses completed-component type checks

`SourceFactory` places its final checks inside `ValidateResolved<C, ...>`. An empty child retains the provisional inference constraint, so the sentinel skips checks even after the parent configuration is known. These calls compile in source and emitted declarations, including exact optional consumers:

```ts
create.Embedder({});
create.Embedder({}, create.Config({ input: 'text' }));
create.Decision({}, create.Config({ model: 'provider/model' }));
create.Embedder({}, create.Config({ model: 'provider/model', temperature: 0.2 }));
```

The corresponding missing-setting constructors fail at runtime. More seriously, an inherited function preparer annotated with `{ value: number }` can accompany `z.object({ value: z.string() })`; `Embedder({}, parent)` compiles, then a schema-valid call fails in the preparer. A nonempty child rejects that mismatch. Function, Template and LLMAgent reject their missing-setting control cases. Separate inference deferral from final resolved validation; do not weaken the completed-component contract or introduce another runtime validator.

### 2. Positional omission types disagree with the shared parser

`ContextTail` admits secondary arguments without context, while `sourceArguments` consumes a leading plain object as context and a leading string as source. With a configured function preparer and no configured format, both `transcribe(format)` and `transcribe(undefined, format)` compile but omit the SDK format and fail. `transcribe({}, format)` and `.run({ inputAudioFormat: format })` work, as does the native control.

The same mismatch affects other roles: a configured function speech preparer accepts `speak('alloy')`, then fails because the voice was treated as a function source. A prepared translator accepts `translate(format, 'fr')` but dispatches an undefined format; with a configured format, `translate('fr')` mistakes the language for source. Explicit context/placeholders and named calls work. Make omission depend on the actual source mode and unambiguous argument roles in both types and parsing. Preserve explicit context or named fields for genuine object/string collisions; do not inspect application property names to infer intent.

### 3. Reranker has competing interpretations of document completeness

`HasPreparedDocuments` and `ToolRequired` treat the presence of any complete return branch as a guarantee. `RunCheck` only requires documents when the entire return type is a string. Consequently a function returning `string | { query: string; documents: string[] }` can omit documents on ordinary, named and tool paths. All three fail inside native `rerank` when the string branch is selected. Complete branches and explicit invocation documents work.

Conversely, shorthand requires separate documents for a replacement function that always returns a complete pair; named calls and runtime accept that replacement without them. Derive the document requirement from all possible effective source branches and reuse that rule across the three paths. Preserve the deliberate runtime opacity of script results and query-only preparers rather than adding a source-analysis mechanism.

### 4. Reusable Config still assumes language-agent callback ownership

`FragmentCallbacks` is always `AgentCallbacks`. A native embedding `onEnd` callback is accepted directly by Embedder but rejected by Config because it does not accept a language-generation event. New function preparers also lack fragment context inference: `Config({ promptType: 'function', inputSchema: z.object({ count: z.string().transform(Number) }), input: context => String(context.count) })` infers `context` as `never`, while direct `Embedder.withFunction` infers the parsed number. An explicit context annotation works.

The public fragment registry is broader than its callback inference/validation consumer. Remove the assumption that an owner-neutral fragment has agent callbacks; share schema-driven preparer context inference and let the completed owner supply native callback semantics. Deferring owner-specific fragment checks is a possible simplification, but changing the retained early static-check contract requires an explicit decision and validation of existing inference guarantees. A parallel fragment callback interpreter would add the wrong kind of complexity.

### 5. Native callback generic information is erased

Embedder derives settings from `Parameters<typeof embedMany>` and the common factory selects callbacks from that already-erased shape. Native `embedMany({ runtimeContext: { requestId: 'r' }, onEnd: event => ... })` infers `event.runtimeContext.requestId` as `string`; the equivalent Embedder callback sees `unknown`. This is reproduced separately from Config. Preserve the native runtime-context generic when selecting the completed component's callback type; avoid re-declaring SDK event structures. Reranker and Decision use the same erased-settings approach and need equivalent checks when correcting the shared owner.

### Evidence and architectural assessment

Counterexamples and valid neighbors are under `.cache/phase5-audit-2026-11-04`. `verify-accepted.cjs` confirms the erroneous acceptance cases in source, emitted and exact-optional declarations. `run-types.cjs` records valid-call rejections and inferred callback/context failures in those profiles. `runtime.ts` reproduces dispatch/preparer failures with SDK mocks and native controls; no paid provider calls are needed. The runtime baseline still passes all 1,739 tests and coverage thresholds (99.84% statements/lines, 100% functions, 97.69% branches). These new interaction cases expose gaps in that passing baseline. A compile-time inventory also confirms that the ten newer definition key lists cover their admitted SDK settings.

The useful structural reductions are one effective-source completeness rule, one positional-role contract and callback ownership at the actual component boundary. The common runtime, ordinary configuration merger and per-component modules remain appropriate. Private/public context partitioning, source provenance, native descriptor handling, native stream semantics and the selected live-input reuse guard continue to protect real contracts; this pass provides no reason to replace them with a universal signature engine, adapter layer or additional defensive runtime machinery. The previously documented coordinated Cascada release gate remains open.

The audit's follow-up pass traced the findings through the shared helpers and all component owners, broadening the shorthand counterexample from transcription to speech and translation. The findings remained unresolved at that point, so the audit did not establish implementation sign-off. The review process added explicit checks for empty-child inference, mixed-completeness producer unions, positional collisions, fragment callback ownership and native generic inference.

## Audit corrections (2026-11-04)

The user confirmed owner-neutral SDK callbacks in reusable Config: annotate them in the fragment, then validate them at the completed component. Child overrides retain native contextual inference, including a child whose only property replaces an incompatible inherited `onEnd`. Schema-driven Function implementations and function-mode source preparers still infer their application context.

| Finding | Retained correction |
| --- | --- |
| Empty children bypass final checks | Capture supplied keys independently of context-sensitive functions so an empty child still validates the resolved configuration. The existing provisional mechanism continues to defer checks during inference. Remove the redundant object intersection that reduced missing-setting diagnostics to `never`. |
| Positional roles disagree | Only string-source modes consume a leading string as source. Function-mode voice/language tails work directly. Prepared calls require an explicit context slot before an object-shaped format; arrays and binary media retain their unambiguous omission forms. |
| Reranker completeness drifts | One `NeedsDocuments` invariant covers configured producers, named calls and tools. Every typed producer branch must be complete or have fallback documents. A component-local shorthand alternative admits complete replacement functions. Script output remains runtime-owned. |
| Config assumes an Agent owner | Delete the fragment callback combiner and its parallel approval checks. Keep common shape and known tool-name checks; completed components own SDK callback compatibility. Infer preparer context from the existing schema/context calculation. |
| Native callbacks lose runtime context | Parameterize the existing SDK function types for Embedder, Reranker and Decision. Preserve definite and optional runtime-context overrides before contextualizing callbacks; reuse the ordinary configuration merger. No SDK event structures are copied. |

The larger Reranker prototype, which added generic call checks to the registry and every callable, was discarded. The retained version keeps the extra rule with Reranker and uses existing argument helpers. Separating inherited callback validation was also discarded: independent key inference permits one final callback check after overrides. No runtime adapter, validation engine or configuration option was added.

The subsequent complete pass covers all fourteen component owners and Config, their modifiers, ordinary/named/tool paths, inherited settings, structured rendering, media/document overrides, native result consumers, live-input handoff and VoiceSessionSetup helpers. It traces the shared merger, preparation and bound-tool runner into the existing LLMAgent, Function, Template and Script paths. No important unresolved implementation finding remains. Source/payload separation, private-context protection, native descriptor/stream behavior and the selected live-input identity guard remain load-bearing. The coordinated Cascada release gate remains separate from these fixes.

Verification is recorded under `.cache/phase5-fixes`:

- All 1,742 local runtime tests pass; coverage is 99.84% statements/lines, 100% functions and 97.78% branches. The dispatch correction and source/context interactions are exercised through SDK mocks, including configured fallbacks and complete replacements.
- `npm run test:types` passes source and emitted consumers, exact optional properties, 95 README2 examples and 51 current/promoted README examples. Three future examples remain explicitly excluded. The four editor profiles cover source/declarations and both optional modes, including callback-only overrides, preparer completion and missing-setting diagnostics.
- All sixteen compiler-cost workloads stay within their existing budgets. All 21 targeted Config/component/Phase 5 type mutations and 14 runtime mutations are caught. Optional callback and runtime-context replacements have valid and invalid neighbors.
- Full lint identified local fixture/style issues; the corrected files pass the focused lint recheck. The direct key-capture mapped type retains one documented lint exception because its `Partial<Record<...>>` equivalent exceeds the measured ImageGenerator budget.
- The packed consumer passes with `npm run test:package -- --engine C:/Projects/cascada`, including emitted declarations and execution outside workspace resolution. The dependency must still be released in coordination with Casai; this check does not close that publication gate.

No provider-live tests were needed. The user guides, plan and agent notes record the confirmed fragment callback contract, and the review process now includes callback-only and optional inherited replacements.

## Repeat composition audit (2026-11-04)

This pass finds five further Casai contract/type issues. It supersedes the preceding clean-review conclusion. Production code and existing tests are unchanged; the counterexamples and isolated type experiments are under `.cache/phase5-repeat-review`. The user reiterated that inherited SDK limitations are accepted: these findings concern Casai's composition, native-input adaptation and type inference, not requests for another SDK validation or streaming runtime.

### 1. No-schema inheritance loses private dependency compatibility and poisons replacement inference

An inferred function preparer has both known private properties and an open context index signature. `ValidateConfiguredDependencies` selects keys in the wrong direction: `Extract<string, 'prefix'>` loses the identifiable private name. Meanwhile `BranchExecutionContext` intersects the retained callback's old private-field type with the new binding. These two mechanisms can accept an incompatible retained implementation:

```ts
const parent = create.Embedder.withFunction({
  model, context: { prefix: 'ok' },
  input: ({ prefix }) => prefix.toUpperCase(),
});
await create.Embedder({ context: { prefix: 42 } }, parent)();
```

That code compiles, then throws before SDK dispatch. Own `undefined` behaves similarly, and the same defect reaches Function. Direct invocation of the retained preparer with a number is correctly rejected. Explicit callback annotations and schema-backed preparers also reject the incompatible inheritance.

Conversely, replacing the preparer with `input: ({ prefix }) => prefix.toFixed(1)` should work with the new number binding, but the inferred parameter becomes `string & number`, hence `never`. This is a composition invariant problem, not a reason to add runtime checks against deliberate configuration corruption.

**Structural opportunity:** reconstruct configured private bindings from the resolved configuration, as the existing execution-context types already do for injected helpers. In an isolated copy, omitting configured names from the old callback context before assembling the new context rejects all three bad inheritance cases and restores replacement inference, even with the separate configured-dependency guard disabled. Merely correcting the guard's key selection rejects the valid replacement as well. This is bounded feasibility evidence; broad integration and cost checks are still required before deleting that guard.

### 2. Source-mode unions admit calls valid for only one possible mode

A configuration union with a complete literal input in one branch and a complete function input in the other is accepted. The resulting component accepts both `component('replacement')` and `.run({ input: 'replacement' })`. Both fail when the runtime branch is function mode: shorthand reports an unexpected argument, while named execution tries to use the string as a function. The no-replacement call succeeds on either branch.

`SourceArguments` combines allowed tuples across modes, and the returned component loses the correlation between the selected mode and its configuration. Named source settings have the same problem. Preserve checking against every possible configuration, or require narrowing mixed source modes before constructing/calling the component. Do not infer mode from a replacement value or introduce another runtime routing policy. This extends the existing caller-union requirement to the configuration that creates the callable.

### 3. Plain tools can advertise valid payloads with no possible required native input

The plain-tool compatibility check removes `undefined` before comparing the parsed main field with the native input type. Consequently an empty schema, an optional `input` without fallback, or a root transform removing `input` all produce accepted Embedder tools. A schema-valid injected call then sends an undefined value to native `embed` and fails. Configured source fallbacks and schema defaults are successful controls.

Native `embed({ value: optionalInput.input })` is rejected by its own TypeScript contract. Casai should retain that required-input contract when adapting a tool, accounting for its supported configured fallbacks and component-specific source forms. This calls for checking the resolved input contract, not trial-parsing schemas, inspecting callback behavior, or adding a parallel runtime validator. The SDK continues to own execution errors.

### 4. Supported callback aliases bypass native inference and owner-neutral fragments

Embedder and Reranker expose `experimental_onEnd`, but shared callback discovery is based on the language-generation callback keys, which omit this alias. Its `runtimeContext.requestId` therefore becomes `unknown` while native `embed` and the preferred Casai `onEnd` infer `string`. A reusable Config containing an explicitly typed native `experimental_onEnd` is rejected as incompatible with every component, despite the confirmed owner-neutral fragment contract.

Derive callback handling from each component's native settings. Keep native event types and native alias behavior; no event adapter is needed. This is a remaining ownership mismatch in the shared type machinery, rather than a limitation of the SDK callback.

### 5. Parent constraints reject settings that a child completely replaces

`SourceFactory` constrains the parent to the target owner's settings before merging. For example, an Embedder child supplying its own embedding model cannot inherit a Config fragment containing an image-model instance, even when that model is the only conflicting property. The final merged configuration works at runtime, and native `embed({ ...parent.config, model: embeddingModel, value: 'x' })` compiles and succeeds.

The completed configuration should determine compatibility for replaced data fields. Retained executable dependencies still require the checks described above. Moving compatibility to that final boundary could remove an unnecessary early constraint and make the types agree with the ordinary merger; it does not require changing runtime inheritance.

### Evidence, scope and remaining work

`verify.cjs` reproduces the accepted failures and unintended rejections against source under the repository's compiler mode, plus emitted declarations under both optional-property modes. It also checks the guard-only and context-reconstruction experiments in isolated source copies. `runtime.ts` executes the inheritance, tool-input and mixed-mode failures with SDK mocks, with successful native/default/replacement controls. No paid calls, dependency changes or production edits were made. The full runtime suite was not repeated for a review-only change.

The complete inventory was revisited: all fourteen components, Config, modifiers, ordinary/named/tool consumers, structured rendering, source/media precedence, private/default assembly, native result views, live input and voice methods. The subsequent pass broadened the inheritance finding to Function and checked both positional and named mixed-mode calls. No additional category emerged beyond the five recorded here, but these unresolved findings prevent implementation sign-off.

Native stream consumption/failure behavior, parser/default/reference behavior and realtime capability limits remain owned by their respective SDK/runtime. This pass found no justification for new defensive clones, integrity registries, completion machinery or an alternate execution layer. The most promising simplification is the execution-context reconstruction in finding 1; the coordinated Cascada publication gate remains unchanged.

## Composition fixes and simplification trial (2026-11-04)

The implementation follow-up retains the context reconstruction from finding 1. Configured names, like injected helpers, are removed from a retained callback's historical context before assembling the final execution context. The existing implementation-compatibility checks now reject incompatible inherited private bindings and infer replacement preparers from the new bindings. `ConfiguredDependencies` and `ValidateConfiguredDependencies` were deleted. Reusable schema-free fragments still defer private-dependency compatibility while checking their output and known helper contracts; finished components check the complete context. No runtime guard was added.

The plain-tool check now reuses the effective `ToolInput` type already used for result inference. Selection follows the runtime's declared input names, then uses parsed values or the configured source fallback. This catches empty schemas, optional sources and transforms that remove a required source. A second-pass control also caught transforms that invent an undeclared source field: that field does not select the operation input. ImageGenerator owns its exception for configured image-only input. Native runtime errors remain native.

Native callback keys on completed source components come from their own SDK settings. Owner-neutral Config fragments also recognize embedding/reranking callback aliases; native event types and canonical-versus-alias precedence remain unchanged. Parent native settings are checked after merging, in both SourceFactory and LLMAgent, so definite overrides can replace an incompatible parent model while retained incompatible values remain errors.

The mixed-mode return-union prototype was **reverted**. It rejected unsafe replacements, but also rejected valid replacements on same-mode configuration unions because TypeScript could not combine their generic call signatures. A second isolated prototype distributed only over source modes: it preserved same-mode calls but still rejected safe text/template replacements and `.run({})`. Neither is retained. At this point the alternative of requiring narrowing mixed source modes before construction was pending the user's answer, so finding 2 prevented a clean implementation sign-off. The user subsequently rejected that restriction; the implementation below preserves shared safe calls. The same issue affects LLMAgent and the default branch of an optional `promptType`.

All 1,745 mock runtime tests, the additional image-only tool control, and all sixteen existing compiler-cost budgets pass. Config remains at 9,268 marginal instantiations, Embedder uses 12,352/13,000 and ImageGenerator 5,964/6,000. Full source/declaration checks and all four editor profiles pass. Twenty-eight targeted type mutations are detected: the added LLMAgent final-settings mutation initially survived the required-model control, so a retained optional-setting control was added and the mutation rerun successfully. Full lint found only TS6's older replacement-preparer inference in tests; explicit numeric locals retain the TS7 inference assertions and the corrected files pass focused lint. No lint rules or budgets were relaxed.

The follow-up inventory revisited all component settings/source/tool contracts and their shared consumers. It broadened parent-setting validation to LLMAgent, added declaration-based tool-source selection and verified image-only tools. Inference of a contextual embedding `toModelOutput` may conservatively include scalar and batch outputs until the configured source is inferred; the returned descriptor retains the configured result type. No extra inference layer was added for that safe approximation. The final exact-optional consumer check, focused runtime checks and packed consumer check pass; packaging used `--engine C:/Projects/cascada`. Finding 2 was the only unresolved category from this pass, addressed below. The linked Cascada publication gate is unchanged. Logs and rejected prototypes are under `.cache/phase5-repeat-review`.

## Safe calls across source modes (2026-11-05)

The user requires safe mixed-mode calls to remain usable without narrowing before construction. Components now intersect their modes' argument/settings contracts, preserving each mode's alternative call forms. This retains configured calls, shared string replacements, secondary inputs and named settings while rejecting replacements that fail in any possible mode. Configuration stays paired with its mode when checking construction requirements, context and results. Optional source modes include the default, and discriminated LLMAgent annotations retain their selected/default mode. Explicit modifier overrides and continuation still use their existing semantics.

Checking structural intersections alone was insufficient: functions, arrays and native media can match broad context objects. The existing positional-role check now evaluates each original mode contract, including native URLs, binary inputs, streams and iterables. Named context remains a separate boundary. Tool payload parsing/dispatch, SDK execution, rendering and streaming are unchanged; this fix introduces no runtime branch or validator.

The shared single-mode shortcut in `CommonInputs` reduced compiler work and was retained. Splitting argument/settings evaluation into another lazy abstraction increased work and was reverted. A separate fast path for the older callable types saved too little to justify another branch and was reverted. The existing duplicate union detector now lives in one type helper. Public declarations retain one callable component instead of a union of generic functions.

The interaction checks cover omission and undefined forwarding, same-mode and mixed-mode unions, shared string/media/voice/history calls, required context, source/result correlation, loaded branches, annotation narrowing, native continuation and VoiceSessionSetup methods. Plain/prepared tool controls cross ordinary named calls, SDK descriptor parsing/execution and injected execution, preserving source/payload separation and parsed values. A downstream result assertion caught one remaining loss of mode pairing in tool projections: a known scalar Embedder tool incorrectly included batch results. Tool input/result selection now uses the same paired mode contracts.

All sixteen compiler-cost workloads pass. The extra type checking has a measured cost; only the ceilings exceeded by the retained implementation changed:

| Workload | Initial / additional instantiations (rounded) | Previous ceilings | Current ceilings |
| --- | ---: | ---: | ---: |
| Function tool | 10,276 / 9,040 | 11,000 / 9,000 | 11,000 / 9,200 |
| Template | 4,085 / 3,476 | 4,000 / 3,400 | 4,200 / 3,600 |
| Script | 4,114 / 3,507 | 4,100 / 3,500 | 4,200 / 3,600 |
| Structured LLMAgent | 5,010 / 2,415 | 10,000 / 2,400 | 10,000 / 2,500 |
| Streaming structured LLMAgent | 5,018 / 2,420 | 8,200 / 2,300 | 8,200 / 2,500 |
| ImageGenerator tool | 7,303 / 6,055 | 12,000 / 6,000 | 12,000 / 6,300 |

Config's marginal cost also rose from 9,268 to 12,232 within its unchanged 16,000 ceiling. Function-prepared LLMAgent and Embedder remain within their unchanged 22,000/13,000 ceilings. Import ceilings are unchanged. These are compiler instantiations, not execution overhead. Prefer the retained common contracts over further special-case machinery solely to reduce these counts.

Verification passes: 1,751 mock runtime tests; 99.84% line/statement, 100% function and 97.94% branch coverage; full source, emitted-declaration and exact-optional checks; 95 README2 examples and 51 current/promoted README examples; all four editor profiles; 38 targeted type mutations; all sixteen cost workloads; lint (full run followed by passing rechecks of reported and subsequently changed files); and the packed consumer with `--engine C:/Projects/cascada`. Three future guide examples remain explicitly excluded. Evidence is under `.cache/phase5-mode-calls`.

The subsequent complete pass revisited all fourteen component owners and Config, their modifiers and public types, shorthand/named/bound/injected calls, source/context resolution, media/document overrides, native results and output consumers, continuation, live inputs and VoiceSessionSetup methods. It found no further important unresolved implementation issue after the native-source-role and tool-result corrections. The review process now checks mode pairing through downstream projections, rather than stopping at call acceptance. Native SDK/Cascada execution and capability limits remain unchanged, and the coordinated Cascada publication gate remains open.

## Further interaction audit (2026-11-05)

This fresh review finds four further categories of Casai issues and supersedes the preceding clean-review conclusion. Production source and existing tests remain unchanged. The inventory again includes all fourteen components, Config, modifiers, ordinary/named/tool calls, source/context preparation, output consumers, LLMAgent continuation and VoiceSessionSetup methods. Native comparisons use the installed `ai@7.0.162`, `@ai-sdk/provider-utils@5.0.74` and `@ai-sdk/openai@4.0.108`; no provider calls were made.

### 1. Image shorthand still disagrees across runtime and types

With configured text and reference images, `image(maskBytes)` is accepted by the callable types. The literal parser in `ImageGenerator.ts` skips arrays and numbers but consumes a `Uint8Array` or `ArrayBuffer` as prompt source. In the reproduced SDK request, the text prompt becomes the byte array and `mask` is absent. Both `image(undefined, maskBytes)` and `image.run({ mask: maskBytes })` send the intended configured text and mask, matching native `generateImage`.

The prepared path has the opposite problem. With an application schema, `image(maskBytes)`, `image(undefined, maskBytes)` and `image({ subject: 'tree' }, maskBytes)` can work at runtime but fail type checking. `CallContext` treats binary media as an object context; on ImageGenerator it can also treat a binary second argument as the context following a complete source object. `CallContextKeys` consequently assigns media members to the application payload. The recent positional-role check prevents some unsafe calls but does not correct this separate context extraction.

Keep the selected shorthand contract: binary masks are unambiguous secondary inputs. Fix literal source selection and make context/key extraction follow the same argument roles. Do not remove the shorthand, add a source wrapper, inspect application field names, or add native image validation. This is a Casai argument-routing problem; the native positive control sends the same valid media correctly.

### 2. Plain tools can select injected helpers as native input

`createComponentRuntime.prepare()` reads the native tool input from `prepared.context[main]`, after private bindings and injected helpers have been assembled. A declared input name is not proof that the final context value came from parsed application data.

The reproducer uses an Embedder tool with configured `input: 'fallback'`, an input schema `z.object({ input: z.string() }).transform(() => ({}))`, and a registered helper also named `input`. The transform removes the public field, so the existing context assembly correctly exposes the helper fallback. The plain-tool adapter then sends that helper function to native `embed` as its value. Types predict a scalar embedding using the configured source fallback. The defect occurs through descriptor execution, injected execution and a real native `ToolLoopAgent` with mock models. Removing the matching helper or retaining the parsed input field restores the expected string. An equivalent native SDK tool uses the configured fallback correctly.

Preserve parsed application input separately from assembled execution context through tool dispatch. This requires no second schema, parse, clone or helper-name ban. An isolated prototype reuses `ToolInvocation` as one executor argument containing `{ input, context, registry }`, retaining the already parsed input and reducing tuple-to-object repacking. Plain tool selection reads its `input`; authored preparers keep the assembled context. The focused runtime and type probes pass with that candidate, including native ToolLoopAgent execution. This is a promising structural correction, not production integration or a completed acceptance gate.

### 3. Helper-substitution checks omit new preparer properties

`ValidateRunHelpers` only recognizes `execute`, `prompt`, `prepareCall` and `prepareStep`. The component registry now also owns source callbacks under `input`, `query`, `audio`, `text`, `state` and `instructions`.

A function-prepared Embedder can call an injected tool with omitted arguments because configured `toolsContext` supplies a required public default. `embedder.run({ toolsContext: { lookup: {} } })` is accepted even though replacing that entry removes the default. Execution then fails the tool's existing input validation before embedding. Equivalent ImageGenerator and LLMAgent calls are correctly rejected by types; a replacement retaining the default succeeds for all of them.

Reuse `CallbackFromConfig`, which already selects every component-owned main callback, alongside the two agent hooks. An isolated replacement of the old `execute | prompt` selector correctly rejects the unsafe Embedder override and retains its valid neighbor. This is a smaller shared type check, not a new runtime guard. The SDK's existing validation correctly handles the missing argument; Casai failed to preserve the helper guarantee its preparer had been given.

### 4. Template and Script were missed by the source-mode union correction

The renderer factory's required-configuration check still derives `loader | template` or `loader | script` from the whole mode union. It then requires those properties on every configuration branch. A union of a valid inline configuration and a valid loaded configuration is rejected unless the inline branch also carries a loader. This affects two complete branches as well as a loaded branch whose source is supplied by the final call.

Each branch constructs successfully on its own, and both runtime branches return the intended result. The user-selected rule preserves shared safe calls without narrowing before construction; it applies to these older components too. Compute required keys per final configuration branch, using the existing definition-owned requirements. An isolated one-conditional change admits all four reproductions. No source dispatch change or additional callable-union machinery is needed.

### Evidence, simplification and remaining scope

The review artifacts are under `.cache/phase5-followup-review`. `verify.cjs` reproduces the precise acceptance/rejection outcomes against source and emitted declarations in both optional-property modes. `runtime.ts` asserts the misrouted image request, valid named/placeholder/prepared neighbors, removed helper-default failure and both renderer mode branches. `provenance.ts` includes descriptor, injected and native ToolLoopAgent paths, plus the two independent counterfactuals. `prototype.cjs` copies source into an isolated candidate and checks the payload carrier, common callback selector and renderer branch correction; it does not modify production source. These are focused feasibility checks, not a replacement for full integration, editor and package gates. The unchanged full runtime suite was not repeated for this review.

The strongest simplification is retaining the parsed input already available at execution instead of recovering it from a context that intentionally includes other values. Reusing the existing callback selector removes an obsolete parallel ownership list. The renderer correction uses the existing configuration model. Image argument classification still needs a coordinated runtime/type correction; a larger argument-description framework has not been justified.

A subsequent inventory pass traced these findings through the remaining owners, helper binding, native callback/result contracts, structured rendering, media/document precedence, streaming ownership and voice methods. It found no further independent category, but the four unresolved categories prevent clean implementation sign-off. Native SDK schema/history limits, stream consumption/failure behavior and provider capability limits remain accepted; no additional defensive runtime, brands, copies or completion layer is proposed. The coordinated Cascada publication gate remains unchanged.

## Follow-up corrections (2026-11-05)

All four findings above are now corrected in production. ImageGenerator selects literal sources by their supported string/object forms, leaving binary masks to the existing media parser. The shared positional context/key checks exclude binary media consistently with context-tail construction. Key capture also admits unions of binary representations without requiring each representation to have the other's index signature. Required context and private/undeclared-key checks remain enforced beside media, including caller unions.

Retained the invocation-object simplification: `ToolInvocation` carries the existing parsed `input` separately from assembled `context` and `registry`. Descriptor and injected execution pass that object directly; ordinary preparation returns the same shape. Plain native tools select their main field from parsed input. Preparers and coded bodies retain assembled context, and LLMAgent retains actual tool metadata and cancellation. This removes tuple/object repacking without a second parse, validator, clone or binding mechanism.

`ValidateRunHelpers` now uses the existing definition-owned `CallbackFromConfig` selector plus agent hooks. Regression consumers cover all six previously omitted callback properties and valid context replacements. Template/Script requirements are computed per final configuration branch, admitting inline/loaded unions while preserving missing-source and missing-loader errors.

An adjacent inference check found that an inline replacement preparer could fail where the equivalent annotated callback succeeded. A focused function-preparer signature fixes that using the existing call validator. Tried combining it with the context-inference signature to remove the extra overload; valid inline callbacks failed again, so reverted that experiment. The explicit inference signature is load-bearing; no additional runtime path was added.

Verification records are in `.cache/phase5-followup-review/fixes-*`. The full source/build/declaration/exact-optional type gate passes, including checked README examples. All 1,754 mock tests and coverage thresholds pass. Five targeted type mutations and two runtime mutations each reproduce a failure when a correction is removed; their unmodified controls pass. Native controls include `generateImage` and real `ToolLoopAgent` execution with mock models. No paid provider calls were made.

The full lint run found only an unused type-only fixture name; renaming it and rerunning that file passed. TS7 editor checks pass against source and declarations in both optional-property modes, including inferred parsed context for inline replacement preparers and context completion beside binary masks. All sixteen type-cost workloads pass their unchanged limits. The packed consumer passes with `--engine C:/Projects/cascada`, installing the built engine candidate outside the workspace; that fresh consumer resolved `ai@7.0.163`, `@ai-sdk/provider-utils@5.0.75` and `zod@4.6.7`, while the workspace/native controls used the installed versions recorded above.

The subsequent complete inventory traces the shared invocation change through Function/Template/Script, LLMAgent ordinary/native/tool/continuation paths, the ten Phase 5 owners, bound/injected tools and VoiceSessionSetup helpers. No important unresolved implementation finding remains in this pass. The fixes introduce no changes to native streaming/result ownership, schema purity, private/default merging or provider capability limits. The existing coordinated Cascada publication gate remains separate from these corrections.

## Supplementary-method and capture-order audit (2026-11-05)

This new pass finds two further issues, superseding the preceding clean local conclusion. Production source and permanent tests are unchanged during this review. The inventory covers all fourteen components, Config, source modifiers, shorthand/named/descriptor/injected calls, native result consumers, LLMAgent continuation and the separate voice methods. Installed SDK implementations remain the native reference; no paid calls were made.

### 1. Plain tool components capture ordinary payloads after an unrelated await

`createComponentRuntime.prepare()` awaits `inputNames()` for a plain `.asTool` component before it enters `prepareExecution()`. That delays the existing top-level argument snapshot. Ordinary non-tool components and prepared tools enter the common preparation path first and retain the originally supplied bindings.

The reproducer creates a plain Embedder tool with a configured source and `z.object({ input: z.string().min(1) })`, starts `component.run({ context })` with `context.input === 'before'`, then sets that same caller-owned field to `''`. The plain tool rejects the initially valid input. The equivalent ordinary Embedder and function-prepared tool succeed. The discrepancy repeats after declaration metadata is cached. Native `asSchema().validate()` and a native `ToolLoopAgent` with the same application schema both retain `'before'` in matching controls. The reproducer uses valid public calls without casts, configuration mutation or mutation inside schema callbacks.

An isolated reorder enters the existing shared preparation before the extra operation-name check. It fixes both cold and warm calls without another snapshot helper, clone or schema parse. This is about top-level invocation capture; nested borrowed resources retain their existing ownership contract. Integration should retain the closed raw-tool boundary and consider diagnostic ordering for invalid authored configuration; the prototype establishes supported-call behavior, not all integration gates.

### 2. VoiceSessionSetup.executeTool bypasses binding compatibility checks in types

`VoiceMethods.executeTool` accepts `Partial<ToolContexts<...>>` directly. That describes the raw context shape but omits the existing `ValidateToolsContext` check against the final selected bindings. With a Casai Function tool configured with `db: (): string => 'safe'` and a body calling `db()`, `executeTool(..., { toolsContext: { lookup: { db: 'bad' } } })` compiles and reaches a `TypeError`. The equivalent `.run()` override and explicit `bindToolContext()` are rejected by the current types. A compatible function replacement succeeds. An unknown map entry carried in a variable also bypasses the method's types and is rejected by the existing runtime checker.

The binding contract is Casai-owned: native execution cannot infer dependencies from Casai configuration. Reuse `ValidateToolsContext` with the existing merged-configuration type at this method's options boundary. No additional runtime validator or defensive machinery is needed. Do not apply the whole owner's run contract: tool execution intentionally works without the session instruction payload. The isolated generic-options candidate rejects the bad replacements, accepts compatible replacements and preserves that independence.

### Simplification and evidence

The same shared preparation function can select the effective source once, then apply literal defaulting or prepared rendering. An isolated two-line replacement removes the intermediate `payloadInput` and nested tool/plain source conditional while retaining the literal/prepared distinction and parsed-payload provenance. The tool runner already supplies an empty settings object on this path; no guard against forged internal invocation states is needed. No broader factory or renderer rewrite is justified by this pass.

Artifacts are in `.cache/phase5-new-audit`. `verify.cjs` reproduces the voice-type gap against source and emitted declarations, with both optional-property modes covered by emitted consumers. Both runtime reproducers type-check without casts. `snapshot.ts` includes cold/warm calls and native parser/ToolLoopAgent controls; `voice-runtime.ts` checks original, compatible and incompatible bindings without requiring owner context. `prototype.cjs`, `simplification.cjs` and `check-candidate.cjs` operate only on an isolated copy. The candidate passes 43 existing component/image/structured-source/voice runtime tests, compilation of those consumers, declaration emission and both optional-property consumer checks. These focused checks do not replace full integration, editor, package and type-cost gates. The unchanged full production runtime suite was not repeated.

The subsequent inventory pass found no further independent issue. Reranker callback document types are already broad in the native SDK, so they are not a Casai inference defect. Native streaming consumption/failure rules, prompt-message validation limits, provider capabilities and source/input-schema separation remain unchanged. The two findings above remain unresolved in production and prevent a new clean implementation sign-off; the coordinated Cascada publication gate remains separate.

## Supplementary-method and capture-order corrections (2026-11-05)

Both findings above are now corrected. Shared component preparation enters `prepareExecution()` before plain-tool declaration discovery, capturing the caller's application bindings through the existing parser path. Cold and cached metadata calls match ordinary/prepared components and native schema/ToolLoopAgent controls. Cancellation still precedes preparation, and closed tool-input checks still precede application parsing. Invalid authored configurations may now report application-input errors before the plain-tool field-name error; no supported call contract changes.

`VoiceSessionSetup.executeTool()` reuses `ValidateToolsContext` and `MergedConfig` to check per-call bindings. Compatible replacements remain accepted; incompatible private dependencies, unsafe union alternatives and unknown map entries receive the existing diagnostics. This checks only tool bindings: the method neither requires the owner's application context nor preserves instruction-preparer helper defaults that it does not execute. Its runtime remains the existing bound-tool runner, with no new validation or transport layer.

Kept the source-selection simplification. One expression selects the parsed tool field or explicit ordinary source; the next applies literal fallback or rendering. This removes the temporary payload variable and nested conditional. The declared-name check remains necessary: an output transform can synthesize a same-named application field without declaring it as public tool input. Regression coverage now distinguishes that case from a private same-named binding and an injected helper.

The full source/build/declaration/exact-optional type gate, full lint, all 1,756 mock tests and coverage thresholds pass. Four targeted runtime mutations and one type mutation are caught, with passing unmodified controls. TS7 editor checks pass for source and declarations in both optional-property modes, including voice context completion and named binding diagnostics. The type-mutation runner's aggregate and registry budgets remain within their unchanged limits. Verification logs are under `.cache/phase5-new-audit/fix-*`. The type gate also exposed a duplicate loader declaration left by the earlier fixture rename; the fixture now reuses its existing loader type. Package installation and unrelated factory-cost matrices were not repeated; these changes add no dependencies or exports.

A subsequent inventory traced the final source-selection and preparation rules through all fourteen component definitions, the separate LLMAgent/continuation path, coded components, native source/media consumers, schema preparation, tool binding and voice methods. No further important implementation issue was found. Native result/stream ownership, borrowed nested references, schema purity and provider limitations remain unchanged. The coordinated Cascada publication gate remains separate.

## Configuration-annotation and positional-result audit (2026-11-05)

This further pass identifies three type/API issues. Production source and permanent tests are unchanged during the review. The inventory covered all fourteen public component definitions and their shared factory/call/configuration types, supplementary voice methods, native settings/results and downstream consumers. A compile-time native-settings inventory found no omitted public request fields in the ten new component definitions. The installed SDK remains the reference: live transcription/translation accept ReadableStream audio, embedding lifecycle events intentionally cover scalar and batch results, and these native contracts do not require Casai workarounds.

### 1. Public ordinary configuration annotations imply possible tool mode

`ComponentConfig` falls back to `SourceComponentConfig` for all ten new components. That internal shape includes `asTool?: true`. Consequently, `const settings: ComponentConfig<'Embedder'> = { model }; create.Embedder(settings)` is rejected as potentially requiring a tool input schema, even though the ordinary runtime construction is valid. The equivalent problem appears for all ten new owners, including those with no tool mode. Existing map tests check assignability to the type but never pass an annotated variable back to its factory. Inferred objects and `satisfies` retain the absent flag and avoid the problem; native annotated embedding options are also accepted.

An isolated public-map change omits the tool flag from ordinary annotations without changing internal factory shapes or tool-mode checking. It fixes all ten constructors in the normal optional-property mode. Exact-optional consumers additionally expose the independent final-validation issue below. Older broad configuration annotations have other information-loss constraints and were not counted as successful controls or additional instances of this specific tool-mode defect. The public annotation contract should be deliberate rather than exposing the broad internal shape accidentally.

### 2. Final checks reject supported configuration clearing under exact optional properties

With `exactOptionalPropertyTypes`, both `create.Embedder({ model, input: undefined })` and `create.Embedder({ input: undefined }, parent)` fail the final source-compatibility check. ImageGenerator prompt and Reranker query reproduce the same mismatch. These calls compile in the normal mode and behave correctly at runtime: configuration merging clears the stored source, and a later call supplies its replacement. `SourceComponentConfig` explicitly admits undefined optional properties, but the final `Partial<Record<Main, Source>>` check does not. Function-source contextual checking has the same shape mismatch.

Native callback checking likewise rejects clearing an inherited `onEnd` under exact optional properties. Native SDK invocation types can reject explicitly undefined callbacks too; the Casai finding concerns its own advertised configuration/merge contract, which clears callbacks and filters undefined settings before native dispatch. The candidate aligns the source and callback checks with that existing config policy rather than changing native types or adding runtime handling. Missing models, missing tool schemas, wrong defined source types and calls that omit a cleared source remain rejected.

### 3. Reranker result inference treats unrelated placeholders as optional documents

`CallDocuments` extracts arrays and undefined from every element of the positional tuple. Given configured object documents, `rank(undefined, ['new'])` therefore returns `RerankResult<string | ConfiguredDocument>` in types even though replacement documents are definite. `prepared(undefined, undefined, ['new'])` has the same problem. The corresponding named calls and shorthand without placeholders infer strings correctly. This rejects valid consumers such as a `Promise<RerankResult<string>>` assignment or direct string methods on ranked documents.

Seven native/ordinary/prepared runtime controls return only the replacement strings; omitted-document controls retain the original objects. An isolated type change selects the actual array-bearing positional slot, retaining undefined only when that slot permits omission. Genuine `string[] | undefined` replacements still produce the required union with configured documents. No dispatch or native result transformation changes are needed.

### Evidence and subsequent pass

Artifacts are under `.cache/phase5-edge-audit`. `verify.cjs` emits fresh current/candidate declarations and checks the findings in both optional-property modes. The current implementation produces the expected ten annotation diagnostics, two positional-result diagnostics and five exact-optional clearing diagnostics; the candidate produces none. The candidate also passes the existing component-calls, component-review, component-map and mixed-source-modes type files in both modes. Four independent counterfactuals restore the expected failures when ordinary annotation ownership, source clearing, callback clearing or positional document selection is reverted. Runtime controls use mock models and native SDK functions; no paid requests were made.

These are focused feasibility checks, not completed integration, editor, package or type-cost gates for the candidates. The unchanged production runtime suite was not repeated. A subsequent pass through the public inventory found no further independent issue. No broader runtime rewrite, copying, parser, stream/error adapter or compatibility layer is justified by this pass. The three findings remain unresolved in production; the existing coordinated Cascada publication gate remains separate.

### Corrections and integration (2026-11-05)

The three findings above are now fixed. Ordinary `SourceComponentConfig` no longer owns `asTool`; the internal factory shape adds the existing `ModifierConfig` instead. This preserves explicit and inherited tool construction without teaching the public map to remove an internal flag. Permanent consumers pass annotated variables to all ten new component factories, with separate tool-mode positive and negative controls. The guides recommend `satisfies` when callers need to retain specific schema types and configured-default information.

The shared source inference, preparer callback and completed-source checks now admit explicit undefined consistently with configuration merging. Native callback configuration reuses `OptionalUndefined`. Defined incompatible sources/callbacks, missing fixed settings, missing tool schemas and omitted cleared sources remain errors. Runtime controls distinguish configuration clearing from call-time omission and compare the resulting requests with native embedding calls; no runtime handling changed.

Reranker's result type follows positional argument roles instead of collecting undefined from every slot. Definite replacement documents retain their precise element type through source/context placeholders. Forwarded optional tuples and query-or-documents unions retain configured/prepared document types only on the branches that can omit replacement documents. This additional union case was found while integrating the first candidate and is covered alongside named calls and native reranking results. The type logic remains owned by Reranker.

The full source/build/declaration/exact-optional type gate passes, as do 27 focused runtime tests and all four source/declaration editor profiles. Five targeted mutations independently catch the annotation, source-clearing, callback-clearing, document-placeholder and alternative-role regressions. Their unmodified controls pass; aggregate and registry type-cost checks remain within the existing limits. A mutation requiring tuple heads instead of permitting optional heads proved equivalent for these inferred call tuples; it was discarded rather than counted as regression evidence. Logs are under `.cache/phase5-edge-audit/fix-*`.

Whole-repository lint found only two issues in the new type fixtures: an empty-object spelling and an empty callback. Both are corrected, their focused lint passes, and both consumer optional-property profiles pass again. The source/build/editor/mutation checks were not repeated for these equivalent fixture changes.

All sixteen existing factory-cost workloads pass without changing their limits. Shared import, first-use and additional-component costs remain within budget; these bounded workloads do not claim a separate Reranker benchmark.

A follow-up inventory traced all fourteen definitions through public configuration ownership, final factory validation, ordinary/named/tool calls and native dispatch, including voice methods and stream owners. No further important implementation issue was found. The Reranker guide now also describes documents-only calls with a configured plain query, matching the existing runtime and types. The complete runtime and package-install suites were not repeated for these type-only production changes; SDK execution, schema preparation, private-context protection and stream ownership are unchanged. The coordinated Cascada publication gate remains separate.

## Repeated independent review (2026-11-05)

This review starts from the current worktree rather than treating earlier green checks as proof. Its stop condition is a complete subsequent pass with no new substantial finding after clear corrections are integrated and verified. Questions requiring an API decision are recorded for the final report instead of interrupting implementation.

The strategy separates four responsibilities: runtime/native behavior, public types and downstream consumers, API/documentation/architecture coverage, and shared configuration/tool preparation. Each pass inventories all fourteen component definitions plus Config, modifiers, ordinary/named calls, tool descriptors/bindings, LLMAgent continuation and supplementary voice methods. Cross-component changes are traced to their consumers rather than inferred from a common helper's name.

To challenge earlier coverage, probes vary where information is stored: direct versus inherited configuration, a property union versus a whole-config union, absent versus explicitly undefined values, mutable versus readonly native inputs, and source versus context versus secondary call arguments. Native controls distinguish wrapper regressions from accepted SDK behavior. Positive neighbors and meaningful mutations must demonstrate what a new test protects. Simplification candidates are judged by the total policy and ownership they remove, including types and tests; fewer lines alone do not establish an improvement.

After corrections, reviewers change focus and revisit the entire public inventory. Compiler-heavy checks remain sequential. Mock execution, source/emitted consumer types, both optional-property modes, editor behavior, relevant mutations and existing cost budgets provide the applicable evidence; runtime changes additionally require the mock coverage gate. Existing release prerequisites and deliberately deferred phases remain separate from implementation findings.

### First-pass findings

- Decision's template type copied a mutable state-part array even though the native state accepts readonly arrays. It now extracts the supported string/array forms from the native state type. Frozen configured, positional and named sources render only text parts and preserve JSON data, matching native dispatch.
- StreamingSpeechGenerator shorthand rejected unions of native streams/iterables/arrays because the common first-argument key capture exempted only binary media. The capture now reuses the existing native-source roles. Function roles remain outside that exemption to preserve contextual inference for inline preparers; the ordinary argument-role and private-context checks still apply.
- Reranker result inference flattened a configuration's preparer and fallback documents independently. A complete-bundle branch could consequently leak its ignored configured documents into another branch's result type. Shared call-result selection now derives inputs inside each configuration/call alternative, replacing repeated calculations at four call sites. Tool result selection preserves the same pairing before computing the input; descriptor, conversion callback and injected helper consumers are covered.
- The current guide incorrectly advertised future Template streaming and required a configured source for every plain specialized tool. Those claims are corrected without changing the future guide's intentional Phase 6 surface. Both guides' mock workflow returned `value` while embedded Cascada read `output`; the helper now returns `output`, and a runtime test executes the actual Markdown example through its final assertion. Decision guidance now distinguishes literal JSON parts from unsupported root JSON template sources.

No runtime dispatch changes were required for these findings. The focused mock suites pass 41 tests, including native controls for frozen state, all streaming-speech input representations and correlated reranking branches with explicit overrides. A second type pass is checking optional secondary inputs against source inference before the full integration gate.

### Simplification trials

The shared result-selection change is retained because it removes independent derivations that lost the same branch pairing. Native source-role reuse and native-derived Decision input remove duplicate representations of supported inputs. A generic transcript collector was rejected: eager enumeration touches ownership-bearing native getters and throws; filtering property names before reading them works but adds reflection and assertions for a single caller. The explicit native finish-property projection remains clearer. Full-configuration merging, declaration-based public input selection, stream identity claims and native result envelopes retain their established owners; replacing them with shortcuts would either duplicate common policy or weaken a concrete invariant.

### Subsequent interaction findings

Prepared Reranker result inference treated an optional first document array as replacement source. Reusing the existing component source type for role selection fixes the fallback result without another argument classifier. Tests distinguish required/optional documents, configured complete bundles, placeholders and named calls.

Optional `asTool` flags exposed opposite validation errors. New components could skip tool-only checks because a successful ordinary branch erased a failure; older factories applied tool rules to every alternative and rejected safe ordinary-open/tool-closed configuration unions. Validation now checks each completed alternative and every possible tool mode. Function and renderer validation no longer need separate parent-key checks; the completed configuration owns those checks. SDK descriptor inputs/results select only configurations that can produce a tool, while ordinary calls continue to cover all alternatives.

Preparer callback inference now follows raw, inherited and optional tool flags. Configured preparers must accept both ordinary configured context and bound tool context. Invocation source replacements and LLMAgent per-run preparation hooks execute only on the ordinary path; removing tool-mode parameters from those call types admits safe narrower callbacks and makes that ownership explicit. Mock controls verify numeric ordinary bindings, string tool bindings and a subsequent invocation without persisted overrides.

The common configuration type merger lost a possible sticky `asTool` or `streaming` flag when a child supplied undefined. It now preserves possible true values alongside the existing definite-true rule, matching the unchanged runtime merger. The tests check both flags, required tool schemas and generated-versus-streamed result consumers. Ordinary source/callback clearing remains unchanged.

These changes add no runtime adapters, validation passes, copying or stream lifecycle machinery. The independent runtime follow-up found no further substantial issue across all fourteen component owners and their supplementary methods. Full mock coverage passes all **1,765 tests** and the existing coverage thresholds. Public-type, editor, mutation and cost verification remain in progress at this checkpoint.

The final consumer audit exposed the complementary capability rule: LLMAgent's native `generate`, `stream`, `resume` and `tools` exist only on non-tool alternatives. One symmetric tool-mode selector now supplies both SDK capability surfaces, preserving their own input/output/registry contracts after narrowing. Common ordinary calls and `.run()` still cover all alternatives. Source-output derivation now preserves `never`, covering both absent source-mode alternatives and omitted invocation replacements in one place. An impossible script/template source cannot widen a narrowed tool or no-replacement call result; actual script tools retain native untyped results. This replaces the initial guard in configured-output selection rather than adding another parallel check.

Inline Reranker callbacks returning complete query/document bundles needed distinct contextual source signatures to make documents optional. A small helper selects distinct function-source types and reuses the complete argument contract for tail validation; the general signature remains for forwarding unions. Reordering overloads or broadening the callback return constraint did not fix inference and was reverted. An initial version distributed complete tuples, duplicating signatures with the same source. Although its focused comparison cost only 1.23% more type instantiations, the full Embedder workload exceeded its additional-component budget by 15 instantiations. Grouping by source type removes that duplication: the unchanged workload now costs 20,615.92 initially and 12,996 per additional component, within the existing 22,000/13,000 limits. No ceiling was raised.

The first full source check caught a regression in the renderer validation trial: distributing completed configurations also compared each branch with the whole original registry/context union. Tool-context validation now runs once on the complete paired configuration, matching the existing source-factory and LLMAgent structure; component shape/mode checks remain per branch. Existing paired-registry fixtures are retained unchanged. Three new runtime-test type errors were corrected at the native API boundary: bound SDK executors are optional in the SDK type, and the native rerank control needs an explicit document-union type. Neither correction changes execution.

One heterogeneous-configuration hook inference limit remains accepted. A parent union with different context types can reject inline `prepareCall: request => request`: Casai checks its recursively typed request/hooks against each completed branch. The native `ToolLoopAgent` control with different `runtimeContext` types also rejects the inline identity hook, but earlier, because constructor inference selects the first context type; these are distinct failure mechanisms. No callback validation is weakened to accommodate this case. An identity-forwarding hook written as `prepareCall: <T>(request: T) => request` passes the Casai consumer check; authors of context-dependent hooks can narrow the complete configuration before construction. The focused comparison and diagnostics are recorded in `.cache/phase5-loop/types/hook-native-control.ts` and its log, with the context-union reproducer in `legacy-context-modes.ts`.

### Final verification

The settled candidate passes the full source/build/emitted-consumer/exact-optional type gate, all four source/declaration editor profiles, and all sixteen factory-cost workloads without changed limits. All **1,765 mock tests** and coverage thresholds pass. Whole-repository lint found only issues in the two new type fixtures; those were corrected and focused lint passes. Subsequent small source/fixture changes also pass focused lint. No paid provider calls were made.

All **53 selected type mutations** are caught with passing unmodified controls, including the new findings and affected existing configuration/call checks. The two exact-optional renderer mutations were rerun after updating their expected native diagnostic. Aggregate and registry instantiation budgets pass. The static audit finds all 169 remaining mutation locations. Stale targets now follow their current validation owners, embedded LLMAgent consumers use native `output`, `text` and `textStream`, and the mutation for the deleted `StreamValue` facade is removed. Renderer requirement selection no longer repeats the distribution already owned by its sole completed-branch caller. Verification logs are under `.cache/phase5-loop/final-*`; the initial tuple-overload cost failure remains in `cost-tuple-overloads.log`.

Independent subsequent passes traced all fourteen component definitions through configuration ownership, modifiers, ordinary/named calls, SDK capabilities, descriptor/binding/injected consumers, source rendering, native dispatch and supplementary methods. No further substantial supported-case issue or unresolved API decision was found. The retained native/TypeScript limitations above, Phase 6 scope and the existing coordinated Cascada publication prerequisite remain separate. Package installation was not repeated: this pass changes no dependencies or public entry points.

## External review reconciliation (2026-11-06)

The [Claude review reconciliation](phase5-claude-review.md) records every supplied finding, the clear runtime/type/package corrections, native limitations, retained simplifications and six outstanding decisions. This pass adds downstream declaration emission and focused mutation checks. It leaves structured positional rendered sources, SDK setting forwarding, null omission, plain-tool ordinary payload mapping, video/batch scope and upstream Cascada changes for explicit decisions; it does not claim release readiness while those matters and the published-engine prerequisite remain open.

### Claude follow-up decisions (2026-11-06)

The user selected SDK-native unknown-setting handling and payload-first ordinary calls on plain tools, and deferred video/batch components. The [reconciliation](phase5-claude-review.md#follow-up-implementation-2026-11-06) records their implementation, the selected literal-history boundary, native null alias verification, and upstream Cascada work. This supersedes the previous paragraph's pending status for those three decisions.

All LLMAgents now consume positional message arrays as literal history, including plain agents. New message arrays use configuration or named prompt slots; two-array shorthand is not supported. Explicit prompt slots remain authored sources, including multi-message templates. Shared tuple-role validation preserves string/history unions and prevents an array from entering a context slot through another overload. No message markers or execution-history registry were added.
