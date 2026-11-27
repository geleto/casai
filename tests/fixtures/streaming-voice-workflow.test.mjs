import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createOpenAI } from '@ai-sdk/openai';
import { create, z } from 'casai';
import { MockLanguageModelV3, MockTranscriptionModelV4, Experimental_MockStreamingSpeechModelV4 } from 'ai/test';
import { runVoiceTurns, singleListenerAnswer, takeMp3Reply, voiceMemoTool } from '../../docs/examples/streaming-voice.mjs';
import { ticketWriter } from '../../docs/examples/voice-ticket.mjs';
import { finishedRecording, liveRecording } from '../../docs/examples/recorder-audio.mjs';

const pcm = { type: 'audio/pcm', rate: 24000 };
test('finished capture preserves large Blob parts and live capture orders reads and rejects an overrun', async () => {
  const recorder = Object.assign(new EventTarget(), { state: 'inactive', mimeType: 'audio/webm;codecs=opus',
    stop() { this.state = 'inactive'; this.dispatchEvent(new Event('stop')); } });
  const deliver = blob => recorder.dispatchEvent(Object.assign(new Event('dataavailable'), { data: blob }));
  const part = new Blob([new Uint8Array(2 * 1024 * 1024)]);
  part.arrayBuffer = () => assert.fail('reading a file recording timeslice');
  const saved = finishedRecording(recorder);
  deliver(new Blob([])); deliver(part); deliver(new Blob([Uint8Array.of(7)])); recorder.stop();
  const recording = await saved;
  assert.equal(recording.size, part.size + 1);
  assert.equal(recording.type, recorder.mimeType);
  assert.deepEqual(new Uint8Array(await recording.slice(-1).arrayBuffer()), Uint8Array.of(7));

  const reader = liveRecording(recorder).getReader(), release = Promise.withResolvers();
  const first = new Blob([Uint8Array.of(4)]), second = new Blob([Uint8Array.of(5, 6)]);
  let secondReads = 0;
  first.arrayBuffer = async () => { await release.promise; return Uint8Array.of(4).buffer; };
  second.arrayBuffer = () => { secondReads++; return Blob.prototype.arrayBuffer.call(second); };
  const prefix = reader.read();
  deliver(first); deliver(second); recorder.stop();
  assert.equal(secondReads, 0);
  release.resolve();
  assert.deepEqual((await prefix).value, Uint8Array.of(4));
  assert.deepEqual((await reader.read()).value, Uint8Array.of(5, 6));
  assert.equal((await reader.read()).done, true);
  const stalled = liveRecording(recorder, { maxQueuedBytes: 8 }).getReader();
  recorder.state = 'recording';
  deliver(new Blob([new Uint8Array(9)]));
  await assert.rejects(stalled.read(), /queued-byte limit/);
  assert.equal(recorder.state, 'inactive');

  for (const mode of ['cancel', 'abort']) {
    const held = Promise.withResolvers(), started = Promise.withResolvers(), reason = new Error('end capture');
    const abort = new AbortController(), pending = liveRecording(recorder, { signal: abort.signal }).getReader();
    recorder.state = 'recording';
    const block = new Blob(['held']);
    block.arrayBuffer = () => { started.resolve(); return held.promise; };
    const read = pending.read(), settled = read.then(value => value.done, error => error);
    deliver(block); await started.promise;
    if (mode === 'cancel') { await pending.cancel(reason); assert.equal(await settled, true); }
    else { abort.abort(reason); assert.equal(await settled, reason); }
    assert.equal(recorder.state, 'inactive');
    held.resolve(new ArrayBuffer(4));
  }
});

test('a finished recording keeps the first available timeslice MIME when stop clears the recorder MIME', async () => {
  const recordedType = 'audio/mp4;codecs=mp4a.40.2';
  for (const [recorderType, partType, expected] of [
    ['', recordedType, recordedType], ['audio/mp4', recordedType, 'audio/mp4'], ['', '', ''],
  ]) {
    const recorder = Object.assign(new EventTarget(), { state: 'inactive', mimeType: '' });
    const recording = finishedRecording(recorder);
    for (const part of [new Blob(['a']), new Blob(['b'], { type: partType })]) {
      part.arrayBuffer = () => assert.fail('reading timeslices for metadata');
      recorder.dispatchEvent(Object.assign(new Event('dataavailable'), { data: part }));
    }
    recorder.mimeType = recorderType;
    recorder.dispatchEvent(new Event('stop'));
    const file = await recording;
    assert.equal(file.type, expected);
    assert.equal(await file.text(), 'ab');
  }
});

