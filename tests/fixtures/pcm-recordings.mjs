import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

export function pcmWave(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24); header.writeUInt32LE(16000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function coarseClockPcm() {
  const pcm = Buffer.from(Int16Array.from({ length: 8000 }, (_, i) => 2000 + i).buffer);
  // Twenty frames last 2.5 ms. Every other packet lands exactly halfway between Matroska clock ticks.
  const recording = execFileSync(process.env.CASAI_REVIEW_FFMPEG, ['-v', 'error', '-f', 's16le', '-ar', '8000', '-ac', '1',
    '-i', 'pipe:0', '-af', 'asetnsamples=n=20:p=0', '-c:a', 'pcm_s16le', '-f', 'matroska', 'pipe:1'], { input: pcm });
  return { recording, pcm };
}

// With a front index, both seekable and one-shot inputs can reach the audio after a large sample table.
export async function largeIndexedPcm(path) {
  const pcm = Buffer.from(Int16Array.from({ length: 67000 }, (_, i) => 1000 + i % 7919).buffer);
  const ffmpeg = process.env.CASAI_REVIEW_FFMPEG;
  execFileSync(ffmpeg, ['-v', 'error', '-f', 's16le', '-ar', '8000', '-ac', '1', '-i', 'pipe:0', '-c:a', 'pcm_s16le',
    '-use_editlist', '0', '-movflags', '+faststart', path], { input: pcm });
  const compact = await readFile(path);
  const containers = ['moov', 'trak', 'mdia', 'minf', 'stbl'].map(type => compact.indexOf(type) - 4);
  const stsz = compact.indexOf('stsz') - 4, stsd = compact.indexOf('stsd') - 4, stco = compact.indexOf('stco') - 4;
  const mdat = compact.indexOf('mdat') + 4;
  assert.ok(stsd > 0 && stsz > stsd && stco > stsz && mdat > stco);
  assert.equal(compact.readUInt32BE(stsz), 20);
  assert.equal(compact.readUInt32BE(stsz + 12), 2);
  const count = compact.readUInt32BE(stsz + 16), table = Buffer.alloc(count * 4);
  assert.equal(count, pcm.length / 2);
  assert.ok(table.length > 256 * 1024);
  for (let i = 0; i < count; i++) table.writeUInt32BE(2, i * 4);
  function insert(movie, position, data, boxes) {
    for (const box of [...containers, ...boxes]) {
      const size = movie.readUInt32BE(box);
      assert.ok(box > 0 && box < position && box + size >= position);
      movie.writeUInt32BE(size + data.length, box);
    }
    for (let i = 0; i < movie.readUInt32BE(stco + 12); i++) {
      const entry = stco + 16 + i * 4, offset = movie.readUInt32BE(entry);
      assert.ok(offset >= mdat);
      movie.writeUInt32BE(offset + data.length, entry);
    }
    const changed = Buffer.concat([movie.subarray(0, position), data, movie.subarray(position)]);
    const reference = execFileSync(ffmpeg, ['-v', 'error', '-i', 'pipe:0', '-map', '0:a:0', '-f', 's16le', 'pipe:1'], { input: changed });
    assert.ok(reference.equals(pcm));
    return changed;
  }
  const variable = Buffer.from(compact);
  variable.writeUInt32BE(0, stsz + 12);
  const large = insert(variable, stsz + 20, table, [stsz]);
  const entry = stsd + 16, padding = Buffer.alloc(1024 * 1024);
  padding.writeUInt32BE(padding.length); padding.write('free', 4);
  const padded = insert(Buffer.from(compact), entry + compact.readUInt32BE(entry), padding, [stsd, entry]);
  return { compact, large, padded, pcm };
}

// Keep the PCM nonzero on both sides of the pause so a duration-only regression cannot pass.
export function fragmentedPcm(frames, gap) {
  const pcm = Buffer.from(Int16Array.from({ length: frames }, (_, i) => 1000 + i % 7919).buffer);
  const ffmpeg = process.env.CASAI_REVIEW_FFMPEG;
  const movie = execFileSync(ffmpeg, ['-v', 'error', '-f', 's16le', '-ar', '8000', '-ac', '1', '-i', 'pipe:0',
    '-af', 'asetnsamples=n=2048:p=0', '-c:a', 'pcm_s16le', '-movflags', 'empty_moov+frag_keyframe+default_base_moof',
    '-frag_duration', '256000', '-use_editlist', '0', '-f', 'mov', 'pipe:1'], { input: pcm });
  const starts = [];
  for (let i = movie.indexOf('tfdt'); i >= 0; i = movie.indexOf('tfdt', i + 4)) {
    const start = Number(movie.readBigUInt64BE(i + 8));
    starts.push(start);
    if (start) movie.writeBigUInt64BE(BigInt(start + gap), i + 8);
  }
  assert.deepEqual(starts, frames === 4096 ? [0, 2048] : [0, 2048, 4096]);
  const crc = execFileSync(ffmpeg, ['-v', 'error', '-copyts', '-i', 'pipe:0', '-c:a', 'copy', '-f', 'framecrc', 'pipe:1'], { input: movie, encoding: 'utf8' });
  const packets = crc.split(/\r?\n/).filter(line => line.startsWith('0,')).map(line => line.split(',').map(Number));
  assert.deepEqual(packets.map(([, , pts, duration]) => [pts, duration]),
    starts.map(start => [start && start + gap, Math.min(2048, frames - start)]));
  return { movie, pcm, playback: Buffer.concat([pcm.subarray(0, 4096), Buffer.alloc(gap * 2), pcm.subarray(4096)]) };
}
