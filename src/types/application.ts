import type { InferToolContext, InferToolInput, InferToolOutput } from '@ai-sdk/provider-utils';
import type { z } from 'zod/v4';
import type { FlexibleSchema, Tool } from 'ai';
import type { EmptyMap, MergedConfig, MergedProperties } from './merge.js';
import type { DeclaredType } from './config.js';
import type { ValidateRunConfig } from './config-validation.js';
import type { InferInputSchema, InferSchema } from './types.js';
import type { ComponentExecutionOptions } from '../execution.js';
import type { StreamSchema } from '../streams.js';
type Raw<S> = InferInputSchema<S>;
type Parsed<S> = S extends FlexibleSchema<unknown> ? InferSchema<S> : undefined;
export type NamedKeys<T> = T extends unknown ? keyof {
	[K in keyof T as string extends K ? never : number extends K ? never : symbol extends K ? never : K]: T[K];
} : never;

export type SelectedDefaults<D, K extends PropertyKey> = D extends unknown ? Pick<D, Extract<NamedKeys<D>, K>> : never;
export type EffectiveInput<I, D, A, K extends PropertyKey = NamedKeys<I>> = MergedProperties<SelectedDefaults<D, K>, A>;
export type Capability<S, Depth extends unknown[] = [], Union extends boolean = false> = Depth['length'] extends 12 ? 'dynamic'
	: S extends z.core.$ZodObject ? 'object'
	: S extends z.core.$ZodPipe<infer I, infer O> ? Capability<I extends z.core.$ZodTransform ? O : I, [...Depth, 0], Union>
	: S extends z.core.$ZodLazy<infer I> ? Capability<I, [...Depth, 0], Union>
	: S extends z.core.$ZodIntersection<infer L, infer R> ? Exclude<Capability<L | R, [...Depth, 0]>, 'object'> extends never ? 'object' : 'dynamic'
	: S extends { _zod: { def: { innerType: infer I } } } ? Capability<I, [...Depth, 0], Union>
	: S extends z.core.$ZodUnion<infer B> ? Union extends true ? Exclude<Capability<B[number], [...Depth, 0]>, 'object'> extends never ? 'object' : 'unsupported' : 'unsupported'
	: S extends z.core.$ZodTransform ? 'unsupported'
	: 'dynamic';
type Fields = Record<string, unknown>;
type Schema = FlexibleSchema<unknown>;
type Tools = Record<string, Tool | null | undefined>;
type Keys<T> = T extends unknown ? keyof T : never;
// Homomorphic removal preserves explicit properties beside an open index signature.
type OmitEach<T, K extends PropertyKey> = T extends unknown ? { [P in keyof T as P extends K ? never : P]: T[P] } : never;
type Obj<T> = T extends readonly unknown[] ? never : T extends object ? T : never;
type Input<S> = unknown extends Raw<S> ? Fields : Obj<Raw<S>>;
type Output<S> = unknown extends Parsed<S> ? Fields : Obj<Parsed<S>>;
type Branches<S> = S extends z.core.$ZodUnion<infer B> ? B[number] : never;
export type PublicNames<S, Depth extends unknown[] = []> = Depth['length'] extends 12 ? NamedKeys<Input<S>>
	: S extends undefined ? never
	: S extends z.core.$ZodObject<infer Shape> ? keyof Shape
	: S extends z.core.$ZodLazy<infer I> ? PublicNames<I, [...Depth, 0]>
	: S extends z.core.$ZodIntersection<infer L, infer R> ? PublicNames<L, [...Depth, 0]> | PublicNames<R, [...Depth, 0]>
	// Native input metadata skips a preprocessor's transform, retaining the next schema's raw declarations.
	: [Branches<S>] extends [never] ? S extends z.core.$ZodPipe<infer I, infer O> ? PublicNames<I extends z.core.$ZodTransform ? O : I, [...Depth, 0]>
	: S extends { _zod: { def: { innerType: infer I } } } ? PublicNames<I, [...Depth, 0]>
	: NamedKeys<Input<S>> : PublicNames<Branches<S>, [...Depth, 0]>;
