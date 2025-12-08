import 'dotenv/config';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { create, ConfigError } from '../src/index'; // Adjust import path as needed
import { z } from 'zod';
import { ToolCallOptions } from 'ai';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Function.asTool Updates', () => {
	describe('Input Schema Requirement', () => {
		it('should require inputSchema', () => {
			// inputSchema is required
			expect(() => create.Function.asTool({
				description: 'Test tool',
				execute: async (input: { val: number }) => { return input.val; }
			} as any)).to.throw(ConfigError, /'inputSchema' is a required property/);
		});

		it('should accept valid inputSchema', () => {
			expect(() => create.Function.asTool({
				description: 'Test tool',
				inputSchema: z.object({ val: z.number() }),
				execute: async (input: { val: number }) => { return input.val; }
			})).to.not.throw();
		});
	});

	describe('Execution with Options', () => {
		it('should pass options to execute function', async () => {
			let capturedOptions: ToolCallOptions | undefined;
			const tool = create.Function.asTool({
				description: 'Test tool',
				inputSchema: z.object({ val: z.number() }),
				execute: async (input: { val: number }, options: ToolCallOptions) => {
					capturedOptions = options;
					return input.val;
				}
			});

			const mockOptions: ToolCallOptions = {
				toolCallId: '123',
				messages: []
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
				inputSchema: z.object({ val: z.number() }),
				execute: async (input: { val: number } & { multiplier: number }) => {
					return input.val * input.multiplier;
				}
			});

			const result = await tool.execute({ val: 5 }, { toolCallId: '1', messages: [] });
			expect(result).to.equal(10);
		});

		it('should pass options and context', async () => {
			let capturedOptions: ToolCallOptions | undefined;
			const tool = create.Function.asTool({
				description: 'Test tool',
				context: { multiplier: 3 },
				inputSchema: z.object({ val: z.number() }),
				execute: async (input: { val: number } & { multiplier: number }, options: ToolCallOptions) => {
					capturedOptions = options;
					return input.val * input.multiplier;
				}
			});

			const mockOptions: ToolCallOptions = {
				toolCallId: '456',
				messages: []
			};

			const result = await tool.execute({ val: 5 }, mockOptions);
			expect(result).to.equal(15);
			expect(capturedOptions).to.equal(mockOptions);
		});
	});
});
