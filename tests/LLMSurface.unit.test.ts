import assert from 'node:assert/strict';
import { NoOutputGeneratedError, Output, smoothStream, streamText, ToolLoopAgent } from 'ai';
import type { ModelMessage, StreamTextTransform, TextStreamPart, ToolSet } from 'ai';
import type { LanguageModelV3CallOptions, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { create, z } from './cascada';

const usage = {
	inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const raw = '{"n":"7"}';
const finishReason = { unified: 'stop', raw: 'stop' } as const;
const factories = ['generate', 'stream', 'generate-structured', 'stream-structured'] as const;
const modifiers = ['withText', 'withTemplate', 'withScript', 'withFunction', 'loadsText', 'loadsTemplate', 'loadsScript'] as const;

function model() {
	return new MockLanguageModelV3({
		doGenerate: { content: [{ type: 'text', text: raw }], finishReason, usage, warnings: [] },
		doStream: { stream: convertArrayToReadableStream([
			{ type: 'stream-start', warnings: [] }, { type: 'text-start', id: 'text' },
			{ type: 'text-delta', id: 'text', delta: raw }, { type: 'text-end', id: 'text' },
			{ type: 'finish', finishReason, usage },
		]) },
	});
}

interface Result {
	value: unknown;
	text?: string | PromiseLike<string>;
	object?: unknown;
	response: { messages?: ModelMessage[] } | PromiseLike<{ messages?: ModelMessage[] }>;
	responseMessages?: ModelMessage[] | PromiseLike<ModelMessage[]>;
	messageHistory?: ModelMessage[] | PromiseLike<ModelMessage[]>;
	partialOutputStream?: AsyncIterable<unknown>;
	consumeStream?: () => Promise<void>;
	output?: unknown;
	stream?: AsyncIterable<unknown>;
	textStream?: AsyncIterable<string>;
	steps?: unknown;
}
interface Component {
	(...args: unknown[]): Result | Promise<Result>;
	run(config: object): Result | Promise<Result>;
	config: { instructions?: string };
	version: string;
}

async function collect(stream: AsyncIterable<unknown>) {
	const values: unknown[] = [];
	for await (const value of stream) values.push(value);
	return values;
}

function deferred() {
	let resolve!: () => void;
	return { promise: new Promise<void>(done => { resolve = done; }), resolve: () => { resolve(); } };
}

describe('LLM surface combinations', () => {
	it('keeps model-derived strings and objects in rendering data when explicitly wrapped', async () => {
		for (const factory of ['generate', 'stream'] as const) {
			for (const value of ['{{ secret }}', { prompt: '{{ secret }}' }]) {
				for (const run of [false, true]) {
					const mock = model();
					const make = (factory === 'stream' ? create.LLMAgent.withTemplate.asStream : create.LLMAgent.withTemplate) as unknown as (config: object) => Component;
					const render = make({ model: mock, prompt: '{{ value.prompt or value }}', context: { secret: 'PRIVATE_SOURCE_SENTINEL' } });
					const result = await (run ? render.run({ context: { value } }) : render({ value }));
					await result.value;
					await result.consumeStream?.();
					const calls = factory === 'generate' ? mock.doGenerateCalls : mock.doStreamCalls;
					assert.equal(calls.length, 1);
					const message = calls[0].prompt.at(-1);
					assert.ok(message?.role === 'user');
					assert.deepEqual(message.content, [{ type: 'text', text: '{{ secret }}' }]);
				}
			}
		}
	});

	for (const factory of factories) {
		for (const modifier of modifiers) {
			it(`${factory}.${modifier}: ignores an undefined run model and retains the configured model`, async () => {
				const mock = model();
				let prepared = 0;
				const make = (factory.startsWith('stream') ? create.LLMAgent[modifier].asStream : create.LLMAgent[modifier]) as unknown as (config: object) => Component;
				const component = make({ model: mock, ...(factory.endsWith('-structured') && { output: Output.object({ schema: z.object({ n: z.string() }) }) }),
					prompt: modifier === 'withFunction' ? () => { prepared++; return 'go'; } : modifier === 'withScript' ? "return 'go'" : 'go',
					...(modifier.startsWith('loads') && { loader: { load: () => { prepared++; return modifier === 'loadsScript' ? "return 'go'" : 'go'; } } }),
				});
				const result = await component.run({ model: undefined });
				await result.output;
				assert.equal(prepared, modifier === 'withFunction' || modifier.startsWith('loads') ? 1 : 0);
				assert.equal(mock.doGenerateCalls.length + mock.doStreamCalls.length, 1);
			});

			it(`${factory}.${modifier}: undefined run prompt retains configured source`, async () => {
				const mock = model();
				const source = modifier === 'withScript' || modifier === 'loadsScript' ? "return 'configured'" : 'configured';
				const make = (factory.startsWith('stream') ? create.LLMAgent[modifier].asStream : create.LLMAgent[modifier]) as unknown as (config: object) => Component;
				const component = make({ model: mock, ...(factory.endsWith('-structured') && { output: Output.object({ schema: z.object({ n: z.string().transform(Number) }) }) }),
					prompt: modifier === 'withFunction' ? () => 'configured' : modifier.startsWith('loads') ? 'source' : source,
					...(modifier.startsWith('loads') && { loader: { load: () => source } }),
				});
				const result = await component.run({ prompt: undefined });
				const partials = result.partialOutputStream;
				if (partials) for await (const _part of partials) { /* Drain native object output. */ }
				await result.value;
				await result.consumeStream?.();
				const calls = factory.startsWith('stream') ? mock.doStreamCalls : mock.doGenerateCalls;
				assert.equal(calls.length, 1);
				assert.equal(calls[0].prompt.at(-1)?.role, 'user');
				assert.deepEqual(calls[0].prompt.at(-1)?.content, [{ type: 'text', text: 'configured' }]);
			});

			it(`${factory}.${modifier}: inheritance, entry, static messages and history`, async () => {
				for (const parent of [false, true]) for (const run of [false, true]) {
					for (const withStatic of [false, true]) for (const withHistory of [false, true]) {
						const mock = model();
						const streaming = factory.startsWith('stream');
						const plain = modifier === 'withText' || modifier === 'loadsText';
						const schema = z.object({ n: z.string().transform(Number) });
						const observed: object[] = [];
						const base = {
							model: mock,
							output: Output.object({ schema }), onEnd: (event: object) => { observed.push(event); },
							...(withStatic && { instructions: 'static' }),
						};
						const source = plain ? 'turn' : modifier.includes('Script') ? 'return label' : '{{ label }}';
						const preparation = {
							prompt: modifier === 'withFunction' ? ({ label }: { label: string }): string | ModelMessage[] =>
								withStatic ? [{ role: 'user', content: label }] : label
								: modifier.startsWith('loads') ? 'source' : source,
							...(!plain && { inputSchema: z.object({ label: z.string() }), context: { label: 'configured' } }),
							...(modifier.startsWith('loads') && { loader: { load: () => source } }),
						};
						const build = (factory.startsWith('stream') ? create.LLMAgent[modifier].asStream : create.LLMAgent[modifier]) as unknown as (config: object, parent?: { config: object }) => Component;
						const fragment = parent ? create.Config(base) : undefined;
						const component = build(parent ? preparation : { ...base, ...preparation }, fragment);
						assert.equal(component.version, 'agent-v1');
						const history: ModelMessage[] = withHistory ? [{ role: 'user', content: 'earlier' }] : [];
						const context = { label: 'turn' };
						const pending = run ? component.run({ messageHistory: history, ...(!plain && { context }) })
							: component(plain ? {} : context, history);
						assert.equal(typeof (pending as PromiseLike<Result>).then === 'function', true);
						const result = await pending;
						const partials = result.partialOutputStream;
						if (partials) for await (const _part of partials) { /* Native object streams need a consumer. */ }
						assert.deepEqual(await result.value, { n: 7 });
						await result.consumeStream?.();
						const calls = streaming ? mock.doStreamCalls : mock.doGenerateCalls;
						assert.equal(calls.length, 1);
						assert.deepEqual(calls[0].prompt.map(message => message.content), [
							...(withStatic ? ['static'] : []),
							...(withHistory ? [[{ type: 'text', text: 'earlier' }]] : []), [{ type: 'text', text: 'turn' }],
						]);
						// Compare the public path with the native SDK using the same prepared conversation.
						const nativeModel = model();
						const nativeMessages: ModelMessage[] = [];
						if (withHistory) nativeMessages.push(...history);
						nativeMessages.push({ role: 'user', content: 'turn' });
						const agent = new ToolLoopAgent({ model: nativeModel, output: Output.object({ schema }), ...(withStatic ? { instructions: 'static' } : {}) });
						const native = streaming ? await agent.stream({ messages: nativeMessages }) : await agent.generate({ messages: nativeMessages });
						assert.deepEqual(await result.value, await native.output);
						const nativeCalls = streaming ? nativeModel.doStreamCalls : nativeModel.doGenerateCalls;
						assert.equal(nativeCalls.length, 1);
						assert.deepEqual(calls[0].prompt, nativeCalls[0].prompt);
						assert.deepEqual(calls[0].responseFormat, nativeCalls[0].responseFormat);
						assert.equal('value' in { ...result }, false);
						assert.equal(observed.length, 1);
						assert.equal('messageHistory' in observed[0], false);
						assert.equal('messageHistory' in await result.response, false);
						assert.equal(await result.text, raw);
						assert.deepEqual(await result.messageHistory, [...history, { role: 'user', content: 'turn' }, ...await result.responseMessages!]);
					}
				}
			});
		}
	}
});

describe('Concurrent LLM invocations', () => {
	for (const factory of factories) for (const modifier of modifiers) {
		const object = factory.endsWith('-structured');
		const streaming = factory.startsWith('stream');
		for (const structured of object ? [true] : [false, true]) {
			it(`${factory}.${modifier}: isolates eight overlapping ${structured ? 'structured' : 'default-text'} executions`, async () => {
				const ready = deferred();
				const gates = Array.from({ length: 8 }, deferred);
				const entered = new Set<number>();
				const response = (options: LanguageModelV3CallOptions) => {
					const user = options.prompt.at(-1);
					assert.ok(user?.role === 'user');
					const prompt = user.content.filter(part => part.type === 'text').map(part => part.text).join('');
					const match = /^turn:(\d+)$/.exec(prompt);
					assert.ok(match);
					const id = Number(match[1]);
					assert.ok(id >= 1 && id <= 8);
					const run = (id - 1) % 2 === 0;
					assert.equal(options.seed, run ? id - 1 : undefined);
					assert.deepEqual(options.prompt.map(message => message.content), [
						'static',
						[{ type: 'text', text: `earlier:${id}` }],
						[{ type: 'text', text: `turn:${id}` }],
					]);
					assert.equal(entered.has(id), false, 'Each invocation must dispatch exactly once.');
					entered.add(id);
					if (entered.size === 8) ready.resolve();
					return { gate: gates[id - 1], raw: structured ? JSON.stringify({ n: String(id) }) : `answer:${id}` };
				};
				const mock = new MockLanguageModelV3({
					doGenerate: async options => {
						const { gate, raw } = response(options);
						await gate.promise;
						return { content: [{ type: 'text', text: raw }], usage, finishReason, warnings: [] };
					},
					doStream: async options => {
						const { gate, raw } = response(options);
						await gate.promise;
						return { stream: convertArrayToReadableStream([
							{ type: 'stream-start', warnings: [] }, { type: 'text-start', id: 'text' },
							{ type: 'text-delta', id: 'text', delta: raw.slice(0, 4) },
							{ type: 'text-delta', id: 'text', delta: raw.slice(4) }, { type: 'text-end', id: 'text' },
							{ type: 'finish', finishReason, usage },
						]) };
					},
				});
				const schema = z.object({ n: z.string().transform(Number) });
				const staticMessages: ModelMessage[] = [{ role: 'user', content: 'static' }];
				const parent = create.Config({ model: mock, maxRetries: 0, instructions: 'static',
					...(structured ? { output: Output.object({ schema }) } : {}),
				});
				const plain = modifier === 'withText' || modifier === 'loadsText';
				const source = plain ? 'turn:0' : modifier.includes('Script') ? "return 'turn:' ~ label" : 'turn:{{ label }}';
				const build = (factory.startsWith('stream') ? create.LLMAgent[modifier].asStream : create.LLMAgent[modifier]) as unknown as (config: object, parent: { config: object }) => Component;
				const component = build({
					prompt: modifier === 'withFunction' ? async ({ label }: { label: string }) => { await Promise.resolve(); return `turn:${label}`; }
						: modifier.startsWith('loads') ? '0' : source,
					...(!plain && { inputSchema: z.object({ label: z.string() }), context: { label: '0' } }),
					...(modifier.startsWith('loads') && { loader: { load: async (name: string) => modifier === 'loadsText' ? `turn:${name}` : source } }),
				}, parent);
				const tasks = gates.map(async (_gate, index) => {
					const id = String(index + 1);
					const run = index % 2 === 0;
					const history: ModelMessage[] = [{ role: 'user', content: `earlier:${id}` }];
					const context = { label: id };
					const prompt = modifier === 'loadsText' ? id : `turn:${id}`;
					const pending = run ? component.run({ ...(plain ? { prompt } : { context }), messageHistory: history, seed: index })
						: plain ? component(prompt, history) : component(context, history);
					history.length = 0;
					const result = await pending;
					const expected = structured ? { n: Number(id) } : `answer:${id}`;
					if (object) {
						const partials = result.partialOutputStream;
						if (partials) await collect(partials);
						assert.deepEqual(await result.value, expected);
						assert.equal(await result.value, await result.output);
					} else {
						const value = async () => structured || !streaming ? await result.value : (await collect(result.value as AsyncIterable<string>)).join('');
						if (streaming && !structured && index % 3 === 0) {
							const first = (result.value as AsyncIterable<string>)[Symbol.asyncIterator]();
							assert.equal((await first.next()).done, false);
							await first.return?.();
						}
						if (streaming && index % 3 === 1) {
							const first = result.textStream![Symbol.asyncIterator]();
							await first.next();
							await first.return?.();
						}
						if (index % 3 === 2) assert.deepEqual(await result.output, expected);
						const [actual, native, historyOut, steps] = await Promise.all([value(), result.output, result.messageHistory, result.steps,
							...(streaming ? [collect(result.stream!)] : []),
						]);
						assert.deepEqual(actual, expected);
						assert.deepEqual(native, expected);
						assert.equal((steps as unknown[]).length, 1);
						const before: ModelMessage[] = [{ role: 'user', content: `earlier:${id}` }];
						assert.deepEqual(historyOut, [...before, { role: 'user', content: `turn:${id}` }, ...await result.responseMessages!]);
						assert.deepEqual(await value(), expected);
					}
				});
				const completed = Promise.all(tasks);
				try {
					await Promise.race([ready.promise, completed]);
					assert.equal(entered.size, 8, 'All calls must overlap before any provider finishes.');
					for (let index = gates.length - 1; index >= 0; index--) {
						gates[index].resolve();
						await tasks[index];
					}
					await completed;
				} finally {
					for (const gate of gates) gate.resolve();
				}
				assert.equal(mock.doGenerateCalls.length + mock.doStreamCalls.length, 8);
				assert.equal(component.config.instructions, 'static');
				assert.deepEqual(staticMessages, [{ role: 'user', content: 'static' }]);
			});
		}
	}
});

describe('Stream retries combined with transforms', () => {
	for (const retry of ['automatic', 'callback']) for (const transform of ['none', 'smooth', 'uppercase']) {
		for (const ending of ['success', 'error-with-cause', 'error-without-cause']) {
			it(`${retry} retry, ${transform} transform, ${ending}`, async () => {
				for (const augmented of [false, true]) {
					const discarded = new Error('discarded attempt');
					const terminal = new Error('terminal attempt');
					const parts = (text: string): LanguageModelV3StreamPart[] => [
						{ type: 'stream-start', warnings: [] }, { type: 'text-start', id: 'text' },
						{ type: 'text-delta', id: 'text', delta: text }, { type: 'text-end', id: 'text' },
					];
					const mock = new MockLanguageModelV3({ doStream: [
						{ stream: convertArrayToReadableStream([...parts('discarded '), { type: 'error', error: discarded }]) },
						{ stream: convertArrayToReadableStream([
							...parts('final '), ...(ending === 'error-with-cause' ? [{ type: 'error' as const, error: terminal }] : []),
							{ type: 'finish', finishReason: ending === 'success' ? finishReason : { unified: 'error', raw: 'error' }, usage },
						]) },
					] });
					const uppercase: StreamTextTransform<ToolSet> = () => new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>({ transform(part, controller) {
						controller.enqueue(part.type === 'text-delta' ? { ...part, text: part.text.toUpperCase() } : part);
					} });
					let starts = 0;
					const settings = { model: mock, prompt: 'test', streamRetries: retry === 'automatic' ? 1 : 0,
						...(transform !== 'none' && { experimental_transform: transform === 'smooth' ? smoothStream({ delayInMs: null }) : uppercase }),
						onLanguageModelCallStart: () => { starts++; },
						onError: ({ error }: { error: unknown }) => error === discarded && retry === 'callback' ? { retry: true as const } : undefined,
					};
					const augmentedResult = await (augmented ? create.LLMAgent.asStream(settings)() : undefined);
					const result = (augmentedResult ?? streamText(settings));
					if (augmentedResult) {
						const read = async () => {
							const values: string[] = [];
							for await (const value of augmentedResult.value) values.push(value);
							return values.join('');
						};
						if (ending === 'success') assert.equal(await read(), await result.output);
						else await assert.rejects(read(), error => ending === 'error-with-cause' ? error === terminal : NoOutputGeneratedError.isInstance(error));
					}
					assert.equal(await result.output, transform === 'uppercase' ? 'FINAL ' : 'final ');
					assert.equal(await result.finishReason, ending === 'success' ? 'stop' : 'error');
					assert.equal(mock.doStreamCalls.length, 2);
					assert.equal(starts, 2);
				}
			});
		}
	}
});
