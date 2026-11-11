# Streaming modifiers: implementation plan

Date: 2026-11-07; reviewed 2026-11-08; audio preparation revised 2026-11-10. Status: selected API direction; the type prototype and implementation are still pending. Findings and verification are in the [plan review](streaming-modifiers-review.md).

Replace the separate streaming audio component names with `.asStream` variants, add ordinary Translator for a finite recording and a completed result, and provide optional recording preparation. Reuse native SDK execution and completion semantics. Deliver the factory/input/result changes first and the independent audio preparation utility second; neither requires a general audio runtime.

Preserve the existing configuration type rule across all components and standalone/inherited Config fragments: the effective settings must fit one applicable component/operation shape, with no unrelated fields. The new complete and streaming audio contracts must remain separate alternatives. The review exposed runtime gaps in Casai-owned streaming controls; it did not establish that mixed configuration shapes are accepted by TypeScript.

## Target API

| Current API | Replacement | SDK operation retained |
| --- | --- | --- |
| `StreamingSpeechGenerator(...)` | `SpeechGenerator.asStream(...)` | `experimental_streamSpeech` |
| `StreamingTranscriber(...)` | `Transcriber.asStream(...)` | `experimental_streamTranscribe` |
| `StreamingTranslator(...)` | `Translator.asStream(...)` | `experimental_streamTranslate` |
| New complete-result convenience | `Translator(...)` | Reuse `experimental_streamTranslate` once with finite input and collect its result |

`SpeechGenerator(...)` and `Transcriber(...)` keep their complete-result operations. Translator has both callable factories: `Translator(...)` returns a completed translation for finite recorded audio, and `Translator.asStream(...)` returns the native incremental result. The components created by both factories are callable. This supersedes the earlier streaming-only namespace decision.

This Translator is specifically a **speech-to-speech** component. The installed SDK exposes only `experimental_streamTranslate`, but streaming input need not come from a microphone: a recording can supply a finite stream. The ordinary component provides completion/collection convenience over that operation. Ordinary text translation uses a non-streaming LLMAgent.

For ordinary text translation, use instructions such as: "Translate the supplied text into French. Preserve its meaning, tone and formatting. Return only the translation." Supply the source text as the agent's prompt. No separate text-translation component is needed.

```typescript
const translate = Translator.asStream({
  model,
  inputAudioFormat,
  targetLanguage: 'fr',
});
const result = await translate(audioStream);
```

Here the application supplies a native translation model, audio format and fresh raw-audio stream. The call returns the native live result. Named invocation is also supported through `translate.run({ audio: audioStream })` as an alternative to the last line, using the stream once.

The ordinary form uses `Translator({ model, inputAudioFormat, targetLanguage: 'fr' })` and waits for the finite recording's completed result. Both Translator modes and streaming Transcriber accept reusable finite raw audio bytes (`Uint8Array`, including Buffer, and `ArrayBuffer`) as well as native audio streams. `.asStream` changes result delivery, not finite-byte admission. Ordinary Translator requires a source that ends; it does not need a distinct byte-input adapter.

Expose the same API through named imports and `create`. Remove the three old public `Streaming...` exports and their public component-kind names; keep no compatibility aliases for these unreleased names. Native SDK names and experimental status stay unchanged.

Source modifiers come first, followed by `.asStream`, then `.asTool` where supported:

```typescript
SpeechGenerator.asStream({ model });
SpeechGenerator.withTemplate.asStream({ model, text: 'Hello {{ name }}.' });
Transcriber.withFunction.asStream({ model, audio: openAudio, inputAudioFormat });
Transcriber.withFunction.asStream.asTool({
  model,
  inputSchema: recordingSchema,
  inputAudioFormat,
  audio: openRecording,
});
Translator.withFunction.asStream({ model, audio: openAudio, inputAudioFormat, targetLanguage: 'fr' });
```

These illustrate the planned factory paths; dependencies are application-supplied. Do not add reverse modifier orders such as `.asTool.asStream` or `.asStream.withFunction`.

| Family | Streaming source modifiers | Streaming tool support |
| --- | --- | --- |
| SpeechGenerator | Default, `withText`, `withTemplate`, `withScript`, `withFunction`, `loadsText`, `loadsTemplate`, `loadsScript` | None |
| Transcriber | Default, `withScript`, `withFunction`, `loadsScript` | Prepared forms only: `withScript`, `withFunction`, `loadsScript` |
| Translator | Default, `withScript`, `withFunction`, `loadsScript`, each followed by `.asStream` | None |

Translator follows the same factory structure as the other audio families: its base and source selectors construct complete-result components, and `.asStream` selects incremental results. No non-callable namespace exception is needed. Both forms have ordinary calls, `.run()` and `.config`; raw streaming input retains native format requirements.

LLMAgent's existing streaming behavior and prohibition on streaming tools remain unchanged. Template streaming remains future Phase 6 work. Script and Function retain their existing schema-declared stream contracts.

An ordinary non-tool LLMAgent retains both native Agent methods, `.generate()` and `.stream()`, regardless of its default. Its `streaming` setting selects ordinary calls, `.run()` and `resume()`. Do not split LLMAgent's shared configuration or remove either native method as a side effect of separating the audio operation contracts.

## Behavior to preserve

