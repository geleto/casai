import { ValidationError } from '../errors.js';
import { isWebStream } from './web-input.js';

/** One identity claim at handoff, shared by SDK execution and native preparation. */
const handedOff = new WeakSet<ReadableStream>();
export function claimLiveInput(input: unknown): void {
	if (!isWebStream(input)) return;
	if (handedOff.has(input)) throw new ValidationError('This ReadableStream has already been handed off for consumption. Supply a fresh stream.');
	handedOff.add(input);
}
