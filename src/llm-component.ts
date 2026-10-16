import type { Context, ScriptPromptType, TemplatePromptType, PromptFunction } from './types/types.js';
import * as configs from './types/config.js';
import type { ValidateRunConfig } from './types/config-validation.js';
import type { CallContext, ContextArguments, RunContext, ValidateContextValue, ComponentCall } from './types/input.js';
import type { ProcessedConfig } from './types/merge.js';
import type { FunctionRunPrompt } from './types/function-prompt.js';
import { ConfigError, validateConfigBasics, validateLLMComponentCall, validateLoadedTextPrompt, validateMessagesArray } from './validate.js';
import { extractCallArguments } from './call-arguments.js';
import * as utils from './types/utils.js';
import type { LanguageModel, ModelMessage } from 'ai';
import { RequiredPromptType, AnyPromptSource } from './types/types.js';
import { AsyncEnvironment, NotFoundError } from 'cascada-engine';
import type { ILoaderAny } from 'cascada-engine';
import { createTemplatePromptRenderer, createScriptPromptRenderer, createFunctionPromptRenderer } from './prompt-renderers.js';
import { mergeConfigs } from './config-utils.js';

// Plain-text components call the SDK directly: a streamer's result is returned as is, not wrapped in a promise.
type LLMResult<TResult, PType extends RequiredPromptType> = PType extends 'text' | 'text-name' ? TResult : utils.EnsurePromise<TResult>;

type RunPrompt<TConfig, PType extends RequiredPromptType, PROMPT> = PType extends 'function'
	? unknown
	: TConfig extends { prompt: AnyPromptSource }
	? unknown
	: PType extends 'text' | 'text-name'
	? TConfig extends { messages: ModelMessage[] } ? unknown : { prompt: PROMPT } | { messages: ModelMessage[] }
	: { prompt: PROMPT };

type RenderedArguments<TConfig, PROMPT> = TConfig extends { prompt: PROMPT }
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

//@todo - INPUT like in template
export type LLMCallSignature<
	TConfig extends configs.BaseConfig, // & configs.OptionalPromptConfig,
	TResult,
	PType extends RequiredPromptType = RequiredPromptType,
	PROMPT extends AnyPromptSource = string,
	TConfigShape = Record<string, any>, //temporary default value
	TAllowedConfigShape = Omit<Partial<TConfigShape>, configs.RunConfigDisallowedProperties> & Pick<configs.LLMRunConfig, 'abortSignal'>
//INPUT extends Record<string, any> = TConfig extends { inputSchema: SchemaType<any> } ? utils.InferParameters<TConfig['inputSchema']> : Record<string, any>,
> = LLMComponent<TConfig, LLMResult<TResult, PType>, (PType extends 'function' ? Omit<TAllowedConfigShape, 'prompt'> & FunctionRunPrompt<TConfig> : TAllowedConfigShape) & RunPrompt<TConfig, PType, PROMPT> & (PType extends 'text' | 'text-name' ? unknown : RunContext<TConfig>)> & (PType extends 'text' | 'text-name'
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
	: PType extends 'function'
	? (
		// Function-based renderers only accept a context object.
		// Overriding the prompt function with a one-off string is ambiguous.
		<TContext extends CallContext<TConfig> = CallContext<TConfig>>(...args: ContextArguments<TConfig, TContext> & NoInfer<ValidateContextValue<TContext>>) => utils.EnsurePromise<TResult>
	)
	: (
		// TConfig has template or script or function; return type is always a promise
		// we can have a prompt and/or messages at the same time (prompt are required and get rendered).
		ComponentCall<RenderedArguments<TConfig, PROMPT>, utils.EnsurePromise<TResult>, true>
	));

//@todo - the promptComponent shall use a precompiled template/script when created with a template/script promptType
export function _createLLMComponent<
	TConfig extends {
		debug?: boolean, model: LanguageModel, promptType?: RequiredPromptType,
		prompt?: AnyPromptSource, messages?: ModelMessage[], context?: Context, loader?: unknown, abortSignal?: AbortSignal
	},
	TResult,
	PT extends RequiredPromptType = RequiredPromptType
