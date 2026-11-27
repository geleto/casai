const wavTarget = { format: 'wav', codec: 'pcm_s16le', channels: 1, rate: 48000 };
const copies = { webm: { format: 'webm', codec: 'libopus' }, aac: { format: 'ipod', codec: 'aac' } };
const sourceFiles = { wav: 'stereo.wav', webm: 'long.webm', aac: 'long.m4a' };

async function mediaResponse(name, method = 'GET') {
  const response = await fetch('/media/' + name, { cache: 'no-store', method });
  if (!response.ok) throw Error('Missing recording ' + name);
  return response;
}

function rawTranslation(receive) {
  const model = { modelId: 'device', provider: 'fixture', specificationVersion: 'v4',
    async doStream({ audio }) {
      const parts = [];
      for await (const part of audio) {
        if (part.byteLength > 65536) throw Error('Oversized PCM block');
        parts.push(part);
      }
      await receive(new Blob(parts));
      return { stream: new ReadableStream({ start(c) { c.enqueue({ type: 'finish', outputText: 'heard' }); c.close(); } }) };
    }
  };
  return casaiAudio.Translator.loadsAudio({ model, targetLanguage: 'en', inputAudioFormat: { type: 'audio/pcm', rate: 48000 } });
}

async function corpus(name, splitSize = 421) {
  const source = await (await mediaResponse(name)).blob();
  const frames = [];
  let firstPcm;
  for (const form of ['blob', 'split']) {
    const audio = () => form === 'blob' ? source : splitInput(source, splitSize);
    let wav, raw;
    const file = providerFile(wavTarget, part => { wav = part; });
    const translate = rawTranslation(part => { raw = part; });
    await Promise.all([file(audio()), translate(audio())]);
    const bytes = new Uint8Array(await wav.arrayBuffer()), view = new DataView(bytes.buffer);
    if (wav.type !== 'audio/wav' || view.getUint32(36) !== 0x64617461 || view.getUint16(22, true) !== 1
      || view.getUint32(24, true) !== 48000 || view.getUint16(34, true) !== 16) throw Error('Invalid provider WAV');
    const data = bytes.subarray(44), pcm = new Uint8Array(await raw.arrayBuffer());
    if (data.length !== pcm.length || pcm.some((v, i) => v !== data[i])) throw Error('Raw translation differs from multipart WAV');
    if (firstPcm && (firstPcm.length !== pcm.length || pcm.some((v, i) => v !== firstPcm[i]))) throw Error('Blob and stream differ');
    if (!firstPcm) { firstPcm = pcm; await storeFile(name + '.wav', wav); }
    frames.push(pcm.length / 2);
  }
  return { frames };
}

async function livePrefix(filename = sourceFiles.webm, prefixBytes = 512 * 1024) {
  const blob = await (await mediaResponse(filename)).blob();
  const prefix = new Uint8Array(await blob.slice(0, prefixBytes).arrayBuffer());
  let sent = false, released = 0, firstBytes = 0, holdPull;
  const input = new ReadableStream({
    pull(c) {
      if (sent) return new Promise(resolve => { holdPull = resolve; });
      sent = true;
      c.enqueue(prefix);
    },
    cancel() { released++; if (holdPull) holdPull(); }
  }, { highWaterMark: 0 });
  const model = { specificationVersion: 'v4', provider: 'fixture', modelId: 'device',
    async doStream({ audio }) {
      const it = audio[Symbol.asyncIterator]();
      return { stream: new ReadableStream({
        async pull(c) {
          const item = await it.next();
          if (item.done) return c.close();
          firstBytes = item.value.byteLength;
          c.enqueue({ type: 'transcript-delta', delta: 'hearing' });
        },
        async cancel() { await it.return(); }
      }, { highWaterMark: 0 }) };
    }
  };
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(Error('No partial before EOF')), 18000);
  try {
    const transcribe = casaiAudio.Transcriber.loadsAudio.asStream({ model, maxRetries: 0,
      inputAudioFormat: { type: 'audio/pcm', rate: 48000 } });
    const result = await transcribe.run({ audio: input, abortSignal: abort.signal });
    const reader = result.fullStream.getReader();
    for (;;) {
      const item = await reader.read();
      if (item.done) throw Error('No partial from open recording');
      if (item.value.type === 'transcript-delta') break;
    }
    const independent = corpus('review-safari-aac.mp4');
    await reader.cancel('caller stopped');
    reader.releaseLock();
    await independent;
    for (let i = 0; i < 25 && (!released || input.locked); i++) await pause(40);
    if (released !== 1 || input.locked || firstBytes < 2 || firstBytes > 65536) throw Error('Input cleanup or PCM bounds failed: ' + [released, input.locked, firstBytes]);
    return { firstBytes, released, lockedAfter: input.locked, eofSent: false };
  } finally { clearTimeout(timeout); abort.abort(); }
}

