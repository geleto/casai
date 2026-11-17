# Unified Casai documentation

Implementation plan agreed in the homepage/documentation discussion and
clarified after review on 2026-11-17. The matching scope and ownership rules
in `docs/matrix/MAINTENANCE.md` apply during the migration as well as after it.

Local implementation and content destinations are recorded in the
[migration report](documentation-migration.md). Deployment and public-release
verification remain separate from the local implementation.

## Intended result

One continuous documentation page contains the existing introduction and
expandable principles, the component matrix, then the explanatory material
currently spread across the README guides. Readers can learn Casai or look
up a component without choosing between parallel manuals.

Single page means all of this information is accessible within one HTML
page, including through component buttons, checkboxes and tabs. It does
not require every API variant to be visible simultaneously. Existing
per-form URLs, history updates and static exports are compatible with this
experience; changing them all to query parameters is not a requirement.

Keep `/documentation/` as the resource hub for tutorials, articles, examples
and Cascada documentation. Publish the unified documentation at
`/documentation/reference/`, retaining existing quick-reference links as
compatible aliases or redirects.

All explanatory sections after the matrix live in **one authored Markdown
file in this repository**, `docs/matrix/documentation.md`. The website
renders it below the matrix. This file is distinct from the complete
generated Markdown download, which also includes the introduction and
component reference.

## Source ownership

| Content | Canonical source |
| --- | --- |
| Short introduction and expandable principles | `docs/matrix/introduction.js` |
| Component descriptions, API information, examples and status notices | Existing `docs/matrix` modules and resources |
| Brief contextual reference notes and links to detailed chapters | `docs/matrix/reference/concepts.js` |
| All explanatory sections after the matrix | `docs/matrix/documentation.md` |
| Site layout, navigation and presentation | Sibling `cascada.dev` website repository |
| Blog articles | Canonical Markdown and checked examples in `docs/matrix/articles/`; blog presentation and URLs in the website repository |
| Complete documentation download | Generated from the canonical sources above |
| Repository introduction | A shortened `README.md` using the homepage's message and shared examples |

The website continues to consume a verified snapshot through `matrix:sync`
and `matrix:check`. Do not maintain a second authored copy of the chapters
in the website repository. Do not hand-edit generated reference data.

### Boundary between principles, reference notes and chapters

The introduction explains the principles briefly. `reference/concepts.js`
supplies short reference notes shared by the components to which they
apply, plus links to the appropriate chapters. Neither should contain a
second full tutorial on a topic covered in `documentation.md`.

During migration, move detailed teaching and workflow explanations from
concepts into the corresponding chapters. Preserve necessary API rules and
component-specific qualifications in their canonical reference entries;
move content before shortening its old copy. Brief summaries may repeat
an idea to make each view understandable, but full explanations have one
authored home.

The complete Markdown download renders each full chapter once. Reference
notes link to that chapter, and any shared API-only notes appear once with
their applicability made explicit, rather than being repeated for every
form. The component downloads can retain the short contextual notes and
links needed to understand that component independently.

## Single-page order

1. Existing short introduction and expandable principles.
2. Component matrix.
3. **Build your first workflow.** Installation and a complete runnable example.
4. Detailed explanatory sections, in a deliberate learning order.
5. Examples and further reading.

The introductory principles stay short. Their visible summaries explain
the idea; expansion reveals a short explanation and, where useful, a small
example. Link each principle to its fuller explanation below the matrix.
Keep the detailed chapters visible rather than enclosing whole chapters
in disclosure panels.

Concurrency remains the leading advantage. Explain that ordinary
sequential CascadaScript expresses the workflow and the runtime follows
logical dependencies automatically. Remove wording suggesting that users
explicitly declare a dependency graph. Distinguish concurrency from
streaming and explain their actual ordering and completion guarantees.

## Detailed sections after the matrix

The headings below establish the reading order. Subsections can be adjusted
while reconciling the current guides, without changing the one-file,
single-page structure.

1. **Build your first workflow.** Requirements, installation, provider setup,
   one concurrent workflow and the expected result.
2. **Create and call components.** Factories, reusable/stateless components,
   ordinary calls, named `.run()` inputs and returned values.
