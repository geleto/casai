self.onmessage = async ({ data: stream }) => {
  try {
    const chunks = [];
    const reader = stream.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    reader.releaseLock();
    const file = new Blob(chunks);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
    const sha256 = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    self.postMessage({ chunks: chunks.length, bytes: file.size, sha256, audioDecoder: typeof AudioDecoder === 'function' });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
