import * as configs from '../types/config';
import * as utils from '../types/utils';
import { mergeConfigs, processConfig } from "../config-utils";
import { validateFunctionConfig, validateScriptOrFunctionCall, validateAndParseOutput } from "../validate";
//import { ExecuteFunction, types.InferSchema, types.SchemaType, ToolExecuteFunction } from '../types/types';
import { ToolCallOptions } from 'ai';
import * as types from '../types/types';

//@todo - document toolCallId handling

// @todo - add FunctionToolCallSignature as parent and get rid of FunctionToolParentConfig
/*type FunctionParentConfig<
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends types.SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig extends configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT>
	| configs.ContextConfig<CONTEXT>
> = TConfig extends configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT>
	? FunctionCallSignature<TInputSchema, TOutputSchema, CONTEXT, TConfig>
	: configs.ConfigProvider<TConfig>;*/

// The full shape of a final, merged config object, including partial and required properties.
// @todo - is this just configs.FunctionConfig?
type FinalFunctionConfigShape
	= Partial<configs.FunctionConfig<types.SchemaType<any> | undefined, types.SchemaType<any> | undefined, any>>
	& { execute: types.FunctionImplementation<types.SchemaType<any> | undefined, types.SchemaType<any> | undefined, any> };//execute is required

//@todo - is this just configs.FunctionToolConfig?
type FinalFunctionToolConfigShape
	= Partial<configs.FunctionToolConfig<types.SchemaType<any>, types.SchemaType<any> | undefined, any>>
	& {//execute and inputSchema are required in tools
		execute: types.FunctionToolImplementation<types.SchemaType<any>, types.SchemaType<any> | undefined, any>
		inputSchema: types.SchemaType<any>
	};


// context is undefined as we call the function with only the input
// because .asTool requires the config properties to be stored on the main object and not
// inside a config property - we implement this without ConfigProvider as done in other egenrators
export type FunctionCallSignature<
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends types.SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig extends configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT>
> = //The context is stored in the config and the caller is called only with the input:
	types.FunctionCaller<TInputSchema, TOutputSchema, TConfig['execute']>//the caller - only accepts input
	//the config - the execute implementation function accepts both input and context:
	& Omit<TConfig, 'execute'>
	& {
		type: 'FunctionCall';
		//the implementation function receives both input and context
		execute: types.FunctionImplementation<TInputSchema, TOutputSchema, CONTEXT, TConfig['execute']>;
	};


// type: function and execute are required by vercel ai
export type ToolCallSignature<
	TInputSchema extends types.SchemaType<Record<string, any>>,
	TOutputSchema extends types.SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig extends configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT>
> = //The context is stored in the config and the caller is called only with the input:
	types.FunctionToolCaller<TInputSchema, TOutputSchema, TConfig['execute']> // no context
	& Omit<TConfig, 'execute'>
	& {
		type: 'function';
		//the implementation function receives both input and context
		execute: types.FunctionToolImplementation<TInputSchema, TOutputSchema, CONTEXT>;
	};

type ValidateFunctionConfig<
	TConfig extends Partial<configs.FunctionConfig<types.SchemaType<any> | undefined, types.SchemaType<any> | undefined, any>>,
	TFinalConfig,
	TShape extends FinalFunctionConfigShape,
	TRequired = { execute: types.FunctionImplementation<any, any, any, any> | undefined },
> = NoInfer<
	// 1. Check for excess properties in TConfig that are not in TShape
	keyof Omit<TConfig, keyof TShape> extends never
	? (
		// 2. If no excess, check for required properties missing from the FINAL merged config.
		keyof Omit<TRequired, keyof TFinalConfig> extends never
		? TConfig // All checks passed.
		: `Config Error: Missing required property '${keyof Omit<TRequired, keyof TFinalConfig> & string}' in the final configuration.`
	)
	: `Config Error: Unknown properties for this generator type: '${keyof Omit<TConfig, keyof TShape> & string}'`
>

