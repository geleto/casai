# Phase 3 design review follow-up

## Loader review corrections (2026-10-29)

Confirmed the external review's documentation gap and JavaScript `loader: null` regression. README2 now uses a concrete filename example to distinguish ordinary parent fallback from `raceParent`'s separate file lookup on each side. README's migration note records the changed lookup behavior, and Cascada's script/API guides explain the corresponding loader rules without suggesting arrays belong in `include` syntax. Corrected the stale guide description, merge comment and type-owner references.

`null` is treated as an absent loader during resolution, including on raw JavaScript parents. TypeScript configuration still rejects it. Four new regressions cover null child/parent settings and missing relative files on either side of `raceParent`; the null cases fail on the previous implementation. Two new controlled mutations restore those failures independently.

Verification: **1,579 mock tests** pass with unchanged coverage limits (99.78% lines/statements, 100% functions, 97.77% branches). All four type profiles, including 65 README2 examples, pass. Type-aware lint passes all four changed TypeScript files; all six loader mutations are caught. The paired packed consumer passes declarations and execution, including JavaScript null inheritance. No paid calls, native source changes or broad editor/cost repeats were needed.

The subsequent complete loader pass retraced helpers/configuration, ordinary and raw parents, loaded renderer consumers, call-time restrictions, public/emitted types, file lookup rules, documentation and package consumption. No additional implementation or documentation finding remains. Publication is still blocked on a coordinated Cascada release and Casai dependency minimum containing commit `2a2ac2c1`; the local paired candidate does not establish published 0.6.2 compatibility. Package versions and staging were left unchanged. Logs are under `.cache/loader-review-*`.

## Loader composition follow-up (2026-10-29)

