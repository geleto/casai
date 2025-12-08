import * as configs from '../types/config';
import * as utils from '../types/utils';
import { mergeConfigs, processConfig } from "../config-utils";
import { validateFunctionConfig, validateScriptOrFunctionCall, validateAndParseOutput } from "../validate";
import { ExecuteFunction, InferSchema, SchemaType, ToolExecuteFunction } from '../types/types';
import { ConfigProvider } from '../types/config';
import { ToolCallOptions } from 'ai';

//@todo - document toolCallId handling

// @todo - add FunctionToolCallSignature as parent and get rid of FunctionToolParentConfig
type FunctionParentConfig<
	TInputSchema extends SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig extends configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT>
	| configs.ContextConfig<CONTEXT>
> = TConfig extends configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT>
	? FunctionCallSignature<TInputSchema, TOutputSchema, CONTEXT, TConfig>
	: configs.ConfigProvider<TConfig>;

type FunctionToolParentConfig<
	TInputSchema extends SchemaType<Record<string, any>>, //input schema is required
	TOutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined
> = configs.ConfigProvider<configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT>> |
	ToolCallSignature<TInputSchema, TOutputSchema, CONTEXT, configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT>>;


// The full shape of a final, merged config object, including partial and required properties.
// @todo - is this just configs.FunctionConfig?
type FinalFunctionConfigShape
	= Partial<configs.FunctionConfig<SchemaType<any> | undefined, SchemaType<any> | undefined, any>>
	& { execute: ExecuteFunction<any, any, any> };//execute is required

//@todo - is this just configs.FunctionToolConfig?
type FinalFunctionToolConfigShape
	= Partial<configs.FunctionToolConfig<SchemaType<any>, SchemaType<any> | undefined, any>>
	& {//execute and inputSchema are required in tools
		execute: ToolExecuteFunction<any, any, any>
		inputSchema: SchemaType<any>
	};

// context is undefined as we call the function with only the input
// because .asTool requires the config properties to be stored on the main object and not
// inside a config property - we implement this without ConfigProvider as done in other egenrators
export type FunctionCallSignature<
	TInputSchema extends SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig extends configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT>,
	INPUT extends Record<string, any> = InferSchema<TInputSchema, Record<string, any>>,
	OUTPUT = TOutputSchema extends SchemaType<any>
	? InferSchema<TOutputSchema>
	: TConfig['execute'] extends (...args: any) => any ? Awaited<ReturnType<TConfig['execute']>> : any // @todo - validate schema vs execute output
> = //The context is stored in the config and the caller is called only with the input:
	ExecuteFunction<INPUT, OUTPUT, undefined>//the caller - only accepts input
	& //the config - the execute implementation function accepts both input and context:
	Omit<TConfig, 'execute'> & {
		type: 'FunctionCall';
		//the implementation function receives both input and context
		execute: ExecuteFunction<INPUT, OUTPUT, CONTEXT>;
		//}>;
	};


// type: function and execute are required by vercel ai
export type ToolCallSignature<
	TInputSchema extends SchemaType<Record<string, any>>,
	TOutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig extends configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT>,
	INPUT extends Record<string, any> = InferSchema<TInputSchema>,
	OUTPUT = TConfig['schema'] extends SchemaType<any>
	? InferSchema<TConfig['schema']>
	: Awaited<ReturnType<TConfig['execute']>> // @todo - validate schema vs execute output
> =//The context is stored in the config and the caller is called only with the input:
	ToolExecuteFunction<INPUT, OUTPUT, undefined> & // no context
	Omit<TConfig, 'execute'> & {
		type: 'function';
		execute: ToolExecuteFunction<INPUT, OUTPUT, undefined>;//the implementation function receives both input and context
	};

