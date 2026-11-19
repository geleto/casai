// Fresh processes keep automatic worker lifetime and failure policy independent between tests.
import assert from 'node:assert/strict';
import { createHook } from 'node:async_hooks';
import os, { availableParallelism } from 'node:os';
import { syncBuiltinESMExports } from 'node:module';
import { mock } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Worker } from 'node:worker_threads';
import { runInNewContext } from 'node:vm';
import { isArrayBuffer } from 'node:util/types';
import { createServer } from 'node:http';
import { create } from '../../src/index.js';
import { concatAudio } from '../../src/audio.js';
import { resamplePcm16, preparePcmStream, asMonoPcm16, float32ToPcm16, writeWav, readWav } from '../../src/audio/pcm.js';
import { sdkPcm as expected } from '../pcm-reference.ts';
import { audioBase64 } from '../../src/audio.js';

function samples(count) {
  const storage = Buffer.alloc(count * 2 + 2);
  for (let i = 0; i < count; i++) storage.writeInt16LE((i * 32749) % 65536 - 32768, 1 + i * 2);
  return storage.subarray(1, -1);
}
let created = 0, posted = 0;
const sharedOutputs = [];
const jobs = [];
const active = new Set();
const hook = createHook({
  init(id, type) { if (type === 'WORKER') { created++; active.add(id); } },
  destroy(id) { active.delete(id); },
}).enable();
const nativePost = Worker.prototype.postMessage;
const nativeParallelism = os.availableParallelism;
const requests = [];
Worker.prototype.postMessage = function (...args) {
  posted++;
  jobs.push(args[0].type);
  if (args[0].type === 'resampleStream' && isArrayBuffer(args[0].args[0]?.buffer)) {
    assert(args[0].args[0].buffer.byteLength <= 32768, 'An ordinary stream block transfers only its bounded bytes');
  }
  if (args[0].type === 'resample') requests.push(args[0].args);
  if (args[0].type === 'resample' && args[0].args[6]) sharedOutputs.push(args[0].args[6]);
  return nativePost.apply(this, args);
};

