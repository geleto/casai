import { generateText, streamText, NoOutputGeneratedError } from 'ai';
import type { InferGenerateOutput, ModelMessage, OutputInterface, StepResult, ToolSet } from 'ai';
import type { GenerateTextResultAugmented, StreamTextResultAugmented } from './types/result.js';
import type { DefaultTextOutput } from './types/types.js';

type Context = Record<string, unknown>;
type GenerateRequest<T extends ToolSet, C extends Context, O extends OutputInterface> = Parameters<typeof generateText<T, C, O>>[0];
type StreamRequest<T extends ToolSet, C extends Context, O extends OutputInterface> = Parameters<typeof streamText<T, C, O>>[0];

const errorFinishMessage = 'The model finished with an error but reported no cause.';

// Object APIs retain their native completion and stream-consumption contracts.
export function augmentObjectResult<R extends { readonly object: unknown }>(result: R): R & { readonly value: R['object'] } {
	Object.defineProperty(result, 'value', { get: () => result.object });
	return result as R & { readonly value: R['object'] };
}

interface ConversationRequest { prompt?: string | ModelMessage[] | undefined, messages?: ModelMessage[] | undefined }

function snapshotRequest<R extends ConversationRequest>(request: R): R {
	const snapshot = { ...request };
	if (snapshot.messages) snapshot.messages = [...snapshot.messages];
	if (Array.isArray(snapshot.prompt)) snapshot.prompt = [...snapshot.prompt];
	return snapshot;
}

function historyPrefix(request: ConversationRequest): ModelMessage[] {
	return request.messages ?? (Array.isArray(request.prompt) ? request.prompt
		: typeof request.prompt === 'string' ? [{ role: 'user', content: request.prompt }] : []);
}

/** Output eligibility concerns protocol completion, never the wording of the answer. */
function requireOutput<T extends ToolSet, C extends Context>(steps: StepResult<T, C>[], tools: T | undefined, messages: ModelMessage[]) {
	const final = steps.at(-1);
	if (!final) throw new NoOutputGeneratedError({ message: 'No completed model step is available.' });
	// The Anthropic adapter normalizes this provider-declared pause to 'stop'.
	if (final.rawFinishReason === 'pause_turn') {
		throw new NoOutputGeneratedError({ message: 'The provider paused the turn; no final application output is available.' });
	}
	if (final.finishReason === 'tool-calls') {
		throw new NoOutputGeneratedError({ message: 'The execution ended with tool calls and no final application output.' });
	}
	if (final.finishReason !== 'stop' && final.text.length === 0) {
		throw new NoOutputGeneratedError({ message: `The model finished with '${final.finishReason}' and no text output.` });
	}
	// Persisted SDK messages include pre-step approval results and exclude preliminary output.
	const pending = new Set<string>();
	const approvals = new Map<string, string>();
	for (const message of messages) {
		if (typeof message.content === 'string') continue;
		for (const part of message.content) {
			switch (part.type) {
				case 'tool-call': {
					const tool = tools?.[part.toolName];
					if (!part.providerExecuted || (tool?.type === 'provider' && tool.supportsDeferredResults)) pending.add(part.toolCallId);
					break;
				}
				case 'tool-approval-request':
					approvals.set(part.approvalId, part.toolCallId);
					pending.add(part.toolCallId);
					break;
				// Streaming provider denials need not have a synthesized tool-result.
				case 'tool-approval-response':
					if (!part.approved) {
						const callId = approvals.get(part.approvalId);
						if (callId !== undefined) pending.delete(callId);
					}
					break;
				case 'tool-result': pending.delete(part.toolCallId); break;
			}
		}
	}
	if (pending.size) throw new NoOutputGeneratedError({ message: 'Final output is unavailable while tool results or approvals are pending.' });
}

export async function generateTextWithResult<T extends ToolSet, C extends Context = Context, O extends OutputInterface = DefaultTextOutput>(
	request: GenerateRequest<T, C, O>,
	// Components supply the dynamic conversation separately from configured static messages.
	conversation: ModelMessage[] = historyPrefix(request),
) {
	request = snapshotRequest(request);
	const prefix = [...conversation];
	const incoming = [...historyPrefix(request)];
	const result = await generateText<T, C, O>(request);
	const failure = result.finishReason === 'error' ? new NoOutputGeneratedError({ message: errorFinishMessage }) : undefined;
	let history: ModelMessage[] | undefined;
	Object.defineProperties(result, {
		value: { get() {
			if (failure) throw failure;
			requireOutput(result.steps, request.tools, [...incoming, ...result.responseMessages]);
			return result.output;
		} },
		messageHistory: { get() {
			return history ??= [...prefix, ...result.responseMessages];
		} },
	});
	return result as GenerateTextResultAugmented<T, O, C>;
}

