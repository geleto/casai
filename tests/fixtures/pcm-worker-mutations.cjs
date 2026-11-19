// Numerical, ownership and worker-budget controls against an isolated source copy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { availableParallelism } = require('node:os');
const workspace = path.resolve(__dirname, '../..');
assert(availableParallelism() >= 2, 'Worker-budget mutation requires at least two available processors.');
const cache = path.join(workspace, '.cache');
fs.mkdirSync(cache, { recursive: true });
const temporary = fs.mkdtempSync(path.join(cache, 'pcm-mutations-'));
const filter = new RegExp(process.argv[2] ?? '');
const mutations = [
  ['extensible integer precision', 'pcm-operations.ts', 'precision > bits', 'precision !== bits', 'reads padded ancillary chunks'],
  ['completed audio cancellation', '../factories/Translator.ts', 'await concatAudio(chunks, signal)', 'await concatAudio(chunks)', 'honors cancellation during completed translation'],
  ['Float32 rounding', 'pcm-resample.ts', 'Math.fround(a * (1 - fraction) + b * fraction)', 'a * (1 - fraction) + b * fraction', 'matches native SDK interpolation'],
  ['partition phase', 'pcm-resample.ts', '(outputStart + i) * ratio', 'i * ratio', 'partitions fractional rates'],
  ['default worker budget', 'pcm-pool.ts', 'maxWorkers = 4', 'maxWorkers = 1', 'honors the default budget'],
  ['shared output selection', 'pcm-pool.ts', "workers > 1 && typeof SharedArrayBuffer === 'function'", 'false', 'honors the default budget'],
  ['shared output range', 'pcm-resample.ts', 'new DataView(output.buffer, output.byteOffset, output.byteLength)', 'new DataView(output.buffer)', 'matches native SDK interpolation'],
  ['shared output allocation', 'pcm-pool.ts', "await schedule(slot => dispatch(slot, { type: 'allocateShared', args: [count * 2] }, []))", 'new Uint8Array(new SharedArrayBuffer(count * 2))', 'honors the default budget'],
  ['borrowed Buffer ownership', 'pcm-pool.ts', 'await copy(bytes.subarray(inputStart * 2, inputEnd * 2))', 'bytes.subarray(inputStart * 2, inputEnd * 2)', 'honors the default budget'],
  ['aggregate copy budget', 'buffer-copy.ts', 'await checkpoint();', 'copied = 0; await checkpoint();', 'bounds preparation'],
  ['copy time budget', 'buffer-copy.ts', 'performance.now() - started >= 1', 'false', 'bounds preparation'],
  ['copy task yielding', 'buffer-copy.ts', 'await yieldAudioWork();', 'await Promise.resolve();', 'bounds preparation'],
  ['large input allocation', 'buffer-copy.ts', 'await allocate(input.byteLength)', 'new Uint8Array(input.byteLength)', 'bounds preparation'],
  ['shared input reuse', 'buffer-copy.ts', '!isArrayBuffer(input.buffer)', 'false', 'reuses read-only shared input'],
  ['explicit shared output copy', '../audio.ts', "return runPcm('concatAudio', async copy => {", "if (chunks.length === 1 && chunks[0] instanceof Uint8Array) return Promise.resolve(chunks[0] as Uint8Array<ArrayBuffer>); return runPcm('concatAudio', async copy => {", 'copies shared audio in a worker'],
  ['empty audio assembly', '../audio.ts', 'if (chunks.length === 0) return new Uint8Array(0);', '', 'completes text-only translation'],
  ['empty audio encoding', '../audio.ts', "if (audio.byteLength === 0) return '';", '', 'completes text-only translation'],
  ['copied stream carry', 'pcm-resample.ts', 'firstSample.set(input.subarray(start, start + 2));', '', 'copies a Buffer chunk remainder'],
  ['bounded streaming work', 'pcm.ts', 'pending.subarray(0, 32768)', 'pending', 'streams bounded chunks'],
  ['shared streaming input', 'pcm-pool.ts', "typeof input !== 'string' && isArrayBuffer(input.buffer)", "typeof input !== 'string'", 'uses bounded shared chunks'],
  ['empty translation audio parts', '../factories/Translator.ts', "part.type === 'audio' && part.audio.length > 0", "part.type === 'audio'", 'completes text-only translation'],
  ['empty PCM stream cancellation', 'pcm.ts', 'await yieldAudioWork(); continue;', 'continue;', 'allows cancellation between empty PCM chunks'],
  ['worker failure propagation', 'pcm-pool.ts', 'throw error;', 'return undefined as T;', 'rejects worker failures'],
  ['bounded finite resampling', 'pcm-pool.ts', 'Math.min(start + samplesPerJob, count)', 'count', 'schedules short results'],
  ['finite scheduling capacity', 'pcm-pool.ts', 'lanes.length < Math.min(maxWorkers, backend.availableParallelism())', 'true', 'schedules short results'],
  ['idle worker cleanup', 'pcm-pool.ts', '}, 5000);', '}, 500000);', 'releases idle workers automatically'],
  ['idle Node worker references', 'pcm-worker.node.ts', 'worker.unref(); receive(response);', 'receive(response);', 'keeps Node alive'],
  ['active Node worker references', 'pcm-worker.node.ts', 'worker.ref(); worker.postMessage(request, transfer);', 'worker.postMessage(request, transfer);', 'keeps Node alive'],
];
const selected = mutations.filter(([name]) => filter.test(name));
assert(selected.length, 'No PCM mutations matched.');
function run(pattern, mutated = false, files = ['tests/AudioPreparation.unit.test.ts', 'tests/PcmWorkers.unit.test.ts', 'tests/Phase6Audio.unit.test.ts']) {
  const generated = spawnSync(process.execPath, ['scripts/build-audio-workers.mjs'], { cwd: temporary, encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stdout + generated.stderr);
  const result = spawnSync(process.execPath, [path.join(workspace, 'node_modules/mocha/bin/mocha.js'), '--no-config',
    '--node-option', 'import=tsx/esm', '--node-option', 'conditions=casai-source', '--timeout', '15000', '--reporter', 'dot', '--fail-zero',
    ...files, '--grep', pattern], { cwd: temporary, encoding: 'utf8', timeout: 90000 });
  assert.equal(result.error, undefined);
  const output = result.stdout + result.stderr;
  if (mutated) { assert.notEqual(result.status, 0, output); assert.match(output, /\d+ failing/, output); }
  else assert.equal(result.status, 0, output);
}
try {
  fs.cpSync(path.join(workspace, 'src'), path.join(temporary, 'src'), { recursive: true });
  fs.copyFileSync(path.join(workspace, 'package.json'), path.join(temporary, 'package.json'));
  fs.mkdirSync(path.join(temporary, 'scripts'));
  fs.copyFileSync(path.join(workspace, 'scripts/build-audio-workers.mjs'), path.join(temporary, 'scripts/build-audio-workers.mjs'));
  fs.mkdirSync(path.join(temporary, 'tests'));
  fs.mkdirSync(path.join(temporary, 'tests/fixtures'));
  fs.copyFileSync(path.join(workspace, 'tests/fixtures/pcm-workers.mjs'), path.join(temporary, 'tests/fixtures/pcm-workers.mjs'));
  for (const file of ['AudioPreparation.unit.test.ts', 'PcmWorkers.unit.test.ts', 'Phase6Audio.unit.test.ts', 'pcm-reference.ts']) {
    fs.copyFileSync(path.join(workspace, 'tests', file), path.join(temporary, 'tests', file));
  }
  if (process.argv[2]) run(selected.map(([, , , , pattern]) => pattern).join('|'));
  else {
    // Keep all controls, with independent process budgets for exhaustive sample cases and worker lifetime.
    run('', false, ['tests/AudioPreparation.unit.test.ts']);
    run('', false, ['tests/PcmWorkers.unit.test.ts']);
    run('', false, ['tests/Phase6Audio.unit.test.ts']);
  }
  for (const [name, file, before, after, pattern] of selected) {
    const filename = path.join(temporary, 'src/audio', file), original = fs.readFileSync(filename, 'utf8');
    assert.equal(original.split(before).length, 2, name);
    try { fs.writeFileSync(filename, original.replace(before, after)); run(pattern, true); }
    finally { fs.writeFileSync(filename, original); }
    console.log('Caught PCM mutation: ' + name);
  }
} finally {
  assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(cache));
  assert.ok(path.basename(temporary).startsWith('pcm-mutations-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
