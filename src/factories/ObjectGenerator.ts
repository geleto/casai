import type { SchemaConfigInferShape, ConfigSchemas } from '../types/function-config.js';
import type { GenerateObjectRequest } from '../types/sdk.js';
import type { DescriptorInput, ObjectCallbackConfig } from '../types/callbacks.js';
import type { FlexibleSchema } from 'ai';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import { generateObject } from "ai";
import { augmentObjectResult } from '../augment-result.js';
import type { LanguageModel, ModelMessage } from "ai";

import * as results from '../types/result.js'
import * as configs from '../types/config.js';
import type { ObjectOutputFromConfig } from '../types/config.js';
import * as utils from '../types/utils.js';
import * as types from '../types/types.js';

import { LLMCallSignature, _createLLMComponent } from "../llm-component.js";
import { mergeConfigs, processConfig } from "../config-utils.js";
import { validateObjectLLMConfig } from "../validate.js";
import type { ResolvedConfig } from '../types/provisional.js';
import type { EmptyMap } from '../types/merge.js';
import type { ObjectCallbackShape, ObjectCallbackInput, ObjectRunConfig } from '../types/callbacks.js';
import type { RequiredInheritedConfig, ValidateObjectConfig, ValidateObjectParentConfig } from '../types/config-validation.js';

type CommonGenerateObjectObjectConfig = configs.GenerateObjectObjectConfig<Record<string, any>, any, types.AnyPromptSource>;
type CommonGenerateObjectArrayConfig = configs.GenerateObjectArrayConfig<Record<string, any>, any, types.AnyPromptSource>;
type CommonGenerateObjectEnumConfig = configs.GenerateObjectEnumConfig<Record<string, any>, string, types.AnyPromptSource>;
type CommonGenerateObjectNoSchemaConfig = configs.GenerateObjectNoSchemaConfig<Record<string, any>, types.AnyPromptSource>;

type ShapeOf<TConfig> =
	TConfig extends { output: 'array' }
	? CommonGenerateObjectArrayConfig
	: TConfig extends { output: 'enum' }
	? CommonGenerateObjectEnumConfig
	: TConfig extends { output: 'no-schema' }
	? CommonGenerateObjectNoSchemaConfig
	: CommonGenerateObjectObjectConfig;

// Inherited output modes determine run settings while prompt-specific settings remain available.
type InheritedShapeOf<TFinalConfig, TShape> = Omit<TShape, 'schemaName' | 'schemaDescription'>
	& Pick<ShapeOf<TFinalConfig>, Extract<keyof ShapeOf<TFinalConfig>, 'schemaName' | 'schemaDescription'>>;

// Parameterize return types by concrete promptType literal used by implementation
type GenerateObjectReturn<
	TConfig,
	TPromptType extends types.RequiredPromptType,
	OUTPUT, //@out
	ENUM extends string,
	PROMPT extends types.AnyPromptSource,
	TConfigShape,
	WholeConfig = TConfig
> =
	TConfig extends { output: 'array', schema: types.SchemaType<OUTPUT> }
	? LLMCallSignature<WholeConfig, Promise<results.GenerateObjectArrayResult<utils.InferParameters<TConfig['schema']>>>, TPromptType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, false>>
	: TConfig extends { output: 'array' }
	? `Config Error: Array output requires a schema`
	: TConfig extends { output: 'enum', enum: readonly (ENUM)[] }
	? LLMCallSignature<WholeConfig, Promise<results.GenerateObjectEnumResult<TConfig["enum"][number]>>, TPromptType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, false>>
	: TConfig extends { output: 'enum' }
	? `Config Error: Enum output requires an enum`
	: TConfig extends { output: 'no-schema' }
	? LLMCallSignature<WholeConfig, Promise<results.GenerateObjectNoSchemaResult>, TPromptType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, false>>
	: TConfig extends { output?: 'object' | undefined, schema: types.SchemaType<OUTPUT> }
	? LLMCallSignature<WholeConfig, Promise<results.GenerateObjectObjectResult<utils.InferParameters<TConfig['schema']>>>, TPromptType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, false>>
	: `Config Error: Object output requires a schema`;

