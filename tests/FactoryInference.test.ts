/* eslint-disable no-constant-condition -- Unreachable branches verify compile-time errors. */
import { expect } from 'chai';
import { create, z } from './cascada';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { Output } from 'ai';

function mockModel(text: string): MockLanguageModelV3 {
	const finishReason = { unified: 'stop', raw: 'stop' } as const;
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	return new MockLanguageModelV3({
		doGenerate: { content: [{ type: 'text', text }], finishReason, usage, warnings: [] },
		doStream: async () => ({
			stream: convertArrayToReadableStream([
				{ type: 'stream-start', warnings: [] },
				{ type: 'text-start', id: 'text' },
				{ type: 'text-delta', id: 'text', delta: text },
				{ type: 'text-end', id: 'text' },
				{ type: 'finish', finishReason, usage },
			]),
		}),
	});
}

// An object stream resolves its final object after the stream is consumed.
async function streamedObject<T>(result: { partialObjectStream: AsyncIterable<unknown>, object: PromiseLike<T> }): Promise<T> {
	for await (const _partial of result.partialObjectStream) { /* consume */ }
	return await result.object;
}

function userPrompt(model: MockLanguageModelV3, streaming = false): unknown {
	const calls = streaming ? model.doStreamCalls : model.doGenerateCalls;
	return calls[0].prompt.find(message => message.role === 'user')?.content;
}

