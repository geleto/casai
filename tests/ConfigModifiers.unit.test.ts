import assert from 'node:assert/strict';
import { create, z, ConfigError, ValidationError } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';
import { MockEmbeddingModelV4 } from 'ai/test';

describe('Config modifiers', () => {
	const removedSourceMessage = "'promptType' is not a setting. Select a source on Config or a component factory with .withText, .withTemplate, .withScript, .withFunction or a .loads… modifier.";
	const invocationSourceMessage = 'Source modifiers belong in configuration. Pass the Config fragment to a component factory.';
	const selectors = ['withText', 'withTemplate', 'withScript', 'withFunction', 'loadsText', 'loadsTemplate', 'loadsScript'] as const;
	for (const selector of selectors) {
		for (const delivery of ['ordinary', 'asTool', 'asStream'] as const) {
			it(`inherits ${selector} with ${delivery} through fragments and dispatches once`, async () => {
				const model = modelFor(undefined);
				const script = selector.endsWith('Script');
				const literal = selector.endsWith('Text');
				const rendered = script ? 'return "hello " ~ name' : literal ? 'hello Ada' : 'hello {{ name }}';
				const prompt = selector === 'withFunction' ? ({ name }: { name: string }) => `hello ${name}`
					: selector.startsWith('loads') ? 'greeting' : rendered;
				const input = { prompt, inputSchema: z.object({ name: z.string() }), context: { name: 'Ada' }, loader: { load: () => rendered } };
				// The runtime inventory independently exercises every factory path with erased input types.
				const factory = delivery === 'ordinary' ? create.Config[selector] : create.Config[selector][delivery];
				const fragment = Reflect.apply(factory, undefined, [input]) as { config: object };
				const inherited = Reflect.apply(create.Config, undefined, [{}, fragment]) as { config: object };
				const agent = Reflect.apply(create.LLMAgent, undefined, [{ model }, inherited]) as (() => Promise<unknown>) & { config: object };
				const result = await agent();
				if (delivery === 'asStream') await (result as { text: Promise<string> }).text;
				const calls = [...model.doGenerateCalls, ...model.doStreamCalls];
				assert.equal(calls.length, 1);
				assert.equal(model.doStreamCalls.length, delivery === 'asStream' ? 1 : 0);
				assert.equal(calls[0].prompt[0].role, 'user');
				assert.deepEqual(calls[0].prompt[0].content, [{ type: 'text', text: 'hello Ada' }]);
				assert.equal('promptType' in agent.config, false);
				assert.equal('execute' in fragment, false);
				assert.equal(typeof Reflect.get(agent, 'execute'), delivery === 'asTool' ? 'function' : 'undefined');
			});
		}
	}

	it('keeps incomplete fragments reusable and an unselected source absent', async () => {
		const common = create.Config.asTool({ context: { prefix: 'hello' } });
		assert.equal(Object.getOwnPropertySymbols(common.config).length, 0);
		const inputSchema = z.object({ name: z.string() });
		const fn = create.Function({ inputSchema, execute: ({ prefix, name }) => `${prefix} ${name}` }, common);
		const template = create.Template({ inputSchema, template: '{{ prefix }} {{ name }}' }, common);
		assert.equal(await fn({ name: 'Ada' }), 'hello Ada');
		assert.equal(await template.execute({ name: 'Ada' }, { toolCallId: 'test', messages: [], context: undefined }), 'hello Ada');
		const loaded = create.Config.loadsTemplate.asTool({});
		assert.throws(() => Reflect.apply(create.Template, undefined, [{}, loaded]), ConfigError);
		assert.equal(await create.Template({ template: 'greeting', inputSchema, loader: { load: () => '{{ name }}' } }, loaded)({ name: 'Ada' }), 'Ada');
	});

	it('replaces source modes without changing parents and preserves delivery modifiers', async () => {
		const original = create.Config.withScript.asTool({ prompt: 'return "script"', inputSchema: z.object({}) });
		const literal = create.Config.withText({ prompt: '{{ literal }}' }, original);
		const model = modelFor(undefined);
		await create.LLMAgent({ model }, literal)();
		assert.deepEqual(model.doGenerateCalls[0].prompt[0].content, [{ type: 'text', text: '{{ literal }}' }]);
		assert.equal(original.config.prompt, 'return "script"');
		assert.equal(literal.config.asTool, true);
		const streaming = create.Config.withTemplate({}, create.Config.asStream({ prompt: 'hello' }));
		assert.equal(streaming.config.streaming, true);
		assert.equal(create.Config.asTool({ asTool: undefined }).config.asTool, true);
		assert.equal(create.Config.asStream({ streaming: undefined }).config.streaming, true);
	});

	it('lets an explicit modifier replace a copied fragment source', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const prepared = create.Config.withFunction({ input: () => { throw new Error('The replaced preparer must not run.'); } });
		const literal = create.Embedder.withText({ ...prepared.config, model, input: 'literal' });
		assert.deepEqual((await literal()).embedding, [7]);
		const replacement = create.Embedder.withFunction({ ...create.Config.withText({ input: 'literal' }).config, model, input: () => 'prepared' });
		assert.deepEqual((await replacement()).embedding, [8]);
		assert.equal(await create.Template.withTemplate({ ...create.Config.withText({ context: { value: 'rendered' } }).config, template: '{{ value }}' })(), 'rendered');
		assert.equal(await create.Script.withScript({ ...create.Config.withFunction({}).config, script: 'return 3' })(), 3);
		const template = create.Config.withTemplate({ ...create.Config.withFunction({}).config, template: 'converted' });
		assert.equal(await create.Template({}, template)(), 'converted');
	});

	it('preserves native settings that are source fields on a different component', async () => {
		const model = modelFor(undefined);
		const fragment = create.Config.withFunction({
			instructions: [{ role: 'system', content: 'Keep {{ name }} literal.' }],
			inputSchema: z.object({ name: z.string() }),
			prompt: ({ name }) => `hello ${name}`,
		});
		await create.LLMAgent({ model }, fragment)({ name: 'Ada' });
		assert.deepEqual(model.doGenerateCalls[0].prompt.map(({ role, content }) => ({ role, content })), [
			{ role: 'system', content: 'Keep {{ name }} literal.' },
			{ role: 'user', content: [{ type: 'text', text: 'hello Ada' }] },
		]);
	});

	it('rejects authored promptType before modifiers can override it, including inheritance', () => {
		const factories = [create.Config as unknown, create.Config.withText as unknown, create.Config.withTemplate.asTool as unknown,
			create.LLMAgent.withText as unknown, create.Template as unknown, create.Function as unknown];
		for (const promptType of ['text', undefined]) {
			const raw = { promptType };
			for (const factory of factories) {
				const construct = factory as (...args: unknown[]) => unknown;
				assert.throws(() => Reflect.apply(construct, undefined, [raw]), { name: 'ConfigError', message: removedSourceMessage });
				assert.throws(() => Reflect.apply(construct, undefined, [{}, { config: raw }]), { name: 'ConfigError', message: removedSourceMessage });
			}
		}
	});

	it('keeps application promptType fields separate from source selection', async () => {
		const fragment = create.Config.withTemplate.asTool({ inputSchema: z.object({ promptType: z.string() }), template: '{{ promptType }}' });
		const component = create.Template({}, fragment);
		assert.equal(await component({ promptType: 'application value' }), 'application value');
		assert.equal(await component.run({ context: { promptType: 'named application value' } }), 'named application value');
		await assert.rejects(Reflect.apply(component.run, undefined, [{ promptType: 'text' }]) as Promise<unknown>, ValidationError);
	});

	it('explains removed source settings consistently on invocation entries', async () => {
		const model = modelFor(undefined);
		const agent = create.LLMAgent({ model, prompt: 'hello' });
		const template = create.Template({ template: 'hello' });
		const embedder = create.Embedder({ model: new MockEmbeddingModelV4(), input: 'hello' });
		for (const promptType of ['text', undefined]) {
			for (const invoke of [template.run, embedder.run, agent.run, agent.generate.bind(agent), agent.stream.bind(agent)]) {
				await assert.rejects(Reflect.apply(invoke, undefined, [{ promptType }]) as Promise<unknown>, { name: 'ValidationError', message: removedSourceMessage });
			}
			await assert.rejects(Reflect.apply(agent.resume, agent, [[], { promptType }]) as Promise<unknown>, { name: 'ValidationError', message: removedSourceMessage });
		}
		assert.equal(model.doGenerateCalls.length + model.doStreamCalls.length, 0);
	});

	it('explains copied source metadata on coded and specialized run calls', async () => {
		const template = create.Template({ template: 'hello' });
		const embedder = create.Embedder({ model: new MockEmbeddingModelV4(), input: 'hello' });
		for (const invoke of [template.run, embedder.run]) {
			await assert.rejects(Reflect.apply(invoke, undefined, [{ ...create.Config.withText({}).config }]) as Promise<unknown>, { name: 'ValidationError', message: invocationSourceMessage });
		}
	});

	it('strips internal source metadata before the SDK request hook', async () => {
		const fragment = create.Config.withTemplate({ prompt: 'hello {{ name }}', context: { name: 'Ada' } });
		const agent = create.LLMAgent({ model: modelFor(undefined), prepareCall: request => {
			assert.equal(Object.getOwnPropertySymbols(request).length, 0);
			assert.equal('promptType' in request, false);
			return request;
		} }, fragment);
		await agent();
	});

	it('rejects copied source metadata on every agent invocation entry', async () => {
		const model = modelFor(undefined);
		const agent = create.LLMAgent.withTemplate({ model, prompt: 'hello' });
		const replacement = create.Config.withText({ prompt: 'replacement' }).config;
		for (const invoke of [agent.run, agent.generate.bind(agent), agent.stream.bind(agent)]) {
			await assert.rejects(Reflect.apply(invoke, agent, [replacement]) as Promise<unknown>, { name: 'ValidationError', message: invocationSourceMessage });
		}
		await assert.rejects(Reflect.apply(agent.resume, agent, [[], create.Config.withText({}).config]) as Promise<unknown>, { name: 'ValidationError', message: invocationSourceMessage });
		assert.equal(model.doGenerateCalls.length + model.doStreamCalls.length, 0);
	});

	it('rejects unsupported delivery combinations and leaves reverse chains absent', () => {
		assert.equal('withTemplate' in create.Config.asTool, false);
		assert.equal('asTool' in create.Config.asStream, false);
		for (const [factory, parent] of [[create.Config.asTool, create.Config.asStream({})], [create.Config.asStream, create.Config.asTool({})]] as const) {
			assert.throws(() => Reflect.apply(factory, undefined, [{}, parent]), /asStream.*asTool/);
		}
		assert.throws(() => Reflect.apply(create.Template, undefined, [{ template: 'hello' }, create.Config.asStream({})]), /asStream/);
		assert.throws(() => Reflect.apply(create.Config, undefined, [{ streaming: false }]), ConfigError);
	});
});
