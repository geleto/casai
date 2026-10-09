import type { generateText, streamText, generateObject, streamObject, GenerateObjectEndEvent, JSONValue, ToolSet, GenericToolApprovalFunction, SingleToolApprovalFunction, ToolApprovalStatus } from 'ai';
import type { AIOutput, InferSchema } from './types.js';
import type { AugmentedResponse } from './result.js';
import type { DeclaredType, ToolsFromConfig } from './config.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type { ValidateResolved } from './provisional.js';
import type { StrictUnionSubtype } from './utils.js';

type Callback = (...args: any[]) => any;
type CallbackKeys<T> = { [K in keyof T]-?: Extract<NonNullable<T[K]>, Callback | readonly Callback[]> extends never ? never : K }[keyof T];

export type ConfigCallbackKeys = CallbackKeys<Parameters<typeof generateText<ToolSet>>[0]> | CallbackKeys<Parameters<typeof streamText<ToolSet>>[0]> | CallbackKeys<Parameters<typeof generateObject>[0]> | CallbackKeys<Parameters<typeof streamObject>[0]> | 'experimental_refineToolInput' | 'toolApproval';

// Infer config data before checking callbacks that depend on that data.
export type CallbackConfigShape<T> = T extends unknown ? {
	// An inherited optional model may be undefined until the child supplies a required model.
	[K in keyof T]: K extends ConfigCallbackKeys ? unknown
	: K extends 'model' ? EmptyMap extends Pick<T, K> ? T[K] | undefined : T[K] : T[K]
} : never;

export type OutputFromConfig<T> = [NonNullable<DeclaredType<T, 'output'>>] extends [never] ? AIOutput<string, string, never> : NonNullable<DeclaredType<T, 'output'>> extends infer O extends AIOutput ? O : AIOutput<string, string, never>;
export type RuntimeContextFromConfig<T> = [NonNullable<DeclaredType<T, 'runtimeContext'>>] extends [never] ? Record<string, unknown> : NonNullable<DeclaredType<T, 'runtimeContext'>> extends infer C extends Record<string, unknown> ? C : Record<string, unknown>;

type AugmentFinish<F> = F extends (event: infer E extends { response: unknown }) => infer R
	? (event: Omit<E, 'response'> & { response: AugmentedResponse<E['response']> }) => R : never;

export type TextCallbacks<T, TOOLS extends ToolSet = ToolsFromConfig<T>, Streaming extends boolean = false,
	SDK = Streaming extends true
	? Parameters<typeof streamText<TOOLS, RuntimeContextFromConfig<T>, OutputFromConfig<T>>>[0]
	: Parameters<typeof generateText<TOOLS, RuntimeContextFromConfig<T>, OutputFromConfig<T>>>[0],
> = {
	[K in ConfigCallbackKeys & keyof SDK]?: Streaming extends true ? K extends 'onEnd' | 'onFinish' ? AugmentFinish<SDK[K]> : SDK[K] : SDK[K]
};

export type ObjectOutputFromConfig<T> = T extends { output: 'no-schema' } ? JSONValue
	: T extends { output: 'enum', enum: readonly (infer E)[] } ? E
	: T extends { output: 'array' } ? InferSchema<DeclaredType<T, 'schema'>>[]
	: InferSchema<DeclaredType<T, 'schema'>>;

export type ObjectFinishCallback<RESULT, Streaming extends boolean = false> =
	(event: GenerateObjectEndEvent<RESULT>) => ReturnType<NonNullable<Parameters<Streaming extends true ? typeof streamObject : typeof generateObject>[0]['onFinish']>>;

export interface ObjectCallbacks<T, Streaming extends boolean = false> { onFinish?: ObjectFinishCallback<ObjectOutputFromConfig<T>, Streaming> }

export type ObjectCallbackShape<T> = T extends unknown ? Omit<T, 'onFinish'> & { onFinish?: unknown } : never;

type Setting<K extends PropertyKey, T> = [T] extends [never] ? EmptyMap : Record<K, T>;

export interface ObjectCallbackArguments<S, M, E> { schema?: S, output?: M, enum?: E }
export type ObjectCallbackConfig<P, S, M, E> = MergedConfig<[P] extends [never] ? EmptyMap : P, Setting<'schema', S> & Setting<'output', M> & Setting<'enum', E>>;
export interface TextCallbackArguments<T, R, O> { tools?: T, runtimeContext?: R, output?: O }
export type TextCallbackConfig<P, T, R, O> = MergedConfig<[P] extends [never] ? EmptyMap : P, Setting<'tools', T> & Setting<'runtimeContext', R> & Setting<'output', O>>;

export type ObjectRunConfig<Shape, T, Streaming extends boolean> = Omit<Shape, 'onFinish'> & ObjectCallbacks<T, Streaming>;

type ToolCallbackKeys = 'experimental_refineToolInput' | 'toolApproval';
type CallbackToolNames<T> = T extends Callback ? never : keyof T;
type UnknownToolCallbackNames<TConfig, TFinalConfig> = {
	[K in ToolCallbackKeys]: K extends keyof TConfig
	? Exclude<CallbackToolNames<NonNullable<TConfig[K]>>, keyof ToolsFromConfig<TFinalConfig>> : never;
}[ToolCallbackKeys];

// Generic config inference preserves extra nested keys; validate mapped tool names explicitly.
export type ValidateToolCallbackNames<TConfig, TFinalConfig = TConfig, PartialConfig extends boolean = false> =
	PartialConfig extends true ? 'tools' extends keyof TFinalConfig ? ValidateToolCallbackNames<TConfig, TFinalConfig> : unknown
	: [UnknownToolCallbackNames<TConfig, TFinalConfig>] extends [never]
	? unknown : `Config Error: Unknown tool callback '${UnknownToolCallbackNames<TConfig, TFinalConfig> & string}'.`;

