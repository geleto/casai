import type { Fields } from './types/utils.js';
import type { CascadaConfig, ConfigProvider } from './types/config.js';
import type { ScriptPromptType, TemplatePromptType, PromptType } from './types/prompt.js';
import type { ExecutionConfig } from './types/execution.js';
import type { SchemaType } from './types/schema.js';
import { mergeConfigs, processConfig } from './config-utils.js';
import { createCascadaRenderer } from './cascada-renderer.js';
import { defineTool, namedArguments, prepareExecution, runSettings, validateRegistryConfig } from './execution.js';
import { validateAndParseOutput, validateFunctionConfig, validateRendererConfig } from './validate.js';
import { ValidationError } from './errors.js';

type RuntimeCodedConfig = CascadaConfig & ExecutionConfig & {
	promptType?: PromptType; template?: string; script?: string;
	schema?: SchemaType<unknown>; execute?: (context: Fields) => unknown;
};

/** Coded components share preparation and invocation; only their source and body differ. */
export function createCodedComponent(kind: 'Function' | 'Template' | 'Script', config: object, parent?: ConfigProvider<object>, promptType?: PromptType, asTool = false) {
	const inherited = (parent ? mergeConfigs(parent.config, config) : processConfig(config)) as RuntimeCodedConfig;
	const tool = asTool || inherited.asTool === true;
	const source = kind === 'Template' ? 'template' : kind === 'Script' ? 'script' : undefined;
	const merged = { ...inherited, ...(tool ? { asTool: true as const } : {}),
		...(source ? { promptType: promptType ?? inherited.promptType ?? (kind === 'Script' ? 'async-script' : 'async-template') } : {}) };
	if (kind === 'Function') validateFunctionConfig(merged);
	else validateRendererConfig(merged, kind);
	validateRegistryConfig(merged, config);
	if (merged.debug) console.log(`[DEBUG] ${kind} created with config:`, merged);
	const render = source ? createCascadaRenderer(merged, merged.promptType as ScriptPromptType | TemplatePromptType, merged[source]) : undefined;
	const execute = async (context: Fields, override?: string) => validateAndParseOutput(merged,
		render ? await render(override, context) : await merged.execute!(context));
	const run = async (...args: unknown[]) => {
		const settings = runSettings(args, ['context', 'toolsContext', 'abortSignal', ...(source ? [source] : [])]);
		if (source) {
			if (settings[source] !== undefined && typeof settings[source] !== 'string') throw new ValidationError(`${kind} source must be a string.`);
			if (settings[source] === undefined && merged[source] === undefined) throw new ValidationError(`A ${source} source must be provided in configuration or at call time.`);
		}
		const { context } = await prepareExecution(merged, settings.context,
			settings.abortSignal === undefined ? {} : { abortSignal: settings.abortSignal as AbortSignal }, settings.toolsContext as Fields | undefined);
		return execute(context, source ? settings[source] as string | undefined : undefined);
	};
	const call = async (...args: unknown[]) => {
		const { values } = namedArguments(args);
		if (!source) {
			if (values.length > 1) throw new ValidationError('Function accepts one context argument.');
			return run({ context: values[0] });
		}
		const [first, second, ...rest] = values;
		if (rest.length || (typeof first !== 'string' && second !== undefined)) throw new ValidationError(`Unexpected ${kind} arguments.`);
		return typeof first === 'string' ? run({ [source]: first, context: second }) : run({ context: first });
	};
	const component = Object.assign(call, { config: merged, type: kind === 'Function' ? 'FunctionCall' : kind, run });
	return tool ? defineTool(component, context => execute(context), merged.schema) : component;
}
