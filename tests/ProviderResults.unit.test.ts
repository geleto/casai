import assert from 'node:assert/strict';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { NoObjectGeneratedError, Output } from 'ai';
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import { create } from './cascada';
import { mcpApprovalReplay } from './fixtures/openai-mcp.js';

// Exercise the installed HTTP adapters, including their schemas and finish-reason mappings.
// Every provider has a fake fetch and a fake key; these tests make no network requests.
type Block = { type: string } & Record<string, unknown>;
interface RequestBody { stream?: boolean, messages?: unknown[], container?: string }

function eventResponse(events: Record<string, unknown>[], done = false): Response {
	return new Response(events.map(event => `${typeof event.type === 'string' ? `event: ${event.type}\n` : ''}data: ${JSON.stringify(event)}\n\n`).join('')
		+ (done ? 'data: [DONE]\n\n' : ''), { headers: { 'content-type': 'text/event-stream' } });
}

function anthropicResponse(content: Block[], stopReason: string, streaming: boolean): Response {
	const message = { id: 'msg_fixture', type: 'message', role: 'assistant', model: 'claude-sonnet-4-20250514',
		content, stop_reason: stopReason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 20 } };
	if (!streaming) return Response.json(message);
	const events: Record<string, unknown>[] = [{ type: 'message_start', message: { ...message, content: [], stop_reason: null } }];
	for (const [index, block] of content.entries()) {
		events.push({ type: 'content_block_start', index, content_block: block.type === 'text' ? { type: 'text', text: '' }
			: block.type === 'server_tool_use' ? { ...block, input: {} } : block });
		if (block.type === 'text') events.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } });
		if (block.type === 'server_tool_use') events.push({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } });
		events.push({ type: 'content_block_stop', index });
	}
	return eventResponse([...events, { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: message.usage }, { type: 'message_stop' }]);
}

function anthropicReplay(stopReason: 'pause_turn' | 'end_turn', pending = false) {
	const requests: RequestBody[] = [];
	const content: Block[] = [
		{ type: 'text', text: 'Let me search for that.' },
		{ type: 'server_tool_use', id: 'srvtoolu_fixture', name: 'web_search', input: { query: 'question' } },
		...pending ? [] : [{ type: 'web_search_tool_result', tool_use_id: 'srvtoolu_fixture', content: [
			{ type: 'web_search_result', url: 'https://example.test/result', title: 'Result', page_age: null, encrypted_content: 'encrypted-source' },
		] }],
		{ type: 'text', text: stopReason === 'pause_turn' ? 'Let me refine the search.' : 'The answer is 42.' },
	];
	const provider = createAnthropic({ apiKey: 'fixture', fetch: async (_url, init) => {
		assert.ok(typeof init?.body === 'string');
		const request = JSON.parse(init.body) as RequestBody;
		requests.push(request);
		return anthropicResponse(requests.length === 1 ? content : [{ type: 'text', text: 'Complete.' }],
			requests.length === 1 ? stopReason : 'end_turn', request.stream === true);
	} });
	return { provider, model: provider('claude-sonnet-4-20250514'), tools: { web_search: provider.tools.webSearch_20250305() }, requests };
}

function openAIChatReplay(refusal: boolean) {
	const requests: RequestBody[] = [];
	const provider = createOpenAI({ apiKey: 'fixture', fetch: async (_url, init) => {
		assert.ok(typeof init?.body === 'string');
		const request = JSON.parse(init.body) as RequestBody;
		requests.push(request);
		const response = { id: 'chatcmpl_fixture', created: 1, model: 'gpt-4o', usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } };
		const refused = refusal ? { refusal: 'I cannot help with that.' } : {};
		if (!request.stream) return Response.json({ ...response, object: 'chat.completion',
			choices: [{ index: 0, message: { role: 'assistant', content: null, ...refused }, finish_reason: 'stop' }],
		});
		return eventResponse([
			{ ...response, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: '', ...refused }, finish_reason: null }] },
			{ ...response, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
		], true);
	} });
	return { model: provider.chat('gpt-4o'), requests };
}

