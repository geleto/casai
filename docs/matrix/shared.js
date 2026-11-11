// These helpers generate source text; they never execute a displayed example.
export const has = (options, name) => options.includes(name);
export const sourceModes = ['withTemplate', 'withScript', 'withFunction', 'loadTemplate', 'loadScript'];
export const sourceMode = options => sourceModes.find(name => has(options, name));
export const sourceKind = options => sourceMode(options)?.includes('Template') ? 'cat' : sourceMode(options)?.includes('Script') ? 'cas' : undefined;
export const prepared = options => Boolean(sourceMode(options));
export const literal = value => JSON.stringify(value);
export const indent = (text, spaces = 2) => text.split('\n').map(line => line ? ' '.repeat(spaces) + line : '').join('\n');

// Escape the *generated* JavaScript literal, not the Cascada source inside it.
export function multiline(value) {
  return '`' + value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
}

export function exampleId(component, options) {
  const first = [sourceMode(options), ...['asStream', 'asTool'].filter(name => has(options, name))];
  return [component, ...first, ...options.filter(name => !first.includes(name))]
    .filter(Boolean).join('_');
}

export function factory(component, options) {
  const source = sourceMode(options)?.replace(/^load/, 'loads');
  return [component, source, ...['asStream', 'asTool'].filter(name => has(options, name))].filter(Boolean).join('.');
}

export function source(component, field, options, resources, plain, fn, defaultKind) {
  const mode = sourceMode(options);
  const kind = sourceKind(options) ?? defaultKind;
  if (mode === 'withFunction') return { fields: [`${field}: ${fn},`], files: [], loaded: false };
  if (!kind) return { fields: plain === undefined ? [] : [`${field}: ${plain},`], files: [], loaded: false };
  const name = `${component}.${kind}`;
  const code = resources[name];
  if (typeof code !== 'string') throw new Error(`Missing example resource: ${name}`);
  if (mode?.startsWith('load')) return {
    fields: [
      '// Save the accompanying source file beside this example.',
      "loader: new FileSystemLoader(fileURLToPath(new URL('.', import.meta.url))),",
      `${field}: ${literal(name)},`,
    ],
    files: [{ name, language: kind === 'cat' ? 'jinja' : 'cascada', code }],
    loaded: true,
  };
  return { fields: [`${field}: __MATRIX_SOURCE__,`], files: [], loaded: false, inlineText: code };
}

// The same lookup can be an ordinary private dependency or a registered tool.
// Its name/calls stay unchanged when useTools is toggled.
export function lookup(options, { name = 'lookupInfo', description, value, schema = 'z.string()' }) {
  const enabled = has(options, 'useTools');
  return {
    name,
    setup: enabled ? `// Register the lookup so Casai validates and exposes it as a tool.
const ${name} = Function.asTool({
  description: ${literal(description)},
  inputSchema: z.object({}),
  schema: ${schema},
  execute: () => ${value},
});` : `// Replace this sample lookup with your application service.
const ${name} = async () => ${value};`,
    context: enabled ? [] : [name],
    fields: enabled ? [`tools: { ${name} },`] : [],
    imports: enabled ? ['Function', 'z'] : [],
  };
}

export function contextField(entries) {
  return entries.length ? [`context: { ${entries.join(', ')} },`] : [];
}

export function toolUse(variable, args, kind, prompt) {
  if (kind === 'script') return `// Call the tool from a workflow and keep its native application result.
const workflow = Script({
  tools: { ${variable} },
  context: { arguments: ${args} },
  script: 'return ${variable}(arguments)',
});
return await workflow();`;
  if (!prompt) throw new Error(`Supply a natural-language toolPrompt for ${variable}`);
  return `// Give this component to an AI agent as a tool.
const assistant = LLMAgent({
  model: orchestratorModel,
  tools: { ${variable} },
  stopWhen: isStepCount(3),
});
const answer = await assistant(${prompt});
return {
  text: answer.output,
  toolResults: answer.steps.flatMap(step => step.toolResults),
};`;
}

