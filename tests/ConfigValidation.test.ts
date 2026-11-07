import { Output } from 'ai';
import assert from 'node:assert/strict';
import { expect } from 'chai';
import { MockLanguageModelV3 } from 'ai/test';
import { create, ConfigError, ValidationError, z } from './cascada';

describe('Config validation', () => {
	const model = new MockLanguageModelV3();
	const schema = z.object({ value: z.number() });
	const inputSchema = z.object({ name: z.string() });

	it('rejects retired output settings before preparers or provider calls', () => {
		let preparations = 0;
		for (const key of ['enum', 'schemaName', 'schemaDescription', 'mode', 'callOptionsSchema']) {
			const settings = { model, [key]: undefined, prompt: () => { preparations++; return 'Answer'; } };
			const factories = [create.LLMAgent.withFunction as (...args: never[]) => unknown, create.LLMAgent.withFunction.asStream as (...args: never[]) => unknown];
			for (const factory of factories) {
				expect(() => { Reflect.apply(factory, undefined, [settings]); }).to.throw(ConfigError);
				expect(() => { Reflect.apply(factory, undefined, [{}, { config: settings }]); }).to.throw(ConfigError);
			}
		}
		expect(preparations).to.equal(0);
		expect(model.doGenerateCalls.length + model.doStreamCalls.length).to.equal(0);
	});

	it('checks named literal sources when constructing an agent', () => {
		assert.equal(create.Config({ promptType: 'text-name', prompt: 'question.txt' }).config.prompt, 'question.txt');
		const fragment = create.Config({ promptType: 'text-name', prompt: [] } as never);
		assert.throws(() => create.LLMAgent({ model }, fragment), ConfigError);
	});

	it('inherits, replaces and clears complete output specifications', () => {
		const output = Output.object({ schema, name: 'Answer', description: 'An answer' });
		const parent = create.Config({ output });
		const alternatives = [Output.array({ element: schema }), Output.choice({ options: ['YES', 'NO'] }), Output.json(), undefined];
		for (const factory of [create.LLMAgent, create.LLMAgent.asStream]) {
			expect(factory({ model }, parent).config.output).to.equal(output);
			for (const replacement of alternatives) expect(factory({ model, output: replacement }, parent).config.output).to.equal(replacement);
		}
		expect(parent.config.output).to.equal(output);
	});

	it('clears an inherited optional Script output schema on ordinary and tool paths', async () => {
		const parent = create.Config({ script: 'return "raw"', schema: z.number() });
		const script = create.Script({ schema: undefined }, parent);
		const tool = create.Script.asTool({ schema: undefined, inputSchema: z.object({}) }, parent);
		expect(await script()).to.equal('raw');
		expect(await script.run({})).to.equal('raw');
		expect(await tool()).to.equal('raw');
		expect(await tool.execute({}, { toolCallId: 'call', messages: [], context: undefined })).to.equal('raw');
		expect(script.config.schema).to.equal(undefined);
		expect(tool.config.schema).to.equal(undefined);
		expect(parent.config.schema).not.to.equal(undefined);
	});

	it('checks obsolete object generation mode at completed agents, including inherited fragments', () => {
		for (const mode of ['auto', 'json', 'tool', undefined]) {
			const settings = { model, output: Output.object({ schema }), prompt: 'Answer.', mode };
			const fragment = create.Config(settings as never);
			for (const construct of [
				(): unknown => Reflect.apply(create.LLMAgent, undefined, [{}, fragment]),
				() => create.LLMAgent(settings as never),
				() => create.LLMAgent.asStream(settings as never),
				(): unknown => Reflect.apply(create.LLMAgent, undefined, [{}, { config: settings }]),
				(): unknown => Reflect.apply(create.LLMAgent.asStream, undefined, [{}, { config: settings }]),
			]) expect(construct).to.throw(ConfigError, "'mode' is not supported");
		}
	});

	it('rejects obsolete object generation mode in run settings', async () => {
		const generator = create.LLMAgent({ model, prompt: 'Answer.', output: Output.object({ schema: schema }) });
		const streamer = create.LLMAgent.asStream({ model, prompt: 'Answer.', output: Output.object({ schema: schema }) });
		await assert.rejects(generator.run({ mode: 'tool' } as never), ValidationError);
		await assert.rejects(streamer.run({ mode: 'json' } as never), ValidationError);
		expect(model.doGenerateCalls).to.have.length(0);
		expect(model.doStreamCalls).to.have.length(0);
	});

	describe('Partial configurations', () => {
		it('should identify Functions and Scripts before their shared output schema', async () => {
			const functionConfig = create.Config({ schema, execute: () => ({ value: 17 }) });
			const scriptConfig = create.Config({ schema, script: 'return { value: 17 }' });
			expect(await create.Function({}, functionConfig)({})).to.deep.equal({ value: 17 });
			expect(await create.Script({}, scriptConfig)()).to.deep.equal({ value: 17 });
		});

		it('should allow a schema-only fragment to serve different component kinds', async () => {
			const shared = create.Config({ schema });
			expect(await create.Function({ execute: () => ({ value: 17 }) }, shared)({})).to.deep.equal({ value: 17 });
			expect(await create.Script({ script: 'return { value: 17 }' }, shared)()).to.deep.equal({ value: 17 });
			// @ts-expect-error LLM output uses a complete SDK specification.
			expect(() => create.LLMAgent({ model, prompt: 'Answer.' }, shared)).to.throw(ConfigError);
		});

		it('should allow a model-only fragment to serve text and object generators', () => {
			const shared = create.Config({ model });
			expect(create.LLMAgent({ prompt: 'Answer.' }, shared)).to.be.a('function');
			expect(create.LLMAgent({ prompt: 'Answer.', output: Output.object({ schema: schema }) }, shared)).to.be.a('function');
		});

		for (const output of [Output.object({ schema }), Output.array({ element: schema }), Output.choice({ options: ['YES'] }), Output.json()]) {
			it(`leaves model selection to a child of an output-only fragment: ${output.name}`, () => {
				const fragment = create.Config({ output });
				expect(fragment.config.output).to.equal(output);
				expect(() => { Reflect.apply(create.LLMAgent, undefined, [{}, fragment]); }).to.throw(ConfigError, /requires a 'model'/);
				expect(create.LLMAgent({ model }, fragment)).to.be.a('function');
			});
		}

		it('should defer a function prompt and named loader until component creation', () => {
			const functionPrompt = create.Config({ promptType: 'function', context: { name: 'Alice' } });
			expect(create.LLMAgent.withFunction({ model, prompt: ({ name }) => `Hello ${name}` }, functionPrompt)).to.be.a('function');
			expect(create.LLMAgent.withFunction({ model }, functionPrompt)).to.be.a('function');
			const templateName = create.Config({ template: 'greeting', promptType: 'async-template-name' });
			expect(templateName.config.template).to.equal('greeting');
			expect(() => create.Template.loadsTemplate({} as never, templateName)).to.throw(ConfigError);
		});

		it('should leave tool requirements to the .asTool factory', () => {
			const fragment = create.Config({ execute: () => 'Answer' });
			expect(() => create.Function.asTool({} as never, fragment)).to.throw(ConfigError, "requires 'inputSchema'");
			expect(create.Function.asTool({ inputSchema }, fragment)).to.be.a('function');
		});

		it('should allow explicit undefined for optional output settings and defer a cleared execute', () => {
			const shared = create.Config({ model, output: undefined });
			expect(create.LLMAgent({ prompt: 'Answer.' }, shared)).to.be.a('function');
			const fragment = create.Config({ execute: undefined }, create.Config({ execute: () => 'Answer' }));
			expect(fragment.config.execute).to.equal(undefined);
			expect(() => create.Function({} as never, fragment)).to.throw(ConfigError, "requires 'execute'");
		});
	});

	describe('Fragment and component validation boundaries', () => {
		it('leaves component-specific fields to the completed component', () => {
			const fragment = create.Config({ model, schema, prompt: 'Answer' } as never);
			expect(() => create.LLMAgent({} as never, fragment)).to.throw(ConfigError, /schema/);
			const malformed = create.Config({ execute: 42 } as never);
			expect(() => create.Function({} as never, malformed)).to.throw(ConfigError, /must be a function/);
		});

		it('checks the resolved fields of each completed component', () => {
			for (const { factory, config, invalid } of [
				{ factory: create.Function, config: { execute: () => 1 }, invalid: ['model', 'prompt', 'template', 'script', 'loader', 'renderOptions', 'output', 'unknown'] },
				{ factory: create.Template, config: { template: 'Hello' }, invalid: ['model', 'prompt', 'script', 'execute', 'schema', 'output', 'unknown'] },
				{ factory: create.Script, config: { script: 'return 1' }, invalid: ['model', 'prompt', 'template', 'execute', 'output', 'unknown'] },
			]) {
				for (const key of invalid) {
					const fragment = create.Config({ [key]: undefined } as never);
					expect(() => { Reflect.apply(factory, undefined, [{ ...config, [key]: undefined }]); }).to.throw(ConfigError, key);
					expect(() => { Reflect.apply(factory, undefined, [config, fragment]); }).to.throw(ConfigError, key);
				}
			}
		});

		it('rejects legacy output modes and malformed prompts at the agent boundary', () => {
			for (const factory of [create.LLMAgent, create.LLMAgent.asStream]) {
				for (const output of ['object', 'array', 'enum', 'no-schema', null]) {
					const fragment = create.Config({ output } as never);
					expect(() => factory({ model }, fragment)).to.throw(ConfigError, /AI SDK Output specification/);
				}
				for (const prompt of [42, null, [{ role: 'user', content: 42 }]]) {
					const fragment = create.Config({ prompt } as never);
					expect(() => factory({ model }, fragment)).to.throw(ConfigError, /invalid message objects/);
				}
			}
			expect(model.doGenerateCalls.length + model.doStreamCalls.length).to.equal(0);
		});

		it('rejects non-object configuration values', () => {
			for (const invalid of [undefined, null, [], 'config', 42]) {
				expect(() => create.Config(invalid as never)).to.throw(ConfigError, 'Config must be an object.');
			}
		});
	});

	describe('Factory requirements', () => {
		// Deliberately bypass TypeScript to exercise the runtime checks behind the compile-time requirements.
		const loader = { load: () => 'Loaded' };
		const requirements: { name: string, build: () => unknown, error: RegExp }[] = [
			// @ts-expect-error Inline Template creation requires a template body.
			{ name: 'a Template without a template', build: () => create.Template({}), error: /requires 'template'/ },
			// @ts-expect-error Inline Script creation requires a script body.
			{ name: 'a Script without a script', build: () => create.Script({}), error: /requires 'script'/ },
			{ name: 'a Template tool without an input schema', build: () => create.Template.asTool({ template: 'Hello' } as never), error: /requires 'inputSchema'/ },
			{ name: 'a Script tool without an input schema', build: () => create.Script.asTool({ script: 'return 1' } as never), error: /requires 'inputSchema'/ },
			// @ts-expect-error A loaded Template tool must have a configured template name.
			{ name: 'a loaded Template tool without a name', build: () => create.Template.loadsTemplate.asTool({ inputSchema, loader }), error: /requires 'template'/ },
			// @ts-expect-error A loaded Script tool must have a configured script name.
			{ name: 'a loaded Script tool without a name', build: () => create.Script.loadsScript.asTool({ inputSchema, loader }), error: /requires 'script'/ },
			{ name: 'a Function without execute', build: () => create.Function({} as never), error: /requires 'execute'/ },
			{ name: 'a Function tool without an input schema', build: () => create.Function.asTool({ execute: () => 1 } as never), error: /requires 'inputSchema'/ },
			{ name: 'a text generator tool without a prompt', build: () => create.LLMAgent.withTemplate.asTool({ model, inputSchema } as never), error: /requires 'prompt'/ },
			{ name: 'an object generator tool without an input schema', build: () => create.LLMAgent.withTemplate.asTool({ model, output: Output.object({ schema }), prompt: 'Hello' } as never), error: /requires 'inputSchema'/ },
			{ name: 'an object generator tool without a prompt', build: () => create.LLMAgent.withTemplate.asTool({ model, output: Output.object({ schema }), inputSchema } as never), error: /requires 'prompt'/ },
			{ name: 'a loaded object streamer without a loader', build: () => create.LLMAgent.loadsTemplate.asStream({ model, output: Output.object({ schema }), prompt: 'name' } as never), error: /requires 'loader'/ },
		];
		for (const { name, build, error } of requirements) {
			it(`should reject ${name} at creation`, () => {
				expect(build).to.throw(ConfigError, error);
			});
		}

		it('should treat an explicitly undefined or null loader as missing', () => {
			for (const missing of [undefined, null]) {
				const builds = [
					() => create.Template.loadsTemplate({ template: 'name', loader: missing } as never),
					() => create.Script.loadsScript({ script: 'name', loader: missing } as never),
					() => create.LLMAgent.loadsText({ model, prompt: 'name', loader: missing } as never),
					() => create.LLMAgent.loadsTemplate.asStream({ model, prompt: 'name', loader: missing } as never),
					() => create.LLMAgent.loadsScript({ model, output: Output.object({ schema }), prompt: 'name', loader: missing } as never),
				];
				for (const build of builds) {
					expect(build).to.throw(ConfigError, /loader/);
				}
			}
		});

		it('should keep an inherited loader when a child loader is explicitly undefined', async () => {
			const parent = create.Config({ loader: { load: (name: string) => `Hello from ${name}` } });
			expect(await create.Template.loadsTemplate({ template: 'parent', loader: undefined }, parent)()).to.equal('Hello from parent');
		});
	});
});
