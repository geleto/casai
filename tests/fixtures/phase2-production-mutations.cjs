// Fault injection against isolated copies of production code, never the working tree.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const filter = new RegExp(process.argv[2] ?? '');
const temporary = fs.mkdtempSync(path.join(workspace, '.phase2-production-mutations-'));
const runtimeFiles = ['tests/Phase2.integration.test.ts', 'tests/ToolLifecycle.unit.test.ts', 'tests/Registry.unit.test.ts', 'tests/FactoryInference.test.ts', 'tests/cascada.ts',
  'tests/ComponentCalls.unit.test.ts', 'tests/ImageGenerator.unit.test.ts', 'tests/StructuredSources.unit.test.ts', 'tests/VoiceSessionSetup.unit.test.ts',
  'tests/SchemaIdentity.unit.test.ts', 'tests/ComponentInterop.unit.test.ts', 'tests/LLMCalls.unit.test.ts', 'tests/LLMSurface.unit.test.ts', 'tests/ReviewCorrections.unit.test.ts', 'tests/Streams.unit.test.ts', 'tests/SchemaPreparation.unit.test.ts',
  'tests/LLMAgent.unit.test.ts', 'tests/ModifierInheritance.unit.test.ts', 'tests/Engines.unit.test.ts', 'tests/LoaderComposition.unit.test.ts', 'tests/fixtures/runtime-call.ts', 'tests/ClosedToolInput.unit.test.ts', 'tests/ConfigValidation.test.ts', 'tests/fixtures/phase2-api-schemas.ts', 'tests/fixtures/phase2-security-sdk.ts'];
