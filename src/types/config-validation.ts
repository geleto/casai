import type { LanguageModel } from 'ai';
import type * as configs from './config.js';
import type { ToolsFromConfig } from './config.js';
import type { SchemaType } from './types.js';
import type { DeclaredExecute, DeclaredFunctionExecute, ExpectedFunctionConfig, ExpectedToolConfig } from './function-config.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type { ValidateResolved } from './provisional.js';
import type { InvalidUnionMembers, UnionKeys } from './utils.js';
import type { CallbackConfigShape, ValidateToolCallbackNames } from './callbacks.js';
import type { ComponentAdmission } from './application.js';
import type { ValidateContextValue } from './input.js';

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
	Invalid = import('./application.js').InvalidToolContexts<TFinalConfig, PartialConfig> | InvalidContextNames<TFinalConfig, PartialConfig>
		| (PartialConfig extends true ? 'tools' extends UnionKeys<TFinalConfig>
			? Exclude<ContextMapKeys<ContextMapFromConfig<TConfig>>, UnionKeys<ToolsFromConfig<TFinalConfig>>> : never
			: Exclude<ContextMapKeys<ContextMapFromConfig<TConfig>>, UnionKeys<ToolsFromConfig<TFinalConfig>>>),
> = ValidateResolved<TConfig, [Invalid] extends [never] ? TConfig
	: `Config Error: toolsContext is missing or invalid for tool '${Invalid & string}'.`>;

// A branch with no context must not hide a supplied context in another branch.
type RunContextChecks<Run, Config> = Run extends unknown ? (check: 'context' extends keyof Run
	? ValidateContextValue<Run['context']> & import('./application.js').CheckApplication<Config, NonNullable<Run['context']>>
	: unknown) => void : never;
type ValidateRunContext<Run, Config> = RunContextChecks<Run, Config> extends (check: infer Check) => void ? Check : never;

export type ValidateRunConfig<TRunConfig, TConfig, TShape> = NoInfer<
	Exclude<UnionKeys<TRunConfig>, keyof TShape> extends never
	? Exclude<UnionKeys<ToolsFromConfig<TRunConfig>>, keyof ToolsFromConfig<TConfig>> extends never
	? ValidateToolCallbackNames<MergedConfig<TConfig, TRunConfig>> & ValidateToolsContext<TRunConfig, MergedConfig<TConfig, TRunConfig>>
		& import('./application.js').ValidateRunHelpers<TConfig, TRunConfig>
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

type MissingKeys<TFinal, TExpected> = Exclude<{ [K in keyof TExpected]-?: EmptyMap extends Pick<TExpected, K> ? never : K }[keyof TExpected], keyof TFinal>;
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
	& (AsTool extends true ? import('./application.js').ToolInputAdmission<TFinal> : unknown);

// Generic validator for the `config` object passed to a factory function.
export type ValidateTemplateConfig<
	TConfig extends configs.ToolConfigShape<Partial<configs.TemplateConfig<any>>>,
	TFinalConfig extends configs.FinalTemplateConfigShape,
	TShape extends configs.FinalTemplateConfigShape, // This TShape indicates the expected structure for the current factory (e.g., baseTemplate, loadsTemplate, asTool)
	TRequired =
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends configs.LoaderConfig ? { loader: any } : {}) // loader is required for loadsTemplate
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends configs.ToolConfig<any, any> ? { inputSchema: SchemaType<any> } : {}) // inputSchema is required for asTool
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends configs.LoaderConfig ? TShape extends configs.ToolConfig<any, any> ? { template: string } : {} : { template: string })
> =
	// GATEKEEPER: Check for excess or missing properties
	// 1. Check for excess properties in TConfig that are not in TShape
	ValidateResolved<TConfig, Exclude<UnionKeys<TConfig>, keyof TShape> extends never
	? (
		// 2. If no excess, check for required properties missing from the FINAL merged config.
		MissingRequiredKeys<TFinalConfig, TRequired> extends never
		? TConfig // All checks passed.
		: `Config Error: Missing required property '${MissingRequiredKeys<TFinalConfig, TRequired> & string}' in the final configuration.`
	)
	: `Config Error: Unknown properties for this generator type: '${Exclude<UnionKeys<TConfig>, keyof TShape> & string}'`> & ValidateResolved<TConfig, ComponentAdmission<TFinalConfig>> & ValidateToolsContext<import('./provisional.js').ResolvedConfig<TConfig>, TFinalConfig>
	& import('./callbacks.js').ValidateDescriptor<TConfig, TFinalConfig, string>
	& ValidateResolved<TConfig, TShape extends configs.ToolConfig<any, any> ? import('./application.js').ToolInputAdmission<TFinalConfig> : unknown>;

