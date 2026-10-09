// Compile-only object factory contracts: output modes determine requirements and result types.
import { create, z } from 'casai';
import type { GenerateObjectObjectConfig, StreamObjectArrayConfig, StreamObjectNoSchemaConfig } from 'casai';
import { jsonSchema } from 'ai';
import type { JSONValue, LanguageModel } from 'ai';

import { expectType, expectEqual } from './assert.js';
declare const model: LanguageModel;

const schema = z.object({ answer: z.number(), label: z.string() });
const changedSchema = z.object({ accepted: z.boolean() });
const modelOnly = create.Config({ model });
const schemaOnly = create.Config({ schema });
const complete = create.Config({ model, schema });

const annotatedObject: GenerateObjectObjectConfig<never, { answer: number, label: string }> = { model, schema };
create.ObjectGenerator(annotatedObject);
const annotatedArray: StreamObjectArrayConfig<never, { answer: number, label: string }> = { model, schema, output: 'array' };
create.ObjectStreamer(annotatedArray);
const annotatedNoSchema: StreamObjectNoSchemaConfig<never> = { model, output: 'no-schema' };
create.ObjectStreamer(annotatedNoSchema);
create.ObjectStreamer({}, create.Config(annotatedArray));

// Default object mode and explicit object mode accept Zod and AI SDK schemas.
const object = create.ObjectGenerator({ model, schema, prompt: 'Answer.' });
const objectStream = create.ObjectStreamer({ model, schema, output: 'object', prompt: 'Answer.' });
expectType<Promise<{ answer: number, label: string }>>(object('Answer.').then(result => result.object));
expectType<PromiseLike<{ answer: number, label: string }>>(objectStream('Answer.').object);
expectEqual<Awaited<ReturnType<typeof object>>['object'], { answer: number, label: string }>();
expectEqual<Awaited<ReturnType<typeof objectStream>['object']>, { answer: number, label: string }>();
// @ts-expect-error Object fields retain their schema types.
expectType<Promise<{ answer: string, label: string }>>(object('Answer.').then(result => result.object));
// @ts-expect-error Object stream fields retain their schema types.
expectType<PromiseLike<{ answer: number, label: number }>>(objectStream('Answer.').object);

const sdkSchema = jsonSchema<{ value: string }>({ type: 'object', properties: { value: { type: 'string' } }, required: ['value'] });
const sdkObject = create.ObjectGenerator({ model, schema: sdkSchema });
expectType<Promise<{ value: string }>>(sdkObject('Answer.').then(result => result.object));
// @ts-expect-error AI SDK schemas also preserve output field types.
expectType<Promise<{ value: number }>>(sdkObject('Answer.').then(result => result.object));

const transformedSchema = z.object({ answer: z.string().transform(value => value.length), missing: z.number().optional(), nullable: z.string().nullable() });
const transformed = create.ObjectGenerator({ model, schema: transformedSchema });
expectEqual<Awaited<ReturnType<typeof transformed>>['object'], { answer: number, missing?: number | undefined, nullable: string | null }>();
// @ts-expect-error Schema transforms determine output types rather than their input types.
expectType<Promise<{ answer: string }>>(transformed('Answer.').then(result => result.object));

const _scalar = create.ObjectGenerator({ model, schema: z.number() });
expectEqual<Awaited<ReturnType<typeof _scalar>>['object'], number>();
const _nestedArray = create.ObjectGenerator({ model, schema: z.array(z.boolean()), output: 'array' });
expectEqual<Awaited<ReturnType<typeof _nestedArray>>['object'], boolean[][]>();

