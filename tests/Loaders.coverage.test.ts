import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Callback, ILoaderAny, LoaderInterface, LoaderSource } from 'cascada-engine';
import * as cascada from 'cascada-engine';
import { MockLanguageModelV3 } from 'ai/test';
import { createRaceLoader, mergeLoaders, processLoaders, race, type RaceLoader } from '../src/loaders';
import { create, FileSystemLoader, NotFoundError, PrecompiledLoader, ScriptError, TemplateError, WebLoader, race as publicRace } from './cascada';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

async function load(loader: ILoaderAny, name = 'prompt') {
	return typeof loader === 'function' ? loader(name) : (loader as LoaderInterface).load(name);
}

describe('Loader execution coverage', () => {
	describe('RaceLoader first-success behavior', () => {
		for (const named of [true, false]) {
			it(`preserves each concurrent source origin in ${named ? 'a named' : 'an anonymous'} race with a shared path`, async () => {
				let selected = 'first';
				const firstEntered = deferred<true>();
				const firstChildName = deferred<string>();
				const member = (origin: string): LoaderInterface => ({
					isRelative: name => name.startsWith('./'),
					resolve: (_from, to) => `${origin}/${to.slice(2)}`,
					load: name => {
						if (name === 'entry') {
							return selected === origin ? { src: '{% include childName() %}', path: 'shared.njk', noCache: true } : null;
						}
						return name === `${origin}/child.njk` ? { src: origin, path: name, noCache: true } : null;
					},
				});
				const render = create.Template.loadsTemplate({
					template: 'entry', loader: publicRace([member('first'), member('second')], named ? 'remote' : undefined),
				});
				const first = render({ childName: () => { firstEntered.resolve(true); return firstChildName.promise; } });
				await firstEntered.promise;
				selected = 'second';
				const second = await render({ childName: () => './child.njk' }).finally(() => { firstChildName.resolve('./child.njk'); });

				expect(await first).to.equal('first');
				expect(second).to.equal('second');
			});
		}

		it('starts every racer and returns a success without waiting for a pending racer', async () => {
			const slow = deferred<string | null>();
			const fast = deferred<string | null>();
			const started: string[] = [];
			const loader = createRaceLoader([
				{ load: name => { started.push(`slow:${name}`); return slow.promise; } },
				{ load: name => { started.push(`fast:${name}`); return fast.promise; } },
			], 'remote');
			const pending = loader.load('greeting');
			await Promise.resolve();
			expect(started).to.deep.equal(['slow:greeting', 'fast:greeting']);
			fast.resolve('Fast response');
			try {
				expect(await pending).to.deep.equal({ src: 'Fast response', path: 'greeting', noCache: false });
			} finally {
				slow.resolve('Slow response');
			}
		});

		it('continues after the first result is null', async () => {
			const later = deferred<string | null>();
			const loader = createRaceLoader([{ load: () => null }, { load: () => later.promise }], 'remote');
			const pending = loader.load('prompt');
			later.resolve('Found');
			expect(await pending).to.have.property('src', 'Found');
		});

		it('continues after an asynchronous rejection', async () => {
			const loader = createRaceLoader([
				{ load: () => Promise.reject(new Error('Unavailable')) }, { load: () => Promise.resolve('Found') },
			], 'remote');
			expect(await loader.load('prompt')).to.have.property('src', 'Found');
		});

		it('continues after a synchronous throw and still starts the remaining racers', async () => {
			const started: string[] = [];
			const loader = createRaceLoader([
				{ load: () => { started.push('throw'); throw new Error('Unavailable'); } },
				{ load: () => { started.push('working'); return 'Found'; } },
			], 'remote');
			expect(await loader.load('prompt')).to.have.property('src', 'Found');
			expect(started).to.deep.equal(['throw', 'working']);
		});

		it('accepts synchronous and asynchronous function loaders in named races', async () => {
			const loader = createRaceLoader([() => null, async name => `Content for ${name}`], 'remote');
			expect(await loader.load('prompt')).to.deep.equal({ src: 'Content for prompt', path: 'prompt', noCache: false });
		});

		it('treats an empty source string as a successful load', async () => {
			const loader = createRaceLoader([{ load: () => '' }, { load: () => 'Fallback' }], 'remote');
			expect(await loader.load('prompt')).to.deep.equal({ src: '', path: 'prompt', noCache: false });
		});

		it('preserves LoaderSource metadata from the winner', async () => {
			const source: LoaderSource = { src: 'Content', path: '/resolved/prompt', noCache: true };
			const loader = createRaceLoader([{ load: () => source }], 'remote');
			expect(await loader.load('prompt')).to.equal(source);
		});

		it('accepts legacy synchronous getSource loaders and preserves metadata', async () => {
			const source: LoaderSource = { src: 'Legacy content', path: '/resolved/prompt', noCache: true };
			const requested: string[] = [];
			const loader = createRaceLoader([{ getSource: (name: string) => { requested.push(name); return source; } }], 'remote');
			expect(await loader.load('prompt')).to.equal(source);
			expect(requested).to.deep.equal(['prompt']);
		});

		it('falls back when a legacy synchronous loader returns null or throws', async () => {
			const loader = createRaceLoader([
				{ getSource: () => null },
				{ getSource: () => { throw new Error('Legacy unavailable'); } },
				{ load: () => 'Native content' },
			], 'remote');
			expect(await loader.load('prompt')).to.have.property('src', 'Native content');
		});

		it('accepts legacy callback getSource loaders and preserves metadata', async () => {
			const source: LoaderSource = { src: 'Callback content', path: '/resolved/prompt', noCache: true };
			const requested: string[] = [];
			const loader = createRaceLoader([{
				async: true,
				getSource: (name: string, callback?: Callback<Error, LoaderSource | null>) => {
					requested.push(name);
					queueMicrotask(() => callback?.(null, source));
					return Promise.resolve(source);
				},
			}], 'remote');
			expect(await loader.load('prompt')).to.equal(source);
			expect(requested).to.deep.equal(['prompt']);
		});

		it('falls back after a legacy callback loader reports an error', async () => {
			const loader = createRaceLoader([{
				async: true,
				getSource: (_name: string, callback?: Callback<Error, LoaderSource | null>) => {
					queueMicrotask(() => callback?.(new Error('Legacy unavailable'), null));
					return Promise.resolve(null);
				},
			}, { load: () => 'Native content' }], 'remote');
			expect(await loader.load('prompt')).to.have.property('src', 'Native content');
		});

		it('preserves a legacy callback error when no racer succeeds', async () => {
			const failure = new Error('Legacy unavailable');
			const loader = createRaceLoader([{
				async: true,
				getSource: (_name: string, callback?: Callback<Error, LoaderSource | null>) => {
					queueMicrotask(() => callback?.(failure, null));
					return Promise.resolve(null);
				},
			}, { load: () => null }], 'remote');
			await rejects(async () => await loader.load('prompt'), (error: unknown) => error === failure);
		});

		it('returns null when a legacy callback loader reports a miss', async () => {
			const loader = createRaceLoader([{
				async: true,
				getSource: (_name: string, callback?: Callback<Error, LoaderSource | null>) => {
					queueMicrotask(() => callback?.(null, null));
					return Promise.resolve(null);
				},
			}], 'remote');
			expect(await loader.load('prompt')).to.equal(null);
		});

		it('returns null when every racer returns null', async () => {
			const loader = createRaceLoader([{ load: () => null }, { load: () => Promise.resolve(null) }], 'remote');
			expect(await loader.load('prompt')).to.equal(null);
		});

		it('returns null when the race is empty', async () => {
			expect(await createRaceLoader([], 'remote').load('prompt')).to.equal(null);
		});

		it('rethrows the first observed failure if the other racers only miss', async () => {
			const failure = new Error('Original failure');
			const loader = createRaceLoader([{ load: () => Promise.reject(failure) }, { load: () => null }], 'remote');
			await rejects(async () => await loader.load('prompt'), (error: unknown) => error === failure);
		});

		it('chooses failure order by settlement rather than loader position', async () => {
			const first = deferred<null>();
			const secondFailure = new Error('Second loader failed first');
			const loader = createRaceLoader([{ load: () => first.promise }, { load: () => Promise.reject(secondFailure) }], 'remote');
			const pending = loader.load('prompt');
			await new Promise<void>(resolve => setImmediate(resolve));
			first.reject(new Error('First loader failed later'));
			await rejects(async () => await pending, (error: unknown) => error === secondFailure);
		});

		it('normalizes non-Error rejections when no racer succeeds', async () => {
			// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Exercise callers that reject with a string.
			const loader = createRaceLoader([{ load: () => Promise.reject('Network down') }], 'remote');
			await rejects(async () => await loader.load('prompt'), { name: 'Error', message: 'Network down' });
		});

		it('handles a loser that rejects after a successful result', async () => {
			const loser = deferred<string | null>();
			const loader = createRaceLoader([{ load: () => 'Found' }, { load: () => loser.promise }], 'remote');
			expect(await loader.load('prompt')).to.have.property('src', 'Found');
			loser.reject(new Error('Late failure'));
			await new Promise<void>(resolve => setImmediate(resolve));
		});

		for (const name of ['', ' ', '\t\n']) {
			it(`rejects a blank race group name ${JSON.stringify(name)}`, () => {
				expect(() => createRaceLoader([], name)).to.throw('groupName must be a non-empty string');
			});
		}
	});

	describe('Loader normalization and merging', () => {
		it('discards empty named groups without a Node process global', () => {
			const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process')!;
			const originalWarn = console.warn;
			const warnings: string[] = [];
			try {
				console.warn = (message: string) => { warnings.push(message); };
				Reflect.deleteProperty(globalThis, 'process');
				expect(processLoaders(race([], 'empty'))).to.deep.equal([]);
				expect(warnings).to.have.length(1);
			} finally {
				Object.defineProperty(globalThis, 'process', processDescriptor);
				console.warn = originalWarn;
			}
		});

		for (const named of [true, false]) {
			it(`invokes each loader once inside a duplicate ${named ? 'named' : 'anonymous'} race`, async () => {
				const calls: string[] = [];
				const first = { load: () => { calls.push('first'); return null; } };
				const second = { load: () => { calls.push('second'); return null; } };
				const [loader] = processLoaders(race([first, first, second, first], named ? 'remote' : undefined));
				expect(await load(loader)).to.equal(null);
				expect(calls).to.deep.equal(['first', 'second']);
			});
		}

		it('deduplicates parent/child named groups while preserving child order', async () => {
			const calls: string[] = [];
			const child = { load: () => { calls.push('child'); return null; } };
			const shared = { load: () => { calls.push('shared'); return null; } };
			const parent = { load: () => { calls.push('parent'); return null; } };
			const [loader] = mergeLoaders([race([shared, parent], 'remote')], [race([child, shared, child], 'remote')]);
			expect((loader as RaceLoader).loaders).to.deep.equal([child, shared, parent]);
			await load(loader);
			expect(calls).to.deep.equal(['child', 'shared', 'parent']);
		});

		it('retains the first named group position while collecting later members', () => {
			const first = { load: () => null };
			const between = { load: () => null };
			const later = { load: () => null };
			const result = processLoaders([race(first, 'remote'), between, race(later, 'remote')]);
			expect(result).to.have.length(2);
			expect((result[0] as RaceLoader).loaders).to.deep.equal([first, later]);
			expect(result[1]).to.equal(between);
		});

		it('deduplicates across sequential and named groups with first occurrence precedence', () => {
			const first = { load: () => null };
			const second = { load: () => null };
			const third = { load: () => null };
			const result = processLoaders([first, race([first, second, second], 'remote'), race([second, third], 'fallback'), third]);
			expect(result).to.have.length(3);
			expect(result[0]).to.equal(first);
			expect((result[1] as RaceLoader).loaders).to.deep.equal([second]);
			expect((result[2] as RaceLoader).loaders).to.deep.equal([third]);
		});

		it('keeps distinct loader objects even when they have identical content', async () => {
			let calls = 0;
			const first = { load: () => { calls++; return null; } };
			const second = { load: () => { calls++; return null; } };
			const [loader] = processLoaders(race([first, second], 'remote'));
			await load(loader);
			expect(calls).to.equal(2);
		});

		it('unwraps an anonymous group after duplicate removal leaves a single loader', () => {
			const first = { load: () => null };
			const second = { load: () => null };
			const result = processLoaders([first, race([first, second, second])]);
			expect(result).to.deep.equal([first, second]);
		});

		it('preserves source arrays when merging preprocessed groups multiple times', () => {
			const grandparent = { load: () => null };
			const parent = { load: () => null };
			const child = { load: () => null };
			const originalMembers = [grandparent];
			const original = [race(originalMembers, 'remote')];
			const first = mergeLoaders(original, [race(parent, 'remote')]);
			const second = mergeLoaders(first, [race(child, 'remote')]);
			expect((second[0] as RaceLoader).loaders).to.deep.equal([child, parent, grandparent]);
			expect((first[0] as RaceLoader).loaders).to.deep.equal([parent, grandparent]);
			expect(originalMembers).to.deep.equal([grandparent]);
			expect(original[0].loaders).to.equal(originalMembers);
		});
	});

	describe('Built-in loaders', () => {
		let directory: string;
		beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'casai-loaders-')); });
		afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

		function write(name: string, content: string) {
			mkdirSync(dirname(join(directory, name)), { recursive: true });
			writeFileSync(join(directory, name), content);
		}

		function textModel(): MockLanguageModelV3 {
			return new MockLanguageModelV3({ doGenerate: {
				content: [{ type: 'text', text: 'DONE' }], finishReason: { unified: 'stop', raw: 'stop' }, warnings: [],
				usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
			} });
		}

		function userPrompt(model: MockLanguageModelV3) {
			return model.doGenerateCalls.map(call => call.prompt[0].content);
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
			await rejects(async () => await create.TextGenerator.loadsText({ model: textModel(), loader, prompt: 'missing.txt' })(), (error: unknown) => {
				expect((error as Error).message).to.match(/^Failed to load prompt/);
				return missing('missing.txt')(error);
			});
		});

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
			await create.TextGenerator.loadsScript({ model, loader, prompt: 'workflows/main.casc', context: { name: 'Ada' } })();
			expect(userPrompt(model)).to.deep.equal([[{ type: 'text', text: 'Hello Ada' }]]);
		});

		for (const groupName of [undefined, 'remote']) {
			it(`resolves relative includes and imports inside ${groupName ? 'named' : 'anonymous'} races`, async () => {
				write('pages/main.njk', '{% include "./part.njk" with context %}');
				write('pages/part.njk', 'Hello {{ name }}');
				write('scripts/main.casc', 'from "./lib.casc" import greet\nreturn greet(name)');
				write('scripts/lib.casc', 'function greet(name)\n return "Hi " ~ name\nendfunction');
				const loader = publicRace([new FileSystemLoader(directory), { load: () => null }], groupName);
				const render = create.Template.loadsTemplate({ loader, template: 'pages/main.njk' });
				const run = create.Script.loadsScript({ loader, script: 'scripts/main.casc' });
				expect(await render({ name: 'Ada' })).to.equal('Hello Ada');
				expect(await render({ name: 'Bob' })).to.equal('Hello Bob');
				expect(await run({ name: 'Ada' })).to.equal('Hi Ada');
				expect(await run({ name: 'Bob' })).to.equal('Hi Bob');
			});

			it(`continues after a missing ${groupName ? 'named' : 'anonymous'} race`, async () => {
				const loader = [publicRace([{ load: () => null }, { load: async () => null }], groupName), { load: () => 'Fallback' }];
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
			await create.TextGenerator.loadsTemplate({ model, loader, prompt: 'greeting.njk', context: { name: 'Ada' } })();
			await create.TextGenerator.loadsScript({ model, loader, prompt: 'greeting.casc', context: { name: 'Ada' } })();
			expect(userPrompt(model)).to.deep.equal([[{ type: 'text', text: 'Hello Ada!' }], [{ type: 'text', text: 'Hi Ada' }]]);
		});
	});
});
