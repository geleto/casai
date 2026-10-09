import { expect } from 'chai';
import { stepCountIs } from 'ai';
import type { ModelMessage } from 'ai';
import { rejects } from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { create, z } from './cascada';

function toolLoopModel(toolSteps: number): MockLanguageModelV3 {
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	const toolCalls = Array.from({ length: toolSteps }, (_, index) => ({
		type: 'tool-call' as const,
		toolCallId: `call-${index}`,
		toolName: 'double',
		input: JSON.stringify({ value: index + 1 }),
	}));
	const toolFinish = { unified: 'tool-calls', raw: 'tool-calls' } as const;
	const textFinish = { unified: 'stop', raw: 'stop' } as const;
	const response = { id: 'final-response', timestamp: new Date('2026-01-01'), modelId: 'history-model' };
	return new MockLanguageModelV3({
		doGenerate: [
			...toolCalls.map(call => ({ content: [call], finishReason: toolFinish, usage, warnings: [] })),
			{ content: [{ type: 'text', text: 'DONE' }], finishReason: textFinish, usage, warnings: [], response },
		],
		doStream: [
			...toolCalls.map(call => ({ stream: convertArrayToReadableStream([
				{ type: 'stream-start' as const, warnings: [] },
				call,
				{ type: 'finish' as const, finishReason: toolFinish, usage },
			]) })),
			{ stream: convertArrayToReadableStream([
				{ type: 'stream-start', warnings: [] },
				{ type: 'response-metadata', ...response },
				{ type: 'text-start', id: 'text' },
				{ type: 'text-delta', id: 'text', delta: 'DONE' },
				{ type: 'text-end', id: 'text' },
				{ type: 'finish', finishReason: textFinish, usage },
			]) },
		],
	});
}

describe('Message history across tool steps', () => {
	for (const streaming of [false, true]) {
		for (const rendered of [false, true]) {
			it(`should expose history for plain ${rendered ? 'function' : 'text'} ${streaming ? 'streams' : 'generators'}`, async () => {
				const model = toolLoopModel(0);
				const component = rendered
					? streaming ? create.TextStreamer.withFunction({ model, prompt: () => 'Input.' }) : create.TextGenerator.withFunction({ model, prompt: () => 'Input.' })
					: streaming ? create.TextStreamer({ model, prompt: 'Input.' }) : create.TextGenerator({ model, prompt: 'Input.' });
				const call: () => ReturnType<typeof component> = component;
				const result = await call();
				const response = await result.response;
				const messages: ModelMessage[] = [{ role: 'user', content: 'Input.' }, ...(await result.responseMessages)];
				expect(response.messages).to.deep.equal(messages);
				expect(response.messageHistory).to.deep.equal(messages);
				// Augmented messages include user input as well as SDK response messages.
				expect(response.messages.filter(message => message.role === 'user')).to.have.length(1);
				expect((await result.finalStep).response.messages).to.deep.equal(messages.slice(1));
			});
		}
	}

	it('should consume a failed stream without creating unhandled metadata rejections', async () => {
		// An isolated process makes leaked promises fail the test without affecting Mocha's handlers.
		await promisify(execFile)(process.execPath, [
			'--import=tsx', '--conditions=casai-source', '--unhandled-rejections=strict', '--input-type=module', '--eval', `
				import assert from 'node:assert/strict';
				import { create } from 'casai';
				import { MockLanguageModelV3 } from 'ai/test';
				const failure = new Error('Provider failed');
				const model = new MockLanguageModelV3({ doStream: async () => { throw failure; } });
				const errors = [];
				const streamer = create.TextStreamer({
					model, prompt: 'Input.', messages: [{ role: 'assistant', content: 'Earlier.' }],
					maxRetries: 0, onError: ({ error }) => errors.push(error),
				});
				await (await streamer()).consumeStream();
				await new Promise(resolve => setImmediate(resolve));
				assert.deepEqual(errors, [failure]);
			`,
		], { cwd: fileURLToPath(new URL('..', import.meta.url)) });
	});

	it('should propagate failed stream metadata when it is requested', async () => {
		const model = new MockLanguageModelV3({ doStream: async () => { throw new Error('Provider failed'); } });
		const streamer = create.TextStreamer({ model, prompt: 'Input.', maxRetries: 0, onError: () => undefined });
		const result = streamer();
		const response = result.response;
		expect(result.response).to.equal(response);
		await rejects(response, /No output generated/);
	});

	for (const streaming of [false, true]) {
		for (const toolSteps of [1, 2]) {
			it(`should preserve ${toolSteps} tool ${toolSteps === 1 ? 'step' : 'steps'} in ${streaming ? 'streamed' : 'generated'} conversation history`, async () => {
				const model = toolLoopModel(toolSteps);
				const double = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: ({ value }) => value * 2 });
				const system: ModelMessage = { role: 'system', content: 'Configured instruction.' };
				const history: ModelMessage[] = [{ role: 'user', content: 'Earlier question.' }, { role: 'assistant', content: 'Earlier answer.' }];
				const config = { model, tools: { double }, messages: [system], allowSystemInMessages: true, stopWhen: stepCountIs(toolSteps + 1) };
				const component = streaming ? create.TextStreamer(config) : create.TextGenerator(config);
				const result = await component('Use double.', history);
				expect(await result.text).to.equal('DONE');
				const response = await result.response;
				const steps = await result.steps;
				const generatedMessages = steps.flatMap(step => step.response.messages);
				const roles = [...Array.from({ length: toolSteps }, () => ['assistant', 'tool']).flat(), 'assistant'];

				expect(response.messages.map(message => message.role)).to.deep.equal(['user', ...roles]);
				expect(response.messages[0]).to.deep.equal({ role: 'user', content: 'Use double.' });
				expect(response.messages.slice(1)).to.deep.equal(generatedMessages);
				expect(response.messageHistory).to.deep.equal([...history, ...response.messages]);
				expect(history).to.have.lengthOf(2);
				expect(response.messageHistory).not.to.include(system);
				expect(response.messages).to.equal(response.messages);
				expect(response.messageHistory).to.equal(response.messageHistory);
				expect(await result.response).to.equal(response);
				expect(response.id).to.equal('final-response');
				expect(response.timestamp).to.deep.equal(new Date('2026-01-01'));
				expect(response.modelId).to.equal('history-model');

				// SDK step responses and aggregate messages must remain unmodified.
				expect(steps.at(-1)!.response.messages.map(message => message.role)).to.deep.equal(['assistant']);
				expect(await result.responseMessages).to.deep.equal(generatedMessages);
				expect((await result.toolCalls).map(call => call.toolCallId)).to.deep.equal(Array.from({ length: toolSteps }, (_, index) => `call-${index}`));
				expect((await result.toolResults).map(toolResult => toolResult.output)).to.deep.equal(Array.from({ length: toolSteps }, (_, index) => (index + 1) * 2));

				// Reusing the history sends every call/result pair exactly once.
				const nextModel = toolLoopModel(0);
				const next = await component.run({ model: nextModel, prompt: 'Continue.', messages: response.messageHistory });
				expect(await next.text).to.equal('DONE');
				const nextCall = streaming ? nextModel.doStreamCalls[0] : nextModel.doGenerateCalls[0];
				expect(nextCall.prompt.map(message => message.role)).to.deep.equal(['system', 'user', 'assistant', 'user', ...roles, 'user']);
				expect((await next.response).messageHistory).to.deep.equal([
					...response.messageHistory,
					{ role: 'user', content: 'Continue.' },
					...(await next.responseMessages),
				]);
			});
		}
	}
});
