import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';

const audioEntry = "export { Transcriber, ValidationError } from 'casai'; export { createOpenAI } from '@ai-sdk/openai';";
const requireEngine = createRequire(import.meta.resolve('cascada-engine'));
const bundles = new Map();
let browser;
before(async () => {
  browser = await requireEngine('playwright').chromium.launch({
    executablePath: process.env.CASAI_REVIEW_CHROMIUM,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
});
after(async () => { await browser?.close(); });

async function openPage(t, entry, voiceRelay) {
  if (!bundles.has(entry)) {
    const result = await build({ stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true, write: false,
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

async function transcribeRecording(t, recording, { label = '', target, changeInput, sampleWindow } = {}) {
  const reference = await readFile(new URL(recording, import.meta.url));
  const source = changeInput ? changeInput(Buffer.from(reference)) : reference;
  const page = await openPage(t, audioEntry);
  await page.route('https://casai.test/recording', route => route.fulfill({ body: source }));
  if (changeInput) await page.route('https://casai.test/reference', route => route.fulfill({ body: reference }));
  return page.evaluate(async ({ label, target, separateReference, sampleWindow }) => {
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
        const prepared = await decoder.decodeAudioData(data);
        result.frames = prepared.length;
        result.channels = prepared.numberOfChannels;
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
            for (let i = 0; i < b.length; i++) maxDifference = Math.max(maxDifference, Math.abs(a[i] - b[i]));
          }
          result.maxDifference = maxDifference;
        }
      }
      files.push(result);
    }
    return { text, validationError, nativeError, files };
  }, { label, target, separateReference: !!changeInput, sampleWindow });
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

for (const [recording, frames, mayReject] of [
  ['review-chrome-opus.webm', 46080, false],
  ['review-chrome-opus-trimmed.webm', 45840, true],
]) {
  test.skip(`6C copies ${frames} Chrome frames to WebM${mayReject ? ' or rejects the edit before dispatch' : ''}`, async t => {
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

test.skip('6C preserves the recorded AAC gap and endpoint after Chrome MediaRecorder resumes', async t => {
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

test.skip('6C keeps every playable Opus packet on a backward clock or rejects before file dispatch', async t => {
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

test.skip('6C rejects Safari AAC for a copy-only Opus target before file dispatch', async t => {
  const { validationError, files } = await transcribeRecording(t, 'review-safari-aac.mp4', {
    label: 'audio/webm', target: { format: 'webm', codec: 'libopus' },
  });
  assert.ok(validationError);
  assert.deepEqual(files, []);
});

test.skip('6C leaves a split recording reusable after a worker startup failure', async t => {
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

test.skip('6C sends a WAV ending at the final recorded Firefox Opus sample', async t => {
  const { text, files } = await transcribeRecording(t, 'review-firefox-opus.ogg', {
    target: { format: 'wav', codec: 'pcm_s16le' },
  });
  assert.equal(text, 'received');
  assert.equal(files.length, 1);
  const [file] = files;
  assert.equal(file.name, 'audio.wav');
  assert.equal(file.type, 'audio/wav');
  assert.equal(file.frames, 64384);
  assert.ok(file.maxDifference <= 2 / 32768, `peak PCM difference ${file.maxDifference}`);
});

// The same relay and browser audio assertions run against the installed native session today.
const nativeSession = `
  import { Experimental_AbstractRealtimeSession } from 'ai';
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
  for (const interrupt of [false, true]) {
    run(`${owner} plays audio during a pending tool and ${interrupt ? 'interrupts it' : 'finishes playback after generation'}`, async t => {
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
        if (interrupt) await t.waitFor(() => sent.some(event => event.type === 'conversation-item-truncate'));
        const truncations = sent.filter(event => event.type === 'conversation-item-truncate');
        assert.deepEqual(truncations.map(event => event.itemId), interrupt ? ['spoken'] : []);
        if (interrupt) assert.ok(truncations[0].audioEndMs >= 0 && truncations[0].audioEndMs < 1000);
        await page.evaluate(() => releaseTool({ found: true }));
        await t.waitFor(() => sent.some(event => event.type === 'response-create'));
        assert.deepEqual(outputs().map(event => event.item), [
          { type: 'function-call-output', callId: 'call', name: 'lookup', output: '{"found":true}' },
        ]);
      } finally {
        await page.evaluate(() => { globalThis.releaseTool?.(); globalThis.session?.dispose(); });
      }
    });
  }
}
