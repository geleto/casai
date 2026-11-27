// Run with Node 24.5+ and an isolated installation of the packages listed in the review.
import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const packageDirectory = process.argv[2];
if (!packageDirectory) throw new Error('Pass the directory containing the comparison node_modules.');
const packageRoot = pathToFileURL(resolve(packageDirectory, 'package.json')).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === import.meta.url && /^(?:@langchain\/|@ai-sdk\/langchain$)/.test(specifier)) {
      return nextResolve(specifier, { ...context, parentURL: packageRoot });
    }
    return nextResolve(specifier, context);
  },
});

const { convertModelMessages, toUIMessageStream } = await import('@ai-sdk/langchain');
const { AIMessageChunk, HumanMessage, ToolMessage } = await import('@langchain/core/messages');
const { END, MemorySaver, MessagesAnnotation, START, StateGraph } = await import('@langchain/langgraph');
const { MediaAssembler } = await import('@langchain/langgraph-sdk/stream');
const { Client } = await import('@langchain/langgraph-sdk');
const { ChatOpenAI } = await import('@langchain/openai');

test('reconnecting a run reads later events from the existing execution', { timeout: 8000 }, async () => {
  const calls = [], streamPath = '/threads/conversation/runs/existing/stream';
  const disconnect = Promise.withResolvers();
  const client = new Client({ apiUrl: 'http://reference.test', callerOptions: { async fetch(url, init) {
    const path = new URL(url).pathname, method = init.method;
    const cursor = new Headers(init.headers).get('Last-Event-ID');
    calls.push({ path, method, cursor });
    if (path === streamPath.slice(0, -7)) return Response.json({ status: 'success' });
    const first = method === 'POST';
    const value = first ? 'started' : 'committed';
    const data = new TextEncoder().encode(`id: ${first ? 7 : 8}\nevent: values\ndata: ${JSON.stringify({ value })}\n\n`);
    let sent = false;
    const body = new ReadableStream({ async pull(controller) {
      if (!sent) { sent = true; controller.enqueue(data); }
      else if (first) { await disconnect.promise; controller.error(new TypeError('terminated')); }
      else controller.close();
    } }, { highWaterMark: 0 });
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream', Location: streamPath } });
  } } });
  const events = [];
  for await (const event of client.runs.stream('conversation', 'speaker', {
    input: { text: 'read this' }, streamMode: ['values'], streamResumable: true, reconnectDelayMs: () => 0,
  })) { events.push(event.data.value); disconnect.resolve(); }
  assert.deepEqual(events, ['started', 'committed']);
  assert.deepEqual(calls.filter(call => call.path.endsWith('/stream')), [
    { path: '/threads/conversation/runs/stream', method: 'POST', cursor: null },
    { path: streamPath, method: 'GET', cursor: '7' },
  ]);
});

function captureChat() {
  const requests = [];
  const model = new ChatOpenAI({
    model: 'gpt-audio', apiKey: 'local-fixture', useResponsesApi: false, maxRetries: 0,
    configuration: {
      baseURL: 'https://fixture.invalid/v1',
      async fetch(_url, init) {
        requests.push(JSON.parse(init.body).messages);
        return Response.json({
          id: 'chat', object: 'chat.completion', created: 1, model: 'gpt-audio',
          choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        });
      },
    },
  });
  return async messages => {
    await model.invoke(messages);
    return requests.at(-1);
  };
}

test('compare the Vercel bridge and native LangChain blocks at the Chat Completions receiver', async () => {
  const capture = captureChat();
  const bytes = { type: 'data', data: Uint8Array.of(1, 2) };
  const parts = [
    { type: 'text', text: 'Read these' },
    { type: 'file', filename: 'memo.wav', mediaType: 'audio/wav', data: bytes },
    { type: 'file', filename: 'notes.pdf', mediaType: 'application/pdf', data: bytes },
    { type: 'file', filename: 'archived.pdf', mediaType: 'application/pdf',
      data: { type: 'reference', reference: { openai: 'file-abc' } } },
  ];
  const viaAdapter = await capture(convertModelMessages([{ role: 'user', content: parts }]));
  const native = await capture([new HumanMessage({ content: [
    parts[0],
    { type: 'audio', source_type: 'base64', data: 'AQI=', mime_type: 'audio/wav' },
    { type: 'file', source_type: 'base64', data: 'AQI=', mime_type: 'application/pdf', metadata: { filename: 'notes.pdf' } },
    { type: 'file', source_type: 'id', id: 'file-abc', mime_type: 'application/pdf' },
  ] })]);
  assert.deepEqual(native[0].content, [
    parts[0],
    { type: 'input_audio', input_audio: { format: 'wav', data: 'AQI=' } },
    { type: 'file', file: { file_data: 'data:application/pdf;base64,AQI=', filename: 'notes.pdf' } },
    { type: 'file', file: { file_id: 'file-abc' } },
  ]);
  assert.deepEqual(viaAdapter[0].content, [
    parts[0],
    { type: 'file', file: { file_data: 'data:audio/wav;base64,AQI=', filename: 'LC_AUTOGENERATED' } },
    { type: 'file', file: { file_data: 'data:application/pdf;base64,AQI=', filename: 'LC_AUTOGENERATED' } },
  ]);
});

