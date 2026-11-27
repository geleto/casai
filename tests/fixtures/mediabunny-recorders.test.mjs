// Qualify a candidate browser decoder before adding it to Casai's distributed worker.
// CASAI_MEDIABUNNY_ENTRY can name its published ESM entry or a checkout's src/index.ts.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';
import { coarseClockPcm, fragmentedPcm, pcmWave } from './pcm-recordings.mjs';

let server, browser, page;
before(async () => {
  const entry = process.env.CASAI_MEDIABUNNY_ENTRY;
  assert.ok(entry, 'Set CASAI_MEDIABUNNY_ENTRY to the Mediabunny build under qualification.');
  const script = await build({ stdin: { contents: `
    import { Input, BufferSource, BlobSource, ReadableStreamSource, OGG, MP4, QTFF, MATROSKA, WEBM, WAVE, AudioSampleSink } from 'mediabunny';
    self.onmessage = async ({ data: { bytes, form, strictWave, skipMovieTags } }) => {
      let offset = 0;
      const source = form === 'bytes' ? new BufferSource(bytes) : form === 'blob' ? new BlobSource(new Blob([bytes]))
        : new ReadableStreamSource(new ReadableStream({ pull(c) {
          if (offset === bytes.length) return c.close();
          const chunk = bytes.subarray(offset, offset + 421); offset += chunk.length; c.enqueue(chunk);
        } }), { maxCacheSize: 65536 });
      const input = new Input({ formats: [OGG, MP4, QTFF, MATROSKA, WEBM, WAVE], source,
        formatOptions: { wave: { requireCompleteData: strictWave }, isobmff: { skipMetadataTags: skipMovieTags } } });
      try {
        const track = await input.getPrimaryAudioTrack(), blocks = [];
        const firstPacketTime = skipMovieTags === undefined ? undefined : await track.getFirstTimestamp();
        for await (const sample of new AudioSampleSink(track).samples()) {
          try {
            const pcm = new Int16Array(sample.numberOfFrames);
            sample.copyTo(pcm, { format: 's16-planar', planeIndex: 0 });
            blocks.push({ start: Math.round(sample.timestamp * sample.sampleRate), rate: sample.sampleRate, pcm });
          } finally { sample.close(); }
        }
        postMessage({ blocks, firstPacketTime }, blocks.map(block => block.pcm.buffer));
      } catch (error) { postMessage({ error: String(error) }); }
      finally { input.dispose(); }
    };
  `, resolveDir: process.cwd() }, alias: { mediabunny: resolve(entry) }, bundle: true, write: false, platform: 'browser' });
  server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/worker.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/worker.js' ? script.outputFiles[0].contents : '<title>Recorder qualification</title>');
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const { chromium, firefox } = createRequire(import.meta.resolve('cascada-engine'))('playwright');
  const name = process.env.CASAI_RECORDER_BROWSER ?? 'chrome';
  browser = name === 'firefox' ? await firefox.launch() : await chromium.launch({ channel: name });
  page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port);
  console.log(name, browser.version());
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(done => server.close(done));
});

async function samples(bytes, form, rate = 48000, strictWave = false, skipMovieTags) {
  return page.evaluate(async ({ bytes, form, rate, strictWave, skipMovieTags }) => {
    const worker = new Worker('/worker.js');
    try {
      const { blocks, error, firstPacketTime } = await new Promise((resolve, reject) => {
        worker.onmessage = event => resolve(event.data);
        worker.onerror = event => reject(Error(event.message));
        worker.postMessage({ bytes: Uint8Array.fromBase64(bytes), form, strictWave, skipMovieTags });
      });
      if (error) throw Error(error);
      const gaps = [], pcm = [];
      let end = blocks[0]?.start;
      for (const block of blocks) {
        if (block.rate !== rate) throw Error('Unexpected decoded sample rate');
        if (block.start !== end) gaps.push([end, block.start]);
        pcm.push(block.pcm);
        end = block.start + block.pcm.length;
      }
      const joined = new Int16Array(pcm.reduce((n, block) => n + block.length, 0));
      let offset = 0;
      for (const block of pcm) { joined.set(block, offset); offset += block.length; }
      return { start: blocks[0]?.start, end, gaps, firstPacketTime, pcm: new Uint8Array(joined.buffer).toBase64() };
    } finally { worker.terminate(); }
  }, { bytes: bytes.toString('base64'), form, rate, strictWave, skipMovieTags });
}

const fixture = name => readFile(new URL(name, import.meta.url));

