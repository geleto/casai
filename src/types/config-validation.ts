import type { EmptyMap, DistributiveOmit, NamedKeys, UnionKeys, InvalidUnionMembers } from './utils.js';
import type { CallbackContextFromConfig, ConfigValue, ContextFromConfig, InputConfigAlternatives, InputSchemaFromConfig, PossibleExecutableToolNames, ToolRegistry, ToolRegistryFromConfig, ToolsContextFromConfig, ToolsFromConfig } from './config.js';
import type { MergedConfig } from './merge.js';
import type { HasOpenRootInput, HasRootSchemaAlternatives, InputDeclarationKind, SchemaInputNames, SchemaOutputNames, ValidateContextSchema, ValidateToolContextSchema } from './schema-shape.js';
import type { ComponentResult } from './result.js';
import type { StreamSchema } from '../streams.js';
import type { InjectedToolHelpers } from './tool-binding.js';
import type { ComponentExecutionOptions } from './sdk.js';
import type { DeclaredExecute, DeclaredFunctionExecute, ExpectedFunctionConfig, ExpectedToolConfig } from './function-config.js';
import type { ValidateResolved } from './provisional.js';
import type { CallbackConfigShape, ValidateToolCallbackNames, ValidateToolSelectionNames } from './callbacks.js';
import type { ValidateContextValue } from './input.js';
import type * as configs from './config.js';

// keyof a union hides branch-only keys; reject a configured signal in any alternative.
type ConfiguredSignalKeys<T> = T extends unknown ? Extract<keyof T, 'abortSignal'> : never;
type ValidateConfiguredSignal<T> = NoInfer<[ConfiguredSignalKeys<T>] extends [never] ? unknown
	: "Config Error: 'abortSignal' is an invocation setting, not constructor configuration.">;

type ContextMapFromConfig<TConfig> = TConfig extends unknown ? 'toolsContext' extends keyof TConfig
	? [NonNullable<TConfig['toolsContext']>] extends [never] ? EmptyMap : NonNullable<TConfig['toolsContext']>
	: EmptyMap : never;
type ContextMapKeys<T> = T extends unknown ? keyof T : never;

type UnknownContextNames<Actual, Tools> = Tools extends unknown ? Exclude<ContextMapKeys<Actual>, keyof Tools> : never;
type InvalidContextNames<Final, PartialConfig extends boolean> = Final extends unknown
	? 'tools' extends keyof Final ? UnknownContextNames<ContextMapFromConfig<Final>, NonNullable<Final['tools']>>
	: PartialConfig extends true ? never : ContextMapKeys<ContextMapFromConfig<Final>> : never;

// Check context against the complete tool map after inheritance and overrides.
export type ValidateToolsContext<TConfig, TFinalConfig = TConfig, PartialConfig extends boolean = false,
	Invalid = import('./tool-binding.js').InvalidToolContexts<TFinalConfig, PartialConfig> | InvalidContextNames<TFinalConfig, PartialConfig>
		| (PartialConfig extends true ? 'tools' extends UnionKeys<TFinalConfig>
			? Exclude<ContextMapKeys<ContextMapFromConfig<TConfig>>, UnionKeys<ToolsFromConfig<TFinalConfig>>> : never
			: Exclude<ContextMapKeys<ContextMapFromConfig<TConfig>>, UnionKeys<ToolsFromConfig<TFinalConfig>>>),
> = ValidateResolved<TConfig, [Invalid] extends [never] ? unknown
	: `Config Error: toolsContext is missing or invalid for tool '${Invalid & string}'.`>;

// A branch with no context must not hide a supplied context in another branch.
type RunContextChecks<Run, Config, Keys extends PropertyKey> = Run extends unknown ? (check: 'context' extends keyof Run
	? ValidateContextValue<Run['context']> & import('./component-input.js').ValidateComponentInput<Config, NonNullable<Run['context']>, Keys>
	: unknown) => void : never;
type ValidateRunContext<Run, Config, Keys extends PropertyKey> = RunContextChecks<Run, Config, Keys> extends (check: infer Check) => void ? Check : never;

// Undefined top-level run settings inherit. Undefined entries inside maps still replace their keys.
type RunChanges<T> = T extends unknown ? {
	[K in keyof T as undefined extends T[K] ? never : K]: T[K]
} & {
	[K in keyof T as undefined extends T[K] ? [Exclude<T[K], undefined>] extends [never] ? never : K : never]?: Exclude<T[K], undefined>
} : never;

export type ValidateRunConfig<TRunConfig, TConfig, TShape, Keys extends PropertyKey = UnionKeys<TRunConfig>, ContextKeys extends PropertyKey = UnionKeys<configs.ConfigValue<TRunConfig, 'context'>>,
	Changes = RunChanges<TRunConfig>, Final = MergedConfig<TConfig, Changes>> = NoInfer<
	Exclude<Keys, keyof TShape> extends never
	? Exclude<UnionKeys<ToolsFromConfig<TRunConfig>>, keyof ToolsFromConfig<TConfig>> extends never
	? ValidateToolCallbackNames<Final> & ValidateToolSelectionNames<Final> & ValidateToolsContext<TRunConfig, Final>
		& import('./tool-binding.js').ValidateRunHelpers<TConfig, Changes>
		& ValidateRunContext<TRunConfig, TConfig, ContextKeys>
	: 'Config Error: run() can only replace configured tools.'
	: `Config Error: Unknown run properties: '${Exclude<Keys, keyof TShape> & string}'.`
