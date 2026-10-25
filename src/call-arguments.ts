import type { ModelMessage } from 'ai';
import type { Context } from './types/types.js';
import { ConfigError } from './errors.js';
import { requireContextObject } from './schema.js';

export function extractCallArguments(promptOrMessageOrContext?: string | ModelMessage[] | Context, contextOrMessages?: ModelMessage[] | Context, maybeContext?: Context): { prompt?: string, messages?: ModelMessage[], context?: Context } {
	let promptFromArgs: string | undefined;
	let messagesFromArgs: ModelMessage[] | undefined;
	let contextFromArgs: Context | undefined;

	// First argument
	if (typeof promptOrMessageOrContext === 'string') {
		promptFromArgs = promptOrMessageOrContext;
	} else if (Array.isArray(promptOrMessageOrContext)) {
		messagesFromArgs = promptOrMessageOrContext;
	} else if (promptOrMessageOrContext !== undefined) {
		contextFromArgs = requireContextObject(promptOrMessageOrContext);
	}

	// Second argument
	if (contextOrMessages !== undefined) {
		if (Array.isArray(contextOrMessages)) {
			if (messagesFromArgs !== undefined) {
				throw new ConfigError('Messages provided multiple times across arguments');
			}
			messagesFromArgs = contextOrMessages as ModelMessage[];
		} else {
			if (contextFromArgs !== undefined) {
				throw new ConfigError('Context provided multiple times across arguments');
			}
			contextFromArgs = requireContextObject(contextOrMessages);
		}
	}

	// Third argument
	if (maybeContext !== undefined) {
		if (!Array.isArray(contextOrMessages)) {
			throw new ConfigError('Third argument (context) is only allowed when the second argument is messages.');
		}
		if (Array.isArray(maybeContext)) {
			throw new ConfigError('Third argument (context) must be an object');
		}
		if (contextFromArgs !== undefined) {
			throw new ConfigError('Context provided multiple times');
		}
		contextFromArgs = requireContextObject(maybeContext);
	}

	return { prompt: promptFromArgs, messages: messagesFromArgs, context: contextFromArgs };
}
