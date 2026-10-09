import type { FlexibleSchema, ModelMessage, ToolExecutionOptions } from 'ai';
import type { DeclaredType, ToolContextFromConfig } from './config.js';
import type { EmptyMap, MergedConfig } from './merge.js';
import type { InferContextInputSchema, InferSchema, InputWithContext, SchemaType, ValidateContextInputSchema } from './types.js';
import type { ValidateResolved } from './provisional.js';
import type { ContextOf } from './function-config.js';

// Infer schemas and configured values before contextualizing a JavaScript prompt callback.
export type FunctionPromptShape<T> = { [K in keyof T]: K extends 'prompt' ? unknown : T[K] };
type Setting<K extends string, T> = [T] extends [never] ? EmptyMap : Record<K, T>;
type PromptDeclarations<INPUT, CONTEXT, TOOL_CONTEXT> =
	Setting<'inputSchema', INPUT> & Setting<'context', CONTEXT> & Setting<'contextSchema', TOOL_CONTEXT>;
type RawPromptContext<T> = InputWithContext<InferContextInputSchema<DeclaredType<T, 'inputSchema'>>, ContextOf<T>, DeclaredType<T, 'inputSchema'>, true>;
type ParsedPromptContext<T> = InputWithContext<InferSchema<DeclaredType<T, 'inputSchema'>>, ContextOf<T>, DeclaredType<T, 'inputSchema'>>;
type PromptContext<T, AsTool extends boolean> = (AsTool extends true ? RawPromptContext<T> | ParsedPromptContext<T> : RawPromptContext<T>) &
	(AsTool extends true ? { _toolCallOptions?: ToolExecutionOptions<ToolContextFromConfig<T>> } : EmptyMap);
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
	ContextConfig = MergedConfig<TParent, PromptDeclarations<INPUT, RequiredContext extends true ? CONTEXT : CONTEXT | undefined, TOOL_CONTEXT>>,
	FinalConfig = MergedConfig<TParent, TConfig>,
> = {
	inputSchema?: INPUT;
	contextSchema?: TOOL_CONTEXT;
} & (RequiredContext extends true ? { context: CONTEXT } : { context?: CONTEXT | undefined }) & NoInfer<{ prompt?: PromptCallback<ContextConfig, AsTool> }> & ValidateResolved<TConfig,
	ValidateContextInputSchema<DeclaredType<FinalConfig, 'inputSchema'>> & (Pick<FinalConfig, 'prompt' & keyof FinalConfig> extends { prompt?: PromptCallback<FinalConfig, AsTool> }
	? unknown : 'Config Error: The prompt callback does not accept the final input and context.')>;
