# Compile-only API contracts

These files are TypeScript consumer programs, never Mocha tests. They import the public `casai` entry point and require no models, keys, network calls, or runtime fixtures. TypeScript 7.0.2 is the minimum supported compiler. `npm run test:types` checks source and built declarations with TS7. Source checks use the repository's strict settings; declaration checks also enable `exactOptionalPropertyTypes`. The production editor fixture uses the TS7 language server in both modes. TS6 remains installed only for development tools requiring its compiler API, such as ESLint.

Each invalid case has a descriptive `@ts-expect-error` on the failing line. If the API starts accepting it, the compiler reports an unused directive. Valid neighboring cases have no directive, so an overly restrictive API also fails. `expectEqual<Actual, Expected>()` checks exact inference, including accidental `any` or `unknown` widening; `expectType<T>(value)` checks assignability.

The default gate includes these source assertions in `tsconfig.source.json` alongside the implementation and runtime-test types, sharing one compiler program. `exact-optional.ts` is checked only by the emitted exact-optional profile. `npm run typecheck:safety:src` remains available for a focused source API check; the full gate does not run it redundantly. Emitted runtime-test consumers use `tsconfig.consumers.json`, which adds only tests as roots while retaining their intentional internal source imports.

Internal SDK wrapper checks live in `../ResultAugmentation.types.ts`. The root project compiles that file with its source settings; Mocha does not execute it. Keeping internal source imports out of this folder ensures the stricter consumer checks use the built declarations.

| File | Contracts |
| --- | --- |
| `config-contracts.ts` | Incomplete fragments, compatible component families, required settings, unknown keys, inherited replacements, map merges, message/loader preservation, immutable run settings |
| `object-contracts.ts` | Object, array, enum and schemaless modes; schema requirements; mode switches; Zod and SDK schemas; annotated configs; exact result types |
| `input-contracts.ts` | Required and optional input fields, configured context, replacement schemas, raw Zod inputs, reusable raw/parsed fragments, renderer schema constraints, standalone and inherited calls, run context |
| `conditional-contracts.ts` | Conditional output schemas, raw/parsed result alternatives, and complete-input requirements for omitted calls with union-valued configuration |
| `schema-presence.ts` | Optional and conditional schemas, unannotated spreads, raw/parsed callback and result types, inherited omission/undefined, configured privacy and native descriptor callbacks |
| `conditional-input-contracts.ts` | Conditional input inference and private ownership, raw/parsed callback alternatives, annotated contracts, inheritance, all preparer families and conditional producer requirements |
| `union-consumer-contracts.ts` | Mixed stream/scalar tool results, branch-only public/private argument keys, and shared admission across all LLM renderers, loaders and tool forms |
| `caller-alternatives.ts` | Valid disjoint argument unions, catchall/undefined rejection, contextual callbacks, bound helper omissions and safe narrowing of component alternatives |
| `alternative-contracts.ts` | Whole-configuration schema/private-binding alternatives, inherited and collected results, mixed closed/open/catchall branches, configured discriminator changes and unchanged no-schema input |
| `configuration-alternative-guards.ts` | Conditional registries and required context, branch-only inherited hooks and lifecycle callbacks, forbidden settings, null context admission and valid correlated configuration/output-mode alternatives |
| `schema-identity.ts` | Zod Classic/Mini declaration inference, non-JSON local defaults, private intersection/pipeline names, closed inputs, native example typing and Zod 3 rejection |
| `descriptor-contracts.ts` | Native description callback inference, inherited context compatibility, replacement callbacks, fragments and ordinary description validation |
| `context-schema-boundaries.ts` | Raw object contexts versus parsed tool inputs, scalar/array schema boundaries, preprocessors, output coercion and fragment callback returns |
| `tool-contracts.ts` | All tool-capable factory variants, parsed tool inputs, output types, SDK execution options, context schemas, merged tool sets and compatible replacements |
| `tool-context-alternatives.ts` | Selected versus intrinsic union context schemas, raw binding/registry/run requirements, whole-configuration correlations, and absent ordinary-call dependencies across empty and transformed public inputs |
| `registry-substitution.ts` | Helper raw inputs, configured omissions, private reservations, open/closed and selected schema alternatives, compatible widening, inherited/run replacements, new callbacks, native helpers and shadowing |
| `prompt-contracts.ts` | Every LLM prompt modifier, positional argument rules, missing prompts, run prompts, sync/async function prompts, direct versus promised stream results |
| `sdk-callbacks.ts` | SDK callback inventory, argument and return contracts, aliases, arrays, nested maps, lifecycle/telemetry hooks, inheritance and run overrides |
| `sdk-config-specialization.ts` | Explicit text-config output/runtime-context specialization, native request parity, contextual callbacks and object-finish function contracts |
| `sdk-type-ownership.ts` | Complete native object config/result surfaces, deliberate mode/enum adaptations, tool executor arguments and execution metadata |
| `sdk-results.ts` | SDK result member preservation, structured outputs, tool discriminants, promises, streams, response history and response-conversion callbacks |
| `result-augmentation.ts` | Augmented values, parsed output types, known and erased output names, output unions and inherited configurations |
| `cancellation.ts` | Invocation-only signals, rejected constructor/inherited settings, and typed cancellation on ordinary, rendered and loaded LLM run calls |
| `public-contracts.ts` | Factory/modifier inventory, public aliases, exported types, annotated schema inference, loaders, race groups, providers, message schemas and errors |
| `annotation-contracts.ts` | Exported configuration annotations, schema presence, typed renderer/tool inputs and outputs, prompt kinds, tool contexts and SDK finish callbacks |
| `helper-specialization.ts` | Specialized reusable prompt callbacks, native schema event aliases, bound context types, injected raw inputs and parsed SDK callback values |
| `renderer-call-contracts.ts` | Standalone and inherited processed config, nested renderer defaults, required bodies, positional prompt/history/context forms and exact call/run results |
| `family-contracts.ts` | Allowed renderer settings, forbidden local/inherited settings, body/option/filter value types and cross-family component parents |
| `message-contracts.ts` | Validator output consumed by components, SDK message input drift, provider-qualified custom parts and narrowed parsed content |
| `exact-optional.ts` | Consumer behavior that specifically depends on exact optional property types |

