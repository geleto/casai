import * as configs from '../types/config';
import * as utils from '../types/utils';
import { mergeConfigs, processConfig } from "../config-utils";
import { validateFunctionConfig, validateScriptOrFunctionCall, validateAndParseOutput } from "../validate";
import { ExecuteFunction, InferSchema, SchemaType, ToolExecuteFunction } from '../types/types';

type ToolOrFunctionConfig<
	TInputSchema extends SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends SchemaType<any> | undefined
> = configs.FunctionConfig<TInputSchema, TOutputSchema> |
	(TInputSchema extends SchemaType<Record<string, any>> // Tool requires inputSchema
		? configs.FunctionToolConfig<TInputSchema, TOutputSchema>
		: never
	);

type FunctionParentConfig<
	TInputSchema extends SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends SchemaType<any> | undefined
> = configs.ConfigProvider<configs.FunctionConfig<TInputSchema, TOutputSchema>> |
	FunctionCallSignature<TInputSchema, TOutputSchema, configs.FunctionConfig<TInputSchema, TOutputSchema>>;

type FunctionToolParentConfig<
	TInputSchema extends SchemaType<Record<string, any>>, //input schema is required
	TOutputSchema extends SchemaType<any> | undefined
> = configs.ConfigProvider<configs.FunctionToolConfig<TInputSchema, TOutputSchema>> |
	ToolCallSignature<TInputSchema, TOutputSchema, configs.FunctionToolConfig<TInputSchema, TOutputSchema>>;

// The full shape of a final, merged config object, including required properties. @todo why re-define execute?
type FinalFunctionConfigShape = Partial<Omit<ToolOrFunctionConfig<any, any>, 'execute'> & { execute?: any }>;

export type FunctionCallSignature<
	TInputSchema extends SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends SchemaType<any> | undefined,
	TConfig extends configs.FunctionConfig<TInputSchema, TOutputSchema>,
	INPUT extends Record<string, any> = InferSchema<TInputSchema>,
	OUTPUT = TConfig['schema'] extends SchemaType<any>
	? InferSchema<TConfig['schema']>
	: Awaited<ReturnType<TConfig['execute']>>
> =
	ExecuteFunction<INPUT, OUTPUT> &
	Omit<TConfig, 'execute'> & {
		type: 'FunctionCall';
		execute: ExecuteFunction<INPUT, OUTPUT>;
	};


// type: function and execute are required by vercel ai
export type ToolCallSignature<
	TInputSchema extends SchemaType<Record<string, any>>,
	TOutputSchema extends SchemaType<any> | undefined,
	TConfig extends configs.FunctionToolConfig<TInputSchema, TOutputSchema>,
	INPUT extends Record<string, any> = InferSchema<TInputSchema>,
	OUTPUT = TConfig['schema'] extends SchemaType<any>
	? InferSchema<TConfig['schema']>
	: Awaited<ReturnType<TConfig['execute']>>
> =
	ToolExecuteFunction<INPUT, OUTPUT> &
	Omit<TConfig, 'execute'> & {
		type: 'function';
		execute: ToolExecuteFunction<INPUT, OUTPUT>;
	};

type ValidateFunctionConfig<
	TConfig extends Partial<ToolOrFunctionConfig<SchemaType<any> | undefined, SchemaType<any> | undefined>>,
	TFinalConfig extends FinalFunctionConfigShape,
	TShape extends FinalFunctionConfigShape,
	IsTool extends boolean,
	TRequired = IsTool extends true
	? { inputSchema: SchemaType<Record<string, any>>, execute: ToolExecuteFunction<Record<string, any>, any> }// Tools require inputSchema
	: { execute: ExecuteFunction<Record<string, any>, any> },
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
	TParentConfig extends FinalFunctionConfigShape,
	TShape extends FinalFunctionConfigShape,
> = NoInfer<
	// Check for excess properties in the parent, validated against the CHILD's factory type (PType).
	keyof Omit<TParentConfig, keyof TShape> extends never
	? TParentConfig // The check has passed.
	: `Parent Config Error: Parent has properties not allowed for the final generator type: '${keyof Omit<TParentConfig, keyof TShape> & string}'`
