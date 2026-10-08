/* eslint-disable no-constant-condition -- Unreachable branches verify compile-time errors. */
import 'dotenv/config';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { create, ConfigError } from './cascada';
import { z } from 'zod';
import type { FunctionToolConfig } from './cascada';
import type { ToolExecutionOptions } from 'ai';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Function.asTool Updates', () => {
	describe('Implementation inheritance', () => {
		const callOptions = { toolCallId: 'inherited', messages: [], context: undefined };

		it('should apply only the child output schema to an inherited implementation', async () => {
			const parent = create.Function.asTool({
				inputSchema: z.object({ value: z.number() }), schema: z.number().positive(),
				execute: ({ value }) => value,
			});
			const child = create.Function.asTool({ schema: z.number().negative() }, parent);
			const withoutSchema = create.Function.asTool({ schema: undefined }, parent);
			const options = { toolCallId: 'inherited', messages: [], context: undefined };
			expect(parent.execute).to.equal(parent);
			await expect(parent.execute({ value: -2 }, options)).to.be.rejectedWith(/Output validation failed/);
			expect(await child.execute({ value: -2 }, options)).to.equal(-2);
			expect(await withoutSchema({ value: -2 }, options)).to.equal(-2);
		});

		it('should transform inherited output once across multiple generations', async () => {
			let transformations = 0;
			const parent = create.Function.asTool({
				inputSchema: z.object({ value: z.number() }),
				schema: z.number().transform(value => {
					transformations++;
					return value + 1;
				}),
				execute: ({ value }) => value,
			});
			const child = create.Function.asTool({}, parent);
			const grandchild = create.Function.asTool({}, child);
			expect(await grandchild.execute({ value: 2 }, { toolCallId: 'inherited', messages: [], context: undefined })).to.equal(3);
			expect(transformations).to.equal(1);
		});

		it('should check an inherited implementation against the final schemas and context', async () => {
			const parent = create.Function.asTool({
				inputSchema: z.object({ value: z.number() }), context: { offset: 3 }, schema: z.number(),
				execute: ({ value, offset }) => value + offset,
			});
			const wider = create.Function.asTool({ inputSchema: z.object({ value: z.number(), label: z.string() }), context: { offset: 4 } }, parent);
			const result: number = await wider({ value: 2, label: 'unused' }, callOptions);
			expect(result).to.equal(6);
			if (false) {
				// @ts-expect-error The inherited callback needs a numeric input value.
				create.Function.asTool({ inputSchema: z.object({ value: z.string() }) }, parent);
				// @ts-expect-error The inherited callback returns a number, not a string.
				create.Function.asTool({ schema: z.string() }, parent);
				// @ts-expect-error The inherited callback needs a numeric configured offset.
				create.Function.asTool({ context: { offset: 'text' } }, parent);
				// @ts-expect-error A complete tool needs an implementation.
				create.Function.asTool({}, create.Config({ inputSchema: z.object({ value: z.number() }) }));
			}
		});

		it('should infer a replacement callback from the replacement schemas', async () => {
			const parent = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), schema: z.number(), execute: ({ value }) => value });
			const child = create.Function.asTool({
				inputSchema: z.object({ label: z.string() }), context: { suffix: '!' }, schema: z.string(),
				execute: ({ label, suffix }) => {
					if (false) {
						// @ts-expect-error The replacement input is a string, not any.
						const _label: number = label;
						// @ts-expect-error The configured suffix is a string, not any.
						const _suffix: number = suffix;
					}
					return label + suffix;
				},
			}, parent);
			const result: string = await child.execute({ label: 'done' }, callOptions);
			expect(result).to.equal('done!');
			if (false) {
				// @ts-expect-error The result follows the replacement schema.
				const _result: number = await child({ label: 'done' }, callOptions);
				// @ts-expect-error The parent's input schema was replaced.
				await child({ value: 2 }, callOptions);
			}
		});

		it('should infer a callback added to a parent config with only configured context', async () => {
			const tool = create.Function.asTool({
				inputSchema: z.object({ value: z.number() }),
				execute: ({ value, offset }) => {
					if (false) {
						// @ts-expect-error The input value is a number, not any.
						const _value: string = value;
						// @ts-expect-error The configured offset is a number, not any.
						const _offset: string = offset;
					}
					return value + offset;
				},
			}, create.Config({ context: { offset: 3 } }));
			const result: number = await tool({ value: 2 }, callOptions);
			expect(result).to.equal(5);
			if (false) {
				// @ts-expect-error Input-only fields are still required at call time.
				await tool({}, callOptions);
			}
		});

		it('should type the result from the replacement callback when the output schema is removed', async () => {
			const parent = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), schema: z.number(), execute: ({ value }) => value });
			const child = create.Function.asTool({ schema: undefined, execute: ({ value }) => `#${value}` }, parent);
			const result: string = await child({ value: 2 }, callOptions);
			expect(result).to.equal('#2');
			if (false) {
				// @ts-expect-error The removed schema no longer types the result.
				const _result: number = await child({ value: 2 }, callOptions);
			}
		});

		it('should type an annotated config without an output schema as an unknown result', async () => {
			const inputSchema = z.object({ value: z.number() });
			const config: FunctionToolConfig<typeof inputSchema, undefined, undefined> = { inputSchema, execute: ({ value }) => value.toFixed() };
			const result = await create.Function.asTool(config)({ value: 1 }, callOptions);
			expect(result).to.equal('1');
			if (false) {
				// @ts-expect-error The annotation hides execute's return type, so the result is unknown, not any.
				const _result: string = result;
			}
		});

		it('should reject a conditional execute override that may hold undefined', () => {
			const parent = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: ({ value }) => value });
			const override = Math.random() > 2 ? { execute: ({ value }: { value: number }) => value * 2 } : {};
			if (false) {
				// @ts-expect-error Without exactOptionalPropertyTypes, the optional execute may be undefined and remove the parent's.
				create.Function.asTool({ ...override }, parent);
			}
		});

		it('should not freeze configured context literals in inherited tools', async () => {
			const parent = create.Function.asTool({
				inputSchema: z.object({ value: z.number() }), context: { prefix: 'value=' }, execute: ({ value, prefix }) => prefix + String(value),
			});
			const child = create.Function.asTool({ description: 'Child' }, parent);
			expect(await child.execute({ value: 1, prefix: 'override=' }, callOptions)).to.equal('override=1');
			if (false) {
				// @ts-expect-error Configured overrides keep their type.
				await child.execute({ value: 1, prefix: 1 }, callOptions);
			}
		});
	});

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
			let capturedOptions: ToolExecutionOptions<undefined> | undefined;
			const tool = create.Function.asTool({
				description: 'Test tool',
				inputSchema: z.object({ val: z.number() }),
				execute: async (input: { val: number }, options: ToolExecutionOptions<undefined>) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					capturedOptions = options;
					return input.val;
				}
			});

			const mockOptions: ToolExecutionOptions<undefined> = {
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
			let capturedOptions: ToolExecutionOptions<undefined> | undefined;
			const tool = create.Function.asTool({
				description: 'Test tool',
				context: { multiplier: 3 },
				inputSchema: z.object({ val: z.number() }),
				execute: async (input: { val: number } & { multiplier: number }, options: ToolExecutionOptions<undefined>) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					capturedOptions = options;
					return input.val * input.multiplier;
				}
			});

			const mockOptions: ToolExecutionOptions<undefined> = {
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
