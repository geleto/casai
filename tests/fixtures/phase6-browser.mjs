// The browser bundle must use published Cascada support and never include Node/native media.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { dirname, resolve, join } from 'node:path';

// Exercise worker limits in the installed package alongside its public component calls.
const pkg = dirname(dirname(createRequire(resolve('package.json')).resolve('casai')));
const internals = process.argv.includes('--dist') ? 'dist' : 'src';
const internal = name => JSON.stringify(join(pkg, internals, name + (internals === 'dist' ? '.js' : '.ts')));
for (const [platform, adapter] of [['node', 'native'], ['browser', 'browser'], ['neutral', 'unavailable']]) {
  const bundle = await build({ stdin: { contents: "export { openAudio } from '#prepared-audio';", resolveDir: pkg },
    absWorkingDir: pkg, platform, format: 'esm', conditions: internals === 'src' ? ['casai-source'] : [],
    bundle: true, write: false, metafile: true, external: ['node:*', '@ai-sdk/*'] });
  assert.ok(Object.hasOwn(bundle.metafile.inputs, `${internals}/audio/${adapter}.${internals === 'src' ? 'ts' : 'js'}`), platform);
  if (platform === 'neutral') {
    const { openAudio } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
    let pulls = 0;
    const source = new ReadableStream({ pull() { pulls++; } }, { highWaterMark: 0 });
    await assert.rejects(openAudio(source, { inputAudioFormat: { type: 'audio/pcm', rate: 8000 } }), { name: 'ConfigError' });
    assert.equal(pulls, 0); assert.equal(source.locked, false);
  }
}
const recorders = {
  'review-safari-aac.mp4': 'audio/mp4',
  'review-ios-safari-aac.mp4': 'audio/mp4',
  'review-chrome-aac.mp4': 'audio/mp4',
  'review-chrome-opus.webm': 'audio/webm',
  'review-firefox-opus.ogg': 'audio/ogg',
};

