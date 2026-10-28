import { runtimeRun } from './fixtures/runtime-call.js';
import assert from 'node:assert/strict';
import { asSchema, tool } from 'ai';
import { validateTypes } from '@ai-sdk/provider-utils';
import { create, z } from './cascada';
import type { ComponentExecutionOptions } from './cascada';
import { modelFor } from './fixtures/phase2-security-sdk.js';

const inputSchema = z.object({ value: z.number() });
const toolContextSchema = z.object({ factor: z.number() });
const options = { toolCallId: 'context-test', messages: [], context: { factor: 3 } };

describe('Production tool context boundaries', () => {
	it('keeps original configuration and maps only the native descriptor schema', async () => {
		const execute = ({ value, factor }: { value: number; factor: number }) => value * factor;
		const parent = create.Function.asTool({ context: { factor: 1 }, inputSchema, toolContextSchema, execute });
		const child = create.Function.asTool({ context: { factor: 2 } }, parent);
		assert.equal(parent.config.execute, execute);
		assert.equal(child.config.execute, execute);
		assert.equal(parent.config.toolContextSchema, toolContextSchema);
		assert.equal(parent.contextSchema, toolContextSchema);
		assert.equal(await child({ value: 4 }), 8);
		assert.equal(await parent({ value: 4 }), 4);
	});

	for (const contextSchema of [undefined, toolContextSchema]) {
		it('forbids native contextSchema in Casai config, including undefined and inherited values: ' + (contextSchema === undefined ? 'absent' : 'present'), () => {
			const invalid = { inputSchema, contextSchema, toolContextSchema, execute: () => 1 };
			assert.throws(() => create.Function.asTool(invalid as never), /toolContextSchema/);
			assert.throws(() => create.Config(invalid as never), /toolContextSchema/);
			assert.throws(() => { Reflect.apply(create.Function.asTool, undefined, [{}, { config: invalid }]); }, /toolContextSchema/);
			const native = tool({ inputSchema, contextSchema: toolContextSchema, execute: ({ value }, { context }) => value * context.factor });
			assert.doesNotThrow(() => create.Function({ tools: { native }, toolsContext: { native: { factor: 2 } }, execute: () => 1 }));
		});
	}

	it('ordinary calls use configuration without parsing it as incoming tool context', async () => {
		let parsed = 0;
		const component = create.Function.asTool({ context: { factor: 2 }, inputSchema,
			toolContextSchema: toolContextSchema.transform(context => { parsed++; return { factor: context.factor + 1 }; }),
			execute: ({ value, factor }) => value * factor });
		assert.equal(await component({ value: 3 }), 6);
		assert.equal(await component.run({ context: { value: 4 } }), 8);
		assert.equal(parsed, 0);
		const binding = component.bindToolContext({ factor: 5 });
		const input = await validateTypes({ schema: binding.tool.inputSchema, value: { value: 2 } });
		const incoming = await validateTypes({ schema: binding.tool.contextSchema!, value: binding.context });
		assert.equal(await binding.tool.execute!(input, { ...options, context: incoming }), 12);
		assert.equal(parsed, 2, 'binding preparation and native context validation are separate boundaries');
	});

	it('bare descriptors accept private context and require binding for public defaults', async () => {
		const privateTool = create.Function.asTool({ context: { factor: 1 }, inputSchema, toolContextSchema, execute: ({ value, factor }) => value * factor });
		assert.equal(await privateTool.execute({ value: 2 }, options), 6);
		const publicTool = create.Function.asTool({ context: { factor: 1 }, inputSchema: inputSchema.extend({ factor: z.number() }), toolContextSchema, execute: ({ value, factor }) => value * factor });
		await assert.rejects(async () => await publicTool.execute({ value: 2, factor: 1 }, options), /bindToolContext/);
		const binding = publicTool.bindToolContext({ factor: 3 });
		const parsed = await validateTypes({ schema: binding.tool.inputSchema, value: { value: 2 } });
		assert.equal(await binding.tool.execute!(parsed, options), 6);
		assert.deepEqual((await asSchema(binding.tool.inputSchema).jsonSchema).required, ['value']);
	});

	it('injects metadata with context omitted, and preserves the ordinary signal', async () => {
		const seen: ComponentExecutionOptions[] = [];
		const component = create.Function.asTool({ context: { factor: 1 }, inputSchema, toolContextSchema, execute: context => { seen.push(context._toolOptions); return context.factor * context.value; } });
		const controller = new AbortController();
		await component.run({ context: { value: 1 }, abortSignal: controller.signal });
		await component.execute({ value: 2 }, options);
		assert.deepEqual(seen[0], { abortSignal: controller.signal });
		assert.deepEqual(seen[1], { toolCallId: options.toolCallId, messages: options.messages });
		assert(!Object.hasOwn(seen[1], 'context'));
	});

	for (const mode of ['generate', 'stream'] as const) {
		for (const renderer of ['text', 'loaded', 'template', 'script', 'function'] as const) {
			it(mode + ' ' + renderer + ': binds the same tool independently for each owner run', async () => {
				const multiply = create.Function.asTool({ context: { factor: 1 }, inputSchema: inputSchema.extend({ factor: z.number() }), toolContextSchema, execute: ({ value, factor }) => value * factor });
				const model = modelFor({ value: 2 }, 'multiply');
				const base = { model, tools: { multiply }, toolsContext: { multiply: { factor: 3 } } };
				const generators = [
					() => create.LLMAgent({ ...base, prompt: 'Multiply' }),
					() => create.LLMAgent.loadsText({ ...base, loader: { load: () => 'Multiply' }, prompt: 'source' }),
					() => create.LLMAgent.withTemplate({ ...base, prompt: 'Multiply' }),
					() => create.LLMAgent.withScript({ ...base, prompt: 'return "Multiply"' }),
					() => create.LLMAgent.withFunction({ ...base, prompt: () => 'Multiply' }),
				];
				const streamers = [
					() => create.LLMAgent.asStream({ ...base, prompt: 'Multiply' }),
					() => create.LLMAgent.loadsText.asStream({ ...base, loader: { load: () => 'Multiply' }, prompt: 'source' }),
					() => create.LLMAgent.withTemplate.asStream({ ...base, prompt: 'Multiply' }),
					() => create.LLMAgent.withScript.asStream({ ...base, prompt: 'return "Multiply"' }),
					() => create.LLMAgent.withFunction.asStream({ ...base, prompt: () => 'Multiply' }),
				];
				const index = ['text', 'loaded', 'template', 'script', 'function'].indexOf(renderer);
				const owner = (mode === 'generate' ? generators[index] : streamers[index])();
				const result = await runtimeRun(owner, { toolsContext: { multiply: { factor: 5 } } });
				assert.equal((await result.toolResults)[0].output, 10);
				assert.equal(owner.config.toolsContext.multiply.factor, 3);
				assert.equal(multiply.config.context.factor, 1);
			});
		}
		it(mode + ': context validation failure never reaches the component body', async () => {
			let entries = 0;
			const errors: unknown[] = [];
			const action = create.Function.asTool({ context: { factor: 1 }, inputSchema, toolContextSchema, execute: () => { entries++; return 1; } });
			const owner = mode === 'generate' ? create.LLMAgent({ model: modelFor({ value: 2 }), tools: { probe: action }, toolsContext: { probe: { factor: 'bad' } as never }, prompt: 'go' })
				: create.LLMAgent.asStream({ model: modelFor({ value: 2 }), tools: { probe: action }, toolsContext: { probe: { factor: 'bad' } as never }, prompt: 'go',
					onError: ({ error }) => { errors.push(error); } });
			await assert.rejects(async () => { const result = await owner(); await result.text; }, mode === 'generate' ? /Tool 'probe' context validation failed/ : /No output generated/);
			assert.equal(entries, 0);
			assert.equal(errors.length, mode === 'stream' ? 1 : 0);
			if (mode === 'stream') assert.match(String(errors[0]), /Tool 'probe' context validation failed/);
		});
	}

	it('uses parsed raw trusted context in injected calls and preserves absent native entries', async () => {
		const child = create.Function.asTool({ context: { factor: 1 }, inputSchema, toolContextSchema: z.object({ factor: z.string().transform(Number) }), execute: ({ value, factor }) => value * factor });
		const owner = create.Function({ tools: { child }, toolsContext: { child: { factor: '3' } }, execute: context => context.child({ value: 2 }) });
		assert.equal(await owner(), 6);
		const native = tool({ inputSchema: z.object({}), contextSchema: z.undefined().transform(() => ({ value: 7 })), execute: (_, { context }) => context.value });
		// Native Tool erases the raw context type; runtime still accepts its undefined input.
		const absent = create.Function({ tools: { native }, toolsContext: { native: undefined as never }, execute: context => context.native({}) });
		assert.equal(await absent(), 7);
	});

	it('reserves declared absent private names and actual undefined bindings', async () => {
		let entries = 0;
		const action = create.Function.asTool({ inputSchema: z.object({}), context: { token: undefined }, toolContextSchema: z.object({ user: z.string().optional() }), execute: () => { entries++; } });
		for (const input of [{ user: 'admin' }, { token: 'admin' }]) {
			await assert.rejects(action(input as never), /(?:Private input keys|Undeclared tool input keys)/);
			await assert.rejects(async () => { await action.execute(input as never, { toolCallId: 'test', messages: [], context: {} }); }, /(?:Private input keys|Undeclared tool input keys)/);
		}
		assert.equal(entries, 0);
	});

	it('does not allow an owner public field to replace an injected helper', async () => {
		const helper = tool({ inputSchema: z.object({}), execute: () => 1 });
		const owner = create.Function({ inputSchema: z.object({}).passthrough(), tools: { helper }, execute: context => context.helper({}) });
		await assert.rejects(owner({ helper: 'replacement' } as never), /Private input keys: helper/);
		assert.equal(await owner(), 1);
	});
});
