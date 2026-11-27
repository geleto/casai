// Run against a built AI SDK checkout. Every network request terminates on loopback.
import assert from 'node:assert/strict';
import { openAsBlob } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { createSecureServer } from 'node:http2';
import { once } from 'node:events';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { createRequire, registerHooks } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, test } from 'node:test';

const root = resolve(process.env.CASAI_TRANSCRIPTION_SDK ?? '../ai-sdk-transcription');
const packages = new Map(['ai', 'provider', 'provider-utils', 'openai', 'groq', 'deepgram'].map(name =>
  [name === 'ai' ? name : '@ai-sdk/' + name, pathToFileURL(join(root, 'packages', name, 'dist/index.js')).href]));
registerHooks({ resolve(specifier, context, next) { return next(packages.get(specifier) ?? specifier, context); } });
const { Script, Transcriber } = await import('casai');
const { transcriptionFile } = await import('ai');
const { createOpenAI } = await import('@ai-sdk/openai');
const { createGroq } = await import('@ai-sdk/groq');
const { createDeepgram } = await import('@ai-sdk/deepgram');
const sdkRequire = createRequire(join(root, 'package.json'));
const { wsServer: WebSocketServer } = createRequire(sdkRequire.resolve('playwright'))('playwright-core/lib/utilsBundle');
const mp4 = await readFile(new URL('review-ios-safari-aac.mp4', import.meta.url));
const webm = await readFile(new URL('review-chrome-opus.webm', import.meta.url));
const ogg = await readFile(new URL('review-firefox-opus.ogg', import.meta.url));
const apiKey = 'local-test';
const timeout = 12000;
async function within(promise, stage) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out waiting for ' + stage)), 6500); })]); }
  finally { clearTimeout(timer); }
}

let receive;
const server = createServer((req, res) => { receive(req, res).catch(error => res.destroy(error)); });
const wss = new WebSocketServer({ server });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseURL = 'http://127.0.0.1:' + server.address().port + '/v1';
after(async () => { for (const c of wss.clients) c.terminate(); wss.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

const sendEvent = (res, value) => res.write('data: ' + JSON.stringify(value) + '\n\n');
async function readForm(req, onPrefix) {
  const chunks = [];
  for await (const chunk of req) { chunks.push(chunk); onPrefix?.(Buffer.concat(chunks)); }
  return new Response(Buffer.concat(chunks), { headers: { 'content-type': req.headers['content-type'] } }).formData();
}
function fileFields(form, bytes, name, mediaType) {
  const file = form.get('file');
  assert.equal(file.name, name);
  assert.equal(file.type, mediaType);
  return file.arrayBuffer().then(data => assert.deepEqual(Buffer.from(data), bytes));
}

test('a File survives retry with independently verified MIME, original bytes and original name', { timeout }, async () => {
  const forms = [];
  receive = async (req, res) => {
    forms.push(await readForm(req));
    res.writeHead(forms.length === 1 ? 503 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(forms.length === 1 ? { error: { message: 'temporary' } } : { text: 'complete' }));
  };
  const recording = new File([mp4], 'council.archive', { type: 'audio/wav' });
  recording.arrayBuffer = () => { throw new Error('source File was completely materialized'); };
  const result = await Transcriber({ model: createOpenAI({ apiKey, baseURL }).transcription('gpt-4o-transcribe'), maxRetries: 1,
    sourceFormat: { encoding: 'pcm_s16le', channels: 1, sampleRate: 16000 } })(recording);
  assert.equal(result.text, 'complete');
  assert.equal(forms.length, 2);
  for (const form of forms) await fileFields(form, mp4, 'council.archive', 'audio/mp4');
});

test('registered model IDs keep native File uploads and still work with byte-only adapters', { timeout }, async () => {
  const previous = globalThis.AI_SDK_DEFAULT_PROVIDER;
  const requested = [], forms = [];
  const native = createOpenAI({ apiKey, baseURL }).transcription('gpt-4o-transcribe');
  const byteOnly = { specificationVersion: 'v4', provider: 'fixture', modelId: 'bytes',
    doGenerate: options => native.doGenerate(options) };
  receive = async (req, res) => {
    forms.push(await readForm(req));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text: 'complete' }));
  };
  globalThis.AI_SDK_DEFAULT_PROVIDER = { specificationVersion: 'v4', transcriptionModel(id) {
    requested.push(id);
    return id.endsWith('/native') ? native : byteOnly;
  } };
  try {
    const file = new File([mp4], 'field.capture', { type: 'audio/mp4' });
    file.arrayBuffer = () => assert.fail('materializing a registered native model upload');
    assert.equal((await Transcriber({ model: 'test/native' })(file)).text, 'complete');
    await fileFields(forms[0], mp4, 'field.capture', 'audio/mp4');
    assert.equal((await Transcriber({ model: 'test/bytes' })(new Blob([mp4]))).text, 'complete');
    await fileFields(forms[1], mp4, 'audio.m4a', 'audio/mp4');
    assert.deepEqual(requested, ['test/native', 'test/bytes']);
  } finally {
    if (previous === undefined) delete globalThis.AI_SDK_DEFAULT_PROVIDER;
    else globalThis.AI_SDK_DEFAULT_PROVIDER = previous;
  }
});