type DeclaredCapability<S> = Capability<S, [], true>;
// Read output declarations, not raw context input types. Bound type recursion
// only; runtime retains discoverable names and terminates cycles by identity.
type ContextNames<S, Depth extends unknown[] = []> = Depth['length'] extends 12 ? never
	: S extends z.core.$ZodObject<infer Shape> ? keyof Shape
	: S extends z.core.$ZodLazy<infer I> ? ContextNames<I, [...Depth, 0]>
	: S extends z.core.$ZodPipe<any, infer O> ? ContextNames<O, [...Depth, 0]>
	: S extends z.core.$ZodIntersection<infer L, infer R> ? ContextNames<L, [...Depth, 0]> | ContextNames<R, [...Depth, 0]>
	: S extends { _zod: { def: { innerType: infer I } } } ? ContextNames<I, [...Depth, 0]>
	: [Branches<S>] extends [never] ? never
	: ContextNames<Branches<S>, [...Depth, 0]>;
type PossibleFallbackNames<H extends Tools> = { [K in keyof H]-?: NonNullable<H[K]> extends { execute?: infer E }
	? Extract<E, (...args: any[]) => any> extends never ? never : K : never }[keyof H];
type Admission<S, D, T = undefined, H extends Tools = EmptyMap> = [Keys<D> | ContextNames<T> | PossibleFallbackNames<H>] extends [never] ? unknown
	: 'unsupported' extends DeclaredCapability<S> ? { readonly 'Schema needs supported input declarations': never } : unknown;
type ObjectAdmission<S> = unknown extends Parsed<S> ? unknown : [Exclude<Parsed<S>, undefined>] extends [Obj<Parsed<S>>]
	? unknown : { readonly 'Schema must produce an object context': never };
type InputAdmission<S> = [Input<S>] extends [never] ? { readonly 'Application input must be an object': never }
	: [Output<S>] extends [never] ? { readonly 'Schema must produce an object context': never } : ObjectAdmission<S>;
type ContextAdmission<T> = [Exclude<T, undefined>] extends [never] ? unknown : ObjectAdmission<Exclude<T, undefined>>;
// Mixed schemas retain both policies: no global extra-key ban, but closed
// alternatives still require an exact effective-branch match.
type Closed<S, I = Input<S>> = I extends unknown ? string extends keyof I ? false : true : never;
type Incoming<T, C = undefined> = T extends Schema ? Obj<Parsed<T>> | (undefined extends Parsed<T> ? EmptyMap : never)
	: C extends object ? C : EmptyMap;
type Defaults<D, T, C = undefined> = MergedProperties<D, Incoming<T, C>>;
type ExecutableNames<T extends Tools> = { [K in keyof T]-?: [T[K]] extends [{ execute: (...args: any[]) => any }] ? K : never }[keyof T];
type PossibleToolNames<T extends Tools> = { [K in keyof T]-?: Extract<T[K], Tool> extends never ? never : K }[keyof T];
// Generic call signatures alone do not preserve raw input, omitted defaults or
// private reservations under substitution. This optional, type-only member makes
// those obligations structural without adding a runtime property to helpers.
declare const helperContract: unique symbol;
type RestrictedNames<I> = string extends keyof I ? {
	[K in NamedKeys<I> & keyof I]-?: [I[string]] extends [I[K]] ? never : K
}[NamedKeys<I> & keyof I] : never;
// Keep raw discriminants at the root so TypeScript can compare union branches.
type RawContract<I> = I extends unknown ? I & {
	readonly [helperContract]?: {
		keys: keyof I;
		// Open inputs also retain named restrictions beyond their index signature.
		declared: string extends keyof I ? (key: RestrictedNames<I>) => void : any;
	};
} : never;
// Resolve the raw contract before comparing functions: comparing the generic
// alias directly can skip its branch-specific key restrictions.
type HelperContract<I, D, P extends PropertyKey, R> = RawContract<I> extends infer Input ? {
	readonly [helperContract]?: {
		input: (value: Input) => R;
		defaults: (key: Guaranteed<I, D> | OptionalDefaults<I, D>) => void;
		private: P;
	};
} : never;
type ApplicationHelperContract<T, R, B = ApplicationAlternatives<T>> = B extends { config: infer Config; schema: infer S }
	? HelperContract<ApplicationInput<Config, S>, Configured<Config>, PrivateKeys<Config, Configured<Config>, S>, R> : never;
// Keep each selected parser paired with its bound defaults, then derive one
// callable that checks every selection rather than a union of generic helpers.
type BoundHelperConfig<T, C> = T extends unknown ? OmitEach<T, 'context'>
	& { context: Defaults<Configured<T>, Setting<T, 'toolContextSchema'>, C> } : never;
