# Whole implementation review — 2026-11-05

## Scope and stopping rule

Review the current worktree, including its existing staged changes. Earlier review results are evidence to challenge, not a substitute for inspecting current code. Every production source file, public export, factory/modifier, invocation path, supplementary method and downstream consumer must have an owner. Tests, package/build tooling and documentation examples are reviewed as part of the implementation's acceptance surface. Paid provider tests are inspected but are not run; native mocks and fake transports supply executable comparisons.

Fix supported-case defects with clear solutions. Record contract choices with meaningful tradeoffs for the user's final decision. After integration, perform another complete pass from consumers back to implementation. Stop only when that subsequent pass finds no new substantial problem; distinguish any deferred decision or external release prerequisite from a clean implementation result.

## Strategy

1. Inventory code independently of the test list. Assign every file and enumerate public runtime and type-only surfaces separately. Preserve the starting worktree and record new changes separately.
2. Follow each value across its owners: constructor/inheritance, argument roles, application parsing, trusted bindings, source preparation, native dispatch, result consumption, descriptor/injected use and later continuation. Check ordinary, named, SDK and supplementary entry paths independently.
3. Seek missing dimensions rather than adding more examples of an existing case: conditional presence versus union values, branch pairing, snapshots across asynchronous boundaries, parsed output versus declared metadata, resource ownership and callback timing. Derive small independent oracles from installed SDK/Cascada behavior and the chosen contract.
4. Challenge architecture and contracts before patching. Retain native limitations and explicit authoring obligations. Prefer deleting redundant policy or deriving native types over adding validation/dispatch machinery. Do not promote hypothetical hostile developer configurations into product requirements.
5. Audit the evidence itself. Inspect assertions, negative type controls, mutation targets, package consumers and example extraction. A green suite, compilation failure, process exit or coverage percentage is insufficient without the relevant assertion and completed check.
6. Fix and verify focused findings first. Schedule compiler, editor and lint work sequentially; compare existing budgets without raising limits. Run the full applicable integration gates on the settled candidate.
7. Rotate review direction for the subsequent complete pass. Re-inventory after changes, revisit unchanged consumers and record why each confirmed issue escaped previous coverage. Update the review process with the missing dimension rather than an implementation-specific checklist.

## Coverage ownership

| Area | First-pass owner | Scope |
| --- | --- | --- |
| Configuration, schema, shared execution, rendering, loaders, errors | Runtime reviewer | All `src/config`, `src/renderers`, `schema.ts`, `loaders.ts`, `errors.ts`, and shared invocation/LLM runtime modules |
| Component owners and native operations | Component reviewer | Every `src/factories` file and `runtime/live-input.ts`; native APIs, provider dispatch and supplementary voice methods |
| Public type contracts | Type reviewer | Every `src/types` file; factory consumers, source/emitted declarations, type fixtures and verification runners |
| Streams, approvals, result augmentation, exports, integration/tooling/docs | Lead reviewer | Remaining source files, package/build/test configuration, runtime test inventory, documentation examples and release consumers |

## Findings and evidence

The review continued into 2026-11-06. The user explicitly reaffirmed that the goal remains active and that earlier completed reviews do not satisfy this review's stopping rule. Detailed working coverage notes and probe logs live under `.cache/whole-review`.

| Finding | Consequence and selected correction | Verification status |
| --- | --- | --- |
| Optional registry containers lose absence during type projection/inference | A callback could call a helper that does not exist; optional trusted-context maps could satisfy required bindings. Preserve container presence through shared inference/projection. A missing child map inherits parent entries rather than fabricating undefined replacements. | Source/emitted/exact consumers, four editor profiles, all 16 unchanged cost budgets and all 182 type mutations pass |
| Prepared shorthand only recognizes plain-object context | Valid own fields on class instances work through named calls and native parsing but fail shorthand. Use the existing object-record contract with binary-role exclusions, including context paired with a structured image source. | Focused component/image suites and isolated routing mutations pass |
| Approval settlement outlives a reused call/request definition | A fresh approval in the same turn can be rejected as resolved, or omitted by the denial helper. Reset settlement for a new call definition, remove already-settled old requests, and reset decisions for a new approval definition. | Native generation/streaming controls and 73 focused continuation tests pass; subsequent source review finds no new issue |
| Named renderer calls lose a required source in configuration unions | `.run()` could omit the source when only one Template/Script branch supplied it. Require source availability across every branch, matching shorthand and actual execution. | Focused native/runtime controls and all source/emitted/exact consumer profiles pass |
| Native registry annotations are narrower in Casai than in the SDK | Under exact optional properties, the SDK's `ToolSet` admits variants outside default `Tool`. Reuse native registry element types, preserve their identity through `.tools` and `.run()`, and remove duplicate registry projections. Retain native inference limitations. | Native/Casai controls, peer review, repeated semantic/cost/editor gates and all 182 mutations pass, including four exact-consumer mutations |
| Verification can silently omit its claimed case | A cancellation assertion was guarded by retired `value` presence; current README had nine untracked TypeScript examples; duplicate test labels claimed nonexistent streaming-tool coverage; opt-in files retained obsolete assertions. | Assertions repaired and complete test inventory read; all current README TypeScript fences compile, with extraction failure controls |
| Redundant cancellation checks | Shared coded preparation repeated the synchronous entry check already performed by both callers; LLMAgent repeated its entry check before any await. Remove those duplicates, preserving post-preparation and native dispatch checks. | Focused cancellation suites and the current-source early-LLM mutation pass; mutation targets follow the owning entry boundaries |
| Obsolete development/docs details | `npm start` referenced a missing example; README2 dependency floors, public-default/binding explanation and structured-source prose had drifted. | Removed dead script and corrected prose against manifest, schema and source routing |

