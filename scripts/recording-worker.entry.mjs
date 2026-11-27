// Pre-integration codec worker. Bundle against the candidate under qualification.
import { Input, BufferSource, BlobSource, ReadableStreamSource, UrlSource, AudioSampleSink, EncodedPacketSink, Conversion, Output,
  StreamTarget, WebMOutputFormat, Mp4OutputFormat, WavOutputFormat, MP4, QTFF, WEBM, MATROSKA, OGG, WAVE, FLAC, MP3,
  PCM_AUDIO_CODECS, UnsupportedInputFormatError, Logging, LogLevel } from 'mediabunny';
import { ConfigError, ValidationError } from '../src/errors.ts';
import { browserTargetSupported, prepareDecodedAudio } from '../src/audio/browser-pcm.ts';
import { sampleBytes } from '../src/audio/pcm-format.ts';
import { browserFile } from '../src/audio/browser-file.ts';
import { prepareBrowserInput } from '../src/audio/browser-input.ts';
import { checkPreparedAudioBytes, defaultPreparedAudioBytes } from '../src/audio/preparation.ts';
import { readMovieHeader, observeMovieHeader, selectedMovieEdit, unverifiableMovie } from '../src/audio/movie-header.ts';
import { audioResourceFetch } from '../src/audio/browser-resource.ts';
import { serveBrowserAudio } from '../src/audio/browser-worker-server.ts';

Logging.level = LogLevel.Silent;
const maxCacheSize = 256 * 1024;
const formats = [WAVE, MP3, FLAC, OGG, MATROSKA, WEBM, MP4, QTFF];
const pcmCodecs = { pcm_u8: 'pcm-u8', pcm_s16le: 'pcm-s16', pcm_s24le: 'pcm-s24', pcm_s32le: 'pcm-s32', pcm_f32le: 'pcm-f32', pcm_f64le: 'pcm-f64' };

// The final check uses the bounded file that will be dispatched, including any padding introduced by the muxer.
async function checkCopiedDuration(audio, limit) {
  if (limit === undefined) return;
  const file = new Input({ source: new BufferSource(audio), formats });
  try {
    const track = await file.getPrimaryAudioTrack();
    if (!track || !await track.fitsPlaybackDuration(limit)) throw new ValidationError('Cannot guarantee playback within fileAudioTarget.maxDurationSeconds.');
  } finally { file.dispose(); }
}
function openSource(source, signal, observeMovieBytes) {
  const observe = body => body.pipeThrough(new TransformStream({
    transform(bytes, controller) { observeMovieBytes(bytes); controller.enqueue(bytes); },
  }), { signal });
  if (typeof source === 'string') return new UrlSource(source, { fetchFn: audioResourceFetch(signal, observe), maxCacheSize, parallelism: 1, getRetryDelay: () => null });
  if (source instanceof Blob) return new BlobSource(source, { maxCacheSize, useStreamReader: false });
  if (source instanceof Uint8Array) return new BufferSource(source);
  return new ReadableStreamSource(observe(source), { maxCacheSize });
}

