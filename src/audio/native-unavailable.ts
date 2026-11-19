import { ConfigError } from '../errors.js';
import type { AudioSource, PrepareAudioSettings, PreparedAudioFor } from './preparation.js';

export function prepareAudio<T extends PrepareAudioSettings>(_audio: AudioSource, _settings: T): Promise<PreparedAudioFor<T>> {
	return Promise.reject(new ConfigError(
		'Native audio preparation requires Node.js with node-av installed. ' +
		'Pass PCM or an uncompressed WAV directly to Transcriber or Translator in this runtime. ' +
		'For other codecs, pass the recording to .loadsAudio on your Node.js server.',
	));
}