test('the same reusable PCM layout still wraps genuine headerless input as a WAV', { timeout }, async () => {
  let form;
  receive = async (req, res) => { form = await readForm(req); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text: 'wrapped' })); };
  const model = createOpenAI({ apiKey, baseURL }).transcription('gpt-4o-transcribe');
  const audio = new Blob([new Uint8Array([0, 0, 1, 1])], { type: 'audio/pcm' });
  const result = await Transcriber({ model, sourceFormat: { encoding: 'pcm_s16le', channels: 1, sampleRate: 16000 } })(audio);
  assert.equal(result.text, 'wrapped');
  const file = form.get('file');
  assert.equal(file.type, 'audio/wav');
  const body = Buffer.from(await file.arrayBuffer());
  assert.equal(body.subarray(0, 4).toString(), 'RIFF');
  assert.deepEqual([...body.subarray(-4)], [0, 0, 1, 1]);
});

test('an unlabelled File with a long ID3 tag reaches the provider intact', { timeout }, async () => {
  const tagged = await readFile(new URL('review-mp3-44100.mp3', import.meta.url));
  const audioStart = 10 + tagged.subarray(6, 10).reduce((size, byte) => size * 128 + byte, 0);
  const tag = Buffer.alloc(64 * 1024 + 10);
  tagged.copy(tag, 0, 0, audioStart);
  tag.set([0, 4, 0, 0], 6);
  const bytes = Buffer.concat([tag, tagged.subarray(audioStart)]);
  const recording = new File([bytes], 'studio.take');
  recording.arrayBuffer = () => assert.fail('reading the entire recording');
  let form;
  receive = async (req, res) => { form = await readForm(req); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text: 'tagged' })); };
  const result = await Transcriber({ model: createOpenAI({ apiKey, baseURL }).transcription('gpt-4o-transcribe') })(recording);
  assert.equal(result.text, 'tagged');
  await fileFields(form, bytes, 'studio.take', 'audio/mpeg');
});

