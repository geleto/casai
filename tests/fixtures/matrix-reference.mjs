import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { describe, getSourceControl, selectSource, setLoads, configSections } from '../../docs/matrix/reference.js';
import { components, validateOptions } from '../../docs/matrix/matrix.js';
import api from '../../docs/matrix/reference/api.js';
import sdkDocs from '../../docs/matrix/reference/sdk-docs.js';

const root = new URL('../../', import.meta.url);

export async function checkReference(examples) {
  // Check pinned inputs without type-reflecting the entire library on every test run.
  for (const [name, version] of Object.entries(api.packages)) {
    const installed = JSON.parse(await readFile(new URL(`node_modules/${name}/package.json`, root), 'utf8'));
    assert.equal(installed.version, version, `${name}: refresh reference data with npm run docs:matrix`);
  }
  for (const [path, hash] of Object.entries(api.files)) {
    const source = await readFile(new URL(path, root), 'utf8');
    assert.equal(createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex'), hash, `${path}: refresh reference data with npm run docs:matrix`);
  }
  for (const example of examples) {
    const ref = describe(example.component, example.activeOptions);
    assert.equal(ref.status, example.status, example.id);
    assert.deepEqual(ref.activeOptions, example.activeOptions);
    assert.deepEqual(ref.config.sections.map(section => section.id), configSections.map(section => section.id));
    const ids = ref.config.sections.flatMap(section => section.propertyIds);
    assert.equal(new Set(ids).size, ids.length, 'Each property has one full explanation');
    assert.deepEqual(ids.sort(), Object.keys(ref.config.properties).sort());
    for (const property of Object.values(ref.config.properties)) {
      for (const key of ['name', 'type', 'description', 'default', 'override', 'inheritance', 'scope', 'origin']) assert(property[key], `${example.id}.${property.name}: missing ${key}`);
      assert(!property.locations.includes('construction') || property.name !== 'abortSignal');
    }
    const target = example.configuration;
    if (ref.form.factory) assert.equal(ref.form.factory, target.factory, example.id);
    const source = ts.createSourceFile(example.files[0].name, example.files[0].code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let declaration;
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === target.variable) declaration = node;
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert(declaration && ts.isCallExpression(declaration.initializer), `${example.id}: primary construction exists`);
    assert.equal(declaration.initializer.expression.getText(source), target.factory);
    const actualProperties = declaration.initializer.arguments[0].properties.map(property => property.name.getText(source));
    assert.deepEqual(target.properties, actualProperties, `${example.id}: used-property metadata matches the displayed code`);
    JSON.stringify(ref); // The web project needs plain portable data.
  }
  for (const component of components) {
    const ref = describe(component.name);
    assert(ref.info.input && ref.info.result);
    for (const concept of ref.concepts) assert(concept.title && concept.paragraphs.length);
  }
  assert.deepEqual(selectSource('LLMAgent', ['loadTemplate', 'run'], 'script'), ['loadScript', 'run']);
  assert.deepEqual(selectSource('LLMAgent', ['loadScript'], 'function'), ['withFunction']);
  assert.deepEqual(setLoads('LLMAgent', ['withTemplate', 'run'], true), ['loadTemplate', 'run']);
  assert.deepEqual(setLoads('LLMAgent', ['loadTemplate'], false), ['withTemplate']);
  assert.throws(() => setLoads('LLMAgent', ['withFunction'], true), /unavailable/);
  assert.throws(() => selectSource('Transcriber', [], 'template'), /Unsupported/);
  assert.equal(getSourceControl('Function'), null);
  assert.deepEqual(selectSource('Transcriber', ['asTool', 'asStream', 'loadScript'], 'default'), ['asStream']);
  validateOptions('Transcriber', selectSource('Transcriber', ['asStream', 'loadScript'], 'function'));
  const llm = describe('LLMAgent');
  assert.equal(llm.info.description, sdkDocs.generateText.description);
  assert.equal(llm.info.descriptionSource.reuse, 'verbatim');
  assert.equal(describe('LLMAgent', ['asStream']).info.description, sdkDocs.streamText.description);
  assert.equal(describe('SpeechGenerator', ['asStream']).info.description, sdkDocs.experimental_streamSpeech.description);
  assert.equal(describe('Transcriber', ['asStream']).info.description, sdkDocs.experimental_streamTranscribe.description);
  assert.equal(describe('Translator', ['asStream']).info.description, sdkDocs.experimental_streamTranslate.description);
  assert.notEqual(describe('Translator').info.description, sdkDocs.experimental_streamTranslate.description);
  for (const name of ['model', 'headers', 'providerOptions', 'onChunk', 'streamRetries', 'output', 'stopWhen']) {
    assert.equal(llm.config.properties[name].descriptionOrigin, 'ai');
    assert.equal(llm.config.properties[name].description, llm.config.properties[name].upstream.description);
  }
  assert.equal(describe('Decision').config.properties.headers.description, llm.config.properties.headers.description);
  assert.equal(llm.config.properties.prompt.descriptionOrigin, 'casai');
  assert(llm.config.properties.prompt.upstream.description, 'Keep the upstream text beside a Casai amendment');
  assert(llm.config.properties.tools, 'Unchecked useTools does not remove a supported property');
  assert(llm.config.sections.at(-1).methods.some(method => method.name === 'resume'), 'resume reference does not require the approval example');
  assert(llm.config.properties.prompt.description.includes('message array'));
  assert(llm.config.properties.messageHistory && !llm.config.properties.messageHistory.locations.includes('construction'));
  assert(llm.config.supportedSources.some(source => source.modifier === 'loadsText'));
  assert(describe('LLMAgent', ['asStream']).config.properties.stopWhen);
  assert(!describe('LLMAgent', ['asTool']).config.sections.at(-1).methods.some(method => method.name === 'resume'));
  assert(describe('LLMAgent', ['asTool']).config.sections.at(-1).methods.some(method => method.name === 'bindToolContext'));
  assert(describe('SpeechGenerator').config.properties.outputFormat.type.includes('"mp3"'));
  assert(describe('SpeechGenerator', ['asStream']).config.properties.outputFormat.type.includes('AudioFormat'));
  assert(!describe('SpeechGenerator', ['asStream']).config.properties.maxRetries);
  assert(!describe('Transcriber').config.properties.inputAudioFormat);
  assert(describe('Transcriber', ['asStream']).config.properties.inputAudioFormat);
  assert(!describe('Transcriber', ['asStream', 'asTool', 'withScript']).config.supportedSources.find(source => source.modifier === null).applicable);
  assert(describe('Transcriber', ['asStream']).config.supportedSources.find(source => source.modifier === null).applicable);
  assert(describe('SpeechGenerator', ['asStream', 'withFunction']).config.properties.text.type.includes('AsyncIterable'));
  assert(!describe('Function').config.properties.execute.locations.includes('run'));
  assert(!describe('VoiceSessionSetup').config.properties.model.locations.includes('run'));
  assert(!describe('Decision').config.properties.questions.locations.includes('run'));
  assert.equal(describe('Translator').status, 'planned');
  assert(describe('Translator').result.additionalProperties.some(property => property.name === 'audio' && property.type === 'Uint8Array'));
  assert.equal(describe('Translator', ['asStream']).status, 'implemented');
  assert(describe('Config').config.alternatives.length >= 14);
  assert(describe('Context').relatedProperties.some(property => property.name === 'inputSchema'));
  const exportJSON = (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/export-matrix.mjs', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  const catalog = exportJSON();
  assert.equal(catalog.schemaVersion, 1);
  assert.deepEqual(catalog.components.map(component => component.name), components.map(component => component.name));
  assert(catalog.concepts.context.paragraphs.length);
  const exported = exportJSON('LLMAgent', 'loadTemplate', 'asTool');
  assert.deepEqual(exported.reference, JSON.parse(JSON.stringify(describe('LLMAgent', ['loadTemplate', 'asTool']))));
  assert.equal(exported.example.status, 'implemented');
  assert(exported.example.files.some(file => file.name.endsWith('.cat') && file.code.includes('{{')));
  console.log(`Checked full documentation and example metadata for ${examples.length} selections.`);
}
