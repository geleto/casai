# VoiceAgentClient implementation contract

Work in progress. [Phase 7](plan.md#phase-7-voiceagentclient) owns this design and its acceptance checks. The [matrix](matrix/README.md) documents the selected API; its work-in-progress marker remains until implementation and verification pass.

## Purpose and native ownership

Provide a stateless reusable browser voice client that follows Casai's common interface and is directly composable from browser-hosted Cascada Script. Each call returns its own stateful native session handle; applications may pass that handle between scripts and UI callbacks. The component never stores a current session or conversation. Browser applications may use vanilla JavaScript, React, Vue, Svelte or browser-capable desktop renderers. UI-library independence is the default; native SDK compatibility is retained where contracts match, without building UI wrappers for every component.

The [Cascada/browser analysis](voice-agent-client-review.md) establishes this integration with a real Chromium/native SDK/precompiled Cascada probe. Browser support is an existing Cascada capability; current package resolution details are upstream release work, not a new Casai execution runtime or a dependency on future Cascada streaming channels.

Build a concrete adapter over the installed SDK's public `Experimental_AbstractRealtimeSession`. Reuse native connection, microphone, playback, protocol, tool-call, error and cleanup behavior. Casai adds component construction, invocation-local options and state subscriptions, not a transport, conversation loop, state reducer or retry runtime. Keep experimental dependency status visible.

## Construction and calls

```ts
import { VoiceAgentClient } from 'casai/client';

const support = VoiceAgentClient({
  model: browserModel,
  api: { token: '/api/voice/setup' },
  sessionConfig: { voice: 'alloy' },
  onToolCall: handleApplicationTool,
});
const session = await support();
// Equivalent: await support.run();
// Native per-session options may be replaced through support.run({ ... }).
const unsubscribe = session.subscribe(() => render(session.getSnapshot()));
render(session.getSnapshot());
// Connect from application/user interaction, subject to browser permissions.
await session.connect();
// Observe status === 'connected' before readiness-dependent commands.
// connect() itself can return while the native handshake is still pending.
// Graceful end, then application teardown:
await session.close();
unsubscribe();
session.dispose();
```

- `VoiceAgentClient(settings, parent?)` requires the native realtime `model` and `api` in the finished configuration, possibly inherited. Plain compatible Config fragments may remain incomplete. Reject source/tool/stream modifier metadata. There are no positional source/context arguments, source preparers, `.asStream`, `.asTool` or Casai tool registry on the client.
- `client()` and `client.run(overrides?)` return promises for a new, independent, initially disconnected session. Support native session-option overrides except the fixed model. Use ordinary whole-value replacement, including `api` and `sessionConfig`; keep resolved configuration unchanged. No provider call, credential fetch, microphone access or connection occurs during factory or session construction. Native connection failures belong to `connect()` and native callbacks.
- Derive settings and returned native controls from the installed SDK declarations. Preserve option names, callback signatures and capability errors. Do not invent a construction `abortSignal`, application context/schema layer or streaming-delivery flag for a persistent session.
- Export through browser-safe `casai/client`. Keep its runtime graph independent of server factories, Cascada, node-av and UI frameworks. Browser-safe reuse of compatible Config fragments and emitted types must be proven without importing the server entry; factor shared configuration machinery or expose the needed Config builder from this entry if necessary. Do not require applications to import the main entry into a browser bundle.

## State and lifecycle

Expose all native public session controls, plus `getSnapshot(): Readonly<Experimental_RealtimeState>` and `subscribe(listener: () => void): () => void`. Native callbacks remain available. Subscribers receive change notifications and read the snapshot; applications read once after subscription for initial rendering. Use stable snapshot identity between native state changes and the SDK's already-assigned full state when publishing. Do not rebuild state from events, consume an event stream, deep-copy/freeze native data or imply deep immutability. Snapshots are read-only application views by contract. Ensure extracted store methods work when passed directly to framework store adapters.

The installed session assigns its complete next state before invoking the abstract `setState` hook. Notify from that state without rebuilding it; preserve native ordering/reentrant publications and allow repeated notifications for the same snapshot. No coalescing scheduler is needed. Preserve native hook/callback failure behavior rather than adding a separate subscriber-error protocol. Subscriptions neither connect nor replay work. Each invocation has its own native session and subscribers, although explicitly shared callback closures remain application-owned state.

Native `connect()` is a connection initiation operation: in the inspected WebSocket path its promise settles before readiness. Preserve that behavior. Application observation can resolve a readiness promise from `getSnapshot().status`, rejecting on error/disconnection and unsubscribing when settled. This is a small recipe, not a mandatory session layer, new polling loop or public `ready` promise with a second lifecycle. Use native `sendEvent` when the workflow needs an awaited submission boundary; void native conveniences keep their existing semantics and do not establish provider completion.

Keep native `connect`, `disconnect`, graceful `close`, `dispose`, text/audio input, tool output, capture/playback controls and `sendEvent`, with their actual provider/transport limits. Applications unsubscribe and dispose on teardown. Do not impose a terminal-disposal guard that the SDK lacks or promise ownership of caller media beyond its native contract. A session is a long-lived handle, not a completed conversation result or an async iterable.

## Cascada composition and UI boundary

Configure `voiceClient` in the browser host and pass the callable through Cascada context. Creation in a script is simply:

```javascript
var session = voiceClient()
return session
```

The returned handle is browser-local state passed by reference into later scripts and callbacks in that runtime; it is not a serialized session-resume token. After the host has observed connection readiness, a control script uses native commands and Cascada ordering:

```javascript
var submitted = session!.sendEvent(command)
if submitted is error
  return submitted
endif
return session!.getSnapshot()
```

Use `session!.connect({ capture: false })` for explicit startup and `session!.close()` for graceful shutdown, inspecting their results when failures matter. A `sequence` binding is also available from Cascada. Neither mechanism makes a native void method await provider acknowledgements, grants microphone permission, or synchronizes unrelated script invocations. The browser host coordinates concurrent access to one shared handle and owns its lifetime; different factory calls yield independent sessions. Keep subscriptions/readiness waiting and teardown in the owning host scope. Use `try/finally` there so script failure, early return or close failure still unsubscribes/disposes owned resources. A script returning a handle transfers it to that owner; it must not immediately dispose it.

Precompile scripts with Cascada's build-time API and use the public `cascada-engine/precompiled` runtime in the browser. No import of the Node-oriented Casai `Script` entry is needed. This preserves a small `casai/client` graph while allowing Cascada applications to compose it. The linked Cascada checkout currently needs the same `path`/`events`/`process` compatibility supplied by its browser tests; the user will handle missing upstream packaging. Do not copy test shims into Casai or require a Casai browser compiler, RPC bridge or server voice-session runtime.

`getSnapshot`/`subscribe` provide optional UI support through ordinary external-store adapters. A React recipe may use `useSyncExternalStore`; other libraries use their own subscriptions. No React dependency, component, JSX API, bespoke hook or UI state reducer belongs in Casai. The native SDK `experimental_useRealtime` owns a separate session; do not call it alongside this component expecting it to adopt the returned handle. Keep compatible native controls/callbacks, not a false drop-in hook claim. Cascada invokes controls and reads state without any UI library. Native void callbacks remain void callbacks; do not assume Cascada async callbacks are awaited where the SDK does not await them.

## Backend pairing, transports and tools

Keep the native `api` alternatives: `{ token: url }`, `{ session: url }` for WebRTC, and `{ websocket: url, protocols? }` for a server relay. Inspect the pinned SDK again at implementation; do not copy newer website options absent from that version.

| Application case | Pairing and ownership |
| --- | --- |
| Browser assistant using a short-lived credential | The application token route authenticates/authorizes the user and calls `VoiceAgentBackend.run()`. Its native response is returned to the client session. |
| Browser WebRTC conversation | The application setup route admits public preferences and passes the SDP offer to `VoiceAgentBackend.createWebRTCSession()`, returning the native answer. |
| Local UI actions and private business tools | Native `onToolCall` handles local actions or calls an authenticated application route. That route authorizes the operation and uses backend `executeTool` with the real call ID/name/arguments and trusted context. Map completed undefined values to JSON null for HTTP transport. |
| Provider Live/server relay | Applications own the relay and native connection setup. Keep Live delegation/events distinct from turn-based `onToolCall`; use native event controls where required. |
| Framework UI or multiple independent conversations | Subscribe to snapshots and use the same native controls. Construct separate sessions from the reusable client; UI lifecycle owns teardown. |

Browser configuration contains a browser-compatible model adapter and public preferences, never provider API keys, server tool implementations or trusted context. An ephemeral provider credential does not authenticate an application user or authorize business actions. The application owns routes, authorization and any relay. Native token/SDP fetch and browser WebSocket authentication restrictions still apply; this wrapper adds no custom-fetch/header channel, OAuth system or generic credential refresh. Document native same-origin/cookie and cross-origin limitations precisely against the installed implementation.

## Shared public settings

Recommend a separate explicit public settings module when the application benefits from common defaults:

```ts
import type { Experimental_RealtimeSessionConfig } from 'ai';
export const voicePreferences = { voice: 'alloy' } satisfies Pick<Experimental_RealtimeSessionConfig, 'voice'>;
// Server: spread voicePreferences into backend settings.
// Browser: sessionConfig: voicePreferences.
```

Use native types or a shared public schema for meaningful compile-time/runtime checks. Do not inherit the backend component/config or automatically serialize/project it into the client. TypeScript `Pick`/type assertions do not remove runtime secrets. Keep server instructions, model credentials, tool executors and trusted bindings server-owned. Runtime user-specific preferences require an application-approved response or explicit values; static shared defaults are not session synchronization. This is an optional application pattern, not another Casai config protocol or component.

## Implementation and acceptance

1. Inspect the pinned session class, exported option/state types, its transport/audio modules and tests. Prototype the concrete `setState` adapter, stable snapshots and subscription method binding. Retain a small native comparison for behavior Casai changes.
2. Prove public construction/call/config inheritance types and declaration portability. Reject modifiers, server settings, fixed-model invocation overrides and missing required configuration. Verify the browser entry with clean package consumers and a production browser bundle; no React, Cascada or native/server runtime import may be required by the client itself. Independently verify optional composition with Cascada's supported browser entry and its published packaging.
3. Test no I/O before explicit connect, independent concurrent sessions, unchanged reusable settings, snapshot identity/full-state consistency, subscriptions/unsubscribe, reentrant notifications and callback failures. Compare native close/disconnect/dispose and caller-supplied media ownership; do not create a second cleanup policy.
4. Exercise representative token, WebRTC and relay adapters, native text/audio controls, local/remote turn-based tools and the distinct Live event/delegation path. Use scoped mocked contract checks and browser/native smoke checks where needed, not a certification of every provider/transport combination. Preserve authentication and microphone/autoplay limitations in examples.
5. Update exports, package metadata, matrix reference/examples, user guides and browser/framework recipes. Keep ordinary and `.run()` examples, shared public preferences and backend pairing. Replace documentation-only projected declarations with real production declarations and enable real type/runtime example coverage. Remove the work-in-progress marker only after these gates pass.
6. Promote the scoped browser/Cascada analysis into production acceptance: creation from a script, handle identity passed into another invocation, prototype-method receivers, ordered commands, failure observation, native readiness semantics, host cleanup after script/close failure, independent concurrent factory calls and UI-free operation. Retain the native SDK as the owner of capture/playback and session protocol. UI compatibility is optional and must remain a small adapter over the same session.

Perform a final whole-surface review of construction, calls, native methods, callbacks, state ownership, transports, tools, packaging and downstream consumers. Follow [the repository review process](review-process.md); require a subsequent complete pass without important unresolved findings.