// With parent
type GenerateObjectWithParentReturn<
	TConfig,
	TParentConfig, // & configs.OptionalPromptConfig,
	TPromptType extends types.RequiredPromptType,
	OUTPUT, //@out
	ENUM extends string,
	PARENT_OUTPUT, //@out
	PARENT_ENUM extends string,
	PROMPT extends types.AnyPromptSource,
	TConfigShape, // = Record<string, any>, //temp assignment
	TFinalConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,

//TConfigShape extends CommonGenerateObjectConfig
> =
	GenerateObjectReturn<
		TFinalConfig, // & configs.OptionalPromptConfig,
		TPromptType,
		OUTPUT extends never ? PARENT_OUTPUT : OUTPUT, //@out
		ENUM extends never ? PARENT_ENUM : ENUM,
		PROMPT,
		InheritedShapeOf<TFinalConfig, TConfigShape>
	>

// A text-only prompt has no inputs
function withText<
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<never, OUTPUT, ENUM, PROMPT>>,
	OUTPUT, //@out
	ENUM extends string,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig>,
): GenerateObjectReturn<TConfig, 'text', OUTPUT, ENUM, PROMPT, ShapeOf<TConfig>>;

// Overload 2: With parent parameter
function withText<
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<never, OUTPUT, ENUM, PROMPT>>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<never, PARENT_OUTPUT, PARENT_ENUM, PROMPT>>,
	OUTPUT,
	ENUM extends string,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig>>,
): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'text',
	OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, ShapeOf<TConfig>>

// Implementation signature that handles both cases
function withText(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'text', parent, false);
}

function withTextAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.ToolConfig<INPUT, OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ToolConfig<INPUT, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, ObjectOutputFromConfig<ObjectCallbackConfig<EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'text', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, ObjectOutputFromConfig<TConfig>, TConfig>;

function withTextAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.ToolConfig<INPUT, OUTPUT>>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ToolConfig<INPUT, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & RequiredInheritedConfig<TParentConfig, { inputSchema: FlexibleSchema<Record<string, any>>; prompt: string | ModelMessage[] | ((...args: never[]) => unknown); model: LanguageModel }> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, ObjectOutputFromConfig<ObjectCallbackConfig<TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'text',
	OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, ObjectOutputFromConfig<TFinalConfig>, TFinalConfig>;

//Implementation
function withTextAsTool(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'text', parent, true);
}

function loadsText<
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<never, OUTPUT, ENUM, PROMPT> & configs.LoaderConfig>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends string = string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.LoaderConfig & configs.NamedPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.LoaderConfig>,
): GenerateObjectReturn<TConfig, 'text-name', OUTPUT, ENUM, PROMPT, TConfigShape>;

// Overload 2: With parent parameter
// @todo - does this check for loader?
function loadsText<
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<never, OUTPUT, ENUM, PROMPT> & configs.LoaderConfig>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<never, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.LoaderConfig>,
	OUTPUT,
	ENUM extends string,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string = string,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>, //@todo we need just the correct output type,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.LoaderConfig & configs.NamedPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.LoaderConfig>>,

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'text-name', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape>;

// Implementation signature that handles both cases
function loadsText(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'text-name', parent, false);
}

function loadsTextAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends string = string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT> & configs.NamedPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, ObjectOutputFromConfig<ObjectCallbackConfig<EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'text-name', OUTPUT, ENUM, PROMPT, TConfigShape>
	& results.ComponentToolFromConfig<INPUT, ObjectOutputFromConfig<TConfig>, TConfig>;

function loadsTextAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string = string,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT> & configs.NamedPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & RequiredInheritedConfig<TParentConfig, { inputSchema: FlexibleSchema<Record<string, any>>; prompt: string | ModelMessage[] | ((...args: never[]) => unknown); model: LanguageModel }> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, ObjectOutputFromConfig<ObjectCallbackConfig<TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'text-name', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, ObjectOutputFromConfig<TFinalConfig>, TFinalConfig>;

