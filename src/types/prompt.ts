import type { ModelMessage } from 'ai';
import type { Context } from './utils.js';

// Define the possible prompt types
export type TemplatePromptType = 'async-template' | 'async-template-name';

export type ScriptPromptType = 'async-script' | 'async-script-name';

export type FunctionPromptType = 'function';

export type TextPromptType = 'text' | 'text-name';

export type PromptType = TemplatePromptType | ScriptPromptType | FunctionPromptType | TextPromptType;

export type PromptValue = string | ModelMessage[];

// Source admission preserves typed callbacks; the final component checks their parsed context.
export type AnyPromptSource = PromptValue | PromptFunction<PromptValue, never>;

export type PromptFunction<PR extends PromptValue = PromptValue, INPUT extends Context = Context> =
	(context: INPUT) => PR | PromiseLike<PR>;
