// Compile-only internal checks. Public consumer checks import the package instead.
import { z } from 'zod';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { parseSchema } from '../src/schema.js';
import { validateAndParseOutput } from '../src/config/validate.js';
import { expectEqual, expectType } from './type-safety/assert.js';

const transformed = z.string().transform(Number);
const _parsed = parseSchema(transformed, '12');
expectEqual<Awaited<typeof _parsed>['value'], number>();
const output = validateAndParseOutput({ schema: transformed }, '12');
expectEqual<typeof output, Promise<number>>();
// @ts-expect-error Output validation returns the schema output, not the producer's string.
expectType<Promise<string>>(output);
const original = { value: 'raw' };
const _unparsed = validateAndParseOutput({}, original);
expectEqual<typeof _unparsed, typeof original>();
const _explicitlyUnparsed = validateAndParseOutput({ schema: undefined }, original);
expectEqual<typeof _explicitlyUnparsed, typeof original>();
declare const optionalSchema: { schema?: typeof transformed };
const _conditional = validateAndParseOutput(optionalSchema, original);
expectEqual<typeof _conditional, typeof original | Promise<number>>();

declare const standard: StandardSchemaV1<string, { count: number }>;
const _standardParsed = parseSchema(standard, '12');
expectEqual<Awaited<typeof _standardParsed>['value'], { count: number }>();
