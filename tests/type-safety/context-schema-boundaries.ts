// Context wrappers accept objects before validation; SDK Function tools receive parsed input.
import { create, z } from 'casai';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

declare const model: LanguageModel;
const scalarInput = z.string().transform(value => ({ value }));
const arrayInput = z.array(z.string()).transform(value => ({ value: value.join('') }));
const mixedInput = z.union([z.object({ value: z.string() }), scalarInput]);
// @ts-expect-error Ordinary Function dispatch cannot use a string as context.
create.Function({ inputSchema: scalarInput, execute: () => 1 });
// @ts-expect-error Ordinary Function merges object context rather than array context.
create.Function({ inputSchema: arrayInput, execute: () => 1 });
const mixedContext = create.Function({ inputSchema: mixedInput, execute: ({ value }) => value });
void mixedContext({ value: 'object' });
// @ts-expect-error Mixed schema branches cannot enable positional scalar context.
void mixedContext('scalar');
// @ts-expect-error Mixed schema branches cannot enable array context.
void mixedContext(['array']);
const scalarFragment = create.Config({ inputSchema: scalarInput, execute: () => 1 });
const arrayFragment = create.Config({ inputSchema: arrayInput, execute: () => 1 });
// @ts-expect-error Inherited raw scalar schemas remain unsupported by ordinary Function.
create.Function({}, scalarFragment);
// @ts-expect-error Inherited raw array schemas remain unsupported by ordinary Function.
create.Function({}, arrayFragment);
const parsedScalarTool = create.Function.asTool({}, scalarFragment);
const parsedArrayTool = create.Function.asTool({}, arrayFragment);
void parsedScalarTool.execute({ value: 'parsed' }, { toolCallId: 'call', messages: [], context: undefined });
void parsedArrayTool.execute({ value: 'parsed' }, { toolCallId: 'call', messages: [], context: undefined });
// @ts-expect-error Parsed-only SDK tools still expose object input to execute.
void parsedScalarTool.execute('raw', { toolCallId: 'call', messages: [], context: undefined });

// @ts-expect-error Text function prompts dispatch an object context.
create.TextGenerator.withFunction({ model, inputSchema: scalarInput, prompt: () => 'Input.' });
// @ts-expect-error Text stream function prompts dispatch an object context.
create.TextStreamer.withFunction({ model, inputSchema: arrayInput, prompt: () => 'Input.' });
// @ts-expect-error Object function prompts dispatch an object context.
create.ObjectGenerator.withFunction({ model, schema: z.object({ answer: z.number() }), inputSchema: scalarInput, prompt: () => 'Input.' });
// @ts-expect-error Object stream function prompts dispatch an object context.
create.ObjectStreamer.withFunction({ model, schema: z.object({ answer: z.number() }), inputSchema: arrayInput, prompt: () => 'Input.' });
const scalarPromptFragment = create.Config({ model, inputSchema: scalarInput });
// @ts-expect-error Inherited function-prompt input schemas must accept raw objects too.
create.TextGenerator.withFunction({ prompt: () => 'Input.' }, scalarPromptFragment);
// @ts-expect-error Function-prompt tool wrappers also retain an ordinary context caller.
create.TextGenerator.withFunction.asTool({ model, inputSchema: scalarInput, prompt: () => 'Input.' });
// @ts-expect-error Object function-prompt tool wrappers retain an ordinary context caller.
create.ObjectGenerator.withFunction.asTool({ model, schema: z.object({ answer: z.number() }), inputSchema: arrayInput, prompt: () => 'Input.' });

