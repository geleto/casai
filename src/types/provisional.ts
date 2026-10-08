// TypeScript resolves a call with inline callbacks in two passes. The first pass skips those callbacks
// and checks the call with each unresolved config type parameter set to its constraint. If validation
// rejects that provisional config, TypeScript drops the overload and never infers the actual config.
// Factory config constraints therefore use Provisional, and validators accept the marked config.
import type { EmptyMap } from './merge.js';

declare const provisionalConfig: unique symbol;

export interface ProvisionalConfig { readonly [provisionalConfig]?: never }

export type Provisional<TShape> = TShape & ProvisionalConfig;

// Validation applies once TypeScript has inferred the actual config.
export type ValidateResolved<TConfig, TValidation> = NoInfer<typeof provisionalConfig extends keyof TConfig ? unknown : TValidation>;

// An empty argument has no inference candidates, so TypeScript retains the provisional constraint.
// That constraint describes possible settings; none of them were actually configured.
export type ResolvedConfig<T> = typeof provisionalConfig extends keyof T ? EmptyMap : T;