3. **Orchestrate concurrent workflows.** Composition, logical dependencies,
   ordering, intentional effects and when code or the model selects work.
   Include a short explanation of replacing a component implementation.
4. **Prepare inputs and validate results.** Context, templates, scripts,
   functions, input schemas, defaults, private dependencies and output types.
5. **Share configuration.** Config, inheritance, overrides and specialization.
6. **Use tools and delegate tasks.** Registration, `.asTool`, AI SDK and MCP
   tools, trusted tool context, multimodal tool use, approvals and continuation.
7. **Stream and combine results.** Streams from agents and coded components,
   incremental versus completed output, ordering, consumption and failures.
8. **Work with images, audio and video.** Images/files in agent messages,
   recorded audio and optional codecs, media loading and format handling,
   transcription/speech pipelines and voice session responsibilities.
   Link to the streaming chapter for shared consumption rules, to the tools
   chapter for multimodal tools, and to the matrix for component contracts.
   Preserve status notices for planned capabilities, including video APIs.
9. **Manage conversations.** Message history, continuation and rendering new
   messages without storing invocation state on a reusable component.
10. **Connect application interfaces.** AI SDK Agent/UI integration; link to
    the media chapter for the voice browser/server split and to the matrix
    for the corresponding component details.
11. **Load and organize sources.** Templates/scripts in files, loaders,
    imports, filters and rendering configuration.
12. **Handle failures and control execution.** Errors, retries, cancellation,
    supported timeouts and usage, with current behavior distinguished from
    planned behavior.
13. **Type-check and test workflows.** Inference, configuration annotations,
    deterministic dependencies, mock models and stream completion checks.
14. **Examples and further reading.** Practical examples, the dashboard,
    selected Casai articles and relevant Cascada material.

Use practical examples to teach each concept. Link to the matrix for exact
component settings, methods, source forms and result fields. Keep those
inventories in the reference rather than reproducing them in the prose.
Matrix notes link back to the appropriate explanatory section.

## Migration decisions

| Existing material | Destination |
| --- | --- |
| Installation and quick starts | First workflow, with a shorter shared example in README |
| Common contracts and API basics | Creating/calling components, input preparation and shared configuration |
| Per-component catalogs, properties and result inventories | Existing matrix, filling any verified gaps there |
| Template/Script/Function composition | Concurrent workflows and source organization |
| Agent steps, hooks, history and continuation | Tools, conversations and application integration, linked to API entries |
| Streaming explanations | Streaming chapter, linked to the appropriate component forms |
| Images and files in agent messages; recorded audio, codecs and media pipelines | Media chapter, with links to streaming, tools and component-specific contracts |
| Voice browser/server responsibilities | Media chapter, linked from application interfaces and voice reference entries |
| Tools, validation and trusted execution context | Tools and input/validation chapters |
| Source properties, context, loaders, filters and rendering | Input preparation and source organization |
| SDK UI integration | Application interfaces |
| Cancellation, errors, retries, type checking and testing | Corresponding detailed chapters |
| Interchanging components | Short essential explanation in documentation; extended blog walkthrough |
| RAG integration | Retain a working recipe in documentation until the expanded blog tutorial is available; keep retrieval principles in documentation |
| Draft/review/revise workflow | Retain the useful example in documentation until its refreshed blog walkthrough is available |
| Orchestration strategy table | Keep in documentation; a broader article is optional |
| Repository development and migration information | README links to the appropriate maintained repository documents |

Review every existing guide section before removing it. `README.md`
describes implemented behavior while `README2.md` also contains later
contracts; their timeout explanations are a known difference. Preserve
necessary guidance, verified restrictions and explicit development status.
Do not silently publish future behavior as implemented or clear matrix
status notices as part of a prose migration.

Use both guides as migration inputs. The existing
`tests/fixtures/readme2-examples.cjs` extracts marked TypeScript examples
from **both** `README2.md` and `README.md`, checks shared examples for
equality and includes current-only examples. Its filename does not limit
its coverage to README2. Preserve the named example inventories, setup
dependencies and explicit future-API skips when moving the checks.

