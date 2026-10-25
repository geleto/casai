import type { FlexibleSchema, ModelMessage } from 'ai';
import type { DeclaredType, ToolRegistry } from './config.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type { SchemaType, ValidateContextInputSchema } from './types.js';
import type { ValidateResolved } from './provisional.js';
import type { DeclaredSchemaValue } from './function-config.js';

// Infer schemas and configured values before contextualizing a JavaScript prompt callback.
export type FunctionPromptShape<T> = { [K in keyof T]: K extends 'prompt' ? unknown : T[K] };
type Setting<K extends string, T> = [T] extends [never] ? EmptyMap : Record<K, T>;
type PromptDeclarations<INPUT, CONTEXT, TOOL_CONTEXT> =
	Setting<'inputSchema', INPUT> & Setting<'context', CONTEXT> & Setting<'toolContextSchema', TOOL_CONTEXT>;
type PromptContext<T, AsTool extends boolean> = AsTool extends true ? import('./application.js').ToolExecutionContext<T> : import('./application.js').ExecutionContext<T>;
type PromptCallback<T, AsTool extends boolean> = (context: PromptContext<T, AsTool>) => string | ModelMessage[] | Promise<string | ModelMessage[]>;

export interface FunctionRunPrompt<TConfig> {
	prompt?: PromptCallback<TConfig, false>;
}

export type FunctionPromptInput<TConfig, TParent,
	INPUT extends SchemaType<Record<string, any>> | undefined,
	CONTEXT extends Record<string, any> | undefined,
	TOOL_CONTEXT extends FlexibleSchema | undefined,
	AsTool extends boolean,
	RequiredContext extends boolean,
	TOOLS extends ToolRegistry | undefined = never,
	TOOLS_CONTEXT extends object | undefined = never,
	ContextConfig = MergedConfig<TParent, PromptDeclarations<DeclaredSchemaValue<TConfig, 'inputSchema', INPUT>,
		RequiredContext extends true ? CONTEXT : CONTEXT | undefined, DeclaredSchemaValue<TConfig, 'toolContextSchema', TOOL_CONTEXT>>
		& Setting<'tools', TOOLS> & Setting<'toolsContext', TOOLS_CONTEXT>>,
	FinalConfig = MergedConfig<TParent, TConfig>,
> = {
	inputSchema?: INPUT;
	toolContextSchema?: TOOL_CONTEXT;
	toolsContext?: TOOLS_CONTEXT;
} & (RequiredContext extends true ? { context: CONTEXT } : { context?: CONTEXT | undefined }) & NoInfer<{ prompt?: PromptCallback<ContextConfig, AsTool> }> & ValidateResolved<TConfig,
	ValidateContextInputSchema<DeclaredType<FinalConfig, 'inputSchema'>> & (Pick<FinalConfig, 'prompt' & keyof FinalConfig> extends { prompt?: PromptCallback<FinalConfig, AsTool> }
	? unknown : 'Config Error: The prompt callback does not accept the final input and context.')>;
