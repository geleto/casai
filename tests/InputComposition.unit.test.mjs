import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { isStepCount, tool } from 'ai';
import { MockTranscriptionModelV4, convertArrayToReadableStream } from 'ai/test';
import { LLMAgent, Transcriber, z } from 'casai';
import { modelFor } from './fixtures/phase2-security-sdk.js';

const mediaType = 'application/pdf';
const filename = 'notes.pdf';
const first = Buffer.from('%PDF-1.4\nrevision one\n');
const second = Buffer.from('%PDF-1.4\nrevision two\n');
const tools = { lookup: tool({ inputSchema: z.object({}), execute: () => 'looked up' }) };

function onlyFile(messages) {
  const files = messages.filter(message => message.role === 'user' && Array.isArray(message.content))
    .flatMap(message => message.content.filter(part => part.type === 'file'));
  assert.equal(files.length, 1);
  return files[0];
}

function checkFile(messages, expected) {
  const part = onlyFile(messages);
  assert.equal(part.filename, filename);
  assert.equal(part.mediaType, mediaType);
  const bytes = part.data.type === 'data' ? part.data.data : part.data;
  assert.ok(typeof bytes === 'string' || bytes instanceof Uint8Array || bytes instanceof ArrayBuffer);
  assert.deepEqual(typeof bytes === 'string' ? Buffer.from(bytes, 'base64') : Buffer.from(bytes), expected);
}

describe('Attachment content across model steps', () => {
  for (const mode of ['generate', 'stream']) {
    for (const source of ['inline bytes', 'generated file']) {
      // 6D admits a structural generated file in the SDK's tagged inline-data slot.
      const run = source === 'generated file' ? it.skip : it;
      run(`${mode}: reuses ${source} in both model requests and on resume`, async () => {
        const backing = Buffer.concat([Buffer.of(255), first, Buffer.of(254)]);
        const view = backing.subarray(1, -1);
        let reads = 0, hooks = 0;
        const read = () => ++reads === 1 ? view : second;
        const generated = { mediaType, get uint8Array() { return read(); }, get base64() { return read().toString('base64'); } };
        const file = { type: 'file', filename, data: { type: 'data', data: source === 'generated file' ? generated : view } };
        if (source === 'inline bytes') file.mediaType = mediaType;
        const model = modelFor({}, 'lookup');
        const agent = LLMAgent({ model, tools, stopWhen: isStepCount(2), prepareCall(request) {
          hooks++;
          checkFile(request.messages, first);
          return request;
        } });
        const result = await agent[mode]({ messages: [{ role: 'user', content: [file] }] });
        assert.equal(await result.text, 'done');
        const calls = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
        assert.equal(calls.length, 2);
        for (const call of calls) checkFile(call.prompt, first);
        const history = await result.messageHistory;
        checkFile(history, first);
        const next = modelFor(undefined);
        const resumed = await agent.resume([...history, { role: 'user', content: 'Continue.' }], { model: next });
        assert.equal(resumed.text, 'done');
        assert.equal(next.doGenerateCalls.length, 1);
        checkFile(next.doGenerateCalls[0].prompt, first);
        assert.equal(hooks, 2);
        assert.equal(reads, source === 'generated file' ? 1 : 0);
      });
    }

    for (const supported of [false, true]) {
      it(`${mode}: ${supported ? 'passes a supported PDF URL through both steps' : 'accepts a newer download on the second step'}`, async () => {
        const model = modelFor({}, 'lookup', supported ? { [mediaType]: [/^https:/] } : {});
        const url = new URL('https://attachments.invalid/notes.pdf');
        let downloads = 0;
        const agent = LLMAgent({ model, tools, stopWhen: isStepCount(2), experimental_download: async jobs =>
          jobs.map(job => {
            assert.equal(job.url.href, url.href);
            if (job.isUrlSupportedByModel) return null;
            return { data: ++downloads === 1 ? first : second, mediaType };
          }) });
        const result = await agent[mode]({ messages: [{ role: 'user', content: [
          { type: 'file', filename, mediaType, data: { type: 'url', url } },
        ] }] });
        assert.equal(await result.text, 'done');
        const calls = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
        assert.equal(calls.length, 2);
        assert.equal(downloads, supported ? 0 : 2);
        if (supported) {
          for (const { prompt } of calls) {
            const part = onlyFile(prompt);
            assert.equal(part.data.href, url.href);
            assert.equal(part.mediaType, mediaType);
            assert.equal(part.filename, filename);
          }
        } else {
          checkFile(calls[0].prompt, first);
          checkFile(calls[1].prompt, second);
        }
      });
    }
  }
});

describe('Audio iterable ownership', () => {
  it.skip('6D waits for the original PCM iterator to close after the provider stops at its first chunk', async () => {
    const closing = Promise.withResolvers(), release = Promise.withResolvers();
    const frame = Uint8Array.of(7, 0);
    let returns = 0, requests = 0, reads = 0;
    const source = {
      [Symbol.asyncIterator]() { return this; },
      async next() {
        await nextTurn();
        return ++reads <= 8 ? { done: false, value: frame } : { done: true };
      },
      async return() {
        returns++;
        closing.resolve();
        await release.promise;
        return { done: true };
      },
    };
    const model = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
      requests++;
      const reader = audio.getReader();
      try { assert.deepEqual(await reader.read(), { done: false, value: frame }); }
      finally { reader.releaseLock(); }
      return { stream: convertArrayToReadableStream([{ type: 'finish', text: 'heard', segments: [] }]) };
    } });
    const transcribe = Transcriber({ model, inputAudioFormat: { type: 'audio/pcm', rate: 24000 } });
    const call = transcribe(source);
    try {
      // Race completion as well as cleanup so an early success or rejection fails here.
      assert.equal(await Promise.race([closing.promise.then(() => 'closing'), call.then(() => 'completed')]), 'closing');
      assert.equal(await Promise.race([call.then(() => 'completed'), nextTurn('pending')]), 'pending');
    } finally { release.resolve(); }
    assert.equal((await call).text, 'heard');
    assert.equal(requests, 1);
    assert.equal(returns, 1);
  });
});
