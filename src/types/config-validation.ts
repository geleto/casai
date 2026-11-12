import type { sourceMode } from '../config/source-mode.js';
import type { EmptyMap, NamedKeys, UnionKeys, InvalidUnionMembers, StrictUnionSubtype } from './utils.js';
import type { ConfigValue, ContextFromConfig, InputConfigAlternatives, InputSchemaFromConfig, PossibleExecutableToolNames, ToolRegistry, ToolRegistryFromConfig, ToolsFromConfig } from './config.js';
import type { MergedConfig } from './merge.js';
import type { HasOpenRootInput, HasRootSchemaAlternatives, InputDeclarationKind, SchemaInputNames, SchemaOutputNames, ValidateContextSchema, ValidateToolContextSchema } from './schema-shape.js';
import type { ComponentBranchResult } from './result.js';
import type { StreamSchema } from '../streams.js';
import type { DeclaredExecute, DeclaredFunctionExecute, ExpectedFunctionConfig, ExpectedToolConfig } from './function-config.js';
import type { ValidateResolved } from './provisional.js';
import type { CallbackConfigShape, ValidateToolCallbackNames, ValidateToolSelectionNames } from './callbacks.js';
import type { ValidateContextValue } from './input.js';
import type { ToolMode } from './factory-config.js';
import type * as configs from './config.js';

// keyof a union hides branch-only keys; reject a configured signal in any alternative.
type ConfiguredSignalKeys<T> = T extends unknown ? Extract<keyof T, 'abortSignal'> : never;
type ValidateConfiguredSignal<T> = NoInfer<[ConfiguredSignalKeys<T>] extends [never] ? unknown
	: "Config Error: 'abortSignal' is an invocation setting, not constructor configuration.">;

type ContextMapFromConfig<TConfig> = TConfig extends unknown ? 'toolsContext' extends keyof TConfig
	? [NonNullable<TConfig['toolsContext']>] extends [never] ? EmptyMap : NonNullable<TConfig['toolsContext']>
	: EmptyMap : never;
type ContextMapKeys<T> = T extends unknown ? keyof T : never;

type UnknownContextNames<Actual, Tools> = Tools extends unknown ? Exclude<ContextMapKeys<Actual>, keyof Tools> : never;
type InvalidContextNames<Final, PartialConfig extends boolean> = Final extends unknown
	? 'tools' extends keyof Final ? UnknownContextNames<ContextMapFromConfig<Final>, NonNullable<Final['tools']>>
	: PartialConfig extends true ? never : ContextMapKeys<ContextMapFromConfig<Final>> : never;

// Check context against the complete tool map after inheritance and overrides.
export type ValidateToolsContext<TConfig, TFinalConfig = TConfig, PartialConfig extends boolean = false,
	Invalid = import('./tool-binding.js').InvalidToolContexts<TFinalConfig, PartialConfig> | InvalidContextNames<TFinalConfig, PartialConfig>
		| (PartialConfig extends true ? 'tools' extends UnionKeys<TFinalConfig>
			? Exclude<ContextMapKeys<ContextMapFromConfig<TConfig>>, UnionKeys<ToolsFromConfig<TFinalConfig>>> : never
			: Exclude<ContextMapKeys<ContextMapFromConfig<TConfig>>, UnionKeys<ToolsFromConfig<TFinalConfig>>>),
> = ValidateResolved<TConfig, [Invalid] extends [never] ? unknown
	: `Config Error: toolsContext is missing or invalid for tool '${Invalid & string}'.`>;

// A branch with no context must not hide a supplied context in another branch.
type RunContextChecks<Run, Config, Keys extends PropertyKey> = Run extends unknown ? (check: 'context' extends keyof Run
	? ValidateContextValue<Run['context']> & import('./component-input.js').ValidateComponentInput<Config, NonNullable<Run['context']>, Keys>
	: unknown) => void : never;
type ValidateRunContext<Run, Config, Keys extends PropertyKey> = RunContextChecks<Run, Config, Keys> extends (check: infer Check) => void ? Check : never;

// Undefined top-level run settings inherit. Undefined entries inside maps still replace their keys.
type RunChanges<T> = T extends unknown ? {
	[K in keyof T as undefined extends T[K] ? never : K]: T[K]
} & {
	[K in keyof T as undefined extends T[K] ? [Exclude<T[K], undefined>] extends [never] ? never : K : never]?: Exclude<T[K], undefined>
} : never;