Choose prose and examples section by section for clarity and correctness;
README2 is not automatically authoritative for implemented behavior. Audit
unmarked JavaScript and Cascada examples as well, including the revision
workflow, and give migrated published examples appropriate validation.

## Blog treatment

The component-switching article can use the working title **Change the
implementation. Keep the workflow.** Follow one useful operation through
a Function, an LLMAgent and a Script combining deterministic rules with
model calls. Keep application inputs and returned values compatible and
explain the agent output adapter. Replace the existing first-sentence and
echo examples with a realistic task.

Articles provide extended applications and rationale. Core API behavior
remains in documentation. Link articles both from relevant sections and
from the final reading collection. Reuse checked examples where practical
and identify the tested version.

The requested blog follow-up is implemented for component replacement,
draft/review/revise and retrieval. Their canonical Markdown and checked code
live in `docs/matrix/articles/` so Casai's checks do not depend on a sibling
checkout. The website consumes that snapshot and publishes the articles through
its existing blog, feed and sitemap. A compact article list appears immediately
after the matrix and before Build your first workflow on entry and form pages.
The reference keeps essential usage rules, short explanations, previous anchors
and links. Further articles follow the same rule: retain a useful walkthrough
until its article is ready, then replace only the extended material.

## Navigation and links

- Rename the overall experience Documentation; retain Component reference
  as the matrix's role. `/documentation/` remains the resource hub and
  `/documentation/reference/` is the unified documentation entry point.
- Preserve existing `/documentation/quick-reference/` URLs and per-form
  links through a server-side HTTP 301 prefix redirect, including selections,
  views and hash targets. Preserve access to existing Markdown/JSON exports
  through the same rule. See the redirect and release requirements below.
  Update internal links and canonical URLs to the new location. Retain the
  existing form-selection model unless implementation reveals a concrete
  reason to change it; a query-only routing redesign is not part of this plan.
- Add a small Start building link above the matrix, targeting the first
  workflow below it.
- Provide compact navigation near the top so the later sections are visible
  as destinations without expanding the introductory text.
- Use a sticky left contents list alongside the post-matrix documentation,
  following the existing CascadaScript layout. Use inline/collapsible
  contents on small screens.
- Keep the matrix's component sidebar in its own area; avoid placing two
  sidebars beside the matrix.
- Give every chapter/subsection an explicit stable `guide-` anchor before
  its heading, and preserve existing matrix anchors. Generate the contents
  list, chapter links and export links from those authored IDs rather than
  deriving public targets from heading text. Renaming a heading must leave
  its published target unchanged.
- In the complete Markdown export, namespace component/form entries under
  `ref-` so properties such as `model` are unique across the combined
  reference. Component links should select the appropriate component,
  form, view and property, and resolve to its exact exported anchor.
- Keep the chapters available while switching matrix selections. Exercise
  guide-to-matrix links, matrix-to-guide links, reloads, and Back/Forward
  navigation from both the entry page and existing form deep links. The
  shared-fragment behavior below supplies chapters on direct form visits.
- Replace Read the guide links and update internal README-anchor links
  before retiring the old guide sections.

### Links in the authored Markdown

`documentation.md` must remain readable directly on GitHub, with working
links. Use ordinary HTTPS links to the public reference for components and
properties, and local links to the explicit anchors within the source file.
Do not put publication-only `component:` URLs into this Markdown file.
Existing logical links inside JavaScript data modules can remain logical.

Use a named HTML anchor before each linked heading, with the same `id` and
`name` values for browser and GitHub compatibility:

```markdown
<a id="guide-first-workflow" name="guide-first-workflow"></a>

## Build your first workflow

[Build your first workflow](#guide-first-workflow)
```

