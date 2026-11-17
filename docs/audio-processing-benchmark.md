# Audio WebAssembly and worker experiment (2026-11-16)

## Bounded input preparation and shared reuse (2026-11-17)

A calling-thread copy audit found that the previous per-buffer limit did not bound a complete preparation. With a warm worker, one 64 MiB chunk copied at most 1 MiB between task yields, but 64 chunks of exactly 1 MiB copied all 64 MiB before yielding. The observed largest timer gaps were 4.7 ms and 16.3 ms respectively. These were input preparation copies; final joining already ran in the worker.

Each preparation now owns one copy budget across all chunks or resampling partitions. Copy steps are at most 256 KiB and yield after 1 MiB total or about 1 ms, whichever comes first. Uneven chunks use only the remaining byte budget; tiny, empty and base64 chunks still hit the time budget. Cancellation is checked between steps. Node uses `setImmediate`; browsers use `scheduler.yield()` where available, otherwise a one-shot `MessageChannel` whose ports close before resuming. Neither path spins microtasks or waits indefinitely for idle/background priority.

Large staging allocations also run in the existing worker. The empty owned buffer transfers to the calling thread for bounded filling, then back to its worker for processing. Small allocations fit within the copy-step limit. Already-shared input needs neither staging nor transfer: workers read its exact view directly. Inputs must stay unchanged through processing; native streaming inputs must stay unchanged through consumption/cancellation. `readWav` may return a view into shared input. Shared parallel output and the unshared worker join retain their existing completion and ownership rules.

This consolidates preparation and transfer-list ownership for finite PCM/WAV/base64/collection operations. Resampling prepares its partitions sequentially under the same budget, then computes them in parallel. Native finite input uses the same preparation helper and its existing invocation-owned worker. Native uploaded streams still cross in tight 64 KiB chunks (ordinary transferable-stream chunks are cloned); shared chunks reuse their backing memory. The installed node-av buffer reader uses views, and native frame copies, conversion and encoded-file assembly execute inside the native worker. No second native executor or new dependency is needed.

The budgets constrain Casai's byte-copy work, not every source of event-loop latency. A copy step cannot be preempted; operating-system scheduling, GC and runtime serialization of native string messages can still cause pauses. Main-thread final joining remains excluded. The maintained regression checks both byte and time bounds, allocation ownership, shared views, actual timer/workflow progress, browser task fallbacks, and native cancellation before media opening.

Verification of this revision:

- All 1,921 local tests passed under coverage: 99.58% lines/statements, 96.31% branches and 100% functions, including the separate augmentation gate. All 20 LGPL native integration tests passed.
- Source, build, emitted-consumer, exported-declaration and exact-optional type checks passed. The matrix checked 1,571 selections and executed 1,458 examples with SDK mocks.
- Source and emitted Chromium bundles passed with isolated/unisolated memory, scheduler/MessageChannel task yields, CSP denial, missing workers and resource cleanup. Source and emitted Node ESM/CommonJS main/helper bundles passed against the native backend.
- Thirteen affected PCM mutations were caught, with passing controls: aggregate/time budgets, task yielding, input/shared-output allocation, shared-input reuse, borrowed-buffer ownership, partition phase, worker count, shared-output selection, failure propagation and active/idle process lifetime.
- Focused lint, full repository lint (183.1 seconds), worker-bundle freshness and whitespace checks passed. Existing assertions, coverage thresholds and compiler budgets were retained.

A subsequent review of the PCM, completed-result and native input paths found no further substantial issue in this change. The finite queue and native invocation lifetime remain deliberate; release publication/platform requirements remain separate. Provider requests and payloads did not change, so this revision made no paid calls.

## Shared output for parallel PCM (2026-11-17)

Responsiveness is a requirement, independent of throughput measurements: heavy audio processing and completed-result joining stay off the calling thread. The current comparison below measures two worker-based paths. Main-thread joining is not an implementation candidate, even if a timing comparison favors it.

