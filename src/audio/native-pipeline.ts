import { checkPreparedAudioBytes, defaultPreparedAudioBytes, type AudioSource, type PrepareAudioSettings, type FileAudioFormat, type FileAudioTarget } from './preparation.js';
import type { NativeAv, NativeInput, NativeIO, NativeDecoder, NativeEncoder, NativeStream, NativePacket, NativeOutput, NativeFrame } from './native-interface.js';
import { ValidationError } from '../errors.js';
import { sampleFormat } from './pcm-format.js';
import { audioContainer, audioMediaType, audioPrefixBytes, checkMimeLayout, encodedAudioType } from './source-evidence.js';
const fileLimitMessage = 'Prepared audio exceeds the file byte limit (fileAudioTarget.maxBytes or maxPreparedAudioBytes).';
/** The Node preparation owner resolves URLs and ArrayBuffers before worker handoff. */
export type NativeAudioSource = Extract<AudioSource, string | Uint8Array | ReadableStream<Uint8Array>>;

/** The decoder reports presentation timestamps in sample units. Fill pauses before rate conversion. */
async function* decodedFrames(av: NativeAv, decoder: NativeDecoder, packets: AsyncIterable<NativePacket | null>, stream: NativeStream, rate: number | undefined, limit: number, signal?: AbortSignal, codec?: ReturnType<NativeAv['Codec']['findEncoderByName']>) {
	let remaining = limit;
	let encoderStride: number | undefined;
	function outputStride(frame: NativeFrame) {
		if (!codec) return av.avGetBytesPerSample(frame.format) * frame.channelLayout.nbChannels;
		// node-av fixes its encoder format and channel layout from the first frame.
		return encoderStride ??= av.avGetBytesPerSample(av.pickSupportedSampleFormat(frame.format, codec.sampleFormats))
			* av.pickSupportedLayout(frame.channelLayout, codec.channelLayouts).nbChannels;
	}
	async function* onTimeline() {
		let end: bigint | undefined, previousRate = 0;
		for await (const frame of decoder.frames(packets)) {
			if (!frame) { yield frame; continue; }
			let handedOff = false;
			try {
				const sampleRate = frame.sampleRate;
				const timeBase = { num: 1, den: sampleRate };
				const start = frame.pts === av.AV_NOPTS_VALUE ? undefined : frame.pts;
				if (end !== undefined && previousRate !== sampleRate) end = av.avRescaleQ(end, { num: 1, den: previousRate }, timeBase);
				const stride = outputStride(frame);
				const outputRate = rate ?? sampleRate;
				if (end !== undefined && start !== undefined && start > end) {
					checkPreparedAudioBytes(Math.floor(Number(start - end) * outputRate / sampleRate) * stride, remaining);
					const sourceStride = av.avGetBytesPerSample(frame.format) * frame.channelLayout.nbChannels;
					const count = Math.max(1, Math.floor(65536 / sourceStride));
					const unsigned = av.avGetSampleFmtName(frame.format)?.startsWith('u8');
					const silence = Buffer.alloc(count * sourceStride, unsigned ? 128 : 0);
					while (end < start) {
						signal?.throwIfAborted();
						const nbSamples = Number(start - end > BigInt(count) ? BigInt(count) : start - end);
						yield av.Frame.fromAudioBuffer(silence.subarray(0, nbSamples * sourceStride), { format: frame.format, channelLayout: frame.channelLayout, sampleRate, timeBase, pts: end, nbSamples });
						end += BigInt(nbSamples);
					}
				}
				// Bound expansion before upsampling. A downsampler can trim a short frame during its drain.
				if (outputRate > sampleRate) checkPreparedAudioBytes(Math.floor(frame.nbSamples * outputRate / sampleRate) * stride, remaining);
				// A playlist discontinuity can start a new timestamp epoch. Keep its decoded samples in order.
				const position = start ?? end;
				end = position === undefined ? undefined : position + BigInt(frame.nbSamples);
				previousRate = sampleRate;
				handedOff = true;
				yield frame;
			} finally { if (!handedOff) frame[Symbol.dispose](); }
		}
	}
	using filter = rate !== undefined && rate !== stream.codecpar.sampleRate ? av.FilterAPI.create(`aresample=${rate}`, { signal }) : undefined;
	for await (const frame of filter ? filter.frames(onTimeline()) : onTimeline()) {
		if (frame) {
			const size = frame.nbSamples * outputStride(frame);
			try { checkPreparedAudioBytes(size, remaining); } catch (error) { frame[Symbol.dispose](); throw error; }
			remaining -= size;
		}
		yield frame;
	}
}