test('inspect text and audio from the same graph update at the UI consumer', async () => {
  const message = new AIMessageChunk({ id: 'reply', content: [
    { type: 'audio', mimeType: 'audio/wav', data: 'AQI=' },
    { type: 'text', text: 'Ready' },
  ] });
  const source = ReadableStream.from([['messages', [message, { langgraph_node: 'speaker' }]]]);
  const chunks = await Array.fromAsync(toUIMessageStream(source));
  assert.deepEqual(chunks.map(part => part.type), ['start', 'text-start', 'text-delta', 'text-end', 'finish']);
  assert.equal(chunks[2].delta, 'Ready');
});

test('compare a tool artifact on the model wire and after checkpoint restore', async () => {
  const capture = captureChat();
  const artifact = { assetId: 'clip/v1', audio: new Blob(['bytes']), bytes: Uint8Array.of(1, 2) };
  const message = new ToolMessage({ content: 'caption', tool_call_id: 'c', artifact });
  const graph = new StateGraph(MessagesAnnotation).addNode('pass', () => ({}))
    .addEdge(START, 'pass').addEdge('pass', END).compile({ checkpointer: new MemorySaver() });
  const config = { configurable: { thread_id: 'asset-test' } };
  await graph.invoke({ messages: [message] }, config);
  const restored = (await graph.getState(config)).values.messages[0].artifact;
  assert.deepEqual(restored, { assetId: 'clip/v1', audio: {}, bytes: { 0: 1, 1: 2 } });
  assert.deepEqual(await capture([message]), [{ role: 'tool', content: 'caption', tool_call_id: 'c' }]);
});

function send(assembler, data) {
  assembler.consume({ type: 'event', method: 'messages', params: { namespace: [], timestamp: 0, data } });
}

function begin(assembler, content) {
  send(assembler, { event: 'message-start', id: 'reply' });
  send(assembler, { event: 'content-block-start', index: 0, content });
}

test('observe inline byte delivery and the completed file from one graph message', async () => {
  let file;
  const media = new MediaAssembler({ onFile(handle) { file = handle; } });
  begin(media, { type: 'file', data: '', filename: 'notes.pdf', mimeType: 'application/pdf' });
  const reader = file.stream.getReader();
  const delta = Buffer.alloc(4096, 7).toString('base64');
  let bytesCopied = 0;
  const originalSet = Uint8Array.prototype.set;
  try {
    // Only count synchronous copies made while the assembler consumes these deltas.
    Uint8Array.prototype.set = function (source, offset) {
      bytesCopied += source.byteLength;
      return originalSet.call(this, source, offset);
    };
    for (let i = 0; i < 256; i++) {
      send(media, { event: 'content-block-delta', index: 0, delta: { type: 'data-delta', data: delta, encoding: 'base64' } });
    }
  } finally {
    Uint8Array.prototype.set = originalSet;
  }
  assert.equal((await reader.read()).value.byteLength, 4096);
  send(media, { event: 'message-finish', reason: 'stop' });
  const blob = await file.blob;
  assert.equal(file.filename, 'notes.pdf');
  assert.equal(blob.name, undefined);
  assert.equal(blob.size, 1048576);
  assert.equal(bytesCopied, 134742016);
  await reader.cancel();
});

test('observe whether a URL-backed stream and Blob use the same fetch', async () => {
  let requests = 0, audio;
  const media = new MediaAssembler({
    fetch: async () => new Response(Uint8Array.of(++requests)),
    onAudio(handle) { audio = handle; },
  });
  begin(media, { type: 'audio', url: 'https://fixture.invalid/clip', mimeType: 'audio/mpeg' });
  send(media, { event: 'message-finish', reason: 'stop' });
  const body = new Uint8Array(await new Response(audio.stream).arrayBuffer());
  const blob = new Uint8Array(await (await audio.blob).arrayBuffer());
  assert.equal(requests, 2);
  assert.deepEqual([...body], [1]);
  assert.deepEqual([...blob], [2]);
});

