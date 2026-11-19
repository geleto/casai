# Maintaining the matrix

The matrix is the canonical component reference. This repository owns its content, shared introduction, examples, data and selection rules. The separate website/documentation project owns the UI and publishing. The full and simplified matrices share this data through the profiles in `profiles.js`. The [unified documentation plan](../documentation-plan.md) also places all explanatory sections after the matrix in one authored `documentation.md` file here. These ownership rules apply during that migration; do not create separate topic pages or another authored guide.

Keep profile policy separate from API applicability. Curate the simple profile's allowed choices centrally, reuse the existing renderers, and keep all transitions within the selected profile. Use short descriptions for the homepage and preserve experimental/work-in-progress notices. Do not fork examples, weaken full-reference rules or import the full API snapshot just to render a simplified example. Profile tests walk every reachable simplified selection and compare its example to the full renderer.

Write for people first. Say Cascada Template or Cascada Script, and explain input handling with concrete values such as text, messages, images or files. Keep each source-mode summary to one short sentence. For standalone Template and Script, describe the property value (text, code or file name); for other components, explain how the source prepares input. Set component-specific wording in `reference/components.js` through `sourceDescriptions`, keyed by source mode. Omit filler such as "as-is" and comparisons with unselected modes. Put format requirements and meaningful limitations in the property details. The matrix will likely be the main way readers explore Casai. The full documentation must also be a normal, readable guide with clear navigation, explanations, examples and practical topics. Machine-readable formats are additional ways to access that same content, not the organizing principle for the documentation.

## Publications

| Publication | Content |
| --- | --- |
| Homepage | Short component descriptions and examples through the simple profile, with optional customization |
| Documentation hub | Website-owned index of tutorials, articles, examples and Cascada documentation at `/documentation/` |
| Unified documentation | Short expandable introduction, interactive matrix, compact workflow-article links, then `documentation.md` rendered on the same page at `/documentation/reference/`, beginning with Build your first workflow |
| Blog articles | Extended walkthroughs authored once in `articles/*.md`, listed in `articles/index.json`, and published under `/posts/` with links immediately after every matrix |
| Complete Markdown download | Generated introduction, chapters and complete reference with shared content included once |
| Read all HTML | Static rendering of the complete Markdown, with every chapter and API form accessible without JavaScript |
| Per-form views and downloads | Existing URLs select a view of one shared website page; the browser generates individual Markdown and JSON downloads from the same data |

These publications reuse the same data. The introduction, component reference and chapters have distinct responsibilities. Short summaries can repeat an idea for context; full explanations have one authored home. The matrix remains the source of API reference content. Copying or rendering it at build time is fine; maintaining another authored reference is not.

Single page means all documentation is accessible within one HTML page, including through matrix buttons, checkboxes and tabs. Every API form need not be visible simultaneously. Present selected content as readable descriptions, signatures, property entries and examples; readers should not need to understand the internal data model or read JSON. Preserve static access and existing reference links alongside the interactive experience.

Render the chapters statically on the unified entry page. Direct form URLs reuse that physical page and the shared browser renderer; do not generate a page or data file for every selection. Existing export URLs may redirect to browser-generated downloads. Keep one complete Markdown file and its Read all HTML independent of selection state and linked prominently, with every form accessible without JavaScript through the forms index. Read all HTML is derived directly from that Markdown; it does not require matrix interaction.

The chapters explain tasks and cross-component workflows and link to matrix property/method entries. Review both README guides and existing concepts when migrating this material, preserve example-check coverage and development status, and replace old guide links before retiring their sections. Keep working recipes in the documentation until expanded blog articles are ready; article writing does not block retiring the parallel guides.

`reference/concepts.js` retains short contextual reference notes and chapter links shared by applicable components. Detailed teaching belongs in `documentation.md`; API-specific rules remain in the reference. Move full explanations before shortening their old copies. The complete download includes each full chapter and shared reference note once, with links from the relevant components.

The authored chapter Markdown uses working HTTPS component links and local links to explicit `guide-` HTML anchors before its headings, with matching `id` and GitHub-supported `name` attributes. Keep those targets stable when titles change. The website enhances recognized reference links for in-page navigation, and the complete export resolves them to local anchors. Existing logical links in JavaScript data remain supported. Use the existing snapshot pipeline for all Casai documentation content; the website reuses its shared renderer, derives chapter navigation from the explicit IDs and avoids duplicate IDs without changing matrix or Cascada anchors.

