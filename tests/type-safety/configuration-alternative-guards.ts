import { Output } from 'ai';
import { create, z } from 'casai';
import { tool } from 'ai';
import type { LanguageModel } from 'ai';

declare const model: LanguageModel;
const secured = tool({ inputSchema: z.object({}), contextSchema: z.object({ tenant: z.string() }), execute: (_input, { context }) => context.tenant });
const simple = tool({ inputSchema: z.object({}), execute: () => 'ready' });
declare const conditional: { model: LanguageModel; prompt: string; tools: { secured: typeof secured } }
	| { model: LanguageModel; prompt: string };
// @ts-expect-error A possible registry still requires its trusted context.
create.LLMAgent(conditional);
// @ts-expect-error Streaming has the same fixed requirements.
create.LLMAgent.asStream(conditional);
const fragment = create.Config(conditional);
// @ts-expect-error Reusable fragments may be incomplete; finished generators may not.
create.LLMAgent({}, fragment);
// @ts-expect-error Inheritance must not lose the registry alternative.
create.LLMAgent.asStream({}, fragment);

declare const nested: { secured: typeof secured } | { simple: typeof simple };
// @ts-expect-error Every possible registry needs its required context.
create.Template({ template: 'ready', tools: nested });
// @ts-expect-error Script has the same registry requirement.
create.Script({ script: 'return 1', tools: nested });
// @ts-expect-error Function has the same registry requirement in both optional modes.
create.Function({ tools: nested, execute: () => 1 });

declare const paired: { tools: { secured: typeof secured }; toolsContext: { secured: { tenant: string } } }
	| { tools: { simple: typeof simple } };
create.LLMAgent({ model, prompt: 'ready' }, { config: paired });
create.LLMAgent.asStream({ model, prompt: 'ready' }, { config: paired });
create.Template({ template: 'ready', ...paired });
create.Script({ script: 'return 1', ...paired });
create.Function({ execute: () => 1 }, { config: paired });

const numericContext = tool({ inputSchema: z.object({}), contextSchema: z.object({ tenant: z.number() }), execute: (_input, { context }) => context.tenant });
declare const sameName: { tools: { lookup: typeof secured }; toolsContext: { lookup: { tenant: string } } }
	| { tools: { lookup: typeof numericContext }; toolsContext: { lookup: { tenant: number } } };
create.LLMAgent({ model, prompt: 'ready' }, { config: sameName });
create.Template({ template: 'ready', ...sameName });
declare const uncertainLookup: typeof secured | typeof numericContext;
// @ts-expect-error Independent registry/context unions cannot guarantee the right pairing.
create.LLMAgent({ model, prompt: 'ready', tools: { lookup: uncertainLookup }, toolsContext: { lookup: { tenant: 'tenant' } } });

const text = z.object({ value: z.string() });
const numeric = z.object({ value: z.number() });
declare const hooks: { inputSchema: typeof text; execute: () => string; onInputAvailable: (event: { input: { value: string } }) => void }
	| { inputSchema: typeof text; execute: () => string };
const hookedParent = create.Config(hooks);
// @ts-expect-error A retained branch-only callback must match the replaced schema.
create.Function.asTool({ inputSchema: numeric }, hookedParent);
create.Function.asTool({}, hookedParent);
create.Function.asTool({ inputSchema: numeric, onInputAvailable: event => { event.input.value.toFixed(); } }, hookedParent);
declare const rendererHooks: { inputSchema: typeof text; onInputAvailable: (event: { input: { value: string } }) => void } | { inputSchema: typeof text };
// @ts-expect-error Descriptor guards also apply to renderers.
create.Template.asTool({ template: 'ready', inputSchema: numeric }, { config: rendererHooks });

declare const correlatedHooks: { inputSchema: typeof text; execute: () => string; onInputAvailable: (event: { input: { value: string } }) => void }
	| { inputSchema: typeof numeric; execute: () => string; onInputAvailable: (event: { input: { value: number } }) => void };
create.Function.asTool({}, { config: correlatedHooks });

const textOutput = Output.object({ schema: text });
const numericOutput = Output.object({ schema: numeric });
const choiceOutput = Output.choice({ options: ['one', 'two'] });
const jsonOutput = Output.json();
declare const lifecycle: { model: LanguageModel; prompt: string; output: typeof textOutput; onEnd: (event: { output?: { value: string } | undefined }) => void }
	| { model: LanguageModel; prompt: string; output: typeof textOutput };
