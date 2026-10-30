import { create, z } from 'casai';
import { generateText, streamText, tool, Output } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import { expectEqual } from './assert.js';

declare const model: LanguageModel;
const fixedOutput = create.LLMAgent({ model, output: Output.object({ schema: z.object({ answer: z.number() }) }) });
const readonlyHistory: readonly ModelMessage[] = Object.freeze([{ role: 'user', content: 'Earlier.' }]);
void fixedOutput('Next.', readonlyHistory);
void fixedOutput('Next.', {}, readonlyHistory);
void fixedOutput.run({ messageHistory: readonlyHistory });
const readonlyChat = create.LLMAgent.withFunction({ model, inputSchema: z.object({ question: z.string() }), prompt: ({ question }) => question });
void readonlyChat({ question: 'Next.' }, readonlyHistory);
void readonlyChat(undefined, { question: 'Next.' }, readonlyHistory);
void readonlyChat(context => context.question, { question: 'Next.' }, readonlyHistory);
void readonlyChat.run({ context: { question: 'Next.' }, messageHistory: readonlyHistory });
const readonlyStream = create.LLMAgent.withFunction.asStream({}, readonlyChat);
void readonlyStream({ question: 'Next.' }, readonlyHistory);
void readonlyStream.run({ context: { question: 'Next.' }, messageHistory: readonlyHistory });
const readonlyTool = create.LLMAgent.withFunction.asTool({}, readonlyChat);
void readonlyTool({ question: 'Next.' }, readonlyHistory);
void readonlyTool.run({ context: { question: 'Next.' }, messageHistory: readonlyHistory });
// @ts-expect-error Readonly history does not supply required application context.
void readonlyChat({}, readonlyHistory);
// @ts-expect-error Named calls retain context requiredness.
void readonlyChat.run({ messageHistory: readonlyHistory });
// @ts-expect-error Readonly input does not relax the message shape.
void fixedOutput('Next.', [42] as const);
// @ts-expect-error Named history retains message validation.
void fixedOutput.run({ messageHistory: [42] as const });
// @ts-expect-error Native SDK message parameters retain their own mutable-array contract.
void fixedOutput.generate({ messages: readonlyHistory });
// @ts-expect-error Streaming native methods retain the same SDK contract.
void fixedOutput.stream({ messages: readonlyHistory });
// @ts-expect-error The literal prompt source type is unchanged.
void fixedOutput(readonlyHistory);
// @ts-expect-error Named prompt source types are unchanged too.
void fixedOutput.run({ prompt: readonlyHistory });
void fixedOutput.generate({ messages: [] });
void fixedOutput.stream({ messages: [] });
// @ts-expect-error Native TypeScript callers still supply a source, even when a hook can fill empty messages.
void fixedOutput.generate({});
// @ts-expect-error Runtime acceptance of missing sources does not broaden the native stream type.
void fixedOutput.stream({});
// @ts-expect-error Native source alternatives remain exclusive.
void fixedOutput.generate({ prompt: 'Answer.', messages: [] });
// @ts-expect-error Streaming keeps the same source exclusivity.
void fixedOutput.stream({ prompt: 'Answer.', messages: [] });
// @ts-expect-error Native methods cannot replace a component's fixed output contract.
void fixedOutput.generate({ prompt: 'Answer.', output: Output.text() });
// @ts-expect-error Streaming uses the same fixed configuration boundary.
void fixedOutput.stream({ prompt: 'Answer.', inputSchema: z.object({}) });
const changedContract = { prompt: 'Answer.', output: Output.text() };
// @ts-expect-error Passing a variable must not bypass the fixed-setting boundary.
void fixedOutput.generate(changedContract);
// @ts-expect-error A forbidden field stays forbidden when explicitly undefined.
void fixedOutput.stream({ prompt: 'Answer.', output: undefined });
// @ts-expect-error Native Agent methods do not expose model overrides.
void fixedOutput.generate({ prompt: 'Answer.', model: 42 });
// @ts-expect-error Unknown native settings must not bypass generic argument checking.
void fixedOutput.stream({ prompt: 'Answer.', temperature: 'hot' });
// @ts-expect-error Native methods use options as the application-input entry point.
void fixedOutput.generate({ prompt: 'Answer.', context: {} });
const extraNativeSettings = { prompt: 'Answer.', prepareCall: () => ({ model, messages: [] }) };
// @ts-expect-error Per-call hook replacement belongs to .run().
void fixedOutput.stream(extraNativeSettings);
// @ts-expect-error Stream transforms are not generation-method parameters.
void fixedOutput.generate({ prompt: 'Answer.', experimental_transform: () => new TransformStream() });
const lookup = tool({ inputSchema: z.object({ query: z.string() }), execute: ({ query }) => query });
const tools = { lookup };
// @ts-expect-error A new native registry would contradict the declared tool-result types.
void fixedOutput.generate({ prompt: 'Answer.', tools });

