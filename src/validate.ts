import type { ModelMessage } from "ai";
import { z, ZodError } from 'zod';
import * as types from './types/types.js';
import * as configs from './types/config.js';
import { extractCallArguments } from './call-arguments.js';
import { ModelMessageSchema } from "./types/schemas.js";

export class ConfigError extends Error {
	cause?: Error;
	name: string;
	constructor(message: string, cause?: Error) {
		super(message);
		this.name = 'ConfigError';
		if (cause) {
			this.cause = cause;
		}
	}
}

type AnyTextConfig = configs.ConfigShape<configs.GenerateTextConfig<any, any, any> | configs.StreamTextConfig<any, any, any>>;
type AnyObjectConfig =
	| configs.GenerateObjectObjectConfig<any, any, any> | configs.GenerateObjectArrayConfig<any, any, any> | configs.GenerateObjectEnumConfig<any, any, any> | configs.GenerateObjectNoSchemaConfig<any, any>
	| configs.StreamObjectObjectConfig<any, any, any> | configs.StreamObjectArrayConfig<any, any, any> | configs.StreamObjectNoSchemaConfig<any, any>;

// --- Helper Functions ---

function formatZodError(error: ZodError): string {
	const issues = error.issues.map(issue => {
		const path = issue.path.join('.');
		return `  - Invalid value for '${path}': ${issue.message}.`;
	});
	return `Validation failed:\n${issues.join('\n')}`;
}

// An explicit undefined or null loader supplies no loader.
function hasLoader(config: object): boolean {
	return 'loader' in config && config.loader !== undefined && config.loader !== null;
}

export function validateMessagesArray(messages: unknown): void {
	if (messages === undefined) return;
	const result = z.array(ModelMessageSchema).safeParse(messages);
	if (!result.success) {
		throw new ConfigError(`'messages' array contains invalid message objects.\n${formatZodError(result.error)}`);
	}
}

export function validateConfigBasics(config?: unknown): asserts config is Record<string, unknown> {
	if (!config || typeof config !== 'object' || Array.isArray(config)) {
		throw new ConfigError('Config must be an object.');
	}
	if ('template' in config && 'script' in config) {
		throw new ConfigError("Configuration cannot have both 'template' and 'script' properties.");
	}
	if ('messages' in config) {
		validateMessagesArray(config.messages);
	}
}

// Compatibility checks apply to both reusable fragments and completed components.
// Required properties are checked separately by the concrete component validators.
const forbiddenConfigProperties = {
	Function: ['model', 'template', 'script', 'prompt', 'output', 'enum', 'mode', 'loader', 'filters', 'options', 'messages', 'promptType', 'tools', 'toolsContext'],
	Template: ['model', 'script', 'execute', 'output', 'enum', 'mode', 'schema', 'prompt', 'messages', 'tools', 'toolsContext'],
	Script: ['model', 'template', 'execute', 'output', 'enum', 'mode', 'prompt', 'messages', 'tools', 'toolsContext'],
	Text: ['template', 'script', 'execute', 'schema', 'enum', 'output', 'mode'],
	Object: ['template', 'script', 'execute', 'tools', 'toolsContext'],
} as const;

type ConfigKind = keyof typeof forbiddenConfigProperties;

function validateConfigCompatibility(config: Record<string, unknown>, kind: ConfigKind): void {
	for (const property of forbiddenConfigProperties[kind]) {
		if (property in config) {
			throw new ConfigError(`Property '${property}' is not applicable for a ${kind} configuration.`);
		}
	}
}

function identifyConfigKind(config: Record<string, unknown>): ConfigKind | undefined {
	// Distinctive properties take precedence over schema, which is shared by several kinds.
	if ('execute' in config) return 'Function';
	if ('template' in config) return 'Template';
	if ('script' in config) return 'Script';
	if ('output' in config || 'enum' in config || 'mode' in config) return 'Object';
	if ('model' in config) return 'schema' in config ? 'Object' : 'Text';
	return undefined;
}

