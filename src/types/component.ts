import type { sourceMode } from '../config/source-mode.js';
import type { CascadaConfig, ConfigValue, ToolContextSchemaConfig, ToolProperties, ToolRegistry, RuntimeContextFromConfig, ModifierConfig } from './config.js';
import type { SchemaType } from './schema.js';
import type { PromptType } from './prompt.js';
import type { ExecutionContext, ToolExecutionContext } from './execution.js';
import type { CanOmitComponentInput, ComponentInputShape, ValidateComponentInput } from './component-input.js';
import type { ComponentToolFromConfig } from './tool-binding.js';
import type { CallContext, CallContextKeys, CommonInputs, ComponentCall, ComponentRun, ComponentRunSettings, PreparedSourceArguments, RunArgument, SourceSetting, ValidArgumentRoles } from './input.js';
import type { ConfigForMode, ConfigForToolMode } from './factory-config.js';
import type { EmptyMap, OptionalUndefined } from './utils.js';
import type { ProcessedConfig } from './merge.js';
import type { SchemaInputNames, SchemaOutputObject } from './schema-shape.js';
import type { Definitions, ComponentSettings, PreparedInputs, TemplateInputs, Results, ToolResults, Components, Configs, RunChecks } from './component-map.js';
export type { ComponentSettings } from './component-map.js';

export type ComponentKind = keyof Definitions;
export type Main<K extends ComponentKind> = Definitions[K]['main'];
export type NativeInput<K extends ComponentKind> = ComponentSettings[K][Main<K> & keyof ComponentSettings[K]];
type RequiredConfigKeys<K extends ComponentKind> = Extract<Definitions[K]['required'][number], keyof ComponentSettings[K]>;
type DefinitionKeys<K extends ComponentKind, Field extends string> = Definitions[K] extends Record<Field, readonly (infer Key extends PropertyKey)[]> ? Key : never;
export type RequiredComponentKeys<K extends ComponentKind, P, A extends boolean> = Definitions[K]['required'][number]
	| (P extends `${string}-name` ? 'loader' : DefinitionKeys<K, 'inlineRequired'>)
	| (A extends true ? 'inputSchema' | DefinitionKeys<K, 'toolRequired'> | (P extends 'text' | undefined ? never : Main<K>) : never);
export type Source<K extends ComponentKind, P extends PromptType, T = never, A extends boolean = false> = P extends 'text' ? NativeInput<K>
	: P extends 'async-template' ? TemplateInputs[K]
	: P extends 'function' ? (context: [T] extends [never] ? never : A extends true ? ToolExecutionContext<T> : ExecutionContext<T>) => PreparedInputs[K] | PromiseLike<PreparedInputs[K]> : string;

export type SourceComponentConfig<K extends ComponentKind, P extends PromptType = 'text'> = OptionalUndefined<
	Omit<Partial<ComponentSettings[K]>, Main<K> | 'abortSignal'> & Pick<ComponentSettings[K], RequiredConfigKeys<K>> & Partial<Record<Main<K>, Source<K, P>>>
	& CascadaConfig & ToolContextSchemaConfig & {
		inputSchema?: SchemaType<Record<string, any>>;
		tools?: ToolRegistry; toolsContext?: Record<string, unknown>; [sourceMode]?: P;
	}>;
export type ComponentConfig<K extends ComponentKind, P extends PromptType = 'text'> = K extends unknown ? Configs<P>[K] : never;
export type ComponentFactoryShape<K extends ComponentKind, P extends PromptType, A extends boolean> = SourceComponentConfig<K, P>
	& ModifierConfig & (A extends true ? Omit<ToolProperties, 'providerOptions'> : EmptyMap);

type SourceOutput<K extends ComponentKind, P extends PromptType, S> = [S] extends [never] ? never : P extends 'function' ? S extends (...args: any[]) => infer R ? Awaited<R> : PreparedInputs[K]
	: P extends 'async-script' | 'async-script-name' ? PreparedInputs[K]
	: P extends 'text' ? S : P extends 'async-template' ? TemplateInputs[K] : string;
