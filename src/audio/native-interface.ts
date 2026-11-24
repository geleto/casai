// Only the consumed native surface. The maintained native fixture checks it against real node-av exports.
// No native package types enter Casai's declarations or browser import graph.
export interface NativePacket extends Disposable {
	pos: bigint;
	pts: bigint;
	dts: bigint;
	duration: bigint;
	size: number;
	flags: number;
	getSideData(type: number): Buffer | null;
}
export interface NativeFrame extends Disposable {
	pts: bigint;
	duration: bigint;
	data: Uint8Array[] | null;
	nbSamples: number;
	sampleRate: number;
	format: number;
	channelLayout: NativeLayout;
}
export interface NativeLayout { nbChannels: number }
export interface NativeCodecParameters {
	codecType: number;
	codecId: number;
	sampleRate: number;
	channels: number;
	format: number;
	initialPadding: number;
	frameSize: number;
}
export interface NativeStream {
	index: number;
	id: number;
	discard: number;
	codecpar: NativeCodecParameters;
	duration: bigint;
	startTime: bigint;
	nbFrames: bigint;
	timeBase: { num: number; den: number };
}
export interface NativeInput<SeekFlag extends number = number> {
	formatName: string;
	getFormatContext(): {
		getOption(name: string): string | null;
		readFrame(packet: NativePacket): Promise<number>;
		seekFrame(index: number, position: bigint, flags: SeekFlag): Promise<number>;
	};
	streams: NativeStream[];
	findBestStream(type: number): NativeStream | undefined;
	packets(index: number): AsyncIterable<NativePacket | null>;
	close(): Promise<void>;
}
export interface NativeDecoder extends Disposable { frames(packet: NativePacket | AsyncIterable<NativePacket | null> | null): AsyncIterable<NativeFrame | null> }
export interface NativeEncoder extends Disposable {
	packets(frame: NativeFrame | AsyncIterable<NativeFrame | null> | null): AsyncIterable<NativePacket | null>;
	getCodecContext(): { codecId: number; sampleRate: number; channels: number; sampleFormat: number; bitsPerCodedSample: number; timeBase: { num: number; den: number } } | null;
}
export interface NativeOutput {
	addStream(source: NativeStream): number;
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Match node-av's separate overloads in the real-export compatibility check.
	addStream(source: NativeEncoder): number;
	writePacket(packet: NativePacket | null | undefined, index: number): Promise<void>;
	close(): Promise<void>;
}
export type NativeIO = AsyncDisposable;
export interface NativeAv<SampleFormat extends number = number, Layout extends NativeLayout = NativeLayout, IO extends NativeIO = NativeIO,
	Codec extends string = string, Decoder extends NativeDecoder = NativeDecoder, Frame extends NativeFrame = NativeFrame,
	Parameters extends NativeCodecParameters = NativeCodecParameters, SeekFlag extends number = number> {
	AVMEDIA_TYPE_AUDIO: number;
	AVDISCARD_ALL: number;
	AVERROR_EXTERNAL: number;
	AVERROR_EOF: number;
	AVSEEK_FLAG_BYTE: SeekFlag;
	AVSEEK_SET: number;
	AVSEEK_CUR: number;
	FFmpegError: { throwIfError(code: number, operation?: string): void };
	AV_SAMPLE_FMT_S16: SampleFormat;
	AV_NOPTS_VALUE: bigint;
	AV_PKT_DATA_SKIP_SAMPLES: number;
	AV_PKT_FLAG_DISCARD: number;
	Packet: new () => NativePacket & { alloc(): void; data: Buffer | null; timeBase: NativeStream['timeBase'] };
	Frame: { fromAudioBuffer(data: Buffer, props: { format: SampleFormat; channelLayout: Layout; sampleRate: number; nbSamples: number; pts: bigint; timeBase: { num: number; den: number } }): NativeFrame };
	FilterAPI: { create(description: string, options: { signal?: AbortSignal | undefined }): Disposable & { frames(input: AsyncIterable<Frame | null>): AsyncIterable<NativeFrame | null> } };
	avGetBytesPerSample(format: SampleFormat): number;
	avGetAudioFrameDuration2(parameters: Parameters, bytes: number): number;
	avRescaleDelta(from: NativeStream['timeBase'], timestamp: bigint, samples: NativeStream['timeBase'], duration: number, next: { value: bigint }, to: NativeStream['timeBase']): bigint;
	avRescaleQ(value: bigint, from: { num: number; den: number }, to: { num: number; den: number }): bigint;
	Demuxer: { open(source: string | Uint8Array | IO, options: { format?: string | undefined; options?: Record<string, unknown>; signal?: AbortSignal | undefined; skipStreamInfo?: boolean }): Promise<NativeInput<SeekFlag>> };
	IOStream: { create(callbacks: { read(size: number): Promise<Uint8Array | null>; seek?(offset: bigint, whence: number): bigint }): IO };
	InputFormat: {
		findInputFormat(name: string): { name: string | null; extensions: string | null } | null;
		probeBuffer(io: IO, maxProbeSize?: number): Promise<{ name: string | null } | null>;
	};
	Decoder: { create(stream: NativeStream, options: { context?: { threadCount: number } | undefined; resample?: { sampleRate?: number | undefined; sampleFormat?: SampleFormat | undefined; channelLayout?: Layout | undefined }; signal?: AbortSignal | undefined }): Promise<NativeDecoder> };
	Encoder: { create(codec: Codec, options: { decoder: Decoder; autoResample: boolean; signal?: AbortSignal | undefined }): Promise<NativeEncoder> };
	Muxer: { open(target: { write(data: Uint8Array): number; seek(offset: bigint, whence: number): bigint }, options: { format: string; options?: { movie_timescale: number } | undefined; signal?: AbortSignal | undefined }): Promise<NativeOutput> };
	Codec: { findEncoderByName(codec: string): { id: number; supportedSamplerates: number[] | null; sampleFormats: SampleFormat[] | null; channelLayouts: Layout[] | null } | null };
	pickSupportedRate(rate: number, supported: number[] | null): number;
	pickSupportedSampleFormat(format: SampleFormat, supported: SampleFormat[] | null): SampleFormat;
	pickSupportedLayout(layout: Layout, supported: Layout[] | null): Layout;
	avGetCodecName(codecId: number): string | null;
	avGetSampleFmtName(format: number): string | null;
	avGetSampleFmtFromName(name: string): SampleFormat;
	avChannelLayoutDefault(channels: number): Layout;
}
