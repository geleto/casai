// Web Audio downmixes the selected track to one channel at the context's actual sample rate.
class MicrophonePcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.blockSize = Math.ceil(sampleRate / 25);
    this.block = new DataView(new ArrayBuffer(this.blockSize * 2));
    this.frames = 0;
    this.queue = [];
    this.reading = false;
    this.ended = false;
    this.port.onmessage = ({ data }) => {
      if (this.ended) return;
      if (data === 'read') {
        if (this.queue.length) this.send(this.queue.shift());
        else this.reading = true;
      } else if (data === 'stop') {
        this.ended = true;
        for (const block of this.queue) this.send(block);
        this.queue.length = 0;
        if (this.frames) this.send(this.block.buffer.slice(0, this.frames * 2));
        this.port.postMessage('end');
      }
    };
  }
  send(block) { this.port.postMessage(block, [block]); }
  process(inputs) {
    if (this.ended) return false;
    const mono = inputs[0][0];
    if (!mono) return true;
    for (const sample of mono) {
      const value = Math.max(-1, Math.min(1, sample));
      this.block.setInt16(this.frames++ * 2, value * (value < 0 ? 32768 : 32767), true);
      if (this.frames !== this.blockSize) continue;
      if (this.reading) { this.reading = false; this.send(this.block.buffer); }
      else if (this.queue.length < 25) this.queue.push(this.block.buffer);
      else { this.ended = true; this.port.postMessage('overrun'); return false; }
      this.block = new DataView(new ArrayBuffer(this.blockSize * 2));
      this.frames = 0;
    }
    return true;
  }
}
registerProcessor('casai-example-microphone', MicrophonePcm);
