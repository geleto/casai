import { create, z } from 'casai';
import type { LanguageModel } from 'ai';
import { expectEqual } from './assert.js';

declare const choose: boolean;
declare const model: LanguageModel;
const inputSchema = z.object({});
const factor = z.object({ factor: z.number() });
const tenant = z.object({ tenant: z.string() });

const conditional = create.Function.asTool({ inputSchema, toolContextSchema: choose ? factor : undefined, execute: () => 1 });
// @ts-expect-error Context must satisfy the parser whenever it is present.
conditional.bindToolContext({});
// @ts-expect-error An absent-parser alternative does not erase the present parser's field types.
conditional.bindToolContext({ factor: 'wrong' });
conditional.bindToolContext({ factor: 2 });
// @ts-expect-error A possibly required tool context must be configured on a finished owner.
create.Function({ tools: { conditional }, execute: () => 1 });
// @ts-expect-error Explicit undefined is not valid for every selected parser.
create.Function({ tools: { conditional }, toolsContext: { conditional: undefined }, execute: () => 1 });
const fragment = create.Config({ tools: { conditional } });
// @ts-expect-error Reusable fragments may be incomplete; finished owners may not.
create.Function({ execute: () => 1 }, fragment);
create.Function({ toolsContext: { conditional: { factor: 2 } }, execute: ({ conditional }) => conditional({}) }, fragment);
// @ts-expect-error An empty child still validates inherited required registry context.
create.Function({}, { config: { tools: { conditional }, execute: () => 1 } });
// @ts-expect-error Tool children also retain inherited registry requirements.
create.Function.asTool({}, { config: { inputSchema, tools: { conditional }, execute: () => 1 } });
// @ts-expect-error Partial configuration still validates a supplied context.
create.Config({ tools: { conditional }, toolsContext: { conditional: { factor: 'wrong' } } });

const selected = create.Function.asTool({ inputSchema, toolContextSchema: choose ? factor : tenant, execute: () => 1 });
// @ts-expect-error The actual parser can require tenant instead of factor.
selected.bindToolContext({ factor: 2 });
selected.bindToolContext({ factor: 2, tenant: 'both' });
// @ts-expect-error Registry admission checks every selected parser too.
create.Script({ script: 'return selected({})', tools: { selected }, toolsContext: { selected: { factor: 2 } } });
const owner = create.Function({ tools: { selected }, toolsContext: { selected: { factor: 2, tenant: 'both' } }, execute: ({ selected }) => selected({}) });
// @ts-expect-error A run override replaces the whole entry and cannot drop a required alternative field.
void owner.run({ toolsContext: { selected: { factor: 2 } } });
void owner.run({ toolsContext: { selected: { factor: 3, tenant: 'both' } } });
// @ts-expect-error Model registries preserve possibly required context.
create.TextGenerator({ model, prompt: 'go', tools: { conditional } });
const generated = create.TextGenerator({ model, prompt: 'go', tools: { selected }, toolsContext: { selected: { factor: 2, tenant: 'both' } } });
// @ts-expect-error Model run overrides have the same selected-context requirement.
void generated.run({ toolsContext: { selected: { tenant: 'one branch' } } });

const factorTool = create.Function.asTool({ inputSchema, toolContextSchema: factor, execute: () => 1 });
const _tenantTool = create.Function.asTool({ inputSchema, toolContextSchema: tenant, execute: () => 1 });
// @ts-expect-error The empty-child rule also holds for a definite context schema.
create.Function({}, { config: { tools: { factorTool }, execute: () => 1 } });
declare const correlated: { tools: { operation: typeof factorTool }; toolsContext: { operation: { factor: number } } }
	| { tools: { operation: typeof _tenantTool }; toolsContext: { operation: { tenant: string } } };
create.Function({ execute: () => 1 }, { config: correlated });
create.TextGenerator({ model, prompt: 'go' }, { config: correlated });

// One union parser accepts either branch, unlike selecting one parser instance.
const union = create.Function.asTool({ inputSchema, toolContextSchema: z.union([factor, tenant]), execute: () => 1 });
union.bindToolContext({ factor: 2 });
union.bindToolContext({ tenant: 'either' });
create.Function({ tools: { union }, toolsContext: { union: { factor: 2 } }, execute: ({ union }) => union({}) });

// Broad raw input in one parser must not erase another parser's requirements.
const unknownRaw = z.unknown().transform(() => ({ factor: 1 }));
const anyRaw = z.any();
const selectedUnknown = create.Function.asTool({ inputSchema, toolContextSchema: choose ? unknownRaw : factor, execute: () => 1 });
// @ts-expect-error The selected required parser still needs factor.
selectedUnknown.bindToolContext({});
selectedUnknown.bindToolContext({ factor: 2 });
const selectedAny = create.Function.asTool({ inputSchema, toolContextSchema: choose ? anyRaw : factor, execute: () => 1 });
// @ts-expect-error Raw any in another parser cannot authorize a wrong factor type.
selectedAny.bindToolContext({ factor: 'wrong' });
selectedAny.bindToolContext({ factor: 2 });
// @ts-expect-error A broad raw parser alternative cannot make required registry context optional.
create.Function({ tools: { selectedUnknown, selectedAny }, execute: () => 1 });

