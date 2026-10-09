import {
	create, Config, Function as FunctionFactory, Template, Script,
	TextGenerator, TextStreamer, ObjectGenerator, ObjectStreamer,
	FileSystemLoader, PrecompiledLoader, WebLoader, NotFoundError, race,
	ModelMessageSchema, PromptStringOrMessagesSchema, ConfigError, TemplateError, ScriptError, z,
} from 'casai';
import type { ConfigProvider, ModelMessage, ToolSet, RaceGroup, RaceLoader, SchemaType, Context, ScriptResult, TemplatePromptType, ScriptPromptType, FunctionPromptType, ContextSchemaConfig, ToolConfig, StreamObjectOnFinishEvent, StreamTextOnFinishEvent } from 'casai';
import type { ModelMessage as SDKModelMessage, ToolSet as SDKToolSet, JSONValue, Tool, GenerateObjectEndEvent, StreamTextOnEndCallback } from 'ai';
import { jsonSchema } from 'ai';
import type { ILoaderAny, LoaderInterface } from 'cascada-engine';
import { expectEqual, expectType } from './assert.js';

// Both public entry points expose the same overloads rather than widened wrappers.
// New factories or modifiers require a corresponding coverage review.
expectEqual<keyof typeof create, 'Config' | 'Function' | 'Template' | 'Script' | 'TextGenerator' | 'TextStreamer' | 'ObjectGenerator' | 'ObjectStreamer'>();
expectEqual<keyof typeof import('casai'),
	| keyof typeof create | 'create' | 'FileSystemLoader' | 'PrecompiledLoader' | 'WebLoader' | 'NotFoundError'
	| 'race' | 'ModelMessageSchema' | 'PromptStringOrMessagesSchema' | 'ConfigError' | 'TemplateError' | 'ScriptError' | 'z'
>();
type PromptModifiers = 'withText' | 'withTemplate' | 'withScript' | 'withFunction' | 'loadsText' | 'loadsTemplate' | 'loadsScript';
expectEqual<keyof typeof TextGenerator, PromptModifiers | 'asTool'>();
expectEqual<keyof typeof ObjectGenerator, PromptModifiers | 'asTool'>();
expectEqual<keyof typeof TextStreamer, PromptModifiers>();
expectEqual<keyof typeof ObjectStreamer, PromptModifiers>();
expectEqual<keyof typeof Template, 'loadsTemplate' | 'asTool'>();
expectEqual<keyof typeof Script, 'loadsScript' | 'asTool' | 'loadsScriptAsTool'>();
expectEqual<typeof Script.loadsScriptAsTool, typeof Script.loadsScript.asTool>();
expectEqual<keyof typeof FunctionFactory, 'asTool'>();
expectEqual<keyof typeof Config, never>();
type GeneratorToolModifiers<T> = { [K in keyof T & PromptModifiers]: keyof T[K] }[keyof T & PromptModifiers];
expectEqual<GeneratorToolModifiers<typeof TextGenerator>, 'asTool'>();
expectEqual<GeneratorToolModifiers<typeof ObjectGenerator>, 'asTool'>();
expectEqual<typeof create.Config, typeof Config>();
expectEqual<typeof create.Function, typeof FunctionFactory>();
expectEqual<typeof create.Template, typeof Template>();
expectEqual<typeof create.Script, typeof Script>();
expectEqual<typeof create.TextGenerator, typeof TextGenerator>();
expectEqual<typeof create.TextStreamer, typeof TextStreamer>();
expectEqual<typeof create.ObjectGenerator, typeof ObjectGenerator>();
expectEqual<typeof create.ObjectStreamer, typeof ObjectStreamer>();
expectEqual<ModelMessage, SDKModelMessage>();
expectEqual<ToolSet, SDKToolSet>();
expectEqual<Context, Record<string, any>>();
expectEqual<ScriptResult, JSONValue>();
expectEqual<TemplatePromptType, 'async-template' | 'async-template-name'>();
expectEqual<ScriptPromptType, 'async-script' | 'async-script-name'>();
expectEqual<FunctionPromptType, 'function'>();
expectEqual<ContextSchemaConfig<{ factor: number }>, Pick<Tool<unknown, unknown, { factor: number }>, 'contextSchema'>>();
const toolConfig: ToolConfig<{ value: number }, string, { factor: number }> = {
	inputSchema: z.object({ value: z.number() }), contextSchema: z.object({ factor: z.number() }),
};
expectType<SchemaType<{ value: number }>>(toolConfig.inputSchema);
// @ts-expect-error Annotated renderer tools retain their input schema's field types.
const _wrongToolConfig: ToolConfig<{ value: number }, string> = { inputSchema: z.object({ value: z.string() }) };
const _eventSchema = z.object({ answer: z.number() });
expectEqual<StreamObjectOnFinishEvent<typeof _eventSchema>, GenerateObjectEndEvent<{ answer: number }>>();
type TextEnd = Parameters<StreamTextOnEndCallback<Record<string, never>, Record<string, unknown>, import('ai').OutputInterface<string, string, never>>>[0];
expectEqual<Omit<StreamTextOnFinishEvent, 'response'>, Omit<TextEnd, 'response'>>();
expectEqual<StreamTextOnFinishEvent['response']['messages'], ModelMessage[]>();
expectEqual<StreamTextOnFinishEvent['response']['messageHistory'], ModelMessage[]>();

