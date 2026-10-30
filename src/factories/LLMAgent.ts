import type { AgentCallbacks, AgentFactoryShape, AgentOutput, AgentRequiredSettings, LLMAgentComponent, PromptCallback } from '../types/agent.js';
import type { AIOutput } from '../types/sdk.js';
import type { CallbackConfigShape, ConfigCallbackKeys, DescriptorInput, ParentToolSelectionInput, ToolSettingsInput, ToolSelectionKeys, ValidateDescriptor, ValidateToolCallbackNames, ValidateToolSelectionNames } from '../types/callbacks.js';
import type { ConfigSchemas, SchemaConfigInferShape, ToolMode, ToolModeConfig } from '../types/factory-config.js';
import type { ComponentAdmission, ToolInputAdmission, ToolOutputAdmission, ValidateToolsContext } from '../types/config-validation.js';
import type { ConfigProvider, ConfigValue, ToolRegistry } from '../types/config.js';
import type { MergedConfig } from '../types/merge.js';
import type { PromptType } from '../types/prompt.js';
import type { CompletedOutput } from '../types/result.js';
import type { EmptyMap, UnionKeys } from '../types/utils.js';
import type { Provisional, ResolvedConfig, ValidateResolved } from '../types/provisional.js';
import type { RuntimeAgentConfig } from '../runtime/llm-agent.js';
import { createLLMAgent } from '../runtime/llm-agent.js';
import { processConfig, mergeConfigs } from '../config/config-utils.js';
import { validateAgentConfig } from '../config/validate.js';
import { validateRegistryConfig } from '../runtime/execution.js';

type IsUnion<T, All = T> = T extends unknown ? [All] extends [T] ? false : true : never;

type SourceMode = PromptType | 'inherit';
type Mode<P extends SourceMode, T> = P extends 'inherit'
	? Extract<ConfigValue<T, 'promptType'>, PromptType> extends never ? 'text' : Extract<ConfigValue<T, 'promptType'>, PromptType> : P;
type Parent<P> = [P] extends [never] ? EmptyMap : P;
type Final<P, C> = [P] extends [never] ? ResolvedConfig<C> : MergedConfig<P, ResolvedConfig<C>>;
type Resolved<P extends SourceMode, S extends boolean, T> = T extends unknown
	? (Extract<keyof T, 'promptType' | (S extends true ? 'streaming' : never)> extends never ? T : Omit<T, 'promptType' | (S extends true ? 'streaming' : never)>) & (S extends true ? { promptType: Mode<P, T>; streaming: true } : { promptType: Mode<P, T> }) : never;
type Shape<P extends SourceMode, A extends boolean> = AgentFactoryShape<P extends PromptType ? P : PromptType, A>;
type InferShape<P extends SourceMode, A extends boolean> = CallbackConfigShape<Omit<Partial<Shape<P, A>>, 'prompt'>>
	& (P extends 'function' ? { prompt?: unknown } : Pick<Partial<Shape<P, A>>, 'prompt'>);
type Settings = 'context' | 'tools' | 'toolsContext' | 'runtimeContext' | 'output';
type CapturedSettings<P, Context, Tools, ToolContexts, Runtime, Output> = Pick<{
	[K in keyof P]: K extends 'context' ? Context : K extends 'tools' ? Tools : K extends 'toolsContext' ? ToolContexts : K extends 'runtimeContext' ? Runtime : Output
}, keyof P & Settings>;
type CallbackConfig<C, P, Schemas, Values> = MergedConfig<Parent<P>,
	Omit<ResolvedConfig<C>, 'prepareCall' | 'prepareStep' | 'prompt' | Settings> & Schemas & Values>;
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
type Validate<C, Parent, T, P extends PromptType, A extends boolean,
	Unknown = Exclude<UnionKeys<C> | UnionKeys<Parent>, keyof AgentFactoryShape<P, A>>,
	Required = Missing<T, AgentRequiredSettings<P, A>>,
	Callbacks = T extends unknown ? CallbackErrors<T, A> | PromptError<T, P, A> : never> = ValidateResolved<C,
	([Unknown] extends [never] ? unknown : `Config Error: Unknown LLMAgent properties: '${Unknown & string}'.`)
	& ([Required] extends [never] ? unknown : `Config Error: Missing required LLMAgent property '${Required & string}'.`)
	& ([Callbacks] extends [never] ? unknown : `Config Error: Hook or callback '${Callbacks & string}' is incompatible with the final configuration.`)
	& ([StreamingToolConfig<T>] extends [never] ? unknown : 'Config Error: LLMAgent tools are generation-only; streaming is not supported.')
	& ComponentAdmission<T>
	& ([Extract<UnionKeys<T>, 'tools' | 'toolsContext'>] extends [never] ? unknown : ValidateToolsContext<C, T>)
	& ([Extract<UnionKeys<T>, 'experimental_refineToolInput' | 'toolApproval'>] extends [never] ? unknown : ValidateToolCallbackNames<T>)
	& ([UnionKeys<T> & ToolSelectionKeys] extends [never] ? unknown : ValidateToolSelectionNames<T>)
	& (A extends true ? ToolInputAdmission<T> & ToolOutputAdmission<EmptyMap, CompletedOutput<AgentOutput<T>>>
		& ValidateDescriptor<C, T, CompletedOutput<AgentOutput<T>>> : unknown)>;

