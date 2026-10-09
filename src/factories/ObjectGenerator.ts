import type { FlexibleSchema } from 'ai';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import { attachRendererTool } from '../renderer-tool.js';
import { generateObject } from "ai";
import type { LanguageModel, ModelMessage } from "ai";

import * as results from '../types/result.js'
import * as configs from '../types/config.js';
import * as utils from '../types/utils.js';
import * as types from '../types/types.js';

import { LLMCallSignature, _createLLMComponent } from "../llm-component.js";
import { mergeConfigs, processConfig } from "../config-utils.js";
import { validateObjectLLMConfig } from "../validate.js";
import type { Provisional, ResolvedConfig } from '../types/provisional.js';
import type { EmptyMap } from '../types/merge.js';
import type { ObjectCallbackShape, ObjectCallbackInput, ObjectRunConfig } from '../types/callbacks.js';
import type { ValidateObjectConfig, ValidateObjectParentConfig } from '../types/config-validation.js';

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
type InheritedShapeOf<TFinalConfig, TShape> = Omit<TShape, 'mode' | 'schemaName' | 'schemaDescription'>
	& Pick<ShapeOf<TFinalConfig>, Extract<keyof ShapeOf<TFinalConfig>, 'mode' | 'schemaName' | 'schemaDescription'>>;

// Parameterize return types by concrete promptType literal used by implementation
type GenerateObjectReturn<
	TConfig extends configs.BaseConfig, // & configs.OptionalPromptConfig,
	PType extends types.RequiredPromptType,
	OUTPUT, //@out
	ENUM extends string,
	PROMPT extends types.AnyPromptSource,
	TConfigShape,
	WholeConfig extends configs.BaseConfig = TConfig
> =
	TConfig extends { output: 'array', schema: types.SchemaType<OUTPUT> }
	? LLMCallSignature<WholeConfig, Promise<results.GenerateObjectArrayResult<utils.InferParameters<TConfig['schema']>>>, PType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, false>>
	: TConfig extends { output: 'array' }
	? `Config Error: Array output requires a schema`
	: TConfig extends { output: 'enum', enum: readonly (ENUM)[] }
	? LLMCallSignature<WholeConfig, Promise<results.GenerateObjectEnumResult<TConfig["enum"][number]>>, PType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, false>>
	: TConfig extends { output: 'enum' }
	? `Config Error: Enum output requires an enum`
	: TConfig extends { output: 'no-schema' }
	? LLMCallSignature<WholeConfig, Promise<results.GenerateObjectNoSchemaResult>, PType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, false>>
	: TConfig extends { output?: 'object' | undefined, schema: types.SchemaType<OUTPUT> }
	? LLMCallSignature<WholeConfig, Promise<results.GenerateObjectObjectResult<utils.InferParameters<TConfig['schema']>>>, PType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, false>>
	: `Config Error: Object output requires a schema`;

// With parent
type GenerateObjectWithParentReturn<
	TConfig extends configs.BaseConfig, // & configs.OptionalPromptConfig,
	TParentConfig extends configs.BaseConfig, // & configs.OptionalPromptConfig,
	PType extends types.RequiredPromptType,
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
		TFinalConfig & configs.BaseConfig, // & configs.OptionalPromptConfig,
		PType,
		OUTPUT extends never ? PARENT_OUTPUT : OUTPUT, //@out
		ENUM extends never ? PARENT_ENUM : ENUM,
		PROMPT,
		InheritedShapeOf<TFinalConfig, TConfigShape>
	>

// A text-only prompt has no inputs
function withText<
	TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<never, OUTPUT, ENUM, PROMPT>>>,
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
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<never, OUTPUT, ENUM, PROMPT>>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<never, PARENT_OUTPUT, PARENT_ENUM, PROMPT>>>,
	OUTPUT,
	ENUM extends string,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig>>,
): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'text',
	OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, ShapeOf<TConfig>>

// Implementation signature that handles both cases
function withText<
	TConfig extends configs.GenerateObjectConfig<never, OUTPUT, ENUM>,
	TParentConfig extends configs.GenerateObjectConfig<never, PARENT_OUTPUT, PARENT_ENUM>,
	OUTPUT,
	ENUM extends string,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'text', OUTPUT, ENUM, PROMPT, ShapeOf<TConfig>> {
	return _createObjectGenerator(config as configs.GenerateObjectConfig<never, OUTPUT, ENUM> & configs.OptionalPromptConfig, 'text',
		parent as configs.ConfigProvider<configs.GenerateObjectConfig<never, OUTPUT, ENUM> & configs.OptionalPromptConfig>, false
	) as unknown as GenerateObjectReturn<TConfig, 'text', OUTPUT, ENUM, PROMPT, ShapeOf<TConfig>>
}

