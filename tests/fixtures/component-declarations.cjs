// Export inferred components from a real package consumer, then consume its declarations.
// A physical package copy prevents TypeScript from escaping exports through workspace paths.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(workspace, '.component-declarations-'));
const compiler = path.join(workspace, 'node_modules/@typescript/native/bin/tsc');
function compile(args) {
  const result = spawnSync(process.execPath, [compiler, '--ignoreConfig', '--strict', '--skipLibCheck',
    '--target', 'ES2022', '--module', 'NodeNext', ...args], { cwd: temporary, encoding: 'utf8', timeout: 180000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
try {
  const installed = path.join(temporary, 'node_modules/casai');
  fs.mkdirSync(installed, { recursive: true });
  fs.cpSync(path.join(workspace, 'dist'), path.join(installed, 'dist'), { recursive: true });
  fs.copyFileSync(path.join(workspace, 'package.json'), path.join(installed, 'package.json'));
  fs.writeFileSync(path.join(temporary, 'package.json'), JSON.stringify({ name: 'component-consumer', private: true, type: 'module' }));
  fs.writeFileSync(path.join(temporary, 'components.ts'), `
import { create, z } from 'casai';
import type { ComponentConfig, LLMAgentConfig, TemplateConfig, ScriptConfig } from 'casai';
declare const models: { [K in 'LLMAgent' | 'Embedder' | 'Reranker' | 'ImageGenerator' | 'Transcriber' | 'SpeechGenerator' | 'Translator' | 'VoiceAgentBackend' | 'Decision']: ComponentConfig<K>['model'] };
export const config = create.Config({ context: { prefix: 'hello' } });
export const preparedConfig = create.Config.withFunction({ inputSchema: z.object({ name: z.string() }), input: ({ name }) => name });
export const toolConfig = create.Config.withTemplate.asTool({ inputSchema: z.object({ name: z.string() }), template: '{{ name }}' });
export const streamConfig = create.Config.withTemplate.asStream({ inputSchema: z.object({ name: z.string() }), prompt: '{{ name }}' });
declare const chooseMode: boolean;
export const unionConfig = chooseMode ? create.Config.withText({ input: 'hello' }) : create.Config.withFunction({ input: () => 'hello' });
export const inheritedUnion = create.Embedder({ model: models.Embedder }, create.Config({}, unionConfig));
export const fn = create.Function({ execute: () => 'hello' });
export const template = create.Template({ template: '{{ name }}', inputSchema: z.object({ name: z.string() }) });
export const script = create.Script({ script: 'return 1' });
export const agent = create.LLMAgent({ model: models.LLMAgent });
export const embedder = create.Embedder({ model: models.Embedder });
export const reranker = create.Reranker({ model: models.Reranker });
export const image = create.ImageGenerator({ model: models.ImageGenerator });
export const transcriber = create.Transcriber({ model: models.Transcriber });
export const streamingTranscriber = create.Transcriber.asStream({ model: models.Transcriber });
export const speech = create.SpeechGenerator({ model: models.SpeechGenerator });
export const streamingSpeech = create.SpeechGenerator.asStream({ model: models.SpeechGenerator });
export const translator = create.Translator.asStream({ model: models.Translator });
export const voice = create.VoiceAgentBackend({ model: models.VoiceAgentBackend });
export const decision = create.Decision({ model: models.Decision, questions: { ready: { type: 'boolean' } } });
export const prepared = create.Embedder.withFunction({ model: models.Embedder, inputSchema: z.object({ name: z.string() }), input: ({ name }) => name });
export const annotatedFunction = (config: ComponentConfig<'Embedder', 'function'>) => create.Embedder.withFunction(config);
${['Transcriber', 'Translator', 'SpeechGenerator', 'ImageGenerator', 'Reranker', 'Decision', 'VoiceAgentBackend'].map(name =>
  `export const annotated${name}Function = (config: ComponentConfig<'${name}', 'function'>) => create.${name}.withFunction(config);`).join('\n')}
export const annotatedTranscriber = (config: ComponentConfig<'Transcriber'>) => create.Transcriber(config).run({ audio: new Uint8Array(2) });
export const annotatedSpeech = (config: ComponentConfig<'SpeechGenerator'>) => create.SpeechGenerator(config)('hello');
export const annotatedAgent = (config: ComponentConfig<'LLMAgent'>) => create.LLMAgent(config);
export const annotatedTextAgent = (config: LLMAgentConfig) => create.LLMAgent.withText(config);
export const annotatedDefaultAgent = (config: LLMAgentConfig) => create.LLMAgent(config);
export const annotatedStreamAgent = (config: ComponentConfig<'LLMAgent', 'text', 'stream'>) => create.LLMAgent.asStream(config);
export const annotatedFunctionAgent = (config: ComponentConfig<'LLMAgent', 'function'>) => create.LLMAgent.withFunction(config);
export const annotatedFunctionStreamAgent = (config: ComponentConfig<'LLMAgent', 'function', 'stream'>) => create.LLMAgent.withFunction.asStream(config);
export const annotatedTemplateFactory = (config: ComponentConfig<'Template'>) => create.Template(config);
export const annotatedScriptFactory = (config: ComponentConfig<'Script'>) => create.Script(config);
export const annotatedLoadedTemplate = (config: ComponentConfig<'Template', 'async-template-name'>) => create.Template.loadsTemplate(config);
export const annotatedLoadedScript = (config: ComponentConfig<'Script', 'async-script-name'>) => create.Script.loadsScript(config);
${['Decision', 'Embedder', 'Reranker', 'ImageGenerator', 'SpeechGenerator', 'VoiceAgentBackend'].flatMap(name =>
  [['loadsText', 'text-name'], ['loadsTemplate', 'async-template-name'], ['loadsScript', 'async-script-name']].map(([modifier, source]) =>
    `export const annotated${name}${modifier} = (config: ComponentConfig<'${name}', '${source}'>) => create.${name}.${modifier}(config);`)).join('\n')}
${['Transcriber', 'Translator'].map(name =>
  `export const annotated${name}loadsScript = (config: ComponentConfig<'${name}', 'async-script-name'>) => create.${name}.loadsScript(config);`).join('\n')}
export const tool = create.ImageGenerator.withTemplate.asTool({ model: models.ImageGenerator, inputSchema: z.object({ subject: z.string() }), prompt: '{{ subject }}' });
export const inherited = create.Embedder({ model: models.Embedder }, config);
export const inheritedPrepared = create.Embedder({ model: models.Embedder }, create.Config({}, preparedConfig));
export const inheritedTool = create.Template({}, create.Config({}, toolConfig));
export const inheritedStream = create.LLMAgent({ model: models.LLMAgent }, create.Config({}, streamConfig));
export function nestedMediaTools() {
  const transcribe = create.Transcriber.withFunction.asTool({
    model: models.Transcriber, inputSchema: z.object({}), audio: () => new Uint8Array(2),
  });
  return create.LLMAgent({ model: models.LLMAgent, tools: { transcribe } });
}
type Empty = Record<never, never>;
const loadedSettings: ComponentConfig<'LLMAgent', 'text-name'> = create.Config.loadsText({ model: models.LLMAgent, prompt: 'entry', loader: { load: () => 'loaded' } }).config;
export const annotatedLoaded = create.LLMAgent(loadedSettings);
const templateSettings: TemplateConfig<Empty> = { template: 'inline' };
const scriptSettings: ScriptConfig<Empty, unknown> & { script: string } = { script: 'return 1' };
export const annotatedTemplate = create.Template(templateSettings);
export const annotatedScript = create.Script(scriptSettings);
`);
  fs.writeFileSync(path.join(temporary, 'consumer.ts'), `
import { embedder, image, prepared, tool, voice, template, inheritedUnion, inheritedPrepared, inheritedTool, inheritedStream } from './out/components.js';
import { annotatedLoaded, annotatedTemplate, annotatedScript } from './out/components.js';
import { annotatedAgent, annotatedTextAgent, annotatedDefaultAgent, annotatedStreamAgent } from './out/components.js';
import { annotatedFunctionAgent, annotatedFunctionStreamAgent, annotatedTemplateFactory, annotatedScriptFactory, annotatedLoadedTemplate, annotatedLoadedScript } from './out/components.js';
void annotatedAgent({ model: 'provider/model' })('hello');
void annotatedTextAgent({ model: 'provider/model' })('hello');
void annotatedDefaultAgent({ model: 'provider/model' })('hello');
void annotatedStreamAgent({ model: 'provider/model' })('hello').then(result => result.textStream);
void annotatedFunctionAgent({ model: 'provider/model', prompt: context => context._toolOptions.toolCallId ?? 'hello' })(() => 'hello');
void annotatedFunctionStreamAgent({ model: 'provider/model' })(() => 'hello').then(result => result.textStream);
void annotatedTemplateFactory({ template: 'hello' })();
void annotatedScriptFactory({ script: 'return 1' })();
void annotatedLoadedTemplate({ loader: { load: () => 'hello' } })('entry');
void annotatedLoadedScript({ loader: { load: () => 'return 1' } }).run({ script: 'entry' });
// @ts-expect-error A function-source annotation does not accept a literal prompt.
void annotatedFunctionAgent({ model: 'provider/model' })('hello');
// @ts-expect-error Inline source remains required in an exported wrapper.
annotatedScriptFactory({});
// @ts-expect-error A loaded annotation retains its required loader across emission.
annotatedLoadedTemplate({ template: 'entry' });
void embedder('hello');
void image('cat', ['reference'], 2);
void prepared({ name: 'Ada' });
void tool({ subject: 'cat' });
void voice.prepareSessionConfig();
void template({ name: 'Ada' });
void inheritedUnion();
void inheritedPrepared({ name: 'Ada' });
void inheritedTool.execute({ name: 'Ada' }, { toolCallId: 'test', messages: [], context: undefined });
void inheritedStream({ name: 'Ada' }).then(result => result.textStream);
void annotatedLoaded('entry');
void annotatedTemplate();
void annotatedScript();
// @ts-expect-error An annotated loaded source retains its source contract through declarations.
void annotatedLoaded.run({ prompt: [{ role: 'user', content: 'literal' }] });
// @ts-expect-error Exported Config unions preserve every source alternative.
void inheritedUnion('replacement');
// @ts-expect-error Required context survives Config and emitted component declarations.
void inheritedPrepared({});
// @ts-expect-error Native embedding input is text, not a number.
void embedder(3);
// @ts-expect-error Prepared components retain required input through declaration emit.
void prepared({});
`);
  for (const exact of ['false', 'true']) {
    compile(['--exactOptionalPropertyTypes', exact, '--declaration', '--emitDeclarationOnly', '--outDir', 'out', 'components.ts']);
    const declarations = fs.readFileSync(path.join(temporary, 'out/components.d.ts'), 'utf8');
    assert.ok(!declarations.includes('node_modules') && !declarations.includes(workspace), 'Declarations must use portable package names.');
    compile(['--exactOptionalPropertyTypes', exact, '--noEmit', 'consumer.ts']);
    console.log(`Component declaration export and consumption passed (exactOptionalPropertyTypes=${exact}).`);
  }
} finally {
  assert.equal(path.dirname(path.resolve(temporary)), workspace);
  assert.ok(path.basename(temporary).startsWith('.component-declarations-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
