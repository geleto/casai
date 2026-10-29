import { raceLoaders } from 'cascada-engine';
import type { LoaderGroup } from 'cascada-engine';
import { ConfigError } from './errors.js';

const parentLoader = '~casaiParentLoader';

/** An inheritance directive for the whole loader property. */
export interface ParentLoader {
	readonly [parentLoader]: 'race' | 'override';
	readonly group: LoaderGroup;
}

export type LoaderInput = LoaderGroup | ParentLoader;

export function raceParent(group: LoaderGroup): ParentLoader {
	return { [parentLoader]: 'race', group };
}

export function overrideParent(group: LoaderGroup): ParentLoader {
	return { [parentLoader]: 'override', group };
}

function isParentLoader(value: unknown): value is ParentLoader {
	return value !== null && typeof value === 'object' && parentLoader in value;
}

function validateGroup(group: LoaderGroup): void {
	if (isParentLoader(group)) throw new ConfigError('Parent loader directives must occupy the whole loader property.');
	if (Array.isArray(group)) for (const member of group) validateGroup(member);
}

/** Resolve inheritance once, retaining native group boundaries and loader identities. */
export function resolveLoader(child: LoaderInput | null | undefined, parent?: LoaderInput | null): LoaderGroup | undefined {
	const inherited = isParentLoader(parent) ? resolveLoader(parent) : parent ?? undefined;
	if (child == null) return inherited;
	if (isParentLoader(child)) {
		validateGroup(child.group);
		return child[parentLoader] === 'override' || inherited === undefined ? child.group : raceLoaders([child.group, inherited]);
	}
	validateGroup(child);
	return inherited === undefined ? child : [child, inherited];
}
