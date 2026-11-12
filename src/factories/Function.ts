import { createCodedComponent } from '../runtime/coded-component.js';
import { createComponentFactory } from './component-factory.js';
import { ConfigError } from '../errors.js';
import type { ComponentToolFromConfig } from '../types/tool-binding.js';
import type { EmptyMap, UnionKeys } from '../types/utils.js';
import type { ConfigDataInferShape, ConfigData, FinalConfig, CallbackParent, ToolMode, ToolModeConfig, ConfigForToolMode } from '../types/factory-config.js';
import type { ComponentCaller, ComponentRun } from '../types/input.js';
import type { ComponentResult, CollectedResult } from '../types/result.js';
import type { ComponentAdmission, ValidateFinalConfig, ValidateToolsContext } from '../types/config-validation.js';
import type { Provisional, ValidateResolved } from '../types/provisional.js';
import type { ConfigInferDefinition, FunctionExecuteContext, ToolExecuteContext } from '../types/function-config.js';
import type * as configs from '../types/config.js';

export const definition = {
	name: 'Function', main: 'execute', defaultMode: undefined, modifiers: {}, toolModes: [undefined], required: ['execute'], fixedSettings: ['execute', 'schema'], keys: ['execute', 'schema'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;
type Settings = configs.FunctionConfig<any, any, any>;
type ConfigShape = configs.FunctionConfigShape;

export type FunctionCallSignature<TConfig> = ComponentCaller<TConfig, ComponentResult<TConfig>> & {
	readonly config: TConfig;
	readonly run: ComponentRun<TConfig, ComponentResult<TConfig>>;
};
export type ToolCallSignature<TConfig, TToolConfig = TConfig> = FunctionCallSignature<TConfig> & ComponentToolFromConfig<unknown, CollectedResult<TToolConfig>, TToolConfig>;

type FactoryConfig = Partial<configs.FunctionConfigShape>;
// Capture known keys without repeatedly comparing concrete schemas during inference.
// ValidateFinalConfig checks every captured value against the resolved contract.
type FactoryInferShape = Provisional<configs.ConfigShape<FactoryConfig>>;

// Schemas/context infer independently before either implementation callback is checked.
// Infer the result only from arguments. Keep its barrier outside the complete result:
// wrapping config or parent types can hide union correlations from registry consumers.
type FunctionSignature<AsTool extends boolean, RequiredContext extends boolean> = <
	TConfig extends object & FactoryInferShape,
	TParent extends configs.ConfigProvider<object> = never,
	TParentConfig extends object = TParent['config'],

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,

	TTools extends object | undefined = EmptyMap,
	TToolsContext extends object | undefined = EmptyMap,
	CONTEXT extends Record<string, any> | undefined = undefined,
	Inferred = ConfigInferDefinition<CallbackParent<TParentConfig>, ConfigData<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext, TTools, TToolsContext>, RequiredContext extends true ? CONTEXT : CONTEXT | undefined>,
	Final = ToolModeConfig<FinalConfig<TParentConfig, TConfig>, AsTool>,
	EffectiveTool extends boolean = ToolMode<Final, AsTool>,
	ToolConfig = ConfigForToolMode<Final, true, EffectiveTool>,
>(
	config: ConfigDataInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext, TTools, TToolsContext> & TConfig
		& { tools?: configs.ToolRegistry | undefined }
		& (RequiredContext extends true ? { context: CONTEXT } : { context?: CONTEXT | undefined })
		& NoInfer<true extends EffectiveTool
			? ToolExecuteContext<Inferred>
			: FunctionExecuteContext<Inferred, TConfig>>
		& ValidateResolved<TConfig, ComponentAdmission<Final>>
		& ([Extract<UnionKeys<Final>, 'tools' | 'toolsContext'>] extends [never] ? unknown : ValidateToolsContext<TConfig, Final>)
		& ValidateFinalConfig<TConfig, Final, AsTool>,
	...parent: [TParent] extends [never] ? [] : [parent: TParent & NoInfer<[TParentConfig] extends [FactoryConfig]
		? unknown : 'Config Error: Invalid parent configuration.'>]
) => NoInfer<EffectiveTool extends true ? ToolCallSignature<Final, ToolConfig> : FunctionCallSignature<Final>>;

type FunctionFactory<AsTool extends boolean = false> = FunctionSignature<AsTool, true> & FunctionSignature<AsTool, false>;

type Factory = FunctionFactory & { asTool: FunctionFactory<true> };
export const Function = createComponentFactory(definition, createCodedComponent, config => {
	if (typeof config.execute !== 'function') throw new ConfigError("The 'execute' property in a Function config must be a function.");
}) as Factory;

export interface Types<T, A extends boolean, ToolConfig = ConfigForToolMode<T, true, A>> {
	definition: typeof definition;
	settings: Settings;
	component: A extends true ? ToolCallSignature<T, ToolConfig> : FunctionCallSignature<T>;
	config: Settings;
	configShape: ConfigShape;
	result: ComponentResult<T>;
	toolResult: CollectedResult<T>;
}
