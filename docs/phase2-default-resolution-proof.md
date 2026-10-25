# Phase 2 configured-default resolution

> Historical design evidence: the isolated prototype implementations and their runnable checkers were retired on 2026-10-21. Current acceptance uses production factory, schema, registry, lifecycle, generated security and public-consumer tests. See the schema-identity correction in [the review ledger](phase2-review.md). Historical commands and prototype source names below describe the investigation, not current regression gates.


**Later security revision:** default selection and complete-input parsing remain relevant, but the [private-boundary investigation](phase2-private-boundary-review.md) supersedes this fixture's permission for parsed arguments to replace private bindings. Its passing tests do not prove the revised security requirement.

Status: isolated comparison and runtime/type prototypes, 2026-10-18. Production factories are unchanged. The recommended algorithm preserves the confirmed configuration, input-admission, shallow-merge, and immutable-binding contracts.

Evidence: [runtime comparisons](../tests/Phase2DefaultResolution.unit.test.ts), [candidate helper](../tests/fixtures/phase2-default-resolution.ts), [compiler checks](../tests/type-safety/phase2-default-resolution.ts), and [native SDK binding proof](phase2-input-adapter-proof.md). The binding fixture now uses the same declaration resolver. These are executable design probes, not tests claiming that current factories already implement Phase 2.

## Recommendation

Select **all explicitly declared input fields** from configured/bound values, overlay the caller's unfiltered input, then run the original application parser once. Requiredness does not need to be interpreted during runtime preparation. Optional and schema-defaulted declarations participate too.

```typescript
const names = declaredInputNames(inputSchema);
const defaults = {
  ...pickOwn(config.context, names),
  ...pickOwn(parsedToolContext, names),
};
const publicInput = await parse(inputSchema, { ...defaults, ...arguments });
```

This is pseudocode: the actual helper awaits asynchronous metadata and uses native SDK validation. Ordinary calls have no tool context. Registered calls obtain fixed parsed context defaults through the already demonstrated immutable binding.

After parsing, combine the remaining private bindings with `publicInput`. Do not restore raw declared defaults that a transform removed or renamed. Do not filter caller arguments before or after parsing. The original schema owns strict rejection, stripping, catchall/open input, refinements, defaults, and transforms. Actual execution metadata is added afterward under the existing `_toolOptions` rule.

Preserve the native validator contract: SDK JSON metadata without a runtime validator does not acquire one through this adapter. Metadata declarations select defaults; native parsing/validation remains responsible for checking effective values.

Example: configured `{ factor: 3, db }`, declared `value` and optional `factor`, caller `{ value: 2 }`. Parse `{ factor: 3, value: 2 }`; `db` stays outside the public parser but remains available to execution. The fact that `factor` is optional does not discard its configured value. For a schema default of `11`, configured `3` wins; an own caller `factor: undefined` overrides `3` and lets the native schema apply `11`.

## Compared approaches

| Approach | Result | Reason |
| --- | --- | --- |
| Parse caller input, read missing-field errors, fill from configuration, parse again | Reject as a general algorithm | Optional/defaulted fields produce no missing error, so configured values are lost. Partial first parses can run transforms/defaults before failing. Errors do not universally enumerate missing declared fields. |
| Read declared names structurally, fill only absent own caller keys, then parse | Valid equivalent | Uses the same declaration capability as the recommendation. Own `undefined` is present and must override configuration. Preselecting defaults and spreading arguments last is simpler. |
| Select only schema-required configured fields, then merge and parse | Insufficient | Drops configured optional/defaulted values. Requiredness may depend on refinements, union branches, or opaque validation; it need not be interpreted here. |
| Select all named declared configured fields, merge raw caller input, parse once | Recommended | Preserves optional/defaulted values, source precedence, native caller admission, cross-field validation, transforms, and private-data separation. |
| Merge everything, filter the result to schema names, then parse | Reject | Filtering removes caller fields a strict schema should reject, or an open schema should retain. A second validation of raw caller input also lacks required configured fallbacks. Preserving origin during filtering reduces this to the recommended algorithm. |
| Merge everything and let the original schema filter it | Reject as a general algorithm | Strict schemas reject unrelated private configuration; open schemas publish it. A stripping schema works in a limited case, but cannot establish the general contract. |
| Parse configuration with a partial/picked schema first | Reject | Prematurely rejects invalid placeholders that valid caller arguments can repair; can run transforms/refinements/defaults on incomplete data. Root transformations and cross-field rules do not generally survive schema surgery. |
| Keep application defaults in a separate explicit configuration map | Technically simpler for opaque schemas | Removes automatic discovery, but changes the agreed authoring contract: authors must classify configured values themselves rather than having matching `config.context` fields participate automatically. Useful alternative if that API change is desired, not applied here. |
| Keep arguments and context separate like native SDK execution | Simple native contract, different feature | Gives up the agreed use of configuration/context to satisfy public input requirements and flat prepared application values. Not selected. |