function run(args, expected, label) {
  const result = spawnSync(process.execPath, args, { cwd: temporary, encoding: 'utf8', timeout: 180000 });
  assert.equal(result.error, undefined);
  const output = result.stdout + result.stderr;
  if (expected) {
    assert.notEqual(result.status, 0, `Mutation survived (${label}): ${output}`);
    assert.match(output, expected);
  } else assert.equal(result.status, 0, output);
}
function mocha(pattern, expected, label = pattern) {
  run([path.join(workspace, 'node_modules/mocha/bin/mocha.js'), '--no-config', '--node-option', 'import=tsx/esm',
    '--node-option', 'conditions=casai-source', '--timeout', '10000', '--reporter', 'dot', '--fail-zero',
    ...runtimeFiles.filter(file => file.endsWith('.test.ts')), '--grep', pattern], expected, label);
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
  const mutations = [
    ['component payload capture', 'const prepared = tool ?? await prepareExecution(config, supplied.context, options, supplied.toolsContext as Fields | undefined);',
      'if (plain && config.asTool) await inputNames(config.inputSchema!, true);\n\t\t\tconst prepared = tool ?? await prepareExecution(config, supplied.context, options, supplied.toolsContext as Fields | undefined);',
      'captures ordinary application input before asynchronous tool metadata', 'src/runtime/component-call.ts'],
    ['image binary mask shorthand', "literal: first => first === undefined || typeof first === 'string' || isPlainObject(first)", "literal: first => !Array.isArray(first) && typeof first !== 'number'",
      'keeps binary masks separate', 'src/factories/ImageGenerator.ts'],
    ['plain tool parsed payload', 'tool.input[main]', 'prepared.context[main]',
      'selects plain tool input from parsed payload', 'src/runtime/component-call.ts'],
    ['prepared secondary string roles', "typeof first === 'string' && mode !== 'function'", "typeof first === 'string'", 'keeps prepared context distinct', 'src/runtime/component-call.ts'],
    ['component factory source inheritance', 'mode ?? merged.promptType ?? definition.defaultMode', 'mode ?? definition.defaultMode',
      'inherits loaded Template and Script sources|inherits an LLMAgent source', 'src/factories/component-factory.ts'],
    ['component factory explicit tool mode', 'if (asTool) merged.asTool = true;', '',
      'inherits tool mode on every coded component', 'src/factories/component-factory.ts'],
    ['component factory validation', 'validate?.(merged, definition);', '',
      'rejects streaming LLMAgent tools in both inheritance directions', 'src/factories/component-factory.ts'],
    ['component definition requirements', 'for (const key of required)', 'for (const key of [])',
      'should reject .* at creation', 'src/factories/component-factory.ts'],
    ['component invocation policy', 'definition.keys.filter(key => !definition.fixedSettings?.includes(key))', 'definition.keys.slice()',
      'keeps definition-owned fixed settings|keeps the captured model fixed', 'src/runtime/component-call.ts'],
    ['component source forwarding', '|| first === undefined && values.length > 1', '',
      'forwards omitted sources through the same application boundary', 'src/runtime/component-call.ts'],
    ['component resolved source', 'settings[main] = plain ? source ?? config[main] : await render(source, prepared.context);', 'settings[main] = source;',
      'reuses native loaders|renders only explicit decision', 'src/runtime/component-call.ts'],
    ['component descriptor options', "definition.keys.includes('providerOptions') ? innerDescriptor : { ...config }", 'innerDescriptor',
      'keeps providerOptions on the inner model only', 'src/runtime/component-call.ts'],
    ['component tool output collection', 'config.schema as SchemaType<unknown> | undefined, descriptor', 'undefined, descriptor',
      'collects foreign text and element stream schemas', 'src/runtime/component-call.ts'],
    ['component coded output parsing', 'validateAndParseOutput(merged, prepared.settings[definition.main])', 'prepared.settings[definition.main]',
      'validates and transforms output exactly once|applies non-idempotent output transforms once|reports schema failures as ValidationError', 'src/runtime/coded-component.ts'],
    ['component object context', 'isContextArgument(values[0])', "(values[0] !== null && typeof values[0] === 'object' && Object.getPrototypeOf(values[0]) === Object.prototype)",
      'accepts object-instance application fields', 'src/runtime/component-call.ts'],
    ['image object context', 'isContextArgument(values[1])', 'isPlainObject(values[1])',
      'selects a complete source before object-instance application context', 'src/factories/ImageGenerator.ts'],
    ['phase5 audio modifier exposure', 'modifiers: audioModifiers', "modifiers: { ...audioModifiers, withText: 'text' }",
      'keeps the modifier matrix small', 'src/factories/Transcriber.ts'],
    ['phase5 prepared transcription tools', 'toolModes: preparedModes', 'toolModes: []',
      'keeps the modifier matrix small', 'src/factories/StreamingTranscriber.ts'],
    ['phase5 live identity claim', 'if (handedOff.has(input))', 'if (false)',
      'claims ReadableStreams across components', 'src/runtime/live-input.ts'],
    ['component completed settings', 'if (definition.keys) {', 'if (false) {',
      'checks the resolved fields of each completed component', 'src/factories/component-factory.ts'],
    ['phase5 prepared document overrides', 'prepared.supplied.documents ?? query.documents', 'query.documents',
      'lets invocation documents override prepared documents', 'src/factories/Reranker.ts'],
    ['phase5 prepared mask overrides', 'supplied.mask ?? (', 'undefined ?? (',
      'applies the same field overrides', 'src/factories/ImageGenerator.ts'],
    ['phase5 image mask replacement', 'supplied.images === undefined ? bundle ? bundle.mask : config.mask : undefined', 'bundle ? bundle.mask : config.mask',
      'preserves native results, configured media', 'src/factories/ImageGenerator.ts'],
    ['phase5 public input selection', 'tool && publicInput ? tool.input[main]', 'tool ? tool.input[main]',
      'parses public tool text once', 'src/runtime/component-call.ts'],
    ['phase5 selected text rendering', 'text: await text(value.text!)', 'text: value.text!',
      'renders selected message text', 'src/renderers/prompt-renderers.ts'],
    ['phase5 actual tool metadata', 'return binding.invoke(rawInput, options)', "return binding.invoke(rawInput, { ...options, toolCallId: 'lost' })",
      'executes with actual call metadata'],
    ['loader JavaScript null child', 'if (child == null) return inherited;', 'if (child === undefined) return inherited;',
      'inherits a JavaScript null loader', 'src/loaders.ts'],
    ['loader JavaScript null parent', 'resolveLoader(parent) : parent ?? undefined', 'resolveLoader(parent) : parent',
      'null loader on a raw parent', 'src/loaders.ts'],
    ['loader child-first inheritance', '[child, inherited]', '[inherited, child]',
      'retains nested child/parent chains', 'src/loaders.ts'],
    ['loader parent replacement', "child[parentLoader] === 'override'", "false",
      'replaces the parent completely', 'src/loaders.ts'],
    ['loader standalone parent directive', 'inherited === undefined ? child.group : raceLoaders', 'false ? child.group : raceLoaders',
      'without inherited loaders', 'src/loaders.ts'],
    ['loader directive boundary', "if (isParentLoader(group)) throw new ConfigError", "if (false && isParentLoader(group)) throw new ConfigError",
      'rejects parent directives inside', 'src/loaders.ts'],
    ['renderer inline caching', 'compiled ??= compile(selected, env);', 'compiled = compile(selected, env);',
      'lazily compiles configured', 'src/renderers/cascada-renderer.ts'],
    ['renderer override isolation', 'result = await (script ? env.renderScriptString(selected, context) : env.renderTemplateString(selected, context));',
      'compiled = compile(selected, env); result = await compiled.render(context);',
      'lazily compiles configured', 'src/renderers/cascada-renderer.ts'],
    ['renderer lazy source construction', 'let compiled: ReturnType<typeof compile> | undefined;',
      'let compiled = !loaded && source !== undefined ? compile(source, env) : undefined;',
      'reports syntax errors in a configured script', 'src/renderers/cascada-renderer.ts'],
    ['bound descriptor context', 'if (!sameContext(binding.context, context))', 'if (false)',
      'preserves already-bound descriptors'],
    ['hook message ownership', 'messages: [...request.messages as ModelMessage[]]', 'messages: request.messages',
      'snapshots a hook-returned shared conversation', 'src/runtime/llm-agent.ts'],
    ['original conversation validation', 'validateMessagesArray(original, ValidationError);', '',
      'validates original conversation before preparation and hooks', 'src/runtime/llm-agent.ts'],
    ['native fixed settings', '[...fixedSettings, ...agentSourceConflicts, ...(native ? [] : retiredSettings)]',
      '[...(native ? [] : fixedSettings), ...agentSourceConflicts, ...(native ? [] : retiredSettings)]',
      'rejects fixed settings on', 'src/runtime/llm-agent.ts'],
    ['complete hook request object', "if (!isRecord(request)) throw new ValidationError('prepareCall must return a complete request object.');", '',
      'reports invalid prepareCall returns clearly', 'src/runtime/llm-agent.ts'],
    ['validation error classification', 'throw new ValidationError(`${boundary} validation failed.`', 'throw new ConfigError(`${boundary} validation failed.`',
      'names injected tools in validation errors', 'src/schema.ts'],
    ['lazy configuration error classification', "throw new ConfigError('Input partitioning requires supported object declarations or explicit input metadata.',",
      "throw new ValidationError('Input partitioning requires supported object declarations or explicit input metadata.',", 'preserves rejected metadata causes', 'src/schema.ts'],
    ['required configured model', 'for (const key of required)', "for (const key of required.filter(key => key !== 'model'))", 'leaves model selection to a child', 'src/factories/component-factory.ts'],
    ['forwarded application envelope', 'return { value: parsed };', 'return parsed;', 'forwards then helpers'],
    ['schema validation envelope', 'if (!result.success) throw result.error;\n\t\treturn result;', 'if (!result.success) throw result.error;\n\t\treturn { value: await Promise.resolve(result.value) };',
      'retains callable then', 'src/schema.ts'],
    ['bound context envelope', 'const { incoming } = await prepared.ready();', 'const incoming = await prepared.ready().then(facts => facts.incoming);',
      'retains callable then'],
    ['cross-copy stream identity', "const streamKind = '~casaiStream';", "const streamKind = Symbol('Casai stream schema');",
      'collects foreign text', 'src/streams.ts'],
    ['undefined invocation prompt', 'Object.entries(raw).filter(([, value]) => value !== undefined)', 'Object.entries(raw)',
      'undefined run prompt', 'src/runtime/llm-agent.ts'],
    ['execution context envelope', 'return { context: execution };', 'return execution;',
      'keeps an unused then helper'],
    ['obsolete object generation mode', "if ('mode' in config)", "if (false && 'mode' in config)",
      'rejects obsolete object generation mode', 'src/config/validate.ts'],
    ['protected request settings', 'request = { ...request, ...protectedValues, messages: [...request.messages as ModelMessage[]] };',
      'request = { ...request, messages: [...request.messages as ModelMessage[]] };',
      'returns a complete editable request', 'src/runtime/llm-agent.ts'],
    ['inherited modifiers', "if (parentConfig.asTool === true || childConfig.asTool === true) merged.asTool = true;", '',
      'inherits an LLMAgent source', 'src/config/config-utils.ts'],
    ['keyword marker value', " || Reflect.get(last, '__hasKeywordArgs') !== true", '', 'treats only a true keyword marker'],
    ['SDK request ownership', 'for (const key of [...componentSettings, ...protectedSettings]) Reflect.deleteProperty(request, key);', 'void componentSettings;',
      'complete editable request|keeps component and descriptor metadata outside', 'src/runtime/llm-agent.ts'],
    ['duplicate message validation', 'validateMessagesArray(original, ValidationError);',
      'validateMessagesArray(original, ValidationError); validateMessagesArray(original, ValidationError);',
      'validates invocation history once', 'src/runtime/llm-agent.ts'],
    ['early coded cancellation', '(raw.abortSignal as AbortSignal | undefined)?.throwIfAborted();', '',
      'checks cancellation before application and bound-context', 'src/runtime/component-call.ts'],
    ['early SDK executor cancellation', 'options.abortSignal?.throwIfAborted();\n\t\t\tconst registry = prepareRegistry(config);',
      'const registry = prepareRegistry(config);', 'checks cancellation before application and bound-context'],
    ['early LLM cancellation', '(raw.abortSignal as AbortSignal | undefined)?.throwIfAborted();', '',
      'checks cancellation before invocation history validation', 'src/runtime/llm-agent.ts'],
    ['observer runtime context', 'await callback?.(event)', "await callback?.({ ...(event as object), runtimeContext: { requestId: 'lost' } })",
      'retain structured text output and runtime context', 'src/runtime/llm-agent.ts'],
    ['injected native options', 'return invoke(key, normalized[0], { ...options, toolCallId: generateId(), messages: [] });',
      'return invoke(key, normalized[0], { abortSignal: options.abortSignal, toolCallId: generateId(), messages: [] });',
      'forwards native execution options'],
    ['undeclared tool arguments', 'if (unknown.length) throw new ValidationError(`Undeclared', 'if (false && unknown.length) throw new ValidationError(`Undeclared', 'rejects undeclared keys before validation'],
    ['open Zod tool admission', "if (tool && current?.type ===", "if (false && tool && current?.type ===", 'rejects open roots', 'src/schema.ts'],
    ['open metadata tool admission', "if (tool && (schema.additionalProperties", "if (false && tool && (schema.additionalProperties", 'rejects open roots', 'src/schema.ts'],
    ['original Standard input metadata', "tool && !zod4Definition(schema) && converter", "false && tool && !zod4Definition(schema) && converter", 'rejects open roots', 'src/schema.ts'],

    ['default priority', '{ ...selectFields(configured, names, true), ...selectFields(incoming, names, true) }',
      '{ ...selectFields(incoming, names, true), ...selectFields(configured, names, true) }', 'binds incoming public defaults'],
    ['private guard', 'if (rejected.length) throw new ValidationError',
      'if (false && rejected.length) throw new ValidationError', 'protects private bindings|guards ordinary'],
    ['parsed-value consumption', 'const execution = { ...privateFields, ...input, _toolOptions: options };',
      'const execution = { ...configured, ...privateFields, ...input, _toolOptions: options };', 'without restoring removed fields'],
    ['metadata authority', 'const execution = { ...privateFields, ...input, _toolOptions: options };',
      'const execution = { _toolOptions: options, ...privateFields, ...input };', 'never trusts a metadata marker'],
    ['run keyword normalization', 'const { values: normalized } = namedArguments(args);\n\tif (normalized.length > 1)',
      'const normalized = args;\n\tif (normalized.length > 1)', 'normalizes coded run keywords'],
    ['run settings snapshot', 'const settings = { ...requireContextObject(normalized[0] === undefined ? {} : normalized[0]) };',
      'const settings = requireContextObject(normalized[0] === undefined ? {} : normalized[0]);', 'snapshots WebRTC offers'],
    ['undefined step context', "if (next?.toolsContext !== undefined)",
      "if (next && Object.hasOwn(next, 'toolsContext'))", 'retains bound context', 'src/runtime/llm-agent.ts'],
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
    ['keyword history normalization', 'args.slice(objectSource ? 1 : 0, -1).some(isContextArgument)', "args.length > 1 && typeof args[0] !== 'string'",
      'preserves history with Cascada keyword context'],
    ['keyword object context', 'some(isContextArgument)', "some(value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)",
      'accepts object-instance application fields'],
    ['configuration snapshot', 'return merged as MergedConfig<TParent, TChild>;', 'return childConfig as MergedConfig<TParent, TChild>;',
      'snapshots configuration maps|dependencies consistent with inherited=', 'src/config/config-utils.ts'],
    ['model/tool provider option ownership', '{ tool: prepared }), undefined, descriptorConfig);', '{ tool: prepared }));',
      'keeps providerOptions on the inner model only', 'src/runtime/llm-agent.ts'],
    ['partition metadata diagnostics', "throw new ConfigError('Input partitioning requires supported object declarations or explicit input metadata.',",
      "throw new Error('Input partitioning requires supported object declarations or explicit input metadata.',",
      'explains missing partition metadata', 'src/schema.ts'],
    ['obsolete rendering options', "if ('options' in config)", "if (false && 'options' in config)",
      'rejects obsolete rendering options', 'src/config/validate.ts'],
    ['configuration map snapshots', 'else if (merged[key] !== undefined)', 'else if (false && merged[key] !== undefined)',
      'snapshots configuration maps|dependencies consistent with inherited=', 'src/config/config-utils.ts'],
    ['run-only registry binding', 'prepareExecution({ ...settings, context: config.context }', 'prepareExecution(config',
      'binds run-only registries|guards run-only step context', 'src/runtime/llm-agent.ts'],
    ['configured message snapshots', 'merged.prompt = [...merged.prompt as unknown[]]', 'merged.prompt = merged.prompt',
      'snapshots configured message arrays', 'src/config/config-utils.ts'],
    ['configured source defaults', 'return async (source: unknown = configured, context: Context)', 'return async (source: unknown, context: Context)',
      'keeps structured image sources distinct|uses independent native renders', 'src/renderers/prompt-renderers.ts'],
    ['injected browser ID', 'toolCallId: generateId()', 'toolCallId: crypto.randomUUID()',
      'creates injected tool IDs'],
    ['prompt validation label', "await parseSchema(PromptStringOrMessagesSchema, value, 'Prompt output')", "await parseSchema(PromptStringOrMessagesSchema, value, 'Output')",
      'labels Script and Function prompt failures', 'src/renderers/prompt-renderers.ts'],
    ['prepared message transport', 'return value as PromptValue;', 'return (await parseSchema(PromptStringOrMessagesSchema, value)).value;',
      'preserves provider approvals', 'src/renderers/prompt-renderers.ts'],
    ['prepared message validation', "await parseSchema(PromptStringOrMessagesSchema, value, 'Prompt output');", '',
      'rejects invalid prepared messages before dispatch', 'src/renderers/prompt-renderers.ts'],
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
    ['LLM run envelope', "if (values.length > 1) throw new ValidationError('An agent run accepts one settings object.');", '',
      'normalizes run keywords and rejects mixed settings', 'src/runtime/llm-agent.ts'],
    ['spread tool rejection', "if ('bindToolContext' in tool && !component)",
      "if (false && 'bindToolContext' in tool && !component)",
      'requires component initialization'],
    ['lazy context reservations', "if (zod4Definition(schema)?.type === 'lazy') return contextNames",
      "if (false && zod4Definition(schema)?.type === 'lazy') return contextNames",
      'resolves lazy output declarations', 'src/schema.ts'],
    ['private declaration cutoff', 'if (seen.has(schema))', 'if (seen.size === 12 || seen.has(schema))',
      'resolves lazy output declarations', 'src/schema.ts'],
  ];
  assert.ok(mutations.some(([name]) => filter.test(name)), `No production mutations match ${filter}.`);
  // Every mutation oracle must first pass against the unchanged candidate.
  mocha('');
  const failures = [];
  for (const [name, before, after, pattern, file = 'src/runtime/execution.ts'] of mutations) {
    if (!filter.test(name)) continue;
    const target = path.join(temporary, file);
    const source = fs.readFileSync(target, 'utf8');
    try {
      const location = before.replace(/\n/g, source.includes('\r\n') ? '\r\n' : '\n');
      assert.equal(source.split(location).length, 2, `Mutation location must occur once: ${name}`);
      fs.writeFileSync(target, source.replace(location, after));
      mocha(pattern, /failing/, name);
      console.log(`Caught production mutation: ${name}`);
    } catch (error) {
      failures.push(name);
      console.error(`Failed production mutation: ${name}`, error);
    } finally {
      fs.writeFileSync(target, source);
    }
  }
  assert.equal(failures.length, 0, `Failed production mutations: ${failures.join(', ')}`);
} finally {
  const target = path.resolve(temporary);
  assert.equal(path.dirname(target), workspace);
  assert.ok(path.basename(target).startsWith('.phase2-production-mutations-'));
  fs.rmSync(target, { recursive: true, force: true });
}