try {
  switch (process.argv[2]) {
    case 'single': {
      const input = samples(1009);
      const result = await resamplePcm16(input, 44100, 24000);
      assert.deepEqual(result, expected(input, 44100, 24000));
      assert(result.buffer instanceof ArrayBuffer, 'One worker transfers its output directly');
      assert.equal(created, 1); assert.equal(posted, 1);
      break;
    }
    case 'bulk': {
      globalThis.SharedArrayBuffer = new Proxy(SharedArrayBuffer, { construct() { throw new Error('Shared output must be allocated in a worker'); } });
      const input = samples(4 * 1024 * 1024 + 7), original = Buffer.from(input);
      const rates = [[48000, 24000], [44100, 24000], [24000, 44100]];
      const results = await Promise.all(rates.map(([from, to]) => resamplePcm16(input, from, to)));
      for (let i = 0; i < rates.length; i++) assert.deepEqual(results[i], expected(input, ...rates[i]));
      assert.equal(created, Math.min(4, availableParallelism()));
      assert(requests.length > created, 'Large results are split into bounded jobs');
      assert(requests.every(args => args[3] <= 262144), 'A job has at most 262144 output samples');
      assert(jobs.includes('allocate'), 'Staging allocations run in workers');
      assert.equal(jobs.filter(type => type === 'concatAudio').length, created > 1 ? 0 : 3, 'Only nonshared multi-job results need a worker join');
      assert.equal(jobs.filter(type => type === 'allocateShared').length, created > 1 ? 3 : 0);
      for (let i = 0; i < results.length; i++) {
        assert.equal(results[i].buffer instanceof SharedArrayBuffer, created > 1);
        if (created > 1) assert(sharedOutputs.some(part => part.buffer === results[i].buffer), 'Publish the same buffer given to the workers');
      }
      assert.equal(sharedOutputs.length, created > 1 ? requests.length : 0);
      assert(sharedOutputs.every(part => results.some(result => result.buffer === part.buffer)));
      assert.deepEqual(input, original);
      break;
    }
    case 'unshared': {
      globalThis.SharedArrayBuffer = undefined;
      const input = samples(2 * 1024 * 1024 + 7);
      const output = await resamplePcm16(input, 48000, 24000);
      assert.deepEqual(output, expected(input, 48000, 24000));
      assert(output.buffer instanceof ArrayBuffer);
      assert(created > 0 && created <= Math.min(4, availableParallelism()));
      assert.equal(jobs.filter(type => type === 'concatAudio').length, 1, 'Unavailable sharing still joins inside a worker');
      assert(requests.every(args => args[3] <= 262144));
      assert.equal(sharedOutputs.length, 0);
      break;
    }
    case 'scheduling-pool':
    case 'scheduling-single': {
      if (process.argv[2] === 'scheduling-single') { os.availableParallelism = () => 1; syncBuiltinESMExports(); }
      const budget = Math.min(4, availableParallelism());
      const input = new Uint8Array(new SharedArrayBuffer(12 * 1024 * 1024)).fill(1), small = Uint8Array.of(4, 5, 6);
      const held = [];
      let occupied, holding = true, complete = false;
      const full = new Promise(resolve => occupied = resolve);
      const recordPost = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (...args) {
        if (holding && args[0].type === 'resample') {
          held.push(() => recordPost.apply(this, args));
          if (held.length === budget) occupied();
        } else return recordPost.apply(this, args);
      };
      const big = resamplePcm16(input, 48000, 24000).then(value => { complete = true; return value; });
      try {
        await full;
        const smallResult = concatAudio([small]);
        // Queue the short result while every worker is occupied, then finish only one job.
        await new Promise(resolve => setImmediate(resolve));
        held.shift()();
        let timeout;
        try {
          assert.deepEqual(await Promise.race([smallResult, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Short result waited for the entire resample')), 3000); })]), small);
        } finally { clearTimeout(timeout); }
        assert.equal(complete, false);
        assert.equal(created, budget, 'Short results do not add a dedicated worker');
      } finally {
        holding = false; for (const release of held.splice(0)) release();
        Worker.prototype.postMessage = recordPost;
      }
      assert.deepEqual(await big, expected(input, 48000, 24000));
      assert(requests.every(args => args[3] <= 262144));
      assert(input.every(value => value === 1), 'Borrowed input stays unchanged');
      // An operation error must not poison the queue or another invocation.
      const good = concatAudio([small]), bad = readWav(new Uint8Array(2));
      await assert.rejects(bad, /WAV/); assert.deepEqual(await good, small);
      assert.deepEqual(await concatAudio([small]), small);
      break;
    }
    case 'transport': {
      const server = createServer((request, response) => request.pipe(response));
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      try {
        for (const seconds of [10, 30]) {
          const input = samples(48000 * seconds);
          const pcm = await resamplePcm16(input, 48000, 24000);
          const owned = await concatAudio([pcm]);
          assert(owned.buffer instanceof ArrayBuffer);
          assert.equal(jobs.at(-1), 'concatAudio', 'Explicit conversion runs in a worker');
          assert.deepEqual(owned, expected(input, 48000, 24000));
          assert.deepEqual(pcm, owned, 'Input stays usable');
          const reply = await fetch(`http://127.0.0.1:${server.address().port}/`, { method: 'POST', body: owned });
          assert.deepEqual(new Uint8Array(await reply.arrayBuffer()), owned);
          assert.deepEqual(new Uint8Array(await new Response(owned).arrayBuffer()), owned);
          assert.deepEqual(new Uint8Array(await new Blob([owned]).arrayBuffer()), owned);
          assert.equal((await crypto.subtle.digest('SHA-256', owned)).byteLength, 32);
          const transferred = structuredClone(owned, { transfer: [owned.buffer] });
          assert.equal(owned.byteLength, 0); assert.deepEqual(transferred, pcm);
          const wav = await writeWav(pcm, { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' });
          assert.deepEqual(new Uint8Array(await new Blob([wav]).arrayBuffer()), wav);
        }
        const shared = new Uint8Array(new SharedArrayBuffer(8)); shared.set([0, 1, 2, 3], 2);
        assert.deepEqual(await concatAudio([shared.subarray(2, 6), 'BAU=']), new Uint8Array([0, 1, 2, 3, 4, 5]));
      } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
      break;
    }
    case 'copy-budget': {
      await concatAudio([new Uint8Array(1)]); // Warm workers; startup must not mask a missing yield.
      const nativeSet = Uint8Array.prototype.set, NativeBytes = Uint8Array;
      const immediate = globalThis.setImmediate;
      const now = performance.now.bind(performance);
      const cases = [
        [new Uint8Array(16 * 1024 * 1024)],
        Array.from({ length: 64 }, () => new Uint8Array(1024 * 1024)),
        Array.from({ length: 70 }, () => new Uint8Array(96 * 1024 + 3)),
        Array.from({ length: 2000 }, () => new Uint8Array(0)),
        Array.from({ length: 2000 }, () => 'AQID'),
      ];
      for (const chunks of cases) {
        const lengths = chunks.map(chunk => typeof chunk === 'string' ? undefined : chunk.byteLength);
        const total = chunks.reduce((sum, chunk) => sum + (typeof chunk === 'string' ? 3 : chunk.length), 0);
        let copied = 0, maximum = 0, yields = 0, clock = 0;
        globalThis.setImmediate = (callback, ...args) => immediate(() => { copied = 0; yields++; callback(...args); });
        // Deterministic time budget for small/empty chunks, independent of machine speed.
        performance.now = total < 10000 ? () => clock += 0.3 : () => 0;
        Uint8Array.prototype.set = function (input, offset) {
          assert(input.byteLength <= 256 * 1024, 'Each calling-thread copy is at most 256 KiB');
          copied += input.byteLength; maximum = Math.max(maximum, copied);
          return nativeSet.call(this, input, offset);
        };
        globalThis.Uint8Array = new Proxy(NativeBytes, { construct(target, args) {
          if (typeof args[0] === 'number') assert(args[0] <= 256 * 1024, 'Large allocations belong in a worker');
          return Reflect.construct(target, args);
        } });
        let result;
        try { result = await concatAudio(chunks); }
        finally { Uint8Array.prototype.set = nativeSet; globalThis.Uint8Array = NativeBytes; globalThis.setImmediate = immediate; performance.now = now; }
        assert.equal(result.length, total);
        assert(maximum <= 1024 * 1024, 'One budget must span chunks, including non-aligned chunk sizes');
        assert(yields > 0, 'Byte/time budgets must yield even across tiny or empty chunks');
        assert.equal(result[0], typeof chunks[0] === 'string' ? 1 : total ? 0 : undefined);
        for (const [index, chunk] of chunks.entries()) if (typeof chunk !== 'string') assert.equal(chunk.byteLength, lengths[index], 'Borrowed input stays attached');
      }
      break;
    }
    case 'shared-input': {
      const bytes = new Uint8Array(runInNewContext('new SharedArrayBuffer(4 * 1024 * 1024 + 10)')).subarray(3, -3);
      bytes.set(samples(bytes.length / 2));
      const original = new Uint8Array(bytes), tiny = bytes.subarray(6, 24);
      const floats = new Float32Array(new SharedArrayBuffer(28), 4, 5);
      floats.set([-1, -0.5, 0, 0.5, 1]);
      const wav = await writeWav(tiny, { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' });
      const sharedWav = new Uint8Array(new SharedArrayBuffer(wav.length + 4)).subarray(1, -3); sharedWav.set(wav);
      const allocatedBefore = jobs.filter(type => type === 'allocate').length;
      const nativeSet = Uint8Array.prototype.set;
      Uint8Array.prototype.set = function () { throw new Error('Shared input must not be recopied on the calling thread'); };
      let resampled, decoded, encoded, joined, base64, wrapped, parsed;
      try {
        resampled = await resamplePcm16(bytes, 44100, 24000);
        decoded = await asMonoPcm16(tiny, { channels: 1, sampleRate: 24000, encoding: 'pcm_s24le' });
        encoded = await float32ToPcm16(floats);
        joined = await concatAudio([tiny, tiny]);
        base64 = await audioBase64(tiny);
        wrapped = await writeWav(tiny, { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' });
        parsed = await readWav(sharedWav);
      } finally { Uint8Array.prototype.set = nativeSet; }
      assert.deepEqual(resampled, expected(bytes, 44100, 24000));
      assert.deepEqual(encoded, Uint8Array.from([0, 128, 0, 192, 0, 0, 255, 63, 255, 127]));
      assert.equal(decoded.length, tiny.length / 3 * 2);
      assert.deepEqual(joined, new Uint8Array(Buffer.concat([tiny, tiny])));
      assert.equal(base64, Buffer.from(tiny).toString('base64'));
      assert.deepEqual(wrapped, wav);
      assert.deepEqual(parsed.audio, tiny); assert(parsed.audio.buffer instanceof SharedArrayBuffer);
      assert.equal(jobs.filter(type => type === 'allocate').length, allocatedBefore, 'Shared input needs no staging allocation');
      assert.deepEqual(bytes, original); assert.deepEqual(floats, Float32Array.of(-1, -0.5, 0, 0.5, 1));
      break;
    }
    case 'idle': {
      mock.timers.enable({ apis: ['setTimeout'] });
      const input = samples(524288);
      const check = async () => assert.deepEqual(await resamplePcm16(input, 48000, 24000), expected(input, 48000, 24000));
      await check();
      assert.equal(created, 1, 'One useful partition');
      mock.timers.tick(4999);
      await check();
      assert.equal(created, 1, 'Reused before idle expiry');
      mock.timers.tick(1);
      assert.equal(active.size, 1, 'A new call resets the idle deadline');
      mock.timers.tick(4999);
      for (let i = 0; active.size && i < 100; i++) await delay(10);
      assert.equal(active.size, 0, 'Idle workers terminated');
      await check();
      assert.equal(created, 2, 'Workers can restart after idle cleanup');
      mock.timers.tick(5000);
      break;
    }
    case 'failure': {
      // Terminating a busy real worker must reject; no main-thread conversion may conceal the failure.
      Worker.prototype.postMessage = function () { posted++; void this.terminate(); };
      const input = samples(1024 * 1024), original = Buffer.from(input);
      const results = await Promise.allSettled([resamplePcm16(input, 48000, 24000), resamplePcm16(input, 44100, 24000)]);
      for (const result of results) { assert.equal(result.status, 'rejected'); assert.match(result.reason.message, /PCM worker exited/); }
      assert.deepEqual(input, original);
      Worker.prototype.postMessage = nativePost;
      const before = created;
      assert.deepEqual(await resamplePcm16(input, 24000, 44100), expected(input, 24000, 44100));
      assert(created > before, 'A later call creates working resources');
      break;
    }
    case 'stream': {
      const input = samples(1024 * 1024), original = Buffer.from(input);
      const foreign = runInNewContext('new Uint8Array(input.buffer, input.byteOffset, input.byteLength)', { input });
      let reads = 0, cancelled;
      const source = new ReadableStream({
        pull(controller) { reads++; controller.enqueue(foreign); },
        cancel(reason) { cancelled = reason; },
      }, { highWaterMark: 0 });
      const stream = preparePcmStream(source, 48000, 24000).audio;
      assert.equal(reads, 0);
      const reader = stream.getReader();
      const first = await reader.read();
      assert.deepEqual(first.value, expected(input.subarray(0, 32768), 48000, 24000));
      assert.equal(reads, 1, 'Ready output does not wait for another source chunk');
      assert.equal(created, 1, 'Stream conversion runs in one worker');
      assert.equal(posted, 1);
      assert.deepEqual(input, original);
      await reader.cancel('finished');
      assert.equal(cancelled, 'finished');
      assert.equal(source.locked, false);
      break;
    }
    case 'stream-ratio': {
      const rate = 48000, length = 5 * rate;
      const source = runInNewContext('new Uint8Array(new SharedArrayBuffer(length + 6), 3, length)', { length });
      source.set(samples(length / 2));
      const expectedOutput = expected(source, rate, 1);
      const inputs = [], chunks = [];
      const previous = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (request, transfer) {
        if (request.type === 'resampleStream' && request.args[0]) inputs.push(request.args[0]);
        return previous.call(this, request, transfer);
      };
      try {
        // Split the first PCM sample across chunks and finish halfway through a group.
        const stream = new ReadableStream({ start(controller) {
          controller.enqueue(source.subarray(0, 1)); controller.enqueue(source.subarray(1)); controller.close();
        } });
        for await (const chunk of preparePcmStream(stream, rate, 1).audio) chunks.push(chunk);
      } finally { Worker.prototype.postMessage = previous; }
      assert.deepEqual(new Uint8Array(Buffer.concat(chunks)), expectedOutput);
      assert(inputs.length >= Math.ceil(source.length / 32768));
      assert(inputs.every(input => input.buffer === source.buffer && input.byteLength <= 32768));
      assert.equal(created, 1);
      break;
    }
    case 'exit': {
      // Reuse idle workers so the next job must reference them again.
      await resamplePcm16(samples(1024 * 1024), 48000, 24000);
      await resamplePcm16(samples(1024 * 1024), 48000, 24000);
      assert(created > 0);
      // The parent starts a deadline shorter than the idle timeout at this marker:
      // active work must keep Node alive, while idle workers/timers must not.
      console.log('completed');
      break;
    }
    case 'responsive': {
      const input = new Uint8Array(32 * 1024 * 1024);
      const script = create.Script({ script: 'return add(2, 3)', context: { add: (a, b) => a + b } });
      // Warm the shared worker: progress must not rely solely on its startup await.
      await resamplePcm16(new Uint8Array(128), 48000, 24000);
      async function measure(name, action) {
        let ticks = 0, last = performance.now(), maxGap = 0, composed;
        const timer = setInterval(() => {
          const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; ticks++;
          composed ??= script();
        }, 1);
        let value;
        try { value = await action(); } finally { clearInterval(timer); }
        assert(ticks > 1, name + ' must allow event-loop progress');
        assert.equal(await composed, 5, 'Cascada remains usable during ' + name);
        console.log(JSON.stringify({ name, ticks, maxGapMs: Math.round(maxGap) }));
        return value;
      }
      await measure('resample', () => resamplePcm16(input, 48000, 24000));
      await measure('mix stereo PCM', () => asMonoPcm16(input, { channels: 2, sampleRate: 48000, encoding: 'pcm_s16le' }));
      const floats = new Float32Array(input.length / 2);
      await measure('encode PCM', () => float32ToPcm16(floats));
      const wav = await measure('write WAV', () => writeWav(input, { sampleRate: 48000, channels: 1, encoding: 'pcm_s16le' }));
      await measure('read WAV', () => readWav(wav));
      const joined = await measure('concatenate chunks', () => concatAudio(Array.from({ length: 128 }, () => input.subarray(0, input.length / 128))));
      assert.equal(joined.length, input.length);
      const medium = await measure('concatenate 64 one-MiB chunks', () => concatAudio(Array.from({ length: 64 }, () => input.subarray(0, 1024 * 1024))));
      assert.equal(medium.length, 64 * 1024 * 1024);
      const base64 = await measure('encode base64', () => audioBase64(input));
      const decoded = await measure('decode base64', () => concatAudio([base64]));
      assert.equal(decoded.length, input.length);
      await measure('stream', async () => {
        let size = 0;
        const source = new ReadableStream({ start(c) { c.enqueue(input); c.close(); } });
        for await (const chunk of preparePcmStream(source, 48000, 24000).audio) size += chunk.length;
        assert.equal(size, input.length / 2);
      });
      console.log('responsiveness verified');
      break;
    }
    default: throw new Error('Unknown PCM worker fixture mode');
  }
} finally {
  Worker.prototype.postMessage = nativePost;
  os.availableParallelism = nativeParallelism; syncBuiltinESMExports();
  hook.disable();
  mock.timers.reset();
}
