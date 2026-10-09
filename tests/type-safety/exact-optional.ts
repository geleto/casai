// With exactOptionalPropertyTypes, an optional property is either absent or holds its declared type.
// A child whose optional execute cannot hold undefined always keeps an implementation.
import { create, z } from 'casai';

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

// SDK callbacks stay optional without admitting explicitly undefined callbacks.
declare const model: import('ai').LanguageModel;
const objects = create.ObjectStreamer({ model, schema: z.object({ answer: z.number() }), prompt: 'Answer.' });
// @ts-expect-error Optional SDK callbacks cannot be explicitly undefined.
objects.run({ onFinish: undefined });
const texts = create.TextStreamer({ model, prompt: 'Answer.' });
// @ts-expect-error The outer approval setting is optional without explicitly admitting undefined.
texts.run({ toolApproval: undefined });
