import 'dotenv/config';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { create, ConfigError } from './cascada';
import { z } from 'zod';
import type { ToolExecutionOptions } from 'ai';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Function.asTool Updates', () => {
	describe('Input Schema Requirement', () => {
		it('should require inputSchema', () => {
			// inputSchema is required
			expect(() => create.Function.asTool({
				description: 'Test tool',
				execute: (input: { val: number }) => { return input.val; }
			} as any)).to.throw(ConfigError, /'inputSchema' is a required property/);
		});

		it('should accept valid inputSchema', () => {
			expect(() => create.Function.asTool({
				description: 'Test tool',
				inputSchema: z.object({ val: z.number() }),
				execute: async (input: { val: number }) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return input.val;
				}
			})).to.not.throw();
		});
	});

	describe('Execution with Options', () => {
		it('should pass options to execute function', async () => {
			let capturedOptions: ToolExecutionOptions<unknown> | undefined;
			const tool = create.Function.asTool({
				description: 'Test tool',
				inputSchema: z.object({ val: z.number() }),
				execute: async (input: { val: number }, options: ToolExecutionOptions<unknown>) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					capturedOptions = options;
					return input.val;
				}
			});

			const mockOptions: ToolExecutionOptions<unknown> = {
				toolCallId: '123',
				messages: [],
				context: undefined
			};

			await tool.execute({ val: 10 }, mockOptions);
			expect(capturedOptions).to.equal(mockOptions);
		});
	});

	describe('Context Propagation', () => {
		it('should merge context into input', async () => {
			const tool = create.Function.asTool({
				description: 'Test tool',
				context: { multiplier: 2 },
				inputSchema: z.object({ val: z.number(), multiplier: z.number() }),
				execute: async (input: { val: number } & { multiplier: number }) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return input.val * input.multiplier;
				}
			});

			const result = await tool({ val: 5, multiplier: 2 }, { toolCallId: '123', messages: [], context: undefined });
			expect(result).to.equal(10);
		});

		it('should pass options and context', async () => {
			let capturedOptions: ToolExecutionOptions<unknown> | undefined;
			const tool = create.Function.asTool({
				description: 'Test tool',
				context: { multiplier: 3 },
				inputSchema: z.object({ val: z.number() }),
				execute: async (input: { val: number } & { multiplier: number }, options: ToolExecutionOptions<unknown>) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					capturedOptions = options;
					return input.val * input.multiplier;
				}
			});

			const mockOptions: ToolExecutionOptions<unknown> = {
				toolCallId: '456',
				messages: [],
				context: undefined
			};

			const result = await tool({ val: 5 }, mockOptions);
			expect(result).to.equal(15);
			expect(capturedOptions).to.equal(mockOptions);
		});
	});
});
