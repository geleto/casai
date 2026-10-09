import type { FlexibleSchema } from 'ai';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import { streamObject } from "ai";
import type { LanguageModel, ModelMessage } from "ai";

import * as results from '../types/result.js'
import * as configs from '../types/config.js';
import * as utils from '../types/utils.js';
import * as types from '../types/types.js';

import type { ValidateObjectStreamerConfig, ValidateObjectStreamerParentConfig } from '../types/config-validation.js';
import type { Provisional, ResolvedConfig } from '../types/provisional.js';
import type { EmptyMap } from '../types/merge.js';
import type { ObjectCallbackShape, ObjectCallbackInput, ObjectRunConfig } from '../types/callbacks.js';

import { LLMCallSignature, _createLLMComponent } from "../llm-component.js";
import { mergeConfigs, processConfig } from "../config-utils.js";
import { validateObjectLLMConfig } from "../validate.js";

type CommonStreamObjectObjectConfig = configs.StreamObjectObjectConfig<Record<string, any>, any, types.AnyPromptSource>;
type CommonStreamObjectArrayConfig = configs.StreamObjectArrayConfig<Record<string, any>, any, types.AnyPromptSource>;
type CommonStreamObjectNoSchemaConfig = configs.StreamObjectNoSchemaConfig<Record<string, any>, types.AnyPromptSource>;

type ShapeOf<TConfig> =
	TConfig extends { output: 'array' }
	? CommonStreamObjectArrayConfig
	: TConfig extends { output: 'no-schema' }
	? CommonStreamObjectNoSchemaConfig
	: CommonStreamObjectObjectConfig;

// Inherited output modes determine run settings while prompt-specific settings remain available.
type InheritedShapeOf<TFinalConfig, TShape> = Omit<TShape, 'mode' | 'schemaName' | 'schemaDescription'>
	& Pick<ShapeOf<TFinalConfig>, Extract<keyof ShapeOf<TFinalConfig>, 'mode' | 'schemaName' | 'schemaDescription'>>;

// Parameterize return types by concrete promptType literal used by implementation
// Plain text prompts return the stream object without the promise as they don't render the prompt
type StreamObjectReturn<
	TConfig extends configs.BaseConfig,
	PType extends types.RequiredPromptType,
	OUTPUT, //@out
	PROMPT extends types.AnyPromptSource,
	TConfigShape,
	IsAsync extends boolean = false,
	WholeConfig extends configs.BaseConfig = TConfig
> =
	TConfig extends { output: 'array', schema: types.SchemaType<OUTPUT> }
	? LLMCallSignature<WholeConfig, utils.ConditionalPromise<results.StreamObjectArrayResult<utils.InferParameters<TConfig['schema']>>, IsAsync>, PType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, true>>
	: TConfig extends { output: 'array' }
	? `Config Error: Array output requires a schema`
	: TConfig extends { output: 'no-schema' }
	? LLMCallSignature<WholeConfig, utils.ConditionalPromise<results.StreamObjectNoSchemaResult, IsAsync>, PType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, true>>
	: TConfig extends { output?: 'object' | undefined, schema: types.SchemaType<OUTPUT> }
	? LLMCallSignature<WholeConfig, utils.ConditionalPromise<results.StreamObjectObjectResult<utils.InferParameters<TConfig['schema']>>, IsAsync>, PType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, true>>
	: `Config Error: Object output requires a schema`;

type StreamObjectPromiseReturn<
	TConfig extends configs.BaseConfig,
	PType extends types.RequiredPromptType,
	OUTPUT, //@out
	PROMPT extends types.AnyPromptSource,
	TConfigShape,
> =
	StreamObjectReturn<TConfig, PType, OUTPUT, PROMPT, TConfigShape, true>;



// With parent
// Plain text prompts return the stream object without the promise as they don't render the prompt
type StreamObjectWithParentReturn<
	TConfig extends configs.BaseConfig, // & configs.OptionalPromptConfig,
	TParentConfig extends configs.BaseConfig, // & configs.OptionalPromptConfig,
	PType extends types.RequiredPromptType,
	OUTPUT, //@out
	PARENT_OUTPUT, //@out
	PROMPT extends types.AnyPromptSource,
	TConfigShape,
	TFinalConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
