import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LoaderGroup } from 'cascada-engine';
import * as cascada from 'cascada-engine';
import { MockLanguageModelV3 } from 'ai/test';
import { create, ConfigError, FileSystemLoader, NotFoundError, PrecompiledLoader, ScriptError, TemplateError,
	WebLoader, raceLoaders, raceParent, overrideParent } from './cascada';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(complete => { resolve = complete; });
	return { promise, resolve };
}

describe('Loader composition and inheritance', () => {
	it('re-exports native races without a Casai descriptor or adapter', () => {
		expect(raceLoaders).to.equal(cascada.raceLoaders);
		const group = raceLoaders([() => 'source']);
		expect(create.Config({ loader: group }).config.loader).to.equal(group);
	});

	for (const modifier of [raceParent, overrideParent]) {
		for (const parent of [undefined, create.Config({ context: { shared: true } })]) {
			it(`uses ${modifier.name} without inherited loaders, parent=${Boolean(parent)}`, async () => {
				const group = [[() => null], [() => 'child']];
				const config = parent ? create.Config({ loader: modifier(group) }, parent) : create.Config({ loader: modifier(group) });
				expect(config.config.loader).to.equal(group);
				expect(await create.Template.loadsTemplate({ template: 'entry' }, config)()).to.equal('child');
			});
		}
	}

	it('retains nested child/parent chains and falls back through three generations', async () => {
		const calls: string[] = [];
		const loader = (id: string, names: string[]) => (name: string) => {
			calls.push(`${id}:${name}`);
			return names.includes(name) ? id : null;
		};
		const root = loader('root', ['shared', 'root-only']);
		const middle = loader('middle', ['shared', 'middle-only']);
		const child = loader('child', ['shared']);
		const childGroup = [[child]];
		const inherited = create.Config({ loader: middle }, create.Config({ loader: root }));
		const config = create.Config({ loader: childGroup }, inherited);
		expect(config.config.loader).to.deep.equal([childGroup, [middle, root]]);
		expect(childGroup).to.deep.equal([[child]]);
		const render = create.Template.loadsTemplate({ template: 'shared' }, config);
		expect(await render()).to.equal('child');
		expect(calls).to.deep.equal(['child:shared']);
		expect(await render('middle-only')).to.equal('middle');
		expect(await render('root-only')).to.equal('root');
		expect(calls.slice(-3)).to.deep.equal(['child:root-only', 'middle:root-only', 'root:root-only']);
	});

	it('starts both parent and child groups and uses the first success', async () => {
		const child = deferred<string | null>();
		const inherited = deferred<string | null>();
		const calls: string[] = [];
		const parent = create.Config({ loader: () => { calls.push('parent'); return inherited.promise; } });
		const render = create.Template.loadsTemplate({ template: 'entry',
			loader: raceParent([() => { calls.push('child'); return child.promise; }, () => 'child fallback']) }, parent);
		const pending = render();
		await new Promise<void>(resolve => setImmediate(resolve));
		expect(calls).to.deep.equal(['child', 'parent']);
		inherited.resolve('parent wins');
		try { expect(await pending).to.equal('parent wins'); }
		finally { child.resolve(null); }
	});

	it('replaces the parent completely and keeps an explicit empty override', async () => {
		let parentCalls = 0;
		const parent = create.Config({ loader: () => { parentCalls++; return 'parent'; } });
		const child = create.Template.loadsTemplate({ template: 'entry', loader: overrideParent([() => 'child']) }, parent);
		expect(await child()).to.equal('child');
		const cleared = create.Template.loadsTemplate({ template: 'entry', loader: overrideParent([]) }, parent);
		await rejects(() => cleared(), TemplateError);
		expect(parentCalls).to.equal(0);
	});

	it('inherits omitted and undefined groups and lets empty ordinary/raced groups fall back', async () => {
		const source = () => 'parent';
		const parent = create.Config({ loader: source });
		for (const config of [create.Config({}, parent), create.Config({ loader: undefined }, parent)]) {
			expect(config.config.loader).to.equal(source);
		}
		for (const loader of [[], raceParent([]), raceLoaders([])]) {
			expect(await create.Template.loadsTemplate({ template: 'entry', loader }, parent)()).to.equal('parent');
		}
	});

	it('inherits a JavaScript null loader from the parent and treats standalone null as absent', async () => {
		const loader = null as unknown as LoaderGroup;
		const parent = create.Config({ loader: () => 'parent' });
		const child = create.Config({ loader }, parent);
		expect(child.config.loader).to.equal(parent.config.loader);
		expect(await create.Template.loadsTemplate({ template: 'entry' }, child)()).to.equal('parent');
		expect(create.Config({ loader }).config.loader).to.equal(undefined);
		expect(() => create.Template.loadsTemplate({ loader, template: 'entry' })).to.throw(ConfigError, 'loader');
	});

	it('treats a JavaScript null loader on a raw parent as absent', async () => {
		const parent = { config: { loader: null as unknown as LoaderGroup } };
		expect(create.Config({}, parent).config.loader).to.equal(undefined);
		const source = () => 'child';
		for (const loader of [source, raceParent(source), overrideParent(source)]) {
			const child = create.Config({ loader }, parent);
			expect(child.config.loader).to.equal(source);
			expect(await create.Template.loadsTemplate({ template: 'entry' }, child)()).to.equal('child');
		}
	});

	it('resolves a directive from a raw ConfigProvider without mutating it', async () => {
		const directive = overrideParent(() => 'parent');
		const parent = { config: { loader: directive } };
		const child = create.Template.loadsTemplate({ template: 'entry' }, parent);
		expect(await child()).to.equal('parent');
		expect(parent.config.loader).to.equal(directive);
	});

	it('rejects parent directives inside arrays, other directives and native races', () => {
		const directive = raceParent(() => 'invalid');
		const invalid = directive as unknown as LoaderGroup;
		for (const loader of [[invalid], [[invalid]], overrideParent(invalid), raceParent([invalid])]) {
			expect(() => create.Config({ loader })).to.throw(ConfigError, 'whole loader property');
		}
		expect(() => raceLoaders([invalid])).to.throw(TypeError, 'Invalid loader');
	});

	it('keeps real loading failures distinct from misses through inheritance', async () => {
		const failure = new Error('child failed');
		let parentCalls = 0;
		const parent = create.Config({ loader: () => { parentCalls++; return 'parent'; } });
		const render = create.Template.loadsTemplate({ template: 'entry', loader: () => { throw failure; } }, parent);
		await rejects(() => render(), (error: unknown) => (error as Error).cause === failure);
		expect(parentCalls).to.equal(0);
		expect(await create.Template.loadsTemplate({ template: 'entry', loader: raceParent(() => { throw failure; }) }, parent)()).to.equal('parent');
	});

	it('binds one native composition for loaded text across independent calls', async () => {
		let loads = 0;
		const member = Object.assign(new EventEmitter(), { load: () => { loads++; return 'Prompt'; } });
		const parent = create.Config({ loader: () => null });
		const agent = create.LLMAgent.loadsText({ model: textModel(), prompt: 'entry', loader: raceParent([member]) }, parent);
		const group = agent.config.loader;
		const subscriptions = member.listenerCount('update');
		await agent();
		await agent();
		expect(agent.config.loader).to.equal(group);
		expect(member.listenerCount('update')).to.equal(subscriptions);
		expect(loads).to.equal(1);
	});
});

