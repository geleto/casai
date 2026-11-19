// Focused boundary regressions. Mutate an isolated source copy, never the workspace.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(workspace, '.component-review-mutations-'));
const filter = new RegExp(process.argv[2] ?? '');
const tests = ['tests/ComponentBoundaryReview.unit.test.ts', 'tests/ClaudeRuntimeReview.unit.test.ts', 'tests/StructuredSources.unit.test.ts', 'tests/ComponentCalls.unit.test.ts', 'tests/VoiceAgentBackend.unit.test.ts', 'tests/ConfigModifiers.unit.test.ts', 'tests/SuppliedAudio.unit.test.ts'];
const mutations = [
  ['multiple transport headers', 'src/audio/source-evidence.ts', 'return varying;', 'return true;', 'requires multiple distinct transport-stream headers'],
  ['foreign positional recording', 'src/runtime/execution.ts', '!isArrayBuffer(value)', '!(value instanceof ArrayBuffer)', 'keeps a trusted foreign recording'],
  ['early PCM completion', 'src/audio/input.ts', 'if (!prepared.settings[streamMode]) await close?.();', '', 'releases a converted producer'],
  ['unidentified base64 file', 'src/audio/supplied.ts', 'if (base64WithLayout) {', "if (base64WithLayout && !detectMediaType({ data: bytes, topLevelType: 'audio' })) {", 'checks the same SDK file MIME'],
  ['finite PCM byte budget', 'src/audio/supplied.ts', 'checkPcmOutput(bytes.byteLength, format, target, limit);', '', 'bounds finite PCM preparation'],
  ['base64 worker boundary', 'src/audio/pcm.ts', "typeof pending === 'string' && pending.length > 0", 'false', 'keeps significant base64 quartets'],
  ['prepared null image text', 'src/factories/ImageGenerator.ts', '(input as string | null | undefined) ?? undefined', '(input as string | undefined)', 'checks null prepared image text'],
  ['realtime tool execution options', 'src/factories/VoiceAgentBackend.ts', 'if (error) throw new ValidationError(error);', '', 'rejects removed controls on executeTool'],
  ['required embedding input', 'src/factories/Embedder.ts', 'if (request.input == null)', 'if (false)', 'rejects missing effective tool inputs'],
  ['required reranking documents', 'src/factories/Reranker.ts', 'if (prepared.settings.documents == null)', 'if (false)', 'rejects missing effective tool inputs'],
  ['WAV layout precedence', 'src/audio/supplied.ts', "if (container === 'audio/wav')", "if (container === 'audio/wav' && !source)", 'uses a WAV header before'],
  ['strong container raw admission', 'src/audio/supplied.ts', 'else if (container || encodedAudioType(mediaType))', 'else if (false)', 'rejects strong encoded evidence'],
  ['weak PCM signature rejection', 'src/audio/source-evidence.ts', 'bytes = bytes.subarray(0, audioPrefixBytes);', "bytes = bytes.subarray(0, audioPrefixBytes); if (bytes[0] === 255) return 'audio/mpeg';", 'rejects strong encoded evidence'],
  ['wrong supplied MIME', 'src/audio/input.ts', 'if (!mediaType || detected !== mediaType)', 'if (false)', 'rejects missing and wrong SDK MIME'],
  ['Config source selection', 'src/factories/component-factory.ts',
    'if (source !== undefined) merged[sourceMode] = source;', '',
    'inherits withScript with ordinary|replaces source modes without changing parents'],
  ['Config tool selection', 'src/factories/component-factory.ts',
    'asTool: factory(mode, toolMode)', 'asTool: factory(mode)',
    'inherits withTemplate with asTool'],
  ['Config stream selection', 'src/factories/component-factory.ts',
    'asStream: factory(mode, streamMode)', 'asStream: factory(mode)',
    'inherits withTemplate with asStream'],
  ['Config private source selector', 'src/config/modifiers.ts',
    "'promptType' in settings", 'false',
    'rejects authored promptType before modifiers'],
  ['Config source SDK projection', 'src/runtime/llm-agent.ts',
    "'toolContextSchema', sourceMode, 'filters'", "'toolContextSchema', 'filters'",
    'strips internal source metadata before the SDK request hook'],
  ['Config invocation source control', 'src/config/modifiers.ts',
    "[sourceMode, toolMode, streamMode].some(key => key in settings)", 'false',
    'rejects copied source metadata on every agent invocation entry'],
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
  ['streaming speech ownership', 'src/factories/SpeechGenerator.ts',
    'claimLiveInput(settings.text);', '',
    'forwards streaming speech voice and claims its source once'],
  ['streaming speech voice', 'src/factories/SpeechGenerator.ts',
    "call.take('voice', value => typeof value === 'string');", '',
    'forwards streaming speech voice and claims its source once'],
  ['streaming transcript model output', 'src/factories/Transcriber.ts',
    "({ output }) => ({ type: 'text', value: (output as TranscriptSnapshot).text })", 'undefined',
    'keeps streaming transcription model output textual'],
  ['token expiration ownership', 'src/factories/VoiceAgentBackend.ts',
    'const { model: _model, expiresAfterSeconds: _expiry, ...settings } = request;', 'const { model: _model, ...settings } = request;',
    'keeps token expiration outside native session configuration'],
  ['cleared voice settings', 'src/factories/VoiceAgentBackend.ts',
    '...definedSettings(settings)', '...settings',
    'omits cleared and conditional settings before native Live setup'],
  ['realtime cancellation after metadata', 'src/factories/VoiceAgentBackend.ts',
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
  ['streaming transcription provider metadata boundary', 'src/factories/Transcriber.ts',
    'return { text, segments, language, durationInSeconds };', 'return { text, segments, language, durationInSeconds, responses: result.responses };',
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
  ['voice execution promise boundary', 'src/factories/VoiceAgentBackend.ts',
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
  for (const file of [...tests, 'tests/cascada.ts', 'tests/pcm-reference.ts', 'tests/fixtures/runtime-call.ts', 'tests/fixtures/source-modes.ts', 'tests/fixtures/phase2-security-sdk.ts']) fs.copyFileSync(path.join(workspace, file), path.join(temporary, file));
  fs.copyFileSync(path.join(workspace, 'package.json'), path.join(temporary, 'package.json'));
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
