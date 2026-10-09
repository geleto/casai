// Consumer-only input and configured-context contracts. This module is never executed.
import { create, z } from 'casai';
import type { FunctionConfig, SchemaType } from 'casai';
import { jsonSchema } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import { expectEqual, expectType } from './assert.js';
declare const model: LanguageModel;
const inputSchema = z.object({ value: z.number(), label: z.string().optional() });
const replacementInput = z.object({ name: z.string() });
const messages: ModelMessage[] = [{ role: 'user', content: 'Earlier question' }];

const fn = create.Function({
	inputSchema, context: { offset: 2 }, schema: z.number(),
	execute: ({ value, label, offset }) => {
		expectEqual<typeof value, number>();
		expectEqual<typeof label, string | undefined>();
		expectEqual<typeof offset, number>();
		expectType<number>(value);
		expectType<string | undefined>(label);
		expectType<number>(offset);
		// @ts-expect-error Schema input fields must not widen to any.
		expectType<string>(value);
		// @ts-expect-error Configured context fields retain their numeric type.
		expectType<string>(offset);
		return value + offset;
	},
});
void fn({ value: 1 });
void fn({ value: 1, label: 'one' });
void fn({ value: 1, offset: 3 });
// @ts-expect-error Schema-based Function calls preserve configured extra-field types when overriding them.
void fn({ value: 1, offset: 'wrong' });
// @ts-expect-error The input schema requires value at call time.
void fn({});
// @ts-expect-error The schema input value must be a number.
void fn({ value: 'one' });
// @ts-expect-error Optional schema fields still enforce their types.
void fn({ value: 1, label: 2 });
// @ts-expect-error Required schema input cannot be omitted.
void fn();
// @ts-expect-error Input is an object, not a scalar.
void fn(1);
// @ts-expect-error Function.execute exposes its implementation and requires configured fields.
void fn.execute({ value: 1 });
expectType<number | PromiseLike<number>>(fn.execute({ value: 1, offset: 3 }));

const inherited = create.Function({}, fn);
void inherited({ value: 2 });
// @ts-expect-error An empty child retains its parent's required schema fields.
void inherited({});
// @ts-expect-error Inherited implementations must accept the replacement input schema.
create.Function({ inputSchema: replacementInput }, fn);
// @ts-expect-error Inherited implementations must accept the merged configured context.
create.Function({ context: { offset: 'wrong' } }, fn);
// @ts-expect-error Inherited implementations must produce the replacement output schema type.
create.Function({ schema: z.string() }, fn);
const replaced = create.Function({
	inputSchema: replacementInput, schema: z.string(), context: { suffix: '!' },
	execute: ({ name, suffix, offset }) => {
		expectType<string>(name);
		expectType<string>(suffix);
		expectType<number>(offset);
		return name + suffix;
	},
}, fn);
void replaced({ name: 'child' });
// @ts-expect-error Replacement input schemas remove the parent's input contract.
void replaced({ value: 1 });
// @ts-expect-error Replacement schema output is a string.
expectType<number | PromiseLike<number>>(replaced({ name: 'child' }));
const noOutputSchema = create.Function({ schema: undefined, execute: ({ name }) => name.length }, replaced);
expectType<number | PromiseLike<number>>(noOutputSchema({ name: 'child' }));

const inferred = create.Function({
	context: { offset: 2 },
	execute: ({ value, offset }: { value: number, offset: number }) => value + offset,
});
void inferred({ value: 1 });
void inferred({ value: 1, offset: 3 });
// @ts-expect-error Execute's unconfigured input fields remain required without a schema.
void inferred({});
// @ts-expect-error Configured fields may be overridden only with the declared type.
void inferred({ value: 1, offset: 'wrong' });
const schemaRequiresConfigured = create.Function({
	inputSchema: z.object({ value: z.number(), offset: z.number() }),
	context: { offset: 2 }, execute: ({ value, offset }) => value + offset,
});
// @ts-expect-error Configured context does not satisfy required input-schema fields at call time.
void schemaRequiresConfigured({ value: 1 });
void schemaRequiresConfigured({ value: 1, offset: 3 });

