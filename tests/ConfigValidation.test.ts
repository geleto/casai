import assert from 'node:assert/strict';
import { expect } from 'chai';
import { MockLanguageModelV3 } from 'ai/test';
import { generateObject, streamObject, InvalidArgumentError } from 'ai';
import { create, ConfigError, ValidationError, z } from './cascada';

describe('Config validation', () => {
	const model = new MockLanguageModelV3();
	const schema = z.object({ value: z.number() });
	const inputSchema = z.object({ name: z.string() });

	const invalidOutputSettings = [
		{ output: 'object', enum: ['YES'] },
		{ output: 'array', enum: ['YES'] },
		{ output: 'enum', schema },
		{ output: 'enum', schemaName: 'Answer' },
		{ output: 'enum', schemaDescription: 'An answer' },
		{ output: 'no-schema', schema },
		{ output: 'no-schema', schemaName: 'Answer' },
		{ output: 'no-schema', schemaDescription: 'An answer' },
		{ output: 'no-schema', enum: ['YES'] },
	] as const;

	it('rejects incompatible object output settings before preparers or provider calls', async () => {
		const localModel = new MockLanguageModelV3();
		let preparations = 0;
		const prompt = () => { preparations++; return 'Answer'; };
		for (const invalid of invalidOutputSettings) {
			const settings = { model: localModel, ...(invalid.output === 'object' || invalid.output === 'array' ? { schema } : {}),
				...(invalid.output === 'enum' ? { enum: ['YES'] } : {}), ...invalid };
			// Deliberately erase types to exercise JavaScript callers and raw parent providers.
			expect(() => { Reflect.apply(create.Config, undefined, [settings]); }).to.throw(ConfigError, /not supported/);
			const factories = invalid.output === 'enum' ? [create.ObjectGenerator] : [create.ObjectGenerator, create.ObjectStreamer];
			for (const factory of factories) {
				for (const args of [[settings], [{}, { config: settings }]]) {
					expect(() => { Reflect.apply(factory, undefined, args); }).to.throw(ConfigError, /not supported/);
				}
				expect(() => { Reflect.apply(factory.withFunction, undefined, [{ ...settings, prompt }]); }).to.throw(ConfigError, /not supported/);
				expect(() => { Reflect.apply(factory.withScript, undefined, [{ ...settings, prompt: 'return "Answer"' }]); }).to.throw(ConfigError, /not supported/);
			}
			expect(() => { Reflect.apply(create.ObjectGenerator.withFunction.asTool, undefined, [{ ...settings, prompt, inputSchema }]); }).to.throw(ConfigError, /not supported/);
			for (const native of invalid.output === 'enum' ? [generateObject] : [generateObject, streamObject]) {
				// The SDK forwards metadata to its validator only when a schema property exists.
				await assert.rejects(async () => { await Reflect.apply(native, undefined, [{ schema: undefined, ...settings, prompt: 'Answer' }]); }, InvalidArgumentError);
			}
		}
		expect(preparations).to.equal(0);
		expect(localModel.doGenerateCalls.length + localModel.doStreamCalls.length).to.equal(0);
	});

	it('preserves incomplete object fragments and clears incompatible inherited output settings', () => {
		const enumeration = create.Config({ enum: ['YES', 'NO'] });
		expect(create.ObjectGenerator({ model, output: 'enum' }, enumeration)).to.be.a('function');
		const object = create.Config({ schema, schemaName: 'Answer', schemaDescription: 'An answer' });
		expect(create.ObjectGenerator({ model }, object)).to.be.a('function');
		expect(create.ObjectStreamer({ model }, object)).to.be.a('function');
		expect(create.ObjectGenerator({ model, output: 'array' }, object)).to.be.a('function');
		expect(create.ObjectStreamer({ model, output: 'array' }, object)).to.be.a('function');
		expect(create.ObjectGenerator({ model, output: 'no-schema', schema: undefined, schemaName: undefined, schemaDescription: undefined }, object)).to.be.a('function');
		expect(create.ObjectStreamer({ model, output: 'no-schema', schema: undefined, schemaName: undefined, schemaDescription: undefined }, object)).to.be.a('function');
		expect(create.ObjectGenerator({ model, output: 'enum', enum: ['YES'], schema: undefined, schemaName: undefined, schemaDescription: undefined }, object)).to.be.a('function');
		expect(create.ObjectGenerator({ model, schema, output: 'object', enum: undefined }, enumeration)).to.be.a('function');
		expect(object.config.schema).to.equal(schema);
		expect(enumeration.config.enum).to.deep.equal(['YES', 'NO']);
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

	it('rejects clearing an inherited schema while selecting array output', () => {
		const parent = create.Config({ model, schema });
		for (const factory of [create.ObjectGenerator, create.ObjectStreamer]) {
			expect(() => { Reflect.apply(factory, undefined, [{ schema: undefined, output: 'array' }, parent]); })
				.to.throw(ConfigError, /requires a 'schema'/);
		}
		expect(model.doGenerateCalls.length + model.doStreamCalls.length).to.equal(0);
	});

	it('rejects obsolete object generation mode in fragments, factories and inherited settings', () => {
		for (const mode of ['auto', 'json', 'tool', undefined]) {
			const settings = { model, schema, prompt: 'Answer.', mode };
			for (const construct of [
				() => create.Config(settings as never),
				() => create.ObjectGenerator(settings as never),
				() => create.ObjectStreamer(settings as never),
				(): unknown => Reflect.apply(create.ObjectGenerator, undefined, [{}, { config: settings }]),
				(): unknown => Reflect.apply(create.ObjectStreamer, undefined, [{}, { config: settings }]),
			]) expect(construct).to.throw(ConfigError, "'mode' is not supported");
		}
	});

	it('rejects obsolete object generation mode in run settings', async () => {
		const generator = create.ObjectGenerator({ model, schema, prompt: 'Answer.' });
		const streamer = create.ObjectStreamer({ model, schema, prompt: 'Answer.' });
		await assert.rejects(generator.run({ mode: 'tool' } as never), { name: 'ValidationError', message: /'mode' is not supported/ });
		expect(() => streamer.run({ mode: 'json' } as never)).to.throw(ValidationError, "'mode' is not supported");
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
			expect(create.ObjectGenerator({ model, prompt: 'Answer.' }, shared)).to.be.a('function');
		});

		it('should allow a model-only fragment to serve text and object generators', () => {
			const shared = create.Config({ model });
			expect(create.TextGenerator({ prompt: 'Answer.' }, shared)).to.be.a('function');
			expect(create.ObjectGenerator({ schema, prompt: 'Answer.' }, shared)).to.be.a('function');
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
				expect(() => { Reflect.apply(create.ObjectGenerator, undefined, [{}, fragment]); }).to.throw(ConfigError, "require a 'model'");
				if (output === 'object' || output === 'array') {
					expect(() => { Reflect.apply(create.ObjectGenerator, undefined, [{ model }, fragment]); }).to.throw(ConfigError, "requires a 'schema'");
				}
			});
		}

		it('should allow enum values and model settings to be supplied later', () => {
			const fragment = create.Config({ output: 'enum' });
			expect(create.ObjectGenerator({ model, enum: ['YES', 'NO'], prompt: 'Answer.' }, fragment)).to.be.a('function');
			expect(() => create.ObjectGenerator({ model } as never, fragment)).to.throw(ConfigError, "requires an 'enum'");
			expect(() => { Reflect.apply(create.ObjectStreamer, undefined, [{ model, enum: ['YES'] }, fragment]); })
				.to.throw(ConfigError, 'Object streamers do not support "enum" output.');
		});

		it('should defer a function prompt and named loader until component creation', () => {
			const functionPrompt = create.Config({ promptType: 'function', context: { name: 'Alice' } });
			expect(create.TextGenerator.withFunction({ model, prompt: ({ name }) => `Hello ${name}` }, functionPrompt)).to.be.a('function');
			expect(() => create.TextGenerator.withFunction({ model } as never, functionPrompt))
				.to.throw(ConfigError, "The 'prompt' property must be a function");
			const templateName = create.Config({ template: 'greeting', promptType: 'async-template-name' });
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
			{ name: 'template and script', config: { template: 'Hello', script: 'return 1' }, error: /both 'template' and 'script'/ },
			{ name: 'template and model', config: { template: 'Hello', model }, error: /model.*Template/ },
			{ name: 'template and schema', config: { template: 'Hello', schema }, error: /schema.*Template/ },
			{ name: 'script and model', config: { script: 'return 1', model }, error: /model.*Script/ },
			{ name: 'script and output', config: { script: 'return 1', output: 'array' }, error: /output.*Script/ },
			{ name: 'object output and tools', config: { output: 'array', tools: {} }, error: /tools.*Object/ },
			{ name: 'model/schema and tools', config: { model, schema, tools: {} }, error: /tools.*Object/ },
			{ name: 'schema, prompt and tools without a component kind', config: { schema, prompt: 'Answer.', tools: {} }, error: /do not belong to any single component/ },
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
			expect(() => create.TextGenerator({ model, execute: () => 1 } as never)).to.throw(ConfigError, /execute.*Text/);
			expect(() => create.ObjectGenerator({ model, schema, tools: {} } as never)).to.throw(ConfigError, /tools.*Object/);
		});

		it('rejects object output modes in text factories before dispatch', () => {
			for (const factory of [create.TextGenerator, create.TextStreamer]) {
				for (const output of ['object', 'array', 'enum', 'no-schema', null]) {
					expect(() => { Reflect.apply(factory, undefined, [{ model, output, prompt: 'Answer.' }]); })
						.to.throw(ConfigError, /AI SDK output specification/);
				}
			}
			expect(model.doGenerateCalls.length + model.doStreamCalls.length).to.equal(0);
		});
	});

	describe('Invalid supplied values', () => {
		const invalidValues: { name: string, config: Record<string, unknown>, error: RegExp }[] = [
			{ name: 'non-function execute', config: { execute: 42 }, error: /execute.*must be a function/ },
			{ name: 'unknown output mode', config: { output: 'invalid' }, error: /Invalid 'output' mode/ },
			{ name: 'non-array enum', config: { enum: 'YES' }, error: /enum.*string array/ },
			{ name: 'non-string enum entries', config: { output: 'enum', enum: ['YES', 42] }, error: /enum.*string array/ },
			{ name: 'non-array messages', config: { messages: 'Hello' }, error: /invalid message objects/ },
			{ name: 'null messages', config: { messages: null }, error: /invalid message objects/ },
			{ name: 'invalid message content', config: { messages: [{ role: 'user', content: 42 }] }, error: /invalid message objects/ },
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
