import { build, transform } from 'esbuild';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

export async function buildRecordingWorker(entry) {
  const result = await build({ entryPoints: [fileURLToPath(new URL('recording-worker.entry.mjs', import.meta.url))],
    alias: { mediabunny: resolve(entry) }, bundle: true, minify: true, write: false, platform: 'browser', format: 'iife', target: 'es2022' });
  return result.outputFiles[0].text;
}

// Called on an isolated npm package during qualification. Include the exact covered source alongside its bundle.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [entry, stage] = process.argv.slice(2);
  const checkout = execFileSync('git', ['-C', dirname(entry), 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const upstream = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'));
  if (upstream.name !== 'mediabunny') throw Error('Expected a Mediabunny source checkout.');
  const source = 'export const recordingWorkerSource: string = ' + JSON.stringify(await buildRecordingWorker(entry)) + ';\n';
  await writeFile(join(stage, 'src/audio/recording-worker-source.ts'), source);
  const emitted = await transform(source, { loader: 'ts', format: 'esm', sourcemap: 'external', sourcefile: '../../src/audio/recording-worker-source.ts' });
  await writeFile(join(stage, 'dist/audio/recording-worker-source.js'), emitted.code + '//# sourceMappingURL=recording-worker-source.js.map\n');
  await writeFile(join(stage, 'dist/audio/recording-worker-source.js.map'), emitted.map);
  const covered = join(stage, 'vendor/mediabunny');
  for (const name of ['src', 'shared', 'LICENSE', 'package.json', 'tsconfig.json']) await cp(join(checkout, name), join(covered, name), { recursive: true });
  const revision = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await writeFile(join(covered, 'NOTICE'), `Mediabunny ${upstream.version}, based on ${revision}.\nThe corresponding source, including local changes, is in src/ and shared/ under MPL-2.0. See LICENSE.\n`);
  const manifest = JSON.parse(await readFile(join(stage, 'package.json'), 'utf8'));
  manifest.version += '-recorder-candidate'; manifest.private = true;
  manifest.files.push('vendor/mediabunny');
  await writeFile(join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
}
