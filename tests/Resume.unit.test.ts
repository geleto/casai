import assert from 'node:assert/strict';
import { generateText, streamText, tool, isStepCount } from 'ai';
import type { ModelMessage } from 'ai';
import { create, denyPendingApprovals, ValidationError, ConfigError, z } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';
import { pendingHistory, decision, parts, callDefinition } from './fixtures/approval-history.js';
import { mcpApprovalReplay } from './fixtures/openai-mcp.js';

describe('LLMAgent resume', () => {
	for (const streaming of [false, true]) {
		const factory = streaming ? create.LLMAgent.asStream : create.LLMAgent;
		it(`matches native mixed-approval execution and retains complete history, streaming=${streaming}`, async () => {
			const effects: string[] = [];
			const tools = { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: ({ key }) => { effects.push(key); return key; } }) };
			const provider = modelFor(undefined);
			const history = pendingHistory('a', 'b');
			history.push({ role: 'tool', content: [], providerOptions: { fixture: { marker: 'keep' } } });
			const original = structuredClone(history);
			const agent = factory({ model: provider, tools });
			const result = await agent.resume(Object.freeze(history), { approve: ['approve-a', 'approve-a'] });
			assert.equal(await result.output, 'done');
			const retained = await result.messageHistory;
			const response = await result.responseMessages;
			assert.deepEqual(effects, ['a']);
			assert.deepEqual(history, original);
			assert.equal(retained[0], history[0]);
			assert.equal(retained[1], history[1]);
			assert.deepEqual(parts(retained).filter(part => part.type === 'tool-approval-response'), [decision('a', true), decision('b', false)]);
			assert.ok(parts(response).some(part => part.type === 'tool-result' && part.toolCallId === 'b' && part.output.type === 'execution-denied'));
			assert.equal((await result.steps)[0].toolResults.length, 0);
			const nativeProvider = modelFor(undefined);
			const expected: ModelMessage[] = [...history.slice(0, -1), { ...history.at(-1)!, role: 'tool', content: [decision('a', true), decision('b', false)] }];
			const nativeSettings = { model: nativeProvider, tools, messages: expected };
			const native = streaming ? streamText(nativeSettings) : await generateText(nativeSettings);
			assert.equal(await native.output, await result.output);
			assert.deepEqual(response, await native.responseMessages);
			assert.deepEqual(streaming ? provider.doStreamCalls[0].prompt : provider.doGenerateCalls[0].prompt,
				streaming ? nativeProvider.doStreamCalls[0].prompt : nativeProvider.doGenerateCalls[0].prompt);
			assert.deepEqual(effects, ['a', 'a']);
			await agent.resume(retained);
			assert.deepEqual(effects, ['a', 'a']);
		});

		it(`uses current context/settings/hooks without rendering, streaming=${streaming}`, async () => {
			let renders = 0, parses = 0, executions = 0;
			const provider = modelFor(undefined);
			const unusedModel = modelFor(undefined);
			const context = { message: 'original', count: '3' };
			const source = create.LLMAgent.withFunction({ model: unusedModel,
				inputSchema: z.object({ message: z.string(), count: z.string().transform(value => { parses++; return Number(value); }) }),
				context: { message: 'configured', count: '1' }, prompt: values => { renders++; return values.message; },
				tools: { lookup: tool({ inputSchema: z.object({ key: z.string() }) }) },
			});
			const agent = factory({}, source);
			const result = await agent.resume(pendingHistory('a'), { context, approve: true, model: provider, timeout: 2000,
				prepareCall(request, config, parsed) {
					assert.equal(parsed.count, 3); assert.equal(parsed.message, 'original');
					assert.equal(config.context?.count, '3'); assert.equal(request.model, provider);
					assert.equal(request.timeout, 2000);
					for (const key of ['approve', 'context', 'prompt', 'messageHistory']) assert.equal(key in request, false);
					assert.equal('approve' in config, false);
					return { ...request, timeout: 5000, tools: { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: () => { executions++; return 'ok'; } }) } };
				}, prepareStep(step, _config, parsed) {
					assert.equal(step.stepNumber, 0); assert.equal(step.steps.length, 0);
					assert.equal(executions, 1); assert.equal(parsed.count, 3);
					assert.ok(parts(step.messages).some(part => part.type === 'tool-result'));
					return { model: provider };
				},
			});
			assert.equal(await result.output, 'done');
			assert.equal(renders, 0); assert.equal(parses, 1); assert.equal(executions, 1);
			assert.equal(source.config.context.count, '1'); assert.deepEqual(context, { message: 'original', count: '3' });
			assert.equal(unusedModel.doGenerateCalls.length + unusedModel.doStreamCalls.length, 0);
		});

		it(`retains per-tool context binding and caller cancellation, streaming=${streaming}`, async () => {
			const controller = new AbortController();
			let received: unknown;
			const lookup = create.Function.asTool({ inputSchema: z.object({ key: z.string() }), context: { prefix: 'configured' },
				toolContextSchema: z.object({ prefix: z.string() }), execute: ({ key, prefix, _toolOptions }) => {
					received = _toolOptions.abortSignal; return `${prefix}:${key}`;
				},
			});
			const agent = factory({ model: modelFor(undefined), tools: { lookup }, toolsContext: { lookup: { prefix: 'base' } } });
			const result = await agent.resume(pendingHistory('a'), { approve: true, toolsContext: { lookup: { prefix: 'current' } }, abortSignal: controller.signal });
			assert.equal(await result.output, 'done'); assert.equal(received, controller.signal);
			assert.ok(parts(await result.responseMessages).some(part => part.type === 'tool-result' && part.output.type === 'text' && part.output.value === 'current:a'));
			assert.equal(agent.config.toolsContext.lookup.prefix, 'base');
		});

		it(`consumes selectors before asynchronous preparation and isolates concurrent calls, streaming=${streaming}`, async () => {
			let release!: () => void;
			const gate = new Promise<void>(resolve => { release = resolve; });
			const effects: string[] = [];
			const agent = factory({ model: modelFor(undefined), tools: { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: ({ key }) => { effects.push(key); return key; } }) },
				prepareCall: async request => { await gate; return request; } });
			const history = pendingHistory('a', 'b');
			const selected = ['approve-a'];
			const first = agent.resume(history, { approve: selected });
			selected[0] = 'approve-b';
			const second = agent.resume(history, { approve: false });
			release();
			assert.equal(await (await first).output, 'done'); assert.equal(await (await second).output, 'done');
			assert.deepEqual(effects, ['a']); assert.equal(history.length, 2);
		});

		it(`allows hook-filled empty history and native final-request failure, streaming=${streaming}`, async () => {
			const provider = modelFor(undefined);
			const agent = factory({ model: provider });
			const result = await agent.resume([], { prepareCall: request => ({ ...request, messages: [{ role: 'user', content: 'Filled by hook.' }] }) });
			assert.equal(await result.output, 'done');
			assert.deepEqual(await result.messageHistory, await result.responseMessages);
			await assert.rejects(async () => { await (await agent.resume([], { onError: () => undefined })).output; });
			assert.equal(provider.doGenerateCalls.length + provider.doStreamCalls.length, 1);
		});

		it(`continues normally without tools or new decisions, streaming=${streaming}`, async () => {
			const provider = modelFor(undefined);
			let checks = 0;
			const agent = factory({ model: provider, stopWhen: () => { checks++; return true; } });
			for (const approve of [undefined, null, true, false, []]) {
				assert.equal(await (await agent.resume([{ role: 'user', content: 'Hello.' }], { approve })).output, 'done');
			}
			assert.equal(checks, 0); assert.equal(provider.doGenerateCalls.length + provider.doStreamCalls.length, 5);
		});

		it(`delegates undecided local work after hooks when approval is omitted/null, streaming=${streaming}`, async () => {
			let hooks = 0, effects = 0;
			const agent = factory({ model: modelFor(undefined), tools: { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: () => { effects++; return 'effect'; } }) },
				prepareCall: request => { hooks++; return request; }, onError: () => undefined });
			for (const approve of [undefined, null]) await assert.rejects(async () => { await (await agent.resume(pendingHistory('a'), { approve })).output; },
				error => !(error instanceof ValidationError));
			assert.equal(hooks, 2); assert.equal(effects, 0);
		});

		it(`honors embedded signed decisions under approve=[] and rechecks current policy, streaming=${streaming}`, async () => {
			let effects = 0;
			const tools = { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: () => { effects++; return 'effect'; } }) };
			const agent = factory({ model: modelFor({ key: 'a' }, 'lookup'), tools, toolApproval: { lookup: 'user-approval' }, experimental_toolApprovalSecret: 'fixture-secret' });
			const history = JSON.parse(JSON.stringify(await (await agent('Lookup.')).messageHistory)) as ModelMessage[];
			const request = parts(history).find(part => part.type === 'tool-approval-request');
			assert.ok(request?.type === 'tool-approval-request' && request.signature);
			history.push({ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: request.approvalId, approved: true }] });
			assert.equal(await (await agent.resume(history, { approve: [], model: modelFor(undefined) })).output, 'done');
			assert.equal(effects, 1);
			const denied = await agent.resume(history, { approve: [], model: modelFor(undefined), toolApproval: { lookup: 'denied' } });
			assert.equal(await denied.output, 'done'); assert.equal(effects, 1);
			assert.ok(parts(await denied.responseMessages).some(part => part.type === 'tool-result' && part.output.type === 'execution-denied'));
		});

		it(`leaves native partial effects and missing-call validation after hooks, streaming=${streaming}`, async () => {
			let effects = 0, hooks = 0;
			const agent = factory({ model: modelFor(undefined), tools: { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: () => { effects++; return 'effect'; } }) },
				prepareCall: request => { hooks++; return request; }, onError: () => undefined });
			const history = pendingHistory('approved');
			history.push({ role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'missing', toolName: 'lookup', input: { key: 'missing' } }] });
			await assert.rejects(async () => { await (await agent.resume(history, { approve: true })).output; });
			assert.equal(effects, 1); assert.equal(hooks, 1);
			const orphan: ModelMessage[] = [{ role: 'assistant', content: [{ type: 'tool-approval-request', approvalId: 'orphan', toolCallId: 'missing' }] }];
			await assert.rejects(async () => { await (await agent.resume(orphan, { approve: true })).output; });
			assert.equal(hooks, 2); assert.equal(effects, 1);
			const repaired = await agent.resume(orphan, { approve: true, prepareCall: request => ({ ...request, messages: [...pendingHistory('a'), { role: 'tool', content: [decision('a', false)] }] }) });
			assert.equal(await repaired.output, 'done');
		});

		it(`denies before shorthand/literal/rendered new turns without evaluating user text, streaming=${streaming}`, async () => {
			let effects = 0, expressions = 0;
			const provider = modelFor(undefined);
			const tools = { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: () => { effects++; return 'effect'; } }) };
			const source = create.LLMAgent.withTemplate({ model: provider, prompt: '{{ message }}', tools,
				inputSchema: z.object({ message: z.string() }), context: { tripwire: () => { expressions++; return 'evaluated'; } } });
			const agent = factory({}, source);
			const message = '{{ tripwire() }}';
			const settled = denyPendingApprovals([...pendingHistory('a', 'b'), { role: 'tool', content: [decision('a', false)] }], 'New request.');
			const shorthand = await factory({ model: provider, tools })(message, settled);
			const literal = await agent.resume([...settled, { role: 'user', content: message }], { context: { message } });
			const rendered = await agent.run({ messageHistory: settled, context: { message } });
			for (const result of [shorthand, literal, rendered]) {
				assert.equal(await result.output, 'done');
				assert.ok((await result.messageHistory).some(part => part.role === 'user' && part.content === message));
				assert.equal(parts(await result.responseMessages).filter(part => part.type === 'tool-result').length, 0);
			}
			const sent = streaming ? provider.doStreamCalls : provider.doGenerateCalls;
			assert.equal(sent.length, 3);
			for (const { prompt } of sent) assert.deepEqual(prompt.flatMap(entry => typeof entry.content === 'string' ? []
				: entry.content.flatMap(part => part.type === 'tool-result' ? [part.toolCallId] : [])), ['a', 'b']);
			assert.equal(effects, 0); assert.equal(expressions, 0);
		});

		for (const linked of [false, true]) it(`continues MCP approvals through completion and a later turn, streaming=${streaming}, linked=${linked}`, async () => {
			const replay = mcpApprovalReplay();
			const agent = factory({ model: replay.model, tools: replay.tools, maxRetries: 0 });
			const pending = await agent('Search.');
			const history = await pending.messageHistory;
			const request = parts(history).find(part => part.type === 'tool-approval-request');
			assert.ok(request?.type === 'tool-approval-request');
			if (linked) callDefinition(history, request.toolCallId).providerOptions = { openai: { approvalRequestId: request.approvalId } };
			const completed = await agent.resume(history, { approve: [request.approvalId] });
			assert.equal(await completed.output, 'done');
			const next = await agent.resume([...await completed.messageHistory, { role: 'user', content: 'Next.' }]);
			assert.equal(await next.output, 'done');
			assert.ok(replay.requests[1].input.some(part => part.type === 'mcp_approval_response' && part.approve === true));
			assert.equal(replay.requests.length, 3);
		});

		it(`forwards provider cancellation from the helper before a new turn, streaming=${streaming}`, async () => {
			const replay = mcpApprovalReplay({ complete: false });
			const agent = factory({ model: replay.model, tools: replay.tools, maxRetries: 0 });
			const history = await (await agent('Search.')).messageHistory;
			const denied = denyPendingApprovals(history);
			assert.equal(parts(denied).filter(part => part.type === 'tool-result').length, 0);
			const result = await agent.resume([...denied, { role: 'user', content: 'Different question.' }]);
			assert.equal(await result.output, 'done');
			assert.ok(replay.requests[1].input.some(part => part.type === 'mcp_approval_response' && part.approve === false));
			assert.ok(replay.requests[1].input.some(part => part.type === 'item_reference'));
		});
	}

	it('skips loaders and exposes resume only on non-tool inherited forms', async () => {
		let loads = 0;
		const loaded = create.LLMAgent.loadsText({ model: modelFor(undefined), prompt: 'missing', loader: { load: () => { loads++; throw new Error('Must not load'); } } });
		const inherited = create.LLMAgent({}, create.Config({}, loaded));
		assert.equal((await inherited.resume([{ role: 'user', content: 'Literal.' }])).output, 'done');
		assert.equal(loads, 0);
		const asTool = create.LLMAgent.asTool({ model: modelFor(undefined), prompt: 'Configured.', inputSchema: z.object({}) });
		assert.equal('resume' in asTool, false); assert.equal('resume' in create.LLMAgent({}, asTool), false);
	});

	it('rejects malformed or source-bearing inputs before context parsing and hooks', async () => {
		let parses = 0, hooks = 0;
		const agent = create.LLMAgent({ model: modelFor(undefined), inputSchema: z.object({}).transform(value => { parses++; return value; }),
			prepareCall: request => { hooks++; return request; } });
		const resume = agent.resume as (...args: unknown[]) => Promise<unknown>;
		for (const args of [[], [undefined], [null], [{}], [[{ role: 'invalid' }]], [[], {}, {}], [[], null], [[], 42],
			...['prompt', 'messageHistory', 'messages', 'options', 'output', 'inputSchema'].map(key => [[], { [key]: undefined }]),
			[[], Object.defineProperty({}, 'prompt', { value: undefined })],
			[[], { approve: 1 }], [pendingHistory('a'), { approve: ['missing'] }]]) await assert.rejects(resume(...args), ValidationError);
		const controller = new AbortController(); controller.abort(new Error('Canceled'));
		await assert.rejects(resume([], { abortSignal: controller.signal }), /Canceled/);
		assert.equal(parses, 0); assert.equal(hooks, 0);
		for (const approve of [true, undefined]) {
			const fragment = create.Config({ approve } as never);
			assert.throws(() => create.LLMAgent({ model: modelFor(undefined) }, fragment), ConfigError);
			assert.throws(() => create.LLMAgent({ model: modelFor(undefined), approve } as never), ConfigError);
			await assert.rejects(agent.run({ messageHistory: [], approve } as never), ValidationError);
		}
	});

	it('supports Cascada positional history with keyword settings and null decisions', async () => {
		const agent = create.LLMAgent({ model: modelFor(undefined), inputSchema: z.object({ topic: z.string() }) });
		const history: ModelMessage[] = [{ role: 'user', content: 'Hello.' }];
		for (const decision of ['none', 'true', 'false', '[]']) {
			const script = create.Script({ context: { agent, history }, script: `var result = agent.resume(history, approve=${decision}, context={topic: 'test'})\nreturn result.output` });
			assert.equal(await script(), 'done');
		}
		for (const call of ["agent.resume(history=history, context={topic:'test'})", "agent.resume(history, {}, approve=true)", 'agent.resume(history, {}, {})']) {
			await assert.rejects(create.Script({ context: { agent, history }, script: `return ${call}` })());
		}
	});

	it('starts fresh step counts with a current stopWhen override', async () => {
		const provider = modelFor({ key: 'fresh' }, 'lookup');
		const steps: number[] = [];
		const agent = create.LLMAgent({ model: provider, tools: { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: ({ key }) => key }) },
			stopWhen: isStepCount(1), prepareStep: step => { steps.push(step.stepNumber); } });
		const result = await agent.resume([{ role: 'user', content: 'Continue.' }], { stopWhen: isStepCount(2) });
		assert.equal(result.output, 'done'); assert.deepEqual(steps, [0, 1]); assert.equal(result.steps.length, 2);
		await agent.resume(result.messageHistory); assert.deepEqual(steps, [0, 1, 0]);
	});
});