type ComponentHelper<T, R> = ApplicationCaller<T, R> & ApplicationHelperContract<T, R>;
// Capture the native completed output before distributing the component's configuration.
type Helper<T, C, R = T extends Tool ? InferToolOutput<T> : never> = T extends Tool ? T extends { config: infer Config }
	? ComponentHelper<BoundHelperConfig<Config, C>, R>
	: ((input: InferToolInput<T>) => Promise<R>) & HelperContract<InferToolInput<T>, EmptyMap, never, R> : never;
type Selected<M, K> = M extends unknown ? K extends keyof M ? M[K] : undefined : never;
type ShadowSource<S, D, K> = K extends PublicNames<S> ? Output<S> : D;
type ShadowValue<S, D, K> = ShadowSource<S, D, K> extends infer Source ? Source extends unknown ? K extends keyof Source ? Source[K] : never : never : never;
type HasRequiredKey<Source, K extends PropertyKey> = K extends keyof Source ? [Source] extends [Record<K, unknown>] ? true : false : false;
type FallbackValue<S, D, H extends Tools, M, K extends keyof H> = ShadowValue<S, D, K>
	| (HasRequiredKey<ShadowSource<S, D, K>, K> extends true ? never : Helper<H[K], Selected<M, K>>);
type PresentFallbacks<S, D, H extends Tools> = ExecutableNames<H> | { [K in PossibleFallbackNames<H>]: HasRequiredKey<ShadowSource<S, D, K>, K> extends true ? K : never }[PossibleFallbackNames<H>];
type Fallbacks<S, D, H extends Tools, M> = { [K in PresentFallbacks<S, D, H>]: FallbackValue<S, D, H, M, K> }
	& { [K in Exclude<PossibleFallbackNames<H>, PresentFallbacks<S, D, H>>]?: FallbackValue<S, D, H, M, K> };
// S represents selected parsers, not branches inside one union parser. A value
// must satisfy every possible selection. Unknown/any raw inputs add no constraint.
type ContextInputs<S> = S extends Schema ? (context: unknown extends Raw<S> ? unknown : Raw<S>) => void : (context: object | undefined) => void;
type ContextInput<T> = ContextInputs<Setting<T, 'toolContextSchema'>> extends (context: infer C) => void ? C : never;
type RawContext<T> = NonNullable<T> extends { config: infer Config } ? ContextInput<Config>
	: NonNullable<T> extends Tool ? [InferToolContext<NonNullable<T>>] extends [never] ? unknown : InferToolContext<NonNullable<T>> : unknown;
type BranchBindingCheck<T, C> = Admission<SchemaOf<T>, Defaults<Configured<T>, Setting<T, 'toolContextSchema'>, C>, Setting<T, 'toolContextSchema'>, Registry<T>>
	& ToolInputAdmission<T, Defaults<Configured<T>, Setting<T, 'toolContextSchema'>, C>>
	& ([BoundExecutionContext<T, C>] extends [ToolExecutionContext<T>]
		? unknown : { readonly 'Bound context must remain compatible with the implementation': never });
type BindingChecks<T, C> = T extends unknown ? (check: BranchBindingCheck<T, C>) => void : never;
type BindingCheck<T, C> = BindingChecks<T, C> extends (check: infer Check) => void ? Check : never;
type ContextCheck<T, C> = NonNullable<T> extends { config: infer Config } ? BindingCheck<Config, C> : unknown;
type InvalidContext<T, C, PartialConfig extends boolean> = T extends unknown ? T extends null | undefined ? never
	: (T extends { bindToolContext: (...args: any[]) => any } ? T extends (...args: any[]) => any ? never : 'copied component' : never)
		| ([C] extends [RawContext<T> | (PartialConfig extends true ? undefined : never)] ? never : 'context')
		| (unknown extends ContextCheck<T, C> ? never : 'binding') : never;
type InvalidRegistryContexts<H extends Tools, M, PartialConfig extends boolean> = H extends unknown ? M extends unknown ? {
	[K in keyof H]: [InvalidContext<H[K], Selected<M, K>, PartialConfig>] extends [never] ? never : K
}[keyof H] : never : never;
// Validate complete configuration branches before projecting their tools and context.
export type InvalidToolContexts<T, PartialConfig extends boolean = false> = T extends unknown
	? InvalidRegistryContexts<Registry<T>, RegistryContext<T>, PartialConfig> : never;
