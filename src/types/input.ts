import type { EmptyMap, IsUnion, NonArrayObject, OptionalUndefined, UnionKeys } from './utils.js';
import type { ValidateRunConfig } from './config-validation.js';
import type { ComponentExecutionOptions } from './sdk.js';
import type { ToolContexts } from './tool-binding.js';
import type { ToolRegistryFromConfig } from './config.js';
import type { ModelMessage } from 'ai';
import type { ComponentInputShape, CanOmitComponentInput, ValidateComponentInput } from './component-input.js';

// Intersect contracts, preserving the alternative call forms inside each contract.
export type CommonInputs<T> = IsUnion<keyof T> extends false ? T[keyof T]
	: { [K in keyof T]: (input: T[K]) => void }[keyof T] extends (input: infer Input) => void ? Input : never;

export type ContextArguments<TConfig, INPUT = ComponentInputShape<TConfig>> = CanOmitComponentInput<TConfig> extends true
	? [context?: INPUT | undefined]
	: [context: INPUT];

// Structural object types also admit arrays/functions; call syntax gives those their own roles.
export type ValidateArgumentValue<T, Allowed, Roles = readonly unknown[] | ((...args: never[]) => unknown)> = 0 extends (1 & T) ? unknown
	: [Extract<T, Roles>] extends [Extract<Allowed, Roles>] ? unknown : never;
export type ValidateContextValue<T> = ValidateArgumentValue<T, object>;

type MatchingArguments<Allowed extends unknown[], Args extends unknown[], Roles> = Allowed extends unknown ? Args extends Allowed
	? ValidateArgumentValue<Args[0], Allowed[0], Roles> & ValidateArgumentValue<Args[1], Allowed[1], Roles> : never : never;
export type ValidArgumentRoles<Allowed extends unknown[], First, Rest extends unknown[], Roles = readonly unknown[] | ((...args: never[]) => unknown)> = First extends unknown
	? Rest extends unknown ? [MatchingArguments<Allowed, [First, ...Rest], Roles>] extends [never] ? false : true : never : never;

// An object record in the first remaining slot is context. Binary media and arrays
// have distinct runtime roles and can still omit that slot.
type WithoutContext<Tail extends unknown[]> = { [I in keyof Tail]: I extends '0'
	? Exclude<Tail[I], object> | Extract<Tail[I], readonly unknown[] | ArrayBuffer | ArrayBufferView> : Tail[I] };
type ContextObject<T> = NonArrayObject<Exclude<T, URL | ArrayBuffer | ArrayBufferView>>;
type ContextTail<T, Tail extends unknown[], SourceOmitted extends boolean = false> =
	[ContextObject<Tail[0]>] extends [never]
	? [...ContextArguments<T>, ...Tail] | (CanOmitComponentInput<T> extends true ? Tail : never)
	: [...(SourceOmitted extends true ? [context: ComponentInputShape<T>] : ContextArguments<T>), ...Tail]
	| (CanOmitComponentInput<T> extends true ? WithoutContext<Tail> : never);
export type PreparedSourceArguments<T, Source, HasSource extends boolean, Tail extends unknown[] = [], ConfiguredTail extends unknown[] = Tail> =
	// A configured preparer can supply secondary inputs that a replacement source must supply separately.
	[source: Source | (HasSource extends true ? undefined : never), ...ContextTail<T, Tail>]
	| (HasSource extends true ? ContextTail<T, ConfiguredTail, true> | [source: undefined, ...ContextTail<T, ConfiguredTail>] : never);

type ValidateRendererArguments<TArgs extends unknown[]> = TArgs extends [infer FIRST, ...infer REST]
	? [FIRST] extends [string | undefined] ? ValidateContextValue<REST[0]> : ValidateContextValue<FIRST> : unknown;

type ValidateMessageArgument<T> = [Extract<T, readonly unknown[]>] extends [readonly ModelMessage[]] ? unknown : never;
type ContextValue<T> = [ContextObject<T>] extends [never] ? EmptyMap : ContextObject<T>;
type NonContextArgument = string | readonly unknown[] | ((...args: never[]) => unknown) | URL | ArrayBuffer | ArrayBufferView | undefined;
export type CallContext<Args extends unknown[], ObjectSource extends boolean = false, First = Args[0]> =
	First extends NonContextArgument ? ContextValue<Args[1]>
	: ObjectSource extends true ? [ContextObject<Args[1]>] extends [never] ? ContextValue<First> : ContextValue<Args[1]>
	: ContextValue<First>;

