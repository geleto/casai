import type { toolMode, SourceModeSetting, StreamModeSetting } from '../config/modifiers.js';
import type { CascadaConfig, ConfigValue, ToolContextSchemaConfig, ToolProperties, ToolRegistry, RuntimeContextFromConfig, ModifierConfig } from './config.js';
import type { SchemaType } from './schema.js';
import type { PromptType } from './prompt.js';
import type { ExecutionContext, ToolExecutionContext } from './execution.js';
import type { CanOmitComponentInput, ComponentInputShape, ValidateComponentInput } from './component-input.js';
import type { ComponentToolFromConfig } from './tool-binding.js';
import type { CallContext, CallContextKeys, CommonInputs, ComponentCall, ComponentRun, ComponentRunSettings, PreparedSourceArguments, RunArgument, SourceSetting, ValidArgumentRoles, WithoutSource } from './input.js';
import type { ConfigForMode, ConfigForToolMode } from './factory-config.js';
import type { EmptyMap, OptionalUndefined } from './utils.js';
import type { ProcessedConfig } from './merge.js';
import type { SchemaInputNames, SchemaOutputObject } from './schema-shape.js';
import type { Definitions, ComponentSettings, PreparedInputs, PreparedInput, TemplateInputs, Results, ToolResults, Components, Configs, RunChecks, CallChecks, CheckedComponent } from './component-map.js';
export type { ComponentSettings } from './component-map.js';

export type ComponentKind = keyof Definitions;
export type AllowedMode<K extends ComponentKind> = Definitions[K]['defaultMode'] | Definitions[K]['modifiers'][keyof Definitions[K]['modifiers']];
export type Main<K extends ComponentKind> = Definitions[K]['main'];
export type NativeInput<K extends ComponentKind, T = unknown, Settings = ComponentSettings<Record<string, unknown>, T>[K]> = Settings extends unknown ? Settings[Main<K> & keyof Settings] : never;
type RequiredConfigKeys<K extends ComponentKind> = Extract<Definitions[K]['required'][number], keyof ComponentSettings[K]>;
type DefinitionKeys<K extends ComponentKind, Field extends string> = Definitions[K] extends Record<Field, readonly (infer Key extends PropertyKey)[]> ? Key : never;
export type RequiredComponentKeys<K extends ComponentKind, P, A extends boolean> = Definitions[K]['required'][number]
	| (P extends `${string}-name` ? 'loader' : DefinitionKeys<K, 'inlineRequired'>)
	| (A extends true ? 'inputSchema' | DefinitionKeys<K, 'toolRequired'> | (P extends 'text' | undefined ? never : Main<K>) : never);
export type Source<K extends ComponentKind, P extends PromptType, T = never, A extends boolean = false, Input = NativeInput<K, [T] extends [never] ? unknown : T>> = P extends 'text' ? Input
	: P extends 'audio-resource' ? import('../audio/preparation.js').AudioSource
	: P extends 'async-template' ? TemplateInputs[K]
	: P extends 'function' ? (context: [T] extends [never] ? never : A extends true ? ToolExecutionContext<T> : ExecutionContext<T>) => PreparedInput<K, Input, T> | PromiseLike<PreparedInput<K, Input, T>> : string;

export type SourceComponentConfig<K extends ComponentKind, P extends PromptType = 'text', T = unknown, Settings = ComponentSettings<Record<string, unknown>, T>[K], SourceContext = unknown> = Settings extends unknown ? OptionalUndefined<
	Omit<Partial<Settings>, Main<K> | 'abortSignal'> & Pick<Settings, RequiredConfigKeys<K> & keyof Settings> & Partial<Record<Main<K>, Source<K, P, SourceContext, false, Settings[Main<K> & keyof Settings]>>>
	& CascadaConfig & ToolContextSchemaConfig & SourceModeSetting<P> & {
		inputSchema?: SchemaType<Record<string, any>>;
		tools?: ToolRegistry; toolsContext?: Record<string, unknown>;
	}> : never;
/** Annotate the selected source and delivery; modifiers still select behavior at construction. */
export type ComponentConfig<K extends ComponentKind, P extends PromptType | undefined = undefined, Delivery extends 'complete' | 'stream' = 'complete'> =
	K extends unknown ? Delivery extends 'complete' | (Definitions[K] extends { asStream: true } ? 'stream' : never)
		? Configs<Extract<P, undefined | AllowedMode<K>>, Delivery extends 'stream' ? true : false>[K] : never : never;