>;

// A fragment may be incomplete, but it must fit one component's config, and an execute must match the
// schemas and context the fragment declares. Its context map must match the tools it knows about.
type ValidPromptSource<T> = T extends { promptType: infer P extends import('./prompt.js').PromptType }
	? Pick<T, 'prompt' & keyof T> extends { prompt?: import('./factory-config.js').PromptSource<P> | undefined } ? unknown
	: 'Config Error: The prompt does not match its source mode.' : unknown;

export type ValidateConfigFragment<TConfig, TFinalConfig, TShape> = ValidateResolved<TConfig,
	[InvalidUnionMembers<TConfig, CallbackConfigShape<TShape>> | InvalidUnionMembers<TFinalConfig, CallbackConfigShape<TShape>>] extends [never]
	? Pick<TFinalConfig, 'execute' & keyof TFinalConfig> extends { execute?: DeclaredExecute<TFinalConfig> | DeclaredFunctionExecute<TFinalConfig> }
		? ValidateToolsContext<TConfig, TFinalConfig, true>
		: 'Config Error: The execute function does not match the schemas and context declared in this configuration.'
	: 'Config Error: These properties do not belong to any single component configuration.'> & ValidateConfiguredSignal<TFinalConfig>
	& NoInfer<ValidPromptSource<TFinalConfig>>;

type RequiredKeys<T> = { [K in keyof T]-?: EmptyMap extends Pick<T, K> ? never : K }[keyof T];
type MissingKeys<TFinal, TExpected> = Exclude<RequiredKeys<TExpected>, keyof TFinal>;
// Required settings must be present for every possible value after inheritance.
type MissingRequiredKeys<TFinal, TRequired> = {
	[K in keyof TRequired]-?: K extends keyof TFinal
	? [Extract<TFinal[K], undefined | null>] extends [never] ? never : K
	: K;
}[keyof TRequired];
type IncompatibleKeys<TFinal, TExpected> = {
	[K in keyof TExpected & keyof TFinal]-?: Pick<TFinal, K> extends Pick<TExpected, K> ? never : K
}[keyof TExpected & keyof TFinal];

type FinalConfigError<Final, Expected, Missing = MissingKeys<Final, Expected>, Incompatible = IncompatibleKeys<Final, Expected>> =
	[Missing] extends [never] ? [Incompatible] extends [never] ? never
	: `Config Error: Property '${Incompatible & string}' is incompatible with the final configuration.`
	: `Config Error: Missing required property '${Missing & string}' in the final configuration.`;
type FunctionConfigErrors<Final, AsTool extends boolean> = Final extends unknown
	? FinalConfigError<Final, AsTool extends true ? ExpectedToolConfig<Final> : ExpectedFunctionConfig<Final>> : never;

// Derive each branch's contract before collecting failures, including inherited callbacks.
export type ValidateFinalConfig<TConfig, TParent, TFinal, AsTool extends boolean = false,
	TExpected = AsTool extends true ? ExpectedToolConfig<TFinal> : ExpectedFunctionConfig<TFinal>,
	TUnknown = Exclude<UnionKeys<TConfig>, keyof TExpected | 'asTool'>,
	TParentUnknown = Exclude<UnionKeys<TParent>, keyof TExpected | 'asTool'>,
	Errors = FunctionConfigErrors<TFinal, AsTool>,
> = ValidateResolved<TConfig, [TUnknown] extends [never] ? [TParentUnknown] extends [never] ? [Errors] extends [never] ? unknown : Errors
	: `Parent Config Error: Parent has properties not allowed for the final generator type: '${TParentUnknown & string}'`
	: `Config Error: Unknown properties for this generator type: '${TUnknown & string}'`>
	& (AsTool extends true ? ToolInputAdmission<TFinal> : unknown);

// Loaded ordinary renderers can receive their source at call time; tools cannot.
type RendererRequirements<Shape, Source extends 'template' | 'script'> =
	(Shape extends configs.LoaderConfig ? { loader: unknown } : EmptyMap)
	& (Shape extends { inputSchema: unknown } ? { inputSchema: unknown } : EmptyMap)
	& (Shape extends configs.LoaderConfig ? Shape extends { inputSchema: unknown }
		? Record<Source, string> : EmptyMap : Record<Source, string>);

