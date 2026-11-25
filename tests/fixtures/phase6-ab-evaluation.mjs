// Explicit review regressions. CASAI_REVIEW_FFMPEG selects an independent decoder for the movie copy.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Experimental_MockSpeechTranslationModelV4, MockTranscriptionModelV4, convertArrayToReadableStream } from 'ai/test';
import { Transcriber, Translator } from 'casai';
import * as av from 'node-av';
import { openMovieResource } from '../../src/audio/movie-resource.js';
import { createAudioFile, createPausedPcm, decodeMonoPcm, editMovie, readAudioPackets } from './native-audio-media.mjs';

const rate = 48000;
const target = { type: 'audio/pcm', rate };
const sourceFormat = { sampleRate: rate, channels: 1, encoding: 'pcm_s16le' };
const transcript = { text: 'heard', segments: [] };
const referenceFfmpeg = process.env.CASAI_REVIEW_FFMPEG;
let directory, movie;
const samples = Int16Array.from({ length: 2 * rate }, (_, i) =>
  Math.round(i < 62400 ? 13000 * Math.sin(i * 0.044) : 20000 * Math.sin(i * 0.32)));
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'casai-ab-evaluation-'));
  movie = await createAudioFile(join(directory, 'tones.m4a'), new Uint8Array(samples.buffer), { codec: 'alac' });
});
after(async () => {
  for (const name of ['tones.m4a', 'ordinary.mov', 'ordinary.mp4', 'ordinary.m4a', 'renamed.mov', 'seek.mov', 'video.mp4', 'aac.m4a', 'short.m4a', 'fragmented.m4a', 'pause.mka', 'edited.m4a', 'delivered.m4a', 'twice.mka', 'audio.mxf', 'interleaved.mov', 'chunked.mov', 'large-index.mp4', 'forward.mov', 'skip.m4a']) {
    await unlink(join(directory, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  await rmdir(directory);
});

function capture() {
  const requests = [];
  let calls = 0;
  const model = new MockTranscriptionModelV4({
    doStream: async ({ audio }) => {
      calls++;
      const parts = [];
      for await (const part of audio) parts.push(part);
      requests.push(Buffer.concat(parts));
      return { stream: convertArrayToReadableStream([{ type: 'finish', ...transcript }]) };
    },
    doGenerate: async ({ audio }) => {
      calls++;
      requests.push(typeof audio === 'string' ? Buffer.from(audio, 'base64') : Buffer.from(audio));
      return { ...transcript, warnings: [], response: { timestamp: new Date(0), modelId: 'review' } };
    },
  });
  return { model, requests, get calls() { return calls; } };
}

// FFmpeg 9.0.2 muxed two generated mono tracks. Bento4 mp4edit 1.6.0-641 authored
// a version-one edit on track ID 2. Each track and each kept/removed section differs.
function authoredTrack(track) {
  return Buffer.from(Int16Array.from({ length: 8192 }, (_, i) =>
    [[1000, -5000], [-2600, 7200], [3900, -8100], [-8200, 3700]][Math.floor(i / 2048)][track] + i % 31).buffer);
}
function splitRecording(bytes, chunkSize = 113) {
  let offset = 0;
  return new ReadableStream({ pull(controller) {
    if (offset === bytes.length) { controller.close(); return; }
    const size = offset < 128 ? 3 : chunkSize;
    const part = bytes.subarray(offset, offset + size);
    offset += part.length;
    controller.enqueue(part);
  } }, { highWaterMark: 0 });
}

async function referencePcm(bytes, ...options) {
  const path = join(directory, 'delivered.m4a');
  await writeFile(path, bytes);
  return execFileSync(referenceFfmpeg, ['-v', 'error', '-i', path, ...options, '-f', 's16le', 'pipe:1']);
}

function comparePcm(actual, expected, tolerance) {
  assert.equal(actual.length, expected.length, 'PCM sample count');
  for (let i = 0; i < actual.length; i += 2) {
    const value = actual.readInt16LE(i), reference = expected.readInt16LE(i);
    assert.ok(Math.abs(value - reference) <= tolerance, `sample ${i / 2}: ${value} vs ${reference}`);
  }
}

test('a leading empty edit ends on the authored sample before resampling and encoding', { skip: !referenceFfmpeg }, async () => {
  const edited = editMovie(movie, [[null, 60], [0, 1300]]);
  const kept = Buffer.from(samples.buffer, 0, 62400 * 2);
  const { model, requests } = capture();
  for (const settings of [{ inputAudioFormat: target }, { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le', maxDurationSeconds: 1.3 } },
    { fileAudioTarget: { format: 'mp4', codec: 'alac' } }]) {
    await Transcriber.loadsAudio({ model, ...settings })(edited);
    const pcm = settings.fileAudioTarget ? await referencePcm(requests.at(-1)) : requests.at(-1);
    assert.ok(pcm.subarray(0, kept.length).equals(kept));
    if (settings.fileAudioTarget?.codec === 'alac') assert.ok(pcm.subarray(kept.length).every(byte => byte === 0));
    else assert.equal(pcm.length, kept.length);
  }
  await Transcriber.loadsAudio({ model, inputAudioFormat: { type: 'audio/pcm', rate: 16000 } })(edited);
  const resampled = execFileSync(referenceFfmpeg, ['-v', 'error', '-f', 's16le', '-ar', '48000', '-ac', '1', '-i', 'pipe:0',
    '-ar', '16000', '-f', 's16le', 'pipe:1'], { input: kept });
  assert.equal(requests.at(-1).length, resampled.length);
  for (let i = 0; i < resampled.length; i += 2) assert.ok(Math.abs(resampled.readInt16LE(i) - requests.at(-1).readInt16LE(i)) <= 1);
});

test('an AAC skip spanning two packets copies exactly in M4A and selects the WAV primary over ADTS', { skip: !referenceFfmpeg }, async () => {
  const path = join(directory, 'skip.m4a');
  execFileSync(referenceFfmpeg, ['-v', 'error', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0',
    '-c:a', 'aac', '-movie_timescale', String(rate), path], { input: Buffer.from(samples.buffer) });
  const edited = editMovie(await readFile(path), [[10, 1994]]);
  const expected = await referencePcm(edited);
  assert.equal(expected.length / 2, 95232);
  const native = Buffer.from(await decodeMonoPcm(edited)).subarray(0, expected.length);
  const { model, requests } = capture();
  for (const fileAudioTarget of [{ format: 'ipod', codec: 'aac' },
    { format: 'wav', codec: 'pcm_s16le', alternatives: [{ format: 'adts', codec: 'aac' }] }]) {
    await Transcriber.loadsAudio({ model, fileAudioTarget })(edited);
    if (fileAudioTarget.format === 'wav') assert.equal(requests.at(-1).toString('ascii', 0, 4), 'RIFF');
    const actual = await referencePcm(requests.at(-1));
    if (fileAudioTarget.format === 'wav') {
      // Separate FFmpeg builds can round float AAC to adjacent PCM16 integers on ARM.
      comparePcm(actual, native, 0);
      comparePcm(actual, expected, 1);
    } else comparePcm(actual, expected, 0);
  }
});

test('fragmented AAC priming checks the first packet and the independently authored end', { skip: !referenceFfmpeg }, async () => {
  const original = execFileSync(referenceFfmpeg, ['-v', 'error', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0',
    '-c:a', 'aac', '-movie_timescale', String(rate), '-movflags', '+delay_moov+default_base_moof+skip_trailer',
    '-frag_duration', '200000', '-f', 'mp4', 'pipe:1'], { input: Buffer.from(samples.buffer) });
  const elst = original.indexOf('elst');
  assert.ok(elst > 0);
  assert.equal(original[elst + 4], 0);
  assert.equal(original.readUInt32BE(elst + 16), 1024);
  const received = capture(), { model, requests } = received;
  const transcribe = Transcriber.loadsAudio({ model, inputAudioFormat: target });
  const expected = (await referencePcm(original)).subarray(0, samples.byteLength);
  const native = Buffer.from(await decodeMonoPcm(original)).subarray(0, samples.byteLength);
  for (const duration of [0, samples.length, rate]) {
    const bytes = Buffer.from(original);
    bytes.writeUInt32BE(duration, elst + 12);
    if (duration === rate) {
      // Both headers report exactly the same skip. Native playback ignores this shorter end.
      assert.ok((await referencePcm(bytes)).length >= samples.byteLength);
      const calls = received.calls;
      await assert.rejects(transcribe(bytes), /movie playback edits/);
      assert.equal(received.calls, calls);
      continue;
    }
    for (const audio of [bytes, splitRecording(bytes, 4093)]) {
      await transcribe(audio);
      comparePcm(requests.at(-1), native, 0);
      comparePcm(requests.at(-1), expected, 1);
    }
    await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'mp4', codec: 'aac' } })(bytes);
    assert.ok((await referencePcm(requests.at(-1))).subarray(0, expected.length).equals(expected));
  }
  assert.equal(requests.length, 6);
});

test('Safari recorder preserves both tones across its multi-packet AAC priming edit', { skip: !referenceFfmpeg }, async () => {
  const path = fileURLToPath(new URL('review-safari-aac.mp4', import.meta.url));
  const bytes = await readFile(path);
  const expected = await referencePcm(bytes, '-ac', '1');
  assert.equal(expected.length / 2, 78784);
  // Safari 27.2 recorded 523 Hz, then 997 Hz, using Web Audio at 48 kHz.
  for (const [start, frequency] of [[12000, 523], [48000, 997]]) {
    let crossings = 0;
    for (let i = start; i < start + rate / 4; i++) {
      if (expected.readInt16LE(2 * i) <= 0 && expected.readInt16LE(2 * i + 2) > 0) crossings++;
    }
    assert.ok(Math.abs(crossings * 4 - frequency) <= 4);
  }
  const { model, requests } = capture();
  const raw = Transcriber.loadsAudio({ model, inputAudioFormat: target, sourceFormat: { ...sourceFormat, sampleRate: 8000 } });
  for (const input of [path, bytes, new Blob([bytes]), splitRecording(bytes, 251)]) await raw(input);
  // WAV stores playable samples. The AAC copy also stores its 2,112 priming samples.
  for (const [profile, stored] of [[{ format: 'wav', codec: 'pcm_s16le' }, 78784], [{ format: 'ipod', codec: 'aac' }, 80896]]) {
    const prepare = count => Transcriber.loadsAudio({ model, fileAudioTarget: { ...profile, maxDurationSeconds: count / rate } })(bytes);
    await prepare(stored);
    requests.push(await referencePcm(requests.pop(), '-ac', '1'));
    await assert.rejects(prepare(stored - 1), /maxDurationSeconds/);
  }
  assert.equal(requests.length, 6);
  for (const pcm of requests) {
    comparePcm(pcm, expected, 2);
  }
});

test('Chrome recorder fragment joins preserve continuous samples and a real timestamped pause', { skip: !referenceFfmpeg }, async () => {
  // Chrome 158 MediaRecorder encoded a continuous Web Audio oscillator, 440 Hz then 1,400 Hz.
  const original = await readFile(new URL('review-chrome-aac.mp4', import.meta.url));
  const decoded = await referencePcm(original, '-ac', '1');
  assert.equal(decoded.length / 2, 63488);
  const kept = decoded.subarray(0, 63469 * 2); // The final AAC frame extends 19 samples beyond the movie duration.
  const joinSample = 33792;
  for (const pause of [0, 480, 4800]) {
    const { model, requests } = capture();
    const transcribe = Transcriber.loadsAudio({ model, inputAudioFormat: target, sourceFormat });
    const bytes = Buffer.from(original);
    // Shift this and the following fragment clocks. The stored AAC packets stay identical.
    for (let i = bytes.indexOf('tfdt'); i >= 0; i = bytes.indexOf('tfdt', i + 4)) {
      assert.equal(bytes[i + 4], 1);
      const time = bytes.readBigUInt64BE(i + 8);
      if (time >= joinSample) bytes.writeBigUInt64BE(time + BigInt(pause), i + 8);
    }
    const expected = Buffer.concat([kept.subarray(0, joinSample * 2), Buffer.alloc(pause * 2), kept.subarray(joinSample * 2)]);
    for (const audio of [bytes, new Blob([bytes]), splitRecording(bytes, 1777)]) await transcribe(audio);
    await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } })(bytes);
    const converted = await referencePcm(requests.pop(), '-ac', '1');
    for (const pcm of [...requests, converted]) {
      comparePcm(pcm, expected, 2);
    }
  }
});

