// Retain the historical aggregate budget, then mutate production type guards.
// phase2-factory-cost.cjs separately guards imports, first use and component growth.
// No source or declaration in the working tree is changed.
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
    console.log(`TS7 legacy aggregate (imports + 24 components, not marginal cost): ${JSON.stringify(results)}`);
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
declare const opaqueConfig: object;
// @ts-expect-error An ordinary broad type is not an unresolved inference constraint.
component(opaqueConfig);
// @ts-expect-error A finished Function still requires an implementation.
component({});
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
const presenceSchema = z.object({ value: z.string().transform(Number), count: z.number().default(1) });
declare const optionalSchema: { inputSchema?: typeof presenceSchema };
component({ ...optionalSchema, execute: input => {
  const rawOrParsed: string | number = input.value;
  // @ts-expect-error An optional parser may leave the raw string.
  const parsedOnly: number = input.value;
  // @ts-expect-error An absent parser does not supply its default.
  const defaulted: number = input.count;
  return rawOrParsed;
} });
const presenceSpread = enabled ? { inputSchema: presenceSchema } : {};
component({ ...presenceSpread, execute: input => {
  const rawOrParsed: string | number = input.value;
  // @ts-expect-error Conditional spreads must retain absent parsing too.
  const parsedOnly: number = input.value;
  return rawOrParsed;
} });
`;
  // The full public-factory matrix lives in configuration-alternative-guards.ts.
  // Mutate these shared owners directly to avoid repeating unrelated factory inference.
  const alternatives = `import type { ValidateToolsContext, ValidateFinalConfig, ValidateConfigFragment, ValidateRunConfig } from './src/types/config-validation.js';
