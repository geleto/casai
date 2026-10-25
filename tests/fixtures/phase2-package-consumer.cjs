// Install the tarball outside this repository so workspace links/hoisting cannot
// satisfy a missing published dependency. Optionally install a packed engine candidate too.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'casai-package-'));
function run(executable, args, cwd = temporary) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', timeout: 180000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
function npm(args, cwd) {
  assert.ok(process.env.npm_execpath, 'Run this check through npm run test:package');
  return run(process.execPath, [process.env.npm_execpath, ...args], cwd);
}
try {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--engine'),
    'Usage: npm run test:package -- [--engine <built-engine-directory-or-tarball>]');
  let engine;
  if (args.length) {
    const candidate = fs.realpathSync(path.resolve(args[1]));
    if (fs.statSync(candidate).isDirectory()) {
      const [packedEngine] = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], candidate));
      assert.equal(packedEngine.name, 'cascada-engine');
      engine = path.join(temporary, packedEngine.filename);
    } else {
      assert.equal(path.extname(candidate), '.tgz', 'The engine candidate must be a built directory or .tgz file.');
      engine = candidate;
    }
  }
  const [packed] = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], workspace));
  fs.writeFileSync(path.join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temporary, packed.filename), ...engine ? [engine] : []]);
  const engineRoot = path.join(temporary, 'node_modules/cascada-engine');
  assert.equal(fs.realpathSync(engineRoot), engineRoot, 'The engine must be installed, not linked to a workspace.');
  if (engine) {
    const lock = JSON.parse(fs.readFileSync(path.join(temporary, 'package-lock.json'), 'utf8'));
    const entry = lock.packages['node_modules/cascada-engine'];
    assert.ok(!entry.link && entry.resolved.startsWith('file:') && entry.resolved.endsWith('.tgz'),
      'The engine must resolve to the supplied tarball.');
  }
  const installed = JSON.parse(fs.readFileSync(path.join(temporary, 'node_modules/casai/package.json'), 'utf8'));
  assert.equal(installed.dependencies.typescript, undefined);
  assert.equal(installed.dependencies['ts-node'], undefined);
  assert.equal(installed.dependencies.zod, undefined);
  assert.equal(installed.peerDependencies.ai, '^7.0.130');
  assert.equal(installed.peerDependencies.zod, '^4.6.5');
  assert.equal(installed.dependencies['@ai-sdk/provider-utils'], '^5.0.56');
  console.log(npm(['ls', 'casai', 'cascada-engine', 'ai', 'zod', '@ai-sdk/provider-utils']));
  // A second physical package exercises runtime identity and independent declarations.
  fs.cpSync(path.join(temporary, 'node_modules/casai'), path.join(temporary, 'casai-copy'), { recursive: true });
  const { createRequire } = require('node:module');
  const fromCasai = createRequire(path.join(temporary, 'node_modules/casai/package.json'));
  const fromSDK = createRequire(path.join(temporary, 'node_modules/ai/package.json'));
  assert.equal(fromCasai.resolve('@ai-sdk/provider-utils'), fromSDK.resolve('@ai-sdk/provider-utils'), 'Fresh installs should deduplicate SDK utilities.');
  fs.writeFileSync(path.join(temporary, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { create, z, streamSchema, collectStream, makeSharedIterable } from 'casai';
import { makeSharedIterable as nativeSharedIterable } from 'cascada-engine';
import { create as foreignCreate, streamSchema as foreignStreamSchema, textStreamSchema as foreignTextStreamSchema } from './casai-copy/dist/index.js';
assert.notEqual(create.Function, foreignCreate.Function);
const foreignTool = foreignCreate.Function.asTool({ inputSchema: z.object({ factor: z.number() }), context: { factor: 3 }, execute: input => input.factor });
const foreignOwner = create.Function({ tools: { foreignTool }, toolsContext: { foreignTool: { factor: 5 } }, execute: ({ foreignTool }) => foreignTool({}) });
assert.equal(await foreignOwner(), 5);
const textTool = create.Function.asTool({ inputSchema: z.object({}), schema: foreignTextStreamSchema(), execute: async function* () { yield 'ok'; } });
const arrayTool = create.Function.asTool({ inputSchema: z.object({}), schema: foreignStreamSchema(z.string().transform(Number)), execute: async function* () { yield '2'; } });
assert.equal(await textTool.execute({}, { toolCallId: 'text', messages: [], context: undefined }), 'ok');
assert.deepEqual(await arrayTool.execute({}, { toolCallId: 'array', messages: [], context: undefined }), [2]);
// Import resolution must remain inside the clean consumer, including from Casai.
const engineEntry = import.meta.resolve('cascada-engine');
assert.equal(realpathSync(fileURLToPath(engineEntry)), fileURLToPath(engineEntry));
assert.ok(engineEntry.startsWith(new URL('./node_modules/cascada-engine/', import.meta.url).href));
assert.equal(makeSharedIterable, nativeSharedIterable);
const component = create.Function({ inputSchema: z.object({ value: z.string().transform(Number) }),
  context: { value: '2', privateBinding: true }, execute: input => input.value + 1 });
assert.equal(await component(), 3);
const double = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: input => input.value * 2 });
const script = create.Script({ script: 'return double(value=value)', tools: { double },
  inputSchema: z.object({ value: z.string().transform(Number) }), context: { value: '3', privateBinding: true } });
