# Reading a live Android Chrome WebM waits for the open cluster to end

When using a live Android Chrome microphone recording for captions, we need to read complete Opus packets while recording continues. With `mediabunny@1.66.5`, the first 12,288 bytes of this [152,618-byte WebM](https://raw.githubusercontent.com/geleto/casai/352f604cef00104b45fd99ba832541c170af6f5e/tests/fixtures/review-android-chrome-open-cluster.webm) identify the audio track and contain the first packet. `EncodedPacketSink.getFirstPacket()` waits until I release the tail. The recording is an unmodified Android 16 / Chrome 133 MediaRecorder capture of generated tones, with one unknown-sized cluster.

With Node 24, install `mediabunny@1.66.5`, save the linked recording as `android.webm`, and run this as an ES module.

```js
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { EncodedPacketSink, Input, ReadableStreamSource, WEBM } from 'mediabunny';

const bytes = await readFile('android.webm');
let send;
const stream = new ReadableStream({
  start(controller) {
    send = controller;
    controller.enqueue(bytes.subarray(0, 12288));
  },
});
const input = new Input({ formats: [WEBM], source: new ReadableStreamSource(stream) });
const track = await input.getPrimaryAudioTrack();
const first = new EncodedPacketSink(track).getFirstPacket();
console.log(await Promise.race([first.then(() => 'packet'), delay(1000, 'still waiting')]));
send.enqueue(bytes.subarray(12288));
send.close();
console.log((await first).data.length);
input.dispose();
```

This prints `still waiting`, then `1286`. An opt-in change that advances through complete unlaced Opus blocks on a single audio track prints `packet`, then `1286`, with the same payload as reading the whole file. Would you be open to a focused patch for sequential reading of this recorder output?

AI assistance was used to investigate this recording, run the reproduction and draft this report.
