// Compare complete native surfaces, not just selected callback or result fields.
import type {
	GenerateObjectObjectConfig, GenerateObjectArrayConfig, GenerateObjectEnumConfig, GenerateObjectNoSchemaConfig,
	StreamObjectObjectConfig, StreamObjectArrayConfig, StreamObjectNoSchemaConfig,
	GenerateObjectObjectResult, GenerateObjectArrayResult, GenerateObjectEnumResult, GenerateObjectNoSchemaResult,
	StreamObjectObjectResult, StreamObjectArrayResult, StreamObjectNoSchemaResult,
	SchemaType, ComponentTool, ComponentExecutionOptions,
} from 'casai';
import type { generateObject, streamObject, FlexibleSchema, JSONValue, ToolExecuteFunction, ToolExecutionOptions } from 'ai';
import { expectEqual, expectType } from './assert.js';

interface Answer { answer: number }
type GeneratedObject = Parameters<typeof generateObject<SchemaType<Answer>, 'object', Answer>>[0];
type GeneratedArray = Parameters<typeof generateObject<SchemaType<Answer>, 'array', Answer[]>>[0];
type GeneratedEnum = Parameters<typeof generateObject<SchemaType<'yes' | 'no'>, 'enum', 'yes' | 'no'>>[0];
type GeneratedJSON = Parameters<typeof generateObject<SchemaType<JSONValue>, 'no-schema', JSONValue>>[0];
type StreamedObject = Parameters<typeof streamObject<SchemaType<Answer>, 'object', Answer>>[0];
type StreamedArray = Parameters<typeof streamObject<SchemaType<Answer>, 'array', Answer[]>>[0];
type StreamedJSON = Parameters<typeof streamObject<SchemaType<JSONValue>, 'no-schema', JSONValue>>[0];

// These keys deliberately belong to Casai's authoring/invocation contract.
type NativeSettings<T> = Omit<T, 'prompt' | 'messages' | 'abortSignal' | 'debug' | 'description' | 'inputSchema' | 'output' | 'enum'>;
expectEqual<NativeSettings<GenerateObjectObjectConfig<never, Answer>>, NativeSettings<GeneratedObject>>();
expectEqual<NativeSettings<GenerateObjectArrayConfig<never, Answer>>, NativeSettings<GeneratedArray>>();
expectEqual<NativeSettings<GenerateObjectEnumConfig<never, 'yes' | 'no'>>, NativeSettings<GeneratedEnum>>();
expectEqual<NativeSettings<GenerateObjectNoSchemaConfig<never>>, NativeSettings<GeneratedJSON>>();
expectEqual<NativeSettings<StreamObjectObjectConfig<never, Answer>>, NativeSettings<StreamedObject>>();
expectEqual<NativeSettings<StreamObjectArrayConfig<never, Answer>>, NativeSettings<StreamedArray>>();
expectEqual<NativeSettings<StreamObjectNoSchemaConfig<never>>, NativeSettings<StreamedJSON>>();
expectEqual<GenerateObjectEnumConfig<never, 'yes' | 'no'>['enum'], Readonly<GeneratedEnum['enum']>>();
expectEqual<GenerateObjectArrayConfig<never, Answer>['output'], NonNullable<GeneratedArray['output']>>();
expectEqual<StreamObjectObjectConfig<never, Answer>['output'], StreamedObject['output']>();

expectEqual<Omit<GenerateObjectObjectResult<Answer>, 'value'>, Awaited<ReturnType<typeof generateObject<FlexibleSchema<Answer>, 'object'>>>>();
expectEqual<Omit<GenerateObjectArrayResult<Answer>, 'value'>, Awaited<ReturnType<typeof generateObject<FlexibleSchema<Answer>, 'array'>>>>();
expectEqual<Omit<GenerateObjectEnumResult<'yes' | 'no'>, 'value'>, Awaited<ReturnType<typeof generateObject<FlexibleSchema<'yes' | 'no'>, 'enum'>>>>();
expectEqual<Omit<GenerateObjectNoSchemaResult, 'value'>, Awaited<ReturnType<typeof generateObject<FlexibleSchema<JSONValue>, 'no-schema'>>>>();
expectEqual<Omit<StreamObjectObjectResult<Answer>, 'value'>, ReturnType<typeof streamObject<FlexibleSchema<Answer>, 'object'>>>();
expectEqual<Omit<StreamObjectArrayResult<Answer>, 'value'>, ReturnType<typeof streamObject<FlexibleSchema<Answer>, 'array'>>>();
expectEqual<Omit<StreamObjectNoSchemaResult, 'value'>, ReturnType<typeof streamObject<FlexibleSchema<JSONValue>, 'no-schema'>>>();

interface Context { tenant: string }
expectEqual<Parameters<ComponentTool<Answer, number, Context>['execute']>, Parameters<ToolExecuteFunction<Answer, number, Context>>>();
// A component whose implementation always throws still has a usable native entry point.
expectEqual<Parameters<ComponentTool<Answer, never, Context>['execute']>, Parameters<ToolExecuteFunction<Answer, never, Context>>>();
expectEqual<ComponentExecutionOptions, Omit<ToolExecutionOptions<unknown>, 'context' | 'toolCallId' | 'messages'> & Partial<Pick<ToolExecutionOptions<unknown>, 'toolCallId' | 'messages'>>>();
declare const options: ComponentExecutionOptions;
expectType<ToolExecutionOptions<unknown>['experimental_sandbox']>(options.experimental_sandbox);
