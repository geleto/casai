import type { EmptyMap, DistributiveOmit, NamedKeys, UnionKeys, InvalidUnionMembers } from './utils.js';
import type { CallbackContextFromConfig, ConfigValue, ContextFromConfig, InputConfigAlternatives, InputSchemaFromConfig, PossibleExecutableToolNames, ToolRegistry, ToolRegistryFromConfig, ToolsContextFromConfig, ToolsFromConfig } from './config.js';
import type { MergedConfig } from './merge.js';
import type { HasOpenRootInput, HasRootSchemaAlternatives, InputDeclarationKind, SchemaInputNames, SchemaOutputNames, ValidateContextSchema, ValidateToolContextSchema } from './schema-shape.js';
import type { ComponentResult } from './result.js';
import type { StreamSchema } from '../streams.js';
import type { InjectedToolHelpers } from './tool-binding.js';
import type { ComponentExecutionOptions, ObjectOutputSettingKeys } from './sdk.js';
import type { LanguageModel } from 'ai';
import type { ObjectConfigForMode, ObjectConfigMode } from './factory-config.js';
import type { DeclaredExecute, DeclaredFunctionExecute, ExpectedFunctionConfig, ExpectedToolConfig } from './function-config.js';
import type { ValidateResolved } from './provisional.js';
import type { CallbackConfigShape, ValidateToolCallbackNames } from './callbacks.js';
import type { ValidateContextValue } from './input.js';
import type * as configs from './config.js';

interface FinalGenerateObjectConfigShape {
	output?: configs.GenerateObjectConfig<any, any, any>['output'];
	schema?: import('./schema.js').SchemaType<any> | undefined;
	model?: LanguageModel;
	enum?: readonly string[] | undefined;
}

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
> = ValidateResolved<TConfig, [Invalid] extends [never] ? TConfig
	: `Config Error: toolsContext is missing or invalid for tool '${Invalid & string}'.`>;

// A branch with no context must not hide a supplied context in another branch.
type RunContextChecks<Run, Config> = Run extends unknown ? (check: 'context' extends keyof Run
	? ValidateContextValue<Run['context']> & import('./component-input.js').ValidateComponentInput<Config, NonNullable<Run['context']>>
	: unknown) => void : never;
type ValidateRunContext<Run, Config> = RunContextChecks<Run, Config> extends (check: infer Check) => void ? Check : never;

export type ValidateRunConfig<TRunConfig, TConfig, TShape> = NoInfer<
	Exclude<UnionKeys<TRunConfig>, keyof TShape> extends never
	? Exclude<UnionKeys<ToolsFromConfig<TRunConfig>>, keyof ToolsFromConfig<TConfig>> extends never
	? ValidateToolCallbackNames<MergedConfig<TConfig, TRunConfig>> & ValidateToolsContext<TRunConfig, MergedConfig<TConfig, TRunConfig>>
		& import('./tool-binding.js').ValidateRunHelpers<TConfig, TRunConfig>
		& ValidateRunContext<TRunConfig, TConfig>
	: 'Config Error: run() can only replace configured tools.'
	: `Config Error: Unknown run properties: '${Exclude<UnionKeys<TRunConfig>, keyof TShape> & string}'.`
>;

// A fragment may be incomplete, but it must fit one component's config, and an execute must match the
// schemas and context the fragment declares. Its context map must match the tools it knows about.
export type ValidateConfigFragment<TConfig, TFinalConfig, TShape> = ValidateResolved<TConfig,
	[InvalidUnionMembers<TConfig, CallbackConfigShape<TShape>> | InvalidUnionMembers<TFinalConfig, CallbackConfigShape<TShape>>] extends [never]
	? Pick<TFinalConfig, 'execute' & keyof TFinalConfig> extends { execute?: DeclaredExecute<TFinalConfig> | DeclaredFunctionExecute<TFinalConfig> }
		? ValidateToolsContext<TConfig, TFinalConfig, true>
		: 'Config Error: The execute function does not match the schemas and context declared in this configuration.'
	: 'Config Error: These properties do not belong to any single component configuration.'> & ValidateConfiguredSignal<TFinalConfig>;

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
	TUnknown = Exclude<UnionKeys<TConfig>, keyof TExpected>,
	TParentUnknown = Exclude<UnionKeys<TParent>, keyof TExpected>,
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
	ValidateResolved<Config, Exclude<UnionKeys<Config>, keyof Shape> extends never
		? [Missing] extends [never] ? Config
			: `Config Error: Missing required property '${Missing & string}' in the final configuration.`
		: `Config Error: Unknown properties for this generator type: '${Exclude<UnionKeys<Config>, keyof Shape> & string}'`>
	& ValidateResolved<Config, ComponentAdmission<Final>>
	& ValidateToolsContext<import('./provisional.js').ResolvedConfig<Config>, Final>
	& import('./callbacks.js').ValidateDescriptor<Config, Final, Result>
	& ValidateResolved<Config, Shape extends { inputSchema: unknown } ? ToolInputAdmission<Final> : unknown>;