// Generic validator for the `parent` config object.
export type ValidateTemplateParentConfig<
	TParentConfig extends configs.ToolConfigShape<Partial<configs.TemplateConfig<any>>>,
	TShape extends configs.FinalTemplateConfigShape // TShape for parent also
> =
	// Check for excess properties in the parent validated against TShape
	Exclude<UnionKeys<TParentConfig>, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final template type: '${Exclude<UnionKeys<TParentConfig>, keyof TShape> & string}'`;

// Generic validator for the `config` object passed to a factory function.
export type ValidateScriptConfig<
	TConfig extends configs.ToolConfigShape<Partial<configs.ScriptConfig<any, any>>>,
	TFinalConfig extends configs.FinalScriptConfigShape,
	TShape extends configs.FinalScriptConfigShape, // This TShape indicates the expected structure for the current factory
	TRequired =
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends configs.LoaderConfig ? { loader: any } : {}) // loader is required for loads...
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends { inputSchema: any } ? { inputSchema: SchemaType<any> } : {}) // inputSchema is required for asTool
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends configs.LoaderConfig ? TShape extends configs.ToolConfig<any, any> ? { script: string } : {} : { script: string })
> =
	// GATEKEEPER: Check for excess or missing properties
	// 1. Check for excess properties in TConfig that are not in TShape
	ValidateResolved<TConfig, Exclude<UnionKeys<TConfig>, keyof TShape> extends never
	? (
		// 2. If no excess, check for required properties missing from the FINAL merged config.
		MissingRequiredKeys<TFinalConfig, TRequired> extends never
		? TConfig // All checks passed.
		: `Config Error: Missing required property '${MissingRequiredKeys<TFinalConfig, TRequired> & string}' in the final configuration.`
	)
	: `Config Error: Unknown properties for this generator type: '${Exclude<UnionKeys<TConfig>, keyof TShape> & string}'`> & ValidateResolved<TConfig, ComponentAdmission<TFinalConfig>> & ValidateToolsContext<import('./provisional.js').ResolvedConfig<TConfig>, TFinalConfig>
	& import('./callbacks.js').ValidateDescriptor<TConfig, TFinalConfig, import('./application.js').CollectedResult<TFinalConfig>>
	& ValidateResolved<TConfig, TShape extends { inputSchema: unknown } ? import('./application.js').ToolOutputAdmission<TFinalConfig> & import('./application.js').ToolInputAdmission<TFinalConfig> : unknown>;

// Generic validator for the `parent` config object.
export type ValidateScriptParentConfig<
	TParentConfig extends configs.ToolConfigShape<Partial<configs.ScriptConfig<any, any>>>,
	TShape extends configs.FinalScriptConfigShape // TShape for parent also
> =
	// Check for excess properties in the parent validated against TShape
	Exclude<UnionKeys<TParentConfig>, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final script type: '${Exclude<UnionKeys<TParentConfig>, keyof TShape> & string}'`;

type AnyGenerateTextConfig = configs.ConfigShape<configs.GenerateTextConfig<any, any, any>>;

// Rendered prompts and tool forms prepare application context; literal ordinary calls do not.
type ValidateLLMApplication<TConfig, TFinalConfig, TShape> = ValidateResolved<TConfig,
	Extract<keyof TShape, 'context' | 'toolContextSchema'> extends never ? unknown
	: import('./application.js').ComponentAdmission<TFinalConfig>>;

// A parent must guarantee each required setting, or the child must supply it.
export type RequiredInheritedConfig<TParent, TRequired> = NoInfer<{
	[K in keyof TRequired as [TParent] extends [Record<K, TRequired[K]>] ? never : K]: TRequired[K]
}>;
export type RequiredModelConfig<TParent> = RequiredInheritedConfig<TParent, { model: LanguageModel }>;

