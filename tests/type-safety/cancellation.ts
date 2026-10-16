// Compile-only invocation-control fixtures.
import { create, z } from 'casai';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

declare const model: LanguageModel;
declare const abortSignal: AbortSignal;
const schema = z.object({ n: z.number() });
const configured = { model, prompt: 'test', schema, abortSignal };

// Configuration checks reject signals even when they arrive through variables or parents.
// @ts-expect-error Cancellation belongs to an invocation.
create.TextGenerator({ model, prompt: 'test', abortSignal });
// @ts-expect-error Cancellation belongs to an invocation.
create.TextStreamer({ model, prompt: 'test', abortSignal });
// @ts-expect-error A variable does not make a constructor signal valid.
create.ObjectGenerator(configured);
// @ts-expect-error A variable does not make a constructor signal valid.
create.ObjectStreamer(configured);
// @ts-expect-error Reusable fragments cannot store invocation signals.
create.Config({ abortSignal });
// @ts-expect-error Inherited signals are rejected too.
create.TextGenerator({ prompt: 'test' }, { config: { model, abortSignal } });
// @ts-expect-error Inherited signals are rejected too.
create.ObjectStreamer({ prompt: 'test', schema }, { config: { model, abortSignal } });
// @ts-expect-error Rendered factories also reject constructor signals.
create.TextGenerator.withFunction({ model, prompt: () => 'test', abortSignal });
// @ts-expect-error Loaded factories also reject constructor signals.
create.ObjectGenerator.loadsText({ model, schema, prompt: 'source', loader: { load: () => 'test' }, abortSignal });

declare const alternative: { description: string, abortSignal: AbortSignal } | { description: string, debug: boolean };
const parent = { config: { model } };
// @ts-expect-error Every possible constructor branch must be free of invocation signals.
create.TextGenerator(alternative, parent);
// @ts-expect-error Every possible constructor branch must be free of invocation signals.
create.ObjectGenerator({ ...alternative, schema }, parent);
// @ts-expect-error A Config fragment cannot hide a signal in a union branch.
create.Config(alternative);
declare const alternativeParent: { model: LanguageModel, abortSignal: AbortSignal } | { model: LanguageModel, description: string };
// @ts-expect-error Empty children cannot inherit a possible constructor signal.
create.TextStreamer({}, { config: alternativeParent });
// @ts-expect-error Empty children cannot inherit a possible constructor signal.
create.ObjectGenerator({ schema }, { config: alternativeParent });

// All invocation forms retain cancellation after removing it from factory configuration.
const text = create.TextGenerator({ model, prompt: 'test' });
void text.run({ abortSignal });
void create.TextStreamer({ model }).run({ prompt: 'test', abortSignal });
void create.ObjectGenerator({ model, schema }).run({ prompt: 'test', abortSignal });
void create.ObjectStreamer({ model, schema }).run({ prompt: 'test', abortSignal });
void create.TextGenerator.withTemplate({ model, prompt: '{{ input }}' }).run({ context: { input: 'test' }, abortSignal });
void create.TextStreamer.withScript({ model, prompt: 'return "test"' }).run({ abortSignal });
void create.ObjectGenerator.withFunction({ model, schema, prompt: () => 'test' }).run({ abortSignal });
void create.ObjectStreamer.loadsText({ model, schema, loader: { load: () => 'test' } }).run({ prompt: 'source', abortSignal });
// @ts-expect-error Invocation signals retain their native type.
void text.run({ abortSignal: 'invalid' });
expectEqual<'abortSignal' extends keyof typeof text.config ? true : false, false>();
