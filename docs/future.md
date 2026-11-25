# Future Features

Features recorded for later. Async call context and deadlines are assigned to Phase 10; broader telemetry features and other items remain directions rather than agreed APIs. The current plan is in [plan.md](plan.md).

- **Telemetry.** Cascada will publish telemetry on one global channel that all nested calls report to: model usage in tokens, timing, request counts, and the call tree.
- **Context channel.** Cascada's async call context passes an absolute end time and call ancestry implicitly from each component to its children. Concurrent calls have separate frames, not one mutable global stack. Signals are derived at SDK/cooperative boundaries, not required context state. See [abort.md](abort.md).
- **Async context tracking.** Develop this in Cascada together with telemetry, so both telemetry reporting and inherited state follow Script/Template calls, SDK tools, and ordinary asynchronous JavaScript, including components called by Function callbacks. This shared foundation is the upstream prerequisite for Phase 10; Casai must not build a parallel tracker. A Function implementation can query the current end time. Late-running work and returned streams retain their execution context.
- **Telemetry for any component call.** Read the telemetry of one call, including its usage, time, number of model requests, and call stack, for any component. Template, Script, and Function return plain values today, so this needs a form that leaves those values unchanged, such as a callback or separate metadata access alongside the agreed `.run()` method. Decide once telemetry exists.
- **`onUsage` on every component.** Report the tokens used by a call and everything it ran. LLMAgent already reports its own call's tokens through the SDK's `usage` fields and `onEnd` callbacks. Template, Script, and Function get `onUsage` once Cascada telemetry works.
- **Timeouts across nested calls (Phase 10).** A child uses the earlier of its parent's end time and its own timeout from entry. Once async call context exists, Function/Script/Template may race completion against that deadline before native engine abort is available. The wait can end while work continues, but nested components still inherit the deadline. Preserve native SDK cancellation in the meantime; see [Phase 10](plan.md#phase-10-async-call-context-and-deadlines) and [abort.md](abort.md).
- **Native engine interruption.** When Cascada supports abort and owned-work cleanup, connect them to the Phase 10 deadline to stop rendering as well as end the wait. This is a later enhancement, not the prerequisite for timeout races. Arbitrary JavaScript remains cooperative.
- **Progress for streaming tools.** A streaming Casai tool could report SDK preliminary tool results as cumulative snapshots, the text or elements so far, so chat UIs show tool progress. The final result stays the completed value.
- **Out-of-order streaming.** Delivering stream elements before earlier positions are ready; see [Phase 11](plan.md#phase-11-out-of-order-streaming).
- **Server-owned raw-audio VoiceSession runtime.** Separate from Phase 5's native streaming-speech/translation wrappers, Live WebRTC/relay setup and SDK browser interfaces: an audio stream in and session events out, for telephony or server-hosted agents. This would require a new server session execution loop, not merely exposing an existing experimental interface; see [transcription and voice](plan.md#transcription-and-voice). Experimental status alone never defers a published SDK interface.
- **Coded components behind the SDK chat protocol.** A custom `LanguageModelV4` provider could let a Template, Script, or Function serve SDK UI helpers with real SDK results. Assess it when an application needs it.
- **Background jobs and resumable operations.** Long-running work needs explicit execution handles rather than state in shared configuration; see [shared infrastructure](plan.md#shared-infrastructure-and-capability-boundaries).

## Proposed components for document retrieval, memory and knowledge

These five Casai components are proposed for a future phase. Each should be usable from JavaScript and CascadaScript. Reusable components hold configuration and dependencies. Documents and chunks pass between calls as plain values, and configured stores own the persistent records. Cascada owns Studio and the planned once-call operator for workflow checkpoints.

### Document

`Document` reads a source and returns a document with ordered text blocks. It carries through the source ID and metadata when supplied. Blocks can record structure such as a heading, paragraph or table row, and a location such as a PDF page or worksheet cell range. Plain text is a valid input even when it has no location. File readers and connectors supply content from explicitly selected sources.

Candidate formats include plain text, Markdown, HTML, JSON, LaTeX and CSV, plus text-bearing PDF, Word DOCX and Excel XLSX through format-specific readers. Connected sources such as Google Docs and Sheets can supply the same block representation. Scanned pages require an OCR-capable reader. The choice of parsers and the first release's format coverage are open.

### Chunker

`Chunker` takes text or a document and returns ordered passages for retrieval. Authors choose a splitting strategy, target size and optional overlap. A strategy can respect headings, sentences or table rows and measure a limit in tokens. Each passage retains its source metadata and the locations of the blocks it draws from.

For example, one paragraph spanning pages 7 and 8 can become one passage that cites both pages. A spreadsheet passage can include the column heading “Refund period” alongside “30 days” so the embedded text makes sense by itself. Its cell range travels separately for citation. A block that already makes a good passage can go directly to `Embedder`.

### VectorStore

`VectorStore` writes, queries and deletes indexed passages. An upsert associates a stable ID and embedding with passage text or a retrievable reference, plus source metadata. A search takes a query vector, optional metadata filters and a result limit. It returns scored matches with the IDs and source information needed to retrieve and cite their text.

`VectorAdapter` is the interface a database integration implements to provide those operations. The adapter maps supported filters to the backend's query. For example, a search for the five closest refund policies published since January 1 uses the publication date to determine which records compete for those five places. Equality, range and membership predicates cover common filters such as category, date and source.

### Memory

`Memory` saves and recalls conversation state for a caller-supplied resource, such as a user, and a thread. A read returns recent SDK messages and any selected context for the current request. A write persists new turns, including their tool calls, results and approvals. Casai's `LLMAgent` already returns the assembled `messageHistory`, so the integration should save each actual turn once and keep recalled passages in the outgoing request. [Casai conversation history](matrix/documentation.md#guide-conversations)

Working memory keeps facts and preferences for a user or thread. Semantic recall can use `Embedder` and `VectorStore` to find relevant older messages within that scope. Observational memory condenses older exchanges into notes. For example, a support agent can recall the 45-day return exception it granted a particular customer. [Memory implementation plan](memory.md)

### Knowledge

`Knowledge` manages material that people and agents share across conversations, such as the support team's standard return policy. Within an application-authorized scope, a caller can list, read, write and link Markdown pages, add attributed notes, and search for relevant pages or notes. Reads return content with stable references that agents can cite. Pinned pages supply standing context, and read and write operations can be exposed as separate tools.

Keyword search covers names and text. An optional `Embedder` and `VectorStore` add semantic matches to the ranking, so a search for “money back” can find a page titled “Returns.”

### How the components fit together

- **Indexing a document.** Read it with `Document`, select passages with `Chunker`, batch their text through the existing `Embedder`, then upsert the vectors and their matching passages and source locations into `VectorStore`.
- **Retrieving evidence.** Ship `retrieve` as a composed workflow that can also serve as a read-only agent tool. It takes a question and permitted filters, embeds the question, queries `VectorStore` and optionally reranks the candidates with the existing `Reranker`. It returns passages and source references, or an empty list. An `LLMAgent` can use these results to answer. [Existing Casai retrieval workflow](matrix/articles/retrieval-to-grounded-answers.md)
