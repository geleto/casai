# Maintaining the matrix

The matrix is the canonical component reference. This repository owns its content, examples, data and selection rules. The separate website/documentation project owns the UI and publishing. Finish the matrix before adding an introduction, topic pages or a simplified main-page version.

Write for people first. The matrix will likely be the main way readers explore Casai. The full documentation must also be a normal, readable guide with clear navigation, explanations, examples and practical topics. Machine-readable formats are additional ways to access that same content, not the organizing principle for the documentation.

## The two future publications

| Publication | Content |
| --- | --- |
| Matrix page | Introduction, matrix, then links to documentation topics |
| Full documentation | The same introduction, optionally additional documentation-only introductory material, all reference information from the matrix, and the topics |

These two publications reuse the same data. The introduction, component reference and topics have distinct responsibilities; they do not repeat one another. The matrix remains the source of reference content when the full documentation is built. Copying or rendering it at build time is fine; maintaining another authored reference is not.

The documentation's reference pages should present matrix content as readable descriptions, signatures, property entries and examples. Readers should not need to understand the data model, read JSON or operate matrix controls to understand a component. Reusing content does not require copying the matrix's interactive layout into the documentation.

Later topics should explain tasks and cross-component workflows and link to the matrix's property/method entries. Existing README material may supply them after review. Do not move existing guidance or author those topics as part of finishing the matrix.

## Content ownership

| Source | Owns | Edit by hand? |
| --- | --- | --- |
| `matrix.js` | Component summaries or SDK summary references, groups, choices, example defaults, control/transition data and selection rules | Yes |
| `<Component>.js` | One example renderer per component family | Yes |
| `.cat` / `.cas` resources | Canonical template/script text, reused inline and when loaded | Yes |
| `resources.js` | Embedded copies of canonical `.cat`/`.cas` text for portable rendering | **No**, regenerate |
| `reference/components.js` | Native operation mapping, API variants, source forms, call/method/result explanations and ordering | Yes |
| `reference/properties.js` | Casai properties and amendments: requiredness, defaults, invocation, inheritance and adapted behavior | Yes |
| `reference/details.js` | Links to nested native data shapes and explanations for remaining undocumented members | Yes; fill gaps without replacing accurate native prose |
| `reference/concepts.js` | Shared explanations inside the matrix | Yes |
| `reference/api.js` | Pinned public type shapes and native JSDoc descriptions | **No**, regenerate |
| `reference/sdk-docs.js` | Opening descriptions extracted from the matching SDK documentation | **No**, regenerate |
| `reference/metadata.js` | Casai/dependency versions and repository URL for lightweight consumers | **No**, regenerate |
| `matrix.d.ts`, `reference.d.ts` | Consumer types for the catalog, selection helpers, reference and JSON exports | Yes; keep tests tied to the returned fields |
| `reference.js` | Generic resolver that joins the selected catalog entry, native inventory and local amendments | Only when the data contract needs to change |
| `package.json` | Private `@casai/matrix` entry points for the separate UI project's file/workspace dependency | Yes; no runtime dependencies |

Types determine which settings, methods and results exist. The configured component's types determine its accepted shape; a native documentation page does not add settings to Casai. Keep complete and streaming shapes separate. Config fragments list compatible alternatives, not one mixture of every component's properties.

Example controls choose teaching scenarios. They do not define API support: turning off `useTools` must not remove `tools` from the configuration reference. `render().configuration` names the factory and properties actually used by the displayed example. `describe()` describes the selected API independently of that example.

A choice's `properties` lists configuration fields to highlight; only fields present in the selected API are linked. `affectsReference` distinguishes API changes from teaching features and highlights. Keep the data defining that distinction current when adding choices, and update the public literal unions. Canonical reference IDs must exclude example-only features.

Use component `variants` for operation/result changes, including method selections. Primary-input overrides belong in `inputTypes` so script, function and loaded forms keep their correct source types. Method `settings: 'run'` references the existing named-call properties, with `omit` for irrelevant settings; do not duplicate their explanations. Add new renderers to the literal import registry in `matrix.js` so bundlers can discover them. Add canonical resources to the component's `resources` list and regenerate `resources.js`; consumers need no asset configuration. `inlineResource` identifies a standalone component's default source; `sourceDefault` collapses its redundant Default selector choice. Other selections read only their selected template or script.

`requires` maps a group to its allowed choices: any listed choice within a group, all specified groups together. An array of maps allows any alternative. `null` means no choice in that group. `excludes` lists conflicts. Use these data rules instead of component-name branches in the resolver. Keep one choice or none in each group; validate the requested selection at the render boundary. `getControls()` is the single UI model, with optional unavailable-choice reasons and change previews. Tolerant normalization is only for restored external selections. See the [integration contract](README.md) for these helpers and returned fields.

### What happened to topics.js?

The former `reference/topics.js` is now `reference/concepts.js`, exported as `concepts`. It contained locally written summaries based on the current README and inspected implementation, with a planned translation entry checked against the streaming plan. It was never an automatic extraction or a synchronized copy of README sections.

