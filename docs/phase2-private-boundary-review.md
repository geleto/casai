# Phase 2 private-data boundary investigation

> **2026-10-23 revision:** Casai-created tools now require declared, closed top-level input and reject undeclared raw keys before parsing. This supersedes the open-root tool proposals below; ordinary open components retain the known-private-binding rules. Nested public data remains public, and trusted transforms/forwarding retain their obligations. See the [current contract](plan.md#remaining-phase-2-decisions) and [verification record](phase2-review.md#closed-tool-input-contract-revision-2026-10-23).

> Historical design evidence: the isolated prototype implementations and their runnable checkers were retired on 2026-10-21. Current acceptance uses production factory, schema, registry, lifecycle, generated security and public-consumer tests. See the schema-identity correction in [the review ledger](phase2-review.md). Historical commands and prototype source names below describe the investigation, not current regression gates.


Date: 2026-10-19. This is an isolated design investigation, not production security implementation or a completed whole-surface review. The previous schema/API proofs establish bounded feasibility under an older admission policy; they do not establish the stronger security requirement below.

**Subsequent confirmed clarification:** actual private bindings are identifiable from their own runtime properties without a context schema; supported existing context declarations can also reserve absent optional names. A private name existing only in an erased type or the author's intent is an authoring limitation, not an unidentifiable existing binding. The user accepted this narrower guarantee. This does not authorize a model to replace any identifiable private binding, or imply production integration is complete. Earlier counterexamples below retain their evidence; read their former readiness implications in light of this clarification.

## Confirmed intent and scope

- Model-controlled arguments must not replace private execution data, including private configured dependencies and incoming tool context. An open/catchall input schema is not permission to overwrite a private binding. This supersedes the earlier schema-only override permission.
- Keep one application `inputSchema`. Optional `toolContextSchema` validates trusted incoming context; it is not a second public-input schema. Do not add an author-maintained private-key schema, model-origin tracker, or JSON serialization pass.
- Trusted JavaScript/Cascada code may forward private dependencies to other components. Preserve that capability through configuration and existing trusted-context channels. Distinguish forwarding from admitting model fields as private data.
- Bare `.asTool` descriptors should accept private-only native `toolsContext`. Public defaults supplied by incoming context still require explicit immutable binding. This is the user's accepted 2B direction.
- Base the design on the newer `C:\Projects\cascada-chain-resolution` runtime. Do not patch the currently installed Cascada engine for this investigation.
- Schema-backed ordinary calls use the same private-collision boundary as tool calls while retaining trusted forwarding through configuration/tool context. The [decision record](plan.md#remaining-phase-2-decisions) now includes the confirmed registered-tool-name rule and explicit-public-declaration direction. The permissive-schema stand-in still does not prove production no-schema inference; no blanket private-override flag has been adopted.

## Reproducible evidence

Run `node tests/fixtures/phase2-private-check.cjs`. It compiles the harness and bounded caller sketch with TS7/TS6 and both exact-optional settings, runs both runtime investigations, and checks guard-removal mutations. This is not a final public security typing proof: the native registry harness deliberately erases context types and labels its narrow SDK assertion. The existing public call fixture is used unchanged to reproduce direct-call bypasses.

The initial investigation completed 36 runtime cases, TS7/TS6 with exact-optional on/off, two guard-removal mutations, and focused ESLint. The subsequent hybrid evaluation below extends this evidence; passing counterexamples are still unresolved behavior, not protection. No paid model calls or full test suite ran. The newer runtime's three focused entry tests and public-operation probes described below also passed. No production source or sibling-project file changed.

Completed hybrid validation: **60 combined runtime cases**, TS7/TS6 under both optional-property modes, four independently detected runtime guard-removal mutations, one detected private-key type-guard mutation, and focused ESLint. The mutation pass exposed and corrected an initially weak assertion: a throwing body was not evidence that execution had been prevented. Relevant rejection tests now assert zero body entries. The passing suite includes explicitly named counterexamples and is not a clean implementation-readiness pass.

The [tests](../tests/Phase2PrivateBoundary.unit.test.ts) distinguish protective cases from explicit counterexamples. A passing counterexample test means the vulnerability/ambiguity was reproduced, not solved. The [candidate](../tests/fixtures/phase2-private-boundary.ts) protects **known own root private slots** only; it is not the approved final adapter and its minimal metadata projection is not the production projector.

| Boundary / case | Evidence and consequence | Status |
| --- | --- | --- |
| Configured private field plus open input | Zod 3/4 passthrough, catchall, and SDK JSON metadata without a validator all admit extra fields natively. A parsed-input collision check rejects known private names before successful SDK input/approval hooks. | Demonstrated candidate protection in generation and streaming. |
| Bound private context | Known fields from original context-schema output, including transforms/defaults, are available before public argument validation. No private values appear in the candidate's collision diagnostic. | Demonstrated. |
| Input transform creates private output key | Checking only raw model argument names misses `alias -> userId`. Check the parsed value against known private bindings. | Demonstrated. |
| SDK refines input after validation | Native `experimental_refineToolInput` runs after the schema and does not revalidate its returned value. Input hooks can also mutate that object. A final execution collision check stops body execution. | Demonstrated; earlier hooks can still see refined input. Do not claim schema validation is the final SDK boundary. |
| Bare native private-only context | Metadata preparation does not parse absent incoming context. Preserve original native `contextSchema`; native execution supplies its parsed private context. | Demonstrated 2B direction. |
| Bare incoming public defaults | A parsed incoming context containing a named public input field requires `bindToolContext`, even when that value came from a context-schema default. An unbound descriptor cannot retrospectively change SDK argument parsing. | Demonstrated execution error; it can occur after approval. |
| Bare private collision | Incoming private fields are not known to the argument validator. Check them at execution before invoking the body. | Demonstrated; approval can already have run. |
| Approval continuation | Native revalidation rejects injected private arguments/mismatched approved input without body execution. | Generation and streaming probes; native comparison in earlier adapter proof remains relevant. |
| Public defaults and unrelated extras | Named public defaults retain argument > incoming context > configuration priority. Non-colliding extras follow the schema. Strip/reject behavior is retained; no extra parse. | Demonstrated. |
| Trusted forwarding | An outer implementation selects its trusted `userId` and binds it to a child. It may replace the child's configured dependency; child model arguments cannot replace it. | Demonstrated without shared mutation or new API. |
| Ordinary child call / `.run()` | A protected outer tool with open input can forward an undeclared `userId` into the older direct-call fixture, which permits the child's private dependency to be replaced. | Unresolved policy/integration boundary. Registered-tool-only protection is insufficient. |
| Absent optional private name | Context-schema output `{}` has no own `userId`, even if its optional output type contains that name. The candidate admits model `{ userId: 'admin' }`. Opaque transforms make general output-name discovery impossible. | Unresolved ownership representation; not fixed by the candidate. |
| Nested configured public object | Naming root `settings` selects the entire configured value. An open nested schema can publish `settings.userId` in tool history and the next request. | Root ownership is shallow. A field intended to be private must not be placed in a public configured value; deeper ownership would be a separate contract change. |
| Explicit public declaration | Declaring `userId` in application input makes it a public input/default under the existing convention. The framework cannot infer that application code intended the same name to be private. | Authoring boundary, not a guessed auth-name blacklist. |
| Metadata-looking model fields | The candidate injects actual `_toolOptions` last and excludes its native context. A forged metadata-shaped argument does not acquire authority. | Demonstrated. |
| Prototype-shaped JSON | Candidate object spreads preserve prototypes. Installed Cascada subsequently uses assignment and can expose an inherited name. The newer chain runtime treats managed properties as own data and does not reproduce it. | User selected newer runtime; no legacy patch. Verify the eventual compiler/renderer handoff, not just graph operations. |

Trace all step responses and the actual next model request when checking disclosure. In this installed SDK, `ToolLoopAgent`'s final `response` alone can omit earlier steps; inspecting only it can miss a private value recorded in an earlier tool call. This investigation uses `steps.flatMap(step => step.response.messages)` and mock provider-call records. Deliberately returning private data from a trusted implementation is different from Casai automatically placing it in public arguments.

## What the candidate cannot establish

### Visibility, forwarding, and replacement are separate questions

The user asked to explore preserving flat fields before adopting a private namespace. A mandatory `auth` object is **not accepted**. It is one possible representation for absent private ownership, not a prerequisite for protecting ordinary present private bindings.

Distinguish the caller, the called component's trusted implementation, and the remote model. The implementation may read its own configured dependencies, explicitly inherited configuration, and the selected incoming tool context. Calling a component does not grant access to the caller's entire context. The owning workflow supplies a per-tool `toolsContext` entry; an outer incoming context does not automatically propagate to a nested registry. Explicitly forwarding a selected dependency is intended sharing. Native tool-call options also expose their documented messages/metadata; that is separate from access to the caller's server-side context.

| Situation | Intended result |
| --- | --- |
| Script/Template/Function `.asTool` reads its own configured private dependency | Allowed and necessary. Being a model-callable tool does not make its trusted implementation untrusted. |
| A called tool reads the caller's private fields merely because it was called | Not allowed by the context contract; do not automatically copy the caller's context. |
| Trusted caller explicitly forwards a selected private dependency through configuration/tool context | Allowed. Other caller fields are not implicitly shared. Configuration inheritance is also explicit sharing, distinct from the call relationship. |
| Model supplies the name of a private binding in public arguments | Must not replace the private binding, including on forwarded child calls. This applies to primitives as well as objects. |
| Trusted preparer of an LLM-backed `.asTool` reads its dependencies | Allowed. The host component and its model are different actors. |
| Remote model directly reads host configuration or tool context | It has no direct access. Casai must not automatically serialize private sources into provider input. |
| A preparer, description callback, or tool result deliberately includes a private value in provider-bound content | The model can read that content. This is explicit publication by trusted code, not automatic context access. Data required to stay secret must not be placed there. |
| Model changes an authorized public value, or requests an exposed operation | Public overrides and authorized tool operations are legitimate. Neither grants permission to replace private identity/dependency bindings. |
| Component writes through a supplied read-only managed reference | Reject at the language integration boundary. Local working copies can still change without mutating shared inputs. |

The word private currently combines two concepts: unavailable as a caller-controlled argument and not automatically disclosed to the model. A trusted value can intentionally be rendered into a prompt while remaining non-overrideable. Neither an `auth` namespace nor `inputSchema` alone prevents deliberate publication by trusted code. Conversely, an argument-collision attack can change effective identity without reading any caller secret or mutating its original object.

### Alternatives to a mandatory private namespace

Keep flat access as the first design to evaluate. Present private fields already have names at runtime, including fields whose values are `undefined` or `null`; the candidate protects them without nesting. For ordinary object-shaped `toolContextSchema`, declared optional private names are also available without requiring a second schema. Extending ownership discovery to those existing declarations is a candidate, not yet a general output-shape solution: transforms can remove/rename/create output fields and opaque schemas need not expose them. Raw context-schema input names must not be silently treated as its parsed private output names.

Closed public input schemas provide another existing route: reject or strip undeclared model fields using `inputSchema` itself. A dynamic public dictionary can remain inside a declared application field. This preserves flat declared/private fields but does change the ability to supply arbitrary root extras, so do not impose it globally without a decision. Input transforms are trusted author code; checking their actual parsed output against known private names remains necessary.

The unresolved combination is unrestricted extra public names, absent private names with no recoverable runtime declaration, and one flat implementation object. Neither read-only storage nor reversing merge precedence creates the missing ownership information. Do not require a new namespace before evaluating the common existing-schema cases, and do not describe this corner as every tool automatically gaining caller context or every LLM gaining host-memory access.

A name present only in a TypeScript type does not exist at runtime. An arbitrary context transform may return either `{ userId }` or `{}`; neither probing callbacks nor inspecting its input names reveals all possible private output names. General validation metadata also need not describe transformed output. A second author schema or callback introspection would contradict the requested direction without resolving the basic ambiguity.

For example:

```ts
// Public input accepts arbitrary extra names.
inputSchema: z.object({ query: z.string() }).passthrough()
// Actual trusted context in this invocation:
{}
// Model arguments:
{ query: 'report', userId: 'admin' }
```

With flat execution data, the runtime cannot distinguish an ordinary allowed extra field from an absent private `userId` the implementation intended to read. Closed public root shapes avoid this particular injection; arbitrary root transforms still remain trusted author code. A separate trusted object/reference preserves that distinction even when a private child is absent. For instance, a present private `auth` object with optional `auth.userId` cannot be replaced by public arguments, and the implementation reads identity from `auth`, not a similarly named public field. That is a meaningful ownership structure, not a second validation schema. Whether it is required, or merely recommended while flat optional private slots remain supported, is not yet settled.

Do not call the known-slot guard a universal guarantee, silently require dummy `undefined` slots, or reject opaque context schemas solely to make the implementation easier. Likewise, arbitrary trusted code can explicitly copy a model value into a trusted binding, return private data to a model, or mutate an external client. Neither input validation nor read-only managed storage can prove the intent of such code. The design must protect the supported application-data boundary without promising to sandbox native implementations.

## Hybrid evaluation: closed input plus protected open input

The user authorized evaluating this proposal, not silently adopting new admission restrictions. **Result: the hybrid is feasible for identifiable private names, but it does not establish a universal guarantee for arbitrary flat schemas.** Keep the integration gate open. See [runtime tests](../tests/Phase2HybridBoundary.unit.test.ts), [bounded discovery](../tests/fixtures/phase2-hybrid-boundary.ts), and the [caller signature sketch](../tests/type-safety/phase2-private-boundary.ts).

### Demonstrated schema-backed boundary

Let `P` be explicitly named raw application input declarations. Let `K` be the union of own configured fields, actual parsed tool-context fields, and discoverable declared parsed-context names, excluding `P`. A catchall/pattern permitting a name does not promote an existing private binding into `P`.

1. Keep private values out of the application parser. Merge only selected public defaults with caller data and parse using the original `inputSchema`.
2. Reject any retained parsed application key in `K`. A stripping schema may remove a raw extra; a strict schema rejects it. A private collision retained by an open schema fails rather than silently winning or being silently restored.
3. At SDK execution, repeat only the collision check against the final input and actual private context; do not repeat application parsing. Native refinement and hooks can change input after initial validation. Bare descriptors learn actual incoming context at this later point, so a previously unknown collision can fail after approval.
4. Apply the same application/private boundary to ordinary calls and `.run({ context })`, The proof's permissive-schema destination is not proof of a production no-schema policy; production no-schema configured-name protection and its migration/types still require integration. Keep trusted forwarding in the existing configuration/tool-context channel. SDK/injected calls enter prepared execution rather than calling the public callable again.
5. Merge prepared private bindings and accepted public input using the existing public precedence. Add actual execution controls separately. Private-name declarations used for rejection do not materialize missing properties in the execution object or appear in public tool metadata.

This preserves one application schema and ordinary merging. It does introduce a private-collision boundary, which is the security requirement itself, not a second author-maintained input schema. It does not discover undeclared semantic intent in arbitrary code.

### What the extended proof establishes

| Case | Finding |
| --- | --- |
| Zod 3/4 object context with absent optional `userId` | Reading `.shape` protects the absent name without parsing, adding dummy values, or converting functions/Dates to JSON. Bound and bare tools reject it before input/approval hooks. |
| Supported optional/default/catch/readonly wrappers | Public unwrap handles preserve declared names. Native context parsing/default behavior remains native. |
| Zod 4 transform followed by a declared object pipe | Read `.out` for context ownership; the declared output can name optional `userId`. Public input default discovery still uses raw input handles. These are different operations. |
| Root transforms / Zod 3 effects / SDK metadata-only context | General output names remain unknown. Input metadata cannot safely stand in for output declarations. No callback probing or schema interpreter was added. |
| Declared context unions | Reserve known names across declared branches, including inactive ones. The original candidate discarded these names when another branch had opaque output; the [2026-10-20 correction](phase2-review.md#partial-context-knowledge-review-2026-10-20) retains partial known declarations. Opaque names remain unknown. This is not a proof of general input-union/composition admission. |
| Forwarding through ordinary child callable or `.run` | The shared candidate guard prevents replacement of a known child dependency. A permissive metadata schema with `properties: {}` was included. It does not establish production no-schema inference or default-override compatibility; actual no-schema factories need paired runtime/types for the explicit-public-declaration direction. |
| Concurrency | Independently bound private identities remain separate; the original configuration is unchanged. |
| Control-shaped public fields | `context`, `toolsContext`, `abortSignal`, and `_toolOptions` inside application arguments do not acquire control authority. Actual metadata comes from the invocation. |
| Raw closed input plus a transform | Strictness alone does not protect transformed output; a transform can produce a private key. The output collision guard rejects known private names. |
| Type checks | A bounded generic signature can reject visible private keys, including optional fields, explicit `undefined`, variables and `.run`, while retaining configured public defaults, raw transform input types, and unrelated extras. It is not the final factory signature/completion/declaration proof. |
| Erased types | Assigning an object to a narrower structural type can hide an actual private key without a cast. Conversely, optional configuration names can exist in a type and be absent at runtime. Runtime and compiler guarantees are not interchangeable. |

The candidate intentionally does **not** fail closed for unknown output declarations; it reproduces the remaining attacks so that this limitation cannot disappear behind a passing suite. Supporting a shape accessor is not a declaration that every private name is known. Catchalls and arbitrary output transformations can introduce other names; present outputs are protected, but absent unreported names are not.

### Provider strict mode defaults and scope

Local source inspection and a native preparation-function probe on 2026-10-19 verified the installed `ai@7.0.130`, `@ai-sdk/openai@4.0.86`, and `@ai-sdk/anthropic@4.0.74` behavior:

| Layer | `strict` omitted by the tool | Explicit `strict: true` |
| --- | --- | --- |
| AI SDK core `prepareTools` | Leaves the field absent; no global strict default. | Forwards `true`. |
| OpenAI Chat adapter | Omits the request field. OpenAI Chat Completions is non-strict by default. | Forwards `true`. |
| OpenAI Responses adapter | Explicitly sends `strict: false`. | Forwards `true`. |
| Anthropic adapter, with strict-tool support enabled | Omits the request field; does not enable strict mode itself. | Forwards `true`; unsupported providers instead receive a warning and no strict field. |

The probe passed omitted/false/true through core tool preparation and the actual provider preparation functions, asserting each output. It made no provider requests. Source: `ai/src/prompt/prepare-tools.ts`, OpenAI `chat/openai-chat-prepare-tools.ts` and `responses/openai-responses-prepare-tools.ts`, and Anthropic `anthropic-prepare-tools.ts` under their installed packages. Recheck these defaults on dependency upgrades.

Distinguish this from the [direct OpenAI API default](https://developers.openai.com/api/docs/guides/function-calling#strict-mode): omitting `strict` in Responses attempts strict normalization and can fall back to non-strict mode; Chat Completions remains non-strict by default. The installed Responses adapter sends an explicit `false`, so that omission behavior does not apply to its default tool request.

**Scope of the absent-name example:** when a provider enforces a closed root schema that does not declare `userId`, the model cannot introduce that extra argument. This prevents that particular fresh model-output injection. It is inaccurate to describe the problem as occurring only when a strict flag is off: direct/local calls and post-generation transformations are outside provider enforcement, and a strict flag can be unsupported. Conversely, disabling provider strictness does not create the problem if local validation rejects or strips the extra field. The relevant condition is whether the effective input path admits an undeclared extra that implementation code incorrectly treats as private.

There are three independent concepts: Zod/local validator behavior, JSON Schema object keywords, and provider `strict`. The installed SDK's `jsonSchema(metadata)` validator is optional. A focused generation/streaming probe supplies unexpected `userId` with `additionalProperties: false`, both with and without `tool.strict: true`; the local SDK accepts it when no validator is supplied. This is a deliberately nonconforming mock response, not evidence that a conforming strict provider emits invalid arguments. It establishes that a provider flag does not enforce direct calls, custom providers, histories, or later refinements locally.

`additionalProperties: false` also does not universally mean a finite list of keys: `patternProperties` can still permit dynamic names. Schema-valued `additionalProperties` is another open mode. Classify actual supported schema behavior rather than branch on one boolean. See the [JSON Schema object rules](https://json-schema.org/understanding-json-schema/reference/object#additionalproperties).

Preserve native `strict` forwarding and provider support, with local validation/private ownership independently enforced. [OpenAI strict function calling](https://developers.openai.com/api/docs/guides/function-calling#strict-mode) requires every object to forbid additional properties and every declared property to be required. Casai's configured-default omission projection can violate the latter requirement; do not silently remove overrideable fields, change omission into `null`, or disable strict mode. A nested open dictionary is locally useful but is not automatically compatible with recursive provider strictness; arrays of closed key/value entries are a possible application representation where supported.

### Confirmed authoring boundary and recommendation

These three requirements cannot all be guaranteed for arbitrary schemas:

- arbitrary extra public names at the root;
- flat reads of optional private fields that have no runtime declaration;
- automatic prevention of those public names impersonating the absent private fields.

For example, a string-to-context transform returns `{}` when unauthenticated, while its TypeScript output type contains optional `userId`. An open public input accepts `{ userId: 'admin' }`. Actual key scanning cannot know that `userId` was meant to be private; input-schema metadata describes the wrong channel. Even a closed raw schema can deliberately map `alias` to `userId` in an opaque transform, so trusted author transformations remain part of the authoring boundary.

**Confirmed direction:** protect actual private bindings and supported declared private names on every call path. Actual properties remain identifiable even without a context schema or when their values are `undefined`; opaque schemas still supply inspectable actual output properties. Do not discard that protection when complete output-name discovery is unavailable. An absent name with no runtime declaration cannot be reserved based only on a TypeScript annotation. Application code must not treat arbitrary accepted extras as trusted identity. Keep this authoring limitation explicit rather than introducing mandatory closed input, private namespaces, opaque-schema rejection, another author schema, or model-origin tracking. Closed public shapes and runtime representations of optional trusted names are recommended authoring practices, not blanket admission requirements.

Native code that explicitly moves model data into trusted `toolsContext`, spreads arguments into a `.run()` settings envelope, executes model-provided source, or publishes private values is granting authority through a trusted application action. Casai must not do this automatically. Schema validation cannot infer the author's authorization intent inside arbitrary callbacks, and this review does not propose taint tracking or a native-code sandbox.

### Surface trace and remaining integration obligations

| Surface | Source / consequence |
| --- | --- |
| Function ordinary/tool paths | `src/factories/Function.ts` currently has raw context spreading and distinct tool execution paths. Both must converge on the selected preparation contract; preserving the old ordinary override would reopen the child bypass. |
| Script/Template, inline/loaded modifiers | Factory normalization flows into `ScriptEngine.ts` / `TemplateEngine.ts`. Their current raw configuration merge must not restore stripped/transformed application data or run after guarded preparation. New runtime read-only references and own-property lookup need eventual renderer/compiler integration tests. |
| Text/Object factories and preparers | `llm-component.ts`, `renderer-tool.ts`, and `prompt-renderers.ts` carry context into multiple renderers. The current prompt-config copier omits `inputSchema` while retaining configuration; security must be owned before that handoff, without a second raw merge. Apply correctness fixes to retiring factories; do not add deferred LLMAgent APIs. |
| `.run`, inheritance and controls | Validate the application `context` separately from trusted settings. Whole config inheritance is explicit sharing. A model-shaped object must not be automatically interpreted as config/source/history/`toolsContext`/cancellation controls. |
| Registered/injected tools | SDK and coded wrappers need the same bound descriptor and selected raw context. Normalize Cascada keyword markers before parsing; no marker or model property may authorize a validation bypass. Plain native tools keep separate `input` / `options.context`, not Casai flat semantics. |
| SDK generation, streaming and repair | Fresh and repaired calls reach SDK parsing; refinement follows it. Guard the returned parsed arguments and final execution. Raw input hooks and execution callbacks are distinct trusted boundaries; the final guard cannot retroactively prevent their execution. |
| Approvals, persisted UI, history | Native approval revalidation was exercised by the original security proof. UI helpers validate exposed `agent.tools` before `prepareCall`; the selected binding must already match there. This extended hybrid proof does not close the UI integration gate. |
| Public sinks | Check all step messages, subsequent provider requests, model-facing schemas, descriptions/examples and outputs. Named configured public values are public, including nested retained data. Author-produced prompts/results/descriptions are intentional publication channels, not automatically private because their source was context. |
| Type surface | Carry the policy into real inherited Config/Function/Script/Template/LLM signatures, `.run`, tools and binding consumers; check declarations/editor inference. The bounded signature sketch does not replace this work. |

No production factory or newer-runtime source was changed. This is a focused security evaluation with explicit remaining design/integration gates, not a completed security audit of an implemented Phase 2.

## New chain-resolution runtime

Read the runtime's `docs/data-limitations.md`, `docs/managed-and-external-state.md`, `docs/enter.md`, `docs/integration.md`, `src/chain.js`, `src/enter.js`, `src/path-operation.js`, and `src/language-properties.js` in the sibling project. Its integration/compiler work is distinct from the currently installed engine; do not assume that reading the newer kernel proves the future complete renderer path.

Managed data means records, arrays, and opted-in class instances whose visible state Cascada can traverse, resolve, copy, and isolate. It does **not** mean immutable application data. Imported storage is protected; a managed owner can still acquire a changed logical value through copy-on-write. Native exports are detached for managed structures; functions and external identities retain their own trusted-code contracts.

Focused public-operation probes demonstrated:

1. Import `{ auth: { userId: 'alice' } }` into `ContextChain`; assign the managed `auth.userId` to `'admin'`. The source remains `'alice'`, while exported logical context contains `'admin'`.
2. Freeze both source containers before import. The same logical change succeeds without changing the frozen source. `Object.freeze` is not a read-only authorization policy for managed values.
3. Enter `auth` using `enter(..., false, ...)`. An attempted assignment through the returned read-only Chain fails. Currently this trusted-integration misuse produces `FatalError: Cannot mutate through a read-only Chain`; do not promise a user-facing script diagnostic from that kernel guard alone.
4. Import JSON containing `__proto__: { userId: 'admin' }`. Looking up root `userId` returns `undefined`; inherited names do not become managed fields.
5. Three existing focused entry tests passed: a read reference across delay, preservation of imported storage, and read-only Function/external targets.

**Recommendation:** reuse read-only references for Casai's supplied context and trusted dependencies at the language integration boundary. Keep local managed working data writable: constructing a local result with copy-on-write is compatible with a stateless component. Prefer reference/path permissions to a permanent global read-only mark on object identity; the same data may legitimately have a read-only borrowed view and a mutable local working copy. Do not add global freeze registries, deep proxies, or security taint to the graph runtime.

This still needs a focused integration contract: root binding replacement/deletion and descendant writes, mutating methods, nested entries/reference arguments, aliases, delayed values, returned exports, and external calls must respect the chosen reference permission. `!` orders authorized effects; it must not grant authority denied by a read-only reference. A read-only view does not make an exported copy permanently trusted. Public arguments and trusted context must remain distinguishable at the next Casai call boundary.

The runtime expressly relies on trusted native-code contracts and is not a sandbox against deliberate corruption of its programming interfaces. Do not expand it into one implicitly. Read-only context protects supported Cascada operations, while the Casai input boundary protects against model-supplied substitutions.

## Remaining whole-surface work before readiness

Integrate the confirmed identifiable-private-name contract and review every factory and modifier, shorthand and `.run`, injected keyword/named calls, inherited configuration, Function/Script/Template and LLM preparers, immutable tool registries, native generation/streaming/approval/UI continuations, and final renderer context. Include no-schema components as forwarding destinations and native SDK tools as distinct input/context owners. Model arguments must not become source strings, configuration overrides, `toolsContext`, or cancellation/control options merely because their field names match those settings. Do not reopen the accepted type-only/undeclared-name authoring limitation as a requirement for a new schema or namespace.

Carry both runtime and caller-type checks through the actual chosen API. Type checks cannot protect raw JSON or recover erased optional runtime names. Pair closed/open schemas, transforms, trusted forwarding, optional/opaque context, and all entry paths; include mutation checks that remove each load-bearing boundary. The isolated proofs and the proposed read-only reference policy do not replace a subsequent complete pass without important unresolved findings.

## Review reconciliation and current-source probes, 2026-10-19

The authoritative algorithm is in [context preparation](plan.md#context-sources-and-preparation), including parsed private-collision rejection and the final executor check. At the time of the following current-source probes, the isolated security fixture did not establish combined callable typing, source-free union behavior, actual no-schema calls or registered-tool-name protection. The subsequent [composed proof](phase2-composed-api-proof.md) now covers those bounded cases. Final factory/type and renderer integration remain outstanding; the fixture is not the production adapter.

Recent local probes against `src` and the installed SDK confirmed:

- A stripping Script schema validates successfully but raw caller `userId` replaces configured `userId` during execution.
- A strict Script rejects that input normally, but caller `_toolCallOptions: {}` bypasses its validation.
- A Script model tool with an open schema executes model-supplied `userId: 'admin'` over configured `userId: 'member'` through native `ToolLoopAgent`.
- Schema-less Template and Function currently allow configured default overrides. The later confirmed policy protects configured names on every call; the composed proof now exercises that change, including forwarded model input.
- A source-free discriminated union passes native `validateTypes` but fails the private candidate's unconditional `declaredFields` call. Production must not inherit that regression; it needs a paired capability/signature test.
- An ordinary Script or Template receiving an own `__proto__` object through metadata-only input can expose an inherited `userId` on the installed old runtime. However, fresh raw SDK model calls containing that key were rejected in both generation and streaming before execution: the native JSON parser reports `Object contains forbidden prototype property`. Do not describe the ordinary-call reproduction as proof that fresh raw SDK tool arguments bypass that parser. Other entry paths still need their own checks.

These probes made no paid model calls and changed no production files. They establish current-source behavior, not the contents of a published release. Using parsed values and removing the forgeable marker alone would not close retained open-schema private collisions. The user-selected newer runtime remains the integration target; this evidence does not authorize legacy-runtime patches. Its compiler cutover is still planned cross-repository work and needs a renderer-level handoff check in addition to kernel tests.

## Subsequent decision scope

Registered executable fallback names now join the protected names unless explicitly declared as public application input. Trusted configured/context shadowing remains supported. The user's current-source fixes stay in Phase 2; no separate release/advisory decision is pending. The explicit-public-declaration contract is resolved without a blanket private-protection bypass. Open public schemas already permit unrelated extra data; provider strictness does not disable local checks. The earlier security fixtures retain their dated scope; the separate composed candidate demonstrates tool-name and actual no-schema protection with paired runtime/callable checks. Production factories still need integration.

## Prototype-key and diagnostic follow-up, 2026-10-19

A later external review correctly distinguished fresh model JSON from application-parsed ordinary input and client-held UI approval history. A local probe used three payloads: own `__proto__`, own `constructor` containing `prototype`, and nested own `__proto__`. Native `safeParseJSON` rejected all three. Native `validateUIMessages` accepted the same objects through a metadata-only tool schema, including an approval-response record with matching `inputSchemaInput`; UI validation is not a repeat of secure JSON parsing.

The probe then invoked the composed binding with an absent but declared private `userId`, imported its execution context into the selected newer `ContextChain`, and looked up `userId`. All three payloads left that field absent, retained the ordinary object prototype, and did not modify `Object.prototype`. The new kernel reads own data descriptors and defines missing properties without invoking inherited setters. This is adapter-plus-kernel evidence, not an end-to-end compiler/renderer or resumed SDK execution test.

Keep these distinct inputs in the renderer handoff acceptance tests, including ordinary forwarding, SDK UI/approval continuation and schema-produced objects. Verify that Casai merging and language import never reinterpret inherited names as application/private bindings. The old engine reproduction does not justify adding a temporary Casai recursive key ban: the user selected the newer runtime and explicitly excluded legacy patches. A contrary result on the selected full path would reopen the implementation finding; the handoff remains a completion gate.

Collision errors intentionally identify private key names, so names themselves must not contain secrets. They must not disclose configured values or permit a collision merely because its value matches. The composed regression now tests both a matching private sentinel and own `undefined`, rejecting both without body entry or value disclosure in the collision diagnostic.

The subsequent [consumer-first review](phase2-review.md#consumer-first-review-2026-10-19) found a separate confidentiality path: a native validation error from an injected tool's private context can be converted into an outer tool result and sent to the model. The composed runner now uses a safe `ConfigError` summary at its owned validation boundaries, retaining the native cause for trusted diagnostics. Generation/streaming tests inspect actual next-provider requests and a mutation reopens the leak. Carry this correction into production; successful argument-collision tests do not establish error-path confidentiality.

The next [binding continuation review](phase2-review.md#binding-continuation-and-call-envelope-follow-up-2026-10-19) found the same disclosure at a different owner: lazy binding-context preparation reached through approval argument revalidation before metadata. It can emit stream/UI error text with zero provider requests and rejected history promises. The candidate now wraps that context parse at its source, with separate first-consumer, generation/streaming continuation, UI and mutation checks. Keep both error boundaries in production; neither a next-request sentinel check nor a passing private-collision guard covers all failure transports.

The [dictionary-boundary pass](phase2-review.md#dictionary-boundary-and-whole-surface-pass-2026-10-19) then found adapter defects outside the earlier payload/kernel probes: inherited values affected selected-default requirements, context lookup and binding checks; assigning a fallback named `__proto__` changed the execution prototype; and structural type assignability hid a `toString` helper. Own-entry reads, data-property insertion and declared-key typing now preserve the intended contract. These are Casai adapter corrections, not patches to the superseded runtime or a name blacklist. No new model/private replacement or disclosure was demonstrated by those cases.