- Ordinary calls and `.run()` on a streaming component resolve to its native live SDK result. They do not collect the output before returning.
- Prepared streaming transcription tools open finite audio and return the existing completed transcript projection. Ordinary calls on the same tool component still return the live result. Keep the current final-result promise handling and model-facing transcript formatting.
- Completed speech and streaming speech retain different native inputs, formats and results. Complete speech uses a string output format; streaming speech uses an audio-format object and can accept streamed text.
- Complete transcription accepts a recording; streaming transcription accepts raw audio streams or finite raw bytes with a required format. The modifier does not decode containers, convert formats or open a microphone.
- Recommend ordinary Transcriber for whole prerecorded files, using the provider's file operation. Streaming byte admission remains supported, but inherits native session completion. The installed OpenAI adapter disables turn detection, commits once after input EOF and finishes on the first transcription-completed event. Verify finite-recording behavior with the provider; this source observation does not prove that it actually splits one committed recording. Add no Casai multi-item collector or extra commits to compensate for a hypothetical SDK limitation.
- Retain positional calls, context/source separation, required configuration, preparer inference, private bindings, parsed schema values, cancellation and native callbacks.
- Retain the shared live-input identity guard immediately before SDK dispatch. Preserve fresh-stream requirements, configured single-use streams, reusable configured bytes, and native ownership/cleanup rules. Do not buffer, replay or acquire probing readers to inspect/claim inputs, and add no second claim registry. Explicit conversion and completed-result collection consume their streams as described below.
- Provider support, SDK errors and completion semantics remain native. Selecting `.asStream` does not make an unsupported model stream.

## Recorded-audio translation

Treat support for prerecorded audio as a required use case, not a consequence of whether the SDK supplies a function named `translate`. The ordinary Translator's purpose is to accept a finite recording and return its completed translated audio, native source/translated text and metadata. Prefer one native speech-translation execution over an automatic Transcriber/LLMAgent/SpeechGenerator pipeline, which would require additional models and change the operation's behavior.

Implement and verify the following selected adapter contract; the prototype checks its types and integration rather than reopening byte admission or completed-audio representation:

- Separate the recording's encoding from result delivery. The native translation operation accepts raw audio chunks plus `inputAudioFormat`. The OpenAI translation endpoint requires 24 kHz mono signed 16-bit little-endian PCM; an MP3/WAV container is not raw PCM. Define finite recorded-data admission and use the explicit preparation contract below. Do not guess that arbitrary bytes are PCM or add an implicit codec dependency.
- Use one shared raw-audio input normalization for ordinary/incremental Translator and streaming Transcriber. Wrap finite bytes in a fresh stream per invocation; preserve native streams as supplied. Configured, inherited, shorthand, named and preparer-returned bytes use the same rule, including prepared transcription tools. Preserve schema/preparation/cancellation ordering and claim the actual stream once immediately before dispatch. Keep input bytes unmodified; borrowed views require callers to leave them unchanged during the run. Do not introduce a second component or competing input wrapper inside the conversion utility.
- Pull finite bytes in chunks of at most 9,600 bytes, returning the final remainder unchanged. This fixed bound aligns mono/stereo 8/16/24/32-bit PCM frames and is 200 ms at OpenAI's 24 kHz mono PCM16 format. It needs no format-dependent branch and does not promise alignment for every possible provider format. Preserve every input byte without padding or truncation. Native caller streams retain SDK handling; do not add a universal rechunker or pacing layer. The review's recalled 15 MiB append cap was not established for translation; do not encode it as a contract.
- Raw-byte admission never detects MP3/WAV or derives format from byte contents. Complete Transcriber bytes can be encoded files; streaming Transcriber bytes must match the declared native input format. Types cannot distinguish those byte contents. Document this at mode inheritance and test settings compatibility without introducing byte branding or content sniffing.
- Own `fullStream` before reading any final result promise. The SDK allows only one consumer; reading a promise first drains the stream internally and prevents audio collection. Consume one stream once, retain the needed audio parts, and read the native final text/metadata from that same execution. Do not reassemble authoritative text from partial events or rerun translation to obtain another result view.
- Share the native dispatch below the existing preparation boundary. Do not implement the complete form by constructing and invoking another Casai component after preparation; that would risk duplicate schema parsing, source preparation or input claims.
- Return completed `audio` as a `Uint8Array`: decode base64 audio parts with the public SDK byte utility and concatenate all audio bytes in stream order. Include the resolved native `sourceText`, `translationText`, `durationInSeconds`, `usage`, `warnings`, `response` and `providerMetadata`. A native text-only success has empty audio bytes. Do not invent a file type or infer the actual format from the requested `outputAudioFormat`: the generic result does not declare it, and OpenAI returns 24 kHz mono PCM16 while warning that requested output formats are unsupported. Callers who know the actual PCM format can explicitly build a WAV with the helper below. Plain bytes and that helper are selected; only their implementation/type verification remains.
- Follow the SDK's result-promise policy exactly for error parts: a non-fatal in-band error does not become a thrown Casai error or a collected `errors` field. The completed adapter collects audio and reads authoritative native final values; event-level observation uses the streaming component's returned `fullStream`. Preserve native failures for missing finish, insufficient output, transport errors and cancellation. Translation currently accepts any emitted audio part or nonempty final translated text at finish; do not replace this with Casai's idea of valid audio. Keep the existing streaming transcription tool's promise-based projection unchanged.

Completed output necessarily retains produced audio. This convenience is justified by the finite recorded-audio use case; it does not authorize buffering or replay in `.asStream`, a new transport, or a general stream-completion framework. No new Translator tool form is selected; retain the existing streaming no-tool rule and evaluate any complete-result tool separately if requested.

### PCM utilities and optional node-av

**Confirmed 2026-11-09, clarified after the third external review:** main-entry helpers use simple Casai conversion and suitable public AI SDK helpers, without loading native code. Include finite conversion and integer-ratio stream downsampling. The separate `casai/node-av` entry prefers native conversion when installed and falls back to those supported SDK/local paths when the package is absent. This supersedes routing every stream rate change to native code and routing installed native conversion back through the SDK. Keep preparation explicit and preserve ordinary Transcriber's provider-native encoded-file support.

Preparation composes through existing script/function preparers. Use the same native target-format object for preparation and `inputAudioFormat` in examples. For raw PCM conversion require an explicit source description (rate, channels, sample representation/byte order); encoded containers supply their metadata. For the helper's `audio/pcm` target, define mono signed PCM16 little-endian and require an explicit rate; 24 kHz is OpenAI translation's requirement, not a global default. Do not restrict component-native format types to PCM or forbid other converter targets that have a simple, verified mapping. Do not infer raw media properties or add another modifier/configuration ownership layer.

