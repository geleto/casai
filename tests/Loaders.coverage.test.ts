import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import type { Callback, ILoaderAny, LoaderInterface, LoaderSource } from 'cascada-engine';
import { mergeLoaders, processLoaders, race, RaceLoader } from '../src/loaders';

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
		it('starts every racer and returns a success without waiting for a pending racer', async () => {
			const slow = deferred<string | null>();
			const fast = deferred<string | null>();
			const started: string[] = [];
			const loader = new RaceLoader([
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
			const loader = new RaceLoader([{ load: () => null }, { load: () => later.promise }], 'remote');
			const pending = loader.load('prompt');
			later.resolve('Found');
			expect(await pending).to.have.property('src', 'Found');
		});

		it('continues after an asynchronous rejection', async () => {
			const loader = new RaceLoader([
				{ load: () => Promise.reject(new Error('Unavailable')) }, { load: () => Promise.resolve('Found') },
			], 'remote');
			expect(await loader.load('prompt')).to.have.property('src', 'Found');
		});

		it('continues after a synchronous throw and still starts the remaining racers', async () => {
			const started: string[] = [];
			const loader = new RaceLoader([
				{ load: () => { started.push('throw'); throw new Error('Unavailable'); } },
				{ load: () => { started.push('working'); return 'Found'; } },
			], 'remote');
			expect(await loader.load('prompt')).to.have.property('src', 'Found');
			expect(started).to.deep.equal(['throw', 'working']);
		});

		it('accepts synchronous and asynchronous function loaders in named races', async () => {
			const loader = new RaceLoader([() => null, async name => `Content for ${name}`], 'remote');
			expect(await loader.load('prompt')).to.deep.equal({ src: 'Content for prompt', path: 'prompt', noCache: false });
		});

		it('treats an empty source string as a successful load', async () => {
			const loader = new RaceLoader([{ load: () => '' }, { load: () => 'Fallback' }], 'remote');
			expect(await loader.load('prompt')).to.deep.equal({ src: '', path: 'prompt', noCache: false });
		});

		it('preserves LoaderSource metadata from the winner', async () => {
			const source: LoaderSource = { src: 'Content', path: '/resolved/prompt', noCache: true };
			const loader = new RaceLoader([{ load: () => source }], 'remote');
			expect(await loader.load('prompt')).to.equal(source);
		});

		it('accepts legacy synchronous getSource loaders and preserves metadata', async () => {
			const source: LoaderSource = { src: 'Legacy content', path: '/resolved/prompt', noCache: true };
			const requested: string[] = [];
			const loader = new RaceLoader([{ getSource: (name: string) => { requested.push(name); return source; } }], 'remote');
			expect(await loader.load('prompt')).to.equal(source);
			expect(requested).to.deep.equal(['prompt']);
		});

		it('falls back when a legacy synchronous loader returns null or throws', async () => {
			const loader = new RaceLoader([
				{ getSource: () => null },
				{ getSource: () => { throw new Error('Legacy unavailable'); } },
				{ load: () => 'Native content' },
			], 'remote');
			expect(await loader.load('prompt')).to.have.property('src', 'Native content');
		});

		it('accepts legacy callback getSource loaders and preserves metadata', async () => {
			const source: LoaderSource = { src: 'Callback content', path: '/resolved/prompt', noCache: true };
			const requested: string[] = [];
			const loader = new RaceLoader([{
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
			const loader = new RaceLoader([{
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
			const loader = new RaceLoader([{
				async: true,
				getSource: (_name: string, callback?: Callback<Error, LoaderSource | null>) => {
					queueMicrotask(() => callback?.(failure, null));
					return Promise.resolve(null);
				},
			}, { load: () => null }], 'remote');
			await rejects(() => loader.load('prompt'), (error: unknown) => error === failure);
		});

		it('returns null when a legacy callback loader reports a miss', async () => {
			const loader = new RaceLoader([{
				async: true,
				getSource: (_name: string, callback?: Callback<Error, LoaderSource | null>) => {
					queueMicrotask(() => callback?.(null, null));
					return Promise.resolve(null);
				},
			}], 'remote');
			expect(await loader.load('prompt')).to.equal(null);
		});

		it('returns null when every racer returns null', async () => {
			const loader = new RaceLoader([{ load: () => null }, { load: () => Promise.resolve(null) }], 'remote');
			expect(await loader.load('prompt')).to.equal(null);
		});

		it('returns null when the race is empty', async () => {
			expect(await new RaceLoader([], 'remote').load('prompt')).to.equal(null);
		});

		it('rethrows the first observed failure if the other racers only miss', async () => {
			const failure = new Error('Original failure');
			const loader = new RaceLoader([{ load: () => Promise.reject(failure) }, { load: () => null }], 'remote');
			await rejects(() => loader.load('prompt'), (error: unknown) => error === failure);
		});

		it('chooses failure order by settlement rather than loader position', async () => {
			const first = deferred<null>();
			const secondFailure = new Error('Second loader failed first');
			const loader = new RaceLoader([{ load: () => first.promise }, { load: () => Promise.reject(secondFailure) }], 'remote');
			const pending = loader.load('prompt');
			await new Promise<void>(resolve => setImmediate(resolve));
			first.reject(new Error('First loader failed later'));
			await rejects(() => pending, (error: unknown) => error === secondFailure);
		});

		it('normalizes non-Error rejections when no racer succeeds', async () => {
			// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Exercise callers that reject with a string.
			const loader = new RaceLoader([{ load: () => Promise.reject('Network down') }], 'remote');
			await rejects(() => loader.load('prompt'), { name: 'Error', message: 'Network down' });
		});

		it('handles a loser that rejects after a successful result', async () => {
			const loser = deferred<string | null>();
			const loader = new RaceLoader([{ load: () => 'Found' }, { load: () => loser.promise }], 'remote');
			expect(await loader.load('prompt')).to.have.property('src', 'Found');
			loser.reject(new Error('Late failure'));
			await new Promise<void>(resolve => setImmediate(resolve));
		});

		for (const name of ['', ' ', '\t\n']) {
			it(`rejects a blank race group name ${JSON.stringify(name)}`, () => {
				expect(() => new RaceLoader([], name)).to.throw('groupName must be a non-empty string');
			});
		}
	});

	describe('Loader normalization and merging', () => {
		for (const named of [true, false]) {
			it(`invokes each loader once inside a duplicate ${named ? 'named' : 'anonymous'} race`, async () => {
				const calls: string[] = [];
				const first = { load: () => { calls.push('first'); return null; } };
				const second = { load: () => { calls.push('second'); return null; } };
				const [loader] = processLoaders(race([first, first, second, first], named ? 'remote' : undefined));
				if (named) {
					expect(await load(loader)).to.equal(null);
				} else {
					await rejects(() => load(loader), /not found/);
				}
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
});
