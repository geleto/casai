import type { FlexibleSchema } from 'ai';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import { attachRendererTool } from '../renderer-tool.js';
import { generateText } from "ai";
import type { ToolSet, ModelMessage } from "ai";

import * as results from '../types/result.js';
import * as configs from '../types/config.js';
import type { RequiredInheritedConfig, RequiredModelConfig, ValidateGenerateTextConfig, ValidateGenerateTextParentConfig } from '../types/config-validation.js';
import * as utils from '../types/utils.js';
import * as types from '../types/types.js';

import { LLMCallSignature, _createLLMComponent } from "../llm-component.js";
import { mergeConfigs, processConfig } from "../config-utils.js";
import { validateTextLLMConfig } from "../validate.js";
import type { Provisional, ResolvedConfig } from '../types/provisional.js';
import type { EmptyMap } from '../types/merge.js';
import type { CallbackConfigShape, TextCallbackInput, OutputFromConfig, RuntimeContextFromConfig } from '../types/callbacks.js';

type CommonConfig = configs.TextConfigShape<configs.GenerateTextConfig<ToolSet, never, types.AnyPromptSource>>;

// The generic return type for a TextGenerator instance.
// It correctly infers the TOOL and INPUT types from the final merged config.
// Parameterize by the concrete promptType literal used by the implementation.
type GenerateTextReturn<
	TConfig extends configs.BaseConfig, // & configs.OptionalPromptConfig,
	_TOOLS extends ToolSet,
	PType extends types.RequiredPromptType,
	PROMPT extends types.AnyPromptSource,
	TConfigShape extends CommonConfig,
> = LLMCallSignature<TConfig, Promise<results.GenerateTextResultAugmented<configs.ToolsFromConfig<TConfig>, OutputFromConfig<TConfig>, RuntimeContextFromConfig<TConfig>>>, PType, PROMPT, configs.TextRunConfig<TConfigShape, configs.ToolsFromConfig<TConfig>, TConfig>>;

// Version of the return type for when a parent config is present.
// Ensure the final merged config reflects the concrete promptType at the type level.
type GenerateTextWithParentReturn<
	TConfig extends Partial<configs.BaseConfig>, // configs.OptionalPromptConfig
	TParentConfig extends Partial<configs.BaseConfig>, // configs.OptionalPromptConfig
	PType extends types.RequiredPromptType,
	PROMPT extends types.AnyPromptSource,
	TConfigShape extends CommonConfig,

	FINAL_TOOLS extends ToolSet = configs.MergedTools<TParentConfig, ResolvedConfig<TConfig>>,
	TFinalConfig extends configs.BaseConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>> & configs.BaseConfig,
> = LLMCallSignature<TFinalConfig, Promise<results.GenerateTextResultAugmented<FINAL_TOOLS, OutputFromConfig<TFinalConfig>, RuntimeContextFromConfig<TFinalConfig>>>, PType, PROMPT, configs.TextRunConfig<TConfigShape, FINAL_TOOLS, TFinalConfig>>;

function withText<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, never, PROMPT>>>,
	TOOLS extends ToolSet = ToolSet,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends CommonConfig = CommonConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<
		TConfig, TConfig, configs.GenerateTextConfig<TOOLS, never, PROMPT>
	>
): GenerateTextReturn<TConfig, TOOLS, 'text', PROMPT, TConfigShape>;

function withText<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, never, PROMPT>>>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, never, PROMPT>>>>,
	TOOLS extends ToolSet,
	PARENT_TOOLS extends ToolSet,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends CommonConfig = CommonConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, never, PROMPT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<TOOLS, never, PROMPT>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'text', PROMPT, TConfigShape>;

function withText(
	config: any,
	parent?: configs.ConfigProvider<any>
) {
	return _createTextGenerator(config, 'text', parent, false);
}

function withTextAsTool<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.ToolConfig<INPUT, string>>>,
	INPUT extends Record<string, any>,
	TOOLS extends ToolSet = ToolSet,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends CommonConfig = CommonConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'text', PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

