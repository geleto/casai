import type { FlexibleSchema } from 'ai';
import type { DescriptorInput } from '../types/callbacks.js';
import { validateRegistryConfig, defineTool, namedArguments, prepareExecution, runSettings } from '../execution.js';
import { ConfigError } from '../errors.js';
import { TemplateEngine } from '../TemplateEngine.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateTemplateConfig } from '../validate.js';
import * as configs from '../types/config.js';
import * as utils from '../types/utils.js';
import * as results from '../types/result.js';
import type { TemplatePromptType } from '../types/types.js';
import type { ApplicationRun, SourceSetting } from '../types/application.js';
import type { RendererCall } from '../types/input.js';
import type { Provisional, ResolvedConfig } from '../types/provisional.js';
import type { ProcessedConfig } from '../types/merge.js';
import type { RequiredInheritedConfig, ValidateTemplateConfig, ValidateTemplateParentConfig } from '../types/config-validation.js';

export type TemplateCallSignature<
	TConfig extends configs.ToolConfigShape<Partial<configs.TemplateConfig<INPUT>>>,
	INPUT extends Record<string, any>//only INPUT, the output is string
> = RendererCall<TConfig, Promise<string>, 'template'> & { config: ProcessedConfig<TConfig>; type: string; run: ApplicationRun<TConfig, string, SourceSetting<TConfig, 'template'>> };

export type TemplateCallSignatureWithParent<
	TConfig extends configs.ToolConfigShape<Partial<configs.TemplateConfig<INPUT>>>,
	TParentConfig extends configs.ToolConfigShape<Partial<configs.TemplateConfig<PARENT_INPUT>>>,
	INPUT extends Record<string, any>, //only INPUT, the output is string
	PARENT_INPUT extends Record<string, any>,
	FinalConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>
> = RendererCall<FinalConfig, Promise<string>, 'template'> & { config: FinalConfig; type: string; run: ApplicationRun<FinalConfig, string, SourceSetting<FinalConfig, 'template'>> };

// Default behavior: inline/embedded template
function withTemplate<
	TConfig extends Provisional<configs.TemplateConfig<INPUT>>,
	INPUT extends Record<string, any>
>(
	config: TConfig & ValidateTemplateConfig<
		TConfig, TConfig, configs.TemplateConfig<INPUT>
	>
): TemplateCallSignature<TConfig, INPUT>;

function withTemplate<
	TConfig extends Provisional<Partial<configs.TemplateConfig<INPUT>>>,
	TParentConfig extends Partial<configs.TemplateConfig<PARENT_INPUT>>,
	INPUT extends Record<string, any>,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalTemplateConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>
>(
	config: TConfig & RequiredInheritedConfig<TParentConfig, { template: string }> & ValidateTemplateConfig<TConfig, TFinalConfig, configs.TemplateConfig<INPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateTemplateParentConfig<TParentConfig, configs.TemplateConfig<PARENT_INPUT>>>
): TemplateCallSignatureWithParent<TConfig, TParentConfig, INPUT, PARENT_INPUT>;

function withTemplate(
	config: configs.TemplateConfig<any>,
	parent?: configs.ConfigProvider<configs.TemplateConfig<any>>
): any {
	return _createTemplate(config, 'async-template', parent, false);
}

// loadsTemplate: load by name via provided loader
function loadsTemplate<
	TConfig extends Provisional<configs.NamedTemplateConfig<INPUT>>,
	INPUT extends Record<string, any>
>(
	config: TConfig & ValidateTemplateConfig<
		TConfig, TConfig, configs.TemplateConfig<INPUT> & configs.LoaderConfig
	>
): TemplateCallSignature<TConfig, INPUT>;

function loadsTemplate<
	TConfig extends Provisional<Partial<configs.TemplateConfig<INPUT> & configs.LoaderConfig>>,
	TParentConfig extends Partial<configs.TemplateConfig<PARENT_INPUT> & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalTemplateConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>
>(
	config: TConfig & ValidateTemplateConfig<TConfig, TFinalConfig, configs.TemplateConfig<INPUT> & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateTemplateParentConfig<TParentConfig, configs.TemplateConfig<PARENT_INPUT> & configs.LoaderConfig>>
): TemplateCallSignatureWithParent<TConfig, TParentConfig, INPUT, PARENT_INPUT>;

function loadsTemplate(
	config: Partial<configs.TemplateToolConfig<any> & configs.LoaderConfig>,
	parent?: configs.ConfigProvider<Partial<configs.TemplateToolConfig<any> & configs.LoaderConfig>>
): any {
	return _createTemplate(config, 'async-template-name', parent, false);
}

// asTool method for Template
function withTemplateAsTool<
	TConfig extends Provisional<configs.ToolConfigShape<configs.TemplateToolConfig<INPUT, any>>>,
	INPUT extends Record<string, any>,
	TDescriptorInput extends FlexibleSchema<Record<string, any>> | undefined = never,
	TDescriptorContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & DescriptorInput<TConfig, import('../types/merge.js').EmptyMap, TDescriptorInput, never, TDescriptorContext, string> & ValidateTemplateConfig<
		TConfig, TConfig, configs.TemplateToolConfig<INPUT, any>
	>
): TemplateCallSignature<TConfig, INPUT> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