test('a prepared WebM copy preserves the last block trim in both recorded channels', { skip: !referenceFfmpeg }, async () => {
  const original = await readFile(new URL('./review-chrome-opus.webm', import.meta.url));
  const trimmed = await readFile(new URL('./review-chrome-opus-trimmed.webm', import.meta.url));
  const pcm = await referencePcm(original);
  const frameBytes = 4; // Stereo PCM16 at 48 kHz.
  assert.equal(pcm.length, 46080 * frameBytes);
  const { model, requests } = capture();
  const transcribe = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'webm', codec: 'libopus' } });
  for (const [recording, frames] of [[original, 46080], [trimmed, 45840]]) {
    const expected = pcm.subarray(0, frames * frameBytes);
    assert.ok((await referencePcm(recording)).equals(expected));
    for (const input of [new Blob([recording]), splitRecording(recording)]) {
      await transcribe(input);
      assert.equal(requests.length, 1);
      assert.ok((await referencePcm(requests.pop())).equals(expected), `Provider copy must play the first ${frames} stereo frames.`);
    }
  }
});

test('Firefox recorder end trim reaches the provider on raw and WAV delivery', { skip: !referenceFfmpeg }, async () => {
  const original = await readFile(new URL('review-firefox-opus.ogg', import.meta.url));
  const lastPage = original.lastIndexOf('OggS');
  assert.ok(lastPage >= 0 && original[lastPage + 5] === 4);
  assert.equal(original.readBigUInt64LE(lastPage + 6), 64696n);
  assert.equal(original.readUInt32LE(lastPage + 22), 0x19981080);
  // These are the final granule and its page checksum for the same packets cut 240 samples earlier.
  const shorter = Buffer.from(original);
  shorter.writeBigUInt64LE(64456n, lastPage + 6);
  shorter.writeUInt32LE(0xfe20860c, lastPage + 22);
  const { model, requests } = capture();
  const raw = Transcriber.loadsAudio({ model, inputAudioFormat: target });
  const wav = Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } });
  for (const [bytes, frames] of [[original, 64384], [shorter, 64144]]) {
    const expected = await referencePcm(bytes, '-ac', '1');
    assert.equal(expected.length, 2 * frames);
    for (const input of [() => bytes, () => new Blob([bytes]), () => splitRecording(bytes, 421)]) {
      await raw(input());
      comparePcm(requests.pop(), expected, 2);
      await wav(input());
      comparePcm(await referencePcm(requests.pop(), '-ac', '1'), expected, 2);
    }
  }
});

