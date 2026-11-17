# Phase 6 Claude review follow-up (2026-11-16)

This pass reconciles the nine findings in the supplied Claude review against the selected contract, installed SDK and current implementation. The user selected operation selectors in broad audio annotations. On 2026-11-17 the user also approved [shared output for parallel PCM](audio-processing-benchmark.md#shared-output-for-parallel-pcm-2026-11-17), now implemented without changing the worker-only policy for SDK result assembly.

## Disposition

| Finding | Correction or disposition | Timing |
| --- | --- | --- |
| 1. Cleared preparation settings invalidate calls | Ignore native settings whose type is only `undefined`. Preserve that rule through Config and native-alternative checks without admitting unknown property names. | Fixed now |
| 2. Omitted source is confused with language, voice or mask | Remove omitted-source overloads when the leading tail value also identifies a source. Keep explicit placeholders, named calls, object context and unambiguous tails. A leading string still replaces a string source; types cannot infer whether an arbitrary string was intended as a language or path. | Fixed now |
| 3. Raw Transcriber tool admits parsed string/URL audio | Select the tool's parsed audio type from `inputAudioFormat`. File tools retain SDK encoded input; raw tools require bytes or a byte stream, including schema transforms that produce them. | Fixed now |
| 4. Streaming speech error implies format is mandatory | Say that a supplied format must be an object. Retain omitted-format success and correct the plan's runtime-delegation claim. | Fixed now |
| 5. Broad completed audio annotations are uncallable | Require the operation selector on each applicable annotation alternative: raw input format, prepared file target, or collected speech's object output format. Preserve union correlation and portable inferred declarations. Inferred factory calls retain call-time selection. | Fixed now, user-selected contract |
| 6. Completed assembly incurs copying and queue delay | Replace Node's timer-based copy yields with `setImmediate`, retaining bounded copies and the browser timer fallback. Parallel PCM now writes directly to final shared output when available, removing its join. SDK-produced chunks retain worker assembly/base64 and its failure behavior; their copy and queue costs remain under the selected worker-only policy. | Scheduling and shared-output fixes implemented; further queue optimization is separate performance work |
| 7. Each native preparation owns a new worker | This matches the selected lifetime and graceful-shutdown contract. Pooling introduces concurrent-job routing and different resource ownership. Revisit with sustained multi-request workloads if startup or memory is a demonstrated application bottleneck. | Defer performance work; no phase/API change |
| 8. Linked Cascada is outside the declared dependency range | The linked checkout is `0.7.0`, while Casai and the registry currently use `0.6.2`. Publish the coordinated engine version, update Casai's range/lockfile, then rerun installed package acceptance. Earlier paired-package passes do not establish the current candidate's readiness. | Release prerequisite |
| 9. Function-mode annotations have `never` context | Public specialized annotations use `unknown` when the context shape is erased; factory inference retains its provisional callback context. Infer preparer results against the native input family, then validate the finished operation. Verify exported wrapper declarations for every specialized family. | Fixed now, including other specialized families |

The small repeated delivery guards and native preparation blocks do not justify another abstraction: they validate distinct factory boundaries and assemble different SDK requests. No public source guard, worker setting, inline fallback, adapter or dependency was added.

The compiler-cost gate also exposed overruns in hook and audio workloads. Simplifications retain the existing thresholds: reuse the SDK's exported step-result type, select configured output in one projection, compare optional callback values directly, and avoid rebuilding callbacks immediately before omitting/replacing them in named-call settings. Tool properties use one optional mapped projection, including explicit clearing. Preparer inference no longer selects an operation from a configuration still being inferred; the finished source check owns that validation. Definite streaming speech/transcription already have one native operation enforced by construction, source arguments and named settings, so they need no duplicate whole-request check. Conditional/completed delivery retains the check for operation selection at invocation. Negative source/format/file-option regressions preserve these boundaries. These changes add no runtime behavior.

## Collection and shared memory

The subsequent [input-preparation correction](audio-processing-benchmark.md#bounded-input-preparation-and-shared-reuse-2026-11-17) adds one task-yield budget across chunks/partitions, moves large staging allocations into existing workers and reuses read-only shared input. It preserves worker assembly, the finite queue and invocation-owned native execution.

Streaming keeps chunks separate. Workers can also process separate buffers; shared memory is not necessary merely to divide the work. Completed Translator returns a `Uint8Array`; completed speech preserves the SDK generated-file interface, including `uint8Array`. Those contracts need one logical byte range at completion, not physically contiguous RAM. Finite parallel resampling now writes directly into shared output when available; otherwise its owned partitions are joined in a worker. SDK-generated audio chunks are borrowed, so Casai copies before transfer rather than detaching SDK/application data.

The scheduling probe measured 40 zero-delay timer yields at about 620 ms on this Windows machine, versus about 1 ms for 40 immediate yields. With the immediate-yield policy, three warm 24 MB joins took 28–39 ms through the worker. Responsiveness is required regardless of throughput: main-thread joining is not an implementation candidate. A tiny join can still wait behind finite resampling; changing the yield primitive does not remove that queue.

A growable `SharedArrayBuffer` can handle unknown output length up to its selected maximum. Finite PCM output length is already known, so the implementation uses an exact-size buffer and disjoint worker ranges, then awaits every completion. Existing SDK chunks still need copying into completed storage. Shared memory requires browser cross-origin isolation; the existing worker-join path remains available elsewhere. No main-thread join or public chunk-result envelope was added. See the [shared-output implementation and measurements](audio-processing-benchmark.md#shared-output-for-parallel-pcm-2026-11-17).

## Verification

Maintained regressions cover cleared settings through Config, ambiguous shorthand and explicit alternatives, parsed raw tool inputs, supplied/omitted stream formats, calls through broad annotations, and declaration export/consumption. The new compile-only file exercises all eight specialized function-mode annotation wrappers.

Coverage exposed timing defects in the test harness: a single test grouped 320 stream lifecycles, and an idle-worker exit deadline included package startup. The same stream inputs and assertions now run as separate ratio cases, reusing each finite expected result across chunk sizes. The unchanged four-second exit deadline begins at the fixture's completion marker. Mutations removing active/idle worker references both fail, with an unchanged control passing. No production lifetime policy, numerical assertion or coverage threshold changed. The PCM mutation runner accepts a focused name filter; its default still checks every case and mutation, with the two complete control files run separately.

Verification on 2026-11-17:

- Full source/build/emitted-consumer type checks, declaration export/consumption in both optional-property modes, and all compiler-cost workloads passed without raising budgets.
- All 25 selected audio/callback type mutations were caught; unchanged controls and aggregate/registry budgets passed.
- The matrix reference was regenerated and verified: 143 shapes, 785 distinct property records, 1,571 selections and 1,458 executable SDK-mock examples. Planned/native-only examples retain their separate evidence boundaries.
- The full local suite passed 1,918 tests under coverage: 99.58% lines/statements, 96.35% branches and 100% functions. The separate augmentation coverage gate passed. Source and emitted-consumer types were rechecked after the test-harness corrections.
- All 18 LGPL native integration tests, the installed node-av structural-interface check and Node ESM/CommonJS main/helper bundles passed. Chromium verified the browser entry, Cascada composition, numerical results, CSP/unavailable-worker rejection and automatic cleanup.
- Worker bundle freshness and whitespace checks passed. Full lint passed on the settled candidate (191.9 seconds). Its four initial style findings were corrected; focused lint, affected compiler budgets, the full type gate and matrix-reference freshness were rechecked before the successful whole-repository run.

Paid-provider payloads and native dispatch are unchanged by this pass; previous route acceptance is separate from the current package release blocker. A subsequent complete source/contract pass found no additional substantial defect. The later shared-output implementation and its verification are recorded in the benchmark follow-up linked above; SDK result assembly remains in workers.

## Shared-buffer consumers and annotations (2026-11-17)

The next Claude review found two audio issues, an older LLMAgent annotation failure and stale cutoff wording. The user retained shared resampling output, selected an explicit worker copy for ordinary-buffer consumers, and requested the general annotation redesign in this pass. These fixes do not change the finite worker budget, introduce inline joining or add a conversion backend.

| Finding | Current disposition |
| --- | --- |
| Shared resampling bytes can become text in Node fetch/Response; other binary APIs reject them | Keep shared output and export the existing async `concatAudio` from `casai`. `await concatAudio([pcm])` returns ordinary bytes in a worker, preserving the source. Always-owned PCM/WAV helper return types name ArrayBuffer explicitly. Resampling and readWav views retain their potentially shared types. No automatic final copy or unsafe cast is added. |
| Uploaded streams could be reused before the SDK identity check | Native preparation now uses the existing `claimLiveInput` registry before it can read the source, after configuration, native readiness and cancellation checks. Repeated `.loadsAudio`, standalone-helper and SDK handoffs reject with ValidationError. A pre-handoff failure does not claim the stream; a failed attempt after handoff does. |
| Bare LLMAgent annotations failed construction or reached the compiler depth limit | Correct string-indexed tool-context name checking and ordinary ComponentConfig source/tool metadata. General `LLMAgentConfig` now describes default text settings; selected sources use the existing ComponentConfig parameter and matching factory modifier. Loaded annotations require a loader, while Config fragments remain incomplete. Optional prompts remain call-required unless their presence is preserved. No additional generic parameter or permissive factory overload is introduced. |
| LLMAgent types admitted inherited native-audio preparation although runtime rejected it | Check source admission against the existing text-family modifier table. Explicit replacement with a supported source remains valid. |
| AGENTS still called the twenty-step default unimplemented | Correct the current guidance to the implemented `isStepCount(20)` default before prepareCall, retaining complete hook replacement semantics. |

Implementation verification before the documentation handoff:

- Source/build/emitted and exact-optional type checks passed. Physical package consumers exported and consumed the general and source-specific wrappers in both optional-property modes. All LLMAgent compiler-cost workloads stayed within their existing budgets.
- Five focused type mutations and the explicit shared-output-copy mutation were caught. The unchanged controls passed.
- All 22 LGPL native integration cases and 12 native mutations passed, including detected/explicit-raw uploads, repeated helper/component handoffs and pre-aborted input reuse.
- Node ESM/CommonJS main/helper bundles and Chromium source/emitted consumers passed. The byte-copy checks exercise actual HTTP payloads, Response, Blob, WebCrypto and transfer semantics, preserving zero-copy resampling separately from explicit conversion. A browser test-server upload/response stall was corrected in the fixture without changing Casai or increasing timeouts.
- The modifier suite passed 33 cases; affected-file lint and whitespace checks passed. The initial full local run recorded 1,917 passes and five failures because two examples had moved out of README. Coverage remained at 99.58% lines/statements, 100% functions and 96.31% branches; the separate augmentation gate passed.

Documentation was initially postponed at the user's request while the guide migration was in progress. The resumed documentation work uses `docs/matrix/documentation.md` and the catalogued articles as their authored homes, preserves the short README/retired README2 arrangement, and redirects the runtime example readers without removing assertions. The guide adds checked binary-upload and annotation examples; matrix notes, the current plan, AGENTS and review practice describe the same contracts. The documentation verification below records the settled checks separately from the earlier failed run.

### Documentation verification

The settled documentation and example readers passed on 2026-11-17:

- The extractor checked 108 chapter/article examples, 10 retained consumer regressions and the shared README workflow. Five planned examples remain explicitly excluded. Source/build/emitted and exact-optional type checks passed.
- All eight check-workflow and authored-workflow cases passed. The 19 focused documentation/runtime cases passed, resolving all five failures caused by the earlier example moves without removing their assertions.
- Matrix generation and verification checked 143 shapes, 785 property records and 1,571 selections, including browser exports and 324 simplified examples. All 1,458 current SDK-mock examples and 15 optional-native examples executed successfully. The 98 planned selections retain syntax/data coverage only. The prepared Transcriber tool export was also inspected directly.
- Full lint passed in 381.8 seconds. The full local suite passed all 1,923 cases; coverage reached 99.58% lines/statements, 100% functions and 96.31% branches. The separate result-augmentation coverage gate passed.
- Active plan links now target the canonical chapters, with their destination anchors checked. Whitespace checks passed. Documentation changes remain unstaged; no publishing or staging action was performed.

No documentation work from this handoff remains postponed. These checks establish the updated documentation and consumer regressions; they do not claim a new whole-implementation architectural review or release acceptance.

Native-worker pooling and coordinated Cascada publication/dependency updates remain previously identified follow-up work. Native platform/distribution gates also remain separate; no new paid-provider acceptance is claimed by these consumer and documentation corrections.
