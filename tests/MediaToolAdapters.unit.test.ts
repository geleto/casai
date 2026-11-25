import assert from 'node:assert/strict';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, isStepCount, ToolLoopAgent, type ModelMessage } from 'ai';
import { MockSpeechModelV4 } from 'ai/test';
import { SpeechGenerator, z } from '../src/index.js';
import { modelFor } from './fixtures/phase2-security-sdk.js';

// Real installed HTTP serializers, fake fetch: these checks establish transport shape,
// not that a provider can hear audio. The paid control lives in Phase6MediaTools.live.test.ts.
describe('Native media tool serialization', () => {
	for (const mode of ['generate', 'stream'] as const) {
		for (const outcome of ['success', 'invalid input', 'speech failure', 'formatter failure'] as const) {
			it(`${mode}: reports ${outcome} on the speech tool's native result path`, async () => {
				let executions = 0, projections = 0;
				const speech = SpeechGenerator.asTool({
					model: new MockSpeechModelV4({ doGenerate: async () => {
						executions++;
						if (outcome === 'speech failure') throw new Error('speech unavailable');
						return { audio: 'AQIDBA==', warnings: [], response: { timestamp: new Date(0), modelId: 'fixture' } };
					} }),
					maxRetries: 0, inputSchema: z.object({ text: z.string() }),
					toModelOutput: ({ output }) => {
						projections++;
						if (outcome === 'formatter failure') throw new Error('speech projection failed');
						return { type: 'text', value: `recording ${output.base64}` };
					},
				});
				const model = modelFor({ text: outcome === 'invalid input' ? 15 : 'Hello' }, 'speak');
				const agent = new ToolLoopAgent({ model, tools: { speak: speech }, stopWhen: isStepCount(2), maxRetries: 0 });
				const calls = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
				const complete = async () => (await agent[mode]({ prompt: 'Use the speech tool.' })).text;
				if (outcome === 'formatter failure') {
					await assert.rejects(complete, /speech projection failed/);
					assert.equal(calls.length, 1);
				} else {
					assert.equal(await complete(), 'done');
					assert.equal(calls.length, 2);
					const results = calls[1].prompt.flatMap(message => message.role === 'tool' ? message.content : []);
					assert.equal(results.length, 1);
					const [part] = results;
					assert.ok(part.type === 'tool-result' && part.toolName === 'speak' && part.toolCallId === 'call-1');
					if (outcome === 'success') {
						assert.deepEqual(part.output, { type: 'text', value: 'recording AQIDBA==' });
					} else {
						assert.equal(part.output.type, 'error-text');
						if (outcome === 'invalid input') {
							assert.match(part.output.value, /text/);
							assert.match(part.output.value, /expected string/i);
						} else assert.match(part.output.value, /speech unavailable/);
					}
				}
				assert.equal(executions, outcome === 'invalid input' ? 0 : 1);
				assert.equal(projections, outcome === 'success' || outcome === 'formatter failure' ? 1 : 0);
			});
		}
	}

	for (const route of ['google', 'openai-chat', 'anthropic', 'google-interactions'] as const) {
		it(`${route}: preserves the adapter's actual audio-result behavior`, async () => {
			const tool = SpeechGenerator.asTool({
				model: new MockSpeechModelV4({ doGenerate: async () => ({ audio: 'AQIDBA==', warnings: [], response: { timestamp: new Date(0), modelId: 'fixture' } }) }),
				text: 'private recording', inputSchema: z.object({}),
			});
			const output = await tool.execute({}, { toolCallId: 'recording', messages: [], context: undefined });
			const messages: ModelMessage[] = [
				{ role: 'user', content: 'Listen to the recording.' },
				{ role: 'assistant', content: [{ type: 'tool-call', toolName: 'recording', toolCallId: 'recording', input: {} }] },
				{ role: 'tool', content: [{ type: 'tool-result', toolName: 'recording', toolCallId: 'recording', output: await tool.toModelOutput!({ output, input: {}, toolCallId: 'recording' }) }] },
			];
			let body = '';
			const capture: typeof fetch = async (_input, init) => {
				assert.ok(typeof init?.body === 'string'); body = init.body;
				throw new Error('request captured');
			};
			const settings = { apiKey: 'fixture', fetch: capture };
			const model = route === 'google' ? createGoogle(settings)('gemini-3.8-flash')
				: route === 'openai-chat' ? createOpenAI(settings).chat('gpt-4o-audio-preview')
					: route === 'anthropic' ? createAnthropic(settings)('claude-sonnet-4-20250514')
						: createGoogle(settings).interactions('gemini-3.8-flash');
			await assert.rejects(generateText({ model, messages, maxRetries: 0 }), /request captured/);
			assert.ok(body.length); assert.ok(!body.includes('private recording'));
			if (route === 'google') {
				const request = JSON.parse(body) as { contents: { parts: { functionResponse?: { parts?: unknown[] } }[] }[] };
				const response = request.contents.flatMap(content => content.parts).find(part => part.functionResponse)?.functionResponse;
				assert.deepEqual(response?.parts, [{ inlineData: { mimeType: output.mediaType, data: 'AQIDBA==' } }]);
			} else if (route === 'openai-chat') {
				const request = JSON.parse(body) as { messages: { role: string; content: unknown }[] };
				const content = request.messages.find(message => message.role === 'tool')?.content;
				assert.ok(typeof content === 'string'); assert.match(content, /AQIDBA==/);
				assert.ok(!body.includes('input_audio'), 'JSON text is not native audio delivery.');
			} else assert.ok(!body.includes('AQIDBA=='), 'This adapter drops audio; it is not a supported receiving route.');
		});
	}
});