test('a 64 MiB disk-backed Blob is inspected with one bounded prefix and uploaded without materializing the source', { timeout }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'casai-stt-'));
  try {
    const path = join(dir, 'upload.m4a'), size = 64 * 1024 * 1024;
    const handle = await open(path, 'w');
    try { await handle.write(mp4); await handle.truncate(size); } finally { await handle.close(); }
    const blob = await openAsBlob(path, { type: 'audio/mp4' });
    const slice = blob.slice.bind(blob), slices = [];
    blob.slice = (start, end, type) => { slices.push([start, end]); return slice(start, end, type); };
    blob.arrayBuffer = () => { throw new Error('materialized disk-backed audio'); };
    let total = 0;
    receive = async (req, res) => {
      for await (const chunk of req) total += chunk.byteLength;
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text: 'uploaded' }));
    };
    const model = createOpenAI({ apiKey, baseURL }).transcription('gpt-4o-transcribe');
    assert.equal((await Transcriber({ model })(blob)).text, 'uploaded');
    assert.deepEqual(slices, [[0, 4096]]);
    assert.ok(total > size && total < size + 1024);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Groq reads a one-shot prefix before EOF and receives exact multipart metadata', { timeout }, async () => {
  const first = Promise.withResolvers();
  let producer;
  const audio = transcriptionFile(new ReadableStream({ start(c) { producer = c; } }), { filename: 'audio.capture', mediaType: 'audio/mp4' });
  let form;
  receive = async (req, res) => {
    form = await readForm(req, bytes => { if (bytes.includes(mp4.subarray(0, 128))) first.resolve(); });
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text: 'one upload', x_groq: { id: 'local' } }));
  };
  const component = Transcriber({ model: createGroq({ apiKey, baseURL }).transcription('whisper-large-v3') });
  const result = component.run({ audio });
  producer.enqueue(mp4.subarray(0, 128));
  await first.promise;
  await assert.rejects(component.run({ audio }), /handed off|locked/);
  producer.enqueue(mp4.subarray(128)); producer.close();
  assert.equal((await result).text, 'one upload');
  await fileFields(form, mp4, 'audio.capture', 'audio/mp4');
});

test('file, file SSE and live transcription share one claim on the original recording stream', { timeout }, async () => {
  const original = await readFile(new URL('review-android-chrome-open-cluster.webm', import.meta.url));
  const model = createOpenAI({ apiKey, baseURL }).transcription('gpt-4o-mini-transcribe');
  const file = Transcriber({ model }), sse = Transcriber.asStream({ model });
  let uploads = 0, liveCalls = 0;
  receive = async (req, res) => {
    const form = await readForm(req);
    await fileFields(form, original, 'capture.webm', 'audio/webm');
    uploads++;
    if (form.get('stream') === 'true') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      sendEvent(res, { type: 'transcript.text.done', text: 'uploaded' }); res.end();
    } else {
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text: 'uploaded' }));
    }
  };
  const live = Transcriber({ inputAudioFormat: { type: 'audio/webm' }, model: {
    specificationVersion: 'v4', provider: 'fixture', modelId: 'live', async doStream({ audio }) {
      liveCalls++;
      assert.deepEqual(Buffer.concat(await Array.fromAsync(audio)), original);
      return { stream: ReadableStream.from([{ type: 'finish', text: 'heard', segments: [] }]) };
    },
  } });
  for (const component of [file, sse]) {
    const recording = () => transcriptionFile(ReadableStream.from([original]), { mediaType: 'audio/webm', filename: 'capture.webm' });
    const first = recording();
    if (component === file) await assert.rejects(component.run({ audio: first, maxRetries: 1 }), /retr/i);
    await assert.rejects(component({ ...first, mediaType: '' }), /MIME/i);
    assert.equal(first.data.locked, false);
    assert.equal(await (await component(first)).text, 'uploaded');
    await assert.rejects(live(first.data), /handed off/);
    const second = recording();
    assert.equal((await live(second.data)).text, 'heard');
    await assert.rejects(component(second), /handed off/);
  }
  assert.deepEqual([uploads, liveCalls], [2, 2]);
});

test('OpenAI file SSE exposes its first delta before the response finishes', { timeout }, async () => {
  const finish = Promise.withResolvers();
  let form;
  receive = async (req, res) => {
    form = await readForm(req);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: ' + JSON.stringify({ type: 'transcript.text.delta', delta: 'provisional' }) + '\r\n\r\n');
    await finish.promise;
    res.end('data: ' + JSON.stringify({ type: 'transcript.text.done', text: 'authoritative', languages: [{ code: 'en' }] }) + '\r\r');
  };
  const result = await Transcriber.asStream({ model: createOpenAI({ apiKey, baseURL }).transcription('gpt-4o-mini-transcribe') })
    .run({ audio: transcriptionFile(mp4, { mediaType: 'audio/mp4', filename: 'hearing.m4a' }) });
  const reader = result.fullStream.getReader();
  try {
    assert.equal((await reader.read()).value.delta, 'provisional');
    assert.equal(form.get('stream'), 'true');
    await fileFields(form, mp4, 'hearing.m4a', 'audio/mp4');
  } finally { finish.resolve(); }
  assert.equal((await reader.read()).done, true);
  assert.equal(await result.text, 'authoritative');
  assert.equal(await result.language, 'en');
});