// Generic validator for the `config` object passed to a factory function.
export type ValidateGenerateTextConfig<
	TConfig extends Partial<AnyGenerateTextConfig>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape,
	TShape extends AnyGenerateTextConfig,
	TRequired =
	& (TShape extends { inputSchema: any } ? { inputSchema: any, model: LanguageModel } : { model: LanguageModel })
	& (TShape extends { loader: any } ? { loader: any, model: LanguageModel } : { model: LanguageModel })
	& (TShape extends configs.ToolConfig<any, any> ? { prompt: any, model: LanguageModel } : { model: LanguageModel })//@todo - messages instead of prompt?
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
	: `Config Error: Unknown properties for this generator type: '${Exclude<UnionKeys<TConfig>, keyof TShape> & string}'`> & ValidateConfiguredSignal<TFinalConfig>
	& ValidateLLMApplication<TConfig, TFinalConfig, TShape>
	& (TShape extends configs.ToolConfig<any, any> ? import('./callbacks.js').ValidateDescriptor<TConfig, TFinalConfig,
		import('ai').InferGenerateOutput<configs.ValueOutputFromConfig<TFinalConfig>>>
		& ValidateResolved<TConfig, import('./application.js').ToolOutputAdmission<EmptyMap,
			import('ai').InferGenerateOutput<configs.ValueOutputFromConfig<TFinalConfig>>> & import('./application.js').ToolInputAdmission<TFinalConfig>> : unknown);

// Generic validator for the `parent` config object.
export type ValidateGenerateTextParentConfig<
	TParentConfig extends Partial<AnyGenerateTextConfig>,
	TShape extends AnyGenerateTextConfig,
> =
	// Check for excess properties in the parent validated against TShape
	NoInfer<Exclude<UnionKeys<TParentConfig>, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final generator type: '${Exclude<UnionKeys<TParentConfig>, keyof TShape> & string}'`>;

type AnyStreamTextConfig = configs.ConfigShape<configs.StreamTextConfig<any, any, any>>;

// Generic validator for the `config` object passed to a factory function.
export type ValidateStreamTextConfig<
	TConfig extends Partial<AnyStreamTextConfig>,
	TFinalConfig extends configs.FinalStreamTextConfigShape,
	TShape extends AnyStreamTextConfig,
	TRequired =
	& (TShape extends { inputSchema: any } ? { inputSchema: any, model: LanguageModel } : { model: LanguageModel })
	& (TShape extends { loader: any } ? { loader: any, model: LanguageModel } : { model: LanguageModel }),
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
	: `Config Error: Unknown properties for this streamer type: '${Exclude<UnionKeys<TConfig>, keyof TShape> & string}'`> & ValidateConfiguredSignal<TFinalConfig>
	& ValidateLLMApplication<TConfig, TFinalConfig, TShape>;

// Generic validator for the `parent` config object.
export type ValidateStreamTextParentConfig<
	TParentConfig extends Partial<AnyStreamTextConfig>,
	TShape extends AnyStreamTextConfig,
> =
	// Check for excess properties in the parent validated against TShape
	NoInfer<Exclude<UnionKeys<TParentConfig>, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final streamer type: '${Exclude<UnionKeys<TParentConfig>, keyof TShape> & string}'`>;

// A mapping from the 'output' literal to its full, correct config type.
interface ConfigShapeMap {
	array: configs.GenerateObjectArrayConfig<any, any>;
	enum: configs.GenerateObjectEnumConfig<any>;
	'no-schema': configs.GenerateObjectNoSchemaConfig<any>;
	object: configs.GenerateObjectObjectConfig<any, any>;
}

type GetOutputType<TConfig> =
	TConfig extends { output: string }
	? (TConfig['output'] extends keyof ConfigShapeMap
		? TConfig['output']// not undefined
		: 'object')
	: 'object';

// Gets the set of keys that are required in the final, merged configuration.
type GetObjectGeneratorRequiredShape<TFinalConfig extends { output?: string }> =
	TFinalConfig extends { output: 'enum' } ? { enum: unknown; model: unknown } :
	TFinalConfig extends { output: 'no-schema' } ? { model: unknown } :
	// Default case for 'object', 'array', or undefined output.
	{ schema: unknown; model: unknown };

type GetObjectConfigShape<TFinalConfig extends { output?: string }> =
	TFinalConfig extends { output: 'enum' } ? ConfigShapeMap['enum'] :
	TFinalConfig extends { output: 'no-schema' } ? ConfigShapeMap['no-schema'] :
	TFinalConfig extends { output: 'array' } ? ConfigShapeMap['array'] :
	// Default case for 'object', 'array', or undefined output.
	ConfigShapeMap['object'];

