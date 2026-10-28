import type { LanguageModel, ModelMessage, OutputInterface } from 'ai';
import type { CascadaConfig } from '../types/config.js';
import type { AnyPromptSource, PromptType } from '../types/prompt.js';
import type { ExecutionConfig, PreparedExecutionContext, PreparedToolRegistry } from '../types/execution.js';
import type { GenerateRequest, StreamRequest, PrepareStepOptions } from '../types/sdk.js';
import type { Fields } from '../types/utils.js';
import { isRecord } from '@ai-sdk/provider-utils';
import { generateTextWithResult, streamTextWithResult } from './augment-result.js';
import { mergeConfigs } from '../config/config-utils.js';
import { createPromptRenderer } from '../renderers/prompt-renderers.js';
import { defineTool, descriptorKeys, namedArguments, prepareExecution, prepareRegistry, validateRegistryConfig } from './execution.js';
import { ConfigError, ValidationError } from '../errors.js';
import { requireContextObject } from '../schema.js';
import { validateConfigBasics, validateMessagesArray } from '../config/validate.js';
import { observers, aliases, protectedSettings, streamingSettings, agentSourceConflicts, fixedSettings } from './agent-settings-policy.js';

type CallHook = (request: Fields, config: RuntimeAgentConfig, context: PreparedExecutionContext) => Fields | PromiseLike<Fields>;
type StepHook = (step: PrepareStepOptions, config: RuntimeAgentConfig, context: PreparedExecutionContext) => ReturnType<NonNullable<StreamRequest['prepareStep']>>;
export type RuntimeAgentConfig = ExecutionConfig & CascadaConfig & Fields & {
	model: LanguageModel;
	prompt?: AnyPromptSource;
	promptType: PromptType;
	streaming?: true;
	output?: OutputInterface;
	prepareCall?: CallHook;
	prepareStep?: StepHook;
	abortSignal?: AbortSignal;
};

export const componentSettings = ['prompt', 'messageHistory', 'context', 'inputSchema', 'toolContextSchema', 'promptType', 'filters',
	'renderOptions', 'loader', 'id', 'streaming', 'asTool', 'debug', 'prepareCall', ...descriptorKeys.filter(key => key !== 'providerOptions')] as const;
function rejectSettings(settings: Fields, keys: readonly string[], ErrorClass: typeof ConfigError | typeof ValidationError) {
	const invalid = keys.filter(key => Object.hasOwn(settings, key));
	if (invalid.length) throw new ErrorClass(`Unsupported LLMAgent settings: ${invalid.join(', ')}.`);
}

/** Positional calls select source, context, then history. Only marked Cascada keywords may follow history. */
function callSettings(args: readonly unknown[], promptType: PromptType): Fields {
	const { values, keywords } = namedArguments(args);
	if (values.length > 3) throw new ValidationError('Unexpected LLMAgent arguments.');
	if (keywords && values.length > 1 && Array.isArray(values.at(-2))) {
		// A plain agent's first array is its new prompt, not history.
		if (values.length === 3 || promptType !== 'text') [values[values.length - 2], values[values.length - 1]] = [values.at(-1), values.at(-2)];
	}
	let source: unknown;
	const first = values[0];
	if (typeof first === 'string' || typeof first === 'function' || Array.isArray(first) && promptType === 'text' || first === undefined && values.length > 1) {
		source = values.shift();
	}
	let context: unknown;
	if (!Array.isArray(values[0])) context = values.shift();
	const history = values.shift();
	if (values.some(value => value !== undefined) || history !== undefined && !Array.isArray(history)) {
		throw new ValidationError('Use (prompt, context, messageHistory) or (context, messageHistory).');
	}
	if (Array.isArray(first) && promptType !== 'text' && !keywords) throw new ValidationError('A rendered agent requires a source or context before history.');
	return { prompt: source, context, messageHistory: history };
}

function messages(prompt: unknown, literal: boolean): ModelMessage[] {
	if (typeof prompt === 'string') return [{ role: 'user', content: prompt }];
	if (Array.isArray(prompt)) return [...prompt as ModelMessage[]];
	if (prompt === undefined && !literal) return [];
	throw new ValidationError('A literal prompt must be text or model messages.');
}