The user's overall reasoning is sound: resolve fallbacks before complete validation, and model the same resolution in types. The important corrections are to include optional declarations and to preserve caller input until the schema processes it.

## Declaration capability

The runtime needs names, not a schema interpreter. The candidate uses a small ordered capability check:

1. Read public Zod 3/4 object `.shape` keys. Do not inspect individual field validators. Non-JSON clients, functions, and dates therefore do not require JSON conversion merely to identify top-level names.
2. Follow supported public raw-object handles: Zod 4 input pipes, Zod 3 effects, and the tested optional/nullable/default/catch/readonly wrappers. Stop at the first raw object; never traverse its nested fields or run its callbacks. The fixture enumerates supported wrappers rather than walking private definitions. Root preprocessors retain the plan's declared-raw-name requirement; undeclared aliases are not inferred. A Zod 4 unknown-input preprocessor can need explicit metadata.
3. Otherwise use input metadata exposed through the supported SDK/Standard JSON Schema protocol, including deferred metadata. Explicit root `properties` names and root `required` names declare fields. An open/catchall schema without named declarations does not select arbitrary configured keys.
4. If a schema provides neither public declarations nor usable metadata, preserve ordinary local validation when there are no configured/bound sources to partition. When partitioning is needed, require explicit declarations rather than trial parsing or guessing. Existing SDK metadata wrappers and the Standard JSON Schema protocol provide an authoring route. The latter can preserve declared raw/output types while forwarding the unchanged validator; a runtime and compiler probe demonstrates it. The fixture's separate metadata parameter is an experimental capability, not a new Casai config field.

Automatic root-union/composition/reference discovery is deliberately not claimed. Unsupported cases need explicit declarations when partitioning is required. Do not add a general Zod/JSON Schema interpreter. Root-union validation without configured sources still works natively; the separate model-facing projection restrictions remain unchanged. Native conversion can flatten some Zod 4 intersections into supported object metadata; the tested Zod 3 intersection instead emits unsupported `allOf` metadata.

