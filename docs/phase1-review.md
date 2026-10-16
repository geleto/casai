# Phase 1 review evidence

This audit covers the current implementation and its consumers, not implementation of later phases. The initial third full pass found no further important issues; later external reviews exposed the provider-connection and HTTP-adapter cases recorded below.

## Scope

| Surface | Evidence and inspection |
| --- | --- |
| Eight exported factory families and aliases | `src/index.ts`, `src/factories/factories.ts`, factory implementations, `public-contracts.ts`, `ComponentContracts.unit.test.ts` |
| Four LLM factories, seven prompt modifiers, ordinary calls and `.run()` | `llm-component.ts`, `prompt-renderers.ts`, `LLMSurface.unit.test.ts`, `LLMCalls.unit.test.ts`, `Regressions.unit.test.ts` |
| Configuration, inheritance, callbacks, tool maps, and schemas | `config-utils.ts`, `validate.ts`, `src/types`, `ConfigMerge.test.ts`, `ConfigValidation.test.ts`, consumer type fixtures |
| Final values, native result members, history, ownership, failure, retries, and transforms | `augment-result.ts`, `ResultAugmentation.unit.test.ts`, `LLMSurface.unit.test.ts`, result type fixtures |
| SDK tool adaptation, cancellation, approvals, and downstream model output | `renderer-tool.ts`, generator adapters, `FunctionTool.test.ts`, `ToolContext.test.ts`, augmentation and tool consumer fixtures |
| Template, Script, Function, loaded resources, and result consumers | Their factory/engine implementations, loader processing, `Engines.unit.test.ts`, `Workflow.unit.test.ts`, augmentation integration tests, loader/regression tests |
| Native limitations and later requirements | Current README, `README2.md`, `plan.md`, `abort.md`, native SDK characterization tests |

The surface matrix exercises 448 combinations of LLM factory/modifier, standalone/inherited configuration, call/run entry, configured static messages, and dynamic history. It checks native request order, parsed output, result timing, callback payloads, response fields, and dynamic history. The context-only function call form explicitly rejects positional history; its `.run()` history path is exercised separately. Another matrix combines automatic/callback retries, three transform choices, and successful/error endings against both native SDK and Casai execution.

## Pass 1: Independent input and status dimensions

The earlier cases mutated history arrays but did not mutate the invocation settings object during asynchronous validation. They also used inferred conditional unions, which can expose different keys from explicitly declared unions, and assumed native overall and final-step finish reasons agreed.

- **Fixed:** rendered `.run()` reread `configArg.prompt` after awaiting validation. Changing the caller's settings changed the executed prompt. The override is now captured before awaiting; twenty factory/modifier cases cover this.
- **Fixed:** a stream transform could mark the overall finish reason `error` while the step still reported `stop`, allowing successful `value` completion. One completion check now reads both native status sources. Twelve cases vary the changed status, explicit/default output, and native/value consumption order.
- **Accepted developer typing limitation:** explicitly declared configuration unions can hide branch-only forbidden keys from validators, including `.run()` output replacement or new tool names. Native `ToolLoopAgent` also accepts extra settings through structural types and spreads them into its execution settings. The user confirmed that deliberately invalid or niche developer cases do not justify extra machinery unless the fix stays simple or protects an end-user boundary. Broad union-validation changes are therefore omitted; existing ordinary type checks and runtime merging remain unchanged. This does not grant model arguments access to component configuration.

The next pass added literal SDK paths and native callback call semantics to the ownership audit rather than checking only result contents.

## Pass 2: Native boundaries and borrowed inputs

- **Fixed:** literal SDK conversation arrays were snapshotted for history but borrowed by execution. Mutating them after entry changed sent messages without changing history. SDK wrappers now snapshot their request envelope and message-array containers together, preserving caller objects and shared message contents.
- **Fixed:** streaming result delivery reread the original request's output setting. Replacing it after dispatch changed `value` delivery although the SDK still used the original parser. Result views now use the captured settings for that execution.
- **Fixed:** `onChunk` was invoked as a method of the request, giving it a receiver that native SDK callbacks do not have. Original callbacks are captured from the settings snapshot and invoked as functions. Canonical and deprecated callback names are characterized against native execution.

