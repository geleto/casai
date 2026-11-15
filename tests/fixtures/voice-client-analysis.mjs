// Scoped native analysis, not a VoiceAgentClient implementation or production acceptance suite.
// Requires the linked Cascada checkout with its browser-test shims and Playwright.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { precompileScriptString } from 'cascada-engine';
import { build } from 'esbuild';

const here = new URL('../../.cache/voice-analysis/', import.meta.url);
await mkdir(here, { recursive: true });
const scripts = {
  create: 'return createSession()',
  connect: 'var started = session!.connect({capture: false})\nreturn started',
  send: 'var sent = session!.sendEvent({type: "input-audio-clear"})\nif sent is error\nreturn sent\nendif\nreturn session!.getSnapshot().status',
  close: 'var closed = session!.close()\nif closed is error\nreturn closed\nendif\nreturn session!.getSnapshot().status',
  fail: 'var sent = session!.sendEvent({type: "input-audio-clear"})\nif sent is error\nreturn "caught"\nendif\nreturn "unexpected"',
};
for (const [name, source] of Object.entries(scripts)) await writeFile(new URL(`${name}.mjs`, here), precompileScriptString(source, { name, format: 'esm' }));
const result = await build({entryPoints:[fileURLToPath(new URL('./voice-client-browser-analysis.mjs', import.meta.url))],bundle:true,platform:'browser',format:'esm',outfile:fileURLToPath(new URL('bundle.mjs',here)),metafile:true,alias:{path:fileURLToPath(new URL('../../node_modules/cascada-engine/tests/browser/shims/path.js',here)),events:fileURLToPath(new URL('../../node_modules/cascada-engine/tests/browser/shims/events.js',here))},define:{'process.env.NODE_ENV':'"test"'}});
assert(!Object.keys(result.metafile.inputs).some(name => /(?:chokidar|node-av|react|node:)/.test(name)));
const require = createRequire(await realpath('node_modules/cascada-engine/package.json'));
const { chromium } = require('playwright');
const server = createServer(async (_req,res) => {res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('bundle.mjs',here)));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser = await chromium.launch({headless:true});
 const page=await browser.newPage(); page.on('pageerror', error => console.error(error));
 await page.addInitScript(() => {globalThis.process={cwd:()=> '/',env:{}};});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const evidence=await page.evaluate(async url => {const {run}=await import(url); return run();},`http://127.0.0.1:${server.address().port}/bundle.mjs`);
 console.log(JSON.stringify(evidence,null,2));
 assert.equal(evidence.connected,'connected'); assert.equal(evidence.closed,'disconnected'); assert.equal(evidence.failure,'caught');
 assert(evidence.independent); assert(evidence.sameHandle); assert.equal(evidence.sockets,0); assert.equal(evidence.listenersAfterTeardown,0);
 assert(evidence.nativeConnectReturnsBeforeReady);
 await writeFile(new URL('evidence.json',here),JSON.stringify({...evidence,bundleBytes:result.metafile.outputs[Object.keys(result.metafile.outputs)[0]].bytes},null,2));
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
