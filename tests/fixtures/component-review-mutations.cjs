// Focused boundary regressions. Mutate an isolated source copy, never the workspace.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(workspace, '.component-review-mutations-'));
const filter = new RegExp(process.argv[2] ?? '');
const tests = ['tests/ComponentBoundaryReview.unit.test.ts', 'tests/ClaudeRuntimeReview.unit.test.ts', 'tests/StructuredSources.unit.test.ts', 'tests/ComponentCalls.unit.test.ts', 'tests/VoiceSessionSetup.unit.test.ts'];
const mutations = [
  ['plain shorthand keyword boundary', 'src/runtime/component-call.ts',
    "if (keywords) throw new ValidationError('Use .run() for named operation arguments.');", '',
    'keeps plain non-tool shorthand source-first'],
  ['tool dispatch cancellation', 'src/runtime/component-call.ts',
    'abortSignal: prepared.context._toolOptions.abortSignal', 'abortSignal: undefined',
    'forwards cancellation from a native descriptor'],
  ['authored model output formatter', 'src/runtime/component-call.ts',
    'descriptor.toModelOutput === undefined && toModelOutput !== undefined', 'toModelOutput !== undefined',
    'keeps an authored model-output formatter'],
  ['plain tool declaration boundary', 'src/runtime/execution.ts',
    'toolInputField !== undefined && names.some(key => key !== toolInputField)', 'false',
    'rejects misnamed plain-tool schemas'],
  ['shared input declaration discovery', 'src/runtime/component-call.ts',
    'prepared.inputNames.has(toolInputField)', "new Set(await (await import('../schema.js')).inputNames(config.inputSchema!, true)).has(toolInputField)",
    'reuses input declarations selected during preparation'],
  ['native embedding parallel limit', 'src/factories/Embedder.ts',
    'values: input }', 'values: input, maxParallelCalls: undefined }',
    'keeps SDK batch parallelism under the configured limit'],
  ['streaming speech ownership', 'src/factories/StreamingSpeechGenerator.ts',
    'claimLiveInput(settings.text);', '',
    'forwards streaming speech voice and claims its source once'],
  ['streaming speech voice', 'src/factories/StreamingSpeechGenerator.ts',
    "call.take('voice', value => typeof value === 'string');", '',
    'forwards streaming speech voice and claims its source once'],
  ['streaming transcript model output', 'src/factories/StreamingTranscriber.ts',
    "({ output }) => ({ type: 'text', value: (output as { text: string }).text })", 'undefined',
    'keeps streaming transcription model output textual'],
  ['token expiration ownership', 'src/factories/VoiceSessionSetup.ts',
    'const { model: _model, expiresAfterSeconds: _expiry, ...settings } = request;', 'const { model: _model, ...settings } = request;',
    'keeps token expiration outside native session configuration'],
  ['cleared voice settings', 'src/factories/VoiceSessionSetup.ts',
    '...definedSettings(settings)', '...settings',
    'omits cleared and conditional settings before native Live setup'],
  ['realtime cancellation after metadata', 'src/factories/VoiceSessionSetup.ts',
    'const sessionConfig = await voiceConfig(request, prepared.registry);\n\t\tprepared.context._toolOptions.abortSignal?.throwIfAborted();',
    'const sessionConfig = await voiceConfig(request, prepared.registry);',
    'checks cancellation after asynchronous realtime tool definitions'],
  ['SDK settings projection', 'src/runtime/component-call.ts',
    "for (const key of [...configurationKeys, 'context', 'toolsContext', ...omit]) Reflect.deleteProperty(request, key);", '',
    'matches native unknown-setting handling'],
  ['ordinary parsed tool payload', 'src/runtime/component-call.ts',
    'supplied[main] ?? (publicInput ? prepared.input[main] : undefined)', 'supplied[main] ?? (tool && publicInput ? prepared.input[main] : undefined)',
    'uses parsed payloads on ordinary'],
  ['literal rendered history', 'src/runtime/llm-agent.ts',
    "typeof first === 'string' || typeof first === 'function'", "typeof first === 'string' || typeof first === 'function' || Array.isArray(first)",
    'never renders positional history again'],
  ['transcription provider metadata boundary', 'src/factories/Transcriber.ts',
    'return { text, segments, language, durationInSeconds };', 'return result;',
    'exposes transcript application data to tools'],
  ['streaming transcription provider metadata boundary', 'src/factories/StreamingTranscriber.ts',
    'return { text, segments, language, durationInSeconds };', 'return { text, segments, language, durationInSeconds, responses: await result.responses };',
    'collects only transcript application fields'],
  ['native image content encoding', 'src/factories/ImageGenerator.ts',
    "type: 'file', data: { type: 'data', data: file.base64 }, mediaType: file.mediaType", "type: 'text', text: file.base64",
    'uses the native tagged file representation'],
  ['separate image input validation', 'src/factories/ImageGenerator.ts',
    "if (images !== undefined && !Array.isArray(images)) throw new ValidationError('Image generation images must be an array.');", '',
    'rejects separate non-array images'],
  ['prepared query document fallback', 'src/factories/Reranker.ts',
    'prepared.supplied.documents ?? query.documents ?? prepared.settings.documents', 'prepared.supplied.documents ?? query.documents',
    'retains fallback documents for a scripted query object'],
  ['voice execution promise boundary', 'src/factories/VoiceSessionSetup.ts',
    'async executeTool(call:', 'executeTool(call:',
    'rejects voice registry errors through the promised executeTool result'],
  ['loaded source error classification', 'src/renderers/prompt-renderers.ts',
    "throw new ValidationError('Failed to load source: ' + error.message, error);", "throw new Error('Failed to load source: ' + error.message, { cause: error });",
    'reports missing loaded sources as validation errors'],
];

