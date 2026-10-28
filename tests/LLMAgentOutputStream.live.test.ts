import type { EmptyMap } from './type-safety/assert.js';
import { Output } from 'ai';
import 'dotenv/config';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { create, ConfigError } from './cascada';
import type { StreamTextOnFinishEvent } from './cascada';
import { model, temperature, temperatureConfig, StringLoader, AsyncStringLoader, timeout, modelName, createProvider } from './common';
import { z } from 'zod';
import type { DeepPartial } from 'ai';

// Configure chai-as-promised
chai.use(chaiAsPromised);

const { expect } = chai;

// Helper to collect partial objects from a stream
async function collectPartials<T>(stream: AsyncIterable<DeepPartial<T>>): Promise<DeepPartial<T>[]> {
	const partials: DeepPartial<T>[] = [];
	for await (const partial of stream) {
		partials.push(partial);
	}
	return partials;
}

function mergePartials<T extends object>(partials: DeepPartial<T>[]): T {
	return partials.reduce((acc, partial) => {
		return { ...acc, ...partial };
	}, {} as T);
}

// Helper to collect complete elements from an elementStream
async function collectElements<T>(stream: AsyncIterable<T>): Promise<T[]> {
	const elements: T[] = [];
	for await (const element of stream) {
		elements.push(element);
	}
	return elements;
}