export function renderExample({ component, options, variable, params = [], modelType, streamingFactory,
  imports = [], setup = [], fields = [], source: input = { fields: [], files: [] },
  description, toolDescription = description, schema, toolArgs = '{}', toolCaller = 'agent', toolPrompt,
  call = `${variable}()`, named = '{}', result = 'return result;', body, typeImports = [], aiImports = [] }) {
  const asTool = has(options, 'asTool');
  // Keep one matrix family while the current audio API has separate factories.
  const separateStream = has(options, 'asStream') && streamingFactory;
  const api = separateStream || component;
  const modifiers = separateStream ? options.filter(id => id !== 'asStream') : options;
  const casai = new Set([api, ...imports]);
  const types = new Set(typeImports);
  const ai = new Set(aiImports);
  const parameters = [];
  if (modelType) {
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(modelType)) types.add(modelType);
    parameters.push(`model: ${modelType}`);
  }
  if (asTool && !has(options, 'run') && toolCaller === 'agent') {
    casai.add('LLMAgent'); types.add('LanguageModel'); ai.add('isStepCount');
    parameters.push('orchestratorModel: LanguageModel');
  }
  if (asTool && !has(options, 'run') && toolCaller === 'script') casai.add('Script');
  parameters.push(...params);
  if (schema) casai.add('z');
  if (input.loaded) casai.add('FileSystemLoader');
  if (has(options, 'useTools') && component === 'LLMAgent') ai.add('isStepCount');
  const importLines = [`import { ${[...casai].sort().join(', ')} } from 'casai';`];
  if (types.size) importLines.push(`import type { ${[...types].sort().join(', ')} } from 'ai';`);
  if (ai.size) importLines.push(`import { ${[...ai].sort().join(', ')} } from 'ai';`);
  if (input.loaded) importLines.push("import { fileURLToPath } from 'node:url';");
  const config = [
    ...(modelType ? ['model,'] : []), ...fields,
    ...(asTool ? [`description: ${literal(toolDescription)},`] : []),
    ...(schema ? [`inputSchema: ${schema},`] : []), ...input.fields,
  ];
  const declaration = `const ${variable} = ${factory(api, modifiers)}({\n${indent(config.join('\n'))}\n});`;
  const invocation = body ?? (asTool && !has(options, 'run') ? toolUse(variable, toolArgs, toolCaller, toolPrompt)
    : `const result = await ${has(options, 'run') ? `${variable}.run(${asTool ? `{ context: ${toolArgs} }` : named})` : call};\n${result}`);
  let code = `${importLines.join('\n')}\n\n// ${description}\nexport async function example(${parameters.join(', ')}) {\n${indent([...setup, declaration, invocation].filter(Boolean).join('\n\n'))}\n}\n`;
  if (input.inlineText !== undefined) code = code.replace('__MATRIX_SOURCE__', () => multiline(input.inlineText));
  return { id: exampleId(component, options),
    configuration: { component, factory: factory(api, modifiers), variable,
      properties: config.flatMap(field => field.match(/^([\w$]+)\s*(?=[:,])/)?.slice(1) ?? []) },
    files: [{ name: `${component}.ts`, language: 'typescript', code }, ...input.files] };
}

export const audioStreamSetup = `// Open a fresh stream over 24 kHz mono PCM16 little-endian bytes.
const openRecording = () => {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset === pcm24k.byteLength) return controller.close();
      const end = Math.min(offset + 9600, pcm24k.byteLength);
      controller.enqueue(pcm24k.subarray(offset, end));
      offset = end;
    },
  }, { highWaterMark: 0 });
};`;

export const consumeAudio = final => `// Consume the stream once before reading final values.
for await (const part of result.fullStream) {
  console.log(part);
}
return await result.${final};`;