// The first pull returns an encoded file or yields the raw stream header. Further pulls yield PCM.
// Returning the iterator releases the same native scope as EOF or failure.
export async function* prepareNativeAudio(av: NativeAv, source: NativeAudioSource, settings: PrepareAudioSettings, blobType?: string) {
	settings.abortSignal?.throwIfAborted();
	let input: NativeInput | undefined, io: NativeIO | undefined, decoder: NativeDecoder | undefined;
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	let failed = false;
	const onAbort = () => { void reader?.cancel(settings.abortSignal?.reason).catch(() => { /* Preserve the original failure or cancellation. */ }); };
	async function release() {
		settings.abortSignal?.removeEventListener('abort', onAbort);
		await reader?.cancel().catch(() => { /* The reader can already be errored. */ });
		reader?.releaseLock();
		try { await input?.close(); }
		finally { decoder?.[Symbol.dispose](); await io?.[Symbol.asyncDispose](); }
	}
	try {
		let format = settings.mediaSettings?.format;
		const declared = audioMediaType(blobType);
		const options = { ...settings.mediaSettings?.options };
		const supplied = typeof source !== 'string';
		if (supplied) options.protocol_whitelist ??= '';
		const applyRawLayout = () => {
			const raw = sampleFormat(settings.sourceFormat!, source);
			format = raw.encoding.replace('pcm_', '');
			options.sample_rate = raw.sampleRate;
			options.ch_layout = `${raw.channels}c`;
		};
		let nativeSource: string | Buffer | NativeIO;
		if (typeof source === 'string') nativeSource = source;
		else if (source instanceof ReadableStream) {
			reader = source.getReader();
			settings.abortSignal?.addEventListener('abort', onAbort, { once: true });
			let pending: Uint8Array = new Uint8Array(0), readError: unknown;
			let remainder: Uint8Array = new Uint8Array(0), eof = false;
			if (settings.sourceFormat && !format) {
				const prefix = new Uint8Array(audioPrefixBytes);
				let length = 0;
				while (length < prefix.length) {
					const item = await reader.read();
					settings.abortSignal?.throwIfAborted();
					if (item.done) { eof = true; break; }
					const count = Math.min(prefix.length - length, item.value.length);
					prefix.set(item.value.subarray(0, count), length); length += count;
					remainder = item.value.subarray(count);
					if (audioContainer(prefix.subarray(0, length))) break;
				}
				pending = prefix.subarray(0, length);
				if (!audioContainer(pending)) applyRawLayout();
			}
			io = av.IOStream.create({
				async read(size) {
					try {
						settings.abortSignal?.throwIfAborted();
						while (!pending.length) {
							if (remainder.length) { pending = remainder; remainder = new Uint8Array(0); break; }
							if (eof) return null;
							const item = await reader!.read();
							settings.abortSignal?.throwIfAborted();
							if (item.done) return null;
							pending = item.value;
						}
						const count = Math.min(size, pending.length);
						const result = Buffer.from(pending.buffer, pending.byteOffset, count);
						pending = pending.subarray(count);
						return result;
					} catch (error) { readError = error; throw error; }
				},
			});
			if (!format) {
				format = (await av.InputFormat.probeBuffer(io))?.name ?? undefined;
				// eslint-disable-next-line @typescript-eslint/only-throw-error -- Preserve the source stream's original rejection.
				if (readError) throw readError;
				settings.abortSignal?.throwIfAborted();
				if (!format) throw new ValidationError('Could not detect the stream format within the probe limit. Supply mediaSettings.format.');
			}
			nativeSource = io;
		} else {
			const companded = declared === 'audio/pcmu' || declared === 'audio/pcma';
			if (!format && (settings.sourceFormat || companded) && !audioContainer(source)) {
				if (companded) {
					const demuxer = declared === 'audio/pcmu' ? 'mulaw' : 'alaw';
					throw new ValidationError(`For headerless ${declared}, set mediaSettings.format to "${demuxer}" and supply mediaSettings.options.sample_rate and mediaSettings.options.ch_layout for the recording.`);
				}
				if (settings.sourceFormat && !encodedAudioType(declared)) {
					if (declared === 'audio/pcm') checkMimeLayout(blobType!, settings.sourceFormat.sampleRate, settings.sourceFormat.channels);
					applyRawLayout();
				}
			}
			nativeSource = Buffer.from(source.buffer, source.byteOffset, source.byteLength);
		}
		settings.abortSignal?.throwIfAborted();
		input = await av.Demuxer.open(nativeSource, { format, options, signal: settings.abortSignal });
		// Opening can reject before adopting custom I/O. Disposal after native error cleanup is idempotent.
		io = undefined;
		const selected = settings.mediaSettings?.track === undefined ? input.findBestStream(av.AVMEDIA_TYPE_AUDIO)
			: input.streams.find(stream => stream.index === settings.mediaSettings!.track);
		if (selected?.codecpar.codecType !== av.AVMEDIA_TYPE_AUDIO) throw new ValidationError('The selected container stream is missing or is not audio.');
		const track = selected.index;
		const limit = settings.maxPreparedAudioBytes ?? defaultPreparedAudioBytes;
		if (settings.fileAudioTarget) {
			const result = await prepareFile(av, input, selected, settings.fileAudioTarget, limit, settings.abortSignal);
			return { ...result, track };
		}
		const target = settings.inputAudioFormat;
		// PCM WAV and native FLAC report sample counts. Downsampling and codec trimming can emit fewer.
		if (selected.duration > 0n && target.rate! >= selected.codecpar.sampleRate && selected.timeBase.num === 1 && selected.timeBase.den === selected.codecpar.sampleRate
			&& (input.formatName === 'flac' || input.formatName === 'wav' && av.avGetCodecName(selected.codecpar.codecId)?.startsWith('pcm_'))) {
			const samples = selected.duration * BigInt(target.rate!) / BigInt(selected.timeBase.den);
			checkPreparedAudioBytes(Number(samples) * 2, limit);
		}
		decoder = await av.Decoder.create(selected, { resample: { sampleFormat: av.AV_SAMPLE_FMT_S16, channelLayout: av.avChannelLayoutDefault(1) }, signal: settings.abortSignal });
		yield { track, format: target };
		// The native iterable owns packet disposal and drains the decoder at its EOF marker.
		for await (const frame of decodedFrames(av, decoder, input.packets(track), selected, target.rate, limit, settings.abortSignal)) {
			if (!frame) continue;
			try {
				if (frame.sampleRate !== target.rate || frame.format !== av.AV_SAMPLE_FMT_S16 || frame.channelLayout.nbChannels !== 1) {
					throw new ValidationError('Native conversion no longer matches the declared mono PCM16 audio target.');
				}
				yield Uint8Array.from(frame.data![0].subarray(0, frame.nbSamples * 2));
			} finally { frame[Symbol.dispose](); }
		}
		return undefined;
	} catch (error) {
		failed = true;
		throw error;
	} finally {
		const cleanup = release();
		if (failed) await cleanup.catch(() => { /* Preserve the conversion failure. */ });
		else await cleanup;
	}
}

