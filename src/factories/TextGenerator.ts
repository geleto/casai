import type { SchemaConfigInferShape, ConfigSchemas } from '../types/function-config.js';
import type { DescriptorInput, TextCallbackConfig } from '../types/callbacks.js';
import { validateRegistryConfig } from '../execution.js';
import type { InferGenerateOutput } from 'ai';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import { generateTextWithResult } from '../augment-result.js';
import type { ToolSet, ModelMessage } from "ai";

import * as results from '../types/result.js';
import * as configs from '../types/config.js';
import type { OutputFromConfig, ValueOutputFromConfig, RuntimeContextFromConfig } from '../types/config.js';
import type { RequiredInheritedConfig, RequiredModelConfig, ValidateGenerateTextConfig, ValidateGenerateTextParentConfig } from '../types/config-validation.js';
import * as utils from '../types/utils.js';
import * as types from '../types/types.js';

import { LLMCallSignature, _createLLMComponent } from "../llm-component.js";
import { mergeConfigs, processConfig } from "../config-utils.js";
import { validateTextLLMConfig } from "../validate.js";
import type { ResolvedConfig } from '../types/provisional.js';
import type { EmptyMap } from '../types/merge.js';
import type { TextCallbackInput, ParentToolSelectionInput } from '../types/callbacks.js';

type CommonConfig = configs.TextConfigShape<configs.GenerateTextConfig<ToolSet, never, types.AnyPromptSource>>;

// The generic return type for a TextGenerator instance.
// It correctly infers the TOOL and INPUT types from the final merged config.
// Parameterize by the concrete promptType literal used by the implementation.
type GenerateTextReturn<
	TConfig,
	_TOOLS extends ToolSet,
	TPromptType extends types.RequiredPromptType,
	PROMPT extends types.AnyPromptSource,
	TConfigShape extends CommonConfig,
> = LLMCallSignature<TConfig, Promise<results.GenerateTextResultAugmented<configs.ToolsFromConfig<TConfig>, OutputFromConfig<TConfig>, RuntimeContextFromConfig<TConfig>, ValueOutputFromConfig<TConfig>>>, TPromptType, PROMPT, configs.TextRunConfig<TConfigShape, configs.ToolsFromConfig<TConfig>, TConfig>>;

// Version of the return type for when a parent config is present.
// Ensure the final merged config reflects the concrete promptType at the type level.
type GenerateTextWithParentReturn<
	TConfig,
	TParentConfig,
	TPromptType extends types.RequiredPromptType,
	PROMPT extends types.AnyPromptSource,
	TConfigShape extends CommonConfig,

	FINAL_TOOLS extends ToolSet = configs.MergedTools<TParentConfig, ResolvedConfig<TConfig>>,
	TFinalConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
> = LLMCallSignature<TFinalConfig, Promise<results.GenerateTextResultAugmented<FINAL_TOOLS, OutputFromConfig<TFinalConfig>, RuntimeContextFromConfig<TFinalConfig>, ValueOutputFromConfig<TFinalConfig>>>, TPromptType, PROMPT, configs.TextRunConfig<TConfigShape, FINAL_TOOLS, TFinalConfig>>;

// Ordinary config inference widens inline defaults while preserving declared runtime-context unions.
function withText<
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, never, PROMPT>>,
	TOOLS extends ToolSet = ToolSet,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends CommonConfig = CommonConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<
		TConfig, TConfig, configs.GenerateTextConfig<TOOLS, never, PROMPT>
	>
): GenerateTextReturn<TConfig, TOOLS, 'text', PROMPT, TConfigShape>;

function withText<
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, never, PROMPT>>>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, never, PROMPT>>,
	TOOLS extends ToolSet,
	PARENT_TOOLS extends ToolSet,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends CommonConfig = CommonConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, never, PROMPT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<TOOLS, never, PROMPT>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'text', PROMPT, TConfigShape>;

function withText(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'text', parent, false);
}

function withTextAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.ToolConfig<INPUT, string>>,
	INPUT extends Record<string, any>,
	TOOLS extends ToolSet = ToolSet,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends CommonConfig = CommonConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'text', PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, InferGenerateOutput<ValueOutputFromConfig<TConfig>>, TConfig>;

function withTextAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.ToolConfig<INPUT, string>>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.ToolConfig<INPUT, string>>,
	INPUT extends Record<string, any>,
	PARENT_INPUT extends Record<string, any>,
	TOOLS extends ToolSet,
	PARENT_TOOLS extends ToolSet,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.ToolConfig<INPUT, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.ToolConfig<PARENT_INPUT, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'text', PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, InferGenerateOutput<ValueOutputFromConfig<TFinalConfig>>, TFinalConfig>;

// Implementation
function withTextAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'text', parent, true);
}

function loadsText<
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, never, PROMPT> & configs.LoaderConfig>,
	TOOLS extends ToolSet,
	PROMPT extends string = string,
	TConfigShape extends CommonConfig = CommonConfig & configs.LoaderConfig
 & configs.NamedPromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, never, PROMPT> & configs.LoaderConfig>
): GenerateTextReturn<TConfig, TOOLS, 'text-name', PROMPT, TConfigShape>;