create.ObjectGenerator({ schema }, modelOnly);
create.ObjectStreamer({ model }, schemaOnly);
const _inheritedObject = create.ObjectGenerator({}, complete);
const _inheritedObjectStream = create.ObjectStreamer({}, complete);
expectEqual<Awaited<ReturnType<typeof _inheritedObject>>['object'], { answer: number, label: string }>();
expectEqual<Awaited<ReturnType<typeof _inheritedObjectStream>['object']>, { answer: number, label: string }>();
create.ObjectGenerator({ output: undefined }, complete);
// @ts-expect-error Default object output requires a schema.
create.ObjectGenerator({ model });
// @ts-expect-error Default object streaming requires a schema.
create.ObjectStreamer({ model });
// @ts-expect-error Explicit object output requires a schema too.
create.ObjectGenerator({ model, output: 'object' });
// @ts-expect-error Explicit object streaming requires a schema too.
create.ObjectStreamer({ model, output: 'object' });
// @ts-expect-error A schema-only fragment cannot supply the required model.
create.ObjectGenerator({}, schemaOnly);
// @ts-expect-error A model-only fragment cannot supply the required schema.
create.ObjectStreamer({}, modelOnly);
// @ts-expect-error Explicit undefined clears an inherited required schema.
create.ObjectGenerator({ schema: undefined }, complete);
// @ts-expect-error Explicit null does not satisfy a required schema.
create.ObjectStreamer({ schema: null }, complete);
// @ts-expect-error Explicit undefined clears an inherited required model.
create.ObjectStreamer({ model: undefined }, complete);
// @ts-expect-error Explicit null cannot satisfy a required model.
create.ObjectGenerator({ model: null }, complete);
declare const uncertainSchemaParent: { readonly config: { model: LanguageModel, schema: typeof schema | undefined } };
// @ts-expect-error A required inherited schema must be present for every possible value.
create.ObjectGenerator({}, uncertainSchemaParent);

const replaced = create.ObjectGenerator({ schema: changedSchema }, complete);
expectType<Promise<{ accepted: boolean }>>(replaced('Answer.').then(result => result.object));
expectEqual<Awaited<ReturnType<typeof replaced>>['object'], { accepted: boolean }>();
// @ts-expect-error Replacing a schema replaces the result contract.
expectType<Promise<{ answer: number, label: string }>>(replaced('Answer.').then(result => result.object));

// Array mode schemas describe each element rather than the array wrapper.
const array = create.ObjectGenerator({ model, schema, output: 'array', prompt: 'Answer.' });
const arrayStream = create.ObjectStreamer({ model, schema, output: 'array' });
expectType<Promise<{ answer: number, label: string }[]>>(array('Answer.').then(result => result.object));
expectType<PromiseLike<{ answer: number, label: string }[]>>(arrayStream('Answer.').object);
expectType<AsyncIterable<{ answer: number, label: string }>>(arrayStream('Answer.').elementStream);
expectEqual<Awaited<ReturnType<typeof array>>['object'], { answer: number, label: string }[]>();
// @ts-expect-error Array output cannot be used as a single object.
expectType<Promise<{ answer: number, label: string }>>(array('Answer.').then(result => result.object));
// @ts-expect-error Array element streams preserve schema field types.
expectType<AsyncIterable<{ answer: string, label: string }>>(arrayStream('Answer.').elementStream);
const arraySettings = create.Config({ output: 'array' });
const _inheritedArray = create.ObjectGenerator({ model, schema }, arraySettings);
const _inheritedArrayStream = create.ObjectStreamer({ model, schema }, arraySettings);
expectEqual<Awaited<ReturnType<typeof _inheritedArray>>['object'], { answer: number, label: string }[]>();
expectEqual<Awaited<ReturnType<typeof _inheritedArrayStream>['object']>, { answer: number, label: string }[]>();
create.ObjectGenerator({ output: 'array' }, complete);
create.ObjectStreamer({ output: 'array' }, complete);
// @ts-expect-error Array output requires an element schema.
create.ObjectGenerator({ model, output: 'array' });
// @ts-expect-error Array streaming requires an element schema.
create.ObjectStreamer({ model, output: 'array' });
// @ts-expect-error Inherited array mode still requires a schema.
create.ObjectGenerator({ model }, arraySettings);
// @ts-expect-error A child cannot clear the inherited array element schema.
create.ObjectStreamer({ schema: undefined, output: 'array' }, complete);

