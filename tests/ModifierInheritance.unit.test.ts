import assert from 'node:assert/strict';
import { create, z, ConfigError } from './cascada';
import { MockLanguageModelV3 } from 'ai/test';
import { modelFor } from './fixtures/phase2-security-sdk.js';

describe('modifier inheritance', () => {
	it('inherits loaded Template and Script sources through Config and supports explicit inline sources', async () => {
		const template = create.Template.loadsTemplate({ template: 'entry', loader: { load: () => 'hello {{ name }}' }, context: { name: 'Ada' } });
		const script = create.Script.loadsScript({ script: 'entry', loader: { load: () => 'return name' }, context: { name: 'Ada' } });
		assert.equal(await create.Template({}, create.Config({}, template))(), 'hello Ada');
		assert.equal(await create.Script({}, create.Config({}, script))(), 'Ada');
		assert.equal(await create.Template.withTemplate({ template: 'inline {{ name }}' }, template)(), 'inline Ada');
		assert.equal(await create.Script.withScript({ script: "return 'inline ' + name" }, script)(), 'inline Ada');
	});

	it('inherits tool mode on every coded component, including through Config', async () => {
		const inputSchema = z.object({ name: z.string() });
		const template = create.Template.asTool({ inputSchema, template: '{{ name }}' });
		const script = create.Script.asTool({ inputSchema, script: 'return name', schema: z.string() });
		const fn = create.Function.asTool({ inputSchema, execute: ({ name }) => name });
		const children = [create.Template({}, create.Config({}, template)), create.Script({}, create.Config({}, script)), create.Function({}, create.Config({}, fn))];
		for (const child of children) {
			assert.equal(child.config.asTool, true);
			assert.equal(await child.execute({ name: 'Ada' }, { toolCallId: 'test', messages: [], context: undefined }), 'Ada');
		}
		assert.throws(() => create.Template({ inputSchema: undefined } as never, template), ConfigError);
		assert.throws(() => create.Script({ inputSchema: undefined } as never, script), ConfigError);
		assert.throws(() => create.Function({ inputSchema: undefined } as never, fn), ConfigError);
	});

	it('inherits an LLMAgent source, streaming and tool mode together', () => {
		const parent = create.LLMAgent.withTemplate.asStream.asTool({ model: new MockLanguageModelV3(), inputSchema: z.object({}), prompt: 'hello' });
		const child = create.LLMAgent({}, create.Config({ asTool: undefined, streaming: undefined }, parent));
		assert.equal(child.config.promptType, 'async-template');
		assert.equal(child.config.streaming, true);
		assert.equal(child.config.asTool, true);
		assert.equal(typeof child.execute, 'function');
		assert.equal('generate' in child, false);
		assert.equal('id' in child, false);
		const literal = create.LLMAgent.withText({}, child);
		assert.equal(literal.config.promptType, 'text');
		assert.equal(literal.config.asTool, true);
		assert.equal(literal.config.streaming, true);
		assert.throws(() => create.LLMAgent({ inputSchema: undefined } as never, parent), ConfigError);
	});
	it('inherits function preparation and parses input before an overriding callback', async () => {
		const model = modelFor(undefined);
		const inputSchema = z.object({ amount: z.string().transform(Number) });
		const parent = create.LLMAgent.withFunction({ model, inputSchema, prompt: ({ amount }) => String(amount) });
		const child = create.LLMAgent({ prompt: ({ amount }) => String(amount * 2) }, create.Config({}, parent));
		assert.equal((await child({ amount: '3' })).messageHistory[0].content, '6');
		assert.equal((await parent({ amount: '3' })).messageHistory[0].content, '3');
	});

	it('rejects unsupported inherited modes and allows explicit source selection', () => {
		const templateSource = create.Config({ promptType: 'async-template' });
		const scriptSource = create.Config({ promptType: 'async-script' });
		// @ts-expect-error The base factory preserves an incompatible inherited source.
		assert.throws(() => create.Template({ template: 'hello' }, scriptSource), /template source modifier/);
		// @ts-expect-error The base factory preserves an incompatible inherited source.
		assert.throws(() => create.Script({ script: 'return 1' }, templateSource), /script source modifier/);
		assert.equal(create.Template.withTemplate({ template: 'hello' }, scriptSource).config.promptType, 'async-template');
		assert.equal(create.Script.withScript({ script: 'return 1' }, templateSource).config.promptType, 'async-script');
		assert.throws(() => create.Function({ execute: () => 1, streaming: true } as never), ConfigError);
		assert.throws(() => create.Function({ execute: () => 1, asTool: false } as never), ConfigError);
	});

});
