import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InvalidToolApprovalSignatureError, isStepCount, modelMessageSchema, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { create, ModelMessageSchema, ValidationError, z } from '../../dist/index.js';

// Opt-in experiment against separately installed, published packages. See docs/memory.md.
const [installation, phase] = process.argv.slice(2);
assert.ok(installation, 'Pass the directory containing the fixture installation.');
const requireFixture = createRequire(join(resolve(installation), 'package.json'));
const scope = { threadId: 'orders', resourceId: 'customer' };
const turnId = 'first';
const url = 'file:./memory.db';
const context = { question: 'Check my order' };
const toolsContext = { confirm: { tenant: scope.resourceId } };
const testSecret = 'memory-probe-test-key';

function checkMessageSchema() {
	assert.equal(ModelMessageSchema, modelMessageSchema);
	const metadata = { id: 'm1', ...scope, createdAt: new Date(), turnId, ordinal: 0, version: 1 };
	const message = { role: 'user', content: 'Check my order' };
	assert.deepEqual(ModelMessageSchema.parse({ ...metadata, ...message }), message);
	const withId = z.intersection(ModelMessageSchema, z.object({ id: z.string() }));
	assert.deepEqual(withId.parse({ ...metadata, ...message }), { ...message, id: 'm1' });
	const record = z.object({ id: z.string(), message: ModelMessageSchema });
	assert.deepEqual(record.parse({ id: metadata.id, message }), { id: 'm1', message });
}

function makeAgent(requestTools, effects, { secret = testSecret, orderSchema = z.string().trim() } = {}) {
	const model = new MockLanguageModelV3({
		doGenerate: async () => ({
			content: requestTools ? [
				{ type: 'tool-call', toolCallId: 'receipt-1', toolName: 'receipt', input: '{}' },
				{ type: 'tool-call', toolCallId: 'confirm-1', toolName: 'confirm', input: '{"order":"  A17  "}' },
			] : [{ type: 'text', text: 'Done' }],
			finishReason: { unified: requestTools ? 'tool-calls' : 'stop', raw: 'fixture' },
			usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } }, warnings: [],
		}),
	});
	return create.LLMAgent.withTemplate({
		model, inputSchema: z.object({ question: z.string() }), prompt: '{{ question }}',
		experimental_toolApprovalSecret: secret, stopWhen: isStepCount(1),
		toolsContext: { confirm: { tenant: 'configured-default' } },
		tools: {
			receipt: tool({ inputSchema: z.object({}), execute: () => 'received' }),
			confirm: tool({ inputSchema: z.object({ order: orderSchema }), needsApproval: true,
				contextSchema: z.object({ tenant: z.string() }),
				execute: ({ order }, options) => {
					assert.equal(options.context.tenant, scope.resourceId);
					effects.push(order);
					return order;
				} }),
		},
	});
}

// These fixtures have JSON-compatible tool inputs. Rich tool arguments need their own replay codec.
function row(message, ordinal) {
	return {
		...scope, id: JSON.stringify([scope.threadId, turnId, ordinal]),
		createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, ordinal)),
		role: message.role === 'user' ? 'user' : 'assistant',
		content: { format: 2, parts: [{ type: 'data-casai-message',
			data: { version: 1, turnId, ordinal, message: structuredClone(message) } }] },
	};
}

function parts(messages) {
	return messages.flatMap(message => Array.isArray(message.content) ? message.content : []);
}

async function writePause(store) {
	await store.saveThread({ thread: { id: scope.threadId, resourceId: scope.resourceId, title: 'Orders',
		metadata: {}, createdAt: new Date(), updatedAt: new Date() } });
	const effects = [];
	const pending = await makeAgent(true, effects).run({ context, toolsContext });
	const history = pending.messageHistory;
	assert.equal(typeof pending.response.id, 'string');
	assert.ok(pending.response.timestamp instanceof Date);
	assert.equal(history.at(-1), pending.responseMessages.at(-1));
	assert.deepEqual(effects, []);
	assert.equal(history.at(-1).role, 'tool');
	const request = parts(history).find(part => part.type === 'tool-approval-request');
	assert.ok(request.signature);
	assert.deepEqual(request.inputSchemaInput, { order: '  A17  ' });
	const messages = history.map(row);
	await store.saveMessages({ messages });
	await store.saveMessages({ messages });
	return { context, toolsContext, tailId: messages.at(-1).id, nextOrdinal: messages.length };
}

