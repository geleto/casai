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
declare const models: { [K in 'LLMAgent' | 'Embedder' | 'Reranker' | 'ImageGenerator' | 'Transcriber' | 'StreamingTranscriber' | 'SpeechGenerator' | 'StreamingSpeechGenerator' | 'StreamingTranslator' | 'VoiceSessionSetup' | 'Decision']: ComponentConfig<K>['model'] };
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
export const streamingTranscriber = create.StreamingTranscriber({ model: models.StreamingTranscriber });
export const speech = create.SpeechGenerator({ model: models.SpeechGenerator });
export const streamingSpeech = create.StreamingSpeechGenerator({ model: models.StreamingSpeechGenerator });
export const translator = create.StreamingTranslator({ model: models.StreamingTranslator });
export const voice = create.VoiceSessionSetup({ model: models.VoiceSessionSetup });
export const decision = create.Decision({ model: models.Decision, questions: { ready: { type: 'boolean' } } });
export const prepared = create.Embedder.withFunction({ model: models.Embedder, inputSchema: z.object({ name: z.string() }), input: ({ name }) => name });
export const tool = create.ImageGenerator.withTemplate.asTool({ model: models.ImageGenerator, inputSchema: z.object({ subject: z.string() }), prompt: '{{ subject }}' });
export const inherited = create.Embedder({ model: models.Embedder }, config);
export const inheritedPrepared = create.Embedder({ model: models.Embedder }, create.Config({}, preparedConfig));
export const inheritedTool = create.Template({}, create.Config({}, toolConfig));
export const inheritedStream = create.LLMAgent({ model: models.LLMAgent }, create.Config({}, streamConfig));
type Empty = Record<never, never>;
const loadedSettings: LLMAgentConfig<Empty, Empty, string> = create.Config.loadsText({ model: models.LLMAgent, prompt: 'entry' }).config;
export const annotatedLoaded = create.LLMAgent({ loader: { load: () => 'loaded' } }, { config: loadedSettings });
const templateSettings: TemplateConfig<Empty> = { template: 'inline' };
const scriptSettings: ScriptConfig<Empty, unknown> & { script: string } = { script: 'return 1' };
export const annotatedTemplate = create.Template(templateSettings);
export const annotatedScript = create.Script(scriptSettings);
`);
  fs.writeFileSync(path.join(temporary, 'consumer.ts'), `
import { embedder, image, prepared, tool, voice, template, inheritedUnion, inheritedPrepared, inheritedTool, inheritedStream } from './out/components.js';
import { annotatedLoaded, annotatedTemplate, annotatedScript } from './out/components.js';
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
