import type { EmptyMap, DistributiveOmit, NamedKeys, UnionKeys } from './utils.js';
import type { MergedProperties } from './merge.js';
import type { CallbackContextFromConfig, ConfigValue, ContextFromConfig, InputConfigAlternatives, InputSchemaFromConfig, PossibleExecutableToolNames, ToolRegistry, ToolRegistryFromConfig } from './config.js';
import type { HasClosedInput, ParsedSchemaOutput, SchemaInputNames, SchemaInputObject } from './schema-shape.js';

// Caller input after configured defaults: completeness, closed shapes and private-name protection.

type SelectedInputDefaults<TDefaults, TKeys extends PropertyKey> = TDefaults extends unknown ? Pick<TDefaults, Extract<NamedKeys<TDefaults>, TKeys>> : never;

type EffectiveComponentInput<TInput, TDefaults, TArguments, TKeys extends PropertyKey = NamedKeys<TInput>> = MergedProperties<SelectedInputDefaults<TDefaults, TKeys>, TArguments>;

type ReservedInputNames<TInputSchema, TDefaults, TContextSchema, TTools extends ToolRegistry> = Exclude<NamedKeys<TDefaults> | NamedKeys<ParsedSchemaOutput<TContextSchema>> | (PossibleExecutableToolNames<TTools> & NamedKeys<TTools>), SchemaInputNames<TInputSchema>>;

export type GuaranteedInputDefaults<TInput, TDefaults> = { [TKeys in NamedKeys<TInput> & keyof TInput]-?: TKeys extends NamedKeys<TDefaults> ? [TDefaults] extends [Record<TKeys, TInput[TKeys]>] ? TKeys : never : never }[NamedKeys<TInput> & keyof TInput];

// Open input accepts ordinary interfaces too. The complete-input check below
// still enforces the original catchall value type.
type InputConstraint<TInput> = { [TKeys in keyof TInput]: string extends TKeys ? any : TInput[TKeys] };

type DefaultAwareInput<TInput, TDefaults> = true extends IsUnion<TDefaults> ? Partial<TInput>
	: TInput extends unknown ? DistributiveOmit<InputConstraint<TInput>, GuaranteedInputDefaults<TInput, TDefaults>> & Partial<Pick<TInput, GuaranteedInputDefaults<TInput, TDefaults>>> : never;

// Some mapped/intersection inputs do not infer the key slot. Keep their actual
// input type, rather than turning a supplied object into an empty one.
type SuppliedInput<TArguments, TKeys extends PropertyKey> = [TKeys] extends [never] ? TArguments : string extends TKeys ? TArguments : number extends TKeys ? TArguments : symbol extends TKeys ? TArguments
	: TArguments extends unknown ? Pick<TArguments, Extract<TKeys, keyof TArguments>> : never;

// An index signature cannot erase explicitly named private fields.
type SuppliedInputNames<TArguments, TKeys extends PropertyKey> = [TKeys] extends [never] ? NamedKeys<TArguments>
	: [Extract<PropertyKey, TKeys>] extends [never] ? TKeys : NamedKeys<TArguments>;

type RequiredInputNames<TInput> = { [TKeys in NamedKeys<TInput> & keyof TInput]-?: EmptyMap extends Pick<TInput, TKeys> ? never : TKeys }[NamedKeys<TInput> & keyof TInput];

// Optional schema fields permit omission only when configured values remain valid.
export type ValidOptionalDefaults<TInput, TDefaults, TKeys extends keyof TInput = Exclude<NamedKeys<TInput> & keyof TInput, TInput extends unknown ? RequiredInputNames<TInput> : never>> = {
	[TPublicNames in TKeys]-?: [SelectedInputDefaults<TDefaults, TPublicNames>] extends [Pick<TInput, TPublicNames>] ? TPublicNames : never;
}[TKeys];

type MatchesCompleteInput<TInput, TEffectiveInput> = TInput extends unknown ? TEffectiveInput extends TInput ? Exclude<RequiredInputNames<TInput>, NamedKeys<TEffectiveInput>> extends never ? true : false : false : never;

type MatchesClosedInput<TInput, TEffectiveInput> = TInput extends unknown ? true extends MatchesCompleteInput<TInput, TEffectiveInput> ? Exclude<keyof TEffectiveInput, keyof TInput> extends never ? true : false : false : never;

type InvalidClosedInput<TInput, TEffectiveInput> = TEffectiveInput extends unknown ? true extends MatchesClosedInput<TInput, TEffectiveInput> ? never : TEffectiveInput : never;

type ConflictingInputKeys<TInput, TEffectiveInput> = TEffectiveInput extends unknown ? TInput extends unknown ? TEffectiveInput extends TInput ? Exclude<keyof TEffectiveInput, keyof TInput> : never : never : never;

