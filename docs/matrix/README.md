# Component documentation data

This directory supplies the **full component documentation and quick reference**. The website, layout and UI live in another project. There is no UI implementation here. A simplified main-page version is deferred.

The matrix and future full documentation are for people first: clear descriptions, examples and reference pages. Data reuse supplies that readable content to both publications. JSON and Markdown exports additionally make it accessible to agents, bots and scrapers.

See [Maintaining the matrix](MAINTENANCE.md) for content ownership, AI SDK reuse, writing conventions and the update process. Finish the matrix first. Later, the matrix page will have an introduction and links to documentation topics; full documentation will reuse that introduction and this matrix's reference data, add any documentation-only introduction, and include the topics. Those three kinds of content cover distinct material.

The data supports Info, Example and Config for one shared component selection. Info orders the summary, variants, source, features and invocation controls. Config orders variant changes, essential settings, source preparation, common configuration, adapted behavior, remaining SDK settings and invocation reference. Required settings have a separate index. Native settings are grouped by purpose, with an alphabetical property index for lookup.

## Consume the data

Keep this repository as the source of the matrix data. The UI project can use the private, dependency-free package in this folder through a local file/workspace dependency. For sibling checkouts, run this **in the UI project**:

```sh
npm install ../casai/docs/matrix
```

This adds a `file:../casai/docs/matrix` dependency named `@casai/matrix`. Keep the Casai checkout available at that path for development and builds; rebuild the UI after updating it. CI can check out both repositories at pinned commits. No SDK, Casai runtime, TypeScript generator or documentation scraping is needed in the UI project. Edit descriptions, examples, rules and reference data here, then rebuild the consumer.

```js
import { render, selectOption } from '@casai/matrix';
import { describe, selectSource, setLoads } from '@casai/matrix/reference';

let selected = selectSource('LLMAgent', [], 'template');
selected = setLoads('LLMAgent', selected, true);
selected = selectOption('LLMAgent', selected, 'useTools');

const reference = describe('LLMAgent', selected);
const example = await render('LLMAgent', selected);
```

`describe()` is synchronous and returns plain serializable data. `render()` loads the component renderer and only the resource needed by the selected source. Direct-input and function examples need no resource fetch. In Node, pass `{ readText: url => readFile(url, 'utf8') }` to `render()`. Browsers use `fetch` by default. These modules do not import the Casai runtime or call a model. Omitting the selection uses the component's `activeOptions`.

Bundlers can discover the package's literal renderer imports and `new URL` resource references. Configure asset handling for `.cat`/`.cas`; if the bundler leaves URL references unchanged, emit those assets beside the module containing the URLs. The check suite executes an esbuild browser bundle with this copy strategy. Keep the package's third-party notices/licenses with distributed data. The consuming project owns selection state, layout, tabs, syntax highlighting, navigation and persistence. Resolve repository-relative documentation links against the website’s documentation/source base. Generated build artifacts are disposable; do not maintain an authored copy of the data in the UI repository.

## Returned documentation

| Field | Contents |
| --- | --- |
| `form` | Actual factory/modifier path, primary property, native operation, source mode and notices |
| `info` | Description, input/result summaries and ordered controls |
| `config.properties` | One full record per applicable property: type, purpose, defaults, requiredness, locations, overrides, merging, scope, origin and source |
| `config.properties[name].details` | Nested data fields with separate union alternatives, such as timeouts, telemetry, audio formats, decision questions and message/image inputs |
| `config.sections` | Ordered property IDs; variant sections may link to full explanations elsewhere |
| `config.index` | Alphabetical lookup without duplicating explanations |
| `config.requiredPropertyIds` | Properties required at construction or by the underlying operation; see each record’s conditions |
| `config.supportedSources` | All API source forms, including forms without an example toggle; tool compatibility is explicit |
| `config.alternatives` | For Config, separate eventual component shapes; never a union of unrelated settings presented as one valid configuration |
| `result` | Ordinary native result fields, Casai additions and the selected tool projection |
| `concepts` | Shared explanations within the matrix, with links to the existing guide used to check them |
| `relatedProperties` | Related configuration concepts, including Context’s defaults/private-input relationships |
| `status`, `versions` | Implemented/planned availability and the inspected dependency versions |

`matrix.d.ts` and `reference.d.ts` describe the public exports, including `ComponentReference`, `Example` and the `MatrixExport` JSON union. Tests compile a consumer and representative real exports against these declarations, and check returned fields across every selection.

`relatedComponents` on Config lists actual implemented factory names. `config.alternatives` maps each one to its matrix family (`component`) and configuration shape (`shape`); for example, `StreamingTranslator` belongs to the `Translator` family. To open its full reference, call `describe(alternative.component, alternative.activeOptions)`. These options are a navigation target, not configuration restrictions; the UI does not need to infer streaming choices from factory names. Deprecated settings carry `deprecated` and `aliasFor` in their property and index entries.

