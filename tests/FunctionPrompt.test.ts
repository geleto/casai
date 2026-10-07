import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { create, ConfigError } from './cascada';
import type { Context } from './cascada';
import { z } from 'zod';
import type { ModelMessage, ToolCallOptions } from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';

chai.use(chaiAsPromised);
const { expect } = chai;

function mockModel(text: string): MockLanguageModelV3 {
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	const finishReason = { unified: 'stop', raw: 'stop' } as const;
	return new MockLanguageModelV3({
		doGenerate: {
			content: [{ type: 'text', text }],
			finishReason,
			usage,
			warnings: [],
		},
		doStream: async () => ({
			stream: convertArrayToReadableStream([
				{ type: 'stream-start', warnings: [] },
				{ type: 'text-start', id: 'text' },
				{ type: 'text-delta', id: 'text', delta: text.slice(0, text.length / 2) },
				{ type: 'text-delta', id: 'text', delta: text.slice(text.length / 2) },
				{ type: 'text-end', id: 'text' },
				{ type: 'finish', finishReason, usage },
			]),
		}),
	});
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
	const items: T[] = [];
	for await (const item of stream) {
		items.push(item);
	}
	return items;
}

describe('withFunction prompts', () => {

	const itemSchema = z.object({
		name: z.string(),
		value: z.number(),
	});

	const describeItem = (context: Context) =>
		`Generate an object with name "${context.name}" and value ${context.value}.`;

	describe('create.TextGenerator.withFunction', () => {
		it('should build the prompt from the call-time context', async () => {
			const model = mockModel('FN_TEXT');
			const generator = create.TextGenerator.withFunction({
				model,
				prompt: (context) => `Output exactly ${context.marker} and nothing else.`,
			});

			const result = await generator({ marker: 'FN_TEXT' });
			expect(result.text).to.equal('FN_TEXT');
			expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Output exactly FN_TEXT and nothing else.' },
			]);
		});

		it('should build the prompt when called without arguments', async () => {
			const model = mockModel('FN_NOARGS');
			const generator = create.TextGenerator.withFunction({
				model,
				prompt: context => {
					expect(context).to.deep.equal({});
					return 'Output exactly FN_NOARGS and nothing else.';
				},
			});

			const result = await generator();
			expect(result.text).to.equal('FN_NOARGS');
			expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Output exactly FN_NOARGS and nothing else.' },
			]);
		});

		it('should support text and message prompts on successive calls', async () => {
			const model = mockModel('FN_REPEAT');
			const generator = create.TextGenerator.withFunction({
				model,
				prompt: (context): string | ModelMessage[] => context.asMessages
					? [{ role: 'user', content: context.marker as string }]
					: context.marker as string,
			});

			await generator({ marker: 'First' });
			await generator({ marker: 'Second', asMessages: true });
			await generator({ marker: 'Third' });
			expect(model.doGenerateCalls.map(call => call.prompt[0].content)).to.deep.equal([
				[{ type: 'text', text: 'First' }],
				[{ type: 'text', text: 'Second' }],
				[{ type: 'text', text: 'Third' }],
			]);
		});

		it('should await message prompts and append them to configured history', async () => {
			const model = mockModel('FN_MESSAGES');
			const generator = create.TextGenerator.withFunction({
				model,
				messages: [{ role: 'user', content: 'Previous question' }],
				prompt: async (context): Promise<ModelMessage[]> => {
					await Promise.resolve();
					return [{ role: 'user', content: `Output ${context.marker}` }];
				},
			});

			expect((await generator({ marker: 'FN_MESSAGES' })).text).to.equal('FN_MESSAGES');
			expect(model.doGenerateCalls[0].prompt.map(message => message.content)).to.deep.equal([
				[{ type: 'text', text: 'Previous question' }],
				[{ type: 'text', text: 'Output FN_MESSAGES' }],
			]);
		});

		it('should use context, messages, and model overrides through run()', async () => {
			const model = mockModel('FN_RUN');
			const generator = create.TextGenerator.withFunction({
				model,
				context: { prefix: 'Configured' },
				inputSchema: z.object({ marker: z.string() }),
				prompt: context => `${context.prefix} ${context.marker}`,
			});

			expect((await generator.run({
				context: { marker: 'Runtime' },
				messages: [{ role: 'user', content: 'History' }],
				maxOutputTokens: 20,
			})).text).to.equal('FN_RUN');
			expect(model.doGenerateCalls[0].maxOutputTokens).to.equal(20);
			expect(model.doGenerateCalls[0].prompt.map(message => message.content)).to.deep.equal([
				[{ type: 'text', text: 'History' }],
				[{ type: 'text', text: 'Configured Runtime' }],
			]);
		});

		it('should validate call-time inputs before executing the prompt', async () => {
			const model = mockModel('unused');
			let promptCalls = 0;
			const generator = create.TextGenerator.withFunction({
				model,
				context: { marker: 'Configured' },
				inputSchema: z.object({ marker: z.string() }),
				prompt: () => { promptCalls++; return 'unused'; },
			});

			await expect(generator()).to.be.rejectedWith(ConfigError, 'Input context validation failed');
			await expect(generator({ marker: 3 })).to.be.rejectedWith(ConfigError, 'Input context validation failed');
			await expect(generator.run({ context: {} })).to.be.rejectedWith(ConfigError, 'Input context validation failed');
			expect(promptCalls).to.equal(0);
			expect(model.doGenerateCalls).to.have.lengthOf(0);
		});

		it('should replace the prompt callback for one run without changing the configured callback', async () => {
			const model = mockModel('FN_OVERRIDE');
			const originalPrompt = (context: Context) => `${context.prefix} original ${context.marker}`;
			const generator = create.TextGenerator.withFunction({
				model,
				context: { prefix: 'Configured' },
				inputSchema: z.object({ marker: z.string() }),
				prompt: originalPrompt,
			});

			const result = await generator.run({
				context: { prefix: 'Runtime', marker: 'Replacement' },
				prompt: async (context: Context): Promise<ModelMessage[]> => {
					await Promise.resolve();
					return [{ role: 'user', content: `${context.prefix} replacement ${context.marker}` }];
				},
			});
			expect(result.text).to.equal('FN_OVERRIDE');
			await generator({ marker: 'Default' });
			expect(generator.config.prompt).to.equal(originalPrompt);
			expect(model.doGenerateCalls.map(call => call.prompt[0].content)).to.deep.equal([
				[{ type: 'text', text: 'Runtime replacement Replacement' }],
				[{ type: 'text', text: 'Configured original Default' }],
			]);
		});

		it('should validate run-time prompt replacements before calling the model', async () => {
			const model = mockModel('unused');
			const generator = create.TextGenerator.withFunction({ model, prompt: () => 'Configured' });
			// @ts-expect-error A function-prompt run requires a callback instead of a string.
			await expect(generator.run({ prompt: 'Replacement' }))
				.to.be.rejectedWith(ConfigError, "The 'prompt' property must be a function");
			await expect(generator.run({
				prompt: () => [{ role: 'invalid', content: 'Invalid message' }] as never,
			})).to.be.rejectedWith(ConfigError, 'Output validation failed');
			expect(model.doGenerateCalls).to.have.lengthOf(0);
		});

		it('should propagate failures from a replacement callback', async () => {
			const model = mockModel('unused');
			const failure = new Error('Replacement failed');
			const generator = create.TextGenerator.withFunction({ model, prompt: () => 'Configured' });
			await expect(generator.run({
				prompt: async () => { await Promise.resolve(); throw failure; },
			})).to.be.rejectedWith(failure);
			expect(model.doGenerateCalls).to.have.lengthOf(0);
		});

		it('should reject positional prompt and message overrides', async () => {
			const model = mockModel('unused');
			const generator = create.TextGenerator.withFunction({ model, prompt: () => 'Configured' });

			// @ts-expect-error Function prompts accept context, not a string override.
			await expect(generator('Replacement')).to.be.rejectedWith(ConfigError, 'only accept a context object');
			await expect(generator([{ role: 'user', content: 'Replacement' }] as never))
				.to.be.rejectedWith(ConfigError, 'only accept a context object');
			expect(model.doGenerateCalls).to.have.lengthOf(0);
		});

		it('should propagate callback failures and validate returned prompts', async () => {
			const model = mockModel('unused');
			const failure = new Error('Prompt failed');
			const failingGenerator = create.TextGenerator.withFunction({
				model,
				prompt: async () => { await Promise.resolve(); throw failure; },
			});
			const invalidGenerator = create.TextGenerator.withFunction({
				model,
				prompt: () => ({ invalid: true }) as never,
			});

			await expect(failingGenerator()).to.be.rejectedWith(failure);
			await expect(invalidGenerator()).to.be.rejectedWith(ConfigError, 'Output validation failed');
			expect(model.doGenerateCalls).to.have.lengthOf(0);
		});

		it('should execute function prompts as text tools', async () => {
			const model = mockModel('FN_TOOL');
			const options: ToolCallOptions = { toolCallId: 'text-function', messages: [] };
			const parent = create.Config({ model, context: { prefix: 'Configured' } });
			const tool = create.TextGenerator.withFunction.asTool({
				inputSchema: z.object({ marker: z.string() }),
				prompt: context => {
					expect(context._toolCallOptions).to.equal(options);
					return `${context.prefix} ${context.marker}`;
				},
			}, parent);

			expect(await tool.execute({ marker: 'FN_TOOL' }, options)).to.equal('FN_TOOL');
			expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Configured FN_TOOL' },
			]);
		});
	});

	describe('create.TextStreamer.withFunction', () => {
		it('should stream text from a prompt built from the call-time context', async () => {
			const model = mockModel('FN_STREAM');
			const streamer = create.TextStreamer.withFunction({
				model,
				prompt: async context => `Output exactly ${context.marker} and nothing else.`,
			});

			const result = await streamer({ marker: 'FN_STREAM' });
			const chunks = await collect(result.textStream);
			expect(chunks.join('')).to.equal('FN_STREAM');
			expect(model.doStreamCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Output exactly FN_STREAM and nothing else.' },
			]);
		});

		it('should preserve message prompts, provider options, and streamed response history', async () => {
			const model = mockModel('FN_MESSAGES');
			const providerOptions = { anthropic: { cacheControl: { type: 'ephemeral' } } };
			const history: ModelMessage[] = [{ role: 'assistant', content: 'Previous reply' }];
			const promptMessages: ModelMessage[] = [{
				role: 'user',
				content: [
					{ type: 'text', text: 'Static prefix', providerOptions },
					{ type: 'text', text: 'Output FN_MESSAGES' },
				],
			}];
			const streamer = create.TextStreamer.withFunction({
				model,
				messages: [{ role: 'user', content: 'Configured history' }],
				prompt: async (context: Context): Promise<ModelMessage[]> => {
					await Promise.resolve();
					expect(context.marker).to.equal('FN_MESSAGES');
					return promptMessages;
				},
			});

			const result = await streamer.run({ context: { marker: 'FN_MESSAGES' }, messages: history });
			expect((await collect(result.textStream)).join('')).to.equal('FN_MESSAGES');
			expect(model.doStreamCalls[0].prompt.map(message => message.content)).to.deep.equal([
				[{ type: 'text', text: 'Configured history' }],
				[{ type: 'text', text: 'Previous reply' }],
				[
					{ type: 'text', text: 'Static prefix', providerOptions },
					{ type: 'text', text: 'Output FN_MESSAGES', providerOptions: undefined },
				],
			]);
			const response = await result.response;
			expect(response.messages).to.have.lengthOf(2);
			expect(response.messages[0]).to.deep.equal(promptMessages[0]);
			expect(response.messages[1].role).to.equal('assistant');
			expect(response.messageHistory).to.have.lengthOf(3);
			expect(response.messageHistory.slice(0, 2)).to.deep.equal([...history, ...promptMessages]);
		});

		it('should stream from a replacement callback for one run', async () => {
			const model = mockModel('FN_STREAM_OVERRIDE');
			const streamer = create.TextStreamer.withFunction({ model, prompt: () => 'Configured' });
			const overridden = await streamer.run({
				context: { marker: 'Replacement' },
				prompt: (context: Context) => `Stream ${context.marker}`,
			});
			expect((await collect(overridden.textStream)).join('')).to.equal('FN_STREAM_OVERRIDE');
			const original = await streamer();
			await collect(original.textStream);
			expect(model.doStreamCalls.map(call => call.prompt[0].content)).to.deep.equal([
				[{ type: 'text', text: 'Stream Replacement' }],
				[{ type: 'text', text: 'Configured' }],
			]);
		});
	});

	describe('create.ObjectGenerator.withFunction', () => {
		it('should merge the configured and call-time context', async () => {
			const model = mockModel('{"name":"FnObject","value":7}');
			const generator = create.ObjectGenerator.withFunction({
				model,
				schema: itemSchema,
				context: { name: 'Configured', value: 7 },
				prompt: describeItem,
			});

			const result = await generator({ name: 'FnObject' });
			expect(result.object).to.deep.equal({ name: 'FnObject', value: 7 });
			expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Generate an object with name "FnObject" and value 7.' },
			]);
		});

		it('should inherit model and context from a parent create.Config', async () => {
			const model = mockModel('{"name":"FnInherited","value":11}');
			const parent = create.Config({
				model,
				context: { value: 11 },
			});
			const generator = create.ObjectGenerator.withFunction({
				schema: itemSchema,
				prompt: describeItem,
			}, parent);

			const result = await generator({ name: 'FnInherited' });
			expect(result.object).to.deep.equal({ name: 'FnInherited', value: 11 });
			expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Generate an object with name "FnInherited" and value 11.' },
			]);
		});

		it('should execute function prompts as object tools', async () => {
			const model = mockModel('{"name":"FnTool","value":13}');
			const options: ToolCallOptions = { toolCallId: 'object-function', messages: [] };
			const parent = create.Config({ model, context: { value: 13 } });
			const tool = create.ObjectGenerator.withFunction.asTool({
				schema: itemSchema,
				inputSchema: z.object({ name: z.string() }),
				prompt: (context: Context) => {
					expect(context._toolCallOptions).to.equal(options);
					return describeItem(context);
				},
			}, parent);

			expect(tool.type).to.equal('function');
			expect(await tool.execute({ name: 'FnTool' }, options)).to.deep.equal({ name: 'FnTool', value: 13 });
			expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Generate an object with name "FnTool" and value 13.' },
			]);
		});

		it('should inherit the prompt callback and schema while overriding context', async () => {
			const model = mockModel('{"name":"FnChild","value":19}');
			const parent = create.ObjectGenerator.withFunction({
				model,
				schema: itemSchema,
				context: { name: 'Parent', value: 11 },
				prompt: describeItem,
			});
			const child = create.ObjectGenerator.withFunction({ context: { name: 'Child', value: 15 } }, parent);

			expect(child.config.prompt).to.equal(describeItem);
			expect(child.config.schema).to.equal(itemSchema);
			expect((await child({ name: 'FnChild', value: 19 })).object).to.deep.equal({ name: 'FnChild', value: 19 });
			expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Generate an object with name "FnChild" and value 19.' },
			]);
		});

		it('should use a replacement callback with the configured object output schema', async () => {
			const model = mockModel('{"name":"FnOverride","value":17}');
			const generator = create.ObjectGenerator.withFunction({
				model,
				schema: itemSchema,
				context: { value: 17 },
				prompt: () => 'Configured',
			});
			const result = await generator.run({
				context: { name: 'FnOverride' },
				prompt: describeItem,
			});
			expect(result.object).to.deep.equal({ name: 'FnOverride', value: 17 });
			expect(model.doGenerateCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Generate an object with name "FnOverride" and value 17.' },
			]);
		});
	});

	describe('create.ObjectStreamer.withFunction', () => {
		it('should merge the configured and call-time context', async () => {
			const model = mockModel('{"name":"FnStream","value":7}');
			const streamer = create.ObjectStreamer.withFunction({
				model,
				schema: itemSchema,
				context: { value: 7 },
				prompt: describeItem,
			});

			const result = await streamer({ name: 'FnStream' });
			const partials = await collect(result.partialObjectStream);
			expect(partials[partials.length - 1]).to.deep.equal({ name: 'FnStream', value: 7 });
			expect(await result.object).to.deep.equal({ name: 'FnStream', value: 7 });
			expect(model.doStreamCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Generate an object with name "FnStream" and value 7.' },
			]);
		});

		it('should stream array elements from a returned messages array', async () => {
			const model = mockModel('{"elements":[{"id":5,"item":"FromMessages"}]}');
			const providerOptions = { anthropic: { cacheControl: { type: 'ephemeral' } } };
			// Multi-part messages let a prompt mark its static prefix, e.g. with a provider cache breakpoint.
			const streamer = create.ObjectStreamer.withFunction({
				model,
				output: 'array',
				schema: z.object({ id: z.number(), item: z.string() }),
				prompt: async (context: Context): Promise<ModelMessage[]> => [{
					role: 'user',
					content: [
						{ type: 'text', text: 'Generate a JSON array with one item.', providerOptions },
						{ type: 'text', text: `The item is {id: ${context.id}, item: "${context.item}"}.` },
					],
				}],
			});

			const result = await streamer({ id: 5, item: 'FromMessages' });
			const elements = await collect(result.elementStream);
			expect(elements).to.deep.equal([{ id: 5, item: 'FromMessages' }]);
			expect(model.doStreamCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Generate a JSON array with one item.', providerOptions },
				{ type: 'text', text: 'The item is {id: 5, item: "FromMessages"}.', providerOptions: undefined },
			]);
		});

		it('should inherit model and context from a parent create.Config', async () => {
			const model = mockModel('{"name":"FnStreamInherited","value":11}');
			const parent = create.Config({
				model,
				context: { value: 11 },
			});
			const streamer = create.ObjectStreamer.withFunction({
				schema: itemSchema,
				prompt: describeItem,
			}, parent);

			const result = await streamer({ name: 'FnStreamInherited' });
			const partials = await collect(result.partialObjectStream);
			expect(partials[partials.length - 1]).to.deep.equal({ name: 'FnStreamInherited', value: 11 });
			expect(model.doStreamCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Generate an object with name "FnStreamInherited" and value 11.' },
			]);
		});

		it('should inherit array output, the prompt callback, and the element schema', async () => {
			const model = mockModel('{"elements":[{"name":"FnInheritedArray","value":23}]}');
			const prompt = async (context: Context): Promise<ModelMessage[]> => [{ role: 'user', content: describeItem(context) }];
			const parent = create.ObjectStreamer.withFunction({
				model,
				output: 'array',
				schema: itemSchema,
				context: { value: 11 },
				prompt,
			});
			const child = create.ObjectStreamer.withFunction({ context: { value: 17 } }, parent);

			expect(child.config.prompt).to.equal(prompt);
			expect(child.config.schema).to.equal(itemSchema);
			const result = await child({ name: 'FnInheritedArray', value: 23 });
			expect(await collect(result.elementStream)).to.deep.equal([{ name: 'FnInheritedArray', value: 23 }]);
			expect(model.doStreamCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Generate an object with name "FnInheritedArray" and value 23.' },
			]);
		});

		it('should stream array elements from a replacement callback', async () => {
			const model = mockModel('{"elements":[{"name":"FnStreamOverride","value":29}]}');
			const streamer = create.ObjectStreamer.withFunction({
				model,
				output: 'array',
				schema: itemSchema,
				context: { value: 29 },
				prompt: () => 'Configured',
			});
			const result = await streamer.run({
				context: { name: 'FnStreamOverride' },
				prompt: async (context: Context): Promise<ModelMessage[]> => [{ role: 'user', content: describeItem(context) }],
			});
			expect(await collect(result.elementStream)).to.deep.equal([{ name: 'FnStreamOverride', value: 29 }]);
			expect(model.doStreamCalls[0].prompt[0].content).to.deep.equal([
				{ type: 'text', text: 'Generate an object with name "FnStreamOverride" and value 29.' },
			]);
		});
	});

	it('should require function prompts and schemas at creation time', () => {
		const model = mockModel('unused');
		expect(() => create.TextGenerator.withFunction({
			model,
			// @ts-expect-error withFunction requires a callback.
			prompt: 'Invalid',
		})).to.throw(ConfigError, "The 'prompt' property must be a function");
		// @ts-expect-error Array output requires an element schema.
		expect(() => create.ObjectStreamer.withFunction({ model, output: 'array', prompt: () => 'Invalid' }))
			.to.throw(ConfigError, "An 'output' of 'array' requires a 'schema' property");
	});
});