type ToolApprovalReturn = ReturnType<GenericToolApprovalFunction<ToolSet, any, any>>;
type InvalidApprovalEntry<T, K> = T extends Callback ? ReturnType<T> extends ToolApprovalReturn ? never : K
	: T extends ToolApprovalStatus ? never : K;
type InvalidApprovalConfig<T> = T extends Callback ? InvalidApprovalEntry<T, 'toolApproval'>
	: T extends object ? { [K in keyof T]-?: InvalidApprovalEntry<T[K], K> }[keyof T] : 'toolApproval';
type ValidateApprovalContracts<TConfig> = 'toolApproval' extends keyof TConfig
	? [InvalidApprovalConfig<NonNullable<TConfig['toolApproval']>>] extends [never] ? unknown
	: 'Config Error: Tool approval callbacks and statuses must follow the AI SDK approval contract.' : unknown;

export type ValidateCallbacks<T, Final, Expected> = ValidateResolved<T, ValidateToolCallbackNames<Final> & ({
	[K in keyof Expected & keyof Final]-?: Pick<Final, K> extends Pick<Expected, K> ? never : K
}[keyof Expected & keyof Final] extends infer Invalid
	? [Invalid] extends [never] ? unknown : `Config Error: Callback '${Invalid & string}' is incompatible with the final configuration.` : never)>;

type CallbackFinal<P, C> = [P] extends [never] ? C : MergedConfig<P, C>;

export type ObjectCallbackInput<C, P, S, M, E, Streaming extends boolean> =
	ObjectCallbackArguments<S, M, E> & NoInfer<{ schema?: NonNullable<S>, enum?: NonNullable<E> }> &
	NoInfer<ObjectCallbacks<ObjectCallbackConfig<P, S, M, E>, Streaming>> &
	ValidateCallbacks<C, CallbackFinal<P, C>, ObjectCallbacks<CallbackFinal<P, C>, Streaming>>;

export type TextCallbackInput<C, P, T, R, O, Streaming extends boolean,
	Context = TextCallbackConfig<P, T, R, O>, Final = CallbackFinal<P, C>> =
	TextCallbackArguments<T, R, O> & NoInfer<TextCallbacks<Context, ToolsFromConfig<Context>, Streaming>> &
	ValidateCallbacks<C, Final, TextCallbacks<Final, ToolsFromConfig<Final>, Streaming>>;

type ObjectCommonCallbacks<F extends (...args: any[]) => any, SDK = Parameters<F>[0]> = Pick<SDK, Exclude<CallbackKeys<SDK>, 'onFinish'>>;
type ObjectFragmentCallbacks<T> = ObjectCommonCallbacks<typeof generateObject> & ObjectCallbacks<T>
	| ObjectCommonCallbacks<typeof streamObject> & ObjectCallbacks<T, true>;
type TextFragmentCallbacks<T> = TextCallbacks<T> | TextCallbacks<T, ToolsFromConfig<T>, true>;

type FragmentCallbackShapes<T> = 'schema' extends keyof T ? ObjectFragmentCallbacks<T>
	: T extends { output: string } ? ObjectFragmentCallbacks<T>
	: 'tools' extends keyof T ? TextFragmentCallbacks<T>
	: TextFragmentCallbacks<T> | ObjectFragmentCallbacks<T>;
type MemberCallbacks<T, K extends PropertyKey> = T extends unknown ? K extends keyof T ? Extract<NonNullable<T[K]>, Callback> : never : never;
type MemberNonCallbacks<T, K extends PropertyKey> = T extends unknown ? K extends keyof T ? Exclude<T[K], Callback> : never : never;
type CombinedCallback<F extends Callback> = { callback(...args: Parameters<F>): ReturnType<F> }['callback'];
type UnionKeys<T> = T extends unknown ? keyof T : never;
type DeferredApprovalMap<T> = Record<string, ToolApprovalStatus | CombinedCallback<SingleToolApprovalFunction<unknown, unknown, RuntimeContextFromConfig<T>>>>;
type FragmentCallbackValue<Shapes, K extends PropertyKey> = [MemberCallbacks<Shapes, K>] extends [never]
	? Shapes extends unknown ? K extends keyof Shapes ? Shapes[K] : never : never
	: MemberNonCallbacks<Shapes, K> | CombinedCallback<MemberCallbacks<Shapes, K>>;

export type FragmentCallbacks<T, Shapes = FragmentCallbackShapes<T>> = {
	[K in UnionKeys<Shapes>]?: K extends 'toolApproval' ? 'tools' extends keyof T ? FragmentCallbackValue<Shapes, K>
	: DeferredApprovalMap<T> | CombinedCallback<MemberCallbacks<Shapes, K>> : FragmentCallbackValue<Shapes, K>;
};

export type FragmentCallbackInput<C, P, Tools, Schema, R, O, E,
	Context = MergedConfig<P, Setting<'tools', Tools> & Setting<'schema', Schema> & Setting<'runtimeContext', R> & Setting<'output', O> & Setting<'enum', E>>> =
	TextCallbackArguments<Tools, R, O> & { enum?: E } & NoInfer<FragmentCallbacks<Context>> &
	ValidateResolved<C, ValidateApprovalContracts<CallbackFinal<P, C>> & ValidateToolCallbackNames<CallbackFinal<P, C>, CallbackFinal<P, C>, true> & ([StrictUnionSubtype<Pick<CallbackFinal<P, C>, ConfigCallbackKeys & keyof CallbackFinal<P, C>>, FragmentCallbackShapes<CallbackFinal<P, C>>>] extends [never]
	? 'Config Error: Callbacks do not match the final configuration.' : unknown)>;