The plan specifies a server-side legacy-path redirect and publication sequencing. Include tracked redirect configuration and catalog-derived grouped form rewrites in the site build, activate them only after the shared destinations exist, and verify them on the actual host. Publish new README/GitHub links only after their destinations work; local commits need not wait. Full-document HTML identifies its generated Markdown source and alternate representation. Interactive form URLs share the documentation entry's canonical URL; Read all retains its own canonical and links back to the interactive page. Keep the same routing for people and bots.

The website publisher must implement the plan's ordered phases: assets, then pages, then the root `.htaccess`, with the same ordering shown in dry runs. Guard that routing file against unreviewed remote changes, including first-use/missing-baseline cases. Preserve the existing no-deletion policy and verify legacy redirects on every release; retained old pages returning HTTP 200 do not prove the migration still works. Any remote cleanup remains separate from this documentation migration.

## Content ownership

Input summaries describe property values, not commands: “The text or array of texts to embed.” Loaded-text descriptions must explain what the file contains and what it is for; author `sourceDescriptions['text-name']` for each component that supports it. Do not generate circular wording such as “a file to use as state.”

Use `sourceModes` and `toolOnly` in shared property metadata for settings whose behavior depends on the selected source or tool form. Check the owning renderer or execution path before adding a restriction. Keep reusable Config fragments broad, and retain common settings independently of example toggles. Required settings belong to the `essential` section; its stable ID is retained for existing links.

All modes are selected only with factory/Config modifiers. `promptType`, `streaming` and `asTool` are not public configuration properties, including when explicitly undefined. Internal structural metadata preserves inheritance and configuration spreads and must not appear in the authored property inventory. Config supports every source selector followed by compatible `.asTool` or `.asStream`; it remains an incomplete fragment. No streaming source form is tool-compatible on any component or Config. Enforce that rule consistently in controls, supported-source metadata and modifier methods; preserve ordinary prepared tools and the separate ability to call registered tools. Keep same-named application data valid. Invocation-only fields such as `abortSignal` and `messageHistory` must not acquire a construction location. `_toolOptions` is injected context metadata, not a constructor setting.

**Plan synchronization (2026-11-14):** update the matrix whenever an API plan decision changes. Document the selected contract immediately and attach a concise `workInProgress` marker for each pending change; do not wait for production implementation or publish stale alternatives as the target API. Markers are authored centrally in `matrix.js`, exposed on the catalog, references and examples, and included in existing notice/explanation lists. Remove each marker in the change that implements and verifies its scope. Keep experimental SDK notices independent. This supersedes the earlier no-status-banner instruction.

Phase 6 A/B correctness corrections now have maintained runtime, type, request-boundary and native/browser regressions. The selected C/D follow-ups keep scoped notices; their new input/browser conveniences remain planned. Remove each notice only after its implementation and relevant acceptance, not after a documentation review. Later-phase notices remain separate.

**Configured loaded-audio tools (2026-11-15):** finished `.loadsAudio.asTool` requires configured audio, possibly inherited, using the same source-required rule as other loaded tools. Config fragments stay incomplete. The model cannot supply a resource override; declared context remains data. Examples configure the source privately and use a closed empty schema when no public data is needed. Ordinary Transcriber URL tools retain their SDK downloader; dynamic native preparation uses an explicit Function/Script workflow. Keep construction-required metadata and renderer configuration aligned with this distinction.

**Phase 6 signature clarification (2026-11-15):** describe the selected preservation/target policy now, and finalize exact new helper/file-target signatures with their implementation. Extract those declarations and compile their examples before clearing the corresponding marker. Do not invent callable placeholders or require a separate pre-implementation signature approval to fill the reference. Existing selected modifier, operation and source contracts remain synchronized throughout.