function loadsText<
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, never, PROMPT>> & configs.LoaderConfig>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, never, PROMPT> & configs.LoaderConfig>,
	TOOLS extends ToolSet,
	PARENT_TOOLS extends ToolSet,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends string = string,
	TConfigShape extends CommonConfig = CommonConfig & configs.LoaderConfig
 & configs.NamedPromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<any, never, PROMPT> & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<any, never, PROMPT> & configs.LoaderConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'text-name', PROMPT, TConfigShape>;

function loadsText(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'text-name', parent, false);
}

function loadsTextAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>,
	INPUT extends Record<string, any>,
	TOOLS extends ToolSet,
	PROMPT extends string = string,
	TConfigShape extends CommonConfig = CommonConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>
 & configs.NamedPromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'text-name', PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, InferGenerateOutput<ValueOutputFromConfig<TConfig>>, TConfig>;

function loadsTextAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, string>>,
	INPUT extends Record<string, any>,
	TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends string = string,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TConfigShape extends CommonConfig = CommonConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>
 & configs.NamedPromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig & { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'text-name', PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, InferGenerateOutput<ValueOutputFromConfig<TFinalConfig>>, TFinalConfig>;

//Implementation
function loadsTextAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'text-name', parent, true);
}

function withTemplate<
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>
): GenerateTextReturn<TConfig, TOOLS, 'async-template', string, TConfigShape>

function withTemplate<
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.TemplatePromptConfig>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ParentToolSelectionInput<TParentConfig, TCallbackTools> & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-template', string, TConfigShape>

function withTemplate(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-template', parent, false);
}

function withTemplateAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, string>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'async-template', string, CommonConfig & configs.TemplatePromptConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, InferGenerateOutput<ValueOutputFromConfig<TConfig>>, TConfig>;

function withTemplateAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, string>>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.ToolConfig<PARENT_INPUT, string>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-template', string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, InferGenerateOutput<ValueOutputFromConfig<TFinalConfig>>, TFinalConfig>;

function withTemplateAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-template', parent, true);
}

function loadsTemplate<
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>
): GenerateTextReturn<TConfig, TOOLS, 'async-template-name', string, CommonConfig & configs.TemplatePromptConfig & configs.LoaderConfig>;

function loadsTemplate<
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.TemplatePromptConfig & configs.LoaderConfig>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig & configs.LoaderConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-template-name', string, TConfigShape>;

function loadsTemplate(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-template-name', parent, false);
}

function loadsTemplateAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'async-template-name', string, CommonConfig & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, InferGenerateOutput<ValueOutputFromConfig<TConfig>>, TConfig>;

function loadsTemplateAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, string>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig & { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-template-name', string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, InferGenerateOutput<ValueOutputFromConfig<TFinalConfig>>, TFinalConfig>;

function loadsTemplateAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-template-name', parent, true);
}

function withScript<
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig>
): GenerateTextReturn<TConfig, TOOLS, 'async-script', string, CommonConfig & configs.ScriptPromptConfig>;

function withScript<
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.ScriptPromptConfig>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ScriptPromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-script', string, TConfigShape>;

function withScript(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-script', parent, false);
}

function withScriptAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, string>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'async-script', string, CommonConfig & configs.ScriptPromptConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, InferGenerateOutput<ValueOutputFromConfig<TConfig>>, TConfig>;

function withScriptAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, string>>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.ToolConfig<PARENT_INPUT, string>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ScriptPromptConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-script', string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, InferGenerateOutput<ValueOutputFromConfig<TFinalConfig>>, TFinalConfig>;

function withScriptAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-script', parent, true);
}

function loadsScript<
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>
): GenerateTextReturn<TConfig, TOOLS, 'async-script-name', string, CommonConfig & configs.ScriptPromptConfig & configs.LoaderConfig>;

function loadsScript<
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.ScriptPromptConfig & configs.LoaderConfig>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ScriptPromptConfig & configs.LoaderConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
>(
	config: { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-script-name', string, TConfigShape>;

function loadsScript(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-script-name', parent, false);
}

function loadsScriptAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'async-script-name', string, CommonConfig & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, InferGenerateOutput<ValueOutputFromConfig<TConfig>>, TConfig>;

function loadsScriptAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT>> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, string>>>,
	TParentConfig extends configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, string>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends CommonConfig = CommonConfig & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, configs.LoaderConfig & { inputSchema: types.SchemaType<any> } & { prompt: string | ModelMessage[] }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig, configs.GenerateTextConfig<TOOLS, INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'async-script-name', string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, InferGenerateOutput<ValueOutputFromConfig<TFinalConfig>>, TFinalConfig>;

function loadsScriptAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'async-script-name', parent, true);
}

