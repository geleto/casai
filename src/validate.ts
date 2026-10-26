import { z, ZodError } from 'zod';
import { isRecord } from '@ai-sdk/provider-utils';
import * as types from './types/types.js';
import * as configs from './types/config.js';
import { ModelMessageSchema } from "./types/schemas.js";

import { ConfigError, ValidationError } from './errors.js';
import { parseSchema, validateSchemaVersion } from './schema.js';

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

// Explicit undefined or null cannot satisfy a required setting.
function hasConfiguredValue(config: Record<string, unknown>, key: string): boolean {
	return config[key] !== undefined && config[key] !== null;
}

export function validateMessagesArray(messages: unknown, ErrorClass: typeof ConfigError | typeof ValidationError = ConfigError): void {
	if (messages === undefined) return;
	const result = z.array(ModelMessageSchema).safeParse(messages);
	if (!result.success) {
		throw new ErrorClass(`'messages' array contains invalid message objects.\n${formatZodError(result.error)}`);
	}
}

export function validateConfigBasics(config?: unknown, ErrorClass: typeof ConfigError | typeof ValidationError = ConfigError): asserts config is Record<string, unknown> {
	if (!isRecord(config)) {
		throw new ErrorClass('Config must be an object.');
	}
	if ('contextSchema' in config) throw new ErrorClass("Use 'toolContextSchema' in Casai configuration; 'contextSchema' belongs to native SDK tools.");
	if ('options' in config) throw new ErrorClass("Use 'renderOptions' for rendering settings; 'options' is not supported in Casai configuration.");
	if ('mode' in config) throw new ErrorClass("'mode' is not supported. The AI SDK selects the object generation format.");
	for (const key of ['inputSchema', 'toolContextSchema', 'schema']) {
		if (key in config) validateSchemaVersion(config[key]);
	}
	if ('template' in config && 'script' in config) {
		throw new ErrorClass("Configuration cannot have both 'template' and 'script' properties.");
	}
	if ('messages' in config) {
		validateMessagesArray(config.messages, ErrorClass);
	}
}

// Compatibility checks apply to both reusable fragments and completed components.
// Required properties are checked separately by the concrete component validators.
const forbiddenConfigProperties = {
	Function: ['model', 'template', 'script', 'prompt', 'output', 'enum', 'loader', 'filters', 'renderOptions', 'messages', 'promptType'],
	Template: ['model', 'script', 'execute', 'output', 'enum', 'schema', 'prompt', 'messages'],
	Script: ['model', 'template', 'execute', 'output', 'enum', 'prompt', 'messages'],
	Text: ['template', 'script', 'execute', 'schema', 'enum'],
	Object: ['template', 'script', 'execute', 'tools', 'toolsContext'],
} as const;

type ConfigKind = keyof typeof forbiddenConfigProperties;