test('a four-minute fast-start video streams a selected track beyond a large video index', { skip: !referenceFfmpeg }, async () => {
  const path = join(directory, 'large-index.mp4');
  execFileSync(referenceFfmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'color=s=16x16:r=60:d=240', '-f', 'lavfi', '-i',
    'anullsrc=r=48000:cl=mono:d=240', '-f', 'lavfi', '-i', 'sine=r=8000:d=0.5', '-map', '0:v', '-map', '1:a',
    '-map', '2:a', '-c:v', 'mpeg4', '-bf', '2', '-c:a:0', 'aac', '-c:a:1', 'alac', '-movflags', '+faststart', path]);
  const bytes = await readFile(path);
  assert.ok(bytes.readUInt32BE(bytes.indexOf('moov') - 4) > 256 * 1024);
  const expected = await referencePcm(bytes, '-map', '0:2'), { model, requests } = capture();
  assert.equal(expected.length, 8000);
  const transcribe = Transcriber.loadsAudio({ model, sourceFormat, inputAudioFormat: { type: 'audio/pcm', rate: 8000 }, mediaSettings: { track: 2 } });
  for (const audio of [bytes, new Blob([bytes]), splitRecording(bytes, 8191)]) await transcribe(audio);
  assert.deepEqual(requests, [expected, expected, expected]);
});

