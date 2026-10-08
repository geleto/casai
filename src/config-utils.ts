import { configMapKeys } from './types/merge.js';
import type { MergedConfig, ProcessedConfig } from './types/merge.js';
import * as configs from './types/config.js';
import type { ModelMessage } from 'ai';
import { mergeLoaders, processLoaders, type RaceGroup, type RaceLoader } from './loaders.js';
import type { ILoaderAny } from 'cascada-engine';
import { validateConfigBasics } from './validate.js';

export function processConfig<T extends Partial<configs.LoaderConfig> & Record<string, any>>(
	config: T
): ProcessedConfig<T> {
	validateConfigBasics(config);
	if ('loader' in config && config.loader) {
		const loader = processLoaders(config.loader);
		return { ...config, loader };
	}
	return config;
}

/**
 * Merge partial configs using the shared map, message and loader policies.
 */
export function mergeConfigs<
	TParent extends Record<string, any>,
	TChild extends Record<string, any>
>(
	parentConfig: TParent,
	childConfig: TChild
): MergedConfig<TParent, TChild> {
	// Validate raw values before map/message/loader merging can consume them.
	validateConfigBasics(childConfig);
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

	// Now handle known deep merges:
	for (const key of configMapKeys) {
		if (key in parentConfig && key in childConfig) {
			const parentMap = parentConfig[key] as Record<string, unknown> | undefined;
			const childMap = childConfig[key] as Record<string, unknown> | undefined;
			merged[key] = { ...parentMap ?? {}, ...childMap ?? {} };
		}
	}

	const parentLoaders = ('loader' in parentConfig) ? (parentConfig.loader
		? Array.isArray(parentConfig.loader)
			? parentConfig.loader
			: [parentConfig.loader]
		: []) as (ILoaderAny | RaceGroup | RaceLoader)[] : undefined;

	const childLoaders = ('loader' in childConfig) ? (childConfig.loader
		? Array.isArray(childConfig.loader)
			? childConfig.loader
			: [childConfig.loader]
		: []) as (ILoaderAny | RaceGroup | RaceLoader)[] : undefined;

	if (parentLoaders && childLoaders) {
		merged.loader = mergeLoaders(parentLoaders, childLoaders);
	} else if (childLoaders) {
		merged.loader = processLoaders(childLoaders);
	} else if (parentLoaders) {
		merged.loader = processLoaders(parentLoaders);
	}

	if ('messages' in parentConfig && 'messages' in childConfig) {
		const parentMessages = (parentConfig as { messages?: ModelMessage[] }).messages ?? [];
		const childMessages = (childConfig as { messages?: ModelMessage[] }).messages ?? [];
		merged.messages = [
			...parentMessages,
			...childMessages,
		];
	}

	// Debug output for merged result if debug is enabled
	/* if (debugEnabled) {
		console.log('[DEBUG] mergeConfigs result:', merged);
	} */

	return merged as MergedConfig<TParent, TChild>;
}
