// Build from the consumer's directory: package checks run outside the workspace with no native peer;
// the native stage executes the same entries against the real installed backend.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const mode = process.argv.includes('--present') ? 'present' : process.argv.includes('--broken') ? 'broken' : 'absent';
const directory = resolve('.cache/phase6-node-bundles');
await mkdir(directory, { recursive: true });
// A tiny independent PCM16 WAV, with nonzero samples.
const wav = Buffer.alloc(52);
wav.write('RIFF'); wav.writeUInt32LE(44, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(8, 40);
wav.writeInt16LE(1000, 44);
for (const entry of ['raw', 'file']) for (const format of ['esm', 'cjs']) {
  const outfile = resolve(directory, `${entry}-${format}.${format === 'esm' ? 'mjs' : 'cjs'}`);
  const contents = `import assert from 'node:assert/strict';
import { createHook } from 'node:async_hooks';
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { Transcriber } from 'casai';
import { experimental_resampleAudio as sdkResample, experimental_decodeRealtimeAudio as decode, experimental_encodeRealtimeAudio as encode } from 'ai';
const bytes = Buffer.from('${wav.toString('base64')}', 'base64');
const inputAudioFormat = { type: 'audio/pcm', rate: 24000 };
let received, shared;
const model = { specificationVersion: 'v4', provider: 'test', modelId: 'test',
  doGenerate: async () => ({ text: 'bundled', segments: [], durationInSeconds: 1, warnings: [], response: { timestamp: new Date(), modelId: 'test' } }),
  doStream: async ({ audio }) => {
    const parts = []; for await (const part of audio) parts.push(part);
    shared = parts[0]?.buffer instanceof SharedArrayBuffer;
    received = new Uint8Array(Buffer.concat(parts));
    return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', text: 'bundled', segments: [] }); c.close(); } }) };
  },
};
async function action() {
  const settings = ${entry === 'raw' ? '{ inputAudioFormat }' : "{ fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } }"};
  assert.equal((await Transcriber.loadsAudio({ model, ...settings })(bytes)).text, 'bundled');
  if ('inputAudioFormat' in settings) assert.deepEqual(received, new Uint8Array(bytes.subarray(44)));
}
(async () => {
  let workers = 0, posted = 0, joins = 0, maxSamples = 0;
  const hook = createHook({ init(_id, type) { if (type === 'WORKER') workers++; } }).enable();
  const nativePost = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (...args) { posted++; if (args[0].type === 'concatAudio') joins++; if (args[0].type === 'resample') maxSamples = Math.max(maxSamples, args[0].args[3]); return nativePost.apply(this, args); };
  try {
    const pcm = Uint8Array.from({ length: 2 * 1024 * 1024 }, (_, i) => i % 256);
    const expected = new Uint8Array(Buffer.from(encode(sdkResample(decode(Buffer.from(pcm).toString('base64')), 44100, 24000)), 'base64'));
    for (let call = 0; call < 2; call++) {
      await Transcriber({ model, inputAudioFormat, sourceFormat: { sampleRate: 44100, channels: 1, encoding: 'pcm_s16le' } })(pcm);
      const output = received;
      assert.deepEqual(output, expected);
      assert.equal(shared, availableParallelism() > 1);
    }
    assert(workers > 0);
    assert(workers <= Math.min(4, availableParallelism()));
    assert(posted > 0 && maxSamples <= 262144, 'Bundled resampling uses bounded worker jobs');
    assert.equal(joins, availableParallelism() > 1 ? 0 : 2, 'Only nonshared chunked results need a final worker join');
  } finally { hook.disable(); Worker.prototype.postMessage = nativePost; }
  ${mode === 'present' ? 'await action();' : `await assert.rejects(action, /${mode === 'broken' ? 'installed native backend failed' : 'requires node-av'}/);`}
  console.log('phase6-bundle-completed');
})().catch(error => { console.error(error); process.exitCode = 1; });`;
  const result = await build({
    stdin: { contents, resolveDir: process.cwd(), sourcefile: 'node-consumer.ts', loader: 'ts' },
    bundle: true, minify: true, keepNames: true, platform: 'node', target: 'node24', format, outfile, metafile: true,
    conditions: process.argv.includes('--dist') ? [] : ['casai-source'],
    // The SDK has CommonJS dependencies that need ordinary require in an ESM bundle.
    ...(format === 'esm' ? { banner: { js: "import { createRequire as bundleRequire } from 'node:module'; const require = bundleRequire(import.meta.url);" } } : {}),
    logOverride: { 'empty-import-meta': 'silent' },
  });
  assert(!Object.keys(result.metafile.inputs).some(name => /node_modules[/\\]node-av[/\\]/.test(name)), 'Native code stays dynamically resolved.');
  assert.match(execFileSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 30000 }), /phase6-bundle-completed/, 'The process must complete its pending calls before exiting');
  console.log(`Node ${format} ${entry} bundle passed (${mode} native peer).`);
}