type ValidateFunctionToolConfig<
	TConfig extends Partial<configs.FunctionToolConfig<types.SchemaType<any>, types.SchemaType<any> | undefined, any>>,
	TFinalConfig extends configs.FunctionToolConfig<types.SchemaType<any>, types.SchemaType<any> | undefined, any>,
	TShape extends FinalFunctionToolConfigShape,
	TRequired = { execute: types.FunctionToolImplementation<any, any, any> | undefined, inputSchema: types.SchemaType<any> },
> = NoInfer<
	// 1. Check for excess properties in TConfig that are not in TShape
	keyof Omit<TConfig, keyof TShape> extends never
	? (
		// 2. If no excess, check for required properties missing from the FINAL merged config.
		keyof Omit<TRequired, keyof TFinalConfig> extends never
		? TConfig // All checks passed.
		: `Config Error: Missing required property '${keyof Omit<TRequired, keyof TFinalConfig> & string}' in the final configuration.`
	)
	: `Config Error: Unknown properties for this generator type: '${keyof Omit<TConfig, keyof TShape> & string}'`
>

type ValidateParentConfig<
	TParentConfig extends Partial<configs.FunctionConfig<types.SchemaType<any> | undefined, types.SchemaType<any> | undefined, any>> | Partial<configs.FunctionToolConfig<types.SchemaType<any>, types.SchemaType<any> | undefined, any>>,
	TShape extends FinalFunctionConfigShape | FinalFunctionToolConfigShape,
