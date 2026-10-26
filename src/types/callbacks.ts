import type { AIOutput, GenerateRequest, StreamRequest, ObjectFinishCallback, ObjectOutputMode, ObjectOutputSettingKeys } from './sdk.js';
import type { EmptyMap, StrictUnionSubtype, UnionKeys } from './utils.js';
import type { InferSchema } from './schema.js';
import type { generateText, streamText, generateObject, streamObject, ToolSet, GenericToolApprovalFunction, SingleToolApprovalFunction, ToolApprovalStatus } from 'ai';
import type { ConfigValue, ObjectOutputFromConfig, OutputFromConfig, RuntimeContextFromConfig, ToolsFromConfig, ToolProperties, ToolContextFromConfig } from './config.js';
import type { CollectedResult } from './result.js';
import type { MergedConfig } from './merge.js';
import type { ValidateResolved } from './provisional.js';

type Callback = (...args: any[]) => any;
type CallbackKeys<T> = { [K in keyof T]-?: Extract<NonNullable<T[K]>, Callback | readonly Callback[]> extends never ? never : K }[keyof T];
type DescriptorCallbackKeys = 'needsApproval' | 'onInputStart' | 'onInputDelta' | 'onInputAvailable' | 'toModelOutput';

export type ConfigCallbackKeys = CallbackKeys<Parameters<typeof generateText<ToolSet>>[0]> | CallbackKeys<Parameters<typeof streamText<ToolSet>>[0]> | CallbackKeys<Parameters<typeof generateObject>[0]> | CallbackKeys<Parameters<typeof streamObject>[0]> | 'experimental_refineToolInput' | 'toolApproval';

// Reusable fragments can configure text output specifications or object output modes.
export type ConfigCallbackOutput = AIOutput | ObjectOutputMode;

// Infer config data before checking callbacks that depend on that data.
export type CallbackConfigShape<T> = T extends unknown ? {
	// An inherited optional model may be undefined until the child supplies a required model.
	[K in keyof T]: K extends 'description' ? 'toolContextSchema' extends keyof T ? unknown : T[K]
	: K extends ConfigCallbackKeys | ToolSelectionKeys | DescriptorCallbackKeys ? unknown
	: K extends 'model' ? EmptyMap extends Pick<T, K> ? T[K] | undefined : T[K] : T[K]
} : never;

export type TextCallbacks<T, TOOLS extends ToolSet = ToolsFromConfig<T>, Streaming extends boolean = false,
	SDK = Streaming extends true
	? StreamRequest<TOOLS, RuntimeContextFromConfig<T>, OutputFromConfig<T>>
	: GenerateRequest<TOOLS, RuntimeContextFromConfig<T>, OutputFromConfig<T>>,
> = {
	[K in ConfigCallbackKeys & keyof SDK]?: SDK[K]
};

interface ObjectCallbacks<T, Streaming extends boolean = false> { onFinish?: ObjectFinishCallback<ObjectOutputFromConfig<T>, Streaming> }

