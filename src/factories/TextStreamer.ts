import type { InputSchemaSetting } from '../types/function-config.js';
import { validateRegistryConfig } from '../execution.js';
import type { FlexibleSchema } from 'ai';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import { streamTextWithResult } from '../augment-result.js';
import type { ToolSet, ModelMessage } from "ai";

import * as results from '../types/result.js';
import * as configs from '../types/config.js';
import type { OutputFromConfig, ValueOutputFromConfig, RuntimeContextFromConfig } from '../types/config.js';
import type { RequiredInheritedConfig, RequiredModelConfig, ValidateStreamTextConfig, ValidateStreamTextParentConfig } from '../types/config-validation.js';
import * as utils from '../types/utils.js';
import * as types from '../types/types.js';

import { LLMCallSignature, _createLLMComponent } from "../llm-component.js";
import { mergeConfigs, processConfig } from "../config-utils.js";
import { validateTextLLMConfig } from "../validate.js";
import type { Provisional, ResolvedConfig } from '../types/provisional.js';
import type { EmptyMap } from '../types/merge.js';
import type { CallbackConfigShape, TextCallbackInput, ParentToolSelectionInput } from '../types/callbacks.js';

type CommonConfig = configs.TextConfigShape<configs.StreamTextConfig<ToolSet, never, types.AnyPromptSource>>;

// The generic return type for a TextStreamer instance.
// It correctly infers the TOOL and INPUT types from the final merged config.
// Parameterize by the concrete promptType literal used by the implementation.
// Plain inline text prompts return the stream object without the promise as they don't render the prompt
type StreamTextReturn<
	TConfig,
	_TOOLS extends ToolSet,
	PType extends types.RequiredPromptType,
	PROMPT extends types.AnyPromptSource,
	TConfigShape extends CommonConfig,
	IsAsync extends boolean = false
> = LLMCallSignature<TConfig, utils.ConditionalPromise<results.StreamTextResultAugmented<configs.ToolsFromConfig<TConfig>, OutputFromConfig<TConfig>, RuntimeContextFromConfig<TConfig>, ValueOutputFromConfig<TConfig>>, IsAsync>, PType, PROMPT, configs.TextRunConfig<TConfigShape, configs.ToolsFromConfig<TConfig>, TConfig, true>>;

type StreamTextPromiseReturn<
	TConfig,
	TOOLS extends ToolSet,
	PType extends types.RequiredPromptType,
	PROMPT extends types.AnyPromptSource,
	TConfigShape extends CommonConfig,
> = StreamTextReturn<TConfig, TOOLS, PType, PROMPT, TConfigShape, true>;

// Version of the return type for when a parent config is present.
// Ensure the final merged config reflects the concrete promptType at the type level.
// Plain inline text prompts return the stream object without the promise as they don't render the prompt
type StreamTextWithParentReturn<
	TConfig,
	TParentConfig,
	PType extends types.RequiredPromptType,
	PROMPT extends types.AnyPromptSource,
	TConfigShape extends CommonConfig,
	FINAL_TOOLS extends ToolSet = configs.MergedTools<TParentConfig, ResolvedConfig<TConfig>>,
	TFinalConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	IsAsync extends boolean = false
> = LLMCallSignature<TFinalConfig, utils.ConditionalPromise<results.StreamTextResultAugmented<FINAL_TOOLS, OutputFromConfig<TFinalConfig>, RuntimeContextFromConfig<TFinalConfig>, ValueOutputFromConfig<TFinalConfig>>, IsAsync>, PType, PROMPT, configs.TextRunConfig<TConfigShape, FINAL_TOOLS, TFinalConfig, true>>;

type StreamTextWithParentPromiseReturn<
	TConfig,
	TParentConfig,
	PType extends types.RequiredPromptType,
	PROMPT extends types.AnyPromptSource,
	TConfigShape extends CommonConfig,
	FINAL_TOOLS extends ToolSet = configs.MergedTools<TParentConfig, ResolvedConfig<TConfig>>,
	TFinalConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>
> = StreamTextWithParentReturn<TConfig, TParentConfig, PType, PROMPT, TConfigShape, FINAL_TOOLS, TFinalConfig, true>;

