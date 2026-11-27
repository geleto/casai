import assert from 'node:assert/strict';
import { createHook } from 'node:async_hooks';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { create, ValidationError } from '../src/index.js';
import { resamplePcm16 } from '../src/audio/pcm.js';
import { sdkPcm as expected } from './pcm-reference.js';
import { createPcmWorker } from '../src/audio/pcm-worker.node.js';
import { createStreamResampler, resamplePcm16Range } from '../src/audio/pcm-resample.js';

// V8 coverage instruments every worker. The two bulk probes assert scheduling progress independently of total runtime.
const bulkFixtureTimeout = process.env.NODE_V8_COVERAGE ? 45000 : 15000;

function fixture(mode: string, timeout = 15000) {
	return promisify(execFile)(process.execPath, ['--import', 'tsx/esm', '--conditions=casai-source',
		fileURLToPath(new URL('./fixtures/pcm-workers.mjs', import.meta.url)), mode], { timeout });
}

describe('Automatic PCM resampling workers', function () {
	this.timeout(20000);
	it('matches native SDK interpolation across partition boundaries and the final sample', () => {
		const input = Uint8Array.from({ length: 2018 }, (_, i) => i % 256);
		for (const [from, to] of [[44100, 24000], [24000, 44100]]) {
			const whole = expected(input, from, to), count = whole.length / 2, ratio = from / to;
			assert.deepEqual(resamplePcm16Range(input, ratio, 0, count), whole);
			const start = Math.floor(count / 3), inputStart = Math.floor(start * ratio);
			assert.deepEqual(resamplePcm16Range(input.subarray(inputStart * 2), ratio, start, count - start, inputStart, input.length / 2), whole.subarray(start * 2));
			const storage = new Uint8Array(new SharedArrayBuffer(whole.length + 6)).fill(173);
			const output = storage.subarray(3, -3);
			assert.equal(resamplePcm16Range(input, ratio, 0, count, 0, input.length / 2, output), output);
			assert.deepEqual(output, whole);
			assert.deepEqual(storage.subarray(0, 3), Uint8Array.of(173, 173, 173));
			assert.deepEqual(storage.subarray(-3), Uint8Array.of(173, 173, 173));
		}
	});
	it('preserves identity and validates before creating workers', async () => {
		let workers = 0;
		const hook = createHook({ init(_id, type) { if (type === 'WORKER') workers++; } }).enable();
		try {
			const input = Uint8Array.from({ length: 2018 }, (_, i) => i % 256);
			assert.equal(await resamplePcm16(input, 24000, 24000), input);
			await assert.rejects(resamplePcm16(new Uint8Array(3), 48000, 24000), ValidationError);
			await assert.rejects(resamplePcm16(input, 0, 24000), ValidationError);
			assert.equal(workers, 0);
		} finally { hook.disable(); }
	});
	it('keeps split PCM samples and rounding independent across interleaved streams', () => {
		// These partitions cross both PCM sample bytes and downsampling groups.
		const bytes = Uint8Array.from({ length: 110 }, (_, i) => (i * 127 + 7) % 256);
		const streams = [2, 3, 8].map(ratio => ({ ratio, process: createStreamResampler(), chunks: [] as Uint8Array[] }));
		let start = 0;
		for (const length of [1, 1, 5, 2, 47, 54]) {
			for (const stream of streams) stream.chunks.push(stream.process(bytes.subarray(start, start + length), stream.ratio));
			start += length;
		}
		for (const stream of streams) {
			stream.chunks.push(stream.process(undefined, stream.ratio));
			assert.deepEqual(new Uint8Array(Buffer.concat(stream.chunks)), expected(bytes, 24000 * stream.ratio, 24000));
		}
		const partial = createStreamResampler();
		partial(bytes.subarray(0, 1), 2);
		assert.throws(() => partial(undefined, 2), ValidationError);
	});
	it('uses one worker even when there is too little work to distribute across cores', async () => {
		await fixture('single');
	});
	it('honors the default budget, partitions fractional rates and reuses workers without detaching borrowed Buffers', async () => {
		await fixture('bulk', bulkFixtureTimeout);
	}).timeout(bulkFixtureTimeout + 5000);
	it('joins in a worker when shared memory is unavailable', async () => {
		await fixture('unshared');
	});
	it('bounds preparation across large, small, empty and base64 chunks with worker staging allocations', async () => {
		await fixture('copy-budget');
	});
	it('reuses read-only shared input across PCM, WAV, resampling and completed-result operations', async () => {
		await fixture('shared-input');
	});
	it('copies shared audio in a worker for binary transport and Web APIs', async () => {
		await fixture('transport');
	});
	it('releases idle workers automatically and restarts them on demand', async () => {
		await fixture('idle');
	});
	it('rejects worker failures without blocking fallback and permits a later independent call', async () => {
		await fixture('failure');
	});
	for (const cores of ['pool', 'single']) it(`schedules short results between bounded resampling jobs with ${cores} capacity`, async () => {
		await fixture(`scheduling-${cores}`);
	});
	it('streams bounded chunks through one ordered worker without additional source read-ahead', async () => {
		await fixture('stream');
	});
	it('uses bounded shared chunks even when a streaming downsampling group exceeds 32 KiB', async () => {
		await fixture('stream-ratio');
	});
	it('keeps timers and Cascada responsive during finite and streamed processing', async () => {
		const { stdout } = await fixture('responsive', bulkFixtureTimeout);
		assert.match(stdout, /responsiveness verified/);
	}).timeout(bulkFixtureTimeout + 5000);
	it('keeps Node alive during conversion and allows exit without caller cleanup', async () => {
		const result = fixture('exit');
		let deadline: ReturnType<typeof setTimeout> | undefined;
		// The fixture prints only its completion marker. Package startup and processing
		// are outside this deadline; idle workers must not keep Node alive for five seconds.
		result.child.stdout!.once('data', () => { deadline = setTimeout(() => result.child.kill(), 4000); });
		try { assert.match((await result).stdout, /completed/); }
		finally { clearTimeout(deadline); }
	});
	it('transports native processing failures without textifying results', async () => {
		let worker!: ReturnType<typeof createPcmWorker>;
		try {
			const response = await new Promise<unknown>((resolve, reject) => {
				worker = createPcmWorker(message => { resolve('error' in message ? message.error : message.value); }, reject);
				worker.postMessage({ type: 'resample', args: [new Uint8Array(2), 2, 0, -1] }, []);
			});
			assert(response instanceof RangeError);
		} finally { await worker.close(); }
	});
	it('composes the asynchronous helper directly from Cascada', async () => {
		const audio = Uint8Array.from({ length: 2 * 1024 * 1024 + 18 }, (_, i) => i % 256);
		const script = create.Script({ context: { resamplePcm16, audio }, script: 'return resamplePcm16(audio, 44100, 24000)' });
		assert.deepEqual(await script(), expected(audio, 44100, 24000));
	});
});
