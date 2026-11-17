# Phase 6 implementation review — 2026-11-16

All eight findings below are corrected; see [corrections and closure](#corrections-and-closure-2026-11-16). The subsequent complete review found no important unresolved implementation issue. The implementation retains modifier-only selection, stateless components, request-shaped SDK dispatch, family-owned result collection, one optional native preparation path and native tool formatting. The Cascada correction is in the linked upstream checkout; its coordinated release remains outstanding.

The initial review changed documentation and reproduced the failures; the findings and original verification below retain that history. The subsequent correction pass changed implementation, tests and records without staging files or changing the npm link. Encoded copy/remux retains the user-approved inspection boundary.

**1. P1 — Raw preparation can silently emit audio inconsistent with its declared format. Fix in Phase 6.**

In [native.ts](../src/audio/native.ts), lines 117–135, the decoder is requested to produce mono PCM16 at the selected rate, but each returned frame is interpreted as that format without checking its actual layout, representation or rate. The installed node-av decoder initializes its resampling decision from the first frame. If that frame already matches, a later channel change can bypass conversion.

A real HTTP playlist with independently generated 24 kHz FLAC segments, first mono and then stereo, completed successfully and reported mono PCM. The native decoder produced 25,344 mono samples followed by 25,344 stereo samples. Casai copied only `nbSamples * 2` bytes from each stereo frame, misinterpreting/truncating its interleaved audio. The same-format playlist was a successful control. Encoding the changing playlist to mono WAV instead correctly failed in the native encoder. This is a concrete violation of the plan's changing-source requirement, not a request to repair every native codec.

Check actual frame metadata before converting it to the public raw byte stream, including decoder-drain frames. Use native conversion when it maintains the target; otherwise fail before yielding incompatible samples. Share the small frame-to-bytes check between the packet and drain paths. Add the changing-source fixture and an assertion that incompatible samples never reach the consumer. No adaptive conversion framework is needed.

**2. P2 — Custom native I/O leaks when opening rejects before adopting the handle. Fix in Phase 6.**

[native.ts](../src/audio/native.ts), lines 102–109, clears the local `io` owner before calling `Demuxer.open`, with a comment claiming the demuxer owns it on every failure. The installed demuxer checks an explicit input format before adopting an `IOContext`. An unsupported or misspelled `mediaSettings.format` therefore leaves neither `input` nor `io` available to Casai's cleanup.

Instrumenting the real I/O context's asynchronous disposal showed one disposal for a valid WAV open/close and zero for `format: 'not_a_demuxer'`. The failing case did cancel and unlock the JavaScript reader, which explains why reader-only assertions miss the native leak. The probe explicitly disposed the captured handle afterward.

Retain ownership until native adoption/success, and cover failures before adoption without double-freeing an adopted context. Verify the installed handle's idempotence/ownership rules rather than relying on function entry as the handoff. Add native disposal assertions for pre-open rejection and the adjacent abort path; preserve the original error. Correct the misleading ownership comment.

**3. P2 — Native preparation fails in CommonJS bundles. Fix in Phase 6.**

[native.ts](../src/audio/native.ts), line 12, passes `import.meta.url` to `createRequire`. An esbuild Node CommonJS bundle lowers that value to undefined. Both the optional `prepareAudio` entry and main-entry `.loadsAudio` then reject with `TypeError: The argument 'filename' must be a file URL object, file URL string, or absolute path string. Received undefined`, even with the supported native peer installed.

The optional-entry ESM control prepared the same audio successfully. A full-main ESM control also passed with the ordinary `createRequire` banner needed by the SDK's CommonJS dependencies; the equivalent CommonJS control still failed at Casai's resolver. The SDK dependency's separate ESM bundling requirement is not a reason to add a Casai compatibility runtime.

Make the resolver's module location work in the supported ESM/CommonJS builds. Extend the existing package consumer fixture to build **and execute** both entries, with the native peer present and absent. Keep ordinary resolution and the isolated native entry. The current package fixture does not maintain the Node bundle matrix required by the plan, despite passing its declaration/browser checks.

**4. P2 — Call types do not correlate the effective request with its native settings. Fix in Phase 6.**

[SpeechGenerator.ts](../src/factories/SpeechGenerator.ts), lines 21–46, and [Transcriber.ts](../src/factories/Transcriber.ts), lines 23–66, select settings from construction facts. The shared [named-call type](../src/types/component.ts), line 68, and family call checks do not revalidate the full native alternative after call-time source/format changes.

These calls compile in source mode and emitted declarations, including exact optional property mode for declarations:

```typescript
const transcribe = Transcriber({ model, maxRetries: 2 });
transcribe(bytes, pcm);
transcribe.run({ audio: bytes, inputAudioFormat: pcm });

const speak = SpeechGenerator({ model: speechModel, maxRetries: 2 });
speak(['hello']);
speak.run({ text: ['hello'] });

Transcriber({ model })(new URL('https://example.test/audio.wav'), pcm);
```

The first two pairs select native streaming, where `maxRetries` is not supported and is ignored. The URL/format pair fails at runtime before dispatch despite being statically admitted. The plan explicitly requires both exclusions. This is a type-contract defect; native runtime delegation for JavaScript bypasses should remain intact.

Check the complete effective alternative after inherited settings and defined invocation overrides are resolved. Cover shorthand, `.run()`, source preparers, inherited fragments and valid neighboring cases. Do not introduce a runtime native-setting allowlist or silently remove configured options to admit a call.

**5. P2 — A zero-argument overload bypasses raw-format requiredness. Fix in Phase 6.**

[component.ts](../src/types/component.ts), line 95, adds an unconditional no-argument signature whenever the argument tuple permits omission. That signature does not apply `CallChecks`.

```typescript
const raw = Transcriber({ model, audio: new ReadableStream<Uint8Array>() });
raw(); // Compiles; runtime rejects because inputAudioFormat is missing.

const prepared = Transcriber.withFunction({ model, audio: () => rawAudio });
prepared(); // Same problem.
```

The named no-argument call already rejects statically. Supplying the missing format later is valid, so rejecting these components at construction would remove useful composition. Apply the family check to the zero-argument overload or encode its required tail correctly. Include configured and prepared streams, plus format-supplied positives, in source/emitted consumer tests.

**6. P2 — The exported source condition fails full compilation with exact optional properties. Fix in Phase 6.**

A consumer containing only imports from `casai` and `casai/node-av`, with `customConditions: ['casai-source']` and `exactOptionalPropertyTypes: true`, produces eight source errors. New examples include [SpeechGenerator.ts](../src/factories/SpeechGenerator.ts), line 67, explicitly returning a possibly undefined optional `audioFormat`, and [Translator.ts](../src/factories/Translator.ts), line 76, passing explicitly undefined optional preparation settings. Additional failures occur in older imported implementation code. The same consumer passes with exact optional properties disabled; normal emitted declarations pass in both modes.

The editor fixture requests diagnostics for its consumer document, not the complete imported program. The [package fixture](../tests/fixtures/phase2-package-consumer.cjs), lines 238–241, compiles ordinary declarations without the source condition. Neither check establishes the claimed complete source/optional-mode combination.

Align source object construction and optional declarations with their actual omission semantics, including the existing imported errors that block the exported entry. Add a whole-program installed source consumer under both optional modes, with the native peer absent. Do not weaken the consumer's compiler settings or add ambient native shims.

**7. P2 — Required acceptance coverage is incomplete. Fix in Phase 6.**

Beyond the regressions above, the maintained suites do not cover all selected acceptance cases:

- [NativeAudio.integration.test.ts](../tests/NativeAudio.integration.test.ts) covers WAV/FLAC, a video container with PCM tracks, MOV seeking and AAC in an HTTP playlist. It lacks the planned WebM/Opus case, a seek-dependent source paired with its forward-only failure, and representative no-audio/unavailable-required-codec failures. Its codec fixtures partly use Casai itself for preparation, so independent native-generated controls are also useful when checking the adaptation.
- [Phase6Audio.live.test.ts](../tests/Phase6Audio.live.test.ts), lines 41–47, covers completed translation only. The selected paid matrix requires incremental translation too. The maintained paid suites also lack a provider cancellation assertion where supported; timeout signals alone do not test successful cancellation behavior.
- Whole-program source-condition and executed Node bundle coverage are missing as described in findings 3 and 6. High local coverage excludes `src/audio/native.ts` and cannot replace these integration cases.

Add small generated integration fixtures and the missing bounded provider cases. Map the plan's remaining acceptance rows to maintained tests and recorded outcomes before renewing the completion claim. Reuse the already successful provider routes and controls; do not build an exhaustive FFmpeg/provider certification matrix or rerun unrelated paid calls merely to increase counts.

**8. P2 — Cascada's promoted browser event implementation changes listener semantics. Fix upstream during Phase 6.**

In `C:\Projects\cascada\src\browser\events.js`, lines 14/26 call listeners without the emitter receiver; line 36 removes every registration of a callback. Node's implementation calls listeners with the emitter as `this` and removes one matching registration per `removeListener` call. This test shim became a production dependency of the new browser entry.

A bundle exercising the public `Loader` found `this === loader` true on Node and false in the browser build. Registering the same listener twice and removing it once left one callback on Node and none in the browser build. These are ordinary application event patterns, independent of Casai's audio code.

Preserve those existing listener semantics in Cascada and add a small public-Loader parity test, including `once`. Do not compensate in Casai. This does not call for implementing every unused Node EventEmitter feature. The browser release should include this correction alongside the already required upstream packaging changes.

**Accepted contract clarification**

The changing playlist also demonstrated that copied FLAC can retain later stereo frames while returned inspection metadata reports mono. Native stream metadata remained mono while those packets were copied, so a metadata-only packet check would not certify their contents. The user explicitly selected retaining native copying and documenting this limit rather than adding a second decode pass. Encoded-file compatibility/format metadata therefore reflects inspection, not certification of every packet; byte/duration bounds remain. Strict validation of converted raw frames remains required by finding 1. The plan, guides, matrix, agent instructions and public type comment now state this boundary. No product/API question remains open from this review.

**Assessment across the requested dimensions**

| Dimension | Assessment |
| --- | --- |
| Completeness | Main A/B surfaces are present. Required format, ownership, package/type interactions and acceptance cases remain open as listed above. |
| Architecture | Keep the current separation: SDK executes models, Cascada executes the language, native preparation owns its resources, and each audio family adapts its own results. No provider catalog, second execution runtime, automatic media-schema injection or stateful component store was introduced. |
| Transitional scaffolding | Retired streaming factories and source-mode module are removed from source and the current package. Historical review records and future-phase documentation are intentional. No additional compatibility adapter was found that warrants removal now. |
| Correctness | Findings 1–6 and 8 contain concrete failing controls, not inferred failures from missing tests. |
| Efficiency | Native copy/remux and lazy raw processing are appropriate. Copying frame bytes before native disposal is necessary. Completed SDK file input/result collection requires finite buffering. No justified result cache or further execution parallelism was identified. |
| Simplification | Keep family-local collectors and explicit ownership. A small shared raw-frame check can remove the packet/drain duplication when fixing finding 1. Broader lifecycle or format-adapter abstractions would increase complexity. |
| Naming/readability | The public modifier/settings grouping is coherent. The I/O ownership comment in finding 2 states an incorrect native guarantee and needs correction. No rename-only blocking issue was found. |
| Test coverage | Existing suites are extensive but miss meaningful interactions and package execution. Findings include the required regression evidence; finding 7 records remaining acceptance omissions. |
| Other risks/debt | A coordinated Cascada release and native supported-platform/provenance/distribution checks remain release gates. These are already tracked separately and must not be presented as passed. |

**Verification performed for this review**

| Check | Result |
| --- | --- |
| `npm run test:coverage` | Passed: 1,856 tests; 99.56% lines/statements, 95.85% branches, 100% functions. Native implementation is outside this coverage gate. |
| `npm run test:native` | Passed: real-export interface check and 11 native cases on Windows x64, node-av-lgpl 7.1.0. |
| `npm run test:types` | Passed: configured source/build/declaration/consumer checks and guide snippets. The additional source-condition/exact-optional probe fails as documented. |
| `npm run test:matrix` | Passed before and after the contract clarification: 143 shapes, 784 properties, 1,571 reference/browser selections and 1,458 SDK-mock executions. |
| `npm run test:package -- --engine C:\Projects\cascada` | Passed: isolated paired package consumer and actual Chromium execution. |
| `npm run test:package` | Failed against published Cascada 0.6.2 at loader consumer types. This confirms the existing coordinated-release dependency; it is not a newly invented Casai runtime requirement. |
| Focused review probes | Reproduced changing-source raw corruption, pre-open native I/O leakage, eight wrongly admitted call examples, exact-optional source errors, CommonJS native loading failure and browser listener differences. Each has an adjacent successful control. |
| Paid APIs | Not rerun for this review. Prior recorded OpenAI, Google audio-tool reception and ElevenLabs speech results remain evidence for their tested routes; they do not cover the omitted cases in finding 7. |
| Review/documentation edits | Matrix regenerated; affected source/matrix modules pass lint; review links resolve and `git diff --check` passes. The Cascada npm link and existing index were preserved. |

Reproduction sources and logs are under the ignored `.cache/phase6-review-2026-11-16/` directory. Key artifacts are `changing-playlist.mjs`, `native-ownership.mjs`, `call-types.ts`, `source-consumer.ts`, `node-bundles-configured.json` and the `cascada-events-*` bundles. Broader suite logs are `.cache/phase6-review-*.log`. Native stderr warnings are recorded separately from successful control results; PowerShell's stderr formatting is not treated as proof of test failure.

**Timing and closure**

Fix findings 1–7 within Phase 6 and finding 8 in the coordinated Cascada candidate before accepting Phase 6's browser integration. Then rerun affected checks and complete a subsequent whole-surface review. The native platform/distribution work and published-Cascada compatibility remain beta/final-release gates; they should not be silently moved to VoiceAgentClient, VideoGenerator or Cascada streaming phases. No newly identified implementation defect is recommended for postponement to those later phases.

## Corrections and closure (2026-11-16)

| Finding | Completed correction and maintained evidence |
| --- | --- |
| 1. Raw frame format | Check actual rate, sample representation and mono layout before emitting each frame. Decoder packet ownership and EOF draining now use node-av's iterable directly, removing duplicate draining code and the redundant file-frame helper. An independent mono/stereo HLS fixture proves failure before incompatible samples escape; the unchanged-layout control succeeds. |
| 2. Native I/O ownership | Retain custom I/O until opening succeeds. Real native disposal is observed for success, invalid format before adoption and adjacent abort; cleanup remains idempotent. Reader cancellation alone cannot satisfy the assertion. |
| 3. Node bundles | Resolve from `__filename` in CommonJS and `import.meta.url` in ESM. The same bundle fixture executes main and optional entries against the real native peer, and against absent/broken installations in the isolated package consumer. No bundle externalization or compatibility runtime was added. |
| 4. Effective native calls | Validate resolved inherited and invocation settings against the selected native operation. Reject retries/downloads in raw transcription and retries in streamed speech, including preparers and named overrides. Preserve valid named format replacements and union correlations. Opaque Cascada return values remain runtime-validated; known settings still select and constrain the native operation. |
| 5. No-argument calls | Apply family checks to the zero-argument overload. Configured/prepared raw streams require a format; supplying one later remains valid. |
| 6. Exact optional/source consumers | Align optional declarations and omitted native fields with runtime semantics, including imported ImageGenerator, VoiceAgentBackend and shared execution types. Explicit JSON-schema callback types also support the less specific metadata in fresh permitted SDK dependencies. Both installed source/declaration entries compile with exact optional properties enabled and disabled, without the native peer or ambient shims. |
| 7. Acceptance | Add independent WebM/Opus, no-audio, unavailable encoder and malformed-media cases; pair seek-dependent file/bytes success with forward-only failure; cover same-origin authenticated redirect/HLS requests. Add incremental OpenAI translation and real ElevenLabs cancellation with unfinished-input cleanup. Package cases distinguish missing entry, transitive dependency and asynchronous initialization failures from top-level absence. |
| 8. Cascada browser events | Preserve listener receiver/arguments, remove one matching registration, and make once-listeners safe under recursive emission. Named empty-string events are removed independently. Public Loader parity tests pass on Node and in the upstream browser suite. |

The final pass revisited exports and removed modules, all Config/source/delivery/tool forms, shorthand and named calls, parsed versus trusted input, inherited/copied metadata, SDK result consumers and formatters, PCM/WAV helpers, native preparation and ownership, optional loading, source/declaration/bundle consumers, and guides/matrix. It compared the native decoder/opening contracts and followed the SDK's streaming cancellation. No second execution runtime, codec repair, capability catalog or deferred generated-media schema machinery was introduced. No further substantial issue or unresolved product decision remains.

Verification after correction:

- Local coverage: **1,856 tests**, 99.56% lines/statements, 100% functions and 95.85% branches; thresholds pass.
- Native: **15 integration cases**, the real-export interface check, and all four present-peer Node bundles pass on Windows x64 with node-av-lgpl 7.1.0. **Nine native mutations** are caught, including both new correctness/ownership regressions.
- Types: full `test:types`, source/emitted consumers and both optional modes pass. **25 affected type mutations** pass, including three new audio cases; those three were rerun after the final speech-preparer adjustment. Compiler measurements and the two justified transcription marginal-budget changes are recorded in [tests/README.md](../tests/README.md#review-corrections-2026-11-16).
- Package: isolated paired tarballs pass with fresh AI SDK 7.0.173, provider-utils 5.0.81 and Zod 4.6.7. Both source/declaration modes, absent/broken ESM/CommonJS bundles, original native-load failures and actual Chromium composition pass. The published Cascada release limitation remains unchanged.
- Matrix: 143 shapes, 784 properties, 1,571 reference/browser selections, 1,458 SDK-mock executions and the separate **15 native examples** pass. Guides remain compiled by `test:types`.
- Paid additions: incremental `gpt-realtime-translate` returns recognizable French text and audio; ElevenLabs `eleven_flash_v2_5`/George returns audio, then aborts and releases its unfinished text input. Both pass. Earlier unrelated Google hearing/changed-audio and completed-provider acceptance is retained.
- Cascada: three focused public-Loader tests and lint pass; its browser suite passes **1,239 tests**, with eight pre-existing pending cases.
- Lint is clean after correcting the reported assertions and checking the final changed files. Review links resolve and `git diff --check` passes.

Runtime/type cleanup and acceptance corrections belong to this phase and are finished. Only the already tracked coordinated Cascada release and supported-platform/native provenance/distribution release gates remain; none is represented as passed. Evidence is in the maintained suites and ignored `.cache/phase6-fix-*.log` files. No files were staged or committed.