assert.equal(await script(), 6);
const template = create.Template({ template: '{{ double(value=value) }}', tools: { double },
  inputSchema: z.object({ value: z.string().transform(Number) }), context: { value: '4' } });
assert.equal(await template(), '8');
const producer = create.Function({ schema: streamSchema(z.string().transform(Number)),
  execute: async function* () { yield '4'; } });
const shared = makeSharedIterable(await producer());
assert.deepEqual(await collectStream(shared), [4]);
await shared.dispose();
`);
  fs.writeFileSync(path.join(temporary, 'consumer.ts'), `
import { create, z } from 'casai';
import type { ComponentExecutionOptions, ToolContextSchemaConfig, StreamSchema } from 'casai';
import { create as foreignCreate, streamSchema as foreignStreamSchema, textStreamSchema as foreignTextStreamSchema } from './casai-copy/dist/index.js';
const foreignTool = foreignCreate.Function.asTool({ inputSchema: z.object({ factor: z.number() }), context: { factor: 3, db: () => 'private' }, execute: input => input.factor });
const foreignOwner = create.Function({ tools: { foreignTool }, toolsContext: { foreignTool: { factor: 5 } }, execute: ({ foreignTool }) => foreignTool({}) });
const foreignResult: Promise<number> = foreignOwner();
// @ts-expect-error Foreign private dependencies retain their type through binding.
create.Function({ tools: { foreignTool }, toolsContext: { foreignTool: { db: 1 } }, execute: () => 1 });
const required = foreignCreate.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: input => input.value });
const inherited = foreignCreate.Function({ tools: { required }, toolsContext: { required: { value: 4 } }, execute: ({ required }) => required({}) });
// @ts-expect-error A retained foreign callback may omit the bound default.
create.Function({ toolsContext: { required: {} } }, inherited);
create.Function({ toolsContext: { required: { value: 5 } } }, inherited);
const textTool = create.Function.asTool({ inputSchema: z.object({}), schema: foreignTextStreamSchema(), execute: async function* () { yield 'ok'; } });
const arrayTool = create.Function.asTool({ inputSchema: z.object({}), schema: foreignStreamSchema(z.string().transform(Number)), execute: async function* () { yield '2'; } });
create.Function({ tools: { textTool, arrayTool }, execute: async ({ textTool, arrayTool }) => {
  const text: string = await textTool({});
  const numbers: number[] = await arrayTool({});
  return { text, numbers };
} });
const component = create.Function({ inputSchema: z.object({ value: z.string().transform(Number) }),
  context: { value: '2' }, execute: input => {
    const options: ComponentExecutionOptions = input._toolOptions;
    const value: number = input.value;
    return value;
  } });
const result: Promise<number> = component();
// @ts-expect-error Calls accept schema input, not its parsed output.
component({ value: 3 });
const lookup = create.Function.asTool({ inputSchema: z.object({}), execute: () => 1 });
type Registry = { tools: { lookup: typeof lookup } };
declare const invalidSelection: Registry | (Registry & { toolChoice: { type: 'tool'; toolName: 'missing' } });
// @ts-expect-error A selection present in one configuration branch still needs a configured tool.
create.TextGenerator({ model: 'test', prompt: 'ready' }, { config: invalidSelection });
declare const validSelection: Registry | (Registry & { toolChoice: { type: 'tool'; toolName: 'lookup' } });
create.TextGenerator({ model: 'test', prompt: 'ready' }, { config: validSelection });
`);
  // The consumer's compiler is a test dependency, not part of Casai's runtime.
  const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'package.json'), 'utf8'));
  npm(['install', '--save-dev', '--ignore-scripts', '--no-audit', '--no-fund', `@typescript/native@${manifest.devDependencies['@typescript/native']}`]);
  run(process.execPath, ['node_modules/@typescript/native/bin/tsc', '--ignoreConfig', '--noEmit', '--strict',
    '--skipLibCheck', '--target', 'ES2022', '--module', 'nodenext', '--moduleResolution', 'nodenext', 'consumer.ts']);
  console.log('Packed declarations passed with an explicit consumer compiler.');
  run(process.execPath, ['consumer.mjs']);
  console.log('Packed consumer passed without workspace resolution.');
} finally {
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('casai-package-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
