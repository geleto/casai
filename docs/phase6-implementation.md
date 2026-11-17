# Phase 6 implementation

The [2026-11-17 simplification review](phase6-simplification-review-2026-11-17.md) removes a redundant native output-stream layer, unifies encoded packet writing and replaces unused concurrent RPC machinery with the existing ordered operation contract. Public APIs and provider dispatch remain unchanged; the record tracks verification, rejected alternatives and necessary ownership complexity.

The current [Claude review follow-up](phase6-claude-review-2026-11-16.md) covers six contract/type fixes and a Node copy-yield scheduling improvement. The approved [shared-output follow-up](audio-processing-benchmark.md#shared-output-for-parallel-pcm-2026-11-17) removes the parallel PCM join when sharing is available, while all remaining assembly stays in workers. These records separate verification from deferred worker-pooling work and release readiness. The linked engine is now `0.7.0`, outside Casai's `^0.6.2` range; the earlier paired-package evidence below predates that mismatch. Coordinated publication, dependency updates and fresh package acceptance remain required.

The later [audio responsiveness follow-up](audio-processing-benchmark.md#worker-only-responsiveness-revision) records the numerical optimization and worker execution requirement. PCM/WAV helpers are asynchronous, streams use ordered workers, and native preparation owns a Node worker for its entire pipeline. Provider execution and component result contracts remain unchanged.

Implementation follows [the selected contract](streaming-modifiers-plan.md). Both modifier/audio delivery migration and native preparation are required. This record distinguishes implementation checks from provider, platform and release acceptance.

**Earlier follow-up review, 2026-11-16:** all eight findings are corrected and the subsequent complete pass found no important unresolved implementation issue. The [closure record](phase6-review-2026-11-16.md#corrections-and-closure-2026-11-16) maps each correction to maintained evidence. Raw frame validation, native I/O ownership, CommonJS bundles, effective call types and installed source consumers are fixed; missing native and paid acceptance cases now pass. Encoded copy/remux retains the accepted metadata-inspection boundary. That pass closed implementation acceptance on the recorded platform/routes; release readiness remains separate.

**Latest review closure, 2026-11-16:** all four additional findings are corrected: optional streaming metadata, uploaded-stream tool shorthand, inherited controls on resume, and the finite raw-byte chunk bound. The [closure record](phase6-followup-review-2026-11-16.md#corrections-and-closure) documents 137 focused tests including 18 native cases, 10 type and three runtime mutations, source/declaration and matrix checks, lint validation and the full 1,912-test coverage run. The subsequent complete review found no important unresolved implementation issue. The user kept explicit-primary file conversion; a native regression test and the guides now capture that rule. Recorded provider acceptance and separate release gates remain unchanged.

## Baseline

- Started from a clean working tree on 2026-11-15 with AI SDK 7.0.162 and TypeScript 7.0.2.
- Added compiler-cost workloads for the existing audio factories before changing their contracts. Compiler checks run sequentially.
- Public consumers include factory/configuration types, metadata inheritance and spreads, callable and named inputs, bound tools, native Agent methods, package declarations, guides and the generated matrix.

## Implemented contracts

Independent source/tool/stream metadata survives inheritance and spreads. Removed named selectors are rejected before normalization, including inherited/undefined declarations, while same-named application fields remain data. Transcriber, SpeechGenerator and Translator replace the three separate streaming factories with `.asStream`; stream/tool combinations are excluded throughout Config, factories and annotations.

Audio dispatch follows the request shape and collects one native execution for completed delivery. Transcriber retains the native final fields and its transcript tool snapshot. Speech retains generated-file views, actual stream format and usage, and uses native file-content tool output. Translator retains collected audio and authoritative native finals, with translated text as its default model-facing output. User formatters replace defaults. No generated-media schema processing, provider catalog, fallback request or second completion runtime was added.

Main-entry PCM/WAV helpers remain independent of native installation. `.loadsAudio` and `casai/node-av` share lazy native loading, explicit targets, best/selected audio tracks, native options and per-invocation ownership. Compatible audio is copied/remuxed; conversion uses the selected native encoder. Encoded output enforces byte and duration bounds, including codec padding. Uploaded bytes/streams cannot open child resources without a trusted protocol override. Configured loaded-tool sources remain private; ordinary Transcriber preserves native SDK URLs/downloads.

The native baseline is `node-av-lgpl@7.1.0`, installed under the optional `node-av` name. The main entry stays browser-safe. Source/packaged consumers check absent and broken peers, exported declarations and native-unavailable errors. Exact helper/target types are documented from production declarations; matrix examples now compile against production audio types.

## Verification

| Check | Evidence |
| --- | --- |
| Local runtime/coverage | 1,856 passing tests; 99.56% lines/statements, 100% functions, 95.85% branches. The result-augmentation gate remains 100% across its metrics. PCM/WAV and preparation validation are included. |
| Types/build/declarations | Full `test:types` passes, including source, compiled consumers, nested bound-tool declaration export and both optional-property modes. 103 README2 and 76 README snippets are checked; five later-phase examples remain explicitly excluded. |
| Matrix | 143 shapes and 784 property records; 1,571 reference/browser selections; 1,458 current examples executed with SDK mocks. Fifteen `.loadsAudio` examples also pass the separate installed-native stage with generated WAV input. |
| Native | Fifteen LGPL integration cases plus the real-export interface check pass. Added independent WebM/Opus, no-audio/unavailable-encoder/malformed media, changing-channel raw validation, native disposal, seek-dependent forward-only failure and authenticated redirects. Both Node module formats execute both entries with the real peer. |
| Ownership | Tests observe provider input before upload EOF, asynchronous native dispatch failure, abandoned handles, cancellation while decoding awaits another chunk, source cancellation and reader-lock release. Returning a live SDK result is not treated as completed consumption. |
| Mutations | Initial acceptance caught 100 shared runtime, 199 production type and 28 component-review mutations. The follow-up reran 25 affected type mutations, including three new audio cases, and all nine native security/lifetime/format/limit mutations. Controls pass. |
| Compiler cost/editor | All factory budgets pass, including six audio workloads; the measured recalibration and rejected optimization are recorded in [tests/README.md](../tests/README.md#phase-6-compiler-measurements-2026-11-15). TS7 editor checks pass for source/declarations in both optional-property modes. |
| Package/browser | A fresh paired tarball consumer compiles complete source/declaration programs in both optional modes without the native peer. ESM/CommonJS main/helper bundles execute with missing/broken peers; original missing-entry/transitive/asynchronous-init failures are preserved. Real Chromium checks Cascada composition, PCM utilities and native isolation. |
| Paid OpenAI | Four maintained cases have passing evidence using generated speech: `gpt-4o-mini-tts`, encoded `gpt-4o-mini-transcribe`, raw/streamed `gpt-transcribe`, and completed/incremental `gpt-realtime-translate` to French. The new incremental case verifies audio and recognizable translated content before reading final promises. |
| Receiving adapters | Maintained fake-fetch checks exercise Google 4.0.111 generateContent native audio parts, OpenAI 4.0.108 Chat text serialization, Anthropic 4.0.96 omission and Google Interactions omission. These are transport evidence, not proof of hearing. |
| Paid audio-tool reception | On 2026-11-16, `gemini-3.8-flash` through Google generateContent and `@ai-sdk/google@4.0.111` correctly identified the color and number in two different MP3 (`audio/mpeg`) SpeechGenerator tool results. Neither transcript was included in model messages. The maintained positive/changed-audio test passes. |
| Paid streaming speech | `eleven_flash_v2_5` through `@ai-sdk/elevenlabs@3.0.79`, using George, passes collected MP3 at 44.1 kHz and incremental PCM at 24 kHz. OpenAI transcription verifies collected speech. The new cancellation case aborts after receiving audio, verifies native failure settlement and releases unfinished text input. |

## Implementation review

The review traced exports, all source/delivery/tool forms, Config/inheritance/spreads, shorthand and named calls, parsed public input versus trusted resources, SDK descriptors/injected helpers, native completion/cancellation, optional imports, annotations, declaration consumers and matrix/guide examples. Corrections included portable nested helper declarations, a recursive prepared-input type dependency, redundant fixed-setting/stream-tool guards, stale mutation owners and cancellation assertions that could mask missing cleanup. Retired streaming-only mode lists were removed after tracing their consumers.

The native pass compared probe and codec behavior against the installed implementation. Native probe defaults now own byte-stream format inspection; Casai preserves lookahead and original read/abort failures. node-av 7.1 pads final fixed-size FLAC frames with silence and can emit an untimestamped resampler drain frame. A direct node-av control reproduced that missing timestamp. Casai preserves native timestamps, checks unchanged audio samples/silent padding, and bounds duration using packet durations as well as relative timestamps. No codec or timestamp repair was introduced.

The subsequent complete pass found no further substantial implementation or API issue. The final mutation pass added the missing open-tool-to-closed-tool substitution assertion and restored explicit undefined metadata in sticky-inheritance tests; production already enforced both contracts. Closing source/exact-optional, build, native-interface and lint checks pass after these test corrections and removal of the retired mode lists. Full lint plus focused reruns on corrected files passes. Local documentation links were audited, with retired README anchors updated. Provider-dependent acceptance remains separate from this implementation review.

## Linked Cascada changes

`C:\Projects\cascada` remains npm-linked. With the user's authorization, its existing browser environment/loader and browser test entry were promoted to a package browser export; the ESM build includes that entry. Browser event/path support now has a production owner, with test shims re-exporting it. Logical path resolution handles parent segments and absolute roots. No Casai compiler, engine replacement or browser polyfill package was added.

The upstream browser suite passes 1,239 tests with eight pre-existing pending cases. The review fixed event receivers, single-registration removal and recursive once-listeners in the upstream browser implementation; three public-Loader parity tests and focused lint pass. The packed Casai consumer also exercises the built Cascada candidate in Chromium. The published package still needs a coordinated release containing these changes; a local-link or paired-tarball pass does not establish that release compatibility.

## Outstanding release gates

- LGPL checks here use Windows x64. The supported-platform matrix and applicable native provenance/notice/source/relink distribution evidence remain beta/final-release gates, together with the coordinated Cascada package release.

Phase 6 implementation and functional acceptance pass on the recorded native platform and provider routes. All planned paid acceptance checks have passed. No undecided product/API choice is currently needed; the remaining release gates do not have passing evidence, so this is not a release-readiness claim.

## OpenAI and Claude follow-up (2026-11-15)

The installed OpenAI adapter 4.0.108 and the latest published 4.0.118 both expose speech through `doGenerate` with a binary response handler, without `doStream`. OpenAI itself supports streamed speech responses, but that does not exercise the SDK streaming-speech interface used by Phase 6. Realtime/Live sessions are separate interfaces. No dependency or runtime adapter was changed.

A paid OpenAI Responses control used `gpt-6-luna` and real `gpt-4o-mini-tts` audio through the existing SpeechGenerator tool projection. The API rejected its `input_file` tool output with HTTP 400 and unsupported MIME type `audio/mpeg`. Adding an explicit `recording.mp3` filename produced the same rejection. This rules out that native mapping for the tested route; it does not deny ordinary OpenAI audio-message support. OpenAI Chat still serializes tool content as JSON text. Claude's installed adapter has no speech operation and drops inline audio tool content. Google reception and ElevenLabs streaming acceptance therefore remain outstanding.

## Google audio-tool acceptance (2026-11-16)

The supplied Google credential is stored only in the Git-ignored local `.env`. The maintained receiving-model test now passes with `gemini-3.8-flash`, generateContent, `@ai-sdk/google@4.0.111` and MP3 (`audio/mpeg`) generated by `gpt-4o-mini-tts`. The model calls the actual SpeechGenerator tool and receives its default native file-content projection. It identifies purple/seven in the first recording and orange/eleven in the changed-audio control. Request assertions verify native inline audio and the absence of either transcript. This closes the real-provider audio-tool reception gate for this route and format; it makes no broader provider, video or encoding claim.

Initial attempts exceeded the old 90-second per-recording deadline. Request timing isolated the delay to Google generation, with individual responses taking about 46-59 seconds. The test now bounds generation to 256 output tokens with the lowest native reasoning effort and no retries, permits 150 seconds per recording, and finishes both controls within its 330-second test deadline. The successful run took 221 seconds. Type checking and focused lint pass. No Casai runtime or provider adapter change was needed; ElevenLabs streaming-speech acceptance remains outstanding.

## ElevenLabs streaming-speech acceptance (2026-11-16)

The supplied credential is stored only in the Git-ignored local `.env`. With Text to Speech permission alone, the maintained test passes native WebSocket speech using `eleven_flash_v2_5`, `@ai-sdk/elevenlabs@3.0.79` and George (`JBFqnCBsd6RMkjVDRZzb`). Completed SpeechGenerator collects MP3 at 44.1 kHz from one streaming execution; OpenAI transcription recognizes the spoken control. SpeechGenerator.asStream delivers PCM chunks with the requested actual 24 kHz format through completion. The successful run took about two seconds.

The SDK's default Rachel voice was rejected by this account's free-plan API restriction. The test now selects the [documented George voice](https://elevenlabs.io/docs/api-reference/text-to-speech/stream) explicitly and accepts `CASAI_ELEVENLABS_VOICE` for another account-accessible voice. Casai's native defaults and provider adapter remain unchanged. This closes the last credential-dependent Phase 6 acceptance gate; supported-platform and distribution/release evidence remain separate.