The external review exposed a gap between this bounded runtime capability and the type algorithm below: a root discriminated union plus unrelated configured `{ db }` fails discovery, while `CanCall` accepts its valid complete input. The same occurs with the Zod 3 intersection. New paired probes preserve those counterexamples. These are not supported public calls yet. A flat companion containing every union branch name also does not implement branch-aware selection: a configured field belonging to another strict branch can make the final parse fail. The [public signature/capability gate](plan.md#schema-capability-and-public-signature-gate) must establish admitted schemas and the typed authoring path before production integration.

This does not make non-JSON public fields usable as model-generated values. Local declaration discovery and real model-facing JSON Schema conversion are separate capabilities; the latter still uses native conversion and provider constraints. Never advertise discovery-only lossy metadata as the real model schema automatically.

The public APIs and distinction between validation and metadata are documented by [Zod object/schema APIs](https://zod.dev/api), [Zod JSON conversion](https://zod.dev/json-schema), and [Standard Schema](https://standardschema.dev/schema). The installed packages and executable probes are authoritative for the supported forms here.

## Type-level counterpart

The compiler cannot execute schemas. Use the schema's raw input type, select named configured default types, model ordinary shallow spread with caller types, and check that the effective result is assignable to the complete raw input type:

```text
selectedDefaults = configured/bound type restricted to declared input names
effectiveInput   = Spread(selectedDefaults, callerArguments)
validCall        = effectiveInput is assignable to SchemaInput
```

The candidate reuses the repository's existing `MergedProperties` utility. It preserves optional properties, own `undefined`, and union branches. Retained schema input types provide names statically, but they do not prove that the actual runtime schema exposes matching declarations. The checks below are conditional complete-value checks; an additional public schema-capability contract is required. They cannot establish support for a schema/configuration pair merely because its inferred input type passes.

Key obligations demonstrated by the compiler fixture:

- Required configured/inherited values can satisfy missing arguments. Supplied overrides use schema input types rather than the configured literal's narrower type.
- Optional or possibly undefined configuration does not guarantee a missing required value. A broad `Record<string, number>` does not guarantee any particular own key, either.
- Every possible configured union branch must work with the supplied arguments. Preserve correlated discriminants rather than independently making branch fields optional.
- Explicit caller `undefined` overrides defaults. Optional override objects differ between exact-optional and ordinary TypeScript modes; existing spread types retain that distinction.
- Open/catchall input types accept their supported extras without converting every configured key into a public default. Named keys remain discoverable in types with an index signature.
- Nested input is shallowly replaced. Supplying a partial nested object does not borrow its missing fields from the replaced configured object.
- Raw input and parsed output remain distinct. String-to-number inputs require strings; implementation/output types use parsed values. Removed raw fields are absent from callback context types.
- A registered binding can supply defaults that the ordinary component call does not have. Incoming tool context uses its raw type; selected bound defaults use its parsed type.

The merge check is a type-algorithm proof, not the finished public signature. Production callers still need ordinary contextual typing, completion, schema-shaped argument types, overload ergonomics, output inference, `.run()` integration, and compiled-declaration checks across every factory. Do not replace all public signatures with the fixture's broad generic function.

Static checks cannot reproduce every runtime rule. Numeric refinements and strict unknown-key rejection are not fully represented by structural TypeScript assignability. Existing literal excess-property checks and runtime validation retain their roles. Native Zod catchall inference also has a demonstrated limitation: a numeric declared field plus a string catchall validates `{ factor: 3 }` at runtime, while its inferred intersection/index-signature input type rejects that shape. Preserve native limitations instead of claiming exact runtime/type equivalence or adding a parallel schema type interpreter. Erased SDK schema types retain their existing raw/output inference limitations.

## Verification

Run the focused runtime suites:

```sh
npm run test:file -- tests/Phase2DefaultResolution.unit.test.ts tests/Phase2InputAdapter.unit.test.ts
```

The new runtime suite is included in `test:local`; the new type-only file is included by the existing `tests/type-safety` configurations. Focused compiler runs cover TS7 and TS6 with exact optional properties both enabled and disabled. ESLint covers the helper and both test files.

After the external review follow-up, the combined focused runtime suites contain 99 passing checks: 29 default-resolution comparisons/capability checks and 70 native SDK adapter/binding checks. This includes passing characterizations of unsupported cases, not a claim those configurations now work. No paid model calls or whole-suite run were used.

Meaningful mutations were detected: selecting required-only defaults, publishing private configuration, reversing type-level override precedence, and treating optional configured properties as guaranteed. Temporary mutation copies were removed; originals were not overwritten. The native SDK binding fixture additionally checks approval/streaming/concurrency behavior using the same declaration resolver.

This demonstrates the resolution algorithm for supported declaration capabilities. The external review confirms that public capability admission and usable signatures remain a design gate, followed by production integration, provider projection, and a subsequent complete Phase 2 review. No production merge/type behavior was changed by these probes.

## Subsequent reconciliation, 2026-10-19

The [current plan](plan.md#context-sources-and-preparation) selects bounded one-level union declaration discovery in addition to the demonstrated capability matrix above. The existing fixtures have not been extended here; the older matrix describes their actual evidence. Source-free local validation must retain native union support. Union tools with only private dependencies can retain faithful native metadata once name discovery is proved; tool public-default projection remains separately restricted. The private-key signature must be composed with the public configured-omission/closed-shape callable, including the explicit-public-declaration direction for no-schema configured names and the confirmed registered-tool-name protection. The resolved contract has no blanket private-protection bypass; this policy resolution does not complete the composed proof. See the [reconciliation ledger](phase2-review.md#reconciliation-after-the-current-source-review-2026-10-19); these requirements are not new passing test claims.