test('an edited HTTP movie advances when the server ignores ranges', async () => {
  const pcm = Int16Array.from({ length: rate * 4 }, (_, i) => (Math.imul(i ^ (i >>> 5), 2654435761) >>> 16) - 32768);
  const bytes = await createAudioFile(join(directory, 'forward.mov'), new Uint8Array(pcm.buffer),
    { codec: 'alac', channels: 2, muxerOptions: { movflags: '+faststart', movie_timescale: rate } });
  const edit = bytes.indexOf('elst');
  assert.ok(edit > 0);
  bytes.writeUInt32BE(72000, edit + 12); bytes.writeInt32BE(333, edit + 16);
  assert.ok(bytes.length > 256 * 1024);
  let opens = 0;
  const server = createServer((_req, res) => {
    opens++;
    res.writeHead(200);
    let offset = 0;
    const send = () => {
      if (res.destroyed) return;
      if (offset >= bytes.length) { res.end(); return; }
      res.write(bytes.subarray(offset, offset += 7001));
      setImmediate(send);
    };
    send();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { model, requests } = capture(), transcribe = Transcriber.loadsAudio({ model, inputAudioFormat: target });
    await transcribe(bytes);
    const url = `http://127.0.0.1:${server.address().port}/edited.mov`;
    await transcribe(url);
    assert.equal(requests[0].length, 72000 * 2);
    assert.ok(requests[1].equals(requests[0]));
    assert.equal(opens, 1);
    // Demand a forward skip outside native read-ahead even when OS buffering varies.
    const reader = await openMovieResource(av, url, {});
    try {
      await reader.read(1024);
      reader.releaseHeader();
      reader.seek(270013n, av.AVSEEK_SET);
      const part = await reader.read(13);
      assert.ok(part?.length);
      assert.ok(part.equals(bytes.subarray(270013, 270013 + part.length)));
    } finally { await reader.input.close(); }
    assert.equal(opens, 2);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('an indexed PCM movie edit cannot restore skipped samples in a WAV copy', async () => {
  const recording = await readFile(new URL('review-indexed.mov', import.meta.url));
  const { model, requests } = capture();
  for (const track of [0, 1]) {
    const expected = authoredTrack(track).subarray(track ? 333 * 2 : 0);
    const settings = { model, mediaSettings: { track }, sourceFormat };
    await Transcriber.loadsAudio({ ...settings, inputAudioFormat: { type: 'audio/pcm', rate: 8000 } })(recording);
    assert.ok(requests.at(-1).equals(expected));
    await Transcriber.loadsAudio({ ...settings, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } })(recording);
    const file = requests.at(-1);
    assert.ok(Buffer.from(await decodeMonoPcm(file)).equals(expected));
    if (referenceFfmpeg) {
      const decoded = execFileSync(referenceFfmpeg, ['-v', 'error', '-i', 'pipe:0', '-f', 's16le', 'pipe:1'], { input: file });
      assert.ok(decoded.equals(expected));
    }
  }
  await assert.rejects(Transcriber.loadsAudio({ model, mediaSettings: { track: 1, options: { ignore_editlist: true } },
    inputAudioFormat: target })(recording), /verify.*playback edits/);
  assert.equal(requests.length, 4);
});

test('unverifiable fragmented movie edits reject only the selected track before dispatch', async () => {
  const received = capture();
  const { model, requests } = received;
  const inputAudioFormat = { type: 'audio/pcm', rate: 8000 };
  for (const filename of ['review-fragmented.mov', 'review-hybrid.mov']) {
    const bytes = await readFile(new URL(filename, import.meta.url));
    for (const make of [() => bytes, () => new Blob([bytes]), () => splitRecording(bytes)]) {
      await Transcriber.loadsAudio({ model, mediaSettings: { track: 0 }, sourceFormat, inputAudioFormat })(make());
      assert.ok(requests.at(-1).equals(authoredTrack(0)));
      for (const target of [{ inputAudioFormat }, { fileAudioTarget: { format: 'mp4', codec: 'alac' } }]) {
        const upload = make(), count = received.calls;
        await assert.rejects(Transcriber.loadsAudio({ model, mediaSettings: { track: 1 }, sourceFormat, ...target })(upload), /movie playback edits.*flattened/);
        assert.equal(received.calls, count);
        if (upload instanceof ReadableStream) assert.equal(upload.locked, false);
      }
    }
  }
  const pcm = authoredTrack(1);
  const plain = Transcriber.loadsAudio({ model, inputAudioFormat, sourceFormat: { ...sourceFormat, sampleRate: 8000 } });
  for (const audio of [pcm, new Blob([pcm]), splitRecording(pcm)]) {
    await plain(audio);
    assert.ok(requests.at(-1).equals(pcm));
  }
});

test('a fragment marker beyond the upload prefix still protects edited tracks', async () => {
  const original = await readFile(new URL('review-fragmented.mov', import.meta.url));
  const moov = original.indexOf('moov') - 4, mvex = original.indexOf('mvex') - 4;
  assert.ok(moov >= 0 && mvex > moov);
  // This fixture uses fragment-relative media offsets. A free box before mvex leaves every sample intact.
  const free = Buffer.alloc(300 * 1024);
  free.writeUInt32BE(free.length); free.write('free', 4);
  const bytes = Buffer.concat([original.subarray(0, mvex), free, original.subarray(mvex)]);
  bytes.writeUInt32BE(original.readUInt32BE(moov) + free.length, moov);
  const received = capture();
  const transcribe = Transcriber.loadsAudio({ model: received.model, sourceFormat, inputAudioFormat: { type: 'audio/pcm', rate: 8000 } });
  await transcribe.run({ audio: splitRecording(bytes, 4091), mediaSettings: { track: 0 } });
  assert.ok(received.requests[0].equals(authoredTrack(0)));
  await assert.rejects(transcribe.run({ audio: splitRecording(bytes, 4091), mediaSettings: { track: 1 } }), /movie playback edits/);
  assert.equal(received.calls, 1);
});

test('movie paths and URLs play ordinary recordings and reject unverifiable selected edits', async () => {
  const received = capture();
  const transcribe = Transcriber.loadsAudio({ model: received.model, inputAudioFormat: target });
  // Whole ALAC frames keep this comparison independent of the fixture encoder's padding.
  const pcm = Buffer.from(samples.buffer, 0, 23 * 4096 * 2);
  for (const name of ['ordinary.mov', 'ordinary.mp4', 'ordinary.m4a', 'renamed.mov']) {
    const path = join(directory, name);
    await createAudioFile(path, pcm, name === 'renamed.mov' ? { format: 'wav', codec: 'pcm_s16le' } : { codec: 'alac' });
    await transcribe(path);
    assert.ok(received.requests.at(-1).equals(pcm), name);
  }
  const file = new URL('review-hybrid.mov', import.meta.url);
  const bytes = await readFile(file);
  const trackRate = { type: 'audio/pcm', rate: 8000 };
  await transcribe.run({ audio: new URL('review-indexed.mov', import.meta.url), inputAudioFormat: trackRate, mediaSettings: { track: 1 } });
  assert.ok(received.requests.at(-1).equals(authoredTrack(1).subarray(333 * 2)));
  let opens = 0;
  const server = createServer((req, res) => {
    opens++;
    if (req.headers.authorization !== 'Bearer movie-test') { res.writeHead(401).end(); return; }
    res.writeHead(200, { 'Content-Length': bytes.length });
    res.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const format of [undefined, 'mov']) {
      const name = format ? 'download' : 'recording.MOV';
      const url = new URL(`http://127.0.0.1:${server.address().port}/${name}?token=example`);
      for (const audio of [file, fileURLToPath(file), url]) {
        const options = audio === url ? { headers: 'Authorization: Bearer movie-test\r\n' } : undefined;
        const run = track => transcribe.run({ audio, inputAudioFormat: trackRate, mediaSettings: { track, format, options } });
        await run(0);
        assert.ok(received.requests.at(-1).equals(authoredTrack(0)));
        const before = received.calls;
        await assert.rejects(run(1), /movie playback edits.*flattened/);
        assert.equal(received.calls, before);
      }
    }
    const before = received.calls;
    await assert.rejects(transcribe.run({ audio: `http://127.0.0.1:${server.address().port}/download`, inputAudioFormat: trackRate,
      mediaSettings: { track: 0, options: { headers: 'Authorization: Bearer movie-test\r\n' } } }), /mediaSettings.format to 'mov'/);
    assert.equal(received.calls, before);
    assert.equal(opens, 5);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('an MXF header partition takes precedence over a reusable raw layout', async () => {
  const original = Buffer.from(samples.buffer, 0, 5760 * 2);
  const recording = await createAudioFile(join(directory, 'audio.mxf'), original, { codec: 'pcm_s16le', format: 'mxf_opatom' });
  const { model, requests } = capture();
  const transcribe = Transcriber.loadsAudio({ model, inputAudioFormat: target, sourceFormat });
  for (const bytes of [recording, Buffer.concat([Buffer.alloc(61), recording])]) {
    for (const audio of [bytes, new Blob([bytes]), splitRecording(bytes)]) {
      await transcribe(audio);
      assert.ok(requests.at(-1).equals(original));
    }
  }
  assert.equal(requests.length, 6);
});

test('a movie URL preserves authenticated byte seeks and cancellation', { timeout: 20000 }, async () => {
  const pcm = Buffer.concat([Buffer.from(samples.buffer), Buffer.from(samples.buffer)]);
  const bytes = await createAudioFile(join(directory, 'seek.mov'), pcm, { codec: 'pcm_s16le' });
  assert.ok(bytes.indexOf(Buffer.from('moov')) > 256 * 1024);
  const ranges = [], stalled = Promise.withResolvers(), disconnected = Promise.withResolvers();
  const server = createServer((req, res) => {
    if (req.headers.authorization !== 'Bearer movie-test') { res.writeHead(401).end(); return; }
    if (req.url === '/stall.mov') {
      req.once('close', disconnected.resolve);
      stalled.resolve();
      return;
    }
    const start = Number(/^bytes=(\d+)-/.exec(req.headers.range ?? '')?.[1] ?? 0);
    ranges.push(start);
    res.writeHead(206, { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${bytes.length - 1}/${bytes.length}`, 'Content-Length': bytes.length - start });
    res.end(bytes.subarray(start));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const abort = new AbortController(), received = capture();
  try {
    const transcribe = Transcriber.loadsAudio({ model: received.model, inputAudioFormat: target,
      mediaSettings: { options: { headers: 'Authorization: Bearer movie-test\r\n' } } });
    await transcribe(url + '/seek.mov');
    assert.ok(received.requests[0].equals(pcm));
    assert.equal(ranges.filter(start => start === 0).length, 1);
    assert.ok(ranges.some(start => start > 0));
    const stopped = assert.rejects(transcribe.run({ audio: url + '/stall.mov', abortSignal: abort.signal }), /stopped/);
    await stalled.promise;
    abort.abort(new Error('stopped'));
    await stopped;
    await disconnected.promise;
    assert.equal(received.calls, 1);
  } finally {
    abort.abort();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('an MP4 video path supplies its AAC soundtrack to translation and file transcription', { skip: !referenceFfmpeg }, async () => {
  const path = join(directory, 'video.mp4');
  execFileSync(referenceFfmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'color=s=32x32:r=10:d=2',
    '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0', '-c:v', 'mpeg4', '-c:a', 'aac', '-shortest', path],
  { input: Buffer.from(samples.buffer) });
  const decode = (source, input) => execFileSync(referenceFfmpeg, ['-v', 'error', '-i', source, '-map', '0:a:0', '-f', 's16le', 'pipe:1'], { input });
  const expected = decode(path);
  const received = capture();
  const model = new Experimental_MockSpeechTranslationModelV4({ doStream: async ({ audio }) => {
    const chunks = [];
    for await (const chunk of audio) chunks.push(chunk);
    const delivered = Buffer.concat(chunks);
    // FFmpeg exposes up to one block of AAC tail padding. Compare the whole authored interval.
    assert.ok(delivered.length >= samples.byteLength && delivered.length <= expected.length);
    for (let i = 0; i < delivered.length; i += 2) assert.ok(Math.abs(delivered.readInt16LE(i) - expected.readInt16LE(i)) <= 1);
    return { stream: convertArrayToReadableStream([{ type: 'finish', sourceText: 'heard', outputText: 'traduit' }]) };
  } });
  await Translator.loadsAudio({ model, targetLanguage: 'fr', inputAudioFormat: target })(path);
  await Transcriber.loadsAudio({ model: received.model, fileAudioTarget: { format: 'mp4', codec: 'aac' } })(path);
  assert.equal(received.calls, 1);
  assert.ok(decode('pipe:0', received.requests[0]).equals(expected));
});

test('an interleaved MOV path and upload deliver the entire selected track', { skip: !referenceFfmpeg }, async () => {
  const path = join(directory, 'interleaved.mov'), original = Buffer.from(samples.buffer);
  execFileSync(referenceFfmpeg, ['-v', 'error', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0',
    '-map', '0:a', '-map', '0:a', '-filter:a:0', 'volume=0.5', '-c:a', 'alac', '-movflags', '+faststart', path], { input: original });
  const { model, requests } = capture();
  const transcribe = Transcriber.loadsAudio({ model, inputAudioFormat: target, mediaSettings: { track: 1 } });
  for (const source of [path, await readFile(path)]) await transcribe(source);
  assert.deepEqual(requests, [original, original]);
});

test('a movie reader resumes at the next block after probing EOF', async t => {
  const file = new URL('review-indexed.mov', import.meta.url);
  const bytes = await readFile(file);
  const reader = await openMovieResource(av, fileURLToPath(file), {});
  t.after(() => reader.input.close());
  const first = await reader.read(32768);
  assert.ok(first?.length && first.length < bytes.length);
  reader.releaseHeader();
  reader.seek(BigInt(bytes.length), av.AVSEEK_SET);
  assert.equal(await reader.read(1), null);
  reader.seek(BigInt(first.length), av.AVSEEK_SET);
  const rest = await reader.read(bytes.length - first.length);
  assert.ok(rest, 'The probe must leave the remaining bytes readable.');
  assert.deepEqual(Buffer.concat([first, rest]), bytes);
});

test('a fragmented HTTP response body plays before EOF and preserves every sample', { timeout: 20000 }, async () => {
  const pcm = Buffer.concat(Array(6).fill(Buffer.from(samples.buffer))).subarray(0, 140 * 4096 * 2);
  const movie = await createAudioFile(join(directory, 'chunked.mov'), pcm, { codec: 'alac',
    muxerOptions: { movflags: '+empty_moov+default_base_moof+skip_trailer', frag_duration: 100000 } });
  assert.ok(movie.length > 256 * 1024);
  assert.ok(Buffer.from(await decodeMonoPcm(movie)).equals(pcm));
  let resume, opens = 0;
  const server = createServer(async (_req, res) => {
    opens++;
    res.writeHead(200, { 'Content-Type': 'video/mp4' });
    res.write(movie.subarray(0, 128 * 1024));
    await resume.promise;
    res.end(movie.subarray(128 * 1024));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const received = capture();
    const model = new MockTranscriptionModelV4({ doStream(options) {
      resume.resolve();
      return received.model.doStream(options);
    } });
    const url = `http://127.0.0.1:${server.address().port}/chunked.mp4`;
    for (const input of ['url', 'response body']) {
      resume = Promise.withResolvers();
      const abortSignal = AbortSignal.timeout(6000);
      const audio = input === 'url' ? url : (await fetch(url, { signal: abortSignal })).body;
      await Transcriber.loadsAudio({ model, inputAudioFormat: target }).run({ audio, abortSignal });
    }
    assert.deepEqual(received.requests, [pcm, pcm]);
    assert.equal(opens, 2);
  } finally {
    resume.resolve();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

for (const route of ['raw', 'WAV']) {
  test(`a trailing movie edit excludes the next tone on ${route} delivery`, async () => {
    const edited = editMovie(movie, [[0, 1300]]);
    const { model, requests } = capture();
    const settings = route === 'raw' ? { inputAudioFormat: target } : { fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } };
    await Transcriber.loadsAudio({ model, ...settings })(edited);
    const pcm = route === 'raw' ? requests[0] : Buffer.from(await decodeMonoPcm(requests[0]));
    const expected = Buffer.from(samples.buffer, 0, 62400 * 2);
    assert.ok(pcm.subarray(0, expected.length).equals(expected), 'The kept tone must match its authored samples.');
    assert.equal(pcm.length / 2, 62400, 'The second tone lies outside the movie edit.');
  });
}

test('a compatible file copy keeps a partial movie edit or rejects before dispatch', {
  skip: referenceFfmpeg ? false : 'Set CASAI_REVIEW_FFMPEG to an independent FFmpeg executable.',
}, async () => {
  const edited = editMovie(movie, [[0, 1300]]);
  const sourcePath = join(directory, 'edited.m4a');
  const outputPath = join(directory, 'delivered.m4a');
  const decode = path => execFileSync(referenceFfmpeg, ['-v', 'error', '-i', path, '-map', '0:a:0', '-f', 's16le', 'pipe:1']);
  await writeFile(sourcePath, edited);
  const expected = decode(sourcePath);
  assert.ok(expected.equals(Buffer.from(samples.buffer, 0, 62400 * 2)), 'The source plays precisely the authored first tone.');
  const { model, requests } = capture();
  try {
    await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'mp4', codec: 'alac' } })(edited);
  } catch (error) {
    assert.equal(error.name, 'ValidationError');
    assert.match(error.message, /playback edit/);
    assert.equal(requests.length, 0);
    return;
  }
  await writeFile(outputPath, requests[0]);
  const delivered = decode(outputPath);
  assert.equal(delivered.length / 2, expected.length / 2, 'The delivered movie must end at the source playback boundary.');
  assert.ok(delivered.equals(expected), 'The movie received by the provider must play the kept tone.');
});

test('an ambiguous interior restart stops before the at-risk packet reaches the raw provider', async () => {
  const edited = editMovie(movie, [[0, 490], [700, 1300]]);
  const parts = [];
  const model = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
    for await (const part of audio) parts.push(part);
    assert.fail('The ambiguous splice must reject the input stream.');
  } });
  await assert.rejects(Transcriber.loadsAudio({ model, inputAudioFormat: target })(edited), /playback edit.*flattened/);
  const delivered = Buffer.concat(parts), first = Buffer.from(samples.buffer, 0, 23520 * 2);
  assert.ok(delivered.length > 0 && delivered.length <= first.length);
  assert.ok(delivered.equals(first.subarray(0, delivered.length)));
});

test('an empty edit and a nonempty edit with only discarded packets cannot send removed sound', async () => {
  const { model, requests } = capture();
  for (const [start, end, error] of [[100, 100, /no playable duration/], [1999, 2000, /no playable packets/]]) {
    const edited = editMovie(movie, [[start, end]]);
    await assert.rejects(Transcriber.loadsAudio({ model, inputAudioFormat: target })(edited), error);
    await assert.rejects(Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'wav', codec: 'pcm_s16le' } })(edited), error);
  }
  assert.equal(requests.length, 0);
});

test('a partial AAC block keeps its edit in M4A and converts to a playable flat target', async () => {
  const encoded = await createAudioFile(join(directory, 'aac.m4a'), new Uint8Array(samples.buffer), { codec: 'aac' });
  const edited = editMovie(encoded, [[0, 1995]]);
  const { model, requests } = capture();
  await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'adts', codec: 'aac', alternatives: [{ format: 'mp4', codec: 'aac' }] } })(edited);
  const payloads = async bytes => (await readAudioPackets(bytes)).map(packet => Buffer.from(packet.data));
  assert.deepEqual(await payloads(requests[0]), await payloads(edited));
  await Transcriber.loadsAudio({ model, fileAudioTarget: { format: 'adts', codec: 'aac' } })(edited);
  assert.ok((await decodeMonoPcm(requests[1])).length >= 1995 * 96);
  assert.notDeepEqual(await payloads(requests[1]), await payloads(edited));
  if (referenceFfmpeg) {
    const source = join(directory, 'edited.m4a'), delivered = join(directory, 'delivered.m4a');
    await writeFile(source, edited); await writeFile(delivered, requests[0]);
    const decode = path => execFileSync(referenceFfmpeg, ['-v', 'error', '-i', path, '-f', 's16le', 'pipe:1']);
    const expected = decode(source);
    assert.equal(expected.length, 1995 * 96);
    assert.ok(decode(delivered).equals(expected));
  }
});