function withTextAsTool<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.ToolConfig<INPUT, string>>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.ToolConfig<INPUT, string>>>>,
	INPUT extends Record<string, any>,
	PARENT_INPUT extends Record<string, any>,
	TOOLS extends ToolSet,
	PARENT_TOOLS extends ToolSet,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.ToolConfig<INPUT, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.ToolConfig<PARENT_INPUT, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'text', PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

// Implementation
function withTextAsTool(config: any, parent?: configs.ConfigProvider<any>) {
	return _createTextGeneratorAsTool(config, 'text', parent);
}

function loadsText<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, never, PROMPT> & configs.LoaderConfig>>,
	TOOLS extends ToolSet,
	PROMPT extends string = string,
	TConfigShape extends CommonConfig = CommonConfig & configs.LoaderConfig
 & configs.NamedPromptConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, never, PROMPT> & configs.LoaderConfig>
): GenerateTextReturn<TConfig, TOOLS, 'text-name', PROMPT, TConfigShape>;

function loadsText<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, never, PROMPT>> & configs.LoaderConfig>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, never, PROMPT> & configs.LoaderConfig>>>,
	TOOLS extends ToolSet,
	PARENT_TOOLS extends ToolSet,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	PROMPT extends string = string,
	TConfigShape extends CommonConfig = CommonConfig & configs.LoaderConfig
 & configs.NamedPromptConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<any, never, PROMPT> & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<any, never, PROMPT> & configs.LoaderConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'text-name', PROMPT, TConfigShape>;

function loadsText(config: any, parent?: configs.ConfigProvider<any>) {
	return _createTextGenerator(config, 'text-name', parent, false);
}

function loadsTextAsTool<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>>,
	INPUT extends Record<string, any>,
	TOOLS extends ToolSet,
	PROMPT extends string = string,
	TConfigShape extends CommonConfig = CommonConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>
 & configs.NamedPromptConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'text-name', PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

function loadsTextAsTool<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, string>>>>,
	INPUT extends Record<string, any>,
	TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	PROMPT extends string = string,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TConfigShape extends CommonConfig = CommonConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>
 & configs.NamedPromptConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig & { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'text-name', PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

//Implementation
function loadsTextAsTool(config: any, parent?: configs.ConfigProvider<any>) {
	return _createTextGeneratorAsTool(config, 'text-name', parent);
}

function withTemplate<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>
): GenerateTextReturn<TConfig, TOOLS, 'async-template', string, TConfigShape>

function withTemplate<
	const TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.TemplatePromptConfig>>>,
	const TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-template', string, TConfigShape>

function withTemplate(
	config: any,
	parent?: configs.ConfigProvider<any>,
) {
	return _createTextGenerator(config, 'async-template', parent, false);
}

function withTemplateAsTool<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, string>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'async-template', string, CommonConfig & configs.TemplatePromptConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

function withTemplateAsTool<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, string>>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.ToolConfig<PARENT_INPUT, string>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-template', string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

function withTemplateAsTool(
	config: any,
	parent?: configs.ConfigProvider<any>) {
	return _createTextGeneratorAsTool(config, 'async-template', parent);
}

function loadsTemplate<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>
): GenerateTextReturn<TConfig, TOOLS, 'async-template-name', string, CommonConfig & configs.TemplatePromptConfig & configs.LoaderConfig>;

function loadsTemplate<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.TemplatePromptConfig & configs.LoaderConfig>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig & configs.LoaderConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-template-name', string, TConfigShape>;

function loadsTemplate(config: any, parent?: configs.ConfigProvider<any>) {
	return _createTextGenerator(config, 'async-template-name', parent, false);
}

function loadsTemplateAsTool<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'async-template-name', string, CommonConfig & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

