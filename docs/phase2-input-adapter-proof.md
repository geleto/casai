# Phase 2 input-adapter feasibility

> Historical design evidence: the isolated prototype implementations and their runnable checkers were retired on 2026-10-21. Current acceptance uses production factory, schema, registry, lifecycle, generated security and public-consumer tests. See the schema-identity correction in [the review ledger](phase2-review.md). Historical commands and prototype source names below describe the investigation, not current regression gates.


**Later security revision:** the [private-boundary investigation](phase2-private-boundary-review.md) adds model/private isolation requirements and private-only bare-tool support. This earlier proof establishes default/approval behavior under its original policy, not the revised security contract.

Status: isolated prototypes completed against `ai@7.0.130`, `@ai-sdk/provider-utils@5.0.56`, and `zod@4.6.5` (including `zod/v3`). No production factory was changed. The original fixed standalone descriptor cannot meet the combined requirements. The user selected per-run binding for exploration and confirmed that the entire bound context must stay fixed. The replacement prototype demonstrates that design at the native SDK boundary; the [subsequent default-resolution proof](phase2-default-resolution-proof.md) demonstrates bounded declaration discovery and the core type merge check. Full factory/type integration remains work.

Executable evidence: [Phase2InputAdapter.unit.test.ts](../tests/Phase2InputAdapter.unit.test.ts). The tests assert actual native behavior, including counterexamples; passing them does **not** mean the rejected candidates satisfy Phase 2. The metadata projection helper is deliberately limited to the simple independent object fields in these fixtures, not a production schema rewriter.

## What succeeds

The configured-default wrapper works when incoming tool context does not overlap application defaults. In both native `ToolLoopAgent.generate()` and `.stream()` it:

- Allows omitted configured required fields, advertises their omission, and applies the original parser to completed values.
- Uses parsed replacements and schema defaults; a valid argument repairs an invalid configured placeholder.
- Keeps configured dependencies and unrelated incoming context out of public argument records and the next provider request.
- Reuses one descriptor across concurrent invocations without mixing their separate contexts.
- Preserves native approval revalidation: unchanged public defaults work; changed defaults produce a native invalid-input tool result without executing the tool.

These results establish useful parts of the adapter, not the overlapping-source contract.

## The counterexample

Original schema: `z.object({ factor: z.number() })`. Configuration: `{ factor: 3 }`. Incoming tool context: `{ factor: 5 }`.

| Raw caller arguments | Public parsed arguments from the candidate | Required execution value | Candidate execution value |
| --- | --- | --- | --- |
| `{}` | `{ factor: 3 }` | `5` | `3` |
| `{ factor: 3 }` | `{ factor: 3 }` | `3` | `3` |
| `{ factor: 7 }` | `{ factor: 7 }` | `7` | `7` |

The first two calls become indistinguishable at the executor's supported interface. Putting context last merely makes both use `5`, breaking the second call. Comparing values with configured defaults cannot recover whether an argument was supplied.

Transforms make this more than a missing-key bookkeeping problem. With a root transform from `{ factor, count }` to `{ product: factor * count }`, configured `factor: 3`, incoming `factor: 5`, and arguments `{ count: 2 }`, the wrapper publishes `{ product: 6 }`. Execution needs `{ product: 10 }`. A later object spread cannot recompute the arbitrary transform. Applying the parser again or restoring raw fields is not the confirmed contract.

More generally, a fixed argument validator receives configuration and raw arguments but no incoming context. It cannot return different parsed application results for two otherwise identical calls with different contexts. If those results must already be the fully resolved public input used by native hooks, approval, and execution, a later executor cannot fix that absence of information.

## Native boundary trace

The installed implementation is authoritative for these probes:

- `@ai-sdk/provider-utils/src/schema.ts`: `Schema.validate(value)` takes one value. It has no execution-options/context parameter.
- `ai/src/generate-text/parse-tool-call.ts`: argument parsing returns the public `toolCall.input`. `experimental_refineToolInput` receives that parsed input alone. The SDK retains raw schema input on the **tool-call record** using a private symbol, not on the object passed to `execute`; Casai must not reach into that private protocol.
- `ai/src/generate-text/execute-tool-call.ts` and `validate-tool-context.ts`: incoming context is independently parsed before `execute(input, options)`.
- `generate-text.ts`, `stream-language-model-call.ts`, and `resolve-tool-approval.ts`: hooks and approval have their own context-validation boundaries. The executable trace sees three native context parses when an input hook, approval callback, and executor are enabled. In streaming, the approval callback precedes `onInputAvailable`; generation has the opposite order. Do not use an input hook as a guaranteed preparation stage before approval.
- `validate-tool-approvals.ts`: approval continuation revalidates raw `inputSchemaInput` when present and compares the result with approved public input.
- `ui/validate-ui-messages.ts`: completed transformed UI input can fail revalidation against the original raw-input schema. The native comparison retains the already accepted limitation; no Casai workaround was added.

