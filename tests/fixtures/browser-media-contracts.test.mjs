import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildRecordingWorker } from '../../scripts/build-recording-worker.mjs';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';
import { coarseClockPcm, fragmentedPcm, largeIndexedPcm, pcmWave } from './pcm-recordings.mjs';

const audioEntry = "export { Transcriber, Translator, Config, ConfigError, ValidationError, z } from 'casai'; export { createOpenAI } from '@ai-sdk/openai';";
const requireEngine = createRequire(import.meta.resolve('cascada-engine'));
const bundles = new Map();
const candidate = process.env.CASAI_MEDIABUNNY_ENTRY;
const packedCodec = process.env.CASAI_PACKED_RECORDER === '1';
const recordingTest = candidate || packedCodec ? test : test.skip;
let browser, recordingWorker;
before(async () => {
  if (candidate) recordingWorker = await buildRecordingWorker(candidate);
  const { chromium, firefox } = requireEngine('playwright');
  browser = process.env.CASAI_RECORDER_BROWSER === 'firefox' ? await firefox.launch() : await chromium.launch({
    executablePath: process.env.CASAI_REVIEW_CHROMIUM,
    channel: process.env.CASAI_RECORDER_BROWSER,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
});
after(async () => { await browser?.close(); });

test('a live provider transcribes the browser-prepared spoken recording', { skip: process.env.CASAI_LIVE_BROWSER_AUDIO !== '1' }, async t => {
  await import('dotenv/config');
  assert.ok(process.env.OPENAI_API_KEY, 'Configure OPENAI_API_KEY for the paid transcription check.');
  const page = await openPage(t, audioEntry);
  const recording = await readFile(new URL('browser-spoken.flac', import.meta.url));
  await page.route('https://casai.test/recording', route => route.fulfill({ body: recording }));
  await page.route('https://casai.test/provider/audio/transcriptions', async route => {
    // Only the host can authorize the real request. The browser sends a provider-ready multipart WAV.
    const request = route.request(), headers = { 'content-type': request.headers()['content-type'] };
    const body = request.postDataBuffer();
    const file = (await new Request(request.url(), { method: 'POST', headers, body }).formData()).get('file');
    assert.equal(file.type, 'audio/wav');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', body,
      headers: { ...headers, authorization: 'Bearer ' + process.env.OPENAI_API_KEY }, signal: AbortSignal.timeout(45000) });
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
  const text = await page.evaluate(async encoded => {
    const { Transcriber, createOpenAI } = consumer;
    const recording = await (await fetch('/recording')).blob();
    const source = encoded ? recording : await new OfflineAudioContext(1, 1, 48000).decodeAudioData(await recording.arrayBuffer());
    const model = createOpenAI({ baseURL: 'https://casai.test/provider', apiKey: 'host-relay' }).transcription('gpt-4o-mini-transcribe');
    const transcribe = Transcriber.loadsAudio({ model, maxRetries: 0, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', channels: 1, rate: 24000 } });
    return (await transcribe.run({ audio: source, abortSignal: AbortSignal.timeout(55000) })).text;
  }, !!candidate || packedCodec);
  assert.match(text, /blue notebook/i); assert.match(text, /twenty[- ]three|23/i);
});

async function openPage(t, entry, voiceRelay) {
  if (!bundles.has(entry)) {
    const result = await build({ stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true, write: false,
      plugins: candidatePlugins(),
      platform: 'browser', format: 'iife', globalName: 'consumer', conditions: process.argv.includes('--dist') ? [] : ['casai-source'] });
    bundles.set(entry, result.outputFiles[0].text);
  }
  const page = await browser.newPage();
  t.after(() => page.close());
  page.setDefaultTimeout(5000);
  if (voiceRelay) await page.routeWebSocket('wss://casai.test/voice', voiceRelay);
  await page.route('https://casai.test/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.goto('https://casai.test/');
  await page.addScriptTag({ content: bundles.get(entry) });
  return page;
}

function candidatePlugins() {
  return recordingWorker ? [{ name: 'candidate-recorder', setup(plugin) {
    plugin.onResolve({ filter: /\/recording-worker-source\.js$/ }, () => ({ namespace: 'candidate', path: 'worker' }));
    plugin.onLoad({ filter: /.*/, namespace: 'candidate' }, () => ({ contents: 'export const recordingWorkerSource = ' + JSON.stringify(recordingWorker) }));
  } }] : [];
}

test('the PCM microphone example delivers captions and collected transcription while capture is open', { timeout: 30000 }, async t => {
  const { createServer } = await import('node:http');
  const modules = new Map();
  for (const name of ['microphone-pcm.mjs', 'microphone-worklet.mjs']) {
    modules.set('/' + name, await readFile(new URL('../../docs/examples/' + name, import.meta.url)));
  }
  const server = createServer((req, res) => {
    const module = modules.get(req.url);
    res.writeHead(200, { 'Content-Type': module ? 'text/javascript' : 'text/html' });
    res.end(module ?? '<button>Capture audio</button>');
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const page = await openPage(t, audioEntry);
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.addScriptTag({ content: bundles.get(audioEntry) });
  await page.getByRole('button').click();
  const observed = await page.evaluate(async () => {
    const { captureMicrophonePcm, transcribeMicrophone } = await import('/microphone-pcm.mjs');
    const context = new AudioContext(), device = context.createMediaStreamDestination();
    const tone = context.createConstantSource();
    tone.offset.value = 0.25;
    tone.connect(device); tone.start();
    const [track] = device.stream.getAudioTracks();
    const observations = [];
    try {
      await context.resume();
      for (const captions of [true, false]) {
        const capture = await captureMicrophonePcm(context, track);
        let heard, beforeStop = false, stopped = false, calls = 0, peak = 0;
        const firstSignal = new Promise(resolve => { heard = resolve; });
        const rate = captions ? context.sampleRate : 16000;
        const model = { specificationVersion: 'v4', provider: 'local', modelId: 'mic', async doStream({ audio, inputAudioFormat }) {
          calls++;
          if (inputAudioFormat.rate !== rate) throw new Error('Unexpected PCM rate');
          return { stream: new ReadableStream({ async start(controller) {
            const reader = audio.getReader();
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
                for (let i = 0; i < view.byteLength; i += 2) peak = Math.max(peak, view.getInt16(i, true));
                if (peak > 7000 && !beforeStop) {
                  beforeStop = !stopped;
                  controller.enqueue({ type: 'transcript-partial', text: 'during capture' }); heard();
                }
              }
              controller.enqueue({ type: 'finish', text: 'done', segments: [] }); controller.close();
            } catch (error) { controller.error(error); } finally { reader.releaseLock(); }
          } }) };
        } };
        const component = (captions ? consumer.Transcriber.asStream : consumer.Transcriber)({ model,
          inputAudioFormat: { type: 'audio/pcm', rate }, sourceFormat: capture.sourceFormat });
        const run = component(capture.audio);
        let text;
        if (captions) {
          const result = await run, reader = result.fullStream.getReader();
          if ((await reader.read()).value.text !== 'during capture') throw new Error('Missing caption');
          stopped = true; capture.stop();
          while (!(await reader.read()).done) {}
          text = await result.text;
        } else {
          await firstSignal;
          stopped = true; capture.stop();
          text = (await run).text;
        }
        observations.push({ calls, beforeStop, text, peak, liveTrack: track.readyState === 'live' });
      }
      const stalled = await captureMicrophonePcm(context, track);
      // No reader requests a block. Capture must fail at its queue bound.
      const reader = stalled.audio.getReader();
      const failure = await reader.closed.then(() => '', error => error.message);
      const abort = new AbortController(), cancelled = await captureMicrophonePcm(context, track, abort.signal);
      const reason = new Error('cancel capture'); abort.abort(reason);
      const owned = track.clone(), stop = new AbortController();
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => new MediaStream([owned]) });
      let endedBeforeReply;
      const final = await transcribeMicrophone({ async run({ audio }) {
        const input = audio.getReader();
        if ((await input.read()).done) throw Error('Expected live microphone PCM');
        stop.abort(); endedBeforeReply = owned.readyState === 'ended';
        while (!(await input.read()).done) {}
        return { text: 'finished' };
      } }, { stopSignal: stop.signal });
      const callbackTrack = track.clone(), callbackError = new Error('caption target closed');
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => new MediaStream([callbackTrack]) });
      let providerSignal;
      const captioner = consumer.Transcriber.asStream({ inputAudioFormat: { type: 'audio/pcm', rate: context.sampleRate }, model: {
        specificationVersion: 'v4', provider: 'local', modelId: 'captions', async doStream({ abortSignal }) {
          providerSignal = abortSignal;
          return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'transcript-partial', text: 'still listening' }); } }) };
        },
      } });
      const callbackFailed = await transcribeMicrophone(captioner, {
        stopSignal: new AbortController().signal, onEvent() { throw callbackError; },
      }).then(() => false, error => error === callbackError);
      let grant, prompt;
      const permission = new Promise(resolve => { grant = resolve; });
      const waiting = new Promise(resolve => { prompt = resolve; });
      const late = track.clone(), abandoned = new AbortController();
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: () => { prompt(); return permission; } });
      const abandonedRun = transcribeMicrophone({ run() { throw Error('Unexpected late provider call'); } }, { stopSignal: abandoned.signal })
        .then(() => false, error => error === reason);
      await waiting;
      abandoned.abort(reason);
      const stoppedBeforePermission = await abandonedRun;
      grant(new MediaStream([late]));
      await new Promise(done => setTimeout(done, 0));
      return { observations, failure, abortReason: await cancelled.audio.getReader().read().then(() => false, error => error === reason),
        trackState: track.readyState, endedBeforeReply, final, stoppedBeforePermission, lateTrack: late.readyState,
        callbackFailed, providerAbortedWithCause: providerSignal?.reason === callbackError, callbackTrack: callbackTrack.readyState };
    } finally { track.stop(); tone.stop(); await context.close(); }
  });
  for (const result of observed.observations) {
    assert.deepEqual({ ...result, peak: undefined }, { calls: 1, beforeStop: true, text: 'done', peak: undefined, liveTrack: true });
    assert.ok(result.peak >= 8188 && result.peak <= 8193, 'quarter-scale mono PCM16');
  }
  assert.match(observed.failure, /one second/);
  assert.equal(observed.abortReason, true);
  assert.equal(observed.trackState, 'live');
  assert.equal(observed.endedBeforeReply, true);
  assert.equal(observed.final, 'finished');
  assert.equal(observed.callbackFailed, true);
  assert.equal(observed.providerAbortedWithCause, true);
  assert.equal(observed.callbackTrack, 'ended');
  assert.equal(observed.stoppedBeforePermission, true);
  assert.equal(observed.lateTrack, 'ended');
});

test('browser transcription tools fetch model URLs locally even with a URL-capable provider', async t => {
  const page = await openPage(t, audioEntry);
  const bytes = await readFile(new URL('review-ios-safari-aac.mp4', import.meta.url));
  let downloads = 0;
  await page.route('https://casai.test/memo', route => {
    downloads++;
    return route.fulfill({ body: bytes, contentType: 'application/octet-stream' });
  });
  const received = await page.evaluate(async () => {
    const result = { text: 'heard', segments: [], warnings: [], response: { timestamp: new Date(), modelId: 'fixture' } };
    let urls = 0, fileType, digest;
    const model = { specificationVersion: 'v4', provider: 'fixture', modelId: 'fixture',
      async doGenerateFromUrl() { urls++; return result; },
      async doGenerate({ audio, mediaType }) {
        fileType = mediaType;
        digest = new Uint8Array(await crypto.subtle.digest('SHA-256', audio)).toHex();
        return result;
      } };
    const listen = consumer.Transcriber.asTool({ model, maxRetries: 0,
      inputSchema: consumer.z.object({ audio: consumer.z.url().transform(value => new URL(value)) }) });
    const { text } = await listen.execute({ audio: new URL('https://casai.test/memo') }, { toolCallId: 'local', messages: [] });
    return { text, urls, fileType, digest };
  });
  assert.equal(downloads, 1);
  assert.deepEqual(received, { text: 'heard', urls: 0, fileType: 'audio/mp4', digest: createHash('sha256').update(bytes).digest('hex') });
});

const recorderFormats = process.env.CASAI_RECORDER_BROWSER === 'firefox' ? ['audio/ogg;codecs=opus']
  : ['audio/webm;codecs=opus', ...(process.env.CASAI_RECORDER_BROWSER === 'chrome' ? ['audio/mp4;codecs=mp4a.40.2'] : [])];

test('a live adapter receives the original recording bytes without a codec worker or a whole Blob read', async t => {
  const page = await openPage(t, audioEntry);
  const bytes = await readFile(new URL('review-android-chrome-open-cluster.webm', import.meta.url));
  const expected = createHash('sha256').update(bytes).digest('hex');
  const result = await page.evaluate(async base64 => {
    globalThis.Worker = class { constructor() { throw Error('unexpected media worker'); } };
    const recording = new File([Uint8Array.fromBase64(base64)], 'memo.webm', { type: 'audio/webm;codecs=opus' });
    recording.arrayBuffer = () => { throw Error('unexpected whole File read'); };
    const format = { type: 'audio/webm' };
    const uploads = [];
    const model = { specificationVersion: 'v4', provider: 'test', modelId: 'test',
      async doStream({ audio, inputAudioFormat }) {
        const data = await new Response(audio).arrayBuffer();
        uploads.push([inputAudioFormat.type, new Uint8Array(await crypto.subtle.digest('SHA-256', data)).toHex()]);
        return { stream: new ReadableStream({ start(controller) {
          controller.enqueue({ type: 'transcript-delta', delta: 'heard' });
          controller.enqueue({ type: 'finish', text: 'heard', segments: [] });
          controller.close();
        } }) };
      } };
    const final = await consumer.Transcriber({ model, inputAudioFormat: format })(recording);
    const live = await consumer.Transcriber.asStream({ model, inputAudioFormat: format })(Uint8Array.fromBase64(base64));
    const events = await Array.fromAsync(live.fullStream);
    return { text: final.text, delta: events.find(event => event.type === 'transcript-delta')?.delta, uploads };
  }, bytes.toString('base64'));
  assert.deepEqual(result, { text: 'heard', delta: 'heard', uploads: [['audio/webm', expected], ['audio/webm', expected]] });
});

recordingTest('an open Android Chrome WebM cluster delivers the first PCM before its tail', { timeout: 20000 }, async t => {
  const page = await openPage(t, audioEntry);
  const original = await readFile(new URL('review-android-chrome-open-cluster.webm', import.meta.url));
  const result = await page.evaluate(async encoded => {
    const bytes = Uint8Array.fromBase64(encoded);
    const releaseTail = Promise.withResolvers();
    let offset = 0, early = false;
    const source = new ReadableStream({ async pull(c) {
      if (offset === bytes.length) return c.close();
      if (offset) await releaseTail.promise;
      const chunk = bytes.subarray(offset, offset ? bytes.length : 12 * 1024);
      offset += chunk.length;
      c.enqueue(chunk);
    } }, { highWaterMark: 0 });
    const samples = [];
    const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio }) {
      return { stream: new ReadableStream({ async start(c) {
        try {
          for await (const chunk of audio) {
            samples.push(chunk);
            if (samples.length === 1) c.enqueue({ type: 'transcript-delta', delta: 'heard' });
          }
          c.enqueue({ type: 'finish', text: 'done', segments: [] });
          c.close();
        } catch (error) { c.error(error); }
      } }) };
    } };
    const component = consumer.Transcriber.loadsAudio.asStream({ model, inputAudioFormat: { type: 'audio/pcm', rate: 48000 } });
    const abort = new AbortController(), timeout = setTimeout(() => abort.abort(Error('No partial from complete Opus blocks')), 8000);
    try {
      const result = await component.run({ audio: source, abortSignal: abort.signal });
      for await (const part of result.fullStream) if (part.type === 'transcript-delta') {
        early = offset === 12 * 1024;
        releaseTail.resolve();
      }
      const pcm = new Uint8Array(await new Blob(samples).arrayBuffer());
      return { early, lockedAtEnd: source.locked, text: await result.text, pcm: pcm.toBase64() };
    } finally { clearTimeout(timeout); releaseTail.resolve(); }
  }, original.toString('base64'));
  assert.deepEqual([result.early, result.lockedAtEnd, result.text], [true, false, 'done']);
  const raw = Buffer.from(result.pcm, 'base64');
  assert.equal(raw.length, 452160 * 2);
  if (process.env.CASAI_REVIEW_FFMPEG) {
    const reference = execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', '-c:a', 'libopus', '-request_sample_fmt', 'flt',
      '-i', 'pipe:0', '-af', 'pan=mono|c0=0.5*c0+0.5*c1,asetpts=N/SR/TB', '-f', 's16le', 'pipe:1'], { input: original });
    assert.equal(raw.length, reference.length);
    for (let offset = 0; offset < raw.length; offset += 2) {
      assert.ok(Math.abs(raw.readInt16LE(offset) - reference.readInt16LE(offset)) <= 16, 'PCM sample at byte ' + offset);
    }
  }
});

recordingTest('one HTTP 200 delivers Android recorder PCM while its response tail is held', { timeout: 20000 }, async t => {
  const { createServer } = await import('node:http');
  const original = await readFile(new URL('review-android-chrome-open-cluster.webm', import.meta.url));
  let requests = 0, sentTail = false, early = false;
  const release = Promise.withResolvers();
  const server = createServer(async (req, res) => {
    if (req.url !== '/recording') { res.end('<title>Open recorder</title>'); return; }
    requests++;
    res.writeHead(200, { 'Content-Type': 'audio/webm', 'Content-Length': original.length });
    res.write(original.subarray(0, 12 * 1024));
    const deadline = setTimeout(release.resolve, 8000);
    try { await release.promise; } finally { clearTimeout(deadline); }
    sentTail = true;
    res.end(original.subarray(12 * 1024));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => { release.resolve(); server.closeAllConnections(); server.close(); });
  const page = await openPage(t, audioEntry);
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.addScriptTag({ content: bundles.get(audioEntry) });
  await page.exposeFunction('heardPrefix', () => { early = !sentTail; release.resolve(); });
  const pcmBytes = await page.evaluate(async () => {
    let count = 0;
    const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio }) {
      for await (const chunk of audio) {
        if (!count) await window.heardPrefix();
        count += chunk.byteLength;
      }
      return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'heard', segments: [] }); c.close(); } }) };
    } };
    await consumer.Transcriber.loadsAudio({ model, inputAudioFormat: { type: 'audio/pcm', rate: 48000 } })(new URL('/recording', location.href));
    return count;
  });
  assert.deepEqual([early, requests, pcmBytes], [true, 1, 452160 * 2]);
});