GitHub documents [custom named anchors](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#custom-anchors).
Keep these markers in the Markdown export. The site renderer consumes the
marker as the heading's ID and the contents-list target without emitting
the same ID on both the marker and the heading. Do not rely on title-derived
slugs or `{#guide-...}` syntax for published chapter links.

The site resolves known public reference URLs through the canonical
selection data and enhances them for navigation within the page. The
complete Markdown exporter maps those same URLs to local `ref-` anchors
and preserves authored `guide-` anchors; genuinely external links stay
external. Use one resolver/anchor mapping across these output formats,
validate targets against the reference inventory, and cover ordinary
GitHub-readable links, legacy URLs and exported fragment links in checks.

## Rendering and publication integration

Read `documentation.md` from the existing verified matrix snapshot. Do not
add another `sites.json` documentation importer or independently fetched
copy of Casai's chapters.

Reuse `scripts/docs-render.mjs` and its shared Markdown renderer for
syntax highlighting, heading extraction and the contents list, together
with the existing CascadaScript documentation layout. Extend the renderer
with opt-in support for the explicit chapter anchors and link resolution,
while preserving Cascada's existing heading URLs and default behavior.
Keep this build-time chapter rendering separate from the matrix's dynamic
panels.

### Shared chapters on component-form pages

Render the chapters statically at `/documentation/reference/`. On a direct
visit to a component-form page, keep that form's reference static and load
the chapters into the same page from one shared, cacheable HTML fragment.
Generate the fragment from the same rendered chapter content as the main
page; do not embed a full chapter copy in every form's HTML file.

Load the fragment when a chapter is requested or its reading area is
approached. A direct `#guide-...` target must load it immediately and wait
for insertion before scrolling. Retain the loaded content while changing
components and reuse one in-flight load. Use a content-versioned asset so
new links and cached chapter content stay consistent across releases.

Provide ordinary links to the full page when JavaScript is unavailable or
the fragment cannot be loaded. These links must exist in the initial HTML.
The complete Markdown and Read all HTML described below remain independent
of JavaScript, the selected component and fragment loading.

The unified entry page has its own canonical URL. Each distinct component
form keeps its canonical form URL; example-only options do not create new
canonicals. The shared fragment is an asset, not another documentation
landing page or sitemap entry.

## Complete Markdown download

Publish a prominent **Download all documentation (.md)** link near the
page heading and retain the selected component's smaller Markdown/JSON
downloads with unambiguous labels.

Generate the complete document from the introduction, the single authored
chapter file and the canonical reference. Include all component families
and form-specific contracts, while rendering shared explanations and
identical API entries once. Do not concatenate every existing form export:
the current 205 exports total about 13 MB with substantial duplication.

Use a coherent reading order, a contents list, unique anchors and links
that work in the standalone file. Preserve versions, development notices,
source provenance and required third-party attribution. Keep the existing
static HTML and per-form Markdown/JSON publications accessible without JS.

### Read all HTML and crawler access

Publish the complete file at `/documentation/reference/documentation.md`
and a static **Read all** page at `/documentation/reference/all/`. Render
that HTML directly from the complete Markdown, including all chapters and
all component/form contracts. It must not require matrix controls, fragment
requests or JavaScript to expose any documentation. Keep these publications
generated; they are not additional authored manuals.

Place ordinary links to both versions in the initial HTML of the unified
page and component-form pages, and link the Read all page from the resource
hub and sitemap. The agreed crawler-access strategy is public discovery
with the same routing for people and bots. Do not redirect crawlers from
the interactive reference to Read all based on their user agent. The
legacy-path redirects below apply equally to everyone.

Label the complete Markdown as the source of the Read all HTML and expose
it as an alternate `text/markdown` representation. Preserve matching
versions and provenance in both. This expresses their derivation without
claiming a universal crawler-recognized "origin" flag. HTML
[`rel="alternate"`](https://html.spec.whatwg.org/multipage/links.html#link-type-alternate)
identifies another representation; it does not guarantee that a crawler
will choose that representation.

Keep the Read all HTML as the canonical URL for that complete publication.
If an HTTP canonical link is served on its equivalent Markdown response,
point it to the Read all HTML. Keep the unified entry page and distinct
component forms self-canonical as described above; consolidate only
duplicate or substantially equivalent representations. A
[canonical URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
signals the preferred search representation, not the original authoring
source or an instruction that all scrapers must follow. Search engines
may choose a different canonical. Readers can land on Read all from search,
so give it clear navigation back to the interactive reference. Preserve
component-specific search destinations rather than redirecting their
references or canonicalizing them to the full book.

## Legacy redirects and release order

Casai's configured publishing host is OVHcloud Web Hosting. OVHcloud
[documents Apache and .htaccess support](https://docs.ovhcloud.com/en/guides/web-cloud/web-hosting/htaccess-url-rewriting-using-mod-rewrite).
Use one scoped HTTP 301 prefix rule from
`/documentation/quick-reference/` to `/documentation/reference/`, covering
the entry URL, form suffixes, Markdown/JSON files and existing auxiliary
exports. Check both entry spellings, with and without a trailing slash.

Preserve query strings and omit a fragment from the redirect's Location
value. The browser retains the original fragment under
[HTTP redirect semantics](https://httpwg.org/specs/rfc9110.html#field.location);
the server does not receive the fragment. Test actual query preservation
and browser navigation to property and chapter targets, including Back.
Do not substitute HTML/meta-refresh stubs for Markdown or JSON downloads.

Keep the redirect in tracked Casai-specific configuration and explicitly
include it in the build output. The existing SFTP publisher already uploads
regular dotfiles, so it does not need a separate redirect-file transport.
Inspect and merge any existing site configuration rather than overwriting
unrelated rules. The cached Cascada-domain redirect is not Casai's config.

Verify the rule on the actual host during release. Local static preview
does not prove Apache redirect behavior. If the host rejects the rule,
retain the old publications until a verified host-level redirect or
compatible alias is in place; do not release broken legacy links.

### Publisher changes required by the migration

Replace filesystem traversal order with one deterministic upload plan,
shared by the real publisher and `--dry-run`. Upload in three phases:

1. Assets and supporting files, including versioned scripts and the shared
   chapter fragment. An HTML fragment under the asset directory is an asset,
   not a page; classify by publication role rather than extension alone.
2. Pages and navigation that reference those assets.
3. The root `.htaccess`, after all previous uploads have succeeded.

Keep changed page/asset dependencies versioned or compatible with pages
still being served during upload. Upload ordering is not an atomic site
replacement. Retain the publisher's existing no-deletion behavior and
older versioned assets so previously served pages can still load them.

The dry run must show the ordered phases, their file counts and the final
redirect-config path, using the same planned file order as execution.
Abort before later phases on failure. Add focused publisher tests for
asset-before-page ordering, the HTML-fragment classification, `.htaccess`
last, dry-run parity and failure before redirect activation.

Protect only the root `.htaccess` with a small remote-change guard. Before
overwriting it, compare its current bytes/hash with the last successfully
published version recorded for this exact host, account and remote site
directory. Store only the destination identity and hash in publishing
state, with no credentials. Refresh the comparison before the final phase.

- If the remote file is absent, it can be created. If it already matches
  the planned file, leave it unchanged and record that matching state.
- If it matches the recorded previous version, publish the new file and
  update the record only after successful transfer/verification.
- If it differs from both, stop and require inspection and reconciliation.
  Missing state on a first publish or new checkout must not silently adopt
  and overwrite a different remote file. Inspect/merge that file and record
  the reviewed baseline explicitly before retrying.

Keep this guard limited to routing configuration rather than introducing
general remote-file synchronization. Test first use, an unchanged remote
baseline, external edits, missing state, and an interrupted previous publish
whose remote file already matches the intended result.

### Release verification and retained files

Every release after the migration must check the legacy redirect, not only
the initial move: verify the HTTP status and Location for the entry URL, a
form URL with query parameters, and Markdown/JSON exports, then verify the
new destinations. Browser checks cover preserved fragment navigation.
If the redirect is missing, stale retained pages must not be mistaken for
a successful release merely because they return HTTP 200.

Do not add remote deletion to this migration. The legacy tree and previous
versioned assets remain available while the redirect and cached pages are
in use. Any later cleanup is a separate, explicitly scoped operation after
the redirect and asset-retention requirements have been verified.

Release in this order:

1. Build and validate the new routes, full Markdown, Read all HTML and shared
   chapter fragment from the same documentation snapshot.
2. Execute the phased upload plan and remote-config checks above. Activate
   the scoped redirect only after its new destinations are available.
3. Verify new public URLs, redirects, query strings, fragment navigation and
   downloadable files, including the recurring legacy-redirect checks.
4. Publish the Casai repository/README changes containing those HTTPS links
   after the destinations are live. Local commits can precede deployment;
   public pushes, merges or releases exposing the links must not create a
   window of 404s for GitHub or package readers.

This is release sequencing, not authorization to deploy during plan work.

## README and retirement

The main README becomes a concise repository introduction: tagline and
overview, compact contents, installation and first workflow near the top,
key advantages, documentation/examples links and repository information.
Reuse homepage messaging and checked examples without copying its layout.

Retire the parallel guide content only after its sections, links and
example validation have been migrated. Move current example checks to
their new sources and preserve existing contract-test coverage. The new
documentation must not depend on a second maintained README guide.

## Implementation sequence and acceptance

1. Inventory current guide sections and snippets; reconcile implemented
   behavior and marked future behavior against the canonical reference.
   Include the current long concepts and both guides' example inventories.
2. Create the single canonical chapter file, including media workflows and
   retained recipes, and link it to matrix entries. Move full explanations
   out of concepts only after their new destinations exist.
3. Render it below the matrix using the shared renderer, add explicit-anchor
   navigation and the shared fragment for form pages, establish the reference
   URL and legacy redirect, and refresh the short introduction's links.
4. Generate the complete Markdown and its static Read all HTML, expose both
   publications and verify their content and anchor parity.
5. Implement phased publishing and matching dry-run output in the website
   publisher, add the bounded remote `.htaccess` guard, and add the recurring
   redirect-verification checks. Validate the upload plan before deployment.
6. Migrate example checks, update links, shorten README and retire the
   parallel guide. Keep documentation-maintenance instructions aligned as
   their ownership and publication rules change.
7. Synchronize the website snapshot and verify the settled result. Measure
   the actual complete Markdown and Read all HTML sizes; paragraph-uniqueness
   estimates are useful guidance, not a size guarantee or a reason to omit
   code, tables, form differences or necessary context.
8. Develop the selected expanded articles independently. Replace retained
   walkthroughs with summaries and links only when their articles are ready.

Acceptance covers the following:

- Introductory material stays short, and the first workflow follows the matrix.
- The post-matrix documentation has one canonical Markdown source.
- Every useful guide topic has a destination; API inventories stay canonical.
- Full concept explanations have one authored home; media workflows and
  useful recipes are preserved before any original section is removed.
- Current and planned behavior remain distinguishable.
- Matrix controls, direct links, hash navigation and browser history still work.
- Navigation works on wide and narrow layouts, with separate guide and
  reference anchor namespaces and verified Back/Forward behavior.
- Renaming a chapter title preserves its explicit source, HTML and Markdown
  targets; the renderer emits no duplicate anchor IDs.
- Form pages reuse one chapter fragment, resolve direct chapter hashes after
  loading, and retain a working full-page link without JavaScript or on failure.
- The resource hub remains available; new reference URLs and legacy links
  resolve to the intended selection and chapter/property target.
- The source Markdown has working GitHub links, and the complete download
  has valid local anchors for its included chapters and reference entries.
- Static HTML, the complete Markdown export and per-component exports contain
  the intended content, and downloads do not depend on the current selection.
- Read all HTML is rendered from the complete Markdown and exposes every
  included contract without JavaScript; both are linked in initial HTML.
- People and crawlers receive the same routing. Canonical metadata groups
  only equivalent representations; distinct component forms retain their
  own search destinations, and Read all links to the interactive reference.
- The built redirect configuration is scoped to Casai, preserves legacy
  exports and is activated only after its targets are live. GitHub links
  become public only after their web destinations have been verified.
- Real and dry-run publishing use the same asset/page/config order; earlier
  upload failures prevent redirect activation, and remote `.htaccess` drift
  or an unknown existing baseline cannot be silently overwritten.
- Recurring release checks verify redirects rather than accepting stale
  legacy pages returning HTTP 200. Publishing remains non-destructive.
- Published code examples remain checked without reducing existing coverage.
- Local links, source provenance, snapshot integrity and appropriate site
  tests pass. Report any unavailable visual verification accurately.
- Follow the existing local development workflow; no commit or deployment
  is implied by this migration plan.
