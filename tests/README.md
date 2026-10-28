# Test commands and performance

| Command | Purpose | Paid model calls |
| --- | --- | --- |
| `npm test` / `npm run test:local` | Mock-only runtime suite against source | No |
| `npm run test:file -- tests/LLMCalls.unit.test.ts` | One selected file; append `--grep "pattern"` to narrow it | Depends on the selected file |
| `npm run test:watch` | Watch the mock-only suite | No |
| `npm run test:types` | Source, build, emitted-consumer and exact-optional checks | No |
| `npm run build` | Incremental package build; reuse unchanged output | No |
| `npm run test:coverage` | Mock-only runtime coverage and thresholds | No |
| `npm run check` | All type profiles, type-aware lint and mock coverage | No |
| `npm run test:live` | Explicit provider-backed integration tests against source | Yes |
| `npm run test:package` | Clean tarball consumer using published dependencies | No |
| `npm run test:package -- --engine C:\Projects\cascada` | Clean consumer using both local package candidates; engine must already be built (a `.tgz` path also works) | No |

`npm test` is the quick runtime loop; it does not check TypeScript assertions. Run the relevant compiler profile for type changes and `check` at integration milestones. `test:live` requires provider credentials in `.env`. The shared mock-only selection lives in `.mocharc.json`, so plain `npx mocha` is also offline by default. Use `test:file` to avoid adding the default suite when selecting one file.

The current mock suite covers LLM requests, tools, approvals, history, streaming and errors using SDK mock models and fake provider fetch responses. These contracts do not need a real model. Live tests check actual provider/model behavior. Do not replace them with a generic mock that simply returns each assertion's expected answer; use explicit scripted responses and assert the outgoing requests in mock contract tests.

The paired package check packs the existing engine build without running its scripts, installs both tarballs outside the workspace, and checks declarations, imports and execution without links. It does not publish or change versions. Passing with a development engine candidate does not establish compatibility with the currently published engine or replace checking the final coordinated release candidates and dependency minimum.

## Where the time goes

The preceding runs recorded 21–55 seconds for mock coverage (1,424 tests in the final run). The reported 18-minute full check was dominated by compilation and lint, not model latency. The old type gate started five compiler processes. Type-aware ESLint uses the TS6 compiler API in another process; a previous full lint attempt reached about 6 GB before it was stopped under system memory pressure. These are historical observations, not a fresh timing of the changed commands. All lint rules and file coverage remain enabled.

`test:types` first extracts all 64 current TypeScript examples directly from README2 into `.cache/readme2`. The source and emitted-consumer profiles compile these files, including exact optional properties; examples make no model calls. Every TypeScript fence must have a checking marker or an explicit future-phase skip (currently 17). Setup supplies application dependencies and wraps property fragments in concrete components; the example code stays verbatim. Run `node tests/fixtures/readme2-examples.cjs` to refresh them before an individual typecheck.

`test:types` uses four compiler passes:

1. `typecheck:src`: implementation, runtime-test types and compile-only API assertions in one source program (`tsconfig.source.json`). The exact-optional-only fixture belongs to the last pass.
2. `build`: NodeNext compilation and emission of JavaScript and declarations.
3. `typecheck`: runtime-test consumers using emitted public declarations (`tsconfig.consumers.json`). Source files are no longer added as roots. Tests of internal functions still import the internal source they need; they are not excluded or redirected to different implementations.
4. `typecheck:exact`: compile-only consumers of emitted declarations with exact optional properties enabled.

Each no-emit profile uses its own TypeScript incremental cache in `node_modules/.cache/casai`. Source/declaration resolution and optional-property modes must not share a cache file. `typecheck:safety:src` remains an optional focused API check, outside the full gate because its assertions are already in the combined source pass. TypeScript tracks changed inputs and dependencies; caching does not remove assertions or compiler options. Cold checks and broad public-type edits can still be expensive.

The incremental build stores its cache in `dist/.tsbuildinfo`, excluded from the npm package. Deleting `dist` (including `npm run clean`) clears the cache and makes the next build regenerate output. Native incremental builds do not reliably notice individually removed or edited output files: use `npm run build -- --force` to regenerate all output in that case. The source runtime loop needs no build; declaration checks require an up-to-date build, which `test:types` ensures. ESLint cannot reuse the TS7 build's type information and still checks the original source.

