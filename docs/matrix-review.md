# Matrix review reconciliation — 2026-11-11

Reviewed the external Claude Code findings against the current catalog, resolver, generator, installed SDK and consuming tests. Changes are limited to documentation data, examples and their tooling. No Casai execution API or UI is changed.

## Scope and consumers

The pass covered all 14 catalog families and their renderers/resources; catalog lookup, visibility, selection and rendering; reference/source-control exports; configuration, methods, results and shared concepts; snapshot generation and attribution; catalog/selected JSON exports; and the handoff to the separate website project. Current consumers are the example checker, mock runner, JSON exporter and the new typed consumer fixture. The future website consumes the same documented contracts.

## Findings and resolution

| Finding | Verification and change |
| --- | --- |
| SDK settings incorrectly reported as Casai-owned | Confirmed 13 affected LLMAgent fields in this checkout. Ownership now falls back to the recovered native source, independently of who wrote the displayed prose. |
| Config omitted StreamingTranslator and repeated LLMAgent | Confirmed. Alternatives and related factory names now enumerate `api.definitions` exactly. Each alternative separately identifies its matrix family. Example `requires` rules are not copied into API alternatives. |
| Embedder callbacks described only embedMany | Confirmed. `src/factories/Embedder.ts` selects native `embed` for strings and `embedMany` for arrays. Both installed SDK functions use the same callback event types. Local descriptions now cover the selected embedding operation without letting the batch example toggle define API support. |
| Generic native-default wording on Casai fields | Confirmed. Casai fields have local defaults, including source mode, prompt, input, media and prepareCall. The generic native-default fallback applies only to native-owned settings. |
| Whole-file freshness hashes caused unnecessary updates | Confirmed. Tests now rerun extraction in `--check` mode. Local source locations omit line numbers; pinned dependency locations retain them. An isolated copy accepted a comment shifting local declarations and rejected a new public setting. |
| Unknown authoring references silently accepted | Confirmed. Missing named shapes now fail; absent optional shapes remain explicit. Test-time integrity checks cover groups, choices, exclusions, shapes, concepts and local property usage. Negative mutations exercise the checks. They also found and removed Translator's stale exclusion of a nonexistent asTool choice. |
| Component data in the generic resolver | Moved choice/property relationships into catalog choices. Variant links derive from selected choice metadata and actual required properties. Source-form and invocation-method assembly have separate helpers. |
| No output types or JavaScript linting | Added `matrix.d.ts` and `reference.d.ts`, compiled consumer checks and assertions tying actual output fields to the declarations. Authoring JS, scripts and matrix fixtures are included in ESLint; generated snapshots are excluded. |
| Prompts shaped by the mock parser | Removed the sentence/JSON regex protocol. Renderers provide ordinary task prompts; test fixtures supply model tool arguments independently. Existing checks still assert the actual requests and results. |
| Stale generated files | Generation verifies the resolved cache is inside the workspace and clears it first. Planned snippets remain excluded through the explicit compilation file list. |
| Deprecated aliases looked like new settings | Aliases now point to the current setting through `aliasFor`, with deprecation metadata in both property records and the index. |
| Unused invocationProperties | Removed. |
| Repeated guidance | MAINTENANCE owns authoring/update policy; README owns the consumer contract; AGENTS links to both and retains only essential scope instructions. |

## Verification and second pass

- `npm run test:matrix` passed: 1,081 reference/example selections, 1,067 implemented snippets compiled with TS7 and executed with SDK mocks, and 14 planned snippets checked for syntax and shared-source consistency. The declared documentation consumer also compiled. No provider requests were made.
- Snapshot reproducibility passed within that command: 77 shapes and 596 deduplicated property records. Removing local source lines also merged one previously location-only duplicate.
- Targeted ESLint passed for the matrix, generator/exporter and matrix fixtures.
- Isolated freshness probes accepted an unrelated comment/line shift and rejected an added public setting. The production source tree was not modified by those probes.
- A subsequent pass retraced the complete public inventory above through JSON export, selection transitions, source resources, Config alternatives, native ownership, defaults, aliases and the declared consumer shapes. It retained the current/planned audio boundaries and found no remaining important issue in this reviewed scope. Readable examples and descriptions were reviewed separately from machine-readable validity.

The `.d.ts` contract is checked through compiled consumers and returned-field assertions, not a new runtime validation layer or a claim that every prose sentence can be verified automatically. Full repository runtime/coverage suites were not needed for these documentation/tooling changes.

## Independent UI-handoff audit — 2026-11-11

Revisited the complete matrix after the reconciliation above, focusing on what the separate UI project actually consumes. The review covered all catalog families, selection/source/Loads helpers, renderer imports and assets, configuration and method/result references, declarations, JSON exports and maintenance instructions. No UI or production execution API was added.