>;

//the default is asFunction
//no parent config
function asFunction<
	TInputSchema extends SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends SchemaType<any> | undefined,
	TConfig extends configs.FunctionConfig<TInputSchema, TOutputSchema>
>(
	config:
		TConfig & // Ensures type is TConfig
		configs.FunctionConfig<TInputSchema, TOutputSchema> & // provides inference for inputSchema and outputSchema
		ValidateFunctionConfig<TConfig, TConfig, configs.FunctionConfig<TInputSchema, TOutputSchema>, false>
): FunctionCallSignature<TInputSchema, TOutputSchema, TConfig>;

//with configs.ConfigProvider or Functionparent config
function asFunction<
	TInputSchema extends SchemaType<Record<string, any>> | undefined,
	TOutputSchema extends SchemaType<any> | undefined,
	TConfig extends Partial<configs.FunctionConfig<TInputSchema, TOutputSchema>>,

	TParentInputSchema extends SchemaType<Record<string, any>> | undefined,
	TParentOutputSchema extends SchemaType<any> | undefined,
	TParentConfig extends Partial<configs.FunctionConfig<TParentInputSchema, TParentOutputSchema>>,

	TFinalInputSchema extends SchemaType<Record<string, any>> | undefined = TConfig['inputSchema'] extends SchemaType<Record<string, any>>
	? TConfig['inputSchema']
	: TParentConfig['inputSchema'],
	TFinalOutputSchema extends SchemaType<any> | undefined = TConfig['schema'] extends SchemaType<any>
	? TConfig['schema']
	: TParentConfig['schema'],
	TFinalConfig extends configs.FunctionConfig<TFinalInputSchema, TFinalOutputSchema> = utils.Override<TParentConfig, TConfig> & configs.FunctionConfig<TFinalInputSchema, TFinalOutputSchema>,
>(
	config: TConfig &
		configs.FunctionConfig<TInputSchema, TOutputSchema> &
		ValidateFunctionConfig<TConfig, TFinalConfig, configs.FunctionConfig<TInputSchema, TOutputSchema>, false>,
	parent: TParentConfig &
		configs.ConfigProvider<TParentConfig & ValidateParentConfig<TParentConfig, configs.FunctionConfig<TInputSchema, TOutputSchema>>> |
		TParentConfig & ValidateParentConfig<TParentConfig, configs.FunctionConfig<TInputSchema, TOutputSchema>>
): FunctionCallSignature<TFinalInputSchema, TFinalOutputSchema, TFinalConfig>;

function asFunction(
	config: configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>>,
	parent?: configs.ConfigProvider<configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>>>
): FunctionCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>>> {
	return _createFunction(config, parent, false);
}


//function tool, no parent config
function asTool<
	TInputSchema extends SchemaType<Record<string, any>>,
	TOutputSchema extends SchemaType<any> | undefined,
	TConfig extends configs.FunctionToolConfig<TInputSchema, TOutputSchema>
>(
	config:
		TConfig & // Ensures type is TConfig
		configs.FunctionToolConfig<TInputSchema, TOutputSchema> & // provides inference for inputSchema and outputSchema
		ValidateFunctionConfig<TConfig, TConfig, configs.FunctionToolConfig<TInputSchema, TOutputSchema>, true>
): ToolCallSignature<TInputSchema, TOutputSchema, TConfig>;


//function tool with configs.ConfigProvider or Tool parent config
function asTool<
	TInputSchema extends SchemaType<Record<string, any>>, //required
	TOutputSchema extends SchemaType<any> | undefined,
	TConfig extends Partial<configs.FunctionToolConfig<TInputSchema, TOutputSchema>>,

	TParentInputSchema extends SchemaType<Record<string, any>>,
	TParentOutputSchema extends SchemaType<any> | undefined,
	TParentConfig extends Partial<configs.FunctionToolConfig<TParentInputSchema, TParentOutputSchema>>,

	TFinalInputSchema extends SchemaType<Record<string, any>> | undefined
	= TInputSchema extends SchemaType<Record<string, any>> ? TInputSchema : TParentInputSchema,

	TFinalOutputSchema extends SchemaType<any> | undefined
	= TOutputSchema extends SchemaType<any> ? TOutputSchema : TParentOutputSchema,

	TFinalConfig extends configs.FunctionToolConfig<TFinalInputSchema & SchemaType<Record<string, any>>, TFinalOutputSchema>
	= utils.Override<TParentConfig, TConfig> & configs.FunctionToolConfig<TFinalInputSchema & SchemaType<Record<string, any>>, TFinalOutputSchema>,
