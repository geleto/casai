import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Resolver } from 'node:dns/promises';
import { mock } from 'node:test';
import { createElevenLabs } from '@ai-sdk/elevenlabs';
import { createOpenAI } from '@ai-sdk/openai';
import { experimental_generateVideo as generateVideo, experimental_getVideoStatus as getVideoStatus,
  experimental_startVideo as startVideo, uploadFile } from 'ai';
import { Experimental_MockSpeechTranslationModelV4, MockTranscriptionModelV4 } from 'ai/test';
import { Config, ConfigError, Function as CasaiFunction, LLMAgent, Script, Transcriber, Translator, ValidationError, z } from 'casai';

import { withAudioInput } from '../src/audio/input.ts';
import { sourceMode, streamMode } from '../src/config/modifiers.ts';

describe('Casai recording selection at the SDK boundary', () => {
  const sdk = { transcriptionFile: (data, { mediaType, filename }) => ({ type: 'file', data, mediaType, ...(filename === undefined ? {} : { filename }) }) };
  const model = { doGenerateFromFile() {}, doStreamFromFile() {} };
  const sourceFormat = { encoding: 'pcm_s16le', channels: 1, sampleRate: 16000 };
  const handoff = (audio, settings = {}, signal) => withAudioInput({
    settings: { model, audio, ...settings }, supplied: { audio }, context: { _toolOptions: { abortSignal: signal } },
  }, async request => request.audio, sdk);

  it('preserves a registered native File and keeps byte delivery for byte-only and legacy providers', async () => {
    const bytes = await readFile(new URL('fixtures/review-ios-safari-aac.mp4', import.meta.url));
    const file = new File([bytes], 'session.m4a', { type: 'audio/mp4' });
    const provider = globalThis.AI_SDK_DEFAULT_PROVIDER;
    const lookups = [];
    try {
      globalThis.AI_SDK_DEFAULT_PROVIDER = { specificationVersion: 'v4', transcriptionModel(id) {
        lookups.push(id);
        return id === 'fixture/native' ? model : {};
      } };
      assert.equal((await handoff(file, { model: 'fixture/native' })).data, file);
      assert.deepEqual(Buffer.from(await handoff(file, { model: 'fixture/bytes' })), bytes);
      assert.deepEqual(lookups, ['fixture/native', 'fixture/bytes']);
      globalThis.AI_SDK_DEFAULT_PROVIDER = { specificationVersion: 'v3', transcriptionModel() {
        assert.fail('the native SDK owns legacy model resolution');
      } };
      assert.deepEqual(Buffer.from(await handoff(file, { model: 'fixture/legacy' })), bytes);
    } finally {
      if (provider === undefined) delete globalThis.AI_SDK_DEFAULT_PROVIDER;
      else globalThis.AI_SDK_DEFAULT_PROVIDER = provider;
    }
  });

  it('shares accepted file readers with live calls and leaves rejected file inputs available', async () => {
    const data = ReadableStream.from([Uint8Array.of(7)]);
    const audio = { type: 'file', data, mediaType: 'audio/example' };
    const prepared = { settings: { audio, model }, supplied: { audio }, context: { _toolOptions: {} } };
    await assert.rejects(withAudioInput(prepared, async () => { throw Error('invalid request'); }, sdk), /invalid request/);
    const reader = await withAudioInput(prepared, async request => request.audio.data.getReader(), sdk);
    await assert.rejects(handoff(data, { inputAudioFormat: { type: 'audio/example' } }), /handed off/);
    assert.deepEqual((await reader.read()).value, Uint8Array.of(7));
    reader.releaseLock();
    await assert.rejects(handoff(audio), /handed off/);
  });

  it('retains an encoded File with a reusable PCM layout and wraps genuine raw input using that layout', async () => {
    const bytes = await readFile(new URL('fixtures/review-ios-safari-aac.mp4', import.meta.url));
    const recording = new File([bytes], 'field-session.original', { type: 'audio/wav' });
    recording.arrayBuffer = () => assert.fail('fully reading an encoded File');
    const reads = mock.method(recording, 'slice');
    const delivered = await handoff(recording, { sourceFormat });
    assert.equal(delivered.data, recording);
    assert.equal(delivered.data.name, 'field-session.original');
    assert.equal(delivered.mediaType, 'audio/mp4');
    assert.deepEqual(reads.mock.calls.map(call => call.arguments), [[0, 4096]]);
    const raw = Uint8Array.of(0, 0, 255, 127);
    for (const type of ['audio/pcm', 'application/octet-stream']) {
      const wav = await handoff(new Blob([raw], { type }), { sourceFormat });
      assert.equal(wav.mediaType, 'audio/wav');
      assert.equal(Buffer.from(wav.data.subarray(0, 4)).toString(), 'RIFF');
      assert.deepEqual(wav.data.subarray(44), raw);
    }
  });

  it('uses container evidence, MIME parameters and explicit descriptions without consuming the producer', async () => {
    const id3 = Uint8Array.of(73, 68, 51, 4, 0, 0, 0, 0, 0, 0);
    assert.equal((await handoff(new Blob([id3], { type: 'audio/aac' }))).mediaType, 'audio/aac');
    await assert.rejects(handoff(new Blob([id3])), /encoded recording MIME/);
    const tagged = await readFile(new URL('fixtures/review-mp3-44100.mp3', import.meta.url));
    assert.equal((await handoff(new Blob([tagged]))).mediaType, 'audio/mpeg');
    const ogg = await readFile(new URL('fixtures/review-firefox-opus.ogg', import.meta.url));
    const blob = new Blob([ogg], { type: 'audio/ogg;codecs=opus' });
    const streamed = await handoff(blob, { [streamMode]: true });
    assert.equal(streamed.mediaType, blob.type);
    assert.equal(streamed.data, blob);
    const data = new ReadableStream({ pull() { assert.fail('premature read'); } }, { highWaterMark: 0 });
    const audio = { type: 'file', data, filename: 'show.007', mediaType: 'audio/aac' };
    assert.deepEqual(await handoff(audio, { model: 'example/transcription', [streamMode]: true }), audio);
    await assert.rejects(handoff(audio, { [sourceMode]: 'audio-resource' }), /supplies its own encoded input/);
    assert.equal(data.locked, false);
    await data.cancel();
  });

  it('locates a frame across the inspection boundary and after a large ID3 tag without reading the tag body', async () => {
    const tagged = await readFile(new URL('fixtures/review-mp3-44100.mp3', import.meta.url));
    const frame = 10 + tagged.subarray(6, 10).reduce((size, byte) => size * 128 + byte, 0);
    for (const offset of [4095, 70000]) {
      const tag = Buffer.alloc(offset);
      tagged.copy(tag, 0, 0, frame);
      for (let i = 9, size = tag.length - 10; i >= 6; i--, size >>>= 7) tag[i] = size & 127;
      const blob = new Blob([tag, tagged.subarray(frame)]);
      blob.arrayBuffer = () => assert.fail('reading the entire recording');
      const reads = mock.method(blob, 'slice');
      const file = await handoff(blob, { [streamMode]: true });
      assert.equal(file.data, blob);
      assert.equal(file.mediaType, 'audio/mpeg');
      assert.deepEqual(reads.mock.calls.map(call => call.arguments), [[0, 4096], [offset, offset + 16]]);
      await assert.rejects(handoff(new Blob([tag])), /encoded recording MIME/);
    }
  });

  it('keeps explicit MIME on unnamed bytes and requires adapter support for filenames or transcript deltas', async () => {
    const byteOnly = { doGenerate() {} };
    const data = Uint8Array.of(42);
    const audio = { type: 'file', data, mediaType: 'audio/example' };
    assert.deepEqual(await handoff(audio, { model: byteOnly }), audio);
    await assert.rejects(handoff({ ...audio, filename: 'take.one' }, { model: byteOnly }), /native recording upload/);
    await assert.rejects(handoff(audio, { model: byteOnly, [streamMode]: true }), /native recording upload/);
    const mp4 = await readFile(new URL('fixtures/review-ios-safari-aac.mp4', import.meta.url));
    const file = await handoff(mp4, { model: 'example/transcription' });
    assert.equal(file.mediaType, 'audio/mp4');
    assert.deepEqual(Buffer.from(file.data), mp4);
    const fallback = await handoff(new Blob([mp4]), { model: byteOnly });
    assert.deepEqual(Buffer.from(fallback), mp4);
  });

  it('selects file transcript events for recognizable finite bytes and requires a format for live or unidentified input', async () => {
    const bytes = await readFile(new URL('fixtures/review-ios-safari-aac.mp4', import.meta.url));
    const backing = Buffer.concat([Buffer.from([137]), bytes, Buffer.from([0])]);
    for (const data of [backing.subarray(1, -1), Uint8Array.from(bytes).buffer]) {
      const recording = await handoff(data, { [streamMode]: true });
      assert.equal(recording.mediaType, 'audio/mp4');
      assert.deepEqual(Buffer.from(recording.data), bytes);
    }
    await assert.rejects(handoff(new Uint8Array(80), { [streamMode]: true, sourceFormat }), /describe live audio with inputAudioFormat/);
    await assert.rejects(handoff(new ReadableStream(), { [streamMode]: true }), /inputAudioFormat for live/);
    await assert.rejects(handoff(bytes, { model: { doGenerate() {} }, [streamMode]: true }), /native recording upload/);
  });

  it('rejects an unidentified or raw Blob before dispatch and observes abortion during the bounded read', async () => {
    for (const type of ['', 'audio/pcm', 'application/octet-stream']) {
      await assert.rejects(handoff(new Blob([Uint8Array.of(9, 5)], { type }), { [streamMode]: true }), /encoded recording MIME/);
    }
    const controller = new AbortController();
    const blob = new Blob([Uint8Array.of(9)], { type: 'audio/example' });
    mock.method(blob, 'slice', () => ({ arrayBuffer: async () => { controller.abort(new Error('cancel inspection')); return new ArrayBuffer(0); } }));
    await assert.rejects(handoff(blob, {}, controller.signal), /cancel inspection/);
  });
});

