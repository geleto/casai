# Future Features

Features recorded for later. They are not scheduled, and the descriptions are directions rather than agreed APIs. The current plan is in [agents-design.md](agents-design.md).

- **Telemetry.** Cascada will publish telemetry on one global channel that all nested calls report to: model usage in tokens, timing, request counts, and the call tree.
- **Context channel.** A second global channel passes call state from each component to the components it calls: the abort signal, the deadline, and the call's place in the call tree. See [abort.md](abort.md).
- **Async context tracking.** Both global channels need it to follow calls through plain JavaScript, such as the components a Function callback calls.
- **Telemetry for any component call.** Read the telemetry of one call, including its usage, time, number of model requests, and call stack, for any component. Template, Script, and Function return plain values today, so this needs a form that leaves those values unchanged, such as a callback or separate metadata access alongside the agreed `.run()` method. Decide once telemetry exists.
- **`onUsage` on every component.** Report the tokens used by a call and everything it ran. LLMAgent already reports its own call's tokens through the SDK's `usage` fields and `onEnd` callbacks. Template, Script, and Function get `onUsage` once Cascada telemetry works.
- **Cancellation and timeouts across nested calls.** Per-call `.run()` settings are agreed; implement automatic signal/deadline propagation, configured limits, and owned-producer cleanup; see [abort.md](abort.md).
- **Progress for streaming tools.** A streaming Casai tool could report SDK preliminary tool results as cumulative snapshots, the text or elements so far, so chat UIs show tool progress. The final result stays the completed value.
- **Out-of-order streaming.** Delivering stream elements before earlier positions are ready; see [Phase 5](agents-design.md#phase-5-out-of-order-streaming).
- **Live VoiceSession.** Separate from Phase 3 `VoiceSessionSetup`: an audio stream in and session events out, for telephony or server-hosted agents; see [transcription and voice](agents-design.md#transcription-and-voice).
- **Coded components behind the SDK chat protocol.** A custom `LanguageModelV4` provider could let a Template, Script, or Function serve SDK UI helpers with real SDK results. Assess it when an application needs it.
- **Background jobs and resumable operations.** Long-running work needs explicit execution handles rather than state in shared configuration; see [shared infrastructure](agents-design.md#shared-infrastructure-and-capability-boundaries).