function loadsTemplateAsTool<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, string>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig & { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-template-name', string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

function loadsTemplateAsTool(
	config: any,
	parent?: configs.ConfigProvider<any>) {
	return _createTextGeneratorAsTool(config, 'async-template-name', parent);
}

function withScript<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig>
): GenerateTextReturn<TConfig, TOOLS, 'async-script', string, CommonConfig & configs.ScriptPromptConfig>;

function withScript<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.ScriptPromptConfig>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ScriptPromptConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-script', string, TConfigShape>;

function withScript(config: any, parent?: configs.ConfigProvider<any>) {
	return _createTextGenerator(config, 'async-script', parent, false);
}

function withScriptAsTool<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, string>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'async-script', string, CommonConfig & configs.ScriptPromptConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

function withScriptAsTool<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, string>>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.ToolConfig<PARENT_INPUT, string>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ScriptPromptConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-script', string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

function withScriptAsTool(config: any, parent?: configs.ConfigProvider<any>) {
	return _createTextGeneratorAsTool(config, 'async-script', parent);
}

function loadsScript<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>
): GenerateTextReturn<TConfig, TOOLS, 'async-script-name', string, CommonConfig & configs.ScriptPromptConfig & configs.LoaderConfig>;

function loadsScript<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.ScriptPromptConfig & configs.LoaderConfig>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ScriptPromptConfig & configs.LoaderConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-script-name', string, TConfigShape>;

function loadsScript(config: any, parent?: configs.ConfigProvider<any>) {
	return _createTextGenerator(config, 'async-script-name', parent, false);
}

function loadsScriptAsTool<
	const TConfig extends Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'async-script-name', string, CommonConfig & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

function loadsScriptAsTool<
	TConfig extends Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>>>,
	TParentConfig extends CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, string>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig & { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-script-name', string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

function loadsScriptAsTool(config: any, parent?: configs.ConfigProvider<any>) {
	return _createTextGeneratorAsTool(config, 'async-script-name', parent);
}

function withFunction<
	TConfig extends FunctionPromptShape<Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, false, true> & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig,
		configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig>
): GenerateTextReturn<TConfig, TOOLS, 'function', PROMPT, CommonConfig & configs.FunctionPromptConfig>;

function withFunction<
	TConfig extends FunctionPromptShape<Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: { tools?: TOOLS } & TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, false, false> & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig,
		configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig>
): GenerateTextReturn<TConfig, TOOLS, 'function', PROMPT, CommonConfig & configs.FunctionPromptConfig>;

function withFunction<
	TConfig extends FunctionPromptShape<Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.FunctionPromptConfig>>>>,
	TParentConfig extends FunctionPromptShape<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.FunctionPromptConfig>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends CommonConfig = CommonConfig & configs.FunctionPromptConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, false, true> & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { prompt: (...args: never[]) => ReturnType<types.PromptFunction> }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig,
		configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'function', PROMPT, TConfigShape>;

function withFunction<
	TConfig extends FunctionPromptShape<Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.FunctionPromptConfig>>>>,
	TParentConfig extends FunctionPromptShape<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.FunctionPromptConfig>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends CommonConfig = CommonConfig & configs.FunctionPromptConfig,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: { tools?: TOOLS } & TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, false, false> & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { prompt: (...args: never[]) => ReturnType<types.PromptFunction> }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig,
		configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'function', PROMPT, TConfigShape>;

function withFunction(config: any, parent?: configs.ConfigProvider<any>) {
	return _createTextGenerator(config, 'function', parent, false);
}

function withFunctionAsTool<
	TConfig extends FunctionPromptShape<Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	config: { tools?: TOOLS } & TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, true, true> & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig,
		configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'function', PROMPT, CommonConfig & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

function withFunctionAsTool<
	TConfig extends FunctionPromptShape<Provisional<CallbackConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: { tools?: TOOLS } & TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, true, false> & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig,
		configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'function', PROMPT, CommonConfig & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, string, TConfig>;

