# Phase 6 follow-up implementation review — 2026-11-16

**Status: corrected and reviewed, 2026-11-16.** All four findings are fixed; the subsequent complete pass found no important unresolved implementation issue. See [corrections and verification](#corrections-and-closure).

The initial pass reviewed the implementation after the earlier [eight-finding closure](phase6-review-2026-11-16.md#corrections-and-closure-2026-11-16) and the [worker responsiveness changes](audio-processing-benchmark.md#worker-only-responsiveness-revision). It found the four defects described below, without changing production code during that initial pass. The separate file-target policy conflict was resolved with the user and its documentation corrected. The finding descriptions preserve the pre-fix behavior; the closure records the subsequent corrections. Native platform/provenance/distribution checks and the coordinated Cascada release remain separate release gates.

## 1. Conditional streaming metadata is treated as definite streaming

**P2 — fix in Phase 6.** The audio factories select streaming settings and results using `true extends ConfigValue<T, typeof streamMode>`. That test is also true for optional metadata, so a configuration that may produce completed delivery is typed as definitely streamed. See [Transcriber](../src/factories/Transcriber.ts), [SpeechGenerator](../src/factories/SpeechGenerator.ts) and [Translator](../src/factories/Translator.ts), including their selected/request settings, not only their result types.

This uses public Config composition without authoring internal metadata:

```ts
const maybeLive = Math.random() ? Config.asStream({}).config : undefined;
const transcribe = Transcriber({ model, inputAudioFormat: format, ...maybeLive });
const onlyStream: Promise<StreamTranscriptionResult> = transcribe(new Uint8Array(2));
```

The assignment compiles, although the non-streaming branch returns a completed result without `fullStream`. Equivalent speech and translation assignments compile too. Adding `includeRawChunks: true` is also accepted for all three, but construction throws `ConfigError` when the optional modifier is absent. This is both an inaccurate result type and an admitted configuration that is invalid on one possible runtime branch.

**Correction:** preserve definite, possible and absent streaming metadata, following the existing [LLMAgent result distinction](../src/types/agent.ts). Return a union when delivery is uncertain and admit only settings valid for every possible delivery branch. Do not introduce another runtime selector or fix only the result alias.

**Evidence and missing tests:** source and emitted-declaration probes compile the unsafe assignments with both normal and exact optional properties. LLMAgent rejects its equivalent stream-only assignment, providing a control. Mocked Transcriber calls confirm both runtime result shapes and conditional construction failure. Add maintained cases for conditional Config spreads, parent/intermediate composition, stream-only settings and both declaration/optional-property modes.

## 2. Loaded-audio tool shorthand misclassifies uploaded streams as context

**P2 — fix in Phase 6.** Trusted direct calls to `.loadsAudio.asTool` allow source overrides, including byte streams. However, [call classification](../src/runtime/component-call.ts) requires a literal source not to be a context argument. The shared [context predicate](../src/runtime/execution.ts) excludes URL, ArrayBuffer and byte views but not ReadableStream. [Input/context types](../src/types/input.ts) make the same distinction and reject this valid shorthand.

```ts
const transcribe = Transcriber.loadsAudio.asTool({
  model, audio: configuredWav, inputAudioFormat: format,
  inputSchema: z.object({}),
});
await transcribe(uploadedStream);               // Rejected as context.
await transcribe.run({ audio: uploadedStream }); // Correct source override.
```

On Node, the shorthand fails with undeclared tool input keys from the stream's internal symbols. The named call succeeds. Byte-array shorthand also succeeds. Translator reproduces the same failure. Static shorthand calls with a stream, including an explicit following context object, are incorrectly rejected; the named form compiles.

**Correction:** recognize byte-stream source values consistently in runtime argument classification and type-level context extraction. Keep descriptor/injected tool calls restricted to the configured resource; this finding concerns trusted application calls only. Do not grant model arguments new source authority.

**Evidence and missing tests:** a configured recording with 4,800 PCM bytes and replacement recording with 9,600 bytes distinguishes actual source selection. Byte shorthand and stream named calls process 9,600 bytes; stream shorthand fails in both families. Add a source-representation matrix across direct/named application calls and SDK/injected tool calls, preserving the model resource boundary and same-named application data.

## 3. `resume()` copies away inherited removed controls before validation

**P3 — fix in Phase 6.** [LLMAgent.resume](../src/runtime/llm-agent.ts) normalizes arguments and destructures `{ approve, ...settings }` before invoking the shared control validator. This loses inherited declarations:

```ts
await agent.resume(history, Object.create({ streaming: undefined }));
```

Inherited `streaming`, `asTool` and `promptType`, including undefined values, are accepted and a model request executes. Inherited modifier metadata from `Object.create(Config.asStream({}).config)` is also lost. Own declarations are already rejected. This violates the explicit removed-control contract and differs from the original-object check used by `.run()`.

**Correction:** reuse the existing modifier validator on the original resume options before normalization/copying can discard declarations. Preserve same-named fields inside application context. This requires a small boundary correction, not additional validation machinery for arbitrary invalid developer input.

**Evidence and missing tests:** focused probes count one mocked generation for each inherited removed selector and inherited modifier metadata. Add true/false/undefined inherited cases and assert rejection before any model effect; retain own-property and valid application-context controls.

## 4. Finite raw-byte adaptation exceeds the specified chunk bound

**P3 — fix in Phase 6.** [Raw-byte normalization](../src/audio.ts) emits chunks of 65,536 bytes, while the [selected contract](streaming-modifiers-plan.md#recorded-audio-translation) specifies a maximum of 9,600 bytes. A 100,000-byte input produces `[65536, 34464]`.

The selected bound also aligns mono/stereo 8/16/24/32-bit frames; 65,536 does not align 24-bit samples. This review establishes the bound mismatch, not an observed provider corruption or latency failure. Existing PCM16 cases do not expose the frame-size distinction.

**Correction:** use the specified 9,600-byte bound in finite raw-byte normalization. Leave native encoded-upload transport chunking and caller-owned streams unchanged; add no generic rechunker or pacing layer.

**Missing tests:** assert maximum size, complete byte preservation and unchanged final remainder, including a 24-bit/stereo frame-size control, fresh adaptation on repeated finite-byte calls, and unchanged caller-stream identity.

## Resolved file-target policy

The implementation's [file preparation](../src/audio/native-pipeline.ts) and `FileAudioTarget.alternatives` declaration already agree: search the primary profile and alternatives in order for a compatible copy; otherwise convert to the primary. Some plan and guide wording instead promised automatic selection of a lossless conversion alternative.

The user selected **keep explicit primary target; correct the plan and guide**. A PCM input with an AAC primary and FLAC alternative therefore converts to AAC when neither profile can copy the input. Choose a lossless primary and suitable sample constraints when conversion fidelity is desired. Native encoder support still governs available representations. Alternatives remain useful for retaining already compatible source encodings.

Updated the detailed plan, Phase 6 scope index, both guides, matrix concept and AGENTS contract. The plan's verification row now requires the primary-target conversion case. No codec-quality catalog, target-ranking algorithm, retry search or production change is needed.

## Coverage and architectural assessment

The inventory covered public exports, factories/Config/modifiers, inheritance and spreads, call/run/native Agent methods, tool descriptors and injected execution, schema/context/source boundaries, request-shape dispatch, completed/streamed result consumers, PCM/WAV helpers, ordered and finite worker paths, native preparation/worker ownership, optional package loading, source/emitted consumer types, guides and matrix contracts. Installed SDK execution/result implementations and node-av conversion/ownership code were inspected for the relevant boundaries.

The architecture remains coherent: components stay stateless, request shape selects one SDK operation, completed adapters collect one execution, and worker ownership moves heavy preparation off the calling thread. No further abstraction, capability catalog or lifecycle runtime is justified by this pass. Repeated checks at construction and invocation serve different error boundaries; removing them wholesale would not simplify the contract safely. Retired streaming factory names are absent from production exports. No additional naming, algorithmic-efficiency or removable-scaffolding finding was substantiated.

A suspected missing encoded-conversion layout check was tested rather than added: mono-to-mono playlist conversion succeeds, while a mono-to-stereo change targeting mono PCM WAV is rejected by the native encoder. Adding duplicate Casai validation is unnecessary. The accepted copy/remux metadata-inspection limitation remains distinct and does not require another decode pass.

## Initial review verification

- **88 existing tests pass:** Phase6Audio, AudioPreparation, PcmWorkers, NativeAudio, ConfigModifiers, ModifierInheritance and MediaToolAdapters. This includes 17 native tests on the installed LGPL baseline.
- Focused offline runtime probes reproduce the four findings, exercise their valid controls and confirm primary-target selection. Source and emitted-declaration probes cover both optional-property modes. Compilation success for an unsafe assignment is evidence of the defect, not a passing correctness assertion.
- Small generated native fixtures and local HTTP controls test changing playlist layouts without provider calls.
- `npm run test:matrix` passes: 143 shapes, 784 distinct property records, 1,571 documentation/browser selections and 1,458 executed SDK-mock selections; current matrix examples type-check. Native-media examples remain separately covered by the focused native suite above.
- Focused ESLint for the changed matrix concept, review-link/anchor validation and whitespace checks pass. No generated API snapshot changed because the corrected policy describes the existing implementation and declarations.

No paid APIs, full coverage run or whole-project lint/type gate was repeated in this review. Prior paid acceptance remains evidence for the recorded unchanged provider routes, not proof that the four newly identified cases pass.

## Corrections and closure

The four corrections are implemented and verified. A subsequent complete review found no important unresolved implementation issue. No design decision remains for the user.

| Finding | Correction and maintained evidence |
| --- | --- |
| Conditional delivery | Each audio family retains definite/possible/absent delivery in its result type. Raw-event settings require definite streaming. Speech validates every possible native request when its modifier is optional, while preserving correlated configuration alternatives. `tests/type-safety/phase6-audio.ts` covers source/declaration consumers, Config intermediates, valid unions, invalid stream-only settings and complete versus streaming speech requests. A mocked runtime control exercises both outcomes. |
| Uploaded stream shorthand | Runtime and type-level context classification give ReadableStream its source role. Plain native tools also accept that unambiguous source where supported. Native integration exercises Transcriber and Translator with byte/path/URL/stream overrides, direct/named calls, a following context and Cascada keyword context. Descriptor calls keep configured media despite a same-named model argument. |
| Resume controls | Resume reuses `runSettings` on the original options, retaining its original-object source checks before copying. Tests reject inherited true/false/undefined controls and modifier metadata with ordinary/keyword options before model execution. Existing non-enumerable source rejection, approval/history, hooks and same-named application context remain covered. |
| Raw chunk bound | Finite raw adaptation uses 9,600-byte chunks. Integration asserts byte preservation, full-frame alignment, final remainder, repeated finite calls, unchanged input and caller-stream identity. Native encoded transport chunking is unchanged. |
| Primary file target | A real native test converts PCM to an AAC primary despite a FLAC alternative, retaining the user-selected rule. Existing copy-alternative and lossless round-trip controls remain. Guides and the matrix explicitly describe trusted stream shorthand. |

Completed verification:

- **137 focused runtime tests pass**, including all 18 native preparation tests, resume, modifiers, component calls and media tool adapters.
- **Full `test:types` passes:** guide extraction, source/runtime-test compilation, package build, inferred declaration export/consumption, emitted consumers and exact optional API assertions. An additional source API probe passes with exact optional properties; runtime SDK mocks remain in the repository's normal optional-property profile.
- **10 selected audio type mutations and three runtime mutations are caught**, with successful unchanged controls. The runtime mutation fixture now copies the package's actual private import mappings; otherwise its worker-enabled control run fails before testing a mutation. This is a fixture correction, not a runtime fallback.
- **Matrix regeneration and verification pass:** 143 shapes, 784 property records, 1,571 documentation/browser selections and 1,458 mock executions. Generated public shape records are unchanged; the existing declarations now enforce the documented conditional contracts.
- **Full coverage gate passes: 1,912 tests**, 99.58% line/statement coverage, 96.29% branch coverage and 100% functions in its configured scope. The separate native integration above covers optional native preparation. The result-augmentation coverage gate also passes.
- **Full whole-project lint passes on the settled candidate** (431.4 seconds), with every rule and file checked. The earlier run's sole failure was a test-local `Object.create` assignment; its corrected annotation also passes focused lint and the affected source/type checks. The failed run was not cached as successful. Check-workflow tests also pass.

The subsequent pass retraced public exports, Config inheritance, source/call/run roles, schema and tool authority, native Agent methods, request selection, completion/stream ownership, worker/native boundaries and optional package consumers. No additional abstraction, provider catalog, native workaround or Cascada change is required. Recorded provider routes remain unchanged, so paid calls were not repeated. Native platform/provenance/distribution and coordinated Cascada publication remain release gates, separate from these implementation fixes.

### Final status reconciliation

The final whole-surface sweep found no additional substantial runtime or API defect. A focused native probe opened and remuxed WAVs for all six advertised PCM encodings with one, two and six channels; the 18 combinations retained their sample representation, channel count and sample byte counts. This is interoperability evidence for the installed backend, not a claim about every WAV reader. Collected speech's format naming was compared with the installed SDK's `DefaultGeneratedAudioFile`; parameterized MIME names follow that native convention and need no separate Casai normalization.

Three stale current-status statements were corrected: the plan no longer calls implemented helper signatures pending, its browser/native section reflects the tested production implementation and linked Cascada fix, and the test guide no longer excludes completed Translator examples from current execution. The actual matrix availability predicates already include Translator. Historical evidence remains intact, and coordinated Cascada publication and native platform/distribution checks remain release gates. Review-process guidance now requires reconciling these status statements at closure.

Worker-bundle freshness, changed-document links/anchors and whitespace checks pass. No production code changed after the recorded regression/type/mutation/native/matrix/coverage gates, so those results remain applicable.
