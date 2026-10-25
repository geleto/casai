import assert from 'node:assert/strict';
import { generateText, streamText, asSchema, isStepCount } from 'ai';
import type { ModelMessage } from 'ai';
import { create, z, streamSchema, textStreamSchema } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';

function approve(messages: ModelMessage[]): ModelMessage[] {
	const request = messages.flatMap(message => message.role === 'assistant' && Array.isArray(message.content)
		? message.content.filter(part => part.type === 'tool-approval-request') : [])[0];
	assert.ok(request);
	return [{ role: 'user', content: 'go' }, ...messages,
		{ role: 'tool', content: [{ type: 'tool-approval-response', approvalId: request.approvalId, approved: true }] }];
}

describe('Production SDK tool lifecycle', () => {
	for (const mode of ['generate', 'stream'] as const) {
		it(mode + ': preserves public argument validation details without exposing private preparation errors', async () => {
			const secret = 'PRIVATE_VALIDATION_SENTINEL';
			for (const context of [{}, { db: secret }, { label: 'configured', db: secret }]) {
				const component = create.Function.asTool({ inputSchema: z.object({ count: z.number(), label: z.string() }), context, execute: () => 'unused' });
				const model = modelFor({ count: 'three', label: 'given' });
				const settings = { model, tools: { probe: component }, prompt: 'go', stopWhen: isStepCount(2) };
				const result = mode === 'generate' ? await generateText(settings) : streamText(settings);
				await result.steps;
				const calls = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
				assert.equal(calls.length, 2);
				const transport = JSON.stringify(calls[1].prompt);
				assert.match(transport, /invalid_type/);
				assert.match(transport, /count/);
				assert.match(transport, /number/);
				assert(!transport.includes(secret));
				await assert.rejects(component({ count: 'three', label: 'given' } as never), error =>
					error instanceof Error && error.message === 'Application input validation failed.' && error.cause instanceof Error);
			}
		});

		it(mode + ': converts both collected text and scalar alternatives for the next request', async () => {
			for (const streaming of [true, false]) {
				const converted: (string | number)[] = [];
				const component = create.Function.asTool({
					inputSchema: z.object({}), schema: streaming ? textStreamSchema() : z.number(),
					execute: () => streaming ? (async function* () { yield 'a'; yield 'b'; })() : 7,
					toModelOutput: ({ output }) => {
						converted.push(output);
						return { type: 'text', value: typeof output === 'number' ? output.toFixed(1) : output.toUpperCase() };
					},
				});
				const model = modelFor({});
				const config = { model, tools: { probe: component }, prompt: 'go', stopWhen: isStepCount(2) };
				const result = mode === 'generate' ? await generateText(config) : streamText(config);
				await result.steps;
				assert.deepEqual(converted, [streaming ? 'ab' : 7]);
				const calls = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
				assert.equal(calls.length, 2);
				assert.match(JSON.stringify(calls[1].prompt), streaming ? /AB/ : /7\.0/);
			}
		});

		it(mode + ': converts a collected parsed stream through the native output callback', async () => {
			const converted: unknown[] = [];
			const component = create.Function.asTool({
				inputSchema: z.object({}), schema: streamSchema(z.string().transform(Number)),
				execute: async function* () { yield '2'; yield '3'; },
				toModelOutput: ({ output }) => {
					converted.push(output);
					return { type: 'text', value: output.join(',') };
				},
			});
			const model = modelFor({});
			const settings = { model, tools: { probe: component }, prompt: 'go', stopWhen: isStepCount(2) };
			const result = mode === 'generate' ? await generateText(settings) : streamText(settings);
			await result.steps;
			assert.deepEqual(converted, [[2, 3]]);
			const calls = mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls;
			assert.match(JSON.stringify(calls[1].prompt), /2,3/);
		});
		it(mode + ': resolves public input before approval, then resumes one parsed execution', async () => {
			let executions = 0;
			const approvals: unknown[] = [], available: unknown[] = [];
			const secret = 'PRIVATE_APPROVAL_SENTINEL';
			const component = create.Function.asTool({
				inputSchema: z.object({ factor: z.string().transform(Number) }), context: { factor: '3', token: secret },
				toolContextSchema: z.object({ factor: z.string(), token: z.string() }),
				needsApproval: input => { approvals.push(input); return true; },
				onInputAvailable: ({ input }) => { available.push(input); },
				execute: ({ factor, token }) => { executions++; assert.equal(token, secret); return factor * 2; },
			});
			const binding = component.bindToolContext({ factor: '5', token: secret });
			const model = modelFor({});
			const config = { model, tools: { probe: binding.tool }, toolsContext: { probe: binding.context }, prompt: 'go' };
			const pending = mode === 'generate' ? await generateText(config) : streamText(config);
			const response = await pending.response;
			assert.equal(executions, 0);
			assert.deepEqual(approvals, [{ factor: 5 }]);
			assert.deepEqual(available, [{ factor: 5 }]);
			assert(!JSON.stringify(response.messages).includes(secret));
			assert(!JSON.stringify(await asSchema(binding.tool.inputSchema).jsonSchema).includes(secret));
			const continuationModel = modelFor(undefined);
			const continuation = { model: continuationModel, tools: config.tools, toolsContext: config.toolsContext,
				messages: approve(response.messages), stopWhen: isStepCount(2) };
			const resumed = mode === 'generate' ? await generateText(continuation) : streamText(continuation);
			await resumed.steps;
			assert.equal(executions, 1);
			const requests = mode === 'generate' ? continuationModel.doGenerateCalls : continuationModel.doStreamCalls;
			assert.match(JSON.stringify(requests[0].prompt), /10/);
			assert(!JSON.stringify(requests).includes(secret));

			// Approval input is revalidated against the same effective defaults.
			const changed = component.bindToolContext({ factor: '7', token: secret });
			const changedModel = modelFor(undefined);
			const changedConfig = { ...continuation, model: changedModel, tools: { probe: changed.tool }, toolsContext: { probe: changed.context } };
			const rejected = mode === 'generate' ? await generateText(changedConfig) : streamText(changedConfig);
			await rejected.steps;
			assert.equal(executions, 1);
			assert.match(JSON.stringify(mode === 'generate' ? changedModel.doGenerateCalls : changedModel.doStreamCalls), /error-text/);
		});

		it(mode + ': private collisions fail before approval and refinement cannot reach the body', async () => {
			let executions = 0, approvals = 0;
			const component = create.Function.asTool({
				inputSchema: z.object({ value: z.number() }), context: { user: 'PRIVATE_USER_SENTINEL' },
				needsApproval: () => { approvals++; return false; }, execute: () => { executions++; return 1; },
			});
			const model = modelFor({ value: 1, user: 'admin' });
			const config = { model, tools: { probe: component }, prompt: 'go', stopWhen: isStepCount(2) };
			const rejected = mode === 'generate' ? await generateText(config) : streamText(config);
			await rejected.steps;
			assert.equal(approvals, 0);
			assert.equal(executions, 0);
			const refinedModel = modelFor({ value: 1 });
			const refinedConfig = { ...config, model: refinedModel, experimental_refineToolInput: {
				probe: (input: { value: number }) => ({ ...input, user: 'admin' }),
			} };
			const refined = mode === 'generate' ? await generateText(refinedConfig) : streamText(refinedConfig);
			await refined.steps;
			assert.equal(executions, 0);
			assert(!JSON.stringify(mode === 'generate' ? refinedModel.doGenerateCalls : refinedModel.doStreamCalls).includes('PRIVATE_USER_SENTINEL'));
		});

		it(mode + ': output and lazy stream errors expose stage summaries to the next model request', async () => {
			const sentinel = 'PRIVATE_OUTPUT_SENTINEL';
			const outputSchema = z.string().refine(() => false, sentinel);
			const functions = [
				create.Function.asTool({ inputSchema: z.object({}), context: { sentinel }, schema: outputSchema, execute: context => context.sentinel }),
				create.Function.asTool({ inputSchema: z.object({}), context: { sentinel }, schema: streamSchema(outputSchema), execute: async function* (context) { yield context.sentinel; } }),
			];
			for (const action of functions) {
				const model = modelFor({});
				const config = { model, tools: { probe: action }, prompt: 'go', stopWhen: isStepCount(2) };
				const result = mode === 'generate' ? await generateText(config) : streamText(config);
				const steps = await result.steps;
				assert.equal(steps.length, 2);
				const transport = JSON.stringify({ steps: steps.map(step => step.response.messages),
					requests: mode === 'generate' ? model.doGenerateCalls : model.doStreamCalls });
				assert(!transport.includes(sentinel));
				assert.match(transport, /validation failed/);
			}
		});
	}
});
