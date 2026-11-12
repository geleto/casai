# Config modifier implementation review — 2026-11-12

The selected API exposes `Config.withText`, `withTemplate`, `withScript`, `withFunction`, `loadsText`, `loadsTemplate` and `loadsScript`, with `.asTool` and `.asStream` where a current component can consume the resulting configuration. `Config.asTool` and `Config.asStream` also work without selecting a source. Source modifiers precede delivery modifiers. No current component supports both modifier flags, so neither the combined chain nor inherited simultaneous flags are admitted.

Plain fragments remain incomplete and source-neutral. A completed component selects its default only when no inherited or explicit source selector exists. Explicit modifiers replace the corresponding inherited selection; established context/registry/loader merging and sticky tool/stream flags remain unchanged. Fragments are configuration providers, not executable tools or streams.

`promptType` is no longer a public setting. Static checking and common runtime construction validation reject authored occurrences, including undefined and inherited occurrences. An application schema may still declare data named `promptType`. Source selection travels through internal symbol metadata, which survives configuration spreads and is removed before native request hooks/dispatch. SDK callbacks, native tool execution and result contracts retain their existing owners.

## Surface and downstream trace

- Inventory: all seven source selectors, ordinary/tool/stream fragment variants, incomplete fragments, inheritance, explicit replacement, configuration inspection and exported inferred declarations.
- Consumers: Config, Template, Script, Function, LLMAgent and the shared specialized factory; source preparation, call-role checking, tool projections, native request projection and generated matrix reference.
- Native comparison: installed `ToolLoopAgent` prepares SDK settings and delegates to `generateText`/`streamText`; SDK Agent/tool interfaces and native schema/execution boundaries remain unchanged. Casai selects preparation and strips its own metadata before that handoff. There is no new native execution or stream adapter.
- Documentation: both guides include a checked reusable template-tool example; the matrix keeps its stable Config example and lists capabilities independently of that example. Generated reference metadata excludes internal source selection.

## Corrections found during implementation

1. Infer the whole parent provider before reading `.config`. Inferring the inner configuration directly lost alternatives from conditional expressions of actual Config results. Source/call pairing now survives intermediate fragments and completed components.
2. Name retained/resolved source metadata in emitted types. Anonymous unique-symbol properties prevented applications from exporting inferred components. Declaration-export fixtures exercise fragments, completed components and both optional-property modes.
3. Preserve explicit undefined in compatible fragment alternatives. Exact optional checking must still accept established clearing/omission behavior.
4. Capture copied source metadata before contextualizing function preparers. Schema-derived parameter inference now works with explicit selectors, inherited fragments and spread `.config` values.
5. Retain parent structural checks independently of merged final validation, including an invalid parent field replaced by a valid child field.
   Check after parent inference: intersecting the entire owner-neutral shape into the parameter caused excessive union expansion in the broad consumer suite.
6. Avoid reconstructing configurations whose loader and source metadata need no conversion, and reuse the native agent callback shape directly for fragment checking. Component growth stays within the established budgets. The same-workload image comparison records a roughly 3% shared import increase for the added contracts, with lower per-component work; only its import ceiling was recalibrated. See [the measurements](../tests/README.md).
7. Share the key across package copies in both runtime and declarations. `Symbol.for` preserves runtime inheritance; a merged type-only global interface gives the symbol the same static identity without creating a global runtime value. The package fixture compiles and executes inherited function and loaded-source fragments from a second physical copy.

## Initial implementation verification

The implementation pass completed the following checks. The user's subsequent review request found additional gaps, recorded below; those findings supersede the initial clean-pass conclusion.

- `npm run test:types`: source/API checking, build, application declaration export/consumption, built consumers and exact optional properties. Both guides' current examples are included.
- `npm run test:coverage`: 1,831 passing tests; 99.85% statements/lines, 100% functions and 98.41% branches, with the configured coverage gates passing.
- `npm run docs:matrix` and `npm run test:matrix`: 105 reference shapes, 674 property records, 1,189 reference/browser-bundle selections, 14 planned syntax-only selections and 1,175 current executions with SDK mocks.
- Lint across source, tests, matrix and scripts, followed by a clean focused rerun of the five type-test files with final formatting corrections.
- 27 component runtime mutations and the separate source-inheritance mutation caught; unchanged controls pass. These remove the Config selectors, authored-key rejection and SDK metadata stripping, among the existing component boundaries.
- 32 selected Config, factory and source-mode type mutations caught in a completed run. Migration also fixed stale fixture imports and ambiguous mutation anchors. A stronger return-inference assertion proves that a contextual return type cannot invent configured fields.
- Editor checks pass against source and declarations in both optional-property modes, preserving completion, callback inference and named diagnostics.
- The full 16-workload factory-cost inventory passes with the documented image import recalibration and all other ceilings unchanged.
- Packed runtime/declaration consumers pass, including a second physical package copy and both optional-property modes. This check packs the existing built local Cascada checkout; it does not resolve or change the separate coordinated engine-release dependency.