These tests failed before their fixes. Follow-up passes must recheck the complete surface and the meaningful guard mutations, including the two different finish-reason sources, rather than treating the earlier green suite as sufficient.

## Pass 3: Re-inventory, consumers, and exposed boundaries

The previous passes showed that checking result contents misses ownership and native call semantics. This pass therefore re-inventoried the exports and dispatch paths, followed results into tools, Cascada consumers and subsequent requests, and distinguished model-controlled input from deliberately invalid developer configuration. It rechecked the scope table against current source and the runtime and consumer-type fixtures, rather than relying on the new examples alone.

No further important implementation issue was found. Ten additional cases exercise five tool families through generate and stream execution, each with valid and invalid model arguments containing forged `_toolCallOptions`. Native validation prevents invalid execution, the adapters use real execution options, and trusted context remains absent from history and subsequent model requests. This supports retaining the small existing SDK boundary rather than introducing another validator.

Six targeted mutations removed prompt capture, the overall finish check, the step finish check, conversation-array copying, output-setting capture, and native callback invocation respectively. The focused regressions failed in all six cases (20, 4, 4, 4, 1, and 2 failures). Each source file was restored byte-for-byte before normal verification.

The next-review improvement is to retain these independent dimensions: test exact public types separately from dynamic runtime matrices; mutate invocation envelopes as well as their arrays; compare native callback invocation and both status sources; and trace untrusted tool arguments into the next request. Large scenario counts do not replace these boundary checks.

## Follow-up: Provider failures before a stream exists

The earlier fault tests returned a provider stream containing an error. They did not throw from the provider call before it returned a stream, which takes a different SDK completion path. Native `ToolLoopAgent` also replaces that error with a cause-less `NoOutputGeneratedError` on output promises. Casai had already captured the original error for that attempt, but its completion rejection bypassed the finish-reason check.

**Fixed:** when completion rejects with a cause-less `NoOutputGeneratedError`, `value` rethrows the captured attempt error when available. Other error types and errors carrying their own cause are preserved. No failure flag, listener, new error type, or separate completion gate was added. Native SDK fields and history retain their native errors; history error identity can itself depend on native promise access timing.

Fifteen regressions cover native Agent behavior, four output delivery variants with three consumer orders, and native rejections whose type or existing cause must be preserved. The twelve connection cases reproduced the failure before the fix. Mutations removing the fallback, error-type guard, and cause guard were detected (12, 1, and 1 failures). The two earlier alleged gaps were also rerun: removing the tool-caller exclusion failed one existing test, and removing the rendered `.run()` request copy failed four existing tests. Mutated source was restored byte-for-byte.

The review process now requires faults before stream creation, inside streams, and during continuation setup, comparing error identity and causes across modes and consumer orders. The follow-up pass rechecked completion rejection, output parsing, retry isolation, cancellation, history, and tool adaptation, with no further important findings.

Follow-up verification passed: 1,105 mock-only tests; all 237 result-augmentation tests; TS7 and TS6 source checks; lint for the changed source/test files; and `git diff --check HEAD`. A final native Agent fixture check also passed after removing an unsupported callback setting. Existing source/declaration consumer checks from the initial audit remain recorded below; this fix changes no public types.

## Follow-up: Installed provider adapters

The SDK model mocks had synthesized the normalized protocol directly, omitting the provider-adapter boundary. Real installed adapters expose additional behavior: Anthropic maps `pause_turn` to `stop`, OpenAI Chat drops refusal fields, and SDK text can contain commentary and concatenated blocks within the selected model step.

- **Fixed:** a retained raw `pause_turn` now makes `value` unavailable, including after all server-tool results arrived. The pause-specific check preserves native fields and permits explicit continuation using history; it adds no automatic continuation or finish-reason normalization layer.
- **Clarified the contract:** `value` selects the SDK's eligible final model step. Text within that step remains intact, including commentary, OpenAI Responses message phases, and concatenation without separators. Earlier-step text is excluded.
- **Accepted native limitation:** OpenAI Chat's lost refusal can become successful empty `stop` text. Intentional empty output remains valid; structured parsing retains its native failure behavior. No refusal inference or raw-body extraction was added.

