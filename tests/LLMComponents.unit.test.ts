import { runtimeRun } from './fixtures/runtime-call.js';
import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ModelMessage, ToolSet } from 'ai';
import { jsonSchema, Output, stepCountIs } from 'ai';
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

	it('rejects erased iterable model outputs on tool execution without consuming them', async () => {
		let acquired = 0;
		const source = { async *[Symbol.asyncIterator]() { acquired++; yield 1; } };
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments -- Explicit erasure prevents inference from the validator's iterable output.
		const outputSchema = jsonSchema<unknown>({ type: 'object', properties: {}, additionalProperties: false }, {
			validate: () => ({ success: true, value: source }),
		});
		const tools = [
			create.LLMAgent.asTool({ model: mockModel('{}'), prompt: 'ready', inputSchema: z.object({}), output: Output.object({ schema: outputSchema }) }),
			create.LLMAgent.asStream.asTool({ model: mockModel('{}'), prompt: 'ready', inputSchema: z.object({}), output: Output.object({ schema: outputSchema }) }),
		];
		for (const component of tools) {
			expect(await (await component()).value).to.equal(source);
			await rejects(async () => { await component.execute({}, { toolCallId: 'output', messages: [], context: undefined }); }, /requires textStreamSchema/);
		}
		expect(acquired).to.equal(0);
	});

	for (const [name, factory, object] of [
		['generate', create.LLMAgent, false], ['stream', create.LLMAgent, false],
		['generate-structured', create.LLMAgent, true], ['stream-structured', create.LLMAgent, true],
	] as const) {
		for (const modifier of ['withText', 'withTemplate', 'withScript', 'withFunction', 'loadsText', 'loadsTemplate', 'loadsScript'] as const) {
			it(`${name}.${modifier} rejects constructor signals, including inherited ones`, () => {
				const build = (name.startsWith('stream') ? factory[modifier].asStream : factory[modifier]) as (config: object, parent?: { config: object }) => unknown;
				const config = {
					model: mockModel(answer), prompt: modifier === 'withFunction' ? () => 'question' : 'question',
					...(object && { output: Output.object({ schema }) }), ...(modifier.startsWith('loads') && { loader: { load: () => 'question' } }),
				};
				const abortSignal = new AbortController().signal;
				expect(() => build({ ...config, abortSignal })).to.throw(/'abortSignal' is an invocation setting/);
				expect(() => build(config, { config: { abortSignal } })).to.throw(/'abortSignal' is an invocation setting/);
			});
		}
	}

	it('rejects signals in reusable Config fragments', () => {
		const abortSignal = new AbortController().signal;
		// @ts-expect-error Signals belong to an invocation, not reusable configuration.
		expect(() => create.Config({ abortSignal })).to.throw(/'abortSignal' is an invocation setting/);
		// @ts-expect-error Inherited signals are not reusable configuration either.
		expect(() => create.Config({}, { config: { abortSignal } })).to.throw(/'abortSignal' is an invocation setting/);
	});

	for (const [name, factory, object] of [
		['generate', create.LLMAgent, false], ['stream', create.LLMAgent, false],
		['generate-structured', create.LLMAgent, true], ['stream-structured', create.LLMAgent, true],
	] as const) {
		for (const preparation of ['template-context', 'template-filter', 'script-context', 'function'] as const) {
			it(`${name} rejects ${preparation} failures before model dispatch`, async () => {
				for (const asynchronous of [false, true]) {
					const model = mockModel(answer);
					const failure = new Error('Preparation failed');
					let attempts = 0;
					const fail = () => {
						attempts++;
						if (asynchronous) return Promise.reject(failure);
						throw failure;
					};
					const modifier = preparation === 'function' ? 'withFunction' : preparation === 'script-context' ? 'withScript' : 'withTemplate';
					const build = (name.startsWith('stream') ? factory[modifier].asStream : factory[modifier]) as unknown as (config: object) => { (): Promise<unknown>, run(config: object): Promise<unknown> };
					const component = build({ model, ...(object && { output: Output.object({ schema }) }),
						prompt: preparation === 'function' ? fail : preparation === 'script-context' ? 'return fail()'
							: preparation === 'template-filter' ? '{{ "input" | fail }}' : '{{ fail() }}',
						...(preparation === 'template-filter' ? { filters: { fail } } : preparation === 'function' ? {} : { context: { fail } }),
					});
					for (const invoke of [() => component(), () => runtimeRun(component, { context: { topic: undefined } })]) {
						await rejects(invoke, error => preparation === 'function' ? error === failure
							: error instanceof Error && error.message.includes(failure.message));
					}
					expect(attempts).to.equal(2);
					expect(model.doGenerateCalls).to.have.length(0);
					expect(model.doStreamCalls).to.have.length(0);
				}
			});
		}
		for (const modifier of ['loadsText', 'loadsTemplate', 'loadsScript'] as const) {
			it(`${name}.${modifier} rejects missing resources before model dispatch`, async () => {
				for (const asynchronous of [false, true]) {
					const model = mockModel(answer);
					const names: string[] = [];
					const loader = { load: (name: string) => { names.push(name); return asynchronous ? Promise.resolve(null) : null; } };
					const build = (name.startsWith('stream') ? factory[modifier].asStream : factory[modifier]) as unknown as (config: object) => { (): Promise<unknown>, run(config: object): Promise<unknown> };
					const component = build({ model, loader, prompt: 'configured-missing', ...(object && { output: Output.object({ schema }) }) });
					expect(names).to.deep.equal([]);
					await rejects(() => component(), /not found/);
					await rejects(() => runtimeRun(component, { prompt: 'call-missing' }), /not found/);
					expect(names).to.deep.equal(['configured-missing', 'call-missing']);
					expect(model.doGenerateCalls).to.have.length(0);
					expect(model.doStreamCalls).to.have.length(0);
				}
			});
		}
		it(`${name}.loadsText prefers a matching child loader over the parent`, async () => {
			const model = mockModel(answer);
			const loads: string[] = [];
			const parent = create.Config({ loader: { load: () => { loads.push('parent'); return 'Parent.'; } } });
			const config = { model, prompt: 'shared', loader: { load: () => { loads.push('child'); return 'Child.'; } }, ...(object && { output: Output.object({ schema }) }) };
			const build = (name.startsWith('stream') ? factory.loadsText.asStream : factory.loadsText) as unknown as (config: object, parent: { config: object }) =>
				() => Promise<{ partialOutputStream?: AsyncIterable<unknown>, output?: unknown }>;
			const result = await build(config, parent)();
			const partials = result.partialOutputStream;
			if (partials) await collect(partials);
			await result.output;
			expect(loads).to.deep.equal(['child']);
			expect([...model.doGenerateCalls, ...model.doStreamCalls].map(call => call.prompt[0].content))
				.to.deep.equal([[{ type: 'text', text: 'Child.' }]]);
		});
	}

	for (const streaming of [false, true]) {
		for (const object of [false, true]) {
			for (const preparation of ['run', 'function', 'loader']) {
				it(`${object ? 'object' : 'text'} ${streaming ? 'streamer' : 'generator'} checks cancellation after ${preparation} preparation`, async () => {
					const controller = new AbortController();
					const reason = { cancelled: true };
					const model = mockModel(answer);
					let prepared = false;
					const prepare = async () => {
						await Promise.resolve();
						controller.abort(reason);
						prepared = true;
						return 'question';
					};
					const common = { model };
					const plain = { ...common, prompt: 'question' };
					const fn = { ...common, prompt: prepare };
					const loaded = { ...common, prompt: 'source', loader: { load: prepare } };
					if (preparation === 'run') controller.abort(reason);
					const component: { run(config: { abortSignal: AbortSignal }): unknown } = preparation === 'function'
						? object ? streaming ? create.LLMAgent.withFunction.asStream({ ...fn, output: Output.object({ schema: schema }) }) : create.LLMAgent.withFunction({ ...fn, output: Output.object({ schema: schema }) })
							: streaming ? create.LLMAgent.withFunction.asStream(fn) : create.LLMAgent.withFunction(fn)
						: preparation === 'loader'
							? object ? streaming ? create.LLMAgent.loadsText.asStream({ ...loaded, output: Output.object({ schema: schema }) }) : create.LLMAgent.loadsText({ ...loaded, output: Output.object({ schema: schema }) })
								: streaming ? create.LLMAgent.loadsText.asStream(loaded) : create.LLMAgent.loadsText(loaded)
							: object ? streaming ? create.LLMAgent.asStream({ ...plain, output: Output.object({ schema: schema }) }) : create.LLMAgent({ ...plain, output: Output.object({ schema: schema }) })
								: streaming ? create.LLMAgent.asStream(plain) : create.LLMAgent(plain);
					await rejects(async () => runtimeRun(component, { abortSignal: controller.signal }), error => error === reason);
					expect(prepared).to.equal(preparation === 'function' || preparation === 'loader');
					expect(model.doGenerateCalls).to.have.length(0);
					expect(model.doStreamCalls).to.have.length(0);
				});
			}
		}
	}

	for (const streaming of [false, true]) {
		const name = streaming ? 'stream-structured' : 'generate-structured';
		for (const promptType of ['template', 'script'] as const) {
			it(`should validate raw call-time input before rendering ${name} ${promptType} run overrides`, async () => {
				const original = mockModel(answer);
				const replacement = mockModel('{"answer":8}');
				let validations = 0;
				const inputSchema = z.object({ topic: z.string() }).strict().refine(() => {
					validations++;
					return true;
				});
				const common = { model: original, output: Output.object({ schema }), inputSchema, context: { topic: 'Configured', prefix: 'About' }, maxOutputTokens: 10 };
				const template = { ...common, prompt: '{{ prefix }} {{ topic }}' };
				const script = { ...common, prompt: 'return prefix ~ " " ~ topic' };
				const component = promptType === 'template'
					? streaming ? create.LLMAgent.withTemplate.asStream(template) : create.LLMAgent.withTemplate(template)
					: streaming ? create.LLMAgent.withScript.asStream(script) : create.LLMAgent.withScript(script);
				const call = component as (...args: unknown[]) => ReturnType<typeof component>;
				const result = await runtimeRun(component, { model: replacement, context: { topic: 'Runtime' }, maxOutputTokens: 25 });
				if ('partialOutputStream' in result) await collect<unknown>(result.partialOutputStream);
				expect(await result.output).to.deep.equal({ answer: 8 });
				expect(await result.value).to.equal(await result.output);
				expect(validations).to.equal(1);
				expect(promptCalls(replacement, streaming)).to.deep.equal([[
					{ role: 'user', content: [{ type: 'text', text: 'About Runtime' }] },
				]]);
				const calls = streaming ? replacement.doStreamCalls : replacement.doGenerateCalls;
				expect(calls[0].maxOutputTokens).to.equal(25);
				await rejects(() => runtimeRun(component, { context: { topic: 1 } }), /Application input validation failed/);
				await rejects(() => runtimeRun(component, { context: { topic: undefined } }), /Application input validation failed/);
				expect(calls).to.have.length(1);
				const second = await call({ topic: 'Next' });
				if ('partialOutputStream' in second) await collect(second.partialOutputStream);
				expect(await second.output).to.deep.equal({ answer: 4 });
				expect(validations).to.equal(2);
				expect(component.config.model).to.equal(original);
				expect(component.config.context).to.deep.equal({ topic: 'Configured', prefix: 'About' });
			});

			it(`should isolate one-off ${name} ${promptType} prompts and append conversational history`, async () => {
				const model = mockModel(answer);
				const history: ModelMessage[] = [{ role: 'assistant', content: 'Earlier reply.' }];
				const common = { model, output: Output.object({ schema }), instructions: 'Static instructions.', inputSchema: z.object({ topic: z.string() }), context: { topic: 'Configured' } };
				const template = { ...common, prompt: 'Original {{ topic }}' };
				const script = { ...common, prompt: 'return "Original " ~ topic' };
				const component = promptType === 'template'
					? streaming ? create.LLMAgent.withTemplate.asStream(template) : create.LLMAgent.withTemplate(template)
					: streaming ? create.LLMAgent.withScript.asStream(script) : create.LLMAgent.withScript(script);
				const call = component as (...args: unknown[]) => ReturnType<typeof component>;
				const prompt = promptType === 'template' ? 'Override {{ topic }}' : 'return "Override " ~ topic';
				const result = await call(prompt, { topic: 'Runtime' }, history);
				if ('partialOutputStream' in result) await collect<unknown>(result.partialOutputStream);
				expect(await result.output).to.deep.equal({ answer: 4 });
				expect(await result.value).to.equal(await result.output);
				const response = await result.response;
				expect(response).not.to.have.property('messageHistory');
				expect(response).to.have.property('messages');
				const second = await component();
				if ('partialOutputStream' in second) await collect(second.partialOutputStream);
				expect(await second.output).to.deep.equal({ answer: 4 });
				expect(promptCalls(model, streaming)).to.deep.equal([
					[
						{ role: 'system', content: 'Static instructions.' },
						{ role: 'assistant', content: [{ type: 'text', text: 'Earlier reply.' }] },
						{ role: 'user', content: [{ type: 'text', text: 'Override Runtime' }] },
					],
					[
						{ role: 'system', content: 'Static instructions.' },
						{ role: 'user', content: [{ type: 'text', text: 'Original Configured' }] },
					],
				]);
				expect(history).to.deep.equal([{ role: 'assistant', content: 'Earlier reply.' }]);
			});
		}

		it(`should accept script-generated message arrays for ${name} without wrapping them as text`, async () => {
			const model = mockModel(answer);
			const history: ModelMessage[] = [{ role: 'assistant', content: 'Earlier reply.' }];
			const prompt: ModelMessage[] = [{ role: 'user', content: 'Extract this.' }, { role: 'assistant', content: 'Example.' }];
			const config = { model, output: Output.object({ schema }), instructions: 'Static instructions.', context: { promptMessages: prompt }, prompt: 'return promptMessages' };
			const component = streaming ? create.LLMAgent.withScript.asStream(config) : create.LLMAgent.withScript(config);
			const result = await runtimeRun(component, { messageHistory: history });
			if ('partialOutputStream' in result) await collect<unknown>(result.partialOutputStream);
			expect(await result.output).to.deep.equal({ answer: 4 });
			expect(await result.value).to.equal(await result.output);
			expect(promptCalls(model, streaming)).to.deep.equal([[
				{ role: 'system', content: 'Static instructions.' },
				{ role: 'assistant', content: [{ type: 'text', text: 'Earlier reply.' }] },
				{ role: 'user', content: [{ type: 'text', text: 'Extract this.' }] },
				{ role: 'assistant', content: [{ type: 'text', text: 'Example.' }] },
			]]);
		});

		it(`should generate unstructured JSON with ${name} no-schema output`, async () => {
			const object = { status: 'ok', values: [1, null, true] };
			const text = JSON.stringify(object);
			const model = mockModel(text, [text.slice(0, 15), text.slice(15)]);
			const config = { model, output: Output.json(), prompt: 'Return JSON.' };
			const component = streaming ? create.LLMAgent.asStream(config) : create.LLMAgent(config);
			const result = await component();
			if ('textStream' in result) expect((await collect(result.textStream)).join('')).to.equal(text);
			expect(await result.output).to.deep.equal(object);
			expect(component.config.output.name).to.equal('json');
		});
	}

	it('should validate enum output against its allowed values', async () => {
		const model = mockModel('{"result":"Blue"}');
		const generator = create.LLMAgent({ model, prompt: 'Choose.', output: Output.choice({ options: ['Red', 'Blue'] as const }) });
		expect((await generator()).output).to.equal('Blue');
		const invalid = create.LLMAgent({ model: mockModel('{"result":"Green"}'), prompt: 'Choose.', output: Output.choice({ options: ['Red', 'Blue'] }) });
		await rejects(() => invalid(), /No object generated/);
	});

	it('should pass schema guidance to the SDK', async () => {
		const model = mockModel(answer);
		const generator = create.LLMAgent({ model, prompt: 'Return an answer.', output: Output.object({ schema: schema, name: 'Answer', description: 'A numeric answer' }) });
		expect((await generator()).output).to.deep.equal({ answer: 4 });
		expect(model.doGenerateCalls[0].responseFormat).to.include({ type: 'json', name: 'Answer', description: 'A numeric answer' });
	});

	it('should validate generated array elements against the element schema', async () => {
		const generator = create.LLMAgent({ model: mockModel('{"elements":[{"answer":4},{"answer":8}]}'), prompt: 'Return answers.', output: Output.array({ element: schema }) });
		expect((await generator()).output).to.deep.equal([{ answer: 4 }, { answer: 8 }]);
		const invalid = create.LLMAgent({ model: mockModel('{"elements":[{"answer":"wrong"}]}'), prompt: 'Return answers.', output: Output.array({ element: schema }) });
		await rejects(() => invalid(), /No object generated/);
	});

	it('should expose schema validation failures from object streams after partial updates', async () => {
		const streamer = create.LLMAgent.asStream({ model: mockModel('{"answer":"wrong"}', ['{"answer":', '"wrong"}']), prompt: 'Return an answer.', output: Output.object({ schema: schema }) });
		const result = (await streamer());
		const rejected = rejects(Promise.resolve(result.output), /No object generated/);
		const partials = await collect<unknown>(result.partialOutputStream);
		await rejected;
		expect(partials).to.deep.include({ answer: 'wrong' });
	});

	for (const factoryName of ['generate', 'stream', 'generate-structured', 'stream-structured'] as const) {
		it(`should cache loaded text and restore it after one-off ${factoryName} overrides`, async () => {
			const loaded: string[] = [];
			const loader = { load: async (name: string) => {
				loaded.push(name);
				return `Loaded ${name} {{ literal }}`;
			} };
			const model = mockModel(answer);
			const config = { model, loader, prompt: 'default' };
			const component = factoryName === 'generate' ? create.LLMAgent.loadsText(config)
				: factoryName === 'stream' ? create.LLMAgent.loadsText.asStream(config)
					: factoryName === 'generate-structured' ? create.LLMAgent.loadsText({ ...config, output: Output.object({ schema: schema }) })
						: create.LLMAgent.loadsText.asStream({ ...config, output: Output.object({ schema: schema }) });
			for (const prompt of [undefined, 'override', undefined]) {
				const run = component.run as (input: { prompt?: string }) => ReturnType<typeof component>;
				const result = await run(prompt === undefined ? {} : { prompt });
				if ('partialOutputStream' in result) await collect<unknown>(result.partialOutputStream);
				await result.output;
			}
			expect(loaded).to.deep.equal(['default', 'override']);
			const streaming = factoryName.startsWith('stream');
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
			const config = { model, loader, prompt: 'default', inputSchema: z.object({ topic: z.string() }), context: { topic: 'Configured' } };
			const component = factoryName === 'generate' ? create.LLMAgent.loadsScript(config)
				: factoryName === 'stream' ? create.LLMAgent.loadsScript.asStream(config)
					: factoryName === 'generate-structured' ? create.LLMAgent.loadsScript({ ...config, output: Output.object({ schema: schema }) })
						: create.LLMAgent.loadsScript.asStream({ ...config, output: Output.object({ schema: schema }) });
			const call = component as (...args: unknown[]) => ReturnType<typeof component>;
			const results = [
				await call({ topic: 'First' }),
				await runtimeRun(component, { prompt: 'override', context: { topic: 'Runtime' } }),
				await component(),
			];
			for (const result of results) {
				if ('partialOutputStream' in result) await collect<unknown>(result.partialOutputStream);
				await result.output;
			}
			expect(loaded).to.deep.equal(['default', 'override']);
			expect(promptCalls(model, factoryName.startsWith('stream'))).to.deep.equal(['default First', 'override Runtime', 'default Configured'].map(text => [
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
			const config = { model, inputSchema, prompt: (context: { value: number }) => {
				events.push('prompt');
				return `Value ${context.value}`;
			} };
			const component = factoryName === 'generate' ? create.LLMAgent.withFunction(config)
				: factoryName === 'stream' ? create.LLMAgent.withFunction.asStream(config)
					: factoryName === 'generate-structured' ? create.LLMAgent.withFunction({ ...config, output: Output.object({ schema: schema }) })
						: create.LLMAgent.withFunction.asStream({ ...config, output: Output.object({ schema: schema }) });
			const call = component as (input: { value: number }) => ReturnType<typeof component>;
			const pending = call({ value: 2 });
			expect(events).not.to.include('prompt');
			const result = await pending;
			if ('partialOutputStream' in result) await collect<unknown>(result.partialOutputStream);
			await result.output;
			expect(events).to.deep.equal(['validate', 'prompt']);
			await rejects(() => runtimeRun(component, { context: { value: 'invalid' } }), /Application input validation failed/);
			expect(events).to.deep.equal(['validate', 'prompt', 'validate']);
			expect(promptCalls(model, factoryName.startsWith('stream'))).to.have.length(1);
		});
	}

	it('should support optional SDK input schemas without a local validator', async () => {
		const inputSchema = jsonSchema<{ value?: number }>({ type: 'object', properties: { value: { type: 'number' } } });
		const generator = create.LLMAgent.withFunction({ model: mockModel('DONE'), inputSchema, prompt: context => `Value ${context.value ?? 0}` });
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
			const component = create.LLMAgent.loadsText({ model, prompt: 'missing', loader: async name => name === 'valid' ? 'Loaded prompt.' : null });
			await component('valid');
			await new Promise(resolve => setImmediate(resolve));
			await rejects(() => component(), /Failed to load prompt/);
		`;
		await promisify(execFile)(process.execPath, ['--unhandled-rejections=strict', '--import', 'tsx', '--conditions=casai-source', '--input-type=module', '--eval', code]);
	});

	for (const streaming of [false, true]) {
		it(`should replace configured prompt arrays and accept explicit history in ${streaming ? 'streams' : 'generators'}`, async () => {
			const prompt: ModelMessage[] = [{ role: 'user', content: 'Example.' }, { role: 'assistant', content: 'Example answer.' }];
			const model = mockModel('DONE');
			const component = streaming ? create.LLMAgent.asStream({ model, prompt }) : create.LLMAgent({ model, prompt });
			const call = component as (prompt: string) => ReturnType<typeof component>;
			const result = await call('Runtime.');
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
			const fixed = streaming ? create.LLMAgent.asStream({ model: staticModel }) : create.LLMAgent({ model: staticModel });
			const fixedResult = await fixed.run({ prompt: 'Runtime.', messageHistory: prompt });
			await fixedResult.text;
			expect(promptCalls(staticModel, streaming)).to.deep.equal([[
				{ role: 'user', content: [{ type: 'text', text: 'Example.' }] },
				{ role: 'assistant', content: [{ type: 'text', text: 'Example answer.' }] },
				{ role: 'user', content: [{ type: 'text', text: 'Runtime.' }] },
			]]);
			expect((await fixedResult.messageHistory)).to.have.length(4);
			expect(prompt).to.deep.equal([{ role: 'user', content: 'Example.' }, { role: 'assistant', content: 'Example answer.' }]);
		});
	}

	for (const object of [false, true]) {
		it(`should forward tool execution metadata by identity for ${object ? 'object' : 'text'} generators`, async () => {
			const options = { toolCallId: 'metadata', messages: [{ role: 'user' as const, content: 'Tool conversation.' }], abortSignal: new AbortController().signal, context: undefined };
			const input = { value: 2, _toolOptions: { toolCallId: 'spoofed' } };
			const inputSchema = z.object({ value: z.number() });
			const model = mockModel(object ? answer : 'DONE');
			const config = { model, inputSchema, description: 'Metadata tool', context: { prefix: 'Configured' }, prompt: (context: Record<string, unknown>) => {
				expect(context._toolOptions).to.deep.equal({ toolCallId: options.toolCallId, messages: options.messages, ...('abortSignal' in options ? { abortSignal: options.abortSignal } : {}) });
				return `${String(context.prefix)} ${String(context.value)}`;
			} };
			const tool = object ? create.LLMAgent.withFunction.asTool({ ...config, output: Output.object({ schema: schema }) }) : create.LLMAgent.withFunction.asTool(config);
			expect(await tool.execute(input, options)).to.deep.equal(object ? { answer: 4 } : 'DONE');
			expect(tool.description).to.equal('Metadata tool');
			expect(tool.config.inputSchema).to.equal(inputSchema);
			expect(input._toolOptions.toolCallId).to.equal('spoofed');
			expect(promptCalls(model, false)).to.deep.equal([[
				{ role: 'user', content: [{ type: 'text', text: 'Configured 2' }] },
			]]);
		});
	}

	for (const promptType of ['text', 'template', 'script', 'function'] as const) {
		it(`should preserve native metadata and expose separate history in ${promptType} stream finish callbacks`, async () => {
			const model = mockModel('DONE', ['DO', 'NE']);
			const history: ModelMessage[] = [{ role: 'assistant', content: 'Earlier reply.' }];
			const callbacks: { text: string, response: { messages: ModelMessage[], messageHistory?: ModelMessage[] }, responseMessages: ModelMessage[], finishReason: string }[] = [];
			const config = { model, instructions: 'Static instructions.', onEnd: (event: typeof callbacks[number]) => { callbacks.push(event); } };
			const component = promptType === 'text' ? create.LLMAgent.asStream({ ...config, prompt: 'Input.' })
				: promptType === 'template' ? create.LLMAgent.withTemplate.asStream({ ...config, context: { input: 'Input.' }, prompt: '{{ input }}' })
					: promptType === 'script' ? create.LLMAgent.withScript.asStream({ ...config, context: { input: 'Input.' }, prompt: 'return input' })
						: create.LLMAgent.withFunction.asStream({ ...config, prompt: () => 'Input.' });
			const result = await runtimeRun(component, { messageHistory: history });
			expect((await collect(result.textStream)).join('')).to.equal('DONE');
			const response = await result.response;
			expect(callbacks).to.have.length(1);
			expect(callbacks[0].text).to.equal('DONE');
			expect(callbacks[0].finishReason).to.equal('stop');
			expect(callbacks[0].response.messages).to.deep.equal(response.messages);
			expect(callbacks[0].response).not.to.have.property('messageHistory');
			expect(await result.messageHistory).to.deep.equal([history[0], { role: 'user', content: 'Input.' }, ...response.messages]);
			expect(callbacks[0].responseMessages).to.deep.equal(await result.responseMessages);
			expect(callbacks[0].responseMessages).to.have.length(1);
			expect((await result.finalStep).response.messages).to.have.length(1);
		});
	}

	it('should prefer onEnd and retain native step messages alongside aggregate response messages', async () => {
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
		const callbacks: { response: { messages: ModelMessage[], id: string }, responseMessages: ModelMessage[] }[] = [];
		const double = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: ({ value }) => value * 2 });
		const streamer = create.LLMAgent.asStream({
			model, tools: { double }, stopWhen: stepCountIs(2), prompt: 'Double it.',
			onEnd: event => {
				expect(event.response.messages.map(message => message.role)).to.deep.equal(['assistant']);
				callbacks.push(event);
			},
		});
		const result = await streamer.stream({ messages: [{ role: 'user', content: 'Earlier input.' }, { role: 'user', content: 'Double it.' }], onFinish: () => { legacyCalls++; }, onEnd: () => { /* override the native alias */ } });
		await collect(result.textStream);
		expect(legacyCalls).to.equal(0);
		expect(callbacks).to.have.length(1);
		expect(callbacks[0].response.messages.map(message => message.role)).to.deep.equal(['assistant']);
		expect(await result.messageHistory).to.deep.equal([{ role: 'user', content: 'Earlier input.' }, { role: 'user', content: 'Double it.' }, ...callbacks[0].responseMessages]);
		expect(callbacks[0].response.id).to.equal('finish-response');
		expect(callbacks[0].responseMessages).to.deep.equal(await result.responseMessages);
		expect(callbacks[0].responseMessages).to.have.length(3);
		expect((await result.finalStep).response.messages).to.have.length(1);
	});

	it('should isolate run-time finish callbacks and type native callback responses', async () => {
		const called: string[] = [];
		const configured = (event: StreamTextOnFinishEvent<ToolSet>) => {
			const messages: ModelMessage[] = event.response.messages;
			expect(messages[0].role).to.equal('assistant');
			called.push('configured');
		};
		const streamer = create.LLMAgent.asStream({ model: mockModel('DONE'), prompt: 'Input.', onEnd: configured });
		const overridden = (await streamer.run({ onEnd: event => {
			const messages: ModelMessage[] = event.response.messages;
			expect(messages[0].role).to.equal('assistant');
			called.push('override');
		} }));
		await collect(overridden.textStream);
		await collect((await streamer()).textStream);
		expect(called).to.deep.equal(['configured', 'override', 'configured']);
		expect(streamer.config.onEnd).to.equal(configured);
	});

	it('should forward stream errors to onError and the SDK error event', async () => {
		const failure = new Error('Mock stream failure');
		const model = new MockLanguageModelV3({ doStream: () => Promise.reject(failure) });
		const errors: unknown[] = [];
		const streamer = create.LLMAgent.asStream({ model, prompt: 'Input.', maxRetries: 0, onError: ({ error }) => { errors.push(error); } });
		const result = (await streamer());
		const rejected = rejects(Promise.resolve(result.text), /No output generated/);
		const events = await collect(result.stream);
		await rejected;
		expect(errors).to.deep.equal([failure]);
		expect(events.find(event => event.type === 'error')).to.include({ error: failure });
	});

	it('should honor an empty one-off template without changing the configured prompt', async () => {
		const model = mockModel('DONE');
		const messages: ModelMessage[] = [{ role: 'user', content: 'Static input.' }];
		const generator = create.LLMAgent.withTemplate({ model, prompt: 'Configured prompt.' });
		await generator.run({ prompt: '', messageHistory: messages });
		await generator.run({ messageHistory: messages });
		expect(promptCalls(model, false)).to.deep.equal([
			[
				{ role: 'user', content: [{ type: 'text', text: 'Static input.' }] },
				{ role: 'user', content: [{ type: 'text', text: '' }] },
			],
			[
				{ role: 'user', content: [{ type: 'text', text: 'Static input.' }] },
				{ role: 'user', content: [{ type: 'text', text: 'Configured prompt.' }] },
			],
		]);
	});
});