Parallel finite resampling now allocates one exact-size `SharedArrayBuffer` in a worker and gives each worker a disjoint output view. The output length is known before processing, so no growth protocol is needed. Workers write their samples directly into those views; the existing completion messages and `Promise.all` gate publication of the finished `Uint8Array`. A small initial allocation job replaces the final join job, and no output copy is needed. Single-worker and streaming results continue transferring their owned buffers.

Sharing is automatic in Node and isolated browser contexts. Browsers without shared-memory support retain the existing worker join; there is no main-thread join or inline failure fallback. Shared buffers are passed in messages without a transfer-list entry. The returned byte view can have shared backing memory: the installed SDK's audio converter and Casai's asynchronous PCM/WAV helpers accept it. `writeWav` creates ordinary encoded bytes suitable for `Blob`. [Node shared-buffer messaging](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html#portpostmessagevalue-transferlist), [browser isolation requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements).

This change applies to worker-generated PCM. SDK-produced audio chunks still require copying and worker assembly, and may wait on the finite queue. Native preparation still owns one worker per invocation. Neither remaining behavior was silently replaced by a new pool or result contract.

Run the paired production-path probe with `node --expose-gc --import tsx/esm --conditions=casai-source tests/benchmarks/audio/shared-output.mjs`. It warms both paths, alternates order, and retains the same kernel, inputs and workers; disabling the main realm's shared-buffer constructor selects the existing worker join. On this Windows/Node 24.14.1 machine, five timed conversions of 57.6 MB PCM into 28.8 MB produced a median of **369.6 ms with shared output**, versus **359.0 ms with worker joining**. Timer callbacks continued on both paths, with maximum observed gaps of 24.4 and 25.6 ms respectively. This run does not establish a latency improvement; desktop timings varied substantially. Avoiding the extra 28.8 MB result allocation/copy is structural, and output allocation itself remains off the calling thread. The change does not claim a universal throughput gain.

Node and Chromium tests forbid calling-thread shared allocation and verify numerical output, actual shared-buffer publication, no join job, ordinary single-worker output, the unshared fallback, SDK conversion, WAV/Blob interoperability, responsiveness and cleanup. Mutation checks reject disabled sharing, wrong destination offsets, calling-thread allocation, broken partitioning/ownership, and missing active/idle worker references.

Verification on the completed implementation:

- All 1,919 local tests passed under coverage: 99.58% lines/statements, 96.31% branches and 100% functions; the separate augmentation gate passed. No thresholds were reduced.
- Source, build, emitted-consumer, declaration-export and exact-optional type checks passed. The matrix passed its 1,571 selections and 1,458 current SDK-mock examples.
- All 18 LGPL native integration tests and the installed structural-interface check passed. Source and emitted ESM/CommonJS main/helper bundles passed, as did source and emitted Chromium checks for isolated/unisolated pages, unavailable workers, CSP, SDK/WAV interoperability and cleanup.
- Ten affected PCM mutations were caught, including shared allocation on the calling thread, missing shared output, destination offsets, partitioning, ownership, worker failure and active/idle lifetime. Unchanged controls passed.
- Worker-bundle freshness, whitespace, focused lint and full lint passed; the final whole-repository lint took 292.5 seconds.

A subsequent source/contract review of allocation, ownership, transfer lists, worker lifetime, failure paths and consumers found no additional substantial issue. Native-worker pooling remains deferred, and coordinated Cascada publication/dependency updates remain a separate release prerequisite.

## Completed-result scheduling follow-up

The later [Claude review follow-up](phase6-claude-review-2026-11-16.md) identified significant Node timer delay during bounded borrowed-buffer copying. Forty `setTimeout(0)` yields took about 620 ms on this Windows machine; forty `setImmediate` yields took about 1 ms. That correction used immediate yields in Node; the later aggregate-budget revision above also replaces the browser timer fallback. Heavy processing, joining and base64 encoding remain in workers.

With immediate-yield scheduling, three warm 24 MB joins took 39.3/28.1/34.2 ms through the worker; earlier worker joins took 514–587 ms. These local measurements isolate a concrete scheduling improvement; they do not establish a portable latency target or eliminate transfer-copy and queue costs. A small join behind a ten-minute resampling job still waited roughly 250–275 ms, including any additional worker startup.

Separate chunks are retained during streaming. Completed public byte-array results still need one logical buffer. The scheduling follow-up did not change output storage; the subsequent shared-output implementation above removes the parallel PCM join. Existing borrowed SDK chunks still need copying into completed storage. Inline assembly remains excluded.

Workers are useful for large CPU-bound buffers and keeping the main thread responsive. These measurements do not justify a default WebAssembly backend or automatically creating one worker per logical processor. The initial experiment changed no production code or dependencies. The latest [responsiveness revision](#worker-only-responsiveness-revision) requires workers for PCM/WAV operations, ordered streaming and native preparation; earlier inline decisions below are historical.

## Scope and reproduction

The experiment compares the original synchronous `resamplePcm16` pipeline (retained as a benchmark control) with two benchmark-only implementations: a single JavaScript loop that avoids intermediate Float32 arrays, and a scalar WebAssembly implementation of the same arithmetic. All three use the SDK's linear interpolation and PCM rounding, including its limitations. There is no anti-aliasing filter, SIMD, codec processing, provider call or audio-quality improvement in this comparison. The existing node-av/FFmpeg path remains responsible for native decoding, encoding and resampling; it was not benchmarked here.

Run from the repository root:

```sh
npm install --prefix .cache/audio-wasm-tooling --no-save --ignore-scripts --no-audit --no-fund wabt@1.0.39
node tests/benchmarks/audio/run.mjs --reverse
```

The browser stage uses Playwright from the linked Cascada development checkout, like the existing Phase 6 browser fixture. `--node-only` and `--browser-only` select a runtime; `--reverse` reverses pool-size order. Assemblies, bundles and raw measurements go into `.cache/audio-processing-benchmark/`, including `node-results.json` and `browser-results.json`. No files are downloaded as audio input; deterministic PCM is generated in memory. The assembler is installed only under `.cache`, without changing Casai's dependency declarations or lockfile.

Sources: [runner](../tests/benchmarks/audio/run.mjs), [benchmark and worker control](../tests/benchmarks/audio/core.mjs), [WASM kernel](../tests/benchmarks/audio/linear.wat).

Environment: Windows, Intel Core i5-1135G7, four physical cores/eight logical processors, Node 24.14.1, headless Chromium 149.0.7827.55, AI SDK 7.0.162. Both runtime concurrency queries reported eight. The recorded repeat began at 09:20:57 UTC with approximately 3.5 GiB free memory.

## Method

- Timed inputs: 20 ms, 60 seconds and 600 seconds of mono PCM16, converted from 48 kHz to 24 kHz. The largest input is 57.6 MB.
- Each method has two warm-up samples and five timed samples; the tables show medians. Method order rotates between rounds. Tiny synchronous calls are batched 1,000 times per sample and divided by that count to avoid browser timer quantization. Worker calls remain individual round trips.
- Pools contain 1, 2, 4 or 8 persistent workers. Reported job times include input partition copies, message scheduling, computation, output transfer and final concatenation. Pool startup is measured separately. Node uses `worker_threads`; Chromium uses actual Web Workers.
- Inputs are borrowed: workers receive copies of partitions, transferred with their ArrayBuffers, so the application's input is not detached. WASM times include copying into its reusable memory and copying the result out. A separate kernel-only diagnostic is saved in the raw results but is not used as an end-to-end claim.
- Every measured result is compared byte-for-byte against the actual helper outside the timed region. Additional controls check fractional downsampling, upsampling, very short buffers, unaligned byte views and partition boundaries. Fractional partitions retain global sample position and the adjacent interpolation sample. The unmodified SDK helper is partitioned only at the aligned integer-ratio boundaries used in the timed cases.
- An immediately scheduled timer measures main-thread availability during each sample. For tiny batched calls its delay belongs to the whole batch. This is a diagnostic, not a UI frame-rate or tail-latency benchmark.

An initial exploratory pass was followed by the interleaved repeat above, with reversed pool order and corrected tiny-input timing. All correctness checks passed in both Node and Chromium. Syntax checks and ESLint's recommended JavaScript rules passed for the benchmark files.

## Measurements

End-to-end milliseconds per **20 ms input**, rounded. Worker columns use the existing helper; direct columns show all implementations.

| Runtime | Direct current JS | Direct single-loop JS | Direct WASM | 1 worker | 2 workers | 4 workers | 8 workers |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Node | 0.017 | 0.013 | 0.011 | 0.493 | 0.615 | 0.543 | 0.509 |
| Chromium | 0.018 | 0.012 | 0.010 | 0.1 | 0.2 | 0.4 | 0.4 |

End-to-end milliseconds per **600-second input**, rounded:

| Execution | Node current JS | Node single-loop JS | Node WASM | Chromium current JS | Chromium single-loop JS | Chromium WASM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Main thread | 917 | 824 | 713 | 1,007 | 841 | 677 |
| 1 worker | 862 | 482 | 650 | 419 | 236 | 334 |
| 2 workers | 393 | 217 | 297 | 229 | 132 | 182 |
| 4 workers | 229 | 122 | 160 | 171 | 89 | 116 |
| 8 workers | 150 | 83 | 98 | 149 | 77 | 103 |

The intermediate 60-second input took 42/45.5 ms in the current helper on the Node/Chromium main thread. Four workers took 23/49 ms; eight took 26/35 ms. More workers did not consistently win even within this repeat.

Pool readiness took 111-139 ms in Node and 29-104 ms in Chromium, including module initialization. The tiny 258-byte WASM module compiled in approximately 0.18/0.4 ms; this is not representative of loading a complete codec library.

For the 600-second input, the current helper delayed the scheduled timer by approximately 918/1,007 ms on the Node/Chromium main thread. One worker reduced that diagnostic to approximately 20/9 ms; copying input still runs on the calling thread. Multiple workers are not required to obtain the responsiveness benefit.

Timings varied materially on this active desktop. For example, the first pass's Node main-thread median for the largest current-helper input was 1,817 ms, versus 917 ms in the repeat. Four workers beat eight on that workload in the first pass; eight beat four in the repeat. Pool sizes were measured sequentially, and timer delay is subject to OS/browser scheduling. These are exploratory measurements, not portable speedups, confidence intervals or proof of an optimal pool size. Raw samples are retained in the cache; the first pass is saved as `node-exploratory.json` and `browser-exploratory.json`.

## Initial implications (superseded by the responsiveness requirement below)

1. Keep the current direct path for small PCM chunks. It already consumes a tiny fraction of a 20 ms chunk's duration; distributing each chunk adds latency. WASM saved only a few microseconds there.
2. If an application processes large buffers on its main thread, one persistent worker can improve responsiveness. A bounded pool can improve bulk throughput. Reuse workers instead of spawning them per call; Node explicitly recommends pooling CPU-bound worker tasks because startup can outweigh the benefit. [Node worker documentation](https://nodejs.org/api/worker_threads.html)
3. Treat processor count as a starting limit to measure, not a prescribed pool size. Leave capacity for UI, concurrent requests and native processing. Browser `hardwareConcurrency` reports available logical processors and may be reduced by the browser; Node recommends `availableParallelism()` for estimating parallelism. [Browser concurrency](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency), [Node parallelism](https://nodejs.org/api/os.html#osavailableparallelism)
4. Prefer distributing independent files or streams. Arbitrary byte slices of compressed media are not independent decoding jobs; resampling chunks also need correct phase and boundary handling. This experiment handles linear interpolation boundaries explicitly and does not establish parallel codec support.
5. Transfer owned buffers when possible. Transferring an ArrayBuffer detaches it from the sender; Casai cannot silently do that to borrowed application data. Shared memory would introduce a different ownership and deployment contract and was not tested. [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
6. Do not add another production backend on this evidence. Scalar WASM helped some main-thread measurements, but the simpler JavaScript loop beat it in every large-buffer worker configuration in the repeat. If optimization becomes necessary, investigate intermediate allocations and upstream SDK improvements first. Native media preparation already uses FFmpeg. SIMD, other browsers and sustained concurrent workloads would need separate measurements before a production decision.

## External research and implementation follow-up

The user requested implementation of direct-buffer conversion and a bounded reusable pool, then asked for evidence beyond this single machine. Primary references show different policies rather than a universal worker count:

| Implementation/reference | Published policy or finding | Relevance and limitation |
| --- | --- | --- |
| [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html#envwasmnumthreads) | Browser default uses half the reported logical processors, capped at four threads. This count includes the main computation thread. | A precedent for a conservative cap, but it runs inference kernels with WASM threading; it does not establish an optimal number of separate PCM workers. |
| [workerpool](https://github.com/josdejong/workerpool#pool) | Default maximum is CPU count minus one, with a fallback when count is unavailable. | General-purpose browser/Node tasks use a different policy. |
| [Piscina](https://github.com/piscinajs/piscina#constructor-new-piscinaoptions) | Current documentation defaults the maximum to 1.5 times available parallelism and emphasizes workload-specific tuning. | Server task throughput has different constraints from an interactive browser; its default should not be copied into this audio helper. |
| [Roofline model and measurement guidance](https://docs.nersc.gov/tools/performance/roofline/) | Throughput depends on arithmetic intensity and achievable memory/compute performance on the particular machine. | Memory saturation is plausible, but neither our timing data nor this model proves that PCM processing is memory-bandwidth bound or identifies four as the saturation point. |

The selected policy is at most `min(available logical processors, 4)` workers, further bounded by useful work. Treat it as a resource budget. Create workers only for substantial finite buffers, reuse them, and avoid a startup autotuner based on noisy desktop timings. Different hardware, browser engines, concurrent workloads, allocation overhead and cache behavior remain reasons to revisit the heuristic; this evidence does not establish a universal optimum.

`resamplePcm16` now uses the tested direct-buffer algorithm; `resamplePcm16Stream` reuses it while preserving its existing carry and lazy-read behavior. Both keep the installed SDK's Float32 rounding and PCM semantics, with native comparisons instead of a runtime resampler call. The historical tables' "current JS" means the former SDK pipeline; the benchmark keeps that independent baseline and imports the production kernel for its "fused" control.

The initial implementation exposed an opt-in owned pool. The subsequent user decision removes that API: `await resamplePcm16(audio, inputRate, outputRate)` manages finite processing automatically. Its lazy pool uses Node worker threads/browser Web Workers without a new dependency. At least 262144 output samples are required per worker; small calls stay inline. Partitioning preserves global phase and the neighboring interpolation sample, and copies caller buffers before transfer, including Node Buffer subviews. The pool releases workers and browser blob URLs after five idle seconds. Active Node workers are referenced until their replies; idle workers and the cleanup timer are unreferenced so they do not keep the process running. [Node worker lifetime](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html#workerunref), [Node timer lifetime](https://nodejs.org/api/timers.html#timeoutunref)

Workers are an optimization: missing workers use the inline path. Startup or execution failure releases the pool and uses the same pure inline kernel for current, queued and subsequent calls in that loaded module. This also keeps conversion available when browser CSP blocks blob workers. `resamplePcm16Stream` bypasses the worker queue entirely and processes ready sample groups inline, preserving low-latency sequential delivery, bounded carry, backpressure and cancellation. Live microphone sample-rate conversion remains a concrete use case. No shared memory, codec splitting, WASM backend or resampling-quality improvement is implied.

### Initial implementation verification

- The full local suite passed 1,864 tests and the existing coverage gate. The direct-buffer kernel has complete line/branch coverage; the pool has complete line coverage and 94.44% branch coverage in that run.
- Source, emitted consumer, exact-optional and declaration-export checks passed, together with focused typed lint. Guide snippets include the new helper.
- Real Node workers exercise reuse, default/explicit budgets, fractional partition boundaries, borrowed Buffer views, queued/running closure and Cascada composition. Chromium verifies actual Web Workers, minification, numerical results and CSP rejection.
- Packed consumers with the linked Cascada candidate pass with source/declaration conditions and absent/broken native peers. ESM/CommonJS and browser bundles compare against their installed SDK resampler too, including the packed installation's AI SDK 7.0.173 in addition to development 7.0.162.
- All four isolated mutations were caught: removed Float32 rounding, lost global sample phase, a changed default worker budget and transfer of borrowed input. The budget assertion was strengthened to supply enough work to exceed four workers; a four-part workload would not prove that cap.
- Matrix verification passed 1,571 selections and executed 1,458 with SDK mocks. No paid calls were needed for this local numerical/worker change.

At that stage, a subsequent complete review of the affected public helpers, streaming consumer, worker ownership/failure paths, export conditions, types, documentation and verification found no important unresolved issue. Timings remain the exploratory measurements above; the implementation checks are correctness and integration evidence, not new multi-device performance evidence.

### Automatic API revision

The follow-up removes the public pool factory/options/handle types and makes the ordinary finite helper asynchronous. Streaming uses the synchronous kernel directly; the final partial group copies bytes even when its source is a Node Buffer, avoiding retained backing storage and changes when a producer reuses that storage. New checks exercise automatic worker budgets and reuse, real worker failure with queued calls, idle termination/restart, Node process lifetime and inline streaming with a large chunk. Minified browser checks exercise normal workers, a real CSP denial, unavailable workers and blob-URL release; bundled Node consumers verify workers actually execute both calls rather than silently falling back. The completion marker in Node bundle probes also prevents a premature process exit from looking like successful execution.

Validation after the automatic-API revision:

- Full local suite: 1,866 passing; existing coverage gates passed (99.57% lines/statements, 95.83% branches, 100% functions). The shared PCM kernel retains complete line/branch coverage.
- Source, emitted declaration/consumer, exact-optional and guide-example checks passed. Focused typed lint, fixture JavaScript lint, documentation links and whitespace checks passed.
- All seven isolated mutations were caught: Float32 rounding, global partition phase, worker budget, borrowed-buffer transfer, copied stream carry, stream worker exclusion and idle cleanup.
- Packed consumers passed with the npm-linked Cascada candidate, including source/declaration conditions, absent/broken native peers and minified Node/browser bundles. Explicit completion-marker checks also passed for all ESM/CommonJS main/helper bundles against the built package with the installed native peer.
- Chromium exercised actual automatic worker reuse, sequential streaming, real CSP denial, unavailable workers and idle blob-URL cleanup. Native worker fixtures cover active/idle Node process lifetime, restart after cleanup and queued-call fallback after a real worker termination.
- Matrix verification passed 1,571 selections and executed 1,458 with SDK mocks; planned/native execution distinctions remain explicit. No paid calls were needed for this local processing change.

A subsequent complete pass over the affected public API, synchronous streaming kernel, shared finite queue, worker lifetime/fallback, borrowed data, conditional exports, downstream types, guides and integration evidence found no important unresolved issue. The four-worker budget and workload threshold remain conservative heuristics; these checks do not establish an optimal worker count or a memory-bandwidth bottleneck.

### Worker-only responsiveness revision

The latest user decision requires heavy audio processing off the calling thread, including streaming and single-core execution. It supersedes the earlier inline paths and failure fallback above. PCM sample conversion, WAV reading/writing, finite resampling and internal completed-audio concatenation are asynchronous worker operations. Finite resampling retains the conservative shared pool; smaller operations use one worker. Streams own an ordered worker and process roughly 32 KiB input blocks independently of the finite queue. Borrowed buffers are copied in bounded blocks with event-loop yields; results transfer back without another full-buffer copy. Worker absence or failure rejects instead of computing inline.

Native preparation now owns a Node worker for the entire existing node-av pipeline. Inspection found that async decoding/encoding and I/O already use native workers, but resampling through `SoftwareResampleContext.convertFrame`, library initialization and output assembly include synchronous work. Moving the owning pipeline covers those operations without another codec implementation. Native async operations still share the process-wide libuv pool. Shutdown closes native resources and waits for the worker to exit; abrupt termination during synchronous native code can abort the process, as the [upstream worker guidance](https://github.com/seydx/node-av#worker-threads-and-the-libuv-thread-pool) explains.

Typed worker entrypoints are bundled ahead of time with the existing development bundler. The generated module is embedded in source and built consumers, avoiding runtime function serialization, external worker assets or new runtime dependencies. `node scripts/build-audio-workers.mjs --check` checks freshness. Worker-isolate operations are exercised by real worker/native integration and mutation tests; the small numerical kernel is also compared directly against the installed SDK.

The maintained responsiveness fixture processes 32 MiB of PCM after warming the finite worker, checks timer progress during each operation and executes a separate Cascada script. One diagnostic run on this desktop recorded maximum timer gaps of 53 ms for finite resampling and 16–17 ms for sample conversion, WAV operations and streamed resampling, with 33–494 timer callbacks per operation. These include desktop scheduling and allocation/copy costs, not just computation; they are not latency guarantees or portable performance thresholds. Native integration separately verifies two simultaneous worker-owned pipelines, independent Cascada/timer progress and graceful exit of both workers.

Verification of this revision:

- 1,869 local tests passed; coverage gates passed with 99.57% lines/statements, 96.15% branches and 100% functions. The suite now checks responsiveness during concatenation and SDK base64 conversion in workers too.
- All 17 native integration tests passed against node-av-lgpl 7.1.0 on Windows. They retain seeking, streaming before input EOF, track selection, format checks, uploaded-resource isolation, HTTP credentials and graceful cancellation, and add concurrent worker ownership, error-code transport and source-error identity checks.
- Eight PCM and nine native mutations were detected, rebuilding worker bundles for each isolated mutation. This proves that tests exercise edited worker code rather than stale generated strings.
- Source, emitted declarations, consumer/exact-optional types, guide examples and build checks passed. Full lint found three new test-instrumentation lint errors; those were corrected and the affected files passed focused typed lint. Worker bundle freshness and whitespace checks passed.
- Packed consumers passed with the npm-linked Cascada checkout packed as a candidate, including missing/broken native installations, source/declaration conditions, real Chromium workers, CSP rejection, unavailable workers and blob cleanup. Minified ESM/CommonJS source and built entries also passed with the installed native peer.
- Matrix checks passed 1,571 selections and executed 1,458 with SDK mocks. No paid calls were needed: request selection and provider payload contracts did not change.

The subsequent complete review covered every changed helper, completed-result consumer, stream ownership path, worker protocol, native lifecycle, package boundary, type and documentation consumer. It found no further substantial issue after correcting repeated streaming-worker close, source-reader reacquisition during shutdown and FFmpeg error-code transport. Native SDK execution and synchronous lazy file getters retain their native contracts; worker isolation covers Casai's preparation, conversion and collection. No new public worker controls or unresolved design decisions remain.
