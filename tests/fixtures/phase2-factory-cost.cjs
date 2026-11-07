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
// Every Casai factory now reaches the complete component inventory. Budget that shared import once.
const componentImportLimit = 450000;
const workloads = {
  Function: [componentImportLimit, 7000, 6000, i => `const c${i} = F({ inputSchema: z.object({ v${i}: z.number(), factor: z.number() }), context: { factor: 3, db: 'private' }, execute: input => input.v${i} * input.factor }); void c${i}({ v${i}: 2 });`],
  FunctionTool: [componentImportLimit, 11000, 9200, i => `const c${i} = F.asTool({ inputSchema: z.object({ v${i}: z.number() }), context: { db: 'private' }, execute: ({ v${i} }) => v${i} * 2 }); void c${i}({ v${i}: 2 });`],
  Template: [componentImportLimit, 4200, 3600, i => `const c${i} = F({ template: 'Hi {{ n${i} }}', inputSchema: z.object({ n${i}: z.string() }), context: { db: 'private' } }); void c${i}({ n${i}: 'x' });`],
  Script: [componentImportLimit, 4200, 3600, i => `const c${i} = F({ script: 'return n${i}', inputSchema: z.object({ n${i}: z.number() }), schema: z.number() }); void c${i}({ n${i}: 1 });`],
  LLMAgent: [componentImportLimit, 9500, 4100, i => `const c${i} = F.withTemplate({ model, prompt: 'Hi {{ n${i} }}', inputSchema: z.object({ n${i}: z.string() }) }); void c${i}({ n${i}: 'x' });`],
  LLMAgentStream: [componentImportLimit, 8000, 4100, i => `const c${i} = F.withTemplate.asStream({ model, prompt: 'Hi {{ n${i} }}', inputSchema: z.object({ n${i}: z.string() }) }); void c${i}({ n${i}: 'x' });`],
  LLMAgentFunction: [componentImportLimit, 22000, 13000, i => `const c${i} = F.withFunction({ model, inputSchema: z.object({ n${i}: z.string() }), context: { prefix: 'private' }, prompt: ({ n${i}, prefix }) => prefix + n${i} }); void c${i}({ n${i}: 'x' });`],
  LLMAgentObject: [componentImportLimit, 10000, 2500, i => `const c${i} = F({ model, output: Output.object({ schema: z.object({ a${i}: z.string() }) }), prompt: 'x' }); void c${i}();`],
  LLMAgentObjectStream: [componentImportLimit, 8200, 2500, i => `const c${i} = F.asStream({ model, output: Output.object({ schema: z.object({ a${i}: z.string() }) }), prompt: 'x' }); void c${i}();`],
  // New hook and native Agent-method workloads have independent budgets.
  LLMAgentHooks: [componentImportLimit, 40000, 15000, i => `const c${i} = F.withTemplate({ model, prompt: 'Hi {{ n${i} }}', inputSchema: z.object({ n${i}: z.number() }), prepareCall: (request, _config, context) => ({ ...request, maxOutputTokens: context.n${i} }), prepareStep: step => ({ temperature: step.stepNumber ? 0 : 1 }) }); void c${i}({ n${i}: 10 });`],
  NativeAgentHooks: [500000, 4500, 1000, i => `const c${i} = new F({ model, callOptionsSchema: z.object({ n${i}: z.number() }), prepareCall: ({ options, ...request }) => ({ ...request, maxOutputTokens: options.n${i} }), prepareStep: step => ({ temperature: step.stepNumber ? 0 : 1 }) }); void c${i}.generate({ prompt: 'Hi', options: { n${i}: 10 } });`],
  LLMAgentMethods: [componentImportLimit, 8000, 4500, i => `const c${i} = F({ model, inputSchema: z.object({ n${i}: z.number() }), output: Output.object({ schema: z.object({ a${i}: z.string() }) }) }); void c${i}.generate({ prompt: 'Hi', options: { n${i}: 1 } }); void c${i}.stream({ messages: [], options: { n${i}: 1 } });`],
  NativeAgentMethods: [500000, 3500, 1000, i => `const c${i} = new F({ model, callOptionsSchema: z.object({ n${i}: z.number() }), output: Output.object({ schema: z.object({ a${i}: z.string() }) }) }); void c${i}.generate({ prompt: 'Hi', options: { n${i}: 1 } }); void c${i}.stream({ messages: [], options: { n${i}: 1 } });`],
  Config: [1000000, 39000, 16000, i => `const c${i} = F({ inputSchema: z.object({ n${i}: z.number() }), context: { n${i}: 1 } }); void c${i}.config;`],
  Embedder: [componentImportLimit, 22000, 13000, i => `const c${i} = F.withFunction({ model, inputSchema: z.object({ n${i}: z.string() }), context: { prefix: 'private' }, input: ({ n${i}, prefix }) => prefix + n${i} }); void c${i}({ n${i}: 'x' });`],
  // Supporting images/count without a mask adds a measured tail branch (marginal 6020 -> 6454).
  ImageGenerator: [componentImportLimit, 12000, 6500, i => `const c${i} = F.withTemplate.asTool({ model, inputSchema: z.object({ n${i}: z.string() }), prompt: 'Draw {{ n${i} }}', images: [] }); void c${i}({ n${i}: 'x' });`],
};
try {
  assert.ok(Object.keys(workloads).some(name => filter.test(name)), `No factory workloads match ${filter}.`);
  fs.cpSync(path.join(workspace, 'src'), path.join(temporary, 'src'), { recursive: true });
  for (const [name, [importLimit, componentLimit, additionalLimit, component]] of Object.entries(workloads)) {
    if (!filter.test(name)) continue;
    const factory = name === 'FunctionTool' ? 'Function' : name.startsWith('LLMAgent') ? 'LLMAgent' : name;
    const usesNativeModel = ['Embedder', 'ImageGenerator'].includes(name);
    const factoryImport = name.startsWith('Native') ? "import { ToolLoopAgent as F } from 'ai';" : `import { ${factory} as F } from './src/factories/${factory}.js';`;
    const modelType = usesNativeModel ? `import('./src/types/component.js').ComponentSettings['${name}']['model']` : 'LanguageModel';
    const prefix = `import { z } from 'zod/v4';\nimport { Output, type LanguageModel } from 'ai';\n${factoryImport}\ndeclare const model: ${modelType};\nvoid z; void F; void model;\n`;
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
    assert.ok((name.startsWith('Native') ? samples[0].instantiations >= 0 : samples[0].instantiations > 0) && samples[0].instantiations <= importLimit, `${name}: import cost exceeds ${importLimit}`);
    assert.ok(firstBatch >= 0 && nextBatch >= 0 && firstBatch <= componentLimit && nextBatch <= additionalLimit, `${name}: component cost exceeds ${componentLimit} initially or ${additionalLimit} thereafter`);
  }
} finally {
  assert.equal(path.dirname(temporary), workspace);
  assert.ok(path.basename(temporary).startsWith('.phase2-factory-cost-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
