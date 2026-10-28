import type { PromptValue, PromptType, PromptFunction } from './types/prompt.js';
import type { Context } from './types/utils.js';
import type { CascadaConfig } from './types/config.js';
import type { ILoaderAny } from 'cascada-engine';
import { AsyncEnvironment, NotFoundError } from 'cascada-engine';
import { createCascadaRenderer } from './cascada-renderer.js';
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
		case 'text':
			return (source: unknown) => (source === undefined ? config.prompt : source) as PromptValue;
		case 'text-name': {
			const loader = new AsyncEnvironment(config.loader as ILoaderAny[]);
			return async (source: unknown): Promise<string> => {
				const name = source === undefined ? config.prompt : source;
				if (typeof name !== 'string') throw new ValidationError('A loaded prompt must be a resource name.');
				try { return await loader.loadString(name); }
				catch (error) {
					if (error instanceof NotFoundError) throw new Error('Failed to load prompt: ' + error.message, { cause: error });
					throw error;
				}
			};
		}
		case 'async-template':
		case 'async-template-name':
		case 'async-script':
		case 'async-script-name': {
			const kind = promptType.startsWith('async-script') ? 'Script' : 'Template';
			const render = createCascadaRenderer(environment, promptType, config.prompt as string | undefined);
			return async (source: unknown, context: Context): Promise<PromptValue> => {
				if (source !== undefined && typeof source !== 'string') throw new ValidationError(`${kind} prompt source must be a string.`);
				const output = await render(source, context);
				return kind === 'Script' ? validatePromptOutput(output) : output as string;
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
