import type { EmptyMap } from './assert.js';
import { create, z } from 'casai';
import type { LLMAgentConfig, ConfigProvider } from 'casai';
import { Output, jsonSchema } from 'ai';
import type { LanguageModel, JSONValue, OutputInterface } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
const schema = z.object({ answer: z.string().transform(Number), label: z.string(), optional: z.boolean().optional() });
interface Answer { answer: number; label: string; optional?: boolean | undefined }
const output = Output.object({ schema });
const parent = create.Config({ model, output });
const generated = create.LLMAgent({ prompt: 'Answer' }, parent);
const streamed = create.LLMAgent.asStream({ prompt: 'Answer' }, parent);
expectEqual<Awaited<ReturnType<typeof generated>>['value'], Answer>();
expectEqual<Awaited<ReturnType<typeof streamed>>['value'], Promise<Answer>>();
expectEqual<Awaited<ReturnType<typeof generated>>['output'], Answer>();
// @ts-expect-error Parsed output differs from the raw schema input.
expectType<{ answer: string }>((await generated()).value);
// @ts-expect-error Structured streaming value is a promise of the complete output.
expectType<AsyncIterable<Answer>>((await streamed()).value);

const sdkSchema = jsonSchema<{ value: string }>({ type: 'object', properties: { value: { type: 'string' } }, required: ['value'] });
const sdk = create.LLMAgent({ model, output: Output.object({ schema: sdkSchema }) });
expectEqual<Awaited<ReturnType<typeof sdk>>['value'], { value: string }>();
const scalar = create.LLMAgent({ model, output: Output.object({ schema: z.number() }) });
expectEqual<Awaited<ReturnType<typeof scalar>>['value'], number>();
const arrays = create.LLMAgent.asStream({ model, output: Output.array({ element: schema }) });
expectEqual<Awaited<ReturnType<typeof arrays>>['value'], Promise<Answer[]>>();
expectType<AsyncIterable<Answer>>((await arrays('Answer')).elementStream);
const nested = create.LLMAgent({ model, output: Output.array({ element: z.array(z.boolean()) }) });
expectEqual<Awaited<ReturnType<typeof nested>>['value'], boolean[][]>();
// @ts-expect-error The native array specification requires its element schema.
Output.array({});
// @ts-expect-error The native object specification requires its schema.
Output.object({});

const choice = Output.choice({ options: ['YES', 'NO'] });
const chooser = create.LLMAgent({ model, output: choice });
const choiceStream = create.LLMAgent.asStream({ model, output: choice });
expectEqual<Awaited<ReturnType<typeof chooser>>['value'], 'YES' | 'NO'>();
expectEqual<Awaited<ReturnType<typeof choiceStream>>['value'], Promise<'YES' | 'NO'>>();
// @ts-expect-error Choice alternatives are strings.
Output.choice({ options: [1, 2] });
const json = create.LLMAgent({ model, output: Output.json() });
const jsonStream = create.LLMAgent.asStream({ model, output: Output.json() });
expectEqual<Awaited<ReturnType<typeof json>>['value'], JSONValue>();
expectEqual<Awaited<ReturnType<typeof jsonStream>>['value'], Promise<JSONValue>>();
// @ts-expect-error JSON cannot promise a specific object shape.
expectType<{ answer: number }>((await json('Answer')).value);

const text = create.LLMAgent({ model });
const textStream = create.LLMAgent.asStream({ model });
const explicitText = create.LLMAgent.asStream({ model, output: Output.text() });
expectEqual<Awaited<ReturnType<typeof text>>['value'], string>();
expectEqual<Awaited<ReturnType<typeof textStream>>['value'], AsyncIterable<string>>();
expectEqual<Awaited<ReturnType<typeof explicitText>>['value'], Promise<string>>();
const cleared = create.LLMAgent.asStream({ output: undefined }, parent);
expectEqual<Awaited<ReturnType<typeof cleared>>['value'], AsyncIterable<string>>();
const replacement = create.LLMAgent({ output: Output.object({ schema: z.object({ accepted: z.boolean() }) }) }, parent);
expectEqual<Awaited<ReturnType<typeof replacement>>['value'], { accepted: boolean }>();
// @ts-expect-error Replacing output replaces the completed value type.
expectType<Answer>((await replacement('Answer')).value);

declare const optionalOutput: typeof output | undefined;
const maybe = create.LLMAgent.asStream({ model, output: optionalOutput });
expectEqual<Awaited<ReturnType<typeof maybe>>['value'], Promise<Answer> | AsyncIterable<string>>();
declare const unionOutput: typeof output | typeof choice;
const union = create.LLMAgent.asStream({ model, output: unionOutput });
expectEqual<Awaited<ReturnType<typeof union>>['value'], Promise<Answer> | Promise<'YES' | 'NO'>>();
declare const custom: OutputInterface<AsyncIterable<number>, number, number>;
const customStream = create.LLMAgent.asStream({ model, output: custom });
expectEqual<Awaited<ReturnType<typeof customStream>>['value'], Promise<AsyncIterable<number>>>();

