import { runtimeRun } from './fixtures/runtime-call.js';
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
				const functionConfig = { ...config, prompt: ({ greeting, name }: { greeting: string; name: string }) => `${greeting} ${name}` };
				const component = promptType === 'template'
					? streaming ? create.LLMAgent.withTemplate.asStream(template) : create.LLMAgent.withTemplate(template)
					: promptType === 'script'
						? streaming ? create.LLMAgent.withScript.asStream(script) : create.LLMAgent.withScript(script)
						: streaming ? create.LLMAgent.withFunction.asStream(functionConfig) : create.LLMAgent.withFunction(functionConfig);
				const invoke: (context: { name: string }) => ReturnType<typeof component> = component;
				const result = await runtimeRun(component, { context: { name: 'Alice' } });
				expect(await result.text).to.equal('OK');
				const call = streaming ? model.doStreamCalls[0] : model.doGenerateCalls[0];
				expect(call.prompt[0].content).to.deep.equal([{ type: 'text', text: 'Hello Alice' }]);
				expect(validations).to.equal(1);
				expect(await (await invoke({ name: 'Bob' })).text).to.equal('OK');
				expect(validations).to.equal(2);
				await rejects(() => runtimeRun(component, { context: { name: 123 } }), /Application input validation failed/);
				await rejects(() => runtimeRun(component, { context: { name: undefined } }), /context object is required|Application input validation failed/);
				expect(component.config.context.name).to.equal('Configured');
			});
		}
	}

	it('should validate raw input once when replacing a function prompt', async () => {
		const model = mockModel('OK');
		let validations = 0;
		const generator = create.LLMAgent.withFunction({
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
		const generator = create.LLMAgent({ model });
		expect((await generator.run({ prompt: 'Runtime prompt.' })).text).to.equal('OK');
		expect((await generator.run({ prompt: [{ role: 'user', content: 'Runtime message.' }] })).text).to.equal('OK');
		expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([{ type: 'text', text: 'Runtime prompt.' }]);
		expect(model.doGenerateCalls[1].prompt[0].content).to.deep.equal([{ type: 'text', text: 'Runtime message.' }]);
	});

	it('should apply model and generation settings overrides for static text', async () => {
		const original = mockModel('ORIGINAL');
		const replacement = mockModel('REPLACEMENT');
		const generator = create.LLMAgent({ model: original, prompt: 'Configured prompt.', maxOutputTokens: 10 });
		const result = await generator.run({ model: replacement, maxOutputTokens: 25 });
		expect(result.text).to.equal('REPLACEMENT');
		expect(original.doGenerateCalls).to.have.length(0);
		expect(replacement.doGenerateCalls[0].maxOutputTokens).to.equal(25);
		expect(generator.config.model).to.equal(original);
	});

	it('should apply overrides after loading a text prompt', async () => {
		const original = mockModel('ORIGINAL');
		const replacement = mockModel('REPLACEMENT');
		const generator = create.LLMAgent.loadsText({
			model: original, prompt: 'configured', loader: { load: (name: string) => `Loaded ${name}` },
		});
		expect((await generator.run({ model: replacement, prompt: 'override' })).text).to.equal('REPLACEMENT');
		expect(replacement.doGenerateCalls[0].prompt[0].content).to.deep.equal([{ type: 'text', text: 'Loaded override' }]);
	});

	it('should process messages after an earlier text-only call', async () => {
		const model = mockModel('OK');
		const generator = create.LLMAgent({ model, prompt: 'Configured prompt.' });
		await generator();
		const messages: ModelMessage[] = [{ role: 'assistant', content: 'Earlier reply.' }];
		const result = await generator.run({ messageHistory: messages });
		expect(model.doGenerateCalls[1].prompt.map(({ role, content }) => ({ role, content }))).to.deep.equal([
			{ role: 'assistant', content: [{ type: 'text', text: 'Earlier reply.' }] },
			{ role: 'user', content: [{ type: 'text', text: 'Configured prompt.' }] },
		]);
		expect(result.messageHistory[0]).to.deep.equal(messages[0]);
		await generator();
		expect(model.doGenerateCalls[2].prompt).to.have.length(1);
	});

	it('should accept message-array prompts without wrapping them as user text', async () => {
		const model = mockModel('OK');
		const prompt: ModelMessage[] = [{ role: 'user', content: 'First.' }, { role: 'assistant', content: 'Second.' }];
		const generator = create.LLMAgent({ model, prompt });
		await generator();
		expect(model.doGenerateCalls[0].prompt.map(({ role, content }) => ({ role, content }))).to.deep.equal([
			{ role: 'user', content: [{ type: 'text', text: 'First.' }] },
			{ role: 'assistant', content: [{ type: 'text', text: 'Second.' }] },
		]);
	});

	it('should apply model and settings overrides for static text streams', async () => {
		const original = mockModel('ORIGINAL');
		const replacement = mockModel('REPLACEMENT');
		const streamer = create.LLMAgent.asStream({ model: original, prompt: 'Configured prompt.', maxOutputTokens: 10 });
		const result = (await streamer.run({ model: replacement, maxOutputTokens: 25 }));
		expect(await result.text).to.equal('REPLACEMENT');
		expect(original.doStreamCalls).to.have.length(0);
		expect(replacement.doStreamCalls[0].maxOutputTokens).to.equal(25);
	});

	it('should process stream messages after an earlier text-only call', async () => {
		const firstModel = mockModel('FIRST');
		const model = mockModel('SECOND');
		const streamer = create.LLMAgent.asStream({ model: firstModel, prompt: 'Configured prompt.' });
		await (await streamer()).consumeStream();
		const result = (await streamer.run({ model, messageHistory: [{ role: 'assistant', content: 'Earlier reply.' }] }));
		await result.consumeStream();
		expect(model.doStreamCalls[0].prompt.map(({ role, content }) => ({ role, content }))).to.deep.equal([
			{ role: 'assistant', content: [{ type: 'text', text: 'Earlier reply.' }] },
			{ role: 'user', content: [{ type: 'text', text: 'Configured prompt.' }] },
		]);
		expect((await result.messageHistory)[0].role).to.equal('assistant');
	});
});
