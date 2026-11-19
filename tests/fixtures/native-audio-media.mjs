// Native test fixture generation uses the full optional peer API, not Casai's private integration surface.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Demuxer, Decoder, Encoder, Muxer, IOStream } from 'node-av';
import * as av from 'node-av';
import { prepareNativeAudio } from '../../src/audio/native-pipeline.js';

export async function createAudioFile(path, samples, { codec, rate = 48000, channels = 1 }) {
  await using input = await Demuxer.open(Buffer.from(samples), { format: 's16le', options: { sample_rate: rate, ch_layout: `${channels}c` } });
  using decoder = await Decoder.create(input.audio());
  using encoder = await Encoder.create(codec, { decoder, autoResample: true });
  await using output = await Muxer.open(path);
  const index = output.addStream(encoder);
  for await (const packet of encoder.packets(decoder.frames(input.packets()))) {
    if (packet) { try { await output.writePacket(packet, index); } finally { packet[Symbol.dispose](); } }
  }
  await output.close();
  return readFile(path);
}

// Split at a real packet boundary and shift the second section by one second.
export async function createPausedPcm(path, encoded) {
  const samples = new Int16Array(48000).fill(1200);
  await using input = encoded ? await Demuxer.open(Buffer.from(encoded))
    : await Demuxer.open(Buffer.from(samples.buffer), { format: 's16le', options: { sample_rate: 48000, ch_layout: 'mono' } });
  const track = input.audio();
  await using output = await Muxer.open(path);
  const index = output.addStream(track);
  let pauseAt;
  for await (const packet of input.packets(track.index)) {
    if (!packet) continue;
    try {
      if (packet.pts >= 24000n) {
        pauseAt ??= Number(packet.pts);
        packet.pts += 48000n;
        packet.dts += 48000n;
      }
      await output.writePacket(packet, index);
    } finally { packet[Symbol.dispose](); }
  }
  await output.close();
  assert.ok(pauseAt > 0 && pauseAt < samples.length);
  return { bytes: await readFile(path), pauseAt };
}

export async function readAudioPackets(bytes) {
  await using input = await Demuxer.open(Buffer.from(bytes));
  const track = input.audio(), packets = [];
  let first;
  for await (const packet of input.packets(track.index)) {
    if (!packet) continue;
    try {
      first ??= packet.pts;
      packets.push({ seconds: Number(packet.pts - first) * track.timeBase.num / track.timeBase.den, data: Uint8Array.from(packet.data) });
    } finally { packet[Symbol.dispose](); }
  }
  return packets;
}

// Independent playback reference for continuous recordings, including native decoder trims.
export async function decodeMonoPcm(bytes) {
  await using input = await Demuxer.open(Buffer.from(bytes));
  const track = input.audio(), chunks = [];
  using decoder = await Decoder.create(track, { resample: { sampleFormat: av.AV_SAMPLE_FMT_S16, channelLayout: av.avChannelLayoutDefault(1) } });
  for await (const frame of decoder.frames(input.packets(track.index))) {
    if (!frame) continue;
    try { chunks.push(Buffer.from(frame.data[0].subarray(0, frame.nbSamples * 2))); }
    finally { frame[Symbol.dispose](); }
  }
  return Uint8Array.from(Buffer.concat(chunks));
}