function textModel(): MockLanguageModelV3 {
	return new MockLanguageModelV3({ doGenerate: {
		content: [{ type: 'text', text: 'DONE' }], finishReason: { unified: 'stop', raw: 'stop' }, warnings: [],
		usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
	} });
}

function userPrompt(model: MockLanguageModelV3) {
	return model.doGenerateCalls.map(call => call.prompt[0].content);
}

describe('Built-in loaders', () => {
	let directory: string;
	beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'casai-loaders-')); });
	afterEach(() => {
		expect(dirname(directory)).to.equal(tmpdir());
		expect(basename(directory)).to.match(/^casai-loaders-/);
		rmSync(directory, { recursive: true, force: true });
	});

	function write(name: string, content: string) {
		mkdirSync(dirname(join(directory, name)), { recursive: true });
		writeFileSync(join(directory, name), content);
	}


	it('re-exports the Cascada loader classes and not-found error', () => {
		expect(FileSystemLoader).to.equal(cascada.FileSystemLoader);
		expect(PrecompiledLoader).to.equal(cascada.PrecompiledLoader);
		expect(WebLoader).to.equal(cascada.WebLoader);
		expect(NotFoundError).to.equal(cascada.NotFoundError);
	});

	it('reports missing named templates, scripts and text prompts with a NotFoundError cause', async () => {
		const loader = { load: () => null };
		const missing = (resourceName: string) => (error: unknown) => {
			const cause = (error as Error).cause;
			expect(cause).to.be.instanceOf(NotFoundError);
			expect((cause as NotFoundError).resourceName).to.equal(resourceName);
			return true;
		};
		await rejects(() => create.Template.loadsTemplate({ loader, template: 'missing.njk' })(), (error: unknown) => {
			expect(error).to.be.instanceOf(TemplateError);
			return missing('missing.njk')(error);
		});
		await rejects(() => create.Script.loadsScript({ loader, script: 'missing.casc' })(), (error: unknown) => {
			expect(error).to.be.instanceOf(ScriptError);
			return missing('missing.casc')(error);
		});
		await rejects(async () => await create.LLMAgent.loadsText({ model: textModel(), loader, prompt: 'missing.txt' })(), (error: unknown) => {
			expect((error as Error).message).to.match(/^Failed to load prompt/);
			return missing('missing.txt')(error);
		});
	});

	it('overrides parent-owned relative resources across filesystem roots', async () => {
		write('base/pages/main.njk', '{% include "./part.njk" %}');
		write('base/pages/part.njk', 'base');
		write('overrides/pages/part.njk', 'override');
		write('base/scripts/main.casc', 'from "./lib.casc" import value\nreturn value()');
		write('base/scripts/lib.casc', 'function value()\n return "base"\nendfunction');
		write('overrides/scripts/lib.casc', 'function value()\n return "override"\nendfunction');
		const base = new FileSystemLoader(join(directory, 'base'));
		const overrides = new FileSystemLoader(join(directory, 'overrides'));
		const parent = create.Config({ loader: [base] });
		const config = create.Config({ loader: [[overrides]] }, parent);
		const template = create.Template.loadsTemplate({ template: 'pages/main.njk' }, config);
		expect(await template()).to.equal('override');
		expect(await create.Script.loadsScript({ script: 'scripts/main.casc' }, config)()).to.equal('override');
		for (const factory of [create.LLMAgent.loadsTemplate, create.LLMAgent.loadsScript]) {
			const model = textModel();
			await factory({ model, prompt: factory === create.LLMAgent.loadsTemplate ? 'pages/main.njk' : 'scripts/main.casc' }, config)();
			expect(userPrompt(model)).to.deep.equal([[{ type: 'text', text: 'override' }]]);
		}
		write('overrides/pages/part.njk', 'updated');
		overrides.emit('update', 'pages/part.njk', join(directory, 'overrides/pages/part.njk'));
		expect(await template()).to.equal('updated');
	});

	for (const winner of ['child', 'parent']) {
		it(`keeps relative files within the ${winner} side selected by raceParent`, async () => {
			const other = winner === 'child' ? 'parent' : 'child';
			write(`${winner}/pages/main.njk`, '{% include "./part.njk" %}');
			write(`${other}/pages/part.njk`, 'other side');
			const parent = create.Config({ loader: new FileSystemLoader(join(directory, 'parent')) });
			const loader = new FileSystemLoader(join(directory, 'child'));
			const ordinary = create.Template.loadsTemplate({ loader, template: 'pages/main.njk' }, parent);
			expect(await ordinary()).to.equal('other side');
			const raced = create.Template.loadsTemplate({ loader: raceParent(loader), template: 'pages/main.njk' }, parent);
			await rejects(() => raced(), (error: unknown) => error instanceof TemplateError
				&& error.message.includes('Resource not found: ./part.njk'));
		});
	}

	it('loads templates, scripts and their relative dependencies from the file system', async () => {
		write('pages/welcome.njk', 'Welcome {{ name }}. {% include "./footer.njk" with context %}');
		write('pages/footer.njk', 'Regards, {{ team }}');
		write('workflows/main.casc', 'from "./helpers.casc" import greet\nreturn greet(name)');
		write('workflows/other.casc', 'from "../workflows/helpers.casc" import greet\nreturn greet(name) ~ "!"');
		write('workflows/helpers.casc', 'function greet(name)\n return "Hello " ~ name\nendfunction');
		const loader = new FileSystemLoader(directory);
		const render = create.Template.loadsTemplate({ loader, template: 'pages/welcome.njk', context: { team: 'Casai' } });
		expect(await render({ name: 'Ada' })).to.equal('Welcome Ada. Regards, Casai');
		const run = create.Script.loadsScript({ loader, script: 'workflows/main.casc' });
		expect(await run({ name: 'Ada' })).to.equal('Hello Ada');
		expect(await run('workflows/other.casc', { name: 'Ada' })).to.equal('Hello Ada!');
		const model = textModel();
		await create.LLMAgent.loadsScript({ model, loader, prompt: 'workflows/main.casc', context: { name: 'Ada' } })();
		expect(userPrompt(model)).to.deep.equal([[{ type: 'text', text: 'Hello Ada' }]]);
	});

	for (const nested of [false, true]) {
		for (const kind of ['template', 'script'] as const) {
			it(`refreshes relative ${kind} dependencies when ${nested ? 'a nested' : 'a direct'} race member updates`, async () => {
				write('pages/main.njk', '{% include "./part.njk" %}');
				write('pages/part.njk', 'First');
				write('scripts/main.casc', 'from "./lib.casc" import value\nreturn value()');
				write('scripts/lib.casc', 'function value()\n return "First"\nendfunction');
				const member = new FileSystemLoader(directory);
				const loader = raceLoaders(nested ? [[member, { load: () => null }], () => null] : [member, { load: () => null }]);
				const render = kind === 'template'
					? create.Template.loadsTemplate({ loader, template: 'pages/main.njk' })
					: create.Script.loadsScript({ loader, script: 'scripts/main.casc' });
				expect(await render()).to.equal('First');
				const childName = kind === 'template' ? 'pages/part.njk' : 'scripts/lib.casc';
				write(childName, kind === 'template' ? 'Second' : 'function value()\n return "Second"\nendfunction');
				// Match FileSystemLoader watcher events, including the resolved path of relative dependencies.
				member.emit('update', childName, join(directory, childName));
				expect(await render()).to.equal('Second');
			});
		}

		it(`resolves relative includes and imports inside ${nested ? 'nested' : 'direct'} races`, async () => {
			write('pages/main.njk', '{% include "./part.njk" with context %}');
			write('pages/part.njk', 'Hello {{ name }}');
			write('scripts/main.casc', 'from "./lib.casc" import greet\nreturn greet(name)');
			write('scripts/lib.casc', 'function greet(name)\n return "Hi " ~ name\nendfunction');
			const loader = raceLoaders(nested ? [[new FileSystemLoader(directory), { load: () => null }], () => null] : [new FileSystemLoader(directory), { load: () => null }]);
			const render = create.Template.loadsTemplate({ loader, template: 'pages/main.njk' });
			const run = create.Script.loadsScript({ loader, script: 'scripts/main.casc' });
			expect(await render({ name: 'Ada' })).to.equal('Hello Ada');
			expect(await render({ name: 'Bob' })).to.equal('Hello Bob');
			expect(await run({ name: 'Ada' })).to.equal('Hi Ada');
			expect(await run({ name: 'Bob' })).to.equal('Hi Bob');
		});

		it(`continues after a missing ${nested ? 'nested' : 'direct'} race`, async () => {
			const loader = [raceLoaders(nested ? [[{ load: () => null }, { load: async () => null }], () => null] : [{ load: () => null }, { load: async () => null }]), { load: () => 'Fallback' }];
			expect(await create.Template.loadsTemplate({ loader, template: 'missing' })()).to.equal('Fallback');
		});
	}

	it('renders precompiled templates and scripts', async () => {
		write('templates.mjs', cascada.precompileTemplateStringAsync('Hello {{ name }}!', { name: 'greeting.njk', format: 'esm' }));
		write('scripts.mjs', cascada.precompileScriptString('return "Hi " ~ name', { name: 'greeting.casc', format: 'esm' }));
		const templates = (await import(pathToFileURL(join(directory, 'templates.mjs')).href) as { default: Record<string, object> }).default;
		const scripts = (await import(pathToFileURL(join(directory, 'scripts.mjs')).href) as { default: Record<string, object> }).default;
		const loader = new PrecompiledLoader({ ...templates, ...scripts });
		expect(await create.Template.loadsTemplate({ loader, template: 'greeting.njk' })({ name: 'Ada' })).to.equal('Hello Ada!');
		expect(await create.Script.loadsScript({ loader, script: 'greeting.casc' })({ name: 'Ada' })).to.equal('Hi Ada');
		const model = textModel();
		await create.LLMAgent.loadsTemplate({ model, loader, prompt: 'greeting.njk', context: { name: 'Ada' } })();
		await create.LLMAgent.loadsScript({ model, loader, prompt: 'greeting.casc', context: { name: 'Ada' } })();
		expect(userPrompt(model)).to.deep.equal([[{ type: 'text', text: 'Hello Ada!' }], [{ type: 'text', text: 'Hi Ada' }]]);
	});
});
