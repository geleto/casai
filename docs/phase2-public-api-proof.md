# Phase 2 public API and type proof

> Historical design evidence: the isolated prototype implementations and their runnable checkers were retired on 2026-10-21. Current acceptance uses production factory, schema, registry, lifecycle, generated security and public-consumer tests. See the schema-identity correction in [the review ledger](phase2-review.md). Historical commands and prototype source names below describe the investigation, not current regression gates.


**Later security revision:** this proof uses the earlier schema-only private-override policy and absent-context bare binding. The [2026-10-19 investigation](phase2-private-boundary-review.md) supersedes those policies, demonstrates counterexamples, and reopens the security integration gate. Keep the original fixture as historical comparison; it does not enforce the stronger requirement.

Status: the isolated proof is complete for the bounded preparation/binding design. It uses the installed AI SDK 7.0.130, provider-utils 5.0.56, Zod 4.6.5 (including Zod 3), TypeScript 7.0.2 and TypeScript 6.0.2. No production factory, runtime, or exported package type was changed. This discharges the pre-integration feasibility gate, not Phase 2's implementation or full consumer acceptance tests.

The candidate is [phase2-public-api.ts](../tests/fixtures/phase2-public-api.ts), an executable Function-like tool component with ordinary calls, `.run`, configuration inheritance, parsed callbacks/results, and immutable tool binding. Its declaration exports are compiled independently before consumer checks. The [shared schemas](../tests/fixtures/phase2-api-schemas.ts) are used by both [runtime cases](../tests/Phase2PublicAPI.unit.test.ts) and [type cases](../tests/type-safety/phase2-public-api.ts).

## What the public call types establish

```ts
const scale = component({
  inputSchema: z.object({ value: z.number(), factor: z.string().transform(Number) }),
  context: { factor: '3', db },
  execute: input => input.value * input.factor,
});

scale({ value: 2 });                         // Promise<number>; factor is configured
scale.run({ context: { value: 2, factor: '4' } });
scale({});                                  // type error: value is missing
scale({ value: 2, factor: 4 });               // type error: caller factor must be raw string
```

The callback receives parsed `factor: number` and private `db`; argument completion offers public fields only. Supplying all required fields through configuration enables `scale()` and `scale.run()`. Inherited defaults, incomplete reusable context fragments, incompatible callback replacement, invalid placeholders repaired by the call, and explicit `undefined` are checked. Output schemas separately constrain producer return input and infer consumer output, including inherited and bound calls.

The usable signature combines a schema-shaped constraint with a final effective-input check. It captures supplied keys separately from the argument value type. This matters for inline callback fields: an earlier candidate inferred the argument constraint instead of the actual supplied fields and incorrectly rejected a valid omitted configured default. Checks cover contextual callback parameters, optional overrides, both exact-optional modes, and source/declaration editor completion. Removing `NoInfer` specifically around the schema also fixes contextual callback inference for SDK/lazy-schema unions; it remains around the other inference sources where needed.

**Confirmed type policy:** the user selected rejection of extras for closed shapes. Zod 4's public strict and stripping object policies have identical structural TypeScript types, so both reject undeclared fields in typed calls. Open/catchall shapes preserve their native extra-field types. Runtime still uses the schema's own rejection, stripping, or passthrough; this introduces no runtime input filter or private-key policy. Native catchall index-signature limitations remain: its index type must be compatible with the named properties for a TypeScript object to inhabit the inferred input type.

For closed unions, check each possible effective merged branch, not just the union of field names. With configured `{ mode: 'a', a: 2 }`, supplying `{ mode: 'b', b: 'ok' }` leaves `a` in the shallow merge. A strict branch B rejects it even though all B fields were supplied. The proof rejects this typed call and reproduces the runtime rejection. Changing common fields within a valid configured union remains supported. This is not branch-dependent default selection, deletion, or a new merge law. The same conservative closed-shape type policy applies to stripping unions. Broad or inferred object types carrying optional foreign keys can require a precise schema-input annotation; the compiler cannot treat a possible explicit extra key as absent.

## Schema capability matrix

