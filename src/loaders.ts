import { raceLoaders } from 'cascada-engine';
import type { ILoaderAny, LoaderInterface } from 'cascada-engine';

export const RACE_GROUP_TAG = Symbol.for('casai.raceGroup');
export const MERGED_GROUP_TAG = Symbol.for('casai.mergedGroup');

export interface RaceGroup {
	[RACE_GROUP_TAG]: true;
	loaders: ILoaderAny[];
	groupName: string | null;
}
interface NamedGroup {
	firstIndex: number;
	collectedLoaders: ILoaderAny[];
}

// A named race group is Cascada's race loader, which resolves relative paths through the member that
// loaded each source, tagged so later merges can combine groups with the same name.
export type RaceLoader = LoaderInterface & {
	[MERGED_GROUP_TAG]: true;
	groupName: string;
	loaders: ILoaderAny[];
};

export function createRaceLoader(loaders: ILoaderAny[], groupName: string): RaceLoader {
	if (!groupName.trim()) {
		throw new Error('RaceLoader groupName must be a non-empty string.');
	}
	return Object.assign(raceLoaders(loaders), { [MERGED_GROUP_TAG]: true as const, groupName, loaders });
}

function isRaceGroup(obj: any): obj is RaceGroup {
	return typeof obj === 'object' && obj !== null && RACE_GROUP_TAG in obj;
}
function isRaceLoader(obj: any): obj is RaceLoader {
	return typeof obj === 'object' && obj !== null && MERGED_GROUP_TAG in obj;
}

export function race(loaders: ILoaderAny | ILoaderAny[], groupName?: string): RaceGroup {
	return {
		[RACE_GROUP_TAG]: true,
		loaders: Array.isArray(loaders) ? loaders : [loaders],
		groupName: groupName ?? null,
	};
}

// This is the core logic. The public functions are wrappers around it.
// It returns the final, executable list of loaders.
function _processAndDeduplicate(
	loaders: (ILoaderAny | RaceGroup | RaceLoader)[]
): ILoaderAny[] {
	const namedGroups = new Map<string, NamedGroup>();
	const processedChain: (ILoaderAny | RaceGroup | RaceLoader | null)[] = [];

	// Pass 1: Identify groups and build a preliminary chain with placeholders.
	for (let i = 0; i < loaders.length; i++) {
		const loader = loaders[i];

		if (isRaceGroup(loader)) {
			// RaceGroup carries a (possibly null) name directly.
			const groupName = loader.groupName;
			if (groupName) { // Named group
				const existingGroup = namedGroups.get(groupName);
				if (!existingGroup) {
					namedGroups.set(groupName, {
						firstIndex: i,
						collectedLoaders: [...loader.loaders],
					});
				} else {
					existingGroup.collectedLoaders.push(...loader.loaders);
				}
				processedChain.push(null);
			} else { // Anonymous group
				processedChain.push(loader);
			}
		} else if (isRaceLoader(loader)) {
			// A RaceLoader is always named; createRaceLoader rejects blank names.
			const groupName = loader.groupName;
			const existingGroup = namedGroups.get(groupName);
			if (!existingGroup) {
				namedGroups.set(groupName, {
					firstIndex: i,
					collectedLoaders: [...loader.loaders],
				});
			} else {
				existingGroup.collectedLoaders.push(...loader.loaders);
			}
			processedChain.push(null);
		} else {
			processedChain.push(loader);
		}
	}

	// Pass 2: Create RaceLoader implementations, replacing placeholders.
	for (const [groupName, { firstIndex, collectedLoaders }] of namedGroups.entries()) {
		// NOTE: Deduplication is by object identity. Two distinct instances of a loader
		// class configured identically will be treated as separate loaders.
		const deduplicatedLoaders = collectedLoaders.filter((loader, index, array) => array.indexOf(loader) === index);

		if (deduplicatedLoaders.length > 0) {
			processedChain[firstIndex] = createRaceLoader(deduplicatedLoaders, groupName);
		} else if ((typeof process === 'undefined' || process.env.NODE_ENV !== 'production')) {
			// IMPROVEMENT: Warn developers about silently dropped empty named groups.
			console.warn(`Casai Loader: Named race group "${groupName}" was discarded because it became empty after deduplication.`);
		}
	}

	// Final Pass: Build the final list with correct deduplication and order.
	const finalResult: ILoaderAny[] = [];
	const seen = new Set<ILoaderAny>();

	for (const item of processedChain) {
		if (item === null) continue;

		if (isRaceLoader(item)) {
			// Use the collected loaders for this named group to preserve cross-merge order.
			const groupInfo = namedGroups.get(item.groupName);
			if (groupInfo) {
				const uniqueConstituents = item.loaders.filter(l => !seen.has(l));
				if (uniqueConstituents.length > 0) {
					const finalRaceLoader =
						uniqueConstituents.length === item.loaders.length
							? item
							: createRaceLoader(uniqueConstituents, item.groupName);
					finalResult.push(finalRaceLoader);
					uniqueConstituents.forEach(l => seen.add(l));
				}
			}
		} else if (isRaceGroup(item)) { // Anonymous race group
			const uniqueLoaders = item.loaders.filter(loader => {
				if (seen.has(loader)) return false;
				seen.add(loader);
				return true;
			});
			if (uniqueLoaders.length > 0) {
				uniqueLoaders.forEach(l => seen.add(l));
				// IMPROVEMENT: Avoid wrapper for single-loader groups.
				finalResult.push(
					uniqueLoaders.length === 1 ? uniqueLoaders[0] : raceLoaders(uniqueLoaders)
				);
			}
		} else { // Regular loader
			if (!seen.has(item)) {
				finalResult.push(item);
				seen.add(item);
			}
		}
	}
	return finalResult;
}

export function mergeLoaders(
	parentLoaders: (ILoaderAny | RaceGroup | RaceLoader)[],
	childLoaders: (ILoaderAny | RaceGroup | RaceLoader)[]
): ILoaderAny[] {
	const combined = [...childLoaders, ...parentLoaders];
	return _processAndDeduplicate(combined);
}

export function processLoaders(
	load: (ILoaderAny | RaceGroup | RaceLoader)[] | ILoaderAny | RaceGroup | RaceLoader
): ILoaderAny[] {
	const loaders = Array.isArray(load) ? load : [load];
	return _processAndDeduplicate(loaders);
}