for (const mimeType of recorderFormats) {
  recordingTest('live MediaRecorder ' + mimeType + ' reaches the caller before stop and matches the finished recording', { timeout: 30000 }, async t => {
    const page = await openPage(t, audioEntry);
    await page.evaluate(mimeType => {
      const button = document.createElement('button');
      button.textContent = 'Record';
      document.body.append(button);
      window.captureResult = new Promise((resolve, reject) => {
        button.onclick = () => record().then(resolve, reject);
      });

      async function record() {
        const context = new AudioContext({ sampleRate: 48000 });
        const tone = context.createOscillator(), sink = context.createMediaStreamDestination();
        const recorder = new MediaRecorder(sink.stream, { mimeType, audioBitsPerSecond: 128000 });
        const stopped = new Promise(resolve => recorder.addEventListener('stop', resolve, { once: true }));
        const chunks = [], livePcm = [], finishedPcm = [];
        const partial = Promise.withResolvers(), readMore = Promise.withResolvers(), nextChunk = Promise.withResolvers();
        const abort = new AbortController();
        const deadline = setTimeout(() => abort.abort(Error('Recorder did not produce a live partial or finish')), 18000);
        const aborted = new Promise((_, reject) => abort.signal.addEventListener('abort', () => reject(abort.signal.reason), { once: true }));
        let input, writes = Promise.resolve(), waitingForChunk = false;
        const source = new ReadableStream({ start(controller) { input = controller; } });
        recorder.ondataavailable = ({ data }) => {
          if (!data.size) return;
          writes = writes.then(async () => {
            const bytes = new Uint8Array(await data.arrayBuffer());
            chunks.push(bytes);
            input.enqueue(bytes);
            if (waitingForChunk) nextChunk.resolve();
          });
        };

        async function transcribe(audio, pcm, live) {
          const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio }) {
            return { stream: new ReadableStream({ async start(controller) {
              try {
                for await (const samples of audio) {
                  if (!samples.byteLength) continue;
                  pcm.push(samples);
                  if (pcm.length === 1) {
                    controller.enqueue({ type: 'transcript-delta', delta: 'hearing' });
                    if (live) await readMore.promise;
                  }
                }
                controller.enqueue({ type: 'finish', text: 'heard', segments: [] });
                controller.close();
              } catch (error) { controller.error(error); }
            } }) };
          } };
          const component = consumer.Transcriber.loadsAudio.asStream({ model, inputAudioFormat: { type: 'audio/pcm', rate: 48000 } });
          const result = await component.run({ audio, abortSignal: abort.signal });
          for await (const part of result.fullStream) {
            if (live && part.type === 'transcript-delta') partial.resolve(recorder.state);
          }
          return await result.text;
        }

        try {
          tone.connect(sink);
          tone.start();
          await context.resume();
          recorder.start(150);
          const live = transcribe(source, livePcm, true);
          const stateAtPartial = await Promise.race([partial.promise, live, aborted]);
          const countAtPartial = chunks.length;
          // Keep the provider's reader paused through another actual recorder chunk.
          waitingForChunk = true;
          await Promise.race([nextChunk.promise, live, aborted]);
          recorder.stop();
          await stopped;
          await writes;
          input.close();
          readMore.resolve();
          const liveText = await Promise.race([live, aborted]);
          const blobText = await Promise.race([transcribe(new Blob(chunks, { type: recorder.mimeType }), finishedPcm, false), aborted]);

          // Replay the same ordered bytes with its last chunk held. A file operation needs EOF.
          const tailRequested = Promise.withResolvers(), releaseTail = Promise.withResolvers();
          let index = 0, requests = 0;
          const held = new ReadableStream({ async pull(controller) {
            if (index === chunks.length - 1) { tailRequested.resolve(); await releaseTail.promise; }
            if (index === chunks.length) controller.close();
            else controller.enqueue(chunks[index++]);
          } }, { highWaterMark: 0 });
          const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doGenerate({ audio, mediaType }) {
            requests++;
            if (mediaType !== 'audio/wav' || audio.length <= 44) throw Error('Expected a complete WAV');
            return { text: 'file', segments: [], warnings: [], response: { timestamp: new Date(), modelId: 'fixture' } };
          } };
          const file = consumer.Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' }, maxRetries: 0 });
          const completed = file.run({ audio: held, abortSignal: abort.signal });
          let beforeTail;
          try {
            await Promise.race([tailRequested.promise, completed, aborted]);
            beforeTail = requests;
          } finally { releaseTail.resolve(); }
          const fileText = (await Promise.race([completed, aborted])).text;
          const pcm = new Uint8Array(await new Blob(livePcm).arrayBuffer());
          const finished = new Uint8Array(await new Blob(finishedPcm).arrayBuffer());
          return { stateAtPartial, moreChunks: chunks.length > countAtPartial, liveText, blobText, fileText, beforeTail, requests,
            identical: pcm.length > 0 && pcm.length === finished.length && pcm.every((byte, i) => byte === finished[i]) };
        } finally {
          clearTimeout(deadline);
          readMore.resolve();
          if (recorder.state !== 'inactive') recorder.stop();
          tone.stop();
          sink.stream.getTracks().forEach(track => track.stop());
          await context.close();
        }
      }
    }, mimeType);
    await page.getByRole('button', { name: 'Record' }).click();
    assert.deepEqual(await page.evaluate(() => window.captureResult), {
      stateAtPartial: 'recording', moreChunks: true, liveText: 'heard', blobText: 'heard', fileText: 'file',
      beforeTail: 0, requests: 1, identical: true,
    });
  });
}

test('a code-split consumer requests the prepared worker only when it opens its source', { timeout: 45000 }, async t => {
  const contents = `
    import { Transcriber } from 'casai';
    const model = { specificationVersion: 'v4', provider: 'test', modelId: 'test', async doGenerate() { return { text: 'received', segments: [], warnings: [] }; } };
    const ordinary = Transcriber({ model });
    const file = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
    export const prepare = () => file(new AudioBuffer({ length: 64, numberOfChannels: 1, sampleRate: 24000 }));
    export const record = async () => file(await (await fetch('/recording')).blob());
    export const send = async () => ordinary(await (await fetch('/recording')).blob());
  `;
  const buildResult = await build({ stdin: { contents, resolveDir: process.cwd(), sourcefile: 'app.js' }, platform: 'browser',
    format: 'esm', outdir: 'web', entryNames: 'app', bundle: true, splitting: true, minify: true, write: false, metafile: true,
    conditions: process.argv.includes('--dist') ? [] : ['casai-source'], plugins: candidatePlugins() });
  const paths = Object.entries(buildResult.metafile.outputs);
  const chunk = pattern => paths.find(([, output]) => Object.keys(output.inputs).some(name => pattern.test(name)))?.[0].split('/').pop();
  const pcm = chunk(/\/browser-worker-source\.[jt]s$/), codec = packedCodec ? chunk(/\/recording-worker-source\.[jt]s$/) : chunk(/candidate:worker$/);
  assert.ok(pcm && pcm !== 'app.js');
  if (candidate || packedCodec) assert.ok(codec && codec !== pcm && codec !== 'app.js');
  const page = await browser.newPage(); t.after(() => page.close());
  const requests = new Set();
  await page.route('https://casai.test/**', async route => {
    const path = new URL(route.request().url()).pathname.slice(1);
    if (!path) return route.fulfill({ contentType: 'text/html', body: '<title>Worker loading</title>' });
    if (path === 'recording') return route.fulfill({ body: await readFile(new URL('review-safari-aac.mp4', import.meta.url)) });
    requests.add(path);
    const file = buildResult.outputFiles.find(item => item.path.replaceAll('\\', '/').endsWith('/' + path));
    return file ? route.fulfill({ contentType: 'text/javascript', body: file.text }) : route.fulfill({ status: 404 });
  });
  await page.goto('https://casai.test/');
  await page.evaluate(async () => { globalThis.app = await import('/app.js'); await app.send(); });
  assert.equal(requests.has(pcm), false); if (codec) assert.equal(requests.has(codec), false);
  await page.evaluate(() => app.prepare()); assert.equal(requests.has(pcm), true);
  if (codec) {
    assert.equal(requests.has(codec), false); await page.evaluate(() => app.record()); assert.equal(requests.has(codec), true);
  }
  t.diagnostic(`Prepared PCM asset ${paths.find(([name]) => name.endsWith('/' + pcm))[1].bytes} bytes`
    + (codec ? `, qualified recorder asset ${paths.find(([name]) => name.endsWith('/' + codec))[1].bytes} bytes` : ''));
});

async function transcribeRecording(t, recording, { label = '', target, changeInput, sampleWindow, referencePCM } = {}) {
  const reference = await readFile(new URL(recording, import.meta.url));
  const source = changeInput ? changeInput(Buffer.from(reference)) : reference;
  const page = await openPage(t, audioEntry);
  await page.route('https://casai.test/recording', route => route.fulfill({ body: source }));
  if (changeInput) await page.route('https://casai.test/reference', route => route.fulfill({ body: reference }));
  if (referencePCM) await page.route('https://casai.test/reference-pcm', route => route.fulfill({ body: referencePCM }));
  return page.evaluate(async ({ label, target, separateReference, sampleWindow, referencePCM }) => {
    const { Transcriber, createOpenAI, ValidationError } = consumer;
    const bytes = await (await fetch('/recording')).arrayBuffer();
    const file = new File([bytes], 'upload.bin', { type: label });
    const uploads = [];
    const model = createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      const part = (await new Request(url, init).formData()).get('file');
      uploads.push(part);
      return Response.json({ text: 'received' });
    } }).transcription('whisper-1');
    let text, validationError, nativeError;
    try {
      const transcribe = target ? Transcriber.loadsAudio({ model, fileAudioTarget: target }) : Transcriber({ model });
      text = (await transcribe(file)).text;
    } catch (error) {
      if (error instanceof ValidationError) validationError = error.message;
      else nativeError = error instanceof Error ? error.message : String(error);
    }
    const files = [];
    for (const part of uploads) {
      const data = await part.arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data)).toHex();
      const result = { name: part.name, type: part.type, digest };
      if (target) {
        const decoder = new OfflineAudioContext(1, 1, 48000);
        const prepared = await decoder.decodeAudioData(referencePCM ? data.slice(0) : data);
        result.frames = prepared.length;
        result.channels = prepared.numberOfChannels;
        if (referencePCM) {
          const samples = new Int16Array(await (await fetch('/reference-pcm')).arrayBuffer());
          const header = new DataView(data);
          if (header.getUint32(36) !== 0x64617461 || header.getUint16(34, true) !== 16) throw Error('Expected PCM16 WAV');
          if (target.rate && header.getUint32(24, true) !== target.rate) throw Error('Unexpected WAV sample rate');
          const actual = new Int16Array(data, 44, header.getUint32(40, true) / 2);
          if (samples.length !== actual.length) throw new Error('Different lengths: ' + samples.length + ' and ' + actual.length);
          let peak = 0;
          for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(actual[i] - samples[i]));
          result.ffmpegPeak = peak;
        }
        if (sampleWindow) {
          result.samples = Array.from(prepared.getChannelData(0).subarray(...sampleWindow));
        } else {
          const originalBytes = separateReference ? await (await fetch('/reference')).arrayBuffer() : bytes.slice(0);
          const original = await decoder.decodeAudioData(originalBytes);
          if (original.numberOfChannels !== prepared.numberOfChannels || original.length < prepared.length)
            throw new Error('Prepared recording has extra frames or a different channel count');
          let maxDifference = 0;
          for (let channel = 0; channel < prepared.numberOfChannels; channel++) {
            const a = original.getChannelData(channel), b = prepared.getChannelData(channel);
            for (let i = 0; i < b.length; i++) {
              // A floating-point decoder may overshoot full scale. The provider selected signed PCM16.
              const expected = target.codec === 'pcm_s16le' ? Math.max(-1, Math.min(32767 / 32768, a[i])) : a[i];
              const difference = Math.abs(expected - b[i]);
              if (difference > maxDifference) { maxDifference = difference; result.worst = [i, b[i], expected]; }
            }
          }
          result.maxDifference = maxDifference;
        }
      }
      files.push(result);
    }
    return { text, validationError, nativeError, files };
  }, { label, target, separateReference: !!changeInput, sampleWindow, referencePCM: !!referencePCM });
}

const recorders = [
  ['review-safari-aac.mp4', 'audio.m4a', 'audio/mp4', 'audio/webm'],
  ['review-ios-safari-aac.mp4', 'audio.m4a', 'audio/mp4', ''],
  ['review-chrome-aac.mp4', 'audio.m4a', 'audio/mp4', 'audio/webm'],
  ['review-chrome-aac-recorder-pause.mp4', 'audio.m4a', 'audio/mp4', ''],
  ['review-chrome-opus.webm', 'audio.webm', 'audio/webm', 'audio/webm;codecs=opus'],
  ['review-firefox-opus.ogg', 'audio.ogg', 'audio/ogg', ''],
];
for (const [recording, name, type, label] of recorders) {
  test(`ordinary Transcriber sends the recorded bytes and multipart metadata for ${recording}`, async t => {
    const { text, files } = await transcribeRecording(t, recording, { label });
    const digest = createHash('sha256').update(await readFile(new URL(recording, import.meta.url))).digest('hex');
    assert.equal(text, 'received');
    assert.deepEqual(files, [{ name, type, digest }]);
  });
}

test('browser prepared PCM preserves Web Audio channels, resampling, limits and source ownership', async t => {
  const page = await openPage(t, audioEntry);
  const result = await page.evaluate(async () => {
    const { Config, Transcriber, createOpenAI } = consumer;
    const samples = new AudioBuffer({ length: 36001, numberOfChannels: 2, sampleRate: 48000 });
    samples.getChannelData(0).fill(0.75);
    samples.getChannelData(1).fill(-0.25);
    const files = [];
    const model = createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      const file = (await new Request(url, init).formData()).get('file');
      const bytes = await file.arrayBuffer(), header = new DataView(bytes);
      if (header.getUint32(0) !== 0x52494646 || header.getUint32(8) !== 0x57415645 || header.getUint32(36) !== 0x64617461) throw Error('Invalid WAV');
      files.push({ type: file.type, audio: new Uint8Array(bytes, 44, header.getUint32(40, true)),
        format: { code: header.getUint16(20, true), bits: header.getUint16(34, true), channels: header.getUint16(22, true), sampleRate: header.getUint32(24, true) } });
      return Response.json({ text: 'received' });
    } }).transcription('whisper-1');
    const defaults = Config.loadsAudio({ sourceFormat: { channels: 1, sampleRate: 8000, encoding: 'pcm_u8' } });
    const stereo = { format: 'wav', codec: 'pcm_f32le' };
    const file = Transcriber({ model, fileAudioTarget: stereo }, defaults);
    await file(samples);
    const mono = { format: 'wav', codec: 'pcm_s16le', channels: 1, rate: 24000 };
    await file.run({ audio: samples, fileAudioTarget: { ...mono, maxBytes: 44 + 18001 * 2, maxDurationSeconds: 18001 / 24000 } });
    const fail = async settings => {
      try { await file.run({ audio: samples, ...settings }); } catch (error) { return [error.name, error.message]; }
    };
    const overflow = await fail({ fileAudioTarget: { ...mono, maxBytes: 44 + 18001 * 2 - 1 } });
    const duration = await fail({ fileAudioTarget: { ...mono, maxDurationSeconds: 18000 / 24000 } });
    await file.run({ audio: samples, fileAudioTarget: { ...mono, channels: 2 } });
    const chunks = [];
    const rawModel = { provider: 'test', modelId: 'test', specificationVersion: 'v4',
      async doStream({ audio }) {
        for await (const bytes of audio) chunks.push(bytes);
        return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'heard', segments: [] }); c.close(); } }) };
      } };
    const raw = Transcriber({ model: rawModel, inputAudioFormat: { type: 'audio/pcm', rate: 24000 } }, defaults);
    const text = (await raw(samples)).text;
    const rawBytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    return { stereo: files[0].format, first: Array.from(new Float32Array(files[0].audio.buffer, files[0].audio.byteOffset, 2)),
      mono: files[1].format, rawSize: rawBytes.length, equal: rawBytes.every((b, i) => b === files[1].audio[i]), wavSize: files[1].audio.length,
      stereo24k: [files[2].audio.length, ...new Int16Array(files[2].audio.buffer, files[2].audio.byteOffset + 72000, 2)],
      files: files.length, mime: files.map(f => f.type), chunks: chunks.length, original: samples.getChannelData(0)[36000], text, overflow, duration };
  });
  assert.deepEqual(result.stereo, { code: 3, bits: 32, channels: 2, sampleRate: 48000 });
  assert.deepEqual(result.first, [0.75, -0.25]);
  assert.deepEqual(result.mono, { code: 1, bits: 16, channels: 1, sampleRate: 24000 });
  assert.deepEqual(result.stereo24k, [72004, 24574, -8192]);
  assert.equal(result.text, 'heard'); assert.equal(result.files, 3); assert.deepEqual(result.mime, Array(3).fill('audio/wav'));
  assert.ok(result.equal && result.chunks > 1); assert.equal(result.rawSize, 36002); assert.equal(result.wavSize, result.rawSize);
  assert.equal(result.original, 0.75); assert.equal(result.overflow[0], 'ValidationError'); assert.match(result.duration[1], /maxDurationSeconds/);
});

test('an application worker can prepare overlapping audio while its timers make progress on a one-core budget', async t => {
  const page = await openPage(t, audioEntry);
  const run = async () => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 1 });
    const source = new Int16Array(4 * 1024 * 1024);
    source.fill(1024);
    const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doGenerate({ audio }) {
      const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength);
      if (view.getUint16(22, true) !== 1 || view.getUint32(24, true) !== 24000 || view.getInt16(44, true) !== 1022) throw Error('Incorrect provider samples');
      return { text: String(view.getUint32(40, true) / 2), segments: [], warnings: [] };
    } };
    const file = consumer.Transcriber.loadsAudio({ model, sourceFormat: { sampleRate: 48000, channels: 2 },
      fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', rate: 24000, channels: 1 } });
    let ticks = 0;
    const before = performance.now(), timer = setInterval(() => ticks++, 2);
    try {
      const results = await Promise.all([file(source), file(source.subarray(0, 480))]);
      return { frames: results.map(r => Number(r.text)), intact: source.at(-1), ticks, elapsed: Math.round(performance.now() - before) };
    } finally { clearInterval(timer); }
  };
  const result = await page.evaluate(async source => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' })), app = new Worker(url);
    try { return await new Promise((resolve, reject) => {
      app.onmessage = ({ data }) => data.error ? reject(Error(data.error)) : resolve(data);
      app.onerror = event => reject(Error(event.message));
    }); } finally { app.terminate(); URL.revokeObjectURL(url); }
  }, bundles.get(audioEntry) + '\n(' + run.toString() + ')().then(value => postMessage(value), error => postMessage({error: error.message}));');
  assert.deepEqual(result.frames, [1048576, 120]); assert.equal(result.intact, 1024); assert.ok(result.ticks > 0);
  t.diagnostic(`Application worker processed 8 MiB of stereo PCM in ${result.elapsed} ms with ${result.ticks} timer ticks.`);
});

