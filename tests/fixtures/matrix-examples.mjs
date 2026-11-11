// Generate and type-check the displayed examples, not hand-maintained copies.
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { components, render, validateOptions, selectOption, visibleGroups } from '../../docs/matrix/matrix.js';
import { multiline } from '../../docs/matrix/shared.js';
import { checkReference } from './matrix-reference.mjs';

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
  const authored = await readdir(new URL('docs/matrix/', root));
  assert.deepEqual(authored.filter(name => name.endsWith('.js')).sort(), ['matrix.js', 'shared.js', 'reference.js', ...components.map(item => item.file)].sort(), 'One renderer per catalog family plus shared documentation modules');
  assert.deepEqual(authored.filter(name => /\.(cat|cas)$/.test(name)).sort(), components.flatMap(item => item.resources).sort(), 'No duplicated streaming resources');
  const tricky = '{{ value }}\n${notJavaScript}\n`backticks` \\ slashes';
  assert.equal(Function(`return ${multiline(tricky)}`)(), tricky);
  const examples = [], ids = new Set();
  for (const component of components) {
    assert.equal(component.groups.some(group => group.choices.some(choice => choice.id === 'run')), !['Config', 'Context'].includes(component.name));
    for (const options of selections(component)) {
      // Toggles maintain valid, ordered selections without full runtime validation.
      for (const group of visibleGroups(component.name, options)) for (const choice of group.choices) {
        const active = !options.includes(choice.id);
        const next = selectOption(component.name, options, choice.id, active);
        assert.equal(next.includes(choice.id), active);
        assert.deepEqual(validateOptions(component.name, next), next);
      }
      const example = await render(component.name, options, { readText });
      assert(!ids.has(example.id), `Duplicate ID: ${example.id}`);
      ids.add(example.id);
      assert.equal(example.explanations.length, options.length);
      assert.equal(example.files[0].name, `${component.name}.ts`);
      assert(!example.files[0].code.includes('__MATRIX_'), example.id);
      const planned = component.name === 'Translator' && !options.includes('asStream');
      assert.equal(example.status, planned ? 'planned' : 'implemented', example.id);
      if (planned) {
        assert.match(example.notice, /Planned API: complete Translator is not implemented yet/);
        assert(example.files[0].code.startsWith(`// ${example.notice}\n`));
        // Check syntax without inventing a Translator implementation or declaration.
        stripTypeScriptTypes(example.files[0].code);
        assert.match(example.files[0].code, /return \{ audio: result\.audio, sourceText: result\.sourceText, translationText: result\.translationText \}/);
        assert(!example.files[0].code.includes('result.fullStream'));
      } else assert.equal(example.notice, undefined);
      if (['SpeechGenerator', 'Transcriber'].includes(component.name)) {
        const api = `${options.includes('asStream') ? 'Streaming' : ''}${component.name}`;
        assert.match(example.files[0].code, new RegExp(`\\b${api}[.(]`), 'Generate the current SDK-facing factory');
        assert(!example.files[0].code.includes('.asStream'), 'Audio .asStream API is not implemented yet');
      }
      for (const file of example.files.slice(1)) assert.equal(file.code, await readText(new URL(`../../docs/matrix/${file.name}`, import.meta.url)));
      const folder = new URL(`${example.id}/`, destination);
      await mkdir(folder, { recursive: true });
      for (const file of example.files) await writeFile(new URL(file.name, folder), file.code);
      examples.push({ ...example, url: new URL(example.files[0].name, folder) });
    }
  }
  // A streaming toggle changes the factory and result handling, not the scenario.
  for (const complete of examples.filter(example => example.status === 'planned')) {
    const streaming = examples.find(example => example.component === complete.component
      && example.activeOptions.includes('asStream') && example.activeOptions.length === complete.activeOptions.length + 1
      && complete.activeOptions.every(id => example.activeOptions.includes(id)));
    assert(streaming, `Missing streaming counterpart for ${complete.id}`);
    const code = complete.files[0].code.split('\n').slice(1).join('\n');
    const prefix = source => source.slice(0, source.indexOf('  const result = await '));
    assert.deepEqual(prefix(code).replace(/\bTranslator(?=,| \})/g, 'StreamingTranslator').replace('= Translator', '= StreamingTranslator'), prefix(streaming.files[0].code));
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
  assert.throws(() => validateOptions('SpeechGenerator', ['textStream']));
  assert.throws(() => validateOptions('SpeechGenerator', ['asStream', 'withScript', 'textStream']));
  validateOptions('Transcriber', ['asTool']);
  validateOptions('Transcriber', ['asStream', 'withScript', 'asTool', 'run']);
  validateOptions('SpeechGenerator', ['asStream', 'textStream', 'run']);
  assert.throws(() => validateOptions('ImageGenerator', ['mask']));
  assert.throws(() => validateOptions('Embedder', ['withTemplate', 'batch']));
  assert.deepEqual(selectOption('ImageGenerator', ['referenceImage', 'mask', 'count'], 'referenceImage', false), ['count']);
  assert.deepEqual(selectOption('ImageGenerator', ['withScript', 'useTools', 'run'], 'withScript', false), ['run']);
  assert.deepEqual(selectOption('LLMAgent', ['useTools', 'resume'], 'useTools', false), []);
  assert.deepEqual(selectOption('LLMAgent', ['withTemplate', 'run'], 'loadTemplate'), ['loadTemplate', 'run']);
  assert(!visibleGroups('Transcriber', ['asStream']).some(group => group.choices.some(choice => choice.id === 'asTool')));
  assert(!visibleGroups('Transcriber', ['asTool']).some(group => group.choices.some(choice => choice.id === 'asStream')));
  assert(visibleGroups('Transcriber', ['asStream', 'withScript']).some(group => group.choices.some(choice => choice.id === 'asTool')));
  assert.deepEqual(selectOption('SpeechGenerator', ['asStream', 'textStream', 'run'], 'asStream', false), ['run']);
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
  assert.throws(() => validateOptions('Translator', ['asTool']));
  validateOptions('Translator', ['withScript', 'useTools', 'run']);
  validateOptions('Translator', ['asStream', 'withScript', 'useTools', 'run']);
  const llm = components.find(item => item.name === 'LLMAgent');
  assert.equal(llm.experimental, undefined);
  assert(llm.groups.flatMap(group => group.choices).every(option => option.experimental === undefined));
  // Explicit files keep stale generated cache entries out of compilation.
  await writeFile(new URL('tsconfig.json', destination), JSON.stringify({
    extends: '../../tsconfig.json', compilerOptions: { noEmit: true, customConditions: ['casai-source'] },
    include: [], files: examples.filter(example => example.status === 'implemented').map(example => `${example.id}/${example.files[0].name}`),
  }, null, 2));
  await checkReference(examples);
  console.log(`Checked ${examples.filter(example => example.status === 'planned').length} planned selections for syntax, shared sources and matching streaming counterparts.`);
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
