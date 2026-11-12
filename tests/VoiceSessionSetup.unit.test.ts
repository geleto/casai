import { sourceModes } from './fixtures/source-modes.js';
import assert from 'node:assert/strict';
import { createOpenAI } from '@ai-sdk/openai';
import { tool, UnsupportedFunctionalityError } from 'ai';
import { create, z, ValidationError } from './cascada';

function provider() {
	const requests: { url: string; body: Record<string, Record<string, unknown>>; signal: AbortSignal | null | undefined }[] = [];
	const openai = createOpenAI({ apiKey: 'fixture-only', fetch: async (url, options) => {
		const address = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
		assert.equal(typeof options?.body, 'string');
		requests.push({ url: address, body: JSON.parse(options!.body as string) as Record<string, Record<string, unknown>>, signal: options?.signal });
		return Response.json(address.endsWith('/live/sessions')
			? { session: { id: 'session' }, transport: { type: 'webrtc', sdp: 'answer' } }
			: { value: 'token', expires_at: 1234 });
	} });
	return { openai, requests };
}

describe('experimental voice session setup', () => {
	it('omits cleared and conditional settings before native Live setup', async () => {
		const { openai, requests } = provider();
		const model = openai.experimental_realtime('live-model', { api: 'live' });
		await assert.rejects(model.doCreateWebRTCSession({ sdp: 'offer', sessionConfig: { turnDetection: undefined } }), /OpenAI Live session setting: turnDetection/);
		const parent = create.VoiceSessionSetup({ model, instructions: 'old', turnDetection: null, inputAudioTranscription: { model: 'whisper-1' } });
		const cleared = create.VoiceSessionSetup({ instructions: undefined, turnDetection: undefined, inputAudioTranscription: undefined }, parent);
		assert.deepEqual(await cleared.prepareSessionConfig(), {});
		await cleared.createWebRTCSession({ sdp: 'offer' });
		const conditional = create.VoiceSessionSetup({ model, instructions: 'policy', turnDetection: undefined, inputAudioTranscription: undefined });
		assert.deepEqual(await conditional.prepareSessionConfig(), { instructions: 'policy' });
		await conditional.createWebRTCSession({ sdp: 'offer' });
		assert.equal(requests.length, 2);
		assert.equal(Object.hasOwn(requests[0].body.session, 'turnDetection'), false);
		assert.equal(Object.hasOwn(requests[1].body.session, 'inputAudioTranscription'), false);
		await assert.rejects(conditional.createWebRTCSession({ sdp: 'offer', turnDetection: null }), /OpenAI Live session setting: turnDetection/);
	});

	it('rebinds tool dependencies without requiring or preparing session instructions', async () => {
		const { openai, requests } = provider();
		const lookup = create.Function.asTool({ inputSchema: z.object({}), context: { db: (): string => 'configured' }, execute: ({ db }) => db() });
		const setup = create.VoiceSessionSetup.withFunction({ model: openai.experimental_realtime('gpt-realtime'),
			inputSchema: z.object({ company: z.string() }), instructions: ({ company }) => { throw new Error(`Unexpected preparation for ${company}`); }, tools: { lookup } });
		const call = { toolCallId: 'lookup-call', toolName: 'lookup' as const, args: {} };
		assert.equal(await setup.executeTool(call), 'configured');
		assert.equal(await setup.executeTool(call, { toolsContext: { lookup: { db: () => 'replacement' } } }), 'replacement');
		assert.equal(await setup.executeTool(call), 'configured');
		assert.equal(requests.length, 0);
	});

	it('shares safe named settings across literal and prepared session sources', async () => {
		const { openai } = provider();
		const model = openai.experimental_realtime('gpt-realtime');
		for (const prepared of [false, true]) {
			const config = prepared ? { model, ...sourceModes.function.config, instructions: () => 'ready' }
				: { model, ...sourceModes.text.config };
			const session = create.VoiceSessionSetup(config);
			const settings = await session.prepareSessionConfig({ voice: 'alloy' });
			assert.equal(settings.voice, 'alloy');
			assert.equal(settings.instructions, prepared ? 'ready' : undefined);
			assert.equal((await session.run({ voice: 'alloy' })).token, 'token');
		}
	});

	it('keeps the captured model fixed across every session entry point', async () => {
		const { openai, requests } = provider();
		const model = openai.experimental_realtime('gpt-realtime');
		const setup = create.VoiceSessionSetup({ model });
		for (const [method, settings] of [[setup.run, { model }], [setup.prepareSessionConfig, { model }], [setup.createWebRTCSession, { model, sdp: 'offer' }]] as const) {
			await assert.rejects(async () => { await Reflect.apply(method, undefined, [settings]); }, /Configuration-only.*model/);
		}
		assert.equal(requests.length, 0);
	});

	it('renders instructions, uses native token creation and exposes prepared definitions with bound defaults', async () => {
		const { openai, requests } = provider();
		const lookup = create.Function.asTool({ inputSchema: z.object({ key: z.string(), language: z.string() }),
			context: { language: 'en', secret: 'private' }, execute: ({ key, language, secret }) => ({ key, language, secret }) });
		const setup = create.VoiceSessionSetup.withTemplate({ model: openai.experimental_realtime('gpt-realtime'),
			instructions: 'Help {{ name }}', inputSchema: z.object({ name: z.string() }),
			tools: { lookup }, toolsContext: { lookup: { language: 'fr' } }, expiresAfterSeconds: 60 });
		const result = await setup({ name: 'Ada' });
		assert.equal(result.token, 'token');
		assert.equal(result.expiresAt, 1234);
		assert.deepEqual(result.tools[0].parameters.required, ['key']);
		assert.equal(JSON.stringify(result.tools).includes('private'), false);
		assert.equal(requests[0].body.session.instructions, 'Help Ada');
		assert.equal(requests[0].body.expires_after.seconds, 60);
		assert.equal(requests[0].signal, undefined);
		assert.deepEqual(await setup.executeTool({ toolCallId: 'call', toolName: 'lookup', args: { key: 'x' } }), { key: 'x', language: 'fr', secret: 'private' });
		const config = await setup.prepareSessionConfig({ context: { name: 'Grace' }, voice: 'alloy', turnDetection: null });
		assert.equal(config.instructions, 'Help Grace');
		assert.equal(config.voice, 'alloy');
		assert.equal(config.turnDetection, null);
		assert.equal(requests.length, 1);
	});

	it('omits empty tools for Live WebRTC and leaves provider capability limits intact', async () => {
		const { openai, requests } = provider();
		const model = openai.experimental_realtime('live-model', { api: 'live' });
		const setup = create.VoiceSessionSetup({ model, instructions: 'Server policy' });
		assert.deepEqual(await setup.prepareSessionConfig(), { instructions: 'Server policy' });
		const signal = new AbortController().signal;
		assert.deepEqual(await setup.createWebRTCSession({ sdp: 'offer', abortSignal: signal }), { sessionId: 'session', sdp: 'answer' });
		assert.equal(requests[0].body.session.instructions, 'Server policy');
		assert.equal(requests[0].body.transport.sdp, 'offer');
		assert.equal(requests[0].signal, signal);
		assert.equal(Object.hasOwn(requests[0].body.session, 'tools'), false);
		await assert.rejects(setup(), UnsupportedFunctionalityError);
		const lookup = create.Function.asTool({ inputSchema: z.object({}), execute: () => 'ok' });
		const withTools = create.VoiceSessionSetup({ tools: { lookup } }, setup);
		await assert.rejects(withTools.createWebRTCSession({ sdp: 'offer' }), /OpenAI Live session setting: tools/);
		const legacy = create.VoiceSessionSetup({ model: openai.experimental_realtime('gpt-realtime') });
		await assert.rejects(legacy.createWebRTCSession({ sdp: 'offer' }), UnsupportedFunctionalityError);
		assert.equal(requests.length, 1);
		assert.equal((await model.getServerWebSocketConfig()).url, 'wss://api.openai.com/v1/live/sessions');
	});

	it('snapshots WebRTC offers before asynchronous session preparation', async () => {
		const { openai, requests } = provider();
		let release!: () => void;
		const ready = new Promise<void>(resolve => { release = resolve; });
		const setup = create.VoiceSessionSetup.withFunction({
			model: openai.experimental_realtime('live-model', { api: 'live' }),
			instructions: async () => { await ready; return 'Server policy'; },
		});
		const settings = { sdp: 'first' };
		const first = setup.createWebRTCSession(settings);
		settings.sdp = 'second';
		const second = setup.createWebRTCSession(settings);
		release();
		await Promise.all([first, second]);
		assert.deepEqual(requests.map(request => request.body.transport.sdp), ['first', 'second']);
		assert.equal(settings.sdp, 'second');
	});

	it('executes with actual call metadata, validates raw arguments and isolates trusted context per call', async () => {
		const { openai } = provider();
		let parses = 0;
		const metadata: unknown[] = [];
		const lookup = create.Function.asTool({ context: { language: 'en', username: 'server', password: 'server-secret' },
			inputSchema: z.object({ query: z.string().transform(value => { parses++; return value.trim(); }), language: z.string() }),
			toolContextSchema: z.object({ username: z.string(), language: z.string() }),
			toModelOutput: () => { throw new Error('Language-model conversion must not run.'); },
			execute: ({ query, username, password, language, _toolOptions }) => {
				metadata.push(_toolOptions);
				return { query, username, password, language };
			} });
		const setup = create.VoiceSessionSetup({ model: openai.experimental_realtime('gpt-realtime'), tools: { lookup },
			toolsContext: { lookup: { username: 'alice', language: 'fr' } } });
		const signal = new AbortController().signal;
		const [alice, bob] = await Promise.all([
			setup.executeTool({ toolCallId: 'alice-call', toolName: 'lookup', args: { query: ' first ', language: 'de' } }, { abortSignal: signal }),
			setup.executeTool({ toolCallId: 'bob-call', toolName: 'lookup', args: { query: ' second ' } }, { toolsContext: { lookup: { username: 'bob', language: 'es' } } }),
		]);
		assert.deepEqual(alice, { query: 'first', username: 'alice', password: 'server-secret', language: 'de' });
		assert.deepEqual(bob, { query: 'second', username: 'bob', password: 'server-secret', language: 'es' });
		assert.equal(parses, 2);
		assert.ok(metadata.some(value => (value as { toolCallId: string }).toolCallId === 'alice-call'));
		assert.ok(metadata.some(value => (value as { abortSignal?: AbortSignal }).abortSignal === signal));
		await assert.rejects(setup.executeTool({ toolCallId: 'attack', toolName: 'lookup', args: { query: 'x', password: 'changed' } }), ValidationError);
		assert.equal(parses, 2);
		assert.equal(lookup.config.context.password, 'server-secret');
	});

	it('uses native executable-tool normalization and preserves undefined, errors and cancellation', async () => {
		const { openai } = provider();
		const failure = new Error('execution failed');
		const observed: unknown[] = [];
		const native = tool({ inputSchema: z.object({ count: z.string().transform(Number) }), contextSchema: z.object({ user: z.string() }),
			execute: async function* ({ count }, options) { observed.push({ count, ...options }); yield 'partial'; yield 'final'; } });
		const empty = create.Function.asTool({ inputSchema: z.object({}), execute: () => undefined });
		const fail = create.Function.asTool({ inputSchema: z.object({}), execute: () => { throw failure; } });
		const unavailable = tool({ inputSchema: z.object({}) });
		const setup = create.VoiceSessionSetup({ model: openai.experimental_realtime('gpt-realtime'),
			tools: { native, empty, fail, unavailable }, toolsContext: { native: { user: 'alice' } } });
		assert.equal(await setup.executeTool({ toolName: 'native', toolCallId: 'native-id', args: { count: '2' } }), 'final');
		assert.deepEqual(observed, [{ count: 2, toolCallId: 'native-id', messages: [], abortSignal: undefined, context: { user: 'alice' } }]);
		assert.equal(await setup.executeTool({ toolName: 'empty', toolCallId: 'empty-id', args: {} }), undefined);
		await assert.rejects(setup.executeTool({ toolName: 'fail', toolCallId: 'fail-id', args: {} }), error => error === failure);
		await assert.rejects(setup.executeTool({ toolName: 'unavailable', toolCallId: 'id', args: {} }), ValidationError);
		const controller = new AbortController(); controller.abort(failure);
		await assert.rejects(setup.executeTool({ toolName: 'empty', toolCallId: 'id', args: {} }, { abortSignal: controller.signal }), error => error === failure);
		await assert.rejects(setup.run({ abortSignal: controller.signal }), error => error === failure);
	});
});
