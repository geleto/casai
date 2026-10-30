import type { PromptType } from '../types/prompt.js';
import type { SchemaType } from '../types/schema.js';
import { z, ZodError } from 'zod';
import { isRecord } from '@ai-sdk/provider-utils';
import * as configs from '../types/config.js';
import { modelMessageSchema as ModelMessageSchema } from 'ai';

import { ConfigError, ValidationError } from '../errors.js';
import { parseSchema, validateSchemaVersion } from '../schema.js';
import { retiredSettings, agentSourceConflicts } from '../runtime/agent-settings-policy.js';

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
	if (config.asTool !== undefined && config.asTool !== true) throw new ErrorClass('Tool mode is enabled with .asTool and cannot be disabled.');
	for (const key of ['inputSchema', 'toolContextSchema', 'schema']) {
		if (key in config) validateSchemaVersion(config[key]);
	}
	if ('template' in config && 'script' in config) {
		throw new ErrorClass("Configuration cannot have both 'template' and 'script' properties.");
	}
	if ('messages' in config) throw new ErrorClass("Use 'prompt' for configured messages and 'messageHistory' for invocation history.");
	const invalid = retiredSettings.filter(key => Object.hasOwn(config, key));
	if (invalid.length) throw new ErrorClass(`Unsupported configuration properties: ${invalid.join(', ')}.`);
}

// Compatibility checks apply to both reusable fragments and completed components.
// Required properties are checked separately by the concrete component validators.
const forbiddenConfigProperties = {
	Function: ['streaming', 'model', 'template', 'script', 'prompt', 'output', 'loader', 'filters', 'renderOptions', 'promptType'],
	Template: ['streaming', 'model', 'script', 'execute', 'output', 'schema', 'prompt'],
	Script: ['streaming', 'model', 'template', 'execute', 'output', 'prompt'],
	LLMAgent: agentSourceConflicts,
} as const;

type ConfigKind = keyof typeof forbiddenConfigProperties;

