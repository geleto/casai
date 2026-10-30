import assert from 'node:assert/strict';
import { z } from 'zod/v4';
import { asSchema, validateTypes } from '@ai-sdk/provider-utils';
import { ToolLoopAgent, tool, isStepCount } from 'ai';
import type { ModelMessage } from 'ai';
import { create, ValidationError } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';

function approvedMessages(messages: ModelMessage[]): ModelMessage[] {
	const request = messages.flatMap(message => message.role === 'assistant' && Array.isArray(message.content)
		? message.content.filter(part => part.type === 'tool-approval-request') : [])[0];
	assert.ok(request);
	return [{ role: 'user', content: 'run' }, ...messages,
		{ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: request.approvalId, approved: true }] }];
}

async function collect<T>(source: AsyncIterable<T>) {
	const values: T[] = [];
	for await (const value of source) values.push(value);
	return values;
}

describe('Production security lifecycle and native boundaries', () => {
	for (const mode of ['generate', 'stream'] as const) {
		it(`guards actual bare private context at the final ${mode} boundary`, async () => {
			// No configured or discoverable declaration reserves userId before the
			// SDK validates arguments. Actual native context must still protect it.
			for (const opaqueContext of [false, true]) {
				let entered = 0;
				const operation = create.Function.asTool({ inputSchema: z.object({ query: z.string(), extra: z.string().optional(), alias: z.string().nullable().optional() })
					.transform(({ alias, ...input }) => alias === undefined ? input : { ...input, userId: alias }),
				...(opaqueContext ? { toolContextSchema: z.unknown().transform(value => ({ userId: (value as { identity: string }).identity })) } : {}),
				execute: input => { entered++; return { trusted: 'userId' in input && input.userId === 'member', extra: input.extra }; } });
				const incoming = opaqueContext ? { identity: 'member' } : { userId: 'member' };
				for (const key of ['userId', 'alias']) for (const attack of ['admin', null]) {
					const model = modelFor({ query: 'ok', [key]: attack });
					const agent = new ToolLoopAgent({ model, tools: { probe: operation },
						// Native settings erase raw context types; runtime-boundary probe only.
						toolsContext: { probe: incoming } as never, stopWhen: isStepCount(2) });
					const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
					const steps = await result.steps;
					assert.equal(entered, 0);
					assert.ok(steps[0].content.some(part => part.type === 'tool-error'));
					assert.equal(steps[0].toolResults.length, 0);
				}
				const agent = new ToolLoopAgent({ model: modelFor({ query: 'ok', extra: 'allowed' }), tools: { probe: operation },
					toolsContext: { probe: incoming } as never, stopWhen: isStepCount(2) });
				const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
				assert.deepEqual((await result.steps)[0].toolResults[0].output, { trusted: true, extra: 'allowed' });
				assert.equal(entered, 1);
			}
		});

		it(`keeps private values out of ${mode} transport after nested input and output validation failures`, async () => {
			const sentinel = 'PRIVATE_NESTED_VALIDATION_SENTINEL';
			for (const boundary of ['input', 'output'] as const) {
				let entered = 0;
				const inputFailure = tool({ inputSchema: z.strictObject({ account: z.string(), enabled: z.literal(true) }),
					execute: () => ++entered });
				const outputFailure = create.Function.asTool({ inputSchema: z.object({}), context: { account: sentinel },
					schema: z.strictObject({ public: z.string() }),
					execute: input => { entered++; return { public: 'ok', account: input.account }; } });
				const middle = boundary === 'input'
					? create.Function.asTool({ inputSchema: z.object({}), context: { account: sentinel }, tools: { inner: inputFailure },
						execute: input => input.inner({ account: input.account, enabled: false } as never) })
					: create.Function.asTool({ inputSchema: z.object({}), tools: { inner: outputFailure }, execute: input => input.inner({}) });
				const outer = create.Function.asTool({ inputSchema: z.object({}), tools: { middle }, execute: input => input.middle() });
				const model = modelFor({});
				const agent = new ToolLoopAgent({ model, tools: { probe: outer }, stopWhen: isStepCount(2) });
				const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
				const ui = 'toUIMessageStream' in result ? collect(result.toUIMessageStream({
					onError: error => error instanceof Error ? error.message : String(error),
				})) : Promise.resolve([]);
				const steps = await result.steps;
				const failure = steps[0].content.find(part => part.type === 'tool-error');
				assert.ok(failure?.type === 'tool-error' && failure.error instanceof ValidationError);
				assert.ok(!failure.error.message.includes(sentinel));
				assert.ok(failure.error.cause?.message.includes(sentinel), 'Exercise an actual private value in native diagnostics.');
				assert.equal(entered, boundary === 'input' ? 0 : 1);
				const requests = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
				assert.equal(requests.length, 2, 'A next request must exist to test disclosure.');
				assert.ok(!JSON.stringify(requests).includes(sentinel));
				assert.ok(!JSON.stringify((await result.response).messages).includes(sentinel));
				const chunks = await ui;
				if (mode === 'stream') assert.ok(chunks.some(chunk => chunk.type === 'tool-output-error'));
				assert.ok(!JSON.stringify(chunks).includes(sentinel));
			}
		});

		it(`keeps failed binding context private during ${mode} approval continuation`, async () => {
			const sentinel = 'PRIVATE_BINDING_ERROR_SENTINEL'; let entered = 0, repairs = 0;
			const operation = create.Function.asTool({ inputSchema: z.object({}), context: { apiKey: sentinel, account: 'configured' },
				toolContextSchema: z.object({ apiKey: z.string(), account: z.string().min(1) }), execute: () => ++entered });
			const initial = operation.bindToolContext({ apiKey: sentinel, account: 'valid' });
			const pendingAgent = new ToolLoopAgent({ model: modelFor({}), tools: { probe: { ...initial.tool, needsApproval: true } },
				toolsContext: { probe: initial.context }, stopWhen: isStepCount(2) });
			const pending = mode === 'generate' ? await pendingAgent.generate({ prompt: 'run' }) : await pendingAgent.stream({ prompt: 'run' });
			const messages = approvedMessages((await pending.response).messages);
			assert.equal(entered, 0);
			const fresh = operation.bindToolContext({ apiKey: sentinel, account: '' });
			const model = modelFor({});
			const resumed = new ToolLoopAgent({ model, tools: { probe: { ...fresh.tool, needsApproval: true } }, toolsContext: { probe: fresh.context },
				stopWhen: isStepCount(2), experimental_repairToolCall: async () => { repairs++; return null; } });
			const safeContextError = (error: unknown) => error instanceof ValidationError
				&& error.message.toLowerCase().includes('tool context') && !error.message.includes(sentinel) && !!error.cause?.message.includes(sentinel);
			if (mode === 'generate') {
				await assert.rejects(resumed.generate({ messages }), safeContextError);
			} else {
				// ToolLoopAgent has no public onError option. Record its native default
				// diagnostics without letting private fixture values reach test stderr.
				const logged: unknown[] = [];
				const originalError = console.error;
				console.error = (error: unknown) => { logged.push(error); };
				try {
					const result = await resumed.stream({ messages });
					const completions = Promise.allSettled([result.response, result.steps]);
					const [parts, ui] = await Promise.all([collect(result.fullStream), collect(result.toUIMessageStream({
						onError: error => error instanceof Error ? error.message : String(error),
					}))]);
					const toolErrors = parts.filter(part => part.type === 'tool-error');
					assert.equal(toolErrors.length, 1);
					for (const part of toolErrors) {
						assert.equal(typeof part.error, 'string', 'Native continuation emits tool-error text directly.');
						const text = String(part.error);
						assert.ok(!text.includes(sentinel), 'Private binding context leaked into a tool-error message.');
						assert.match(text, /Tool context validation failed/);
					}
					assert.ok(ui.some(part => part.type === 'tool-output-error'), 'Exercise UI tool error publication.');
					assert.ok(ui.some(part => part.type === 'error'), 'Exercise UI stream error publication.');
					assert.ok(!JSON.stringify(ui).includes(sentinel), 'Private binding context leaked into UI chunks.');
					assert.ok(parts.some(part => part.type === 'error' && safeContextError(part.error)));
					for (const completion of await completions) assert.equal(completion.status, 'rejected');
					assert.equal(logged.length, 1);
					assert.ok(safeContextError(logged[0]), 'Native default logging retains the private diagnostic cause.');
					const handled: unknown[] = [];
					const streamer = create.LLMAgent.asStream({ model, prompt: messages, tools: { probe: fresh.tool }, toolsContext: { probe: fresh.context },
						onError: ({ error }) => { handled.push(error); } });
					const explicit = (await streamer());
					await assert.rejects(async () => explicit.output);
					assert.equal(handled.length, 1);
					assert.ok(safeContextError(handled[0]));
					assert.equal(logged.length, 1, 'The explicit handler replaces native default logging.');
				} finally {
					console.error = originalError;
				}
			}
			assert.equal(model.doGenerateCalls.length + model.doStreamCalls.length, 0);
			assert.equal(entered, 0); assert.equal(repairs, 0, 'Native SDK does not repair approved input.');
			// A fresh valid binding can execute the same approval without changing public input.
			const valid = operation.bindToolContext({ apiKey: sentinel, account: 'valid' });
			const neighbor = new ToolLoopAgent({ model: modelFor({}), tools: { probe: { ...valid.tool, needsApproval: true } },
				toolsContext: { probe: valid.context }, stopWhen: isStepCount(1) });
			const completed = mode === 'generate' ? await neighbor.generate({ messages }) : await neighbor.stream({ messages });
			await completed.response;
			assert.equal(entered, 1);
		});
		it(`keeps failed private native tool context out of the next ${mode} request`, async () => {
			const sentinel = 'PRIVATE_CONTEXT_ERROR_SENTINEL'; let entered = 0;
			const inner = tool({ inputSchema: z.object({}), contextSchema: z.object({ apiKey: z.string(), account: z.string().min(1) }), execute: () => ++entered });
			const outer = create.Function.asTool({ inputSchema: z.object({}), tools: { inner }, toolsContext: { inner: { apiKey: sentinel, account: '' } }, execute: input => input.inner({}) });
			const model = modelFor({});
			const agent = new ToolLoopAgent({ model, tools: { probe: outer }, stopWhen: isStepCount(2) });
			const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
			const steps = await result.steps;
			const failure = steps[0].content.find(part => part.type === 'tool-error');
			const calls = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
			assert.equal(calls.length, 2); assert.equal(entered, 0);
			assert.ok(!JSON.stringify(calls[1].prompt).includes(sentinel), 'Private context leaked into the next model request.');
			assert.ok(failure?.type === 'tool-error' && failure.error instanceof ValidationError);
			assert.ok(!failure.error.message.includes(sentinel));
			assert.ok(failure.error.cause?.message.includes(sentinel), 'Trusted diagnostics retain the native validation cause.');
			assert.ok(!JSON.stringify(steps.flatMap(step => step.response.messages)).includes(sentinel));
		});
		it(`rejects private model input before native ${mode} hooks and approval`, async () => {
			let entered = 0, hooks = 0, approvals = 0;
			const operation = create.Function.asTool({ inputSchema: z.object({ query: z.string() }), context: { userId: 'member' }, execute: () => entered++ });
			const descriptor = { inputSchema: operation.inputSchema, execute: operation.execute, onInputAvailable: () => { hooks++; }, needsApproval: () => { approvals++; return true; } };
			const agent = new ToolLoopAgent({ model: modelFor({ query: 'ok', userId: 'admin' }), tools: { probe: descriptor }, stopWhen: isStepCount(2) });
			const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
			const steps = await result.steps;
			assert.equal(entered, 0); assert.equal(hooks, 0); assert.equal(approvals, 0);
			assert.ok(steps[0].content.some(part => part.type === 'tool-error'));
		});
		it(`protects ordinary no-schema children forwarded model data in native ${mode}`, async () => {
			let entered = 0;
			const child = create.Function({ context: { userId: 'member' }, execute: (input: { query: string; userId: string }) => { entered++; return input.userId; } });
			const outer = create.Function.asTool({ inputSchema: z.object({ payload: z.object({ query: z.string(), userId: z.string().optional() }) }), execute: ({ payload }) => child(payload as { query: string }) });
			const agent = new ToolLoopAgent({ model: modelFor({ payload: { query: 'ok', userId: 'admin' } }), tools: { probe: outer }, stopWhen: isStepCount(2) });
			const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
			const steps = await result.steps;
			assert.equal(entered, 0); assert.equal(steps[0].toolResults.length, 0);
			assert.ok(steps[0].content.some(part => part.type === 'tool-error'));
			const validAgent = new ToolLoopAgent({ model: modelFor({ payload: { query: 'ok' } }), tools: { probe: outer }, stopWhen: isStepCount(2) });
			const valid = mode === 'generate' ? await validAgent.generate({ prompt: 'run' }) : await validAgent.stream({ prompt: 'run' });
			assert.equal((await valid.steps)[0].toolResults[0].output, 'member');
			assert.equal(entered, 1);
		});
		it(`uses the same composed descriptor in native ${mode}, with isolated bindings and private history`, async () => {
			const sentinel = 'PRIVATE_HISTORY_SENTINEL'; let entered = 0;
			const operation = create.Function.asTool({ inputSchema: z.object({ factor: z.number() }), context: { factor: 3, db: sentinel }, toolContextSchema: z.object({ factor: z.number() }), execute: input => { entered++; return input.factor; } });
			const outputs = await Promise.all([5, 7].map(async factor => {
				const binding = operation.bindToolContext({ factor }); const model = modelFor({});
				const agent = new ToolLoopAgent({ model, tools: { probe: binding.tool }, toolsContext: { probe: binding.context }, stopWhen: isStepCount(2) });
				const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
				const steps = await result.steps;
				assert.deepEqual(steps[0].toolCalls[0].input, { factor });
				assert.ok(!JSON.stringify(steps.flatMap(step => step.response.messages)).includes(sentinel));
				assert.ok(!JSON.stringify(mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls).includes(sentinel));
				return steps[0].toolResults[0].output;
			}));
			assert.deepEqual(outputs, [5, 7]); assert.equal(entered, 2); assert.equal(operation.config.context.factor, 3);
		});
		it(`guards native ${mode} refinement after initial parsing`, async () => {
			let entered = 0;
			const operation = create.Function.asTool({ inputSchema: z.object({ query: z.string() }), context: { userId: 'member' }, execute: () => entered++ });
			const agent = new ToolLoopAgent({ model: modelFor({ query: 'ok' }), tools: { probe: operation }, stopWhen: isStepCount(2), experimental_refineToolInput: { probe: input => ({ ...input, userId: 'admin' }) } });
			const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
			const steps = await result.steps;
			assert.equal(entered, 0); assert.equal(steps[0].toolResults.length, 0);
			assert.ok(steps[0].content.some(part => part.type === 'tool-error'));
		});
	}

	it('characterizes why native-owned context failure differs from validation thrown inside a tool', async () => {
		const sentinel = 'NATIVE_CONTEXT_ERROR_SENTINEL';
		const schema = z.object({ apiKey: z.string(), account: z.string().min(1) });
		const context = { apiKey: sentinel, account: '' };
		const nativeModel = modelFor({});
		const native = tool({ inputSchema: z.object({}), contextSchema: schema, execute: (): number => assert.fail('invalid context entered body') });
		await assert.rejects(new ToolLoopAgent({ model: nativeModel, tools: { probe: native }, toolsContext: { probe: context }, stopWhen: isStepCount(2) }).generate({ prompt: 'run' }), error => error instanceof Error && error.name === 'AI_TypeValidationError');
		assert.equal(nativeModel.doGenerateCalls.length, 1);
		// Counterexample: the old injected runner threw this validation error inside
		// an outer executor, where the SDK converts its message into public tool output.
		const unwrapped = tool({ inputSchema: z.object({}), execute: () => validateTypes({ schema, value: context }) });
		const nestedModel = modelFor({});
		await new ToolLoopAgent({ model: nestedModel, tools: { probe: unwrapped }, stopWhen: isStepCount(2) }).generate({ prompt: 'run' });
		assert.equal(nestedModel.doGenerateCalls.length, 2);
		assert.ok(JSON.stringify(nestedModel.doGenerateCalls[1].prompt).includes(sentinel));
	});

	it('allows private-only bare context without parsing absent context during metadata setup', async () => {
		let parsed = 0;
		const operation = create.Function.asTool({ inputSchema: z.object({ query: z.string() }), context: { userId: 'configured' }, toolContextSchema: z.object({ userId: z.string() }).transform(input => { parsed++; return input; }), execute: input => input.userId });
		await asSchema(operation.inputSchema).jsonSchema; assert.equal(parsed, 0);
		const agent = new ToolLoopAgent({ model: modelFor({ query: 'ok' }), tools: { probe: operation }, toolsContext: { probe: { userId: 'trusted' } }, stopWhen: isStepCount(2) });
		assert.equal((await agent.generate({ prompt: 'run' })).steps[0].toolResults[0].output, 'trusted'); assert.ok(parsed > 0);
		const publicContext = create.Function.asTool({ inputSchema: z.object({ factor: z.number() }), context: { factor: 3 }, execute: input => input.factor });
		const input = await validateTypes({ schema: publicContext.inputSchema, value: {} });
		await assert.rejects(Promise.resolve(publicContext.execute(input, { toolCallId: 'direct', messages: [], context: { factor: 5 } as never })), /bindToolContext/);
	});
});
