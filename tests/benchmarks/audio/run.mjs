// npm install --prefix .cache/audio-wasm-tooling --no-save --ignore-scripts wabt@1.0.39
// node tests/benchmarks/audio/run.mjs [--node-only | --browser-only] [--reverse]
// Deliberately outside the default correctness suite; no production dependency or API changes.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { availableParallelism, cpus, freemem } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';

const directory = resolve('.cache/audio-processing-benchmark');
await mkdir(directory, { recursive: true });
const require = createRequire(import.meta.url);
const wabt = await require(resolve('.cache/audio-wasm-tooling/node_modules/wabt'))();
const parsed = wabt.parseWat('linear.wat', await readFile(new URL('./linear.wat', import.meta.url), 'utf8'));
parsed.validate();
const { buffer } = parsed.toBinary({ canonicalize_lebs: true }); parsed.destroy();
await writeFile(resolve(directory, 'linear.wasm'), buffer);
const started = performance.now(), module = await WebAssembly.compile(buffer);
const compileMs = performance.now() - started;
const counts = [...new Set([1, 2, 4, Math.min(8, availableParallelism())])].filter(value => value <= availableParallelism());
if (process.argv.includes('--reverse')) counts.reverse();
const machine = { date: new Date().toISOString(), node: process.version, cpu: cpus()[0].model, availableParallelism: availableParallelism(), counts,
  freeMiBAtStart: Math.round(freemem() / 2 ** 20), wasmBytes: buffer.length, nodeCompileMs: compileMs };
console.log(JSON.stringify(machine));
for (const platform of ['node', 'browser']) {
  const core = `${platform}-core.mjs`, worker = `${platform}-worker.mjs`;
  await build({ entryPoints: [resolve('tests/benchmarks/audio/core.mjs')], outfile: resolve(directory, core),
    bundle: true, platform, format: 'esm', target: 'es2024',
    ...(platform === 'node' ? { banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } } : {}),
  });
  await writeFile(resolve(directory, worker), `import { workerHandler } from './${core}';\n` + (platform === 'node'
    ? "import { parentPort } from 'node:worker_threads'; parentPort.on('message', workerHandler((data, transfer) => parentPort.postMessage(data, transfer)));"
    : 'self.onmessage = event => handler(event.data); const handler = workerHandler((data, transfer) => self.postMessage(data, transfer));'));
}
if (!process.argv.includes('--browser-only')) {
  const { benchmark } = await import(pathToFileURL(resolve(directory, 'node-core.mjs')).href);
  const result = await benchmark(module, () => new Worker(pathToFileURL(resolve(directory, 'node-worker.mjs'))), counts, console.log);
  await writeFile(resolve(directory, 'node-results.json'), JSON.stringify({ machine, ...result }, null, 2));
  console.log('Saved Node results.');
}
if (!process.argv.includes('--node-only')) {
  const engineRequire = createRequire(import.meta.resolve('cascada-engine'));
  const { chromium } = engineRequire('playwright');
  const files = new Map(await Promise.all(['linear.wasm', 'browser-core.mjs', 'browser-worker.mjs'].map(async name => [name, await readFile(resolve(directory, name))])));
  const server = createServer((request, response) => {
    if (request.url === '/') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><title>Audio benchmark</title>'); return; }
    const name = request.url.slice(1), body = files.get(name);
    if (!body) { response.writeHead(404).end(); return; }
    response.setHeader('content-type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'); response.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.on('console', message => console.log('Chromium: ' + message.text()));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(async counts => {
      const { benchmark } = await import('/browser-core.mjs');
      const bytes = await (await fetch('/linear.wasm')).arrayBuffer();
      const start = performance.now(), module = await WebAssembly.compile(bytes);
      const compileMs = performance.now() - start;
      return { hardwareConcurrency: navigator.hardwareConcurrency, compileMs,
        ...await benchmark(module, () => new Worker('/browser-worker.mjs', { type: 'module' }), counts, console.log) };
    }, counts);
    await writeFile(resolve(directory, 'browser-results.json'), JSON.stringify({ machine, browser: browser.version(), ...result }, null, 2));
    console.log('Saved Chromium results.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
