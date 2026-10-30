import { create, z } from 'casai';
import type { LanguageModel, Tool } from 'ai';
import { tool } from 'ai';
import { expectType } from './assert.js';

declare const model: LanguageModel;
const dependency = create.Function.asTool({
	inputSchema: z.object({}), context: { db: (): string => 'trusted' }, execute: ({ db }) => db(),
});
// @ts-expect-error Explicit binding preserves private implementation dependencies.
dependency.bindToolContext({ db: 'wrong' });
// @ts-expect-error An internal registry binding has the same requirement.
create.Function({ tools: { dependency }, toolsContext: { dependency: { db: 'wrong' } }, execute: ({ dependency }) => dependency({}) });
// @ts-expect-error Reusable fragments also check known tool bindings.
create.Config({ tools: { dependency }, toolsContext: { dependency: { db: 'wrong' } } });
// @ts-expect-error Renderers cannot bind an incompatible known dependency.
create.Template({ template: '{{ dependency() }}', tools: { dependency }, toolsContext: { dependency: { db: 'wrong' } } });
const withDependency = create.Function({ tools: { dependency }, execute: ({ dependency }) => dependency({}) });
// @ts-expect-error Per-run binding preserves the dependency too.
void withDependency.run({ toolsContext: { dependency: { db: 'wrong' } } });
void withDependency.run({ toolsContext: { dependency: { db: () => 'replacement' } } });

const defaulted = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: ({ value }) => value });
const owner = create.Function({
	tools: { defaulted }, toolsContext: { defaulted: { value: 4 } }, execute: ({ defaulted }) => defaulted({}),
});
// @ts-expect-error The retained body was allowed to omit value.
void owner.run({ toolsContext: { defaulted: {} } });
// @ts-expect-error Inheritance must preserve that same guarantee.
create.Function({ toolsContext: { defaulted: {} } }, owner);
// @ts-expect-error Config inheritance cannot hide the invalid substitution.
create.Config({ toolsContext: { defaulted: {} } }, owner);
// @ts-expect-error Copying a configuration must not retain its stale helper signature.
create.Function({ ...owner.config, toolsContext: { defaulted: {} } });
// @ts-expect-error Explicitly reusing the old callback has the same requirement.
create.Function({ toolsContext: { defaulted: {} }, execute: owner.config.execute }, owner);
void owner.run({ toolsContext: { defaulted: { value: 5 } } });
void owner.run({ toolsContext: undefined });
void create.Function({ toolsContext: { defaulted: { value: 5 } } }, owner)();
const newBody = create.Function({
	toolsContext: { defaulted: {} }, execute: ({ defaulted }) => defaulted({ value: 6 }),
}, owner);
expectType<Promise<number>>(newBody());
const newFragment = create.Config({
	toolsContext: { defaulted: {} }, execute: ({ defaulted }) => defaulted({ value: 7 }),
}, owner);
void create.Function({}, newFragment)();

const preparer = create.LLMAgent.withFunction({
	model, tools: { defaulted }, toolsContext: { defaulted: { value: 4 } },
	prompt: async ({ defaulted }) => String(await defaulted({})),
});
// @ts-expect-error A retained preparer also depends on the captured public default.
void preparer.run({ toolsContext: { defaulted: {} } });
// @ts-expect-error The inherited preparer retains the same helper contract.
create.LLMAgent.withFunction({ toolsContext: { defaulted: {} } }, preparer);
void preparer.run({ toolsContext: { defaulted: { value: 5 } } });
create.LLMAgent.withFunction({
	toolsContext: { defaulted: {} }, prompt: async ({ defaulted }) => String(await defaulted({ value: 6 })),
}, preparer);

