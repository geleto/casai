# Component documentation data

This directory supplies the **full component documentation and quick reference**. The website, layout and UI live in another project. There is no UI implementation here. A simplified main-page version is deferred.

The matrix and future full documentation are for people first: clear descriptions, examples and reference pages. Data reuse supplies that readable content to both publications. JSON and Markdown exports additionally make it accessible to agents, bots and scrapers.

See [Maintaining the matrix](MAINTENANCE.md) for content ownership, AI SDK reuse, writing conventions and the update process. Finish the matrix first. Later, the matrix page will have an introduction and links to documentation topics; full documentation will reuse that introduction and this matrix's reference data, add any documentation-only introduction, and include the topics. Those three kinds of content cover distinct material.

The data supports Info, Example and Config for one shared component selection. Info orders the summary, variants, source, features and invocation controls. Config orders variant changes, essential settings, source preparation, common configuration, adapted behavior, remaining SDK settings and invocation reference. Required settings have a separate index. Native settings are grouped by purpose, with an alphabetical property index for lookup.

## Consume the data

```js
import { render, selectOption } from './matrix.js';
import { describe, selectSource, setLoads } from './reference.js';

let selected = selectSource('LLMAgent', [], 'template');
selected = setLoads('LLMAgent', selected, true);
selected = selectOption('LLMAgent', selected, 'useTools');

const reference = describe('LLMAgent', selected);
const example = await render('LLMAgent', selected);
```

`describe()` is synchronous and returns plain serializable data. `render()` loads the component renderer and its resources and returns code files. In Node, pass `{ readText: url => readFile(url, 'utf8') }` to `render()`. Browsers use `fetch` by default. These modules do not import the Casai runtime or call a model.

Copy or bundle the entire directory, retaining module paths, `.cat`/`.cas` assets and the third-party notices/licenses. Dynamic renderer imports and resource URLs are relative to `matrix.js`. The consuming project owns selection state, layout, tabs, syntax highlighting, navigation and persistence. Resolve repository-relative documentation links against the website’s documentation/source base.

## Returned documentation

| Field | Contents |
| --- | --- |
| `form` | Actual factory/modifier path, primary property, native operation, source mode and notices |
| `info` | Description, input/result summaries and ordered controls |
| `config.properties` | One full record per applicable property: type, purpose, defaults, requiredness, locations, overrides, merging, scope, origin and source |
| `config.sections` | Ordered property IDs; variant sections may link to full explanations elsewhere |
| `config.index` | Alphabetical lookup without duplicating explanations |
| `config.requiredPropertyIds` | Properties required at construction or by the underlying operation; see each record’s conditions |
| `config.supportedSources` | All API source forms, including forms without an example toggle; tool compatibility is explicit |
| `config.alternatives` | For Config, separate eventual component shapes; never a union of unrelated settings presented as one valid configuration |
| `result` | Ordinary native result fields, Casai additions and the selected tool projection |
| `concepts` | Shared explanations within the matrix, with links to the existing guide used to check them |
| `relatedProperties` | Related configuration concepts, including Context’s defaults/private-input relationships |
| `status`, `versions` | Implemented/planned availability and the inspected dependency versions |

`required.construction` means the selected finished component must have that setting, possibly inherited. `required.operation` means the operation must resolve it by execution; callers may satisfy it through configuration, source preparation or invocation. These flags do not replace the property’s conditional explanation or schema-dependent call types. Type displays are reference notation, not standalone copyable declarations.

Scope, origin and applicability are independent. Common settings, capability/family settings and component settings may originate in Casai, Cascada or the SDK. An adapted SDK property retains its upstream description/type separately from the local amendment. Nested rendering options and output specifications are also included where relevant. Result methods retain their native descriptions and signatures.

`info.descriptionSource` identifies the SDK operation, original text, pinned source and whether the summary is verbatim or adapted. Configuration records identify the chosen prose through `descriptionOrigin`; `upstream` retains the native text even when the displayed description needs a Casai amendment. Source wrapping and documentation links may be normalized without changing wording.

## Source and selections

`getSourceControl()` presents **one source selector plus one Loads toggle**. `selectSource()` preserves loading when the new source supports it; switching to Function clears loading. `setLoads()` rejects unavailable loading. The resulting modifier uses the actual spelling, such as `.loadsTemplate`.

Canonical example selections retain `withTemplate`, `loadTemplate`, etc., so existing IDs, resources and renderers stay stable. `Default` is the neutral label for the ordinary source form. The complete API reference also documents `withText`/`loadsText` where supported, although the existing example scenarios do not demonstrate those separate choices.

Example constraints are independent of API support. In particular, the approval example requires tools but `resume()` supports other continuation cases; the streamed-text example uses direct input but a suitable preparer can return streamed text. Turning off `useTools`, structured output or another feature does not remove its valid properties from Config.

`example.configuration` reports the actual factory, variable and property names used in the primary example construction. Context’s example constructs a Function and identifies that owner explicitly. `highlightedPropertyIds` instead identifies properties related to selected controls; it is not a claim that every highlighted property appears in the code.

Current audio examples target separate `Streaming…` factories. The preview reports those exact names. Complete Translator remains explicitly planned, with separate finite-result documentation. Do not present future `.asStream` audio factories as implemented or combine complete and streaming audio formats.

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