const result = await build({
  stdin: { contents: `
import { create, ConfigError, ValidationError, z } from 'casai';
import { concatAudio } from ${internal('audio')};
import { writeWav, readWav, resamplePcm16, preparePcmStream, float32ToPcm16 } from ${internal('audio/pcm')};
import { experimental_resampleAudio as sdkResample, experimental_decodeRealtimeAudio as decode, experimental_encodeRealtimeAudio as encode } from 'ai';
import { convertBase64ToUint8Array, convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';

const samples = new Uint8Array([1, 0, 2, 0]);
const same = (a, b) => { if (a.length !== b.length || a.some((value, i) => value !== b[i])) throw new Error('Audio bytes differ'); };
const expected = (input, from, to) => convertBase64ToUint8Array(encode(sdkResample(decode(convertUint8ArrayToBase64(input)), from, to)));
if (['allowed', 'shared', 'single'].includes(globalThis.workerMode)) {
const parsed = await readWav(await writeWav(samples, { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' }));
if (parsed.audio.length !== 4) throw new Error('WAV round trip');
same(await float32ToPcm16(decode(convertUint8ArrayToBase64(samples))), expected(samples, 24000, 24000));
if (globalThis.workerStats.attempts !== 1) throw new Error('Sequential finite operations must reuse the worker');
const input = Uint8Array.from({ length: 4 * 1024 * 1024 + 18 }, (_, i) => i % 256).subarray(1, -1);
const original = input.slice();
const rates = [[44100, 24000], [24000, 44100]];
const beforeFinite = globalThis.workerStats.posted;
const joinsBeforeFinite = globalThis.workerStats.joins, allocationsBeforeFinite = globalThis.workerStats.allocations;
let ticks = 0; const heartbeat = setInterval(() => ticks++, 1);
const outputs = await Promise.all(rates.map(([from, to]) => resamplePcm16(input, from, to)));
clearInterval(heartbeat);
if (!ticks) throw new Error('Audio processing blocked browser timers');
for (let i = 0; i < rates.length; i++) same(outputs[i], expected(input, ...rates[i]));
const budget = Math.min(4, navigator.hardwareConcurrency || 1);
const shared = globalThis.workerMode === 'shared';
if (crossOriginIsolated !== shared) throw new Error('Expected browser isolation');
if (globalThis.workerStats.peak !== budget || globalThis.workerStats.attempts !== budget || globalThis.workerStats.posted === beforeFinite || globalThis.workerStats.maxSamples > 262144) throw new Error('Finite worker budget or job bound');
if (globalThis.workerStats.joins - joinsBeforeFinite !== (shared && budget > 1 ? 0 : 2)) throw new Error('Unexpected join');
if (globalThis.workerStats.allocations - allocationsBeforeFinite !== (shared && budget > 1 ? 2 : 0)) throw new Error('Shared allocation must use a worker');
for (const output of outputs) {
  if (shared && budget > 1 ? !(output.buffer instanceof SharedArrayBuffer) : !(output.buffer instanceof ArrayBuffer)) throw new Error('Output buffer kind');
  same(convertBase64ToUint8Array(convertUint8ArrayToBase64(output)), output);
}
const stagingBeforeWav = globalThis.workerStats.staging;
const wav = await writeWav(outputs[0], { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' });
if (globalThis.workerStats.staging - stagingBeforeWav !== (shared && budget > 1 ? 0 : 1)) throw new Error('Reuse shared input without staging');
if (new Blob([wav]).size !== wav.byteLength) throw new Error('WAV remains usable as a Blob');
const copied = await concatAudio([outputs[0]]);
if (!(copied.buffer instanceof ArrayBuffer)) throw new Error('Explicit copy must have ordinary backing memory');
same(copied, outputs[0]);
same(new Uint8Array(await new Blob([copied]).arrayBuffer()), copied);
same(new Uint8Array(await new Response(copied).arrayBuffer()), copied);
same(new Uint8Array(await (await fetch('/audio', { method: 'POST', body: copied })).arrayBuffer()), copied);
if ((await crypto.subtle.digest('SHA-256', copied)).byteLength !== 32) throw new Error('Copied bytes work with WebCrypto');
same((await readWav(wav)).audio, outputs[0]);
same(input, original);
same(await resamplePcm16(samples, 48000, 24000), expected(samples, 48000, 24000));
const beforeStream = globalThis.workerStats.posted;
const workersBeforeStream = globalThis.workerStats.attempts;
const source = new ReadableStream({ start(controller) { controller.enqueue(input); controller.close(); } });
let streamed = 0;
const expectedStream = expected(input, 48000, 24000);
for await (const chunk of preparePcmStream(source, 48000, 24000).audio) {
  same(chunk, expectedStream.subarray(streamed, streamed + chunk.length));
  if (chunk.length > 16384) throw new Error('Unbounded stream chunk');
  streamed += chunk.length;
}
if (streamed !== input.length / 2 || globalThis.workerStats.posted === beforeStream || globalThis.workerStats.attempts !== workersBeforeStream + 1) throw new Error('Stream worker ownership');
} else {
for (const action of [
  () => resamplePcm16(samples, 48000, 24000),
  () => writeWav(samples, { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' }),
  async () => { for await (const _ of preparePcmStream(new ReadableStream({ start(c) { c.enqueue(samples); c.close(); } }), 48000, 24000).audio) {} },
]) {
  let rejected = false;
  try { await action(); } catch (error) { rejected = true; if (!(error instanceof Error)) throw error; }
  if (!rejected) throw new Error('Unavailable workers must reject without inline fallback');
}
}
globalThis.workerSnapshot = { ...globalThis.workerStats };
if (['allowed', 'shared', 'single'].includes(globalThis.workerMode)) {
  const recording = new AudioBuffer({ sampleRate: 48000, numberOfChannels: 2, length: 480 });
  recording.getChannelData(0).fill(0.75);
  recording.getChannelData(1).fill(-0.25);
  const inputAudioFormat = { type: 'audio/pcm', rate: 24000 };
  const model = { specificationVersion: 'v4', provider: 'test', modelId: 'test', doStream: async ({ audio }) => {
    const chunks = []; for await (const part of audio) chunks.push(part);
    const captured = await concatAudio(chunks);
    const data = new DataView(captured.buffer);
    if (captured.length !== 480 || data.getInt16(0, true) !== 8190 || data.getInt16(478, true) !== 8190) throw new Error('Browser model received wrong PCM');
    return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'heard', outputText: 'oui', sourceText: 'yes', segments: [] }); c.close(); } }) };
  } };
  const pcm = new Float32Array(960);
  for (let i = 0; i < pcm.length; i += 2) { pcm[i] = .75; pcm[i + 1] = -.25; }
  const wav = await writeWav(new Uint8Array(pcm.buffer), { encoding: 'pcm_f32le', channels: 2, sampleRate: 48000 });
  if ((await create.Transcriber({ model, inputAudioFormat })(recording)).text !== 'heard') throw new Error('AudioBuffer transcription');
  const frame = document.body.appendChild(document.createElement('iframe'));
  try {
    const realm = frame.contentWindow;
    const tool = create.Transcriber.asTool({ model, inputAudioFormat, audio: new Uint8Array(2), inputSchema: z.object({}) });
    const foreign = new realm.AudioBuffer({ sampleRate: 48000, numberOfChannels: 2, length: 480 });
    foreign.copyToChannel(recording.getChannelData(0), 0); foreign.copyToChannel(recording.getChannelData(1), 1);
    for (const source of [foreign, new realm.Blob([wav]), new realm.File([wav], 'recording'), realm.Uint8Array.from(wav).buffer]) await tool(source);
    const raw = new realm.ReadableStream({ start(c) { c.enqueue(realm.Uint8Array.from(new Uint8Array(pcm.buffer))); c.close(); } });
    await tool.run({ audio: raw, sourceFormat: { sampleRate: 48000, channels: 2, encoding: 'pcm_f32le' } });
    try { await tool(raw); throw new Error('Repeated iframe stream accepted'); }
    catch (error) { if (!error.message.includes('already been handed off')) throw error; }
    const url = new realm.URL('https://example.invalid/recording');
    await create.Transcriber({ model: { ...model, doGenerate: async ({ mediaType }) => {
      if (mediaType !== 'audio/wav') throw new Error('Iframe URL MIME');
      return { text: 'heard', segments: [], warnings: [] };
    } }, download: async ({ url: selected }) => {
      if (selected.href !== url.href) throw new Error('Iframe URL download');
      return { data: wav, mediaType: 'audio/wav' };
    } })(url);
  } finally { frame.remove(); }
  const sourceFormat = { sampleRate: 8000, channels: 1 };
  if ((await create.Transcriber({ model, inputAudioFormat, sourceFormat })(new File([wav], 'recording'))).text !== 'heard') throw new Error('WAV layout precedence');
  const translate = create.Translator({ model, inputAudioFormat, targetLanguage: 'fr', sourceFormat });
  if ((await translate(new File([wav], 'recording', { type: '' }))).translationText !== 'oui') throw new Error('WAV translation');
  for (const prefix of [[255, 251, 0, 0], [255, 241, 0, 0]]) {
    const bytes = Uint8Array.from(prefix);
    const rawModel = { ...model, doStream: async ({ audio }) => {
      const chunks = []; for await (const chunk of audio) chunks.push(chunk);
      same(await concatAudio(chunks), bytes);
      return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'raw', segments: [] }); c.close(); } }) };
    } };
    if ((await create.Transcriber({ model: rawModel, inputAudioFormat })(new Blob([bytes]))).text !== 'raw') throw new Error('Generic raw Blob');
  }
  try {
    await create.Transcriber({ model: { ...model, doGenerate: () => { throw new Error('Wrong MIME dispatched'); } } })(new File([new Uint8Array([255, 251, 0, 0])], 'recording', { type: 'audio/basic' }));
    throw new Error('Wrong MIME accepted');
  } catch (error) { if (!error.message.includes('accurately label')) throw error; }
  for (const [filename, mime] of Object.entries(${JSON.stringify(recorders)})) {
    const bytes = new Uint8Array(await (await fetch('/' + filename)).arrayBuffer());
    const fileTranscriber = create.Transcriber({ model: { ...model, doGenerate: async ({ audio, mediaType }) => {
      if (mediaType !== mime) throw new Error(filename + ' dispatched as ' + mediaType);
      same(audio, bytes);
      return { text: filename, segments: [], warnings: [] };
    } } });
    const wrongType = mime === 'audio/webm' ? 'audio/mp4' : 'audio/webm';
    for (const input of [bytes, new Blob([bytes]), new File([bytes], filename, { type: mime }), new Blob([bytes], { type: wrongType })]) {
      if ((await fileTranscriber(input)).text !== filename) throw new Error('Recording did not reach file transcription');
    }
  }
}
const template = create.Template({ template: 'Hello {{ name }}' });
if (await template({ name: 'browser' }) !== 'Hello browser') throw new Error('Template');
const script = create.Script({ script: 'return add(2, 3)', context: { add: (a, b) => a + b } });
if (await script() !== 5) throw new Error('Script');
const loaded = create.Transcriber.loadsAudio({ model: {}, inputAudioFormat: { type: 'audio/pcm', rate: 24000 } });
for (const call of [() => loaded(samples), () => loaded(new File([samples], 'audio.wav'))]) {
  let failure;
  try { await call(); } catch (error) { failure = error; }
  const hasCodec = ${process.env.CASAI_PACKED_RECORDER === '1'};
  if (hasCodec && globalThis.workerMode === 'blocked') {
    if (!(failure instanceof Error) || !/worker|content security/i.test(failure.message)) throw failure ?? new Error('Expected worker startup failure');
  } else if (!(failure instanceof (hasCodec && globalThis.workerMode !== 'unavailable' ? ValidationError : ConfigError))) {
    throw failure ?? new Error('Expected rejection for undescribed bytes');
  }
}
globalThis.browserAcceptance = true;
`, resolveDir: process.cwd(), sourcefile: 'browser-consumer.ts', loader: 'ts' },
  bundle: true, minify: true, keepNames: true, platform: 'browser', format: 'esm', target: 'es2024', conditions: process.argv.includes('--dist') ? [] : ['casai-source'], write: false, metafile: true,
});
const inputs = Object.keys(result.metafile.inputs);
assert(!inputs.some(name => /node_modules\/node-av|audio\/native\.[jt]s|pcm-worker\.node|node-loaders/.test(name)), 'No native implementation in browser graph');
assert(inputs.some(name => /cascada.*browser\/index\.js/.test(name)), 'Use Cascada browser exports');
await mkdir('.cache/phase6-browser', { recursive: true });
await writeFile('.cache/phase6-browser/bundle.js', result.outputFiles[0].text);
// Reuse the linked engine's existing browser-test installation, without adding a runtime dependency.
const engineRequire = createRequire(import.meta.resolve('cascada-engine'));
const { chromium } = engineRequire('playwright');
const recordings = new Map(await Promise.all(Object.keys(recorders).map(async name =>
  ['/' + name, await readFile(new URL(name, import.meta.url))])));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CASAI_REVIEW_CHROMIUM });
