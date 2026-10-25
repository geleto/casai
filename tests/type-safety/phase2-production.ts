import { create, z, streamSchema, textStreamSchema, collectStream, collectTextStream, toReadableStream } from 'casai';
import { Output, tool } from 'ai';
import type { ComponentExecutionOptions } from 'casai';
import type { LanguageModel, Tool } from 'ai';
import { expectEqual, expectType } from './assert.js';

const inputSchema = z.object({ amount: z.string().transform(Number), tag: z.string().default('tag') });
const parent = create.Config({ inputSchema, context: { amount: '2', db: { query: () => 1 } } });
const component = create.Function({ execute: ({ amount, tag: _tag, db, _toolOptions }) => {
	expectEqual<typeof amount, number>();
	expectEqual<typeof _tag, string>();
	expectEqual<typeof _toolOptions, ComponentExecutionOptions>();
	return amount + db.query();
} }, parent);
expectType<Promise<number>>(component());
void component({});
void component({ amount: '3' });
void component.run({ context: {} });
const unknownRunSetting = { context: {}, typo: 1 };
// @ts-expect-error Named invocation settings reject extra keys in variables too.
void component.run(unknownRunSetting);
// @ts-expect-error Ordinary callers provide raw schema input.
void component({ amount: 3 });
// @ts-expect-error An explicit undefined overrides configuration and leaves a required field missing.
void component({ amount: undefined });
// @ts-expect-error Private dependencies are not public arguments.
void component({ db: { query: () => 0 } });
// @ts-expect-error Closed stripping schemas reject undeclared fields in typed calls.
void component({ extra: true });
const extra = { amount: '3', extra: true };
// @ts-expect-error Variables cannot bypass closed shape checking.
void component(extra);

const open = create.Function({ inputSchema: z.object({ value: z.number() }).passthrough(), context: { user: 'trusted' }, execute: ({ value }) => value });
void open({ value: 1, extra: true });
// @ts-expect-error An open schema still cannot replace private bindings.
void open({ value: 1, user: 'admin' });
const catchall = create.Function({ inputSchema: z.object({ value: z.number() }).catchall(z.number()), execute: ({ value }) => value });
void catchall({ value: 1, extra: 2 });
// @ts-expect-error Catchall extras retain their declared type.
void catchall({ value: 1, extra: '2' });

