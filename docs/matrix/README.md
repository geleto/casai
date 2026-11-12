# Component documentation data

This directory supplies the **full component documentation and quick reference**. The website, layout and UI live in another project. There is no UI implementation here. A simplified main-page version is deferred.

The matrix and future full documentation are for people first: clear descriptions, examples and reference pages. Data reuse supplies that readable content to both publications. JSON and Markdown exports additionally make it accessible to agents, bots and scrapers.

See [Maintaining the matrix](MAINTENANCE.md) for content ownership, AI SDK reuse, writing conventions and the update process. Finish the matrix first. Later, the matrix page will have an introduction and links to documentation topics; full documentation will reuse that introduction and this matrix's reference data, add any documentation-only introduction, and include the topics. Those three kinds of content cover distinct material.

The data supports input and return summaries, examples, configuration, source modes and detailed results for one shared component selection. Config groups required settings, component behavior or tool configuration, source preparation, common configuration, adapted behavior, remaining SDK settings and invocation reference. Required settings have a separate lookup index; consumers need not display a second copy. Native settings are grouped by purpose, with an alphabetical property index for lookup.

## Consume the data

Keep this repository as the source of the matrix data. The UI project can use the private, dependency-free package in this folder through a local file/workspace dependency. For sibling checkouts, run this **in the UI project**:

```sh
npm install ../casai/docs/matrix
```

This adds a `file:../casai/docs/matrix` dependency named `@casai/matrix`. Keep the Casai checkout available at that path for development and builds; rebuild the UI after updating it. CI can check out both repositories at pinned commits. No SDK, Casai runtime, TypeScript generator or documentation scraping is needed in the UI project. Edit descriptions, examples, rules and reference data here, then rebuild the consumer.

```js
import { getControls, render, selectOption, selectSource, setLoads } from '@casai/matrix';
import { describe } from '@casai/matrix/reference';

let selected = selectSource('LLMAgent', [], 'template');
selected = setLoads('LLMAgent', selected, true);
selected = selectOption('LLMAgent', selected, 'useTools');

const reference = describe('LLMAgent', selected);
const controls = getControls('LLMAgent', selected);
const example = await render('LLMAgent', selected);
```

`describe()` is synchronous and returns plain serializable data. `render()` loads the selected component renderer. Canonical `.cat`/`.cas`/`.txt` text is included in a generated resource module, so rendering works in Node and browsers without fetching files or configuring assets. An optional `{ readText: url => ... }` overrides resource reading; it is called only for the selected source. These modules do not import the Casai runtime or call a model. Omitting the selection uses the component's `activeOptions`; passing `[]` explicitly chooses no options.

Bundlers can discover the package's literal renderer imports; no custom resource handling is needed. The check suite executes an esbuild browser bundle without copying assets. Importing controls and examples from the main entry does not load the full reference snapshot. Keep the package's third-party notices/licenses with distributed data. The consuming project owns selection state, layout, tabs, syntax highlighting, navigation and persistence. Resolve repository-relative documentation links against the website's documentation/source base. Generated build artifacts are disposable; do not maintain an authored copy of the data in the UI repository.

### Website snapshot integration

The sibling `cascada.dev` project publishes this package at Casai's
`/documentation/quick-reference/`. It uses a generated package snapshot so its
ordinary builds do not require this checkout. From the website repository, run
`npm run matrix:sync` (or append `-- --source /path/to/casai`) after changing
matrix content. `npm run matrix:check` verifies freshness without writing.
The snapshot retains licenses, file hashes, the source commit and local-change
status. The website owns the shared static/browser renderer and publishes HTML,
Markdown and JSON for every form returned by `referenceSelections()`.
Fix reference content and behavior here, then synchronize; do not edit the
website's generated snapshot.

## Returned documentation

