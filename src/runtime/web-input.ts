/** A platform getter checks the object's internal brand across same-origin realms without reading the input's property. */
function hasWebBrand<T>(value: unknown, type: { new(...args: never[]): T; prototype: T }, field: keyof T): value is T {
	if (value instanceof type) return true;
	if (typeof value !== 'object' || value === null || !(field in value)) return false;
	const property = Object.getOwnPropertyDescriptor(type.prototype, field);
	if (!property?.get) return false;
	try { property.get.call(value); return true; } catch { return false; }
}

export const isWebStream = (value: unknown): value is ReadableStream => hasWebBrand(value, ReadableStream, 'locked');
export const isWebBlob = (value: unknown): value is Blob => hasWebBrand(value, Blob, 'size');
export const isWebURL = (value: unknown): value is URL => hasWebBrand(value, URL, 'href');
export const isWebAudioBuffer = (value: unknown): value is AudioBuffer =>
	typeof AudioBuffer !== 'undefined' && hasWebBrand(value, AudioBuffer, 'numberOfChannels');
