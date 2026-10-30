import assert from 'node:assert/strict';
import { convertToModelMessages, generateText, isStepCount, streamText, tool } from 'ai';
import type { UIMessage } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { z } from 'zod';

// SDK-only canary: result settlement must not depend on native approval-part ordering.
describe('Native provider approval ordering', () => {
	it('preserves automatic UI requests with and without recorded decisions', async () => {
		for (const approved of [undefined, true, false]) {
			const approval = approved === undefined
				? { state: 'approval-requested' as const, approval: { id: 'approval', isAutomatic: true } }
				: { state: 'approval-responded' as const, approval: { id: 'approval', isAutomatic: true, approved } };
			const messages: UIMessage[] = [{ id: 'assistant', role: 'assistant', parts: [
				{ type: 'tool-lookup', toolCallId: 'call', input: {}, ...approval },
			] }];
			const history = await convertToModelMessages(messages);
			assert.ok(history.some(message => message.role === 'assistant' && typeof message.content !== 'string' &&
				message.content.some(part => part.type === 'tool-approval-request' && part.approvalId === 'approval' && part.isAutomatic)));
			const responses = history.flatMap(message => message.role === 'tool' ? message.content : []);
			assert.deepEqual(responses.filter(part => part.type === 'tool-approval-response').map(part => part.approved),
				approved === undefined ? [] : [approved]);
		}
	});

	it('records an automatic approval with its own ID without scheduling a provider continuation', async () => {
		const model = new MockLanguageModelV3({ doGenerate: {
			content: [
				{ type: 'tool-call', toolCallId: 'call', toolName: 'lookup', input: '{}', providerExecuted: true },
				{ type: 'tool-approval-request', toolCallId: 'call', approvalId: 'provider-approval' },
				{ type: 'text', text: 'Waiting for approval.' },
			], finishReason: { unified: 'stop', raw: 'stop' }, warnings: [],
			usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
		} });
		let stopChecks = 0;
		const ceiling = isStepCount(20);
		const result = await generateText({ model, prompt: 'Search.',
			tools: { lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true, inputSchema: z.object({}), outputSchema: z.unknown() }) },
			toolApproval: () => 'approved', stopWhen: step => { stopChecks++; return ceiling(step); },
		});
		assert.equal(result.output, 'Waiting for approval.');
		assert.equal(model.doGenerateCalls.length, 1);
		assert.equal(stopChecks, 0);
		const parts = result.responseMessages.flatMap(message => typeof message.content === 'string' ? [] : [...message.content]);
		assert.equal(parts.some(part => part.type === 'tool-result'), false);
		const automatic = parts.find(part => part.type === 'tool-approval-request' && part.isAutomatic);
		assert.ok(automatic?.type === 'tool-approval-request');
		assert.notEqual(automatic.approvalId, 'provider-approval');
		const decisions = parts.filter(part => part.type === 'tool-approval-response');
		assert.deepEqual(decisions.map(part => part.approvalId), [automatic.approvalId]);
	});

	for (const streaming of [false, true]) for (const policy of ['generic', 'per-tool'] as const) for (const status of ['approved', 'user-approval'] as const) {
		it(`${streaming ? 'stream' : 'generate'}: ${policy} ${status} request around a completed deferred provider result`, async () => {
			const call = { type: 'tool-call' as const, toolCallId: 'call', toolName: 'lookup', input: '{"query":"test"}', providerExecuted: true };
			const output = { type: 'tool-result' as const, toolCallId: 'call', toolName: 'lookup', result: 'done' };
			const finishReason = { unified: 'stop' as const, raw: 'stop' };
			const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
			const model = new MockLanguageModelV3({
				doGenerate: { content: [call, output, { type: 'text', text: 'answer' }], finishReason, usage, warnings: [] },
				doStream: { stream: convertArrayToReadableStream([
					{ type: 'stream-start', warnings: [] }, call, output,
					{ type: 'text-start', id: 'text' }, { type: 'text-delta', id: 'text', delta: 'answer' }, { type: 'text-end', id: 'text' },
					{ type: 'finish', finishReason, usage },
				]) },
			});
			const settings = { model, prompt: 'Search.', tools: { lookup: tool({ type: 'provider', id: 'fixture.lookup', args: {},
				isProviderExecuted: true, supportsDeferredResults: true, inputSchema: z.object({ query: z.string() }), outputSchema: z.unknown() }) },
			toolApproval: policy === 'generic' ? () => status : { lookup: status } };
			const result = streaming ? streamText(settings) : await generateText(settings);
			assert.equal(await result.output, 'answer');
			const messages = await result.responseMessages;
			const parts = messages.flatMap(message => message.role === 'assistant' && typeof message.content !== 'string' ? message.content : []);
			const resultIndex = parts.findIndex(part => part.type === 'tool-result');
			const requestIndex = parts.findIndex(part => part.type === 'tool-approval-request' && !!part.isAutomatic === (status === 'approved'));
			assert.ok(resultIndex >= 0 && requestIndex >= 0);
			assert.equal(resultIndex < requestIndex, !streaming);
			assert.equal(messages.some(message => message.role === 'tool' && message.content.some(part => part.type === 'tool-approval-response' && part.approved)), status === 'approved');
		});
	}
	for (const kind of ['local', 'provider', 'deferred'] as const) for (const incoming of [false, true]) {
		it(`generation denial has a result: ${kind}, incoming=${incoming}`, async () => {
			let executions = 0;
			const providerExecuted = kind !== 'local';
			const call = { type: 'tool-call' as const, toolCallId: 'call', toolName: 'lookup', input: {}, providerExecuted };
			const model = new MockLanguageModelV3({ doGenerate: {
				content: [...incoming ? [] : [{ ...call, input: '{}' }], { type: 'text', text: 'answer' }],
				finishReason: { unified: 'stop', raw: 'stop' }, warnings: [],
				usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
			} });
			const result = await generateText({ model, tools: { lookup: providerExecuted
				? tool({ type: 'provider', id: 'fixture.lookup', args: {}, isProviderExecuted: true, supportsDeferredResults: kind === 'deferred', inputSchema: z.object({}), outputSchema: z.unknown() })
				: tool({ inputSchema: z.object({}), execute: () => { executions++; return 'done'; } }) },
			toolApproval: () => 'denied', messages: incoming ? [{ role: 'user', content: 'question' }, { role: 'assistant', content: [call,
				{ type: 'tool-approval-request', approvalId: 'approval', toolCallId: 'call' }] },
			{ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: 'approval', approved: false, providerExecuted }] }]
				: [{ role: 'user', content: 'question' }] });
			assert.equal(result.output, 'answer');
			assert.equal(executions, 0);
			const parts = result.responseMessages.flatMap(message => typeof message.content === 'string' ? [] : [...message.content]);
			assert.ok(parts.some(part => part.type === 'tool-result' && part.toolCallId === 'call' && part.output.type === 'execution-denied'));
			assert.equal(parts.some(part => part.type === 'tool-approval-request' && part.isAutomatic), !incoming);
			assert.equal(parts.some(part => part.type === 'tool-approval-response' && !part.approved), !incoming);
		});
	}
});