These explanations belong **inside the matrix**: context, inheritance, schemas, tools, history and similar shared behavior. Components reference the same entries by ID. They are not the future documentation topics after the matrix. Existing `link` values record the guide locations used to check them; update those links when the documentation is later reorganized. Keep detailed behavior in its canonical property or concept entry and refer to it elsewhere instead of repeating paragraphs.

## Reuse AI SDK documentation first

Use upstream wording verbatim whenever it accurately describes Casai. Do not paraphrase merely to give it a different voice. Keep local wording for actual differences and explanations the SDK does not provide.

The installed `ai` package contains its reference pages under `node_modules/ai/docs/07-reference/01-ai-sdk-core/`. `npm run docs:matrix` extracts their opening paragraphs, selected missing result descriptions and native JSDoc from the installed public declarations. It follows exported aliases and reuses builder parameter documentation for nested options. This pins the content to the same version as the code. Online pages are useful for reading and comparison, but can describe a newer release. Generation is offline and does not evaluate MDX or import the SDK runtime.

### Component descriptions: checked against ai@7.0.162

The SDK's short, action-first function descriptions are suitable for component descriptions. Use the matching operation's description, with small changes when a Casai family covers more than one operation.

| Component | SDK source | Current reuse |
| --- | --- | --- |
| LLMAgent | `generateText`, `streamText` | Verbatim; selected streaming form uses the streaming description. Structured output and continuation have their own reference entries. |
| ImageGenerator | `generateImage` | Verbatim; editing/media behavior belongs in its options and properties. |
| SpeechGenerator | `generateSpeech`, `experimental_streamSpeech` | Verbatim for each delivery form. |
| Transcriber | `transcribe`, `experimental_streamTranscribe` | Small family-summary change to include recordings and streams; streaming description verbatim. |
| Reranker | `rerank` | Verbatim. |
| Embedder | `embed`, `embedMany` | Small combined description for one or many texts, with a plain explanation of embeddings. |
| Decision | `experimental_decide` | Adapt the technical map/type wording to simple category, yes/no, score and location examples. |
| Translator | `experimental_streamTranslate` | Streaming description verbatim. The planned complete adapter needs local wording and its planned notice. |
| VoiceSessionSetup | Native realtime setup/tool methods | Local summary: it combines several methods and application responsibilities, not one SDK operation. |
| Config, Context, Template, Script, Function | No equivalent AI SDK component | Local descriptions; use Cascada's terminology where it owns execution. |

For example, LLMAgent reuses the `generateText` summary: “Generates text and calls tools for a given prompt using a language model.” The [SDK reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) then uses a short example, import, parameters and returns. Follow that direct style; don't describe model execution as merely asking a model to produce something.

### Configuration, methods and results

The default is native description reuse, not a locally rewritten catalog. Unchanged settings such as model, headers, provider options, sampling, retry controls, token usage and native result methods retain their upstream descriptions. The generator also inspects the corresponding native operation's settings, so redeclared Casai types do not erase the original documentation.

Keep the native type/description/source in `upstream`. Put local behavior in `required`, `default`, `locations`, `override`, `inheritance`, `notes` and `adaptation`; replace `description` only when the native explanation would be misleading. `descriptionOrigin` identifies the displayed prose's owner. For example, headers retain the SDK's HTTP-provider qualification, while Casai's invocation-location rules are separate fields.

Nested configuration data belongs in the generator's `detailAliases` inventory, linked through property `detail` entries or `reference/details.js`. Keep each native union branch separate. Add local member descriptions only when native JSDoc or extracted reference prose is missing. Do not expand model implementations, arbitrary application schemas or provider option dictionaries into an invented fixed option list. Rendering options inherited from Cascada's configure() type need special care: Casai creates an environment directly, so loader/Express setup flags must not be described as configuring those integrations through renderOptions.

Write or adapt the explanation for these boundaries:

- Casai context/default merging, private bindings and `inputSchema` are not native prompt or tool-context settings.
- Source modifiers change how a primary property is prepared. Positional LLMAgent message arrays are history; configured/named prompt messages are new content.
- Embedder's `input` maps to native `value` or `values`. Image media defaults and invocation precedence have additional Casai rules.
- `prepareCall`, the extra `prepareStep` arguments, `.run()`, `resume()` and bound-tool helpers need their actual Casai signatures.
- Tool projections may differ from ordinary native results. Template/Script/Function tools do not have fabricated Agent result envelopes.
- Complete and streaming audio have different input/output contracts. Planned Translator completion is not an existing SDK complete-translation API.

Do not import whole SDK parameter tables as Casai configuration. A useful upstream sentence can coexist with an inapplicable field, signature or default. For example, `ToolLoopAgent` defaults do not describe Casai's current core-call defaults. MDX tables sometimes lag declarations; use inspected types and runtime behavior to resolve discrepancies, and make the smallest documented correction. Do not build a second SDK explanation when an accurate native passage already exists.

Longer native guides, provider capability tables and troubleshooting pages should usually be linked. If a self-contained explanation is needed, reuse a relevant licensed passage and record its pinned source and local changes. Provider availability and formats still need provider-specific evidence; a general SDK example is not a universal capability promise.

### Attribution