test('described browser bytes preserve partial PCM frames, WAV padding and Blob MIME', async t => {
  const page = await openPage(t, audioEntry);
  const result = await page.evaluate(async () => {
    const { Transcriber, createOpenAI } = consumer, payloads = [];
    const transcribe = Transcriber.loadsAudio({
      model: createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
        const part = (await new Request(url, init).formData()).get('file');
        const wav = new Uint8Array(await part.arrayBuffer());
        payloads.push([wav.length, new DataView(wav.buffer).getUint32(40, true), Array.from(wav.subarray(44))]);
        return Response.json({ text: 'received' });
      } }).transcription('whisper-1'), fileAudioTarget: { format: 'wav', codec: 'pcm_s24le', maxBytes: 54 },
      sourceFormat: { channels: 1, sampleRate: 24000, encoding: 'pcm_s24le' },
    });
    const bytes = Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8, 9);
    function split(length) {
      let i = 0;
      return new ReadableStream({ pull(c) { if (i === length) c.close(); else c.enqueue(bytes.subarray(i, ++i)); } }, { highWaterMark: 0 });
    }
    for (const input of [bytes, new Blob([bytes], { type: 'audio/pcm;rate=24000;channels=1' }), split(9)]) await transcribe(input);
    const failures = [];
    for (const input of [split(8), new Blob([bytes], { type: 'audio/pcm;rate=8000' })]) {
      try { await transcribe(input); } catch (error) { failures.push([error.name, error.message]); }
    }
    return { payloads, failures };
  });
  assert.deepEqual(result.payloads, Array(3).fill([54, 9, [1,2,3,4,5,6,7,8,9,0]]));
  assert.deepEqual(result.failures.map(([name]) => name), ['ValidationError', 'ValidationError']);
  assert.match(result.failures[0][1], /incomplete/); assert.match(result.failures[1][1], /layout/);
});

test('described PCM has independent sample and completed WAV byte limits', async t => {
  const page = await openPage(t, audioEntry);
  const result = await page.evaluate(async () => {
    const { Transcriber, createOpenAI } = consumer;
    const samples = Int16Array.of(377), sizes = [];
    const model = createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      const file = (await new Request(url, init).formData()).get('file');
      const bytes = await file.arrayBuffer();
      sizes.push([file.type, bytes.byteLength, new DataView(bytes).getInt16(44, true)]);
      return Response.json({ text: 'heard' });
    } }).transcription('whisper-1');
    const fileAudioTarget = { format: 'wav', codec: 'pcm_s16le' };
    const transcribe = Transcriber.loadsAudio({ model, fileAudioTarget, sourceFormat: { sampleRate: 8000, channels: 1 } });
    const outcomes = [];
    for (const [maxPreparedAudioBytes, maxBytes] of [[2, 46], [1, 46], [2, 45]]) {
      try { outcomes.push((await transcribe.run({ audio: samples, maxPreparedAudioBytes, fileAudioTarget: { ...fileAudioTarget, maxBytes } })).text); }
      catch (error) { outcomes.push([error.name, error.message]); }
    }
    return { sizes, outcomes };
  });
  assert.deepEqual(result, { sizes: [['audio/wav', 46, 377]], outcomes: ['heard',
    ['ValidationError', 'Audio preparation exceeds maxPreparedAudioBytes.'], ['ValidationError', 'Prepared WAV exceeds the file byte limit.']] });
});

test('browser native-only settings and invalid URLs fail before source ownership', async t => {
  const page = await openPage(t, audioEntry);
  const result = await page.evaluate(async () => {
    const { Config, ConfigError, ValidationError, Transcriber, Translator } = consumer;
    let pulls = 0;
    const upload = new ReadableStream({ pull() { pulls++; } }, { highWaterMark: 0 });
    const shared = Config.loadsAudio({ mediaSettings: { track: 0 }, sourceFormat: { sampleRate: 24000, channels: 1 } });
    const options = { model: {}, inputAudioFormat: { type: 'audio/pcm', rate: 24000 } };
    const read = Transcriber(options, shared);
    const translate = Translator({ ...options, targetLanguage: 'en', audio: 'https://casai.test/recording' }, Config.loadsAudio({}));
    const outcomes = [];
    for (const action of [() => read(upload), () => read.run({ audio: upload, mediaSettings: { format: 'mov' } }),
      () => read.run({ audio: '/recording', mediaSettings: {} }), () => translate('fr'), () => read(upload)]) {
      try { await action(); } catch (error) {
        outcomes.push([error instanceof ConfigError ? 'config' : error instanceof ValidationError ? 'validation' : error.name, error.message]);
      }
    }
    return { pulls, locked: upload.locked, outcomes };
  });
  assert.deepEqual(result.outcomes.map(([kind]) => kind), ['config', 'validation', 'validation', 'validation', 'config']);
  assert.match(result.outcomes[3][1], /translate\(undefined, undefined, 'fr'\).*\.run/);
  assert.equal(result.pulls, 0); assert.equal(result.locked, false);
});

recordingTest('native stereo WAV conversion applies independent PCM and file byte limits', async t => {
  const page = await openPage(t, audioEntry);
  const wav = pcmWave(Buffer.from(Int16Array.from([8192, -16384, 8192, -16384, 8192, -16384, 8192, -16384]).buffer));
  wav.writeUInt16LE(2, 22); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(4, 32);
  const result = await page.evaluate(async encoded => {
    const { Transcriber, createOpenAI } = consumer;
    const samples = Uint8Array.fromBase64(encoded), files = [];
    const model = createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      const file = (await new Request(url, init).formData()).get('file'), bytes = await file.arrayBuffer();
      const view = new DataView(bytes);
      let offset = 12;
      while (view.getUint32(offset) !== 0x64617461) offset += 8 + view.getUint32(offset + 4, true);
      files.push([file.type, bytes.byteLength, view.getUint32(offset + 4, true), view.getFloat32(offset + 8, true), view.getFloat32(offset + 12, true)]);
      return Response.json({ text: 'heard' });
    } }).transcription('whisper-1');
    const target = { format: 'wav', codec: 'pcm_f32le', channels: 2, rate: 8000 };
    const transcribe = Transcriber.loadsAudio({ model, fileAudioTarget: target });
    const outcomes = [];
    for (const [maxPreparedAudioBytes, maxBytes] of [[32, 88], [31, 88], [32, 87]]) {
      try { outcomes.push((await transcribe.run({ audio: new Blob([samples]).stream(), maxPreparedAudioBytes, fileAudioTarget: { ...target, maxBytes } })).text); }
      catch (error) { outcomes.push([error.name, error.message]); }
    }
    return { files, outcomes };
  }, wav.toString('base64'));
  assert.deepEqual(result, { files: [['audio/wav', 88, 32, 0.25, -0.5]], outcomes: ['heard',
    ['ValidationError', 'Audio preparation exceeds maxPreparedAudioBytes.'], ['ValidationError', 'Prepared audio exceeds the file byte limit.']] });
});

test('malformed file alternatives fail before handoff and a well-formed Node alternative remains optional', async t => {
  const page = await openPage(t, audioEntry);
  const result = await page.evaluate(async () => {
    const { Config, ConfigError, ValidationError, Transcriber, createOpenAI } = consumer;
    let requests = 0;
    const model = createOpenAI({ apiKey: 'fixture', fetch: async () => { requests++; return Response.json({ text: 'heard' }); } }).transcription('whisper-1');
    const sourceFormat = { sampleRate: 24000, channels: 1, encoding: 'pcm_s16le' };
    const file = { format: 'wav', codec: 'pcm_s16le' };
    const transcribe = Transcriber.loadsAudio({ model, fileAudioTarget: file, sourceFormat });
    const results = [];
    for (const alternatives of [[null], [{ ...file, codec: 42 }], [{ ...file, sampleFormat: false }], new Set([file])]) {
      let pulls = 0;
      const upload = new ReadableStream({ pull(c) { pulls++; c.enqueue(Uint8Array.of(1, 0)); c.close(); } }, { highWaterMark: 0 });
      const initialRequests = requests;
      const fileAudioTarget = { ...file, alternatives };
      const status = await (async () => Transcriber({ model, sourceFormat }, Config.loadsAudio({ fileAudioTarget })))()
        .then(() => 'accepted', error => error instanceof ConfigError ? 'config' : error.name);
      const call = await transcribe.run({ audio: upload, fileAudioTarget })
        .then(() => 'accepted', error => error instanceof ValidationError ? 'validation' : error.name);
      const before = [pulls, requests - initialRequests, upload.locked];
      const valid = { ...file, alternatives: [{ format: 'flac', codec: 'flac' }] };
      const outcome = await transcribe.run({ audio: upload, fileAudioTarget: valid }).then(result => result.text, error => error.name);
      results.push({ status, call, before, outcome, after: [pulls, requests - initialRequests, upload.locked] });
    }
    return results;
  });
  assert.deepEqual(result, Array(4).fill({ status: 'config', call: 'validation', before: [0, 0, false], outcome: 'heard', after: [1, 1, false] }));
});

test('browser upload preflight and delayed cancellation retain the original reader and isolate overlapping calls', async t => {
  const page = await openPage(t, audioEntry);
  const result = await page.evaluate(async () => {
    const { Transcriber, ConfigError } = consumer;
    const bounded = promise => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Error('Audio operation timed out')), 5000))]);
    let enterProvider, enterCancel, finishCancel, reads = 0, reason, completed = false;
    const provider = new Promise(resolve => { enterProvider = resolve; });
    const cancelled = new Promise(resolve => { enterCancel = resolve; });
    const delay = new Promise(resolve => { finishCancel = resolve; });
    const source = new ReadableStream({
      pull(c) { if (++reads === 1) c.enqueue(new Uint8Array(65536)); },
      cancel(value) { reason = value; enterCancel(); return delay; },
    }, { highWaterMark: 0 });
    const component = Transcriber.loadsAudio({ sourceFormat: { channels: 1, sampleRate: 24000, encoding: 'pcm_s16le' },
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 }, maxRetries: 0,
      model: { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio, abortSignal }) {
        const reader = audio.getReader();
        try {
          const { value } = await reader.read();
          if (value[0] === 0) {
            enterProvider(); await new Promise((_, reject) => abortSignal.addEventListener('abort', () => reject(abortSignal.reason), { once: true }));
          }
        } finally { reader.releaseLock(); }
        return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'other', segments: [] }); c.close(); } }) };
      } } });
    const clone = globalThis.structuredClone;
    let before;
    try {
      globalThis.structuredClone = (value, options) => {
        if (value instanceof ReadableStream) throw new DOMException('Cannot transfer streams', 'DataCloneError');
        return clone(value, options);
      };
      try { await component(source); } catch (error) { before = [error instanceof ConfigError, reads, source.locked]; }
    } finally { globalThis.structuredClone = clone; }
    const abort = new AbortController(), stop = new Error('stop this recording');
    const first = component.run({ audio: source, abortSignal: abort.signal }).catch(error => error).finally(() => { completed = true; });
    await bounded(provider);
    const other = component(new Int16Array([1, 2, 3]));
    abort.abort(stop); await bounded(cancelled);
    const held = [source.locked, reason === stop, completed];
    const text = (await bounded(other)).text;
    finishCancel();
    const error = await bounded(first);
    return { before, held, released: !source.locked, same: error === stop, text };
  });
  assert.deepEqual(result, { before: [true, 0, false], held: [true, true, false], released: true, same: true, text: 'other' });
});

test('a pending raw provider read gets the exact local abort or producer error', { timeout: 15000 }, async t => {
  const page = await openPage(t, audioEntry);
  const results = await page.evaluate(async () => {
    const results = [];
    for (const aborts of [true, false]) {
      const signal = new AbortController(), waiting = Promise.withResolvers();
      const reason = aborts ? null : undefined;
      let producer, cancelled = 0, cancelReason, sawError = false, exact = false;
      const upload = new ReadableStream({ start(c) { producer = c; c.enqueue(new Uint8Array(8192)); },
        cancel(reason) { cancelled++; cancelReason = reason; } }, { highWaterMark: 0 });
      const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio }) {
        const reader = audio.getReader();
        try {
          let bytes = 0;
          while (bytes < 8192) bytes += (await reader.read()).value.length;
          const next = reader.read();
          waiting.resolve();
          await next;
        } catch (error) { sawError = true; exact = error === reason; throw error; }
        finally { reader.releaseLock(); }
        throw Error('The provider read completed after the input failed');
      } };
      const transcribe = consumer.Transcriber.loadsAudio({ model, maxRetries: 0,
        sourceFormat: { sampleRate: 8000, channels: 1, encoding: 'pcm_s16le' }, inputAudioFormat: { type: 'audio/pcm', rate: 8000 } });
      const settled = transcribe.run({ audio: upload, abortSignal: signal.signal }).then(() => false, () => true);
      await Promise.race([waiting.promise, settled.then(() => { throw Error('The provider never read the upload'); })]);
      if (aborts) signal.abort(reason); else producer.error(reason);
      results.push([await settled, sawError, exact, cancelled, cancelReason === reason, upload.locked]);
    }
    return results;
  });
  assert.deepEqual(results, [[true, true, true, 1, true, false], [true, true, true, 0, true, false]]);
});

test('browser prepared raw input unlocks on incremental finish, view cancellation and abandonment', { timeout: 18000 }, async t => {
  const page = await openPage(t, audioEntry);
  const actions = ['finish', 'cancel', 'cancel reader', 'return before reading', 'return during a read', 'abort'];
  const results = await page.evaluate(async actions => {
    const results = [];
    for (const factory of ['Transcriber', 'Translator']) for (const action of actions) {
      const stop = Error('stop ' + action), controller = new AbortController();
      const ready = Promise.withResolvers(), closed = Promise.withResolvers(), modelAbort = Promise.withResolvers();
      let calls = 0, cancellations = 0, closeReason, inputBytes = 0;
      const upload = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(8192)); },
        cancel(reason) { cancellations++; closeReason = reason; closed.resolve(); } }, { highWaterMark: 0 });
      const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio, abortSignal }) {
        calls++;
        const reader = audio.getReader();
        try { inputBytes = (await reader.read()).value.length; }
        finally { reader.releaseLock(); }
        ready.resolve();
        if (action !== 'finish') await new Promise((_, reject) => {
          const stopModel = () => { modelAbort.resolve(abortSignal.reason); reject(abortSignal.reason); };
          if (abortSignal.aborted) stopModel();
          else abortSignal.addEventListener('abort', stopModel, { once: true });
        });
        return { stream: new ReadableStream({ start(c) {
          c.enqueue(factory === 'Transcriber' ? { type: 'finish', text: 'heard', segments: [] }
            : { type: 'finish', sourceText: 'heard', outputText: 'heard' });
          c.close();
        } }) };
      } };
      const component = consumer[factory].loadsAudio.asStream({ model, maxRetries: 0,
        sourceFormat: { sampleRate: 8000, channels: 1, encoding: 'pcm_s16le' }, inputAudioFormat: { type: 'audio/pcm', rate: 8000 },
        ...(factory === 'Translator' ? { targetLanguage: 'fr' } : {}) });
      const result = await component.run({ audio: upload, abortSignal: controller.signal });
      if (action === 'finish') { for await (const _ of result.fullStream) { /* Read the native result through EOF. */ } }
      else {
        await ready.promise;
        if (action === 'cancel') await result.fullStream.cancel(stop);
        else if (action === 'cancel reader') {
          const reader = result.fullStream.getReader();
          try { await reader.cancel(stop); } finally { reader.releaseLock(); }
        } else if (action.startsWith('return')) {
          const iterator = result.fullStream[Symbol.asyncIterator]();
          const pending = action === 'return during a read' ? iterator.next() : undefined;
          await iterator.return(stop);
          if (pending && !(await pending).done) throw Error('Read continued after returning the iterator.');
        } else controller.abort(stop);
      }
      const [, abortReason] = await Promise.race([
        Promise.all([closed.promise, action === 'finish' ? undefined : modelAbort.promise]),
        new Promise((_, reject) => setTimeout(() => reject(Error(factory + ' did not close on ' + action)), 3500)),
      ]);
      const deadline = performance.now() + 1000;
      while (upload.locked && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 0));
      results.push([action, calls, inputBytes > 0, cancellations, !upload.locked,
        closeReason === abortReason && abortReason === (action === 'finish' ? undefined : stop)]);
    }
    return results;
  }, actions);
  assert.deepEqual(results, [...actions, ...actions].map(action => [action, 1, true, 1, true, true]));
});

test('incremental browser PCM needs no combined signal when the caller has none', async t => {
  const page = await openPage(t, audioEntry);
  const results = await page.evaluate(async () => {
    const any = AbortSignal.any;
    AbortSignal.any = undefined;
    try {
      const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio }) {
        const bytes = [];
        for await (const chunk of audio) bytes.push(...chunk);
        return { stream: new ReadableStream({ start(c) {
          c.enqueue({ type: 'finish', text: bytes.join(','), segments: [] }); c.close();
        } }) };
      } };
      const request = { model, maxRetries: 0, inputAudioFormat: { type: 'audio/pcm', rate: 8000 } };
      const sample = new Uint8Array([5, 0]);
      const ordinary = await consumer.Transcriber.asStream(request)(sample);
      const prepared = consumer.Transcriber.loadsAudio.asStream({ ...request, sourceFormat: { sampleRate: 8000, channels: 1 } });
      return [await ordinary.text, await (await prepared(new Int16Array([5]))).text];
    } finally { AbortSignal.any = any; }
  });
  assert.deepEqual(results, ['5,0', '5,0']);
});

test('structural AudioBuffer sources reject incomplete planes before provider dispatch', async t => {
  const page = await openPage(t, audioEntry);
  const result = await page.evaluate(async () => {
    let requests = 0;
    const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doGenerate() {
      requests++; return { text: 'heard', segments: [], warnings: [] };
    } };
    const transcribe = consumer.Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_f32le' } });
    const make = rightLength => ({ sampleRate: 24000, numberOfChannels: 2, length: 4,
      getChannelData(channel) { return new Float32Array(channel === 1 ? rightLength : 4).fill(0.5); } });
    let validation = false;
    try { await transcribe.run({ audio: make(3) }); }
    catch (error) { validation = error instanceof consumer.ValidationError; }
    const before = requests;
    const control = (await transcribe(make(4))).text;
    return { validation, before, control, requests };
  });
  assert.deepEqual(result, { validation: true, before: 0, control: 'heard', requests: 1 });
});

