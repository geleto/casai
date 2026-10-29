import { AsyncEnvironment, compileScript, compileTemplateAsync } from 'cascada-engine';
import type { CascadaConfig } from '../types/config.js';
import type { LoaderGroup } from 'cascada-engine';
import type { ScriptPromptType, TemplatePromptType } from '../types/prompt.js';
import type { Context } from '../types/utils.js';
import { ScriptError, TemplateError } from '../errors.js';

type Renderer<T> = (sourceOverride: string | undefined, context: Context) => Promise<T>;
type SourceType = TemplatePromptType | ScriptPromptType;

export function createCascadaRenderer(config: CascadaConfig, promptType: TemplatePromptType, source?: string): Renderer<string>;
export function createCascadaRenderer(config: CascadaConfig, promptType: SourceType, source?: string): Renderer<unknown>;
export function createCascadaRenderer(config: CascadaConfig, promptType: SourceType, source?: string): Renderer<unknown> {
	const script = promptType === 'async-script' || promptType === 'async-script-name';
	const loaded = promptType.endsWith('-name');
	const kind = script ? 'Script' : 'Template';
	const ErrorClass = script ? ScriptError : TemplateError;
	let env: AsyncEnvironment;
	try {
		const options = { ...config.renderOptions, autoescape: config.renderOptions?.autoescape ?? false };
		env = new AsyncEnvironment((config.loader as LoaderGroup | undefined) ?? null, options);
		for (const [name, filter] of Object.entries(config.filters ?? {})) {
			if (typeof filter === 'function') env.addFilter(name, filter);
		}
	} catch (error) {
		const cause = error instanceof Error ? error : new Error(String(error));
		throw new ErrorClass(`${kind} initialization failed: ${cause.message}`, cause);
	}
	const compile = script ? compileScript : compileTemplateAsync;
	let compiled: ReturnType<typeof compile> | undefined;
	return async (sourceOverride, context) => {
		const selected = (sourceOverride ?? source)!;
		if (config.debug) console.log(`[DEBUG] ${kind} render:`, { source: selected, context });
		try {
			let result: unknown;
			if (loaded) {
				// Cascada owns named-source caching, invalidation and relative imports.
				result = await (script ? env.renderScript(selected, context) : env.renderTemplate(selected, context));
			} else if (sourceOverride !== undefined) {
				result = await (script ? env.renderScriptString(selected, context) : env.renderTemplateString(selected, context));
			} else {
				// Cache before awaiting: concurrent calls share compilation, never execution state.
				compiled ??= compile(selected, env);
				result = await compiled.render(context);
			}
			if (config.debug) console.log(`[DEBUG] ${kind} result:`, result);
			return result;
		} catch (error) {
			const cause = error instanceof Error ? error : new Error(String(error));
			throw new ErrorClass(`${kind} render failed: ${cause.message}`, cause);
		}
	};
}
