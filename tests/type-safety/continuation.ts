import { create, denyPendingApprovals, z } from 'casai';
import { Output, isStepCount, tool } from 'ai';
import type { Agent, LanguageModel, ModelMessage } from 'ai';
import { expectEqual, expectType } from './assert.js';

declare const model: LanguageModel;
declare const history: readonly ModelMessage[];
declare const approval: boolean | readonly string[] | null | undefined;
const agent = create.LLMAgent({ model });
void agent.resume(history);
void agent.resume(history, undefined);
void agent.resume(history, { approve: approval });
void agent.resume(history, { approve: ['a', 'a'] as const, model, stopWhen: isStepCount(3), timeout: 1000 });
expectType<Agent>(agent);
const _continued = agent.resume(history, { prepareCall: request => request });
expectEqual<Awaited<typeof _continued>['output'], string>();

const defaults = create.LLMAgent.withTemplate({ model, prompt: '{{ question }}', context: { language: 'en', privateService: () => 42 },
	inputSchema: z.object({ question: z.string(), language: z.string(), count: z.string().transform(Number).optional() }) });
void defaults.resume(history, { context: { question: 'Why?', count: '3' }, prepareCall(request, config, context) {
	expectEqual<typeof context.question, string>();
	expectEqual<typeof context.count, number | undefined>();
	expectType<string | undefined>(config.context?.count);
	expectType<() => number>(context.privateService);
	// @ts-expect-error Approval selection is not an editable model request field.
	expectType<unknown>(request.approve);
	// @ts-expect-error Approval selection is not part of resolved configuration.
	expectType<unknown>(config.approve);
	return request;
}, prepareStep(step, _config, context) {
	expectType<number>(step.stepNumber);
	expectEqual<typeof context.question, string>();
	expectType<number | undefined>(context.count);
	return { model };
} });
// @ts-expect-error Required context remains required when rendering is skipped.
void defaults.resume(history);
// @ts-expect-error Required context is not satisfied by an undefined options object.
void defaults.resume(history, undefined);
// @ts-expect-error Required context is not satisfied by approval selection.
void defaults.resume(history, { approve: true });
// @ts-expect-error Context schemas still describe raw inputs.
void defaults.resume(history, { context: { question: 'Why?', count: 3 } });
// @ts-expect-error Private dependencies cannot be replaced by caller input.
void defaults.resume(history, { context: { question: 'Why?', privateService: () => 0 } });
const contextUnion = Math.random() ? { question: 'Why?' } : { question: 'Why?', extra: 42 };
// @ts-expect-error Every context union member must be valid.
void defaults.resume(history, { context: contextUnion });
const componentUnion = Math.random() ? agent : defaults;
// @ts-expect-error A possible component requires context; narrow before calling.
void componentUnion.resume(history);
// @ts-expect-error A union of components cannot hide invalid context.
void componentUnion.resume(history, { context: contextUnion });

const configured = create.LLMAgent({ context: { question: 'Configured.' } }, create.Config({}, defaults));
void configured.resume(history, { approve: null });
const streamed = create.LLMAgent.asStream({ output: Output.object({ schema: z.object({ count: z.number() }) }) }, configured);
const _streaming = streamed.resume(history, { onError: () => undefined });
expectEqual<Awaited<Awaited<typeof _streaming>['output']>, { count: number }>();
expectEqual<Awaited<typeof _streaming>['messageHistory'], Promise<ModelMessage[]>>();
const _inherited = create.LLMAgent({}, create.Config({}, streamed));
expectEqual<Awaited<ReturnType<typeof _inherited.resume>>['messageHistory'], Promise<ModelMessage[]>>();

const lookup = create.Function.asTool({ context: { prefix: 'base' }, inputSchema: z.object({ key: z.string() }),
	toolContextSchema: z.object({ prefix: z.string() }), execute: ({ key, prefix }) => prefix + key });
const withTools = create.LLMAgent({ model, tools: { lookup }, toolsContext: { lookup: { prefix: 'base' } } });
void withTools.resume(history, { toolsContext: { lookup: { prefix: 'current' } }, tools: { lookup }, activeTools: ['lookup'] });
void withTools.resume(history, { tools: { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: ({ key }) => key }) } });
// @ts-expect-error Tool context still requires its declared input.
void withTools.resume(history, { toolsContext: { lookup: { prefix: 1 } } });
// @ts-expect-error Run settings can only replace configured tools.
void withTools.resume(history, { tools: { unknown: lookup } });
// @ts-expect-error Selection names remain checked.
void withTools.resume(history, { activeTools: ['unknown'] });

const asTool = create.LLMAgent.asTool({ model, prompt: 'Answer.', inputSchema: z.object({}) });
// @ts-expect-error A tool cannot be resumed.
expectType<unknown>(asTool.resume);
const inheritedTool = create.LLMAgent({}, create.Config({}, asTool));
// @ts-expect-error Inherited tool forms also have no resume method.
expectType<unknown>(inheritedTool.resume);
// @ts-expect-error History is positional and required.
void agent.resume();
// @ts-expect-error Options cannot replace positional history.
void agent.resume({ messageHistory: history });
// @ts-expect-error Message shapes remain checked for readonly inputs.
void agent.resume([{ role: 'invalid' }] as const);
// @ts-expect-error Extra arguments are not supported.
void agent.resume(history, {}, {});
// @ts-expect-error Approval IDs must be strings.
void agent.resume(history, { approve: [1] });
// @ts-expect-error No approval value coercion.
void agent.resume(history, { approve: 'true' });
// @ts-expect-error Ordinary calls do not accept approval settings.
void agent.run({ messageHistory: history, approve: true });
// @ts-expect-error Approval settings are not reusable configuration.
create.Config({ approve: undefined });
// @ts-expect-error Approval settings are not agent configuration.
create.LLMAgent({ model, approve: true });

const badSource = { prompt: undefined };
// @ts-expect-error Excluded own keys reject even through variables and explicit undefined.
void agent.resume(history, badSource);
// @ts-expect-error Positional history is the sole source field.
void agent.resume(history, { messageHistory: undefined });
// @ts-expect-error Native messages spelling is not a Casai resume option.
void agent.resume(history, { messages: undefined });
// @ts-expect-error Context uses the Casai spelling.
void agent.resume(history, { options: undefined });
// @ts-expect-error Fixed output is not replaceable.
void agent.resume(history, { output: undefined });
// @ts-expect-error External results use native history parts.
void agent.resume(history, { toolResults: [] });
// @ts-expect-error Application values are not top-level settings.
void defaults.resume(history, { context: { question: 'Why?' }, language: 'fr' });

const _denied = denyPendingApprovals(history, 'New turn.');
expectEqual<typeof _denied, ModelMessage[]>();
void denyPendingApprovals(history);
void denyPendingApprovals(history, undefined);
// @ts-expect-error Denial reasons must be strings.
denyPendingApprovals(history, null);
// @ts-expect-error History must be supplied.
denyPendingApprovals();
// @ts-expect-error Message validation remains typed.
denyPendingApprovals([42]);
