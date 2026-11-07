import assert from 'node:assert/strict';
import type { Tool } from 'ai';
import { asSchema, embed, rerank, tool, ToolLoopAgent, isStepCount, experimental_decide, experimental_streamSpeech, UnsupportedFunctionalityError, Experimental_DecisionRefusalError } from 'ai';
import { MockEmbeddingModelV4, MockRerankingModelV4, MockTranscriptionModelV4, MockSpeechModelV4,
	Experimental_MockStreamingSpeechModelV4, Experimental_MockSpeechTranslationModelV4, Experimental_DecisionMockModelV4, MockImageModelV4, MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test';
import { create, z, ValidationError, ConfigError } from './cascada';
import { runtimeRun } from './fixtures/runtime-call.js';

const audio = () => convertArrayToReadableStream([new Uint8Array([1, 2])]);
const inputAudioFormat = { type: 'audio/pcm', rate: 24000 };
const finish = { type: 'finish' as const, text: 'finished', segments: [{ text: 'finished', startSecond: 0, endSecond: 1 }], language: 'en', providerMetadata: { fixture: { native: true } } };

describe('shared component call rules', () => {
	it('rejects misnamed plain-tool schemas before calling the model', async () => {
		const model = new MockLanguageModelV4();
		const embedding = new MockEmbeddingModelV4();
		const invalid = Reflect.apply(create.Embedder.asTool, undefined, [{ model: embedding, inputSchema: z.object({ custom: z.string() }) }]) as Tool;
		const agent = new ToolLoopAgent({ model, tools: { embedding: invalid } });
		await assert.rejects(agent.generate({ prompt: 'Embed the input.' }), error => error instanceof ConfigError && error.message.includes("only 'input'"));
		assert.equal(model.doGenerateCalls.length, 0);
		assert.equal(embedding.doEmbedCalls.length, 0);
	});

	it('requires a named template source when only the loader is configured', async () => {
		const configured = create.Template({ template: 'ready' });
		const loaded = create.Template.loadsTemplate({ loader: { load: () => 'ready' } });
		assert.equal(await configured.run(), 'ready');
		await assert.rejects(runtimeRun(loaded), ValidationError);
		await assert.rejects(runtimeRun(loaded, {}), ValidationError);
		assert.equal(await loaded.run({ template: 'entry' }), 'ready');
	});

	it('requires a named script source when only the loader is configured', async () => {
		const configured = create.Script({ script: 'return "ready"' });
		const loaded = create.Script.loadsScript({ loader: { load: () => 'return "ready"' } });
		assert.equal(await configured.run(), 'ready');
		await assert.rejects(runtimeRun(loaded), ValidationError);
		await assert.rejects(runtimeRun(loaded, {}), ValidationError);
		assert.equal(await loaded.run({ script: 'entry' }), 'ready');
	});

	it('accepts object-instance application fields consistently across shorthand and named calls', async () => {
		class ApplicationInput { name = 'Ada'; }
		const inputSchema = z.object({ name: z.string() });
		const template = create.Template({ template: '{{ name }}', inputSchema });
		const script = create.Script({ script: 'return name', inputSchema });
		const fn = create.Function({ inputSchema, execute: ({ name }) => name });
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const embedding = create.Embedder.withFunction({ model, inputSchema, input: ({ name }) => name });
		const language = new MockLanguageModelV4({ doGenerate: async () => ({
			content: [{ type: 'text', text: 'ok' }], finishReason: { unified: 'stop', raw: 'stop' },
			usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } }, warnings: [],
		}) });
		const agent = create.LLMAgent.withFunction({ model: language, inputSchema, prompt: ({ name }) => name });
		const context = new ApplicationInput();
		assert.deepEqual(inputSchema.parse(context), { name: 'Ada' });
		assert.equal(await template(context), await template.run({ context }));
		assert.equal(await template('Hello {{ name }}', context), 'Hello Ada');
		assert.equal(await script(context), await script.run({ context }));
		assert.equal(await script('return name ~ "!"', context), 'Ada!');
		assert.equal(await fn(context), 'Ada');
		assert.equal((await agent(context)).text, 'ok');
		assert.deepEqual(language.doGenerateCalls[0].prompt[0].content, [{ type: 'text', text: 'Ada' }]);
		assert.deepEqual((await embedding(context)).embedding, (await embed({ model, value: 'Ada' })).embedding);
		assert.deepEqual((await embedding.run({ context })).embedding, [3]);
		assert.deepEqual((await embedding(({ name }) => name.toUpperCase(), context)).embedding, [3]);
		// Preparation keeps the existing own-field snapshot; it does not retain a live instance view.
		const pending = template(context);
		context.name = 'changed';
		assert.equal(await pending, 'Ada');
		assert.equal(await template(context), 'changed');
		await assert.rejects(async () => { await Reflect.apply(template, undefined, [context, { __hasKeywordArgs: true, name: 'shadow' }]); }, /either a context object or named arguments/);
	});

	it('uses ordinary and bound preparation context with configured or inherited tool mode', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const defaults = { model, inputSchema: z.object({}), toolContextSchema: z.object({ secret: z.string() }), context: { secret: 1 } };
		const configured = create.Embedder.withFunction({ ...defaults, asTool: true, input: ({ secret }) => String(secret) });
		const inherited = create.Embedder.withFunction({ input: ({ secret }) => String(secret) }, create.Config({ ...defaults, asTool: true }));
		for (const component of [configured, inherited]) {
			assert.deepEqual((await component()).embedding, (await embed({ model, value: '1' })).embedding);
			assert.deepEqual((await component(({ secret }) => secret.toFixed(2))).embedding, (await embed({ model, value: '1.00' })).embedding);
			assert.deepEqual((await component.run({ input: ({ secret }) => secret.toFixed(3) })).embedding, (await embed({ model, value: '1.000' })).embedding);
			const bound = component.bindToolContext({ secret: 'bound' });
			assert.deepEqual(await bound.tool.execute!({}, { toolCallId: 'bound', messages: [], context: bound.context }),
				(await embed({ model, value: 'bound' })).embedding);
			assert.deepEqual((await component()).embedding, (await embed({ model, value: '1' })).embedding);
			assert.equal(component.config.context.secret, 1);
		}
	});

	it('keeps ordinary agent source and hook replacements local to the invocation', async () => {
		const model = new MockLanguageModelV4({ doGenerate: async () => ({
			content: [{ type: 'text', text: 'ok' }], finishReason: { unified: 'stop', raw: 'stop' },
			usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } }, warnings: [],
		}) });
		const prepared: (string | number)[] = [];
		const agent = create.LLMAgent.withFunction.asTool({ model, inputSchema: z.object({}), context: { secret: 1 },
			toolContextSchema: z.object({ secret: z.string() }), prompt: ({ secret }) => { prepared.push(secret); return String(secret); } });
		const hooks: string[] = [];
		assert.equal((await agent.run({
			prompt: ({ secret }) => secret.toFixed(2),
			prepareCall: (request, _config, { secret }) => { hooks.push(secret.toFixed(3)); return request; },
			prepareStep: (_step, _config, { secret }) => { hooks.push(secret.toFixed(4)); return {}; },
		})).text, 'ok');
		const bound = agent.bindToolContext({ secret: 'bound' });
		assert.equal(await bound.tool.execute!({}, { toolCallId: 'agent', messages: [], context: bound.context }), 'ok');
		assert.equal((await agent()).text, 'ok');
		assert.deepEqual(hooks, ['1.000', '1.0000']);
		assert.deepEqual(prepared, ['bound', 1]);
		assert.deepEqual(model.doGenerateCalls.map(({ prompt }) => prompt[0].content), [
			[{ type: 'text', text: '1.00' }],
			[{ type: 'text', text: 'bound' }],
			[{ type: 'text', text: '1' }],
		]);
	});

	it('clears configured sources and callbacks while retaining call-time omission rules', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		let ends = 0;
		const parent = create.Embedder({ model, input: 'configured', onEnd: () => { ends++; } });
		const child = create.Embedder({ input: undefined, onEnd: undefined }, parent);
		assert.equal(child.config.input, undefined);
		assert.equal(child.config.onEnd, undefined);
		assert.deepEqual((await child('replacement')).embedding, (await embed({ model, value: 'replacement' })).embedding);
		assert.equal(ends, 0);
		assert.deepEqual((await parent.run({ input: undefined, onEnd: undefined })).embedding, [10]);
		assert.equal(ends, 1);
		const prepared = create.Embedder.withFunction({ model, input: () => 'configured' });
		const cleared = create.Embedder.withFunction({ input: undefined }, prepared);
		assert.deepEqual((await cleared(() => 'replacement')).embedding, [11]);
	});

	it('uses replacement documents independently of source and context placeholders', async () => {
		const model = new MockRerankingModelV4({ doRerank: async () => ({ ranking: [{ index: 0, relevanceScore: 1 }], warnings: [] }) });
		const plain = create.Reranker({ model, query: 'q', documents: [{ original: true }] });
		const prepared = create.Reranker.withFunction({ model, query: () => ({ query: 'q', documents: [{ original: true }] }) });
		const native = await rerank({ model, query: 'q', documents: ['replacement'] });
		for (const result of [await plain(['replacement']), await plain(undefined, ['replacement']), await plain.run({ documents: ['replacement'] }),
			await prepared(['replacement']), await prepared(undefined, undefined, ['replacement']), await prepared.run({ documents: ['replacement'] })]) {
			assert.equal(result.ranking[0].document.toUpperCase(), native.ranking[0].document.toUpperCase());
		}
		assert.deepEqual((await plain(undefined, undefined)).ranking[0].document, { original: true });
		assert.deepEqual((await prepared(undefined, undefined, undefined)).ranking[0].document, { original: true });
	});

	it('captures ordinary application input before asynchronous tool metadata, including cached metadata', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const inputSchema = z.object({ input: z.string().min(1) });
		const ordinary = create.Embedder({ model, inputSchema, input: 'fixed' });
		const plain = create.Embedder.asTool({ model, inputSchema, input: 'fixed' });
		const prepared = create.Embedder.withFunction.asTool({ model, inputSchema, input: ({ input }) => input });
		for (let pass = 0; pass < 2; pass++) {
			for (const [component, length] of [[ordinary, 5], [plain, 6], [prepared, 6]] as const) {
				const context = { input: 'before' };
				const pending = component.run({ context });
				context.input = '';
				assert.deepEqual((await pending).embedding, [length]);
			}
		}
		const value = { input: 'before' };
		const parsed = asSchema(inputSchema).validate!(value);
		value.input = '';
		assert.deepEqual(await parsed, { success: true, value: { input: 'before' } });
		const observed: string[] = [];
		const agent = new ToolLoopAgent({
			model: new MockLanguageModelV4({ doGenerate: async () => ({
				content: [{ type: 'text', text: 'ok' }], finishReason: { unified: 'stop', raw: 'stop' },
				usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } }, warnings: [],
			}) }),
			callOptionsSchema: inputSchema,
			prepareCall: ({ options, ...settings }) => { observed.push(options.input); return { ...settings, prompt: options.input }; },
		});
		const options = { input: 'before' };
		const generation = agent.generate({ prompt: 'unused', options });
		options.input = '';
		await generation;
		assert.deepEqual(observed, ['before']);
	});

	it('selects plain tool input from parsed payload rather than injected helpers', async () => {
		const seen: unknown[] = [];
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => {
			seen.push(values[0]);
			return { embeddings: [[1]], warnings: [] };
		} });
		let parses = 0;
		const inputSchema = z.object({ input: z.string() }).transform(() => { parses++; return {}; });
		const input = create.Function.asTool({ inputSchema: z.object({}), execute: () => 'helper' });
		const component = create.Embedder.asTool({ model, inputSchema, input: 'fallback', tools: { input } });
		const parsed = await asSchema(component.inputSchema).validate!({ input: 'raw' });
		if (!parsed.success) throw parsed.error;
		assert.deepEqual(await component.execute(parsed.value, { toolCallId: 'component', messages: [], context: undefined }), [1]);
		const workflow = create.Function({ tools: { component }, execute: ({ component }) => component({ input: 'raw' }) });
		assert.deepEqual(await workflow(), [1]);
		assert.equal(parses, 2);
		const noHelper = create.Embedder.asTool({ model, inputSchema, input: 'fallback' });
		await noHelper.execute({}, { toolCallId: 'no-helper', messages: [], context: undefined });
		const retained = create.Embedder.asTool({ model, inputSchema: z.object({ input: z.string() }), input: 'fallback', tools: { input } });
		await retained.execute({ input: 'retained' }, { toolCallId: 'retained', messages: [], context: undefined });
		const native = tool({ inputSchema, execute: async () => (await embed({ model, value: 'fallback' })).embedding });
		const language = new MockLanguageModelV4({ doGenerate: async () => ({
			content: [{ type: 'tool-call', toolCallId: 'call', toolName: 'embedding', input: '{"input":"raw"}' }],
			finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
			usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } }, warnings: [],
		}) });
		for (const embedding of [component, native]) {
			const result = await new ToolLoopAgent({ model: language, tools: { embedding }, stopWhen: isStepCount(1) }).generate({ prompt: 'embed' });
			assert.deepEqual(result.toolResults[0].output, [1]);
		}
		assert.deepEqual(seen, ['fallback', 'fallback', 'fallback', 'retained', 'fallback', 'fallback']);
	});

	it('resolves renderer requirements independently for inline and loaded branches', async () => {
		const loader = { load: (name: string) => name === 'template' ? 'ready' : 'return "ready"' };
		for (const loaded of [false, true]) {
			const template = loaded ? { promptType: 'async-template-name' as const, template: 'template', loader }
				: { promptType: 'async-template' as const, template: 'ready' };
			const script = loaded ? { promptType: 'async-script-name' as const, script: 'script', loader }
				: { promptType: 'async-script' as const, script: 'return "ready"' };
			assert.equal(await create.Template(template)(), 'ready');
			assert.equal(await create.Script(script)(), 'ready');
		}
	});

	it('keeps safe calls usable across literal, prepared and loaded source alternatives', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		for (const prepared of [false, true]) {
			const config = prepared ? { model, promptType: 'function' as const, input: () => 'ready' }
				: { model, promptType: 'text' as const, input: 'ready' };
			const component = create.Embedder(config);
			for (const result of [await component(), await component(undefined), await component.run({}), await component.run({ input: undefined, headers: { trace: 'test' } })]) {
				assert.deepEqual(result.embedding, [5]);
			}
		}
		for (const promptType of ['text', 'async-template'] as const) {
			const component = create.Embedder({ model, promptType, input: 'ready' });
			assert.deepEqual((await component('replacement')).embedding, [11]);
			assert.deepEqual((await component.run({ input: 'replacement' })).embedding, [11]);
		}
		for (const loaded of [false, true]) {
			const config = loaded ? { model, promptType: 'text-name' as const, input: 'ready', loader: { load: (name: string) => name } }
				: { model, promptType: 'text' as const, input: 'ready' };
			assert.deepEqual((await create.Embedder(config)('source')).embedding, [6]);
		}
	});

	it('retains valid shorthand roles in each source mode', async () => {
		const requests: { text: string; voice: string | undefined }[] = [];
		const model = new MockSpeechModelV4({ doGenerate: async ({ text, voice }) => {
			requests.push({ text, voice });
			return { audio: 'AQI=', warnings: [], response: { timestamp: new Date(0), modelId: 'speech' } };
		} });
		for (const prepared of [false, true]) {
			const config = prepared ? { model, promptType: 'function' as const, text: () => 'ready' }
				: { model, promptType: 'text' as const, text: 'ready' };
			await create.SpeechGenerator(config)('alloy');
		}
		assert.deepEqual(requests, [{ text: 'alloy', voice: undefined }, { text: 'ready', voice: 'alloy' }]);
	});

	it('preserves mixed-mode tool payloads across named, descriptor and injected calls', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const inputSchema = z.object({ input: z.string().transform(value => value + '!') });
		for (const prepared of [false, true]) {
			const config = prepared ? { model, inputSchema, promptType: 'function' as const, input: ({ input }: { input: string }) => input }
				: { model, inputSchema, promptType: 'text' as const, input: 'configured' };
			const component = create.Embedder.asTool(config);
			assert.deepEqual((await component.run({ context: { input: 'call' } })).embedding, [5]);
			const parsed = await asSchema(component.inputSchema).validate!({ input: 'call' });
			assert.equal(parsed.success, true);
			assert.deepEqual(await component.execute(parsed.value, { toolCallId: 'test', messages: [], context: undefined }), [5]);
			const owner = create.Function({ tools: { component }, execute: ({ component }) => component({ input: 'call' }) });
			assert.deepEqual(await owner(), [5]);
		}
	});

	it('uses final private bindings and native settings when their implementations are replaced', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const parent = create.Embedder.withFunction({ model, context: { prefix: 'old' }, input: ({ prefix }) => prefix.toUpperCase() });
		const child = create.Embedder.withFunction({ context: { prefix: 42 }, input: ({ prefix }) => {
			const value: number = prefix;
			return value.toFixed(1);
		} }, parent);
		assert.deepEqual((await child()).embedding, [4]);
		assert.deepEqual((await parent()).embedding, [3]);
		const fragment = create.Config({ model: new MockImageModelV4() });
		const changed = create.Embedder({ model, input: 'replaced' }, fragment);
		assert.deepEqual((await changed()).embedding, (await embed({ ...fragment.config, model, value: 'replaced' })).embedding);
	});

	it('delegates callback aliases and canonical precedence to the SDK', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const events: string[] = [];
		type End = NonNullable<Parameters<typeof embed<{ requestId: string }>>[0]['experimental_onEnd']>;
		const alias: End = event => { events.push(event.runtimeContext.requestId); };
		const fragment = create.Config({ model, input: 'x', runtimeContext: { requestId: 'alias' }, experimental_onEnd: alias });
		await create.Embedder({}, fragment)();
		await create.Embedder({ onEnd: () => { events.push('canonical'); } }, fragment)();
		await embed({ model, value: 'x', runtimeContext: { requestId: 'native' }, experimental_onEnd: alias });
		assert.deepEqual(events, ['alias', 'canonical', 'native']);
	});

	it('resolves schema defaults and configured fallbacks for plain tools', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const fallback = create.Embedder.asTool({ model, input: 'fallback', inputSchema: z.object({ input: z.string().optional() }) });
		const defaulted = create.Embedder.asTool({ model, inputSchema: z.object({ input: z.string().default('default') }) });
		const removed = create.Embedder.asTool({ model, input: 'fallback', inputSchema: z.object({ input: z.string() }).transform(() => ({})) });
		const workflow = create.Function({ tools: { fallback, defaulted, removed }, execute: async ({ fallback, defaulted, removed }) => [
			await fallback({}), await fallback({ input: 'call' }), await defaulted({}), await removed({ input: 'raw' }),
		] });
		assert.deepEqual(await workflow(), [[8], [4], [7], [8]]);
	});

	it('keeps prepared context distinct from audio formats and admits unambiguous voice/language settings', async () => {
		const formats: unknown[] = [];
		const transcription = new MockTranscriptionModelV4({ doStream: async ({ inputAudioFormat: format }) => {
			formats.push(format);
			return { stream: convertArrayToReadableStream([finish]) };
		} });
		const transcribe = create.StreamingTranscriber.withFunction({ model: transcription, audio });
		await (await transcribe({}, inputAudioFormat)).text;
		await (await transcribe(undefined, undefined, inputAudioFormat)).text;
		await (await transcribe(audio, undefined, inputAudioFormat)).text;
		await (await transcribe.run({ inputAudioFormat })).text;
		assert.deepEqual(formats, Array.from({ length: 4 }, () => inputAudioFormat));

		const voices: unknown[] = [];
		const speech = new MockSpeechModelV4({ doGenerate: async ({ text, voice }) => {
			assert.equal(text, 'hello');
			voices.push(voice);
			return { audio: 'AQI=', warnings: [], response: { timestamp: new Date(0), modelId: 'speech' } };
		} });
		const speak = create.SpeechGenerator.withFunction({ model: speech, text: () => 'hello' });
		await speak('alloy');
		await speak(undefined, 'alloy');
		await speak({}, 'alloy');
		await speak.run({ voice: 'alloy' });
		assert.deepEqual(voices, ['alloy', 'alloy', 'alloy', 'alloy']);

		const languages: string[] = [];
		const translation = new Experimental_MockSpeechTranslationModelV4({ doStream: async ({ inputAudioFormat: format, targetLanguage }) => {
			assert.deepEqual(format, inputAudioFormat);
			languages.push(targetLanguage);
			return { stream: convertArrayToReadableStream([{ type: 'finish', sourceText: 'hello', outputText: 'bonjour' }]) };
		} });
		const translate = create.StreamingTranslator.withFunction({ model: translation, audio });
		await (await translate({}, inputAudioFormat, 'fr')).translationText;
		await (await translate(undefined, undefined, inputAudioFormat, 'fr')).translationText;
		const formatted = create.StreamingTranslator.withFunction({ inputAudioFormat }, translate);
		await (await formatted('fr')).translationText;
		await (await formatted(undefined, 'fr')).translationText;
		assert.deepEqual(languages, ['fr', 'fr', 'fr', 'fr']);
	});

	it('uses effective Reranker producers and explicit documents across call paths', async () => {
		const model = new MockRerankingModelV4({ doRerank: async () => ({ ranking: [{ index: 0, relevanceScore: 1 }], warnings: [] }) });
		const rank = create.Reranker.withFunction({ model, query: () => ({ query: 'configured', documents: ['configured'] }) });
		const replacement = () => ({ query: 'replacement', documents: [{ title: 'replacement' }] });
		assert.equal((await rank(replacement)).ranking[0].document.title, 'replacement');
		assert.equal((await rank.run({ query: replacement })).ranking[0].document.title, 'replacement');
		const mixed = create.Reranker.withFunction.asTool({ model, inputSchema: z.object({ paired: z.boolean() }), documents: ['fallback'],
			query: ({ paired }) => paired ? { query: 'paired', documents: ['paired'] } : 'query' });
		for (const paired of [false, true]) {
			const expected = paired ? 'paired' : 'fallback';
			assert.equal((await mixed({ paired })).ranking[0].document, expected);
			assert.equal((await mixed.run({ context: { paired } })).ranking[0].document, expected);
			assert.equal((await mixed.execute({ paired }, { toolCallId: 'rank', messages: [], context: undefined }))[0].document, expected);
			assert.equal((await mixed({ paired }, ['override'])).ranking[0].document, 'override');
		}
	});

	it('infers and executes reusable preparers with parsed application values and private context', async () => {
		const fragment = create.Config({ promptType: 'function', inputSchema: z.object({ count: z.string().transform(Number) }),
			context: { prefix: 'n=' }, input: ({ count, prefix }) => prefix + count.toFixed(1) });
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => {
			assert.deepEqual(values, ['n=2.0']);
			return { embeddings: [[2]], warnings: [] };
		} });
		const embed = create.Embedder({ model }, fragment);
		assert.deepEqual((await embed({ count: '2' })).embedding, [2]);
	});

	it('forwards omitted sources through the same application boundary on old and new tools', async () => {
		const inputSchema = z.object({ value: z.string().transform(value => value.toUpperCase()) });
		const context = { value: 'default', secret: 'private' };
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), warnings: [] }) });
		const cases = [
			{ main: 'template', component: create.Template.asTool({ template: '{{ value }}', inputSchema, context }), expected: 'CALL' },
			{ main: 'script', component: create.Script.asTool({ script: 'return value', schema: z.string(), inputSchema, context }), expected: 'CALL' },
			{ main: 'input', component: create.Embedder.withTemplate.asTool({ model, input: '{{ value }}', inputSchema, context }), expected: [4] },
		];
		for (const { main, component, expected } of cases) {
			for (const result of [await Reflect.apply(component, undefined, [undefined, { value: 'call' }]),
				await Reflect.apply(component.run, undefined, [{ [main]: undefined, context: { value: 'call' } }])]) {
				assert.deepEqual(typeof result === 'string' ? result : result.embedding, expected);
			}
			await assert.rejects(async () => { await Reflect.apply(component, undefined, [undefined, { value: 'call', secret: 'changed' }]); }, ValidationError);
			await assert.rejects(async () => { await Reflect.apply(component, undefined, [undefined, { value: 'call', extra: true }]); }, ValidationError);
		}
		assert.deepEqual(context, { value: 'default', secret: 'private' });
	});
	it('retains configured public defaults with callback payloads', async () => {
		const model = new MockEmbeddingModelV4({ doEmbed: async ({ values }) => ({ embeddings: values.map(value => [Number(value)]), warnings: [] }) });
		const embedder = create.Embedder.withTemplate({ model, input: '{{ map(factor) }}', context: { factor: '3' },
			inputSchema: z.object({ factor: z.string().transform(Number), map: z.custom<(value: number) => number>() }) });
		assert.deepEqual((await embedder({ map: value => value * 2 })).embedding, [6]);
		assert.deepEqual((await embedder.run({ context: { map: value => value * 2 } })).embedding, [6]);
	});

	it('keeps definition-owned fixed settings out of named invocations', async () => {
		let calls = 0;
		const model = new Experimental_DecisionMockModelV4({ doDecide: async () => { calls++; return { answers: {}, warnings: [] }; } });
		const decision = create.Decision({ model, questions: {} });
		await assert.rejects(async () => await runtimeRun(decision, { state: 'state', questions: {} }), /Configuration-only.*questions/);
		assert.equal(calls, 0);
	});
});

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> { const values: T[] = []; for await (const value of stream) values.push(value); return values; }