Coverage comes from the README's API contracts, implementation behavior, existing runtime tests, the installed SDK declarations, and adversarial combinations such as empty inherited children, uncertain settings, transformed/defaulted schemas, and incompatible map replacements. Factory/modifier and SDK callback inventory assertions require review when those APIs change. Runtime-only conditions such as custom schema refinements still belong in runtime tests.

For a coverage audit, first inventory the currently implemented exports and SDK callback/result members independently of these tests. Trace their runtime dispatch, validation and merge behavior, then vary boundaries: literal versus annotated values, standalone versus inherited versus run overrides, required versus optional fields, raw versus parsed schemas, and union branches versus configured defaults. Pair each new rejection with a valid neighboring case and verify exact inference where assignment could hide widening. Planned APIs in design documents are outside this inventory until implemented.

Exercise standalone factory inference separately from `Config` parents. Put every tool-capable component family in SDK tool maps and check its downstream callback input/output types. Assert callable and `.run()` returns exactly, including calls through component unions, verify exposed processed settings against runtime normalization, and feed public validator outputs back into component APIs. These checks protect paths that a schema or tool tested only through a reusable parent can miss.

When adding an API or fixing a type leak, add both a valid example and a negative case here. Give each negative case one intended violation, and supply unrelated required settings so it cannot pass because of a different error. Avoid casts in these probes: they bypass the contract being tested.

The production type fault-injection fixture accepts an optional mutation-name regular expression, for example `node tests/fixtures/phase2-production-types.cjs "selected|helper|closed tool|caller"`. The default still runs every mutation; either form retains the type-instantiation cost checks.