function validatePromptProperties(config: Record<string, unknown>, promptType?: types.PromptType, requireFunctionPrompt = false): void {
	if (config.prompt === undefined && !requireFunctionPrompt) return;
	if (promptType?.includes('template') || promptType?.includes('script')) {
		if (Array.isArray(config.prompt)) {
			throw new ConfigError("A 'prompt' with a message array is not allowed for template or script-based components. The 'prompt' must be a string containing the template or script.");
		}
	} else if (promptType?.includes('function') && typeof config.prompt !== 'function') {
		throw new ConfigError("The 'prompt' property must be a function when using withFunction().");
	} else if (promptType === 'text-name') {
		validateLoadedTextPrompt(config.prompt);
	}
	if (Array.isArray(config.prompt)) validateMessagesArray(config.prompt);
}

// A loaded text prompt is identified by name.
export function validateLoadedTextPrompt(prompt: unknown): void {
	if (prompt !== undefined && typeof prompt !== 'string') {
		throw new ConfigError("The 'prompt' of a loadsText component must be the name of the prompt to load.");
	}
}

function validateRendererInputSchema(config: Record<string, unknown>, kind: 'Template' | 'Script'): void {
	const inputSchema = config.inputSchema;
	if (inputSchema === undefined || inputSchema instanceof z.ZodObject) return;
	if (inputSchema && typeof inputSchema === 'object' && 'jsonSchema' in inputSchema) {
		const jsonSchema = inputSchema.jsonSchema;
		if (!jsonSchema || typeof jsonSchema !== 'object' || !('type' in jsonSchema) || jsonSchema.type === undefined) return;
		if (jsonSchema.type === 'object' || (Array.isArray(jsonSchema.type) && jsonSchema.type.includes('object'))) return;
	}
	throw new ConfigError(`For ${kind} components, 'inputSchema' must be a Zod object schema (z.object) or an AI SDK object schema.`);
}

function validateObjectOutputProperties(config: Record<string, unknown>, isStreamer = false): 'object' | 'array' | 'enum' | 'no-schema' {
	const output = config.output === undefined ? 'object' : config.output;
	if (isStreamer && output === 'enum') {
		throw new ConfigError('Object streamers do not support "enum" output.');
	}
	if (config.enum !== undefined && (!Array.isArray(config.enum) || !config.enum.every(value => typeof value === 'string'))) {
		throw new ConfigError("The 'enum' property must be a string array.");
	}
	switch (output) {
		case 'object': return 'object';
		case 'array': return 'array';
		case 'enum': return 'enum';
		case 'no-schema': return 'no-schema';
		default:
			throw new ConfigError(`Invalid 'output' mode: '${typeof output === 'string' ? output : typeof output}'. Must be 'object', 'array', ${isStreamer ? '' : 'enum, '}or 'no-schema'.`);
	}
}

// --- Configuration Validators (for Creation Time) ---

/** Validate reusable config fragments; component factories validate their complete contracts. */
export function validateAnyConfig(config?: Partial<configs.AnyConfig<any, any, any, any>>): void {
	validateConfigBasics(config);
	const kind = identifyConfigKind(config);
	if (kind) {
		validateConfigCompatibility(config, kind);
	} else if (!Object.values(forbiddenConfigProperties).some(properties => properties.every(property => !(property in config)))) {
		// Shared properties need not identify one kind, but must still fit at least one.
		throw new ConfigError('These properties do not belong to any single component configuration.');
	}
	if ('execute' in config && config.execute !== undefined && typeof config.execute !== 'function') {
		throw new ConfigError("The 'execute' property in a Function config must be a function.");
	}
	if (kind === 'Template' || kind === 'Script') validateRendererInputSchema(config, kind);
	if (kind === 'Object') validateObjectOutputProperties(config);
	validatePromptProperties(config, 'promptType' in config ? config.promptType : undefined);
}

