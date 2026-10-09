import type { LanguageModel, ToolSet } from 'ai';
import type * as configs from './config.js';
import type { ToolsContextConfig, ToolsFromConfig } from './config.js';
import type { SchemaType } from './types.js';
import type { DeclaredExecute, DeclaredFunctionExecute } from './function-config.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type { ValidateResolved } from './provisional.js';
import type { StrictUnionSubtype } from './utils.js';
import type { CallbackConfigShape, ValidateToolCallbackNames } from './callbacks.js';
import type { ValidateRendererInput } from './renderer-input.js';
import type { ValidateContextValue } from './input.js';

type ContextMapFromConfig<TConfig> = 'toolsContext' extends keyof TConfig
	? [NonNullable<TConfig['toolsContext']>] extends [never] ? EmptyMap : NonNullable<TConfig['toolsContext']>
	: EmptyMap;

type InvalidToolsContextNames<TActual, TExpected> = [TExpected] extends [never]
	? keyof TActual
	: {
		[K in keyof TExpected]-?: K extends keyof TActual
		? TActual[K] extends TExpected[K] ? never : K
		: undefined extends TExpected[K] ? never : K;
	}[keyof TExpected] | Exclude<keyof TActual, keyof TExpected>;

// Check context against the complete tool map after inheritance and overrides.
export type ValidateToolsContext<TConfig, TFinalConfig = TConfig, PartialConfig extends boolean = false,
	TOOLS extends ToolSet = ToolsFromConfig<TFinalConfig>,
	Expected = NonNullable<ToolsContextConfig<TOOLS>['toolsContext']>,
	Actual = ContextMapFromConfig<TFinalConfig>,
	Invalid = PartialConfig extends true
	? 'tools' extends keyof TFinalConfig ? InvalidToolsContextNames<Actual, Partial<Expected>> : never
	: InvalidToolsContextNames<Actual, Expected>,
> = NoInfer<[Invalid] extends [never] ? TConfig
	: `Config Error: toolsContext is missing or invalid for tool '${Invalid & string}'.`>;

export type ValidateRunConfig<TRunConfig, TConfig, TShape> = NoInfer<
	Exclude<keyof TRunConfig, keyof TShape> extends never
	? Exclude<keyof ToolsFromConfig<TRunConfig>, keyof ToolsFromConfig<TConfig>> extends never
	? ValidateToolCallbackNames<TRunConfig, TConfig> & ValidateToolsContext<TRunConfig, MergedConfig<TConfig, TRunConfig>> & ('context' extends keyof TRunConfig ? ValidateContextValue<TRunConfig['context']> : unknown)
	: 'Config Error: run() can only replace configured tools.'
	: `Config Error: Unknown run properties: '${Exclude<keyof TRunConfig, keyof TShape> & string}'.`
>;

// A fragment may be incomplete, but it must fit one component's config, and an execute must match the
// schemas and context the fragment declares. Its context map must match the tools it knows about.
export type ValidateConfigFragment<TConfig, TFinalConfig, TShape> = ValidateResolved<TConfig,
	[StrictUnionSubtype<TFinalConfig, CallbackConfigShape<TShape>>] extends [never]
	? 'Config Error: These properties do not belong to any single component configuration.'
	: Pick<TFinalConfig, 'execute' & keyof TFinalConfig> extends { execute?: DeclaredExecute<TFinalConfig> | DeclaredFunctionExecute<TFinalConfig> }
	? ValidateToolsContext<TConfig, TFinalConfig, true>
	: 'Config Error: The execute function does not match the schemas and context declared in this configuration.'>;

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

// Validate the whole final config against its own contract, including an inherited execute.
export type ValidateFinalConfig<TConfig, TParent, TFinal, TExpected,
	TUnknown = Exclude<keyof TConfig, keyof TExpected>,
	TParentUnknown = Exclude<keyof TParent, keyof TExpected>,
	TMissing = MissingKeys<TFinal, TExpected>,
	TIncompatible = IncompatibleKeys<TFinal, TExpected>,
> = ValidateResolved<TConfig, [TUnknown] extends [never] ? [TParentUnknown] extends [never] ? [TMissing] extends [never] ? [TIncompatible] extends [never] ? unknown
	: `Config Error: Property '${TIncompatible & string}' is incompatible with the final configuration.`
	: `Config Error: Missing required property '${TMissing & string}' in the final configuration.`
	: `Parent Config Error: Parent has properties not allowed for the final generator type: '${TParentUnknown & string}'`
	: `Config Error: Unknown properties for this generator type: '${TUnknown & string}'`>;

