import type { PromptType } from '../types/prompt.js';
import type { EmptyMap } from '../types/utils.js';

// Declaration merging gives separately loaded package copies the same key type,
// matching Symbol.for at runtime. This interface creates no global runtime value.
declare global {
	interface CasaiSourceSymbols {
		readonly sourceMode: unique symbol;
	}
}

/** Internal structural metadata: configuration spreads and inheritance retain the selected source. */
export const sourceMode: CasaiSourceSymbols['sourceMode'] = Symbol.for('casai.sourceMode') as CasaiSourceSymbols['sourceMode'];

export function sourceSettingsError(settings: object, invocation = false): string | undefined {
	if ('promptType' in settings) return "'promptType' is not a setting. Select a source on Config or a component factory with .withText, .withTemplate, .withScript, .withFunction or a .loads… modifier.";
	if (invocation && Object.hasOwn(settings, sourceMode)) return 'Source modifiers belong in configuration. Pass the Config fragment to a component factory.';
	return undefined;
}

export interface SourceModeSetting<P = PromptType> {
	readonly [sourceMode]?: P;
}

/** Named metadata keeps inferred component declarations portable without exposing the symbol. */
export interface ResolvedSourceMode<P> {
	readonly [sourceMode]: P;
}

/** Authored settings default locally; annotations of prepared fragments retain their selected mode. */
export type AnnotatedSourceMode<Modes extends PromptType, Default extends Modes> = SourceModeSetting<Default | undefined>
	| { [P in Exclude<Modes, Default>]: ResolvedSourceMode<P> }[Exclude<Modes, Default>];

export type RetainedSourceMode<T> = typeof sourceMode extends keyof T
	? EmptyMap extends Pick<T, typeof sourceMode> ? SourceModeSetting<T[typeof sourceMode]> : ResolvedSourceMode<T[typeof sourceMode]>
	: unknown;

export type WithoutSourceMode<T> = typeof sourceMode extends keyof T
	? Omit<T, typeof sourceMode> : T;
