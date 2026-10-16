# Agent Notes

## Architectural First Principles

Use these principles when designing, implementing, or reviewing Casai. Derive requirements from the README and specs, but challenge their assumptions when a simpler, more coherent design serves the same purpose.

Before fixing a contract mismatch, first assess whether the contract itself is right. Correct the contract when the existing behavior is simpler and better justified; discuss unresolved design choices with the user.

For implementation reviews, follow [the review process](docs/review-process.md): inventory the whole public surface, trace downstream consumers, compare native behavior, and test interactions and meaningful mutations. Improve the process after each pass and require a subsequent complete pass without important unresolved findings before declaring the review complete.

Do not add defensive complexity for intentionally invalid, malicious, or very unlikely developer code. Handle such cases when the correction is easy and keeps the code simple, or when an end user/model can exploit the boundary. Distinguish developer-supplied configuration from untrusted agent arguments and compare inherited SDK behavior before proposing a workaround.

- **Compose workflows and delegate execution.** Casai should make workflows easier to compose while leaving model execution to the AI SDK and language execution to Cascada. Reuse their contracts rather than maintaining parallel execution machinery. Every additional processing or handling step applied to SDK results needs a concrete purpose; preserve native behavior and avoid redundant work.
- **Make consistency semantic.** Prefer predictable input, execution, and error rules and reusable machinery. Components need not have identical overloads or result envelopes when their native capabilities differ.
- **Separate configuration from invocation state.** Keep shared component configuration immutable and isolate each invocation's settings, cancellation, and lifecycle. Result views and adapters must reuse one execution rather than rerunning work.
- **Resolve inputs before schema processing.** Reusable configuration/context may be incomplete, and inputs such as `prompt` may come from the final call. Preserve established merge/override laws and require what remains missing through call types. Separate private configured dependencies from schema-declared application defaults; merge those defaults with direct/model arguments before parsing once. Execute with the parsed application values plus the selected private/trusted bindings. Every schema boundary uses its parsed value, including outputs, stream elements, and custom options. Call/configuration/producer types describe schema input; implementation/consumer types describe output.
- **Keep calls stateless and shared data intact.** Casai's own merging, preparation, and execution must not mutate shared context, nested application data, configuration, or shared schema defaults. Keep execution state invocation-local. Rely on verified native parser copying, not a generic copy planner. Custom validators/refinements/preprocessors/transforms/default/catch factories MUST be pure: leave received/shared data unchanged and perform no external effects; structured transforms return new objects/arrays and copy each nested path they change. Preserve native SDK/Zod parsing behavior, including `.readonly()` freezing borrowed values or shared defaults and the installed Zod 4 behavior on invalid input. These behaviors also occur in native `ToolLoopAgent` and are accepted limitations; add no Casai schema rejection, copying, or freeze-prevention machinery to compensate. Document shared-reference behavior and recommend fresh structured defaults where needed. Cascada's `!` sequences external effects, not shared-context mutation.
- **Represent provenance structurally.** Keep data, executable source, trusted context, and execution controls distinguishable through validation and execution. Do not infer trust from user-controlled markers or intent from ambiguous argument combinations.
- **Promise only what streaming can guarantee.** Promise final application output incrementally only when its finality and stable-prefix semantics are established; keep partial output and execution events explicit. Do not imply whole-result validity before completion. Make consumption, ownership, and cleanup responsibilities explicit.
- **Require abstractions and conveniences to reduce total complexity.** Prefer small, explicit pipelines and successful existing patterns. Question special cases, implicit modes, duplicated paths, and inferred guarantees; evaluate their implementation, typing, testing, and maintenance costs together.

## Merge and Type-Safety Changes