for (const [recording, frames, mayReject] of [
  ['review-chrome-opus.webm', 46080, false],
  ['review-chrome-opus-trimmed.webm', 45840, true],
]) {
  recordingTest(`6C copies ${frames} Chrome frames to WebM${mayReject ? ' or rejects the edit before dispatch' : ''}`, async t => {
    const { text, files, validationError } = await transcribeRecording(t, recording, {
      label: 'audio/mp4', target: { format: 'webm', codec: 'libopus' },
    });
    if (mayReject && validationError) {
      assert.deepEqual(files, []);
      return;
    }
    assert.equal(text, 'received');
    assert.equal(files.length, 1);
    const [file] = files;
    assert.equal(file.name, 'audio.webm');
    assert.equal(file.type, 'audio/webm');
    assert.equal(file.frames, frames);
    assert.equal(file.channels, 2);
    assert.equal(file.maxDifference, 0);
  });
}

// Compare the real multipart sample payload and the raw provider stream against independently authored PCM.
async function checkPcmPlayback(page, recording, expected, expectedError, rate = 8000) {
  const results = await page.evaluate(async ({ encoded, rate }) => {
    const bytes = Uint8Array.fromBase64(encoded), output = [];
    for (const form of ['bytes', 'blob', 'split']) for (const raw of [false, true]) {
      let offset = 0, files = 0;
      const chunks = [];
      const audio = form === 'bytes' ? bytes : form === 'blob' ? new Blob([bytes]) : new ReadableStream({ pull(c) {
        if (offset === bytes.length) return c.close();
        const chunk = bytes.subarray(offset, offset + 421); offset += chunk.length; c.enqueue(chunk);
      } }, { highWaterMark: 0 });
      const model = raw ? { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio }) {
        for await (const chunk of audio) chunks.push(chunk);
        return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'heard', segments: [] }); c.close(); } }) };
      } } : consumer.createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
        files++;
        const file = (await new Request(url, init).formData()).get('file');
        if (file.type !== 'audio/wav') throw Error('Unexpected multipart MIME ' + file.type);
        const data = new Uint8Array(await file.arrayBuffer()), view = new DataView(data.buffer);
        let pos = 12;
        while (view.getUint32(pos) !== 0x64617461) {
          const size = view.getUint32(pos + 4, true); pos += 8 + size + (size & 1);
        }
        chunks.push(data.subarray(pos + 8, pos + 8 + view.getUint32(pos + 4, true)));
        return Response.json({ text: 'heard' });
      } }).transcription('whisper-1');
      const target = raw ? { inputAudioFormat: { type: 'audio/pcm', rate } } : { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', channels: 1 } };
      let error;
      try { await consumer.Transcriber.loadsAudio({ model, maxRetries: 0, ...target })(audio); } catch (e) { error = [e.name, e.message]; }
      output.push({ form, raw, files, error, pcm: new Uint8Array(await new Blob(chunks).arrayBuffer()).toBase64(), locked: !!audio.locked });
    }
    return output;
  }, { encoded: recording.toString('base64'), rate });
  for (const { form, raw, files, error, pcm, locked } of results) {
    const actual = Buffer.from(pcm, 'base64'), label = form + (raw ? ' raw' : ' multipart');
    assert.equal(locked, false, label);
    assert.equal(files, raw || expectedError ? 0 : 1, label);
    if (expectedError) {
      assert.deepEqual(error, ['ValidationError', expectedError], label);
      assert.ok(actual.equals(expected.subarray(0, actual.length)), label + ' verified prefix');
    } else {
      assert.equal(error, undefined, label + ' ' + error);
      assert.equal(actual.length, expected.length, label);
      assert.ok(actual.equals(expected), label + ' samples');
    }
  }
}

recordingTest('indexed PCM edits stop at the authored frame inside or between packets', async t => {
  const page = await openPage(t, audioEntry);
  const movie = await readFile(new URL('review-indexed.mov', import.meta.url));
  const edit = movie.indexOf('elst');
  for (const [start, frames] of [[0, 250], [0, 512], [333, 250]]) {
    movie.writeUInt32BE(frames, edit + 12); movie.writeInt32BE(start, edit + 16);
    const pcm = Buffer.from(Int16Array.from({ length: frames }, (_, i) => 1000 + (start + i) % 31).buffer);
    await checkPcmPlayback(page, movie, pcm);
  }
});

recordingTest('an indexed movie uses the chosen microphone and its own edit', async t => {
  const page = await openPage(t, audioEntry);
  const movie = await readFile(new URL('review-indexed.mov', import.meta.url));
  const first = movie.indexOf('tkhd'), second = movie.indexOf('tkhd', first + 4);
  // The two container IDs differ from Mediabunny's track numbers. Enable the second microphone.
  movie.writeUInt32BE(41, first + 16); movie.writeUInt32BE(7, second + 16);
  movie[first + 7] &= ~1; movie[second + 7] |= 1;
  const edit = movie.indexOf('elst', second);
  assert.equal(movie[edit + 4], 1);
  movie.writeBigUInt64BE(250n, edit + 12); // Keep 250 frames after the second microphone's 333-frame opening cut.
  const pcm = Buffer.from(Int16Array.from({ length: 250 }, (_, i) => -5000 + (333 + i) % 31).buffer);
  await checkPcmPlayback(page, movie, pcm);
});

recordingTest('fragmented PCM preserves the pause and the first resumed sample on both provider routes', { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
  const page = await openPage(t, audioEntry);
  for (const [frames, gap] of [[4096, 0], [4096, 640], [4608, 800]]) {
    const { movie, playback } = fragmentedPcm(frames, gap);
    await checkPcmPlayback(page, movie, playback);
  }
  const { recording, pcm } = coarseClockPcm();
  await checkPcmPlayback(page, recording, pcm);
});

recordingTest('a movie edit preserves leading silence carried by fragment clocks', { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
  const page = await openPage(t, audioEntry);
  const { movie, pcm } = fragmentedPcm(4096, 0);
  const leadingFrames = 640;
  for (let i = movie.indexOf('tfdt'); i >= 0; i = movie.indexOf('tfdt', i + 4)) {
    movie.writeBigUInt64BE(movie.readBigUInt64BE(i + 8) + BigInt(leadingFrames), i + 8);
  }
  const expected = Buffer.concat([Buffer.alloc(leadingFrames * 2), pcm]);
  await checkPcmPlayback(page, movie, expected);
  // One unit-rate edit from media time zero through the last sample, on an 8 kHz movie clock.
  const edit = Buffer.from('00000024656474730000001c656c73740000000000000001000000000000000000010000', 'hex');
  assert.equal(movie.readUInt32BE(movie.indexOf('mvhd') + 16), 8000);
  edit.writeUInt32BE(expected.length / 2, 24);
  for (const type of ['moov', 'trak']) {
    const start = movie.indexOf(type) - 4;
    movie.writeUInt32BE(movie.readUInt32BE(start) + edit.length, start);
  }
  const insertion = movie.indexOf('mdia') - 4;
  const edited = Buffer.concat([movie.subarray(0, insertion), edit, movie.subarray(insertion)]);
  const reference = execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', '-copyts', '-i', 'pipe:0', '-map', '0:a:0',
    '-af', 'aresample=async=1:first_pts=0', '-f', 's16le', 'pipe:1'], { input: edited });
  assert.ok(reference.equals(expected));
  await checkPcmPlayback(page, edited, expected);
});

recordingTest('finalized WAV data must be complete and streaming size placeholders remain usable', async t => {
  const page = await openPage(t, audioEntry);
  const pcm = Buffer.from(Int16Array.from({ length: 4260 }, (_, i) => i + 1000).buffer);
  const complete = pcmWave(pcm), short = complete.subarray(0, -400);
  await checkPcmPlayback(page, complete, pcm);
  await checkPcmPlayback(page, short, pcm.subarray(0, -400), 'Incomplete WAVE data chunk.');
  for (const [riffSize, dataSize] of [[0xffffffff, 0xffffffff], [0xffffffff, 0], [0, 0]]) {
    short.writeUInt32LE(riffSize, 4); short.writeUInt32LE(dataSize, 40);
    await checkPcmPlayback(page, short, pcm.subarray(0, -400));
    await checkPcmPlayback(page, short.subarray(0, -1), pcm.subarray(0, -402), 'Incomplete WAVE data chunk.');
  }
});

recordingTest('WAV plays every data chunk in order across padding and metadata', async t => {
  const page = await openPage(t, audioEntry);
  const pcm = Buffer.from(Int16Array.from({ length: 4307 }, (_, i) => -1000 - i).buffer);
  const junk = Buffer.from('4a554e4b03000000abcdef00', 'hex');
  for (const cut of [0, 8, 4100, pcm.length]) {
    const next = pcmWave(pcm.subarray(cut)).subarray(36);
    const wave = Buffer.concat([pcmWave(pcm.subarray(0, cut)), junk, next]);
    wave.writeUInt32LE(wave.length - 8, 4);
    await checkPcmPlayback(page, wave, pcm);
    if (cut === 4100) await checkPcmPlayback(page, wave.subarray(0, 44 + cut), pcm.subarray(0, cut), 'Incomplete WAVE chunk header.');
  }
});

recordingTest('playback inspection bounds reads across large descriptive and movie padding boxes', async t => {
  const page = await openPage(t, audioEntry);
  const text = Buffer.alloc(2 * 1024 * 1024, 65);
  const pcm = Buffer.from(Int16Array.from({ length: 8000 }, (_, i) => i - 4000).buffer);
  const wav = pcmWave(pcm), list = Buffer.alloc(20);
  list.write('LIST'); list.writeUInt32LE(12 + text.length, 4);
  list.write('INFOICMT', 8); list.writeUInt32LE(text.length, 16);
  const taggedWav = Buffer.concat([wav.subarray(0, 36), list, text, wav.subarray(36)]);
  taggedWav.writeUInt32LE(taggedWav.length - 8, 4);

  const flac = await readFile(new URL('browser-spoken.flac', import.meta.url));
  const metadataOffset = 42; // Immediately after STREAMINFO.
  assert.equal(flac[metadataOffset], 4); // VORBIS_COMMENT
  const oldComment = flac.readUIntBE(metadataOffset + 1, 3);
  const comment = Buffer.alloc(16);
  comment[0] = 4;
  comment.writeUIntBE(12 + text.length, 1, 3);
  comment.writeUInt32LE(1, 8); // Empty vendor and one comment.
  comment.writeUInt32LE(text.length, 12);
  const taggedFlac = Buffer.concat([flac.subarray(0, metadataOffset), comment, Buffer.from('COMMENT='), text.subarray(8),
    flac.subarray(metadataOffset + 4 + oldComment)]);
  const inputs = [wav, taggedWav, flac, taggedFlac];
  if (process.env.CASAI_REVIEW_FFMPEG) {
    const webm = await readFile(new URL('review-chrome-opus.webm', import.meta.url));
    const mkv = execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', '-i', 'pipe:0', '-map', '0:a:0', '-c', 'copy', '-f', 'matroska', 'pipe:1'], { input: webm });
    const cluster = mkv.indexOf(Buffer.from('1f43b675', 'hex'));
    assert.ok(cluster > 0);
    function element(id, bytes) {
      const size = Buffer.alloc(4);
      size.writeUInt32BE(0x10000000 + bytes.length);
      return Buffer.concat([Buffer.from(id, 'hex'), size, bytes]);
    }
    const file = element('61a7', Buffer.concat([element('46ae', Buffer.of(1)), element('466e', Buffer.from('note.txt')),
      element('4660', Buffer.from('text/plain')), element('465c', text)]));
    inputs.push(mkv, Buffer.concat([mkv.subarray(0, cluster), element('1941a469', file), mkv.subarray(cluster)]));
  }
  const movie = await readFile(new URL('review-chrome-aac.mp4', import.meta.url));
  const moov = movie.indexOf('moov') - 4;
  assert.ok(moov >= 0);
  const moovSize = movie.readUInt32BE(moov), end = moov + moovSize;
  const padding = Buffer.alloc(8 * 1024 * 1024);
  padding.writeUInt32BE(padding.length); padding.write('free', 4);
  const paddedMovie = Buffer.concat([movie.subarray(0, end), padding, movie.subarray(end)]);
  paddedMovie.writeUInt32BE(moovSize + padding.length, moov);
  inputs.push(movie, paddedMovie);
  const paddedIndex = inputs.length - 1, split = [paddedIndex];
  let indexed;
  if (process.env.CASAI_REVIEW_FFMPEG) {
    const directory = await mkdtemp(join(tmpdir(), 'casai-audio-index-'));
    const path = join(directory, 'indexed.mov');
    t.after(async () => { await rm(path, { force: true }); await rmdir(directory); });
    const { compact, large, padded, pcm } = await largeIndexedPcm(path);
    inputs.push(compact, large);
    split.push(inputs.length - 1);
    inputs.push(compact, padded);
    split.push(inputs.length - 1);
    indexed = { input: inputs.length - 1, pcm };
    const { movie: fragmented } = fragmentedPcm(4096, 0);
    const mfra = fragmented.lastIndexOf('mfra') - 4, mfro = fragmented.lastIndexOf('mfro') - 4;
    const footerSize = fragmented.readUInt32BE(mfra);
    assert.ok(mfra > 0 && mfro > mfra && mfra + footerSize === fragmented.length);
    assert.equal(fragmented.readUInt32BE(mfro + 12), footerSize);
    const footerPadding = Buffer.alloc(1024 * 1024);
    footerPadding.writeUInt32BE(footerPadding.length); footerPadding.write('free', 4);
    const paddedFooter = Buffer.concat([fragmented.subarray(0, mfro), footerPadding, fragmented.subarray(mfro)]);
    paddedFooter.writeUInt32BE(footerSize + footerPadding.length, mfra);
    paddedFooter.writeUInt32BE(footerSize + footerPadding.length, paddedFooter.length - 4);
    inputs.push(fragmented, paddedFooter);
  }
  for (const [i, body] of inputs.entries()) await page.route('https://casai.test/metadata-' + i, route => route.fulfill({ body }));
  let sequentialRequests = 0, rangedBytes = 0;
  await page.route('https://casai.test/movie-sequential', route => {
    sequentialRequests++;
    return route.fulfill({ body: paddedMovie });
  });
  await page.route('https://casai.test/movie-ranged', route => {
    const range = /^bytes=(\d+)-(\d+)$/.exec(route.request().headers().range);
    assert.ok(range);
    const start = Number(range[1]), end = Math.min(Number(range[2]), paddedMovie.length - 1);
    if (start > end) return route.fulfill({ status: 416, headers: { etag: '"padded-movie"', 'content-range': `bytes */${paddedMovie.length}` } });
    const body = paddedMovie.subarray(start, end + 1);
    rangedBytes += body.length;
    return route.fulfill({ status: 206, headers: { etag: '"padded-movie"', 'content-range': `bytes ${start}-${end}/${paddedMovie.length}` }, body });
  });

  const { files, unlocked } = await page.evaluate(async ({ count, split }) => {
    const OriginalWorker = Worker;
    const workerUrls = [];
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        const monitored = `const slice = Blob.prototype.slice;
          Blob.prototype.slice = function (...args) {
            const view = slice.apply(this, args);
            if (view.size > 256 * 1024) throw Error('Oversized Blob read of ' + view.size);
            return view;
          };
          self.Uint8Array = new Proxy(Uint8Array, {
            construct(target, args, constructor) {
              if (typeof args[0] === 'number' && args[0] > 512 * 1024) throw Error('Oversized allocation of ' + args[0]);
              return Reflect.construct(target, args, constructor);
            },
          });
          importScripts(${JSON.stringify(url)});`;
        const workerUrl = URL.createObjectURL(new Blob([monitored], { type: 'text/javascript' }));
        super(workerUrl, options);
        workerUrls.push(workerUrl);
      }
    };
    const files = [];
    const model = consumer.createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      const part = (await new Request(url, init).formData()).get('file');
      files.push([part.type, new Uint8Array(await part.arrayBuffer()).toBase64()]);
      return Response.json({ text: 'heard' });
    } }).transcription('whisper-1');
    const transcribe = consumer.Transcriber.loadsAudio({ model, maxRetries: 0, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
    async function prepare(input, label) {
      try { await transcribe(input); }
      catch (error) { throw Error(label + ' failed: ' + error.message); }
    }
    try {
      for (let i = 0; i < count; i++) await prepare(await (await fetch('/metadata-' + i)).blob(), 'Blob ' + i);
      const unlocked = [];
      for (const i of split) {
        const upload = (await fetch('/metadata-' + i)).body;
        await prepare(upload, 'Upload ' + i);
        unlocked.push(!upload.locked);
      }
      await prepare(new URL('/movie-sequential', location.href), 'Sequential URL');
      await prepare(new URL('/movie-ranged', location.href), 'Ranged URL');
      return { files, unlocked };
    } finally {
      window.Worker = OriginalWorker;
      for (const url of workerUrls) URL.revokeObjectURL(url);
    }
  }, { count: inputs.length, split });
  assert.equal(files.length, inputs.length + split.length + 2);
  assert.deepEqual(unlocked, split.map(() => true));
  for (const [i, input] of split.entries()) assert.deepEqual(files[inputs.length + i], files[input]);
  assert.deepEqual(files.at(-2), files[paddedIndex]);
  assert.deepEqual(files.at(-1), files[paddedIndex]);
  assert.equal(sequentialRequests, 1);
  assert.ok(rangedBytes > 0 && rangedBytes < 2 * 1024 * 1024, `Read ${rangedBytes} HTTP range bytes`);
  assert.ok(files.every(([type]) => type === 'audio/wav'));
  for (let i = 0; i < inputs.length; i += 2) assert.deepEqual(files[i + 1], files[i]);
  assert.ok(Buffer.from(files[0][1], 'base64').subarray(44).equals(pcm));
  if (indexed) assert.ok(Buffer.from(files[indexed.input][1], 'base64').subarray(44).equals(indexed.pcm));
});