**Native media defaults (2026-11-15, latest):** tool formatters remain optional. Speech retains native media output; Translator sends translated text by default and retains audio in the execution result. LLMAgent tools keep their completed text/structured value, while ordinary calls retain native output/files/toolResults. Automatic generated-media schema declarations and assembly are deferred. Document explicit Function-tool media composition through native `toModelOutput`, preserving application-defined results and formatter replacement. Remove the deferred feature's work-in-progress marker and acceptance requirements; keep current-source coverage honest.

**Multimodal schemas and tools (2026-11-15):** document image/audio/video property declarations and both directions of tool traffic in the shared `multimodal-tools` concept, linked from applicable component references. Explain schema input/output roles, JSON encoding/MIME metadata, host File, URL/reference and native content representations separately. Show actual `toModelOutput` mapping, mixed media/text, native generator versus preparer tools, and known format/adapter limits. An annotation or multimodal model label is not proof of attachment transport. Reuse native schemas and SDK content types; maintain executable guide examples and require actual adapter serialization plus paid receiving-model checks before claiming a new media route works. No duplicate media schema language or capability catalog is implied.

| Source | Owns | Edit by hand? |
| --- | --- | --- |
| `matrix.js` | Component short/long descriptions and SDK sources, groups, choices, example defaults, control/transition data and selection rules | Yes |
| `introduction.js` | Short shared introduction and expandable principles, with links to full chapters; small teaching examples only where useful | Yes |
| `documentation.md` | Single authored source for all post-matrix chapters, core explanations and links to extended walkthroughs | Yes |
| `articles/*.md`, `articles/index.json` | Canonical blog walkthroughs, checked examples and article metadata; the website owns layout and publication | Yes |
| `<Component>.js` | One example renderer per component family | Yes |
| `.cat` / `.cas` / `.txt` resources | Canonical template, script and plain text files | Yes |
| `resources.js` | Embedded copies of canonical `.cat`/`.cas`/`.txt` text for portable rendering | **No**, regenerate |
| `reference/components.js` | Native operation mapping, API variants and their long descriptions, source forms, call/method/result explanations and ordering | Yes |
| `reference/properties.js` | Casai properties and amendments: requiredness, defaults, invocation, inheritance and adapted behavior | Yes |
| `reference/details.js` | Links to nested native data shapes and explanations for remaining undocumented members | Yes; fill gaps without replacing accurate native prose |
| `reference/concepts.js` | Brief contextual reference notes shared by applicable components and links to full chapters | Yes |
| `reference/api.js` | Pinned public type shapes and native JSDoc descriptions | **No**, regenerate |
| `reference/sdk-docs.js` | Opening descriptions extracted from the matching SDK documentation | **No**, regenerate |
| `reference/metadata.js` | Casai/dependency versions and repository URL for lightweight consumers | **No**, regenerate |
| `profiles.js` | Full and simplified catalog/control policies over the shared examples and selection rules | Yes; keep presentation policy separate from API applicability |
| `matrix.d.ts`, `profiles.d.ts`, `reference.d.ts` | Consumer types for the catalog, profiles, selection helpers, reference and JSON exports | Yes; keep tests tied to the returned fields |
| `reference.js` | Generic resolver that joins the selected catalog entry, native inventory and local amendments | Only when the data contract needs to change |
| `package.json` | Private `@casai/matrix` entry points for the separate UI project's file/workspace dependency | Yes; no runtime dependencies |

Types determine which settings, methods and results exist. For the audio API, `scripts/matrix-audio-contracts.mjs` selects production `ComponentConfig` and factory `Types` declarations for each source/delivery/native-operation alternative. It invents no settings or result shapes; regenerate the reference after changing those production declarations. Keep native request alternatives explicit and local result adaptations separate. The configured component's types determine its accepted shape; a native documentation page does not add settings to Casai. Keep complete and streaming shapes separate. Config fragments list compatible alternatives, not one mixture of every component's properties.

Example controls choose teaching scenarios. They do not define API support: turning off `useTools` must not remove `tools` from the configuration reference. `render().configuration` names the factory and properties actually used by the displayed example. `describe()` describes the selected API independently of that example.

A choice's `properties` lists configuration fields to highlight; only fields present in the selected API are linked. `affectsReference` distinguishes API changes from teaching features and highlights. Keep the data defining that distinction current when adding choices, and update the public literal unions. Canonical reference IDs must exclude example-only features.

