import { ValidationError } from '../errors.js';
import type * as operations from './pcm-operations.js';

type Operations = typeof operations & { resampleStream: ReturnType<typeof import('./pcm-stream.js').createPcmStreamConverter> };
export type PcmMethod = keyof Operations;
export type PcmJob<K extends PcmMethod = PcmMethod> = { [M in K]: { type: M; args: Parameters<Operations[M]> } }[K];
export type PcmValue<K extends PcmMethod = PcmMethod> = ReturnType<Operations[K]>;
export type PcmResponse = { value: PcmValue } | { error: unknown; name: string | undefined };
export interface PcmWorker {
	postMessage(request: PcmJob, transfer: ArrayBuffer[]): void;
	close(): Promise<void> | void;
}

export function pcmWorkerError(response: Extract<PcmResponse, { error: unknown }>): unknown {
	if (response.error instanceof Error && response.name === 'ValidationError') {
		Object.setPrototypeOf(response.error, ValidationError.prototype);
		response.error.name = response.name;
	}
	return response.error;
}
