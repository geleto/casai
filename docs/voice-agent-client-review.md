# VoiceAgentClient Cascada and UI analysis

The [November 27 LangGraph comparison](phase6-7-langgraph-review.md) adds a two-turn browser relay reproduction, a retried backend tool call and a tested Cascada workflow for independently selected speech and language models.

## November 27 SDK correction

Published `ai@7.0.183` submitted the original tool result and an extra generation request after the user had started another turn. The standalone SDK candidate tracks which response owns the outstanding tool calls and checks again when the queued request reaches the transport. The original output keeps its call ID. Two simultaneous tools on the current turn still produce one follow-up. Tests also exercise cancellation, unsuccessful responses, late completion frames, and adapters that first identify a new reply on a content delta. The browser relay checks both the published behavior and the corrected outbound frames. The standalone patch applied cleanly to the pinned SDK revision, and all 298 realtime tests passed in each of the Node and Edge configurations. The public `casai/client` gate remains open until the client exists and the selected SDK release passes the same controls. [SDK patch](../tests/fixtures/ai-sdk-realtime-turn.patch) · [Qualification commands](../tests/README.md#streaming-voice-and-realtime-turn-ownership)

Reviewed 2026-11-14 against the installed `ai@7.0.162` and linked Cascada working tree (`cascada-engine@0.6.2`, HEAD `a32c326a`). The user confirmed that components remain stateless, may return state for later calls, and must be useful through the common interface and Cascada Script. Cascada browser support is established; any missing upstream packaging will be supplied there.

## Conclusion

Keep `VoiceAgentClient` in Phase 7. A small concrete subclass of the native SDK session plus the common stateless factory is sufficient. Browser Cascada can create the session, return it without losing identity, and operate it in later script invocations. Session state belongs to the returned handle. There is no need for a Casai session registry, server audio loop, React runtime, browser Script factory, RPC bridge or new Cascada stream feature.

The earlier assessment that Node-oriented Casai packaging prevented a useful Cascada composition was too broad. It confused the Casai main entry with Cascada's browser execution capability. Browser hosts can import `casai/client` and independently use Cascada's public precompiled runtime.

## Evidence and limits

`node tests/fixtures/voice-client-analysis.mjs` precompiles actual `.cas` source strings, bundles the public `cascada-engine/precompiled` entry and the SDK's public session class for a browser, and executes them in headless Chromium. It requires the linked Cascada development checkout's Playwright and existing browser-test shims; this is a scoped workspace analysis, not a production package test or a fabricated implementation of VoiceAgentClient.

The probe uses a concrete observable subclass of the real SDK session. A controlled WebSocket/model fixture supplies the provider handshake; native session control, state, command handling and browser AudioContext remain in use. It makes no paid call and requests no microphone permission. Results:

- Two concurrent creations from one callable produced independent native session objects.
- A session returned from a script retained its object identity and class methods when passed into later scripts.
- `session!.connect`, awaited `sendEvent`, `getSnapshot` and `close` worked through the actual Cascada renderer. State changed from disconnected through connecting/connected back to disconnected.
- A command after disconnect produced an error observed with Cascada's `is error` branch.
- Native state subscriptions received updates; teardown left zero fixture sockets and zero application listeners.
- `connect()` returned while the native WebSocket handshake was still pending. Observing `status === 'connected'` before command execution was necessary.

The probe does not certify real provider authentication, microphone permissions, autoplay, WebRTC/Live transport behavior or every browser. Those remain native limitations and representative implementation smoke checks. It establishes that the component design can compose through real browser Cascada without a new execution abstraction.

## Contract corrections

1. **Stateless component, explicit returned state.** No current session is retained on the reusable callable/config. Each call returns an independent session handle. Applications pass it between scripts/callbacks and explicitly coordinate shared use.
2. **Ordered calls are not readiness or provider completion.** Cascada `!` sequences method invocation and returned promises. Native `connect` may complete before readiness; native void conveniences do not acknowledge provider processing. Use observed state and native awaited `sendEvent` boundaries for the relevant workflow, without changing SDK semantics.
3. **Cleanup belongs to the owner.** Scripts may return handles or fail before a cleanup statement. Host `try/finally` must unsubscribe/dispose resources it owns, including after close failure. Do not rely on script source order or a bare effect call to guarantee cleanup. Reusing a handle is deliberate state passing, not stateful factory execution.
4. **Optional UI integration stays small.** Snapshot identity and subscriptions support vanilla UI and framework store adapters. No framework-specific implementation is required. Not every existing Casai component has an SDK UI interface: LLMAgent preserves the SDK Agent contract; generated media are ordinary native results; VoiceAgentBackend returns setup data. Native `experimental_useRealtime` creates its own session, so it is not an adapter for this returned handle.
5. **Packaging remains separately owned.** The public precompiled Cascada runtime exists. A plain browser bundle currently encounters `path`/`events` imports and the upstream browser harness supplies shims plus a small `process` environment. The analysis reuses those exact shims. Production must use the supported upstream browser packaging, not embed copied test code in Casai. This is an explicit upstream acceptance item, not a reason to add another runtime.

## Small API and scope

Retain common factory/Config inheritance, ordinary calls, `.run()` and immutable `.config`, with no source/stream/tool modifiers. Keep the SDK controls/callbacks and add only stable `getSnapshot` and `subscribe` accessors. Use native full-state assignment for notifications, without a second reducer, coalescing scheduler or event-to-stream adapter. Browser observation and optional UI rendering share the same handle; no second session is created for a second view.

The [Phase 7 contract](voice-agent-client-plan.md) incorporates these findings and explicit production gates. A subsequent full design pass covered construction, returned state, browser boundaries, Cascada calls/ordering, failure/cleanup, readiness, UI ownership, tools/authentication and packaging. No unresolved product/API decision was found; published browser packaging and production implementation tests remain release gates.
