// Generate and type-check the displayed examples, not hand-maintained copies.
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile, realpath, rm } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { components, render, validateOptions, selectOption, visibleGroups } from '../../docs/matrix/matrix.js';
import { multiline, renderExample } from '../../docs/matrix/shared.js';
import { checkReference } from './matrix-reference.mjs';
import { checkBundle } from './matrix-bundle.mjs';
import { checkPackage } from './matrix-package.mjs';
import { executesCurrentSource } from './matrix-availability.mjs';

export const root = new URL('../../', import.meta.url);
export const destination = new URL('.cache/matrix/', root);
const readText = url => readFile(url, 'utf8');

export function selections(component) {
  const products = component.groups.reduce((sets, group) => sets.flatMap(set => [set, ...group.choices.map(choice => [...set, choice.id])]), [[]]);
  return products.filter(set => {
    try { validateOptions(component.name, set); return true; } catch { return false; }
  });
}

export async function generate() {
  const target = await realpath(destination).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return resolve(fileURLToPath(destination));
  });
  assert.equal(relative(await realpath(root), target).replaceAll('\\', '/'), '.cache/matrix', 'Only clear the matrix cache inside this workspace');
  await rm(destination, { recursive: true, force: true });
  const authored = await readdir(new URL('docs/matrix/', root));
  assert.deepEqual(authored.filter(name => name.endsWith('.js')).sort(), ['matrix.js', 'shared.js', 'reference.js', 'resources.js', 'introduction.js', ...components.map(item => item.file)].sort(), 'One renderer per catalog family plus shared documentation modules');
  assert.deepEqual(authored.filter(name => /\.(cat|cas|txt)$/.test(name)).sort(), components.flatMap(item => item.resources).sort(), 'No duplicated streaming resources');
  const tricky = '{{ value }}\n${notJavaScript}\n`backticks` \\ slashes';
  assert.equal(Function(`return ${multiline(tricky)}`)(), tricky);
  assert.throws(() => renderExample({ component: 'Function', options: ['asTool'], description: 'Reader caption', variable: 'task' }), /model-facing toolDescription/);
  const examples = [], ids = new Set();
  for (const component of components) {
    const defaultCode = (await render(component.name)).files[0].code;
    const functionName = defaultCode.match(/export async function (\w+)\(/)?.[1];
    assert(functionName && !['example', 'undefined'].includes(functionName), `${component.name}: use a descriptive entry point`);
    assert(!defaultCode.includes('const input ='), `${component.name}: inline single-use example input`);
    assert(!defaultCode.includes('${'), `${component.name}: pass ready-made strings in the default example`);
    assert.equal(component.groups.some(group => group.choices.some(choice => choice.id === 'run')), !['Config', 'Context'].includes(component.name));
    for (const options of selections(component)) {
      // Toggles maintain valid, ordered selections without full runtime validation.
      for (const group of visibleGroups(component.name, options)) for (const choice of group.choices) {
        const active = !options.includes(choice.id);
        const next = selectOption(component.name, options, choice.id, active);
        assert.equal(next.includes(choice.id), active);
        assert.deepEqual(validateOptions(component.name, next), next);
      }
      const reads = [];
      const example = await render(component.name, options, { readText: url => { reads.push(fileURLToPath(url).split(/[\\/]/).at(-1)); return readText(url); } });
      const expectedResource = options.includes('loadText') ? `${component.name}.txt` : options.some(id => ['withTemplate', 'loadTemplate'].includes(id)) ? `${component.name}.cat`
        : options.some(id => ['withScript', 'loadScript'].includes(id)) ? `${component.name}.cas`
        : !options.includes('withFunction') && ['Template', 'Script'].includes(component.name) ? `${component.name}.${component.name === 'Template' ? 'cat' : 'cas'}` : null;
      assert.deepEqual(reads, expectedResource ? [expectedResource] : [], `${component.name}: load only the selected source`);
      assert(!ids.has(example.id), `Duplicate ID: ${example.id}`);
      ids.add(example.id);
      assert.equal(example.explanations.length, options.length + example.workInProgress.length);
      assert.equal(example.files[0].name, `${component.name}.ts`);
      assert(!example.files[0].code.includes('__MATRIX_'), example.id);
      assert(example.files[0].code.includes(`export async function ${functionName}(`), `${example.id}: keep the scenario name across options`);
      const future = !executesCurrentSource(example);
      assert(!Object.hasOwn(example, 'status'));
      assert(!Object.hasOwn(example, 'notice'));
      if (future) assert(example.workInProgress.length, `${example.id}: pending examples need a work-in-progress marker`);
      if (options.includes('loadAudio') && options.includes('asTool')) {
        const code = example.files[0].code;
        assert.match(code, /inputSchema: z\.object\(\{\}\)/, `${example.id}: the model cannot supply resource selectors`);
        assert.match(code, /audio: recordingUrl/, `${example.id}: the application configures the resource`);
      }
      if (future) {
        // Check syntax without inventing a planned implementation or declaration.
        stripTypeScriptTypes(example.files[0].code);
      }
      if (['SpeechGenerator', 'Transcriber'].includes(component.name)) {
        const api = component.name;
        assert.match(example.files[0].code, new RegExp(`\\b${api}[.(]`), 'Generate the family factory');
        assert.equal(example.configuration.factory.endsWith('.asStream'), options.includes('asStream'));
      }
      for (const file of example.files.slice(1)) assert.equal(file.code, await readText(new URL(`../../docs/matrix/${file.name}`, import.meta.url)));
      const folder = new URL(`${example.id}/`, destination);
      await mkdir(folder, { recursive: true });
      for (const file of example.files) await writeFile(new URL(file.name, folder), file.code);
      examples.push({ ...example, url: new URL(example.files[0].name, folder) });
    }
  }
  // A streaming toggle changes the factory and result handling, not the scenario.
  for (const complete of examples.filter(example => example.component === 'Translator' && !example.activeOptions.some(id => ['asStream', 'asTool'].includes(id)))) {
    const streaming = examples.find(example => example.component === complete.component
      && example.activeOptions.includes('asStream') && example.activeOptions.length === complete.activeOptions.length + 1
      && complete.activeOptions.every(id => example.activeOptions.includes(id)));
    assert(streaming, `Missing streaming counterpart for ${complete.id}`);
    const code = complete.files[0].code;
    const prefix = source => source.slice(0, source.indexOf('  const result = await '));
    assert.deepEqual(prefix(code).replace(/(= Translator(?:\.\w+)?)(\()/, '$1.asStream$2'), prefix(streaming.files[0].code));
    assert.equal(code.split('\n').find(line => line.includes('const result = await')), streaming.files[0].code.split('\n').find(line => line.includes('const result = await')));
    assert.deepEqual(complete.files.slice(1), streaming.files.slice(1));
  }
  // Direct rendering checks selections before loading resources or generating code.
  await assert.rejects(render('LLMAgent', ['withTemplate', 'withScript'], {
    readText: () => assert.fail('Invalid selections must fail before resource loading'),
  }), /Choose at most one source option/);
  assert.throws(() => validateOptions('LLMAgent', ['asTool', 'asStream']));
  assert.throws(() => validateOptions('LLMAgent', ['resume']));
  assert.throws(() => validateOptions('ImageGenerator', ['useTools']));
  assert.throws(() => validateOptions('Transcriber', ['asStream', 'asTool']));
  assert.throws(() => validateOptions('SpeechGenerator', ['asStream', 'asTool']));
  validateOptions('SpeechGenerator', ['textStream']);
  validateOptions('SpeechGenerator', ['textStream', 'asTool']);
  assert.throws(() => validateOptions('SpeechGenerator', ['asStream', 'withScript', 'textStream']));
  validateOptions('Transcriber', ['asTool']);
  assert.throws(() => validateOptions('Transcriber', ['asStream', 'withScript', 'asTool', 'run']));
  validateOptions('SpeechGenerator', ['asStream', 'textStream', 'run']);
  assert.throws(() => validateOptions('ImageGenerator', ['mask']));
  assert.throws(() => validateOptions('Embedder', ['withTemplate', 'batch']));
  assert.deepEqual(selectOption('ImageGenerator', ['referenceImage', 'mask', 'count'], 'referenceImage', false), ['count']);
  assert.deepEqual(selectOption('ImageGenerator', ['withScript', 'useTools', 'run'], 'withScript', false), ['run']);
  assert.deepEqual(selectOption('LLMAgent', ['useTools', 'resume'], 'useTools', false), []);
  assert.deepEqual(selectOption('LLMAgent', ['withTemplate', 'run'], 'loadTemplate'), ['loadTemplate', 'run']);
  assert(!visibleGroups('Transcriber', ['asStream']).some(group => group.choices.some(choice => choice.id === 'asTool')));
  assert(!visibleGroups('Transcriber', ['asTool']).some(group => group.choices.some(choice => choice.id === 'asStream')));
  assert(!visibleGroups('Transcriber', ['asStream', 'withScript']).some(group => group.choices.some(choice => choice.id === 'asTool')));
  assert.deepEqual(selectOption('SpeechGenerator', ['asStream', 'textStream', 'run'], 'asStream', false), ['run', 'textStream']);
  assert.deepEqual(selectOption('Transcriber', ['asTool', 'asStream', 'withScript', 'run'], 'withScript', false), ['asStream', 'run']);
  // Experimental scope belongs to the operation, not every mode of its family.
  for (const name of ['SpeechGenerator', 'Transcriber']) {
    const item = components.find(component => component.name === name);
    assert.equal(item.experimental, undefined, `${name} complete mode is not experimental`);
    const options = visibleGroups(name, ['asStream']).flatMap(group => group.choices);
    assert.deepEqual(options.filter(option => option.experimental).map(option => option.id), ['asStream']);
    assert.equal(typeof options.find(option => option.id === 'asStream').experimental, 'string');
  }
  assert.equal(typeof components.find(item => item.name === 'Translator').experimental, 'string');
  validateOptions('Translator', ['asTool']);
  assert.throws(() => validateOptions('Translator', ['asStream', 'asTool']));
  validateOptions('Translator', ['withScript', 'useTools', 'run']);
  validateOptions('Translator', ['asStream', 'withScript', 'useTools', 'run']);
  const llm = components.find(item => item.name === 'LLMAgent');
  assert.equal(llm.experimental, undefined);
  assert(llm.groups.flatMap(group => group.choices).every(option => option.experimental === undefined));
  await checkPackage(root, destination);
  await writeFile(new URL('_contracts.ts', destination), `import { describe, type SelectionExport } from '@casai/matrix/reference';
import { render, validateOptions } from '@casai/matrix';
import type { ChoiceId, ComponentName } from '@casai/matrix';
import type { ConfigSectionId, SDKGroupId } from '@casai/matrix/reference';
// @ts-expect-error Component names are checked.
const typoComponent: ComponentName = 'LLMAgentt';
// @ts-expect-error Choice IDs are checked.
const typoChoice: ChoiceId = 'strcutured';
// @ts-expect-error Reference sections are checked.
const typoSection: ConfigSectionId = 'settings';
// @ts-expect-error SDK groups are checked.
const typoGroup: SDKGroupId = 'requests';
void [typoComponent, typoChoice, typoSection, typoGroup];
validateOptions('LLMAgent');
await render('Context');
const selected: SelectionExport = { schemaVersion: 5, reference: describe('LLMAgent'), example: await render('LLMAgent', [], { readText: async () => '' }) };
const origin: 'casai' | 'cascada' | 'ai-sdk' = selected.reference.config.properties.model.origin;
void origin;
// @ts-expect-error A missing/renamed reference field must not silently become any.
void selected.reference.topics;
// @ts-expect-error Serialized example files contain strings, not DOM elements.
const source: HTMLElement = selected.example.files[0].code;
void source;
`);
  // Compile only against real source. Syntax and data contracts cover every example.
  await writeFile(new URL('tsconfig.json', destination), JSON.stringify({
    extends: '../../tsconfig.json', compilerOptions: { noEmit: true, customConditions: ['casai-source'] },
    include: [], files: ['_contracts.ts', '_data-contracts.ts', ...examples.filter(executesCurrentSource).map(example => `${example.id}/${example.files[0].name}`)],
  }, null, 2));
  await checkReference(examples);
  await checkBundle(examples);
  console.log(`Checked ${examples.filter(example => !executesCurrentSource(example)).length} planned API selections for syntax, data contracts and shared sources; runtime coverage awaits production implementation.`);
  return examples;
}

export function typecheck() {
  const started = performance.now();
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('node_modules/@typescript/native/bin/tsc', root)), '-p', fileURLToPath(new URL('tsconfig.json', destination))], {
    cwd: fileURLToPath(root), encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, result.error?.message ?? 'Matrix examples must type-check');
  console.log(`Current matrix examples type-check passed (${((performance.now() - started) / 1000).toFixed(1)}s).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const examples = await generate();
  console.log(`Generated ${examples.length} matrix selections across ${components.length} components.`);
  if (!process.argv.includes('--generate-only')) typecheck();
}
