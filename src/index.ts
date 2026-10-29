// --- Core Factories ---
export { Template } from './factories/Template.js';
export { Script } from './factories/Script.js';
export { Function } from './factories/Function.js';
export { Config } from './factories/Config.js';

// --- The 'create' Namespace  ---
import * as factories from './factories/factories.js';

export const create = factories;

// --- Third-Party Re-exports (For User Convenience) ---
export type { ModelMessage, ToolSet } from 'ai';
export { modelMessageSchema as ModelMessageSchema } from 'ai';
export { FileSystemLoader, NotFoundError, PrecompiledLoader, WebLoader, raceLoaders } from 'cascada-engine';
export type { LoaderGroup } from 'cascada-engine';
export { z } from 'zod';

// --- Configuration Types ---
export type {
	// Standalone Component Configs
	TemplateConfig,
	TemplateToolConfig,
	ScriptConfig,
	ScriptToolConfig,
	FunctionConfig,
	FunctionToolConfig,
	// Other
	ToolConfig,
	ToolContextSchemaConfig,
	ConfigProvider
} from './types/config.js';

// --- Core Library Types ---
export type { Context } from './types/utils.js';
export type { SchemaType } from './types/schema.js';
export type { TemplatePromptType, ScriptPromptType, FunctionPromptType } from './types/prompt.js';
export type { StreamTextOnFinishEvent } from './types/sdk.js';
export { PromptStringOrMessagesSchema } from './renderers/prompt-schema.js';

// --- Result Types ---
export type { ScriptResult, GenerateTextResultAugmented as GenerateTextResult, StreamTextResultAugmented as StreamTextResult } from './types/result.js';
export type { ComponentTool } from './types/tool-binding.js';

// --- Error Types ---
export { ConfigError, ValidationError, TemplateError, ScriptError } from './errors.js';

// --- Public Utilities & Associated Types ---
export { raceParent, overrideParent, type LoaderInput, type ParentLoader } from './loaders.js';

export type { ComponentExecutionOptions } from './types/sdk.js';
export { textStreamSchema, streamSchema, collectStream, collectTextStream, toReadableStream, makeSharedIterable } from './streams.js';
export type { StreamSchema } from './streams.js';
export { LLMAgent } from './factories/LLMAgent.js';
export type { LLMAgentConfig, LLMAgentComponent, PrepareCall, PrepareCallRequest, PrepareStep } from './types/agent.js';