“Sources” means nonempty configured or bound context, including unrelated private dependencies. Source partitioning needs declarations even if the actual values ultimately prove private.

| Schema instance | No sources, local parsing | With sources | Public admission |
| --- | --- | --- | --- |
| Zod 3/4 object and supported raw-object wrappers/transforms | Native parser | Public raw object handles | Static raw/parsed types and declaration capability |
| Root Zod discriminated union | Native parser | Automatic root declaration discovery unsupported | Reject known unsupported combinations; explicit native metadata wrapper is the supported authoring path |
| Zod 3 intersection producing root `allOf` metadata | Native parser | Automatic discovery unsupported | Known constructor rejected with sources; explicit metadata wrapper demonstrated |
| Tested Zod 4 intersection | Native parser | Installed native converter flattens its object metadata | Metadata checked at preparation; do not generalize to every intersection |
| Opaque root preprocessor | Native parser for the supported raw object input | Needs declared raw names | Known Zod 4 preprocessor handle rejected with sources; explicit native metadata wrapper demonstrated |
| Standard Schema with typed input/output and input JSON metadata | Native parser | Metadata supplies declarations | Preserve declared raw/output types; check metadata when resolved |
| SDK schema / promised metadata / lazy SDK schema | Native parser | Await metadata | Preserve native erased-type limits; no synchronous factory requirement |
| Known scalar/array application input or nonobject prepared output | Outside Casai's flat application-context contract | Same | Reject known incompatible shapes; explicit native SDK tools keep their own scalar/array support |

The authoring example uses Standard Schema/Standard JSON Schema protocols and delegates validation to the original schema. It does not introduce a Casai schema family, trial-parse fragments, or infer names by running callbacks. A declaration example for a root union is a **local partitioning demonstration**: its broad object metadata is not a promise of faithful model-facing branch constraints. Actual tools still need suitable native model metadata and the separately specified projection checks. No lossy declaration list silently replaces a model schema.

Dynamic metadata cannot be certified statically. Even an admitted Zod 4 intersection or an explicitly typed SDK wrapper may fail metadata validation before execution. Opaque/erased input types do not justify promising precise private callback fields that runtime declarations could remove; the candidate uses a conservative context type when raw input is unknown. Retain original schema types for precision. The runtime source map and model projection remain separate capabilities.

## Binding and native SDK handoff

Use `component.bindToolContext(rawContext)` on tool forms. It returns a fresh binding with a native `tool` and its matching readonly, raw `context`. The name avoids replacing JavaScript's existing callable `.bind`. The fixture also exposes `invoke` only to prove the internal injected-call signature; neither it nor the fixture's registry assembler is a proposed additional package method.

```ts
const scale = component({
  inputSchema: z.object({ factor: z.number() }),
  context: { factor: 3 },
  toolContextSchema: z.object({ factor: z.number() }),
  execute: input => input.factor,
});
const selected = scale.bindToolContext({ factor: 5 });
const agent = new ToolLoopAgent({
  model,
  tools: { scale: selected.tool },
  toolsContext: { scale: selected.context },
});
```

This example is checked without a consumer cast. Ordinary `scale()` still uses configured `3`; the binding resolves omitted model arguments to `5`. An explicit argument `3` still wins. A second binding can use `7` concurrently. Original configuration and the first binding remain unchanged. The bare tool component represents only the absent-incoming-context binding; external SDK consumers must use an explicit matching pair when supplying context. A required context schema can make that default SDK binding unusable while ordinary component calls remain usable.

Binding preserves `undefined`, scalar raw context transformed to an object, schema defaults, and non-JSON opaque raw values such as Dates. It snapshots plain top-level maps; it neither clones class instances into empty maps nor deep-freezes dependencies. No-schema context retains its supplied object type for bound-call defaults. A typed dependency replacement must remain compatible with the fixed implementation callback; this is a type constraint, not an additional runtime validator. Original `toolContextSchema` identity is retained as descriptor `contextSchema`; native independent parses remain native.

