import type { FlexibleSchema, ToolSet } from 'ai';
import type { Fields } from '../schema.js';
import type { ToolRegistry } from './config.js';
import type { ComponentExecutionOptions } from './sdk.js';

/** The configuration fields consumed by the shared execution pipeline. */
export interface ExecutionConfig {
	context?: Fields;
	inputSchema?: FlexibleSchema<unknown>;
	toolContextSchema?: FlexibleSchema<unknown>;
	tools?: ToolRegistry;
	toolsContext?: Fields;
}

/** Parsed application values, trusted bindings and invocation metadata. */
export interface PreparedExecutionContext extends Fields {
	_toolOptions: ComponentExecutionOptions;
}

export interface PreparedToolRegistry {
	tools: ToolSet;
	toolsContext: Fields;
	helpers(options: ComponentExecutionOptions): Fields;
	assertContext(value: unknown): void;
}
