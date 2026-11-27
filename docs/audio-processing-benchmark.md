# Audio processing measurements

## Bounded finite scheduling (2026-11-17)

The final audio follow-up replaces whole-call serialization with one ordered queue per finite worker, keeping the existing cap of four workers and available logical processors. Resampling submits jobs of at most 262144 output samples, with only its useful consumer count in flight. One shared iterator serializes preparation under the existing copy budget. Consumers requeue after each job, allowing short operations to progress even on one core. No reserved worker, extra pool, priority setting or new dependency was added. Other finite calls keep their preparation and computation together, so queued calls do not eagerly copy all their inputs. Streaming retains its independent ordered worker.

The maintained comparison is `node --import tsx/esm --conditions=casai-source tests/benchmarks/audio/followups.mjs --pcm-only`. Five alternating trials request a 64 KiB join after the first job of a 57.6 MB resample is dispatched. The serialized control waits for that same resample before joining; both use the current kernels and resource cap. On this Windows x64 / Node 24.14.1 machine:

| Measurement | Serialized control median | Scheduled median |
| --- | ---: | ---: |
| Short-result wait | 59.4 ms | 0.7 ms |
| Combined completion | 60.5 ms | 47.6 ms |

An exploratory comparison against the saved previous implementation gave 70.6 / 0.6 ms short-result waits and 85.1 / 43.1 ms combined completion. That comparison ran versions sequentially; the alternating maintained control above is the repeatable scheduling comparison. Raw reports are retained under `.cache/pcm-scheduling-2026-11-17/`. These are local measurements, not portable latency guarantees. Bounded jobs can overlap copying and computation, but a running worker operation is not preempted; several large joins or WAV operations can still occupy the pool.

Maintained tests deliberately occupy every worker, enqueue a short result, release only one resampling job and require the short result to finish while the large resample remains unfinished. The same test uses a one-core budget. Numerical, borrowed-input, shared/unshared output, failure recovery, idle/process lifetime and browser/CSP checks remain required. Scheduling mutations remove the job bound and exceed the worker cap. The resampling path now needs a final worker join for a large nonshared single-core result; single-job and streaming results still transfer directly. Shared output retains its exact-size allocation and completion-before-publication rule.

## Queue and native startup measurements (2026-11-17)

Before the bounded scheduler, five alternating trials on Windows x64 / Node 24.14.1 compared worker-only paths and checked every native output byte. Those raw samples are retained in `.cache/pcm-scheduling-2026-11-17/previous-results.json`. The current `tests/benchmarks/audio/followups.mjs` retains the native comparisons and uses the scheduling control above. These are single-machine measurements, not portable latency guarantees.

| Workload | Existing/fresh worker median | Reused/independent worker median |
| --- | ---: | ---: |
| 64 KiB result behind a 57.6 MB resample | 86.1 ms | 0.3 ms with an extra result worker |
| 0.1-second native conversion | 173.6 ms | 5.8 ms through the production cache |
| 30-second native conversion | 298.2 ms | 119.2 ms through the production cache |

A standalone 64 KiB join took 0.3 ms. The extra-lane resample+join total was 89.4 ms versus 86.2 ms with the existing queue. That lane added a worker beyond the finite budget, so it was not adopted. The later bounded scheduler above resolves the queue delay within the existing cap; the extra-lane control has been removed from the maintained benchmark.

The user selected native reuse after the initial measurements. Production now retains at most one fully cleaned native worker for five idle seconds. Each call gets an independent MessagePort and native owner; overlapping calls start fresh workers, with no waiting queue. Only successful completed/EOF workers enter the cache. Failed/cancelled calls and excess/expired idle workers shut down gracefully, never through abrupt termination. Old handles/signals cannot affect a later invocation. Both cached worker and timer are unreferenced in Node.

The direct warmed-pipeline controls took 4.8 / 120.2 ms for the two native workloads; the production values above also include its invocation ports and source ownership. No PCM queue change, public worker control or dependency was added. Prepared-file spare-capacity trimming remains deferred: an extra exact-size copy reduces retained memory but increases peak memory and copying.

Maintained native cases cover actual reuse across changed formats, overlapping work, cancellation/error isolation, stale handles/signals, the one-idle bound, five-second expiry and automatic process exit. Six new mutations independently break reuse, the idle bound/expiry, worker/timer references and cancellation disposal. The [acceptance record](phase6-implementation.md) tracks the final gates.

## Bounded input preparation and shared reuse (2026-11-17)

