import type { PromptType } from '../types/prompt.js';
import type { EmptyMap } from '../types/utils.js';

// Declaration merging gives separately loaded package copies the same key type,
// matching Symbol.for at runtime. This interface creates no global runtime value.
declare global {
	interface CasaiModifierSymbols {
		readonly sourceMode: unique symbol;
		readonly toolMode: unique symbol;
		readonly streamMode: unique symbol;
	}
}

/** Internal structural metadata: configuration spreads and inheritance retain the selected source. */
export const sourceMode: CasaiModifierSymbols['sourceMode'] = Symbol.for('casai.sourceMode') as CasaiModifierSymbols['sourceMode'];
export const toolMode: CasaiModifierSymbols['toolMode'] = Symbol.for('casai.toolMode') as CasaiModifierSymbols['toolMode'];
export const streamMode: CasaiModifierSymbols['streamMode'] = Symbol.for('casai.streamMode') as CasaiModifierSymbols['streamMode'];

export function modifierSettingsError(settings: object, invocation = false): string | undefined {
	for (const [key, modifier] of [['asTool', '.asTool'], ['streaming', '.asStream']] as const) {
		if (key in settings) return `'${key}' is not a setting. Select ${modifier} on Config or a component factory.`;
	}
	if ('promptType' in settings) return "'promptType' is not a setting. Select a source on Config or a component factory with .withText, .withTemplate, .withScript, .withFunction or a .loads… modifier.";
	if (invocation && [sourceMode, toolMode, streamMode].some(key => key in settings)) return 'Modifiers belong in configuration. Pass the Config fragment to a component factory.';
	return undefined;
}

export interface ToolModeSetting<T = true | undefined> { readonly [toolMode]?: T }
export interface StreamModeSetting<T = true | undefined> { readonly [streamMode]?: T }
export interface ResolvedToolMode<T> { readonly [toolMode]: T }
export interface ResolvedStreamMode<T> { readonly [streamMode]: T }
export interface EnabledToolMode { readonly [toolMode]: true }
export interface EnabledStreamMode { readonly [streamMode]: true }
export type ModifierKey = typeof sourceMode | typeof toolMode | typeof streamMode;

export type RetainedModifiers<T> = RetainedSourceMode<T>
	& (typeof toolMode extends keyof T ? EmptyMap extends Pick<T, typeof toolMode> ? ToolModeSetting<T[typeof toolMode]> : ResolvedToolMode<T[typeof toolMode]> : unknown)
	& (typeof streamMode extends keyof T ? EmptyMap extends Pick<T, typeof streamMode> ? StreamModeSetting<T[typeof streamMode]> : ResolvedStreamMode<T[typeof streamMode]> : unknown);

export interface SourceModeSetting<P = PromptType> {
	readonly [sourceMode]?: P;
}

/** Named metadata keeps inferred component declarations portable without exposing the symbol. */
export interface ResolvedSourceMode<P> {
	readonly [sourceMode]: P;
}

export type RetainedSourceMode<T> = typeof sourceMode extends keyof T
	? EmptyMap extends Pick<T, typeof sourceMode> ? SourceModeSetting<T[typeof sourceMode]> : ResolvedSourceMode<T[typeof sourceMode]>
	: unknown;

export type WithoutSourceMode<T> = typeof sourceMode extends keyof T
	? Omit<T, typeof sourceMode> : T;
