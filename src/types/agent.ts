import type { sourceMode, AnnotatedSourceMode } from '../config/source-mode.js';
import type { Agent, AgentCallParameters, AgentStreamParameters, LanguageModel, ModelMessage, OutputInterface, PrepareStepFunction, Tool, ToolSet } from 'ai';
import type { protectedSettings, incompatibleAgentSettings, fixedSettings } from '../runtime/agent-settings-policy.js';
import type { AIOutput, StreamRequest } from './sdk.js';
import type { CascadaConfig, ConfigValue, ContextFromConfig, RuntimeContextFromConfig, ToolProperties, ToolRegistryFromConfig, ToolsFromConfig } from './config.js';
import type { SchemaType } from './schema.js';
import type { PromptType, PromptValue } from './prompt.js';
import type { ConfigForMode, ConfigForToolMode, PromptSource } from './factory-config.js';
import type { ExecutionContext, ToolExecutionContext } from './execution.js';
import type { MergedProperties, ProcessedConfig } from './merge.js';
import type { SchemaInputObject } from './schema-shape.js';
import type { CommonInputs, ComponentCall, ComponentCallSignature, ComponentRun, ComponentRunSettings, ContextArguments, RunArgument } from './input.js';
import type { ComponentInputShape, CanOmitComponentInput, PrivateInputNames, ValidateComponentInput } from './component-input.js';
import type { ComponentToolFromConfig, ToolContexts } from './tool-binding.js';
import type { CompletedOutput, GenerateTextResultAugmented, StreamTextResultAugmented } from './result.js';
import type { ConfigCallbackKeys } from './callbacks.js';
import type { EmptyMap, OptionalUndefined, UnionKeys } from './utils.js';

type DeprecatedSettings = typeof incompatibleAgentSettings[number];
type ProtectedSettings = typeof protectedSettings[number];
type AgentContext<T, AsTool extends boolean> = AsTool extends true ? ToolExecutionContext<T> : ExecutionContext<T>;
export type AgentOutput<T> = Extract<ConfigValue<T, 'output'>, OutputInterface | undefined>;
// Configuration describes the selected specification; result types also include an absent-output text fallback.
type SDKOutput<T> = import('./sdk.js').ResolvedOutput<Exclude<AgentOutput<T>, undefined>>;
type Step<T> = PrepareStepFunction<ToolsFromConfig<T>, RuntimeContextFromConfig<T>>;
// Native model IDs already admit every string. Collapse completion literals only
// at generic call intersections, where TypeScript otherwise expands them quadratically.
type ModelOverride = string | Exclude<LanguageModel, string>;
type StepResult<T> = Omit<NonNullable<Awaited<ReturnType<Step<T>>>>, 'model'> & { model?: ModelOverride };

