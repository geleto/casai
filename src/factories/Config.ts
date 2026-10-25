import { mergeConfigs, processConfig } from '../config-utils.js';
import type * as configs from '../types/config.js';
import type { ValidateConfigFragment } from '../types/config-validation.js';
import type { FlexibleSchema, ToolSet } from 'ai';
import type { EmptyMap, ProcessedConfig } from '../types/merge.js';
import type { Provisional, ResolvedConfig } from '../types/provisional.js';
import type { CallbackConfigShape, FragmentCallbackInput } from '../types/callbacks.js';
import type { ChildDefinition, DeclaredConfig, FragmentExecuteContext, InputSchemaSetting } from '../types/function-config.js';
import type * as types from '../types/types.js';
import { validateAnyConfig, validateConfigBasics } from '../validate.js';

type FragmentDefinition<P, I, O, C, T, H, M, A> = configs.MergedConfig<
	ChildDefinition<P, I, O, C, T, A>, { tools: H; toolsContext: M }>;

// Specialize schema presence before inferring schema-dependent callbacks.
type ConfigSignature<RequiredInput extends boolean> = <
	TConfig extends Provisional<CallbackConfigShape<configs.ToolConfigShape<configs.ConfigFragmentShape<TOOLS, INPUT, OUTPUT, ENUM>>>>,
	TOOLS extends ToolSet, //@todo - handle TOOLS similarly elsewhere
	INPUT extends Record<string, any>,
	OUTPUT, //@out
	ENUM extends string = string,
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = never,
	TOutputSchema extends types.SchemaType<any> | undefined = never,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TContextSchema extends FlexibleSchema | undefined = never,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TToolsContext extends object = EmptyMap,
>(
	config:
		InputSchemaSetting<TInputSchema, RequiredInput> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined }, toolsContext?: TToolsContext, schema?: TOutputSchema, context?: CONTEXT, toolContextSchema?: TContextSchema } &
		TConfig &
		FragmentCallbackInput<TConfig, EmptyMap, TCallbackTools, TOutputSchema, TCallbackRuntime, TCallbackOutput, TCallbackEnum> &
		NoInfer<FragmentExecuteContext<FragmentDefinition<EmptyMap, TInputSchema, TOutputSchema, CONTEXT, TContextSchema, TCallbackTools, TToolsContext, TConfig>, TConfig>> &
		ValidateConfigFragment<TConfig, TConfig, Partial<configs.AnyConfigShape<TOOLS, INPUT, OUTPUT, ENUM>>>,
) => configs.ConfigProvider<ProcessedConfig<ResolvedConfig<TConfig>>>;

type ParentConfigSignature<RequiredInput extends boolean> = <
	TConfig extends Provisional<CallbackConfigShape<configs.ToolConfigShape<configs.ConfigFragmentShape<TOOLS, INPUT, OUTPUT, ENUM>>>>,
	// Infer the parent before checking its shape; distributing an unresolved family union exceeds compiler depth.
	TParentConfig extends object,
	TOOLS extends ToolSet, INPUT extends Record<string, any>, OUTPUT, ENUM extends string = string,
	TInputSchema extends types.SchemaType<Record<string, any>> | undefined = never,
	TOutputSchema extends types.SchemaType<any> | undefined = never,
	CONTEXT extends Record<string, any> | undefined = undefined,
	TContextSchema extends FlexibleSchema | undefined = never,
	TCallbackTools extends configs.ToolRegistry | undefined = never,
	TCallbackRuntime extends Record<string, unknown> | undefined = never,
	TCallbackOutput extends types.AIOutput | 'object' | 'array' | 'enum' | 'no-schema' | undefined = never,
	TCallbackEnum extends readonly string[] | undefined = never,
	TToolsContext extends object = EmptyMap,
>(
	config:
		InputSchemaSetting<TInputSchema, RequiredInput> & { tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined }, toolsContext?: TToolsContext, schema?: TOutputSchema, context?: CONTEXT, toolContextSchema?: TContextSchema } &
		TConfig &
		FragmentCallbackInput<TConfig, DeclaredConfig<TParentConfig>, TCallbackTools, TOutputSchema, TCallbackRuntime, TCallbackOutput, TCallbackEnum> &
		NoInfer<FragmentExecuteContext<FragmentDefinition<DeclaredConfig<TParentConfig>, TInputSchema, TOutputSchema, CONTEXT, TContextSchema, TCallbackTools, TToolsContext, TConfig>, TConfig>> &
		ValidateConfigFragment<TConfig, configs.MergedConfig<DeclaredConfig<TParentConfig>, TConfig>, Partial<configs.AnyConfigShape<ToolSet, INPUT, OUTPUT, ENUM>>>,
	parent: configs.ConfigProvider<TParentConfig> & NoInfer<
		[TParentConfig] extends [CallbackConfigShape<configs.ToolConfigShape<Partial<configs.AnyConfigShape<ToolSet, INPUT, OUTPUT, ENUM>>>>]
		? unknown : 'Parent Config Error: Parent properties must match a supported component configuration.'>
) => configs.ConfigProvider<configs.MergedConfig<TParentConfig, ResolvedConfig<TConfig>>>;

type ConfigFactory = ConfigSignature<true> & ParentConfigSignature<true>
	& ConfigSignature<false> & ParentConfigSignature<false>;

// Implementation
export const Config = (function Config(
	config: Partial<configs.AnyConfigShape<ToolSet, Record<string, any>, any, string>>,
	parent?: configs.ConfigProvider<any>
): configs.ConfigProvider<any> {
	// Validate raw values before loader processing and merging can consume them.
	validateConfigBasics(config);
	// Debug output if config.debug is true
	if ('debug' in config && config.debug) {
		console.log('[DEBUG] Config function created with config:', config);
	}

	const merged = parent ? mergeConfigs(parent.config, config) : processConfig(config);
	validateAnyConfig(merged as Partial<configs.AnyConfig<any, any, any, any>>);
	return { config: merged };
}) as ConfigFactory;