// Generic validator for the `config` object passed to a factory function.
export type ValidateTemplateConfig<
	TConfig extends Partial<configs.TemplateConfig<any>>,
	TFinalConfig extends configs.FinalTemplateConfigShape,
	TShape extends configs.FinalTemplateConfigShape, // This TShape indicates the expected structure for the current factory (e.g., baseTemplate, loadsTemplate, asTool)
	TRequired =
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends configs.LoaderConfig ? { loader: any } : {}) // loader is required for loadsTemplate
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends configs.ToolConfig<any, any> ? { inputSchema: SchemaType<any> } : {}) // inputSchema is required for asTool
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends configs.ToolConfig<any, any> ? { template: any } : {})
> =
	// GATEKEEPER: Check for excess or missing properties
	// 1. Check for excess properties in TConfig that are not in TShape
	ValidateResolved<TConfig, keyof Omit<TConfig, keyof TShape> extends never
	? (
		// 2. If no excess, check for required properties missing from the FINAL merged config.
		MissingRequiredKeys<TFinalConfig, TRequired> extends never
		? TConfig // All checks passed.
		: `Config Error: Missing required property '${MissingRequiredKeys<TFinalConfig, TRequired> & string}' in the final configuration.`
	)
	: `Config Error: Unknown properties for this generator type: '${keyof Omit<TConfig, keyof TShape> & string}'`> & ValidateResolved<TConfig, ValidateRendererInput<TFinalConfig>>;


// Generic validator for the `parent` config object.
export type ValidateTemplateParentConfig<
	TParentConfig extends Partial<configs.TemplateConfig<any>>,
	TShape extends configs.FinalTemplateConfigShape // TShape for parent also
> =
	// Check for excess properties in the parent validated against TShape
	keyof Omit<TParentConfig, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final template type: '${keyof Omit<TParentConfig, keyof TShape> & string}'`;

// Generic validator for the `config` object passed to a factory function.
export type ValidateScriptConfig<
	TConfig extends Partial<configs.ScriptConfig<any, any>>,
	TFinalConfig extends configs.FinalScriptConfigShape,
	TShape extends configs.FinalScriptConfigShape, // This TShape indicates the expected structure for the current factory
	TRequired =
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends configs.LoaderConfig ? { loader: any } : {}) // loader is required for loads...
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends { inputSchema: any } ? { inputSchema: SchemaType<any> } : {}) // inputSchema is required for asTool
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	& (TShape extends configs.ToolConfig<any, any> ? { script: any } : {})
> =
	// GATEKEEPER: Check for excess or missing properties
	// 1. Check for excess properties in TConfig that are not in TShape
	ValidateResolved<TConfig, keyof Omit<TConfig, keyof TShape> extends never
	? (
		// 2. If no excess, check for required properties missing from the FINAL merged config.
		MissingRequiredKeys<TFinalConfig, TRequired> extends never
		? TConfig // All checks passed.
		: `Config Error: Missing required property '${MissingRequiredKeys<TFinalConfig, TRequired> & string}' in the final configuration.`
	)
	: `Config Error: Unknown properties for this generator type: '${keyof Omit<TConfig, keyof TShape> & string}'`> & ValidateResolved<TConfig, ValidateRendererInput<TFinalConfig>>;

// Generic validator for the `parent` config object.
export type ValidateScriptParentConfig<
	TParentConfig extends Partial<configs.ScriptConfig<any, any>>,
	TShape extends configs.FinalScriptConfigShape // TShape for parent also
> =
	// Check for excess properties in the parent validated against TShape
	keyof Omit<TParentConfig, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final script type: '${keyof Omit<TParentConfig, keyof TShape> & string}'`;

type AnyGenerateTextConfig = configs.ConfigShape<configs.GenerateTextConfig<any, any, any>>;

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
	ValidateResolved<TConfig, keyof Omit<TConfig, keyof TShape> extends never
	? (
		// 2. If no excess, check for required properties missing from the FINAL merged config.
		MissingRequiredKeys<TFinalConfig, TRequired> extends never
		? ValidateToolsContext<TConfig, TFinalConfig>
		: `Config Error: Missing required property '${MissingRequiredKeys<TFinalConfig, TRequired> & string}' in the final configuration.`
	)
	: `Config Error: Unknown properties for this generator type: '${keyof Omit<TConfig, keyof TShape> & string}'`>;


