// Native Standard Schema authoring helper for production security tests.
import { safeValidateTypes } from '@ai-sdk/provider-utils';
import type { FlexibleSchema, InferSchema } from '@ai-sdk/provider-utils';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { JSONSchema7 } from '@ai-sdk/provider';
import type { InferInputSchema as Raw } from '../../src/types/types.js';

// Ordinary native protocol authoring, not a proposed Casai schema family.
export function explicitMetadata<S extends FlexibleSchema<unknown>>(schema: S, input: JSONSchema7) {
	const standard: StandardSchemaV1<Raw<S>, InferSchema<S>> = {
		'~standard': { version: 1, vendor: 'phase2-explicit-metadata', validate: async value => {
			const result = await safeValidateTypes({ schema: schema as FlexibleSchema<InferSchema<S>>, value });
			return result.success ? { value: result.value } : { issues: [{ message: result.error.message }] };
		} },
	};
	return { '~standard': { ...standard['~standard'], jsonSchema: { input: () => ({ ...input }), output: () => ({}) } } };
}