Use optional `shortDescription` on choices, `defaultControl` and the Loads control for concise inline help. Preserve the complete explanation in `description`. Keep both descriptions accurate when a component overrides shared choice wording; the website falls back to `description` when no short version is supplied.

Link configuration terms in short descriptions with inline Markdown, for example `[tools](property:tools)`. The property must exist after enabling the control through its transition. Keep these targets in the canonical data; consumers resolve the component, selection and URL without guessing links from words.

Invocation links use `method:call` and `method:run`. Add `?option=run` to select the named-call example. Keep method targets and optional choice IDs valid for every component sharing the description.

Use component `variants` for operation/result changes, including method selections. Primary-input overrides belong in `inputTypes` so script, function and loaded forms keep their correct source types. Method `settings: 'run'` references the existing named-call properties, with `omit` for irrelevant settings; do not duplicate their explanations. Add new renderers to the literal import registry in `matrix.js` so bundlers can discover them. Add canonical resources to the component's `resources` list and regenerate `resources.js`; consumers need no asset configuration. `inlineResource` identifies a standalone component's default source; `sourceDefault` collapses its redundant Default selector choice. Other selections read only their selected text, template or script file.

`requires` maps a group to its allowed choices: any listed choice within a group, all specified groups together. An array of maps allows any alternative. `null` means no choice in that group. `excludes` lists conflicts. Use these data rules instead of component-name branches in the resolver. Keep one choice or none in each group; validate the requested selection at the render boundary. `getControls()` is the single UI model, with optional unavailable-choice reasons and change previews. Tolerant normalization is only for restored external selections. See the [integration contract](README.md) for these helpers and returned fields.

### What happened to topics.js?

The former `reference/topics.js` is now `reference/concepts.js`, exported as `concepts`. It contained locally written summaries based on the current README and inspected implementation, with audio contracts checked against the selected audio design. It was never an automatic extraction or a synchronized copy of README sections.

These explanations belong **inside the matrix**: context, inheritance, schemas, tools, history and similar shared behavior. Components reference the same entries by ID. Full teaching workflows belong in `documentation.md`; `link` values point to their stable public chapter anchors. Keep API-specific qualifications in their canonical property or concept entry, including the detailed media ownership and format restrictions, and link to them instead of copying those inventories into chapters.

## Reuse AI SDK documentation first

Reuse upstream wording for detailed API documentation whenever it accurately describes Casai. Keep local wording for actual differences and explanations the SDK does not provide. Short component summaries also serve the homepage: use concise, action-first language that explains the capability without requiring knowledge of the SDK, and retain the original SDK text and attribution in `shortDescriptionSource`.

The installed `ai` package contains its reference pages under `node_modules/ai/docs/07-reference/01-ai-sdk-core/`. `npm run docs:matrix` extracts their opening paragraphs, selected missing result descriptions and native JSDoc from the installed public declarations. It follows exported aliases and reuses builder parameter documentation for nested options. This pins the content to the same version as the code. Online pages are useful for reading and comparison, but can describe a newer release. Generation is offline and does not evaluate MDX or import the SDK runtime.

### Component descriptions: checked against ai@7.0.162

Use the matching SDK operation to check each component summary. Adapt the summary for a concise homepage listing while retaining important capabilities and distinctions. Full descriptions explain model-specific limits, input and output details. Keep streaming-form summaries specific to live delivery.

