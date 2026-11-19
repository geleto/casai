import { runPcm } from './audio/pcm-pool.js';
import type { PcmFormat, PcmSamples, PcmSourceFormat } from './audio/pcm.js';
import type { ConfigValue } from './types/config.js';
import type { sourceMode, toolMode } from './config/modifiers.js';

/** Finite audio bytes. Buffer is a Uint8Array and needs no separate Node-only type. */
export type AudioBytes = Uint8Array | ArrayBuffer;
export type SuppliedAudio = AudioBytes | Blob | AudioBuffer | PcmSamples;
export type RawAudio = SuppliedAudio | ReadableStream<Uint8Array | string>;
export interface PcmInputSettings {
	/** Byte budget for recording preparation and decoded PCM sent to an encoder. Defaults to 32 MiB. */
	maxPreparedAudioBytes?: number | undefined;
	/** Original layout of headerless PCM. Omit for WAV or Web Audio AudioBuffer. Numeric sample arrays supply their encoding. */
	sourceFormat?: PcmSourceFormat;
}
export type AudioFormat = Parameters<typeof import('ai').experimental_streamTranscribe>[0]['inputAudioFormat'];
export type AudioCallFormat<P, T, Call> = Call extends unknown[] ? P extends 'text' | 'audio-resource'
	? true extends ConfigValue<T, typeof toolMode>
		? Call[0] extends string | URL | SuppliedAudio | ReadableStream<unknown> | undefined ? Call[2] : Call[1]
		: Call[0] extends SuppliedAudio ? Call[1] : Call[0] extends AudioFormat ? Call[0] : Call[1]
	: Call[0] extends string | ((...args: never[]) => unknown) | undefined ? Call[2] : Call[1] : undefined;
/** Enforce the missing metadata when the caller's source type is known. */
export type CheckPcmLayout<Input, Config, Layout = ConfigValue<Config, 'sourceFormat'>> =
	ConfigValue<Config, typeof sourceMode> extends 'async-script' | 'async-script-name' ? unknown
		: [Extract<Input, PcmSamples>] extends [never] ? CheckByteLayout<Input, Config, Layout>
		: [Layout] extends [PcmSourceFormat] ? CheckByteLayout<Input, Config, Layout> : 'Headerless samples require sourceFormat.sampleRate and sourceFormat.channels.';
type CheckByteLayout<Input, Config, Layout> = [Exclude<Layout, undefined>] extends [PcmFormat] ? unknown
			: [Extract<Input, ReadableStream>] extends [never] ? unknown
				: ConfigValue<Config, typeof sourceMode> extends 'audio-resource' ? unknown
					: 'Headerless bytes require sourceFormat.encoding.';

/** Join byte/base64 chunks into ordinary, transferable bytes in a worker. One chunk copies shared data for fetch, Blob or WebCrypto. */
export async function concatAudio(chunks: readonly (Uint8Array | string)[], signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
	signal?.throwIfAborted();
	if (chunks.length === 0) return new Uint8Array(0);
	return runPcm('concatAudio', async copy => {
		const inputs: (Uint8Array | string)[] = [];
		for (const chunk of chunks) inputs.push(await copy(chunk));
		return [inputs];
	}, signal);
}

/** Keep SDK base64 encoding off the calling thread for completed audio tool values. */
export async function audioBase64(audio: Uint8Array, signal?: AbortSignal): Promise<string> {
	signal?.throwIfAborted();
	if (audio.byteLength === 0) return '';
	return runPcm('toBase64', async copy => [await copy(audio)], signal);
}
