/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- Assignability assertions and generic function comparisons intentionally use each type parameter once. */
// Declarations only: this suite is compiled, never executed.
export declare function expectType<T>(value: T): void;

export type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
	? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false
	: false;

// Unlike assignment, equality also rejects accidental any or unknown widening.
export declare function expectEqual<Actual, Expected>(...args: Equal<Actual, Expected> extends true ? [] : [never]): void;