| Additional issue | Evidence and correction |
| --- | --- |
| Renderer imports failed after bundling | A browser-targeted esbuild bundle could not render Context: the computed import left a reference to a missing `Context.js`. Literal lazy imports now expose every renderer to bundlers. Literal asset URLs expose the canonical resources; the integration guide documents asset emission/copying. esbuild is an explicit development dependency for the consumer check. |
| Plain/function examples fetched unused resources | Plain LLMAgent fetched both `.cat` and `.cas`. Rendering now reads only the selected source; standalone Template/Script declare their default inline resource. Every selection checks its actual resource reads. |
| Planned Translator's source type ignored the selected preparer | An unconditional audio type override displayed bytes even for scripts, resource names and functions. Planned direct/prepared input types now feed the generic source-type resolver. The implemented streaming variant retains its own native input contract. |
| Requiredness and positional metadata were incomplete | Loaded Script still needs source by execution, prepared VoiceSessionSetup needs instructions source, and LLMAgent history is positional. These now match the inspected factory definitions/call types. The history description also now matches the actual order: earlier messages, then the new prompt. |
| VoiceSessionSetup method choices showed token results | Configuration and WebRTC selections now select their own operation, input/result summaries and native result fields. Method entries link reusable named-call settings and document their own results. Token lifetime remains explicitly limited to token creation. |
| LLMAgent method references omitted supported details | resume links named-call overrides except source/history replacements. Native generate/stream entries expose their respective result fields and Casai history additions independently of ordinary-call mode. |
| Source-selector descriptions disappeared in the adapter | Adapted source choices now preserve descriptions, including the default source. All source/Loads transitions are exercised against valid selections. |
| Consumer declarations missed actual nested data | Compiling real exported records found the missing optional group description. The declarations also now permit omitted selections where the runtime already uses activeOptions. Real representative nested outputs supplement the existing field and consumer assertions. |

Verification after the fixes:

- `npm run test:matrix` passed: 1,081 selections checked against reference data and executed from a browser-targeted bundle; 1,067 implemented snippets type-checked and mock-executed; 14 planned snippets checked for syntax and shared-source consistency. Representative actual exports and the public consumer fixture compiled. No provider requests were made.
- Snapshot reproducibility passed with 79 shapes and 598 distinct property records, including the native session-configuration/WebRTC results.
- Targeted ESLint and `git diff --check` passed.
- Isolated probes passed on the corrected bundle, then detected restored computed-import and eager-resource-loading mutations. The compiler also rejected the actual nested exports before the group-description declaration was corrected.
- A subsequent complete pass retraced catalog/rule transitions, sources and resources, every family's current/planned configuration and result forms, native and Casai method boundaries, declarations and JSON consumers. No important unresolved finding remained in this scope.

The bundle check verifies modules, assets and data under Node with a browser-targeted build; it does not test a website, layout or browser interaction. The UI project still owns those checks. Full repository runtime/coverage suites were not rerun for these documentation/tooling-only changes.

## Data completeness and separate-project consumption — 2026-11-11

The follow-up request was to finish the data here so another project can implement only its UI. Top-level configuration coverage was already present, but a deeper inventory found missing nested/result prose and a missing direct package integration.

Completed data:

- All 14 catalog families retain component/choice descriptions, requirements, examples, methods and result contracts. Tests now compare every implemented selection's complete configuration key set with the extracted public declaration inventory, including tool-only properties.
- Added 18 reusable native data shapes for telemetry, timeouts, result inclusion, audio formats, session transcription/VAD, decision questions, message/image inputs, generated files, realtime tool definitions, Output builder options and template delimiters/web-loader settings. Union alternatives stay separate. Extensible provider/application maps and callback implementation types are not presented as fixed configuration lists.
- Following exported SDK aliases recovered the missing Output builder descriptions. Parameter prose comes from the same builders' native JSDoc. Decision result descriptions are copied from the installed SDK reference page with source/version/line attribution. Local fallback descriptions fill the remaining voice, message/image, timeout and Cascada gaps without replacing native prose.
- Documented the distinction between Cascada configure() options and Casai's direct environment construction: loader/Express flags in the inherited options type do not configure those integrations through Casai renderOptions.
- Config alternatives now contain an explicit reference navigation selection. The UI can resolve complete/streaming factory references without interpreting their names or maintaining its own mapping.
- Added a private, dependency-free `@casai/matrix` package with catalog/example and reference entry points plus consumer declarations. The UI project can use a file/workspace dependency while the canonical content stays in this repository. The integration guide covers module imports, assets, nested data and source attribution.

Verification: `npm run test:matrix` checks all 1,081 selections, complete config inventories, required descriptions, detail reachability, package imports/resources, JSON output and browser bundles. It compiles and mock-executes 1,067 implemented snippets, compiles actual nested exports and the package consumer, and separately checks 14 planned examples. Extraction is reproducible at 105 shapes and 678 distinct property records. An actual npm file-dependency installation in a separate consumer folder imported both entry points and loaded resources successfully; `npm pack --dry-run` included the renderers, resources, declarations and third-party licenses. Targeted lint and diff whitespace checks passed.

A subsequent complete pass retraced every family, native source/alias, nested detail, method/result, Config navigation target and package/JSON consumer. The current matrix data has no important unresolved completeness finding in this scope. UI implementation, deployment, introduction/topic authoring and complete Translator implementation remain outside this data task.
