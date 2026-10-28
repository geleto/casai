import type { EmptyMap } from './utils.js';
import type { PromptType as ComponentPromptType, PromptFunction, PromptValue } from './prompt.js';
import type { MergedConfig } from './merge.js';
import type { ResolvedConfig } from './provisional.js';
import type { ConfigValue } from './config.js';

export type ToolMode<T, Explicit extends boolean> = Explicit extends true ? true
	: true extends ConfigValue<ResolvedConfig<T>, 'asTool'> ? undefined extends ConfigValue<ResolvedConfig<T>, 'asTool'> ? boolean : true : false;
export type ToolModeConfig<T, Explicit extends boolean> = Explicit extends true
	? T extends unknown ? Omit<T, 'asTool'> & { asTool: true } : never : T;
export type SourceMode<T, Explicit, Default> = Explicit extends undefined
	? Exclude<ConfigValue<T, 'promptType'>, undefined> extends never ? Default : Exclude<ConfigValue<T, 'promptType'>, undefined> : Explicit;
export type SourceModeConfig<T, Explicit, Default> = T extends unknown
	? Omit<T, 'promptType'> & { promptType: SourceMode<T, Explicit, Default> } : never;

// An omitted parent is distinct from a supplied empty configuration.
export type CallbackParent<Parent> = [Parent] extends [never] ? EmptyMap : Parent;
export type FinalConfig<Parent, Config> = [Parent] extends [never] ? Config : MergedConfig<Parent, ResolvedConfig<Config>>;

export type PromptSource<PromptType extends ComponentPromptType> = PromptType extends 'function'
	? PromptFunction<PromptValue, never> : PromptType extends 'text' ? PromptValue : string;

// Infer property presence separately from schema values. This preserves optional
// keys in conditional spreads without assuming that their parsers will run.
type SchemaKey = 'inputSchema' | 'schema' | 'toolContextSchema';

type SchemaSetting<T, K extends SchemaKey, S> = EmptyMap extends Pick<NoInfer<T>, keyof T & K>
	? Partial<Record<K, S>> : Record<K, S>;

export type SchemaConfigInferShape<T, Input, Output, Context> =
	Pick<{ [K in keyof T]: unknown }, keyof T & SchemaKey>
	& SchemaSetting<T, 'inputSchema', Input> & SchemaSetting<T, 'schema', Output> & SchemaSetting<T, 'toolContextSchema', Context>;

export type ConfigSchemas<T, Input, Output, Context> = Pick<{
	[K in keyof T]: K extends 'inputSchema' ? Input : K extends 'schema' ? Output : Context;
}, keyof T & SchemaKey>;
