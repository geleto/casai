import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { describe, getSourceControl, selectSource, setLoads, configSections } from '../../docs/matrix/reference.js';
import { components, validateOptions } from '../../docs/matrix/matrix.js';
import api from '../../docs/matrix/reference/api.js';
import sdkDocs from '../../docs/matrix/reference/sdk-docs.js';
import { componentReference } from '../../docs/matrix/reference/components.js';
import { commonProperties, componentProperties } from '../../docs/matrix/reference/properties.js';
import { concepts } from '../../docs/matrix/reference/concepts.js';
import { shapeProperties, detailProperties, componentDetails } from '../../docs/matrix/reference/details.js';
import { checkIntegrity } from './matrix-integrity.mjs';

const root = new URL('../../', import.meta.url);

export async function checkReference(examples) {
  // Compare the extracted contract, not unrelated implementation edits or lines.
  execFileSync(process.execPath, ['scripts/update-matrix-reference.mjs', '--check'], { cwd: root, stdio: 'inherit' });
  const integrity = (catalog = components, reference = componentReference, own = componentProperties) => checkIntegrity(catalog, reference, api, commonProperties, own, concepts);
  integrity();
  const checkDetail = name => assert(api.details[name], `Unknown detail: ${name}`);
  for (const [shape, amendments] of Object.entries(shapeProperties)) {
    const names = api.shapes[shape]?.map(id => api.properties[id].name);
    assert(names, `Unknown amended shape: ${shape}`);
    for (const [name, amendment] of Object.entries(amendments)) {
      assert(names.includes(name), `Unused shape amendment: ${shape}.${name}`);
      if (amendment.detail) checkDetail(amendment.detail);
    }
  }
  for (const [name, amendments] of Object.entries(detailProperties)) {
    checkDetail(name);
    const fields = api.details[name].variants.flatMap(variant => api.shapes[variant.shape].map(id => api.properties[id].name));
    for (const field of Object.keys(amendments)) assert(fields.includes(field), `Unused detail description: ${name}.${field}`);
  }
  for (const [component, amendments] of Object.entries(componentDetails)) {
    const fields = api.shapes[`${component}_config`].map(id => api.properties[id].name);
    for (const [field, amendment] of Object.entries(amendments)) { assert(fields.includes(field)); checkDetail(amendment.detail); }
  }
  // Keep declared output fields tied to real data, including CLI serialization.
  const declarations = ['matrix', 'reference'].map(async name => ts.createSourceFile(`${name}.d.ts`, await readFile(new URL(`docs/matrix/${name}.d.ts`, root), 'utf8'), ts.ScriptTarget.Latest, true));
  const contracts = Object.fromEntries((await Promise.all(declarations)).flatMap(source => source.statements.filter(ts.isInterfaceDeclaration).map(node => [node.name.text, node.members.map(member => ({ name: member.name.getText(source), optional: Boolean(member.questionToken) }))])));
  const contract = (name, value) => {
    const fields = contracts[name];
    assert(fields, name);
    for (const field of fields.filter(field => !field.optional)) assert(Object.hasOwn(value, field.name), `${name}: missing ${field.name}`);
    for (const key of Object.keys(value)) assert(fields.some(field => field.name === key), `${name}: undeclared ${key}`);
  };
  assert.throws(() => contract('ComponentReference', { ...describe('LLMAgent'), renamedField: true }), /undeclared renamedField/);
  const brokenRules = structuredClone(components);
  brokenRules[0].groups[0].choices[0].requires = { typo: [null] };
  assert.throws(() => integrity(brokenRules), /unknown group typo/);
  assert.throws(() => integrity(components, { ...componentReference, Context: { ...componentReference.Context, propertyShapes: ['Typo'] } }), /Unknown reference shape: Typo/);
  assert.throws(() => integrity(components, componentReference, { ...componentProperties, Embedder: { ...componentProperties.Embedder, typo: {} } }), /Unused local property: Embedder.typo/);
  const usedLocalProperties = new Set();
  const consumerCases = [];
  const usedDetails = new Set();
  function completeNativeProperties(properties, path) {
    for (const property of properties) {
      assert(property.description, `${path}.${property.name}: missing explanation`);
      if (property.details) completeDetail(property.details, `${path}.${property.name}`);
    }
  }
  function completeDetail(detail, path) {
    usedDetails.add(detail.name);
    assert(detail.variants.length, `${path}: missing alternatives`);
    for (const variant of detail.variants) completeNativeProperties(variant.properties, path);
  }
  for (const example of examples) {
    const ref = describe(example.component, example.activeOptions);
    contract('ComponentReference', ref);
    for (const [key, name] of Object.entries({ form: 'ReferenceForm', info: 'ReferenceInfo', config: 'ReferenceConfig', result: 'ReferenceResult' })) contract(name, ref[key]);
    assert.equal(ref.status, example.status, example.id);
    assert.deepEqual(ref.activeOptions, example.activeOptions);
    for (const control of ref.info.controls) {
      if (control.control) for (const choice of control.control.choices) {
        assert(choice.description, `${example.id}: source choice description`);
        const selected = selectSource(example.component, example.activeOptions, choice.id);
        assert.deepEqual(validateOptions(example.component, selected), selected);
        const source = getSourceControl(example.component, selected);
        assert.equal(source.kind, choice.id);
        if (source.loads.available) {
          const loaded = setLoads(example.component, selected, !source.loads.active);
          assert.deepEqual(validateOptions(example.component, loaded), loaded);
          assert.equal(getSourceControl(example.component, loaded).loads.active, !source.loads.active);
        }
      }
    }
    const methods = ref.config.sections.flatMap(section => section.methods ?? []);
    for (const method of methods) for (const id of method.propertyIds ?? []) assert(ref.config.properties[id], `${example.id}.${method.name}: missing property ${id}`);
    for (const method of methods) {
      completeNativeProperties(method.arguments ?? [], `${example.id}.${method.name}.arguments`);
      completeNativeProperties(method.result ?? [], `${example.id}.${method.name}.result`);
    }
    for (const shape of ref.result.shapes) completeNativeProperties(shape.properties, `${example.id}.result`);
    assert.deepEqual(ref.config.sections.map(section => section.id), configSections.map(section => section.id));
    const ids = ref.config.sections.flatMap(section => section.propertyIds);
    for (const id of [...Object.keys(ref.config.properties), ...ref.relatedProperties.map(property => property.name), ...ref.config.sections.flatMap(section => section.methods ?? []).flatMap(method => method.properties ?? []).map(property => property.name)]) usedLocalProperties.add(id);
    assert.equal(new Set(ids).size, ids.length, 'Each property has one full explanation');
    assert.deepEqual(ids.sort(), Object.keys(ref.config.properties).sort());
    for (const property of Object.values(ref.config.properties)) {
      contract('PropertyReference', property);
      for (const key of ['name', 'type', 'description', 'default', 'override', 'inheritance', 'scope', 'origin']) assert(property[key], `${example.id}.${property.name}: missing ${key}`);
      assert(!property.locations.includes('construction') || property.name !== 'abortSignal');
      if (property.descriptionOrigin === 'ai') assert.equal(property.origin, 'ai-sdk', `${example.id}.${property.name}: SDK ownership survives redeclaration`);
      if (property.origin === 'casai') assert(!property.default.includes('selected operation owns'), `${example.id}.${property.name}: Casai owns its default`);
      if (property.aliasFor) { assert(property.deprecated); assert(ref.config.properties[property.aliasFor]); }
      completeNativeProperties(property.nested, `${example.id}.${property.name}`);
      if (property.details) completeDetail(property.details, `${example.id}.${property.name}`);
    }
    // Every implemented config field must survive the presentation resolver.
    const factory = ref.form.factory?.split('.')[0];
    if (ref.status === 'implemented' && factory) {
      const expected = api.shapes[`${factory}_config`].map(id => api.properties[id].name);
      expected.push('abortSignal');
      if (componentReference[example.component].runShape) expected.push('messageHistory');
      if (example.activeOptions.includes('asTool')) expected.push(...api.shapes.Tool.map(id => api.properties[id].name));
      assert.deepEqual(Object.keys(ref.config.properties).sort(), [...new Set(expected)].sort(), `${example.id}: complete config inventory`);
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
    // Compile real nested output, not only a hand-authored consumer of the declarations.
    if (!example.activeOptions.length || example.activeOptions.length === 1 && ['asStream', 'asTool', 'withFunction', 'prepareSession', 'webRTC'].includes(example.activeOptions[0])) {
      const data = { ...example };
      delete data.url;
      consumerCases.push(`const case${consumerCases.length} = ${JSON.stringify({ schemaVersion: 1, reference: ref, example: data })} satisfies SelectionExport;`);
    }
  }
  await writeFile(new URL('.cache/matrix/_data-contracts.ts', root), `import type { SelectionExport } from '../../docs/matrix/reference.js';\n${consumerCases.join('\n')}\n`);
  assert.deepEqual([...usedDetails].sort(), Object.keys(api.details).sort(), 'All extracted nested data is reachable by consumers');
  for (const component of components) {
    const ref = describe(component.name);
    assert(ref.info.input && ref.info.result);
    for (const concept of ref.concepts) assert(concept.title && concept.paragraphs.length);
  }
  for (const name of Object.keys(commonProperties)) assert(usedLocalProperties.has(name), `Unused common property: ${name}`);
  for (const selection of [[], ['batch'], ['withFunction']]) {
    const embedding = describe('Embedder', selection).config.properties;
    assert(!embedding.onStart.description.includes('embedMany'));
    assert(!embedding.onEnd.description.includes('embedMany'));
    assert(embedding.onStart.notes.includes('String input uses embed; array input uses embedMany'));
    assert.equal(embedding.experimental_onStart.aliasFor, 'onStart');
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
  assert(llm.config.properties.messageHistory.locations.includes('ordinary'));
  const llmMethods = llm.config.sections.at(-1).methods;
  assert.equal(llmMethods.find(method => method.name === 'generate').arguments.find(property => property.name === 'options').descriptionOrigin, 'casai');
  assert.equal(describe('Decision').result.shapes[0].properties.find(property => property.name === 'answers').descriptionSource.package, 'ai');
  assert.equal(describe('VoiceSessionSetup', ['webRTC']).result.shapes[0].properties.find(property => property.name === 'sdp').descriptionOrigin, 'casai');
  const resume = llmMethods.find(method => method.name === 'resume');
  assert(resume.propertyIds.includes('context') && resume.propertyIds.includes('temperature'));
  assert(!resume.propertyIds.includes('prompt') && !resume.propertyIds.includes('messageHistory'));
  assert.deepEqual(resume.properties.map(property => property.name), ['history', 'approve']);
  for (const [name, field, history] of [['generate', 'output', 'ModelMessage[]'], ['stream', 'textStream', 'Promise<ModelMessage[]>']]) {
    const method = llmMethods.find(method => method.name === name);
    assert(method.result.some(property => property.name === field));
    assert.equal(method.additionalProperties[0].type, history);
  }
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
  for (const [options, type] of [[[], /^Uint8Array/], [['withScript'], /^string \(Cascada source\)$/], [['loadScript'], /^string \(resource name\)$/], [['withFunction'], /^\(context: PreparedContext\) => Uint8Array/]]) {
    assert.match(describe('Translator', options).config.properties.audio.type, type);
  }
  assert.match(describe('Translator', ['asStream', 'withFunction']).config.properties.audio.type, /^\(context: PreparedContext\) => ReadableStream/);
  assert(describe('Script', ['loadScript']).config.properties.script.required.operation);
  assert(!describe('VoiceSessionSetup').config.properties.instructions.required.operation);
  assert(describe('VoiceSessionSetup', ['withFunction']).config.properties.instructions.required.operation);
  for (const [options, operation, field] of [[[], 'doCreateClientSecret', 'token'], [['prepareSession'], 'prepareSessionConfig', 'instructions'], [['webRTC'], 'doCreateWebRTCSession', 'sdp']]) {
    const ref = describe('VoiceSessionSetup', options);
    assert.equal(ref.form.operation, operation);
    assert(ref.result.shapes[0].properties.some(property => property.name === field));
    if (options.length) assert(!ref.result.shapes[0].properties.some(property => property.name === 'token'));
    const methods = ref.config.sections.at(-1).methods;
    for (const name of ['prepareSessionConfig', 'createWebRTCSession']) {
      const method = methods.find(method => method.name === name);
      assert(method.propertyIds.includes('instructions') && method.propertyIds.includes('context'));
      assert(!method.propertyIds.includes('expiresAfterSeconds'));
      assert(method.result.length);
    }
  }
  const fragments = describe('Config');
  assert.deepEqual(fragments.config.alternatives.map(item => item.factory), Object.keys(api.definitions));
  assert.deepEqual(fragments.relatedComponents, Object.keys(api.definitions));
  for (const alternative of fragments.config.alternatives) {
    assert(api.shapes[alternative.shape]);
    assert(components.some(component => component.name === alternative.component));
    const target = describe(alternative.component, alternative.activeOptions);
    assert.equal(target.form.factory, alternative.factory, 'Config navigation resolves the exact implemented factory');
    assert.equal(target.status, 'implemented');
    assert(!Object.hasOwn(alternative, 'requires'), 'Config alternatives are API shapes, not example selections');
  }
  assert(describe('Context').relatedProperties.some(property => property.name === 'inputSchema'));
  const exportJSON = (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/export-matrix.mjs', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  const catalog = exportJSON();
  contract('CatalogExport', catalog);
  assert.equal(catalog.schemaVersion, 1);
  assert.deepEqual(catalog.components.map(component => component.name), components.map(component => component.name));
  assert(catalog.concepts.context.paragraphs.length);
  const exported = exportJSON('LLMAgent', 'loadTemplate', 'asTool');
  contract('SelectionExport', exported);
  contract('Example', exported.example);
  assert.deepEqual(exported.reference, JSON.parse(JSON.stringify(describe('LLMAgent', ['loadTemplate', 'asTool']))));
  assert.equal(exported.example.status, 'implemented');
  assert(exported.example.files.some(file => file.name.endsWith('.cat') && file.code.includes('{{')));
  console.log(`Checked full documentation and example metadata for ${examples.length} selections.`);
}
