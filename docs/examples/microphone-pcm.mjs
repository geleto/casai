// The application owns the AudioContext and the selected microphone track.
export async function captureMicrophonePcm(context, track, signal) {
  signal?.throwIfAborted();
  await context.audioWorklet.addModule(new URL('./microphone-worklet.mjs', import.meta.url));
  signal?.throwIfAborted();
  if (context.state !== 'running' || track.kind !== 'audio' || track.readyState !== 'live') {
    throw new Error('Start the audio context and select a live microphone track before capture.');
  }
  const source = context.createMediaStreamSource(new MediaStream([track]));
  const node = new AudioWorkletNode(context, 'casai-example-microphone', {
    channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers',
  });
  let controller, reading = false, stopping = false, closed = false;
  function disconnect() {
    if (closed) return;
    closed = true;
    track.removeEventListener('ended', stop);
    context.removeEventListener('statechange', stateChanged);
    signal?.removeEventListener('abort', aborted);
    node.port.close();
    source.disconnect();
    node.disconnect();
  }
  function fail(reason) {
    if (closed) return;
    disconnect();
    controller.error(reason);
  }
  function aborted() { fail(signal.reason); }
  function stateChanged() {
    if (context.state !== 'running') fail(new Error('The microphone audio context stopped running.'));
  }
  function stop() {
    if (closed || stopping) return;
    stopping = true;
    node.port.postMessage('stop');
  }
  const audio = new ReadableStream({
    start(stream) { controller = stream; },
    pull() {
      if (!reading && !stopping) { reading = true; node.port.postMessage('read'); }
    },
    cancel: disconnect,
  }, { highWaterMark: 0 });
  node.port.onmessage = ({ data }) => {
    if (closed) return;
    if (data === 'end') { disconnect(); controller.close(); }
    else if (data === 'overrun') fail(new Error('The microphone consumer fell more than one second behind.'));
    else { reading = false; controller.enqueue(new Uint8Array(data)); }
  };
  node.onprocessorerror = () => fail(new Error('The microphone worklet failed.'));
  track.addEventListener('ended', stop);
  signal?.addEventListener('abort', aborted, { once: true });
  context.addEventListener('statechange', stateChanged);
  try {
    source.connect(node);
    node.connect(context.destination); // The processor's output is silent.
  } catch (error) { disconnect(); throw error; }
  return { audio, stop, sourceFormat: { encoding: 'pcm_s16le', channels: 1, sampleRate: context.sampleRate } };
}
