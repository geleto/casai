import type { EmptyMap } from './utils.js';
import type { PromptType as ComponentPromptType, PromptFunction, PromptValue, TemplatePromptType, ScriptPromptType, TextPromptType, AnyPromptSource } from './prompt.js';
import type { SchemaType } from './schema.js';
import type { ToolSet } from 'ai';
import type { MergedConfig } from './merge.js';
import type { ResolvedConfig } from './provisional.js';
import type { ObjectOutputMode } from './sdk.js';
import type * as configs from './config.js';

// An omitted parent is distinct from a supplied empty configuration.
export type CallbackParent<Parent> = [Parent] extends [never] ? EmptyMap : Parent;
export type FinalConfig<Parent, Config> = [Parent] extends [never] ? Config : MergedConfig<Parent, ResolvedConfig<Config>>;

export type PromptSource<PromptType extends ComponentPromptType> = PromptType extends 'function'
	? PromptFunction : PromptType extends 'text' ? PromptValue : string;

type PromptSettings<PromptType extends ComponentPromptType> = PromptType extends TemplatePromptType
	? configs.TemplatePromptConfig : PromptType extends ScriptPromptType ? configs.ScriptPromptConfig
	: PromptType extends 'function' ? configs.FunctionPromptConfig : EmptyMap;

export type PromptConfig<PromptType extends ComponentPromptType, AsTool extends boolean = false> = PromptSettings<PromptType>
	& (PromptType extends `${string}-name` ? configs.LoaderConfig : EmptyMap)
	& (AsTool extends true ? configs.ToolConfig<Record<string, any>, unknown> : EmptyMap);

type PromptInput<PromptType extends ComponentPromptType, AsTool extends boolean> =
	PromptType extends TextPromptType ? AsTool extends true ? Record<string, any> : never : Record<string, any>;

export type TextFactoryConfig<PromptType extends ComponentPromptType, AsTool extends boolean = false, Streaming extends boolean = false> =
	(Streaming extends true ? configs.StreamTextConfig<ToolSet, PromptInput<PromptType, AsTool>, PromptSource<PromptType>>
		: configs.GenerateTextConfig<ToolSet, PromptInput<PromptType, AsTool>, PromptSource<PromptType>>) & PromptConfig<PromptType, AsTool>;

export type ObjectFactoryConfig<PromptType extends ComponentPromptType, AsTool extends boolean = false,
	Streaming extends boolean = false, Enum extends string = string> =
	(Streaming extends true ? configs.StreamObjectConfig<PromptInput<PromptType, AsTool>, unknown, PromptSource<PromptType>>
		: configs.GenerateObjectConfig<PromptInput<PromptType, AsTool>, unknown, Enum, PromptSource<PromptType>>) & PromptConfig<PromptType, AsTool>;

export type ObjectConfigMode<Config> = Config extends { output: 'array' } ? 'array'
	: Config extends { output: 'enum' } ? 'enum'
	: Config extends { output: 'no-schema' } ? 'no-schema' : 'object';

// Select from the existing native-derived contracts instead of maintaining another mode map.
export type ObjectConfigForMode<Mode extends ObjectOutputMode, Streaming extends boolean = false> = Extract<
	Streaming extends true ? configs.StreamObjectConfig<Record<string, any>, unknown, AnyPromptSource>
		: configs.GenerateObjectConfig<Record<string, any>, unknown, string, AnyPromptSource>,
	{ output?: Mode | undefined }>;

// Run settings require a known mode; complete configuration alternatives retain their correlations.
export type ObjectOutputConfig<Config, Streaming extends boolean = false> = Config extends unknown
	? configs.ConfigValue<Config, 'output'> extends ObjectConfigMode<Config> | undefined
		? ObjectConfigMode<Config> extends 'object'
			? Config extends { schema: SchemaType<unknown> } ? ObjectConfigForMode<'object', Streaming> : never
			: ObjectConfigForMode<ObjectConfigMode<Config>, Streaming>
		: never : never;

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
