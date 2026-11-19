import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { AsyncEnvironment, compileScript } from 'cascada-engine';
import documentationSources from './documentation-sources.cjs';

const documentation = documentationSources.map(source => source.text).join('\n\n');
const fences = [...documentation.matchAll(/(?:<!-- (typecheck|typecheck-skip): ([\w-]+) -->\s*)?```(typescript|javascript|cascada)\r?\n([\s\S]*?)\r?\n```/g)];
const scripts = new Map();
for (const [, kind, name, language, code] of fences) {
  if (kind === 'typecheck-skip') continue;
  const file = ts.createSourceFile('example.ts', code, ts.ScriptTarget.Latest, true);
  if (language === 'cascada') continue;
  const found = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'script' && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
      const call = node.parent.parent;
      if (!ts.isCallExpression(call) || !call.expression.getText(file).includes('loadsScript')) found.push(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (found.length) scripts.set(name, found);
}

test('authored current workflow sources compile with the installed Cascada engine', () => {
  assert.ok(scripts.size >= 8, 'inventory includes the teaching workflows');
  for (const [name, examples] of scripts) for (const source of examples) assert.doesNotThrow(() => compileScript(source, new AsyncEnvironment()), name);
});

test('the first workflow starts both independent calls and preserves the returned fields', { timeout: 10000 }, async () => {
  const source = scripts.get('first-workflow')[0];
  const started = [];
  let releaseExplain;
  const explained = new Promise(resolve => { releaseExplain = resolve; });
  const result = new AsyncEnvironment().renderScriptString(source, {
    topic:'solar energy',
    explain: async ({topic}) => { started.push('explain'); return {output:await explained}; },
    suggest: async ({topic}) => { started.push('suggest'); releaseExplain(`Explanation of ${topic}`); return {output:`Exercise about ${topic}`}; },
  });
  assert.deepEqual(await result, {explanation:'Explanation of solar energy', exercise:'Exercise about solar energy'});
  assert.deepEqual(started.sort(), ['explain','suggest']);
});

test('the revision recipe stops at its quality target and at the revision limit', { timeout: 10000 }, async () => {
  const source = scripts.get('revision-workflow')[0];
  for (const [good, minRevisions, maxRevisions, expected] of [
    [true, 1, 3, 1], [false, 1, 3, 3], [true, 0, 3, 0], [false, 1, 0, 0],
  ]) {
    let revisions=0;
    const result = await new AsyncEnvironment().renderScriptString(source, {
      topic:'recycling', qualityThreshold:8, maxRevisions, minRevisions,
      draftGenerator:async()=>({output:'first draft'}),
      critiqueGenerator:async()=>({output:{score:good ? 9 : 3,suggestions:['Be specific.']}}),
      revisionGenerator:async()=>({output:`revision ${++revisions}`}),
    });
    assert.equal(result.revisionCount,expected);
    assert.equal(result.finalDraft, revisions ? `revision ${revisions}` : 'first draft');
  }
});

test('the hybrid classifier calls the model only for unmatched tickets, with one caller contract', async () => {
  const [hybrid, workflow] = scripts.get('switch-components');
  for (const category of ['billing', 'other']) {
    let modelCalls = 0;
    const classify = ticket => new AsyncEnvironment().renderScriptString(hybrid, {
      ...ticket,
      ruleClassifier: async () => ({ category }),
      aiClassify: async () => { modelCalls++; return { category: 'account' }; },
    });
    const result = await new AsyncEnvironment().renderScriptString(workflow, {
      subject: 'Support request', message: 'Please help.', classify,
    });
    const selected = category === 'other' ? 'account' : 'billing';
    assert.deepEqual(result, { category: selected, queue: `${selected}-support` });
    assert.equal(modelCalls, category === 'other' ? 1 : 0);
  }
});

test('retrieval overlaps independent searches and avoids model calls when no passages exist', { timeout: 10000 }, async () => {
  const source = scripts.get('rag')[0];
  for (const empty of [false, true]) {
    let releaseEmbedding;
    const embedding = new Promise(resolve => { releaseEmbedding = resolve; });
    const calls = [];
    const result = await new AsyncEnvironment().renderScriptString(source, {
      question: 'How are damaged orders replaced?',
      embedder: async () => { calls.push('embed'); return { embedding: await embedding }; },
      searchKeywords: async () => { calls.push('keyword'); releaseEmbedding([1, 0]); return empty ? [] : ['Replacement policy']; },
      searchIndex: async vector => { assert.deepEqual(vector, [1, 0]); calls.push('vector'); return empty ? [] : ['Shipping policy']; },
      mergeCandidates: (semantic, keyword) => [...new Set([...semantic, ...keyword])].slice(0, 20),
      reranker: async (question, candidates, count) => {
        calls.push('rank'); assert.equal(count, 5);
        assert.deepEqual(candidates, ['Shipping policy', 'Replacement policy']);
        return { rerankedDocuments: ['Replacement policy'] };
      },
      answerFromDocuments: async ({ documents }) => {
        calls.push('answer'); assert.deepEqual(documents, ['Replacement policy']);
        return { output: 'Contact support with a photo.' };
      },
    });
    assert.ok(calls.indexOf('keyword') < calls.indexOf('vector'));
    assert.deepEqual(result, empty
      ? { answer: 'No relevant passages were found.', sources: [] }
      : { answer: 'Contact support with a photo.', sources: ['Replacement policy'] });
    assert.equal(calls.includes('rank'), !empty);
    assert.equal(calls.includes('answer'), !empty);
  }
});