// Ordinary config inference widens inline defaults while preserving declared runtime-context unions.
function withText<
	TConfig extends Provisional<CallbackConfigShape<configs.StreamTextConfig<TOOLS, never, PROMPT>>>,
	TOOLS extends ToolSet = ToolSet,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends CommonConfig = CommonConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<
		TConfig, TConfig, configs.StreamTextConfig<TOOLS, never, PROMPT>
	>
): StreamTextReturn<TConfig, TOOLS, 'text', PROMPT, TConfigShape>;

function withText<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<TOOLS, never, PROMPT>>>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<PARENT_TOOLS, never, PROMPT>>>>,
	TOOLS extends ToolSet,
	PARENT_TOOLS extends ToolSet,
	TFinalConfig extends configs.FinalStreamTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends CommonConfig = CommonConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TFinalConfig, configs.StreamTextConfig<TOOLS, never, PROMPT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateStreamTextParentConfig<TParentConfig, configs.StreamTextConfig<TOOLS, never, PROMPT>>>
): StreamTextWithParentReturn<TConfig, TParentConfig, 'text', PROMPT, TConfigShape>;

// Inline text calls the SDK directly, so the overloads declare a result without a promise.
function withText(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'text', parent);
}

function loadsText<
	TConfig extends Provisional<CallbackConfigShape<configs.StreamTextConfig<TOOLS, never, PROMPT> & configs.LoaderConfig>>,
	TOOLS extends ToolSet,
	PROMPT extends string = string,
	TConfigShape extends CommonConfig = CommonConfig & configs.LoaderConfig
 & configs.NamedPromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TConfig, configs.StreamTextConfig<TOOLS, never, PROMPT> & configs.LoaderConfig>
): StreamTextPromiseReturn<TConfig, TOOLS, 'text-name', PROMPT, TConfigShape>;

function loadsText<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<TOOLS, never, PROMPT>> & configs.LoaderConfig>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<PARENT_TOOLS, never, PROMPT> & configs.LoaderConfig>>>,
	TOOLS extends ToolSet,
	PARENT_TOOLS extends ToolSet,
	TFinalConfig extends configs.FinalStreamTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends string = string,
	TConfigShape extends CommonConfig = CommonConfig & configs.LoaderConfig
 & configs.NamedPromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TFinalConfig, configs.StreamTextConfig<any, never, PROMPT> & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateStreamTextParentConfig<TParentConfig, configs.StreamTextConfig<any, never, PROMPT> & configs.LoaderConfig>>
): StreamTextWithParentPromiseReturn<TConfig, TParentConfig, 'text-name', PROMPT, TConfigShape>;

function loadsText(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'text-name', parent);
}

function withTemplate<
	TConfig extends Provisional<CallbackConfigShape<configs.StreamTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TConfig, configs.StreamTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>
): StreamTextPromiseReturn<TConfig, TOOLS, 'async-template', string, TConfigShape>

function withTemplate<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<TOOLS, INPUT>> & configs.TemplatePromptConfig>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalStreamTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TFinalConfig, configs.StreamTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ParentToolSelectionInput<TParentConfig, TCallbackTools> & ValidateStreamTextParentConfig<TParentConfig, configs.StreamTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>>
): StreamTextWithParentPromiseReturn<TConfig, TParentConfig, 'async-template', string, TConfigShape>

function withTemplate(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'async-template', parent);
}

function loadsTemplate<
	TConfig extends Provisional<CallbackConfigShape<configs.StreamTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TConfig, configs.StreamTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>
): StreamTextPromiseReturn<TConfig, TOOLS, 'async-template-name', string, CommonConfig & configs.TemplatePromptConfig & configs.LoaderConfig>;

function loadsTemplate<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<TOOLS, INPUT>> & configs.TemplatePromptConfig & configs.LoaderConfig>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalStreamTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig & configs.LoaderConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TFinalConfig, configs.StreamTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateStreamTextParentConfig<TParentConfig, configs.StreamTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>
): StreamTextWithParentPromiseReturn<TConfig, TParentConfig, 'async-template-name', string, TConfigShape>;

function loadsTemplate(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'async-template-name', parent);
}