// Generic validator for the `parent` config object.
export type ValidateGenerateTextParentConfig<
	TParentConfig extends Partial<AnyGenerateTextConfig>,
	TShape extends AnyGenerateTextConfig,
> =
	// Check for excess properties in the parent validated against TShape
	NoInfer<keyof Omit<TParentConfig, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final generator type: '${keyof Omit<TParentConfig, keyof TShape> & string}'`>;

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
	ValidateResolved<TConfig, keyof Omit<TConfig, keyof TShape> extends never
	? (
		// 2. If no excess, check for required properties missing from the FINAL merged config.
		MissingRequiredKeys<TFinalConfig, TRequired> extends never
		? ValidateToolsContext<TConfig, TFinalConfig>
		: `Config Error: Missing required property '${MissingRequiredKeys<TFinalConfig, TRequired> & string}' in the final configuration.`
	)
	: `Config Error: Unknown properties for this streamer type: '${keyof Omit<TConfig, keyof TShape> & string}'`>;


// Generic validator for the `parent` config object.
export type ValidateStreamTextParentConfig<
	TParentConfig extends Partial<AnyStreamTextConfig>,
	TShape extends AnyStreamTextConfig,
> =
	// Check for excess properties in the parent validated against TShape
	NoInfer<keyof Omit<TParentConfig, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final streamer type: '${keyof Omit<TParentConfig, keyof TShape> & string}'`>;

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

type GetAllowedKeysForConfig<TConfig extends { output?: string }>
	= keyof ConfigShapeMap[GetOutputType<TConfig>];

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

// A setting inherited from another output mode must still fit the final mode.
type ValidateObjectMode<TFinalConfig, TShape,
	TInvalid = IncompatibleKeys<TFinalConfig, Pick<TShape, Extract<keyof TShape, 'mode'>>>,
> = [TInvalid] extends [never] ? unknown
	: `Config Error: Property '${TInvalid & string}' is incompatible with the final output mode.`;

export type ValidateObjectConfig<
	TConfig extends configs.ConfigShape<configs.GenerateObjectBaseConfig<any, any> & { output?: string | undefined }>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape & Record<string, any>,
	TShapeExtras = EmptyMap,
	TShape = GetObjectConfigShape<TFinalConfig> & TShapeExtras,
	TRequiredShape =
	& (TShapeExtras extends { inputSchema: any } ? GetObjectGeneratorRequiredShape<TFinalConfig> & { inputSchema: any } : GetObjectGeneratorRequiredShape<TFinalConfig>)
	& (TShapeExtras extends { loader: any } ? GetObjectGeneratorRequiredShape<TFinalConfig> & { loader: any } : GetObjectGeneratorRequiredShape<TFinalConfig>)
	& (TShape extends configs.ToolConfig<any, any> ? { prompt: any, model: LanguageModel } : { model: LanguageModel })//@todo - messages instead of prompt?
> =
	// Reusable for object streamer
	// 1. Check for excess properties in TConfig based on the final merged config's own `output` mode.
	ValidateResolved<TConfig, keyof Omit<TConfig, keyof TShape> extends never
		// 2. If no excess, check for properties missing from the FINAL merged config.
		? (
			MissingRequiredKeys<TFinalConfig, TRequiredShape> extends never
			? TConfig & ValidateObjectMode<TFinalConfig, TShape>
			: `Config Error: Missing required properties for output mode '${GetOutputType<TFinalConfig>}' - '${MissingRequiredKeys<TFinalConfig, TRequiredShape> & string}'`
		)
		: `Config Error: Unknown properties for output mode '${GetOutputType<TFinalConfig>}' - '${keyof Omit<TConfig, GetAllowedKeysForConfig<TFinalConfig>> & string}'`
	>;

export type ValidateObjectParentConfig<
	TParentConfig extends configs.ConfigShape<configs.GenerateObjectConfig<any, any, any, any> & { output?: string | undefined }>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape & Record<string, any>,
	TShapeExtras = EmptyMap,
	TShape = GetObjectConfigShape<TFinalConfig> & TShapeExtras,
> =
	// Check for excess properties in the parent; the final config carries the child's provisional marker.
	ValidateResolved<TFinalConfig, keyof Omit<TParentConfig, keyof TShape> extends never
	// The check has passed, return the original config type.
	? TParentConfig
	// On excess property failure, return a descriptive string.
	: `Parent Config Error: Unknown properties for final output mode '${GetOutputType<TFinalConfig>}' - ${keyof Omit<TParentConfig, GetAllowedKeysForConfig<TFinalConfig>> & string}`>;

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
