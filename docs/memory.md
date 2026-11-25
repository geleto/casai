# Memory implementation plan

Port the behavior of Mastra Memory to Casai. Casai will own conversation recall, working memory, and the Observer and Reflector workflows. Applications will supply durable storage and vector search through Mastra's published adapter packages. The same Casai `VectorStore` will serve conversational recall and document RAG. The parity reference is `@mastra/memory@1.41.3` with `@mastra/core@1.86.0`. This is a proposed implementation, with package and interoperability probes recorded on 2026-11-25. [Component roadmap](future.md#proposed-components-for-document-retrieval-memory-and-knowledge)

The first milestone is a durable conversation. Save a turn, restart the process with its original application inputs, continue a pending approval, and retry the completed database write. Working memory and semantic recall can then ship independently. Document ingestion and cited document retrieval use the same vector contract in a separate milestone.

## Scope of the rewrite

The port targets the full behavior of the pinned Memory release. A wrapper would keep its message conversion, indexing schedule, and agent processor lifecycle. Casai needs faithful SDK v7 history, one batched Embedder invocation over the texts in a save, and Observer/Reflector workflows authors can read and compose in Cascada. Reuse the AI SDK for model calls and embedding batches and the published adapters for database operations. These differences also give the code-clarity and concurrency comparisons a concrete subject.

Start by inventorying the pinned public operations, defaults, options, tools, processors and deprecations. Assign each an upstream fixture, a corresponding Casai workflow, and an observable result before implementing that group.

| Behavior to cover | Where it belongs |
| --- | --- |
| Thread/message operations, recent history, budgeting, pagination, edits, clone and retention | Durable store and chronological recall |
| Working memory, scoped profiles, application-managed and model-managed updates | Profile operations and authorized Casai tools |
| Semantic recall, neighbors and filters | Shared vector interface and conversation indexing |
| Observation, reflection, async buffering, progress, retrieval and waiting for submitted work | Casai agents, Cascada Script, and the observation operations below |

Thread-scoped observation is the default. Include the deprecated resource-scoped mode as an explicit compatibility case because this project targets the whole pinned implementation. Test it with concurrent threads of one resource. Resource-wide semantic recall and resource profiles have their own independent controls. Interoperability with another application's existing Mastra rows or UI is outside the feature-parity target.

## How much Mastra an application needs

The adapters can run on their own, but their coupling to Mastra Core is real. Both `@mastra/pg@1.38.0` and `@mastra/libsql@1.32.0` declare `@mastra/core >=1.86.0-0 <2.0.0-0` as a required peer. Each publishes a single JavaScript package entry point for both storage and vector classes. In fresh Node processes, importing either entry loaded the core `storage`, `vector`, `agent`, and `evals` modules before a database operation ran. Those imports do not require the application to construct a Mastra agent, run a workflow, or start a server.

| Exports in an otherwise empty application | Minified Node bundle with published Core | Same fixture with the storage-only prototype |
| --- | ---: | ---: |
| `PgVector` from `@mastra/pg` | 2,824,188 B | 988,514 B |
| `LibSQLVector` from `@mastra/libsql` | 2,706,155 B | 861,486 B |
| `MemoryLibSQL` and `LibSQLVector` from `@mastra/libsql` | 2,779,750 B | 1,462,695 B |