function validateConfigCompatibility(config: Record<string, unknown>, kind: ConfigKind): void {
	if (kind === 'Text' && config.output !== undefined && (typeof config.output !== 'object' || config.output === null)) {
		throw new ConfigError("Property 'output' is not applicable for a Text configuration unless it is an AI SDK output specification.");
	}
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
	if (typeof config.output === 'object' && config.output !== null) return 'Text';
	if ('output' in config || 'enum' in config) return 'Object';
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
export function validateLoadedTextPrompt(prompt: unknown, ErrorClass: typeof ConfigError | typeof ValidationError = ConfigError): asserts prompt is string | undefined {
	if (prompt !== undefined && typeof prompt !== 'string') {
		throw new ErrorClass("The 'prompt' of a loadsText component must be the name of the prompt to load.");
	}
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

function validateConfiguredSignal(config: Record<string, unknown>): void {
	if ('abortSignal' in config) {
		throw new ConfigError("'abortSignal' is an invocation setting. Pass it to .run() instead of constructor configuration.");
	}
}

/** Validate reusable config fragments; component factories validate their complete contracts. */
export function validateAnyConfig(config?: Partial<configs.AnyConfig<any, any, any, any>>): void {
	validateConfigBasics(config);
	validateConfiguredSignal(config);
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
	validateConfiguredSignal(config);
	validateConfigCompatibility(config, 'Text');
	validatePromptProperties(config, promptType, true);
	if (config.model === undefined || config.model === null) throw new ConfigError("Text generator configs require a 'model' property.");

	const isLoaded = promptType?.endsWith('-name') ?? false;
	if (isLoaded && !hasConfiguredValue(config, 'loader')) {
		throw new ConfigError("A 'loader' is required for this operation (e.g., for loads...() or *-name prompt types).");
	}
	if (isTool) {
		if (!hasConfiguredValue(config, 'inputSchema')) {
			throw new ConfigError("'inputSchema' is a required property when creating a TextGenerator as a tool.");
		}
		if (!hasConfiguredValue(config, 'prompt')) {
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
	validateConfiguredSignal(config);
	validateConfigCompatibility(config, 'Object');
	validatePromptProperties(config, promptType, true);
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime callers can explicitly clear an inherited model with null.
	if (config.model === undefined || config.model === null) throw new ConfigError("Object generator configs require a 'model' property.");
	const output = validateObjectOutputProperties(config, isStreamer);

	if (isTool) {
		if (!hasConfiguredValue(config, 'inputSchema')) {
			throw new ConfigError("'inputSchema' is a required property when creating a ObjectGenerator as a tool.");
		}
		if (!hasConfiguredValue(config, 'prompt')) {
			throw new ConfigError("'prompt' is a required property when creating a ObjectGenerator as a tool.");
		}
	}

	switch (output) {
		case 'object':
		case 'array':
			if (!hasConfiguredValue(config, 'schema')) {
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
	if (isLoaded && !hasConfiguredValue(config, 'loader')) {
		throw new ConfigError("A 'loader' is required for this operation (e.g., for loads...() or *-name prompt types).");
	}
}

/**
 * Validates configurations for `create.Template`.
 * @param config The configuration object.
 * @param promptType The explicit promptType from the factory.
 * @param isTool A flag indicating if the component is being created as a tool.
 */
export function validateTemplateConfig(config: Partial<configs.TemplateConfig<any>>, promptType?: types.TemplatePromptType, isTool = false): void {
	validateConfigBasics(config);
	validateConfigCompatibility(config, 'Template');
	validateConfiguredSignal(config);

	const isLoaded = promptType?.endsWith('-name') ?? false;

	if (isLoaded) {
		if (!hasConfiguredValue(config, 'loader')) {
			throw new ConfigError("A 'loader' is required when loading a template by name ('async-template-name').");
		}
	} else {
		// If not loading by name, the template string must be in the config itself.
		if (!('template' in config)) {
			throw new ConfigError("A 'template' property is required for a Template configuration that is not loaded by name.");
		}
	}

	if (isTool) {
		if (!hasConfiguredValue(config, 'inputSchema')) {
			throw new ConfigError("'inputSchema' is a required property when creating a Template as a tool.");
		}
		if (!hasConfiguredValue(config, 'template')) {
			throw new ConfigError("'template' is a required property when creating a Template as a tool.");
		}
	}
}

/**
 * Validates configurations for `create.Script`.
 * @param config The configuration object.
 * @param promptType The explicit promptType from the factory.
 * @param isTool A flag indicating if the component is being created as a tool.
 */
export function validateScriptConfig(config: Partial<configs.ScriptConfig<any, any>>, promptType?: types.ScriptPromptType, isTool = false): void {
	validateConfigBasics(config);
	validateConfigCompatibility(config, 'Script');
	validateConfiguredSignal(config);

	const isLoaded = promptType?.endsWith('-name') ?? false;

	if (isLoaded) {
		if (!hasConfiguredValue(config, 'loader')) {
			throw new ConfigError("A 'loader' is required when loading a script by name ('async-script-name').");
		}
	} else {
		// If not loading by name, the script string must be in the config itself.
		if (!('script' in config)) {
			throw new ConfigError("A 'script' property is required for a Script configuration that is not loaded by name.");
		}
	}

	if (isTool) {
		if (!hasConfiguredValue(config, 'inputSchema')) {
			throw new ConfigError("'inputSchema' is a required property when creating a Script as a tool.");
		}
		if (!hasConfiguredValue(config, 'script')) {
			throw new ConfigError("'script' is a required property when creating a Script as a tool.");
		}
	}
}

/**
 * Validates configurations for `create.Function`.
 * @param config The configuration object.
 * @param isTool A flag indicating if the function is being created as a tool.
 */
export function validateFunctionConfig(config: Record<string, unknown>, isTool = false): void {
	validateConfigBasics(config);
	validateConfigCompatibility(config, 'Function');
	validateConfiguredSignal(config);
	if (typeof config.execute !== 'function') {
		throw new ConfigError("The 'execute' property in a Function config must be a function.");
	}
	if (isTool && !hasConfiguredValue(config, 'inputSchema')) {
		throw new ConfigError("'inputSchema' is a required property when creating a Function as a tool.");
	}
}

// Source/history validation is separate from the shared application-input boundary.
export function validateLLMComponentCall(
	config: Partial<configs.AnyConfig<any, any, any, any>>, promptType: types.PromptType,
	context?: types.Context,
): void {
	if (!hasConfiguredValue(config, 'model')) throw new ConfigError("LLM calls require a 'model' property.");
	if (promptType === 'function') return;
	const prompt = (config as { prompt?: unknown }).prompt;
	if (promptType.includes('template') || promptType.includes('script')) {
		if (typeof prompt !== 'string') throw new ValidationError('Prompt source must be a string, supplied in configuration or at call time.');
		return;
	}
	if (typeof prompt !== 'string' && !(Array.isArray(prompt) && prompt.length) && !(config as configs.TemplatePromptConfig).messages?.length) {
		throw new ValidationError("Either 'prompt' (string or messages array) or 'messages' must be provided in the config or at call time.");
	}
	if (context !== undefined) throw new ValidationError("A 'context' object cannot be provided when using a 'text' or 'text-name' component.");
}

export function validateAndParseOutput<Output>(config: { schema: types.SchemaType<Output> }, result: unknown): Promise<Output>;
export function validateAndParseOutput<Value>(config: { schema?: undefined }, result: Value): Value;
export function validateAndParseOutput<Output, Value>(config: { schema?: types.SchemaType<Output> | undefined }, result: Value): Value | Promise<Output>;
export function validateAndParseOutput<Output, Value>(config: { schema?: types.SchemaType<Output> | undefined }, result: Value): Value | Promise<Output> {
	return config.schema === undefined ? result : parseSchema(config.schema, result, 'Output').then(parsed => parsed.value);
}
