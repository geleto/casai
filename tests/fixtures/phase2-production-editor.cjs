// Exercise production factory completion and diagnostics through source and package declarations.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { createMessageConnection, StreamMessageReader, StreamMessageWriter } = require('vscode-jsonrpc/node');
const base = path.resolve(__dirname, '../..');

const source = `
import { create, z, textStreamSchema } from 'casai';
import { tool } from 'ai';
import type { LanguageModel } from 'ai';
const presenceInput = z.object({ value: z.string().transform(Number), count: z.number().default(1) });
declare const optionalSchema: { inputSchema?: typeof presenceInput };
declare const schemaEnabled: boolean;
const spreadSchema = schemaEnabled ? { inputSchema: presenceInput } : {};
create.Function({ ...optionalSchema, execute: input => {
  input./*optionalSchemaBody*/value;
  input.value/*optionalSchemaValue*/;
  input.count/*optionalSchemaDefault*/;
  return input.value;
} });
create.Function({ ...spreadSchema, execute: input => input.value/*spreadSchemaValue*/ });
create.Function({ inputSchema: presenceInput, execute: input => input.value/*definiteSchemaValue*/ });
create.Config({ ...spreadSchema, execute: input => {
  input./*configSchemaBody*/value;
  input.value/*configSchemaValue*/;
  input.count/*configSchemaDefault*/;
  return input.value;
} });
create.Config({ inputSchema: presenceInput, execute: input => input.value/*configDefiniteSchemaValue*/ });
const optionalConfigParent = create.Config(optionalSchema);
create.Config({ execute: input => input.value/*parentConfigSchemaValue*/ }, optionalConfigParent);
const enumConfig = create.Config({ output: 'enum', enum: ['YES', 'NO'] });
const mutableEnumValue = enumConfig.config.enum[0];
mutableEnumValue/*mutableConfigEnum*/;
const operation = create.Function({
  inputSchema: z.looseObject({ value: z.number(), factor: z.string().transform(Number), map: z.function({ input: [z.number()], output: z.number() }).optional() }),
  context: { factor: '3', db: 'private' },
  execute: input => { input./*implementation*/factor; return input.factor; }
});
operation({ /*call*/ }); // expected: value
operation.run({ context: { /*run*/ } }); // expected: value
operation({ value: 2, map: value => value/*parameter*/ });
operation.run({ context: { value: 2, factor: '4', map: value => value/*override*/ } });
operation({ value: 2, db: 'attacker' }); // expected: db
operation({ value: 2, factor: 3 }); // error
operation({ value: 2, factor: undefined, map: value => value }); // error
const closed = create.Function({ inputSchema: z.object({ value: z.number() }), execute: input => input.value });
closed({ value: 2, requestId: 'extra' }); // expected: requestId
const plain = create.Function({ context: { db: 'private' }, execute: (input: { query: string; db: string }) => input.query });
plain({ /*plain*/ }); // expected: query
plain({ query: 'ok', db: 'attacker' }); // expected: db
create.Function.asTool({ inputSchema: z.object({ query: z.string() }), execute: input => plain(input) });
declare const indexedPrivate: { query: string; db: string; [key: string]: unknown };
plain(indexedPrivate); // expected: db
plain.run({ context: indexedPrivate }); // expected: db
const branches = z.union([z.strictObject({ mode: z.literal('a'), a: z.number() }), z.strictObject({ mode: z.literal('b'), b: z.string() })]);
const branch = create.Function({ inputSchema: branches, context: { mode: 'a', a: 2 } as const, execute: input => input.mode });
branch({ mode: 'b', b: 'ok' }); // expected: a
const namedTool = create.Function.asTool({ inputSchema: z.object({ text: z.string() }), execute: input => input.text.length });
create.Function.asTool({ inputSchema: z.looseObject({ text: z.string() }), execute: () => 1 }); // error
create.Function({ inputSchema: z.object({ count: z.string().transform(Number) }), context: { label: 'ready' },
  schema: z.string().transform(Number), execute: input => {
    input./*producer*/label;
    return String(input.count);
  } });
create.Function({ tools: { toString: namedTool }, execute: input => {
  input./*prototypeMember*/toString({ text: 'ok' });
  return input.toString({ /*prototypeCall*/ }); // expected: text
} });
const fragment = create.Config({ tools: { toString: namedTool }, execute: input => {
  input./*fragmentMember*/toString({ text: 'ok' });
  return input.toString({ /*fragmentCall*/ }); // expected: text
} });
create.Function({}, fragment)();
const contextualTool = create.Function.asTool({ inputSchema: z.object({}), context: { factor: 1 },
  toolContextSchema: z.object({ factor: z.string().transform(Number) }), execute: input => input.factor });
const contextOwner = create.Function({ tools: { contextualTool }, toolsContext: { contextualTool: { factor: '2' } },
  execute: input => input.contextualTool({}) });
contextOwner.run({ toolsContext: { contextualTool: { /*toolContext*/ } } }); // expected: factor
contextOwner.run({ toolsContext: { contextualTool: undefined } }); // expected: contextualTool
const unknownContexts = { toolsContext: { contextualTool: { factor: '3' }, typo: {} } };
contextOwner.run(unknownContexts); // expected: typo
const templateTool = create.Template.asTool({ template: 'ready', inputSchema: z.object({}) });
create.Function({ tools: { templateTool }, execute: async input => {
  const text = await input.templateTool({});
  return text./*helperResult*/toUpperCase();
} });
const dependency = create.Function.asTool({ inputSchema: z.object({}),
  context: { db: (): string => 'trusted' }, execute: input => input.db() });
const dependencyOwner = create.Function({ tools: { dependency }, execute: input => input.dependency({}) });
dependencyOwner.run({ toolsContext: { dependency: { db: 'wrong' } } }); // expected: dependency
dependencyOwner.run({ toolsContext: { dependency: { db: () => 'replacement' } } });
const defaulted = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: input => input.value });
const defaultOwner = create.Function({ tools: { defaulted }, toolsContext: { defaulted: { value: 4 } },
  execute: input => input.defaulted({}) });
defaultOwner.run({ toolsContext: { defaulted: {} } }); // expected: defaulted
create.Function({ toolsContext: { defaulted: {} } }, defaultOwner); // expected: defaulted
create.Function({ toolsContext: { defaulted: {} }, execute: input => input.defaulted({ /*replacementCall*/ }) }, defaultOwner); // expected: value
declare const enabled: boolean;
const maybeSchema = enabled ? z.object({ value: z.string().transform(Number) }) : undefined;
const conditional = create.Function({ inputSchema: maybeSchema, execute: input => input.value/*conditionalValue*/ });
conditional({ /*conditionalCall*/ }); // expected: value
const privateConditional = create.Function({ inputSchema: maybeSchema, context: { value: '5' }, execute: input => input.value });
privateConditional({ value: '7' }); // expected: value
const described = create.Function.asTool({ inputSchema: z.object({}),
  toolContextSchema: z.object({ tenant: z.string() }), execute: () => 'ok',
  description: ({ context }) => context.tenant/*descriptionValue*/ });
create.Function.asTool({ toolContextSchema: z.object({ tenant: z.number() }) }, described); // expected: description
const mixed = create.Function.asTool({ inputSchema: z.object({}), schema: enabled ? textStreamSchema() : z.number(),
  execute: () => enabled ? (async function* () { yield 'ab'; })() : 7,
  toModelOutput: ({ output }) => ({ type: 'text', value: String(output/*mixedOutput*/) }) });
create.Function({ tools: { mixed }, execute: async ({ mixed }) => {
  const value = await mixed({});
  return typeof value === 'number' ? value : value./*mixedResult*/toUpperCase();
} });
declare const unionInput: { value: number } | { value: number; user: string };
const render = create.Template({ inputSchema: z.looseObject({ value: z.number() }), context: { user: 'private' }, template: '{{ value }}' });
render(unionInput); // expected: user
declare const model: LanguageModel;
const pairedPromptParent = { config: schemaEnabled
  ? { model, inputSchema: presenceInput, prompt: ({ value }: { value: number }) => value.toFixed() }
  : { model, inputSchema: z.object({ value: z.string() }), prompt: ({ value }: { value: string }) => value.toUpperCase() } };
create.TextGenerator.withFunction({}, pairedPromptParent)({ value: '4' });
create.TextGenerator.withFunction({ prompt: input => String(input.value/*pairedPromptValue*/) }, pairedPromptParent);
const enumParent = create.Config({ model, output: 'enum', enum: ['YES'] });
create.ObjectGenerator({ output: 'object', enum: undefined, schema: z.number(),
  onFinish: event => { event.object/*transitionOutput*/; } }, enumParent);
create.Script({ schema: undefined }, create.Config({ script: 'return "raw"', schema: z.number() }));
create.ObjectGenerator.withFunction({ model, schema: z.number(), ...spreadSchema, prompt: input => {
  input./*objectPromptMembers*/value;
  input.value/*objectPromptValue*/;
  return String(input.value);
} });
create.ObjectGenerator.withFunction.asTool({ model, schema: z.number(), inputSchema: presenceInput, context: { offset: 2 },
  prompt: input => String(input.value/*objectToolValue*/ + input.offset) });
create.ObjectGenerator({ model, schema: z.object({ answer: z.number() }), onFinish: event => {
  event.object?./*objectResultMembers*/answer;
} });
create.ObjectGenerator.withFunction({}, create.Config({ model, schema: z.number() })); // expected: prompt
create.ObjectGenerator.withFunction({ prompt: () => 'Answer' }, create.Config({ model, schema: z.number() }));
create.TextGenerator.withFunction({ model, ...spreadSchema, prompt: input => String(input.value/*textPromptValue*/) });
create.TextStreamer.withFunction({ model, ...spreadSchema, prompt: input => String(input.value/*textStreamPromptValue*/) });
create.ObjectStreamer.withFunction({ model, schema: z.number(), ...spreadSchema, prompt: input => String(input.value/*objectStreamPromptValue*/) });
create.TextGenerator.withFunction({}, create.Config({ model })); // expected: prompt
create.TextStreamer.withFunction({}, create.Config({ model })); // expected: prompt
create.ObjectStreamer.withFunction({}, create.Config({ model, schema: z.number() })); // expected: prompt
const rendererParent = create.Config({ inputSchema: presenceInput });
create.Template.asTool({ template: '{{ value }}', onInputAvailable: ({ input }) => { input.value/*templateDescriptorValue*/.toFixed(); } }, rendererParent);
create.Script.asTool({ script: 'return value', schema: z.number(),
  toModelOutput: ({ output }) => ({ type: 'text', value: String(output/*scriptDescriptorValue*/) }) }, rendererParent);
const runAlternatives = create.TextGenerator.withTemplate({ model, prompt: '{{ value }}',
  inputSchema: z.looseObject({ value: z.number() }), context: { value: 1, user: 'private' } });
declare const invalidRunAlternative: { maxOutputTokens: number } | { context: { value: number; user: string } };
declare const validRunAlternative: { maxOutputTokens: number } | { context: { value: number; extra: string } };
runAlternatives.run(invalidRunAlternative); // expected: user
runAlternatives.run(validRunAlternative);
const numericInput = z.object({ value: z.number() }).catchall(z.number());
const numericCaller = create.Function({ inputSchema: numericInput, context: { value: 1 }, execute: ({ value }) => value });
const numericRenderer = create.Template({ inputSchema: numericInput, context: { value: 1 }, template: '{{ value }}' });
const conditionalDefaults = enabled ? { inputSchema: numericInput, context: { value: 1 } } : { inputSchema: numericInput };
const conditionalRenderer = create.Template({ template: '{{ value }}' }, { config: conditionalDefaults });
const conditionalRenderedText = create.TextGenerator.withTemplate({ model, prompt: '{{ value }}' }, { config: conditionalDefaults });
conditionalRenderer({ value: 2 });
conditionalRenderedText({ value: 2 });
conditionalRenderer(); // error
conditionalRenderedText(); // error
declare const validCallerAlternative: { extra: number } | { other: number };
declare const invalidCallerAlternative: { value: number } | { value: number; extra: string };
numericCaller(validCallerAlternative);
numericCaller.run({ context: validCallerAlternative });
numericRenderer(validCallerAlternative);
numericCaller(invalidCallerAlternative); // error
numericRenderer(invalidCallerAlternative); // error
numericCaller({ /*numericCall*/ });
create.TextGenerator.withTemplate({ model, context: { user: 'private' }, inputSchema: z.union([z.object({ value: z.number() }), z.union([z.object({ value: z.number() }), z.object({ value: z.number() })])]), prompt: 'ready' }); // expected: declarations
const transformed = z.string().transform(text => text.length);
declare const alternativeConfig: { schema: typeof transformed; execute: () => string } | { execute: () => string };
const alternative = create.Function.asTool({ inputSchema: z.object({}), ...alternativeConfig });
create.Function({ tools: { alternative }, execute: async ({ alternative }) => {
  const value = await alternative({});
  return typeof value === 'number' ? value : value./*alternativeResult*/toUpperCase();
} });
const mixedInput = create.Function({ inputSchema: z.union([
  z.strictObject({ kind: z.literal('closed'), value: z.number() }),
  z.looseObject({ kind: z.literal('open'), value: z.number() }),
]), execute: ({ value }) => value });
mixedInput({ kind: 'closed', value: 2, extra: true }); // expected: extra
mixedInput({ kind: 'open', value: 2, extra: true });
const secured = tool({ inputSchema: z.object({}), contextSchema: z.object({ tenant: z.string() }), execute: (_input, { context }) => context.tenant });
declare const conditionalRegistry: { model: LanguageModel; tools: { secured: typeof secured } } | { model: LanguageModel };
create.TextGenerator(conditionalRegistry); // expected: secured
create.TextStreamer({}, { config: conditionalRegistry }); // expected: secured
declare const pairedRegistry: { tools: { secured: typeof secured }; toolsContext: { secured: { tenant: string } } } | { tools?: never };
create.TextGenerator({ model }, { config: pairedRegistry });
const textInput = z.object({ value: z.string() });
const numberInput = z.object({ value: z.number() });
declare const conditionalHook: { inputSchema: typeof textInput; execute: () => string; onInputAvailable: (event: { input: { value: string } }) => void }
  | { inputSchema: typeof textInput; execute: () => string };
create.Function.asTool({ inputSchema: numberInput }, { config: conditionalHook }); // expected: onInputAvailable
create.Function.asTool({ inputSchema: numberInput, onInputAvailable: event => { event.input.value/*replacedHook*/.toFixed(); } }, { config: conditionalHook });
declare const conditionalLifecycle: { model: LanguageModel; schema: typeof textInput; onFinish: (event: { object: { value: string } | undefined }) => void }
  | { model: LanguageModel; schema: typeof textInput };
create.ObjectGenerator({ schema: numberInput }, { config: conditionalLifecycle }); // expected: onFinish
create.ObjectGenerator({ schema: numberInput, onFinish: event => { event.object?.value.toFixed(); } }, { config: conditionalLifecycle });
declare const forbiddenSetting: { execute: () => number; contextSchema: undefined } | { execute: () => number };
create.Function(forbiddenSetting); // expected: contextSchema
declare const forbiddenRun: { temperature: number; contextSchema: undefined } | { temperature: number };
create.TextGenerator({ model, prompt: 'ready' }).run(forbiddenRun); // expected: contextSchema
create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.null(), execute: () => 1 }); // error
const preprocessed = create.Function({
  inputSchema: z.preprocess(value => value, z.object({ name: z.string() }).transform(({ name }) => ({ label: name.length }))),
  context: { name: 'Ada', db: true }, execute: input => { input./*preprocessedBody*/label; return input.label/*preprocessedValue*/; }
});
preprocessed({ name: 'Grace' });
preprocessed({ db: false }); // expected: db
const unionInputSchema = z.union([z.object({ x: z.number() }), z.object({ y: z.string() })]);
create.Function.asTool({ inputSchema: unionInputSchema, context: { x: 1 }, execute: input => input }); // error
const unionTool = create.Function.asTool({ inputSchema: unionInputSchema, context: { db: true }, execute: input => input });
unionTool.bindToolContext({ x: 2 }); // error
const copiedTool = { ...unionTool };
create.Function({ tools: { copiedTool }, execute: () => 1 }); // expected: copiedTool
const selectedPublic = z.looseObject({ key: z.string().transform(Number) });
const selectedPrivate = z.looseObject({ query: z.string().optional() });
const selected = create.Function({ inputSchema: enabled ? selectedPublic : selectedPrivate, context: { key: '4' },
  execute: input => { input./*selectedBody*/key; return input.key/*selectedValue*/; } });
selected();
selected({ key: '5' }); // expected: key
selected.run({ context: { key: '5' } }); // expected: key
const helperSettings = { toolContextSchema: z.object({ factor: z.number() }), context: { factor: 1 } };
const stringHelper = create.Function.asTool({ inputSchema: z.object({ value: z.string().transform(Number) }), execute: input => input.value }, { config: helperSettings });
const numberHelper = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: input => input.value }, { config: helperSettings });
const helperOwner = create.TextGenerator.withFunction({ model, tools: { operation: stringHelper }, toolsContext: { operation: { factor: 1 } },
  prompt: async ({ operation }) => {
    await operation({ /*rawHelper*/ }); // expected: value
    return String(await operation({ value: '4' }));
  } });
helperOwner.run({ tools: { operation: numberHelper } }); // expected: operation
create.TextGenerator.withFunction({ tools: { operation: numberHelper } }, helperOwner); // expected: operation
`;
async function check(sourceMode, exactOptionalPropertyTypes) {
  const directory = fs.mkdtempSync(path.join(base, '.phase2-editor-'));
  const root = path.join(directory, 'input.ts');
  const uri = pathToFileURL(root).href;
  fs.writeFileSync(root, source);
  fs.writeFileSync(path.join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', strict: true, skipLibCheck: true,
    noEmit: true, exactOptionalPropertyTypes, customConditions: sourceMode ? ['casai-source'] : [],
  }, files: ['input.ts'] }));
  const server = spawn(process.execPath, [path.join(base, 'node_modules/@typescript/native/bin/tsc'), '--lsp', '--stdio'],
    { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stderr = '';
  server.stderr.on('data', chunk => { stderr += chunk; });
  const stopped = new Promise((resolve, reject) => { server.once('close', resolve); server.once('error', reject); });
  const connection = createMessageConnection(new StreamMessageReader(server.stdout), new StreamMessageWriter(server.stdin));
  connection.listen();
  try {
    await connection.sendRequest('initialize', { processId: process.pid, rootUri: pathToFileURL(directory).href,
      capabilities: { textDocument: { diagnostic: {}, hover: { contentFormat: ['plaintext'] } } } });
    await connection.sendNotification('initialized', {});
    await connection.sendNotification('textDocument/didOpen', { textDocument: { uri, languageId: 'typescript', version: 1, text: source } });
    const position = offset => {
      const lines = source.slice(0, offset).split('\n');
      return { line: lines.length - 1, character: lines.at(-1).length };
    };
    const completions = async offset => {
      const result = await connection.sendRequest('textDocument/completion', { textDocument: { uri }, position: position(offset) });
      return new Set((Array.isArray(result) ? result : result?.items ?? []).map(item => item.label.replace(/\?$/, '')));
    };
    const hover = async offset => {
      const result = await connection.sendRequest('textDocument/hover', { textDocument: { uri }, position: position(offset) });
      const content = result?.contents;
      return typeof content === 'string' ? content : Array.isArray(content)
        ? content.map(item => typeof item === 'string' ? item : item.value).join('\n') : content?.value ?? '';
    };
    const at = marker => source.indexOf(`/*${marker}*/`);
    for (const marker of ['call', 'run', 'plain']) {
      const names = await completions(at(marker));
      for (const name of marker === 'plain' ? ['query'] : ['value', 'factor', 'map']) assert.ok(names.has(name), `${marker}: missing ${name}: ${[...names].join(',')}`);
      for (const name of ['db', '_toolOptions']) assert.ok(!names.has(name), `${marker}: private name ${name} offered`);
    }
    const names = await completions(at('implementation'));
    const optionalNames = await completions(at('optionalSchemaBody'));
    for (const name of ['value', 'count', '_toolOptions']) assert.ok(optionalNames.has(name), `optional schema: missing ${name}`);
    const configNames = await completions(at('configSchemaBody'));
    for (const name of ['value', 'count', '_toolOptions']) assert.ok(configNames.has(name), `Config: missing ${name}`);
    for (const marker of ['optionalSchemaValue', 'spreadSchemaValue', 'configSchemaValue', 'parentConfigSchemaValue']) assert.match(await hover(at(marker) - 1), /value: string \| number/);
    assert.match(await hover(at('optionalSchemaDefault') - 1), /count\??: number \| undefined/);
    assert.match(await hover(at('configSchemaDefault') - 1), /count\??: number \| undefined/);
    assert.match(await hover(at('definiteSchemaValue') - 1), /value: number/);
    assert.match(await hover(at('configDefiniteSchemaValue') - 1), /value: number/);
    const enumHover = await hover(at('mutableConfigEnum') - 1);
    assert.match(await hover(at('pairedPromptValue') - 1), /value: string \| number/);
    assert.match(await hover(at('transitionOutput') - 1), /object: number \| undefined/);
    assert.match(enumHover, /"YES"/);
    assert.match(enumHover, /"NO"/);
    const objectPromptNames = await completions(at('objectPromptMembers'));
    for (const name of ['value', 'count', '_toolOptions']) assert.ok(objectPromptNames.has(name), `ObjectGenerator prompt: missing ${name}`);
    assert.match(await hover(at('objectPromptValue') - 1), /value: string \| number/);
    assert.match(await hover(at('objectToolValue') - 1), /value: number/);
    assert.ok((await completions(at('objectResultMembers'))).has('answer'), 'ObjectGenerator completion callback lost its output schema');
    for (const marker of ['textPromptValue', 'textStreamPromptValue', 'objectStreamPromptValue']) assert.match(await hover(at(marker) - 1), /value: string \| number/);
    assert.match(await hover(at('templateDescriptorValue') - 1), /value: number/);
    assert.match(await hover(at('scriptDescriptorValue') - 1), /output: number/);
    const selectedNames = await completions(at('selectedBody'));
    assert.ok(selectedNames.has('key'), 'Selected schema lost the retained configured field');
    assert.match(await hover(at('selectedValue') - 1), /key: string \| number/);
    const preprocessedNames = await completions(at('preprocessedBody'));
    for (const name of ['label', 'db', '_toolOptions']) assert.ok(preprocessedNames.has(name), `preprocessed: missing ${name}`);
    assert.ok(!preprocessedNames.has('name'), 'Removed public defaults must not return in body completion');
    assert.match(await hover(at('preprocessedValue') - 1), /label: number/);
    for (const name of ['factor', 'value', 'db', '_toolOptions']) assert.ok(names.has(name), `implementation: missing ${name}`);
    const prototypeMembers = await completions(at('prototypeMember'));
    const producerMembers = await completions(at('producer'));
    for (const name of ['label', 'count', '_toolOptions']) assert.ok(producerMembers.has(name), `producer: missing ${name}`);
    assert.ok(prototypeMembers.has('toString'), 'Missing prototype-named helper completion: '+await hover(at('prototypeMember') - 2));
    const prototypeInputs = await completions(at('prototypeCall'));
    assert.ok(prototypeInputs.has('text'), 'Prototype-named helper lost application input completion');
    const fragmentMembers = await completions(at('fragmentMember'));
    assert.ok(fragmentMembers.has('toString'), 'Reusable fragment lost helper completion');
    const fragmentInputs = await completions(at('fragmentCall'));
    assert.ok(fragmentInputs.has('text'), 'Reusable fragment lost helper input completion');
    for (const marker of ['parameter', 'override']) {
      assert.match(await hover(at(marker) - 1), /value: number/);
    }
    const contextKeys = await completions(at('toolContext'));
    assert.ok(contextKeys.has('factor'), 'Tool-context override lost schema completion');
    const numericInputs = await completions(at('numericCall'));
    assert.ok(numericInputs.has('value'), 'Complete-argument validation lost declared input completion');
    const resultMembers = await completions(at('helperResult'));
    assert.ok(resultMembers.has('toUpperCase'), 'Template helper lost its completed string result');
    const replacementInputs = await completions(at('replacementCall'));
    assert.ok(replacementInputs.has('value'), 'Replacement body lost its final helper input completion');
    const rawHelperInputs = await completions(at('rawHelper'));
    assert.ok(rawHelperInputs.has('value'), `Helper contract lost raw application input completion: ${[...rawHelperInputs].join(',')}`);
    const conditionalInputs = await completions(at('conditionalCall'));
    assert.ok(conditionalInputs.has('value'), 'Conditional schema lost raw input completion');
    assert.match(await hover(at('conditionalValue') - 1), /value: string \| number/);
    assert.match(await hover(at('descriptionValue') - 1), /tenant: string/);
    assert.match(await hover(at('replacedHook') - 1), /value: number/);
    assert.match(await hover(at('mixedOutput') - 1), /output: string \| number/);
    const mixedMembers = await completions(at('mixedResult'));
    assert.ok(mixedMembers.has('toUpperCase'), 'Mixed-output helper lost its collected string branch');
    const alternativeMembers = await completions(at('alternativeResult'));
    assert.ok(alternativeMembers.has('toUpperCase'), 'Whole-configuration alternatives lost narrowed result completion');
    const lines = source.split('\n');
    const errors = new Map();
    const diagnostics = await connection.sendRequest('textDocument/diagnostic', { textDocument: { uri } });
    for (const diagnostic of diagnostics.items.filter(item => item.severity === 1)) {
      const index = diagnostic.range.start.line;
      const expected = lines[index].match(/expected: (\w+)/)?.[1];
      const message = diagnostic.message;
      assert.ok(expected || lines[index].includes('// error'), `Unexpected diagnostic: ${lines[index]}\n${message}`);
      if (expected) assert.ok(new RegExp(`\\b${expected}\\b`).test(message), `Diagnostic must name ${expected}: ${message}`);
      errors.set(index, message);
    }
    assert.equal(errors.size, lines.filter(line => line.includes('// expected:') || line.includes('// error')).length);

    console.log(`Editor passed: ${sourceMode ? 'source' : 'declarations'}, exact optional ${exactOptionalPropertyTypes}.`);
  } finally {
    // Closing the owned transport also terminates native background work.
    server.stdin.end();
    const exitCode = await stopped;
    connection.dispose();
    // TS7 7.0.2 reports transport closure as cancellation (exit 1).
    assert.ok(exitCode === 0 || exitCode === 1 && stderr.trim() === 'context canceled', stderr);
    assert.equal(path.dirname(directory), base);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
async function main() {
  for (const sourceMode of [true, false]) for (const exact of [false, true]) await check(sourceMode, exact);
  console.log('TS7 editor passed: source/declarations, both optional modes, calls/run/body completion, callbacks and named diagnostics.');
}
// An unresolved RPC promise must not let an otherwise idle process exit successfully.
process.exitCode = 1;
main().then(() => { process.exitCode = 0; }, error => { console.error(error); });
