import type { DeclaredType } from './config.js';
import type { EmptyMap } from './merge.js';
import type { InferContextInputSchema, InputWithContext } from './types.js';
import type { ContextOf } from './function-config.js';

// Input schemas validate call-time input before configured context is merged.
export type ConfiguredCallContext<TConfig, INPUT, CONTEXT = NonNullable<ContextOf<TConfig>>> = [CONTEXT] extends [never]
	? EmptyMap : Partial<Omit<CONTEXT, keyof INPUT>>;

type WidenPrimitive<T> = T extends string ? string : T extends number ? number
	: T extends boolean ? boolean : T extends bigint ? bigint : T extends symbol ? symbol : T;
type RendererContext<T> = { [K in keyof T]: WidenPrimitive<T[K]> };
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

export type RendererCall<TConfig, TResult, Key extends string> = TConfig extends Record<Key, string>
	? {
		(...args: EmptyMap extends CallContext<TConfig> ? [promptOrContext?: string | CallContext<TConfig>] : ContextArguments<TConfig>): TResult;
		(prompt: string, ...args: ContextArguments<TConfig>): TResult;
	}
	: (prompt: string, ...args: ContextArguments<TConfig>) => TResult;

// A one-off run must supply required input too; configured context cannot replace it.
export type RunContext<TConfig> = EmptyMap extends CallContext<TConfig>
	? { context?: CallContext<TConfig> }
	: { context: CallContext<TConfig> };
