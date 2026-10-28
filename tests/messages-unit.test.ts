import assert from 'node:assert/strict';
import type { ModelMessage } from 'ai';
import { create, ValidationError } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';

const history: ModelMessage[] = [{ role: 'assistant', content: 'earlier' }];
const prompt: ModelMessage[] = [{ role: 'user', content: 'new' }];

describe('LLMAgent positional conversation arguments', () => {
	for (const [name, args, expected] of [
		['omission', [], [{ role: 'user', content: 'configured' }]],
		['undefined', [undefined], [{ role: 'user', content: 'configured' }]],
		['context', [{ name: 'Ada' }], [{ role: 'user', content: 'configured' }]],
		['text', ['new'], [{ role: 'user', content: 'new' }]],
		['empty text', ['', {}], [{ role: 'user', content: '' }]],
		['new messages', [prompt], prompt],
		['new messages and context', [prompt, { name: 'Ada' }], prompt],
		['new messages and history', [prompt, history], [...history, ...prompt]],
		['text and history', ['new', history], [...history, { role: 'user', content: 'new' }]],
		['context and history', [{ name: 'Ada' }, history], [...history, { role: 'user', content: 'configured' }]],
		['all arguments', ['new', { name: 'Ada' }, history], [...history, { role: 'user', content: 'new' }]],
		['source placeholder', [undefined, { name: 'Ada' }, history], [...history, { role: 'user', content: 'configured' }]],
	] as const) it(name, async () => {
		const agent = create.LLMAgent({ model: modelFor(undefined), prompt: 'configured', prepareCall(request) {
			assert.deepEqual(request.messages, expected); return request;
		} });
		await (agent as (...args: unknown[]) => Promise<unknown>)(...args);
	});

	for (const args of [[42], [null], [{}, {}], ['new', {}, {}], ['new', history, {}], ['new', {}, history, {}]]) {
		it(`rejects invalid or old argument order ${JSON.stringify(args)}`, async () => {
			const agent = create.LLMAgent({ model: modelFor(undefined), prompt: 'configured' });
			await assert.rejects((agent as (...args: unknown[]) => Promise<unknown>)(...args), ValidationError);
		});
	}

	it('accepts an empty original conversation that the hook fills, without adding hook messages to history', async () => {
		const agent = create.LLMAgent({ model: modelFor(undefined), prepareCall: request => ({ ...request, messages: prompt }) });
		const result = await agent([]);
		assert.equal(result.messageHistory.length, 1);
		assert.equal(result.messageHistory[0].role, 'assistant');
	});

	it('snapshots history and new prompt arrays while preserving their native message fields', async () => {
		const messages: ModelMessage[] = [{ role: 'user', content: 'new' }];
		let release: (() => void) | undefined;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const agent = create.LLMAgent({ model: modelFor(undefined), prepareCall: async request => { await gate; return request; } });
		const pending = agent(messages, history);
		messages.push({ role: 'user', content: 'later' });
		release!();
		const result = await pending;
		assert.deepEqual(result.messageHistory.slice(0, 2), [...history, prompt[0]]);
	});
});