/**
 * Validates configurations for TextGenerator and TextStreamer.
 * @param config The configuration object.
 * @param promptType The explicit promptType from the factory.
 * @param isTool A flag indicating if the component is being created as a tool.
 */
export function validateTextLLMConfig(config: Partial<AnyTextConfig>, promptType?: types.PromptType, isTool = false): void {
	validateConfigBasics(config);
	validateConfigCompatibility(config, 'Text');
	validatePromptProperties(config, promptType, true);
	if (config.model === undefined || config.model === null) throw new ConfigError("Text generator configs require a 'model' property.");

	const isLoaded = promptType?.endsWith('-name') ?? false;
	if (isLoaded && !hasLoader(config)) {
		throw new ConfigError("A 'loader' is required for this operation (e.g., for loads...() or *-name prompt types).");
	}
	if (isTool) {
		if (!('inputSchema' in config)) {
			throw new ConfigError("'inputSchema' is a required property when creating a TextGenerator as a tool.");
		}
		if (!('prompt' in config)) {
			throw new ConfigError("'prompt' is a required property when creating a TextGenerator as a tool.");
		}
	}
}

/**
 * Validates configurations for ObjectGenerator and ObjectStreamer.
 * @param config The configuration object.
 * @param promptType The explicit promptType from the factory.
 * @param isTool A flag indicating if the component is being created as a tool.
 * @param isStreamer A flag indicating if the component is a streamer.
 */
export function validateObjectLLMConfig(config: Partial<AnyObjectConfig>, promptType?: types.PromptType, isTool = false, isStreamer = false): void {
	validateConfigBasics(config);
	validateConfigCompatibility(config, 'Object');
	validatePromptProperties(config, promptType, true);
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime callers can explicitly clear an inherited model with null.
	if (config.model === undefined || config.model === null) throw new ConfigError("Object generator configs require a 'model' property.");
	const output = validateObjectOutputProperties(config, isStreamer);

	if (isTool) {
		if (!('inputSchema' in config)) {
			throw new ConfigError("'inputSchema' is a required property when creating a ObjectGenerator as a tool.");
		}
		if (!('prompt' in config)) {
			throw new ConfigError("'prompt' is a required property when creating a ObjectGenerator as a tool.");
		}
	}

	switch (output) {
		case 'object':
		case 'array':
			if (!('schema' in config)) {
				throw new ConfigError(`An 'output' of '${output}' requires a 'schema' property.`);
			}
			break;
		case 'enum':
			if (!('enum' in config) || config.enum === undefined) {
				throw new ConfigError("An 'output' of 'enum' requires an 'enum' property with a string array.");
			}
			break;
		case 'no-schema': break; // No extra properties needed
	}

	const isLoaded = promptType?.endsWith('-name') ?? false;
	if (isLoaded && !hasLoader(config)) {
		throw new ConfigError("A 'loader' is required for this operation (e.g., for loads...() or *-name prompt types).");
	}
}

/**
 * Validates configurations for `create.Template`.
 * @param config The configuration object.
 * @param templateType The explicit templateType from the factory.
 * @param isTool A flag indicating if the component is being created as a tool.
 */
export function validateTemplateConfig(config: Partial<configs.TemplateConfig<any>>, templateType?: types.TemplatePromptType, isTool = false): void {
	validateConfigBasics(config);
	validateConfigCompatibility(config, 'Template');
	validateRendererInputSchema(config, 'Template');

	const isLoaded = templateType?.endsWith('-name') ?? false;

	if (isLoaded) {
		if (!hasLoader(config)) {
			throw new ConfigError("A 'loader' is required when loading a template by name (e.g., for 'template-name' or 'async-template-name' types).");
		}
	} else {
		// If not loading by name, the template string must be in the config itself.
		if (!('template' in config)) {
			throw new ConfigError("A 'template' property is required for a Template configuration that is not loaded by name.");
		}
	}

	if (isTool) {
		if (!('inputSchema' in config)) {
			throw new ConfigError("'inputSchema' is a required property when creating a Template as a tool.");
		}
		if (!('template' in config)) {
			throw new ConfigError("'template' is a required property when creating a Template as a tool.");
		}
	}
}

