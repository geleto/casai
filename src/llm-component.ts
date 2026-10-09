import type { Context, ScriptPromptType, TemplatePromptType, PromptFunction } from './types/types.js';
import * as configs from './types/config.js';
import type { ValidateRunConfig } from './types/config-validation.js';
import type { CallContext, ContextArguments, RunContext, ValidateContextValue } from './types/input.js';
import type { FunctionRunPrompt } from './types/function-prompt.js';
import { ConfigError, validateConfigBasics, validateLLMComponentCall, validateLoadedTextPrompt, validateMessagesArray } from './validate.js';
import { extractCallArguments } from './call-arguments.js';
import * as utils from './types/utils.js';
import { generateObject, generateText, streamObject, streamText } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import type { GenerateTextResult, StreamTextResult } from 'ai';
import { RequiredPromptType, AnyPromptSource } from './types/types.js';
import { AsyncEnvironment, NotFoundError } from 'cascada-engine';
import type { ILoaderAny } from 'cascada-engine';
import { createTemplatePromptRenderer, createScriptPromptRenderer, createFunctionPromptRenderer } from './prompt-renderers.js';
import { augmentGenerateText, augmentStreamText, augmentTextFinishEvent } from './messages.js';
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

interface LLMComponent<TConfig, TResult, TAllowedConfigShape> {
	config: TConfig;
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
	TAllowedConfigShape = Omit<Partial<TConfigShape>, configs.RunConfigDisallowedProperties>
//INPUT extends Record<string, any> = TConfig extends { inputSchema: SchemaType<any> } ? utils.InferParameters<TConfig['inputSchema']> : Record<string, any>,
> = LLMComponent<TConfig, LLMResult<TResult, PType>, (PType extends 'function' ? Omit<TAllowedConfigShape, 'prompt'> & FunctionRunPrompt<TConfig> : TAllowedConfigShape) & RunPrompt<TConfig, PType, PROMPT> & (PType extends 'text' | 'text-name' ? unknown : RunContext<TConfig>)> & (PType extends 'text' | 'text-name'
	? (
		// TConfig has no template, no context argument is needed
		// We can have either a prompt or messages, but not both. No context as nothing is rendered.
		TConfig extends { prompt: string | ModelMessage[] } | { messages: ModelMessage[] }
		? {
			// Optional prompt/messages
			(prompt: string | ModelMessage[], messages?: ModelMessage[]): TResult;
			(messages?: ModelMessage[]): TResult;
		}
		: {
			// Required a prompt or messages
			(prompt: string | ModelMessage[], messages?: ModelMessage[]): TResult;
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
		TConfig extends { prompt: PROMPT }
		? {
			// Config already has a prompt => Optional prompt, optional messages, and optional context
			(prompt: PROMPT, messages: ModelMessage[], ...args: ContextArguments<TConfig>): utils.EnsurePromise<TResult>;
			(prompt: PROMPT, ...args: ContextArguments<TConfig>): utils.EnsurePromise<TResult>;
			(...args: ContextArguments<TConfig>): utils.EnsurePromise<TResult>;
		}
		: (
			// Requires a prompt, optional messages, and optional context
			//(prompt: string, message: ModelMessage[], context?: Context): utils.EnsurePromise<TResult>;
			(prompt: PROMPT, ...args: ContextArguments<TConfig>) => utils.EnsurePromise<TResult>
		)
	));

//@todo - the promptComponent shall use a precompiled template/script when created with a template/script promptType
export function _createLLMComponent<
	TConfig extends configs.OptionalPromptConfig & Partial<TFunctionConfig> & { context?: Context }
	& { debug?: boolean, model: LanguageModel, prompt?: string, messages?: ModelMessage[] }, // extends Partial<OptionalTemplatePromptConfig & GenerateTextConfig<TOOLS, OUTPUT>>,
	TFunctionConfig extends TConfig & { model: LanguageModel }, //@todo - rename to TVercelConfig
	TFunctionResult, //rename to TResult
	PT extends RequiredPromptType = RequiredPromptType
>(
	config: TConfig,
	vercelFunc: (config: TFunctionConfig) => TFunctionResult
): LLMCallSignature<TConfig, TFunctionResult, PT, AnyPromptSource, configs.BaseConfig> {
	// Debug output if config.debug is true
	if (config.debug) {
		console.log('[DEBUG] LLMComponent created with config:', config);
	}

	// The Vercel AI SDK functions for text and object generation accept a 'messages' array as input
	// to provide conversational context. This is crucial for building chat agents and multi-step workflows.
	const processMessages: boolean = (vercelFunc as unknown) === generateText || (vercelFunc as unknown) === streamText ||
		(vercelFunc as unknown) === generateObject || (vercelFunc as unknown) === streamObject;

	// Use the same history contract for plain text and rendered/conversational prompts.
	const executeLLM = (runConfig: TFunctionConfig, prompt: string | ModelMessage[] | undefined, historyPrefix: ModelMessage[] | undefined): TFunctionResult => {
		// SDK request arrays are copied below; keep lazy response history tied to that request too.
		historyPrefix = historyPrefix?.slice();
		const usesMessages = processMessages && (Array.isArray(prompt) || Boolean(runConfig.messages));
		// With a standalone SDK prompt, even an empty string is submitted as a user message.
		const promptMessages: ModelMessage[] = Array.isArray(prompt) ? [...prompt]
			: typeof prompt === 'string' && (prompt.length > 0 || !usesMessages) ? [{ role: 'user', content: prompt }] : [];
		const vercelConfig = { ...runConfig, prompt } as TFunctionConfig;
		if (usesMessages) {
			vercelConfig.messages = [...runConfig.messages ?? [], ...promptMessages];
			delete vercelConfig.prompt;
		}
		if ((vercelFunc as unknown) === streamText) {
			const streamConfig = vercelConfig as unknown as configs.StreamTextConfig<any, any>;
			// Match SDK precedence while exposing the same history as the returned response.
			const onEnd = streamConfig.onEnd ?? streamConfig.onFinish;
			if (onEnd) {
				streamConfig.onEnd = event => onEnd(augmentTextFinishEvent(event, promptMessages, historyPrefix));
			}
		}
		const result = vercelFunc(vercelConfig);
		if ((vercelFunc as unknown) === generateText) {
			return (result as Promise<GenerateTextResult<any, any, any>>)
				.then(r => augmentGenerateText(r, promptMessages, historyPrefix)) as TFunctionResult;
		}
		if ((vercelFunc as unknown) === streamText) {
			return augmentStreamText(result as StreamTextResult<any, any, any>, promptMessages, historyPrefix) as TFunctionResult;
		}
		return result;
	};

	let call;
	let run: (
		configArg: configs.LLMRunConfig,
		calledFromCall: boolean
	) => TFunctionResult | Promise<TFunctionResult>;

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
			renderer = createTemplatePromptRenderer(config, config.prompt, config.promptType as TemplatePromptType);
		} else if (isScriptPrompt) {
			renderer = createScriptPromptRenderer(config, config.prompt, config.promptType as ScriptPromptType);
		} else if (isFunctionPrompt) {
			renderer = createFunctionPromptRenderer(config, config.prompt as PromptFunction);
		} else {
			throw new Error(`Unhandled prompt type: ${config.promptType}`);
		}
		run = async (
			configArg: configs.LLMRunConfig,
			calledFromCall = false
		): Promise<TFunctionResult> => {
			//  Merge configurations to get a complete view for this run.
			// Call-time arguments (configArg) override factory settings (config).
			const runConfig = mergeConfigs(config, configArg);
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
			if (!isFunctionPrompt && configArg.prompt !== undefined && typeof configArg.prompt !== 'string') {
				throw new ConfigError("A 'prompt' override for a template or script-based component must be a string containing the template or script.");
			}
			if (isFunctionPrompt && configArg.prompt !== undefined) {
				if (typeof configArg.prompt !== 'function') {
					throw new ConfigError("The 'prompt' property must be a function when using withFunction().");
				}
				const runRenderer = createFunctionPromptRenderer(runConfig, configArg.prompt);
				renderedPrompt = await runRenderer(runConfig.context);
			} else if (typeof configArg.prompt === 'string' && !isFunctionPrompt) {
				//re-compile with the new prompt
				renderedPrompt = await (renderer as TemplateComponent | ScriptComponent)(configArg.prompt, runConfig.context) as string | ModelMessage[];
			} else {
				// the renderer has precompiled script/template or is a function, just give it the context
				renderedPrompt = await renderer(runConfig.context) as string | ModelMessage[];
			}

			if (runConfig.debug) {
				console.log('[DEBUG] LLMComponent.run executed with:', { configArg, renderedPrompt });
			}

			return await executeLLM(runConfig as TFunctionConfig, renderedPrompt, historyPrefix);
		};
		call = async (
			promptOrMessageOrContext?: string | ModelMessage[] | Context,
			messagesOrContext?: ModelMessage[] | Context,
			maybeContext?: Context
		): Promise<TFunctionResult> => {
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
		const returnsResult = config.promptType !== 'text-name' && ((vercelFunc as unknown) === streamText || (vercelFunc as unknown) === streamObject);
		const settle = (execute: () => TFunctionResult): TFunctionResult => {
			if (returnsResult) return execute();
			try {
				return execute();
			} catch (error) {
				return Promise.reject(error instanceof Error ? error : new Error(String(error))) as TFunctionResult;
			}
		};
		const validateTextRun = (runConfig: TFunctionConfig, configArg: configs.LLMRunConfig): void => {
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
		): TFunctionResult => settle(() => {
			const runConfig = mergeConfigs(config, configArg) as TFunctionConfig;
			if (!calledFromCall) {
				validateTextRun(runConfig, configArg);
			}
			return executeLLM(runConfig, runConfig.prompt, configArg.messages);
		});
		call = (promptOrMessages?: string | ModelMessage[], maybeMessages?: ModelMessage[]): TFunctionResult => settle(() => {
			if (config.debug) {
				console.log('[DEBUG] createLLMComponent - text path called with:', { promptOrMessages, maybeMessages });
			}
			void validateLLMComponentCall(config, config.promptType ?? 'text', promptOrMessages, maybeMessages);

			const { prompt, messages } = extractCallArguments(promptOrMessages, maybeMessages);
			const callConfig = {
				...(prompt !== undefined && { prompt }),
				...(messages !== undefined && { messages }),
			};
			return run(callConfig, true) as TFunctionResult;
		});
		if (config.promptType === 'text-name') {
			const loaderConfig = config as configs.LoaderConfig;
			const env = new AsyncEnvironment(loaderConfig.loader as ILoaderAny | ILoaderAny[]);
			const textRun = run;
			run = async (
				configArg: configs.LLMRunConfig,
				calledFromCall = false
			): Promise<TFunctionResult> => {
				validateConfigBasics(configArg);
				validateLoadedTextPrompt(configArg.prompt);
				const name = configArg.prompt ?? config.prompt;
				validateLoadedTextPrompt(name);
				if (!calledFromCall) {
					validateTextRun(mergeConfigs(config, configArg) as TFunctionConfig, configArg);
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
	// Get the function name and capitalize it to create the type
	const functionName = vercelFunc.name;
	const type = functionName.charAt(0).toUpperCase() + functionName.slice(1);

	const callSignature = Object.assign(call, { config, type, run });
	return callSignature as LLMCallSignature<TConfig, TFunctionResult, PT, AnyPromptSource, configs.BaseConfig>;
}