> =
	StreamObjectReturn<
		TFinalConfig & configs.BaseConfig, // & configs.OptionalPromptConfig,
		PType,
		OUTPUT extends never ? PARENT_OUTPUT : OUTPUT, //@out
		PROMPT,
		InheritedShapeOf<TFinalConfig, TConfigShape>
	>

type StreamObjectWithParentPromiseReturn<
	TConfig extends configs.BaseConfig, // & configs.OptionalPromptConfig,
	TParentConfig extends configs.BaseConfig, // & configs.OptionalPromptConfig,
	PType extends types.RequiredPromptType,
	OUTPUT, //@out
	PARENT_OUTPUT, //@out
	PROMPT extends types.AnyPromptSource,
	TConfigShape,
	TFinalConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>
> =
	StreamObjectPromiseReturn<
		TFinalConfig & configs.BaseConfig, // & configs.OptionalPromptConfig,
		PType,
		OUTPUT extends never ? PARENT_OUTPUT : OUTPUT, //@out
		PROMPT,
		InheritedShapeOf<TFinalConfig, TConfigShape>
	>

// A text-only prompt has no inputs
function withText<
	TConfig extends Provisional<ObjectCallbackShape<configs.StreamObjectConfig<never, OUTPUT, PROMPT>>>,
	OUTPUT, //@out
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape = ShapeOf<TConfig>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TConfig>,
): StreamObjectReturn<TConfig, 'text', OUTPUT, PROMPT, TConfigShape>;

// Overload 2: With parent parameter
function withText<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.StreamObjectConfig<never, OUTPUT, PROMPT>>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.StreamObjectConfig<never, PARENT_OUTPUT, PROMPT>>>,
	OUTPUT,
	PARENT_OUTPUT,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape = ShapeOf<TConfig>,

	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TFinalConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectStreamerParentConfig<TParentConfig, TFinalConfig>>,
): StreamObjectWithParentReturn<TConfig, TParentConfig, 'text',
	OUTPUT, PARENT_OUTPUT, PROMPT, TConfigShape>

// Implementation signature that handles both cases
function withText<
	TConfig extends configs.StreamObjectConfig<never, OUTPUT>,
	TParentConfig extends configs.StreamObjectConfig<never, PARENT_OUTPUT>,
	OUTPUT,
	PARENT_OUTPUT,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape = ShapeOf<TConfig>,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): StreamObjectReturn<TConfig, 'text', OUTPUT, PROMPT, TConfigShape> {
	return _createObjectStreamer(config as configs.StreamObjectConfig<never, OUTPUT> & configs.OptionalPromptConfig, 'text',
		parent as configs.ConfigProvider<configs.StreamObjectConfig<never, OUTPUT> & configs.OptionalPromptConfig>, false
	) as unknown as StreamObjectReturn<TConfig, 'text', OUTPUT, PROMPT, TConfigShape>
}

function loadsText<
	const TConfig extends Provisional<ObjectCallbackShape<configs.StreamObjectConfig<never, OUTPUT, PROMPT> & configs.LoaderConfig>>,
	OUTPUT,
	PROMPT extends string = string,
	TConfigShape = ShapeOf<TConfig> & configs.LoaderConfig & configs.NamedPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TConfig,
		configs.LoaderConfig>,
): StreamObjectPromiseReturn<TConfig, 'text-name', OUTPUT, PROMPT, TConfigShape>;

