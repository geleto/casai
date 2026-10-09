import * as configs from '../types/config.js';
import { mergeConfigs, processConfig } from "../config-utils.js";
import { validateFunctionConfig, validateScriptOrFunctionCall, validateAndParseOutput } from "../validate.js";
//import { ExecuteFunction, types.InferSchema, types.SchemaType, ToolExecuteFunction } from '../types/types.js';
import type { FlexibleSchema, ToolExecutionOptions } from 'ai';
import type { EmptyMap, MergedConfig } from '../types/merge.js';
import type { Provisional, ValidateResolved } from '../types/provisional.js';
import type { ValidateFinalConfig } from '../types/config-validation.js';
import type {
	CallInput, ChildDefinition, ContextOf, DeclaredConfig, ExecuteOf, ExpectedFunctionConfig, ExpectedToolConfig,
	FunctionExecuteContext, OutputSchemaOf, ToolExecuteContext, ToolInputSchemaOf,
} from '../types/function-config.js';
import * as types from '../types/types.js';

// A tool's public execute is its validated caller; inheritance needs the config's implementation.
const toolImplementations = new WeakMap<object, configs.FunctionToolConfig<any, any, any, any, any>['execute']>();

//@todo - document toolCallId handling
// Type-only: a completed tool keeps its raw implementation type so children can check it.
declare const implementationType: unique symbol;

// The definition a parent passes on: its config properties and its raw implementation.
type ParentDefinition<TParent> = DeclaredConfig<typeof implementationType extends keyof TParent
	? Omit<TParent, 'execute' | 'type' | typeof implementationType> & { execute: NonNullable<TParent[typeof implementationType]> }
	: Omit<TParent, 'type'>>;

type FinalConfig<TParent, TConfig> = MergedConfig<ParentDefinition<TParent>, TConfig>;

// Callback contextual types come from the separately inferred child schemas, not the provisional child config.
type ChildFunctionContext<TParent, TInputSchema, TOutputSchema, CONTEXT, TActual> =
	FunctionExecuteContext<ChildDefinition<ParentDefinition<TParent>, TInputSchema, TOutputSchema, CONTEXT, never>, TActual>;
type ChildToolContext<TParent, TInputSchema, TOutputSchema, CONTEXT, TContextSchema> =
	ToolExecuteContext<ChildDefinition<ParentDefinition<TParent>, TInputSchema, TOutputSchema, CONTEXT, TContextSchema>>;

// context is undefined as we call the function with only the input
// because .asTool requires the config properties to be stored on the main object and not
// inside a config property - we implement this without ConfigProvider as done in other egenrators
export type FunctionCallSignature<
	TConfig,
	TExecute extends (...args: any) => any = ExecuteOf<TConfig>,
> = //The context is stored in the config and the caller is called only with the input:
	types.FunctionCaller<CallInput<TConfig>, OutputSchemaOf<TConfig>, TExecute>//the caller - only accepts input
	//the config - the execute implementation function accepts both input and context:
	& Omit<TConfig, 'execute' | 'type'>
	& {
		type: 'FunctionCall';
		//the implementation function receives both input and context
		execute: TExecute;
	};


// type: function and execute are required by vercel ai
type ToolCaller<
	TInputSchema extends types.SchemaType<Record<string, any>>,
	TOutputSchema extends types.SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TOOL_CONTEXT,
	TExecute extends (...args: any) => any,
> = (input: types.InputWithContext<types.InferSchema<TInputSchema>, CONTEXT, TInputSchema, false, true>,
	options: ToolExecutionOptions<TOOL_CONTEXT>) => ReturnType<types.FunctionToolCaller<TInputSchema, TOutputSchema, TExecute, TOOL_CONTEXT>>;

export type ToolCallSignature<
	TInputSchema extends types.SchemaType<Record<string, any>>,
	TOutputSchema extends types.SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig,
	TOOL_CONTEXT = configs.ToolContextFromConfig<TConfig>,
	TExecute extends (...args: any) => any = ExecuteOf<TConfig>,
