import type { Agent, AgentCallParameters, AgentStreamParameters, LanguageModel, ModelMessage, OutputInterface, PrepareStepFunction, Tool, ToolSet } from 'ai';
import type { protectedSettings, incompatibleAgentSettings, fixedSettings } from '../runtime/agent-settings-policy.js';
import type { AIOutput, StreamRequest } from './sdk.js';
import type { CascadaConfig, ConfigValue, ContextFromConfig, RuntimeContextFromConfig, ToolProperties, ToolRegistryFromConfig, ToolsFromConfig } from './config.js';
import type { SchemaType } from './schema.js';
import type { PromptType, PromptValue } from './prompt.js';
import type { PromptSource } from './factory-config.js';
import type { ExecutionContext, ToolExecutionContext } from './execution.js';
import type { MergedProperties, ProcessedConfig } from './merge.js';
import type { SchemaInputObject } from './schema-shape.js';
import type { ComponentCall, ComponentRun, ContextArguments } from './input.js';
import type { ComponentInputShape, CanOmitComponentInput, PrivateInputNames, ValidateComponentInput } from './component-input.js';
import type { ComponentToolFromConfig, ToolContexts } from './tool-binding.js';
import type { CompletedOutput, GenerateTextResultAugmented, StreamTextResultAugmented } from './result.js';
import type { ConfigCallbackKeys } from './callbacks.js';
import type { EmptyMap, OptionalUndefined, UnionKeys } from './utils.js';

type DeprecatedSettings = typeof incompatibleAgentSettings[number];
type ProtectedSettings = typeof protectedSettings[number];
type AgentContext<T, AsTool extends boolean> = AsTool extends true ? ToolExecutionContext<T> : ExecutionContext<T>;
export type AgentOutput<T> = Extract<ConfigValue<T, 'output'>, OutputInterface | undefined>;
type SDKOutput<T> = import('./sdk.js').ResolvedOutput<AgentOutput<T>>;
type Step<T> = PrepareStepFunction<ToolsFromConfig<T>, RuntimeContextFromConfig<T>>;

export type PrepareStep<T, AsTool extends boolean = false> = (step: Parameters<Step<T>>[0],
	config: HookConfig<T>, context: AgentContext<T, AsTool>) => ReturnType<Step<T>>;

export type PrepareCallRequest<T, AsTool extends boolean = false> = Omit<StreamRequest<ToolsFromConfig<T>, RuntimeContextFromConfig<T>, SDKOutput<T>>,
	ProtectedSettings | DeprecatedSettings | 'prompt' | 'messages' | 'prepareStep' | 'toolsContext'> & {
	messages: ModelMessage[];
	prepareStep?: PrepareStep<T, AsTool> | undefined;
} & (EmptyMap extends ToolContexts<ToolRegistryFromConfig<T>>
	? { toolsContext?: ToolContexts<ToolRegistryFromConfig<T>> | undefined }
	: { toolsContext: ToolContexts<ToolRegistryFromConfig<T>> });

export type PrepareCall<T, AsTool extends boolean = false> = (request: PrepareCallRequest<T, AsTool>,
	config: HookConfig<T>, context: AgentContext<T, AsTool>) => PrepareCallRequest<T, AsTool> | PromiseLike<PrepareCallRequest<T, AsTool>>;

/** Native execution settings plus Casai's single source and input contract. */
type AgentSettings<TOOLS extends ToolSet = ToolSet, INPUT extends Record<string, any> = Record<string, any>,
	PROMPT = PromptValue, OUTPUT extends AIOutput = AIOutput, RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>> =
	Omit<StreamRequest<TOOLS, RUNTIME_CONTEXT, OUTPUT>, DeprecatedSettings | 'prompt' | 'messages' | 'abortSignal' | 'tools' | 'toolsContext' | 'prepareStep' | 'output'>
	& CascadaConfig & {
		id?: string | undefined;
		streaming?: true | undefined;
		output?: OUTPUT | undefined;
		prompt?: PROMPT | undefined;
		promptType?: PromptType | undefined;
		inputSchema?: SchemaType<INPUT> | undefined;
		tools?: { [K in keyof TOOLS]: TOOLS[K] | null | undefined } | undefined;
		toolsContext?: ToolContexts<TOOLS> | undefined;
	};