/** A flat file needs actual samples for a pause. Packed PCM has independently writable silent samples. */
async function writePcmPause(av: NativeAv, output: NativeOutput, index: number, stream: NativeStream, codec: string, start: bigint, end: bigint, remainingBytes: number) {
	const packed = /^pcm_[sf](8|16|24|32|64)(?:be|le)?$/.exec(codec);
	const silentByte = codec === 'pcm_u8' ? 128 : codec === 'pcm_mulaw' ? 255 : codec === 'pcm_alaw' ? 213 : undefined;
	if (!packed && silentByte === undefined) return false;
	const stride = stream.codecpar.channels * (packed ? Number(packed[1]) / 8 : 1);
	if ((end - start) * BigInt(stride) > BigInt(remainingBytes)) throw new ValidationError(fileLimitMessage);
	const count = Math.max(1, Math.floor(65536 / stride));
	const silence = Buffer.alloc(count * stride, silentByte ?? 0);
	const timeBase = { num: 1, den: stream.codecpar.sampleRate };
	while (start < end) {
		const samples = Number(end - start > BigInt(count) ? BigInt(count) : end - start);
		using packet = new av.Packet();
		packet.alloc(); packet.timeBase = stream.timeBase; packet.data = silence.subarray(0, samples * stride);
		packet.pts = packet.dts = av.avRescaleQ(start, timeBase, stream.timeBase);
		start += BigInt(samples);
		packet.duration = av.avRescaleQ(start, timeBase, stream.timeBase) - packet.pts;
		await output.writePacket(packet, index);
	}
	return true;
}

