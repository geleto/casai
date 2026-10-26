import type { EmptyMap } from './utils.js';

declare const provisionalConfig: unique symbol;

// Type-only key: no symbol is created and no property is attached to configuration objects.
interface ProvisionalConfig { readonly [provisionalConfig]?: never }

export type Provisional<TShape> = TShape & ProvisionalConfig;

// Validation applies once TypeScript has inferred the actual config.
export type ValidateResolved<TConfig, TValidation> = NoInfer<typeof provisionalConfig extends keyof TConfig ? unknown : TValidation>;

// An empty argument has no inference candidates, so TypeScript retains the provisional constraint.
// That constraint describes possible settings; none of them were actually configured.
export type ResolvedConfig<T> = typeof provisionalConfig extends keyof T ? EmptyMap : T;