const hookParent = create.Config({ model, inputSchema: z.looseObject({ detail: z.enum(['brief', 'deep']), amount: z.string().transform(Number) }),
	context: { detail: 'brief' as const, amount: '1', db: { ready: true } } });
const contextualHook = create.LLMAgent({ prepareCall(request, config, _context) {
	if (config.context) {
		expectEqual<NonNullable<typeof config.context.detail>, 'brief' | 'deep'>();
		expectEqual<NonNullable<typeof config.context.amount>, string>();
		expectEqual<typeof config.context.db.ready, boolean>();
	}
	expectEqual<typeof _context.amount, number>();
	return request;
}, prepareStep(_step, config) {
	if (config.context?.detail === 'deep') return { temperature: 0 };
	return undefined;
} }, hookParent);
void contextualHook.run({ prompt: 'Answer.', context: { detail: 'deep', amount: '2' } });
create.LLMAgent({ model, context: { token: 'private' }, prepareCall(request, config) {
	if (config.context) expectEqual<typeof config.context.token, string>();
	return request;
} });

void generateText({ model, prompt: 'Find it.', tools, toolApproval: { lookup: 'user-approval' } });
const approved = create.LLMAgent({ model, tools, toolApproval: { lookup: 'user-approval' } });
expectEqual<typeof approved.config.toolApproval.lookup, 'user-approval'>();
create.LLMAgent.asStream({ model, tools, toolApproval: { lookup: { type: 'denied', reason: 'Policy' } } });
create.LLMAgent({ toolApproval: { lookup: 'approved' } }, create.Config({ model, tools }));
create.LLMAgent({ model, tools, toolApproval: { lookup: (input, _options) => {
	expectEqual<typeof input.query, string>();
	expectEqual<typeof _options.toolCallId, string>();
	return 'approved';
} } });
// @ts-expect-error An invalid status is distinct from an unknown tool name.
create.LLMAgent({ model, tools, toolApproval: { lookup: 'invalid' } });
// @ts-expect-error This valid status must fail specifically because missing is not a tool.
create.LLMAgent({ model, tools, toolApproval: { lookup: 'approved', missing: 'approved' } });

const selected = create.LLMAgent({ model, prompt: 'Find it.', tools, activeTools: ['lookup'] });
const chosen = create.LLMAgent({ model, prompt: 'Find it.', tools, toolChoice: { type: 'tool', toolName: 'lookup' } });
// @ts-expect-error Removing a tool invalidates inherited activeTools.
void selected.run({ tools: { lookup: null } });
// @ts-expect-error Supplied selectors also use the final registry.
void selected.run({ tools: { lookup: null }, activeTools: ['lookup'] });
// @ts-expect-error Removing a tool invalidates inherited toolChoice.
void chosen.run({ tools: { lookup: undefined } });
// @ts-expect-error Undefined call settings inherit; they do not clear the old selector.
void selected.run({ tools: { lookup: null }, activeTools: undefined });
declare const maybeClear: readonly [] | undefined;
// @ts-expect-error The undefined alternative retains the stale configured selector.
void selected.run({ tools: { lookup: null }, activeTools: maybeClear });
void selected.run({ tools: { lookup: null }, activeTools: [] });
void chosen.run({ tools: { lookup: null }, toolChoice: 'none' });
void selected.run({ tools: { lookup }, activeTools: ['lookup'] });