// Call input may replace public defaults; configured private bindings retain their types.
type HookContext<T> = MergedProperties<ContextFromConfig<T>, Partial<SchemaInputObject<ConfigValue<T, 'inputSchema'>>>>
	& Pick<ContextFromConfig<T>, Extract<PrivateInputNames<T>, keyof ContextFromConfig<T>>>;
type HookConfig<T> = Omit<AgentSettings<ToolsFromConfig<T>, any, import('./prompt.js').AnyPromptSource, SDKOutput<T>, RuntimeContextFromConfig<T>>, 'context' | 'inputSchema'>
	& { context?: HookContext<T>; inputSchema?: ConfigValue<T, 'inputSchema'> }
	& import('./config.js').ModifierConfig & { abortSignal?: AbortSignal | undefined; prepareCall?: PrepareCall<T> | undefined; prepareStep?: PrepareStep<T> | undefined };

/** Configuration annotation; factory inference additionally retains concrete schemas and defaults. */
export type LLMAgentConfig<TOOLS extends ToolSet = ToolSet, INPUT extends Record<string, any> = Record<string, any>,
	PROMPT = PromptValue, OUTPUT extends AIOutput = AIOutput, RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>> =
	Omit<AgentSettings<TOOLS, INPUT, PROMPT, OUTPUT, RUNTIME_CONTEXT>, ConfigCallbackKeys> & AgentCallbacks<
		Pick<AgentSettings<TOOLS, INPUT, PROMPT, OUTPUT, RUNTIME_CONTEXT>, 'tools' | 'inputSchema' | 'context' | 'output' | 'runtimeContext' | 'toolsContext'>>;

export type AgentCallbacks<T, AsTool extends boolean = false,
	SDK = StreamRequest<ToolsFromConfig<T>, RuntimeContextFromConfig<T>, SDKOutput<T>>> = {
	[K in Exclude<ConfigCallbackKeys & keyof SDK, DeprecatedSettings | 'prepareStep'>]?: SDK[K]
} & { prepareCall?: PrepareCall<T, AsTool> | undefined; prepareStep?: PrepareStep<T, AsTool> | undefined };

export type PromptCallback<T, AsTool extends boolean = false> = ConfigValue<T, 'inputSchema'> extends SchemaType<any>
	? { prompt?: ((context: AgentContext<T, AsTool>) => PromptValue | PromiseLike<PromptValue>) | undefined }
	: { prompt?: { prepare(context: AgentContext<T, AsTool>): PromptValue | PromiseLike<PromptValue> }['prepare'] | undefined };

type ConfiguredSource<P extends PromptType> = P extends 'function' ? (...args: never[]) => unknown : PromptSource<P>;

type AgentSource<T, P extends PromptType, A extends boolean> = P extends 'function'
	? (context: AgentContext<T, A>) => PromptValue | PromiseLike<PromptValue> : PromptSource<P>;

type History = [messageHistory?: ModelMessage[]];
type ContextHistory<T> = [...ContextArguments<T>, ...History];
type SourceContextHistory<T, P extends PromptType, A extends boolean> = [prompt: AgentSource<T, P, A>, ...ContextHistory<T>]
	| (CanOmitComponentInput<T> extends true ? [prompt: AgentSource<T, P, A>, messageHistory?: ModelMessage[]] : never);
type AgentArguments<T, P extends PromptType, A extends boolean> = SourceContextHistory<T, P, A>
	| ([T] extends [{ prompt: ConfiguredSource<P> }] ? ContextHistory<T> | [prompt: undefined, ...ContextHistory<T>] : never);

type AgentRunSource<T, P extends PromptType, A extends boolean> = { prompt?: AgentSource<T, P, A>; messageHistory?: ModelMessage[] }
	& ([T] extends [{ prompt: ConfiguredSource<P> }] ? EmptyMap : { prompt: AgentSource<T, P, A> } | { messageHistory: ModelMessage[] });
