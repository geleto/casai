import { sourceMode, sourceSettingsError } from '../config/source-mode.js';
import type { LanguageModel, ModelMessage, OutputInterface, StopCondition, ToolSet } from 'ai';
import { isStepCount } from 'ai';
import type { CascadaConfig } from '../types/config.js';
import type { AnyPromptSource, PromptType } from '../types/prompt.js';
import type { ExecutionConfig, PreparedExecutionContext, ToolInvocation } from '../types/execution.js';
import type { GenerateRequest, StreamRequest, PrepareStepOptions } from '../types/sdk.js';
import type { Fields } from '../types/utils.js';
import { isRecord } from '@ai-sdk/provider-utils';
import { generateTextWithResult, generateToolOutput, streamTextWithResult } from './augment-result.js';
import type { ToolStepApprovals } from './augment-result.js';
import { mergeConfigs } from '../config/config-utils.js';
import { createPromptRenderer } from '../renderers/prompt-renderers.js';
import { defineTool, definedSettings, descriptorKeys, namedArguments, prepareExecution, prepareRegistry, runSettings, validateRegistryConfig } from './execution.js';
import { ValidationError } from '../errors.js';
import { requireContextObject } from '../schema.js';
import { validateAgentSettings, validateConfigBasics, validateMessagesArray } from '../config/validate.js';
import { observers, aliases, protectedSettings, streamingSettings, agentSourceConflicts, fixedSettings, retiredSettings } from './agent-settings-policy.js';
import { applyApprovalSelection } from './approvals.js';

type CallHook = (request: Fields, config: RuntimeAgentConfig, context: PreparedExecutionContext) => Fields | PromiseLike<Fields>;
type StepHook = (step: PrepareStepOptions, config: RuntimeAgentConfig, context: PreparedExecutionContext) => ReturnType<NonNullable<StreamRequest['prepareStep']>>;
export type RuntimeAgentConfig = ExecutionConfig & CascadaConfig & Fields & {
	model: LanguageModel;
	prompt?: AnyPromptSource;
	[sourceMode]: PromptType;
	streaming?: true;
	output?: OutputInterface;
	prepareCall?: CallHook;
	prepareStep?: StepHook;
	abortSignal?: AbortSignal;
};

export const componentSettings = ['prompt', 'messageHistory', 'context', 'inputSchema', 'toolContextSchema', sourceMode, 'filters',
	'renderOptions', 'loader', 'id', 'streaming', 'asTool', 'debug', 'prepareCall', ...descriptorKeys.filter(key => key !== 'providerOptions')] as const;

/** Positional calls select source, context, then history. Only marked Cascada keywords may follow history. */
function callSettings(args: readonly unknown[]): Fields {
	const { values, keywords } = namedArguments(args);
	if (values.length > 3) throw new ValidationError('Unexpected LLMAgent arguments.');
	if (keywords && values.length > 1 && Array.isArray(values.at(-2))) {
		// Cascada keyword context follows positional arguments; execution expects it before history.
		[values[values.length - 2], values[values.length - 1]] = [values.at(-1), values.at(-2)];
	}
	let source: unknown;
	const first = values[0];
	if (typeof first === 'string' || typeof first === 'function' || first === undefined && values.length > 1) {
		source = values.shift();
	}
	let context: unknown;
	if (!Array.isArray(values[0])) context = values.shift();
	const history = values.shift();
	if (values.some(value => value !== undefined) || history !== undefined && !Array.isArray(history)) {
		throw new ValidationError('Use (prompt, context, messageHistory) or (context, messageHistory).');
	}
	return { prompt: source, context, messageHistory: history };
}

function messages(prompt: unknown): readonly ModelMessage[] {
	if (prompt === undefined) return [];
	if (typeof prompt === 'string') return [{ role: 'user', content: prompt }];
	if (Array.isArray(prompt)) return prompt as ModelMessage[];
	throw new ValidationError('A literal prompt must be text or model messages.');
}

