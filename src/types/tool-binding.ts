import type { InferSchema, InferInputSchema } from './schema.js';
import type { ToolContextFromConfig, ConfigValue, ConfiguredToolNames, ContextFromConfig, ExecutableToolNames, InputConfigAlternatives, InputSchemaFromConfig, PossibleExecutableToolNames, ToolRegistry, ToolRegistryFromConfig, ToolsContextFromConfig } from './config.js';
import type { FunctionTool, InferToolContext, InferToolInput, InferToolOutput } from '@ai-sdk/provider-utils';
import type { ToolExecuteFunction, FlexibleSchema, Tool } from 'ai';
import type { EmptyMap, DistributiveOmit, NamedKeys, NonArrayObject } from './utils.js';
import type { ParsedSchemaOutput, SchemaInputNames, SchemaOutputObject } from './schema-shape.js';
import type { MergedConfig, MergedProperties } from './merge.js';
import type { ComponentInput, GuaranteedInputDefaults, PrivateInputNames, ValidOptionalDefaults } from './component-input.js';
import type { ComponentCaller } from './input.js';
import type { ToolInputAdmission, ValidateInputDeclarations } from './config-validation.js';
import type { BoundExecutionContext, ToolExecutionContext } from './execution.js';

// Bound tool contexts and injected helper contracts, including safe registry replacement.

type IncomingToolContext<TContextSchema, TRawContext = undefined> = TContextSchema extends FlexibleSchema<unknown> ? NonArrayObject<ParsedSchemaOutput<TContextSchema>> | (undefined extends ParsedSchemaOutput<TContextSchema> ? EmptyMap : never)
	: TRawContext extends object ? TRawContext : EmptyMap;

export type BoundContextDefaults<TDefaults, TContextSchema, TRawContext = undefined> = MergedProperties<TDefaults, IncomingToolContext<TContextSchema, TRawContext>>;

// Generic call signatures alone do not preserve raw input, omitted defaults or
// private reservations under substitution. This optional, type-only member makes
// those obligations structural without adding a runtime property to helpers.
declare const helperContract: unique symbol;

type RestrictedInputNames<TInput> = string extends keyof TInput ? {
	[K in NamedKeys<TInput> & keyof TInput]-?: [TInput[string]] extends [TInput[K]] ? never : K
}[NamedKeys<TInput> & keyof TInput] : never;

// Keep raw discriminants at the root so TypeScript can compare union branches.
type RawHelperInput<TInput> = TInput extends unknown ? TInput & {
	readonly [helperContract]?: {
		keys: keyof TInput;
		// Open inputs also retain named restrictions beyond their index signature.
		declared: string extends keyof TInput ? (key: RestrictedInputNames<TInput>) => void : any;
	};
} : never;

// Resolve the raw contract before comparing functions: comparing the generic
// alias directly can skip its branch-specific key restrictions.
type HelperCallContract<TInput, TDefaults, TPrivateNames extends PropertyKey, TResult> = RawHelperInput<TInput> extends infer TRawInput ? {
	readonly [helperContract]?: {
		input: (value: TRawInput) => TResult;
		defaults: (key: GuaranteedInputDefaults<TInput, TDefaults> | ValidOptionalDefaults<TInput, TDefaults>) => void;
		private: TPrivateNames;
	};
} : never;

type ComponentHelperContract<TConfig, TResult, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema }
	? HelperCallContract<ComponentInput<TAlternative, TInputSchema>, ContextFromConfig<TAlternative>, PrivateInputNames<TAlternative, ContextFromConfig<TAlternative>, TInputSchema>, TResult> : never;

// Keep each selected parser paired with its bound defaults, then derive one
// callable that checks every selection rather than a union of generic helpers.
type BoundHelperConfig<TConfig, TBoundContext> = TConfig extends unknown ? DistributiveOmit<TConfig, 'context'>
	& { context: BoundContextDefaults<ContextFromConfig<TConfig>, ConfigValue<TConfig, 'toolContextSchema'>, TBoundContext> } : never;

type ComponentHelper<TConfig, TResult> = ComponentCaller<TConfig, TResult> & ComponentHelperContract<TConfig, TResult>;

// Capture the native completed output before distributing the component's configuration.
type InjectedToolHelper<TTool, TBoundContext, TResult = TTool extends Tool ? InferToolOutput<TTool> : never> = TTool extends Tool ? TTool extends { config: infer TConfig }
	? ComponentHelper<BoundHelperConfig<TConfig, TBoundContext>, TResult>
	: ((input: InferToolInput<TTool>) => Promise<TResult>) & HelperCallContract<InferToolInput<TTool>, EmptyMap, never, TResult> : never;