The [Phase 3 loader follow-up](plan.md#phase-3-follow-up-loader-composition) is implemented in the paired Casai/Cascada checkouts. Casai re-exports native `raceLoaders` and resolves `raceParent`/`overrideParent` during configuration inheritance. Ordinary inheritance tries the child group before the parent, and both directives work without inherited loaders. These decisions supersede the open inheritance-order question below. Resolved configuration retains native loader identities and recursive group boundaries; invocation merging does not rebuild a race or its subscriptions.

Casai's loader implementation is reduced from 197 lines to 42. Named groups, aggregation/deduplication, executable-description recovery and identity registries are removed. Loader types use native `LoaderGroup` throughout; `LoaderInput` adds only the whole-property parent directive. The remaining one-use filter alias is inlined and its obsolete type module removed. Tests and documentation migrate together, including undefined-loader guarantees in both optional-property modes; an undefined loader without inherited resources cannot satisfy a loaded component's fixed requirement.

Cascada owns recursive acquisition in its existing sync-first loader/cache pipeline, replacing the environment's separate flat lookup loop. Logical names and selected group scopes remain separate from physical paths and source owners. Ordered groups override relative dependencies, while races exclude losing competitors from the winning branch's relative scope. Single-member groups retain native member resolution. Existing cache, reload, pending, update and invalidation behavior is retained. Weak owner caches release temporary scopes while a live environment continues working; stable acquisition identities retain cached fallback compilation when an earlier reload loader misses. Standalone `loadString` deliberately preserves its native error-fallback policy, distinct from environment lookup.

Verification: **1,575 Casai mock tests** pass with unchanged coverage gates (99.78% lines/statements, 100% functions, 97.76% branches; augmentation retains 100% lines/statements/functions and 98.98% branches). All four type profiles pass, including 65 current README2 examples; full lint passes, with the final adjusted files checked separately. All 13 compiler-cost workloads pass unchanged limits. Cascada's full build/lint and type checks pass, with seven existing documentation-script lint warnings; its Node suite has **3,471 passing / 13 pending**, and browser suites have **1,236 passing / 8 pending**, including the precompiled build. No paid model calls were made.

Nine controlled mutations are caught: four Casai inheritance/directive guards and five native scope, logical-name, stable-cache, event-propagation and lifetime rules. Real filesystem template/script overrides and mock LLMAgent rendering cover the compiler/renderer consumer boundary. The isolated paired-package gate passes declarations and execution without workspace links, including two physical Casai copies; its fresh install selected AI SDK 7.0.156 and Zod 4.6.7 within the declared ranges. Native and Casai logs are retained under `node_modules/*loader*.log` and `.cache/loader-*` respectively.

The subsequent complete loader review inventories configuration/helpers/types, ordinary and named renderer consumers, native environment/standalone/race entry points, source-origin transport, precompiled/browser builds and packed consumers. It has no important unresolved implementation findings after the scope-lifetime correction and documentation reconciliation. The review process now includes weak dynamic-scope ownership, fallback compilation identity, pending invalidation, URL/browser/precompiled coverage and non-vacuous type negatives. Publication still requires selecting coordinated package versions and an engine dependency minimum containing this work; neither package has been published or version-bumped. The separate newer-runtime handoff remains outside this loader delivery.

## Bounded review closure (2026-10-28)

The final external review found one low-severity defect and small remaining simplifications, with no new architectural blocker. Its mock probe reproduced malformed original prompt/messages surviving a replacement `prepareCall` and then breaking `value` or remaining in history. Invocation history was already validated, but literal prompt arrays and native conversation inputs were not.

The fix reuses the native message schema at one pre-preparation boundary for original history, positional/named prompt arrays and native prompt/messages. Ten generation/streaming regressions assert zero application-parser, hook and provider entries on rejection, and pair each case with a valid original preserved in history while the hook sends replacement messages. Invalid originals now consistently reject with Casai `ValidationError`; a native `generateText` control retains SDK `InvalidPromptError`. Prepared Script/Function outputs keep their existing validation-only boundary, preserving transport fields rather than substituting parsed message copies.

Retained cleanup:

- Configuration is the source of tool/source mode for validators and execution preparation; redundant mode arguments are removed.
- Parsed SDK tool execution is one internal invocation option, replacing the paired prepared-context/completion controls. Ordinary calls on tool-compatible components retain their result behavior.
- All prompt source modes are selected by the prompt preparer. Loaded text retains its environment/cache lifetime and existing error/cause behavior. Template/Script renderer setup is shared; only Script output needs prompt validation. Literal text remains synchronous.
- Keyword recognition and normalization have one owner, which returns the normalized arguments and whether keyword arguments were present.

Keep raw configuration validation: it rejects forbidden own properties, including explicit `undefined`, before normalization discards them. Per-call loader processing remains part of the separate agreed loader redesign; no second merge pipeline or loader behavior change was introduced.

Verification: 446 focused runtime tests, then all **1,648 mock tests** with unchanged coverage gates (99.75% lines/statements, 100% functions, 97.80% branches; augmentation retains 100% lines/statements/functions and 98.98% branches). All four type profiles pass, including 64 current README2 examples; the final run took 23.0 seconds. Changed-file lint passes, with the final adjusted contract test additionally type-checked and linted. Six targeted mutations are caught: missing and duplicate original-conversation validation, undeclared tool arguments, coded-run and history keyword normalization, and model/tool provider-option ownership. Mutation verification took 60.0 seconds including its baseline; final mock coverage took 27.9 seconds. Logs are under `.cache/phase3-followup-*`.

The subsequent consumer inspection covered every changed invocation entry, configuration-mode consumer, keyword-normalization caller, prompt source mode and tool/result handoff. No important unresolved finding remains in this bounded follow-up. Public signatures, cancellation, output delivery and loader behavior remain intact; no paid calls or dependency changes were made. Compiler-cost/editor and broad mutation matrices were not repeated for this internal cleanup. The recorded upstream release dependencies and planned loader redesign remain separate.

## Simplification trial retained (2026-10-28)

The user authorized trying recommendations 1–3 and reverting changes that failed to improve the codebase. All three are retained. Including the new 53-line `coded-component.ts`, the affected production files shrink from 907 to 825 lines. The improvement is fewer execution owners and identity relationships; public component signatures and streaming delivery remain unchanged.

- Function, Template and Script now share configuration/invocation preparation, body execution, output parsing and tool attachment. Their public inference signatures stay in the factories. The implementation has three concrete kinds, with no strategy registry, compatibility runtime or extra public settings.
- Result augmentation receives invocation-owned normalized messages and the original conversation. LLMAgent snapshots the hook-returned message array at dispatch. Streaming augmentation returns the native result and a lazy final-output function directly; the completion WeakMap, lookup and duplicate conversation/alias normalization are removed. Protocol tests use normalized requests, while SDK/UI compatibility, aliases and public ownership tests exercise LLMAgent itself. Native result views, final-output eligibility, lazy error behavior and history remain intact.
- Bound descriptors expose the same private binding capability as components. Their implementation returns the existing binding after the fixed-context check. The module-local WeakMap is removed, and selected bound context now remains enforced across independently loaded Casai instances. Native tools and descriptor spreads retain their existing contracts; no new brand or control-object validation is introduced.

The final `npm run check` passes: all four type profiles, 64 current README2 examples, full lint, and 1,638 mock tests. Coverage remains above the unchanged limits: 99.75% lines/statements, 100% functions and 97.70% branches; the augmentation module has 100% lines/statements/functions and 98.98% branches. The combined gate took 270.2 seconds. Four targeted production mutations are caught: skipping coded output parsing, skipping bound-context comparison, omitting the hook-message snapshot and omitting protected request settings (12.3 seconds including the baseline).

All 13 compiler-cost workloads pass unchanged ceilings (62.9 seconds). LLMAgent import cost is 357,830 instantiations; hook costs remain 37,973 / 13,952 and native-method costs 7,038 / 4,090 per first-batch/additional component. These changes do not solve the expensive hook inference contract. The subsequent pass retraced public factories/modifiers, source and tool inheritance, native methods/UI consumers, preparation/parsing, bare/bound descriptors, request ownership and all result paths. Source and emitted-reference scans find none of the removed factory runtimes, registries or completion lookups. No important unresolved finding remains in this consolidation. Editor and broad mutation matrices were not repeated; no public type design changed. No paid calls or dependency changes were made.

### Agreed loader API direction (2026-10-28)

The [implementation plan](plan.md#loader-composition-and-inheritance) records the agreed design; [README2](../README2.md#combining-loaders) explains arrays, races, both parent helpers, and how included files are found. Its example tries the child and parent together. This supersedes the earlier `overlayLoaders` constructor, named-group retention and ordinary-replacement proposals.

Keep native `raceLoaders(array)` and recursive structural grouping. Its main use is adding different resource collections through concurrent discovery; racing duplicate copies is optional. Casai adds whole-property-only `raceParent(group)` and `overrideParent(group)`, removes named-group merging and exposes native `raceLoaders`. Normal inheritance's parent/child lookup order remains open. Cascada's script, template, API and compressed agent references now explain the same discovery use and distinguish existing behavior from the agreed extension.

A fresh executable probe tested both `C:/Projects/cascada/src/index.js` and its linked installed build. Top-level chains, chains containing races, and races containing races work. A chain array nested inside another chain, or supplied as a race competitor, reaches `loadSource` as an invalid loader. The race probe makes other competitors miss so they cannot hide that failure. Recursive chain support therefore still needs runtime/type implementation in this checkout; nested racing itself already exists. These API changes and the two parent modifiers are planned, not implemented by the simplification trial above.

Earlier focused probes against the installed engine also confirm:

- An ordinary array starts the old loader only after the new loader returns a miss. Actual loader errors stop that environment lookup. Recommend retaining `null` for a miss and a rejection/throw for a real error; this is distinct from treating every failure as permission to use stale fallback content.
- A concurrent group starts all members, returns the first source without waiting for a pending member, and reuses a cacheable result on subsequent reads. If members overlap, completion order decides the source. Independent collections are the common discovery use; duplicate copies are not required. Already-started work is not cancelled.
- Current relative imports are pinned to the source owner. Both a custom-loader probe and a two-root FileSystemLoader probe return the old `part` even when the new loader contains an override. A non-relative logical include searches the normal chain and finds the new version. This establishes the gap the accepted overlay semantics need to close.

The current `loadString` standalone utility and environment lookup differ on actual errors: the utility can fall back after an error, while the environment stops. Casai uses the environment. A Cascada composition implementation should choose and test the error contract explicitly rather than copying whichever loop is easiest. Preserve invalidation, pending-load coalescing, negative caches, `noCache`, reload policy and source-origin behavior. Cache by resource and resolution scope; add no global remembered winner for all resources.

### Streaming clarification

Recommendation 5 overstated the importance of a promise. Most of the simplification comes from waiting until final output is known. Default text could keep its iterable API with `async function* values() { yield await finalOutput(); }`, eliminating the same terminal-step prediction and prefix/interleaving machinery. A promise mainly removes that small iterator wrapper and the delivery-type distinction. Neither alternative streams final-answer chunks before completion. Merely delaying the first chunk for a shorter interval does not establish finality: a later tool call or continuation can invalidate the candidate text. The current implementation retains incremental delivery when its finality checks permit it and buffers otherwise; no delivery or latency change is made in this trial.

## Structural simplification review (2026-10-28)

This pass reviews the current LLMAgent implementation and its shared factories, configuration, preparation, binding, rendering and result consumers. It identifies three concrete internal simplifications and two larger contract choices. Production code is unchanged by this pass. Experiments live under ignored `.cache/phase3-architecture-review/`; their bounded checks establish feasibility, not a completed integration gate.

### Recommended internal changes

**1. Give Function, Template and Script one runtime lifecycle.** Their factory implementations repeat configuration merging, inherited tool/source selection, registry validation, invocation settings, input preparation, callable construction and tool attachment. The existing shared renderer has removed the main obstacle to sharing this lifecycle. Keep each public inference signature local, and use a small closed implementation with three component kinds. Its execution branch calls either the configured function or the existing renderer; source arguments remain specific to rendered components. Script/Function output parsing remains after execution, and tool collection remains in `defineTool`.

An isolated implementation uses a 52-line shared function and reduces the three factory files plus that helper from 289 to 229 lines. It passes 265 selected runtime tests, source plus non-exact public type-safety consumers, and all 13 existing compiler-cost workloads without changing a ceiling. The runtime selection covers renderer behavior, configuration, ordinary/tool calls, inheritance, registry handling and integration. This does not establish emitted/exact-optional/editor equivalence or replace the complete integration checks. The compiler results show no reduction of the expensive public hook types; the simplification is in runtime ownership. Keep LLMAgent outside this helper: its request hooks, SDK execution and result contract are different capabilities.

**2. Make result augmentation consume the normalized request owned by LLMAgent.** `llm-agent.ts` is the only production consumer of `generateTextWithResult` and `streamTextWithResult`. It already normalizes native aliases and conversation forms and supplies the original conversation. The result module nevertheless accepts a second SDK-shaped calling contract, derives default history from prompt/messages, copies those forms again, and handles aliases again. Those internal entry points are not package exports. Their direct tests are useful evidence for protocol behavior, but do not justify preserving a second production API.

Require normalized `messages` and an explicit original conversation at this internal boundary. Keep the dispatch-time snapshot of a hook-returned message array in the invocation owner; a hook may return an ordinary shared array, so removing every copy would be incorrect. Return `{ result, finalOutput }` from streaming augmentation, with `finalOutput` remaining a lazy memoized function. The caller can expose the native result or complete a tool call directly. This removes `streamCompletions`, its lookup function and its identity relationship without adding properties to the public result or eagerly draining a stream.

The isolated prototype passes 362 selected public runtime tests and a source type check. It retains the existing `value` delivery contract and all completion/eligibility logic. Tests that call the old internal SDK-shaped helpers directly still need migration to the normalized boundary or public Agent methods, retaining native controls and the retry/stream/error cases. No claim is made that the full result-protocol suite or emitted consumers have passed for this prototype.

**3. Use the existing binding capability for both components and bound descriptors.** `execution.ts` currently discovers components through `_bindToolContext`, but discovers bound descriptors through a module-local `boundTools` WeakMap. Both routes produce the same binding. Attach the existing non-enumerable method to a bound descriptor too: verify its selected context matches, then return the captured binding. An unbound component's implementation creates the binding. `prepareRegistry` then has one Casai route and one native-tool route.

This also fixes a reproduced inconsistency across independently loaded Casai instances. A descriptor bound with `{ factor: 5 }` rejects selection with `{ factor: 7 }` in its own instance. Another instance does not recognize the descriptor's local WeakMap entry, accepts the mismatched context and executes with the captured default `5`. The capability prototype preserves the valid foreign binding and rejects the changed context. This is an ordinary binding-lifetime mismatch, not a forged-interface threat.

The isolated change passes 103 selected runtime tests and a source type check, plus the cross-instance probe above. Two focused mutations are caught by assertions: bypassing output parsing in the shared coded lifecycle and removing the bound-descriptor context comparison. Keep the fixed-context comparison and binding-local parse facts. This removes a discovery mechanism, not the binding/default projection itself. The private capability is a trusted implementation protocol; add no authentication registry or shape validator for its returned binding. Descriptor spreads retain their existing native behavior and do not establish a promise to preserve private capabilities.

### Larger choices that change observable contracts

**4. Keep loader configuration as descriptions until an environment needs executable loaders.** `processConfig` and `mergeConfigs` currently turn race groups into executable loaders. Later merges then recover group structure from those executable objects, retain a `processedLoader` candidate, and consult `anonymousRaceMembers` to recognize anonymous groups. The multi-pass implementation mixes ordering/deduplication with resource construction and reuse.

A coherent replacement would merge canonical loader descriptions, then construct Cascada race loaders once for the consuming environment. That would remove executable-to-description recovery and the anonymous-member registry. Preserve named-group aggregation, child-first ordering, identity deduplication, direct native loader support, and Cascada's relative-source/update behavior. This needs a measured prototype: construction/cache lifetimes and the public `.config.loader` shape/types would change. Currently even creating a reusable Config with a two-member race installs the native member update handlers and exposes an executable loader. The installed native event hub uses weak listeners; this is not evidence of a memory leak. Existing reuse checks are necessary under the current representation, so deleting them alone is not the simplification.

**5. A uniform completed streaming `value` would remove the final-text prediction machinery.** If every streamed result exposed `value: Promise<CompletedOutput>`, output presence would no longer select promise versus iterable delivery. Native `textStream`, `partialOutputStream` and `elementStream` would provide incremental views. The result layer could remove terminal-step prediction, the step observer used for it, emitted-prefix accounting, interleaved text-block tracking, and fallback slicing. Completion errors and final-output eligibility would still be necessary.

This explicitly reopens the user's agreed default-text streaming contract; it is not an internal cleanup. A two-step mock demonstrates the difference: native `textStream` yields `Searching...Answer`, while current default `value` yields only `Answer`. Explicit `Output.text()` already gives a promised final `Answer`. Switching all `value` access to a promise sacrifices incremental final-answer delivery; simply aliasing `value` to native `textStream` changes its content too. Keep the agreed behavior unless the user chooses that tradeoff. No production or prototype delivery change was made in this pass.

### Complexity that remains justified

- Keep one LLMAgent invocation path over native `generateText`/`streamText`. Substituting `ToolLoopAgent` would require restoring Casai's hook arguments, protected fields, ordering, parsing and stop behavior around another execution facade.
- Preserve original-conversation validation and history separately from the hook's final sent messages. History and pending-tool checks consume the original conversation; SDK validation covers the sent request.
- Keep raw application parsing distinct from parsed SDK descriptor execution, and public defaults distinct from private context. Closed-root tool admission, private collisions, transformed values and configured defaults are actual supported input boundaries. Two parses with different owners are not automatically duplicate work.
- Keep fixed-context binding and native context validation at their respective boundaries. Hooks may replace registries before dispatch; within a binding, changing public defaults would invalidate projected schemas and approval history.
- Keep completion failure handling, pending tool/approval checks, provider-denial handling and native history rejection. These are concrete gaps between a native result and Casai's promised final application value.
- Keep configuration snapshots at public ownership boundaries and invocation-local state. Nested application resources remain intentionally shared. The prepared-context envelope protects legitimate helpers named `then`; it is not a malformed-control defense.
- Preserve flat helper injection, already reconfirmed by the user. A namespace would not remove binding, schema parsing or trusted dependency forwarding.

There is no large runtime authentication or deep-copy subsystem left to remove. The three WeakMaps above have specific jobs: completion handoff, binding discovery and loader provenance. The first two can be replaced by explicit existing relationships; the third follows from the current executable-loader representation. Type-only inference markers are not runtime brand registries. Cheap public configuration/argument diagnostics can remain. Deliberately forged `_bindToolContext` implementations, corrupted prepared envelopes and malformed compiler control facts should stay outside the support and test contract.

The largest unresolved type cost remains flat, inherited, contextually typed callbacks: the measured hook workload is about 37,973 first-batch and 13,952 additional-component instantiations. This pass found no demonstrated simpler equivalent inference design. Removing Config callbacks would discard reusable policy; moving callbacks to a separate builder would split the flat configuration model. Neither is recommended on speculation. Early family inference for incomplete Config fragments could separately be narrowed to final-factory validation, but it saves relatively little and changes diagnostic timing; it is lower priority than the proven runtime candidates.

Recommended implementation order: unify binding discovery, consolidate the coded-component lifecycle, then narrow the result boundary and migrate its protocol tests. Evaluate loader descriptions only with an explicit `.config.loader` contract decision; retain current `value` delivery unless the user reopens it. The existing upstream compiler/runtime and coordinated-release dependencies remain unchanged. No paid calls were made, and the full implementation gate was not rerun for this review.

## Shared-renderer experiment (2026-10-28)

The user authorized trying the renderer consolidation and reverting it if it did not simplify the implementation. The trial is retained: one 53-line `cascada-renderer.ts` replaces TemplateEngine, ScriptEngine and their environment helper (165 lines). Including all changed production callers, the affected code falls from 401 to 290 lines. No compatibility classes or parallel renderer remain, and the retired emitted modules are removed.

Both source kinds now create their native compiled object lazily on first execution. The renderer owns environment setup, filters, inline caching, one-off overrides, named dispatch and native error wrapping. Cascada continues to own named loading, invalidation and relative imports. Standalone Script output validation moves to the factory's shared execution function, used by ordinary and tool calls; LLM Script prompt validation stays at its existing prompt boundary. Public factory types, source modifiers, flat helpers and result contracts are unchanged. Debug remains supported with shared invocation/result messages instead of duplicated engine-specific logging.

This corrects the earlier assessment's excessive weight on constructor timing. Native Script construction transpiles immediately, but deferring construction for both kinds preserves the required invocation-time behavior. It is not an architectural obstacle to consolidation. A mutation initially survived because the existing malformed Script (`return missing(`) fails during compilation, not transpilation. An additional unclosed-block case (`if true`) now independently covers the constructor/transpiler failure path. Both still permit a valid one-off override afterward.

Verification covers configured/override/named sources, loader updates and relative imports, autoescape and filters, empty sources, prepared context, tools, LLM prompts, error causes and exactly-once output parsing. New cache checks exercise an override before the first configured call, concurrent calls and later reuse for both Template and Script. Four isolated mutations are caught: removing inline caching, contaminating the configured cache with an override, constructing Script eagerly, and bypassing Script output validation.

The final mock suite has 1,635 passing tests; coverage is 99.76% lines/statements, 100% functions and 97.51% branches, with all existing thresholds intact (22.7 seconds). All four type-check profiles and 64 current README2 examples pass (final warm run 3.6 seconds). Type-aware lint passes all five changed TypeScript files (27.0 seconds); targeted mutations pass (9.5 seconds). All 13 compiler-cost workloads pass unchanged limits (39.7 seconds). Import cost decreases for the affected factories, while LLMAgent first-batch cost increases: hooks measure 37,973 / 13,952 and native methods 7,038 / 4,090 first-batch/additional-component instantiations. Additional-component costs are unchanged; this is a runtime-code simplification, not a claimed typing-performance improvement.

The subsequent pass retraced the public entry points and downstream preparation, rendering, output and tool consumers, and checked source/emitted references for retired engines. No important unresolved issue was found in the consolidation. No paid calls, dependency changes or public API changes were needed; the existing upstream release dependencies remain separate.

## Simplification review follow-up (2026-10-28)

Claude's review identifies real duplication around an already small LLMAgent execution pipeline, but its proposed first group is not entirely behavior-preserving. The user reconfirmed flat injected helpers (`scale(...)`); no `_tools` namespace is introduced. The following bounded simplifications are applied:

- TemplateEngine and ScriptEngine share environment, render-option and filter setup. Each retains its native source lifecycle, caching, error wrapping and output handling.
- Template and Script use one configuration validator parameterized by component kind, preserving validation order and diagnostics.
- `AgentRunSettings` derives fixed exclusions from the same tuple as runtime validation, removing a copied list.
- `createLLMAgent` reads resolved `config.asTool` instead of receiving the same mode separately. Factory modifier selection and prepared-input boundaries keep their distinct roles.
- An internal compile-only assertion compares the complete agent configuration surface with native request keys and the actual request filter. Removing `debug` from the filter fails its mutation check. This guards new Casai-only settings without a runtime SDK whitelist or a new classification framework. Public consumer checks remain separate from source implementation assertions.

The remaining proposals were evaluated against their consumers and native implementations:

| Proposal | Finding and disposition |
| --- | --- |
| One renderer and universal factory scaffold | Shared setup is extracted, but the claimed compile-timing drift is inaccurate: Cascada's template constructor creates a lazy template, while its Script constructor immediately transpiles source. The current ScriptEngine defers that constructor until invocation. A broader merge must preserve this distinction, output parsing, loader caching and override behavior; the claimed halving of code is not established by the review. |
| One exclusive settings classification | Roles overlap: `output` is fixed and protected; `onChunk` is protected and streaming-only. Descriptor keys also serve other components, and SDK-owned fields are outside a Casai-only key set. Reusing existing groups plus the new exhaustiveness assertion addresses the concrete duplication and omission risk without inventing another settings model. |
| Remove message validation before hooks | The SDK validates the sent request; Casai also retains the original conversation for history and pending-work checks. A focused generation/streaming probe supplies malformed original history and valid replacement messages: native output succeeds, but augmented `value` fails and history retains invalid data if original validation is bypassed. Existing validation prevents that before hook/provider execution. Keep it. |
| Remove Config family checks or callback fragments | Both change supported authoring behavior. Tests require early rejection of inconsistent fragments, and inherited callback fragments carry reusable policy. Final-factory validation does not make earlier validation dead code. Two data-only README examples do not establish that callbacks are unused. Keep both. |
| Move `toolsContext` merging out of preparation | The existing paths already share binding and selection semantics. Moving the merge also moves override validation and call-site work; removing a parameter alone does not establish a smaller pipeline. Keep the current owner and immutable binding guarantees. |
| Trim result augmentation | Its SDK-shaped entry points support direct native comparisons and protocol tests. Snapshots, history defaults and callback aliases have tested behavior; the completion WeakMap connects a native result to lazy final-value handling without changing its surface. An explicit `{ result, final }` return is plausible, but the review does not demonstrate a simpler complete replacement. No result lifecycle changes are made here. |
| Drop debug output, component `type`, the loaded Script tool alias, or source-kind strings | These are existing observable or typed contracts. A new source object or shared logging scaffold also adds migration and policy choices. Internal call-site counts alone do not justify removal. |

Verification: the focused renderer/configuration/agent/inheritance suite has 151 passing tests. The complete mock coverage run has 1,633 passing tests, 99.64% lines/statements, 100% functions and 97.05% branches; existing thresholds pass. All four `test:types` passes succeed, including 64 current README2 examples; the final warm run took 7.3 seconds. Type-aware lint reports no errors or warnings across all ten changed TypeScript files (25.3 seconds). The request-filter mutation is caught (7.5 seconds including aggregate and registry budgets). No paid calls were made.

All 13 compiler-cost workloads pass unchanged ceilings. LLMAgent import cost is 365,540 instantiations; hooks measure 36,527 first-batch / 13,952 additional-component instantiations, and native methods 5,576 / 4,090. First-batch counts improve while hook growth is unchanged; this is not a solution to the known hook typing cost. The subsequent pass retraced public factories/modifiers, inheritance, ordinary/native/tool entry points, preparation, request filtering and result consumers after these changes, with no further important finding. Editor and broad mutation matrices were not repeated for this behavior-preserving cleanup. The upstream release dependencies recorded below remain open.

## Whole-surface implementation review (2026-10-28)

A fresh review against the six implementation slices found two further public typing defects. Both are corrected without changing runtime behavior or introducing another execution path:

1. **Native method extras escaped their declared contract.** Generic `.generate()`/`.stream()` arguments rejected the previously enumerated fixed settings but still accepted arbitrary other properties, including `model: 42`, a new tool registry, Casai `context`, and `prepareCall` replacement. Native SDK literal calls reject those fields; Casai's generic signatures accidentally made them unchecked settings. Admission now derives the allowed keys directly from the corresponding native Agent parameter type, retaining generation/streaming differences, native aliases, configured input omissions and Agent/UI assignability. This replaces the partial type-level blacklist rather than extending it. Untyped unknown-setting forwarding retains its agreed runtime policy.
2. **Hook config types intersected defaults with overrides.** With a public `detail: 'brief' as const` default, `config.context.detail` was still typed only as `'brief'` when a caller supplied `'deep'`; a valid hook comparison failed compilation. The raw configuration view now uses the existing shallow-merge type and preserves configured private bindings under open/no-schema input. Runtime already behaved correctly: both hooks see raw caller overrides, while their third argument contains parsed/transformed values. The new runtime case crosses shorthand, `.run()`, `.generate()` and `.stream()` and confirms reusable configuration remains unchanged.

The review retraced factory modifiers and inheritance, fixed/replaceable settings, ordinary/native/tool calls, shared preparation and binding, callback ownership, result availability/history, stream retries/transforms, output delivery, SDK UI consumers, annotations and declarations. Native comparisons used the installed `ToolLoopAgent`, Agent parameters, observer dispatch and core generation/streaming code. No retired Text/Object factory or execution-adapter references remain in production source or emitted modules.

After the corrections, the subsequent surface pass found no important unresolved Casai implementation defect. All six planned slices are present. The runtime architecture is appropriately small: one invocation pipeline delegates execution to the SDK, prompt rendering to Cascada, and tool/input preparation to shared owners. Replacing it with ToolLoopAgent would require restoring deliberate differences in defaults, input preparation, hook precedence and protected settings. The request filter remains an explicit maintenance responsibility; an exhaustive runtime SDK whitelist would contradict the agreed forwarding policy.

Verification: all four `test:types` passes and all 64 current README2 consumers pass; mock coverage has 1,633 passing tests, 99.64% lines/statements, 100% functions and 97.01% branches. Three targeted type mutations detect loss of native input validation, native setting admission and raw hook-context overrides. TS7 editor completion, hover and named diagnostics pass for source/declarations in both optional-property modes. Type-aware lint covers the three changed TypeScript files. Checks were compiler-sequential; no paid calls were made. The final lint cleanup only renames a type-only callback parameter.

All 13 cost workloads retain their existing limits. Native methods measure 7,197 first-batch / 4,090 additional-component instantiations; hooks measure 38,343 / 13,952. Hook typing remains the largest design cost, substantially above native ToolLoopAgent. This pass found no demonstrated simpler replacement that preserves the accepted inference and validation contracts; the budgets are regression limits, not a claim that this cost is solved.

**Release readiness is separate:** the published engine's missing `makeSharedIterable` export and the newer compiler/renderer handoff remain open upstream dependencies. This review did not rerun packaging or establish either dependency; the earlier package evidence below still applies. No additional product decision was required for these corrections.

## Final review follow-up (2026-10-28)

The latest Claude review's three small improvements are applied. No additional product decision or execution architecture is needed:

- Native `.generate()` and `.stream()` now share `.run()`'s fixed-setting rejection before input preparation or SDK dispatch, including own `undefined` properties. Contrary to the review's assumption, the generic native method signatures also admitted fixed settings in typed calls. The shared setting-name list now guards those signatures; inline values, variables and explicit undefined have independent negative tests.
- Every README2 TypeScript fence is inventoried: 64 current examples compile verbatim with concrete setup, and 17 future examples have explicit phase skips. Generated examples moved to `.cache/readme2`: the previous location under excluded `node_modules` meant only the exact-optional profile actually checked them. File inventories now confirm all 64 belong to each consumer profile. The expanded checks caught a public-default error in the quick start (`audience` needed an input declaration) and an exact-optional fetch signal example. Shared `.run()` typing now admits an optional signal forwarded unchanged, matching its existing undefined-as-omission runtime behavior.
- A non-object `prepareCall` return produces a clear `ValidationError` at the hook boundary. Casai keeps its agreed complete-request return contract; it does not adopt native ToolLoopAgent's undefined/null fallback. Native `prepareStep` partial-return behavior is unchanged.

Verification: all four `test:types` passes succeed (30 seconds with existing caches); mock coverage has 1,632 passing tests with 99.64% lines/statements, 100% functions and 97.00% branches. Existing coverage thresholds pass. Type-aware lint passes for all seven changed TypeScript files after correcting the runtime test's method invocation. Two runtime mutations and one type mutation independently detect removal of the new guards. The focused runtime cases also pass after that test cleanup. No paid calls were made.

All 13 compiler-cost workloads pass without changing limits. Native methods measure 7,188 first-batch / 4,090 additional-component instantiations against the previously approved 7,300 / 4,500 limits. Hook cost remains 38,209 / 13,858; this review does not claim to solve that known design cost.

The subsequent surface pass retraced the inventory below, including ordinary/run/native/tool calls, shared preparation, fixed output consumers, hook replacement and protected fields, inherited modifiers, cancellation forwarding, declarations and actual documentation compiler inclusion. It found no important unresolved implementation issue. Unknown invocation settings retain the agreed forwarding policy; the explicit request-filter list remains a maintenance responsibility. The published-engine export and newer compiler/renderer handoff remain the release dependencies recorded below.

## Implementation review corrections (2026-10-27)

The subsequent Claude review correctly found three public typing defects and an example-verification gap. They supersede the earlier sign-off below. The corrections preserve the agreed architecture and need no new product decision:

- Inline approval status maps retain their literals, alongside precise native callback inputs. Valid statuses, invalid statuses and unknown tool names have independent checks.
- `.run()` validates tool selectors against the final registry, including inherited selections, caller maps and per-tool timeout names. Its type resolution ignores undefined top-level settings, matching runtime inheritance; undefined entries inside maps retain their existing replacement meaning. Runtime selection behavior remains SDK-owned.
- A complete `prepareCall` return requires `toolsContext` when the declared tools require it. Optional context and context-free tools remain supported. Tests use otherwise valid minimal returns under both optional-property modes.
- Twelve marked README2 examples are extracted directly into the existing source and declaration checks. They cover results, streaming, tools, approval, hooks, native context and UI consumers without executing model calls. Future APIs remain outside this inventory.

Shared setting-name constants now serve validation and public hook types without importing the execution module. The redundant factory precheck and overlapping agent-specific validation lists are removed; raw-input and merged-parent validation remain distinct. Invocation options are named. Four old output-schema negatives now use valid SDK outputs, so retired output strings cannot conceal the boundary under test. The stale TextGenerator guidance is corrected.

Verification: all four `test:types` passes and all twelve documentation consumers pass; the mock suite has 1,628 passing tests, with 99.64% lines/statements, 100% functions and 97.00% branches. The augmentation thresholds remain unchanged. Five targeted type mutations independently detect loss of approval literal inference, final run selections, undefined inheritance, required hook context and timeout names. No paid calls were made.

Editor completion and hover checks pass for source and declarations in both optional-property modes, including inline approval literals and callback arguments. Type-aware lint passes on all changed TypeScript files after correcting one unused test parameter. The subsequent surface pass retraced constructors/modifiers, inherited configuration, ordinary/run/native/tool entry points, callback requests, bindings, result consumers and documentation. It found no further unresolved correctness issue; the compiler-budget gate below is now closed.

The hook-cost concern remains valid: the earlier 40,000/15,000 ceilings establish a regression baseline, not an independent claim of inexpensive typing. Hooks now measure 38,209 first-batch / 13,858 additional-component instantiations. A dependency-projection experiment increased cost and was discarded. Filtering the provisional prompt before mapping callback fields reduces redundant inference work, but the complete hook contract still costs substantially more than native ToolLoopAgent. No callback precision or validation is weakened to improve that measurement.

**Compiler-budget decision confirmed:** the user approved raising only the native Agent-method workload's first-batch ceiling from 7,000 to 7,300. The focused 0/12/24-component rerun passes at 7,129 first-batch / 4,036 additional-component instantiations, against ceilings of 7,300 / 4,500. All twelve other workloads retain their passing results and unchanged limits, closing the performance gate. Alternatives that skipped approval specialization without tools reduced import cost but exceeded the structured-stream growth budget; they were discarded. This is an explicit budget adjustment, not a claim that the new checks cost nothing.

Unknown `.run()` fields still follow the explicitly agreed native-forwarding policy. Catching every untyped Cascada typo would require a separate runtime SDK-setting whitelist; this review does not silently introduce one. The published-engine export and newer compiler/renderer handoff remain the release dependencies recorded below.

## Implementation review (2026-10-27)

The implementation now uses one LLMAgent factory and one invocation path over native generateText/streamText. The four Text/Object factories, their public types, the legacy positional dispatcher, object-result adapters and output-name delivery selection are removed. Historical sections below record the decisions that led here; their references to current pre-migration factories are no longer implementation status.

The review inventory covers every source modifier, ordinary and named calls, native Agent methods/UI consumers, tool executors and binding, Config inheritance, configuration annotations, emitted declarations, callback/editor inference, result views, approval continuation and telemetry. The final verification ledger is recorded below after the integration gates.

| Surface | Implementation and review evidence |
| --- | --- |
| Configuration and modifiers | Base factories preserve supported source/tool/streaming modes through Config. Explicit source modifiers replace the source. Ordinary constructor clearing and invocation undefined semantics remain distinct. Template/Script expose explicit inline selectors. Annotated configurations that can select loaded source need a loader or an explicit inline modifier. |
| Calls and preparation | One application parse and prepared context per invocation; source/context/history order for rendered calls; literal native methods bypass only rendering/loading. Function-source replacement retains parsed callback inference through inherited mode. |
| Hooks | Three arguments, original pre-hook config/context snapshots, complete editable call-request replacement, native partial step overrides, SDK scheduling and protected output/signal/observers/approval/telemetry. Configured source reuses its renderer cache. |
| Registries and tools | Authored entries reach prepareCall; the final selection is bound for dispatch. Explicit bindings retain matching context. Preparer helpers retain their original bindings. Tool forms omit the incompatible Agent-only surface. |
| Results | Every explicit Output has completed promise delivery when streaming; omitted output retains the final-text iterable. Native streams and final output reuse one execution/parse; original conversation owns history and pending-work checks. |
| SDK execution | Native one-step default, SDK approval/signing and telemetry dispatch, native retry/cancellation limitations, no Phase 7 controllers or timers. |
| Migration | Current README and provider-test entry names use LLMAgent. Native-output enum/schema behavior belongs to the SDK; mutation fixtures now target the unified factory instead of removed object-mode validators. |

The review found and fixed integration defects: configured prompts were unnecessarily passed as renderer overrides; inherited function sources lost callback inference through the base factory; explicit Template/Script source selection could not replace an incompatible inherited source in types; and a later inference correction widened inline message roles and rejected typed function sources through an intermediate Config. Source-kind admission now preserves typed callbacks, while the final component checks their parsed dependencies. Reusing the resolved source mode avoids a more expensive contextual-inference workaround. The source-presence checks have one owner at component entry; rendering errors retain their native cause without duplicated string/unknown branches.

Compiler simplifications retain the existing budgets: resolve provisional inference before reading tool metadata; avoid constructing callback contracts when a config has no callbacks; derive the resolved source type once; and combine resolved mode metadata. No compiler options or existing workload ceilings were relaxed. Native-method and hook workloads have separate measured budgets because they are new public surfaces. Hook typing includes Casai's flat config/context, schema/default/private-input checks and full editable request, so the native comparison is a baseline, not a claimed equal-cost implementation.

| Workload | Import instantiations | First batch per component (rounded up) | Additional component |
| --- | ---: | ---: | ---: |
| Function | 263,751 | 6,018 | 4,904 |
| Function tool | 263,751 | 10,396 | 8,949 |
| Template | 277,776 | 3,439 | 2,916 |
| Script | 279,066 | 3,582 | 3,028 |
| LLMAgent text | 357,118 | 5,253 | 3,322 |
| LLMAgent text streaming | 357,118 | 5,254 | 3,322 |
| LLMAgent structured | 357,118 | 4,291 | 2,298 |
| LLMAgent structured streaming | 357,118 | 4,292 | 2,298 |
| LLMAgent hooks | 357,118 | 37,518 | 13,757 |
| Native ToolLoopAgent hooks | 0 | 3,967 | 840 |
| LLMAgent native methods | 357,118 | 6,270 | 4,038 |
| Native ToolLoopAgent methods | 0 | 2,970 | 776 |
| Config | 341,527 | 7,356 | 2,892 |

Initial first-batch/growth ceilings were 40,000/15,000 for LLMAgent hooks and 7,000/4,500 for its native methods; the later approved method ceiling is recorded above. Native comparison ceilings remain 4,500/1,000 and 3,500/1,000 respectively. The fixture measures 0/12/24 fresh consumers sequentially. Native import-only cost is zero under skipLibCheck because no declarations are instantiated until used. The historical Function aggregate comparison improved from 419,566 to 396,055 instantiations in the follow-up mutation run; the representative registry contract adds 5,777 (630,376 to 636,153), within its retained budget.

### Verification and subsequent pass

| Check | Result |
| --- | --- |
| Mock runtime and coverage | `npm run test:coverage`: 1,622 passing across 41 mock-only files; 99.64% lines/statements, 100% functions, 97.02% branches. The augmentation core retains 100% lines/statements/functions and 98.18% branches. All existing thresholds pass. No provider-backed tests were run. |
| Public types | `npm run test:types` passes source, clean regeneration of declarations, emitted consumers and exact optional properties. The final checks include literal message-role inference, function sources through Config, PromiseLike preparers and native Agent/Tool consumers. |
| Editor | All four source/declaration and optional-property variants pass completion, parsed callback inference and named diagnostics, including inherited function sources through Config. |
| Lint | The full source/test lint pass was followed by successful focused checks of every correction and subsequent type-only cleanup. All rules and file coverage are retained. |
| Runtime mutations | All 58 deliberate regressions are caught in isolated source copies, including protected hook fields, inherited modifiers, SDK request ownership, binding/default/privacy checks and native message transport. |
| Type mutations | All 99 migrated guard mutations are caught; a subsequent 19-case Config/LLMAgent pass also catches every affected guard after the inference corrections. Valid neighboring calls compile before each mutation. |
| Compiler cost | All 13 final workloads pass the ceilings recorded above. The old budgets were not relaxed. Measurements are bounded instantiation counts, not a whole-project timing claim. |
| Distribution | A clean build removes retired emitted modules. Tarball declarations and runtime pass outside workspace resolution with the local Cascada build, including cross-package components and LLMAgent streaming/Agent contracts. The fresh consumer resolves AI SDK 7.0.154 and Zod 4.6.7 within the declared ranges. |

The subsequent complete pass traced the public factories/modifiers, inherited configuration, shorthand/run/native calls, hook requests, tool bindings, result consumers and package exports after the corrections. It found no important unresolved Casai Phase 3 implementation issue. Native output parsing, transformed tool history, continuation-setup errors and cancellation limitations retain their documented SDK ownership; no additional execution tracker, output adapter or deadline machinery was introduced. Removed factories, positional dispatch, object-result adapters, name-based delivery and unused legacy type helpers have no remaining production consumers.

**Release dependencies remain open.** With published `cascada-engine@0.6.2`, the clean tarball's declarations pass but runtime import fails because that engine does not export `makeSharedIterable`. The paired local-engine tarball passes; it does not replace a coordinated engine release and dependency-minimum check. Separately, the newer Cascada compiler/renderer argument-provenance handoff still needs its upstream implementation and acceptance checks. These Casai results establish neither upstream gate and add no legacy-runtime workaround.


Reviewed on 2026-10-27 against the current plan, production factories and installed `ai@7.0.130`, following the supplied Claude Code review. This records design corrections and evidence, not Phase 3 implementation or completion. The [plan](plan.md#phase-3-llmagent) remains the contract; unresolved behavior choices require a user decision.

This is a chronological decision record. The later [unified-context follow-up](#unified-context-follow-up-2026-10-27) supersedes earlier separate-options contracts, absent SDK hook context, and empty-input-only literal tools; the [broader-request confirmation](#broader-request-confirmation-and-implementation-readiness-2026-10-27) supersedes earlier restricted-hook recommendations. The [fourth review](#fourth-review-2026-10-27) adds confirmed approval and telemetry exclusions without reversing the broader request or uniform precedence. Native probe results remain historical evidence.

## Findings and disposition

| Review finding | Disposition |
| --- | --- |
| Hook ordering, editable fields and input flow | User confirmed final-hook precedence: configuration/call settings resolve first, and the returned editable request wins. The later three-argument decision settles input flow; the broader editable field set is confirmed in the final follow-up below. Keep protected settings outside the replacement. |
| Remove per-call `prepareCall` because `.run()` already controls settings | Rejected by the confirmed decision: `.run({ prepareCall })` remains available to replace the configured policy. A final hook can otherwise override the caller's settings. |
| Plain tool arguments are ignored | Reproduced. User chose named-input preparation through configured template/script/function sources, with no implicit model `prompt` override. Plain/loaded-text tools remain allowed with fixed configured prompt/resource and empty public input. |
| `.loadsText` call form is missing | Added a resource-name/history form, no rendering context, and rejection of lone arrays. This follows the planned main-property type and no-history-inference rules; migrate the old factory's array shortcut explicitly. |
| Streaming `value` simplification | Approved on 2026-10-27: promised final value for every explicit `Output`; retain default-text streaming. Update the shared adapter/types and consumers at Phase 3 integration. |
| Duplicate conversation sources / pre-call trimming | Reproduced the upcoming hook handoff gap. LLMAgent will supply one original conversation to history and pending-work checks, captured before hooks. Retain the old static-message distinction only while old factories remain. |
| Option validation happens after effectful preparation | Move it before loaders/renderers/prompt functions, preserving applicable application-input validation first and using the same parsed options later in the hook. Add entry-count acceptance checks. |
| Injected executor retained for one final LLM factory | Remove that requirement from the final architecture. Select generation/streaming directly by invocation mode; retain genuinely shared preparation/result primitives. |
| Streaming inheritance cannot be reversed | A cost of an explicitly settled contract, not an error. Preserve it. |
| README function-source call and callback composition | Added the missing function-source row; distinguish observer composition from control-hook replacement. |
| Completion omits hooks/options | Require custom options, hooks, callback composition and the resolution of their design gates before Phase 3 completion. Independent earlier slices can proceed. |
| Per-call `id` unspecified | Clarify creation-time identity, outside model-call settings; reject `.run({ id })`. |
| Make native methods' `options` optional when configured | A possible convenience, not an Agent-compatibility fix. The current plan deliberately retains SDK call parameter types, which require `options` for non-`never` call options. No signature widening is selected here. |
| Structure, task order, verification and cost | Nest the Phase 3 sections, specify implementation slices and coverage matrices, and carry forward measured type-cost checks. Preserve existing acceptance details and anchors. |

## Plain tool input and loaded text calls

A local mock called the production `TextGenerator.asTool` twice with the same configured literal prompt and different valid `{ topic }` arguments. Both calls reached the model with identical prompts. The input schema validates the arguments, but literal dispatch does not consume the resulting context. This is not evidence for a finished LLMAgent tool contract.

The user selected `.withFunction`/`.withScript`/template preparation for named inputs, reusing the existing context boundary. The configured source controls the prompt; a function can deliberately return one declared input field as the whole literal prompt, but a field named `prompt` is not implicitly promoted to a setting. The user separately confirmed empty-input tools with a fixed configured literal prompt, or a fixed resource for loaded text. Those non-rendered forms do not accept declared public fields. Application-authored source overrides retain their ordinary call rules. This resolves the missing tool contract without introducing implicit prompt mapping.

Existing loaded-text validation accepts string resource names, but retiring factories also have a lone-array prompt shortcut without loading. Phase 3 already requires the call-time main property to match its modifier and forbids inferring positional history. Its loaded-text contract therefore names a resource explicitly, rejects a lone array, and uses named history when reusing a configured resource. No current factory implementation was changed in this review.

## Streaming value comparison

The user approved the proposed column below on 2026-10-27. It supersedes the earlier name-based delivery contract for Phase 3. Production retains the before-decision behavior until the shared adapter, types and consumers are migrated together.

The current core makes only omitted/default text eligible for incremental final-output delivery, subject to terminality, retry and stream-transform rules. Every explicit output waits for completed parsed output. For explicit `text` names it then yields the parsed value; for `array` names it iterates it; other names return a promise.

| Case | Delivery before this decision | Approved Phase 3 delivery |
| --- | --- | --- |
| Omitted/default text | Async iterable, incremental only when finality is established | Same |
| Explicit `Output.text()` | Async iterable yielding the completed parsed string | Promise of that string |
| Explicit array output | Async iterable of completed parsed elements | Promise of the completed array |
| Explicit object/choice/JSON | Promise, with an ambiguous static delivery union when the name is erased | Promise with no name-based delivery union |
| Custom explicit output | Delivery selected by runtime `name` | Promise of the parsed value, even if that value itself is an iterable |
| Optional output configuration | Union including the default-text case | Still a union of a default-text stream and explicit-output promise |

There is no latency regression for the current explicit-output path: it already waits for completion. Consumers of explicit text/array `value` change from iteration/collection to awaiting the result. Cascada's automatic awaiting simplifies some consumers, while explicit iteration and stream composition must migrate. Default-text composition remains unchanged. Native `textStream`, `elementStream`, `partialOutputStream` and events remain available, but do not acquire the final application-output guarantee of `value`.

The simplification removes runtime-name delivery and its erased-name union for definite explicit outputs. It must preserve output eligibility, native parsed values, one execution/parse, and custom iterable ownership; it must not simply alias native `output` and bypass pending-work checks.

A native-compatible custom output can spread `Output.array(...)` and replace its complete parser with a pure reversal. A local streaming probe returned `[2, 1]` from provider data `[1, 2]` while retaining `name: 'array'` and the native element-stream method. Those signals cannot establish agreement between native incremental elements and final parsed output. This explains the approved promise-based explicit-output contract; it is not a claim that a future SDK could never expose a stronger contract.

## Conversation before request hooks

The current augmentation core snapshots two inputs: the supplied conversation prefix for history and the sent request for pending-work checks. Old factories need that distinction because they can include configured static messages only in the latter.

A local probe simulated future `prepareCall` trimming by passing a request containing only a new user message, alongside an original conversation with an unresolved deferred provider call. In generation and streaming, history retained that pending call but `value` incorrectly returned the mock answer. An untrimmed control correctly rejected `value` for pending tool work. Existing `prepareStep` trimming tests pass because the core captures its incoming request before that later hook runs.

LLMAgent has no configured static messages. Capture its original assembled/literal conversation before `prepareCall` and pass it to both history assembly and pending-work checks, followed by native response messages. A hook's altered provider request is a separate transport value. The plan now assigns this handoff and its positive/negative tests to integration; the retiring factories were not patched with a conflicting history contract.

## Type-check baseline and budget

The focused command completed successfully on 2026-10-27 with installed TypeScript 7.0.2:

```powershell
node tests/fixtures/phase2-factory-cost.cjs '^(TextGenerator|TextStreamer|ObjectGenerator|ObjectStreamer|Config)$'
```

Each workload used fresh compiler processes for 0, 12 and 24 independently configured components, with the fixture's existing strict settings and no incremental cache. Available memory was checked first; compiler processes ran sequentially. All 15 passed. Per-process wall time was 609–1,142 ms and reported compiler memory was 183,431–229,152 K. These bounded source workloads do not measure the whole type gate or editor responsiveness.

| Current workload | Import-only instantiations | 12 components | 24 components |
| --- | ---: | ---: | ---: |
| TextGenerator | 613,337 | 704,969 | 744,509 |
| TextStreamer | 479,706 | 555,803 | 594,863 |
| ObjectGenerator | 455,493 | 554,075 | 576,359 |
| ObjectStreamer | 397,020 | 475,773 | 497,097 |
| Config | 823,357 | 1,195,529 | 1,348,697 |

Carry the existing numeric ceilings into equivalent Phase 3 consumer workloads:

| Equivalent final workload | First-batch cost per component | Additional-component cost |
| --- | ---: | ---: |
| Text generation | ≤ 9,500 | ≤ 4,100 |
| Text streaming | ≤ 8,000 | ≤ 4,100 |
| Structured generation | ≤ 10,000 | ≤ 2,400 |
| Structured streaming | ≤ 8,200 | ≤ 2,300 |
| Config | ≤ 39,000 | ≤ 16,000 |

The first-batch measure is `(12 - 0) / 12`; growth is `(24 - 12) / 12`. Use one ≤ 800,000 import-only ceiling for the unified LLMAgent module, matching the largest existing LLM-family ceiling, and retain Config's ≤ 1,000,000 ceiling. Preserve equivalent consumer behavior while migrating Object schemas to native `Output` specifications. Budget added hook/Agent-method workloads separately from these existing cases, with measured native/shared-core comparisons and explicit numeric limits before integration. Rebaseline only with before/after evidence; do not weaken compiler assertions or required capabilities to meet a budget. Also record relevant source/emitted cold/warm profile diagnostics at integration milestones.

## Second review (2026-10-27)

The second supplied Claude Code review identified further interface and request-replacement gaps. This pass checked its recommendations against the installed SDK, current dispatch and plan, then updated the plan and README2. The user explicitly selected Agent/tool separation, normalized hook messages and parsing omitted options. These are design decisions and bounded native evidence, not production integration.

| Finding | Disposition |
| --- | --- |
| Agent and function Tool disagree about `id` | Reproduced with TS7 in both optional-property modes. Non-tool LLMAgents retain the Agent interface; `.asTool` keeps callable/`.run()`/`.config` plus Tool properties, omitting Agent identity/version and SDK Agent methods. A configured id remains only in `.config` on a tool. |
| Minimal `prepareCall` return loses configured timeout | Reproduced. Generalize protection to every admitted execution setting outside the final editable return surface, selected by its own settings-table rule. Do not re-merge omitted editable fields. Native call-level timeout remains protected already. |
| Sandbox grouped with dropped native controls | Refined: native hook input includes sandbox, its return does not, and native dispatch reinstalls the call's sandbox. This is not another demonstrated native timeout-loss case. Casai still needs a clear dispatch owner for every admitted excluded control. |
| Hook conversation shape unspecified | User selected one `messages` array for the editable hook request. Normalize external string/array prompt and messages forms without rendering or another message-schema pass; retain the pre-hook history/pending-work snapshot. |
| Undefined options skip defaults | Native omission reproduced. User selected parsing whenever a schema exists, including effective undefined, after resolution and before preparation effects. Preserve undefined override retention of configured options. |
| One SDK options generic conflates schema input/output | Correct the type contract explicitly: raw input for Agent/native/UI callers, parsed output for hook options. Derive native fields with those adaptations and the normalized conversation field; do not copy the native hook type unchanged. |
| Settings reference removed/replaced tools | Carry the final statically resolved registry through selection/order/approval/refinement/caller/timeout types and inherited compatibility checks. Narrow the review's hook claim: native hooks remain typed against their declared registry, and do not prove the exact runtime subset a callback returns. Add no dependent callback-inference framework or runtime rewriting. |
| Per-request agent-tool settings | Document explicit Function-tool forwarding through trusted context into the shared agent's `.run()`, including cancellation. This reuses a valid configured agent/renderer. It cannot make an agent with missing required configured options valid; without reusable defaults, request-specific construction is still required. |
| Final delivery change arrives too late | Move shared delivery/type/consumer migration into slice 1. Any surviving Text factories adopt that shared change; do not maintain two delivery contracts. Remove factories as soon as their unique regressions are ported, rather than waiting for the last slice. |
| Stale custom-parser/iterator wording | Remove obsolete name-based collection rationale and parser-dependent incremental eligibility. Explicit output always promises its final parsed value; default text retains the stable-prefix/finality rules. Preserve schema purity and native partial-stream behavior. |
| Empty conversation rejected before hook | Clarify SDK validation of the final sent conversation after the hook. Do not infer omitted required shorthand/native arguments merely because a hook could synthesize messages. |
| Hook-returned tools/prepareStep bypass binding check | Bind the effective returned registry/context, then wrap the effective step hook. Add acceptance cases with no initial configured tools or hook, changed Casai context, valid unchanged context and native-tool controls. |

### Native and typing evidence

Focused TS7 probes checked real `Tool`/`ToolSet` assignments, not only an interface intersection. A callable-compatible tool descriptor without `id` is accepted. Adding a configured string id or Agent's `string | undefined` id rejects in both modes. An own `id: undefined` accepts only without exact optional properties. The `Agent & Tool` intersection narrows its id to the provider-tool identifier pattern and still fails ToolSet assignment with exact optional properties. This confirms that a cast/intersection is not the contract fix.

A separate bounded type probe passed raw string option input to `Agent`, rejected a parsed number at that call boundary, and verified numeric-only access in the adapted hook. It also checked the native sandbox input/return distinction and showed that a native hook may omit its returned tool registry while retaining a name from its declared registry. That last positive is evidence of the native typing limit, not an endorsement of inconsistent request settings. The four measured compiler runs were sequential, with both optional-property modes, no emit and `skipLibCheck`; wall times were 340–419 ms. An additional focused pair confirmed the valid no-id ToolSet neighbor. Approximately 1.03 GiB was free before these focused checks. This does not establish production factory inference, emitted declarations, editor behavior or the complete type gate.

Mock generation checks against `ai@7.0.130` completed with explicit assertions:

- A slow model with a configured 15 ms timeout rejects without a hook or with a spreading hook. A hook returning only its declared required fields loses that timeout and completes. Supplying the timeout on the call restores native rejection.
- A root-default options schema receives no parse for native `options: undefined`; the hook sees undefined. Supplying `{}` applies the field default. Direct schema parsing of undefined produces the root default, establishing the selected Casai difference.
- String `prompt`, array `prompt` and `messages` produce identical provider conversations. A native hook can fill an initially empty message array before final SDK validation.
- Unknown `activeTools` entries are filtered by native execution, unknown named `toolChoice` reaches the provider request, and an unknown `experimental_toolCallers` key rejects before provider entry. The text-only mock response to the forced choice then rejects with native `ToolChoiceViolationError`; forwarding the unknown name is not a claim that the whole call succeeds. These different native rules remain native; Casai adds no blanket runtime normalization.

Timeout runtime evidence above covers generation; streaming and all protected-field combinations are explicitly assigned to Phase 3 acceptance. Existing context-binding tests cover current dispatch, not the future hook-returned registry path. No production source was changed or paid provider calls made in this pass.

## Three-argument hook follow-up (2026-10-27)

The user selected `prepareCall(request, config, context)` with custom options removed from the request. The same argument convention applies to `prepareStep(step, config, context)`, while retaining native step information and partial-return semantics. Both hooks read parsed options in the same invocation-local `config.options` view and reuse the prepared application context where available; SDK literal paths do not manufacture it. Configuration/input context remains distinct from parsed execution context. Hook returns do not update the config/context snapshot, component or another invocation.

This supersedes the earlier proposed first-argument parsed `options` member and the two-argument metadata-object alternative. There is one convention, no arity detection. Native one-argument step callbacks can ignore extra arguments; call hooks using native first-argument options require explicit migration. The existing step/binding wrapper supplies metadata to configured, overridden and call-hook-returned step callbacks. SDK Agent interoperability is independent of this authoring signature. README2 uses one example showing Casai context and SDK option fallback, and keeps the detailed contract and acceptance checks in the plan.

## Unified-context follow-up (2026-10-27)

The user selected one application context and one `inputSchema`. Casai configuration and `.run()` use `context`; native Agent methods/UI helpers keep `options` only as the transport name for the same raw input. Remove Casai `options` defaults/overrides and `callOptionsSchema`. Reuse shared public-default selection, shallow merging, single input parsing and private-binding guards. Native options are not a trusted-private override channel.

Every LLMAgent path prepares context, including literal and loaded text. SDK entry skips source loading/rendering, but still validates the shared application input. A required renderer-only field must therefore also be supplied through SDK options or configuration defaults; this consequence is accepted rather than adding a second or partial schema. Both three-argument hooks receive the prepared object, and rendered paths use that same object for preparation. The invocation's config view keeps resolved configuration/input data; it is not rewritten with parsed results or hook replacements.

Literal tools can now consume declared context in hooks while retaining their application-configured source; empty-input fixed-prompt tools remain valid. Ordinary literal/loaded-text calls admit context without making that admission depend on hook presence. No model field implicitly overrides the prompt. Public context can be supplied at call time, so the earlier required-configured-options rule and options-forwarding wrapper are unnecessary.

README2 now states the common data model and its actual exceptions: one source/implementation, one input contract and one output contract, with component-specific property names and implicit text output. Model/tool/execution settings and optional trusted `toolContextSchema` remain. The original three-argument decision still stands; its earlier `config.options` placement and absent SDK context do not.

The user additionally confirmed the type boundary: exclude custom options from Casai configuration, `.run()` and hook request/config types, while retaining native SDK method/UI-helper `options` for the same raw context input. Removing that channel through `Agent<never>` is possible but would require configuring request context before SDK helper invocation; the selected mapping preserves reusable-agent calls. Core generation/streaming dispatch receives no custom options.

Validation for this documentation change checks cross-references, example syntax and stale-contract wording. It does not prove the future factory implementation or type inference; the plan carries paired runtime/type cases for native options, context defaults/transforms, private collisions, required renderer-only fields and no-input agents.

## Third review (2026-10-27)

The third Claude Code review was checked against the agreed three-argument/unified-context contracts, installed SDK types and source, current binding owners, and its supplied probes. It identifies real typing and documentation gaps; several proposed restrictions would reverse settled semantics without establishing a corresponding implementation requirement. Current production has no final LLMAgent factory, so these are design corrections and bounded evidence.

| Finding | Disposition |
| :--- | :--- |
| Native methods require options even when context is optional/default-satisfied | Confirmed. Recommend optional `options` on Casai's own native methods precisely when its shared caller contract permits omitted context. Required context remains required; actual Agent assignability and prompt/messages exclusivity must survive. The user subsequently confirmed this change; it supersedes the earlier strict native-property requirement. |
| No-schema Agent options unspecified | Reuse the ordinary no-schema public-input contract and private guards. Reject the blanket recommendation to use `never` merely because no schema exists: it would disable a context input path ordinary calls support. The optional-method proposal resolves omission without removing that channel. |
| Whole-config hook typing couples inherited callbacks to unrelated fields | Confirmed for contextually typed whole-config parameters. Keep the agreed three arguments and snapshot semantics. Explicit `unknown` for an unused config argument, or a narrow consumed-settings shape, permits safe reuse in the bounded probe. Preserve those authored types in final factory checks; do not infer property usage from callback bodies or assume `NoInfer` fixes assignability. |
| Config snapshot is stale/raw | Already intentional: it is resolved before hooks, while request/step fields describe execution and the third argument contains parsed application data. Do not silently replace it with component-only configuration, a live mirror or a sanitized alternative. Reading raw config input does not establish validation or authorization. |
| Hook-supplied conversation absent from history | Follows the confirmed request-only hook rule. Document the empty-input consequence and test it; use call input/a prompt preparer to create persistent turns. No new early rejection or special history rule. |
| Hook context helpers and final model tools may differ | Already permitted by binding-lifetime semantics. Clarify that helpers keep their pre-hook binding and reuse the prepared registry when selections are unchanged. Changed unbound selections get final dispatch bindings; explicitly bound descriptors still require matching context. Count Casai preparation separately from native validation. |
| Literal tools with unused declared input | Keep input admission independent of hook presence, as agreed. A hook-presence check neither proves field use nor covers unused fields in renderers. Actual configured hooks receive the prepared fields; a fixed tool needing no public input should declare an empty schema. Add no usage-detection or construction gate. |
| Public host input becomes public model input on tool derivation | Correct, under the existing public/private rule. Document and test it. A trusted identifier must leave the tool's public input schema as well as move to private configuration/trusted context; a trusted default under a still-public name remains overridable. |
| UI support overstated | Qualify support by non-tool form and satisfied input requirements; distinguish rendered Casai calls from native literal SDK calls. Plain agents are a convenient UI pattern, not a compatibility restriction. Required renderer-only fields on SDK calls remain the accepted single-schema tradeoff. |
| SDK options/context mapping deferred to hook slice | Move shared context mapping, validation and types into slice 1 with Agent methods; later prompt/hook slices consume that prepared input. |
| Cancellation metadata absent from hook description | State `context._toolOptions.abortSignal` on all paths for an explicit caller signal. Do not fabricate or expose the SDK's later internal timeout signal. |
| Stale wording and overlapping acceptance list | Correct old custom-options/SDK-skip claims and the plain-call summary. Group all acceptance cases under five linked areas; retain each case while combining overlapping rows. |

The initial recommendation at this review was the restricted native editable field set. The subsequent timeout investigation and user confirmation below supersede that recommendation with broader admitted SDK request settings.

### Bounded typing evidence

The supplied `options.ts` correctly demonstrates native property requiredness, but its widening uses a non-distributive `Omit`, which also admits missing or simultaneous prompt/messages. The review text recommends a distributive form; the corrected local candidate tests that form with generation and streaming, optional and required context, an open no-schema input, native Agent assignments, UI consumers, and valid/rejected conversation neighbors.

The config probe also uses an actual contextually typed function with `satisfies`, rather than only a declared callback type. Whole-config assignment rejects after output/tool changes; explicitly unused `unknown` or narrow model-only config parameters preserve reuse. `NoInfer` alone still rejects. Request/context dependencies remain separate; this does not prove final generic-factory inference or automatic safe reuse of every inherited callback.

The ignored workspace fixture is `node_modules/.cache/casai/phase3-third-review-j3Af0W/contract.ts`. After correcting the fixture's required SDK stream-type argument, TS7 checks passed sequentially in both optional-property modes with strict/noImplicitReturns/noEmit and skipLibCheck. Wall times were 588/438 ms; reported compiler memory was about 83 MB. Approximately 1.5 GiB was available before the focused checks. No paid provider calls, production source changes or full integration gate were run.

## Options confirmation and editable-timeout follow-up (2026-10-27)

The user accepted context-aware optional `options` on Casai's own SDK methods. The plan, README2 and agent instructions now require omission/explicit undefined to be valid exactly when the ordinary context input may be omitted. Required raw fields, both conversation branches and upstream Agent assignability remain intact. A reference explicitly typed as SDK Agent retains upstream method requirements. The focused TS7 fixture additionally passed explicit-undefined positives and required-context negatives in both optional-property modes (651/423 ms wall time).

The user questioned the claimed complexity of a broader call hook, specifically timeout. Source inspection confirms that core generation/streaming read timeout and establish timers at SDK entry; Casai already calls `prepareCall` itself and wraps the SDK-scheduled `prepareStep` to supply metadata. Neither a broader call hook nor timeout editing needs a Casai timer, loop or extra hook invocation. The recommendation is therefore revised to broader invocation settings, with fixed output/contracts, explicit caller cancellation and composed observers protected. The user subsequently confirmed the broader surface; this is an agreed design, not an implementation claim. Complete editable replacement applies to timeout too; omission is meaningful and does not restore earlier settings.

Native step hooks do not return timeout and run inside the SDK's already-started total/step budgets. Keep that native step contract. Phase 7's whole-invocation deadline starts before preparation; its integration with a later hook-selected timeout is explicitly recorded in [the deadline design](abort.md#phase-7-async-call-context-and-deadlines). It must preserve elapsed time, parent limits and expiration. This future interaction does not require timer machinery or restricting call-timeout selection in Phase 3.

## Broader request confirmation and implementation readiness (2026-10-27)

The user confirmed the broader call request. The plan, README2 and agent instructions now include timeout, streaming error handling/transforms/retries and sandbox in the editable settings derived from admitted public SDK request types. Complete replacement applies consistently: the hook may replace explicit call settings, and omitted editable settings are not restored. Fixed output/contracts, component setup, caller cancellation, composed observers, deprecated/internal fields and Casai metadata stay outside. Native step overrides remain unchanged, without timeout.

Removed the field-selection prerequisite from the hook implementation slice and updated its acceptance cases to cover both replacement and omission of the broader controls. Phase 3 is ready to begin on the implemented shared foundations. Its implementation/integration checks and subsequent complete review remain required; newer-runtime renderer acceptance is still an upstream dependency. The user also confirmed Phase 7 deadline extension from the original start while active, capped by the parent. Its plan records shortening/removal too under complete replacement, expiry checks, preparation-timer cleanup and entry-time child snapshots. No Phase 7 policy question from this review remains open; the Cascada async-context dependency and implementation remain deferred.

Documentation verification: whitespace checks passed; all 400 local links across the six affected documents resolve, and code fences are balanced. The current plan/README/instructions contain no stale pending editable-field decision. No production code changed and no runtime or full compiler suite was needed for this documentation update.

## Fourth review (2026-10-27)

The new Claude review correctly identifies consequences of combining a broad editable request with complete replacement. The supplied approval probe was rerun against the installed SDK, then extended across generation/streaming and native ToolLoopAgent. These are native behavior and design findings: the final Casai LLMAgent hook is not implemented, so this does not demonstrate a vulnerability in an implemented Phase 3 factory.

| Finding | Disposition |
| :--- | :--- |
| Minimal hook return drops approval signing and policy | Confirmed. The user selected protection for both toolApproval and experimental_toolApprovalSecret. Resolve config/run settings first and install them outside hook replacement. Dynamic approval uses the native policy callback. Preserve native approval/history limitations; add no new approval engine. |
| Telemetry may disappear with a minimal return | Confirmed, with a further consequence: omission can activate globally registered integrations after dropping an explicit opt-out, and reset recording flags. The user selected protection of the whole telemetry setting, preserving config/run replacement and native behavior when absent. |
| SDK/UI call settings cannot replace the configured hook | Real divergence from ToolLoopAgent, already covered by the agreed uniform final-hook precedence. Keep one rule across entry paths; document and test that explicit SDK/UI timeout, transform and sandbox remain editable. A caller signal stays independent; callers needing different policy supply a differently configured agent. No new SDK hook parameter or entry-specific override order. |
| request.tools binding stage unspecified | Clarify selected authored entries from invocation-resolved config, before automatic dispatch binding. Preserve explicitly bound descriptors and their mismatch guard; never unwrap them. Changed context can bind an unbound tool afresh while pre-hook helpers keep their original binding. |
| Whole-timeout replacement and explicit undefined | Document both. A step-only timeout object removes a previous total; README2 demonstrates retaining numeric/object totals. Omission and undefined in a complete hook return do not restore earlier editable settings, unlike initial config/run resolution. |
| Retry/finality uses effective hook settings | Retain existing finality ownership and add explicit hook-added/removed retry cases. streamRetries: 0 can enable callback-requested retry; an omitted setting disables that path. The shared result adapter must see the final request. |
| Native UI tool-name inference | Add it to the bounded source fixture and final factory/declaration acceptance cases; known names stay exact and unknown names reject. |

Protecting the signing key from editable request replacement is not config redaction. The agreed full second argument still contains configured secrets; do not claim hook logging is universally safe. The approval protections prevent accidental omission by trusted author code, not arbitrary behavior of that code or missing service authorization. Similarly, telemetry tests establish native integration selection and flag transport, not that every third-party integration honors recording flags.

### Native and typing evidence

The supplied core probe reproduced zero executions with the retained signing key and one mock execution after its omission. The extended ignored fixture at node_modules/.cache/casai/phase3-fourth-review/native.mjs passed 16 approval cases: two modes, core/class entry, forged-history signing kept/dropped, and fresh-call policy kept/dropped. Kept signatures reject forged history; kept policy produces approval requests rather than executing fresh calls. One native streaming class case logs its expected signature error through the SDK default handler. Four telemetry controls passed: explicit disable versus global fallback, and local integration/recordInputs:false versus omitted settings returning to global integration/default flags. No provider or external service calls were made.

The companion contract.ts extends the previous distributive-method/contextual-hook fixture with exact InferAgentUIMessage tool names, unknown-name rejection and a typed SDK Agent/UI consumer. TS7 strict checks passed sequentially with exactOptionalPropertyTypes false/true in 646/571 ms, about 84 MB compiler memory each. Available memory was about 524 MiB before the bounded checks. This is not final generic-factory inference, emitted-declaration or production integration evidence.

The plan, README2, agent instructions and deadline notes now reflect the decisions; acceptance cases cover minimal returns as well as spread, protected approval/telemetry, final retry settings, request tool identity, SDK/UI precedence and whole-timeout replacement. Documentation verification passed: whitespace, all 401 local links across the six affected documents, balanced fences and syntax of both standalone README2 hook examples. No production code changed. Phase 3 remains ready to begin, with its implementation/integration and complete-review gates intact.

## Remaining gates

Optional native-method options is confirmed, including explicit undefined when omission is valid. The broader editable request field set and fourth-review approval/telemetry protections are confirmed. No unresolved Phase 3 API choice blocks implementation. The agreed hook arguments, unified context, request-local history policy, context admission and public/private boundaries remain in force. Final factory/runtime/declaration/editor and consumer integration remain required; this focused design review does not establish a completed implementation or a clean whole-phase review.