function openAIResponsesReplay() {
	const requests: RequestBody[] = [];
	const provider = createOpenAI({ apiKey: 'fixture', fetch: async (_url, init) => {
		assert.ok(typeof init?.body === 'string');
		const request = JSON.parse(init.body) as RequestBody;
		requests.push(request);
		const output = ['commentary', 'final_answer'].map((phase, index) => ({ type: 'message', id: `msg_${index}`, role: 'assistant',
			status: 'completed', phase, content: [{ type: 'output_text', text: index === 0 ? 'Checking.' : 'Complete.', annotations: [] }],
		}));
		const response = { id: 'resp_fixture', object: 'response', created_at: 1, model: 'gpt-4.1', status: 'completed', error: null,
			incomplete_details: null, output, usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 } };
		if (!request.stream) return Response.json(response);
		return eventResponse([
			{ type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
			...output.flatMap((item, index) => [
				{ type: 'response.output_item.added', output_index: index, item: { ...item, status: 'in_progress', content: [] } },
				{ type: 'response.output_text.delta', output_index: index, item_id: item.id, content_index: 0, delta: item.content[0].text },
				{ type: 'response.output_item.done', output_index: index, item },
			]),
			{ type: 'response.completed', response },
		]);
	} });
	return { model: provider.responses('gpt-4.1'), requests };
}


