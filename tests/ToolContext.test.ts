/* eslint-disable no-constant-condition -- Unreachable branches verify compile-time errors. */
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { create, z } from './cascada';
import type { FunctionToolConfig, GenerateTextConfig, ScriptToolConfig, StreamTextConfig, TemplateToolConfig } from './cascada';
import type { ToolExecutionOptions } from 'ai';
import { jsonSchema, tool as sdkTool } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';

chai.use(chaiAsPromised);
const { expect } = chai;
const inputSchema = z.object({ value: z.number() });
const contextSchema = z.object({ factor: z.number() });
const options = { toolCallId: 'context-test', messages: [], context: { factor: 3 } };

function mockModel(text = 'TOOL_CONTEXT', toolName?: string): MockLanguageModelV3 {
	const finishReason = { unified: toolName === undefined ? 'stop' : 'tool-calls', raw: 'stop' } as const;
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	return new MockLanguageModelV3({
		doGenerate: {
			content: toolName === undefined
				? [{ type: 'text', text }]
				: [{ type: 'tool-call', toolCallId: 'context-call', toolName, input: '{"value":2}' }],
			finishReason,
			usage,
			warnings: [],
		},
		doStream: async () => ({
			stream: convertArrayToReadableStream([
				{ type: 'stream-start', warnings: [] },
				...(toolName === undefined ? [
					{ type: 'text-start' as const, id: 'text' },
					{ type: 'text-delta' as const, id: 'text', delta: text },
					{ type: 'text-end' as const, id: 'text' },
				] : [{ type: 'tool-call' as const, toolCallId: 'context-call', toolName, input: '{"value":2}' }]),
				{ type: 'finish', finishReason, usage },
			]),
		}),
	});
}