test('stopping microphone capture preserves every PCM frame in order including the partial block', async () => {
  const messages = [];
  let processor;
  runInNewContext(await readFile(new URL('../../docs/examples/microphone-worklet.mjs', import.meta.url), 'utf8'), {
    sampleRate: 16000,
    AudioWorkletProcessor: class { port = { postMessage: (data, transfer) => messages.push(structuredClone(data, { transfer })) }; },
    registerProcessor(_name, Worklet) { processor = new Worklet(); },
  });
  const amplitudes = [0, -1, 1, 0.25, -0.5], pcm16 = [0, -32768, 32767, 8191, -16384];
  const frames = Float32Array.from({ length: 1473 }, (_, i) => amplitudes[i % amplitudes.length]);
  const command = data => processor.port.onmessage({ data });
  command('read');
  for (let i = 0; i < frames.length; i += 128) processor.process([[frames.subarray(i, i + 128)]]);
  assert.equal(messages.length, 1);
  command('stop'); command('stop');
  assert.equal(messages.pop(), 'end');
  assert.deepEqual(messages.map(buffer => buffer.byteLength / 2), [640, 640, 193]);
  const delivered = Buffer.concat(messages.map(buffer => Buffer.from(buffer)));
  assert.deepEqual(Array.from(frames, (_, i) => delivered.readInt16LE(i * 2)), Array.from(frames, (_, i) => pcm16[i % pcm16.length]));
});

const finish = { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' },
  usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } };

function setupVoice({ play, stopPlayback = () => {}, caption = () => {}, failAfterPrefix = false, singleListener = false }) {
  const recording = Promise.withResolvers();
  const tail = Promise.withResolvers();
  const questions = [], turns = [];
  let speechRequests = 0, captureSignal;
  const listen = create.Transcriber.asStream({ inputAudioFormat: pcm, model: new MockTranscriptionModelV4({
    doStream: async ({ abortSignal }) => {
      captureSignal = abortSignal;
      return { stream: new ReadableStream({ start(c) { recording.resolve(c); } }) };
    },
  }) });
  const answerModel = new MockLanguageModelV3({ doStream: async ({ prompt, abortSignal }) => {
    questions.push(prompt.at(-1).content[0].text);
    turns.push(abortSignal);
    return { stream: new ReadableStream({ async start(c) {
      c.enqueue({ type: 'stream-start', warnings: [] });
      c.enqueue({ type: 'text-start', id: 'line' });
      c.enqueue({ type: 'text-delta', id: 'line', delta: 'first' });
      await tail.promise;
      if (failAfterPrefix) c.enqueue({ type: 'error', error: new Error('agent stopped') });
      else c.enqueue({ type: 'text-delta', id: 'line', delta: 'last' });
      c.enqueue({ type: 'text-end', id: 'line' }); c.enqueue(finish); c.close();
    } }) };
  } });
  const answer = singleListener ? singleListenerAnswer(answerModel) : create.LLMAgent.asStream({ model: answerModel, onError: () => {} });
  const speak = create.SpeechGenerator.asStream({ model: new Experimental_MockStreamingSpeechModelV4({
    doStream: async ({ text }) => {
      speechRequests++;
      return { stream: new ReadableStream({ async start(c) {
        for await (const part of text) c.enqueue({ type: 'audio', audio: Uint8Array.of(part.text.length), audioFormat: pcm });
        c.enqueue({ type: 'finish' }); c.close();
      } }) };
    },
  }) });
  const controller = new AbortController();
  const done = runVoiceTurns({ listen, answer, speak, audio: new ReadableStream(), signal: controller.signal, caption, play, stopPlayback });
  return { recording: recording.promise, tail, done, questions, turns, controller,
    get captureSignal() { return captureSignal; }, get speechRequests() { return speechRequests; } };
}

function nova(text, final, speechFinal) {
  return { type: final ? 'transcript-final' : 'transcript-partial', text, providerMetadata: { deepgram: { speechFinal } } };
}
function flux(event, text, turnIndex = 0) {
  return { type: event === 'EndOfTurn' ? 'transcript-final' : 'transcript-partial', text,
    providerMetadata: { deepgram: { event, turnIndex } } };
}
function endRecording(c) {
  c.enqueue({ type: 'finish', text: 'complete', segments: [] }); c.close();
}

