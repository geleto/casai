// Separate import/setup cost from additional independently configured components.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const filter = new RegExp(process.argv[2] ?? '');
const temporary = fs.mkdtempSync(path.join(workspace, '.phase2-factory-cost-'));
const compiler = path.join(workspace, 'node_modules/@typescript/native/bin/tsc');
const common = ['--ignoreConfig', '--strict', '--skipLibCheck', '--noImplicitReturns', '--target', 'ES2022',
  '--module', 'ESNext', '--moduleResolution', 'bundler', '--types', 'node,mocha', '--noEmit', '--extendedDiagnostics'];
// Instantiations, not elapsed time, enforce the budget. Time and memory are diagnostic.
// First-use specialization is distinct from growth after the initial 12 components.
const workloads = {
  Function: [400000, 7000, 6000, i => `const c${i} = F({ inputSchema: z.object({ v${i}: z.number(), factor: z.number() }), context: { factor: 3, db: 'private' }, execute: input => input.v${i} * input.factor }); void c${i}({ v${i}: 2 });`],
  FunctionTool: [400000, 11000, 9000, i => `const c${i} = F.asTool({ inputSchema: z.object({ v${i}: z.number() }), context: { db: 'private' }, execute: ({ v${i} }) => v${i} * 2 }); void c${i}({ v${i}: 2 });`],
  Template: [400000, 4000, 3400, i => `const c${i} = F({ template: 'Hi {{ n${i} }}', inputSchema: z.object({ n${i}: z.string() }), context: { db: 'private' } }); void c${i}({ n${i}: 'x' });`],
  Script: [400000, 4100, 3500, i => `const c${i} = F({ script: 'return n${i}', inputSchema: z.object({ n${i}: z.number() }), schema: z.number() }); void c${i}({ n${i}: 1 });`],
  TextGenerator: [800000, 9500, 4100, i => `const c${i} = F.withTemplate({ model, prompt: 'Hi {{ n${i} }}', inputSchema: z.object({ n${i}: z.string() }) }); void c${i}({ n${i}: 'x' });`],
  TextStreamer: [600000, 8000, 4100, i => `const c${i} = F.withTemplate({ model, prompt: 'Hi {{ n${i} }}', inputSchema: z.object({ n${i}: z.string() }) }); void c${i}({ n${i}: 'x' });`],
  ObjectGenerator: [600000, 10000, 2400, i => `const c${i} = F({ model, schema: z.object({ a${i}: z.string() }), prompt: 'x' }); void c${i}();`],
  ObjectStreamer: [500000, 8200, 2300, i => `const c${i} = F({ model, schema: z.object({ a${i}: z.string() }), prompt: 'x' }); void c${i}();`],
  Config: [1000000, 39000, 16000, i => `const c${i} = F({ inputSchema: z.object({ n${i}: z.number() }), context: { n${i}: 1 } }); void c${i}.config;`],
};
try {
  fs.cpSync(path.join(workspace, 'src'), path.join(temporary, 'src'), { recursive: true });
  for (const [name, [importLimit, componentLimit, additionalLimit, component]] of Object.entries(workloads)) {
    if (!filter.test(name)) continue;
    const factory = name === 'FunctionTool' ? 'Function' : name;
    const prefix = `import { z } from 'zod/v4';\nimport type { LanguageModel } from 'ai';\nimport { ${factory} as F } from './src/factories/${factory}.js';\ndeclare const model: LanguageModel;\nvoid z; void F; void model;\n`;
    const samples = [];
    for (const count of [0, 12, 24]) {
      const consumer = path.join(temporary, 'workload.ts');
      fs.writeFileSync(consumer, prefix + Array.from({ length: count }, (_, i) => component(i)).join('\n'));
      const started = performance.now();
      const result = spawnSync(process.execPath, [compiler, ...common, consumer], { cwd: workspace, encoding: 'utf8', timeout: 60000 });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      samples.push({ count, instantiations: Number(result.stdout.match(/Instantiations:\s+(\d+)/)?.[1]),
        check: result.stdout.match(/Check time:\s+([^\r\n]+)/)?.[1], memory: result.stdout.match(/Memory used:\s+([^\r\n]+)/)?.[1],
        wallMs: Math.round(performance.now() - started) });
    }
    const firstBatch = (samples[1].instantiations - samples[0].instantiations) / 12;
    const nextBatch = (samples[2].instantiations - samples[1].instantiations) / 12;
    console.log(JSON.stringify({ factory: name, samples, perComponent: firstBatch, additionalComponent: nextBatch, importLimit, componentLimit, additionalLimit }));
    assert.ok(samples[0].instantiations > 0 && samples[0].instantiations <= importLimit, `${name}: import cost exceeds ${importLimit}`);
    assert.ok(firstBatch >= 0 && nextBatch >= 0 && firstBatch <= componentLimit && nextBatch <= additionalLimit, `${name}: component cost exceeds ${componentLimit} initially or ${additionalLimit} thereafter`);
  }
} finally {
  assert.equal(path.dirname(temporary), workspace);
  assert.ok(path.basename(temporary).startsWith('.phase2-factory-cost-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