| Component | SDK source | Current reuse |
| --- | --- | --- |
| LLMAgent | `generateText`, `streamText` | Adapted to include structured answers and tools; selected streaming form uses the streaming description. |
| ImageGenerator | `generateImage` | Adapted to include generation and editing; model-specific limits stay in the full reference. |
| SpeechGenerator | `generateSpeech`, `experimental_streamSpeech` | Concise text-to-speech summary; selected streaming form keeps its native description. |
| Transcriber | `transcribe`, `experimental_streamTranscribe` | Concise family summary includes recordings and streams; streaming description verbatim. |
| Reranker | `rerank` | Adapted to explain ranking documents against a query. |
| Embedder | `embed`, `embedMany` | Small combined description for one or many texts, with a plain explanation of embeddings. |
| Decision | `experimental_decide` | Adapt the technical map/type wording to simple category, yes/no, score and location examples. |
| Translator | `experimental_streamTranslate` | Streaming description verbatim. The completed adapter needs local wording for its collected result. |
| VoiceAgentBackend | Native realtime setup/tool methods | Local summary: it combines several methods and application responsibilities, not one SDK operation. |
| VoiceAgentClient | Public native realtime session class | Local factory/subscription summary; options, state and controls use pinned SDK types and realtime UI reference prose. No React dependency or hook contract is implied. |
| VideoGenerator | `experimental_generateVideo` | Native options/results and pinned prompt-field prose; Casai adds common preparation/calls/tools and preserves SDK completion ownership. |
| Config, Context, Template, Script, Function | No equivalent AI SDK component | Local descriptions; use Cascada's terminology where it owns execution. |

For example, LLMAgent's summary is “Generate text or structured answers, and call tools with a language model.” Its attribution retains the original `generateText` description. The [SDK reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) follows its summary with a short example, import, parameters and returns. Follow that direct style.

### Configuration, methods and results

Use each form’s Return tab for field types, final-value availability and tool projections. The first paragraph of `resultDescription` and `toolResult` also appears in the compact Return row. Put longer contract details in subsequent paragraphs. Forms with simple application values keep the complete explanation in the row. In the chapters, keep comparisons across components and worked examples of consuming results, handling pauses or owning a stream. Link field lookups to the selected form with `?view=return#return`.

The default is native description reuse, not a locally rewritten catalog. Unchanged settings such as model, headers, provider options, sampling, retry controls, token usage and native result methods retain their upstream descriptions. The generator also inspects the corresponding native operation's settings, so redeclared Casai types do not erase the original documentation.

Keep the native type/description/source in `upstream`. Put local behavior in `required`, `default`, `locations`, `override`, `inheritance`, `notes` and `adaptation`; replace `description` only when the native explanation would be misleading. `descriptionOrigin` identifies the displayed prose's owner. For example, headers retain the SDK's HTTP-provider qualification, while Casai's invocation-location rules are separate fields.

When a field spans native operations, use its component-level `nativeDocs` to select the native description that covers the accepted values. For example, ordinary speech accepts streaming text inputs as well as strings. Keep input delivery, native operation and result delivery distinct in summaries, controls and property notes. Check shared amendments against non-audio owners too, and keep Config locations construction-only. Accessing a native audio result promise can claim its stream before it is awaited; document property access and consumption in that order.

Nested configuration data belongs in the generator's `detailAliases` inventory, linked through property `detail` entries or `reference/details.js`. Keep each native union branch separate. Add local member descriptions only when native JSDoc or extracted reference prose is missing. Do not expand model implementations, arbitrary application schemas or provider option dictionaries into an invented fixed option list. Rendering options inherited from Cascada's configure() type need special care: Casai creates an environment directly, so loader/Express setup flags must not be described as configuring those integrations through renderOptions.

Write or adapt the explanation for these boundaries:

- Casai context/default merging, private bindings and `inputSchema` are not native prompt or tool-context settings.
- Source modifiers change how a primary property is prepared. Positional LLMAgent message arrays are history; configured/named prompt messages are new content.
- Embedder's `input` maps to native `value` or `values`. Image media defaults and invocation precedence have additional Casai rules.
- `prepareCall`, the extra `prepareStep` arguments, `.run()`, `resume()` and bound-tool helpers need their actual Casai signatures.
- Tool projections may differ from ordinary native results. Template/Script/Function tools do not have fabricated Agent result envelopes.
- Complete and streaming audio have different input/output contracts. Completed Translator is a local adapter over one native streaming execution.

Do not import whole SDK parameter tables as Casai configuration. A useful upstream sentence can coexist with an inapplicable field, signature or default. For example, `ToolLoopAgent` defaults do not describe Casai's current core-call defaults. MDX tables sometimes lag declarations; use inspected types and runtime behavior to resolve discrepancies, and make the smallest documented correction. Do not build a second SDK explanation when an accurate native passage already exists.