//Implementation
function loadsTextAsTool(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'text-name', parent, true);
}

function withTemplate<
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig, configs.TemplatePromptConfig>,
): GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, string, TConfigShape>;

// Overload 2: With parent parameter
function withTemplate<
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM>> & configs.TemplatePromptConfig>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM>> & configs.TemplatePromptConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>, //@todo we need just the correct output type
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.TemplatePromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.TemplatePromptConfig>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-template', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape>;

// Implementation signature that handles both cases
function withTemplate(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-template', parent, false);
}

function withTemplateAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, ObjectOutputFromConfig<ObjectCallbackConfig<EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.TemplatePromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, ObjectOutputFromConfig<TConfig>, TConfig>;

function withTemplateAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.TemplatePromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & RequiredInheritedConfig<TParentConfig, { inputSchema: FlexibleSchema<Record<string, any>>; prompt: string | ModelMessage[] | ((...args: never[]) => unknown); model: LanguageModel }> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, ObjectOutputFromConfig<ObjectCallbackConfig<TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-template', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, ObjectOutputFromConfig<TFinalConfig>, TFinalConfig>;

function withTemplateAsTool(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-template', parent, true);
}

function loadsTemplate<
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig>,
): GenerateObjectReturn<TConfig, 'async-template-name', OUTPUT, ENUM, string, TConfigShape>;

// Overload 2: With parent parameter
function loadsTemplate<
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>, //@todo we need just the correct output type
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-template-name', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape>;

// Implementation signature that handles both cases
function loadsTemplate(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-template-name', parent, false);
}

function loadsTemplateAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, ObjectOutputFromConfig<ObjectCallbackConfig<EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'async-template-name', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, ObjectOutputFromConfig<TConfig>, TConfig>;

function loadsTemplateAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & RequiredInheritedConfig<TParentConfig, { inputSchema: FlexibleSchema<Record<string, any>>; prompt: string | ModelMessage[] | ((...args: never[]) => unknown); model: LanguageModel }> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, ObjectOutputFromConfig<ObjectCallbackConfig<TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-template-name', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, ObjectOutputFromConfig<TFinalConfig>, TFinalConfig>;

function loadsTemplateAsTool(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-template-name', parent, true);
}

function withScript<
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.ScriptPromptConfig>,
): GenerateObjectReturn<TConfig, 'async-script', OUTPUT, ENUM, string, TConfigShape>;

// Overload 2: With parent parameter
function withScript<
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>, //@todo we need just the correct output type
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.ScriptPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.ScriptPromptConfig>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-script', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape>;

// Implementation signature that handles both cases
function withScript(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-script', parent, false);
}

function withScriptAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, ObjectOutputFromConfig<ObjectCallbackConfig<EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.ScriptPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'async-script', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, ObjectOutputFromConfig<TConfig>, TConfig>;

function withScriptAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & RequiredInheritedConfig<TParentConfig, { inputSchema: FlexibleSchema<Record<string, any>>; prompt: string | ModelMessage[] | ((...args: never[]) => unknown); model: LanguageModel }> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, ObjectOutputFromConfig<ObjectCallbackConfig<TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-script', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, ObjectOutputFromConfig<TFinalConfig>, TFinalConfig>;

function withScriptAsTool(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-script', parent, true);
}

function loadsScript<
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig>,
): GenerateObjectReturn<TConfig, 'async-script-name', OUTPUT, ENUM, string, TConfigShape>;

// Overload 2: With parent parameter
function loadsScript<
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-script-name', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape>;

// Implementation signature that handles both cases
function loadsScript(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-script-name', parent, false);
}

function loadsScriptAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, ObjectOutputFromConfig<ObjectCallbackConfig<EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'async-script-name', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, ObjectOutputFromConfig<TConfig>, TConfig>;