type ValidateRendererParent<Parent, Shape, Source extends 'template' | 'script'> =
	Exclude<UnionKeys<Parent>, keyof Shape> extends never ? Parent
	: `Parent Config Error: Parent has properties not allowed for the final ${Source} type: '${Exclude<UnionKeys<Parent>, keyof Shape> & string}'`;

export type ValidateTemplateConfig<Config, Final, Shape> = ValidateRendererConfig<Config, Final, Shape, 'template', string>;
export type ValidateScriptConfig<Config, Final, Shape> = ValidateRendererConfig<Config, Final, Shape, 'script', import('./result.js').CollectedResult<Final>>
	& ValidateResolved<Config, Shape extends { inputSchema: unknown } ? ToolOutputAdmission<Final> : unknown>;

export type ValidateTemplateParentConfig<Parent, Shape> = ValidateRendererParent<Parent, Shape, 'template'>;
export type ValidateScriptParentConfig<Parent, Shape> = ValidateRendererParent<Parent, Shape, 'script'>;

type AnyTextConfig = configs.ConfigShape<configs.GenerateTextConfig<any, any, any>>;

// Rendered prompts and tool forms prepare application context; literal ordinary calls do not.
type ValidateLLMApplication<TConfig, TFinalConfig, TShape> = ValidateResolved<TConfig,
	Extract<keyof TShape, 'context' | 'toolContextSchema'> extends never ? unknown
	: ComponentAdmission<TFinalConfig>>;

// FunctionPromptInput owns callback presence/compatibility; other tools need a fixed source here.
type ToolPromptRequirements<Shape> = Shape extends configs.ToolConfig<any, any>
	? Shape extends configs.FunctionPromptConfig ? EmptyMap : { prompt: unknown } : EmptyMap;

// Generic validator for the `config` object passed to a factory function.
export type ValidateTextConfig<
	TConfig extends Partial<AnyTextConfig>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape,
	TShape extends AnyTextConfig,
	Streaming extends boolean = false,
	TRequired = { model: LanguageModel }
	& (TShape extends { inputSchema: unknown } ? { inputSchema: unknown } : EmptyMap)
	& (TShape extends configs.LoaderConfig ? { loader: unknown } : EmptyMap)
	& ToolPromptRequirements<TShape>
> =
	// GATEKEEPER: Check for excess or missing properties
	// 1. Check for excess properties in TConfig that are not in TShape
	ValidateResolved<TConfig, Exclude<UnionKeys<TConfig>, keyof TShape> extends never
	? (
		// 2. If no excess, check for required properties missing from the FINAL merged config.
		MissingRequiredKeys<TFinalConfig, TRequired> extends never
		? ValidateToolsContext<TConfig, TFinalConfig>
		: `Config Error: Missing required property '${MissingRequiredKeys<TFinalConfig, TRequired> & string}' in the final configuration.`
	)
	: `Config Error: Unknown properties for this ${Streaming extends true ? 'streamer' : 'generator'} type: '${Exclude<UnionKeys<TConfig>, keyof TShape> & string}'`> & ValidateConfiguredSignal<TFinalConfig>
	& ValidateLLMApplication<TConfig, TFinalConfig, TShape>
	& (TShape extends configs.ToolConfig<any, any> ? import('./callbacks.js').ValidateDescriptor<TConfig, TFinalConfig,
		import('ai').InferGenerateOutput<configs.ValueOutputFromConfig<TFinalConfig>>>
		& ValidateResolved<TConfig, ToolOutputAdmission<EmptyMap,
			import('ai').InferGenerateOutput<configs.ValueOutputFromConfig<TFinalConfig>>> & ToolInputAdmission<TFinalConfig>> : unknown);

// Generic validator for the `parent` config object.
export type ValidateTextParentConfig<
	TParentConfig extends Partial<AnyTextConfig>,
	TShape extends AnyTextConfig,
	Streaming extends boolean = false,
