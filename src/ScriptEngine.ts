import * as cascada from 'cascada-engine';
import { Context, SchemaType, ScriptPromptType } from './types/types.js';
import { ScriptConfig } from './types/config.js';
import * as results from './types/result.js';
import * as types from './types/types.js';
import { validateAndParseOutput } from './validate.js';

export class ScriptError extends Error {
	declare cause?: Error;
	name: string;
	constructor(message: string, cause?: Error) {
		super(message, { cause });
		this.name = 'ScriptError';
	}
}

export class ScriptEngine<
	TConfig extends Partial<ScriptConfig<INPUT, OUTPUT>> & { promptType?: ScriptPromptType },
	INPUT extends Record<string, any>,
	OUTPUT
> {
	protected env: cascada.AsyncEnvironment;
	protected script?: cascada.Script;
	protected config: TConfig;

	constructor(config: TConfig) {
		this.config = {
			...config,
			promptType: config.promptType ?? 'async-script'
		};

		if ('debug' in this.config && this.config.debug) {
			console.log('[DEBUG] ScriptEngine constructor called with config:', this.config);
		}

		try {
			const options = { ...this.config.options, autoescape: this.config.options?.autoescape ?? false };
			const loader = (this.config.loader as types.CascadaLoaders | undefined) ?? null;
			this.env = new cascada.AsyncEnvironment(loader, options);

			if (this.config.filters) {
				for (const [name, filter] of Object.entries(this.config.filters)) {
					if (typeof filter === 'function') {
						this.env.addFilter(name, filter as (...args: any[]) => any);
					}
				}
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new ScriptError(`Script initialization failed: ${error.message}`, error);
			}
			throw new ScriptError('Script initialization failed due to an unknown error');
		}
	}

	async run(
		scriptOverride?: string,
		contextOverride?: Context
	): Promise<TConfig extends { schema: SchemaType<OUTPUT> } ? OUTPUT : results.ScriptResult> {
		if ('debug' in this.config && this.config.debug) {
			console.log('[DEBUG] ScriptEngine.run called with:', { scriptOverride, contextOverride });
		}

		if (scriptOverride === undefined && this.config.script === undefined) {
			throw new ScriptError('No script provided. Either provide a script in the configuration or as a call argument.');
		}

		let rawResult: results.ScriptResult;

		try {
			const mergedContext = contextOverride
				? { ...this.config.context ?? {}, ...contextOverride }
				: this.config.context ?? {};

			if ('debug' in this.config && this.config.debug) {
				console.log('[DEBUG] ScriptEngine.run - merged context:', mergedContext);
			}

			const source = scriptOverride ?? this.config.script;
			if (source === undefined) {
				throw new ScriptError('No script available to render');
			}
			if (this.config.promptType === 'async-script-name') {
				// The environment owns named script caching, invalidation, and relative imports.
				rawResult = await this.env.renderScript(source, mergedContext);
			} else if (scriptOverride !== undefined) {
				rawResult = await this.env.renderScriptString(source, mergedContext);
			} else {
				// Assign before rendering so simultaneous calls share compilation, not execution state.
				this.script ??= cascada.compileScript(source, this.env);
				rawResult = await this.script.render(mergedContext);
			}
			if ('debug' in this.config && this.config.debug) {
				console.log('[DEBUG] ScriptEngine.run - script result:', rawResult);
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new ScriptError(`Script render failed: ${error.message}`, error);
			} else if (typeof error === 'string') {
				throw new ScriptError(`Script render failed: ${error}`);
			}
			throw new ScriptError('Script render failed due to an unknown error');
		}

		return await validateAndParseOutput(this.config, rawResult) as TConfig extends { schema: SchemaType<OUTPUT> } ? OUTPUT : results.ScriptResult;
	}
}