type ValidateRendererConfig<Config, Final, Shape, Source extends 'template' | 'script', Result,
	Missing = MissingRequiredKeys<Final, RendererRequirements<Shape, Source>>> =
	ValidateResolved<Config, Exclude<UnionKeys<Config>, keyof Shape | 'asTool'> extends never
		? [Missing] extends [never] ? Config
			: `Config Error: Missing required property '${Missing & string}' in the final configuration.`
		: `Config Error: Unknown properties for this generator type: '${Exclude<UnionKeys<Config>, keyof Shape | 'asTool'> & string}'`>
	& ValidateResolved<Config, ComponentAdmission<Final>>
	& ValidateToolsContext<import('./provisional.js').ResolvedConfig<Config>, Final>
	& import('./callbacks.js').ValidateDescriptor<Config, Final, Result>
	& ValidateResolved<Config, Shape extends { inputSchema: unknown } ? ToolInputAdmission<Final> : unknown>;

type ValidateRendererParent<Parent, Shape, Source extends 'template' | 'script'> =
	Exclude<UnionKeys<Parent>, keyof Shape | 'asTool'> extends never ? Parent
	: `Parent Config Error: Parent has properties not allowed for the final ${Source} type: '${Exclude<UnionKeys<Parent>, keyof Shape | 'asTool'> & string}'`;

export type ValidateTemplateConfig<Config, Final, Shape> = ValidateRendererConfig<Config, Final, Shape, 'template', string>;
export type ValidateScriptConfig<Config, Final, Shape> = ValidateRendererConfig<Config, Final, Shape, 'script', import('./result.js').CollectedResult<Final>>
	& ValidateResolved<Config, Shape extends { inputSchema: unknown } ? ToolOutputAdmission<Final> : unknown>;

export type ValidateTemplateParentConfig<Parent, Shape> = ValidateRendererParent<Parent, Shape, 'template'>;
export type ValidateScriptParentConfig<Parent, Shape> = ValidateRendererParent<Parent, Shape, 'script'>;

// Shared preparation requirements, used by component construction and tool binding.
export type ValidateInputDeclarations<TInputSchema, TDefaults, TContextSchema = undefined, TTools extends ToolRegistry = EmptyMap> = [UnionKeys<TDefaults> | SchemaOutputNames<TContextSchema> | PossibleExecutableToolNames<TTools>] extends [never] ? unknown
	: 'unsupported' extends InputDeclarationKind<TInputSchema> ? { readonly 'Schema needs supported input declarations': never } : unknown;

export type ToolOutputAdmission<TConfig, TResult = ComponentResult<TConfig>> = ConfigValue<TConfig, 'schema'> extends StreamSchema<any, any, any> ? unknown
	: unknown extends TResult ? unknown : [TResult] extends [never] ? unknown
	: [TResult] extends [AsyncIterable<unknown>] ? { readonly 'Tool streams require a declared stream schema': never } : unknown;

type InvalidToolProjection<TConfig, TDefaults, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema } ? true extends HasRootSchemaAlternatives<TInputSchema>
	? [Extract<NamedKeys<[TDefaults] extends [never] ? ContextFromConfig<TAlternative> : TDefaults>, SchemaInputNames<TInputSchema>>] extends [never] ? never : TAlternatives : never : never;

export type ToolInputAdmission<TConfig, TDefaults = never> =
	(true extends HasOpenRootInput<InputSchemaFromConfig<TConfig>> ? { readonly 'Tool input requires a closed root object; nest dynamic keys in a declared field': never } : unknown)
	& ([InvalidToolProjection<TConfig, TDefaults>] extends [never] ? unknown : { readonly 'Tool public defaults require an independent object schema': never });

type ConfiguredDependencies<TConfig> = DistributiveOmit<ContextFromConfig<TConfig>, '_toolOptions' | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>>>
	& InjectedToolHelpers<undefined, ContextFromConfig<TConfig>, ToolRegistryFromConfig<TConfig>, ToolsContextFromConfig<TConfig>> & { _toolOptions: ComponentExecutionOptions };

type ValidateConfiguredDependencies<TConfig> = [Extract<ConfigValue<TConfig, 'execute'> | ConfigValue<TConfig, 'prompt'>, (...args: never[]) => unknown>] extends [never] ? unknown
	: [ConfiguredDependencies<TConfig>] extends [Pick<CallbackContextFromConfig<TConfig>, Extract<keyof CallbackContextFromConfig<TConfig>, NamedKeys<ContextFromConfig<TConfig>> | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>> | '_toolOptions'>>]
	? unknown : { readonly 'Configured private dependencies must satisfy the callback': never };

type ComponentBranchAdmission<TConfig, TInputSchema> = [Exclude<TInputSchema, undefined>] extends [never] ? ValidateConfiguredDependencies<TConfig>
	: ValidateInputDeclarations<TInputSchema, ContextFromConfig<TConfig>, ConfigValue<TConfig, 'toolContextSchema'>, ToolRegistryFromConfig<TConfig>> & ValidateContextSchema<Exclude<TInputSchema, undefined>> & ValidateToolContextSchema<ConfigValue<TConfig, 'toolContextSchema'>>;

type ComponentAdmissionChecks<TConfig, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema } ? (check: ComponentBranchAdmission<TAlternative, TInputSchema>) => void : never;

export type ComponentAdmission<TConfig> = ComponentAdmissionChecks<TConfig> extends (check: infer TCheck) => void ? TCheck : never;
