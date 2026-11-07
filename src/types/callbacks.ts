import type { EmptyMap, UnionKeys } from './utils.js';
import type { InferSchema } from './schema.js';
import type { generateText, streamText, embedMany, rerank, ToolSet } from 'ai';
import type { ConfigValue, RuntimeContextFromConfig, ToolsFromConfig, ToolProperties, ToolContextFromConfig } from './config.js';
import type { CollectedResult } from './result.js';
import type { MergedConfig } from './merge.js';
import type { ValidateResolved } from './provisional.js';

type Callback = (...args: any[]) => any;
export type CallbackKeys<T> = T extends unknown ? { [K in keyof T]-?: Extract<NonNullable<T[K]>, Callback | readonly Callback[]> extends never ? never : K }[keyof T] : never;
type DescriptorCallbackKeys = 'needsApproval' | 'onInputStart' | 'onInputDelta' | 'onInputAvailable' | 'toModelOutput';

export type ConfigCallbackKeys = CallbackKeys<Parameters<typeof generateText<ToolSet>>[0] | Parameters<typeof streamText<ToolSet>>[0]
	| Parameters<typeof embedMany>[0] | Parameters<typeof rerank>[0]> | 'experimental_refineToolInput' | 'toolApproval' | 'prepareCall';

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
export type FragmentToolSelections<Parent, Tools, Final = MergedConfig<Parent, Setting<'tools', Tools>>> =
	NoInfer<ToolSelections<'tools' extends keyof Final ? ToolsFromConfig<Final> : ToolSet>>;
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
