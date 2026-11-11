// Execute the actual displayed code with SDK test models. No provider requests.
import assert from 'node:assert/strict';
import { MockLanguageModelV3, MockEmbeddingModelV4, MockRerankingModelV4, MockImageModelV4,
  MockTranscriptionModelV4, MockSpeechModelV4, Experimental_DecisionMockModelV4,
  Experimental_MockStreamingSpeechModelV4, Experimental_MockSpeechTranslationModelV4,
  convertArrayToReadableStream as stream } from 'ai/test';
import { createOpenAI } from '@ai-sdk/openai';
import { generate, typecheck } from './matrix-examples.mjs';

const examples = await generate();
typecheck();
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  assert(url.startsWith('data:'), `Unexpected network request: ${url}`);
  return nativeFetch(input, init);
};
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const pcm = new Uint8Array(19202);
const recording = new URL('data:audio/wav;base64,AQI=');
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };

function languageModel(allowTools = true, toolArguments = {}) {
  let called = false;
  const next = request => {
    const name = request.tools?.find(tool => tool.type === 'function')?.name;
    const calling = Boolean(allowTools && name && !called);
    called ||= calling;
    const args = JSON.stringify(toolArguments[name] ?? {});
    const text = request.responseFormat?.type === 'json' ? '{"answer":"done","nextStep":"Send a photo."}' : 'done';
    return { content: calling ? [{ type: 'tool-call', toolCallId: 'matrix-call', toolName: name, input: args }] : [{ type: 'text', text }],
      finishReason: { unified: calling ? 'tool-calls' : 'stop', raw: 'stop' }, usage, warnings: [] };
  };
  return new MockLanguageModelV3({ doGenerate: async request => next(request), doStream: async request => {
    const result = next(request);
    return { stream: stream([{ type: 'stream-start', warnings: [] }, ...result.content.flatMap(part => part.type === 'tool-call' ? [part] : [
      { type: 'text-start', id: 'text' }, { type: 'text-delta', id: 'text', delta: part.text }, { type: 'text-end', id: 'text' },
    ]), { type: 'finish', finishReason: result.finishReason, usage }]) };
  } });
}

function fixture(name) {
  const requests = [];
  const capture = result => async request => { requests.push(request); return typeof result === 'function' ? result(request) : result; };
  const response = { timestamp: new Date(0), modelId: 'matrix' };
  const finish = { type: 'finish', text: 'Your order arrives Friday.', segments: [], language: 'en' };
  const audioFormat = { type: 'audio/pcm', rate: 24000 };
  const models = {
    LLMAgent: () => languageModel(),
    Decision: () => new Experimental_DecisionMockModelV4({ doDecide: capture({ answers: { team: { type: 'choice', choice: 'returns', probabilities: { returns: 1, billing: 0, delivery: 0 } } }, warnings: [] }) }),
    Embedder: () => new MockEmbeddingModelV4({ maxEmbeddingsPerCall: 10, doEmbed: capture(({ values }) => ({ embeddings: values.map(() => [42]), warnings: [] })) }),
    Reranker: () => new MockRerankingModelV4({ doRerank: capture(({ topN }) => ({ ranking: [{ index: 0, relevanceScore: 0.9 }, { index: 1, relevanceScore: 0.6 }, { index: 2, relevanceScore: 0.2 }].slice(0, topN ?? 3), warnings: [] })) }),
    ImageGenerator: () => new MockImageModelV4({ maxImagesPerCall: 10, doGenerate: capture(({ n }) => ({ images: Array.from({ length: n }, () => png), warnings: [], response })) }),
    Transcriber: () => new MockTranscriptionModelV4({ doGenerate: capture({ text: finish.text, segments: [], language: 'en', durationInSeconds: 1, warnings: [], response }) }),
    StreamingTranscriber: () => new MockTranscriptionModelV4({ doStream: capture(async ({ audio }) => {
      const chunks = []; for await (const chunk of audio) chunks.push(...chunk);
      assert.deepEqual(new Uint8Array(chunks), pcm);
      return { stream: stream([{ type: 'transcript-delta', delta: finish.text }, finish]) };
    }) }),
    SpeechGenerator: () => new MockSpeechModelV4({ doGenerate: capture({ audio: 'AQI=', warnings: [], response }) }),
    StreamingSpeechGenerator: () => new Experimental_MockStreamingSpeechModelV4({ doStream: capture(async ({ text }) => {
      let input = ''; for await (const part of text) input += typeof part === 'string' ? part : part.text;
      assert.match(input, /Hello Ada\. Your Northstar order is due Friday\./);
      return { stream: stream([{ type: 'audio', audio: 'AQI=', audioFormat }, { type: 'finish' }]) };
    }) }),
    StreamingTranslator: () => new Experimental_MockSpeechTranslationModelV4({ doStream: capture(async ({ audio, targetLanguage }) => {
      const chunks = []; for await (const chunk of audio) chunks.push(...chunk);
      assert.deepEqual(new Uint8Array(chunks), pcm); assert.equal(targetLanguage, 'fr');
      return { stream: stream([{ type: 'output-text-delta', delta: 'Vendredi.' }, { type: 'finish', sourceText: finish.text, outputText: 'Vendredi.' }]) };
    }) }),
    VoiceSessionSetup: () => Object.assign(createOpenAI({ apiKey: 'unused-test-key' }).experimental_realtime('fixture'), {
      doCreateClientSecret: capture({ token: 'fixture', url: 'https://example.invalid', expiresAt: 1 }),
      doCreateWebRTCSession: capture({ sdp: 'answer' }),
    }),
  };
  return { model: models[name]?.(), requests };
}

