# Phase 6 simplification review

Date: 2026-11-17. Scope: the implemented Phase 6 contract and the shared configuration, invocation, tool, type and worker code it uses. Public behavior, native provider dispatch and worker responsiveness requirements are unchanged. The retained changes passed verification; the subsequent complete pass found no important unresolved issue or additional simplification with a clear net benefit.

## Changes retained

### One output stream boundary

Native preparation had retained its original public `PreparedAudio` implementation after moving into a worker. It constructed a `ReadableStream`, the worker acquired that stream's reader, and the calling thread constructed another `ReadableStream` for the application.

The [worker](../src/audio/native-worker.entry.ts) now pulls the [native pipeline's](../src/audio/native-pipeline.ts) existing async generator directly. Only the application-facing owner constructs a stream. This removes an internal controller, reader, pull/cancel forwarding and duplicated public-result adaptation. The public cleanup handle and `Symbol.asyncDispose` remain on the public owner. Native handles still stay inside the worker.

Evaluation: less lifecycle machinery, with no replacement abstraction. Native integration retains lazy consumption, EOF, early close, cancellation during a pending input read, source-lock release, and cleanup after failed dispatch. Keep this change in Phase 6.

### One encoded packet writer

File copying and conversion had separate packet loops with the same timestamp/duration accounting, byte output and packet disposal. Conversion also manually fed individual frames and separately flushed the encoder.

Both branches now produce a packet iterable for one writer. Conversion composes the installed decoder and encoder iterators. node-av owns disposal of frames passed to the encoder and drains it when the decoder's native null EOF marker arrives. Casai retains only its decoded-duration limit before handoff; a frame rejected there is disposed locally because the encoder never receives it.

Evaluation: copying and conversion now have one owner for encoded-duration accounting, packet writes and disposal. The distinct decoded limit remains explicit. Native round trips, compatible alternatives, codec padding, timestamp-free drains, encoder constraints and size limits pass. New mutations remove EOF propagation and rejected-frame disposal independently; the corresponding native tests fail. Keep this change in Phase 6.

### An ordered worker protocol

The native host maintained request IDs and a map of pending RPC calls, although input allocation, opening and output reads were always sequential. The public stream serializes pulls. Only close overlaps those operations, and its completion must already wait for worker exit to guarantee native cleanup.

The [native host](../src/audio/native.ts) now keeps one pending operation. Close is an interrupt followed by awaiting worker exit, without a separate request ID or acknowledgement. This removes the unused concurrent-RPC model rather than adding a queue or malformed-message defenses.

Evaluation: the protocol now states the actual invariant. Abort during input copying/opening/reading, original source errors, native error fields, repeated close and graceful worker lifetime remain covered. Keep this change in Phase 6.

### One source normalization boundary

The public native owner already resolves URLs, normalizes ArrayBuffers to byte views and validates uploaded chunks before worker transport. The private pipeline now accepts that narrower source type. It no longer repeats ArrayBuffer conversion, source-shape rejection or stream-chunk validation. Required-target validation stays at the public boundary. Unused native metadata fields were removed from the private structural interface.

Evaluation: fewer representations and repeated checks inside a trusted handoff. This narrows the private contract only. Public validation and the uploaded-media protocol restriction remain. No checks or tests for forged worker requests were added. Keep this change in Phase 6.

## Alternatives rejected or reverted

| Candidate | Evidence and decision |
| --- | --- |
| Replace custom native input I/O with node-av's Node readable bridge | Inspected the installed `IOStream` bridge and tested `Readable.fromWeb(...)[Symbol.asyncDispose]()` on Node 24.14.1. Cancellation ran, but the original Web stream remained locked. The bridge also converts source failures to a native I/O error. Recovering the existing ownership/error contract would require another wrapper. Rejected before changing production code. |
| Narrow the native decoder/encoder method signatures to iterable-only inputs | Implemented, then the real-export compatibility fixture failed: the native methods also accept individual frames/packets and null, and narrowing disrupts structural assignability. Restored the native signatures and verified the fixture passes. The unused metadata-field removal remains. |
| A generic PCM/native worker framework | Native shutdown must wait for safe native cleanup; PCM workers execute JavaScript and can be terminated. A shared lifecycle abstraction would need policy callbacks and obscure the different owners. Retain the small separate implementations. |
| A generic speech/translation collector | Their shared loop is small; speech additionally validates format consistency and returns a native generated-file shape, while translation has different final values and permits empty translated text. A strategy abstraction adds configuration and type plumbing without removing those distinctions. Retain the concrete collectors. |
| Collapse Config and component modifier construction | Config is incomplete and has no operation/main input; a component definition owns required settings, source admission and execution. Forcing one builder would add dummy fields or configuration switches. Retain the existing shared metadata/merge laws and small separate builders. |
| One metadata object for source/tool/stream selection | Ordinary spreads must retain each independent selection. Replacing the symbols with one object changes that merge behavior and complicates portable declaration inference. Retain the structural keys. |

The five authored native modules contain 33 fewer lines in total. This is secondary evidence: the useful reduction is one fewer stream lifecycle, one packet writer and one ordered request protocol. Generated worker source is rebuilt from those modules. Tests add a real native ownership check rather than mirroring the new control flow.

## Complexity that remains necessary

- **Native interruption versus release.** Closing an input must unblock pending reads before waiting for generator completion. Final disposal is idempotent and also runs after EOF and opening failure. Collapsing these into one unconditional cleanup sequence can deadlock or dispose resources while native work still uses them.
- **Finite versus streaming PCM workers.** Streams own an ordered worker and bypass the finite queue. Combining the paths would introduce queue delays or require another scheduling policy. Shared output and the unshared worker join cover different runtime capabilities; neither assembles audio on the calling thread.
- **Borrowed-input staging.** Bounded copies, task yields and worker allocation preserve caller-owned memory and responsiveness. Shared inputs avoid that copy when available. Removing these boundaries would change the explicit responsiveness contract.
- **Decoded versus encoded duration.** The decoded limit stops excessive conversion before frame handoff; encoded packets include codec padding and native drain output. Copying uses inspected metadata plus packet duration, without promising packet-by-packet sample-layout certification.
- **Errors across isolates.** Rejection state uses a wrapper so an explicit `undefined` rejection remains distinguishable from no failure. Native names/code fields and the original uploaded-source error need their existing transport handling.
- **Model/resource boundaries.** Configured `.loadsAudio.asTool` sources remain trusted application resources; model payloads do not replace them. Uploaded data cannot open child resources unless trusted options authorize that. These handle real untrusted inputs, not corruption of private interfaces.
- **Live input identity.** The small WeakSet prevents repeated Casai handoff of the same consumable stream without reading it. This is an accepted public lifetime rule, not a brand registry for authenticating internal control objects.
- **Type alternatives and declaration metadata.** File/raw transcription, complete/streaming speech, inherited or conditional delivery, schema input/output and ordinary/tool values have genuinely different contracts. Erasing those alternatives or rebuilding them through more generic type machinery would weaken calls or increase inference cost.

## Review coverage

The initial inventory and the subsequent pass cover:

| Surface | Contracts traced |
| --- | --- |
| Transcriber, Translator, SpeechGenerator | Ordinary and `.run()` calls, `.asStream`, tools, shorthand, native request selection, collected finals, format checks, cancellation and model-facing projections |
| Config, source modifiers, factory/runtime preparation | Independent inheritance/spread metadata, removed flags, source resets, incomplete fragments, configured-resource tools, schema-parsed input, private settings and SDK stripping |
| Public types and consumers | Native setting alternatives, call-required selectors, callbacks, annotated configs, union modes, inferred/emitted declarations, main/native exports and guide/matrix contracts |
| PCM/WAV and shared audio helpers | Finite/streaming worker ownership, copy budgets, shared/unshared output, numerical compatibility, native generated-file views and caller-owned input |
| Native preparation | Public validation and normalization, private protocol, probing/seeking, uploaded child-resource restrictions, track selection, copy/conversion, limits, errors and shutdown |
| Packaging and execution owners | Conditional Node/browser imports, generated worker code, real optional-peer interface, minified ESM/CommonJS consumers, SDK stream ownership and linked Cascada execution |

Installed SDK and node-av implementations were inspected at their owning functions, including SDK final-result consumption and node-av's iterator disposal/EOF behavior. The follow-up pass checks the changed lifetimes against downstream consumers rather than relying only on local line reduction.

## Verification and disposition

- Native interface compatibility: passed after restoring the native method signatures.
- Native integration: 21 cases pass in the mutation control, including the added decoded-frame disposal case.
- Native fault injections: all 11 caught, including missing EOF propagation and rejected-frame disposal.
- Types/build/declarations: complete `test:types` passes, including both optional-property modes and guide consumers.
- Full local coverage: 1,921 tests pass; 99.58% lines/statements, 100% functions and 96.31% branches, with the existing separate result-augmentation gate passing.
- Matrix: 1,571 reference/browser selections checked and 1,458 current examples executed with SDK mocks; no paid calls.
- Minified Node ESM/CommonJS bundles: both public entries execute against the native peer under source and emitted conditions.
- Chromium: source and emitted consumers pass, including Cascada composition, shared/unshared PCM workers, blocked-worker/CSP behavior and native-unavailable errors.
- Generated worker sources, local documentation targets and whitespace checks: passed. Focused typed lint and fresh whole-project lint pass; the whole check took 166.4 seconds and retained every rule and file.

All retained simplifications belong in the current phase. There is no unresolved API decision from this review. Native-worker pooling remains deferred performance work, not a prerequisite for these structural reductions. Coordinated Cascada publication/dependency updates and native platform/distribution gates remain release work. Provider payloads and model-facing results did not change; this review does not claim new paid-provider evidence.
