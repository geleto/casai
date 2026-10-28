import type { GenerateRequest, StreamRequest, ResolvedOutput } from '../types/sdk.js';
import type { InferGenerateOutput, ModelMessage, OutputInterface, StepResult, ToolSet } from 'ai';
import type { GenerateTextResultAugmented, StreamTextResultAugmented } from '../types/result.js';
import { generateText, streamText, NoOutputGeneratedError } from 'ai';

type Context = Record<string, unknown>;

const errorFinishMessage = 'The model finished with an error but reported no cause.';

// The caller owns normalized settings and conversation snapshots for this invocation.
type ResultRequest<R, O> = Omit<R, 'output' | 'prompt' | 'messages'> & { output?: O; messages: ModelMessage[] };

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

export async function generateTextWithResult<T extends ToolSet, C extends Context = Context, O extends OutputInterface | undefined = undefined>(
	request: ResultRequest<GenerateRequest<T, C, ResolvedOutput<O>>, O>,
	prefix: ModelMessage[],
) {
	const result = await generateText<T, C, ResolvedOutput<O>>(request as GenerateRequest<T, C, ResolvedOutput<O>>);
	const failure = result.finishReason === 'error' ? new NoOutputGeneratedError({ message: errorFinishMessage }) : undefined;
	let history: ModelMessage[] | undefined;
	Object.defineProperties(result, {
		value: { get() {
			if (failure) throw failure;
			requireOutput(result.steps, request.tools, [...prefix, ...result.responseMessages]);
			return result.output;
		} },
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
	let lastError: { error: unknown } | undefined;
	const terminalSteps = new Set<number>();
	const incremental = settings.output === undefined && settings.streamRetries === undefined
		&& settings.experimental_toolCallers === undefined;
	const onStepStart = settings.onStepStart;
	const onLanguageModelCallStart = settings.onLanguageModelCallStart;
	const onChunk = settings.onChunk;
	const observeStep = async (event: Parameters<NonNullable<StreamRequest<T, C, ResolvedOutput<O>>['onStepStart']>>[0]) => {
		if (incremental && (event.toolChoice === 'none' || event.activeTools?.length === 0 || !event.tools || Object.keys(event.tools).length === 0)
			&& !Object.values(event.tools ?? {}).some(tool => tool.type === 'provider' && tool.supportsDeferredResults)) {
			terminalSteps.add(event.stepNumber);
		}
		await onStepStart?.(event);
	};
	const observeCall: NonNullable<StreamRequest['onLanguageModelCallStart']> = async event => {
		// Unlike onStepStart, this runs for every retry attempt too.
		lastError = undefined;
		await onLanguageModelCallStart?.(event);
	};
	const observeChunk = async (event: Parameters<NonNullable<StreamRequest<T>['onChunk']>>[0]) => {
		const part = event.chunk;
		if (part.type === 'error') lastError = { error: part.error };
		await onChunk?.(event);
	};
	const result = streamText<T, C, ResolvedOutput<O>>({ ...settings, onStepStart: observeStep, onLanguageModelCallStart: observeCall, onChunk: observeChunk } as StreamRequest<T, C, ResolvedOutput<O>>);
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
	let output: Promise<InferGenerateOutput<ResolvedOutput<O>>> | undefined;
	function finalOutput() {
		return output ??= (async () => {
			requireOutput(await completed(), settings.tools, [...prefix, ...await result.responseMessages]);
			return await result.output;
		})();
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
		} else yield output;
	}
	let history: Promise<ModelMessage[]> | undefined;
	Object.defineProperties(result, {
		value: { get() {
			return settings.output === undefined ? values() : finalOutput();
		} },
		messageHistory: { get() {
			return history ??= (async () => [...prefix, ...await result.responseMessages])();
		} },
	});
	return { result: result as StreamTextResultAugmented<T, O, C>, finalOutput };
}
