import { Output } from 'ai';
/* eslint-disable @typescript-eslint/no-floating-promises -- Compiler-only public consumers. */
import { create, streamSchema } from 'casai';
import { z } from 'zod/v4';
import { z as z3 } from 'zod/v3';
import * as mini from 'zod/mini';
import { tool } from 'ai';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

const local = create.Function({ inputSchema: mini.object({ when: mini.date(), name: mini.string() }),
	context: { name: 'Ada' }, execute: input => { expectEqual<typeof input.when, Date>(); return input.when; } });
local({ when: new Date() });
local.run({ context: { when: new Date() } });
// @ts-expect-error The configured name does not satisfy the required date.
local({});
// @ts-expect-error Mini's closed object retains closed-shape caller checking.
local({ when: new Date(), extra: true });

const miniContext = mini.object({ userId: mini.optional(mini.string()) });
const miniTool = create.Function.asTool({ inputSchema: mini.object({ value: mini.number(), unrelated: mini.optional(mini.boolean()) }),
	toolContextSchema: mini.optional(miniContext), execute: input => input.value });
miniTool({ value: 1, unrelated: true });
miniTool.bindToolContext({ userId: 'trusted' });
// @ts-expect-error Mini's declared absent context name stays private.
miniTool({ value: 1, userId: 'attacker' });
// @ts-expect-error Run has the same private ownership rule.
miniTool.run({ context: { value: 1, userId: 'attacker' } });

const intersection = z.object({ userId: z.string().optional() }).and(z.object({ tenant: z.string().optional() }));
const composed = create.Function.asTool({ inputSchema: z.object({ unrelated: z.boolean().optional() }), toolContextSchema: intersection, execute: () => 1 });
composed({ unrelated: true });
// @ts-expect-error Both sides contribute declared private names.
composed({ userId: 'attacker' });
// @ts-expect-error The other intersection member is private too.
composed({ tenant: 'attacker' });

const declaredOutput = z.object({ userId: z.string().optional() });
const piped = create.Function.asTool({ inputSchema: z.object({ unrelated: z.boolean().optional() }),
	toolContextSchema: z.looseObject({}).transform(value => value).pipe(declaredOutput), execute: () => 1 });
piped({ unrelated: true });
// @ts-expect-error A declared pipeline output reserves its private name.
piped({ userId: 'attacker' });

const legacy = z3.object({ value: z3.number() });
declare const model: LanguageModel;
declare const condition: boolean;
// @ts-expect-error Casai input schemas support Zod 4 only.
create.Function({ inputSchema: legacy, execute: () => 1 });
// @ts-expect-error Output schemas have the same version contract.
create.Function({ schema: legacy, execute: () => ({ value: 1 }) });
// @ts-expect-error Reusable fragments cannot admit unsupported schemas.
create.Config({ inputSchema: legacy });
// @ts-expect-error A possible unsupported schema is still invalid.
create.Config({ inputSchema: condition ? legacy : z.object({ value: z.number() }) });
// @ts-expect-error Inherited settings cannot bypass the schema version boundary.
create.Function({ execute: () => 1 }, { config: { inputSchema: legacy } });
// @ts-expect-error Tool context uses the same supported schema contract.
create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: legacy, execute: () => 1 });
// @ts-expect-error Templates reject legacy input schemas.
create.Template({ template: 'ok', inputSchema: legacy });
// @ts-expect-error Scripts reject legacy output schemas.
create.Script({ script: 'return { value: 1 }', schema: legacy });
// @ts-expect-error LLM renderers reject legacy input schemas.
create.LLMAgent.withTemplate({ model, prompt: 'ok', inputSchema: legacy });
// SDK Output specifications retain native support for their own internal schemas.
create.LLMAgent({ model, prompt: 'ok', output: Output.object({ schema: legacy }) });
// @ts-expect-error Streaming elements require a supported schema.
streamSchema(legacy);
declare const native: import('@ai-sdk/provider-utils').ExecutableTool<import('ai').Tool<{ value: number }, number>>;
create.Function({ tools: { native }, execute: input => input.native({ value: 1 }) });

// Native SDK examples are typed as parsed input and advertised unchanged.
const exampleSchema = z.object({ value: z.string().transform(Number) });
tool({ inputSchema: exampleSchema, inputExamples: [{ input: { value: 2 } }] });
// @ts-expect-error Native inputExamples uses parsed output, despite the raw string parser.
tool({ inputSchema: exampleSchema, inputExamples: [{ input: { value: '2' } }] });

const miniatureUnion = mini.union([mini.object({ kind: mini.literal('a'), value: mini.number() }),
	mini.object({ kind: mini.literal('b'), text: mini.string() })]);
const union = create.Function({ inputSchema: miniatureUnion, context: { privateValue: true }, execute: input => input.kind });
union({ kind: 'a', value: 1 });
union({ kind: 'b', text: 'ok' });
// @ts-expect-error Branch requirements survive core-schema declaration inference.
union({ kind: 'a', text: 'wrong' });
