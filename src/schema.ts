import { asSchema } from 'ai';
import type { FlexibleSchema } from 'ai';
import { safeValidateTypes } from '@ai-sdk/provider-utils';
import type * as core from 'zod/v4/core';
import { ConfigError } from './errors.js';

export type Fields = Record<string, unknown>;
export type JSONSchema = Awaited<ReturnType<typeof asSchema>['jsonSchema']>;

export function requireContextObject(value: unknown): Fields {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new ConfigError('Expected an object context.');
	}
	return value as Fields;
}

export function snapshot(value: unknown): unknown {
	return isPlainObject(value) ? { ...value } : value;
}

export function isPlainObject(value: unknown): value is Fields {
	return value !== null && typeof value === 'object'
		&& (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function sameContext(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (!isPlainObject(left) || !isPlainObject(right)) return false;
	const keys = ownKeys(left);
	return keys.length === ownKeys(right).length
		&& keys.every(key => Object.hasOwn(right, key) && Object.is(Reflect.get(left, key), Reflect.get(right, key)));
}

export function ownKeys(value: object): PropertyKey[] {
	return Reflect.ownKeys(value).filter(key => Object.prototype.propertyIsEnumerable.call(value, key));
}

// Retain the envelope: a callable `then` inside input/context is data, not a promise.
export async function parseSchema(schema: FlexibleSchema<unknown>, value: unknown, boundary?: string): Promise<{ value: unknown }> {
	try {
		const result = await safeValidateTypes({ schema, value });
		if (!result.success) throw result.error;
		return result;
	} catch (error) {
		if (boundary === undefined) throw error;
		// Native errors can include private values. Preserve them for trusted diagnostics only.
		throw new ConfigError(`${boundary} validation failed.`, error instanceof Error ? error : new Error(String(error)));
	}
}

// Zod 4's core definitions work across installations and Classic/Mini. Constructor
// identity does not. Read declarations only, resolving lazy schemas through
// Zod's cached getter; never run validation/preprocessing callbacks.
function zod4Definition(schema: unknown) {
	return schema !== null && typeof schema === 'object' && '_zod' in schema
		? (schema as core.$ZodTypes)._zod.def : undefined;
}

function objectNames(schema: unknown): string[] | undefined {
	const current = zod4Definition(schema);
	return current?.type === 'object' ? Object.keys(current.shape) : undefined;
}

function unwrap(schema: unknown, output: boolean): unknown {
	const current = zod4Definition(schema);
	switch (current?.type) {
		case 'pipe': return output ? current.out : current.in;
		case 'optional': case 'nullable': case 'default': case 'prefault':
		case 'catch': case 'readonly': case 'nonoptional': return current.innerType;
	}
	return undefined;
}

function branches(schema: unknown): readonly unknown[] | undefined {
	const current = zod4Definition(schema);
	if (current?.type === 'union') return current.options;
	if (current?.type === 'intersection') return [current.left, current.right];
	return undefined;
}

export function validateSchemaVersion(schema: unknown): void {
	if (schema !== null && typeof schema === 'object' && !('_zod' in schema) && '_def' in schema
		&& schema._def !== null && typeof schema._def === 'object' && 'typeName' in schema._def
		&& typeof schema._def.typeName === 'string' && schema._def.typeName.startsWith('Zod')) {
		throw new ConfigError('Casai schemas require Zod 4. Zod 3 is not supported.');
	}
}

function rawObjectNames(schema: unknown, depth = 0, union = false, tool = false): string[] | undefined {
	if (depth === 12) return undefined;
	const names = objectNames(schema);
	const current = zod4Definition(schema);
	if (names !== undefined) {
		if (tool && current?.type === 'object' && current.catchall !== undefined && zod4Definition(current.catchall)?.type !== 'never') {
			throw new ConfigError('Tool input requires a closed root object. Put dynamic keys inside a declared field.');
		}
		return names;
	}
	if (union && current?.type === 'union') {
		const declared = current.options.map(option => rawObjectNames(option, depth + 1, false, tool));
		if (declared.some(value => value === undefined)) throw new ConfigError('Input unions require one level of declared object branches.');
		return [...new Set(declared.flatMap(value => value ?? []))];
	}
	if (current?.type === 'pipe' && zod4Definition(current.in)?.type === 'transform') {
		return rawObjectNames(current.out, depth + 1, union, tool);
	}
	if (current?.type === 'lazy') return rawObjectNames((schema as core.$ZodLazy)._zod.innerType, depth + 1, union, tool);
	if (current?.type === 'intersection') {
		const left = rawObjectNames(current.left, depth + 1, false, tool);
		const right = rawObjectNames(current.right, depth + 1, false, tool);
		return left === undefined || right === undefined ? undefined : [...new Set([...left, ...right])];
	}
	const inner = unwrap(schema, false);
	return inner === undefined ? undefined : rawObjectNames(inner, depth + 1, union, tool);
}

export function contextNames(schema: unknown, seen = new Set<unknown>()): string[] {
	if (seen.has(schema)) return [];
	seen.add(schema);
	const names = objectNames(schema);
	if (names !== undefined) return names;
	if (zod4Definition(schema)?.type === 'lazy') return contextNames((schema as core.$ZodLazy)._zod.innerType, seen);
	const options = branches(schema);
	if (options) return [...new Set(options.flatMap(option => contextNames(option, seen)))];
	const inner = unwrap(schema, true);
	return inner === undefined ? [] : contextNames(inner, seen);
}

function metadataNames(schema: JSONSchema | boolean, tool = false): string[] {
	if (typeof schema === 'boolean' || schema.$ref !== undefined || schema.anyOf !== undefined
		|| schema.oneOf !== undefined || schema.allOf !== undefined
		|| (schema.type !== 'object' && schema.properties === undefined)) {
		throw new ConfigError('Input partitioning requires supported object declarations or explicit input metadata.');
	}
	if (tool && (schema.additionalProperties !== false || Object.keys(schema.patternProperties ?? {}).length > 0)) {
		throw new ConfigError('Tool input requires a closed root object. Put dynamic keys inside a declared field.');
	}
	return [...new Set([...Object.keys(schema.properties ?? {}), ...schema.required ?? []])];
}

export async function inputNames(schema: FlexibleSchema<unknown>, tool = false): Promise<string[]> {
	const names = rawObjectNames(schema, 0, true, tool);
	if (names !== undefined) return names;
	let metadata: JSONSchema;
	try {
		// SDK conversion closes Standard metadata for providers, even when the
		// author's validator is open. Inspect the declared input policy first.
		const standard = typeof schema === 'object' && '~standard' in schema ? schema['~standard'] : undefined;
		const converter = (standard as Extract<FlexibleSchema<unknown>, { '~standard': { jsonSchema?: unknown } }>['~standard'] | undefined)?.jsonSchema;
		metadata = tool && !zod4Definition(schema) && converter
			? converter.input({ target: 'draft-07' })
			: await asSchema(schema).jsonSchema;
	}
	catch (error) {
		throw new ConfigError('Input partitioning requires supported object declarations or explicit input metadata.',
			error instanceof Error ? error : new Error(String(error)));
	}
	const alternatives = metadata.anyOf ?? metadata.oneOf;
	return alternatives && metadata.$ref === undefined && metadata.allOf === undefined
		? [...new Set([...Object.keys(metadata.properties ?? {}), ...metadata.required ?? [], ...alternatives.flatMap(branch => metadataNames(branch, tool))])]
		: metadataNames(metadata, tool);
}

export function selectFields(source: Fields, names: ReadonlySet<string>, selected: boolean): Fields {
	return Object.fromEntries(ownKeys(source).filter(key => (typeof key === 'string' && names.has(key)) === selected)
		.map(key => [key, Reflect.get(source, key)]));
}

const rootKeywords = new Set([
	'type', 'properties', 'required', 'additionalProperties', 'description', 'title', '$id', '$comment',
	'default', 'examples', 'readOnly', 'writeOnly', 'deprecated', '$schema', '$defs', 'definitions',
]);
const schemaMaps = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']);
const schemaLists = new Set(['anyOf', 'oneOf', 'allOf', 'prefixItems']);
const schemaValues = new Set(['additionalProperties', 'unevaluatedProperties', 'propertyNames', 'contains',
	'additionalItems', 'unevaluatedItems', 'not', 'if', 'then', 'else', 'contentSchema']);

function hasReference(schema: unknown): boolean {
	if (!isPlainObject(schema)) return false;
	if (Object.hasOwn(schema, '$ref')) return true;
	for (const [key, value] of Object.entries(schema)) {
		if (schemaMaps.has(key) && isPlainObject(value) && Object.values(value).some(hasReference)) return true;
		if ((schemaLists.has(key) || key === 'items') && Array.isArray(value) && value.some(hasReference)) return true;
		if ((schemaValues.has(key) || key === 'items') && hasReference(value)) return true;
		if (key === 'dependencies' && isPlainObject(value) && Object.values(value).some(hasReference)) return true;
	}
	return false;
}

// Only data descriptors and JSON values become annotations. No getters/toJSON.
function jsonDefault(value: unknown, ancestors = new Set<object>()): unknown {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
	if (!Array.isArray(value) && !isPlainObject(value)) return undefined;
	if (ancestors.has(value)) return undefined;
	ancestors.add(value);
	const result: Fields | unknown[] = Array.isArray(value) ? [] : {};
	const keys = Array.isArray(value) ? Array.from({ length: value.length }, (_, index) => String(index)) : Object.keys(value);
	for (const key of keys) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		const item = descriptor && 'value' in descriptor ? jsonDefault(descriptor.value, ancestors) : undefined;
		if (item === undefined) { ancestors.delete(value); return undefined; }
		Object.defineProperty(result, key, { value: item, enumerable: true, writable: true, configurable: true });
	}
	ancestors.delete(value);
	return result;
}

export function projectInput(metadata: JSONSchema, defaults: Fields, configured: Fields, incoming: Fields): JSONSchema {
	if (Object.keys(defaults).length === 0) return metadata;
	const unsupported = Object.keys(metadata).filter(key => !rootKeywords.has(key));
	if (unsupported.length || (metadata.type !== 'object' && metadata.properties === undefined)) {
		throw new ConfigError(`Configured tool defaults require an independent object schema. Unsupported root keys: ${unsupported.join(', ')}.`);
	}
	const required = metadata.required?.filter(key => !Object.hasOwn(defaults, key) || defaults[key] === undefined);
	if (required?.length !== metadata.required?.length && hasReference(metadata)) {
		throw new ConfigError('Tool default projection cannot relax required fields in a schema containing references.');
	}
	const properties = { ...metadata.properties };
	for (const key of Object.keys(defaults)) {
		const property = Object.hasOwn(properties, key) ? properties[key] : undefined;
		if (Object.hasOwn(incoming, key) || !Object.hasOwn(configured, key) || !property
			|| typeof property === 'boolean' || property.$ref !== undefined) continue;
		const annotation = jsonDefault(configured[key]);
		if (annotation !== undefined) Object.defineProperty(properties, key, {
			value: { ...property, default: annotation }, enumerable: true, configurable: true, writable: true,
		});
	}
	return { ...metadata, ...(required === undefined ? {} : { required }), properties };
}
