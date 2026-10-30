// Extract every current TypeScript example verbatim into the existing consumer profiles.
// Setup supplies application dependencies; fragments receive a concrete component host.
// Future APIs are explicitly marked in README2. No example executes or calls a model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const destination = path.join(root, '.cache/readme2');
const readme = fs.readFileSync(path.join(root, 'README2.md'), 'utf8');
const fixtures = {
  'quick-start': { prelude: false },
  'quick-extract': { includes: ['quick-start'], prelude: false },
  'quick-workflow': { includes: ['quick-extract'], prelude: false },
  'configured-prompt': {},
  'template-defaults': {},
  'template-prompt': {},
  'function-prompt': {},
  'async-prompt': {},
  'run-overrides': { includes: ['quick-start'], prelude: false },
  'config-inheritance': {},
  'config-inspection': { includes: ['config-inheritance'] },
  template: {},
  'loaded-template': {},
  script: {},
  'script-iterable': {},
  function: {},
  'function-stream': {},
  complete: {},
  structured: {},
  tools: {},
  streaming: {},
  'explicit-text': {},
  'explicit-array': {},
  'research-then-stream': { setup: `const lookup = tool({ inputSchema: z.object({ query: z.string() }), execute: ({ query }) => query });` },
  'agent-tool': { setup: "import { isStepCount } from 'ai';" },
  'coded-tools': {},
  'model-script-tools': { includes: ['coded-tools'], setup: "import { isStepCount } from 'ai';" },
  'private-tool-context': {},
  'tool-context': {},
  'bound-tool': { includes: ['tool-context'], setup: "import { ToolLoopAgent } from 'ai';" },
  'execution-options-type': {},
  'execution-options': { before: 'create.Function({ context: { factor: 3 }, inputSchema: z.object({ value: z.number() }),', after: '});' },
  'forward-cancellation': {
    setup: `const db = { find: (id: string) => id };
const lookup = create.Function.asTool({ inputSchema: z.object({ id: z.string() }), context: { db },
  toolContextSchema: z.object({ db: z.custom<typeof db>() }), execute: ({ id, db }) => db.find(id) });
const pipeline = create.Script({ inputSchema: z.object({ id: z.string() }), tools: { lookup }, toolsContext: { lookup: { db } }, script: 'return lookup(id=id)' });`,
    before: 'create.Function({ inputSchema: z.object({ id: z.string() }), context: { db },', after: '});',
  },
  approvals: { includes: ['tools'] },
  'template-context': {},
  filters: {},
  'loaded-agent': {},
  'custom-loader': {},
  'loader-composition': { prelude: false, setup: `const sharedLoader = { load: (name: string) => name };
const localLoader = { load: (name: string) => name };` },
  'render-options': {},
  'caller-signal': { includes: ['quick-start'], prelude: false, before: '{', after: '}' },
  observers: {},
  hooks: { setup: `const search = tool({ inputSchema: z.object({ query: z.string() }), execute: ({ query }) => query });` },
  'native-context': { includes: ['hooks'] },
  'context-timeout': { before: "create.LLMAgent({ model, inputSchema: z.object({ detail: z.enum(['deep', 'brief']) }),", after: '});' },
  orchestration: {},
  presentation: { includes: ['orchestration'] },
  recovery: { includes: ['orchestration'] },
  history: {},
  'history-run': { includes: ['history'] },
  'rendered-history': { setup: "import type { ModelMessage } from 'ai';" },
  vision: { setup: 'declare const visionModel: LanguageModel;' },
  'native-methods': {},
  ui: {},
  'dynamic-instructions': {},
  'text-interchange': {},
  'structured-interchange': {},
  'step-timeout': { before: 'create.LLMAgent({ model,', after: '});' },
  'pure-transform': {},
  'input-defaults': {},
  'parsed-input': {},
  'open-input': {},
  'stream-errors': {},
  'type-checking': {},
  'mock-workflow': {},
};
const fences = [...readme.matchAll(/(?:<!-- (typecheck|typecheck-skip): ([\w-]+) -->\s*)?```typescript\r?\n([\s\S]*?)\r?\n```/g)];
assert.ok(fences.every(([, kind]) => kind), 'Every TypeScript example needs a typecheck or typecheck-skip marker');
const current = fences.filter(([, kind]) => kind === 'typecheck');
const blocks = new Map(current.map(([, , name, source]) => [name, source]));
assert.equal(blocks.size, current.length, 'Typecheck markers must be unique');
assert.deepEqual([...blocks.keys()].sort(), Object.keys(fixtures).sort(), 'README2 markers must match the fixture inventory');
// Keep promoted current-guide examples checked too. Shared markers must remain
// identical; examples unique to the implemented API have their own setup.
const implemented = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const implementedBlocks = [...implemented.matchAll(/<!-- typecheck: ([\w-]+) -->\s*```typescript\r?\n([\s\S]*?)\r?\n```/g)];
const implementedFixtures = {
  'native-approval-continuation': {
    setup: `import type { ModelMessage } from 'ai';
const lookup = tool({ inputSchema: z.object({ city: z.string() }), execute: ({ city }) => city });
const agent = create.LLMAgent({ model, tools: { lookup }, toolApproval: { lookup: 'user-approval' } });
declare const pending: { messageHistory: ModelMessage[] };
declare const selectedApprovalId: string;
const savedContext = {};`,
  },
};
for (const [, name, code] of implementedBlocks) {
  if (blocks.has(name)) {
    assert.equal(code.replaceAll('\r\n', '\n'), blocks.get(name).replaceAll('\r\n', '\n'), `Shared README example changed: ${name}`);
  } else {
    assert.ok(Object.hasOwn(implementedFixtures, name), `Missing README example setup: ${name}`);
    blocks.set(name, code);
    fixtures[name] = implementedFixtures[name];
  }
}
assert.ok(Object.keys(implementedFixtures).every(name => implementedBlocks.some(([, marker]) => marker === name)), 'Unused README example setup');
const prelude = `import { create, z, streamSchema, textStreamSchema, collectTextStream } from 'casai';
import { Output, tool, type LanguageModel } from 'ai';
declare const model: LanguageModel;
`;
function source(name, included = new Set()) {
  if (included.has(name)) return '';
  included.add(name);
  const fixture = fixtures[name];
  return (fixture.includes ?? []).map(dependency => source(dependency, included)).join('\n') + '\n'
    + [fixture.setup, fixture.before, blocks.get(name), fixture.after].filter(Boolean).join('\n');
}
fs.mkdirSync(destination, { recursive: true });
for (const [name, fixture] of Object.entries(fixtures)) {
  const sourceFile = Object.hasOwn(implementedFixtures, name) ? 'README.md' : 'README2.md';
  fs.writeFileSync(path.join(destination, name + '.ts'), `// Generated from ${sourceFile}; do not edit.\n`
    + (fixture.prelude === false ? '' : prelude) + source(name) + '\n');
}
console.log(`Prepared ${current.length} README2 examples and checked ${implementedBlocks.length} promoted/current README examples; ${fences.length - current.length} future-API examples explicitly skipped.`);
