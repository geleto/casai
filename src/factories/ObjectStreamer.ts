import type { SchemaConfigInferShape, ConfigSchemas } from '../types/function-config.js';
import type { StreamObjectRequest } from '../types/sdk.js';
import type { FunctionPromptInput, FunctionPromptShape } from '../types/function-prompt.js';
import { streamObject } from "ai";
import { augmentObjectResult } from '../augment-result.js';
import type { LanguageModel, ModelMessage } from "ai";

import * as results from '../types/result.js'
import * as configs from '../types/config.js';
import * as utils from '../types/utils.js';
import * as types from '../types/types.js';

import type { ValidateObjectStreamerConfig, ValidateObjectStreamerParentConfig } from '../types/config-validation.js';
import type { ResolvedConfig } from '../types/provisional.js';
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
type InheritedShapeOf<TFinalConfig, TShape> = Omit<TShape, 'schemaName' | 'schemaDescription'>
	& Pick<ShapeOf<TFinalConfig>, Extract<keyof ShapeOf<TFinalConfig>, 'schemaName' | 'schemaDescription'>>;

// Parameterize return types by concrete promptType literal used by implementation
// Plain text prompts return the stream object without the promise as they don't render the prompt
type StreamObjectReturn<
	TConfig,
	TPromptType extends types.RequiredPromptType,
	OUTPUT, //@out
	PROMPT extends types.AnyPromptSource,
	TConfigShape,
	IsAsync extends boolean = false,
	WholeConfig = TConfig
> =
	TConfig extends { output: 'array', schema: types.SchemaType<OUTPUT> }
	? LLMCallSignature<WholeConfig, utils.ConditionalPromise<results.StreamObjectArrayResult<utils.InferParameters<TConfig['schema']>>, IsAsync>, TPromptType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, true>>
	: TConfig extends { output: 'array' }
	? `Config Error: Array output requires a schema`
	: TConfig extends { output: 'no-schema' }
	? LLMCallSignature<WholeConfig, utils.ConditionalPromise<results.StreamObjectNoSchemaResult, IsAsync>, TPromptType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, true>>
	: TConfig extends { output?: 'object' | undefined, schema: types.SchemaType<OUTPUT> }
	? LLMCallSignature<WholeConfig, utils.ConditionalPromise<results.StreamObjectObjectResult<utils.InferParameters<TConfig['schema']>>, IsAsync>, TPromptType, PROMPT, ObjectRunConfig<TConfigShape, TConfig, true>>
	: `Config Error: Object output requires a schema`;

type StreamObjectPromiseReturn<
	TConfig,
	TPromptType extends types.RequiredPromptType,
	OUTPUT, //@out
	PROMPT extends types.AnyPromptSource,
	TConfigShape,
> =
	StreamObjectReturn<TConfig, TPromptType, OUTPUT, PROMPT, TConfigShape, true>;

// With parent
// Plain text prompts return the stream object without the promise as they don't render the prompt
type StreamObjectWithParentReturn<
	TConfig,
	TParentConfig, // & configs.OptionalPromptConfig,
	TPromptType extends types.RequiredPromptType,
	OUTPUT, //@out
	PARENT_OUTPUT, //@out
	PROMPT extends types.AnyPromptSource,
	TConfigShape,
	TFinalConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
> =
	StreamObjectReturn<
		TFinalConfig, // & configs.OptionalPromptConfig,
		TPromptType,
		OUTPUT extends never ? PARENT_OUTPUT : OUTPUT, //@out
		PROMPT,
		InheritedShapeOf<TFinalConfig, TConfigShape>
	>

type StreamObjectWithParentPromiseReturn<
	TConfig,
	TParentConfig, // & configs.OptionalPromptConfig,
	TPromptType extends types.RequiredPromptType,
	OUTPUT, //@out
	PARENT_OUTPUT, //@out
	PROMPT extends types.AnyPromptSource,
	TConfigShape,
	TFinalConfig = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>
> =
	StreamObjectPromiseReturn<
		TFinalConfig, // & configs.OptionalPromptConfig,
		TPromptType,
		OUTPUT extends never ? PARENT_OUTPUT : OUTPUT, //@out
		PROMPT,
		InheritedShapeOf<TFinalConfig, TConfigShape>
	>

// A text-only prompt has no inputs
function withText<
	TConfig extends configs.ObjectConfigInferShape<configs.StreamObjectConfig<never, OUTPUT, PROMPT>>,
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
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.StreamObjectConfig<never, OUTPUT, PROMPT>>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.StreamObjectConfig<never, PARENT_OUTPUT, PROMPT>>,
	OUTPUT,
	PARENT_OUTPUT,
	PROMPT extends string | ModelMessage[] = string | ModelMessage[],
	TConfigShape = ShapeOf<TConfig>,

	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
>(
	config: TConfig & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TFinalConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectStreamerParentConfig<TParentConfig, TFinalConfig>>,
): StreamObjectWithParentReturn<TConfig, TParentConfig, 'text',
	OUTPUT, PARENT_OUTPUT, PROMPT, TConfigShape>

// Implementation signature that handles both cases
function withText(config: configs.StreamObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'text', parent);
}

function loadsText<
	TConfig extends configs.ObjectConfigInferShape<configs.StreamObjectConfig<never, OUTPUT, PROMPT> & configs.LoaderConfig>,
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
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.StreamObjectConfig<never, OUTPUT, PROMPT> & configs.LoaderConfig>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.StreamObjectConfig<never, PARENT_OUTPUT, PROMPT> & configs.LoaderConfig>,
	OUTPUT,
	PARENT_OUTPUT,
	PROMPT extends string = string,
	TConfigShape = ShapeOf<TConfig> & configs.LoaderConfig & configs.NamedPromptConfig,

	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>, //@todo we need just the correct output type
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
function loadsText(config: configs.StreamObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'text-name', parent);
}