recordingTest('a known-length HTTP 200 movie opens without seeking to its end', { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
  const page = await openPage(t, audioEntry);
  const pcm = Buffer.from(Int16Array.from({ length: 320000 }, (_, i) => 1000 + i % 7919).buffer);
  const movie = execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', '-f', 's16le', '-ar', '8000', '-ac', '1',
    '-i', 'pipe:0', '-c:a', 'pcm_s16le', '-movflags', 'empty_moov+frag_keyframe+default_base_moof', '-frag_duration', '1000000',
    '-use_editlist', '0', '-f', 'mov', 'pipe:1'], { input: pcm });
  assert.ok(movie.length > 2 * 256 * 1024);
  let requests = 0;
  await page.route('https://casai.test/sequential-movie', route => {
    requests++;
    return route.fulfill({ body: movie, headers: { 'content-length': String(movie.length) } });
  });
  const actual = await page.evaluate(async () => {
    let actual;
    const model = consumer.createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      const file = (await new Request(url, init).formData()).get('file');
      if (file.type !== 'audio/wav') throw Error('Unexpected provider file type');
      actual = new Uint8Array(await file.arrayBuffer()).toBase64();
      return Response.json({ text: 'heard' });
    } }).transcription('whisper-1');
    await consumer.Transcriber.loadsAudio({ model, maxRetries: 0, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } })
      (new URL('/sequential-movie', location.href));
    return actual;
  });
  assert.equal(requests, 1);
  assert.ok(Buffer.from(actual, 'base64').equals(pcmWave(pcm)));
});

recordingTest('WAV uses the declared sample storage and rejects conflicting layouts', async t => {
  const page = await openPage(t, audioEntry);
  const pcm = Buffer.from(Int16Array.of(-8192, -16384, -4096).buffer);
  const wave = pcmWave(Buffer.from(Int32Array.of(-0x20000000, -0x40000000, -0x10000000).buffer));
  wave.writeUInt32LE(32000, 28); wave.writeUInt16LE(4, 32); wave.writeUInt16LE(24, 34);
  const error = 'Unsupported WAVE sample layout.';
  await checkPcmPlayback(page, wave, Buffer.alloc(0), error);
  // Standard extensible PCM stores these 24 valid bits left-aligned in each four-byte slot.
  const extension = Buffer.from('16001800040000000100000000001000800000aa00389b71', 'hex');
  const valid = Buffer.concat([wave.subarray(0, 36), extension, wave.subarray(36)]);
  valid.writeUInt32LE(valid.length - 8, 4); valid.writeUInt32LE(40, 16); valid.writeUInt16LE(0xfffe, 20); valid.writeUInt16LE(32, 34);
  await checkPcmPlayback(page, valid, pcm);
  valid.writeUInt16LE(33, 38);
  await checkPcmPlayback(page, valid, Buffer.alloc(0), error);
});

recordingTest('known WAV and FLAC frame counts enforce the raw byte budget before provider dispatch', async t => {
  const page = await openPage(t, audioEntry);
  const flac = await readFile(new URL('browser-spoken.flac', import.meta.url));
  for (const [recording, rate, frames] of [[pcmWave(Buffer.alloc(8)), 8000, 4], [flac, 22050, 90921]]) {
    const results = await page.evaluate(async ({ base64, rate, frames }) => {
      const bytes = Uint8Array.fromBase64(base64), results = [];
      for (const form of ['bytes', 'blob', 'upload']) for (const factor of [1, 2]) {
        let calls = 0, size = 0;
        const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio }) {
          calls++;
          for await (const chunk of audio) size += chunk.length;
          return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'heard', segments: [] }); c.close(); } }) };
        } };
        const transcribe = consumer.Transcriber.loadsAudio({ model, maxRetries: 0, inputAudioFormat: { type: 'audio/pcm', rate: rate * factor } });
        for (const budget of [2 * frames * factor - 1, 2 * frames * factor]) {
          const audio = form === 'bytes' ? bytes : form === 'blob' ? new Blob([bytes]) : new Blob([bytes]).stream();
          const result = await transcribe.run({ audio, maxPreparedAudioBytes: budget }).then(r => r.text, e => [e.name, e.message]);
          results.push([result, calls, size]);
        }
      }
      return results;
    }, { base64: recording.toString('base64'), rate, frames });
    for (let i = 0; i < results.length; i += 2) {
      assert.deepEqual(results[i], [['ValidationError', 'Audio preparation exceeds maxPreparedAudioBytes.'], 0, 0]);
      assert.deepEqual(results[i + 1], ['heard', 1, 2 * frames * (i % 4 ? 2 : 1)]);
    }
  }
});

recordingTest('FLAC checks a declared sample count at a clean frame boundary and accepts an unknown count',
  { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
    const page = await openPage(t, audioEntry);
    const pcm = Buffer.from(Int16Array.from({ length: 4209 }, (_, i) => -1000 - i % 701).buffer);
    const ff = (args, input) => execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', ...args], { input });
    const flac = ff(['-f', 's16le', '-ar', '8000', '-ac', '1', '-i', 'pipe:0', '-c:a', 'flac', '-frame_size', '1024', '-f', 'flac', 'pipe:1'], pcm);
    const packets = ff(['-i', 'pipe:0', '-c:a', 'copy', '-f', 'framecrc', 'pipe:1'], flac).toString()
      .split(/\r?\n/).filter(line => line.startsWith('0,')).map(line => line.split(',').map(Number));
    const [, , , frames, bytes] = packets.at(-1);
    assert.equal(frames, 113);
    const cut = flac.subarray(0, -bytes), prefix = pcm.subarray(0, -frames * 2);
    assert.equal(flac.readUInt32BE(22), 0);
    await checkPcmPlayback(page, cut, prefix);
    const first = flac.length - packets.reduce((sum, packet) => sum + packet[4], 0);
    const next = first + packets[0][4];
    const gap = Buffer.concat([flac.subarray(0, next), flac.subarray(next + packets[1][4])]);
    await checkPcmPlayback(page, gap, pcm.subarray(0, 2 * packets[0][3]), 'FLAC frame numbering is discontinuous.');
    flac.writeUInt32BE(pcm.length / 2, 22);
    await checkPcmPlayback(page, flac, pcm);
    const error = 'FLAC frames do not match the declared sample count.';
    await checkPcmPlayback(page, cut, prefix, error);
    flac.writeUInt32BE(prefix.length / 2, 22);
    await checkPcmPlayback(page, flac, prefix, error);
  });

test('an externally locked audio upload can be retried after its reader releases it', async t => {
  const page = await openPage(t, audioEntry);
  const result = await page.evaluate(async () => {
    let pulls = 0, sends = 0;
    const source = new ReadableStream({ pull(c) { pulls++; c.enqueue(Uint8Array.of(0, 16)); c.close(); } }, { highWaterMark: 0 });
    const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', doGenerate() {
      sends++; return { text: 'heard', segments: [], warnings: [] };
    } };
    const call = consumer.Transcriber.loadsAudio({ model, sourceFormat: { sampleRate: 8000, channels: 1, encoding: 'pcm_s16le' },
      fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
    const reader = source.getReader();
    const first = await call(source).catch(e => [e.name, e.message, pulls, sends]);
    reader.releaseLock();
    const { text } = await call(source);
    const reused = await call(source).catch(e => e.message);
    return { first, text, pulls, sends, reused, locked: source.locked };
  });
  assert.deepEqual(result.first, ['ValidationError', 'This input is locked by another reader. Release it before handing it off.', 0, 0]);
  assert.equal(result.text, 'heard'); assert.equal(result.pulls, 1); assert.equal(result.sends, 1);
  assert.match(result.reused, /already been handed off/); assert.equal(result.locked, false);
});

recordingTest('an abort during raw EOF cleanup reaches the pending provider read', { timeout: 15000 }, async t => {
  const page = await openPage(t, audioEntry);
  const wav = pcmWave(Buffer.alloc(65536, 3));
  const result = await page.evaluate(async encoded => {
    const wave = Uint8Array.fromBase64(encoded), stop = Error('abort during raw cleanup'), abort = new AbortController();
    const entered = Promise.withResolvers(), cleanup = Promise.withResolvers();
    let offset = 0, cancellations = 0, pendingError, delivered = 0;
    const upload = new ReadableStream({ pull(c) {
      // Keep the physical source open beyond its declared audio end until Casai cancels it.
      if (offset >= wave.length + 512 * 1024) return;
      const bytes = offset < wave.length ? wave.subarray(offset, offset + 8192) : new Uint8Array(8192);
      offset += bytes.length; c.enqueue(bytes);
    }, cancel() { cancellations++; entered.resolve(); return cleanup.promise; } }, { highWaterMark: 0 });
    const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio }) {
      try { for await (const chunk of audio) delivered += chunk.length; }
      catch (error) { pendingError = error; throw error; }
      return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'heard', segments: [] }); c.close(); } }) };
    } };
    const call = consumer.Transcriber.loadsAudio({ model, maxRetries: 0, inputAudioFormat: { type: 'audio/pcm', rate: 8000 } })
      .run({ audio: upload, abortSignal: abort.signal }).catch(error => error);
    await entered.promise;
    const held = upload.locked;
    abort.abort(stop); cleanup.resolve();
    return { held, error: await call === stop, read: pendingError === stop, delivered, cancellations, locked: upload.locked };
  }, wav.toString('base64'));
  assert.deepEqual(result, { held: true, error: true, read: true, delivered: 65536, cancellations: 1, locked: false });
});

recordingTest('compressed sampleFormat fails before ownership and an ineligible alternative falls back to WAV', async t => {
  const page = await openPage(t, audioEntry);
  const bytes = await readFile(new URL('review-chrome-opus.webm', import.meta.url));
  const result = await page.evaluate(async encoded => {
    const bytes = Uint8Array.fromBase64(encoded), mime = [], errors = [];
    let pulls = 0;
    const upload = new ReadableStream({ pull(c) { pulls++; c.enqueue(bytes); c.close(); } }, { highWaterMark: 0 });
    const model = consumer.createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      mime.push((await new Request(url, init).formData()).get('file').type); return Response.json({ text: 'heard' });
    } }).transcription('whisper-1');
    const valid = { format: 'webm', codec: 'libopus' }, invalid = { ...valid, sampleFormat: 'flt' };
    const transcribe = consumer.Transcriber.loadsAudio({ model, fileAudioTarget: invalid });
    for (const action of [() => transcribe(upload), () => transcribe.run({ audio: upload, fileAudioTarget: invalid })]) {
      try { await action(); } catch (e) { errors.push([e.name, pulls, upload.locked]); }
    }
    await transcribe.run({ audio: upload, fileAudioTarget: valid });
    await transcribe.run({ audio: bytes, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', alternatives: [invalid] } });
    return { errors, mime, pulls, locked: upload.locked };
  }, bytes.toString('base64'));
  assert.deepEqual(result, { errors: [['ConfigError', 0, false], ['ValidationError', 0, false]], mime: ['audio/webm', 'audio/wav'], pulls: 1, locked: false });
});

recordingTest('6C preserves the recorded AAC gap and endpoint after Chrome MediaRecorder resumes', async t => {
  // Independent packet timing places the next audible frame at 32,127. Inspect the provider WAV at that boundary.
  const { text, files } = await transcribeRecording(t, 'review-chrome-aac-recorder-pause.mp4', {
    target: { format: 'wav', codec: 'pcm_s16le', rate: 48000, channels: 1 },
    sampleWindow: [31744 - 128, 32127 + 128],
  });
  assert.equal(text, 'received');
  assert.equal(files.length, 1);
  const [file] = files;
  assert.equal(file.type, 'audio/wav');
  assert.equal(file.channels, 1);
  assert.equal(file.frames, 63855);
  assert.equal(file.samples.length, 128 + 383 + 128);
  assert.ok(file.samples.slice(0, 128).some(sample => Math.abs(sample) > 0.01));
  assert.ok(file.samples.slice(128, 128 + 383).every(sample => sample === 0));
  assert.ok(file.samples.slice(128 + 383).some(sample => Math.abs(sample) > 0.01));
});

recordingTest('6C keeps every playable Opus packet on a backward clock or rejects before file dispatch', async t => {
  const { text, validationError, nativeError, files } = await transcribeRecording(t, 'review-chrome-opus.webm', {
    target: { format: 'webm', codec: 'libopus' },
    changeInput(bytes) {
      // The sixth SimpleBlock contains a track number, a signed millisecond offset and the keyframe flag.
      assert.equal(bytes.readUInt32BE(5024), 0x81003e80);
      bytes.writeInt16BE(-1, 5025); // 238 ms, one millisecond before the previous packet.
      return bytes;
    },
  });
  if (validationError || nativeError) {
    if (nativeError) assert.match(nativeError, /packet|timestamp|decode order/i);
    assert.deepEqual(files, []);
    return;
  }
  assert.equal(text, 'received');
  assert.equal(files.length, 1);
  assert.equal(files[0].type, 'audio/webm');
  assert.equal(files[0].frames, 46080);
  assert.equal(files[0].channels, 2);
  assert.equal(files[0].maxDifference, 0);
});

for (const [recording, format, codec] of [
  ['review-safari-aac.mp4', 'webm', 'libopus'],
  ['review-safari-aac.mp4', 'ipod', 'aac'],
  ['review-firefox-opus.ogg', 'webm', 'libopus'],
]) {
  recordingTest(`a sole ${format}/${codec} target rejects ${recording} before file dispatch`, async t => {
    const { validationError, files } = await transcribeRecording(t, recording, { label: 'audio/webm', target: { format, codec } });
    assert.ok(validationError);
    assert.deepEqual(files, []);
  });
}

async function capturePreparedFile(page, input, target, split = false) {
  const { type, encoded } = await page.evaluate(async ({ data, target, split }) => {
    let file;
    const model = consumer.createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      file = (await new Request(url, init).formData()).get('file');
      return Response.json({ text: 'heard' });
    } }).transcription('whisper-1');
    const bytes = Uint8Array.fromBase64(data);
    await consumer.Transcriber.loadsAudio({ model, fileAudioTarget: target })(split ? new Blob([bytes]).stream() : bytes);
    return { type: file.type, encoded: new Uint8Array(await file.arrayBuffer()).toBase64() };
  }, { data: input.toString('base64'), target, split });
  return { type, bytes: Buffer.from(encoded, 'base64') };
}

recordingTest('a sequential Opus cluster larger than the worker cache preserves WAV and WebM playback',
  { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
    const page = await openPage(t, audioEntry);
    const recording = await readFile(new URL('review-android-chrome-open-cluster.webm', import.meta.url));
    const cluster = recording.indexOf(Buffer.from('1f43b67501ffffffffffffffe78100', 'hex'));
    assert.ok(cluster >= 0);
    const first = cluster + 15;
    assert.equal(recording[first], 0xa3);
    const size = recording.readUInt16BE(first + 1) & 0x3fff;
    const template = recording.subarray(first, first + 3 + size);
    const blocks = Array.from({ length: 420 }, (_, i) => {
      const block = Buffer.from(template);
      block.writeInt16BE(i * 60, 4); // This recorder's SimpleBlocks each contain one 60 ms Opus packet.
      return block;
    });
    const source = Buffer.concat([recording.subarray(0, first), ...blocks]);
    assert.ok(source.length > 512 * 1024);
    const inspect = (input, args) => execFileSync(process.env.CASAI_REVIEW_FFMPEG,
      ['-v', 'error', '-copyts', '-i', 'pipe:0', '-map', '0:a:0', ...args, 'pipe:1'], { input, encoding: 'utf8' });
    const pcmHash = input => inspect(input, ['-c:a', 'pcm_s16le', '-f', 'hash', '-hash', 'sha256']);
    const packets = input => inspect(input, ['-c:a', 'copy', '-f', 'framecrc']).split(/\r?\n/).filter(line => line.startsWith('0,'));
    const expectedPcm = pcmHash(source), expectedPackets = packets(source);
    assert.equal(expectedPackets.length, blocks.length);
    for (const sized of [false, true]) {
      if (sized) source.writeBigUInt64BE((1n << 56n) | BigInt(source.length - cluster - 12), cluster + 4);
      const wav = await capturePreparedFile(page, source, { format: 'wav', codec: 'pcm_s16le', channels: 2 }, true);
      assert.equal(wav.type, 'audio/wav');
      const webm = await capturePreparedFile(page, source, { format: 'webm', codec: 'libopus' }, true);
      assert.equal(webm.type, 'audio/webm');
      assert.equal(pcmHash(webm.bytes), expectedPcm);
      assert.deepEqual(packets(webm.bytes), expectedPackets);
      // The two decoder implementations can round PCM differently. Check the sample bytes against the seekable call.
      const seekable = await capturePreparedFile(page, source, { format: 'wav', codec: 'pcm_s16le', channels: 2 });
      assert.equal(pcmHash(wav.bytes), pcmHash(seekable.bytes));
    }
  });

function inspectAudioFile(input, filters = []) {
  const result = spawnSync(process.env.CASAI_REVIEW_FFMPEG, ['-hide_banner', '-i', 'pipe:0', '-map', '0:a:0', ...filters, '-f', 's16le', 'pipe:1'], { input });
  assert.equal(result.status, 0, result.stderr?.toString() ?? result.error?.message);
  return { pcm: result.stdout, metadata: result.stderr.toString().split('Stream mapping:')[0] };
}

function disableWorkerAudioDecoder(page) {
  return page.evaluate(() => {
    const NativeWorker = Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        const source = 'self.AudioDecoder = undefined; importScripts(' + JSON.stringify(url) + ');';
        super(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })), options);
      }
    };
  });
}

