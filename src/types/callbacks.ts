import type { AgentCallbacks } from './agent.js';
import type { EmptyMap, StrictUnionSubtype, UnionKeys } from './utils.js';
import type { InferSchema } from './schema.js';
import type { generateText, streamText, ToolSet, GenericToolApprovalFunction, SingleToolApprovalFunction, ToolApprovalStatus } from 'ai';
import type { ConfigValue, RuntimeContextFromConfig, ToolsFromConfig, ToolProperties, ToolContextFromConfig } from './config.js';
import type { CollectedResult } from './result.js';
import type { MergedConfig } from './merge.js';
import type { ValidateResolved } from './provisional.js';

type Callback = (...args: any[]) => any;
type CallbackKeys<T> = { [K in keyof T]-?: Extract<NonNullable<T[K]>, Callback | readonly Callback[]> extends never ? never : K }[keyof T];
type DescriptorCallbackKeys = 'needsApproval' | 'onInputStart' | 'onInputDelta' | 'onInputAvailable' | 'toModelOutput';

export type ConfigCallbackKeys = CallbackKeys<Parameters<typeof generateText<ToolSet>>[0]> | CallbackKeys<Parameters<typeof streamText<ToolSet>>[0]> | 'experimental_refineToolInput' | 'toolApproval' | 'prepareCall';

// Infer config data before checking callbacks that depend on that data.
export type CallbackConfigShape<T> = T extends unknown ? {
	// An inherited optional model may be undefined until the child supplies a required model.
	[K in keyof T]: K extends 'description' ? 'toolContextSchema' extends keyof T ? unknown : T[K]
	: K extends ConfigCallbackKeys | ToolSelectionKeys | DescriptorCallbackKeys ? unknown
	: K extends 'model' ? EmptyMap extends Pick<T, K> ? T[K] | undefined : T[K] : T[K]
} : never;

type Setting<K extends PropertyKey, T> = [T] extends [never] ? EmptyMap : Record<K, T>;

// Infer schema values independently before contextualizing native descriptor callbacks.
export type DescriptorInput<Schemas, Parent, Result = never,
	Final = MergedConfig<Parent, Schemas>> = NoInfer<ToolProperties<
		InferSchema<ConfigValue<Final, 'inputSchema'>>,
		[Result] extends [never] ? CollectedResult<Final> : Result,
		ToolContextFromConfig<Final>>>;

type DescriptorErrors<Final, R> = Final extends unknown ?
	Pick<Final, keyof ToolProperties & keyof Final> extends ToolProperties<
		InferSchema<ConfigValue<Final, 'inputSchema'>>, R, ToolContextFromConfig<Final>>
		? never : 'Config Error: Tool descriptor properties must match the final schemas.' : never;
export type ValidateDescriptor<C, Final, R, Errors = DescriptorErrors<Final, R>> = ValidateResolved<C,
	[Errors] extends [never] ? unknown : Errors>;

type ToolCallbackKeys = 'experimental_refineToolInput' | 'toolApproval';
export type ToolSelectionKeys = 'activeTools' | 'toolChoice' | 'toolOrder' | 'experimental_toolCallers' | 'timeout';
export type ToolSelections<TOOLS extends ToolSet> = Pick<Parameters<typeof generateText<TOOLS>>[0], ToolSelectionKeys>;
export type ToolSettingsInput<Parent, Tools, Runtime> = Pick<Parameters<typeof generateText<
	ToolsFromConfig<MergedConfig<Parent, Setting<'tools', Tools>>>,
	RuntimeContextFromConfig<MergedConfig<Parent, Setting<'runtimeContext', Runtime>>>>>[0], ToolSelectionKeys | 'toolApproval'>;
export type ParentToolSelectionInput<P, C> = NoInfer<P extends unknown
	? ToolSelections<ToolsFromConfig<MergedConfig<P, Setting<'tools', C>>>> : never>;
type InvalidToolSelections<TConfig, Expected> = {
	[K in ToolSelectionKeys & keyof TConfig]-?: K extends keyof Expected ? Pick<TConfig, K> extends Pick<Expected, K> ? never : K : K;
}[ToolSelectionKeys & keyof TConfig];

type TimeoutToolNames<T> = T extends { tools?: infer Tools } ? UnionKeys<NonNullable<Tools>> : never;
type UnknownTimeoutTools<T, Tools extends ToolSet> = Exclude<TimeoutToolNames<ConfigValue<T, 'timeout'>>, `${keyof Tools & string}Ms`>;

// Fragments can name tools before a tool map exists; consuming factories check the final map.
type ToolSelectionErrors<T, PartialConfig extends boolean> = T extends unknown
	? InvalidToolSelections<T, ToolSelections<PartialConfig extends true ? 'tools' extends keyof T ? ToolsFromConfig<T> : ToolSet : ToolsFromConfig<T>>>
		| (PartialConfig extends true ? 'tools' extends keyof T ? Exclude<UnionKeys<NonNullable<ConfigValue<T, 'experimental_toolCallers'>>>, keyof ToolsFromConfig<T>> : never
			: Exclude<UnionKeys<NonNullable<ConfigValue<T, 'experimental_toolCallers'>>>, keyof ToolsFromConfig<T>>)
		| UnknownTimeoutTools<T, PartialConfig extends true ? 'tools' extends keyof T ? ToolsFromConfig<T> : ToolSet : ToolsFromConfig<T>> : never;