test('an ISO-BMFF file type box following a free box still identifies a recording', async () => {
  // Retain the media offsets by trading two optional compatible brands for an eight-byte free box.
  const short = Buffer.from(samples.buffer, 0, 12288 * 2);
  const original = Buffer.from(await createAudioFile(join(directory, 'short.m4a'), short, { codec: 'alac', muxerOptions: { movflags: '+faststart' } }));
  const size = original.readUInt32BE(0);
  assert.equal(original.toString('ascii', 4, 8), 'ftyp');
  assert.ok(size >= 24);
  const ftyp = Buffer.from(original.subarray(0, size - 8));
  ftyp.writeUInt32BE(ftyp.length);
  const free = Buffer.from([0, 0, 0, 8, 102, 114, 101, 101]);
  const recording = Buffer.concat([free, ftyp, original.subarray(size),
    ...(original.length % 2 ? [Buffer.from([0, 0, 0, 9, 102, 114, 101, 101, 0])] : [])]);
  const { model, requests } = capture();
  const split = () => new ReadableStream({ start(controller) {
    for (const chunk of [recording.subarray(0, 5), recording.subarray(5, 13), recording.subarray(13)]) controller.enqueue(chunk);
    controller.close();
  } });
  // The fast-start index lets the forward-only controls decode on the same native route.
  for (const source of [() => recording, () => new Blob([recording]), split]) {
    await Transcriber.loadsAudio({ model, inputAudioFormat: target })(source());
    await Transcriber.loadsAudio({ model, inputAudioFormat: target, sourceFormat })(source());
    assert.ok(requests.at(-2).equals(short));
    assert.ok(requests.at(-1).equals(requests.at(-2)), 'The reusable PCM layout must preserve the same decoded waveform.');
  }
  const count = requests.length;
  await assert.rejects(Transcriber({ model, sourceFormat })(recording), /accurately label/);
  await assert.rejects(Transcriber({ model, inputAudioFormat: target, sourceFormat })(recording), /loadsAudio/);
  assert.equal(requests.length, count);
});

