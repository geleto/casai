import assert from 'node:assert/strict';
import { asSchema, generateImage, generateText } from 'ai';
import { validateTypes } from '@ai-sdk/provider-utils';
import { MockImageModelV4, MockLanguageModelV4 } from 'ai/test';
import { create, z, ValidationError } from './cascada';
import { runtimeRun } from './fixtures/runtime-call.js';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
function fixture() {
	const requests: Parameters<MockImageModelV4['doGenerate']>[0][] = [];
	const model = new MockImageModelV4({ maxImagesPerCall: 10, doGenerate: async request => {
		requests.push(request);
		return { images: Array.from({ length: request.n }, () => png), warnings: [], response: { timestamp: new Date(0), modelId: 'image', headers: {} } };
	} });
	return { model, requests };
}

describe('ImageGenerator: native dispatch and public tool boundary', () => {
	it('selects a complete source before object-instance application context', async () => {
		class ApplicationInput { subject = 'tree'; }
		const { model, requests } = fixture();
		const image = create.ImageGenerator.withTemplate({ model, prompt: 'configured {{ subject }}',
			inputSchema: z.object({ subject: z.string() }) });
		const context = new ApplicationInput();
		const prompt = { text: '{{ subject }}', images: [png] };
		await image(prompt, context);
		await image.run({ prompt, context });
		await generateImage({ model, prompt: { text: 'tree', images: [png] } });
		assert.deepEqual(requests[0], requests[2]);
		assert.deepEqual(requests[1], requests[2]);
		assert.equal(context.subject, 'tree');
	});

	it('keeps binary masks separate from source and application context', async () => {
		const { model, requests } = fixture();
		await generateImage({ model, prompt: { text: 'configured', images: [png], mask: png } });
		const native = requests[0];
		const image = create.ImageGenerator({ model, prompt: 'configured', images: [png] });
		const prepared = create.ImageGenerator.withFunction({ model, images: [png],
			inputSchema: z.object({ subject: z.string().default('configured') }), prompt: ({ subject }) => subject });
		const template = create.ImageGenerator.withTemplate({ model, images: [png],
			inputSchema: z.object({ subject: z.string() }), prompt: '{{ subject }}' });
		for (const mask of [png, png.buffer]) {
			await image(mask);
			await image(undefined, mask);
			await image.run({ mask });
			await prepared(mask);
			await prepared(undefined, mask);
			await prepared({ subject: 'configured' }, mask);
			await prepared(({ subject }) => subject, { subject: 'configured' }, mask);
			await template({ subject: 'configured' }, mask);
			await template({ text: '{{ subject }}', images: [png] }, { subject: 'configured' }, undefined, mask);
		}
		for (const request of requests.slice(1)) {
			assert.equal(request.prompt, native.prompt);
			assert.deepEqual(request.files, native.files);
			assert.deepEqual(request.mask, native.mask);
		}
	});

	it('keeps source and public context distinct across a union of source modes', async () => {
		const { model, requests } = fixture();
		const inputSchema = z.object({ text: z.string(), images: z.array(z.instanceof(Uint8Array)) });
		for (const template of [false, true]) {
			const config = template ? { model, promptType: 'async-template' as const, prompt: { text: '{{ text }}', images: [png] }, inputSchema }
				: { model, promptType: 'text' as const, context: { text: 'private binding' } };
			await create.ImageGenerator(config)({ text: 'new', images: [png] });
			if (!template) assert.equal(config.context?.text, 'private binding');
		}
		assert.deepEqual(requests.map(request => [request.prompt, request.files?.length]), [['new', 1], ['new', 1]]);
	});

	it('preserves native results, configured media and invocation replacement rules', async () => {
		const { model, requests } = fixture();
		const prompt = Object.freeze({ text: 'base', images: [png], mask: png });
		const image = create.ImageGenerator({ model, prompt });
		const result = await image('new');
		assert.equal(result.images[0].mediaType, 'image/png');
		assert.equal(requests[0].prompt, 'new');
		assert.equal(requests[0].files?.length, 1);
		assert.ok(requests[0].mask);
		await image.run({ prompt: 'clear', images: [] });
		assert.equal(requests[1].files, undefined);
		assert.equal(requests[1].mask, undefined);
		await image.run({ prompt: { images: [] } });
		assert.deepEqual(requests[2].files, []);
		assert.equal(requests[2].prompt, undefined);
		await assert.rejects(runtimeRun(image, { images: [], mask: png }), ValidationError);
		await assert.rejects(runtimeRun(image, { prompt: { images: [png] }, images: [] }), /requires prompt text/);
		assert.equal(image.config.prompt, prompt);
		assert.equal(prompt.text, 'base');
		const prepared = create.ImageGenerator.withFunction({ model, prompt: () => prompt });
		await prepared.run({ prompt: () => 'replacement', images: [] });
		assert.equal(requests.at(-1)?.prompt, 'replacement');
		assert.equal(requests.at(-1)?.files, undefined);
	});

	it('applies the same field overrides to literal, template, function and script bundles', async () => {
		const { model, requests } = fixture();
		const replacement = new Uint8Array([...png, 1]);
		const bundle = Object.freeze({ text: 'base', images: [png], mask: png });
		let preparations = 0;
		const components = [
			create.ImageGenerator({ model, prompt: bundle }),
			create.ImageGenerator.withTemplate({ model, prompt: bundle }),
			create.ImageGenerator.withFunction({ model, prompt: () => { preparations++; return bundle; } }),
			create.ImageGenerator.withScript({ model, prompt: 'return bundle', context: { bundle } }),
		];
		for (const component of components) {
			for (const [settings, prompt] of [
				[{ mask: replacement }, { ...bundle, mask: replacement }],
				[{ images: [replacement] }, { text: 'base', images: [replacement] }],
				[{ images: [replacement], mask: replacement }, { text: 'base', images: [replacement], mask: replacement }],
				[{ images: [] }, 'base'],
			] as const) {
				await runtimeRun(component, settings);
				await generateImage({ model, prompt: prompt as Parameters<typeof generateImage>[0]['prompt'] });
				assert.deepEqual(requests.at(-2), requests.at(-1));
			}
		}
		assert.equal(preparations, 4);
		assert.equal(bundle.mask, png);
		assert.deepEqual(bundle.images, [png]);
	});

	it('parses public tool text once, keeps media out of metadata and dispatches once on SDK and injected paths', async () => {
		const { model, requests } = fixture();
		let parses = 0;
		const inputSchema = z.object({ prompt: z.string().transform(value => { parses++; return value.trim().toUpperCase(); }) });
		const draw = create.ImageGenerator.asTool({ model, prompt: { text: 'default', images: [png], mask: png }, inputSchema,
			providerOptions: { fixture: { style: 'retained' } } });
		const metadata = await asSchema(draw.inputSchema).jsonSchema;
		assert.equal(JSON.stringify(metadata).includes('137'), false);
		assert.equal(draw.providerOptions, undefined);
		assert.equal(draw.config.inputSchema, inputSchema);
		const parsed = await validateTypes({ value: { prompt: '  first  ' }, schema: draw.inputSchema });
		const payload = await draw.execute(parsed, { toolCallId: 'direct', messages: [], context: undefined });
		assert.deepEqual(payload, [{ mediaType: 'image/png', base64: Buffer.from(png).toString('base64') }]);
		assert.equal(parses, 1);
		assert.equal(requests.length, 1);
		assert.equal(requests[0].prompt, 'FIRST');
		assert.ok(requests[0].mask);
		const workflow = create.Function({ tools: { draw }, execute: ({ draw }) => draw({ prompt: ' second ' }) });
		await workflow();
		assert.equal(parses, 2);
		assert.equal(requests[1].prompt, 'SECOND');
		const language = new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: 'tool-call', toolCallId: 'native', toolName: 'draw', input: '{"prompt":" third "}' }], finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] }) });
		await generateText({ model: language, prompt: 'draw', tools: { draw } });
		assert.equal(parses, 3);
		assert.equal(requests[2].prompt, 'THIRD');
		assert.equal(requests.length, 3);
		const privateName = create.ImageGenerator.asTool({ model, prompt: 'authored', inputSchema: z.object({}), context: { prompt: 'private binding' } });
		await privateName.execute({}, { toolCallId: 'fixed', messages: [], context: undefined });
		assert.equal(requests[3].prompt, 'authored');
		const synthesized = create.ImageGenerator.asTool({ model, prompt: 'authored',
			inputSchema: z.object({}).transform(() => ({ prompt: 'application data' })) });
		const application = await validateTypes({ value: {}, schema: synthesized.inputSchema });
		await synthesized.execute(application, { toolCallId: 'synthesized', messages: [], context: undefined });
		assert.equal(requests[4].prompt, 'authored');
	});

	it('compares complete configured empty native inputs with the SDK', async () => {
		const { model, requests } = fixture();
		await generateImage({ model, prompt: { images: [] } });
		await create.ImageGenerator({ model, prompt: { images: [] } })();
		assert.deepEqual(requests[1], requests[0]);
		const draw = create.ImageGenerator.asTool({ model, prompt: { text: 'configured', images: [png], mask: png },
			inputSchema: z.object({ prompt: z.string().transform(() => ({ images: [] })) }) });
		const input = await validateTypes({ value: { prompt: 'replace' }, schema: draw.inputSchema });
		await draw.execute(input, { toolCallId: 'bundle', messages: [], context: undefined });
		assert.deepEqual(requests[2], requests[0]);
	});

	it('supports image-only edits and keeps configuration inheritance distinct from call-time replacement', async () => {
		const { model, requests } = fixture();
		const parent = create.ImageGenerator({ model, images: [png], mask: png });
		const child = create.ImageGenerator({ images: [png] }, parent);
		await child();
		assert.ok(requests[0].mask);
		await child.run({ images: [png] });
		assert.equal(requests[1].mask, undefined);
		await create.ImageGenerator({ model }).run({ images: [png] });
		assert.equal(requests[2].prompt, undefined);
		const configuredBundle = create.ImageGenerator.withTemplate({ model, prompt: { images: [], text: '{{ subject }}' }, images: [png], mask: png });
		await configuredBundle({ subject: 'native empty bundle' });
		assert.deepEqual(requests[3].files, []);
		assert.equal(requests[3].mask, undefined);
		const imageTool = create.ImageGenerator.asTool({ model, images: [png], inputSchema: z.object({}) });
		await create.Function({ tools: { imageTool }, execute: ({ imageTool }) => imageTool({}) })();
		assert.equal(requests[4].prompt, undefined);
		assert.equal(requests[4].files?.length, 1);
	});

	it('keeps authored input outside payload validation and never promotes configuration into public defaults', async () => {
		const { model, requests } = fixture();
		const parsed: unknown[] = [];
		const inputSchema = z.object({ prompt: z.string().transform(value => { parsed.push(value); return value.toUpperCase(); }) });
		const image = create.ImageGenerator.asTool({ model, prompt: 'authored', context: { prompt: 'public default', password: 'secret' }, inputSchema });
		await image('ordinary source');
		assert.equal(requests[0].prompt, 'ordinary source');
		await image.run({ prompt: 'named source', context: { prompt: 'payload' } });
		assert.equal(requests[1].prompt, 'named source');
		const owner = create.Function({ tools: { image }, execute: ({ image }) => image({}) });
		await owner();
		assert.equal(requests[2].prompt, 'PUBLIC DEFAULT');
		assert.deepEqual(parsed, ['public default', 'payload', 'public default']);
		assert.equal(image.config.prompt, 'authored');
		assert.deepEqual(image.config.context, { prompt: 'public default', password: 'secret' });
		const missing = create.ImageGenerator.asTool({ model, prompt: 'not a payload default', inputSchema });
		await assert.rejects(runtimeRun(missing, { prompt: 'also authored' }), ValidationError);
		assert.deepEqual((await asSchema(missing.inputSchema).jsonSchema).required, ['prompt']);
		assert.equal(requests.length, 3);
	});

	it('merges declared public defaults before parsing and protects private context across bound tool calls', async () => {
		const { model, requests } = fixture();
		const seen: unknown[] = [];
		const draw = create.ImageGenerator.withFunction.asTool({ model, inputSchema: z.object({ prompt: z.string(), language: z.string() }).transform(value => { seen.push(value); return value; }),
			context: { prompt: 'configured', language: 'en', username: 'server', password: 'secret' },
			prompt: ({ prompt, language, username, password }) => `${prompt}/${language}/${username}/${password}` });
		const owner = create.Function({ tools: { draw }, toolsContext: { draw: { language: 'fr', username: 'bound' } }, execute: ({ draw }) => draw({ prompt: 'payload' }) });
		await owner();
		assert.equal(requests[0].prompt, 'payload/fr/bound/secret');
		assert.deepEqual(seen, [{ prompt: 'payload', language: 'fr' }]);
		const attack = create.Function({ tools: { draw }, execute: ({ draw }) => Reflect.apply(draw, undefined, [{ username: 'attacker' }]) });
		await assert.rejects(attack(), ValidationError);
		assert.equal(requests.length, 1);
	});

	it('keeps image fields separate from plain tool payloads and named omission', async () => {
		const { model, requests } = fixture();
		const reference = new Uint8Array([1, 2]);
		const mask = new Uint8Array([3, 4]);
		const image = create.ImageGenerator.asTool({ model, prompt: { text: 'authored', images: [reference], mask },
			context: { prompt: 'default' }, inputSchema: z.object({ prompt: z.string().transform(text => text.toUpperCase()) }) });
		await image({ prompt: 'payload' });
		assert.equal(requests[0].prompt, 'PAYLOAD');
		await image({ prompt: 'replacement' }, [reference]);
		assert.equal(requests[1].prompt, 'REPLACEMENT');
		assert.equal(requests[1].mask, undefined);
		await create.Script({ script: 'return image.run(mask=mask)', context: { image, mask } })();
		assert.equal(requests[2].prompt, 'DEFAULT');
		await image.run({ prompt: { text: 'explicit', images: [reference] }, context: { prompt: 'payload' } });
		assert.equal(requests[3].prompt, 'explicit');
		assert.equal(requests[3].mask, undefined);
		await generateImage({ model, prompt: { text: 'native', images: [reference], mask } });
		assert.deepEqual(requests[0].mask, requests[4].mask);
		assert.deepEqual(requests[2].mask, requests[4].mask);
		assert.deepEqual(requests[2].files, requests[4].files);
	});
});
