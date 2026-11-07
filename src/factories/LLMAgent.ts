import type { AgentCallbacks, AgentFactoryShape, AgentOutput, AgentRequiredSettings, LLMAgentComponent, PromptCallback } from '../types/agent.js';
import type { AIOutput } from '../types/sdk.js';
import type { CallbackConfigShape, ConfigCallbackKeys, DescriptorInput, ParentToolSelectionInput, ToolSettingsInput, ToolSelectionKeys, ValidateDescriptor, ValidateToolCallbackNames, ValidateToolSelectionNames } from '../types/callbacks.js';
import type { ConfigSchemas, ConfigData, ConfigDataInferShape, ToolMode, ToolModeConfig, CallbackParent, CapturedConfig, FinalConfig, SourceMode } from '../types/factory-config.js';
import type { ComponentAdmission, ToolInputAdmission, ToolOutputAdmission, ValidateToolsContext } from '../types/config-validation.js';
import type { ConfigProvider, ConfigValue, ToolRegistry } from '../types/config.js';
import type { PromptType } from '../types/prompt.js';
import type { CompletedOutput } from '../types/result.js';
import type { CommonInputs } from '../types/input.js';
import type { EmptyMap, IsUnion, UnionKeys } from '../types/utils.js';
import type { Provisional, ResolvedConfig, ValidateResolved } from '../types/provisional.js';
import { createLLMAgent } from '../runtime/llm-agent.js';
import { validateAgentConfig } from '../config/validate.js';
import { createComponentFactory, textModifiers, textModes } from './component-factory.js';