import type { ValidateDescriptor, ValidateCallbacks, ValidateToolSelectionNames, ValidateToolCallbackNames } from './src/types/callbacks.js';
import type { ComponentAdmission } from './src/types/config-validation.js';
import type { EmptyMap } from './src/types/utils.js';
import type { MergedConfig } from './src/types/merge.js';
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
    ['whole registry alternatives', "InvalidToolContexts<TConfig, PartialConfig extends boolean = false> = TConfig extends unknown",
      "InvalidToolContexts<TConfig, PartialConfig extends boolean = false> = unknown extends unknown", /not assignable/, "src/types/tool-binding.ts",
      'const admitted: ValidateToolsContext<typeof pairedContexts> = pairedContexts;', false],
    ['nested registry alternatives', "TTools extends unknown ? TContexts extends unknown ? {", "unknown extends unknown ? TContexts extends unknown ? {",
      /Unused '@ts-expect-error'/, "src/types/tool-binding.ts", 'const admitted: ValidateToolsContext<{ tools: typeof nestedRegistry }> = { tools: nestedRegistry };'],
    ['branch-only descriptor hooks', 'DescriptorErrors<Final, R> = Final extends unknown', 'DescriptorErrors<Final, R> = unknown extends unknown',
      /Unused '@ts-expect-error'/, 'src/types/callbacks.ts', 'const admitted: ValidateDescriptor<HookReplacement, FinalHook, string> = {};'],
    ['branch-only Function contracts', 'FunctionConfigErrors<Final, AsTool extends boolean> = Final extends unknown',
      'FunctionConfigErrors<Final, AsTool extends boolean> = unknown extends unknown', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts',
      'const admitted: ValidateFinalConfig<HookReplacement, typeof hookConfig, FinalHook, true> = {};'],
    ['branch-only lifecycle callbacks', "Streaming extends boolean> = Final extends unknown", "Streaming extends boolean> = unknown extends unknown",
      /Unused '@ts-expect-error'/, 'src/types/callbacks.ts', "const admitted: ValidateCallbacks<ResultReplacement, MergedConfig<typeof lifecycleConfig, ResultReplacement>, 'object'> = {};"],
    ['branch-only forbidden keys', 'UnionKeys<T> = T extends unknown ? keyof T : never', 'UnionKeys<T> = keyof T',
      /Unused '@ts-expect-error'/, 'src/types/utils.ts', 'const admitted: ValidateFinalConfig<typeof forbiddenConfig, EmptyMap, typeof forbiddenConfig> = {};'],
    ['every fragment alternative', '[InvalidUnionMembers<TConfig, CallbackConfigShape<TShape>> | InvalidUnionMembers<TFinalConfig, CallbackConfigShape<TShape>>] extends [never]',
      'unknown extends unknown', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts', 'const admitted: ValidateConfigFragment<typeof forbiddenConfig, typeof forbiddenConfig, { execute: () => number }> = forbiddenConfig;'],
    ['branch-only run settings', 'Exclude<UnionKeys<TRunConfig>, keyof TShape> extends never', 'Exclude<keyof TRunConfig, keyof TShape> extends never',
      /Unused '@ts-expect-error'/, 'src/types/config-validation.ts', 'const admitted: ValidateRunConfig<typeof forbiddenRun, { model: LanguageModel; prompt: string }, { temperature?: number }> = forbiddenRun;'],
    ['null context admission', "Exclude<ParsedSchemaOutput<TSchema>, undefined>", "NonNullable<ParsedSchemaOutput<TSchema>>", /Unused '@ts-expect-error'/, "src/types/schema-shape.ts",
      'const admitted: ComponentAdmission<{ inputSchema: typeof emptyInput; toolContextSchema: typeof nullContext; execute: () => number }> = {};'],
  ];
  const mutations = [
    ['whole configuration settings', 'ConfigValue<T, K extends PropertyKey> = T extends unknown', 'ConfigValue<T, K extends PropertyKey> = unknown extends unknown',
      /Unused '@ts-expect-error'/, 'src/types/config.ts'],
    ['inherited configuration alternatives', "Parent extends unknown ? MergedConfig<Omit<Parent, 'execute'>", "unknown extends unknown ? MergedConfig<Omit<Parent, 'execute'>",
      /Property 'user' does not exist/, 'src/types/function-config.ts'],
    ['conditional configured callback fields', "TContext = TConfig extends unknown ? 'context' extends keyof TConfig", "TContext = unknown extends unknown ? 'context' extends keyof TConfig",
      /does not exist/, "src/types/config.ts"],
    ['mixed closed input branches', "TInput extends unknown ? string extends keyof TInput ? false : true : never", "string extends import('./utils.js').UnionKeys<TInput> ? false : true",
      /Unused '@ts-expect-error'/, "src/types/schema-shape.ts"],
    ['mixed collected output', "TOutputSchema = ConfigValue<TConfig, 'schema'>> = TOutputSchema extends StreamSchema", "TOutputSchema = ConfigValue<TConfig, 'schema'>> = ConfigValue<TConfig, 'schema'> extends StreamSchema",
      /not assignable/, "src/types/result.ts"],
    ['branch-only renderer private keys', "RejectedInputKeys<ComponentInput<TConfig, TInputSchema>, SuppliedInputNames<TArguments, TKeys>,", "RejectedInputKeys<ComponentInput<TConfig, TInputSchema>, keyof TArguments,",
      /Unused '@ts-expect-error'/, "src/types/component-input.ts"],
    ['LLM application admission', ": ComponentAdmission<TFinalConfig>>;", ': unknown>;',
      /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['private-key rejection', "InputKeyErrors<Extract<TKeys, TPrivateNames>, 'Private input key'>", "unknown", /Unused '@ts-expect-error'/, "src/types/component-input.ts"],
    ['run context validation', '& ValidateToolsContext<TRunConfig, MergedConfig<TConfig, TRunConfig>>',
      '', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['completed helper output', "ComponentHelper<BoundHelperConfig<TConfig, TBoundContext>, TResult>", "ComponentHelper<BoundHelperConfig<TConfig, TBoundContext>, import('./result.js').CollectedResult<TConfig>>",
      /Type 'unknown' is not assignable to type 'string'/, "src/types/tool-binding.ts"],
    ['internal binding compatibility', "ValidateToolBinding<TConfig, TContext> : unknown", "unknown : unknown",
      /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['run helper input and defaults', "Pick<TAfter, Extract<K, keyof TAfter>> extends Pick<TBefore, K> ? never : K", "never",
      /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['stale callback helpers', "DistributiveOmit<CallbackContextFromConfig<TConfig>, '_toolOptions' | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>>>", "CallbackContextFromConfig<TConfig>",
      /Unused '@ts-expect-error'/, "src/types/execution.ts"],
    ['conditional output schema', "TOutputSchema = ConfigValue<TConfig, 'schema'>> = TOutputSchema extends FlexibleSchema<unknown>", "TOutputSchema = ConfigValue<TConfig, 'schema'>> = ConfigValue<TConfig, 'schema'> extends FlexibleSchema<unknown>",
      /Unused '@ts-expect-error'/, "src/types/result.ts"],
    ['complete omitted input', "CanInvokeComponent<ComponentInput<TAlternative, TInputSchema>, ContextFromConfig<TAlternative>, EmptyMap, SchemaInputNames<TInputSchema>, HasClosedSchema<TInputSchema>>",
      "EmptyMap extends ComponentInputShape<TAlternative> ? true : false", /Unused '@ts-expect-error'/, "src/types/component-input.ts"],
    ['conditional private ownership', "ReservedInputNames<undefined extends TInputSchema ? undefined : TInputSchema,",
      "ReservedInputNames<TInputSchema,", /Unused '@ts-expect-error'/, "src/types/component-input.ts"],
    ['conditional input inference', '? Partial<Record<K, S>> : Record<K, S>',
      '? Partial<Record<K, S>> : Partial<Record<K, S>>', /error TS/, 'src/types/factory-config.ts'],
    ['optional schema presence', "[K in keyof T]: K extends 'inputSchema' ? Input", "[K in keyof T]-?: K extends 'inputSchema' ? Input",
      /Unused '@ts-expect-error'/, 'src/types/factory-config.ts'],
    ['provisional constraint identity', 'typeof provisionalConfig extends keyof TConfig ? unknown : TValidation',
      'object extends TConfig ? unknown : TValidation', /Unused '@ts-expect-error'/, 'src/types/provisional.ts'],
    ['description context type', "description?: Tool<unknown, unknown, C>['description']", "description?: Tool<unknown, unknown, any>['description']",
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
      'FlexibleSchema<T>', /Unused '@ts-expect-error'/, 'src/types/schema.ts'],
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
    ['preprocessor declaration capability', "SchemaDeclarationKind<TInput extends z.core.$ZodTransform ? TOutput : TInput,", "SchemaDeclarationKind<TInput,", /error TS/, "src/types/schema-shape.ts"],
    ['preprocessor public names', "SchemaInputNames<TInput extends z.core.$ZodTransform ? TOutput : TInput,", "SchemaInputNames<TInput,", /error TS/, "src/types/schema-shape.ts"],
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
    ['tool factory projection admission', "AsTool extends true ? ToolInputAdmission<TFinal> : unknown",
      'unknown', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['bound tool projection admission', "& ToolInputAdmission<TConfig, BoundContextDefaults<ContextFromConfig<TConfig>, ConfigValue<TConfig, 'toolContextSchema'>, TContext>>",
      "& unknown", /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['spread tool admission', "TTool extends (...args: any[]) => any ? never : 'copied component'",
      "never", /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
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
    ['selected schema contracts', ": TInputSchema extends unknown ? { config: TConfig; schema:", ": [TInputSchema] extends [unknown] ? { config: TConfig; schema:", /Unused '@ts-expect-error'|not assignable/, "src/types/config.ts"],
    ['selected callback assembly', "ExecutionContext<TConfig, TAlternatives = InputConfigAlternatives<TConfig>>", "ExecutionContext<TConfig, TAlternatives = { config: TConfig; schema: import('./config.js').InputSchemaFromConfig<TConfig> }>", /not assignable|does not exist/, "src/types/execution.ts"],
    ['correlated application configurations', "InputConfigAlternatives<TConfig> = TConfig extends unknown ?", "InputConfigAlternatives<TConfig> = unknown extends unknown ?", /Expected 1 argument|not assignable/, "src/types/config.ts"],
    ['correlated inherited callback inference', 'Parent extends unknown ? MergedConfig<Omit<Parent,',
      'unknown extends unknown ? MergedConfig<Omit<Parent,', /not assignable/, 'src/types/function-config.ts'],
    ['correlated private binding', "ToolBindingChecks<TConfig, TContext> = TConfig extends unknown ?", "ToolBindingChecks<TConfig, TContext> = unknown extends unknown ?", /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['selected tool projection', "InvalidToolProjection<TConfig, TDefaults, TAlternatives = InputConfigAlternatives<TConfig>>", "InvalidToolProjection<TConfig, TDefaults, TAlternatives = { config: TConfig; schema: InputSchemaFromConfig<TConfig> }>", /No overload matches|not assignable/, "src/types/config-validation.ts"],
    ['selected schema admission', "ComponentAdmissionChecks<TConfig, TAlternatives = InputConfigAlternatives<TConfig>>", "ComponentAdmissionChecks<TConfig, TAlternatives = { config: TConfig; schema: InputSchemaFromConfig<TConfig> }>", /Unused '@ts-expect-error'/, "src/types/config-validation.ts"],
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
    ['helper raw input', "type RawHelperInput<TInput> = TInput extends unknown ? TInput &", "type RawHelperInput<TInput> = TInput extends unknown ? unknown &", /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['helper branch keys', "keys: keyof TInput;", "keys: PropertyKey;", /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['helper constrained extras', "declared: string extends keyof TInput ? (key: RestrictedInputNames<TInput>) => void : any;", "declared: any;", /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['helper default guarantees', "defaults: (key: GuaranteedInputDefaults<TInput, TDefaults> | ValidOptionalDefaults<TInput, TDefaults>) => void;", "defaults: (key: never) => void;", /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['closed tool admission', "true extends HasOpenRootInput<InputSchemaFromConfig<TConfig>>", "false extends true", /Unused '@ts-expect-error'/, "src/types/config-validation.ts"],
    ['root record admission', ": TSchema extends z.core.$ZodRecord ? true", ": TSchema extends z.core.$ZodRecord ? false", /Unused '@ts-expect-error'/, "src/types/schema-shape.ts"],
    ['helper schema defaults', " | ValidOptionalDefaults<TInput, TDefaults>", "", /incompatible/, "src/types/tool-binding.ts"],
    ['helper optional default values', "[SelectedInputDefaults<TDefaults, TPublicNames>] extends [Pick<TInput, TPublicNames>] ? TPublicNames : never", "TPublicNames", /Unused '@ts-expect-error'/, "src/types/component-input.ts"],
    ['helper union omissions', "TKeys extends keyof TInput = Exclude<NamedKeys<TInput> & keyof TInput, TInput extends unknown ? RequiredInputNames<TInput> : never>", "TKeys extends keyof TInput = NamedKeys<TInput> & keyof TInput", /Unused '@ts-expect-error'/, "src/types/component-input.ts"],
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
    ['complete caller alternatives', "& EffectiveInputErrors<ComponentInput<TConfig, TInputSchema>, ContextFromConfig<TConfig>, SuppliedInput<TArguments, TKeys>, SchemaInputNames<TInputSchema>, HasClosedSchema<TInputSchema>>", "", /Unused '@ts-expect-error'/, "src/types/component-input.ts"],
    ['component union constraints', 'First extends TAllowed[0]', 'First = unknown', /Unused '@ts-expect-error'/, 'src/types/input.ts'],
    ['provided argument keys', 'first: First & (Partial<Record<K, unknown>> | undefined)', 'first: First', /Parameter 'value' implicitly has an 'any' type/, 'src/types/input.ts'],
    ['mapped argument fallback', "[TKeys] extends [never] ? TArguments : string extends TKeys ? TArguments", "string extends TKeys ? TArguments", /query/, "src/types/component-input.ts"],
    ['indexed private names', "RejectedInputKeys<ComponentInput<TConfig, TInputSchema>, SuppliedInputNames<TArguments, TKeys>,", "RejectedInputKeys<ComponentInput<TConfig, TInputSchema>, TKeys,", /Unused '@ts-expect-error'/, "src/types/component-input.ts"],
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
    ['context parser selection', "ToolContextInputChecks<TContextSchema> = TContextSchema extends FlexibleSchema<unknown>", "ToolContextInputChecks<TContextSchema> = [TContextSchema] extends [FlexibleSchema<unknown>]", /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['context registry requirements', "config: infer TConfig } ? ToolContextInput<TConfig>", "config: infer TConfig } ? object | undefined", /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['context permissive selection', "unknown extends InferInputSchema<TContextSchema> ? unknown : InferInputSchema<TContextSchema>", "InferInputSchema<TContextSchema>", /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['context ordinary absence', "ToolExecutionContext<TConfig> = OrdinaryToolContext<TConfig>", "ToolExecutionContext<TConfig> = ExecutionContext<TConfig>", /Unused '@ts-expect-error'/, "src/types/execution.ts"],
    ['context inferred inheritance', '= ValidateResolved<TConfig, [Invalid] extends [never]', '= NoInfer<[Invalid] extends [never]', /No overload matches/, 'src/types/config-validation.ts'],
  ];
  const configFactoryContracts = `import { Config } from './src/factories/Config.js';
import { tool } from 'ai';
import { z } from 'zod/v4';
const unknownSettings = { unknownSetting: true };
// @ts-expect-error The family constraint must not hide extra supplied keys.
Config(unknownSettings);
// @ts-expect-error An all-optional family shape must not admit arrays.
Config([]);
// @ts-expect-error Schema inference slots do not replace the configuration's schema contract.
Config({ schema: 42 });
// @ts-expect-error Input schema values still follow the supported schema protocols.
Config({ inputSchema: 42 });
// @ts-expect-error Tool-context schema values still follow the supported schema protocols.
Config({ toolContextSchema: 42 });
// @ts-expect-error Parent debug must have a valid type even if the child replaces it.
Config({ debug: true }, { config: { debug: 'invalid' } });
declare const model: import('ai').LanguageModel;
// @ts-expect-error Separately valid fragments must still form one supported family after merging.
Config({ template: 'ready' }, Config({ model }));
const parent = Config({ context: { offset: 1 } });
const child = Config({ context: { label: 'child' } }, parent);
const retained: number = child.config.context.offset;
declare const optionalParent: [] | [typeof parent];
// @ts-expect-error Parent presence must be narrowed before relying on inherited fields.
Config({ debug: false }, ...optionalParent);
const loaderParent = Config({ loader: { load: (name: string) => name } });
const loaderChild = Config({ loader: { load: (name: string) => name.toUpperCase() } }, loaderParent);
const loaders: import('cascada-engine').ILoaderAny[] = loaderChild.config.loader;
const described: import('./src/types/config.js').ConfigProvider<{ description: string }> = Config({ description: 'Shared' });
const lookup = tool({ inputSchema: z.object({ query: z.string() }), execute: ({ query }) => query.length });
Config({ tools: { lookup }, onEnd: event => {
  const result: number = event.staticToolResults[0].output;
  // @ts-expect-error Callback results retain the configured tool's output type.
  const wrong: string = event.staticToolResults[0].output;
} });
Config({ output: 'enum', enum: ['YES', 'NO'] as const, onFinish: event => {
  const answer: 'YES' | 'NO' | undefined = event.object;
} });
const mutableEnum = Config({ output: 'enum', enum: ['YES', 'NO'] });
const mutableValues: ('YES' | 'NO')[] = mutableEnum.config.enum;
`;
  const configFactoryMutations = [
    ['Config object constraint', 'TConfig extends object & configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown, ENUM>',
      'TConfig extends configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown, ENUM>', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config parent validation', 'TParentConfig extends object & NoInfer<configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown, string>>',
      'TParentConfig extends object', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config absent parent default', 'TParentConfig extends object & NoInfer<configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown, string>> = never',
      'TParentConfig extends object & NoInfer<configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown, string>> = EmptyMap', /Expected 2 arguments, but got 1/, 'src/factories/Config.ts'],
    ['Config parent presence', '...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig>]',
      '...parent: [] | [parent: configs.ConfigProvider<TParentConfig>]', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config merged validation', 'ValidateConfigFragment<TConfig, [TParentConfig] extends [never] ? TConfig : MergedConfig<TParentConfig, TConfig>,',
      'ValidateConfigFragment<TConfig, TConfig,', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config parent return inference', ': MergedConfig<NoInfer<TParentConfig>, ResolvedConfig<TConfig>>',
      ': MergedConfig<TParentConfig, ResolvedConfig<TConfig>>', /Expected 2 arguments, but got 1/, 'src/factories/Config.ts'],
    ['Config inherited result', ': MergedConfig<NoInfer<TParentConfig>, ResolvedConfig<TConfig>>',
      ': ProcessedConfig<ResolvedConfig<TConfig>>', /Property 'offset' does not exist/, 'src/factories/Config.ts'],
    ['Config callback registry inference', 'TCallbackTools, TSchemaOutput, TCallbackRuntime, TCallbackOutput, TCallbackEnum>',
      'configs.ToolRegistry, TSchemaOutput, TCallbackRuntime, TCallbackOutput, TCallbackEnum>', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config callback enum inference', 'TCallbackTools, TSchemaOutput, TCallbackRuntime, TCallbackOutput, TCallbackEnum>',
      'TCallbackTools, TSchemaOutput, TCallbackRuntime, TCallbackOutput, readonly string[]>', /not assignable/, 'src/factories/Config.ts'],
    ['Config mutable enum inference', 'AnyConfigInferShape<ToolSet, Record<string, any>, unknown, ENUM>',
      'AnyConfigInferShape<ToolSet, Record<string, any>, unknown, string>', /not assignable/, 'src/factories/Config.ts'],
  ];
  // Keep unrelated workloads separate so each guard mutation remains a focused compiler check.
  const objectGeneratorContracts = `import { ObjectGenerator } from './src/factories/ObjectGenerator.js';
import { Config } from './src/factories/Config.js';
import { z } from 'zod/v4';
import { z as z3 } from 'zod/v3';
declare const model: import('ai').LanguageModel;
const schema = z.object({ answer: z.number() });
const parent = Config({ model, schema });
// @ts-expect-error Finished object components require a model.
ObjectGenerator({ schema });
// @ts-expect-error A parent cannot conceal unknown settings.
ObjectGenerator({}, { config: { model, schema, unknownSetting: true } });
// @ts-expect-error A raw parent cannot restore an unsupported schema.
ObjectGenerator({}, { config: { model, schema: z3.object({ answer: z3.number() }) } });
// @ts-expect-error A function prompt must exist in the effective configuration.
ObjectGenerator.withFunction({}, parent);
ObjectGenerator.withFunction({ prompt: () => 'Answer' }, parent);
// @ts-expect-error Replacing a schema must recheck a retained prompt's parsed input.
ObjectGenerator.withFunction({ inputSchema: z.object({ value: z.string() }) }, { config: {
  model, schema, inputSchema: z.object({ value: z.number() }), prompt: ({ value }: { value: number }) => value.toFixed(),
} });
const annotated: import('./src/types/config.js').ConfigProvider<{ schema: typeof schema }> = ObjectGenerator({ model, schema });
declare const optionalParent: [] | [typeof parent];
// @ts-expect-error Narrow parent presence before calling.
ObjectGenerator({ model, schema }, ...optionalParent);
const enumeration = ObjectGenerator({ model, output: 'enum', enum: ['YES', 'NO'] });
const enumValues: ('YES' | 'NO')[] = enumeration.config.enum;
enumeration('Answer').then(result => { const value: 'YES' | 'NO' = result.object; });
const generated = ObjectGenerator({ model, schema });
generated('Answer').then(result => { const value: number = result.object.answer; });
declare const ambiguousMode: 'object' | 'array';
const ambiguous = ObjectGenerator({ model, schema, output: ambiguousMode });
// @ts-expect-error Retain the requirement to narrow a mode field or use complete alternatives.
ambiguous('Answer');
const inputSchema = z.object({ value: z.string().transform(Number) });
const toolContextSchema = z.object({ tenant: z.string() });
ObjectGenerator.withTemplate.asTool({ model, schema, inputSchema, toolContextSchema, prompt: '{{ value }}',
  onInputAvailable: options => { const value: number = options.input.value; },
  description: options => options.context.tenant,
  toModelOutput: ({ output }) => ({ type: 'text', value: String(output.answer) }) });
`;
  const objectGeneratorMutations = [
    ['ObjectGenerator required settings', '& ValidateObjectConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryExtras<TPromptType, AsTool>>',
      '', /Unused '@ts-expect-error'/, 'src/factories/ObjectGenerator.ts'],
    ['ObjectGenerator retained prompt compatibility', 'extends { prompt: PromptCallback<T, AsTool> }',
      'extends { prompt: unknown }', /Unused '@ts-expect-error'/, 'src/types/function-prompt.ts'],
    ['ObjectGenerator enum literal inference', 'FactoryConfig<TPromptType, AsTool, ENUM>',
      'FactoryConfig<TPromptType, AsTool>', /not assignable/, 'src/factories/ObjectGenerator.ts'],
    ['ObjectGenerator parent presence', '...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig',
      '...parent: [] | [parent: configs.ConfigProvider<TParentConfig', /Unused '@ts-expect-error'/, 'src/factories/ObjectGenerator.ts'],
    ['ObjectGenerator parent validation', '& ValidateObjectParentConfig<TParentConfig, FinalConfig<TParentConfig, TConfig>, FactoryExtras<TPromptType, AsTool>>',
      '', /Unused '@ts-expect-error'/, 'src/factories/ObjectGenerator.ts'],
    ['ObjectGenerator parsed descriptor input', 'DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>,',
      'DescriptorInput<Record<never, never>,', /unknown|does not exist|implicitly has an 'any'/, 'src/factories/ObjectGenerator.ts'],
    ['ObjectGenerator output inference', 'GenerateObjectResultAugmented<ObjectOutputFromConfig<TConfig>>',
      'GenerateObjectResultAugmented<unknown>', /unknown/, 'src/factories/ObjectGenerator.ts'],
    ['ObjectGenerator ambiguous output mode', "[ObjectOutputConfig<TConfig>] extends [never] ? 'Config Error: Narrow the output mode or use a union of complete configurations.'",
      "false extends true ? never", /Unused '@ts-expect-error'/, 'src/factories/ObjectGenerator.ts'],
  ];
  const factoryContracts = `import { Function as component } from './src/factories/Function.js';
import { Template } from './src/factories/Template.js';
import { Script } from './src/factories/Script.js';
import { TextGenerator } from './src/factories/TextGenerator.js';
import { TextStreamer } from './src/factories/TextStreamer.js';
import { ObjectGenerator } from './src/factories/ObjectGenerator.js';
import { ObjectStreamer } from './src/factories/ObjectStreamer.js';
import { Config } from './src/factories/Config.js';
import type { ConfigProvider } from './src/types/config.js';
import { z } from 'zod/v4';
import { z as z3 } from 'zod/v3';
import { Output } from 'ai';
declare const model: import('ai').LanguageModel;
const schema = z.object({ answer: z.number() });
const parent = Config({ model });
const objectParent = Config({ model, schema });
// @ts-expect-error An implementation is required.
component({});
// @ts-expect-error Capturing known keys must still validate ordinary setting values.
component({ execute: () => 1, debug: 'yes' });
// @ts-expect-error Native descriptor settings keep their SDK types.
component.asTool({ inputSchema: z.object({}), execute: () => 1, strict: 'yes' });
// @ts-expect-error Removing object capture checks must not admit invalid SDK options.
ObjectGenerator({ model: 123, schema, temperature: 'hot' });
// @ts-expect-error Inline templates require their source.
Template({});
// @ts-expect-error Inline scripts require their source.
Script({});
// @ts-expect-error A finished generator needs its model.
TextGenerator({ prompt: 'Answer' });
// @ts-expect-error A finished streamer needs its model.
TextStreamer({ prompt: 'Answer' });
// @ts-expect-error The parent cannot hide an unknown setting.
Template({}, { config: { template: 'Answer', unknownSetting: true } });
// @ts-expect-error The parent cannot hide an unknown setting.
Script({}, { config: { script: 'return 1', unknownSetting: true } });
// @ts-expect-error The parent cannot hide an unknown setting.
TextGenerator({}, { config: { model, unknownSetting: true } });
// @ts-expect-error The parent cannot hide an unknown setting.
TextStreamer({}, { config: { model, unknownSetting: true } });
// @ts-expect-error A function prompt is required after merging.
TextGenerator.withFunction({}, parent);
// @ts-expect-error A function prompt is required after merging.
TextStreamer.withFunction({}, parent);
// @ts-expect-error A function prompt is required after merging.
ObjectStreamer.withFunction({}, objectParent);
TextGenerator.withFunction({ prompt: () => 'Answer' }, parent);
TextStreamer.withFunction({ prompt: () => 'Answer' }, parent);
ObjectStreamer.withFunction({ prompt: () => 'Answer' }, objectParent);
const annotated: ConfigProvider<{ execute: () => number }> = component({ execute: () => 1 });
const inputSchema = z.object({ value: z.string().transform(Number) });
Template.asTool({ template: '{{ value }}', inputSchema,
  onInputAvailable: ({ input }) => { const parsed: number = input.value; } });
Script.asTool({ script: 'return value', inputSchema, schema: z.number(),
  toModelOutput: ({ output }) => { const parsed: number = output; return { type: 'text', value: String(parsed) }; } });
const result = Script({ schema: z.number() }, Config({ script: 'return 1', schema: z.string() }));
result().then(value => { const parsed: number = value; });
const output = Output.object({ schema });
TextGenerator({ model, output, onStart: event => { const selected: typeof output | undefined = event.output; } });
TextStreamer({ model, output, onStart: event => { const selected: typeof output | undefined = event.output; } });
const plain = TextStreamer({ model });
plain('Answer').textStream;
TextStreamer.withFunction({ model, prompt: () => 'Answer' })().then(value => value.textStream);
const objects = ObjectStreamer({ output: 'array' }, objectParent);
objects('Answer').object.then(value => { const answers: { answer: number }[] = value; });
objects('Answer').elementStream;
ObjectStreamer.withFunction({ prompt: () => 'Answer' }, objectParent)().then(value => value.object);
declare const mode: 'object' | 'array';
const ambiguous = ObjectStreamer({ model, schema, output: mode });
// @ts-expect-error An ambiguous output field must not promise scalar-only results.
ambiguous('Answer');
// @ts-expect-error A raw parent cannot restore unsupported output schemas.
ObjectStreamer({}, { config: { model, schema: z3.object({ answer: z3.number() }) } });
// @ts-expect-error Generation uses the same resolved-mode value validation.
ObjectGenerator({}, { config: { model, schema: z3.object({ answer: z3.number() }) } });

declare const select: boolean;
const pairedPrompt = { config: select
  ? { model, inputSchema, prompt: ({ value }: { value: number }) => value.toFixed() }
  : { model, inputSchema: z.object({ value: z.string() }), prompt: ({ value }: { value: string }) => value.toUpperCase() } };
TextGenerator.withFunction({}, pairedPrompt)({ value: '4' });
TextStreamer.withFunction({}, pairedPrompt)({ value: '4' });
ObjectStreamer.withFunction({ schema }, pairedPrompt)({ value: '4' });
const badPrompt = { config: select ? pairedPrompt.config : { model, inputSchema, prompt: ({ value }: { value: boolean }) => String(value) } };
// @ts-expect-error One incompatible prompt must invalidate the whole selection.
TextGenerator.withFunction({}, badPrompt);
ObjectStreamer({ schema: undefined, output: 'no-schema' }, objectParent)('Answer');
// @ts-expect-error The old schema must actually be cleared.
ObjectStreamer({ output: 'no-schema' }, objectParent);
declare const incompleteMode: { model: typeof model, output: 'no-schema' } | { model: typeof model, output: 'array' };
// @ts-expect-error A schemaless branch cannot hide another branch's missing schema.
ObjectStreamer(incompleteMode);
declare const completeModes: { model: typeof model, output: 'no-schema' } | { model: typeof model, output: 'array', schema: typeof schema };
ObjectStreamer(completeModes)('Answer');
`;
  const factoryMutations = [
    ['Factory correlated prompt validation', '[InvalidPromptBranches<FinalConfig, AsTool>] extends [never]',
      "Pick<FinalConfig, 'prompt' & keyof FinalConfig> extends { prompt: PromptCallback<FinalConfig, AsTool> }", /No overload matches/, 'src/types/function-prompt.ts'],
    ['Factory prompt branch failure', '? never : T : never;',
      '? never : never : never;', /Unused '@ts-expect-error'/, 'src/types/function-prompt.ts'],
    ['Factory output mode fields', '| IncompatibleKeys<Pick<Final, Extract<UnionKeys<Selected>, ObjectOutputSettingKeys & keyof Final>>, ObjectConfigShape<Final>>',
      '', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['Factory per-branch output requirements', 'type MissingObjectKeys<Final, Extras> = Final extends unknown',
      'type MissingObjectKeys<Final, Extras> = [Final] extends [unknown]', /not assignable/, 'src/types/config-validation.ts'],
    ['Factory clearing old output fields', '& Partial<Record<Exclude<ObjectOutputSettingKeys, keyof Request>, undefined>>',
      '', /not assignable/, 'src/types/config.ts'],
    ['Factory Function final validation', '& ValidateFinalConfig<TConfig, CallbackParent<TParentConfig>, FinalConfig<TParentConfig, TConfig>, AsTool>',
      '', /Unused '@ts-expect-error'/, 'src/factories/Function.ts'],
    ['Factory Function return inference', ') => NoInfer<AsTool extends true ? ToolCallSignature<FinalConfig<TParentConfig, TConfig>> : FunctionCallSignature<FinalConfig<TParentConfig, TConfig>>>;',
      ') => AsTool extends true ? ToolCallSignature<FinalConfig<TParentConfig, TConfig>> : FunctionCallSignature<FinalConfig<TParentConfig, TConfig>>;', /Expected 2 arguments, but got 1/, 'src/factories/Function.ts'],
    ...['Template', 'Script'].flatMap(name => [
      [
        `Factory ${name} required settings`, `& Validate${name}Config<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryConfig<Named, AsTool>>`,
        '', /Unused '@ts-expect-error'/, `src/factories/${name}.ts`,
      ],
      [
        `Factory ${name} parent validation`, `& Validate${name}ParentConfig<TParentConfig, FactoryConfig<Named, AsTool>>`,
        '', /Unused '@ts-expect-error'/, `src/factories/${name}.ts`,
      ],
    ]),
    ...['TextGenerator', 'TextStreamer'].flatMap(name => {
      const shape = name === 'TextGenerator' ? 'FactoryConfig<TPromptType, AsTool>' : 'FactoryConfig<TPromptType>';
      const streaming = name === 'TextStreamer' ? ', true' : '';
      return [
        [`Factory ${name} required settings`, `& ValidateTextConfig<TConfig, FinalConfig<TParentConfig, TConfig>, ${shape}${streaming}>`,
          '', /Unused '@ts-expect-error'/, `src/factories/${name}.ts`],
        [`Factory ${name} parent validation`, `& ValidateTextParentConfig<TParentConfig, ${shape}${streaming}>`,
          '', /Unused '@ts-expect-error'/, `src/factories/${name}.ts`],
        [`Factory ${name} callback output`, `TCallbackRuntime, TCallbackOutput, ${name === 'TextStreamer'}>`,
          `TCallbackRuntime, AIOutput, ${name === 'TextStreamer'}>`, /not assignable/, `src/factories/${name}.ts`],
      ];
    }),
    ['Factory required function prompts', 'extends { prompt: PromptCallback<T, AsTool> }',
      'extends { prompt?: PromptCallback<T, AsTool> }', /Unused '@ts-expect-error'/, 'src/types/function-prompt.ts'],
    ['Factory inherited schema replacement', 'MergedConfig<Parent, ResolvedConfig<Config>>',
      'MergedConfig<ResolvedConfig<Config>, Parent>', /not assignable/, 'src/types/factory-config.ts'],
    ['Factory TextStreamer delivery', "TPromptType extends 'text' ? false : true", 'true', /textStream.*does not exist/, 'src/factories/TextStreamer.ts'],
    ['Factory ObjectStreamer delivery', "TPromptType extends 'text' ? false : true", 'true', /object.*does not exist/, 'src/factories/ObjectStreamer.ts'],
    ['Factory ObjectStreamer array result', "StreamObjectArrayResult<InferSchema<ConfigValue<Config, 'schema'>>>",
      "StreamObjectObjectResult<InferSchema<ConfigValue<Config, 'schema'>>>", /missing the following properties|not assignable/, 'src/types/result.ts'],
    ['Factory ObjectStreamer ambiguous mode', "[ObjectOutputConfig<TConfig, true>] extends [never] ? 'Config Error: Narrow the output mode or use a union of complete configurations.'",
      'false extends true ? never', /Unused '@ts-expect-error'/, 'src/factories/ObjectStreamer.ts'],
  ];
  // Exact-optional consumers use fresh emitted declarations, like the public type gate.
  const optionalContracts = `import { create, z } from './dist/index.js';
import type { TemplateConfig, ScriptConfig } from './dist/index.js';
declare const model: import('ai').LanguageModel;
const schema = z.number();
const parent = create.Config({ model, schema });
// @ts-expect-error Explicit schema removal cannot disappear during inference.
create.ObjectGenerator({ schema: undefined, output: 'array' }, parent);
// @ts-expect-error The streaming factory must capture the same child settings.
create.ObjectStreamer({ schema: undefined, output: 'array' }, parent);
const template: TemplateConfig<{ value: number }> = { template: '{{ value }}' };
const script: ScriptConfig<{ value: number }, number> & { script: string } = { script: 'return value' };
create.Template(template);
create.Script(script);
create.Template({ template: 'Answer', inputSchema: undefined });
create.Script({ script: 'return 1', inputSchema: undefined });
const scriptParent = create.Config({ script: 'return "raw"', schema });
create.Script({ schema: undefined }, scriptParent);
create.Script.asTool({ schema: undefined, inputSchema: z.object({}) }, scriptParent);
create.ObjectGenerator({ schema: undefined, output: 'no-schema' }, parent);
create.ObjectStreamer({ schema: undefined, output: 'no-schema' }, parent);
`;
  const optionalMutations = [
    ['Factory optional Script output', 'schema?: SchemaType<OUTPUT> | undefined;',
      'schema?: SchemaType<OUTPUT>;', /not assignable/, 'dist/types/config.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Factory optional schema override', "K extends 'schema' ? EmptyMap extends Pick<T, K> ? T[K] | undefined : T[K] : T[K]",
      'T[K]', /Unused '@ts-expect-error'/, 'dist/types/callbacks.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Factory optional Template input', 'TemplateConfig<any> & ToolContextSchemaConfig<any>',
      'TemplateConfig<any> & configs.ToolConfig<any, any, any>', /Invalid template settings/, 'dist/factories/Template.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Factory optional Script input', 'ScriptConfig<any, any> & ToolContextSchemaConfig<any>',
      'configs.ScriptToolConfig<any, any, any>', /Invalid script settings/, 'dist/factories/Script.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
  ];
  if (optionalMutations.some(([name]) => filter.test(name))) {
    const declarations = run(process.execPath, [compiler, ...common.filter(flag => flag !== '--noEmit'), '--declaration', '--emitDeclarationOnly',
      '--rootDir', path.join(production, 'src'), '--outDir', path.join(production, 'dist'), path.join(production, 'src/index.ts')]);
    assert.equal(declarations.status, 0, declarations.stdout + declarations.stderr);
  }
  const consumer = path.join(production, 'contracts.ts');
  for (const [contracts, cases] of [[alternatives, alternativeMutations], [check, mutations], [schemaVersions, schemaMutations], [preprocessors, preprocessorMutations], [projection, projectionMutations], [selectedSchemas, selectedMutations], [helperContracts, helperMutations], [runContexts, runContextMutations], [runDescriptorContexts, runDescriptorMutations], [callerAlternatives, callerMutations], [configuredOmissions, omissionMutations], [contextAlternatives, contextMutations], [configFactoryContracts, configFactoryMutations], [objectGeneratorContracts, objectGeneratorMutations], [factoryContracts, factoryMutations], [optionalContracts, optionalMutations]]) {
    let checkedContracts;
    for (const [name, before, after, expected, filename, assertion, rejected = true, flags = []] of cases) {
      if (!filter.test(name)) continue;
      assert.ok(filename, `Mutation needs an explicit owner: ${name}`);
      const currentContracts = assertion ? contracts + (rejected ? '\n// @ts-expect-error This guard must reject the invalid configuration.\n' : '\n') + assertion : contracts;
      const checkKey = JSON.stringify(flags) + currentContracts;
      if (checkKey !== checkedContracts) {
        fs.writeFileSync(consumer, currentContracts);
        const baseline = run(process.execPath, [compiler, ...common, ...flags, consumer]);
        assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
        checkedContracts = checkKey;
      }
      const file = path.join(production, filename);
      const source = fs.readFileSync(file, 'utf8');
      assert.ok(source.includes(before), `Missing mutation location: ${name}`);
      fs.writeFileSync(file, source.replace(before, after));
      const result = run(process.execPath, [compiler, ...common, ...flags, consumer]);
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
  const bindingFile = path.join(production, 'src/types/tool-binding.ts');
  const bindingSource = fs.readFileSync(bindingFile, 'utf8');
  const contract = '? HelperCallContract<ComponentInput<TAlternative, TInputSchema>, ContextFromConfig<TAlternative>, PrivateInputNames<TAlternative, ContextFromConfig<TAlternative>, TInputSchema>, TResult> : never;';
  assert.ok(bindingSource.includes(contract));
  const registryCosts = {};
  for (const [name, source] of [['withoutContract', bindingSource.replace(contract, '? unknown : never;')], ['withContract', bindingSource]]) {
    fs.writeFileSync(bindingFile, source);
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
