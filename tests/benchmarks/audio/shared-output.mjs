// Paired finite-resampling probe: keep the same workers/kernel and vary only shared output availability.
import assert from 'node:assert/strict';
import { resamplePcm16 } from '../../../src/audio/pcm.js';
import { availableParallelism } from 'node:os';

assert(availableParallelism() > 1, 'The comparison needs parallel workers.');
const Shared = globalThis.SharedArrayBuffer;
assert(Shared, 'The comparison needs shared memory.');
const input = Uint8Array.from({ length: 48_000 * 2 * 600 }, (_, index) => index % 251);
const samples = { shared: [], joined: [] };
try {
  // Warm both paths, then alternate their order to reduce startup and order effects.
  for (let round = -1; round < 5; round++) for (const mode of round % 2 ? ['joined', 'shared'] : ['shared', 'joined']) {
    globalThis.SharedArrayBuffer = mode === 'shared' ? Shared : undefined;
    globalThis.gc?.();
    let ticks = 0, gap = 0, previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(); gap = Math.max(gap, now - previous); previous = now; ticks++;
    }, 1);
    const start = performance.now();
    let output;
    try { output = await resamplePcm16(input, 48000, 24000); }
    finally { clearInterval(timer); }
    const ms = performance.now() - start;
    assert.equal(output.length, input.length / 2);
    assert.equal(output.buffer instanceof Shared, mode === 'shared');
    if (round >= 0) samples[mode].push({ ms: Math.round(ms * 10) / 10, maxTimerGapMs: Math.round(gap * 10) / 10, ticks });
  }
} finally { globalThis.SharedArrayBuffer = Shared; }
for (const [mode, values] of Object.entries(samples)) {
  const ordered = values.map(value => value.ms).sort((a, b) => a - b);
  console.log(JSON.stringify({ mode, inputBytes: input.length, outputBytes: input.length / 2, medianMs: ordered[2], samples: values }));
}
