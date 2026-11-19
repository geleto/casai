import { toolMode, streamMode, sourceMode, type SourceModeSetting } from '../config/modifiers.js';
import type { AllowedMode, ComponentKind, Main, Source, ComponentFactoryShape, Component, ToolInput, ToolResultFromConfig, ComponentSettings, RequiredComponentKeys } from '../types/component.js';
import type { PromptType } from '../types/prompt.js';
import type { ConfigProvider, ConfigValue, ToolRegistry, RuntimeContextFromConfig } from '../types/config.js';
import type { EmptyMap, UnionKeys, UndefinedKeys, OptionalUndefined, DistributiveOmit } from '../types/utils.js';
import type { MergedConfig } from '../types/merge.js';
import type { Provisional, ResolvedConfig, ValidateResolved } from '../types/provisional.js';
import type { ConfigSchemas, SchemaConfigInferShape, ConfigRegistry, RegistryConfigInferShape, ToolMode, ToolModeConfig, StreamModeConfig, CallbackParent, CapturedConfig, FinalConfig, SourceMode, SourceModeConfig } from '../types/factory-config.js';
import type { CallbackConfigShape, CallbackKeys, DescriptorInput, ValidateDescriptor } from '../types/callbacks.js';
import type { ComponentAdmission, ToolInputAdmission, ValidateToolsContext, ValidateRendererConfig } from '../types/config-validation.js';
import type { SchemaInputNames } from '../types/schema-shape.js';
import { mergeConfigs } from '../config/config-utils.js';
import { validateConfigBasics } from '../config/validate.js';
import { validateRegistryConfig, descriptorKeys } from '../runtime/execution.js';
import { ConfigError } from '../errors.js';
import type { CheckedComponent, Definitions, Components, ToolChecks, ToolInputs, ToolRequirements } from '../types/component-map.js';
import type { CommonInputs } from '../types/input.js';
import type * as configs from '../types/config.js';

const preparationKeys = ['context', 'inputSchema', 'toolContextSchema', 'tools', 'toolsContext', 'debug'] as const;

export const audioModifiers = { withScript: 'async-script', withFunction: 'function', loadsScript: 'async-script-name' } as const;
export const textModifiers = { ...audioModifiers, withText: 'text', withTemplate: 'async-template', loadsText: 'text-name', loadsTemplate: 'async-template-name' } as const;
export const audioInputModifiers = { ...audioModifiers, withAudio: 'text', loadsAudio: 'audio-resource' } as const;
export const audioInputModes = Object.values(audioInputModifiers);
export const configModifiers = { ...textModifiers, ...audioInputModifiers } as const;
export const textModes = Object.values(textModifiers);

export interface ComponentDefinition<Settings> {
	name: string;
	main: keyof Settings & string;
	defaultMode: PromptType | undefined;
	/** Casai-implemented settings. SDK-backed components delegate unknown settings to the SDK. */
	keys?: readonly (keyof Settings & string)[];
	modifiers: Readonly<Record<string, PromptType>>;
	toolModes: readonly (PromptType | undefined)[];
	required: readonly (keyof Settings & string)[];
	inlineRequired?: readonly (keyof Settings & string)[];
	toolRequired?: readonly (keyof Settings & string)[];
	fixedSettings?: readonly (keyof Settings & string)[];
	asStream?: true;
	structured?: 'parts' | 'image';
}

type Mode = PromptType | undefined;
type Shape<K extends ComponentKind, P extends Mode, A extends boolean, T = unknown> = ComponentFactoryShape<K, P extends PromptType ? P : PromptType, A, T>;
// A copied source selection may be replaced by the explicit factory modifier.
type InferShape<K extends ComponentKind, P extends Mode, A extends boolean, T = unknown> = CallbackConfigShape<Partial<DistributiveOmit<Shape<K, undefined, A, T>, Main<K>>>>
	& Partial<Record<Main<K>, P extends 'function' | undefined ? unknown : Source<K, Extract<P, PromptType>> | undefined>>;