export type ValidateRunConfig<TRunConfig, TConfig, TShape, Keys extends PropertyKey = UnionKeys<TRunConfig>, ContextKeys extends PropertyKey = UnionKeys<configs.ConfigValue<TRunConfig, 'context'>>,
	Changes = RunChanges<TRunConfig>, Final = MergedConfig<TConfig, Changes>> = NoInfer<
	Exclude<Keys, keyof TShape> extends never
	? Exclude<UnionKeys<ToolsFromConfig<TRunConfig>>, keyof ToolsFromConfig<TConfig>> extends never
	? ValidateToolCallbackNames<Final> & ValidateToolSelectionNames<Final> & ValidateToolsContext<TRunConfig, Final>
		& import('./tool-binding.js').ValidateRunHelpers<TConfig, Changes>
		& ValidateRunContext<TRunConfig, TConfig, ContextKeys>
	: 'Config Error: run() can only replace configured tools.'
	: `Config Error: Unknown run properties: '${Exclude<Keys, keyof TShape> & string}'.`
>;

// A fragment may be incomplete, but it must fit one component's config, and an execute must match the
// schemas and context the fragment declares. Its context map must match the tools it knows about.
// Coded sources keep one input shape; native owners vary theirs with the selector.
type SourceKind = Exclude<import('./component.js').ComponentKind, 'Function' | 'Template' | 'Script'>;
type FragmentSourceOwners<T, P extends import('./prompt.js').PromptType, K extends SourceKind = SourceKind> = K extends unknown
	? Pick<T, keyof T & import('./component.js').Main<K>> extends Partial<Record<import('./component.js').Main<K>, import('./component.js').Source<K, P> | undefined>>
		? StrictUnionSubtype<T, CallbackConfigShape<Partial<import('./component-map.js').ConfigShapes<import('ai').ToolSet, Record<string, any>, unknown>[K]>>
			& import('../config/source-mode.js').SourceModeSetting<import('./prompt.js').PromptType | undefined>> : never : never;
type InvalidSourceModes<T, P = Extract<ConfigValue<T, typeof sourceMode>, import('./prompt.js').PromptType>> = P extends import('./prompt.js').PromptType
	? [FragmentSourceOwners<T, P>] extends [never] ? T : never : never;
// Keep source choices paired with their own configuration. Successful branches must not erase failures.
type InvalidFragmentSources<T> = T extends unknown ? [keyof T & import('./component.js').Main<SourceKind>] extends [never] ? never : InvalidSourceModes<T> : never;

// Derive each alternative's callback contract before collecting incompatible implementations.
type InvalidFragmentExecute<T> = T extends unknown
	? Pick<T, 'execute' & keyof T> extends { execute?: [Exclude<InputSchemaFromConfig<T>, undefined>] extends [never]
		// Private dependencies may remain unresolved until the completed component.
		? DeclaredFunctionExecute<Omit<T, 'context'>> : DeclaredExecute<T> | DeclaredFunctionExecute<T> } ? never : T : never;

export type ValidateConfigFragment<TConfig, TFinalConfig, TShape> = ValidateResolved<TConfig,
	[InvalidUnionMembers<TConfig, CallbackConfigShape<TShape>> | InvalidUnionMembers<TFinalConfig, CallbackConfigShape<TShape>>] extends [never]
	? [InvalidFragmentExecute<TFinalConfig>] extends [never]
		? ValidateToolsContext<TConfig, TFinalConfig, true>
		: 'Config Error: The execute function does not match the schemas and context declared in this configuration.'
	: 'Config Error: These properties do not belong to any single component configuration.'> & ValidateConfiguredSignal<TFinalConfig>
	& ValidateResolved<TConfig, ValidateToolCallbackNames<TFinalConfig, true> & ValidateToolSelectionNames<TFinalConfig, true>>
	& NoInfer<[InvalidFragmentSources<TFinalConfig>] extends [never] ? unknown : 'Config Error: The source does not match its source mode.'>;

type RequiredKeys<T> = { [K in keyof T]-?: EmptyMap extends Pick<T, K> ? never : K }[keyof T];
type MissingKeys<TFinal, TExpected> = Exclude<RequiredKeys<TExpected>, keyof TFinal>;
// Required settings must be present for every possible value after inheritance.
type MissingRequiredKeys<TFinal, TRequired> = {
	[K in keyof TRequired]-?: K extends keyof TFinal
	? [Extract<TFinal[K], undefined | null>] extends [never] ? never : K
	: K;
}[keyof TRequired];
type IncompatibleKeys<TFinal, TExpected> = {
	[K in keyof TExpected & keyof TFinal]-?: Pick<TFinal, K> extends Pick<TExpected, K> ? never : K
}[keyof TExpected & keyof TFinal];

type FinalConfigCheck<Final, Expected, Unknown = Exclude<UnionKeys<Final>, keyof Expected | 'asTool'>,
	Missing = MissingKeys<Final, Expected>, Incompatible = IncompatibleKeys<Final, Expected>> =
	[Unknown] extends [never] ? [Missing] extends [never] ? [Incompatible] extends [never] ? unknown
	: `Config Error: Property '${Incompatible & string}' is incompatible with the final configuration.`
	: `Config Error: Missing required property '${Missing & string}' in the final configuration.`
	: `Config Error: Unknown properties for the final Function configuration: '${Unknown & string}'.`;
