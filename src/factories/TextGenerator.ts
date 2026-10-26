import type { AnyPromptSource, PromptType } from '../types/prompt.js';
import type { ComponentToolFromConfig } from '../types/tool-binding.js';
import type { AIOutput, GenerateRequest } from '../types/sdk.js';
import type { SchemaConfigInferShape, ConfigSchemas, FinalConfig, CallbackParent, PromptSource, TextFactoryConfig as FactoryConfig } from '../types/factory-config.js';
import type { ToolSet, InferGenerateOutput } from 'ai';
import type { OutputFromConfig, ValueOutputFromConfig, RuntimeContextFromConfig } from '../types/config.js';
import type { ValidateTextConfig, ValidateTextParentConfig } from '../types/config-validation.js';
import type { LLMCallSignature } from '../llm-component.js';
import type { ValidateResolved } from '../types/provisional.js';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import type { DescriptorInput, TextCallbackConfig, TextCallbackInput, ParentToolSelectionInput } from '../types/callbacks.js';
import { validateRegistryConfig } from '../execution.js';
import { generateTextWithResult } from '../augment-result.js';
import type * as results from '../types/result.js';
import type * as configs from '../types/config.js';
import { _createLLMComponent } from '../llm-component.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateTextLLMConfig } from '../validate.js';

type CommonConfig = configs.TextConfigShape<configs.GenerateTextConfig<ToolSet, never, AnyPromptSource>>;

type TextGeneratorReturn<TConfig, TPromptType extends PromptType, AsTool extends boolean> =
	LLMCallSignature<TConfig, Promise<results.GenerateTextResultAugmented<configs.ToolsFromConfig<TConfig>, OutputFromConfig<TConfig>, RuntimeContextFromConfig<TConfig>, ValueOutputFromConfig<TConfig>>>,
		TPromptType, PromptSource<TPromptType>, configs.TextRunConfig<FactoryConfig<TPromptType, AsTool>, configs.ToolsFromConfig<TConfig>, TConfig>>
	& (AsTool extends true ? ComponentToolFromConfig<Record<string, any>, InferGenerateOutput<ValueOutputFromConfig<TConfig>>, TConfig> : unknown);

type TextGeneratorFactory<TPromptType extends Exclude<PromptType, 'function'>, AsTool extends boolean = false> = <
	TConfig extends object & configs.TextConfigInferShape<FactoryConfig<TPromptType, AsTool>>,
	TParentConfig extends object & NoInfer<configs.ParentTextConfigInferShape<FactoryConfig<TPromptType, AsTool>>> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaContext = never,

	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends AIOutput | undefined = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, never, TSchemaContext> & TConfig
		& (AsTool extends true ? DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, never, TSchemaContext>, CallbackParent<TParentConfig>,
			InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<CallbackParent<TParentConfig>, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> : unknown)
		& TextCallbackInput<TConfig, CallbackParent<TParentConfig>, TCallbackTools, TCallbackRuntime, TCallbackOutput, false>
		& ValidateTextConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryConfig<TPromptType, AsTool>>
		& ValidateResolved<TConfig, [FinalConfig<TParentConfig, TConfig>] extends [configs.FinalGenerateTextConfigShape]
			? unknown : 'Config Error: Invalid text settings.'>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ParentToolSelectionInput<TParentConfig, TCallbackTools>
		& ValidateTextParentConfig<TParentConfig, FactoryConfig<TPromptType, AsTool>>>]
) => TextGeneratorReturn<FinalConfig<TParentConfig, TConfig>, TPromptType, AsTool>;

