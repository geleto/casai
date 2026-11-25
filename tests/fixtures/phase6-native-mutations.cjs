// Native security/lifetime mutations run against an isolated source copy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(workspace, '.phase6-native-mutations-'));
const mutations = [
  ['edited movie conversion', 'const copy = editedMovie ? undefined :', 'const copy = false ? undefined :', 'applies movie playback edits'],
  ['discarded movie packets', 'if (packet && !(previous.flags & av.AV_PKT_FLAG_DISCARD)', 'if (false && !(previous.flags & av.AV_PKT_FLAG_DISCARD)', 'applies movie playback edits'],
  ['movie playback endpoint', 'if (available < frame.nbSamples)', 'if (false)', 'applies movie playback edits'],
  ['movie decoder skip timing', 'context: movie ? { threadCount: 1 } : undefined, resample: {\n', 'resample: {\n', 'applies movie playback edits'],
  ['playlist upload evidence', "return 'ffconcat';", 'return undefined;', 'applies native playlist opening', 'source-evidence.ts'],
  ['transport-stream upload evidence', "return 'video/mp2t';", 'return undefined;', 'dispatches decoded transport streams', 'source-evidence.ts'],
  ['untagged audio frame evidence', 'return framedAudio(bytes);', 'return undefined;', 'distinguishes untagged MP3', 'source-evidence.ts'],
  ['rounded native pre-skip', 'observed === ticks(-preSkip)', 'false', 'copies continuous Opus across', 'native-ogg-webm.ts'],
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
  ['Vorbis window transition', 'packet.pos === page', 'false', 'complete Vorbis conversion', 'native-ogg-webm.ts'],
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
const reviewMutations = [
  ['indexed PCM edit conversion and copy guard', 'const moviePcm = movie &&', 'const moviePcm = false &&', 'indexed PCM movie edit'],
  ['fragmented selected-track edit admission', "type === 'mvex'", "type === 'skip'", 'unverifiable fragmented movie edits', 'movie-header.ts'],
  ['unselected movie track seeks', 'other.discard = av.AVDISCARD_ALL', 'other.discard = 0', 'unverifiable fragmented movie edits'],
  ['MXF header partition', "return 'application/mxf';", 'return undefined;', 'MXF header partition', 'source-evidence.ts'],
  ['movie path edit verification', "const movie = formats.includes('mov');", "const movie = typeof source !== 'string' && formats.includes('mov');", 'movie paths and URLs'],
  ['automatic movie path selection', 'if (isMovieResource(av, source, format))', 'if (format && isMovieResource(av, source, format))', 'movie paths and URLs'],
  ['movie cursor after EOF', 'if (requested !== nextPacket)', 'if (offset !== start + block.length)', 'resumes at the next block after probing EOF', 'movie-resource.ts'],
  ['unknown-length movie index scan', "options.fflags = String(options.fflags ?? '') + '+ignidx';", '', 'fragmented HTTP response body'],
  ['padded movie evidence', 'offset += size;', 'break;', 'file type box following a free box', 'source-evidence.ts'],
  ['generated silence byte bound', 'checkPreparedAudioBytes(bytes, pcmBytesLeft);', '', 'larger file limit'],
  ['cumulative silence budget', 'pcmBytesLeft -= await writePcmPause', 'await writePcmPause', 'larger file limit'],
  ['incremental input release', 'if (!observed &&', 'if (false &&', 'drained incremental result', 'input.ts'],
  ['early warning settlement', 'target.durationInSeconds', '(target as unknown as { warnings: Promise<unknown> }).warnings', 'reading early warnings', 'input.ts'],
  ['validation before source execution', 'validateSettings?.(settings);', '', 'settings error precedes', '../runtime/component-call.ts'],
  ['empty movie edit', 'if (movie && selected.nbFrames > 0n && selected.duration === 0n)', 'if (false)', 'empty edit and a nonempty edit'],
  ['HTTP forward seek without ranges', 'packet.pos > requested', 'packet.pos !== requested', 'server ignores ranges', 'movie-resource.ts'],
  ['PCM layout before script execution', 'if (settings.sourceFormat !== undefined) validatePcmLayout', 'if (false) validatePcmLayout', 'settings error precedes', 'input.ts'],
  ...(process.env.CASAI_REVIEW_FFMPEG ? [
    ['empty leading edit endpoint', 'if (edit.empty)', 'if (false)', 'leading empty edit ends'],
    ['AAC copy initial trim', 'const copiedSkip = skip &&', 'const copiedSkip = false &&', 'AAC skip spanning'],
    ['fragmented AAC declared end', 'bounds.verifyEnd = end + (bounds.fragmentPriming ?? 0n);', 'bounds.verifyEnd = stream.duration;', 'fragmented AAC priming'],
    ['Safari AAC copy origin', 'if (copy && fragmentOrigin)', 'if (false && copy && fragmentOrigin)', 'Safari recorder'],
    ['Safari WAV duration origin', '- (bounds.fragmentPriming ?? 0n) - fragmentOrigin;', '- (bounds.fragmentPriming ?? 0n);', 'Safari recorder'],
    ['recorder clock catch-up', 'if (bounds.unedited &&', 'if (false &&', 'Chrome recorder fragment joins'],
    ['Opus recorder covered interval', 'place(packet, delta > 0n ? delta : 0n);', 'place(packet, delta);', 'Chrome Opus recorder clocks', 'native-ogg-webm.ts'],
    ['Opus pause after codec priming', 'av.avRescaleQ(delay, clock, opusTime);', 'av.avRescaleQ(delay, clock, opusTime) + (delay ? 24n : 0n);', 'a primed WebM Opus', 'native-ogg-webm.ts'],
    ['Ogg copy end granule', 'copy ? samples - tail : samples', 'samples', 'a prepared WebM copy', 'native-ogg-webm.ts'],
    ['Ogg copy interior trim', 'copy && (trimmedEnd || head', 'copy && (head', 'a prepared WebM copy', 'native-ogg-webm.ts'],
    ['Ogg link pre-skip', 'offset = end - BigInt(head) - packet.pts;', 'offset = end - packet.pts;', 'chained Ogg Opus joins', 'native-ogg-webm.ts'],
    ['Ogg link copy guard', 'if (!decoder) {', 'if (false) {', 'chained Ogg Opus joins', 'native-ogg-webm.ts'],
    ['Ogg Opus decoder restart', 'decoder.getCodecContext()!.flushBuffers();', '', 'chained Ogg Opus joins', 'native-ogg-webm.ts'],
    ['Ogg Opus gain change', '!header.subarray(16).equals(current.subarray(16))', 'false', 'chained Ogg Opus joins', 'native-ogg-webm.ts'],
    ['Ogg header read-ahead', 'covered >= headerReadAt', 'true', 'a short Ogg middle link', 'native-ogg-webm.ts'],
    ['inclusive playable duration', "(copy || sourceCodec !== 'opus')", 'true', 'an inclusive Opus-to-WAV'],
    ['prepared stream metadata', 'copiedStream.metadata = null;', '', 'prepared Vorbis files omit'],
    ['Vorbis codec header comments', 'copiedStream.codecpar.extradata = vorbisHeaders;', 'void vorbisHeaders;', 'prepared Vorbis files omit'],
    ['later Ogg source metadata', 'oggComments && packet.getSideData', 'false && packet.getSideData', 'a later Ogg section'],
    ['Ogg FLAC section restart', 'packet.addSideData(av.AV_PKT_DATA_STRINGS_METADATA, Buffer.alloc(0))', '(packet.freeSideData(), 0)', 'a later Ogg section'],
    ['later Vorbis decoder headers', 'if (packet?.getSideData(av.AV_PKT_DATA_NEW_EXTRADATA))', 'if (false)', 'a later Ogg section', 'native-ogg-webm.ts'],
    ['streamed movie index size', 'const next = offset + size;', "if (type === 'moov' && size > movieHeaderBudget) return unverifiableMovie(); const next = offset + size;", 'four-minute fast-start', 'movie-header.ts'],
  ] : []),
];
const selected = [...mutations, ...reviewMutations].filter(([name]) => new RegExp(process.argv[2] ?? '').test(name));
assert(selected.length > 0, 'No matching native mutations.');
function run(pattern, mutated = false, invert = false, review = false) {
  const generated = spawnSync(process.execPath, ['scripts/build-audio-workers.mjs'], { cwd: temporary, encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stdout + generated.stderr);
  const args = review ? ['--import', 'tsx/esm', '--conditions=casai-source', '--test', '--test-reporter=tap',
    '--test-name-pattern', pattern, 'tests/fixtures/phase6-ab-evaluation.mjs'] : [path.join(workspace, 'node_modules/mocha/bin/mocha.js'), '--no-config',
    '--node-option', 'import=tsx/esm', '--node-option', 'conditions=casai-source', '--reporter', 'dot',
    'tests/NativeAudio.integration.test.ts', '--grep', pattern, invert ? '--invert' : '--fail-zero'];
  const result = spawnSync(process.execPath, args, { cwd: temporary, encoding: 'utf8', timeout: 60000 });
  const output = result.stdout + result.stderr;
  assert.equal(result.error, undefined, output);
  if (mutated) { assert.notEqual(result.status, 0, output); assert.match(output, review ? /^not ok /m : /\d+ failing/, output); }
  else assert.equal(result.status, 0, output);
}
try {
  fs.cpSync(path.join(workspace, 'src'), path.join(temporary, 'src'), { recursive: true });
  fs.copyFileSync(path.join(workspace, 'package.json'), path.join(temporary, 'package.json'));
  for (const file of ['scripts/build-audio-workers.mjs', 'tests/NativeAudio.integration.test.ts', 'tests/fixtures/native-audio-media.mjs', 'tests/fixtures/phase6-ab-evaluation.mjs', 'tests/fixtures/review-indexed.mov', 'tests/fixtures/review-fragmented.mov', 'tests/fixtures/review-hybrid.mov', 'tests/fixtures/review-chrome-aac.mp4', 'tests/fixtures/review-safari-aac.mp4', 'tests/fixtures/review-chrome-opus.webm', 'tests/fixtures/review-chrome-opus-trimmed.webm', 'tests/fixtures/review-firefox-opus.ogg', 'tests/fixtures/review-chained-opus.ogg', 'tests/fixtures/review-vorbis-comments.webm']) {
    fs.mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true });
    fs.copyFileSync(path.join(workspace, file), path.join(temporary, file));
  }
  // Check related controls in small groups under the same 60-second process watchdog as each fault.
  const controls = [...new Set(selected.filter(m => mutations.includes(m)).map(m => m[3]))];
  const reviewControls = [...new Set(selected.filter(m => reviewMutations.includes(m)).map(m => m[3]))];
  for (let start = 0; start < reviewControls.length; start += 2) run(reviewControls.slice(start, start + 2).join('|'), false, false, true);
  for (let start = 0; start < controls.length; start += 8) run(controls.slice(start, start + 8).join('|'));
  if (!process.argv[2]) run(controls.join('|'), false, true); // Also cover every test without a mutation.
  for (const mutation of selected) {
    const [name, before, after, pattern, file = 'native-pipeline.ts'] = mutation;
    const filename = path.join(temporary, 'src/audio', file);
    const original = fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n');
    assert.equal(original.split(before).length, 2, name);
    try { fs.writeFileSync(filename, original.replace(before, after)); run(pattern, true, false, reviewMutations.includes(mutation)); }
    finally { fs.writeFileSync(filename, original); }
    console.log('Caught native audio mutation: ' + name);
  }
} finally {
  assert.equal(path.dirname(temporary), workspace);
  assert.ok(path.basename(temporary).startsWith('.phase6-native-mutations-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