type ToolAllowed<K extends ComponentKind, P extends PromptType> = P extends Definitions[K]['toolModes'][number] ? true : false;
// Infer the preparer's result before checking it against the final native operation below.
type SourceCallback<K extends ComponentKind, P extends PromptType, T, A extends boolean> = P extends 'function' ? Partial<Record<Main<K>,
	((context: T extends unknown ? Parameters<Source<K, 'function', T, ToolMode<T, A>, unknown>>[0] : never) => ReturnType<Source<K, 'function'>>) | undefined>> : EmptyMap;
type NativeCallbackKeys<K extends ComponentKind> = CallbackKeys<ComponentSettings[K]>;
type NativeCallbacks<K extends ComponentKind, T, Settings = ComponentSettings<RuntimeContextFromConfig<T>>[K]> = OptionalUndefined<Partial<{
	[Key in NativeCallbackKeys<K>]: ConfigValue<Settings, Key>;
}>>;
type Missing<T, Keys extends PropertyKey> = { [K in Keys]-?: 0 extends (1 & ConfigValue<T, K>) ? never : undefined extends ConfigValue<T, K> ? K : null extends ConfigValue<T, K> ? K : never }[Keys];
type ValidateBranch<K extends ComponentKind, P extends PromptType, T, C, A extends boolean,
	Extra = Exclude<keyof T, UnionKeys<Shape<K, P, A, T>>>,
	Unknown = Extra extends PropertyKey ? Exclude<Extra, Extract<UndefinedKeys<T>, UnionKeys<ComponentSettings[K]>>> : never,
	Required = RequiredComponentKeys<K, P, A> | (A extends true ? ToolRequirements<P, T>[K] : never),
	Absent = Missing<T, Extract<Required, PropertyKey>>,
	InvalidNames = true extends A ? P extends 'text' ? Exclude<SchemaInputNames<ConfigValue<T, 'inputSchema'>>, Main<K>> : never : never> = ValidateResolved<C,
	[Unknown] extends [never] ? [InvalidNames] extends [never] ? [Absent] extends [never] ? [T] extends [InferShape<K, undefined, A, T>] ? [P] extends [AllowedMode<K>]
	? ComponentAdmission<T>
	& (P extends 'audio-resource' ? import('../audio/preparation.js').CheckLoadedFormat<P, ConfigValue<T, 'inputAudioFormat'>> : unknown)
	& (true extends ConfigValue<T, typeof streamMode> & ConfigValue<T, typeof toolMode> ? 'Config Error: .asStream cannot be combined with .asTool.' : unknown)
	& ([NativeCallbackKeys<K> & keyof T] extends [never] ? unknown : Pick<T, NativeCallbackKeys<K> & keyof T> extends NativeCallbacks<K, T> ? unknown : 'Config Error: Callbacks must match the final component settings.')
	& (true extends A ? ToolAllowed<K, P> extends true ? ToolInputAdmission<T>
		& (K extends CheckedComponent<'toolCheck'> ? ToolChecks<P, T, ToolInput<K, P, T>>[K] : unknown)
		& (P extends 'text' ? [ToolInput<K, P, T>] extends [ToolInputs<T>[K]] ? unknown
			: `Config Error: Parsed '${Main<K>}' must be a native ${K} input. Use a preparer for conversion.` : unknown)
		& ValidateDescriptor<C, T, ToolResultFromConfig<K, P, T>> : 'Config Error: This component does not support tool mode.' : unknown)
	& (Pick<T, Main<K> & keyof T> extends Partial<Record<Main<K>, Source<K, P, T, A> | undefined>> ? unknown : 'Config Error: The source must match the final preparation context and native operation input.')
	: `Config Error: Unsupported ${K} source modifier.`
	: 'Config Error: Settings must match the final component.'
	: `Config Error: Missing required ${K} property '${Absent & string}'.`
	: `Config Error: Plain ${K} tool input must use '${Main<K>}'. Use a preparer for custom arguments.`
	: `Config Error: Unknown ${K} properties: '${Unknown & string}'.`>;

