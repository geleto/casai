// Build documentation data from the installed public types; never load model code.
import ts from 'typescript';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const names = ['Template', 'Script', 'Function', 'LLMAgent', 'Decision', 'Embedder', 'Reranker', 'ImageGenerator', 'Transcriber', 'StreamingTranscriber', 'SpeechGenerator', 'StreamingSpeechGenerator', 'StreamingTranslator', 'VoiceSessionSetup'];
const aliases = {};
for (const name of names) {
  aliases[`${name}_config`] = name === 'LLMAgent'
    ? "import('../src/types/agent.js').AgentFactoryShape<'text', false>"
    : `import('../src/types/component.js').ComponentConfig<'${name}', 'text'>`;
  aliases[`${name}_settings`] = `import('../src/types/component-map.js').ComponentSettings['${name}']`;
  aliases[`${name}_definition`] = `import('../src/types/component-map.js').Definitions['${name}']`;
  aliases[`${name}_inputs`] = `{ direct: import('../src/types/component.js').NativeInput<'${name}'>; template: import('../src/types/component-map.js').TemplateInputs['${name}']; prepared: import('../src/types/component-map.js').PreparedInputs['${name}'] }`;
}
Object.assign(aliases, {
  Tool: "import('../src/types/config.js').ToolConfig<Record<string, unknown>, unknown>",
  AgentRun: "import('../src/types/agent.js').AgentRunSettings<{}, 'text'>",
  NativeGenerate: "import('ai').AgentCallParameters<unknown>",
  NativeStream: "import('ai').AgentStreamParameters<unknown, import('ai').ToolSet>",
  GenerateSettings: "Parameters<typeof import('ai').generateText>[0]",
  StreamSettings: "Parameters<typeof import('ai').streamText>[0]",
  RenderOptions: "import('cascada-engine').ConfigureOptions",
  ExecutionOptions: "import('../src/types/sdk.js').ComponentExecutionOptions",
  Output: "typeof import('ai').Output",
  SessionConfig: "import('ai').Experimental_RealtimeSessionConfig",
});
const operations = { LLMAgent: 'generateText', LLMAgentStream: 'streamText', Decision: 'experimental_decide', Embedder: 'embed', EmbedderBatch: 'embedMany', Reranker: 'rerank', ImageGenerator: 'generateImage', Transcriber: 'transcribe', StreamingTranscriber: 'experimental_streamTranscribe', SpeechGenerator: 'generateSpeech', StreamingSpeechGenerator: 'experimental_streamSpeech', StreamingTranslator: 'experimental_streamTranslate' };
for (const [name, operation] of Object.entries(operations)) {
  aliases[`${name}_result`] = `Awaited<ReturnType<typeof import('ai').${operation}>>`;
  aliases[`${name}_native`] = `Parameters<typeof import('ai').${operation}>[0]`;
}
aliases.VoiceSessionSetup_result = "import('../src/factories/VoiceSessionSetup.js').VoiceSetupResult";
const probe = new URL('.cache/matrix-reference-types.ts', root);
await mkdir(new URL('.cache/', root), { recursive: true });
await writeFile(probe, Object.entries(aliases).map(([name, type]) => `export type ${name} = ${type};`).join('\n'));
const program = ts.createProgram([fileURLToPath(probe)], { strict: true, skipLibCheck: true, noEmit: true, types: ['node'], target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext });
const checker = program.getTypeChecker();
const source = program.getSourceFile(fileURLToPath(probe));
const errors = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: value => value, getCurrentDirectory: () => fileURLToPath(root), getNewLine: () => '\n' }));
const packages = {};
for (const name of ['ai', '@ai-sdk/provider-utils', '@ai-sdk/provider', 'cascada-engine']) packages[name] = JSON.parse(await readFile(new URL(`node_modules/${name}/package.json`, root), 'utf8')).version;
const properties = {}, shapes = {}, files = {}, definitions = {};
function literal(type, node) {
  if (type.isLiteral()) return type.value;
  if (type.flags & ts.TypeFlags.Undefined) return null;
  if (type.flags & ts.TypeFlags.BooleanLiteral) return type.intrinsicName === 'true';
  if (type.isUnion()) return type.types.flatMap(value => literal(value, node));
  if (checker.isTupleType(type) || checker.isArrayType(type)) return checker.getTypeArguments(type).flatMap(value => literal(value, node));
  return Object.fromEntries(checker.getPropertiesOfType(type).map(property => [property.name, literal(checker.getTypeOfSymbolAtLocation(property, node), node)]));
}
function location(declaration) {
  if (!declaration) return undefined;
  const file = declaration.getSourceFile();
  const path = relative(fileURLToPath(root), file.fileName).replaceAll('\\', '/');
  if (path.startsWith('.cache/')) return undefined;
  const line = file.getLineAndCharacterOfPosition(declaration.getStart()).line + 1;
  files[path] = createHash('sha256').update(file.text.replaceAll('\r\n', '\n')).digest('hex');
  const match = /^node_modules\/(ai|@ai-sdk\/provider-utils|@ai-sdk\/provider|cascada-engine)\/(.+)$/.exec(path);
  return { path, line, ...(match ? { package: match[1], version: packages[match[1]], url: `https://unpkg.com/${match[1]}@${packages[match[1]]}/${match[2]}#L${line}` } : {}) };
}
for (const statement of source.statements) {
  const type = checker.getTypeAtLocation(statement);
  if (statement.name.text.endsWith('_definition')) {
    definitions[statement.name.text.replace('_definition', '')] = literal(type, statement);
    for (const property of checker.getPropertiesOfType(type)) location(property.valueDeclaration ?? property.declarations?.[0]);
    continue;
  }
  shapes[statement.name.text] = checker.getPropertiesOfType(type).map(symbol => {
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    const property = {
      name: symbol.name,
      type: checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, statement), statement, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope),
      optional: Boolean(symbol.flags & ts.SymbolFlags.Optional),
      description: ts.displayPartsToString(symbol.getDocumentationComment(checker)),
      tags: symbol.getJsDocTags(checker).map(tag => ({ name: tag.name, text: ts.displayPartsToString(tag.text) })),
      source: location(declaration),
    };
    const id = `${symbol.name}-${createHash('sha256').update(JSON.stringify(property)).digest('hex').slice(0, 12)}`;
    properties[id] = property;
    return id;
  });
}
// Read prose from the matching installed release, not the moving documentation site.
// This is deliberately an opening-paragraph extractor, not an MDX renderer.
const pages = {
  generateText: '01-generate-text', streamText: '02-stream-text',
  embed: '05-embed', embedMany: '06-embed-many', rerank: '06-rerank',
  generateImage: '10-generate-image', transcribe: '11-transcribe',
  experimental_streamTranscribe: '11-stream-transcribe',
  generateSpeech: '12-generate-speech', experimental_streamSpeech: '12-stream-speech',
  experimental_streamTranslate: '11-stream-translate', experimental_decide: '14-decide',
};
const summaries = {};
for (const [operation, page] of Object.entries(pages)) {
  const path = `node_modules/ai/docs/07-reference/01-ai-sdk-core/${page}.mdx`;
  const text = (await readFile(new URL(path, root), 'utf8')).replaceAll('\r\n', '\n');
  files[path] = createHash('sha256').update(text).digest('hex');
  const opening = text.split(/^# .+\n/m)[1]?.split(/^## /m)[0];
  const paragraph = opening?.replace(/<Note\b[^>]*>[\s\S]*?<\/Note>/g, '')
    .replace(/```[^\n]*\n[\s\S]*?```/g, '').split(/\n\s*\n/)
    .map(value => value.trim()).find(value => value && !/^[<#]/.test(value));
  assert(paragraph, `No opening description in ${path}; review the upstream document.`);
  const line = text.slice(0, text.indexOf(paragraph)).split('\n').length;
  summaries[operation] = {
    description: paragraph.replace(/\s*\n\s*/g, ' ').replace(/\]\(\/docs\//g, '](https://ai-sdk.dev/docs/'),
    source: { path, line, package: 'ai', version: packages.ai,
      url: `https://unpkg.com/ai@${packages.ai}/docs/07-reference/01-ai-sdk-core/${page}.mdx#L${line}`,
      documentation: `https://ai-sdk.dev/docs/reference/ai-sdk-core/${page.replace(/^\d+-/, '')}` },
  };
}
const data = { packages, files, definitions, shapes, properties };
const output = '// Generated from installed public declarations. AI SDK: Apache-2.0; Cascada: BSD-2-Clause.\n// Modified by Casai: extracted, deduplicated and grouped for documentation. See THIRD_PARTY.md for notices and licenses.\nexport default ' + JSON.stringify(data, null, 2) + ';\n';
const destination = new URL('docs/matrix/reference/api.js', root);
const summariesDestination = new URL('docs/matrix/reference/sdk-docs.js', root);
const summariesOutput = '// Generated from AI SDK documentation (Apache-2.0). See THIRD_PARTY.md.\n// Modified by Casai: extracted opening paragraphs, joined wrapped lines and resolved documentation links.\nexport default ' + JSON.stringify(summaries, null, 2) + ';\n';
if (process.argv.includes('--check')) assert.equal(await readFile(destination, 'utf8'), output, 'Run npm run docs:matrix to refresh public type/reference data.');
else {
  await mkdir(new URL('./', destination), { recursive: true });
  await writeFile(destination, output);
}
if (process.argv.includes('--check')) assert.equal(await readFile(summariesDestination, 'utf8'), summariesOutput, 'Run npm run docs:matrix to refresh SDK summaries.');
else await writeFile(summariesDestination, summariesOutput);
console.log(`Matrix reference: ${Object.keys(shapes).length} shapes, ${Object.keys(properties).length} distinct property records (${process.argv.includes('--check') ? 'verified' : 'written'}).`);