type ValidateFunctionConfig<
	TConfig extends Partial<configs.FunctionConfig<SchemaType<any> | undefined, SchemaType<any> | undefined, any>>,
	TFinalConfig,
	TShape extends FinalFunctionConfigShape,
	TRequired = { execute: ExecuteFunction<Record<string, any>, any, Record<string, any> | undefined> },
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
	TConfig extends Partial<configs.FunctionToolConfig<SchemaType<any>, SchemaType<any> | undefined, any>>,
	TFinalConfig extends configs.FunctionToolConfig<SchemaType<any>, SchemaType<any> | undefined, any>,
	TShape extends FinalFunctionToolConfigShape,
	TRequired = { execute: ToolExecuteFunction<Record<string, any>, any, Record<string, any> | undefined>, inputSchema: SchemaType<Record<string, any>> },
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
	TParentConfig extends Partial<configs.FunctionConfig<SchemaType<any> | undefined, SchemaType<any> | undefined, any>> | Partial<configs.FunctionToolConfig<SchemaType<any>, SchemaType<any> | undefined, any>>,
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
	TInputSchema extends SchemaType<Record<string, any>> | undefined = undefined,
	TOutputSchema extends SchemaType<any> | undefined = undefined,
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
	TInputSchema extends SchemaType<Record<string, any>> | undefined = undefined,
	TOutputSchema extends SchemaType<any> | undefined = undefined,
	CONTEXT extends Record<string, any> | undefined = undefined,

	TParentInputSchema extends SchemaType<Record<string, any>> | undefined = undefined,
	TParentOutputSchema extends SchemaType<any> | undefined = undefined,
	PARENT_CONTEXT extends Record<string, any> | undefined = undefined,

	TConfig extends Partial<configs.FunctionConfig<TInputSchema, TOutputSchema, utils.OverrideContext<PARENT_CONTEXT, CONTEXT>>> = Partial<configs.FunctionConfig<TInputSchema, TOutputSchema, utils.OverrideContext<PARENT_CONTEXT, CONTEXT>>>,
	TParentConfig extends Partial<configs.FunctionConfig<TParentInputSchema, TParentOutputSchema, PARENT_CONTEXT>> = Partial<configs.FunctionConfig<TParentInputSchema, TParentOutputSchema, PARENT_CONTEXT>>,

	FINAL_CONTEXT extends Record<string, any> | undefined = utils.OverrideContext<PARENT_CONTEXT, CONTEXT>,
	TFinalInputSchema extends SchemaType<Record<string, any>> | undefined = TInputSchema extends undefined ? TParentInputSchema : TInputSchema,
	TFinalOutputSchema extends SchemaType<any> | undefined = TOutputSchema extends undefined ? TParentOutputSchema : TOutputSchema,
	TFinalConfig extends configs.FunctionConfig<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT>
	= utils.Override<TParentConfig, TConfig>
	& Omit<configs.FunctionConfig<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT>, 'execute'>
	& { execute: ExecuteFunction<InferSchema<TFinalInputSchema, Record<string, any>>, InferSchema<TFinalOutputSchema>, FINAL_CONTEXT> },
>(
	config:
		{ context?: CONTEXT, inputSchema?: TInputSchema, outputSchema?: TOutputSchema } & //infer
		TConfig & // Ensures type is TConfig
		Partial<configs.FunctionConfig<TInputSchema, TOutputSchema, FINAL_CONTEXT>> & // provides inference (schemas and CONTEXT)
		ValidateFunctionConfig<TConfig, TFinalConfig, configs.FunctionConfig<TInputSchema, TOutputSchema, CONTEXT>>,
	parent:
		configs.ConfigProvider<
			Partial<{ context?: PARENT_CONTEXT, inputSchema: TParentInputSchema, outputSchema: TParentOutputSchema }> &
			TParentConfig & // Ensures type is TParentConfig
			//Partial<configs.FunctionConfig<TParentInputSchema, TParentOutputSchema, PARENT_CONTEXT>> & // provides inference (schemas and CONTEXT)
			ValidateParentConfig<TParentConfig, configs.FunctionConfig<TParentInputSchema, TParentOutputSchema, PARENT_CONTEXT>>
		>,
): FunctionCallSignature<TFinalInputSchema, TFinalOutputSchema, FINAL_CONTEXT, TFinalConfig>;

function asFunction(
	config: configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>,
	parent?: configs.ConfigProvider<configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>>
): FunctionCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined, configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>> {
	return _createFunction(config, parent, false);
}


//function tool, no parent config
// Create.Function.asTool is similar to create.Function - with a few differences:
//1. The FunctionToolConfig inputSchema property is required
//2. The ToolExecuteFunction accepts options: ToolCallOptions argument
//3. The FunctionToolConfig uses the AI SDK Tool as a base, with replaced execute
// (that allows CONTEXT argument properties) - we want to use the Tool declaration as much as possible
function asTool<
	TInputSchema extends SchemaType<Record<string, any>>,
	TOutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig extends configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT, InferSchema<TInputSchema>, InferSchema<TOutputSchema, any>>
>(
	config:
		TConfig & // Ensures type is TConfig
		configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT, InferSchema<TInputSchema>, InferSchema<TOutputSchema, any>> & // provides inference for inputSchema and outputSchema
		ValidateFunctionToolConfig<TConfig, TConfig, configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT, InferSchema<TInputSchema>, InferSchema<TOutputSchema, any>> & { inputSchema: SchemaType<any> }>
): ToolCallSignature<TInputSchema, TOutputSchema, CONTEXT, TConfig>;