const optional = create.Function.asTool({ inputSchema, toolContextSchema: factor.optional(), execute: () => 1 });
const defaulted = create.Function.asTool({ inputSchema, toolContextSchema: factor.default({ factor: 1 }), execute: () => 1 });
optional.bindToolContext(undefined);
defaulted.bindToolContext(undefined);
create.Function({ tools: { optional, defaulted }, execute: ({ optional, defaulted }) => Promise.all([optional({}), defaulted({})]) });
const selectedOptional = create.Function.asTool({ inputSchema, toolContextSchema: choose ? factor.optional() : factor, execute: () => 1 });
// @ts-expect-error Optionality must hold for every selected parser.
selectedOptional.bindToolContext(undefined);
// @ts-expect-error A required alternative prevents omission of the registry entry.
create.Function({ tools: { selectedOptional }, execute: () => 1 });
selectedOptional.bindToolContext({ factor: 2 });

const rawFactor = z.object({ factor: z.string().transform(Number) });
const transformed = create.Function.asTool({ inputSchema, context: { factor: 1 }, toolContextSchema: choose ? rawFactor : tenant,
	execute: ({ factor }) => { expectEqual<typeof factor, number>(); return factor; } });
transformed.bindToolContext({ factor: '2', tenant: 'both' });
// @ts-expect-error Binding accepts raw context, not the parsed number.
transformed.bindToolContext({ factor: 2, tenant: 'both' });
create.Function({ tools: { transformed }, toolsContext: { transformed: { factor: '2', tenant: 'both' } },
	execute: ({ transformed }) => transformed({}) });
const renamed = create.Function.asTool({ inputSchema,
	toolContextSchema: z.object({ rawFactor: z.string() }).transform(({ rawFactor }) => ({ factor: Number(rawFactor) })),
	execute: ({ factor }) => { expectEqual<typeof factor, number | undefined>(); return factor; } });
renamed.bindToolContext({ rawFactor: '2' });
// @ts-expect-error Binding uses the raw name; the callback receives the parsed name.
renamed.bindToolContext({ factor: 2 });

// A real parsed index signature retains its value type on the ordinary path.
create.Function.asTool({ inputSchema: z.object({ label: z.string() }).transform(({ label }): Record<string, string> => ({ label })),
	toolContextSchema: factor, execute: ({ factor }) => { expectEqual<typeof factor, string | number>(); return factor; } });

// Empty public output must not erase absence from the ordinary execution path.
const guarded = create.Function.asTool({ inputSchema, toolContextSchema: factor, execute: ({ factor }) => {
	expectEqual<typeof factor, number | undefined>();
	return factor?.toFixed() ?? 'ordinary';
} });
void guarded();
void guarded.run();
void guarded.execute({}, { toolCallId: 'sdk', messages: [], context: { factor: 2 } });
create.Function.asTool({ inputSchema, toolContextSchema: factor, execute: ({ factor }) => {
	// @ts-expect-error Ordinary calls do not supply tool context.
	return factor.toFixed();
} });
create.Function.asTool({ inputSchema, toolContextSchema: choose ? factor : undefined, execute: ({ factor }) => {
	expectEqual<typeof factor, number | undefined>();
	// @ts-expect-error Conditional tool context must not promise an ordinary dependency either.
	return factor.toFixed();
} });
create.Function.asTool({ inputSchema: z.object({ value: z.number() }), toolContextSchema: factor, execute: context => {
	// @ts-expect-error A nonempty public shape has the same absence rule.
	expectEqual<typeof context.factor, number>();
	return 'factor' in context ? context.factor.toFixed() : 'ordinary';
} });
const configured = create.Function.asTool({ inputSchema, context: { factor: 1 }, toolContextSchema: factor, execute: ({ factor }) => {
	expectEqual<typeof factor, number>();
	return factor.toFixed();
} });
void configured();
void configured.run();
void create.Function.asTool({}, configured)();
// @ts-expect-error A retained callback cannot lose its ordinary-call dependency.
create.Function.asTool({ context: { factor: undefined } }, configured);
const inheritedGuard = create.Function.asTool({}, guarded);
void inheritedGuard();
void inheritedGuard.run();
create.TextGenerator.withFunction.asTool({ model, inputSchema, toolContextSchema: factor, prompt: ({ factor }) => {
	expectEqual<typeof factor, number | undefined>();
	// @ts-expect-error Tool function preparers also run without tool context on ordinary calls.
	return factor.toFixed();
} });