The probe used Node 24.14.1 and esbuild 0.28.2 with named re-exports, ESM output, minification, and the Node 24 target. It marked `pg-native` and `@libsql/client` external in both builds. With all packages external, the entries emitted only the external re-export. Node still loads the installed dependency when the application imports it. For comparison, npm reports 42,084,905 bytes unpacked for the **whole published Core package**, including its published formats and declarations. These figures measure different costs. [esbuild package externalization](https://esbuild.github.io/api/#packages)

**Casai's package boundary**

- The default `casai` entry exports provider-independent factories. Keep all Mastra runtime imports and references to Mastra types out of the default JavaScript **and** its reachable public declarations. Today Casai emits ordinary ESM with TypeScript and builds its audio workers separately. Importing its current compiled entry loaded zero Mastra modules. Registering a provider-independent factory fits that build.
- The application imports and constructs its selected provider. Keep a single opt-in `casai/mastra` subpath with structural calls on those instances and declarations expressed in Casai-owned types. The published driver owns the required Core peer. Casai declares no direct Core dependency or peer of its own, so an application using only Casai's ordinary agents has no Core version constraint. The initial bridge qualification target is exactly Core `1.86.0` with libSQL `1.32.0` and PostgreSQL `1.38.0`. Expand the supported combination matrix as each suite passes. Check the structural types against the actual provider declarations.
- The adapter-using application supplies the selected provider, its compatible Core peer, and any database client it imports directly. For a database-only application, qualify the storage-only peer described below. Applications using Mastra agents can keep the official peer. Browser applications use the same Memory interface with a local database or an authenticated application endpoint. [Browser storage](#browser-storage)
- Keep `@mastra/memory` in the isolated comparison fixture. Track the installed dependency tree as well as bundle bytes. The published Core manifest includes Hono, execa, ws, posthog-node and A2A SDKs. Externalizing packages affects the bundle while npm still installs their declared dependencies. Recheck both costs when upgrading a provider or the optional peer.

### A storage-only Core for the published adapters

Publish a compatible Core build under our own npm scope and let the consuming application install it under the dependency name `@mastra/core`. The adapter's existing imports then resolve to the selected build. This is the proposed manifest for a PostgreSQL application once the fork is published. Replace `@your-scope` with the publishing scope. [npm package aliases](https://docs.npmjs.com/cli/v11/using-npm/package-spec/#aliases)

```json
{
  "dependencies": {
    "@mastra/core": "npm:@your-scope/mastra-storage-core@1.86.0",
    "@mastra/pg": "1.38.0"
  }
}
```

Normal application imports such as `import { PgVector } from '@mastra/pg'` stay valid. The public PostgreSQL and libSQL packages were left intact in the probe. npm 11.11.0 installed a locally served scoped tarball with strict peer checks and resolved both adapters to one aliased Core. The direct dependency was sufficient. The consuming application owns this choice. npm honors dependency overrides only in the root manifest. Apps that also use the full Mastra API can select official Core for that dependency tree. [npm override rules](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)

Build from the pinned upstream implementations. Retain the storage domain classes and schemas, vector and filter contracts, errors, and utilities that the driver packages import. Their `@mastra/core/agent` entry needs the real `MessageList`, which they use when reading messages. Their `@mastra/core/evals` entry needs the real `saveScorePayloadSchema` for stored score validation. Export those helpers directly from the corresponding subpaths. The prototype selected their implementations and checked the emitted dependency graph for agent and evaluator execution modules. Re-exporting selected names from the published Core barrels alone still pulled in unrelated execution code.

In the isolated libSQL test, a fresh process recovered the messages and two observation generations. An owner/date query found the eligible vector, and repeating it after deletion returned an empty result. The PostgreSQL package loaded through ESM and CommonJS on Node 24.14.1. The live PostgreSQL integration cases below passed with both the published Core and the local storage-only build. TypeScript consumer compatibility still requires qualification before publishing the fork. [PostgreSQL integration evidence](#what-the-postgresql-test-covers)

The family-wide scope looks practical. A static scan of non-test TypeScript under 31 provider source directories at upstream commit `05cad114ab83` found 14 directly imported Core runtime subpaths. The PostgreSQL/libSQL prototype covers ten. Additional provider imports include cache support, storage constants, a logger, an observability enum, and vector validators. Across those sources the only runtime symbols imported directly from the agent and evals entries were the two helpers above.

For release, inventory the **published** ESM, CommonJS, and declaration entry points for every supported adapter version, including named exports and namespace property access. Supply compatible type-only paths such as `@mastra/core/memory` and `@mastra/core/workflows`, and compile representative consumers with library checking enabled. Run driver conformance against official and storage-only Core. Keep the fork build, input versions, lockfile and bundler settings with the fork before publishing or quoting its sizes as reproducible release figures.

The pinned Mastra Core, Memory, libSQL and PostgreSQL packages declare Apache-2.0. The separate `@libsql/client@0.18.0` dependency declares MIT. For redistributed Mastra code or prompts, include the Apache-2.0 license, preserve applicable attribution notices, reproduce relevant upstream NOTICE material where provided, and mark modified upstream files. Apply this to the cut-down Core package and copied Observer or Reflector prompts, and retain each bundled dependency's own notices. [Apache License, section 4](https://www.apache.org/licenses/LICENSE-2.0) · [libSQL client license](https://github.com/tursodatabase/libsql-client-ts/blob/main/LICENSE)

### Standalone storage wiring

This is the working provider side of the integration. The host passes the initialized records and vector objects to the Casai integration and owns their lifetime.

```ts
import { createClient } from '@libsql/client';
import { LibSQLVector, MemoryLibSQL } from '@mastra/libsql';

const url = 'file:./memory.db';
const client = createClient({ url });
const records = new MemoryLibSQL({ client });
await records.init();
const vectors = new LibSQLVector({ id: 'recall', url });
```

In a clean npm install, these classes saved and read a message and queried a vector index with owner and date restrictions. The only installed `@mastra/` packages were `libsql`, `core`, and `schema-compat`. Initializing the memory domain created the thread, message, resource, observation, and memory run-fence tables. For an application that already owns a composite Mastra store, accept the initialized domain returned by `await store.getStore('memory')`. Use the standalone constructor where a provider publishes one. Both routes give Casai the same dependency.

### Browser storage

The first browser release supports **both device-local and server-backed Memory**. For device-local memory, history survives reloads and can be searched offline once the application and database runtime have loaded. For shared memory, the browser calls an application endpoint backed by the same packaged Mastra adapters as a server-side agent. The host binds the authenticated owner and thread.

| Deployment | Evidence and implementation |
| --- | --- |
| Device-local, offline-capable database | PGlite runs PostgreSQL in WebAssembly and can persist in IndexedDB. Its pgvector extension supports similarity search with SQL filters. In Chrome 158, PGlite 0.6.0 and its pgvector package 0.1.0 preserved a native SDK message across a reload. With networking disabled after the runtime loaded, an owner/date filter returned the eligible message ahead of two closer excluded rows. This used the real database directly. Implement and test an opt-in Casai `MemoryStore` and `VectorAdapter` over it to expose this through Memory. [Browser probe](../tests/fixtures/memory-browser-probe.mjs) · [IndexedDB persistence](https://pglite.dev/docs/filesystems) · [PGlite extensions](https://pglite.dev/extensions/) |
| Server-backed history shared across devices | In the browser probe, a host endpoint backed by the published `MemoryLibSQL` saved a message from one browser session. A separate browser context signed in as the same owner retrieved it. Another owner's session received an empty history even when it requested the first owner's resource ID. The probe supplied test logins and exercised the host's scope binding. Qualify the same flow through the implemented Casai Memory entry points. |
| Browser client for a remote database | The web entry of `@libsql/client@0.18.0`, imported as `@libsql/client/web`, bundled for the browser. It speaks to a remote database. Using it for Casai Memory requires a compatible store integration and credentials restricted to the user's authorized data. A host can also keep the packaged Mastra adapter behind its API. [libSQL client exports](https://github.com/tursodatabase/libsql-client-ts/blob/main/packages/libsql-client/package.json) |
| Published Mastra driver inside the browser tab | Standard browser builds of the pinned `@mastra/pg` and `@mastra/libsql` entries failed on Node imports. The same check on `@mastra/qdrant@1.1.7` and `@mastra/upstash@1.6.3` with published Core also failed. The storage-only Core prototype alone did not make the libSQL driver browser-compatible. Qualify further providers by their browser entry, bundle and actual operations. |

The local browser adapter owns database operations. Casai's default browser entry stays independent of its WASM assets. Qualify cross-tab writes using PGlite's worker coordination, reload and same-origin persistence, and each advertised profile/observation operation. A shared server verifies its own authorization and approval decisions when a client presents saved history. [PGlite multi-tab worker](https://pglite.dev/docs/multi-tab-worker)

### What the PostgreSQL test covers

Mastra's `MemoryPG` and `PgVector` own the SQL, connections, locking and index queries. Casai needs to verify that its message encoding, write IDs and query parameters exercise those contracts correctly. The same test ran against PostgreSQL 18.6 with pgvector 0.8.6, using the unmodified `@mastra/pg@1.38.0` first with published Core and then with the storage-only Core prototype.

- A second connection loaded the signed pause. Continuing it preserved the changed tool message's ID. Retrying the completed write preserved the row count.
- Competing writers preserved both resource-profile and thread-metadata changes. A concurrent observation update received a conflict, and a later write to the retired generation was refused.
- Combined owner and date filters returned the eligible row despite 81 closer excluded entries. Deleting a vector in one namespace preserved the same vector ID in another.

Repeat these integration cases when the bridge, driver or Core peer changes. The query used a small deterministic corpus and tested results and isolation. [PostgreSQL probe](../tests/fixtures/memory-plan-probe.mjs)

## Components and responsibilities

| Piece | Implementation |
| --- | --- |
| **`Memory`** | `memory(scope)` recalls chronological history. `memory(scope, query)` adds semantic matches. The named forms are `memory.run({ scope, query, ...options })` and `memory.recall({ scope, query, ...options })`. Return fresh SDK `messages` and source-attributed `matches` (empty for history-only recall). `save()` is an explicit effect. The host binds the authorized resource and thread for agent tools. |
| **`MemoryStore`** | Casai's durable interface for threads, message records, and enabled profile and observation operations. The Mastra integration implements it over a configured memory domain. History and working memory can run on a records-only backend. The Mastra-free in-memory test store and the proposed device-local adapter exercise the same interface. |
| **`VectorStore` and `VectorAdapter`** | Build one Casai query/write component over a configured adapter. Reuse native index creation, discovery, batch upsert with stable IDs, scored top-K query with metadata predicates, update and deletion. Keep scope, source, date, score threshold, and result limit explicit. A dedicated vector service can sit beside the durable store, or both can use one database. |
| **`Chunker`, `Embedder`, and `Reranker`** | `Chunker` is the public splitter component. Semachunk is the planned optional semantic strategy and a new dependency for that integration. Authors can choose other strategies. Use Casai's existing batch `Embedder` and optional `Reranker`. Keep the indexing text, embedding, source ID and available ranges together. Short messages can go directly to the embedder. |
| **`Document` and `retrieve` for RAG** | Format readers supply normalized text and source locations. Compose question embedding, scoped `VectorStore` query, passage lookup, and optional reranking as the shared `retrieve` workflow. Memory can index messages directly. The separate `Knowledge` proposal covers curated pages and notes. [Existing retrieval workflow](matrix/articles/retrieval-to-grounded-answers.md) |

Token accounting and SDK message encoding belong inside Memory until a second caller needs their contracts. Reuse an appropriate tokenizer or estimator. Chat budgeting must account for messages, tools, and attachments. Semachunk's embedding-input token limit serves a different model and input.

### What a MemoryStore must implement

| Casai operation | Operations on the pinned Mastra memory domain |
| --- | --- |
| Read or write an authorized thread and chronological message records | `getThreadById`, `saveThread`, `listThreads`, `listMessages`, `listMessagesById`, `saveMessages`. Use stable IDs for inserts and replacements. Scope reads and authorize every existing row an update touches. |
| Edit, clone, move or delete | `updateMessages`, `deleteMessages`, `patchThread`, `copyThread`, `updateThreadResourceId`, `deleteThread`. Use the copy's ID map to rebuild references. Memory coordinates retention with vector cleanup. |
| Read and update a working profile | Thread metadata through `updateThreadMetadata`. Resource data through `getResourceById`, `saveResource`, `updateResource`, and `mergeResourceWorkingMemory` where supported. |
| Read observations, configuration and past generations | `initializeObservationalMemory`, `getObservationalMemory`, `getObservationalMemoryHistory`, `updateObservationalMemoryConfig`. Use history-search capabilities for queries the driver supports. |
| Publish and activate observations and reflections | `commitActiveObservations`, `appendBufferedObservations`, `swapBufferedToActive`, `updateBufferedReflection`, `swapBufferedReflectionToActive`, `createReflectionGeneration`. Preserve source IDs, cursor coverage, cycle IDs and superseded-generation results. |
| Observation progress, cloning and clearing | Pending token counts and observing/reflecting/buffering flags describe progress. `insertObservationalMemoryRecord` and `clearObservationalMemory` support lifecycle operations. |

Implement these as capabilities of one Casai store. A history-only store needs the history operations. The observation protocol is version-coupled to Mastra. The pinned libSQL package ships declarations from `@internal_core@0.1.4` and supplies schema columns for older Core installs. Test the published driver and Core pair, including duplicate cycles, conflicting cursors, retired generations and partial activation. Some Core base methods delegate to older methods and report success unconditionally. A method name alone does not qualify an adapter for concurrent publication.

## AI SDK history and Mastra records

`memory.save({ scope, turnId, messages })` takes a `readonly ModelMessage[]`. It reads each native SDK message and creates a new storage record. Reading a record produces a fresh native message, including its nested content and provider options. `memory.recall({ scope, query })` returns a new result for each call. Its `messages: ModelMessage[]` can go straight into an agent. Callers retain ownership of their inputs. The reusable Memory component holds its configured dependencies, and each invocation owns the values it creates. Casai already augments the agent **result** with `messageHistory`, the conversation prefix plus the SDK's `responseMessages`. [Casai result types](../src/types/result.ts) · [History assembly](../src/runtime/augment-result.ts) · [AI SDK message contract](https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message)

### Which fields belong to storage

The AI SDK's `ModelMessage` union defines `role`, role-specific `content`, and optional `providerOptions`. None of the storage fields below is a standard top-level message property.

| Storage field | Who supplies it | Why Memory needs it |
| --- | --- | --- |
| Stable message ID | Memory assigns the row ID from the thread, turn and ordinal. The store returns the actual ID, including for clones. | Cite and retrieve the source, edit or delete the row, and retry the same write. A part's `toolCallId` or `approvalId` identifies a different entity. |
| Thread ID and resource ID | The host passes the authorized conversation and owner in `scope`. | Load one thread or recall across that owner's threads. The libSQL driver requires both on message writes. |
| Creation time | Memory assigns the first-recorded time and preserves it on updates and retries. A host that knows an earlier event time can supply it as record metadata for a delayed or imported message. | Date filters and recency. The SDK's `result.response.timestamp` and `result.response.id` describe one model response. They cannot date an earlier user input or identify each message. |
| Turn ID and ordinal | The host supplies the stable `turnId`. Memory assigns positions in input order and returns `nextOrdinal`. | Preserve call/approval/result order even when timestamps tie. Cross-turn ordering belongs to the store or host. |
| Storage format version | The codec supplies its version. A Mastra provider also uses its V2 container format. | Decode earlier records as the encoding evolves. |

Casai re-exports the SDK type as `ModelMessage` and the **same schema object** as `ModelMessageSchema`. Its history validator checks the supplied messages. `LLMAgent` adds `messageHistory` to the result by assembling a new array from the input prefix and native responses. It reuses the message objects. Adding storage fields there would touch borrowed objects or require extra copies, and would miss messages saved directly or supplied by other SDK callers. The agent also does not know the host's durable turn or whether a write has succeeded. [Schema exports](../src/index.ts) · [History validation](../src/config/validate.ts) · [Result augmentation](../src/runtime/augment-result.ts)

Define a separate record schema wherever the boundary needs validation. For example, `z.object({ id: z.string(), message: ModelMessageSchema })` checks a record containing an ordinary SDK message. The installed schema is a Zod union and has no object `.extend()` method. A new `z.intersection(ModelMessageSchema, storageFields)` can validate an application-specific flattened view, but parsing that object with the original SDK schema strips the extra keys. Expose IDs in save receipts and semantic matches, and full records through `listMessages()`. The `messages` field of a recall result contains plain SDK messages. An AI SDK UI application's `UIMessage.id` can identify a displayed item. Memory also accepts conversations that never passed through a UI. [Executable schema check](../tests/fixtures/memory-plan-probe.mjs)

### Write receipts and continuation updates

An ordinary `save({ scope, turnId, messages })` writes **only the new input and response messages**. Its receipt supplies `{ messageIds, nextOrdinal }`, with one ID per new message in input order. A store offering conditional writes also returns its revision. The host allocates a distinct `turnId` for each genuine turn, even when the text repeats. Allocate new IDs deterministically from the thread, turn and ordinal, using a collision-free encoding. A retry preserves those IDs and original timestamps. `memory.listMessages({ scope, ... })` exposes stored records with IDs for editing, deletion and pause handling. Recalled SDK messages keep their native shape.

A continuation can pass `save({ scope, turnId, startOrdinal, updates, messages, ifRevision })`. `startOrdinal` defaults to zero on the first write. On continuation use the paused receipt's `nextOrdinal`. Each update is `{ id, message }` and retains that row's position. Upsert the replacements and new rows in the same write when the store supports it. On retry, recognize an already committed write and reconcile any unfinished indexing from the current rows. Reject a conflicting newer revision. A provider without conditional writes needs a host that owns the turn and checks the current pause before applying a retry. Serializing SQL calls alone cannot detect a late stale write.

Verify atomic visibility separately from retryable upserts, especially across multiple driver batches. A store without atomic multirow writes needs a coordinated completion record before it can advertise a durably resumable pause. Advance that record only after all required rows and application inputs are durable. Readers resume only committed pauses.

### One stored copy of each native message

The proposed `casai/mastra` integration writes one Mastra V2 record per native message. The libSQL prototype used a single named data part, `{ type: 'data-casai-message', data: { version: 1, turnId, ordinal, message } }`. The row supplies the ID, time, thread, and resource. The encoded message carries the original SDK role and content. The driver can run its own `MessageList` on these new records. Its database view omits system-role rows and its record roles differ from the SDK's. The prototype used a user carrier for user messages and an assistant carrier for the other roles, and recovered all four SDK roles from the payload.

Preserve SDK message- and part-level `providerOptions`, custom and reasoning parts, provider file references, tool inputs/results, and SDK approval fields. The database stores them as data. The AI SDK and the selected model provider interpret them on replay. Derive searchable text from the native message for embedding and excerpts. An adapter operation that inspects its own text parts or row roles needs a conformance test with this layout before Casai uses it.

Store finite inline attachments in the message by default, with bytes encoded as base64 and URL objects encoded in the SDK-compatible form for each part. Respect the selected store's record-size limit, including encoding overhead. Surface a failed save before acknowledging durability. A caller can supply an existing durable file reference for large media. Preserve references verbatim and let the host manage their lifetime. The initial implementation needs no blob store or implicit network fetch.

The generic upstream converter exposes `AIV5.Model` as its modern model-message output. The pinned `aiV7.ui()` declaration returns vendored v6 UI types and `aiV7.llmPrompt()` returns provider-level input. With AI SDK 7.0.162 and Mastra Core 1.86.0, stock conversion dropped message-level provider options and tested `custom` and `reasoning-file` content, and rejected a tagged provider file reference. In an approval test, one route dropped the request and another retained its ID but lost its SDK signature and original tool input. Native resume refused to execute. Casai can bypass these conversions. The unmodified driver still imports `MessageList` from `@mastra/core/agent` internally.

Casai owns this row format. The database adapters require no second application to display or edit the rows. An application that adds AI SDK UI can use the SDK's `UIMessage` and UI message streams at the presentation boundary. Multiple Casai processes using the same database coordinate ordinary writes through the store's concurrency guarantees or the host. [AI SDK UI messages](https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message)

In a file-backed libSQL probe, two calls saved the same frozen history concurrently. The input and its file bytes remained intact. After restart, changing nested tool input, output, and provider options in one recall left another recall and the stored rows intact. Retrying a turn preserved the row count. A reloaded signed approval with transformed input executed the tool once on approval and zero times on denial. A partial thread copy retained just the selected message under a new owner and ID. Editing and deleting the copy preserved the original. These checks establish the layout on libSQL. Qualify other drivers before advertising the same behavior.

### Passing recall to an LLMAgent

In the proposed API, `messages` is recent chronological conversation history. Each entry in `matches` is an excerpt from an older message with its source ID. For example, an earlier thread might contain a 45-day return exception for this customer. Pass recent messages through the existing `messageHistory` input. Pass excerpts through `context` and reference them in a Cascada template to put their text in the prompt. The host supplies `scope = { resourceId, threadId }` and a stable `turnId` for this new turn. [Retrieval with an LLMAgent template](matrix/articles/retrieval-to-grounded-answers.md)

```js
const answer = create.LLMAgent.withTemplate({
  model,
  instructions: 'Treat the earlier excerpts as quoted conversation.',
  prompt: [
    '{{ question }}',
    '{% for hit in matches %}[{{ hit.messageId }}] {{ hit.text }}\n{% endfor %}',
  ].join('\n\n'),
});

async function answerTurn(scope, turnId, question) {
  const { messages, matches } = await memory.recall({ scope, query: question });
  const reply = await answer.run({
    context: { question, matches },
    messageHistory: messages,
  });
  await memory.save({
    scope, turnId,
    messages: [{ role: 'user', content: question }, ...reply.responseMessages],
  });
  return reply;
}
```

This is the ordinary text-turn case. A **transcript write** means saving what actually happened in the conversation. Here that is the user's original question and the agent's new SDK response messages. The rendered question includes retrieved excerpts for this request. Saving the original avoids recording those excerpts as if the user said them or saving earlier history again. Two concurrent calls to this pipeline, with a real libSQL vector index and a test model, received their own customers' 45-day and 14-day policies. Each stored thread contained its original question and new answer.

Treat excerpts, working-memory values and generated observations as untrusted application data. Render their selected fields as attributed evidence. Keep system instructions, current authorization, tool configuration and approval decisions in host bindings. Model-managed profile tools may update only the authorized scope and fields. Exercise persistent instruction-like text in a profile and a historical tool call in a search match.

### Restarting a paused turn

The host's pause record identifies the exact ordered SDK history supplied to continuation, including the call, approval request and any external results. It can reference stored rows and retain any invocation-only rendered input needed to reconstruct that history. Save the raw application `context`, per-call `toolsContext` inputs or a way to reconstruct them, the ID of the last stored tool message if applicable, and the write receipt. Keep compatible public defaults. Reconstruct trusted services, current authorization and policy on the new process. All processes continuing signed approvals need the same `experimental_toolApprovalSecret` from host configuration. Keep the secret out of messages and pause records. [Native resume contract](matrix/documentation.md#guide-tool-approvals-and-continuation)

Preserve both the raw and the parsed approved tool input. An ordinary JSON round trip turns a parsed `Date` into a string. The SDK can return an input-error result for an unsigned call or reject the changed signed input before execution. The default durable path supports JSON-compatible tool arguments and the defined SDK attachment encodings. For rich values use a verified application-owned codec or reconstruct the original types before native replay. Report an unsupported durable value instead of silently acknowledging a changed pause. [Casai approval handling](../src/runtime/approvals.ts)

For Casai's ordinary `resume()` helper, the only already-stored message it can extend with a decision is the final tool message. Keep its ID alongside the pause. The resumer owns this write, and the caller's messages remain untouched.

```js
const before = pause.history;
const reply = await agent.resume(before, {
  context: pause.context, toolsContext: pause.toolsContext, approve: selectedIds,
});
const after = await reply.messageHistory;
const updates = pause.tailToolId === undefined ? [] : [
  { id: pause.tailToolId, message: after[before.length - 1] },
];
await memory.save({
  scope, turnId: pause.turnId, startOrdinal: pause.nextOrdinal, ifRevision: pause.revision, updates,
  messages: after.slice(before.length),
});
```

The receipt identifies additions and the explicit replacement preserves the input-side decision. For native `.generate()` and `.stream()`, the application owns the boundary between previous history and supplied new messages. It passes the known additions and any explicit edits, then the SDK's new `responseMessages`. The example assumes `pause.history` already contains the persisted inputs. If the application supplies additional external tool results as part of continuation, include those changes in the same write. Never infer the boundary by comparing content or object identity.

**Retrying storage and retrying execution have different effects.** A failed database write retries the saved result under the same IDs. Replaying the same paused snapshot can execute the tool again, including after a crash between a successful side effect and the write. The application owns idempotency or effect reconciliation at the tool, using a stable operation key where appropriate. An approval claim alone cannot make an external side effect transactional. [Executable restart and retry probe](../tests/fixtures/memory-plan-probe.mjs)

## Implementation order and acceptance

### 1. Package isolation and durable transcripts

Implement `MemoryStore`, the message codec, the test store, and the optional integrations. Qualify browser callers for authenticated server-backed history and a device-local backend, starting with PGlite for the latter. Keep the local driver and its assets optional. Publish the tested operations and concurrency guarantees for each browser backend and each supported Mastra driver.

**Accept when** a packed default consumer type-checks, imports and bundles with zero Mastra or PGlite dependencies. Exercise both browser modes through Casai's implemented Memory entry points. Reopen and query a local conversation offline, then use independent browser sessions to write and read one shared server thread and verify owner isolation. Check static and dynamic imports and the public declarations. In an opt-in consumer, test frozen input, role/part fidelity, ordinary attachments, supported rich inputs, and explicit failures at storage limits. Reopen a signed pause in a fresh process. Verify approval and denial, correct and incorrect signing keys, and how repeating the pending snapshot affects tool execution. Retrying an identical completed write must preserve the same IDs, contents and row count.

### 2. Compose Memory with the existing agent

Use explicit recall, an ordinary agent call, and an awaited save. Keep `prepareCall`, `resume()`, native methods, and `.asTool` on their existing contracts. A workflow that persists a tool call explicitly saves authorized messages it owns. For streaming, the workflow forwards or drains the selected native stream once, awaits its result, then awaits persistence. A host returning the stream immediately can expose its own per-invocation completion promise. Casai's `onEnd` aliases SDK `onFinish`; the SDK catches observer errors in `notify`. An observer cannot acknowledge a required write. [Hook aliases](../src/runtime/agent-settings-policy.ts) · [Agent execution](../src/runtime/llm-agent.ts) · [Result history](../src/runtime/augment-result.ts)

Implement count/token limits, chronological pagination and complete tool interactions. A paginated or trimmed read needs a stable order including ties across page boundaries. Use a verified store cursor or a host-assigned turn order plus message position. Protect the current turn and instructions. Persist the complete pause record before marking it resumable. On cancellation or failure retain committed steps and surface incomplete persistence to the caller.

**Accept when** ordinary and native calls with the same explicit additions produce the same stored conversation. Cover whole-history native input, the changed final tool message on resume, external results, raw template and tool context, `Date` revalidation, cancellation, and a failed write after a successful tool effect. Test stale concurrent updates, tied timestamps across pages and read-only recall. Verify that prompt-only excerpts stay out of the user's stored question.

### 3. Working memory and conversation management

This milestone depends on the durable store. Implement thread- and resource-scoped profiles, Markdown templates, schema-backed updates, read-only, agent-managed and application-managed modes. Port thread creation, listing, titles and optional generated titles, summaries, metadata, message edits/deletes, clone lineage and resource reassignment.

| Operation | Concurrency boundary |
| --- | --- |
| Resource profile merge | `supportsAtomicWorkingMemoryMerge` covers `mergeResourceWorkingMemory` only. PostgreSQL advertises it. The pinned libSQL adapter requires an externally serialized read/merge/write for competing updates. |
| Thread profile merge | The base `updateThreadMetadata` serializes updates within one store instance. PostgreSQL overrides it with a transactional row lock. Qualify this separately with two connections or processes, because the resource merge flag says nothing about thread metadata. |
| Pending turn and shared profile edits | Use verified conditional/transactional operations or explicit host coordination in the relevant scope. If the deployment requires competing writers and provides neither, report that the guarantee is unsupported. |

**Accept when** two threads share a resource profile while retaining independent histories, authorized profile updates survive overlapping writers, and scoped deletion, clones and moves preserve source ownership. Confirm storage-only operation without an embedder or vector service.

### 4. Semantic recall on the shared vector interface

This milestone can run alongside step 3. Index short messages directly. Gather eligible texts across the save and call Casai's existing `Embedder` once with the array. The AI SDK's `embedMany` owns splitting by the provider's item and byte limits and scheduling parallel requests according to model capabilities and settings. `VectorStore` upserts take stable IDs, vectors and metadata. Its queries take a vector and return scored IDs and metadata. A native text-only service would require a separately specified capability. [Casai Embedder](../src/factories/Embedder.ts) · [AI SDK embedMany](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many)

Combine the host's resource/thread restriction with supported date ranges, equality, membership, and boolean predicates in the query. Reject a required predicate that an adapter ignores, as the inspected Couchbase adapter does. Hydrate IDs, recheck ownership, expand the requested before/after windows, deduplicate them, and restore chronological order. Compare native fused history/neighbor reads with independent Cascada reads. Use each adapter's score semantics.

Filtered accuracy and cost require separate checks. The libSQL driver defaults to ten index candidates per requested hit for filtered searches on a file-backed index. If enough pass it can return those candidates. If too few pass it runs an exact query with the filter; in-memory libSQL uses the exact path. PostgreSQL uses filtered HNSW ordering with pgvector 0.8+ iterative scans and can fall back when too few candidates are found. Older filtered HNSW and the pinned driver's IVFFlat route use exact ordering. PostgreSQL's native `namespace` can scope reads, writes and deletes by tenant. It is a logical restriction, and its physical query plan still needs measurement. [pgvector iterative scans](https://github.com/pgvector/pgvector#iterative-index-scans)

Vectors are derived records. When indexing is enabled, a successful foreground save acknowledges both the durable update and indexing. If the vector write fails, retry using the completed messages and stable chunk IDs. Retire surplus chunks on edits. For deletion, resource moves and retention, capture the affected IDs or an equivalent scoped deletion predicate durably before losing the source mapping. Repeat cleanup after interruption. The memory domain's `prune()` only touches its own tables. Hydration can omit an orphan while that orphan still consumes a top-K slot.

**Accept when** old messages are recalled from the authorized scope with source IDs. Include closer foreign and out-of-date vectors, a backend that ignores a required filter, stale vectors, a shrinking chunk set, interrupted prune/reconciliation and a retry after either store fails. Count embedding, database and hydration calls to catch accidental per-item work in Casai.

### 5. Observer and Reflector

Use configurable `LLMAgent` calls, `Template` prompts and Cascada `Script` orchestration. The Observer condenses older turns into source-linked observations. The Reflector compacts them into a new generation. Port model choice, prompts, budgets, thresholds, temporal markers, buffering/activation, cursors, extraction hooks, working-memory signals, read/update configuration, history browsing and progress. Raw source lookup works with durable storage alone. An optional vector index searches groups semantically.

Run model work outside database commits. On publication check the expected active observations, monotonic source coverage, cycle ID and current generation. Handle a duplicate cycle, a conflict or a superseded generation according to the provider's actual outcome. Progress flags and pending token counts cannot establish ownership. Mastra raises memory run fences for runs claimed by its workflows store. A standalone Casai Memory does not acquire those claims. Use the verified conditional observation operations, or serialize that scope at the host. Cascada's `!` orders effects within one invocation.

Return a completion handle for background work started by that invocation. A host can collect the relevant handles and await them before closing storage. Durable cursors and generations let another process recover committed progress. Waiting for work in one process does not establish a system-wide drain.

**Accept when** observation overlaps a foreground call, two workers cannot publish a stale generation on a backend advertising that guarantee, and an interrupted computation can resume from committed state. Exercise partial activation, cancellation, structured extraction, group-to-source lookup and awaiting all host-submitted handles. Separate the deprecated resource-scoped mode from thread-local observation in the fixtures.

### 6. Parity and performance

Close the initial inventory against the pinned release. Compare upstream and Casai on the same conversations, models, provider limits and database contents. Include a durable/vector backend and a second provider with different capabilities. Measure embedding request counts and sizes, database round trips, time to first token, time to a durable turn and completion of background work. Compare ordinary TypeScript and Cascada Script for the same reads, ordering and failures. Separate cross-thread throughput from contention within one thread.

**When vector latency matters.** Functional Memory support needs the scoped correctness and call-count tests in step 4. Run a scale benchmark when choosing an index/backend for a deployment or making a performance claim about Casai. Use the same vectors, predicates, K, concurrency and warmed index for the direct adapter and the Casai path. Time query alone, message hydration, and end-to-end recall (including embedding) separately. Record median and p95, the share of rows eligible for the filter, and indexed versus exact-scan plans. Compare approximate results to exhaustive filtered neighbors when reporting retrieval quality. Dataset size and any pass/fail latency target come from the workload or comparison being reported.

**Document RAG has its own acceptance.** Reuse `VectorStore` for cited Markdown passages, with document readers, an author-selected `Chunker`, and optional reranking. Semachunk can supply a long-message or document strategy when integrated. Reuse its final embedding only when model, settings and indexed text match. Compare labeled retrieval quality and cost before choosing it as a memory default. Document readers, source-location extraction and the `retrieve` workflow can ship independently of all six Memory steps. The libSQL `knowledge` domain is a candidate to assess for the separate Knowledge proposal. [Component roadmap](future.md#proposed-components-for-document-retrieval-memory-and-knowledge)

Complete the [implementation review](review-process.md) and the [affected verification gates](../tests/README.md#where-the-time-goes) on the settled candidate.

## Reproducing the review evidence

From a built Casai checkout (`npm run build`), use a separate installation directory for the published comparison packages. The fixture uses test models, creates its own temporary database, and opens it in a fresh process. Run these commands in PowerShell. [Executable probe](../tests/fixtures/memory-plan-probe.mjs)

```powershell
$probeDir = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $probeDir | Out-Null
npm install --prefix $probeDir --no-save --no-audit --no-fund '@mastra/core@1.86.0' '@mastra/memory@1.41.3' '@mastra/libsql@1.32.0' '@mastra/pg@1.38.0' '@libsql/client@0.18.0'
node tests/fixtures/memory-plan-probe.mjs $probeDir
node tests/fixtures/memory-plan-probe.mjs $probeDir bundles
```

The executable checks the trailing tool-message update, a write retry, a repeated execution, missing resume context, a changed signing key and denial. The signed `Date` control resumes with the original type and fails after plain JSON serialization. Two libSQL connections competing to publish an observation produced one commit and one conflict, and a later write to the retired generation was refused. A selective vector query returned its eligible hit despite 81 closer excluded entries. For 32 short messages the pinned Mastra Memory issued 32 single-item requests. Passing the same texts to Casai's existing Embedder produced four SDK requests of eight.

The `bundles` argument reproduced all six sizes in the table from the original installations. A fresh npm installation with the same direct pins resolved two newer transitive packages and produced published-Core bundles three bytes larger in each case. Use a lockfile for byte-for-byte reproduction. Building the private fork from scratch, the adapter-family scan, partial-copy checks and document retrieval experiments remain separate prototype evidence.

For the PostgreSQL cases, set `CASAI_MEMORY_TEST_POSTGRES_URL` to a disposable PostgreSQL database with pgvector available and run `node tests/fixtures/memory-plan-probe.mjs $probeDir postgres`. The probe creates a fresh schema and uses two independent pools. The recorded runs used a local PostgreSQL 18.6 instance with pgvector 0.8.6. Run once per Core installation being qualified.

For the two browser probes, install the pinned browser packages in their own directory. The probe uses the linked Cascada development installation's Playwright and gets the browser executable from `CASAI_REVIEW_CHROMIUM` when set. It serves the browser runtime locally. Passing the Mastra comparison installation as the second argument also exercises separate browser sessions against a temporary file-backed database. [Browser database probe](../tests/fixtures/memory-browser-probe.mjs)

```powershell
$browserProbeDir = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $browserProbeDir | Out-Null
npm install --prefix $browserProbeDir --no-save --no-audit --no-fund '@electric-sql/pglite@0.6.0' '@electric-sql/pglite-pgvector@0.1.0'
node tests/fixtures/memory-browser-probe.mjs $browserProbeDir $probeDir
```