//function tool with configs.ConfigProvider or Tool parent config
function asTool<
	TInputSchema extends SchemaType<Record<string, any>>, //required
	TOutputSchema extends SchemaType<any> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TConfig extends Partial<configs.FunctionToolConfig<TInputSchema, TOutputSchema, CONTEXT>>,

	TParentInputSchema extends SchemaType<Record<string, any>>,
	TParentOutputSchema extends SchemaType<any> | undefined,
	TParentConfig extends Partial<configs.FunctionToolConfig<TParentInputSchema, TParentOutputSchema, CONTEXT>>,

	TFinalInputSchema extends SchemaType<Record<string, any>> | undefined
	= TInputSchema extends SchemaType<Record<string, any>> ? TInputSchema : TParentInputSchema,

	TFinalOutputSchema extends SchemaType<any> | undefined
	= TOutputSchema extends SchemaType<any> ? TOutputSchema : TParentOutputSchema,

	TFinalConfig extends configs.FunctionToolConfig<TFinalInputSchema & SchemaType<Record<string, any>>, TFinalOutputSchema, any>
	= utils.Override<TParentConfig, TConfig> & configs.FunctionToolConfig<TFinalInputSchema & SchemaType<Record<string, any>>, TFinalOutputSchema, any>,

	TFinalContext extends Record<string, any> | undefined =
	TFinalConfig extends { context: infer C } ? Exclude<C, undefined> : undefined
>(
	config: TConfig &
		configs.FunctionToolConfig<TInputSchema & SchemaType<Record<string, any>>, TOutputSchema, TFinalContext> &
		ValidateFunctionToolConfig<TConfig, TFinalConfig, configs.FunctionToolConfig<TInputSchema & SchemaType<Record<string, any>>, TOutputSchema, CONTEXT>>,
	parent: TParentConfig &
		configs.ConfigProvider<TParentConfig & ValidateParentConfig<TParentConfig, configs.FunctionToolConfig<TInputSchema & SchemaType<Record<string, any>>, TOutputSchema, any>>> |
		TParentConfig & ValidateParentConfig<TParentConfig, configs.FunctionToolConfig<TInputSchema & SchemaType<Record<string, any>>, TOutputSchema, any>>
): ToolCallSignature<TFinalInputSchema & SchemaType<Record<string, any>>, TFinalOutputSchema, TFinalContext, TFinalConfig, InferSchema<TFinalInputSchema, Record<string, any>>, InferSchema<TFinalOutputSchema, any>>;


function asTool(
	config: configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>,
	parent?: FunctionParentConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined, any> | FunctionToolParentConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>,
): any {
	return _createFunctionAsTool(config, parent);
}

/*function asTool(config: configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>, parent?: configs.ConfigProvider<configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>> | ToolCallSignature<configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>, any, any>): any {
	return _createFunctionAsTool(config, parent) as unknown as ToolCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>, any, any>;
}*/

export function _createFunction(
	config: configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined> | configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>,
	parent?: FunctionParentConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined, any> | FunctionToolParentConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>,
	isTool = false
): FunctionCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined, configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>> {

	let merged;
	if (parent) {
		merged = mergeConfigs(('config' in parent ? (parent as configs.ConfigProvider<configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>>).config : parent), config);
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
			const input = inputOrContext;
			const mergedContext = { ...toolConfig.context ?? {}, ...input };
			return validateAndParseOutput(toolConfig, await toolConfig.execute(mergedContext, options!));
		}
		const funcConfig = merged as configs.FunctionConfig<any, any, any>;
		const context = inputOrContext;
		validateScriptOrFunctionCall(funcConfig, 'Function', context);
		const mergedContext = { ...funcConfig.context ?? {}, ...context };
		return validateAndParseOutput(funcConfig, await funcConfig.execute(mergedContext));
	};

	// Merge all properties from merged config into the callable function, but exclude execute
	const { execute: _execute, ...configWithoutExecute } = merged;
	const result = Object.assign(callableFunction, configWithoutExecute, { type: 'FunctionCall' });

	return result as FunctionCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined, configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>>;
}

function _createFunctionAsTool(
	config: configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>,
	parent?: FunctionParentConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined, any> | FunctionToolParentConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>,
): ToolCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined, configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>, Record<string, any> | undefined>> {
	const renderer = _createFunction(config, parent, true) as any;
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