import { mergeConfigs, processConfig } from '../config-utils.js';
import type * as configs from '../types/config.js';
import type { ValidateConfigFragment } from '../types/config-validation.js';
import type { ToolSet } from 'ai';
import type { EmptyMap, ProcessedConfig } from '../types/merge.js';
import type { Provisional, ResolvedConfig } from '../types/provisional.js';
import type { AnyConfigCallbackInput } from '../types/callbacks.js';
import type { ConfigInferDefinition, SchemaConfigInferShape, ConfigSchemas, AnyConfigExecuteContext } from '../types/function-config.js';
import type * as types from '../types/types.js';
import { validateAnyConfig, validateConfigBasics } from '../validate.js';

// Specialize schema presence before inferring schema-dependent callbacks.
type ConfigSignature = <
	TSchemaPresence extends object,
	TConfig extends Provisional<object>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string = string,
	TSchemaOutput extends types.SchemaType<any> | undefined = never,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TToolsContext extends object = EmptyMap,
	TSchemaInput = never,
	TSchemaContext = never,
>(
	config:
		NoInfer<configs.AnyConfigInferShape<TOOLS, INPUT, OUTPUT, ENUM>> & SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined }, toolsContext?: TToolsContext, context?: CONTEXT } &
		TConfig &
		AnyConfigCallbackInput<TConfig, EmptyMap, TCallbackTools, TSchemaOutput, TCallbackRuntime, TCallbackOutput, TCallbackEnum> &
		NoInfer<AnyConfigExecuteContext<ConfigInferDefinition<EmptyMap, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, CONTEXT, TCallbackTools, TToolsContext>, TConfig>> &
		ValidateConfigFragment<TConfig, TConfig, Partial<configs.AnyConfigShape<TOOLS, INPUT, OUTPUT, ENUM>>>,
) => configs.ConfigProvider<ProcessedConfig<ResolvedConfig<TConfig>>>;

type ParentConfigSignature = <
	TSchemaPresence extends object,
	TConfig extends Provisional<object>,
	TParentConfig extends object,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string = string,
	TSchemaOutput extends types.SchemaType<any> | undefined = never,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TToolsContext extends object = EmptyMap,
	TSchemaInput = never,
	TSchemaContext = never,
>(
	config:
		NoInfer<configs.AnyConfigInferShape<TOOLS, INPUT, OUTPUT, ENUM>> & SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined }, toolsContext?: TToolsContext, context?: CONTEXT } &
		TConfig &
		AnyConfigCallbackInput<TConfig, TParentConfig, TCallbackTools, TSchemaOutput, TCallbackRuntime, TCallbackOutput, TCallbackEnum> &
		NoInfer<AnyConfigExecuteContext<ConfigInferDefinition<TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, CONTEXT, TCallbackTools, TToolsContext>, TConfig>> &
		ValidateConfigFragment<TConfig, configs.MergedConfig<TParentConfig, TConfig>, Partial<configs.AnyConfigShape<ToolSet, INPUT, OUTPUT, ENUM>>>,
	parent: configs.ConfigProvider<TParentConfig> & NoInfer<
		[TParentConfig] extends [configs.AnyConfigInferShape<ToolSet, INPUT, OUTPUT, ENUM>]
		? unknown : 'Parent Config Error: Parent properties must match a supported component configuration.'>
) => configs.ConfigProvider<configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>>;

type ConfigFactory = ConfigSignature & ParentConfigSignature;

// Implementation
export const Config = (function Config(
	config: Partial<configs.AnyConfigShape<ToolSet, Record<string, any>, any, string>>,
	parent?: configs.ConfigProvider<any>
): configs.ConfigProvider<any> {
	// Validate raw values before loader processing and merging can consume them.
	validateConfigBasics(config);
	// Debug output if config.debug is true
	if ('debug' in config && config.debug) {
		console.log('[DEBUG] Config function created with config:', config);
	}

	const merged = parent ? mergeConfigs(parent.config, config) : processConfig(config);
	validateAnyConfig(merged as Partial<configs.AnyConfig<any, any, any, any>>);
	return { config: merged };
}) as ConfigFactory;
