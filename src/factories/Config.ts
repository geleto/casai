import type { MergedConfig, ProcessedConfig } from '../types/merge.js';
import type { EmptyMap } from '../types/utils.js';
import type { SchemaConfigInferShape, ConfigSchemas } from '../types/factory-config.js';
import type { ToolSet } from 'ai';
import type { AIOutput } from '../types/sdk.js';
import type { AnyConfigCallbackInput } from '../types/callbacks.js';
import type { ValidateConfigFragment } from '../types/config-validation.js';
import type { AnyConfigExecuteContext, ConfigInferDefinition } from '../types/function-config.js';
import type { ResolvedConfig } from '../types/provisional.js';
import { mergeConfigs, processConfig } from '../config/config-utils.js';
import { validateAnyConfig, validateConfigBasics } from '../config/validate.js';
import type * as configs from '../types/config.js';

// One authoring contract for Config's standalone and inherited calls.
// Keep the explicit object constraint: the all-optional family shape alone can
// let invalid arguments fall back to its provisional type and skip validation.
type ConfigFactory = <
	TConfig extends object & configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>,
	// No parent leaves this at never; NoInfer avoids expanding its bound during inference.
	TParentConfig extends object & NoInfer<configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,

	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TToolsContext extends object | undefined = EmptyMap,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends AIOutput | undefined = never,
>(
	config:
		// Infer schema presence and independent settings before dependent callbacks.
		SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>
		& { toolsContext?: TToolsContext, context?: CONTEXT }
		& TConfig
		& AnyConfigCallbackInput<TConfig, [TParentConfig] extends [never] ? EmptyMap : TParentConfig,
			ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & { context: CONTEXT; toolsContext: TToolsContext },
			TCallbackTools, TCallbackRuntime, TCallbackOutput>
		& NoInfer<AnyConfigExecuteContext<ConfigInferDefinition<[TParentConfig] extends [never] ? EmptyMap : TParentConfig,
			ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, CONTEXT, TCallbackTools, TToolsContext>, TConfig>>
		// Check supplied and inherited settings after inference has completed.
		& ValidateConfigFragment<TConfig, [TParentConfig] extends [never] ? TConfig : MergedConfig<TParentConfig, TConfig>,
			Partial<configs.AnyConfigShape<ToolSet, Record<string, any>, unknown>>>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig>]
) => NoInfer<configs.ConfigProvider<[TParentConfig] extends [never]
	? ProcessedConfig<ResolvedConfig<TConfig>>
	// Block return-driven inference around the complete result, so parent alternatives still distribute.
	: MergedConfig<TParentConfig, ResolvedConfig<TConfig>>>>;

// Implementation
export const Config = (function Config(
	config: Partial<configs.AnyConfigShape<ToolSet, Record<string, any>, any>>,
	parent?: configs.ConfigProvider<any>
): configs.ConfigProvider<any> {
	// Validate raw values before loader processing and merging can consume them.
	validateConfigBasics(config);
	// Debug output if config.debug is true
	if ('debug' in config && config.debug) {
		console.log('[DEBUG] Config function created with config:', config);
	}

	const merged = parent ? mergeConfigs(parent.config, config) : processConfig(config);
	validateAnyConfig(merged as Partial<configs.AnyConfig<any, any, any>>);
	return { config: merged };
}) as ConfigFactory;
