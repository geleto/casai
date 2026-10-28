import { Output } from 'ai';
import { create, z } from 'casai';
import type { FunctionConfig } from 'casai';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

declare const enabled: boolean;
declare const model: LanguageModel;
const definiteInput = z.object({ value: z.string().transform(Number) });
const inputSchema = enabled ? definiteInput : undefined;
// @ts-expect-error Tool descriptors still require a definite input schema.
create.Function.asTool({ inputSchema, execute: () => 'ok' });

const conditional = create.Function({ inputSchema, execute: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return value;
} });
void conditional({ value: '2' });
void conditional.run({ context: { value: '2' } });
expectEqual<Awaited<ReturnType<typeof conditional>>, string | number>();
// @ts-expect-error Input is required when the schema exists.
void conditional();
// @ts-expect-error Caller data remains raw schema input.
void conditional({ value: 2 });
// @ts-expect-error Closed shape still rejects extras.
void conditional({ value: '2', extra: true });
// @ts-expect-error The callback must accept raw strings too.
create.Function({ inputSchema, execute: ({ value }: { value: number }) => value });

const configured = create.Function({ inputSchema, context: { value: '5', db: true }, execute: ({ value, db: _db }) => {
	expectEqual<typeof value, string | number>();
	expectEqual<typeof _db, boolean>();
	return value;
} });
void configured();
void configured.run();
// @ts-expect-error The configured field is private if there is no schema.
void configured({ value: '7' });
// @ts-expect-error Run must enforce the same privacy requirement.
void configured.run({ context: { value: '7' } });
void create.Function({ inputSchema: definiteInput }, configured)({ value: '7' });
const inherited = create.Function({ execute: ({ value }) => value }, configured);
expectEqual<Awaited<ReturnType<typeof inherited>>, string | number>();
void inherited();

const defaulted = create.Function({
	inputSchema: enabled ? z.object({ value: z.string().default('5').transform(Number) }) : undefined,
	execute: ({ value }) => {
		expectEqual<typeof value, string | number | undefined>();
		return value;
	},
});
void defaulted();
const open = create.Function({ inputSchema: enabled ? definiteInput.loose() : undefined, context: { value: '5' }, execute: ({ value }) => value });
void open({ extra: true });
// @ts-expect-error Open shape does not remove conditional privacy.
void open({ value: '7' });
const renamed = create.Function({
	inputSchema: enabled ? definiteInput.transform(({ value }) => ({ count: value })) : undefined,
	execute: context => 'count' in context ? context.count : context.value,
});
void renamed({ value: '5' });
expectEqual<Awaited<ReturnType<typeof renamed>>, string | number>();

// An optional schema cannot guarantee the parsed input expected by this annotation.
declare const annotated: FunctionConfig<typeof definiteInput, undefined, undefined>;
// @ts-expect-error The callback requires parsed numbers, but the optional schema may be absent.
create.Function(annotated);
const annotatedComponent = create.Function({ ...annotated, inputSchema: definiteInput });
void annotatedComponent({ value: '5' });
// @ts-expect-error The supplied schema requires input.
void annotatedComponent();
create.Function({ inputSchema: definiteInput, execute: ({ value }) => {
	expectEqual<typeof value, number>();
	return value;
} });
const raw = create.Function({ context: { value: '5' }, inputSchema: undefined, execute: ({ value }) => {
	expectEqual<typeof value, string>();
	return value;
} });
void raw();
// @ts-expect-error Definite absence preserves privacy.
void raw({ value: '7' });

const parent = create.Config({ inputSchema, context: { value: '5' } });
const fromFragment = create.Function({ execute: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return value;
} }, parent);
void fromFragment();
// @ts-expect-error Possibly private inherited fields cannot be overridden.
void fromFragment({ value: '7' });
const fragment = create.Config({ inputSchema, execute: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return value;
} });
void create.Function({}, fragment)({ value: '5' });
const inheritedPrompt = create.LLMAgent.withFunction({ model, prompt: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return String(value);
} }, parent);
void inheritedPrompt();

const script = create.Script({ inputSchema, script: 'return value' });
void script({ value: '5' });
// @ts-expect-error Required schema input may not be missing.
void script();
const template = create.Template({ inputSchema, template: '{{ value }}', context: { value: '5' } });
void template();
// @ts-expect-error Run must protect fields private in the absent branch.
void template.run({ context: { value: '7' } });
const text = create.LLMAgent.withFunction({ model, inputSchema, prompt: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return String(value);
} });
void text({ value: '5' });
void text.run({ context: { value: '5' } });
// @ts-expect-error Required input cannot be omitted.
void text.run({});
const stream = create.LLMAgent.withFunction.asStream({ model, inputSchema, context: { value: '5' }, prompt: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return String(value);
} });
void stream();
// @ts-expect-error Run cannot overwrite a possibly private field.
void stream.run({ context: { value: '7' } });
const object = create.LLMAgent.withFunction({ model, inputSchema, prompt: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return String(value);
}, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
void object({ value: '5' });
const objectStream = create.LLMAgent.withFunction.asStream({ model, inputSchema, prompt: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return String(value);
}, output: Output.object({ schema: z.object({ answer: z.string() }) }) });
void objectStream.run({ context: { value: '5' } });
const rendered = create.LLMAgent.withTemplate({ model, inputSchema, prompt: '{{ value }}', context: { value: '5' } });
void rendered();
// @ts-expect-error Rendered calls have the same privacy rule.
void rendered({ value: '7' });

const outputSchema = enabled ? z.string().transform(Number) : undefined;
// @ts-expect-error Producers must satisfy the parser if it exists.
create.Function({ schema: outputSchema, execute: () => 5 });
const _producer = create.Function({ schema: outputSchema, execute: () => '5' });
expectEqual<Awaited<ReturnType<typeof _producer>>, string | number>();