type ConfigChecks<K extends ComponentKind, P extends PromptType, T, C, A extends boolean> = T extends unknown
	? (checks: CommonInputs<{ [M in Extract<ConfigValue<T, typeof sourceMode>, P>]: ValidateBranch<K, M, T, C, ToolMode<T, A>> }>) => void : never;
type Validate<K extends ComponentKind, P extends PromptType, T, C, A extends boolean> =
	(ConfigChecks<K, P, T, C, A> extends (checks: infer Checks) => void ? Checks : never) & ValidateToolsContext<C, T>;

type Factory<K extends ComponentKind, P extends Mode, A extends boolean = false, S extends boolean = false> = <
	C extends object & Provisional<InferShape<K, P, A>>,
	Parent extends ConfigProvider<object> = never,
	Par extends object = Parent['config'],
	SP extends object = object, Input = never, TC = never, Keys extends string = never,
	RegistryPresence extends object = object,
	Context extends Record<string, any> | undefined = never, Tools extends ToolRegistry | undefined = never, ToolContexts extends object | undefined = never,
	RuntimePresence extends object = object, Runtime extends Record<string, unknown> | undefined = never,
	ToolFlag extends true | undefined = undefined,
	Captured = StreamModeConfig<CapturedConfig<Par, Omit<ResolvedConfig<C>, 'context' | 'inputSchema' | 'toolContextSchema' | 'tools' | 'toolsContext' | typeof toolMode>
		& ConfigSchemas<SP, Input, never, TC> & ConfigRegistry<RegistryPresence, Tools, ToolContexts> & { context: Context; [toolMode]: ToolFlag }>, S>,
	Complete = SourceModeConfig<StreamModeConfig<ToolModeConfig<FinalConfig<Par, C>, A>, S>, P, Definitions[K]['defaultMode']>, M extends PromptType = Extract<ConfigValue<Complete, typeof sourceMode>, PromptType>,
	AsTool extends boolean = ToolMode<Complete, A>,
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style -- The direct mapped form keeps key inference within the measured compiler budget.
>(config: C & { [Key in Keys]?: unknown } & SchemaConfigInferShape<SP, Input, never, TC> & RegistryConfigInferShape<RegistryPresence, Tools, ToolContexts> & { context?: Context; runtimeContext?: Runtime; [toolMode]?: ToolFlag }
	& Pick<{ [Key in keyof RuntimePresence]: unknown }, keyof RuntimePresence & 'runtimeContext'>
	& NoInfer<SourceCallback<K, P extends 'function' ? 'function' : M, Captured, A>>
	& NoInfer<[Keys & NativeCallbackKeys<K>] extends [never] ? unknown : NativeCallbacks<K, MergedConfig<CallbackParent<Par>, Pick<{ [Key in keyof RuntimePresence]: Runtime }, keyof RuntimePresence & 'runtimeContext'>>>>
	& (true extends AsTool ? DescriptorInput<ConfigSchemas<SP, Input, never, TC>, CallbackParent<Par>, ToolResultFromConfig<K, Extract<SourceMode<Captured, P, Definitions[K]['defaultMode']>, PromptType>, Captured>> : unknown)
	// An empty argument retains C's provisional constraint; its final config still needs validation.
	& Validate<K, M, Complete, [Keys] extends [never] ? EmptyMap : C, A>,
	...parent: [Parent] extends [never] ? [] : [parent: Parent]
) => NoInfer<Component<K, M, Complete, AsTool>>;

