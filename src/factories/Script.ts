import { attachRendererTool } from '../renderer-tool.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateScriptConfig, validateScriptOrFunctionCall } from '../validate.js';
import { ScriptEngine } from '../ScriptEngine.js';
import * as configs from '../types/config.js';
import * as results from '../types/result.js';
import * as utils from '../types/utils.js';
import type { InferSchema, ScriptPromptType } from '../types/types.js';
import type { RendererCall } from '../types/input.js';
import type { Provisional } from '../types/provisional.js';
import type { ProcessedConfig } from '../types/merge.js';
import type { RequiredInheritedConfig, ValidateScriptConfig, ValidateScriptParentConfig } from '../types/config-validation.js';

//@todo - move to result
type ScriptOutput<TConfig, TFallback = results.ScriptResult> =
	TConfig extends { schema: infer TSchema } ? InferSchema<TSchema, TFallback> : TFallback;

type ScriptResultPromise<
	TConfig extends configs.ScriptConfig<INPUT, OUTPUT>,
	INPUT extends Record<string, any>,
	OUTPUT
> =
	Promise<ScriptOutput<TConfig>>;

// Script call signature type
export type ScriptCallSignature<
	TConfig extends configs.ScriptConfig<INPUT, OUTPUT>,
	INPUT extends Record<string, any>,
	OUTPUT
> = RendererCall<TConfig, ScriptResultPromise<TConfig, INPUT, OUTPUT>, 'script'> & { config: ProcessedConfig<TConfig>; type: string };

export type ScriptCallSignatureWithParent<
	TConfig extends Partial<configs.ScriptConfig<INPUT, OUTPUT>>,
	TParentConfig extends Partial<configs.ScriptConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	_FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	FinalConfig = configs.MergedConfig<TParentConfig, TConfig>
> = RendererCall<FinalConfig, Promise<ScriptOutput<FinalConfig>>, 'script'> & { config: FinalConfig; type: string };


// Default behavior: inline/embedded script
function baseScript<
	const TConfig extends Provisional<configs.ScriptConfig<INPUT, OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT
>(
	config: TConfig & { script: string } & ValidateScriptConfig<TConfig, TConfig, configs.ScriptConfig<INPUT, OUTPUT>>
): ScriptCallSignature<TConfig, INPUT, OUTPUT>;

function baseScript<
	TConfig extends Provisional<Partial<configs.ScriptConfig<INPUT, OUTPUT>>>,
	TParentConfig extends Partial<configs.ScriptConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TFinalConfig extends configs.FinalScriptConfigShape = configs.MergedConfig<TParentConfig, TConfig>
>(
	config: TConfig & RequiredInheritedConfig<TParentConfig, { script: string }> & ValidateScriptConfig<TConfig, TFinalConfig, configs.ScriptConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateScriptParentConfig<TParentConfig, configs.ScriptConfig<PARENT_INPUT, PARENT_OUTPUT>>>
): ScriptCallSignatureWithParent<TConfig, TParentConfig, INPUT, OUTPUT, PARENT_INPUT, PARENT_OUTPUT>;

function baseScript(
	config: configs.ScriptConfig<any, any>,
	parent?: configs.ConfigProvider<configs.ScriptConfig<any, any>>
): any {
	return _createScript(config, 'async-script', parent, false);
}

// asTool method for Script
function asTool<
	const TConfig extends Provisional<configs.ScriptToolConfig<INPUT, OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT
>(
	config: TConfig & ValidateScriptConfig<TConfig, TConfig, configs.ScriptToolConfig<INPUT, OUTPUT>>
): ScriptCallSignature<TConfig, INPUT, OUTPUT> & results.ComponentToolFromConfig<INPUT, ScriptOutput<TConfig>, TConfig>;

function asTool<
	TConfig extends Provisional<Partial<configs.ScriptToolConfig<INPUT, OUTPUT>>>,
	TParentConfig extends Partial<configs.ScriptToolConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalScriptConfigShape = configs.MergedConfig<TParentConfig, TConfig>
>(
	config: TConfig & ValidateScriptConfig<TConfig, TFinalConfig, configs.ScriptToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateScriptParentConfig<TParentConfig, configs.ScriptToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>
): ScriptCallSignatureWithParent<TConfig, TParentConfig, INPUT, OUTPUT, PARENT_INPUT, PARENT_OUTPUT> & results.ComponentToolFromConfig<FINAL_INPUT, ScriptOutput<TFinalConfig>, TFinalConfig>;

function asTool(
	config: Partial<configs.ScriptToolConfig<any, any>>,
	parent?: configs.ConfigProvider<Partial<configs.ScriptToolConfig<any, any>>>
): any {
	return _createScriptAsTool(config, 'async-script', parent);
}

// loadsScript: load by name via provided loader
function loadsScript<
	const TConfig extends Provisional<configs.ScriptConfig<INPUT, OUTPUT> & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT
>(
	config: TConfig & ValidateScriptConfig<TConfig, TConfig, configs.ScriptConfig<INPUT, OUTPUT> & configs.LoaderConfig>
): ScriptCallSignature<TConfig, INPUT, OUTPUT>;

function loadsScript<
	TConfig extends Provisional<Partial<configs.ScriptConfig<INPUT, OUTPUT> & configs.LoaderConfig>>,
	TParentConfig extends Partial<configs.ScriptConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TFinalConfig extends configs.FinalScriptConfigShape = configs.MergedConfig<TParentConfig, TConfig>
