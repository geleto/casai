import assert from 'node:assert/strict';
import { generateText, isStepCount, streamText, tool } from 'ai';
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import { mcpApprovalReplay } from './fixtures/openai-mcp.js';

// SDK-only upgrade canary: reassess Casai provider approval settlement if this mapping changes.
describe('Native OpenAI MCP history', () => {
	it('step-hook decisions reach the provider but are absent from the response log', async () => {
		const replay = mcpApprovalReplay({ bridge: true });
		let executions = 0;
		const result = await generateText({ model: replay.model, prompt: 'Search.', maxRetries: 0, stopWhen: isStepCount(2),
			tools: { ...replay.tools, bridge: tool({ inputSchema: z.object({}), execute: () => { executions++; return 'next'; } }) },
			prepareStep: ({ stepNumber, messages }) => stepNumber === 1 ? { messages: [...messages, { role: 'tool', content: [
				{ type: 'tool-approval-response', approvalId: 'mcpr_fixture', approved: true, providerExecuted: true },
			] }] } : undefined,
		});
		assert.equal(result.output, 'done');
		assert.equal(executions, 1);
		assert.equal(result.steps.length, 2);
		assert.equal(replay.requests.length, 2);
		assert.deepEqual(replay.requests[1].input.filter(part => part.type === 'mcp_approval_response'), [
			{ type: 'mcp_approval_response', approval_request_id: 'mcpr_fixture', approve: true },
		]);
		assert.ok(!result.responseMessages.some(message => message.role === 'tool' && message.content.some(part => part.type === 'tool-approval-response')));
		const callIds = result.responseMessages.flatMap(message => message.role === 'assistant' && typeof message.content !== 'string'
			? message.content.flatMap(part => part.type === 'tool-call' && part.toolName === 'mcp.search' ? [part.toolCallId] : []) : []);
		assert.equal(callIds.length, 2);
		assert.notEqual(callIds[0], callIds[1]);
	});
	for (const streaming of [false, true]) for (const state of ['default', 'stored', 'stateless', 'previous'] as const) {
		for (const approved of [false, true]) {
			it(`${streaming ? 'stream' : 'generate'}: MCP decision transport with ${state} state and approved=${approved}`, async () => {
				const replay = mcpApprovalReplay({ complete: approved });
				const openai = state === 'stateless' ? { store: false } : state === 'stored' ? { store: true } : {};
				const messages: ModelMessage[] = [{ role: 'user', content: 'Search.' }];
				const settings = { model: replay.model, tools: replay.tools, messages, maxRetries: 0, providerOptions: { openai } };
				const first = streaming ? streamText(settings) : await generateText(settings);
				const history = [...messages, ...await first.responseMessages];
				const approval = history.flatMap(message => message.role === 'assistant' && typeof message.content !== 'string' ? message.content : [])
					.find(part => part.type === 'tool-approval-request');
				assert.ok(approval);
				const previousResponseId = (await first.response).id;
				assert.ok(previousResponseId);
				const continuation = { ...settings, messages: [...history, { role: 'tool' as const, content: [
					{ type: 'tool-approval-response' as const, approvalId: approval.approvalId, approved, providerExecuted: true },
				] }], providerOptions: { openai: { ...openai, ...(state === 'previous' ? { previousResponseId } : {}) } } };
				const second = streaming ? streamText(continuation) : await generateText(continuation);
				await second.responseMessages;
				const request = replay.requests[1];
				assert.equal(request.store, state === 'stateless' ? false : state === 'stored' ? true : undefined);
				assert.equal(request.previous_response_id, state === 'previous' ? previousResponseId : undefined);
				assert.deepEqual(request.input.filter(part => part.type === 'item_reference'),
					state === 'default' || state === 'stored' ? [{ type: 'item_reference', id: approval.approvalId }] : []);
				assert.deepEqual(request.input.filter(part => part.type === 'mcp_approval_response'), [
					{ type: 'mcp_approval_response', approval_request_id: approval.approvalId, approve: approved },
				]);
				// Missing prior state under store:false is a native transport limitation,
				// not a fixture claim that the live service accepts this continuation.
				assert.ok(!request.input.some(part => part.type === 'mcp_approval_request'));
				assert.equal(replay.requests.length, 2);
			});
		}
	}

	for (const streaming of [false, true]) for (const store of [false, true]) for (const denied of [false, true]) {
		// store:false denial success below characterizes local output logic only.
		it(`${streaming ? 'stream' : 'generate'}: a new user turn after ${denied ? 'denied' : 'ignored'} MCP approval with store=${store}`, async () => {
			const replay = mcpApprovalReplay({ complete: false });
			async function run(messages: ModelMessage[]) {
				const settings = { model: replay.model, tools: replay.tools, messages, maxRetries: 0, providerOptions: { openai: { store } } };
				const result = streaming ? streamText(settings) : await generateText(settings);
				return { result, history: [...messages, ...await result.responseMessages] };
			}
			const first = await run([{ role: 'user', content: 'Search.' }]);
			const approval = first.history.flatMap(message => message.role === 'assistant' && typeof message.content !== 'string' ? message.content : [])
				.find(part => part.type === 'tool-approval-request');
			assert.ok(approval);
			const messages = [...first.history];
			if (denied) messages.push({ role: 'tool', content: [
				{ type: 'tool-approval-response', approvalId: approval.approvalId, approved: false, providerExecuted: true },
			] });
			messages.push({ role: 'user', content: 'Different question.' });
			const second = await run(messages);
			assert.equal(await second.result.output, 'done');
			const decisions = replay.requests[1].input.filter(part => part.type === 'mcp_approval_response');
			assert.equal(decisions.length, denied ? 1 : 0);
			if (denied) assert.equal(decisions[0].approve, false);
			else assert.deepEqual(replay.requests[1].input.map(part => part.role), ['user', 'user']);
			const third = await run([...second.history, { role: 'user', content: 'Next question.' }]);
			assert.equal(await third.result.output, 'done');
			assert.equal(replay.requests.length, 3);
		});
	}

	for (const streaming of [false, true]) for (const linked of [false, true]) {
		it(`${streaming ? 'stream' : 'generate'}: MCP completion IDs with linkage=${linked}`, async () => {
			const replay = mcpApprovalReplay();
			async function run(messages: ModelMessage[]) {
				const settings = { model: replay.model, tools: replay.tools, messages, maxRetries: 0 };
				const result = streaming ? streamText(settings) : await generateText(settings);
				return { result, history: [...messages, ...await result.responseMessages] };
			}
			const first = await run([{ role: 'user', content: 'Search.' }]);
			const parts = first.history.flatMap(message => message.role === 'assistant' && typeof message.content !== 'string' ? message.content : []);
			const call = parts.find(part => part.type === 'tool-call');
			const approval = parts.find(part => part.type === 'tool-approval-request');
			assert.ok(call && approval);
			assert.equal(call.providerExecuted, true);
			assert.equal(call.providerOptions?.openai?.approvalRequestId, undefined);
			if (linked) call.providerOptions = { openai: { approvalRequestId: approval.approvalId } };
			const second = await run([...first.history, { role: 'tool', content: [
				{ type: 'tool-approval-response', approvalId: approval.approvalId, approved: true, providerExecuted: true },
			] }]);
			const completed = (await second.result.content).find(part => part.type === 'tool-call');
			assert.ok(completed);
			assert.equal(completed.providerExecuted, true);
			assert.equal(completed.toolCallId, linked ? call.toolCallId : 'mcp_executed');
			assert.equal(completed.toolCallId === call.toolCallId, linked);
			assert.equal(await second.result.finishReason, 'stop');
			assert.equal(await second.result.output, 'done');
			assert.ok(replay.requests[1].input.some(part => part.type === 'mcp_approval_response' && part.approve === true));
			const third = await run([...second.history, { role: 'user', content: 'Next question.' }]);
			assert.equal(await third.result.output, 'done');
			assert.equal(replay.requests.length, 3);
		});
	}
});