const fromText = create.Function.asTool({
	inputSchema: z.object({ value: z.string().transform(Number) }),
	toolContextSchema: z.object({ factor: z.number() }), context: { factor: 1 }, execute: ({ value }) => value,
});
const fromNumber = create.Function.asTool({
	inputSchema: z.object({ value: z.number() }),
	toolContextSchema: z.object({ factor: z.number() }), context: { factor: 1 }, execute: ({ value }) => value,
});
// Optional helpers must not manufacture a failed replacement from their optionality.
declare const optionalOperation: typeof fromText | undefined;
const optionalPreparer = create.LLMAgent.withFunction({
	model, tools: { operation: optionalOperation }, toolsContext: { operation: { factor: 1 } },
	prompt: async ({ operation }) => operation ? String(await operation({ value: '4' })) : 'No operation.',
});
void optionalPreparer.run({});
void optionalPreparer.run({ tools: { operation: fromText } });
// @ts-expect-error Optional availability does not permit changing the retained helper's raw input.
void optionalPreparer.run({ tools: { operation: fromNumber } });
const rawCaller = create.LLMAgent.withFunction({
	model, tools: { operation: fromText }, toolsContext: { operation: { factor: 1 } },
	prompt: async ({ operation }) => String(await operation({ value: '4' })),
});
create.LLMAgent.withFunction({
	tools: { operation: fromNumber }, prompt: async ({ operation }) => String(await operation({ value: 4 })),
}, rawCaller);
void rawCaller.run({ tools: { operation: fromText } });
// @ts-expect-error Equal parsed outputs do not make different raw inputs interchangeable.
void rawCaller.run({ tools: { operation: fromNumber } });
// @ts-expect-error An inherited preparer retains its original raw calls.
create.LLMAgent.withFunction({ tools: { operation: fromNumber } }, rawCaller);
// Model-only registries use the SDK descriptor contract, with no coded helper consumer.
void create.LLMAgent({
	model, prompt: 'ready', tools: { operation: fromText }, toolsContext: { operation: { factor: 1 } },
}).run({ tools: { operation: fromNumber } });

// Native scalar/array helpers retain their native (non-generic) call contracts.
const nativeNumber = tool({ inputSchema: z.number(), execute: value => value });
const nativeArray = tool({ inputSchema: z.array(z.number()), execute: value => value.length });
const nativeOwner = create.LLMAgent.withFunction({
	model, tools: { nativeNumber, nativeArray },
	prompt: async helpers => String(await helpers.nativeNumber(3) + await helpers.nativeArray([1, 2])),
});
void nativeOwner.run({ tools: { nativeNumber, nativeArray } });
// @ts-expect-error A retained preparer needs the guaranteed executor, not just its descriptor types.
void nativeOwner.run({ tools: { nativeNumber: { inputSchema: z.number(), outputSchema: z.number() } } });

const branchTool = create.Function.asTool({
	inputSchema: z.union([
		z.strictObject({ kind: z.literal('a'), a: z.number() }),
		z.strictObject({ kind: z.literal('b'), b: z.string() }),
	]),
	execute: input => input.kind,
});
// @ts-expect-error Root-union public defaults cannot be projected for a registered tool.
create.Function({
	tools: { branchTool }, toolsContext: { branchTool: { kind: 'a', a: 1 } as const },
	execute: ({ branchTool }) => branchTool({}),
});
const independentFields = create.Function.asTool({ inputSchema: z.strictObject({ a: z.number(), b: z.string() }), execute: input => input.a });
declare const branchDefaults: { a: number } | { b: string };
const conditionalDefaults = create.Function({
	tools: { independentFields }, toolsContext: { independentFields: branchDefaults }, execute: input => input.independentFields({ a: 1, b: 'ready' }),
});
void conditionalDefaults.run({});
void conditionalDefaults.run({ toolsContext: { independentFields: branchDefaults } });

// Casai tools cannot introduce implicit public extras; open-root admission is
// checked in closed-tool-input.ts. Native helpers below retain open contracts.

// Replacements may widen accepted raw values without invalidating retained calls.
const wider = create.Function.asTool({
	inputSchema: z.object({ value: z.union([z.string(), z.number()]).transform(Number) }),
	toolContextSchema: z.object({ factor: z.number() }), context: { factor: 1 }, execute: ({ value }) => value,
});
void rawCaller.run({ tools: { operation: wider } });
const schemaDefault = create.Function.asTool({
	inputSchema: z.object({ value: z.number().default(3) }), execute: ({ value }) => value,
});
const optionalOwner = create.Function({
	tools: { schemaDefault }, execute: ({ schemaDefault }) => schemaDefault({ value: undefined }),
});
void optionalOwner.run({ toolsContext: { schemaDefault: { value: 5 } } });

// Omission guarantees may move from configuration to the schema.
const configuredFactor = create.Function.asTool({
	inputSchema: z.object({ value: z.number(), factor: z.number() }), context: { factor: 2 }, execute: input => input.value * input.factor,
});
const factorSchema = z.object({ value: z.number(), factor: z.number().default(2) });
const defaultedFactor = create.Function.asTool({ inputSchema: factorSchema, execute: input => input.value * input.factor });
const factorOwner = create.Function({ tools: { operation: configuredFactor }, execute: ({ operation }) => operation({ value: 3 }) });
void create.Function({ tools: { operation: defaultedFactor } }, factorOwner)();
const factorPreparer = create.LLMAgent.withFunction({ model, tools: { operation: configuredFactor },
	prompt: async ({ operation }) => String(await operation({ value: 3 })) });