const unknownInput = z.preprocess(value => value, z.object({ value: z.string() }));
const preprocessed = create.Function({ inputSchema: unknownInput, context: { prefix: 'value=' }, execute: ({ value, prefix }) => {
	expectEqual<typeof value, unknown>();
	expectEqual<typeof prefix, string>();
	return prefix + String(value);
} });
void preprocessed({ value: 'input' });
// @ts-expect-error Unknown preprocess input still uses an object context at the component boundary.
void preprocessed('input');
// @ts-expect-error Arrays are not component object contexts.
void preprocessed(['input']);
// @ts-expect-error Numeric preprocess input is not a component object context.
void preprocessed(123);
const preprocessedPrompt = create.TextGenerator.withFunction({ model, inputSchema: unknownInput, context: { prefix: 'value=' }, prompt: ({ value, prefix }) => {
	expectEqual<typeof value, unknown>();
	expectEqual<typeof prefix, string>();
	return prefix + String(value);
} });
void preprocessedPrompt({ value: 'input' });
// @ts-expect-error Unknown preprocess input does not enable positional string function-prompt contexts.
void preprocessedPrompt('input');
// @ts-expect-error Unknown preprocess input does not enable array function-prompt contexts.
void preprocessedPrompt(['input']);

// Output schemas continue accepting their raw input, including unknown coercion inputs.
const _coercedOutput = create.Function({ schema: z.coerce.string(), execute: () => 123 });
expectEqual<ReturnType<typeof _coercedOutput>, Promise<string>>();
const numericFragment = create.Config({ schema: z.number(), execute: () => 1 });
create.Function({}, numericFragment);
// @ts-expect-error Zero-argument fragment implementations must return the output schema's raw input.
create.Config({ schema: z.number(), execute: () => 'wrong' });
// @ts-expect-error Async zero-argument fragment implementations retain output checking.
create.Config({ schema: z.number(), execute: async () => 'wrong' });
// @ts-expect-error Inherited zero-argument fragment implementations must match replacement outputs.
create.Config({ schema: z.string() }, numericFragment);
const rawOutputFragment = create.Config({ schema: z.string().transform(Number), execute: () => '123' });
const _fragmentFunction = create.Function({}, rawOutputFragment);
expectEqual<ReturnType<typeof _fragmentFunction>, Promise<number>>();
// @ts-expect-error A transformed output schema requires its raw input from fragment implementations.
create.Config({ schema: z.string().transform(Number), execute: () => 123 });

const noInputFunction = create.Function({ execute:()=>1 });
// @ts-expect-error Schema-free Function calls still require object context values.
void noInputFunction([1]);
// @ts-expect-error Functions cannot serve as ordinary Function context objects.
void noInputFunction(()=>1);
const intersectionInput = z.intersection(z.object({ left:z.string() }), z.object({ right:z.number() }));
const intersectionFunction = create.Function({ inputSchema:intersectionInput, execute:({ left, right })=>left + String(right) });
void intersectionFunction({ left:'L', right:1 });
// @ts-expect-error Intersections require both sides of their input shape.
void intersectionFunction({ left:'L' });
// @ts-expect-error Intersection fields retain their component schema types.
void intersectionFunction({ left:'L', right:'wrong' });
interface TreeInput {value:string;children?:TreeInput[]|undefined}
const treeInput: z.ZodType<TreeInput, TreeInput> = z.lazy(()=>z.object({ value:z.string(), children:z.array(treeInput).optional() }));
const treeFunction = create.Function({ inputSchema:treeInput, execute:input=>{expectEqual<typeof input, TreeInput>();return input.value;} });
void treeFunction({ value:'root', children:[{ value:'child' }] });
// @ts-expect-error Recursive input schemas retain nested field types.
void treeFunction({ value:'root', children:[{ value:123 }] });
const defaultInput = z.object({ value:z.number().default(1) });
const defaultFunction = create.Function({ inputSchema:defaultInput, execute:({ value })=>{expectEqual<typeof value, number|undefined>();return value ?? 0;} });
void defaultFunction();
void defaultFunction({});
// @ts-expect-error Defaulted raw fields may be omitted but present values stay numeric.
void defaultFunction({ value:'wrong' });