test('a fragmented upload keeps the samples after its initially reported duration', async () => {
  const expected = Buffer.from(Int16Array.from({ length: 98304 }, (_, i) => i % 21213 - 10000).buffer);
  const recording = await createAudioFile(join(directory, 'fragmented.m4a'), expected, {
    codec: 'alac', muxerOptions: { movflags: '+empty_moov+default_base_moof+frag_keyframe', frag_duration: 100000 },
  });
  const { model, requests } = capture();
  for (const settings of [{ inputAudioFormat: target }, { fileAudioTarget: { format: 'mp4', codec: 'alac' } }]) {
    const uploaded = new Blob([recording]).stream();
    await Transcriber.loadsAudio({ model, ...settings })(uploaded);
    const received = requests.at(-1);
    const pcm = settings.fileAudioTarget ? Buffer.from(await decodeMonoPcm(received)) : received;
    assert.ok(pcm.equals(expected));
    assert.equal(uploaded.locked, false);
  }
});

test('a larger file limit does not exempt generated silence from the prepared PCM budget', async () => {
  const { bytes } = await createPausedPcm(join(directory, 'pause.mka'));
  const { model, requests } = capture();
  const fileAudioTarget = { format: 'wav', codec: 'pcm_s16le', maxBytes: 300000 };
  const transcribe = Transcriber.loadsAudio({ model, fileAudioTarget, maxPreparedAudioBytes: 192000 });
  await transcribe(bytes);
  assert.equal((await decodeMonoPcm(requests[0])).length, 192000);
  // The one-second pause alone costs 96,000 bytes of generated mono PCM16.
  await assert.rejects(transcribe.run({ audio: bytes, maxPreparedAudioBytes: 95999 }), /maxPreparedAudioBytes/);
  assert.equal(requests.length, 1);
  const exactFile = { ...fileAudioTarget, maxBytes: requests[0].length };
  await transcribe.run({ audio: bytes, maxPreparedAudioBytes: 96000, fileAudioTarget: exactFile });
  await assert.rejects(transcribe.run({ audio: bytes, maxPreparedAudioBytes: 96000,
    fileAudioTarget: { ...exactFile, maxBytes: exactFile.maxBytes - 1 } }), /file byte limit/);
  assert.equal(requests.length, 2);
  // Each of two separate one-second pauses fits the smaller budget on its own.
  const repeated = await createPausedPcm(join(directory, 'twice.mka'), bytes, 1000, 250);
  await assert.rejects(transcribe.run({ audio: repeated.bytes, maxPreparedAudioBytes: 191999 }), /maxPreparedAudioBytes/);
  await transcribe.run({ audio: repeated.bytes, maxPreparedAudioBytes: 192000 });
  assert.equal((await decodeMonoPcm(requests.at(-1))).length, 288000);
});

