import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { describe, getSourceControl, selectSource, setLoads, configSections } from '../../docs/matrix/reference.js';
import { components, render, validateOptions, getControls, getSourceControl as catalogSourceControl, normalizeOptions, referenceSelection, referenceSelections, versions, sourceUrl, selectOption } from '../../docs/matrix/matrix.js';
import api from '../../docs/matrix/reference/api.js';
import sdkDocs from '../../docs/matrix/reference/sdk-docs.js';
import { componentReference } from '../../docs/matrix/reference/components.js';
import { commonProperties, componentProperties } from '../../docs/matrix/reference/properties.js';
import { concepts } from '../../docs/matrix/reference/concepts.js';
import { shapeProperties, detailProperties, componentDetails } from '../../docs/matrix/reference/details.js';
import { checkIntegrity } from './matrix-integrity.mjs';
import { compactType } from '../../docs/matrix/reference/type-display.js';
import { describeType, typeReference } from '../../docs/matrix/reference/type-reference.js';

const root = new URL('../../', import.meta.url);

export async function checkReference(examples) {
  const defaults = describe('LLMAgent').config.properties;
  assert.equal(defaults.model.default, null);
  assert.equal(defaults.context.default, null);
  assert.equal(defaults.temperature.default, null);
  assert.equal(defaults.debug.default, 'false');
  assert.equal(defaults.maxRetries.default, '2');
  assert.equal(describe('Config').config.properties.promptType, undefined);
  assert.equal(describe('Context').relatedProperties.find(property => property.name === '_toolOptions').locations.length, 0);
  const template = describe('Template').config.supportedSources.find(form => !form.modifier);
  assert.equal(template.description, 'The template text.');
  assert.match(template.explanation, /`template` value contains Cascada Template text/);
  assert.match(template.explanation, /`context: \{ name: "Ada" \}` produces `Hello Ada`/);
  assert.equal(defaults.prompt.displayType, 'string | ModelMessage | ModelMessage[]');
  assert.match(defaults.prompt.typeDescription, /role.*content/s);
  assert.equal(compactType('DataContent | URL'), 'string | Uint8Array | ArrayBuffer | Buffer | URL');
  assert.equal(describeType('"PromptValue"'), null, 'Do not treat a string literal as a type alias');
  assert.match(describeType('(context: PreparedContext) => PromptValue'), /inputSchema/);
  assert.match(describeType('(context: PreparedContext) => PromptValue'), /message object/);
  // These concise expansions must stay equivalent to the actual declarations.
  for (const [file, alias] of [['src/types/prompt.ts', 'PromptValue'], ['node_modules/@ai-sdk/provider-utils/dist/index.d.ts', 'DataContent']]) {
    const source = ts.createSourceFile(file, await readFile(new URL(file, root), 'utf8'), ts.ScriptTarget.Latest, true);
    const declaration = source.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === alias);
    assert.equal(typeReference[alias].display.replace(/\s/g, ''), declaration.type.getText(source).replace(/\s/g, ''), `${alias}: readable expansion follows its owning declaration`);
  }
  for (const [type, expected] of [
    ['number | undefined', 'number'],
    ['undefined | string | null', 'string | null'],
    ['Record<string, string | undefined> | undefined', 'Record<string, string | undefined>'],
    ['((value: string) => number | undefined) | undefined', '((value: string) => number | undefined)'],
    ['(value: string) => number | undefined', '(value: string) => number | undefined'],
    ['T extends string ? number : boolean | undefined', 'T extends string ? number : boolean | undefined'],
    ['{ value?: string | undefined } | undefined', '{ value?: string | undefined }'],
    ['[string | undefined, number] | undefined', '[string | undefined, number]'],
    ['"literal | undefined" | undefined', '"literal | undefined"'],
    ['string | Model | (string & Model) | (Model & string)', 'string | Model'],
    ['string | (Model & Provider)', 'string | (Model & Provider)'],
    ['undefined', 'undefined'],
  ]) assert.equal(compactType(type, { optional: true }), expected, `Readable optional type: ${type}`);
  assert.equal(compactType('string | undefined'), 'string | undefined', 'Required values retain explicit undefined');
  assert.equal(compactType(`Collection<${'LongName, '.repeat(30)}Value> | null | undefined`, { optional: true }), 'Collection<…> | null');
  const publishedForms = referenceSelections();
  const expectedForms = new Set(examples.map(example => referenceSelection(example.component, example.activeOptions).id));
  assert.deepEqual(new Set(publishedForms.map(form => form.id)), expectedForms, 'Static publications cover every canonical reference reachable from all valid examples');
  assert.equal(publishedForms.length, expectedForms.size, 'Reference forms are deduplicated');
  for (const component of components) {
    assert.deepEqual(referenceSelections(component.name), publishedForms.filter(form => form.component === component.name));
    assert.equal(describe(component.name).info.kind, component.kind);
    for (const concept of describe(component.name).concepts) {
      assert.deepEqual(concept, { id: concept.id, ...concepts[concept.id] }, `${component.name} reuses the canonical ${concept.id} note`);
    }
  }
  assert.equal(components.find(component => component.name === 'Context').kind, 'concept');
  assert.equal(components.find(component => component.name === 'Config').kind, 'configuration');
  for (const form of publishedForms) assert.deepEqual(form, referenceSelection(form.component, form.activeOptions));
  assert.throws(() => referenceSelections('Missing'), /Unknown matrix component/);
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
  assert.throws(() => integrity(components, { ...componentReference, Context: { ...componentReference.Context, relatedPropertyShapes: ['Typo'] } }), /Unknown reference shape: Typo/);
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
    assert.deepEqual(getControls(example.component, example.activeOptions), ref.info.controls);
    assert.deepEqual(catalogSourceControl(example.component, example.activeOptions), getSourceControl(example.component, example.activeOptions));
    assert.deepEqual(normalizeOptions(example.component, [...example.activeOptions, 'retired-choice']).activeOptions, example.activeOptions);
    assert.deepEqual(ref.canonical, referenceSelection(example.component, example.activeOptions));
    assert(ref.info.description && ref.info.description !== ref.info.shortDescription, `${example.id}: full explanation alongside the short summary`);
    validateOptions(example.component, ref.canonical.activeOptions);
    const canonical = describe(example.component, ref.canonical.activeOptions);
    for (const field of ['properties', 'sections', 'supportedSources', 'requiredPropertyIds']) assert.deepEqual(ref.config[field], canonical.config[field], `${example.id}: canonical reference preserves ${field}`);
    assert.deepEqual(ref.result, canonical.result, `${example.id}: canonical reference preserves results`);
    for (const control of getControls(example.component, example.activeOptions, { unavailable: 'include' })) {
      for (const group of control.groups ?? []) for (const choice of group.choices) {
        assert.equal(choice.unavailableReasons.length === 0, choice.available);
        if (choice.transition) {
          const current = group.choices.find(option => example.activeOptions.includes(option.id));
          assert.equal(choice.active, choice.defaultControl ? !current : example.activeOptions.includes(choice.id));
          assert.deepEqual(choice.transition.activeOptions, choice.defaultControl && current
            ? selectOption(example.component, example.activeOptions, current.id, false)
            : selectOption(example.component, example.activeOptions, choice.id, !example.activeOptions.includes(choice.id)));
          assert.deepEqual(choice.transition.cleared, example.activeOptions.filter(id => !choice.transition.activeOptions.includes(id)));
        }
      }
    }
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
    for (const section of ref.config.sections) for (const note of section.notes ?? []) {
      assert(![ref.info.result, ref.result.description, ref.result.tool].includes(note), `${example.id}: return explanations belong in result, not configuration`);
    }
    assert.deepEqual(ref.config.sections.map(section => section.id), configSections.map(section => section.id));
    const ids = ref.config.sections.flatMap(section => section.propertyIds);
    for (const id of [...Object.keys(ref.config.properties), ...ref.relatedProperties.map(property => property.name), ...ref.config.sections.flatMap(section => section.methods ?? []).flatMap(method => method.properties ?? []).map(property => property.name)]) usedLocalProperties.add(id);
    assert.equal(new Set(ids).size, ids.length, 'Each property has one full explanation');
    assert.deepEqual(ids.sort(), Object.keys(ref.config.properties).sort());
    for (const property of Object.values(ref.config.properties)) {
      contract('PropertyReference', property);
      assert(!property.name.startsWith('_'), `${example.id}.${property.name}: internal fields are not configuration options`);
      assert(!property.upstream?.tags?.some(tag => ['internal', 'private', 'protected'].includes(tag.name)), `${example.id}.${property.name}: public visibility`);
      if (['abortSignal', 'messageHistory'].includes(property.name)) assert(!property.locations.includes('construction'), `${example.id}.${property.name}: invocation only`);
      assert.notEqual(property.name, 'promptType');
      for (const key of ['name', 'type', 'displayType', 'description', 'override', 'inheritance', 'scope', 'origin']) assert(property[key], `${example.id}.${property.name}: missing ${key}`);
      assert(property.default === null || typeof property.default === 'string' && property.default.length > 0, `${example.id}.${property.name}: documented default or null`);
      assert(property.displayType.length <= 150, `${example.id}.${property.name}: compact type`);
      assert(!property.locations.includes('construction') || property.name !== 'abortSignal');
      if (property.descriptionOrigin === 'ai') assert.equal(property.origin, 'ai-sdk', `${example.id}.${property.name}: SDK ownership survives redeclaration`);
      if (property.origin === 'casai') assert(!property.default?.includes('selected operation owns'), `${example.id}.${property.name}: Casai owns its default`);
      if (property.aliasFor) { assert(property.deprecated); assert(ref.config.properties[property.aliasFor]); }
      completeNativeProperties(property.nested, `${example.id}.${property.name}`);
      if (property.details) completeDetail(property.details, `${example.id}.${property.name}`);
    }
    // Every applicable field must survive; broad factory types also admit settings
    // retained for later derived components that the selected source does not use.
    const factory = ref.form.factory?.split('.')[0];
    if (ref.status === 'implemented' && factory && ref.info.kind !== 'configuration') {
      const expected = api.shapes[`${factory}_config`].map(id => api.properties[id].name);
      expected.push('abortSignal');
      if (componentReference[example.component].runShape) expected.push('messageHistory');
      if (example.activeOptions.includes('asTool')) expected.push(...api.shapes.Tool.map(id => api.properties[id].name));
      const cascadaSource = ref.form.sourceMode?.startsWith('async-');
      const applicable = expected.filter(name => {
        if (name === 'filters' || name === 'renderOptions') return cascadaSource;
        if (name === 'loader') return cascadaSource || ref.form.sourceMode === 'text-name';
        if (name === 'toolContextSchema') return example.activeOptions.includes('asTool');
        return true;
      });
      assert.deepEqual(Object.keys(ref.config.properties).sort(), [...new Set(applicable)].sort(), `${example.id}: complete applicable config inventory`);
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
      consumerCases.push(`const case${consumerCases.length} = ${JSON.stringify({ schemaVersion: 3, reference: ref, example: data })} satisfies SelectionExport;`);
    }
  }
  await writeFile(new URL('.cache/matrix/_data-contracts.ts', root), `import type { Component } from '../../docs/matrix/matrix.js';\nimport type { SelectionExport } from '../../docs/matrix/reference.js';\nconst catalog = ${JSON.stringify(components)} satisfies Component[];\n${consumerCases.join('\n')}\n`);
  assert.deepEqual([...usedDetails].sort(), Object.keys(api.details).sort(), 'All extracted nested data is reachable by consumers');
  for (const component of components) {
    assert.deepEqual(component.activeOptions, [], 'Every component starts in its normal form; streaming is opt-in');
    const ref = describe(component.name);
    assert(component.description && component.description !== component.shortDescription, `${component.name}: catalog long description`);
    assert.equal(ref.info.shortDescription, component.shortDescription, `${component.name}: preserve the existing short summary`);
    assert.equal(ref.info.description, component.description);
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
  assert.deepEqual(setLoads('Reranker', [], true), ['loadText']);
  assert.deepEqual(setLoads('Reranker', ['loadText'], false), []);
  assert.deepEqual(selectSource('Reranker', ['loadTemplate'], 'default'), ['loadText']);
  assert.deepEqual(selectSource('Reranker', ['loadText'], 'script'), ['loadScript']);
  assert.deepEqual(selectSource('Reranker', ['loadText'], 'function'), ['withFunction']);
  assert.throws(() => setLoads('Transcriber', [], true), /unavailable/);
  assert.equal(describe('Reranker', ['loadText']).form.factory, 'Reranker.loadsText');
  assert.match(describe('Reranker').config.supportedSources.find(source => source.mode === 'text').description, /The search text used to rank the candidate documents/);
  assert.throws(() => setLoads('LLMAgent', ['withFunction'], true), /unavailable/);
  assert.throws(() => selectSource('Transcriber', [], 'template'), /Unsupported/);
  assert.equal(getSourceControl('Function'), null);
  assert.deepEqual(selectSource('Transcriber', ['asTool', 'asStream', 'loadScript'], 'default'), ['asStream']);
  validateOptions('Transcriber', selectSource('Transcriber', ['asStream', 'loadScript'], 'function'));
  const llm = describe('LLMAgent');
  assert.equal(llm.info.shortDescription, sdkDocs.generateText.description);
  assert.equal(llm.info.shortDescriptionSource.reuse, 'verbatim');
  assert.equal(describe('LLMAgent', ['asStream']).info.shortDescription, sdkDocs.streamText.description);
  assert.equal(describe('SpeechGenerator', ['asStream']).info.shortDescription, sdkDocs.experimental_streamSpeech.description);
  assert.equal(describe('Transcriber', ['asStream']).info.shortDescription, sdkDocs.experimental_streamTranscribe.description);
  assert.equal(describe('Translator', ['asStream']).info.shortDescription, sdkDocs.experimental_streamTranslate.description);
  assert.notEqual(describe('Translator', []).info.shortDescription, sdkDocs.experimental_streamTranslate.description);
  for (const name of ['LLMAgent', 'Transcriber', 'SpeechGenerator', 'Translator']) {
    const streaming = describe(name, ['asStream']).info;
    assert.notEqual(streaming.description, describe(name).info.description, `${name}: explain the selected streaming form`);
    assert.deepEqual(streaming.descriptionSources, [streaming.shortDescriptionSource.source]);
  }
  for (const source of components.flatMap(component => component.descriptionSources)) {
    assert.equal(source.version, api.packages.ai);
    assert(source.url.includes(`ai@${source.version}/docs/`));
    assert((await readFile(new URL(source.path, root), 'utf8')).length, 'Attribution points to the installed SDK documentation');
  }
  for (const name of ['model', 'headers', 'providerOptions', 'onChunk', 'streamRetries', 'output', 'stopWhen']) {
    assert.equal(llm.config.properties[name].descriptionOrigin, 'ai');
    assert.equal(llm.config.properties[name].description, llm.config.properties[name].upstream.description);
  }
  assert.equal(describe('Decision').config.properties.headers.description, llm.config.properties.headers.description);
  assert.equal(llm.config.properties.prompt.descriptionOrigin, 'casai');
  assert(llm.config.properties.prompt.upstream.description, 'Keep the upstream text beside a Casai amendment');
  assert(llm.config.properties.tools, 'Unchecked useTools does not remove a supported property');
  assert(llm.config.sections.at(-1).methods.some(method => method.name === 'resume'), 'resume reference does not require the approval example');
  assert(llm.config.properties.prompt.description.includes('array of messages'));
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
  assert.equal(describe('Decision', ['loadText']).config.properties.state.description, 'A file containing the text to evaluate against the configured questions.');
  assert.equal(describe('Embedder').config.supportedSources[0].description, 'The text or array of texts to embed.');
  for (const form of publishedForms) {
    const reference = describe(form.component, form.activeOptions);
    for (const source of reference.config.supportedSources) {
      assert(source.description && source.explanation && !source.explanation.includes('undefined'), `${form.id}: complete source documentation`);
    }
    for (const id of reference.config.sections.find(section => section.id === 'essential').propertyIds) {
      const property = reference.config.properties[id];
      assert(id === reference.form.primaryProperty || property.required.construction || property.required.operation, `${form.id}.${id}: required settings contain required properties`);
    }
  }
  assert(describe('Config').config.properties.filters, 'Reusable fragments may configure a future Cascada component');
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
  assert.equal(describe('Translator', []).status, 'planned');
  assert(describe('Translator', []).result.additionalProperties.some(property => property.name === 'audio' && property.type === 'Uint8Array'));
  assert.equal(describe('Translator', ['asStream']).status, 'implemented');
  for (const [options, type] of [[[], /^Uint8Array/], [['withScript'], /^string$/], [['loadScript'], /^string$/], [['withFunction'], /^\(context: PreparedContext\) => Uint8Array/]]) {
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
  assert.equal(fragments.form.factory, 'Config');
  assert.equal(fragments.form.sourceMode, null);
  assert.match(fragments.info.selectionNote, /inheriting component must support every selected modifier and setting/);
  assert.deepEqual(getSourceControl('Config').choices.map(choice => choice.id), ['text', 'template', 'script', 'function']);
  assert.equal(getSourceControl('Config').kind, null);
  assert.equal(getSourceControl('Config').loads.available, false);
  assert.deepEqual(selectSource('Config', ['loadScript'], null), []);
  for (const kind of ['text', 'template', 'script', 'function']) {
    const selected = selectSource('Config', ['asTool', 'useTools'], kind);
    const source = getSourceControl('Config', selected);
    assert.deepEqual(source.choices.find(choice => choice.id === kind).transition.activeOptions, ['asTool', 'useTools']);
    if (source.loads.available) {
      const loaded = getSourceControl('Config', setLoads('Config', selected, true));
      assert.deepEqual(loaded.choices.find(choice => choice.id === kind).transition.activeOptions, ['asTool', 'useTools']);
    }
  }
  assert.deepEqual(setLoads('Config', ['loadText'], false), ['withText']);
  assert.throws(() => validateOptions('Config', ['asTool', 'asStream']));
  assert.deepEqual(describe('Config', ['asStream', 'loadTemplate']).config.alternatives.map(item => item.factory), ['LLMAgent.loadsTemplate.asStream']);
  for (const selection of referenceSelections('Config')) {
    const ref = describe('Config', selection.activeOptions);
    assert.equal(ref.form.factory, (await render('Config', selection.activeOptions)).configuration.factory);
    const methodNames = ref.config.sections.flatMap(section => section.methods ?? []).map(method => method.name);
    for (const method of ['call', 'run', 'execute', 'bindToolContext']) assert(!methodNames.includes(method), 'Config remains a non-callable fragment');
    for (const alternative of ref.config.alternatives) {
      const target = describe(alternative.component, alternative.activeOptions);
      assert.equal(target.form.factory, alternative.factory);
      if (ref.form.sourceMode !== null) assert.equal(target.form.sourceMode, ref.form.sourceMode);
      if (selection.activeOptions.includes('asTool')) assert(target.activeOptions.includes('asTool'));
      if (selection.activeOptions.includes('asStream')) assert(target.activeOptions.includes('asStream'));
    }
  }
  const templateTools = describe('Config', ['withTemplate', 'asTool']).config.alternatives;
  assert(templateTools.some(item => item.factory === 'Template.asTool'));
  assert(!templateTools.some(item => ['Function', 'Transcriber', 'VoiceSessionSetup', 'Translator'].includes(item.component)));
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
  for (const property of describe('Context').relatedProperties) contract('PropertyReference', property);
  assert(versions.casai);
  assert.equal(sourceUrl({ path: 'src/index.ts' }, 'pinned-commit'), 'https://github.com/geleto/casai/blob/pinned-commit/src/index.ts');
  assert.equal(sourceUrl({ path: 'src/index.ts' }), null);
  assert.equal(sourceUrl({ path: 'native', url: 'https://example.com/pinned' }, 'local-commit'), 'https://example.com/pinned');
  assert.deepEqual(getSourceControl('Template').choices.map(choice => choice.id), ['template']);
  assert.deepEqual(getSourceControl('Script').choices.map(choice => choice.id), ['script']);
  assert.deepEqual(setLoads('Template', [], true), ['loadTemplate']);
  assert.deepEqual(setLoads('Template', ['loadTemplate'], false), []);
  assert.deepEqual(normalizeOptions('LLMAgent', ['old-choice', 'withTemplate', 'loadTemplate', 'run', 'run']), { activeOptions: ['loadTemplate', 'run'], dropped: ['old-choice', 'withTemplate'] });
  assert.deepEqual(normalizeOptions('Transcriber', ['asTool', 'asStream', 'retired-preparer']).activeOptions, ['asStream']);
  assert.deepEqual(normalizeOptions('Translator', []).activeOptions, []);
  assert.deepEqual(normalizeOptions('Translator').activeOptions, []);
  const streamSwitch = getControls('LLMAgent', ['asTool'], { unavailable: 'include' }).flatMap(section => section.groups ?? []).flatMap(group => group.choices).find(choice => choice.id === 'asStream');
  assert.equal(streamSwitch.available, false);
  assert.match(streamSwitch.unavailableReasons[0], /Conflicts with: As a tool/);
  assert.deepEqual(streamSwitch.transition, { activeOptions: ['asStream'], cleared: ['asTool'], added: ['asStream'] });
  const sourcePreview = getSourceControl('Transcriber', ['asTool', 'asStream', 'withScript']).choices.find(choice => choice.id === 'default').transition;
  assert.deepEqual(sourcePreview.activeOptions, ['asStream']);
  assert.deepEqual(sourcePreview.cleared, ['asTool', 'withScript']);
  assert.deepEqual(referenceSelection('Template', ['withTemplate', 'run']).activeOptions, []);
  assert.deepEqual(referenceSelection('LLMAgent', ['withTemplate', 'useTools', 'run', 'structured']).activeOptions, ['withTemplate']);
  const exportJSON = (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/export-matrix.mjs', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  const catalog = exportJSON();
  contract('CatalogExport', catalog);
  assert.equal(catalog.schemaVersion, 3);
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
