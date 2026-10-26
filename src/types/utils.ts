export type Fields = Record<string, unknown>;

export type UnionKeys<T> = T extends unknown ? keyof T : never;

// A successful alternative must not erase another alternative's failure.
export type InvalidUnionMembers<T, Shape> = T extends unknown
	? [StrictUnionSubtype<T, Shape>] extends [never] ? T : never : never;

// Ensures T is an exact match of one of the union members in U
// Prevents extra properties and mixing properties from different union types
export type StrictUnionSubtype<T, U> = U extends any
	? T extends U
	? Exclude<keyof T, keyof U> extends never ? T : never
	: never
	: never;

export type ConditionalPromise<T, IsAsync extends boolean> = IsAsync extends true ? Promise<T> : T;

// Finite declared names, excluding broad string/number/symbol index signatures.
export type NamedKeys<TValue> = TValue extends unknown ? keyof {
	[TKeys in keyof TValue as string extends TKeys ? never : number extends TKeys ? never : symbol extends TKeys ? never : TKeys]: TValue[TKeys];
} : never;

// Homomorphic removal preserves explicit properties beside an open index signature.
export type DistributiveOmit<TValue, TKeys extends PropertyKey> = TValue extends unknown ? { [P in keyof TValue as P extends TKeys ? never : P]: TValue[P] } : never;

export type NonArrayObject<TValue> = TValue extends readonly unknown[] ? never : TValue extends object ? TValue : never;

// eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type -- An absent map has no keys.
export type EmptyMap = Record<never, never>;

// Flexible application context; Fields is used where values must remain unknown.
export type Context = Record<string, any>;