function validateConfigCompatibility(config: Record<string, unknown>, kind: ConfigKind): void {
	if (kind === 'LLMAgent' && config.output !== undefined && (typeof config.output !== 'object' || config.output === null)) {
		throw new ConfigError("Property 'output' must be an AI SDK Output specification for LLMAgent.");
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
	if (['model', 'output', 'prompt', 'prepareCall', 'prepareStep', 'streaming', 'id'].some(key => key in config)) return 'LLMAgent';
	return undefined;
}

function validatePromptProperties(config: Record<string, unknown>, promptType?: PromptType): void {
	if (config.prompt === undefined) return;
	if (typeof config.prompt !== 'string' && typeof config.prompt !== 'function' && !Array.isArray(config.prompt)) {
		throw new ConfigError("The 'prompt' must be text, a message array, or a function.");
	}
	if (promptType?.includes('template') || promptType?.includes('script')) {
		if (Array.isArray(config.prompt)) {
			throw new ConfigError("A 'prompt' with a message array is not allowed for template or script-based components. The 'prompt' must be a string containing the template or script.");
		}
	} else if (promptType?.includes('function') && typeof config.prompt !== 'function') {
		throw new ConfigError("The 'prompt' property must be a function when using withFunction().");
	} else if (promptType === 'text-name' && typeof config.prompt !== 'string') {
		throw new ConfigError("The 'prompt' of a loadsText component must be the name of the prompt to load.");
	}
	if (Array.isArray(config.prompt)) validateMessagesArray(config.prompt);
}

export function validateAgentConfig(config: Record<string, unknown>): void {
	validateConfigBasics(config);
	validateConfiguredSignal(config);
	validateConfigCompatibility(config, 'LLMAgent');
	if (!hasConfiguredValue(config, 'model')) throw new ConfigError("LLMAgent requires a 'model'.");
	if (config.streaming !== undefined && config.streaming !== true) throw new ConfigError('Streaming mode is enabled with .asStream and cannot be disabled.');
	if (config.streaming === true && config.asTool === true) throw new ConfigError('LLMAgent tools are generation-only; .asStream cannot be combined with .asTool, including through inheritance.');
	const mode = config.promptType as PromptType;
	if (mode.endsWith('-name') && !hasConfiguredValue(config, 'loader')) throw new ConfigError('Loaded prompts require a loader.');
	if (config.prompt !== undefined) {
		if (mode === 'function' && typeof config.prompt !== 'function') throw new ConfigError('A function prompt must be a function.');
		if (mode !== 'function' && mode !== 'text' && typeof config.prompt !== 'string') throw new ConfigError('A rendered or loaded prompt source must be a string.');
		if (mode === 'text' && typeof config.prompt !== 'string') validateMessagesArray(config.prompt);
	}
	if (config.asTool === true && (!hasConfiguredValue(config, 'inputSchema') || !hasConfiguredValue(config, 'prompt'))) {
		throw new ConfigError('An LLMAgent tool requires inputSchema and a configured prompt.');
	}
}

// --- Configuration Validators (for Creation Time) ---

function validateConfiguredSignal(config: Record<string, unknown>): void {
	if ('abortSignal' in config) {
		throw new ConfigError("'abortSignal' is an invocation setting. Pass it to .run() instead of constructor configuration.");
	}
}

/** Validate reusable config fragments; component factories validate their complete contracts. */
export function validateAnyConfig(config?: Partial<configs.AnyConfig<any, any, any>>): void {
	validateConfigBasics(config);
	validateConfiguredSignal(config);
	const kind = identifyConfigKind(config);
	if (kind) {
		validateConfigCompatibility(config, kind);
	}
	if ('execute' in config && config.execute !== undefined && typeof config.execute !== 'function') {
		throw new ConfigError("The 'execute' property in a Function config must be a function.");
	}
	validatePromptProperties(config, 'promptType' in config ? config.promptType : undefined);
}

/** Template and Script share source, loader and tool requirements. */
export function validateRendererConfig(config: Record<string, unknown>, kind: 'Template' | 'Script'): void {
	const source = kind === 'Template' ? 'template' : 'script';
	const promptType = config.promptType as PromptType | undefined;
	validateConfigBasics(config);
	validateConfigCompatibility(config, kind);
	if (promptType !== undefined && promptType !== `async-${source}` && promptType !== `async-${source}-name`) throw new ConfigError(`${kind} requires a ${source} source modifier.`);
	validateConfiguredSignal(config);

	const isLoaded = promptType?.endsWith('-name') ?? false;

	if (isLoaded) {
		if (!hasConfiguredValue(config, 'loader')) {
			throw new ConfigError(`A 'loader' is required when loading a ${source} by name ('async-${source}-name').`);
		}
	} else {
		if (!(source in config)) {
			throw new ConfigError(`A '${source}' property is required for a ${kind} configuration that is not loaded by name.`);
		}
	}

	if (config.asTool === true) {
		if (!hasConfiguredValue(config, 'inputSchema')) {
			throw new ConfigError(`'inputSchema' is a required property when creating a ${kind} as a tool.`);
		}
		if (!hasConfiguredValue(config, source)) {
			throw new ConfigError(`'${source}' is a required property when creating a ${kind} as a tool.`);
		}
	}
}

/**
 * Validates configurations for `create.Function`.
 * @param config The configuration object.
 */
export function validateFunctionConfig(config: Record<string, unknown>): void {
	validateConfigBasics(config);
	validateConfigCompatibility(config, 'Function');
	validateConfiguredSignal(config);
	if (typeof config.execute !== 'function') {
		throw new ConfigError("The 'execute' property in a Function config must be a function.");
	}
	if (config.asTool === true && !hasConfiguredValue(config, 'inputSchema')) {
		throw new ConfigError("'inputSchema' is a required property when creating a Function as a tool.");
	}
}

// Source/history validation is separate from the shared application-input boundary.
export function validateAndParseOutput<Output>(config: { schema: SchemaType<Output> }, result: unknown): Promise<Output>;
export function validateAndParseOutput<Value>(config: { schema?: undefined }, result: Value): Value;
export function validateAndParseOutput<Output, Value>(config: { schema?: SchemaType<Output> | undefined }, result: Value): Value | Promise<Output>;
export function validateAndParseOutput<Output, Value>(config: { schema?: SchemaType<Output> | undefined }, result: Value): Value | Promise<Output> {
	return config.schema === undefined ? result : parseSchema(config.schema, result, 'Output').then(parsed => parsed.value);
}