> = //The context is stored in the config and the caller is called only with the input:
	ToolCaller<TInputSchema, TOutputSchema, CONTEXT, TOOL_CONTEXT, TExecute>
	& Omit<TConfig, 'execute' | 'type'>
	& {
		type: 'function';
		// .execute is the caller: configured context fields are optional overrides.
		execute: ToolCaller<TInputSchema, TOutputSchema, CONTEXT, TOOL_CONTEXT, TExecute>;
		readonly [implementationType]?: TExecute;
	};

type ToolFromConfig<T> = ToolCallSignature<ToolInputSchemaOf<T>, OutputSchemaOf<T>, ContextOf<T>, T, configs.ToolContextFromConfig<T>>;

// A child may replace any schema; the final execute, inherited or not, must match the final config.
// With an input schema, callers pass the schema input; without one, they pass what execute declares.
function asFunction<
	TParentConfig extends object = EmptyMap,
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = never,
	TOutputSchema extends types.SchemaType<any> | undefined = never,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TConfig extends Provisional<object> = Provisional<object>,
>(
	config:
		{ context: CONTEXT, inputSchema?: TInputSchema, schema?: TOutputSchema } & // infer the callback's schemas
		TConfig & // Ensures type is TConfig
		NoInfer<ChildFunctionContext<TParentConfig, TInputSchema, TOutputSchema, CONTEXT, TConfig>> &
		ValidateFinalConfig<TConfig, ParentDefinition<TParentConfig>, FinalConfig<TParentConfig, TConfig>, ExpectedFunctionConfig<FinalConfig<TParentConfig, TConfig>>> &
		ValidateResolved<TConfig, types.ValidateContextInputSchema<configs.DeclaredType<FinalConfig<TParentConfig, TConfig>, 'inputSchema'>>>,
	parent?: configs.ConfigProvider<TParentConfig> | (TParentConfig & { type: 'FunctionCall' })
): FunctionCallSignature<FinalConfig<TParentConfig, TConfig>>;

// An optional context may be absent even when exact optional properties exclude explicit undefined.
function asFunction<
	TParentConfig extends object = EmptyMap,
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = never,
	TOutputSchema extends types.SchemaType<any> | undefined = never,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TConfig extends Provisional<object> = Provisional<object>,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config:
		{ context?: CONTEXT | undefined, inputSchema?: TInputSchema, schema?: TOutputSchema } &
		TConfig &
		NoInfer<ChildFunctionContext<TParentConfig, TInputSchema, TOutputSchema, CONTEXT | undefined, TConfig>> &
		ValidateFinalConfig<TConfig, ParentDefinition<TParentConfig>, FinalConfig<TParentConfig, TConfig>, ExpectedFunctionConfig<FinalConfig<TParentConfig, TConfig>>> &
		ValidateResolved<TConfig, types.ValidateContextInputSchema<configs.DeclaredType<FinalConfig<TParentConfig, TConfig>, 'inputSchema'>>>,
	parent?: configs.ConfigProvider<TParentConfig> | (TParentConfig & { type: 'FunctionCall' })
): FunctionCallSignature<FinalConfig<TParentConfig, TConfig>>;

function asFunction(
	config: configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined>,
	parent?:
		configs.ConfigProvider<
			configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined>
		>
		| configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined>
): FunctionCallSignature<configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined>> {
	return _createFunction(config, parent as configs.ConfigProvider<any>, false);
}

// The schema controls tool context; callback annotations do not widen it.
// A child may replace any schema; the final execute, inherited or not, must match the final config.
function asTool<
	TParentConfig extends object = EmptyMap,
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = never,
	TOutputSchema extends types.SchemaType<any> | undefined = never,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TContextSchema extends FlexibleSchema | undefined = never,
	TConfig extends Provisional<object> = Provisional<object>,
>(
	config:
		{ context: CONTEXT, inputSchema?: TInputSchema, schema?: TOutputSchema, contextSchema?: TContextSchema } & // infer the callback's schemas
		TConfig &
		NoInfer<ChildToolContext<TParentConfig, TInputSchema, TOutputSchema, CONTEXT, TContextSchema>> &
		ValidateFinalConfig<TConfig, ParentDefinition<TParentConfig>, FinalConfig<TParentConfig, TConfig>, ExpectedToolConfig<FinalConfig<TParentConfig, TConfig>>>,
	parent?: configs.ConfigProvider<TParentConfig> | (TParentConfig & { type: 'function' | 'FunctionCall' })
): ToolFromConfig<FinalConfig<TParentConfig, TConfig>>;

