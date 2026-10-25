// Compare the same caller workload with the pre-integration commit, then mutate a
// production type guard. No source or declaration in the working tree is changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const baselineRef = 'a1791a2ea9a4d9439e8bab57ced7ed76153d9e50';
const filter = new RegExp(process.argv[2] ?? '');
const temporary = fs.mkdtempSync(path.join(workspace, '.phase2-production-types-'));
function run(executable, args, cwd = workspace) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', timeout: 180000 });
  assert.equal(result.error, undefined);
  return result;
}
const common = ['--ignoreConfig', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'ESNext',
  '--moduleResolution', 'bundler', '--types', 'node,mocha', '--noEmit'];
try {
  const baseline = path.join(temporary, 'baseline');
  const production = path.join(temporary, 'production');
  const files = run('git', ['ls-tree', '-r', '--name-only', baselineRef, '--', 'src']).stdout.trim().split(/\r?\n/);
  for (const file of files) {
    const result = run('git', ['show', `${baselineRef}:${file}`]);
    assert.equal(result.status, 0, result.stderr);
    const destination = path.join(baseline, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, result.stdout);
  }
  fs.cpSync(path.join(workspace, 'src'), path.join(production, 'src'), { recursive: true });
  const workload = `import { z } from 'zod/v4';\nimport { Function as component } from './src/factories/Function.js';\n`
    + Array.from({ length: 24 }, (_, index) => `
const c${index} = component({ inputSchema: z.object({ v${index}: z.number(), factor: z.number() }),
  context: { factor: 3, db: 'private' }, execute: input => input.v${index} * input.factor });
c${index}({ v${index}: 2, factor: 4 });
`).join('');
  for (const directory of [baseline, production]) fs.writeFileSync(path.join(directory, 'workload.ts'), workload);
  {
    const compiler = 'node_modules/@typescript/native/bin/tsc';
    const results = {};
    for (const [name, directory] of [['baseline', baseline], ['production', production]]) {
      const result = run(process.execPath, [path.join(workspace, compiler), ...common, '--extendedDiagnostics', path.join(directory, 'workload.ts')]);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      results[name] = {
        instantiations: Number(result.stdout.match(/Instantiations:\s+(\d+)/)?.[1]),
        check: result.stdout.match(/Check time:\s+([^\r\n]+)/)?.[1],
        memory: result.stdout.match(/Memory used:\s+([^\r\n]+)/)?.[1],
      };
    }
    assert.ok(results.baseline.instantiations > 0 && results.production.instantiations > 0);
    assert.ok(results.production.instantiations <= 2 * results.baseline.instantiations, 'Production exceeded the 2x type-instantiation budget');
    console.log(`${compiler}: ${JSON.stringify(results)}`);
  }
  const check = `import { Function as component } from './src/factories/Function.js';
import { Template } from './src/factories/Template.js';
import { Script } from './src/factories/Script.js';
import { TextGenerator } from './src/factories/TextGenerator.js';
import { TextStreamer } from './src/factories/TextStreamer.js';
import { ObjectGenerator } from './src/factories/ObjectGenerator.js';
import { ObjectStreamer } from './src/factories/ObjectStreamer.js';
import { textStreamSchema } from './src/streams.js';
import type { LanguageModel } from 'ai';
import { z } from 'zod/v4';
const operation = component({ inputSchema: z.looseObject({ value: z.number() }), context: { user: 'trusted' }, execute: input => input.value });
operation({ value: 1, unrelated: true });
// @ts-expect-error Open public data cannot replace a private dependency.
operation({ value: 1, user: 'admin' });
const child = component.asTool({ inputSchema: z.object({}), toolContextSchema: z.object({ factor: z.number() }),
  context: { factor: 1 }, execute: input => input.factor });
const owner = component({ tools: { child }, toolsContext: { child: { factor: 2 } }, execute: input => input.child({}) });
owner.run({ toolsContext: { child: { factor: 3 } } });
// @ts-expect-error A required tool context cannot be cleared.
owner.run({ toolsContext: { child: undefined } });
const extras = { toolsContext: { child: { factor: 3 }, typo: {} } };
// @ts-expect-error Context entry names are checked through variables too.
owner.run(extras);
const label = Template.asTool({ template: 'ready', inputSchema: z.object({}) });
component({ tools: { label }, execute: async input => {
  const text: string = await input.label({});
  return text;
} });
const dependency = component.asTool({ inputSchema: z.object({}), context: { db: (): string => 'trusted' },
  execute: input => input.db() });
const dependencyOwner = component({ tools: { dependency }, execute: input => input.dependency({}) });
// @ts-expect-error Internal binding cannot invalidate an implementation dependency.
dependencyOwner.run({ toolsContext: { dependency: { db: 'wrong' } } });
const defaulted = component.asTool({ inputSchema: z.object({ value: z.number() }), execute: input => input.value });
const defaultOwner = component({ tools: { defaulted }, toolsContext: { defaulted: { value: 4 } },
  execute: input => input.defaulted({}) });
defaultOwner.run({ toolsContext: { defaulted: { value: 5 } } });
// @ts-expect-error A retained callback needs the original helper's omission guarantee.
defaultOwner.run({ toolsContext: { defaulted: {} } });
// @ts-expect-error Inheritance also preserves the guarantee.
component({ toolsContext: { defaulted: {} } }, defaultOwner);
// @ts-expect-error Reusing a callback cannot retain a stale helper overload.
component({ ...defaultOwner.config, toolsContext: { defaulted: {} } });
declare const enabled: boolean;
const outputSchema = enabled ? z.string().transform(value => value.length) : undefined;
const conditionalOutput = component({ schema: outputSchema, execute: () => 'hello' });
// @ts-expect-error A present output schema may replace the string with a number.
const onlyString: Promise<string> = conditionalOutput();
declare const partialDefaults: { a: number } | { b: number };
const conditionalInput = Script({ context: partialDefaults, inputSchema: z.object({ a: z.number(), b: z.number() }), script: 'return a + b' });
conditionalInput({ a: 2, b: 3 });
// @ts-expect-error Neither configured alternative supplies complete input.
conditionalInput();
const maybeSchema = enabled ? z.object({ value: z.string().transform(Number) }) : undefined;
const maybeInput = component({ inputSchema: maybeSchema, execute: input => {
  const value: string | number = input.value;
  // @ts-expect-error Raw strings are possible if the input schema is absent.
  const onlyNumber: number = input.value;
  return value;
} });
maybeInput({ value: '5' });
const privateConditional = component({ inputSchema: maybeSchema, context: { value: '5' }, execute: input => input.value });
privateConditional();
// @ts-expect-error An absent input schema makes configured fields private.
privateConditional({ value: '7' });
const described = component.asTool({ inputSchema: z.object({}), toolContextSchema: z.object({ tenant: z.string() }),
  description: ({ context }) => context.tenant.toUpperCase(), execute: () => 'ok' });
// @ts-expect-error Retained description cannot consume numeric tenant context.
component.asTool({ toolContextSchema: z.object({ tenant: z.number() }) }, described);
const mixed = component.asTool({ inputSchema: z.object({}), schema: enabled ? textStreamSchema() : z.number(),
  execute: () => enabled ? (async function* () { yield 'ab'; })() : 7 });
component({ tools: { mixed }, execute: async ({ mixed }) => {
  const value: string | number = await mixed({});
  return value;
} });
declare const privateUnion: { value: number } | { value: number; user: string };
declare const publicUnion: { value: number } | { value: number; extra: string };
const render = Template({ inputSchema: z.looseObject({ value: z.number() }), context: { user: 'trusted' }, template: '{{ value }}' });
// @ts-expect-error Renderer calls reject private names found in any union branch.
render(privateUnion);
render(publicUnion);
declare const model: LanguageModel;
const opaque = z.union([z.object({ value: z.number() }), z.union([z.object({ value: z.number() }), z.object({ value: z.number() })])]);
const partitioned = { model, inputSchema: opaque, context: { user: 'private' }, prompt: '{{ value }}' };
// @ts-expect-error Text generators apply shared schema admission.
TextGenerator.withTemplate(partitioned);
// @ts-expect-error Text streamers apply shared schema admission.
TextStreamer.withTemplate(partitioned);
// @ts-expect-error Object generators apply shared schema admission.
ObjectGenerator.withTemplate({ ...partitioned, schema: z.object({ answer: z.string() }) });
// @ts-expect-error Object streamers apply shared schema admission.
ObjectStreamer.withTemplate({ ...partitioned, schema: z.object({ answer: z.string() }) });
const transformed = z.string().transform(text => text.length);
declare const alternativeConfig: { schema: typeof transformed; execute: () => string } | { execute: () => string };
const alternative = component(alternativeConfig);
// @ts-expect-error A whole configuration alternative also contributes its parsed output.
const alternativeString: Promise<string> = alternative();
const inheritedAlternative = component({}, { config: alternativeConfig });
// @ts-expect-error Parent normalization must retain the schema-bearing alternative.
const inheritedString: Promise<string> = inheritedAlternative();
declare const privateParent: { context: { user: string } } | Record<never, never>;
component({ inputSchema: z.object({ value: z.number() }), execute: input => {
  const user: string | undefined = input.user;
  return user;
} }, { config: privateParent });
const privateAlternative = Template({ inputSchema: z.looseObject({ value: z.number() }), template: '{{ value }}' }, { config: privateParent });
privateAlternative({ value: 2, extra: true });
// @ts-expect-error A private binding cannot disappear from its parent's union type.
privateAlternative({ value: 2, user: 'replacement' });
const mixedInput = component({ inputSchema: z.union([
  z.strictObject({ kind: z.literal('closed'), value: z.number() }),
  z.looseObject({ kind: z.literal('open'), value: z.number() }),
]), execute: ({ value }) => value });
mixedInput({ kind: 'open', value: 2, extra: true });
// @ts-expect-error An open alternative cannot relax a closed discriminated branch.
mixedInput({ kind: 'closed', value: 2, extra: true });
`;
  // The full public-factory matrix lives in configuration-alternative-guards.ts.
  // Mutate these shared owners directly to avoid repeating unrelated factory inference.
  const alternatives = `import type { ValidateToolsContext, ValidateFinalConfig, ValidateConfigFragment, ValidateRunConfig } from './src/types/config-validation.js';
import type { ValidateDescriptor, ValidateCallbacks, ValidateToolSelectionNames, ValidateToolCallbackNames } from './src/types/callbacks.js';
import type { ComponentAdmission } from './src/types/application.js';
import type { EmptyMap, MergedConfig } from './src/types/merge.js';
import type { LanguageModel, Tool } from 'ai';
import type { ExecutableTool } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
declare const secured: ExecutableTool<Tool<Record<never, never>, string, { tenant: string }>>;
declare const simple: ExecutableTool<Tool<Record<never, never>, string>>;
declare const numericContext: ExecutableTool<Tool<Record<never, never>, number, { tenant: number }>>;
declare const pairedContexts: { tools: { lookup: typeof secured }; toolsContext: { lookup: { tenant: string } } }
  | { tools: { lookup: typeof numericContext }; toolsContext: { lookup: { tenant: number } } };
declare const nestedRegistry: { secured: typeof secured } | { simple: typeof simple };
const stringInput = z.object({ value: z.string() });
const numberInput = z.object({ value: z.number() });
declare const hookConfig: { inputSchema: typeof stringInput; onInputAvailable: (event: { input: { value: string } }) => void } | { inputSchema: typeof stringInput };
declare const lifecycleConfig: { model: LanguageModel; schema: typeof stringInput; onFinish: (event: { object: { value: string } | undefined }) => void }
  | { model: LanguageModel; schema: typeof stringInput };
declare const forbiddenConfig: { execute: () => number; contextSchema: undefined } | { execute: () => number };
declare const forbiddenRun: { temperature: number; contextSchema: undefined } | { temperature: number };
type HookReplacement = { inputSchema: typeof numberInput; execute: () => string };
type FinalHook = MergedConfig<typeof hookConfig, HookReplacement>;
type ResultReplacement = { schema: typeof numberInput };
const emptyInput = z.object({});
const nullContext = z.null();
type SimpleRegistry = { tools: { simple: typeof simple } };
declare const selectedChoice: (SimpleRegistry & { toolChoice: { type: 'tool'; toolName: 'missing' } }) | SimpleRegistry;
declare const selectedCallbacks: (SimpleRegistry & { toolApproval: { simple: 'approved'; missing: 'denied' } }) | SimpleRegistry;
declare const selectedRunTools: SimpleRegistry | { tools: { simple: typeof simple; missing: typeof simple } };
`;
  const compiler = path.join(workspace, 'node_modules/@typescript/native/bin/tsc');
  const alternativeMutations = [
    ['branch-only tool selections', 'ToolSelectionErrors<T, PartialConfig extends boolean> = T extends unknown',
      'ToolSelectionErrors<T, PartialConfig extends boolean> = unknown extends unknown', /Unused '@ts-expect-error'/,
      'src/types/callbacks.ts', 'const admitted: ValidateToolSelectionNames<typeof selectedChoice> = {};'],
    ['branch-only callback-map names', 'UnknownToolCallbackNames<T, PartialConfig extends boolean> = T extends unknown',
      'UnknownToolCallbackNames<T, PartialConfig extends boolean> = unknown extends unknown', /Unused '@ts-expect-error'/,
      'src/types/callbacks.ts', 'const admitted: ValidateToolCallbackNames<typeof selectedCallbacks> = {};'],
    ['branch-only run tool names', 'Exclude<UnionKeys<ToolsFromConfig<TRunConfig>>, keyof ToolsFromConfig<TConfig>>',
      'Exclude<keyof ToolsFromConfig<TRunConfig>, keyof ToolsFromConfig<TConfig>>', /Unused '@ts-expect-error'/,
      'src/types/config-validation.ts', 'const admitted: ValidateRunConfig<typeof selectedRunTools, SimpleRegistry, { tools?: SimpleRegistry["tools"] }> = selectedRunTools;'],
    ['whole registry alternatives', 'InvalidToolContexts<T, PartialConfig extends boolean = false> = T extends unknown',
      'InvalidToolContexts<T, PartialConfig extends boolean = false> = unknown extends unknown', /not assignable/, 'src/types/application.ts',
      'const admitted: ValidateToolsContext<typeof pairedContexts> = pairedContexts;', false],
    ['nested registry alternatives', 'H extends unknown ? M extends unknown ? {', 'unknown extends unknown ? M extends unknown ? {',
      /Unused '@ts-expect-error'/, 'src/types/application.ts', 'const admitted: ValidateToolsContext<{ tools: typeof nestedRegistry }> = { tools: nestedRegistry };'],
    ['branch-only descriptor hooks', 'DescriptorErrors<Final, R> = Final extends unknown', 'DescriptorErrors<Final, R> = unknown extends unknown',
      /Unused '@ts-expect-error'/, 'src/types/callbacks.ts', 'const admitted: ValidateDescriptor<HookReplacement, FinalHook, string> = {};'],
    ['branch-only Function contracts', 'FunctionConfigErrors<Final, AsTool extends boolean> = Final extends unknown',
      'FunctionConfigErrors<Final, AsTool extends boolean> = unknown extends unknown', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts',
      'const admitted: ValidateFinalConfig<HookReplacement, typeof hookConfig, FinalHook, true> = {};'],
    ['branch-only lifecycle callbacks', "Streaming extends boolean> = Final extends unknown", "Streaming extends boolean> = unknown extends unknown",
      /Unused '@ts-expect-error'/, 'src/types/callbacks.ts', "const admitted: ValidateCallbacks<ResultReplacement, MergedConfig<typeof lifecycleConfig, ResultReplacement>, 'object'> = {};"],
    ['branch-only forbidden keys', 'UnionKeys<T> = T extends unknown ? keyof T : never', 'UnionKeys<T> = keyof T',
      /Unused '@ts-expect-error'/, 'src/types/utils.ts', 'const admitted: ValidateFinalConfig<typeof forbiddenConfig, EmptyMap, typeof forbiddenConfig> = {};'],
    ['every fragment alternative', '[InvalidUnionMembers<TFinalConfig, CallbackConfigShape<TShape>>] extends [never]',
      'unknown extends unknown', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts', 'const admitted: ValidateConfigFragment<typeof forbiddenConfig, typeof forbiddenConfig, { execute: () => number }> = forbiddenConfig;'],
    ['branch-only run settings', 'Exclude<UnionKeys<TRunConfig>, keyof TShape> extends never', 'Exclude<keyof TRunConfig, keyof TShape> extends never',
      /Unused '@ts-expect-error'/, 'src/types/config-validation.ts', 'const admitted: ValidateRunConfig<typeof forbiddenRun, { model: LanguageModel; prompt: string }, { temperature?: number }> = forbiddenRun;'],
    ['null context admission', 'Exclude<Parsed<S>, undefined>', 'NonNullable<Parsed<S>>', /Unused '@ts-expect-error'/, 'src/types/application.ts',
      'const admitted: ComponentAdmission<{ inputSchema: typeof emptyInput; toolContextSchema: typeof nullContext; execute: () => number }> = {};'],
  ];
  const mutations = [
    ['whole configuration settings', 'T extends unknown ? K extends keyof T', 'unknown extends unknown ? K extends keyof T',
      /Unused '@ts-expect-error'/, 'src/types/config.ts'],
    ['inherited configuration alternatives', 'DeclaredConfig<T> = T extends unknown ?', 'DeclaredConfig<T> = unknown extends unknown ?',
      /Unused '@ts-expect-error'/, 'src/types/function-config.ts'],
    ['conditional configured callback fields', "C = T extends unknown ? 'context' extends keyof T", "C = unknown extends unknown ? 'context' extends keyof T",
      /does not exist/],
    ['mixed closed input branches', 'I extends unknown ? string extends keyof I ? false : true : never', 'string extends Keys<I> ? false : true',
      /Unused '@ts-expect-error'/],
    ['mixed collected output', "S = Setting<T, 'schema'>> = S extends StreamSchema", "S = Setting<T, 'schema'>> = Setting<T, 'schema'> extends StreamSchema",
      /not assignable/],
    ['branch-only renderer private keys', 'RejectedKeys<ApplicationInput<T, S>, SuppliedNames<A, K>,', 'RejectedKeys<ApplicationInput<T, S>, keyof A,',
      /Unused '@ts-expect-error'/],
    ['LLM application admission', ": import('./application.js').ComponentAdmission<TFinalConfig>>;", ': unknown>;',
      /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['private-key rejection', "KeyErrors<Extract<K, Private>, 'Private input key'>", 'unknown', /Unused '@ts-expect-error'/],
    ['run context validation', '& ValidateToolsContext<TRunConfig, MergedConfig<TConfig, TRunConfig>>',
      '', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['completed helper output', 'ComponentHelper<BoundHelperConfig<Config, C>, R>', 'ComponentHelper<BoundHelperConfig<Config, C>, CollectedResult<Config>>',
      /Type 'unknown' is not assignable to type 'string'/],
    ['internal binding compatibility', 'BindingCheck<Config, C> : unknown', 'unknown : unknown',
      /Unused '@ts-expect-error'/],
    ['run helper input and defaults', 'Pick<After, Extract<K, keyof After>> extends Pick<Before, K> ? never : K', 'never',
      /Unused '@ts-expect-error'/],
    ['stale callback helpers', "OmitEach<ExecuteInput<T>, '_toolOptions' | PossibleFallbackNames<Registry<T>>>", 'ExecuteInput<T>',
      /Unused '@ts-expect-error'/],
    ['conditional output schema', "S = Setting<T, 'schema'>> = S extends Schema", "S = Setting<T, 'schema'>> = Setting<T, 'schema'> extends Schema",
      /Unused '@ts-expect-error'/],
    ['complete omitted input', 'CanInvoke<ApplicationInput<Config, S>, Configured<Config>, EmptyMap, PublicNames<S>, IsClosed<S>>',
      'EmptyMap extends ApplicationShape<Config> ? true : false', /Unused '@ts-expect-error'/],
    ['conditional private ownership', 'PrivateNames<undefined extends S ? undefined : S,',
      'PrivateNames<S,', /Unused '@ts-expect-error'/],
    ['conditional input inference', 'FunctionSignature<true, true> & FunctionSignature<true, false>',
      'FunctionSignature<false, true> & FunctionSignature<false, false>', /error TS/, 'src/factories/Function.ts'],
    ['description context type', "description?: Tool<any, any, C>['description']", "description?: Tool<any, any, any>['description']",
      /Unused '@ts-expect-error'/, 'src/types/config.ts'],
  ];
  const schemaVersions = `import { Function as component } from './src/factories/Function.js';
import { streamSchema } from './src/streams.js';
import { z } from 'zod/v4';
import * as mini from 'zod/mini';
import { z as legacy } from 'zod/v3';
component({ inputSchema: z.object({ value: z.number() }), execute: input => input.value });
component({ inputSchema: mini.object({ value: mini.number() }), execute: input => input.value });
// @ts-expect-error Direct Casai schemas require Zod 4.
component({ inputSchema: legacy.object({ value: legacy.number() }), execute: () => 1 });
// @ts-expect-error Stream element schemas have the same version contract.
streamSchema(legacy.number());
`;
  const schemaMutations = [
    ['Zod 3 type rejection', 'FlexibleSchema<T> & { readonly _def?: object & { readonly typeName?: never } }',
      'FlexibleSchema<T>', /Unused '@ts-expect-error'/, 'src/types/types.ts'],
  ];
  const preprocessors = `import { Function as component } from './src/factories/Function.js';
import { z } from 'zod/v4';
const inputSchema = z.preprocess(value => value, z.object({ name: z.string().transform(value => value.length) }));
const operation = component({ inputSchema, context: { name: 'Ada', db: true }, execute: input => {
  const parsed: number = input.name;
  return parsed;
} });
operation({ name: 'Grace' });
// @ts-expect-error Identifiable private fields remain protected.
operation({ db: false });
`;
  const preprocessorMutations = [
    ['preprocessor declaration capability', 'Capability<I extends z.core.$ZodTransform ? O : I,', 'Capability<I,', /error TS/],
    ['preprocessor public names', 'PublicNames<I extends z.core.$ZodTransform ? O : I,', 'PublicNames<I,', /error TS/],
  ];
  const projection = `import { Function as component } from './src/factories/Function.js';
import { z } from 'zod/v4';
const inputSchema = z.union([z.object({ x: z.number() }), z.object({ y: z.string() })]);
component({ inputSchema, context: { x: 1 }, execute: input => input })();
// @ts-expect-error Union public defaults cannot be projected at construction.
component.asTool({ inputSchema, context: { x: 1 }, execute: input => input });
const operation = component.asTool({ inputSchema, context: { db: true }, execute: input => input });
operation.bindToolContext({ db: false });
// @ts-expect-error Binding cannot add unprojectable defaults.
operation.bindToolContext({ x: 2 });
// @ts-expect-error Registry binding uses the same projection contract.
component({ tools: { operation }, toolsContext: { operation: { x: 2 } }, execute: () => 1 });
const copied = { ...operation };
// @ts-expect-error A copied descriptor has lost component initialization.
component({ tools: { copied }, execute: () => 1 });
`;
  const projectionMutations = [
    ['tool factory projection admission', 'AsTool extends true ? import(\'./application.js\').ToolInputAdmission<TFinal> : unknown',
      'unknown', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['bound tool projection admission', "& ToolInputAdmission<T, Defaults<Configured<T>, Setting<T, 'toolContextSchema'>, C>>",
      '& unknown', /Unused '@ts-expect-error'/],
    ['spread tool admission', "T extends (...args: any[]) => any ? never : 'copied component'",
      'never', /Unused '@ts-expect-error'/],
  ];
  const selectedSchemas = `import { Function as component } from './src/factories/Function.js';
import { Template } from './src/factories/Template.js';
import { z } from 'zod/v4';
declare const enabled: boolean;
const broad = z.object({ value: z.union([z.string(), z.number()]) });
const narrow = z.object({ value: z.string() });
const operation = component({ inputSchema: enabled ? broad : narrow, execute: input => input.value });
operation({ value: 'shared' });
// @ts-expect-error The selected parser may require a string.
operation({ value: 1 });
const publicKey = z.looseObject({ key: z.string().transform(Number) });
const privateKey = z.looseObject({ query: z.string().optional() });
const settings = { inputSchema: enabled ? publicKey : privateKey, context: { key: '4' } };
const retained = component({ ...settings, execute: input => { const key: string | number = input.key; return key; } });
retained();
// @ts-expect-error The selected parser may keep key private.
retained({ key: '5' });
const renderer = Template({ ...settings, template: '{{ key }}' });
renderer();
// @ts-expect-error Renderer checks also keep selected schemas separate.
renderer({ key: '5' });
const child = component.asTool({ ...settings, inputSchema: enabled ? publicKey.strip() : privateKey.strip(), execute: input => { const key: string | number = input.key; return key; } });
child.bindToolContext({});
declare const paired: { inputSchema: typeof narrow; context: { value: string } }
  | { inputSchema: z.ZodObject<{ value: z.ZodNumber }>; context: { value: number } };
component({ execute: () => 1 }, { config: paired })();
declare const pairedOwnership: { inputSchema: typeof publicKey; context: { key: string } }
  | { inputSchema: typeof privateKey; context: { key: number } };
component({ execute: input => { const key: number = input.key; return key; } }, { config: pairedOwnership });
const empty = z.object({});
declare const pairedPrivate: { inputSchema: typeof empty; context: { tenant: string }; execute: (input: { tenant: string }) => string }
  | { inputSchema: typeof empty; context: { tenant: number }; execute: (input: { tenant: number }) => number };
const conditionalTool = component.asTool({}, { config: pairedPrivate });
conditionalTool.bindToolContext({});
// @ts-expect-error Binding must be compatible with each selected implementation.
conditionalTool.bindToolContext({ tenant: 2 });
const unionParser = z.union([z.object({ x: z.number().optional() }), z.object({ y: z.string().optional() })]);
const defaultParser = z.object({ factor: z.number() });
component.asTool({ inputSchema: enabled ? unionParser : defaultParser, context: { factor: 3 }, execute: input => input.factor }).bindToolContext({});
// @ts-expect-error Every selected parser must accept object application input.
component({ inputSchema: enabled ? z.string().transform(value => ({ value })) : narrow, execute: () => 1 });
`;
  const selectedMutations = [
    ['selected schema contracts', ': S extends unknown ? { config: T; schema:', ': [S] extends [unknown] ? { config: T; schema:', /Unused '@ts-expect-error'|not assignable/],
    ['selected callback assembly', 'ExecutionContext<T, B = ApplicationAlternatives<T>>', 'ExecutionContext<T, B = { config: T; schema: SchemaOf<T> }>', /not assignable|does not exist/],
    ['correlated application configurations', 'ApplicationAlternatives<T> = T extends unknown ?', 'ApplicationAlternatives<T> = unknown extends unknown ?', /Expected 1 argument|not assignable/],
    ['correlated inherited callback inference', 'TParentDefinition extends unknown ? MergedConfig<Omit<TParentDefinition,',
      'unknown extends unknown ? MergedConfig<Omit<TParentDefinition,', /not assignable/, 'src/types/function-config.ts'],
    ['correlated private binding', 'BindingChecks<T, C> = T extends unknown ?', 'BindingChecks<T, C> = unknown extends unknown ?', /Unused '@ts-expect-error'/],
    ['selected tool projection', 'InvalidToolProjection<T, D, B = ApplicationAlternatives<T>>', 'InvalidToolProjection<T, D, B = { config: T; schema: SchemaOf<T> }>', /No overload matches|not assignable/],
    ['selected schema admission', 'AdmissionChecks<T, B = ApplicationAlternatives<T>>', 'AdmissionChecks<T, B = { config: T; schema: SchemaOf<T> }>', /Unused '@ts-expect-error'/],
  ];
  const helperContracts = `import { Function as component } from './src/factories/Function.js';
import { TextGenerator } from './src/factories/TextGenerator.js';
import { tool } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod/v4';
declare const model: LanguageModel;
const common = { toolContextSchema: z.object({ factor: z.number() }), context: { factor: 1 } };
const strings = component.asTool({ inputSchema: z.object({ value: z.string().transform(Number) }), execute: input => input.value }, { config: common });
const numbers = component.asTool({ inputSchema: z.object({ value: z.number() }), execute: input => input.value }, { config: common });
const raw = TextGenerator.withFunction({ model, tools: { operation: strings }, toolsContext: { operation: { factor: 1 } }, prompt: async ({ operation }) => String(await operation({ value: '4' })) });
// @ts-expect-error Parsed output agreement does not preserve raw input.
raw.run({ tools: { operation: numbers } });
const open = tool({ contextSchema: common.toolContextSchema, inputSchema: z.looseObject({ value: z.number() }), execute: input => input.value });
const owner = TextGenerator.withFunction({ model, tools: { operation: open }, toolsContext: { operation: { factor: 1 } }, prompt: async ({ operation }) => String(await operation({ value: 4, extra: 'text' })) });
const restricted = tool({ contextSchema: common.toolContextSchema, inputSchema: z.looseObject({ value: z.number(), extra: z.number().optional() }), execute: input => input.value });
// @ts-expect-error Optional declarations can restrict former open arguments.
owner.run({ tools: { operation: restricted } });
const mixed = tool({ contextSchema: common.toolContextSchema, inputSchema: z.union([z.looseObject({ kind: z.literal('a') }), z.strictObject({ kind: z.literal('b') })]), execute: () => 1 });
const moved = tool({ contextSchema: common.toolContextSchema, inputSchema: z.union([z.strictObject({ kind: z.literal('a') }), z.looseObject({ kind: z.literal('b') })]), execute: () => 1 });
const mixedOwner = TextGenerator.withFunction({ model, tools: { mixed }, toolsContext: { mixed: { factor: 1 } }, prompt: async ({ mixed }) => String(await mixed({ kind: 'a', extra: true })) });
// @ts-expect-error The same branches must retain their openness.
mixedOwner.run({ tools: { mixed: moved } });
// Open-root Casai tools are no longer admitted; native open-helper substitution remains above.
// @ts-expect-error Tool schemas must declare their root input names.
component.asTool({ inputSchema: z.looseObject({ value: z.number() }), execute: input => input.value });
// @ts-expect-error Root dictionaries are catchall contracts too.
component.asTool({ inputSchema: z.record(z.string(), z.number()), execute: () => 1 });
const fields = component.asTool({ inputSchema: z.object({ a: z.number(), b: z.string() }), execute: input => input.a });
const defaultOwner = component({ tools: { fields }, toolsContext: { fields: { a: 1 } }, execute: ({ fields }) => fields({ b: 'ready' }) });
declare const either: { a: number } | { b: string };
// @ts-expect-error A guaranteed omitted field cannot become conditional.
defaultOwner.run({ toolsContext: { fields: either } });
const configured = component.asTool({ inputSchema: z.object({ value: z.union([z.literal(1), z.literal(2)]), factor: z.number() }), context: { factor: 2 }, execute: input => input.value * input.factor });
const configuredOwner = component({ tools: { operation: configured }, execute: ({ operation }) => operation({ value: 2 }) });
const schemaDefault = component.asTool({ inputSchema: z.object({ value: z.union([z.literal(1), z.literal(2)]), factor: z.number().default(2) }), execute: input => input.value * input.factor });
component({ tools: { operation: schemaDefault } }, configuredOwner);
const invalidDefault = component.asTool({ inputSchema: z.object({ value: z.union([z.literal(1), z.literal(2)]), factor: z.number().default(2) }), context: { factor: 'invalid' }, execute: input => input.value * input.factor });
// @ts-expect-error A schema default does not repair an invalid configured value.
component({ tools: { operation: invalidDefault } }, configuredOwner);
const unionDefaults = component.asTool({ inputSchema: z.union([z.object({ value: z.literal(1), factor: z.number().default(2) }), z.object({ value: z.literal(2), factor: z.number().default(2) })]), execute: input => input.value * input.factor });
component({ tools: { operation: unionDefaults } }, configuredOwner);
const partialDefaults = component.asTool({ inputSchema: z.union([z.object({ value: z.literal(1), factor: z.number().default(2) }), z.object({ value: z.literal(2), factor: z.number() })]), execute: input => input.value * input.factor });
// @ts-expect-error A field required in one union alternative cannot always be omitted.
component({ tools: { operation: partialDefaults } }, configuredOwner);
`;
  const helperMutations = [
    ['helper raw input', 'type RawContract<I> = I extends unknown ? I &', 'type RawContract<I> = I extends unknown ? unknown &', /Unused '@ts-expect-error'/],
    ['helper branch keys', 'keys: keyof I;', 'keys: PropertyKey;', /Unused '@ts-expect-error'/],
    ['helper constrained extras', 'declared: string extends keyof I ? (key: RestrictedNames<I>) => void : any;', 'declared: any;', /Unused '@ts-expect-error'/],
    ['helper default guarantees', 'defaults: (key: Guaranteed<I, D> | OptionalDefaults<I, D>) => void;', 'defaults: (key: never) => void;', /Unused '@ts-expect-error'/],
    ['closed tool admission', 'true extends OpenToolInput<SchemaOf<T>>', 'false extends true', /Unused '@ts-expect-error'/],
    ['root record admission', ': S extends z.core.$ZodRecord ? true', ': S extends z.core.$ZodRecord ? false', /Unused '@ts-expect-error'/],
    ['helper schema defaults', ' | OptionalDefaults<I, D>', '', /incompatible/],
    ['helper optional default values', '[SelectedDefaults<D, P>] extends [Pick<I, P>] ? P : never', 'P', /Unused '@ts-expect-error'/],
    ['helper union omissions', 'K extends keyof I = Exclude<NamedKeys<I> & keyof I, I extends unknown ? RequiredNames<I> : never>', 'K extends keyof I = NamedKeys<I> & keyof I', /Unused '@ts-expect-error'/],
  ];
  const runContexts = `import { TextGenerator } from './src/factories/TextGenerator.js';
import type { LanguageModel } from 'ai';
import { z } from 'zod/v4';
declare const model: LanguageModel;
const component = TextGenerator.withTemplate({ model, prompt: '{{ value }}',
  inputSchema: z.looseObject({ value: z.number() }), context: { value: 1, user: 'private' } });
declare const invalid: { maxOutputTokens: number } | { context: { value: number; user: string } };
declare const valid: { maxOutputTokens: number } | { context: { value: number; extra: string } };
component.run(valid);
// @ts-expect-error The context-bearing branch cannot replace a private binding.
component.run(invalid);
`;
  const runContextMutations = [
    ['branch-only run context', '& ValidateRunContext<TRunConfig, TConfig>', '& unknown', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
  ];
  const runDescriptorContexts = `import { Function as component } from './src/factories/Function.js';
import { TextGenerator } from './src/factories/TextGenerator.js';
import { tool, type LanguageModel } from 'ai';
import { z } from 'zod/v4';
declare const model: LanguageModel;
const inputSchema = z.object({ value: z.number() });
const toolContextSchema = z.object({ factor: z.string().transform(Number) });
const original = component.asTool({ inputSchema, toolContextSchema, context: { factor: 1 }, execute: input => input.value * input.factor });
const replacement = component.asTool({ inputSchema, toolContextSchema: z.object({ factor: z.union([z.string(), z.number()]).transform(Number) }), context: { factor: 1 }, execute: input => input.value * input.factor + 1 });
const owner = TextGenerator.withFunction({ model, tools: { operation: original }, toolsContext: { operation: { factor: '3' } }, prompt: async ({ operation }) => String(await operation({ value: 2 })) });
owner.run({ tools: { operation: replacement } });
const modelOnly = TextGenerator({ model, prompt: 'ready', tools: { operation: original }, toolsContext: { operation: { factor: '3' } } });
modelOnly.run({ tools: { operation: replacement } });
// @ts-expect-error Incoming binding data retains the raw context schema type.
owner.run({ toolsContext: { operation: { factor: 3 } } });
const stringContext = tool({ inputSchema, contextSchema: z.object({ factor: z.string() }), execute: ({ value }, { context }) => value * context.factor.length });
// @ts-expect-error A replacement must preserve parsed SDK context, not just raw settings.
owner.run({ tools: { operation: stringContext } });
// @ts-expect-error Model-only registries retain the same SDK context contract.
modelOnly.run({ tools: { operation: stringContext } });
const configured = component.asTool({ inputSchema: inputSchema.extend({ factor: z.number() }), context: { factor: 2 }, execute: input => input.value * input.factor });
const defaulted = component.asTool({ inputSchema: inputSchema.extend({ factor: z.number().default(2) }), execute: input => input.value * input.factor });
const defaultOwner = TextGenerator.withFunction({ model, tools: { operation: configured }, prompt: async ({ operation }) => String(await operation({ value: 2 })) });
defaultOwner.run({ tools: { operation: defaulted } });
`;
  const runDescriptorMutations = [
    ['run descriptor context', 'InferToolContext<TOOLS[K]>', "K extends keyof NonNullable<ToolsContextConfig<TOOLS>['toolsContext']> ? NonNullable<ToolsContextConfig<TOOLS>['toolsContext']>[K] : undefined", /needsApproval/, 'src/types/config.ts'],
  ];
  const callerAlternatives = `import { Function as component } from './src/factories/Function.js';
import { Template } from './src/factories/Template.js';
import { z } from 'zod/v4';
const inputSchema = z.object({ value: z.number() }).catchall(z.number());
const operation = component({ inputSchema, context: { value: 1 }, execute: ({ value }) => value });
const render = Template({ inputSchema, context: { value: 1 }, template: '{{ value }}' });
declare const valid: { extra: number } | { other: number };
declare const invalid: { value: number } | { value: number; extra: string };
operation(valid);
operation.run({ context: valid });
render(valid);
// @ts-expect-error Every possible application input must satisfy the catchall.
operation(invalid);
// @ts-expect-error Optional rendered calls retain the same check.
render(invalid);
const required = component({ inputSchema: z.looseObject({ value: z.number() }), execute: ({ value }) => value });
declare const selected: typeof required | typeof operation;
// @ts-expect-error Combining call signatures cannot hide an invalid alternative.
selected(invalid);
// @ts-expect-error One selected component requires input.
selected();
const callbacks = Template({ inputSchema: z.object({ factor: z.string(), map: z.custom<(value: number) => number>() }), context: { factor: '3' }, template: 'ready' });
callbacks({ map: value => value });
const child = component({ context: { userId: 'member' }, execute: (input: { query: string; userId: string }) => input.userId });
component.asTool({ inputSchema: z.object({ query: z.string() }), execute: input => child(input) });
declare const indexed: { query: string; userId: string; [key: string]: unknown };
// @ts-expect-error The index signature cannot hide a named private field.
child(indexed);
`;
  const callerMutations = [
    ['complete caller alternatives', '& EffectiveErrors<ApplicationInput<T, S>, Configured<T>, Supplied<A, K>, PublicNames<S>, IsClosed<S>>', '', /Unused '@ts-expect-error'/],
    ['component union constraints', 'First extends TAllowed[0]', 'First = unknown', /Unused '@ts-expect-error'/, 'src/types/input.ts'],
    ['provided argument keys', 'first: First & (Partial<Record<K, unknown>> | undefined)', 'first: First', /Parameter 'value' implicitly has an 'any' type/, 'src/types/input.ts'],
    ['mapped argument fallback', '[K] extends [never] ? A : string extends K ? A', 'string extends K ? A', /query/],
    ['indexed private names', 'RejectedKeys<ApplicationInput<T, S>, SuppliedNames<A, K>,', 'RejectedKeys<ApplicationInput<T, S>, K,', /Unused '@ts-expect-error'/],
  ];
  const configuredOmissions = `import { Template } from './src/factories/Template.js';
import { TextGenerator } from './src/factories/TextGenerator.js';
import { z } from 'zod/v4';
import type { LanguageModel } from 'ai';
declare const choose: boolean;
declare const model: LanguageModel;
const inputSchema = z.object({ value: z.number() });
const config = choose ? { inputSchema, context: { value: 1 } } : { inputSchema };
const renderer = Template({ template: '{{ value }}' }, { config });
const text = TextGenerator.withTemplate({ model, prompt: '{{ value }}' }, { config });
renderer({ value: 2 });
text({ value: 2 });
// @ts-expect-error Every possible configuration must satisfy omitted input.
renderer();
// @ts-expect-error Model preparation has the same completeness requirement.
text();
const complete = choose ? { inputSchema, context: { value: 1 } } : { inputSchema, context: { value: 2, db: 'private' } };
Template({ template: '{{ value }}' }, { config: complete })();
TextGenerator.withTemplate({ model, prompt: '{{ value }}' }, { config: complete })();
`;
  const omissionMutations = [
    ['conditional renderer omission', '[TConfig] extends [Record<Key, string>]', 'TConfig extends Record<Key, string>', /Unused '@ts-expect-error'/, 'src/types/input.ts'],
    ['conditional model omission', '[TConfig] extends [{ prompt: PROMPT }]', 'TConfig extends { prompt: PROMPT }', /Unused '@ts-expect-error'/, 'src/llm-component.ts'],
  ];
  const contextAlternatives = `import { Function as component } from './src/factories/Function.js';
import { z } from 'zod/v4';
declare const choose: boolean;
const inputSchema = z.object({});
const factor = z.object({ factor: z.number() });
const tenant = z.object({ tenant: z.string() });
const conditional = component.asTool({ inputSchema, toolContextSchema: choose ? factor : undefined, execute: () => 1 });
conditional.bindToolContext({ factor: 2 });
const parent = { config: { tools: { conditional } } };
component({ toolsContext: { conditional: { factor: 2 } }, execute: ({ conditional }) => conditional({}) }, parent);
// @ts-expect-error The final inferred child must still satisfy inherited context requirements.
component({ execute: () => 1 }, parent);
// @ts-expect-error An empty child cannot bypass final inherited requirements either.
component({}, { config: { tools: { conditional }, execute: () => 1 } });
// @ts-expect-error A possibly required context cannot be omitted from its owner.
component({ tools: { conditional }, execute: () => 1 });
// @ts-expect-error Direct binding retains the present parser's requirement.
conditional.bindToolContext({});
const selected = component.asTool({ inputSchema, toolContextSchema: choose ? factor : tenant, execute: () => 1 });
selected.bindToolContext({ factor: 2, tenant: 'both' });
// @ts-expect-error One selected parser cannot accept factor-only context.
selected.bindToolContext({ factor: 2 });
const permissive = component.asTool({ inputSchema, toolContextSchema: choose ? factor : z.any(), execute: () => 1 });
// @ts-expect-error A permissive alternative must not erase the required parser.
permissive.bindToolContext({});
const union = component.asTool({ inputSchema, toolContextSchema: z.union([factor, tenant]), execute: () => 1 });
union.bindToolContext({ factor: 2 });
union.bindToolContext({ tenant: 'either' });
component.asTool({ inputSchema, toolContextSchema: factor, execute: ({ factor }) => {
  // @ts-expect-error Ordinary calls have no tool context.
  return factor.toFixed();
} });
component.asTool({ inputSchema, context: { factor: 1 }, toolContextSchema: factor, execute: ({ factor }) => factor.toFixed() })();
`;
  const contextMutations = [
    ['context parser selection', 'ContextInputs<S> = S extends Schema', 'ContextInputs<S> = [S] extends [Schema]', /Unused '@ts-expect-error'/],
    ['context registry requirements', 'config: infer Config } ? ContextInput<Config>', 'config: infer Config } ? object | undefined', /Unused '@ts-expect-error'/],
    ['context permissive selection', 'unknown extends Raw<S> ? unknown : Raw<S>', 'Raw<S>', /Unused '@ts-expect-error'/],
    ['context ordinary absence', 'ToolExecutionContext<T> = OrdinaryToolContext<T>', 'ToolExecutionContext<T> = ExecutionContext<T>', /Unused '@ts-expect-error'/],
    ['context inferred inheritance', '= ValidateResolved<TConfig, [Invalid] extends [never]', '= NoInfer<[Invalid] extends [never]', /No overload matches/, 'src/types/config-validation.ts'],
  ];
  // Keep unrelated workloads separate so each guard mutation remains a focused compiler check.
  const consumer = path.join(production, 'contracts.ts');
  for (const [contracts, cases] of [[alternatives, alternativeMutations], [check, mutations], [schemaVersions, schemaMutations], [preprocessors, preprocessorMutations], [projection, projectionMutations], [selectedSchemas, selectedMutations], [helperContracts, helperMutations], [runContexts, runContextMutations], [runDescriptorContexts, runDescriptorMutations], [callerAlternatives, callerMutations], [configuredOmissions, omissionMutations], [contextAlternatives, contextMutations]]) {
    let checkedContracts;
    for (const [name, before, after, expected, filename = 'src/types/application.ts', assertion, rejected = true] of cases) {
      if (!filter.test(name)) continue;
      const currentContracts = assertion ? contracts + (rejected ? '\n// @ts-expect-error This guard must reject the invalid configuration.\n' : '\n') + assertion : contracts;
      if (currentContracts !== checkedContracts) {
        fs.writeFileSync(consumer, currentContracts);
        const baseline = run(process.execPath, [compiler, ...common, consumer]);
        assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
        checkedContracts = currentContracts;
      }
      const file = path.join(production, filename);
      const source = fs.readFileSync(file, 'utf8');
      assert.ok(source.includes(before), `Missing mutation location: ${name}`);
      fs.writeFileSync(file, source.replace(before, after));
      const result = run(process.execPath, [compiler, ...common, consumer]);
      assert.notEqual(result.status, 0, `Mutation survived: ${name}`);
      assert.match(result.stdout + result.stderr, expected);
      fs.writeFileSync(file, source);
      console.log(`Caught production type mutation: ${name}.`);
    }
  }
  // The ordinary-call budget above does not exercise injected helper contracts.
  // Compare the same registry workload with and without the new type-only member.
  const registryWorkload = `import { Function as component } from './src/factories/Function.js';
import { z } from 'zod/v4';\n` + Array.from({ length: 12 }, (_, index) => `
const child${index} = component.asTool({ inputSchema: z.object({ v${index}: z.number(), factor: z.number() }), context: { factor: 3 }, execute: input => input.v${index} * input.factor });
const owner${index} = component({ tools: { child: child${index} }, toolsContext: { child: { factor: 4 } }, execute: ({ child }) => child({ v${index}: 2 }) });
owner${index}.run({ toolsContext: { child: { factor: 5 } } });
`).join('');
  fs.writeFileSync(consumer, registryWorkload);
  const applicationFile = path.join(production, 'src/types/application.ts');
  const applicationSource = fs.readFileSync(applicationFile, 'utf8');
  const contract = '? HelperContract<ApplicationInput<Config, S>, Configured<Config>, PrivateKeys<Config, Configured<Config>, S>, R> : never;';
  assert.ok(applicationSource.includes(contract));
  const registryCosts = {};
  for (const [name, source] of [['withoutContract', applicationSource.replace(contract, '? unknown : never;')], ['withContract', applicationSource]]) {
    fs.writeFileSync(applicationFile, source);
    const result = run(process.execPath, [compiler, ...common, '--extendedDiagnostics', consumer]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    registryCosts[name] = Number(result.stdout.match(/Instantiations:\s+(\d+)/)?.[1]);
  }
  assert.ok(registryCosts.withoutContract > 0 && registryCosts.withContract > 0);
  assert.ok(registryCosts.withContract <= 2 * registryCosts.withoutContract, 'Helper contracts exceeded the 2x type-instantiation budget');
  console.log(`TS7 registry workload: ${JSON.stringify(registryCosts)}`);
} finally {
  const target = path.resolve(temporary);
  assert.equal(path.dirname(target), workspace);
  assert.ok(path.basename(target).startsWith('.phase2-production-types-'));
  fs.rmSync(target, { recursive: true, force: true });
}
