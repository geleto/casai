import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';

type Fields = Record<string, unknown>;
export type Mode = 'generate' | 'stream';
export function modelFor(input: Fields | undefined, toolName = 'probe') {
	let step = 0;
	const next = () => {
		const calling = input !== undefined && step++ === 0;
		return {
			content: calling ? [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName, input: JSON.stringify(input) }]
				: [{ type: 'text' as const, text: 'done' }],
			finishReason: { unified: calling ? 'tool-calls' as const : 'stop' as const, raw: 'stop' },
			usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [],
		};
	};
	return new MockLanguageModelV3({ doGenerate: async () => next(), doStream: async () => {
		const result = next();
		return { stream: convertArrayToReadableStream([
			{ type: 'stream-start', warnings: [] },
			...result.content.flatMap<LanguageModelV3StreamPart>(part => part.type === 'tool-call' ? [part] : [
				{ type: 'text-start', id: 'text' }, { type: 'text-delta', id: 'text', delta: part.text }, { type: 'text-end', id: 'text' },
			]), { type: 'finish', finishReason: result.finishReason, usage: result.usage },
		]) };
	} });
}
