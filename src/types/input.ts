import type { EmptyMap, UnionKeys } from './utils.js';
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
type ValidateMessageArguments<TArgs extends unknown[]> = ValidateMessageArgument<TArgs[0]> & ValidateMessageArgument<TArgs[1]>
	& ([Extract<TArgs[0], readonly unknown[]>] extends [never] ? unknown
		: [Extract<TArgs[1], readonly unknown[]>] extends [never] ? unknown : never)
	& ValidateContextValue<Exclude<TArgs[0], string | readonly unknown[]>>
	& ValidateContextValue<Exclude<TArgs[1], readonly unknown[]>>
	& ValidateContextValue<TArgs[2]>;

type ContextArgument<A extends unknown[]> = A extends [infer F, ...infer Rest]
	? F extends string | readonly unknown[] | undefined ? Rest extends [infer Second, ...infer Tail]
		? Second extends readonly unknown[] | undefined ? Tail extends [infer Third] ? NonNullable<Third> : EmptyMap : Second
		: EmptyMap : F : EmptyMap;

type ContextKeys<Args extends unknown[], FirstKeys extends PropertyKey> = [Exclude<Args[0], string | readonly unknown[] | undefined>] extends [never]
	? UnionKeys<ContextArgument<Args>> : FirstKeys;

// Reflection sees an uninstantiated rest array; actual calls infer finite tuples and receive validation.
type ValidateArguments<TArgs extends unknown[], TAllowed, Messages extends boolean, TConfig, FirstKeys extends PropertyKey> = number extends TArgs['length'] ? unknown
	: [TArgs] extends [TAllowed] ? (Messages extends true ? ValidateMessageArguments<TArgs> : ValidateRendererArguments<TArgs>) &
	([TConfig] extends [never] ? unknown : ValidateComponentInput<TConfig, ContextArgument<TArgs>, ContextKeys<TArgs, FirstKeys>>) : never;
type TailForFirst<TAllowed extends unknown[], TFirst> = unknown extends TFirst ? [] : TAllowed extends [unknown?, ...infer REST]
	? [TFirst] extends [TAllowed[0]] ? REST : never : never;

// Capture supplied keys separately: contextual callbacks can infer a partial
// schema shape, but omitted configured fields must not become supplied input.
type CallSignature<TAllowed extends unknown[], TResult, Messages extends boolean, TConfig> =
	([] extends TAllowed ? () => TResult : unknown)
	& (<First extends TAllowed[0], Rest extends unknown[] = [], K extends PropertyKey = never>(first: First & (Partial<Record<K, unknown>> | undefined),
		...rest: Rest & NoInfer<TailForFirst<TAllowed, First> & ValidateArguments<[First, ...Rest], TAllowed, Messages, TConfig, K>>) => TResult);

type CallSignatures<TAllowed extends unknown[], TResult, Messages extends boolean, TConfig> = TAllowed extends unknown
	? (signature: CallSignature<TAllowed, TResult, Messages, TConfig>) => void : never;
export type ComponentCall<TAllowed extends unknown[], TResult, Messages extends boolean = false, TConfig = never> =
	CallSignatures<TAllowed, TResult, Messages, TConfig> extends (signature: infer Signature) => void ? Signature : never;

export type RendererCall<TConfig, TResult, Key extends string> =
	ComponentCall<RendererArguments<TConfig, Key>, TResult, false, TConfig>;

// Named calls use the same configured-default completeness check as shorthand.
export type RunContext<TConfig> = CanOmitComponentInput<TConfig> extends true
	? { context?: ComponentInputShape<TConfig> }
	: { context: ComponentInputShape<TConfig> };

export type ComponentCaller<TConfig, TResult> = ComponentCall<ContextArguments<TConfig>, Promise<TResult>, false, TConfig>;

type ComponentRunSignature<TConfig, TResult, TSettings> = EmptyMap extends TSettings
	? <TOverrides extends object>(options?: TOverrides & TSettings & ValidateRunConfig<TOverrides, TConfig, TSettings>) => Promise<TResult>
	: <TOverrides extends object>(options: TOverrides & TSettings & ValidateRunConfig<TOverrides, TConfig, TSettings>) => Promise<TResult>;

export type ComponentRun<TConfig, TResult, TSettings = EmptyMap> = ComponentRunSignature<TConfig, TResult, TSettings & RunContext<TConfig>
	& Pick<ComponentExecutionOptions, 'abortSignal'> & { toolsContext?: Partial<ToolContexts<ToolRegistryFromConfig<TConfig>>> | undefined }>;

export type SourceSetting<TConfig, TSourceKey extends string> = TConfig extends Record<TSourceKey, string> ? Partial<Record<TSourceKey, string>> : Record<TSourceKey, string>;
