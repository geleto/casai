/* eslint-disable no-constant-condition -- Unreachable branches verify compile-time errors. */
import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { posix } from 'node:path';
import { promisify } from 'node:util';
import { create, ConfigError, ScriptError, TemplateError, z } from './cascada';
import { _createTemplate } from '../src/factories/Template';
import { createFunctionPromptRenderer, createScriptPromptRenderer, createTemplatePromptRenderer } from '../src/prompt-renderers';
import { Loader, Script as CascadaScript, type LoaderInterface, type LoaderSource } from 'cascada-engine';
import { jsonSchema } from 'ai';

const execFileAsync = promisify(execFile);

function memoryLoader(sources: Record<string, string>): LoaderInterface {
	return { load: (name: string) => sources[name] ?? null };
}

class UpdatingLoader extends Loader {
	constructor(readonly sources: Record<string, string>) { super(); }
	load(name: string): LoaderSource | null {
		const src = this.sources[name];
		return src === undefined ? null : { src, path: name, noCache: false };
	}
}

describe('Template and Script deterministic coverage', () => {
	describe('Template rendering', () => {
		it('renders an explicitly configured empty template', async () => {
			expect(await create.Template({ template: '' })()).to.equal('');
		});

		it('uses an explicitly empty template override instead of configured content', async () => {
			expect(await create.Template({ template: 'Configured content' })('')).to.equal('');
		});

		it('awaits promised context and asynchronous filters', async () => {
			const render = create.Template({
				template: '{{ greeting | decorate(name) }}',
				context: { greeting: Promise.resolve('Hello'), name: Promise.resolve('Ada') },
				filters: { decorate: async (greeting: string, name: string) => `${greeting}, ${name}!` },
			});
			expect(await render()).to.equal('Hello, Ada!');
		});

		it('uses one-off templates and contexts without changing subsequent calls', async () => {
			const render = create.Template({ template: '{{ greeting }} {{ name }}', context: { greeting: 'Hi', name: 'Original' } });
			expect(await render('Override {{ name }}', { name: 'Ada' })).to.equal('Override Ada');
			expect(await render({ name: 'Bob' })).to.equal('Hi Bob');
			expect(await render()).to.equal('Hi Original');
			expect(render.config.context).to.deep.equal({ greeting: 'Hi', name: 'Original' });
		});

		it('honors autoescape when explicitly enabled for standalone templates', async () => {
			const render = create.Template({ template: '{{ value }}', context: { value: '<tag a="b"> & text' }, options: { autoescape: true } });
			expect(await render()).to.equal('&lt;tag a=&quot;b&quot;&gt; &amp; text');
			expect(await render('{{ value }}')).to.equal('&lt;tag a=&quot;b&quot;&gt; &amp; text');
		});

		it('defaults autoescape to false for standalone templates', async () => {
			const render = create.Template({ template: '{{ value }}', context: { value: '<tag> & text' } });
			expect(await render()).to.equal('<tag> & text');
			const undefinedOption = create.Template({ template: '{{ value }}', context: { value: '<tag> & text' }, options: { autoescape: undefined } });
			expect(await undefinedOption()).to.equal('<tag> & text');
		});

		it('forwards whitespace options to the Cascada environment', async () => {
			const render = create.Template({ template: 'A\n  {% if true %}\nB\n  {% endif %}\nC', options: { trimBlocks: true, lstripBlocks: true } });
			expect(await render()).to.equal('A\nB\nC');
		});

		it('inherits context and filters while child values take precedence', async () => {
			const parent = create.Template({
				template: '{{ prefix }} {{ name | decorate }}',
				context: { prefix: 'Hello', name: 'Parent' },
				filters: { decorate: (name: string) => `[${name}]` },
			});
			const child = create.Template({ context: { name: 'Child' } }, parent);
			expect(await child()).to.equal('Hello [Child]');
			expect(await parent()).to.equal('Hello [Parent]');
		});

		it('loads a different named template for a one-off call', async () => {
			const render = create.Template.loadsTemplate({
				loader: memoryLoader({ initial: 'Hi {{ name }}', alternate: 'Bye {{ name }}' }),
				template: 'initial', context: { name: 'Original' },
			});
			expect(await render('alternate', { name: 'Ada' })).to.equal('Bye Ada');
			expect(await render()).to.equal('Hi Original');
		});

		it('loads a named template supplied only at call time', async () => {
			const render = _createTemplate({ loader: memoryLoader({ greeting: 'Hello {{ name }}' }) }, 'async-template-name');
			expect(await render('greeting', { name: 'Ada' })).to.equal('Hello Ada');
		});

		it('renders empty named templates from strings and LoaderSource objects', async () => {
			const loader: LoaderInterface = { load: name => name === 'string' ? '' : { src: '', path: name, noCache: false } };
			const render = create.Template.loadsTemplate({ template: 'string', loader });
			expect(await render()).to.equal('');
			expect(await render('object')).to.equal('');
		});

		it('honors noCache when a named template changes between calls', async () => {
			let source = 'First';
			const loader: LoaderInterface = { load: name => ({ src: source, path: name, noCache: true }) };
			const render = create.Template.loadsTemplate({ template: 'value.njk', loader });
			expect(await render()).to.equal('First');
			source = 'Second';
			expect(await render()).to.equal('Second');
		});

		it('observes loader updates to a configured named template', async () => {
			const loader = new UpdatingLoader({ 'value.njk': 'First' });
			const render = create.Template.loadsTemplate({ template: 'value.njk', loader });
			expect(await render()).to.equal('First');
			loader.sources['value.njk'] = 'Second';
			loader.emit('update', 'value.njk');
			expect(await render()).to.equal('Second');
		});

		it('forwards the loader to composition inside an inline template', async () => {
			const render = create.Template({
				loader: memoryLoader({ fragment: '{{ greeting }} {{ name }}' }),
				template: 'Before {% include "fragment" with context %} after',
				context: { greeting: 'Hi', name: 'Ada' },
			});
			expect(await render()).to.equal('Before Hi Ada after');
		});

		it('preserves the original cause when a context function fails', async () => {
			const render = create.Template({ template: '{{ fail() }}', context: { fail: () => { throw new Error('Context unavailable'); } } });
			await rejects(() => render(), (error: unknown) => {
				expect(error).to.be.instanceOf(TemplateError);
				expect((error as TemplateError).cause).to.be.instanceOf(Error);
				expect((error as TemplateError).cause?.message).to.include('Context unavailable');
				return true;
			});
		});

		it('reports a missing named template as TemplateError', async () => {
			const render = create.Template.loadsTemplate({ template: 'missing', loader: memoryLoader({}) });
			await rejects(() => render(), TemplateError);
		});

		it('can override a missing configured named template without an unhandled rejection', async function () {
			this.timeout(10000);
			const source = `
				import { create } from 'casai';
				const loader = { load: name => name === 'available' ? 'Hello {{ name }}' : null };
				const render = create.Template.loadsTemplate({ template: 'missing', loader, context: { name: 'Ada' } });
				console.log(await render('available'));
				await new Promise(resolve => setImmediate(resolve));
			`;
			const { stdout, stderr } = await execFileAsync(process.execPath, [
				'--import=tsx', '--conditions=casai-source', '--unhandled-rejections=strict', '--input-type=module', '-e', source,
			], { cwd: process.cwd(), timeout: 10000 });
			expect(stdout.trim()).to.equal('Hello Ada');
			expect(stderr).to.equal('');
		});

		it('reports an undefined template value when throwOnUndefined is enabled', async () => {
			const render = create.Template({ template: '{{ missing }}', options: { throwOnUndefined: true } });
			await rejects(() => render(), TemplateError);
		});

		it('validates call-time input before rendering or running context functions', async () => {
			let calls = 0;
			const render = create.Template({
				template: '{{ touch() }} {{ name }}', inputSchema: z.object({ name: z.string() }),
				context: { name: 'Configured', touch: () => ++calls },
			});
			await rejects(() => render({ name: 42 } as never), ConfigError);
			// @ts-expect-error Required input is deliberately omitted to exercise runtime validation.
			await rejects(() => render(), ConfigError);
			expect(calls).to.equal(0);
			expect(await render({ name: 'Ada' })).to.equal('1 Ada');
		});
	});

	describe('Script execution', () => {
		it('compiles configured inline scripts once across concurrent calls and keeps overrides local', async () => {
			// eslint-disable-next-line @typescript-eslint/unbound-method -- Called with the compiled script receiver below.
			const originalCompile = CascadaScript.prototype.compileSource;
			let compilations = 0;
			CascadaScript.prototype.compileSource = function () {
				compilations++;
				return originalCompile.call(this);
			};
			try {
				const run = create.Script({ script: 'var result = awaitValue(value)\nreturn result', context: { awaitValue: async (value: number) => value } });
				expect(await Promise.all([run({ value: 1 }), run({ value: 2 }), run({ value: 3 })])).to.deep.equal([1, 2, 3]);
				expect(compilations).to.equal(1);
				expect(await run('return value + 10', { value: 4 })).to.equal(14);
				expect(compilations).to.equal(2);
				expect(await run({ value: 5 })).to.equal(5);
				expect(compilations).to.equal(2);
			} finally {
				CascadaScript.prototype.compileSource = originalCompile;
			}
		});

		it('keeps asynchronous failures local to a cached script invocation', async () => {
			const run = create.Script({ script: 'return resolveValue(value)', context: { resolveValue: async (value: number) => { if (value < 0) throw new Error('Invalid value'); return value; } } });
			const [failed, succeeded] = await Promise.allSettled([run({ value: -1 }), run({ value: 2 })]);
			expect(failed.status).to.equal('rejected');
			if (failed.status === 'rejected') {
				expect(failed.reason).to.be.instanceOf(ScriptError);
				expect(failed.reason.message).to.include('Invalid value');
			}
			expect(succeeded).to.deep.equal({ status: 'fulfilled', value: 2 });
			expect(await run({ value: 3 })).to.equal(3);
		});

		it('isolates data and text channels across overlapping cached script executions', async () => {
			let releaseFirst!: (value: string) => void;
			const firstValue = new Promise<string>(resolve => { releaseFirst = resolve; });
			const run = create.Script({ script: 'data items\nitems = []\nitems.push(value)\ntext body\nbody(value)\nreturn { items: items.snapshot(), text: body.snapshot() }' });
			const first = run({ value: firstValue });
			try {
				expect(await run({ value: 'Second' })).to.deep.equal({ items: ['Second'], text: 'Second' });
			} finally {
				releaseFirst('First');
			}
			expect(await first).to.deep.equal({ items: ['First'], text: 'First' });
			expect(await run({ value: 'Third' })).to.deep.equal({ items: ['Third'], text: 'Third' });
		});

		it('runs an explicitly configured empty script and returns null', async () => {
			expect(await create.Script({ script: '' })()).to.equal(null);
		});

		it('uses an explicitly empty script override instead of configured content', async () => {
			expect(await create.Script({ script: 'return 7' })('')).to.equal(null);
		});

		for (const [source, expected] of [
			['return none', null], ['return false', false], ['return 0', 0], ['return [1, "two", true]', [1, 'two', true]],
		] as const) {
			it(`returns the direct value of ${source}`, async () => {
				expect(await create.Script({ script: source })()).to.deep.equal(expected);
			});
		}

		it('keeps script and context overrides local to one invocation', async () => {
			const run = create.Script({ script: 'return { name: name, greeting: greeting }', context: { name: 'Original', greeting: 'Hi' } });
			expect(await run('return greeting ~ " " ~ name', { name: 'Ada' })).to.equal('Hi Ada');
			expect(await run()).to.deep.equal({ name: 'Original', greeting: 'Hi' });
			expect(run.config.context).to.deep.equal({ name: 'Original', greeting: 'Hi' });
		});

		it('loads a different named script for a one-off call', async () => {
			const run = create.Script.loadsScript({
				loader: memoryLoader({ 'initial.casc': 'return "Hi " ~ name', 'alternate.casc': 'return "Bye " ~ name' }),
				script: 'initial.casc', context: { name: 'Original' },
			});
			expect(await run('alternate.casc', { name: 'Ada' })).to.equal('Bye Ada');
			expect(await run()).to.equal('Hi Original');
		});

		it('loads a named script supplied only at call time', async () => {
			const run = create.Script.loadsScript({ loader: memoryLoader({ 'only.casc': 'return "Hello " ~ name' }) });
			expect(await run('only.casc', { name: 'Ada' })).to.equal('Hello Ada');
		});

		it('honors noCache when a named script changes between calls', async () => {
			let source = 'return 1';
			const loader: LoaderInterface = { load: name => ({ src: source, path: name, noCache: true }) };
			const run = create.Script.loadsScript({ script: 'value.casc', loader });
			expect(await run()).to.equal(1);
			source = 'return 2';
			expect(await run()).to.equal(2);
		});

		it('observes loader updates to a configured named script', async () => {
			const loader = new UpdatingLoader({ 'value.casc': 'return 1' });
			const run = create.Script.loadsScript({ script: 'value.casc', loader });
			expect(await run()).to.equal(1);
			loader.sources['value.casc'] = 'return 2';
			loader.emit('update', 'value.casc');
			expect(await run()).to.equal(2);
		});

		it('forwards the loader to imports inside an inline script', async () => {
			const run = create.Script({
				loader: memoryLoader({ helpers: 'function greet(name)\n return "Hi " ~ name\nendfunction' }),
				script: 'from "helpers" import greet\nreturn greet(name)', context: { name: 'Ada' },
			});
			expect(await run()).to.equal('Hi Ada');
		});

		it('refreshes imported functions after loader updates while reusing an inline script', async () => {
			const loader = new UpdatingLoader({ helpers: 'function value()\n return 1\nendfunction' });
			const run = create.Script({ loader, script: 'from "helpers" import value\nreturn value()' });
			expect(await run()).to.equal(1);
			loader.sources.helpers = 'function value()\n return 2\nendfunction';
			loader.emit('update', 'helpers');
			expect(await run()).to.equal(2);
		});

		for (const override of [false, true]) {
			it(`resolves relative imports from a ${override ? 'one-off' : 'configured'} named script location`, async () => {
				const sources: Record<string, string> = {
					'initial.casc': 'return "Initial"',
					'workflows/main.casc': 'from "./helpers.casc" import greet\nreturn greet(name)',
					'workflows/helpers.casc': 'function greet(name)\n return "Hello " ~ name\nendfunction',
				};
				const loader: LoaderInterface = {
					load: name => sources[name] ?? null,
					isRelative: name => name.startsWith('./') || name.startsWith('../'),
					resolve: (from, to) => posix.join(posix.dirname(from), to),
				};
				const run = create.Script.loadsScript({ script: override ? 'initial.casc' : 'workflows/main.casc', loader, context: { name: 'Ada' } });
				expect(await run(override ? 'workflows/main.casc' : undefined)).to.equal('Hello Ada');
			});
		}

		it('validates and transforms output exactly once', async () => {
			let validations = 0;
			const schema = z.string().transform(value => { validations++; return value.length; });
			const run = create.Script({ script: 'return "hello"', schema });
			expect(await run()).to.equal(5);
			expect(validations).to.equal(1);
		});

		it('applies non-idempotent output transforms once on an override', async () => {
			const run = create.Script({ script: 'return 1', schema: z.number().transform(value => value + 1) });
			expect(await run('return 5')).to.equal(6);
		});

		it('reports schema failures as ConfigError with their validation cause', async () => {
			const run = create.Script({ script: 'return { count: "invalid" }', schema: z.object({ count: z.number() }) });
			await rejects(() => run(), (error: unknown) => {
				expect(error).to.be.instanceOf(ConfigError);
				expect((error as ConfigError).message).to.include('Output validation failed');
				expect((error as ConfigError).cause).to.be.instanceOf(z.ZodError);
				return true;
			});
		});

		it('accepts and transforms output using an AI SDK schema', async () => {
			const schema = jsonSchema<number>({ type: 'number' }, {
				validate: value => typeof value === 'number'
					? { success: true, value: value + 1 }
					: { success: false, error: new Error('Expected a number') },
			});
			expect(await create.Script({ script: 'return 5', schema })()).to.equal(6);
		});

		it('reports AI SDK schema failures with their original cause', async () => {
			const failure = new Error('Expected a number');
			const schema = jsonSchema<number>({ type: 'number' }, { validate: () => ({ success: false, error: failure }) });
			await rejects(() => create.Script({ script: 'return "invalid"', schema })(), (error: unknown) => {
				expect(error).to.be.instanceOf(ConfigError);
				expect((error as ConfigError).cause).to.equal(failure);
				return true;
			});
		});

		it('awaits an asynchronous AI SDK output validator', async () => {
			const schema = jsonSchema<number>({ type: 'number' }, { validate: async () => ({ success: true, value: 9 }) });
			expect(await create.Script({ script: 'return 5', schema })()).to.equal(9);
		});

		it('preserves an unexpected asynchronous AI SDK validator rejection', async () => {
			const failure = new Error('Validation service unavailable');
			const schema = jsonSchema<number>({ type: 'number' }, { validate: async () => { throw failure; } });
			await rejects(() => create.Script({ script: 'return 5', schema })(), error => error === failure);
		});

		it('reports the same output validation contract for Scripts and Functions', async () => {
			const failure = new Error('Validation unavailable');
			const schema = jsonSchema<number>({ type: 'number' }, { validate: async () => ({ success: false, error: failure }) });
			const calls = [create.Script({ script: 'return 1', schema }), create.Function({ execute: () => 1, schema })];
			for (const call of calls) {
				await rejects(async () => { await call({}); }, (error: unknown) => {
					expect(error).to.be.instanceOf(ConfigError);
					expect((error as ConfigError).message).to.equal('Output validation failed.\nValidation unavailable');
					expect((error as ConfigError).cause).to.equal(failure);
					return true;
				});
			}
		});

		it('preserves unexpected exceptions thrown by Zod output transforms', async () => {
			const failure = new Error('Transform unavailable');
			const schema = z.number().transform((): number => { throw failure; });
			const calls = [create.Script({ script: 'return 1', schema }), create.Function({ execute: () => 1, schema })];
			for (const call of calls) {
				await rejects(async () => { await call({}); }, error => error === failure);
			}
		});

		it('validates raw call-time context before evaluating a script', async () => {
			let calls = 0;
			const run = create.Script({
				script: 'return touch(name)', inputSchema: z.object({ name: z.string() }),
				context: { name: 'Configured', touch: (name: string) => { calls++; return name; } },
			});
			await rejects(() => run({ name: 42 } as never), ConfigError);
			// @ts-expect-error Required input is deliberately omitted to exercise runtime validation.
			await rejects(() => run(), ConfigError);
			expect(calls).to.equal(0);
			expect(await run({ name: 'Ada' })).to.equal('Ada');
		});

		it('collects a local asynchronous text stream without an LLM', async () => {
			async function* chunks() { yield 'Hel'; yield 'lo'; yield ' world'; }
			const run = create.Script({
				context: { chunks }, script: 'text output\nfor chunk in chunks()\n output(chunk)\nendfor\nreturn output.snapshot()',
			});
			expect(await run()).to.equal('Hello world');
		});

		it('reports a rejected asynchronous iterator with the underlying message', async () => {
			async function* chunks() { yield 'first'; throw new Error('Stream failed'); }
			const run = create.Script({
				context: { chunks }, script: 'text output\nfor chunk in chunks()\n output(chunk)\nendfor\nreturn output.snapshot()',
			});
			await rejects(() => run(), /Stream failed/);
		});
	});

	describe('Named rendering cache contracts', () => {
		for (const kind of ['template', 'script'] as const) {
			it(`shares a pending named ${kind} load while keeping invocation contexts separate`, async () => {
				let release!: () => void;
				let notifyStarted!: () => void;
				const pending = new Promise<void>(resolve => { release = resolve; });
				const started = new Promise<void>(resolve => { notifyStarted = resolve; });
				let loads = 0;
				const loader: LoaderInterface = { load: async () => {
					loads++;
					notifyStarted();
					await pending;
					return kind === 'template' ? 'Hello {{ name }}' : 'return "Hello " ~ name';
				} };
				const render = kind === 'template'
					? create.Template.loadsTemplate({ template: 'greeting', loader })
					: create.Script.loadsScript({ script: 'greeting', loader });
				const results = Promise.all([render({ name: 'Ada' }), render({ name: 'Bob' })]);
				await started;
				release();
				expect(await results).to.deep.equal(['Hello Ada', 'Hello Bob']);
				expect(await render({ name: 'Cal' })).to.equal('Hello Cal');
				expect(loads).to.equal(1);
			});

			it(`recovers from a named ${kind} syntax error after its loader updates`, async () => {
				const loader = new UpdatingLoader({ source: kind === 'template' ? '{% if %}' : 'return missing(' });
				const render = kind === 'template'
					? create.Template.loadsTemplate({ template: 'source', loader })
					: create.Script.loadsScript({ script: 'source', loader });
				await rejects(() => render(), kind === 'template' ? TemplateError : ScriptError);
				loader.sources.source = kind === 'template' ? 'Fixed' : 'return "Fixed"';
				loader.emit('update', 'source');
				expect(await render()).to.equal('Fixed');
			});
		}
	});

	describe('Call arguments', () => {
		it('rejects a second argument after a context object', async () => {
			const render = create.Template({ template: 'Hello' }) as unknown as (context: object, extra: object) => Promise<string>;
			const run = create.Script({ script: 'return "Hello"' }) as unknown as (context: object, extra: object) => Promise<unknown>;
			await rejects(() => render({ name: 'Ada' }, { name: 'Extra' }), /Second argument must be undefined/);
			await rejects(() => run({ name: 'Ada' }, { name: 'Extra' }), /Second argument must be undefined/);
		});

		it('requires a name at call time when a loading component has none configured', async () => {
			const loader = memoryLoader({ greeting: 'Hello {{ name }}', 'greeting.casc': 'return "Hello " ~ name' });
			const render = create.Template.loadsTemplate({ loader });
			const run = create.Script.loadsScript({ loader });
			if (false) {
				// @ts-expect-error Without a configured name, the first argument names the template.
				void render({ name: 'Ada' });
				// @ts-expect-error Without a configured name, the first argument names the script.
				void run({ name: 'Ada' });
			}
			await rejects(() => (render as unknown as (context: object) => Promise<string>)({ name: 'Ada' }), (error: unknown) => {
				expect(error).to.be.instanceOf(ConfigError);
				expect((error as Error).message).to.match(/template string must be provided/);
				return true;
			});
			await rejects(() => (run as unknown as (context: object) => Promise<unknown>)({ name: 'Ada' }), (error: unknown) => {
				expect(error).to.be.instanceOf(ConfigError);
				expect((error as Error).message).to.match(/script string must be provided/);
				return true;
			});
			expect(await render('greeting', { name: 'Ada' })).to.equal('Hello Ada');
			expect(await run('greeting.casc', { name: 'Ada' })).to.equal('Hello Ada');
		});

		it('returns none from an empty named script, as from an empty inline script', async () => {
			const loader: LoaderInterface = { load: name => ({ 'empty.casc': '', 'source.casc': { src: '', path: 'source.casc', noCache: false } } as Record<string, string | LoaderSource>)[name] ?? null };
			expect(await create.Script.loadsScript({ loader, script: 'empty.casc' })()).to.equal(null);
			expect(await create.Script.loadsScript({ loader })('source.casc')).to.equal(null);
			// A non-empty script that fails is still reported, even when a later loader has an empty source.
			const shadowed = create.Script.loadsScript({ loader: [memoryLoader({ 'empty.casc': 'return missing(' }), loader], script: 'empty.casc' });
			await rejects(() => shadowed(), ScriptError);
			await rejects(() => create.Script.loadsScript({ loader, script: 'missing.casc' })(), /not found/);
		});

		it('reports syntax errors in a configured template when called and still renders one-off templates', async () => {
			const render = create.Template({ template: 'Hello {% if %}', context: { name: 'Ada' } });
			await rejects(() => render(), (error: unknown) => {
				expect(error).to.be.instanceOf(TemplateError);
				expect((error as Error).message).to.match(/Template render failed/);
				expect((error as TemplateError).cause).to.be.instanceOf(Error);
				return true;
			});
			expect(await render('Hello {{ name }}')).to.equal('Hello Ada');
		});

		it('reports syntax errors in a configured script when called and still runs overrides', async () => {
			const run = create.Script({ script: 'return missing(', context: { name: 'Ada' } });
			await rejects(() => run(), ScriptError);
			expect(await run('return "Hello " ~ name')).to.equal('Hello Ada');
		});
	});

	describe('Prompt renderer contracts', () => {
		it('preserves HTML in template prompts even when autoescape is requested', async () => {
			const render = createTemplatePromptRenderer({ context: { value: '<tag a="b"> & text' }, options: { autoescape: true } }, '{{ value }}', 'async-template');
			expect(await render()).to.equal('<tag a="b"> & text');
			expect(await render('{{ value }}')).to.equal('<tag a="b"> & text');
		});

		it('preserves HTML in script text prompts even when autoescape is requested', async () => {
			const render = createScriptPromptRenderer({ context: { value: '<tag> & text' }, options: { autoescape: true } }, 'text body\nbody(value)\nreturn body.snapshot()', 'async-script');
			expect(await render()).to.equal('<tag> & text');
		});

		it('loads a one-off named script prompt and retains the configured prompt', async () => {
			const run = createScriptPromptRenderer({
				loader: memoryLoader({ initial: 'return "Initial " ~ name', alternate: 'return "Alternate " ~ name' }),
				context: { name: 'Ada' },
			}, 'initial', 'async-script-name');
			expect(await run('alternate')).to.equal('Alternate Ada');
			expect(await run()).to.equal('Initial Ada');
		});

		it('creates a template renderer before its prompt is supplied', async () => {
			const render = createTemplatePromptRenderer({ context: { name: 'Ada' } }, undefined, 'async-template');
			expect(await render('Hi {{ name }}')).to.equal('Hi Ada');
		});

		it('creates a script renderer before its prompt is supplied', async () => {
			const run = createScriptPromptRenderer({ context: { name: 'Ada' } }, undefined, 'async-script');
			expect(await run('return "Hi " ~ name')).to.equal('Hi Ada');
		});

		it('validates script prompts independently of the LLM output schema', async () => {
			const run = createScriptPromptRenderer({ schema: z.object({ answer: z.number() }) }, 'return "Prompt text"', 'async-script');
			expect(await run()).to.equal('Prompt text');
		});

		it('accepts message arrays as script prompt results', async () => {
			const run = createScriptPromptRenderer({}, 'return [{ role: "user", content: "Hello" }]', 'async-script');
			expect(await run()).to.deep.equal([{ role: 'user', content: 'Hello' }]);
		});

		for (const source of ['return 42', 'return [{ role: "unknown", content: "Hello" }]']) {
			it(`rejects an invalid script prompt result from ${source}`, async () => {
				const run = createScriptPromptRenderer({}, source, 'async-script');
				await rejects(() => run(), /validation failed/);
			});
		}

		it('leaves raw input validation to the LLM component for every renderer', async () => {
			let validations = 0;
			const config = { context: { name: 'Ada' }, inputSchema: z.object({ requiredOnlyAtCallTime: z.string() }).refine(() => { validations++; return true; }) };
			const template = createTemplatePromptRenderer(config, '{{ name }}', 'async-template');
			const script = createScriptPromptRenderer(config, 'return name', 'async-script');
			const fn = createFunctionPromptRenderer(config, context => String(context.name));
			expect(await template()).to.equal('Ada');
			expect(await script()).to.equal('Ada');
			expect(await fn()).to.equal('Ada');
			expect(validations).to.equal(0);
		});

		it('validates function prompts independently of the LLM output schema', async () => {
			const render = createFunctionPromptRenderer({ schema: z.object({ answer: z.number() }), context: { name: 'Ada' } }, context => `Hello ${context.name}`);
			expect(await render()).to.equal('Hello Ada');
		});

		it('rejects a function prompt that returns an unsupported value', async () => {
			const render = createFunctionPromptRenderer({}, (() => 42) as never);
			await rejects(async () => { await render(); }, /validation failed/);
		});
	});
});