A calling-thread copy audit found that the previous per-buffer limit did not bound a complete preparation. With a warm worker, one 64 MiB chunk copied at most 1 MiB between task yields, but 64 chunks of exactly 1 MiB copied all 64 MiB before yielding. The observed largest timer gaps were 4.7 ms and 16.3 ms respectively. These were input preparation copies; final joining already ran in the worker.

Each preparation now owns one copy budget across all chunks or resampling partitions. Copy steps are at most 256 KiB and yield after 1 MiB total or about 1 ms, whichever comes first. Uneven chunks use only the remaining byte budget; tiny, empty and base64 chunks still hit the time budget. Cancellation is checked between steps. Node uses `setImmediate`; browsers use `scheduler.yield()` where available, otherwise a one-shot `MessageChannel` whose ports close before resuming. Neither path spins microtasks or waits indefinitely for idle/background priority.

Large staging allocations also run in the existing worker. The empty owned buffer transfers to the calling thread for bounded filling, then back to its worker for processing. Small allocations fit within the copy-step limit. Already-shared input needs neither staging nor transfer: workers read its exact view directly. Inputs must stay unchanged through processing; native streaming inputs must stay unchanged through consumption/cancellation. `readWav` may return a view into shared input. Shared parallel output and the unshared worker join retain their existing completion and ownership rules.

This consolidates preparation and transfer-list ownership for finite PCM/WAV/base64/collection operations. Resampling prepares its partitions sequentially under the same budget, then computes them in parallel. Native finite input uses the same preparation helper and its existing invocation-owned worker. Native uploaded streams still cross in tight 64 KiB chunks (ordinary transferable-stream chunks are cloned); shared chunks reuse their backing memory. The installed node-av buffer reader uses views, and native frame copies, conversion and encoded-file assembly execute inside the native worker. No second native executor or new dependency is needed.

The budgets constrain Casai's byte-copy work, not every source of event-loop latency. A copy step cannot be preempted; operating-system scheduling, GC and runtime serialization of native string messages can still cause pauses. Main-thread final joining remains excluded. The maintained regression checks both byte and time bounds, allocation ownership, shared views, actual timer/workflow progress, browser task fallbacks, and native cancellation before media opening.

