import type { ComponentToolFromConfig } from '../types/tool-binding.js';
import type { EmptyMap } from '../types/utils.js';
import type { SchemaConfigInferShape, ConfigSchemas, FinalConfig, CallbackParent } from '../types/factory-config.js';
import type { ValidateContextInputSchema, SchemaType } from '../types/schema.js';
import type { FlexibleSchema } from 'ai';
import type { ComponentCaller, ComponentRun } from '../types/input.js';
import type { ComponentResult, CollectedResult } from '../types/result.js';
import type { ComponentAdmission, ToolOutputAdmission, ValidateFinalConfig, ValidateToolsContext } from '../types/config-validation.js';
import type { Provisional, ValidateResolved } from '../types/provisional.js';
import type { ConfigInferDefinition, FunctionExecuteContext, ToolExecuteContext } from '../types/function-config.js';
import { validateRegistryConfig, defineTool, namedArguments, prepareExecution, runSettings } from '../execution.js';
import type * as configs from '../types/config.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateFunctionConfig, validateAndParseOutput } from '../validate.js';
import { ValidationError } from '../errors.js';

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
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig
		& (RequiredContext extends true ? { context: CONTEXT } : { context?: CONTEXT | undefined })
		& { tools?: TTools & NoInfer<configs.ToolRegistry>; toolsContext?: TToolsContext }
		& NoInfer<AsTool extends true
			? ToolExecuteContext<ConfigInferDefinition<CallbackParent<TParentConfig>, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, RequiredContext extends true ? CONTEXT : CONTEXT | undefined, TTools, TToolsContext>>
			: FunctionExecuteContext<ConfigInferDefinition<CallbackParent<TParentConfig>, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, RequiredContext extends true ? CONTEXT : CONTEXT | undefined, TTools, TToolsContext>, TConfig>>
		& ValidateResolved<TConfig, ComponentAdmission<FinalConfig<TParentConfig, TConfig>>>
		& ValidateToolsContext<TConfig, FinalConfig<TParentConfig, TConfig>>
		& ValidateFinalConfig<TConfig, CallbackParent<TParentConfig>, FinalConfig<TParentConfig, TConfig>, AsTool>
		& ValidateResolved<TConfig, AsTool extends true ? ToolOutputAdmission<FinalConfig<TParentConfig, TConfig>>
			: ValidateContextInputSchema<configs.ConfigValue<FinalConfig<TParentConfig, TConfig>, 'inputSchema'>>>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig>]
) => NoInfer<AsTool extends true ? ToolCallSignature<FinalConfig<TParentConfig, TConfig>> : FunctionCallSignature<FinalConfig<TParentConfig, TConfig>>>;

type FunctionFactory<AsTool extends boolean = false> = FunctionSignature<AsTool, true> & FunctionSignature<AsTool, false>;

function asFunction(config: configs.FunctionConfig<any, any, any, any>, parent?: configs.ConfigProvider<any>): unknown { return _createFunction(config, parent); }

function asTool(
	config: configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined, any>,
	parent?:
		| configs.ConfigProvider<any>
		| ToolCallSignature<any>
		| FunctionCallSignature<any>
): any {
	return _createFunction(config, parent as configs.ConfigProvider<any>, true);
}

export function _createFunction(config: configs.FunctionConfig<any, any, any, any>, parent?: configs.ConfigProvider<any>, isTool = false) {
	const merged = parent ? mergeConfigs(parent.config, config) : processConfig(config);
	validateFunctionConfig(merged, isTool);
	validateRegistryConfig(merged, config);
	if (merged.debug) console.log('[DEBUG] Function created with config:', merged);
	const execute = async (context: Record<string, unknown>) => validateAndParseOutput(merged, await (merged.execute as (context: Record<string, unknown>) => unknown)(context));
	const run = async (...args: unknown[]) => {
		const settings = runSettings(args, ['context', 'toolsContext', 'abortSignal']);
		const { context } = await prepareExecution(merged, settings.context,
			settings.abortSignal === undefined ? {} : { abortSignal: settings.abortSignal as AbortSignal }, settings.toolsContext as Record<string, unknown> | undefined, isTool);
		return execute(context);
	};
	const call = async (...args: unknown[]) => {
		const input = namedArguments(args);
		if (input.length > 1) throw new ValidationError('Function accepts one context argument.');
		return run({ context: input[0] });
	};
	const component = Object.assign(call, { config: merged, type: 'FunctionCall', run });
	return isTool ? defineTool(component, execute, merged.schema as FlexibleSchema<unknown> | undefined) : component;
}

export const Function = Object.assign(asFunction as FunctionFactory, { asTool: asTool as FunctionFactory<true> });