function loadsScriptAsTool<
	TSchemaPresence extends object,
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & RequiredInheritedConfig<TParentConfig, { inputSchema: FlexibleSchema<Record<string, any>>; prompt: string | ModelMessage[] | ((...args: never[]) => unknown); model: LanguageModel }> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, ObjectOutputFromConfig<ObjectCallbackConfig<TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-script-name', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, ObjectOutputFromConfig<TFinalConfig>, TFinalConfig>;

function loadsScriptAsTool(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'async-script-name', parent, true);
}

type FunctionPromptSignature<RequiredContext extends boolean> = <
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig & FunctionPromptInput<TConfig, EmptyMap, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, false, RequiredContext> & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.FunctionPromptConfig>,
) => GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape>;

type ParentFunctionPromptSignature<RequiredContext extends boolean> = <
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig>>>,
	TParentConfig extends FunctionPromptShape<configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.FunctionPromptConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig & FunctionPromptInput<TConfig, TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, false, RequiredContext> & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.FunctionPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.FunctionPromptConfig>>,

) => GenerateObjectWithParentReturn<TConfig, TParentConfig, 'function', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape>;

type FunctionPromptFactory = FunctionPromptSignature<true> & FunctionPromptSignature<false> & ParentFunctionPromptSignature<true> & ParentFunctionPromptSignature<false>;

// Implementation signature that handles both cases
function withFunction(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'function', parent, false);
}

function withFunctionAsTool<
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, ObjectOutputFromConfig<ObjectCallbackConfig<EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & FunctionPromptInput<TConfig, EmptyMap, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, true, true> & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, ObjectOutputFromConfig<TConfig>, TConfig>;

function withFunctionAsTool<
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.ObjectConfigInferShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, EmptyMap, ObjectOutputFromConfig<ObjectCallbackConfig<EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & FunctionPromptInput<TConfig, EmptyMap, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, true, false> & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, ObjectOutputFromConfig<TConfig>, TConfig>;

function withFunctionAsTool<
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>>,
	TParentConfig extends FunctionPromptShape<configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & RequiredInheritedConfig<TParentConfig, { inputSchema: FlexibleSchema<Record<string, any>>; prompt: string | ModelMessage[] | ((...args: never[]) => unknown); model: LanguageModel }> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, ObjectOutputFromConfig<ObjectCallbackConfig<TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & FunctionPromptInput<TConfig, TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, true, true> & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'function', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, ObjectOutputFromConfig<TFinalConfig>, TFinalConfig>;

function withFunctionAsTool<
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.ObjectConfigInferShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>>,
	TParentConfig extends FunctionPromptShape<configs.ParentObjectConfigInferShape<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & RequiredInheritedConfig<TParentConfig, { inputSchema: FlexibleSchema<Record<string, any>>; prompt: string | ModelMessage[] | ((...args: never[]) => unknown); model: LanguageModel }> & DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TParentConfig, ObjectOutputFromConfig<ObjectCallbackConfig<TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum>>> & TConfig & FunctionPromptInput<TConfig, TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, true, false> & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'function', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, ObjectOutputFromConfig<TFinalConfig>, TFinalConfig>;

function withFunctionAsTool(config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectGenerator(config, 'function', parent, true);
}

//common function for the specialized from/loads Template/Script/Text
function _createObjectGenerator(
	config: configs.GenerateObjectBaseConfig<any, types.AnyPromptSource, any>,
	promptType: types.PromptType,
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
		merged as configs.OptionalPromptConfig & { model: LanguageModel, prompt: string, schema: types.SchemaType<any> },
		request => generateObject(request as GenerateObjectRequest).then(augmentObjectResult),
		{ type: 'GenerateObject', streaming: false, ...(isTool ? { toolValue: (result: { readonly object: unknown }) => result.object } : {}) },
	);
}

export const ObjectGenerator = Object.assign(withText, { // default is withText
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
