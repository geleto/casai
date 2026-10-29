import {
	create, Config, Function as FunctionFactory, Template, Script,
	LLMAgent,
	FileSystemLoader, PrecompiledLoader, WebLoader, NotFoundError, raceLoaders, raceParent, overrideParent,
	ModelMessageSchema, PromptStringOrMessagesSchema, ConfigError, ValidationError, TemplateError, ScriptError, z,
} from 'casai';
import type { ConfigProvider, ModelMessage, ToolSet, LoaderGroup, LoaderInput, ParentLoader, SchemaType, Context, ScriptResult, TemplatePromptType, ScriptPromptType, FunctionPromptType, ToolContextSchemaConfig, ToolConfig, StreamTextOnFinishEvent } from 'casai';
import type { ModelMessage as SDKModelMessage, ToolSet as SDKToolSet, StreamTextOnEndCallback } from 'ai';
import { jsonSchema } from 'ai';
import type { LoaderInterface } from 'cascada-engine';
import { expectEqual, expectType } from './assert.js';

declare const caught: unknown;
if (caught instanceof ConfigError) {
	expectType<ConfigError>(caught);
	expectType<string>(caught.message);
	expectType<Error | undefined>(caught.cause);
}
if (caught instanceof ValidationError) {
	expectType<ValidationError>(caught);
	expectType<string>(caught.message);
	expectType<Error | undefined>(caught.cause);
}

// Both public entry points expose the same overloads rather than widened wrappers.
// New factories or modifiers require a corresponding coverage review.
expectEqual<keyof typeof create, 'Config' | 'Function' | 'Template' | 'Script' | 'LLMAgent'>();
expectEqual<keyof typeof import('casai'),
	| keyof typeof create | 'create' | 'FileSystemLoader' | 'PrecompiledLoader' | 'WebLoader' | 'NotFoundError'
	| 'textStreamSchema' | 'streamSchema' | 'collectStream' | 'collectTextStream' | 'toReadableStream' | 'makeSharedIterable'
	| 'raceLoaders' | 'raceParent' | 'overrideParent' | 'ModelMessageSchema' | 'PromptStringOrMessagesSchema' | 'ConfigError' | 'ValidationError' | 'TemplateError' | 'ScriptError' | 'z'
>();
type PromptModifiers = 'withText' | 'withTemplate' | 'withScript' | 'withFunction' | 'loadsText' | 'loadsTemplate' | 'loadsScript';
expectEqual<keyof typeof LLMAgent, PromptModifiers | 'asTool' | 'asStream'>();
expectEqual<keyof typeof LLMAgent.asStream, 'asTool'>();
expectEqual<keyof typeof LLMAgent.asTool, never>();
expectEqual<keyof typeof Template, 'withTemplate' | 'loadsTemplate' | 'asTool'>();
expectEqual<keyof typeof Script, 'withScript' | 'loadsScript' | 'asTool' | 'loadsScriptAsTool'>();
expectEqual<typeof Script.loadsScriptAsTool, typeof Script.loadsScript.asTool>();
expectEqual<keyof typeof FunctionFactory, 'asTool'>();
expectEqual<keyof typeof Config, never>();
type GeneratorToolModifiers<T> = { [K in keyof T & PromptModifiers]: keyof T[K] }[keyof T & PromptModifiers];
expectEqual<GeneratorToolModifiers<typeof LLMAgent>, 'asTool' | 'asStream'>();
expectEqual<typeof create.Config, typeof Config>();
expectEqual<typeof create.Function, typeof FunctionFactory>();
expectEqual<typeof create.Template, typeof Template>();
expectEqual<typeof create.Script, typeof Script>();
expectEqual<typeof create.LLMAgent, typeof LLMAgent>();
expectEqual<ModelMessage, SDKModelMessage>();
expectEqual<ToolSet, SDKToolSet>();
expectEqual<Context, Record<string, any>>();
expectEqual<ScriptResult, unknown>();
expectEqual<TemplatePromptType, 'async-template' | 'async-template-name'>();
expectEqual<ScriptPromptType, 'async-script' | 'async-script-name'>();
expectEqual<FunctionPromptType, 'function'>();
expectEqual<ToolContextSchemaConfig<{ factor: number }>, { toolContextSchema?: SchemaType<{ factor: number }> | undefined }>();
const _clearedContextSchema: ToolContextSchemaConfig = { toolContextSchema: undefined };
const toolConfig: ToolConfig<{ value: number }, string, { factor: number }> = {
	inputSchema: z.object({ value: z.number() }), toolContextSchema: z.object({ factor: z.number() }),
};
expectType<SchemaType<{ value: number }>>(toolConfig.inputSchema);
// @ts-expect-error Annotated renderer tools retain their input schema's field types.
const _wrongToolConfig: ToolConfig<{ value: number }, string> = { inputSchema: z.object({ value: z.string() }) };
type TextEnd = Parameters<StreamTextOnEndCallback<Record<string, never>, Record<string, unknown>, import('ai').OutputInterface<string, string, never>>>[0];
expectEqual<StreamTextOnFinishEvent, TextEnd>();
expectEqual<StreamTextOnFinishEvent['response']['messages'], TextEnd['response']['messages']>();


