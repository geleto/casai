import { ValidationError } from '../errors.js';
import { isWebStream } from './web-input.js';

/** The caller has selected a one-shot source and is about to hand it off. */
const handedOff = new WeakSet();
export function claimLiveInput(input: object): void {
	if (handedOff.has(input)) throw new ValidationError('This input has already been handed off for consumption. Supply a fresh source.');
	if (isWebStream(input) && input.locked) throw new ValidationError('This input is locked by another reader. Release it before handing it off.');
	handedOff.add(input);
}