**Native type erasure:** if `toolContextSchema` transforms `{ factor: string }` into `{ factor: number }`, the binding honestly returns raw `{ factor: string }`. Installed SDK `toolsContext` types infer the parsed number and reject that raw value, just as they do with a native transforming tool. The proof includes this expected compiler rejection. Casai-owned dispatch can use the narrowly scoped native bridge already required by the plan. External native callers retain the SDK's limitation and must supply raw data with the corresponding explicit SDK type assertion where necessary. Do not claim an entirely cast-free native handoff for transforming contexts, label raw strings as parsed numbers, or wrap/reparse the original context schema to conceal this limitation.

Casai owners assemble the binding registry before SDK entry, retain matching context selections, and reject a changed Casai entry from a step hook before provider dispatch. Ordinary native tool entries keep native replacement behavior. An unchanged entry is the same value or a plain map with the same own keys and `Object.is`-equal values; binding snapshots plain maps, so a hook returning the caller's original entry must not be rejected by identity alone. No deep comparison or post-parse mismatch detector is introduced. An arbitrary external SDK caller owns correct pairing and must keep the whole binding fixed; the descriptor cannot universally detect raw context changes from a validator that receives arguments alone. The negative UI test proves that repairing an exposed mismatch in `prepareCall` is too late. The positive test exposes the matching registry first and executes approved work exactly once.

## Verification and implementation boundary

```sh
npm run test:phase2-api
npm run test:file -- tests/Phase2DefaultResolution.unit.test.ts tests/Phase2InputAdapter.unit.test.ts tests/Phase2Lifecycle.unit.test.ts tests/Phase2PublicAPI.unit.test.ts
```

The API checker runs four source compiler combinations; emits the fixture declarations with each compiler; checks each emitted set with both consumer compilers and optional-property modes; and runs TypeScript language-service checks on source and both declaration sets. Valid inline callback lines must have no diagnostics, not merely coexist with an expected error elsewhere. A temporary type mutation removes the effective-input guard and is caught by negative calls. A separate temporary runtime mutation reverses bound-context/configuration precedence and is caught by the binding test. Temporary directories are constrained to the proof's unique workspace child and removed after the run.

Focused runtime verification: **117 passing** across the four files, including 12 new public-candidate cases. No paid model calls. The new cases cover raw/parsed values, omissions and inheritance, capability admission, closed/open behavior, union interactions, result parsing, independent native generation/streaming bindings, private-history exclusion, UI approval handoff, and owner-side mismatch timing.

The proof establishes an implementable shared signature/binding design. It does **not** supply the full JSON Schema projector, Casai error translation, every configuration field, all Template/Script source overloads, tool callback forwarding, native-tool injected-call normalization, or JavaScript stream integration. Those are specified production tasks, with existing native probes where applicable. Port the shared contract into every relevant factory without altering current Text/Object call orders; then run the whole-surface consumer review and factory-level type/runtime tests. Prototype casts implement the fixture's internal erased overload boundary; accepted public call cases themselves contain no casts. Deliberate invalid-runtime characterizations are labelled separately.

## Subsequent reconciliation, 2026-10-19

The [current plan](plan.md#context-sources-and-preparation) selects bounded one-level union declaration discovery in addition to the demonstrated capability matrix above. The existing fixtures have not been extended here; the older matrix describes their actual evidence. Source-free local validation must retain native union support. Union tools with only private dependencies can retain faithful native metadata once name discovery is proved; tool public-default projection remains separately restricted. The private-key signature must be composed with the public configured-omission/closed-shape callable, including the explicit-public-declaration direction for no-schema configured names and the confirmed registered-tool-name protection. The resolved contract has no blanket private-protection bypass; this policy resolution does not complete the composed proof. See the [reconciliation ledger](phase2-review.md#reconciliation-after-the-current-source-review-2026-10-19); these requirements are not new passing test claims.

**Subsequent proof:** the separate [combined runtime/callable candidate](phase2-composed-api-proof.md) now demonstrates that composition, including no-schema and registry cases and the bounded union extension. It preserves this older fixture as historical evidence rather than silently changing its original policy. Final production factories and consumers remain unimplemented.
