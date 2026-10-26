import { ValidationError } from './errors.js';
import type { Context } from './types/types.js';
import * as configs from './types/config.js';
import type { ValidateRunConfig } from './types/config-validation.js';
import type { ContextArguments, RunContext, ComponentCall } from './types/input.js';
import type { ProcessedConfig } from './types/merge.js';
import type { FunctionRunPrompt } from './types/function-prompt.js';
import { validateLLMComponentCall, validateLoadedTextPrompt } from './validate.js';
import { extractCallArguments } from './call-arguments.js';
import * as utils from './types/utils.js';
import type { LanguageModel, ModelMessage } from 'ai';
import { RequiredPromptType, AnyPromptSource } from './types/types.js';
import { AsyncEnvironment, NotFoundError } from 'cascada-engine';
import type { ILoaderAny } from 'cascada-engine';
import { createPromptRenderer } from './prompt-renderers.js';
import { defineTool, descriptorKeys, namedArguments, prepareExecution, prepareRegistry, validateRegistryConfig } from './execution.js';
import type { ExecutionConfig, PreparedExecutionContext, PreparedToolRegistry } from './types/execution.js';
import { mergeConfigs } from './config-utils.js';
import { requireContextObject } from './schema.js';
import type { PrepareStep, PrepareStepOptions } from './types/sdk.js';

// Remove Casai's settings and outer tool metadata; all native model options pass through.
const componentSettings = [
	'context', 'inputSchema', 'toolContextSchema', 'promptType', 'loader', 'filters', 'renderOptions', 'debug',
	...descriptorKeys.filter(key => key !== 'providerOptions'),
];

// Plain-text components call the SDK directly: a streamer's result is returned as is, not wrapped in a promise.
type LLMResult<TResult, TPromptType extends RequiredPromptType> = TPromptType extends 'text' | 'text-name' ? TResult : utils.EnsurePromise<TResult>;

type RunPrompt<TConfig, TPromptType extends RequiredPromptType, PROMPT> = TPromptType extends 'function'
	? unknown
	: TConfig extends { prompt: AnyPromptSource }
	? unknown
	: TPromptType extends 'text' | 'text-name'
	? TConfig extends { messages: ModelMessage[] } ? unknown : { prompt: PROMPT } | { messages: ModelMessage[] }
	: { prompt: PROMPT };

// Keep configuration alternatives together when deriving required input.
type RenderedArguments<TConfig, PROMPT> = [TConfig] extends [{ prompt: PROMPT }]
	? ContextArguments<TConfig>
	| [promptOrMessages: PROMPT | ModelMessage[], ...args: ContextArguments<TConfig>]
	| [prompt: PROMPT | undefined, messages: ModelMessage[], ...args: ContextArguments<TConfig>]
	: [prompt: PROMPT, ...args: ContextArguments<TConfig>]
	| [prompt: PROMPT, messages: ModelMessage[], ...args: ContextArguments<TConfig>];

interface LLMComponent<TConfig, TResult, TAllowedConfigShape> {
	config: ProcessedConfig<TConfig>;
	type: string;
	run<const TRunConfig extends object>(config: TRunConfig & TAllowedConfigShape & ValidateRunConfig<TRunConfig, TConfig, TAllowedConfigShape>): TResult;
}

export type LLMCallSignature<
	TConfig,
	TResult,
	TPromptType extends RequiredPromptType = RequiredPromptType,
	PROMPT extends AnyPromptSource = string,
	TConfigShape = Record<string, any>,
	TAllowedConfigShape = Omit<Partial<TConfigShape>, configs.RunConfigDisallowedProperties> & Pick<configs.LLMRunConfig, 'abortSignal'>
> = LLMComponent<TConfig, LLMResult<TResult, TPromptType>, (TPromptType extends 'function' ? Omit<TAllowedConfigShape, 'prompt'> & FunctionRunPrompt<TConfig> : TAllowedConfigShape) & RunPrompt<TConfig, TPromptType, PROMPT> & (TPromptType extends 'text' | 'text-name' ? unknown : RunContext<TConfig>)> & (TPromptType extends 'text' | 'text-name'
	? (
		// TConfig has no template, no context argument is needed
		// We can have either a prompt or messages, but not both. No context as nothing is rendered.
		TConfig extends { prompt: string | ModelMessage[] } | { messages: ModelMessage[] }
		? {
			// Optional prompt/messages
			(prompt: string, messages?: ModelMessage[]): TResult;
			(prompt: undefined, messages: ModelMessage[]): TResult;
			(messages?: ModelMessage[]): TResult;
		}
		: {
			// Required a prompt or messages
			(prompt: string, messages?: ModelMessage[]): TResult;
			(prompt: undefined, messages: ModelMessage[]): TResult;
			(messages: ModelMessage[]): TResult;
		}
	)
	: TPromptType extends 'function'
	? (
		// Function-based renderers only accept a context object.
		// Overriding the prompt function with a one-off string is ambiguous.
		import('./types/application.js').ApplicationCaller<TConfig, Awaited<TResult>>
	)
	: (
		// TConfig has template or script or function; return type is always a promise
		// we can have a prompt and/or messages at the same time (prompt are required and get rendered).
		ComponentCall<RenderedArguments<TConfig, PROMPT>, utils.EnsurePromise<TResult>, true, TConfig>
	));

// The SDK owns model execution. Casai prepares context and source, then dispatches once.
export function _createLLMComponent<
	TConfig extends { debug?: boolean; model: LanguageModel; promptType?: RequiredPromptType; prompt?: AnyPromptSource; messages?: ModelMessage[]; context?: Context; loader?: unknown } & Pick<configs.LLMRunConfig, 'abortSignal'>,
	TResult,
