import { experimental_decodeRealtimeAudio as decode, experimental_encodeRealtimeAudio as encode, experimental_resampleAudio as resample } from 'ai';
import { convertBase64ToUint8Array, convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';

/** Independent SDK reference, including its actual PCM decoder/encoder. Never used by production processing. */
export function sdkPcm(input: Uint8Array, from: number, to: number): Uint8Array {
	return convertBase64ToUint8Array(encode(resample(decode(convertUint8ArrayToBase64(input)), from, to)));
}
