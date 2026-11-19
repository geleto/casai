import { sourceMode, type ResolvedSourceMode, type WithoutSourceMode } from '../config/modifiers.js';
import { configModifiers, createFactory } from './component-factory.js';
import type { MergedConfig, ProcessedConfig } from '../types/merge.js';
import type { EmptyMap, UnionKeys } from '../types/utils.js';
import type { ConfigDataInferShape, ConfigData, ConfigPreparerContext, ToolModeConfig } from '../types/factory-config.js';
import type { ToolSet } from 'ai';
import type { FragmentToolSelections } from '../types/callbacks.js';
import type { ValidateConfigFragment } from '../types/config-validation.js';
import type { AnyConfigExecuteContext, ConfigInferDefinition } from '../types/function-config.js';
import type { PromptType } from '../types/prompt.js';
import type { ResolvedConfig } from '../types/provisional.js';
import type * as configs from '../types/config.js';

// One authoring contract for Config's standalone and inherited calls.
// Keep the explicit object constraint: the all-optional family shape alone can
// let invalid arguments fall back to its provisional type and skip validation.
type SelectedSource<T, P> = T extends unknown ? P extends undefined ? T : WithoutSourceMode<T> & ResolvedSourceMode<P> : never;
type Modified<T, P, A extends boolean, S extends boolean, Selected = ToolModeConfig<SelectedSource<T, P>, A>> =
	import('../types/factory-config.js').StreamModeConfig<Selected, S>;

type ConfigSignature<P extends PromptType | undefined = undefined, A extends boolean = false, S extends boolean = false> = <
	TConfig extends object & configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>,
	// Infer the whole parent union; the merged fragment is checked below.
	TParent extends configs.ConfigProvider<object> = never,
	TParentConfig extends object = TParent['config'],

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,

	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TToolsContext extends object | undefined = EmptyMap,
	CONTEXT extends Record<string, any> | undefined = undefined,
	CopiedSource extends PromptType | undefined = never,
	Inferred = ConfigInferDefinition<[TParentConfig] extends [never] ? EmptyMap : TParentConfig,
		ConfigData<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext, TCallbackTools, TToolsContext>, CONTEXT>,
	Final = Modified<[TParentConfig] extends [never] ? ProcessedConfig<ResolvedConfig<TConfig>>
		: MergedConfig<TParentConfig, ResolvedConfig<TConfig>>, P, A, S>,
>(
	config:
		// Infer schema presence and independent settings before dependent callbacks.
		ConfigDataInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext, TCallbackTools, TToolsContext>
		& { context?: CONTEXT; [sourceMode]?: CopiedSource }
		& TConfig
		& FragmentToolSelections<[TParentConfig] extends [never] ? EmptyMap : TParentConfig, TCallbackTools>
		& NoInfer<[UnionKeys<TConfig> & ('execute' | keyof configs.ToolProperties)] extends [never] ? unknown : AnyConfigExecuteContext<Inferred, TConfig>>
		& NoInfer<ConfigPreparerContext<Inferred,
			P extends undefined ? [CopiedSource] extends [never] ? configs.ConfigValue<TParentConfig, typeof sourceMode> : CopiedSource : P>>
		// Check supplied and inherited settings after inference has completed.
		& ValidateConfigFragment<Modified<ResolvedConfig<TConfig>, P, A, S>, Final,
			Partial<configs.AnyConfigShape<ToolSet, Record<string, any>, unknown>>>,
	...parent: [TParent] extends [never] ? [] : [parent: TParent & NoInfer<[TParentConfig] extends [configs.AnyConfigInferShape<ToolSet, Record<string, any>, unknown>]
		? unknown : 'Config Error: Invalid parent configuration.'>]
) => NoInfer<configs.ConfigProvider<Final>>;

type ConfigModes<P extends PromptType | undefined> = ConfigSignature<P> & {
	asTool: ConfigSignature<P, true>;
	asStream: ConfigSignature<P, false, true>;
};
type ConfigFactory = ConfigModes<undefined> & {
	[M in keyof typeof configModifiers]: ConfigModes<typeof configModifiers[M]>;
};

/** Reusable settings with the same source, tool and streaming selectors as their completed components. */
export const Config = createFactory({ modifiers: configModifiers, asStream: true }, config => ({ config })) as ConfigFactory;