function withTextAsTool<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.ToolConfig<INPUT, OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ToolConfig<INPUT, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'text', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;

function withTextAsTool<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.ToolConfig<INPUT, OUTPUT>>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],

	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	FINAL_OUTPUT = OUTPUT extends never ? PARENT_OUTPUT : OUTPUT,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ToolConfig<INPUT, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'text',
	OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, FINAL_OUTPUT, TFinalConfig>;

//Implementation
function withTextAsTool<
	TConfig extends configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ToolConfig<INPUT, OUTPUT>,
	TParentConfig extends configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ToolConfig<INPUT, OUTPUT>
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'text', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig> {
	return _createObjectGeneratorAsTool(
		config as configs.GenerateObjectConfig<never, OUTPUT, ENUM> & configs.OptionalPromptConfig & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>,
		'text',
		parent as configs.ConfigProvider<configs.GenerateObjectConfig<never, OUTPUT, ENUM> & configs.OptionalPromptConfig>
	) as unknown as GenerateObjectReturn<TConfig, 'text', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;
}

function loadsText<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<never, OUTPUT, ENUM, PROMPT> & configs.LoaderConfig>>,
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
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<never, OUTPUT, ENUM, PROMPT> & configs.LoaderConfig>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<never, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.LoaderConfig>>,
	OUTPUT,
	ENUM extends string,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string = string,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type,
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
function loadsText<
	TConfig extends configs.GenerateObjectConfig<never, OUTPUT, ENUM> & configs.LoaderConfig,
	TParentConfig extends configs.GenerateObjectConfig<never, PARENT_OUTPUT, PARENT_ENUM> & configs.LoaderConfig,
	OUTPUT,
	ENUM extends string,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string = string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.LoaderConfig & configs.NamedPromptConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'text-name', OUTPUT, ENUM, string, TConfigShape> {
	return _createObjectGenerator(
		config,
		'text-name',
		parent as configs.ConfigProvider<configs.GenerateObjectConfig<never, OUTPUT, ENUM> & configs.OptionalPromptConfig>, false
	) as unknown as GenerateObjectReturn<TConfig, 'text-name', OUTPUT, ENUM, PROMPT, TConfigShape>;
}

function loadsTextAsTool<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends string = string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT> & configs.NamedPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'text-name', OUTPUT, ENUM, PROMPT, TConfigShape>
	& results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;

function loadsTextAsTool<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string = string,

	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	FINAL_OUTPUT = OUTPUT extends never ? PARENT_OUTPUT : OUTPUT,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT> & configs.NamedPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'text-name', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, FINAL_OUTPUT, TFinalConfig>;

//Implementation
function loadsTextAsTool<
	TConfig extends configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>,
	TParentConfig extends configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends string = string,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	FINAL_OUTPUT = OUTPUT extends never ? PARENT_OUTPUT : OUTPUT,
	FINAL_ENUM extends string = ENUM extends never ? PARENT_ENUM : ENUM,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT> & configs.NamedPromptConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'text-name', FINAL_OUTPUT, FINAL_ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, FINAL_OUTPUT, TConfig> {
	return _createObjectGeneratorAsTool(
		config as configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.OptionalPromptConfig & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>,
		'text-name',
		parent as configs.ConfigProvider<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.OptionalPromptConfig>
	) as unknown as GenerateObjectReturn<TConfig, 'text-name', FINAL_OUTPUT, FINAL_ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, FINAL_OUTPUT, TConfig>;
}

function withTemplate<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig>>,
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
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM>> & configs.TemplatePromptConfig>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM>> & configs.TemplatePromptConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
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
function withTemplate<
	TConfig extends configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig,
	TParentConfig extends configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.TemplatePromptConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, string, TConfigShape> {
	return _createObjectGenerator(config, 'async-template', parent, false) as unknown as GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, string, TConfigShape>;
}

function withTemplateAsTool<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.TemplatePromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;

