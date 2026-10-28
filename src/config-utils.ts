import { ConfigError, ValidationError } from './errors.js';
import { configMapKeys } from './types/merge.js';
import type { MergedConfig, ProcessedConfig } from './types/merge.js';
import * as configs from './types/config.js';
import { mergeLoaders, processLoaders, type CasaiAILoader } from './loaders.js';
import { validateConfigBasics } from './validate.js';

export function processConfig<T extends Partial<configs.LoaderConfig> & Record<string, any>>(
	config: T
): ProcessedConfig<T> {
	validateConfigBasics(config);
	const processed = { ...config };
	for (const key of configMapKeys) {
		if (config[key] !== undefined) Object.assign(processed, { [key]: { ...config[key] as Record<string, unknown> } });
	}
	if (Array.isArray(config.prompt)) Object.assign(processed, { prompt: [...config.prompt as unknown[]] });
	if ('loader' in config && config.loader) {
		const loader = processLoaders(config.loader);
		return { ...processed, loader };
	}
	return processed;
}

/**
 * Merge partial configs using the shared map and loader policies.
 */
export function mergeConfigs<
	TParent extends Record<string, any>,
	TChild extends Record<string, any>
>(
	parentConfig: TParent,
	childConfig: TChild,
	ErrorClass: typeof ConfigError | typeof ValidationError = ConfigError,
): MergedConfig<TParent, TChild> {
	// Validate raw values before map/loader merging can consume them.
	validateConfigBasics(childConfig, ErrorClass);
	// Evaluate debug logging using the most specific config (child overrides parent).
	const childHasDebug = Object.prototype.hasOwnProperty.call(childConfig, 'debug');
	const debugEnabled = childHasDebug
		? Boolean(childConfig.debug)
		: Boolean(parentConfig.debug);

	if (debugEnabled) {
		console.log('[DEBUG] mergeConfigs called with:', { parentConfig, childConfig });
	}

	// Start shallow merge
	const merged: Record<string, unknown> = { ...parentConfig, ...childConfig };
	if (parentConfig.streaming === true || childConfig.streaming === true) merged.streaming = true;
	if (parentConfig.asTool === true || childConfig.asTool === true) merged.asTool = true;
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

	const parentLoaders = ('loader' in parentConfig) ? (parentConfig.loader
		? Array.isArray(parentConfig.loader)
			? parentConfig.loader
			: [parentConfig.loader]
		: []) as CasaiAILoader[] : undefined;

	const childLoaders = ('loader' in childConfig) ? (childConfig.loader
		? Array.isArray(childConfig.loader)
			? childConfig.loader
			: [childConfig.loader]
		: []) as CasaiAILoader[] : undefined;

	if (parentLoaders && childLoaders) {
		merged.loader = mergeLoaders(parentLoaders, childLoaders);
	} else if (childLoaders) {
		merged.loader = processLoaders(childLoaders);
	} else if (parentLoaders) {
		merged.loader = processLoaders(parentLoaders);
	}

	return merged as MergedConfig<TParent, TChild>;
}