Verification and maintained regressions are consolidated in the [acceptance record](phase6-implementation.md#verification).

## Shared output for parallel PCM (2026-11-17)

Responsiveness is a requirement, independent of throughput measurements: heavy audio processing and completed-result joining stay off the calling thread. The current comparison below measures two worker-based paths. Main-thread joining is not an implementation candidate, even if a timing comparison favors it.

Parallel finite resampling now allocates one exact-size `SharedArrayBuffer` in a worker and gives each worker a disjoint output view. The output length is known before processing, so no growth protocol is needed. Workers write their samples directly into those views; the existing completion messages and `Promise.all` gate publication of the finished `Uint8Array`. A small initial allocation job replaces the final join job, and no output copy is needed. Single-worker and streaming results continue transferring their owned buffers.

Sharing is automatic in Node and isolated browser contexts. Browsers without shared-memory support retain the existing worker join; there is no main-thread join or inline failure fallback. Shared buffers are passed in messages without a transfer-list entry. The returned byte view can have shared backing memory: the installed SDK's audio converter and Casai's asynchronous PCM/WAV helpers accept it. `writeWav` creates ordinary encoded bytes suitable for `Blob`. [Node shared-buffer messaging](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html#portpostmessagevalue-transferlist), [browser isolation requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements).

This change applies to worker-generated PCM. SDK-produced audio chunks still require copying and worker assembly, and may wait on the finite queue. The subsequent native idle cache above changes worker lifetime, while preserving exclusive invocation ownership and the finite PCM queue.

Run the paired production-path probe with `node --expose-gc --import tsx/esm --conditions=casai-source tests/benchmarks/audio/shared-output.mjs`. It warms both paths, alternates order, and retains the same kernel, inputs and workers; disabling the main realm's shared-buffer constructor selects the existing worker join. On this Windows/Node 24.14.1 machine, five timed conversions of 57.6 MB PCM into 28.8 MB produced a median of **369.6 ms with shared output**, versus **359.0 ms with worker joining**. Timer callbacks continued on both paths, with maximum observed gaps of 24.4 and 25.6 ms respectively. This run does not establish a latency improvement; desktop timings varied substantially. Avoiding the extra 28.8 MB result allocation/copy is structural, and output allocation itself remains off the calling thread. The change does not claim a universal throughput gain.

Node and Chromium tests forbid calling-thread shared allocation and verify numerical output, actual shared-buffer publication, no join job, ordinary single-worker output, the unshared fallback, SDK conversion, WAV/Blob interoperability, responsiveness and cleanup. Mutation checks reject disabled sharing, wrong destination offsets, calling-thread allocation, broken partitioning/ownership, and missing active/idle worker references.

Verification and maintained regressions are consolidated in the [acceptance record](phase6-implementation.md#verification).

## Completed-result scheduling follow-up

The completed-result measurements identified significant Node timer delay during bounded borrowed-buffer copying. Forty `setTimeout(0)` yields took about 620 ms on this Windows machine; forty `setImmediate` yields took about 1 ms. That correction used immediate yields in Node; the later aggregate-budget revision above also replaces the browser timer fallback. Heavy processing, joining and base64 encoding remain in workers.

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

Current worker ownership and verification are consolidated below and in the [acceptance record](phase6-implementation.md); the obsolete inline fallback and public pool API are removed.

### Worker-only responsiveness revision

The latest user decision requires heavy audio processing off the calling thread, including streaming and single-core execution. It supersedes the earlier inline paths and failure fallback above. PCM sample conversion, WAV reading/writing, finite resampling and internal completed-audio concatenation are asynchronous worker operations. Finite resampling retains the conservative shared pool; smaller operations use one worker. Streams own an ordered worker and process roughly 32 KiB input blocks independently of the finite queue. Borrowed buffers are copied in bounded blocks with event-loop yields; results transfer back without another full-buffer copy. Worker absence or failure rejects instead of computing inline.

Native preparation now owns a Node worker for the entire existing node-av pipeline. Inspection found that async decoding/encoding and I/O already use native workers, but resampling through `SoftwareResampleContext.convertFrame`, library initialization and output assembly include synchronous work. Moving the owning pipeline covers those operations without another codec implementation. Native async operations still share the process-wide libuv pool. Invocation cleanup closes native resources before cache release; discarded or expired workers exit gracefully. Abrupt termination during synchronous native code can abort the process, as the [upstream worker guidance](https://github.com/seydx/node-av#worker-threads-and-the-libuv-thread-pool) explains.

Typed worker entrypoints are bundled ahead of time with the existing development bundler. The generated module is embedded in source and built consumers, avoiding runtime function serialization, external worker assets or new runtime dependencies. `node scripts/build-audio-workers.mjs --check` checks freshness. Worker-isolate operations are exercised by real worker/native integration and mutation tests; the small numerical kernel is also compared directly against the installed SDK.

The maintained responsiveness fixture processes 32 MiB of PCM after warming the finite worker, checks timer progress during each operation and executes a separate Cascada script. One diagnostic run on this desktop recorded maximum timer gaps of 53 ms for finite resampling and 16–17 ms for sample conversion, WAV operations and streamed resampling, with 33–494 timer callbacks per operation. These include desktop scheduling and allocation/copy costs, not just computation; they are not latency guarantees or portable performance thresholds. Native integration separately verifies two simultaneous worker-owned pipelines, independent Cascada/timer progress and graceful cleanup, at most one retained idle worker, and automatic expiry.

Verification and maintained regressions are consolidated in the [acceptance record](phase6-implementation.md#verification).

## Browser recording worker under a single-core load

On November 25, 2026, the installed 6C candidate ran pairs of simultaneous public `Transcriber.loadsAudio` calls in Chrome 158.0.8127.88 on Windows. Windows process affinity restricted the browser and all of its observed child processes to one logical processor. The page ran a one-millisecond timer during each pair. Working sets and private committed bytes below are the highest sampled sums across those Chrome processes, relative to the sample immediately before dispatch. They include decoding, conversion, source staging, output storage and browser overhead.

| Two simultaneous preparations | Provider file bytes per call | Elapsed | Page timer ticks | Working set increase | Private bytes increase |
| --- | ---: | ---: | ---: | ---: | ---: |
| 8 MiB of stereo PCM per call to mono 24 kHz WAV | 2,097,196 | 815 ms | 173 | 44.5 MiB | 42.5 MiB |
| Spoken FLAC to mono 24 kHz WAV | 197,968 | 1,019 ms | 190 | 20.1 MiB | 21.1 MiB |
| Chrome WebM/Opus copy | 15,746 | 724 ms | 159 | 13.2 MiB | 14.2 MiB |

The three pairs ran in that order in one browser session. The sampler obtained 7, 11 and 7 in-operation observations. These measurements describe the tested recordings and cache state. Large seekable and sequential recordings, each admitted muxer and the mobile platforms still need peak-memory measurements. The application-worker regression separately checks the delivered samples, input ownership and timer progress when the caller is itself a worker. [Provider and worker tests](../tests/fixtures/browser-media-contracts.test.mjs)
