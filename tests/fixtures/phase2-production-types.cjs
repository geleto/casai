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
  const check = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import { Function as component } from './src/factories/Function.js';
import { Template } from './src/factories/Template.js';
import { Script } from './src/factories/Script.js';
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
LLMAgent.withTemplate(partitioned);
// @ts-expect-error Text streamers apply shared schema admission.
LLMAgent.withTemplate.asStream(partitioned);
// @ts-expect-error Object generators apply shared schema admission.
LLMAgent.withTemplate({ ...partitioned, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
// @ts-expect-error Object streamers apply shared schema admission.
LLMAgent.withTemplate.asStream({ ...partitioned, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
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
  const alternatives = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import type { ValidateToolsContext, ValidateFinalConfig, ValidateConfigFragment, ValidateRunConfig } from './src/types/config-validation.js';
import type { ValidateDescriptor, ValidateToolSelectionNames, ValidateToolCallbackNames } from './src/types/callbacks.js';
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
const stringOutput = Output.object({ schema: stringInput });
const numberOutput = Output.object({ schema: numberInput });
declare const lifecycleConfig: { model: LanguageModel; output: typeof stringOutput; onEnd: (event: { output: { value: string } | undefined }) => void }
  | { model: LanguageModel; output: typeof stringOutput };
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
    ['branch-only lifecycle callbacks', 'Callbacks = T extends unknown ? CallbackErrors', 'Callbacks = unknown extends unknown ? CallbackErrors',
      /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts', 'LLMAgent({ output: numberOutput }, { config: lifecycleConfig });'],
    ['branch-only forbidden keys', 'UnionKeys<T> = T extends unknown ? keyof T : never', 'UnionKeys<T> = keyof T',
      /Unused '@ts-expect-error'/, 'src/types/utils.ts', 'const admitted: ValidateFinalConfig<typeof forbiddenConfig, EmptyMap, typeof forbiddenConfig> = {};'],
    ['every fragment alternative', '[InvalidUnionMembers<TConfig, CallbackConfigShape<TShape>> | InvalidUnionMembers<TFinalConfig, CallbackConfigShape<TShape>>] extends [never]',
      'unknown extends unknown', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts', 'const admitted: ValidateConfigFragment<typeof forbiddenConfig, typeof forbiddenConfig, { execute: () => number }> = forbiddenConfig;'],
    ['branch-only run settings', 'Exclude<Keys, keyof TShape> extends never', 'Exclude<keyof TRunConfig, keyof TShape> extends never',
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
    ['LLM application admission', '& ComponentAdmission<T>', '& unknown',
      /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
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
  const schemaVersions = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import { Function as component } from './src/factories/Function.js';
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
  const preprocessors = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import { Function as component } from './src/factories/Function.js';
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
  const projection = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import { Function as component } from './src/factories/Function.js';
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
  const selectedSchemas = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import { Function as component } from './src/factories/Function.js';
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
  const helperContracts = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import { Function as component } from './src/factories/Function.js';
import { tool } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod/v4';
declare const model: LanguageModel;
const common = { toolContextSchema: z.object({ factor: z.number() }), context: { factor: 1 } };
const strings = component.asTool({ inputSchema: z.object({ value: z.string().transform(Number) }), execute: input => input.value }, { config: common });
const numbers = component.asTool({ inputSchema: z.object({ value: z.number() }), execute: input => input.value }, { config: common });
const raw = LLMAgent.withFunction({ model, tools: { operation: strings }, toolsContext: { operation: { factor: 1 } }, prompt: async ({ operation }) => String(await operation({ value: '4' })) });
// @ts-expect-error Parsed output agreement does not preserve raw input.
raw.run({ tools: { operation: numbers } });
const open = tool({ contextSchema: common.toolContextSchema, inputSchema: z.looseObject({ value: z.number() }), execute: input => input.value });
const owner = LLMAgent.withFunction({ model, tools: { operation: open }, toolsContext: { operation: { factor: 1 } }, prompt: async ({ operation }) => String(await operation({ value: 4, extra: 'text' })) });
const restricted = tool({ contextSchema: common.toolContextSchema, inputSchema: z.looseObject({ value: z.number(), extra: z.number().optional() }), execute: input => input.value });
// @ts-expect-error Optional declarations can restrict former open arguments.
owner.run({ tools: { operation: restricted } });
const mixed = tool({ contextSchema: common.toolContextSchema, inputSchema: z.union([z.looseObject({ kind: z.literal('a') }), z.strictObject({ kind: z.literal('b') })]), execute: () => 1 });
const moved = tool({ contextSchema: common.toolContextSchema, inputSchema: z.union([z.strictObject({ kind: z.literal('a') }), z.looseObject({ kind: z.literal('b') })]), execute: () => 1 });
const mixedOwner = LLMAgent.withFunction({ model, tools: { mixed }, toolsContext: { mixed: { factor: 1 } }, prompt: async ({ mixed }) => String(await mixed({ kind: 'a', extra: true })) });
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
  const runContexts = `import { LLMAgent } from './src/factories/LLMAgent.js';
import type { LanguageModel } from 'ai';
import { z } from 'zod/v4';
declare const model: LanguageModel;
const component = LLMAgent.withTemplate({ model, prompt: '{{ value }}',
  inputSchema: z.looseObject({ value: z.number() }), context: { value: 1, user: 'private' } });
declare const invalid: { maxOutputTokens: number } | { context: { value: number; user: string } };
declare const valid: { maxOutputTokens: number } | { context: { value: number; extra: string } };
component.run(valid);
// @ts-expect-error The context-bearing branch cannot replace a private binding.
component.run(invalid);
`;
  const runContextMutations = [
    ['branch-only run context', '& ValidateRunContext<TRunConfig, TConfig, ContextKeys>', '& unknown', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
  ];
  const runDescriptorContexts = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import { Function as component } from './src/factories/Function.js';
import { tool, type LanguageModel } from 'ai';
import { z } from 'zod/v4';
declare const model: LanguageModel;
const inputSchema = z.object({ value: z.number() });
const toolContextSchema = z.object({ factor: z.string().transform(Number) });
const original = component.asTool({ inputSchema, toolContextSchema, context: { factor: 1 }, execute: input => input.value * input.factor });
const replacement = component.asTool({ inputSchema, toolContextSchema: z.object({ factor: z.union([z.string(), z.number()]).transform(Number) }), context: { factor: 1 }, execute: input => input.value * input.factor + 1 });
const owner = LLMAgent.withFunction({ model, tools: { operation: original }, toolsContext: { operation: { factor: '3' } }, prompt: async ({ operation }) => String(await operation({ value: 2 })) });
owner.run({ tools: { operation: replacement } });
const modelOnly = LLMAgent({ model, prompt: 'ready', tools: { operation: original }, toolsContext: { operation: { factor: '3' } } });
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
const defaultOwner = LLMAgent.withFunction({ model, tools: { operation: configured }, prompt: async ({ operation }) => String(await operation({ value: 2 })) });
defaultOwner.run({ tools: { operation: defaulted } });
`;
  const runDescriptorMutations = [
    ['run descriptor context', "import('@ai-sdk/provider-utils').InferToolContext<T>", "import('./schema.js').InferInputSchema<ConfigValue<T, 'contextSchema'>>", /not assignable|No overload matches/, 'src/types/agent.ts'],
  ];
  const callerAlternatives = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import { Function as component } from './src/factories/Function.js';
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
  const configuredOmissions = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Template } from './src/factories/Template.js';
import { z } from 'zod/v4';
import type { LanguageModel } from 'ai';
declare const choose: boolean;
declare const model: LanguageModel;
const inputSchema = z.object({ value: z.number() });
const config = choose ? { inputSchema, context: { value: 1 } } : { inputSchema };
const renderer = Template({ template: '{{ value }}' }, { config });
const text = LLMAgent.withTemplate({ model, prompt: '{{ value }}' }, { config });
renderer({ value: 2 });
text({ value: 2 });
// @ts-expect-error Every possible configuration must satisfy omitted input.
renderer();
// @ts-expect-error Model preparation has the same completeness requirement.
text();
const complete = choose ? { inputSchema, context: { value: 1 } } : { inputSchema, context: { value: 2, db: 'private' } };
Template({ template: '{{ value }}' }, { config: complete })();
LLMAgent.withTemplate({ model, prompt: '{{ value }}' }, { config: complete })();
`;
  const omissionMutations = [
    ['conditional renderer omission', '[TConfig] extends [Record<Key, string>]', 'TConfig extends Record<Key, string>', /Unused '@ts-expect-error'/, 'src/types/input.ts'],
    ['conditional model omission', '[T] extends [{ prompt: ConfiguredSource<P> }] ? ContextHistory<T>', 'T extends { prompt: ConfiguredSource<P> } ? ContextHistory<T>', /Unused '@ts-expect-error'/, 'src/types/agent.ts'],
  ];
  const contextAlternatives = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import { Function as component } from './src/factories/Function.js';
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
import { tool, Output } from 'ai';
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
Config({ output: Output.choice({ options: ['YES', 'NO'] }), onEnd: event => {
  const answer: 'YES' | 'NO' | undefined = event.output;
  // @ts-expect-error Choice output is not a number, nor any.
  const wrong: number = event.output;
} });
`;
  const configFactoryMutations = [
    ['Config object constraint', 'TConfig extends object & configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>',
      'TConfig extends configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config parent validation', 'TParentConfig extends object & NoInfer<configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>>',
      'TParentConfig extends object', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config absent parent default', 'TParentConfig extends object & NoInfer<configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>> = never',
      'TParentConfig extends object & NoInfer<configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>> = EmptyMap', /Expected 2 arguments, but got 1/, 'src/factories/Config.ts'],
    ['Config parent presence', '...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig>]',
      '...parent: [] | [parent: configs.ConfigProvider<TParentConfig>]', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config merged validation', 'ValidateConfigFragment<TConfig, [TParentConfig] extends [never] ? TConfig : MergedConfig<TParentConfig, TConfig>,',
      'ValidateConfigFragment<TConfig, TConfig,', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config parent return inference', ': MergedConfig<NoInfer<TParentConfig>, ResolvedConfig<TConfig>>',
      ': MergedConfig<TParentConfig, ResolvedConfig<TConfig>>', /Expected 2 arguments, but got 1/, 'src/factories/Config.ts'],
    ['Config inherited result', ': MergedConfig<NoInfer<TParentConfig>, ResolvedConfig<TConfig>>',
      ': ProcessedConfig<ResolvedConfig<TConfig>>', /Property 'offset' does not exist/, 'src/factories/Config.ts'],
    ['Config callback registry inference', 'TCallbackTools, TCallbackRuntime, TCallbackOutput>',
      'configs.ToolRegistry, TCallbackRuntime, TCallbackOutput>', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config callback output inference', 'TCallbackTools, TCallbackRuntime, TCallbackOutput>',
      'TCallbackTools, TCallbackRuntime, AIOutput>', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
  ];
  // The unified agent replaces the four output-mode factories. Native Output owns
  // enum/array schema admission; Casai owns source, context, delivery and hooks.
  const agentContracts = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Config } from './src/factories/Config.js';
import { Output } from 'ai';
import { z } from 'zod/v4';
import { z as z3 } from 'zod/v3';
declare const model: import('ai').LanguageModel;
const schema = z.object({ answer: z.number() });
const output = Output.object({ schema });
const parent = Config({ model, output });
// @ts-expect-error A finished agent requires its model.
LLMAgent({ output });
// @ts-expect-error Parent keys must belong to the agent contract.
LLMAgent({}, { config: { model, output, unknownSetting: true } });
// @ts-expect-error Casai application schemas reject Zod 3.
LLMAgent({}, { config: { model, inputSchema: z3.object({ answer: z3.number() }) } });
// Native SDK outputs retain native schema support.
LLMAgent({ model, output: Output.object({ schema: z3.object({ answer: z3.number() }) }) });
// @ts-expect-error Without configured source, the shorthand call must supply it.
LLMAgent.withFunction({}, parent)();
LLMAgent.withFunction({ prompt: () => 'Answer' }, parent)();
// @ts-expect-error Retained function prompts must accept the new parsed context.
LLMAgent.withFunction({ inputSchema: z.object({ value: z.string() }) }, { config: {
  model, output, inputSchema: z.object({ value: z.number() }), prompt: ({ value }: { value: number }) => value.toFixed(),
} });
const annotated: import('./src/types/config.js').ConfigProvider<{ output: typeof output }> = LLMAgent({ model, output });
declare const optionalParent: [] | [typeof parent];
// @ts-expect-error Narrow parent presence before calling.
LLMAgent({ model, output }, ...optionalParent);
const enumeration = LLMAgent({ model, output: Output.choice({ options: ['YES', 'NO'] }) });
enumeration('Answer').then(result => { const value: 'YES' | 'NO' = result.value; });
LLMAgent({ model, output })('Answer').then(result => { const value: number = result.value.answer; });
LLMAgent.asStream({ model, output })('Answer').then(result => { const value: Promise<{ answer: number }> = result.value; });
LLMAgent.asStream({ model })('Answer').then(result => { const value: AsyncIterable<string> = result.value; });
const inputSchema = z.object({ value: z.string().transform(Number) });
const toolContextSchema = z.object({ tenant: z.string() });
LLMAgent.withTemplate.asTool({ model, output, inputSchema, toolContextSchema, prompt: '{{ value }}',
  onInputAvailable: options => { const value: number = options.input.value; },
  description: options => options.context.tenant,
  toModelOutput: ({ output }) => ({ type: 'text', value: String(output.answer) }) });
const native = LLMAgent({ model, inputSchema });
native.generate({ prompt: 'Answer', options: { value: '4' } });
// @ts-expect-error Native literal methods retain the closed public input contract.
native.generate({ prompt: 'Answer', options: { value: '4', extra: true } });
// @ts-expect-error Native options obey the same required input boundary.
native.generate({ prompt: 'Answer' });
// @ts-expect-error SDK options are raw schema input, not parsed output.
native.stream({ prompt: 'Answer', options: { value: 4 } });
const functionSource = LLMAgent.withFunction({ model, inputSchema, prompt: ({ value }) => value.toFixed() });
LLMAgent({ prompt: context => {
  const value: number = context.value;
  // @ts-expect-error Inherited function callbacks retain their parsed shape.
  const missing = context.absent;
  return String(value);
} }, Config({}, functionSource))({ value: '4' });
LLMAgent.asStream({ model, prompt: [{ role: 'user', content: 'Answer' }] })();
const tool = LLMAgent.withTemplate.asStream.asTool({ model, inputSchema, prompt: '{{ value }}' });
const inheritedTool = LLMAgent({}, Config({}, tool));
const enabled: true = inheritedTool.config.streaming;
const descriptor: import('ai').Tool = inheritedTool;
// @ts-expect-error Inherited tools retain the separate tool interface.
inheritedTool.generate({ prompt: 'Answer' });
`;
  const agentMutations = [
    ['LLMAgent required model', 'Required = Missing<T, AgentRequiredSettings<P, A>>', 'Required = never', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['LLMAgent retained prompt compatibility', 'CallbackErrors<T, A> | PromptError<T, P, A>', 'CallbackErrors<T, A>', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['LLMAgent parent presence', '...parent: [ParentConfig] extends [never] ? [] : [parent: ConfigProvider<ParentConfig', '...parent: [] | [parent: ConfigProvider<ParentConfig', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['LLMAgent parent properties', 'UnionKeys<C> | UnionKeys<Parent>', 'UnionKeys<C>', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['LLMAgent parsed descriptor input', 'DescriptorInput<ConfigSchemas<SchemaPresence, Input, never, ToolContext>,', 'DescriptorInput<Record<never, never>,', /unknown|does not exist|implicitly has an 'any'/, 'src/factories/LLMAgent.ts'],
    ['LLMAgent completed value', 'export type CompletedOutput<O> = O extends OutputInterface ? InferGenerateOutput<O> : string;', 'export type CompletedOutput<O> = unknown;', /unknown/, 'src/types/result.ts'],
    ['LLMAgent explicit output delivery', 'type StreamValue<O> = O extends OutputInterface ? Promise<InferGenerateOutput<O>>', 'type StreamValue<O> = O extends OutputInterface ? AsyncIterable<InferGenerateOutput<O>>', /not assignable|missing the following properties/, 'src/types/result.ts'],
    ['LLMAgent native argument validation', 'args: Args & NativeValidation<Args, T, AgentCallParameters<unknown>>', 'args: Args', /Unused '@ts-expect-error'/, 'src/types/agent.ts'],
    ['LLMAgent inherited source inference', "ConfigValue<Complete, 'promptType'> extends 'function'", "P extends 'function'", /implicitly has an 'any'|Unused '@ts-expect-error'|Property 'value' does not exist/, 'src/factories/LLMAgent.ts'],
  ];
  const reviewContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/phase3-review.ts'), 'utf8')
    .replace("from 'casai'", "from './src/index.js'")
    .replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const reviewMutations = [
    ['Review native method settings', "([Unknown] extends [never] ? unknown : `Config Error: Unknown Agent call properties: '${Unknown & string}'.`)",
      'unknown', /Unused '@ts-expect-error'/, 'src/types/agent.ts'],
    ['Review hook context overrides', "context?: HookContext<T>", "context?: ContextFromConfig<T> & Partial<SchemaInputObject<ConfigValue<T, 'inputSchema'>>>",
      /error TS(2344|2367)/, 'src/types/agent.ts'],
    ['Review approval literal inference', "[0], ToolSelectionKeys | 'toolApproval'>", '[0], ToolSelectionKeys>', /error TS2345/, 'src/types/callbacks.ts'],
    ['Review run registry selections', ' & ValidateToolSelectionNames<Final>', '', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['Review undefined run inheritance', 'Changes = RunChanges<TRunConfig>', 'Changes = TRunConfig', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['Review required hook context', ': { toolsContext: ToolContexts<ToolRegistryFromConfig<T>> }', ': { toolsContext?: ToolContexts<ToolRegistryFromConfig<T>> }', /Unused '@ts-expect-error'/, 'src/types/agent.ts'],
    ['Review timeout tool names', "Exclude<TimeoutToolNames<ConfigValue<T, 'timeout'>>, `${keyof Tools & string}Ms`>", 'never', /Unused '@ts-expect-error'/, 'src/types/callbacks.ts'],
  ];
  const settingOwnershipContracts = fs.readFileSync(path.join(workspace, 'tests/LLMAgentSettings.types.ts'), 'utf8')
    .replace("from './type-safety/assert.js'", "from '../../tests/type-safety/assert.js'")
    .replaceAll("from '../src/", "from './src/");
  const settingOwnershipMutations = [
    ['Agent request setting ownership', "'asTool', 'debug', 'prepareCall'", "'asTool', 'prepareCall'", /error TS2554/, 'src/llm-agent.ts'],
    ['Agent observer setting completeness', "'onEnd', 'onChunk', 'onAbort'", "'onEnd', 'onChunk'", /error TS2554/, 'src/agent-settings-policy.ts'],
    ['Agent observer alias completeness', "onStart: 'experimental_onStart', ", '', /error TS2554/, 'src/agent-settings-policy.ts'],
    ['Agent streaming setting completeness', "'experimental_transform', 'streamRetries'", "'experimental_transform'", /error TS2554/, 'src/agent-settings-policy.ts'],
    ['Agent native setting names', "'telemetry', ...observers", "'telemetery', ...observers", /not assignable/, 'src/agent-settings-policy.ts'],
    ['Agent fixed setting names', "'loader', 'id', 'streaming', 'asTool'", "'loader', 'identity', 'streaming', 'asTool'", /error TS2554/, 'src/agent-settings-policy.ts'],
    ['Agent coded setting completeness', "'template', 'script', 'execute', 'schema'", "'template', 'script', 'execute'", /error TS2554/, 'src/agent-settings-policy.ts'],
  ];
  const factoryContracts = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Function as component } from './src/factories/Function.js';
import { Template } from './src/factories/Template.js';
import { Script } from './src/factories/Script.js';
import { Config } from './src/factories/Config.js';
import type { ConfigProvider } from './src/types/config.js';
import { Output } from 'ai';
import { z } from 'zod/v4';
declare const model: import('ai').LanguageModel;
// @ts-expect-error An implementation is required.
component({});
// @ts-expect-error Capture still validates ordinary setting values.
component({ execute: () => 1, debug: 'yes' });
// @ts-expect-error Native descriptor properties retain their SDK types.
component.asTool({ inputSchema: z.object({}), execute: () => 1, strict: 'yes' });
// @ts-expect-error Inline templates require source.
Template({});
// @ts-expect-error Inline scripts require source.
Script({});
// @ts-expect-error Parent fields cannot conceal unsupported settings.
Template({}, { config: { template: 'Answer', unknownSetting: true } });
// @ts-expect-error Parent fields cannot conceal unsupported settings.
Script({}, { config: { script: 'return 1', unknownSetting: true } });
const annotated: ConfigProvider<{ execute: () => number }> = component({ execute: () => 1 });
// @ts-expect-error An expected return type cannot replace inferred implementation output.
const wrongReturn: ConfigProvider<{ execute: () => number }> = component({ execute: () => 'text' });
const inputSchema = z.object({ value: z.string().transform(Number) });
Template.asTool({ template: '{{ value }}', inputSchema,
  onInputAvailable: ({ input }) => { const parsed: number = input.value; } });
Script.asTool({ script: 'return value', inputSchema, schema: z.number(),
  toModelOutput: ({ output }) => { const parsed: number = output; return { type: 'text', value: String(parsed) }; } });
Script({ schema: z.number() }, Config({ script: 'return 1', schema: z.string() }))().then(value => { const parsed: number = value; });
const output = Output.object({ schema: z.object({ answer: z.number() }) });
LLMAgent({ model, output, onStart: event => { const selected: typeof output | undefined = event.output; } });
LLMAgent.asStream({ model, output, onStart: event => { const selected: typeof output | undefined = event.output; } });
declare const select: boolean;
const pairedPrompt = { config: select
  ? { model, inputSchema, prompt: ({ value }: { value: number }) => value.toFixed() }
  : { model, inputSchema: z.object({ value: z.string() }), prompt: ({ value }: { value: string }) => value.toUpperCase() } };
LLMAgent.withFunction({}, pairedPrompt)({ value: '4' });
LLMAgent.withFunction.asStream({ output }, pairedPrompt)({ value: '4' });
const badPrompt = { config: select ? pairedPrompt.config : { model, inputSchema, prompt: ({ value }: { value: boolean }) => String(value) } };
// @ts-expect-error One incompatible prompt invalidates the whole selection.
LLMAgent.withFunction({}, badPrompt);
const loadedTemplate = Template.loadsTemplate({ template: 'entry', loader: { load: () => '{{ value }}' }, inputSchema });
const loadedScript = Script.loadsScript({ script: 'entry', loader: { load: () => 'return value' }, inputSchema });
const templateMode: 'async-template-name' = Template({}, Config({}, loadedTemplate)).config.promptType;
const scriptMode: 'async-script-name' = Script({}, Config({}, loadedScript)).config.promptType;
`;
  const factoryMutations = [
    ['Factory prompt branch failure', "? never : 'prompt'", '? never : never', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['Factory Function final validation', '& ValidateFinalConfig<TConfig, CallbackParent<TParentConfig>, Final, true extends EffectiveTool ? true : false>', '', /Unused '@ts-expect-error'/, 'src/factories/Function.ts'],
    ['Factory Function return inference', ') => NoInfer<EffectiveTool extends true ? ToolCallSignature<Final> : FunctionCallSignature<Final>>;', ') => EffectiveTool extends true ? ToolCallSignature<Final> : FunctionCallSignature<Final>;', /Unused '@ts-expect-error'/, 'src/factories/Function.ts'],
    ['Factory Template required settings', '& ValidateTemplateConfig<TConfig, Final, EffectiveShape>', '', /Unused '@ts-expect-error'/, 'src/factories/Template.ts'],
    ['Factory Script required settings', '& ValidateScriptConfig<TConfig, Final, EffectiveShape>', '', /Unused '@ts-expect-error'/, 'src/factories/Script.ts'],
    ['Factory Template parent validation', '& ValidateTemplateParentConfig<TParentConfig, FactoryConfig<false, true>>', '', /Unused '@ts-expect-error'/, 'src/factories/Template.ts'],
    ['Factory Script parent validation', '& ValidateScriptParentConfig<TParentConfig, FactoryConfig<false, true>>', '', /Unused '@ts-expect-error'/, 'src/factories/Script.ts'],
    ['Factory inherited schema replacement', 'MergedConfig<Parent, ResolvedConfig<Config>>', 'MergedConfig<ResolvedConfig<Config>, Parent>', /not assignable/, 'src/types/factory-config.ts'],
    ['Factory inherited source selection', "? Exclude<ConfigValue<T, 'promptType'>, undefined> extends never ? Default : Exclude<ConfigValue<T, 'promptType'>, undefined> : Explicit", '? Default : Explicit', /not assignable/, 'src/types/factory-config.ts'],
  ];
  // Exact-optional contracts are checked against freshly emitted declarations.
  const optionalContracts = `import { create, z } from './dist/index.js';
import { Output } from 'ai';
import type { TemplateConfig, ScriptConfig } from './dist/index.js';
declare const model: import('ai').LanguageModel;
const schema = z.number();
const parent = create.Config({ model, output: Output.object({ schema }) });
const template: TemplateConfig<{ value: number }> = { template: '{{ value }}' };
const script: ScriptConfig<{ value: number }, number> & { script: string } = { script: 'return value' };
create.Template.withTemplate(template);
create.Script.withScript(script);
create.Template({ template: 'Answer', inputSchema: undefined });
create.Script({ script: 'return 1', inputSchema: undefined });
const scriptParent = create.Config({ script: 'return "raw"', schema });
create.Script({ schema: undefined }, scriptParent);
create.Script.asTool({ schema: undefined, inputSchema: z.object({}) }, scriptParent);
const agent = create.LLMAgent({ output: undefined }, parent);
agent('Answer').then(result => { const text: string = result.value; });
create.LLMAgent.asStream({ output: undefined }, parent)('Answer').then(result => { const text: AsyncIterable<string> = result.value; });
agent.run({ prompt: 'Answer', temperature: undefined });
// @ts-expect-error A fixed output cannot be overridden through run.
agent.run({ prompt: 'Answer', output: undefined });
`;
  const optionalMutations = [
    ['Factory optional Script output', 'schema?: SchemaType<OUTPUT> | undefined;', 'schema?: SchemaType<OUTPUT>;', /not assignable/, 'dist/types/config.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Factory optional agent output', 'output?: OUTPUT | undefined;', 'output?: OUTPUT;', /not assignable/, 'dist/types/agent.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Factory optional Template input', 'TemplateConfig<any> & ToolContextSchemaConfig<any>', 'TemplateConfig<any> & configs.ToolConfig<any, any, any>', /Invalid template settings/, 'dist/factories/Template.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Factory optional Script input', 'ScriptConfig<any, any> & ToolContextSchemaConfig<any>', 'configs.ScriptToolConfig<any, any, any>', /Invalid script settings/, 'dist/factories/Script.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
  ];
  if (optionalMutations.some(([name]) => filter.test(name))) {
    const declarations = run(process.execPath, [compiler, ...common.filter(flag => flag !== '--noEmit'), '--declaration', '--emitDeclarationOnly',
      '--rootDir', path.join(production, 'src'), '--outDir', path.join(production, 'dist'), path.join(production, 'src/index.ts')]);
    assert.equal(declarations.status, 0, declarations.stdout + declarations.stderr);
  }
  const consumer = path.join(production, 'contracts.ts');
  for (const [contracts, cases] of [[alternatives, alternativeMutations], [check, mutations], [schemaVersions, schemaMutations], [preprocessors, preprocessorMutations], [projection, projectionMutations], [selectedSchemas, selectedMutations], [helperContracts, helperMutations], [runContexts, runContextMutations], [runDescriptorContexts, runDescriptorMutations], [callerAlternatives, callerMutations], [configuredOmissions, omissionMutations], [contextAlternatives, contextMutations], [configFactoryContracts, configFactoryMutations], [agentContracts, agentMutations], [reviewContracts, reviewMutations], [settingOwnershipContracts, settingOwnershipMutations], [factoryContracts, factoryMutations], [optionalContracts, optionalMutations]]) {
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
  const registryWorkload = `import { LLMAgent } from './src/factories/LLMAgent.js';
import { Output } from 'ai';
import { Function as component } from './src/factories/Function.js';
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