Sixteen fake-fetch HTTP/SSE cases now run through the installed Anthropic, OpenAI Chat, and OpenAI Responses adapters in both modes. They cover pending/resolved server-search pauses, continuation with encrypted result content preserved in history and the next request, same-step commentary, refusal versus intentional empty text, structured parsing, and a basic Responses text exchange containing both message phases. This is representative adapter coverage, not exhaustive coverage of those provider APIs.

Removing the raw-pause guard failed four cases; source was restored before normal verification. The two older alleged mutation gaps were already disproved in the preceding follow-up (one and four failures), and those guards remain unchanged. The review process now requires real adapter fixtures in addition to SDK mocks.

Follow-up verification passed: 1,121 mock-only tests; all sixteen provider cases after fixture lint corrections; TS7/TS6 source checks plus focused checks of the final fixture; lint for the changed implementation and new fixture; and `git diff --check HEAD`. The contract review also clarified that the accepted continuation-setup exception concerns already-resolved completion: a cause-less rejection still uses the existing captured-error fallback. Rechecking the shared eligibility paths, native result/history ownership, tool adaptation, and documented output contract found no further important issue in this pass.

## Completion audit

| Implemented requirement | Current evidence |
| --- | --- |
| One execution, genuine SDK results and preserved consumers | Agent/UI fixture, interleaved native/result views, serialization and early-close cases |
| Final parsed output, protocol eligibility and stable streaming | Both-mode eligibility cases, output transforms, overlapping blocks, retry/transform matrix, independent status checks |
| Lazy dynamic history and invocation ownership | Static/history matrix, delayed preparation, literal request mutation, output-setting capture, native response-message behavior |
| All factory and prompt entry paths | 448-combination surface matrix, call/run regressions, loader tests and current factory dispatch inspection |
| Tools, cancellation and private SDK context | Tool adapter/abort cases, forged model arguments, next-request sentinel checks and native timeout characterizations |
| Public inference and ownership of definitions | Result/config/callback types in `src/types`, source and declaration consumer fixtures, optional/union/default output cases |
| Minimal delegation and documented limits | Native Agent comparisons, removed duplicate failure machinery, no new execution scope or schema-copy layer, explicit later-phase boundaries |

## Explicit boundaries

Merge-first application-input parsing, configured tool-default projection, and the corresponding parsed context types belong to Phase 2. Stream collection in Cascada and inherited deadlines remain in their documented later phases. Native schema freezing, eager structured-generation rejection, generation cancellation during a tool, continuation-setup behavior, and custom iterator consumption retain their documented accepted contracts. They are characterized limitations, not silently excluded current bugs.

## Initial audit verification

- `npm run test:local -- --timeout 10000 --reporter dot`: 1,090 passing tests, without paid model calls.
- `npm run test:types`: passed TS7/TS6 source and consumer checks, the build, built-declaration checks, and exact optional property checks.
- Full `eslint src tests`: only three indentation findings in the new tool-boundary fixture. Those were corrected; `npx eslint tests/ResultAugmentation.unit.test.ts` then passed. Other files were unchanged after the full lint run.
- Six meaningful guard-removal mutations were detected, with source restored before verification.
- `git diff --check HEAD`: passed.

All actionable findings are resolved. No user decision remains pending; the accepted native/developer limitations and deferred work above retain their existing scope.

## Final whole-surface pass

The subsequent pass re-read the exported factory and modifier dispatch paths, shared configuration/preparation/validation boundaries, result augmentation, tool adapters, Cascada consumers, loaders, public types, and the current-versus-planned documentation. It found no new actionable Phase 1 defect or simplification that would reduce total complexity while preserving supported behavior. Native limitations and the handoffs to Phases 2, 6, and 7 above remain deliberate boundaries, not new findings.

An additional temporary probe exercised 336 overlapping invocations across 42 factory/modifier/output combinations. Eight calls shared each component, mixing ordinary calls and `.run()`, inherited static messages, distinct contexts and histories, asynchronous preparation, and default or parsed structured output. Text consumers also interleaved native views with final promises, closed early, and reread `value`. All assertions passed: one execution per call, correct values and history, and unchanged configured message arrays. The temporary probe was removed after verification; existing permanent cases retain the individual regression guarantees.