// Overload 2: With parent parameter
// @todo - does this check for loader?
function loadsText<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.StreamObjectConfig<never, OUTPUT, PROMPT> & configs.LoaderConfig>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.StreamObjectConfig<never, PARENT_OUTPUT, PROMPT> & configs.LoaderConfig>>,
	OUTPUT,
	PARENT_OUTPUT,
	PROMPT extends string = string,
	TConfigShape = ShapeOf<TConfig> & configs.LoaderConfig & configs.NamedPromptConfig,

	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TFinalConfig,
		configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectStreamerParentConfig<TParentConfig, TFinalConfig,
		configs.LoaderConfig>>,

): StreamObjectWithParentPromiseReturn<TConfig, TParentConfig, 'text-name', OUTPUT, PARENT_OUTPUT, PROMPT, TConfigShape>;


// Implementation signature that handles both cases
function loadsText<
	TConfig extends configs.StreamObjectConfig<never, OUTPUT, PROMPT> & configs.LoaderConfig,
	TParentConfig extends configs.StreamObjectConfig<never, PARENT_OUTPUT, PROMPT> & configs.LoaderConfig,
	OUTPUT,
	PARENT_OUTPUT,
	PROMPT extends string = string,
	TConfigShape = ShapeOf<TConfig> & configs.LoaderConfig & configs.NamedPromptConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): StreamObjectPromiseReturn<TConfig, 'text-name', OUTPUT, PROMPT, TConfigShape> {
	return _createObjectStreamer(
		config,
		'text-name',
		parent as configs.ConfigProvider<configs.StreamObjectConfig<never, OUTPUT> & configs.OptionalPromptConfig>, false
	) as unknown as StreamObjectPromiseReturn<TConfig, 'text-name', OUTPUT, PROMPT, TConfigShape>;
}

function withTemplate<
	const TConfig extends Provisional<ObjectCallbackShape<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.TemplatePromptConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	TConfigShape = ShapeOf<TConfig> & configs.TemplatePromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TConfig, configs.TemplatePromptConfig>,
): StreamObjectPromiseReturn<TConfig, 'async-template', OUTPUT, string, TConfigShape>;

// Overload 2: With parent parameter
function withTemplate<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT>> & configs.TemplatePromptConfig>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT>> & configs.TemplatePromptConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,

	TConfigShape = ShapeOf<TConfig> & configs.TemplatePromptConfig,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TFinalConfig,
		configs.TemplatePromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectStreamerParentConfig<TParentConfig, TFinalConfig,
		configs.TemplatePromptConfig>>

): StreamObjectWithParentPromiseReturn<TConfig, TParentConfig, 'async-template', OUTPUT, PARENT_OUTPUT, string, TConfigShape>;

// Implementation signature that handles both cases
function withTemplate<
	TConfig extends configs.StreamObjectConfig<INPUT, OUTPUT> & configs.TemplatePromptConfig,
	TParentConfig extends configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.TemplatePromptConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TConfigShape = ShapeOf<TConfig> & configs.TemplatePromptConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): StreamObjectPromiseReturn<TConfig, 'async-template', OUTPUT, string, TConfigShape> {
	return _createObjectStreamer(config, 'async-template', parent, false) as unknown as StreamObjectPromiseReturn<TConfig, 'async-template', OUTPUT, string, TConfigShape>;
}

function loadsTemplate<
	const TConfig extends Provisional<ObjectCallbackShape<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	TConfigShape = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig>,
): StreamObjectPromiseReturn<TConfig, 'async-template-name', OUTPUT, string, TConfigShape>;

// Overload 2: With parent parameter
function loadsTemplate<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,

	TConfigShape = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectStreamerParentConfig<TParentConfig, TFinalConfig,
		configs.TemplatePromptConfig & configs.LoaderConfig>>

): StreamObjectWithParentPromiseReturn<TConfig, TParentConfig, 'async-template-name', OUTPUT, PARENT_OUTPUT, string, TConfigShape>;

// Implementation signature that handles both cases
function loadsTemplate<
	TConfig extends configs.StreamObjectConfig<INPUT, OUTPUT> & configs.TemplatePromptConfig & configs.LoaderConfig,
	TParentConfig extends configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.TemplatePromptConfig & configs.LoaderConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TConfigShape = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): StreamObjectPromiseReturn<TConfig, 'async-template-name', OUTPUT, string, TConfigShape> {
	return _createObjectStreamer(config, 'async-template-name', parent, false) as unknown as StreamObjectPromiseReturn<TConfig, 'async-template-name', OUTPUT, string, TConfigShape>;
}

