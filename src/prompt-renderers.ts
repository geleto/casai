import type { ModelMessage } from 'ai';
import { TemplateEngine } from './TemplateEngine.js';
import { ScriptEngine } from './ScriptEngine.js';
import type { CascadaConfig } from './types/config.js';
import type { Context, PromptFunction, RequiredPromptType } from './types/types.js';
import { PromptStringOrMessagesSchema } from './types/schemas.js';
import { ConfigError, ValidationError } from './errors.js';
import { parseSchema } from './schema.js';

type Prompt = string | ModelMessage[];
export function createPromptRenderer(config: CascadaConfig & { promptType?: RequiredPromptType; prompt?: unknown }) {
	const environment = { loader: config.loader, filters: config.filters, renderOptions: { ...config.renderOptions, autoescape: false } };
	const promptType = config.promptType;
	switch (promptType) {
		case 'async-template':
		case 'async-template-name': {
			const engine = new TemplateEngine({ ...environment, template: config.prompt as string | undefined, promptType });
			return (source: unknown, context: Context): Promise<Prompt> => {
				if (source !== undefined && typeof source !== 'string') throw new ValidationError('Template prompt source must be a string.');
				return engine.render(source, context);
			};
		}
		case 'async-script':
		case 'async-script-name': {
			const engine = new ScriptEngine({ ...environment, script: config.prompt as string | undefined, promptType });
			return async (source: unknown, context: Context): Promise<Prompt> => {
				if (source !== undefined && typeof source !== 'string') throw new ValidationError('Script prompt source must be a string.');
				return (await parseSchema(PromptStringOrMessagesSchema, await engine.run(source, context), 'Prompt output')).value;
			};
		}
		case 'function':
			return async (source: unknown, context: Context): Promise<Prompt> => {
				const prompt = source ?? config.prompt;
				if (typeof prompt !== 'function') throw new ValidationError("The 'prompt' property must be a function when using withFunction().");
				return (await parseSchema(PromptStringOrMessagesSchema, await (prompt as PromptFunction)(context), 'Prompt output')).value;
			};
		default:
			throw new ConfigError('Unsupported prompt renderer: ' + String(promptType));
	}
}