The table describes the SDK/local path and its limits. The preferred converter uses native sample conversion when installed, including for cases this path also supports.

| Input | Preparation |
| --- | --- |
| Raw PCM already matching the required format | Pass through without decoding, resampling or loading `node-av` |
| Finite PCM bytes or samples needing simple conversion | Use SDK sample helpers with small byte adapters; simple sample-format conversion and channel mixing are allowed. Finite mono PCM16 at 48 kHz to 24 kHz is a required no-native case |
| PCM stream with an integer input/output rate ratio | Use the SDK resampler on aligned groups with a bounded leftover carry; 48-to-24 and 48-to-16 kHz mono PCM16 are required no-native cases |
| PCM WAV | Extract PCM without `node-av`; pass matching audio through, or use the same simple conversion path when supported |
| Other stream rate ratios, stream upsampling or unsupported encoded formats | Select `casai/node-av`; these require native conversion unless another simple supported path exists |
| Conversion needing `node-av` when absent | Explain `npm install node-av` or supply already-prepared audio; other component calls remain available |

For PCM16 byte conversion, use direct little-endian byte-to-Float32 adaptation, `experimental_resampleAudio`, then a direct clamped Float32-to-PCM16 adapter. Read with `DataView` over the supplied byte range so odd `byteOffset` values work; an offset `Int16Array` view can throw and assumes host endianness. Respect view bounds and do not mutate borrowed input. Test odd-offset subarrays and defined quantization/clipping behavior. Pass unchanged audio through directly. The SDK's base64 encode/decode audio helpers remain useful for applications already using those representations; do not introduce base64 round trips into Casai's byte path. Completed native base64 audio parts still use the public SDK byte decoder.

The public SDK resampler uses stateless linear interpolation without an anti-aliasing filter. At 48-to-24 kHz it simply selects every second sample; frequencies above 12 kHz can fold into the output band (for example, 16 kHz becomes 8 kHz). State this plainly for finite and streaming SDK conversion. Native rate conversion uses FFmpeg's filtered resampling; verify the selected node-av path rather than promising identical samples or a measured quality improvement for every recording.

For integer downsampling, carry incomplete groups between reads and send only whole groups to the existing finite SDK conversion path. For mono PCM16 the group is `2 * (inputRate / outputRate)` bytes; retain fewer than one group, including a possible split sample byte. At EOF process remaining complete samples with the same SDK rounding rule as finite conversion. An odd sample count is valid; an unmatched final byte is incomplete PCM16 and must fail the helper rather than be padded or dropped. This does not add content validation to raw component inputs. Other ratios and upsampling remain outside this SDK stream path; never independently resample arbitrary chunks or buffer an unbounded stream.

Use a demand-driven `ReadableStream` with zero prefetch for that adapter. Acquire the input reader on the first output read; do not create a `pipeThrough` pipeline during preparation, since it can read eagerly. Release the reader at EOF, error and cancellation, propagate cancellation to the source, and handle cancellation during an awaited read without enqueueing afterward. A pre-read cancellation cancels the source without acquiring its reader or opening conversion resources. Test against whole-buffer SDK conversion for irregular chunks, split samples, odd offsets, empty/single-sample inputs and all EOF remainders; include source failure and cancellation before/during reads. This is a small adapter over the SDK, not a general resampling or stream-lifecycle framework.

Export non-native PCM/WAV helpers from `casai` and the optional converter from `casai/node-av`; add no `casai/audio` parent or old-path alias. The main entry has no import/re-export edge to the optional entry and never probes for native installation. Share the byte adapters and non-native conversion internally. Through `casai/node-av`, reuse sample-preserving pass-through/WAV extraction, then use native code for every required sample change when installed. If the top-level package is absent, use the supported SDK/local conversion path; missing codecs or unsupported stream ratios still require installation. Do not fall back after an installed package fails to load, a transitive dependency is missing, or conversion fails, and do not retry consumed input through another engine. Document that installing node-av changes the preferred converter's resampling behavior; main-entry helpers remain an explicit SDK-only choice.

A literal dynamic import alone does not isolate native code from bundlers. Main-entry declarations/bundles must work without node-av or externalization. Bundling `casai/node-av` still needs the native package installed or marked external; document/test externalization when using its absent-package fallback. Both ESM and CommonJS Node bundles must execute that fallback correctly. Keep loading lazy inside that entry and resolve from the module/bundle location, using normal package resolution to distinguish top-level absence from an installed failure. Do not rely on unguarded `import.meta.resolve`, which is unavailable after CommonJS bundling, or classify every module-not-found error as absence. A CommonJS resolution failure must identify exactly the requested `node-av` package; a missing installed entry or transitive dependency remains an error. Keep module loading outside the absence catch. Verify resolution against the pinned package's export conditions, and add no global converter registry or disguised import string.

During preparation, validate source/target descriptions and already-available WAV headers. The preferred converter selects its engine before returning a prepared stream: check/load installed node-av, or choose a supported SDK fallback when absent. Unsupported conversion without the package and installed-package load failures fail before SDK dispatch. These checks open no input file or decoder. Preserve SDK validation of native component options; this preflight belongs only to the preparation helper's inputs.

Expose that selected conversion path as a small value on the prepared result, alongside its audio/format metadata. Distinguish local-only preparation, SDK-assisted conversion and native conversion; local preparation includes pass-through, WAV extraction and any supported local sample adaptation. Report the work selected for this input, not merely whether node-av is installed. Keep it fixed for the prepared stream's lifetime and available before consumption, without opening a reader or decoder to obtain it. Finalize the field name with the helper signature in the prototype. This needs no debug option, logging framework or execution history.