test('one listener can play a Cascada reply before the final token and interrupt it on new speech', { timeout: 5000 }, async t => {
  const heard = Promise.withResolvers();
  const voice = setupVoice({ singleListener: true, async play(speech) {
    for await (const bytes of speech.audioStream) heard.resolve([...bytes]);
  } });
  t.after(() => { voice.tail.resolve(); voice.controller.abort(); });
  const mic = await voice.recording;
  mic.enqueue(nova('answer', true, true));
  assert.deepEqual(await heard.promise, [5]);
  mic.enqueue(nova('wait', false, false));
  await t.waitFor(() => assert.equal(voice.turns[0].aborted, true));
  assert.equal(voice.captureSignal.aborted, false);
  voice.tail.resolve(); endRecording(mic); await voice.done;
  assert.equal(voice.speechRequests, 1);
});

test('a completion getter on a single-listener reply leaves a paused consumer in control', async () => {
  let pulls = 0;
  const model = new MockLanguageModelV3({ doStream: async () => ({ stream: new ReadableStream({ pull(c) {
    const index = pulls++;
    if (index === 0) c.enqueue({ type: 'stream-start', warnings: [] });
    else if (index === 1) c.enqueue({ type: 'text-start', id: 'line' });
    else if (index < 98) c.enqueue({ type: 'text-delta', id: 'line', delta: 'x' });
    else if (index === 98) c.enqueue({ type: 'text-end', id: 'line' });
    else { c.enqueue(finish); c.close(); }
  } }, { highWaterMark: 0 }) }) });
  const result = singleListenerAnswer(model).run({ prompt: 'Speak' });
  const reader = result.textStream.getReader();
  const reason = result.finishReason;
  try {
    assert.equal((await reader.read()).value, 'x');
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(pulls < 98, 'the model finished while playback was paused');
    assert.throws(() => result.fullStream, /one stream consumer/i);
    let length = 1;
    while (!(await reader.read()).done) length++;
    assert.equal(length, 96);
    assert.equal(await reason, 'stop');
  } finally { await reader.cancel(); reader.releaseLock(); }
});

for (const mode of ['Nova', 'Flux']) test(mode + ' commits one utterance before EOF and streams its first spoken bytes', { timeout: 5000 }, async t => {
  const captions = [], heard = [], first = Promise.withResolvers();
  const voice = setupVoice({ caption: value => captions.push(value), async play(speech) {
    for await (const bytes of speech.audioStream) { heard.push(...bytes); first.resolve(); }
  } });
  t.after(() => { voice.tail.resolve(); voice.controller.abort(); });
  const source = await voice.recording;
  const preliminary = mode === 'Nova'
    ? [nova('turn', false, false), nova('turn on', true, false)]
    : [flux('StartOfTurn', ''), flux('EagerEndOfTurn', 'turn'), flux('TurnResumed', 'turn on')];
  for (const event of preliminary) source.enqueue(event);
  await t.waitFor(() => assert.equal(captions.at(-1), 'turn on'));
  assert.deepEqual(voice.questions, []);
  if (mode === 'Nova') {
    source.enqueue(nova('the lights', true, false));
    source.enqueue(nova('', true, true));
  } else {
    source.enqueue(flux('EndOfTurn', 'turn on the lights'));
    source.enqueue(flux('EndOfTurn', 'turn on the lights'));
  }
  await first.promise;
  assert.deepEqual(heard, [5]); assert.equal(voice.captureSignal.aborted, false);
  voice.tail.resolve(); endRecording(source); await voice.done;
  assert.deepEqual(voice.questions, ['turn on the lights']); assert.equal(voice.speechRequests, 1);
  assert.deepEqual(heard, [5, 4]);
});

test('barge-in stops the old reply while the same microphone accepts a new turn', { timeout: 5000 }, async t => {
  const playing = Promise.withResolvers(), stopped = Promise.withResolvers(), heard = [];
  const voice = setupVoice({ stopPlayback: () => stopped.resolve(), async play(speech, signal) {
    for await (const bytes of speech.audioStream) {
      if (signal.aborted) break;
      heard.push(bytes[0]); playing.resolve();
    }
  } });
  t.after(() => { voice.tail.resolve(); voice.controller.abort(); });
  const source = await voice.recording;
  source.enqueue(flux('EndOfTurn', 'old question')); await playing.promise;
  source.enqueue(flux('StartOfTurn', '', 1)); await stopped.promise;
  assert.equal(voice.turns[0].aborted, true); assert.equal(voice.captureSignal.aborted, false);
  source.enqueue(flux('EndOfTurn', 'new question', 1));
  voice.tail.resolve(); endRecording(source); await voice.done;
  assert.deepEqual(voice.questions, ['old question', 'new question']); assert.deepEqual(heard, [5, 5, 4]);
});

