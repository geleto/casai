import type { FlexibleSchema } from 'ai';
import type { DescriptorInput } from '../types/callbacks.js';
import { validateRegistryConfig, defineTool, namedArguments, prepareExecution, runSettings } from '../execution.js';
import { ConfigError } from '../errors.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateScriptConfig } from '../validate.js';
import { ScriptEngine } from '../ScriptEngine.js';
import * as configs from '../types/config.js';
import * as results from '../types/result.js';
import * as utils from '../types/utils.js';
import type { InferSchema, ScriptPromptType } from '../types/types.js';
import type { ApplicationRun, SourceSetting } from '../types/application.js';
import type { RendererCall } from '../types/input.js';
import type { Provisional, ResolvedConfig } from '../types/provisional.js';
import type { ProcessedConfig } from '../types/merge.js';
import type { RequiredInheritedConfig, ValidateScriptConfig, ValidateScriptParentConfig } from '../types/config-validation.js';

//@todo - move to result
type ScriptOutput<TConfig, TFallback = results.ScriptResult> =
	TConfig extends { schema: infer TSchema } ? InferSchema<TSchema, TFallback> : TFallback;

type ScriptResultPromise<
	TConfig extends configs.ToolConfigShape<configs.ScriptConfig<INPUT, OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT
> =
	Promise<ScriptOutput<TConfig>>;

// Script call signature type
export type ScriptCallSignature<
	TConfig extends configs.ToolConfigShape<configs.ScriptConfig<INPUT, OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT
> = RendererCall<TConfig, ScriptResultPromise<TConfig, INPUT, OUTPUT>, 'script'> & { config: ProcessedConfig<TConfig>; type: string; run: ApplicationRun<TConfig, ScriptOutput<TConfig>, SourceSetting<TConfig, 'script'>> };

export type ScriptCallSignatureWithParent<
	TConfig extends configs.ToolConfigShape<Partial<configs.ScriptConfig<INPUT, OUTPUT>>>,
	TParentConfig extends configs.ToolConfigShape<Partial<configs.ScriptConfig<PARENT_INPUT, PARENT_OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	FinalConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>
> = RendererCall<FinalConfig, Promise<ScriptOutput<FinalConfig>>, 'script'> & { config: FinalConfig; type: string; run: ApplicationRun<FinalConfig, ScriptOutput<FinalConfig>, SourceSetting<FinalConfig, 'script'>> };

// Default behavior: inline/embedded script
function baseScript<
	TConfig extends Provisional<configs.ScriptConfig<INPUT, OUTPUT> & { script: string }>,
	INPUT extends Record<string, any>,
	OUTPUT
>(
	config: TConfig & ValidateScriptConfig<TConfig, TConfig, configs.ScriptConfig<INPUT, OUTPUT>>
): ScriptCallSignature<TConfig, INPUT, OUTPUT>;

function baseScript<
	TConfig extends Provisional<Partial<configs.ScriptConfig<INPUT, OUTPUT>>>,
	TParentConfig extends Partial<configs.ScriptConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TFinalConfig extends configs.FinalScriptConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>
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
	TConfig extends Provisional<configs.ToolConfigShape<configs.ScriptToolConfig<INPUT, OUTPUT, any>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	TDescriptorInput extends FlexibleSchema<Record<string, any>> | undefined = never,
	TDescriptorOutput extends FlexibleSchema | undefined = never,
	TDescriptorContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & DescriptorInput<TConfig, import('../types/merge.js').EmptyMap, TDescriptorInput, TDescriptorOutput, TDescriptorContext> & ValidateScriptConfig<TConfig, TConfig, configs.ScriptToolConfig<INPUT, OUTPUT, any>>
): ScriptCallSignature<TConfig, INPUT, OUTPUT> & results.ComponentToolFromConfig<INPUT, import('../types/application.js').CollectedResult<TConfig>, TConfig>;

function asTool<
	TConfig extends Provisional<configs.ToolConfigShape<Partial<configs.ScriptToolConfig<INPUT, OUTPUT, any>>>>,
	TParentConfig extends Partial<configs.ScriptToolConfig<PARENT_INPUT, PARENT_OUTPUT, any>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalScriptConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TDescriptorInput extends FlexibleSchema<Record<string, any>> | undefined = never,
	TDescriptorOutput extends FlexibleSchema | undefined = never,
	TDescriptorContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & RequiredInheritedConfig<TParentConfig, { script: string; inputSchema: FlexibleSchema<Record<string, any>> }> & DescriptorInput<TConfig, TParentConfig, TDescriptorInput, TDescriptorOutput, TDescriptorContext> & ValidateScriptConfig<TConfig, TFinalConfig, configs.ScriptToolConfig<INPUT, OUTPUT, any>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateScriptParentConfig<TParentConfig, configs.ScriptToolConfig<PARENT_INPUT, PARENT_OUTPUT, any>>>
): ScriptCallSignatureWithParent<TConfig, TParentConfig, INPUT, OUTPUT, PARENT_INPUT, PARENT_OUTPUT> & results.ComponentToolFromConfig<FINAL_INPUT, import('../types/application.js').CollectedResult<TFinalConfig>, TFinalConfig>;

