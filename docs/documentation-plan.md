# Unified Casai documentation

Implementation plan agreed in the homepage/documentation discussion. This
supersedes the earlier matrix-only scope in `docs/matrix/MAINTENANCE.md` when
the documentation migration is implemented.

## Intended result

One continuous documentation page contains the existing introduction and
expandable principles, the component matrix, then the explanatory material
currently spread across the README guides. Readers can learn Casai or look
up a component without choosing between parallel manuals.

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
| All explanatory sections after the matrix | `docs/matrix/documentation.md` |
| Site layout, navigation and presentation | Sibling `cascada.dev` website repository |
| Blog articles | Casai's posts in the website repository |
| Complete documentation download | Generated from the canonical sources above |
| Repository introduction | A shortened `README.md` using the homepage's message and shared examples |

The website continues to consume a verified snapshot through `matrix:sync`
and `matrix:check`. Do not maintain a second authored copy of the chapters
in the website repository. Do not hand-edit generated reference data.

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
3. **Prepare inputs and validate results.** Context, templates, scripts,
   functions, input schemas, defaults, private dependencies and output types.
4. **Share configuration.** Config, inheritance, overrides and specialization.
5. **Orchestrate concurrent workflows.** Composition, logical dependencies,
   ordering, intentional effects and when code or the model selects work.
   Include a short explanation of replacing a component implementation.
6. **Use tools and delegate tasks.** Registration, `.asTool`, AI SDK and MCP
   tools, trusted tool context, multimodal tool use, approvals and continuation.
7. **Stream and combine results.** Streams from agents and coded components,
   incremental versus completed output, ordering, consumption and failures.
8. **Manage conversations.** Message history, continuation and rendering new
   messages without storing invocation state on a reusable component.
9. **Connect application interfaces.** AI SDK Agent/UI integration and the
   relevant browser/server responsibilities; link to voice component details.
10. **Load and organize sources.** Templates/scripts in files, loaders,
    imports, filters and rendering configuration.
11. **Handle failures and control execution.** Errors, retries, cancellation,
    supported timeouts and usage, with current behavior distinguished from
    planned behavior.
12. **Type-check and test workflows.** Inference, configuration annotations,
    deterministic dependencies, mock models and stream completion checks.
13. **Examples and further reading.** Practical examples, the dashboard,
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
| Tools, validation and trusted execution context | Tools and input/validation chapters |
| Source properties, context, loaders, filters and rendering | Input preparation and source organization |
| SDK UI integration | Application interfaces |
| Cancellation, errors, retries, type checking and testing | Corresponding detailed chapters |
| Interchanging components | Short essential explanation in documentation; extended blog walkthrough |
| RAG integration | Practical blog tutorial, linked from documentation and retrieval components |
| Draft/review/revise workflow | Practical blog walkthrough after refreshing the example |
| Orchestration strategy table | Keep in documentation; a broader article is optional |
| Repository development and migration information | README links to the appropriate maintained repository documents |

Review every existing guide section before removing it. `README.md`
describes implemented behavior while `README2.md` also contains later
contracts; their timeout explanations are a known difference. Preserve
necessary guidance, verified restrictions and explicit development status.
Do not silently publish future behavior as implemented or clear matrix
status notices as part of a prose migration.

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

## Navigation and links

- Rename the overall experience Documentation; retain Component reference
  as the matrix's role. Preserve existing reference URLs and deep links.
- Add a small Start building link above the matrix, targeting the first
  workflow below it.
- Provide compact navigation near the top so the later sections are visible
  as destinations without expanding the introductory text.
- Use a sticky left contents list alongside the post-matrix documentation,
  following the existing CascadaScript layout. Use inline/collapsible
  contents on small screens.
- Keep the matrix's component sidebar in its own area; avoid placing two
  sidebars beside the matrix.
- Give every chapter/subsection stable, unique anchors. Component links
  should select the appropriate component, form, view and property.
- Replace Read the guide links and update internal README-anchor links
  before retiring the old guide sections.

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
2. Create the single canonical chapter file, improve its structure and
   link it to matrix entries. Prepare the selected article material.
3. Render it below the matrix, add navigation and refresh the short
   introduction's links and wording.
4. Generate the complete Markdown document and expose its download.
5. Migrate example checks, update links, shorten README and retire the
   parallel guide. Update documentation-maintenance instructions.
6. Synchronize the website snapshot and verify the settled result.

Acceptance covers the following:

- Introductory material stays short, and the first workflow follows the matrix.
- The post-matrix documentation has one canonical Markdown source.
- Every useful guide topic has a destination; API inventories stay canonical.
- Current and planned behavior remain distinguishable.
- Matrix controls, direct links, hash navigation and browser history still work.
- Navigation works on wide and narrow layouts, with unique anchors.
- Static HTML, the complete Markdown export and per-component exports contain
  the intended content, and downloads do not depend on the current selection.
- Published code examples remain checked without reducing existing coverage.
- Local links, source provenance, snapshot integrity and appropriate site
  tests pass. Report any unavailable visual verification accurately.
- Follow the existing local development workflow; no commit or deployment
  is implied by this migration plan.
