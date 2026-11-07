import type { EmptyMap } from './utils.js';
import type { PromptType as ComponentPromptType, PromptFunction, PromptValue } from './prompt.js';
import type { MergedConfig, ProcessedConfig } from './merge.js';
import type { ResolvedConfig } from './provisional.js';
import type { ConfigValue } from './config.js';
import type { Definitions } from './component-map.js';
import type { ExecutionContext, ToolExecutionContext } from './execution.js';

type PreparerKeys = Exclude<Definitions[keyof Definitions]['main'], 'execute' | 'template' | 'script'>;
// Keep native literal contextual types; infer function parameters from application context below.
export type ConfigSourceInferShape<T> = T extends unknown ? { [K in keyof T]: K extends PreparerKeys
	? Exclude<T[K], (...args: never[]) => unknown> | (Extract<T[K], (...args: never[]) => unknown> extends never ? never : CallableFunction) : T[K] } : never;

// The completed owner checks the native result and ordinary/tool context contract.
export type ConfigPreparerContext<T, Mode> = [Mode] extends [never] ? EmptyMap : Mode extends 'function'
	? Partial<Record<PreparerKeys, { prepare(context: ExecutionContext<T> | ToolExecutionContext<T>): unknown }['prepare']>> : EmptyMap;

export type ToolMode<T, Explicit extends boolean> = Explicit extends true ? true
	: true extends ConfigValue<ResolvedConfig<T>, 'asTool'> ? undefined extends ConfigValue<ResolvedConfig<T>, 'asTool'> ? boolean : true : false;
export type ToolModeConfig<T, Explicit extends boolean> = Explicit extends true
	? T extends unknown ? Omit<T, 'asTool'> & { asTool: true } : never : T;
export type SourceMode<T, Explicit, Default> = Explicit extends undefined
	? Exclude<ConfigValue<T, 'promptType'>, undefined> | (undefined extends ConfigValue<T, 'promptType'> ? Default : never) : Explicit;
export type SourceModeConfig<T, Explicit, Default> = T extends unknown
	? Omit<T, 'promptType'> & { promptType: SourceMode<T, Explicit, Default> } : never;

// A fixed mode can override configuration. Only multiple possible modes need branch selection.
export type ConfigForMode<T, Mode, Modes = Mode> = [Modes] extends [Mode] ? T : T extends unknown ? 'promptType' extends keyof T
	? Mode extends T['promptType'] ? T : never : T : never;
// SDK capabilities select their configurations; ordinary calls retain every alternative.
export type ConfigForToolMode<T, Mode extends boolean, Modes = Mode> = [Modes] extends [Mode] ? T : T extends unknown
	? Mode extends ToolMode<T, false> ? T : never : never;

// An omitted parent is distinct from a supplied empty configuration.
export type CallbackParent<Parent> = [Parent] extends [never] ? EmptyMap : Parent;
export type CapturedConfig<Parent, Data> = [Parent] extends [never] ? ProcessedConfig<Data> : MergedConfig<Parent, Data>;
export type FinalConfig<Parent, Config> = [Parent] extends [never] ? ResolvedConfig<Config> : MergedConfig<Parent, ResolvedConfig<Config>>;

export type PromptSource<PromptType extends ComponentPromptType> = PromptType extends 'function'
	? PromptFunction<PromptValue, never> : PromptType extends 'text' | 'async-template' ? PromptValue : string;

// Infer property presence separately from schema values. This preserves optional
// keys in conditional spreads without assuming that their parsers will run.
type SchemaKey = 'inputSchema' | 'schema' | 'toolContextSchema';

type SchemaSetting<T, K extends PropertyKey, S> = NoInfer<T> extends Record<K, unknown>
	? Record<K, S> : Partial<Record<K, S | undefined>>;

export type SchemaConfigInferShape<T, Input, Output, Context> =
	Pick<{ [K in keyof T]: unknown }, keyof T & SchemaKey>
	& SchemaSetting<T, 'inputSchema', Input> & SchemaSetting<T, 'schema', Output> & SchemaSetting<T, 'toolContextSchema', Context>;

export type ConfigSchemas<T, Input, Output, Context, Selected = Pick<T, keyof T & SchemaKey>> = {
	[K in keyof Selected]: K extends 'inputSchema' ? Input : K extends 'schema' ? Output : Context;
};

type RegistryKey = 'tools' | 'toolsContext';
// Optional slots infer values cheaply; present slots also retain a value's
// explicit undefined alternative before callbacks consume the registry.
type RegistrySettings<T, Tools, Contexts> = { tools?: Tools | undefined; toolsContext?: Contexts | undefined }
	& (NoInfer<T> extends { tools: unknown } ? { tools: Tools } : unknown)
	& (NoInfer<T> extends { toolsContext: unknown } ? { toolsContext: Contexts } : unknown);
export type RegistryConfigInferShape<T, Tools, Contexts> = Pick<{ [K in keyof T]: unknown }, keyof T & RegistryKey>
	& RegistrySettings<T, Tools, Contexts>;
export type ConfigRegistry<T, Tools, Contexts, Selected = Pick<T, keyof T & RegistryKey>> = [keyof Selected] extends [never] ? EmptyMap
	: { [K in keyof Selected]: K extends 'tools' ? Tools : Contexts };

export type ConfigData<T, Input, Output, Context, Tools, Contexts, Selected = Pick<T, keyof T & (SchemaKey | RegistryKey)>> = {
	[K in keyof Selected]: K extends 'inputSchema' ? Input : K extends 'schema' ? Output : K extends 'toolContextSchema' ? Context
		: K extends 'tools' ? Tools : Contexts;
};

export type ConfigDataInferShape<T, Input, Output, Context, Tools, Contexts> =
	Pick<{ [K in keyof T]: unknown }, keyof T & (SchemaKey | RegistryKey)>
	& SchemaSetting<T, 'inputSchema', Input> & SchemaSetting<T, 'schema', Output> & SchemaSetting<T, 'toolContextSchema', Context>
	& RegistrySettings<T, Tools, Contexts>;
