import type { DeclaredType } from './config.js';

// Renderer validation accepts ZodObject instances. Abstract annotations cannot expose the constructor,
// so defer Zod types whose kind could still be object.
type InvalidZodInput<TSchema> = TSchema extends { _zod: { def: { type: infer Kind } } }
	? 'object' extends Kind ? never : Kind
	: never;

export type ValidateRendererInput<TConfig> = [InvalidZodInput<DeclaredType<TConfig, 'inputSchema'>>] extends [never]
	? unknown : 'Config Error: Renderer inputSchema must be a Zod object schema or an AI SDK object schema.';