const action = create.Function.asTool({
	inputSchema, context: { amount: '2', factor: 1 },
	toolContextSchema: z.object({ factor: z.string().transform(Number), amount: z.string().optional() }),
	execute: ({ amount, factor }) => amount * factor,
});
void action();
void action.run({ context: { amount: '4' } });
void action.execute({ amount: 4, tag: 'parsed' }, { toolCallId: 'call', messages: [], context: { factor: 3 } });
const binding = action.bindToolContext({ factor: '3', amount: '4' });
expectType<string>(binding.context.factor);
// @ts-expect-error Bound context captures the raw context schema input.
action.bindToolContext({ factor: 3 });
// @ts-expect-error Native execution receives parsed public arguments.
void action.execute({ amount: '4', tag: 'tag' }, { toolCallId: 'call', messages: [], context: { factor: 3 } });
const owner = create.Function({
	tools: { action }, toolsContext: { action: { factor: '2' } },
	execute: ({ action }) => {
		expectEqual<Awaited<ReturnType<typeof action>>, number>();
		// @ts-expect-error Injected Casai helpers accept raw application input.
		void action({ amount: 3 });
		return action({ amount: '3' });
	},
});
expectType<Promise<number>>(owner());
const contextOverride = { toolsContext: { action: { factor: '3' }, typo: {} } };
declare const contextAlternatives: { action: { factor: string } } | { action: { factor: string }; typo: object };
const optionalContextTool = create.Function.asTool({
	inputSchema: z.object({}), toolContextSchema: z.object({ factor: z.number() }).optional(),
	context: { factor: 1 }, execute: ({ factor }) => factor,
});
const templateContextOwner = create.Template({ template: 'ok', tools: { action }, toolsContext: { action: { factor: '2' } } });
const scriptContextOwner = create.Script({ script: 'return 1', tools: { action }, toolsContext: { action: { factor: '2' } } });
// Check each concrete run signature: a component union could reject every call.
void owner.run();
void owner.run({ toolsContext: { action: { factor: '3' } } });
void owner.run({ toolsContext: undefined });
// @ts-expect-error Explicit undefined cannot clear a required context, in either optional mode.
void owner.run({ toolsContext: { action: undefined } });
// @ts-expect-error Known names are checked even when extra entries arrive through a variable.
void owner.run(contextOverride);
// @ts-expect-error A name present in only one possible override branch is still unknown.
void owner.run({ toolsContext: contextAlternatives });
// @ts-expect-error Overrides use the raw context schema type.
void owner.run({ toolsContext: { action: { factor: 3 } } });
void templateContextOwner.run();
void templateContextOwner.run({ toolsContext: { action: { factor: '3' } } });
void templateContextOwner.run({ toolsContext: undefined });
// @ts-expect-error Explicit undefined cannot clear a required context, in either optional mode.
void templateContextOwner.run({ toolsContext: { action: undefined } });
// @ts-expect-error Known names are checked even when extra entries arrive through a variable.
void templateContextOwner.run(contextOverride);
// @ts-expect-error A name present in only one possible override branch is still unknown.
void templateContextOwner.run({ toolsContext: contextAlternatives });
// @ts-expect-error Overrides use the raw context schema type.
void templateContextOwner.run({ toolsContext: { action: { factor: 3 } } });
void scriptContextOwner.run();
void scriptContextOwner.run({ toolsContext: { action: { factor: '3' } } });
void scriptContextOwner.run({ toolsContext: undefined });
// @ts-expect-error Explicit undefined cannot clear a required context, in either optional mode.
void scriptContextOwner.run({ toolsContext: { action: undefined } });
// @ts-expect-error Known names are checked even when extra entries arrive through a variable.
void scriptContextOwner.run(contextOverride);
// @ts-expect-error A name present in only one possible override branch is still unknown.
void scriptContextOwner.run({ toolsContext: contextAlternatives });
// @ts-expect-error Overrides use the raw context schema type.
void scriptContextOwner.run({ toolsContext: { action: { factor: 3 } } });
const partialContextOwner = create.Function({
	tools: { action, optionalContextTool }, toolsContext: { action: { factor: '2' } },
	execute: ({ action }) => action({ amount: '3' }),
});
void partialContextOwner.run({ toolsContext: { optionalContextTool: undefined } });
void partialContextOwner.run({ toolsContext: { action: { factor: '4' } } });
void partialContextOwner.run({ toolsContext: {} });
// @ts-expect-error Adding an optional entry does not make another required entry clearable.
void partialContextOwner.run({ toolsContext: { action: undefined, optionalContextTool: undefined } });
const callbackContextTool = create.Function.asTool({
	inputSchema: z.object({}), toolContextSchema: z.object({ map: z.custom<(value: number) => number>() }),
	context: { map: (value: number) => value }, execute: ({ map }) => map(1),
});
const callbackContextOwner = create.Function({
	tools: { callbackContextTool, action }, toolsContext: { callbackContextTool: { map: (value: number) => value }, action: { factor: '2' } },
	execute: ({ callbackContextTool }) => callbackContextTool({}),
});
void callbackContextOwner.run({ toolsContext: { callbackContextTool: { map: value => {
	expectEqual<typeof value, number>();
	return value * 2;
} } } });
// @ts-expect-error Context-sensitive callbacks cannot hide an unknown map entry.
void callbackContextOwner.run({ toolsContext: { callbackContextTool: { map: value => value }, typo: {} } });
// @ts-expect-error Context-sensitive callbacks cannot hide clearing another required entry.
void callbackContextOwner.run({ toolsContext: { callbackContextTool: { map: value => value }, action: undefined } });
const helperFragment = create.Config({
	tools: { action }, toolsContext: { action: { factor: '2' } },
	execute: ({ action }) => {
		expectEqual<Awaited<ReturnType<typeof action>>, number>();
		return action({ amount: '3' });
	},
});
expectType<Promise<number>>(create.Function({}, helperFragment)());
// @ts-expect-error Tool context configuration uses retained raw input types.
create.Function({ tools: { action }, toolsContext: { action: { factor: 3 } }, execute: () => 1 });
// @ts-expect-error Tool contexts must name registered tools.
create.Function({ tools: { action }, toolsContext: { action: { factor: '3' }, typo: {} }, execute: () => 1 });
create.Function({ context: { label: 'ok' }, tools: { action }, toolsContext: { action: { factor: '3' } }, execute: input => input.label });
// @ts-expect-error Providing configured context must not skip registry-name validation.
create.Function({ context: { label: 'ok' }, tools: { action }, toolsContext: { action: { factor: '3' }, typo: {} }, execute: input => input.label });