test('OpenAI sends file deltas for a byte view and an ArrayBuffer without a wrapper or a live format', { timeout }, async () => {
  const run = Transcriber.asStream({ model: createOpenAI({ apiKey, baseURL }).transcription('gpt-4o-transcribe') });
  const storage = Buffer.concat([Buffer.from('prefix'), mp4, Buffer.from('tail')]);
  for (const data of [storage.subarray(6, -4), Uint8Array.from(mp4).buffer]) {
    const release = Promise.withResolvers();
    let form;
    receive = async (req, res) => {
      form = await readForm(req);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      sendEvent(res, { type: 'transcript.text.delta', delta: 'early' });
      await release.promise;
      sendEvent(res, { type: 'transcript.text.done', text: 'complete' });
      res.end();
    };
    const result = await (data instanceof ArrayBuffer ? run.run({ audio: data }) : run(data));
    const reader = result.fullStream.getReader();
    try {
      assert.equal((await within(reader.read(), 'file prefix')).value.delta, 'early');
      const file = form.get('file');
      assert.equal(file.type, 'audio/mp4');
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), mp4);
    } finally { release.resolve(); }
    assert.equal((await reader.read()).done, true);
    assert.equal(await result.text, 'complete');
  }
});

test('file SSE cancels a held upload and rejects final text', { timeout }, async () => {
  let producer;
  const first = Promise.withResolvers(), cancelled = Promise.withResolvers();
  receive = async (req, res) => { await readForm(req, b => { if (b.includes(mp4.subarray(0, 100))) first.resolve(); }); res.end(); };
  const data = new ReadableStream({ start(c) { producer = c; }, cancel(reason) { cancelled.resolve(reason); } });
  const result = await Transcriber.asStream({ model: createOpenAI({ apiKey, baseURL }).transcription('gpt-4o-transcribe') })
    (transcriptionFile(data, { mediaType: 'audio/mp4' }));
  const reader = result.fullStream.getReader();
  const failure = assert.rejects(result.text, /stop/);
  producer.enqueue(mp4.subarray(0, 100));
  await first.promise;
  const reason = new Error('stop');
  await reader.cancel(reason);
  await failure;
  assert.equal(await cancelled.promise, reason);
});

for (const [modelId, type, bytes] of [['nova-3', 'audio/webm;codecs=opus', webm], ['flux-general-en', 'audio/ogg;codecs=opus', ogg]]) {
  test(modelId + ' publishes revisions while a genuine recorder stream is open', { timeout }, async () => {
    const flux = modelId.startsWith('flux');
    let producer;
    const received = [];
    const protocols = [];
    class LocalSocket extends WebSocket {
      constructor(url, auth) {
        const local = new URL(url);
        assert.equal(local.hostname, 'api.deepgram.com');
        assert.equal(local.pathname, flux ? '/v2/listen' : '/v1/listen');
        assert.equal(local.searchParams.has('encoding') || local.searchParams.has('sample_rate'), false);
        protocols.push(auth);
        super('ws://' + server.address().address + ':' + server.address().port + local.pathname + local.search, auth);
      }
    }
    wss.once('connection', ws => {
      const report = (text, final) => ws.send(JSON.stringify(flux
        ? { type: 'TurnInfo', event: 'Update', turn_index: 0, audio_window_start: 0, audio_window_end: 1, transcript: text }
        : { type: 'Results', is_final: final, start: 0, duration: 1, channel: { alternatives: [{ transcript: text }] } }));
      ws.on('message', (message, binary) => {
        if (binary) { received.push(message); if (received.length === 1) report('draft', false); }
        else {
          assert.equal(JSON.parse(message).type, 'CloseStream');
          report('whole turn', true);
          if (!flux) ws.send(JSON.stringify({ type: 'Metadata', duration: 1 }));
          ws.close();
        }
      });
    });
    const model = createDeepgram({ apiKey, webSocket: LocalSocket }).transcription(modelId);
    const data = new ReadableStream({ start(c) { producer = c; } });
    const listen = Transcriber.asStream({ model, inputAudioFormat: { type }, ...(flux ? {} : { providerOptions: { deepgram: { streaming: { interimResults: true } } } }) });
    const result = flux ? await listen(data) : await Script({ script: 'return listen(data)', context: { listen, data } })();
    const reader = result.fullStream.getReader();
    producer.enqueue(bytes.subarray(0, 137));
    assert.equal((await reader.read()).value.text, 'draft');
    assert.deepEqual(Buffer.concat(received), bytes.subarray(0, 137));
    producer.enqueue(bytes.subarray(137)); producer.close();
    let final;
    for (let item = await reader.read(); !item.done; item = await reader.read()) if (item.value.type === 'transcript-final') final = item.value.text;
    assert.equal(final, 'whole turn');
    assert.equal(await result.text, 'whole turn');
    assert.deepEqual(Buffer.concat(received), bytes);
    assert.deepEqual(protocols, [['token', apiKey]]);
  });
}