async function continuePause(store, pause) {
	const load = async () => (await store.listMessages({ ...scope, page: 0, perPage: false,
		orderBy: { field: 'createdAt', direction: 'ASC' } })).messages;
	const stored = await load();
	assert.equal(stored.length, pause.nextOrdinal);
	const history = stored.map(record => record.content.parts[0].data.message);
	const originalTail = structuredClone(history.at(-1));
	const effects = [];
	const agent = makeAgent(false, effects);
	const options = { context: pause.context, toolsContext: pause.toolsContext, approve: true };
	await assert.rejects(agent.resume(history, { approve: true }),
		error => error instanceof ValidationError && error.cause?.message.includes('"question"'));
	await assert.rejects(makeAgent(false, effects, { secret: 'different-test-key' }).resume(history, options),
		error => InvalidToolApprovalSignatureError.isInstance(error));
	const denial = await agent.resume(history, { ...options, approve: false });
	assert.ok(parts(denial.messageHistory).some(part => part.type === 'tool-approval-response' && part.approved === false));
	assert.deepEqual(effects, []);

	const reply = await agent.resume(history, options);
	assert.equal(reply.text, 'Done');
	assert.deepEqual(effects, ['A17']);
	const priorLength = history.length;
	const changedTail = reply.messageHistory[priorLength - 1];
	assert.deepEqual(history.at(-1), originalTail);
	assert.ok(parts([changedTail]).some(part => part.type === 'tool-approval-response'));
	assert.ok(!parts(reply.responseMessages).some(part => part.type === 'tool-approval-response'));

	const oldTail = stored.at(-1);
	assert.equal(oldTail.id, pause.tailId);
	const replacement = { ...oldTail, content: row(changedTail, oldTail.content.parts[0].data.ordinal).content };
	const appended = reply.messageHistory.slice(priorLength).map((message, i) => row(message, pause.nextOrdinal + i));
	const messages = [replacement, ...appended];
	await store.saveMessages({ messages });
	await store.saveMessages({ messages });
	const reloaded = await load();
	assert.equal(reloaded[priorLength - 1].id, pause.tailId);
	assert.deepEqual(reloaded.map(record => record.content.parts[0].data.message), JSON.parse(JSON.stringify(reply.messageHistory)));

	await agent.resume(history, options);
	assert.deepEqual(effects, ['A17', 'A17']);
	console.log('Reloaded pause: changed tool row retained its ID; the write retry retained the row count; replaying the pending approval executed the tool twice.');
}

async function richApprovalInput() {
	const settings = { orderSchema: z.string().transform(() => new Date('2026-01-17T00:00:00Z')) };
	const effects = [];
	const pending = await makeAgent(true, effects, settings).run({ context, toolsContext });
	const original = pending.messageHistory;
	const call = parts(original).find(part => part.type === 'tool-call' && part.toolName === 'confirm');
	assert.ok(call.input.order instanceof Date);
	const agent = makeAgent(false, effects, settings);
	const options = { context, toolsContext, approve: true };
	await assert.rejects(agent.resume(JSON.parse(JSON.stringify(original)), options),
		error => InvalidToolApprovalSignatureError.isInstance(error));
	assert.deepEqual(effects, []);
	await agent.resume(original, options);
	assert.deepEqual(effects, [new Date('2026-01-17T00:00:00Z')]);
	console.log('A signed native Date resumed with its type intact; plain JSON changed it and the SDK rejected the signature.');
}

async function observationConflicts(store, otherStore) {
	const initial = await store.initializeObservationalMemory({ ...scope, scope: 'thread', config: {} });
	const base = { id: initial.id, tokenCount: 2, lastObservedAt: new Date(),
		expectedActiveObservations: initial.activeObservations };
	const results = await Promise.all([
		store.commitActiveObservations({ ...base, observations: 'First update' }),
		otherStore.commitActiveObservations({ ...base, observations: 'Second update' }),
	]);
	assert.equal(results.filter(result => result.applied).length, 1);
	assert.ok(results.some(result => result.reason === 'conflict'));
	const current = await store.getObservationalMemory(scope.threadId, scope.resourceId);
	const head = await store.createReflectionGeneration({ currentRecord: current, reflection: 'Compacted', tokenCount: 1 });
	const stale = await otherStore.commitActiveObservations({ ...base, observations: 'Changed after retirement' });
	assert.deepEqual(stale, { applied: false, reason: 'retired' });
	assert.equal((await otherStore.getObservationalMemory(scope.threadId, scope.resourceId)).id, head.id);
	console.log('Two connections competing for one observation produced one commit and one conflict; the retired generation rejected a later write.');
}