function mocha(pattern, mutation) {
  const result = spawnSync(process.execPath, [path.join(workspace, 'node_modules/mocha/bin/mocha.js'), '--no-config',
    '--node-option', 'import=tsx/esm', '--node-option', 'conditions=casai-source', '--timeout', '10000',
    '--reporter', 'dot', '--fail-zero', ...tests, '--grep', pattern], { cwd: temporary, encoding: 'utf8', timeout: 60000 });
  assert.equal(result.error, undefined);
  const output = result.stdout + result.stderr;
  if (mutation) {
    assert.notEqual(result.status, 0, `Mutation survived (${mutation}): ${output}`);
    assert.match(output, /\d+ failing/, `Mutation did not reach an assertion (${mutation}): ${output}`);
  } else assert.equal(result.status, 0, output);
}

try {
  // Only production source and the selected mock suites are needed; dependencies resolve from the workspace.
  fs.cpSync(path.join(workspace, 'src'), path.join(temporary, 'src'), { recursive: true });
  fs.mkdirSync(path.join(temporary, 'tests/fixtures'), { recursive: true });
  for (const file of [...tests, 'tests/cascada.ts', 'tests/fixtures/runtime-call.ts']) fs.copyFileSync(path.join(workspace, file), path.join(temporary, file));
  fs.writeFileSync(path.join(temporary, 'package.json'), JSON.stringify({ name: 'casai', type: 'module',
    exports: { '.': { 'casai-source': './src/index.ts', default: './src/index.ts' } } }));
  const selected = mutations.filter(([name]) => filter.test(name));
  assert.ok(selected.length, `No component review mutations match ${filter}.`);
  mocha('');
  for (const [name, file, before, after, pattern] of selected) {
    const target = path.join(temporary, file);
    const original = fs.readFileSync(target, 'utf8');
    const location = before.replace(/\n/g, original.includes('\r\n') ? '\r\n' : '\n');
    assert.equal(original.split(location).length, 2, `Mutation location must occur once: ${name}`);
    try {
      fs.writeFileSync(target, original.replace(location, after));
      mocha(pattern, name);
      console.log(`Caught component review mutation: ${name}`);
    } finally {
      fs.writeFileSync(target, original);
    }
  }
  console.log(`Caught ${selected.length} component review mutations; unchanged controls passed.`);
} finally {
  const target = path.resolve(temporary);
  assert.equal(path.dirname(target), workspace);
  assert.ok(path.basename(target).startsWith('.component-review-mutations-'));
  fs.rmSync(target, { recursive: true, force: true });
}