Open input files and native decoder/resampler resources only on first consumption. `ReadableStream.pull()` can run before a reader exists with the default queue strategy; use a verified demand-driven strategy (for example `highWaterMark: 0`) and native cleanup. Cancellation before the first read must acquire no resources. OpenAI reads audio after its WebSocket opens, so missing files and failures requiring decoding can occur after a live result is returned; they propagate through the native result stream/promises. Ordinary Translator awaits that execution and rejects. Do not add file pre-opening or a duplicate decode pass to move those errors earlier. Test pre-dispatch failure, cancellation before/while opening or reading, EOF and decode failure. Authors who consume resources inside their own script own that cleanup; add no central resource registry.

For lightweight WAV preparation, reuse a suitable parser or a small bounded RIFF reader rather than a fixed 44-byte header assumption. Handle metadata chunks, padding, valid declared lengths and PCM/extensible-PCM metadata; return a view when no conversion is needed. Distinguish a legitimate zero-length data chunk from a producer's unknown-length convention; do not automatically treat every zero or `0xffffffff` length as all remaining bytes. Unknown-length/RF64 variants need verified parser support or the native converter, not silent misinterpretation. This baseline must not prohibit other easy supported WAV representations or sample conversions; avoid building a new general codec library.

Add a matching WAV writer in the same non-native helper set. It takes finite PCM bytes and an explicit known format, and returns WAV bytes; it does not transcode or guess the format of model output. The baseline shared `{ type: 'audio/pcm', rate }` convention means mono PCM16 little-endian. Write correct RIFF/fmt/data sizes and reject inputs that cannot be represented by the supported WAV form. Reader/writer round-trip tests must preserve sample bytes and rate, including empty audio and a nonzero byte offset. Do not conflate a simple canonical writer with a fixed-header assumption in the reader.

For deliverable B, add `package.json`'s `./node-av` export with the main entry's `casai-source`, `types`, `import` and `require` conditions. Declare `node-av` as an optional peer via `peerDependenciesMeta`, constrained to the verified major (candidate `^6.2.0`, tested at an exact version in native integration). Do not add it as an auto-installed optional dependency or mandatory devDependency. Because a literal import still needs compile-time resolution, add a minimal internal ambient declaration for only the native API used, outside published `src`/`dist`. Include it in source/build/type-aware-lint projects, without exporting it or leaking native types through public helper signatures. Check tarball contents as well as emitted declarations. Native integration must compile the actual adapter against real package types with the ambient shim excluded, so the shim cannot conceal API drift.

The published `node-av` package selects prebuilt native packages by OS/CPU, not by codec. Its JavaScript subpath imports/tree shaking do not remove codecs from the native build. There is no supported npm switch for installing only MP3/WAV codecs; a reduced FFmpeg/binding build would be separate build/release work and is not selected for Casai. The upstream installer also has `SKIP_FFMPEG=true` to omit its additional CLI download; this is not codec selection. Verify that optimization against the pinned package's library-only path before documenting it as an installation recipe.

User guides must distinguish raw PCM, WAV containers and actual sample conversion. Include finite-byte/stream calls, WAV reading/writing, finite conversion and integer stream downsampling without node-av, plus preferred native conversion with `npm install node-av`. Explain SDK aliasing, native/fallback selection, bundle externalization and error timing. Recommend ordinary Transcriber for whole recordings and document native streaming completion limits. Document supported platforms, installation size and bundled FFmpeg notices separately from the wrapper's MIT metadata. The reviewed 6.2.0 native packages are about 175 MB (Linux x64) and 125 MB (Windows x64) unpacked, before any additional CLI download; Linux prebuilds are glibc-oriented. Do not claim every Linux/serverless target works. Preserve the fixed-codec-set explanation and `.asStream` result-delivery semantics.

