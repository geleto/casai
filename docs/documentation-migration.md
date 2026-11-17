# Unified documentation migration

Implemented locally on 2026-11-17. The [plan](documentation-plan.md) remains the
design and release checklist. No deployment, public push or remote cleanup is
part of this change.

## Content inventory

Both old README guides were reviewed as inputs. The chapters now live in
[one authored file](matrix/documentation.md). The table records the destination
of the old guide topics; shared API inventories remain in the matrix.

| Former material | Destination |
| --- | --- |
| Installation and quick starts | First workflow; text/structured-output examples in Create and call components |
| API basics, calls, named arguments, returns | Create and call components; exact call inventories in the component reference |
| Component overview, modifier-support and per-component input tables | Component reference |
| Script, Function, Template and data/presentation orchestration | Orchestrate concurrent workflows |
| Interchanging implementations and strategy table | Essential rules and strategy table in concurrent workflows; extended component-replacement article |
| Draft/review/revise | Blog walkthrough, with summary and stable anchor in concurrent workflows |
| Context, source preparation, schemas and validation | Prepare inputs and validate results |
| Config, inheritance and inspection | Share configuration |
| Tools, model steps, approvals, continuation and trusted tool context | Use tools and delegate tasks |
| Streams, schemas, consumption, final-answer streaming and sharing | Stream and combine results |
| Images/files, transcription, speech, translation, codecs and media preparation | Work with images, audio and video |
| Voice server setup, browser client and video generation | Media chapter, with planned APIs visibly marked |
| History and rendering only new messages | Manage conversations |
| SDK Agent methods, chat UI and dynamic instructions | Connect application interfaces |
| Sources, filters, loaders, loader composition and render options | Load and organize sources |
| Cancellation, hooks, timeouts, usage, errors and retries | Handle failures and control execution |
| Types, annotations and deterministic testing | Type-check and test workflows |
| Decision, embeddings, reranking and RAG | Core component examples in further reading; extended retrieval article |
| API migration and repository development | Migration subsection and short repository README |

README.md now introduces the project and shares the first workflow verbatim.
README2.md points to the canonical documentation. The requested blog follow-up
now moves the extended replacement, RAG and revision walkthroughs into
`docs/matrix/articles/`, retaining their essential rules and previous anchors
in the chapters. The website publishes these sources as blog posts and lists
them immediately after the matrix. All other chapter material, including recent
media and testing updates, remains in place.

## Contracts and checked examples

The migration preserves the original named TypeScript example inventory.
The current-only trusted-context example is now in the chapters; the other
eight current-only snippets remain consumer regression fixtures. The old
fixture file also retains that shared trusted-context example and checks its
equality. Two newly checked examples cover the concurrent first workflow and
the formerly unmarked JavaScript revision recipe.

The checker extracts chapter and article examples, retains historical consumer
regressions and verifies the README's shared example. Five planned examples
retain explicit skips and visible notices: three native Cascada streaming
examples, VideoGenerator and VoiceAgentClient. The checker entry point and
`.cache/readme2` path remain compatible with existing compiler and lint tooling;
neither reads README2 as a maintained guide.

Current cancellation uses the native SDK boundary and explicit cooperative
signals. Inherited workflow deadlines are kept in a clearly marked planned
subsection. The source guide's unqualified preparation-timeout claim was
corrected. Detailed API-specific media/ownership restrictions remain in the
reference notes; their links now lead to stable public chapter anchors.

## Website implementation

- The existing verified matrix snapshot now includes the chapter Markdown.
- The same snapshot includes article sources and metadata. Blog, feed and
  sitemap reuse the shared publishing layout. Static article links sit between
  the matrix and chapters, including on direct component pages without JS.
- Workflow checks cover component replacement, revision stopping conditions,
  concurrent retrieval and empty search results. The original replacement
  examples remain consumer regressions after the refreshed article replaces them.
- The main route is `/documentation/reference/`; `/documentation/` remains a
  resource hub. Initial HTML links to the complete download and Read all page.
- The shared renderer consumes explicit `guide-` anchors, preserves existing
  Cascada heading behavior and renders highlighted chapter code.
- Per-form reference HTML remains static. Chapters load from one content-hashed
  fragment, preserving selection/history and an ordinary full-page fallback.
- The complete exporter combines introduction, chapters, all forms, exact
  contracts and examples. Identical contract entries are shared and list their
  applicable forms. Internal component links resolve to `ref-` targets.
- Read all is rendered directly from the full Markdown. People and crawlers
  use the same routing; distinct component pages keep their canonical URLs.
- Publishing uses one manifest for real and dry-run ordering. Assets precede
  pages, with `.htaccess` last. A scoped remote-file hash guards routing rules;
  every Casai release checks legacy redirects and new destinations.

Release still requires live-host redirect verification and publishing the
website before exposing the new HTTPS links through a public Casai release.
See the website README for the reviewed-config hash and verification commands.
