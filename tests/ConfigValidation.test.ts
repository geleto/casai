import { expect } from 'chai';
import { MockLanguageModelV3 } from 'ai/test';
import { create, ConfigError, z } from './cascada';

describe('Config validation', () => {
	const model = new MockLanguageModelV3();
	const schema = z.object({ value: z.number() });
	const inputSchema = z.object({ name: z.string() });

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
			expect(create.ObjectGenerator({ model, prompt: 'Answer.' }, shared)).to.be.a('function');
		});

		it('should allow a model-only fragment to serve text and object generators', () => {
			const shared = create.Config({ model });
			expect(create.TextGenerator({ prompt: 'Answer.' }, shared)).to.be.a('function');
			expect(create.ObjectGenerator({ schema, prompt: 'Answer.' }, shared)).to.be.a('function');
			const objectSettings = create.Config({ model, mode: 'json' });
			expect(create.ObjectGenerator({ schema, prompt: 'Answer.' }, objectSettings)).to.be.a('function');
		});

		for (const [output, makeFragment] of [
			['object', () => create.Config({ output: 'object' })],
			['array', () => create.Config({ output: 'array' })],
			['enum', () => create.Config({ output: 'enum' })],
			['no-schema', () => create.Config({ output: 'no-schema' })],
		] as const) {
			it(`should defer required properties for ${output} output to the component`, () => {
				const fragment = makeFragment();
				expect(fragment.config.output).to.equal(output);
				expect(() => create.ObjectGenerator({} as never, fragment as never)).to.throw(ConfigError, "require a 'model'");
				if (output === 'object' || output === 'array') {
					expect(() => create.ObjectGenerator({ model } as never, fragment as never)).to.throw(ConfigError, "requires a 'schema'");
				}
			});
		}

		it('should allow enum values and model settings to be supplied later', () => {
			const fragment = create.Config({ output: 'enum' });
			expect(create.ObjectGenerator({ model, enum: ['YES', 'NO'], prompt: 'Answer.' }, fragment)).to.be.a('function');
			expect(() => create.ObjectGenerator({ model } as never, fragment)).to.throw(ConfigError, "requires an 'enum'");
			expect(() => create.ObjectStreamer({ model, enum: ['YES'] } as never, fragment as never))
				.to.throw(ConfigError, 'Object streamers do not support "enum" output.');
		});

		it('should defer a function prompt and named loader until component creation', () => {
			const functionPrompt = create.Config({ promptType: 'function', context: { name: 'Alice' } });
			expect(create.TextGenerator.withFunction({ model, prompt: ({ name }) => `Hello ${name}` }, functionPrompt)).to.be.a('function');
			expect(() => create.TextGenerator.withFunction({ model } as never, functionPrompt))
				.to.throw(ConfigError, "The 'prompt' property must be a function");
			const templateName = create.Config({ template: 'greeting', promptType: 'template-name' });
			expect(templateName.config.template).to.equal('greeting');
			expect(() => create.Template.loadsTemplate({} as never, templateName)).to.throw(ConfigError, "A 'loader' is required");
		});

		it('should leave tool requirements to the .asTool factory', () => {
			const fragment = create.Config({ execute: () => 'Answer' });
			expect(() => create.Function.asTool({} as never, fragment)).to.throw(ConfigError, "'inputSchema' is a required property");
			expect(create.Function.asTool({ inputSchema }, fragment)).to.be.a('function');
		});

		it('should allow explicit undefined for optional output settings and defer a cleared execute', () => {
			const shared = create.Config({ model, schema, output: undefined });
			expect(create.ObjectGenerator({ prompt: 'Answer.' }, shared)).to.be.a('function');
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
			{ name: 'tools and execute', config: { tools: {}, execute: () => 1 }, error: /tools.*Function/ },
			{ name: 'template and script', config: { template: 'Hello', script: 'return 1' }, error: /both 'template' and 'script'/ },
			{ name: 'template and model', config: { template: 'Hello', model }, error: /model.*Template/ },
			{ name: 'template and schema', config: { template: 'Hello', schema }, error: /schema.*Template/ },
			{ name: 'script and model', config: { script: 'return 1', model }, error: /model.*Script/ },
			{ name: 'script and output', config: { script: 'return 1', output: 'array' }, error: /output.*Script/ },
			{ name: 'object output and tools', config: { output: 'array', tools: {} }, error: /tools.*Object/ },
			{ name: 'model/schema and tools', config: { model, schema, tools: {} }, error: /tools.*Object/ },
			{ name: 'shared schema and tools', config: { schema, tools: {} }, error: /any single component/ },
			{ name: 'shared schema and tool contexts', config: { schema, toolsContext: {} }, error: /any single component/ },
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
			expect(() => create.Config({ tools: {} } as never, shared)).to.throw(ConfigError, /any single component/);
		});

		it('should enforce the same compatibility rules in concrete factories', () => {
			expect(() => create.Function({ execute: () => 1, template: 'Hello' } as never)).to.throw(ConfigError, /template.*Function/);
			expect(() => create.Template({ template: 'Hello', execute: () => 1 } as never)).to.throw(ConfigError, /execute.*Template/);
			expect(() => create.Script({ script: 'return 1', execute: () => 1 } as never)).to.throw(ConfigError, /execute.*Script/);
			expect(() => create.TextGenerator({ model, execute: () => 1 } as never)).to.throw(ConfigError, /execute.*Text/);
			expect(() => create.ObjectGenerator({ model, schema, tools: {} } as never)).to.throw(ConfigError, /tools.*Object/);
		});
	});

	describe('Invalid supplied values', () => {
		const invalidValues: { name: string, config: Record<string, unknown>, error: RegExp }[] = [
			{ name: 'non-function execute', config: { execute: 42 }, error: /execute.*must be a function/ },
			{ name: 'unknown output mode', config: { output: 'invalid' }, error: /Invalid 'output' mode/ },
			{ name: 'non-array enum', config: { enum: 'YES' }, error: /enum.*string array/ },
			{ name: 'non-string enum entries', config: { output: 'enum', enum: ['YES', 42] }, error: /enum.*string array/ },
			{ name: 'non-object Template input schema', config: { template: 'Hello', inputSchema: z.string() }, error: /inputSchema.*Zod object/ },
			{ name: 'non-object Script input schema', config: { script: 'return 1', inputSchema: z.string() }, error: /inputSchema.*Zod object/ },
			{ name: 'non-array messages', config: { messages: 'Hello' }, error: /invalid message objects/ },
			{ name: 'null messages', config: { messages: null }, error: /invalid message objects/ },
			{ name: 'invalid message content', config: { messages: [{ role: 'user', content: 42 }] }, error: /invalid message objects/ },
			{ name: 'invalid message prompt', config: { prompt: [{ role: 'user', content: 42 }] }, error: /invalid message objects/ },
			{ name: 'non-function function prompt', config: { promptType: 'function', prompt: 'Hello' }, error: /prompt.*must be a function/ },
			{ name: 'message array for a template prompt', config: { promptType: 'template', prompt: [{ role: 'user', content: 'Hello' }] }, error: /message array is not allowed/ },
		];
		for (const { name, config, error } of invalidValues) {
			it(`should reject ${name} in standalone and inherited fragments`, () => {
				expect(() => create.Config(config as never)).to.throw(ConfigError, error);
				expect(() => create.Config(config as never, create.Config({ context: { name: 'Alice' } }))).to.throw(ConfigError, error);
			});
		}

		it('should validate malformed child messages before concatenating them with parent messages', () => {
			const parent = create.Config({ messages: [{ role: 'user', content: 'Previous' }] });
			for (const messages of [null, {}, false, 42]) {
				expect(() => create.Config({ messages } as never, parent)).to.throw(ConfigError, /invalid message objects/);
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
			{ name: 'a Template without a template', build: () => create.Template({} as never), error: /'template' property is required/ },
			{ name: 'a Script without a script', build: () => create.Script({} as never), error: /'script' property is required/ },
			{ name: 'a Template tool without an input schema', build: () => create.Template.asTool({ template: 'Hello' } as never), error: /'inputSchema' is a required property when creating a Template/ },
			{ name: 'a Script tool without an input schema', build: () => create.Script.asTool({ script: 'return 1' } as never), error: /'inputSchema' is a required property when creating a Script/ },
			{ name: 'a loaded Template tool without a name', build: () => create.Template.loadsTemplate.asTool({ inputSchema, loader } as never), error: /'template' is a required property when creating a Template as a tool/ },
			{ name: 'a loaded Script tool without a name', build: () => create.Script.loadsScript.asTool({ inputSchema, loader } as never), error: /'script' is a required property when creating a Script as a tool/ },
			{ name: 'a Function without execute', build: () => create.Function({} as never), error: /'execute' property in a Function config must be a function/ },
			{ name: 'a Function tool without an input schema', build: () => create.Function.asTool({ execute: () => 1 } as never), error: /'inputSchema' is a required property when creating a Function/ },
			{ name: 'a text generator tool without a prompt', build: () => create.TextGenerator.withTemplate.asTool({ model, inputSchema } as never), error: /'prompt' is a required property when creating a TextGenerator/ },
			{ name: 'an object generator tool without an input schema', build: () => create.ObjectGenerator.withTemplate.asTool({ model, schema, prompt: 'Hello' } as never), error: /'inputSchema' is a required property when creating a ObjectGenerator/ },
			{ name: 'an object generator tool without a prompt', build: () => create.ObjectGenerator.withTemplate.asTool({ model, schema, inputSchema } as never), error: /'prompt' is a required property when creating a ObjectGenerator/ },
			{ name: 'a loaded object streamer without a loader', build: () => create.ObjectStreamer.loadsTemplate({ model, schema, prompt: 'name' } as never), error: /'loader' is required/ },
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
					() => create.TextGenerator.loadsText({ model, prompt: 'name', loader: missing } as never),
					() => create.TextStreamer.loadsTemplate({ model, prompt: 'name', loader: missing } as never),
					() => create.ObjectGenerator.loadsScript({ model, schema, prompt: 'name', loader: missing } as never),
				];
				for (const build of builds) {
					expect(build).to.throw(ConfigError, /'loader' is required/);
				}
			}
		});

		it('should keep an inherited loader when a child loader is explicitly undefined', async () => {
			const parent = create.Config({ loader: { load: (name: string) => `Hello from ${name}` } });
			expect(await create.Template.loadsTemplate({ template: 'parent', loader: undefined }, parent)()).to.equal('Hello from parent');
		});
	});
});
