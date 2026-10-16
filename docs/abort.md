# Cancellation and Timeouts

Status: native SDK cancellation remains available. Shared invocation deadlines and automatic nested propagation belong to [Phase 7: Async Call Context and Deadlines](plan.md#phase-7-async-call-context-and-deadlines). They require Cascada's async call context, developed together with its telemetry foundation. They do not require native Script/Template abort support or Phase 6 streaming.

## Before Async Call Context

- **Delegate SDK cancellation.** Signals belong to individual invocations, not reusable configuration. Reject constructor `abortSignal`, including inherited settings; accept it on LLM `.run()` and SDK methods. Forward it and the complete SDK `timeout` setting unchanged. Generator tool adapters pass their SDK tool-call signal through `.run()`. The SDK owns its timers, provider/tool cancellation, and cleanup, including its native limitations for tools that ignore cancellation. Its timeout starts at SDK execution; it does not include preceding Casai schema work or rendering. Native generation can return normally when cancellation occurs during tool execution and a stopping condition ends the loop; a cooperative tool's abort becomes a tool error. Preserve this [SDK limitation](plan.md#output-availability-and-failures), applying ordinary final-step `value` eligibility without a separate abort listener.
- **Keep JavaScript cancellation cooperative.** Function callbacks and function preparers can receive an explicitly supplied signal and forward it to supported operations such as `fetch`. Await the callback normally. The timeout races described below wait for Phase 7.
- **Keep the current scope clear.** Script/Template `.run()` gains named inputs in Phase 2. Their timeout settings and Function timeouts arrive in Phase 7. Native Script/Template abort support is a separate engine capability; explicit cooperative JavaScript signal forwarding does not need it.
- **Await Cascada preparation.** Before Phase 7, await rendering normally, then check the caller's signal before SDK dispatch. Cancellation cannot stop that render or calls it launches. Without async call context, early rejection would leave nested calls without an inherited deadline.
- **Do not infer a call tree.** Script-to-script and nested model calls are not tracked. A root signal does not automatically reach children. Direct SDK-to-JavaScript tool signal forwarding is supported; engine and automatic nested forwarding wait for the upstream contract.
- **Preserve native result behavior.** SDK views retain their cancellation/event contracts. LLMAgent `value` rejects terminal execution failures. `messageHistory` follows native `responseMessages` availability and rejection, without a separate success check; available partial or earlier messages are not proof of success or safe continuation. Breaking one SDK consumer does not implicitly cancel the whole execution.

## Phase 7: Async Call Context and Deadlines

This phase intentionally changes the meaning of an existing numeric `timeout` or `timeout.totalMs` from an SDK-execution budget to a whole-invocation budget. Its release notes and migration guidance must call out that preparation now consumes the same budget; applications may need to increase existing totals. Do not introduce part of this change in an earlier phase. Non-total SDK limits retain their native meanings.

### Inherited End Time

The propagated budget is an absolute end time, not an abort signal. At invocation entry, resolve the effective total timeout from configuration and call settings using the existing override rules, then compute:

```text
endTime = min(parent.endTime, invocationStart + effectiveTotalTimeout)
remaining = max(0, endTime - now)
```

A missing parent deadline or local total timeout supplies no bound. With neither, there is no deadline and no deadline timer. Use the same upstream clock basis for all calls. A child can shorten its inherited budget but cannot extend it. Do not mutate the parent's context or shared timeout configuration. Numeric timeouts and `timeout.totalMs` cover asynchronous schema processing, loaders, rendering, hooks, execution, and a returned live stream's execution lifetime. Three seconds of preparation under a ten-second total leave seven seconds; dispatch and stream return do not restart the clock.

### Cascada Async Call Context

Cascada supplies one async call context shared with its telemetry foundation. It carries the end time and parent/call identity, giving telemetry a call tree and each call its ancestor stack. It must follow Script-to-Script calls, Template calls, SDK tool callbacks, and ordinary JavaScript callbacks across asynchronous work. Concurrent siblings get separate child contexts. Function implementations can query the current end time and pass state through the supported context API without threading execution arguments through every call. Application/schema context remains separate.

Use this upstream mechanism; do not add a Casai call tracker or a mutable global current-call stack. The context API names are to be taken from Cascada when available. The prerequisite is propagation through all these boundaries, not the finished telemetry reporting UI or usage aggregation API. Context must also remain associated with work that continues after a timeout and with returned stream producers/iteration: returning to the caller must not let that work start fresh, unbounded child calls.

### Minimal Invocation Handling

1. **Enter the child context.** Read the ambient parent, compute the end time, and run preparation and execution in the child context. Reject an already-expired call before schema callbacks, rendering, or backend dispatch. Recheck before dispatch after asynchronous preparation. Add timeout settings to Script/Template and Function through the normal invocation resolver.
2. **Bound the wait where needed.** For Function, Script, and Template, race asynchronous completion against the remaining time when there is a finite deadline. This is acceptable before Cascada can abort execution, provided async context propagation is available. Cancel the race timer when the operation settles, handle late rejection, and never publish a late result as success. Arbitrary JavaScript callbacks and asynchronous preparation have the same limitation.
3. **Adapt at the SDK boundary.** Derive a deadline signal from the remaining time only where the SDK needs one, combining an explicitly supplied caller signal there when needed. Do not require every invocation to create or carry an `AbortController`/signal. If that signal enforces the total deadline, omit only the SDK total timeout already covered by it; preserve step, first-chunk, chunk, and tool limits unchanged. Keep original failure reasons and dispose boundary-owned timers/listeners when the actual SDK execution ends.
4. **Retain execution lifetime.** Returning an SDK result or a native live stream does not complete its execution or erase its deadline. Use the native lifecycle to retain context and enforce the deadline until execution completes, fails, or closes. A still-running producer must not publish post-timeout output as success. Already-completed results and buffered output remain readable after the deadline; do not time out replay or consumption of completed SDK results. Closing one shared reader must not dispose unrelated readers or a source owned elsewhere.

Keep this logic small and local to the existing invocation paths. Share only concrete repeated calculations or cleanup. Do not restore a generic `createInvocation` scope that requires an abort signal, duplicate the SDK's execution lifecycle, or create timers for unbounded calls. An explicitly supplied cancellation signal remains a separate cooperative control; it is not the inherited deadline or a reason to change configured-signal rules.

### Timeout Versus Interruption

At the end time, a race rejects the pending call. It cannot stop the underlying Function or, before native abort support, the Script/Template render. That work may continue ordinary computation or external effects. Its nested Casai calls still inherit the same end time: active calls enforce their own deadline, and new calls reject before dispatch. SDK-backed calls use native signal cancellation with the SDK's existing cooperative limitations. A direct external operation that ignores cancellation remains outside this guarantee.

When Cascada adds native abort, connect it to this same deadline and its owned-work cleanup so rendering can actually stop. This strengthens interruption without changing the deadline/context contract and is not a prerequisite for Phase 7's races. Preserve native complete-value and stream failures; a timeout must not turn buffered partial output into a successful final answer. Usage already incurred remains reportable, including work that outlives the caller's wait.

### Verification

Use deterministic local tests for inherited end times with and without local timeouts, earlier-parent/earlier-child limits, one preparation/execution budget, expired-entry and post-preparation dispatch checks, and concurrent sibling isolation. Cover nested Script/Template/Function/tool calls, querying context from JavaScript, and late-running callbacks attempting child work after the caller has timed out. Verify that races reject promptly while documenting continuing execution, handle late rejection, and clear their timers. Check SDK boundary signals, native abort reasons, unchanged non-total limits, returned-stream deadlines/context, and cleanup through completion/failure/closure. Actual engine interruption tests are added when that capability exists.

## Limits

Arbitrary JavaScript and external operations still need to cooperate with cancellation; synchronous JavaScript cannot be preempted by a timer and can delay timeout delivery. A rejected call is not proof that its underlying work has stopped. The async call context foundation is shared with telemetry; broader telemetry features are recorded in [future.md](future.md).
