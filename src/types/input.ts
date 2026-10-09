import type { DeclaredType } from './config.js';
import type { EmptyMap } from './merge.js';
import type { InferContextInputSchema, InputWithContext } from './types.js';
import type { ContextOf } from './function-config.js';
import type { ModelMessage } from 'ai';

// Input schemas validate call-time input before configured context is merged.
export type ConfiguredCallContext<TConfig, INPUT, CONTEXT = NonNullable<ContextOf<TConfig>>> = [CONTEXT] extends [never]
	? EmptyMap : Partial<Omit<CONTEXT, keyof INPUT>>;

type WidenPrimitive<T> = T extends string ? string : T extends number ? number
	: T extends boolean ? boolean : T extends bigint ? bigint : T extends symbol ? symbol : T;
type WidenContextValue<T> = T extends (...args: never[]) => unknown ? T
	: T extends Date | RegExp | ReadonlyMap<unknown, unknown> | ReadonlySet<unknown> | PromiseLike<unknown> ? T
	: T extends readonly (infer ELEMENT)[] ? readonly WidenContextValue<ELEMENT>[]
	: T extends object ? { [K in keyof T]: WidenContextValue<T[K]> } : WidenPrimitive<T>;
type RendererContext<T> = { [K in keyof T]: WidenContextValue<T[K]> };
// Text renderers have runtime defaults; JavaScript callbacks retain their declared accepted values.
type CallConfiguredContext<TConfig> = [Extract<DeclaredType<TConfig, 'prompt'>, (...args: never[]) => unknown>] extends [never]
	? RendererContext<NonNullable<ContextOf<TConfig>>> : NonNullable<ContextOf<TConfig>>;
export type CallContext<TConfig> = InputWithContext<InferContextInputSchema<DeclaredType<TConfig, 'inputSchema'>>, CallConfiguredContext<TConfig>, DeclaredType<TConfig, 'inputSchema'>, true, true>;

export type ContextArguments<TConfig, INPUT = CallContext<TConfig>> = EmptyMap extends CallContext<TConfig>
	? [context?: INPUT]
	: [context: INPUT];

// Arrays are dispatched as messages and functions cannot serve as context objects.
export type ValidateContextValue<T> = 0 extends (1 & T) ? unknown
	: [Extract<T, readonly unknown[] | ((...args: never[]) => unknown)>] extends [never] ? unknown : never;

type RendererArguments<TConfig, Key extends string> = TConfig extends Record<Key, string>
	? (EmptyMap extends CallContext<TConfig> ? [promptOrContext?: string | CallContext<TConfig>] : ContextArguments<TConfig>)
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

// Reflection sees an uninstantiated rest array; actual calls infer finite tuples and receive validation.
type ValidateArguments<TArgs extends unknown[], TAllowed, Messages extends boolean> = number extends TArgs['length'] ? unknown
	: [TArgs] extends [TAllowed] ? Messages extends true ? ValidateMessageArguments<TArgs> : ValidateRendererArguments<TArgs> : never;
type TailForFirst<TAllowed extends unknown[], TFirst> = TAllowed extends [unknown?, ...infer REST]
	? [TFirst] extends [TAllowed[0]] ? REST : never : never;

// A syntactic first parameter preserves required input when TypeScript combines component unions.
export type ComponentCall<TAllowed extends unknown[], TResult, Messages extends boolean = false> = [] extends TAllowed
	? <TFirst = undefined, TRest extends unknown[] = []>(first?: TFirst & NoInfer<TAllowed[0] & ValidateArguments<[TFirst, ...TRest], TAllowed, Messages>>, ...rest: TRest & NoInfer<TailForFirst<TAllowed, TFirst>>) => TResult
	: <TFirst = undefined, TRest extends unknown[] = []>(first: TFirst & NoInfer<TAllowed[0] & ValidateArguments<[TFirst, ...TRest], TAllowed, Messages>>, ...rest: TRest & NoInfer<TailForFirst<TAllowed, TFirst>>) => TResult;

// One signature keeps unions of renderer families callable with their common arguments.
export type RendererCall<TConfig, TResult, Key extends string> =
	ComponentCall<RendererArguments<TConfig, Key>, TResult>;

// A one-off run must supply required input too; configured context cannot replace it.
export type RunContext<TConfig> = EmptyMap extends CallContext<TConfig>
	? { context?: CallContext<TConfig> }
	: { context: CallContext<TConfig> };