>(
	config: TConfig & ValidateScriptConfig<TConfig, TFinalConfig, configs.ScriptConfig<INPUT, OUTPUT> & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateScriptParentConfig<TParentConfig, configs.ScriptConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.LoaderConfig>>
): ScriptCallSignatureWithParent<TConfig, TParentConfig, INPUT, OUTPUT, PARENT_INPUT, PARENT_OUTPUT>;

function loadsScript(
	config: configs.ScriptConfig<any, any> & configs.LoaderConfig,
	parent?: configs.ConfigProvider<configs.ScriptConfig<any, any> & configs.LoaderConfig>
): any {
	return _createScript(config, 'async-script-name', parent, false);
}

// loadsScriptAsTool: load by name via provided loader and return as tool
function loadsScriptAsTool<
	const TConfig extends Provisional<configs.ScriptToolConfig<INPUT, OUTPUT> & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT
>(
	config: TConfig & ValidateScriptConfig<TConfig, TConfig, configs.ScriptToolConfig<INPUT, OUTPUT> & configs.LoaderConfig>
): ScriptCallSignature<TConfig, INPUT, OUTPUT> & results.ComponentToolFromConfig<INPUT, ScriptOutput<TConfig>, TConfig>;

function loadsScriptAsTool<
	TConfig extends Provisional<Partial<configs.ScriptToolConfig<INPUT, OUTPUT> & configs.LoaderConfig>>,
	TParentConfig extends Partial<configs.ScriptToolConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalScriptConfigShape = configs.MergedConfig<TParentConfig, TConfig>
>(
	config: TConfig & ValidateScriptConfig<TConfig, TFinalConfig, configs.ScriptToolConfig<INPUT, OUTPUT> & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateScriptParentConfig<TParentConfig, configs.ScriptToolConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.LoaderConfig>>
): ScriptCallSignatureWithParent<TConfig, TParentConfig, INPUT, OUTPUT, PARENT_INPUT, PARENT_OUTPUT> & results.ComponentToolFromConfig<FINAL_INPUT, ScriptOutput<TFinalConfig>, TFinalConfig>;

function loadsScriptAsTool(
	config: Partial<configs.ScriptToolConfig<any, any> & configs.LoaderConfig>,
	parent?: configs.ConfigProvider<Partial<configs.ScriptToolConfig<any, any> & configs.LoaderConfig>>
): any {
	return _createScriptAsTool(config, 'async-script-name', parent);
}

// Internal common creator
export function _createScript<
	INPUT extends Record<string, any>,
	OUTPUT,
>(
	config: configs.ScriptConfig<INPUT, OUTPUT>,
	scriptType: ScriptPromptType,
	parent?: configs.ConfigProvider<configs.ScriptConfig<INPUT, OUTPUT>>,
	isTool = false,
): ScriptCallSignature<configs.ScriptConfig<INPUT, OUTPUT>, INPUT, OUTPUT> {
	// Merge configs if parent exists, otherwise use provided config
	//, add promptType to the config
	const merged = parent
		? { ...mergeConfigs(parent.config, config), promptType: scriptType }
		: { ...processConfig(config), promptType: scriptType };

	validateScriptConfig(merged, scriptType, isTool);

	// Debug output if config.debug is true
	if ('debug' in merged && merged.debug) {
		console.log('[DEBUG] Script created with config:', merged);
	}

	const runner = new ScriptEngine(merged);

	// Define the call function that handles both cases
	const call = async (scriptOrContext?: INPUT | string, maybeContext?: INPUT): Promise<any> => {
		await validateScriptOrFunctionCall(merged, 'Script', scriptOrContext, maybeContext);

		if ('debug' in merged && merged.debug) {
			console.log('[DEBUG] Script - call function called with:', { scriptOrContext, maybeContext });
		}
		if (typeof scriptOrContext === 'string') {
			const result = await runner.run(scriptOrContext, maybeContext);
			if ('debug' in merged && merged.debug) {
				console.log('[DEBUG] Script - run result:', result);
			}
			return result;
		} else {
			if (maybeContext !== undefined) {
				throw new Error('Second argument must be undefined when not providing script.');
			}
			const result = await runner.run(undefined, scriptOrContext);
			if ('debug' in merged && merged.debug) {
				console.log('[DEBUG] Script - run result:', result);
			}
			return result;
		}
	};

	const callSignature = Object.assign(call, { config: merged, type: 'Script' });

	return callSignature as ScriptCallSignature<configs.ScriptConfig<INPUT, OUTPUT>, INPUT, OUTPUT>;
}

// Internal common creator for tools
export function _createScriptAsTool<
	INPUT extends Record<string, any>,
	OUTPUT,
	TConfig extends Partial<configs.ScriptToolConfig<INPUT, OUTPUT>>,
	TParentConfig extends Partial<configs.ScriptToolConfig<any, any>>,
>(
	config: TConfig,
	scriptType: ScriptPromptType,
	parent?: configs.ConfigProvider<TParentConfig>,
): ScriptCallSignatureWithParent<TConfig, TParentConfig, INPUT, OUTPUT, any, any>
	& results.ComponentToolFromConfig<INPUT, OUTPUT, configs.MergedConfig<TParentConfig, TConfig>> {
	const renderer = _createScript(config, scriptType, parent, true) as unknown as
		ScriptCallSignatureWithParent<TConfig, TParentConfig, INPUT, OUTPUT, any, any>;
	return attachRendererTool<INPUT, OUTPUT, configs.MergedConfig<TParentConfig, TConfig>, typeof renderer>(renderer,
		context =>
			(renderer as unknown as (context: INPUT) => Promise<OUTPUT>)(context),
	);

}

export const Script = Object.assign(baseScript, {
	loadsScript: Object.assign(loadsScript, {
		asTool: loadsScriptAsTool
	}),
	asTool,
	loadsScriptAsTool
});