const sdkInput = jsonSchema<{ value: number }>({ type: 'object', properties: { value: { type: 'number' } }, required: ['value'] });
const sdkFunction = create.Function({ inputSchema: sdkInput, execute: ({ value }) => value.toFixed() });
void sdkFunction({ value: 1 });
// @ts-expect-error SDK object schemas preserve their declared numeric field.
void sdkFunction({ value: 'wrong' });
// @ts-expect-error SDK object schemas preserve their required fields.
void sdkFunction({});
// @ts-expect-error An object input schema cannot be replaced by a scalar schema.
create.Function({ inputSchema: z.string(), execute: () => 1 });
// @ts-expect-error Function execute must return the configured schema type.
create.Function({ inputSchema, schema: z.number(), execute: () => 'wrong' });
// @ts-expect-error Output-only Function schemas reject incompatible implementation returns.
create.Function({ schema: z.number(), execute: () => 'wrong' });

const transformedInput = z.object({ value: z.string().transform(Number), fallback: z.string().default('default') });
const rawFunction = create.Function({ inputSchema: transformedInput, execute: ({ value, fallback: _fallback }) => {
	expectEqual<typeof value, string>();
	expectEqual<typeof _fallback, string | undefined>();
	return value;
} });
void rawFunction({ value: '1' });
// @ts-expect-error Ordinary Function input is validated but not replaced by parsed schema output.
void rawFunction({ value: 1 });
const rawInputFragment = create.Config({ inputSchema: transformedInput, execute: ({ value }: { value: string, fallback?: string | undefined }) => value.length });
const parsedInputFragment = create.Config({ inputSchema: transformedInput, execute: ({ value }: { value: number, fallback: string }) => value });
const rawFragmentFunction = create.Function({}, rawInputFragment);
void rawFragmentFunction({ value: '1' });
const parsedFragmentTool = create.Function.asTool({}, parsedInputFragment);
void parsedFragmentTool.execute({ value: 1, fallback: 'parsed' }, { toolCallId: 'call', messages: [], context: undefined });
// @ts-expect-error A reusable parsed-input implementation cannot consume ordinary raw Function input.
create.Function({}, parsedInputFragment);
// @ts-expect-error A reusable raw-input implementation cannot consume parsed SDK tool input.
create.Function.asTool({}, rawInputFragment);
create.Config({ inputSchema: transformedInput, execute: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return String(value);
} });
const rawPromptParent = create.Config({ model, inputSchema: transformedInput, context: { prefix: 'value=' } });
const rawText = create.TextGenerator.withFunction({ prompt: ({ value, fallback: _fallback, prefix }) => {
	expectEqual<typeof value, string>();
	expectEqual<typeof _fallback, string | undefined>();
	expectEqual<typeof prefix, string>();
	return prefix + value;
} }, rawPromptParent);
const rawTextStream = create.TextStreamer.withFunction({ prompt: ({ value, fallback: _fallback, prefix }) => {
	expectEqual<typeof value, string>();
	expectEqual<typeof _fallback, string | undefined>();
	expectEqual<typeof prefix, string>();
	return prefix + value;
} }, rawPromptParent);
const rawObject = create.ObjectGenerator.withFunction({ schema: z.object({ answer: z.number() }), prompt: ({ value, prefix }) => {
	expectEqual<typeof value, string>();
	expectEqual<typeof prefix, string>();
	return prefix + value;
} }, rawPromptParent);
const rawObjectStream = create.ObjectStreamer.withFunction({ schema: z.object({ answer: z.number() }), prompt: ({ value, prefix }) => {
	expectEqual<typeof value, string>();
	expectEqual<typeof prefix, string>();
	return prefix + value;
} }, rawPromptParent);
void rawText({ value: '1' });
void rawTextStream({ value: '1' });
void rawObject({ value: '1' });
void rawObjectStream({ value: '1' });
// @ts-expect-error Function-prompt text generation validates raw schema input.
void rawText({ value: 1 });
// @ts-expect-error Function-prompt text streaming validates raw schema input.
void rawTextStream({ value: 1 });
// @ts-expect-error Function-prompt object generation validates raw schema input.
void rawObject({ value: 1 });
// @ts-expect-error Function-prompt object streaming validates raw schema input.
void rawObjectStream({ value: 1 });
const overlappingContext = create.Function({ inputSchema, context: { value: 'configured default', offset: 2 }, execute: ({ value, offset }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof offset, number>();
	return value + offset;
} });
void overlappingContext({ value: 1 });
declare const maybeContext: { offset: number } | undefined;
const optionalConfigured = create.Function({ inputSchema, context: maybeContext, execute: ({ value, offset }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof offset, number | undefined>();
	return value + (offset ?? 0);
} });
void optionalConfigured({ value: 1 });
declare const condition: boolean;
const conditionalContext = condition ? { context: { offset: 2 } } : {};
const spreadConfigured = create.Function({ inputSchema, ...conditionalContext, execute: ({ value, offset }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof offset, number | undefined>();
	return value + (offset ?? 0);
} });
void spreadConfigured({ value: 1 });
const spreadText = create.TextGenerator.withFunction({ model, inputSchema, ...conditionalContext, prompt: ({ value, offset }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof offset, number | undefined>();
	// @ts-expect-error Conditionally configured context must be guarded before using it as required.
	expectType<number>(offset);
	return String(value + (offset ?? 0));
} });
const spreadTextStream = create.TextStreamer.withFunction({ model, inputSchema, ...conditionalContext, prompt: ({ value, offset }) => {
	expectEqual<typeof offset, number | undefined>();
	// @ts-expect-error Streamed prompt callbacks also account for absent configured context.
	expectType<number>(offset);
	return String(value + (offset ?? 0));
} });
const spreadObject = create.ObjectGenerator.withFunction({ model, inputSchema, schema: z.object({ answer: z.number() }), ...conditionalContext, prompt: ({ value, offset }) => {
	expectEqual<typeof offset, number | undefined>();
	// @ts-expect-error Object prompt callbacks also account for absent configured context.
	expectType<number>(offset);
	return String(value + (offset ?? 0));
} });
const spreadObjectStream = create.ObjectStreamer.withFunction({ model, inputSchema, schema: z.object({ answer: z.number() }), ...conditionalContext, prompt: ({ value, offset }) => {
	expectEqual<typeof offset, number | undefined>();
	// @ts-expect-error Object stream prompt callbacks also account for absent configured context.
	expectType<number>(offset);
	return String(value + (offset ?? 0));
} });
const spreadTextTool = create.TextGenerator.withFunction.asTool({ model, inputSchema, ...conditionalContext, prompt: ({ value, offset }) => {
	expectEqual<typeof offset, number | undefined>();
	// @ts-expect-error Hybrid tool prompt callbacks cannot assume conditional context is present.
	expectType<number>(offset);
	return String(value + (offset ?? 0));
} });
const spreadObjectTool = create.ObjectGenerator.withFunction.asTool({ model, inputSchema, schema: z.object({ answer: z.number() }), ...conditionalContext, prompt: ({ value, offset }) => {
	expectEqual<typeof offset, number | undefined>();
	// @ts-expect-error Object tool prompts must guard conditional context too.
	expectType<number>(offset);
	return String(value + (offset ?? 0));
} });
void spreadText({ value: 1 });
void spreadTextStream({ value: 1 });
void spreadObject({ value: 1 });
void spreadObjectStream({ value: 1 });
void spreadTextTool({ value: 1 });
void spreadObjectTool({ value: 1 });
void spreadText({ value: 1, offset: 2 });
void spreadText.run({ context: { value: 1 }, prompt: ({ offset }) => {
	expectEqual<typeof offset, number | undefined>();
	return String(offset ?? 0);
} });
// @ts-expect-error Optional configured fields still constrain direct override types.
void spreadObject({ value: 1, offset: 'wrong' });
// @ts-expect-error Optional configured fields still constrain run override types.
void spreadTextStream.run({ context: { value: 1, offset: 'wrong' } });
const transformedOutput = create.Function({ schema: z.string().transform(Number), execute: () => '123' });
expectType<number | PromiseLike<number>>(transformedOutput({}));
expectType<string>(transformedOutput.execute());
// @ts-expect-error Function implementations return unparsed output-schema input.
create.Function({ schema: z.string().transform(Number), execute: () => 123 });
const defaultedOutput = create.Function({ schema: z.number().default(123), execute: () => undefined });
expectType<number | PromiseLike<number>>(defaultedOutput({}));
const outputSchema = z.string().transform(Number);
const annotatedConfig: FunctionConfig<typeof transformedInput, typeof outputSchema, undefined> = {
	inputSchema: transformedInput, schema: outputSchema,
	execute: ({ value, fallback }) => {
		expectEqual<typeof value, string>();
		expectEqual<typeof fallback, string | undefined>();
		return value + (fallback ?? '');
	},
};
const annotatedFunction = create.Function(annotatedConfig);
expectType<number | PromiseLike<number>>(annotatedFunction({ value: '123' }));
// @ts-expect-error Annotated Function configs retain raw input-schema types.
void annotatedFunction({ value: 123 });
const opaqueConfig: FunctionConfig<typeof inputSchema, undefined, undefined> = { inputSchema, execute: ({ value }) => value };
const _opaqueFunction = create.Function(opaqueConfig);
expectEqual<Awaited<ReturnType<typeof _opaqueFunction>>, unknown>();