No paid model calls were used. Native execution, schemas, approval/history handling and streaming completion retain their existing runtime owners; this review does not implement the planned audio modifier migration.

## Follow-up review

The second review inventories the complete public surface again and follows fragments through standalone/inherited Config, all completed factories, source preparation, native request projection, public annotations, emitted declarations and the reference generator.

Confirmed issues and corrections:

1. Source validation checked only `prompt`. Invalid literal/function/template selections on `input`, `text`, `audio`, `query`, `state` and `instructions` could escape fragment checking, including through an empty child. Validation now derives sources from the component inventory and checks each selected source against a compatible owner's complete settings. The owner pairing matters: LLMAgent's native `instructions` may be messages, while VoiceSessionSetup interprets `instructions` as its source. Function-preparer contextual inference preserves these non-source native values too.
2. A valid source union branch could erase a failure from another branch. Validation collects failed alternatives, including explicitly declared unions with a source-free branch, and preserves the pairing between each configuration and its selected mode.
3. Public annotations lost loaded-source information. LLMAgent, Template and Script annotations now retain selected source metadata, require inherited loaders where appropriate and give authored settings their normal default. Raw renderer inference shapes remain separate from these annotation unions, avoiding unnecessary compiler work.
4. Specialized and renderer factory bounds rejected explicit modifiers replacing metadata copied from `.config`. Config also checked copied metadata before applying its explicit override. Input capture now accepts the copied selection; Config checks its modified child shape and the merged result, and completed factories check the effective mode. Tests cover both replacement directions and reject unsupported retained modes.
5. Inferring the whole Function parent provider had dropped its former structural bound. The bound is restored after inference, preserving provider unions and rejecting invalid parent settings even when overwritten.
6. LLMAgent's invocation guard still listed the removed string selector but omitted its symbol replacement. Copied fragment metadata is now rejected by `.run()`, `.generate()`, `.stream()` and `.resume()`, using the same configuration-only setting list as their types. This matches the existing shared component guard and does not introduce invocation-time source-mode switching.
7. An empty function-mode child could retain a provisional inference shape and skip final compatibility checking of an inherited coded source. Config now resolves the empty argument before final validation, as the specialized factory already does. Incomplete compatible fragments remain valid; unsupported inherited source/delivery combinations do not.

Simplifications assessed: retain one structural metadata key and the existing merger, without adding owner tags, runtime component guessing or new execution paths. A probe replacing named source-metadata merge wrappers with the former anonymous mapped types still fails downstream declaration export with TS4023; the named wrappers remain necessary. Source validation reuses the component registry and native source types rather than maintaining another source-field allowlist. Callback validation and SDK execution retain their existing owners.

The cost comparison and narrow import-budget recalibration are recorded in [tests/README.md](../tests/README.md). Both measured specialized workloads use less work per component than the preceding HEAD; shared import work increases by about 4.1% across the complete change. No per-component budget was relaxed.

The full mutation inventory also exposed stale provider-inference anchors, an ambiguous named-source anchor, CRLF-sensitive matching, an outdated expected diagnostic and a declaration-only case that accidentally imported the source helper. The runner normalizes its isolated source copies, keeps unique anchors, checks the actual named diagnostic and gives declaration cases a declaration-backed helper. A native-source-union mutation had been bypassed by the ordinary native overload; a plain-tool URL/byte union now exercises the affected generic path. Production files are not mutated by these checks.

## Follow-up verification

The subsequent complete surface/consumer review found no important unresolved findings in this change. Final verification covers:

