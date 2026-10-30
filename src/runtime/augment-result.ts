import type { GenerateRequest, StreamRequest, ResolvedOutput } from '../types/sdk.js';
import type { GenerateTextResult, ModelMessage, OutputInterface, ToolSet } from 'ai';
import type { GenerateTextResultAugmented, StreamTextResultAugmented } from '../types/result.js';
import { generateText, streamText, NoOutputGeneratedError } from 'ai';

type Context = Record<string, unknown>;

// The caller owns normalized settings and conversation snapshots for this invocation.
type ResultRequest<R, O> = Omit<R, 'output' | 'prompt' | 'messages'> & { output?: O; messages: ModelMessage[] };

// Request-hook decisions are absent from native responseMessages. Retain only their
// IDs and position; a failed generation rejects before this completion check.
export interface ToolStepApprovals {
	responseMessageCount: number;
	approvalIds: string[];
}

// Non-deferred provider calls wait only for their own unanswered approval IDs.
type ToolCallCompletion = 'result-required' | 'settled' | Set<string>;

/** Check this invocation's tool completion, then return native output without revalidating it. */
export function generateToolOutput<T extends ToolSet, C extends Context, O extends OutputInterface>(
	result: GenerateTextResult<T, C, O>, tools: T | undefined, stepApprovals: readonly ToolStepApprovals[] = [], stoppedByCondition = false,
) {
	if (result.finishReason === 'error') throw new NoOutputGeneratedError({ message: 'The model finished with an error but reported no cause.' });
	// The Anthropic adapter normalizes this provider-declared pause to 'stop'.
	if (result.rawFinishReason === 'pause_turn') {
		throw new NoOutputGeneratedError({ message: 'The provider paused the turn; no final application output is available.' });
	}
	// Native response messages include pre-step approval results and exclude preliminary output.
	const calls = new Map<string, ToolCallCompletion>();
	const approvals = new Map<string, Set<string>>();
	let nextApproval = 0;
	const messages = result.responseMessages;
	for (let index = 0; index <= messages.length; index++) {
		while (nextApproval < stepApprovals.length && stepApprovals[nextApproval].responseMessageCount === index) {
			const step = stepApprovals[nextApproval++];
			for (const id of step.approvalIds) {
				approvals.get(id)?.delete(id);
			}
		}
		if (index === messages.length) break;
		const message = messages[index];
		if (typeof message.content === 'string') continue;
		for (const part of message.content) {
			switch (part.type) {
				case 'tool-call': {
					const tool = tools?.[part.toolName];
					const requiresResult = !part.providerExecuted || (tool?.type === 'provider' && tool.supportsDeferredResults === true);
					// A new definition gets a new state; old approval IDs cannot settle it.
					calls.set(part.toolCallId, requiresResult ? 'result-required' : new Set());
					break;
				}
				case 'tool-approval-request': {
					// An automatic SDK decision neither opens a wait nor settles a different
					// provider request. Generation supplies results for automatic denials.
					if (part.isAutomatic) break;
					const call = calls.get(part.toolCallId) ?? 'result-required';
					if (typeof call !== 'string') {
						call.add(part.approvalId);
						approvals.set(part.approvalId, call);
					}
					calls.set(part.toolCallId, call);
					break;
				}
				case 'tool-result':
					calls.set(part.toolCallId, 'settled');
					break;
			}
		}
	}
	if ([...calls.values()].some(call => call === 'result-required' || typeof call !== 'string' && call.size > 0)) throw new NoOutputGeneratedError({ message: 'Final output is unavailable while tool results or approvals are pending.' });
	if (stoppedByCondition) throw new NoOutputGeneratedError({ message: 'The inner agent stopped before completion because a stop condition prevented another step.' });
	return result.output;
}

export async function generateTextWithResult<T extends ToolSet, C extends Context = Context, O extends OutputInterface | undefined = undefined>(
	request: ResultRequest<GenerateRequest<T, C, ResolvedOutput<O>>, O>,
	prefix: ModelMessage[],
) {
	const result = await generateText<T, C, ResolvedOutput<O>>(request as GenerateRequest<T, C, ResolvedOutput<O>>);
	let history: ModelMessage[] | undefined;
	Object.defineProperties(result, {
		messageHistory: { get() {
			return history ??= [...prefix, ...result.responseMessages];
		} },
	});
	return result as GenerateTextResultAugmented<T, O, C>;
}

export function streamTextWithResult<T extends ToolSet, C extends Context = Context, O extends OutputInterface | undefined = undefined>(
	settings: ResultRequest<StreamRequest<T, C, ResolvedOutput<O>>, O>,
	prefix: ModelMessage[],
) {
	const result = streamText<T, C, ResolvedOutput<O>>(settings as StreamRequest<T, C, ResolvedOutput<O>>);
	let history: Promise<ModelMessage[]> | undefined;
	Object.defineProperties(result, {
		messageHistory: { get() {
			return history ??= (async () => [...prefix, ...await result.responseMessages])();
		} },
	});
	return result as StreamTextResultAugmented<T, O, C>;
}