// Inline renderers need source at construction; loaded renderers accept a call-time file name.
export type RendererConfig<K extends 'Template' | 'Script', P extends PromptType> = Omit<ComponentSettings[K], Main<K>> & SourceModeSetting<P | undefined>
	& (P extends `${string}-name` ? Partial<Pick<ComponentSettings[K], Main<K> & keyof ComponentSettings[K]>>
		: Required<Pick<ComponentSettings[K], Main<K> & keyof ComponentSettings[K]>>);
// Inference admits callback parameters provisionally; exported annotations use an actual context.
export type ComponentFactoryShape<K extends ComponentKind, P extends PromptType, A extends boolean, T = unknown> = SourceComponentConfig<K, P, T, ComponentSettings<Record<string, unknown>, T>[K], never>
	& ModifierConfig & (Definitions[K] extends { asStream: true } ? StreamModeSetting : EmptyMap)
	& (A extends true ? Omit<ToolProperties, 'providerOptions'> : EmptyMap);

type SourceOutput<K extends ComponentKind, P extends PromptType, S> = [S] extends [never] ? never : P extends 'function' ? S extends (...args: any[]) => infer R ? Awaited<R> : PreparedInputs[K]
	: P extends 'async-script' | 'async-script-name' ? PreparedInputs[K]
	: P extends 'text' | 'audio-resource' ? S : P extends 'async-template' ? TemplateInputs[K] : string;
export type ConfiguredOutput<K extends ComponentKind, P extends PromptType, T, Modes = P> = P extends unknown ? SourceOutput<K, P, ConfigValue<ConfigForMode<T, P, Modes>, Main<K>>> : never;
export type Configured<T, Key extends PropertyKey> = undefined extends ConfigValue<T, Key> ? false : true;
export type RequiredSetting<T, Key extends PropertyKey, V> = Configured<T, Key> extends true ? Partial<Record<Key, V | undefined>> : Record<Key, V>;
export type AudioFormatArguments<T, Format> = OptionalUndefined<Configured<T, 'inputAudioFormat'> extends true
	? [inputAudioFormat?: Format] : [inputAudioFormat: Format]>;

// On plain tools, an object is payload; structured native source overrides use .run().
type PositionalToolSource<Input> = Input extends import('../audio.js').AudioBufferSource ? AudioBuffer
	: Input extends readonly unknown[] | URL | Blob | ArrayBuffer | ArrayBufferView | ReadableStream<unknown> ? Input : Exclude<Input, object>;
type PlainSource<K extends ComponentKind, T, Input = NativeInput<K, T>> = true extends ConfigValue<T, typeof toolMode> ? PositionalToolSource<Input> : Input;
type PlainInput<K extends ComponentKind, T> = T extends unknown
	? (true extends ConfigValue<T, typeof toolMode> ? PlainToolInput<K, T> : never)
		| (undefined extends ConfigValue<T, typeof toolMode> ? ConfiguredOutput<K, 'text', T> : never) : never;

type LiteralSource<K extends ComponentKind, P, T> = P extends 'audio-resource' ? PlainSource<K, T, import('../audio/preparation.js').AudioSource> : PlainSource<K, T>;
export type SourceArguments<K extends ComponentKind, P extends PromptType, T, Tail extends unknown[] = [],
	HasSource extends boolean = Configured<T, Main<K>>, ConfiguredTail extends unknown[] = Tail> = P extends 'text' | 'audio-resource'
	? [T] extends [{ [toolMode]: true }] ? PreparedSourceArguments<T, LiteralSource<K, P, T>, true, Tail>
		: CanOmitComponentInput<T> extends true ? [input: LiteralSource<K, P, T>, ...Tail] | (HasSource extends true ? [input?: undefined, ...Tail] | WithoutSource<Tail, LiteralSource<K, P, T>> : never) : never
	: PreparedSourceArguments<T, Source<K, P, T>, HasSource, Tail, ConfiguredTail>;

export type SourceSettings<K extends ComponentKind, P extends PromptType, T, HasSource extends boolean = Configured<T, Main<K>>> =
	HasSource extends true ? Partial<Record<Main<K>, Source<K, P, T>>> : [P, T] extends ['text', { [toolMode]: true }]
		? Partial<Record<Main<K>, Source<K, P, T>>> : Record<Main<K>, Source<K, P, T>>;
export type BaseRunSettings<K extends ComponentKind, T, Inputs, Settings = ComponentSettings<RuntimeContextFromConfig<T>, T>[K]> = ComponentRunSettings<T,
	import('./utils.js').DistributiveOmit<Partial<Settings>, Main<K> | DefinitionKeys<K, 'fixedSettings'>> & Inputs>;

type CallInput<K extends ComponentKind, P extends PromptType, T, Args extends unknown[], First = Args[0], Modes = P> = P extends 'text'
	? First extends PlainSource<K, T> ? First : PlainInput<K, ConfigForMode<T, P, Modes>>
	: First extends Source<K, P> ? SourceOutput<K, P, First> : ConfiguredOutput<K, P, T, Modes>;