/** One invocation path; only source preparation differs between Casai and native SDK calls. */
export function createLLMAgent(config: RuntimeAgentConfig): object {
	const asTool = config.asTool === true;
	if (config.debug) console.log('[DEBUG] LLMAgent created with config:', config);
	const renderer = createPromptRenderer(config);

	async function invoke(raw: Fields, streaming: boolean, { native = false, literal, approve, tool }: {
		native?: boolean; literal?: readonly ModelMessage[]; approve?: unknown;
		tool?: ToolInvocation;
	} = {}) {
		if (config.debug) console.log('[DEBUG] LLMAgent call:', raw);
		(raw.abortSignal as AbortSignal | undefined)?.throwIfAborted();
		const supplied = definedSettings(raw);
		if (native) {
			if (supplied.prompt !== undefined && supplied.messages !== undefined) throw new ValidationError('Supply prompt or messages, not both.');
			if (supplied.options !== undefined) supplied.context = supplied.options;
			delete supplied.options;
			for (const [key, alias] of Object.entries(aliases)) {
				if (supplied[key] === undefined && supplied[alias] !== undefined) supplied[key] = supplied[alias];
				Reflect.deleteProperty(supplied, alias);
			}
		} else {
			validateConfigBasics(raw, ValidationError);
			validateAgentSettings(raw, ValidationError);
		}
		const invalid = [...fixedSettings, ...agentSourceConflicts, ...(native ? [] : retiredSettings)].filter(key => Object.hasOwn(raw, key));
		if (invalid.length) throw new ValidationError(sourceSettingsError(raw, true) ?? `Unsupported LLMAgent settings: ${invalid.map(String).join(', ')}.`);
		if (native) literal = messages(supplied.messages !== undefined ? supplied.messages : supplied.prompt);
		delete supplied.messages;
		if (native) delete supplied.prompt;
		if (Array.isArray(supplied.prompt)) supplied.prompt = [...supplied.prompt as ModelMessage[]];
		else if (isRecord(supplied.prompt)) supplied.prompt = [supplied.prompt];
		// The SDK validates the hook's request, but retained history uses the original conversation.
		for (const original of [supplied.messageHistory, literal, Array.isArray(supplied.prompt) ? supplied.prompt : undefined]) {
			validateMessagesArray(original, ValidationError);
		}
		const continued = literal === undefined ? undefined : applyApprovalSelection(literal, approve);
		const history = supplied.messageHistory === undefined ? [] : [...supplied.messageHistory as readonly ModelMessage[]];
		const settings = mergeConfigs(config, supplied, ValidationError) as RuntimeAgentConfig;
		validateRegistryConfig(settings, supplied, ValidationError);
		const execution = tool ?? await prepareExecution({ ...settings, context: config.context }, supplied.context,
			settings.abortSignal === undefined ? {} : { abortSignal: settings.abortSignal });
		const prompt = continued === undefined && settings.prompt !== undefined
			? await renderer(settings.prompt === config.prompt ? undefined : settings.prompt, execution.context) : undefined;
		const conversation = continued ?? [...history, ...messages(prompt)];
		const protectedValues: Fields = {};
		for (const key of protectedSettings) protectedValues[key] = settings[key];
		for (const key of observers) {
			const first = config[key] as ((event: unknown) => unknown) | undefined;
			const second = supplied[key] as ((event: unknown) => unknown) | undefined;
			if (first || second) protectedValues[key] = async (event: unknown) => {
				await Promise.allSettled([first, second].map(async callback => await callback?.(event)));
			};
		}
		let request: Fields = { ...settings, messages: [...conversation] };
		for (const key of [...componentSettings, ...protectedSettings]) Reflect.deleteProperty(request, key);
		if (settings.tools !== undefined) request.tools = Object.fromEntries(Object.entries(settings.tools).filter(([, tool]) => tool != null));
		const initialTools = request.tools;
		const initialContext = request.toolsContext;
		if (settings.prepareCall) {
			request = await settings.prepareCall(request, settings, execution.context);
			if (!isRecord(request)) throw new ValidationError('prepareCall must return a complete request object.');
		}
		const registry = request.tools === initialTools && request.toolsContext === initialContext ? execution.registry
			: prepareRegistry(request);
		if (request.tools !== undefined) request = { ...request, tools: registry.tools, toolsContext: registry.toolsContext };
		const prepareStep = request.prepareStep as StepHook | undefined;
		const stepApprovals: ToolStepApprovals[] = [];
		if (prepareStep) request = { ...request, prepareStep: async (step: PrepareStepOptions) => {
			const responseMessageCount = step.responseMessages.length;
			const next = await prepareStep(step, settings, execution.context);
			if (next?.toolsContext !== undefined) registry.assertContext(next.toolsContext);
			if (tool && next?.messages) {
				const approvalIds = next.messages.flatMap(message => message.role === 'tool' ? message.content.flatMap(part =>
					part.type === 'tool-approval-response' && part.providerExecuted ? [part.approvalId] : []) : []);
				if (approvalIds.length) stepApprovals.push({ responseMessageCount, approvalIds });
			}
			return next;
		} };
		request = { ...request, ...protectedValues, messages: [...request.messages as ModelMessage[]] };
		if (!streaming) for (const key of streamingSettings) Reflect.deleteProperty(request, key);
		settings.abortSignal?.throwIfAborted();
		if (streaming) {
			return streamTextWithResult<ToolSet, Fields, OutputInterface>(request as StreamRequest & { messages: ModelMessage[] }, conversation);
		}
		let stoppedByCondition = false;
		if (tool) {
			const { stopWhen = isStepCount(1) } = request as GenerateRequest;
			// The SDK evaluates these only when another step is otherwise eligible.
			// Observe that decision once, retaining native array/concurrency behavior.
			request.stopWhen = (Array.isArray(stopWhen) ? stopWhen : [stopWhen]).map((condition): StopCondition<ToolSet> => options => {
				const decision = condition(options); // Preserve synchronous throws before later predicates run.
				return Promise.resolve(decision).then(met => {
					if (met) stoppedByCondition = true;
					return met;
				});
			});
		}
		const result = await generateTextWithResult<ToolSet, Fields, OutputInterface>(request as GenerateRequest & { messages: ModelMessage[] }, conversation);
		return tool ? generateToolOutput<ToolSet, Fields, OutputInterface>(result, request.tools as GenerateRequest['tools'], stepApprovals, stoppedByCondition) as unknown : result;
	}

	const call = async (...args: unknown[]) => invoke(callSettings(args), config.streaming === true);
	const run = async (...args: unknown[]) => invoke(runSettings(args), config.streaming === true);
	const component = Object.assign(call, { config, run });
	if (asTool) {
		const { providerOptions: _modelOptions, ...descriptorConfig } = config;
		return defineTool(component, prepared => invoke(
			prepared.context._toolOptions.abortSignal === undefined ? {} : { abortSignal: prepared.context._toolOptions.abortSignal },
			false, { tool: prepared }), undefined, descriptorConfig);
	}
	return Object.assign(component, {
		version: 'agent-v1' as const, id: config.id as string | undefined, tools: prepareRegistry(config).tools,
		resume: async (...args: unknown[]) => {
			const { values } = namedArguments(args);
			const [history, options = {}] = values;
			if (values.length > 2 || !Array.isArray(history) || !isRecord(options)) {
				throw new ValidationError('Use resume(messageHistory, options?) with positional history and an options object.');
			}
			const excluded = ['prompt', 'messageHistory', 'messages', 'options'].filter(key => Object.hasOwn(options, key));
			if (excluded.length) throw new ValidationError(`Unsupported resume settings: ${excluded.join(', ')}. Use positional history and application context; for a new turn, append a user message to history or use an ordinary call.`);
			const { approve, ...settings } = options;
			return invoke(settings, config.streaming === true, { literal: history, approve });
		},
		generate: async (args: Fields) => invoke(requireContextObject(args), false, { native: true }),
		stream: async (args: Fields) => invoke(requireContextObject(args), true, { native: true }),
	});
}
