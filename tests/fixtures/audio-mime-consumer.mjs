// Run from an isolated packed consumer, with two deliberately different provider-utils installations.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transcribe, generateText } from 'ai';
import { MockTranscriptionModelV4, MockLanguageModelV4 } from 'ai/test';
import { Transcriber, ValidationError } from 'casai';

const require = createRequire(import.meta.url);
const fromCasai = createRequire(require.resolve('casai'));
const fromAI = createRequire(require.resolve('ai'));
const casaiPath = fromCasai.resolve('@ai-sdk/provider-utils');
const aiPath = fromAI.resolve('@ai-sdk/provider-utils');
assert.notEqual(casaiPath, aiPath, 'This gate must exercise a real split install');
const casai = await import(pathToFileURL(casaiPath).href);
const sdk = await import(pathToFileURL(aiPath).href);
const encode = value => new TextEncoder().encode(value);
const flac = new Uint8Array(42); flac.set([102, 76, 97, 67, 128, 0, 0, 34]);
const ogg = new Uint8Array(27); ogg.set(encode('OggS'));
const wav = new Uint8Array(48); wav.set(encode('RIFF')); wav[4] = 40; wav.set(encode('WAVEfmt '), 8);
wav[16] = 16; wav[20] = 1; wav[22] = 1; wav[34] = 16; wav.set(encode('data'), 36); wav[40] = 4;
const mp4 = Uint8Array.of(0, 0, 0, 24, ...encode('ftypisom'), 0, 0, 0, 0, ...encode('isommp42'));
const ebml = text => Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, 0x80 | (text.length + 3), 0x42, 0x82, 0x80 | text.length, ...encode(text));
const recordings = [
  ['audio/wav', wav], ['audio/flac', flac], ['audio/ogg', ogg], ['audio/mp4', mp4],
  ['audio/webm', ebml('webm')], ['audio/x-matroska', ebml('matroska')],
  ['audio/mpeg', Uint8Array.of(...encode('ID3'), 4, 0, 0, 0, 0, 0, 0)],
  ['audio/mpeg', Uint8Array.of(255, 251, 0, 0)], ['audio/aac', Uint8Array.of(255, 241, 0, 0)],
  ['audio/basic', Uint8Array.of(1, 2, 3, 4)], ['audio/basic', Uint8Array.of(255, 251, 0, 0)],
];
const requestTypes = [];
const model = new MockTranscriptionModelV4({ doGenerate: async ({ mediaType }) => {
  requestTypes.push(mediaType);
  return { text: 'checked', segments: [], warnings: [], response: { timestamp: new Date(0), modelId: 'test' } };
} });
for (const [mediaType, data] of recordings) {
  const predicted = casai.detectMediaType({ data, topLevelType: 'audio' });
  assert.equal(predicted, sdk.detectMediaType({ data, topLevelType: 'audio' }), mediaType);
  await transcribe({ model, audio: data });
  assert.equal(requestTypes.at(-1), predicted ?? 'audio/wav');
  const before = requestTypes.length;
  const action = () => Transcriber({ model })(new File([data], 'recording', { type: mediaType }));
  if ((predicted ?? 'audio/wav') === mediaType) {
    await action(); assert.equal(requestTypes.at(-1), mediaType);
  } else {
    await assert.rejects(action(), ValidationError);
    assert.equal(requestTypes.length, before, 'Wrong and missing labels must fail before model dispatch');
  }
}
// Keep the SDK image boundary visible for D: a declared APNG type is re-detected as PNG.
const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
assert.equal(casai.detectMediaType({ data: png, topLevelType: 'image' }), sdk.detectMediaType({ data: png, topLevelType: 'image' }));
const imageModel = new MockLanguageModelV4({ doGenerate: async ({ prompt }) => {
  assert.equal(prompt[0].content[0].mediaType, 'image/png');
  return { content: [{ type: 'text', text: 'checked' }], finishReason: { unified: 'stop', raw: 'stop' },
    usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } }, warnings: [] };
} });
await generateText({ model: imageModel, messages: [{ role: 'user', content: [{ type: 'image', image: png, mediaType: 'image/apng' }] }] });
console.log('Split provider-utils detectors and actual SDK audio/image requests agree; Casai rejects inaccurate audio labels.');
