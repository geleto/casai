import type { ModelMessage, ToolSet } from 'ai';
import type { GenerateTextResult, StreamTextResult } from 'ai';
import type { AugmentedResponse, GenerateTextResultAugmented, StreamTextResultAugmented, AIOutput } from './types/result.js';

function createAugmentedResponse<RESPONSE extends { messages: ModelMessage[] }>(
	responseObject: RESPONSE,
	prefixForMessages: ModelMessage[] | undefined,
	historyPrefix: ModelMessage[] | undefined,
	originalMessages: ModelMessage[]
): AugmentedResponse<RESPONSE> {
	// Preserve the SDK's step responses, which also supply responseMessages.
	const response = { ...responseObject };
	let cachedMessages: ModelMessage[] | undefined;
	let cachedMessageHistory: ModelMessage[] | undefined;

	// Override the messages property with a lazy, memoized getter
	Object.defineProperty(response, 'messages', {
		get() {
			if (cachedMessages !== undefined) return cachedMessages;
			const head = prefixForMessages ?? [];
			cachedMessages = [...head, ...originalMessages];
			return cachedMessages;
		},
		enumerable: true,
		configurable: true
	});

	// Add the messageHistory property
	Object.defineProperty(response, 'messageHistory', {
		get() {
			if (cachedMessageHistory !== undefined) return cachedMessageHistory;
			const historyHead = historyPrefix ?? [];
			const head = prefixForMessages ?? [];
			cachedMessageHistory = [...historyHead, ...head, ...originalMessages];
			return cachedMessageHistory;
		},
		enumerable: true,
		configurable: true
	});
	return response as unknown as AugmentedResponse<RESPONSE>;
}

export function augmentTextFinishEvent<EVENT extends { response: { messages: ModelMessage[] }, responseMessages: ModelMessage[] }>(
	event: EVENT,
	prefixForMessages: ModelMessage[] | undefined,
	historyPrefix: ModelMessage[] | undefined,
): Omit<EVENT, 'response'> & { response: AugmentedResponse<EVENT['response']> } {
	return {
		...event,
		response: createAugmentedResponse(event.response, prefixForMessages, historyPrefix, event.responseMessages),
	};
}

export function augmentGenerateText<TOOLS extends ToolSet = ToolSet, OUTPUT extends AIOutput = AIOutput>(
	result: GenerateTextResult<TOOLS, any, OUTPUT>,
	prefixForMessages: ModelMessage[] | undefined,
	historyPrefix: ModelMessage[] | undefined,
): GenerateTextResultAugmented<TOOLS, OUTPUT> {
	// response.messages is step-local in AI SDK 7; responseMessages spans the call.
	const response = createAugmentedResponse(result.response, prefixForMessages, historyPrefix, result.responseMessages);
	Object.defineProperty(result, 'response', {
		value: response,
		enumerable: true,
		configurable: true
	});

	return result as GenerateTextResultAugmented<TOOLS, OUTPUT>;
}

export function augmentStreamText<TOOLS extends ToolSet = ToolSet, OUTPUT extends AIOutput = AIOutput>(
	result: StreamTextResult<TOOLS, any, OUTPUT>,
	prefixForMessages: ModelMessage[] | undefined,
	historyPrefix: ModelMessage[] | undefined,
): StreamTextResultAugmented<TOOLS, OUTPUT> {
	let cachedResponsePromise: StreamTextResultAugmented<TOOLS, OUTPUT>['response'] | undefined;

	// Override the response getter to return our augmented promise
	Object.defineProperty(result, 'response', {
		get() {
			// Reading SDK metadata creates promises that can reject on a failed stream.
			// Keep them lazy, and use finalStep to avoid recursing into this getter.
			cachedResponsePromise ??= Promise.all([result.finalStep, result.responseMessages])
				.then(([step, messages]) => createAugmentedResponse(step.response, prefixForMessages, historyPrefix, messages));
			return cachedResponsePromise;
		},
		enumerable: true,
		configurable: true
	});

	return result as StreamTextResultAugmented<TOOLS, OUTPUT>;
}