type RegistryEntry<TMap, TKey> = TMap extends unknown ? TKey extends keyof TMap ? TMap[TKey] : undefined : never;

type HelperShadowSource<TInputSchema, TDefaults, TKey> = TKey extends SchemaInputNames<TInputSchema> ? SchemaOutputObject<TInputSchema> : TDefaults;

type HelperShadowValue<TInputSchema, TDefaults, TKey> = HelperShadowSource<TInputSchema, TDefaults, TKey> extends infer TSource ? TSource extends unknown ? TKey extends keyof TSource ? TSource[TKey] : never : never : never;

type HasRequiredKey<TSource, TKey extends PropertyKey> = TKey extends keyof TSource ? [TSource] extends [Record<TKey, unknown>] ? true : false : false;

type HelperFallbackValue<TInputSchema, TDefaults, TTools extends ToolRegistry, TContexts, TKey extends keyof TTools> = HelperShadowValue<TInputSchema, TDefaults, TKey>
	| (HasRequiredKey<HelperShadowSource<TInputSchema, TDefaults, TKey>, TKey> extends true ? never : InjectedToolHelper<TTools[TKey], RegistryEntry<TContexts, TKey>>);

type RequiredHelperNames<TInputSchema, TDefaults, TTools extends ToolRegistry> = ExecutableToolNames<TTools> | { [TKey in PossibleExecutableToolNames<TTools>]: HasRequiredKey<HelperShadowSource<TInputSchema, TDefaults, TKey>, TKey> extends true ? TKey : never }[PossibleExecutableToolNames<TTools>];

export type InjectedToolHelpers<TInputSchema, TDefaults, TTools extends ToolRegistry, TContexts> = { [TKey in RequiredHelperNames<TInputSchema, TDefaults, TTools>]: HelperFallbackValue<TInputSchema, TDefaults, TTools, TContexts, TKey> }
	& { [TKey in Exclude<PossibleExecutableToolNames<TTools>, RequiredHelperNames<TInputSchema, TDefaults, TTools>>]?: HelperFallbackValue<TInputSchema, TDefaults, TTools, TContexts, TKey> };

// The context schema represents selected parsers, not branches inside one union parser. A value
// must satisfy every possible selection. Unknown/any raw inputs add no constraint.
type ToolContextInputChecks<TContextSchema> = TContextSchema extends FlexibleSchema<unknown> ? (context: unknown extends InferInputSchema<TContextSchema> ? unknown : InferInputSchema<TContextSchema>) => void : (context: object | undefined) => void;

type ToolContextInput<TConfig> = ToolContextInputChecks<ConfigValue<TConfig, 'toolContextSchema'>> extends (context: infer TInput) => void ? TInput : never;

// Casai retains raw schema input. Native tools keep the SDK's inferred context contract.
type RawToolContext<TTool> = NonNullable<TTool> extends { config: infer TConfig } ? ToolContextInput<TConfig>
	: NonNullable<TTool> extends Tool ? [InferToolContext<NonNullable<TTool>>] extends [never] ? unknown : InferToolContext<NonNullable<TTool>> : unknown;

type ToolBindingCheck<TConfig, TContext> = ValidateInputDeclarations<InputSchemaFromConfig<TConfig>, BoundContextDefaults<ContextFromConfig<TConfig>, ConfigValue<TConfig, 'toolContextSchema'>, TContext>, ConfigValue<TConfig, 'toolContextSchema'>, ToolRegistryFromConfig<TConfig>>
	& ToolInputAdmission<TConfig, BoundContextDefaults<ContextFromConfig<TConfig>, ConfigValue<TConfig, 'toolContextSchema'>, TContext>>
	& ([BoundExecutionContext<TConfig, TContext>] extends [ToolExecutionContext<TConfig>]
		? unknown : { readonly 'Bound context must remain compatible with the implementation': never });

type ToolBindingChecks<TConfig, TContext> = TConfig extends unknown ? (check: ToolBindingCheck<TConfig, TContext>) => void : never;

type ValidateToolBinding<TConfig, TContext> = ToolBindingChecks<TConfig, TContext> extends (check: infer TCheck) => void ? TCheck : never;

type ComponentToolBindingCheck<TTool, TContext> = NonNullable<TTool> extends { config: infer TConfig } ? ValidateToolBinding<TConfig, TContext> : unknown;