const native = tool({ inputSchema: z.number(), execute: value => value + 1 });
const nativeOwner = create.Function({ tools: { native }, execute: ({ native }) => native(1) });
expectType<Promise<number>>(nativeOwner());
// A retained descriptor shows execute is absent; native tool() erases that fact.
const clientOnly = { inputSchema: z.object({}), outputSchema: z.number() } satisfies Tool;
const noHelper = create.Function({
	inputSchema: z.looseObject({}), tools: { clientOnly }, execute: input => {
		expectEqual<typeof input.clientOnly, unknown>();
		return input.clientOnly;
	},
});
void noHelper({ clientOnly: 'ordinary extra' });
const removed = create.Function({ tools: { native: null }, execute: () => 2 }, nativeOwner);
void removed();
const rendered = create.Template({ template: '{{ native(1) }}', tools: { native } });
void rendered.run({});
void create.Template({}, rendered).run({});
void create.Script({}, create.Script({ script: 'return 1' })).run({});
declare const model: LanguageModel;
create.TextGenerator.withFunction({
	model, tools: { action }, toolsContext: { action: { factor: '2' } },
	prompt: async ({ action }) => String(await action({ amount: '3' })),
});
create.TextStreamer.withFunction({
	model, tools: { native }, prompt: async ({ native }) => String(await native(1)),
});
const values = z.object({ values: z.array(z.string()) });
void create.Template({ template: '{{ values }}', inputSchema: values, context: { values: ['a'] } })();
void create.Script({ script: 'return values', inputSchema: values, context: { values: ['a'] } })();

const stream = create.Function({ schema: streamSchema(z.string().transform(Number)), execute: async function* () { yield '1'; } });
expectType<Promise<AsyncIterable<number>>>(stream());
void stream().then(collectStream);
const streamedTool = create.Function.asTool({
	inputSchema: z.object({}), schema: textStreamSchema(), execute: async function* () { yield 'text'; },
	toModelOutput: ({ output }) => { expectEqual<typeof output, string>(); return { type: 'text', value: output }; },
});
create.Function.asTool({
	inputSchema: z.object({}), schema: streamSchema(z.string().transform(Number)), execute: async function* () { yield '1'; },
	toModelOutput: ({ output }) => {
		expectEqual<typeof output, number[]>();
		return { type: 'text', value: output.join(',') };
	},
});
expectType<Promise<AsyncIterable<string>>>(streamedTool());
expectType<PromiseLike<string>>(streamedTool.execute({}, { toolCallId: 'call', messages: [], context: undefined }));
void streamedTool().then(collectTextStream);
void streamedTool().then(toReadableStream);
// @ts-expect-error Stream producers must yield raw element types accepted by their schema.
create.Function({ schema: streamSchema(z.string().transform(Number)), execute: async function* () { yield 1; } });
// @ts-expect-error A known tool stream requires an explicit stream schema.
create.Function.asTool({ inputSchema: z.object({}), execute: async function* () { yield 'text'; } });
// Opaque outputs and implementations that only throw do not prove a stream result.
create.Function.asTool({ inputSchema: z.object({}), schema: z.any(), execute: () => 1 });
create.Function.asTool({ inputSchema: z.object({}), execute: (): never => { throw new Error('failed'); } });
const scriptStream = create.Script.asTool({ inputSchema: z.object({}), script: 'return chunks()', schema: textStreamSchema(), context: { chunks: async function* () { yield 'text'; } } });
expectType<Promise<AsyncIterable<string>>>(scriptStream());
expectType<PromiseLike<string>>(scriptStream.execute({}, { toolCallId: 'call', messages: [], context: undefined }));
const iterableOutput = z.object({}).transform(() => ({ async *[Symbol.asyncIterator]() { yield 1; } }));
const nativeIterableOutput = Output.object({ schema: iterableOutput });
// Ordinary native model outputs retain their declared result type.
expectType<Promise<AsyncIterable<number>>>(create.TextGenerator({ model, prompt: 'ready', output: nativeIterableOutput })().then(result => result.value));
expectType<Promise<AsyncIterable<number>>>(create.ObjectGenerator({ model, prompt: 'ready', schema: iterableOutput })().then(result => result.value));
// @ts-expect-error Casai tools cannot expose an undeclared root iterable to the SDK.
create.TextGenerator.asTool({ model, prompt: 'ready', inputSchema: z.object({}), output: nativeIterableOutput });
// @ts-expect-error Object generator tools have the same completed-output requirement.
create.ObjectGenerator.asTool({ model, prompt: 'ready', inputSchema: z.object({}), schema: iterableOutput });
const iterableTextParent = create.Config({ model, prompt: 'ready', output: nativeIterableOutput });
// @ts-expect-error Inherited output settings retain the same tool restriction.
create.TextGenerator.asTool({ inputSchema: z.object({}) }, iterableTextParent);
create.TextGenerator.asTool({ inputSchema: z.object({}), output: Output.text() }, iterableTextParent);
const iterableObjectParent = create.Config({ model, prompt: 'ready', schema: iterableOutput });
// @ts-expect-error Inherited schemas cannot evade the completed-output requirement.
create.ObjectGenerator.asTool({ inputSchema: z.object({}) }, iterableObjectParent);
create.ObjectGenerator.asTool({ inputSchema: z.object({}), schema: z.object({ answer: z.number() }) }, iterableObjectParent);