const parent = create.Config({ model, inputSchema, context: { prefix: 'value=' } });
const rendererParent = create.Config({ inputSchema, context: { prefix: 'value=' } });
const template = create.Template({ inputSchema, template: '{{ value }}' });
const inheritedTemplate = create.Template({ template: '{{ prefix }}{{ value }}' }, rendererParent);
const script = create.Script({ inputSchema, schema: z.number(), script: 'return value' });
const inheritedScript = create.Script({ schema: z.number(), script: 'return value' }, rendererParent);
const emptyTemplateChild = create.Template({}, template);
const emptyScriptChild = create.Script({}, script);
expectEqual<typeof emptyTemplateChild.config.inputSchema, typeof inputSchema>();
expectEqual<typeof emptyScriptChild.config.inputSchema, typeof inputSchema>();
expectType<Promise<number>>(emptyScriptChild({ value: 1 }));
// @ts-expect-error Empty Template children preserve their parent's schema field types.
void emptyTemplateChild({ value: 'wrong' });
// @ts-expect-error Empty Script children preserve their parent's schema field types.
void emptyScriptChild({ value: 'wrong' });
expectType<Promise<string>>(template({ value: 1 }));
expectType<Promise<string>>(inheritedTemplate({ value: 1 }));
expectType<Promise<number>>(script({ value: 1 }));
expectType<Promise<number>>(inheritedScript({ value: 1 }));
void template('{{ value }}', { value: 1 });
void script('return value', { value: 1 });
// @ts-expect-error Template context is positional only after an actual string prompt.
void template(undefined, { value: 1 });
// @ts-expect-error Script context is positional only after an actual string script.
void script(undefined, { value: 1 });
// @ts-expect-error Template input follows its declared schema.
void template({ value: 'wrong' });
// @ts-expect-error Script input follows its declared schema.
void script({ value: 'wrong' });
// @ts-expect-error Inherited template input follows the final input schema.
void inheritedTemplate({ value: 'wrong' });
// @ts-expect-error Inherited script input follows the final input schema.
void inheritedScript({ value: 'wrong' });
// @ts-expect-error Templates require all required schema input fields.
void template({});
// @ts-expect-error Scripts require all required schema input fields.
void script({});
// @ts-expect-error A required template input object cannot be omitted.
void template();
// @ts-expect-error A required script input object cannot be omitted.
void script();
const objectUnion = z.union([inputSchema, replacementInput]);
const objectRecord = z.record(z.string(), z.number());
// @ts-expect-error Template runtime validation requires ZodObject, even when a union outputs objects.
create.Template({ inputSchema: objectUnion, template: 'Ready' });
// @ts-expect-error Script runtime validation requires ZodObject, even when a record outputs an object.
create.Script({ inputSchema: objectRecord, script: 'return 1' });
// @ts-expect-error Array schemas are not renderer object schemas.
create.Template({ inputSchema: z.array(z.number()), template: 'Ready' });
// @ts-expect-error Whole-object transforms are ZodPipe instances rather than renderer ZodObject inputs.
create.Script({ inputSchema: inputSchema.transform(value => value), script: 'return 1' });
const unsupportedParent = create.Config({ inputSchema: objectUnion });
// @ts-expect-error Inherited renderer schemas must have a supported runtime constructor.
create.Template({ template: 'Ready' }, unsupportedParent);
// @ts-expect-error Inherited Script schemas must have a supported runtime constructor too.
create.Script({ script: 'return 1' }, unsupportedParent);
create.Template({ inputSchema, template: 'Ready' }, unsupportedParent);
create.Script({ inputSchema, script: 'return 1' }, unsupportedParent);
create.Template({ inputSchema: inputSchema.refine(({ value }) => value > 0), template: 'Ready' });
create.Script({ inputSchema: sdkInput, script: 'return value' });
declare const abstractObjectSchema: SchemaType<{ value: number }>;
create.Template({ inputSchema: abstractObjectSchema, template: 'Ready' });
create.Script({ inputSchema: abstractObjectSchema, script: 'return value' });

