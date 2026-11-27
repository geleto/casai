import { prepareBrowserInput } from './browser-input.js';
import { serveBrowserAudio } from './browser-worker-server.js';

serveBrowserAudio(prepareBrowserInput);
