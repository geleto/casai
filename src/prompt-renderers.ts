import type { ModelMessage } from 'ai';
import { _createFunction } from './factories/Function.js';
import { _createScript } from './factories/Script.js';
import type { ScriptCallSignature } from './factories/Script.js';
import { _createTemplate } from './factories/Template.js';
import type { TemplateCallSignature } from './factories/Template.js';
import * as configs from './types/config.js';
import { PromptStringOrMessagesSchema } from './types/schemas.js';
import type { Context, PromptFunction, SchemaType, ScriptPromptType, TemplatePromptType } from './types/types.js';

type PromptOutput = string | ModelMessage[];

function copyConfigProperties<TConfig>(config: Record<string, unknown>, keys: readonly (keyof TConfig & string)[]): Partial<TConfig> {
	const dst: Partial<TConfig> = {};
	for (const key of keys) {
		// The LLM component validates raw call-time input before rendering.
		if (key !== 'inputSchema' && key in config) {
			dst[key] = config[key] as TConfig[typeof key];
		}
	}
	return dst;
}

export function createTemplatePromptRenderer(config: Record<string, unknown>, prompt: string | undefined, promptType: TemplatePromptType) {
	const templateConfig = {
		...copyConfigProperties<configs.TemplateConfig<Context>>(config, configs.TemplateConfigKeys),
		options: { ...config.options as configs.TemplateConfig<Context>['options'], autoescape: false },
		template: prompt
	};
	// A prompt can be supplied later through the renderer's string override argument.
	return _createTemplate(templateConfig, promptType) as TemplateCallSignature<configs.TemplateConfig<Context>, Context>;
}

export function createScriptPromptRenderer(config: Record<string, unknown>, prompt: string | undefined, promptType: ScriptPromptType) {
	const scriptConfig = {
		...copyConfigProperties<configs.ScriptConfig<Context, PromptOutput>>(config, configs.ScriptConfigKeys),
		options: { ...config.options as configs.ScriptConfig<Context, PromptOutput>['options'], autoescape: false },
		script: prompt,
		// Validate the prompt result, independently of the LLM's output schema.
		schema: PromptStringOrMessagesSchema
	};
	return _createScript(scriptConfig, promptType) as ScriptCallSignature<configs.ScriptConfig<Context, PromptOutput> & { script: string }, Context, PromptOutput>;
}

export function createFunctionPromptRenderer(config: Record<string, unknown>, prompt: PromptFunction): (context?: Context) => PromptOutput | PromiseLike<PromptOutput> {
	return _createFunction({
		...copyConfigProperties<configs.FunctionConfig<SchemaType<Context>, SchemaType<PromptOutput>, Context, Context>>(config, configs.FunctionConfigKeys),
		// Validate the prompt result, independently of the LLM's output schema.
		schema: PromptStringOrMessagesSchema,
		execute: prompt
	});
}