Include browser capture guidance: request the provider rate with `new AudioContext({ sampleRate: 24000 })` for OpenAI translation, capture processed Web Audio samples and encode mono PCM16 little-endian so the server need not resample. Verify `context.sampleRate` and supported source setup. Distinguish this from MediaRecorder output; avoid promising uniform browser filtering. Link the [Web Audio source-rate contract](https://www.w3.org/TR/webaudio/#MediaStreamAudioSourceNode). Also show the preferred converter's selected-path metadata when comparing environments.

The selected installation/format guidance is now in [README2](../README2.md#recorded-audio-and-optional-codecs). Add the concrete conversion-helper examples once the prototype establishes its public signature; do not invent a callable helper name in the guides before that decision. Keep `SKIP_FFMPEG=true` in the integration checks until the library-only installation has been verified.

References: [OpenAI translation input format](https://developers.openai.com/api/reference/resources/realtime/translation-client-events), [node-av installation and platform packages](https://github.com/seydx/node-av), [native audio conversion](https://github.com/seydx/node-av/blob/main/src/api/decoder.ts). The [review evidence](streaming-modifiers-review.md#pcm-utility-follow-up) records the installed SDK helper limitations; the [node-av follow-up](streaming-modifiers-review.md#optional-node-av-follow-up) records the dependency decision and remaining integration checks.

## Implementation sequence

Deliverable A covers the factory migration, shared finite-byte admission/chunking and completed Translator with plain audio bytes. Its matrix examples use PCM bytes and existing preparers only. Deliverable B adds PCM/WAV reading, writing, finite conversion and integer stream downsampling in the main entry, plus the isolated `casai/node-av` converter with supported fallback, then updates the reserved prepared examples. A does not wait for B's signatures or native package/platform work; both remain in scope with separate verification records.

### 1. Confirm the baseline and map consumers

Inventory named exports, `create`, factory modifiers, `Component`/`ComponentConfig`, reusable Config shape consumers, configuration inheritance, tool bindings, emitted declarations, guides and matrix entries. Record representative runtime and compiler baselines before changing shared code.

Confirm the installed SDK version (review baseline: `ai@7.0.162`) and reuse the recorded native comparisons. Inspect the native definitions and implementations touched by operation selection and option admission under `ai/src/generate-speech/`, `ai/src/transcribe/` and `ai/src/translate/`. Revisit Tool/ToolLoopAgent delegation only if the tool execution boundary changes or prior evidence no longer applies. Use focused mock probes; no paid calls are needed.

Current implementation facts that affect the change:

- `createComponentFactory` can install `.asStream`, but currently invokes the same creator after setting `streaming: true`. It does not select an audio operation variant.
- Generic `SourceFactory` types expose source and tool modes, but do not yet select a completed or streaming audio contract.
- Runtime and type-level configuration merging already preserve `streaming: true`. Reuse that rule.
- `createComponentRuntime` does not currently treat `streaming` as a configuration-only field to remove before specialized SDK dispatch.
- The streaming adapters already own the needed argument handling, live-input claims, native results and transcription tool collection.

Reuse the [configuration-mixing review](configuration-mixing-review.md): its 14-family/153-path checks found no mixing type defect in the exercised cases. It separately records the runtime streaming-control gaps. Preserve the [existing native-option runtime policy](phase5-claude-review.md#follow-up-implementation-2026-11-06), structural configuration compatibility and common checks for incomplete fragments. That policy does not delegate TypeScript checking to SDK execution.

Before changing the shared factory, make a bounded Transcriber prototype that exercises both operations, inherited source modes and prepared streaming tools. It must demonstrate factory inference, standalone/inherited Config admission, public config annotations and exported component declarations together. Choose the public annotation representation in that prototype and record the exact usable syntax; preserve existing helper defaults where possible. A final-return type cast alone is not a successful prototype. If preserving those consumers requires a public type-API tradeoff, present the concrete alternatives before integration.

Also prototype the finite-recording Translator adapter against the native SDK. Verify the selected byte input/output contract, final metadata and single-execution ownership; do not leave plain bytes versus WAV as an open representation decision. The native mock probes demonstrate finite input, collection and byte/base64 concatenation, not the finished public factory or arbitrary recording-format support.

Prototype the shared finite-byte normalization and completed result with the component migration. Prototype optional recording preparation separately, including raw PCM conversion, WAV handling, public helper signatures and present/absent package paths. Its platform installation work must not block the independent factory migration; do not report the entire requested scope complete until both deliverables meet their gates.

### 2. Select the operation and validate Casai controls

Represent each audio family's complete and streaming variants using its existing operation definitions and adapters. Resolve inherited settings and explicit modifiers using the existing merge rules, select the effective operation, and validate its completed configuration before creating its runtime. The final type contract must belong to that operation; do not combine the fields of several contracts into one permissive shape.

Use a small shared selection mechanism. Do not duplicate context preparation, callable assembly or SDK execution pipelines. Keep operation-specific requirements with their owner. Move each existing speech/transcription streaming creator into its family module, keeping separate native execution functions. Rename the translation module to `Translator.ts`. Remove the old `Streaming*.ts` modules: published source and the `./dist/*` type export make those filenames observable.

Set `streaming: true` on components created through `.asStream`. Resolve inherited streaming through both components and Config fragments. Source modifiers change the source mode and preserve the selected execution mode.

These derivations must stay streaming:

```typescript
const live = SpeechGenerator.withTemplate.asStream(streamConfig);
const child = SpeechGenerator({}, live);
const throughConfig = SpeechGenerator({}, Config({}, live));
const newSource = SpeechGenerator.withFunction({ text: prepareText }, live);
```

Make `streaming` accept only `true` or `undefined` in `validateConfigBasics`, alongside `asTool`. Check raw child values before merging so inherited `true` cannot hide `false`. Preserve the existing sticky-true merger; no merge-algorithm change is needed. A base factory with a streaming parent inherits that operation; it does not request a complete operation. Direct `streaming: true` settings select the same operation as the modifier on supported families.

Remove LLMAgent's duplicate flag-value check once the common validator owns it; retain its specific streaming/tool prohibition. Keep the existing LLMAgent creator and native-method dispatch. The audio variant resolver need not turn every component into a multi-operation factory.

Add `streaming` to `component-call.ts`'s `configurationKeys`: this both removes it from specialized SDK requests and rejects it in `.run()`. At the shared factory boundary, reject `streaming: true` if the family has no implemented streaming operation. This includes unsupported inherited flags on Embedder, Reranker, Decision, ImageGenerator, VoiceSessionSetup and the coded components; future Template streaming remains separate work.

Preserve the one-shape type checks for direct configuration, Config intermediates and merged inheritance. Add the distinct audio operation shapes to those existing checks. Shared fields are reusable wherever they fit; application context remains data/dependencies, not native execution settings. Do not add parent-origin branding, infer ownership from model IDs, or rebuild native setting allowlists. A runtime test that bypasses TypeScript must distinguish a Casai-owned modifier error from the SDK's existing unknown-option behavior.

### 3. Select types from the effective mode

Keep the existing distinct audio operation contracts internally and select one from public family plus resolved execution mode. Scope this to the changed audio families: do not split Embedder's scalar/batch operation, VoiceSessionSetup's methods or LLMAgent's Agent methods into new registry entries. Reuse existing component-owned argument/result definitions instead of repeating streaming conditionals throughout `Main`, `Source`, requirements, tool rules and result helpers.

Separate public family names from internal operation keys. Today `ComponentKind` is `keyof Definitions`, and `AnyConfig` indexes the same registry through it. Simply renaming internal streaming keys would either expose those keys through public helpers or omit their shapes from reusable Config. Keep all operation shapes reachable by Config validation while constraining public `Component`/`ComponentConfig` to the selected family names. Verify source/preparer discovery, callback inference, requirements and tool projections as consumers of this mapping, not only the final factory return type.

Pair the streaming discriminant with each audio configuration shape. Completed complete-mode configs must exclude `streaming: true`; completed live-mode configs must resolve to `streaming: true`. A union of native settings intersected with a shared `{ streaming?: true }` is insufficient: it accepts `{ streaming: true, outputFormat: 'mp3' }` from complete speech. Reusable fragments may omit the discriminant until a factory/modifier supplies it, but a supplied flag must agree with that fragment's native fields. Preserve incomplete-fragment support without inferring the operation from field values.

Keep native SDK settings in the operation settings map and add Casai metadata in the configuration projection. Do not forward or publish the configuration flag as a native input or tool argument, or permit a top-level `.run()`/native-method override. Test explicit `undefined` as well as defined attempts to set it. Same-named application data inside declared context/tool inputs remains ordinary data and must not select an operation; add no recursive name ban. Verify that early callback/preparer inference sees the selected operation after inheritance, including `Transcriber.withFunction({ audio: openLiveAudio }, liveParent)`; final-return mapping alone is insufficient.

Keep complete and streaming configurations paired with their requirements, preparer return types, callbacks and results. Do not flatten both into permissive settings or return `any`. Retain:

- Precise complete versus live results and `.config.streaming` inference.
- Required audio format and translation target, including configured/inherited values and shorthand omission rules.
- Text-stream inputs for streaming speech and raw streams or finite raw bytes for streaming transcription/translation.
- Raw caller types, parsed preparer context and callback inference after inheritance or overrides.
- Safe construction from source-mode unions within one execution operation. Calls and replacements must work in every possible source branch; retain the existing source-mode-union decision.
- Existing restrictions on calling unions of different component instances.

A TypeScript union of complete and streaming configs means the variable holds one valid config or the other; it does not merge their fields. Preserve existing valid LLMAgent and source-mode unions. Evaluate new audio execution-mode unions in the Transcriber prototype without promising a new common callable. Do not assume `if (component.config.streaming)` narrows a union of callable components: the focused compiler probe does not narrow the enclosing callable through that nested property. Check actual calls after narrowing the input configuration, explicit modifier selection and any proposed component narrowing before selecting a contract. Do not add a public discriminator or type guard merely to make one proposed union design work.

Update public `Component` and `ComponentConfig` consumers to use `SpeechGenerator`, `Transcriber` and `Translator`, with execution mode represented by configuration. `ComponentConfig` currently has only family/source parameters, so "resolve from config" alone does not define how to annotate a streaming config. The prototype must include named complete/live config variables passed to the right factories, both Translator result modes, and invalid neighbors. Check inferred components exported by applications and downstream declarations without exposing private types or old public component names.

Runtime definitions must use the family name in diagnostics. Internal operation keys must not retain the old `StreamingSpeechGenerator`, `StreamingTranscriber` or `StreamingTranslator` names. Map type diagnostics to the public family and `.asStream` path where mode matters. Verify emitted application declarations as well as Casai's own declarations.

Integrate the accepted Transcriber prototype first, then SpeechGenerator and Translator. Check inference and compiler cost before extending the design. Do not invent new runtime input, output or completion handling to solve a type-selection problem.

### 4. Preserve each family's tool rules

Construct modifier paths from the selected operation's capabilities. Do not apply LLMAgent's generation-only tool rule globally.

| Effective operation | Tool behavior |
| --- | --- |
| Complete SpeechGenerator | Existing speech tool behavior |
| Streaming SpeechGenerator | No tool form |
| Complete Transcriber | Existing transcription tool behavior |
| Streaming Transcriber, plain source | No tool form |
| Streaming Transcriber, script/function/loaded script | Existing finite transcript tool behavior |
| Complete Translator | No tool form selected |
| Streaming Translator | No tool form |
| Streaming LLMAgent | No tool form, unchanged |

Support `.withFunction.asStream.asTool` and the corresponding script/loaded-script paths. Build those modifier properties from the selected operation's source/tool capabilities, then validate each construction after inheritance. Explicit `asTool: true` and inherited tool mode must resolve under the same final-operation rules. For example, `Transcriber({}, preparedStreamingTool)` retains its source, streaming and tool modes even though a new plain streaming transcriber has no tool path. A valid inherited prepared source must not be rejected merely because construction uses the base factory.

Check inheritance and Config intermediates against the final operation contract. Reject incompatible final settings statically and unsupported Casai tool/streaming combinations in types and runtime before dispatch. Preserve closed public tool inputs, trusted context, actual execution metadata and output projections. Keep LLMAgent's specific generation-only tool diagnostic; consolidating that separate rule is not necessary for this change.

### 5. Migrate exports, guides and examples

| Area | Required work |
| --- | --- |
| `src/factories/component-factory.ts` | Resolve operation variants and expose supported modifier paths |
| SpeechGenerator/Transcriber factories | Place each existing complete/live execution function in its family module |
| Translator factory | Expose complete/incremental factories sharing native translation dispatch; keep finite-result collection local |
| `src/types/component-map.ts`, `component.ts`, factory/config/callback types | Select native contracts by mode; remove old public component-kind names |
| `src/config/validate.ts`, Config shape/type consumers, factory definitions, `src/runtime/component-call.ts` | Validate raw flags and supported operations, retain exact shape checks and strip configuration-only fields; keep existing merge laws |
| `src/index.ts`, `src/factories/factories.ts` | Replace public streaming exports with the selected family API |
| Audio helpers and preferred converter (B) | Export PCM/WAV and SDK conversion helpers from the main entry; isolate native imports and supported fallback selection in `casai/node-av` |
| `package.json`, lockfile, type-check project includes and internal ambient declaration (B) | Add the converter export/conditions, optional peer metadata, non-shipped native type stub and direct pinned bundler test dependency; cover new runtime source in c8 |
| Tests, declaration/package fixtures and mutation selectors | Migrate names without losing existing assertions; add mode-selection coverage |
| `README.md`, `README2.md`, active plan sections and `AGENTS.md` | Describe the selected API, PCM/WAV preparation without native dependencies, optional `node-av` conversion and experimental dependency notes |
| `docs/matrix` | Retain shared audio-family renderers; replace temporary factory selection and verify planned Translator examples against the implemented API |

Update user guides with the implementation, so README.md does not claim unavailable methods. Keep implementation status in plans/review records. Historical evidence may retain old names when identified as historical; active guidance must point to the replacement.

Move SpeechGenerator/Transcriber streaming experimental markers to their `.asStream` members. Keep the whole Translator family experimental: ordinary and streaming calls both use `experimental_streamTranslate`. Do not mark LLMAgent streaming experimental as a side effect. Scope the generation-only streaming/tool prohibition in AGENTS.md explicitly to LLMAgent; preserve prepared streaming transcription tools.

Mark helpers that depend on `experimental_resampleAudio` with `@experimental` and explain the SDK dependency in guides, including the preferred converter's SDK fallback. PCM byte adaptation and WAV reading/writing alone need no experimental marker.

For the matrix:

- Keep `asTool` first and `asStream` next, followed by existing source controls.
- Use IDs in the order `Component_sourceModifier_asStream_asTool`, omitting unselected modifiers. Keep the `loadTemplate`/`loadScript` labels and actual `.loadsTemplate`/`.loadsScript` API spellings.
- Speech, transcription and translation already share their base-family renderers/resources and use IDs such as `Transcriber_loadScript_asStream_asTool` and `Translator_loadScript_asStream`. Their renderers select today's separate streaming factories through `streamingFactory`; remove that temporary selection when the native Casai `.asStream` API lands. `Translator.js` and `Translator.cas` cover both modes. The complete examples target the planned API and carry `status: 'planned'`, a notice and a code comment; streaming examples remain executable. Remove Translator's planned marker and enable full type/runtime verification when its complete operation is implemented.
- Retain LLMAgent streaming examples for each source choice already represented. At A, use finite PCM directly for `Translator`/`Translator_asStream` and PCM-returning preparers for script/function/loaded-script entries; remove the temporary hand-written chunking helpers once byte admission works. At B, replace the reserved script example with WAV preparation, the function example with MP3/native conversion, and the loaded-script example with another supported recording, including their streaming counterparts. Keep one example per derived modifier ID and explanations in comments. Until A lands, keep the existing bounded stream examples. Hide unsupported combinations.
- At A's acceptance, type-check all examples without installing native binaries. Until complete Translator exists, its explicitly requested planned examples receive syntax, source-sharing and streaming-counterpart checks; no fake implementation or declaration substitutes for future API verification. All currently implemented examples remain type-checked and executed. At B, exercise native-converter examples with the same test-boundary fake used for converter tests, and run real conversion only in the optional integration check. Do not skip implemented examples or require B's not-yet-defined helper names for A's acceptance.
- Keep descriptions short and plain in `matrix.js`, explanations in code comments, and secondary `.cas`/`.cat` source in returned file records with names and languages. Preserve unrelated edits. Add no HTML/UI work.
- The user's 2026-11-10 decision replaces authored Markdown permutations with one JavaScript renderer per component. Inline and loaded modes reuse the same plain resource; Cascada source is not a second interpolation template. Preserve grouped choices, `requires`/exclusions, stable scenarios, `useTools`, named `.run()` and component-specific options during the audio migration. `render()` produces only the requested selection. The maintained `npm run test:matrix` fixture generates current valid combinations in ignored cache files, type-checks them and executes SDK mocks from a fresh checkout.
- Preserve the implemented rule extension: `requires` accepts a requirement map or a list of alternative maps, any one of which enables a choice. Within each map, allowed choices are ORed within a group and groups are ANDed; `null` means no selected choice. Transcriber tool admission uses `[{ stream: [null] }, { source: audioSources }]`: complete mode or a preparer. Component entries declare their groups, dependencies, exclusions and notices directly; the shared code has no component-name branches. LLMAgent and SpeechGenerator retain their stream/tool exclusions. Visibility and dependent-choice clearing use the same rules as rendering validation; selection updates maintain a valid selection without repeated full validation.
- Preserve choice-level `experimental` notes on SpeechGenerator/Transcriber `asStream`, leaving their complete modes unmarked. Keep Translator's component-level note, since both translation modes depend on the experimental SDK operation. Experimental status is separate from the complete mode's planned availability. LLMAgent streaming remains unmarked. Check the metadata scope as well as generated code.
- The Context description and example are now present in the catalog and `Context.js`. No Markdown index or description anchors remain to repair. Check catalog/resource links and derived IDs when migrating names.

When retiring public modules, check build output and the package's `./dist/*` export path: stale generated files must not leave old APIs accessible. Rebuild/clean only the verified project output directory as needed.

### 6. Verify behavior, types and consumers

Extend focused existing mock tests: `tests/ComponentCalls.unit.test.ts`, `tests/ModifierInheritance.unit.test.ts`, `tests/ComponentContracts.unit.test.ts`, relevant `LLMComponents`/`Streams` cases, and existing type-safety/declaration fixtures. Add narrowly scoped cases only where current files do not exercise the changed boundary.

| Boundary | Evidence required |
| --- | --- |
| Dispatch | New factory paths call the correct native operation exactly once; ordinary speech/transcription retain their native complete operations, while ordinary Translator collects its one native streaming execution |
| Source composition | Supported default, inline, function and loaded sources work through shorthand and `.run()`; unsupported choices remain unavailable |
| Configuration types | All registered families and standalone/inherited Config retain one-shape admission; unrelated fields and incompatible complete/live settings fail, while compatible fragments remain usable |
| Configuration runtime | Invalid raw flags and unsupported Casai streaming/tool modes fail across all component owners; preserve native unknown-option delegation |
| Inheritance | Parent and Config chains retain streaming/tool/source modes, including empty child configurations, source overrides and undefined rules; effective settings must fit the selected operation |
| Native contracts | Mock SDK requests/results preserve formats, metadata, callbacks, streaming error parts and final promises. Error-part-plus-success still succeeds in complete Translator and transcription tools; missing finish/output and transport errors retain native failure behavior |
| Recorded translation | Byte/stream parity, reusable configured/inherited/prepared bytes, fixed bounded chunks, one SDK call, stream-before-promises ownership, accurate audio/text/metadata and cancellation; reject no valid input merely because the first proposed contract omitted it |
| Audio preparation | PCM/WAV and finite/integer-stream conversion work without node-av; test 48-to-24 and 48-to-16 kHz against whole-buffer SDK output, odd-offset views, split samples and every EOF remainder. Test metadata, clipping, duration/tail, preflight, lazy readers, cancellation/error cleanup and unsupported ratios. Verify selected-path metadata for local, SDK and native preparation before any read, including pass-through and local sample adaptation; preserve native preference, absent-package supported fallback and installed-load/decode errors with fakes. Run real conversion separately |
| LLMAgent methods | Ordinary and streaming defaults retain both `.generate()` and `.stream()`, Agent/UI-helper compatibility and existing `resume()` behavior; no new streaming tool form |
| Live inputs | Fresh-stream and repeated-identity behavior survives across renamed families, including pre-dispatch cancellation/preparation failures |
| Tools | Prepared streaming transcription accepts bytes or streams through direct calls, SDK descriptors/binding and injected helpers; its projection is preserved and unsupported combinations fail |
| Types | Valid calls and invalid neighbors cover required settings, callbacks/preparers, config annotations, existing unions, distinct audio operation shapes and both optional-property modes; supplied flags cannot match the wrong branch |
| Public consumers | Named imports and `create` agree; main-entry components/helpers and emitted types work without node-av. Build and execute ESM and CommonJS Node bundles: main entry without externalizing it, and `casai/node-av` installed and absent/externalized paths. Verify `casai-source` resolution, absent-peer build/lint and real-type compilation without the shim. Retired names/paths and internal ambient declarations are absent from the package |
| Examples | Run `npm run test:matrix` to check catalog/renderer/resource integrity, option rules, availability and experimental-note scope; type-check and execute implemented snippets with SDK mocks, and check syntax and shared sources for planned Translator examples. A's acceptance requires full checks for those examples too. Include Context, loaded sources, prepared streaming transcription tools and LLMAgent streams |

In particular, test `Config({ streaming: true, outputFormat: 'mp3' })` as an invalid neighbor to streaming speech with its native format object, including fields split across parent/child fragments. Also retain a valid fragment with live-only fields completed by `.asStream`, proving that discriminated checking has not made reusable fragments complete configurations.

Extend `tests/fixtures/phase2-package-consumer.cjs` rather than building a second isolation harness. Add retired Streaming* modules and the internal ambient shim to removal assertions, assert `node-av` is absent and exercise mock-backed PCM calls/helper declarations. Keep `--engine` support for the unpublished Cascada candidate. Build and execute both ESM and CommonJS Node bundles for main versus native entry; successful bundling alone is insufficient evidence. With node-av externalized, cover absence, an installed usable module, a missing installed entry, a missing transitive dependency, initialization failure and conversion failure in both formats. Only top-level absence selects fallback, with no input consumption during selection. Declare the bundler directly as a pinned devDependency (currently esbuild 0.28.2 is present only through tsx), instead of relying on that transitive installation.

Keep `node-av` out of ordinary contributor/CI installation. Use the internal compile-time declaration and a fake native module at the test boundary for default-suite conversion/loading/cleanup coverage; do not expose a public testing injection API. Extend c8's explicit include paths if audio code lives in a new directory, retaining existing thresholds. The optional native integration check installs a pinned package in isolation, type-checks the actual adapter with its real declarations and no shim, and exercises real fixtures. It supplements rather than replaces mock coverage.

Use focused mutations to show that runtime tests detect wrong-operation dispatch, lost inherited streaming, leaked/overridable streaming controls and incorrect tool admission. Type mutations must catch weakened one-shape checks and unrelated fields. Reuse existing native probes rather than retesting unrelated SDK behavior.

Follow [AGENTS.md's test and compiler rules](../AGENTS.md#tests) and [test commands and performance](../tests/README.md). Compare source/declaration diagnostics and compiler cost with the baseline and existing budgets.

Validation order:

1. Selected mock files through `npm run test:file -- <files>` and focused type checks while implementing each family.
2. `npm run test:matrix` for generated matrix examples; extracted guide examples and declaration-consumer fixtures through the existing type checks.
3. `npm run check` once the complete change is integrated, covering type checks, `test:matrix`, lint and mock coverage.
4. Installed/bundled consumer verification and applicable mutation checks, reusing successful evidence already covered by the final gate.
5. Opt-in `test:live` recording cases for both Translator and streaming Transcriber with finite bytes before claiming recorded-provider compatibility. Include representative multi-sentence audio with recognizable beginning/end content, check transcript/translation tail and native finish behavior, elapsed time and sending rate. For transcription, record the observed relation between the single commit and completion/item events rather than assuming one item covers arbitrary recordings. Verify provider limits separately; these cases establish no unlimited-duration guarantee. Preserve SDK close/drain handling and add no speculative pacing, extra commits or multi-item collection. The naming migration and this documentation review need no paid calls.

Follow [the review process](review-process.md): inventory the whole public surface, trace downstream consumers, compare native behavior, and test interactions and meaningful mutations. Record findings and process improvements. After corrections, complete a subsequent full review pass with no important unresolved findings before declaring implementation complete.

## Completion criteria

- The three replacement APIs and supported source/tool combinations work through named imports and `create`.
- Inheritance, `.config`, shorthand, `.run()`, callbacks and emitted types agree on the selected operation.
- All component families and Config retain exact shape-based type admission. Casai-owned streaming controls are enforced at runtime without changing the native SDK validation policy.
- Deliverable A preserves native execution/tool behavior, adds shared byte normalization and completed Translator, and keeps all PCM components usable without `node-av`. Native error-part and completion semantics are unchanged.
- Deliverable B provides main-entry PCM/WAV helpers and finite/integer-stream SDK conversion, plus isolated native-preferred conversion with supported absent-package fallback. Absent-peer builds/bundles, unshipped internal types, real-package type checks, documented quality/costs/platforms and mock/native evidence pass. Its completion is tracked separately from A.
- Old public names are removed from active declarations, package output, guides and examples; historical records remain intelligible.
- The matrix includes `.asStream`, valid combinations and working embedded sources.
- Required checks and the final complete review pass succeed, with native limitations and any external release blockers accurately recorded.