export type ObjectCallbackShape<T> = T extends unknown ? {
	[K in keyof T]: K extends 'description' ? 'toolContextSchema' extends keyof T ? unknown : T[K]
	: K extends 'onFinish' | DescriptorCallbackKeys ? unknown
	// Capture an explicit removal before final validation, even in exact-optional mode.
	: K extends 'schema' ? EmptyMap extends Pick<T, K> ? T[K] | undefined : T[K] : T[K]
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

interface ObjectCallbackArguments<S, M, E> { schema?: S, output?: M, enum?: E | undefined }
export type ObjectCallbackConfig<P, S, M, E> = MergedConfig<[P] extends [never] ? EmptyMap : P, Setting<'schema', S> & Setting<'output', M> & Setting<'enum', E>>;
interface TextCallbackArguments<T, R, O> { tools?: T, runtimeContext?: R, output?: O }
export type TextCallbackConfig<P, T, R, O> = MergedConfig<[P] extends [never] ? EmptyMap : P, Setting<'tools', T> & Setting<'runtimeContext', R> & Setting<'output', O>>;

// Clearing obsolete mode settings belongs to construction/inheritance, not run overrides.
type ClearedObjectSettings<Shape> = {
	[K in ObjectOutputSettingKeys & keyof Shape]: [Shape[K]] extends [undefined] ? K : never
}[ObjectOutputSettingKeys & keyof Shape];
export type ObjectRunConfig<Shape, T, Streaming extends boolean> = Omit<Shape, 'onFinish' | ClearedObjectSettings<Shape>> & ObjectCallbacks<T, Streaming>;

type ToolCallbackKeys = 'experimental_refineToolInput' | 'toolApproval';
type ToolSelectionKeys = 'activeTools' | 'toolChoice' | 'toolOrder' | 'experimental_toolCallers';
type ToolSelections<TOOLS extends ToolSet> = Pick<Parameters<typeof generateText<TOOLS>>[0], ToolSelectionKeys>;
export type ParentToolSelectionInput<P, C> = NoInfer<P extends unknown
	? ToolSelections<ToolsFromConfig<MergedConfig<P, Setting<'tools', C>>>> : never>;
type InvalidToolSelections<TConfig, Expected> = {
	[K in ToolSelectionKeys & keyof TConfig]-?: K extends keyof Expected ? Pick<TConfig, K> extends Pick<Expected, K> ? never : K : K;
}[ToolSelectionKeys & keyof TConfig];

// Fragments can name tools before a tool map exists; consuming factories check the final map.
type ToolSelectionErrors<T, PartialConfig extends boolean> = T extends unknown
	? InvalidToolSelections<T, ToolSelections<PartialConfig extends true ? 'tools' extends keyof T ? ToolsFromConfig<T> : ToolSet : ToolsFromConfig<T>>> : never;
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

type IncompatibleCallbackKeys<Final, Expected> = {
	[K in keyof Expected & keyof Final]-?: Pick<Final, K> extends Pick<Expected, K> ? never : K
}[keyof Expected & keyof Final];
type CallbackErrors<Final, Kind extends 'object' | 'text', Streaming extends boolean> = Final extends unknown
	? IncompatibleCallbackKeys<Final, Kind extends 'object' ? ObjectCallbacks<Final, Streaming> : TextCallbacks<Final, ToolsFromConfig<Final>, Streaming>> : never;
export type ValidateCallbacks<T, Final, Kind extends 'object' | 'text', Streaming extends boolean = false,
	Invalid = CallbackErrors<Final, Kind, Streaming>> = ValidateResolved<T, ValidateToolCallbackNames<Final> & ValidateToolSelectionNames<Final>
	& ([Invalid] extends [never] ? unknown : `Config Error: Callback '${Invalid & string}' is incompatible with the final configuration.`)>;

type CallbackFinal<P, C> = [P] extends [never] ? C : MergedConfig<P, C>;

export type ObjectCallbackInput<C, P, S, M, E, Streaming extends boolean> =
	ObjectCallbackArguments<S, M, E> & NoInfer<{ schema?: NonNullable<S> | undefined, enum?: NonNullable<E> | undefined }> &
	NoInfer<ObjectCallbacks<ObjectCallbackConfig<P, S, M, E>, Streaming>> &
	ValidateCallbacks<C, CallbackFinal<P, C>, 'object', Streaming>;

export type TextCallbackInput<C, P, T, R, O, Streaming extends boolean,
	Context = TextCallbackConfig<P, T, R, O>, Final = CallbackFinal<P, C>> =
	TextCallbackArguments<T, R, O> & NoInfer<TextCallbacks<Context, ToolsFromConfig<Context>, Streaming> & ToolSelections<ToolsFromConfig<Context>>> &
	ValidateCallbacks<C, Final, 'text', Streaming>;

type ObjectCommonCallbacks<F extends (...args: any[]) => any, SDK = Parameters<F>[0]> = Pick<SDK, Exclude<CallbackKeys<SDK>, 'onFinish'>>;
type AnyObjectCallbacks<T> = ObjectCommonCallbacks<typeof generateObject> & ObjectCallbacks<T>
	| ObjectCommonCallbacks<typeof streamObject> & ObjectCallbacks<T, true>;
type AnyTextCallbacks<T> = TextCallbacks<T> | TextCallbacks<T, ToolsFromConfig<T>, true>;

type AnyConfigCallbackShapes<T> = 'schema' extends keyof T ? AnyObjectCallbacks<T>
	: T extends { output: string } ? AnyObjectCallbacks<T>
	: 'tools' extends keyof T ? AnyTextCallbacks<T>
	: AnyTextCallbacks<T> | AnyObjectCallbacks<T>;
type MemberCallbacks<T, K extends PropertyKey> = T extends unknown ? K extends keyof T ? Extract<NonNullable<T[K]>, Callback> : never : never;
type MemberNonCallbacks<T, K extends PropertyKey> = T extends unknown ? K extends keyof T ? Exclude<T[K], Callback> : never : never;
type CombinedCallback<F extends Callback> = { callback(...args: Parameters<F>): ReturnType<F> }['callback'];
type DeferredApprovalMap<T> = Record<string, ToolApprovalStatus | CombinedCallback<SingleToolApprovalFunction<unknown, unknown, RuntimeContextFromConfig<T>>>>;
type ConfigCallbackValue<Shapes, K extends PropertyKey> = [MemberCallbacks<Shapes, K>] extends [never]
	? Shapes extends unknown ? K extends keyof Shapes ? Shapes[K] : never : never
	: MemberNonCallbacks<Shapes, K> | CombinedCallback<MemberCallbacks<Shapes, K>>;

type AnyConfigCallbacks<T, Shapes = AnyConfigCallbackShapes<T>> = {
	[K in UnionKeys<Shapes>]?: K extends 'toolApproval' ? 'tools' extends keyof T ? ConfigCallbackValue<Shapes, K>
	: DeferredApprovalMap<T> | CombinedCallback<MemberCallbacks<Shapes, K>> : ConfigCallbackValue<Shapes, K>;
};

export type AnyConfigCallbackInput<Config, Parent, Tools, Schema, RuntimeContext, Output, Enum,
	Context = MergedConfig<Parent, Setting<'tools', Tools> & Setting<'schema', Schema> & Setting<'runtimeContext', RuntimeContext> & Setting<'output', Output> & Setting<'enum', Enum>>,
	Final = CallbackFinal<Parent, Config>> =
	TextCallbackArguments<Tools, RuntimeContext, Output> & { enum?: Enum } & NoInfer<AnyConfigCallbacks<Context> & ToolSelections<'tools' extends keyof Context ? ToolsFromConfig<Context> : ToolSet>> &
	ValidateResolved<Config, ValidateApprovalContracts<Final> & ValidateToolCallbackNames<Final, true> & ValidateToolSelectionNames<Final, true> & ([StrictUnionSubtype<Pick<Final, ConfigCallbackKeys & keyof Final>, AnyConfigCallbackShapes<Final>>] extends [never]
	? 'Config Error: Callbacks do not match the final configuration.' : unknown)>;
