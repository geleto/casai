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
  'config-source-tool-modifiers': {},
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
  continuation: { includes: ['approvals'] },
  'continuation-denial': { includes: ['approvals'] },
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
const componentFixtures = {
  'multimodal-template': {}, decision: {}, embedder: {}, 'embedding-settings': { includes: ['embedder'] },
  reranker: {}, 'retrieval-tool': {}, 'image-generator': {}, 'image-style-tool': {}, 'image-preparer': {},
  'image-edit': { includes: ['image-generator'] }, 'image-template': { setup: "import { readFile } from 'node:fs/promises';" },
  transcriber: {}, 'transcriber-url': {}, 'audio-download': {}, 'streaming-transcriber': {},
  'configured-live-input': {}, 'transcription-tool': {}, speech: {}, 'speech-response': { includes: ['speech'] },
  'streaming-speech': {}, 'streaming-translation': {}, 'voice-token': {}, 'voice-relay-errors': {},
  'voice-live': {}, 'voice-relay': { includes: ['voice-live'] }, 'image-tool-preparer': {},
  'image-storage-tool': { includes: ['image-generator'] }, rag: {},
};
Object.assign(fixtures, componentFixtures);
const componentPrelude = `declare const visionModel: LanguageModel;
declare const decisionModel: Parameters<typeof import('ai').experimental_decide>[0]['model'];
declare const embeddingModel: Parameters<typeof import('ai').embed>[0]['model'];
declare const rerankingModel: Parameters<typeof import('ai').rerank>[0]['model'];
declare const imageModel: Parameters<typeof import('ai').generateImage>[0]['model'];
declare const transcriptionModel: Parameters<typeof import('ai').transcribe>[0]['model'];
declare const streamingTranscriptionModel: Parameters<typeof import('ai').experimental_streamTranscribe>[0]['model'];
declare const speechModel: Parameters<typeof import('ai').generateSpeech>[0]['model'];
declare const streamingSpeechModel: Parameters<typeof import('ai').experimental_streamSpeech>[0]['model'];
declare const translationModel: Parameters<typeof import('ai').experimental_streamTranslate>[0]['model'];
declare const realtimeModel: import('ai').Experimental_RealtimeModel;
declare const liveModel: import('ai').Experimental_RealtimeModel;
declare const styleReferences: Uint8Array[];
declare const otherReferences: Uint8Array[];
declare const audioStream: ReadableStream<Uint8Array>;
declare const requestAudio: ReadableStream<Uint8Array>;
declare const request: Request;
declare function sendAudio(chunk: string | Uint8Array, format: { type: string; rate?: number | undefined }): Promise<void>;
declare const offerSdp: string;
declare function searchPolicies(query: string): Promise<string[]>;
declare function searchIndex(vector: number[]): Promise<string[]>;
declare function openRecordingAsPcmStream(id: string, options: { signal?: AbortSignal | undefined }): Promise<ReadableStream<Uint8Array>>;
declare const authenticatedAccount: { id: string };
const lookupOrder = create.Function.asTool({ inputSchema: z.object({ orderId: z.string() }), toolContextSchema: z.object({ accountId: z.string() }), context: { accountId: 'server' }, execute: ({ orderId }) => orderId });
declare const toolCallId: string;
declare const toolName: 'lookupOrder';
declare const args: unknown;
declare const mediaStore: { put(bytes: Uint8Array, options: { mediaType: string }): Promise<string> };`;
const fences = [...readme.matchAll(/(?:<!-- (typecheck|typecheck-skip): ([\w-]+) -->\s*)?```typescript\r?\n([\s\S]*?)\r?\n```/g)];
assert.ok(fences.every(([, kind]) => kind), 'Every TypeScript example needs a typecheck or typecheck-skip marker');
const current = fences.filter(([, kind]) => kind === 'typecheck');
const blocks = new Map(current.map(([, , name, source]) => [name, source]));
assert.equal(blocks.size, current.length, 'Typecheck markers must be unique');
assert.deepEqual([...blocks.keys()].sort(), Object.keys(fixtures).sort(), 'README2 markers must match the fixture inventory');
// Promoted examples use the same checked source in both guides. Current-only
// examples also compile verbatim, and every current TypeScript fence is inventoried.
const currentFixtures = {
  'current-quick-start': { prelude: false },
  'current-config-inheritance': {},
  'current-input-defaults': {},
  'current-coded-components': {},
  'current-calls-history': { setup: `import type { ModelMessage } from 'ai';
const writer = create.LLMAgent.withTemplate({ model, prompt: 'Explain {{ topic }}.', inputSchema: z.object({ topic: z.string() }) });
declare const previousHistory: ModelMessage[];` },
  'current-hooks': { setup: 'declare const fastModel: LanguageModel;\ndeclare const capableModel: LanguageModel;' },
  'current-sdk-ui': { setup: "declare const uiMessages: import('ai').UIMessage[];" },
  'current-agent-tool': {},
  'current-bound-tool': {},
};
const implemented = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const implementedBlocks = [...implemented.matchAll(/(?:<!-- (typecheck): ([\w-]+) -->\s*)?```typescript\r?\n([\s\S]*?)\r?\n```/g)];
assert.ok(implementedBlocks.every(([, kind]) => kind), 'Every README TypeScript example needs a typecheck marker');
assert.equal(new Set(implementedBlocks.map(([, , name]) => name)).size, implementedBlocks.length, 'README typecheck markers must be unique');
const currentOnlyNames = [];
for (const [, , name, code] of implementedBlocks) {
  if (blocks.has(name)) {
    assert.equal(code.replaceAll('\r\n', '\n'), blocks.get(name).replaceAll('\r\n', '\n'), `Shared README example changed: ${name}`);
  } else {
    assert.ok(Object.hasOwn(currentFixtures, name), `Missing README fixture: ${name}`);
    blocks.set(name, code);
    currentOnlyNames.push(name);
  }
}
assert.deepEqual(currentOnlyNames.sort(), Object.keys(currentFixtures).sort(), 'README-only markers must match the fixture inventory');
Object.assign(fixtures, currentFixtures);
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
  fs.writeFileSync(path.join(destination, name + '.ts'), `// Generated from ${Object.hasOwn(currentFixtures, name) ? 'README.md' : 'README2.md'}; shared examples are checked for equality.\n`
    + (fixture.prelude === false ? '' : prelude) + (name in componentFixtures ? componentPrelude : '') + source(name) + '\n');
}
console.log(`Prepared ${current.length} README2 examples and all ${implementedBlocks.length} README TypeScript examples (${currentOnlyNames.length} current-only); ${fences.length - current.length} future-API examples explicitly skipped.`);
