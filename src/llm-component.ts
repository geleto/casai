import type { Context, ScriptPromptType, TemplatePromptType, PromptFunction } from './types/types.js';
import * as configs from './types/config.js';
import type { ValidateRunConfig } from './types/config-validation.js';
import { ConfigError, validateLLMComponentCall } from './validate.js';
import { extractCallArguments } from './call-arguments.js';
import * as utils from './types/utils.js';
import { generateObject, generateText, streamObject, streamText } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import type { GenerateTextResult, StreamTextResult } from 'ai';
import { RequiredPromptType, AnyPromptSource } from './types/types.js';
import { loadString } from 'cascada-engine';
import type { ILoaderAny } from 'cascada-engine';
import { createTemplatePromptRenderer, createScriptPromptRenderer, createFunctionPromptRenderer } from './prompt-renderers.js';
import { augmentGenerateText, augmentStreamText } from './messages.js';
import { mergeConfigs } from './config-utils.js';

interface LLMComponent<TConfig, TResult, TAllowedConfigShape> {
	config: TConfig;
	type: string;
	run<const TRunConfig extends object>(config: TRunConfig & TAllowedConfigShape & ValidateRunConfig<TRunConfig, TConfig, TAllowedConfigShape>): utils.EnsurePromise<TResult>;
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
> = LLMComponent<TConfig, TResult, TAllowedConfigShape> & (PType extends 'text' | 'text-name'
	? (
		// TConfig has no template, no context argument is needed
		// We can have either a prompt or messages, but not both. No context as nothing is rendered.
		TConfig extends { prompt: string | ModelMessage[] } | { messages: ModelMessage[] }
		? {
			// Optional prompt/messages
			(prompt: string | ModelMessage[], messages?: ModelMessage[]): utils.EnsurePromise<TResult>;
			(messages?: ModelMessage[]): utils.EnsurePromise<TResult>;
		}
		: {
			// Required a prompt or messages
			(prompt: string | ModelMessage[], messages?: ModelMessage[]): utils.EnsurePromise<TResult>;
			(messages: ModelMessage[]): utils.EnsurePromise<TResult>;
		}
	)
	: PType extends 'function'
	? (
		// Function-based renderers only accept a context object.
		// Overriding the prompt function with a one-off string is ambiguous.
		(context?: Context) => utils.EnsurePromise<TResult>
	)
	: (
		// TConfig has template or script or function; return type is always a promise
		// we can have a prompt and/or messages at the same time (prompt are required and get rendered).
		TConfig extends { prompt: PROMPT }
		? {
			// Config already has a prompt => Optional prompt, optional messages, and optional context
			(prompt: PROMPT, messages: ModelMessage[], context?: Context): utils.EnsurePromise<TResult>;
			(prompt: PROMPT, context?: Context): utils.EnsurePromise<TResult>;
			(context?: Context): utils.EnsurePromise<TResult>;
		}
		: (
			// Requires a prompt, optional messages, and optional context
			//(prompt: string, message: ModelMessage[], context?: Context): utils.EnsurePromise<TResult>;
			(prompt: PROMPT, context?: Context) => utils.EnsurePromise<TResult>
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
		console.log('[DEBUG] LLMComponent created with config:', JSON.stringify(config, null, 2));
	}

	// The Vercel AI SDK functions for text and object generation accept a 'messages' array as input
	// to provide conversational context. This is crucial for building chat agents and multi-step workflows.
	const processMessages: boolean = (vercelFunc as unknown) === generateText || (vercelFunc as unknown) === streamText ||
		(vercelFunc as unknown) === generateObject || (vercelFunc as unknown) === streamObject;

	// Use the same history contract for plain text and rendered/conversational prompts.
	const executeLLM = (runConfig: TFunctionConfig, prompt: string | ModelMessage[] | undefined, historyPrefix: ModelMessage[] | undefined): TFunctionResult => {
		const promptMessages: ModelMessage[] = prompt
			? Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }]
			: [];
		const vercelConfig = { ...runConfig, prompt } as TFunctionConfig;
		if (processMessages && (Array.isArray(prompt) || runConfig.messages)) {
			vercelConfig.messages = [...runConfig.messages ?? [], ...promptMessages];
			delete vercelConfig.prompt;
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
		const isTemplatePrompt = config.promptType === 'template' || config.promptType === 'template-name' || config.promptType === 'async-template' || config.promptType === 'async-template-name';
		const isScriptPrompt = config.promptType === 'script' || config.promptType === 'script-name' || config.promptType === 'async-script' || config.promptType === 'async-script-name';
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

			if (!calledFromCall) {
				if (config.debug) {
					console.log(`[DEBUG] LLM ${config.promptType!} run() called with:`, { configArg });
				}
				validateLLMComponentCall(runConfig as Partial<configs.AnyConfig<any, any, any, any>>, config.promptType!, configArg.context);
			}

			// Render the prompt
			let renderedPrompt: string | ModelMessage[];
			if (isFunctionPrompt && configArg.prompt !== undefined) {
				if (typeof configArg.prompt !== 'function') {
					throw new ConfigError("The 'prompt' property must be a function when using withFunction().");
				}
				const runRenderer = createFunctionPromptRenderer(runConfig, configArg.prompt);
				renderedPrompt = await runRenderer(runConfig.context);
			} else if (typeof configArg.prompt === 'string' && configArg.prompt && !isFunctionPrompt) {
				//re-compile with the new prompt
				renderedPrompt = await (renderer as TemplateComponent | ScriptComponent)(configArg.prompt, runConfig.context) as string | ModelMessage[];
			} else {
				// the renderer has precompiled script/template or is a function, just give it the context
				renderedPrompt = await renderer(runConfig.context) as string | ModelMessage[];
			}

			if (runConfig.debug) {
				console.log('[DEBUG] LLMComponent.run executed with:', { configArg, renderedPrompt });
			}

			return await executeLLM(runConfig as TFunctionConfig, renderedPrompt, configArg.messages);
		};
		call = async (
			promptOrMessageOrContext?: string | ModelMessage[] | Context,
			messagesOrContext?: ModelMessage[] | Context,
			maybeContext?: Context
		): Promise<TFunctionResult> => {
			if (config.debug) {
				console.log(`[DEBUG] LLM ${config.promptType!} caller called with:`, { promptOrMessageOrContext, messagesOrContext, maybeContext });
			}
			validateLLMComponentCall(config, config.promptType!, promptOrMessageOrContext, messagesOrContext, maybeContext);

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
		run = (
			configArg: configs.LLMRunConfig,
			calledFromCall = false
		): TFunctionResult => {
			const runConfig = mergeConfigs(config, configArg) as TFunctionConfig;
			if (!calledFromCall) {
				if (config.debug) {
					console.log(`[DEBUG] LLM ${config.promptType!} run() called with:`, { configArg });
				}
				validateLLMComponentCall(runConfig, config.promptType ?? 'text', undefined);
			}
			return executeLLM(runConfig, runConfig.prompt, configArg.messages);
		};
		call = (promptOrMessages?: string | ModelMessage[], maybeMessages?: ModelMessage[]): TFunctionResult => {
			if (config.debug) {
				console.log('[DEBUG] createLLMComponent - text path called with:', { promptOrMessages, maybeMessages });
			}
			validateLLMComponentCall(config, config.promptType ?? 'text', promptOrMessages, maybeMessages);

			const { prompt, messages } = extractCallArguments(promptOrMessages, maybeMessages);
			const callConfig = {
				...(prompt !== undefined && { prompt }),
				...(messages !== undefined && { messages }),
			};
			return run(callConfig, true) as TFunctionResult;
		};
		if (config.promptType === 'text-name') {
			// wrap the call in a promise that waits for the prompt to be loaded
			// from loaders and only when it is ready - calls the original prompt

			// Validate loader exists
			const loaderConfig = config as configs.LoaderConfig;
			if (!('loader' in loaderConfig)) {
				throw new Error("A 'loader' is required for 'text-name' prompt type");
			}

			let loadedPrompt: Promise<string> | string | undefined = config.prompt ? loadString(config.prompt, loaderConfig.loader as (ILoaderAny | ILoaderAny[])) : undefined;
			//const messages: ModelMessage[] | undefined = config.messages;
			const syncRun = run;
			run = async (
				configArg: configs.LLMRunConfig & { loader?: ILoaderAny | ILoaderAny[] },
				calledFromCall = false
			): Promise<TFunctionResult> => {
				//let prompt: string | undefined;
				let prompt: string | undefined;
				try {
					if (configArg.prompt && typeof configArg.prompt === 'string') {
						// a new prompt to load
						prompt = await loadString(configArg.prompt, loaderConfig.loader as (ILoaderAny | ILoaderAny[]));
						// messages = maybeMessages;
					} else if (loadedPrompt) {
						// a prompt load has started at creation time
						if (typeof loadedPrompt === 'string') {
							//prompt was resoved in a previous run
							prompt = loadedPrompt;
						} else {
							// Cache the resolved promise to avoid re-awaiting
							prompt = await loadedPrompt;
							loadedPrompt = prompt; // Store resolved value for future calls
						}
						//messages = configArg.messages;
					} else {
						throw new Error('No prompt provided. Either configure a prompt in the config or provide one when calling run().');
					}
				} catch (error) {
					if (error instanceof Error && error.message.includes('not found')) {
						throw new Error(`Failed to load prompt: ${error.message}`);
					}
					throw error;
				}
				//todo - skip messages property if no messages in configArg
				return syncRun({ ...configArg, prompt }, calledFromCall);
			};
		}
	}
	// Get the function name and capitalize it to create the type
	const functionName = vercelFunc.name;
	const type = functionName.charAt(0).toUpperCase() + functionName.slice(1);

	const callSignature = Object.assign(call, { config, type, run });
	return callSignature as LLMCallSignature<TConfig, TFunctionResult, PT, AnyPromptSource, configs.BaseConfig>;
}