Longer native guides, provider capability tables and troubleshooting pages should usually be linked. If a self-contained explanation is needed, reuse a relevant licensed passage and record its pinned source and local changes. Provider availability and formats still need provider-specific evidence; a general SDK example is not a universal capability promise.

### Attribution

Retain source paths, versions and original prose. Local declarations use file paths without unstable line numbers; dependency links retain their pinned version and line. `sdk-docs.js` records the pinned source and public documentation link; catalog summaries mark verbatim/adapted reuse. The extractor joins wrapped lines and resolves root-relative SDK links without changing wording.

Generated metadata includes the root Casai version. The publishing build supplies its exact checkout revision to `sourceUrl()` and publishes that revision with its version information; do not put moving HEAD into a checked-in freshness snapshot.

Distribute [THIRD_PARTY.md](reference/THIRD_PARTY.md) and the included Apache-2.0/BSD-2-Clause license files with copied data. Record modifications and check for changed notices on upgrades. This reuse covers the inspected licensed SDK repository/package text, not a blanket permission to copy unrelated provider sites, branding or website assets.

## Writing and formatting

Follow the SDK's reference style throughout the matrix: a short action-first summary, a small useful example, import/signature, parameters, returns, then relevant notes and links. The matrix's Info/Example/Config views can present the same material in a different layout; layout belongs to the other project.

Keep the concise component summary in `shortDescription`, shared by the homepage and quick reference. Preserve original SDK prose in `shortDescriptionSource` when adapting it. `description` contains a few plain Markdown paragraphs explaining what the component does, when it is useful, its inputs and its result. Keep detailed settings in the property reference. Adapt the installed SDK guides where they fit and retain their pinned locations in `descriptionSources`; local additions explain Casai's behavior. Streaming variants may override the full description in `reference/components.js`, with their native reference page as the source. Review these manually authored adaptations on SDK changes; the generator does not rewrite them. Keep work-in-progress markers separate from the selected API prose and preserve experimental SDK qualifications.

Use plain words, Markdown paragraphs, backticks for API names, fenced TypeScript for examples and explicit file names for secondary sources. Keep a property name, type, requiredness, description and default easy to scan. Explain conditional requirements next to the property. Preserve useful native detail instead of replacing it with a vague one-line paraphrase. Put scenario explanations in code comments.

Keep reader captions separate from model-facing `toolDescription`. Describe the tool's actual task and accepted input; a fixed-request tool must not imply it accepts an arbitrary question. Retain the complete callable example function and its explicit application dependencies. Property records keep the complete `type` alongside a compact `displayType`; never replace the underlying contract with its abbreviated label. `reference/type-display.js` omits outer `undefined` only for optional properties; nested values, callback returns, `null`, and required value unions remain meaningful. Consumers must make the exact type available when the label is abbreviated. User-facing notices link to available guide content, not internal implementation plans.

Give each exported example function a descriptive task name, stable across its options. Feed ready-made strings directly to plain operations; do not build fixed sample prompts with JavaScript interpolation or a redundant `input` object. Pass single-use context objects at the call site. Keep dynamic values where they demonstrate the selected template/script/function source, real external dependencies, or shared input across continuation calls.

Explain unfamiliar type aliases through the shared `reference/type-reference.js` vocabulary, which supplies concrete value shapes and examples in `typeDescription`. Expand short aliases in `displayType` when the expansion is clearer; verify them against the owning declaration. Keep exact `type` values intact. Do not leave readers to guess what names such as PromptValue, DataContent or PreparedContext mean. Source-mode prose belongs in `reference/sources.js`: say what the named input contains, how the context object is used, and what value the component receives. Keep structured message, image and decision rendering rules in each component's `templateNotes`.

Avoid HTML or SDK website-specific MDX components in authored matrix data. Express notes, sections and links as data with Markdown text so another publisher can render them consistently. Preserve experimental SDK notices in every output. Do not use a source link as a substitute for documenting Casai's actual difference.

## Updating the matrix

