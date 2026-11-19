import { experimental_resampleAudio as sdkResample } from 'ai';
import { float32ToPcm16 } from '../../../src/audio/pcm-operations.ts';
import { resamplePcm16Range } from '../../../src/audio/pcm-resample.ts';
// Synchronous reference implementations for comparison with Casai's audio workers.

export function inputFor(seconds, rate = 48000) {
  const bytes = new Uint8Array(Math.round(seconds * rate) * 2), view = new DataView(bytes.buffer);
  let seed = 42;
  for (let i = 0; i < bytes.length; i += 2) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    view.setInt16(i, seed >> 16, true);
  }
  return bytes;
}

export function whole(input, inputRate = 48000, outputRate = 24000) {
  return { inputStart: 0, outputStart: 0, total: input.length / 2,
    count: Math.round(input.length / 2 / (inputRate / outputRate)), ratio: inputRate / outputRate, inputRate, outputRate };
}

// The production direct-buffer kernel, including global phase for worker partitions.
export function fused(input, spec) {
  return resamplePcm16Range(input, spec.ratio, spec.outputStart, spec.count, spec.inputStart, spec.total);
}

export function wasmKernel(module) {
  const { memory, resample } = new WebAssembly.Instance(module).exports;
  function prepare(input, spec) {
    const output = Math.ceil(input.length / 16) * 16;
    const pages = Math.ceil((output + spec.count * 2) / 65536);
    if (pages > memory.buffer.byteLength / 65536) memory.grow(pages - memory.buffer.byteLength / 65536);
    new Uint8Array(memory.buffer, 0, input.length).set(input);
    return {
      run: () => resample(0, output, spec.inputStart, spec.total, spec.outputStart, spec.count, spec.ratio),
      read: () => new Uint8Array(memory.buffer, output, spec.count * 2).slice(),
    };
  }
  return { prepare, run(input, spec) { const job = prepare(input, spec); job.run(); return job.read(); } };
}

// The former decoder remains here for historical baseline comparisons.
function pcm16ToFloat32(bytes) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Float32Array.from({ length: bytes.length / 2 }, (_, i) => data.getInt16(i * 2, true) / 32768);
}

export function compute(method, input, spec, wasm) {
  // Keep the former SDK pipeline as an independent baseline after promoting the direct-buffer implementation.
  if (method === 'current') return float32ToPcm16(sdkResample(pcm16ToFloat32(input), spec.inputRate, spec.outputRate));
  if (method === 'fused') return fused(input, spec);
  return wasm.run(input, spec);
}

export function same(actual, expected) {
  if (actual.length !== expected.length) throw new Error(`Length mismatch: ${actual.length} != ${expected.length}`);
  for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) throw new Error(`Byte mismatch at ${i}: ${actual[i]} != ${expected[i]}`);
}

export function workerHandler(send) {
  let wasm;
  return message => {
    try {
      if (message.module) { wasm = wasmKernel(message.module); send({ ready: true }); return; }
      const input = new Uint8Array(message.buffer);
      const result = compute(message.method, input, message.spec, wasm);
      send({ buffer: result.buffer }, [result.buffer]);
    } catch (error) { send({ error: error.stack ?? String(error) }); }
  };
}

// Test pool: one outstanding request per worker, transferable owned partition buffers.
export async function createPool(count, createWorker, module) {
  const workers = Array.from({ length: count }, () => createWorker());
  const endpoints = workers.map(worker => {
    let complete, fail;
    const receive = data => data.error ? fail(new Error(data.error)) : complete(data);
    if (worker.on) { worker.on('message', receive); worker.on('error', error => fail(error)); }
    else { worker.onmessage = event => receive(event.data); worker.onerror = error => fail(error); }
    const call = (data, transfer) => new Promise((resolve, reject) => {
      complete = resolve; fail = reject; worker.postMessage(data, transfer ?? []);
    });
    return { call };
  });
  try { await Promise.all(endpoints.map(endpoint => endpoint.call({ module }))); }
  catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  return {
    async run(method, input, spec) {
      const parts = await Promise.all(endpoints.map(async (endpoint, index) => {
        const outputStart = Math.floor(spec.count * index / count), outputEnd = Math.floor(spec.count * (index + 1) / count);
        const inputStart = Math.floor(outputStart * spec.ratio);
        const inputEnd = Math.min(spec.total, Math.floor((outputEnd - 1) * spec.ratio) + 2);
        // Borrowed application input stays intact; include splitting/copying in the timed operation.
        const slice = input.slice(inputStart * 2, inputEnd * 2);
        const part = await endpoint.call({ method, buffer: slice.buffer,
          spec: { ...spec, inputStart, outputStart, count: outputEnd - outputStart } }, [slice.buffer]);
        return new Uint8Array(part.buffer);
      }));
      const result = new Uint8Array(spec.count * 2);
      let offset = 0;
      for (const part of parts) { result.set(part, offset); offset += part.length; }
      return result;
    },
    close: () => Promise.all(workers.map(worker => worker.terminate())),
  };
}