async function filteredSearch(vector, namespace) {
	const indexName = 'recall';
	const target = namespace ? { indexName, namespace } : { indexName };
	await vector.createIndex({ indexName, dimension: 2 });
	const entries = Array.from({ length: 80 }, (_, i) => ({
		id: 'foreign-' + i, embedding: [1, 0], metadata: { owner: 'other', day: 4 },
	}));
	entries.push(
		{ id: 'expired', embedding: [1, 0], metadata: { owner: scope.resourceId, day: 1 } },
		{ id: 'eligible', embedding: [0.8, 0.2], metadata: { owner: scope.resourceId, day: 4 } },
	);
	await vector.upsert({ ...target, ids: entries.map(entry => entry.id), vectors: entries.map(entry => entry.embedding),
		metadata: entries.map(entry => entry.metadata) });
	const hits = await vector.query({ ...target, queryVector: [1, 0], topK: 1,
		filter: { $and: [{ owner: { $eq: scope.resourceId } }, { day: { $gte: 3 } }] } });
	assert.deepEqual(hits.map(hit => hit.id), ['eligible']);
	console.log('The vector search returned the eligible row despite 81 closer, excluded rows.');
}

async function postgres() {
	const connectionString = process.env.CASAI_MEMORY_TEST_POSTGRES_URL;
	assert.ok(connectionString, 'Set CASAI_MEMORY_TEST_POSTGRES_URL to a disposable PostgreSQL database with pgvector available.');
	const { MemoryPG, PgVector } = requireFixture('@mastra/pg');
	const { Pool } = createRequire(requireFixture.resolve('@mastra/pg'))('pg');
	const schemaName = 'cm_' + randomUUID().slice(0, 8);
	const pools = [new Pool({ connectionString }), new Pool({ connectionString })];
	let vector;
	try {
		await pools[0].query('CREATE SCHEMA ' + schemaName);
		const stores = pools.map(pool => new MemoryPG({ pool, schemaName }));
		for (const store of stores) await store.init();
		const pause = await writePause(stores[0]);
		await continuePause(stores[1], pause);
		await Promise.all(stores.map((store, index) => store.updateThreadMetadata({
			id: scope.threadId, resourceId: scope.resourceId,
			update: thread => ({ ...thread.metadata, ['writer' + index]: true }),
		})));
		const { metadata } = await stores[0].getThreadById(scope);
		assert.equal(metadata.writer0, true);
		assert.equal(metadata.writer1, true);
		await Promise.all(stores.map((store, index) => store.mergeResourceWorkingMemory({
			resourceId: scope.resourceId, merge: existing => (existing ?? '') + index,
		})));
		const profile = await stores[0].getResourceById({ resourceId: scope.resourceId });
		assert.deepEqual([...profile.workingMemory].sort(), ['0', '1']);
		await observationConflicts(...stores);

		vector = new PgVector({ id: 'probe', connectionString, schemaName });
		await filteredSearch(vector, 'first');
		const indexName = 'recall';
		await vector.upsert({ indexName, namespace: 'second', ids: ['eligible'], vectors: [[1, 0]], metadata: [{ copy: true }] });
		await vector.deleteVector({ indexName, namespace: 'first', id: 'eligible' });
		const query = { indexName, queryVector: [1, 0], topK: 1 };
		assert.equal((await vector.query({ ...query, namespace: 'first', filter: { owner: scope.resourceId, day: 4 } })).length, 0);
		assert.equal((await vector.query({ ...query, namespace: 'second' }))[0].metadata.copy, true);
		const { rows } = await pools[0].query("SELECT current_setting('server_version') AS pg, extversion FROM pg_extension WHERE extname = 'vector'");
		console.log('PostgreSQL ' + rows[0].pg + ', pgvector ' + rows[0].extversion + ': concurrent profile updates and namespace-scoped deletion passed.');
	} finally {
		try { await vector?.disconnect(); } finally { await Promise.all(pools.map(pool => pool.end())); }
	}
}

