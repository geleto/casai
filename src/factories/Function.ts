import type { FlexibleSchema } from 'ai';
import type { ApplicationCaller, ApplicationRun, ComponentResult, CollectedResult, ComponentAdmission } from '../types/application.js';
import type { ComponentToolFromConfig } from '../types/result.js';
import { validateRegistryConfig, defineTool, namedArguments, prepareExecution, runSettings } from '../execution.js';
import * as configs from '../types/config.js';
import { mergeConfigs, processConfig } from "../config-utils.js";
import { validateFunctionConfig, validateAndParseOutput } from "../validate.js";
import { ValidationError } from '../errors.js';
import type { EmptyMap, MergedConfig } from '../types/merge.js';
import type { Provisional, ValidateResolved } from '../types/provisional.js';
import type { ValidateFinalConfig, ValidateToolsContext } from '../types/config-validation.js';
import type {
	ConfigInferDefinition, SchemaConfigInferShape, ConfigSchemas,
	FunctionExecuteContext, ToolExecuteContext,
} from '../types/function-config.js';
import * as types from '../types/types.js';

type FinalConfig<TParent, TConfig> = MergedConfig<TParent, TConfig>;

// Callback contextual types come from the separately inferred child schemas, not the provisional child config.
type ChildFunctionContext<Parent, Schemas, Context, Actual, Tools, ToolsContext> =
	FunctionExecuteContext<ConfigInferDefinition<Parent, Schemas, Context, Tools, ToolsContext>, Actual>;
type ChildToolContext<Parent, Schemas, Context, Tools, ToolsContext> =
	ToolExecuteContext<ConfigInferDefinition<Parent, Schemas, Context, Tools, ToolsContext>>;

export type FunctionCallSignature<TConfig> = ApplicationCaller<TConfig, ComponentResult<TConfig>> & {
	readonly config: TConfig;
	readonly type: 'FunctionCall';
	readonly run: ApplicationRun<TConfig, ComponentResult<TConfig>>;
};
export type ToolCallSignature<TConfig> = ApplicationCaller<TConfig, ComponentResult<TConfig>> & {
	readonly config: TConfig;
	readonly run: ApplicationRun<TConfig, ComponentResult<TConfig>>;
} & ComponentToolFromConfig<unknown, CollectedResult<TConfig>, TConfig>;
type ToolFromConfig<T> = ToolCallSignature<T>;

// A child may replace any schema; the final execute, inherited or not, must match the final config.
// With an input schema, callers pass the schema input; without one, they pass what execute declares.
type FunctionSignature<RequiredContext extends boolean> = <
	TSchemaPresence extends object,
	TParentConfig extends object = EmptyMap,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TTools extends object = EmptyMap,
	TToolsContext extends object = EmptyMap,
	TConfig extends Provisional<object> = Provisional<object>,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config:
		SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> &
		(RequiredContext extends true ? { context: CONTEXT } : { context?: CONTEXT | undefined }) & // infer the callback's schemas
		{ tools?: TTools & NoInfer<configs.ToolRegistry>; toolsContext?: TToolsContext } & TConfig & // independently infer registry
		NoInfer<ChildFunctionContext<TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, RequiredContext extends true ? CONTEXT : CONTEXT | undefined, TConfig, TTools, TToolsContext>> &
		ValidateResolved<TConfig, ComponentAdmission<FinalConfig<TParentConfig, TConfig>>> & ValidateToolsContext<TConfig, FinalConfig<TParentConfig, TConfig>> &
		ValidateFinalConfig<TConfig, TParentConfig, FinalConfig<TParentConfig, TConfig>> &
		ValidateResolved<TConfig, types.ValidateContextInputSchema<configs.ConfigValue<FinalConfig<TParentConfig, TConfig>, 'inputSchema'>>>,
	parent?: configs.ConfigProvider<TParentConfig>
) => FunctionCallSignature<FinalConfig<TParentConfig, TConfig>>;

type FunctionFactory = FunctionSignature<true> & FunctionSignature<false>;

function asFunction(config: configs.FunctionConfig<any, any, any, any>, parent?: configs.ConfigProvider<any>): unknown { return _createFunction(config, parent); }

// The schema controls tool context; callback annotations do not widen it.
// A child may replace any schema; the final execute, inherited or not, must match the final config.
function asTool<
	TSchemaPresence extends object,
	TParentConfig extends object = EmptyMap,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TTools extends object = EmptyMap,
	TToolsContext extends object = EmptyMap,
	TConfig extends Provisional<object> = Provisional<object>,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config:
		SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & { context: CONTEXT } & // infer the callback's schemas
		{ tools?: TTools & NoInfer<configs.ToolRegistry>; toolsContext?: TToolsContext } & TConfig &
		NoInfer<ChildToolContext<TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, CONTEXT, TTools, TToolsContext>> &
		ComponentAdmission<FinalConfig<TParentConfig, TConfig>> & ValidateToolsContext<TConfig, FinalConfig<TParentConfig, TConfig>> & import('../types/application.js').ToolOutputAdmission<FinalConfig<TParentConfig, TConfig>> &
		ValidateFinalConfig<TConfig, TParentConfig, FinalConfig<TParentConfig, TConfig>, true>,
	parent?: configs.ConfigProvider<TParentConfig>
): ToolFromConfig<FinalConfig<TParentConfig, TConfig>>;

// Keep definite configured fields required while optional context contributes optional fields.
function asTool<
	TSchemaPresence extends object,
	TParentConfig extends object = EmptyMap,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TTools extends object = EmptyMap,
	TToolsContext extends object = EmptyMap,
	TConfig extends Provisional<object> = Provisional<object>,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config:
		SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & { context?: CONTEXT | undefined } &
		{ tools?: TTools & NoInfer<configs.ToolRegistry>; toolsContext?: TToolsContext } & TConfig &
		NoInfer<ChildToolContext<TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, CONTEXT | undefined, TTools, TToolsContext>> &
		ComponentAdmission<FinalConfig<TParentConfig, TConfig>> & ValidateToolsContext<TConfig, FinalConfig<TParentConfig, TConfig>> & import('../types/application.js').ToolOutputAdmission<FinalConfig<TParentConfig, TConfig>> &
		ValidateFinalConfig<TConfig, TParentConfig, FinalConfig<TParentConfig, TConfig>, true>,
	parent?: configs.ConfigProvider<TParentConfig>
): ToolFromConfig<FinalConfig<TParentConfig, TConfig>>;

function asTool(
	config: configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined, any>,
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
export const Function = Object.assign(asFunction as FunctionFactory, { asTool });
