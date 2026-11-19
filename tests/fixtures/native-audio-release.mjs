// Explicit release evidence for this host. Does not certify other platforms or legal compliance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, readdir, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = resolve(import.meta.dirname, '../..');
const require = createRequire(join(workspace, 'package.json'));
const entry = await realpath(require.resolve('node-av'));
const nativeRoot = dirname(dirname(entry));
const nativePackage = JSON.parse(await readFile(join(nativeRoot, 'package.json'), 'utf8'));
assert.equal(nativePackage.name, 'node-av-lgpl', 'Release baseline must use the LGPL alias.');
assert.equal(nativePackage.version, '7.1.0', 'Re-audit source/build provenance when upgrading.');
const av = await import(pathToFileURL(entry).href);
const binary = Object.keys(require.cache).find(file => file.endsWith('node-av.node'));
assert(binary, 'Record the loaded addon, not only a declared optional dependency.');
const artifactRoot = dirname(binary);
const artifact = JSON.parse(await readFile(join(artifactRoot, 'package.json'), 'utf8'));
assert.equal(artifact.version, nativePackage.version);
assert.equal(artifact.license, 'LGPL-3.0-or-later');
const ffmpeg = av.getFFmpegInfo();
assert.doesNotMatch(ffmpeg.configuration, /--enable-(?:gpl|nonfree)(?:\s|$)/);
for (const codec of ['libx264', 'libx265', 'libfdk_aac']) assert.equal(av.Codec.findEncoderByName(codec), null);
const notice = await readFile(join(artifactRoot, 'LICENSE.md'), 'utf8');
const licenses = await readdir(join(artifactRoot, 'licenses'));
assert(licenses.includes('LGPL-3.0.txt') && licenses.includes('GPL-3.0.txt'));
const sourceLinks = [...notice.matchAll(/https:\/\/github\.com\/[^)\s]+/g)].map(match => match[0]);
assert(sourceLinks.length > 0, 'Native notice must identify its source/build materials.');

const destination = join(workspace, '.cache/native-audio-release');
await mkdir(destination, { recursive: true });
const npm = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const [packed] = JSON.parse(execFileSync(process.execPath, [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', destination],
  { cwd: workspace, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }));
const packedNames = packed.files.map(file => file.path);
assert(!packedNames.some(file => /(?:\.(?:node|dll|so(?:\.\d+)*|dylib|exe|a|lib)|\.env(?:\..*)?)$/i.test(file)), 'Casai must not ship native binaries or credentials.');
for (const file of ['dist/index.js', 'dist/audio/native.js', 'dist/audio/worker-sources.js', 'LICENSE']) assert(packedNames.includes(file), file);
const manifest = JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8'));
for (const hook of ['preinstall', 'install', 'postinstall']) assert.equal(manifest.scripts[hook], undefined);
assert.equal(manifest.peerDependenciesMeta['node-av'].optional, true);
assert.equal(manifest.dependencies?.['node-av'], undefined);
assert.equal(manifest.optionalDependencies?.['node-av'], undefined);

// Registry identities are provenance evidence, not execution evidence for other targets.
const packages = await Promise.all([nativePackage.name, ...Object.keys(nativePackage.optionalDependencies)].map(async name => {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${nativePackage.version}`);
  assert(response.ok, `${name}: ${response.status}`);
  const metadata = await response.json();
  assert.equal(metadata.version, nativePackage.version);
  assert.equal(metadata.license, name === nativePackage.name ? 'MIT' : 'LGPL-3.0-or-later');
  assert(metadata.dist.integrity && metadata.dist.attestations?.provenance);
  return { name, version: metadata.version, os: metadata.os, cpu: metadata.cpu, libc: metadata.libc,
    license: metadata.license, gitHead: metadata.gitHead, integrity: metadata.dist.integrity,
    provenance: metadata.dist.attestations, unpackedSize: metadata.dist.unpackedSize };
}));
const sha256 = data => createHash('sha256').update(data).digest('hex');
const report = {
  date: new Date().toISOString(), host: { platform: process.platform, arch: process.arch, node: process.version },
  casai: { file: packed.filename, sha256: sha256(await readFile(join(destination, packed.filename))),
    bytes: packed.size, files: packed.files.length, nativeBinaries: false, installHooks: false },
  native: { name: artifact.name, version: artifact.version, license: artifact.license,
    sha256: sha256(await readFile(binary)), ffmpeg, sourceLinks, licenses },
  packages,
  limitations: ['Other targets have registry metadata only; run native integration on each actual target.',
    'Registry attestations are recorded here; verify signatures with npm audit signatures in the native installation project.',
    'Source links and license texts do not establish complete dependency notices or a successful rebuild/relink.'],
};
const filename = join(destination, `${process.platform}-${process.arch}.json`);
await writeFile(filename, JSON.stringify(report, null, 2) + '\n');
console.log(`Native release evidence: ${filename}`);
console.log(`Verified ${artifact.name}@${artifact.version}; Casai archive has ${packed.files.length} files and no native payload/install hook.`);
console.log(`Recorded ${packages.length - 1} published platform artifacts; only ${process.platform}/${process.arch} executed here.`);