async function prepareFile(av: NativeAv, input: NativeInput, stream: NativeStream, target: FileAudioTarget, limit: number, signal?: AbortSignal) {
	const source = stream.codecpar;
	const fileLimit = target.maxBytes ?? limit;
	const sourceCodec = av.avGetCodecName(source.codecId)!;
	const sourceFormat = av.avGetSampleFmtName(source.format) ?? undefined;
	const compatible = (candidate: FileAudioFormat) => (candidate.codec === sourceCodec || av.Codec.findEncoderByName(candidate.codec)?.id === source.codecId)
		&& (candidate.rate === undefined || candidate.rate === source.sampleRate)
		&& (candidate.channels === undefined || candidate.channels === source.channels)
		&& (candidate.sampleFormat === undefined || candidate.sampleFormat === sourceFormat);
	const movie = input.formatName.split(',').includes('mov');
	const sampleTime = { num: 1, den: source.sampleRate };
	// The MOV demuxer reports the encoded packet count and the edited playback duration.
	// A fixed-frame track can contain initial codec priming and one partially used final frame.
	const editedMovie = movie && source.frameSize > 0 && stream.nbFrames > 0n && stream.duration > 0n
		&& stream.nbFrames * BigInt(source.frameSize) - av.avRescaleQ(stream.duration, stream.timeBase, sampleTime)
			> BigInt(Math.max(source.frameSize, source.initialPadding) + source.frameSize);
	const copy = editedMovie ? undefined : [target, ...target.alternatives ?? []].find(compatible);
	const selected = copy ?? target;
	const checkDuration = (seconds: number) => {
		if (target.maxDurationSeconds !== undefined && seconds > target.maxDurationSeconds) throw new ValidationError('Prepared audio exceeds fileAudioTarget.maxDurationSeconds.');
	};
	if (stream.duration > 0n) checkDuration(Number(stream.duration) * stream.timeBase.num / stream.timeBase.den);
	let storage = Buffer.alloc(0), position = 0, length = 0;
	let writeError: ValidationError | undefined;
	const output = await av.Muxer.open({
		write(data) {
			const end = position + data.length;
			if (end > fileLimit) {
				writeError = new ValidationError(fileLimitMessage);
				return av.AVERROR_EXTERNAL;
			}
			if (end > storage.length) {
				const next = Buffer.alloc(Math.max(end, Math.min(Math.max(storage.length * 2, 65536), fileLimit)));
				storage.copy(next); storage = next;
			}
			storage.set(data, position); position = end; length = Math.max(length, end);
			return data.length;
		},
		seek(offset, whence) {
			const next = whence === 0 ? Number(offset) : whence === 1 ? position + Number(offset) : whence === 2 ? length + Number(offset) : -1;
			if (!Number.isSafeInteger(next) || next < 0) return -1n;
			position = next; return BigInt(position);
		},
	}, { format: selected.format, signal });
	let decoder: NativeDecoder | undefined, encoder: NativeEncoder | undefined;
	let format: FileAudioFormat = { format: selected.format, codec: sourceCodec, rate: source.sampleRate, channels: source.channels, sampleFormat: sourceFormat };
	try {
		let packets = input.packets(stream.index);
		if (!copy) {
			// Use the encoder's native rate selection before resampling so its expansion is metered.
			const requestedRate = selected.rate ?? source.sampleRate;
			const codec = av.Codec.findEncoderByName(selected.codec);
			const rate = requestedRate > 0 ? av.pickSupportedRate(requestedRate, codec?.supportedSamplerates ?? null) : undefined;
			if (selected.rate !== undefined && selected.rate !== rate) throw new ValidationError('The native encoder cannot satisfy the requested audio sample format.');
			decoder = await av.Decoder.create(stream, { resample: {
				sampleFormat: selected.sampleFormat === undefined ? undefined : av.avGetSampleFmtFromName(selected.sampleFormat),
				channelLayout: selected.channels === undefined ? undefined : av.avChannelLayoutDefault(selected.channels),
			}, signal });
			encoder = await av.Encoder.create(selected.codec, { decoder, autoResample: true, signal });
			const decoded = decodedFrames(av, decoder, packets, stream, rate, limit, signal, codec);
			async function* frames() {
				let rate = 0, samples = 0, previousSeconds = 0;
				for await (const frame of decoded) {
					if (frame) {
						// Accumulate whole samples. Adding seconds for each frame can reject an exact limit.
						if (frame.sampleRate !== rate) {
							if (rate) previousSeconds += samples / rate;
							rate = frame.sampleRate; samples = 0;
						}
						samples += frame.nbSamples;
						// The encoder owns yielded frames; a rejected frame has not reached it.
						try { checkDuration(previousSeconds + samples / rate); } catch (error) { frame[Symbol.dispose](); throw error; }
					}
					yield frame;
				}
			}
			// Native iteration disposes frames and propagates EOF through the encoder's drain.
			packets = encoder.packets(target.maxDurationSeconds === undefined ? decoded : frames());
		}
		const index = encoder ? output.addStream(encoder) : output.addStream(stream);
		let start: bigint | undefined, durationTicks = 0n, summedTicks = 0n;
		const next = { value: av.AV_NOPTS_VALUE };
		let playedPacket = false;
		const checkCopyTiming = copy && selected.format !== 'webm';
		for await (const packet of packets) {
			if (!packet) continue;
			try {
				if (copy && movie) {
					// Variable-frame tracks or incomplete indexes may only reveal an edit during copying.
					const discarded = (packet.flags & av.AV_PKT_FLAG_DISCARD) !== 0;
					const skip = packet.getSideData(av.AV_PKT_DATA_SKIP_SAMPLES)?.readUInt32LE(0);
					if (discarded && playedPacket || skip && skip > Math.max(source.initialPadding, av.avGetAudioFrameDuration2(source, packet.size))) {
						throw new ValidationError('The selected file copy would include audio omitted by a playback edit. Choose a file target that converts the track or use raw PCM.');
					}
					playedPacket ||= !discarded;
				}
				if (target.maxDurationSeconds !== undefined) {
					const timeBase = encoder ? encoder.getCodecContext()!.timeBase : stream.timeBase;
					summedTicks += packet.duration;
					if (summedTicks > durationTicks) durationTicks = summedTicks;
					if (packet.pts !== av.AV_NOPTS_VALUE) {
						start ??= packet.pts;
						const span = packet.pts + packet.duration - start;
						if (span > durationTicks) durationTicks = span;
					}
					checkDuration(Number(durationTicks) * timeBase.num / timeBase.den);
				}
				if (checkCopyTiming) {
					const samples = av.avGetAudioFrameDuration2(source, packet.size) || Number(av.avRescaleQ(packet.duration, stream.timeBase, sampleTime));
					const end = next.value;
					if (packet.pts === av.AV_NOPTS_VALUE) {
						if (end !== av.AV_NOPTS_VALUE) next.value += BigInt(samples);
					} else {
						// A millisecond clock rounds Opus pre-skip. Anchor the first packet at the known sample.
						if (end === av.AV_NOPTS_VALUE && source.initialPadding > 0) {
							const first = -BigInt(source.initialPadding);
							if (packet.pts === av.avRescaleQ(first, sampleTime, stream.timeBase)) next.value = first;
						}
						const position = av.avRescaleDelta(stream.timeBase, packet.pts, sampleTime, samples, next, sampleTime);
						if (end !== av.AV_NOPTS_VALUE && position > end && !await writePcmPause(av, output, index, stream, sourceCodec, end, position, fileLimit - length)) {
							throw new ValidationError('The selected file copy cannot preserve this audio pause. Choose a fileAudioTarget that converts the track or use a raw PCM target.');
						}
					}
					if (samples <= 0) next.value = av.AV_NOPTS_VALUE;
				}
				await output.writePacket(packet, index);
			} finally { packet[Symbol.dispose](); }
		}
		if (copy && target.maxDurationSeconds !== undefined && stream.duration <= 0n && durationTicks === 0n) throw new ValidationError('Native audio duration is unavailable; cannot enforce fileAudioTarget.maxDurationSeconds.');
		if (encoder) {
			const actual = encoder.getCodecContext()!;
			format = { format: selected.format, codec: av.avGetCodecName(actual.codecId)!, rate: actual.sampleRate, channels: actual.channels, sampleFormat: av.avGetSampleFmtName(actual.sampleFormat) ?? undefined };
			if (selected.rate !== undefined && format.rate !== selected.rate || selected.channels !== undefined && format.channels !== selected.channels
				|| selected.sampleFormat !== undefined && format.sampleFormat !== selected.sampleFormat) throw new ValidationError('The native encoder cannot satisfy the requested audio sample format.');
		}
		await output.close();
		if (writeError) throw writeError;
		return { audio: new Uint8Array(storage.buffer, storage.byteOffset, length), format };
	} catch (error) {
		await output.close().catch(() => { /* Preserve the original failure or cancellation. */ });
		throw writeError ?? error;
	} finally {
		encoder?.[Symbol.dispose](); decoder?.[Symbol.dispose]();
	}
}