>(
	config: TConfig &
		configs.FunctionToolConfig<TInputSchema & SchemaType<Record<string, any>>, TOutputSchema> &
		ValidateFunctionConfig<TConfig, TFinalConfig, configs.FunctionToolConfig<TInputSchema & SchemaType<Record<string, any>>, TOutputSchema>, true>,
	parent: TParentConfig &
		configs.ConfigProvider<TParentConfig & ValidateParentConfig<TParentConfig, configs.FunctionToolConfig<TInputSchema & SchemaType<Record<string, any>>, TOutputSchema>>> |
		TParentConfig & ValidateParentConfig<TParentConfig, configs.FunctionToolConfig<TInputSchema & SchemaType<Record<string, any>>, TOutputSchema>>
): ToolCallSignature<TFinalInputSchema & SchemaType<Record<string, any>>, TFinalOutputSchema, TFinalConfig>;


function asTool(
	config: configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>,
	parent?: FunctionToolParentConfig<SchemaType<Record<string, any>>, SchemaType<any>>
): ToolCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>> {
	return _createFunctionAsTool(config, parent);
}

/*function asTool(config: configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>, parent?: configs.ConfigProvider<configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>> | ToolCallSignature<configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>, any, any>): any {
	return _createFunctionAsTool(config, parent) as unknown as ToolCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>, any, any>;
}*/

export function _createFunction(
	config: configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>> | configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>,
	parent?: FunctionParentConfig<SchemaType<Record<string, any>>, SchemaType<any>> | FunctionToolParentConfig<SchemaType<Record<string, any>>, SchemaType<any>>,
	isTool = false
): FunctionCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>>> {

	let merged;
	if (parent) {
		merged = mergeConfigs(('config' in parent ? (parent as configs.ConfigProvider<configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>>>).config : parent), config);
	} else {
		merged = processConfig(config);
	}

	validateFunctionConfig(merged, isTool);

	if (merged.debug) {
		console.log('[DEBUG] Function created with config:', JSON.stringify(merged, null, 2));
	}

	// Create a callable function that delegates to the execute method
	const callableFunction = async (context: Record<string, any>): Promise<any> => {
		validateScriptOrFunctionCall(merged, 'Function', context);
		const mergedContext = { ...merged.context ?? {}, ...context };
		return validateAndParseOutput(merged, await merged.execute(mergedContext));
	};

	// Merge all properties from merged config into the callable function, but exclude execute
	const { execute: _execute, ...configWithoutExecute } = merged;
	const result = Object.assign(callableFunction, configWithoutExecute, { type: 'FunctionCall' });

	return result as FunctionCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, configs.FunctionConfig<SchemaType<Record<string, any>>, SchemaType<any>>>;
}

function _createFunctionAsTool(
	config: configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>,
	parent?: FunctionParentConfig<SchemaType<Record<string, any>>, SchemaType<any>> | FunctionToolParentConfig<SchemaType<Record<string, any>>, SchemaType<any>>,
): ToolCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>> {
	const renderer = _createFunction(config, parent, true) as unknown as
		ToolCallSignature<SchemaType<Record<string, any>>, SchemaType<any>, configs.FunctionToolConfig<SchemaType<Record<string, any>>, SchemaType<any>>>;
	//the Tool properties are already in the renderer root (not in a config property)

	// Add the execute property back for tools
	renderer.execute = config.execute;
	renderer.type = 'function';
	return renderer;
}

export const Function = Object.assign(asFunction, {
	asTool
});