// Check selected keys only in final branches where they survive, against that branch's output mode.
type InvalidObjectKeys<Selected, Final extends { output?: string }, Extras> = Final extends unknown
	? Exclude<Extract<UnionKeys<Selected>, keyof Final>, keyof (GetObjectConfigShape<Final> & Extras)> : never;

export type ValidateObjectConfig<
	TConfig extends configs.ConfigShape<configs.GenerateObjectBaseConfig<any, any> & { output?: string | undefined }>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape & Record<string, any>,
	TShapeExtras = EmptyMap,
	TShape = GetObjectConfigShape<TFinalConfig> & TShapeExtras,
	TRequiredShape =
	& (TShapeExtras extends { inputSchema: any } ? GetObjectGeneratorRequiredShape<TFinalConfig> & { inputSchema: any } : GetObjectGeneratorRequiredShape<TFinalConfig>)
	& (TShapeExtras extends { loader: any } ? GetObjectGeneratorRequiredShape<TFinalConfig> & { loader: any } : GetObjectGeneratorRequiredShape<TFinalConfig>)
	& (TShape extends configs.ToolConfig<any, any> ? { prompt: any, model: LanguageModel } : { model: LanguageModel }), // @todo - messages instead of prompt?
	TUnknown = InvalidObjectKeys<TConfig, TFinalConfig, TShapeExtras>
> =
	// Reusable for object streamer
	// 1. Check for excess properties in TConfig based on the final merged config's own `output` mode.
	ValidateResolved<TConfig, [TUnknown] extends [never]
		// 2. If no excess, check for properties missing from the FINAL merged config.
		? (
			MissingRequiredKeys<TFinalConfig, TRequiredShape> extends never
			? TConfig
			: `Config Error: Missing required properties for output mode '${GetOutputType<TFinalConfig>}' - '${MissingRequiredKeys<TFinalConfig, TRequiredShape> & string}'`
		)
		: `Config Error: Unknown properties for output mode '${GetOutputType<TFinalConfig>}' - '${TUnknown & string}'`
	> & ValidateConfiguredSignal<TFinalConfig>
	& ValidateLLMApplication<TConfig, TFinalConfig, TShape>
	& (TShapeExtras extends configs.ToolConfig<any, any> ? import('./callbacks.js').ValidateDescriptor<TConfig, TFinalConfig, configs.ObjectOutputFromConfig<TFinalConfig>>
		& ValidateResolved<TConfig, import('./application.js').ToolOutputAdmission<EmptyMap, configs.ObjectOutputFromConfig<TFinalConfig>> & import('./application.js').ToolInputAdmission<TFinalConfig>> : unknown);

export type ValidateObjectParentConfig<
	TParentConfig extends configs.ConfigShape<configs.GenerateObjectConfig<any, any, any, any> & { output?: string | undefined }>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape & Record<string, any>,
	TShapeExtras = EmptyMap,
	TUnknown = InvalidObjectKeys<TParentConfig, TFinalConfig, TShapeExtras>,
> =
	// Check for excess properties in the parent; the final config carries the child's provisional marker.
	ValidateResolved<TFinalConfig, [TUnknown] extends [never]
	// The check has passed, return the original config type.
	? TParentConfig
	// On excess property failure, return a descriptive string.
	: `Parent Config Error: Unknown properties for final output mode '${GetOutputType<TFinalConfig>}' - ${TUnknown & string}`>;

// Streamers have SDK settings such as onError that are not valid generator settings.
type ObjectStreamingProperties = Pick<configs.StreamObjectBaseConfig<any>,
	Exclude<keyof configs.StreamObjectBaseConfig<any>, keyof configs.GenerateObjectBaseConfig<any>>>;

export type ValidateObjectStreamerConfig<
	TConfig extends configs.ConfigShape<configs.GenerateObjectBaseConfig<any, any> & { output?: string | undefined }>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape & Record<string, any>,
	TShapeExtras = EmptyMap,
> = ValidateObjectConfig<TConfig, TFinalConfig, TShapeExtras & ObjectStreamingProperties>;

export type ValidateObjectStreamerParentConfig<
	TParentConfig extends configs.ConfigShape<configs.GenerateObjectConfig<any, any, any, any> & { output?: string | undefined }>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape & Record<string, any>,
	TShapeExtras = EmptyMap,
> = ValidateObjectParentConfig<TParentConfig, TFinalConfig, TShapeExtras & ObjectStreamingProperties>;
