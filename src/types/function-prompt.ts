import type { ModelMessage } from 'ai';
import type { ConfigValue, ToolRegistry } from './config.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type { ValidateContextInputSchema } from './types.js';
import type { ValidateResolved } from './provisional.js';

// Infer schemas and configured values before contextualizing a JavaScript prompt callback.
export type FunctionPromptShape<T> = { [K in keyof T]: K extends 'prompt' ? unknown : T[K] };
type Setting<K extends string, T> = [T] extends [never] ? EmptyMap : Record<K, T>;
type PromptContext<T, AsTool extends boolean> = AsTool extends true ? import('./application.js').ToolExecutionContext<T> : import('./application.js').ExecutionContext<T>;
type PromptCallback<T, AsTool extends boolean> = (context: PromptContext<T, AsTool>) => string | ModelMessage[] | Promise<string | ModelMessage[]>;

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
	ValidateContextInputSchema<ConfigValue<FinalConfig, 'inputSchema'>> & (Pick<FinalConfig, 'prompt' & keyof FinalConfig> extends { prompt?: PromptCallback<FinalConfig, AsTool> }
	? unknown : 'Config Error: The prompt callback does not accept the final input and context.')>;
