import { create, z } from 'casai';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

declare const model: LanguageModel;
const toolContextSchema = z.object({ tenant: z.string() });
const replacement = z.object({ tenant: z.number() });
const inputSchema = z.object({});

const fn = create.Function.asTool({
	inputSchema, toolContextSchema, execute: () => 'ok',
	description: ({ context }) => {
		expectEqual<typeof context.tenant, string>();
		return context.tenant.toUpperCase();
	},
});
// @ts-expect-error Retained description needs a string tenant.
create.Function.asTool({ toolContextSchema: replacement }, fn);
const script = create.Script.asTool({ inputSchema, script: 'return 1', toolContextSchema, description: ({ context }) => context.tenant.toUpperCase() });
// @ts-expect-error Retained description needs a string tenant.
create.Script.asTool({ toolContextSchema: replacement }, script);
const template = create.Template.asTool({ inputSchema, template: 'ok', toolContextSchema, description: ({ context }) => context.tenant.toUpperCase() });
// @ts-expect-error Retained description needs a string tenant.
create.Template.asTool({ toolContextSchema: replacement }, template);
const text = create.TextGenerator.asTool({ model, inputSchema, prompt: 'ok', toolContextSchema, description: ({ context }) => context.tenant.toUpperCase() });
// @ts-expect-error Retained description needs a string tenant.
create.TextGenerator.asTool({ toolContextSchema: replacement }, text);
const object = create.ObjectGenerator.asTool({ model, inputSchema, schema: z.object({ value: z.number() }), prompt: 'ok', toolContextSchema, description: ({ context }) => context.tenant.toUpperCase() });
// @ts-expect-error Retained description needs a string tenant.
create.ObjectGenerator.asTool({ toolContextSchema: replacement }, object);
const fragment = create.Config({ toolContextSchema, description: ({ context }) => context.tenant.toUpperCase() });
create.Function.asTool({ inputSchema, execute: () => 'ok' }, fragment);
// @ts-expect-error Inherited fragment descriptions must match final context.
create.Function.asTool({ inputSchema, toolContextSchema: replacement, execute: () => 'ok' }, fragment);
create.Function.asTool({ inputSchema, execute: () => 'ok', description: ({ context: _context }) => {
	expectEqual<typeof _context, undefined>();
	return 'ok';
} });
create.Function.asTool({ toolContextSchema: replacement, description: ({ context }) => String(context.tenant) }, fn);
create.Function.asTool({ inputSchema, execute: () => 'ok', description: undefined });
// @ts-expect-error Descriptions must return text.
create.Function.asTool({ inputSchema, execute: () => 'ok', description: () => 5 });
// @ts-expect-error Ordinary descriptions retain their native property type.
create.TextGenerator({ model, prompt: 'ok', description: 5 });
// @ts-expect-error Fragments also reject invalid description values.
create.Config({ description: 5 });
