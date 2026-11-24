// Compile the private consumed surface against the actual optional peer, never an ambient shim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
require.resolve('node-av');
const filename = path.join(workspace, '.cache/phase6-native-interface.ts');
fs.mkdirSync(path.dirname(filename), { recursive: true });
fs.writeFileSync(filename, `
import * as av from 'node-av';
import type { NativeAv, NativePacket, NativeFrame, NativeStream } from '../src/audio/native-interface.js';
const packet: NativePacket = null! as av.Packet;
const frame: NativeFrame = null! as av.Frame;
const stream: NativeStream = null! as av.Stream;
const actual: NativeAv<av.AVSampleFormat, av.ChannelLayout, av.IOContext, av.FFEncoderCodec, av.Decoder, av.Frame, av.CodecParameters, av.AVSeekFlag> = av;
void [packet, frame, stream, actual];
`);
const compiler = path.join(path.dirname(require.resolve(`@typescript/typescript-${process.platform}-${process.arch}/package.json`)), 'lib', process.platform === 'win32' ? 'tsc.exe' : 'tsc');
const result = spawnSync(compiler, ['--ignoreConfig', '--strict', '--skipLibCheck', '--target', 'ES2022',
  '--lib', 'ES2022,DOM,ESNext.Disposable', '--types', 'node', '--module', 'NodeNext', '--noEmit', filename],
{ cwd: workspace, encoding: 'utf8', timeout: 60000 });
assert.equal(result.error, undefined);
assert.equal(result.status, 0, result.stdout + result.stderr);
console.log('Native audio interface matches the installed node-av exports.');
