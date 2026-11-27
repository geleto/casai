import { ConfigError } from '../errors.js';
import type { AudioSource, PrepareAudioSettings, PreparedAudioFor } from './preparation.js';

export function openAudio<T extends PrepareAudioSettings>(_source: AudioSource, _settings: T): Promise<PreparedAudioFor<T>> {
	return Promise.reject(new ConfigError('.loadsAudio requires a Node.js or browser runtime.'));
}