| Field | Contents |
| --- | --- |
| `form` | Actual factory/modifier path, primary property, native operation, source mode and notices |
| `canonical` | Reference page ID and selection, excluding example-only choices |
| `info` | Short and long descriptions, input/result summaries and ordered controls |
| `config.properties` | One full record per applicable property: type, purpose, defaults, requiredness, locations, overrides, merging, scope, origin and source |
| `config.properties[name].details` | Nested data fields with separate union alternatives, such as timeouts, telemetry, audio formats, decision questions and message/image inputs |
| `config.sections` | Ordered property IDs; variant sections may link to full explanations elsewhere |
| `config.index` | Alphabetical lookup without duplicating explanations |
| `config.requiredPropertyIds` | Properties required at construction or by the underlying operation; see each record’s conditions |
| `config.supportedSources` | All API source forms, including forms without an example toggle; tool compatibility is explicit |
| `config.alternatives` | For Config, separate eventual component shapes; never a union of unrelated settings presented as one valid configuration |
| `result` | Ordinary native result fields, Casai additions and the selected tool projection |
| `concepts` | Shared explanations within the matrix, with links to the existing guide used to check them |
| `relatedProperties` | The same full property records for related concepts, including Context's defaults/private-input relationships |
| `status`, `versions` | Implemented/planned availability, Casai version and inspected dependency versions |

Return descriptions, including streaming behavior and tool projections, belong to `result`; configuration sections contain settings and invocation methods. Consumers can keep `info.result` beside the input summary and show a separate return reference when `result.shapes` or `result.additionalProperties` contain documented fields.

`config.properties` contains the settings used by the selected form. Filters and rendering options apply to Cascada Template/Script modes; loaders apply to those modes and loaded text; trusted tool-context schemas apply to tools. Reusable Config fragments keep these settings because their eventual component is not selected yet. Broad factory types may accept settings for later derivation; that does not make them active in every source mode. These rules live in the canonical reference metadata, not in the website.

`matrix.d.ts` and `reference.d.ts` describe the public exports, including `ComponentReference`, `Example` and the `MatrixExport` JSON union. Tests compile a consumer and representative real exports against these declarations, and check returned fields across every selection.

Each catalog component has `shortDescription` for its original short summary and `description` for the full explanation in Markdown paragraphs. `describe().info` exposes the same two fields for the selected form; streaming selections have their own explanations. Use `shortDescription` for compact labels or summaries and `description` for the component overview. `descriptionSources` lists the pinned SDK documentation used as the basis for adapted full explanations; an empty list identifies locally written Casai content. The original short text and its attribution are preserved in `shortDescription` and `shortDescriptionSource`. These fields are included in the package and JSON exports.

`relatedComponents` on Config lists actual implemented factory names. `config.alternatives` maps each one to its matrix family (`component`) and configuration shape (`shape`); for example, `StreamingTranslator` belongs to the `Translator` family. To open its full reference, call `describe(alternative.component, alternative.activeOptions)`. These options are a navigation target, not configuration restrictions; the UI does not need to infer streaming choices from factory names. Deprecated settings carry `deprecated` and `aliasFor` in their property and index entries.

`required.construction` means the selected finished component must have that setting, possibly inherited. `required.operation` means the operation must resolve it by execution; callers may satisfy it through configuration, source preparation or invocation. These flags do not replace the property’s conditional explanation or schema-dependent call types. Type displays are reference notation, not standalone copyable declarations.

Use `displayType` for a compact property/native-member type label and `type` for the complete signature on expansion. Context's `relatedProperties` use the same `PropertyReference` shape as configuration records. Their `locations` are empty because Context is an object, not a callable factory; read their conditional explanations and follow the receiving component's configuration reference.

Catalog entries expose `kind` (`component`, `configuration` or `concept`), also returned as `info.kind`. Component pickers should exclude concepts: Context remains a shared explanation and standalone reference, not a component button. Notes are authored once in `reference/concepts.js`; each component lists the applicable concept IDs, and `describe()` resolves those same entries without component-specific copies.

Scope, origin and applicability are independent. Common settings, capability/family settings and component settings may originate in Casai, Cascada or the SDK. An adapted SDK property retains its upstream description/type separately from the local amendment. Nested rendering options and output specifications are also included where relevant. Result methods retain their native descriptions and signatures.

