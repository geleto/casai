import 'dotenv/config';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { create } from './cascada';
import { timeout } from './common';
import { z } from 'zod';
import { ToolCallOptions } from 'ai';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('create.Function', function () {
	this.timeout(timeout);

	describe('Core Functionality', () => {
		it('executes a simple function and returns the result', async () => {
			const fn = create.Function({
				inputSchema: z.object({
					val: z.number()
				}),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
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
					await new Promise(resolve => setTimeout(resolve, 0));
					return input.val * input.multiplier;
				}
			});
			const result = await fn({ val: 5 });
			expect(result).to.equal(15);
		});

		it('uses context from parent config', async () => {
			const parent = create.Config({
				context: { multiplier: 3 }
			});
			const fn = create.Function({
				inputSchema: z.object({
					val: z.number()
				}),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
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
					await new Promise(resolve => setTimeout(resolve, 0));
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
					await new Promise(resolve => setTimeout(resolve, 0));
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
					await new Promise(resolve => setTimeout(resolve, 0));
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
					await new Promise(resolve => setTimeout(resolve, 0));
					return `${context.secret}-${context.val}`;
				}
			});

			// Should pass validation because 'val' is provided, even though 'secret' is not in schema
			const result = await fn({ val: 42 });
			expect(result).to.equal('hidden-42');

			// Should fail validation if 'val' is missing
			// @ts-expect-error - testing invalid input
			await expect(fn({})).to.be.rejectedWith(/Input context validation failed/);
		});

		it('validates output schema', async () => {
			const fn = create.Function({
				schema: z.object({ res: z.string() }),
				execute: async () => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return { res: 'ok' };
				}
			});
			const result = await fn({});
			expect(result).to.deep.equal({ res: 'ok' });

			const badFn = create.Function({
				schema: z.object({ res: z.string() }),
				// @ts-expect-error - execute needs an {res: string} argument
				execute: async () => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return { res: 123 };
				}
			});
			await expect(badFn({})).to.be.rejectedWith(/Output validation failed/);
		});

		it('executes synchronous function', async () => {
			const fn = create.Function({
				inputSchema: z.object({
					val: z.number()
				}),
				execute: (input) => {
					return input.val * 2;
				}
			});
			const result = await fn({ val: 5 });
			expect(result).to.equal(10);
		});

		it('executes function returning promise', async () => {
			const fn = create.Function({
				inputSchema: z.object({
					val: z.number()
				}),
				execute: (input) => {
					return Promise.resolve(input.val * 2);
				}
			});
			const result = await fn({ val: 5 });
			expect(result).to.equal(10);
		});
	});

	describe('No Schema Tests', () => {
		it('accepts Record<string, any> when no inputSchema is provided', async () => {
			const fn = create.Function({
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					// eslint-disable-next-line @typescript-eslint/no-unsafe-return
					return input.anyProperty;
				}
			});


			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const result = await fn({ anyProperty: 'test', other: 123 });
			expect(result).to.equal('test');
		});

		it('allows any property when no inputSchema is specified', async () => {
			const fn = create.Function({
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						a: input.prop1,
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						b: input.prop2,
						// eslint-disable-next-line
						c: input.nested?.deep
					};
				}
			});
			const result = await fn({
				prop1: 'value1',
				prop2: 42,
				nested: { deep: 'deep value' }
			});
			expect(result).to.deep.equal({
				a: 'value1',
				b: 42,
				c: 'deep value'
			});
		});

		it('merges any input with context when no inputSchema', async () => {
			const fn = create.Function({
				context: { multiplier: 3 },
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return input.value * input.multiplier;
				}
			});
			const result = await fn({ value: 5 });
			expect(result).to.equal(15);
		});

		it('returns inferred type when no output schema is provided', async () => {
			const fn = create.Function({
				inputSchema: z.object({ val: z.number() }),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return { result: input.val * 2, message: 'success' };
				}
			});
			const result = await fn({ val: 5 });
			expect(result).to.deep.equal({ result: 10, message: 'success' });
		});

		it('fully dynamic - no inputSchema and no schema', async () => {
			const fn = create.Function({
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return { processed: true, data: input };
				}
			});
			const result = await fn({ anything: 'goes', here: 123 });
			expect(result).to.deep.equal({
				processed: true,
				data: { anything: 'goes', here: 123 }
			});
		});

		it('fully dynamic with context', async () => {
			const fn = create.Function({
				context: { prefix: 'Hello' },
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return `${input.prefix} ${input.name}`;
				}
			});
			const result = await fn({ name: 'World' });
			expect(result).to.equal('Hello World');
		});
	});

	describe('Schema Override Tests', () => {
		it('child overrides parent inputSchema', async () => {
			const parent = create.Config({
				context: { multiplier: 2 },
				// Parent would expect this schema if it had one
			});

			const parentFn = create.Function({
				inputSchema: z.object({ x: z.number() }),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return input.x * input.multiplier;
				}
			}, parent);

			const childFn = create.Function({
				inputSchema: z.object({ y: z.number() }), // Different schema
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return input.y * input.multiplier;
				}
			}, parentFn);

			const result = await childFn({ y: 5 });
			expect(result).to.equal(10);

			// Should fail with old schema
			// @ts-expect-error - x is not in child schema
			await expect(childFn({ x: 5 })).to.be.rejectedWith(/Input context validation failed/);
		});

		it('child overrides parent output schema', async () => {
			const parent = create.Config({
				context: { value: 10 }
			});

			const parentFn = create.Function({
				schema: z.object({ result: z.number() }),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return { result: input.value };
				}
			}, parent);

			const childFn = create.Function({
				schema: z.object({ output: z.string() }), // Different output schema
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return { output: input.value.toString() }
				}
			}, parentFn);

			const result = await childFn({});
			expect(result).to.deep.equal({ output: '10' });
		});

		it('child adds schema when parent has none', async () => {
			const parentFn = create.Function({
				context: { base: 100 },
				// eslint-disable-next-line
				execute: (input) => input.value + input.base
			});

			const childFn = create.Function({
				inputSchema: z.object({ value: z.number() }),
				schema: z.number(),
				execute: (input) => input.value + input.base
			}, parentFn);

			const result = await childFn({ value: 50 });
			expect(result).to.equal(150);

			// Validation should now work
			// @ts-expect-error - value is required
			await expect(childFn({})).to.be.rejectedWith(/Input context validation failed/);
		});

		it('child removes schema when parent has one', async () => {
			const parentFn = create.Function({
				inputSchema: z.object({ val: z.number() }),
				schema: z.object({ result: z.number() }),
				execute: (input) => ({ result: input.val * 2 })
			});

			const childFn = create.Function({
				// No schemas - should accept any input and return any output
				execute: (input) => input.val * 3
			}, parentFn);

			const result = await childFn({ val: 5 });
			expect(result).to.equal(15); // Returns number, not object
		});
	});

	describe('Execute Override Tests', () => {
		it('falls back to parent execute when child omits one', async () => {
			const parentFn = create.Function({
				context: { base: 1 },
				inputSchema: z.object({ value: z.number() }),
				execute: (input) => input.value + input.base
			});

			const childFn = create.Function({
				context: { value: 5 }
			}, parentFn);

			const result = await childFn({});
			expect(result).to.equal(6);
		});

		it('allows child to replace async parent execute with sync version', async () => {
			const parentFn = create.Function({
				context: { value: 7 },
				schema: z.object({ result: z.number() }),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return { result: input.value }
				}
			});

			const childFn = create.Function({
				schema: z.object({ output: z.string() }),
				execute: (input) => ({ output: (input.value * 2).toString() })
			}, parentFn);

			const result = await childFn({});
			expect(result).to.deep.equal({ output: '14' });
		});

		it('allows child to replace sync parent execute with async version', async () => {
			const parentFn = create.Function({
				execute: (input) => input.value * 2
			});

			const childFn = create.Function({
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return input.value * 3
				}
			}, parentFn);

			const result = await childFn({ value: 4 });
			expect(result).to.equal(12);
		});
	});

	describe('Optional Input Properties', () => {
		it('required property in schema provided via context', async () => {
			const fn = create.Function({
				context: { required: 'from-context' },
				inputSchema: z.object({
					optional: z.string().optional()
				}),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return `${input.required}-${input.optional ?? 'none'}`;
				}
			});

			// Should pass validation - optional is in context
			const result = await fn({});
			expect(result).to.equal('from-context-none');
		});

		it('optional property in schema, provided in context, overridden at runtime', async () => {
			const fn = create.Function({
				context: { optional: 'context-value', required: 'req' },
				inputSchema: z.object({
					required: z.string(),
					optional: z.string().optional()
				}),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return `${input.required}-${input.optional}`;
				}
			});

			// Should use context value
			const result1 = await fn({});
			expect(result1).to.equal('req-context-value');

			// Should override with runtime value
			const result2 = await fn({ optional: 'runtime-value' });
			expect(result2).to.equal('req-runtime-value');
		});

		it('multiple optional properties mixing context and runtime', async () => {
			const fn = create.Function({
				context: { a: 1, b: 2, c: 3 },
				inputSchema: z.object({
					a: z.number().optional(),
					b: z.number().optional(),
					c: z.number().optional(),
					d: z.number().optional()
				}),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return (input.a || 0) + (input.b || 0) + (input.c || 0) + (input.d || 0);
				}
			});

			// All from context
			expect(await fn({})).to.equal(6);

			// Override some
			expect(await fn({ b: 20, d: 40 })).to.equal(64); // 1 + 20 + 3 + 40
		});

		it('property exists in context but not in inputSchema - should be accessible', async () => {
			const fn = create.Function({
				context: { secret: 'hidden', visible: 'shown' },
				inputSchema: z.object({
					visible: z.string()
				}),
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return `${input.visible}-${input.secret}`;
				}
			});

			const result = await fn({});
			expect(result).to.equal('shown-hidden');
		});
	});

	describe('Config Merging Tests', () => {
		it('inherits and overrides debug flag', async () => {
			const parent = create.Config({
				debug: true,
				context: { value: 10 }
			});

			// Spy on console.log to verify debug output
			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: any[]) => logs.push(args.join(' '));

			const fn = create.Function({
				execute: (input) => input.value * 2
			}, parent);

			await fn({});

			console.log = originalLog;

			// Should have debug output from parent
			expect(logs.some(log => log.includes('[DEBUG]'))).to.be.true;
		});

		it('child overrides parent debug flag', async () => {
			const parent = create.Config({
				debug: true,
				context: { value: 10 }
			});

			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args: any[]) => logs.push(args.join(' '));

			const fn = create.Function({
				debug: false, // Override parent
				execute: (input) => input.value * 2
			}, parent);

			await fn({});

			console.log = originalLog;

			// Should NOT have debug output
			expect(logs.some(log => log.includes('[DEBUG]'))).to.be.false;
		});

		it('merges multiple config properties', async () => {
			const parent = create.Config({
				context: { a: 1, b: 2 },
				debug: false
			});

			const fn = create.Function({
				context: { b: 20, c: 3 }, // Override b, add c
				inputSchema: z.object({ d: z.number() }),
				execute: (input) => {
					return input.a + input.b + input.c + input.d;
				}
			}, parent);

			const result = await fn({ d: 4 });
			expect(result).to.equal(28); // 1 + 20 + 3 + 4
		});
	});

	describe('Function Composition', () => {
		it('function calls another function internally', async () => {
			const addFn = create.Function({
				inputSchema: z.object({ a: z.number(), b: z.number() }),
				execute: (input) => input.a + input.b
			});

			const multiplyFn = create.Function({
				inputSchema: z.object({ x: z.number(), y: z.number() }),
				execute: (input) => {
					const sum = await addFn({ a: input.x, b: input.y });
					return sum * 2;
				}
			});

			const result = await multiplyFn({ x: 5, y: 3 });
			expect(result).to.equal(16); // (5 + 3) * 2
		});

		it('function uses another function with context propagation', async () => {
			const baseFn = create.Function({
				context: { multiplier: 10 },
				inputSchema: z.object({ val: z.number() }),
				execute: (input) => input.val * input.multiplier
			});

			const wrapperFn = create.Function({
				inputSchema: z.object({ value: z.number() }),
				execute: (input) => {
					const result1 = await baseFn({ val: input.value });
					const result2 = await baseFn({ val: input.value + 1 });
					return result1 + result2;
				}
			});

			const result = await wrapperFn({ value: 5 });
			expect(result).to.equal(110); // (5 * 10) + (6 * 10)
		});

		it('chained function calls with different schemas', async () => {
			const parseNumber = create.Function({
				inputSchema: z.object({ str: z.string() }),
				schema: z.number(),
				execute: (input) => parseInt(input.str, 10)
			});

			const doubleNumber = create.Function({
				inputSchema: z.object({ num: z.number() }),
				schema: z.number(),
				execute: (input) => input.num * 2
			});

			const formatResult = create.Function({
				inputSchema: z.object({ value: z.number() }),
				schema: z.string(),
				execute: (input) => `Result: ${input.value}`
			});

			const pipeline = create.Function({
				inputSchema: z.object({ input: z.string() }),
				execute: (input) => {
					const parsed = await parseNumber({ str: input.input });
					const doubled = await doubleNumber({ num: parsed });
					const formatted = await formatResult({ value: doubled });
					return formatted;
				}
			});

			const result = await pipeline({ input: '42' });
			expect(result).to.equal('Result: 84');
		});
	});

	describe('Multiple Inheritance Levels', () => {
		it('grandparent -> parent -> child context inheritance', async () => {
			const grandparent = create.Config({
				context: { a: 1, b: 2, c: 3 }
			});

			const parent = create.Function({
				context: { b: 20, d: 4 }, // Override b, add d
				execute: (input) => input.a + input.b + input.c + input.d
			}, grandparent);

			const child = create.Function({
				context: { c: 30, e: 5 }, // Override c, add e
				execute: (input) => input.a + input.b + input.c + input.d + input.e
			}, parent);

			const result = await child({});
			expect(result).to.equal(60); // 1 + 20 + 30 + 4 + 5
		});

		it('schema overrides at different levels', async () => {
			const grandparent = create.Function({
				inputSchema: z.object({ x: z.number() }),
				execute: (input) => input.x
			});

			const parent = create.Function({
				inputSchema: z.object({ y: z.number() }), // Override schema
				execute: (input) => input.y * 2
			}, grandparent);

			const child = create.Function({
				inputSchema: z.object({ z: z.number() }), // Override again
				execute: (input) => input.z * 3
			}, parent);

			const result = await child({ z: 5 });
			expect(result).to.equal(15);

			// Old schemas should not work
			// @ts-expect-error - x is from grandparent
			await expect(child({ x: 5 })).to.be.rejectedWith(/Input context validation failed/);
			// @ts-expect-error - y is from parent
			await expect(child({ y: 5 })).to.be.rejectedWith(/Input context validation failed/);
		});

		it('output schema overrides through multiple levels', async () => {
			const level1 = create.Function({
				context: { val: 10 },
				schema: z.number(),
				execute: (input) => input.val
			});

			const level2 = create.Function({
				schema: z.string(), // Override to string
				execute: (input) => input.val.toString()
			}, level1);

			const level3 = create.Function({
				schema: z.object({ result: z.string() }), // Override to object
				execute: (input) => ({ result: input.val.toString() })
			}, level2);

			const result = await level3({});
			expect(result).to.deep.equal({ result: '10' });
		});

		it('complex multi-level with execute override', async () => {
			const base = create.Function({
				context: { multiplier: 2 },
				inputSchema: z.object({ val: z.number() }),
				execute: (input) => input.val * input.multiplier
			});

			const middle = create.Function({
				context: { multiplier: 3, offset: 10 },
				execute: (input) => (input.val * input.multiplier) + input.offset
			}, base);

			const top = create.Function({
				context: { multiplier: 4 },
				execute: (input) => (input.val * input.multiplier) + input.offset
			}, middle);

			const result = await top({ val: 5 });
			expect(result).to.equal(30); // (5 * 4) + 10
		});
	});

	describe('Error Handling', () => {
		it('execute function throws error - properly propagated', async () => {
			const fn = create.Function({
				inputSchema: z.object({ val: z.number() }),
				execute: (input) => {
					if (input.val < 0) {
						throw new Error('Value must be positive');
					}
					return input.val * 2;
				}
			});

			const result = await fn({ val: 5 });
			expect(result).to.equal(10);

			await expect(fn({ val: -5 })).to.be.rejectedWith('Value must be positive');
		});

		it('execute function rejects promise - properly caught', async () => {
			const fn = create.Function({
				inputSchema: z.object({ val: z.number() }),
				execute: (input) => {
					return Promise.reject(new Error('Async error'));
				}
			});

			await expect(fn({ val: 5 })).to.be.rejectedWith('Async error');
		});

		it('input validation error shows clear message', async () => {
			const fn = create.Function({
				inputSchema: z.object({
					name: z.string(),
					age: z.number().min(0).max(120)
				}),
				execute: (input) => `${input.name} is ${input.age}`
			});

			// @ts-expect-error - testing invalid input
			await expect(fn({ name: 'Alice' })).to.be.rejectedWith(/Input context validation failed/);

			await expect(fn({ name: 'Alice', age: 150 })).to.be.rejectedWith(/Input context validation failed/);
		});

		it('output validation error shows clear message', async () => {
			const fn = create.Function({
				schema: z.object({
					status: z.enum(['success', 'error']),
					code: z.number()
				}),
				execute: () => {
					// @ts-expect-error - intentionally return wrong type
					return { status: 'invalid', code: '200' };
				}
			});

			await expect(fn({})).to.be.rejectedWith(/Output validation failed/);
		});

		it('distinguishes config validation from runtime validation', async () => {
			// Config validation happens at creation time
			// This should succeed (config is valid)
			const fn = create.Function({
				inputSchema: z.object({ val: z.number() }),
				execute: (input) => input.val * 2
			});

			// Runtime validation happens at call time
			// @ts-expect-error - testing invalid input
			await expect(fn({ val: 'not a number' })).to.be.rejectedWith(/Input context validation failed/);
		});

		it('nested error propagation through function composition', async () => {
			const innerFn = create.Function({
				inputSchema: z.object({ x: z.number() }),
				execute: (input) => {
					if (input.x === 0) {
						throw new Error('Division by zero');
					}
					return 10 / input.x;
				}
			});

			const outerFn = create.Function({
				inputSchema: z.object({ value: z.number() }),
				execute: (input) => {
					return await innerFn({ x: input.value });
				}
			});

			await expect(outerFn({ value: 0 })).to.be.rejectedWith('Division by zero');
		});
	});

	describe('Complex Schemas', () => {
		it('nested object schemas', async () => {
			const fn = create.Function({
				inputSchema: z.object({
					user: z.object({
						name: z.string(),
						address: z.object({
							street: z.string(),
							city: z.string(),
							zip: z.number()
						})
					})
				}),
				schema: z.object({
					greeting: z.string(),
					location: z.string()
				}),
				execute: (input) => {
					return {
						greeting: `Hello ${input.user.name}`,
						location: `${input.user.address.city}, ${input.user.address.zip}`
					};
				}
			});

			const result = await fn({
				user: {
					name: 'Alice',
					address: {
						street: '123 Main St',
						city: 'Springfield',
						zip: 12345
					}
				}
			});

			expect(result).to.deep.equal({
				greeting: 'Hello Alice',
				location: 'Springfield, 12345'
			});
		});

		it('array schemas', async () => {
			const fn = create.Function({
				inputSchema: z.object({
					numbers: z.array(z.number())
				}),
				schema: z.object({
					sum: z.number(),
					count: z.number(),
					average: z.number()
				}),
				execute: (input) => {
					const sum = input.numbers.reduce((a, b) => a + b, 0);
					const count = input.numbers.length;
					return {
						sum,
						count,
						average: sum / count
					};
				}
			});

			const result = await fn({ numbers: [1, 2, 3, 4, 5] });
			expect(result).to.deep.equal({
				sum: 15,
				count: 5,
				average: 3
			});
		});

		it('array of objects schema', async () => {
			const fn = create.Function({
				inputSchema: z.object({
					items: z.array(z.object({
						name: z.string(),
						price: z.number()
					}))
				}),
				schema: z.object({
					total: z.number(),
					items: z.array(z.string())
				}),
				execute: (input) => {
					return {
						total: input.items.reduce((sum, item) => sum + item.price, 0),
						items: input.items.map(item => item.name)
					};
				}
			});

			const result = await fn({
				items: [
					{ name: 'Apple', price: 1.5 },
					{ name: 'Banana', price: 0.8 },
					{ name: 'Orange', price: 1.2 }
				]
			});

			expect(result).to.deep.equal({
				total: 3.5,
				items: ['Apple', 'Banana', 'Orange']
			});
		});

		it('union types', async () => {
			const fn = create.Function({
				inputSchema: z.object({
					value: z.union([z.string(), z.number()])
				}),
				schema: z.string(),
				execute: (input) => {
					return typeof input.value === 'string' ? input.value : input.value.toString();
				}
			});

			expect(await fn({ value: 'hello' })).to.equal('hello');
			expect(await fn({ value: 42 })).to.equal('42');
		});

		it('optional and nullable fields', async () => {
			const fn = create.Function({
				inputSchema: z.object({
					required: z.string(),
					optional: z.string().optional(),
					nullable: z.string().nullable(),
					optionalNullable: z.string().optional().nullable()
				}),
				execute: (input) => {
					return {
						required: input.required,
						optional: input.optional ?? 'default',
						nullable: input.nullable ?? 'null-default',
						optionalNullable: input.optionalNullable ?? 'opt-null-default'
					};
				}
			});

			const result = await fn({
				required: 'value',
				nullable: null
			});

			expect(result).to.deep.equal({
				required: 'value',
				optional: 'default',
				nullable: 'null-default',
				optionalNullable: 'opt-null-default'
			});
		});
	});

	describe('asTool Functionality', () => {
		it('creates a tool that merges context', async () => {
			const tool = create.Function.asTool({
				context: { prefix: 'Old Tool:' },
				inputSchema: z.object({ msg: z.string() }),
				execute: async (context) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return `${context.prefix} ${context.msg}`;
				}
			});

			// Simulate tool call (usually done by AI SDK)
			const result = await tool.execute({ msg: 'Hello', prefix: 'Tool:' }, {} as ToolCallOptions) as string;
			expect(result).to.equal('Tool: Hello');
		});

		it('injects _toolCallOptions into context', async () => {
			const tool = create.Function.asTool({
				inputSchema: z.object({}),
				execute: async (input, options) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return options.toolCallId;
				}
			});

			const options: ToolCallOptions = {
				toolCallId: 'call_123',
				messages: []
			};
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const result = await tool.execute({}, options);
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
				execute: async (input) => {
					await new Promise(resolve => setTimeout(resolve, 0));
					return input.req
				}
			});

			// If we call it like a tool, internal validation is skipped (assuming SDK did it)
			const result = await tool({ req: 'valid' }, {} as ToolCallOptions);
			expect(result).to.equal('valid');
		});

		it('asTool inherits parent config', async () => {
			const parent = create.Config({
				context: { multiplier: 10 }
			});

			const tool = create.Function.asTool({
				inputSchema: z.object({ val: z.number() }),
				execute: (input) => input.val * input.multiplier
			}, parent);

			const result = await tool.execute({ val: 5 }, {} as ToolCallOptions);
			expect(result).to.equal(50);
		});

		it('asTool overrides parent inputSchema', async () => {
			const parentFn = create.Function({
				inputSchema: z.object({ x: z.number() }),
				execute: (input) => input.x * 2
			});

			const tool = create.Function.asTool({
				inputSchema: z.object({ y: z.number() }), // Different schema
				execute: (input) => input.y * 3
			}, parentFn);

			const result = await tool.execute({ y: 5 }, {} as ToolCallOptions);
			expect(result).to.equal(15);
		});

		it('asTool overrides parent output schema', async () => {
			const parentFn = create.Function({
				context: { val: 10 },
				schema: z.number(),
				execute: (input) => input.val
			});

			const tool = create.Function.asTool({
				inputSchema: z.object({}),
				schema: z.object({ result: z.number() }),
				execute: (input) => ({ result: input.val })
			}, parentFn);

			const result = await tool.execute({}, {} as ToolCallOptions);
			expect(result).to.deep.equal({ result: 10 });
		});

		it('asTool validates output schema', async () => {
			const tool = create.Function.asTool({
				inputSchema: z.object({}),
				schema: z.object({ status: z.string() }),
				execute: () => {
					// @ts-expect-error - intentionally wrong type
					return { status: 123 };
				}
			});

			await expect(tool.execute({}, {} as ToolCallOptions)).to.be.rejectedWith(/Output validation failed/);
		});

		it('asTool with complex nested schemas', async () => {
			const tool = create.Function.asTool({
				inputSchema: z.object({
					request: z.object({
						user: z.object({
							id: z.number(),
							name: z.string()
						}),
						data: z.array(z.number())
					})
				}),
				schema: z.object({
					response: z.object({
						userId: z.number(),
						userName: z.string(),
						sum: z.number()
					})
				}),
				execute: (input) => {
					const sum = input.request.data.reduce((a, b) => a + b, 0);
					return {
						response: {
							userId: input.request.user.id,
							userName: input.request.user.name,
							sum
						}
					};
				}
			});

			const result = await tool.execute({
				request: {
					user: { id: 1, name: 'Alice' },
					data: [1, 2, 3, 4, 5]
				}
			}, {} as ToolCallOptions);

			expect(result).to.deep.equal({
				response: {
					userId: 1,
					userName: 'Alice',
					sum: 15
				}
			});
		});
	});

	describe('Real-world Scenarios', () => {
		it('data transformation pipeline with validation', async () => {
			// Parse CSV-like string
			const parser = create.Function({
				inputSchema: z.object({ csv: z.string() }),
				schema: z.array(z.object({
					name: z.string(),
					age: z.number()
				})),
				execute: (input) => {
					const lines = input.csv.split('\n').slice(1); // Skip header
					return lines.map(line => {
						const [name, age] = line.split(',');
						return { name, age: parseInt(age, 10) };
					});
				}
			});

			// Filter adults
			const filterAdults = create.Function({
				inputSchema: z.object({
					people: z.array(z.object({
						name: z.string(),
						age: z.number()
					}))
				}),
				schema: z.array(z.object({
					name: z.string(),
					age: z.number()
				})),
				execute: (input) => {
					return input.people.filter(p => p.age >= 18);
				}
			});

			// Format output
			const formatter = create.Function({
				inputSchema: z.object({
					people: z.array(z.object({
						name: z.string(),
						age: z.number()
					}))
				}),
				schema: z.string(),
				execute: (input) => {
					return input.people
						.map(p => `${p.name} (${p.age})`)
						.join(', ');
				}
			});

			// Combine into pipeline
			const pipeline = create.Function({
				inputSchema: z.object({ data: z.string() }),
				execute: (input) => {
					const parsed = await parser({ csv: input.data });
					const adults = await filterAdults({ people: parsed });
					const formatted = await formatter({ people: adults });
					return formatted;
				}
			});

			const csv = `name,age
Alice,25
Bob,17
Charlie,30
Diana,16`;

			const result = await pipeline({ data: csv });
			expect(result).to.equal('Alice (25), Charlie (30)');
		});

		it('multi-level config with composition and error handling', async () => {
			const baseConfig = create.Config({
				context: { apiKey: 'secret-key', timeout: 5000 }
			});

			const validator = create.Function({
				inputSchema: z.object({ value: z.number() }),
				execute: (input) => {
					if (input.value < 0) {
						throw new Error('Value must be non-negative');
					}
					return input.value;
				}
			}, baseConfig);

			const processor = create.Function({
				context: { multiplier: 2 },
				inputSchema: z.object({ num: z.number() }),
				execute: (input) => {
					const validated = await validator({ value: input.num });
					return validated * input.multiplier;
				}
			}, baseConfig);

			const logger = create.Function({
				inputSchema: z.object({
					operation: z.string(),
					result: z.number()
				}),
				execute: (input) => {
					return `[API_KEY: ${input.apiKey}] ${input.operation}: ${input.result}`;
				}
			}, baseConfig);

			const workflow = create.Function({
				inputSchema: z.object({ value: z.number() }),
				execute: (input) => {
					try {
						const result = await processor({ num: input.value });
						const log = await logger({ operation: 'multiply', result });
						return { success: true, log, result };
					} catch (error) {
						return { success: false, error: (error as Error).message, result: 0 };
					}
				}
			}, baseConfig);

			const successResult = await workflow({ value: 10 });
			expect(successResult.success).to.be.true;
			expect(successResult.result).to.equal(20);
			expect(successResult.log).to.include('[API_KEY: secret-key]');

			const errorResult = await workflow({ value: -5 });
			expect(errorResult.success).to.be.false;
			expect(errorResult.error).to.equal('Value must be non-negative');
		});

		it('context propagation through multiple inheritance levels', async () => {
			const level1 = create.Config({
				context: { env: 'production', version: '1.0.0' }
			});

			const level2 = create.Function({
				context: { service: 'api', port: 8080 },
				execute: (input) => ({
					env: input.env,
					version: input.version,
					service: input.service,
					port: input.port
				})
			}, level1);

			const level3 = create.Function({
				context: { region: 'us-east-1' },
				execute: (input) => ({
					env: input.env,
					version: input.version,
					service: input.service,
					port: input.port,
					region: input.region
				})
			}, level2);

			const level4 = create.Function({
				context: { instance: 'i-12345' },
				inputSchema: z.object({ request: z.string() }),
				execute: (input) => {
					return {
						request: input.request,
						metadata: {
							env: input.env,
							version: input.version,
							service: input.service,
							port: input.port,
							region: input.region,
							instance: input.instance
						}
					};
				}
			}, level3);

			const result = await level4({ request: 'test' });
			expect(result).to.deep.equal({
				request: 'test',
				metadata: {
					env: 'production',
					version: '1.0.0',
					service: 'api',
					port: 8080,
					region: 'us-east-1',
					instance: 'i-12345'
				}
			});
		});

		it('tool with full feature set - context, schemas, validation, composition', async () => {
			const calculateTax = create.Function({
				context: { taxRate: 0.1 },
				inputSchema: z.object({ amount: z.number() }),
				schema: z.number(),
				execute: (input) => input.amount * input.taxRate
			});

			const invoice = create.Function.asTool({
				context: { currency: 'USD', vendor: 'ACME Corp' },
				inputSchema: z.object({
					items: z.array(z.object({
						name: z.string(),
						price: z.number(),
						quantity: z.number()
					}))
				}),
				schema: z.object({
					subtotal: z.number(),
					tax: z.number(),
					total: z.number(),
					currency: z.string(),
					vendor: z.string()
				}),
				execute: async (input, options) => {
					const subtotal = input.items.reduce(
						(sum, item) => sum + (item.price * item.quantity),
						0
					);
					const tax = await calculateTax({ amount: subtotal });
					const total = subtotal + tax;

					return {
						subtotal,
						tax,
						total,
						currency: input.currency,
						vendor: input.vendor
					};
				}
			});

			const result = await invoice.execute({
				items: [
					{ name: 'Widget', price: 10, quantity: 2 },
					{ name: 'Gadget', price: 15, quantity: 1 }
				]
			}, { toolCallId: 'test', messages: [] });

			expect(result).to.deep.equal({
				subtotal: 35,
				tax: 3.5,
				total: 38.5,
				currency: 'USD',
				vendor: 'ACME Corp'
			});
		});
	});
});