>(
	config: TConfig,
	execute: (config: TConfig, conversation: ModelMessage[]) => TResult,
	{ type, streaming }: { type: string, streaming: boolean }
): LLMCallSignature<TConfig, TResult, PT, AnyPromptSource, configs.BaseConfig> {
	// Debug output if config.debug is true
	if (config.debug) {
		console.log('[DEBUG] LLMComponent created with config:', config);
	}

	// Use the same history contract for plain text and rendered/conversational prompts.
	const executeLLM = (runConfig: TConfig, prompt: string | ModelMessage[] | undefined, historyPrefix: ModelMessage[] | undefined): TResult => {
		// SDK request arrays are copied below; keep lazy response history tied to that request too.
		const usesMessages = Array.isArray(prompt) || Boolean(runConfig.messages);
		const promptMessages: ModelMessage[] = Array.isArray(prompt) ? [...prompt]
			: typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : [];
		const request = { ...runConfig, prompt } as TConfig;
		if (usesMessages) {
			request.messages = [...runConfig.messages ?? [], ...promptMessages];
			delete request.prompt;
		}
		runConfig.abortSignal?.throwIfAborted();
		return execute(request, [...historyPrefix ?? [], ...promptMessages]);
	};

	let call;
	let run: (
		configArg: configs.LLMRunConfig,
		calledFromCall: boolean
	) => TResult | Promise<TResult>;

	if (config.promptType !== 'text' && config.promptType !== 'text-name' && config.promptType !== undefined) {
		// Dynamic Path - use Template/Script/Function to render the prompt
		type FunctionComponent = ReturnType<typeof createFunctionPromptRenderer>;
		type ScriptComponent = ReturnType<typeof createScriptPromptRenderer>;
		type TemplateComponent = ReturnType<typeof createTemplatePromptRenderer>;

		let renderer: TemplateComponent | ScriptComponent | FunctionComponent;
		const isTemplatePrompt = config.promptType === 'async-template' || config.promptType === 'async-template-name';
		const isScriptPrompt = config.promptType === 'async-script' || config.promptType === 'async-script-name';
		const isFunctionPrompt = config.promptType === 'function';

		if (isTemplatePrompt) {
			renderer = createTemplatePromptRenderer(config, config.prompt as string | undefined, config.promptType as TemplatePromptType);
		} else if (isScriptPrompt) {
			renderer = createScriptPromptRenderer(config, config.prompt as string | undefined, config.promptType as ScriptPromptType);
		} else if (isFunctionPrompt) {
			renderer = createFunctionPromptRenderer(config, config.prompt as PromptFunction);
		} else {
			throw new Error(`Unhandled prompt type: ${config.promptType}`);
		}
		run = async (
			configArg: configs.LLMRunConfig,
			calledFromCall = false
		): Promise<TResult> => {
			//  Merge configurations to get a complete view for this run.
			// Call-time arguments (configArg) override factory settings (config).
			const runConfig = mergeConfigs(config, configArg);
			const promptOverride = configArg.prompt;
			// Rendering and input validation may await; snapshot both sides of the history contract together.
			const historyPrefix = configArg.messages?.slice();
			if (runConfig.messages) runConfig.messages = [...runConfig.messages] as typeof runConfig.messages;

			if (!calledFromCall) {
				if (config.debug) {
					console.log(`[DEBUG] LLM ${config.promptType!} run() called with:`, { configArg });
				}
				validateMessagesArray(configArg.messages);
				await validateLLMComponentCall(runConfig as Partial<configs.AnyConfig<any, any, any, any>>, config.promptType!, configArg.context);
			}

			// Render the prompt
			let renderedPrompt: string | ModelMessage[];
			if (!isFunctionPrompt && promptOverride !== undefined && typeof promptOverride !== 'string') {
				throw new ConfigError("A 'prompt' override for a template or script-based component must be a string containing the template or script.");
			}
			if (isFunctionPrompt && promptOverride !== undefined) {
				if (typeof promptOverride !== 'function') {
					throw new ConfigError("The 'prompt' property must be a function when using withFunction().");
				}
				const runRenderer = createFunctionPromptRenderer(runConfig, promptOverride);
				renderedPrompt = await runRenderer(runConfig.context);
			} else if (typeof promptOverride === 'string' && !isFunctionPrompt) {
				//re-compile with the new prompt
				renderedPrompt = await (renderer as (prompt: string, context?: Context) => Promise<string | ModelMessage[]>)(promptOverride, runConfig.context);
			} else {
				// the renderer has precompiled script/template or is a function, just give it the context
				renderedPrompt = await (renderer as (context?: Context) => string | ModelMessage[] | PromiseLike<string | ModelMessage[]>)(runConfig.context);
			}

			if (runConfig.debug) {
				console.log('[DEBUG] LLMComponent.run executed with:', { configArg, renderedPrompt });
			}

			return await executeLLM(runConfig as TConfig, renderedPrompt, historyPrefix);
		};
		call = async (
			promptOrMessageOrContext?: string | ModelMessage[] | Context,
			messagesOrContext?: ModelMessage[] | Context,
			maybeContext?: Context
		): Promise<TResult> => {
			// Snapshot positional history before input validation can yield.
			if (Array.isArray(promptOrMessageOrContext)) promptOrMessageOrContext = [...promptOrMessageOrContext];
			if (Array.isArray(messagesOrContext)) messagesOrContext = [...messagesOrContext];
			if (config.debug) {
				console.log(`[DEBUG] LLM ${config.promptType!} caller called with:`, { promptOrMessageOrContext, messagesOrContext, maybeContext });
			}
			await validateLLMComponentCall(config, config.promptType!, promptOrMessageOrContext, messagesOrContext, maybeContext);

			const { prompt, messages, context } = extractCallArguments(promptOrMessageOrContext, messagesOrContext, maybeContext);
			const callConfig = {
				...(prompt !== undefined && { prompt }),
				...(messages !== undefined && { messages }),
				...(context !== undefined && { context })
			};
			return run(callConfig, true);
		};
	} else {
		// Static Path - vanilla text prompt,promptType is 'text' or undefined
		// A plain-text streamer returns its result directly, so it throws; other components return promises, which reject.
		const returnsResult = config.promptType !== 'text-name' && streaming;
		const settle = (execute: () => TResult): TResult => {
			if (returnsResult) return execute();
			try {
				return execute();
			} catch (error) {
				// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Preserve arbitrary AbortSignal reasons by identity.
				return Promise.reject(error) as TResult;
			}
		};
		const validateTextRun = (runConfig: TConfig, configArg: configs.LLMRunConfig): void => {
			if (config.debug) {
				console.log(`[DEBUG] LLM ${config.promptType!} run() called with:`, { configArg });
			}
			validateMessagesArray(configArg.messages);
			// Plain text has no rendered context; loaded text validates its name before reading the source.
			void validateLLMComponentCall(runConfig, config.promptType ?? 'text', configArg.context);
		};
		run = (
			configArg: configs.LLMRunConfig,
			calledFromCall = false
		): TResult => settle(() => {
			const runConfig = mergeConfigs(config, configArg) as TConfig;
			if (!calledFromCall) {
				validateTextRun(runConfig, configArg);
			}
			return executeLLM(runConfig, runConfig.prompt as string | ModelMessage[] | undefined, configArg.messages);
		});
		call = (promptOrMessages?: string | ModelMessage[], maybeMessages?: ModelMessage[]): TResult => settle(() => {
			if (config.debug) {
				console.log('[DEBUG] createLLMComponent - text path called with:', { promptOrMessages, maybeMessages });
			}
			void validateLLMComponentCall(config, config.promptType ?? 'text', promptOrMessages, maybeMessages);

			const { prompt, messages } = extractCallArguments(promptOrMessages, maybeMessages);
			const callConfig = {
				...(prompt !== undefined && { prompt }),
				...(messages !== undefined && { messages }),
			};
			return run(callConfig, true) as TResult;
		});
		if (config.promptType === 'text-name') {
			const env = new AsyncEnvironment(config.loader as ILoaderAny | ILoaderAny[]);
			const textRun = run;
			run = async (
				configArg: configs.LLMRunConfig,
				calledFromCall = false
			): Promise<TResult> => {
				validateConfigBasics(configArg);
				configArg = { ...configArg, messages: configArg.messages?.slice() };
				validateLoadedTextPrompt(configArg.prompt);
				const name = configArg.prompt ?? config.prompt;
				validateLoadedTextPrompt(name);
				if (!calledFromCall) {
					validateTextRun(mergeConfigs(config, configArg) as TConfig, configArg);
				}
				let prompt: string | undefined;
				try {
					if (name !== undefined) prompt = await env.loadString(name);
				} catch (error) {
					if (error instanceof NotFoundError) {
						throw new Error(`Failed to load prompt: ${error.message}`, { cause: error });
					}
					throw error;
				}
				return textRun({ ...configArg, prompt }, true);
			};
		}
	}
	const callSignature = Object.assign(call, { config, type, run });
	return callSignature as LLMCallSignature<TConfig, TResult, PT, AnyPromptSource, configs.BaseConfig>;
}