export type ValidateToolSelectionNames<T, PartialConfig extends boolean = false> =
	[ToolSelectionErrors<T, PartialConfig>] extends [never] ? unknown
	: 'Config Error: Tool selections must name configured tools and follow the AI SDK selection contract.';

type CallbackToolNames<T> = T extends Callback ? never : keyof T;
type UnknownToolCallbackNames<T, PartialConfig extends boolean> = T extends unknown
	? PartialConfig extends true ? 'tools' extends keyof T ? UnknownToolCallbackNames<T, false> : never
	: { [K in ToolCallbackKeys]: K extends keyof T
		? Exclude<CallbackToolNames<NonNullable<T[K]>>, keyof ToolsFromConfig<T>> : never;
	}[ToolCallbackKeys] : never;

// Generic config inference preserves extra nested keys; validate mapped tool names explicitly.
export type ValidateToolCallbackNames<T, PartialConfig extends boolean = false> =
	[UnknownToolCallbackNames<T, PartialConfig>] extends [never]
	? unknown : `Config Error: Unknown tool callback '${UnknownToolCallbackNames<T, PartialConfig> & string}'.`;

type ToolApprovalReturn = ReturnType<GenericToolApprovalFunction<ToolSet, any, any>>;
type InvalidApprovalEntry<T, K> = T extends Callback ? ReturnType<T> extends ToolApprovalReturn ? never : K
	: T extends ToolApprovalStatus ? never : K;
type InvalidApprovalConfig<T> = T extends Callback ? InvalidApprovalEntry<T, 'toolApproval'>
	: T extends object ? { [K in keyof T]-?: InvalidApprovalEntry<T[K], K> }[keyof T] : 'toolApproval';
type ValidateApprovalContracts<TConfig> = 'toolApproval' extends keyof TConfig
	? [InvalidApprovalConfig<NonNullable<TConfig['toolApproval']>>] extends [never] ? unknown
	: 'Config Error: Tool approval callbacks and statuses must follow the AI SDK approval contract.' : unknown;

type MemberCallbacks<T, K extends PropertyKey> = T extends unknown ? K extends keyof T ? Extract<NonNullable<T[K]>, Callback> : never : never;
type MemberNonCallbacks<T, K extends PropertyKey> = T extends unknown ? K extends keyof T ? Exclude<T[K], Callback> : never : never;
type CombinedCallback<F extends Callback> = { callback(...args: Parameters<F>): ReturnType<F> }['callback'];
type DeferredApprovalMap<T> = Record<string, ToolApprovalStatus | CombinedCallback<SingleToolApprovalFunction<unknown, unknown, RuntimeContextFromConfig<T>>>>;
type ConfigCallbackValue<Shapes, K extends PropertyKey> = [MemberCallbacks<Shapes, K>] extends [never]
	? Shapes extends unknown ? K extends keyof Shapes ? Shapes[K] : never : never
	: MemberNonCallbacks<Shapes, K> | CombinedCallback<MemberCallbacks<Shapes, K>>;

// A fragment without output selection can later serve either text or structured output.
type FragmentCallbacks<T> = AgentCallbacks<'output' extends keyof T ? T
	: T & { output: import('ai').OutputInterface<unknown, unknown, unknown> }>;

type AnyConfigCallbacks<T, Shapes = FragmentCallbacks<T>> = {
	[K in UnionKeys<Shapes>]?: K extends 'toolApproval' ? 'tools' extends keyof T ? ConfigCallbackValue<Shapes, K>
	: DeferredApprovalMap<T> | CombinedCallback<MemberCallbacks<Shapes, K>> : ConfigCallbackValue<Shapes, K>;
};

export type AnyConfigCallbackInput<Config, Parent, Data, Tools, RuntimeContext, Output,
	Context = MergedConfig<Parent, Data & Setting<'tools', Tools> & Setting<'runtimeContext', RuntimeContext> & Setting<'output', Output>>,
	Final = MergedConfig<Parent, Config>> =
	{ tools?: Tools; runtimeContext?: RuntimeContext; output?: Output } & NoInfer<AnyConfigCallbacks<Context> & ToolSelections<'tools' extends keyof Context ? ToolsFromConfig<Context> : ToolSet>> &
	ValidateResolved<Config, ValidateApprovalContracts<Final> & ValidateToolCallbackNames<Final, true> & ValidateToolSelectionNames<Final, true> & ([StrictUnionSubtype<Pick<Final, ConfigCallbackKeys & keyof Final>, FragmentCallbacks<Final>>] extends [never]
	? 'Config Error: Callbacks do not match the final configuration.' : unknown)>;
