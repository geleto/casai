import type { toolMode, streamMode, sourceMode, SourceModeSetting, ResolvedSourceMode, WithoutSourceMode } from '../config/modifiers.js';
import type { AgentCallbacks, AgentFactoryShape, AgentHooks, AgentOutput, AgentRequiredSettings, LLMAgentComponent, PromptCallback } from '../types/agent.js';
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
// An annotation receives an execution context; the factory shape keeps its inference sentinel.
type Config<P extends PromptType> = Omit<AgentFactoryShape<P, false>, 'prompt' | typeof toolMode | typeof sourceMode> & SourceModeSetting<P> & {
	prompt?: import('../types/component.js').Source<'LLMAgent', P, unknown, false, import('../types/prompt.js').PromptValue> | undefined;
};
type ConfigShape<Tools extends import('ai').ToolSet, Input extends Record<string, any>, Output> =
	import('../types/agent.js').WithAgentCallbacks<import('../types/agent.js').AgentSettings<Tools, Input, import('../types/prompt.js').AnyPromptSource>>
	& Partial<Omit<import('../types/config.js').ToolConfig<Input, Output>, 'inputSchema'>>;

type Mode = PromptType | undefined;
type Resolved<P extends Mode, S extends boolean, T> = T extends unknown
	? import('../types/factory-config.js').StreamModeConfig<WithoutSourceMode<T> & ResolvedSourceMode<SourceMode<T, P, typeof definition.defaultMode>>, S> : never;
type Shape<P extends Mode, A extends boolean> = AgentFactoryShape<P extends PromptType ? P : PromptType, A>;
type InferSettings<P extends Mode, A extends boolean> = CallbackConfigShape<Omit<Partial<Shape<P, A>>, 'prompt'>>;
type InferShape<P extends Mode, A extends boolean> = InferSettings<P, A>
	& (P extends 'function' ? { prompt?: unknown } : Pick<Partial<Shape<P, A>>, 'prompt'>);
type CallbackSettings = 'context' | 'tools' | 'toolsContext' | 'runtimeContext' | 'output';
type CapturedSettings<P, Context, Runtime, Output> = Pick<{
	[K in keyof P]: K extends 'context' ? Context : K extends 'runtimeContext' ? Runtime : Output
}, keyof P & Exclude<CallbackSettings, 'tools' | 'toolsContext'>>;
type CallbackConfig<C, P, Schemas, Values> = CapturedConfig<P,
	Omit<ResolvedConfig<C>, 'prepareCall' | 'prepareStep' | 'prompt' | CallbackSettings> & Schemas & Values>;
// Callback settings are optional; supplied values must match their resolved signatures.
type IncompatibleCallbacks<T, Expected> = {
	[K in keyof Expected & keyof T]-?: T[K] extends Expected[K] ? never : K
}[keyof Expected & keyof T];
type CallbackErrors<T, A extends boolean, Keys = keyof T & ConfigCallbackKeys> = [Keys] extends [never] ? never
	: IncompatibleCallbacks<T, [Keys] extends [keyof AgentHooks<T, A>] ? AgentHooks<T, A> : AgentCallbacks<T, A>>;

type PromptError<T, P extends PromptType, A extends boolean> = [P] extends ['function']
	? Pick<T, 'prompt' & keyof T> extends { prompt?: ((...args: Parameters<NonNullable<PromptCallback<T, A>['prompt']>>) => ReturnType<NonNullable<PromptCallback<T, A>['prompt']>>) | undefined } ? never : 'prompt'
	: ConfigValue<T, 'prompt'> extends import('../types/factory-config.js').PromptSource<P> | undefined ? never : 'prompt';
type Missing<T, Required> = T extends unknown ? { [K in keyof Required]-?: K extends keyof T
	? [T[K]] extends [Required[K]] ? never : K : K }[keyof Required] : never;
type StreamingToolConfig<T> = T extends unknown
	? true extends ConfigValue<T, typeof toolMode> & ConfigValue<T, typeof streamMode> ? T : never : never;
type ValidateBranch<C, T, P extends PromptType, A extends boolean,
	Unknown = Exclude<UnionKeys<T>, keyof AgentFactoryShape<P, A>>,
	Required = Missing<T, AgentRequiredSettings<P, A>>,
	Callbacks = T extends unknown ? CallbackErrors<T, A> | PromptError<T, P, A> : never> = ValidateResolved<C, P extends typeof textModes[number]
	? ([Unknown] extends [never] ? unknown : `Config Error: Unknown LLMAgent properties: '${Unknown & string}'.`)
	& ([Required] extends [never] ? unknown : `Config Error: Missing required LLMAgent property '${Required & string}'.`)
	& ([T] extends [InferSettings<P, A>] ? unknown : 'Config Error: Settings must match the final LLMAgent.')
	& ([Callbacks] extends [never] ? unknown : `Config Error: Hook or callback '${Callbacks & string}' is incompatible with the final configuration.`)
	& ([StreamingToolConfig<T>] extends [never] ? unknown : 'Config Error: LLMAgent tools are generation-only; streaming is not supported.')
	& ComponentAdmission<T>
	& ([Extract<UnionKeys<T>, 'experimental_refineToolInput' | 'toolApproval'>] extends [never] ? unknown : ValidateToolCallbackNames<T>)
	& ([UnionKeys<T> & ToolSelectionKeys] extends [never] ? unknown : ValidateToolSelectionNames<T>)
	& (true extends A ? ToolInputAdmission<T> & ToolOutputAdmission<EmptyMap, CompletedOutput<AgentOutput<T>>>
		& ValidateDescriptor<C, T, CompletedOutput<AgentOutput<T>>> : unknown) : 'Config Error: Unsupported LLMAgent source modifier.'>;

type ConfigChecks<C, T, P extends PromptType, A extends boolean> = T extends unknown
	? (checks: CommonInputs<{ [M in Extract<ConfigValue<T, typeof sourceMode>, P>]: ValidateBranch<C, T, M, ToolMode<T, A>> }>) => void : never;
type Validate<C, T, P extends PromptType, A extends boolean> =
	(ConfigChecks<C, T, P, A> extends (checks: infer Checks) => void ? Checks : never)
	& ([Extract<UnionKeys<T>, 'tools' | 'toolsContext'>] extends [never] ? unknown : ValidateToolsContext<C, T>);

type AgentFactory<P extends Mode, A extends boolean = false, S extends boolean = false> = <
	C extends object & Provisional<InferShape<P, A>>,
	Parent extends ConfigProvider<object> = never,
	ParentConfig extends object = Parent['config'],
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
	& (ConfigValue<Complete, typeof sourceMode> extends 'function' ? NoInfer<PromptCallback<Captured, EffectiveTool>> : unknown)
	& (true extends EffectiveTool ? DescriptorInput<ConfigSchemas<SchemaPresence, Input, never, ToolContext>, CallbackParent<ParentConfig>, CompletedOutput<AgentOutput<Captured>>> : unknown)
	& Validate<C, Complete, Extract<ConfigValue<Complete, typeof sourceMode>, PromptType>, A>,
	...parent: [Parent] extends [never] ? [] : [parent: Parent & NoInfer<ConfigProvider<ParentToolSelectionInput<ParentConfig, Tools>>>]
) => NoInfer<LLMAgentComponent<Complete, Extract<ConfigValue<Complete, typeof sourceMode>, PromptType>, EffectiveTool>>;

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