> =
	// Check for excess properties in the parent validated against TShape
	NoInfer<Exclude<UnionKeys<TParentConfig>, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final ${Streaming extends true ? 'streamer' : 'generator'} type: '${Exclude<UnionKeys<TParentConfig>, keyof TShape> & string}'`>;

type ObjectConfigShape<Final, Extras = EmptyMap> = ObjectConfigForMode<ObjectConfigMode<Final>> & Extras;

// Derive required fields from the same contracts used for allowed settings.
type MissingObjectKeys<Final, Extras> = Final extends unknown
	? MissingRequiredKeys<Final, Record<Exclude<RequiredKeys<ObjectConfigShape<Final, Extras>>, 'prompt'>
		| keyof ToolPromptRequirements<Extras>, unknown>> : never;

// Check selected keys only in final branches where they survive, against that branch's output mode.
type InvalidObjectKeys<Selected, Final extends { output?: string }, Extras> = Final extends unknown
	? Exclude<Extract<UnionKeys<Selected>, keyof Final>, keyof ObjectConfigShape<Final, Extras>>
		| IncompatibleKeys<Pick<Final, Extract<UnionKeys<Selected>, ObjectOutputSettingKeys & keyof Final>>, ObjectConfigShape<Final>> : never;

export type ValidateObjectConfig<
	TConfig extends configs.ConfigShape<configs.GenerateObjectBaseConfig<any, any> & { output?: string | undefined }>,
	TFinalConfig extends FinalGenerateObjectConfigShape & Record<string, any>,
	TShapeExtras = EmptyMap,
	TShape = ObjectConfigShape<TFinalConfig, TShapeExtras>,
	TMissing = MissingObjectKeys<TFinalConfig, TShapeExtras>,
	TUnknown = InvalidObjectKeys<TConfig, TFinalConfig, TShapeExtras>
> =
	// Reusable for object streamer
	// 1. Check for excess properties in TConfig based on the final merged config's own `output` mode.
	ValidateResolved<TConfig, [TUnknown] extends [never]
		// 2. If no excess, check for properties missing from the FINAL merged config.
		? (
			[TMissing] extends [never]
			? TConfig
			: `Config Error: Missing required properties for output mode '${ObjectConfigMode<TFinalConfig>}' - '${TMissing & string}'`
		)
		: `Config Error: Unknown or incompatible properties for output mode '${ObjectConfigMode<TFinalConfig>}' - '${TUnknown & string}'`
	> & ValidateConfiguredSignal<TFinalConfig>
	& ValidateLLMApplication<TConfig, TFinalConfig, TShape>
	& (TShapeExtras extends configs.ToolConfig<any, any> ? import('./callbacks.js').ValidateDescriptor<TConfig, TFinalConfig, configs.ObjectOutputFromConfig<TFinalConfig>>
		& ValidateResolved<TConfig, ToolOutputAdmission<EmptyMap, configs.ObjectOutputFromConfig<TFinalConfig>> & ToolInputAdmission<TFinalConfig>> : unknown);

export type ValidateObjectParentConfig<
	TParentConfig extends configs.ConfigShape<configs.GenerateObjectConfig<any, any, any, any> & { output?: string | undefined }>,
	TFinalConfig extends FinalGenerateObjectConfigShape & Record<string, any>,
	TShapeExtras = EmptyMap,
	TUnknown = InvalidObjectKeys<TParentConfig, TFinalConfig, TShapeExtras>,
> =
	// Check for excess properties in the parent; the final config carries the child's provisional marker.
	ValidateResolved<TFinalConfig, [TUnknown] extends [never]
	// The check has passed, return the original config type.
	? TParentConfig
	// On excess property failure, return a descriptive string.
	: `Parent Config Error: Unknown or incompatible properties for final output mode '${ObjectConfigMode<TFinalConfig>}' - ${TUnknown & string}`>;

// Streamers have SDK settings such as onError that are not valid generator settings.
type ObjectStreamingProperties = Pick<configs.StreamObjectBaseConfig<any>,
	Exclude<keyof configs.StreamObjectBaseConfig<any>, keyof configs.GenerateObjectBaseConfig<any>>>;

export type ValidateObjectStreamerConfig<
	TConfig extends configs.ConfigShape<configs.GenerateObjectBaseConfig<any, any> & { output?: string | undefined }>,
	TFinalConfig extends FinalGenerateObjectConfigShape & Record<string, any>,
	TShapeExtras = EmptyMap,
> = ValidateObjectConfig<TConfig, TFinalConfig, TShapeExtras & ObjectStreamingProperties>;

export type ValidateObjectStreamerParentConfig<
	TParentConfig extends configs.ConfigShape<configs.GenerateObjectConfig<any, any, any, any> & { output?: string | undefined }>,
	TFinalConfig extends FinalGenerateObjectConfigShape & Record<string, any>,
	TShapeExtras = EmptyMap,
> = ValidateObjectParentConfig<TParentConfig, TFinalConfig, TShapeExtras & ObjectStreamingProperties>;

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

type ValidateConfiguredDependencies<TConfig> = [ConfiguredDependencies<TConfig>] extends [Pick<CallbackContextFromConfig<TConfig>, Extract<keyof CallbackContextFromConfig<TConfig>, NamedKeys<ContextFromConfig<TConfig>> | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>> | '_toolOptions'>>]
	? unknown : { readonly 'Configured private dependencies must satisfy the callback': never };

type ComponentBranchAdmission<TConfig, TInputSchema> = [Exclude<TInputSchema, undefined>] extends [never] ? ValidateConfiguredDependencies<TConfig>
	: ValidateInputDeclarations<TInputSchema, ContextFromConfig<TConfig>, ConfigValue<TConfig, 'toolContextSchema'>, ToolRegistryFromConfig<TConfig>> & ValidateContextSchema<Exclude<TInputSchema, undefined>> & ValidateToolContextSchema<ConfigValue<TConfig, 'toolContextSchema'>>;

type ComponentAdmissionChecks<TConfig, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema } ? (check: ComponentBranchAdmission<TAlternative, TInputSchema>) => void : never;

export type ComponentAdmission<TConfig> = ComponentAdmissionChecks<TConfig> extends (check: infer TCheck) => void ? TCheck : never;
