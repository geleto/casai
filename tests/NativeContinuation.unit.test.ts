import assert from 'node:assert/strict';
import { generateText, streamText, tool, readUIMessageStream, convertToModelMessages } from 'ai';
import type { ModelMessage, UIMessage } from 'ai';
import { z } from 'zod';
import { modelFor } from './fixtures/phase2-security-sdk.js';
import { pendingHistory, decision, recordedResult, parts } from './fixtures/approval-history.js';

// SDK-only upgrade canaries for the placement and consumer behavior packaged by resume.
describe('Native continuation boundaries', () => {
	for (const streaming of [false, true]) {
		it(`reads existing results only from the final tool message, streaming=${streaming}`, async () => {
			for (const split of [false, true]) {
				let effects = 0;
				const tools = { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: () => { effects++; return 'executed'; } }) };
				const messages: ModelMessage[] = [...pendingHistory('a'), ...split
					? [{ role: 'tool' as const, content: [recordedResult('a')] }, { role: 'tool' as const, content: [decision('a', true)] }]
					: [{ role: 'tool' as const, content: [recordedResult('a'), decision('a', true)] }]];
				const settings = { model: modelFor(undefined), tools, messages };
				const result = streaming ? streamText(settings) : await generateText(settings);
				assert.equal(await result.output, 'done'); assert.equal(effects, split ? 1 : 0);
			}
		});

		it(`does not synthesize a denial result before a new user message, streaming=${streaming}`, async () => {
			const model = modelFor(undefined);
			const messages: ModelMessage[] = [...pendingHistory('a'), { role: 'tool', content: [decision('a', false)] }, { role: 'user', content: 'New request.' }];
			const settings = { model, messages };
			const result = streaming ? streamText(settings) : await generateText(settings);
			assert.equal(await result.output, 'done');
			assert.equal(parts(await result.responseMessages).filter(part => part.type === 'tool-result').length, 0);
			const sent = streaming ? model.doStreamCalls[0].prompt : model.doGenerateCalls[0].prompt;
			assert.equal(sent.some(message => typeof message.content !== 'string' && message.content.some(part => part.type === 'tool-result')), false);
		});

		it(`settles incoming approvals before step zero and keeps results out of step aggregates, streaming=${streaming}`, async () => {
			let effects = 0, prepared = 0;
			const settings = { model: modelFor(undefined), messages: [...pendingHistory('a'), { role: 'tool' as const, content: [decision('a', true)] }],
				tools: { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: () => { effects++; return 'done'; } }) },
				prepareStep: (step: { stepNumber: number; responseMessages: ModelMessage[] }) => {
					prepared++; assert.equal(effects, 1); assert.equal(step.stepNumber, 0);
					assert.ok(parts(step.responseMessages).some(part => part.type === 'tool-result'));
					return undefined;
				},
			};
			const result = streaming ? streamText(settings) : await generateText(settings);
			assert.equal(await result.output, 'done'); assert.equal(prepared, 1);
			assert.equal((await result.steps)[0].toolResults.length, 0);
			assert.ok(parts(await result.responseMessages).some(part => part.type === 'tool-result'));
		});
	}

	it('re-emits settled denial events without another result or execution', async () => {
		const messages: ModelMessage[] = [...pendingHistory('a'), { role: 'tool', content: [decision('a', false),
			{ type: 'tool-result', toolCallId: 'a', toolName: 'lookup', output: { type: 'execution-denied' } },
		] }];
		const result = streamText({ model: modelFor(undefined), messages });
		const events = [];
		for await (const event of result.stream) events.push(event);
		assert.equal(events.filter(event => event.type === 'tool-output-denied').length, 1);
		assert.equal(parts(await result.responseMessages).filter(part => part.type === 'tool-result').length, 0);
	});

	it('drops unanswered UI requests before a new user message and settles recorded denials', async () => {
		const conversation = (part: UIMessage['parts'][number]): UIMessage[] => [
			{ id: 'first', role: 'user', parts: [{ type: 'text', text: 'Use the tool.' }] },
			{ id: 'paused', role: 'assistant', parts: [part] },
			{ id: 'next', role: 'user', parts: [{ type: 'text', text: 'Different question.' }] },
		];
		const pending = await convertToModelMessages(conversation({ type: 'tool-lookup', toolCallId: 'a', input: { key: 'a' },
			state: 'approval-requested', approval: { id: 'approve-a' } }));
		assert.deepEqual(pending.map(message => message.role), ['user', 'user']);
		const denied = await convertToModelMessages(conversation({ type: 'tool-lookup', toolCallId: 'a', input: { key: 'a' },
			state: 'approval-responded', approval: { id: 'approve-a', approved: false, reason: 'Recorded.' } }));
		assert.deepEqual(parts(denied).flatMap(part => part.type === 'tool-result' ? [part.output] : []), [{ type: 'execution-denied', reason: 'Recorded.' }]);
	});

	it('needs the paused UI tool invocation when processing incoming outcomes', async () => {
		const messages: ModelMessage[] = [...pendingHistory('a'), { role: 'tool', content: [decision('a', true)] }];
		const tools = { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: ({ key }) => key }) };
		const paused: UIMessage = { id: 'paused', role: 'assistant', parts: [
			{ type: 'tool-lookup', toolCallId: 'a', input: { key: 'a' }, state: 'approval-responded', approval: { id: 'approve-a', approved: true } },
		] };
		for (const retained of [false, true]) {
			const result = streamText({ model: modelFor(undefined), messages, tools });
			const read = async () => {
				const updates = [];
				for await (const update of readUIMessageStream({ stream: result.toUIMessageStream({ originalMessages: retained ? [paused] : [] }),
					...(retained ? { message: paused } : {}), terminateOnError: true })) updates.push(update);
				return updates;
			};
			if (retained) assert.ok((await read()).length > 0);
			else await assert.rejects(read(), /No tool invocation found/);
		}
	});
});
