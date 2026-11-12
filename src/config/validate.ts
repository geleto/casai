import { sourceMode, sourceSettingsError } from './source-mode.js';
import type { SchemaType } from '../types/schema.js';
import { z, ZodError } from 'zod';
import { isRecord } from '@ai-sdk/provider-utils';
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
	const sourceError = sourceSettingsError(config);
	if (sourceError) throw new ErrorClass(sourceError);
	if ('contextSchema' in config) throw new ErrorClass("Use 'toolContextSchema' in Casai configuration; 'contextSchema' belongs to native SDK tools.");
	if (config.asTool !== undefined && config.asTool !== true) throw new ErrorClass('Tool mode is enabled with .asTool and cannot be disabled.');
	if (config.streaming !== undefined && config.streaming !== true) throw new ErrorClass('Streaming mode is enabled with .asStream and cannot be disabled.');
	for (const key of ['inputSchema', 'toolContextSchema', 'schema']) {
		if (key in config) validateSchemaVersion(config[key]);
	}
}

export function validateAgentSettings(config: Record<string, unknown>, ErrorClass: typeof ConfigError | typeof ValidationError = ConfigError): void {
	if ('options' in config) throw new ErrorClass("Use 'renderOptions' for rendering settings; 'options' is not supported in LLMAgent configuration.");
	if ('mode' in config) throw new ErrorClass("'mode' is not supported. The AI SDK selects the object generation format.");
	if ('messages' in config) throw new ErrorClass("Use 'prompt' for configured messages and 'messageHistory' for invocation history.");
	if (Object.hasOwn(config, 'approve')) throw new ErrorClass("'approve' is a resume() option, not a configuration or run() setting.");
}

export function validateAgentConfig(config: Record<string, unknown>): void {
	validateAgentSettings(config);
	const invalid = retiredSettings.filter(key => Object.hasOwn(config, key));
	if (invalid.length) throw new ConfigError(`Unsupported configuration properties: ${invalid.join(', ')}.`);
	if (config.output !== undefined && (typeof config.output !== 'object' || config.output === null)) throw new ConfigError("Property 'output' must be an AI SDK Output specification for LLMAgent.");
	for (const key of agentSourceConflicts) {
		if (key in config) throw new ConfigError(`Property '${key}' is not applicable for a LLMAgent configuration.`);
	}
	if (config.streaming === true && config.asTool === true) throw new ConfigError('LLMAgent tools are generation-only; .asStream cannot be combined with .asTool, including through inheritance.');
	const mode = (config as import('./source-mode.js').SourceModeSetting)[sourceMode]!;
	if (config.prompt !== undefined) {
		if (mode === 'function' && typeof config.prompt !== 'function') throw new ConfigError('A function prompt must be a function.');
		if (mode !== 'function' && mode !== 'text' && mode !== 'async-template' && typeof config.prompt !== 'string') throw new ConfigError('A rendered or loaded prompt source must be a string.');
		if ((mode === 'text' || mode === 'async-template') && typeof config.prompt !== 'string') validateMessagesArray(Array.isArray(config.prompt) ? config.prompt : [config.prompt]);
	}
}

// --- Configuration Validators (for Creation Time) ---

export function validateConstructionConfig(config?: unknown): asserts config is Record<string, unknown> {
	validateConfigBasics(config);
	if ('abortSignal' in config) {
		throw new ConfigError("'abortSignal' is an invocation setting. Pass it to .run() instead of constructor configuration.");
	}
}

// Source/history validation is separate from the shared application-input boundary.
export function validateAndParseOutput<Output>(config: { schema: SchemaType<Output> }, result: unknown): Promise<Output>;
export function validateAndParseOutput<Value>(config: { schema?: undefined }, result: Value): Value;
export function validateAndParseOutput<Output, Value>(config: { schema?: SchemaType<Output> | undefined }, result: Value): Value | Promise<Output>;
export function validateAndParseOutput<Output, Value>(config: { schema?: SchemaType<Output> | undefined }, result: Value): Value | Promise<Output> {
	return config.schema === undefined ? result : parseSchema(config.schema, result, 'Output').then(parsed => parsed.value);
}