// TypeScript checks a call before it types inline callbacks; configs must still be inferred from them.
describe('Factory inference with inline callbacks', () => {
	const schema = z.object({ answer: z.number() });
	const answer = '{"answer":4}';

	it('should pass schema-typed completion events through object generators, streamers and run overrides', async () => {
		const completed: number[] = [];
		const parent = create.Config({ model: mockModel(answer), schema });
		const generator = create.ObjectGenerator({ prompt: 'Answer.', onFinish: event => {
			if (event.object) completed.push(event.object.answer);
		} }, parent);
		const streamer = create.ObjectStreamer({ prompt: 'Answer.', onFinish: event => {
			if (event.object) completed.push(event.object.answer);
		} }, parent);
		expect((await generator()).object.answer).to.equal(4);
		expect(await streamedObject(streamer())).to.deep.equal({ answer: 4 });
		expect(await streamedObject(streamer.run({ onFinish: event => {
			if (event.object) completed.push(event.object.answer * 2);
		} }))).to.deep.equal({ answer: 4 });
		expect(completed).to.deep.equal([4, 4, 8]);
	});

	it('should retain structured text output and runtime context in callbacks and result methods', async () => {
		const finished: number[] = [];
		const parent = create.Config({ model: mockModel(answer), output: Output.object({ schema }), runtimeContext: { requestId: 'request' } });
		const generator = create.TextGenerator({ prompt: 'Answer.', onStepEnd: event => {
			expect(event.runtimeContext.requestId).to.equal('request');
		} }, parent);
		const streamer = create.TextStreamer({ prompt: 'Answer.', onEnd: event => {
			if (event.output) finished.push(event.output.answer);
			expect(event.runtimeContext.requestId).to.equal('request');
		} }, parent);
		expect((await generator()).output.answer).to.equal(4);
		const result = streamer();
		expect((await result.output).answer).to.equal(4);
		expect((await result.finalStep).runtimeContext.requestId).to.equal('request');
		expect(finished).to.deep.equal([4]);
		const uiResult = streamer.run({ onEnd: event => {
			if (event.output) finished.push(event.output.answer * 2);
		} });
		const uiResponse = uiResult.toUIMessageStreamResponse({ onEnd: event => {
			expect(event.responseMessage.role).to.equal('assistant');
		}, messageMetadata: () => ({ requestId: 'request' }) });
		expect(await uiResponse.text()).to.include('request');
		expect(finished).to.deep.equal([4, 8]);
	});

	it('should infer object generator configs with inline callbacks under a parent', async () => {
		const generator = create.ObjectGenerator({
			schema, prompt: 'Answer.', maxOutputTokens: 7,
			onStart: event => {
				if (false) {
					// @ts-expect-error The callback event is typed, not any.
					const _event: number = event;
				}
			},
		}, create.Config({ model: mockModel(answer) }));
		const maxOutputTokens: number = generator.config.maxOutputTokens;
		const result: number = (await generator()).object.answer;
		expect([maxOutputTokens, result]).to.deep.equal([7, 4]);
		if (false) {
			// @ts-expect-error The child's own properties stay typed.
			const _tokens: string = generator.config.maxOutputTokens;
		}
	});

	it('should infer inline function prompts for object generators and streamers under a parent', async () => {
		const model = mockModel(answer);
		const streamModel = mockModel(answer);
		const generator = create.ObjectGenerator.withFunction({
			schema, context: { topic: 'math' }, prompt: context => `Answer about ${context.topic}.`,
		}, create.Config({ model }));
		const streamer = create.ObjectStreamer.withFunction({
			schema, context: { topic: 'math' }, prompt: context => `Stream about ${context.topic}.`,
		}, create.Config({ model: streamModel }));
		expect((await generator()).object).to.deep.equal({ answer: 4 });
		expect(await streamedObject(await streamer())).to.deep.equal({ answer: 4 });
		expect(userPrompt(model)).to.deep.equal([{ type: 'text', text: 'Answer about math.' }]);
		expect(userPrompt(streamModel, true)).to.deep.equal([{ type: 'text', text: 'Stream about math.' }]);
	});

	it('should infer object streamer configs with inline callbacks', async () => {
		const streamer = create.ObjectStreamer.withTemplate({
			model: mockModel(answer), schema, prompt: 'Answer about {{ topic }}.', context: { topic: 'math' }, maxOutputTokens: 7,
			onStart: event => {
				if (false) {
					// @ts-expect-error The callback event is typed, not any.
					const _event: number = event;
				}
			},
		});
		const maxOutputTokens: number = streamer.config.maxOutputTokens;
		expect(maxOutputTokens).to.equal(7);
		expect(await streamedObject(await streamer())).to.deep.equal({ answer: 4 });
	});

	it('should let template object tools inherit their input schema', async () => {
		const parent = create.Config({ model: mockModel(answer), inputSchema: z.object({ topic: z.string() }) });
		const tool = create.ObjectGenerator.withTemplate.asTool({ schema, prompt: 'Answer about {{ topic }}.', description: 'Answers' }, parent);
		const result = await tool.execute({ topic: 'math' }, { toolCallId: 'answer', messages: [], context: undefined });
		expect(result).to.deep.equal({ answer: 4 });
	});

	it('should type inline callbacks in Config fragments for every component they fit', async () => {
		const started: string[] = [];
		const shared = create.Config({
			model: mockModel(answer),
			onStart: event => {
				if (false) {
					// @ts-expect-error The event is typed for text and object generators, not any.
					const _event: number = event;
				}
				started.push(typeof event);
			},
		});
		const text = create.TextGenerator({ prompt: 'Answer.' }, shared);
		const object = create.ObjectGenerator({ prompt: 'Answer.', schema }, shared);
		expect((await text()).text).to.equal(answer);
		expect((await object()).object).to.deep.equal({ answer: 4 });
		expect(started).to.deep.equal(['object', 'object']);
	});

	it('should type renderer tool inputs from their final input schema', async () => {
		const inputSchema = z.object({ value: z.number() });
		const options = { toolCallId: 'input', messages: [], context: undefined };
		const template = create.Template.asTool({ inputSchema, template: '{{ value }}' });
		const generator = create.TextGenerator.asTool({ model: mockModel('TEXT'), inputSchema, prompt: 'Answer.' });
		const replaced = create.Template.asTool({ inputSchema: z.object({ label: z.string() }) }, create.Config({ inputSchema, template: '{{ label }}' }));
		expect(await template.execute({ value: 2 }, options)).to.equal('2');
		expect(await generator.execute({ value: 2 }, options)).to.equal('TEXT');
		expect(await replaced.execute({ label: 'child' }, options)).to.equal('child');
		if (false) {
			// @ts-expect-error The template schema requires a number.
			await template.execute({ value: 'wrong' }, options);
			// @ts-expect-error The generator schema requires a number.
			await generator.execute({ value: 'wrong' }, options);
			// @ts-expect-error The child replaced the parent's input schema.
			await replaced.execute({ value: 2 }, options);
		}
	});

	it('should still validate a child config that has inline callbacks', () => {
		const events: unknown[] = [];
		if (false) {
			// @ts-expect-error The final object generator config has no schema.
			create.ObjectGenerator({ prompt: 'Answer.', onStart: event => events.push(event) }, create.Config({ model: mockModel(answer) }));
			// @ts-expect-error Unknown properties are rejected alongside inline callbacks.
			create.ObjectStreamer.withFunction({ schema, prompt: () => 'Answer.', template: 'x' }, create.Config({ model: mockModel(answer) }));
		}
	});
});
