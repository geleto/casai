# Phase 3 design review follow-up

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