function withFunctionAsTool<
	TConfig extends FunctionPromptShape<Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>>>>,
	TParentConfig extends FunctionPromptShape<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, string>>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends CommonConfig = CommonConfig & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// Infer the callback before validating the inherited config; const preserves its schema type.
	config: { tools?: TOOLS } & TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, true, true> & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { inputSchema: types.SchemaType<any> } & { prompt: (...args: never[]) => ReturnType<types.PromptFunction> }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig,
		configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'function', PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

function withFunctionAsTool<
	TConfig extends FunctionPromptShape<Provisional<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>>>>,
	TParentConfig extends FunctionPromptShape<CallbackConfigShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, string>>>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends CommonConfig = CommonConfig & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends ToolSet | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// Infer the callback before validating the inherited config; const preserves its schema type.
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: { tools?: TOOLS } & TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, true, false> & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { inputSchema: types.SchemaType<any> } & { prompt: (...args: never[]) => ReturnType<types.PromptFunction> }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig,
		configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'function', PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, string, TFinalConfig>;

function withFunctionAsTool(config: any, parent?: configs.ConfigProvider<any>) {
	return _createTextGeneratorAsTool(config, 'function', parent);
}

function _createTextGenerator<
	TConfig extends CommonConfig, // & configs.OptionalPromptConfig,
	TOOLS extends ToolSet
>(
	config: TConfig,
	promptType: types.RequiredPromptType,
	parent?: configs.ConfigProvider<TConfig>,
	isTool = false,
): GenerateTextReturn<TConfig, TOOLS, types.RequiredPromptType, string, CommonConfig> {

	const merged = { ...(parent ? mergeConfigs(parent.config, config) : processConfig(config)), promptType };

	validateTextLLMConfig(merged, promptType, isTool);

	// Debug output if config.debug is true
	if ('debug' in merged && merged.debug) {
		console.log('[DEBUG] _TextGenerator created with config:', merged);
	}

	return _createLLMComponent(
		merged as configs.GenerateTextConfig<ToolSet, Record<string, any>> & configs.OptionalPromptConfig,
		generateText as (config: configs.GenerateTextConfig<ToolSet, Record<string, any>> & configs.OptionalPromptConfig) => any
	) as unknown as GenerateTextReturn<TConfig, TOOLS, types.RequiredPromptType, string, CommonConfig>;
}

function _createTextGeneratorAsTool<
	TConfig extends CommonConfig & configs.OptionalPromptConfig & configs.ContextSchemaConfig & { inputSchema: types.SchemaType<Record<string, any>> },
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
>(
	config: TConfig & { description?: string },
	promptType: types.RequiredPromptType,
	parent?: configs.ConfigProvider<configs.BaseConfig & configs.OptionalPromptConfig>
): GenerateTextReturn<TConfig, TOOLS, types.RequiredPromptType, string, CommonConfig> & results.ComponentToolFromConfig<INPUT, string, TConfig> {

	const renderer = _createTextGenerator(config as any, promptType, parent, true) as unknown as
		GenerateTextReturn<TConfig, TOOLS, types.RequiredPromptType, string, CommonConfig>;
	return attachRendererTool<INPUT, string, TConfig, typeof renderer>(renderer,
		async context =>
			(await (renderer as unknown as (context: INPUT) => Promise<results.GenerateTextResult<TOOLS, any, any>>)(context)).text,
	);

}

export const TextGenerator = Object.assign(withText, { // default is withText
	withTemplate: Object.assign(withTemplate, {
		asTool: withTemplateAsTool,
	}),
	withScript: Object.assign(withScript, {
		asTool: withScriptAsTool,
	}),
	withText: Object.assign(withText, {
		asTool: withTextAsTool,
	}),
	loadsTemplate: Object.assign(loadsTemplate, {
		asTool: loadsTemplateAsTool,
	}),
	loadsScript: Object.assign(loadsScript, {
		asTool: loadsScriptAsTool,
	}),
	loadsText: Object.assign(loadsText, {
		asTool: loadsTextAsTool,
	}),
	withFunction: Object.assign(withFunction, {
		asTool: withFunctionAsTool,
	}),
	asTool: withTextAsTool
});