function asTool(
	config: Partial<configs.ScriptToolConfig<any, any>>,
	parent?: configs.ConfigProvider<Partial<configs.ScriptToolConfig<any, any>>>
): any {
	return _createScript(config, 'async-script', parent, true);
}

// loadsScript: load by name via provided loader
function loadsScript<
	TConfig extends Provisional<configs.ScriptConfig<INPUT, OUTPUT> & configs.LoaderConfig>,
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
	TFinalConfig extends configs.FinalScriptConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>
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
	TConfig extends Provisional<configs.ToolConfigShape<configs.ScriptToolConfig<INPUT, OUTPUT, any> & configs.LoaderConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	TDescriptorInput extends FlexibleSchema<Record<string, any>> | undefined = never,
	TDescriptorOutput extends FlexibleSchema | undefined = never,
	TDescriptorContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & DescriptorInput<TConfig, import('../types/merge.js').EmptyMap, TDescriptorInput, TDescriptorOutput, TDescriptorContext> & ValidateScriptConfig<TConfig, TConfig, configs.ScriptToolConfig<INPUT, OUTPUT, any> & configs.LoaderConfig>
): ScriptCallSignature<TConfig, INPUT, OUTPUT> & results.ComponentToolFromConfig<INPUT, import('../types/application.js').CollectedResult<TConfig>, TConfig>;

function loadsScriptAsTool<
	TConfig extends Provisional<configs.ToolConfigShape<Partial<configs.ScriptToolConfig<INPUT, OUTPUT, any> & configs.LoaderConfig>>>,
	TParentConfig extends Partial<configs.ScriptToolConfig<PARENT_INPUT, PARENT_OUTPUT, any> & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalScriptConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TDescriptorInput extends FlexibleSchema<Record<string, any>> | undefined = never,
	TDescriptorOutput extends FlexibleSchema | undefined = never,
	TDescriptorContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & RequiredInheritedConfig<TParentConfig, { script: string; inputSchema: FlexibleSchema<Record<string, any>>; loader: configs.LoaderConfig['loader'] }> & DescriptorInput<TConfig, TParentConfig, TDescriptorInput, TDescriptorOutput, TDescriptorContext> & ValidateScriptConfig<TConfig, TFinalConfig, configs.ScriptToolConfig<INPUT, OUTPUT, any> & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateScriptParentConfig<TParentConfig, configs.ScriptToolConfig<PARENT_INPUT, PARENT_OUTPUT, any> & configs.LoaderConfig>>
): ScriptCallSignatureWithParent<TConfig, TParentConfig, INPUT, OUTPUT, PARENT_INPUT, PARENT_OUTPUT> & results.ComponentToolFromConfig<FINAL_INPUT, import('../types/application.js').CollectedResult<TFinalConfig>, TFinalConfig>;

function loadsScriptAsTool(
	config: Partial<configs.ScriptToolConfig<any, any> & configs.LoaderConfig>,
	parent?: configs.ConfigProvider<Partial<configs.ScriptToolConfig<any, any> & configs.LoaderConfig>>
): any {
	return _createScript(config, 'async-script-name', parent, true);
}

// Internal common creator
function _createScript(
	config: configs.ScriptConfig<any, any>,
	scriptType: ScriptPromptType,
	parent?: configs.ConfigProvider<configs.ScriptConfig<any, any>>,
	isTool = false,
) {
	// Merge configs if parent exists, otherwise use provided config
	//, add promptType to the config
	const merged = parent
		? { ...mergeConfigs(parent.config, config), promptType: scriptType }
		: { ...processConfig(config), promptType: scriptType };

	validateScriptConfig(merged, scriptType, isTool);
	validateRegistryConfig(merged, config);
	if (merged.debug) console.log('[DEBUG] Script created with config:', merged);

	const engine = new ScriptEngine(merged as configs.ScriptConfig<any, any>);
	const run = async (...args: unknown[]) => {
		const settings = runSettings(args, ['script', 'context', 'toolsContext', 'abortSignal']);
		if (settings.script !== undefined && typeof settings.script !== 'string') throw new ConfigError('Script source must be a string.');
		if (settings.script === undefined && merged.script === undefined) throw new ConfigError('A script source must be provided in configuration or at call time.');
		const { context } = await prepareExecution(merged, settings.context,
			settings.abortSignal === undefined ? {} : { abortSignal: settings.abortSignal as AbortSignal }, settings.toolsContext as Record<string, unknown> | undefined, isTool);
		return engine.run(settings.script, context);
	};
	const call = async (...args: unknown[]) => {
		const [first, second, ...rest] = namedArguments(args);
		if (rest.length || (typeof first !== 'string' && second !== undefined)) throw new ConfigError('Unexpected Script arguments.');
		return typeof first === 'string' ? run({ script: first, context: second }) : run({ context: first });
	};
	const component = Object.assign(call, { config: merged, type: 'Script', run });
	return (isTool ? defineTool(component, context => engine.run(undefined, context), merged.schema) : component);
}

export const Script = Object.assign(baseScript, {
	loadsScript: Object.assign(loadsScript, {
		asTool: loadsScriptAsTool
	}),
	asTool,
	loadsScriptAsTool
});
