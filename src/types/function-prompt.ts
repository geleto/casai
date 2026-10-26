import type { EmptyMap } from './utils.js';
import type { PromptValue } from './prompt.js';
import type { ValidateContextInputSchema } from './schema.js';
import type { ConfigValue, ToolRegistry } from './config.js';
import type { MergedConfig } from './merge.js';
import type { ValidateResolved } from './provisional.js';

// Infer schemas and configured values before contextualizing a JavaScript prompt callback.
export type FunctionPromptShape<T> = { [K in keyof T]: K extends 'prompt' ? unknown : T[K] };
type Setting<K extends string, T> = [T] extends [never] ? EmptyMap : Record<K, T>;
type PromptContext<T, AsTool extends boolean> = AsTool extends true ? import('./execution.js').ToolExecutionContext<T> : import('./execution.js').ExecutionContext<T>;

type PromptCallback<T, AsTool extends boolean> = (context: PromptContext<T, AsTool>) => PromptValue | Promise<PromptValue>;

// Keep each retained callback paired with its own schema and configured context.
type InvalidPromptBranches<T, AsTool extends boolean> = T extends unknown
	? Pick<T, 'prompt' & keyof T> extends { prompt: PromptCallback<T, AsTool> } ? never : T : never;

export interface FunctionRunPrompt<TConfig> {
	prompt?: PromptCallback<TConfig, false>;
}

export type FunctionPromptInput<TConfig, TParent, Schemas,
	CONTEXT extends Record<string, any> | undefined,
	AsTool extends boolean,
	RequiredContext extends boolean,
	TOOLS extends ToolRegistry | undefined = never,
	TOOLS_CONTEXT extends object | undefined = never,
	ContextConfig = MergedConfig<TParent, Schemas
		& Setting<'context', RequiredContext extends true ? CONTEXT : CONTEXT | undefined>
		& Setting<'tools', TOOLS> & Setting<'toolsContext', TOOLS_CONTEXT>>,
	FinalConfig = MergedConfig<TParent, TConfig>,
> = {
	toolsContext?: TOOLS_CONTEXT;
} & (RequiredContext extends true ? { context: CONTEXT } : { context?: CONTEXT | undefined }) & NoInfer<{ prompt?: PromptCallback<ContextConfig, AsTool> }> & ValidateResolved<TConfig,
	ValidateContextInputSchema<ConfigValue<FinalConfig, 'inputSchema'>> & ([InvalidPromptBranches<FinalConfig, AsTool>] extends [never]
	? unknown : 'Config Error: A function prompt compatible with the final input and context is required.')>;