## Subsequent pass and integration

The inventory contains 55 production TypeScript files, 119 test/fixture TypeScript files and six verification scripts. Every production file and test fixture has been read by its assigned reviewer. A later exact-consumer comparison exposed the native registry mismatch above after an earlier clean pass. That finding reopened the complete source pass and affected verification. The fresh subsequent pass of all runtime, factory, core and type/signature files is now complete and found no additional substantial issue. Generated JavaScript also matches the complete 55-module source inventory. Final full lint passes after one fixture-only style correction; its corresponding mutation was rechecked successfully. All applicable implementation checks have completed.

The settled mock coverage run passes 1,776 tests, including the renderer-source and concurrent WebRTC-offer regressions: 99.85% lines/statements, 97.95% branches and 100% functions. The dedicated result-augmentation thresholds also pass. All 60 current README TypeScript examples and 95 README2 examples are extracted; three future examples remain explicitly excluded. Extraction counterfactuals reject a missing marker, an unknown fixture and shared-example drift.

The full mutation rerun exposed one additional oracle gap: removing the invocation-settings copy was masked by the ordinary component's later copy. The WebRTC supplementary method reads its original SDP after asynchronous preparation, so the copy is necessary. A concurrent-offer regression now verifies that consumer and catches the mutation. Production behavior remains unchanged. The runner restores each mutation and reports all failures together; unchanged baselines and target inventories remain mandatory.

These issues escaped earlier checks because their dimensions were missing or their oracles were ineffective: whole-map absence was conflated with optional entries, shorthand covered plain objects only, approval reuse was exercised across turns rather than after settlement within one turn, named source omission was not compared across configuration branches, and retired guards/observer error handling hid assertions. The review process now records those dimensions and requires direct counterfactual checks of the evidence.

Type-cost experiments also exposed weak focused probes: restoring registry absence from the full provisional configuration passed simple checks but broke native callback inference in the broader suite. That candidate was rejected. The final implementation captures presence independently, with ordinary optional inference slots intersected with required-property constraints. Schema-backed exact helper results and meaningful negative/definite controls now cover every inference owner. Callback-data projection and empty-parent processing were simplified without changing final configuration validation or raising any budget. After the native registry correction, official marginal costs include Function 4,363 and Config 7,204; all 16 workloads pass.

The final verification run catches all 99 runtime mutations, with an additional current-source early-LLM cancellation mutation after the redundant synchronous check was removed. The 99-case snapshot differs only by retaining that redundant check; the final current-source coverage suite and targeted mutation cover its removal. All 182 type mutations pass, including repaired lifecycle/output oracles whose old distribution mutations had become equivalent after outer checks moved and four native-registry exact-consumer mutations. Type aggregate cost is 539,865 against baseline 425,970; helper-contract cost is 729,869 against 723,780 without the contract. Both existing 2x limits pass. No test coverage or cost threshold was relaxed.

The clean paired-package check passes using the already-built local Cascada candidate. Both packages are packed and installed outside the workspace without links or install scripts; declarations pass with exact optional properties off and on, and runtime/cross-copy integration passes. The fresh install resolves `ai@7.0.163`, `@ai-sdk/provider-utils@5.0.75` and `zod@4.6.7`. The published-only check fails on the older `cascada-engine@0.6.2` loader declarations, before runtime execution. The successful development tarball still reports version 0.6.2; its success does not make the published package compatible.

## Deferred external gates

No new API design decision requires user input. The following existing cross-repository work remains outside this implementation review:

1. Select and publish a compatible Cascada release, then raise Casai's `cascada-engine` minimum and rerun the clean published consumer. The [loader release prerequisite](plan.md#phase-3-follow-up-loader-composition) requires the engine changes beyond published 0.6.2. No version selection or publication was performed here.
2. Complete the previously selected Cascada compiler migration, then verify Casai against it using the [existing handoff requirements](plan.md#phase-2-existing-component-foundations). The separate `C:/Projects/cascada-chain-resolution` kernel already exists. The pending work is integrating it into the compiler and rendering environment in `C:/Projects/cascada`, tracked as Phase 8 in the kernel's `docs/runtime-evolution-plan.md`; current Cascada still uses its own runtime. This is a planned upstream migration, not a missing adapter in the current Casai implementation. Current-runtime tests and the paired package check pass, but do not establish that future cutover.

## Completion

The repeated whole-current-implementation review completed on 2026-11-06. Its stopping rule is satisfied by the fresh complete pass after the last substantial finding, followed by successful implementation verification. Existing staged work was preserved; review corrections remain unstaged. No commits, version changes or publication were performed.

Final gates: `test:types`, full `lint`, mock coverage, all 16 factory-cost workloads, all four editor profiles, all 182 type mutations, the runtime mutation evidence described above and the clean paired-package consumer pass. `git diff --check` passes. Paid provider tests were inspected, with relevant local assertions checked separately, but paid execution was not performed.

The published-only package failure and newer compiler/renderer handoff remain the explicit deferred gates above. Completion of this implementation review does not close either gate or establish release readiness.