type CompatibleTool<T> = T extends Tool ? T | Tool<import('ai').InferToolInput<T>, import('ai').InferToolOutput<T>, import('@ai-sdk/provider-utils').InferToolContext<T>> : never;
type RunTools<T> = { [K in keyof ToolsFromConfig<T>]?: CompatibleTool<ToolsFromConfig<T>[K]> | null | undefined };
export type AgentRunSettings<T, P extends PromptType, AsTool extends boolean> = OptionalUndefined<Omit<Partial<LLMAgentConfig<ToolsFromConfig<T>, any, PromptSource<P>, SDKOutput<T>, RuntimeContextFromConfig<T>>>,
	typeof fixedSettings[number] | 'context' | 'prompt' | 'tools' | 'toolsContext' | ConfigCallbackKeys | 'prepareCall'>
	& AgentRunSource<T, P, AsTool> & AgentCallbacks<T, AsTool> & { tools?: RunTools<T> }>;

type NativeOptions<T> = CanOmitComponentInput<T> extends true
	? { options?: ComponentInputShape<T> | undefined } : { options: ComponentInputShape<T> };
type NativeArguments<Args, T> = Args extends unknown ? Omit<Args, 'options'> & NativeOptions<T> : never;
type NativeValidation<Args, T, Allowed, Unknown = Exclude<UnionKeys<Args>, keyof Allowed>> = NoInfer<
	([Unknown] extends [never] ? unknown : `Config Error: Unknown Agent call properties: '${Unknown & string}'.`)
	& ValidateComponentInput<T, Args extends { options?: infer Input } ? NonNullable<Input> : EmptyMap>>;
type Generated<T> = GenerateTextResultAugmented<ToolsFromConfig<T>, AgentOutput<T>, RuntimeContextFromConfig<T>>;
type Streamed<T> = StreamTextResultAugmented<ToolsFromConfig<T>, AgentOutput<T>, RuntimeContextFromConfig<T>>;
type AgentResult<T> = [T] extends [{ streaming: true }] ? Streamed<T> : true extends ConfigValue<T, 'streaming'> ? Generated<T> | Streamed<T> : Generated<T>;

type AgentMethods<T> = Omit<Agent<ComponentInputShape<T> | (CanOmitComponentInput<T> extends true ? undefined : never),
	ToolsFromConfig<T>, RuntimeContextFromConfig<T>, SDKOutput<T>>, 'generate' | 'stream'> & {
	generate<Args extends NativeArguments<AgentCallParameters<ComponentInputShape<T>, ToolsFromConfig<T>, RuntimeContextFromConfig<T>>, T>>(
		args: Args & NativeValidation<Args, T, AgentCallParameters<unknown>>): Promise<Generated<T>>;
	stream<Args extends NativeArguments<AgentStreamParameters<ComponentInputShape<T>, ToolsFromConfig<T>, RuntimeContextFromConfig<T>>, T>>(
		args: Args & NativeValidation<Args, T, AgentStreamParameters<unknown, ToolSet>>): Promise<Streamed<T>>;
}

export type LLMAgentComponent<T, P extends PromptType, AsTool extends boolean = false> =
	ComponentCall<AgentArguments<T, P, AsTool>, Promise<AgentResult<T>>, 'agent', T>
	& { readonly config: ProcessedConfig<T>; run: ComponentRun<T, AgentResult<T>, AgentRunSettings<T, P, AsTool>> }
	& (AsTool extends true ? ComponentToolFromConfig<Record<string, any>, CompletedOutput<AgentOutput<T>>, T> : AgentMethods<T>);

export type AgentFactoryShape<P extends PromptType, AsTool extends boolean> = LLMAgentConfig<ToolSet, Record<string, any>, PromptSource<P>> & import('./config.js').ModifierConfig
	& (P extends `${string}-name` ? { loader: import('../loaders.js').CasaiAILoaders } : EmptyMap)
	& (AsTool extends true ? { inputSchema: SchemaType<Record<string, any>> } & ToolProperties & import('./config.js').ToolContextSchemaConfig : EmptyMap);

export type AgentRequiredSettings<P extends PromptType, AsTool extends boolean> = { model: LanguageModel }
	& (P extends `${string}-name` ? { loader: import('../loaders.js').CasaiAILoaders } : EmptyMap)
	& (AsTool extends true ? { inputSchema: SchemaType<Record<string, any>>; prompt: ConfiguredSource<P> } : EmptyMap);