recordingTest('strict M4A copy respects the selected track edit at the last packet', { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
  const page = await openPage(t, audioEntry);
  const directory = await mkdtemp(join(tmpdir(), 'casai-aac-edit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'indexed.mp4');
  const input = await readFile(new URL('review-chrome-aac.mp4', import.meta.url));
  execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', '-i', 'pipe:0', '-map', '0:a:0', '-c', 'copy', '-movflags', '+faststart', path], { input });
  const indexed = await readFile(path), edit = indexed.indexOf('elst');
  assert.equal(indexed.readUInt32BE(indexed.indexOf('mvhd') + 16), 48000);
  assert.equal(indexed.readUInt32BE(edit + 8), 1);
  assert.equal(indexed.readUInt32BE(edit + 16), 0);
  const copy = { format: 'ipod', codec: 'aac' };
  const expected = inspectAudioFile(indexed).pcm.subarray(0, 24576 * 4);
  const timing = execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', '-i', 'pipe:0', '-c:a', 'copy', '-f', 'framecrc', 'pipe:1'], { input: indexed, encoding: 'utf8' });
  const [, , pts, duration] = timing.split(/\r?\n/).filter(line => line.startsWith('0,'))[23].split(',').map(Number);
  indexed.writeUInt32BE(pts + duration, edit + 12);
  assert.equal(expected.length, 24576 * 4);
  for (const split of [false, true]) {
    const file = await capturePreparedFile(page, indexed, copy, split);
    assert.equal(file.type, 'audio/mp4');
    assert.ok(inspectAudioFile(file.bytes).pcm.equals(expected));
  }

  indexed.writeUInt32BE(24048, edit + 12);
  const playback = inspectAudioFile(indexed).pcm;
  assert.ok(playback.length < expected.length);
  assert.ok(playback.equals(expected.subarray(0, playback.length)));
  const results = await page.evaluate(async encoded => {
    const audio = Uint8Array.fromBase64(encoded), results = [];
    const copy = { format: 'ipod', codec: 'aac' };
    const wav = { format: 'wav', codec: 'pcm_s16le', channels: 1, alternatives: [copy] };
    for (const fileAudioTarget of [copy, wav]) for (const source of [audio, new Blob([audio]), new Blob([audio]).stream()]) {
      let calls = 0, error;
      const model = consumer.createOpenAI({ apiKey: 'fixture', fetch: async () => {
        calls++;
        return Response.json({ text: 'heard' });
      } }).transcription('whisper-1');
      try { await consumer.Transcriber.loadsAudio({ model, fileAudioTarget, maxRetries: 0 })(source); }
      catch (e) { error = [e.name, e.message]; }
      results.push({ calls, error, locked: !!source.locked });
    }
    return results;
  }, indexed.toString('base64'));
  for (const [index, { calls, error, locked }] of results.entries()) {
    assert.equal(calls, 0);
    assert.equal(locked, false);
    assert.equal(error?.[0], 'ValidationError');
    assert.match(error[1], index < 3 ? /cannot be copied/ : /movie playback edits/);
  }
});

const cappedAacRecordings = [
  ['review-chrome-aac.mp4', 63469, 63488],
  ['review-chrome-aac-recorder-pause.mp4', 63855, 63871],
];

recordingTest('a sole M4A target keeps AAC copies within the playback cap without a decoder', { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
  const page = await openPage(t, audioEntry);
  await disableWorkerAudioDecoder(page);
  const clock = ['-af', 'aresample=async=1:min_hard_comp=0.00001:first_pts=0'];
  for (const [name, frames, bound] of cappedAacRecordings) {
    const source = await readFile(new URL(name, import.meta.url));
    const file = await capturePreparedFile(page, source, { format: 'ipod', codec: 'aac', maxDurationSeconds: bound / 48000 });
    assert.equal(file.type, 'audio/mp4');
    const original = inspectAudioFile(source, clock).pcm, copy = inspectAudioFile(file.bytes, clock).pcm;
    assert.ok(copy.length >= frames * 4 && copy.length <= bound * 4, name); // 48 kHz stereo PCM16
    assert.deepEqual(copy.subarray(0, frames * 4), original.subarray(0, frames * 4));
    const decoded = await page.evaluate(async data =>
      (await new OfflineAudioContext(2, 1, 48000).decodeAudioData(Uint8Array.fromBase64(data).buffer)).length, file.bytes.toString('base64'));
    assert.ok(decoded <= bound, name + ' browser playback: ' + decoded);
    // The muxed file has a complete index. Its stream can qualify the AAC alternative without opening a decoder.
    const indexed = await capturePreparedFile(page, file.bytes, { format: 'wav', codec: 'pcm_s16le', maxDurationSeconds: bound / 48000,
      alternatives: [{ format: 'ipod', codec: 'aac' }] }, true);
    assert.equal(indexed.type, 'audio/mp4');
  }
});

recordingTest('a playable AAC profile without a verified frame bound is ineligible for a capped copy', { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
  const name = 'review-chrome-aac.mp4', source = await readFile(new URL(name, import.meta.url));
  const main = Buffer.from(source), asc = main.indexOf(Buffer.from('05808080021190', 'hex'));
  assert.notEqual(asc, -1);
  main[asc + 5] = 0x09; // Signal AAC Main for access units that use no prediction tools.
  assert.deepEqual(inspectAudioFile(main).pcm, inspectAudioFile(source).pcm);
  const target = { format: 'ipod', codec: 'aac', maxDurationSeconds: 60 };
  const rejected = await transcribeRecording(t, name, { target, changeInput: () => main });
  assert.match(rejected.validationError, /maxDurationSeconds/);
  assert.deepEqual(rejected.files, []);
});

recordingTest('AAC duration caps include full access units and pauses and select WAV before an unsafe copy', async t => {
  const page = await openPage(t, audioEntry);
  for (const [name, authored, bound] of cappedAacRecordings) {
    const source = await readFile(new URL(name, import.meta.url));
    const url = 'https://casai.test/' + name;
    let fetches = 0;
    await page.route(url, route => {
      fetches++;
      return route.fulfill({ body: source });
    });
    const outcomes = await page.evaluate(async ({ encoded, url, authored, bound }) => {
      const bytes = Uint8Array.fromBase64(encoded), requests = [], results = {};
      const model = consumer.createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
        const part = (await new Request(url, init).formData()).get('file');
        const data = await part.arrayBuffer();
        requests.push(part.type === 'audio/wav' ? new DataView(data).getUint32(40, true) / 2 : part.type);
        return Response.json({ text: 'heard' });
      } }).transcription('whisper-1');
      const aac = { format: 'ipod', codec: 'aac' };
      const wav = { format: 'wav', codec: 'pcm_s16le', rate: 48000, channels: 1, alternatives: [aac] };
      const transcribe = consumer.Transcriber.loadsAudio({ model, fileAudioTarget: aac, maxRetries: 0 });
      for (const form of ['bytes', 'blob', 'url', 'split']) {
        const outcomes = [];
        for (const [target, frames] of [[aac, authored], [aac, bound - 1], [aac, bound], [wav, authored], [wav, authored - 1], [wav, bound]]) {
          let offset = 0;
          const source = form === 'bytes' ? bytes : form === 'blob' ? new Blob([bytes]) : form === 'url' ? url : new ReadableStream({ pull(c) {
            if (offset === bytes.length) return c.close();
            const chunk = bytes.subarray(offset, offset + 421); offset += chunk.length; c.enqueue(chunk);
          } }, { highWaterMark: 0 });
          const before = requests.length;
          let failure;
          try { await transcribe.run({ audio: source, fileAudioTarget: { ...target, maxDurationSeconds: frames / 48000 } }); }
          catch (error) { failure = error.name; }
          outcomes.push([failure, requests.slice(before), !!source.locked]);
        }
        results[form] = outcomes;
      }
      return results;
    }, { encoded: source.toString('base64'), url, authored, bound });
    const perForm = [['ValidationError', [], false], ['ValidationError', [], false], [undefined, ['audio/mp4'], false],
      [undefined, [authored], false], ['ValidationError', [], false]];
    const copy = [...perForm, [undefined, ['audio/mp4'], false]];
    assert.deepEqual(outcomes, { bytes: copy, blob: copy, url: copy, split: [...perForm, [undefined, [authored], false]] }, name);
    assert.equal(fetches, 6, 'Each invocation uses one HTTP response');
  }
});

recordingTest('a copied WebM drops its track name, language and role flags and preserves every sample', { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
  const chrome = await readFile(new URL('review-chrome-opus.webm', import.meta.url));
  const name = Buffer.from('Workshop microphone');
  // Add Name, Language (fra), FlagHearingImpaired and FlagCommentary to the recorder's single TrackEntry.
  const fields = Buffer.concat([Buffer.from([0x53, 0x6e, 0x80 + name.length]), name, Buffer.from('22b59c8366726155ab810155af8101', 'hex')]);
  const tracks = chrome.indexOf(Buffer.from('1654ae6bbfaebd', 'hex'));
  assert.notEqual(tracks, -1);
  chrome[tracks + 4] += fields.length; chrome[tracks + 6] += fields.length;
  const named = Buffer.concat([chrome.subarray(0, tracks + 7), fields, chrome.subarray(tracks + 7)]);
  const original = inspectAudioFile(named);
  for (const field of ['Workshop microphone', '(fra)', '(comment)', '(hearing impaired)']) assert.ok(original.metadata.includes(field), field);
  assert.equal(original.pcm.length, 46080 * 2 * 2);

  const page = await openPage(t, audioEntry);
  const file = await capturePreparedFile(page, named, { format: 'webm', codec: 'libopus' });
  assert.equal(file.type, 'audio/webm');
  const copy = inspectAudioFile(file.bytes);
  assert.ok(!file.bytes.includes(name));
  assert.doesNotMatch(copy.metadata, /\(fra\)|\(comment\)|\(hearing impaired\)/);
  assert.deepEqual(copy.pcm, original.pcm);
});

recordingTest('prepared WAVs select audio after subtitle and video tracks and drop artwork and codec-header comments', { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
  const ff = (args, input) => execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', ...args], { input });
  const artwork = ff(['-f', 'lavfi', '-i', 'color=c=blue:s=8x8', '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1']);
  const flac = ff(['-f', 'lavfi', '-i', 'sine=frequency=530:sample_rate=48000:duration=0.6', '-i', 'pipe:0', '-map', '0:a', '-map', '1:v',
    '-c:a', 'flac', '-c:v', 'copy', '-disposition:v', 'attached_pic', '-metadata', 'title=Workshop take 17', '-f', 'flac', 'pipe:1'], artwork);
  const movie = ff(['-f', 'srt', '-i', 'pipe:0', '-f', 'lavfi', '-i', 'color=s=16x16:d=0.4', '-f', 'lavfi', '-i', 'sine=frequency=877:sample_rate=48000:duration=0.4',
    '-map', '0:s', '-map', '1:v', '-map', '2:a', '-c:s', 'mov_text', '-c:v', 'mpeg4', '-c:a', 'pcm_s16le', '-metadata', 'title=Workshop take 17',
    '-movflags', 'empty_moov+frag_keyframe', '-use_editlist', '0', '-f', 'mov', 'pipe:1'], Buffer.from('1\n00:00:00,000 --> 00:00:00,200\nCaption\n'));
  const vorbis = await readFile(new URL('review-vorbis-comments.webm', import.meta.url));
  const taggedOgg = ff(['-f', 'lavfi', '-i', 'sine=frequency=415:sample_rate=48000:duration=0.8', '-c:a', 'libvorbis', '-metadata:s:a:0', 'title=Workshop take 17', '-f', 'ogg', 'pipe:1']);
  const page = await openPage(t, audioEntry);
  for (const [name, recording] of [['movie', movie], ['flac', flac], ['vorbis-webm', vorbis], ['vorbis-ogg', taggedOgg]]) {
    assert.ok(recording.includes('Workshop take 17'), name);
    if (name === 'flac') assert.ok(recording.includes(artwork));
    const expected = ff(['-i', 'pipe:0', '-map', '0:a:0', '-f', 's16le', 'pipe:1'], recording);
    await page.route('https://casai.test/' + name, route => route.fulfill({ body: recording }));
    const captured = [];
    await page.route('https://casai.test/captured-' + name, async route => {
      const request = route.request();
      const part = (await new Request(request.url(), { method: 'POST', headers: request.headers(), body: request.postDataBuffer() }).formData()).get('file');
      assert.equal(part.type, 'audio/wav'); captured.push(Buffer.from(await part.arrayBuffer()));
      await route.fulfill({ json: { text: 'heard' } });
    });
    const state = await page.evaluate(async name => {
      const { Transcriber, createOpenAI, ValidationError } = consumer;
      const model = createOpenAI({ apiKey: 'fixture', fetch: (_, init) => fetch('/captured-' + name, init) }).transcription('whisper-1');
      const file = Transcriber.loadsAudio({ model, maxRetries: 0, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
      const source = await (await fetch('/' + name)).blob();
      const states = [];
      for (const input of [source, source.stream()]) {
        try { await file(input); states.push('heard'); }
        catch (error) { if (!(error instanceof ValidationError)) throw error; states.push(error.message); }
      }
      return states;
    }, name);
    if (name.startsWith('vorbis')) { assert.equal(captured.length, 0); for (const failure of state) assert.match(failure, /Vorbis playback/); continue; }
    assert.deepEqual(state, ['heard', 'heard'], name); assert.equal(captured.length, 2);
    for (const wav of captured) {
      assert.ok(!wav.includes(artwork) && !wav.includes('Workshop take 17'), name);
      const pcm = ff(['-i', 'pipe:0', '-f', 's16le', 'pipe:1'], wav);
      assert.equal(pcm.length, expected.length, name);
      let peak = 0;
      for (let i = 0; i < pcm.length; i += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i) - expected.readInt16LE(i)));
      assert.ok(peak <= 2, `${name} peak PCM16 error ${peak}`);
    }
  }
});

recordingTest('edited WebM and chained Ogg stop the existing raw execution before affected samples', async t => {
  const page = await openPage(t, audioEntry);
  for (const name of ['review-chrome-opus-trimmed.webm', 'review-chained-opus.ogg']) {
    const bytes = await readFile(new URL(name, import.meta.url));
    await page.route('https://casai.test/' + name, route => route.fulfill({ body: bytes }));
  }
  const result = await page.evaluate(async () => {
    const { Transcriber, ValidationError } = consumer;
    const results = [];
    for (const [name, verifiedFrames] of [['review-chrome-opus-trimmed.webm', 45840], ['review-chained-opus.ogg', 48000]]) {
      const blob = await (await fetch('/' + name)).blob();
      let files = 0, frames = 0, rawCalls = 0;
      const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4',
        async doGenerate() { files++; return { text: 'received', segments: [], warnings: [] }; },
        async doStream({ audio }) {
          rawCalls++;
          for await (const chunk of audio) frames += chunk.byteLength / 2;
          return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'received', segments: [] }); c.close(); } }) };
        } };
      const file = Transcriber.loadsAudio({ model, maxRetries: 0, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
      const raw = Transcriber.loadsAudio({ model, maxRetries: 0, inputAudioFormat: { type: 'audio/pcm', rate: 48000 } });
      let fileError, rawError;
      try { await file(blob.stream()); } catch (error) { fileError = error instanceof ValidationError; }
      try { await raw(blob.stream()); } catch (error) { rawError = error instanceof ValidationError; }
      results.push([fileError, files, rawError, rawCalls, frames <= verifiedFrames]);
    }
    return results;
  });
  for (const [fileError, files, rawError, rawCalls, verified] of result) {
    assert.deepEqual([fileError, files, rawError, verified], [true, 0, true, true]);
    assert.ok(rawCalls <= 1);
  }
});

recordingTest('a lost Ogg page or incomplete endpoint cannot become a complete provider file', async t => {
  const page = await openPage(t, audioEntry);
  const ogg = await readFile(new URL('review-firefox-opus.ogg', import.meta.url));
  const intact = await capturePreparedFile(page, ogg, { format: 'wav', codec: 'pcm_s16le', channels: 1 });
  assert.equal(intact.type, 'audio/wav');
  assert.equal(intact.bytes.toString('ascii', 36, 40), 'data');
  const pcm = intact.bytes.subarray(44);
  assert.equal(pcm.length, 64384 * 2);
  await checkPcmPlayback(page, ogg, pcm, undefined, 48000);

  const pages = [];
  for (let offset = 0; offset < ogg.length;) {
    assert.equal(ogg.toString('ascii', offset, offset + 4), 'OggS');
    const segments = ogg[offset + 26];
    const size = 27 + segments + ogg.subarray(offset + 27, offset + 27 + segments).reduce((sum, length) => sum + length, 0);
    pages.push(offset);
    offset += size;
  }
  assert.equal(ogg[pages.at(-1) + 5] & 4, 4);
  for (const truncated of [ogg.subarray(0, pages.at(-1)), ogg.subarray(0, -5)]) {
    await checkPcmPlayback(page, truncated, pcm.subarray(0, 61128 * 2), 'Cannot verify a complete Ogg recording.', 48000);
  }
  const missing = Buffer.concat([ogg.subarray(0, pages[5]), ogg.subarray(pages[6])]);
  await checkPcmPlayback(page, missing, pcm.subarray(0, 36936 * 2), 'Ogg page sequence is discontinuous.', 48000);
});

recordingTest('stereo Opus resamples both channels into the provider WAV', { skip: !process.env.CASAI_REVIEW_FFMPEG }, async t => {
  const name = 'review-chrome-opus.webm';
  const ff = (args, input) => execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', ...args], { input });
  const tones = ff(['-f', 'lavfi', '-i', 'aevalsrc=0.2*sin(2*PI*403*t)|0.6*sin(2*PI*913*t):s=48000:d=0.4',
    '-c:a', 'libopus', '-f', 'ogg', 'pipe:1']);
  for (const recording of [await readFile(new URL(name, import.meta.url)), tones]) {
    const pcm = ff(['-c:a', 'libopus', '-request_sample_fmt', 'flt', '-i', 'pipe:0', '-f', 's16le', 'pipe:1'], recording);
    const referencePCM = Buffer.alloc(pcm.length / 2);
    for (let i = 0; i < referencePCM.length; i += 4) pcm.copy(referencePCM, i, i * 2, i * 2 + 4);
    const { text, files, validationError, nativeError } = await transcribeRecording(t, name, { changeInput: () => recording,
      target: { format: 'wav', codec: 'pcm_s16le', rate: 24000, channels: 2 }, referencePCM, sampleWindow: [0, 1] });
    assert.equal(text, 'received', (recording === tones ? 'two-tone recording' : 'Chrome recording') + ': ' + (validationError ?? nativeError));
    assert.equal(files[0].channels, 2);
    assert.ok(files[0].ffmpegPeak <= 8, 'peak PCM16 difference ' + files[0].ffmpegPeak);
  }
});

