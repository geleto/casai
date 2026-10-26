import type { EmptyMap } from '../types/utils.js';
import type { SchemaConfigInferShape, ConfigSchemas, FinalConfig, CallbackParent } from '../types/factory-config.js';
import type { ComponentToolFromConfig } from '../types/tool-binding.js';
import type { TemplatePromptType } from '../types/prompt.js';
import type { ToolConfigShape, TemplateConfig, ToolContextSchemaConfig } from '../types/config.js';
import type { DescriptorInput } from '../types/callbacks.js';
import type { ComponentRun, SourceSetting, RendererCall } from '../types/input.js';
import type { ValidateResolved } from '../types/provisional.js';
import type { ProcessedConfig } from '../types/merge.js';
import type { ValidateTemplateConfig, ValidateTemplateParentConfig } from '../types/config-validation.js';
import { validateRegistryConfig, defineTool, namedArguments, prepareExecution, runSettings } from '../execution.js';
import { ValidationError } from '../errors.js';
import { TemplateEngine } from '../TemplateEngine.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateTemplateConfig } from '../validate.js';
import type * as configs from '../types/config.js';

type FinalTemplateConfigShape = Partial<ToolConfigShape<TemplateConfig<any> & ToolContextSchemaConfig<any>>>;

type FactoryConfig<Named extends boolean, AsTool extends boolean> =
	(AsTool extends true ? configs.TemplateToolConfig<Record<string, any>> : configs.TemplateConfig<Record<string, any>>) & (Named extends true ? configs.LoaderConfig : EmptyMap);

type TemplateCallSignature<TConfig> = RendererCall<TConfig, Promise<string>, 'template'> & {
	config: ProcessedConfig<TConfig>;
	type: string;
	run: ComponentRun<TConfig, string, SourceSetting<TConfig, 'template'>>;
};

type TemplateFactory<Named extends boolean = false, AsTool extends boolean = false> = <
	TConfig extends object & configs.ToolConfigInferShape<FactoryConfig<Named, AsTool>>,
	TParentConfig extends object & NoInfer<configs.ParentToolConfigInferShape<FactoryConfig<Named, AsTool>>> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, never, TSchemaContext> & TConfig
		& (AsTool extends true ? DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, never, TSchemaContext>, CallbackParent<TParentConfig>, string> : unknown)
		& ValidateTemplateConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryConfig<Named, AsTool>>
		& ValidateResolved<TConfig, [FinalConfig<TParentConfig, TConfig>] extends [FinalTemplateConfigShape]
			? unknown : 'Config Error: Invalid template settings.'>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ValidateTemplateParentConfig<TParentConfig, FactoryConfig<Named, AsTool>>>]
) => TemplateCallSignature<FinalConfig<TParentConfig, TConfig>>
	& (AsTool extends true ? ComponentToolFromConfig<Record<string, any>, string, FinalConfig<TParentConfig, TConfig>> : unknown);

function withTemplate(
	config: configs.TemplateConfig<any>,
	parent?: configs.ConfigProvider<configs.TemplateConfig<any>>
): any {
	return _createTemplate(config, 'async-template', parent, false);
}

function loadsTemplate(
	config: Partial<configs.TemplateToolConfig<any> & configs.LoaderConfig>,
	parent?: configs.ConfigProvider<Partial<configs.TemplateToolConfig<any> & configs.LoaderConfig>>
): any {
	return _createTemplate(config, 'async-template-name', parent, false);
}

function withTemplateAsTool(
	config: Partial<configs.TemplateToolConfig<any>>,
	parent?: configs.ConfigProvider<Partial<configs.TemplateToolConfig<any>>>,
): any {
	return _createTemplate(config, 'async-template', parent, true);
}

function loadsTemplateAsTool(
	config: Partial<configs.TemplateToolConfig<any> & configs.LoaderConfig>,
	parent?: configs.ConfigProvider<Partial<configs.TemplateToolConfig<any> & configs.LoaderConfig>>,
): any {
	return _createTemplate(config, 'async-template-name', parent, true);
}

function _createTemplate(
	config: Partial<configs.TemplateConfig<any>>,
	promptType: TemplatePromptType,
	parent?: configs.ConfigProvider<Partial<configs.TemplateConfig<any>>>,
	isTool = false,
) {

	// Merge configs if parent exists, otherwise use provided config
	//, add promptType to the config
	const merged = parent
		? { ...mergeConfigs(parent.config, config), promptType }
		: { ...processConfig(config), promptType };

	validateTemplateConfig(merged, promptType, isTool);
	validateRegistryConfig(merged, config);
	if (merged.debug) console.log('[DEBUG] Template created with config:', merged);

	const engine = new TemplateEngine(merged as configs.TemplateConfig<any>);
	const run = async (...args: unknown[]) => {
		const settings = runSettings(args, ['template', 'context', 'toolsContext', 'abortSignal']);
		if (settings.template !== undefined && typeof settings.template !== 'string') throw new ValidationError('Template source must be a string.');
		if (settings.template === undefined && merged.template === undefined) throw new ValidationError('A template source must be provided in configuration or at call time.');
		const { context } = await prepareExecution(merged, settings.context,
			settings.abortSignal === undefined ? {} : { abortSignal: settings.abortSignal as AbortSignal }, settings.toolsContext as Record<string, unknown> | undefined, isTool);
		return engine.render(settings.template, context);
	};
	const call = async (...args: unknown[]) => {
		const [first, second, ...rest] = namedArguments(args);
		if (rest.length || (typeof first !== 'string' && second !== undefined)) throw new ValidationError('Unexpected Template arguments.');
		return typeof first === 'string' ? run({ template: first, context: second }) : run({ context: first });
	};
	const component = Object.assign(call, { config: merged, type: 'Template', run });
	return isTool ? defineTool(component, context => engine.render(undefined, context)) : component;
}

export const Template = Object.assign(withTemplate as TemplateFactory, {
	loadsTemplate: Object.assign(loadsTemplate as TemplateFactory<true>, { asTool: loadsTemplateAsTool as TemplateFactory<true, true> }),
	asTool: withTemplateAsTool as TemplateFactory<false, true>,
});