test('an audio settings error precedes a loaded script read', async () => {
  let reads = 0;
  const { model, requests } = capture();
  const transcribe = Transcriber.loadsScript({ model, inputAudioFormat: target, audio: 'read.cas',
    loader() { reads++; return 'return recording'; }, context: { recording: new Uint8Array(64) } });
  await assert.rejects(transcribe.run({ maxPreparedAudioBytes: 0 }), /maxPreparedAudioBytes/);
  await assert.rejects(transcribe.run({ sourceFormat: { ...sourceFormat, encoding: 'pcm_bad' } }), /sample encoding/);
  assert.equal(requests.length, 0);
  assert.equal(reads, 0);
});

test('reading early warnings keeps the provider input usable until finish', async () => {
  const abort = new AbortController();
  let cancelled = 0, readChunk, finish;
  const input = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(1024)); }, cancel() { cancelled++; } }, { highWaterMark: 0 });
  const model = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
    readChunk = async () => {
      const reader = audio.getReader();
      try { return await reader.read(); } finally { reader.releaseLock(); }
    };
    await readChunk();
    return { stream: new ReadableStream({ start(c) {
      c.enqueue({ type: 'stream-start', warnings: [] });
      finish = () => { c.enqueue({ type: 'finish', ...transcript }); c.close(); };
    } }) };
  } });
  try {
    const result = await Transcriber.asStream({ model, inputAudioFormat: target, sourceFormat: { ...sourceFormat, sampleRate: 96000 } }).run({ audio: input, abortSignal: abort.signal });
    assert.deepEqual(await result.warnings, []);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal((await readChunk()).done, false);
    finish();
    assert.equal(await result.text, transcript.text);
    for (let i = 0; input.locked && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(input.locked, false);
    assert.equal(cancelled, 1);
  } finally { abort.abort(); }
});

