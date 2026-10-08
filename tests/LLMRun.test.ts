import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { create, z } from './cascada';
import type { ModelMessage } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';

function mockModel(text: string): MockLanguageModelV3 {
	const finishReason = { unified: 'stop', raw: 'stop' } as const;
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	return new MockLanguageModelV3({
		doGenerate: { content: [{ type: 'text', text }], finishReason, usage, warnings: [] },
		doStream: async () => ({
			stream: convertArrayToReadableStream([
				{ type: 'stream-start', warnings: [] },
				{ type: 'text-start', id: 'text' },
				{ type: 'text-delta', id: 'text', delta: text },
				{ type: 'text-end', id: 'text' },
				{ type: 'finish', finishReason, usage },
			]),
		}),
	});
}

describe('LLM run overrides and repeated calls', () => {
	for (const promptType of ['template', 'script', 'function'] as const) {
		for (const streaming of [false, true]) {
			it(`should validate and render call-time input in ${promptType} ${streaming ? 'streams' : 'generators'}`, async () => {
				const model = mockModel('OK');
				let validations = 0;
				const inputSchema = z.object({ name: z.string() }).strict().refine(() => {
					validations++;
					return true;
				});
				const config = { model, inputSchema, context: { name: 'Configured', greeting: 'Hello' } };
				const template = { ...config, prompt: '{{ greeting }} {{ name }}' };
				const script = { ...config, prompt: 'return greeting ~ " " ~ name' };
				const functionConfig = { ...config, prompt: ({ greeting, name }: Record<string, string>) => `${greeting} ${name}` };
				const component = promptType === 'template'
					? streaming ? create.TextStreamer.withTemplate(template) : create.TextGenerator.withTemplate(template)
					: promptType === 'script'
						? streaming ? create.TextStreamer.withScript(script) : create.TextGenerator.withScript(script)
						: streaming ? create.TextStreamer.withFunction(functionConfig) : create.TextGenerator.withFunction(functionConfig);
				const result = await component.run({ context: { name: 'Alice' } });
				expect(await result.text).to.equal('OK');
				const call = streaming ? model.doStreamCalls[0] : model.doGenerateCalls[0];
				expect(call.prompt[0].content).to.deep.equal([{ type: 'text', text: 'Hello Alice' }]);
				expect(validations).to.equal(1);
				expect(await (await component({ name: 'Bob' })).text).to.equal('OK');
				expect(validations).to.equal(2);
				await rejects(() => component.run({ context: { name: 123 } }), /Input context validation failed/);
				await rejects(() => component.run({}), /context object is required|Input context validation failed/);
				expect(component.config.context.name).to.equal('Configured');
			});
		}
	}

	it('should validate raw input once when replacing a function prompt', async () => {
		const model = mockModel('OK');
		let validations = 0;
		const generator = create.TextGenerator.withFunction({
			model, context: { greeting: 'Configured' },
			inputSchema: z.object({ name: z.string() }).strict().refine(() => {
				validations++;
				return true;
			}),
			prompt: () => 'Original',
		});
		await generator.run({
			context: { name: 'Alice' },
			prompt: ({ greeting, name }) => `${greeting} ${name}`,
		});
		expect(validations).to.equal(1);
		expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([{ type: 'text', text: 'Configured Alice' }]);
	});

	it('should accept run-time prompts and messages without a configured prompt', async () => {
		const model = mockModel('OK');
		const generator = create.TextGenerator({ model });
		expect((await generator.run({ prompt: 'Runtime prompt.' })).text).to.equal('OK');
		expect((await generator.run({ messages: [{ role: 'user', content: 'Runtime message.' }] })).text).to.equal('OK');
		expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([{ type: 'text', text: 'Runtime prompt.' }]);
		expect(model.doGenerateCalls[1].prompt[0].content).to.deep.equal([{ type: 'text', text: 'Runtime message.' }]);
	});

	it('should apply model and generation settings overrides for static text', async () => {
		const original = mockModel('ORIGINAL');
		const replacement = mockModel('REPLACEMENT');
		const generator = create.TextGenerator({ model: original, prompt: 'Configured prompt.', maxOutputTokens: 10 });
		const result = await generator.run({ model: replacement, maxOutputTokens: 25 });
		expect(result.text).to.equal('REPLACEMENT');
		expect(original.doGenerateCalls).to.have.length(0);
		expect(replacement.doGenerateCalls[0].maxOutputTokens).to.equal(25);
		expect(generator.config.model).to.equal(original);
	});

	it('should apply overrides after loading a text prompt', async () => {
		const original = mockModel('ORIGINAL');
		const replacement = mockModel('REPLACEMENT');
		const generator = create.TextGenerator.loadsText({
			model: original, prompt: 'configured', loader: { load: (name: string) => `Loaded ${name}` },
		});
		expect((await generator.run({ model: replacement, prompt: 'override' })).text).to.equal('REPLACEMENT');
		expect(replacement.doGenerateCalls[0].prompt[0].content).to.deep.equal([{ type: 'text', text: 'Loaded override' }]);
	});

	it('should process messages after an earlier text-only call', async () => {
		const model = mockModel('OK');
		const generator = create.TextGenerator({ model, prompt: 'Configured prompt.' });
		await generator();
		const messages: ModelMessage[] = [{ role: 'assistant', content: 'Earlier reply.' }];
		const result = await generator.run({ messages });
		expect(model.doGenerateCalls[1].prompt.map(({ role, content }) => ({ role, content }))).to.deep.equal([
			{ role: 'assistant', content: [{ type: 'text', text: 'Earlier reply.' }] },
			{ role: 'user', content: [{ type: 'text', text: 'Configured prompt.' }] },
		]);
		expect(result.response.messageHistory[0]).to.deep.equal(messages[0]);
		await generator();
		expect(model.doGenerateCalls[2].prompt).to.have.length(1);
	});

	it('should accept message-array prompts without wrapping them as user text', async () => {
		const model = mockModel('OK');
		const prompt: ModelMessage[] = [{ role: 'user', content: 'First.' }, { role: 'assistant', content: 'Second.' }];
		const generator = create.TextGenerator({ model, prompt });
		await generator();
		expect(model.doGenerateCalls[0].prompt.map(({ role, content }) => ({ role, content }))).to.deep.equal([
			{ role: 'user', content: [{ type: 'text', text: 'First.' }] },
			{ role: 'assistant', content: [{ type: 'text', text: 'Second.' }] },
		]);
	});

	it('should apply model and settings overrides for static text streams', async () => {
		const original = mockModel('ORIGINAL');
		const replacement = mockModel('REPLACEMENT');
		const streamer = create.TextStreamer({ model: original, prompt: 'Configured prompt.', maxOutputTokens: 10 });
		const result = streamer.run({ model: replacement, maxOutputTokens: 25 });
		expect(await result.text).to.equal('REPLACEMENT');
		expect(original.doStreamCalls).to.have.length(0);
		expect(replacement.doStreamCalls[0].maxOutputTokens).to.equal(25);
	});

	it('should process stream messages after an earlier text-only call', async () => {
		const firstModel = mockModel('FIRST');
		const model = mockModel('SECOND');
		const streamer = create.TextStreamer({ model: firstModel, prompt: 'Configured prompt.' });
		await streamer().consumeStream();
		const result = streamer.run({ model, messages: [{ role: 'assistant', content: 'Earlier reply.' }] });
		await result.consumeStream();
		expect(model.doStreamCalls[0].prompt.map(({ role, content }) => ({ role, content }))).to.deep.equal([
			{ role: 'assistant', content: [{ type: 'text', text: 'Earlier reply.' }] },
			{ role: 'user', content: [{ type: 'text', text: 'Configured prompt.' }] },
		]);
		expect((await result.response).messageHistory[0].role).to.equal('assistant');
	});
});