const server = createServer((request, response) => {
  if (recordings.has(request.url)) {
    response.end(recordings.get(request.url));
    return;
  }
  if (request.url === '/audio') {
    // Complete the upload before responding: browser fetch exposes the response after upload completion.
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => response.end(Buffer.concat(chunks)));
    return;
  }
  if (request.url === '/shared') {
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }
  if (request.url === '/blocked') response.setHeader('Content-Security-Policy', "worker-src 'none'");
  response.setHeader('Content-Type', 'text/html');
  response.end('<html><head></head><body></body></html>');
});
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  for (const mode of ['allowed', 'shared', 'single', 'blocked', 'unavailable']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    await page.goto(`http://127.0.0.1:${server.address().port}/${mode}`);
    await page.evaluate(mode => {
      globalThis.workerMode = mode;
      const stats = globalThis.workerStats = { attempts: 0, live: 0, peak: 0, streamClosures: 0, posted: 0, urls: 0, joins: 0, allocations: 0, staging: 0, yields: 0, ports: 0, maxSamples: 0 };
      if (mode === 'single') Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 1 });
      if (mode === 'allowed' || mode === 'single') {
        Object.defineProperty(globalThis, 'scheduler', { configurable: true, value: undefined });
        const NativeChannel = MessageChannel;
        globalThis.MessageChannel = class extends NativeChannel {
          constructor() {
            super(); stats.yields++; stats.ports += 2;
            for (const port of [this.port1, this.port2]) {
              const close = port.close.bind(port);
              port.close = () => { stats.ports--; close(); };
            }
          }
        };
      } else if (mode === 'shared') {
        const yieldTask = scheduler.yield.bind(scheduler);
        scheduler.yield = () => { stats.yields++; return yieldTask(); };
      }
      if (mode === 'shared') globalThis.SharedArrayBuffer = new Proxy(SharedArrayBuffer, { construct() { throw new Error('Shared output must be allocated in a worker'); } });
      const NativeWorker = globalThis.Worker;
      globalThis.Worker = mode === 'unavailable' ? undefined : class extends NativeWorker {
        constructor(...args) { stats.attempts++; super(...args); stats.peak = Math.max(stats.peak, ++stats.live); }
        postMessage(...args) {
          stats.posted++;
          if (args[0].type === 'resampleStream') this.streaming = true;
          if (args[0].type === 'concatAudio') stats.joins++;
          if (args[0].type === 'allocateShared') stats.allocations++;
          if (args[0].type === 'allocate') stats.staging++;
          if (args[0].type === 'resample') stats.maxSamples = Math.max(stats.maxSamples, args[0].args[3]);
          return super.postMessage(...args);
        }
        terminate() { stats.live--; if (this.streaming) stats.streamClosures++; return super.terminate(); }
      };
      const createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL;
      URL.createObjectURL = (...args) => { stats.urls++; return createURL(...args); };
      URL.revokeObjectURL = (...args) => { stats.urls--; return revokeURL(...args); };
    }, mode);
    await page.addScriptTag({ type: 'module', content: result.outputFiles[0].text });
    await page.waitForFunction(() => globalThis.browserAcceptance === true, undefined, { timeout: 15000 }).catch(error => { throw errors[0] ?? error; });
    assert.deepEqual(errors, []);
    const snapshot = await page.evaluate(() => globalThis.workerSnapshot);
    if (mode === 'allowed' || mode === 'shared' || mode === 'single') {
      const budget = await page.evaluate(() => Math.min(4, navigator.hardwareConcurrency || 1));
      assert.equal(snapshot.streamClosures, 1, 'The stream closes its own worker at EOF');
      assert(snapshot.live <= budget, 'Only finite workers may remain, subject to idle expiry');
      assert(snapshot.yields > 0, 'Both scheduler.yield and the MessageChannel fallback execute real task yields');
      assert.equal(snapshot.ports, 0, 'Fallback ports close before preparation resumes');
      await page.waitForFunction(() => globalThis.workerStats.live === 0, undefined, { timeout: 10000 });
    } else {
      assert.equal(snapshot.live, 0);
      assert.equal(mode === 'blocked' ? snapshot.attempts > 0 : snapshot.attempts === 0, true);
      assert(snapshot.attempts <= 3, 'Each failing call attempts at most one worker');
    }
    assert.equal(await page.evaluate(() => globalThis.workerStats.urls), 0, 'Blob URLs released');
    await page.close();
  }
} finally { server.close(); await browser.close(); }
console.log('Browser entry, Cascada composition, shared/unshared PCM workers, CSP, cleanup and prepared input errors passed in Chromium.');