Final verification passed: all 1,121 mock-only tests; the complete `test:types` chain (TS7/TS6 source and consumer checks, build, built declarations, and exact optional properties); full `npm run lint`; and `git diff --check HEAD`. No paid provider calls were made and no production code was changed during this pass. The installed-provider fixtures cover representative Anthropic, OpenAI Chat, and OpenAI Responses exchanges, not every provider feature.

## Follow-up: Sequential loader failure expectation

The user's full suite exposed a stale assertion in the LLM-backed `ObjectGenerator.test.ts`: it expected a sequential loader chain to continue after a thrown error. The installed Cascada engine propagates that error; only a missing source (`null`) advances the chain. This native contract is appropriate and remains unchanged. The earlier review missed this assertion because its runtime checks used the mock-only suite.

The old test was removed and replaced with 24 mock-only cases across all four `.loadsText` factories and ordinary/`.run()` entry paths. They verify successful fallback after `null`, original error identity for synchronous throws and asynchronous rejections, and no fallback or model dispatch after a loader error. The README now states the error behavior explicitly, and the review process requires inspecting local assertions in paid-test files and moving their coverage into the mock suite.

Focused verification passed: 158 regression/loader tests, TS7 and TS6 source checks, lint for both changed test files, and `git diff --check HEAD`. No production code changed and no paid model calls were made.

## Measured coverage and permanent regressions

`npm run test:coverage` now runs the mock-only suite through c8, producing text, JSON and HTML reports under the ignored `coverage/` directory. `npm run check` includes this command. The test runner uses `tsx/esm`: mixing its CommonJS and ESM transforms assigned incompatible generated offsets to the same source path and produced misleading coverage. The ESM-only run preserves the passing tests and consistent source maps.

| Runtime scope | Lines/statements | Branches | Functions |
| --- | --- | --- | --- |
| Shared `augment-result.ts` core | 100% | 98.38% | 100% |
| Shared `llm-component.ts` dispatch | 97.84% | 94.38% | 100% |
| All runtime source in the report | 99.26% | 95.80% | 100% |

All 336 changed source lines represented by the c8 report were exercised. Declaration-only type files are checked by the TS7/TS6 source/declaration consumer fixtures, not runtime coverage. The report includes the executable configuration, merge and schema modules under `src/types`.

The core's remaining two uncovered branches are its fallback for a normalized request with neither prompt nor messages, and its guard for a resolved native result with no completed step. Supported factory calls validate the former before dispatch; the characterized native SDK rejects completion without a step. Neither branch warrants a contrived invalid-call fixture or an ignore comment. Other uncovered lines are existing diagnostics, initialization-error paths, and invalid-state guards; no added mapped runtime line remains uncovered. Gates require 100% lines/statements/functions and at least 98% branches for the core, plus 99% lines/statements, 100% functions and 95% branches overall.

The former temporary concurrency probe is now 42 permanent deterministic cases in `LLMSurface.unit.test.ts`: eight calls must enter the provider before any may finish, then complete in reverse order. They check 336 invocations across all factories/modifiers, default and structured output, inheritance, per-call settings, context/history isolation, early closure, repeated readers and native views. No timer-dependent scheduling is needed.

The local-only audit inspected the four LLM factory test files plus Messages and Tools. Existing mock cases cover configuration, schemas, prompt/message validation, loaders and tool boundaries. New preparation-failure and missing-resource matrices cover synchronous/asynchronous callbacks/loaders, call/run entry and zero model dispatch. The surface matrix now checks component type metadata too. Nine redundant local-only cases were removed from LLM-backed files and replaced by these broader matrices, including the previously skipped child-loader precedence case. A focused ordinary-array early-close case covers the remaining meaningful iterator cleanup branch.

Verification passed: 1,220 mock-only tests and both coverage gates; the complete `test:types` chain (TS7/TS6 source and declaration consumers, build, exact optional checks); and `git diff --check HEAD`. Full lint found one function-type style issue in a new fixture; it was corrected and that file passed focused lint, with all other files unchanged after the full run. A negative threshold check also confirmed that the gate rejects a requested 100% core branch threshold. No production runtime or merge/type-inference implementation changed, and no paid model calls were made.
