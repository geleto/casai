import { sourceMode } from '../config/source-mode.js';
import type { Fields } from '../types/utils.js';
import type { CascadaConfig } from '../types/config.js';
import type { ScriptPromptType, TemplatePromptType, PromptType } from '../types/prompt.js';
import type { ExecutionConfig, ToolInvocation } from '../types/execution.js';
import type { SchemaType } from '../types/schema.js';
import { createCascadaRenderer } from '../renderers/cascada-renderer.js';
import { namedArguments } from './execution.js';
import { validateAndParseOutput } from '../config/validate.js';
import { ValidationError } from '../errors.js';
import type { Definitions } from '../types/component-map.js';
import { createComponentRuntime } from './component-call.js';
import type { RuntimeComponentConfig } from './component-call.js';

type RuntimeCodedConfig = CascadaConfig & ExecutionConfig & {
	[sourceMode]?: PromptType; template?: string; script?: string;
	schema?: SchemaType<unknown>; execute?: (context: Fields) => unknown;
};

/** Coded components share preparation and invocation; only their source and body differ. */
export function createCodedComponent(merged: RuntimeCodedConfig, definition: Definitions['Function' | 'Template' | 'Script']) {
	const kind = definition.name;
	const source = definition.main === 'execute' ? undefined : definition.main;
	if (merged.debug) console.log(`[DEBUG] ${kind} created with config:`, merged);
	const render = source ? createCascadaRenderer(merged, merged[sourceMode] as ScriptPromptType | TemplatePromptType, merged[source]) : undefined;
	const runtime = createComponentRuntime(merged as RuntimeComponentConfig, definition,
		(override: unknown, context: Fields) => render ? render(override as string | undefined, context) : merged.execute!(context));
	const invoke = async (settings: Fields, tool?: ToolInvocation) => {
		if (source) {
			if (settings[source] !== undefined && typeof settings[source] !== 'string') throw new ValidationError(`${kind} source must be a string.`);
			if (settings[source] === undefined && merged[source] === undefined) throw new ValidationError(`A ${source} source must be provided in configuration or at call time.`);
		}
		const prepared = await runtime.prepare(settings, tool);
		return validateAndParseOutput(merged, prepared.settings[definition.main]);
	};
	return runtime.callable(invoke, args => {
		if (source) return runtime.arguments(args).done();
		const { values } = namedArguments(args);
		if (values.length > 1) throw new ValidationError('Function accepts one context argument.');
		return { context: values[0] };
	});
}
