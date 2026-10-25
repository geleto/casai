# Phase 2 combined runtime and callable proof

> Historical design evidence: the isolated prototype implementations and their runnable checkers were retired on 2026-10-21. Current acceptance uses production factory, schema, registry, lifecycle, generated security and public-consumer tests. See the schema-identity correction in [the review ledger](phase2-review.md). Historical commands and prototype source names below describe the investigation, not current regression gates.


Date: 2026-10-19. This follows the [public API proof](phase2-public-api-proof.md) and [private-boundary investigation](phase2-private-boundary-review.md), under the subsequently confirmed private-field policy. It is an isolated candidate, not a production implementation or a whole-phase security clearance.

The [binding continuation follow-up](phase2-review.md#binding-continuation-and-call-envelope-follow-up-2026-10-19) adds safe errors at lazy binding-context preparation, approval/UI regressions and closed coded `.run()` settings in this bounded candidate. Its newer verification supersedes the counts below; final factories and renderer integration remain outside the proof.

The subsequent [dictionary-boundary review](phase2-review.md#dictionary-boundary-and-whole-surface-pass-2026-10-19) corrects own-property handling in selected defaults, tool context, fallback insertion and helper typing. Its paired runtime/type cases and mutations extend the candidate without introducing reserved-name bans or changing native schema semantics.

The [partial-context-knowledge review](phase2-review.md#partial-context-knowledge-review-2026-10-20) then found a security defect in mixed declared/opaque context unions: an opaque sibling erased known private reservations. The shared discovery proof now retains known names, with local/SDK/native-comparison, callable-type and independent mutation cases. It also aligns admission with declaration discovery triggered by context reservations and executable registries, including inheritance/removal and source-free neighbors. These corrections close demonstrated candidate defects; final production integration remains required.

## Question and result

The later [security attack-path review](phase2-review.md#security-attack-path-review-2026-10-20) adds actual bare-context, nested failure-transport and owner/sibling isolation checks. It also corrects output-schema callback inference and registered-alternative helper typing. Its verification is additional evidence; the original bounded scope and production integration gates below remain.

Can **one implemented callable**, rather than separate type sketches, combine configured public defaults, raw/parsed schemas, private-key protection, closed-shape checks, no-schema callbacks, binding and registered helpers?

The candidate in [phase2-composed-api.ts](../tests/fixtures/phase2-composed-api.ts) composes those requirements. Its runtime tests and compiler consumer import that same factory. It retains one application schema; it adds neither an author-supplied ownership schema nor an unrestricted override flag. Runtime validation remains necessary when structural typing hides actual object keys.

This establishes bounded feasibility for starting the shared Function slice. It does not establish that existing factories already enforce the policy. Production integration, full schema projection and the complete consumer review remain required.

The subsequent [complete surface audit](phase2-review.md#complete-surface-audit-2026-10-19) found and corrected parsed-`undefined` normalization and a mismatch between isolated and repository compiler options. The original results below are dated evidence; the follow-up ledger records the updated 31-case suite, additional guard mutation and repository-wide validation. These corrections do not change the agreed API policy or remove the integration bounds.

The later [generated security and consumer review](phase2-review.md#generated-security-and-consumer-review-2026-10-20) adds a bounded, independently specified ownership oracle across 16,128 generated application cases, forwarding and real SDK transport, plus sequential state and native approval integrity/replay characterization. The combined runner includes the new suite and three additional semantic mutations. It adds evidence without changing the candidate adapter or completing production integration; freezing is deferred.

The later [external-review reconciliation](phase2-review.md#external-review-reconciliation-2026-10-19) adds a paired open/closed migration recipe, matching-private-value rejection, and the missing owned output-error boundary. The candidate now preserves the native validation error as `ConfigError.cause` while leaving body failures unchanged. Its updated verification is recorded there; the original counts below describe the earlier pass.

The subsequent [consumer-first review](phase2-review.md#consumer-first-review-2026-10-19) extends this to injected plain native tools. Their input/context validation now uses the same owned error contract; a private context validation message must not escape through an outer tool into the next model request. Generation/streaming regressions and separate input/context mutations cover that correction. This is still an isolated candidate, not an implemented production security boundary.

## What changed in the candidate

The combined checks exposed problems that the separate proofs had not covered:

1. Ordinary `Omit` lost explicit field types beside an open index signature. A homomorphic key-remapping form preserves named raw/parsed properties, including private dependencies in implementation context.
2. The supplied-key calculation selected the wrong side of `Extract` for open objects. Explicit supplied keys must be selected from the argument's keys, not recovered by intersecting a broad `string` key with a finite set.
3. An inline callback could make inference fall back to a constraint where an explicitly supplied configured field remained optional. A supplied-key-aware overload handles that contextual-typing case; the existing general overload retains optional-variable and union behavior. Both overloads retain the same effective-input and private/excess-key checks. Tests include partial overrides of several defaults and explicit `undefined` beside a callback.
4. Registered Casai components cannot be typed or run solely as erased native SDK tools. Their helpers retain the original raw input schema, configured/bound omissions and private names; the owner creates an invocation-local binding. Explicit SDK tools retain native input/context type limitations and native `executeTool` result normalization.
5. Optional public or configured tool-name shadows can be absent, allowing a helper to be injected. Callback types therefore include the fallback function where absence is possible. Own `undefined` still shadows it. Optional executors, required public shadows and broad configured maps have corresponding types; open public extras do not gain permission to replace helpers.

These correct the candidate's implementation/types without changing the agreed merge or security contract.

## Paired coverage

| Boundary | Runtime evidence | Type evidence |
| :--- | :--- | :--- |
| Ordinary call and `.run()` | Public defaults selected before one parse; private values retained; caller override and explicit `undefined`; no raw defaults restored after transforms | Same default-aware signature rejects known private keys and wrong raw types; inline callbacks remain contextual; required fields, optional configurations and correlated unions |
| Open, catchall, stripping and strict input | Native parser behavior followed by retained-private-key rejection; explicit public overrides allowed | Open extras retain their native types; closed shapes reject undeclared literal and variable keys; native catchall index-signature limitations remain |
| No `inputSchema` | Configured names remain private, unrelated arguments accepted; ordinary child forwarding rejected | Callback-derived requirements and return types; configured dependencies checked; private names rejected on the same callable and `.run()` |
| Configuration inheritance | Context/default and registry fragments merge; child tool removal removes helper protection | Inherited default omissions, explicit clearing, private names, helper/context requirements and registry removal |
| Declared union inputs | Source-free parsing needs no discovery; one level of object branches supplies names with unrelated private configuration; unchanged model metadata retained | Zod 3/4 branches, correlated defaults, complete shallow-merge validation and rejected discriminator changes retaining obsolete fields |
| Explicit binding | Configuration < parsed tool context < arguments; captured raw context remains honestly typed; independent bindings; parsed context reused on injected calls | Raw tool-context types, bound default omissions, optional private names and ordinary-path dependency requirements |
| Registered helpers | Native scalar input and preliminary/final normalization; Casai raw parsing and one context preparation per owner invocation; cancellation/metadata; deliberate shadowing | Raw Casai inputs, completed results, required registry context, unschematized captured defaults, private/helper collisions, optional shadows/executors |
| Native generation and streaming | Known private model input fails before input hooks/approval/body; final guard catches native refinement; forwarding into a no-schema child fails; private sentinels absent from all step histories and next requests | Returned tools and binding pairs consumed by native SDK types, preserving the documented raw-context erasure boundary |

The tests count body entries independently of thrown errors. Structural narrowing is tested without a cast to show why compiler rejection cannot replace runtime enforcement. Compiler diagnostics identify private/undeclared names and configured keys retained in an incompatible union branch.

## Repeatable verification

Run:

```bash
npm run test:phase2-composed
```

The runner performs:

- TS7 and TS6 checks of the actual runtime test and public consumer, with exact optional properties both enabled and disabled.
- Declaration emission by each compiler into a temporary directory; each declaration build is consumed by both compilers and both optional-property modes.
- Language-service checks against source and both declaration builds: ordinary/run/bound/no-schema completion, implementation private fields, inline callback inference and named diagnostics.
- The mock-only runtime suite, including native generation and streaming.
- Eight targeted mutations: remove caller privacy, remove effective merge validation, regress open named-field preservation, regress supplied-key inference, remove the pre-approval guard, remove the final guard, remove registered-name ownership, and reverse binding priority.
- A compiler-cost comparison against the current production Function factory using the same 24 valid construction/call cases and import graph. The provisional proof budget is at most twice the baseline's instantiations. Time and memory are recorded as observations, not timing-sensitive assertions. Production-wide and editor cost must still be measured after integration.

All temporary artifacts are created under a unique workspace child and removed after checking that the cleanup target is that child. Production source and package `dist` are untouched.

Validation: **30 runtime tests passed**, all compiler/declaration/editor combinations passed, and all eight mutations were caught. Targeted ESLint passed. No paid model calls or full-suite run was needed.

The final measured common-workload comparison was:

| Compiler | Current Function instantiations | Candidate instantiations | Increase | Check time, current / candidate | Memory, current / candidate |
| :--- | ---: | ---: | ---: | :--- | :--- |
| TS7 | 567,660 | 643,892 | 13.4% | 0.737 / 0.718 s | 229,808 / 234,170 K |
| TS6 | 394,891 | 452,595 | 14.6% | 5.20 / 5.99 s | 308,326 / 345,400 K |

Both pass the proof budget. These numbers describe this workload and import graph, not a forecast for all final factories or editor sessions.

## Deliberate bounds and remaining integration work

- The fixture is a candidate Function-like factory. Its names and extra `binding.invoke` surface support testing; they do not add public package APIs. Schema-backed candidate instances expose descriptors directly to exercise both boundaries.
- Fragment inheritance is composed here. Inherited implementation/schema replacement compatibility remains covered separately by the earlier API proof and must be joined to the final production factory overloads. The new fragment overloads explicitly reject full component parents instead of silently promising unsupported inference.
- Declaration discovery supports direct root unions with one level of declared object branches, or faithful corresponding SDK metadata. It does not select a branch, trial-parse fragments, rewrite references or implement general composition. Source-free schemas retain native parsing. Public-default tool projection of root unions remains unsupported, as already specified.
- The minimal descriptor exercises omitted configured requirements. It is not the complete production projector: configured-default annotations, reference/conditional restrictions and provider/UI consumer coverage retain their existing gates. Existing lifecycle/approval-continuation and native schema-copying proofs remain relevant; this suite does not replace them.
- A real callback that depends on a private value must receive it on every supported path. Tool-only context cannot make an ordinary callable's dependencies complete. Native SDK tools still have erased raw schema types; no recovery mechanism is introduced.
- Known private runtime names, own `undefined` and supported parsed-context declarations are protected. Unidentifiable absent names remain the accepted authoring limitation. Type inference does not manufacture missing runtime declarations. Explicitly public structured defaults must be safe to publish in their entirety.
- Real Script/Template/preparer call forms, Cascada keyword normalization, the newer runtime/compiler/renderer handoff, and current factory security corrections still require production integration. This proof neither changes the installed runtime nor introduces a legacy patch.
- The local proof error class avoids pulling production modules compiled without exact optional properties into the isolated strict-optional test. This is not evidence that all production source compiles under that flag; emitted consumer declarations remain the package requirement.

The final integration pass must inventory all affected factories and downstream consumers, then repeat the [review process](review-process.md). Passing this proof permits implementation of the agreed design; it does not demonstrate the absence of every possible defect.
