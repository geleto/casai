// Runtime matrices deliberately exercise different components and invalid JavaScript inputs.
// Public call contracts are checked separately in the compile-only consumer tests.
export function runtimeRun<C extends { run: (...args: never[]) => unknown }>(component: C, settings?: unknown): ReturnType<C['run']> {
	return (component.run as (settings: unknown) => ReturnType<C['run']>)(settings);
}