// Enum mode preserves literal alternatives and is available only for generators.
const choices = ['YES', 'NO'] as const;
const enumObject = create.ObjectGenerator({ model, output: 'enum', enum: choices, prompt: 'Answer.' });
expectType<Promise<'YES' | 'NO'>>(enumObject('Answer.').then(result => result.object));
expectEqual<Awaited<ReturnType<typeof enumObject>>['object'], 'YES' | 'NO'>();
// @ts-expect-error Enum results cannot contain an undeclared alternative.
expectType<Promise<'MAYBE'>>(enumObject('Answer.').then(result => result.object));
const enumSettings = create.Config({ output: 'enum' });
create.ObjectGenerator({ model, enum: choices }, enumSettings);
const enumParent = create.Config({ model, output: 'enum', enum: choices });
const _inheritedEnum = create.ObjectGenerator({}, enumParent);
expectEqual<Awaited<ReturnType<typeof _inheritedEnum>>['object'], 'YES' | 'NO'>();
const replacedEnum = create.ObjectGenerator({ enum: ['LATER'] as const }, enumParent);
expectType<Promise<'LATER'>>(replacedEnum('Answer.').then(result => result.object));
// @ts-expect-error An enum override replaces the old literal union.
expectType<Promise<'YES' | 'NO'>>(replacedEnum('Answer.').then(result => result.object));
// @ts-expect-error Enum mode requires declared alternatives.
create.ObjectGenerator({ model, output: 'enum' });
// @ts-expect-error Inherited enum mode still requires alternatives.
create.ObjectGenerator({ model }, enumSettings);
// @ts-expect-error Explicit undefined clears required inherited alternatives.
create.ObjectGenerator({ enum: undefined }, enumParent);
// @ts-expect-error Enum alternatives must be strings.
create.ObjectGenerator({ model, output: 'enum', enum: ['YES', 42] });
// @ts-expect-error Enum alternatives must be an array.
create.ObjectGenerator({ model, output: 'enum', enum: 'YES' });
// @ts-expect-error Enum mode does not accept an object schema.
create.ObjectGenerator({ model, output: 'enum', enum: choices, schema });
// @ts-expect-error Streamers do not support enum output.
create.ObjectStreamer({ model, output: 'enum', enum: choices });
// @ts-expect-error Enum output inherited from a fragment is also unavailable to streamers.
create.ObjectStreamer({}, enumParent);

// Schemaless results remain JSONValue and accept only JSON generation mode.
const schemaless = create.ObjectGenerator({ model, output: 'no-schema', mode: 'json', prompt: 'Answer.' });
const schemalessStream = create.ObjectStreamer({ model, output: 'no-schema' });
expectType<Promise<JSONValue>>(schemaless('Answer.').then(result => result.object));
expectEqual<Awaited<ReturnType<typeof schemaless>>['object'], JSONValue>();
expectType<PromiseLike<JSONValue>>(schemalessStream('Answer.').object);
// @ts-expect-error A schemaless result cannot guarantee an object shape.
expectType<Promise<{ answer: number }>>(schemaless('Answer.').then(result => result.object));
// @ts-expect-error A schemaless stream cannot guarantee a string result.
expectType<PromiseLike<string>>(schemalessStream('Answer.').object);
const noSchemaSettings = create.Config({ output: 'no-schema' });
create.ObjectGenerator({ model }, noSchemaSettings);
create.ObjectStreamer({ model }, noSchemaSettings);
// @ts-expect-error Schemaless generation still requires a model.
create.ObjectGenerator({ output: 'no-schema' });
// @ts-expect-error Schemaless streaming still requires a model.
create.ObjectStreamer({ output: 'no-schema' });
// @ts-expect-error Schemaless mode does not accept a schema.
create.ObjectGenerator({ model, output: 'no-schema', schema });
// @ts-expect-error Schemaless streaming does not accept a schema.
create.ObjectStreamer({ model, output: 'no-schema', schema });
// @ts-expect-error Schemaless mode does not accept enum choices.
create.ObjectGenerator({ model, output: 'no-schema', enum: choices });
// @ts-expect-error Schemaless generation cannot use tool mode.
create.ObjectGenerator({ model, output: 'no-schema', mode: 'tool' });
// @ts-expect-error Schemaless streaming cannot use auto mode.
create.ObjectStreamer({ model, output: 'no-schema', mode: 'auto' });

