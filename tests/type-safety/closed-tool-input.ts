import { z } from 'zod/v4';
import * as mini from 'zod/mini';
import { jsonSchema, tool } from 'ai';
import { create } from 'casai';

const closed = create.Function.asTool({ inputSchema: z.object({ value: z.number(), attributes: z.record(z.string(), z.unknown()).optional() }),
	context: { value: 1, userId: 'trusted' }, execute: ({ value, attributes, userId }) => ({ value, attributes, userId }) });
void closed();
void closed({ attributes: { userId: 'public' } });
// @ts-expect-error Tools never accept undeclared root fields.
void closed({ extra: true });
// @ts-expect-error Named calls use the same root contract.
void closed.run({ context: { userId: 'attacker' } });
closed.bindToolContext({ value: 2 });

// @ts-expect-error Open root input is not a Casai tool contract.
create.Function.asTool({ inputSchema: z.looseObject({ value: z.number() }), execute: () => 1 });
// @ts-expect-error Catchalls are open even when they constrain extra values.
create.Script.asTool({ inputSchema: z.object({}).catchall(z.string()), script: 'return 1' });
// @ts-expect-error A root dictionary does not declare its public names.
create.Function.asTool({ inputSchema: z.record(z.string(), z.number()), execute: () => 1 });
// @ts-expect-error Mini root dictionaries have the same restriction.
create.Function.asTool({ inputSchema: mini.record(mini.string(), mini.number()), execute: () => 1 });
// @ts-expect-error Root records use catchall metadata even with enum keys; use a named object shape.
create.Function.asTool({ inputSchema: z.record(z.enum(['left', 'right']), z.number()), execute: () => 1 });
// @ts-expect-error Every selected schema must have a closed root.
create.Template.asTool({ inputSchema: Math.random() ? z.object({ value: z.number() }) : z.looseObject({ name: z.string() }), template: 'ok' });
// Native TS7 infers this identical-empty-shape choice as ZodObject<{}, $strip>,
// erasing the open alternative before Casai sees it. Runtime still rejects it.
const erasedEmptyPolicy = Math.random() ? z.object({}) : z.looseObject({});
create.Template.asTool({ inputSchema: erasedEmptyPolicy, template: 'ok' });
// @ts-expect-error A union branch cannot open the root.
create.Function.asTool({ inputSchema: z.union([z.object({ value: z.number() }), z.looseObject({ name: z.string() })]), execute: () => 1 });
// @ts-expect-error Preprocessing does not hide an open root schema.
create.Function.asTool({ inputSchema: z.preprocess(value => value, z.looseObject({ value: z.number() })), execute: () => 1 });
// @ts-expect-error Mini schemas have the same closed root requirement.
create.Function.asTool({ inputSchema: mini.looseObject({ value: mini.number() }), execute: () => 1 });
const parent = create.Config({ inputSchema: z.looseObject({ value: z.number() }) });
// @ts-expect-error Inheritance cannot bypass the tool contract.
create.Function.asTool({ execute: () => 1 }, parent);

const preprocessed = create.Function.asTool({ inputSchema: z.preprocess(value => value, z.object({ value: z.number() })),
	context: { value: 1 }, execute: ({ value }) => value });
void preprocessed();
// Unknown raw preprocessor input remains erased statically; the runtime guard
// rejects these keys before preprocessing (ClosedToolInput.unit.test.ts).
void preprocessed({ extra: true });

const sdk = create.Function.asTool({ inputSchema: jsonSchema<{ value: number }>({ type: 'object', properties: { value: { type: 'number' } }, additionalProperties: false }),
	execute: input => input.value });
void sdk({ value: 1 });
// @ts-expect-error Concrete SDK input types retain their closed root shape.
void sdk({ value: 1, extra: true });

// A broad SDK type does not describe its runtime metadata policy. Closed
// metadata remains supported; runtime checks names when the type has erased them.
const opaque = create.Function.asTool({ inputSchema: jsonSchema<Record<string, unknown>>({ type: 'object', properties: { value: { type: 'number' } }, additionalProperties: false }),
	execute: input => input.value });
void opaque({ value: 1 });

const ordinary = create.Function({ inputSchema: z.looseObject({ value: z.number() }), execute: input => input.value });
void ordinary({ value: 1, extra: true });
const native = tool({ inputSchema: z.looseObject({ value: z.number() }), execute: input => input.value });
create.Function({ tools: { native }, execute: ({ native }) => native({ value: 1, extra: true }) });
