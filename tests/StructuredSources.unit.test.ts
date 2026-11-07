import assert from 'node:assert/strict';
import type { ModelMessage } from 'ai';
import { experimental_decide } from 'ai';
import { MockLanguageModelV4, MockImageModelV4, MockEmbeddingModelV4, Experimental_DecisionMockModelV4 } from 'ai/test';
import { create, z } from './cascada';

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

describe('native structured template sources', () => {
	it('accepts a single literal message in configured, named and prepared prompts', async () => {
		const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: 'text', text: 'answer' }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] }) });
		const prompt = Object.freeze({ role: 'user' as const, content: '{{ literal }}' });
		const history: ModelMessage[] = [{ role: 'user', content: 'earlier' }];
		const plain = create.LLMAgent({ model, prompt });
		for (const invoke of [
			() => plain.run({ messageHistory: history }),
			() => create.LLMAgent({ model }).run({ prompt, messageHistory: history }),
			() => create.LLMAgent.withFunction({ model, prompt: () => prompt }).run({ messageHistory: history }),
			() => create.LLMAgent.withScript({ model, prompt: 'return message', context: { message: prompt } }).run({ messageHistory: history }),
		]) {
			const result = await invoke();
			assert.deepEqual(result.messageHistory.slice(0, 2), [...history, prompt]);
			assert.equal(result.messageHistory[1], prompt);
			assert.deepEqual(model.doGenerateCalls.at(-1)!.prompt[1].content, [{ type: 'text', text: '{{ literal }}' }]);
		}
	});

	it('renders single-message templates without interpreting history or positional context as source', async () => {
		const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: 'text', text: 'answer' }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] }) });
		const image = Object.freeze({ type: 'image' as const, image: png });
		const text = Object.freeze({ type: 'text' as const, text: '{{ content }}' });
		const prompt = Object.freeze({ role: 'user' as const, content: [text, image] });
		const history: ModelMessage[] = [{ role: 'user', content: '{{ untouched() }}' }];
		const agent = create.LLMAgent.withTemplate({ model, prompt });
		const configured = await agent({ role: 'user', content: '{{ literal }}' }, history);
		const named = await agent.run({ prompt, context: { content: '{{ literal }}' }, messageHistory: history });
		assert.deepEqual(configured.messageHistory, named.messageHistory);
		assert.deepEqual(named.messageHistory[1], { role: 'user', content: [{ type: 'text', text: '{{ literal }}' }, image] });
		assert.equal(named.messageHistory[0], history[0]);
		assert.equal((named.messageHistory[1].content as unknown[])[1], image);
		assert.equal(text.text, '{{ content }}');
		await agent.run({ prompt: { role: 'user', content: 'Hello {{ name }}' }, context: { name: 'Ada' } });
		assert.equal((model.doGenerateCalls.at(-1)!.prompt[0].content[0] as { text: string }).text, 'Hello Ada');
	});

	it('renders frozen decision parts through configured, positional and named sources', async () => {
		const calls: Parameters<Experimental_DecisionMockModelV4['doDecide']>[0][] = [];
		const model = new Experimental_DecisionMockModelV4({ doDecide: async request => {
			calls.push(request);
			return { answers: { route: { type: 'boolean', probability: 1 } }, warnings: [] };
		} });
		const questions = { route: { type: 'boolean' as const, instructions: 'Continue?' } };
		const json = Object.freeze({ type: 'json' as const, value: Object.freeze({ literal: '{{ subject }}' }) });
		const source = Object.freeze([Object.freeze({ type: 'text' as const, text: '{{ subject }}' }), json] as const);
		const decide = create.Decision.withTemplate({ model, questions, state: source, inputSchema: z.object({ subject: z.string() }) });
		await decide({ subject: 'configured' });
		await decide(source, { subject: 'positional' });
		await decide.run({ state: source, context: { subject: 'named' } });
		for (const [index, subject] of ['configured', 'positional', 'named'].entries()) {
			await experimental_decide({ model, questions, state: Object.freeze([{ type: 'text' as const, text: subject }, json]) });
			assert.deepEqual(calls[index].state, calls.at(-1)!.state);
			assert.equal(calls[index].state[1], json);
		}
		assert.equal(source[0].text, '{{ subject }}');
		assert.equal(json.value.literal, '{{ subject }}');
	});

	it('renders selected message text while preserving attachments, tool data and literal history', async () => {
		const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: 'text', text: 'answer' }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] }) });
		const source: ModelMessage[] = [
			{ role: 'user', content: [{ type: 'text', text: '{{ subject }}' }, { type: 'image', image: png }] },
			{ role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'call', toolName: 'lookup', input: { text: '{{ subject }}' } }] },
			{ role: 'tool', content: [{ type: 'tool-result', toolCallId: 'call', toolName: 'lookup', output: { type: 'json', value: { text: '{{ subject }}' } } }] },
		];
		const history: ModelMessage[] = [{ role: 'user', content: '{{ literal }}' }];
		const before = structuredClone(source);
		const agent = create.LLMAgent.withTemplate({ model, prompt: source, inputSchema: z.object({ subject: z.string() }) });
		await agent({ subject: 'rendered' }, history);
		const sent = model.doGenerateCalls[0].prompt;
		assert.deepEqual(sent[0].content, [{ type: 'text', text: '{{ literal }}' }]);
		assert.equal((sent[1].content[0] as { text: string }).text, 'rendered');
		assert.deepEqual((sent[2].content[0] as { input: unknown }).input, { text: '{{ subject }}' });
		assert.deepEqual((sent[3].content[0] as { output: unknown }).output, { type: 'json', value: { text: '{{ subject }}' } });
		assert.deepEqual(source, before);
		await create.Script({ script: 'return agent.run(prompt=source, context={subject: "keywords"})', context: { agent, source } })();
		assert.equal((model.doGenerateCalls[1].prompt[0].content[0] as { text: string }).text, 'keywords');
		await agent.generate({ options: { subject: 'ignored' }, prompt: source });
		assert.equal((model.doGenerateCalls[2].prompt[0].content[0] as { text: string }).text, '{{ subject }}');
	});

	it('uses independent native renders concurrently and preserves message order', async () => {
		const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: 'text', text: 'ok' }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] }) });
		const releases: (() => void)[] = [];
		let both!: () => void;
		const started = new Promise<void>(resolve => { both = resolve; });
		const slot = (value: string) => new Promise<string>(resolve => { releases.push(() => { resolve(value); }); if (releases.length === 2) both(); });
		const agent = create.LLMAgent.withTemplate({ model, context: { slot }, prompt: [
			{ role: 'user', content: [{ type: 'text', text: '{{ slot("first") }}' }, { type: 'text', text: '{{ slot("second") }}' }] },
		] });
		const pending = agent();
		await started;
		releases[1](); releases[0]();
		await pending;
		assert.deepEqual(model.doGenerateCalls[0].prompt[0].content, [{ type: 'text', text: 'first', providerOptions: undefined }, { type: 'text', text: 'second', providerOptions: undefined }]);
	});

	it('never renders positional history again and renders only explicit new prompt sources', async () => {
		let effects = 0;
		const marker = '{{ effect() }}';
		const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: 'text', text: marker }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] }) });
		const agent = create.LLMAgent.withTemplate({ model, prompt: '{{ text }}', context: { text: marker, effect: () => { effects++; return 'executed'; } } });
		const first = await agent();
		const before = structuredClone(first.messageHistory);
		await agent(first.messageHistory);
		assert.equal(model.doGenerateCalls[1].prompt.length, 3);
		for (const message of model.doGenerateCalls[1].prompt) {
			assert.equal((message.content[0] as { text: string }).text, marker);
		}
		await agent('Hello {{ name }}', { name: 'Ada' }, first.messageHistory);
		assert.equal((model.doGenerateCalls[2].prompt.at(-1)!.content[0] as { text: string }).text, 'Hello Ada');
		await agent.run({ messageHistory: first.messageHistory, context: { company: 'Acme', name: 'Ada' }, prompt: [
			{ role: 'user', content: 'Company: {{ company }}' }, { role: 'user', content: 'Hello {{ name }}' },
		] });
		const sent = model.doGenerateCalls[3].prompt;
		assert.equal((sent.at(-2)!.content[0] as { text: string }).text, 'Company: Acme');
		assert.equal((sent.at(-1)!.content[0] as { text: string }).text, 'Hello Ada');
		assert.equal(effects, 0);
		assert.deepEqual(first.messageHistory, before);
	});

	it('accepts literal positional history across all modes and keeps keyword context separate', async () => {
		const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: 'text', text: 'answer' }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] }) });
		const history: readonly ModelMessage[] = Object.freeze([{ role: 'user', content: '{{ untouched() }}' }]);
		for (const invoke of [
			() => create.LLMAgent({ model, prompt: 'new' })(history),
			() => create.LLMAgent.withTemplate({ model, prompt: 'new' })(history),
			() => create.LLMAgent.withScript({ model, prompt: 'return "new"' })(history),
			() => create.LLMAgent.withFunction({ model, prompt: () => 'new' })(history),
			() => create.LLMAgent.loadsText({ model, loader: () => 'new', prompt: 'file' })(history),
		]) {
			await invoke();
			const sent = model.doGenerateCalls.at(-1)!.prompt;
			assert.equal((sent[0].content[0] as { text: string }).text, '{{ untouched() }}');
			assert.equal((sent[1].content[0] as { text: string }).text, 'new');
		}
		const noPrompt = create.LLMAgent.withTemplate({ model, inputSchema: z.object({ name: z.string() }) });
		await noPrompt({ name: 'Ada' }, history);
		assert.equal(model.doGenerateCalls.at(-1)!.prompt.length, 1);
		const agent = create.LLMAgent.withTemplate({ model, prompt: 'Hello {{ name }}', inputSchema: z.object({ name: z.string() }) });
		await create.Script({ script: 'return agent(history, name="Ada").text', context: { agent, history } })();
		assert.equal((model.doGenerateCalls.at(-1)!.prompt[1].content[0] as { text: string }).text, 'Hello Ada');
		const plain = create.LLMAgent({ model, prompt: 'new', inputSchema: z.object({ name: z.string() }) });
		await create.Script({ script: 'return plain(history, name="Ada").text', context: { plain, history } })();
		assert.equal((model.doGenerateCalls.at(-1)!.prompt[1].content[0] as { text: string }).text, 'new');
	});

	it('keeps structured image sources distinct from context, including undefined forwarding and Cascada keywords', async () => {
		const requests: Parameters<MockImageModelV4['doGenerate']>[0][] = [];
		const model = new MockImageModelV4({ doGenerate: async request => { requests.push(request); return { images: [png], warnings: [], response: { timestamp: new Date(0), modelId: 'image', headers: {} } }; } });
		const original = { images: [png], mask: png, text: '{{ prompt }}' };
		const image = create.ImageGenerator.withTemplate({ model, prompt: original, inputSchema: z.object({ prompt: z.string() }) });
		await image({ prompt: '{{ literal }}' }, undefined);
		assert.equal(requests[0].prompt, '{{ literal }}');
		await image({ text: '{{ prompt }}', images: [] }, { prompt: 'replacement' });
		assert.equal(requests[1].mask, undefined);
		assert.deepEqual(requests[1].files, []);
		await image.run({ context: { prompt: 'split' }, images: [] });
		assert.equal(requests[2].files, undefined);
		const wrapper = create.Script({ script: 'return image(prompt="keywords")', context: { image } });
		await wrapper();
		assert.equal(requests[3].prompt, 'keywords');
		assert.equal(original.text, '{{ prompt }}');
	});

	it('reuses native loaders and raw script/function results for specialized sources', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const text = create.Embedder.loadsText({ model, loader: name => name === 'entry' ? '{{ literal }}' : null, input: 'entry' });
		assert.deepEqual((await text()).embedding, [13]);
		const template = create.Embedder.loadsTemplate({ model, loader: () => '{{ value }}', input: 'entry' });
		assert.deepEqual((await template({ value: 'abc' })).embedding, [3]);
		const script = create.Embedder.loadsScript({ model, loader: () => 'return [value, value]', input: 'entry' });
		const batch = await script({ value: 'abc' });
		assert.ok('embeddings' in batch);
		assert.deepEqual(batch.embeddings, [[3], [3]]);
		const inline = create.Embedder.withScript({ model, input: 'return [value]' });
		const singleBatch = await inline({ value: 'a' });
		assert.ok('embeddings' in singleBatch);
		assert.deepEqual(singleBatch.embeddings, [[1]]);
		const literal = create.Embedder.withText({ input: 'literal' }, inline);
		assert.deepEqual((await literal()).embedding, [7]);
	});
});
