// Run against a Mediabunny ESM entry. Pass --progressive-opus to exercise the candidate option.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const [entry, option] = process.argv.slice(2);
const { BufferSource, EncodedPacketSink, Input, ReadableStreamSource, WEBM } = await import(
  entry ? pathToFileURL(resolve(entry)).href : 'mediabunny'
);
const bytes = new Uint8Array(await readFile(new URL('./review-android-chrome-open-cluster.webm', import.meta.url)));
const config = { formats: [WEBM] };
if (option === '--progressive-opus') config.formatOptions = { matroska: { progressiveOpus: true } };

async function firstPacket(input) {
  const track = await input.getPrimaryAudioTrack();
  assert.ok(track);
  return new EncodedPacketSink(track).getFirstPacket();
}

const complete = new Input({ ...config, source: new BufferSource(bytes) });
let controller;
const prefixSize = 12 * 1024;
const stream = new ReadableStream({
  start(source) {
    controller = source;
    source.enqueue(bytes.subarray(0, prefixSize));
  },
});
const live = new Input({ ...config, source: new ReadableStreamSource(stream) });
try {
  const reference = await firstPacket(complete);
  assert.ok(reference);
  const first = firstPacket(live);
  const arrivedBeforeTail = await Promise.race([first.then(Boolean), delay(1000, false)]);
  controller.enqueue(bytes.subarray(prefixSize));
  controller.close();
  const packet = await first;
  assert.ok(packet);
  assert.deepEqual(packet.data, reference.data);
  assert.equal(packet.timestamp, reference.timestamp);
  console.log(JSON.stringify({ prefixSize, arrivedBeforeTail, firstPacketBytes: packet.data.byteLength }));
  assert.ok(arrivedBeforeTail, 'The first complete packet became available only after the held tail was released.');
} finally {
  live.dispose();
  complete.dispose();
}
