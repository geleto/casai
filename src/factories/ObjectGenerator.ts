import type { PromptType, AnyPromptSource } from '../types/prompt.js';
import type { ComponentToolFromConfig } from '../types/tool-binding.js';
import type { SchemaConfigInferShape, ConfigSchemas, FinalConfig, CallbackParent, PromptSource, PromptConfig as FactoryExtras, ObjectFactoryConfig, ObjectOutputConfig } from '../types/factory-config.js';
import type { SchemaType } from '../types/schema.js';
import type { LanguageModel } from 'ai';
import type { LLMCallSignature } from '../llm-component.js';
import type { ObjectOutputFromConfig } from '../types/config.js';
import type { DescriptorInput, ObjectCallbackConfig, ObjectCallbackInput, ObjectRunConfig } from '../types/callbacks.js';
import type { ValidateObjectConfig, ValidateObjectParentConfig } from '../types/config-validation.js';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import type { GenerateObjectRequest, ObjectOutputMode } from '../types/sdk.js';
import { generateObject } from 'ai';
import { augmentObjectResult } from '../augment-result.js';
import { _createLLMComponent } from '../llm-component.js';
import { mergeConfigs, processConfig } from '../config-utils.js';
import { validateObjectLLMConfig } from '../validate.js';
import type * as configs from '../types/config.js';
import type * as results from '../types/result.js';

type FactoryConfig<TPromptType extends PromptType, AsTool extends boolean, Enum extends string = string> = ObjectFactoryConfig<TPromptType, AsTool, false, Enum>;

// Preserve complete caller checking while distributing result types over alternatives.
type ObjectGeneratorReturn<TConfig, TPromptType extends PromptType, AsTool extends boolean,
	WholeConfig = TConfig> = TConfig extends unknown
	? [ObjectOutputConfig<TConfig>] extends [never] ? 'Config Error: Narrow the output mode or use a union of complete configurations.'
	: LLMCallSignature<WholeConfig, Promise<results.GenerateObjectResultAugmented<ObjectOutputFromConfig<TConfig>>>,
		TPromptType, PromptSource<TPromptType>, ObjectRunConfig<ObjectOutputConfig<TConfig> & FactoryExtras<TPromptType, AsTool>, TConfig, false>>
		& (AsTool extends true ? ComponentToolFromConfig<Record<string, any>, ObjectOutputFromConfig<WholeConfig>, WholeConfig> : unknown)
	: never;

// The object intersection prevents provisional inference from hiding invalid settings.
type ObjectGeneratorFactory<TPromptType extends Exclude<PromptType, 'function'>, AsTool extends boolean = false> = <
	TConfig extends object & configs.ObjectConfigInferShape<FactoryConfig<TPromptType, AsTool, ENUM>>,
	TParentConfig extends object & NoInfer<configs.ParentObjectConfigInferShape<FactoryConfig<TPromptType, AsTool>>> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,

	TCallbackMode extends ObjectOutputMode | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	// Preserve mutable arrays of literal alternatives; the callback slot also tracks omission.
	ENUM extends string = string,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig
		& (AsTool extends true ? DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, CallbackParent<TParentConfig>,
			ObjectOutputFromConfig<ObjectCallbackConfig<CallbackParent<TParentConfig>, TSchemaOutput, TCallbackMode, TCallbackEnum>>> : unknown)
		& ObjectCallbackInput<TConfig, CallbackParent<TParentConfig>, TSchemaOutput, TCallbackMode, TCallbackEnum, false>
		& ValidateObjectConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryExtras<TPromptType, AsTool>>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ValidateObjectParentConfig<TParentConfig, FinalConfig<TParentConfig, TConfig>, FactoryExtras<TPromptType, AsTool>>>]
) => ObjectGeneratorReturn<FinalConfig<TParentConfig, TConfig>, TPromptType, AsTool>;