function withTemplateAsTool<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.TemplatePromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	FINAL_OUTPUT = OUTPUT extends never ? PARENT_OUTPUT : OUTPUT,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-template', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, FINAL_OUTPUT, TFinalConfig>;

function withTemplateAsTool<
	TConfig extends Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM>> & configs.TemplatePromptConfig & configs.ToolConfig<INPUT, OUTPUT>,
	TParentConfig extends Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM>> & configs.TemplatePromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig> {
	return _createObjectGeneratorAsTool(
		config as configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.OptionalPromptConfig & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>,
		'async-template',
		parent
	) as unknown as GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;
}

function loadsTemplate<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig>>,
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
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
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
function loadsTemplate<
	TConfig extends configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig,
	TParentConfig extends configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'async-template-name', OUTPUT, ENUM, string, TConfigShape> {
	return _createObjectGenerator(config, 'async-template-name', parent, false) as unknown as GenerateObjectReturn<TConfig, 'async-template-name', OUTPUT, ENUM, string, TConfigShape>;
}

function loadsTemplateAsTool<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'async-template-name', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;

function loadsTemplateAsTool<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	FINAL_OUTPUT = OUTPUT extends never ? PARENT_OUTPUT : OUTPUT,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-template-name', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, FINAL_OUTPUT, TFinalConfig>;

function loadsTemplateAsTool<
	TConfig extends Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	TParentConfig extends Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'async-template-name', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig> {
	return _createObjectGeneratorAsTool(
		config as configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.OptionalPromptConfig & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>,
		'async-template-name',
		parent as configs.ConfigProvider<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.OptionalPromptConfig & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>>
	) as unknown as GenerateObjectReturn<TConfig, 'async-template-name', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;
}

function withScript<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig>>,
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
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
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
function withScript<
	TConfig extends configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig,
	TParentConfig extends configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'async-script', OUTPUT, ENUM, string, TConfigShape> {
	return _createObjectGenerator(config, 'async-script', parent, false) as unknown as GenerateObjectReturn<TConfig, 'async-script', OUTPUT, ENUM, string, TConfigShape>;
}

function withScriptAsTool<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.ScriptPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'async-script', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;

function withScriptAsTool<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	FINAL_OUTPUT = OUTPUT extends never ? PARENT_OUTPUT : OUTPUT,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-script', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, FINAL_OUTPUT, TFinalConfig>;

function withScriptAsTool<
	TConfig extends configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.ToolConfig<INPUT, OUTPUT>,
	TParentConfig extends configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'async-script', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig> {
	return _createObjectGeneratorAsTool(
		config as configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.OptionalPromptConfig & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>,
		'async-script',
		parent
	) as unknown as GenerateObjectReturn<TConfig, 'async-script', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;
}

function loadsScript<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig>>,
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
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
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
function loadsScript<
	TConfig extends configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig,
	TParentConfig extends configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'async-script-name', OUTPUT, ENUM, string, TConfigShape> {
	return _createObjectGenerator(config, 'async-script-name', parent, false) as unknown as GenerateObjectReturn<TConfig, 'async-script-name', OUTPUT, ENUM, string, TConfigShape>;
}

function loadsScriptAsTool<
	const TConfig extends Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'async-script-name', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;

function loadsScriptAsTool<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,

	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	FINAL_OUTPUT = OUTPUT extends never ? PARENT_OUTPUT : OUTPUT,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'async-script-name', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, string, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, FINAL_OUTPUT, TFinalConfig>;

function loadsScriptAsTool<
	TConfig extends configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<INPUT, OUTPUT>,
	TParentConfig extends configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'async-script-name', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig> {
	return _createObjectGeneratorAsTool(
		config as configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM> & configs.OptionalPromptConfig & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>,
		'async-script-name',
		parent
	) as unknown as GenerateObjectReturn<TConfig, 'async-script-name', OUTPUT, ENUM, string, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;
}

function withFunction<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, false, true> & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.FunctionPromptConfig>,
): GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape>;

function withFunction<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, false, false> & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.FunctionPromptConfig>,
): GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape>;

// Overload 2: With parent parameter
function withFunction<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig>>>>,
	TParentConfig extends FunctionPromptShape<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.FunctionPromptConfig>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, false, true> & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.FunctionPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.FunctionPromptConfig>>,

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'function', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape>;

