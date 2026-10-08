import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cosineSimilarity } from 'ai';
import { create, ScriptError, z } from './cascada';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(fulfill => { resolve = fulfill; });
	return { promise, resolve };
}

function readmeScript(component: string): string {
	const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
	const start = readme.indexOf(`const ${component} = create.Script({`);
	const script = start < 0 ? undefined : /script:\s*`([\s\S]*?)`/.exec(readme.slice(start))?.[1];
	if (!script) throw new Error(`README script example '${component}' was not found`);
	return script;
}

describe('Component workflow contracts', () => {
	for (const mode of ['Script', 'Template'] as const) {
		it(`starts independent ${mode} components concurrently and waits for every dependency`, async () => {
			const first = deferred<string>();
			const second = deferred<string>();
			const bothStarted = deferred<undefined>();
			const secondFinished = deferred<undefined>();
			let started = 0;
			let combined = 0;
			const branch = (result: Promise<string>, finished?: () => void) => create.Function({
				execute: async () => {
					if (++started === 2) bothStarted.resolve(undefined);
					const value = await result;
					finished?.();
					return value;
				},
			});
			const context = {
				left: branch(first.promise),
				right: branch(second.promise, () => { secondFinished.resolve(undefined); }),
				combine: create.Function({
					inputSchema: z.object({ left: z.string(), right: z.string() }),
					execute: ({ left, right }) => {
						combined++;
						return `${left}/${right}`;
					},
				}),
			};
			const workflow = mode === 'Script'
				? create.Script({ context, script: `
					var a = left()
					var b = right()
					return combine({ left: a, right: b })
				` })
				: create.Template({ context, template: '{% set a = left() %}{% set b = right() %}{{ combine({ left: a, right: b }) }}' });
			const pending = workflow();
			try {
				await bothStarted.promise;
				expect(combined).to.equal(0);
				second.resolve('RIGHT');
				await secondFinished.promise;
				expect(combined).to.equal(0);
				first.resolve('LEFT');
				expect(await pending).to.equal('LEFT/RIGHT');
				expect(combined).to.equal(1);
			} finally {
				first.resolve('LEFT');
				second.resolve('RIGHT');
			}
		});

		it(`isolates context across concurrent invocations of one ${mode}`, async () => {
			const releases = { first: deferred<string>(), second: deferred<string>() };
			const started = deferred<undefined>();
			let calls = 0;
			const context = {
				label: 'configured',
				lookup: create.Function({
					inputSchema: z.object({ id: z.enum(['first', 'second']) }),
					execute: ({ id }) => {
						if (++calls === 2) started.resolve(undefined);
						return releases[id].promise;
					},
				}),
			};
			const workflow = mode === 'Script'
				? create.Script({ context, script: 'return label ~ ":" ~ lookup({ id: id })' })
				: create.Template({ context, template: '{{ label }}:{{ lookup({ id: id }) }}' });
			const first = workflow({ id: 'first', label: 'one' });
			const second = workflow({ id: 'second', label: 'two' });
			try {
				await started.promise;
				releases.second.resolve('B');
				expect(await second).to.equal('two:B');
				releases.first.resolve('A');
				expect(await first).to.equal('one:A');
				expect(workflow.config.context.label).to.equal('configured');
			} finally {
				releases.first.resolve('A');
				releases.second.resolve('B');
			}
		});
	}

	it('collects concurrent component results in input order despite reverse completion', async () => {
		const gates = [deferred<number>(), deferred<number>(), deferred<number>()];
		const started = deferred<undefined>();
		let calls = 0;
		const worker = create.Function({
			inputSchema: z.object({ index: z.number() }),
			execute: ({ index }) => {
				if (++calls === 3) started.resolve(undefined);
				return gates[index].promise;
			},
		});
		const workflow = create.Script({
			context: { worker },
			schema: z.array(z.number()),
			script: `
				data out
				out = []
				for index in [0, 1, 2]
					out.push(worker({ index: index }))
				endfor
				return out.snapshot()
			`,
		});
		const pending = workflow();
		try {
			await started.promise;
			gates[2].resolve(30);
			gates[1].resolve(20);
			gates[0].resolve(10);
			expect(await pending).to.deep.equal([10, 20, 30]);
		} finally {
			gates.forEach((gate, index) => { gate.resolve(index); });
		}
	});

	for (const scenario of [
		{ scores: [3, 9], min: 0, max: 3, revisions: 1 },
		{ scores: [9, 9], min: 1, max: 3, revisions: 1 },
		{ scores: [2, 3, 4], min: 0, max: 2, revisions: 2 },
		{ scores: [9], min: 0, max: 3, revisions: 0 },
	]) {
		it(`runs the documented revision workflow with scores ${scenario.scores.join(',')}, minimum ${scenario.min}, maximum ${scenario.max}`, async () => {
			const drafts: string[] = [];
			const critiques: string[] = [];
			const draftGenerator = create.Function({ execute: () => ({ text: 'draft' }) });
			const critiqueGenerator = create.Function({
				inputSchema: z.object({ draft: z.string() }),
				execute: ({ draft }) => {
					const score = scenario.scores[critiques.length];
					critiques.push(draft);
					return { object: { score, suggestions: [`improve ${draft}`] } };
				},
			});
			const revisionGenerator = create.Function({
				inputSchema: z.object({ draft: z.string(), suggestions: z.array(z.string()) }),
				execute: ({ draft, suggestions }) => {
					expect(suggestions).to.deep.equal([`improve ${draft}`]);
					const revised = `${draft}+revision`;
					drafts.push(revised);
					return { text: revised };
				},
			});
			const agent = create.Script({
				context: { draftGenerator, critiqueGenerator, revisionGenerator, qualityThreshold: 8, topic: 'testing' },
				inputSchema: z.object({ minRevisions: z.number(), maxRevisions: z.number() }),
				schema: z.object({ finalDraft: z.string(), finalScore: z.number(), revisionCount: z.number() }),
				script: readmeScript('contentAgent'),
			});
			expect(await agent({ minRevisions: scenario.min, maxRevisions: scenario.max })).to.deep.equal({
				finalDraft: `draft${'+revision'.repeat(scenario.revisions)}`,
				finalScore: scenario.scores[scenario.revisions],
				revisionCount: scenario.revisions,
			});
			expect(drafts).to.have.length(scenario.revisions);
			expect(critiques).to.have.length(scenario.revisions + 1);
		});
	}

	it('runs the README RAG script with retrieved context passed to the answer component', async () => {
		const calls: string[] = [];
		const answerGenerator = create.Function({
			inputSchema: z.object({ context: z.string() }),
			execute: ({ context }) => {
				calls.push(`answer:${context}`);
				return { text: `Based on ${context}` };
			},
		});
		const workflow = create.Script({
			context: {
				query: 'current research', answerGenerator,
				searchIndex: async (query: string) => {
					calls.push(`search:${query}`);
					return 'retrieved sources';
				},
			},
			script: readmeScript('ragOrchestrator'),
		});
		expect(await workflow()).to.deep.equal({ query: 'current research', answer: 'Based on retrieved sources' });
		expect(calls).to.deep.equal(['search:current research', 'answer:retrieved sources']);
	});

	it('runs the README embedding script with asynchronous document and embedding lookups', async () => {
		const read: string[] = [];
		const embedded: string[] = [];
		const workflow = create.Script({
			context: {
				userQuery: 'query',
				readFile: async (path: string) => {
					read.push(path);
					return `contents:${path}`;
				},
				embedText: async (text: string) => {
					embedded.push(text);
					return text === 'query' || text === 'contents:docs/document5.txt' ? [1, 0] : [0, 1];
				},
				compareSimilarity: cosineSimilarity,
			},
			schema: z.object({ docs: z.array(z.object({ filename: z.string(), similarity: z.number() })) }),
			script: readmeScript('documentFinder'),
		});
		const result = await workflow();
		expect(result.docs).to.deep.equal(Array.from({ length: 10 }, (_, index) => ({
			filename: `docs/document${index + 1}.txt`, similarity: index === 4 ? 1 : 0,
		})));
		expect(read).to.have.length(10);
		expect(embedded).to.have.members(['query', ...read.map(path => `contents:${path}`)]);
	});

	it('propagates a nested component failure and does not execute its dependent component', async () => {
		let dependentCalls = 0;
		const upstream = create.Function({ execute: () => { throw new Error('lookup unavailable'); } });
		const downstream = create.Function({ execute: () => { dependentCalls++; return 'unexpected'; } });
		const workflow = create.Script({ context: { upstream, downstream }, script: 'return downstream({ value: upstream() })' });
		await rejects(workflow(), (error: unknown) => {
			expect(error).to.be.instanceOf(ScriptError);
			expect((error as ScriptError).message).to.include('lookup unavailable');
			return true;
		});
		expect(dependentCalls).to.equal(0);
	});
});
