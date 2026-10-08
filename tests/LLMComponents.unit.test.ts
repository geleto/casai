import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ModelMessage, ToolSet } from 'ai';
import { jsonSchema, stepCountIs } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { create, z } from './cascada';
import type { StreamTextOnFinishEvent } from './cascada';

function mockModel(text: string, deltas = [text]): MockLanguageModelV3 {
	const finishReason = { unified: 'stop', raw: 'stop' } as const;
	const usage = {
		inputTokens: { total: 2, noCache: 2, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 3, text: 3, reasoning: 0 },
	};
	return new MockLanguageModelV3({
		doGenerate: { content: [{ type: 'text', text }], finishReason, usage, warnings: [] },
		doStream: () => Promise.resolve({
			stream: convertArrayToReadableStream([
				{ type: 'stream-start', warnings: [] },
				{ type: 'text-start', id: 'text' },
				...deltas.map(delta => ({ type: 'text-delta' as const, id: 'text', delta })),
				{ type: 'text-end', id: 'text' },
				{ type: 'finish', finishReason, usage },
			]),
		}),
	});
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = [];
	for await (const value of stream) values.push(value);
	return values;
}

function promptCalls(model: MockLanguageModelV3, streaming: boolean): unknown[] {
	return (streaming ? model.doStreamCalls : model.doGenerateCalls).map(call => call.prompt.map(({ role, content }) => ({
		role,
		content: typeof content === 'string' ? content : content.map(part => Object.fromEntries(Object.entries(part).filter(([_key, value]) => value !== undefined))),
	})));
}

