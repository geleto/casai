import type { ILoaderAny } from 'cascada-engine';

export type CascadaFilters = Record<string, (input: any, ...args: any[]) => any>;

export type CascadaLoaders = ILoaderAny | ILoaderAny[];