void factorPreparer.run({ tools: { operation: defaultedFactor } });

// Registry settings are raw; SDK replacement descriptors consume parsed context.
const parsedContext = z.object({ factor: z.string().transform(Number) });
const parsedOperation = create.Function.asTool({ inputSchema: z.object({ value: z.number() }),
	toolContextSchema: parsedContext, context: { factor: 1 }, execute: input => input.value * input.factor });
const parsedReplacement = create.Function.asTool({ inputSchema: z.object({ value: z.number() }),
	toolContextSchema: z.object({ factor: z.union([z.string(), z.number()]).transform(Number) }), context: { factor: 1 }, execute: input => input.value * input.factor + 1 });
const parsedPreparer = create.LLMAgent.withFunction({ model, tools: { operation: parsedOperation },
	toolsContext: { operation: { factor: '3' } }, prompt: async ({ operation }) => String(await operation({ value: 2 })) });
const parsedStreamPreparer = create.LLMAgent.withFunction.asStream({ model, tools: { operation: parsedOperation },
	toolsContext: { operation: { factor: '3' } }, prompt: async ({ operation }) => String(await operation({ value: 2 })) });
void parsedPreparer.run({ tools: { operation: parsedReplacement } });
void parsedStreamPreparer.run({ tools: { operation: parsedReplacement } });
const parsedModel = create.LLMAgent({ model, prompt: 'ready', tools: { operation: parsedOperation }, toolsContext: { operation: { factor: '3' } } });
void parsedModel.run({ tools: { operation: parsedReplacement } });
// @ts-expect-error Application-supplied context remains the raw schema input.
void parsedPreparer.run({ toolsContext: { operation: { factor: 3 } } });
const stringContext = tool({ inputSchema: z.object({ value: z.number() }), contextSchema: z.object({ factor: z.string() }),
	execute: ({ value }, { context }) => value * context.factor.length });
expectType<Tool<{ value: number }, number, { factor: number }>>(parsedReplacement);
// @ts-expect-error The native SDK contract also rejects incompatible parsed context.
expectType<Tool<{ value: number }, number, { factor: number }>>(stringContext);
// @ts-expect-error Replacement descriptors must preserve parsed context, not just raw settings.
void parsedPreparer.run({ tools: { operation: stringContext } });
// @ts-expect-error Streaming replacements preserve the same native context contract.
void parsedStreamPreparer.run({ tools: { operation: stringContext } });
// @ts-expect-error Model-only registries preserve parsed SDK context too.
void parsedModel.run({ tools: { operation: stringContext } });

const undefinedFactorOwner = create.Function({ tools: { operation: defaultedFactor },
	execute: ({ operation }) => operation({ value: 3, factor: undefined }) });
// @ts-expect-error A configured required field no longer accepts explicit undefined.
create.Function({ tools: { operation: configuredFactor } }, undefinedFactorOwner);
const invalidFactor = create.Function.asTool({ inputSchema: factorSchema, context: { factor: 'invalid' }, execute: input => input.value * input.factor });
// @ts-expect-error An optional schema does not erase an invalid configured value.
create.Function({ tools: { operation: invalidFactor } }, factorOwner);
declare const optionalFactor: { factor?: number };
const optionalFactorTool = create.Function.asTool({ inputSchema: factorSchema, context: optionalFactor, execute: input => input.value * input.factor });
void create.Function({ tools: { operation: optionalFactorTool } }, factorOwner)();
declare const invalidOptionalFactor: { factor?: number | string };
const invalidOptionalFactorTool = create.Function.asTool({ inputSchema: factorSchema, context: invalidOptionalFactor, execute: input => input.value * input.factor });
// @ts-expect-error A possible invalid configured value also invalidates omission.
create.Function({ tools: { operation: invalidOptionalFactorTool } }, factorOwner);

// Keep discriminants in their raw input shape while comparing helper contracts.
const unionValues = create.Function.asTool({ inputSchema: z.object({ value: z.union([z.literal(1), z.literal(2)]), factor: z.number() }),
	context: { factor: 2 }, execute: input => input.value * input.factor });
const unionValueOwner = create.Function({ tools: { operation: unionValues }, execute: ({ operation }) => operation({ value: 2 }) });
const unionDefaults = create.Function.asTool({ inputSchema: z.union([
	z.object({ value: z.literal(1), factor: z.number().default(2) }), z.object({ value: z.literal(2), factor: z.number().default(2) }),
]), execute: input => input.value * input.factor });
void create.Function({ tools: { operation: unionDefaults } }, unionValueOwner)();
const partialUnionDefaults = create.Function.asTool({ inputSchema: z.union([
	z.object({ value: z.literal(1), factor: z.number().default(2) }), z.object({ value: z.literal(2), factor: z.number() }),
]), execute: input => input.value * input.factor });
// @ts-expect-error Every input alternative must preserve omission of factor.
create.Function({ tools: { operation: partialUnionDefaults } }, unionValueOwner);

