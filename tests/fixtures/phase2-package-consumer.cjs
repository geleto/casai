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
  assert.ok(!packed.files.some(({ path: file }) => /(?:TextGenerator|TextStreamer|ObjectGenerator|ObjectStreamer|llm-component|call-arguments|function-prompt|types\/cascada)\./.test(file)),
    'Removed factories and adapters must not survive in the published package.');
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
import { create, z, streamSchema, collectStream, makeSharedIterable, raceLoaders, raceParent, overrideParent } from 'casai';
import { Output } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { makeSharedIterable as nativeSharedIterable, raceLoaders as nativeRaceLoaders } from 'cascada-engine';
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
assert.equal(raceLoaders, nativeRaceLoaders);
const baseLoader = {
  load: name => name === 'pages/main' ? { src: '{% include "./part" %}', path: 'base/' + name }
    : name === 'pages/part' ? 'base' : null,
  isRelative: name => name.startsWith('./'),
  resolve: (from, to) => new URL(to, new URL(from.slice(5), 'https://resources.test/')).pathname.slice(1),
};
const childLoader = name => name === 'pages/part' ? 'child' : null;
const baseTemplate = create.Template.loadsTemplate({ loader: [[baseLoader]], template: 'pages/main' });
assert.equal(await create.Template({ loader: null }, baseTemplate)(), 'base');
const childTemplate = create.Template({ loader: [childLoader] }, baseTemplate);
assert.equal(await childTemplate(), 'child');
const replacedTemplate = create.Template({ loader: overrideParent([[baseLoader]]) }, childTemplate);
assert.equal(await replacedTemplate(), 'base');
assert.equal(await create.Template.loadsTemplate({ loader: raceParent([baseLoader]), template: 'pages/main' })(), 'base');
const foreignLoader = foreignCreate.Config({ loader: overrideParent([baseLoader]) });
assert.equal(await create.Template.loadsTemplate({ template: 'pages/main' }, foreignLoader)(), 'base');
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
const finishReason = { unified: 'stop', raw: 'stop' };
const model = new MockLanguageModelV3({ doStream: async () => ({ stream: convertArrayToReadableStream([
  { type: 'stream-start', warnings: [] }, { type: 'text-start', id: 'a' },
  { type: 'text-delta', id: 'a', delta: 'answer' }, { type: 'text-end', id: 'a' },
  { type: 'finish', finishReason, usage },
]) }) });
const writer = create.LLMAgent.withTemplate.asStream({ model, prompt: '{{ topic }}', inputSchema: z.object({ topic: z.string() }), output: Output.text() });
const inheritedWriter = create.LLMAgent({}, create.Config({}, writer));
assert.equal(inheritedWriter.version, 'agent-v1');
assert.equal(inheritedWriter.config.streaming, true);
const answer = await inheritedWriter({ topic: 'recycling' });
assert.equal(await answer.value, 'answer');
assert.deepEqual(await collectStream(answer.textStream), ['answer']);
assert.equal(model.doStreamCalls.length, 1);
assert.equal(model.doStreamCalls[0].prompt.at(-1).content[0].text, 'recycling');
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
import { create, z, raceLoaders, raceParent, overrideParent } from 'casai';
import { Output } from 'ai';
import type { Agent, LanguageModel } from 'ai';
import type { ComponentExecutionOptions, ToolContextSchemaConfig, StreamSchema } from 'casai';
import type { LoaderGroup, LoaderInput, ParentLoader } from 'casai';
const loaderGroup: LoaderGroup = [[name => name === 'main' ? 'answer' : null], raceLoaders([[]])];
const parentLoader: ParentLoader = overrideParent(loaderGroup);
const loaderInput: LoaderInput = raceParent(loaderGroup);
const loaded = create.Template.loadsTemplate({ loader: parentLoader, template: 'main' });
const loadedValue: Promise<string> = loaded();
// @ts-expect-error Parent directives occupy the complete loader property.
create.Template.loadsTemplate({ loader: [loaderInput], template: 'main' });
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
declare const model: LanguageModel;
const writer = create.LLMAgent.withFunction.asStream({ model, inputSchema: z.object({ topic: z.string() }),
  output: Output.text(), prompt: context => context.topic,
  prepareCall: (request, config, context) => ({ ...request, temperature: context.topic.length ? 0 : 1 }),
});
const inheritedWriter = create.LLMAgent({}, create.Config({}, writer));
const nativeAgent: Agent<{ topic: string }> = inheritedWriter;
const finalText: Promise<string> = inheritedWriter({ topic: 'recycling' }).then(result => result.value);
// @ts-expect-error Inherited source still requires its declared input.
inheritedWriter();
// @ts-expect-error Native entry points retain the same required application context.
inheritedWriter.generate({ prompt: 'literal' });
// @ts-expect-error Calls accept schema input, not its parsed output.
component({ value: 3 });
const lookup = create.Function.asTool({ inputSchema: z.object({}), execute: () => 1 });
type Registry = { tools: { lookup: typeof lookup } };
declare const invalidSelection: Registry | (Registry & { toolChoice: { type: 'tool'; toolName: 'missing' } });
// @ts-expect-error A selection present in one configuration branch still needs a configured tool.
create.LLMAgent({ model: 'test', prompt: 'ready' }, { config: invalidSelection });
declare const validSelection: Registry | (Registry & { toolChoice: { type: 'tool'; toolName: 'lookup' } });
create.LLMAgent({ model: 'test', prompt: 'ready' }, { config: validSelection });
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