Preserve established merging and type-safety behavior. Implementation changes to merging, validation order, or their types require user confirmation with concrete behavior/typing consequences. The [confirmed decisions](docs/plan.md#confirmed-schema-and-context-decisions) authorize merge-first parsing on direct and tool paths, private configured dependency binding with direct application overrides, parsed values at every schema boundary, and removal of the generic copy planner. Phase 2 specifies the SDK tool wrapper/projection needed to honor configured declared defaults without publishing private data. These are targets, not claims about current factories, and do not authorize unrelated merge/inference changes. Schema-declared/defaulted input is public tool input; private dependencies and trusted context must never be returned from the SDK argument validator.

Casai must not trial-parse incomplete fragments or run callbacks to discover schema ownership/defaults. Native SDK/Zod JSON Schema conversion may evaluate pure default factories; preserve that behavior without promising exactly-once callback execution or caching metadata-time defaults into invocation context. SDK history/approval revalidation is a separate boundary from fresh tool argument parsing. Keep transformed public tool arguments distinct from private execution context, and compare multi-turn UI behavior with the native SDK. The documented native SDK limitation for transformed arguments in UI history is accepted; add no Casai workaround or completion gate for it.

The [confirmed delivery typing](docs/plan.md#final-application-output) authorizes a union of possible streaming `value` delivery types when an explicit SDK output type does not distinguish its kind. Preserve precise known/default kinds, inferred completed/element types, and the planned runtime delivery. Add no output wrapper, kind selector, or schema rewrite to recover erased type information. This includes object, array, and custom outputs whose `name` is only typed as `string`; distribute over output unions and do not infer the kind from a native element stream. Native SDK result-property types remain unchanged.

Preserve the [native continuation-setup limitation](docs/plan.md#output-availability-and-failures): the SDK can report a later preparation/provider-call error while resolving earlier completed steps. Casai follows the SDK-reported final step; add no separate failure tracker to compensate. Keep retry error attribution scoped to the model attempt and characterize native exceptions when upgrading the SDK. Preserve the documented native generation cancellation-during-tool limitation too; do not add an abort listener to reinterpret a normally returned SDK result. Native stream completion promises own abort/timeout/thrown-stream errors, with one completion-error check using native overall and final-step finish reasons; SDK stream transforms can change these independently. SDK stream transforms feed both final output and stream views and do not alone require buffering. Keep approval-ID denial handling: streaming provider denials can lack synthetic tool results.

Result history assembles native `responseMessages` when available and preserves their rejection; do not gate history on execution success or `value` eligibility. Treat every literal/prepared prompt string, including empty text, as a user message regardless of history. TextGenerator tools return parsed final `value` and infer its type from the merged output setting. Fresh result getters reuse one execution and parse; custom parsed iterables retain their own consumption/cleanup rules without a Casai replay layer. Custom `Output.name` selects delivery, so `array` requires an iterable parsed value.

## Cancellation Scope

Cancellation signals belong to invocations: reject `abortSignal` in reusable configuration, including inherited configuration, and retain it on LLM `.run()`. LLM tool adapters forward the SDK tool-call signal through `.run()`; this explicit boundary needs no async call context. Until [Phase 7](docs/plan.md#phase-7-async-call-context-and-deadlines), preserve native SDK per-call `abortSignal` and `timeout` settings unchanged, await preparation normally, and check an explicit caller signal before SDK dispatch. Shared deadlines require Cascada async call context, developed with telemetry, not native engine abort. Propagate an absolute end time and call ancestry implicitly; each child takes the earlier of its parent end time and its own timeout from entry. Create signals only at boundaries that need them; do not restore a generic signal-dependent `createInvocation` scope or a parallel call tracker. Once that context exists, timeout races for Function/Script/Template are acceptable before native abort, with continuing work retaining its expired context so nested calls cannot escape the deadline. A race rejects the wait; it does not stop arbitrary JavaScript or unsupported engine work. Keep this handling minimal in each invocation and preserve native SDK limitations. See [the deadline contract](docs/abort.md).

## Cascada References

Use the installed `cascada-engine` docs:

- Prefer `node_modules/cascada-engine/dist/docs/cascada-agent.md` when present; it is the AI agent-friendly compressed script/template reference and saves tokens.
- If the compressed document is missing, or if syntax or semantics are unclear or contradictory, check the source docs: `node_modules/cascada-engine/dist/docs/script.md` and `node_modules/cascada-engine/dist/docs/template.md`.

## Tests

Do not run the whole suite by default. LLM-backed tests cost time and money.

Run one file with:

```bash
npm run test:file -- tests/Script.test.ts
```

`npm run test:file` uses the `casai-source` export condition and runs tests against `src`.
`npm run test` runs the type tests, then the full suite against the package entrypoint in `dist`.

Mocha strips types, so the `@ts-expect-error` type tests are checked only by the compiler, in `test:types`.

- `npm run test:local` runs every test file that uses mock models only. Add new mock-only files to it.
- `npm run test:coverage` runs that mock suite with c8 and writes source-mapped text, JSON, and HTML reports to `coverage/`. It checks runtime-source coverage and the shared augmentation core separately; declaration-only types use `test:types`.
- `npm run test:types` type-checks the tests against `src` with TS7 and TS6, builds, then checks them against the `dist` declarations and runs the `exactOptionalPropertyTypes` checks in `tests/type-safety`.
- `npm run check` runs `test:types`, `lint` and `test:coverage`: everything that needs no paid LLM calls.

Add `-- --grep "pattern"` after the filename for a single test or group.

`.mocharc.json` defines `tests/**/*.test.ts`, so plain `npx mocha tests/File.test.ts` is not a true single-file run.

For the target API, configured application values and schema defaults can satisfy requirements on direct and SDK-tool paths, including empty arguments. Parse final merged application input once, keep private/trusted bindings separate, and use returned values everywhere. Test raw/parsed types, missing fields after configuration, direct dependency overrides versus model isolation, advertised SDK requirements, and absence of private sentinels from history/UI/next requests. Verify Zod 3/4 ordinary copying with frozen and unfrozen fixtures. Characterize shared nested defaults, fresh/shared default/catch factories, `.readonly()` wrapper ordering, and freezing on invalid input against native SDK behavior; do not turn inherited behavior into a Casai rejection or copying requirement. Recheck version-specific probes on dependency upgrades. Native output/stream and custom options also use parsed values, lazily for stream elements. Current factories still validate call-time input separately and discard parsed input; this plan changes no implementation by itself.

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