export function streamTextWithResult<T extends ToolSet, C extends Context = Context, O extends OutputInterface = DefaultTextOutput>(
	request: StreamRequest<T, C, O>,
	conversation: ModelMessage[] = historyPrefix(request),
) {
	const settings = snapshotRequest(request);
	const prefix = [...conversation];
	const incoming = [...historyPrefix(settings)];
	let lastError: { error: unknown } | undefined;
	const terminalSteps = new Set<number>();
	const incremental = settings.output === undefined && settings.streamRetries === undefined
		&& settings.experimental_toolCallers === undefined;
	const onStepStart = settings.onStepStart ?? settings.experimental_onStepStart;
	const onLanguageModelCallStart = settings.onLanguageModelCallStart ?? settings.experimental_onLanguageModelCallStart;
	const onChunk = settings.onChunk;
	settings.onStepStart = async event => {
		if (incremental && (event.toolChoice === 'none' || event.activeTools?.length === 0 || !event.tools || Object.keys(event.tools).length === 0)
			&& !Object.values(event.tools ?? {}).some(tool => tool.type === 'provider' && tool.supportsDeferredResults)) {
			terminalSteps.add(event.stepNumber);
		}
		await onStepStart?.(event);
	};
	settings.onLanguageModelCallStart = async event => {
		// Unlike onStepStart, this runs for every retry attempt too.
		lastError = undefined;
		await onLanguageModelCallStart?.(event);
	};
	settings.onChunk = async event => {
		const part = event.chunk;
		if (part.type === 'error') lastError = { error: part.error };
		await onChunk?.(event);
	};
	const result = streamText<T, C, O>(settings);
	let completion: Promise<StepResult<T, C>[]> | undefined;
	function completed() {
		return completion ??= (async () => {
			// Native completion promises preserve abort, timeout, and thrown stream errors.
			const [steps, finishReason] = await Promise.all([result.steps, result.finishReason]).catch((error: unknown) => {
				// With no completed step, the SDK can replace the provider error with a cause-less error.
				if (NoOutputGeneratedError.isInstance(error) && error.cause === undefined && lastError) throw lastError.error;
				throw error;
			});
			if (finishReason === 'error' || steps.at(-1)?.finishReason === 'error') {
				if (lastError) throw lastError.error;
				throw new NoOutputGeneratedError({ message: errorFinishMessage });
			}
			return steps;
		})();
	}
	async function finalOutput() {
		requireOutput(await completed(), settings.tools, [...incoming, ...await result.responseMessages]);
		return await result.output;
	}
	async function* values(): AsyncGenerator {
		let emitted = 0;
		let stepNumber = -1;
		let activeText: string | undefined;
		let overlapping = false;
		if (incremental) {
			for await (const part of result.stream) {
				if (part.type === 'start-step') {
					// A provider can ignore toolChoice. An emitted prefix cannot survive continuation.
					if (emitted) throw new NoOutputGeneratedError({ message: 'The model continued after final-output text was emitted.' });
					stepNumber++;
				}
				if (!terminalSteps.has(stepNumber)) continue;
				if (part.type === 'text-start') {
					overlapping ||= activeText !== undefined;
					activeText = part.id;
				}
				if (part.type === 'text-end' && part.id === activeText) activeText = undefined;
				if (part.type === 'text-delta' && part.id === activeText && !overlapping) {
					emitted += part.text.length;
					yield part.text;
				}
			}
		}
		const output = await finalOutput();
		if (emitted) {
			// Interleaved blocks can change arrival order, but the emitted prefix remains stable.
			const rest = (output as string).slice(emitted);
			if (rest) yield rest;
		} else if (settings.output?.name === 'array') {
			const iterable = output as Iterable<unknown> & Partial<AsyncIterable<unknown>>;
			// Async delegation preserves promise-valued elements; sync delegation unwraps them.
			yield* { [Symbol.asyncIterator]() {
				const iterator = iterable[Symbol.asyncIterator]?.() ?? iterable[Symbol.iterator]();
				return {
					next: async () => iterator.next(),
					return: async () => iterator.return?.() ?? { done: true, value: undefined },
				};
			} };
		} else yield output;
	}
	let history: Promise<ModelMessage[]> | undefined;
	let output: Promise<InferGenerateOutput<O>> | undefined;
	Object.defineProperties(result, {
		value: { get() {
			const kind = settings.output?.name ?? 'text';
			return kind === 'text' || kind === 'array' ? values() : output ??= finalOutput();
		} },
		messageHistory: { get() {
			return history ??= (async () => [...prefix, ...await result.responseMessages])();
		} },
	});
	return result as StreamTextResultAugmented<T, O, C>;
}