// Native contextSchema is forbidden even when undefined or inherited.
// @ts-expect-error The native spelling is descriptor-only.
create.Config({ contextSchema: undefined });
// @ts-expect-error Component config accepts only toolContextSchema.
create.Function.asTool({ inputSchema, contextSchema: undefined, execute: () => 1 });
// @ts-expect-error Inheritance cannot introduce the native config spelling.
create.Template({ template: 'x' }, { config: { contextSchema: undefined } });
create.Function({ context: { contextSchema: 'application data' }, execute: context => context.contextSchema });

const callbacks = create.Function({
	inputSchema: z.object({ value: z.number(), map: z.custom<(value: number) => string>() }).passthrough(),
	execute: ({ value, map }) => map(value),
});
void callbacks({ value: 1, map: value => { expectEqual<typeof value, number>(); return String(value); }, extra: true });
const callbackDefaults = create.Function({
	inputSchema: z.object({ factor: z.string(), map: z.custom<(value: number) => number>() }),
	context: { factor: '3' }, execute: ({ factor, map }) => map(Number(factor)),
});
void callbackDefaults({ map: value => value });
// @ts-expect-error Context-sensitive callback inference cannot hide explicit undefined.
void callbackDefaults({ factor: undefined, map: value => value });
// @ts-expect-error The named call has the same complete-input requirement.
void callbackDefaults.run({ context: { factor: undefined, map: value => value } });

create.Function.asTool({
	inputSchema, schema: z.string().transform(Number), toolContextSchema: z.object({ factor: z.string().transform(Number) }),
	context: { factor: 1 },
	execute: ({ amount, factor }) => String(amount * factor),
	onInputAvailable: ({ input: _input, context: _context }) => {
		expectEqual<typeof _input.amount, number>();
		expectEqual<typeof _context.factor, number>();
	},
	needsApproval: (_input, _options) => {
		expectEqual<typeof _input.amount, number>();
		expectEqual<typeof _options.context.factor, number>();
		return false;
	},
	toModelOutput: ({ output }) => {
		expectEqual<typeof output, number>();
		return { type: 'text', value: String(output) };
	},
});