const objectParent = create.LLMAgent(lifecycle);
// @ts-expect-error Branch-only lifecycle callbacks must match the final output schema.
create.LLMAgent({ output: Output.object({ schema: numeric }) }, objectParent);
create.LLMAgent({ onEnd: event => { event.output?.value.toFixed(); }, output: Output.object({ schema: numeric }) }, objectParent);
create.LLMAgent({}, objectParent);
// @ts-expect-error Streaming lifecycle callbacks must also match each final branch.
create.LLMAgent.asStream({ output: Output.object({ schema: numeric }) }, { config: lifecycle });
create.LLMAgent.asStream({ onEnd: event => { event.output?.value.toFixed(); }, output: Output.object({ schema: numeric }) }, { config: lifecycle });
declare const pairedLifecycle: { model: LanguageModel; prompt: string; output: typeof textOutput; onEnd: (event: { output?: { value: string } | undefined }) => void }
	| { model: LanguageModel; prompt: string; output: typeof numericOutput; onEnd: (event: { output?: { value: number } | undefined }) => void };
create.LLMAgent(pairedLifecycle);
create.LLMAgent({}, { config: pairedLifecycle });
create.LLMAgent.asStream({}, { config: pairedLifecycle });
// Mode-specific settings remain paired with their own output alternative.
declare const outputModes: { model: LanguageModel; prompt: string; output: typeof numericOutput }
	| { model: LanguageModel; prompt: string; output: typeof choiceOutput };
create.LLMAgent(outputModes);
create.LLMAgent({}, { config: outputModes });
declare const streamingModes: { model: LanguageModel; prompt: string; output: typeof numericOutput }
	| { model: LanguageModel; prompt: string; output: typeof jsonOutput };
create.LLMAgent.asStream(streamingModes);
create.LLMAgent.asStream({}, { config: streamingModes });

declare const forbidden: { execute: () => number; contextSchema: undefined } | { execute: () => number };
// @ts-expect-error A forbidden property cannot hide in one alternative.
create.Function(forbidden);
// @ts-expect-error Fragments also reject every forbidden alternative.
create.Config(forbidden);
// @ts-expect-error Parent alternatives are checked too.
create.Function({}, { config: forbidden });
declare const forbiddenModel: { model: LanguageModel; prompt: string; contextSchema: undefined } | { model: LanguageModel; prompt: string };
// @ts-expect-error Literal LLM configurations reject every forbidden alternative.
create.LLMAgent(forbiddenModel);
// @ts-expect-error Streamers use the same forbidden-setting rule.
create.LLMAgent.asStream(forbiddenModel);
declare const forbiddenTemplate: { template: string; contextSchema: undefined } | { template: string };
// @ts-expect-error Renderer settings do not permit the native descriptor name.
create.Template(forbiddenTemplate);
declare const forbiddenScript: { script: string; contextSchema: undefined } | { script: string };
// @ts-expect-error Script settings also reject the native descriptor name.
create.Script(forbiddenScript);
declare const forbiddenObject: { model: LanguageModel; schema: typeof text; contextSchema: undefined } | { model: LanguageModel; schema: typeof text };
// @ts-expect-error Unknown keys must be checked in every Object configuration branch.
create.LLMAgent(forbiddenObject);
// @ts-expect-error Object streaming uses the same admission rule.
create.LLMAgent.asStream(forbiddenObject);
declare const forbiddenRun: { temperature: number; contextSchema: undefined } | { temperature: number };
const generator = create.LLMAgent({ model, prompt: 'ready' });
// @ts-expect-error Named invocation settings also reject branch-only forbidden keys.
void generator.run(forbiddenRun);
void generator.run({ temperature: 0 });
declare const forbiddenCodedRun: { context: { value: number }; contextSchema: undefined } | { context: { value: number } };
// @ts-expect-error Coded named calls already retain possible run-setting keys.
void create.Function({ execute: (input: { value: number }) => input.value }).run(forbiddenCodedRun);
create.Function({ context: { contextSchema: undefined }, execute: () => 1 });
create.Template({ template: 'ready', tools: { secured }, toolsContext: { secured: { tenant: 'trusted' } } });

// @ts-expect-error Present null cannot be flattened into a context object.
create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.null(), execute: () => 1 });
// @ts-expect-error A nullable output is not guaranteed to produce an object context.
create.Template.asTool({ template: 'ready', inputSchema: z.object({}), toolContextSchema: z.object({}).nullable() });
create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.undefined(), execute: () => 1 }).bindToolContext(undefined);
create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.object({}).optional(), execute: () => 1 }).bindToolContext(undefined);
create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.null().transform(() => ({ tenant: 'trusted' })), execute: () => 1 }).bindToolContext(null);

