import 'dotenv/config';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { create } from './cascada';
import { timeout } from './common';
import { z } from 'zod';
import { ToolCallOptions } from 'ai';

chai.use(chaiAsPromised);
const { expect } = chai;

describe.skip('create.Function', function () {
	this.timeout(timeout);

	describe('Core Functionality', () => {
		it('executes a simple function and returns the result', async () => {
			const fn = create.Function({
				inputSchema: z.object({
					val: z.number()
				}),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 1));
					return input.val * 2;
				}
			});
			const result = await fn({ val: 5 });
			expect(result).to.equal(10);
		});

		it('uses context from config', async () => {
			const fn = create.Function({
				context: { multiplier: 3 },
				inputSchema: z.object({
					val: z.number()
				}),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 1));
					return input.val * input.multiplier;
				}
			});
			const result = await fn({ val: 5 });
			expect(result).to.equal(15);
		});

		//temp - remove as it duplicates
		it('uses context from parent config', async () => {
			const parent = create.Config({
				context: { multiplier: 3 }
			});
			const fn = create.Function({
				inputSchema: z.object({
					val: z.number()
				}),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 1));
					return input.val * input.multiplier;
				}
			}, parent);
			const result = await fn({ val: 5 });
			expect(result).to.equal(15);
		});

		it('merges config context with runtime context', async () => {
			const fn = create.Function({
				context: { a: 1, b: 2 },
				inputSchema: z.object({
					c: z.number()
				}),
				execute: async (context) => {
					await new Promise(resolve => setTimeout(resolve, 1));
					return context.a + context.b + context.c;
				}
			});
			const result = await fn({ c: 3 });
			expect(result).to.equal(6);
		});

		it('runtime context overrides config context', async () => {
			const fn = create.Function({
				context: { a: 1, b: 2 },
				inputSchema: z.object({
					a: z.number()
				}),
				execute: async (context) => {
					await new Promise(resolve => setTimeout(resolve, 1));
					return context.a + context.b;
				}
			});
			// Override 'a'
			const result = await fn({ a: 10 });
			expect(result).to.equal(12);
		});

		it('inherits context from parent config', async () => {
			const parent = create.Config({
				context: { user: 'Alice' }
			});
			const fn = create.Function({
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 1));
					return `Hello ${input.user}`;
				}
			}, parent);
			const result = await fn({});
			expect(result).to.equal('Hello Alice');
		});

		it('validates input schema against runtime args only (ignoring config context)', async () => {
			const fn = create.Function({
				context: { secret: 'hidden' },
				inputSchema: z.object({
					val: z.number()
				}),
				execute: async (context) => {
					await new Promise(resolve => setTimeout(resolve, 1));
					return `${context.secret}-${context.val}`;
				}
			});

			// Should pass validation because 'val' is provided, even though 'secret' is not in schema
			const result = await fn({ val: 42 });
			expect(result).to.equal('hidden-42');

			// Should fail validation if 'val' is missing
			// @ts-ignore - testing invalid input
			await expect(fn({})).to.be.rejectedWith(/Input context validation failed/);
		});

		it('validates output schema', async () => {
			const fn = create.Function({
				schema: z.object({ res: z.string() }),
				execute: async () => {
					await new Promise(resolve => setTimeout(resolve, 1));
					return { res: 'ok' };
				}
			});
			const result = await fn({});
			expect(result).to.deep.equal({ res: 'ok' });

			const badFn = create.Function({
				schema: z.object({ res: z.string() }),
				// @ts-ignore - execute needs an {res: string} argument
				execute: async () => {
					await new Promise(resolve => setTimeout(resolve, 1));
					return { res: 123 };
				}
			});
			await expect(badFn({})).to.be.rejectedWith(/Output validation failed/);
		});
	});

	describe('asTool Functionality', () => {
		it('creates a tool that merges context', async () => {
			const tool = create.Function.asTool({
				context: { prefix: 'Tool:' },
				inputSchema: z.object({ msg: z.string() }),
				execute: async (context) => {
					await new Promise(resolve => setTimeout(resolve, 1));
					return `${context.prefix} ${context.msg}`;
				}
			});

			// Simulate tool call (usually done by AI SDK)
			const result = await (tool.execute as any)({ msg: 'Hello' }, {} as ToolCallOptions);
			expect(result).to.equal('Tool: Hello');
		});

		it('injects _toolCallOptions into context', async () => {
			const tool = create.Function.asTool({
				inputSchema: z.object({}),
				execute: async (context: any) => {
					return context._toolCallOptions.toolCallId;
				}
			});

			const options: ToolCallOptions = {
				toolCallId: 'call_123',
				messages: []
			};
			const result = await (tool.execute as any)({}, options);
			expect(result).to.equal('call_123');
		});

		it('validates input schema via AI SDK flow (simulated)', async () => {
			// When using asTool, the input validation is typically handled by the AI SDK before calling execute.
			// However, our wrapper doesn't strictly enforce it again if called directly via execute,
			// but we should ensure the underlying logic holds up.

			// Note: The current implementation of _createFunctionAsTool wraps the execute method.
			// The wrapper merges context and calls the internal renderer.
			// The internal renderer calls validateScriptOrFunctionCall.
			// validateScriptOrFunctionCall skips input validation if _toolCallOptions is present.

			const tool = create.Function.asTool({
				inputSchema: z.object({ req: z.string() }),
				execute: async (context: any) => context.req
			});

			// If we call it like a tool, internal validation is skipped (assuming SDK did it)
			const result = await (tool.execute as any)({ req: 'valid' }, {} as ToolCallOptions);
			expect(result).to.equal('valid');
		});
	});
});
