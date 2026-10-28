import assert from 'node:assert/strict';
import { create, ConfigError, ValidationError, TemplateError, ScriptError, z } from './cascada';
import * as errors from '../src/errors.js';
import { modelFor } from './fixtures/phase2-security-sdk.js';
import { createRaceLoader } from '../src/loaders.js';

describe('Casai error boundaries', () => {
	it('exports the centralized error constructors from the public entry point', () => {
		assert.equal(ConfigError, errors.ConfigError);
		assert.equal(ValidationError, errors.ValidationError);
		assert.equal(TemplateError, errors.TemplateError);
		assert.equal(ScriptError, errors.ScriptError);
		for (const ErrorClass of [ConfigError, ValidationError, TemplateError, ScriptError]) {
			const cause = new Error('underlying failure');
			const error = new ErrorClass('summary', cause);
			assert.equal(error.name, ErrorClass.name);
			assert.equal(error.message, 'summary');
			assert.equal(error.cause, cause);
			assert.ok(error instanceof Error);
		}
	});

	it('keeps configuration and validation errors distinct', () => {
		const config = new ConfigError('configuration');
		const validation = new ValidationError('validation');
		assert.ok(config instanceof ConfigError);
		assert.ok(validation instanceof ValidationError);
		assert.equal(validation instanceof ConfigError, false);
		assert.equal(config instanceof ValidationError, false);
		for (const ErrorClass of [ConfigError, ValidationError]) {
			for (const other of [null, undefined, 'error', {}, new Error(), { name: ErrorClass.name }]) {
				assert.equal(other instanceof ErrorClass, false);
			}
		}
	});

	it('classifies invalid configured values separately from invocation overrides', async () => {
		const messages = [{ role: 'user', content: 42 }] as never;
		assert.throws(() => create.Config({ prompt: messages }), ConfigError);
		const generator = create.LLMAgent({ model: modelFor(undefined), prompt: 'ready' });
		await assert.rejects(generator.run({ messageHistory: messages }), ValidationError);
		assert.throws(() => create.Function({ toolsContext: { missing: {} }, execute: () => 1 } as never), ConfigError);
		const operation = create.Function({ execute: () => 1 });
		await assert.rejects(operation.run({ toolsContext: { missing: {} } } as never), ValidationError);
		await assert.rejects(operation.run({ unknown: true } as never), ValidationError);
		assert.throws(() => createRaceLoader([], ''), ConfigError);
	});

	it('retains configuration errors for schema capabilities discovered during invocation', async () => {
		const operation = create.Function.asTool({ inputSchema: z.record(z.string(), z.number()), execute: () => 1 } as never);
		await assert.rejects(operation({} as never), ConfigError);
	});

	it('reports missing and malformed sources before application work', async () => {
		let calls = 0;
		const context = { effect: () => { calls++; } };
		const script = create.Script({ script: undefined, context } as never);
		await assert.rejects(async () => { await Reflect.apply(script, undefined, []); }, ValidationError);
		const template = create.Template({ template: undefined, context } as never);
		await assert.rejects(template(), ValidationError);
		await assert.rejects(create.Script({ script: 'return (', context })(), error => error instanceof ScriptError && error.cause instanceof Error);
		await assert.rejects(create.Template({ template: '{{ (', context })(), error => error instanceof TemplateError && error.cause instanceof Error);
		assert.equal(calls, 0);
	});

	it('keeps callback failures unchanged and schema failures separate from rendering failures', async () => {
		const failure = new Error('application failure');
		await assert.rejects(create.Function({ execute: () => { throw failure; } })(), error => error === failure);
		const output = create.Script({ script: 'return "wrong"', schema: z.number() });
		await assert.rejects(output(), error => error instanceof ValidationError
			&& !(error instanceof ConfigError) && !(error instanceof ScriptError) && error.cause instanceof Error);
		await assert.rejects(create.Script({ script: 'return missing()' })(), ScriptError);
		await assert.rejects(create.Template({ template: '{{ missing() }}' })(), TemplateError);
	});
});