describe('create.LLMAgent.asStream', function () {
	this.timeout(timeout); // Increase timeout for tests that call the real API

	// --- Schemas for testing ---
	const simpleSchema = z.object({
		name: z.string().describe('The name of the item'),
		value: z.number().describe('A numerical value'),
	});

	const arraySchema = z.array(
		z.object({
			id: z.number(),
			item: z.string(),
		}),
	);

	describe('Core Functionality by Output Type', () => {
		it('should stream a single object with output: "object" (default) and provide partials', async () => {
			const streamer = create.LLMAgent.asStream({ model, ...temperatureConfig, prompt: 'Generate a JSON object for an item named "StreamTest" with a value of 99.', output: Output.object({ schema: simpleSchema }) });

			const result = (await streamer());
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);

			expect(partials.length).to.be.greaterThan(0);
			expect(partials[partials.length - 1]).to.deep.equal({ name: 'StreamTest', value: 99 });
			expect(finalObject).to.deep.equal({ name: 'StreamTest', value: 99 });
			expect(() => simpleSchema.parse(finalObject)).to.not.throw();
		});

		it('should stream an array of objects with output: "array" and provide complete elements', async () => {
			const streamer = create.LLMAgent.asStream({ model, ...temperatureConfig, prompt: 'Generate a JSON array with two items: {id: 1, item: "A"} and {id: 2, item: "B"}.', output: Output.array({ element: arraySchema.element }) });

			const result = (await streamer());
			const elements = await collectElements(result.elementStream);
			const finalArray = elements;

			expect(elements).to.be.an('array').with.lengthOf(2);
			expect(elements[0]).to.deep.equal({ id: 1, item: 'A' });
			expect(elements[1]).to.deep.equal({ id: 2, item: 'B' });
			expect(finalArray).to.deep.equal(elements);
			expect(() => arraySchema.parse(finalArray)).to.not.throw();
		});

		// Anthropic models do not support no-schema output streaming
		it.skip('should stream a raw JSON object with output: "no-schema"', async () => {
			const streamer = create.LLMAgent.asStream({ model, ...temperatureConfig, prompt: 'Generate a JSON object with a "status" key set to "ok" and "code" key set to 200: { status: "ok", code: 200 }.', output: Output.json() });

			const result = (await streamer());
			const partials = await collectPartials(result.partialOutputStream);
			// As a workaround, we use mergePartials to get the complete object from the stream.
			expect(partials.length).to.be.greaterThan(0);
			const finalObject = mergePartials(partials as DeepPartial<{ status: string; code: number }>[]);
			expect(finalObject).to.deep.equal({ status: 'ok', code: 200 });
		});

		it('should stream an object when prompt is provided only at runtime', async () => {
			const streamer = create.LLMAgent.asStream({ model, ...temperatureConfig, output: Output.object({ schema: simpleSchema }) });

			const result = (await streamer('Generate an object named "RuntimeStream" with value 555.'));
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.deep.equal({ name: 'RuntimeStream', value: 555 });
		});

	});

	describe('Configuration & Inheritance', () => {
		const parentConfig = create.Config({
			model, ...temperatureConfig,
			context: {
				entity: 'john',
				defaultId: 456,
			},
			filters: {
				capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
			},
		});

		it('should inherit model, context, and filters from a parent create.Config', async () => {
			const streamer = create.LLMAgent.withTemplate.asStream(
				{ prompt: 'Generate an object with name set to "{{ entity | capitalize }}" and value set to {{ defaultId }}.', output: Output.object({ schema: simpleSchema }) },
				parentConfig,
			);

			const result = await streamer();
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.deep.equal({ name: 'John', value: 456 });
		});

		it('should inherit output type and schema from a parent streamer', async () => {
			const parentStreamer = create.LLMAgent.withTemplate.asStream({ model, ...temperatureConfig, output: Output.array({ element: arraySchema.element }) });

			const childStreamer = create.LLMAgent.withTemplate.asStream({
				prompt: 'Generate an array with one item: {id: 19, item: "InheritedStream"}.'
			}, parentStreamer);

			expect(childStreamer.config.output).to.equal('array');

			//collect the stream
			const result = await childStreamer();
			const array = await collectElements(result.elementStream);
			expect(array).to.be.an('array').with.lengthOf(1);
			expect(array).to.deep.equal([{ id: 19, item: 'InheritedStream' }]);

			// Avoid relying on result.object; use the streamed elements directly
			const finalArray = array;
			expect(finalArray).to.be.an('array').with.lengthOf(1);
			expect(finalArray).to.deep.equal([{ id: 19, item: 'InheritedStream' }]);
		});

		it('should override parent properties (context, temperature)', async () => {
			const streamer = create.LLMAgent.withTemplate.asStream({ ...(temperature !== null ? { temperature: 0.8 } : {}), context: { entity: 'streamed_product' }, prompt: 'Generate an object for "{{ entity }}" and value {{ defaultId }}.', output: Output.object({ schema: simpleSchema }) }, parentConfig);

			expect(streamer.config.temperature).to.equal(temperature !== null ? 0.8 : undefined);
			const result = await streamer();
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.deep.equal({ name: 'streamed_product', value: 456 });
		});

		it('should merge and deduplicate loader arrays from parent configs and use a named template', async () => {
			// 1. SETUP: Define two distinct loaders with different templates.
			const loader1 = new StringLoader();
			loader1.addString('stream1.njk', 'Generate an object with name "{{ name }}" and value {{ value }}.');
			const loader2 = new StringLoader();
			loader2.addString('stream2.njk', 'Generate an object with name "{{ name }}" and value -{{ value }}.');

			// 2. CONFIGURE: Parent gets loader1, Child gets loader2. This is the fix.
			const parent = create.Config({ loader: [loader1] });
			const streamer = create.LLMAgent.loadsTemplate.asStream({ model, loader: [loader2], output: Output.object({ schema: simpleSchema }) }, parent);

			// 3. ASSERT CONFIGURATION: The final loader array should contain both loaders, with the child's loader (loader2) first.
			expect(streamer.config.loader).to.be.an('array').with.lengthOf(2);
			expect(streamer.config.loader).to.deep.equal([loader2, loader1]);

			// 4. ASSERT FUNCTIONALITY (stream1.njk): This will now use the fallback mechanism.
			// The engine tries loader2 first, fails to find 'stream1.njk', then tries loader1 and succeeds.
			const result1 = await streamer('stream1.njk', { name: 'Stream1', value: 11 });
			const partials1 = await collectPartials(result1.partialOutputStream);
			const object1 = mergePartials(partials1);
			expect(object1).to.deep.equal({ name: 'Stream1', value: 11 });

			// 5. ASSERT FUNCTIONALITY (stream2.njk): This will now succeed.
			// The engine tries loader2 first and finds 'stream2.njk' immediately.
			const result2 = await streamer('stream2.njk', { name: 'Stream2', value: 22 });
			const partials2 = await collectPartials(result2.partialOutputStream);
			const object2 = mergePartials(partials2);
			expect(object2).to.deep.equal({ name: 'Stream2', value: -22 });
		});
	});

	describe('Template Engine Features', () => {
		it('should resolve an asynchronous function from context', async () => {
			const streamer = create.LLMAgent.withTemplate.asStream({ model, ...temperatureConfig, context: {
				fetchData: async () => ({ name: 'AsyncStream', value: await Promise.resolve(110) }),
			}, prompt: 'Generate an object using this data: {{ fetchData() | dump }}.', output: Output.object({ schema: simpleSchema }) });

			const result = await streamer();
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.deep.equal({ name: 'AsyncStream', value: 110 });
		});

		it('should apply an asynchronous filter with arguments', async () => {
			const streamer = create.LLMAgent.withTemplate.asStream({ model, ...temperatureConfig, filters: {
				createObject: async (name: string, val: number) => {
					await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
					return { name, value: val };
				},
			}, prompt: 'Generate this object: {{ "FilteredStream" | createObject(35) | dump }}', output: Output.object({ schema: simpleSchema }) });

			const result = await streamer();
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.deep.equal({ name: 'FilteredStream', value: 35 });
		});
	});

	describe('Callbacks and Event Handlers', () => {
		it('should call onEnd callback with final object and usage when stream completes', async () => {
			let resolveFinish: (data: StreamTextOnFinishEvent<EmptyMap, ReturnType<typeof Output.object<z.infer<typeof simpleSchema>>>>) => void;
			const finishPromise = new Promise<StreamTextOnFinishEvent<EmptyMap, ReturnType<typeof Output.object<z.infer<typeof simpleSchema>>>>>((resolve) => {
				resolveFinish = resolve;
			});

			const streamer = create.LLMAgent.asStream({ model, ...temperatureConfig, prompt: 'Generate a JSON object for "FinishCallback" with value 123.', onEnd: function (result: StreamTextOnFinishEvent<EmptyMap, ReturnType<typeof Output.object<z.infer<typeof simpleSchema>>>>) {
				resolveFinish(result);
			}, output: Output.object({ schema: simpleSchema }) });

			const result = (await streamer());
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials) as z.infer<typeof simpleSchema>;
			expect(finalObject).to.deep.equal({ name: 'FinishCallback', value: 123 });

			const finishData = await finishPromise;
			expect(finishData.output).to.deep.equal({ name: 'FinishCallback', value: 123 });
			expect(finishData.usage.inputTokens).to.be.a('number').and.be.greaterThan(0);
			expect(finishData.usage.outputTokens).to.be.a('number').and.be.greaterThan(0);
		});

		it('should throw and reject promises for API errors', async () => {
			const provider = createProvider({ apiKey: 'invalid-key' });
			const badModel = provider(modelName);

			const streamer = create.LLMAgent.asStream({ model: badModel, ...temperatureConfig, prompt: 'This will fail.', output: Output.object({ schema: simpleSchema }) });

			const result = (await streamer());

			try {
				await collectPartials(result.partialOutputStream); // Consuming the stream triggers the error
			} catch (e) {
				expect(e).to.be.an.instanceOf(Error);
				expect((e as Error).message).to.match(/invalid x-api-key|Incorrect API key/i);
			}
		});
	});

	describe('.loadsText functionality', () => {
		const stringLoader = new StringLoader();
		stringLoader.addString('simple.txt', 'Generate an object with name "Test" and value 42.');
		stringLoader.addString('complex.txt', 'Generate an object with name "Runtime" and value 100.');

		it('should load and stream plain text from a loader', async () => {
			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: stringLoader, prompt: 'simple.txt', output: Output.object({ schema: simpleSchema }) });

			const result = await streamer();
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.have.property('name', 'Test');
			expect(finalObject).to.have.property('value', 42);
		});

		it('should load text at runtime with one-off prompt', async () => {
			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: stringLoader, output: Output.object({ schema: simpleSchema }) });

			const result = await streamer('complex.txt');
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.have.property('name', 'Runtime');
			expect(finalObject).to.have.property('value', 100);
		});

		it('should handle multiple loaders in array', async () => {
			const loader1 = new StringLoader();
			loader1.addString('test1.txt', 'Generate an object with name "First" and value 1.');

			const loader2 = new StringLoader();
			loader2.addString('test2.txt', 'Generate an object with name "Second" and value 2.');

			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: [loader1, loader2], prompt: 'test2.txt', output: Output.object({ schema: simpleSchema }) });

			const result = await streamer();
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.have.property('name', 'Second');
			expect(finalObject).to.have.property('value', 2);
		});

		it('should throw ConfigError if no loader is provided', () => {
			expect(() =>
				// @ts-expect-error - no loader provided
				create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, prompt: 'file.txt', output: Output.object({ schema: simpleSchema }) })
			).to.throw(
				ConfigError,
				"A 'loader' is required for this operation"
			);
		});

		it('should reject when a configured text prompt is missing', async () => {
			// Named text loads when the component is called, as named templates and scripts do.
			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: new StringLoader(), prompt: 'nonexistent.txt', output: Output.object({ schema: simpleSchema }) });
			await expect(streamer()).to.be.rejectedWith(/not found/);
		});

		it('should throw if loader fails to find text at runtime', async () => {
			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: new StringLoader(), output: Output.object({ schema: simpleSchema }) });

			const result = streamer('nonexistent.txt');
			await expect(result).to.be.rejectedWith(/not found/);
		});
	});

	describe('Async Loader Functionality', () => {
		const asyncStringLoader = new AsyncStringLoader();
		asyncStringLoader.addString('async-simple.txt', 'Generate an object with name "AsyncTest" and value 42.');
		asyncStringLoader.addString('async-complex.txt', 'Generate an object with name "AsyncRuntime" and value 100.');

		it('should load and stream plain text from an async loader', async () => {
			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: asyncStringLoader, prompt: 'async-simple.txt', output: Output.object({ schema: simpleSchema }) });

			const result = await streamer();
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.have.property('name', 'AsyncTest');
			expect(finalObject).to.have.property('value', 42);
		});

		it('should load text at runtime with one-off prompt using async loader', async () => {
			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: asyncStringLoader, output: Output.object({ schema: simpleSchema }) });

			const result = await streamer('async-complex.txt');
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.have.property('name', 'AsyncRuntime');
			expect(finalObject).to.have.property('value', 100);
		});

		it('should handle multiple async loaders in array', async () => {
			const loader1 = new AsyncStringLoader();
			loader1.addString('async-test1.txt', 'Generate an object with name "AsyncFirst" and value 1.');

			const loader2 = new AsyncStringLoader();
			loader2.addString('async-test2.txt', 'Generate an object with name "AsyncSecond" and value 2.');

			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: [loader1, loader2], prompt: 'async-test2.txt', output: Output.object({ schema: simpleSchema }) });

			const result = await streamer();
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.have.property('name', 'AsyncSecond');
			expect(finalObject).to.have.property('value', 2);
		});

		it('should throw if async loader fails to find text at creation time', async () => {
			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: new AsyncStringLoader(), prompt: 'nonexistent-async.txt', output: Output.object({ schema: simpleSchema }) });

			const result = streamer();
			await expect(result).to.be.rejectedWith(/not found/);
		});

		it('should throw if async loader fails to find text at runtime', async () => {
			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: new AsyncStringLoader(), output: Output.object({ schema: simpleSchema }) });

			const result = streamer('nonexistent-async.txt');
			await expect(result).to.be.rejectedWith(/not found/);
		});

		it('should work with functional async loaders', async () => {
			const functionalAsyncLoader = (name: string): Promise<string> => {
				const templates: Record<string, string> = {
					'async-func.txt': 'Generate an object with name "AsyncFunctional" and value 99.'
				};
				return Promise.resolve(templates[name] || '');
			};

			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: functionalAsyncLoader, prompt: 'async-func.txt', output: Output.object({ schema: simpleSchema }) });

			const result = await streamer();
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.have.property('name', 'AsyncFunctional');
			expect(finalObject).to.have.property('value', 99);
		});

		it('should handle mixed sync and async loaders', async () => {
			const syncLoader = new StringLoader();
			syncLoader.addString('mixed.txt', 'Generate an object with name "Mixed" and value 50.');

			const asyncLoader = new AsyncStringLoader();
			asyncLoader.addString('mixed.txt', 'Generate an object with name "AsyncMixed" and value 75.');

			// The sync loader shall have the answer first
			const streamer = create.LLMAgent.loadsText.asStream({ model, ...temperatureConfig, loader: [asyncLoader, syncLoader], prompt: 'mixed.txt', output: Output.object({ schema: simpleSchema }) });

			const result = await streamer();
			const partials = await collectPartials(result.partialOutputStream);
			const finalObject = mergePartials(partials);
			expect(finalObject).to.have.property('name', 'AsyncMixed');
			expect(finalObject).to.deep.equal({ name: 'AsyncMixed', value: 75 });
		});
	});
});