type FunctionPromptSignature<RequiredContext extends boolean> = <
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolsContext extends object | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & FunctionPromptInput<TConfig, EmptyMap, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, false, RequiredContext, TCallbackTools, TPromptToolsContext> & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig,
		configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig>
) => GenerateTextReturn<TConfig, TOOLS, 'function', PROMPT, CommonConfig & configs.FunctionPromptConfig>;

type ParentFunctionPromptSignature<RequiredContext extends boolean> = <
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.FunctionPromptConfig>>>,
	TParentConfig extends FunctionPromptShape<configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.FunctionPromptConfig>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends CommonConfig = CommonConfig & configs.FunctionPromptConfig,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolsContext extends object | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & FunctionPromptInput<TConfig, TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, false, RequiredContext, TCallbackTools, TPromptToolsContext> & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { prompt: (...args: never[]) => ReturnType<types.PromptFunction> }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig,
		configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig>>
) => GenerateTextWithParentReturn<TConfig, TParentConfig, 'function', PROMPT, TConfigShape>;

type FunctionPromptFactory = FunctionPromptSignature<true> & FunctionPromptSignature<false> & ParentFunctionPromptSignature<true> & ParentFunctionPromptSignature<false>;

function withFunction(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'function', parent, false);
}

function withFunctionAsTool<
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolsContext extends object | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & FunctionPromptInput<TConfig, EmptyMap, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, true, true, TCallbackTools, TPromptToolsContext> & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig,
		configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'function', PROMPT, CommonConfig & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, InferGenerateOutput<ValueOutputFromConfig<TConfig>>, TConfig>;

function withFunctionAsTool<
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.TextConfigInferShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolsContext extends object | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & FunctionPromptInput<TConfig, EmptyMap, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, true, false, TCallbackTools, TPromptToolsContext> & TextCallbackInput<TConfig, EmptyMap, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TConfig,
		configs.GenerateTextConfig<TOOLS, INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>
): GenerateTextReturn<TConfig, TOOLS, 'function', PROMPT, CommonConfig & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, string>> & results.ComponentToolFromConfig<INPUT, InferGenerateOutput<ValueOutputFromConfig<TConfig>>, TConfig>;

function withFunctionAsTool<
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>>>,
	TParentConfig extends FunctionPromptShape<configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, string>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends CommonConfig = CommonConfig & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolsContext extends object | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	// Infer the callback before validating the inherited config; const preserves its schema type.
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & FunctionPromptInput<TConfig, TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, true, true, TCallbackTools, TPromptToolsContext> & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { inputSchema: types.SchemaType<any> } & { prompt: (...args: never[]) => ReturnType<types.PromptFunction> }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig,
		configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'function', PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, InferGenerateOutput<ValueOutputFromConfig<TFinalConfig>>, TFinalConfig>;

function withFunctionAsTool<
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.TextConfigInferShape<Partial<configs.TextConfigShape<configs.GenerateTextConfig<TOOLS, INPUT, PROMPT>> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, string>>>>,
	TParentConfig extends FunctionPromptShape<configs.ParentTextConfigInferShape<configs.GenerateTextConfig<PARENT_TOOLS, PARENT_INPUT, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, string>>>,
	TOOLS extends ToolSet,
	INPUT extends Record<string, any>,
	PARENT_TOOLS extends ToolSet,
	PARENT_INPUT extends Record<string, any>,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateTextConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends CommonConfig = CommonConfig & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, string>,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolsContext extends object | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	// Infer the callback before validating the inherited config; const preserves its schema type.
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, InferGenerateOutput<ValueOutputFromConfig<TextCallbackConfig<TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput>>>> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } } & TConfig & FunctionPromptInput<TConfig, TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, true, false, TCallbackTools, TPromptToolsContext> & RequiredModelConfig<TParentConfig> & RequiredInheritedConfig<TParentConfig, { inputSchema: types.SchemaType<any> } & { prompt: (...args: never[]) => ReturnType<types.PromptFunction> }> & TextCallbackInput<TConfig, TParentConfig, TCallbackTools, TCallbackRuntime, TCallbackOutput, false> & ValidateGenerateTextConfig<TConfig, TFinalConfig,
		configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<any, string>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateGenerateTextParentConfig<TParentConfig, configs.GenerateTextConfig<any, any, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<any, string>>>
): GenerateTextWithParentReturn<TConfig, TParentConfig, 'function', PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, InferGenerateOutput<ValueOutputFromConfig<TFinalConfig>>, TFinalConfig>;

function withFunctionAsTool(config: CommonConfig, parent?: configs.ConfigProvider<CommonConfig>): unknown {
	return _createTextGenerator(config, 'function', parent, true);
}

function _createTextGenerator(
	config: CommonConfig,
	promptType: types.RequiredPromptType,
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
		(request, conversation) => generateTextWithResult(request as Parameters<typeof generateTextWithResult>[0], conversation),
		{ type: 'GenerateText', streaming: false, ...(isTool ? { toolValue: (result: { readonly value: unknown }) => result.value } : {}) },
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
	withFunction: Object.assign(withFunction as FunctionPromptFactory, {
		asTool: withFunctionAsTool,
	}),
	asTool: withTextAsTool
});
