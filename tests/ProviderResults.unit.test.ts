import assert from 'node:assert/strict';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { NoObjectGeneratedError, NoOutputGeneratedError, Output } from 'ai';
import { z } from 'zod';
import { create } from './cascada';

// Exercise the installed HTTP adapters, including their schemas and finish-reason mappings.
// Every provider has a fake fetch and a fake key; these tests make no network requests.
type Block = { type: string } & Record<string, unknown>;
interface RequestBody { stream?: boolean, messages?: unknown[] }

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
	return { model: provider('claude-sonnet-4-20250514'), tools: { web_search: provider.tools.webSearch_20250305() }, requests };
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

async function textValue(value: string | AsyncIterable<string>): Promise<string> {
	if (typeof value === 'string') return value;
	let text = '';
	for await (const chunk of value) text += chunk;
	return text;
}

describe('Provider HTTP result contracts', () => {
	for (const streaming of [false, true]) {
		const mode = streaming ? 'stream' : 'generate';
		it(`${mode}: OpenAI Responses preserves the SDK text from both message phases`, async () => {
			const replay = openAIResponsesReplay();
			const component = streaming ? create.TextStreamer({ model: replay.model }) : create.TextGenerator({ model: replay.model });
			const result = await component('question');
			assert.equal(await textValue(result.value), 'Checking.Complete.');
			assert.equal(await result.output, 'Checking.Complete.');
			assert.equal((await result.steps).length, 1);
			assert.equal(replay.requests.length, 1);
		});
		for (const pending of [false, true]) {
			it(`${mode}: an Anthropic pause with ${pending ? 'pending' : 'resolved'} search results is unavailable`, async () => {
				const replay = anthropicReplay('pause_turn', pending);
				const config = { model: replay.model, tools: replay.tools };
				const component = streaming ? create.TextStreamer(config) : create.TextGenerator(config);
				const result = await component('question');
				assert.equal(await result.finishReason, 'stop');
				assert.equal(await result.rawFinishReason, 'pause_turn');
				assert.equal(await result.output, 'Let me search for that.Let me refine the search.');
				assert.equal((await result.steps)[0].toolResults.length, pending ? 0 : 1);
				await assert.rejects(async () => textValue(result.value), error => NoOutputGeneratedError.isInstance(error) && error.message.includes('paused'));
				const history = await result.messageHistory;
				assert.ok(history.length > 1);
				if (!pending) {
					assert.ok(JSON.stringify(history).includes('encrypted-source'));
					const resumed = await component.run({ messages: history });
					assert.equal(await textValue(resumed.value), 'Complete.');
					assert.ok(JSON.stringify(replay.requests[1].messages).includes('encrypted-source'));
				}
				assert.equal(replay.requests.length, pending ? 1 : 2);
			});
		}

		it(`${mode}: a completed Anthropic server-tool step preserves all SDK text without separators`, async () => {
			const replay = anthropicReplay('end_turn');
			const config = { model: replay.model, tools: replay.tools };
			const component = streaming ? create.TextStreamer(config) : create.TextGenerator(config);
			const result = await component('question');
			const nativeOutput = await result.output;
			assert.equal(nativeOutput, 'Let me search for that.The answer is 42.');
			assert.equal(await textValue(result.value), nativeOutput);
			assert.equal((await result.steps).length, 1);
			assert.equal((await result.steps)[0].toolResults.length, 1);
			assert.equal(replay.requests.length, 1);
		});

		for (const refusal of [false, true]) {
			it(`${mode}: OpenAI chat ${refusal ? 'refusal' : 'intentional empty output'} is native empty stop text`, async () => {
				const replay = openAIChatReplay(refusal);
				const component = streaming ? create.TextStreamer({ model: replay.model }) : create.TextGenerator({ model: replay.model });
				const result = await component('question');
				assert.equal(await result.finishReason, 'stop');
				assert.equal(await result.output, '');
				assert.equal(await textValue(result.value), '');
				assert.equal(JSON.stringify(await result.messageHistory).includes('I cannot help'), false);
				assert.equal(replay.requests.length, 1);
			});

			it(`${mode}: OpenAI chat ${refusal ? 'refusal' : 'empty output'} still fails structured parsing`, async () => {
				const replay = openAIChatReplay(refusal);
				const config = { model: replay.model, output: Output.object({ schema: z.object({ n: z.number() }) }) };
				const component = streaming ? create.TextStreamer(config) : create.TextGenerator(config);
				await assert.rejects(async () => { const result = await component('question'); await result.value; }, NoObjectGeneratedError);
				assert.equal(replay.requests.length, 1);
			});
		}
	}
});