test('incremental movie metadata retains timing tags past a descriptive leaf larger than the cache', async () => {
  function atom(name, ...parts) {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(header.length + parts.reduce((size, part) => size + part.length, 0));
    header.write(name, 4, 'latin1');
    return Buffer.concat([header, ...parts]);
  }
  const movie = await fixture('review-chrome-aac.mp4');
  const moov = movie.indexOf('moov') - 4;
  assert.ok(moov >= 0);
  const end = moov + movie.readUInt32BE(moov);
  const type = Buffer.alloc(8);
  type.writeUInt32BE(1); // Text data.
  const priming = atom('----', atom('data', type, Buffer.from(' 00000000 00000200 00000000 ')),
    atom('name', Buffer.alloc(4), Buffer.from('iTunSMPB')));
  const supplyTags = padding => {
    const metadata = atom('udta', atom('meta', Buffer.alloc(4), atom('ilst', padding, priming)));
    const result = Buffer.concat([movie.subarray(0, end), metadata, movie.subarray(end)]);
    result.writeUInt32BE(movie.readUInt32BE(moov) + metadata.length, moov);
    return result;
  };
  const defaultPlayback = await samples(supplyTags(Buffer.alloc(0)), 'bytes', 48000, false, false);
  assert.equal(defaultPlayback.firstPacketTime, -512 / 48000);
  const padded = supplyTags(atom('covr', atom('data', Buffer.alloc(8), Buffer.alloc(384 * 1024, 65))));
  for (const form of ['blob', 'stream']) {
    assert.deepEqual(await samples(padded, form, 48000, false, true), defaultPlayback);
  }
});
for (const form of ['bytes', 'blob', 'stream']) {
  test(`strict WAVE reads reject a short data chunk and the default returns the available frames (${form})`, async () => {
    const pcm = Buffer.alloc(8520, 3), short = pcmWave(pcm).subarray(0, -400);
    const available = await samples(short, form, 8000);
    assert.ok(Buffer.from(available.pcm, 'base64').equals(pcm.subarray(0, -400)));
    await assert.rejects(samples(short, form, 8000, true), /Incomplete WAVE data chunk/);
  });
  test(`fragmented PCM retains every sample and its packet clock (${form})`, { skip: !process.env.CASAI_REVIEW_FFMPEG }, async () => {
    for (const [frames, pause] of [[4096, 0], [4096, 640], [4608, 800]]) {
      const { movie, pcm } = fragmentedPcm(frames, pause);
      const result = await samples(movie, form, 8000);
      assert.deepEqual([result.start, result.end, result.gaps], [0, frames + pause, pause ? [[2048, 2048 + pause]] : []]);
      assert.ok(Buffer.from(result.pcm, 'base64').equals(pcm));
    }
    const { recording, pcm } = coarseClockPcm();
    const continuous = await samples(recording, form, 8000);
    assert.deepEqual([continuous.start, continuous.end, continuous.gaps], [0, 8000, []]);
    assert.ok(Buffer.from(continuous.pcm, 'base64').equals(pcm));
  });
  test(`Opus packet clocks preserve continuous sound and recorded pauses (${form})`, { skip: !process.env.CASAI_REVIEW_FFMPEG }, async () => {
    const input = await fixture('review-chrome-opus.webm');
    const original = await samples(input, form);
    assert.deepEqual([original.start, original.end, original.gaps], [0, 46080, []]);
    for (const [clock, gap] of [['60*N-10*eq(N,5)', 0], ['60*N+gte(N,5)', 48], ['60*N+100*gte(N,5)', 4800]]) {
      const recording = execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', '-i', 'pipe:0', '-c:a', 'copy',
        '-bsf:a', `setts=time_base=1/1000:pts='${clock}':dts='${clock}':duration=60`, '-f', 'webm', 'pipe:1'], { input });
      const actual = await samples(recording, form);
      assert.deepEqual(actual.gaps, gap ? [[14400, 14400 + gap]] : []);
      assert.equal(actual.end, 46080 + gap);
      assert.equal(actual.pcm === original.pcm, true);
    }
  });
  test(`Firefox Ogg end granule trims decoded samples (${form})`, async () => {
    const bytes = await fixture('review-firefox-opus.ogg');
    const original = await samples(bytes, form);
    const last = bytes.lastIndexOf('OggS');
    assert.equal(bytes.readBigUInt64LE(last + 6), 64696n);
    bytes.writeBigUInt64LE(64456n, last + 6);
    bytes.writeUInt32LE(0xfe20860c, last + 22);
    const shorter = await samples(bytes, form);
    assert.deepEqual([original.start, original.end, shorter.start, shorter.end], [0, 64384, 0, 64144]);
    assert.deepEqual([original.gaps, shorter.gaps], [[], []]);
    assert.deepEqual(Buffer.from(shorter.pcm, 'base64'), Buffer.from(original.pcm, 'base64').subarray(0, 64144 * 2));
  });
  test(`Chrome AAC carries its fragment timestamps into decoded samples (${form})`, async () => {
    const bytes = await fixture('review-chrome-aac.mp4');
    const original = await samples(bytes, form);
    assert.deepEqual([original.start, original.end, original.gaps], [0, 63469, []]);
    for (const gap of [480, 4800]) {
      const shifted = Buffer.from(bytes);
      for (let i = shifted.indexOf('tfdt'); i >= 0; i = shifted.indexOf('tfdt', i + 4)) {
        const start = bytes.readBigUInt64BE(i + 8);
        if (start >= 33792n) shifted.writeBigUInt64BE(start + BigInt(gap), i + 8);
      }
      const result = await samples(shifted, form);
      assert.deepEqual(result.gaps, [[33792, 33792 + gap]]);
      assert.equal(result.end, 63469 + gap);
      assert.equal(result.pcm === original.pcm, true, 'Same AAC packets must produce the same waveform');
    }
    const paused = await samples(await fixture('review-chrome-aac-recorder-pause.mp4'), form);
    assert.deepEqual([paused.start, paused.end, paused.gaps], [0, 63855, [[31744, 32127]]]);
  });
}
