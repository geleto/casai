// These helpers generate source text; they never execute a displayed example.
export const has = (options, name) => options.includes(name);
export const sourceModes = ['withAudio', 'withText', 'withTemplate', 'withScript', 'withFunction', 'loadText', 'loadTemplate', 'loadScript', 'loadAudio'];
export const sourceMode = options => sourceModes.find(name => has(options, name));
export const sourceKind = options => sourceMode(options)?.includes('Template') ? 'cat' : sourceMode(options)?.includes('Script') ? 'cas' : has(options, 'loadText') ? 'txt' : undefined;
export const prepared = options => Boolean(sourceMode(options)) && !['loadText', 'withText', 'withAudio', 'loadAudio'].some(mode => has(options, mode));
export const indent = (text, spaces = 2) => text.split('\n').map(line => line ? ' '.repeat(spaces) + line : '').join('\n');

// Keep long strings readable without changing their whitespace or escape sequences.
export function literal(value) {
  if (typeof value !== 'string') return JSON.stringify(value);
  const parts = [];
  let part = '';
  for (const word of value.split(/(?<=\s)/u)) {
    if (part && (JSON.stringify(part + word).length > 60 || part.endsWith('\n'))) {
      parts.push(JSON.stringify(part));
      part = '';
    }
    part += word;
  }
  parts.push(JSON.stringify(part));
  return parts.length === 1 ? parts[0] : `(\n${indent(parts.join(' +\n'))}\n)`;
}

export function invoke(name, args) {
  const compact = `${name}(${args})`;
  return compact.length <= 52 && !compact.includes('\n') ? compact : `${name}(\n${indent(args)}\n)`;
}

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
  if (mode === 'loadAudio') return { fields: plain === undefined ? [] : [`${field}: ${plain},`], files: [], loaded: false };
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
    files: [{ name, language: kind === 'cat' ? 'jinja' : kind === 'cas' ? 'cascada' : 'text', code }],
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
  execute: () =>
${indent(value, 4)},
});` : `// Replace this sample lookup with your application service.
const ${name} = async () =>
${indent(value)};`,
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
  context: {
    arguments: ${indent(args, 4).trimStart()},
  },
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
const answer = await ${invoke('assistant', prompt)};
return {
  text: answer.output,
  toolResults: answer.steps.flatMap(step => step.toolResults),
};`;
}

export function renderExample({ component, options, variable, functionName, params = [], modelType,
  imports = [], setup = [], fields = [], source: input = { fields: [], files: [] },
  description, toolDescription, schema, toolArgs = '{}', toolCaller = 'agent', toolPrompt,
  call = `${variable}()`, named = '{}', result = 'return result;', body, typeImports = [], aiImports = [] }) {
  const asTool = has(options, 'asTool');
  if (asTool && !toolDescription) throw new Error(`Supply a model-facing toolDescription for ${component}`);
  const casai = new Set([component, ...imports]);
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
  const names = [...casai].sort().join(', ');
  const casaiImport = `import { ${names} } from 'casai';`;
  const importLines = [casaiImport.length <= 80 ? casaiImport : `import {\n${indent(names)}\n} from 'casai';`];
  if (types.size) importLines.push(`import type { ${[...types].sort().join(', ')} } from 'ai';`);
  if (ai.size) importLines.push(`import { ${[...ai].sort().join(', ')} } from 'ai';`);
  if (input.loaded) importLines.push("import { fileURLToPath } from 'node:url';");
  const config = [
    ...(modelType ? ['model,'] : []), ...fields,
    ...(asTool ? [`description: ${literal(toolDescription)},`] : []),
    ...(schema ? [`inputSchema: ${schema},`] : []), ...input.fields,
  ];
  const declaration = `const ${variable} = ${factory(component, options)}({\n${indent(config.join('\n'))}\n});`;
  const invocation = body ?? (asTool && !has(options, 'run') ? toolUse(variable, toolArgs, toolCaller, toolPrompt)
    : `const result = await ${has(options, 'run') ? invoke(`${variable}.run`, asTool ? `{ context: ${toolArgs} }` : named) : call};\n${result}`);
  const signature = `export async function ${functionName}(${parameters.join(', ')}) {`;
  const heading = signature.length <= 80 && !signature.includes('\n') ? signature
    : `export async function ${functionName}(\n${indent(parameters.join(',\n'))},\n) {`;
  let code = `${importLines.join('\n')}\n\n// ${description}\n${heading}\n${indent([...setup, declaration, invocation].filter(Boolean).join('\n\n'))}\n}\n`;
  if (input.inlineText !== undefined) code = code.replace('__MATRIX_SOURCE__', () => multiline(input.inlineText));
  return { id: exampleId(component, options),
    configuration: { component, factory: factory(component, options), variable,
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