function withTemplate<
	TConfig extends configs.ObjectConfigInferShape<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.TemplatePromptConfig>,
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
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT>> & configs.TemplatePromptConfig>,
	TParentConfig extends ObjectCallbackShape<Partial<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT>> & configs.TemplatePromptConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,

	TConfigShape = ShapeOf<TConfig> & configs.TemplatePromptConfig,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>, //@todo we need just the correct output type
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
function withTemplate(config: configs.StreamObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'async-template', parent);
}

function loadsTemplate<
	TConfig extends configs.ObjectConfigInferShape<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>,
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
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.TemplatePromptConfig & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,

	TConfigShape = ShapeOf<TConfig> & configs.TemplatePromptConfig & configs.LoaderConfig,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>, //@todo we need just the correct output type
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
function loadsTemplate(config: configs.StreamObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'async-template-name', parent);
}

function withScript<
	TConfig extends configs.ObjectConfigInferShape<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.ScriptPromptConfig>,
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
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.ScriptPromptConfig>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.ScriptPromptConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TConfigShape = ShapeOf<TConfig> & configs.ScriptPromptConfig,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>, //@todo we need just the correct output type
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
function withScript(config: configs.StreamObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'async-script', parent);
}

function loadsScript<
	TConfig extends configs.ObjectConfigInferShape<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>,
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
	TConfig extends configs.ObjectConfigInferShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>>,
	TParentConfig extends configs.ParentObjectConfigInferShape<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT> & configs.ScriptPromptConfig & configs.LoaderConfig>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,

	TConfigShape = ShapeOf<TConfig> & configs.ScriptPromptConfig & configs.LoaderConfig,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
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
function loadsScript(config: configs.StreamObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'async-script-name', parent);
}

type FunctionPromptSignature<RequiredContext extends boolean> = <
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.ObjectConfigInferShape<configs.StreamObjectConfig<INPUT, OUTPUT, PROMPT> & configs.FunctionPromptConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig & FunctionPromptInput<TConfig, EmptyMap, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, false, RequiredContext> & ObjectCallbackInput<TConfig, EmptyMap, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TConfig,
		configs.FunctionPromptConfig>,
) => StreamObjectPromiseReturn<TConfig, 'function', OUTPUT, PROMPT, TConfigShape>;

type ParentFunctionPromptSignature<RequiredContext extends boolean> = <
	TSchemaPresence extends object,
	TConfig extends FunctionPromptShape<configs.ObjectConfigInferShape<Partial<configs.StreamObjectConfig<INPUT, OUTPUT, PROMPT> & configs.FunctionPromptConfig>>>,
	TParentConfig extends FunctionPromptShape<configs.ParentObjectConfigInferShape<configs.StreamObjectConfig<PARENT_INPUT, PARENT_OUTPUT, PROMPT> & configs.FunctionPromptConfig>>,
	INPUT extends Record<string, any>,
	OUTPUT,
	PARENT_INPUT extends Record<string, any>,
	PARENT_OUTPUT,
	TFinalConfig extends configs.FinalStreamObjectConfigShape = configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>,
	PROMPT extends types.PromptFunction = types.PromptFunction,
	TConfigShape = ShapeOf<TConfig> & configs.FunctionPromptConfig,
	TCallbackSchema extends types.SchemaType<any> | undefined = never,
	TCallbackMode extends 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TPromptContext extends Record<string, any> | undefined = never,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig & FunctionPromptInput<TConfig, TParentConfig, ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, TPromptContext, false, RequiredContext> & ObjectCallbackInput<TConfig, TParentConfig, TCallbackSchema, TCallbackMode, TCallbackEnum, true> & ValidateObjectStreamerConfig<TConfig, TFinalConfig,
		configs.FunctionPromptConfig>,
	parent: configs.ConfigProvider<TParentConfig & ValidateObjectStreamerParentConfig<TParentConfig, TFinalConfig,
		configs.FunctionPromptConfig>>,

) => StreamObjectWithParentPromiseReturn<TConfig, TParentConfig, 'function', OUTPUT, PARENT_OUTPUT, PROMPT, TConfigShape>;

type FunctionPromptFactory = FunctionPromptSignature<true> & FunctionPromptSignature<false> & ParentFunctionPromptSignature<true> & ParentFunctionPromptSignature<false>;

// Implementation signature that handles both cases
function withFunction(config: configs.StreamObjectBaseConfig<any, types.AnyPromptSource, any>, parent?: configs.ConfigProvider<configs.BaseConfig>): unknown {
	return _createObjectStreamer(config, 'function', parent);
}

//common function for the specialized from/loads Template/Script/Text
function _createObjectStreamer(
	config: configs.StreamObjectBaseConfig<any, types.AnyPromptSource, any>,
	promptType: types.PromptType,
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
		merged as configs.OptionalPromptConfig & { model: LanguageModel, prompt: string, schema: types.SchemaType<any> },
		request => augmentObjectResult(streamObject(request as StreamObjectRequest)),
		{ type: 'StreamObject', streaming: true },
	);
}

export const ObjectStreamer = Object.assign(withText, { // default is withText
	withTemplate,
	withScript,
	withText,
	loadsTemplate,
	loadsScript,
	loadsText,
	withFunction: withFunction as FunctionPromptFactory
});
