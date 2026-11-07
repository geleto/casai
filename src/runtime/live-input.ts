import { ValidationError } from '../errors.js';

/** One identity claim at handoff, shared across live components. The SDK owns consumption. */
const handedOff = new WeakSet<ReadableStream>();
export function claimLiveInput(input: unknown): void {
	if (!(input instanceof ReadableStream)) return;
	if (handedOff.has(input)) throw new ValidationError('This ReadableStream has already been handed to the AI SDK. Supply a fresh stream.');
	handedOff.add(input);
}
