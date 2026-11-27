// Attach before recorder.start() so the first container header reaches the consumer.
function recorderBlobs(recorder, signal, maxQueuedBytes) {
  signal?.throwIfAborted();
  if (recorder.state !== 'inactive') throw new Error('Connect the recorder before starting capture.');
  let controller;
  function detach() {
    recorder.removeEventListener('dataavailable', data);
    recorder.removeEventListener('stop', end);
    recorder.removeEventListener('error', error);
    signal?.removeEventListener('abort', abort);
  }
  function cancel() {
    detach();
    if (recorder.state !== 'inactive') recorder.stop();
  }
  function fail(reason) { cancel(); controller.error(reason); }
  function abort() { fail(signal.reason); }
  function error(event) { fail(event.error ?? new Error('MediaRecorder failed.')); }
  function data({ data: blob }) {
    if (!blob.size) return;
    if (blob.size > controller.desiredSize) fail(new Error('The recorder exceeded its queued-byte limit.'));
    else controller.enqueue(blob);
  }
  function end() { detach(); controller.close(); }
  return new ReadableStream({
    start(stream) {
      controller = stream;
      recorder.addEventListener('dataavailable', data);
      recorder.addEventListener('stop', end);
      recorder.addEventListener('error', error);
      signal?.addEventListener('abort', abort, { once: true });
    },
    cancel,
  }, { highWaterMark: maxQueuedBytes, size: blob => blob.size });
}

// A file endpoint accepts the whole recording. Keep the browser's Blob parts intact.
export async function finishedRecording(recorder, { signal } = {}) {
  const reader = recorderBlobs(recorder, signal, Infinity).getReader(), parts = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return new Blob(parts, { type: recorder.mimeType || parts.find(part => part.type)?.type });
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
}

// A live adapter consumes the encoded bytes of each timeslice in their original order.
export function liveRecording(recorder, { signal, maxQueuedBytes = 1024 * 1024 } = {}) {
  if (!Number.isSafeInteger(maxQueuedBytes) || maxQueuedBytes <= 0) throw new RangeError('Choose a positive recorder queue limit.');
  const reader = recorderBlobs(recorder, signal, maxQueuedBytes).getReader();
  let ended = false;
  return new ReadableStream({
    start(controller) {
      void reader.closed.catch(error => {
        if (!ended) { ended = true; controller.error(error); reader.releaseLock(); }
      });
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (ended) return;
      if (done) { ended = true; reader.releaseLock(); controller.close(); return; }
      try {
        const bytes = new Uint8Array(await value.arrayBuffer());
        if (!ended) controller.enqueue(bytes);
      } catch (error) {
        if (ended) return;
        ended = true; controller.error(error);
        try { await reader.cancel(error); } finally { reader.releaseLock(); }
      }
    },
    async cancel(reason) {
      ended = true;
      // Stop capture while an immutable Blob read may still be pending.
      try { await reader.cancel(reason); } finally { reader.releaseLock(); }
    },
  }, { highWaterMark: 0 });
}