1. Inspect the changed public API and its native owner. Check the installed declaration, implementation and relevant tests when a description or contract is uncertain. Do not infer behavior from example toggles or an external review alone.
2. Run `npm run docs:matrix` after API/dependency, package metadata or canonical resource changes. Review added/removed fields, types, native prose, operation summaries and embedded resources. Generated files are checked in so consumers need no compiler or installed SDK. For resource-only edits, `node scripts/update-matrix-resources.mjs` refreshes just that module.
3. Update only affected catalog rules, component mappings, local amendments and shared concepts. Remove a local paraphrase when the upstream wording now fits. Keep completed and incremental forms distinct.
4. Update the family renderer and canonical resources if the example needs to change. Preserve the scenario, names and code order across toggles. Reuse the same `.cat`/`.cas` text for inline and loaded forms; do not add files for every combination.
5. Run `npm run test:matrix`. It runs the generator's `--check` mode to compare the extracted contract and prose, then checks registry integrity, complete configuration inventories, descriptions for displayed nested/method/result fields, declared output fields, reference applicability, example metadata, source transitions/resource reads, consumer types and mock execution. It also checks linked package imports/resources, executes every selection from a browser-targeted bundle and compiles representative actual exports against the consumer declarations. Unrelated implementation comments and local line shifts do not require regeneration; changed public types or documented behavior do. The private tests/fixtures/matrix-availability.mjs coverage map limits source type-checking and mock execution to implemented examples; every selection gets syntax/data/shared-source checks. Remove each exclusion as its implementation lands. Never fabricate a runtime or declaration shim to claim execution coverage. No provider calls are made.
6. Read the affected summaries, property explanations and examples as a user would. Check that they explain the task and the actual call clearly. Inspect representative data with `npm run --silent docs:matrix:export -- Component choiceIds...` to verify the handoff, including relevant default, variant and prepared/tool forms. A valid JSON export does not establish good documentation.

The JavaScript authoring modules and matrix tooling participate in `npm run lint`; generated snapshots are excluded. Mock tool arguments belong in test fixtures, never in a special user-facing prompt format. Generation starts with a clean workspace-local `.cache/matrix` directory.

Keep public field changes synchronized with the `.d.ts` declarations, tests and integration README. Coordinate breaking changes with the consuming project and change the JSON `schemaVersion` when breaking an already published format.

The generator uses the repository's TS6 compiler API as tooling; consumer examples use TS7. Test the selected behavior and its interactions, not just snapshot equality. If the upstream docs layout changes, update the small extractor and review the resulting prose; do not silently accept empty descriptions.

## Portable data and future publishing

`describe()` returns serializable reference data; `render()` returns the selected code files. The [JSON export command](README.md#portable-data) exposes them without browser interaction or model execution. This is an integration/export format, not the reader-facing documentation. The catalog supplies stable component/choice IDs and rules; reference entries supply property IDs, source attribution and types. Keep those identifiers stable when improving prose.

The separate publishing project renders these records and `documentation.md` into the unified page, the shared chapter fragment, the complete Markdown and Read all HTML. Preserve stable links, version information and complete reference sections in every format. Do not create a separate bot-only documentation structure or require readers to use exports. Generated copies are disposable output; corrections belong here.

## Checking chapter examples

Mark every TypeScript example in `documentation.md` and `articles/*.md` with a unique `typecheck` name and add its application dependencies to `tests/fixtures/readme2-examples.cjs`. The historical command/cache names remain for compatibility; `documentation-sources.cjs` reads the canonical chapters and every article in the catalog. The checker also verifies the README's shared example. Former examples that no longer need a second public explanation remain in `tests/fixtures/documentation-regressions.md` as consumer regressions. Do not remove their coverage merely to shorten the documentation.

Keep essential behavior and previous `guide-` anchors in the reference when moving a walkthrough to an article. Replace the extended example with a short explanation and a working HTTPS article link. The complete documentation download retains those explanations and links; blog articles are additional reading. Author article prose and code here so they remain checked without requiring a sibling website checkout. The website renders the synchronized Markdown into its existing blog, feed and sitemap; do not maintain another authored copy there.

Future examples have both a visible work-in-progress notice and an inventoried `typecheck-skip` marker. `npm run test:checks` compiles the current authored Cascada workflow sources and exercises the first workflow, component replacement, revision limits and concurrent retrieval without provider calls. `npm run test:types` preserves source, emitted-consumer and exact-optional checks for the extracted snippets. Update the snapshot through the website's `matrix:sync`; do not edit its copy.
