import { build } from 'esbuild';
import { mkdtemp, mkdir, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

await mkdir('.cache', { recursive: true });
const stage = await mkdtemp(resolve('.cache/device-package-'));
for (const name of ['package.json', 'src', 'dist']) await cp(name, join(stage, name), { recursive: true });
execFileSync(process.execPath, ['scripts/build-recording-worker.mjs', resolve(process.argv[2]), stage], { stdio: 'inherit' });
await build({
  stdin: { contents: "export { Transcriber, Translator } from 'casai'; export { createOpenAI } from '@ai-sdk/openai';", resolveDir: stage },
  bundle: true, platform: 'browser', minify: true, target: 'es2022', format: 'iife', globalName: 'casaiAudio',
  outfile: 'tests/fixtures/recorder-devices/casai-audio.js',
});