test('an agent failure after first speech terminates the example', { timeout: 5000 }, async t => {
  const first = Promise.withResolvers();
  const voice = setupVoice({ failAfterPrefix: true, async play(speech) {
    for await (const part of speech.fullStream) {
      if (part.type === 'error') throw part.error;
      if (part.type === 'audio') first.resolve();
    }
  } });
  t.after(() => { voice.tail.resolve(); voice.controller.abort(); });
  const rejected = assert.rejects(voice.done, /agent stopped/);
  const source = await voice.recording;
  source.enqueue(flux('EndOfTurn', 'question')); await first.promise;
  voice.tail.resolve(); await rejected;
  assert.equal(voice.captureSignal.aborted, true);
});

test('a rejected caption stops transcription before the utterance can start a reply', { timeout: 5000 }, async t => {
  const reason = new Error('caption writer closed');
  for (const event of [nova('one', true, true), flux('EndOfTurn', 'two')]) {
    let sinkSignal;
    const voice = setupVoice({ async caption(_text, signal) { sinkSignal = signal; throw reason; },
      play() { assert.fail('starting speech after a caption failure'); } });
    t.after(() => { voice.tail.resolve(); voice.controller.abort(); });
    const rejected = assert.rejects(voice.done, error => error === reason);
    (await voice.recording).enqueue(event);
    await rejected;
    assert.equal(sinkSignal.reason, reason);
    assert.equal(voice.captureSignal.reason, reason);
    assert.deepEqual(voice.questions, []);
  }
});

test('ending capture discards a provisional turn and leaves completed playback alone', { timeout: 5000 }, async t => {
  const played = Promise.withResolvers();
  let stops = 0;
  const voice = setupVoice({ stopPlayback() { stops++; }, async play(speech) {
    for await (const bytes of speech.audioStream) assert.ok(bytes.length > 0);
    played.resolve();
  } });
  t.after(() => { voice.tail.resolve(); voice.controller.abort(); });
  const source = await voice.recording;
  source.enqueue(flux('EndOfTurn', 'completed'));
  voice.tail.resolve(); await played.promise;
  // The player signals its last sample inside the callback. Let that call return.
  await new Promise(resolve => setImmediate(resolve));
  source.enqueue(flux('Update', 'unfinished', 1)); endRecording(source);
  await voice.done;
  assert.deepEqual(voice.questions, ['completed']);
  assert.equal(stops, 0);
});

test('one GET streams an existing MP3 reply and retries cannot restart it', async () => {
  let source;
  const replies = new Map([['r', { fullStream: new ReadableStream({ start(c) { source = c; } }) }]]);
  const url = 'https://example.test/reply';
  const head = new Request(url, { method: 'HEAD' });
  const metadata = takeMp3Reply(replies, 'r', head);
  assert.equal(metadata.status, 200);
  assert.equal(metadata.body, null);
  assert.equal(replies.get('r').fullStream.locked, false);
  const post = takeMp3Reply(replies, 'r', new Request(url, { method: 'POST' }));
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD');
  const aborted = new Request(url, { signal: AbortSignal.abort(new Error('gone')) });
  assert.throws(() => takeMp3Reply(replies, 'r', aborted), /gone/);
  const response = takeMp3Reply(replies, 'r', new Request(url, { headers: { Range: 'bytes=0-' } }));
  assert.deepEqual([...metadata.headers], [...response.headers]);
  assert.equal(response.status, 200);
  assert.equal(takeMp3Reply(replies, 'r', head).status, 410);
  const reader = response.body.getReader();
  assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
  const audio = byte => ({ type: 'audio', audio: Uint8Array.of(byte), audioFormat: { type: 'audio/mpeg' } });
  source.enqueue(audio(1)); assert.deepEqual((await reader.read()).value, Uint8Array.of(1));
  assert.equal(takeMp3Reply(replies, 'r').status, 410);
  source.enqueue(audio(2)); source.close();
  assert.deepEqual((await reader.read()).value, Uint8Array.of(2)); assert.equal((await reader.read()).done, true);
});

test('a wrong codec or a late provider error fails the HTTP body, and cancellation reaches its source', async () => {
  for (const part of [{ type: 'audio', audioFormat: pcm, audio: Uint8Array.of(1, 2) }, { type: 'error', error: new Error('socket failed') }]) {
    const replies = new Map([['r', { fullStream: ReadableStream.from([part]) }]]);
    await assert.rejects(takeMp3Reply(replies, 'r').arrayBuffer(), /Expected MP3|socket failed/);
  }
  const cancelled = Promise.withResolvers(), abort = new AbortController();
  const replies = new Map([['r', { fullStream: new ReadableStream({ cancel(reason) { cancelled.resolve(reason); } }) }]]);
  const body = takeMp3Reply(replies, 'r', abort.signal).arrayBuffer();
  abort.abort(new Error('client left'));
  await assert.rejects(body, /client left/); assert.equal(await cancelled.promise, abort.signal.reason);
});