export type ToolContexts<H extends Tools> = {
	[K in PossibleToolNames<H> as undefined extends RawContext<H[K]> ? never : K]: RawContext<H[K]>
} & {
	[K in PossibleToolNames<H> as undefined extends RawContext<H[K]> ? K : never]?: RawContext<H[K]>
};
type PrivateNames<S, D, T, H extends Tools> = Exclude<NamedKeys<D> | NamedKeys<Parsed<T>> | (PossibleFallbackNames<H> & NamedKeys<H>), PublicNames<S>>;
// Accepted public data cannot replace private fields, including through an open index signature.
type Execution<S, D, H extends Tools, M = EmptyMap> = OmitEach<MergedProperties<Output<S>, OmitEach<D, PublicNames<S>>>, '_toolOptions' | Extract<PossibleFallbackNames<H>, NamedKeys<H>>>
	& (string extends keyof H ? EmptyMap : Fallbacks<S, D, H, M>) & { _toolOptions: ComponentExecutionOptions };
type Guaranteed<I, D> = { [K in NamedKeys<I> & keyof I]-?: K extends NamedKeys<D> ? [D] extends [Record<K, I[K]>] ? K : never : never }[NamedKeys<I> & keyof I];
type IsUnion<T, Whole = T> = T extends Whole ? [Whole] extends [T] ? false : true : never;
// Open input accepts ordinary interfaces too. The complete-input check below
// still enforces the original catchall value type.
type CallConstraint<I> = { [K in keyof I]: string extends K ? any : I[K] };
export type CallShape<I, D> = true extends IsUnion<D> ? Partial<I>
	: I extends unknown ? OmitEach<CallConstraint<I>, Guaranteed<I, D>> & Partial<Pick<I, Guaranteed<I, D>>> : never;

// Some mapped/intersection inputs do not infer the key slot. Keep their actual
// input type, rather than turning a supplied object into an empty one.
type Supplied<A, K extends PropertyKey> = [K] extends [never] ? A : string extends K ? A : number extends K ? A : symbol extends K ? A
	: A extends unknown ? Pick<A, Extract<K, keyof A>> : never;
// An index signature cannot erase explicitly named private fields.
type SuppliedNames<A, K extends PropertyKey> = [K] extends [never] ? NamedKeys<A>
	: [Extract<PropertyKey, K>] extends [never] ? K : NamedKeys<A>;
type RequiredNames<I> = { [K in NamedKeys<I> & keyof I]-?: EmptyMap extends Pick<I, K> ? never : K }[NamedKeys<I> & keyof I];
// Optional schema fields permit omission only when configured values remain valid.
type OptionalDefaults<I, D, K extends keyof I = Exclude<NamedKeys<I> & keyof I, I extends unknown ? RequiredNames<I> : never>> = {
	[P in K]-?: [SelectedDefaults<D, P>] extends [Pick<I, P>] ? P : never;
}[K];
type Matches<I, E> = I extends unknown ? E extends I ? Exclude<RequiredNames<I>, NamedKeys<E>> extends never ? true : false : false : never;
type ClosedMatch<I, E> = I extends unknown ? true extends Matches<I, E> ? Exclude<keyof E, keyof I> extends never ? true : false : false : never;
type InvalidClosed<I, E> = E extends unknown ? true extends ClosedMatch<I, E> ? never : E : never;
type ClosedConflicts<I, E> = E extends unknown ? I extends unknown ? E extends I ? Exclude<keyof E, keyof I> : never : never : never;
type CanInvoke<I, D, A, P extends PropertyKey, C> = [EffectiveInput<I, D, A, P>] extends [I]
	? true extends Matches<I, EffectiveInput<I, D, A, P>>
	? [C] extends [false] ? true : [InvalidClosed<I, EffectiveInput<I, D, A, P>>] extends [never] ? true : false : false
	: false;
type KeyErrors<K extends PropertyKey, Reason extends string> = { [Key in K]: Readonly<Record<Reason, Key>> };
type RejectedKeys<I, K extends PropertyKey, Private extends PropertyKey, C> = KeyErrors<Extract<K, Private>, 'Private input key'>
	& (C extends true ? KeyErrors<Exclude<K, NamedKeys<I>>, 'Undeclared input key'> : unknown);