async function noDecoder() {
  const NativeWorker = Worker, urls = [];
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      const wrapper = URL.createObjectURL(new Blob(['self.AudioDecoder = undefined; importScripts(' + JSON.stringify(url) + ');'], { type: 'text/javascript' }));
      super(wrapper, options);
      urls.push(wrapper);
    }
  };
  try {
    const results = [];
    for (const kind of ['aac', 'webm']) {
      const blob = await (await mediaResponse(sourceFiles[kind])).blob();
      await providerFile(copies[kind], part => { results.push([part.type, part.size]); })(blob);
    }
    let dispatched = 0, rejection;
    const compressed = await (await mediaResponse('review-safari-aac.mp4')).blob();
    try { await providerFile(wavTarget, () => { dispatched++; })(compressed); } catch (error) { rejection = String(error); }
    if (dispatched || !/AudioDecoder/i.test(rejection) || results.length !== 2) throw Error('Unexpected decoder-free behavior ' + JSON.stringify({dispatched,rejection,results}));
    return { results, rejection };
  } finally { window.Worker = NativeWorker; urls.forEach(url => URL.revokeObjectURL(url)); }
}

async function rejectedCopy() {
  let requests = 0, rejection;
  const input = splitInput(await (await mediaResponse('review-safari-aac.mp4')).blob(), 421);
  try { await providerFile(copies.webm, () => { requests++; })(input); } catch (error) { rejection = String(error); }
  if (requests || !rejection || input.locked) throw Error('Unsupported copy reached provider or retained upload');
  return { requests, rejection, lockedAfter: input.locked };
}

async function measure(kind, form) {
  const name = 'profile-' + kind + '-' + form, filename = sourceFiles[kind];
  const get = () => mediaResponse(filename);
  const response = await mediaResponse(filename, form === 'blob' ? 'GET' : 'HEAD'), sourceBytes = Number(response.headers.get('Content-Length'));
  const blob = form === 'blob' ? await response.blob() : undefined;
  const target = kind === 'wav' ? { format: 'wav', codec: 'pcm_f32le', channels: 2, rate: 48000 } : copies[kind];
  const expectedMime = { wav: 'audio/wav', aac: 'audio/mp4', webm: 'audio/webm' }[kind];
  let file, repetitions = 0, requests = 0, timerTicks = 0, bytes;
  const prepare = providerFile(target, part => {
    if (part.type !== expectedMime || !part.size) throw Error('Provider received ' + part.type + ' ' + part.size);
    bytes = part.size;
    if (!requests) file = part;
    requests++;
  });
  await stage('begin ' + name);
  const start = performance.now();
  const timer = setInterval(() => { timerTicks++; }, 10);
  try {
    do {
      const source = blob || (await get()).body;
      await prepare(source);
      if (!blob && source.locked) throw Error('Finished upload stayed locked');
      if (!repetitions) { await storeFile(name + '.' + kind, file); file = undefined; }
      repetitions++;
    } while (repetitions < 2 || (performance.now() - start < 5000 && repetitions < 20));
  } finally { clearInterval(timer); await stage('end ' + name); }
  if (requests !== repetitions || !timerTicks) throw Error('Dispatch count or page timer failed');
  return { sourceBytes, outputBytes: bytes, repetitions, requests, timerTicks, elapsedMs: Math.round(performance.now() - start) };
}

async function runDeviceCases() {
  const results = [];
  async function run(name, operation) {
    await stage(name);
    try { results.push({ name, ...await operation() }); }
    catch (error) { results.push({ name, error: String(error) }); }
    await storeFile('progress.json', JSON.stringify(results));
  }
  for (const name of ['review-ios-safari-aac.mp4', 'review-safari-aac.mp4', 'review-chrome-aac.mp4',
    'review-chrome-aac-recorder-pause.mp4', 'review-firefox-opus.ogg', 'shorter.ogg', 'review-android-chrome-open-cluster.webm']) {
    await run(name, () => corpus(name));
  }
  await run('live-prefix-cancel', livePrefix);
  await run('android-open-cluster-prefix', () => livePrefix('review-android-chrome-open-cluster.webm', 12 * 1024));
  for (const name of ['large-open.webm', 'large-sized.webm']) await run(name, async () => {
    const live = await livePrefix(name, 12 * 1024);
    const blob = await (await mediaResponse(name)).blob();
    for (const form of ['blob', 'split']) {
      await providerFile(copies.webm, part => storeFile(name + '.' + form + '.webm', part))(form === 'blob' ? blob : splitInput(blob, 8192));
    }
    return { ...live, ...await corpus(name, 8192) };
  });
  await run('rejected-copy', rejectedCopy);
  await run('decoder-free', noDecoder);
  for (const kind of ['wav', 'webm', 'aac']) for (const form of ['blob', 'stream']) {
    await run('profile-' + kind + '-' + form, () => measure(kind, form));
  }
  return results;
}