declare const filesystem: InstanceType<typeof FileSystemLoader>;
declare const precompiled: InstanceType<typeof PrecompiledLoader>;
declare const web: InstanceType<typeof WebLoader>;
declare const native: LoaderInterface;
const sync = (name: string) => name;
const asyncLoader = async (name: string) => ({ src: name, path: name, noCache: true });
const group = raceLoaders([[filesystem, precompiled], [web, native, sync, asyncLoader]]);
expectType<LoaderInterface>(group);
const directive: ParentLoader = raceParent([group, sync]);
const configured: LoaderInput = directive;
expectType<LoaderGroup>(directive.group);
create.Config({ loader: configured });
create.Config({ loader: [filesystem, [group, asyncLoader]] });
create.Config({ loader: overrideParent([]) });
// @ts-expect-error Null loader settings remain unsupported in TypeScript.
create.Config({ loader: null });
create.Template.loadsTemplate({ loader: sync });
create.Script.loadsScript({ loader: asyncLoader });
raceLoaders([]);
raceLoaders([[sync]]);
const sourceLoader = {
	cachePolicy: 'reload' as const,
	load: async (name: string) => name === 'missing' ? null : ({ src: name, path: name, noCache: false }),
	isRelative: (name: string) => name.startsWith('.'),
	resolve: (from: string, to: string) => from + '/' + to,
};
raceLoaders([sourceLoader]);
raceLoaders([Object.assign(sync, { cachePolicy: 'cache' as const })]);
// @ts-expect-error A native race takes exactly one array argument.
raceLoaders(sync);
// @ts-expect-error Named groups have been removed.
raceLoaders([sync], 'name');
// @ts-expect-error Native loader callback names are strings.
raceLoaders([(_name: number) => 'source']);
// @ts-expect-error Loader callbacks return text, source metadata or null.
raceLoaders([() => 123]);
// @ts-expect-error Loader promises resolve to valid sources.
raceLoaders([async () => false]);
// @ts-expect-error Source metadata includes the required physical path.
raceLoaders([() => ({ src: 'source', noCache: false })]);
// @ts-expect-error Cache policy is a finite native setting.
raceLoaders([{ load: sync, cachePolicy: 'forever' }]);
// @ts-expect-error Relative-path callbacks return booleans.
raceLoaders([{ load: sync, isRelative: () => 'yes' }]);
// @ts-expect-error Resolution callbacks return resource names.
raceLoaders([{ load: sync, resolve: () => 123 }]);
// @ts-expect-error Parent directives cannot be race competitors.
raceLoaders([raceParent(sync)]);
// @ts-expect-error Parent directives cannot nest inside ordered chains.
create.Config({ loader: [overrideParent(sync)] });
// @ts-expect-error Parent directives cannot wrap another directive.
overrideParent(raceParent(sync));
// @ts-expect-error Arbitrary scalars are not loader inputs.
create.Config({ loader: 123 });
// @ts-expect-error Native loader methods retain their string argument.
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

expectType<Error>(new ValidationError('Invalid', cause));
expectType<Error | undefined>(new ValidationError('Invalid', cause).cause);
// @ts-expect-error Validation error causes must be Errors.
new ValidationError('Invalid', 'cause');
