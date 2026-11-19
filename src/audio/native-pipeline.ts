import { checkPreparedAudioBytes, defaultPreparedAudioBytes, type AudioSource, type PrepareAudioSettings, type FileAudioFormat, type FileAudioTarget } from './preparation.js';
import type { NativeAv, NativeInput, NativeIO, NativeDecoder, NativeEncoder, NativeStream, NativePacket, NativeOutput, NativeFrame } from './native-interface.js';
import { ValidationError } from '../errors.js';
import { sampleFormat } from './pcm-format.js';
import { audioContainer, audioMediaType, audioPrefixBytes, checkMimeLayout, encodedAudioType } from './source-evidence.js';
const fileLimitMessage = 'Prepared audio exceeds the file byte limit (fileAudioTarget.maxBytes or maxPreparedAudioBytes).';
/** The Node preparation owner resolves URLs and ArrayBuffers before worker handoff. */
export type NativeAudioSource = Extract<AudioSource, string | Uint8Array | ReadableStream<Uint8Array>>;

// Separately rounded packet positions or durations can disagree by one coarse clock tick.
function clockRounding(stream: NativeStream, rate: number): bigint {
	const samples = rate * stream.timeBase.num / stream.timeBase.den;
	return samples > 1 ? BigInt(Math.ceil(samples)) : 0n;
}

// A frame spanning whole container ticks has the same rounding at both ends.
function wholeTicks(samples: number, rate: number, stream: NativeStream): boolean {
	return samples > 0 && (samples * stream.timeBase.den) % (rate * stream.timeBase.num) === 0;
}

