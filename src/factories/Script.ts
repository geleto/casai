import type { InferSchema } from '../types/schema.js';
import type { EmptyMap } from '../types/utils.js';
import type { SchemaConfigInferShape, ConfigSchemas, FinalConfig, CallbackParent } from '../types/factory-config.js';
import type { ComponentToolFromConfig } from '../types/tool-binding.js';
import type { ScriptPromptType } from '../types/prompt.js';
import type { ToolConfigShape, ScriptConfig, ToolContextSchemaConfig } from '../types/config.js';
import type { DescriptorInput } from '../types/callbacks.js';
import type { ComponentRun, SourceSetting, RendererCall } from '../types/input.js';
import type { ValidateResolved } from '../types/provisional.js';
import type { ProcessedConfig } from '../types/merge.js';
import type { ValidateScriptConfig, ValidateScriptParentConfig } from '../types/config-validation.js';
import type { CollectedResult } from '../types/result.js';
import { validateRegistryConfig, defineTool, namedArguments, prepareExecution, runSettings } from '../execution.js';
import { ValidationError } from '../errors.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateScriptConfig } from '../validate.js';
import { ScriptEngine } from '../ScriptEngine.js';
import type * as configs from '../types/config.js';
import type * as results from '../types/result.js';

type FinalScriptConfigShape = Partial<ToolConfigShape<ScriptConfig<any, any> & ToolContextSchemaConfig<any>>>;

type ScriptOutput<TConfig> = TConfig extends { schema: infer Schema } ? InferSchema<Schema> : results.ScriptResult;

type FactoryConfig<Named extends boolean, AsTool extends boolean> =
	(AsTool extends true ? configs.ScriptToolConfig<Record<string, any>, unknown> : configs.ScriptConfig<Record<string, any>, unknown>) & (Named extends true ? configs.LoaderConfig : EmptyMap);

type ScriptCallSignature<TConfig> = RendererCall<TConfig, Promise<ScriptOutput<TConfig>>, 'script'> & {
	config: ProcessedConfig<TConfig>;
	type: string;
	run: ComponentRun<TConfig, ScriptOutput<TConfig>, SourceSetting<TConfig, 'script'>>;
};

type ScriptFactory<Named extends boolean = false, AsTool extends boolean = false> = <
	TConfig extends object & configs.ToolConfigInferShape<FactoryConfig<Named, AsTool>>,
	TParentConfig extends object & NoInfer<configs.ParentToolConfigInferShape<FactoryConfig<Named, AsTool>>> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig
		& (AsTool extends true ? DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, CallbackParent<TParentConfig>> : unknown)
		& ValidateScriptConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryConfig<Named, AsTool>>
		& ValidateResolved<TConfig, [FinalConfig<TParentConfig, TConfig>] extends [FinalScriptConfigShape]
			? unknown : 'Config Error: Invalid script settings.'>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ValidateScriptParentConfig<TParentConfig, FactoryConfig<Named, AsTool>>>]
) => ScriptCallSignature<FinalConfig<TParentConfig, TConfig>>
	& (AsTool extends true ? ComponentToolFromConfig<Record<string, any>, CollectedResult<FinalConfig<TParentConfig, TConfig>>, FinalConfig<TParentConfig, TConfig>> : unknown);

function baseScript(
	config: configs.ScriptConfig<any, any>,
	parent?: configs.ConfigProvider<configs.ScriptConfig<any, any>>
): any {
	return _createScript(config, 'async-script', parent, false);
}

function asTool(
	config: Partial<configs.ScriptToolConfig<any, any>>,
	parent?: configs.ConfigProvider<Partial<configs.ScriptToolConfig<any, any>>>
): any {
	return _createScript(config, 'async-script', parent, true);
}

function loadsScript(
	config: configs.ScriptConfig<any, any> & configs.LoaderConfig,
	parent?: configs.ConfigProvider<configs.ScriptConfig<any, any> & configs.LoaderConfig>
): any {
	return _createScript(config, 'async-script-name', parent, false);
}

function loadsScriptAsTool(
	config: Partial<configs.ScriptToolConfig<any, any> & configs.LoaderConfig>,
	parent?: configs.ConfigProvider<Partial<configs.ScriptToolConfig<any, any> & configs.LoaderConfig>>
): any {
	return _createScript(config, 'async-script-name', parent, true);
}

function _createScript(
	config: configs.ScriptConfig<any, any>,
	promptType: ScriptPromptType,
	parent?: configs.ConfigProvider<configs.ScriptConfig<any, any>>,
	isTool = false,
) {
	// Merge configs if parent exists, otherwise use provided config
	//, add promptType to the config
	const merged = parent
		? { ...mergeConfigs(parent.config, config), promptType }
		: { ...processConfig(config), promptType };

	validateScriptConfig(merged, promptType, isTool);
	validateRegistryConfig(merged, config);
	if (merged.debug) console.log('[DEBUG] Script created with config:', merged);

	const engine = new ScriptEngine(merged as configs.ScriptConfig<any, any>);
	const run = async (...args: unknown[]) => {
		const settings = runSettings(args, ['script', 'context', 'toolsContext', 'abortSignal']);
		if (settings.script !== undefined && typeof settings.script !== 'string') throw new ValidationError('Script source must be a string.');
		if (settings.script === undefined && merged.script === undefined) throw new ValidationError('A script source must be provided in configuration or at call time.');
		const { context } = await prepareExecution(merged, settings.context,
			settings.abortSignal === undefined ? {} : { abortSignal: settings.abortSignal as AbortSignal }, settings.toolsContext as Record<string, unknown> | undefined, isTool);
		return engine.run(settings.script, context);
	};
	const call = async (...args: unknown[]) => {
		const [first, second, ...rest] = namedArguments(args);
		if (rest.length || (typeof first !== 'string' && second !== undefined)) throw new ValidationError('Unexpected Script arguments.');
		return typeof first === 'string' ? run({ script: first, context: second }) : run({ context: first });
	};
	const component = Object.assign(call, { config: merged, type: 'Script', run });
	return (isTool ? defineTool(component, context => engine.run(undefined, context), merged.schema) : component);
}

export const Script = Object.assign(baseScript as ScriptFactory, {
	loadsScript: Object.assign(loadsScript as ScriptFactory<true>, {
		asTool: loadsScriptAsTool as ScriptFactory<true, true>
	}),
	asTool: asTool as ScriptFactory<false, true>,
	loadsScriptAsTool: loadsScriptAsTool as ScriptFactory<true, true>
});