// Keep definite configured fields required while optional context contributes optional fields.
function asTool<
	TParentConfig extends object = EmptyMap,
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = never,
	TOutputSchema extends types.SchemaType<any> | undefined = never,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TContextSchema extends FlexibleSchema | undefined = never,
	TConfig extends Provisional<object> = Provisional<object>,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config:
		{ context?: CONTEXT | undefined, inputSchema?: TInputSchema, schema?: TOutputSchema, contextSchema?: TContextSchema } &
		TConfig &
		NoInfer<ChildToolContext<TParentConfig, TInputSchema, TOutputSchema, CONTEXT | undefined, TContextSchema>> &
		ValidateFinalConfig<TConfig, ParentDefinition<TParentConfig>, FinalConfig<TParentConfig, TConfig>, ExpectedToolConfig<FinalConfig<TParentConfig, TConfig>>>,
	parent?: configs.ConfigProvider<TParentConfig> | (TParentConfig & { type: 'function' | 'FunctionCall' })
): ToolFromConfig<FinalConfig<TParentConfig, TConfig>>;

function asTool(
	config: configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined, any>,
	parent?:
		| configs.ConfigProvider<any>
		| ToolCallSignature<any, any, any, any>
		| FunctionCallSignature<any>
): any {
	return _createFunctionAsTool(config, parent as configs.ConfigProvider<any>);
}

export function _createFunction(
	config: configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined> | configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined, any>,
	parent?: configs.ConfigProvider<any>,
	isTool = false
): FunctionCallSignature<configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined>> {
	let merged;
	if (parent) {
		const parentConfig = 'config' in parent ? parent.config as Record<string, any> : parent;
		const implementation = parentConfig.execute === parentConfig ? toolImplementations.get(parentConfig) : undefined;
		merged = mergeConfigs(implementation ? { ...parentConfig, execute: implementation } : parentConfig, config);
	} else {
		merged = processConfig(config);
	}

	validateFunctionConfig(merged, isTool);

	if (merged.debug) {
		console.log('[DEBUG] Function created with config:', merged);
	}

	// Create a callable function that delegates to the execute method
	const callableFunction = async (inputOrContext: Record<string, any>, options: ToolExecutionOptions<unknown>): Promise<any> => {
		if (isTool) {
			const toolConfig = merged as configs.FunctionToolConfig<any, any, any, any, any>;
			const mergedContext = { ...toolConfig.context ?? {}, ...inputOrContext } as Record<string, any>;
			return validateAndParseOutput(toolConfig, await toolConfig.execute(mergedContext, options));
		}
		const funcConfig = merged as configs.FunctionConfig<any, any, any, any>;
		await validateScriptOrFunctionCall(funcConfig, 'Function', inputOrContext);
		const mergedContext = { ...funcConfig.context ?? {}, ...inputOrContext } as Record<string, any>;
		return validateAndParseOutput(funcConfig, await funcConfig.execute(mergedContext));
	};

	// Merge all properties from merged config into the callable function, but exclude execute
	const { execute: _execute, ...configWithoutExecute } = merged as configs.FunctionConfig<any, any, any, any>;
	const result = Object.assign(callableFunction, configWithoutExecute, { type: 'FunctionCall' });

	// Attach the original execute function to the result to satisfy the signature
	(result as unknown as { execute: typeof _execute }).execute = _execute;

	return result as unknown as FunctionCallSignature<configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined>>;
}

function _createFunctionAsTool(
	config: configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined, any>,
	parent?: configs.ConfigProvider<any>
): ToolCallSignature<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined, any>, any> {
	const renderer =
		_createFunction(config, parent, true) as
		unknown as ToolCallSignature<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, Record<string, any> | undefined, any>, any>;
	//the Tool properties are already in the renderer root (not in a config property)

	// Add the execute property back for tools
	toolImplementations.set(renderer, renderer.execute);
	renderer.execute = renderer;
	renderer.type = 'function';
	return renderer;
}

export const Function = Object.assign(asFunction, {
	asTool
});
