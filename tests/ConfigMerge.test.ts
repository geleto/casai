/* eslint-disable no-constant-condition -- Unreachable branches verify compile-time errors. */
import { expect } from 'chai';
import { mergeConfigs } from '../src/config-utils.js';
import { create, z } from './cascada';
import type { ILoaderAny } from 'cascada-engine';
import type { FunctionToolConfig } from './cascada';
import type { ToolExecutionOptions } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';

describe('Config merging', () => {
	it('should preserve parent map types and values when child maps are explicitly undefined', () => {
		const parent = {
			context: { offset: 4 }, filters: { upper: (text: string) => text.toUpperCase() },
			tools: { first: 'FIRST' }, toolsContext: { first: { factor: 3 } },
		};
		const merged = mergeConfigs(parent, { context: undefined, filters: undefined, tools: undefined, toolsContext: undefined });
		const offset: number = merged.context.offset;
		const first: string = merged.tools.first;
		const factor: number = merged.toolsContext.first.factor;
		expect([offset, first, factor]).to.deep.equal([4, 'FIRST', 3]);
		expect(merged.filters.upper('Hi')).to.equal('HI');
		expect(merged).to.deep.equal(parent);
		if (false) {
			// @ts-expect-error Preserving a map must not erase its value types.
			const _wrongOffset: string = merged.context.offset;
		}
	});

	it('should allow partial schema settings with and without a parent', async () => {
		const schema = z.object({ answer: z.number() });
		const standalone = create.Config({ schema });
		const inherited = create.Config({ schema }, create.Config({ context: { offset: 4 } }));
		expect(standalone.config.schema).to.equal(schema);
		expect(inherited.config.schema).to.equal(schema);
		const calculate = create.Function({ execute: ({ offset }) => ({ answer: offset + 2 }) }, inherited);
		expect(await calculate({})).to.deep.equal({ answer: 6 });
		// A partial Config defers required properties to the component factory.
		expect(() => create.Function({} as any, inherited)).to.throw(/'execute'.*must be a function/);
	});

	it('should validate malformed messages in both standalone and inherited fragments', () => {
		const invalid = { messages: [{ role: 'user' as const, content: 42 as unknown as string }] };
		expect(() => create.Config(invalid)).to.throw(/invalid message objects/);
		expect(() => create.Config(invalid, create.Config({ context: { offset: 4 } }))).to.throw(/invalid message objects/);
	});

	it('should merge maps by key, replace map values and concatenate messages', () => {
		const parent = {
			context: { offset: 4 }, filters: { upper: (text: string) => text.toUpperCase() },
			tools: { first: 'FIRST' }, toolsContext: { first: { factor: 3, extra: true } },
			messages: [{ role: 'user' as const, content: 'First' }],
		};
		const child = {
			context: { name: 'Alice' }, filters: { lower: (text: string) => text.toLowerCase() },
			tools: { second: 'SECOND' }, toolsContext: { first: { factor: 5 }, second: { label: 'child' } },
			messages: [{ role: 'assistant' as const, content: 'Second' }],
		};
		const merged = mergeConfigs(parent, child);
		const offset: number = merged.context.offset;
		const name: string = merged.context.name;
		expect([offset, name]).to.deep.equal([4, 'Alice']);
		expect(merged.filters.upper('Hi')).to.equal('HI');
		expect(merged.filters.lower('Hi')).to.equal('hi');
		expect(merged.tools).to.deep.equal({ first: 'FIRST', second: 'SECOND' });
		expect(merged.toolsContext).to.deep.equal({ first: { factor: 5 }, second: { label: 'child' } });
		expect(merged.messages.map(({ role }) => role)).to.deep.equal(['user', 'assistant']);
		expect(parent.toolsContext.first.extra).to.equal(true);
		if (false) {
			// @ts-expect-error Context entries are replaced; their fields are not deep-merged.
			expect(merged.toolsContext.first.extra).to.equal(undefined);
		}
	});

	it('should preserve absence and parent values for optional child settings', () => {
		const parent = { model: 'parent', context: { offset: 4 }, tools: { first: 'FIRST' } };
		const child: { model?: number, context?: { name: string }, tools?: { second: string }, debug?: boolean } = {};
		const merged = mergeConfigs(parent, child);
		const model: string | number | undefined = merged.model;
		const name: string | undefined = merged.context.name;
		const second: string | undefined = merged.tools.second;
		const debug: boolean | undefined = merged.debug;
		expect([model, name, second, debug]).to.deep.equal(['parent', undefined, undefined, undefined]);
		const updated = mergeConfigs(parent, { ...child, context: { name: 'Alice' } });
		const updatedName: string = updated.context.name;
		expect(updatedName).to.equal('Alice');
		if (false) {
			// @ts-expect-error An absent optional map cannot guarantee a new key.
			const _requiredName: string = merged.context.name;
			// @ts-expect-error Parent values remain possible when the child property is optional.
			const _childModel: number = merged.model;
		}
	});

	it('should expose processed loader arrays and preserve child-first lookup order', async () => {
		const parentLoader = { load: (name: string) => `parent ${name}` };
		const childLoader = { load: (name: string) => `child ${name}` };
		const parent = create.Config({ loader: parentLoader });
		const processed: ILoaderAny[] = parent.config.loader;
		expect(processed).to.have.length(1);
		const child = create.Config({ loader: childLoader }, parent);
		expect(child.config.loader).to.deep.equal([childLoader, parentLoader]);
		expect(await create.Template.loadsTemplate({ template: 'test' }, child)()).to.equal('child test');
	});

	it('should preserve merged configured context in Function callbacks', async () => {
		const parent = create.Config({ context: { offset: 4 }, inputSchema: z.object({ value: z.number() }) });
		const config = create.Config({ context: { factor: 3 } }, parent);
		const calculate = create.Function({ execute: ({ value, factor, offset }) => value * factor + offset }, config);
		expect(await calculate({ value: 2 })).to.equal(10);
	});

	it('should preserve optional context fields when configuring a Function child', async () => {
		const parent = create.Config({ context: { offset: 4 } });
		const context: { factor?: number } = {};
		const calculate = create.Function({
			context, inputSchema: z.object({ value: z.number() }),
			execute: ({ value, offset, factor }) => value * (factor ?? 1) + offset,
		}, parent);
		expect(await calculate({ value: 2 })).to.equal(6);
		expect(calculate.execute({ value: 2, offset: 4 })).to.equal(6);
	});

	describe('Function fragments', () => {
		const inputSchema = z.object({ value: z.number() });
		const contextSchema = z.object({ factor: z.number() });
		const options = { toolCallId: 'fragment', messages: [], context: { factor: 3 } };

		it('should type an inline execute from the fragment and its parent', async () => {
			const fragment = create.Config({
				inputSchema, contextSchema, context: { offset: 1 },
				execute: ({ value, offset }, { context }) => {
					if (false) {
						// @ts-expect-error The input value is a number, not any.
						const _value: string = value;
						// @ts-expect-error The SDK context is typed, not any.
						const _factor: string = context.factor;
					}
					return value * context.factor + offset;
				},
			});
			const inherited = create.Config({ execute: ({ value }) => value.toFixed() }, create.Config({ inputSchema }));
			const result: number = await create.Function.asTool({ description: 'Configured' }, fragment)({ value: 2 }, options);
			const text: string = await create.Function({}, inherited)({ value: 2 });
			expect([result, text]).to.deep.equal([7, '2']);
		});

		it('should preserve an annotated tool config passed through Config', async () => {
			const config: FunctionToolConfig<typeof inputSchema, undefined, undefined, undefined, { factor: number }> = {
				inputSchema, contextSchema, execute: ({ value }, { context }) => value * context.factor,
			};
			const tool = create.Function.asTool({}, create.Config(config));
			expect(await tool({ value: 2 }, options)).to.equal(6);
			if (false) {
				// @ts-expect-error The declared context remains required.
				await tool({ value: 2 }, { ...options, context: undefined });
			}
		});

		it('should reject contradictory fragments and components that supply their own execute', () => {
			const model = new MockLanguageModelV3();
			if (false) {
				// @ts-expect-error The execute input contradicts the fragment's schema.
				create.Config({ inputSchema: z.object({ value: z.string() }), execute: ({ value }: { value: number }) => value });
				// @ts-expect-error The execute needs SDK context that the fragment does not declare.
				create.Config({ inputSchema, execute: (_input, { context }: ToolExecutionOptions<{ factor: number }>) => context.factor });
				// @ts-expect-error No component accepts both a template and an execute function.
				create.Config({ inputSchema, template: 'x', execute: () => 1 });
				// @ts-expect-error The child replaces the schema its inherited execute needs.
				create.Config({ inputSchema: z.object({ value: z.string() }) }, create.Config({ inputSchema, execute: ({ value }) => value.toFixed() }));
				// @ts-expect-error Text generators run their own prompt.
				create.TextGenerator({ model, prompt: 'x' }, create.Config({ execute: () => 'x' }));
				// @ts-expect-error Generator tools supply their own execute.
				create.TextGenerator.asTool({ model, inputSchema, prompt: 'x', execute: async () => 'x' });
				// @ts-expect-error Renderer tools supply their own type.
				create.Template.asTool({ inputSchema, template: 'x', type: 'function' });
			}
			// The runtime agrees: a Function fragment cannot configure a text generator.
			expect(() => create.TextGenerator({ model, prompt: 'x' } as never, create.Config({ execute: () => 'x' }) as never)).to.throw(/execute/);
		});
	});
});