type FunctionPromptSignature<AsTool extends boolean, RequiredContext extends boolean> = <
	TConfig extends object & FunctionPromptShape<configs.TextConfigInferShape<FactoryConfig<'function', AsTool>>>,
	TParentConfig extends object & NoInfer<FunctionPromptShape<configs.ParentTextConfigInferShape<FactoryConfig<'function', AsTool>>>> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaContext = never,

	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TPromptToolsContext extends object | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends AIOutput | undefined = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, never, TSchemaContext> & TConfig
		& (AsTool extends true ? DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, never, TSchemaContext>, CallbackParent<TParentConfig>,
			InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<CallbackParent<TParentConfig>, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> : unknown)
		& FunctionPromptInput<TConfig, CallbackParent<TParentConfig>, ConfigSchemas<TSchemaPresence, TSchemaInput, never, TSchemaContext>, TPromptContext, AsTool, RequiredContext, TCallbackTools, TPromptToolsContext>
		& TextCallbackInput<TConfig, CallbackParent<TParentConfig>, TCallbackTools, TCallbackRuntime, TCallbackOutput, false>
		& ValidateTextConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryConfig<'function', AsTool>>
		& ValidateResolved<TConfig, [FinalConfig<TParentConfig, TConfig>] extends [configs.FinalGenerateTextConfigShape]
			? unknown : 'Config Error: Valid text settings and a function prompt are required.'>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ParentToolSelectionInput<TParentConfig, TCallbackTools>
		& ValidateTextParentConfig<TParentConfig, FactoryConfig<'function', AsTool>>>]
) => TextGeneratorReturn<FinalConfig<TParentConfig, TConfig>, 'function', AsTool>;

type FunctionPromptFactory<AsTool extends boolean = false> = FunctionPromptSignature<AsTool, true> & FunctionPromptSignature<AsTool, false>;

function withText(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'text', parent, false);
}

function withTextAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'text', parent, true);
}

function loadsText(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'text-name', parent, false);
}

function loadsTextAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'text-name', parent, true);
}

function withTemplate(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-template', parent, false);
}

function withTemplateAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-template', parent, true);
}

function loadsTemplate(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-template-name', parent, false);
}

function loadsTemplateAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-template-name', parent, true);
}

function withScript(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-script', parent, false);
}

function withScriptAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-script', parent, true);
}

function loadsScript(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-script-name', parent, false);
}

function loadsScriptAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-script-name', parent, true);
}

function withFunction(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'function', parent, false);
}

function withFunctionAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'function', parent, true);
}

function _createTextGenerator(
	config: CommonConfig,
	promptType: PromptType,
	parent?: configs.ConfigProvider<CommonConfig>,
	isTool = false,
): unknown {

	const merged = { ...(parent ? mergeConfigs(parent.config, config) : processConfig(config)), promptType };

	validateTextLLMConfig(merged, promptType, isTool);
	validateRegistryConfig(merged, config);

	// Debug output if config.debug is true
	if ('debug' in merged && merged.debug) {
		console.log('[DEBUG] _TextGenerator created with config:', merged);
	}

	return _createLLMComponent(
		merged as configs.GenerateTextConfig<ToolSet, Record<string, any>> & configs.OptionalPromptConfig,
		(request, conversation) => generateTextWithResult(request as GenerateRequest, conversation),
		{ type: 'GenerateText', streaming: false, ...(isTool ? { toolValue: (result: { readonly value: unknown }) => result.value } : {}) },
	);
}

export const TextGenerator = Object.assign(withText as TextGeneratorFactory<'text'>, { // default is withText
	withTemplate: Object.assign(withTemplate as TextGeneratorFactory<'async-template'>, {
		asTool: withTemplateAsTool as TextGeneratorFactory<'async-template', true>,
	}),
	withScript: Object.assign(withScript as TextGeneratorFactory<'async-script'>, {
		asTool: withScriptAsTool as TextGeneratorFactory<'async-script', true>,
	}),
	withText: Object.assign(withText as TextGeneratorFactory<'text'>, {
		asTool: withTextAsTool as TextGeneratorFactory<'text', true>,
	}),
	loadsTemplate: Object.assign(loadsTemplate as TextGeneratorFactory<'async-template-name'>, {
		asTool: loadsTemplateAsTool as TextGeneratorFactory<'async-template-name', true>,
	}),
	loadsScript: Object.assign(loadsScript as TextGeneratorFactory<'async-script-name'>, {
		asTool: loadsScriptAsTool as TextGeneratorFactory<'async-script-name', true>,
	}),
	loadsText: Object.assign(loadsText as TextGeneratorFactory<'text-name'>, {
		asTool: loadsTextAsTool as TextGeneratorFactory<'text-name', true>,
	}),
	withFunction: Object.assign(withFunction as FunctionPromptFactory, {
		asTool: withFunctionAsTool as FunctionPromptFactory<true>,
	}),
	asTool: withTextAsTool as TextGeneratorFactory<'text', true>
});
