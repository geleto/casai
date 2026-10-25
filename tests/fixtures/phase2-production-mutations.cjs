// Fault injection against isolated copies of production code, never the working tree.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const filter = new RegExp(process.argv[2] ?? '');
const temporary = fs.mkdtempSync(path.join(workspace, '.phase2-production-mutations-'));
const runtimeFiles = ['tests/Phase2.integration.test.ts', 'tests/ToolLifecycle.unit.test.ts', 'tests/Registry.unit.test.ts', 'tests/cascada.ts',
  'tests/SchemaIdentity.unit.test.ts', 'tests/ComponentInterop.unit.test.ts', 'tests/LLMCalls.unit.test.ts', 'tests/LLMSurface.unit.test.ts', 'tests/ReviewCorrections.unit.test.ts', 'tests/Streams.unit.test.ts', 'tests/SchemaPreparation.unit.test.ts',
  'tests/ClosedToolInput.unit.test.ts', 'tests/ConfigValidation.test.ts', 'tests/fixtures/phase2-api-schemas.ts', 'tests/fixtures/phase2-security-sdk.ts'];
function run(args, expected) {
  const result = spawnSync(process.execPath, args, { cwd: temporary, encoding: 'utf8', timeout: 180000 });
  assert.equal(result.error, undefined);
  const output = result.stdout + result.stderr;
  if (expected) {
    assert.notEqual(result.status, 0, `Mutation survived: ${output}`);
    assert.match(output, expected);
  } else assert.equal(result.status, 0, output);
}
function mocha(pattern, expected) {
  run([path.join(workspace, 'node_modules/mocha/bin/mocha.js'), '--no-config', '--node-option', 'import=tsx/esm',
    '--node-option', 'conditions=casai-source', '--timeout', '10000', '--reporter', 'dot',
    ...runtimeFiles.filter(file => file.endsWith('.test.ts')), '--grep', pattern], expected);
}
try {
  fs.cpSync(path.join(workspace, 'src'), path.join(temporary, 'src'), { recursive: true });
  for (const file of runtimeFiles) {
    fs.mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true });
    fs.copyFileSync(path.join(workspace, file), path.join(temporary, file));
  }
  fs.writeFileSync(path.join(temporary, 'package.json'), JSON.stringify({
    name: 'casai', type: 'module', exports: { '.': { 'casai-source': './src/index.ts', default: './src/index.ts' } },
  }));
  mocha('production execution|Production SDK tool lifecycle|Owned tool registries|Production schema identity|LLM call contracts|Review configuration and metadata corrections|Config validation');
  const mutations = [
    ['cross-copy error brand', "Symbol.for('casai.error.ConfigError')", "Symbol('casai.error.ConfigError')", 'recognizes foreign validation errors', 'src/errors.ts'],
    ['incompatible protocol diagnostic', "if (typeof tool === 'function')", "if (false && typeof tool === 'function')", 'distinguishes incompatible callable'],
    ['required invocation model', "if (!hasConfiguredValue(config, 'model')) throw new ConfigError(\"LLM calls",
      'if (false) throw new ConfigError("LLM calls', 'rejects a cleared model', 'src/validate.ts'],
    ['forwarded application envelope', 'return { value: parsed };', 'return parsed;', 'forwards then helpers'],
    ['schema validation envelope', 'return result;', 'return { value: await Promise.resolve(result.value) };',
      'retains callable then', 'src/schema.ts'],
    ['bound context envelope', 'const { incoming } = await prepared.ready();', 'const incoming = await prepared.ready().then(facts => facts.incoming);',
      'retains callable then'],
    ['cross-copy binding identity', "Symbol.for('casai.tool.binding.v1')", "Symbol('casai.tool.binding.v1')", 'preserves foreign component'],
    ['cross-copy stream identity', "const streamKind = '~casaiStream';", "const streamKind = Symbol('Casai stream schema');",
      'collects foreign text', 'src/streams.ts'],
    ['undefined invocation prompt', 'if (settings.prompt === undefined) delete settings.prompt;', '',
      'undefined run prompt', 'src/llm-component.ts'],
    ['execution context envelope', 'return { context: execution };', 'return execution;',
      'keeps an unused then helper'],
    ['obsolete object generation mode', "if ('mode' in config)", "if (false && 'mode' in config)",
      'rejects obsolete object generation mode', 'src/validate.ts'],
    ['keyword marker value', " || Reflect.get(last, '__hasKeywordArgs') !== true", '', 'treats only a true keyword marker'],
    ['SDK request ownership', 'for (const key of componentSettings) Reflect.deleteProperty(request, key);', 'void componentSettings;',
      'passes native model settings without leaking', 'src/llm-component.ts'],
    ['duplicate message validation', 'const merged = mergeConfigs(config, settings) as TConfig & ExecutionConfig;',
      'const merged = mergeConfigs(config, mergeConfigs({}, settings)) as TConfig & ExecutionConfig;',
      'validates invocation history once', 'src/llm-component.ts'],
    ['early coded cancellation', 'options.abortSignal?.throwIfAborted();\n\tconst registry = prepareRegistry(config, toolsContext);',
      'const registry = prepareRegistry(config, toolsContext);', 'checks cancellation before application and bound-context'],
    ['early SDK executor cancellation', 'options.abortSignal?.throwIfAborted();\n\t\t\tconst registry = prepareRegistry(config);',
      'const registry = prepareRegistry(config);', 'checks cancellation before application and bound-context'],
    ['early LLM cancellation', 'settings.abortSignal?.throwIfAborted();\n\t\tsettings = { ...settings };',
      'settings = { ...settings };', 'checks cancellation before invocation history validation', 'src/llm-component.ts'],
    ['injected native options', 'const metadata = { ...options, toolCallId: generateId(), messages: [] };',
      'const metadata = { abortSignal: options.abortSignal, toolCallId: generateId(), messages: [] };',
      'forwards native execution options'],
    ['undeclared tool arguments', 'if (unknown.length) throw new ConfigError(`Undeclared', 'if (false && unknown.length) throw new ConfigError(`Undeclared', 'rejects undeclared keys before validation'],
    ['open Zod tool admission', "if (tool && current?.type ===", "if (false && tool && current?.type ===", 'rejects open roots', 'src/schema.ts'],
    ['open metadata tool admission', "if (tool && (schema.additionalProperties", "if (false && tool && (schema.additionalProperties", 'rejects open roots', 'src/schema.ts'],
    ['original Standard input metadata', "tool && !zod4Definition(schema) && converter", "false && tool && !zod4Definition(schema) && converter", 'rejects open roots', 'src/schema.ts'],

    ['default priority', '{ ...selectFields(configured, names, true), ...selectFields(incoming, names, true) }',
      '{ ...selectFields(incoming, names, true), ...selectFields(configured, names, true) }', 'binds incoming public defaults'],
    ['private guard', 'if (rejected.length) throw new ConfigError',
      'if (false && rejected.length) throw new ConfigError', 'protects private bindings|guards ordinary'],
    ['parsed-value consumption', 'const execution = { ...privateFields, ...input, _toolOptions: options };',
      'const execution = { ...configured, ...privateFields, ...input, _toolOptions: options };', 'without restoring removed fields'],
    ['metadata authority', 'const execution = { ...privateFields, ...input, _toolOptions: options };',
      'const execution = { _toolOptions: options, ...privateFields, ...input };', 'never trusts a metadata marker'],
    ['run keyword normalization', 'const normalized = namedArguments(args);',
      'const normalized = args;', 'normalizes coded run keywords'],
    ['run settings snapshot', 'const settings = { ...requireContextObject(normalized[0] === undefined ? {} : normalized[0]) };',
      'const settings = requireContextObject(normalized[0] === undefined ? {} : normalized[0]);', 'snapshots source settings'],
    ['undefined step context', "if (next?.toolsContext !== undefined)",
      "if (next && Object.hasOwn(next, 'toolsContext'))", 'retains bound context', 'src/llm-component.ts'],
    ['Zod 3 rejection', "schema._def.typeName.startsWith('Zod')", 'false',
      'rejects Zod 3 component schemas', 'src/schema.ts'],
    ['Zod 4 Classic/Mini discovery', "&& '_zod' in schema", "&& false && '_zod' in schema",
      'discovers declared output names', 'src/schema.ts'],
    ['context output direction', 'const inner = unwrap(schema, true);', 'const inner = unwrap(schema, false);',
      'discovers declared output names', 'src/schema.ts'],
    ['partial intersection ownership', 'return [current.left, current.right];', 'return [current.right];',
      'discovers declared output names', 'src/schema.ts'],
    ['SDK application validation details', 'sdk ? undefined : toolName === undefined',
      "sdk ? 'Application input' : toolName === undefined", 'preserves public argument validation details'],
    ['keyword history normalization', 'args.slice(0, -1).some(isPlainObject)', "args.length > 1 && typeof args[0] !== 'string'",
      'preserves history with Cascada keyword context'],
    ['configuration snapshot', 'return processed;', 'return config;', 'snapshots reusable settings', 'src/config-utils.ts'],
    ['model/tool provider option ownership', '}, undefined, descriptorConfig);', '});',
      'keeps providerOptions on the inner model only', 'src/llm-component.ts'],
    ['partition metadata diagnostics', "throw new ConfigError('Input partitioning requires supported object declarations or explicit input metadata.',",
      "throw new Error('Input partitioning requires supported object declarations or explicit input metadata.',",
      'explains missing partition metadata', 'src/schema.ts'],
    ['obsolete rendering options', "if ('options' in config)", "if (false && 'options' in config)",
      'rejects obsolete rendering options', 'src/validate.ts'],
    ['standalone map snapshots', 'if (config[key] !== undefined)', 'if (false && config[key] !== undefined)',
      'dependencies consistent with inherited=false', 'src/config-utils.ts'],
    ['inherited map snapshots', 'else if (merged[key] !== undefined)', 'else if (false && merged[key] !== undefined)',
      'dependencies consistent with inherited=true', 'src/config-utils.ts'],
    ['run-only registry binding', 'if (settings.tools)', 'if (base.tools)',
      'binds run-only registries|guards run-only step context', 'src/llm-component.ts'],
    ['root message snapshot', 'messages: [...config.messages as ModelMessage[]]', 'messages: config.messages',
      'snapshots configured message arrays', 'src/config-utils.ts'],
    ['one-sided message snapshot', 'merged.messages = [...merged.messages as ModelMessage[]]', 'merged.messages = merged.messages',
      'snapshots configured message arrays', 'src/config-utils.ts'],
    ['injected browser ID', 'toolCallId: generateId()', 'toolCallId: crypto.randomUUID()',
      'creates injected tool IDs'],
    ['prompt validation label', "await engine.run(source, context), 'Prompt output'", "await engine.run(source, context), 'Output'",
      'labels Script and Function prompt failures', 'src/prompt-renderers.ts'],
    ['local preprocessor discovery', "current?.type === 'pipe' && zod4Definition(current.in)?.type === 'transform'",
      "false && current?.type === 'pipe' && zod4Definition(current.in)?.type === 'transform'",
      'discovers non-JSON local declarations', 'src/schema.ts'],
    ['local lazy discovery', "if (current?.type === 'lazy') return rawObjectNames", "if (false && current?.type === 'lazy') return rawObjectNames",
      'discovers non-JSON local declarations', 'src/schema.ts'],
    ['local intersection discovery', 'const left = rawObjectNames(current.left, depth + 1, false, tool);', 'const left = undefined;',
      'discovers non-JSON local declarations', 'src/schema.ts'],
    ['private symbol preservation', 'ownKeys(source).filter', 'Object.keys(source).filter',
      'preserves private symbol bindings', 'src/schema.ts'],
    ['readable stream prefetch', 'highWaterMark: 0', 'highWaterMark: 1',
      'does not acquire a source|does not prefetch', 'src/streams.ts'],
    ['LLM run envelope', "if (normalized.length > 1) throw new ConfigError('A component run accepts one settings object.');",
      "if (false && normalized.length > 1) throw new ConfigError('A component run accepts one settings object.');",
      'normalizes run keywords and rejects mixed settings', 'src/llm-component.ts'],
    ['spread tool rejection', "if ('bindToolContext' in tool && !(bindComponent in tool))",
      "if (false && 'bindToolContext' in tool && !(bindComponent in tool))",
      'requires component initialization'],
    ['lazy context reservations', "if (zod4Definition(schema)?.type === 'lazy') return contextNames",
      "if (false && zod4Definition(schema)?.type === 'lazy') return contextNames",
      'resolves lazy output declarations', 'src/schema.ts'],
    ['private declaration cutoff', 'if (seen.has(schema))', 'if (seen.size === 12 || seen.has(schema))',
      'resolves lazy output declarations', 'src/schema.ts'],
  ];
  for (const [name, before, after, pattern, file = 'src/execution.ts'] of mutations) {
    if (!filter.test(name)) continue;
    const target = path.join(temporary, file);
    const source = fs.readFileSync(target, 'utf8');
    const location = before.replace(/\n/g, source.includes('\r\n') ? '\r\n' : '\n');
    assert.ok(source.includes(location), `Missing mutation location: ${name}`);
    fs.writeFileSync(target, source.replace(location, after));
    mocha(pattern, /failing/);
    fs.writeFileSync(target, source);
    console.log(`Caught production mutation: ${name}`);
  }
} finally {
  const target = path.resolve(temporary);
  assert.equal(path.dirname(target), workspace);
  assert.ok(path.basename(target).startsWith('.phase2-production-mutations-'));
  fs.rmSync(target, { recursive: true, force: true });
}
