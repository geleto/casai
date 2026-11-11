# Configuration mixing: focused review

Date: 2026-11-08. Reference: current source, TypeScript 7.0.2 and installed `ai@7.0.162`. No production implementation changes or provider calls.

## Result

No configuration-mixing type-checking defect was found in the checked cases. All 14 component families retain the one-compatible-shape rule, including standalone and inherited Config. This is bounded evidence for the cases below, not proof of every possible generic TypeScript program.

The runtime streaming-control gaps are real and shared across several factories. They remain implementation work in the [streaming modifier plan](streaming-modifiers-plan.md). Runtime delegation of unknown native settings is a separate, previously selected policy; it does not authorize mixing configuration types.

## Type coverage

The public inventory was checked against `create` and the component registry: Template, Script, Function, LLMAgent, Decision, Embedder, Reranker, ImageGenerator, Transcriber, StreamingTranscriber, SpeechGenerator, StreamingSpeechGenerator, StreamingTranslator and VoiceSessionSetup, plus Config.

The generated fixture has **208 positive cases and 313 expected-rejection cases**, covering **153 current factory paths**. Each source/tool/stream modifier path has a valid construction and a matching construction with a foreign authored-source setting. The foreign field is selected independently: `script` on Template, `template` on every other family, whose source has a different name.

For every family, the checks include direct literals, variables, empty and nonempty children, raw parent providers, standalone Config, Config inheritance, explicit unions with an invalid branch, and named `.run()` settings. Valid controls include reusable shared settings and the same property names inside application context. Specialized public configuration annotations are also passed to their factories.

Additional cases distinguish native settings with overlapping names:

- Complete speech's string output format versus streaming speech's format object.
- Recorded audio versus live audio streams for transcription and translation.
- Speech voice settings versus transcription and reranking settings.
- A fragment combining complete speech output format with live input format, directly and through inheritance.
- Valid alternatives of separate Config shapes versus one alternative that mixes fields.
- Inherited LLMAgent streaming metadata on every specialized factory.

Both source checks and checks against freshly emitted declarations with exact optional properties passed. The declaration build used an isolated copy of current source, not stale workspace output.

Two isolated mutations confirmed that the checks detect weakened enforcement:

| Mutation | Newly accepted invalid statements detected |
| --- | ---: |
| Remove Config's exact-key check in `StrictUnionSubtype` | 46 |
| Remove the shared specialized factory's unknown-key check | 186 |

Each mutant failed only with unused expected-error directives; an unrelated compilation failure did not count as detection. The unchanged isolated baseline and restored source passed. A subsequent pass against fresh declarations found no additional mixing defect in this scope.

## Runtime coverage

Construction-only JavaScript probes deliberately bypassed TypeScript. Every valid control constructed successfully.

| Components | Foreign source field | `streaming: true` | `streaming: false` |
| --- | --- | --- | --- |
| Template, Script, Function | Rejected | Rejected | Rejected |
| LLMAgent | Rejected | Supported | Rejected directly, but hidden by inherited `true` |
| Decision, Embedder, Reranker, ImageGenerator, Transcriber, SpeechGenerator, VoiceSessionSetup | Accepted | Accepted despite no current streaming modifier | Accepted |
| StreamingTranscriber, StreamingSpeechGenerator, StreamingTranslator | Accepted | Accepted as an undeclared extra setting | Accepted despite always streaming |
| Config | Mixed source fields accepted at runtime | Allowed as an incomplete fragment | Incorrectly accepted |

Config's single-shape compatibility check is compile-time; its runtime checks are deliberately common structural checks. Specialized factories delegate unknown native settings at runtime. The table must not be read as evidence that these calls pass TypeScript.

The actionable runtime fixes concern **Casai-owned controls**: check raw `streaming` values in the common validator before sticky merging can hide `false`, reject unsupported streaming operations at construction, and prevent the configuration-only flag from leaking into SDK requests or being changed through `.run()`. Do not infer a need to restore native-option allowlists from these results.

## Type visibility and scope limits

A conditional expression between a valid object and a structural subtype with extra fields can infer the common, narrower field set before reaching Casai. An independent probe confirmed this: the extra property is already absent from the expression's type. Passing the extra-field object directly, or retaining both branches in an explicit union, is rejected. This is ordinary TypeScript information loss, not a component selectively allowing visible mixed fields; do not add provenance tracking to recover erased information.

Initial broad annotations for older components erased source/schema requirements and were not valid positive controls. They were excluded from the annotation subset rather than counted as mixing defects. Their concrete construction/modifier paths remain covered. This review does not claim a complete public-annotation, schema, execution or security audit.

Reproducible evidence is under `.cache/config-mixing-audit/`: `generate.mjs`, the generated family/modifier/interaction fixtures, `inventory.json`, runtime probes/results, isolated mutation scripts/logs, the fresh declaration build and the separate type-erasure probe. These are local review artifacts, not a replacement for the maintained implementation regression suite.