describe('component SDK calls', () => {
	it('delegates scalar and batch embeddings, including native batching, defaults and prepared batches', async () => {
		const model = new MockEmbeddingModelV4({ maxEmbeddingsPerCall: 2, supportsParallelCalls: true,
			doEmbed: async ({ values }) => ({ embeddings: values.map(value => [value.length]), usage: { tokens: values.length }, warnings: [] }) });
		const embedder = create.Embedder({ model, input: 'base', maxParallelCalls: 1 });
		assert.deepEqual((await embedder()).embedding, [4]);
		assert.deepEqual((await embedder.run({ input: ['a', 'bb', 'ccc'] })).embeddings, [[1], [2], [3]]);
		assert.deepEqual(model.doEmbedCalls.map(call => call.values), [['base'], ['a', 'bb'], ['ccc']]);
		const prepared = create.Embedder.withFunction({ model, inputSchema: z.object({ n: z.string().transform(Number) }),
			input: ({ n }) => Array.from({ length: n }, () => 'two') });
		assert.deepEqual((await prepared({ n: '2' })).embeddings, [[3], [3]]);
		const tool = create.Embedder.asTool({ model, inputSchema: z.object({ input: z.array(z.string()) }), context: { input: ['default'] } });
		const workflow = create.Function({ tools: { tool }, execute: ({ tool }) => tool({}) });
		assert.deepEqual(await workflow(), [[7]]);
		assert.equal(tool.toModelOutput, undefined);
		assert.deepEqual((await asSchema(tool.inputSchema).jsonSchema).required, []);
	});

	it('keeps reranking native document identity and lets invocation documents override prepared documents', async () => {
		const calls: Parameters<MockRerankingModelV4['doRerank']>[0][] = [];
		const model = new MockRerankingModelV4({ doRerank: async request => { calls.push(request); return { ranking: [{ index: 1, relevanceScore: .9 }, { index: 0, relevanceScore: .2 }] }; } });
		const documents = [{ title: 'a' }, { title: 'b' }];
		const rank = create.Reranker({ model, documents });
		assert.equal((await rank('q', 1)).ranking[0].document, documents[1]);
		let preparations = 0;
		const pair = create.Reranker.withFunction({ model, documents: ['ignored'], query: () => { preparations++; return { query: 'q', documents }; } });
		assert.equal((await pair()).ranking[0].document, documents[1]);
		const replacements = [{ other: 'c' }, { other: 'd' }];
		assert.equal((await pair.run({ documents: replacements })).ranking[0].document, replacements[1]);
		assert.equal((await pair(undefined, replacements)).ranking[0].document, replacements[1]);
		assert.equal(preparations, 3);
		assert.equal(calls.length, 4);
		const query = create.Reranker.withTemplate({ model, query: '{{ text }}', inputSchema: z.object({ text: z.string() }) });
		assert.equal((await query({ text: 'q' }, documents)).ranking[0].document, documents[1]);
		const scripted = create.Reranker.withScript.asTool({ model, inputSchema: z.object({}), query: 'return {query: "q", documents: ["a", "b"]}' });
		assert.equal((await scripted()).ranking[0].document, 'b');
		assert.equal((await pair.run({ query: () => 'replacement', documents: ['c', 'd'] })).ranking[0].document, 'd');
		assert.equal(calls.at(-1)?.query, 'replacement');
	});

	it('keeps prepared and configured documents paired with their own Reranker alternative', async () => {
		const model = new MockRerankingModelV4({ doRerank: async () => ({ ranking: [{ index: 0, relevanceScore: 1 }], warnings: [] }) });
		const prepared = { prepared: true };
		const ignored = { ignored: true };
		const fallback = { fallback: true };
		const alternatives = [
			{ config: { model, query: () => ({ query: 'q', documents: [prepared] }), documents: [ignored] }, expected: prepared },
			{ config: { model, query: () => 'q', documents: [fallback] }, expected: fallback },
		];
		for (const { config, expected } of alternatives) {
			const rank = create.Reranker.withFunction(config);
			const native = await rerank({ model, query: 'q', documents: [expected] });
			assert.equal((await rank()).ranking[0].document, native.ranking[0].document);
			const rankingTool = create.Reranker.withFunction.asTool({ inputSchema: z.object({}) }, rank);
			assert.equal((await rankingTool.execute({}, { toolCallId: 'ranking', messages: [], context: undefined }))[0].document, native.ranking[0].document);
			const configured = await rerank<typeof ignored | typeof fallback>({ model, query: 'replacement', documents: config.documents });
			assert.equal((await rank.run({ query: () => 'replacement' })).ranking[0].document, configured.ranking[0].document);
			const documents = [{ replacement: true }];
			const replacement = await rerank({ model, query: 'q', documents });
			assert.equal((await rank.run({ documents })).ranking[0].document, replacement.ranking[0].document);
		}
	});

	it('renders only explicit decision text parts and preserves native answers, distributions and refusals', async () => {
		const calls: Parameters<Experimental_DecisionMockModelV4['doDecide']>[0][] = [];
		const model = new Experimental_DecisionMockModelV4({ doDecide: async request => { calls.push(request); return { answers: { route: { type: 'choice', choice: 'support', probabilities: { support: .8, billing: .2 } } }, warnings: [] }; } });
		const questions = { route: { type: 'choice' as const, instructions: 'Route', criteria: { support: 'Help', billing: 'Pay' } } };
		const json = { type: 'json' as const, value: { literal: '{{ untouched }}' } };
		const source = [{ type: 'text' as const, text: '{{ subject }}' }, json];
		const decide = create.Decision.withTemplate({ model, questions, state: source });
		const result = await decide({ subject: 'refund' });
		assert.deepEqual(result.answers, (await experimental_decide({ model, questions, state: 'refund' })).answers);
		assert.equal(calls[0].state[1], json);
		assert.deepEqual(source[0], { type: 'text', text: '{{ subject }}' });
		const refusal = new Experimental_DecisionMockModelV4({ doDecide: async () => ({ answers: { route: { type: 'refusal' } }, warnings: [] }) });
		await assert.rejects(create.Decision({ model: refusal, questions })('state'), Experimental_DecisionRefusalError);
		const decisionTool = create.Decision.asTool({ model, questions, inputSchema: z.object({ state: z.string() }) });
		assert.deepEqual(await decisionTool.execute({ state: 'state' }, { toolCallId: 'decision', messages: [], context: undefined }), result.answers);
		assert.equal(decisionTool.toModelOutput, undefined);
	});

	it('keeps recorded audio and parsed download URLs native and projects speech through native file getters', async () => {
		const calls: Parameters<MockTranscriptionModelV4['doGenerate']>[0][] = [];
		const model = new MockTranscriptionModelV4({ doGenerate: async request => { calls.push(request); return { text: 'transcript', segments: [], language: 'en', durationInSeconds: 1, warnings: [], response: { timestamp: new Date(0), modelId: 'transcribe' } }; } });
		let downloaded: URL | undefined;
		const transcribe = create.Transcriber.asTool({ model, inputSchema: z.object({ audio: z.url().transform(value => new URL(value)) }),
			download: async ({ url }) => { downloaded = url; return { data: new Uint8Array([1, 2]), mediaType: 'audio/wav' }; } });
		const owner = create.Function({ tools: { transcribe }, execute: ({ transcribe }) => transcribe({ audio: 'https://example.test/audio' }) });
		const transcript = await owner();
		assert.equal(transcript.text, 'transcript');
		assert.deepEqual(await transcribe.toModelOutput?.({ toolCallId: 'transcribe', input: { audio: new URL('https://example.test/audio') }, output: transcript }), { type: 'text', value: 'transcript' });
		assert.equal(downloaded?.href, 'https://example.test/audio');
		assert.equal(calls.length, 1);
		const ordinary = create.Transcriber({ model, download: transcribe.config.download });
		assert.equal((await ordinary(new URL('https://example.test/ordinary'))).text, 'transcript');
		assert.equal(downloaded?.href, 'https://example.test/ordinary');
		assert.equal((await ordinary.run({ audio: new URL('https://example.test/named') })).text, 'transcript');
		assert.equal(downloaded?.href, 'https://example.test/named');
		assert.equal(calls.length, 3);
		assert.equal((await transcribe({ audio: 'https://example.test/payload' })).text, 'transcript');
		assert.equal(downloaded?.href, 'https://example.test/payload');
		const workflow = create.Script({ script: 'return transcribe(url, audio="https://example.test/payload").text', context: { transcribe, url: new URL('https://example.test/authored') } });
		assert.equal(await workflow(), 'transcript');
		assert.equal(downloaded?.href, 'https://example.test/authored');
		const speech = new MockSpeechModelV4({ doGenerate: async () => ({ audio: 'AQI=', warnings: [], response: { timestamp: new Date(0), modelId: 'speech' } }) });
		const say = create.SpeechGenerator.asTool({ model: speech, inputSchema: z.object({ text: z.string() }) });
		const spoken = await say.execute({ text: 'hello' }, { toolCallId: 'speech', messages: [], context: undefined });
		assert.equal(spoken.base64, 'AQI=');
		assert.equal(typeof spoken.mediaType, 'string');
		assert.deepEqual(await say.toModelOutput?.({ toolCallId: 'speech', input: { text: 'hello' }, output: spoken }), { type: 'text', value: 'Speech generated.' });
	});

	it('resolves ordinary speech text and voice consistently through shorthand and named calls', async () => {
		const requests: Parameters<MockSpeechModelV4['doGenerate']>[0][] = [];
		const model = new MockSpeechModelV4({ doGenerate: async request => {
			requests.push(request);
			return { audio: 'AQI=', warnings: [], response: { timestamp: new Date(0), modelId: 'speech' } };
		} });
		const say = create.SpeechGenerator({ model, text: 'configured', voice: 'default' });
		const result = await say(undefined, 'alloy');
		assert.equal(result.audio.base64, 'AQI=');
		await say('replacement', 'nova');
		await say.run({ text: 'replacement', voice: 'nova' });
		assert.deepEqual(requests.map(({ text, voice }) => ({ text, voice })), [
			{ text: 'configured', voice: 'alloy' }, { text: 'replacement', voice: 'nova' }, { text: 'replacement', voice: 'nova' },
		]);
		assert.equal(say.config.voice, 'default');
		assert.equal(say.config.text, 'configured');
	});

	it('returns native live transcript views and snapshots one execution using native finish promises', async () => {
		let entries = 0;
		const model = new MockTranscriptionModelV4({ doStream: async () => { entries++; return { stream: convertArrayToReadableStream([
			{ type: 'transcript-delta', delta: 'partial' }, { type: 'error', error: 'recoverable' }, finish,
		]) }; } });
		const live = create.StreamingTranscriber({ model, inputAudioFormat, includeRawChunks: true });
		const result = await live(audio());
		assert.deepEqual((await collect(result.fullStream)).map(part => part.type), ['transcript-delta', 'error']);
		assert.equal(await result.text, 'finished');
		assert.throws(() => result.fullStream);
		const collected = create.StreamingTranscriber.withFunction.asTool({ model, inputAudioFormat, inputSchema: z.object({}), audio });
		const snapshot = await collected.execute({}, { toolCallId: 'stream', messages: [], context: undefined });
		assert.equal(snapshot.text, 'finished');
		assert.deepEqual(snapshot.segments, finish.segments);
		assert.equal(entries, 2);
	});

	it('claims ReadableStreams across components at dispatch, retaining claims after failed SDK attempts', async () => {
		let entries = 0;
		const model = new MockTranscriptionModelV4({ doStream: async () => { entries++; return { stream: convertArrayToReadableStream([finish]) }; } });
		const source = audio();
		const first = create.StreamingTranscriber({ model, inputAudioFormat, audio: source });
		const child = create.StreamingTranscriber({}, first);
		assert.equal(await (await first()).text, 'finished');
		await assert.rejects(child(), ValidationError);
		assert.equal(entries, 1);
		const fresh = audio();
		const controller = new AbortController(); controller.abort();
		await assert.rejects(first.run({ audio: fresh, abortSignal: controller.signal }));
		assert.equal(await (await first(fresh)).text, 'finished');
		const unsupported = create.StreamingTranscriber({ model: new MockTranscriptionModelV4(), inputAudioFormat });
		const failed = audio();
		await assert.rejects(unsupported(failed), UnsupportedFunctionalityError);
		await assert.rejects(first(failed), ValidationError);
	});

	it('keeps native streamed speech and translation events and final metadata without buffering', async () => {
		const model = new Experimental_MockStreamingSpeechModelV4({ doStream: async () => ({ stream: convertArrayToReadableStream([
			{ type: 'audio', audio: 'AQI=', audioFormat: inputAudioFormat }, { type: 'error', error: 'recoverable' }, { type: 'finish', providerMetadata: { fixture: { native: true } } },
		]) }) });
		const errors: unknown[] = [];
		const speak = create.StreamingSpeechGenerator({ model, onError: ({ error }) => { errors.push(error); } });
		const live = await speak(['one', { type: 'text' as const, text: 'two', voice: 'speaker' }]);
		assert.deepEqual(await collect(live.audioStream), [new Uint8Array([1, 2])]);
		assert.deepEqual(errors, ['recoverable']);
		assert.deepEqual(await live.providerMetadata, { fixture: { native: true } });
		assert.throws(() => live.fullStream);
		const translateModel = new Experimental_MockSpeechTranslationModelV4({ doStream: async () => ({ stream: convertArrayToReadableStream([
			{ type: 'output-text-delta', delta: 'partial' }, { type: 'audio', audio: 'AQI=' }, { type: 'finish', sourceText: 'source', outputText: 'final' },
		]) }) });
		const translate = create.StreamingTranslator({ model: translateModel, inputAudioFormat });
		const translated = await translate(audio(), 'fr');
		assert.equal((await collect(translated.fullStream)).length, 2);
		assert.equal(await translated.translationText, 'final');
		assert.equal('audioStream' in translated, false);
	});

	it('accepts every native streaming speech input representation through shorthand and named calls', async () => {
		const inputs: unknown[] = [];
		const model = new Experimental_MockStreamingSpeechModelV4({ doStream: async ({ text }) => {
			inputs.push(await collect(text));
			return { stream: convertArrayToReadableStream([
				{ type: 'audio', audio: 'AQI=', audioFormat: inputAudioFormat }, { type: 'finish' },
			]) };
		} });
		const speak = create.StreamingSpeechGenerator({ model });
		const sources: (() => Parameters<typeof experimental_streamSpeech>[0]['text'])[] = [
			() => 'hello', () => ['hello'], () => Object.freeze(['hello']), () => new Set(['hello']),
			async function* () { yield 'hello'; }, () => convertArrayToReadableStream(['hello']),
		];
		for (const source of sources) {
			const shorthand = await speak(source());
			assert.deepEqual(await collect(shorthand.audioStream), [new Uint8Array([1, 2])]);
			const named = await speak.run({ text: source() });
			assert.deepEqual(await collect(named.audioStream), [new Uint8Array([1, 2])]);
			const native = experimental_streamSpeech({ model, text: source() });
			assert.deepEqual(await collect(native.audioStream), [new Uint8Array([1, 2])]);
			assert.deepEqual(inputs.at(-3), inputs.at(-1));
			assert.deepEqual(inputs.at(-2), inputs.at(-1));
		}
	});

	it('shares live identity claims across operation kinds and leaves failed preparation unclaimed', async () => {
		const source = Object.freeze(audio());
		let translations = 0;
		const translationModel = new Experimental_MockSpeechTranslationModelV4({ doStream: async () => { translations++; return { stream: convertArrayToReadableStream([{ type: 'finish', sourceText: '', outputText: '' }]) }; } });
		const transcribeModel = new MockTranscriptionModelV4({ doStream: async () => ({ stream: convertArrayToReadableStream([finish]) }) });
		const transcribe = create.StreamingTranscriber.withFunction({ model: transcribeModel, inputAudioFormat, inputSchema: z.object({ recording: z.string() }), audio: () => source });
		await assert.rejects(runtimeRun(transcribe, { context: {} }), ValidationError);
		assert.equal(await (await transcribe({ recording: 'one' })).text, 'finished');
		const translate = create.StreamingTranslator({ model: translationModel, inputAudioFormat, targetLanguage: 'fr' });
		await assert.rejects(translate(source), ValidationError);
		assert.equal(translations, 0);
	});

	it('keeps the modifier matrix small, including inherited restrictions', () => {
		const rows = [
			['Decision', true, 'all'], ['Embedder', true, 'all'], ['Reranker', true, 'all'],
			['ImageGenerator', true, 'all'], ['Transcriber', false, 'all'],
			['StreamingTranscriber', false, 'prepared'], ['SpeechGenerator', true, 'all'],
			['StreamingSpeechGenerator', true, 'none'], ['StreamingTranslator', false, 'none'],
			['VoiceSessionSetup', true, 'none'],
		] as const;
		for (const [name, text, tool] of rows) {
			const factory = create[name];
			assert.equal('asTool' in factory, tool === 'all', `${name}.asTool`);
			assert.equal('asStream' in factory, false, `${name}.asStream`);
			for (const key of ['withScript', 'withFunction', 'loadsScript'] as const) {
				assert.equal(typeof factory[key], 'function', `${name}.${key}`);
				assert.equal('asTool' in factory[key], tool !== 'none', `${name}.${key}.asTool`);
			}
			for (const key of ['withText', 'withTemplate', 'loadsText', 'loadsTemplate'] as const) {
				assert.equal(key in factory, text, `${name}.${key}`);
				if (text) assert.equal('asTool' in Reflect.get(factory, key), tool === 'all', `${name}.${key}.asTool`);
			}
		}
		const model = new MockSpeechModelV4();
		const parent = create.SpeechGenerator.asTool({ model, inputSchema: z.object({ text: z.string() }) });
		assert.throws(() => Reflect.apply(create.StreamingSpeechGenerator, undefined, [{}, parent]), ConfigError);
		assert.throws(() => Reflect.apply(create.Transcriber, undefined, [{ model: new MockTranscriptionModelV4(), promptType: 'async-template', audio: 'source' }]), ConfigError);
	});
});