export type PrepareStep<T, AsTool extends boolean = false> = (step: Parameters<Step<T>>[0],
	config: HookConfig<T>, context: AgentContext<T, AsTool>) => StepResult<T> | undefined | PromiseLike<StepResult<T> | undefined>;

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
export type AgentSettings<TOOLS extends ToolSet = ToolSet, INPUT extends Record<string, any> = Record<string, any>,
	PROMPT = PromptValue, OUTPUT extends AIOutput = AIOutput, RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>> =
	Omit<StreamRequest<TOOLS, RUNTIME_CONTEXT, OUTPUT>, DeprecatedSettings | 'prompt' | 'messages' | 'abortSignal' | 'tools' | 'toolsContext' | 'prepareStep' | 'output'>
	& CascadaConfig & {
		id?: string | undefined;
		streaming?: true | undefined;
		output?: OUTPUT | undefined;
		prompt?: PROMPT | undefined;
		[sourceMode]?: PromptType | undefined;
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

export type WithAgentCallbacks<T> = Omit<T, ConfigCallbackKeys> & AgentCallbacks<Pick<T, Extract<keyof T, 'tools' | 'inputSchema' | 'context' | 'output' | 'runtimeContext' | 'toolsContext'>>>;
/** Annotate authored settings; select their interpretation with a factory or Config source modifier. */
export type LLMAgentConfig<TOOLS extends ToolSet = ToolSet, INPUT extends Record<string, any> = Record<string, any>,
	PROMPT = PromptValue, OUTPUT extends AIOutput = AIOutput, RUNTIME_CONTEXT extends Record<string, unknown> = Record<string, unknown>> =
	WithAgentCallbacks<Omit<AgentSettings<TOOLS, INPUT, PROMPT, OUTPUT, RUNTIME_CONTEXT>, typeof sourceMode>>
	& AnnotatedSourceMode<PromptType, 'text'>;

export type AgentCallbacks<T, AsTool extends boolean = false,
	SDK = StreamRequest<ToolsFromConfig<T>, RuntimeContextFromConfig<T>, SDKOutput<T>>> = {
	[K in Exclude<ConfigCallbackKeys & keyof SDK, DeprecatedSettings | 'prepareStep'>]?: SDK[K]
} & { prepareCall?: PrepareCall<T, AsTool> | undefined; prepareStep?: PrepareStep<T, AsTool> | undefined };

export type PromptCallback<T, AsTool extends boolean = false> = ConfigValue<T, 'inputSchema'> extends SchemaType<any>
	? { prompt?: ((context: AgentContext<T, AsTool>) => PromptValue | PromiseLike<PromptValue>) | undefined }
	: { prompt?: { prepare(context: AgentContext<T, AsTool>): PromptValue | PromiseLike<PromptValue> }['prepare'] | undefined };

type ConfiguredSource<P extends PromptType> = P extends 'function' ? (...args: never[]) => unknown : PromptSource<P>;

type AgentSource<T, P extends PromptType> = P extends 'function'
	? (context: ExecutionContext<T>) => PromptValue | PromiseLike<PromptValue> : PromptSource<P>;

type History = [messageHistory?: readonly ModelMessage[] | undefined];
type ContextHistory<T, H extends History = History> = [...ContextArguments<T>, ...H] | (CanOmitComponentInput<T> extends true ? H : never);
type SourceContextHistory<T, P extends PromptType, Source = Exclude<AgentSource<T, P>, ModelMessage | readonly ModelMessage[]>
	| ([T] extends [{ prompt: ConfiguredSource<P> }] ? undefined : never)> = [prompt: Source, ...ContextHistory<T>];
type ModeArguments<T, P extends PromptType> = SourceContextHistory<T, P>
	| ([T] extends [{ prompt: ConfiguredSource<P> }] ? ContextHistory<T> : ContextHistory<T, [messageHistory: readonly ModelMessage[]]>);
type ArgumentCases<T, P extends PromptType> = { [M in P]: ModeArguments<ConfigForMode<T, M, P>, M> };
type AgentArguments<T, P extends PromptType> = Extract<CommonInputs<ArgumentCases<T, P>>, unknown[]>;

type AgentRunSource<T, P extends PromptType> = { prompt?: AgentSource<T, P>; messageHistory?: readonly ModelMessage[] }
	& ([T] extends [{ prompt: ConfiguredSource<P> }] ? EmptyMap : { prompt: AgentSource<T, P> } | { messageHistory: readonly ModelMessage[] });
type CompatibleTool<T> = T | (T extends Tool ? Tool<import('ai').InferToolInput<T>, import('ai').InferToolOutput<T>, import('@ai-sdk/provider-utils').InferToolContext<T>> : never);
type RunTools<T> = { [K in keyof ToolsFromConfig<T>]?: CompatibleTool<ToolsFromConfig<T>[K]> | null | undefined };
type ModeRunSettings<T, P extends PromptType> = OptionalUndefined<Omit<Partial<WithAgentCallbacks<AgentSettings<ToolsFromConfig<T>, any, PromptSource<P>, SDKOutput<T>, RuntimeContextFromConfig<T>>>>,
	typeof fixedSettings[number] | 'context' | 'prompt' | 'tools' | 'toolsContext' | 'model' | ConfigCallbackKeys | 'prepareCall'>
	& AgentRunSource<T, P> & AgentCallbacks<T> & { tools?: RunTools<T>; model?: ModelOverride }>;
export type AgentRunSettings<T, P extends PromptType> = CommonInputs<{ [M in P]: ModeRunSettings<ConfigForMode<T, M, P>, M> }>;

type NativeOptions<T> = CanOmitComponentInput<T> extends true
	? { options?: ComponentInputShape<T> | undefined } : { options: ComponentInputShape<T> };
type NativeArguments<Args, T> = Args extends unknown ? Omit<Args, 'options'> & NativeOptions<T> : never;
type NativeValidation<Args, T, Allowed, Unknown = Exclude<UnionKeys<Args>, keyof Allowed>> = NoInfer<
	([Unknown] extends [never] ? unknown : `Config Error: Unknown Agent call properties: '${Unknown & string}'.`)
	& ValidateComponentInput<T, Args extends { options?: infer Input } ? NonNullable<Input> : EmptyMap>>;
type Generated<T> = GenerateTextResultAugmented<ToolsFromConfig<T>, AgentOutput<T>, RuntimeContextFromConfig<T>>;
type Streamed<T> = StreamTextResultAugmented<ToolsFromConfig<T>, AgentOutput<T>, RuntimeContextFromConfig<T>>;
export type AgentResult<T> = [T] extends [{ streaming: true }] ? Streamed<T> : true extends ConfigValue<T, 'streaming'> ? Generated<T> | Streamed<T> : Generated<T>;

type ResumeSettings<T> = ComponentRunSettings<T, Omit<AgentRunSettings<T, 'text'>, 'prompt' | 'messageHistory'>
	& { approve?: boolean | readonly string[] | null | undefined }>;
type Resume<T> = (EmptyMap extends ResumeSettings<T> ? (history: readonly ModelMessage[]) => Promise<AgentResult<T>> : unknown)
	& (<Run extends object | undefined, Keys extends PropertyKey = never, ContextKeys extends PropertyKey = never>(
		history: readonly ModelMessage[], options: RunArgument<T, ResumeSettings<T>, Run, Keys, ContextKeys>) => Promise<AgentResult<T>>);

type AgentMethods<T> = Omit<Agent<ComponentInputShape<T> | (CanOmitComponentInput<T> extends true ? undefined : never),
	ToolsFromConfig<T>, RuntimeContextFromConfig<T>, import('./sdk.js').ResolvedOutput<AgentOutput<T>>>, 'generate' | 'stream'> & {
	resume: Resume<T>;
	generate<Args extends NativeArguments<AgentCallParameters<ComponentInputShape<T>, ToolsFromConfig<T>, RuntimeContextFromConfig<T>>, T>>(
		args: Args & NativeValidation<Args, T, AgentCallParameters<unknown>>): Promise<Generated<T>>;
	stream<Args extends NativeArguments<AgentStreamParameters<ComponentInputShape<T>, ToolsFromConfig<T>, RuntimeContextFromConfig<T>>, T>>(
		args: Args & NativeValidation<Args, T, AgentStreamParameters<unknown, ToolSet>>): Promise<Streamed<T>>;
}

export type LLMAgentComponent<T, P extends PromptType, AsTool extends boolean = false,
	ToolConfig = ConfigForToolMode<T, true, AsTool>, AgentConfig = ConfigForToolMode<T, false, AsTool>> =
	// Function source overrides need individual overloads for contextual callback inference.
	('function' extends P ? ComponentCall<AgentArguments<T, P>, Promise<AgentResult<T>>, 'agent', T, ArgumentCases<T, P>> : unknown)
	& ComponentCallSignature<AgentArguments<T, P>, Promise<AgentResult<T>>, 'agent', T, ArgumentCases<T, P>>
	& { readonly config: ProcessedConfig<T>; readonly run: ComponentRun<T, AgentResult<T>, AgentRunSettings<T, P>> }
	& (AsTool extends true ? ComponentToolFromConfig<Record<string, any>, CompletedOutput<AgentOutput<ToolConfig>>, ToolConfig> : AgentMethods<AgentConfig>);

export type AgentFactoryShape<P extends PromptType, AsTool extends boolean> = WithAgentCallbacks<AgentSettings<ToolSet, Record<string, any>, PromptSource<P>>> & import('./config.js').ModifierConfig
	& (P extends `${string}-name` ? { loader: import('../loaders.js').LoaderInput } : EmptyMap)
	& (AsTool extends true ? { inputSchema: SchemaType<Record<string, any>> } & ToolProperties & import('./config.js').ToolContextSchemaConfig : EmptyMap);

export type AgentRequiredSettings<P extends PromptType, AsTool extends boolean> = P extends unknown ? Required<Pick<
	AgentFactoryShape<P, AsTool>, Extract<import('./component.js').RequiredComponentKeys<'LLMAgent', P, AsTool>, keyof AgentFactoryShape<P, AsTool>>>> : never;