export const definition = {
	name: 'LLMAgent', main: 'prompt', defaultMode: 'text', modifiers: textModifiers, toolModes: textModes,
	required: ['model'], toolRequired: ['prompt'], asStream: true,
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;
type Settings = import('../types/agent.js').AgentSettings;
type Config<P extends PromptType> = AgentFactoryShape<P, false>;
type ConfigShape<Tools extends import('ai').ToolSet, Input extends Record<string, any>, Output> =
	import('../types/agent.js').LLMAgentConfig<Tools, Input, import('../types/prompt.js').AnyPromptSource>
	& Partial<Omit<import('../types/config.js').ToolConfig<Input, Output>, 'inputSchema'>>;

type Mode = PromptType | undefined;
type Resolved<P extends Mode, S extends boolean, T> = T extends unknown
	? (Extract<keyof T, 'promptType' | (S extends true ? 'streaming' : never)> extends never ? T : Omit<T, 'promptType' | (S extends true ? 'streaming' : never)>) & (S extends true ? { promptType: SourceMode<T, P, typeof definition.defaultMode>; streaming: true } : { promptType: SourceMode<T, P, typeof definition.defaultMode> }) : never;
type Shape<P extends Mode, A extends boolean> = AgentFactoryShape<P extends PromptType ? P : PromptType, A>;
type InferShape<P extends Mode, A extends boolean> = CallbackConfigShape<Omit<Partial<Shape<P, A>>, 'prompt'>>
	& (P extends 'function' ? { prompt?: unknown } : Pick<Partial<Shape<P, A>>, 'prompt'>);
type CallbackSettings = 'context' | 'tools' | 'toolsContext' | 'runtimeContext' | 'output';
type CapturedSettings<P, Context, Runtime, Output> = Pick<{
	[K in keyof P]: K extends 'context' ? Context : K extends 'runtimeContext' ? Runtime : Output
}, keyof P & Exclude<CallbackSettings, 'tools' | 'toolsContext'>>;
type CallbackConfig<C, P, Schemas, Values> = CapturedConfig<P,
	Omit<ResolvedConfig<C>, 'prepareCall' | 'prepareStep' | 'prompt' | CallbackSettings> & Schemas & Values>;
type IncompatibleCallbacks<T, Expected> = {
	[K in keyof Expected & keyof T]-?: Pick<T, K> extends Pick<Expected, K> ? never : K
}[keyof Expected & keyof T];
type CallbackErrors<T, A extends boolean> = [keyof T & ConfigCallbackKeys] extends [never] ? never : IncompatibleCallbacks<T, AgentCallbacks<T, A>>;

type PromptError<T, P extends PromptType, A extends boolean> = [P] extends ['function']
	? Pick<T, 'prompt' & keyof T> extends { prompt?: ((...args: Parameters<NonNullable<PromptCallback<T, A>['prompt']>>) => ReturnType<NonNullable<PromptCallback<T, A>['prompt']>>) | undefined } ? never : 'prompt'
	: ConfigValue<T, 'prompt'> extends import('../types/factory-config.js').PromptSource<P> | undefined ? never : 'prompt';
type Missing<T, Required> = T extends unknown ? { [K in keyof Required]-?: K extends keyof T
	? [T[K]] extends [Required[K]] ? never : K : K }[keyof Required] : never;
type StreamingToolConfig<T> = T extends unknown
	? true extends ConfigValue<T, 'asTool'> & ConfigValue<T, 'streaming'> ? T : never : never;
type ValidateBranch<C, T, P extends PromptType, A extends boolean,
	Unknown = Exclude<UnionKeys<T>, keyof AgentFactoryShape<P, A>>,
	Required = Missing<T, AgentRequiredSettings<P, A>>,
	Callbacks = T extends unknown ? CallbackErrors<T, A> | PromptError<T, P, A> : never> = ValidateResolved<C,
	([Unknown] extends [never] ? unknown : `Config Error: Unknown LLMAgent properties: '${Unknown & string}'.`)
	& ([Required] extends [never] ? unknown : `Config Error: Missing required LLMAgent property '${Required & string}'.`)
	& ([T] extends [Omit<InferShape<P, A>, 'prompt'>] ? unknown : 'Config Error: Settings must match the final LLMAgent.')
	& ([Callbacks] extends [never] ? unknown : `Config Error: Hook or callback '${Callbacks & string}' is incompatible with the final configuration.`)
	& ([StreamingToolConfig<T>] extends [never] ? unknown : 'Config Error: LLMAgent tools are generation-only; streaming is not supported.')
	& ComponentAdmission<T>
	& ([Extract<UnionKeys<T>, 'experimental_refineToolInput' | 'toolApproval'>] extends [never] ? unknown : ValidateToolCallbackNames<T>)
	& ([UnionKeys<T> & ToolSelectionKeys] extends [never] ? unknown : ValidateToolSelectionNames<T>)
	& (true extends A ? ToolInputAdmission<T> & ToolOutputAdmission<EmptyMap, CompletedOutput<AgentOutput<T>>>
		& ValidateDescriptor<C, T, CompletedOutput<AgentOutput<T>>> : unknown)>;

type ConfigChecks<C, T, P extends PromptType, A extends boolean> = T extends unknown
	? (checks: CommonInputs<{ [M in Extract<ConfigValue<T, 'promptType'>, P>]: ValidateBranch<C, T, M, ToolMode<T, A>> }>) => void : never;
type Validate<C, T, P extends PromptType, A extends boolean> =
	(ConfigChecks<C, T, P, A> extends (checks: infer Checks) => void ? Checks : never)
	& ([Extract<UnionKeys<T>, 'tools' | 'toolsContext'>] extends [never] ? unknown : ValidateToolsContext<C, T>);

type AgentFactory<P extends Mode, A extends boolean = false, S extends boolean = false> = <
	C extends object & Provisional<InferShape<P, A>>,
	ParentConfig extends object = never,
	SchemaPresence extends object = object, Input = never, ToolContext = never,
	SettingPresence extends object = object,
	Context extends Record<string, any> | undefined = never,
	Tools extends ToolRegistry | undefined = never, ToolContexts extends object | undefined = never,
	Runtime extends Record<string, unknown> | undefined = never, Output extends AIOutput | undefined = never,
	Captured = CallbackConfig<C, ParentConfig, ConfigData<SchemaPresence, Input, never, ToolContext, Tools, ToolContexts>, CapturedSettings<SettingPresence, Context, Runtime, Output>>,
	Complete = Resolved<P, S, ToolModeConfig<FinalConfig<ParentConfig, C>, A>>,
	EffectiveTool extends boolean = ToolMode<Complete, A>,
>(config: C & ConfigDataInferShape<SchemaPresence, Input, never, ToolContext, Tools, ToolContexts>
	& Pick<{ [K in keyof SettingPresence]: unknown }, keyof SettingPresence & Exclude<CallbackSettings, 'tools' | 'toolsContext'>>
	& { context?: Context; runtimeContext?: Runtime }
	& { output?: Output | ConfigValue<C, 'output'> }
	& NoInfer<IsUnion<C> extends true ? unknown : [keyof C & ConfigCallbackKeys] extends [never] ? unknown : AgentCallbacks<Captured, EffectiveTool>>
	& NoInfer<ToolSettingsInput<CallbackParent<ParentConfig>, Tools, Runtime>>
	& (ConfigValue<Complete, 'promptType'> extends 'function' ? NoInfer<PromptCallback<Captured, EffectiveTool>> : unknown)
	& (true extends EffectiveTool ? DescriptorInput<ConfigSchemas<SchemaPresence, Input, never, ToolContext>, CallbackParent<ParentConfig>, CompletedOutput<AgentOutput<Captured>>> : unknown)
	& Validate<C, Complete, Extract<ConfigValue<Complete, 'promptType'>, PromptType>, A>,
	...parent: [ParentConfig] extends [never] ? [] : [parent: ConfigProvider<ParentConfig & ParentToolSelectionInput<ParentConfig, Tools>>]
) => NoInfer<LLMAgentComponent<Complete, Extract<ConfigValue<Complete, 'promptType'>, PromptType>, EffectiveTool>>;

type FactoryModes<P extends Mode> = AgentFactory<P> & {
	asTool: AgentFactory<P, true>;
	asStream: AgentFactory<P, false, true>;
};

type Factory = FactoryModes<undefined> & {
	[M in keyof typeof definition.modifiers]: FactoryModes<typeof definition.modifiers[M]>;
};

export const LLMAgent = createComponentFactory(definition, createLLMAgent, validateAgentConfig) as Factory;

export interface Types<P extends PromptType, T, A extends boolean, Input, Tools extends import('ai').ToolSet, Output> {
	definition: typeof definition;
	settings: Settings;
	templateInput: import('../types/prompt.js').PromptValue;
	component: LLMAgentComponent<T, P, A>;
	config: Config<P>;
	configShape: ConfigShape<Tools, Extract<Input, Record<string, any>>, Output>;
	result: import('../types/agent.js').AgentResult<T>;
	toolResult: CompletedOutput<AgentOutput<T>>;
}