type CanInvokeComponent<TInput, TDefaults, TArguments, TPublicNames extends PropertyKey, IsClosed> = [EffectiveComponentInput<TInput, TDefaults, TArguments, TPublicNames>] extends [TInput]
	? true extends MatchesCompleteInput<TInput, EffectiveComponentInput<TInput, TDefaults, TArguments, TPublicNames>>
	? [IsClosed] extends [false] ? true : [InvalidClosedInput<TInput, EffectiveComponentInput<TInput, TDefaults, TArguments, TPublicNames>>] extends [never] ? true : false : false
	: false;

type InputKeyErrors<TKeys extends PropertyKey, TReason extends string> = { [Key in TKeys]: Readonly<Record<TReason, Key>> };

type RejectedInputKeys<TInput, TKeys extends PropertyKey, TPrivateNames extends PropertyKey, IsClosed> = InputKeyErrors<Extract<TKeys, TPrivateNames>, 'Private input key'>
	& (IsClosed extends true ? InputKeyErrors<Exclude<TKeys, NamedKeys<TInput>>, 'Undeclared input key'> : unknown);

type EffectiveInputErrors<TInput, TDefaults, TArguments, TPublicNames extends PropertyKey, IsClosed> = CanInvokeComponent<TInput, TDefaults, TArguments, TPublicNames, IsClosed> extends true ? unknown
	: TInput & InputKeyErrors<[IsClosed] extends [false] ? never : ConflictingInputKeys<TInput, EffectiveComponentInput<TInput, TDefaults, TArguments, TPublicNames>>, 'Key retained by the shallow merge is outside the effective branch'>
	& { readonly 'Effective input must satisfy the complete schema': never };

// Complete raw input, before configured public defaults make any caller fields optional.
export type ComponentInput<TConfig, TInputSchema = InputSchemaFromConfig<TConfig>> = [Exclude<TInputSchema, undefined>] extends [never]
	? DistributiveOmit<CallbackContextFromConfig<TConfig>, NamedKeys<ContextFromConfig<TConfig>> | PossibleExecutableToolNames<ToolRegistryFromConfig<TConfig>> | '_toolOptions'> : SchemaInputObject<Exclude<TInputSchema, undefined>>;

export type PrivateInputNames<TConfig, TDefaults = ContextFromConfig<TConfig>, TInputSchema = InputSchemaFromConfig<TConfig>> = ReservedInputNames<undefined extends TInputSchema ? undefined : TInputSchema, TDefaults, ConfigValue<TConfig, 'toolContextSchema'>, ToolRegistryFromConfig<TConfig>>;

type HasClosedSchema<TInputSchema> = [Exclude<TInputSchema, undefined>] extends [never] ? false : HasClosedInput<Exclude<TInputSchema, undefined>>;

// Contextual caller shape; ValidateComponentInput checks the effective merged values.
export type ComponentInputShape<TConfig, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema }
	? DefaultAwareInput<ComponentInput<TAlternative, TInputSchema>, ContextFromConfig<TAlternative>> : never;

export type CanOmitComponentInput<TConfig, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema }
	? CanInvokeComponent<ComponentInput<TAlternative, TInputSchema>, ContextFromConfig<TAlternative>, EmptyMap, SchemaInputNames<TInputSchema>, HasClosedSchema<TInputSchema>> : never;

type ComponentInputCheck<TConfig, TArguments, TInputSchema, TKeys extends PropertyKey> = RejectedInputKeys<ComponentInput<TConfig, TInputSchema>, SuppliedInputNames<TArguments, TKeys>, PrivateInputNames<TConfig, ContextFromConfig<TConfig>, TInputSchema>, HasClosedSchema<TInputSchema>>
	& EffectiveInputErrors<ComponentInput<TConfig, TInputSchema>, ContextFromConfig<TConfig>, SuppliedInput<TArguments, TKeys>, SchemaInputNames<TInputSchema>, HasClosedSchema<TInputSchema>>;

type ComponentInputChecks<TConfig, TArguments, TKeys extends PropertyKey, TAlternatives = InputConfigAlternatives<TConfig>> = TAlternatives extends { config: infer TAlternative; schema: infer TInputSchema }
	? (check: ComponentInputCheck<TAlternative, TArguments, TInputSchema, TKeys>) => void : never;

// Infer the intersection of branch checks: a successful unknown must not erase another branch's errors.
export type ValidateComponentInput<TConfig, TArguments, TKeys extends PropertyKey = UnionKeys<TArguments>> = 0 extends (1 & TArguments) ? unknown
	: [TArguments] extends [never] ? unknown
	: ComponentInputChecks<TConfig, TArguments, TKeys> extends (check: infer Check) => void ? Check : never;

type IsUnion<TValue, TWhole = TValue> = TValue extends TWhole ? [TWhole] extends [TValue] ? false : true : never;