const originalLog = console.log;
let passed = 0;
for (const example of examples.filter(example => example.status === 'implemented')) {
  const selected = id => example.activeOptions.includes(id);
  const operation = selected('asStream') && ['SpeechGenerator', 'Transcriber', 'Translator'].includes(example.component) ? `Streaming${example.component}` : example.component;
  const { model, requests } = fixture(operation);
  const args = model ? [model] : [];
  const hosted = selected('asTool') && !selected('run') && example.component !== 'Embedder';
  if (hosted) {
    const prepared = ['withTemplate', 'withScript', 'withFunction', 'loadTemplate', 'loadScript'].some(selected);
    args.push(languageModel(true, {
      deliveryUpdate: { name: 'Ada', orderId: 'N-1042' },
      orderSummary: { orderId: 'N-1042' },
      deliveryQuote: { weightKg: 2, service: 'express' },
      returnsAdvisor: prepared ? { question: 'My mug arrived cracked. What should I do?' } : {},
      routeRequest: prepared ? { issue: 'My mug arrived cracked.' } : { state: 'My mug arrived cracked.' },
      findPolicy: prepared ? { question: 'How do I replace a damaged mug?' } : { query: 'How do I replace a damaged mug?' },
      productScene: prepared ? { scene: 'a picnic table beside a mountain lake' } : { prompt: 'Place a Trail mug on a picnic table beside a mountain lake. Keep the mug shape and markings unchanged.' },
      transcribeNote: prepared ? {} : { audio: recording.href },
      speakUpdate: prepared ? { name: 'Ada' } : { text: 'Hello Ada. Your Northstar order is due Friday.' },
    }));
  }
  if (selected('referenceImage')) args.push(png);
  if (selected('mask')) args.push(png);
  if (selected('voice')) args.push('test-voice');
  if (operation === 'Transcriber') args.push(recording);
  if (['StreamingTranscriber', 'StreamingTranslator'].includes(operation)) args.push(pcm);
  if (example.component === 'VoiceSessionSetup' && selected('webRTC')) args.push('offer');
  let approvals = 0;
  if (selected('resume')) args.push(async ids => { assert.equal(ids.length, 1); approvals++; return ids; });
  try {
    console.log = () => {};
    const module = await import(example.url.href);
    const result = await module.example(...args);
    assert.equal(approvals, selected('resume') ? 1 : 0);
    if (hosted) {
      assert.equal(result.text, 'done');
      assert.equal(result.toolResults.length, 1);
      assert.equal(result.toolResults[0].type, 'tool-result');
    } else if (example.component === 'Config') assert.match(result.outlet, /Northstar Outlet/);
    else if (example.component === 'Context') assert.deepEqual(result, { amount: 5, currency: 'GBP' });
    else if (example.component === 'Template') { assert.match(result, /Ada/); assert.match(result, /Friday/); }
    else if (example.component === 'Script') assert.deepEqual(result, { orderId: 'N-1042', total: 52, deliveryDay: 'Friday' });
    else if (example.component === 'Function') assert.deepEqual(result, { amount: 10, currency: 'GBP' });
    else if (example.component === 'LLMAgent') { assert.deepEqual(result.output, selected('structured') ? { answer: 'done', nextStep: 'Send a photo.' } : 'done'); assert(result.messageHistory.length >= 2); }
    else if (example.component === 'Decision') assert.equal(result, 'returns');
    else if (example.component === 'Embedder') assert.deepEqual(result, selected('batch') ? [[42], [42]] : [42]);
    else if (example.component === 'Reranker') assert.equal(result.length, selected('topN') ? 2 : 3);
    else if (example.component === 'ImageGenerator') assert.equal(result.length, selected('count') ? 3 : 1);
    else if (example.component === 'Transcriber') assert.equal(result, 'Your order arrives Friday.');
    else if (example.component === 'Translator') assert.equal(result, 'Vendredi.');
    else if (example.component === 'VoiceSessionSetup' && selected('useTools')) {
      assert.deepEqual(await result.executeTool({ toolCallId: 'actual-call', toolName: 'lookupOrder', args: { orderId: 'N-1042' } }), { orderId: 'N-1042', deliveryDay: 'Friday' });
    }
    if (model && example.component !== 'LLMAgent') assert.equal(requests.length, selected('prepareSession') ? 0 : 1);
    if (selected('voice')) assert.equal(requests[0].voice, 'test-voice');
    const request = requests[0];
    if (example.component === 'LLMAgent') {
      const calls = [...model.doGenerateCalls, ...model.doStreamCalls];
      assert.match(JSON.stringify(calls[0].prompt), /My mug arrived cracked/);
      if (selected('messages')) assert.match(JSON.stringify(calls[0].prompt), /I bought a Trail mug yesterday/);
      if (selected('resume')) {
        const last = calls.at(-1).prompt;
        assert.equal(JSON.stringify(last).match(/My mug arrived cracked/g).length, 1, 'Resume must not repeat the user turn');
        assert.match(JSON.stringify(last), /tool-result/);
      }
      assert.equal(Boolean(calls[0].tools?.length), selected('useTools'));
    }
    if (example.component === 'Decision') assert.match(JSON.stringify(request.state), /My mug arrived cracked/);
    if (example.component === 'Embedder') assert.deepEqual(request.values.map(value => value.trim()), selected('batch')
      ? ['Trail mug. Insulated steel. Leakproof lid.', 'Trail bottle. Insulated steel. Leakproof lid.'] : ['Trail mug. Insulated steel. Leakproof lid.']);
    if (example.component === 'Reranker') {
      assert.match(request.query, /replace a damaged mug/);
      assert.equal(request.topN, selected('topN') ? 2 : undefined);
    }
    if (example.component === 'ImageGenerator') {
      assert.match(request.prompt, /Trail mug on a picnic table beside a mountain lake/);
      assert.equal(request.files?.length ?? 0, selected('referenceImage') ? 1 : 0);
      assert.equal(Boolean(request.mask), selected('mask'));
      assert.equal(request.n, selected('count') ? 3 : 1);
    }
    if (operation === 'SpeechGenerator') assert.equal(request.text.trim(), 'Hello Ada. Your Northstar order is due Friday.');
    if (['StreamingTranscriber', 'StreamingTranslator'].includes(operation)) assert.deepEqual(request.inputAudioFormat, { type: 'audio/pcm', rate: 24000 });
    if (example.component === 'VoiceSessionSetup') {
      const session = selected('prepareSession') ? (selected('useTools') ? result.session : result) : request.sessionConfig;
      assert.match(session.instructions, /Help Northstar customers in English/);
      assert.deepEqual(session.tools?.map(tool => tool.name) ?? [], selected('useTools') ? ['lookupOrder'] : []);
    }
    passed++;
  } catch (error) { throw new Error(`Matrix example failed: ${example.id}`, { cause: error }); }
  finally { console.log = originalLog; }
}
// An AI model may answer directly even when tools are available.
for (const streaming of [false, true]) {
  const example = examples.find(item => item.component === 'LLMAgent'
    && item.activeOptions.length === (streaming ? 3 : 2)
    && item.activeOptions.includes('resume') && item.activeOptions.includes('asStream') === streaming);
  const module = await import(example.url.href);
  try {
    console.log = () => {};
    const result = await module.example(languageModel(false), () => assert.fail('No approval request was made'));
    assert.equal(result.output, 'done');
  } finally { console.log = originalLog; }
}
globalThis.fetch = nativeFetch;
console.log(`Executed ${passed} matrix selections with SDK mocks; no paid calls.`);
