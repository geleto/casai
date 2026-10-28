import { createCodedComponent } from '../runtime/coded-component.js';
import type { ComponentToolFromConfig } from '../types/tool-binding.js';
import type { EmptyMap, UnionKeys } from '../types/utils.js';
import type { SchemaConfigInferShape, ConfigSchemas, FinalConfig, CallbackParent, ToolMode, ToolModeConfig } from '../types/factory-config.js';
import type { ComponentCaller, ComponentRun } from '../types/input.js';
import type { ComponentResult, CollectedResult } from '../types/result.js';
import type { ComponentAdmission, ToolOutputAdmission, ValidateFinalConfig, ValidateToolsContext } from '../types/config-validation.js';
import type { Provisional, ValidateResolved } from '../types/provisional.js';
import type { ConfigInferDefinition, FunctionExecuteContext, ToolExecuteContext } from '../types/function-config.js';
import type * as configs from '../types/config.js';

type FunctionComponent<TConfig> = ComponentCaller<TConfig, ComponentResult<TConfig>> & {
	readonly config: TConfig;
	readonly run: ComponentRun<TConfig, ComponentResult<TConfig>>;
};
export type FunctionCallSignature<TConfig> = FunctionComponent<TConfig> & { readonly type: 'FunctionCall' };
export type ToolCallSignature<TConfig> = FunctionComponent<TConfig> & ComponentToolFromConfig<unknown, CollectedResult<TConfig>, TConfig>;

type FactoryConfig = Partial<configs.FunctionConfigShape>;
// Capture known keys without repeatedly comparing concrete schemas during inference.
// ValidateFinalConfig checks every captured value against the resolved contract.
type FactoryInferShape = Provisional<configs.ConfigShape<FactoryConfig>>;

// Schemas/context infer independently before either implementation callback is checked.
// Infer the result only from arguments. Keep its barrier outside the complete result:
// wrapping config or parent types can hide union correlations from registry consumers.
type FunctionSignature<AsTool extends boolean, RequiredContext extends boolean> = <
	TConfig extends object & FactoryInferShape,
	TParentConfig extends object & NoInfer<FactoryConfig> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,

	TTools extends object = EmptyMap,
	TToolsContext extends object = EmptyMap,
	CONTEXT extends Record<string, any> | undefined = undefined,
	Final = ToolModeConfig<FinalConfig<TParentConfig, TConfig>, AsTool>,
	EffectiveTool extends boolean = ToolMode<Final, AsTool>,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig
		& (RequiredContext extends true ? { context: CONTEXT } : { context?: CONTEXT | undefined })
		& { tools?: TTools & NoInfer<configs.ToolRegistry>; toolsContext?: TToolsContext }
		& NoInfer<true extends EffectiveTool
			? ToolExecuteContext<ConfigInferDefinition<CallbackParent<TParentConfig>, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, RequiredContext extends true ? CONTEXT : CONTEXT | undefined, TTools, TToolsContext>>
			: FunctionExecuteContext<ConfigInferDefinition<CallbackParent<TParentConfig>, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, RequiredContext extends true ? CONTEXT : CONTEXT | undefined, TTools, TToolsContext>, TConfig>>
		& ValidateResolved<TConfig, ComponentAdmission<Final>>
		& ([Extract<UnionKeys<Final>, 'tools' | 'toolsContext'>] extends [never] ? unknown : ValidateToolsContext<TConfig, Final>)
		& ValidateFinalConfig<TConfig, CallbackParent<TParentConfig>, Final, true extends EffectiveTool ? true : false>
		& ValidateResolved<TConfig, true extends EffectiveTool ? ToolOutputAdmission<Final> : unknown>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig>]
) => NoInfer<EffectiveTool extends true ? ToolCallSignature<Final> : FunctionCallSignature<Final>>;

type FunctionFactory<AsTool extends boolean = false> = FunctionSignature<AsTool, true> & FunctionSignature<AsTool, false>;

export const Function = Object.assign(
	((config: configs.FunctionConfig<any, any, any, any>, parent?: configs.ConfigProvider<any>) => createCodedComponent('Function', config, parent)) as FunctionFactory,
	{ asTool: ((config: configs.FunctionConfig<any, any, any, any>, parent?: configs.ConfigProvider<any>) => createCodedComponent('Function', config, parent, undefined, true)) as FunctionFactory<true> },
);
