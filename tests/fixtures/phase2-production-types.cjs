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
  fs.writeFileSync(path.join(production, 'source-modes.ts'), fs.readFileSync(path.join(workspace, 'tests/fixtures/source-modes.ts'), 'utf8').replace("from 'casai'", "from './src/index.js'"));
  fs.writeFileSync(path.join(production, 'dist-source-modes.ts'), fs.readFileSync(path.join(workspace, 'tests/fixtures/source-modes.ts'), 'utf8').replace("from 'casai'", "from './dist/index.js'"));
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
const numericOutput = Output.object({ schema: z.object({ value: z.number() }) });
declare const alternativeAgentConfig: { model: LanguageModel; prompt: string; output: typeof numericOutput }
  | { model: LanguageModel; prompt: string };
LLMAgent(alternativeAgentConfig)().then(result => {
  const textOrObject: string | { value: number } = result.output;
  // @ts-expect-error A whole configuration alternative can select a structured output.
  const onlyText: string = result.output;
});
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
      "InvalidToolContexts<TConfig, PartialConfig extends boolean = false> = unknown extends unknown", /toolsContext is missing or invalid for tool 'lookup'/, "src/types/tool-binding.ts",
      'const admitted: ValidateToolsContext<typeof pairedContexts> = pairedContexts;', false],
    ['nested registry alternatives', "TTools extends unknown ? TContexts extends unknown ? {", "unknown extends unknown ? TContexts extends unknown ? {",
      /Unused '@ts-expect-error'/, "src/types/tool-binding.ts", 'const admitted: ValidateToolsContext<{ tools: typeof nestedRegistry }> = { tools: nestedRegistry };'],
    ['branch-only descriptor hooks', 'DescriptorErrors<Final, R> = Final extends unknown', 'DescriptorErrors<Final, R> = unknown extends unknown',
      /Unused '@ts-expect-error'/, 'src/types/callbacks.ts', 'const admitted: ValidateDescriptor<HookReplacement, FinalHook, string> = {};'],
    ['branch-only Function contracts', 'FunctionConfigChecks<Final, Explicit extends boolean> = Final extends unknown',
      'FunctionConfigChecks<Final, Explicit extends boolean> = unknown extends unknown', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts',
      'const admitted: ValidateFinalConfig<HookReplacement, FinalHook, true> = {};'],
    ['branch-only lifecycle callbacks', 'Callbacks = T extends unknown ? CallbackErrors<T, A> | PromptError', 'Callbacks = T extends unknown ? PromptError',
      /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts', 'LLMAgent({ output: numberOutput }, { config: lifecycleConfig });'],
    ['Function final forbidden keys', "FinalConfigCheck<Final, Expected, Unknown = Exclude<UnionKeys<Final>, keyof Expected | 'asTool'>", 'FinalConfigCheck<Final, Expected, Unknown = never',
      /Unused '@ts-expect-error'/, 'src/types/config-validation.ts', 'const admitted: ValidateFinalConfig<typeof forbiddenConfig, typeof forbiddenConfig> = {};'],
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
    ['inherited configuration alternatives', 'Parent extends unknown ? keyof Parent extends never ? Data', 'unknown extends unknown ? keyof Parent extends never ? Data',
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
    ['run context validation', '& ValidateToolsContext<TRunConfig, Final>',
      '', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['completed helper output', "ComponentHelper<BoundHelperConfig<TConfig, TBoundContext>, TResult>", "ComponentHelper<BoundHelperConfig<TConfig, TBoundContext>, import('./result.js').CollectedResult<TConfig>>",
      /Type 'unknown' is not assignable to type 'string'/, "src/types/tool-binding.ts"],
    ['internal binding compatibility', "ValidateToolBinding<TConfig, TContext> : unknown", "unknown : unknown",
      /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['run helper input and defaults', "Pick<TAfter, Extract<K, keyof TAfter>> extends Pick<TBefore, K> ? never : K", "never",
      /Unused '@ts-expect-error'/, "src/types/tool-binding.ts"],
    ['stale callback helpers', "DistributiveOmit<CallbackContextFromConfig<TConfig>, NamedKeys<TDefaults> | '_toolOptions' | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>>>", "DistributiveOmit<CallbackContextFromConfig<TConfig>, NamedKeys<TDefaults> | '_toolOptions'>",
      /Unused '@ts-expect-error'/, "src/types/execution.ts"],
    ['conditional output schema', "TOutputSchema = ConfigValue<TConfig, 'schema'>> = TOutputSchema extends FlexibleSchema<unknown>", "TOutputSchema = ConfigValue<TConfig, 'schema'>> = ConfigValue<TConfig, 'schema'> extends FlexibleSchema<unknown>",
      /Unused '@ts-expect-error'/, "src/types/result.ts"],
    ['complete omitted input', "CanInvokeComponent<ComponentInput<TAlternative, TInputSchema>, ContextFromConfig<TAlternative>, EmptyMap, SchemaInputNames<TInputSchema>, HasClosedSchema<TInputSchema>>",
      "EmptyMap extends ComponentInputShape<TAlternative> ? true : false", /Unused '@ts-expect-error'/, "src/types/component-input.ts"],
    ['conditional private ownership', "ReservedInputNames<undefined extends TInputSchema ? undefined : TInputSchema,",
      "ReservedInputNames<TInputSchema,", /Unused '@ts-expect-error'/, "src/types/component-input.ts"],
    ['conditional input inference', '? Record<K, S> : Partial<Record<K, S | undefined>>',
      '? Partial<Record<K, S | undefined>> : Partial<Record<K, S | undefined>>', /error TS/, 'src/types/factory-config.ts'],
    ['optional schema presence', "[K in keyof Selected]: K extends 'inputSchema' ? Input : K extends 'schema' ? Output : K extends 'toolContextSchema' ? Context", "[K in keyof Selected]-?: K extends 'inputSchema' ? Input : K extends 'schema' ? Output : K extends 'toolContextSchema' ? Context",
      /Unused '@ts-expect-error'/, 'src/types/factory-config.ts'],
    ['provisional constraint identity', 'typeof provisionalConfig extends keyof TConfig',
      'object extends TConfig', /Unused '@ts-expect-error'/, 'src/types/provisional.ts'],
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
    ['tool factory projection admission', '& ToolInputAdmission<Final> & ToolOutputAdmission<Final>',
      '& ToolOutputAdmission<Final>', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
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
    ['correlated inherited callback inference', 'Parent extends unknown ? keyof Parent extends never ? Data',
      'unknown extends unknown ? keyof Parent extends never ? Data', /not assignable/, 'src/types/function-config.ts'],
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
    ['provided argument keys', 'first: First & (Partial<Record<K, unknown>> | Exclude<NonContextArgument, (...args: never[]) => unknown>)', 'first: First', /Parameter 'value' implicitly has an 'any' type/, 'src/types/input.ts'],
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
    ['conditional renderer omission', 'PreparedSourceArguments<T, string, [T] extends [Record<Main<K>, string>] ? true : false>', 'T extends unknown ? PreparedSourceArguments<T, string, T extends Record<Main<K>, string> ? true : false> : never', /Unused '@ts-expect-error'/, 'src/types/component.ts'],
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
const loaders: import('cascada-engine').LoaderGroup = loaderChild.config.loader;
const described: import('./src/types/config.js').ConfigProvider<{ description: string }> = Config({ description: 'Shared' });
// @ts-expect-error Return-driven inference must not invent configuration fields.
const invented: { config: { context: { missing: true } } } = Config({ context: { present: 1 } });
const lookup = tool({ inputSchema: z.object({ query: z.string() }), execute: ({ query }) => query.length });
Config({ tools: { lookup }, onEnd: (event: { text: string }) => { const text: string = event.text; } });
`;
  const configFactoryResult = fs.readFileSync(path.join(production, 'src/factories/Config.ts'), 'utf8')
    .match(/\) => NoInfer<configs\.ConfigProvider<[^;]+;/)?.[0];
  assert.ok(configFactoryResult, 'Config return-inference barrier');
  const configFactoryMutations = [
    ['Config object constraint', 'TConfig extends object & configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>',
      'TConfig extends configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config parent validation', '[TParentConfig] extends [configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>]',
      'unknown extends unknown', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config absent parent default', 'TParent extends configs.ConfigProvider<object> = never',
      'TParent extends configs.ConfigProvider<object> = configs.ConfigProvider<EmptyMap>', /Expected 2 arguments, but got 1/, 'src/factories/Config.ts'],
    ['Config parent presence', '...parent: [TParent] extends [never] ? [] : [parent: TParent',
      '...parent: [] | [parent: TParent', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config merged validation', 'ValidateConfigFragment<Modified<ResolvedConfig<TConfig>, P, A, S>, Final,',
      'ValidateConfigFragment<Modified<ResolvedConfig<TConfig>, P, A, S>, TConfig,', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config parent return inference', configFactoryResult,
      configFactoryResult.replace('NoInfer<', '').replace('>>;', '>;'), /Unused '@ts-expect-error'|not assignable|Expected 2 arguments, but got 1/, 'src/factories/Config.ts'],
    ['Config inherited result', ': MergedConfig<TParentConfig, ResolvedConfig<TConfig>>',
      ': ProcessedConfig<ResolvedConfig<TConfig>>', /Property 'offset' does not exist/, 'src/factories/Config.ts'],
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
enumeration('Answer').then(result => { const value: 'YES' | 'NO' = result.output; });
LLMAgent({ model, output })('Answer').then(result => { const value: number = result.output.answer; });
LLMAgent.asStream({ model, output })('Answer').then(result => { const value: PromiseLike<{ answer: number }> = result.output; });
LLMAgent.asStream({ model })('Answer').then(result => { const value: AsyncIterable<string> = result.textStream; });
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
const tool = LLMAgent.withTemplate.asTool({ model, inputSchema, prompt: '{{ value }}' });
const inheritedTool = LLMAgent({}, Config({}, tool));
// @ts-expect-error Tools are generation-only.
inheritedTool.config.streaming;
const descriptor: import('ai').Tool = inheritedTool;
// @ts-expect-error Inherited tools retain the separate tool interface.
inheritedTool.generate({ prompt: 'Answer' });
`;
  const agentMutations = [
    ['LLMAgent required model', 'Required = Missing<T, AgentRequiredSettings<P, A>>', 'Required = never', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['LLMAgent retained prompt compatibility', 'CallbackErrors<T, A> | PromptError<T, P, A>', 'CallbackErrors<T, A>', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['LLMAgent parent presence', '...parent: [Parent] extends [never] ? [] : [parent: Parent', '...parent: [] | [parent: Parent', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['LLMAgent parent properties', 'Unknown = Exclude<UnionKeys<T>, keyof AgentFactoryShape<P, A>>', 'Unknown = Exclude<UnionKeys<C>, keyof AgentFactoryShape<P, A>>', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['LLMAgent parsed descriptor input', 'DescriptorInput<ConfigSchemas<SchemaPresence, Input, never, ToolContext>,', 'DescriptorInput<Record<never, never>,', /unknown|does not exist|implicitly has an 'any'/, 'src/factories/LLMAgent.ts'],
    ['LLMAgent completed value', 'export type CompletedOutput<O> = O extends OutputInterface ? InferGenerateOutput<O> : string;', 'export type CompletedOutput<O> = unknown;', /unknown/, 'src/types/result.ts'],
    // Output delivery now belongs to native SDK result types; the positive assertions above retain that contract.
    ['LLMAgent native argument validation', 'args: Args & NativeValidation<Args, T, AgentCallParameters<unknown>>', 'args: Args', /Unused '@ts-expect-error'/, 'src/types/agent.ts'],
    ['LLMAgent inherited source inference', "ConfigValue<Complete, typeof sourceMode> extends 'function'", "P extends 'function'", /implicitly has an 'any'|Unused '@ts-expect-error'|Property 'value' does not exist/, 'src/factories/LLMAgent.ts'],
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
    ['Agent request setting ownership', "'asTool', 'debug', 'prepareCall'", "'asTool', 'prepareCall'", /error TS2554/, 'src/runtime/llm-agent.ts'],
    ['Agent observer setting completeness', "'onEnd', 'onChunk', 'onAbort'", "'onEnd', 'onChunk'", /error TS2554/, 'src/runtime/agent-settings-policy.ts'],
    ['Agent observer alias completeness', "onStart: 'experimental_onStart', ", '', /error TS2554/, 'src/runtime/agent-settings-policy.ts'],
    ['Agent streaming setting completeness', "'experimental_transform', 'streamRetries'", "'experimental_transform'", /error TS2554/, 'src/runtime/agent-settings-policy.ts'],
    ['Agent native setting names', "'telemetry', ...observers", "'telemetery', ...observers", /not assignable/, 'src/runtime/agent-settings-policy.ts'],
    ['Agent fixed setting names', "'loader', 'id', 'streaming', 'asTool'", "'loader', 'identity', 'streaming', 'asTool'", /error TS2554/, 'src/runtime/agent-settings-policy.ts'],
    ['Agent coded setting completeness', "'template', 'script', 'execute', 'schema'", "'template', 'script', 'execute'", /error TS2554/, 'src/runtime/agent-settings-policy.ts'],
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
import { sourceMode } from './src/config/source-mode.js';
const loadedTemplate = Template.loadsTemplate({ template: 'entry', loader: { load: () => '{{ value }}' }, inputSchema });
const loadedScript = Script.loadsScript({ script: 'entry', loader: { load: () => 'return value' }, inputSchema });
const templateMode: 'async-template-name' = Template({}, Config({}, loadedTemplate)).config[sourceMode];
const scriptMode: 'async-script-name' = Script({}, Config({}, loadedScript)).config[sourceMode];
`;
  const factoryMutations = [
    ['Factory prompt branch failure', "ReturnType<NonNullable<PromptCallback<T, A>['prompt']>>) | undefined } ? never : 'prompt'",
      "ReturnType<NonNullable<PromptCallback<T, A>['prompt']>>) | undefined } ? never : never", /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['Factory Function final validation', '& ValidateFinalConfig<TConfig, Final, AsTool>', '', /Unused '@ts-expect-error'/, 'src/factories/Function.ts'],
    ['Factory Function return inference', ') => NoInfer<EffectiveTool extends true ? ToolCallSignature<Final, ToolConfig> : FunctionCallSignature<Final>>;', ') => EffectiveTool extends true ? ToolCallSignature<Final, ToolConfig> : FunctionCallSignature<Final>;', /Unused '@ts-expect-error'/, 'src/factories/Function.ts'],
    ['Factory renderer required settings', '& (RendererConfigChecks<K, TConfig, Final> extends (check: infer Check) => void ? Check : never)', '', /Unused '@ts-expect-error'/, 'src/factories/component-factory.ts'],
    ['Factory inherited schema replacement', 'MergedConfig<Parent, ResolvedConfig<Config>>', 'MergedConfig<ResolvedConfig<Config>, Parent>', /not assignable/, 'src/types/factory-config.ts'],
    ['Factory inherited source selection', "? Exclude<ConfigValue<T, typeof sourceMode>, undefined> | (undefined extends ConfigValue<T, typeof sourceMode> ? Default : never) : Explicit", '? Default : Explicit', /not assignable/, 'src/types/factory-config.ts'],
  ];
  const unificationContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/component-unification.ts'), 'utf8')
    .replace("from 'casai'", "from './src/index.js'");
  const unificationMutations = [
	['Component interface contexts', 'type ContextValue<T> = [ContextObject<T>] extends [never] ? EmptyMap : ContextObject<T>;', 'type ContextValue<T> = T extends Record<string, unknown> ? T : EmptyMap;', /not assignable|Unused '@ts-expect-error'/, 'src/types/input.ts'],
	['Component supplied context keys', 'CallContextKeys<[First, ...Rest], Keys, ObjectSource>', 'never', /not assignable/, 'src/types/component.ts'],
	['Component callback overloads', "([P] extends ['text'] ? unknown : CallSignature<K, P, T, Cases, Allowed, ObjectSource, ComponentInputShape<T>>)", 'unknown', /not assignable/, 'src/types/component.ts'],
    ['Component fixed invocation types', "Main<K> | DefinitionKeys<K, 'fixedSettings'>", 'Main<K>', /Unused '@ts-expect-error'/, 'src/types/component.ts'],
    ['Component configured source tails', 'ContextTail<T, ConfiguredTail, true>', 'ContextTail<T, Tail, true>', /not assignable|No overload matches|Expected/, 'src/types/input.ts'],
    ['Component positional roles', 'ValidateArgumentValue<Args[0], Allowed[0], Roles> & ValidateArgumentValue<Args[1], Allowed[1], Roles>', 'unknown', /Unused '@ts-expect-error'/, 'src/types/input.ts'],
  ];
  const phase5Contracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/component-review.ts'), 'utf8')
    .replace("from 'casai'", "from './src/index.js'").replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const phase5Mutations = [
    ['Phase5 voice tool bindings', '& NoInfer<ValidateToolsContext<Options, MergedConfig<T, Options>>>', '', /Unused '@ts-expect-error'/, 'src/factories/VoiceSessionSetup.ts'],
    ['Phase5 preparer helper ownership', "import('./config.js').CallbackFromConfig<TConfig>", "ConfigValue<TConfig, 'execute'> | ConfigValue<TConfig, 'prompt'>", /Unused '@ts-expect-error'/, 'src/types/tool-binding.ts'],
    ['Phase5 empty child validation', '[Keys] extends [never] ? EmptyMap : C', 'C', /Unused '@ts-expect-error'/, 'src/factories/component-factory.ts'],
    ['Phase5 context and format roles', 'CanOmitComponentInput<T> extends true ? WithoutContext<Tail> : never', 'CanOmitComponentInput<T> extends true ? Tail : never', /Unused '@ts-expect-error'/, 'src/types/input.ts'],
    ['Phase5 complete producer guarantee', '[Input] extends [QueryDocuments] ? false : true', '[Extract<Input, QueryDocuments>] extends [never] ? true : false', /Unused '@ts-expect-error'/, 'src/factories/Reranker.ts'],
    ['Phase5 complete replacement shorthand', '=> QueryDocuments | PromiseLike<QueryDocuments>, false,', '=> never, false,', /No overload matches|not assignable/, 'src/factories/Reranker.ts'],
    ['Phase5 native callback context', 'settings: Settings<RuntimeContextFromConfig<T>>;', 'settings: Settings;', /Expected 1 arguments|not assignable/, 'src/factories/Embedder.ts'],
    ['Phase5 optional callback runtime context', "Pick<{ [Key in keyof RuntimePresence]: Runtime }, keyof RuntimePresence & 'runtimeContext'>", '{ runtimeContext: Runtime }', /Expected 1 arguments|not assignable/, 'src/factories/component-factory.ts'],
    ['Phase5 fragment preparer context', 'ConfigPreparerContext<Inferred,', 'ConfigPreparerContext<EmptyMap,', /Expected 1 arguments|not assignable/, 'src/factories/Config.ts'],
    ['Phase5 inherited callback contract', 'Pick<T, NativeCallbackKeys<K> & keyof T> extends NativeCallbacks<K, T>', 'EmptyMap extends NativeCallbacks<K, T>', /Unused '@ts-expect-error'/, 'src/factories/component-factory.ts'],
    ['Phase5 resolved private bindings', "NamedKeys<TDefaults> | '_toolOptions' | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>>", "'_toolOptions' | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>>", /Unused '@ts-expect-error'|Property 'toFixed'|Expected 1 arguments/, 'src/types/execution.ts'],
    ['Phase5 required plain tool input', '[ToolInput<K, P, T>] extends [ToolInputs<T>[K]]', '[Exclude<ToolInput<K, P, T>, undefined>] extends [ToolInputs<T>[K]]', /Unused '@ts-expect-error'/, 'src/factories/component-factory.ts'],
    ['Phase5 declared tool source', "Main<K> extends SchemaInputNames<ConfigValue<T, 'inputSchema'>>", 'true extends true', /Unused '@ts-expect-error'/, 'src/types/component.ts'],
    ['Phase5 native alias fragments', '| Parameters<typeof embedMany>[0] | Parameters<typeof rerank>[0]', '', /Expected 1 arguments|not assignable/, 'src/types/callbacks.ts'],
    ['Phase5 final native settings', '[T] extends [InferShape<K, undefined, A>]', 'unknown extends unknown', /Unused '@ts-expect-error'/, 'src/factories/component-factory.ts'],
    ['Phase5 replaced native settings', "\tParent extends ConfigProvider<object> = never,", "\tParent extends ConfigProvider<NoInfer<InferShape<K, undefined, A>>> = never,", /not assignable/, 'src/factories/component-factory.ts'],
    ['Phase5 final agent settings', "[T] extends [Omit<InferShape<P, A>, 'prompt'>]", 'unknown extends unknown', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
  ];
  const configModifierContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/config-modifiers.ts'), 'utf8')
    .replaceAll("from 'casai'", "from './src/index.js'").replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const configModifierMutations = [
    ['Config modifier source fields', "Pick<T, keyof T & import('./component.js').Main<K>> extends Partial<Record<import('./component.js').Main<K>, import('./component.js').Source<K, P> | undefined>>", 'true extends true', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['Config modifier source alternatives', "T extends unknown ? [keyof T & import('./component.js').Main<SourceKind>] extends [never] ? never : InvalidSourceModes<T> : never;", "[keyof T & import('./component.js').Main<SourceKind>] extends [never] ? never : InvalidSourceModes<T>;", /not assignable/, 'src/types/config-validation.ts'],
    ['Config modifier inherited source', 'InvalidFragmentSources<TFinalConfig>', "InvalidFragmentSources<import('./provisional.js').ResolvedConfig<TConfig>>", /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['Config modifier annotated source', "& AnnotatedSourceMode<PromptType, 'text'>", '', /Unused '@ts-expect-error'/, 'src/types/agent.ts'],
    ['Config modifier annotated Template', "TemplateSettings<INPUT> & AnnotatedSourceMode<TemplatePromptType, 'async-template'>", 'TemplateSettings<INPUT>', /Unused '@ts-expect-error'/, 'src/types/config.ts'],
    ['Config modifier annotated Script', "ScriptSettings<INPUT, OUTPUT> & AnnotatedSourceMode<ScriptPromptType, 'async-script'>", 'ScriptSettings<INPUT, OUTPUT>', /Unused '@ts-expect-error'/, 'src/types/config.ts'],
    ['Config modifier copied replacement', 'CallbackConfigShape<Partial<Omit<Shape<K, undefined, A>, Main<K>>>>', 'CallbackConfigShape<Partial<Omit<Shape<K, P, A>, Main<K>>>>', /not assignable/, 'src/factories/component-factory.ts'],
    ['Config modifier renderer replacement', 'SourceModeSetting<PromptType | undefined>;', 'SourceModeSetting<AllowedMode<K> | undefined>;', /not assignable/, 'src/factories/component-factory.ts'],
    ['Config modifier native field role', ' | NonSourceValue<K>', '', /not assignable/, 'src/types/factory-config.ts'],
    ['Config modifier Function parent', "TParent & NoInfer<[TParentConfig] extends [FactoryConfig]\n\t\t? unknown : 'Config Error: Invalid parent configuration.'>", 'TParent', /Unused '@ts-expect-error'/, 'src/factories/Function.ts'],
    ['Config modifier resolved empty child', 'Modified<ResolvedConfig<TConfig>, P, A, S>, Final,', 'Modified<TConfig, P, A, S>, Final,', /Unused '@ts-expect-error'/, 'src/factories/Config.ts'],
    ['Config modifier copied fragment replacement', 'Modified<ResolvedConfig<TConfig>, P, A, S>, Final,', 'ResolvedConfig<TConfig>, Final,', /not assignable/, 'src/factories/Config.ts'],
  ];
  const modeContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/mixed-source-modes.ts'), 'utf8')
    .replaceAll("from 'casai'", "from './src/index.js'").replace("from '../fixtures/source-modes.js'", "from './source-modes.js'").replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const modeMutations = [
    ['Mode renderer alternatives', 'RendererConfigChecks<K extends RendererKind, Config, Final> = Final extends unknown', 'RendererConfigChecks<K extends RendererKind, Config, Final> = true extends true', /not assignable|Unused '@ts-expect-error'/, 'src/factories/component-factory.ts'],
    ['Mode common inputs', '{ [K in keyof T]: (input: T[K]) => void }[keyof T] extends (input: infer Input) => void ? Input : never', 'T[keyof T]', /Unused '@ts-expect-error'/, 'src/types/input.ts'],
    ['Mode positional contracts', "false extends ValidCall<M, Cases[M]['arguments'], First, Rest>", 'false extends true', /Unused '@ts-expect-error'/, 'src/types/component.ts'],
    ['Mode native object roles', ' | URL | ArrayBuffer | ArrayBufferView | Iterable<unknown> | AsyncIterable<unknown> | ReadableStream<unknown>;', ' | readonly unknown[];', /Unused '@ts-expect-error'/, 'src/types/component.ts'],
    ['Mode branch contexts', 'ValidateComponentInput<ConfigForMode<T, M, P>, CallContext<[First, ...Rest], ObjectSource>', 'ValidateComponentInput<T, CallContext<[First, ...Rest], ObjectSource>', /not assignable/, 'src/types/component.ts'],
    ['Mode omitted default', "? Exclude<ConfigValue<T, typeof sourceMode>, undefined> | (undefined extends ConfigValue<T, typeof sourceMode> ? Default : never) : Explicit", "? Exclude<ConfigValue<T, typeof sourceMode>, undefined> extends never ? Default : Exclude<ConfigValue<T, typeof sourceMode>, undefined> : Explicit", /Unused '@ts-expect-error'|Expected 1 arguments/, 'src/types/factory-config.ts'],
    ['Mode final source contracts', '(ConfigChecks<K, P, T, C, A> extends (checks: infer Checks) => void ? Checks : never)', 'ValidateBranch<K, P, T, C, A>', /Unused '@ts-expect-error'|not assignable/, 'src/factories/component-factory.ts'],
    ['Mode final agent contracts', '(ConfigChecks<C, T, P, A> extends (checks: infer Checks) => void ? Checks : never)', 'ValidateBranch<C, T, P, A>', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['Mode Config selected source', 'P extends undefined ? T : WithoutSourceMode<T> & ResolvedSourceMode<P>', 'T', /not assignable|Unused '@ts-expect-error'|Expected 1 arguments/, 'src/factories/Config.ts'],
    ['Mode agent positional contracts', "& ComponentCallSignature<AgentArguments<T, P>, Promise<AgentResult<T>>, 'agent', T, ArgumentCases<T, P>>", "& ComponentCallSignature<AgentArguments<T, P>, Promise<AgentResult<T>>, 'agent', T>", /Unused '@ts-expect-error'/, 'src/types/agent.ts'],
    ['Mode tool result correlation', ': ConfiguredOutput<K, M, ConfigForMode<T, M, P>>', ': ConfiguredOutput<K, M, T>', /Expected 1 arguments/, 'src/types/component.ts'],
  ];
  const callContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/component-calls.ts'), 'utf8')
    .replaceAll("from 'casai'", "from './src/index.js'").replace("from '../fixtures/source-modes.js'", "from './source-modes.js'").replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const callMutations = [
    ['Call ranked document placeholders', "Call extends [unknown?, ...infer Rest]\n\t\t? Extract<Call[0], unknown[]> | (Exclude<Call[0], unknown[]> extends never ? never : Rest extends [] ? undefined : CallDocuments<Rest>)\n\t\t: undefined", "[Extract<Call[number], unknown[] | undefined>] extends [never] ? undefined : Extract<Call[number], unknown[] | undefined>", /not assignable/, 'src/factories/Reranker.ts'],
    ['Call ranked alternative roles', 'Exclude<Call[0], unknown[]> extends never ? never : Rest extends [] ? undefined : CallDocuments<Rest>', '[Extract<Call[0], unknown[]>] extends [never] ? Rest extends [] ? undefined : CallDocuments<Rest> : never', /Expected 1 arguments|Unused '@ts-expect-error'/, 'src/factories/Reranker.ts'],
    ['Call binary context selection', 'NonArrayObject<Exclude<T, URL | ArrayBuffer | ArrayBufferView>>', 'NonArrayObject<T>', /not assignable/, 'src/types/input.ts'],
    ['Call binary key capture', 'Partial<Record<Keys, unknown>> | Exclude<SourceArgumentRoles, (...args: never[]) => unknown> | undefined', 'Partial<Record<Keys, unknown>> | undefined', /not assignable/, 'src/types/component.ts'],
    ['Call preparer inference', "& ([P] extends ['function'] ? SourceCalls<K, P, T, Cases, Allowed, ObjectSource> extends (signature: infer Signature) => void ? Signature : never : unknown)", '', /not assignable/, 'src/types/component.ts'],
  ];
  const payloadContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/claude-review.ts'), 'utf8')
    .replaceAll("from 'casai'", "from './src/index.js'").replace("from '../fixtures/source-modes.js'", "from './source-modes.js'").replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const payloadMutations = [
    ['Payload call validation', '? ValidateComponentInput<ConfigForMode<T, M, P>, CallContext<[First, ...Rest]>, CallContextKeys<[First, ...Rest], Keys>> : unknown', '? unknown : unknown', /Unused '@ts-expect-error'/, 'src/types/component.ts'],
    ['Payload parsed result', "true extends ConfigValue<T, 'asTool'> ? PlainToolInput<K, T> : never", "true extends ConfigValue<T, 'asTool'> ? ConfiguredOutput<K, 'text', T> : never", /Expected 1 arguments/, 'src/types/component.ts'],
    ['Payload optional tool result', "true extends ConfigValue<T, 'asTool'> ? PlainToolInput<K, T> : never", "[T] extends [{ asTool: true }] ? PlainToolInput<K, T> : never", /Expected 1 arguments/, 'src/types/component.ts'],
    ['History positional roles', 'ValidateArgumentValue<Args[0], Allowed[0], Roles> & ValidateArgumentValue<Args[1], Allowed[1], Roles>', 'unknown', /Unused '@ts-expect-error'/, 'src/types/input.ts'],
    ['History source union calls', "& ComponentCallSignature<AgentArguments<T, P>, Promise<AgentResult<T>>, 'agent', T, ArgumentCases<T, P>>", "& import('./input.js').ComponentCall<AgentArguments<T, P>, Promise<AgentResult<T>>, 'agent', T, ArgumentCases<T, P>>", /No overload matches|not assignable/, 'src/types/agent.ts'],
  ];
  const annotationContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/component-map.ts'), 'utf8')
    .replace("from 'casai'", "from './src/index.js'").replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const annotationMutations = [
    ['Annotation ordinary tool mode', '[sourceMode]?: P;', '[sourceMode]?: P; asTool?: true;', /not assignable/, 'src/types/component.ts'],
  ];
  const loopContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/component-loop-review.ts'), 'utf8')
    .replaceAll("from 'casai'", "from './src/index.js'").replace("from '../fixtures/source-modes.js'", "from './source-modes.js'").replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const loopMutations = [
    ['Loop readonly decision state', "Extract<Settings['state'], string | readonly unknown[]>", "string | import('ai').Experimental_DecisionStatePart[]", /not assignable/, 'src/factories/Decision.ts'],
    ['Loop native source unions', 'Exclude<SourceArgumentRoles, (...args: never[]) => unknown>', 'ArrayBuffer | ArrayBufferView', /not assignable/, 'src/types/component.ts'],
    ['Loop source callback inference', 'Exclude<SourceArgumentRoles, (...args: never[]) => unknown>', 'SourceArgumentRoles', /implicitly has an 'any' type|not assignable|No overload matches/, 'src/types/component.ts'],
    ['Loop configured result alternatives', 'Call = undefined> = K extends unknown ? T extends unknown ? Call extends unknown', 'Call = undefined> = K extends unknown ? true extends true ? Call extends unknown', /Expected 1 arguments|not assignable/, 'src/types/component.ts'],
    ['Loop invocation result alternatives', 'T extends unknown ? Call extends unknown\n\t? Results', 'T extends unknown ? true extends true\n\t? Results', /Expected 1 arguments|not assignable/, 'src/types/component.ts'],
    ['Loop tool result alternatives', 'T extends unknown ? ToolResults<T, ToolInput<K, P, T>>[K]', 'true extends true ? ToolResults<T, ToolInput<K, P, T>>[K]', /Expected 1 arguments|not assignable/, 'src/types/component.ts'],
    ['Loop prepared source roles', 'First extends Source<K, P>', 'First extends string | unknown[] | ((...args: any[]) => any)', /Expected 1 arguments|not assignable/, 'src/types/component.ts'],
    ['Loop optional tool admission', 'true extends A ? ToolAllowed<K, P>', 'A extends true ? ToolAllowed<K, P>', /Unused '@ts-expect-error'/, 'src/factories/component-factory.ts'],
    ['Loop branch tool admission', 'Validate<K, M, Complete, [Keys] extends [never] ? EmptyMap : C, A>', 'Validate<K, M, Complete, [Keys] extends [never] ? EmptyMap : C, AsTool>', /not assignable/, 'src/factories/component-factory.ts'],
    ['Loop configured callback mode', "Parameters<Source<K, 'function', T, ToolMode<T, A>>>", "Parameters<Source<K, 'function', T, A>>", /Expected 1 arguments|not assignable|Unused '@ts-expect-error'/, 'src/factories/component-factory.ts'],
    ['Loop sticky optional modifiers', 'SpreadValue<A, B, K> | Extract<Value<A, K> | Value<B, K>, true>', 'SpreadValue<A, B, K>', /Expected 1 arguments|not assignable|Unused '@ts-expect-error'/, 'src/types/merge.ts'],
    ['Loop ordinary replacement source', 'PreparedSourceArguments<T, Source<K, P, T>,', 'PreparedSourceArguments<T, Source<K, P, T, true>,', /Expected 1 arguments|not assignable|No overload matches/, 'src/types/component.ts'],
    ['Loop ordinary named source', 'HasSource extends true ? Partial<Record<Main<K>, Source<K, P, T>>>', 'HasSource extends true ? Partial<Record<Main<K>, Source<K, P, T, true>>>', /Expected 1 arguments|not assignable/, 'src/types/component.ts'],
    ['Loop ordinary agent source', '(context: ExecutionContext<T>) => PromptValue', '(context: ToolExecutionContext<T>) => PromptValue', /not assignable|No overload matches/, 'src/types/agent.ts'],
    ['Loop ordinary agent hooks', '& AgentRunSource<T, P> & AgentCallbacks<T>', '& AgentRunSource<T, P> & AgentCallbacks<T, true>', /Expected 1 arguments|not assignable/, 'src/types/agent.ts'],
    ['Loop complete preparer inference', "SourceCalls<K, P, T, Cases, Allowed, ObjectSource> extends (signature: infer Signature) => void ? Signature : never", "CallSignature<K, P, T, Cases, Allowed, ObjectSource, Extract<Allowed[0], (...args: never[]) => unknown>>", /Expected 1 arguments|not assignable|No overload matches/, 'src/types/component.ts'],
  ];
  const toolModeContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/component-tool-mode-review.ts'), 'utf8')
    .replaceAll("from 'casai'", "from './src/index.js'").replace("from '../fixtures/source-modes.js'", "from './source-modes.js'").replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const toolModeMutations = [
    ['Tool mode Function admission', '& ToolInputAdmission<Final> & ToolOutputAdmission<Final>', '', /Unused '@ts-expect-error'/, 'src/types/config-validation.ts'],
    ['Tool mode agent admission', 'true extends A ? ToolInputAdmission<T>', 'A extends true ? ToolInputAdmission<T>', /Unused '@ts-expect-error'/, 'src/factories/LLMAgent.ts'],
    ['Tool mode descriptor selection', '? Mode extends ToolMode<T, false> ? T : never : never', '? T : never', /Expected 1 arguments|not assignable/, 'src/types/factory-config.ts'],
    ['Tool mode native methods', ': AgentMethods<AgentConfig>', ': AgentMethods<T>', /Expected 1 arguments|not assignable/, 'src/types/agent.ts'],
    ['Tool mode absent source result', "S> = [S] extends [never] ? never : P extends 'function'", "S> = P extends 'function'", /Expected 1 arguments|not assignable/, 'src/types/component.ts'],
  ];
  const clearingContracts = phase5Contracts.replace("from './src/index.js'", "from './dist/index.js'");
  const clearingMutations = [
    ['Clearing source configuration', 'Pick<T, Main<K> & keyof T> extends Partial<Record<Main<K>, Source<K, P, T, A> | undefined>>', 'Pick<T, Main<K> & keyof T> extends Partial<Record<Main<K>, Source<K, P, T, A>>>', /not assignable/, 'dist/factories/component-factory.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Clearing native callbacks', 'OptionalUndefined<Partial<Pick<Settings, Extract<keyof Settings, NativeCallbackKeys<K>>>>>', 'Partial<Pick<Settings, Extract<keyof Settings, NativeCallbackKeys<K>>>>', /not assignable/, 'dist/factories/component-factory.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
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
agent('Answer').then(result => { const text: string = result.text; });
create.LLMAgent.asStream({ output: undefined }, parent)('Answer').then(result => { const text: AsyncIterable<string> = result.textStream; });
agent.run({ prompt: 'Answer', temperature: undefined });
// @ts-expect-error A fixed output cannot be overridden through run.
agent.run({ prompt: 'Answer', output: undefined });
`;
  const optionalMutations = [
    ['Factory optional Script output', 'schema?: SchemaType<OUTPUT> | undefined;', 'schema?: SchemaType<OUTPUT>;', /not assignable/, 'dist/types/config.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Factory optional agent output', 'output?: OUTPUT | undefined;', 'output?: OUTPUT;', /not assignable/, 'dist/types/agent.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Factory optional Template input', 'Template: configs.TemplateSettings<Record<string, any>>;', 'Template: configs.TemplateToolSettings<Record<string, any>>;', /Types of property 'inputSchema' are incompatible/, 'dist/factories/component-factory.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Factory optional Script input', 'Script: configs.ScriptSettings<Record<string, any>, unknown>;', 'Script: configs.ScriptToolSettings<Record<string, any>, unknown>;', /Types of property 'inputSchema' are incompatible/, 'dist/factories/component-factory.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
  ];
  const registryContainerContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/optional-registry-containers.ts'), 'utf8')
    .replaceAll("from 'casai'", "from './src/index.js'").replace("from '../fixtures/source-modes.js'", "from './source-modes.js'").replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const registryContainerMutations = [
    ['Factory required registry inference', '& (NoInfer<T> extends { tools: unknown } ? { tools: Tools } : unknown)', '', /Expected 1 arguments|Unused '@ts-expect-error'|not assignable/, 'src/types/factory-config.ts'],
    ['Factory required binding-map inference', '& (NoInfer<T> extends { toolsContext: unknown } ? { toolsContext: Contexts } : unknown)', '', /Unused '@ts-expect-error'|not assignable/, 'src/types/factory-config.ts'],
    ['Registry optional tool container', "Extract<ContextFromConfig<TConfig, ConfigValue<TConfig, 'tools'>>, ToolRegistry>", "[Extract<NonNullable<ConfigValue<TConfig, 'tools'>>, ToolRegistry>] extends [never] ? EmptyMap : Extract<NonNullable<ConfigValue<TConfig, 'tools'>>, ToolRegistry>", /Expected 1 arguments|not assignable|Unused '@ts-expect-error'/, 'src/types/config.ts'],
    ['Registry optional context container', "ContextFromConfig<TConfig, ConfigValue<TConfig, 'toolsContext'>>", "[NonNullable<ConfigValue<TConfig, 'toolsContext'>>] extends [never] ? EmptyMap : NonNullable<ConfigValue<TConfig, 'toolsContext'>>", /Expected 1 arguments|not assignable|Unused '@ts-expect-error'/, 'src/types/config.ts'],
    ['Registry absent map inheritance', '[T] extends [never] ? EmptyMap : T extends object ? T : EmptyMap', '[NonNullable<T>] extends [never] ? EmptyMap : NonNullable<T> extends object ? undefined extends T ? Partial<NonNullable<T>> : NonNullable<T> : EmptyMap', /Expected 1 arguments|possibly 'undefined'|not assignable/, 'src/types/merge.ts'],
    ['Registry guaranteed helper alternatives', '[TTools[K]] extends [{ execute:', '[Exclude<TTools[K], undefined>] extends [{ execute:', /Expected 1 arguments|Unused '@ts-expect-error'/, 'src/types/config.ts'],
    ['Registry optional entry validation', '[K in keyof TTools]-?: [InvalidToolContext', '[K in keyof TTools]: [InvalidToolContext', /not assignable|No overload matches/, 'src/types/tool-binding.ts'],
  ];
  const rendererSourceContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/renderer-source-unions.ts'), 'utf8')
    .replaceAll("from 'casai'", "from './src/index.js'").replace("from '../fixtures/source-modes.js'", "from './source-modes.js'");
  const rendererSourceMutations = [
    ['Renderer named source alternatives', '[TConfig] extends [Record<TSourceKey, string>]', 'TConfig extends Record<TSourceKey, string>', /Unused '@ts-expect-error'/, 'src/types/input.ts'],
  ];
  const nativeRegistryContracts = fs.readFileSync(path.join(workspace, 'tests/type-safety/native-tool-registries.ts'), 'utf8')
    .replaceAll("from 'casai'", "from './dist/index.js'").replace("from './assert.js'", "from '../../tests/type-safety/assert.js'");
  const nativeRegistryMutations = [
    ['Native registry admission', '[K in keyof ToolSet]: ToolSet[K] | null | undefined', '[K in keyof ToolSet]: Tool | null | undefined', /not assignable|No overload matches/, 'dist/types/config.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Native registry projection', 'Extract<T[K], ToolSet[string]>', 'Extract<T[K], Tool>', /Expected 1 arguments|not assignable/, 'dist/types/config.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Native registry context names', '[NonNullable<TTools[K]>] extends [never] ? never : K', 'Extract<TTools[K], Tool> extends never ? never : K', /Property 'nativeDeferred' does not exist/, 'dist/types/config.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
    ['Native registry replacements', 'type CompatibleTool<T> = T | (', 'type CompatibleTool<T> = (', /not assignable/, 'dist/types/agent.d.ts', undefined, true, ['--exactOptionalPropertyTypes']],
  ];
  if ([...optionalMutations, ...clearingMutations, ...nativeRegistryMutations].some(([name]) => filter.test(name))) {
    const declarations = run(process.execPath, [compiler, ...common.filter(flag => flag !== '--noEmit'), '--declaration', '--emitDeclarationOnly',
      '--rootDir', path.join(production, 'src'), '--outDir', path.join(production, 'dist'), path.join(production, 'src/index.ts')]);
    assert.equal(declarations.status, 0, declarations.stdout + declarations.stderr);
  }
  const consumer = path.join(production, 'contracts.ts');
  let selectedMutationCount = 0;
  const mutationFailures = [];
  for (const [contracts, cases] of [[configModifierContracts, configModifierMutations], [alternatives, alternativeMutations], [check, mutations], [schemaVersions, schemaMutations], [preprocessors, preprocessorMutations], [projection, projectionMutations], [selectedSchemas, selectedMutations], [helperContracts, helperMutations], [runContexts, runContextMutations], [runDescriptorContexts, runDescriptorMutations], [callerAlternatives, callerMutations], [configuredOmissions, omissionMutations], [contextAlternatives, contextMutations], [configFactoryContracts, configFactoryMutations], [agentContracts, agentMutations], [reviewContracts, reviewMutations], [settingOwnershipContracts, settingOwnershipMutations], [factoryContracts, factoryMutations], [unificationContracts, unificationMutations], [phase5Contracts, phase5Mutations], [modeContracts, modeMutations], [callContracts, callMutations], [payloadContracts, payloadMutations], [annotationContracts, annotationMutations], [loopContracts, loopMutations], [toolModeContracts, toolModeMutations], [clearingContracts, clearingMutations], [optionalContracts, optionalMutations], [registryContainerContracts, registryContainerMutations], [rendererSourceContracts, rendererSourceMutations], [nativeRegistryContracts, nativeRegistryMutations]]) {
    let checkedContracts;
    for (const [name, before, after, expected, filename, assertion, rejected = true, flags = []] of cases) {
      if (!filter.test(name)) continue;
      selectedMutationCount += 1;
      assert.ok(filename, `Mutation needs an explicit owner: ${name}`);
      const currentContracts = (assertion ? contracts + (rejected ? '\n// @ts-expect-error This guard must reject the invalid configuration.\n' : '\n') + assertion : contracts)
        .replaceAll("from '../fixtures/source-modes.js'", "from './source-modes.js'")
        .replaceAll("from './source-modes.js'", filename.startsWith('dist/') ? "from './dist-source-modes.js'" : "from './source-modes.js'");
      const checkKey = JSON.stringify(flags) + currentContracts;
      if (checkKey !== checkedContracts) {
        fs.writeFileSync(consumer, currentContracts);
        const baseline = run(process.execPath, [compiler, ...common, ...flags, consumer]);
        assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
        checkedContracts = checkKey;
      }
      const file = path.join(production, filename);
      const source = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
      assert.equal(source.split(before).length - 1, 1, `Expected one mutation location: ${name}`);
      try {
        fs.writeFileSync(file, source.replace(before, after));
        const result = run(process.execPath, [compiler, ...common, ...flags, consumer]);
        assert.notEqual(result.status, 0, `Mutation survived: ${name}`);
        assert.match(result.stdout + result.stderr, expected);
        console.log(`Caught production type mutation: ${name}.`);
      } catch (error) {
        mutationFailures.push(`${name}: ${error.message}`);
        console.error(`Failed production type mutation: ${name}: ${error.message}`);
      } finally {
        fs.writeFileSync(file, source);
      }
    }
  }
  assert.ok(selectedMutationCount > 0, `No production type mutations matched ${filter}.`);
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
  assert.deepEqual(mutationFailures, [], 'Every selected production type mutation must be caught.');
  console.log(`Caught ${selectedMutationCount} production type mutations; unchanged controls passed.`);
} finally {
  const target = path.resolve(temporary);
  assert.equal(path.dirname(target), workspace);
  assert.ok(path.basename(target).startsWith('.phase2-production-types-'));
  fs.rmSync(target, { recursive: true, force: true });
}