function withScript<
	const TConfig extends Provisional<ObjectCallbackShape<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.ScriptPromptConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	TConfigShape = ShapeOf<TConfig> & configs.ScriptPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TConfig,
		configs.ScriptPromptConfig>,
): StreamObjectPromiseReturn<TConfig, 'async-script', OUTPUT, string, TConfigShape>;

// Overload 2: With parent parameter
function withScript<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.ScriptPromptConfig>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.ScriptPromptConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TConfigShape = ShapeOf<TConfig> & configs.ScriptPromptConfig,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TFinalConfig,
		configs.ScriptPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectStreamerParentConfig<TParentConfig, TFinalConfig,
		configs.ScriptPromptConfig>>

): StreamObjectWithParentPromiseReturn<TConfig, TParentConfig, 'async-script', OUTPUT, PARENT_OUTPUT, string, TConfigShape>;

// Implementation signature that handles both cases
function withScript<
	TConfig extends configs.StreamObjectConfig<INPUT, OUTPUT> & configs.ScriptPromptConfig,
	TParentConfig extends configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.ScriptPromptConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TConfigShape = ShapeOf<TConfig> & configs.ScriptPromptConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): StreamObjectPromiseReturn<TConfig, 'async-script', OUTPUT, string, TConfigShape> {
	return _createObjectStreamer(config, 'async-script', parent, false) as unknown as StreamObjectPromiseReturn<TConfig, 'async-script', OUTPUT, string, TConfigShape>;
}

function loadsScript<
	const TConfig extends Provisional<ObjectCallbackShape<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	TConfigShape = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig>,
): StreamObjectPromiseReturn<TConfig, 'async-script-name', OUTPUT, string, TConfigShape>;

// Overload 2: With parent parameter
function loadsScript<
	TConfig extends Provisional<ObjectCallbackShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,

	TConfigShape = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectStreamerParentConfig<TParentConfig, TFinalConfig,
		configs.ScriptPromptConfig & configs.LoaderConfig>>

): StreamObjectWithParentPromiseReturn<TConfig, TParentConfig, 'async-script-name', OUTPUT, PARENT_OUTPUT, string, TConfigShape>;

// Implementation signature that handles both cases
function loadsScript<
	TConfig extends configs.StreamObjectConfig<INPUT, OUTPUT> & configs.ScriptPromptConfig & configs.LoaderConfig,
	TParentConfig extends configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.ScriptPromptConfig & configs.LoaderConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TConfigShape = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): StreamObjectPromiseReturn<TConfig, 'async-script-name', OUTPUT, string, TConfigShape> {
	return _createObjectStreamer(config, 'async-script-name', parent, false) as unknown as StreamObjectPromiseReturn<TConfig, 'async-script-name', OUTPUT, string, TConfigShape>;
}

function withFunction<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<configs.StreamObjectConfig<INPUT, OUTPUT, PROMPT> & configs.FunctionPromptConfig>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, false, true> & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TConfig,
		configs.FunctionPromptConfig>,
): StreamObjectPromiseReturn<TConfig, 'function', OUTPUT, PROMPT, TConfigShape>;

function withFunction<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<configs.StreamObjectConfig<INPUT, OUTPUT, PROMPT> & configs.FunctionPromptConfig>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: TConfig & FunctionPromptInput<TConfig, EmptyMap, TPromptInput, TPromptContext, TPromptToolContext, false, false> & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TConfig,
		configs.FunctionPromptConfig>,
): StreamObjectPromiseReturn<TConfig, 'function', OUTPUT, PROMPT, TConfigShape>;