create.Template.asTool({
	template: '{{ amount }}', inputSchema, toolContextSchema: z.object({ factor: z.string().transform(Number) }),
	onInputAvailable: ({ input: _input, context: _context }) => {
		expectEqual<typeof _input.amount, number>();
		expectEqual<typeof _context.factor, number>();
	},
	toModelOutput: ({ output }) => {
		expectEqual<typeof output, string>();
		return { type: 'text', value: output };
	},
});
create.Script.asTool({
	script: 'return amount', inputSchema, schema: z.number(),
	needsApproval: _input => { expectEqual<typeof _input.amount, number>(); return false; },
	toModelOutput: ({ output }) => {
		expectEqual<typeof output, number>();
		return { type: 'text', value: String(output) };
	},
});
create.TextGenerator.asTool({
	model, prompt: 'ready', inputSchema,
	onInputAvailable: ({ input: _input }) => { expectEqual<typeof _input.amount, number>(); },
	toModelOutput: ({ output }) => { expectEqual<typeof output, string>(); return { type: 'text', value: output }; },
});
create.ObjectGenerator.asTool({
	model, prompt: 'ready', inputSchema, schema: z.object({ result: z.number() }),
	onInputAvailable: ({ input: _input }) => { expectEqual<typeof _input.amount, number>(); },
	toModelOutput: ({ output }) => { expectEqual<typeof output, { result: number }>(); return { type: 'text', value: String(output.result) }; },
});

// Every helper returns the descriptor's completed output, independently of its factory.
const helperTools = {
	template: create.Template.asTool({ template: 'ready', inputSchema: z.object({}) }),
	script: create.Script.asTool({ script: 'return "2"', inputSchema: z.object({}), schema: z.string().transform(Number) }),
	text: create.TextGenerator.asTool({ model, prompt: 'ready', inputSchema: z.object({}) }),
	textObject: create.TextGenerator.asTool({ model, prompt: 'ready', inputSchema: z.object({}),
		output: Output.object({ schema: z.object({ x: z.number() }) }) }),
	objectArray: create.ObjectGenerator.asTool({ model, prompt: 'ready', inputSchema: z.object({}),
		output: 'array', schema: z.object({ x: z.number() }) }),
	objectEnum: create.ObjectGenerator.asTool({ model, prompt: 'ready', inputSchema: z.object({}),
		output: 'enum', enum: ['yes', 'no'] as const }),
	streamed: create.Function.asTool({ inputSchema: z.object({}),
		schema: streamSchema(z.string().transform(Number)), execute: async function* () { yield '2'; } }),
};
const helperResults = create.Config({
	tools: helperTools, execute: async helpers => {
		expectEqual<Awaited<ReturnType<typeof helpers.template>>, string>();
		expectEqual<Awaited<ReturnType<typeof helpers.script>>, number>();
		expectEqual<Awaited<ReturnType<typeof helpers.text>>, string>();
		expectEqual<Awaited<ReturnType<typeof helpers.textObject>>, { x: number }>();
		expectEqual<Awaited<ReturnType<typeof helpers.objectArray>>, { x: number }[]>();
		expectEqual<Awaited<ReturnType<typeof helpers.objectEnum>>, 'yes' | 'no'>();
		expectEqual<Awaited<ReturnType<typeof helpers.streamed>>, number[]>();
		return (await helpers.objectArray({})).map(value => value.x);
	},
});
expectType<Promise<number[]>>(create.Function({}, helperResults)());
create.Function({
	tools: helperTools, execute: async helpers => {
		expectType<string>(await helpers.template({}));
		expectType<number>(await helpers.script({}));
		expectType<string>(await helpers.text({}));
		expectType<{ x: number }>(await helpers.textObject({}));
		expectType<{ x: number }[]>(await helpers.objectArray({}));
		expectType<'yes' | 'no'>(await helpers.objectEnum({}));
		expectType<number[]>(await helpers.streamed({}));
		// @ts-expect-error An array tool's completed output is not one element.
		const element: { x: number } = await helpers.objectArray({});
		return element.x;
	},
});
create.TextGenerator.withFunction({
	model, tools: helperTools, prompt: async helpers => {
		expectType<number>(await helpers.script({}));
		expectType<string>(await helpers.text({}));
		expectType<{ x: number }>(await helpers.textObject({}));
		expectType<{ x: number }[]>(await helpers.objectArray({}));
		expectType<'yes' | 'no'>(await helpers.objectEnum({}));
		expectType<number[]>(await helpers.streamed({}));
		return (await helpers.template({})).toUpperCase();
	},
});