export type RunInput<K extends ComponentKind, P extends PromptType, T, Run, Input = ConfigValue<Run, Main<K>>, Modes = P> =
	SourceOutput<K, P, Exclude<Input, undefined>> | (undefined extends Input ? P extends 'text'
		? PlainInput<K, ConfigForMode<T, P, Modes>> : ConfiguredOutput<K, P, T, Modes> : never);

type TailForFirst<Allowed extends unknown[], First> = unknown extends First ? [] : Allowed extends [unknown?, ...infer Rest] ? First extends Allowed[0] ? Rest : never : never;
// Native sources must match their positional role, not a broad context-object slot.
type SourceArgumentRoles = ((...args: never[]) => unknown) | URL | Blob | AudioBuffer | ArrayBuffer | ArrayBufferView | Iterable<unknown> | AsyncIterable<unknown> | ReadableStream<unknown>;
type ValidCall<P, Allowed extends unknown[], First, Rest extends unknown[]> = First extends unknown
	? P extends 'text' | 'audio-resource' ? [First, ...Rest] extends Allowed ? true : false
		: ValidArgumentRoles<Allowed, First, Rest, SourceArgumentRoles> : never;
// Resolve source and secondary inputs within the same configuration/call alternative.
type CallResult<K extends ComponentKind, P extends PromptType, T, Call = undefined> = K extends unknown ? T extends unknown ? Call extends unknown
	? Results<T, Call extends unknown[] ? CallInput<K, P, T, Call> : RunInput<K, P, T, Call>, Call>[K] : never : never : never;
type CallCases<P extends PromptType> = Record<P, { arguments: unknown[]; settings: unknown }>;

// Resolve inputs within each configuration branch, then require every branch's checks.
type CallInputChecks<K extends CheckedComponent<'callCheck'>, P extends PromptType, T, Args extends unknown[]> = T extends unknown
	? (check: CallChecks<P, T, CallInput<K, P, T, Args>, Args>[K]) => void : never;
type CheckCallInput<K extends ComponentKind, P extends PromptType, T, Args extends unknown[]> =
	K extends CheckedComponent<'callCheck'> ? CallInputChecks<K, P, T, Args> extends (check: infer Check) => void ? Check : never : unknown;
type CheckCall<P extends PromptType, T, Cases extends CallCases<P>, First, Rest extends unknown[], Keys extends PropertyKey, ObjectSource extends boolean> = number extends Rest['length'] ? unknown : CommonInputs<{
	[M in P]: false extends ValidCall<M, Cases[M]['arguments'], First, Rest> ? never : M extends 'text' | 'audio-resource'
		? [ConfigForMode<T, M, P>] extends [{ [toolMode]: true }]
			? ValidateComponentInput<ConfigForMode<T, M, P>, CallContext<[First, ...Rest]>, CallContextKeys<[First, ...Rest], Keys>> : unknown
		: ValidateComponentInput<ConfigForMode<T, M, P>, CallContext<[First, ...Rest], ObjectSource>, CallContextKeys<[First, ...Rest], Keys, ObjectSource>>
}>;
type CallSignature<K extends ComponentKind, P extends PromptType, T, Cases extends CallCases<P>, Allowed extends unknown[], ObjectSource extends boolean, Head = Allowed[0]> =
	([] extends Allowed & CheckCallInput<K, P, T, []> ? () => Promise<CallResult<K, P, T>> : unknown)
	& (<First extends Head, Rest extends unknown[] = [], Keys extends PropertyKey = never>(
		first: First & (Partial<Record<Keys, unknown>> | Exclude<SourceArgumentRoles, (...args: never[]) => unknown> | undefined), ...rest: Rest & NoInfer<TailForFirst<Allowed, First>
		& CheckCall<P, T, Cases, First, Rest, Keys, ObjectSource> & CheckCallInput<K, P, T, [First, ...Rest]>>
	) => Promise<CallResult<K, P, T, [First, ...Rest]>>)
	& ([P] extends ['text' | 'audio-resource'] ? true extends ConfigValue<T, typeof toolMode> ? unknown : (...args: Allowed & CheckCallInput<K, P, T, Allowed>) => Promise<CallResult<K, P, T, Allowed>> : unknown);
// Contextualize distinct source functions without duplicating their argument-tail variants.
type SourceCalls<K extends ComponentKind, P extends PromptType, T, Cases extends CallCases<P>, Allowed extends unknown[], ObjectSource extends boolean,
	Head = Extract<Allowed[0], (...args: never[]) => unknown>> = Head extends unknown
	? (signature: CallSignature<K, P, T, Cases, Allowed, ObjectSource, Head>) => void : never;