type Modes<K extends ComponentKind, P extends Mode> = Factory<K, P>
	& (ToolAllowed<K, P extends PromptType ? P : Extract<Definitions[K]['defaultMode'], PromptType>> extends true ? { asTool: Factory<K, P, true> } : EmptyMap)
	& (Definitions[K] extends { asStream: true } ? { asStream: Factory<K, P, false, true> } : EmptyMap);
export type SourceFactory<K extends ComponentKind> = Modes<K, undefined> & {
	[M in keyof Definitions[K]['modifiers']]: Modes<K, Extract<Definitions[K]['modifiers'][M], PromptType>>;
};

type RendererKind = 'Template' | 'Script';
type RendererSettings<K extends RendererKind, AsTool extends boolean> = (AsTool extends true ? {
	Template: configs.TemplateToolSettings<Record<string, any>>;
	Script: configs.ScriptToolSettings<Record<string, any>, unknown>;
} : {
	Template: configs.TemplateSettings<Record<string, any>>;
	Script: configs.ScriptSettings<Record<string, any>, unknown>;
})[K] & SourceModeSetting<AllowedMode<K> | undefined>;
type RendererConfig<K extends RendererKind, Named extends boolean, AsTool extends boolean> =
	RendererSettings<K, AsTool> & (Named extends true ? configs.LoaderConfig : EmptyMap);
type RendererInferShape<K extends RendererKind, AsTool extends boolean> =
	Omit<configs.ParentToolConfigInferShape<RendererConfig<K, false, AsTool>>, typeof sourceMode> & SourceModeSetting<PromptType | undefined>;
type RendererFinalShape<K extends RendererKind> = Partial<configs.ToolConfigShape<RendererSettings<K, false> & configs.ToolContextSchemaConfig<any>>>;
type RendererConfigChecks<K extends RendererKind, Config, Final> = Final extends unknown
	? (check: ValidateRendererConfig<K, Config, Final, RendererConfig<K,
		Extract<configs.ConfigValue<Final, typeof sourceMode>, `${string}-name`> extends never ? false : true,
		ToolMode<Final, false>>>) => void : never;

type RendererSignature<K extends RendererKind, Source extends PromptType | undefined, AsTool extends boolean = false> = <
	TConfig extends object & Provisional<RendererInferShape<K, AsTool>>,
	TParent extends ConfigProvider<object> = never,
	TParentConfig extends object = TParent['config'],
	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
	Final = SourceModeConfig<ToolModeConfig<FinalConfig<TParentConfig, TConfig>, AsTool>, Source, Definitions[K]['defaultMode']>,
	EffectiveTool extends boolean = ToolMode<Final, AsTool>,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig
		& (true extends EffectiveTool ? DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, CallbackParent<TParentConfig>, K extends 'Template' ? string : never> : unknown)
		& (RendererConfigChecks<K, TConfig, Final> extends (check: infer Check) => void ? Check : never)
		& ValidateToolsContext<ResolvedConfig<TConfig>, Final>
		& ValidateResolved<TConfig, [Final] extends [RendererFinalShape<K>]
			? unknown : 'Config Error: Invalid renderer settings.'>,
	...parent: [TParent] extends [never] ? [] : [parent: TParent & NoInfer<ConfigProvider<RendererInferShape<K, AsTool>>>]
) => Components<Extract<configs.ConfigValue<Final, typeof sourceMode>, PromptType>, Final, EffectiveTool>[K];

type RendererModes<K extends RendererKind, P extends PromptType | undefined> = RendererSignature<K, P> & { asTool: RendererSignature<K, P, true> };
export type RendererFactory<K extends RendererKind> = RendererModes<K, undefined> & {
	[M in keyof Definitions[K]['modifiers']]: RendererModes<K, Extract<Definitions[K]['modifiers'][M], PromptType>>;
};