const annotated: LLMAgentConfig<EmptyMap, EmptyMap, string, typeof output> = { model, output };
const annotatedAgent = create.LLMAgent(annotated);
expectEqual<Awaited<ReturnType<typeof annotatedAgent>>['value'], Answer | string | Promise<Answer> | AsyncIterable<string>>();

// Configuration owns output; calls only override invocation settings.
void generated.run({ temperature: 0.2, maxOutputTokens: 30 });
void streamed.run({ onError: () => undefined, streamRetries: 1 });
// @ts-expect-error Output is fixed at construction.
void generated.run({ output: Output.text() });
// @ts-expect-error Input schema is fixed at construction.
void generated.run({ inputSchema: z.object({}) });
// @ts-expect-error Loader is fixed at construction.
void generated.run({ loader: {} });
// @ts-expect-error Unknown run settings cannot be hidden in a variable.
void generated.run({ unexpected: true });
// @ts-expect-error Numeric model settings keep their native types.
void generated.run({ temperature: 'hot' });
// @ts-expect-error Missing model cannot be supplied by the shorthand caller.
create.LLMAgent({ output });
// @ts-expect-error Missing model remains invalid in streaming mode.
create.LLMAgent.asStream({ output });
// @ts-expect-error Explicit undefined clears an inherited required model.
create.LLMAgent({ model: undefined }, parent);
// @ts-expect-error Explicit null cannot satisfy the model contract.
create.LLMAgent({ model: null }, parent);
// @ts-expect-error Factory child settings are required, even with inheritance.
create.LLMAgent();
// @ts-expect-error Explicit undefined is not a parent provider.
create.LLMAgent({}, undefined);
declare const maybeParent: [] | [typeof parent];
// @ts-expect-error Parent presence must be narrowed before relying on its model.
create.LLMAgent({}, ...maybeParent);
// @ts-expect-error An expected result cannot invent a missing model.
const invented: { config: { model: LanguageModel } } = create.LLMAgent({ prompt: 'hello' });


// The removed API cannot be restored by variables, fragments, parents, or unions.
// @ts-expect-error SDK Output replaces the legacy schema setting on agents.
create.LLMAgent({ model, schema });
// @ts-expect-error There are no string output modes.
create.LLMAgent({ model, output: 'object' });
// @ts-expect-error The SDK selects the wire format.
create.Config({ model, mode: 'json' });
const invalid = { model, enum: ['YES', 'NO'], output: choice };
// @ts-expect-error Existing variables retain forbidden keys.
create.LLMAgent(invalid);
declare const invalidParent: ConfigProvider<{ model: LanguageModel; mode: 'json' }>;
// @ts-expect-error Raw parents do not restore retired settings.
create.LLMAgent.asStream({}, invalidParent);
declare const alternatives: ConfigProvider<{ model: LanguageModel } | { model: LanguageModel; mode: 'json' }>;
// @ts-expect-error Every parent branch must satisfy the final contract.
create.LLMAgent({}, alternatives);
// @ts-expect-error Coded component settings do not belong to an agent.
create.LLMAgent({ model, script: 'return 1' });
// @ts-expect-error Unknown constructor settings remain rejected.
create.LLMAgent({ model, extraSetting: true });

// A function source can be supplied by shorthand; tool sources are fixed.
const preparer = create.LLMAgent.withFunction({ model, inputSchema: z.object({ count: z.string().transform(Number) }), output });
void preparer(context => String(context.count), { count: '2' });
// @ts-expect-error The source is required until configuration supplies it.
void preparer({ count: '2' });
const executable = create.LLMAgent.withFunction.asTool({ model, output, inputSchema: z.object({ count: z.string().transform(Number) }), prompt: context => String(context.count) });
expectType<PromiseLike<Answer>>(executable.execute({ count: 2 }, { toolCallId: '1', messages: [], context: undefined }));
void executable({ count: '2' });
// @ts-expect-error Descriptor execution receives parsed input.
executable.execute({ count: '2' }, { toolCallId: '1', messages: [], context: undefined });
// @ts-expect-error Ordinary tool calls receive raw input.
void executable({ count: 2 });
// @ts-expect-error Model-callable tools need their configured source.
create.LLMAgent.withFunction.asTool({ model, inputSchema: z.object({}) });
// @ts-expect-error Model-callable tools need explicit public input fields.
create.LLMAgent.asTool({ model, prompt: 'fixed' });
















export { invented, sdk, scalar, nested, chooser, choiceStream, jsonStream, text, textStream, explicitText, cleared, maybe, union, customStream, annotatedAgent };