const optionalInput = z.object({ value: z.number().optional() });
void create.Template({ inputSchema: optionalInput, template: '{{ value }}' })();
void create.Script({ inputSchema: optionalInput, script: 'return value' })();
const optionalTemplate = create.Template({ inputSchema: optionalInput, template: 'Ready' });
const optionalScript = create.Script({ inputSchema: optionalInput, script: 'return 1' });
declare const optionalPromptOverride: string | undefined;
void optionalTemplate(optionalPromptOverride);
void optionalScript(optionalPromptOverride);
const templateDefaults = create.Template({ template: '{{ name }}', context: { name: 'Original', count: 1, enabled: true } });
const scriptDefaults = create.Script({ script: 'return name', context: { name: 'Original', count: 1, enabled: true } });
void templateDefaults({ name: 'Changed', count: 2, enabled: false });
void scriptDefaults({ name: 'Changed', count: 2, enabled: false });
// @ts-expect-error String renderer defaults still constrain primitive override types.
void templateDefaults({ name: 123 });
// @ts-expect-error Numeric renderer defaults reject text overrides.
void scriptDefaults({ count: 'wrong' });
// @ts-expect-error Boolean renderer defaults reject text overrides.
void templateDefaults({ enabled: 'wrong' });
const llmDefaults = create.TextStreamer.withTemplate({ model, prompt: '{{ name }}', context: { name: 'Original', count: 1 } });
void llmDefaults({ name: 'Changed', count: 2 });
void llmDefaults.run({ context: { name: 'Changed', count: 2 } });
// @ts-expect-error LLM text renderers retain configured primitive types too.
void llmDefaults({ count: 'wrong' });
const configuredPrompt = create.TextGenerator.withFunction({ model, context: { prefix: 'value=' }, prompt: ({ prefix }) => {
	expectEqual<typeof prefix, string>();
	return prefix.toUpperCase();
} });
void configuredPrompt();
void configuredPrompt({ prefix: 'override=', extra: 1 });
void configuredPrompt.run({ context: { prefix: 'override=' } });
// @ts-expect-error Direct calls cannot invalidate a configured field used by the prompt callback.
void configuredPrompt({ prefix: 123 });
// @ts-expect-error Run context overrides cannot invalidate configured prompt fields either.
void configuredPrompt.run({ context: { prefix: 123 } });
const configuredChild = create.TextGenerator.withFunction({}, configuredPrompt);
void configuredChild({ prefix: 'child=' });
// @ts-expect-error Inheritance retains configured prompt input override types.
void configuredChild({ prefix: 123 });
const optionalConfiguredPrompt = create.TextGenerator.withFunction({ model, context: maybeContext, prompt: ({ offset }) => String(offset ?? 0) });
void optionalConfiguredPrompt();
void optionalConfiguredPrompt({ offset: 3 });
// @ts-expect-error A maybe-absent configured context still has typed present fields.
void optionalConfiguredPrompt({ offset: 'wrong' });
const fixedContext: { prefix: 'fixed' } = { prefix: 'fixed' };
const fixedPrompt = create.TextGenerator.withFunction({ model, context: fixedContext, prompt: ({ prefix }) => {
	expectEqual<typeof prefix, 'fixed'>();
	return prefix;
} });
void fixedPrompt({ prefix: 'fixed' });
// @ts-expect-error Explicitly narrow configured context annotations keep their declared allowed values.
void fixedPrompt({ prefix: 'different' });
const enumPrompt = create.ObjectGenerator.withFunction({ model, output: 'enum', enum: ['YES', 'NO'], context: { prefix: 'value=' }, prompt: ({ prefix }) => {
	expectEqual<typeof prefix, string>();
	return prefix;
}, onFinish: _event => {
	expectEqual<typeof _event.object, 'YES' | 'NO' | undefined>();
} });
expectEqual<Awaited<ReturnType<typeof enumPrompt>>['object'], 'YES' | 'NO'>();
void enumPrompt({ prefix: 'override=' });
// @ts-expect-error Preserving enum literals does not permit invalid configured context overrides.
void enumPrompt({ prefix: 123 });
const textTemplate = create.TextGenerator.withTemplate({ prompt: '{{ value }}' }, parent);
const textScript = create.TextStreamer.withScript({ prompt: 'return String(value)' }, parent);
const textFunction = create.TextGenerator.withFunction({ prompt: ({ value, prefix }) => `${prefix}${value}` }, parent);
void textTemplate({ value: 1 });
void textTemplate('{{ value }}', messages, { value: 1 });
void textScript({ value: 1 });
void textFunction({ value: 1 });
void textFunction({ value: 1, prefix: 'override=' });
void textFunction.run({ context: { value: 1, prefix: 'override=' } });
// @ts-expect-error Configured fields outside the input schema retain their types on rendered calls.
void textFunction({ value: 1, prefix: 123 });
// @ts-expect-error Configured fields outside the input schema retain their types on rendered runs.
void textFunction.run({ context: { value: 1, prefix: 123 } });
void textTemplate.run({ context: { value: 1 } });
void textScript.run({ context: { value: 1 } });
void textFunction.run({ context: { value: 1 } });
void textFunction.run({ context: { value: 1 }, prompt: ({ value, prefix }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof prefix, string>();
	// @ts-expect-error One-off prompt replacements retain schema input types.
	expectType<string>(value);
	return `${prefix}${value}`;
} });
// @ts-expect-error One-off function prompts must still produce strings or message arrays.
void textFunction.run({ context: { value: 1 }, prompt: () => 123 });
// @ts-expect-error LLM template callers enforce schema field types.
void textTemplate({ value: 'wrong' });
// @ts-expect-error LLM script callers enforce schema field types.
void textScript({ value: 'wrong' });
// @ts-expect-error LLM function callers enforce schema field types.
void textFunction({ value: 'wrong' });
// @ts-expect-error Required LLM template input cannot be omitted.
void textTemplate();
// @ts-expect-error Required LLM function input cannot be omitted.
void textFunction();
// @ts-expect-error LLM run context validates schema field types.
void textTemplate.run({ context: { value: 'wrong' } });
// @ts-expect-error LLM run context requires required schema fields.
void textFunction.run({ context: {} });
// @ts-expect-error A run override cannot replace the input schema.
void textTemplate.run({ inputSchema: replacementInput });
// @ts-expect-error Function-prompt callers accept input objects, not one-off strings.
void textFunction('wrong');
// @ts-expect-error Inherited prompt implementations must accept replacement input schemas.
create.TextGenerator.withFunction({ inputSchema: replacementInput }, textFunction);
// @ts-expect-error Inherited prompt implementations must accept replaced configured context types.
create.TextGenerator.withFunction({ context: { prefix: 123 } }, textFunction);
const replacementPrompt = create.TextGenerator.withFunction({ inputSchema: replacementInput, context: { prefix: 123 }, prompt: ({ name, prefix }) => {
	expectEqual<typeof name, string>();
	expectEqual<typeof prefix, number>();
	return `${prefix}${name}`;
} }, textFunction);
void replacementPrompt({ name: 'child' });
// @ts-expect-error A replacement prompt caller follows the replacement input schema.
void replacementPrompt({ value: 1 });