// Overload 2: With parent parameter
function withFunction<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT, PROMPT> & configs.FunctionPromptConfig>>>>,
	TParentConfig extends FunctionPromptShape<ObjectCallbackShape<Partial<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PROMPT> & configs.FunctionPromptConfig>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	config: TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, false, true> & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TFinalConfig,
		configs.FunctionPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectStreamerParentConfig<TParentConfig, TFinalConfig,
		configs.FunctionPromptConfig>>,

): StreamObjectWithParentPromiseReturn<TConfig, TParentConfig, 'function', OUTPUT, PARENT_OUTPUT, PROMPT, TConfigShape>;

function withFunction<
	TConfig extends FunctionPromptShape<Provisional<ObjectCallbackShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT, PROMPT> & configs.FunctionPromptConfig>>>>,
	TParentConfig extends FunctionPromptShape<ObjectCallbackShape<Partial<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PROMPT> & configs.FunctionPromptConfig>>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, TConfig>, //@todo we need just the correct output type
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TPromptInput extends types.SchemaType<Record<string, any>> | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TPromptToolContext extends FlexibleSchema | undefined = never,
>(
	// eslint-disable-next-line @typescript-eslint/unified-signatures -- Separate context presence preserves contextual callback inference.
	config: TConfig & FunctionPromptInput<TConfig, TParentConfig, TPromptInput, TPromptContext, TPromptToolContext, false, false> & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TFinalConfig,
		configs.FunctionPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectStreamerParentConfig<TParentConfig, TFinalConfig,
		configs.FunctionPromptConfig>>,

): StreamObjectWithParentPromiseReturn<TConfig, TParentConfig, 'function', OUTPUT, PARENT_OUTPUT, PROMPT, TConfigShape>;

// Implementation signature that handles both cases
function withFunction<
	TConfig extends configs.StreamObjectConfig<INPUT, OUTPUT, PROMPT> & configs.FunctionPromptConfig,
	TParentConfig extends configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PROMPT> & configs.FunctionPromptConfig,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape = ShapeOf<TConfig> & configs.FunctionPromptConfig,
>(
	config: TConfig,
	parent?: configs.ConfigProvider<TParentConfig>
): StreamObjectPromiseReturn<TConfig, 'function', OUTPUT, PROMPT, TConfigShape> {
	return _createObjectStreamer(config, 'function', parent, false) as unknown as StreamObjectPromiseReturn<TConfig, 'function', OUTPUT, PROMPT, TConfigShape>;
}

//common function for the specialized from/loads Template/Script/Text
function _createObjectStreamer<
	TConfig extends configs.StreamObjectBaseConfig<INPUT, PROMPT, any>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PROMPT extends types.AnyPromptSource,
	TConfigShape = ShapeOf<TConfig>
>(
	config: TConfig,
	promptType: types.PromptType,
	parent?: configs.ConfigProvider<configs.BaseConfig>,
	isTool = false,
): StreamObjectPromiseReturn<TConfig, 'async-template', OUTPUT, PROMPT, TConfigShape> {

	const merged = { ...(parent ? mergeConfigs(parent.config, config) : processConfig(config)), promptType };

	// Set default output value to make the config explicit.
	// This simplifies downstream logic (e.g., in validation).
	if ((merged as unknown as configs.StreamObjectObjectConfig<any, any>).output === undefined) {
		(merged as unknown as configs.StreamObjectObjectConfig<any, any>).output = 'object';
	}

	validateObjectLLMConfig(merged, promptType, isTool, true); // isStreamer = true

	// Debug output if config.debug is true
	if ('debug' in merged && merged.debug) {
		console.log('[DEBUG] _ObjectStreamer created with config:', merged);
	}

	return _createLLMComponent(
		merged as configs.OptionalPromptConfig & { model: LanguageModel, prompt: string, schema: types.SchemaType<any> },
		streamObject as (config: configs.OptionalPromptConfig) => any
	) as unknown as StreamObjectPromiseReturn<TConfig, 'async-template', OUTPUT, PROMPT, TConfigShape>;
}

export const ObjectStreamer = Object.assign(withText, { // default is withText
	withTemplate,
	withScript,
	withText,
	loadsTemplate,
	loadsScript,
	loadsText,
	withFunction
});
