# Streaming modifier plan review

Date: 2026-11-08. Scope: the proposed public factory/type migration, its implementation sequence and verification. The production migration has not started.

The subsequent [recorded-audio follow-up](#recorded-audio-follow-up) expands the selected scope and supersedes this review's earlier streaming-only Translator assumption. The [2026-11-09 node-av follow-up](#optional-node-av-follow-up) supersedes the earlier FFmpeg executable integration. The [first reconciliation](#external-review-reconciliation-2026-11-09) corrects raw-input admission, error policy and resource ownership. The [second reconciliation](#second-external-review-reconciliation-2026-11-09) settles plain completed bytes/main-entry helpers and absent-peer compilation. The [third reconciliation](#third-external-review-reconciliation-2026-11-09) adds integer stream downsampling and supersedes the converter path/routing with confirmed native preference and supported fallback. Earlier type/factory findings remain applicable; older conversion decisions below are historical where superseded.

The direction is sound: retain the native audio execution functions and move selection into factory construction. The plan needed stronger type-boundary requirements and a smaller, more reproducible migration workflow. The corrections below are now in [the plan](streaming-modifiers-plan.md); the public annotation/union prototype remains an explicit implementation gate.

## Findings and corrections

### 1. High: the streaming flag must discriminate the native config shapes

Selecting a result type from `streaming` is insufficient. A type such as `(CompleteSettings | LiveSettings) & { streaming?: true }` accepts complete-only fields with streaming enabled. The focused compiler probe accepts `{ streaming: true, outputFormat: 'mp3' }` under that loose shape and rejects it when the operation shapes carry their own discriminants.

The plan now requires paired mode/settings branches at factory admission, standalone Config and merged Config boundaries. Fragments remain incomplete: a live-only format can be completed by `.asStream`, but an explicitly supplied flag cannot match the wrong native branch. Native value validation still belongs to the SDK; this finding does not justify a runtime native-option allowlist.

### 2. High: internal operation selection cannot replace the public family inventory

Today `ComponentKind` is `keyof Definitions`; `AnyConfig` indexes `ConfigShapes` with those same keys. Simply retaining/renaming the separate operation entries would expose implementation keys in public type helpers, while removing them from that index could lose streaming fragment shapes. Callback/preparer inference also uses the selected kind before the factory return type is computed.

The plan now separates public family names from internal audio operation keys and explicitly traces Config shapes, source discovery, callbacks, requirements and tool projections. The change stays limited to the audio families; splitting every SDK operation into another public or internal component is unnecessary.

### 3. Medium: streaming config annotations and callable-union narrowing were unspecified

`ComponentConfig` currently accepts family/source parameters, not an actual config value from which it can resolve streaming. The plan did not provide an annotation contract for the replacement streaming names. Also, a check of the nested `component.config.streaming` property does not, in the tested TypeScript 7.0.2 callable union, narrow the enclosing function enough to call its streaming signature.

The first implementation deliverable is now a bounded Transcriber prototype covering annotated complete/live configs, Translator annotations, inherited inference and exported declarations. The recorded-audio follow-up requires both Translator result modes. The prototype must record exact public syntax and real usable narrowing/calls before changing the shared factory. Existing valid LLMAgent/source-mode unions remain supported. No new public discriminator, branded parent, blanket union rejection or type-guard API has been selected.

### 4. Medium: LLMAgent's native methods need explicit preservation

LLMAgent implements the native Agent interface. Both `.generate()` and `.stream()` remain available on a non-tool agent regardless of its ordinary-call default. Its configuration therefore differs semantically from an audio wrapper selecting one native operation at construction. Treating the audio registry scheme as a universal model could accidentally remove methods or over-restrict shared settings.

The plan now explicitly retains those methods, `resume()` and Agent/UI-helper compatibility, with focused regression cases. Moving the raw streaming-flag check into common validation also permits deleting LLMAgent's duplicate value check while retaining its generation-only tool diagnostic.

### 5. Medium: configuration metadata must remain separate from application data

Adding `streaming` to shared native settings would risk exposing it through `.run()` settings or tool schemas. Conversely, a broad ban on that name would reject valid application data inside context or declared prepared-tool input.

The plan now places the flag in the configuration projection, strips it before dispatch and rejects top-level invocation overrides, including explicit undefined. Same-named application data stays separate and cannot select the operation. This reuses the existing provenance boundary rather than adding another validator or namespace.

### 6. Medium: verification depended on ignored, obsolete tooling

The local matrix extraction and smoke scripts expect the removed `manifest.examples` layout and are not present in a fresh checkout. Treating an adapted `.cache` script as the lasting migration gate would leave the example matrix unverifiable by repository checks.

The plan now requires maintained extraction/mocked cases, reusing existing guide fixtures where practical. It also includes description anchors in the file/index migration and names the actual unit-test files. Old authoring generators must not overwrite edited examples. No new example-generation framework or UI work is needed.

## Simplifications retained

- Keep one construction-time audio operation selection and the existing native creators, input ownership guard and transcript projection.
- Reuse sticky mode merging and common invocation assembly. The recorded-audio follow-up adds a local finite-result collector, not a general execution, replay or stream-failure runtime.
- Keep Translator as the existing speech-to-speech operation behind its callable `.asStream` factory. Ordinary text translation uses a non-streaming LLMAgent with translation instructions.
- Keep the existing SDK runtime validation policy and structural config compatibility. The earlier origin-based restrictions and native allowlists were not approved decisions.
- Link the prior configuration audit instead of repeating its tables and conversational corrections in the implementation steps.

## Evidence and final pass

Reviewed the shared factory's construction/type ordering, all three audio stream creators and their complete counterparts, Config/merge/type-map consumers, native Agent methods, runtime setting stripping, public exports, package layout and matrix verification path. The existing [configuration-mixing audit](configuration-mixing-review.md) remains evidence for the current API, not proof of the future operation selector.

The installed SDK sources inspected were `ToolLoopAgent`/`Agent`, speech generation/streaming, transcription/streaming and streaming translation. Native tool execution and transcript result collection are preserved, so this review does not introduce a new tool protocol or claim a fresh audit of unchanged SDK tool execution.

The focused compiler probe in `.cache/streaming-plan-review/contract-probe.ts` passed. It demonstrates the loose/discriminated config contrast, nested callable-union narrowing limitation, both LLMAgent native methods and a valid ordinary text-translation example. It used about 225 MB and took under one second of compiler time. No provider call was made.

A subsequent pass over the corrected plan checked the target paths, merge/validation order, public/internal type consumers, tool modes, package removal, example migration and acceptance gates. No further plan contradiction was found in that pass. The concrete annotation/union representation remains pending the explicitly required prototype; this is not a claim that implementation or its full acceptance gate is complete.

## Recorded-audio follow-up

The user identified the omitted prerecorded-audio use case. The earlier recommendation followed the SDK's function inventory too literally: absence of a native complete-result translation function does not remove the need for a completed-result convenience. The plan now includes both ordinary Translator and `.asStream`, with one native execution and local finite-result adaptation. A non-callable namespace is no longer needed.

Verified facts from the installed SDK/provider source:

- `experimental_streamTranslate` accepts a finite raw-audio stream; it is not microphone-only. The OpenAI adapter reads until input ends and sends `session.close` to finish the translation session.
- The installed OpenAI adapter requires 24 kHz 16-bit PCM input. It outputs that PCM format and warns that `outputAudioFormat` overrides are unsupported. File containers require explicit preparation; requested output format is not evidence of actual output format.
- Native `fullStream` must be obtained before any result promise claims the stream. It preserves audio parts and error events; native final promises provide source/translated text and metadata. The generic result does not expose an authoritative audio-file format.
- The existing OpenAI transcription adapter uses `/audio/transcriptions`; it does not supply a separate prerecorded speech-to-speech translation operation.

The native-only mock probe `.cache/streaming-plan-review/recorded-translation.mjs` passed: one SDK call consumed a finite recording, two native audio parts retained their bytes/base64 representation, and final text/duration came from the same execution. This proves the finite-input/collection path, not real-provider audio compatibility, a decoder, final file encoding or a complete public adapter.

The plan therefore adds explicit input-format, completed-result and error/ownership prototype gates. It does not silently introduce a multi-model transcription/translation/synthesis pipeline, arbitrary codec support, or collection into the streaming variant.

## PCM utility follow-up

On 2026-11-08 the user selected public SDK PCM utility reuse and optional FFmpeg, with raw PCM as the preparation utility's only input format when the converter is absent. The executable-specific proposal was superseded by the [node-av follow-up](#optional-node-av-follow-up). The preserved requirements are conversion-only dependency loading, clear missing-dependency errors, examples and present/absent checks, without removing provider-native encoded-file support from complete transcription.

Inspected `ai@7.0.162` public exports in `src/realtime/index.ts` and implementations in `src/realtime/audio-utils.ts`. Encoding/decoding operates on PCM16/base64 and Float32 samples; it does not decode containers. The public resampler handles one finite buffer and returns the input unchanged at equal rates. Its per-call rounding/interpolation is unsuitable for independently resampling arbitrary stream chunks.

The native probe `.cache/streaming-plan-review/pcm-utilities.mjs` passed: equal-rate identity, PCM round-trip within one quantization step, and 44.1-to-24 kHz conversion of 1,024,000 samples. Whole-buffer conversion produced 557,279 samples; 1,000 independently converted 1,024-sample chunks produced only 557,000. This supports SDK reuse for compatible finite PCM work and a stateful converter for continuous file conversion, with no Casai resampler or duplicate conversion pass. No conversion helper was implemented by that documentation change.

## Optional node-av follow-up

On 2026-11-09 the user clarified the npm-library integration and explicitly required the audio components to work with PCM when `node-av` is absent. This supersedes the preceding executable/PATH design, while retaining the SDK utility findings. The plan now requires an optional peer and lazy conversion-only loading; an isolated consumer without that package must still import, type-check, construct and invoke the PCM components. No production dependency or runtime implementation changed in this pass.

Checked published npm metadata (`node-av@6.2.0`) and upstream package/installer sources. Platform packages are selected by OS/CPU and carry prebuilt native code; there are no per-codec npm dependencies or installation options. JavaScript entry-point tree shaking does not strip codecs from compiled FFmpeg. Custom codec subsets would require a separate native build/release workflow, not a normal npm install option. The installer exposes `SKIP_FFMPEG=true` for the additional CLI download, which does not reduce the native codec set; validate it against the pinned library-only integration before recommending it.

References: [package metadata](https://github.com/seydx/node-av/blob/main/package.json), [prebuilt binding check](https://github.com/seydx/node-av/blob/main/install/check.js), [additional CLI installer](https://github.com/seydx/node-av/blob/main/src/ffmpeg/install.ts), [imports and tree shaking](https://github.com/seydx/node-av#imports-and-tree-shaking). Package installation, memory/size measurements, conversion correctness and cross-platform deployment remain prototype gates, not conclusions from this source review.

The documentation reconciliation adds the selected installation/PCM guidance to README2, the future user guide. README.md remains limited to implemented behavior. The main plan links its Phase 5 native baseline to the newer migration and conversion requirements, so historical component names and streaming-only results are not mistaken for limits on the planned ordinary Translator.

## External-review reconciliation (2026-11-09)

Reviewed both supplied Claude Code texts against installed `ai@7.0.162`, the OpenAI adapters, Casai factories/argument roles/dispatch, package fixtures, coverage configuration, official provider/RIFF documentation and published package metadata. The user's direction resolves the policy choices: permit straightforward input conveniences, correct an unnecessarily limiting contract, and preserve SDK behavior. This is a plan review; the production implementation remains pending.

| Item | Verified finding and disposition |
| --- | --- |
| 1. Experimental markers | Accepted. Ordinary Translator also uses the experimental SDK operation; mark the whole family. Remove the stale callable-base qualifier. |
| 2. PCM conversion gaps | Accepted. The public SDK helpers are sample/base64 utilities, not byte-stream/channel converters. Permit mismatched raw PCM in native conversion with explicit source metadata. Allow simple byte/container adaptation; avoid duplicated DSP rather than banning all adaptation. |
| 3. Finite-byte parity | Accepted. Use shared finite-byte admission for both Translator modes and streaming Transcriber, including configured/inherited/prepared inputs. `Uint8Array`/Buffer and `ArrayBuffer` are straightforward byte sources. Argument-role handling already recognizes binary objects, but the final factory/type integration still needs compilation; the review's sketch is not proof. |
| 4. Live evidence | Accepted with scope correction. Naming/dispatch is mock-testable; recorded-provider claims need an opt-in short recording check. One short case cannot establish all rate/message/session limits. OpenAI explicitly documents `session.close` flushing pending output; keep native handling. |
| 5. Chunking | Accepted. The adapter sends each input chunk as one base64 append. Replace whole-recording examples and bound finite-byte chunks, respecting known frame alignment. A 32 KiB block is not aligned to every possible sample frame. The recalled 15 MiB cap was not verified for translation; do not encode it. |
| 6. Resource lifetime | Accepted and strengthened. A stream's default `pull` can run before a reader exists, so moving initialization from `start` to `pull` alone is insufficient. Verify zero-prefetch/demand-driven opening and native cleanup; test failure after preparation but before dispatch. No general resource manager is needed. |
| 7. Format ownership | Accepted in part. Share the native target-format value with the component, require explicit PCM rate/convention, and describe raw input channels/encoding separately. Do not narrow all component/native formats to `audio/pcm` or reject another easily supported converter target for uniformity. |
| 8. Error policy | Corrected to the user's SDK-first decision. Complete translation does not add an `errors` array or throw on in-band errors. Stream events remain available through streaming results; complete values and transcription-tool projections follow native final promises. Native finish/output/fatal-error rules remain authoritative. |
| 9. Bundlers | Confirmed by an esbuild probe: a reachable literal dynamic import resolves during bundling even if not invoked. Isolate `casai/audio/node-av` from the main entry and dependency-free `casai/audio`; test all relevant graphs. Do not use dynamic string tricks to conceal dependencies. |
| 10. Coverage/install cost | Accepted. Mock module/loading/conversion lifetime in the default suite; real native checks supplement it. No mandatory `node-av` devDependency. c8 uses explicit source globs, not literally every source directory: add any new audio directory to coverage rather than letting it escape the gate or lowering thresholds. |
| 11. Native size and WAV | npm reports Linux x64 175,151,696 bytes and Windows x64 125,255,727 bytes unpacked for 6.2.0. Its installer identifies glibc-only Linux prebuilds; npm's MIT wrapper label does not establish the bundled FFmpeg license. Keep deployment/build notices explicit. Permit lightweight matching PCM WAV preparation without native conversion; simple support must not be excluded by the former contract. |
| 12. Staging | Accepted. Deliver A (factory migration, shared raw bytes, complete result) independently of B (WAV/optional converter). Both remain required; native installation work is not a gate for the independent migration. |
| 13. Consumer fixture | Accepted. Extend `phase2-package-consumer.cjs`, including its existing engine-candidate option, instead of duplicating the harness. Add absent-peer runtime/types and retired-module assertions plus focused bundled consumers. |
| 14. Matrix identity | Accepted. Reserve base/stream-only IDs for finite PCM and source-prepared IDs for WAV/native conversion. Keep one example per modifier ID. Eleven current streaming-audio examples now emit bounded PCM chunks while retaining the implemented stream API. |

The follow-up's shorthand description of native success was too broad. Translation requires a native finish and either an audio part or nonempty final translated text; transcription requires finish with nonempty text. Speech requires nonempty audio and finish, preserves its error callback and can propagate the last error on incomplete termination. A closed stream alone is not success. Error parts themselves remain non-fatal. The plan adopts none of the proposed extra errors-array/throw-on-event policy.

The proposed WAV sketch also needs correction. RIFF allows zero bytes in a chunk and uses declared sizes plus word padding; a zero-sized data chunk is not universally an unknown-length sentinel. Do not read later metadata as PCM. Verify streamed/sentinel conventions and RF64 support against the chosen parser/native path instead of accepting the blanket zero/`0xffffffff` rule or assuming every WAV has a fixed header. This is a bounded media boundary, not a new codec framework.

### Evidence and subsequent pass

`.cache/streaming-plan-review/audio-review-probes.mjs` passed native speech/transcription/translation error-part-plus-success cases, missing-output/finish cases, the native translation empty-audio-part behavior, eager default stream pulling versus `highWaterMark: 0`, and esbuild resolution of a missing literal dynamic import. No provider call or native-package install was made. The earlier PCM resampling probe remains applicable. Native package sizes were read with `npm view`; they are installed file sizes, not runtime memory benchmarks.

The extracted helpers from all eleven edited matrix examples passed `.cache/streaming-plan-review/matrix-audio-probe.mjs`: two uses each preserved every input byte, returned aligned chunks of at most 9,600 bytes and used views of the original PCM buffer. This checks the changed recording helper, not a full matrix type-check or provider run. Maintained extraction/type/mocked fixtures remain part of the migration gate.

Primary references: [translation frames](https://developers.openai.com/api/reference/resources/realtime/translation-client-events), [translation session closing](https://developers.openai.com/api/docs/guides/realtime-translation#close-a-websocket-session), [RIFF chunk sizes](https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-), [esbuild dependency handling](https://esbuild.github.io/api/#external), [node-av prebuilt checks](https://github.com/seydx/node-av/blob/main/install/check.js). Installed code, rather than prose in either review, establishes the SDK error behavior.

After reconciliation, a subsequent plan pass checked target/input parity, experimental markers, shared dispatch/claim ordering, converter ownership, optional import graphs, raw/WAV format boundaries, error projections, staged acceptance, package/coverage fixtures and example IDs. It corrected stale PCM-only guidance and clarified ordinary Translator's dispatch/tool rows; the final reread found no further important plan inconsistency. Remaining prototypes concern actual public helper/result types, native conversion/platform behavior and opt-in provider evidence; they are explicitly tracked implementation gates, not completed tests or new unresolved policy questions.

## Second external-review reconciliation (2026-11-09)

Checked the ten new findings against installed SDK/provider implementations, Casai's package/type/lint configuration, Cascada, and focused compiler/runtime probes. The user's answers select simple Casai/SDK conversion before native conversion, completed plain audio bytes plus a WAV writer, and non-native helper exports from the main entry. The prototype now verifies those decisions; it does not defer them.

| Item | Verified finding and disposition |
| --- | --- |
| 1. Absent-peer compilation | Confirmed: TS7 reports TS2307 for the literal import without a package or declaration. Add a narrow internal ambient declaration outside published source/output and include it in the relevant compiler/lint projects. Public helper signatures use no native package types. Compile the actual adapter against the installed package with the shim excluded in native integration; otherwise the shim could hide incompatibilities. |
| 2. Early checks and deferred errors | Confirmed: both OpenAI adapters acquire/read audio in `onOpen` and cancel it on pre-open failure. Require helper metadata/available-header checks and any needed native module load before returning the prepared stream. File opening/decoding remains demand-driven, so those errors can arrive through the live result. Pre-read cancellation opens nothing. Keep SDK validation of native component settings unchanged. |
| 3. Conversion priority | The conflicting routes were real; the recommendation to require native code for every sample change is rejected by the user's decision. SDK helpers support finite PCM rate conversion with small byte adapters. Allow those and simple local representation/channel conversion. The installed resampler uses linear interpolation without an anti-aliasing filter; document that capability rather than replacing it with mandatory native conversion. Continuous resampling and codecs beyond these paths use `node-av`. |
| 4. Matrix staging | Accepted. A uses bytes directly and PCM-returning preparers, removing the temporary chunk helpers when byte admission lands. B replaces the reserved examples with WAV/native preparation under the same IDs. Default checks use the native-module fake; real native example execution stays in isolated integration. |
| 5. Package changes | Accepted with the selected simplification: only one new export, `./audio/node-av`, with `casai-source` and the existing declaration/runtime conditions. Add optional peer metadata and a supported-major range after exact-version verification. Cover declaration-shim packaging and project includes as well as exports. |
| 6. Fixed chunks | Accepted for the normalizer. 9,600 is divisible by every mono/stereo 8/16/24/32-bit sample-frame size, so no format branch is needed. The native format type is an open `type: string` with optional rate; this is not a universal alignment claim for every provider encoding. Preserve the final remainder unchanged and leave caller streams native. |
| 7. Completed audio | Selected: `audio: Uint8Array`, decoding base64 parts with the public SDK utility and joining bytes in order, plus resolved native final fields. No guessed MIME type or implicit WAV conversion. Add a separate WAV writer using known PCM metadata. The format representation is settled; factory/helper implementation and verification remain pending. |
| 8. Main helper exports | Selected. Export non-native PCM/WAV helpers from `casai`; remove the proposed `casai/audio` subpath. Only `casai/audio/node-av` stays isolated, with no root import/re-export edge to it. |
| 9. Bundler dependency | Confirmed: esbuild 0.28.2 is installed via tsx, not declared directly. A maintained bundler check must declare its tool as a pinned devDependency and update the lockfile, instead of depending on that incidental installation. No dependency was added during this plan review. |
| 10. Stale input wording | Corrected. Both streaming audio input families admit finite raw bytes, and configured single-use ownership applies to streams rather than reusable byte buffers. |

### Evidence and limits

`.cache/streaming-plan-review/optional-types-probe.mjs` reproduced TS2307 with `node-av` absent, compiled the same literal import with an internal ambient declaration, and emitted a public declaration without native types. This establishes the build technique only; it does not check a not-yet-written native adapter against node-av's API. The source package publishes both `src` and `dist`, so checking emitted `.d.ts` alone would not establish that a shim stays private.

`.cache/streaming-plan-review/audio-second-review-probes.mjs` passed: Cascada preserved `Uint8Array`, `ArrayBuffer`, Buffer and ReadableStream identities; a fixed 9,600-byte bound aligns the listed PCM frame sizes; SDK helpers converted a finite mono PCM16 buffer from 48 to 24 kHz without node-av; cancelling a zero-prefetch stream opened nothing; and mixed byte/base64 native translation parts collected into the expected plain bytes. The conversion probe checks shape/length and successful composition, not perceptual audio quality. The earlier native error/finalization and stateless-resampling probes still apply.

Read the OpenAI translation/transcription `sendAudio`, `onOpen` and cleanup implementations, native `SharedV4AudioFormat`, translation result promises, and SDK audio/byte helpers. Checked package exports, TS7 source/build projects, type-aware ESLint and `npm explain esbuild`. Reference contracts: [TypeScript ambient modules](https://www.typescriptlang.org/docs/handbook/modules/reference.html#ambient-modules), [Node export conditions](https://nodejs.org/api/packages.html#conditional-exports), and [npm optional peers](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#peerdependenciesmeta).

No production source/dependency changes, native installation or paid provider calls were made. WAV helpers, real native type/conversion checks and live-provider behavior remain implementation gates. A subsequent full plan pass checked conversion priority, result shape, import paths, stage boundaries, factory/configuration inference, stream ownership, tool rules and acceptance evidence against the revised guide and instructions. It clarified that byte-returning tool cases belong to prepared transcription, not Translator. The final reread found no further important plan inconsistency; implementation and its acceptance checks remain pending.

## Third external-review reconciliation (2026-11-09)

Verified the seven new findings and the supplied carry-wrapper sketch. The user selected integer-ratio stream conversion and then explicitly confirmed: main-entry helpers stay SDK/local-only; `casai/node-av` uses native conversion when installed and supported SDK/local conversion when absent. This is more specific than the review's native-only entry proposal and supersedes the earlier simple-first routing inside that entry.

| Item | Verified finding and disposition |
| --- | --- |
| 1. Integer stream downsampling | Accepted. Integer-ratio groups plus bounded carry preserve the installed SDK's whole-buffer phase and length rounding, including 48-to-24 and 48-to-16 kHz. Add a demand-driven wrapper around the same finite conversion path. Other stream ratios/upsampling remain native work; no new resampling mathematics. SDK aliasing is explicit: ratio 2 selects every second sample without filtering. |
| 2. Native conversion preference | Accepted with the user's confirmed fallback. Native sample changes remain native when installed; reuse local pass-through/WAV extraction only when samples are unchanged. Top-level absence can use supported SDK/local conversion. An installed package's initialization, transitive-dependency or decode error is not absence; preserve it and never retry consumed input. Root imports stay independent of installation. |
| 3. Recorded streaming transcription | The adapter facts are confirmed: one commit at EOF, turn detection disabled, first completion ends the stream. Actual splitting/truncation of one long commit is not established by source review. Recommend complete Transcriber for whole files and add finite-byte streaming-transcription live evidence with recognizable beginning/end content. Do not add a Casai segmentation/completion workaround. |
| 4. Odd offsets | Confirmed by probe: `Int16Array` rejects odd starting offsets. Use `DataView` with explicit little-endian reads/writes over the input view and test odd offsets in conversion, not just WAV handling. Odd offset and incomplete sample length are separate cases. |
| 5. Byte conversion path | Accepted for Casai's PCM byte helpers: direct bytes-to-Float32 adapter, SDK resampler, direct clamped PCM16 output. Avoid whole-buffer base64 encode/decode round trips. Native translation base64 parts still use the public byte decoder. Native streaming inputs may themselves include base64 strings; the review's statement that components never accept base64 is too broad, but does not change this byte-path simplification. |
| 6. Experimental markers | Accepted. SDK resampling helpers and the preferred converter's SDK fallback document their experimental SDK dependency. WAV reader/writer and byte adaptation alone need no marker. |
| 7. Entry name | Use `casai/node-av`, with no unreleased old-path alias. A nested export does not technically require an exported parent; shortening is an API simplification, not a Node resolution fix. Update exports, guides, test graphs and instructions together. |

The provided wrapper is a useful sketch, not a complete implementation. It omits reader-lock release and explicit cancellation/error races. A final odd **sample count** is valid; a final odd **byte count** leaves half a PCM16 sample and must fail the conversion helper. Carry split bytes during reads, then match finite SDK output rounding for complete EOF samples. These helper requirements do not add validation to raw component input or replace SDK stream completion.

### Evidence and remaining work

`.cache/streaming-plan-review/integer-stream-resample-probe.mjs` passed 14 whole-buffer-oracle cases at ratios 2 and 3, including 100,003 samples, empty/single-sample inputs, odd starting offsets, irregular chunks, split samples and EOF remainders. It also checked odd-byte EOF rejection, unsupported ratios/upsampling, source errors, reader-lock release, cancellation before/during reads, eager `pipeThrough` pulling and a zero-prefetch wrapper. A synthetic 16 kHz tone downsampled 48-to-24 kHz matched an 8 kHz alias, confirming the installed SDK's unfiltered decimation. This is an isolated feasibility probe, not a production helper or perceptual quality benchmark.

`.cache/streaming-plan-review/native-fallback-probe.mjs` used isolated fake packages: absent selected SDK, installed selected native, installed missing-transitive-dependency/decode errors propagated, and an absent-package converter bundle succeeded with `node-av` externalized. That bundle check emitted ESM only and did not execute the bundle; the fourth reconciliation below closes the missing CommonJS probe. The actual native library was not installed or executed. Main-entry bundling remains a separate dependency-free requirement; runtime fallback does not make a reachable literal import invisible to a bundler.

Inspected the installed SDK audio/byte helpers and OpenAI transcription request, input pump and completion handlers, including its `/audio/transcriptions` complete operation. Native filter behavior is grounded in [FFmpeg's resampler options](https://ffmpeg.org/ffmpeg-resampler.html#Resampler-Options); the selected node-av integration still needs real conversion checks. [Node package resolution](https://nodejs.org/api/esm.html#importmetaresolvespecifier) supports separating top-level resolution from module initialization; the fake-package probe establishes that distinction without prescribing a new loading framework.

Updated the plan, README2, current instructions and review process. A subsequent complete plan pass checked helper/reader ownership, native/fallback selection, direct byte adaptation, result/error rules, stage boundaries, public exports and verification against the unchanged component/config/tool contracts. It clarified that the conversion table describes the SDK/local path and that the identity guard's no-reader rule prohibits probing, not explicit conversion/collection. The final reread found no further important plan inconsistency. No production implementation/dependency changes or paid provider calls were made; native integration, maintained implementation tests and live-provider evidence remain pending.

## Fourth external-review reconciliation (2026-11-10)

Scope: the user requested the non-matrix findings only. Items 2–4 and the matrix implementation are excluded from this pass.

| Item | Finding and disposition |
| --- | --- |
| 1. CommonJS absent-package fallback | Confirmed. The previous `import.meta.resolve` probe succeeds in ESM but throws `TypeError` after CommonJS bundling. Require built **and executed** ESM/CommonJS consumers with absent, installed and broken packages. Keep resolution separate from loading and recognize only absence of the requested top-level package. Missing installed entries, transitive dependencies, initialization and conversion failures must propagate. |
| 5. Observable conversion selection | Accepted as a small prepared-result metadata value, with the field name finalized alongside the helper signature. Distinguish local-only preparation, SDK-assisted conversion and native conversion, including matching audio that needs no native code. Selection is visible before reading and does not add a debug option, logging system or engine-selection override. |
| 6. Browser capture guidance | Added to the plan and README2: request the provider rate in Web Audio, capture processed samples and encode the provider's raw PCM representation. The context option does not configure MediaRecorder output or establish uniform browser filtering. This adds guidance, not a Casai browser-capture runtime. |

`.cache/streaming-plan-review/cjs-resolution-probe.mjs` reproduces the original CommonJS failure and executes 12 candidate bundle cases across both formats, using isolated fake packages. A small candidate resolves with Node `createRequire`, anchored to `__filename` in CommonJS or `import.meta.url` in ESM, and only catches an exact top-level `MODULE_NOT_FOUND` during resolution. Module loading stays outside that catch. It preserves installed-entry, transitive, initialization and conversion errors. Registry metadata for node-av 6.2.0 confirms that its default and require exports select the same JavaScript target. This demonstrates feasibility; final adapter integration must retain the package/export checks and maintained consumer tests. No real native package was installed or executed.

The documented CommonJS default is confirmed by [esbuild's Node platform contract](https://esbuild.github.io/api/#platform). Browser rate matching follows the [Web Audio source contract](https://www.w3.org/TR/webaudio/#MediaStreamAudioSourceNode); browser compatibility and resampling quality are not established by this Node probe.

A follow-up pass traced these changes through preparation selection, lazy resource acquisition, guide requirements and deliverable B's consumer gates. It retained sample-preserving/local conversion as a distinct path so metadata does not claim SDK or native processing merely from package availability. Production code, dependencies and matrix files were not changed. Real conversion, browser integration and provider evidence remain implementation checks; this reconciliation is not a complete implementation review.

## Matrix review reconciliation (2026-11-10)

Checked the supplied Claude Code findings against the current catalog, fixtures, plan and package commands before making changes.

| Finding | Current evidence and disposition |
| --- | --- |
| Rule language cannot express prepared streaming transcription tools; tool/stream exclusion is unconditional | Already corrected during matrix consolidation. `requires` accepts alternative maps and `streamTool` controls exclusion per component. Transcriber allows tools in complete mode or with an audio preparer; its streaming choice uses the matching conditional requirement. Verified admission, visibility and dependent clearing for script, function and loaded-script preparers. Documented the existing extension explicitly in the plan. |
| Experimental metadata exists only on components | Already corrected in the catalog. SpeechGenerator/Transcriber mark only their `asStream` choice; StreamingTranslator retains its component-level note and LLMAgent streaming remains unmarked. Added maintained assertions for this scope and explicit preservation requirements for the future Translator migration. |
| Verification instructions still refer to Markdown matrix extraction | Confirmed and corrected. The Examples row and validation order now use `npm run test:matrix`; the gate list and AGENTS test notes include its existing integration into `npm run check`. Guide extraction remains separate. |

`npm run test:matrix` passed: all 1,067 selections type-checked and executed with SDK mocks, including the new metadata assertions. No paid calls were made. A subsequent pass checked the revised plan against the catalog, fixtures and package commands and found no remaining mismatch for these findings. The production audio factory migration and complete Translator remain planned; this verifies the current matrix and reconciles the review, not those future APIs.
