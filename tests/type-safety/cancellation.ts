import { Output } from 'ai';
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
create.LLMAgent({ model, prompt: 'test', abortSignal });
// @ts-expect-error Cancellation belongs to an invocation.
create.LLMAgent.asStream({ model, prompt: 'test', abortSignal });
// @ts-expect-error A variable does not make a constructor signal valid.
create.LLMAgent(configured);
// @ts-expect-error A variable does not make a constructor signal valid.
create.LLMAgent.asStream(configured);
// @ts-expect-error Reusable fragments cannot store invocation signals.
create.Config({ abortSignal });
// @ts-expect-error Inherited signals are rejected too.
create.LLMAgent({ prompt: 'test' }, { config: { model, abortSignal } });
// @ts-expect-error Inherited signals are rejected too.
create.LLMAgent.asStream({ prompt: 'test', output: Output.object({ schema: schema }) }, { config: { model, abortSignal } });
// @ts-expect-error Rendered factories also reject constructor signals.
create.LLMAgent.withFunction({ model, prompt: () => 'test', abortSignal });
// @ts-expect-error Loaded factories also reject constructor signals.
create.LLMAgent.loadsText({ model, prompt: 'source', loader: { load: () => 'test' }, abortSignal, output: Output.object({ schema: schema }) });

declare const alternative: { description: string, abortSignal: AbortSignal } | { description: string, debug: boolean };
const parent = { config: { model } };
// @ts-expect-error Every possible constructor branch must be free of invocation signals.
create.LLMAgent(alternative, parent);
// @ts-expect-error Every possible constructor branch must be free of invocation signals.
create.LLMAgent({ ...alternative, output: Output.object({ schema: schema }) }, parent);
// @ts-expect-error A Config fragment cannot hide a signal in a union branch.
create.Config(alternative);
declare const alternativeParent: { model: LanguageModel, abortSignal: AbortSignal } | { model: LanguageModel, description: string };
// @ts-expect-error Empty children cannot inherit a possible constructor signal.
create.LLMAgent.asStream({}, { config: alternativeParent });
// @ts-expect-error Empty children cannot inherit a possible constructor signal.
create.LLMAgent({ output: Output.object({ schema: schema }) }, { config: alternativeParent });

// All invocation forms retain cancellation after removing it from factory configuration.
const text = create.LLMAgent({ model, prompt: 'test' });
void text.run({ abortSignal });
void create.LLMAgent.asStream({ model }).run({ prompt: 'test', abortSignal });
void create.LLMAgent({ model, output: Output.object({ schema: schema }) }).run({ prompt: 'test', abortSignal });
void create.LLMAgent.asStream({ model, output: Output.object({ schema: schema }) }).run({ prompt: 'test', abortSignal });
void create.LLMAgent.withTemplate({ model, prompt: '{{ input }}' }).run({ context: { input: 'test' }, abortSignal });
void create.LLMAgent.withScript.asStream({ model, prompt: 'return "test"' }).run({ abortSignal });
void create.LLMAgent.withFunction({ model, prompt: () => 'test', output: Output.object({ schema: schema }) }).run({ abortSignal });
void create.LLMAgent.loadsText.asStream({ model, loader: { load: () => 'test' }, output: Output.object({ schema: schema }) }).run({ prompt: 'source', abortSignal });
// @ts-expect-error Invocation signals retain their native type.
void text.run({ abortSignal: 'invalid' });
expectEqual<'abortSignal' extends keyof typeof text.config ? true : false, false>();

// Optional signals can be forwarded unchanged, including with exact optional properties.
declare const optionalSignal: AbortSignal | undefined;
const fn = create.Function({ execute: () => 1 });
const script = create.Script({ script: 'return 1' });
const template = create.Template({ template: 'test' });
void text.run({ abortSignal: optionalSignal });
void fn.run({ abortSignal: optionalSignal });
void script.run({ abortSignal: optionalSignal });
void template.run({ abortSignal: optionalSignal });
// @ts-expect-error Optional forwarding does not admit a non-signal value.
void fn.run({ abortSignal: 'invalid' });