export type CallContextKeys<Args extends unknown[], FirstKeys extends PropertyKey, ObjectSource extends boolean = false> =
	[Exclude<Args[0], NonContextArgument>] extends [never]
		? UnionKeys<CallContext<Args, ObjectSource>> : ObjectSource extends true
			? [ContextObject<Args[1]>] extends [never] ? FirstKeys : UnionKeys<CallContext<Args, ObjectSource>> : FirstKeys;

// Reflection sees an uninstantiated rest array; actual calls infer finite tuples and receive validation.
type ValidateArguments<TArgs extends unknown[], TAllowed extends unknown[], Messages extends false | 'agent', TConfig, FirstKeys extends PropertyKey> = number extends TArgs['length'] ? unknown
	: (Messages extends 'agent'
		? (false extends (TArgs extends [infer First, ...infer Rest] ? ValidArgumentRoles<TAllowed, First, Rest> : true) ? never : unknown)
			& ValidateMessageArgument<TArgs[0]> & ValidateMessageArgument<TArgs[1]> & ValidateMessageArgument<TArgs[2]> & ValidateContextValue<CallContext<TArgs>>
		: [TArgs] extends [TAllowed] ? ValidateRendererArguments<TArgs> : never) &
	([TConfig] extends [never] ? unknown : ValidateComponentInput<TConfig, CallContext<TArgs>, CallContextKeys<TArgs, FirstKeys>>);
type ArgumentTail<TAllowed extends unknown[]> = TAllowed extends [unknown?, ...infer Rest] ? Rest : never;

// Capture supplied keys separately: contextual callbacks can infer a partial
// schema shape, but omitted configured fields must not become supplied input.
export type ComponentCallSignature<TAllowed extends unknown[], TResult, Messages extends false | 'agent', TConfig, Cases extends Record<string, unknown[]>> =
	([] extends TAllowed ? () => TResult : unknown)
	& (<First extends TAllowed[0], Rest extends unknown[] = [], K extends PropertyKey = never>(first: First & (Partial<Record<K, unknown>> | Exclude<NonContextArgument, (...args: never[]) => unknown>),
		...rest: Rest & NoInfer<ArgumentTail<TAllowed> & CommonInputs<{ [M in keyof Cases]: ValidateArguments<[First, ...Rest], Cases[M], Messages, TConfig, K> }>>) => TResult);

type CallSignatures<TAllowed extends unknown[], TResult, Messages extends false | 'agent', TConfig, Cases extends Record<string, unknown[]>> = TAllowed extends unknown
	? (signature: ComponentCallSignature<TAllowed, TResult, Messages, TConfig, Cases>) => void : never;
export type ComponentCall<TAllowed extends unknown[], TResult, Messages extends false | 'agent' = false, TConfig = never, Cases extends Record<string, unknown[]> = { call: TAllowed }> =
	CallSignatures<TAllowed, TResult, Messages, TConfig, Cases> extends (signature: infer Signature) => void ? Signature : never;

// Named calls use the same configured-default completeness check as shorthand.
export type RunContext<TConfig> = CanOmitComponentInput<TConfig> extends true
	? { context?: ComponentInputShape<TConfig> }
	: { context: ComponentInputShape<TConfig> };

export type ComponentCaller<TConfig, TResult> = ComponentCall<ContextArguments<TConfig>, Promise<TResult>, false, TConfig>;

// Capture supplied keys independently of callback inference.
export type RunArgument<Config, Settings, Run, Keys extends PropertyKey, ContextKeys extends PropertyKey> =
	Run & NoInfer<Settings | (EmptyMap extends Settings ? undefined : never)>
	& ([Run] extends [undefined] ? unknown : Partial<Record<Keys, unknown>>
		& { context?: Partial<Record<ContextKeys, unknown>> | undefined }
		& ValidateRunConfig<Run, Config, Settings, Keys, ContextKeys>);

type ComponentRunSignature<TConfig, TResult, TSettings> =
	(EmptyMap extends TSettings ? () => Promise<TResult> : unknown)
	& (<Run extends object | undefined, Keys extends PropertyKey = never, ContextKeys extends PropertyKey = never>(
		options: RunArgument<TConfig, TSettings, Run, Keys, ContextKeys>) => Promise<TResult>);

export type ComponentRunSettings<TConfig, TSettings> = OptionalUndefined<TSettings & RunContext<TConfig>
	& Pick<ComponentExecutionOptions, 'abortSignal'> & { toolsContext?: Partial<ToolContexts<ToolRegistryFromConfig<TConfig>>> }>;
export type ComponentRun<TConfig, TResult, TSettings = EmptyMap> = ComponentRunSignature<TConfig, TResult, ComponentRunSettings<TConfig, TSettings>>;

export type SourceSetting<TConfig, TSourceKey extends string> = [TConfig] extends [Record<TSourceKey, string>] ? Partial<Record<TSourceKey, string>> : Record<TSourceKey, string>;