recordingTest('browser WAV preserves stereo during resampling and float64 low bits during copying', async t => {
  const page = await openPage(t, audioEntry);
  const result = await page.evaluate(async () => {
    const { Transcriber, createOpenAI } = consumer;
    function wav(channels, bits, frames) {
      const size = channels * bits / 8, bytes = new Uint8Array(44 + frames * size), v = new DataView(bytes.buffer);
      v.setUint32(0, 0x52494646); v.setUint32(4, bytes.length - 8, true); v.setUint32(8, 0x57415645);
      v.setUint32(12, 0x666d7420); v.setUint32(16, 16, true); v.setUint16(20, bits === 64 ? 3 : 1, true);
      v.setUint16(22, channels, true); v.setUint32(24, 48000, true); v.setUint32(28, 48000 * size, true);
      v.setUint16(32, size, true); v.setUint16(34, bits, true); v.setUint32(36, 0x64617461); v.setUint32(40, bytes.length - 44, true);
      for (let i = 0; i < frames; i++) {
        if (bits === 64) v.setFloat64(44 + i * size, 0.5 + i * 2 ** -50, true);
        else v.setInt16(44 + i * size + size - 2, -18000, true);
      }
      return bytes;
    }
    const outcomes = [];
    const model = createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      const part = (await new Request(url, init).formData()).get('file');
      const data = await part.arrayBuffer(), view = new DataView(data);
      let offset = 12;
      while (view.getUint32(offset) !== 0x64617461) {
        const size = view.getUint32(offset + 4, true); offset += 8 + size + (size & 1);
      }
      const pcm = data.slice(offset + 8, offset + 8 + view.getUint32(offset + 4, true));
      if (!outcomes.length) {
        const audio = await new OfflineAudioContext(2, 1, 24000).decodeAudioData(data);
        outcomes.push([audio.length, audio.numberOfChannels, audio.getChannelData(0)[400], audio.getChannelData(1)[400]]);
      } else outcomes.push(Array.from(new Float64Array(pcm)));
      return Response.json({ text: 'received' });
    } }).transcription('whisper-1');
    const file = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', channels: 2, rate: 24000 } });
    await file(wav(2, 16, 48000));
    await file.run({ audio: wav(1, 64, 17), fileAudioTarget: { format: 'wav', codec: 'pcm_f64le', sampleFormat: 'dbl' } });
    for (const channels of [3, 8]) {
      try { await file(wav(channels, 16, 1000)); } catch (error) { outcomes.push(error.name); }
    }
    return outcomes;
  });
  assert.deepEqual(result[0].slice(0, 2), [24000, 2]);
  assert.ok(Math.abs(result[0][2]) < 0.001 && result[0][3] < -0.54);
  assert.deepEqual(result[1], Array.from({ length: 17 }, (_, i) => 0.5 + i * 2 ** -50));
  assert.deepEqual(result.slice(2), ['ValidationError', 'ValidationError']);
});

recordingTest('a WebM copy respects inclusive size and playable-duration limits without a decoder', async t => {
  const page = await openPage(t, audioEntry);
  const bytes = await readFile(new URL('review-chrome-opus.webm', import.meta.url));
  await page.route('https://casai.test/recording', route => route.fulfill({ body: bytes }));
  await disableWorkerAudioDecoder(page);
  const result = await page.evaluate(async () => {
    const recording = await (await fetch('/recording')).blob();
    const target = { format: 'webm', codec: 'libopus' };
    const sizes = [];
    const model = consumer.createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      const part = (await new Request(url, init).formData()).get('file');
      sizes.push(part.size); return Response.json({ text: 'heard' });
    } }).transcription('whisper-1');
    const file = consumer.Transcriber.loadsAudio({ model, fileAudioTarget: target });
    await file(recording);
    const before = sizes[0], errors = [];
    await file.run({ audio: recording, maxPreparedAudioBytes: 1, fileAudioTarget: { ...target, maxBytes: before, maxDurationSeconds: 46080 / 48000 } });
    for (const limit of [{ maxBytes: before - 1 }, { maxDurationSeconds: 46079 / 48000 }]) {
      try { await file.run({ audio: recording, maxPreparedAudioBytes: 1, fileAudioTarget: { ...target, maxBytes: before, ...limit } }); }
      catch (error) { errors.push([error.name, error.message]); }
    }
    return { sizes, errors };
  });
  assert.equal(result.sizes.length, 2); assert.equal(result.sizes[0], result.sizes[1]);
  assert.deepEqual(result.errors.map(([name]) => name), ['ValidationError', 'ValidationError']);
});

recordingTest('bounded movie and EBML headers take precedence over a reusable PCM layout', async t => {
  const movie = await readFile(new URL('review-safari-aac.mp4', import.meta.url));
  const moov = movie.readUInt32BE(0);
  assert.equal(movie.toString('ascii', moov + 4, moov + 8), 'moov');
  // Omit the optional ftyp and put a free box before the movie's first header.
  const free = Buffer.from('0000000866726565', 'hex');
  const taggedMovie = Buffer.concat([movie.subarray(moov, moov + 8), free, movie.subarray(moov + 8)]);
  taggedMovie.writeUInt32BE(movie.readUInt32BE(moov) + free.length);

  const webm = await readFile(new URL('review-chrome-opus.webm', import.meta.url));
  const headerEnd = 5 + (webm[4] & 0x7f);
  const padding = Buffer.alloc(4500);
  for (let i = 0; i < padding.length; i += 3) padding.set([0xec, 0x81, 0], i); // EBML Void
  const header = Buffer.alloc(6);
  webm.copy(header, 0, 0, 4);
  header.writeUInt16BE(0x4000 + headerEnd - 5 + padding.length, 4);
  const taggedWebm = Buffer.concat([header, webm.subarray(5, headerEnd), padding, webm.subarray(headerEnd)]);
  const raw = Buffer.concat([taggedMovie.subarray(0, 16), Buffer.alloc(32, 0x25)]);
  raw.writeUInt32BE(16); // A movie box with only padding contains no movie header evidence.
  const page = await openPage(t, audioEntry);
  for (const [name, bytes] of [['movie', movie], ['movie-layout', taggedMovie], ['webm', webm], ['webm-layout', taggedWebm], ['raw', raw]]) {
    await page.route('https://casai.test/' + name, route => route.fulfill({ body: bytes }));
  }
  const uploads = [];
  await page.route('https://casai.test/classification/audio/transcriptions', async route => {
    const request = route.request();
    const part = (await new Request(request.url(), { method: 'POST', headers: request.headers(), body: request.postDataBuffer() }).formData()).get('file');
    assert.equal(part.type, 'audio/wav');
    uploads.push(Buffer.from(await part.arrayBuffer()));
    await route.fulfill({ json: { text: 'heard' } });
  });
  await page.evaluate(async () => {
    const { Transcriber, createOpenAI } = consumer;
    const model = createOpenAI({ baseURL: 'https://casai.test/classification', apiKey: 'fixture' }).transcription('whisper-1');
    const config = { model, maxRetries: 0, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', channels: 1, rate: 48000 } };
    const fallback = Transcriber.loadsAudio({ ...config, sourceFormat: { channels: 1, sampleRate: 48000, encoding: 'pcm_s16le' } });
    const plain = Transcriber.loadsAudio(config);
    for (const name of ['movie', 'webm']) {
      await plain(new Uint8Array(await (await fetch('/' + name)).arrayBuffer()));
      const bytes = new Uint8Array(await (await fetch('/' + name + '-layout')).arrayBuffer());
      let offset = 0;
      const split = new ReadableStream({ pull(controller) {
        if (offset === bytes.length) controller.close();
        else { controller.enqueue(bytes.subarray(offset, offset + 421)); offset = Math.min(bytes.length, offset + 421); }
      } }, { highWaterMark: 0 });
      for (const source of [bytes, new Blob([bytes]), split]) await fallback(source);
    }
    await fallback(new Uint8Array(await (await fetch('/raw')).arrayBuffer()));
  });
  assert.equal(uploads.length, 9);
  for (const [index, frames] of [[0, 78784], [4, 46080]]) {
    assert.equal(uploads[index].length, 44 + frames * 2);
    for (let i = 1; i <= 3; i++) assert.deepEqual(uploads[index + i], uploads[index]);
  }
  assert.deepEqual(uploads.at(-1).subarray(44), raw);
});

test('plausible movie padding keeps the browser prefix bounded and accepts explicit PCM', async t => {
  const page = await openPage(t, audioEntry);
  const result = await page.evaluate(async () => {
    const { Transcriber, ValidationError } = consumer;
    const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doGenerate({ audio }) {
      files.push(new Uint8Array(audio).subarray(44).toBase64());
      return { text: 'heard', warnings: [] };
    } };
    const files = [];
    const component = Transcriber.loadsAudio({ model, maxRetries: 0, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' },
      sourceFormat: { channels: 1, sampleRate: 24000, encoding: 'pcm_s16le' } });
    const padded = padding => {
      const bytes = new Uint8Array(padding + 64).fill(37);
      new DataView(bytes.buffer).setUint32(0, padding);
      bytes.set(new TextEncoder().encode('free'), 4);
      return bytes;
    };
    const short = padded(8200), long = padded(65536);
    await component(short);
    await component(new Blob([short]));
    let shortOffset = 0;
    await component(new ReadableStream({ pull(controller) {
      if (shortOffset === short.length) controller.close();
      else { controller.enqueue(short.subarray(shortOffset, shortOffset + 503)); shortOffset = Math.min(short.length, shortOffset + 503); }
    } }, { highWaterMark: 0 }));
    await component(new Blob([long], { type: 'audio/pcm;rate=24000;channels=1' }));
    await component(new Int16Array(long.buffer));
    let offset = 0, cancellation;
    const split = new ReadableStream({ pull(controller) {
      controller.enqueue(long.subarray(offset, offset + 512)); offset += 512;
    }, cancel(reason) { cancellation = reason; } }, { highWaterMark: 0 });
    let rejected = false, guide = false;
    try { await component(split); }
    catch (error) { rejected = error instanceof ValidationError; guide = error.message.includes('audio/pcm Blob') && error.message.includes('encoded media type'); }

    const abort = new AbortController(), reason = new Error('Stop while reading past the common prefix');
    let pendingPull, abortReason, pulls = 0;
    const waiting = new Promise(resolve => { pendingPull = resolve; });
    const pending = new ReadableStream({ pull(controller) {
      if (++pulls === 1) controller.enqueue(short.subarray(0, 4096));
      else pendingPull();
    }, cancel(value) { abortReason = value; } }, { highWaterMark: 0 });
    const stopped = component.run({ audio: pending, abortSignal: abort.signal }).then(() => false, error => error === reason);
    await waiting;
    abort.abort(reason);
    return { files, short: short.toBase64(), long: long.toBase64(), rejected, guide, offset, unlocked: !split.locked, cancelled: !!cancellation,
      aborted: await stopped && abortReason === reason && !pending.locked };
  });
  assert.deepEqual(result.files, [result.short, result.short, result.short, result.long, result.long]);
  assert.equal(result.rejected, true);
  assert.equal(result.guide, true);
  assert.ok(result.offset <= 8192, 'A box advertised beyond the budget does not trigger further prefix reads');
  assert.equal(result.unlocked, true);
  assert.equal(result.cancelled, true);
  assert.equal(result.aborted, true);
});

recordingTest('browser lookahead recognizes movie and EBML headers after long padding', async t => {
  const movie = await readFile(new URL('review-safari-aac.mp4', import.meta.url));
  const moov = movie.readUInt32BE(0);
  assert.equal(movie.toString('ascii', moov + 4, moov + 8), 'moov');
  const padding = size => { const free = Buffer.alloc(size); free.writeUInt32BE(size); free.write('free', 4); return free; };
  const leading = Buffer.concat([padding(8200), movie.subarray(moov)]);
  const nested = Buffer.concat([movie.subarray(moov, moov + 8), padding(8200), movie.subarray(moov + 8)]);
  nested.writeUInt32BE(movie.readUInt32BE(moov) + 8200);
  const beyond = Buffer.concat([padding(65520), movie.subarray(moov)]);
  const webm = await readFile(new URL('review-chrome-opus.webm', import.meta.url));
  const headerEnd = 5 + (webm[4] & 0x7f), voids = Buffer.alloc(4500);
  for (let i = 0; i < voids.length; i += 3) voids.set([0xec, 0x81, 0], i);
  const header = Buffer.alloc(6);
  webm.copy(header, 0, 0, 4);
  header.writeUInt16BE(0x4000 + headerEnd - 5 + voids.length, 4);
  const delayedWebm = Buffer.concat([header, voids, webm.subarray(5)]);
  const page = await openPage(t, audioEntry);
  for (const [name, bytes] of [['original', movie], ['leading', leading], ['nested', nested], ['beyond', beyond], ['webm', webm], ['delayed-webm', delayedWebm]]) {
    await page.route('https://casai.test/' + name, route => route.fulfill({ body: bytes }));
  }
  const uploads = [];
  await page.route('https://casai.test/lookahead/audio/transcriptions', async route => {
    const request = route.request();
    const part = (await new Request(request.url(), { method: 'POST', headers: request.headers(), body: request.postDataBuffer() }).formData()).get('file');
    assert.equal(part.type, 'audio/wav');
    uploads.push(Buffer.from(await part.arrayBuffer()));
    await route.fulfill({ json: { text: 'heard' } });
  });
  const result = await page.evaluate(async () => {
    const { Transcriber, ValidationError, createOpenAI } = consumer;
    const model = createOpenAI({ baseURL: 'https://casai.test/lookahead', apiKey: 'fixture' }).transcription('whisper-1');
    const config = { model, maxRetries: 0, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', channels: 1, rate: 48000 } };
    const plain = Transcriber.loadsAudio(config);
    const fallback = Transcriber.loadsAudio({ ...config, sourceFormat: { channels: 1, sampleRate: 48000, encoding: 'pcm_s16le' } });
    const read = async name => new Uint8Array(await (await fetch('/' + name)).arrayBuffer());
    const inAllForms = async name => {
      const bytes = await read(name);
      let offset = 0;
      const split = new ReadableStream({ pull(controller) {
        if (offset === bytes.length) controller.close();
        else { controller.enqueue(bytes.subarray(offset, offset + 421)); offset = Math.min(bytes.length, offset + 421); }
      } }, { highWaterMark: 0 });
      for (const source of [bytes, new Blob([bytes]), split]) await fallback(source);
    };
    await plain(await read('original'));
    for (const name of ['leading', 'nested']) await inAllForms(name);
    await fallback(new Blob([await read('leading')], { type: 'audio/pcm' }));
    const bytes = await read('beyond');
    let ambiguous = false;
    try { await fallback(bytes); } catch (error) { ambiguous = error instanceof ValidationError; }
    await fallback(new Blob([bytes], { type: 'video/quicktime' }));
    await plain(bytes);
    await plain(await read('webm'));
    await inAllForms('delayed-webm');
    return { ambiguous };
  });
  assert.deepEqual(result, { ambiguous: true });
  assert.equal(uploads.length, 14);
  assert.equal(uploads[0].length, 44 + 78784 * 2);
  for (const wav of uploads.slice(0, 10)) assert.deepEqual(wav, uploads[0]);
  assert.equal(uploads[10].length, 44 + 46080 * 2);
  for (const wav of uploads.slice(10)) assert.deepEqual(wav, uploads[10]);
});

recordingTest('HTTP audio uses one representation and never follows a playlist child', async t => {
  const bytes = await readFile(new URL('review-chrome-opus.webm', import.meta.url));
  const page = await openPage(t, audioEntry);
  const requests = new Map(), logs = [];
  page.on('console', message => logs.push(message.text()));
  await page.route('https://casai.test/media/**', async route => {
    const url = new URL(route.request().url()), kind = url.pathname.split('/').pop();
    const count = requests.get(kind) ?? 0; requests.set(kind, count + 1);
    if (kind === 'full') return route.fulfill({ status: 200, body: bytes });
    if (kind === 'full-with-range') {
      // 5,987 is a cluster boundary. Treating this header as length cleanly cuts off the later clusters.
      return route.fulfill({ status: 200, headers: { 'content-range': 'bytes 0-5986/5987' }, body: bytes });
    }
    if (kind === 'manifest') return route.fulfill({ body: '#EXTM3U\n#EXTINF:2,\nhttps://casai.test/media/child\n' });
    if (kind === 'failed') return route.abort('failed');
    if (kind === 'status' || kind === 'late-status' && count) return route.fulfill({ status: 403, body: url.search });
    if (kind === 'late-full' && count) return route.fulfill({ status: 200, headers: { etag: '"one"' }, body: bytes });
    const match = /^bytes=(\d+)-(\d+)$/.exec(route.request().headers().range);
    if (!match) return route.fulfill({ status: 400 });
    const first = Number(match[1]), last = Math.min(Number(match[2]), first + 1023, bytes.length - 1);
    const etag = kind === 'weak' ? 'W/"one"' : kind === 'change' && count ? '"two"' : kind === 'opaque-etag' ? '"one\xa0"' : '"one"';
    const headers = { etag, 'content-range': `bytes ${first}-${last}/${bytes.length}` };
    if (kind === 'missing') delete headers.etag;
    if (kind === 'hidden-range') delete headers['content-range'];
    if (first >= bytes.length) return route.fulfill({ status: 416, headers: { etag, 'content-range': 'bytes */' + bytes.length } });
    return route.fulfill({ status: 206, headers, body: bytes.subarray(first, last + (kind === 'short' ? 0 : 1)) });
  });
  const results = await page.evaluate(async () => {
    const { Transcriber, createOpenAI } = consumer, results = {};
    let sent = 0;
    const model = createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      const file = (await new Request(url, init).formData()).get('file');
      const decoded = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(await file.arrayBuffer());
      if (decoded.length !== 46080) throw Error('Truncated file'); sent++; return Response.json({ text: 'heard' });
    } }).transcription('whisper-1');
    const transcribe = Transcriber.loadsAudio({ model, maxRetries: 0, fileAudioTarget: { format: 'webm', codec: 'libopus' } });
    for (const kind of ['full','full-with-range','stable','opaque-etag','missing','weak','change','late-full','hidden-range','short','manifest','failed','status','late-status']) {
      try { results[kind] = (await transcribe('https://casai.test/media/' + kind + '?sig=private-recording-token#t=0,0.2')).text; }
      catch (error) { results[kind] = [error.name, error.message, String(error.cause), error.stack]; }
    }
    return { results, sent };
  });
  for (const name of ['full', 'full-with-range', 'stable', 'opaque-etag']) assert.equal(results.results[name], 'heard', name);
  assert.ok(requests.get('stable') > 1); assert.equal(requests.get('full'), 1);
  assert.ok(requests.get('opaque-etag') > 1); assert.equal(requests.get('full-with-range'), 1);
  for (const name of ['missing','weak','change','late-full','hidden-range','short','manifest']) assert.equal(results.results[name][0], 'ValidationError', name);
  assert.equal(requests.get('late-full'), 2);
  for (const name of ['status', 'late-status']) {
    assert.deepEqual(results.results[name].slice(0, 3), ['Error', 'Audio resource request failed (HTTP 403).', 'undefined']);
  }
  assert.equal(requests.get('status'), 1);
  assert.equal(requests.get('late-status'), 2);
  assert.equal(results.sent, 4); assert.equal(requests.has('child'), false); assert.equal(requests.get('failed'), 1);
  assert.doesNotMatch(JSON.stringify(results), /private-recording-token/);
  assert.doesNotMatch(logs.join('\n'), /private-recording-token/);
});