describe('LLM component contracts without providers', () => {
	const schema = z.object({ answer: z.number() });
	const answer = '{"answer":4}';

	for (const streaming of [false, true]) {
		const name = streaming ? 'ObjectStreamer' : 'ObjectGenerator';
		for (const promptType of ['template', 'script'] as const) {
			it(`should validate raw call-time input before rendering ${name} ${promptType} run overrides`, async () => {
				const original = mockModel(answer);
				const replacement = mockModel('{"answer":8}');
				let validations = 0;
				const inputSchema = z.object({ topic: z.string() }).strict().refine(() => {
					validations++;
					return true;
				});
				const common = { model: original, schema, inputSchema, context: { topic: 'Configured', prefix: 'About' }, maxOutputTokens: 10 };
				const template = { ...common, prompt: '{{ prefix }} {{ topic }}' };
				const script = { ...common, prompt: 'return prefix ~ " " ~ topic' };
				const component = promptType === 'template'
					? streaming ? create.ObjectStreamer.withTemplate(template) : create.ObjectGenerator.withTemplate(template)
					: streaming ? create.ObjectStreamer.withScript(script) : create.ObjectGenerator.withScript(script);
				const result = await component.run({ model: replacement, context: { topic: 'Runtime' }, maxOutputTokens: 25 });
				if ('partialObjectStream' in result) await collect(result.partialObjectStream);
				expect(await result.object).to.deep.equal({ answer: 8 });
				expect(validations).to.equal(1);
				expect(promptCalls(replacement, streaming)).to.deep.equal([[
					{ role: 'user', content: [{ type: 'text', text: 'About Runtime' }] },
				]]);
				const calls = streaming ? replacement.doStreamCalls : replacement.doGenerateCalls;
				expect(calls[0].maxOutputTokens).to.equal(25);
				await rejects(() => component.run({ context: { topic: 1 } }), /Input context validation failed/);
				await rejects(() => component.run({}), /context object is required/);
				expect(calls).to.have.length(1);
				const second = await component({ topic: 'Next' });
				if ('partialObjectStream' in second) await collect(second.partialObjectStream);
				expect(await second.object).to.deep.equal({ answer: 4 });
				expect(validations).to.equal(2);
				expect(component.config.model).to.equal(original);
				expect(component.config.context).to.deep.equal({ topic: 'Configured', prefix: 'About' });
			});

			it(`should isolate one-off ${name} ${promptType} prompts and append conversational history`, async () => {
				const model = mockModel(answer);
				const messages: ModelMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'Static instructions.' }] }];
				const history: ModelMessage[] = [{ role: 'assistant', content: 'Earlier reply.' }];
				const common = { model, schema, messages, context: { topic: 'Configured' } };
				const template = { ...common, prompt: 'Original {{ topic }}' };
				const script = { ...common, prompt: 'return "Original " ~ topic' };
				const component = promptType === 'template'
					? streaming ? create.ObjectStreamer.withTemplate(template) : create.ObjectGenerator.withTemplate(template)
					: streaming ? create.ObjectStreamer.withScript(script) : create.ObjectGenerator.withScript(script);
				const prompt = promptType === 'template' ? 'Override {{ topic }}' : 'return "Override " ~ topic';
				const result = await component(prompt, history, { topic: 'Runtime' });
				if ('partialObjectStream' in result) await collect(result.partialObjectStream);
				expect(await result.object).to.deep.equal({ answer: 4 });
				const response = await result.response;
				expect(response).not.to.have.property('messageHistory');
				expect(response).not.to.have.property('messages');
				const second = await component();
				if ('partialObjectStream' in second) await collect(second.partialObjectStream);
				expect(await second.object).to.deep.equal({ answer: 4 });
				expect(promptCalls(model, streaming)).to.deep.equal([
					[
						{ role: 'user', content: [{ type: 'text', text: 'Static instructions.' }] },
						{ role: 'assistant', content: [{ type: 'text', text: 'Earlier reply.' }] },
						{ role: 'user', content: [{ type: 'text', text: 'Override Runtime' }] },
					],
					[
						{ role: 'user', content: [{ type: 'text', text: 'Static instructions.' }] },
						{ role: 'user', content: [{ type: 'text', text: 'Original Configured' }] },
					],
				]);
				expect(messages).to.deep.equal([{ role: 'user', content: [{ type: 'text', text: 'Static instructions.' }] }]);
				expect(history).to.deep.equal([{ role: 'assistant', content: 'Earlier reply.' }]);
			});
		}

		it(`should accept script-generated message arrays for ${name} without wrapping them as text`, async () => {
			const model = mockModel(answer);
			const messages: ModelMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'Static instructions.' }] }];
			const history: ModelMessage[] = [{ role: 'assistant', content: 'Earlier reply.' }];
			const prompt: ModelMessage[] = [{ role: 'user', content: 'Extract this.' }, { role: 'assistant', content: 'Example.' }];
			const config = { model, schema, messages, context: { promptMessages: prompt }, prompt: 'return promptMessages' };
			const component = streaming ? create.ObjectStreamer.withScript(config) : create.ObjectGenerator.withScript(config);
			const result = await component.run({ messages: history });
			if ('partialObjectStream' in result) await collect(result.partialObjectStream);
			expect(await result.object).to.deep.equal({ answer: 4 });
			expect(promptCalls(model, streaming)).to.deep.equal([[
				{ role: 'user', content: [{ type: 'text', text: 'Static instructions.' }] },
				{ role: 'assistant', content: [{ type: 'text', text: 'Earlier reply.' }] },
				{ role: 'user', content: [{ type: 'text', text: 'Extract this.' }] },
				{ role: 'assistant', content: [{ type: 'text', text: 'Example.' }] },
			]]);
		});

		it(`should generate unstructured JSON with ${name} no-schema output`, async () => {
			const object = { status: 'ok', values: [1, null, true] };
			const text = JSON.stringify(object);
			const model = mockModel(text, [text.slice(0, 15), text.slice(15)]);
			const config = { model, output: 'no-schema' as const, prompt: 'Return JSON.' };
			const component = streaming ? create.ObjectStreamer(config) : create.ObjectGenerator(config);
			const result = await component();
			if ('textStream' in result) expect((await collect(result.textStream)).join('')).to.equal(text);
			expect(await result.object).to.deep.equal(object);
			expect(component.config.output).to.equal('no-schema');
		});
	}

	it('should validate enum output against its allowed values', async () => {
		const model = mockModel('{"result":"Blue"}');
		const generator = create.ObjectGenerator({
			model, output: 'enum', enum: ['Red', 'Blue'] as const, prompt: 'Choose.',
		});
		expect((await generator()).object).to.equal('Blue');
		const invalid = create.ObjectGenerator({ model: mockModel('{"result":"Green"}'), output: 'enum', enum: ['Red', 'Blue'], prompt: 'Choose.' });
		await rejects(() => invalid(), /No object generated/);
	});

	it('should pass schema guidance to the SDK', async () => {
		const model = mockModel(answer);
		const generator = create.ObjectGenerator({ model, schema, prompt: 'Return an answer.', schemaName: 'Answer', schemaDescription: 'A numeric answer' });
		expect((await generator()).object).to.deep.equal({ answer: 4 });
		expect(model.doGenerateCalls[0].responseFormat).to.include({ type: 'json', name: 'Answer', description: 'A numeric answer' });
	});

	it('should validate generated array elements against the element schema', async () => {
		const generator = create.ObjectGenerator({ model: mockModel('{"elements":[{"answer":4},{"answer":8}]}'), output: 'array', schema, prompt: 'Return answers.' });
		expect((await generator()).object).to.deep.equal([{ answer: 4 }, { answer: 8 }]);
		const invalid = create.ObjectGenerator({ model: mockModel('{"elements":[{"answer":"wrong"}]}'), output: 'array', schema, prompt: 'Return answers.' });
		await rejects(() => invalid(), /No object generated/);
	});

	it('should expose schema validation failures from object streams after partial updates', async () => {
		const streamer = create.ObjectStreamer({
			model: mockModel('{"answer":"wrong"}', ['{"answer":', '"wrong"}']), schema, prompt: 'Return an answer.',
		});
		const result = streamer();
		const rejected = rejects(Promise.resolve(result.object), /No object generated/);
		const partials = await collect(result.partialObjectStream);
		await rejected;
		expect(partials).to.deep.include({ answer: 'wrong' });
	});

	for (const factoryName of ['TextGenerator', 'TextStreamer', 'ObjectGenerator', 'ObjectStreamer'] as const) {
		it(`should cache loaded text and restore it after one-off ${factoryName} overrides`, async () => {
			const loaded: string[] = [];
			const loader = { load: async (name: string) => {
				loaded.push(name);
				return `Loaded ${name} {{ literal }}`;
			} };
			const model = mockModel(answer);
			const config = { model, loader, prompt: 'default' };
			const component = factoryName === 'TextGenerator' ? create.TextGenerator.loadsText(config)
				: factoryName === 'TextStreamer' ? create.TextStreamer.loadsText(config)
					: factoryName === 'ObjectGenerator' ? create.ObjectGenerator.loadsText({ ...config, schema })
						: create.ObjectStreamer.loadsText({ ...config, schema });
			for (const prompt of [undefined, 'override', undefined]) {
				const result = await component.run(prompt === undefined ? {} : { prompt });
				if ('partialObjectStream' in result) await collect(result.partialObjectStream);
				else if ('text' in result) await result.text;
			}
			expect(loaded).to.deep.equal(['default', 'override']);
			const streaming = factoryName.endsWith('Streamer');
			expect(promptCalls(model, streaming)).to.deep.equal(['default', 'override', 'default'].map(name => [
				{ role: 'user', content: [{ type: 'text', text: `Loaded ${name} {{ literal }}` }] },
			]));
			expect(component.config.prompt).to.equal('default');
		});

		it(`should load and isolate one-off ${factoryName} scripts with merged rendering context`, async () => {
			const loaded: string[] = [];
			const loader = { load: (name: string) => {
				loaded.push(name);
				return `return "${name} " ~ topic`;
			} };
			const model = mockModel(answer);
			const config = { model, loader, prompt: 'default', context: { topic: 'Configured' } };
			const component = factoryName === 'TextGenerator' ? create.TextGenerator.loadsScript(config)
				: factoryName === 'TextStreamer' ? create.TextStreamer.loadsScript(config)
					: factoryName === 'ObjectGenerator' ? create.ObjectGenerator.loadsScript({ ...config, schema })
						: create.ObjectStreamer.loadsScript({ ...config, schema });
			const results = [
				await component({ topic: 'First' }),
				await component.run({ prompt: 'override', context: { topic: 'Runtime' } }),
				await component(),
			];
			for (const result of results) {
				if ('partialObjectStream' in result) await collect(result.partialObjectStream);
				else if ('text' in result) await result.text;
			}
			expect(loaded).to.deep.equal(['default', 'override']);
			expect(promptCalls(model, factoryName.endsWith('Streamer'))).to.deep.equal(['default First', 'override Runtime', 'default Configured'].map(text => [
				{ role: 'user', content: [{ type: 'text', text }] },
			]));
			expect(component.config.prompt).to.equal('default');
		});

		it(`should await SDK input validation before executing ${factoryName} function prompts`, async () => {
			const events: string[] = [];
			const inputSchema = jsonSchema<{ value: number }>({ type: 'object', properties: { value: { type: 'number' } }, required: ['value'] }, {
				validate: async value => {
					events.push('validate');
					await Promise.resolve();
					const result = z.object({ value: z.number() }).safeParse(value);
					return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
				},
			});
			const model = mockModel(answer);
			const config = { model, inputSchema, prompt: (context: Record<string, number>) => {
				events.push('prompt');
				return `Value ${context.value}`;
			} };
			const component = factoryName === 'TextGenerator' ? create.TextGenerator.withFunction(config)
				: factoryName === 'TextStreamer' ? create.TextStreamer.withFunction(config)
					: factoryName === 'ObjectGenerator' ? create.ObjectGenerator.withFunction({ ...config, schema })
						: create.ObjectStreamer.withFunction({ ...config, schema });
			const pending = component({ value: 2 });
			expect(events).to.deep.equal(['validate']);
			const result = await pending;
			if ('partialObjectStream' in result) await collect(result.partialObjectStream);
			else if ('text' in result) await result.text;
			expect(events).to.deep.equal(['validate', 'prompt']);
			await rejects(() => component.run({ context: { value: 'invalid' } }), /Input context validation failed/);
			expect(events).to.deep.equal(['validate', 'prompt', 'validate']);
			expect(promptCalls(model, factoryName.endsWith('Streamer'))).to.have.length(1);
		});
	}

	it('should support optional SDK input schemas without a local validator', async () => {
		const inputSchema = jsonSchema<{ value?: number }>({ type: 'object', properties: { value: { type: 'number' } } });
		const generator = create.TextGenerator.withFunction({ model: mockModel('DONE'), inputSchema, prompt: context => `Value ${context.value ?? 0}` });
		expect((await generator()).text).to.equal('DONE');
		expect((await generator.run({ context: { value: 2 } })).text).to.equal('DONE');
	});

	it('should preserve configured text-load failures when using a successful one-off override without leaking rejections', async function () {
		this.timeout(10_000);
		const code = `
			import { create } from 'casai';
			import { MockLanguageModelV3 } from 'ai/test';
			import { rejects } from 'node:assert/strict';
			const model = new MockLanguageModelV3({ doGenerate: {
				content: [{ type: 'text', text: 'DONE' }], finishReason: { unified: 'stop', raw: 'stop' },
				usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } }, warnings: [],
			} });
			const component = create.TextGenerator.loadsText({ model, prompt: 'missing', loader: async name => name === 'valid' ? 'Loaded prompt.' : null });
			await component('valid');
			await new Promise(resolve => setImmediate(resolve));
			await rejects(() => component(), /Failed to load prompt/);
		`;
		await promisify(execFile)(process.execPath, ['--unhandled-rejections=strict', '--import', 'tsx', '--conditions=casai-source', '--input-type=module', '--eval', code]);
	});

	for (const streaming of [false, true]) {
		it(`should replace configured prompt arrays while retaining configured messages in ${streaming ? 'streams' : 'generators'}`, async () => {
			const prompt: ModelMessage[] = [{ role: 'user', content: 'Example.' }, { role: 'assistant', content: 'Example answer.' }];
			const model = mockModel('DONE');
			const component = streaming ? create.TextStreamer({ model, prompt }) : create.TextGenerator({ model, prompt });
			const result = await component('Runtime.');
			await result.text;
			const next = await component();
			await next.text;
			expect(promptCalls(model, streaming)).to.deep.equal([
				[{ role: 'user', content: [{ type: 'text', text: 'Runtime.' }] }],
				[
					{ role: 'user', content: [{ type: 'text', text: 'Example.' }] },
					{ role: 'assistant', content: [{ type: 'text', text: 'Example answer.' }] },
				],
			]);
			const staticModel = mockModel('DONE');
			const fixed = streaming ? create.TextStreamer({ model: staticModel, messages: prompt }) : create.TextGenerator({ model: staticModel, messages: prompt });
			const fixedResult = await fixed('Runtime.');
			await fixedResult.text;
			expect(promptCalls(staticModel, streaming)).to.deep.equal([[
				{ role: 'user', content: [{ type: 'text', text: 'Example.' }] },
				{ role: 'assistant', content: [{ type: 'text', text: 'Example answer.' }] },
				{ role: 'user', content: [{ type: 'text', text: 'Runtime.' }] },
			]]);
			expect((await fixedResult.response).messageHistory).to.have.length(2);
			expect(prompt).to.deep.equal([{ role: 'user', content: 'Example.' }, { role: 'assistant', content: 'Example answer.' }]);
		});
	}

	for (const object of [false, true]) {
		it(`should forward tool execution metadata by identity for ${object ? 'object' : 'text'} generators`, async () => {
			const options = { toolCallId: 'metadata', messages: [{ role: 'user' as const, content: 'Tool conversation.' }], abortSignal: new AbortController().signal, context: undefined };
			const input = { value: 2, _toolCallOptions: { toolCallId: 'spoofed' } };
			const inputSchema = z.object({ value: z.number() }).passthrough();
			const model = mockModel(object ? answer : 'DONE');
			const config = { model, inputSchema, description: 'Metadata tool', context: { prefix: 'Configured' }, prompt: (context: Record<string, unknown>) => {
				expect(context._toolCallOptions).to.equal(options);
				return `${String(context.prefix)} ${String(context.value)}`;
			} };
			const tool = object ? create.ObjectGenerator.withFunction.asTool({ ...config, schema }) : create.TextGenerator.withFunction.asTool(config);
			expect(await tool.execute(input, options)).to.deep.equal(object ? { answer: 4 } : 'DONE');
			expect(tool.description).to.equal('Metadata tool');
			expect(tool.inputSchema).to.equal(inputSchema);
			expect(input._toolCallOptions.toolCallId).to.equal('spoofed');
			expect(promptCalls(model, false)).to.deep.equal([[
				{ role: 'user', content: [{ type: 'text', text: 'Configured 2' }] },
			]]);
		});
	}

	for (const promptType of ['text', 'template', 'script', 'function'] as const) {
		it(`should provide augmented history and preserve metadata in ${promptType} stream finish callbacks`, async () => {
			const model = mockModel('DONE', ['DO', 'NE']);
			const staticMessages: ModelMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'Static instructions.' }] }];
			const history: ModelMessage[] = [{ role: 'assistant', content: 'Earlier reply.' }];
			const callbacks: { text: string, response: { messages: ModelMessage[], messageHistory?: ModelMessage[] }, responseMessages: ModelMessage[], finishReason: string }[] = [];
			const config = { model, messages: staticMessages, onFinish: (event: typeof callbacks[number]) => { callbacks.push(event); } };
			const component = promptType === 'text' ? create.TextStreamer({ ...config, prompt: 'Input.' })
				: promptType === 'template' ? create.TextStreamer.withTemplate({ ...config, context: { input: 'Input.' }, prompt: '{{ input }}' })
					: promptType === 'script' ? create.TextStreamer.withScript({ ...config, context: { input: 'Input.' }, prompt: 'return input' })
						: create.TextStreamer.withFunction({ ...config, prompt: () => 'Input.' });
			const result = await component.run({ messages: history });
			expect((await collect(result.textStream)).join('')).to.equal('DONE');
			const response = await result.response;
			expect(callbacks).to.have.length(1);
			expect(callbacks[0].text).to.equal('DONE');
			expect(callbacks[0].finishReason).to.equal('stop');
			expect(callbacks[0].response.messages).to.deep.equal(response.messages);
			expect(callbacks[0].response.messageHistory).to.deep.equal([history[0], ...response.messages]);
			expect(callbacks[0].responseMessages).to.deep.equal(await result.responseMessages);
			expect(callbacks[0].responseMessages).to.have.length(1);
			expect((await result.finalStep).response.messages).to.have.length(1);
		});
	}

	it('should prefer onEnd and include every tool step in callback history without modifying SDK messages', async () => {
		const usage = {
			inputTokens: { total: 2, noCache: 2, cacheRead: 0, cacheWrite: 0 },
			outputTokens: { total: 3, text: 3, reasoning: 0 },
		};
		const model = new MockLanguageModelV3({ doStream: [
			{ stream: convertArrayToReadableStream([
				{ type: 'stream-start', warnings: [] },
				{ type: 'tool-call', toolCallId: 'double-call', toolName: 'double', input: '{"value":2}' },
				{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool-calls' }, usage },
			]) },
			{ stream: convertArrayToReadableStream([
				{ type: 'stream-start', warnings: [] },
				{ type: 'response-metadata', id: 'finish-response', modelId: 'finish-model' },
				{ type: 'text-start', id: 'text' },
				{ type: 'text-delta', id: 'text', delta: 'DONE' },
				{ type: 'text-end', id: 'text' },
				{ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
			]) },
		] });
		let legacyCalls = 0;
		const callbacks: { response: { messages: ModelMessage[], messageHistory: ModelMessage[], id: string }, responseMessages: ModelMessage[] }[] = [];
		const double = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: ({ value }) => value * 2 });
		const streamer = create.TextStreamer({
			model, tools: { double }, stopWhen: stepCountIs(2), prompt: 'Double it.',
			onFinish: () => { legacyCalls++; },
			onEnd: event => {
				const history: ModelMessage[] = event.response.messageHistory;
				expect(history[0].content).to.equal('Earlier input.');
				callbacks.push(event);
			},
		});
		const result = streamer([{ role: 'user', content: 'Earlier input.' }]);
		await collect(result.textStream);
		expect(legacyCalls).to.equal(0);
		expect(callbacks).to.have.length(1);
		expect(callbacks[0].response.messages.map(message => message.role)).to.deep.equal(['user', 'assistant', 'tool', 'assistant']);
		expect(callbacks[0].response.messageHistory).to.deep.equal((await result.response).messageHistory);
		expect(callbacks[0].response.id).to.equal('finish-response');
		expect(callbacks[0].responseMessages).to.deep.equal(await result.responseMessages);
		expect(callbacks[0].responseMessages).to.have.length(3);
		expect((await result.finalStep).response.messages).to.have.length(1);
	});

	it('should isolate run-time finish callbacks and type annotated callback history', async () => {
		const called: string[] = [];
		const configured = (event: StreamTextOnFinishEvent<ToolSet>) => {
			const history: ModelMessage[] = event.response.messageHistory;
			expect(history[0].content).to.equal('Input.');
			called.push('configured');
		};
		const streamer = create.TextStreamer({ model: mockModel('DONE'), prompt: 'Input.', onFinish: configured });
		const overridden = streamer.run({ onFinish: event => {
			const history: ModelMessage[] = event.response.messageHistory;
			expect(history[0].content).to.equal('Input.');
			called.push('override');
		} });
		await collect(overridden.textStream);
		await collect(streamer().textStream);
		expect(called).to.deep.equal(['override', 'configured']);
		expect(streamer.config.onFinish).to.equal(configured);
	});

	it('should forward stream errors to onError and the SDK error event', async () => {
		const failure = new Error('Mock stream failure');
		const model = new MockLanguageModelV3({ doStream: () => Promise.reject(failure) });
		const errors: unknown[] = [];
		const streamer = create.TextStreamer({ model, prompt: 'Input.', maxRetries: 0, onError: ({ error }) => { errors.push(error); } });
		const result = streamer();
		const rejected = rejects(Promise.resolve(result.text), /No output generated/);
		const events = await collect(result.fullStream);
		await rejected;
		expect(errors).to.deep.equal([failure]);
		expect(events.find(event => event.type === 'error')).to.include({ error: failure });
	});

	it('should honor an empty one-off template without changing the configured prompt', async () => {
		const model = mockModel('DONE');
		const messages: ModelMessage[] = [{ role: 'user', content: 'Static input.' }];
		const generator = create.TextGenerator.withTemplate({ model, messages, prompt: 'Configured prompt.' });
		await generator.run({ prompt: '' });
		await generator();
		expect(promptCalls(model, false)).to.deep.equal([
			[{ role: 'user', content: [{ type: 'text', text: 'Static input.' }] }],
			[
				{ role: 'user', content: [{ type: 'text', text: 'Static input.' }] },
				{ role: 'user', content: [{ type: 'text', text: 'Configured prompt.' }] },
			],
		]);
	});
});
