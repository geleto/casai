// --- Core Factories ---
export { Template } from './factories/Template.js';
export { Script } from './factories/Script.js';
export { Function } from './factories/Function.js'; // Added missing factory
export { TextGenerator } from './factories/TextGenerator.js';
export { TextStreamer } from './factories/TextStreamer.js';
export { ObjectGenerator } from './factories/ObjectGenerator.js';
export { ObjectStreamer } from './factories/ObjectStreamer.js';
export { Config } from './factories/Config.js';

// --- The 'create' Namespace  ---
import * as factories from './factories/factories.js';
export const create = factories;

// --- Third-Party Re-exports (For User Convenience) ---
export type { ModelMessage, ToolSet } from 'ai';
export { FileSystemLoader, WebLoader } from 'cascada-engine';
export { z } from 'zod';

// --- Configuration Types ---
export type {
	// Standalone Component Configs
	TemplateConfig, // Correctly exporting the main TemplateConfig
	ScriptConfig,
	FunctionConfig,
	FunctionToolConfig,
	// LLM Component Configs
	GenerateTextConfig,
	StreamTextConfig,
	GenerateObjectObjectConfig,
	GenerateObjectArrayConfig,
	GenerateObjectEnumConfig,
	GenerateObjectNoSchemaConfig,
	StreamObjectObjectConfig,
	StreamObjectArrayConfig,
	StreamObjectNoSchemaConfig,
	// Prompt-specific Configs for LLM Components
	TemplatePromptConfig,
	ScriptPromptConfig,
	FunctionPromptConfig,
	// Other
	ToolConfig,
	ConfigProvider
} from './types/config.js';

// --- Core Library Types ---
export type {
	Context,
	SchemaType,
	TemplatePromptType,
	ScriptPromptType,
	FunctionPromptType,
	StreamObjectOnFinishEvent,
	StreamTextOnFinishEvent
} from './types/types.js';
export { ModelMessageSchema, PromptStringOrMessagesSchema } from './types/schemas.js';

// --- Result Types ---
export type {
	ScriptResult,
	// Augmented results renamed for clean public API
	GenerateTextResultAugmented as GenerateTextResult,
	StreamTextResultAugmented as StreamTextResult,
	// Object Generation Results
	GenerateObjectResultAll,
	GenerateObjectObjectResult,
	GenerateObjectArrayResult,
	GenerateObjectEnumResult,
	GenerateObjectNoSchemaResult,
	// Object Streaming Results
	StreamObjectResultAll,
	StreamObjectObjectResult,
	StreamObjectArrayResult,
	StreamObjectNoSchemaResult
} from './types/result.js';

// --- Error Types ---
export { TemplateError } from './TemplateEngine.js';
export { ScriptError } from './ScriptEngine.js';
export { ConfigError } from './validate.js';


// --- Public Utilities & Associated Types ---
export { race, type RaceGroup, type RaceLoader } from './loaders.js';