type EffectiveErrors<I, D, A, P extends PropertyKey, C> = CanInvoke<I, D, A, P, C> extends true ? unknown
	: I & KeyErrors<[C] extends [false] ? never : ClosedConflicts<I, EffectiveInput<I, D, A, P>>, 'Key retained by the shallow merge is outside the effective branch'>
	& { readonly 'Effective input must satisfy the complete schema': never };
type RegistryHelpers<T, B = ApplicationAlternatives<T>> = B extends { config: infer Config; schema: infer S }
	? Fallbacks<S, Configured<Config>, Registry<Config>, RegistryContext<Config>> : never;
// Run callbacks keep the component's original helper contract. Descriptor
// compatibility alone does not preserve helper availability or omitted input.
export type ValidateRunHelpers<T, Changes, Before = RegistryHelpers<T>, After = RegistryHelpers<MergedConfig<T, Changes>>,
	Invalid = { [K in keyof Before]: Pick<After, Extract<K, keyof After>> extends Pick<Before, K> ? never : K }[keyof Before],
> = [Extract<Setting<T, 'execute'> | Setting<T, 'prompt'>, (...args: any[]) => any>] extends [never] ? unknown
	: [Invalid] extends [never] ? unknown : `Config Error: Replacement changes the helper call contract for tool '${Invalid & string}'.`;
export type ApplicationCaller<T, R> = import('./input.js').ComponentCall<import('./input.js').ContextArguments<T>, Promise<R>, false, T>;

type Run<T, R, Settings> = EmptyMap extends Settings
	? <A extends object>(options?: A & Settings & ValidateRunConfig<A, T, Settings>) => Promise<R>
	: <A extends object>(options: A & Settings & ValidateRunConfig<A, T, Settings>) => Promise<R>;

type Setting<T, K extends PropertyKey> = DeclaredType<T, K>;
// Discover context across configurations, then make its fields optional if any branch lacks it.
export type Configured<T, C = T extends unknown ? 'context' extends keyof T ? T['context'] : undefined : never> =
	[NonNullable<C>] extends [never] ? EmptyMap : NonNullable<C> extends object
		? undefined extends C ? Partial<NonNullable<C>> : NonNullable<C> : EmptyMap;
type Registry<T> = [Extract<NonNullable<Setting<T, 'tools'>>, Tools>] extends [never] ? EmptyMap : Extract<NonNullable<Setting<T, 'tools'>>, Tools>;
type RegistryContext<T> = [NonNullable<Setting<T, 'toolsContext'>>] extends [never] ? EmptyMap : NonNullable<Setting<T, 'toolsContext'>>;
type SchemaOf<T> = Setting<T, 'inputSchema'>;
// A selected parser must accept the call whichever alternative is selected.
// Keep a native union schema intact: it is one parser accepting either branch.
type SchemaAlternatives<T, S = Exclude<SchemaOf<T>, undefined>> = [S] extends [never] ? { config: T; schema: undefined }
	: S extends unknown ? { config: T; schema: S | Extract<SchemaOf<T>, undefined> } : never;
type ApplicationAlternatives<T> = T extends unknown ? SchemaAlternatives<T> : never;
type ExecuteInput<T> = T extends { execute: (context: infer I, ...args: any[]) => any } ? unknown extends I ? Fields : NonNullable<I> : Fields;
export type ApplicationInput<T, S = SchemaOf<T>> = [Exclude<S, undefined>] extends [never]
	? OmitEach<ExecuteInput<T>, NamedKeys<Configured<T>> | PossibleFallbackNames<Registry<T>> | '_toolOptions'> : Input<Exclude<S, undefined>>;
type PrivateKeys<T, D = Configured<T>, S = SchemaOf<T>> = PrivateNames<undefined extends S ? undefined : S, D, Setting<T, 'toolContextSchema'>, Registry<T>>;
type IsClosed<S> = [Exclude<S, undefined>] extends [never] ? false : Closed<Exclude<S, undefined>>;
export type ApplicationShape<T, B = ApplicationAlternatives<T>> = B extends { config: infer Config; schema: infer S }
	? CallShape<ApplicationInput<Config, S>, Configured<Config>> : never;
export type CanOmitApplicationInput<T, B = ApplicationAlternatives<T>> = B extends { config: infer Config; schema: infer S }
	? CanInvoke<ApplicationInput<Config, S>, Configured<Config>, EmptyMap, PublicNames<S>, IsClosed<S>> : never;
