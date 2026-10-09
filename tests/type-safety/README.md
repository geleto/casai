# Compile-only API contracts

These files are TypeScript consumer programs, never Mocha tests. They import the public `casai` entry point and require no models, keys, network calls, or runtime fixtures. `npm run test:types` checks them with TS7 and TS6 against source and built declarations. Source checks use the repository's strict settings; declaration checks also enable `exactOptionalPropertyTypes`.

Each invalid case has a descriptive `@ts-expect-error` on the failing line. If the API starts accepting it, the compiler reports an unused directive. Valid neighboring cases have no directive, so an overly restrictive API also fails. `expectEqual<Actual, Expected>()` checks exact inference, including accidental `any` or `unknown` widening; `expectType<T>(value)` checks assignability.

| File | Contracts |
| --- | --- |
| `config-contracts.ts` | Incomplete fragments, compatible component families, required settings, unknown keys, inherited replacements, map merges, message/loader preservation, immutable run settings |
| `object-contracts.ts` | Object, array, enum and schemaless modes; schema requirements; mode switches; Zod and SDK schemas; annotated configs; exact result types |
| `input-contracts.ts` | Required and optional input fields, configured context, replacement schemas, raw Zod inputs, reusable raw/parsed fragments, renderer schema constraints, standalone and inherited calls, run context |
| `context-schema-boundaries.ts` | Raw object contexts versus parsed tool inputs, scalar/array schema boundaries, preprocessors, output coercion and fragment callback returns |
| `tool-contracts.ts` | All tool-capable factory variants, parsed tool inputs, output types, SDK execution options, context schemas, merged tool sets and compatible replacements |
| `prompt-contracts.ts` | Every LLM prompt modifier, positional argument rules, missing prompts, run prompts, sync/async function prompts, direct versus promised stream results |
| `sdk-callbacks.ts` | SDK callback inventory, argument and return contracts, aliases, arrays, nested maps, lifecycle/telemetry hooks, inheritance and run overrides |
| `sdk-results.ts` | SDK result member preservation, structured outputs, tool discriminants, promises, streams, response history and response-conversion callbacks |
| `public-contracts.ts` | Factory/modifier inventory, public aliases, exported types, annotated schema inference, loaders, race groups, providers, message schemas and errors |
| `annotation-contracts.ts` | Exported configuration annotations, schema presence, typed renderer/tool inputs and outputs, prompt kinds, tool contexts and SDK finish callbacks |
| `renderer-call-contracts.ts` | Standalone and inherited processed config, nested renderer defaults, required bodies, positional prompt/history/context forms and exact call/run results |
| `family-contracts.ts` | Allowed renderer settings, forbidden local/inherited settings, body/option/filter value types and cross-family component parents |
| `message-contracts.ts` | Validator output consumed by components, SDK message input drift, provider-qualified custom parts and narrowed parsed content |
| `exact-optional.ts` | Consumer behavior that specifically depends on exact optional property types |

Coverage comes from the README's API contracts, implementation behavior, existing runtime tests, the installed SDK declarations, and adversarial combinations such as empty inherited children, uncertain settings, transformed/defaulted schemas, and incompatible map replacements. Factory/modifier and SDK callback inventory assertions require review when those APIs change. Runtime-only conditions such as custom schema refinements still belong in runtime tests.

For a coverage audit, first inventory the currently implemented exports and SDK callback/result members independently of these tests. Trace their runtime dispatch, validation and merge behavior, then vary boundaries: literal versus annotated values, standalone versus inherited versus run overrides, required versus optional fields, raw versus parsed schemas, and union branches versus configured defaults. Pair each new rejection with a valid neighboring case and verify exact inference where assignment could hide widening. Planned APIs in design documents are outside this inventory until implemented.

Exercise standalone factory inference separately from `Config` parents. Put every tool-capable component family in SDK tool maps and check its downstream callback input/output types. Assert callable and `.run()` returns exactly, including calls through component unions, verify exposed processed settings against runtime normalization, and feed public validator outputs back into component APIs. These checks protect paths that a schema or tool tested only through a reusable parent can miss.

When adding an API or fixing a type leak, add both a valid example and a negative case here. Give each negative case one intended violation, and supply unrelated required settings so it cannot pass because of a different error. Avoid casts in these probes: they bypass the contract being tested.