function withScript<
	TConfig extends Provisional<CallbackConfigShape<configs.StreamTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TConfig, configs.StreamTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig>
): StreamTextPromiseReturn<TConfig, TOOLS, 'async-script', string, CommonConfig & configs.ScriptPromptConfig>;

function withScript<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<TOOLS, INPUT>> & configs.ScriptPromptConfig>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalStreamTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ScriptPromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TFinalConfig, configs.StreamTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateStreamTextParentConfig<TParentConfig, configs.StreamTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig>>
): StreamTextWithParentPromiseReturn<TConfig, TParentConfig, 'async-script', string, TConfigShape>;

function withScript(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'async-script', parent);
}

function loadsScript<
	TConfig extends Provisional<CallbackConfigShape<configs.StreamTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TConfig, configs.StreamTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>
): StreamTextPromiseReturn<TConfig, TOOLS, 'async-script-name', string, CommonConfig & configs.ScriptPromptConfig & configs.LoaderConfig>;

function loadsScript<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<TOOLS, INPUT>> & configs.ScriptPromptConfig & configs.LoaderConfig>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalStreamTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ScriptPromptConfig & configs.LoaderConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TFinalConfig, configs.StreamTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateStreamTextParentConfig<TParentConfig, configs.StreamTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>
): StreamTextWithParentPromiseReturn<TConfig, TParentConfig, 'async-script-name', string, TConfigShape>;

function loadsScript(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'async-script-name', parent);
}

type FunctionPromptSignature<RequiredInput extends boolean, RequiredContext extends boolean> = <
	TConfig extends FunctionPromptShape<Provisional<CallbackConfigShape<configs.StreamTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
	TPromptToolsContext extends object | undefined = never,
>(
	config: InputSchemaSetting<TPromptInput, RequiredInput> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, false, RequiredContext, TCallbackTools, TPromptToolsContext> & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TConfig,
		configs.StreamTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig>
) => StreamTextPromiseReturn<TConfig, TOOLS, 'function', PROMPT, CommonConfig & configs.FunctionPromptConfig>;

type ParentFunctionPromptSignature<RequiredInput extends boolean, RequiredContext extends boolean> = <
	TConfig extends FunctionPromptShape<Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<TOOLS, INPUT, PROMPT>> & configs.FunctionPromptConfig>>>>,
	TParentConfig extends FunctionPromptShape<CallbackConfigShape<Partial<configs.TextConfigShape<configs.StreamTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.FunctionPromptConfig>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalStreamTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends CommonConfig = CommonConfig & configs.FunctionPromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
	TPromptToolsContext extends object | undefined = never,
>(
	config: InputSchemaSetting<TPromptInput, RequiredInput> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, false, RequiredContext, TCallbackTools, TPromptToolsContext> & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { prompt: (...args: never[]) => ReturnType<types.PromptFunction> }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, true> & ValidateStreamTextConfig<TConfig, TFinalConfig,
		configs.StreamTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateStreamTextParentConfig<TParentConfig, configs.StreamTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig>>
) => StreamTextWithParentPromiseReturn<TConfig, TParentConfig, 'function', PROMPT, TConfigShape>;

type FunctionPromptFactory = FunctionPromptSignature<true, true> & FunctionPromptSignature<true, false>
	& ParentFunctionPromptSignature<true, true> & ParentFunctionPromptSignature<true, false>
	& FunctionPromptSignature<false, true> & FunctionPromptSignature<false, false>
	& ParentFunctionPromptSignature<false, true> & ParentFunctionPromptSignature<false, false>;

function withFunction(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextStreamer(config, 'function', parent);
}

function _createTextStreamer(
	config: CommonConfig,
	promptType: types.RequiredPromptType,
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
		(request, conversation) => streamTextWithResult(request as Parameters<typeof streamTextWithResult>[0], conversation),
		{ type: 'StreamText', streaming: true },
	);
}

export const TextStreamer = Object.assign(withText, { // default is withText
	withTemplate,
	withScript,
	withText,
	loadsTemplate,
	loadsScript,
	loadsText,
	withFunction: withFunction as FunctionPromptFactory
});
