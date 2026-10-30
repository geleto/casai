import assert from 'node:assert/strict';
import { createOpenAI } from '@ai-sdk/openai';

interface ResponsesRequest { stream?: boolean; store?: boolean; previous_response_id?: string; input: Record<string, unknown>[] }

// Real Responses adapter, scripted HTTP output; no network or Casai imports.
// Deliberately accepts every captured request. Success here proves no live server
// acceptance, particularly for stateless approvals missing their request item.
export function mcpApprovalReplay({ complete = true, bridge = false } = {}) {
	const requests: ResponsesRequest[] = [];
	const provider = createOpenAI({ apiKey: 'fixture', fetch: async (_url, init) => {
		assert.equal(typeof init?.body, 'string');
		const request = JSON.parse(init!.body as string) as ResponsesRequest;
		requests.push(request);
		const answer = { type: 'message', id: `msg_${requests.length}`, role: 'assistant', status: 'completed',
			content: [{ type: 'output_text', text: 'done', annotations: [] }] };
		const output = requests.length === 1
			? [{ type: 'mcp_approval_request', id: 'mcpr_fixture', name: 'search', server_label: 'remote', arguments: '{"query":"example"}' },
				...bridge ? [{ type: 'function_call', id: 'fc_bridge', call_id: 'bridge', name: 'bridge', arguments: '{}' }] : []]
			: requests.length === 2 && complete ? [{ type: 'mcp_call', id: 'mcp_executed', approval_request_id: 'mcpr_fixture', name: 'search',
				server_label: 'remote', status: 'completed', arguments: '{"query":"example"}', output: 'found' }, answer] : [answer];
		const response = { id: `resp_${requests.length}`, object: 'response', created_at: 1, model: 'gpt-4.1', status: 'completed', error: null,
			incomplete_details: null, output, usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 } };
		if (!request.stream) return Response.json(response);
		const events = [{ type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
			...output.flatMap((item, index) => [
				{ type: 'response.output_item.added', output_index: index, item: { ...item, status: 'in_progress', ...('content' in item ? { content: [] } : {}) } },
				...('content' in item ? [{ type: 'response.output_text.delta', output_index: index, item_id: item.id, content_index: 0, delta: 'done' }] : []),
				{ type: 'response.output_item.done', output_index: index, item },
			]), { type: 'response.completed', response }];
		return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''),
			{ headers: { 'content-type': 'text/event-stream' } });
	} });
	return { requests, model: provider.responses('gpt-4.1'),
		tools: { mcp: provider.tools.mcp({ serverLabel: 'remote', serverUrl: 'https://fixture.invalid/mcp', requireApproval: 'always' }) } };
}