type FunctionModeChecks<Final, AsTool extends boolean> = AsTool extends unknown
	? (check: AsTool extends true
		? FinalConfigCheck<Final, ExpectedToolConfig<Final>> & ToolInputAdmission<Final> & ToolOutputAdmission<Final>
		: FinalConfigCheck<Final, ExpectedFunctionConfig<Final>>) => void : never;
type FunctionConfigChecks<Final, Explicit extends boolean> = Final extends unknown ? FunctionModeChecks<Final, ToolMode<Final, Explicit>> : never;

// Derive each branch's contract before collecting failures, including inherited callbacks.
export type ValidateFinalConfig<TConfig, TFinal, Explicit extends boolean = false> = ValidateResolved<TConfig,
	FunctionConfigChecks<TFinal, Explicit> extends (check: infer Check) => void ? Check : never>;

export type ValidateRendererConfig<K extends 'Template' | 'Script', Config, Final, Shape,
	Result = import('./component-map.js').ToolResults<Final, never>[K],
	Missing = MissingRequiredKeys<Final, Record<import('./component.js').RequiredComponentKeys<K, ConfigValue<Final, typeof sourceMode>, true extends ToolMode<Final, false> ? true : false>, unknown>>> =
	ValidateResolved<Config, Exclude<UnionKeys<Final>, keyof Shape | 'asTool'> extends never
		? [Missing] extends [never] ? Config
			: `Config Error: Missing required property '${Missing & string}' in the final configuration.`
		: `Config Error: Unknown properties for this generator type: '${Exclude<UnionKeys<Final>, keyof Shape | 'asTool'> & string}'`>
	& ValidateResolved<Config, ComponentAdmission<Final>>
	& import('./callbacks.js').ValidateDescriptor<Config, Final, Result>
	& ValidateResolved<Config, true extends ToolMode<Final, false> ? ToolInputAdmission<Final> & ToolOutputAdmission<Final, Result> : unknown>;

// Shared preparation requirements, used by component construction and tool binding.
export type ValidateInputDeclarations<TInputSchema, TDefaults, TContextSchema = undefined, TTools extends ToolRegistry = EmptyMap> = [UnionKeys<TDefaults> | SchemaOutputNames<TContextSchema> | PossibleExecutableToolNames<TTools>] extends [never] ? unknown
	: 'unsupported' extends InputDeclarationKind<TInputSchema> ? { readonly 'Schema needs supported input declarations': never } : unknown;

type UndeclaredToolOutput<TConfig, TSchema = ConfigValue<TConfig, 'schema'>> = TSchema extends StreamSchema<any, any, any> ? never : ComponentBranchResult<TConfig, TSchema>;

// Keep configuration/schema alternatives paired: declared streams already have a collection contract.
export type ToolOutputAdmission<TConfig, TResult = TConfig extends unknown ? UndeclaredToolOutput<TConfig> : never> = unknown extends TResult ? unknown
	: [Extract<TResult, AsyncIterable<unknown>>] extends [never] ? unknown : { readonly 'Tool streams require a declared stream schema': never };

type InvalidToolProjection<TConfig, TDefaults, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema } ? true extends HasRootSchemaAlternatives<TInputSchema>
	? [Extract<NamedKeys<[TDefaults] extends [never] ? ContextFromConfig<TAlternative> : TDefaults>, SchemaInputNames<TInputSchema>>] extends [never] ? never : TAlternatives : never : never;

export type ToolInputAdmission<TConfig, TDefaults = never> =
	(true extends HasOpenRootInput<InputSchemaFromConfig<TConfig>> ? { readonly 'Tool input requires a closed root object; nest dynamic keys in a declared field': never } : unknown)
	& ([InvalidToolProjection<TConfig, TDefaults>] extends [never] ? unknown : { readonly 'Tool public defaults require an independent object schema': never });

type ComponentBranchAdmission<TConfig, TInputSchema> = [Exclude<TInputSchema, undefined>] extends [never] ? unknown
	: ValidateInputDeclarations<TInputSchema, ContextFromConfig<TConfig>, ConfigValue<TConfig, 'toolContextSchema'>, ToolRegistryFromConfig<TConfig>> & ValidateContextSchema<Exclude<TInputSchema, undefined>> & ValidateToolContextSchema<ConfigValue<TConfig, 'toolContextSchema'>>;

type ComponentAdmissionChecks<TConfig, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema } ? (check: ComponentBranchAdmission<TAlternative, TInputSchema>) => void : never;

export type ComponentAdmission<TConfig> = ComponentAdmissionChecks<TConfig> extends (check: infer TCheck) => void ? TCheck : never;
