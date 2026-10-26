import type { PromptValue, PromptType, PromptFunction } from './types/prompt.js';
import type { Context } from './types/utils.js';
import type { CascadaConfig } from './types/config.js';
import { TemplateEngine } from './TemplateEngine.js';
import { ScriptEngine } from './ScriptEngine.js';
import { PromptStringOrMessagesSchema } from './prompt-schemas.js';
import { ConfigError, ValidationError } from './errors.js';
import { parseSchema } from './schema.js';

async function validatePromptOutput(value: unknown): Promise<PromptValue> {
	// Like the SDK's prompt handling, validate the envelope without normalizing it.
	// Its message schema can omit native fields such as approval.providerExecuted.
	await parseSchema(PromptStringOrMessagesSchema, value, 'Prompt output');
	return value as PromptValue;
}

export function createPromptRenderer(config: CascadaConfig & { promptType?: PromptType; prompt?: unknown }) {
	const environment = { loader: config.loader, filters: config.filters, renderOptions: { ...config.renderOptions, autoescape: false } };
	const promptType = config.promptType;
	switch (promptType) {
		case 'async-template':
		case 'async-template-name': {
			const engine = new TemplateEngine({ ...environment, template: config.prompt as string | undefined, promptType });
			return (source: unknown, context: Context): Promise<PromptValue> => {
				if (source !== undefined && typeof source !== 'string') throw new ValidationError('Template prompt source must be a string.');
				return engine.render(source, context);
			};
		}
		case 'async-script':
		case 'async-script-name': {
			const engine = new ScriptEngine({ ...environment, script: config.prompt as string | undefined, promptType });
			return async (source: unknown, context: Context): Promise<PromptValue> => {
				if (source !== undefined && typeof source !== 'string') throw new ValidationError('Script prompt source must be a string.');
				return validatePromptOutput(await engine.run(source, context));
			};
		}
		case 'function':
			return async (source: unknown, context: Context): Promise<PromptValue> => {
				const prompt = source ?? config.prompt;
				if (typeof prompt !== 'function') throw new ValidationError("The 'prompt' property must be a function when using withFunction().");
				return validatePromptOutput(await (prompt as PromptFunction)(context));
			};
		default:
			throw new ConfigError('Unsupported prompt renderer: ' + String(promptType));
	}
}
