import { Output } from 'ai';
// With exactOptionalPropertyTypes, an optional property is either absent or holds its declared type.
// A child whose optional execute cannot hold undefined always keeps an implementation.
import { create, z } from 'casai';
import { expectEqual } from './assert.js';

const inputSchema = z.object({ value: z.number() });
const parent = create.Function.asTool({ inputSchema, execute: ({ value }) => value });
const double = ({ value }: { value: number }) => value * 2;
declare const replace: boolean;

const override = replace ? { execute: double } : {};
create.Function.asTool({ ...override }, parent);

declare const partial: { execute?: typeof double };
create.Function.asTool(partial, parent);

// @ts-expect-error An explicit undefined removes the inherited execute.
create.Function.asTool({ execute: undefined }, parent);

declare const maybe: { execute?: typeof double | undefined };
// @ts-expect-error This optional property is declared to hold undefined.
create.Function.asTool(maybe, parent);

// LLMAgent run ignores explicit undefined settings, including callbacks and approval policy.
declare const model: import('ai').LanguageModel;
const objects = create.LLMAgent.asStream({ model, prompt: 'Answer.', output: Output.object({ schema: z.object({ answer: z.number() }) }) });
void objects.run({ onEnd: undefined });
const texts = create.LLMAgent.asStream({ model, prompt: 'Answer.' });
void texts.run({ toolApproval: undefined });

// Omission inherits a schema; a property that can hold undefined can remove it.
const numberSchema = z.string().transform(Number);
const _flagSchema = z.string().transform(value => value === 'yes');
const parsedParent = create.Config({ schema: numberSchema });
declare const optionalReplacement: { schema?: typeof _flagSchema };
const _alwaysParsed = create.Function({ ...optionalReplacement, execute: () => '2' }, parsedParent);
expectEqual<Awaited<ReturnType<typeof _alwaysParsed>>, number | boolean>();
declare const removableReplacement: { schema?: typeof _flagSchema | undefined };
const _maybeParsed = create.Function({ ...removableReplacement, execute: () => '2' }, parsedParent);
expectEqual<Awaited<ReturnType<typeof _maybeParsed>>, string | number | boolean>();