async function* prepare({ source, settings }, signal) {
  const movie = observeMovieHeader();
  let observedMovieBytes = false;
  const media = openSource(source, signal, bytes => { observedMovieBytes = true; movie.write(bytes); });
  const input = new Input({ source: media, formats, formatOptions: {
    flac: { requireCompleteData: true, skipMetadataTags: true }, wave: { requireCompleteData: true, skipMetadataTags: true },
    ogg: { requireSingleLink: true, requireCompleteData: true },
    matroska: { skipMetadataTags: true, progressiveOpus: source instanceof ReadableStream },
    isobmff: { skipMetadataTags: true },
  } });
  let output, conversion, playbackFailure;
  const onWarning = Logging.on('warn', ([message]) => {
    if (message === 'Some audio packets had to be dropped in order to produce correct output timestamps.' ||
        message === 'Matroska DiscardPadding cannot be preserved.') {
      playbackFailure = new ValidationError('Cannot preserve the selected audio packet or playback trim.');
    }
  });
  const stop = () => {
    input.dispose();
    if (conversion) void conversion.cancel().catch(() => {});
    if (output && output.state !== 'finalized') void output.cancel().catch(() => {});
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    const container = await input.getFormat();
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new ValidationError('The recording has no audio track.');
    const codec = await track.getCodec(), channels = await track.getNumberOfChannels(), rate = await track.getSampleRate();
    const target = settings.fileAudioTarget;
    const budget = settings.maxPreparedAudioBytes ?? defaultPreparedAudioBytes;
    const fileLimit = target?.maxBytes ?? budget;
    const rawRate = settings.inputAudioFormat?.rate;
    if (rawRate >= rate && (container === FLAC || container === WAVE && PCM_AUDIO_CODECS.includes(codec))) {
      const duration = await track.getDurationFromMetadata();
      if (duration !== null) checkPreparedAudioBytes(2 * Math.round(Math.round(duration * rate) * rawRate / rate), budget);
    }
    let origin = 0, end = Infinity;
    let canInspectPackets = source instanceof Blob || source instanceof Uint8Array;
    if (container === MP4 || container === QTFF) {
      const header = observedMovieBytes ? movie.finish()
        : await readMovieHeader(async (position, count) => await media.readBytes(position, count) ?? new Uint8Array(0));
      canInspectPackets ||= !header.fragmented;
      const tracks = await input.getAudioTracks(), audio = header.tracks.filter(t => t.handler === 'soun');
      const ids = header.tracks.map(t => t.id);
      if (ids.some(id => !id) || new Set(ids).size !== ids.length || header.tracks.some(t => !t.handler)
        || tracks.length !== audio.length || tracks[track.number - 1] !== track) unverifiableMovie();
      const edit = selectedMovieEdit(header, audio[track.number - 1].id, false);
      // The demuxer already subtracts a bounded edit's media start from each timestamp.
      if (edit?.duration) end = Number(edit.duration) / edit.timescale;
      else if (edit) origin = await track.getFirstTimestamp() + Number(edit.mediaStart) / edit.mediaScale;
    }
    // In a movie or Matroska, even uncompressed packets carry a playback clock. A flat WAV muxer loses it.
    const packed = container !== WAVE && Object.keys(pcmCodecs).find(key => pcmCodecs[key] === codec);
    const encoding = packed || (codec === 'pcm-s16' ? 'pcm_s16le' : 'pcm_f32le');
    const layout = { sampleRate: rate, channels, encoding };
    async function* playbackSamples() {
      const stride = sampleBytes[encoding] * channels, block = Math.max(1, Math.floor(65536 / stride));
      const originFrame = Math.round(origin * rate), endFrame = Math.round(end * rate);
      const clock = packed && await track.getTimeResolution();
      const samples = packed ? new EncodedPacketSink(track).packets() : new AudioSampleSink(track).samples();
      let position = originFrame, nextPacketFrame;
      for await (const sample of samples) {
        try {
          signal.throwIfAborted();
          if (playbackFailure) throw playbackFailure;
          let start = Math.round(sample.timestamp * rate);
          const count = packed ? sample.data.byteLength / stride : sample.numberOfFrames;
          if (packed) {
            if (!Number.isInteger(count)) throw new ValidationError('PCM packet ends with an incomplete audio frame.');
            const tick = Math.round(sample.timestamp * clock);
            // Consecutive PCM may round either way at exactly half a coarse container tick.
            if (nextPacketFrame !== undefined && Math.abs(nextPacketFrame * clock - tick * rate) <= rate / 2) start = nextPacketFrame;
            nextPacketFrame = start + count;
          } else {
            if (sample.sampleRate !== rate || sample.numberOfChannels !== channels) throw new ValidationError('Audio layout changed during preparation.');
            if (start < endFrame && start + count > endFrame) unverifiableMovie();
          }
          const first = Math.min(endFrame, Math.max(originFrame, start)), last = Math.min(start + count, endFrame);
          if (start + count <= originFrame) continue;
          if (first < position) throw new ValidationError('Cannot verify overlapping audio playback times.');
          while (position < first) {
            const frames = Math.min(block, first - position);
            const silence = new Uint8Array(frames * stride);
            if (encoding === 'pcm_u8') silence.fill(128);
            yield silence;
            position += frames;
          }
          while (position < last) {
            const offset = position - start, frames = Math.min(block, last - position);
            if (packed) yield sample.data.subarray(offset * stride, (offset + frames) * stride);
            else {
              const data = new Uint8Array(frames * stride);
              sample.copyTo(data, { frameOffset: offset, frameCount: frames, format: encoding === 'pcm_s16le' ? 's16' : 'f32', planeIndex: 0 });
              yield data;
            }
            position += frames;
          }
          if (position === endFrame) return;
        } finally { if (!packed) sample.close(); }
      }
      if (playbackFailure) throw playbackFailure;
    }
    if (packed) return yield* prepareDecodedAudio(playbackSamples(), layout, settings);

    async function mux(profile, options, copy) {
      let pcmStart;
      // Native WAV conversion emits even-width PCM16 or float32 samples. Account for every data byte, including synthesized silence.
      const format = profile.format === 'wav' ? new WavOutputFormat(copy ? {} : { onHeader(data, start) { pcmStart = start + data.byteLength; } })
        : profile.format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: false });
      const buffer = browserFile(fileLimit);
      output = new Output({ format, target: new StreamTarget(new WritableStream({ write({ position, data }) {
        if (pcmStart !== undefined) checkPreparedAudioBytes(position + data.byteLength - pcmStart, budget);
        buffer.write(position, data);
      } })) });
      output.setMetadataTags({});
      conversion = await Conversion.init({ input, output, composable: true, showWarnings: false, tracks: 'all',
        video: { discard: true }, audio: candidate => candidate === track ? options : { discard: true },
        trim: { start: origin, ...(Number.isFinite(end) && { end }) },
        ...(copy && { copy: { mode: 'forced', shiftTolerance: 0, boundaryTolerance: 0 } }) });
      if (conversion.utilizedTracks.length !== 1 || conversion.utilizedTracks[0] !== track || output.tracks.length !== 1) {
        await output.cancel(); output = conversion = undefined;
        return;
      }
      const metadata = output.tracks[0].metadata;
      delete metadata.name; delete metadata.languageCode; delete metadata.disposition;
      await output.start(); await conversion.execute();
      signal.throwIfAborted();
      if (playbackFailure) throw playbackFailure;
      await output.finalize();
      const audio = buffer.bytes();
      await checkCopiedDuration(audio, target.maxDurationSeconds);
      return { audio, format: { format: profile.format, codec: profile.codec, rate: options.sampleRate ?? rate, channels: options.numberOfChannels ?? channels } };
    }
    // A copy that starts and fails ends the invocation. Select the fallback before reading packets for the muxer.
    if (target) for (const profile of [target, ...target.alternatives ?? []]) {
      if (!browserTargetSupported(profile)) continue;
      const wanted = pcmCodecs[profile.codec] ?? (profile.codec === 'libopus' ? 'opus' : profile.codec);
      if (wanted !== codec || profile.rate && profile.rate !== rate || profile.channels && profile.channels !== channels) continue;
      if (wanted === 'aac' && Number.isFinite(end)) {
        // Forced copy checks the start boundary, but can still include an entire packet crossing the edit's end.
        if (!canInspectPackets && (await media.getSizeOrNull() ?? Infinity) > maxCacheSize) continue;
        const endFrame = Math.round(end * rate);
        const last = await new EncodedPacketSink(track).getPacket((endFrame - 1) / rate, { metadataOnly: true });
        if (!last || last.duration <= 0 || Math.round((last.timestamp + last.duration) * rate) !== endFrame) continue;
      }
      if (wanted === 'aac' && target.maxDurationSeconds !== undefined) {
        if (target.format === 'wav') {
          // All AAC alternatives share the cap. Keep the source for WAV if inspecting it would require a replay.
          if (!canInspectPackets && (await media.getSizeOrNull() ?? Infinity) > maxCacheSize) break;
          if (!await track.fitsPlaybackDuration(target.maxDurationSeconds)) break;
        } else if (await track.getAacPacketFrameCount() === null) {
          throw new ValidationError('Cannot verify the AAC frame length for fileAudioTarget.maxDurationSeconds.');
        }
      }
      const file = await mux(profile, { codec: wanted }, true);
      if (file) return file;
    }
    if (target && target.format !== 'wav') throw new ValidationError('The recording cannot be copied to the requested file target.');
    if (container === MP3) throw new ValidationError('Cannot verify the playable MP3 end on this browser codec build.');
    if (codec === 'vorbis') throw new ValidationError('Cannot verify Vorbis playback boundaries on this browser codec build.');
    const config = await track.getDecoderConfig();
    if (!config) throw new ValidationError('Unsupported audio track configuration.');
    if (!PCM_AUDIO_CODECS.includes(codec)) {
      if (typeof AudioDecoder === 'undefined') throw new ConfigError('The recording requires WebCodecs AudioDecoder in a secure context.');
      if (!(await AudioDecoder.isConfigSupported(config)).supported) throw new ValidationError('The selected audio track cannot be decoded.');
    }
    if (target && channels > 1 && (target.channels ?? channels) === channels && (container === WAVE || container === FLAC)
      && (target.codec === 'pcm_f32le' || target.codec === 'pcm_s16le' && target.rate && target.rate !== rate)) {
      const file = await mux(target, { codec: pcmCodecs[target.codec], forceTranscode: true, sampleRate: target.rate ?? rate,
        numberOfChannels: channels, sampleFormat: target.codec === 'pcm_f32le' ? 'f32' : 's16' }, false);
      if (file) return file;
    }
    if (target && target.codec !== 'pcm_s16le') throw new ValidationError('Cannot preserve the requested WAV precision.');
    // Copy eligibility was decided on the original track before opening a decoder.
    const primary = target ? { ...settings, fileAudioTarget: { ...target, alternatives: [] } } : settings;
    return yield* prepareDecodedAudio(playbackSamples(), layout, primary);
  } catch (error) {
    if (error instanceof UnsupportedInputFormatError || error.message === 'Chained Ogg input is unsupported.') throw new ValidationError('Unsupported recording container or chained Ogg playback.');
    if (['Incomplete WAVE data chunk.', 'Incomplete WAVE chunk header.', 'Unsupported WAVE sample layout.',
      'Cannot verify a complete Ogg recording.', 'Ogg page sequence is discontinuous.',
      'FLAC frames do not match the declared sample count.', 'FLAC frame numbering is discontinuous.'].includes(error.message)) {
      throw new ValidationError(error.message);
    }
    throw playbackFailure ?? error;
  } finally {
    signal.removeEventListener('abort', stop);
    onWarning();
    if (output && output.state !== 'finalized') await Promise.allSettled([conversion?.cancel(), output.cancel()]);
    input.dispose();
  }
}
serveBrowserAudio((request, signal) => prepareBrowserInput(request, signal, prepare));
