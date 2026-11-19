import { configMapKeys } from '../types/merge.js';
import type { MergedConfig } from '../types/merge.js';
import { resolveLoader, type LoaderInput } from '../loaders.js';

/**
 * Merge partial configs using the shared map and loader policies.
 */
export function mergeConfigs<
	TParent extends Record<PropertyKey, any>,
	TChild extends Record<PropertyKey, any>
>(
	parentConfig: TParent,
	childConfig: TChild,
): MergedConfig<TParent, TChild> {
	const merged: Record<PropertyKey, unknown> = { ...parentConfig, ...childConfig };
	if (merged.debug) console.log('[DEBUG] mergeConfigs called');
	if (Array.isArray(merged.prompt)) merged.prompt = [...merged.prompt as unknown[]];

	// Now handle known deep merges:
	for (const key of configMapKeys) {
		if (key in parentConfig && key in childConfig) {
			const parentMap = parentConfig[key] as Record<string, unknown> | undefined;
			const childMap = childConfig[key] as Record<string, unknown> | undefined;
			merged[key] = { ...parentMap ?? {}, ...childMap ?? {} };
		} else if (merged[key] !== undefined) {
			merged[key] = { ...merged[key] as Record<string, unknown> };
		}
	}

	if ('loader' in parentConfig || 'loader' in childConfig) {
		merged.loader = resolveLoader(childConfig.loader as LoaderInput | undefined, parentConfig.loader as LoaderInput | undefined);
	}

	return merged as MergedConfig<TParent, TChild>;
}
