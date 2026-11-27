import { ValidationError } from '../errors.js';
import { isWebStream } from './web-input.js';

const handedOff = new WeakSet();
function assertAvailable(input: object): void {
	if (handedOff.has(input)) throw new ValidationError('This input has already been handed off for consumption. Supply a fresh source.');
	if (isWebStream(input) && input.locked) throw new ValidationError('This input is locked by another reader. Release it before handing it off.');
}

export function claimLiveInput(input: object): void {
	assertAvailable(input);
	handedOff.add(input);
}

/** Native file operations take their reader synchronously after validating the request. */
export function handOffFileStream<T>(source: ReadableStream, dispatch: () => T): T {
	assertAvailable(source);
	try { return dispatch(); }
	finally { if (source.locked) handedOff.add(source); }
}
