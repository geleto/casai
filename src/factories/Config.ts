import type { MergedConfig, ProcessedConfig } from '../types/merge.js';
import type { EmptyMap, UnionKeys } from '../types/utils.js';
import type { ConfigDataInferShape, ConfigData, ConfigPreparerContext } from '../types/factory-config.js';
import type { ToolSet } from 'ai';
import type { FragmentToolSelections } from '../types/callbacks.js';
import type { ValidateConfigFragment } from '../types/config-validation.js';
import type { AnyConfigExecuteContext, ConfigInferDefinition } from '../types/function-config.js';
import type { PromptType } from '../types/prompt.js';
import type { ResolvedConfig } from '../types/provisional.js';
import { mergeConfigs } from '../config/config-utils.js';
import { validateConstructionConfig } from '../config/validate.js';
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
	TSourceMode extends PromptType | undefined = never,
	Inferred = ConfigInferDefinition<[TParentConfig] extends [never] ? EmptyMap : TParentConfig,
		ConfigData<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext, TCallbackTools, TToolsContext>, CONTEXT>,
>(
	config:
		// Infer schema presence and independent settings before dependent callbacks.
		ConfigDataInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext, TCallbackTools, TToolsContext>
		& { context?: CONTEXT; promptType?: TSourceMode }
		& TConfig
		& FragmentToolSelections<[TParentConfig] extends [never] ? EmptyMap : TParentConfig, TCallbackTools>
		& NoInfer<[UnionKeys<TConfig> & ('execute' | keyof configs.ToolProperties)] extends [never] ? unknown : AnyConfigExecuteContext<Inferred, TConfig>>
		& NoInfer<ConfigPreparerContext<Inferred,
			[TSourceMode] extends [never] ? configs.ConfigValue<TParentConfig, 'promptType'> : TSourceMode>>
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
	const merged = mergeConfigs(parent?.config ?? {}, config);
	validateConstructionConfig(merged);
	return { config: merged };
}) as ConfigFactory;
