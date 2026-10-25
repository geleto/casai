import assert from 'node:assert/strict';
import { ToolLoopAgent, isStepCount, tool, createAgentUIStream, validateUIMessages } from 'ai';
import type { ModelMessage, Tool, UIMessage } from 'ai';
import { z } from 'zod/v4';
import { create } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';

// Characterize the installed SDK, including limitations. These are not promises
// that Casai supplies a separate authorization or approval engine.
describe('Phase 2 native security control boundaries', () => {
	for (const mode of ['generate', 'stream'] as const) for (const casai of [false, true]) {
		const label = `${mode}/${casai ? 'casai' : 'native'}`;
		function operation(execute: () => number) {
			const definition = { inputSchema: z.object({}), execute };
			const composed = create.Function.asTool(definition);
			return casai ? { inputSchema: composed.inputSchema, execute: composed.execute } : tool(definition);
		}

		it(`distinguishes model selection from execution authorization: ${label}`, async () => {
			for (const policy of ['active-none', 'choice-none', 'callers-none', 'denied', 'allowed'] as const) {
				let effects = 0;
				const model = modelFor({});
				const agent = new ToolLoopAgent({
					model, tools: { probe: operation(() => ++effects) }, stopWhen: isStepCount(2),
					...(policy === 'active-none' ? { activeTools: [] } : {}),
					...(policy === 'choice-none' ? { toolChoice: 'none' as const } : {}),
					...(policy === 'callers-none' ? { experimental_toolCallers: { probe: [] } } : {}),
					...(policy === 'denied' ? { toolApproval: { probe: 'denied' as const } } : {}),
				});
				const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
				await result.steps;
				const calls = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
				assert.equal(calls.length, 2, `${label}/${policy}: continuation was not exercised`);
				const advertised = calls[0].tools?.some(entry => entry.name === 'probe') ?? false;
				assert.equal(advertised, !['active-none', 'callers-none'].includes(policy));
				if (policy === 'choice-none') assert.deepEqual(calls[0].toolChoice, { type: 'none' });
				// Both native modes parse fresh calls against the model-facing
				// subset. Continuation below uses a different registry boundary.
				const expected = policy === 'active-none' || policy === 'denied'
					|| policy === 'callers-none' ? 0 : 1;
				assert.equal(effects, expected, `${label}/${policy}`);
			}
		});

		it(`checks approval continuation separately from fresh selection: ${label}`, async () => {
			let effects = 0;
			const descriptor = { ...operation(() => ++effects), needsApproval: true };
			const signing = { experimental_toolApprovalSecret: 'phase2-native-controls-test-key' };
			const initial = new ToolLoopAgent({ ...signing, model: modelFor({}), tools: { probe: descriptor }, stopWhen: isStepCount(2) });
			const first = mode === 'generate' ? await initial.generate({ prompt: 'run' }) : await initial.stream({ prompt: 'run' });
			const history = (await first.steps).flatMap(step => step.response.messages);
			const request = history.flatMap(message => message.role === 'assistant' && Array.isArray(message.content)
				? message.content.filter(part => part.type === 'tool-approval-request') : [])[0];
			assert.ok(request?.signature);
			assert.equal(effects, 0);
			const messages: ModelMessage[] = [{ role: 'user', content: 'run' }, ...history,
				{ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: request.approvalId, approved: true }] }];
			for (const policy of ['active-none', 'choice-none', 'callers-none', 'denied', 'removed'] as const) {
				effects = 0;
				const tools: Record<string, Tool> = policy === 'removed' ? {} : { probe: descriptor };
				const resumed = new ToolLoopAgent({
					...signing, model: modelFor(undefined), tools, stopWhen: isStepCount(2),
					...(policy === 'active-none' ? { activeTools: [] } : {}),
					...(policy === 'choice-none' ? { toolChoice: 'none' as const } : {}),
					...(policy === 'callers-none' ? { experimental_toolCallers: { probe: [] } } : {}),
					...(policy === 'denied' ? { toolApproval: { probe: 'denied' as const } } : {}),
				});
				const result = mode === 'generate' ? await resumed.generate({ messages }) : await resumed.stream({ messages });
				await result.steps;
				assert.equal(effects, policy === 'denied' || policy === 'removed' ? 0 : 1, `${label}/${policy}`);
			}
		});

		it(`does not mistake a signed approval for private tenant binding: ${label}`, async () => {
			const seen: string[] = [];
			const inputSchema = z.object({});
			const contextSchema = z.object({ tenant: z.string() });
			const composed = create.Function.asTool({ inputSchema, context: { tenant: 'configured' }, toolContextSchema: contextSchema,
				execute: input => { seen.push(input.tenant); return 'done'; } });
			const exposedContextSchema = composed.contextSchema;
			assert.ok(exposedContextSchema);
			assert.equal(exposedContextSchema, contextSchema);
			const descriptor = casai
				? { inputSchema: composed.inputSchema, contextSchema: exposedContextSchema, execute: composed.execute, needsApproval: true }
				: tool({ inputSchema, contextSchema, needsApproval: true,
					execute: (_input, options) => { seen.push(options.context.tenant); return 'done'; } });
			const signing = { experimental_toolApprovalSecret: 'shared-application-approval-key' };
			const initial = new ToolLoopAgent({ ...signing, model: modelFor({}), tools: { probe: descriptor },
				toolsContext: { probe: { tenant: 'tenant-A' } }, stopWhen: isStepCount(2) });
			const first = mode === 'generate' ? await initial.generate({ prompt: 'run' }) : await initial.stream({ prompt: 'run' });
			const history = (await first.steps).flatMap(step => step.response.messages);
			const request = history.flatMap(message => message.role === 'assistant' && Array.isArray(message.content)
				? message.content.filter(part => part.type === 'tool-approval-request') : [])[0];
			assert.ok(request?.signature);
			assert.deepEqual(seen, []);
			const messages: ModelMessage[] = [{ role: 'user', content: 'run' }, ...history,
				{ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: request.approvalId, approved: true }] }];
			// Two separate invocations, each with fixed private context. The SDK
			// signature covers public operation fields, not the tenant/session.
			const resumed = new ToolLoopAgent({ ...signing, model: modelFor(undefined), tools: { probe: descriptor },
				toolsContext: { probe: { tenant: 'tenant-B' } }, stopWhen: isStepCount(2) });
			const result = mode === 'generate' ? await resumed.generate({ messages }) : await resumed.stream({ messages });
			await result.steps;
			assert.deepEqual(seen, ['tenant-B']);
		});
	}

	for (const mode of ['generate', 'stream'] as const) {
		it(`does not imply transitive approval for trusted coded forwarding: ${mode}`, async () => {
			for (const casai of [false, true]) for (const direct of [false, true]) {
				let effects = 0;
				const child = tool({ inputSchema: z.object({}), needsApproval: true, execute: () => ++effects });
				assert.ok(child.execute);
				const executeChild = child.execute;
				const nativeOwner = tool({ inputSchema: z.object({}),
					execute: (input, options) => executeChild(input, options) });
				const composedOwner = create.Function.asTool({ inputSchema: z.object({}), tools: { child },
					execute: input => input.child({}) });
				const owner = casai ? composedOwner : nativeOwner;
				const agent = new ToolLoopAgent({ model: modelFor({}), tools: { probe: direct ? child : owner }, stopWhen: isStepCount(2) });
				const result = mode === 'generate' ? await agent.generate({ prompt: 'run' }) : await agent.stream({ prompt: 'run' });
				const steps = await result.steps;
				assert.equal(effects, direct ? 0 : 1);
				assert.equal(steps.some(step => step.content.some(part => part.type === 'tool-approval-request')), direct);
			}
		});
	}
	it('reproduces the pre-prepareCall UI approval constraint with native SDK defaults alone', async () => {
		const exposed = tool({ inputSchema: z.object({ factor: z.number().default(3) }), execute: input => input });
		const selected = tool({ inputSchema: z.object({ factor: z.number().default(5) }), execute: input => input });
		const uiMessages: UIMessage[] = [{ id: 'native-approval', role: 'assistant', parts: [{
			type: 'tool-probe', toolCallId: 'call-1', state: 'approval-responded', input: { factor: 5 },
			approval: { id: 'approval-1', approved: true, inputSchemaInput: {} },
		}] }];
		let preparations = 0;
		const agent = new ToolLoopAgent({
			model: modelFor(undefined), tools: { probe: exposed },
			prepareCall: settings => { preparations++; return { ...settings, tools: { probe: selected } }; },
		});
		await assert.rejects(createAgentUIStream({ agent, uiMessages }), /reconstructed from inputSchemaInput/);
		assert.equal(preparations, 0);
	});

	it('validates UI approval history against agent.tools before prepareCall can select a binding', async () => {
		let executions = 0;
		const definition = {
			inputSchema: z.object({ factor: z.number() }), context: { factor: 3 },
			toolContextSchema: z.object({ factor: z.number() }),
			execute: ({ factor }: { factor: number }) => { executions++; return { factor }; },
		};
		const component = create.Function.asTool(definition);
		const exposed = component.bindToolContext({ factor: 3 });
		const selected = component.bindToolContext({ factor: 5 });
		const uiMessages: UIMessage[] = [{ id: 'approval-message', role: 'assistant', parts: [{
			type: 'tool-probe', toolCallId: 'call-1', state: 'approval-responded',
			input: { factor: 5 }, approval: { id: 'approval-1', approved: true, inputSchemaInput: {} },
		}] }];
		let preparations = 0;
		const model = modelFor(undefined);
		const agent = new ToolLoopAgent({
			model, tools: { probe: exposed.tool }, toolsContext: { probe: exposed.context },
			prepareCall: settings => {
				preparations++;
				return { ...settings, tools: { probe: selected.tool }, toolsContext: { probe: selected.context } };
			},
		});
		await assert.rejects(createAgentUIStream({ agent, uiMessages }), /reconstructed from inputSchemaInput/);
		assert.equal(preparations, 0);
		assert.equal(model.doStreamCalls.length, 0);
		assert.equal(executions, 0);
		// A request-specific immutable Agent exposing the matching binding can resume.
		const matching = new ToolLoopAgent({ model: modelFor(undefined), tools: { probe: selected.tool }, toolsContext: { probe: selected.context } });
		const stream = await createAgentUIStream({ agent: matching, uiMessages });
		const chunks = [];
		for await (const chunk of stream) chunks.push(chunk);
		const output = chunks.find(chunk => chunk.type === 'tool-output-available');
		assert.ok(output);
		assert.deepEqual(output.output, { factor: 5 });
		assert.equal(executions, 1);
	});

	it('characterizes native transformed UI-history failure without a Casai wrapper', async () => {
		const descriptor = { inputSchema: z.object({ factor: z.string().transform(Number) }), execute: (input: { factor: number }) => input };
		const valid = await validateUIMessages({
			tools: { probe: descriptor },
			messages: [{ id: 'assistant-1', role: 'assistant', parts: [{
				type: 'tool-probe', toolCallId: 'call-1', state: 'output-available', input: { factor: '3' }, output: { factor: 3 },
			}] }],
		});
		assert.equal(valid.length, 1);
		await assert.rejects(validateUIMessages({
			tools: { probe: descriptor },
			messages: [{ id: 'assistant-1', role: 'assistant', parts: [{
				type: 'tool-probe', toolCallId: 'call-1', state: 'output-available', input: { factor: 3 }, output: { factor: 3 },
			}] }],
		}));
	});

});