function withTemplateAsTool<
	TConfig extends Provisional<configs.ToolConfigShape<Partial<configs.TemplateToolConfig<INPUT, any>>>>,
	TParentConfig extends Partial<configs.TemplateToolConfig<PARENT_INPUT, any>>,
	INPUT extends Record<string, any>,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalTemplateConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TDescriptorInput extends FlexibleSchema<Record<string, any>> | undefined = never,
	TDescriptorContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & RequiredInheritedConfig<TParentConfig, { template: string; inputSchema: FlexibleSchema<Record<string, any>> }> & DescriptorInput<TConfig, TParentConfig, TDescriptorInput, never, TDescriptorContext, string> & ValidateTemplateConfig<TConfig, TFinalConfig, configs.TemplateToolConfig<INPUT, any>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateTemplateParentConfig<TParentConfig, configs.TemplateToolConfig<PARENT_INPUT, any>>>
): TemplateCallSignatureWithParent<TConfig, TParentConfig, INPUT, PARENT_INPUT> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

function withTemplateAsTool(
	config: Partial<configs.TemplateToolConfig<any>>,
	parent?: configs.ConfigProvider<Partial<configs.TemplateToolConfig<any>>>,
): any {
	return _createTemplate(config, 'async-template', parent, true);
}

// Overload 1: With a standalone config
function loadsTemplateAsTool<
	TConfig extends Provisional<configs.ToolConfigShape<configs.TemplateToolConfig<INPUT, any> & configs.LoaderConfig>>,
	INPUT extends Record<string, any>,
	TDescriptorInput extends FlexibleSchema<Record<string, any>> | undefined = never,
	TDescriptorContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & DescriptorInput<TConfig, import('../types/merge.js').EmptyMap, TDescriptorInput, never, TDescriptorContext, string> & ValidateTemplateConfig<
		TConfig, TConfig, configs.TemplateToolConfig<INPUT, any> & configs.LoaderConfig
	>
): TemplateCallSignature<TConfig, INPUT> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

// Overload 2: With a parent config
function loadsTemplateAsTool<
	TConfig extends Provisional<configs.ToolConfigShape<Partial<configs.TemplateToolConfig<INPUT, any> & configs.LoaderConfig>>>,
	TParentConfig extends Partial<configs.TemplateToolConfig<PARENT_INPUT, any> & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalTemplateConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TDescriptorInput extends FlexibleSchema<Record<string, any>> | undefined = never,
	TDescriptorContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & RequiredInheritedConfig<TParentConfig, { template: string; inputSchema: FlexibleSchema<Record<string, any>>; loader: configs.LoaderConfig['loader'] }> & DescriptorInput<TConfig, TParentConfig, TDescriptorInput, never, TDescriptorContext, string> & ValidateTemplateConfig<TConfig, TFinalConfig, configs.TemplateToolConfig<INPUT, any> & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateTemplateParentConfig<TParentConfig, configs.TemplateToolConfig<PARENT_INPUT, any> & configs.LoaderConfig>>
): TemplateCallSignatureWithParent<TConfig, TParentConfig, INPUT, PARENT_INPUT> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

// Implementation
function loadsTemplateAsTool(
	config: Partial<configs.TemplateToolConfig<any> & configs.LoaderConfig>,
	parent?: configs.ConfigProvider<Partial<configs.TemplateToolConfig<any> & configs.LoaderConfig>>,
): any {
	return _createTemplate(config, 'async-template-name', parent, true);
}

// Internal common creator for template renderer
function _createTemplate(
	config: Partial<configs.TemplateConfig<any>>,
	promptType: TemplatePromptType,
	parent?: configs.ConfigProvider<Partial<configs.TemplateConfig<any>>>,
	isTool = false,
) {

	// Merge configs if parent exists, otherwise use provided config
	//, add promptType to the config
	const merged = parent
		? { ...mergeConfigs(parent.config, config), promptType: promptType }
		: { ...processConfig(config), promptType: promptType };

	validateTemplateConfig(merged, promptType, isTool);
	validateRegistryConfig(merged, config);
	if (merged.debug) console.log('[DEBUG] Template created with config:', merged);

	const engine = new TemplateEngine(merged as configs.TemplateConfig<any>);
	const run = async (...args: unknown[]) => {
		const settings = runSettings(args, ['template', 'context', 'toolsContext', 'abortSignal']);
		if (settings.template !== undefined && typeof settings.template !== 'string') throw new ConfigError('Template source must be a string.');
		if (settings.template === undefined && merged.template === undefined) throw new ConfigError('A template source must be provided in configuration or at call time.');
		const { context } = await prepareExecution(merged, settings.context,
			settings.abortSignal === undefined ? {} : { abortSignal: settings.abortSignal as AbortSignal }, settings.toolsContext as Record<string, unknown> | undefined, isTool);
		return engine.render(settings.template, context);
	};
	const call = async (...args: unknown[]) => {
		const [first, second, ...rest] = namedArguments(args);
		if (rest.length || (typeof first !== 'string' && second !== undefined)) throw new ConfigError('Unexpected Template arguments.');
		return typeof first === 'string' ? run({ template: first, context: second }) : run({ context: first });
	};
	const component = Object.assign(call, { config: merged, type: 'Template', run });
	return isTool ? defineTool(component, context => engine.render(undefined, context)) : component;
}

export const Template = Object.assign(withTemplate, {
	loadsTemplate: Object.assign(loadsTemplate, { asTool: loadsTemplateAsTool }),
	asTool: withTemplateAsTool,
});
