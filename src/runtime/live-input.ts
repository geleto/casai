import { ValidationError } from '../errors.js';

/** The caller has selected a one-shot source and is about to hand it off. */
const handedOff = new WeakSet();
export function claimLiveInput(input: object): void {
	if (handedOff.has(input)) throw new ValidationError('This input has already been handed off for consumption. Supply a fresh source.');
	handedOff.add(input);
}