// Selection settings and callback maps must stay paired with each final registry.
interface SimpleRegistry { tools: { simple: typeof simple } }
declare const selectedChoice: (SimpleRegistry & { toolChoice: { type: 'tool'; toolName: 'missing' } }) | SimpleRegistry;
declare const selectedActive: (SimpleRegistry & { activeTools: ['missing'] }) | SimpleRegistry;
declare const selectedOrder: (SimpleRegistry & { toolOrder: ['missing'] }) | SimpleRegistry;
// @ts-expect-error A selection in only one parent branch still names an unknown tool.
create.LLMAgent({ model, prompt: 'ready' }, { config: selectedChoice });
// @ts-expect-error Streaming checks the same parent alternatives.
create.LLMAgent.asStream({ model, prompt: 'ready' }, { config: selectedChoice });
// @ts-expect-error Active tools must exist in every branch that supplies this setting.
create.LLMAgent({ model, prompt: 'ready' }, { config: selectedActive });
// @ts-expect-error Tool order also uses the matching branch's registry.
create.LLMAgent({ model, prompt: 'ready' }, { config: selectedOrder });

declare const selectedApproval: (SimpleRegistry & { toolApproval: { simple: 'approved'; missing: 'denied' } }) | SimpleRegistry;
declare const selectedRefinement: (SimpleRegistry & { experimental_refineToolInput: {
	simple: () => Record<string, never>; missing: () => Record<string, never>;
} }) | SimpleRegistry;
// @ts-expect-error A known entry cannot hide an unknown approval-map entry in one branch.
create.LLMAgent({ model, prompt: 'ready' }, { config: selectedApproval });
// @ts-expect-error Refiner-map names follow the same rule.
create.LLMAgent({ model, prompt: 'ready' }, { config: selectedRefinement });

const other = tool({ inputSchema: z.object({}), execute: () => 2 });
declare const selectedNames: (SimpleRegistry & { toolChoice: { type: 'tool'; toolName: 'simple' }; toolApproval: { simple: 'approved' } })
	| { tools: { other: typeof other }; activeTools: ['other']; toolOrder: ['other']; toolApproval: { other: 'denied' } };
create.LLMAgent({ model, prompt: 'ready' }, { config: selectedNames });
create.LLMAgent.asStream({ model, prompt: 'ready' }, { config: selectedNames });
create.LLMAgent.withTemplate({ model, prompt: 'ready' }, { config: selectedNames });
create.LLMAgent.withTemplate.asStream({ model, prompt: 'ready' }, { config: selectedNames });
create.LLMAgent.withFunction({ model, prompt: () => 'ready' }, { config: selectedNames });
create.LLMAgent.withTemplate({ model, prompt: 'ready' }, { config: { tools: { simple }, toolChoice: { type: 'tool', toolName: 'simple' } } });
create.LLMAgent.withTemplate.asStream({ model, prompt: 'ready' }, { config: { tools: { simple }, activeTools: ['simple'] } });
// @ts-expect-error Contextual parent selections still reject an undeclared tool name.
create.LLMAgent.withTemplate({ model, prompt: 'ready' }, { config: { tools: { simple }, toolChoice: { type: 'tool', toolName: 'missing' } } });
// @ts-expect-error Rendered modifiers retain the selected-parent guard.
create.LLMAgent.withTemplate({ model, prompt: 'ready' }, { config: selectedChoice });
// @ts-expect-error Function preparers retain it too.
create.LLMAgent.withFunction({ model, prompt: () => 'ready' }, { config: selectedChoice });

const withTools = create.LLMAgent({ model, prompt: 'ready', tools: { simple } });
declare const selectedRun: { toolApproval: { simple: 'approved'; missing: 'denied' } } | { temperature: number };
// @ts-expect-error Named calls retain branch-only callback-map checks after merging.
void withTools.run(selectedRun);
void withTools.run({ toolApproval: { simple: 'approved' } });
declare const selectedRunTools: { tools: { simple: typeof simple } } | { tools: { simple: typeof simple; missing: typeof simple } };
// @ts-expect-error A branch-only new tool is not a replacement of a configured name.
void withTools.run(selectedRunTools);
// @ts-expect-error The definite form has the same restriction.
void withTools.run({ tools: { simple, missing: simple } });
void withTools.run({ tools: { simple } });

export { simple, numericContext, text, other };






export { textOutput, numericOutput, choiceOutput, jsonOutput };