test('a Cascada voice reply delivers its first speech bytes before the final language-model token', { timeout: 5000 }, async () => {
  const { LLMAgent, Script, SpeechGenerator } = await import('casai');
  const { MockLanguageModelV3, Experimental_MockStreamingSpeechModelV4 } = await import('ai/test');
  const tail = Promise.withResolvers();
  let speechRequests = 0;
  const model = new MockLanguageModelV3({ doStream: async () => ({
    stream: new ReadableStream({ async start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'text-start', id: 'answer' });
      controller.enqueue({ type: 'text-delta', id: 'answer', delta: 'first' });
      await tail.promise;
      controller.enqueue({ type: 'text-delta', id: 'answer', delta: 'second' });
      controller.enqueue({ type: 'text-end', id: 'answer' });
      controller.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' },
        usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } });
      controller.close();
    } }),
  }) });
  const voice = new Experimental_MockStreamingSpeechModelV4({ doStream: async ({ text }) => {
    speechRequests++;
    return { stream: new ReadableStream({ async start(controller) {
      for await (const part of text) {
        controller.enqueue({ type: 'audio', audio: Uint8Array.of(part.text.length), audioFormat: { type: 'audio/pcm', rate: 24000 } });
      }
      controller.enqueue({ type: 'finish' });
      controller.close();
    } }) };
  } });
  const reply = Script({
    script: 'var reply = answer(prompt)\nreturn speak(reply.textStream)',
    context: { prompt: 'turn on the lights', answer: LLMAgent.asStream({ model }), speak: SpeechGenerator.asStream({ model: voice }) },
  });
  try {
    const reader = (await reply()).audioStream.getReader();
    assert.deepEqual(await reader.read(), { value: Uint8Array.of(5), done: false });
    tail.resolve();
    assert.deepEqual(await reader.read(), { value: Uint8Array.of(6), done: false });
    assert.equal((await reader.read()).done, true);
    assert.equal(speechRequests, 1);
  } finally { tail.resolve(); }
});

test('capture a late tool continuation while the next voice response is active', { timeout: 20000 }, async t => {
  const { build } = await import('esbuild');
  const { chromium } = createRequire(import.meta.resolve('cascada-engine'))('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CASAI_REVIEW_CHROMIUM });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const sent = [];
  let relay;
  await page.routeWebSocket('wss://casai.test/voice', socket => {
    relay = socket;
    socket.onMessage(data => {
      const event = JSON.parse(data);
      sent.push(event);
      if (event.type === 'session-update') socket.send(JSON.stringify({ type: 'session-created', sessionId: 'local', raw: {} }));
    });
  });
  await page.route('https://casai.test/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.goto('https://casai.test/');
  const client = await build({
    stdin: { contents: "export { Experimental_AbstractRealtimeSession as Session } from 'ai'", resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'sdk',
  });
  await page.addScriptTag({ content: client.outputFiles[0].text });
  await page.evaluate(async () => {
    class Session extends sdk.Session {
      setState() {}
      getSnapshot() { return this.state; }
    }
    const pending = Promise.withResolvers();
    globalThis.calls = [];
    globalThis.received = [];
    globalThis.finishLookup = pending.resolve;
    globalThis.session = new Session({
      model: { specificationVersion: 'v4', provider: 'fixture', modelId: 'voice',
        capabilities: { connections: ['server-websocket'] }, serializeClientEvent: JSON.stringify, parseServerEvent: event => event },
      api: { websocket: 'wss://casai.test/voice' },
      onToolCall({ toolCall }) { calls.push(toolCall.toolCallId); return pending.promise; },
      onEvent(event) { received.push([event.type, event.responseId]); },
    });
    await session.connect({ capture: false });
  });
  await page.waitForFunction(() => session.getSnapshot().status === 'connected');
  const send = (type, fields) => relay.send(JSON.stringify({ type, raw: {}, ...fields }));
  send('response-created', { responseId: 'A' });
  send('function-call-arguments-done', { responseId: 'A', itemId: 'tool', callId: 'lookup-A', name: 'lookup', arguments: '{}' });
  send('response-done', { responseId: 'A', status: 'completed' });
  send('speech-started', { itemId: 'user-B' });
  send('speech-stopped', { itemId: 'user-B' });
  send('input-transcription-completed', { itemId: 'user-B', transcript: 'cancel that and tell me the time' });
  send('response-created', { responseId: 'B' });
  send('text-delta', { responseId: 'B', itemId: 'answer-B', delta: 'The time is' });
  await page.waitForFunction(() => received.some(([type, id]) => type === 'text-delta' && id === 'B'));
  assert.deepEqual(await page.evaluate(() => calls), ['lookup-A']);
  assert.equal(sent.some(event => event.type === 'response-create'), false);
  await page.evaluate(() => finishLookup({ found: true }));
  await t.waitFor(() => assert.ok(sent.some(event => event.type === 'response-create')), { timeout: 5000 });
  assert.deepEqual(sent.filter(event => event.item?.type === 'function-call-output').map(event => event.item.callId), ['lookup-A']);
  assert.equal(sent.filter(event => event.type === 'response-create').length, 1);
  await page.evaluate(() => session.dispose());
});
