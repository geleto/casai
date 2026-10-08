import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { posix } from 'node:path';
import { promisify } from 'node:util';
import { create, ConfigError, ScriptError, TemplateError, z } from './cascada';
import { _createTemplate } from '../src/factories/Template';
import { createFunctionPromptRenderer, createScriptPromptRenderer, createTemplatePromptRenderer } from '../src/prompt-renderers';
import type { LoaderInterface } from 'cascada-engine';
import { jsonSchema } from 'ai';

const execFileAsync = promisify(execFile);

function memoryLoader(sources: Record<string, string>): LoaderInterface {
	return { load: (name: string) => sources[name] ?? null };
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

		it('preserves HTML and ampersands in prompts even when autoescape is requested', async () => {
			const render = create.Template({ template: '{{ value }}', context: { value: '<tag a="b"> & text' }, options: { autoescape: true } });
			expect(await render()).to.equal('<tag a="b"> & text');
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

		it('forwards the loader to composition inside an inline template', async () => {
			const render = create.Template({
				loader: memoryLoader({ fragment: '{{ greeting }} {{ name }}' }),
				template: 'Before {% include "fragment" with context %} after',
				context: { greeting: 'Hi', name: 'Ada' },
			});
			expect(await render()).to.equal('Before Hi Ada after');
		});

		for (const promptType of ['template', 'template-name'] as const) {
			it(`renders configured and one-off ${promptType} through the synchronous adapter`, async () => {
				const config = promptType === 'template'
					? { template: 'Hi {{ name }}', context: { name: 'Ada' } }
					: { template: 'initial', context: { name: 'Ada' }, loader: memoryLoader({ initial: 'Hi {{ name }}', alternate: 'Bye {{ name }}' }) };
				const render = _createTemplate(config, promptType);
				expect(await render()).to.equal('Hi Ada');
				expect(await render(promptType === 'template' ? 'Bye {{ name }}' : 'alternate', { name: 'Bob' })).to.equal('Bye Bob');
			});

			it(`renders one-off ${promptType} with debug output enabled`, async () => {
				const originalLog = console.log;
				console.log = () => undefined;
				try {
					const config = promptType === 'template'
						? { template: 'Configured', debug: true }
						: { template: 'initial', debug: true, loader: memoryLoader({ initial: 'Configured', alternate: 'Override' }) };
					const render = _createTemplate(config, promptType);
					expect(await render(promptType === 'template' ? 'Override' : 'alternate')).to.equal('Override');
				} finally {
					console.log = originalLog;
				}
			});
		}

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
			await rejects(() => render(), ConfigError);
			expect(calls).to.equal(0);
			expect(await render({ name: 'Ada' })).to.equal('1 Ada');
		});
	});

	describe('Script execution', () => {
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

		it('forwards the loader to imports inside an inline script', async () => {
			const run = create.Script({
				loader: memoryLoader({ helpers: 'function greet(name)\n return "Hi " ~ name\nendfunction' }),
				script: 'from "helpers" import greet\nreturn greet(name)', context: { name: 'Ada' },
			});
			expect(await run()).to.equal('Hi Ada');
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

		it('reports schema failures as ScriptError with their validation cause', async () => {
			const run = create.Script({ script: 'return { count: "invalid" }', schema: z.object({ count: z.number() }) });
			await rejects(() => run(), (error: unknown) => {
				expect(error).to.be.instanceOf(ScriptError);
				expect((error as ScriptError).cause).to.be.instanceOf(z.ZodError);
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
				expect(error).to.be.instanceOf(ScriptError);
				expect((error as ScriptError).cause).to.equal(failure);
				return true;
			});
		});

		it('awaits an asynchronous AI SDK output validator', async () => {
			const schema = jsonSchema<number>({ type: 'number' }, { validate: async () => ({ success: true, value: 9 }) });
			expect(await create.Script({ script: 'return 5', schema })()).to.equal(9);
		});

		it('preserves the cause when an asynchronous AI SDK validator rejects', async () => {
			const failure = new Error('Validation service unavailable');
			const schema = jsonSchema<number>({ type: 'number' }, { validate: async () => { throw failure; } });
			await rejects(() => create.Script({ script: 'return 5', schema })(), (error: unknown) => {
				expect(error).to.be.instanceOf(ScriptError);
				expect((error as ScriptError).cause).to.equal(failure);
				return true;
			});
		});

		it('validates raw call-time context before evaluating a script', async () => {
			let calls = 0;
			const run = create.Script({
				script: 'return touch(name)', inputSchema: z.object({ name: z.string() }),
				context: { name: 'Configured', touch: (name: string) => { calls++; return name; } },
			});
			await rejects(() => run({ name: 42 } as never), ConfigError);
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

	describe('Prompt renderer contracts', () => {
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
