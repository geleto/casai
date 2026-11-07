import type { EmptyMap } from './utils.js';

export declare const provisionalConfig: unique symbol;

// Type-only key: no symbol is created and no property is attached to configuration objects.
interface ProvisionalConfig { readonly [provisionalConfig]?: never }

export type Provisional<TShape> = TShape & ProvisionalConfig;

// Validate inferred configuration, keeping diagnostic strings visible beside object constraints.
export type ValidateResolved<TConfig, TValidation> = NoInfer<typeof provisionalConfig extends keyof TConfig ? unknown
	: TValidation extends string ? Readonly<Record<TValidation, never>> : TValidation>;

// An empty argument has no inference candidates, so TypeScript retains the provisional constraint.
// That constraint describes possible settings; none of them were actually configured.
export type ResolvedConfig<T> = typeof provisionalConfig extends keyof T ? EmptyMap : T;
