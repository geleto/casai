import { ConfigError, ValidationError } from '../errors.js';
import type { Open, Pipeline } from './browser-worker-server.js';
import { prepareDecodedAudio } from './browser-pcm.js';
import { audioContainer, audioMediaType, audioPrefixBytes, checkMimeLayout, encodedAudioType, paddedHeaderEvidence } from './source-evidence.js';
import { sampleFormat } from './pcm-format.js';
import { recordingUnavailable, type PrepareAudioSettings } from './preparation.js';
import { readAudioPrefix } from './upload.js';

const paddedHeaderLimit = 64 * 1024;

function nextPaddedPrefix(bytes: Uint8Array) {
	if (audioContainer(bytes)) return undefined;
	if (bytes.length < audioPrefixBytes) return audioPrefixBytes;
	const needed = paddedHeaderEvidence(bytes);
	if (typeof needed !== 'number' || needed > paddedHeaderLimit) return undefined;
	// Grow geometrically so a long series of small boxes cannot cause repeated rescans for every box.
	return Math.min(paddedHeaderLimit, Math.max(needed, bytes.length * 2));
}

async function finitePrefix(source: Uint8Array | Blob, signal: AbortSignal, probe?: typeof nextPaddedPrefix) {
	let length = audioPrefixBytes;
	let bytes: Uint8Array = new Uint8Array(0);
	for (;;) {
		if (source instanceof Blob) {
			const next = new Uint8Array(await source.slice(bytes.length, length).arrayBuffer());
			signal.throwIfAborted();
			if (bytes.length) {
				const expanded = new Uint8Array(bytes.length + next.length);
				expanded.set(bytes); expanded.set(next, bytes.length); bytes = expanded;
			} else bytes = next;
		} else bytes = source.subarray(0, length);
		const next = probe?.(bytes);
		if (next === undefined || bytes.length < length) return bytes;
		length = next;
	}
}

/** Classify a described upload once, before selecting the PCM or container reader. */
export async function* prepareBrowserInput(request: Open, signal: AbortSignal, recording?: (request: Open, signal: AbortSignal) => Pipeline) {
	const settings = request.settings as PrepareAudioSettings;
	let { source } = request;
	if (request.layout && (source instanceof Uint8Array || Array.isArray(source))) return yield* prepareDecodedAudio(source, request.layout, settings);
	const layout = settings.sourceFormat;
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	const cancel = () => { void reader?.cancel().catch(() => { /* May already be errored. */ }); };
	try {
		if (layout && typeof source !== 'string' && !Array.isArray(source)) {
			const mime = source instanceof Blob ? audioMediaType(source.type) : undefined;
			const probe = encodedAudioType(mime) ? undefined : nextPaddedPrefix;
			let prefix: Uint8Array;
			if (source instanceof ReadableStream) {
				const owned = reader = source.getReader();
				signal.addEventListener('abort', cancel, { once: true });
				const read = await readAudioPrefix(owned, signal, probe);
				prefix = read.prefix;
				const replay = [prefix, read.remainder].filter(bytes => bytes.length);
				source = new ReadableStream<Uint8Array>({
					async pull(controller) {
						const part = replay.shift();
						if (part) { controller.enqueue(part); return; }
						const item = read.eof ? undefined : await owned.read();
						if (!item || item.done) controller.close();
						else controller.enqueue(item.value);
					},
					cancel: reason => owned.cancel(reason),
				}, { highWaterMark: 0 });
			} else prefix = await finitePrefix(source, signal, probe);

			const evidence = audioContainer(prefix) ?? (probe && prefix.length >= audioPrefixBytes ? paddedHeaderEvidence(prefix) : undefined);
			if (typeof evidence === 'number' && mime === undefined) {
				throw new ValidationError('Cannot identify audio after checking a plausible container header. Supply a Blob with its encoded media type, remove sourceFormat for a recording, or use an audio/pcm Blob or numeric PCM samples for raw audio.');
			}
			const container = typeof evidence === 'string' ? evidence : undefined;
			if (!container && !encodedAudioType(mime)) {
				if (source instanceof Blob && mime === 'audio/pcm') checkMimeLayout(source.type, layout.sampleRate, layout.channels);
				const samples = source instanceof Blob ? source.stream() : source;
				return yield* prepareDecodedAudio(samples, sampleFormat(layout, source), settings, source instanceof Blob ? source.size : undefined);
			}
			if (!container && (mime === 'audio/pcmu' || mime === 'audio/pcma' || mime === 'audio/l16')) {
				throw new ValidationError('The browser cannot open this headerless audio encoding.');
			}
		}
		if (!recording) throw new ConfigError(recordingUnavailable);
		return yield* recording({ ...request, source }, signal);
	} finally {
		if (reader) {
			signal.removeEventListener('abort', cancel);
			await reader.cancel().catch(() => { /* Preserve the read or conversion error. */ });
			reader.releaseLock();
		}
	}
}