const shadowed = create.Function({
	tools: { defaulted }, toolsContext: { defaulted: { value: 4 } },
	context: { defaulted: () => 'shadow' }, execute: ({ defaulted }) => defaulted(),
});
void shadowed.run({ toolsContext: { defaulted: {} } });

// A replacement may add guarantees, but cannot turn an existing guarantee conditional.
void conditionalDefaults.run({ toolsContext: { independentFields: { a: 2 } } });
const withA = create.Function({ tools: { independentFields }, toolsContext: { independentFields: { a: 1 } },
	execute: ({ independentFields }) => independentFields({ b: 'ready' }) });
// @ts-expect-error Some possible defaults no longer supply a.
void withA.run({ toolsContext: { independentFields: branchDefaults } });

const modelContext = { toolContextSchema: z.object({ factor: z.number() }), context: { factor: 1 } };
const open = tool({ contextSchema: modelContext.toolContextSchema, inputSchema: z.looseObject({ value: z.number() }), execute: input => input.value });
const openPreparer = create.LLMAgent.withFunction({ model, tools: { open }, toolsContext: { open: { factor: 1 } },
	prompt: async ({ open }) => String(await open({ value: 1, extra: 'text' })) });
const closed = tool({ contextSchema: modelContext.toolContextSchema, inputSchema: z.object({ value: z.number() }), execute: input => input.value });
// @ts-expect-error A closed replacement no longer accepts arbitrary public fields.
void openPreparer.run({ tools: { open: closed } });
const restricted = tool({ contextSchema: modelContext.toolContextSchema, inputSchema: z.looseObject({ value: z.number(), extra: z.number().optional() }), execute: input => input.value });
// @ts-expect-error An optional named constraint can invalidate former open calls.
void openPreparer.run({ tools: { open: restricted } });
const unrestricted = tool({ contextSchema: modelContext.toolContextSchema, inputSchema: z.looseObject({ value: z.number(), extra: z.unknown().optional() }), execute: input => input.value });
void openPreparer.run({ tools: { open: unrestricted } });

const mixed = tool({ contextSchema: modelContext.toolContextSchema, inputSchema: z.union([
	z.looseObject({ kind: z.literal('a') }), z.strictObject({ kind: z.literal('b') }),
]), execute: () => 1 });
const changedMixed = tool({ contextSchema: modelContext.toolContextSchema, inputSchema: z.union([
	z.strictObject({ kind: z.literal('a') }), z.looseObject({ kind: z.literal('b') }),
]), execute: () => 1 });
const mixedOwner = create.LLMAgent.withFunction({ model, tools: { mixed }, toolsContext: { mixed: { factor: 1 } },
	prompt: async ({ mixed }) => String(await mixed({ kind: 'a', extra: 'valid' })) });
// @ts-expect-error Moving openness to another branch invalidates an existing call.
void mixedOwner.run({ tools: { mixed: changedMixed } });

const noValue = create.Function.asTool({ ...modelContext, inputSchema: z.object({ other: z.string().optional() }), execute: () => 1 });
// @ts-expect-error A closed replacement must still accept the old public keys.
void rawCaller.run({ tools: { operation: noValue } });
const optionalNew = create.Function.asTool({ ...modelContext, inputSchema: z.object({ value: z.string().transform(Number), note: z.string().optional() }), execute: input => input.value });
void rawCaller.run({ tools: { operation: optionalNew } });

declare const enabled: boolean;
const selected = create.Function.asTool({ ...modelContext,
	inputSchema: enabled ? z.object({ value: z.string().transform(Number) }) : z.object({ value: z.number() }), execute: input => input.value });
// @ts-expect-error Every selected parser must accept the retained string call.
void rawCaller.run({ tools: { operation: selected } });
const selectedWide = create.Function.asTool({ ...modelContext,
	inputSchema: enabled ? z.object({ value: z.string().transform(Number) }) : z.object({ value: z.union([z.number(), z.string()]).transform(Number) }), execute: input => input.value });
void rawCaller.run({ tools: { operation: selectedWide } });
create.Function({ tools: { operation: fromNumber }, toolsContext: { operation: { factor: 1 } },
	// @ts-expect-error A concrete helper annotation must accept the actual raw input.
	execute: ({ operation }: { operation: (input: { value: string }) => Promise<number> }) => operation({ value: '4' }) });