test('a memo begins writing before speech ends and returns a replayable asset receipt', async () => {
  const head = Promise.withResolvers(), tail = Promise.withResolvers(), saved = [];
  const speak = create.SpeechGenerator.asStream({ model: new Experimental_MockStreamingSpeechModelV4({
    doStream: async () => ({ stream: new ReadableStream({ async start(c) {
      const audio = byte => ({ type: 'audio', audioFormat: { type: 'audio/mpeg' }, audio: Uint8Array.of(byte) });
      c.enqueue(audio(3)); await tail.promise; c.enqueue(audio(4)); c.enqueue({ type: 'finish' }); c.close();
    } }) }),
  }) });
  const tool = voiceMemoTool(speak, async bytes => {
    for await (const chunk of bytes) { saved.push(...chunk); head.resolve(); }
    return 'asset-7';
  });
  const input = { text: 'Your order is ready' }, options = { toolCallId: 'memo-7', messages: [] };
  const result = tool.execute(input, options);
  try {
    await head.promise; assert.deepEqual(saved, [3]);
  } finally { tail.resolve(); }
  const output = await result;
  assert.deepEqual(saved, [3, 4]);
  assert.deepEqual(output, { assetId: 'asset-7', filename: 'memo.mp3', mediaType: 'audio/mpeg', caption: input.text });
  assert.deepEqual(await tool.toModelOutput({ ...options, input, output }), { type: 'text', value: input.text });
});

test('a failed memo write and an abandoned HTTP reply both stop the active speech provider', async () => {
  let providerSignal;
  const speak = create.SpeechGenerator.asStream({ model: new Experimental_MockStreamingSpeechModelV4({
    doStream: async ({ abortSignal }) => {
      providerSignal = abortSignal;
      return { stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'audio', audioFormat: { type: 'audio/mpeg' }, audio: Uint8Array.of(3) });
      } }) };
    },
  }) });
  const diskError = new Error('Storage full');
  const tool = voiceMemoTool(speak, async body => {
    const reader = body.getReader();
    try { await reader.read(); } finally { reader.releaseLock(); }
    throw diskError;
  });
  await assert.rejects(tool.execute({ text: 'memo' }, { toolCallId: 'save', messages: [] }), error => error === diskError);
  assert.equal(providerSignal.reason, diskError);

  const request = new AbortController();
  const replies = new Map([['reply', await speak('Play this')]]);
  const reader = takeMp3Reply(replies, 'reply', request.signal).body.getReader();
  assert.deepEqual((await reader.read()).value, Uint8Array.of(3));
  request.abort(new Error('Listener left'));
  await assert.rejects(reader.read(), /Listener left/);
  assert.equal(providerSignal.reason, request.signal.reason);
});

test('retried authenticated voice calls return the original ticket after reopening the database', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'casai-voice-tickets-'));
  const path = join(dir, 'support.sqlite');
  const connections = [];
  t.after(async () => { for (const db of connections) db.close(); await rm(dir, { recursive: true }); });
  function operator(account, conversation) {
    const db = new DatabaseSync(path); connections.push(db);
    const write = ticketWriter(db);
    const tool = create.Function.asTool({ inputSchema: z.object({ subject: z.string() }),
      execute: ({ subject, _toolOptions }) => write(account, conversation, _toolOptions.toolCallId, subject) });
    return create.VoiceAgentBackend({ model: createOpenAI({ apiKey: 'local' }).experimental_realtime('gpt-realtime'), tools: { openTicket: tool } });
  }
  const call = { toolCallId: 'call-1', toolName: 'openTicket', args: { subject: 'Delayed delivery' } };
  const a = operator('A', 'chat'), b = operator('A', 'chat');
  const [first, retry] = await Promise.all([a.executeTool(call), b.executeTool(call)]);
  assert.deepEqual(first, retry);
  for (const db of connections.splice(0)) db.close();
  const reopened = operator('A', 'chat');
  assert.deepEqual(await reopened.executeTool(call), first);
  await assert.rejects(reopened.executeTool({ ...call, args: { subject: 'Something else' } }), /different subject/);
  assert.notDeepEqual(await operator('B', 'chat').executeTool(call), first);
  assert.notDeepEqual(await operator('A', 'another').executeTool(call), first);
});
