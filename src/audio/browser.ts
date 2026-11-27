import { ConfigError, ValidationError } from '../errors.js';
import { isAudioBufferSource, isWebURL } from '../runtime/web-input.js';
import { browserTargetSupported } from './browser-pcm.js';
import { browserResourceURL, openBrowserWorker } from './browser-worker.js';
import { isPcmSamples, sampleFormat } from './pcm-format.js';
import { recordingUnavailable } from './preparation.js';
import type { AudioSource, PrepareAudioSettings } from './preparation.js';

export async function openAudio<T extends PrepareAudioSettings>(source: AudioSource, settings: T & { supplied?: object | undefined }) {
	const { mediaSettings, fileAudioTarget } = settings;
	if (mediaSettings?.track !== undefined || mediaSettings?.format !== undefined || Object.values(mediaSettings?.options ?? {}).some(value => value != null)) {
		const ErrorClass = Object.hasOwn(settings.supplied ?? {}, 'mediaSettings') ? ValidationError : ConfigError;
		throw new ErrorClass('Browser audio preparation requires default mediaSettings. Track indexes, demuxer names and native options apply on Node.js.');
	}
	if (fileAudioTarget && !browserTargetSupported(fileAudioTarget)) {
		const ErrorClass = Object.hasOwn(settings.supplied ?? {}, 'fileAudioTarget') ? ValidationError : ConfigError;
		throw new ErrorClass('Unsupported primary browser fileAudioTarget.');
	}
	let layout;
	if (isAudioBufferSource(source)) layout = { channels: source.numberOfChannels, sampleRate: source.sampleRate, encoding: 'pcm_f32le' } as const;
	else if (isPcmSamples(source) && settings.sourceFormat) layout = sampleFormat(settings.sourceFormat, source);
	if (typeof source === 'string' || isWebURL(source)) source = browserResourceURL(source);
	const codec = layout ? undefined : (await import('./recording-worker-source.js')).recordingWorkerSource;
	if (!layout && !codec && (!settings.sourceFormat || typeof source === 'string')) throw new ConfigError(recordingUnavailable);
	return openBrowserWorker(source, settings, layout, codec ?? (await import('./browser-worker-source.js')).browserWorkerSource);
}