/** Definition-owned rules apply to every completed component, after ordinary configuration merging. */
function validateComponentConfig(config: Record<PropertyKey, unknown>, definition: ComponentDefinition<Record<string, unknown>>): void {
	if (config[streamMode] === true && !definition.asStream) throw new ConfigError(`${definition.name} does not support .asStream.`);
	const mode = (config as import('../config/modifiers.js').SourceModeSetting)[sourceMode];
	if (mode !== definition.defaultMode && !Object.values(definition.modifiers).includes(mode!)) throw new ConfigError(`Unsupported ${definition.name} source modifier.`);
	if (definition.keys) {
		const allowed = [...definition.keys, ...preparationKeys, ...(definition.defaultMode === undefined ? [] : ['loader', 'filters', 'renderOptions']), ...(config[toolMode] ? descriptorKeys : ['description'])];
		const unknown = Object.keys(config).filter(key => !allowed.includes(key));
		if (unknown.length) throw new ConfigError(`Unknown ${definition.name} properties: ${unknown.join(', ')}.`);
	}
	if (config[toolMode] && !definition.toolModes.includes(mode)) throw new ConfigError(`${definition.name} does not support tool mode with this source.`);
	const required = [...definition.required, ...(mode?.endsWith('-name') ? ['loader'] : definition.inlineRequired ?? []),
		...(config[toolMode] ? ['inputSchema', ...definition.toolRequired ?? [], ...(mode !== undefined && mode !== 'text' ? [definition.main] : [])] : [])];
	for (const key of required) {
		if (config[key] == null) throw new ConfigError(`${definition.name} requires ${key === 'model' ? "a 'model'" : `'${key}'`}.`);
	}
}

type FactorySelectors = Pick<ComponentDefinition<unknown>, 'modifiers' | 'asStream'>
	& Partial<Pick<ComponentDefinition<unknown>, 'name' | 'defaultMode' | 'toolModes'>>;

/** Resolve selectors once for both incomplete fragments and finished components. */
export function createFactory(
	selectors: FactorySelectors,
	build: (merged: Record<PropertyKey, unknown>, supplied: Record<string, unknown>) => unknown,
): unknown {
	function factory(mode?: PromptType, delivery?: typeof streamMode | typeof toolMode) {
		return (config: Record<string, unknown>, parent?: ConfigProvider<Record<string, unknown>>) => {
			const inherited = parent?.config ?? {};
			validateConfigBasics(inherited);
			validateConfigBasics(config);
			const merged: Record<PropertyKey, unknown> = mergeConfigs(inherited, config);
			const source = mode ?? merged[sourceMode] ?? selectors.defaultMode;
			if (source !== undefined) merged[sourceMode] = source;
			if (delivery) merged[delivery] = true;
			if ('abortSignal' in merged) throw new ConfigError("'abortSignal' is an invocation setting. Pass it to .run() instead of constructor configuration.");
			if (merged[streamMode] && merged[toolMode]) throw new ConfigError(`${selectors.name === 'LLMAgent' ? 'LLMAgent tools are generation-only. ' : ''}.asStream cannot be combined with .asTool, including through inheritance.`);
			return build(merged, config);
		};
	}
	function modes(mode?: PromptType) {
		return Object.assign(factory(mode),
			!selectors.toolModes || selectors.toolModes.includes(mode ?? selectors.defaultMode) ? { asTool: factory(mode, toolMode) } : {},
			selectors.asStream ? { asStream: factory(mode, streamMode) } : {});
	}
	return Object.assign(modes(), Object.fromEntries(Object.entries(selectors.modifiers).map(([key, mode]) => [key, modes(mode)])));
}

export function createComponentFactory<D extends ComponentDefinition<Record<string, unknown>>>(
	definition: D, create: (config: any, definition: D) => unknown,
	validate?: (config: Record<string, unknown>, definition: D) => void,
): unknown {
	return createFactory(definition, (merged, supplied) => {
		validateComponentConfig(merged, definition);
		validate?.(merged, definition);
		validateRegistryConfig(merged, supplied);
		return create(merged, definition);
	});
}
