import type { PromptType, AnyPromptSource } from '../types/prompt.js';
import type { SchemaConfigInferShape, ConfigSchemas, FinalConfig, CallbackParent, PromptSource, PromptConfig as FactoryExtras, ObjectFactoryConfig, ObjectOutputConfig } from '../types/factory-config.js';
import type { SchemaType } from '../types/schema.js';
import type { ConditionalPromise } from '../types/utils.js';
import type { LanguageModel } from 'ai';
import type { LLMCallSignature } from '../llm-component.js';
import type { ObjectCallbackInput, ObjectRunConfig } from '../types/callbacks.js';
import type { ValidateObjectStreamerConfig, ValidateObjectStreamerParentConfig } from '../types/config-validation.js';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import type { StreamObjectRequest, ObjectOutputMode } from '../types/sdk.js';
import { streamObject } from 'ai';
import { augmentObjectResult } from '../augment-result.js';
import { _createLLMComponent } from '../llm-component.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateObjectLLMConfig } from '../validate.js';
import type * as configs from '../types/config.js';
import type * as results from '../types/result.js';

type FactoryConfig<TPromptType extends PromptType> = ObjectFactoryConfig<TPromptType, false, true>;

// Preserve complete caller checking while distributing result types over alternatives.
type ObjectStreamerReturn<TConfig, TPromptType extends PromptType,
	WholeConfig = TConfig> = TConfig extends unknown
	? [ObjectOutputConfig<TConfig, true>] extends [never] ? 'Config Error: Narrow the output mode or use a union of complete configurations.'
	: LLMCallSignature<WholeConfig, ConditionalPromise<results.StreamObjectResultFromConfig<TConfig>, TPromptType extends 'text' ? false : true>,
		TPromptType, PromptSource<TPromptType>, ObjectRunConfig<ObjectOutputConfig<TConfig, true> & FactoryExtras<TPromptType>, TConfig, true>>
	: never;

// The object intersection prevents provisional inference from hiding invalid settings.
type ObjectStreamerFactory<TPromptType extends Exclude<PromptType, 'function'>> = <
	TConfig extends object & configs.ObjectConfigInferShape<FactoryConfig<TPromptType>>,
	TParentConfig extends object & NoInfer<configs.ParentObjectConfigInferShape<FactoryConfig<TPromptType>>> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,

	TCallbackMode extends ObjectOutputMode | undefined = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig
		& ObjectCallbackInput<TConfig, CallbackParent<TParentConfig>, TSchemaOutput, TCallbackMode, never, true>
		& ValidateObjectStreamerConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryExtras<TPromptType>>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ValidateObjectStreamerParentConfig<TParentConfig, FinalConfig<TParentConfig, TConfig>, FactoryExtras<TPromptType>>>]
) => ObjectStreamerReturn<FinalConfig<TParentConfig, TConfig>, TPromptType>;

// Function prompts keep separate overloads for present and optional context.
type FunctionPromptSignature<RequiredContext extends boolean> = <
	TConfig extends object & FunctionPromptShape<configs.ObjectConfigInferShape<FactoryConfig<'function'>>>,
	TParentConfig extends object & NoInfer<FunctionPromptShape<configs.ParentObjectConfigInferShape<FactoryConfig<'function'>>>> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,

	TPromptContext extends Record<string, any> | undefined = never,
	TCallbackMode extends ObjectOutputMode | undefined = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig
		& FunctionPromptInput<TConfig, CallbackParent<TParentConfig>, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, false, RequiredContext>
		& ObjectCallbackInput<TConfig, CallbackParent<TParentConfig>, TSchemaOutput, TCallbackMode, never, true>
		& ValidateObjectStreamerConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryExtras<'function'>>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ValidateObjectStreamerParentConfig<TParentConfig, FinalConfig<TParentConfig, TConfig>, FactoryExtras<'function'>>>]
) => ObjectStreamerReturn<FinalConfig<TParentConfig, TConfig>, 'function'>;

type FunctionPromptFactory = FunctionPromptSignature<true>
	& FunctionPromptSignature<false>;

function withText(config: configs.StreamObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'text', parent);
}

function loadsText(config: configs.StreamObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'text-name', parent);
}

function withTemplate(config: configs.StreamObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'async-template', parent);
}

function loadsTemplate(config: configs.StreamObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'async-template-name', parent);
}

function withScript(config: configs.StreamObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'async-script', parent);
}

function loadsScript(config: configs.StreamObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'async-script-name', parent);
}

function withFunction(config: configs.StreamObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'function', parent);
}

function _createObjectStreamer(
	config: configs.StreamObjectBaseConfig<any, AnyPromptSource, any>,
	promptType: PromptType,
	parent?: configs.ConfigProvider<configs.BaseConfig>,
): unknown {

	const merged = { ...(parent ? mergeConfigs(parent.config, config) : processConfig(config)), promptType };

	// Set default output value to make the config explicit.
	// This simplifies downstream logic (e.g., in validation).
	if ((merged as unknown as configs.StreamObjectObjectConfig<any, any>).output === undefined) {
		(merged as unknown as configs.StreamObjectObjectConfig<any, any>).output = 'object';
	}

	validateObjectLLMConfig(merged, promptType, false, true); // isStreamer = true

	// Debug output if config.debug is true
	if ('debug' in merged && merged.debug) {
		console.log('[DEBUG] _ObjectStreamer created with config:', merged);
	}

	return _createLLMComponent(
		merged as configs.OptionalPromptConfig & { model: LanguageModel, prompt: string, schema: SchemaType<any> },
		request => augmentObjectResult(streamObject(request as StreamObjectRequest)),
		{ type: 'StreamObject', streaming: true },
	);
}

export const ObjectStreamer = Object.assign(withText as ObjectStreamerFactory<'text'>, { // default is withText
	withTemplate: withTemplate as ObjectStreamerFactory<'async-template'>,
	withScript: withScript as ObjectStreamerFactory<'async-script'>,
	withText: withText as ObjectStreamerFactory<'text'>,
	loadsTemplate: loadsTemplate as ObjectStreamerFactory<'async-template-name'>,
	loadsScript: loadsScript as ObjectStreamerFactory<'async-script-name'>,
	loadsText: loadsText as ObjectStreamerFactory<'text-name'>,
	withFunction: withFunction as FunctionPromptFactory
});