- `npm run test:types`, including both optional-property modes and application declaration export/consumption. The final strengthened Script annotation also passes a focused exact-optional declaration check.
- `npm run test:coverage`: 1,834 passing mock tests; 99.85% statements/lines, 100% functions and 98.41% branches. The final Config/inheritance selection passes all 36 tests after the added copy/continuation assertions.
- All 199 production type mutations are caught across the complete inventory and its focused correction. The full run caught 198; the remaining Script mutation exposed an assertion that failed for missing source rather than loader. Retaining the definitely supplied source isolates the loader contract, and that mutation and its unchanged control now pass. Inventory reconciliation confirms that no case is missing.
- All 28 component runtime mutations are caught, with unchanged controls passing.
- The complete 16-workload factory-cost inventory passes with the documented import recalibration; component ceilings remain unchanged.
- Matrix regeneration and verification: 105 shapes, 674 property records, 1,189 reference/browser selections, 14 planned syntax-only selections and 1,175 current SDK-mock executions.
- Editor checks pass against source and declarations under both optional-property modes. Packed consumers pass, including a second physical package copy, using the existing built local Cascada checkout without changing that repository.
- Lint passes for the source, tests and fixtures changed by this review, with focused reruns after test-only corrections. `git diff --check` passes.

No paid provider calls were made. The separate coordinated Cascada release and planned audio modifier migration remain outside this change.

## Claude review reconciliation

The external review found no correctness bugs and raised six documentation, diagnostic and test-quality findings plus an optional extraction. Each was checked against the current implementation and the separately updated matrix content.

1. Both guides now share a template/tool Config between two LLMAgents with different instructions. Template preparation changes the agents' literal default, so the example demonstrates both inherited modifiers. The examples retain their checked IDs.
2. Constructors and invocation entries now explain that `promptType` is not a setting and point to source modifiers. Copied source metadata receives a readable configuration diagnostic. A small helper owns these messages; existing constructor, named-call and native-method validation boundaries still own rejection. Application fields named `promptType` remain valid, including through named context.
3. The LLMAgent inheritance test now sends template-looking text with context and checks both outgoing requests. Inheritance renders `hello Ada`; an explicit `.withText` replacement sends `hello {{ name }}` literally. Separate mutations remove inheritance and reverse replacement precedence, and both are caught.
4. Modifier ordering now says source first, followed by `.asTool` or `.asStream`. The current API does not offer their combination.
5. Comments, active plan text and an older runtime diagnostic expectation now describe the removed setting correctly.
6. The matrix generator filters computed symbol-key declarations through TypeScript's public AST/type APIs, without matching escaped symbol names. Reference freshness remains unchanged; a focused probe also retains computed string keys while omitting renamed symbol metadata. The redundant test for the escaped spelling was removed; the general internal-field assertion remains.
7. The optional factory-helper extraction was declined. The shared merger already owns inheritance; only a few flag assignments repeat. Config leaves an absent source unselected and checks fragment structure, while completed factories select their defaults and validate component/registry contracts. Another helper would add indirection without a useful reduction in complexity.

The full matrix check found one integration omission from the concurrent documentation changes: the authored-module inventory did not yet include the new `introduction.js`. Its inventory now includes that shared module. The Config renderer, canonical resources, selection data and generated resources were preserved; this pass changes only the stale ordering sentence in matrix content.

The subsequent review rechecked source/tool/stream fragment combinations, explicit and inherited selection, constructor/named/native/continuation entry points, application-data separation, SDK projection, public declarations and documentation consumers. No important unresolved findings remain in this follow-up. The review process now requires behavior-distinguishing selector examples, diagnostic checks at all invocation forms and structural symbol inspection.

Verification for this reconciliation:

- `npm run test:types` passes, including both guides, source/build checks, application declaration export/consumption and both optional-property modes.
- `npm run test:coverage`: 1,836 passing mock tests; 99.85% statements/lines, 100% functions and 98.42% branches. All configured coverage gates pass.
- All 28 component runtime mutations pass their unchanged controls and are caught. The three focused production mutations for source inheritance, explicit replacement and sticky tool inheritance are also caught.
- Matrix freshness, package/bundle/reference checks, example type checking and mock execution pass: 105 shapes, 674 property records, 1,235 selections, including 14 planned syntax-only selections and 1,221 current executions.
- SHA-256 comparisons confirm the seven separately updated Config renderer/resource/selection files are unchanged by this pass. No generated matrix snapshot rewrite was needed.
- Focused lint passes for every source, test, fixture and matrix/generator module changed in this pass. Both working-tree and staged `git diff --check` pass.

No paid calls were made. Compiler-cost, editor and packed cross-copy gates from the preceding review were not repeated for these diagnostic/documentation changes; public factory signatures and execution contracts are unchanged.
