import { attachRendererTool } from '../renderer-tool.js';
import { TemplateEngine } from '../TemplateEngine.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateTemplateConfig, validateTemplateCall } from '../validate.js';
import * as configs from '../types/config.js';
import * as utils from '../types/utils.js';
import * as results from '../types/result.js';
import type { Context, TemplatePromptType } from '../types/types.js';
import type { RendererCall } from '../types/input.js';
import type { Provisional } from '../types/provisional.js';
import type { ProcessedConfig } from '../types/merge.js';
import type { RequiredInheritedConfig, ValidateTemplateConfig, ValidateTemplateParentConfig } from '../types/config-validation.js';

export type TemplateCallSignature<
	TConfig extends Partial<configs.TemplateConfig<INPUT>>,
	INPUT extends Record<string, any>//only INPUT, the output is string
> = RendererCall<TConfig, Promise<string>, 'template'> & { config: ProcessedConfig<TConfig>; type: string };

export type TemplateCallSignatureWithParent<
	TConfig extends Partial<configs.TemplateConfig<INPUT>>,
	TParentConfig extends Partial<configs.TemplateConfig<PARENT_INPUT>>,
	INPUT extends Record<string, any>, //only INPUT, the output is string
	PARENT_INPUT extends Record<string, any>,
	_FINAL_INPUT = utils.Override<PARENT_INPUT, INPUT>,
	FinalConfig = configs.MergedConfig<TParentConfig, TConfig>
> = RendererCall<FinalConfig, Promise<string>, 'template'> & { config: FinalConfig; type: string };

// Default behavior: inline/embedded template
function withTemplate<
	const TConfig extends Provisional<configs.TemplateConfig<INPUT>>,
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
	TFinalConfig extends configs.FinalTemplateConfigShape = configs.MergedConfig<TParentConfig, TConfig>
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
	const TConfig extends Provisional<configs.NamedTemplateConfig<INPUT>>,
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
	TFinalConfig extends configs.FinalTemplateConfigShape = configs.MergedConfig<TParentConfig, TConfig>
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
	const TConfig extends Provisional<configs.TemplateToolConfig<INPUT>>,
	INPUT extends Record<string, any>
>(
	config: TConfig & ValidateTemplateConfig<
		TConfig, TConfig, configs.TemplateToolConfig<INPUT>
	>
): TemplateCallSignature<TConfig, INPUT> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

function withTemplateAsTool<
	TConfig extends Provisional<Partial<configs.TemplateToolConfig<INPUT>>>,
	TParentConfig extends Partial<configs.TemplateToolConfig<PARENT_INPUT>>,
	INPUT extends Record<string, any>,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalTemplateConfigShape = configs.MergedConfig<TParentConfig, TConfig>
>(
	config: TConfig & ValidateTemplateConfig<TConfig, TFinalConfig, configs.TemplateToolConfig<INPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateTemplateParentConfig<TParentConfig, configs.TemplateToolConfig<PARENT_INPUT>>>
): TemplateCallSignatureWithParent<TConfig, TParentConfig, INPUT, PARENT_INPUT> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

function withTemplateAsTool(
	config: Partial<configs.TemplateToolConfig<any>>,
	parent?: configs.ConfigProvider<Partial<configs.TemplateToolConfig<any>>>,
): any {
	return _createTemplateAsTool(config, 'async-template', parent);
}

// Overload 1: With a standalone config
function loadsTemplateAsTool<
	const TConfig extends Provisional<configs.TemplateToolConfig<INPUT> & configs.LoaderConfig>,
	INPUT extends Record<string, any>
>(
	config: TConfig & ValidateTemplateConfig<
		TConfig, TConfig, configs.TemplateToolConfig<INPUT> & configs.LoaderConfig
	>
): TemplateCallSignature<TConfig, INPUT> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

// Overload 2: With a parent config
function loadsTemplateAsTool<
	TConfig extends Provisional<Partial<configs.TemplateToolConfig<INPUT> & configs.LoaderConfig>>,
	TParentConfig extends Partial<configs.TemplateToolConfig<PARENT_INPUT> & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalTemplateConfigShape = configs.MergedConfig<TParentConfig, TConfig>