type InvalidToolContext<TTool, TContext, PartialConfig extends boolean> = TTool extends unknown ? TTool extends null | undefined ? never
	: (TTool extends { bindToolContext: (...args: any[]) => any } ? TTool extends (...args: any[]) => any ? never : 'copied component' : never)
		| ([TContext] extends [RawToolContext<TTool> | (PartialConfig extends true ? undefined : never)] ? never : 'context')
		| (unknown extends ComponentToolBindingCheck<TTool, TContext> ? never : 'binding') : never;

type InvalidRegistryContexts<TTools extends ToolRegistry, TContexts, PartialConfig extends boolean> = TTools extends unknown ? TContexts extends unknown ? {
	[K in keyof TTools]: [InvalidToolContext<TTools[K], RegistryEntry<TContexts, K>, PartialConfig>] extends [never] ? never : K
}[keyof TTools] : never : never;

// Validate complete configuration branches before projecting their tools and context.
export type InvalidToolContexts<TConfig, PartialConfig extends boolean = false> = TConfig extends unknown
	? InvalidRegistryContexts<ToolRegistryFromConfig<TConfig>, ToolsContextFromConfig<TConfig>, PartialConfig> : never;

export type ToolContexts<TTools extends ToolRegistry> = {
	[K in ConfiguredToolNames<TTools> as undefined extends RawToolContext<TTools[K]> ? never : K]: RawToolContext<TTools[K]>
} & {
	[K in ConfiguredToolNames<TTools> as undefined extends RawToolContext<TTools[K]> ? K : never]?: RawToolContext<TTools[K]>
};

type ConfiguredToolHelpers<TConfig, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema }
	? InjectedToolHelpers<TInputSchema, ContextFromConfig<TAlternative>, ToolRegistryFromConfig<TAlternative>, ToolsContextFromConfig<TAlternative>> : never;

// Run callbacks keep the component's original helper contract. Descriptor
// compatibility alone does not preserve helper availability or omitted input.
export type ValidateRunHelpers<TConfig, TChanges, TBefore = ConfiguredToolHelpers<TConfig>, TAfter = ConfiguredToolHelpers<MergedConfig<TConfig, TChanges>>,
	TInvalid = { [K in keyof TBefore]: Pick<TAfter, Extract<K, keyof TAfter>> extends Pick<TBefore, K> ? never : K }[keyof TBefore],
> = [Extract<ConfigValue<TConfig, 'execute'> | ConfigValue<TConfig, 'prompt'> | ConfigValue<TConfig, 'prepareCall'> | ConfigValue<TConfig, 'prepareStep'>, (...args: any[]) => any>] extends [never] ? unknown
	: [TInvalid] extends [never] ? unknown : `Config Error: Replacement changes the helper call contract for tool '${TInvalid & string}'.`;

// A binding knows its raw context even without a parser. An optional parser can
// produce either its parsed context or the captured raw context.
type BoundToolContext<TContextSchema, TRawContext> = TContextSchema extends FlexibleSchema<unknown> ? ParsedSchemaOutput<TContextSchema> : TRawContext;

type BindToolContext<TConfig, TResult> = <TContext extends ToolContextInput<TConfig>>(context: TContext
	& NoInfer<ValidateToolBinding<TConfig, TContext>>) => {
	readonly context: Readonly<TContext>;
	readonly tool: Tool<SchemaOutputObject<InputSchemaFromConfig<TConfig>>, TResult, BoundToolContext<ConfigValue<TConfig, 'toolContextSchema'>, TContext>>;
};

// Native descriptor arguments are parsed. Ordinary calls retain raw input types.
export type ComponentToolFromConfig<INPUT, OUTPUT, TConfig> = ComponentTool<InferSchema<ConfigValue<TConfig, 'inputSchema'>, INPUT>, OUTPUT, ToolContextFromConfig<TConfig>> & {
	bindToolContext: BindToolContext<TConfig, OUTPUT>;
};

export type ComponentTool<INPUT, OUTPUT, TOOL_CONTEXT = undefined> =
	Omit<FunctionTool<INPUT, OUTPUT, TOOL_CONTEXT>, 'execute' | 'outputSchema'> & Required<Pick<FunctionTool<INPUT, OUTPUT, TOOL_CONTEXT>, 'type'>> & {
	execute: (...args: Parameters<ToolExecuteFunction<INPUT, OUTPUT, TOOL_CONTEXT>>) => PromiseLike<OUTPUT>;
};