/** One invocation path; only source preparation differs between Casai and native SDK calls. */
export function createLLMAgent(config: RuntimeAgentConfig) {
	const asTool = config.asTool === true;
	if (config.debug) console.log('[DEBUG] LLMAgent created with config:', config);
	const promptType = config.promptType;
	const renderer = createPromptRenderer(config);

	async function invoke(raw: Fields, streaming: boolean, { native = false, tool }: {
		native?: boolean; tool?: { context: PreparedExecutionContext; registry: PreparedToolRegistry };
	} = {}) {
		if (config.debug) console.log('[DEBUG] LLMAgent call:', raw);
		(raw.abortSignal as AbortSignal | undefined)?.throwIfAborted();
		const supplied = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined));
		if (native) {
			if (supplied.prompt !== undefined && supplied.messages !== undefined) throw new ValidationError('Supply prompt or messages, not both.');
			if (supplied.prompt === undefined && supplied.messages === undefined) throw new ValidationError('A native agent call requires prompt or messages.');
			if (supplied.options !== undefined) supplied.context = supplied.options;
			delete supplied.options;
			for (const [key, alias] of Object.entries(aliases)) {
				if (supplied[key] === undefined && supplied[alias] !== undefined) supplied[key] = supplied[alias];
				Reflect.deleteProperty(supplied, alias);
			}
		} else {
			validateConfigBasics(raw, ValidationError);
		}
		rejectSettings(raw, [...fixedSettings, ...agentSourceConflicts], ValidationError);
		const literal = native ? messages(supplied.messages ?? supplied.prompt, true) : undefined;
		delete supplied.messages;
		if (native) delete supplied.prompt;
		if (Array.isArray(supplied.prompt)) supplied.prompt = [...supplied.prompt as ModelMessage[]];
		// The SDK validates the hook's request, but history and output checks retain the original conversation.
		for (const original of [supplied.messageHistory, literal, Array.isArray(supplied.prompt) ? supplied.prompt : undefined]) {
			validateMessagesArray(original, ValidationError);
		}
		const history = supplied.messageHistory === undefined ? [] : [...supplied.messageHistory as ModelMessage[]];
		const settings = mergeConfigs(config, supplied, ValidationError) as RuntimeAgentConfig;
		settings.abortSignal?.throwIfAborted();
		validateRegistryConfig(settings, supplied, ValidationError);
		const execution = tool ?? await prepareExecution({ ...settings, context: config.context }, supplied.context,
			settings.abortSignal === undefined ? {} : { abortSignal: settings.abortSignal });
		const prompt = !native && settings.prompt !== undefined
			? await renderer(settings.prompt === config.prompt ? undefined : settings.prompt, execution.context) : undefined;
		const conversation = literal ?? [...history, ...messages(prompt, false)];
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
		if (prepareStep) request = { ...request, prepareStep: async (step: PrepareStepOptions) => {
			const next = await prepareStep(step, settings, execution.context);
			if (next?.toolsContext !== undefined) registry.assertContext(next.toolsContext);
			return next;
		} };
		request = { ...request, ...protectedValues, messages: [...request.messages as ModelMessage[]] };
		if (!streaming) for (const key of streamingSettings) Reflect.deleteProperty(request, key);
		settings.abortSignal?.throwIfAborted();
		if (streaming) {
			const { result, finalOutput } = streamTextWithResult(request as StreamRequest & { messages: ModelMessage[] }, conversation);
			return tool ? finalOutput() as Promise<unknown> : result;
		}
		const result = await generateTextWithResult(request as GenerateRequest & { messages: ModelMessage[] }, conversation);
		return tool ? result.value as unknown : result;
	}

	const call = async (...args: unknown[]) => invoke(callSettings(args, promptType), config.streaming === true);
	const run = async (...args: unknown[]) => {
		const { values } = namedArguments(args);
		if (values.length > 1) throw new ValidationError('An agent run accepts one settings object.');
		return invoke(requireContextObject(values[0] === undefined ? {} : values[0]), config.streaming === true);
	};
	const component = Object.assign(call, { config, run });
	if (asTool) {
		const { providerOptions: _modelOptions, ...descriptorConfig } = config;
		return defineTool(component, (context, registry) => invoke(
			context._toolOptions.abortSignal === undefined ? {} : { abortSignal: context._toolOptions.abortSignal },
			config.streaming === true, { tool: { context, registry } }), undefined, descriptorConfig);
	}
	return Object.assign(component, {
		version: 'agent-v1' as const, id: config.id as string | undefined, tools: prepareRegistry(config).tools,
		generate: async (args: Fields) => invoke(requireContextObject(args), false, { native: true }),
		stream: async (args: Fields) => invoke(requireContextObject(args), true, { native: true }),
	});
}
