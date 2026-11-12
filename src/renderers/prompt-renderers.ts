import { sourceMode } from '../config/source-mode.js';
import type { PromptValue, PromptType } from '../types/prompt.js';
import type { ModelMessage } from 'ai';
import type { Context } from '../types/utils.js';
import type { CascadaConfig } from '../types/config.js';
import type { LoaderGroup } from 'cascada-engine';
import { AsyncEnvironment, NotFoundError } from 'cascada-engine';
import { createCascadaRenderer } from './cascada-renderer.js';
import { PromptStringOrMessagesSchema } from './prompt-schema.js';
import { ConfigError, ValidationError } from '../errors.js';
import { parseSchema } from '../schema.js';

async function validatePromptOutput(value: unknown): Promise<string | ModelMessage[]> {
	// Like the SDK's prompt handling, validate the envelope without normalizing it.
	// Its message schema can omit native fields such as approval.providerExecuted.
	await parseSchema(PromptStringOrMessagesSchema, value, 'Prompt output');
	const prompt = value as PromptValue;
	return typeof prompt === 'string' || Array.isArray(prompt) ? prompt : [prompt];
}

/** Prepare a native operation input. Only the owning operation validates its output. */
export function createSourceRenderer(config: CascadaConfig & { [sourceMode]?: PromptType }, configured: unknown,
	structured?: 'messages' | 'parts' | 'image') {
	const environment = { loader: config.loader, filters: config.filters, renderOptions: { ...config.renderOptions, autoescape: false } };
	const promptType = config[sourceMode];
	switch (promptType) {
		case 'text':
			return (source: unknown = configured) => source;
		case 'text-name': {
			const loader = new AsyncEnvironment(config.loader as LoaderGroup);
			return async (name: unknown = configured): Promise<string> => {
				if (typeof name !== 'string') throw new ValidationError('A loaded source must be a resource name.');
				try { return await loader.loadString(name); }
				catch (error) {
					if (error instanceof NotFoundError) throw new ValidationError('Failed to load source: ' + error.message, error);
					throw error;
				}
			};
		}
		case 'async-template':
		case 'async-template-name':
		case 'async-script':
		case 'async-script-name': {
			const kind = promptType.startsWith('async-script') ? 'Script' : 'Template';
			const render = createCascadaRenderer(environment, promptType, typeof configured === 'string' ? configured : undefined);
			return async (source: unknown = configured, context: Context): Promise<unknown> => {
				if (typeof source === 'string') return render(source === configured ? undefined : source, context);
				if (promptType !== 'async-template' || !structured) throw new ValidationError(`${kind} source must be a string.`);
				const text = (value: string) => render(value, context) as Promise<string>;
				if (structured === 'image' && source !== null && typeof source === 'object' && !Array.isArray(source)) {
					const input = source as { text?: string };
					return input.text === undefined ? input : { ...input, text: await text(input.text) };
				}
				if (structured === 'messages' && !Array.isArray(source)) source = [source];
				if (!Array.isArray(source)) throw new ValidationError('A structured template requires a native input shape.');
				const part = async (value: { type: string; text?: string }) => value.type === 'text'
					? { ...value, text: await text(value.text!) } : value;
				if (structured === 'parts') return Promise.all(source.map(part));
				return Promise.all((source as import('ai').ModelMessage[]).map(async message => ({ ...message,
					content: typeof message.content === 'string' ? await text(message.content) : await Promise.all(message.content.map(part)),
				})));
			};
		}
		case 'function':
			return (prompt: unknown = configured, context: Context): unknown => {
				if (typeof prompt !== 'function') throw new ValidationError('The source must be a function when using withFunction().');
				return (prompt as (context: Context) => unknown)(context);
			};
		default:
			throw new ConfigError('Unsupported prompt renderer: ' + String(promptType));
	}
}

export function createPromptRenderer(config: CascadaConfig & { [sourceMode]?: PromptType; prompt?: unknown }) {
	const render = createSourceRenderer(config, config.prompt, 'messages');
	return async (source: unknown, context: Context): Promise<string | ModelMessage[]> => {
		const output = await render(source, context);
		return config[sourceMode] === 'function' || config[sourceMode]?.startsWith('async-script') || typeof output !== 'string'
			? validatePromptOutput(output) : output;
	};
}