>(
	config: TConfig & ValidateTemplateConfig<TConfig, TFinalConfig, configs.TemplateToolConfig<INPUT> & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateTemplateParentConfig<TParentConfig, configs.TemplateToolConfig<PARENT_INPUT> & configs.LoaderConfig>>
): TemplateCallSignatureWithParent<TConfig, TParentConfig, INPUT, PARENT_INPUT> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

// Implementation
function loadsTemplateAsTool(
	config: Partial<configs.TemplateToolConfig<any> & configs.LoaderConfig>,
	parent?: configs.ConfigProvider<Partial<configs.TemplateToolConfig<any> & configs.LoaderConfig>>,
): any {
	return _createTemplateAsTool(config, 'async-template-name', parent);
}

// Internal common creator for template tools
function _createTemplateAsTool<
	const TConfig extends Partial<configs.TemplateToolConfig<INPUT>>,
	TParentConfig extends Partial<configs.TemplateToolConfig<PARENT_INPUT>>,
	INPUT extends Record<string, any>,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
>(
	config: Partial<TConfig>,
	promptType: TemplatePromptType,
	parent?: configs.ConfigProvider<TParentConfig>,
): TemplateCallSignatureWithParent<TConfig, TParentConfig, INPUT, PARENT_INPUT> & results.ComponentToolFromConfig<FINAL_INPUT, string, configs.MergedConfig<TParentConfig, TConfig>> {
	const renderer = _createTemplate(config, promptType, parent, true) as unknown as TemplateCallSignatureWithParent<TConfig, TParentConfig, INPUT, PARENT_INPUT>;

	return attachRendererTool<FINAL_INPUT, string, configs.MergedConfig<TParentConfig, TConfig>, typeof renderer>(
		renderer,
		context => (renderer as unknown as (context: FINAL_INPUT) => Promise<string>)(context),
	);

}

// Internal common creator for template renderer
export function _createTemplate<
	const TConfig extends Partial<configs.TemplateConfig<INPUT>>,
	TParentConfig extends Partial<configs.TemplateConfig<PARENT_INPUT>>,
	INPUT extends Record<string, any>,
	PARENT_INPUT extends Record<string, any>,
>(
	config: TConfig,
	promptType: TemplatePromptType,
	parent?: configs.ConfigProvider<TParentConfig>,
	isTool = false,
): TemplateCallSignatureWithParent<TConfig, TParentConfig, INPUT, PARENT_INPUT> {

	// Merge configs if parent exists, otherwise use provided config
	//, add promptType to the config
	const merged = parent
		? { ...mergeConfigs(parent.config, config), promptType: promptType }
		: { ...processConfig(config), promptType: promptType };

	validateTemplateConfig(merged, promptType, isTool);

	// Debug output if config.debug is true
	if ('debug' in merged && merged.debug) {
		console.log('[DEBUG] Template created with config:', merged);
	}

	const renderer = new TemplateEngine(merged as configs.TemplateConfig<INPUT>);

	// Define the call function that handles both cases
	const call = async (promptOrContext?: Context | string, maybeContext?: Context): Promise<string> => {
		await validateTemplateCall(merged, promptOrContext, maybeContext);

		if ('debug' in merged && merged.debug) {
			console.log('[DEBUG] Template - call function called with:', { promptOrContext, maybeContext });
		}

		//the contexts are merged in render
		if (typeof promptOrContext === 'string') {
			const result = await renderer.render(promptOrContext, maybeContext);
			if ('debug' in merged && merged.debug) {
				console.log('[DEBUG] Template - render result:', result);
			}
			return result;
		} else {
			if (maybeContext !== undefined) {
				throw new Error('Second argument must be undefined when the first is not a string prompt.');
			}
			const result = await renderer.render(undefined, promptOrContext);
			if ('debug' in merged && merged.debug) {
				console.log('[DEBUG] Template - render result:', result);
			}
			return result;
		}
	};

	const callSignature = Object.assign(call, { config: merged, type: 'Template' });
	return callSignature as unknown as TemplateCallSignatureWithParent<TConfig, TParentConfig, INPUT, PARENT_INPUT>;
}

export const Template = Object.assign(withTemplate, {
	loadsTemplate: Object.assign(loadsTemplate, {
		asTool: loadsTemplateAsTool
	}),
	asTool: withTemplateAsTool
});
