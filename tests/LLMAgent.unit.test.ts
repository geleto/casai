import assert from 'node:assert/strict';
import { Output, createAgentUIStream, isStepCount, tool, registerTelemetry, InvalidToolApprovalSignatureError } from 'ai';
import type { Agent, InferAgentUIMessage, LanguageModel, ModelMessage } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { z } from 'zod';
import { create, collectTextStream, ConfigError, ValidationError } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
const finishReason = { unified: 'stop', raw: 'stop' } as const;
function model(text = 'answer') {
	return new MockLanguageModelV3({
		doGenerate: async () => ({ content: [{ type: 'text', text }], finishReason, usage, warnings: [] }),
		doStream: async () => ({ stream: convertArrayToReadableStream([
			{ type: 'stream-start', warnings: [] }, { type: 'text-start', id: 'a' },
			{ type: 'text-delta', id: 'a', delta: text }, { type: 'text-end', id: 'a' },
			{ type: 'finish', finishReason, usage },
		]) }),
	});
}

describe('LLMAgent', () => {
	for (const streaming of [false, true]) {
		for (const entry of ['history', 'named prompt', 'positional prompt', 'native messages', 'native prompt'] as const) {
			it(`validates original conversation before preparation and hooks: ${entry}, streaming=${streaming}`, async () => {
				const provider = model();
				let parses = 0;
				let hooks = 0;
				const factory = streaming ? create.LLMAgent.asStream : create.LLMAgent;
				const agent = factory({ model: provider, prompt: 'Configured.',
					inputSchema: z.object({}).transform(value => { parses++; return value; }),
					prepareCall: request => { hooks++; return { ...request, messages: [{ role: 'user', content: 'Replacement.' }] }; },
				});
				const invoke = (messages: ModelMessage[]) => {
					switch (entry) {
						case 'history': return agent.run({ messageHistory: messages });
						case 'named prompt': return agent.run({ prompt: messages });
						case 'positional prompt': return agent(messages);
						case 'native messages': return streaming ? agent.stream({ messages }) : agent.generate({ messages });
						case 'native prompt': return streaming ? agent.stream({ prompt: messages }) : agent.generate({ prompt: messages });
					}
				};
				await assert.rejects(invoke([{ role: 'user', content: 42 }] as unknown as ModelMessage[]), ValidationError);
				assert.equal(parses, 0);
				assert.equal(hooks, 0);
				assert.equal(provider.doGenerateCalls.length + provider.doStreamCalls.length, 0);

				const original: ModelMessage = { role: 'user', content: 'Original.' };
				const result = await invoke([original]);
				const value = result.value;
				assert.equal(typeof value === 'string' ? value : await collectTextStream(value), 'answer');
				assert.equal((await result.messageHistory)[0], original);
				assert.equal(parses, 1);
				assert.equal(hooks, 1);
				const sent = (streaming ? provider.doStreamCalls : provider.doGenerateCalls)[0].prompt;
				assert.deepEqual(sent.map(message => message.content), [[{ type: 'text', text: 'Replacement.' }]]);
			});
		}
	}

	for (const method of ['generate', 'stream'] as const) {
		it(`rejects fixed settings on ${method} before preparation or dispatch`, async () => {
			const provider = model('{"answer":42}');
			let prepares = 0;
			const agent = create.LLMAgent({ model: provider,
				inputSchema: z.object({ count: z.preprocess(value => { prepares++; return value; }, z.number()) }),
				output: Output.object({ schema: z.object({ answer: z.number() }) }),
			});
			const fixed = { output: Output.text(), inputSchema: z.object({ count: z.string() }), toolContextSchema: z.object({}),
				promptType: 'function', filters: {}, renderOptions: {}, loader: [], id: 'other', streaming: true, asTool: true };
			for (const [key, value] of Object.entries(fixed)) {
				for (const supplied of [value, undefined]) {
					await assert.rejects((agent[method] as (args: unknown) => Promise<unknown>)({ prompt: 'Answer.', options: { count: 'invalid' }, [key]: supplied }),
						error => error instanceof ValidationError && error.message.includes(key));
				}
			}
			assert.equal(prepares, 0);
			assert.equal(provider.doGenerateCalls.length + provider.doStreamCalls.length, 0);
			const args = { prompt: 'Answer.', options: { count: 1 }, timeout: 10000 };
			const result = method === 'generate' ? await agent.generate(args) : await agent.stream(args);
			assert.deepEqual(await result.value, { answer: 42 });
			assert.equal(prepares, 1);
		});

		it(`reports invalid prepareCall returns clearly on ${method}`, async () => {
			const provider = model();
			for (const value of [undefined, null, false, 'request', []]) {
				const agent = create.LLMAgent({ model: provider, prepareCall: () => value } as never);
				await assert.rejects((agent[method] as (args: unknown) => Promise<unknown>)({ prompt: 'Answer.' }),
					error => error instanceof ValidationError && error.message === 'prepareCall must return a complete request object.');
			}
			assert.equal(provider.doGenerateCalls.length + provider.doStreamCalls.length, 0);
		});
	}

	for (const streaming of [false, true]) {
		it(`accepts an inline approval policy, streaming=${streaming}`, async () => {
			let calls = 0;
			const action = tool({ inputSchema: z.object({}), execute: () => { calls++; return 'ok'; } });
			const factory = streaming ? create.LLMAgent.asStream : create.LLMAgent;
			const agent = factory({ model: modelFor({}, 'action'), tools: { action }, toolApproval: { action: 'user-approval' } });
			const result = await agent('Use action.');
			assert.ok((await result.content).some(part => part.type === 'tool-approval-request' && !part.isAutomatic));
			assert.equal(calls, 0);
		});

		it(`clears selectors when removing a configured tool, streaming=${streaming}`, async () => {
			const provider = model();
			const action = tool({ inputSchema: z.object({}), execute: () => 'ok' });
			const factory = streaming ? create.LLMAgent.asStream : create.LLMAgent;
			const agent = factory({ model: provider, prompt: 'Answer.', tools: { action }, activeTools: ['action'],
				toolChoice: { type: 'tool', toolName: 'action' }, toolOrder: ['action'], timeout: { tools: { actionMs: 1000 } },
				experimental_toolCallers: { action: ['AI_SDK_DIRECT_TOOL_CALL'] } });
			const result = await agent.run({ tools: { action: null }, activeTools: [], toolChoice: 'none', toolOrder: [],
				timeout: { totalMs: 10000 }, experimental_toolCallers: {} });
			assert.equal(await result.text, 'answer');
			const request = (streaming ? provider.doStreamCalls : provider.doGenerateCalls)[0];
			assert.equal(request.tools?.length ?? 0, 0);
			assert.deepEqual(agent.config.activeTools, ['action']);
		});

		it(`keeps required tool context in a minimal hook return, streaming=${streaming}`, async () => {
			const contexts: string[] = [];
			const action = tool({ inputSchema: z.object({}), contextSchema: z.object({ tenant: z.string() }),
				execute: (_input, { context }) => { contexts.push(context.tenant); return 'ok'; } });
			const factory = streaming ? create.LLMAgent.asStream : create.LLMAgent;
			const agent = factory({ model: modelFor({}, 'action'), tools: { action }, toolsContext: { action: { tenant: 'a' } },
				prepareCall: request => ({ model: request.model, messages: request.messages, tools: { action }, toolsContext: request.toolsContext }) });
			const result = await agent('Use action.');
			await result.content;
			assert.deepEqual(contexts, ['a']);
		});
	}

	it('uses one parsed context for rendering and both hooks, while preserving the authored conversation', async () => {
		let parses = 0;
		const inputSchema = z.object({ count: z.string().transform(value => { parses++; return Number(value); }) });
		let rendered: unknown;
		let hookConfig: unknown;
		const agent = create.LLMAgent.withFunction({ model: model(), inputSchema, context: { count: '2', privateValue: 10 },
			prompt: context => { rendered = context; return `count ${context.count}`; },
			prepareCall(request, config, context) {
				hookConfig = config;
				assert.equal(context, rendered);
				assert.equal(context.count, 3);
				assert.deepEqual(config.context, { count: '3', privateValue: 10 });
				assert.deepEqual(request.messages, [{ role: 'user', content: 'count 3' }]);
				assert.equal('options' in request, false);
				return { ...request, messages: [{ role: 'user', content: 'rewritten' }] };
			},
			prepareStep(step, config, context) {
				assert.equal(step.stepNumber, 0);
				assert.equal(config, hookConfig);
				assert.equal(context, rendered);
				return {};
			},
		});
		const result = await agent({ count: '3' });
		assert.equal(parses, 1);
		assert.equal(result.value, 'answer');
		assert.deepEqual(result.messageHistory[0], { role: 'user', content: 'count 3' });
		assert.equal(agent.config.context.count, '2');
	});

	for (const streaming of [false, true]) it(`snapshots a hook-returned shared conversation at dispatch, streaming=${streaming}`, async () => {
		const backend = model();
		const shared: ModelMessage[] = [{ role: 'user', content: 'selected' }];
		const config = { model: backend, prepareCall: (request: { model: LanguageModel }) => ({ ...request, messages: shared }),
			onStart: () => { shared.push({ role: 'user', content: 'later' }); } };
		const result = streaming ? await create.LLMAgent.asStream(config)('authored') : await create.LLMAgent(config)('authored');
		await result.output;
		const request = streaming ? backend.doStreamCalls[0] : backend.doGenerateCalls[0];
		assert.deepEqual(request.prompt.map(message => message.content), [[{ type: 'text', text: 'selected' }]]);
		assert.equal(shared.length, 2);
		assert.deepEqual((await result.messageHistory)[0], { role: 'user', content: 'authored' });
	});

	it('exposes caller overrides of public defaults in both hook config views', async () => {
		const seen: string[] = [];
		const agent = create.LLMAgent({ model: model(), prompt: 'Answer.',
			inputSchema: z.object({ detail: z.enum(['brief', 'deep']), amount: z.string().transform(Number) }),
			context: { detail: 'brief' as const, amount: '1', db: { ready: true } },
			prepareCall(request, config, context) {
				assert.equal(config.context?.detail, 'deep');
				assert.equal(config.context.amount, '2');
				assert.equal(context.amount, 2);
				assert.equal(config.context.db.ready, true);
				seen.push('call');
				return request;
			},
			prepareStep(_step, config, context) {
				assert.equal(config.context?.detail, 'deep');
				assert.equal(config.context.amount, '2');
				assert.equal(context.amount, 2);
				seen.push('step');
			},
		});
		const context = { detail: 'deep' as const, amount: '2' };
		await agent(context);
		await agent.run({ context });
		await agent.generate({ prompt: 'Answer.', options: context });
		await (await agent.stream({ prompt: 'Answer.', options: context })).text;
		assert.deepEqual(seen, Array.from({ length: 4 }, () => ['call', 'step']).flat());
		assert.equal(agent.config.context.detail, 'brief');
		assert.equal(agent.config.context.amount, '1');
	});

	it('returns a complete editable request and protects output, observers, signal, approval and telemetry', async () => {
		const original = model('original');
		const selected = model('{"answer":42}');
		const seen: string[] = [];
		const agent = create.LLMAgent({ model: original, output: Output.object({ schema: z.object({ answer: z.number() }) }),
			timeout: 1000, temperature: 0.5, telemetry: { isEnabled: false }, toolApproval: () => 'approved' as const,
			experimental_toolApprovalSecret: 'secret', onEnd: () => { seen.push('config'); },
			prepareCall(request) {
				for (const key of ['output', 'abortSignal', 'telemetry', 'onEnd', 'toolApproval', 'experimental_toolApprovalSecret']) assert.equal(key in request, false);
				return { model: selected, messages: request.messages, timeout: 5000 };
			},
		});
		const result = await agent.run({ prompt: 'question', model: original, onEnd: () => { seen.push('call'); } });
		assert.deepEqual(result.value, { answer: 42 });
		assert.deepEqual(seen.sort(), ['call', 'config']);
		assert.equal(original.doGenerateCalls.length, 0);
		assert.equal(selected.doGenerateCalls[0].temperature, undefined);
		await agent.run({ prompt: 'question', prepareCall: request => ({ ...request, model: selected }) });
	});

	it('preserves streaming through configuration inheritance, with completed values for explicit Output', async () => {
		const stream = create.LLMAgent.asStream({ model: model(), prompt: 'question' });
		const inherited = create.LLMAgent({}, create.Config({}, stream));
		assert.equal(inherited.config.streaming, true);
		const pending = inherited();
		assert.ok(pending instanceof Promise);
		const result = await pending;
		assert.equal(await collectTextStream(result.value), 'answer');
		assert.equal(await collectTextStream(result.textStream), 'answer');
		const explicit = create.LLMAgent.asStream({ model: model(), output: Output.text() });
		const completed = await explicit('question');
		assert.ok(completed.value instanceof Promise);
		assert.equal(await completed.value, 'answer');
		assert.equal(await collectTextStream(completed.textStream), 'answer');
	});

	it('exposes native literal Agent methods and UI streams without running the renderer', async () => {
		let renders = 0;
		const agent = create.LLMAgent.withFunction({ model: model(), inputSchema: z.object({ name: z.string() }), context: { name: 'Ada' },
			prompt: context => { renders++; return context.name; }, prepareCall: (request, _config, context) => {
				assert.equal(context.name, 'Ada'); return request;
			}, tools: { lookup: tool({ inputSchema: z.object({ key: z.string() }), execute: ({ key }) => key }) },
		});
		const native: Agent<{ name?: string }, typeof agent.tools> = agent;
		assert.equal((await native.generate({ prompt: 'literal', options: {} })).text, 'answer');
		assert.equal(await (await agent.stream({ messages: [{ role: 'user', content: 'literal' }] })).text, 'answer');
		const stream = await createAgentUIStream({ agent, uiMessages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }] });
		for await (const _chunk of stream) { /* consume the native UI stream */ }
		const message: InferAgentUIMessage<typeof agent> = { id: '1', role: 'assistant', parts: [{ type: 'tool-lookup', toolCallId: '1', state: 'input-available', input: { key: 'a' } }] };
		assert.equal(message.parts[0].type, 'tool-lookup');
		assert.equal(renders, 0);
	});

	it('uses context-before-history, treats arrays as new literal prompts and preserves empty user turns', async () => {
		const history: ModelMessage[] = [{ role: 'assistant', content: 'earlier' }];
		const literal = create.LLMAgent({ model: model() });
		assert.deepEqual((await literal('', history)).messageHistory.slice(0, 2), [...history, { role: 'user', content: '' }]);
		assert.deepEqual((await literal(history, history)).messageHistory.slice(0, 2), [...history, ...history]);
		const rendered = create.LLMAgent.withTemplate({ model: model(), prompt: '{{ name }}' });
		assert.deepEqual((await rendered({ name: 'Ada' }, history)).messageHistory.slice(0, 2), [...history, { role: 'user', content: 'Ada' }]);
		const invalidCall = rendered as (...args: never[]) => Promise<unknown>;
		await assert.rejects(invalidCall(history as never, { name: 'Ada' } as never), ValidationError);
		await assert.rejects(literal.run({ messageHistory: 3 } as never), ValidationError);
	});

	it('keeps tool and Agent surfaces separate, and tools return completed output in either mode', async () => {
		for (const factory of [create.LLMAgent.asTool, create.LLMAgent.asStream.asTool]) {
			const component = factory({ model: model(), prompt: 'fixed', inputSchema: z.object({}) });
			for (const key of ['id', 'version', 'generate', 'stream']) assert.equal(key in component, false);
			assert.equal(await component.execute({}, { toolCallId: 'id', messages: [], context: undefined }), 'answer');
			assert.equal(component.type, 'function');
		}
	});

	it('checks cancellation after preparation without creating a new signal or timer', async () => {
		const controller = new AbortController();
		const reason = new Error('cancelled during preparation');
		const provider = model();
		const agent = create.LLMAgent({ model: provider, prepareCall(request) { controller.abort(reason); return request; } });
		await assert.rejects(agent.run({ prompt: 'question', abortSignal: controller.signal }), error => error === reason);
		assert.equal(provider.doGenerateCalls.length, 0);
	});

	for (const streaming of [false, true]) it(`binds the hook's final tool selection without changing preparer helpers, streaming=${streaming}`, async () => {
		const calls: number[] = [];
		const action = create.Function.asTool({ inputSchema: z.object({ amount: z.number() }),
			toolContextSchema: z.object({ amount: z.number() }), execute: ({ amount }) => { calls.push(amount); return amount; } });
		const config = { model: modelFor({}, 'action'), tools: { action }, toolsContext: { action: { amount: 1 } }, stopWhen: isStepCount(2),
			prompt: async (context: { action(): Promise<number> }) => { await context.action(); return 'question'; },
		};
		const factory = streaming ? create.LLMAgent.withFunction.asStream : create.LLMAgent.withFunction;
		const agent = factory({ ...config, prepareCall: async (request, _config, context) => {
			assert.equal(request.tools?.action, action);
			await context.action();
			return { ...request, toolsContext: { action: { amount: 2 } }, prepareStep: (step, _settings, prepared) => {
				assert.equal(prepared, context);
				assert.deepEqual(step.toolsContext, { action: { amount: 2 } });
				return {};
			} };
		} });
		const result = await agent();
		await result.text;
		assert.deepEqual(calls, [1, 1, 2]);
	});

	it('preserves explicitly bound descriptors and rejects changed context before dispatch', async () => {
		const action = create.Function.asTool({ inputSchema: z.object({ amount: z.number() }),
			toolContextSchema: z.object({ amount: z.number() }), execute: ({ amount }) => amount });
		const bound = action.bindToolContext({ amount: 2 });
		const provider = modelFor({}, 'action');
		const agent = create.LLMAgent({ model: provider, tools: { action: bound.tool }, toolsContext: { action: bound.context },
			prepareCall: request => ({ ...request, toolsContext: { action: { amount: 3 } } }),
		});
		await assert.rejects(agent('question'), /must match its binding/);
		assert.equal(provider.doGenerateCalls.length, 0);
		assert.equal(agent.tools.action, bound.tool);
	});

	it('rejects retired configuration, creation signals and incomplete tools', () => {
		for (const setting of ['messages', 'options', 'callOptionsSchema', 'system', 'schema', 'abortSignal']) {
			assert.throws(() => create.LLMAgent({ model: model(), [setting]: undefined } as never), ConfigError);
		}
		assert.throws(() => create.LLMAgent.asTool({ model: model(), inputSchema: z.object({}) } as never), ConfigError);
	});
	for (const streaming of [false, true]) {
		it(`keeps approval policy and signing through minimal hook replacement, streaming=${streaming}`, async () => {
			let effects = 0;
			const action = tool({ inputSchema: z.object({ amount: z.number() }), needsApproval: true, execute: () => ++effects });
			const factory = streaming ? create.LLMAgent.asStream : create.LLMAgent;
			const approved = factory({ model: modelFor({ amount: 1 }, 'action'), tools: { action },
				experimental_toolApprovalSecret: 'test-key',
				prepareCall: request => ({ model: request.model, messages: request.messages, tools: request.tools }),
			});
			const first = await approved('question');
			const history = await first.messageHistory;
			const approval = history.flatMap(message => Array.isArray(message.content)
				? message.content.filter(part => part.type === 'tool-approval-request') : [])[0];
			assert.ok(approval?.signature);
			assert.equal(effects, 0);
			const messages: ModelMessage[] = [...history, { role: 'tool', content: [
				{ type: 'tool-approval-response', approvalId: approval.approvalId, approved: true },
			] }];
			const resumed = factory({ model: modelFor(undefined), tools: { action }, experimental_toolApprovalSecret: 'test-key',
				prepareCall: request => ({ model: request.model, messages: request.messages, tools: request.tools }),
				onError: () => { /* Inspect the native stream error below. */ },
			});
			const tampered = structuredClone(messages);
			for (const message of tampered) if (Array.isArray(message.content)) {
				for (const part of message.content) if (part.type === 'tool-call') part.input = { amount: 9000 };
			}
			if (streaming) {
				const logged: unknown[] = [];
				const originalError = console.error;
				console.error = error => { logged.push(error); };
				try {
					const result = await resumed.stream({ messages: tampered });
					const failures: unknown[] = [];
					for await (const part of result.fullStream) if (part.type === 'error') failures.push(part.error);
					assert.ok(failures.some(error => InvalidToolApprovalSignatureError.isInstance(error)));
					assert.ok(logged.some(error => InvalidToolApprovalSignatureError.isInstance(error)));
				} finally { console.error = originalError; }
			} else await assert.rejects(resumed.generate({ messages: tampered }), error => InvalidToolApprovalSignatureError.isInstance(error));
			assert.equal(effects, 0);
			await (await resumed(messages)).steps;
			assert.equal(effects, 1, 'Matching signed history still executes.');
			const denied = factory({ model: modelFor({ amount: 1 }, 'action'), tools: { action }, toolApproval: { action: 'denied' as const }, stopWhen: isStepCount(2),
				prepareCall: request => ({ model: request.model, messages: request.messages, tools: request.tools, stopWhen: request.stopWhen }),
			});
			await (await denied('question')).steps;
			assert.equal(effects, 1, 'A minimal hook return cannot remove the denial policy.');
		});

		it(`keeps telemetry opt-outs and recording policy through hook replacement, streaming=${streaming}`, async () => {
			const original: unknown = Reflect.get(globalThis, 'AI_SDK_TELEMETRY_INTEGRATIONS');
			const globalEvents: unknown[] = [];
			const localEvents: { recordInputs?: boolean | undefined; recordOutputs?: boolean | undefined; functionId?: string | undefined }[] = [];
			Reflect.set(globalThis, 'AI_SDK_TELEMETRY_INTEGRATIONS', []);
			registerTelemetry({ onStart: event => { globalEvents.push(event); } });
			try {
				const factory = streaming ? create.LLMAgent.asStream : create.LLMAgent;
				const disabled = factory({ model: model(), telemetry: { isEnabled: false },
					prepareCall: request => ({ model: request.model, messages: request.messages }),
				});
				await (await disabled('private')).text;
				assert.equal(globalEvents.length, 0);
				const selected = factory({ model: model(), telemetry: { functionId: 'local', recordInputs: false, recordOutputs: false,
					integrations: { onStart: event => { localEvents.push(event); } } },
				prepareCall: request => ({ model: request.model, messages: request.messages }),
				});
				await (await selected('private')).text;
				assert.equal(globalEvents.length, 0);
				assert.equal(localEvents.length, 1);
				assert.equal(localEvents[0].functionId, 'local');
				assert.equal(localEvents[0].recordInputs, false);
				assert.equal(localEvents[0].recordOutputs, false);
			} finally {
				if (original === undefined) Reflect.deleteProperty(globalThis, 'AI_SDK_TELEMETRY_INTEGRATIONS');
				else Reflect.set(globalThis, 'AI_SDK_TELEMETRY_INTEGRATIONS', original);
			}
		});
	}

});
