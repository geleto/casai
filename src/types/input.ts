import type { EmptyMap, OptionalUndefined, UnionKeys } from './utils.js';
import type { ValidateRunConfig } from './config-validation.js';
import type { ComponentExecutionOptions } from './sdk.js';
import type { ToolContexts } from './tool-binding.js';
import type { ToolRegistryFromConfig } from './config.js';
import type { ModelMessage } from 'ai';
import type { ComponentInputShape, CanOmitComponentInput, ValidateComponentInput } from './component-input.js';

export type ContextArguments<TConfig, INPUT = ComponentInputShape<TConfig>> = CanOmitComponentInput<TConfig> extends true
	? [context?: INPUT | undefined]
	: [context: INPUT];

// Arrays are dispatched as messages and functions cannot serve as context objects.
export type ValidateContextValue<T> = 0 extends (1 & T) ? unknown
	: [Extract<T, readonly unknown[] | ((...args: never[]) => unknown)>] extends [never] ? unknown : never;

// Omission must be valid across the whole configuration, not just one branch.
type RendererArguments<TConfig, Key extends string> = [TConfig] extends [Record<Key, string>]
	? (CanOmitComponentInput<TConfig> extends true ? [promptOrContext?: string | ComponentInputShape<TConfig> | undefined] : ContextArguments<TConfig>)
	| [prompt: string, ...args: ContextArguments<TConfig>]
	: [prompt: string, ...args: ContextArguments<TConfig>];

type ValidateRendererArguments<TArgs extends unknown[]> = TArgs extends [infer FIRST, ...infer REST]
	? [FIRST] extends [string] ? ValidateContextValue<REST[0]> : ValidateContextValue<FIRST> : unknown;

type ValidateMessageArgument<T> = [Extract<T, readonly unknown[]>] extends [ModelMessage[]] ? unknown : never;
type ValidateAgentSource<T, Allowed> = [Extract<T, readonly unknown[] | ((...args: never[]) => unknown)>] extends
	[Extract<Allowed, readonly unknown[] | ((...args: never[]) => unknown)>] ? unknown : never;
type ContextArgument<A extends unknown[]> = A extends [infer First, ...infer Rest]
	? First extends string ? Rest extends [infer Input, ...unknown[]] ? NonNullable<Input> : EmptyMap : NonNullable<First> : EmptyMap;

type AgentContextArgument<A extends unknown[]> = A extends [infer F, ...infer Rest]
	? F extends string | readonly unknown[] | ((...args: never[]) => unknown) | undefined
		? Rest extends [infer Second, ...unknown[]] ? Second extends readonly unknown[] | undefined ? EmptyMap : Second : EmptyMap
		: F : EmptyMap;
type CallContext<A extends unknown[], Messages> = Messages extends 'agent' ? AgentContextArgument<A> : ContextArgument<A>;

type ContextKeys<Args extends unknown[], FirstKeys extends PropertyKey, Messages> = [Exclude<Args[0], string | readonly unknown[] | ((...args: never[]) => unknown) | undefined>] extends [never]
	? UnionKeys<CallContext<Args, Messages>> : FirstKeys;

// Reflection sees an uninstantiated rest array; actual calls infer finite tuples and receive validation.
type ValidateArguments<TArgs extends unknown[], TAllowed extends unknown[], Messages extends false | 'agent', TConfig, FirstKeys extends PropertyKey> = number extends TArgs['length'] ? unknown
	: [TArgs] extends [TAllowed] ? (Messages extends 'agent'
		? ValidateAgentSource<TArgs[0], TAllowed[0]> & ValidateMessageArgument<TArgs[0]> & ValidateMessageArgument<TArgs[1]> & ValidateMessageArgument<TArgs[2]> & ValidateContextValue<AgentContextArgument<TArgs>>
		: ValidateRendererArguments<TArgs>) &
	([TConfig] extends [never] ? unknown : ValidateComponentInput<TConfig, CallContext<TArgs, Messages>, ContextKeys<TArgs, FirstKeys, Messages>>) : never;
type TailForFirst<TAllowed extends unknown[], TFirst> = unknown extends TFirst ? [] : TAllowed extends [unknown?, ...infer REST]
	? [TFirst] extends [TAllowed[0]] ? REST : never : never;

// Capture supplied keys separately: contextual callbacks can infer a partial
// schema shape, but omitted configured fields must not become supplied input.
type CallSignature<TAllowed extends unknown[], TResult, Messages extends false | 'agent', TConfig> =
	([] extends TAllowed ? () => TResult : unknown)
	& (<First extends TAllowed[0], Rest extends unknown[] = [], K extends PropertyKey = never>(first: First & (Partial<Record<K, unknown>> | undefined),
		...rest: Rest & NoInfer<TailForFirst<TAllowed, First> & ValidateArguments<[First, ...Rest], TAllowed, Messages, TConfig, K>>) => TResult);

type CallSignatures<TAllowed extends unknown[], TResult, Messages extends false | 'agent', TConfig> = TAllowed extends unknown
	? (signature: CallSignature<TAllowed, TResult, Messages, TConfig>) => void : never;
export type ComponentCall<TAllowed extends unknown[], TResult, Messages extends false | 'agent' = false, TConfig = never> =
	CallSignatures<TAllowed, TResult, Messages, TConfig> extends (signature: infer Signature) => void ? Signature : never;

export type RendererCall<TConfig, TResult, Key extends string> =
	ComponentCall<RendererArguments<TConfig, Key>, TResult, false, TConfig>;

// Named calls use the same configured-default completeness check as shorthand.
export type RunContext<TConfig> = CanOmitComponentInput<TConfig> extends true
	? { context?: ComponentInputShape<TConfig> }
	: { context: ComponentInputShape<TConfig> };

export type ComponentCaller<TConfig, TResult> = ComponentCall<ContextArguments<TConfig>, Promise<TResult>, false, TConfig>;

// Capture supplied keys independently of callback inference.
type RunArgument<Config, Settings, Run, Keys extends PropertyKey, ContextKeys extends PropertyKey> =
	Run & NoInfer<Settings | (EmptyMap extends Settings ? undefined : never)>
	& ([Run] extends [undefined] ? unknown : Partial<Record<Keys, unknown>>
		& { context?: Partial<Record<ContextKeys, unknown>> | undefined }
		& ValidateRunConfig<Run, Config, Settings, Keys, ContextKeys>);

type ComponentRunSignature<TConfig, TResult, TSettings> =
	(EmptyMap extends TSettings ? () => Promise<TResult> : unknown)
	& (<Run extends object | undefined, Keys extends PropertyKey = never, ContextKeys extends PropertyKey = never>(
		options: RunArgument<TConfig, TSettings, Run, Keys, ContextKeys>) => Promise<TResult>);

export type ComponentRun<TConfig, TResult, TSettings = EmptyMap> = ComponentRunSignature<TConfig, TResult, TSettings & RunContext<TConfig>
	& OptionalUndefined<Pick<ComponentExecutionOptions, 'abortSignal'>> & { toolsContext?: Partial<ToolContexts<ToolRegistryFromConfig<TConfig>>> | undefined }>;

export type SourceSetting<TConfig, TSourceKey extends string> = TConfig extends Record<TSourceKey, string> ? Partial<Record<TSourceKey, string>> : Record<TSourceKey, string>;
