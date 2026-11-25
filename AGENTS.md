# Agent Notes

## Documentation and plans

Keep repository-wide working rules in this file. Put feature decisions and acceptance criteria in the owning plan. Record reproductions, test results and outstanding release gates in the implementation or review record. When a review changes the contract, update the plan and the affected user documentation.

Use the [roadmap](docs/plan.md) to find the plan for a component. Browser audio preparation and input composition share a source-ownership contract. Read [6C](docs/streaming-modifiers-plan.md#deliverable-c-browser-audio-preparation) and [6D](docs/streaming-modifiers-plan.md#deliverable-d-input-composition) together when changing that boundary. The [Phase 6 implementation record](docs/phase6-implementation.md) tracks recording evidence and release gates. The [audio worker measurements](docs/audio-processing-benchmark.md) document scheduling and memory budgets.

Keep the [README](README.md) a short introduction. Put per-form API signatures and examples in the [component matrix](docs/matrix/README.md) and cross-component workflows in the [user guide](docs/matrix/documentation.md). Mark planned forms where readers encounter them and remove the notice after acceptance. Distinguish syntax checks for planned examples from execution against the current source. Follow the [matrix maintenance instructions](docs/matrix/MAINTENANCE.md).

## Architectural First Principles

**Efficient verification:** follow the [check workflow](tests/README.md#where-the-time-goes). Use affected tests and `lint:files` while editing; run the full relevant gates on the settled candidate and repeat only those invalidated by later changes. Keep memory-heavy compiler/lint/matrix jobs sequential. `npm run lint` may reuse only a successful whole-check content fingerprint, including linked Cascada and installed dependency code; `lint:full` forces a fresh run. Do not substitute ordinary dependency-unaware ESLint caching or lower assertions, file coverage or thresholds. Keep matrix compiler state outside regenerated examples and avoid rewriting unchanged generated inputs.

Components serve both a concise common interface and direct composition from Cascada Script. Keep them stateless: a call may return state or a native session handle for later calls, but the reusable component/config stores no current invocation, job or session. Remain UI-library agnostic; preserve applicable native SDK compatibility and use small optional UI adapters only when they reduce total complexity. Cascada supports browsers; missing upstream package details are to be fixed in Cascada, not replaced with a Casai runtime.

Use these principles when designing, implementing, or reviewing Casai. Derive requirements from the README and specs, but challenge their assumptions when a simpler, more coherent design serves the same purpose.

Before fixing a contract mismatch, first assess whether the contract itself is right. Correct the contract when the existing behavior is simpler and better justified; discuss unresolved design choices with the user.

For implementation reviews, follow [the review process](docs/review-process.md). Inventory the public surface, trace downstream consumers, compare native behavior, and test interactions and meaningful mutations. Close the review after a subsequent complete pass finds no important unresolved issue. For audio changes, check the bytes or samples the provider receives. Keep recorder regressions and revisit the format when a user or editor recording fails, a relevant dependency changes, or discarded audio can reach a provider.

Do not add defensive complexity for intentionally invalid, malicious, or very unlikely developer code. Handle such cases when the correction is easy and keeps the code simple, or when an end user/model can exploit the boundary. Distinguish developer-supplied configuration from untrusted agent arguments and compare inherited SDK behavior before proposing a workaround. Keep inexpensive, tested behavior when ordinary calls already need the same code. Before removing shared handling, verify that the ordinary public call still succeeds with the input a caller would normally pass.

- **Compose workflows and delegate execution.** Casai should make workflows easier to compose while leaving model execution to the AI SDK and language execution to Cascada. For every component and phase, follow the owning runtime's native protocol and reuse its supported handling; keep Casai a small wrapper. An addition or intentional departure needs a clear use case and a net benefit in functionality, composition or a concise, coherent API, assessed against its implementation, typing, testing and maintenance costs. The native API need not lack the capability: a convenience such as LLMAgent `resume()` is justified when it removes meaningful application boilerplate while reusing native history and execution. Every additional processing or handling step applied to SDK inputs/results needs that justification; do not add parallel execution, validation, stream-failure or completion machinery merely for uniformity.
- **Inspect native implementations before designing integrations.** Before implementing SDK-facing behavior, inspect the installed `ToolLoopAgent`, SDK `Agent`/tool types, and the core functions they delegate to. Follow approval/history, schema, execution-options, and streaming behavior into the owning modules; read associated tests when available and compare with focused native probes. Reuse native contracts and implement only concrete gaps. Apply this to existing code as it changes, including the [SDK ownership and Phase 2 handoff](docs/plan.md#sdk-ownership-and-phase-2-handoff), rather than reserving it for new factories. Tool-compatible Template/Script components need no fabricated SDK Agent results. See the [native SDK reference](docs/plan.md#native-sdk-reference).
- **Make consistency semantic.** Prefer predictable input, execution, and error rules and reusable machinery. Components need not have identical overloads or result envelopes when their native capabilities differ.
- **Keep shorthand calls primary and usable.** Reserve positional slots for the common inputs to each family. Put longer option lists in configuration or `.run()`. Omit a slot when the next argument identifies its role unambiguously and all required values are resolved. Use a placeholder or named input for same-type collisions. Never infer a role from application field names or string contents. Require fixed settings in the finished component, including inherited values. Reusable Config fragments may remain incomplete. See the [required-configuration rule](docs/plan.md#ordinary-calls-and-required-configuration), [component shorthand inventory](docs/plan.md#phase-5-specialized-ai-components) and [audio shorthand](docs/streaming-modifiers-plan.md#audio-shorthand).
- **Select modes with factory and Config modifiers.** A Casai component cannot combine `.asStream` and `.asTool`, including through inheritance. Script and Function tools can still collect schema-declared streams, and third-party tools follow the SDK's rules. See the [modifier contract](docs/streaming-modifiers-plan.md#modifier-only-selection).
- **Separate configuration from invocation state.** Configuration settings must not be mutated after creation; this is an authoring contract, not a freeze/proxy policy. Components may deliberately mutate authorized state held in context objects or closures, though purity is preferred. Sequence effectful Cascada calls with `!`; hosts coordinate shared state across independent runs. Context snapshots retain their selected top-level bindings, so replacing dependencies/defaults requires a new component or binding for consistent behavior. Isolate each invocation's settings, cancellation, and lifecycle. Result views and adapters must reuse one execution rather than rerunning work.
- **Resolve inputs before schema processing.** Reusable configuration/context may be incomplete, and inputs such as `prompt` may come from the final call. Preserve established merge/override laws and require what remains missing through call types. Separate private configured dependencies from schema-declared application defaults; merge those defaults with direct/model arguments before parsing once. Execute with the parsed application values plus the selected private/trusted bindings. Every schema boundary uses its parsed value, including outputs and stream elements. Call/configuration/producer types describe schema input; implementation/consumer types describe output. Preserve precise raw types where original schemas remain available; explicit native SDK tools retain limitations from erased input types, including output-inferred trusted-context settings. Add no machinery to recover that erased information.
- **Keep calls stateless and shared data intact.** Casai's own merging, preparation, and execution must not mutate shared context, nested application data, configuration, or shared schema defaults. Keep execution state invocation-local. Rely on verified native parser copying, not a generic copy planner. Custom validators/refinements/preprocessors/transforms/default/catch factories MUST be pure: leave received/shared data unchanged and perform no external effects; structured transforms return new objects/arrays and copy each nested path they change. Preserve native SDK/Zod parsing behavior, including `.readonly()` freezing borrowed values or shared defaults and the installed Zod 4 behavior on invalid input. These behaviors also occur in native `ToolLoopAgent` and are accepted limitations; add no Casai schema rejection, copying, or freeze-prevention machinery to compensate. Document shared-reference behavior and recommend fresh structured defaults where needed. Cascada's `!` sequences intentional effects on its selected paths, including mutation of authorized application state; it does not synchronize independent runs or make schema callbacks effectful.
- **Represent provenance structurally.** Keep data, executable source, trusted context, and execution controls distinguishable through validation and execution. Do not infer trust from user-controlled markers or intent from ambiguous argument combinations.
- **Promise only what streaming can guarantee.** Promise final application output incrementally only when its finality and stable-prefix semantics are established; keep partial output and execution events explicit. Do not imply whole-result validity before completion. Make consumption, ownership, and cleanup responsibilities explicit.
- **Require abstractions and conveniences to reduce total complexity.** Prefer small, explicit pipelines and successful existing patterns. Question special cases, implicit modes, duplicated paths, and inferred guarantees; evaluate their implementation, typing, testing, and maintenance costs together.

## Continuation Implementation

Follow the [current continuation guide](docs/matrix/documentation.md#guide-tool-approvals-and-continuation); [the plan](docs/plan.md#phase-4-tool-continuations) owns status and deferred scope. Keep `resume()` on the shared invocation path, reusing context preparation, hooks, tool binding and SDK dispatch while skipping source preparation. Consume approval selectors synchronously and remove continuation controls before settings merging/debug logging. Share only selection and copy-on-append between resume and the denial helper; local denial-result construction belongs to the helper, including results for recorded local denials that lack them (matching native UI message conversion), while resume leaves synthesis to the SDK. Add no whole-history preflight, provider-specific repair or nested-tool completion gate to ordinary continuation. Use the existing settings/context types with the small explicit resume signature; do not restore the generic-prefix abstraction that weakened component-union checking. Historical review decisions do not override the current guide.

## Merge and Type-Safety Changes

Proceed with straightforward validation fixes. Bring changes to merge order, accepted inputs or type inference to the user when there is a meaningful tradeoff. Give a caller example for each option.

- Resolve declared public defaults in the order of explicit arguments, incoming tool context, then configured context. Parse the effective application input once and keep trusted bindings separate. Protect actual private bindings, including own properties set to `undefined`, and supported declared private names. An open ordinary schema may admit unrelated fields. Follow the [schema and context decisions](docs/plan.md#confirmed-schema-and-context-decisions) and the [preparation contract](docs/plan.md#context-sources-and-preparation).
- Casai tools require closed top-level public input names. Reject undeclared raw arguments before parsing and put dynamic dictionaries inside declared fields. Keep native third-party tools on their SDK contract. Use a bound descriptor for incoming public defaults. Casai owners bind per invocation, and the captured context stays fixed for the binding's lifetime. `toolContextSchema` validates incoming SDK tool context. Execution metadata in `context._toolOptions` comes from the invocation. See the [tool and binding rules](docs/plan.md#remaining-phase-2-decisions).
- Check complete union-valued arguments on each component. A component constructed from a union of source modes must accept calls valid in every possible mode. A caller may need to narrow a union of different components. Keep configuration fragments owner-neutral, preserve schema-driven callback inference and check inherited callbacks on the finished component. Pair runtime and type cases, including source consumers, emitted declarations and both optional-property modes. Follow the [schema and public signature checks](docs/plan.md#schema-capability-and-public-signature-gate).
- Use the supported Zod 4 Classic/Mini, SDK and Standard Schema boundaries. Use declared input metadata for public defaults and tool projection. Never run application callbacks to discover what an incomplete fragment accepts. Preserve the SDK's native validation at its own boundaries. The [input and schema contract](docs/plan.md#context-sources-and-preparation) covers union projection and immutable tool binding.

For LLMAgent changes, trace ordinary calls, native Agent methods and tool execution separately. Hooks use the invocation's prepared context. History and native result views share one execution. Tool projection checks completion before returning native parsed output. Use the [hook contract](docs/plan.md#application-context-and-hooks-phase-3) and [output contract](docs/plan.md#final-application-output).

## Cancellation Scope

Cancellation belongs to an invocation. Reject `abortSignal` in reusable configuration. Forward the caller or SDK tool signal through the prepared execution path and to injected tools, and check it before SDK dispatch. Preserve the effective hook-selected `timeout` at the native boundary. Rendering and arbitrary application code cooperate with cancellation. Follow the [cancellation and deadline contract](docs/abort.md) for current behavior and planned support for inherited deadlines.

## Cascada References

Cascada runtime and packaging fixes belong upstream. Obtain the user's approval before editing the separate Cascada repository.

Use the installed `cascada-engine` docs:

- Prefer `node_modules/cascada-engine/dist/docs/cascada-agent.md` when present; it is the AI agent-friendly compressed script/template reference and saves tokens.
- If the compressed document is missing, or if syntax or semantics are unclear or contradictory, check the source docs: `node_modules/cascada-engine/dist/docs/script.md` and `node_modules/cascada-engine/dist/docs/template.md`.

## Tests

Do not run the whole suite by default. LLM-backed tests cost time and money.

Run one file with:

```bash
npm run test:file -- tests/Script.test.ts
```

`npm run test:file` uses the `casai-source` export condition and runs tests against `src`. Its `tsx/esm` loader keeps execution and c8 source maps consistent; mixing CommonJS and ESM transforms produces misleading coverage.

Mocha strips types, so the `@ts-expect-error` type tests are checked only by the compiler, in `test:types`.

- `npm test` and `npm run test:local` run the mock-only runtime suite, without compilation or paid calls. Add new mock-only files to `.mocharc.json`, the shared selection for these commands and plain Mocha. `npm run test:watch` watches that same suite.
- `npm run test:live` explicitly opts into the provider-backed files and may make paid calls. Those files mix provider checks with local assertions; move new local-contract coverage to mock-only files instead of requiring a provider. Use scripted SDK mocks (or fake provider fetch responses) for request, tool, stream and error contracts; reserve live tests for actual provider behavior.
- `npm run test:native` exercises audio preparation with the optional LGPL `node-av` installation. The [test guide](tests/README.md) lists prerequisites and separately invoked release checks.
- `npm run test:coverage` runs that mock suite with c8 and writes source-mapped text, JSON, and HTML reports to `coverage/`. It checks runtime-source coverage and the shared augmentation core separately; declaration-only types use `test:types`.
- TypeScript 7.0.2 is the minimum supported compiler. `npm run test:types` checks source consumers with TS7, builds, then checks `dist` consumers and both optional-property modes. Editor checks use the TS7 language server. Keep TS6 only as a development dependency for tools such as ESLint that require its JavaScript compiler API; it is not a compatibility target.
- `npm run check` runs `test:checks`, `test:types`, `test:matrix`, `lint` and `test:coverage`: the standard offline gate. Native, package and mutation suites remain separate checks for their affected contracts.

Budget checks before starting them. Use focused runtime/type/lint checks while iterating and the complete gate at integration milestones; do not repeat editor and mutation matrices after unrelated edits. `test:types` combines source and API assertions, builds, checks runtime-test consumers, then exact-optional API consumers: four passes. No-emit profiles have distinct incremental caches under `node_modules/.cache/casai`; the optional `typecheck:safety:src` is for focused work and is not duplicated in the full gate. The build cache lives in `dist/.tsbuildinfo`, so deleting `dist` also clears it. Use `npm run build -- --force` if individual generated files were removed or edited. For a cold comparison, append `-- --incremental false` to a typecheck script. Keep all compiler options, lint rules and source/declaration coverage intact. See [test commands and performance](tests/README.md).

Run compiler-heavy checks sequentially, inspect available memory before starting, and use a time budget for exploratory profiling. Capture wall time and compiler diagnostics rather than treating quiet output as a hang. Poll the command's completion status, not only its log. Do not start the full gate just to estimate its duration, or kill unrelated browser/editor processes to make room. Type-aware ESLint uses TS6 and can be memory-heavy; do not enable its per-file cache without accounting for changes to imported types.

Add `-- --grep "pattern"` after the filename for a single test or group.

`.mocharc.json` lists the mock-only suite, so plain `npx mocha tests/File.test.ts` adds that file to the default suite and is not a true single-file run. Use `test:file` for a selected file.

Configured application values and schema defaults can satisfy requirements on direct and SDK-tool paths, including empty arguments. Parse final merged application input once, keep private/trusted bindings separate, and use returned values everywhere. Test raw/parsed types, missing fields after configuration, public overrides and private collision/forwarding cases on every path, open/stripping/strict inputs, and unrelated inherited bindings, advertised SDK requirements, and absence of private sentinels from history/UI/next requests. Verify Zod 4 Classic/Mini ordinary copying with frozen and unfrozen fixtures. Characterize shared nested defaults, fresh/shared default/catch factories, `.readonly()` wrapper ordering, and freezing on invalid input against native SDK behavior; do not turn inherited behavior into a Casai rejection or copying requirement. Recheck version-specific probes on dependency upgrades. Native output/stream and application-context boundaries also use parsed values, lazily for stream elements.

## Environment

Tests load `dotenv/config`. Put local keys in project-root `.env`:

```env
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

Test model/provider defaults are in `tests/common.ts`.

## Current Script Notes

Prefer direct script return values. Use `data` or `text` channels only when the test needs ordered concurrent collection or streamed text assembly.

Prefer regular `var` values whenever they are sufficient; do not introduce channels for ordinary structured data.

For root array data channels, initialize before pushing:

```cascada
data out
out = []
out.push(value)
return out.snapshot()
```

## Provider Quirks

Use `...temperatureConfig` from `tests/common.ts` in LLM test configs; do not pass `temperature` directly.

For exact-output tests on small models, use simple marker strings unless punctuation is the behavior being tested.

Avoid near-famous numeric decoys, Use famous numbers in exact known answers for cited output, but not when this allows guessing a test-derived answer.

Anthropic may reject some JSON-schema keywords before generation. For validation-failure tests, prefer local Zod validation such as `.refine(...)` instead of provider-level numeric bounds.

Exact-output LLM assertions need strict prompts such as `Output exactly ... and nothing else`.

## API Imports

With current ESM packages, type-only exports must use `import type`, for example `ToolExecutionOptions`, `ModelMessage`, `StreamTextResult`, `LoaderInterface`, and `ILoaderAny`.