for (const route of ['converted PCM', 'native upload']) test(`a drained incremental result releases its ${route} when the provider finishes early`, async () => {
  const abort = new AbortController();
  let cancelled = 0;
  const audio = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1024)); },
    cancel() { cancelled++; },
  }, { highWaterMark: 0 });
  const model = new MockTranscriptionModelV4({ doStream: async ({ audio }) => {
    const reader = audio.getReader();
    try { assert.equal((await reader.read()).done, false); } finally { reader.releaseLock(); }
    return { stream: convertArrayToReadableStream([{ type: 'finish', ...transcript }]) };
  } });
  const transcribe = route === 'converted PCM'
    ? Transcriber.asStream({ model, inputAudioFormat: target, sourceFormat: { ...sourceFormat, sampleRate: 96000 } })
    : Transcriber.loadsAudio.asStream({ model, inputAudioFormat: target,
      mediaSettings: { format: 's16le', options: { sample_rate: rate, ch_layout: 'mono', probesize: 32, analyzeduration: 1 } } });
  const waitForRelease = async () => {
    for (let i = 0; audio.locked && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
  };
  try {
    const result = await transcribe.run({ audio, abortSignal: abort.signal });
    for await (const part of result.fullStream) { void part; }
    await waitForRelease();
    assert.equal(audio.locked, false, 'The application consumed the result through EOF.');
    assert.equal(cancelled, 1);
  } finally {
    abort.abort();
    await waitForRelease();
  }
});

test('overlapping native translations release only the settled producer and worker', { timeout: 20000 }, async () => {
  const workers = new Set();
  const observe = worker => { workers.add(worker); worker.once('exit', () => workers.delete(worker)); };
  process.on('worker', observe);
  const started = Array.from({ length: 3 }, () => Promise.withResolvers());
  async function readSample(audio) {
    const reader = audio.getReader();
    try {
      const part = await reader.read();
      assert.equal(part.done, false);
      return Buffer.from(part.value).readInt16LE(0);
    } finally { reader.releaseLock(); }
  }
  const model = new Experimental_MockSpeechTranslationModelV4({ doStream: async ({ audio, headers }) => {
    const id = Number(headers.call);
    assert.equal(await readSample(audio), (id + 1) * 2000);
    return { stream: new ReadableStream({ start(controller) {
      started[id].resolve({ audio, controller });
      controller.enqueue({ type: 'stream-start', warnings: [] });
    } }) };
  } });
  const translate = Translator.loadsAudio.asStream({ model, targetLanguage: 'es', inputAudioFormat: target,
    mediaSettings: { format: 's16le', options: { sample_rate: rate, ch_layout: 'mono', probesize: 32, analyzeduration: 1 } } });
  const calls = started.map((_, id) => {
    const abort = new AbortController();
    let cancellations = 0;
    const samples = new Uint8Array(new Int16Array(8192).fill((id + 1) * 2000).buffer);
    const audio = new ReadableStream({ pull(c) { c.enqueue(samples); }, cancel() { cancellations++; } }, { highWaterMark: 0 });
    return { audio, abort, get cancellations() { return cancellations; },
      result: translate.run({ audio, headers: { call: String(id) }, abortSignal: abort.signal }) };
  });
  async function checkReleased(call) {
    for (let i = 0; call.audio.locked && i < 200; i++) await delay(10);
    assert.equal(call.audio.locked, false);
    assert.equal(call.cancellations, 1);
  }
  try {
    const [first, second, third] = await Promise.all(calls.map(call => call.result));
    const success = first.translationText;
    const failure = assert.rejects(Promise.resolve(second.translationText), /provider failure/);
    const reader = third.fullStream.getReader();
    const [survivor, failing] = await Promise.all(started.map(entry => entry.promise));
    assert.ok(workers.size >= 2, 'Overlapping invocations opened separate native workers.');
    await reader.cancel();
    await checkReleased(calls[2]);
    assert.equal(await readSample(survivor.audio), 2000);
    failing.controller.error(new Error('provider failure'));
    await failure;
    await checkReleased(calls[1]);
    assert.equal(await readSample(survivor.audio), 2000);
    survivor.controller.enqueue({ type: 'finish', sourceText: 'yes', outputText: 'sí', durationInSeconds: 1 });
    survivor.controller.close();
    assert.equal(await success, 'sí');
    await checkReleased(calls[0]);
    for (let i = 0; workers.size && i < 700; i++) await delay(10);
    assert.equal(workers.size, 0);
  } finally {
    process.off('worker', observe);
    for (const call of calls) call.abort.abort();
  }
});
