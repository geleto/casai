// Run with a separate installation of PGlite and its pgvector extension. See docs/memory.md.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { text as readText } from 'node:stream/consumers';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const [installation, serverInstallation, databaseDirectory] = process.argv.slice(2);
assert.ok(installation, 'Pass the directory containing the browser database packages.');
if (serverInstallation && !databaseDirectory) {
	// The native SQLite handle can keep a file locked until its process exits on Windows.
	const tempRoot = resolve(tmpdir());
	const directory = await mkdtemp(join(tempRoot, 'casai-shared-browser-memory-'));
	try {
		execFileSync(process.execPath, [fileURLToPath(import.meta.url), resolve(installation), resolve(serverInstallation), directory],
			{ stdio: 'inherit' });
	} finally {
		assert.equal(dirname(directory), tempRoot);
		await rm(directory, { recursive: true, force: true });
	}
	process.exit(0);
}
const requireDatabase = createRequire(join(resolve(installation), 'package.json'));
const assets = {
	pg: dirname(requireDatabase.resolve('@electric-sql/pglite')),
	vec: dirname(requireDatabase.resolve('@electric-sql/pglite-pgvector')),
};
const { chromium } = createRequire(import.meta.resolve('cascada-engine'))('playwright');
const casai = await build({
	stdin: { contents: "export { ModelMessageSchema } from 'casai';", resolveDir: process.cwd() },
	platform: 'browser', bundle: true, format: 'esm', write: false,
});

// The host binds each test login to an owner. Only the native message travels back to the browser.
const sessions = new Map(['alice', 'alice', 'bob'].map(owner => ['Bearer ' + randomUUID(), owner]));
let sharedStore;
let serverClient;
const server = createServer(async (request, response) => {
	const path = request.url.split('?')[0];
	if (path === '/history' && sharedStore) {
		const resourceId = sessions.get(request.headers.authorization);
		if (!resourceId) return response.writeHead(401).end();
		const threadId = 'returns-' + resourceId;
		try {
			if (request.method === 'POST') {
				const message = { role: 'user', content: await readText(request) };
				await sharedStore.saveMessages({ messages: [{
					threadId, resourceId, id: threadId + '/turn/0', role: 'user', createdAt: new Date(),
					content: { format: 2, parts: [{ type: 'data-casai-message', data: { version: 1, turnId: 'turn', ordinal: 0, message } }] },
				}] });
				return response.writeHead(204).end();
			}
			if (request.method !== 'GET') return response.writeHead(405).end();
			const { messages } = await sharedStore.listMessages({ threadId, resourceId, page: 0, perPage: false });
			response.setHeader('content-type', 'application/json');
			return response.end(JSON.stringify(messages.map(row => row.content.parts[0].data.message)));
		} catch (error) {
			console.error(error);
			return response.writeHead(500).end();
		}
	}
	if (path === '/') {
		response.setHeader('content-type', 'text/html');
		return response.end('<!doctype html><title>Casai Memory database probe</title>');
	}
	if (path === '/casai.js') {
		response.setHeader('content-type', 'text/javascript');
		return response.end(casai.outputFiles[0].contents);
	}
	const asset = /^\/(pg|vec)\/([\w-]+(?:\.[\w-]+)+)$/.exec(path);
	if (asset) {
		try {
			const bytes = await readFile(join(assets[asset[1]], asset[2]));
			const type = { '.js': 'text/javascript', '.wasm': 'application/wasm' }[extname(asset[2])];
			response.setHeader('content-type', type ?? 'application/octet-stream');
			return response.end(bytes);
		} catch { /* Unknown asset. */ }
	}
	response.writeHead(404).end();
});

await new Promise(resolveListening => server.listen(0, '127.0.0.1', resolveListening));
let browser;
try {
	if (serverInstallation) {
		const requireServer = createRequire(join(resolve(serverInstallation), 'package.json'));
		serverClient = requireServer('@libsql/client').createClient({ url: pathToFileURL(join(databaseDirectory, 'memory.db')).href });
		const { MemoryLibSQL } = requireServer('@mastra/libsql');
		sharedStore = new MemoryLibSQL({ client: serverClient });
		await sharedStore.init();
		for (const resourceId of new Set(sessions.values())) {
			await sharedStore.saveThread({ thread: { id: 'returns-' + resourceId, resourceId, title: 'Returns',
				metadata: {}, createdAt: new Date(), updatedAt: new Date() } });
		}
	}
	browser = await chromium.launch({ headless: true, executablePath: process.env.CASAI_REVIEW_CHROMIUM });
	const context = await browser.newContext();
	const page = await context.newPage();
	const origin = 'http://127.0.0.1:' + server.address().port;
	await page.goto(origin);
	const open = () => page.evaluate(async () => {
		const { PGlite } = await import('/pg/index.js');
		const { vector } = await import('/vec/index.js');
		const { ModelMessageSchema } = await import('/casai.js');
		const db = await PGlite.create('idb://casai-memory-probe', { extensions: { vector } });
		window.probe = { db, ModelMessageSchema };
	});
	await open();
	await page.evaluate(async () => {
		const { db } = window.probe;
		await db.exec('CREATE EXTENSION vector; CREATE TABLE messages (id text PRIMARY KEY, owner text, day int, message jsonb, embedding vector(2))');
		for (const [id, owner, day, embedding] of [
			['foreign', 'bob', 4, '[1,0]'], ['expired', 'alice', 1, '[1,0]'], ['eligible', 'alice', 4, '[0.8,0.2]'],
		]) {
			await db.query('INSERT INTO messages VALUES ($1,$2,$3,$4,$5)', [id, owner, day,
				JSON.stringify({ role: 'user', content: id }), embedding]);
		}
		await db.close();
	});
	await page.reload();
	await open();
	await context.setOffline(true);
	const result = await page.evaluate(async () => {
		const { db, ModelMessageSchema } = window.probe;
		const result = await db.query('SELECT id, message FROM messages WHERE owner = $1 AND day >= $2 ORDER BY embedding <=> $3::vector LIMIT 1',
			['alice', 3, '[1,0]']);
		await db.close();
		return result.rows.map(row => ({ id: row.id, message: ModelMessageSchema.parse(row.message) }));
	});
	assert.deepEqual(result, [{ id: 'eligible', message: { role: 'user', content: 'eligible' } }]);
	console.log('Chromium ' + browser.version() + ': IndexedDB persisted a native SDK message across reload; owner/date-filtered vector recall succeeded offline.');
	if (sharedStore) {
		const [writer, reader, otherUser] = await Promise.all([...sessions.keys()].map(async authorization => {
			const session = await browser.newContext({ extraHTTPHeaders: { authorization } });
			const tab = await session.newPage();
			await tab.goto(origin);
			return tab;
		}));
		const status = await writer.evaluate(async () => (await fetch('/history', { method: 'POST', body: 'Check my return' })).status);
		assert.equal(status, 204);
		assert.deepEqual(await reader.evaluate(async () => (await fetch('/history')).json()), [{ role: 'user', content: 'Check my return' }]);
		assert.deepEqual(await otherUser.evaluate(async () => (await fetch('/history?resourceId=alice')).json()), []);
		console.log('Two independent browser sessions shared one thread through the published libSQL adapter; the other owner received no messages.');
	}
} finally {
	try { await browser?.close(); } finally {
		await new Promise(done => server.close(done));
		serverClient?.close();
	}
}
