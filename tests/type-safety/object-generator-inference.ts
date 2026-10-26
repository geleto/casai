// Compile-only public checks for the shared ObjectGenerator factory signatures.
import { create, z } from 'casai';
import type { ConfigProvider } from 'casai';
import type { LanguageModel } from 'ai';
import { z as z3 } from 'zod/v3';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
declare const enabled: boolean;
const schema = z.object({ answer: z.number() });
const inputSchema = z.object({ value: z.string().transform(Number) });
const complete = create.Config({ model, schema });

// Preserve literal enum inference and the existing mutable/const authoring forms.
const enumGenerator = create.ObjectGenerator({ model, output: 'enum', enum: ['YES', 'NO'], onFinish: _event => {
	expectEqual<typeof _event.object, 'YES' | 'NO' | undefined>();
} });
expectEqual<typeof enumGenerator.config.enum, ('YES' | 'NO')[]>();
expectEqual<Awaited<ReturnType<typeof enumGenerator>>['object'], 'YES' | 'NO'>();
const _functionEnum = create.ObjectGenerator.withFunction({ model, output: 'enum', enum: ['YES', 'NO'], prompt: () => 'Answer', onFinish: _event => {
	expectEqual<typeof _event.object, 'YES' | 'NO' | undefined>();
} });
expectEqual<typeof _functionEnum.config.enum, readonly ['YES', 'NO']>();
// @ts-expect-error Replacing enum values must not retain a callback for the old alternatives.
create.ObjectGenerator({ enum: ['LATER'] }, enumGenerator);
const _inheritedEnum = create.ObjectGenerator({ enum: ['LATER'], onFinish: _event => {
	expectEqual<typeof _event.object, 'LATER' | undefined>();
} }, enumGenerator);
expectEqual<typeof _inheritedEnum.config.enum, 'LATER'[]>();
expectEqual<Awaited<ReturnType<typeof _inheritedEnum>>['object'], 'LATER'>();

// Parent presence comes from arguments, not an expected result or a possibly absent tuple.
const _annotated: ConfigProvider<{ schema: typeof schema }> = create.ObjectGenerator({ model, schema });
const _annotatedInherited: ConfigProvider<{ schema: typeof schema }> = create.ObjectGenerator({}, complete);
// @ts-expect-error The child settings argument is required.
create.ObjectGenerator();
// @ts-expect-error Explicit undefined is not a parent provider.
create.ObjectGenerator({ model, schema }, undefined);
declare const maybeParent: [] | [typeof complete];
// @ts-expect-error Narrow parent presence before relying on the inherited configuration.
create.ObjectGenerator({}, ...maybeParent);
const presentParent: [typeof complete] = [complete];
create.ObjectGenerator({}, ...presentParent);
const absentParent: [] = [];
create.ObjectGenerator({ model, schema }, ...absentParent);
// @ts-expect-error An expected config cannot invent inherited settings.
const _invented: ConfigProvider<{ context: { missing: number } }> = create.ObjectGenerator({ model, schema });

// Function prompts must be configured before any shorthand or run call is possible.
// @ts-expect-error A function-prompt component cannot supply its missing callback at call time.
create.ObjectGenerator.withFunction({ model, schema });
// @ts-expect-error Inheritance must still leave a prompt function.
create.ObjectGenerator.withFunction({}, complete);
// @ts-expect-error Explicit undefined cannot satisfy the required prompt.
create.ObjectGenerator.withFunction({ prompt: undefined }, complete);
const promptParent = create.Config({ model, schema, prompt: () => 'Answer' });
create.ObjectGenerator.withFunction({}, promptParent);
create.ObjectGenerator.withFunction({ prompt: () => 'New answer' }, complete);
// @ts-expect-error A child cannot clear its inherited function prompt.
create.ObjectGenerator.withFunction({ prompt: undefined }, promptParent);
declare const maybePrompt: { prompt?: () => string };
// @ts-expect-error An optional prompt does not guarantee a configured function.
create.ObjectGenerator.withFunction({ model, schema, ...maybePrompt });
const promptChoice = enabled ? { model, schema, prompt: () => 'Answer' } : { model, schema };
// @ts-expect-error Every possible inherited configuration needs a function prompt.
create.ObjectGenerator.withFunction({}, { config: promptChoice });
create.ObjectGenerator.withFunction({ prompt: () => 'Answer' }, { config: promptChoice });

// Merging schema/context settings retains parsed callback and native descriptor types.
const conditionalContext = enabled ? { context: { offset: 2 } } : {};
const functionTool = create.ObjectGenerator.withFunction.asTool({
	model, schema, inputSchema, ...conditionalContext,
	prompt: ({ value, offset }) => {
		expectEqual<typeof value, number>();
		expectEqual<typeof offset, number | undefined>();
		return String(value + (offset ?? 0));
	},
	toModelOutput: ({ output }) => {
		expectEqual<typeof output, { answer: number }>();
		return { type: 'text', value: String(output.answer) };
	},
});
expectType<PromiseLike<{ answer: number }>>(functionTool.execute({ value: 2 }, { toolCallId: 'call', messages: [], context: undefined }));
// @ts-expect-error Native descriptor execution consumes parsed input.
functionTool.execute({ value: '2' }, { toolCallId: 'call', messages: [], context: undefined });
void functionTool({ value: '2' });
// @ts-expect-error Ordinary invocation retains the raw schema input.
void functionTool({ value: 2 });
// @ts-expect-error Tool creation still requires an input schema.
create.ObjectGenerator.withFunction.asTool({ model, schema, prompt: () => 'Answer' });
// @ts-expect-error The merged output mode cannot retain incompatible inherited schema settings.
create.ObjectGenerator({ output: 'enum', enum: ['YES'] }, complete);
const legacySchema = z3.object({ answer: z3.number() });
// @ts-expect-error The effective output schema must remain supported when supplied by a raw parent.
create.ObjectGenerator({}, { config: { model, schema: legacySchema } });
// @ts-expect-error Function-prompt inheritance has the same output schema boundary.
create.ObjectGenerator.withFunction({ prompt: () => 'Answer' }, { config: { model, schema: legacySchema } });

// Complete alternatives preserve result correlations; an ambiguous field remains uncallable.
const selectedMode = enabled ? { output: 'array' as const } : { output: 'object' as const };
const _selected = create.ObjectGenerator({ model, schema }, { config: selectedMode });
expectEqual<Awaited<ReturnType<typeof _selected>>['object'], { answer: number } | { answer: number }[]>();
declare const ambiguousMode: 'object' | 'array';
const ambiguous = create.ObjectGenerator({ model, schema, output: ambiguousMode });
// @ts-expect-error A field union cannot silently promise only the scalar output.
void ambiguous('Answer');