// Ogg stores one end granule per page. Inside a page FFmpeg can place a short Vorbis
// window late. The preceding packet fixes its start and its own end granule stays intact.
async function* oggVorbisPackets(packets: AsyncIterable<NativePacket | null>, noTimestamp: bigint) {
	let end: bigint | undefined, page: bigint | undefined;
	for await (const packet of packets) {
		if (packet && packet.pts !== noTimestamp) {
			const duration = packet.duration, nextEnd = packet.pts + duration;
			if (packet.pos >= 0n && packet.pos === page && end !== undefined && duration > 0n && packet.pts > end) {
				if (packet.dts === packet.pts) packet.dts = end;
				packet.pts = end;
				packet.duration = nextEnd - end;
			}
			end = nextEnd; page = packet.pos;
		} else end = undefined;
		yield packet;
	}
}

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
		let end: bigint | undefined, outputPosition = 0n, previousRate = 0, rounding = 0n, aligned = false;
		for await (const frame of decoder.frames(packets)) {
			if (!frame) { yield frame; continue; }
			let handedOff = false;
			try {
				const sampleRate = frame.sampleRate;
				const timeBase = { num: 1, den: sampleRate };
				const start = frame.pts === av.AV_NOPTS_VALUE ? undefined : frame.pts;
				if (previousRate !== sampleRate) {
					if (end !== undefined) end = av.avRescaleQ(end, { num: 1, den: previousRate }, timeBase);
					if (previousRate) outputPosition = av.avRescaleQ(outputPosition, { num: 1, den: previousRate }, timeBase);
					rounding = clockRounding(stream, sampleRate);
					aligned = false;
					previousRate = sampleRate;
				}
				const stride = outputStride(frame);
				const outputRate = rate ?? sampleRate;
				if (end !== undefined && start !== undefined && start - end > (aligned ? 0n : rounding)) {
					checkPreparedAudioBytes(Math.floor(Number(start - end) * outputRate / sampleRate) * stride, remaining);
					const sourceStride = av.avGetBytesPerSample(frame.format) * frame.channelLayout.nbChannels;
					const count = Math.max(1, Math.floor(65536 / sourceStride));
					const unsigned = av.avGetSampleFmtName(frame.format)?.startsWith('u8');
					const silence = Buffer.alloc(count * sourceStride, unsigned ? 128 : 0);
					while (end < start) {
						signal?.throwIfAborted();
						const nbSamples = Number(start - end > BigInt(count) ? BigInt(count) : start - end);
						yield av.Frame.fromAudioBuffer(silence.subarray(0, nbSamples * sourceStride), { format: frame.format, channelLayout: frame.channelLayout, sampleRate, timeBase, pts: outputPosition, nbSamples });
						end += BigInt(nbSamples);
						outputPosition += BigInt(nbSamples);
					}
				}
				// Bound expansion before upsampling. A downsampler can trim a short frame during its drain.
				if (outputRate > sampleRate) checkPreparedAudioBytes(Math.floor(frame.nbSamples * outputRate / sampleRate) * stride, remaining);
				// Multi-frame packets can repeat a timestamp and playlists can reset it. Keep all decoded samples in order.
				const position = start ?? end;
				end = position === undefined ? undefined : position + BigInt(frame.nbSamples);
				aligned = rounding > 0n && wholeTicks(frame.nbSamples, sampleRate, stream);
				frame.pts = outputPosition;
				outputPosition += BigInt(frame.nbSamples);
				handedOff = true;
				yield frame;
			} finally { if (!handedOff) frame[Symbol.dispose](); }
		}
	}
	const filters = [];
	if (rate !== undefined && rate !== stream.codecpar.sampleRate) filters.push(`aresample=${rate}`);
	// node-av 7.1 can lose queued frames with these delayed encoders when one input spans many blocks.
	// Feed one encoder block at a time and leave the final partial block to its native drain.
	const codecName = codec && av.avGetCodecName(codec.id);
	if (codecName === 'vorbis') filters.push('asetnsamples=n=64:p=0');
	if (codecName === 'mp3') {
		const block = (rate ?? stream.codecpar.sampleRate) > 24000 ? 1152 : 576;
		filters.push(`asetnsamples=n=${block}:p=0`);
	}
	using filter = filters.length ? av.FilterAPI.create(filters.join(','), { signal }) : undefined;
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
			const demuxer = declared === 'audio/pcmu' ? 'mulaw' : declared === 'audio/pcma' ? 'alaw' : declared === 'audio/l16' ? 's16be' : undefined;
			if (!format && (settings.sourceFormat || demuxer || declared === 'audio/pcm') && !audioContainer(source)) {
				if (demuxer) {
					throw new ValidationError(`For headerless ${declared}, set mediaSettings.format to "${demuxer}" and supply mediaSettings.options.sample_rate and mediaSettings.options.ch_layout for the recording.`);
				}
				if (declared === 'audio/pcm' && !settings.sourceFormat) throw new ValidationError('For headerless audio/pcm, supply sourceFormat with the recording\'s encoding, sampleRate and channels, or set an explicit native mediaSettings.format and sample options.');
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
		let packets = input.packets(track);
		if (input.formatName === 'ogg' && av.avGetCodecName(selected.codecpar.codecId) === 'vorbis') packets = oggVorbisPackets(packets, av.AV_NOPTS_VALUE);
		const limit = settings.maxPreparedAudioBytes ?? defaultPreparedAudioBytes;
		if (settings.fileAudioTarget) {
			const result = await prepareFile(av, input.formatName, packets, selected, settings.fileAudioTarget, limit, settings.abortSignal);
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
		for await (const frame of decodedFrames(av, decoder, packets, selected, target.rate, limit, settings.abortSignal)) {
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

async function prepareFile(av: NativeAv, inputFormat: string, packets: AsyncIterable<NativePacket | null>, stream: NativeStream, target: FileAudioTarget, limit: number, signal?: AbortSignal) {
	const source = stream.codecpar;
	const fileLimit = target.maxBytes ?? limit;
	const sourceCodec = av.avGetCodecName(source.codecId)!;
	const sourceFormat = av.avGetSampleFmtName(source.format) ?? undefined;
	const compatible = (candidate: FileAudioFormat) => (candidate.codec === sourceCodec || av.Codec.findEncoderByName(candidate.codec)?.id === source.codecId)
		&& (candidate.rate === undefined || candidate.rate === source.sampleRate)
		&& (candidate.channels === undefined || candidate.channels === source.channels)
		&& (candidate.sampleFormat === undefined || candidate.sampleFormat === sourceFormat);
	const movie = inputFormat.split(',').includes('mov');
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
		let decodedSeconds = 0, encodedBytes = 0;
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
						decodedSeconds = previousSeconds + samples / rate;
						try { checkDuration(decodedSeconds); } catch (error) { frame[Symbol.dispose](); throw error; }
					}
					yield frame;
				}
			}
			// Native iteration disposes frames and propagates EOF through the encoder's drain.
			packets = encoder.packets(frames());
		}
		const index = encoder ? output.addStream(encoder) : output.addStream(stream);
		let start: bigint | undefined, durationTicks = 0n, summedTicks = 0n;
		const next = { value: av.AV_NOPTS_VALUE };
		let exactEnd: bigint | undefined;
		let playedPacket = false;
		const checkCopyTiming = copy && selected.format !== 'webm';
		const rounding = clockRounding(stream, source.sampleRate);
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
				if (encoder) encodedBytes += packet.size;
				if (encoder || target.maxDurationSeconds !== undefined) summedTicks += packet.duration;
				if (target.maxDurationSeconds !== undefined) {
					const timeBase = encoder ? encoder.getCodecContext()!.timeBase : stream.timeBase;
					if (summedTicks > durationTicks) durationTicks = summedTicks;
					if (packet.pts !== av.AV_NOPTS_VALUE) {
						start ??= packet.pts;
						const span = packet.pts + packet.duration - start;
						if (span > durationTicks) durationTicks = span;
					}
					checkDuration(Number(durationTicks) * timeBase.num / timeBase.den);
				}
				if (checkCopyTiming) {
					const codecSamples = av.avGetAudioFrameDuration2(source, packet.size);
					const samples = codecSamples || Number(av.avRescaleQ(packet.duration, stream.timeBase, sampleTime));
					const end = next.value;
					if (packet.pts === av.AV_NOPTS_VALUE) {
						if (end !== av.AV_NOPTS_VALUE) next.value += BigInt(samples);
					} else {
						let position = av.avRescaleDelta(stream.timeBase, packet.pts, sampleTime, samples, next, sampleTime);
						if (exactEnd !== undefined && end !== av.AV_NOPTS_VALUE && packet.pts >= exactEnd) {
							position = end + av.avRescaleQ(packet.pts - exactEnd, stream.timeBase, sampleTime);
							next.value = position + BigInt(samples);
						}
						if (end !== av.AV_NOPTS_VALUE && position - end > (codecSamples ? 0n : rounding) && !await writePcmPause(av, output, index, stream, sourceCodec, end, position, fileLimit - length)) {
							throw new ValidationError('The selected file copy cannot preserve this audio pause. Choose a fileAudioTarget that converts the track or use a raw PCM target.');
						}
					}
					if (samples <= 0) next.value = av.AV_NOPTS_VALUE;
					exactEnd = rounding > 0n && packet.pts !== av.AV_NOPTS_VALUE && wholeTicks(codecSamples, source.sampleRate, stream)
						? packet.pts + av.avRescaleQ(BigInt(codecSamples), sampleTime, stream.timeBase) : undefined;
				}
				await output.writePacket(packet, index);
			} finally { packet[Symbol.dispose](); }
		}
		if (copy && target.maxDurationSeconds !== undefined && stream.duration <= 0n && durationTicks === 0n) throw new ValidationError('Native audio duration is unavailable; cannot enforce fileAudioTarget.maxDurationSeconds.');
		if (encoder) {
			const actual = encoder.getCodecContext()!;
			format = { format: selected.format, codec: av.avGetCodecName(actual.codecId)!, rate: actual.sampleRate, channels: actual.channels, sampleFormat: av.avGetSampleFmtName(actual.sampleFormat) ?? undefined };
			// The native format converter can stamp a whole PCM packet with a duration of one tick.
			// Its coded sample width measures the payload independently of that stamp.
			const encodedSamples = format.codec.startsWith('pcm_') && actual.bitsPerCodedSample > 0
				? encodedBytes * 8 / (actual.bitsPerCodedSample * actual.channels)
				: Number(av.avRescaleQ(summedTicks, actual.timeBase, { num: 1, den: actual.sampleRate }));
			if (encodedSamples < Math.round(decodedSeconds * actual.sampleRate)) throw new ValidationError('Native audio encoding ended before all decoded samples were represented. Choose another file codec or use raw PCM.');
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