type ApplicationCheck<T, A, S, K extends PropertyKey> = RejectedKeys<ApplicationInput<T, S>, SuppliedNames<A, K>, PrivateKeys<T, Configured<T>, S>, IsClosed<S>>
	& EffectiveErrors<ApplicationInput<T, S>, Configured<T>, Supplied<A, K>, PublicNames<S>, IsClosed<S>>;
type ApplicationChecks<T, A, K extends PropertyKey, B = ApplicationAlternatives<T>> = B extends { config: infer Config; schema: infer S }
	? (check: ApplicationCheck<Config, A, S, K>) => void : never;
// Infer the intersection of branch checks: a successful unknown must not erase another branch's errors.
export type CheckApplication<T, A, K extends PropertyKey = Keys<A>> = 0 extends (1 & A) ? unknown
	: [A] extends [never] ? unknown
	: ApplicationChecks<T, A, K> extends (check: infer Check) => void ? Check : never;
export type ApplicationRun<T, R, Settings = EmptyMap> = Run<T, R, Settings & import('./input.js').RunContext<T>
	& { abortSignal?: AbortSignal; toolsContext?: Partial<ToolContexts<Registry<T>>> | undefined }>;
export type SourceSetting<T, K extends string> = T extends Record<K, string> ? Partial<Record<K, string>> : Record<K, string>;
// Rebuild injected fields from the final config. Intersecting them with a
// retained callback's old helper signatures would restore obsolete overloads.
// A dependency missing in one configuration is readable as undefined, without
// mixing the values of the configurations where it is present.
type ExecutionDefaults<T, All> = Configured<T> & Partial<Record<Exclude<NamedKeys<Configured<All>>, NamedKeys<Configured<T>>>, never>>;
export type ExecutionContext<T, B = ApplicationAlternatives<T>> = B extends { config: infer Config; schema: infer S }
	? BranchExecutionContext<Config, S, ExecutionDefaults<Config, T>> : never;
type BranchExecutionContext<T, S, D> = [Exclude<S, undefined>] extends [never]
	? OmitEach<ExecuteInput<T>, '_toolOptions' | PossibleFallbackNames<Registry<T>>> & OmitEach<D, '_toolOptions' | PossibleFallbackNames<Registry<T>>>
		& Fallbacks<undefined, D, Registry<T>, RegistryContext<T>> & { _toolOptions: ComponentExecutionOptions }
	: Execution<Exclude<S, undefined>, D, Registry<T>, RegistryContext<T>>
		| (undefined extends S
			? OmitEach<MergedProperties<Input<Exclude<S, undefined>>, D>, '_toolOptions' | PossibleFallbackNames<Registry<T>>>
				& Fallbacks<undefined, D, Registry<T>, RegistryContext<T>> & { _toolOptions: ComponentExecutionOptions }
			: never);
type BoundExecutionContext<T, C = undefined, B = ApplicationAlternatives<T>> = B extends { config: infer Config; schema: infer S }
	? Execution<S, Defaults<ExecutionDefaults<Config, T>, Setting<Config, 'toolContextSchema'>, C>, Registry<Config>, RegistryContext<Config>> : never;
// Tool context is absent on ordinary calls. Preserve that absence even when an
// empty parsed object contributes a never index signature to the context union.
type OrdinaryToolContext<T, C = ExecutionContext<T>> = C extends unknown ? C & {
	[P in NamedKeys<Parsed<Setting<T, 'toolContextSchema'>>> as P extends keyof C ? [C[P]] extends [never] ? P : never : never]?: never;
} : never;
export type ToolExecutionContext<T> = OrdinaryToolContext<T> | BoundExecutionContext<T>;
export type ComponentResult<T, S = Setting<T, 'schema'>> = S extends Schema ? Parsed<S>
	: T extends { execute: (...args: any[]) => infer R } ? Awaited<R> : unknown;
export type CollectedResult<T, S = Setting<T, 'schema'>> = S extends StreamSchema<any, infer O, infer K> ? K extends 'text' ? string : O[] : ComponentResult<T, S>;
export type ToolOutputAdmission<T, R = ComponentResult<T>> = Setting<T, 'schema'> extends StreamSchema<any, any, any> ? unknown
	: unknown extends R ? unknown : [R] extends [never] ? unknown
	: [R] extends [AsyncIterable<unknown>] ? { readonly 'Tool streams require a declared stream schema': never } : unknown;