recordingTest('extensionless URLs inspect their content with a reusable PCM layout and reject unverified MP3 ends', async t => {
  const page = await openPage(t, audioEntry);
  const pcm = Buffer.alloc(128, 0x25), wav = Buffer.alloc(44 + pcm.length);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length, 40); pcm.copy(wav, 44);
  const recordings = new Map([['wave', wav], ['raw', pcm]]);
  for (const frames of [43860, 44100]) recordings.set('mp3-' + frames, await readFile(new URL(`review-mp3-${frames}.mp3`, import.meta.url)));
  const requests = [];
  await page.route('https://casai.test/source/**', route => {
    const key = new URL(route.request().url()).pathname.split('/').pop();
    requests.push(key); return route.fulfill({ body: recordings.get(key) });
  });
  const results = await page.evaluate(async () => {
    const { Transcriber, ValidationError } = consumer;
    let rawFrames = 0, files = 0, calls = 0;
    const model = { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4',
      async doGenerate({ audio }) {
        const bytes = new Uint8Array(audio), view = new DataView(bytes.buffer, bytes.byteOffset);
        let stored;
        for (let p = 12; p + 8 <= bytes.length;) {
          const size = view.getUint32(p + 4, true);
          if (view.getUint32(p) === 0x64617461) stored = bytes.subarray(p + 8, p + 8 + size);
          p += 8 + size + (size & 1);
        }
        if (view.getUint32(24, true) !== 24000 || stored?.length !== 128 || !stored.every(n => n === 0x25)) throw Error('Wrong WAV received');
        files++; return { text: 'heard', segments: [], warnings: [] };
      }, async doStream({ audio }) {
        calls++;
        for await (const chunk of audio) { if (!chunk.every(n => n === 0x25)) throw Error('Wrong PCM received'); rawFrames += chunk.length / 2; }
        return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'heard', segments: [] }); c.close(); } }) };
      } };
    const settings = { model, maxRetries: 0, sourceFormat: { encoding: 'pcm_s16le', channels: 2, sampleRate: 48000 } };
    const raw = Transcriber.loadsAudio({ ...settings, inputAudioFormat: { type: 'audio/pcm', rate: 24000 } });
    const file = Transcriber.loadsAudio({ ...settings, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
    const states = [];
    for (const key of ['wave', 'raw', 'mp3-43860', 'mp3-44100']) for (const component of [raw, file]) {
      try { states.push((await component(new URL('/source/' + key, location.href))).text); }
      catch (error) { if (!(error instanceof ValidationError)) throw error; states.push('unsupported'); }
    }
    return { states, calls, rawFrames, files };
  });
  assert.deepEqual(results, { states: ['heard', 'heard', ...Array(6).fill('unsupported')], calls: 1, rawFrames: 64, files: 1 });
  assert.deepEqual(requests, [...recordings.keys()].flatMap(name => [name, name]));
});

recordingTest('6C leaves a split recording reusable after a worker startup failure', async t => {
  const page = await openPage(t, audioEntry);
  const bytes = await readFile(new URL('review-chrome-opus.webm', import.meta.url));
  await page.route('https://casai.test/recording', route => route.fulfill({ body: bytes }));
  const result = await page.evaluate(async () => {
    const recording = new Uint8Array(await (await fetch('/recording')).arrayBuffer());
    let pulls = 0, cancellations = 0;
    const source = new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(recording); controller.close(); },
      cancel() { cancellations++; },
    }, { highWaterMark: 0 });
    const files = [];
    const model = consumer.createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
      const file = (await new Request(url, init).formData()).get('file');
      const decoder = new OfflineAudioContext(2, 1, 48000);
      files.push([file.type, (await decoder.decodeAudioData(await file.arrayBuffer())).length]);
      return Response.json({ text: 'received' });
    } }).transcription('whisper-1');
    const transcribe = consumer.Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'webm', codec: 'libopus' } });
    const NativeWorker = window.Worker;
    const broken = URL.createObjectURL(new Blob(["throw new Error('startup probe')"], { type: 'text/javascript' }));
    let error;
    try {
      window.Worker = class extends NativeWorker {
        constructor(_url, options) { super(broken, options); }
      };
      try { await transcribe(source); } catch (cause) { error = cause; }
    } finally {
      window.Worker = NativeWorker;
      URL.revokeObjectURL(broken);
    }
    const failed = { rejected: error instanceof Error, locked: source.locked, pulls, cancellations, uploads: files.length };
    const { text } = await transcribe(source);
    return { failed, text, files, pulls, locked: source.locked };
  });
  assert.deepEqual(result, {
    failed: { rejected: true, locked: false, pulls: 0, cancellations: 0, uploads: 0 },
    text: 'received', files: [['audio/webm', 46080]], pulls: 1, locked: false,
  });
});

recordingTest('6C sends a WAV ending at the final recorded Firefox Opus sample', async t => {
  const name = 'review-firefox-opus.ogg';
  const referencePCM = process.env.CASAI_REVIEW_FFMPEG && execFileSync(process.env.CASAI_REVIEW_FFMPEG,
    ['-v', 'error', '-c:a', 'libopus', '-request_sample_fmt', 'flt', '-i', 'pipe:0', '-f', 's16le', 'pipe:1'], { input: await readFile(new URL(name, import.meta.url)) });
  const { text, files } = await transcribeRecording(t, name, {
    target: { format: 'wav', codec: 'pcm_s16le' }, referencePCM,
  });
  assert.equal(text, 'received');
  assert.equal(files.length, 1);
  const [file] = files;
  assert.equal(file.name, 'audio.wav');
  assert.equal(file.type, 'audio/wav');
  assert.equal(file.frames, 64384);
  assert.ok(file.maxDifference <= 2 / 32768, `peak PCM difference ${file.maxDifference} at ${file.worst}`);
  if (referencePCM) assert.ok(file.ffmpegPeak <= 8, `independent Opus decoder difference ${file.ffmpegPeak} PCM16 units`);
});

for (const [name, frames, gap] of [
  ['review-safari-aac.mp4', 78784], ['review-ios-safari-aac.mp4', 97216], ['review-chrome-aac.mp4', 63469],
  ['review-chrome-aac-recorder-pause.mp4', 63855, [31744, 32127]],
  ['review-firefox-opus.ogg', 64384], ['shortened-firefox', 64144],
]) {
  recordingTest(`raw translation and multipart mono WAV play the same ${frames} frames from ${name}`, async t => {
    const bytes = await readFile(new URL(name === 'shortened-firefox' ? 'review-firefox-opus.ogg' : name, import.meta.url));
    if (name === 'shortened-firefox') {
      const last = bytes.lastIndexOf('OggS'); bytes.writeBigUInt64LE(64456n, last + 6); bytes.writeUInt32LE(0xfe20860c, last + 22);
    }
    const page = await openPage(t, audioEntry);
    await page.route('https://casai.test/recording', route => route.fulfill({ body: bytes }));
    const outcomes = await page.evaluate(async ({ gap, alternative }) => {
      const bytes = new Uint8Array(await (await fetch('/recording')).arrayBuffer());
      const { Translator, Transcriber, createOpenAI } = consumer;
      let wav, raw;
      const file = Transcriber.loadsAudio({ model: createOpenAI({ apiKey: 'fixture', fetch: async (url, init) => {
        const part = (await new Request(url, init).formData()).get('file');
        const data = await part.arrayBuffer(), view = new DataView(data);
        if (part.type !== 'audio/wav' || view.getUint32(36) !== 0x64617461 || view.getUint16(22, true) !== 1
          || view.getUint32(24, true) !== 48000 || view.getUint16(34, true) !== 16) throw Error('Unexpected provider file');
        wav = new Uint8Array(data, 44, view.getUint32(40, true)); return Response.json({ text: 'received' });
      } }).transcription('whisper-1'),
      sourceFormat: { channels: 1, sampleRate: 8000, encoding: 'pcm_s16le' },
      fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', channels: 1, rate: 48000, alternatives: [alternative] } });
      const translate = Translator.loadsAudio({ targetLanguage: 'en', sourceFormat: { channels: 1, sampleRate: 8000, encoding: 'pcm_s16le' },
        inputAudioFormat: { type: 'audio/pcm', rate: 48000 },
        model: { provider: 'fixture', modelId: 'fixture', specificationVersion: 'v4', async doStream({ audio }) {
          const chunks = [];
          for await (const chunk of audio) { if (chunk.byteLength > 65536) throw Error('Unbounded raw chunk'); chunks.push(chunk); }
          raw = new Uint8Array(await new Blob(chunks).arrayBuffer());
          return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', outputText: 'heard' }); c.close(); } }) };
        } } });
      function split() {
        let offset = 0;
        return new ReadableStream({ pull(c) {
          if (offset >= bytes.length) return c.close();
          const part = bytes.subarray(offset, offset + 421); offset += part.length; c.enqueue(part);
        } }, { highWaterMark: 0 });
      }
      const outcomes = [];
      for (const source of [() => bytes, () => new Blob([bytes]), split]) {
        await file(source()); await translate(source());
        const pcm = new Int16Array(raw.buffer);
        const paused = !gap || pcm.subarray(...gap).every(value => value === 0)
          && pcm.subarray(gap[1], gap[1] + 256).some(value => Math.abs(value) > 300);
        outcomes.push([pcm.length, wav.length === raw.length && raw.every((value, i) => wav[i] === value), paused]);
      }
      return outcomes;
    }, { gap, alternative: name.includes('safari') ? { format: 'ipod', codec: 'aac' } : { format: 'webm', codec: 'libopus' } });
    assert.deepEqual(outcomes, Array(3).fill([frames, true, true]));
  });
}

test('an audio element plays an authorized MP3 reply before its HTTP body closes', { timeout: 45000 }, async t => {
  const { createServer } = await import('node:http');
  const { once } = await import('node:events');
  const { Readable } = await import('node:stream');
  const { pipeline } = await import('node:stream/promises');
  const { SpeechGenerator } = await import('casai');
  const { Experimental_MockStreamingSpeechModelV4 } = await import('ai/test');
  const { takeMp3Reply } = await import('../../docs/examples/streaming-voice.mjs');
  const example = await readFile(new URL('review-mp3-44100.mp3', import.meta.url));
  // The first 357 bytes of this fixture contain ID3 and the MPEG Info frame.
  const frames = example.subarray(357);
  assert.equal(frames.readUInt16BE(0), 0xfffb);
  const release = Promise.withResolvers(), delivered = Promise.withResolvers();
  t.signal.addEventListener('abort', () => release.resolve(), { once: true });
  let generations = 0, ended = false;
  const model = new Experimental_MockStreamingSpeechModelV4({ doStream: async () => {
    generations++;
    return { stream: new ReadableStream({ async start(c) {
      const audio = bytes => ({ type: 'audio', audioFormat: { type: 'audio/mpeg' }, audio: bytes });
      c.enqueue(audio(Buffer.concat(Array(8).fill(frames))));
      await release.promise; c.enqueue(audio(frames)); c.enqueue({ type: 'finish' }); c.close();
    } }) };
  } });
  const replies = new Map([['demo', await SpeechGenerator.asStream({ model })('Playback example')]]);
  const server = createServer(async (req, res) => {
    if (req.url !== '/reply') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<button onclick="sound.src=\'/reply\'; sound.play()">Listen</button><audio id="sound"></audio>');
      return;
    }
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableEnded) abort.abort(); });
    try {
      const response = takeMp3Reply(replies, 'demo', new Request('http://localhost/reply', { method: req.method, signal: abort.signal }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body === null) { res.end(); return; }
      await pipeline(Readable.fromWeb(response.body), res);
      ended = true; delivered.resolve();
    } catch (error) { res.destroy(); delivered.resolve(error); }
  });
  const page = await browser.newPage();
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    await page.goto('http://127.0.0.1:' + server.address().port);
    const metadata = await page.request.head(new URL('/reply', page.url()).href);
    assert.equal(metadata.status(), 200);
    assert.equal(metadata.headers()['content-type'], 'audio/mpeg');
    await page.getByRole('button', { name: 'Listen' }).click();
    await page.waitForFunction(() => document.querySelector('audio').currentTime > 0.15, null, { timeout: 6500 });
    assert.equal(ended, false);
    // A browser may serialize two fetches of the same URL. A separate HTTP
    // client checks the in-flight route while the page retries normally.
    const [retryStatus] = await Promise.all([
      page.evaluate(async () => (await fetch('/reply', { signal: AbortSignal.timeout(10000) })).status),
      page.request.get(new URL('/reply', page.url()).href, { timeout: 5000 }).then(response => {
        assert.equal(response.status(), 410);
        assert.equal(ended, false);
        release.resolve();
      }),
    ]);
    assert.equal(retryStatus, 410);
    assert.equal(await delivered.promise, undefined);
    assert.equal(generations, 1);
  } finally {
    release.resolve();
    const closed = new Promise(resolveClose => server.close(resolveClose));
    server.closeAllConnections();
    await page.close();
    await closed;
  }
});

const realtimeSdk = process.env.CASAI_REALTIME_SDK;
const publishedContinuationBug = !realtimeSdk &&
  createRequire(resolve('package.json'))('ai/package.json').version === '7.0.183';
const nativeSession = `
  import { Experimental_AbstractRealtimeSession } from ${JSON.stringify(realtimeSdk ? resolve(realtimeSdk, 'packages/ai/dist/index.js') : 'ai')};
  class Session extends Experimental_AbstractRealtimeSession {
    setState() {}
    getSnapshot() { return this.state; }
  }
  export const createSession = settings => new Session(settings);
`;
const clientSession = `
  import { VoiceAgentClient } from 'casai/client';
  export const createSession = settings => VoiceAgentClient(settings)();
`;
for (const [owner, run, entry] of [['native SDK', test, nativeSession], ['Phase 7 client', test.skip, clientSession]]) {
  for (const action of ['finishes playback after generation', 'interrupts it', 'starts the next reply']) {
    const interrupt = action !== 'finishes playback after generation';
    run(`${owner} plays audio during a pending tool and ${action}`, async t => {
      const sent = [];
      let relay;
      const page = await openPage(t, entry, socket => {
        relay = socket;
        socket.onMessage(data => {
          const event = JSON.parse(data);
          sent.push(event);
          if (event.type === 'session-update') socket.send(JSON.stringify({ type: 'session-created', sessionId: 'local' }));
        });
      });
      try {
        await page.evaluate(async () => {
          const tool = Promise.withResolvers();
          globalThis.releaseTool = tool.resolve;
          const observed = globalThis.observed = { calls: [], starts: 0, ends: 0, errors: [] };
          const start = AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start = function (...args) {
            start.apply(this, args);
            if (this.buffer?.getChannelData(0).some(sample => sample !== 0)) observed.starts++;
            this.addEventListener('ended', () => observed.ends++, { once: true });
          };
          const model = { specificationVersion: 'v4', provider: 'fixture', modelId: 'voice',
            capabilities: { connections: ['server-websocket'] },
            serializeClientEvent: event => JSON.stringify(event), parseServerEvent: event => event };
          const session = globalThis.session = await consumer.createSession({
            model, api: { websocket: 'wss://casai.test/voice' }, sampleRate: 24000,
            onToolCall({ toolCall }) { observed.calls.push(toolCall); return tool.promise; },
            onEvent(event) {
              if (event.type === 'response-done') observed.playingAtGenerationEnd = session.getSnapshot().isPlaying;
              if (event.type === 'text-delta' && event.responseId === 'next') observed.nextReplyStarted = true;
            },
            onError(error) { observed.errors.push(error.message); },
          });
          await session.connect({ capture: false });
        });
        await page.waitForFunction(() => ['connected', 'error', 'disconnected'].includes(session.getSnapshot().status));
        assert.equal(await page.evaluate(() => session.getSnapshot().status), 'connected',
          JSON.stringify(await page.evaluate(() => observed.errors)));
        await page.evaluate(() => session.resumePlayback());
        const send = event => relay.send(JSON.stringify({ responseId: 'response', raw: {}, ...event }));
        send({ type: 'response-created' });
        send({ type: 'function-call-arguments-done', itemId: 'tool-item', callId: 'call', name: 'lookup', arguments: '{"id":7}' });
        await page.waitForFunction(() => observed.calls.length > 0);
        const pcm = Int16Array.from({ length: 24000 }, (_, i) => Math.round(5000 * Math.sin(i / 10)));
        send({ type: 'audio-delta', itemId: 'spoken', delta: Buffer.from(pcm.buffer).toString('base64') });
        send({ type: 'response-done', status: 'completed' });
        if (interrupt) send({ type: 'speech-started', itemId: 'next-turn' });
        await page.waitForFunction(() => observed.ends > 0 && !session.getSnapshot().isPlaying);
        const observed = await page.evaluate(() => globalThis.observed);
        assert.deepEqual(observed.calls, [{ toolCallId: 'call', toolName: 'lookup', args: { id: 7 } }]);
        assert.equal(observed.starts, 1);
        assert.equal(observed.playingAtGenerationEnd, true);
        assert.equal(observed.ends, 1);
        assert.deepEqual(observed.errors, []);
        const outputs = () => sent.filter(event => event.item?.type === 'function-call-output');
        assert.deepEqual(outputs(), []);
        assert.ok(!sent.some(event => event.type === 'response-create'));
        if (interrupt) await t.waitFor(() => assert.ok(sent.some(event => event.type === 'conversation-item-truncate')));
        const truncations = sent.filter(event => event.type === 'conversation-item-truncate');
        assert.deepEqual(truncations.map(event => event.itemId), interrupt ? ['spoken'] : []);
        if (interrupt) assert.ok(truncations[0].audioEndMs >= 0 && truncations[0].audioEndMs < 1000);
        if (action === 'starts the next reply') {
          send({ type: 'speech-stopped', itemId: 'next-turn' });
          send({ type: 'input-transcription-completed', itemId: 'next-turn', transcript: 'What time is it?' });
          send({ type: 'response-created', responseId: 'next' });
          send({ type: 'text-delta', responseId: 'next', itemId: 'clock', delta: 'The time is' });
          await page.waitForFunction(() => globalThis.observed.nextReplyStarted);
        }
        await page.evaluate(() => releaseTool({ found: true }));
        await t.waitFor(() => assert.equal(outputs().length, 1));
        // A later native command confirms delivery of all preceding queued events.
        await page.evaluate(() => session.sendEvent({ type: 'input-audio-clear' }));
        await t.waitFor(() => assert.ok(sent.some(event => event.type === 'input-audio-clear')));
        const continuesOldTurn = !interrupt || (owner === 'native SDK' && publishedContinuationBug);
        assert.equal(sent.filter(event => event.type === 'response-create').length, continuesOldTurn ? 1 : 0);
        assert.deepEqual(outputs().map(event => event.item), [
          { type: 'function-call-output', callId: 'call', name: 'lookup', output: '{"found":true}' },
        ]);
      } finally {
        await page.evaluate(() => { globalThis.releaseTool?.(); globalThis.session?.dispose(); });
      }
    });
  }
}