`required.construction` means the selected finished component must have that setting, possibly inherited. `required.operation` means the operation must resolve it by execution; callers may satisfy it through configuration, source preparation or invocation. These flags do not replace the property’s conditional explanation or schema-dependent call types. Type displays are reference notation, not standalone copyable declarations.

Scope, origin and applicability are independent. Common settings, capability/family settings and component settings may originate in Casai, Cascada or the SDK. An adapted SDK property retains its upstream description/type separately from the local amendment. Nested rendering options and output specifications are also included where relevant. Result methods retain their native descriptions and signatures.

`nested` contains a simple list of documented members, such as the `Output` builders or rendering options. A property or native member can also carry `details: { name, appliesTo, type, variants }`. Each variant contains its own type and properties; render them as alternatives rather than merging their fields. `appliesTo` distinguishes a whole value, builder options, each named question or each returned file. Native members can have further `details`, for example the options passed to `Output.object()`. The same structure works in Config, methods and results.

Every implemented top-level configuration field is checked against the public declaration inventory, including tool-only fields. Displayed native result, method-argument and nested-detail fields must have descriptions. Native JSDoc is reused first; the generator also follows exported aliases and fills documented gaps from the matching SDK reference pages. Local wording covers actual Casai differences and remaining upstream gaps. Provider-specific option maps, application schemas/context and tool registries remain extensible; their keys are not a fixed Casai option list. Native callback signatures and source links remain available without expanding the SDK's entire implementation type graph.

`info.descriptionSource` identifies the SDK operation, original text, pinned source and whether the summary is verbatim or adapted. Configuration records identify the chosen prose through `descriptionOrigin`; `upstream` retains the native text even when the displayed description needs a Casai amendment. A native member's `descriptionSource` identifies supplemental SDK prose when it comes from another documented location; `descriptionOrigin: 'casai'` marks a local fallback. Source wrapping and documentation links may be normalized without changing wording.

## Source and selections

`getSourceControl()` presents **one source selector plus one Loads toggle**, with descriptions for every choice. `selectSource()` preserves loading when the new source supports it; switching to Function clears loading. `setLoads()` rejects unavailable loading. The resulting modifier uses the actual spelling, such as `.loadsTemplate`.

Canonical example selections retain `withTemplate`, `loadTemplate`, etc., so existing IDs, resources and renderers stay stable. `Default` is the neutral label for the ordinary source form. The complete API reference also documents `withText`/`loadsText` where supported, although the existing example scenarios do not demonstrate those separate choices.

Example constraints are independent of API support. In particular, the approval example requires tools but `resume()` supports other continuation cases; the streamed-text example uses direct input but a suitable preparer can return streamed text. Turning off `useTools`, structured output or another feature does not remove its valid properties from Config.

`example.configuration` reports the actual factory, variable and property names used in the primary example construction. Context’s example constructs a Function and identifies that owner explicitly. `highlightedPropertyIds` instead identifies properties related to selected controls; it is not a claim that every highlighted property appears in the code.

Current audio examples target separate `Streaming…` factories. The preview reports those exact names. Complete Translator remains explicitly planned, with separate finite-result documentation. Do not present future `.asStream` audio factories as implemented or combine complete and streaming audio formats.

VoiceSessionSetup's selected invocation changes `form.operation`, the result summary and result fields: client-secret creation, session configuration or WebRTC negotiation. Its invocation reference always lists all supported methods, their settings and results. LLMAgent's native `generate()` and `stream()` methods likewise retain their own result contracts regardless of the ordinary-call streaming selection.

The handover’s open presentation suggestions remain open: visible-but-disabled unavailable variants, selection persistence/reset/share URLs and a different initial Translator selection. Current visibility and initial choices are preserved. No introduction or simplified main-page content is added.

## Portable data

Documentation builders and agents can access the matrix data without a browser or JavaScript UI. This export is an integration format, not a replacement for readable documentation. Export plain JSON using:

```sh
# Catalog, option rules, shared concepts and dependency versions.
npm run --silent docs:matrix:export

# Full reference and all code/resource files for one selection.
npm run --silent docs:matrix:export -- LLMAgent withTemplate asTool
```

The command writes JSON to stdout. A component without further arguments uses the empty selection; the catalog's `activeOptions` identifies the initial selection for interactive consumers. The envelope carries `schemaVersion: 1`. Selected exports include explicit availability, source provenance, configuration, methods, results and example files. They execute no model code. Obtain other combinations on demand; do not publish thousands of near-identical authored pages.

The website project should render normal documentation pages from these same records and additionally publish Markdown and JSON views, with stable component/property anchors and a discoverable index. Readers should get coherent explanations and examples; scrapers should not have to operate controls to discover configuration or load JavaScript to read it. That publishing work, the introduction and the later topic pages remain future work.

SDK prose and declaration material carry their upstream licenses. See [third-party notices](reference/THIRD_PARTY.md); keep those files when distributing the documentation data.