`nested` contains a simple list of documented members, such as the `Output` builders or rendering options. A property or native member can also carry `details: { name, appliesTo, type, variants }`. Each variant contains its own type and properties; render them as alternatives rather than merging their fields. `appliesTo` distinguishes a whole value, builder options, each named question or each returned file. Native members can have further `details`, for example the options passed to `Output.object()`. The same structure works in Config, methods and results.

Every implemented top-level configuration field is checked against the public declaration inventory, including tool-only fields. Displayed native result, method-argument and nested-detail fields must have descriptions. Native JSDoc is reused first; the generator also follows exported aliases and fills documented gaps from the matching SDK reference pages. Local wording covers actual Casai differences and remaining upstream gaps. Provider-specific option maps, application schemas/context and tool registries remain extensible; their keys are not a fixed Casai option list. Native callback signatures and source links remain available without expanding the SDK's entire implementation type graph.

`info.shortDescriptionSource` identifies the SDK operation, original text, pinned source and whether the short summary is verbatim or adapted. Configuration records identify the chosen prose through `descriptionOrigin`; `upstream` retains the native text even when the displayed description needs a Casai amendment. A native member's `descriptionSource` identifies supplemental SDK prose when it comes from another documented location; `descriptionOrigin: 'casai'` marks a local fallback. Source wrapping and documentation links may be normalized without changing wording.

`versions.casai` is the root Casai package version, not the private data package's version. For exact source links, have the publishing build record its pinned Casai checkout revision (for example, `git -C ../casai rev-parse HEAD`) and pass it to `sourceUrl(property.source, revision)` from the main entry. Existing pinned SDK URLs are returned unchanged. Local links require that revision; without it the helper returns `null`. A moving HEAD is not embedded in checked-in generated data, which would invalidate itself after each documentation commit. Publish the build's revision alongside the version badge.

## Source and selections

`getControls()` from the main entry is the official control API for every view. `describe().info.controls` returns the same data. It orders variant groups, one source selector plus Loads, features and invocation. The raw catalog groups and `visibleGroups()` remain low-level rule data; do not build a second source selector from them.

Use each control's `active` value for its checkbox and apply `transition.activeOptions` when toggled. A choice with `defaultControl` presents the group's default as checked: Shorthand call starts checked; unchecking selects `run`, while checking clears the invocation choice. The canonical `run` ID still means `.run()` in saved selections and generated examples. Labels and checkbox states come from the control model, not directly from option membership.

Unavailable choices are hidden by default, preserving the matrix's original behavior. `getControls(name, selected, { unavailable: 'include' })` retains them with `available` and `unavailableReasons` for a UI that shows disabled choices. Every choice also has a `transition` preview with the resulting `activeOptions`, `added` and `cleared` choices, or `null` when the action is unavailable. A conflicting choice can be unavailable in the current combination but have a valid transition that clears the conflict: LLMAgent can switch directly between tool and stream. The UI can present that switch and explain what will clear. No selection changes until the consumer applies the preview or calls the corresponding selection helper.

`getSourceControl()` exposes the source part separately. Template and Script each have only their own source kind, with Loads available from the initial selection; there is no duplicate Default choice. Text components label their default source Text; audio components use Direct input. `selectSource()` preserves loading when the new source supports it; switching to Function clears loading. `setLoads()` rejects unavailable loading. The resulting modifier uses the actual spelling, such as `.loadsText` for plain text or `.loadsTemplate` for a Cascada Template. Source and Loads actions also include transition previews.

Example selections retain `withTemplate`, `loadTemplate`, etc., so existing IDs, resources and renderers stay stable. Direct Text uses the default source mode; `loadText` demonstrates `.loadsText` with an accompanying text file. The complete API reference also documents the explicit `.withText` modifier.