test('a prepared target streams the transcript of the selected WAV', { timeout }, async () => {
  let form;
  receive = async (req, res) => {
    form = await readForm(req);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    sendEvent(res, { type: 'transcript.text.done', text: 'prepared' }); res.end();
  };
  const model = createOpenAI({ apiKey, baseURL }).transcription('gpt-4o-transcribe');
  const result = await Transcriber.loadsAudio.asStream({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } })(mp4);
  assert.equal(await result.text, 'prepared');
  const file = form.get('file');
  assert.equal(file.type, 'audio/wav');
  assert.equal(Buffer.from(await file.arrayBuffer()).subarray(0, 4).toString(), 'RIFF');
  assert.equal(form.get('stream'), 'true');
});

test('browser file deltas and cancellation before provider response headers', { skip: !process.env.CASAI_TRANSCRIPTION_BROWSER, timeout: 45000 }, async t => {
  const { build } = await import('esbuild');
  const { chromium, firefox } = sdkRequire('playwright');
  const browser = await (process.env.CASAI_TRANSCRIPTION_BROWSER === 'firefox' ? firefox.launch() :
    chromium.launch({ channel: process.env.CASAI_TRANSCRIPTION_BROWSER, executablePath: process.env.CASAI_REVIEW_CHROMIUM, args: ['--autoplay-policy=no-user-gesture-required'] }));
  t.diagnostic(process.env.CASAI_TRANSCRIPTION_BROWSER + ' ' + browser.version());
  const release = Promise.withResolvers(), pending = Promise.withResolvers();
  try {
    const bundle = await build({
      stdin: { contents: "export {Transcriber} from 'casai'; export {createOpenAI} from '@ai-sdk/openai'; export {createDeepgram} from '@ai-sdk/deepgram'; export {createGroq} from '@ai-sdk/groq'; export {finishedRecording,liveRecording} from './docs/examples/recorder-audio.mjs';", resolveDir: process.cwd() },
      platform: 'browser', target: 'es2022', format: 'iife', globalName: 'client', bundle: true, write: false,
      conditions: ['casai-source', 'browser'], plugins: [{ name: 'candidate-sdk', setup(build) {
        build.onResolve({ filter: /^(ai|@ai-sdk\/(provider|provider-utils|openai|deepgram|groq))$/ }, ({ path }) => ({ path: fileURLToPath(packages.get(path)) }));
      } }],
    });
    let requests = 0;
    receive = async (req, res) => {
      if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<title>Recorder test</title>'); return; }
      const form = await readForm(req);
      await fileFields(form, mp4, 'browser.capture', 'audio/mp4');
      if (++requests === 2) { pending.resolve(); return; }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      sendEvent(res, { type: 'transcript.text.delta', delta: 'early' });
      await release.promise;
      sendEvent(res, { type: 'transcript.text.done', text: 'finished' }); res.end();
    };
    const page = await browser.newPage();
    await page.goto(baseURL);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    assert.equal(await within(page.evaluate(async ({ bytes, baseURL }) => {
      const model = client.createOpenAI({ apiKey: 'local', baseURL }).transcription('gpt-4o-transcribe');
      const file = new File([new Uint8Array(bytes)], 'browser.capture', { type: 'audio/wav' });
      file.arrayBuffer = () => { throw new Error('collected whole source'); };
      const run = client.Transcriber.asStream({ model });
      globalThis.nextRecording = () => run(file);
      globalThis.recording = await nextRecording();
      globalThis.reader = recording.fullStream.getReader();
      return (await reader.read()).value.delta;
    }, { bytes: [...mp4], baseURL }), 'browser first delta'), 'early');
    release.resolve();
    assert.equal(await within(page.evaluate(async () => { await reader.read(); return recording.text; }), 'browser final text'), 'finished');
    await page.evaluate(async () => {
      globalThis.pendingResult = await nextRecording();
      globalThis.pendingReader = pendingResult.fullStream.getReader();
      globalThis.pendingError = pendingResult.text.then(() => 'unexpected success', error => error.message);
    });
    await within(pending.promise, 'second browser upload');
    assert.equal(await within(page.evaluate(async () => {
      await pendingReader.cancel(new Error('browser stopped'));
      return pendingError;
    }), 'browser cancellation'), 'browser stopped');

    const useFlux = process.env.CASAI_TRANSCRIPTION_BROWSER === 'firefox';
    const received = [];
    wss.once('connection', ws => {
      const sendTurn = (text, final) => ws.send(JSON.stringify(useFlux ?
        { type: 'TurnInfo', event: 'Update', turn_index: 0, audio_window_start: 0, audio_window_end: 1, transcript: text } :
        { type: 'Results', start: 0, duration: 1, is_final: final, channel: { alternatives: [{ transcript: text }] } }));
      ws.on('message', (bytes, binary) => {
        if (binary) { received.push(bytes); if (received.length === 1) sendTurn('recording', false); }
        else {
          assert.equal(JSON.parse(bytes).type, 'CloseStream');
          sendTurn('stopped', true);
          if (!useFlux) ws.send(JSON.stringify({ type: 'Metadata', duration: 1 }));
          ws.close();
        }
      });
    });
    let completedUpload;
    receive = async (req, res) => {
      completedUpload = (await readForm(req)).get('file');
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text: 'whole recording' }));
    };
    await page.mouse.click(1, 1);
    const live = await within(page.evaluate(async ({ useFlux, baseURL }) => {
      const context = new AudioContext(), output = context.createMediaStreamDestination(), tone = context.createOscillator();
      tone.connect(output); tone.start();
      const chunks = [], recorder = new MediaRecorder(output.stream, { mimeType: useFlux ? 'audio/ogg;codecs=opus' : 'audio/webm;codecs=opus' });
      recorder.addEventListener('dataavailable', ({ data }) => { if (data.size) chunks.push(data.size); });
      const saved = client.finishedRecording(recorder);
      const audio = client.liveRecording(recorder);
      class LocalWebSocket extends WebSocket {
        constructor(url, auth) {
          const local = new URL(url); super('ws://' + location.host + local.pathname + local.search, auth);
        }
      }
      const model = client.createDeepgram({ apiKey: 'test', webSocket: LocalWebSocket }).transcription(useFlux ? 'flux-general-en' : 'nova-3');
      const result = await client.Transcriber.asStream({ model, inputAudioFormat: { type: recorder.mimeType }, ...(useFlux ? {} :
        { providerOptions: { deepgram: { streaming: { interimResults: true } } } }) })(audio);
      const reader = result.fullStream.getReader();
      try {
        await context.resume(); recorder.start(150);
        const first = (await reader.read()).value, state = recorder.state;
        recorder.stop();
        while (!(await reader.read()).done) { /* consume the same live result */ }
        const recording = await saved;
        const fileModel = client.createOpenAI({ apiKey: 'local', baseURL }).transcription('gpt-4o-transcribe');
        const completed = await client.Transcriber({ model: fileModel })(recording);
        return { first: first.text, state, text: await result.text, chunks, completed: completed.text,
          original: [...new Uint8Array(await recording.arrayBuffer())] };
      } finally {
        if (recorder.state !== 'inactive') recorder.stop();
        tone.stop(); output.stream.getTracks().forEach(track => track.stop()); await context.close();
      }
    }, { useFlux, baseURL }), 'live browser recorder');
    assert.deepEqual([live.first, live.state, live.text], ['recording', 'recording', 'stopped']);
    assert.deepEqual(received.map(bytes => bytes.length), live.chunks);
    assert.deepEqual(Buffer.concat(received), Buffer.from(live.original));
    assert.equal(live.completed, 'whole recording');
    assert.deepEqual(Buffer.from(await completedUpload.arrayBuffer()), Buffer.from(live.original));
    assert.equal(Buffer.concat(received).subarray(0, 4).toString('hex'), useFlux ? '4f676753' : '1a45dfa3');
    await t.test('one-shot multipart over browser HTTPS/2', { skip: !process.env.CASAI_TRANSCRIPTION_TLS_CERT },
      () => browserUpload(browser, bundle.outputFiles[0].text));
  } finally { release.resolve(); await browser.close(); }
});