/**
 * Validates configurations for `create.Script`.
 * @param config The configuration object.
 * @param scriptType The explicit scriptType from the factory.
 * @param isTool A flag indicating if the component is being created as a tool.
 */
export function validateScriptConfig(config: Partial<configs.ScriptConfig<any, any>>, scriptType?: types.ScriptPromptType, isTool = false): void {
	validateConfigBasics(config);
	validateConfigCompatibility(config, 'Script');
	validateRendererInputSchema(config, 'Script');

	const isLoaded = scriptType?.endsWith('-name') ?? false;

	if (isLoaded) {
		if (!hasLoader(config)) {
			throw new ConfigError("A 'loader' is required when loading a script by name (e.g., for 'script-name' or 'async-script-name' types).");
		}
	} else {
		// If not loading by name, the script string must be in the config itself.
		if (!('script' in config)) {
			throw new ConfigError("A 'script' property is required for a Script configuration that is not loaded by name.");
		}
	}

	if (isTool) {
		if (!('inputSchema' in config)) {
			throw new ConfigError("'inputSchema' is a required property when creating a Script as a tool.");
		}
		if (!('script' in config)) {
			throw new ConfigError("'script' is a required property when creating a Script as a tool.");
		}
	}
}

/**
 * Validates configurations for `create.Function`.
 * @param config The configuration object.
 * @param isTool A flag indicating if the function is being created as a tool.
 */
export function validateFunctionConfig(config: Record<string, any>, isTool = false): void {
	validateConfigBasics(config);
	validateConfigCompatibility(config, 'Function');
	if (typeof config.execute !== 'function') {
		throw new ConfigError("The 'execute' property in a Function config must be a function.");
	}
	if (isTool && !('inputSchema' in config)) {
		throw new ConfigError("'inputSchema' is a required property when creating a Function as a tool.");
	}
}

// --- Invocation Validators (for Call Time) ---

export function validateLLMComponentCall(
	config: Partial<configs.AnyConfig<any, any, any, any>>, promptType: types.PromptType,
	...args: [string | undefined | ModelMessage[] | types.Context, (ModelMessage[] | types.Context)?, types.Context?]
): void | Promise<void> {
	const callArgs = extractCallArguments(...args);
	const isToolCall = callArgs.context?._toolCallOptions !== undefined;

	validateMessagesArray(callArgs.messages);

	if (promptType === 'function') {
		if (callArgs.prompt !== undefined || callArgs.messages !== undefined || args[1] !== undefined || args[2] !== undefined) {
			throw new ConfigError('Function-prompt components only accept a context object.');
		}
		if (!isToolCall) {
			return validateCallInput(config, callArgs.context);
		}
		return;
	}

	if (promptType.includes('template') || promptType.includes('script')) {
		// Skip input validation if this is a tool call (indicated by presence of _toolCallOptions)
		if (!isToolCall) {
			return validateCallInput(config, callArgs.context);
		}// else - the tool call will have its own input schema validation
	} else { // text or text-name
		const prompt = (config as Partial<configs.TemplatePromptConfig>).prompt;
		const finalPromptString = callArgs.prompt ?? (typeof prompt === 'string' ? prompt : undefined);
		const finalPromptMessages = Array.isArray(prompt) ? prompt : [];
		const finalMessages = callArgs.messages ?? (Array.isArray((config as Partial<configs.TemplatePromptConfig>).messages) ? (config as Partial<configs.TemplatePromptConfig>).messages : undefined);

		const hasPromptString = typeof finalPromptString === 'string' && finalPromptString.length > 0;
		const hasPromptMessages = finalPromptMessages.length > 0;
		const hasMessages = finalMessages && finalMessages.length > 0;

		if (!hasPromptString && !hasPromptMessages && !hasMessages) {
			throw new ConfigError("Either 'prompt' (string or messages array) or 'messages' must be provided in the config or at call time.");
		}
		if (callArgs.context && !isToolCall) throw new ConfigError("A 'context' object cannot be provided when using a 'text' or 'text-name' component.");
	}
}

