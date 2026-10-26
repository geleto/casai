import type { AnyPromptSource, PromptType } from '../types/prompt.js';
import type { AIOutput, StreamRequest } from '../types/sdk.js';
import type { SchemaConfigInferShape, ConfigSchemas, FinalConfig, CallbackParent, PromptSource, TextFactoryConfig } from '../types/factory-config.js';
import type { ToolSet } from 'ai';
import type { OutputFromConfig, ValueOutputFromConfig, RuntimeContextFromConfig } from '../types/config.js';
import type { ValidateTextConfig, ValidateTextParentConfig } from '../types/config-validation.js';
import type { LLMCallSignature } from '../llm-component.js';
import type { ValidateResolved } from '../types/provisional.js';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import type { TextCallbackInput, ParentToolSelectionInput } from '../types/callbacks.js';
import type { ConditionalPromise } from '../types/utils.js';
import { validateRegistryConfig } from '../execution.js';
import { streamTextWithResult } from '../augment-result.js';
import type * as results from '../types/result.js';
import type * as configs from '../types/config.js';
import { _createLLMComponent } from '../llm-component.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateTextLLMConfig } from '../validate.js';

type FinalStreamTextConfigShape = Partial<configs.ConfigShape<configs.StreamTextConfig<any, any, any>> & { model: import('ai').LanguageModel }>;

type CommonConfig = configs.TextConfigShape<configs.StreamTextConfig<ToolSet, never, AnyPromptSource>>;
type FactoryConfig<TPromptType extends PromptType> = TextFactoryConfig<TPromptType, false, true>;

type TextStreamerReturn<TConfig, TPromptType extends PromptType> =
	LLMCallSignature<TConfig, ConditionalPromise<results.StreamTextResultAugmented<configs.ToolsFromConfig<TConfig>, OutputFromConfig<TConfig>, RuntimeContextFromConfig<TConfig>, ValueOutputFromConfig<TConfig>>, TPromptType extends 'text' ? false : true>,
		TPromptType, PromptSource<TPromptType>, configs.TextRunConfig<FactoryConfig<TPromptType>, configs.ToolsFromConfig<TConfig>, TConfig, true>>;

type TextStreamerFactory<TPromptType extends Exclude<PromptType, 'function'>> = <
	TConfig extends object & configs.TextConfigInferShape<FactoryConfig<TPromptType>>,
	TParentConfig extends object & NoInfer<configs.ParentTextConfigInferShape<FactoryConfig<TPromptType>>> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaContext = never,

	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends AIOutput | undefined = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, never, TSchemaContext> & TConfig
		& TextCallbackInput<TConfig, CallbackParent<TParentConfig>, TCallbackTools, TCallbackRuntime, TCallbackOutput, true>
		& ValidateTextConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryConfig<TPromptType>, true>
		& ValidateResolved<TConfig, [FinalConfig<TParentConfig, TConfig>] extends [FinalStreamTextConfigShape]
			? unknown : 'Config Error: Invalid text settings.'>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ParentToolSelectionInput<TParentConfig, TCallbackTools>
		& ValidateTextParentConfig<TParentConfig, FactoryConfig<TPromptType>, true>>]
) => TextStreamerReturn<FinalConfig<TParentConfig, TConfig>, TPromptType>;

type FunctionPromptSignature<RequiredContext extends boolean> = <
	TConfig extends object & FunctionPromptShape<configs.TextConfigInferShape<FactoryConfig<'function'>>>,
	TParentConfig extends object & NoInfer<FunctionPromptShape<configs.ParentTextConfigInferShape<FactoryConfig<'function'>>>> = never,

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
		& FunctionPromptInput<TConfig, CallbackParent<TParentConfig>, ConfigSchemas<TSchemaPresence, TSchemaInput, never, TSchemaContext>, TPromptContext, false, RequiredContext, TCallbackTools, TPromptToolsContext>
		& TextCallbackInput<TConfig, CallbackParent<TParentConfig>, TCallbackTools, TCallbackRuntime, TCallbackOutput, true>
		& ValidateTextConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryConfig<'function'>, true>
		& ValidateResolved<TConfig, [FinalConfig<TParentConfig, TConfig>] extends [FinalStreamTextConfigShape]
			? unknown : 'Config Error: Valid text settings and a function prompt are required.'>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ParentToolSelectionInput<TParentConfig, TCallbackTools>
		& ValidateTextParentConfig<TParentConfig, FactoryConfig<'function'>, true>>]
) => TextStreamerReturn<FinalConfig<TParentConfig, TConfig>, 'function'>;

type FunctionPromptFactory = FunctionPromptSignature<true> & FunctionPromptSignature<false>;

function withText(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'text', parent);
}

function loadsText(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'text-name', parent);
}

function withTemplate(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'async-template', parent);
}

function loadsTemplate(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'async-template-name', parent);
}

function withScript(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'async-script', parent);
}

function loadsScript(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'async-script-name', parent);
}

function withFunction(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'function', parent);
}

function _createTextStreamer(
	config: CommonConfig,
	promptType: PromptType,
	parent?: configs.ConfigProvider<CommonConfig>,
): unknown {

	const merged = { ...(parent ? mergeConfigs(parent.config, config) : processConfig(config)), promptType };

	validateTextLLMConfig(merged, promptType);
	validateRegistryConfig(merged, config);

	// Debug output if config.debug is true
	if ('debug' in merged && merged.debug) {
		console.log('[DEBUG] _TextStreamer created with config:', merged);
	}

	return _createLLMComponent(
		merged as configs.StreamTextConfig<ToolSet, Record<string, any>> & configs.OptionalPromptConfig,
		(request, conversation) => streamTextWithResult(request as StreamRequest, conversation),
		{ type: 'StreamText', streaming: true },
	);
}

export const TextStreamer = Object.assign(withText as TextStreamerFactory<'text'>, { // default is withText
	withTemplate: withTemplate as TextStreamerFactory<'async-template'>,
	withScript: withScript as TextStreamerFactory<'async-script'>,
	withText: withText as TextStreamerFactory<'text'>,
	loadsTemplate: loadsTemplate as TextStreamerFactory<'async-template-name'>,
	loadsScript: loadsScript as TextStreamerFactory<'async-script-name'>,
	loadsText: loadsText as TextStreamerFactory<'text-name'>,
	withFunction: withFunction as FunctionPromptFactory
});