describe('SDK tool context', () => {
	it('should preserve declared context types in annotated Function tool configs', async () => {
		const config: FunctionToolConfig<typeof inputSchema, undefined, undefined, undefined, { factor: number }> = {
			inputSchema, contextSchema,
			execute: ({ value }, { context }) => value * context.factor,
		};
		const action = create.Function.asTool(config);
		const child = create.Function.asTool({ description: 'Inherited declared context' }, action);
		expect(await action({ value: 2 }, options)).to.equal(6);
		expect(await action.execute({ value: 2 }, options)).to.equal(6);
		expect(await child({ value: 2 }, options)).to.equal(6);
		expect(await child.execute({ value: 2 }, options)).to.equal(6);
		if (false) {
			// @ts-expect-error An optional schema property in the config type does not make its context optional.
			await action({ value: 2 }, { ...options, context: undefined });
			// @ts-expect-error The public execute method requires the same declared context.
			await action.execute({ value: 2 }, { ...options, context: undefined });
			// @ts-expect-error Inheritance preserves the known context despite optional schema metadata.
			await child.execute({ value: 2 }, { ...options, context: undefined });
		}
	});

	it('should preserve unknown context in annotated Function tool configs', async () => {
		const config: FunctionToolConfig<typeof inputSchema, undefined, undefined, undefined, unknown> = {
			inputSchema, contextSchema: z.unknown(), execute: (_input, { context }) => context,
		};
		const action = create.Function.asTool(config);
		const child = create.Function.asTool({}, action);
		expect(await action({ value: 2 }, { ...options, context: 'arbitrary' })).to.equal('arbitrary');
		expect(await action.execute({ value: 2 }, options)).to.equal(options.context);
		expect(await child.execute({ value: 2 }, { ...options, context: 'arbitrary' })).to.equal('arbitrary');
	});

	it('should preserve declared context through ConfigProvider parents', async () => {
		const config: FunctionToolConfig<typeof inputSchema, undefined, undefined, undefined, { factor: number }> = {
			inputSchema, contextSchema, execute: ({ value }, { context }) => value * context.factor,
		};
		const action = create.Function.asTool({ description: 'Configured' }, { config });
		const child = create.Function.asTool({}, action);
		expect(await action({ value: 2 }, options)).to.equal(6);
		expect(await child.execute({ value: 2 }, options)).to.equal(6);
		const unknownConfig: FunctionToolConfig<typeof inputSchema, undefined, undefined, undefined, unknown> = {
			inputSchema, contextSchema: z.unknown(), execute: (_input, { context }) => context,
		};
		const unknownAction = create.Function.asTool({}, { config: unknownConfig });
		expect(await unknownAction({ value: 2 }, { ...options, context: 'arbitrary' })).to.equal('arbitrary');
		if (false) {
			// @ts-expect-error The declared context stays required through a provider.
			await action({ value: 2 }, { ...options, context: undefined });
			// @ts-expect-error Later generations keep the declared context.
			await child.execute({ value: 2 }, { ...options, context: undefined });
			// @ts-expect-error The inherited callback still requires a factor.
			create.Function.asTool({ contextSchema: z.object({ label: z.string() }) }, { config });
		}
	});

	it('should check an inherited callback against the context it accepts', async () => {
		const broad = create.Function.asTool({
			inputSchema, contextSchema, execute: ({ value }, { context }: ToolExecutionOptions<unknown>) => value + Number(context !== undefined),
		});
		const relabeled = create.Function.asTool({ contextSchema: z.object({ label: z.string() }) }, broad);
		expect(await relabeled({ value: 2 }, { ...options, context: { label: 'child' } })).to.equal(3);
		if (false) {
			// @ts-expect-error The replacement schema defines the public context.
			await relabeled({ value: 2 }, options);
		}
	});

	it('should preserve a completed tool context through conditional config composition and multiple generations', async () => {
		function makeMultiply(requestScoped: boolean) {
			const settings = requestScoped ? { contextSchema } : {};
			return create.Function.asTool({
				inputSchema, ...settings, execute: ({ value }, { context }) => value * (context?.factor ?? 1),
			});
		}
		const parent = makeMultiply(true);
		const child = create.Function.asTool({ description: 'Multiply using request settings' }, parent);
		const grandchild = create.Function.asTool({}, child);
		const replacedCallback = create.Function.asTool({ execute: ({ value }, { context }) => value + context.factor }, child);
		expect(await child({ value: 2 }, options)).to.equal(6);
		expect(await grandchild.execute({ value: 2 }, options)).to.equal(6);
		expect(await replacedCallback({ value: 2 }, options)).to.equal(5);
		if (false) {
			// @ts-expect-error The child retains the parent's required context contract.
			await child({ value: 2 }, { ...options, context: undefined });
			// @ts-expect-error A later generation must retain the same context shape.
			await grandchild.execute({ value: 2 }, { ...options, context: { label: 'wrong' } });
			// @ts-expect-error Replacing schema metadata still requires a compatible implementation.
			create.Function.asTool({ contextSchema: z.object({ label: z.string() }) }, child);
		}
	});

	it('should preserve optional and unknown parent context without inferring from broad callback annotations', async () => {
		const optional = create.Function.asTool({
			inputSchema, contextSchema: contextSchema.optional(), execute: ({ value }, { context }) => value * (context?.factor ?? 1),
		});
		const optionalChild = create.Function.asTool({}, optional);
		const unknown = create.Function.asTool({ inputSchema, contextSchema: z.unknown(), execute: (_input, { context }) => context });
		const unknownChild = create.Function.asTool({}, unknown);
		const narrow = create.Function.asTool({
			inputSchema, contextSchema, execute: ({ value }, { context }: ToolExecutionOptions<unknown>) => value + Number(context !== undefined),
		});
		const narrowChild = create.Function.asTool({}, narrow);
		expect(await optionalChild({ value: 2 }, { ...options, context: undefined })).to.equal(2);
		expect(await optionalChild.execute({ value: 2 }, options)).to.equal(6);
		expect(await unknownChild.execute({ value: 2 }, { ...options, context: 'anything' })).to.equal('anything');
		expect(await narrowChild({ value: 2 }, options)).to.equal(3);
		if (false) {
			// @ts-expect-error Callback annotations cannot widen a completed tool's schema contract.
			await narrowChild({ value: 2 }, { ...options, context: 'wrong' });
		}
	});

	it('should infer callback context and keep configured input context separate', async () => {
		const tool = create.Function.asTool({
			inputSchema,
			contextSchema,
			context: { offset: 4 },
			execute: ({ value, offset }, { context }) => {
				const factor: number = context.factor;
				return value * factor + offset;
			},
		});

		expect(tool.contextSchema).to.equal(contextSchema);
		expect(await tool({ value: 2 }, options)).to.equal(10);
		expect(await tool.execute({ value: 2 }, options)).to.equal(10);
		expect(await tool.execute({ value: 2, offset: 1 }, options)).to.equal(7);
		if (false) {
			// @ts-expect-error The context schema requires a numeric factor.
			await tool({ value: 2 }, { ...options, context: { factor: 'wrong' } });
			// @ts-expect-error The same context type applies to .execute().
			await tool.execute({ value: 2, offset: 1 }, { ...options, context: undefined });
		}
	});

	it('should validate inherited callbacks against optional schemas and schema removal', async () => {
		const parent = create.Function.asTool({
			inputSchema, contextSchema,
			execute: ({ value }, { context }) => value * context.factor,
		});
		const child = create.Function.asTool({
			contextSchema: undefined,
			execute: ({ value }, { context }) => {
				const absent: undefined = context;
				expect(absent).to.equal(undefined);
				return value;
			},
		}, parent);
		expect(await child.execute({ value: 2 }, { ...options, context: undefined })).to.equal(2);
		const fragment: Partial<FunctionToolConfig<typeof inputSchema, undefined, undefined, undefined, { label: string }>> = {
			contextSchema: z.object({ label: z.string() }),
		};
		if (false) {
			// @ts-expect-error Explicit removal cannot leave a callback that requires context.
			create.Function.asTool({ contextSchema: undefined }, parent);
			// @ts-expect-error An optional schema can replace or remove the inherited schema.
			create.Function.asTool(fragment, parent);
		}
	});

	it('should accept conditional schema overrides with an implementation covering every possible context', async () => {
		const parent = create.Function.asTool({ inputSchema, contextSchema, execute: ({ value }, { context }) => value * context.factor });
		const replacement = z.object({ label: z.string() });
		for (const replace of [false, true]) {
			const settings = replace ? { contextSchema: replacement } : {};
			const child = create.Function.asTool({
				...settings,
				execute: ({ value }, { context }: ToolExecutionOptions<{ factor: number } | { label: string } | undefined>) =>
					String(value) + (context === undefined ? '' : 'label' in context ? context.label : String(context.factor)),
			}, parent);
			const grandchild = create.Function.asTool({}, child);
			const executionOptions = { ...options, context: replace ? { label: 'LABEL' } : { factor: 3 } };
			const result: string = await grandchild.execute({ value: 2 }, executionOptions);
			expect(result).to.equal(replace ? '2LABEL' : '23');
			if (false) {
				// @ts-expect-error Conditional overrides preserve the possible schemas without widening to any.
				await grandchild.execute({ value: 2 }, { ...options, context: 'wrong' });
				// @ts-expect-error A callback typed only for the replacement does not cover the parent schema.
				create.Function.asTool({ ...settings, execute: ({ value }, { context }) => context.label + String(value) }, parent);
			}
		}
	});

	it('should accept exported annotated configs with optional tools properties', async () => {
		const action = create.Function.asTool({ inputSchema, contextSchema, execute: ({ value }, { context }) => value * context.factor });
		const model = mockModel('', 'action');
		const config: GenerateTextConfig<{ action: typeof action }, never> = {
			model, tools: { action }, toolsContext: { action: { factor: 3 } }, prompt: 'Use action.',
		};
		const streamConfig: StreamTextConfig<{ action: typeof action }, never> = {
			model, tools: { action }, toolsContext: { action: { factor: 3 } }, prompt: 'Use action.',
		};
		expect((await create.TextGenerator(config).run({})).toolResults[0].output).to.equal(6);
		const stream = create.TextStreamer(streamConfig).run({});
		expect((await stream.toolResults)[0].output).to.equal(6);
		expect((await create.TextGenerator({}, create.Config(config)).run({})).toolResults[0].output).to.equal(6);
	});

	it('should defer missing contexts until a partial Config becomes a component', async () => {
		const action = create.Function.asTool({ inputSchema, contextSchema, execute: ({ value }, { context }) => value * context.factor });
		const contextOnly = create.Config({ toolsContext: { action: { factor: 3 } } });
		const toolsOnly = create.Config({ tools: { action } });
		const emptyContexts = create.Config({ tools: { action }, toolsContext: {} });
		const complete = create.Config({ tools: { action } }, contextOnly);
		for (const config of [toolsOnly, emptyContexts, complete]) {
			const generator = create.TextGenerator({ model: mockModel('', 'action'), prompt: 'Use action.', toolsContext: { action: { factor: 3 } } }, config);
			expect((await generator()).toolResults[0].output).to.equal(6);
		}
		if (false) {
			// @ts-expect-error A concrete generator needs the missing context.
			create.TextGenerator({ model: mockModel(), prompt: 'Use action.' }, toolsOnly);
			// @ts-expect-error An empty partial context map is incomplete at component creation.
			create.TextStreamer({ model: mockModel(), prompt: 'Use action.' }, emptyContexts);
			// @ts-expect-error Known, supplied values are validated even in partial configs.
			create.Config({ tools: { action }, toolsContext: { action: { factor: 'wrong' } } });
		}
	});

	it('should reject extra tool context names, including in typed variables', () => {
		const action = create.Function.asTool({ inputSchema, contextSchema, execute: ({ value }, { context }) => value * context.factor });
		const config = { model: mockModel(), tools: { action }, toolsContext: { action: { factor: 3 }, typo: { factor: 3 } } };
		if (false) {
			// @ts-expect-error A valid entry cannot hide an extra name.
			create.TextGenerator(config);
			// @ts-expect-error Streamers use the same exact map validation.
			create.TextStreamer(config);
			// @ts-expect-error Config can identify unknown names when the tools are known.
			create.Config(config);
		}
	});

	for (const streaming of [false, true]) {
		it(`should preserve tool types in compatible ${streaming ? 'streamer' : 'generator'} run replacements`, async () => {
			const action = create.Function.asTool({ inputSchema, contextSchema, execute: ({ value }, { context }) => value * context.factor });
			const compatible = sdkTool({ inputSchema, contextSchema, execute: ({ value }, { context }) => value * context.factor + 1 });
			const wrongContext = sdkTool({ inputSchema, contextSchema: z.object({ label: z.string() }), execute: ({ value }) => value });
			const wrongOutput = sdkTool({ inputSchema, contextSchema, execute: ({ value }) => String(value) });
			const wrongInput = sdkTool({ inputSchema: z.object({ label: z.string() }), contextSchema, execute: () => 1 });
			const config = { model: mockModel('', 'action'), prompt: 'Use action.', tools: { action }, toolsContext: { action: { factor: 3 } } };
			const component = streaming ? create.TextStreamer(config) : create.TextGenerator(config);
			const result = await component.run({ tools: { action: compatible }, toolsContext: { action: { factor: 4 } } });
			const toolResult = (await result.toolResults)[0];
			if (toolResult.dynamic) throw new Error('Expected a typed tool result.');
			const output: number = toolResult.output;
			expect(output).to.equal(9);
			expect(component.config.tools.action).to.equal(action);
			if (false) {
				// @ts-expect-error Changed execution context requires a new component.
				await component.run({ tools: { action: wrongContext } });
				// @ts-expect-error Changed output would invalidate the returned result type.
				await component.run({ tools: { action: wrongOutput } });
				// @ts-expect-error Changed input would invalidate the returned tool call type.
				await component.run({ tools: { action: wrongInput } });
				// @ts-expect-error New tool names also require a new component.
				await component.run({ tools: { extra: compatible } });
				const extra = { tools: { action: compatible, extra: compatible } };
				// @ts-expect-error Extra tool names cannot bypass checking through a variable.
				await component.run(extra);
				const extraContext = { toolsContext: { action: { factor: 4 }, typo: { factor: 3 } } };
				// @ts-expect-error Extra context names cannot bypass checking through a variable.
				await component.run(extraContext);
				// @ts-expect-error Input schemas are fixed when the component is created.
				await component.run({ inputSchema: z.object({ label: z.string() }) });
			}
		});
	}

	it('should use undefined context when no schema is configured', async () => {
		const tool = create.Function.asTool({
			inputSchema,
			execute: ({ value }, { context }) => {
				const absent: undefined = context;
				expect(absent).to.equal(undefined);
				return value;
			},
		});
		expect(await tool({ value: 2 }, { ...options, context: undefined })).to.equal(2);
		if (false) {
			// @ts-expect-error A tool without a context schema has no SDK context.
			await tool.execute({ value: 2 }, options);
		}
	});

	it('should preserve explicitly unknown schema context', async () => {
		const tool = create.Function.asTool({
			inputSchema, contextSchema: z.unknown(),
			execute: (_input, { context }) => {
				if (false) {
					// @ts-expect-error An unknown schema does not permit unchecked property access.
					expect(context.factor).to.equal(3);
				}
				return context;
			},
		});
		expect(await tool.execute({ value: 2 }, { ...options, context: 'anything' })).to.equal('anything');
	});

	it('should use undefined SDK context for schema-free renderer tools', async () => {
		const template = create.Template.asTool({ inputSchema, template: '{{ value }}' });
		const script = create.Script.asTool({ inputSchema, script: 'return value', schema: z.number() });
		const text = create.TextGenerator.withFunction.asTool({ inputSchema, model: mockModel('TEXT'), prompt: ({ value }) => String(value) });
		const object = create.ObjectGenerator.withFunction.asTool({
			inputSchema, model: mockModel('{"answer":2}'), schema: z.object({ answer: z.number() }), prompt: ({ value }) => String(value),
		});
		const executionOptions = { ...options, context: undefined };
		expect(await template.execute({ value: 2 }, executionOptions)).to.equal('2');
		expect(await script.execute({ value: 2 }, executionOptions)).to.equal(2);
		expect(await text.execute({ value: 2 }, executionOptions)).to.equal('TEXT');
		expect(await object.execute({ value: 2 }, executionOptions)).to.deep.equal({ answer: 2 });
		if (false) {
			// @ts-expect-error A template without contextSchema cannot receive SDK context.
			await template.execute({ value: 2 }, options);
			// @ts-expect-error A script without contextSchema cannot receive SDK context.
			await script.execute({ value: 2 }, options);
			// @ts-expect-error A function-prompt text tool without contextSchema cannot receive SDK context.
			await text.execute({ value: 2 }, options);
			// @ts-expect-error A function-prompt object tool without contextSchema cannot receive SDK context.
			await object.execute({ value: 2 }, options);
		}
	});

	it('should adapt SDK wrapper options explicitly for a schema-free tool', async () => {
		const inner = create.Function.asTool({ inputSchema, execute: ({ value }) => value * 2 });
		const wrapped = sdkTool({
			inputSchema,
			execute: (input, executionOptions) => inner(input, { ...executionOptions, context: undefined }),
		});
		const result = await create.TextGenerator({ model: mockModel('', 'wrapped'), tools: { wrapped }, prompt: 'Use the tool.' })();
		expect(result.toolResults[0].output).to.equal(4);
	});

	it('should inherit the schema and callback from a parent tool', async () => {
		const parent = create.Function.asTool({
			inputSchema,
			contextSchema,
			execute: ({ value }, { context }) => value * context.factor,
		});
		const child = create.Function.asTool({}, parent);
		expect(child.contextSchema).to.equal(contextSchema);
		expect(await child({ value: 2 }, options)).to.equal(6);
		if (false) {
			// @ts-expect-error Inherited context is still required and typed.
			await child({ value: 2 }, { ...options, context: undefined });
		}
	});

	it('should infer a replacement callback from a parent schema', async () => {
		const parent = create.Config({ inputSchema, contextSchema });
		const child = create.Function.asTool({
			execute: ({ value }, { context }) => {
				expect(value.toFixed(0)).to.equal('2');
				return value * context.factor;
			},
		}, parent);
		const result: number = await child({ value: 2 }, options);
		expect(result).to.equal(6);
		if (false) {
			// @ts-expect-error Callback output is inferred without an output schema.
			const incorrect: string = await child({ value: 2 }, options);
			expect(incorrect).to.equal('6');
		}
	});

	it('should use the child schema when overriding a parent schema', async () => {
		const parent = create.Function.asTool({
			inputSchema,
			contextSchema,
			execute: ({ value }, { context }) => value * context.factor,
		});
		const replacement = z.object({ label: z.string() });
		const child = create.Function.asTool({
			contextSchema: replacement,
			execute: ({ value }, { context }) => `${context.label}:${value}`,
		}, parent);
		expect(child.contextSchema).to.equal(replacement);
		expect(await child({ value: 2 }, { ...options, context: { label: 'child' } })).to.equal('child:2');
		if (false) {
			// @ts-expect-error The parent context type was replaced.
			await child({ value: 2 }, options);
			// @ts-expect-error An incompatible schema replacement also needs a compatible callback.
			create.Function.asTool({ contextSchema: replacement }, parent);
		}
	});

	it('should infer JSON and lazy context schemas through SDK types', async () => {
		const schema = jsonSchema<{ factor: number }>({
			type: 'object', properties: { factor: { type: 'number' } }, required: ['factor'],
		});
		const tool = create.Function.asTool({
			inputSchema,
			contextSchema: () => schema,
			execute: ({ value }, { context }) => value * context.factor,
		});
		expect(await tool({ value: 2 }, options)).to.equal(6);
		if (false) {
			// @ts-expect-error Lazy JSON schemas retain their declared context type.
			await tool.execute({ value: 2 }, { ...options, context: { factor: 'wrong' } });
			create.Function.asTool({
				inputSchema, contextSchema,
				// @ts-expect-error Callback annotations cannot replace schema inference.
				execute: (input, executionOptions: ToolExecutionOptions<{ label: string }>) => executionOptions.context.label,
			});
		}
	});

	it('should support optional tool context', async () => {
		const multiply = create.Function.asTool({
			inputSchema, contextSchema: contextSchema.optional(),
			execute: ({ value }, { context }) => value * (context?.factor ?? 1),
		});
		expect(await multiply({ value: 2 }, { ...options, context: undefined })).to.equal(2);
		expect(await multiply({ value: 2 }, options)).to.equal(6);
		const generator = create.TextGenerator({ model: mockModel(), tools: { multiply }, prompt: 'Optional context.' });
		expect(generator.config.tools).to.have.property('multiply');
	});

	it('should require matching generator and streamer toolsContext', async () => {
		const tool = create.Function.asTool({
			inputSchema,
			contextSchema,
			execute: ({ value }, { context }) => value * context.factor,
		});
		const model = mockModel();
		const tools = { multiply: tool };
		const config = { model, tools, toolsContext: { multiply: { factor: 3 } }, prompt: 'Use the tool.' };
		const generator = create.TextGenerator(config);
		const streamer = create.TextStreamer(config);
		expect(generator.config.toolsContext).to.deep.equal(config.toolsContext);
		expect(streamer.config.toolsContext).to.deep.equal(config.toolsContext);
		if (false) {
			// @ts-expect-error Typed tools require toolsContext.
			create.TextGenerator({ model, tools, prompt: 'Use the tool.' });
			// @ts-expect-error Streamers also require toolsContext.
			create.TextStreamer({ model, tools, prompt: 'Use the tool.' });
			// @ts-expect-error The context map is keyed by tool name.
			const _invalidName: GenerateTextConfig<typeof tools, never> = { model, tools, toolsContext: { other: { factor: 3 } } };
			// @ts-expect-error Context values must match the tool schema.
			const _invalidValue: StreamTextConfig<typeof tools, never> = { model, tools, toolsContext: { multiply: { factor: 'wrong' } } };
			// @ts-expect-error The factory must preserve the SDK's value checking.
			create.TextGenerator({ model, tools, toolsContext: { multiply: { factor: 'wrong' } } });
			// @ts-expect-error Config reports the invalid tool name without relying on never.
			create.Config({ model, tools, toolsContext: { multiply: { factor: 'wrong' } } });
			// @ts-expect-error Streamer factory values are checked too.
			create.TextStreamer({ model, tools, toolsContext: { multiply: { factor: 'wrong' } } });
			// @ts-expect-error Run-time overrides preserve tool context typing.
			await generator.run({ toolsContext: { multiply: { factor: 'wrong' } } });
			// @ts-expect-error Streamer run-time overrides preserve tool context typing.
			streamer.run({ toolsContext: { multiply: { factor: 'wrong' } } });
		}
	});

	describe('prompt variants', () => {
		const loader = {
			load: (name: string) => name === 'script' ? 'return "Factor " ~ _toolCallOptions.context.factor' : 'Factor {{ _toolCallOptions.context.factor }}',
		};
		const prompt = 'Factor {{ _toolCallOptions.context.factor }}';
		const script = 'return "Factor " ~ _toolCallOptions.context.factor';
		const common = { inputSchema, contextSchema };
		const text = common;
		const object = { ...common, schema: z.object({ answer: z.number() }) };
		const factories = [
			{ name: 'text', build: (model: MockLanguageModelV3) => create.TextGenerator.asTool({ ...text, model, prompt: 'Static prompt.' }) },
			{ name: 'text template', build: (model: MockLanguageModelV3) => create.TextGenerator.withTemplate.asTool({ ...text, model, prompt }) },
			{ name: 'text script', build: (model: MockLanguageModelV3) => create.TextGenerator.withScript.asTool({ ...text, model, prompt: script }) },
			{ name: 'loaded text', build: (model: MockLanguageModelV3) => create.TextGenerator.loadsText.asTool({ ...text, model, loader, prompt: 'text' }) },
			{ name: 'loaded text template', build: (model: MockLanguageModelV3) => create.TextGenerator.loadsTemplate.asTool({ ...text, model, loader, prompt: 'template' }) },
			{ name: 'loaded text script', build: (model: MockLanguageModelV3) => create.TextGenerator.loadsScript.asTool({ ...text, model, loader, prompt: 'script' }) },
			{ name: 'object', build: (model: MockLanguageModelV3) => create.ObjectGenerator.asTool({ ...object, model, prompt: 'Static prompt.' }) },
			{ name: 'object template', build: (model: MockLanguageModelV3) => create.ObjectGenerator.withTemplate.asTool({ ...object, model, prompt }) },
			{ name: 'object script', build: (model: MockLanguageModelV3) => create.ObjectGenerator.withScript.asTool({ ...object, model, prompt: script }) },
			{ name: 'loaded object', build: (model: MockLanguageModelV3) => create.ObjectGenerator.loadsText.asTool({ ...object, model, loader, prompt: 'text' }) },
			{ name: 'loaded object template', build: (model: MockLanguageModelV3) => create.ObjectGenerator.loadsTemplate.asTool({ ...object, model, loader, prompt: 'template' }) },
			{ name: 'loaded object script', build: (model: MockLanguageModelV3) => create.ObjectGenerator.loadsScript.asTool({ ...object, model, loader, prompt: 'script' }) },
			{ name: 'loaded template', build: (_model: MockLanguageModelV3) => create.Template.loadsTemplate.asTool({ ...common, loader, template: 'template' }) },
			{ name: 'loaded script', build: (_model: MockLanguageModelV3) => create.Script.loadsScript.asTool({ ...common, loader, script: 'script' }) },
		];
		for (const { name, build } of factories) {
			it(`should preserve context for ${name} tools`, async () => {
				const model = mockModel(name.includes('object') ? '{"answer":6}' : undefined);
				const tool = build(model);
				expect(tool.contextSchema).to.equal(contextSchema);
				const result = await tool.execute({ value: 2 }, options);
				expect(result).to.deep.equal(name.includes('object') ? { answer: 6 } : name === 'loaded template' || name === 'loaded script' ? 'Factor 3' : 'TOOL_CONTEXT');
				if (name !== 'loaded template' && name !== 'loaded script') {
					const expectedPrompt = name.includes('template') || name.includes('script')
						? 'Factor 3' : name.startsWith('loaded') ? prompt : 'Static prompt.';
					const userPrompt = model.doGenerateCalls[0].prompt.find(message => message.role === 'user');
					expect(userPrompt?.content).to.deep.equal([{ type: 'text', text: expectedPrompt }]);
				}
				if (false) {
					// @ts-expect-error Context stays typed across prompt variants.
					await tool.execute({ value: 2 }, { ...options, context: undefined });
				}
			});
		}
	});

	it('should preserve generator tool context through parent configs', () => {
		const multiply = create.Function.asTool({
			inputSchema, contextSchema,
			execute: ({ value }, { context }) => value * context.factor,
		});
		const parent = create.Config({
			model: mockModel(), tools: { multiply }, toolsContext: { multiply: { factor: 3 } },
		});
		const generator = create.TextGenerator({ prompt: 'Inherited context.' }, parent);
		const streamer = create.TextStreamer({ prompt: 'Inherited context.' }, parent);
		const overridden = create.TextGenerator({ toolsContext: { multiply: { factor: 4 } } }, parent);
		const overriddenStreamer = create.TextStreamer({ toolsContext: { multiply: { factor: 4 } } }, parent);
		expect(generator.config.toolsContext).to.deep.equal({ multiply: { factor: 3 } });
		expect(streamer.config.toolsContext).to.deep.equal({ multiply: { factor: 3 } });
		expect(overridden.config.toolsContext).to.deep.equal({ multiply: { factor: 4 } });
		expect(overriddenStreamer.config.toolsContext).to.deep.equal({ multiply: { factor: 4 } });
		if (false) {
			// @ts-expect-error Parent tool context remains typed when overridden.
			create.TextGenerator({ toolsContext: { multiply: { factor: 'wrong' } } }, parent);
			// @ts-expect-error Parent tool context remains typed when overridden.
			create.TextStreamer({ toolsContext: { multiply: { factor: 'wrong' } } }, parent);
		}
	});

	it('should require context for every tool in a merged tool map', () => {
		const multiply = create.Function.asTool({
			inputSchema, contextSchema,
			execute: ({ value }, { context }) => value * context.factor,
		});
		const increment = create.Function.asTool({
			inputSchema, contextSchema: z.object({ amount: z.number() }),
			execute: ({ value }, { context }) => value + context.amount,
		});
		const parent = create.Config({ model: mockModel(), tools: { multiply }, toolsContext: { multiply: { factor: 3 } } });
		const toolsContext = { increment: { amount: 1 } };
		const generator = create.TextGenerator({ tools: { increment }, toolsContext }, parent);
		const streamer = create.TextStreamer({ tools: { increment }, toolsContext }, parent);
		expect(generator.config.tools).to.have.keys('multiply', 'increment');
		expect(generator.config.toolsContext).to.deep.equal({ multiply: { factor: 3 }, ...toolsContext });
		expect(streamer.config.toolsContext).to.deep.equal(generator.config.toolsContext);
		const childConfig = create.Config({ tools: { increment }, toolsContext }, parent);
		expect(childConfig.config.tools).to.have.keys('multiply', 'increment');
		expect(childConfig.config.toolsContext).to.deep.equal(generator.config.toolsContext);
		const fromChildConfig = create.TextGenerator({ prompt: 'Merged config.' }, childConfig);
		expect(fromChildConfig.config.toolsContext.increment.amount).to.equal(1);
		if (false) {
			// @ts-expect-error The inherited map does not provide context for the added tool.
			create.TextGenerator({ tools: { increment } }, parent);
			// @ts-expect-error The added tool still needs a valid context value.
			create.TextStreamer({ tools: { increment }, toolsContext: { increment: { amount: 'wrong' } } }, parent);
			// @ts-expect-error Run-time overrides use the merged map's context types.
			void generator.run({ toolsContext: { multiply: { factor: 3 }, increment: { amount: 'wrong' } } });
		}
	});

	describe('run overrides', () => {
		const multiply = create.Function.asTool({
			inputSchema, contextSchema,
			execute: ({ value }, { context }) => value * context.factor,
		});
		const config = (model: MockLanguageModelV3) => ({ model, tools: { multiply }, toolsContext: { multiply: { factor: 3 } } });
		const variants = [
			{ name: 'static', build: (model: MockLanguageModelV3) => create.TextGenerator({ ...config(model), prompt: 'Multiply.' }) },
			{ name: 'loaded text', build: (model: MockLanguageModelV3) => create.TextGenerator.loadsText({ ...config(model), loader: { load: () => 'Multiply.' }, prompt: 'text' }) },
			{ name: 'template', build: (model: MockLanguageModelV3) => create.TextGenerator.withTemplate({ ...config(model), prompt: 'Multiply.' }) },
			{ name: 'script', build: (model: MockLanguageModelV3) => create.TextGenerator.withScript({ ...config(model), prompt: 'return "Multiply."' }) },
			{ name: 'function', build: (model: MockLanguageModelV3) => create.TextGenerator.withFunction({ ...config(model), prompt: () => 'Multiply.' }) },
		];
		for (const { name, build } of variants) {
			it(`should pass overridden toolsContext through ${name} generators`, async () => {
				const generator = build(mockModel('', 'multiply'));
				expect((await generator.run({ toolsContext: { multiply: { factor: 5 } } })).toolResults[0].output).to.equal(10);
				expect((await generator()).toolResults[0].output).to.equal(6);
				expect(generator.config.toolsContext.multiply.factor).to.equal(3);
			});
		}

		it('should pass overridden toolsContext through static streamers', async () => {
			const streamer = create.TextStreamer({ ...config(mockModel('', 'multiply')), prompt: 'Multiply.' });
			const result = streamer.run({ toolsContext: { multiply: { factor: 5 } } });
			await result.consumeStream();
			expect((await result.toolResults)[0].output).to.equal(10);
		});

		it('should merge run overrides by name and replace each entire context value', async () => {
			const increment = create.Function.asTool({
				inputSchema, contextSchema: z.object({ amount: z.number() }),
				execute: ({ value }, { context }) => value + context.amount,
			});
			const generator = create.TextGenerator({
				model: mockModel('', 'multiply'), prompt: 'Multiply.', tools: { multiply, increment },
				toolsContext: { multiply: { factor: 3 }, increment: { amount: 1 } },
			});
			expect((await generator.run({ toolsContext: { increment: { amount: 5 } } })).toolResults[0].output).to.equal(6);
			expect((await generator.run({ model: mockModel('', 'increment'), toolsContext: { multiply: { factor: 5 } } })).toolResults[0].output).to.equal(3);
			if (false) {
				// @ts-expect-error Each supplied entry still must have the required fields.
				await generator.run({ toolsContext: { multiply: {} } });
				// @ts-expect-error Unknown tool names remain invalid for partial overrides.
				await generator.run({ toolsContext: { missing: { factor: 5 } } });
			}
		});
	});

	it('should replace context requirements when a child replaces a tool', () => {
		const original = create.Function.asTool({
			inputSchema, contextSchema,
			execute: ({ value }, { context }) => value * context.factor,
		});
		const replacement = create.Function.asTool({
			inputSchema, contextSchema: z.object({ label: z.string() }),
			execute: ({ value }, { context }) => `${context.label}:${value}`,
		});
		const parent = create.Config({ model: mockModel(), tools: { action: original }, toolsContext: { action: { factor: 3 } } });
		const generator = create.TextGenerator({ tools: { action: replacement }, toolsContext: { action: { label: 'child' } } }, parent);
		expect(generator.config.tools.action).to.equal(replacement);
		expect(generator.config.toolsContext).to.deep.equal({ action: { label: 'child' } });
		if (false) {
			// @ts-expect-error The replacement tool no longer accepts the original context.
			create.TextGenerator({ tools: { action: replacement }, toolsContext: { action: { factor: 3 } } }, parent);
			// @ts-expect-error Inherited context cannot satisfy an incompatible replacement tool.
			create.TextGenerator({ tools: { action: replacement } }, parent);
			// @ts-expect-error Config checks replacement contexts against the final tool set too.
			create.Config({ tools: { action: replacement } }, parent);
		}
	});

	describe('SDK context forwarding to renderer tools', () => {
		const common = { inputSchema, contextSchema };
		const variants = [
			{ name: 'template', build: (_model: MockLanguageModelV3) => create.Template.asTool({ ...common, template: '{{ value * _toolCallOptions.context.factor }}' }), expected: '6' },
			{ name: 'script', build: (_model: MockLanguageModelV3) => create.Script.asTool({ ...common, script: 'return value * _toolCallOptions.context.factor' }), expected: 6 },
			{ name: 'text generator', build: (model: MockLanguageModelV3) => create.TextGenerator.withTemplate.asTool({ ...common, model, prompt: 'Factor {{ _toolCallOptions.context.factor }}' }), expected: 'TOOL_CONTEXT' },
			{ name: 'object generator', build: (model: MockLanguageModelV3) => create.ObjectGenerator.withScript.asTool({ ...common, model, schema: z.object({ answer: z.number() }), prompt: 'return "Factor " ~ _toolCallOptions.context.factor' }), expected: { answer: 6 } },
		];
		for (const { name, build, expected } of variants) {
			for (const invalid of [false, true]) {
				it(`should ${invalid ? 'reject invalid' : 'forward valid'} SDK context for ${name} tools`, async () => {
					const innerModel = mockModel(name === 'object generator' ? '{"answer":6}' : undefined);
					const action = build(innerModel);
					const generator = create.TextGenerator({
						model: mockModel('', 'action'), tools: { action }, prompt: 'Use the tool.',
						toolsContext: { action: invalid ? { factor: 'wrong' } as unknown as { factor: number } : { factor: 3 } },
					});
					if (invalid) {
						await expect(generator()).to.be.rejectedWith(/tool context/);
						expect(innerModel.doGenerateCalls).to.have.length(0);
					} else {
						expect((await generator()).toolResults[0].output).to.deep.equal(expected);
						if (name.includes('generator')) {
							expect(innerModel.doGenerateCalls[0].prompt.find(message => message.role === 'user')?.content).to.deep.equal([{ type: 'text', text: 'Factor 3' }]);
						}
					}
				});
			}
		}
	});

	describe('renderer tools', () => {
		it('should preserve template tool context and expose it to templates', async () => {
			const tool = create.Template.asTool({
				inputSchema, contextSchema,
				template: '{{ value * _toolCallOptions.context.factor }}',
			});
			expect(tool.contextSchema).to.equal(contextSchema);
			expect(await tool.execute({ value: 2 }, options)).to.equal('6');
			if (false) {
				// @ts-expect-error Template execution context follows its schema.
				await tool.execute({ value: 2 }, { ...options, context: undefined });
			}
		});

		it('should preserve script tool context and expose it to scripts', async () => {
			const tool = create.Script.asTool({
				inputSchema, contextSchema,
				script: 'return value * _toolCallOptions.context.factor',
			});
			expect(tool.contextSchema).to.equal(contextSchema);
			expect(await tool.execute({ value: 2 }, options)).to.equal(6);
			if (false) {
				// @ts-expect-error Script execution context follows its schema.
				await tool.execute({ value: 2 }, { ...options, context: undefined });
			}
		});

		it('should preserve declared context in annotated renderer tool configs', async () => {
			const templateConfig: TemplateToolConfig<{ value: number }, { factor: number }> = {
				inputSchema, contextSchema, template: '{{ value * _toolCallOptions.context.factor }}',
			};
			const scriptConfig: ScriptToolConfig<{ value: number }, number, { factor: number }> = {
				inputSchema, contextSchema, script: 'return value * _toolCallOptions.context.factor',
			};
			const template = create.Template.asTool(templateConfig);
			const script = create.Script.asTool(scriptConfig);
			expect(await template.execute({ value: 2 }, options)).to.equal('6');
			expect(await script.execute({ value: 2 }, options)).to.equal(6);
			if (false) {
				// @ts-expect-error The declared template context is required.
				await template.execute({ value: 2 }, { ...options, context: undefined });
				// @ts-expect-error The declared script context is required.
				await script.execute({ value: 2 }, { ...options, context: undefined });
			}
		});

		it('should inherit schemas for renderer tools and allow replacement', async () => {
			const parent = create.Config({ inputSchema, contextSchema });
			const template = create.Template.asTool({ template: '{{ _toolCallOptions.context.factor }}' }, parent);
			const script = create.Script.asTool({ script: 'return _toolCallOptions.context.factor' }, parent);
			expect(template.contextSchema).to.equal(contextSchema);
			expect(script.contextSchema).to.equal(contextSchema);
			expect(await template.execute({ value: 2 }, options)).to.equal('3');
			expect(await script.execute({ value: 2 }, options)).to.equal(3);
			const replacement = z.object({ label: z.string() });
			const child = create.Template.asTool({ template: '{{ _toolCallOptions.context.label }}', contextSchema: replacement }, parent);
			expect(await child.execute({ value: 2 }, { ...options, context: { label: 'child' } })).to.equal('child');
			if (false) {
				// @ts-expect-error Parent context is required for the template.
				await template.execute({ value: 2 }, { ...options, context: undefined });
				// @ts-expect-error Parent context is required for the script.
				await script.execute({ value: 2 }, { ...options, context: undefined });
				// @ts-expect-error The child schema replaces its parent's schema.
				await child.execute({ value: 2 }, options);
			}
		});

		it('should preserve context in function-prompt text tools', async () => {
			const model = mockModel();
			const tool = create.TextGenerator.withFunction.asTool({
				model, inputSchema, contextSchema,
				prompt: context => `Factor ${context._toolCallOptions.context.factor}`,
			});
			expect(tool.contextSchema).to.equal(contextSchema);
			expect(await tool.execute({ value: 2 }, options)).to.equal('TOOL_CONTEXT');
			expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([{ type: 'text', text: 'Factor 3' }]);
			if (false) {
				// @ts-expect-error Function-prompt tools retain their context schema.
				await tool.execute({ value: 2 }, { ...options, context: undefined });
			}
		});

		it('should preserve context in function-prompt object tools', async () => {
			const model = mockModel('{"answer":6}');
			const tool = create.ObjectGenerator.withFunction.asTool({
				model, inputSchema, contextSchema,
				schema: z.object({ answer: z.number() }),
				prompt: context => `Factor ${context._toolCallOptions.context.factor}`,
			});
			expect(tool.contextSchema).to.equal(contextSchema);
			expect(await tool.execute({ value: 2 }, options)).to.deep.equal({ answer: 6 });
			expect(model.doGenerateCalls[0].prompt.find(message => message.role === 'user')?.content).to.deep.equal([{ type: 'text', text: 'Factor 3' }]);
			if (false) {
				// @ts-expect-error Object tools retain their context schema.
				await tool.execute({ value: 2 }, { ...options, context: undefined });
			}
		});

		it('should inherit schemas for function-prompt generator tools', async () => {
			const parent = create.Config({ model: mockModel(), inputSchema, contextSchema });
			const text = create.TextGenerator.withFunction.asTool({ prompt: context => `Factor ${context._toolCallOptions.context.factor}` }, parent);
			const objectParent = create.Config({ model: mockModel('{"answer":6}'), inputSchema, contextSchema, schema: z.object({ answer: z.number() }) });
			const object = create.ObjectGenerator.withFunction.asTool({ prompt: context => `Factor ${context._toolCallOptions.context.factor}` }, objectParent);
			expect(text.contextSchema).to.equal(contextSchema);
			expect(object.contextSchema).to.equal(contextSchema);
			expect(await text.execute({ value: 2 }, options)).to.equal('TOOL_CONTEXT');
			expect(await object.execute({ value: 2 }, options)).to.deep.equal({ answer: 6 });
			if (false) {
				// @ts-expect-error Text tools inherit their context requirement.
				await text.execute({ value: 2 }, { ...options, context: undefined });
				// @ts-expect-error Object tools inherit their context requirement.
				await object.execute({ value: 2 }, { ...options, context: undefined });
			}
		});
	});

	for (const invalid of [false, true]) {
		it(`should ${invalid ? 'reject invalid' : 'supply valid'} tool context through the SDK`, async () => {
			const model = mockModel('', 'multiply');
			const executed: ToolExecutionOptions<{ factor: number }>[] = [];
			const multiply = create.Function.asTool({
				inputSchema, contextSchema,
				execute: ({ value }, executionOptions) => {
					executed.push(executionOptions);
					return value * executionOptions.context.factor;
				},
			});
			const generator = create.TextGenerator({
				model, tools: { multiply }, prompt: 'Multiply.',
				toolsContext: { multiply: invalid ? { factor: 'wrong' } as unknown as { factor: number } : { factor: 3 } },
			});
			if (invalid) {
				await expect(generator()).to.be.rejectedWith(/tool context/);
				expect(executed).to.have.length(0);
			} else {
				const result = await generator();
				expect(executed).to.have.length(1);
				expect(executed[0].context).to.deep.equal({ factor: 3 });
				expect(result.toolResults[0].output).to.equal(6);
			}
		});
	}

	it('should let the SDK parse context once before calling the implementation', async () => {
		let parsed = 0;
		const multiply = create.Function.asTool({
			inputSchema,
			contextSchema: contextSchema.transform(context => {
				parsed++;
				return { factor: context.factor + 1 };
			}),
			execute: ({ value }, { context }) => value * context.factor,
		});
		const generator = create.TextGenerator({
			model: mockModel('', 'multiply'), tools: { multiply },
			toolsContext: { multiply: { factor: 3 } }, prompt: 'Multiply.',
		});
		const result = await generator();
		expect(result.toolResults[0].output).to.equal(8);
		expect(parsed).to.equal(1);
	});

	it('should leave context validation to the SDK for direct calls and execute', async () => {
		let parsed = 0;
		const multiply = create.Function.asTool({
			inputSchema,
			contextSchema: contextSchema.transform(context => {
				parsed++;
				return { factor: context.factor + 1 };
			}),
			execute: ({ value }, { context }) => value * context.factor,
		});
		expect(await multiply({ value: 2 }, options)).to.equal(6);
		expect(await multiply.execute({ value: 2 }, options)).to.equal(6);
		expect(parsed).to.equal(0);
	});
});