// Modes and inherited keys must remain compatible with the final output mode.
create.ObjectGenerator({ model, schema, mode: 'auto' });
create.ObjectGenerator({ model, schema, mode: 'json' });
create.ObjectGenerator({ model, schema, mode: 'tool' });
create.ObjectGenerator({ model, schema, schemaName: 'Answer', schemaDescription: 'A generated answer' });
create.ObjectStreamer({ model, schema, mode: 'auto' });
create.ObjectStreamer({ model, schema, mode: 'json' });
create.ObjectStreamer({ model, schema, mode: 'tool' });
const inheritedToolMode = create.Config({ model, mode: 'tool', prompt: 'Answer.' });
const inheritedAutoMode = create.Config({ model, mode: 'auto', prompt: 'Answer.' });
const replacedGeneratorMode = create.ObjectGenerator({ output: 'no-schema', mode: 'json' }, inheritedToolMode);
const replacedStreamerMode = create.ObjectStreamer({ output: 'no-schema', mode: 'json' }, inheritedAutoMode);
void replacedGeneratorMode.run({ mode: 'json' });
void replacedStreamerMode.run({ mode: 'json' });
// @ts-expect-error A run preserves schemaless mode after replacing an inherited tool mode.
void replacedGeneratorMode.run({ mode: 'tool' });
// @ts-expect-error A run preserves schemaless mode after replacing an inherited auto mode.
void replacedStreamerMode.run({ mode: 'auto' });
// @ts-expect-error Inherited tool mode is incompatible with the final schemaless output.
create.ObjectGenerator({ output: 'no-schema' }, inheritedToolMode);
// @ts-expect-error Inherited auto mode is incompatible with the final schemaless output.
create.ObjectStreamer({ output: 'no-schema' }, inheritedAutoMode);
const _changedToArray = create.ObjectGenerator({ output: 'array' }, complete);
const _changedToObject = create.ObjectStreamer({ output: 'object' }, create.Config({ model, schema, output: 'array' }));
expectEqual<Awaited<ReturnType<typeof _changedToArray>>['object'], { answer: number, label: string }[]>();
expectEqual<Awaited<ReturnType<typeof _changedToObject>['object']>, { answer: number, label: string }>();
// @ts-expect-error Only supported object output literals are accepted.
create.ObjectGenerator({ model, schema, output: 'invalid' });
// @ts-expect-error Only supported object generation mode literals are accepted.
create.ObjectStreamer({ model, schema, mode: 'invalid' });
// @ts-expect-error Enum output does not accept schema metadata.
create.ObjectGenerator({ model, output: 'enum', enum: choices, schemaName: 'Answer' });
// @ts-expect-error Schemaless output does not accept schema metadata.
create.ObjectStreamer({ model, output: 'no-schema', schemaDescription: 'An answer' });
// @ts-expect-error Object output cannot have enum choices.
create.ObjectGenerator({ model, schema, enum: choices });
// @ts-expect-error Array output cannot have enum choices.
create.ObjectStreamer({ model, schema, output: 'array', enum: choices });
// @ts-expect-error A parent schema remains incompatible after switching to enum output.
create.ObjectGenerator({ output: 'enum', enum: choices }, complete);
// @ts-expect-error A parent schema remains incompatible after switching to schemaless output.
create.ObjectStreamer({ output: 'no-schema' }, complete);
// @ts-expect-error A parent's enum choices remain incompatible after switching to object output.
create.ObjectGenerator({ output: 'object', schema }, enumParent);
// @ts-expect-error Object factories do not accept text-generation tools.
create.ObjectGenerator({ model, schema, tools: {} });
// @ts-expect-error Object streamers do not accept text-generation tool contexts.
create.ObjectStreamer({ model, schema, toolsContext: {} });
// @ts-expect-error Object factories do not accept standalone renderer template settings.
create.ObjectGenerator({ model, schema, template: 'Hello' });
// @ts-expect-error Object streamers do not accept standalone renderer script settings.
create.ObjectStreamer({ model, schema, script: 'return "Hello"' });
// @ts-expect-error Unknown object factory settings are rejected.
create.ObjectGenerator({ model, schema, unknownSetting: true });
create.ObjectStreamer({ model, schema, onError: () => undefined });
// @ts-expect-error SDK streaming callbacks are not generator settings.
create.ObjectGenerator({ model, schema, onError: () => undefined });
const unknownSettings = { unknownSetting: true };
// @ts-expect-error Existing variables cannot conceal unknown generator options.
create.ObjectGenerator({ model, schema, ...unknownSettings });
const invalidObjectConfig = { model, schema, tools: {} };
// @ts-expect-error Generic inference must reject forbidden keys on a bound config too.
create.ObjectGenerator(invalidObjectConfig);

