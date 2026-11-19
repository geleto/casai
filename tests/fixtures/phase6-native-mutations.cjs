// Native security/lifetime mutations run against an isolated source copy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(workspace, '.phase6-native-mutations-'));
const mutations = [
  ['edited movie conversion', 'const copy = editedMovie ? undefined :', 'const copy = false ? undefined :', 'applies movie playback edits'],
  ['discarded movie packets', 'discarded && playedPacket || skip &&', 'false || skip &&', 'applies movie playback edits'],
  ['playlist upload evidence', "return 'ffconcat';", 'return undefined;', 'applies native playlist opening', 'source-evidence.ts'],
  ['transport-stream upload evidence', "return 'video/mp2t';", 'return undefined;', 'dispatches decoded transport streams', 'source-evidence.ts'],
  ['untagged audio frame evidence', 'return framedAudio(bytes);', 'return undefined;', 'distinguishes untagged MP3', 'source-evidence.ts'],
  ['rounded native pre-skip', 'const rounding = clockRounding(stream, source.sampleRate);', 'const rounding = 0n;', 'copies continuous Opus across'],
  ['AVI input layout', "if (textAt(bytes, 0, 'RIFF') && textAt(bytes, 8, 'AVI '))", 'if (false)', 'recognizes native containers', 'source-evidence.ts'],
  ['uploaded resource isolation', "if (supplied) options.protocol_whitelist ??= '';", '', 'blocks nested resources'],
  ['selected track', 'input.streams.find(stream => stream.index === settings.mediaSettings!.track)', 'input.findBestStream(av.AVMEDIA_TYPE_AUDIO)', 'preserves selected tracks'],
  ['compatible audio preservation', '[target, ...target.alternatives ?? []].find(compatible)', '[target].find(() => false)', 'copies compatible samples'],
  ['encoded size bound', 'end > fileLimit', 'false', 'finite provider limits'],
  ['decoded byte budget', 'let remaining = limit;', 'let remaining = Infinity;', 'bounds generated PCM'],
  ['encoder sample width', 'if (!codec) return av.avGetBytesPerSample', 'if (true) return av.avGetBytesPerSample', 'charges the native encoder sample width'],
  ['encoder channel count', 'av.pickSupportedLayout(frame.channelLayout, codec.channelLayouts).nbChannels', 'frame.channelLayout.nbChannels', 'charges the native encoder sample width'],
  ['raw sample count before dispatch', 'if (selected.duration > 0n &&', 'if (false &&', 'checks exact sample counts'],
  ['duration with codec padding', "input.formatName === 'flac' ||", "input.formatName === 'ogg' || input.formatName === 'flac' ||", 'checks exact sample counts'],
  ['timestamp-only WebM copy', "copy && selected.format !== 'webm'", 'copy', 'sends WebM with unchanged'],
  ['unlabelable file target', 'if (!Object.hasOwn(preparedAudioTypes, target.format))', 'if (false)', 'rejects an unrecognized prepared file', 'preparation.ts'],
  ['duration bound including codec padding', 'seconds > target.maxDurationSeconds', 'false', 'finite provider limits'],
  ['packet duration bound including codec padding', 'checkDuration(Number(durationTicks) * timeBase.num / timeBase.den);', '', 'finite provider limits'],
  ['exact duration limit', 'seconds > target.maxDurationSeconds', 'seconds >= target.maxDurationSeconds', 'accepts exact duration limits'],
  ['prepared file identification', 'if (!mediaType || detected !== mediaType)', 'if (false)', 'rejects an unrecognized prepared file|rejects a wrong prepared-file MIME', 'input.ts'],
  ['native encoder EOF drain', 'if (!frame) { yield frame; continue; }', 'if (!frame) continue;', 'copies compatible samples'],
  ['decoded interior pause', 'start - end > (aligned ? 0n : rounding))', 'false)', 'preserves the position and duration of an interior pause'],
  ['decoded clock rounding', 'start - end > (aligned ? 0n : rounding))', 'start > end)', 'coarse ASF and Matroska'],
  ['exact coarse tick duration', 'samples > 0 && (samples * stream.timeBase.den)', 'false && (samples * stream.timeBase.den)', 'one clock tick'],
  ['copied clock rounding', 'position - end > (codecSamples ? 0n : rounding)', 'position > end', 'coarse ASF and Matroska'],
  ['contiguous encoder samples', 'frame.pts = outputPosition;', 'frame.pts = start ?? outputPosition;', 'RealMedia packet timestamps'],
  ['large MP3 input blocks', "if (codecName === 'mp3')", 'if (false)', 'large WavPack and TTA'],
  ['large Vorbis input blocks', "if (codecName === 'vorbis')", 'if (false)', 'complete Vorbis conversion'],
  ['Vorbis window transition', 'packet.pos === page', 'false', 'complete Vorbis conversion'],
  ['missing encoder packets', 'encodedSamples < Math.round(decodedSeconds * actual.sampleRate)', 'false', 'encoder that drops packets'],
  ['speech corpus upload evidence', "return 'audio/x-nist';", 'return undefined;', 'decodes AMR, SPHERE', 'source-evidence.ts'],
  ['copied interior pause', "const checkCopyTiming = copy &&", "const checkCopyTiming = false &&", 'preserves the position and duration of an interior pause'],
  ['stereo PCM pause stride', 'const stride = stream.codecpar.channels * (packed ?', 'const stride = (packed ?', 'preserves both channels across a pause'],
  ['rejected frame ownership', 'try { checkDuration(decodedSeconds); } catch (error) { frame[Symbol.dispose](); throw error; }',
    'checkDuration(decodedSeconds);', 'releases decoded frames'],
  ['stream cancellation ownership', 'cancel: close,', '', 'closes abandoned and cancelled handles', 'native.ts'],
  ['pending native HTTP cancellation', 'abort.abort();', '', 'interrupts a pending native HTTP read', 'native-worker.entry.ts'],
  ['source cancellation reason', 'await closeSource(reason).catch', 'await closeSource().catch', 'closes abandoned and cancelled handles', 'native.ts'],
  ['cancellation before file delivery', 'await finished;\n\t\tsettings.abortSignal?.throwIfAborted();', 'await finished;', 'honors an abort between the native file result', 'native.ts'],
  ['source demuxer precedence', 'if (settings.sourceFormat && !format) {', 'if (settings.sourceFormat) {', 'uses encoded MIME|invalid settings'],
  ['stream header classification', 'if (!audioContainer(pending)) applyRawLayout();', 'applyRawLayout();', 'classifies self-describing uploads'],
  ['finite header classification', ' && !audioContainer(source))', ')', 'classifies self-describing uploads'],
  ['retained stream prefix', 'pending = prefix.subarray(0, length);', 'pending = new Uint8Array(0);', 'classifies self-describing uploads'],
  ['encoded upload MIME', 'settings.sourceFormat && !encodedAudioType(declared)', 'settings.sourceFormat', 'uses encoded MIME'],
  ['raw Blob layout', "if (declared === 'audio/pcm') checkMimeLayout", 'if (false) checkMimeLayout', 'checks headerless PCM Blob'],
  ['companded Blob routing', 'if (demuxer) {', 'if (false) {', 'checks headerless PCM Blob'],
  ['empty upload cancellation', 'if (!buffer.length) {', 'while (!buffer.length) {', 'can abort a native upload', 'native.ts'],
  ['uploaded stream handoff', 'claimLiveInput(source);', '', 'rejects reused uploaded streams', 'native.ts'],
  ['raw frame layout validation', 'frame.channelLayout.nbChannels !== 1', 'false', 'rejects changing raw frame layouts'],
  ['pre-adoption native I/O disposal', 'await io?.[Symbol.asyncDispose]();', '', 'disposes native custom I/O'],
  ['native worker reuse', 'previous.filename === filename', 'false', 'reuses a cleaned native worker', 'native.ts'],
  ['native idle cache bound', 'if (idle) return false;', '', 'runs simultaneous native pipelines', 'native.ts'],
  ['native idle expiry', 'worker.postMessage(null); }, 5000)', 'worker.postMessage(null); }, 60000)', 'expires the idle native worker', 'native.ts'],
  ['native idle worker reference', 'timer.unref(); worker.unref();', 'timer.unref();', 'does not keep Node alive', 'native.ts'],
  ['native idle timer reference', 'timer.unref(); worker.unref();', 'worker.unref();', 'does not keep Node alive', 'native.ts'],
  ['native cancellation reuse', 'closed || settings.abortSignal?.aborted || workerFailure || exited || !keepWorker', 'exited || !keepWorker', 'discards cancelled and failed workers', 'native.ts'],
];
const selected = mutations.filter(([name]) => new RegExp(process.argv[2] ?? '').test(name));
assert(selected.length > 0, 'No matching native mutations.');
function run(pattern, mutated = false, invert = false) {
  const generated = spawnSync(process.execPath, ['scripts/build-audio-workers.mjs'], { cwd: temporary, encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stdout + generated.stderr);
  const result = spawnSync(process.execPath, [path.join(workspace, 'node_modules/mocha/bin/mocha.js'), '--no-config',
    '--node-option', 'import=tsx/esm', '--node-option', 'conditions=casai-source', '--reporter', 'dot',
    'tests/NativeAudio.integration.test.ts', '--grep', pattern, invert ? '--invert' : '--fail-zero'], { cwd: temporary, encoding: 'utf8', timeout: 60000 });
  const output = result.stdout + result.stderr;
  assert.equal(result.error, undefined, output);
  if (mutated) { assert.notEqual(result.status, 0, output); assert.match(output, /\d+ failing/, output); }
  else assert.equal(result.status, 0, output);
}
try {
  fs.cpSync(path.join(workspace, 'src'), path.join(temporary, 'src'), { recursive: true });
  fs.copyFileSync(path.join(workspace, 'package.json'), path.join(temporary, 'package.json'));
  for (const file of ['scripts/build-audio-workers.mjs', 'tests/NativeAudio.integration.test.ts', 'tests/fixtures/native-audio-media.mjs']) {
    fs.mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true });
    fs.copyFileSync(path.join(workspace, file), path.join(temporary, file));
  }
  // Check related controls in small groups under the same 60-second process watchdog as each fault.
  const controls = [...new Set(selected.map(([, , , pattern]) => pattern))];
  for (let start = 0; start < controls.length; start += 8) run(controls.slice(start, start + 8).join('|'));
  if (!process.argv[2]) run(controls.join('|'), false, true); // Also cover every test without a mutation.
  for (const [name, before, after, pattern, file = 'native-pipeline.ts'] of selected) {
    const filename = path.join(temporary, 'src/audio', file);
    const original = fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n');
    assert.equal(original.split(before).length, 2, name);
    try { fs.writeFileSync(filename, original.replace(before, after)); run(pattern, true); }
    finally { fs.writeFileSync(filename, original); }
    console.log('Caught native audio mutation: ' + name);
  }
} finally {
  assert.equal(path.dirname(temporary), workspace);
  assert.ok(path.basename(temporary).startsWith('.phase6-native-mutations-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