export type ConfiguredOutput<K extends ComponentKind, P extends PromptType, T, Modes = P> = P extends unknown ? SourceOutput<K, P, ConfigValue<ConfigForMode<T, P, Modes>, Main<K>>> : never;
export type Configured<T, Key extends PropertyKey> = undefined extends ConfigValue<T, Key> ? false : true;
export type RequiredSetting<T, Key extends PropertyKey, V> = Configured<T, Key> extends true ? Partial<Record<Key, V | undefined>> : Record<Key, V>;
export type AudioFormatArguments<T, Format> = OptionalUndefined<Configured<T, 'inputAudioFormat'> extends true
	? [inputAudioFormat?: Format] : [inputAudioFormat: Format]>;

// On plain tools, an object is payload; structured native source overrides use .run().
type PlainSource<K extends ComponentKind, T> = true extends ConfigValue<T, 'asTool'>
	? Exclude<NativeInput<K>, object> | Extract<NativeInput<K>, readonly unknown[] | URL | ArrayBuffer | ArrayBufferView> : NativeInput<K>;
type PlainInput<K extends ComponentKind, T> = T extends unknown
	? (true extends ConfigValue<T, 'asTool'> ? PlainToolInput<K, T> : never)
		| (undefined extends ConfigValue<T, 'asTool'> ? ConfiguredOutput<K, 'text', T> : never) : never;

export type SourceArguments<K extends ComponentKind, P extends PromptType, T, Tail extends unknown[] = [],
	HasSource extends boolean = Configured<T, Main<K>>, ConfiguredTail extends unknown[] = Tail> = P extends 'text'
	? [T] extends [{ asTool: true }] ? PreparedSourceArguments<T, PlainSource<K, T>, true, Tail>
		: CanOmitComponentInput<T> extends true ? [input: PlainSource<K, T>, ...Tail] | (HasSource extends true ? [input?: undefined, ...Tail] | Tail : never) : never
	: PreparedSourceArguments<T, Source<K, P, T>, HasSource, Tail, ConfiguredTail>;

export type SourceSettings<K extends ComponentKind, P extends PromptType, T, HasSource extends boolean = Configured<T, Main<K>>> =
	HasSource extends true ? Partial<Record<Main<K>, Source<K, P, T>>> : [P, T] extends ['text', { asTool: true }]
		? Partial<Record<Main<K>, Source<K, P, T>>> : Record<Main<K>, Source<K, P, T>>;
export type BaseRunSettings<K extends ComponentKind, T, Inputs> = ComponentRunSettings<T,
	Omit<Partial<ComponentSettings<RuntimeContextFromConfig<T>>[K]>, Main<K> | DefinitionKeys<K, 'fixedSettings'>> & Inputs>;

type CallInput<K extends ComponentKind, P extends PromptType, T, Args extends unknown[], First = Args[0], Modes = P> = P extends 'text'
	? First extends PlainSource<K, T> ? First : PlainInput<K, ConfigForMode<T, P, Modes>>
	: First extends Source<K, P> ? SourceOutput<K, P, First> : ConfiguredOutput<K, P, T, Modes>;
export type RunInput<K extends ComponentKind, P extends PromptType, T, Run, Input = ConfigValue<Run, Main<K>>, Modes = P> =
	SourceOutput<K, P, Exclude<Input, undefined>> | (undefined extends Input ? P extends 'text'
		? PlainInput<K, ConfigForMode<T, P, Modes>> : ConfiguredOutput<K, P, T, Modes> : never);