// A run may override generation settings without changing the component's result contract.
void object.run({});
void object.run({ model, prompt: 'Changed', maxOutputTokens: 10 });
void objectStream.run({ model, messages: [{ role: 'user', content: 'Changed' }] });
void array.run({ mode: 'json' });
void schemaless.run({ mode: 'json' });
// @ts-expect-error A run cannot replace its schema.
void object.run({ schema: changedSchema });
// @ts-expect-error A run cannot change its output mode.
void objectStream.run({ output: 'array' });
// @ts-expect-error A run cannot replace enum alternatives.
void enumObject.run({ enum: ['MAYBE'] });
// @ts-expect-error A run cannot introduce an input schema.
void array.run({ inputSchema: z.object({ name: z.string() }) });
// @ts-expect-error A run cannot introduce a loader.
void objectStream.run({ loader: { load: (name: string) => name } });
// @ts-expect-error A run cannot introduce unknown settings.
void schemaless.run({ unknownSetting: true });
// @ts-expect-error Schemaless run overrides must retain JSON mode.
void schemaless.run({ mode: 'tool' });
// @ts-expect-error Object run settings retain numeric value types.
void object.run({ maxOutputTokens: '10' });

// Inherited modes also determine allowed run settings when an empty child supplies no inference candidates.
const inheritedNoSchemaParent = create.Config({ model, output: 'no-schema', prompt: 'Answer.' });
const inheritedNoSchemaGenerator = create.ObjectGenerator({}, inheritedNoSchemaParent);
const inheritedNoSchemaStreamer = create.ObjectStreamer({}, inheritedNoSchemaParent);
expectEqual<Parameters<typeof inheritedNoSchemaGenerator.run>[0]['mode'], 'json' | undefined>();
expectEqual<Parameters<typeof inheritedNoSchemaStreamer.run>[0]['mode'], 'json' | undefined>();
expectEqual<'schemaName' extends keyof Parameters<typeof inheritedNoSchemaGenerator.run>[0] ? true : false, false>();
void inheritedNoSchemaGenerator.run({ mode: 'json' });
void inheritedNoSchemaStreamer.run({ mode: 'json' });
// @ts-expect-error An inherited schemaless generator still accepts only JSON mode.
void inheritedNoSchemaGenerator.run({ mode: 'tool' });
// @ts-expect-error An inherited schemaless streamer still accepts only JSON mode.
void inheritedNoSchemaStreamer.run({ mode: 'auto' });
// @ts-expect-error An inherited schemaless generator does not acquire object schema metadata.
void inheritedNoSchemaGenerator.run({ schemaName: 'Answer' });
// @ts-expect-error An inherited schemaless streamer does not acquire object schema metadata.
void inheritedNoSchemaStreamer.run({ schemaDescription: 'Answer' });

const inheritedArrayParent = create.Config({ model, schema, output: 'array', prompt: 'Answer.' });
const inheritedArrayGenerator = create.ObjectGenerator({}, inheritedArrayParent);
const inheritedArrayStreamer = create.ObjectStreamer({}, inheritedArrayParent);
expectEqual<Parameters<typeof inheritedArrayGenerator.run>[0]['mode'], 'auto' | 'json' | 'tool' | undefined>();
expectEqual<'schemaName' extends keyof Parameters<typeof inheritedArrayGenerator.run>[0] ? true : false, true>();
void inheritedArrayGenerator.run({ mode: 'tool', schemaName: 'Answers' });
void inheritedArrayStreamer.run({ mode: 'auto', schemaDescription: 'Generated answers' });
// @ts-expect-error Inherited array generators retain the SDK's generation mode literals.
void inheritedArrayGenerator.run({ mode: 'invalid' });
// @ts-expect-error Inherited array streamers retain the SDK's generation mode literals.
void inheritedArrayStreamer.run({ mode: 'invalid' });

const inheritedEnumGenerator = create.ObjectGenerator({}, create.Config({ model, output: 'enum', enum: choices, prompt: 'Answer.' }));
expectEqual<'schemaName' extends keyof Parameters<typeof inheritedEnumGenerator.run>[0] ? true : false, false>();
void inheritedEnumGenerator.run({ mode: 'tool' });
// @ts-expect-error An inherited enum generator does not acquire object schema metadata.
void inheritedEnumGenerator.run({ schemaName: 'Answer' });

const inheritedRenderedNoSchema = create.ObjectStreamer.withTemplate({}, create.Config({ model, output: 'no-schema', prompt: '{{ name }}', inputSchema: z.object({ name: z.string() }) }));
void inheritedRenderedNoSchema.run({ context: { name: 'Ada' }, mode: 'json' });
// @ts-expect-error Rendered inherited schemaless streams keep their output mode restriction too.
void inheritedRenderedNoSchema.run({ context: { name: 'Ada' }, mode: 'tool' });
