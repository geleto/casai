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
			const factories = [create.Config as (...args: never[]) => unknown, create.LLMAgent.withFunction as (...args: never[]) => unknown, create.LLMAgent.withFunction.asStream as (...args: never[]) => unknown];
			for (const factory of factories) {
				expect(() => { Reflect.apply(factory, undefined, [settings]); }).to.throw(ConfigError);
				expect(() => { Reflect.apply(factory, undefined, [{}, { config: settings }]); }).to.throw(ConfigError);
			}
		}
		expect(preparations).to.equal(0);
		expect(model.doGenerateCalls.length + model.doStreamCalls.length).to.equal(0);
	});

	it('checks named literal source fragments before constructing an agent', () => {
		assert.equal(create.Config({ promptType: 'text-name', prompt: 'question.txt' }).config.prompt, 'question.txt');
		assert.throws(() => create.Config({ promptType: 'text-name', prompt: [] } as never), ConfigError);
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

	it('rejects obsolete object generation mode in fragments, factories and inherited settings', () => {
		for (const mode of ['auto', 'json', 'tool', undefined]) {
			const settings = { model, output: Output.object({ schema }), prompt: 'Answer.', mode };
			for (const construct of [
				() => create.Config(settings as never),
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
			it('leaves model selection to a child of an output-only fragment', () => {
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
			expect(() => create.Function.asTool({} as never, fragment)).to.throw(ConfigError, "'inputSchema' is a required property");
			expect(create.Function.asTool({ inputSchema }, fragment)).to.be.a('function');
		});

		it('should allow explicit undefined for optional output settings and defer a cleared execute', () => {
			const shared = create.Config({ model, output: undefined });
			expect(create.LLMAgent({ prompt: 'Answer.' }, shared)).to.be.a('function');
			const fragment = create.Config({ execute: undefined }, create.Config({ execute: () => 'Answer' }));
			expect(fragment.config.execute).to.equal(undefined);
			expect(() => create.Function({} as never, fragment)).to.throw(ConfigError, "'execute' property");
		});
	});

	describe('Incompatible supplied properties', () => {
		// Deliberately bypass TypeScript to exercise the JavaScript/dynamic-config contract.
		const conflicts: { name: string, config: Record<string, unknown>, error: RegExp }[] = [
			{ name: 'template and execute', config: { template: 'Hello', execute: () => 1 }, error: /template.*Function/ },
			{ name: 'script and execute', config: { script: 'return 1', execute: () => 1 }, error: /script.*Function/ },
			{ name: 'model and execute', config: { model, execute: () => 1 }, error: /model.*Function/ },
			{ name: 'output and execute', config: { output: 'array', execute: () => 1 }, error: /output.*Function/ },
			{ name: 'template and script', config: { template: 'Hello', script: 'return 1' }, error: /both 'template' and 'script'/ },
			{ name: 'template and model', config: { template: 'Hello', model }, error: /model.*Template/ },
			{ name: 'template and schema', config: { template: 'Hello', schema }, error: /schema.*Template/ },
			{ name: 'script and model', config: { script: 'return 1', model }, error: /model.*Script/ },
			{ name: 'script and output', config: { script: 'return 1', output: 'array' }, error: /output.*Script/ },
			{ name: 'invalid output specification', config: { output: 'array', tools: {} }, error: /AI SDK Output specification/ },
			{ name: 'model/schema and tools', config: { model, schema, tools: {} }, error: /schema.*LLMAgent/ },
			{ name: 'schema, prompt and tools without a component kind', config: { schema, prompt: 'Answer.', tools: {} }, error: /schema.*LLMAgent/ },
		];
		for (const { name, config, error } of conflicts) {
			it(`should reject ${name} in standalone and inherited fragments`, () => {
				expect(() => create.Config(config as never)).to.throw(ConfigError, error);
				expect(() => create.Config(config as never, create.Config({ context: { name: 'Alice' } }))).to.throw(ConfigError, error);
			});
		}

		it('should reject conflicts introduced across parent and child configurations', () => {
			const template = create.Config({ template: 'Hello' });
			const fn = create.Config({ execute: () => 1 });
			expect(() => create.Config({ execute: () => 1 } as never, template)).to.throw(ConfigError, /template.*Function/);
			expect(() => create.Config({ template: 'Hello' } as never, fn)).to.throw(ConfigError, /template.*Function/);
			const shared = create.Config({ schema });
			expect(() => create.Config({ tools: {} }, shared)).not.to.throw();
		});

		it('should enforce the same compatibility rules in concrete factories', () => {
			expect(() => create.Function({ execute: () => 1, template: 'Hello' } as never)).to.throw(ConfigError, /template.*Function/);
			expect(() => create.Template({ template: 'Hello', execute: () => 1 } as never)).to.throw(ConfigError, /execute.*Template/);
			expect(() => create.Script({ script: 'return 1', execute: () => 1 } as never)).to.throw(ConfigError, /execute.*Script/);
			expect(() => create.LLMAgent({ model, execute: () => 1 } as never)).to.throw(ConfigError, /execute/);
			expect(() => create.LLMAgent({ model, schema, tools: {} } as never)).to.throw(ConfigError, /schema/);
		});

		it('rejects legacy output mode strings before dispatch', () => {
			for (const factory of [create.LLMAgent, create.LLMAgent.asStream]) {
				for (const output of ['object', 'array', 'enum', 'no-schema', null]) {
					expect(() => { Reflect.apply(factory, undefined, [{ model, output, prompt: 'Answer.' }]); })
						.to.throw(ConfigError, /AI SDK Output specification/);
				}
			}
			expect(model.doGenerateCalls.length + model.doStreamCalls.length).to.equal(0);
		});
	});

	describe('Invalid supplied values', () => {
		const invalidValues: { name: string, config: Record<string, unknown>, error: RegExp }[] = [
			{ name: 'non-function execute', config: { execute: 42 }, error: /execute.*must be a function/ },
			{ name: 'unknown output mode', config: { output: 'invalid' }, error: /AI SDK Output specification/ },
			{ name: 'non-array enum', config: { enum: 'YES' }, error: /Unsupported configuration properties/ },
			{ name: 'non-string enum entries', config: { output: 'enum', enum: ['YES', 42] }, error: /Unsupported configuration properties/ },
			{ name: 'invalid prompt number', config: { prompt: 42 }, error: /prompt/ },
			{ name: 'null prompt', config: { prompt: null }, error: /prompt/ },
			{ name: 'invalid message content', config: { prompt: [{ role: 'user', content: 42 }] }, error: /invalid message objects/ },
			{ name: 'invalid message prompt', config: { prompt: [{ role: 'user', content: 42 }] }, error: /invalid message objects/ },
			{ name: 'non-function function prompt', config: { promptType: 'function', prompt: 'Hello' }, error: /prompt.*must be a function/ },
			{ name: 'message array for a template prompt', config: { promptType: 'async-template', prompt: [{ role: 'user', content: 'Hello' }] }, error: /message array is not allowed/ },
		];
		for (const { name, config, error } of invalidValues) {
			it(`should reject ${name} in standalone and inherited fragments`, () => {
				expect(() => create.Config(config as never)).to.throw(ConfigError, error);
				expect(() => create.Config(config as never, create.Config({ context: { name: 'Alice' } }))).to.throw(ConfigError, error);
			});
		}

		it('should validate malformed child messages before concatenating them with parent messages', () => {
			const parent = create.Config({ prompt: [{ role: 'user', content: 'Previous' }] });
			for (const messages of [null, {}, false, 42]) {
				expect(() => create.Config({ prompt: messages } as never, parent)).to.throw(ConfigError);
			}
		});

		it('should reject non-object configuration values', () => {
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
			{ name: 'a Template without a template', build: () => create.Template({}), error: /'template' property is required/ },
			// @ts-expect-error Inline Script creation requires a script body.
			{ name: 'a Script without a script', build: () => create.Script({}), error: /'script' property is required/ },
			{ name: 'a Template tool without an input schema', build: () => create.Template.asTool({ template: 'Hello' } as never), error: /'inputSchema' is a required property when creating a Template/ },
			{ name: 'a Script tool without an input schema', build: () => create.Script.asTool({ script: 'return 1' } as never), error: /'inputSchema' is a required property when creating a Script/ },
			// @ts-expect-error A loaded Template tool must have a configured template name.
			{ name: 'a loaded Template tool without a name', build: () => create.Template.loadsTemplate.asTool({ inputSchema, loader }), error: /'template' is a required property when creating a Template as a tool/ },
			// @ts-expect-error A loaded Script tool must have a configured script name.
			{ name: 'a loaded Script tool without a name', build: () => create.Script.loadsScript.asTool({ inputSchema, loader }), error: /'script' is a required property when creating a Script as a tool/ },
			{ name: 'a Function without execute', build: () => create.Function({} as never), error: /'execute' property in a Function config must be a function/ },
			{ name: 'a Function tool without an input schema', build: () => create.Function.asTool({ execute: () => 1 } as never), error: /'inputSchema' is a required property when creating a Function/ },
			{ name: 'a text generator tool without a prompt', build: () => create.LLMAgent.withTemplate.asTool({ model, inputSchema } as never), error: /requires inputSchema and a configured prompt/ },
			{ name: 'an object generator tool without an input schema', build: () => create.LLMAgent.withTemplate.asTool({ model, output: Output.object({ schema }), prompt: 'Hello' } as never), error: /requires inputSchema and a configured prompt/ },
			{ name: 'an object generator tool without a prompt', build: () => create.LLMAgent.withTemplate.asTool({ model, output: Output.object({ schema }), inputSchema } as never), error: /requires inputSchema and a configured prompt/ },
			{ name: 'a loaded object streamer without a loader', build: () => create.LLMAgent.loadsTemplate.asStream({ model, output: Output.object({ schema }), prompt: 'name' } as never), error: /require a loader/ },
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