const median = numbers => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)];

async function measure(operations, expected, iterationsPerSample = 1) {
  const entries = Object.entries(operations).map(([method, operation]) => ({ method, operation, elapsed: [], timerDelay: [] }));
  for (const { operation } of entries) {
    same(await operation(), expected);
    same(await operation(), expected);
  }
  // Rotate method order so CPU frequency/load changes do not consistently favor the last method.
  for (let round = 0; round < 5; round++) for (let index = 0; index < entries.length; index++) {
    const entry = entries[(round + index) % entries.length];
    const started = performance.now();
    const timer = new Promise(resolve => setTimeout(() => resolve(performance.now() - started), 0));
    const result = await entry.operation();
    entry.elapsed.push((performance.now() - started) / iterationsPerSample);
    // Timer delay is for the whole batch, not per call. Compare bytes only after the timer fires.
    entry.timerDelay.push(await timer);
    same(result, expected);
  }
  return entries.map(({ method, elapsed, timerDelay }) => ({ method, iterationsPerSample,
    medianMs: median(elapsed), timerDelayMs: median(timerDelay), samplesMs: elapsed }));
}

export async function benchmark(module, createWorker, counts, progress = () => {}) {
  const wasm = wasmKernel(module), rows = [], startups = [];
  // Check rounding, fractional ratios, clipping at EOF, and byte-view offsets.
  for (const length of [1, 7, 1009, 65536]) for (const [from, to] of [[48000, 24000], [44100, 24000], [24000, 44100]]) {
    const padded = new Uint8Array(length * 2 + 2);
    padded.set(inputFor(length / from, from), 1);
    const input = padded.subarray(1, -1), spec = whole(input, from, to);
    const expected = compute('current', input, spec);
    same(fused(input, spec), expected); same(wasm.run(input, spec), expected);
  }
  progress('Correctness controls passed.');
  // Batch tiny synchronous calls to get above browser timer resolution. Workers remain one job per sample.
  for (const seconds of [0.02, 60, 600]) {
    const input = inputFor(seconds), spec = whole(input), expected = compute('current', input, spec);
    const iterations = seconds === 0.02 ? 1000 : 1;
    const operations = Object.fromEntries(['current', 'fused', 'wasm'].map(method => [method, () => {
      let result;
      for (let i = 0; i < iterations; i++) result = compute(method, input, spec, wasm);
      return result;
    }]));
    rows.push(...(await measure(operations, expected, iterations)).map(row => ({ seconds, workers: 0, ...row })));
    const prepared = wasm.prepare(input, spec), kernelTimes = [];
    for (let i = 0; i < 7; i++) {
      const start = performance.now();
      for (let j = 0; j < iterations; j++) prepared.run();
      kernelTimes.push((performance.now() - start) / iterations);
    }
    same(prepared.read(), expected);
    rows.push({ seconds, workers: 0, method: 'wasm-kernel-only', iterationsPerSample: iterations,
      medianMs: median(kernelTimes), samplesMs: kernelTimes });
    progress(`Main-thread ${seconds}s input passed.`);
  }
  for (const count of counts) {
    const start = performance.now(), pool = await createPool(count, createWorker, module);
    startups.push({ workers: count, readyMs: performance.now() - start });
    try {
      // A fractional-rate partition control preserves global phase and an interpolation neighbor.
      const control = inputFor(0.1, 44100), controlSpec = whole(control, 44100, 24000);
      const controlExpected = compute('current', control, controlSpec);
      for (const method of ['fused', 'wasm']) same(await pool.run(method, control, controlSpec), controlExpected);
      for (const seconds of [0.02, 60, 600]) {
        const input = inputFor(seconds), spec = whole(input), expected = compute('current', input, spec);
        // The SDK helper can be partitioned this way at aligned integer-ratio boundaries only.
        const operations = Object.fromEntries(['current', 'fused', 'wasm'].map(method => [method, () => pool.run(method, input, spec)]));
        rows.push(...(await measure(operations, expected)).map(row => ({ seconds, workers: count, ...row })));
        progress(`${count}-worker ${seconds}s input passed.`);
      }
    } finally { await pool.close(); }
    progress(`${count}-worker pool passed.`);
  }
  return { rows, startups };
}