Use `normalizeOptions(name, restoredIds)` at a URL/storage boundary before calling the strict `describe()` or `render()`. It removes unknown IDs, keeps the last restored choice in each group, then removes incompatible choices and dependents in catalog order. It returns both `activeOptions` and `dropped` IDs so the UI can explain the restoration. An omitted selection uses initial options; an explicit empty selection remains empty. Unknown component names still need route handling by the consuming project. Authored examples continue to reject invalid selections rather than silently repairing them.

Choices carry `affectsReference`: variants, source forms and VoiceSessionSetup method choices change the API reference; other choices change examples and highlights. `referenceSelection(name, selected)` supplies the canonical reference ID and options, also returned as `describe().canonical`. It drops example-only choices and redundant inline Template/Script aliases. Use that ID to deduplicate generated reference pages and the existing property/method IDs for anchors. Examples and share links retain the full selection. `referenceSelections(name?)` enumerates all reachable, deduplicated canonical forms, optionally restricted to one component family. Static builders should use this helper instead of duplicating the selection rules or enumerating teaching features.

Example constraints are independent of API support. In particular, the approval example requires tools but `resume()` supports other continuation cases; the streamed-text example uses direct input but a suitable preparer can return streamed text. Turning off `useTools`, structured output or another feature does not remove its valid properties from Config.

`example.configuration` reports the actual factory, variable and property names used in the primary example construction. Context’s example constructs a Function and identifies that owner explicitly. `highlightedPropertyIds` instead identifies properties related to selected controls; it is not a claim that every highlighted property appears in the code.

Show the complete exported function with its descriptive scenario name. Its arguments make application-supplied models, audio and services explicit; it is a reusable callable example, not hidden test setup. Tests supply mocks from outside the displayed code. Scenario comments explain the example to readers, while each tool has its own task description for the model.

Every component initially shows its normal form; streaming is an optional checkbox. Current audio examples target separate `Streaming…` factories, and the preview reports those exact names. Translator therefore initially shows its explicitly planned complete form, with separate finite-result documentation; selecting streaming shows the implemented form. Do not present future `.asStream` audio factories as implemented or combine complete and streaming audio formats.

VoiceSessionSetup's selected invocation changes `form.operation`, the result summary and result fields: client-secret creation, session configuration or WebRTC negotiation. Its invocation reference always lists all supported methods, their settings and results. LLMAgent's native `generate()` and `stream()` methods likewise retain their own result contracts regardless of the ordinary-call streaming selection.

Persistence, reset/share controls and the visual treatment of unavailable choices belong to the UI project. This package supplies their selection rules, restoration and transition data. No introduction or simplified main-page content is added.

## Portable data

Documentation builders and agents can access the matrix data without a browser or JavaScript UI. This export is an integration format, not a replacement for readable documentation. Export plain JSON using:

```sh
# Catalog, option rules, shared concepts and dependency versions.
npm run --silent docs:matrix:export

# Full reference and all code/resource files for one selection.
npm run --silent docs:matrix:export -- LLMAgent withTemplate asTool
```

The command writes JSON to stdout. A component without further arguments uses the empty selection; the catalog's `activeOptions` identifies the initial selection for interactive consumers. The envelope carries `schemaVersion: 3`. Version 3 represents an unspecified property default as `null`, rather than placeholder prose, and adds a source form's `explanation` for the full mode reference alongside its concise input `description`. Optional `typeDescription` text explains named types with concrete accepted values and examples; `displayType` is a readable label while `type` retains the exact contract. Version 2 moved component summaries to `shortDescription` and their attribution to `shortDescriptionSource`, using `description` for the full explanation. Selected exports include explicit availability, source provenance, configuration, methods, results and example files. They execute no model code. Obtain other combinations on demand; do not publish thousands of near-identical authored pages.

The website project should render normal documentation pages from these same records and additionally publish Markdown and JSON views, with stable component/property anchors and a discoverable index. Readers should get coherent explanations and examples; scrapers should not have to operate controls to discover configuration or load JavaScript to read it. That publishing work, the introduction and the later topic pages remain future work.

SDK prose and declaration material carry their upstream licenses. See [third-party notices](reference/THIRD_PARTY.md); keep those files when distributing the documentation data.