describe('Provider HTTP result contracts', () => {
	for (const delivery of ['generate', 'stream', 'stream-output'] as const) for (const boundary of ['user', 'system'] as const) {
		// Stateless denial responses are accepted by fake fetch to test native output and history;
		// this does not establish that OpenAI can resolve the absent approval request.
		for (const store of [false, true]) for (const denied of [false, true]) {
			it(`${delivery}: ${boundary} boundary after ${denied ? 'denied' : 'ignored'} MCP approval with store=${store}`, async () => {
				const replay = mcpApprovalReplay({ complete: false });
				const config = { model: replay.model, tools: replay.tools, maxRetries: 0, allowSystemInMessages: true,
					providerOptions: { openai: { store } }, ...(delivery === 'stream-output' ? { output: Output.text() } : {}) };
				const component = create.LLMAgent(config);
				const run = (messages: ModelMessage[]) => delivery === 'generate' ? component.generate({ messages }) : component.stream({ messages });
				const first = await run([{ role: 'user', content: 'Search.' }]);
				assert.equal('value' in first, false);
				const history = await first.messageHistory;
				const approval = history.flatMap(message => message.role === 'assistant' && typeof message.content !== 'string' ? message.content : [])
					.find(part => part.type === 'tool-approval-request');
				assert.ok(approval);
				const messages = [...history];
				if (denied) messages.push({ role: 'tool', content: [
					{ type: 'tool-approval-response', approvalId: approval.approvalId, approved: false, providerExecuted: true },
				] });
				messages.push({ role: boundary, content: 'Different question.' });
				const original = JSON.stringify(messages);
				const second = await run(messages);
				assert.equal(await second.output, 'done');

				assert.equal(await second.finishReason, 'stop');
				assert.equal(JSON.stringify(messages), original);
				const saved = await second.messageHistory;
				assert.deepEqual(saved, [...messages, ...await second.responseMessages]);
				const decisions = replay.requests[1].input.filter(part => part.type === 'mcp_approval_response');
				assert.equal(decisions.length, denied ? 1 : 0);
				if (denied) assert.equal(decisions[0].approve, false);
				else assert.deepEqual(replay.requests[1].input.map(part => part.role), ['user', boundary]);
				assert.ok(!replay.requests[1].input.some(part => part.type === 'function_call_output'));
				const third = await run([...saved, { role: 'user', content: 'Next question.' }]);
				assert.equal(await third.output, 'done');
				assert.equal(replay.requests.length, 3);
			});
		}
	}

	for (const streaming of [false, true]) for (const policy of ['generic', 'per-tool'] as const) {
		it(`${streaming ? 'stream' : 'generate'}: Anthropic result remains settled under ${policy} automatic approval`, async () => {
			const replay = anthropicReplay('end_turn');
			assert.equal(replay.tools.web_search.supportsDeferredResults, true);
			const config = { model: replay.model, tools: replay.tools, toolApproval: policy === 'generic'
				? () => 'approved' as const : { web_search: 'approved' as const } };
			const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
			const first = await component.run({ prompt: 'Search.' });
			assert.equal(await first.output, 'Let me search for that.The answer is 42.');
			const history = await first.messageHistory;
			const parts = history.flatMap(message => message.role === 'assistant' && typeof message.content !== 'string' ? message.content : []);
			assert.ok(parts.some(part => part.type === 'tool-result'));
			assert.ok(parts.some(part => part.type === 'tool-approval-request' && part.isAutomatic));
			const next = await component.run({ messageHistory: history, prompt: 'Next question.' });
			assert.equal(await next.output, 'Complete.');
			assert.equal(replay.requests.length, 2);
		});
	}

	for (const streaming of [false, true]) {
		it(`${streaming ? 'stream' : 'generate'}: rendered Anthropic pause derives continuation settings without preparing another user turn`, async () => {
			const replay = anthropicReplay('pause_turn');
			let preparations = 0;
			const config = { model: replay.model, tools: { ...replay.tools, code_execution: replay.provider.tools.codeExecution_20250825() }, inputSchema: z.object({ message: z.string() }),
				prompt: ({ message }: { message: string }) => { preparations++; return message; } };
			const component = streaming ? create.LLMAgent.withFunction.asStream(config) : create.LLMAgent.withFunction(config);
			const context = { message: 'Search.' };
			const providerOptions = { anthropic: { container: { id: 'container_fixture' } } };
			const first = await component.run({ context, providerOptions });
			assert.equal('value' in first, false);
			const history = await first.messageHistory;
			const continuation = create.LLMAgent({ providerOptions }, component);
			const next = streaming ? await continuation.stream({ messages: history, options: context })
				: await continuation.generate({ messages: history, options: context });
			assert.equal(await next.output, 'Complete.');
			assert.equal(preparations, 1);
			assert.deepEqual(replay.requests.map(request => request.container), ['container_fixture', 'container_fixture']);
			assert.equal('providerOptions' in component.config, false);
			assert.deepEqual(await next.messageHistory, [...history, ...await next.responseMessages]);
			assert.equal(replay.requests.length, 2);
		});
	}

	for (const delivery of ['generate', 'stream', 'stream-output'] as const) {
		for (const entry of ['native', 'run'] as const) for (const linked of [false, true]) {
			it(`${delivery}/${entry}: MCP output survives approval and a later turn with linkage=${linked}`, async () => {
				const replay = mcpApprovalReplay();
				const config = { model: replay.model, tools: replay.tools, maxRetries: 0,
					...(delivery === 'stream-output' ? { output: Output.text() } : {}) };
				const component = delivery === 'generate' ? create.LLMAgent(config) : create.LLMAgent.asStream(config);
				async function run(messages: ModelMessage[], prompt?: string) {
					if (entry === 'run') return component.run({ messageHistory: messages, prompt });
					const args = { messages: [...messages, ...prompt === undefined ? [] : [{ role: 'user' as const, content: prompt }]] };
					return delivery === 'generate' ? component.generate(args) : component.stream(args);
				}
				const first = await run([], 'Search.');
				assert.equal('value' in first, false);
				const history = await first.messageHistory;
				const parts = history.flatMap(message => message.role === 'assistant' && typeof message.content !== 'string' ? message.content : []);
				const call = parts.find(part => part.type === 'tool-call');
				const approval = parts.find(part => part.type === 'tool-approval-request');
				assert.ok(call && approval);
				assert.equal(call.providerOptions?.openai?.approvalRequestId, undefined);
				if (linked) call.providerOptions = { openai: { approvalRequestId: approval.approvalId } };
				const messages: ModelMessage[] = [...history, { role: 'tool', content: [
					{ type: 'tool-approval-response', approvalId: approval.approvalId, approved: true, providerExecuted: true },
				] }];
				const original = JSON.stringify(messages);
				const second = await run(messages);
				assert.equal(await second.output, 'done');

				assert.equal(await second.finishReason, 'stop');
				const completed = (await second.content).find(part => part.type === 'tool-call');
				assert.ok(completed);
				assert.equal(completed.toolCallId === call.toolCallId, linked);
				const saved = await second.messageHistory;
				assert.equal(JSON.stringify(messages), original);
				assert.deepEqual(saved, [...messages, ...await second.responseMessages]);
				const third = await run(saved, 'Next question.');
				assert.equal(await third.output, 'done');

				assert.ok(replay.requests[1].input.some(part => part.type === 'mcp_approval_response' && part.approve === true));
				assert.equal(replay.requests.length, 3);
			});
		}
	}

	for (const streaming of [false, true]) {
		const mode = streaming ? 'stream' : 'generate';
		it(`${mode}: OpenAI Responses preserves the SDK text from both message phases`, async () => {
			const replay = openAIResponsesReplay();
			const component = streaming ? create.LLMAgent.asStream({ model: replay.model }) : create.LLMAgent({ model: replay.model });
			const call: (prompt: string) => ReturnType<typeof component> = component;
			const result = await call('question');
			assert.equal(await result.output, 'Checking.Complete.');

			assert.equal((await result.steps).length, 1);
			assert.equal(replay.requests.length, 1);
		});
		for (const pending of [false, true]) {
			it(`${mode}: an Anthropic pause with ${pending ? 'pending' : 'resolved'} search results retains native output`, async () => {
				const replay = anthropicReplay('pause_turn', pending);
				const config = { model: replay.model, tools: replay.tools };
				const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
				const call: (prompt: string) => ReturnType<typeof component> = component;
				const result = await call('question');
				assert.equal(await result.finishReason, 'stop');
				assert.equal(await result.rawFinishReason, 'pause_turn');
				assert.equal(await result.output, 'Let me search for that.Let me refine the search.');
				assert.equal((await result.steps)[0].toolResults.length, pending ? 0 : 1);
				assert.equal('value' in result, false);
				const history = await result.messageHistory;
				assert.ok(history.length > 1);
				if (!pending) {
					assert.ok(JSON.stringify(history).includes('encrypted-source'));
					const resumed = await component.run({ messageHistory: history });
					assert.equal(await resumed.output, 'Complete.');
					assert.ok(JSON.stringify(replay.requests[1].messages).includes('encrypted-source'));
				}
				assert.equal(replay.requests.length, pending ? 1 : 2);
			});
		}

		it(`${mode}: a completed Anthropic server-tool step preserves all SDK text without separators`, async () => {
			const replay = anthropicReplay('end_turn');
			const config = { model: replay.model, tools: replay.tools };
			const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
			const call: (prompt: string) => ReturnType<typeof component> = component;
			const result = await call('question');
			const nativeOutput = await result.output;
			assert.equal(nativeOutput, 'Let me search for that.The answer is 42.');
			assert.equal(await result.output, nativeOutput);
			assert.equal((await result.steps).length, 1);
			assert.equal((await result.steps)[0].toolResults.length, 1);
			assert.equal(replay.requests.length, 1);
		});

		for (const refusal of [false, true]) {
			it(`${mode}: OpenAI chat ${refusal ? 'refusal' : 'intentional empty output'} is native empty stop text`, async () => {
				const replay = openAIChatReplay(refusal);
				const component = streaming ? create.LLMAgent.asStream({ model: replay.model }) : create.LLMAgent({ model: replay.model });
				const call: (prompt: string) => ReturnType<typeof component> = component;
				const result = await call('question');
				assert.equal(await result.finishReason, 'stop');
				assert.equal(await result.output, '');

				assert.equal(JSON.stringify(await result.messageHistory).includes('I cannot help'), false);
				assert.equal(replay.requests.length, 1);
			});

			it(`${mode}: OpenAI chat ${refusal ? 'refusal' : 'empty output'} still fails structured parsing`, async () => {
				const replay = openAIChatReplay(refusal);
				const config = { model: replay.model, output: Output.object({ schema: z.object({ n: z.number() }) }) };
				const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
				await assert.rejects(async () => { const call: (prompt: string) => ReturnType<typeof component> = component;
					const result = await call('question'); await result.output; }, NoObjectGeneratedError);
				assert.equal(replay.requests.length, 1);
			});
		}
	}
});