async function browserUpload(browser, bundle) {
  const key = await readFile(process.env.CASAI_TRANSCRIPTION_TLS_KEY), cert = await readFile(process.env.CASAI_TRANSCRIPTION_TLS_CERT);
  const server = createSecureServer({ key, cert }), sessions = new Set();
  const prefix = Promise.withResolvers();
  let posts = 0, form;
  server.on('session', session => { sessions.add(session); session.on('close', () => sessions.delete(session)); });
  server.on('request', (req, res) => {
    if (req.method === 'GET') { res.end('<title>Local recording upload</title>'); return; }
    posts++;
    readForm(req, bytes => { if (bytes.includes(mp4.subarray(0, 128))) prefix.resolve(); }).then(value => {
      form = value;
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text: 'uploaded', x_groq: { id: 'local' } }));
    }, () => { res.writeHead(400); res.end(); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const baseURL = 'https://127.0.0.1:' + server.address().port;
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  try {
    await page.goto(baseURL); await page.addScriptTag({ content: bundle });
    const capable = await page.evaluate(({ baseURL, first }) => {
      const audio = new ReadableStream({ start(c) { globalThis.producer = c; }, cancel() { globalThis.sourceCancelled = true; } });
      const model = client.createGroq({ apiKey: 'local', baseURL }).transcription('whisper-large-v3');
      producer.enqueue(new Uint8Array(first));
      globalThis.uploaded = client.Transcriber({ model })({ type: 'file', data: audio, filename: 'browser.take', mediaType: 'audio/mp4' })
        .then(result => result.text, error => error.message);
      try {
        return !new Request(baseURL, { method: 'POST', body: new ReadableStream(), duplex: 'half' }).headers.has('content-type');
      } catch { return false; }
    }, { baseURL, first: [...mp4.subarray(0, 128)] });
    if (capable) {
      await within(prefix.promise, 'browser upload prefix before EOF');
      await page.evaluate(tail => { producer.enqueue(new Uint8Array(tail)); producer.close(); }, [...mp4.subarray(128)]);
      assert.equal(await within(page.evaluate(() => uploaded), 'browser upload completion'), 'uploaded');
      assert.equal(posts, 1);
      await fileFields(form, mp4, 'browser.take', 'audio/mp4');
    } else {
      assert.match(await within(page.evaluate(() => uploaded), 'unsupported browser upload'), /cannot stream HTTP request bodies/);
      assert.equal(posts, 0);
      assert.equal(await page.evaluate(() => sourceCancelled), true);
    }
  } finally {
    await page.close();
    for (const session of sessions) session.destroy();
    await new Promise(resolve => server.close(resolve));
  }
}