export function validateTemplateCall(config: Partial<configs.TemplateConfig<any>>, ...args: [string | undefined | types.Context, types.Context?]): void | Promise<void> {
	const [templateOrContext, maybeContext] = args;
	const context = (typeof templateOrContext === 'string') ? maybeContext : templateOrContext;
	const isToolCall = context?._toolCallOptions !== undefined;

	if (!('template' in config) && typeof templateOrContext !== 'string') {
		throw new ConfigError("A template string must be provided either in the config or as the first argument.");
	}

	if (!isToolCall) {
		return validateCallInput(config, context);
	}// else - the tool call will have its own input schema validation
}

export function validateScriptOrFunctionCall(config: Record<string, any>, type: 'Script' | 'Function', ...args: [string | undefined | types.Context, types.Context?]): void | Promise<void> {
	const [arg1, arg2] = args;
	const context = (typeof arg1 === 'string') ? arg2 : arg1;
	const isToolCall = context?._toolCallOptions !== undefined;

	if (type === 'Script' && !('script' in config) && typeof arg1 !== 'string') {
		throw new ConfigError("A script string must be provided either in the config or as the first argument.");
	}

	if (!isToolCall) {
		return validateCallInput(config, context);
	}// else - the tool call will have its own input schema validation
}

// --- Input/Output Schema Validators ---

// An omitted context is validated as empty input, so a schema whose fields are all optional accepts it.
function validateCallInput(config: Partial<configs.AnyConfig<any, any, any, any>>, context: types.Context | undefined): void | Promise<void> {
	if (context) return validateInput(config, context);
	const requireContext = (error: unknown): never => {
		if (error instanceof ConfigError) {
			throw new ConfigError(`A context object is required because an 'inputSchema' is defined in the configuration.\n${error.message}`, error);
		}
		throw error;
	};
	let result: void | Promise<void>;
	try {
		result = validateInput(config, {});
	} catch (error) {
		return requireContext(error);
	}
	if (result instanceof Promise) return result.catch(requireContext);
}

function validateInput(config: Partial<configs.AnyConfig<any, any, any, any>>, context: types.Context): void | Promise<void> {
	if ('inputSchema' in config && config.inputSchema) {
		const schema = config.inputSchema;
		if ('safeParse' in schema) {
			const result = schema.safeParse(context);
			if (!result.success) {
				throw new ConfigError(`Input context validation failed.\n${formatZodError(result.error)}`);
			}
		} else if (schema.validate) {
			const check = (result: { success: true, value: unknown } | { success: false, error: Error }): void => {
				if (!result.success) {
					throw new ConfigError(`Input context validation failed.\n${result.error.message}`, result.error);
				}
			};
			const result = schema.validate(context);
			if ('then' in result) return Promise.resolve(result).then(check);
			check(result);
		}
	}
}

export function validateAndParseOutput<T>(config: Partial<configs.AnyConfig<any, any, any, any>>, result: T): T | Promise<T> {
	if ('schema' in config && config.schema) {
		const schema = config.schema;
		if ('safeParse' in schema) {
			const validationResult = schema.safeParse(result);
			if (!validationResult.success) {
				throw new ConfigError(`Output validation failed.\n${formatZodError(validationResult.error)}`);
			}
			return validationResult.data as T;
		} else if (schema.validate) {
			const check = (validationResult: { success: true, value: unknown } | { success: false, error: Error }): T => {
				if (!validationResult.success) {
					throw new ConfigError(`Output validation failed.\n${validationResult.error.message}`, validationResult.error);
				}
				return validationResult.value as T;
			};
			const validationResult = schema.validate(result);
			if ('then' in validationResult) return Promise.resolve(validationResult).then(check);
			return check(validationResult);
		}
	}
	return result;
}
