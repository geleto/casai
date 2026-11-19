import assert from 'node:assert/strict';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type ModelMessage } from 'ai';
import { MockSpeechModelV4 } from 'ai/test';
import { SpeechGenerator, z } from '../src/index.js';

// Real installed HTTP serializers, fake fetch: these checks establish transport shape,
// not that a provider can hear audio. The paid control lives in Phase6MediaTools.live.test.ts.
describe('Native media tool serialization', () => {
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
