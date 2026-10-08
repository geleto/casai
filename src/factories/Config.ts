import { mergeConfigs, processConfig } from '../config-utils.js';
import type * as configs from '../types/config.js';
import type { ValidateConfigFragment } from '../types/config-validation.js';
import type { FlexibleSchema, ToolSet } from 'ai';
import type { EmptyMap, ProcessedConfig } from '../types/merge.js';
import type { Provisional } from '../types/provisional.js';
import type { ChildDefinition, DeclaredConfig, ToolExecuteContext } from '../types/function-config.js';
import type * as types from '../types/types.js';
import { validateAnyConfig, validateConfigBasics } from '../validate.js';

class ConfigData<ConfigType> implements configs.ConfigProvider<ConfigType> {
	constructor(public readonly config: ConfigType) { }
}

// Single config overload
export function Config<
	TConfig extends Provisional<configs.ConfigFragmentShape<TOOLS, INPUT, OUTPUT, ENUM>>,
	TOOLS extends ToolSet, //@todo - handle TOOLS similarly elsewhere
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	ENUM extends string = string,
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = never,
	TOutputSchema extends types.SchemaType<any> | undefined = never,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TContextSchema extends FlexibleSchema | undefined = never,
>(
	config:
		{ tools?: TOOLS, inputSchema?: TInputSchema, schema?: TOutputSchema, context?: CONTEXT, contextSchema?: TContextSchema } &
		TConfig &
		NoInfer<ToolExecuteContext<ChildDefinition<EmptyMap, TInputSchema, TOutputSchema, CONTEXT, TContextSchema>>> &
		ValidateConfigFragment<TConfig, TConfig, Partial<configs.AnyConfigShape<TOOLS, INPUT, OUTPUT, ENUM>>>,
): configs.ConfigProvider<ProcessedConfig<TConfig>>;

// Config with parent overload
export function Config<
	TConfig extends Provisional<configs.ConfigFragmentShape<TOOLS, INPUT, OUTPUT, ENUM>>,
	TParentConfig extends Partial<configs.AnyConfigShape<ToolSet, INPUT, OUTPUT, ENUM>>,
	TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT, ENUM extends string = string,
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = never,
	TOutputSchema extends types.SchemaType<any> | undefined = never,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TContextSchema extends FlexibleSchema | undefined = never,
>(
	config:
		{ tools?: TOOLS, inputSchema?: TInputSchema, schema?: TOutputSchema, context?: CONTEXT, contextSchema?: TContextSchema } &
		TConfig &
		NoInfer<ToolExecuteContext<ChildDefinition<DeclaredConfig<TParentConfig>, TInputSchema, TOutputSchema, CONTEXT, TContextSchema>>> &
		ValidateConfigFragment<TConfig, configs.MergedConfig<DeclaredConfig<TParentConfig>, TConfig>, Partial<configs.AnyConfigShape<ToolSet, INPUT, OUTPUT, ENUM>>>,
	parent: configs.ConfigProvider<TParentConfig>
): configs.ConfigProvider<configs.MergedConfig<TParentConfig, TConfig>>;

// Implementation
export function Config(
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
	return new ConfigData(merged);
}
