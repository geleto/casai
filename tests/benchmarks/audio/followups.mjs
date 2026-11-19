// Worker-only scheduling and native lifetime comparisons; no calling-thread processing control.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { concatAudio } from '../../../src/audio.ts';
import { resamplePcm16, writeWav } from '../../../src/audio/pcm.ts';
import { prepareAudio } from '../../../src/audio/native.ts';

const samples = {};
const roundMs = value => Math.round(value * 10) / 10;
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function measure(name, action) {
  const start = performance.now();
  await action();
  (samples[name] ??= []).push(roundMs(performance.now() - start));
}
const large = new Uint8Array(48_000 * 2 * 600).fill(1);
const small = new Uint8Array(64 * 1024).fill(42);
await resamplePcm16(large, 48000, 24000); await concatAudio([small]);
for (let trial = 0; trial < 5; trial++) {
  await measure('joinAloneMs', async () => assert.deepEqual(await concatAudio([small]), small));
  for (const mode of trial % 2 ? ['scheduled', 'serialized'] : ['serialized', 'scheduled']) {
    let started;
    const firstJob = new Promise(resolve => started = resolve), post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (...args) { if (args[0].type === 'resample') started(); return post.apply(this, args); };
    const start = performance.now();
    try {
      const resampling = resamplePcm16(large, 48000, 24000);
      await firstJob; Worker.prototype.postMessage = post;
      await measure(`${mode}JoinMs`, async () => {
        if (mode === 'serialized') await resampling;
        assert.deepEqual(await concatAudio([small]), small);
      });
      const output = await resampling;
      const totalMs = performance.now() - start;
      assert.equal(output.length, large.length / 2);
      assert(output.every((byte, index) => byte === index % 2), 'PCM16 rounding of constant positive samples');
      (samples[`${mode}TotalMs`] ??= []).push(roundMs(totalMs));
    } finally { Worker.prototype.postMessage = post; }
  }
}

// Same actual native pipeline in both cases; only the worker/module lifetime differs.
const root = resolve(import.meta.dirname, '../../..');
if (!process.argv.includes('--pcm-only')) {
const entry = pathToFileURL(createRequire(import.meta.url).resolve('node-av')).href;
const bundled = await build({ absWorkingDir: root, entryPoints: ['src/audio/native-pipeline.ts'],
  bundle: true, write: false, platform: 'node', format: 'iife', globalName: 'Pipeline', target: 'es2022' });
const code = bundled.outputFiles[0].text + `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const av = await import(workerData);
  parentPort.on('message', async source => {
    if (source === null) { parentPort.close(); return; }
    try {
      const pipeline = Pipeline.prepareNativeAudio(av, source, { fileAudioTarget: { format: 'wav', codec: 'pcm_s24le', rate: 32000 } });
      const { audio } = (await pipeline.next()).value;
      parentPort.postMessage({ audio }, [audio.buffer]);
    } catch (error) {
      parentPort.postMessage({ error });
    }
  });
  parentPort.postMessage('ready');
})().catch(error => { parentPort.postMessage({ error }); parentPort.close(); });`;
async function openWorker() {
  const worker = new Worker(code, { eval: true, workerData: entry });
  const [ready] = await once(worker, 'message');
  assert.equal(ready, 'ready');
  return worker;
}
async function closeWorker(worker) {
  const exited = once(worker, 'exit');
  worker.postMessage(null); assert.equal((await exited)[0], 0);
}
async function convert(worker, input, expected) {
  const reply = once(worker, 'message'); worker.postMessage(input);
  const [result] = await reply;
  if (result.error) throw result.error;
  assert.deepEqual(result.audio, expected);
}
const warm = await openWorker();
try {
  for (const seconds of [0.1, 30]) {
    const wav = await writeWav(new Uint8Array(48000 * 2 * seconds), { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' });
    const input = new Uint8Array(new SharedArrayBuffer(wav.length)); input.set(wav);
    const expectedReply = once(warm, 'message'); warm.postMessage(input);
    const [{ audio: expected, error }] = await expectedReply;
    if (error) throw error;
    assert(expected.length >= 32000 * 3 * seconds);
    // Warm the production cache independently of the direct-pipeline control.
    await using initial = await prepareAudio(input, { fileAudioTarget: { format: 'wav', codec: 'pcm_s24le', rate: 32000 } });
    assert.deepEqual(initial.audio, expected);
    for (let trial = 0; trial < 5; trial++) for (const mode of trial % 2 ? ['production', 'reused', 'fresh'] : ['fresh', 'reused', 'production']) {
      await measure(`native${seconds}s-${mode}Ms`, async () => {
        if (mode === 'production') {
          await using result = await prepareAudio(input, { fileAudioTarget: { format: 'wav', codec: 'pcm_s24le', rate: 32000 } });
          assert.deepEqual(result.audio, expected); return;
        }
        const worker = mode === 'fresh' ? await openWorker() : warm;
        try { await convert(worker, input, expected); }
        finally { if (mode === 'fresh') await closeWorker(worker); }
      });
    }
  }
} finally { await closeWorker(warm); }
}
const report = { host: { platform: process.platform, arch: process.arch, node: process.version, processors: availableParallelism() },
  queue: { resampleInputBytes: large.length, resultBytes: small.length, request: 'after first resample job dispatch', workerCap: Math.min(4, availableParallelism()) },
  results: Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, { medianMs: median(values), samples: values }])),
  limits: ['One machine, five alternating trials; timings are not latency guarantees.',
    'Serialized control waits for the resample before joining; both cases use the current kernels and same worker cap.',
    'Direct native reuse is a sequential control; production also exercises invocation ports and source ownership.',
    'Every byte of native output is compared; no heavy work or result join runs on the calling thread.'] };
await mkdir(resolve(root, '.cache/audio-followups'), { recursive: true });
await writeFile(resolve(root, '.cache/audio-followups/results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
