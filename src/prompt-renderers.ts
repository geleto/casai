import type { ModelMessage } from 'ai';
import { TemplateEngine } from './TemplateEngine.js';
import { ScriptEngine } from './ScriptEngine.js';
import type { CascadaConfig } from './types/config.js';
import type { Context, PromptFunction, RequiredPromptType } from './types/types.js';
import { PromptStringOrMessagesSchema } from './types/schemas.js';
import { ConfigError } from './errors.js';
import { parseSchema } from './schema.js';

type Prompt = string | ModelMessage[];
export function createPromptRenderer(config: CascadaConfig & { promptType?: RequiredPromptType; prompt?: unknown }) {
	const environment = { loader: config.loader, filters: config.filters, renderOptions: { ...config.renderOptions, autoescape: false } };
	const kind = config.promptType;
	switch (kind) {
		case 'async-template':
		case 'async-template-name': {
			const engine = new TemplateEngine({ ...environment, template: config.prompt as string | undefined, promptType: kind });
			return (source: unknown, context: Context): Promise<Prompt> => {
				if (source !== undefined && typeof source !== 'string') throw new ConfigError('Template prompt source must be a string.');
				return engine.render(source, context);
			};
		}
		case 'async-script':
		case 'async-script-name': {
			const engine = new ScriptEngine({ ...environment, script: config.prompt as string | undefined, promptType: kind });
			return async (source: unknown, context: Context): Promise<Prompt> => {
				if (source !== undefined && typeof source !== 'string') throw new ConfigError('Script prompt source must be a string.');
				return (await parseSchema(PromptStringOrMessagesSchema, await engine.run(source, context), 'Prompt output')).value as Prompt;
			};
		}
		case 'function':
			return async (source: unknown, context: Context): Promise<Prompt> => {
				const prompt = source ?? config.prompt;
				if (typeof prompt !== 'function') throw new ConfigError("The 'prompt' property must be a function when using withFunction().");
				return (await parseSchema(PromptStringOrMessagesSchema, await (prompt as PromptFunction)(context), 'Prompt output')).value as Prompt;
			};
		default:
			throw new ConfigError('Unsupported prompt renderer: ' + String(kind));
	}
}