declare const filesystem: InstanceType<typeof FileSystemLoader>;
declare const precompiled: InstanceType<typeof PrecompiledLoader>;
declare const web: InstanceType<typeof WebLoader>;
declare const native: LoaderInterface;
declare const merged: RaceLoader;
const sync = (name: string) => name;
const asyncLoader = async (name: string) => ({ src: name, path: name, noCache: true });
const group = race([filesystem, precompiled, web, native, sync, asyncLoader], 'sources');
expectEqual<typeof group, RaceGroup>();
expectType<ILoaderAny[]>(group.loaders);
expectType<string | null>(group.groupName);
expectType<LoaderInterface>(merged);
race(sync);
race([], 'empty');
const sourceLoader = {
	cachePolicy: 'reload' as const,
	load: async (name: string) => name === 'missing' ? null : ({ src: name, path: name, noCache: false }),
	isRelative: (name: string) => name.startsWith('.'),
	resolve: (from: string, to: string) => `${from}/${to}`,
};
race(sourceLoader);
const cachedFunction = Object.assign((name: string) => name, { cachePolicy: 'cache' as const });
race(cachedFunction);
create.Config({ loader: group });
create.Config({ loader: [filesystem, group, merged, asyncLoader] });
create.Template.loadsTemplate({ loader: sync });
create.Script.loadsScript({ loader: asyncLoader });
// @ts-expect-error Loader callbacks receive string names.
race((_name: number) => 'source');
// @ts-expect-error Loader callbacks must return source text, metadata or null.
race(() => 123);
// @ts-expect-error Loader callback promises must resolve to valid sources.
race(async () => false);
// @ts-expect-error Loader objects need a correctly typed load function.
race({ load: () => 123 });
// @ts-expect-error Loader source metadata must include its required path.
race(() => ({ src: 'source', noCache: false }));
// @ts-expect-error Loader source metadata retains its cache flag type.
race({ load: () => ({ src: 'source', path: 'source', noCache: 'false' }) });
// @ts-expect-error Loader cache policies retain their declared finite values.
race({ load: sync, cachePolicy: 'forever' });
// @ts-expect-error Relative-path callbacks return booleans.
race({ load: sync, isRelative: () => 'yes' });
// @ts-expect-error Resolution callbacks return a path string.
race({ load: sync, resolve: () => 123 });
// @ts-expect-error Native loader callback arguments remain string names.
race({ load: (_name: number) => 'source' });
// @ts-expect-error Race group names are strings.
race(sync, 123);
// @ts-expect-error Race groups are config inputs, not nested source loaders.
race([group]);
// @ts-expect-error Arbitrary scalars cannot be loader config values.
create.Config({ loader: 123 });
// @ts-expect-error Built-in loaders still require string names.
void native.load(123);

const provider: ConfigProvider<{ description: string }> = create.Config({ description: 'Shared' });
expectType<string>(provider.config.description);
// @ts-expect-error Providers expose their config through a readonly property.
provider.config = { description: 'Replaced' };
// @ts-expect-error A provider must expose the declared config shape.
const _missingProvider: ConfigProvider<{ description: string }> = { config: {} };

// Annotated schemas must retain their output type as well as raw inferred Zod schemas.
const annotated: SchemaType<{ value: number }> = z.object({ value: z.number() });
const sdk: SchemaType<{ value: number }> = jsonSchema<{ value: number }>({ type: 'object' });
const _annotatedScript = create.Script({ script: 'return {value: 1}', schema: annotated });
const _sdkScript = create.Script({ script: 'return {value: 1}', schema: sdk });
expectEqual<Awaited<ReturnType<typeof _annotatedScript>>, { value: number }>();
expectEqual<Awaited<ReturnType<typeof _sdkScript>>, { value: number }>();
// @ts-expect-error Annotated output schemas reject a different property type.
const _wrongSchema: SchemaType<{ value: number }> = z.object({ value: z.string() });

const parsed = ModelMessageSchema.parse({ role: 'user', content: 'Question' });
expectType<'system' | 'user' | 'assistant' | 'tool'>(parsed.role);
// @ts-expect-error Parsed model roles do not widen to numbers.
expectType<number>(parsed.role);
const prompt = PromptStringOrMessagesSchema.parse('Question');
if (typeof prompt === 'string') expectType<string>(prompt);
else expectType<z.infer<typeof ModelMessageSchema>[]>(prompt);

const cause = new Error('Cause');
expectType<Error>(new ConfigError('Invalid', cause));
expectType<Error | undefined>(new TemplateError('Invalid', cause).cause);
expectType<Error | undefined>(new ScriptError('Invalid', cause).cause);
expectType<Error>(new NotFoundError('Missing'));
// @ts-expect-error Wrapper error causes must be Errors.
new ConfigError('Invalid', 'cause');
// @ts-expect-error Wrapper errors require a string message.
new TemplateError(123);