// Ordinary calls can merge union defaults. SDK tool projection cannot rewrite
// root alternatives; keep that restriction at tool construction/binding only.
type HasRootAlternatives<S, Depth extends unknown[] = []> = Depth['length'] extends 12 ? false
	: S extends z.core.$ZodUnion ? true
	: S extends z.core.$ZodPipe<infer I, infer O> ? HasRootAlternatives<I extends z.core.$ZodTransform ? O : I, [...Depth, 0]>
	: S extends z.core.$ZodLazy<infer I> ? HasRootAlternatives<I, [...Depth, 0]>
	: S extends z.core.$ZodIntersection<infer L, infer R> ? HasRootAlternatives<L | R, [...Depth, 0]>
	: S extends { _zod: { def: { innerType: infer I } } } ? HasRootAlternatives<I, [...Depth, 0]> : false;
type InvalidToolProjection<T, D, B = ApplicationAlternatives<T>> = B extends { config: infer Config; schema: infer S } ? true extends HasRootAlternatives<S>
	? [Extract<NamedKeys<[D] extends [never] ? Configured<Config> : D>, PublicNames<S>>] extends [never] ? never : B : never : never;
// Inspect raw object policies, including preprocessors whose raw type is unknown.
// Opaque schemas retain runtime metadata admission; no callbacks discover shapes.
type OpenToolInput<S, Depth extends unknown[] = []> = unknown extends S ? false : Depth['length'] extends 12 ? false
	: S extends z.core.$ZodObject<infer _Shape, infer Policy> ? string extends keyof Policy['in'] ? Policy['in'][string] extends never ? false : true : false
	: S extends z.core.$ZodRecord ? true
	: S extends z.core.$ZodPipe<infer I, infer O> ? OpenToolInput<I extends z.core.$ZodTransform ? O : I, [...Depth, 0]>
	: S extends z.core.$ZodLazy<infer I> ? OpenToolInput<I, [...Depth, 0]>
	: S extends z.core.$ZodUnion<infer B> ? OpenToolInput<B[number], [...Depth, 0]>
	: S extends z.core.$ZodIntersection<infer L, infer R> ? OpenToolInput<L | R, [...Depth, 0]>
	: S extends { _zod: { def: { innerType: infer I } } } ? OpenToolInput<I, [...Depth, 0]>
	: false;
export type ToolInputAdmission<T, D = never> =
	(true extends OpenToolInput<SchemaOf<T>> ? { readonly 'Tool input requires a closed root object; nest dynamic keys in a declared field': never } : unknown)
	& ([InvalidToolProjection<T, D>] extends [never] ? unknown : { readonly 'Tool public defaults require an independent object schema': never });
type OwnedDependencies<T> = OmitEach<Configured<T>, '_toolOptions' | PossibleFallbackNames<Registry<T>>>
	& Fallbacks<undefined, Configured<T>, Registry<T>, RegistryContext<T>> & { _toolOptions: ComponentExecutionOptions };
type OwnedCheck<T> = [OwnedDependencies<T>] extends [Pick<ExecuteInput<T>, Extract<keyof ExecuteInput<T>, NamedKeys<Configured<T>> | PossibleFallbackNames<Registry<T>> | '_toolOptions'>>]
	? unknown : { readonly 'Configured private dependencies must satisfy the callback': never };
type BranchAdmission<T, S> = [Exclude<S, undefined>] extends [never] ? OwnedCheck<T>
	: Admission<S, Configured<T>, Setting<T, 'toolContextSchema'>, Registry<T>> & InputAdmission<Exclude<S, undefined>> & ContextAdmission<Setting<T, 'toolContextSchema'>>;
type AdmissionChecks<T, B = ApplicationAlternatives<T>> = B extends { config: infer Config; schema: infer S } ? (check: BranchAdmission<Config, S>) => void : never;
export type ComponentAdmission<T> = AdmissionChecks<T> extends (check: infer Check) => void ? Check : never;
export type BindToolContext<T, R> = <C extends ContextInput<T>>(context: C
	& NoInfer<BindingCheck<T, C>>) => {
	readonly context: Readonly<C>;
	readonly tool: Tool<Output<SchemaOf<T>>, R, Setting<T, 'toolContextSchema'> extends Schema ? Parsed<Setting<T, 'toolContextSchema'>> : unknown>;
};