function withFunction<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig>>>>,
	TParentConfig extends FunctionPromptShape<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.FunctionPromptConfig>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, false, false> & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.FunctionPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.FunctionPromptConfig>>,

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'function', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape>;

// Implementation signature that handles both cases
function withFunction<
	TConfig extends configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig,
	TParentConfig extends configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.FunctionPromptConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape> {
	return _createObjectGenerator(config, 'function', parent, false) as unknown as GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape>;
}

function withFunctionAsTool<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, true, true> & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;

function withFunctionAsTool<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, true, false> & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
): GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;

function withFunctionAsTool<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>>>,
	TParentConfig extends FunctionPromptShape<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,

	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	FINAL_OUTPUT = OUTPUT extends never ? PARENT_OUTPUT : OUTPUT,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, true, true> & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'function', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, FINAL_OUTPUT, TFinalConfig>;

function withFunctionAsTool<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>>>>,
	TParentConfig extends FunctionPromptShape<ObjectCallbackShape<Partial<configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,

	FINAL_INPUT extends Record<string, any> = utils.Override<PARENT_INPUT, INPUT>,
	FINAL_OUTPUT = OUTPUT extends never ? PARENT_OUTPUT : OUTPUT,

	TFinalConfig extends configs.FinalGenerateObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	const TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, true, false> & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, false> & ValidateObjectConfig<TConfig, TFinalConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectParentConfig<TParentConfig, TFinalConfig,
		configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>>>

): GenerateObjectWithParentReturn<TConfig, TParentConfig, 'function', OUTPUT, ENUM, PARENT_OUTPUT, PARENT_ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<FINAL_INPUT, FINAL_OUTPUT, TFinalConfig>;

function withFunctionAsTool<
	TConfig extends configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<INPUT, OUTPUT>,
	TParentConfig extends configs.GenerateObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PARENT_ENUM, PROMPT> & configs.FunctionPromptConfig & configs.ToolConfig<PARENT_INPUT, PARENT_OUTPUT>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PARENT_ENUM extends string,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig> & configs.FunctionPromptConfig & configs.ToolConfig<Record<string, any>, OUTPUT>,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig> {
	return _createObjectGeneratorAsTool(
		config as configs.GenerateObjectConfig<INPUT, OUTPUT, ENUM, PROMPT> & configs.OptionalPromptConfig & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>,
		'function',
		parent
	) as unknown as GenerateObjectReturn<TConfig, 'function', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;
}

//common function for the specialized from/loads Template/Script/Text
function _createObjectGenerator<
	TConfig extends configs.GenerateObjectBaseConfig<INPUT, PROMPT, any>,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends types.AnyPromptSource,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig>,
>(
	config: TConfig,
	promptType: types.PromptType,
	parent?: configs.ConfigProvider<configs.BaseConfig>,
	isTool = false,
): GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, PROMPT, TConfigShape> {

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
		generateObject as (config: configs.OptionalPromptConfig) => any
	) as unknown as GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, PROMPT, TConfigShape>;
}

function _createObjectGeneratorAsTool<
	TConfig extends configs.GenerateObjectBaseConfig<INPUT, PROMPT, any> & configs.OptionalPromptConfig & configs.ContextSchemaConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	ENUM extends string,
	PROMPT extends types.AnyPromptSource = types.AnyPromptSource,
	TConfigShape extends ShapeOf<TConfig> = ShapeOf<TConfig>,
>(
	config: TConfig & { description?: string; inputSchema: types.SchemaType<INPUT> },
	promptType: types.PromptType,
	parent?: configs.ConfigProvider<configs.BaseConfig & configs.OptionalPromptConfig>,
): GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, PROMPT, TConfigShape> & results.ComponentToolFromConfig<INPUT, OUTPUT, TConfig> {

	const renderer = _createObjectGenerator(config, promptType, parent, true) as unknown as
		GenerateObjectReturn<TConfig, 'async-template', OUTPUT, ENUM, PROMPT, TConfigShape> & { config: TConfig };
	return attachRendererTool<INPUT, OUTPUT, TConfig, typeof renderer>(renderer,
		async context =>
			(await (renderer as unknown as (context: INPUT) => Promise<results.GenerateObjectObjectResult<OUTPUT>>)(context)).object,
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
	withFunction: Object.assign(withFunction, {
		asTool: withFunctionAsTool,
	}),
	asTool: withTextAsTool
});
