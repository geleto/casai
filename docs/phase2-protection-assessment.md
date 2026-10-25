# Phase 2 protection assessment

Date: 2026-10-20. This extends the [security reviews](phase2-review.md#generated-security-and-consumer-review-2026-10-20). It evaluates additional mechanisms now; the [shared enforcement integration gate](plan.md#shared-enforcement-integration-gate) assigns production work and the later integrated review. No production security implementation or automatic freezing is introduced by this assessment.

## Threat and method

The attacker controls model/tool arguments and may supply conversation/UI history. Public arguments can cross ordinary, named, SDK, injected and forwarded component calls. Trusted configuration, schemas, implementation callbacks, explicit dependency forwarding and the application's authenticated request context are host code. They must not become attacker-controlled merely because an argument has a matching key.

Review four separate outcomes: replacing private authority, mutating shared data, disclosing private data, and executing an unauthorized operation. A correct binding guard addresses the first; it does not establish all four. The accepted absent/type-only-name limit and root-level public declaration semantics still apply: a public structured default must be safe to publish in its entirety.

For each candidate mechanism, identify the earliest relevant sink, what facts exist there, its enforcement owner, compatibility cost and an independent way to detect failure. Trace both new calls and persisted continuations. Inspect the current source and native implementation before inferring guarantees from names such as `strict`, `activeTools`, `needsApproval` or `readonly`. Classify evidence as candidate proof, native characterization, production acceptance work or application responsibility.

The pass re-read the package exports/configuration projections, Function and renderer tool routing, Script/Template engine merges, hidden prompt-renderer construction, validation, the combined candidate, and native SDK selection/parsing/approval/signature paths. Existing generated tests cover the argument grammar; the new native-control probes cover a different dimension. This is not a vulnerability scan of every dependency or a review of arbitrary application callbacks.

## Mechanism decisions

| Mechanism or avenue | Protection, limitation and decision | Evidence / remaining owner |
| :--- | :--- | :--- |
| Shared admission and final private guard | Required. Apply schema parsing and retained-private-name checks on all public call paths; preserve positive declaration knowledge and check actual execution context after native refinement/history. One application schema remains. | Combined/generated proofs; every production factory and renderer remains an implementation gate. |
| Structural separation of raw input, prepared values and controls | Required. Internal prepared entry is not selected by data or exposed as a caller bypass. Native SDK executors retain their native parsed-input contract. No tokens, origin tracking or public “validated” flag. | Known production `_toolCallOptions` skip paths must disappear with integration; mutation-test real entry routing. |
| Eliminate duplicate assembly paths | Required. Engines/preparers receive prepared context and cannot restore raw public defaults removed by parsing. Distinguish an internal preparer from a separately called child component. | Root-removal candidate tests; real hidden renderers and literal/loaded tools need integration assertions. |
| Own-property maps and safe construction | Required. Presence/lookup/insertion for defaults, registries, context and projection must not use inherited values or setters as authority. No global name blacklist or native parser rewrite. | Dictionary/generated proofs; inventory every production map consumer. |
| Immutable invocation/binding capture | Required. Snapshot owned top-level containers and keep descriptor/context/default facts together for the lifetime. This does not isolate nested state or freeze clients. | Concurrent/capture proofs; async metadata, per-run override and renderer capture need real-path checks. |
| Least-authority forwarding | Required routing rule: only selected tool context and explicit configured dependencies reach the child. Never copy owner/sibling context automatically. Authors can supply restricted clients or service capabilities. | Owner/sibling and multi-hop proofs. Casai cannot infer business permissions inside arbitrary dependencies. |
| Public errors and output publication | Required safe summaries at Casai-owned validation boundaries with native causes retained locally. Native output parsing/collection stays authoritative. Output schemas do not automatically redact secrets or authorize disclosure. | Transport/error/generated proofs; real error wrappers, streams, `toModelOutput`, UI and next-request consumers remain gates. |
| Schema strictness and runtime enforcement | Author choices supplement the mandatory private guard. Preserve native local parsers and provider settings; metadata-only schemas and provider strictness are not general local authorization. | Existing protocol/provider probes. Casai tools now require closed root input with local pre-parse name checks; ordinary components retain schema-controlled extras. No second schema. |
| Tool selection and approval controls | Reuse native controls with their demonstrated scopes, below. Do not treat advertising, signing, approval and authorization as interchangeable. | New paired native/candidate probes; production settings forwarding and UI/approval consumers remain gates. |
| History/session association and service authorization | Host responsibility. Authenticate the request, associate history with the correct conversation/principal, and check the operation/resource against current trusted context. Private binding integrity does not authorize a requested account, path, URL or query. | Signed cross-context probe demonstrates why Casai cannot infer this from the input schema. No new global store or policy API. |
| Effects, replay and concurrent state | Preserve intentional effects and native `!` scope. Services own required idempotency/atomic permission checks; hosts own unsafe overlap across executions. Binding stability and mutable service state are distinct. | Sequential-state/replay proofs; selected Cascada compiler/renderer integration remains required. |
| Source, loaders and sandboxing | Arguments remain data through Casai adapters; never promote `script`, `template`, loader names or tool metadata keys into execution settings. Trusted code deliberately executing model-provided source creates a separate sandbox/permissions requirement. | Existing envelope/provenance cases; real source/loader handoff tests required. No implicit sandbox or global path/URL policy. |
| Resource limits and cancellation | Preserve native SDK settings and explicit cooperative forwarding. Authors can bound input sizes, operation cost and output sizes where needed. Arbitrary JavaScript/schema work and effect concurrency are not stopped by a timeout promise alone. | Existing cancellation/stream checks; Phase 7 owns later deadline machinery. No generic limiter/controller layer added in Phase 2. |
| Diagnostics and telemetry | Keep private causes/debug output available only to trusted diagnostics; do not transport them automatically as model/UI errors. Custom logs, prompts and telemetry destinations need host access/retention policy. | Public-transport tests must inspect real messages, not `JSON.stringify(Error)`. No universal redactor or new logging subsystem. |
| Dependency and package boundary | Preserve supported native contracts, declare runtime imports directly, test the packed consumer, and rerun version-specific probes on upgrades. Internal exports/types are not a sandbox against deliberately malicious host JavaScript. | Existing distribution gate, now linked to enforcement review. No claim of a dependency-wide security audit. |
| Freezing, deep copying and proxies | Automatic freezing remains deferred. Generic deep copying/freezing/proxies do not fix argument substitution and can break identity, opaque clients and intentional effects. | No new implementation or readonly type change. Accepted native schema `.readonly()` behavior stays. |
| Additional identity/taint/state machinery | A global lock, provenance tracker, private namespace, second input schema or separate stateful-tool API has no demonstrated need to satisfy the selected contract. | Do not add mechanisms merely to simplify implementation; reassess only for a concrete uncovered attack/requirement. |

This covers the identified mechanism families; it does not prove that no other improvement can exist. The largest remaining protection is implementing these rules so every actual consumer uses them. A new guard that duplicates another without closing a reachable path is not automatically an improvement.

## Native control probes

`tests/Phase2NativeSecurityControls.unit.test.ts` compares installed native `ToolLoopAgent` behavior with the combined Casai candidate in generation and streaming. These are characterization tests, including deliberately passing native-limit cases, not evidence that those limits are protective behavior.

| Control | Fresh direct model call to `probe` | Valid signed approval continued in another invocation |
| :--- | :--- | :--- |
| `toolChoice: 'none'` | An unexpected call can execute; the provider instruction is sent. | Does not revoke execution. |
| `activeTools: []` | Tool is not advertised; the unexpected call does not execute. | Registered approved call still executes before step tool filtering. |
| `experimental_toolCallers: { probe: [] }` | Tool is not directly advertised; the unexpected direct call does not execute. | Registered approved call still executes. This probe does not cover every experimental local/provider caller plugin. |
| `toolApproval: { probe: 'denied' }` | Does not execute. | Denial is rechecked; does not execute. |
| Executable tool removed from registry | Existing own-registry probes reject unknown fresh calls. | No local execution of the removed tool. |

The tests inspect provider settings, count body effects, and pair restrictions with permitted calls. Both modes parse fresh calls against the model-facing subset. An initial source-only suspicion that streaming might use the wider execution set was disproved by the probe and the earlier `streamLanguageModelCall` parsing stage. Do not document that suspicion as a native bug.

Two further scopes are material:

- **Signatures do not bind private identity.** An approval signed while private context is `{ tenant: 'tenant-A' }` can execute with `{ tenant: 'tenant-B' }` in a separate invocation using the same signing key and unchanged public operation. Both invocation contexts are fixed; the signature simply does not include the tenant. This is not model input replacing `tenant` inside a protected context. The host must prevent unauthorized cross-conversation/principal history reuse and authorize the operation against its actual context. The signature also does not identify a particular tool implementation. The earlier replay tests already demonstrate the absence of cross-request deduplication.
- **Approvals are not transitive through trusted code.** A child with `needsApproval: true` waits when directly called by the model, but its executor can run when a trusted parent directly invokes it. The native parent and Casai injected helper behave alike. Coded invocations intentionally do not synthesize model-loop approval events. Put necessary model-facing approval on the outer operation and enforce indispensable permissions at the service boundary.

These refine the prior recommendation to “preserve native controls”; they do not justify a second Casai approval engine or silently changing the SDK contract. Sources: installed `generate-text.ts` / `stream-text.ts`, `stream-language-model-call.ts`, `filter-active-tools.ts`, `tool-caller-configuration.ts`, `validate-tool-approvals.ts`, `resolve-tool-approval.ts`, and `tool-approval-signature.ts` under `node_modules/ai/src/generate-text`.

## Timing and open acceptance work

**Now:** mechanism assessment, focused candidate/native probes, documentation of scope and assignment of real consumers. This pass completes that bounded review; it does not implement Phase 2.

**During implementation:** establish shared preparation/final execution in the Function slice; connect each factory, SDK/injected adapter and renderer with regressions at the same time. Remove weaker alternative paths as each slice changes. Repeat type, transport, source-preservation and semantic mutation checks against the real consumer. Do not let a passing helper test close a consumer row.

**After integration, before completion:** perform the whole-surface consumer-to-owner trace, real SDK/UI/approval/error/next-request checks, selected Cascada handoff, package/type/coverage verification and an independent implementation review. Correct findings and perform a subsequent complete pass. The review cannot be performed against code that does not yet exist; its acceptance criteria can and now do exist in the plan.

No new merge/API decision is required for the mechanisms selected here. Freezing stays deferred. Cross-execution scheduling, sandboxing arbitrary generated code and business authorization remain explicitly outside the current Casai guarantee.

## Follow-up: value of freezing and recursive proxies

The user reopened evaluation of these mechanisms as an additional protection layer. This section records their value and limits; it does not enable them or change the selected API.

Final-context freezing or a read-only Proxy would not have prevented the earlier private-input substitution, missing private-name reservations, ordinary-child forwarding bypass, forgeable validation marker, raw-default restoration, or private error-publication defects. Those failures occur before that final view exists, at a new child boundary, or through reads/publication rather than writes. Prototype-related map defects during preparation likewise require safe map operations at their owning stage. A Proxy enforcing the same incorrectly discovered private-name set shares that classification failure; it is not independent protection against it.

They do address a separate concrete threat: a trusted implementation performing a model-directed write, for example `context[field] = value` or `context.auth[field] = value`. Freezing the fresh root blocks the first; a correctly mediated recursive read-only view of ordinary data can block the second. That is real prevention of an unsafe write, not merely a diagnostic improvement, but it must not be counted as coverage of earlier substitution/disclosure defects.

Focused in-memory JavaScript probes confirmed:

- A shallow freeze allows nested mutation; a recursive `get`/write-trap prototype blocks nested assignment and Array `push` through that view.
- A naive recursive Proxy leaks raw nested objects through `Object.getOwnPropertyDescriptor(...).value`. Reflection must also be mediated.
- Wrapping a non-configurable, non-writable object-valued property violates native Proxy invariants if `get` returns a different wrapped value. Already-frozen/schema-readonly data therefore needs an explicit compatibility design, not a claim of universal transparent wrapping.
- The original host alias can still mutate the data, and the view observes it. A read-only view does not freeze the source or establish snapshot stability.
- Both freeze and recursive view preserve an already substituted `userId: 'admin'`; neither prevents a readable private value entering an error message.

These are deliberately bounded probes, not a production membrane or a new comprehensive test suite. Earlier probes also established class-private-field/Map receiver incompatibility; binding methods to the original object restores their original authority, including effects. Getters, functions, opaque clients, returned values, aliases and reflection all require a declared scope before promising recursive protection.

For Cascada, use native read-only reference permissions: blocking writes to JavaScript storage does not prevent a changed logical value through managed copy-on-write. The selected compiler/renderer integration must verify those permissions while retaining explicitly authorized external effects and writable local working data. For JavaScript bodies, recursive views of immutable plain data are a possible additional layer to prove separately; they cannot automatically distinguish immutable authentication data from intentionally mutable state stored in another plain object.

Protection should follow the resource/reference permission across invocation paths, not assume all dangerous data arrives directly from the model. SDK-only wrapping leaves ordinary forwarded child invocations outside that layer. Mandatory argument guards remain universal. A materially stronger independent defense against *flat merge/ownership* bugs would be structural separation of application input and private execution data; adopting that would reopen the confirmed flat API, so it is not silently added here.

## Verification of this pass

The new suite passes **14 test groups**, comparing both SDK modes and native/candidate paths. It passes TS7 and TS6 source checks with `strict`, `noImplicitReturns` and both exact-optional-property modes. Targeted ESLint, runner syntax and whitespace checks pass. It is registered in `test:local` and in the combined proof runner's source/runtime checks.

The existing adapter and public signatures were not changed, so the previous emitted-declaration/editor/mutation results remain dated evidence; they were not rerun or claimed as new results here. No paid model calls, full production suite, dependency changes or sibling-runtime patches were used. A final consumer-to-obligation reread found no additional mechanism to adopt within the selected contract; all production integration rows remain open until their implementation evidence exists.