async function embeddingRequests() {
	const { InMemoryStore } = requireFixture('@mastra/core/storage');
	const { Memory } = requireFixture('@mastra/memory');
	const storage = new InMemoryStore();
	const requests = [];
	const model = { specificationVersion: 'v4', provider: 'fixture', modelId: 'batch',
		maxEmbeddingsPerCall: 8, supportsParallelCalls: true,
		async doEmbed({ values }) {
			requests.push([...values]);
			return { embeddings: values.map(() => [1, 0]), usage: { tokens: values.length }, warnings: [] };
		} };
	const vector = { id: 'fixture', async createIndex() {}, async upsert({ ids }) { return ids; } };
	const memory = new Memory({ storage, vector, embedder: model, options: { semanticRecall: { scope: 'thread' } } });
	await memory.saveThread({ thread: { id: scope.threadId, resourceId: scope.resourceId, title: 'Batch',
		metadata: {}, createdAt: new Date(), updatedAt: new Date() } });
	const texts = Array.from({ length: 32 }, (_, i) => 'item ' + i);
	await memory.saveMessages({ messages: texts.map((text, i) => ({ ...row({ role: 'user', content: text }, i),
		content: { format: 2, parts: [{ type: 'text', text }] } })) });
	assert.deepEqual(requests.map(values => values.length), Array(32).fill(1));
	assert.deepEqual(requests.flat().sort(), [...texts].sort());
	requests.length = 0;
	const result = await create.Embedder({ model })(texts);
	assert.equal(result.embeddings.length, texts.length);
	assert.deepEqual(requests.map(values => values.length), [8, 8, 8, 8]);
	assert.deepEqual(requests.flat().sort(), [...texts].sort());
	console.log('32 short inputs: Mastra Memory issued 32 single-item requests; one Casai Embedder array call issued four SDK batches of eight.');
}

checkMessageSchema();
if (phase === 'postgres') {
	await postgres();
} else if (phase === 'bundles') {
	const { build } = await import('esbuild');
	for (const [pkg, names] of [
		['@mastra/pg', 'PgVector'], ['@mastra/libsql', 'LibSQLVector'],
		['@mastra/libsql', 'MemoryLibSQL, LibSQLVector'],
	]) {
		const result = await build({
			stdin: { contents: 'export { ' + names + ' } from ' + JSON.stringify(pkg), resolveDir: resolve(installation) },
			bundle: true, format: 'esm', platform: 'node', target: 'node24', minify: true,
			external: ['pg-native', '@libsql/client'], write: false,
		});
		console.log(names, result.outputFiles[0].contents.byteLength, 'bytes');
	}
} else if (!phase) {
	const root = resolve(tmpdir());
	const directory = mkdtempSync(join(root, 'casai-memory-plan-'));
	try {
		for (const step of ['write', 'read']) {
			execFileSync(process.execPath, [fileURLToPath(import.meta.url), resolve(installation), step],
				{ cwd: directory, stdio: 'inherit' });
		}
	} finally {
		assert.equal(dirname(directory), root);
		rmSync(directory, { recursive: true, force: true });
	}
} else {
	const { createClient } = requireFixture('@libsql/client');
	const { MemoryLibSQL, LibSQLVector } = requireFixture('@mastra/libsql');
	const client = createClient({ url });
	const store = new MemoryLibSQL({ client });
	try {
		await store.init();
		if (phase === 'write') writeFileSync('pause.json', JSON.stringify(await writePause(store)));
		else {
			assert.equal(phase, 'read');
			await continuePause(store, JSON.parse(readFileSync('pause.json', 'utf8')));
			await richApprovalInput();
			const otherClient = createClient({ url });
			try {
				const otherStore = new MemoryLibSQL({ client: otherClient });
				await otherStore.init();
				await observationConflicts(store, otherStore);
			} finally { otherClient.close(); }
			const vector = new LibSQLVector({ id: 'probe', url });
			try { await filteredSearch(vector); } finally { await vector.close(); }
			await embeddingRequests();
		}
	} finally { client.close(); }
}