describe('Media handoff through the installed SDK', () => {
  it('sends explicitly described unnamed bytes when the published adapter preserves their exact MIME', async () => {
    const bytes = await readFile(new URL('fixtures/review-ios-safari-aac.mp4', import.meta.url));
    const posts = [];
    const model = createOpenAI({ apiKey: 'fixture', fetch: async (_url, { body }) => {
      const file = body.get('file');
      posts.push({ name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) });
      return Response.json({ text: 'complete' });
    } }).transcription('whisper-1');
    const run = Transcriber({ model, maxRetries: 0 });
    const recording = { type: 'file', data: bytes, mediaType: 'audio/mp4' };
    assert.equal((await run(bytes)).text, 'complete');
    assert.equal((await run.run({ audio: recording })).text, 'complete');
    assert.deepEqual(posts[1], posts[0]);
    assert.equal(posts[1].type, 'audio/mp4');
    assert.deepEqual(posts[1].bytes, bytes);
    for (const changes of [{ filename: 'original.capture' }, { mediaType: 'audio/webm' }, { mediaType: 'audio/mp4;codecs=mp4a.40.2' }]) {
      await assert.rejects(run({ ...recording, ...changes }), /preserve its input and metadata/);
    }
    assert.equal(posts.length, 2);
  });

  it('rejects explicit file operations on a byte-only model before taking the producer', async () => {
    const calls = [];
    const model = new MockTranscriptionModelV4({ doGenerate: async options => {
      calls.push(options);
      return { text: 'complete', segments: [], language: undefined, durationInSeconds: undefined, warnings: [],
        response: { timestamp: new Date(), modelId: 'file' } };
    } });
    let pulls = 0;
    const data = new ReadableStream({ pull() { pulls++; } }, { highWaterMark: 0 });
    const audio = { type: 'file', data, mediaType: 'audio/mp4', filename: 'original.capture' };
    await assert.rejects(Transcriber({ model }).run({ audio }), /native recording upload/);
    await assert.rejects(Transcriber.asStream({ model })(audio), /native recording upload/);
    await assert.rejects(Transcriber.asStream({ model, inputAudioFormat: { type: 'audio/pcm', rate: 24000 } })(audio), /supplies its own encoded input/);
    const wav = { format: 'wav', codec: 'pcm_s16le' };
    await assert.rejects(Transcriber.loadsAudio.asStream({ model, fileAudioTarget: wav })(data), /native recording upload/);
    assert.equal(pulls, 0);
    assert.equal(data.locked, false);
    assert.equal(calls.length, 0);
    const bytes = await readFile(new URL('./fixtures/review-ios-safari-aac.mp4', import.meta.url));
    assert.equal((await Transcriber({ model })(new Blob([bytes], { type: 'audio/mp4' }))).text, 'complete');
    assert.deepEqual(Buffer.from(calls[0].audio), bytes);
  });

  it('rejects a replacement URL before opening a prepared source, including on tools', async () => {
    const sourceUrl = 'https://media.example/whole-meeting.mp4';
    const providerOptions = { elevenlabs: { sourceUrl } };
    const requests = [];
    const model = createElevenLabs({ apiKey: 'fixture', fetch: async (_url, { body }) => {
      requests.push({ file: body.get('file'), url: body.get('source_url') });
      return Response.json({ language_code: 'eng', language_probability: 1, text: 'done', words: [] });
    } }).transcription('scribe_v2');
    const file = { model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' }, maxRetries: 0 };
    let pulls = 0;
    const source = new ReadableStream({ pull(controller) { pulls++; controller.close(); } }, { highWaterMark: 0 });
    const conflict = error => error instanceof ConfigError && error.message.includes('elevenlabs.sourceUrl');
    assert.throws(() => Transcriber.loadsAudio({ ...file, providerOptions }), conflict);
    assert.throws(() => Transcriber.loadsAudio.asTool({ ...file, audio: source, inputSchema: z.object({}) },
      Config({ providerOptions })), conflict);
    const prepared = Transcriber.loadsAudio(file);
    await assert.rejects(prepared.run({ audio: source, providerOptions }),
      error => error instanceof ValidationError && error.message.includes('elevenlabs.sourceUrl'));
    assert.equal(source.locked, false);
    assert.equal(pulls, 0);
    assert.equal(requests.length, 0);

    const ordinary = Transcriber({ model, providerOptions });
    assert.equal((await ordinary(new Uint8Array())).text, 'done');
    assert.deepEqual(requests, [{ file: null, url: sourceUrl }]);
  });

  it('hands an HTTP URL to a capable model and honors a caller-selected download and its actual file type', async () => {
    const source = new URL('https://media.example/memo?revision=2');
    const bytes = await readFile(new URL('fixtures/review-ios-safari-aac.mp4', import.meta.url));
    const urls = [], files = [];
    const adapter = createOpenAI({ apiKey: 'fixture', fetch: async (_url, { body }) => {
      files.push(body.get('file'));
      return Response.json({ text: 'uploaded' });
    } }).transcription('whisper-1');
    const model = new MockTranscriptionModelV4({
      doGenerateFromUrl: async ({ audio }) => {
        urls.push(audio.href);
        return { text: 'provider URL', segments: [], warnings: [], response: { timestamp: new Date(), modelId: 'fixture' } };
      },
      doGenerate: options => adapter.doGenerate(options),
    });
    const transcribe = Transcriber({ model, maxRetries: 0 });
    assert.equal((await transcribe(source)).text, 'provider URL');
    assert.deepEqual(urls, [source.href]);
    assert.equal(files.length, 0);

    let downloads = 0;
    const received = await transcribe.run({ audio: source, download: async ({ url }) => {
      downloads++;
      assert.equal(url.href, source.href);
      return { data: bytes, mediaType: 'application/octet-stream' };
    } });
    assert.equal(received.text, 'uploaded');
    assert.equal(downloads, 1);
    assert.deepEqual(urls, [source.href]);
    assert.equal(files.length, 1);
    assert.equal(files[0].name, 'audio.m4a');
    assert.equal(files[0].type, 'audio/mp4');
    assert.deepEqual(Buffer.from(await files[0].arrayBuffer()), bytes);

    let declined = 0;
    const fallback = new MockTranscriptionModelV4({
      doGenerateFromUrl: async () => { declined++; return undefined; },
      doGenerate: options => adapter.doGenerate(options),
    });
    const local = mock.method(globalThis, 'fetch', async url => {
      assert.equal(String(url), source.href);
      return new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } });
    });
    try {
      assert.equal((await Transcriber({ model: fallback, maxRetries: 0 })(source)).text, 'uploaded');
      assert.equal(local.mock.callCount(), 1);
    } finally { local.mock.restore(); }
    assert.equal(declined, 1);
    assert.equal(files.length, 2);
    assert.equal(files[1].type, 'audio/mp4');
    assert.deepEqual(Buffer.from(await files[1].arrayBuffer()), bytes);
  });

  it('keeps SDK download policy on model and injected tool URLs with a URL-capable provider', async () => {
    let forwarded = 0, fileCalls = 0;
    const response = { text: 'heard', segments: [], warnings: [], response: { timestamp: new Date(), modelId: 'fixture' } };
    const model = new MockTranscriptionModelV4({
      doGenerateFromUrl: async () => { forwarded++; return response; },
      doGenerate: async () => { fileCalls++; return response; },
    });
    const schema = z.object({ audio: z.url().transform(value => new URL(value)) });
    const listen = Transcriber.asTool({ model, inputSchema: schema, maxRetries: 0 });
    const blocked = 'https://localhost/meeting.mp4';
    await assert.rejects(listen.execute({ audio: new URL(blocked) }, { toolCallId: 'local', messages: [] }), /download|blocked/i);
    const owner = CasaiFunction({ tools: { listen }, execute: ({ listen }) => listen({ audio: blocked }) });
    await assert.rejects(owner(), /download|blocked/i);
    const names = [];
    const ipv4 = mock.method(Resolver.prototype, 'resolve4', async name => { names.push(name); return ['127.0.0.1']; });
    const ipv6 = mock.method(Resolver.prototype, 'resolve6', async () => []);
    try {
      await assert.rejects(listen.execute({ audio: new URL('https://recording.example/memo') }, { toolCallId: 'dns', messages: [] }),
        error => {
          for (let cause = error; cause; cause = cause.cause) if (cause.code === 'hostname_unsafe') return true;
          return false;
        });
      assert.deepEqual(names, ['recording.example']);
    } finally { ipv4.mock.restore(); ipv6.mock.restore(); }
    assert.equal(forwarded, 0);
    assert.equal(fileCalls, 0);
    const custom = Transcriber.asTool({ model, inputSchema: schema, download: () => ({ data: Uint8Array.of(1), mediaType: 'audio/wav' }) });
    assert.equal((await custom.execute({ audio: new URL('https://media.example/file') }, { toolCallId: 'custom', messages: [] })).text, 'heard');
    assert.equal(fileCalls, 1);
    assert.equal(forwarded, 0);
  });

  it('forwards matching finite containers for transcription and translation, and rejects a conflicting format before dispatch', async () => {
    const uploads = [];
    const receive = async ({ audio, inputAudioFormat }) => {
      uploads.push({ type: inputAudioFormat.type, bytes: Buffer.from(await new Response(audio).arrayBuffer()) });
    };
    const transcriber = Transcriber.asStream({ model: new MockTranscriptionModelV4({ doStream: async request => {
      await receive(request);
      return { stream: ReadableStream.from([{ type: 'finish', text: 'heard', segments: [] }]) };
    } }) });
    const translator = Translator({ targetLanguage: 'fr', model: new Experimental_MockSpeechTranslationModelV4({ doStream: async request => {
      await receive(request);
      return { stream: ReadableStream.from([{ type: 'finish', sourceText: 'heard', outputText: 'entendu' }]) };
    } }) });
    for (const [name, type] of [
      ['review-ios-safari-aac.mp4', 'audio/mp4'], ['review-firefox-opus.ogg', 'audio/ogg'],
      ['review-android-chrome-open-cluster.webm', 'audio/webm'], ['review-mp3-44100.mp3', 'audio/mpeg'],
    ]) {
      const bytes = await readFile(new URL('fixtures/' + name, import.meta.url));
      const inputAudioFormat = { type };
      const file = new File([bytes], name, { type: 'application/octet-stream' });
      file.arrayBuffer = () => assert.fail('materializing a recording for an adapter that can consume it directly');
      assert.equal(await (await transcriber(file, inputAudioFormat)).text, 'heard');
      await translator(bytes, inputAudioFormat);
      assert.deepEqual(uploads.splice(0), [{ type, bytes }, { type, bytes }]);
    }
    const bytes = await readFile(new URL('fixtures/review-firefox-opus.ogg', import.meta.url));
    const wrongContainer = new File([bytes], 'wrong.webm', { type: 'audio/webm' });
    await assert.rejects(transcriber(wrongContainer, { type: 'audio/webm' }), /does not match/);
    const recording = new Blob([bytes], { type: 'audio/ogg; codecs="opus"' });
    await assert.rejects(translator(recording, { type: 'audio/ogg;codecs=vorbis' }), /codecs conflict/);
    assert.equal(uploads.length, 0);
  });

  it('reuses the inspected Blob prefix and stops reading when a live model finishes early', async () => {
    const bytes = await readFile(new URL('fixtures/review-android-chrome-open-cluster.webm', import.meta.url));
    const recording = new Blob([bytes], { type: 'audio/webm' });
    const reads = mock.method(recording, 'slice');
    let full = false;
    const translate = Translator({ targetLanguage: 'fr', inputAudioFormat: { type: 'audio/webm' },
      model: new Experimental_MockSpeechTranslationModelV4({ doStream: async ({ audio }) => {
        if (full) assert.deepEqual(Buffer.from(await new Response(audio).arrayBuffer()), bytes);
        else {
          const reader = audio.getReader();
          try { assert.deepEqual(Buffer.from((await reader.read()).value), bytes.subarray(0, 4096)); }
          finally { reader.releaseLock(); }
        }
        return { stream: ReadableStream.from([{ type: 'finish', sourceText: 'heard', outputText: 'entendu' }]) };
      } }) });
    await translate(recording);
    assert.deepEqual(reads.mock.calls.map(call => call.arguments), [[0, 4096]]);
    reads.mock.resetCalls();
    full = true;
    await translate(recording);
    let end = 0;
    for (const call of reads.mock.calls) {
      const [start, next] = call.arguments;
      assert.equal(start, end);
      assert.ok(next > start && next - start <= 9600);
      end = next;
    }
    assert.equal(end, recording.size);
  });

  it('carries ordered WebM through a Cascada Script and delivers a partial while the producer is open', async () => {
    const bytes = await readFile(new URL('fixtures/review-chrome-opus.webm', import.meta.url));
    let producer;
    const source = new ReadableStream({ start(controller) { producer = controller; } }, { highWaterMark: 0 });
    const prefix = bytes.subarray(0, 4000);
    producer.enqueue(prefix);
    let requests = 0;
    const format = { type: 'audio/webm' };
    const model = new MockTranscriptionModelV4({ doStream: async ({ audio, inputAudioFormat }) => {
      requests++;
      assert.deepEqual(inputAudioFormat, format);
      const reader = audio.getReader();
      return { stream: new ReadableStream({ async start(controller) {
        try {
          const first = await reader.read();
          assert.deepEqual(first.value, prefix);
          controller.enqueue({ type: 'transcript-delta', delta: 'hearing' });
          const chunks = [first.value];
          for (let part = await reader.read(); !part.done; part = await reader.read()) chunks.push(part.value);
          assert.deepEqual(Buffer.concat(chunks), bytes);
          controller.enqueue({ type: 'finish', text: 'heard', segments: [] });
          controller.close();
        } catch (error) { controller.error(error); }
        finally { reader.releaseLock(); }
      } }) };
    } });
    const listen = Transcriber.asStream({ model, inputAudioFormat: format, maxRetries: 0 });
    const run = Script({ script: 'return listen(source)', context: { listen, source } });
    const result = await run();
    const reader = result.fullStream.getReader();
    try {
      assert.deepEqual((await reader.read()).value, { type: 'transcript-delta', delta: 'hearing' });
      producer.enqueue(bytes.subarray(prefix.length));
      producer.close();
      assert.equal((await reader.read()).done, true);
    } finally { reader.releaseLock(); }
    assert.equal(await result.text, 'heard');
    assert.equal(requests, 1);
    assert.equal(source.locked, false);
  });

  for (const action of ['cancels a pending read', 'breaks after a partial', 'returns before reading', 'returns during a read', 'throws during a read']) {
    it('releases the PCM producer and provider when the caller ' + action, async () => {
      const reason = Error('closed captions');
      const cancelled = [];
      const source = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1024)); },
        cancel(reason) { cancelled.push(reason); } }, { highWaterMark: 0 });
      const listening = Promise.withResolvers(), transportEnded = Promise.withResolvers();
      const model = new MockTranscriptionModelV4({ doStream: async ({ audio, abortSignal }) => {
        const reader = audio.getReader();
        try { assert.ok((await reader.read()).value.byteLength > 0); } finally { reader.releaseLock(); }
        return { stream: new ReadableStream({ start(controller) {
          controller.enqueue({ type: 'transcript-delta', delta: 'partial' });
          abortSignal.addEventListener('abort', () => {
            transportEnded.resolve(abortSignal.reason);
            controller.error(abortSignal.reason);
          }, { once: true });
          listening.resolve();
        } }) };
      } });
      const listen = Transcriber.asStream({ model, inputAudioFormat: { type: 'audio/pcm', rate: 8000 },
        sourceFormat: { sampleRate: 16000, channels: 1, encoding: 'pcm_s16le' } });
      const result = await listen(source);
      const stream = result.fullStream;
      await listening.promise;
      if (action === 'cancels a pending read') {
        const reader = stream.getReader();
        try {
          assert.equal((await reader.read()).value.delta, 'partial');
          const pending = reader.read();
          await reader.cancel(reason);
          assert.equal((await pending).done, true);
        } finally { reader.releaseLock(); }
        assert.equal(await transportEnded.promise, reason);
      } else if (action === 'breaks after a partial') {
        let count = 0;
        for await (const part of stream) {
          assert.equal(part.delta, 'partial');
          count++;
          break;
        }
        assert.equal(count, 1);
        assert.equal((await transportEnded.promise).name, 'AbortError');
      } else {
        const iterator = stream[Symbol.asyncIterator]();
        let pending;
        if (action !== 'returns before reading') {
          assert.equal((await iterator.next()).value.delta, 'partial');
          pending = iterator.next();
        }
        if (action === 'throws during a read') await assert.rejects(iterator.throw(reason), error => error === reason);
        else assert.deepEqual(await iterator.return(reason), { done: true, value: reason });
        if (pending) assert.equal((await pending).done, true);
        assert.equal((await iterator.next()).done, true);
        assert.equal(await transportEnded.promise, reason);
      }
      assert.deepEqual(cancelled, [action === 'breaks after a partial' ? undefined : reason]);
      assert.equal(source.locked, false);
      assert.equal(stream.locked, false);
    });
  }

  it('streams a PDF into one provider upload and reuses the returned file ID on resume', async () => {
    const prefix = Buffer.from('%PDF-1.4\nbody from a stream\n');
    const suffix = Buffer.from('end of attachment\n%%EOF');
    const receivedPrefix = Promise.withResolvers();
    let producer, uploads = 0;
    const source = new ReadableStream({ start(controller) { producer = controller; controller.enqueue(prefix); } });
    const modelRequests = [];
    const provider = createOpenAI({ apiKey: 'fixture', fetch: async (url, { body }) => {
      if (new URL(url).pathname.endsWith('/files')) {
        uploads++;
        let content = Buffer.alloc(0);
        for await (const chunk of body) {
          content = Buffer.concat([content, chunk]);
          if (content.includes(prefix)) receivedPrefix.resolve();
        }
        assert.ok(content.includes(Buffer.concat([prefix, suffix])));
        return Response.json({ id: 'file-fixture', object: 'file', filename: 'evidence.pdf',
          bytes: prefix.length + suffix.length, created_at: 1, purpose: 'user_data' });
      }
      const { input } = JSON.parse(body);
      modelRequests.push(input.filter(item => item.role === 'user')
        .flatMap(item => Array.isArray(item.content) ? item.content.filter(part => part.type === 'input_file') : []));
      return Response.json({ id: 'resp_' + modelRequests.length, object: 'response', created_at: 1, model: 'gpt-4.1',
        status: 'completed', error: null, incomplete_details: null, usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7 },
        output: [{ id: 'msg_local', type: 'message', role: 'assistant', status: 'completed',
          content: [{ type: 'output_text', text: 'read', annotations: [] }] }] });
    } });
    const upload = uploadFile({ api: provider, data: { type: 'stream', stream: source }, mediaType: 'application/pdf',
      filename: 'evidence.pdf', providerOptions: { openai: { purpose: 'user_data' } } });
    try {
      assert.equal(await Promise.race([receivedPrefix.promise.then(() => 'prefix'), upload.then(() => 'complete')]), 'prefix');
    } finally { producer.enqueue(suffix); producer.close(); }
    const { providerReference } = await upload;
    assert.deepEqual(providerReference, { openai: 'file-fixture' });
    const agent = LLMAgent({ model: provider.responses('gpt-4.1'), maxRetries: 0 });
    const file = { type: 'file', mediaType: 'application/pdf', data: { type: 'reference', reference: providerReference } };
    const result = await agent([{ role: 'user', content: [file] }]);
    assert.equal(result.text, 'read');
    const resumed = await agent.resume([...result.messageHistory, { role: 'user', content: 'Read it again.' }]);
    assert.equal(resumed.text, 'read');
    assert.deepEqual(modelRequests, Array(2).fill([{ type: 'input_file', file_id: 'file-fixture' }]));
    assert.equal(uploads, 1);
  });

  it('uses native video operations for detached progress and counts delivery to caller storage', async () => {
    let starts = 0, checks = 0;
    const response = { timestamp: new Date(), modelId: 'fixture', headers: undefined };
    const model = { specificationVersion: 'v4', provider: 'fixture', modelId: 'fixture', maxVideosPerCall: 1,
      async doStart() { starts++; return { operation: { job: 'clip-1' }, warnings: [], response }; },
      async doStatus({ operation }) {
        assert.deepEqual(operation, { job: 'clip-1' });
        return ++checks === 1 ? { status: 'pending', response }
          : { status: 'completed', videos: [{ type: 'uploaded' }], warnings: [], response };
      } };
    const job = await startVideo({ model, prompt: 'Make a clip.', maxRetries: 0 });
    const saved = JSON.parse(JSON.stringify(job.operation));
    assert.equal((await getVideoStatus(model, { operation: saved })).status, 'pending');
    assert.equal((await getVideoStatus(model, { operation: saved })).status, 'completed');
    assert.equal(starts, 1);
    assert.equal(checks, 2);

    const direct = { ...model, doGenerate: async () => ({ videos: [{ type: 'uploaded' }], warnings: [], response }) };
    const result = await generateVideo({ model: direct, prompt: 'Make another clip.', maxRetries: 0,
      download: () => assert.fail('Provider already delivered the video to caller storage') });
    assert.equal(result.uploadedVideos, 1);
    assert.deepEqual(result.videos, []);
    assert.throws(() => result.video, /upload/i);
  });

  it('emits a preliminary native image while the final image is withheld and commits only the final result', async () => {
    const releaseFinal = Promise.withResolvers();
    const encoder = new TextEncoder();
    let requests = 0;
    const provider = createOpenAI({ apiKey: 'fixture', fetch: async (_url, { body }) => {
      requests++;
      assert.ok(JSON.parse(body).tools.some(tool => tool.type === 'image_generation' && tool.partial_images === 1));
      return new Response(new ReadableStream({ async start(controller) {
        const send = event => controller.enqueue(encoder.encode('data: ' + JSON.stringify(event) + '\n\n'));
        send({ type: 'response.created', response: { id: 'resp-img', created_at: 1, model: 'gpt-4.1' } });
        send({ type: 'response.output_item.added', output_index: 0, item: { id: 'ig-local', type: 'image_generation_call' } });
        send({ type: 'response.image_generation_call.partial_image', item_id: 'ig-local', output_index: 0, partial_image_b64: 'YQ==' });
        await releaseFinal.promise;
        send({ type: 'response.output_item.done', output_index: 0, item: { id: 'ig-local', type: 'image_generation_call', result: 'Yg==' } });
        send({ type: 'response.completed', response: {} });
        controller.close();
      } }), { headers: { 'content-type': 'text/event-stream' } });
    } });
    const draw = LLMAgent.asStream({ model: provider.responses('gpt-4.1'),
      tools: { draw: provider.tools.imageGeneration({ partialImages: 1 }) }, maxRetries: 0 });
    const result = await draw('Draw a dot.');
    const images = [];
    try {
      for await (const part of result.fullStream) {
        if (part.type === 'error' || part.type === 'tool-error') throw part.error;
        if (part.type !== 'tool-result') continue;
        images.push([part.preliminary === true, part.output.result]);
        if (images.length === 1) {
          assert.deepEqual(images[0], [true, 'YQ==']);
          releaseFinal.resolve();
        }
      }
    } finally { releaseFinal.resolve(); }
    assert.deepEqual(images, [[true, 'YQ=='], [false, 'Yg==']]);
    assert.deepEqual((await result.toolResults).map(part => part.output), [{ result: 'Yg==' }]);
    assert.equal(requests, 1);
  });
});
