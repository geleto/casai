import { Output } from 'ai';
/* eslint-disable @typescript-eslint/no-floating-promises -- Compiler-only public consumers. */
import { create } from 'casai';
import { z } from 'zod/v4';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

declare const model: LanguageModel;
const inputSchema = z.union([z.object({ x: z.number() }), z.object({ y: z.string() })]);
const local = create.Function({ inputSchema, context: { x: 1, db: true }, execute: input => input });
local();
local.run({});
// @ts-expect-error Root union defaults cannot be projected into an SDK descriptor.
create.Function.asTool({ inputSchema, context: { x: 1 }, execute: input => input });
// @ts-expect-error Template tools use the same projection boundary.
create.Template.asTool({ template: '{{ x }}', inputSchema, context: { x: 1 } });
// @ts-expect-error Script tools use the same projection boundary.
create.Script.asTool({ script: 'return x', inputSchema, context: { x: 1 } });
// @ts-expect-error LLM tools use the same projection boundary.
create.LLMAgent.withTemplate.asTool({ model, prompt: '{{ x }}', inputSchema, context: { x: 1 } });
// @ts-expect-error Object tools use the same projection boundary.
create.LLMAgent.withTemplate.asTool({ model, prompt: '{{ x }}', inputSchema, context: { x: 1 }, output: Output.object({ schema: z.object({ value: z.string() }) }) });
const parent = create.Config({ context: { x: 1 } });
// @ts-expect-error Inherited public defaults also need projection.
create.Function.asTool({ inputSchema, execute: input => input }, parent);
const operation = create.Function.asTool({ inputSchema, context: { db: true }, execute: input => input });
const wrapped = create.Function.asTool({ inputSchema: inputSchema.readonly(), context: { db: true }, execute: input => input });
wrapped({ x: 2 });
// @ts-expect-error Wrapping a union does not enable public-default projection.
wrapped.bindToolContext({ x: 2 });
const preprocessed = z.preprocess(value => value, inputSchema);
create.Function({ inputSchema: preprocessed, context: { x: 1 }, execute: input => input })();
// @ts-expect-error Preprocessing also preserves the union projection restriction.
create.Function.asTool({ inputSchema: preprocessed, context: { x: 1 }, execute: input => input });
operation({ x: 2 });
operation.bindToolContext({ db: false });
// @ts-expect-error Bound public defaults require the same projection.
operation.bindToolContext({ x: 2 });
// @ts-expect-error Owners cannot introduce unsupported public defaults.
create.Function({ tools: { operation }, toolsContext: { operation: { x: 2 } }, execute: () => 1 });
const owner = create.Function({ tools: { operation }, toolsContext: { operation: { db: true } }, execute: input => input.operation({ x: 2 }) });
owner();
// @ts-expect-error Run-time rebinding cannot introduce unsupported public defaults either.
owner.run({ toolsContext: { operation: { x: 2 } } });

const fields = z.object({ when: z.date(), callback: z.custom<() => number>() });
// An empty Zod object instead infers Record<string, never>, making the native intersection input impossible.
for (const schema of [z.preprocess(value => value, fields), z.lazy(() => fields), fields.and(z.object({ when: z.date() }))]) {
	create.Function({ inputSchema: schema, context: { db: true }, execute: input => {
		expectEqual<typeof input.when, Date>();
		expectEqual<typeof input.callback, () => number>();
		return input.callback();
	} })({ when: new Date(), callback: () => 1 });
}
const key = Symbol('private');
const symbolic = create.Function({ context: { [key]: true }, execute: input => input[key] });
symbolic();
// @ts-expect-error Symbol bindings remain private for local callers too.
symbolic({ [key]: false });

const lazyContext = create.Function.asTool({ inputSchema: z.object({}),
	toolContextSchema: z.lazy(() => z.object({ user: z.string().optional() })), execute: input => input });
lazyContext();
// @ts-expect-error Lazy output declarations reserve absent optional private fields too.
lazyContext({ user: 'admin' });

const original = create.Function.asTool({ inputSchema: z.object({ x: z.number() }), context: { x: 1 }, execute: input => input.x });
const inherited = create.Function.asTool({ description: 'Inherited configuration' }, original);
create.Function({ tools: { inherited }, toolsContext: { inherited: { x: 2 } }, execute: input => input.inherited() });
// eslint-disable-next-line @typescript-eslint/no-misused-spread -- Intentionally copy a callable to test public type rejection.
const copied = { ...original, description: 'Copied descriptor' };
// @ts-expect-error A spread descriptor is not a callable Casai component.
create.Function({ tools: { copied }, execute: () => 1 });
// @ts-expect-error Supplying context does not restore component initialization.
create.LLMAgent({ model, prompt: 'go', tools: { copied }, toolsContext: { copied: { x: 2 } } });