// Function prompts keep separate overloads for present and optional context.
type FunctionPromptSignature<AsTool extends boolean, RequiredContext extends boolean> = <
	TConfig extends object & FunctionPromptShape<configs.ObjectConfigInferShape<FactoryConfig<'function', AsTool>>>,
	TParentConfig extends object & NoInfer<FunctionPromptShape<configs.ParentObjectConfigInferShape<FactoryConfig<'function', AsTool>>>> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,

	TPromptContext extends Record<string, any> | undefined = never,
	TCallbackMode extends ObjectOutputMode | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig
		& (AsTool extends true ? DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, CallbackParent<TParentConfig>,
			ObjectOutputFromConfig<ObjectCallbackConfig<CallbackParent<TParentConfig>, TSchemaOutput, TCallbackMode, TCallbackEnum>>> : unknown)
		& FunctionPromptInput<TConfig, CallbackParent<TParentConfig>, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, AsTool, RequiredContext>
		& ObjectCallbackInput<TConfig, CallbackParent<TParentConfig>, TSchemaOutput, TCallbackMode, TCallbackEnum, false>
		& ValidateObjectConfig<TConfig, FinalConfig<TParentConfig, TConfig>, FactoryExtras<'function', AsTool>>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ValidateObjectParentConfig<TParentConfig, FinalConfig<TParentConfig, TConfig>, FactoryExtras<'function', AsTool>>>]
) => ObjectGeneratorReturn<FinalConfig<TParentConfig, TConfig>, 'function', AsTool>;

type FunctionPromptFactory<AsTool extends boolean = false> = FunctionPromptSignature<AsTool, true>
	& FunctionPromptSignature<AsTool, false>;

function withText(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'text', parent, false);
}

function withTextAsTool(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'text', parent, true);
}

function loadsText(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'text-name', parent, false);
}

function loadsTextAsTool(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'text-name', parent, true);
}

function withTemplate(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-template', parent, false);
}

function withTemplateAsTool(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-template', parent, true);
}

function loadsTemplate(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-template-name', parent, false);
}

function loadsTemplateAsTool(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-template-name', parent, true);
}

function withScript(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-script', parent, false);
}

function withScriptAsTool(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-script', parent, true);
}

function loadsScript(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-script-name', parent, false);
}

function loadsScriptAsTool(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-script-name', parent, true);
}

function withFunction(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'function', parent, false);
}

function withFunctionAsTool(config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'function', parent, true);
}

function _createObjectGenerator(
	config: configs.GenerateObjectBaseConfig<any, AnyPromptSource, any>,
	promptType: PromptType,
	parent?: configs.ConfigProvider<configs.BaseConfig>,
	isTool = false,
): unknown {

	const merged = { ...(parent ? mergeConfigs(parent.config, config) : processConfig(config)), promptType };

	// Set default output value to make the config explicit.
	// This simplifies downstream logic
	if ((merged as unknown as configs.GenerateObjectObjectConfig<any, any>).output === undefined) {
		(merged as unknown as configs.GenerateObjectObjectConfig<any, any>).output = 'object';
	}

	validateObjectLLMConfig(merged, promptType, isTool, false); // isStreamer = false

	// Debug output if config.debug is true
	if ('debug' in merged && merged.debug) {
		console.log('[DEBUG] _ObjectGenerator created with config:', merged);
	}

	return _createLLMComponent(
		merged as configs.OptionalPromptConfig & { model: LanguageModel, prompt: string, schema: SchemaType<any> },
		request => generateObject(request as GenerateObjectRequest).then(augmentObjectResult),
		{ type: 'GenerateObject', streaming: false, ...(isTool ? { toolValue: (result: { readonly object: unknown }) => result.object } : {}) },
	);
}

export const ObjectGenerator = Object.assign(withText as ObjectGeneratorFactory<'text'>, { // default is withText
	withTemplate: Object.assign(withTemplate as ObjectGeneratorFactory<'async-template'>, {
		asTool: withTemplateAsTool as ObjectGeneratorFactory<'async-template', true>,
	}),
	withScript: Object.assign(withScript as ObjectGeneratorFactory<'async-script'>, {
		asTool: withScriptAsTool as ObjectGeneratorFactory<'async-script', true>,
	}),
	withText: Object.assign(withText as ObjectGeneratorFactory<'text'>, {
		asTool: withTextAsTool as ObjectGeneratorFactory<'text', true>,
	}),
	loadsTemplate: Object.assign(loadsTemplate as ObjectGeneratorFactory<'async-template-name'>, {
		asTool: loadsTemplateAsTool as ObjectGeneratorFactory<'async-template-name', true>,
	}),
	loadsScript: Object.assign(loadsScript as ObjectGeneratorFactory<'async-script-name'>, {
		asTool: loadsScriptAsTool as ObjectGeneratorFactory<'async-script-name', true>,
	}),
	loadsText: Object.assign(loadsText as ObjectGeneratorFactory<'text-name'>, {
		asTool: loadsTextAsTool as ObjectGeneratorFactory<'text-name', true>,
	}),
	withFunction: Object.assign(withFunction as FunctionPromptFactory, {
		asTool: withFunctionAsTool as FunctionPromptFactory<true>,
	}),
	asTool: withTextAsTool as ObjectGeneratorFactory<'text', true>
});