type TailForFirst<Allowed extends unknown[], First> = unknown extends First ? [] : Allowed extends [unknown?, ...infer Rest] ? First extends Allowed[0] ? Rest : never : never;
// Native sources must match their positional role, not a broad context-object slot.
type SourceArgumentRoles = ((...args: never[]) => unknown) | URL | ArrayBuffer | ArrayBufferView | Iterable<unknown> | AsyncIterable<unknown> | ReadableStream<unknown>;
type ValidCall<P, Allowed extends unknown[], First, Rest extends unknown[]> = First extends unknown
	? P extends 'text' ? [First, ...Rest] extends Allowed ? true : false
		: ValidArgumentRoles<Allowed, First, Rest, SourceArgumentRoles> : never;
// Resolve source and secondary inputs within the same configuration/call alternative.
type CallResult<K extends ComponentKind, P extends PromptType, T, Call = undefined> = K extends unknown ? T extends unknown ? Call extends unknown
	? Results<T, Call extends unknown[] ? CallInput<K, P, T, Call> : RunInput<K, P, T, Call>, Call>[K] : never : never : never;
type CallCases<P extends PromptType> = Record<P, { arguments: unknown[]; settings: unknown }>;
type CheckCall<P extends PromptType, T, Cases extends CallCases<P>, First, Rest extends unknown[], Keys extends PropertyKey, ObjectSource extends boolean> = number extends Rest['length'] ? unknown : CommonInputs<{
	[M in P]: false extends ValidCall<M, Cases[M]['arguments'], First, Rest> ? never : M extends 'text'
		? [ConfigForMode<T, M, P>] extends [{ asTool: true }]
			? ValidateComponentInput<ConfigForMode<T, M, P>, CallContext<[First, ...Rest]>, CallContextKeys<[First, ...Rest], Keys>> : unknown
		: ValidateComponentInput<ConfigForMode<T, M, P>, CallContext<[First, ...Rest], ObjectSource>, CallContextKeys<[First, ...Rest], Keys, ObjectSource>>
}>;
type CallSignature<K extends ComponentKind, P extends PromptType, T, Cases extends CallCases<P>, Allowed extends unknown[], ObjectSource extends boolean, Head = Allowed[0]> =
	([] extends Allowed ? () => Promise<CallResult<K, P, T>> : unknown)
	& (<First extends Head, Rest extends unknown[] = [], Keys extends PropertyKey = never>(
		first: First & (Partial<Record<Keys, unknown>> | Exclude<SourceArgumentRoles, (...args: never[]) => unknown> | undefined), ...rest: Rest & NoInfer<TailForFirst<Allowed, First>
		& CheckCall<P, T, Cases, First, Rest, Keys, ObjectSource>>
	) => Promise<CallResult<K, P, T, [First, ...Rest]>>)
	& ([P] extends ['text'] ? true extends ConfigValue<T, 'asTool'> ? unknown : (...args: Allowed) => Promise<CallResult<K, P, T, Allowed>> : unknown);
// Contextualize distinct source functions without duplicating their argument-tail variants.
type SourceCalls<K extends ComponentKind, P extends PromptType, T, Cases extends CallCases<P>, Allowed extends unknown[], ObjectSource extends boolean,
	Head = Extract<Allowed[0], (...args: never[]) => unknown>> = Head extends unknown
	? (signature: CallSignature<K, P, T, Cases, Allowed, ObjectSource, Head>) => void : never;
type Call<K extends ComponentKind, P extends PromptType, T, Cases extends CallCases<P>, Allowed extends unknown[], ObjectSource extends boolean> =
	// Infer context and preparer callbacks in their own roles; retain the general signature for forwarding unions.
	([P] extends ['text'] ? unknown : CallSignature<K, P, T, Cases, Allowed, ObjectSource, ComponentInputShape<T>>)
	& ([P] extends ['function'] ? SourceCalls<K, P, T, Cases, Allowed, ObjectSource> extends (signature: infer Signature) => void ? Signature : never : unknown)
	& CallSignature<K, P, T, Cases, Allowed, ObjectSource>;
type CheckRun<K extends ComponentKind, P extends PromptType, T, R> = CommonInputs<{ [M in P]: RunChecks<M, ConfigForMode<T, M, P>, R>[K] }>;
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