type Call<K extends ComponentKind, P extends PromptType, T, Cases extends CallCases<P>, Allowed extends unknown[], ObjectSource extends boolean> =
	// Infer context and preparer callbacks in their own roles; retain the general signature for forwarding unions.
	([P] extends ['text'] ? unknown : CallSignature<K, P, T, Cases, Allowed, ObjectSource, ComponentInputShape<T>>)
	& ([P] extends ['function'] ? SourceCalls<K, P, T, Cases, Allowed, ObjectSource> extends (signature: infer Signature) => void ? Signature : never : unknown)
	& CallSignature<K, P, T, Cases, Allowed, ObjectSource>;
type RunChecksForBranches<K extends CheckedComponent<'runCheck'>, P extends PromptType, T, R> = T extends unknown ? R extends unknown
	? (check: CommonInputs<{ [M in P]: RunChecks<M, ConfigForMode<T, M, P>, R>[K] }>) => void : never : never;
type CheckRun<K extends ComponentKind, P extends PromptType, T, R> = K extends CheckedComponent<'runCheck'>
	? RunChecksForBranches<K, P, T, R> extends (check: infer Check) => void ? Check : never : unknown;
type Run<K extends ComponentKind, P extends PromptType, T, Settings> =
	(EmptyMap extends Settings & CheckRun<K, P, T, EmptyMap> ? () => Promise<CallResult<K, P, T>> : unknown)
	& (<R extends object | undefined, Keys extends PropertyKey = never, ContextKeys extends PropertyKey = never>(
		settings: RunArgument<T, Settings, R, Keys, ContextKeys> & NoInfer<CheckRun<K, P, T, R>>
	) => Promise<CallResult<K, P, T, R>>);

type PlainToolInput<K extends ComponentKind, T, Input = Main<K> extends SchemaInputNames<ConfigValue<T, 'inputSchema'>>
	? ConfigValue<SchemaOutputObject<ConfigValue<T, 'inputSchema'>>, Main<K>> : undefined> =
	Exclude<Input, undefined> | (undefined extends Input ? ConfigValue<T, Main<K>> : never);
export type ToolInput<K extends ComponentKind, P extends PromptType, T> = {
	[M in P]: M extends 'text' ? PlainToolInput<K, ConfigForMode<T, M, P>> : ConfiguredOutput<K, M, ConfigForMode<T, M, P>>
}[P];
export type ToolResultFromConfig<K extends ComponentKind, P extends PromptType, T> = K extends unknown ? T extends unknown ? ToolResults<T, ToolInput<K, P, T>>[K] : never : never;
export type CallableComponent<K extends ComponentKind, P extends PromptType, T, A extends boolean, Cases extends CallCases<P>, ObjectSource extends boolean = false,
	Common extends { arguments: unknown[]; settings: unknown } = Extract<CommonInputs<Cases>, { arguments: unknown[]; settings: unknown }>, ToolConfig = ConfigForToolMode<T, true, A>> =
	Call<K, P, T, Cases, Common['arguments'], ObjectSource> & { readonly config: ProcessedConfig<T>; readonly run: Run<K, P, T, Common['settings']> }
	& (A extends true ? ComponentToolFromConfig<Record<string, any>, ToolResultFromConfig<K, P, ToolConfig>, ToolConfig> : EmptyMap);
interface StandardCalls<K extends ComponentKind, P extends PromptType, T, Tail extends unknown[]> {
	arguments: SourceArguments<K, P, T, Tail>;
	settings: BaseRunSettings<K, T, SourceSettings<K, P, T>>;
}
export type StandardComponent<K extends ComponentKind, P extends PromptType, T, A extends boolean, Tail extends unknown[] = []> =
	CallableComponent<K, P, T, A, { [M in P]: StandardCalls<K, M, ConfigForMode<T, M, P>, Tail> }>;
export type RendererComponent<K extends 'Template' | 'Script', T, A extends boolean, ToolConfig = ConfigForToolMode<T, true, A>> =
	ComponentCall<PreparedSourceArguments<T, string, [T] extends [Record<Main<K>, string>] ? true : false>, Promise<Results<T, never>[K]>, false, T>
	& { readonly config: ProcessedConfig<T>; readonly run: ComponentRun<T, Results<T, never>[K], SourceSetting<T, Main<K>>> }
	& (A extends true ? ComponentToolFromConfig<Record<string, any>, ToolResults<ToolConfig, never>[K], ToolConfig> : EmptyMap);
// Expand the callable signature after its component kind is known.
export type Component<K extends ComponentKind, P extends PromptType, T, A extends boolean = false> = K extends unknown ? Components<P, T, A>[K] : never;