> = NoInfer<
	// Check for excess properties in the parent, validated against the CHILD's factory type (PType).
	keyof Omit<TParentConfig, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final generator type: '${keyof Omit<TParentConfig, keyof TShape> & string}'`
>;

//the default is asFunction
//no parent config
function asFunction<
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = undefined,
	TOutputSchema extends types.SchemaType<any> | undefined = undefined,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TConfig extends configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT> = configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT>,
>(
	config:
		TConfig & // Ensures type is TConfig
		configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT> & // provides inference (schemas and CONTEXT)
		ValidateFunctionConfig<TConfig, TConfig, configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT>>
): FunctionCallSignature<TInputSchema, TOutputSchema, CONTEXT, TConfig>;

// parent config
function asFunction<
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = undefined,
	TOutputSchema extends types.SchemaType<any> | undefined = undefined,
	CONTEXT extends Record<string, any> | undefined = undefined,

	TParentInputSchema extends types.SchemaType<Record<string, any>> | undefined = undefined,
	TParentOutputSchema extends types.SchemaType<any> | undefined = undefined,
	PARENT_CONTEXT extends Record<string, any> | undefined = undefined,

	TConfig extends Partial<configs.FunctionConfig<TInputSchema, TOutputSchema, utils.OverrideContext<PARENT_CONTEXT, CONTEXT>>> = Partial<configs.FunctionConfig<TInputSchema, TOutputSchema, utils.OverrideContext<PARENT_CONTEXT, CONTEXT>>>,
	TParentConfig extends Partial<configs.FunctionConfig<TParentInputSchema, TParentOutputSchema, PARENT_CONTEXT>> = Partial<configs.FunctionConfig<TParentInputSchema, TParentOutputSchema, PARENT_CONTEXT>>,

	FINAL_CONTEXT extends Record<string, any> | undefined = utils.OverrideContext<PARENT_CONTEXT, CONTEXT>,
	TFinalInputSchema extends types.SchemaType<Record<string, any>> | undefined = TInputSchema extends undefined ? TParentInputSchema : TInputSchema,
	TFinalOutputSchema extends types.SchemaType<any> | undefined = TOutputSchema extends undefined ? TParentOutputSchema : TOutputSchema,

	TFinalExecute extends types.FunctionImplementation<any, any, any, any> = TConfig extends { execute: any }
	? TConfig['execute']
	: (TParentConfig['execute'] extends { execute: any } ? TParentConfig['execute'] : never),

	TFinalConfig extends configs.FunctionConfig<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT>
	= utils.Override<TParentConfig, TConfig>
	& Omit<configs.FunctionConfig<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT>, 'execute'>
	& {
		execute: types.FunctionImplementation<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT,
			TFinalExecute
		>
	},
>(
	config:
		{ context?: CONTEXT, inputSchema?: TInputSchema, outputSchema?: TOutputSchema } & //infer
		TConfig & // Ensures type is TConfig
		Partial<configs.FunctionConfig<TInputSchema, TOutputSchema, FINAL_CONTEXT>> & // provides inference (schemas and CONTEXT)
		ValidateFunctionConfig<TConfig, TFinalConfig, configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT>>,
	parent:
		configs.ConfigProvider<
			// a create.Config parent
			Partial<configs.FunctionConfig<TParentInputSchema, TParentOutputSchema, PARENT_CONTEXT>> &
			TParentConfig & // Ensures type is TParentConfig
			ValidateParentConfig<TParentConfig, configs.FunctionConfig<TParentInputSchema, TParentOutputSchema, PARENT_CONTEXT>>
		> | (
			// a create.Function parent
			Partial<configs.FunctionConfig<TParentInputSchema, TParentOutputSchema, PARENT_CONTEXT>> &
			TParentConfig & // Ensures type is TParentConfig
			ValidateParentConfig<TParentConfig, configs.FunctionConfig<TParentInputSchema, TParentOutputSchema, PARENT_CONTEXT>>
		),
): FunctionCallSignature<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT, TFinalConfig>;

function asFunction(
	config: configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>,
	parent?:
		configs.ConfigProvider<
			configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>
		>
		| configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>
): FunctionCallSignature<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>> {
	return _createFunction(config, parent, false);
}

//2. The ToolExecuteFunction accepts options: ToolCallOptions argument
//3. The FunctionToolConfig uses the AI SDK Tool as a base, with replaced execute
// (that allows CONTEXT argument properties) - we want to use the Tool declaration as much as possible
function asTool<
	TInputSchema extends types.SchemaType<Record<string, any>>,
	TOutputSchema extends types.SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig extends configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT>
>(
	config:
		TConfig & // Ensures type is TConfig
		configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT> & // provides inference for inputSchema and outputSchema
		ValidateFunctionToolConfig<TConfig, TConfig, configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT> & { inputSchema: types.SchemaType<any> }>
): ToolCallSignature<TInputSchema, TOutputSchema, CONTEXT, TConfig>;


//function tool with configs.ConfigProvider or Tool parent config
function asTool<
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = undefined,
	TOutputSchema extends types.SchemaType<any> | undefined = undefined,
	CONTEXT extends Record<string, any> | undefined = undefined,

	TParentInputSchema extends types.SchemaType<Record<string, any>> | undefined = undefined,
	TParentOutputSchema extends types.SchemaType<any> | undefined = undefined,
	PARENT_CONTEXT extends Record<string, any> | undefined = undefined,

	TConfig extends Partial<configs.FunctionToolConfig<NonNullable<TInputSchema>, TOutputSchema, utils.OverrideContext<PARENT_CONTEXT, CONTEXT>>>
	= Partial<configs.FunctionToolConfig<NonNullable<TInputSchema>, TOutputSchema, utils.OverrideContext<PARENT_CONTEXT, CONTEXT>>>,
	TParentConfig extends Partial<configs.FunctionToolConfig<NonNullable<TParentInputSchema>, TParentOutputSchema, PARENT_CONTEXT>>
	= Partial<configs.FunctionToolConfig<NonNullable<TParentInputSchema>, TParentOutputSchema, PARENT_CONTEXT>>,

	FINAL_CONTEXT extends Record<string, any> | undefined = utils.OverrideContext<PARENT_CONTEXT, CONTEXT>,
	TFinalInputSchema extends types.SchemaType<Record<string, any>>
	= TInputSchema extends undefined
	? (TParentInputSchema extends undefined ? never : TParentInputSchema)
	: TInputSchema,
	TFinalOutputSchema extends types.SchemaType<any> | undefined = TOutputSchema extends undefined ? TParentOutputSchema : TOutputSchema,

	TFinalExecute extends types.FunctionToolImplementation<any, any, any> = TConfig extends { execute: any }
	? TConfig['execute']
	: (TParentConfig['execute'] extends { execute: any } ? TParentConfig['execute'] : never),

	TFinalConfig extends configs.FunctionToolConfig<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT>
	= utils.Override<TParentConfig, TConfig>
	& Omit<configs.FunctionToolConfig<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT>, 'execute'>
	& {
		execute: types.FunctionToolImplementation<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT,
			TFinalExecute
		>
	},
>(
	config:
		{ context?: CONTEXT, inputSchema?: TInputSchema, outputSchema?: TOutputSchema } & //infer
		TConfig & // Ensures type is TConfig
		Partial<configs.FunctionToolConfig<NonNullable<TInputSchema>, TOutputSchema, FINAL_CONTEXT>> & // provides inference (schemas and CONTEXT)
		ValidateFunctionToolConfig<TConfig, TFinalConfig, configs.FunctionToolConfig<NonNullable<TInputSchema>, TOutputSchema, FINAL_CONTEXT>>,
	parent:
		configs.ConfigProvider<
			// a create.Config parent
			Partial<configs.FunctionToolConfig<NonNullable<TParentInputSchema>, TParentOutputSchema, PARENT_CONTEXT>> &
			TParentConfig & // Ensures type is TParentConfig
			ValidateParentConfig<TParentConfig, configs.FunctionToolConfig<NonNullable<TParentInputSchema>, TParentOutputSchema, PARENT_CONTEXT>>
		> | (
			// a create.Function.asTool parent
			Partial<configs.FunctionToolConfig<NonNullable<TParentInputSchema>, TParentOutputSchema, PARENT_CONTEXT>> &
			TParentConfig & // Ensures type is TParentConfig
			ValidateParentConfig<TParentConfig, configs.FunctionToolConfig<NonNullable<TParentInputSchema>, TParentOutputSchema, PARENT_CONTEXT>>
		),
): ToolCallSignature<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT, TFinalConfig>;

/*function asTool<
	TInputSchema extends types.SchemaType<Record<string, any>>, //required
	TOutputSchema extends types.SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig extends Partial<configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT>>,

	TParentInputSchema extends types.SchemaType<Record<string, any>>,
	TParentOutputSchema extends types.SchemaType<any> | undefined,
	TParentConfig extends Partial<configs.FunctionToolConfig<TParentInputSchema, TParentOutputSchema, CONTEXT>>,

	TFinalInputSchema extends types.SchemaType<Record<string, any>> | undefined
	= TInputSchema extends types.SchemaType<Record<string, any>> ? TInputSchema : TParentInputSchema,

	TFinalOutputSchema extends types.SchemaType<any> | undefined
	= TOutputSchema extends types.SchemaType<any> ? TOutputSchema : TParentOutputSchema,

	TFinalContext extends Record<string, any> | undefined =
	utils.Override<TParentConfig, TConfig> extends { context?: infer C } ? (C extends Record<string, any> ? C : undefined) : undefined,

	TFinalConfig extends configs.FunctionToolConfig<TFinalInputSchema & types.SchemaType<Record<string, any>>, TFinalOutputSchema, any>
	= utils.Override<TParentConfig, TConfig>
	& Omit<configs.FunctionToolConfig<TFinalInputSchema & types.SchemaType<Record<string, any>>, TFinalOutputSchema, any>, 'execute'>
	& {
		execute: types.FunctionToolImplementation<TFinalInputSchema & types.SchemaType<Record<string, any>>, TFinalOutputSchema, any>
	}
>(
	config: TConfig &
		configs.FunctionToolConfig<TInputSchema & types.SchemaType<Record<string, any>>, TOutputSchema, TFinalContext> &
		ValidateFunctionToolConfig<TConfig, TFinalConfig, configs.FunctionToolConfig<TInputSchema & types.SchemaType<Record<string, any>>, TOutputSchema, CONTEXT>>,
	parent: TParentConfig &
		configs.ConfigProvider<TParentConfig & ValidateParentConfig<TParentConfig, configs.FunctionToolConfig<TInputSchema & types.SchemaType<Record<string, any>>, TOutputSchema, any>>> |
		TParentConfig & ValidateParentConfig<TParentConfig, configs.FunctionToolConfig<TInputSchema & types.SchemaType<Record<string, any>>, TOutputSchema, any>>
): ToolCallSignature<TFinalInputSchema & types.SchemaType<Record<string, any>>, TFinalOutputSchema, TFinalContext, TFinalConfig, types.InferSchema<TFinalInputSchema, Record<string, any>>, types.InferSchema<TFinalOutputSchema, any>>;
*/

function asTool(
	config: configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>,
	parent?: configs.ConfigProvider<
		configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>
	> |
		configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>
): any {
	return _createFunctionAsTool(config, parent);
}

/*function asTool(config: configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>>, parent?: configs.ConfigProvider<configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>>> | ToolCallSignature<configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>>, any, any>): any {
	return _createFunctionAsTool(config, parent) as unknown as ToolCallSignature<types.SchemaType<Record<string, any>>, types.SchemaType<any>, configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>>, any, any>;
}*/

export function _createFunction(
	config: configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined> | configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>,
	parent?: configs.ConfigProvider<
		configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>
	> | configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>,
	isTool = false
): FunctionCallSignature<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>> {
	let merged;
	if (parent) {
		merged = mergeConfigs(('config' in parent ? parent.config : parent), config);
	} else {
		merged = processConfig(config);
	}

	validateFunctionConfig(merged, isTool);

	if (merged.debug) {
		console.log('[DEBUG] Function created with config:', JSON.stringify(merged, null, 2));
	}

	// Create a callable function that delegates to the execute method
	const callableFunction = async (inputOrContext: Record<string, any>, options?: ToolCallOptions): Promise<any> => {
		if (isTool) {
			const toolConfig = merged as configs.FunctionToolConfig<any, any, any>;
			const mergedContext = { ...toolConfig.context ?? {}, ...inputOrContext } as Record<string, any>;
			return validateAndParseOutput(toolConfig, await toolConfig.execute(mergedContext, options!));
		}
		const funcConfig = merged as configs.FunctionConfig<any, any, any>;
		validateScriptOrFunctionCall(funcConfig, 'Function', inputOrContext);
		const mergedContext = { ...funcConfig.context ?? {}, ...inputOrContext } as Record<string, any>;
		return validateAndParseOutput(funcConfig, await funcConfig.execute(mergedContext));
	};

	// Merge all properties from merged config into the callable function, but exclude execute
	const { execute: _execute, ...configWithoutExecute } = merged;
	const result = Object.assign(callableFunction, configWithoutExecute, { type: 'FunctionCall' });

	// Attach the original execute function to the result to satisfy the signature
	(result as unknown as { execute: typeof _execute }).execute = _execute;

	return result as unknown as FunctionCallSignature<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>>;
}

function _createFunctionAsTool(
	config: configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>,
	parent?: configs.ConfigProvider<
		configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>
	> | configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>
): ToolCallSignature<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>> {
	const renderer =
		_createFunction(config, parent as configs.FunctionConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>, true) as
		unknown as ToolCallSignature<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined, configs.FunctionToolConfig<types.SchemaType<Record<string, any>>, types.SchemaType<any>, Record<string, any> | undefined>>;
	//the Tool properties are already in the renderer root (not in a config property)

	// Add the execute property back for tools
	renderer.execute = renderer;
	renderer.type = 'function';
	return renderer;
}

const FunctionFactory = Object.assign(asFunction, {
	asTool
});

export { FunctionFactory as Function };