type AgentFactory<P extends SourceMode, A extends boolean = false, S extends boolean = false> = <
	C extends object & Provisional<InferShape<P, A>>,
	ParentConfig extends object & NoInfer<InferShape<P, A>> = never,
	SchemaPresence extends object = object, Input = never, ToolContext = never,
	SettingPresence extends object = object,
	Context extends Record<string, any> | undefined = never,
	Tools extends ToolRegistry | undefined = never, ToolContexts extends object | undefined = never,
	Runtime extends Record<string, unknown> | undefined = never, Output extends AIOutput | undefined = never,
	Captured = CallbackConfig<C, ParentConfig, ConfigSchemas<SchemaPresence, Input, never, ToolContext>, CapturedSettings<SettingPresence, Context, Tools, ToolContexts, Runtime, Output>>,
	Complete = Resolved<P, S, ToolModeConfig<Final<ParentConfig, C>, A>>,
	EffectiveTool extends boolean = ToolMode<Complete, A>,
>(config: C & SchemaConfigInferShape<SchemaPresence, Input, never, ToolContext>
	& Pick<{ [K in keyof SettingPresence]: unknown }, keyof SettingPresence & Settings>
	& { context?: Context; tools?: Tools; toolsContext?: ToolContexts; runtimeContext?: Runtime }
	& { output?: Output | ConfigValue<C, 'output'> }
	& NoInfer<IsUnion<C> extends true ? unknown : [keyof C & ConfigCallbackKeys] extends [never] ? unknown : AgentCallbacks<Captured, EffectiveTool>>
	& NoInfer<ToolSettingsInput<Parent<ParentConfig>, Tools, Runtime>>
	& (ConfigValue<Complete, 'promptType'> extends 'function' ? NoInfer<PromptCallback<Captured, EffectiveTool>> : unknown)
	& (true extends EffectiveTool ? DescriptorInput<ConfigSchemas<SchemaPresence, Input, never, ToolContext>, Parent<ParentConfig>, CompletedOutput<AgentOutput<Captured>>> : unknown)
	& Validate<C, Parent<ParentConfig>, Complete, Extract<ConfigValue<Complete, 'promptType'>, PromptType>, true extends EffectiveTool ? true : false>,
	...parent: [ParentConfig] extends [never] ? [] : [parent: ConfigProvider<ParentConfig & ParentToolSelectionInput<ParentConfig, Tools>>]
) => NoInfer<LLMAgentComponent<Complete, Extract<ConfigValue<Complete, 'promptType'>, PromptType>, EffectiveTool>>;

type FactoryModes<P extends SourceMode> = AgentFactory<P> & {
	asTool: AgentFactory<P, true>;
	asStream: AgentFactory<P, false, true>;
};

function factory(promptType: SourceMode, streaming = false, asTool = false) {
	return (config: Record<string, unknown>, parent?: ConfigProvider<Record<string, unknown>>) => {
		const merged = parent ? mergeConfigs(parent.config, config) : processConfig(config);
		const toolMode = asTool || merged.asTool === true;
		const selected = { ...merged, ...(toolMode ? { asTool: true } : {}), promptType: promptType === 'inherit' ? merged.promptType ?? 'text' : promptType,
			...(streaming || merged.streaming === true ? { streaming: true } : {}) };
		validateAgentConfig(selected);
		validateRegistryConfig(selected as RuntimeAgentConfig, config);
		return createLLMAgent(selected as RuntimeAgentConfig);
	};
}

function modes<P extends SourceMode>(promptType: P): FactoryModes<P> {
	const stream = factory(promptType, true);
	return Object.assign(factory(promptType), { asStream: stream, asTool: factory(promptType, false, true) }) as FactoryModes<P>;
}

export const LLMAgent = Object.assign(modes('inherit'), {
	withText: modes('text'), withTemplate: modes('async-template'), withScript: modes('async-script'),
	withFunction: modes('function'), loadsText: modes('text-name'),
	loadsTemplate: modes('async-template-name'), loadsScript: modes('async-script-name'),
});