>(config: TConfig, execute: (config: TConfig, conversation: ModelMessage[]) => TResult,
	{ type, streaming, toolValue }: { type: string; streaming: boolean; toolValue?: (result: Awaited<TResult>) => unknown },
) {
	if (config.debug) console.log('[DEBUG] LLMComponent created with config:', config);
	const promptType = config.promptType ?? 'text';
	const rendered = promptType !== 'text' && promptType !== 'text-name';
	const renderer = rendered ? createPromptRenderer(config as TConfig & configs.CascadaConfig) : undefined;
	const loader = promptType === 'text-name' ? new AsyncEnvironment(config.loader as ILoaderAny | ILoaderAny[]) : undefined;
	const base = config as TConfig & ExecutionConfig;
	function dispatch(settings: TConfig & ExecutionConfig, prompt: string | ModelMessage[] | undefined, history: ModelMessage[] | undefined, registry: PreparedToolRegistry): TResult {
		const promptMessages: ModelMessage[] = Array.isArray(prompt) ? [...prompt] : typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : [];
		const request = { ...settings, prompt };
		for (const key of componentSettings) Reflect.deleteProperty(request, key);
		if (Array.isArray(prompt) || settings.messages !== undefined) {
			request.messages = [...settings.messages ?? [], ...promptMessages];
			delete request.prompt;
		}
		if (settings.tools) {
			Object.assign(request, { tools: registry.tools, toolsContext: registry.toolsContext });
			const prepareStep = (settings as TConfig & { prepareStep?: PrepareStep }).prepareStep;
			if (prepareStep) Object.assign(request, { prepareStep: async (step: PrepareStepOptions) => {
				const next = await prepareStep(step);
				if (next?.toolsContext !== undefined) registry.assertContext(next.toolsContext);
				return next;
			} });
		}
		settings.abortSignal?.throwIfAborted();
		return execute(request, [...history ?? [], ...promptMessages]);
	}
	async function load(name: unknown) {
		validateLoadedTextPrompt(name, ValidationError);
		try { return name === undefined ? undefined : await loader!.loadString(name); }
		catch (error) {
			if (error instanceof NotFoundError) throw new Error('Failed to load prompt: ' + error.message, { cause: error });
			throw error;
		}
	}
	function invoke(settings: configs.LLMRunConfig = {}, prepared?: { context: PreparedExecutionContext; registry: PreparedToolRegistry }): TResult | Promise<TResult> {
		settings.abortSignal?.throwIfAborted();
		settings = { ...settings };
		if (settings.prompt === undefined) delete settings.prompt;
		const merged = mergeConfigs(config, settings, ValidationError) as TConfig & ExecutionConfig;
		validateLLMComponentCall(merged, promptType, settings.context);
		validateRegistryConfig(merged, settings as ExecutionConfig, ValidationError);
		const history = settings.messages?.slice();
		if (renderer) return (async () => {
			const execution = prepared ?? await prepareExecution({ ...merged, context: base.context }, settings.context,
				settings.abortSignal === undefined ? {} : { abortSignal: settings.abortSignal }, undefined, toolValue !== undefined);
			const prompt = await renderer(settings.prompt, execution.context);
			return dispatch(merged, prompt, history, execution.registry);
		})();
		const registry = prepared?.registry ?? prepareRegistry(merged);
		if (loader) return load(merged.prompt).then(prompt => dispatch(merged, prompt, history, registry));
		return dispatch(merged, merged.prompt as string | ModelMessage[] | undefined, history, registry);
	}
	function run(...args: unknown[]): TResult | Promise<TResult> {
		const perform = () => {
			const normalized = namedArguments(args);
			if (normalized.length > 1) throw new ValidationError('A component run accepts one settings object.');
			const settings = requireContextObject(normalized[0]) as configs.LLMRunConfig;
			const fixed = configs.fixedRunSettings.filter(key => Object.hasOwn(settings, key));
			if (fixed.length) throw new ValidationError(`Settings fixed at component creation cannot be overridden: ${fixed.join(', ')}.`);
			return invoke(settings);
		};
		if (streaming && promptType === 'text') return perform();
		// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Preserve native rejection values.
		try { return perform(); } catch (error) { return Promise.reject(error); }
	}
	function call(...args: unknown[]): TResult | Promise<TResult> {
		if (config.debug) console.log('[DEBUG] Component call:', { promptType, args });
		const perform = () => {
			const normalized = namedArguments(args);
			if (normalized.length > 3) throw new ValidationError('Unexpected component arguments.');
			const tuple = normalized as [string | ModelMessage[] | Context | undefined, (ModelMessage[] | Context)?, Context?];
			const { prompt, messages, context } = extractCallArguments(...tuple);
			if (promptType === 'function' && (prompt !== undefined || messages !== undefined || tuple[1] !== undefined || tuple[2] !== undefined)) {
				throw new ValidationError('Function-prompt components only accept a context object.');
			}
			return invoke({ ...(prompt === undefined ? {} : { prompt }), ...(messages === undefined ? {} : { messages }), ...(context === undefined ? {} : { context }) });
		};
		if (streaming && promptType === 'text') return perform();
		// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Preserve native rejection values.
		try { return perform(); } catch (error) { return Promise.reject(error); }
	}
	const component = Object.assign(call, { config: base, type, run });
	if (toolValue) {
		// These options configure this component's model, not its outer tool definition.
		const { providerOptions: _modelOptions, ...descriptorConfig } = config as TConfig & { providerOptions?: unknown };
		defineTool(component, async (context, registry) => {
			const metadata = context._toolOptions;
			const result = await invoke(metadata.abortSignal === undefined ? {} : { abortSignal: metadata.abortSignal }, { context, registry });
			return toolValue(result);
		}, undefined, descriptorConfig);
	}
	return component;
}