The public [SDK context guide](https://vercel.com/kb/guide/ai-sdk-runtime-and-tool-context) likewise describes tool context as a separate execution input. Native SDK behavior itself is not defective here: its separate arguments/context contract does not promise Casai's merged configured-default semantics.

Returning an envelope, attaching hidden raw-input state, mutating an input hook's object, or caching a "current context" on a shared schema is not a demonstrated solution. Those approaches change public input, rely on unsupported ordering/serialization, require another parse, or introduce shared invocation state. A caller-owned refinement closure could capture context only if the owning SDK call is adapted and raw arguments survive initial validation; it is not a transparent standalone-tool solution either.

## Alternatives and selected investigation

| Approach | Evidence | Contract cost |
| --- | --- | --- |
| Parse configured defaults plus arguments at the native argument boundary | Works without overlapping context; fails the pair and root transform above in generation and streaming | Cannot preserve the confirmed overlap precedence |
| Preserve raw SDK arguments, parse completed application input inside `execute` | Produces `5` versus explicit `3`; root transforms and concurrent contexts work | Native records and hooks contain raw arguments, not parsed application input. An invalid complete input can request approval and then fail as an execution error. Matching context fields participate in the application parser. |
| Bind application defaults to a particular run before registering the descriptor | Selected for exploration; the extended prototype below preserves transformed public inputs and concurrent execution | Requires an immutable descriptor/context pair. Native SDK users bind explicitly; Casai owners bind internally. Matching context fields become public application input. |

Deferred parsing was not selected. Its passing counterexamples do not authorize changing public SDK arguments or approval validation timing.

## Immutable binding prototype

Binding creates a new native descriptor and its matching raw context. It never changes the component or its configuration. Each independent invocation can create a different binding, just as a pure function can receive different arguments. The entire context of an existing binding stays fixed, including private dependencies, across all tool calls and SDK steps. Binding is not persistent memory and needs no Cascada `!`; external operations performed by a tool have their own effect semantics.

The prototype's algorithm is:

1. Synchronously capture the definition and shallow top-level configuration/context containers. Preserve `undefined` versus `{}`, raw scalar context accepted by its schema, and borrowed opaque/nested identities.
2. Return a descriptor and the matching **raw** context immediately. Its lazy metadata and validator share a binding-local preparation promise, first evaluated when needed. The promise holds fixed preparation facts, not a mutable current-call context.
3. Preparation applies the original `toolContextSchema` to the captured context, without JSON conversion. Use its output to select matching named application fields. Overlay those onto configured named defaults; keep unrelated configuration and context out of the public parser.
4. Advertise the projected original input schema. At the native argument boundary, merge selected defaults with raw arguments and run the original application parser. Its returned object is the public SDK input, including root-transform replacements. No additional caller-field filter is applied.
5. Preserve the original native `contextSchema` and callbacks on the descriptor. Register the matching raw context through `toolsContext`. Native hooks, approval, and execution independently parse it as usual. Execution combines configured private bindings, native parsed private context, and already-parsed public input, then injects actual `_toolOptions`. It neither reparses input nor restores removed raw names.

The key pair now works: configured `factor: 3`, bound context `factor: 5`, and omitted arguments produce public/executed `factor: 5`; explicit `factor: 3` produces `3`. A root transform produces `{ product: 10 }`, with raw `factor` and `count` absent from execution. Pure asynchronous context transforms, non-JSON clients, context defaults, own `undefined` overrides, open input schemas, caller repairs of invalid application defaults, and eight concurrent bindings are exercised.

Binding adds one justified context parse to select public defaults before argument validation. It does **not** substitute that output for later native context parsing: a fixture with input hook, approval callback, and execution still performs their three native parses, in addition to binding preparation. A fresh application input is parsed once; approval/history revalidation remains a distinct native boundary. Callback identity, raw description context, parsed lifecycle/event context, and `toModelOutput` are retained.

Both metadata-first and validation-first access await the same preparation. An unused binding does no validation. Invalid bound context fails when preparation is first required; advertised tools therefore validate before provider dispatch, potentially before the model selects that tool. A synchronous `streamText()` call can return its native stream result before asynchronous context preparation finishes. No asynchronous component factory or parallel stream facade is necessary.

**Registration ownership:** the descriptor and raw context form a pair. Casai owners can create and register both before execution, reusing the descriptor for injected calls in that same binding. Direct native SDK consumers need an explicit binding step when supplying incoming context. The prototype helper is not an exported package API; naming and complete callable/registry types remain integration work. A bound descriptor must not be reused with a different `toolsContext` entry. Do not mutate a shared component/schema to retrofit context into its validator.

Using the prototype helper (illustrative integration, not a new Casai API):

```typescript
const first = bindCandidate(definition, { factor: 5 });
const second = bindCandidate(definition, { factor: 9 });
const agent = new ToolLoopAgent({
  model,
  tools: { scale: first.tool },
  toolsContext: { scale: first.context },
});
// A separate run may register second.tool with second.context.
// Creating second did not change definition, first.tool, or first.context.
```

**Per-step context changes are outside the Casai binding contract.** The installed SDK's `prepareStep` can replace context but cannot replace the tool descriptor. Negative probes show the resulting inconsistency: the naive bound descriptor follows new private context but retains its earlier public defaults. Both changes are unsupported for a Casai binding under the user's immutable-context decision. Native tools keep native behavior. Independent runs can select new context and create new bindings; no controller, mutable registry, or change-tracking mechanism was introduced.

**Approval continuation:** a new binding with unchanged effective public input and new private dependencies executes successfully. Changing a fallback used by the approved raw arguments produces the native invalid-input tool result and does not execute. Conversely, an explicit approved argument can keep the effective input identical despite a changed fallback in a new binding. Preserve the native equality rule; do not claim it rejects every configuration change or build a continuation state store. Keeping public defaults stable is the straightforward application rule. None of these cases mutates an existing binding.

**Typing:** retaining the original Zod schema lets binding accept its raw context input, including string-to-number transforms, and return the raw context with an honest type. The SDK's native `InferToolSetContext` instead infers parsed output. A native comparison demonstrates this existing limitation. The fixture contains its raw-to-native-settings cast inside SDK dispatch; that cast is not evidence for public inference and must not make a returned raw string appear to be a number. Casai owner types can retain the original schema; explicit native tools/consumers retain native erased-type limitations. Complete factory/inheritance/omission typing is not established by this small helper.

## UI helper binding order follow-up

The whole-surface review added a separate approval case: `createAgentUIStream` validates history against `agent.tools` before calling the agent, so a later `prepareCall` cannot repair an exposed-binding mismatch. History records parsed `{ factor: 5 }` and raw `{}`; exposed fallback `3` rejects before the hook or model runs, even when the hook would select fallback `5`. The same failure occurs with native `tool()` definitions using only Zod defaults. Exposing the matching immutable binding before helper entry succeeds and emits a tool result. This is distinct from the previously characterized completed transformed-input UI limitation.

The production binding signature and Phase 3 Agent `tools` property must account for this consumer. Use the [authoritative binding constraint](plan.md#sdk-tool-boundary-and-configured-defaults); no shared mutable registry, validation bypass, or history rewrite is proposed. The two new checks are native/binding comparisons, not a finished public Agent integration. This follow-up brings this file to 72 passing checks; the [whole-surface review](phase2-review.md#validation) records the combined runtime/compiler validation.

## Non-JSON declarations

This is a separate capability issue, not evidence that local inputs must be JSON:

- Native Zod validation accepts a client instance, a `Date`, and a function in an object; the SDK's JSON conversion fails on those declarations.
- Public Zod object `.shape` exposes their names without parsing or converting their fields. Common root transforms retain a public handle to the raw object (`Zod 4 .in`, `Zod 3 .innerType()`). This does not prove a generic wrapper/union/preprocessor discovery algorithm.
- Zod 4's public `toJSONSchema(..., { io: 'input', unrepresentable: 'any' })` retains these declaration names while erasing unrepresentable field constraints. That can support a **local discovery-only** experiment; it must never silently replace the real model-facing schema. See [Zod's conversion documentation](https://zod.dev/json-schema).
- An SDK `jsonSchema` wrapper with explicit (including promised) metadata and a validator delegating to the original opaque schema works without changing native parsing or shared object identity. This is an available explicit mechanism, not a requirement newly imposed on every schema author.

The [subsequent default-resolution proof](phase2-default-resolution-proof.md) establishes a bounded capability contract using public Zod declarations and SDK/Standard metadata, with explicit metadata for opaque schemas when partitioning is needed. Universal automatic discovery is not promised. No general schema interpreter, trial parse, private-Zod traversal, or JSON-only local-input restriction was added.

## Reproduction and limits

Run only the local fixture:

```sh
npm run test:file -- tests/Phase2InputAdapter.unit.test.ts
```

All model calls are SDK mocks; no provider keys or paid calls are used. This is an SDK boundary proof, not verification of all Phase 2 factories, projection constraints, public inference, or provider strict-mode behavior. The overlapping-input feasibility gate is now demonstrated by immutable binding. The [default-resolution proof](phase2-default-resolution-proof.md) now establishes a bounded discovery strategy. Production integration and subsequent whole-surface review remain outstanding; this report does not declare all of Phase 2 ready.

Validation on 2026-10-18 after the external review: 70 local checks pass, including two new negative characterizations of a descriptor bound to absent context incorrectly registered with a native context entry. The fixture is checked with TS7, TS6, and ESLint. Deliberate mutations were detected in both SDK modes: removing configured fallback merging, publishing all configuration through an open schema, reversing configured/bound-context default precedence, and restoring raw context fields removed by a root transform. Mutation copies were removed. Approval checks assert actual execution or non-execution, and the rejected transformed UI-history fixture has a valid neighbor.