Initial workflow verification on 2026-10-23: the new default passed all 1,424 mock tests in **16.2 seconds including startup**. All 43 runtime test files are accounted for: 35 mock-only and eight opt-in provider-backed files, without overlap. A small public consumer against built declarations took 0.57 seconds cold and 0.17 seconds warm; an imported-type change correctly produced a compiler error. The same consumer against source exceeded a 20-second exploratory budget and was stopped. This identifies implementation-checking overhead but does not locate a specific expensive type or establish whole-project cache savings.

Consolidation verification later that day preserved the exact union of the old source projects' files (115 roots) and every former runtime-test consumer root (48 roots). The source check found one stale positive assertion for a root-record tool input; it now asserts rejection and retains a valid nested-record neighbor. No production API or implementation changed. The corrected source check, build, consumer check and exact-optional check all pass. The actual **`npm run test:types` command passed in 4.43 seconds with warm caches**, including npm startup. Individual unchanged compiler processes took 0.24s (source), 0.05s (build), 0.38s (consumers) and 0.18s (exact-optional).

Cold work remains expensive: the initial source investigation took 149s and reported 39 million type instantiations and approximately 4.7 GB of compiler memory; the initial build passed in 90.8s and consumer checking passed in 163s. A 90s consumer probe was stopped before that successful attempt. The initial exact-optional check produced its diagnostics at about 174s but reached the 180s process budget; successful cached reruns and the final command establish its pass. These timings are not a fresh full `check` benchmark or proof of a cold-build speedup.

Native build probes verified cache invalidation for changed-source type errors, regeneration after removing the output directory with its cache, and forced regeneration of a missing individual output file. `npm pack --dry-run --ignore-scripts` confirmed that no build cache enters the package. The integration test switched to the public import helper passes all 33 runtime cases. Both changed TypeScript test files pass ESLint with all configured rules enabled (116s), confirming that typed lint remains costly. Full coverage and whole-repository lint were not rerun for this tooling change; lint rules and file selection are unchanged.

Before running an expensive check:

1. Inspect previous timing/diagnostic logs, the changed surface and available memory. Start with a focused file or consumer; give exploratory compiler work a short time budget.
2. Run memory-heavy checks sequentially. Avoid overlapping type checks, typed lint and editor/mutation matrices, especially with browsers/editors consuming most RAM.
3. For a necessary compiler measurement, append `-- --extendedDiagnostics` to the relevant typecheck script. Compare cold and warm runs of the same profile; append `--incremental false` for a cold check. Record wall time separately from compiler check time.
4. Run the full gate once on the settled candidate when warranted. Repeat affected checks after fixes; do not restart every unrelated gate. Poll process completion rather than waiting for log output.

Do not turn off type assertions, lower coverage thresholds or enable dependency-unaware typed-lint caching to obtain a faster green result. If cold compilation remains too costly after memory pressure is relieved, profile the real full consumer program before changing generic types. The small type-instantiation budget fixture does not measure full-project cost.

`node tests/fixtures/phase2-factory-cost.cjs` checks every factory family plus `Function.asTool`, separately from the legacy aggregate/registry budgets. LLMAgent workloads cover default/explicit output, streaming, hooks and native Agent methods; matching native ToolLoopAgent workloads provide a comparison. An optional regular-expression argument selects factories. Each workload compiles 0, 12 and 24 independent configurations; callable components also receive one ordinary invocation. It reports import-only instantiations, `(12 - 0) / 12` per component, `(24 - 12) / 12` additional-component cost, compiler check time, memory and wall time. Both incremental measures and import totals have independent ceilings, so a cheaper import graph cannot hide more expensive components. The runner is included in `test:phase2-production`; compiler processes are sequential and each has a 60-second budget.

These are bounded source workloads, not runtime call costs or a whole-application timing benchmark. LLMAgent retains the former Text/Object workload ceilings; no existing ceiling was relaxed during migration. See the [implementation review](../docs/phase3-review.md#implementation-review-2026-10-27) for measurements and the separate budgets for new hook/native-method workloads. Rebaseline only with an explicit before/after comparison of both import and component costs on the same compiler and workload.

`LLMAgent.unit.test.ts` covers the new hook, Agent/UI, approval and telemetry boundaries. `ModifierInheritance.unit.test.ts` checks supported modifiers across all component families. The four provider-backed LLMAgent files end in `.live.test.ts` and remain opt-in. The package consumer also checks LLMAgent inheritance, native Agent typing and streaming output from a tarball, and rejects stale retired factory files. Clean `dist` after deleting source modules: incremental emission does not remove their old generated files.