const ordered = create.LLMAgent({ model, prompt: 'Find it.', tools, toolOrder: ['lookup'] });
// @ts-expect-error Ordering cannot retain a removed tool.
void ordered.run({ tools: { lookup: null } });
void ordered.run({ tools: { lookup: null }, toolOrder: [] });
const timed = create.LLMAgent({ model, prompt: 'Find it.', tools, timeout: { tools: { lookupMs: 50 } } });
// @ts-expect-error Per-tool timeout keys refer to the final registry.
void timed.run({ tools: { lookup: null } });
void timed.run({ tools: { lookup: null }, timeout: { totalMs: 500 } });
// @ts-expect-error A valid key cannot hide an additional stale timeout key.
create.LLMAgent({ model, tools, timeout: { tools: { lookupMs: 50, missingMs: 50 } } });
// @ts-expect-error Constructor inheritance checks the final registry too.
create.LLMAgent({ tools: { lookup: null } }, timed);
create.LLMAgent({ tools: { lookup: null }, timeout: {} }, timed);
const callers = create.LLMAgent({ model, prompt: 'Find it.', tools, experimental_toolCallers: { lookup: ['AI_SDK_DIRECT_TOOL_CALL'] } });
// @ts-expect-error Caller maps must not retain the name of a removed tool.
void callers.run({ tools: { lookup: null } });
void callers.run({ tools: { lookup: null }, experimental_toolCallers: {} });
// @ts-expect-error Known map entries must not conceal an unknown entry.
create.LLMAgent({ model, tools, experimental_toolCallers: { lookup: ['AI_SDK_DIRECT_TOOL_CALL'], missing: [] } });
// @ts-expect-error Undefined approval overrides keep the configured policy.
void approved.run({ prompt: 'Find it.', tools: { lookup: null }, toolApproval: undefined });

const contextual = tool({ inputSchema: z.object({ query: z.string() }), contextSchema: z.object({ tenant: z.string() }), execute: ({ query }) => query });
// @ts-expect-error Native requests require the context of the declared tool set.
streamText({ model, prompt: 'Find it.', tools: { contextual } });
create.LLMAgent({ model, tools: { contextual }, toolsContext: { contextual: { tenant: 'a' } },
	prepareCall: request => ({ model: request.model, messages: request.messages, tools: { contextual }, toolsContext: request.toolsContext }),
});
// @ts-expect-error A replacement request cannot drop required tool context.
create.LLMAgent({ model, tools: { contextual }, toolsContext: { contextual: { tenant: 'a' } }, prepareCall: request => ({ model: request.model, messages: request.messages, tools: { contextual } }) });
const optionalContext = create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.object({ tenant: z.string() }).optional(), execute: () => 'ok' });
create.LLMAgent({ model, tools: { optionalContext }, prepareCall: request => ({ model: request.model, messages: request.messages, tools: { optionalContext } }) });
create.LLMAgent({ model, tools, prepareCall: request => ({ model: request.model, messages: request.messages, tools }) });

// A native continuation uses configuration for settings beyond the Agent call surface.
const pausedRenderer = create.LLMAgent.withFunction({ model, tools: { contextual }, toolsContext: { contextual: { tenant: 'default' } },
	inputSchema: z.object({ message: z.string() }), prompt: ({ message }) => message });
const messages = [{ role: 'user' as const, content: 'Search.' }];
const options = { message: 'Search.' };
const savedSettings = { toolsContext: { contextual: { tenant: 'turn' } }, runtimeContext: { role: 'reviewer' },
	toolApproval: { contextual: 'user-approval' as const }, providerOptions: { anthropic: { container: { id: 'container_fixture' } } } };
void pausedRenderer.run({ context: options, ...savedSettings });
const continuation = create.LLMAgent(savedSettings, pausedRenderer);
void continuation.generate({ messages, options, timeout: 5000 });
void continuation.stream({ messages, options, experimental_transform: () => new TransformStream() });
// @ts-expect-error Native call parameters cannot carry trusted tool context.
void pausedRenderer.generate({ messages, options, toolsContext: savedSettings.toolsContext });
// @ts-expect-error Native streaming has the same tool-context restriction.
void pausedRenderer.stream({ messages, options, toolsContext: savedSettings.toolsContext });
// @ts-expect-error Native call parameters cannot replace runtime context.
void pausedRenderer.generate({ messages, options, runtimeContext: savedSettings.runtimeContext });
// @ts-expect-error Native streaming cannot replace runtime context.
void pausedRenderer.stream({ messages, options, runtimeContext: savedSettings.runtimeContext });
// @ts-expect-error Native calls use the configured approval policy.
void pausedRenderer.generate({ messages, options, toolApproval: savedSettings.toolApproval });
// @ts-expect-error Native streaming uses the configured approval policy.
void pausedRenderer.stream({ messages, options, toolApproval: savedSettings.toolApproval });
// @ts-expect-error Per-call provider options belong to run() or continuation configuration.
void pausedRenderer.generate({ messages, options, providerOptions: savedSettings.providerOptions });
// @ts-expect-error Native streaming also has no providerOptions override.
void pausedRenderer.stream({ messages, options, providerOptions: savedSettings.providerOptions });
