import { create, z } from 'casai';
import type { FunctionConfig } from 'casai';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

const input = z.object({ value: z.string().transform(Number), count: z.number().default(1) });
const output = z.string().transform(Number);
declare const optionalInput: { inputSchema?: typeof input };
declare const conditionalInput: { inputSchema: typeof input | undefined };
declare const optionalOutput: { schema?: typeof output };
declare const conditionalOutput: { schema: typeof output | undefined };
declare const model: LanguageModel;
declare const enabled: boolean;

// Conditional spreads keep their original inference without an annotation.
const inputSpread = enabled ? { inputSchema: input } : {};
create.Function({ ...inputSpread, execute: ({ value, count: _count }) => {
	expectEqual<typeof value, string | number>();
	expectEqual<typeof _count, number | undefined>();
	return value;
} });
create.Config({ ...inputSpread, execute: ({ value, count: _count }) => {
	expectEqual<typeof value, string | number>();
	expectEqual<typeof _count, number | undefined>();
	return value;
} });
create.TextGenerator.withFunction({ model, ...inputSpread, prompt: ({ value }) => {
	expectEqual<typeof value, string | number>();
	return String(value);
} });

// Optional properties and explicit undefined both preserve unparsed execution.
const optional = create.Function({ ...optionalInput, execute: ({ value, count: _count }) => {
	expectEqual<typeof value, string | number>();
	expectEqual<typeof _count, number | undefined>();
	// @ts-expect-error The parser may not run.
	value.toFixed(); // eslint-disable-line @typescript-eslint/no-unsafe-call -- Intentional compiler rejection.
	// @ts-expect-error An absent parser does not supply defaults.
	_count.toFixed();
	return value;
} });
const conditional = create.Function({ ...conditionalInput, execute: ({ value, count: _count }) => {
	expectEqual<typeof value, string | number>();
	expectEqual<typeof _count, number | undefined>();
	return value;
} });
expectEqual<Awaited<ReturnType<typeof optional>>, string | number>();
expectEqual<Awaited<ReturnType<typeof conditional>>, string | number>();
void optional({ value: '2' });
void conditional.run({ context: { value: '2' } });
// @ts-expect-error The possible parser still requires valid raw input.
void optional({ value: 2 });
// @ts-expect-error Schema presence is not guaranteed, but it remains possible.
void optional();

const _outputOptional = create.Function({ ...optionalOutput, execute: () => '2' });
const _outputConditional = create.Function({ ...conditionalOutput, execute: () => '2' });
const outputSpread = enabled ? { schema: output } : {};
const _spreadOutput = create.Function({ ...outputSpread, execute: () => '2' });
expectEqual<Awaited<ReturnType<typeof _spreadOutput>>, string | number>();
expectEqual<Awaited<ReturnType<typeof _outputOptional>>, string | number>();
expectEqual<Awaited<ReturnType<typeof _outputConditional>>, string | number>();
expectEqual<Awaited<ReturnType<typeof _outputOptional.run>>, string | number>();
const outputTool = create.Function.asTool({ inputSchema: z.object({}), ...optionalOutput, execute: () => '2' });
expectEqual<Awaited<ReturnType<typeof outputTool.execute>>, string | number>();
create.Function({ tools: { outputTool }, execute: async ({ outputTool }) => {
	expectEqual<Awaited<ReturnType<typeof outputTool>>, string | number>();
	return outputTool({});
} });

// Parent configurations retain optional schema properties instead of making them required.
const fragment = create.Config({ ...optionalInput, ...optionalOutput });
const _child = create.Function({ execute: ({ value, count: _count }) => {
	expectEqual<typeof value, string | number>();
	expectEqual<typeof _count, number | undefined>();
	return String(value);
} }, fragment);
expectEqual<Awaited<ReturnType<typeof _child>>, string | number>();
const fixedChild = create.Function({ inputSchema: input, schema: output, execute: ({ value, count: _count }) => {
	expectEqual<typeof value, number>();
	expectEqual<typeof _count, number>();
	return String(value + _count);
} }, fragment);
expectEqual<Awaited<ReturnType<typeof fixedChild>>, number>();
const _removedOutput = create.Function({ schema: undefined, execute: () => 'raw' }, fixedChild);
expectEqual<Awaited<ReturnType<typeof _removedOutput>>, string>();

// Config callback inference and JS preparers use the same schema-presence rules.
create.Config({ ...optionalInput, execute: ({ value, count: _count }) => {
	expectEqual<typeof value, string | number>();
	expectEqual<typeof _count, number | undefined>();
	return value;
} });
create.TextGenerator.withFunction({ model, ...optionalInput, prompt: ({ value, count: _count }) => {
	expectEqual<typeof value, string | number>();
	expectEqual<typeof _count, number | undefined>();
	return String(value) + String(_count);
} });
create.ObjectStreamer.withFunction({ model, schema: z.object({ answer: z.string() }), ...optionalInput, prompt: ({ value, count: _count }) => {
	expectEqual<typeof value, string | number>();
	expectEqual<typeof _count, number | undefined>();
	return String(value) + String(_count);
} });

// Optional schema declarations cannot publish configured private values as guaranteed public input.
const privateValue = create.Function({ ...optionalInput, context: { value: '2' }, execute: ({ value }) => value });
void privateValue();
// @ts-expect-error The value remains private when no schema is present.
void privateValue({ value: '3' });

// A concrete value keeps presence through satisfies; an annotation can erase that evidence.
const concrete = { inputSchema: input, schema: output, execute: ({ value, count: _count }) => String(value + _count) } satisfies FunctionConfig<typeof input, typeof output, undefined>;
const _precise = create.Function(concrete);
expectEqual<Awaited<ReturnType<typeof _precise>>, number>();
const widened: FunctionConfig<typeof input, typeof output, undefined> = concrete;
// @ts-expect-error The widened type no longer guarantees parsing before its callback.
create.Function(widened);

// An optional descriptor context schema cannot guarantee a non-undefined context.
const contextSchema = z.object({ factor: z.number() });
declare const optionalContext: { toolContextSchema?: typeof contextSchema };
const contextTool = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), context: { factor: 1 }, ...optionalContext,
	needsApproval: (_input, { context }) => {
		expectEqual<typeof context, { factor: number } | undefined>();
		return context?.factor === 0;
	}, execute: ({ value, factor }) => value * factor });
void contextTool.execute({ value: 2 }, { toolCallId: 'test', messages: [], context: undefined });
// @ts-expect-error The possible context schema still rejects incompatible context values.
void contextTool.execute({ value: 2 }, { toolCallId: 'test', messages: [], context: { factor: 'wrong' } });

const contextSpread = enabled ? { toolContextSchema: contextSchema } : {};
create.Function.asTool({ inputSchema: z.object({ value: z.number() }), context: { factor: 1 }, ...contextSpread,
	needsApproval: (_input, { context }) => {
		expectEqual<typeof context, { factor: number } | undefined>();
		return context?.factor === 0;
	}, execute: ({ value, factor }) => value * factor });

// Descriptor callbacks also see the unparsed output alternative.
create.Function.asTool({ inputSchema: z.object({}), schema: enabled ? output : undefined, execute: () => '2',
	toModelOutput: ({ output }) => {
		expectEqual<typeof output, string | number>();
		return { type: 'text', value: String(output) };
	} });

// Output from an unparsed Script is unknown, even when its annotation permits a schema.
const _optionalScript = create.Script({ ...optionalOutput, script: 'return "2"' });
expectEqual<Awaited<ReturnType<typeof _optionalScript>>, unknown>();