Retain source paths, versions and original prose. Local declarations use file paths without unstable line numbers; dependency links retain their pinned version and line. `sdk-docs.js` records the pinned source and public documentation link; catalog summaries mark verbatim/adapted reuse. The extractor joins wrapped lines and resolves root-relative SDK links without changing wording.

Generated metadata includes the root Casai version. The publishing build supplies its exact checkout revision to `sourceUrl()` and publishes that revision with its version information; do not put moving HEAD into a checked-in freshness snapshot.

Distribute [THIRD_PARTY.md](reference/THIRD_PARTY.md) and the included Apache-2.0/BSD-2-Clause license files with copied data. Record modifications and check for changed notices on upgrades. This reuse covers the inspected licensed SDK repository/package text, not a blanket permission to copy unrelated provider sites, branding or website assets.

## Writing and formatting

Follow the SDK's reference style throughout the matrix: a short action-first summary, a small useful example, import/signature, parameters, returns, then relevant notes and links. The matrix's Info/Example/Config views can present the same material in a different layout; layout belongs to the other project.

Use plain words, Markdown paragraphs, backticks for API names, fenced TypeScript for examples and explicit file names for secondary sources. Keep a property name, type, requiredness, description and default easy to scan. Explain conditional requirements next to the property. Preserve useful native detail instead of replacing it with a vague one-line paraphrase. Put scenario explanations in code comments.

Keep reader captions separate from model-facing `toolDescription`. Describe the tool's actual task and accepted input; a fixed-request tool must not imply it accepts an arbitrary question. Retain the complete callable example function and its explicit application dependencies. Property records keep the complete `type` alongside a compact `displayType`; never replace the underlying contract with its abbreviated label. User-facing notices link to available guide content, not internal implementation plans.

Avoid HTML or SDK website-specific MDX components in authored matrix data. Express notes, sections and links as data with Markdown text so another publisher can render them consistently. Preserve experimental and planned notices in every output. Do not use a source link as a substitute for documenting Casai's actual difference.

## Updating the matrix

1. Inspect the changed public API and its native owner. Check the installed declaration, implementation and relevant tests when a description or contract is uncertain. Do not infer behavior from example toggles or an external review alone.
2. Run `npm run docs:matrix` after API/dependency, package metadata or canonical resource changes. Review added/removed fields, types, native prose, operation summaries and embedded resources. Generated files are checked in so consumers need no compiler or installed SDK. For resource-only edits, `node scripts/update-matrix-resources.mjs` refreshes just that module.
3. Update only affected catalog rules, component mappings, local amendments and shared concepts. Remove a local paraphrase when the upstream wording now fits. Keep planned and implemented forms distinct.
4. Update the family renderer and canonical resources if the example needs to change. Preserve the scenario, names and code order across toggles. Reuse the same `.cat`/`.cas` text for inline and loaded forms; do not add files for every combination.
5. Run `npm run test:matrix`. It runs the generator's `--check` mode to compare the extracted contract and prose, then checks registry integrity, complete configuration inventories, descriptions for displayed nested/method/result fields, declared output fields, reference applicability, example metadata, source transitions/resource reads, consumer types and mock execution. It also checks linked package imports/resources, executes every selection from a browser-targeted bundle and compiles representative actual exports against the consumer declarations. Unrelated implementation comments and local line shifts do not require regeneration; changed public types or documented behavior do. Planned snippets get syntax/shared-source checks, not a claim of working future APIs. No provider calls are made.
6. Read the affected summaries, property explanations and examples as a user would. Check that they explain the task and the actual call clearly. Inspect representative data with `npm run --silent docs:matrix:export -- Component choiceIds...` to verify the handoff, including relevant default, variant and prepared/tool forms. A valid JSON export does not establish good documentation.

The JavaScript authoring modules and matrix tooling participate in `npm run lint`; generated snapshots are excluded. Mock tool arguments belong in test fixtures, never in a special user-facing prompt format. Generation starts with a clean workspace-local `.cache/matrix` directory.

Keep public field changes synchronized with the `.d.ts` declarations, tests and integration README. Coordinate breaking changes with the consuming project and change the JSON `schemaVersion` when breaking an already published format.

The generator uses the repository's TS6 compiler API as tooling; consumer examples use TS7. Test the selected behavior and its interactions, not just snapshot equality. If the upstream docs layout changes, update the small extractor and review the resulting prose; do not silently accept empty descriptions.

## Portable data and future publishing

`describe()` returns serializable reference data; `render()` returns the selected code files. The [JSON export command](README.md#portable-data) exposes them without browser interaction or model execution. This is an integration/export format, not the reader-facing documentation. The catalog supplies stable component/choice IDs and rules; reference entries supply property IDs, source attribution, status and types. Keep those identifiers stable when improving prose.

The separate publishing project should present readable documentation pages and the interactive matrix from these records, and additionally expose Markdown/JSON for agents, bots and scrapers. Use clear navigation and stable links; preserve version information and complete reference sections in every format. Do not create a separate bot-only documentation structure or require readers to use exports. Generated copies are disposable output; corrections belong here. No full documentation generator, intro or topic-page authoring is part of the current matrix work.