// Author a version-zero edit list on the single-track fixture. Its moov box follows mdat.
// Each range is expressed on the original playback timeline, in milliseconds.
export function editMovie(bytes, ranges) {
  const source = Buffer.from(bytes);
  function box(name, start = 0) {
    for (let pos = start; pos + 8 <= source.length;) {
      const length = source.readUInt32BE(pos);
      if (length < 8) break;
      if (source.toString('ascii', pos + 4, pos + 8) === name) return pos;
      pos += length;
    }
    throw new Error(`Missing ${name} in generated movie`);
  }
  const moov = box('moov'), trak = box('trak', moov + 8), edts = box('edts', trak + 8), elst = box('elst', edts + 8);
  const mvhd = box('mvhd', moov + 8), tkhd = box('tkhd', trak + 8), mdhd = box('mdhd', box('mdia', trak + 8) + 8);
  assert.ok(box('mdat') < moov); assert.equal(source.readUInt32BE(elst), 28); assert.equal(source.readUInt32BE(elst + 12), 1);
  const movieRate = source.readUInt32BE(mvhd + 20), rate = source.readUInt32BE(mdhd + 20), priming = source.readInt32BE(elst + 20);
  const extra = 12 * (ranges.length - 1), entries = Buffer.alloc(12 * ranges.length);
  let duration = 0;
  for (const [i, [start, end]] of ranges.entries()) {
    const span = (end - start) * movieRate / 1000;
    entries.writeUInt32BE(span, i * 12); entries.writeInt32BE(priming + start * rate / 1000, i * 12 + 4);
    entries.writeUInt32BE(0x10000, i * 12 + 8); duration += span;
  }
  for (const pos of [moov, trak, edts, elst]) source.writeUInt32BE(source.readUInt32BE(pos) + extra, pos);
  source.writeUInt32BE(ranges.length, elst + 12);
  source.writeUInt32BE(duration, mvhd + 24); source.writeUInt32BE(duration, tkhd + 28);
  return Buffer.concat([source.subarray(0, elst + 16), entries, source.subarray(elst + 28)]);
}

// Observe real native handles; the finally block also releases one if a regression leaks it.
export async function observeIO(action, onCreate = () => {}) {
  const create = IOStream.create, contexts = [];
  let disposals = 0;
  IOStream.create = function (...args) {
    const context = create.apply(this, args), dispose = context[Symbol.asyncDispose].bind(context);
    contexts.push(dispose);
    context[Symbol.asyncDispose] = async () => { disposals++; await dispose(); };
    onCreate();
    return context;
  };
  // Inspect disposal inside the exact worker-owned pipeline, where the native objects are created.
  try { return await action(() => disposals, (source, settings) => prepareNativeAudio(av, source, settings)); }
  finally { IOStream.create = create; for (const dispose of contexts) await dispose(); }
}

// Exercise the real decoder's ownership when a duration limit rejects a frame before encoding.
export async function assertReleasedFramesOnDurationFailure(source, settings) {
  const frames = Decoder.prototype.frames, live = new Set();
  let created = 0;
  Decoder.prototype.frames = async function* (...args) {
    for await (const frame of frames.apply(this, args)) {
      if (frame) {
        created++; live.add(frame);
        const dispose = frame[Symbol.dispose].bind(frame);
        frame[Symbol.dispose] = () => { live.delete(frame); dispose(); };
      }
      yield frame;
    }
  };
  try {
    await assert.rejects(prepareNativeAudio(av, source, settings).next(), /maxDurationSeconds/);
    assert(created > 0, 'Reach decoded frames rather than rejecting inspected duration');
    assert.equal(live.size, 0, 'Every decoded frame is released, including the rejected one');
  } finally {
    Decoder.prototype.frames = frames;
    for (const frame of live) frame[Symbol.dispose]();
  }
}

export async function createVideoTracks(container, firstWav, secondWav) {
  await using video = await Demuxer.open(Buffer.alloc(4, 80), { format: 'rawvideo', options: { video_size: '2x2', pixel_format: 'gray', framerate: 10 } });
  await using first = firstWav && await Demuxer.open(Buffer.from(firstWav));
  await using second = secondWav && await Demuxer.open(Buffer.from(secondWav));
  using decoder = await Decoder.create(video.video());
  using encoder = await Encoder.create('ffv1', { decoder, autoResample: true });
  await using output = await Muxer.open(container);
  const videoIndex = output.addStream(encoder), firstIndex = first && output.addStream(first.audio()), secondIndex = second && output.addStream(second.audio());
  for await (const encoded of encoder.packets(decoder.frames(video.packets()))) {
    if (encoded) { try { await output.writePacket(encoded, videoIndex); } finally { encoded[Symbol.dispose](); } }
  }
  for (const [input, index] of [[first, firstIndex], [second, secondIndex]]) {
    if (!input) continue;
    for await (const packet of input.packets()) {
      if (packet) { try { await output.writePacket(packet, index); } finally { packet[Symbol.dispose](); } }
    }
  }
  await output.close();
  return { firstIndex, secondIndex };
}