const variants = z.discriminatedUnion('kind', [z.object({ kind: z.literal('text'), text: z.string() }), z.object({ kind: z.literal('count'), count: z.number() })]);
const variantDefaults = { text: 123, count: 'default', shared: true };
const variantFunction = create.Function({ inputSchema: variants, context: variantDefaults, execute: input => {
	if (input.kind === 'text') {
		expectEqual<typeof input.text, string>();
		expectEqual<typeof input.count, string>();
	} else {
		expectEqual<typeof input.text, number>();
		expectEqual<typeof input.count, number>();
	}
	return input.shared;
} });
void variantFunction({ kind: 'text', text: 'input' });
void variantFunction({ kind: 'count', count: 1 });
const variantPrompt = create.TextGenerator.withFunction({ model, inputSchema: variants, context: variantDefaults, prompt: input => {
	if (input.kind === 'text') expectEqual<typeof input.text, string>();
	else expectEqual<typeof input.count, number>();
	return String(input.shared);
} });
void variantPrompt({ kind: 'text', text: 'input' });

// @ts-expect-error Union inputs retain their selected branch's required fields.
void variantFunction({ kind:'text' });
// @ts-expect-error Union inputs replace incompatible configured defaults only at matching schema fields.
void variantFunction({ kind:'text', text:123 });
// @ts-expect-error Configured fields outside the selected schema branch retain their types.
void variantFunction({ kind:'text', text:'input', count:123 });
void variantPrompt.run({ context:{ kind:'text', text:'input' } });
const inheritedVariant = create.Function({}, variantFunction);
void inheritedVariant({ kind:'count', count:2 });
// @ts-expect-error Inherited union schema inputs keep branch field types.
void inheritedVariant({ kind:'count', count:'wrong' });
const optionalContextInput = z.object({ value: z.number() });
const annotatedOptionalContext: FunctionConfig<typeof optionalContextInput, undefined, { offset: number } | undefined> = {
	inputSchema: optionalContextInput, context: Math.random() ? { offset: 1 } : undefined, execute: ({ value, offset }) => {
		expectEqual<typeof offset, number | undefined>();
		return value + (offset ?? 0);
	},
};
create.Function(annotatedOptionalContext);

declare const unionConfiguredContext: {mode:'prefix';prefix:string;common:number}|{mode:'offset';offset:number;common:number};
const unionConfiguredFunction = create.Function({ inputSchema, context:unionConfiguredContext, execute:input=>{
	if (input.mode === 'prefix')expectEqual<typeof input.prefix, string>();else expectEqual<typeof input.offset, number>();
	return input.value + input.common;
} });
void unionConfiguredFunction({ value:1 });
void unionConfiguredFunction({ value:1, common:2 });
void unionConfiguredFunction({ value:1, mode:'prefix', prefix:'new', common:2 });
// @ts-expect-error Replacing a union discriminator requires its full correlated context branch.
void unionConfiguredFunction({ value:1, mode:'offset' });
// @ts-expect-error Shared context overrides must preserve the field's type in every branch.
void unionConfiguredFunction({ value:1, common:'wrong' });
