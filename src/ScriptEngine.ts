import * as cascada from 'cascada-engine';
import { z } from 'zod';
import { Context, SchemaType, ScriptPromptType } from './types/types.js';
import { ScriptConfig } from './types/config.js';
import * as results from './types/result.js';
import * as types from './types/types.js';
import { loadSource, processLoaders } from './loaders.js';
import { JSONValue } from 'ai';

export class ScriptError extends Error {
	cause?: Error;
	name: string;
	constructor(message: string, cause?: Error) {
		super(message);
		this.name = 'ScriptError';
		this.cause = cause;
	}
}

export class ScriptEngine<
	TConfig extends Partial<ScriptConfig<INPUT, OUTPUT>> & { promptType?: ScriptPromptType },
	INPUT extends Record<string, any>,
	OUTPUT
> {
	protected env: cascada.AsyncEnvironment;
	protected scriptPromise?: Promise<cascada.Script>;
	protected script?: cascada.Script;
	protected config: TConfig;

	constructor(config: TConfig) {
		this.config = {
			...config,
			promptType: config.promptType ?? 'async-script'
		};

		// Debug output if config.debug is true
		if ('debug' in this.config && this.config.debug) {
			console.log('[DEBUG] ScriptEngine constructor called with config:', this.config);
		}

		// Runtime validation of loader requirement
		if (
			(this.config.promptType === 'script-name' ||
				this.config.promptType === 'async-script-name') &&
			!('loader' in this.config) && !this.config.loader
		) {
			throw new ScriptError('A loader is required when promptType is "script-name" or "async-script-name".');
		}

		// Initialize appropriate environment based on promptType
		try {
			const options = { ...this.config.options, autoescape: false };
			const loader = (this.config.loader as types.CascadaLoaders | undefined) ?? null;
			this.env = new cascada.AsyncEnvironment(loader, options);

			// Add filters if provided
			if ('filters' in this.config && this.config.filters) {
				for (const [name, filter] of Object.entries(this.config.filters)) {
					if (typeof filter === 'function') {
						this.env.addFilter(name, filter as (...args: any[]) => any);
					}
				}
			}

			// Scripts are rendered through the environment at call time. This keeps
			// inline and named scripts on the same current Cascada render path.
		} catch (error) {
			if (error instanceof Error) {
				throw new ScriptError(`Script initialization failed: ${error.message}`, error);
			}
			throw new ScriptError('Script initialization failed due to an unknown error');
		}
	}

	// The environment loads named scripts, so relative imports resolve from the loaded path and precompiled
	// scripts are accepted. An empty source fails to parse; it is checked only after a failure.
	private async renderNamedScript(name: string, context: Context): Promise<Record<string, any> | string | null> {
		try {
			return await this.env.renderScript(name, context);
		} catch (error) {
			if (await this.isEmptySource(name)) return null;
			throw error;
		}
	}

	// The first loader with a source for the name supplies it, as in the environment.
	private async isEmptySource(name: string): Promise<boolean> {
		const loaders = this.config.loader === undefined ? [] : processLoaders(this.config.loader);
		for (const loader of loaders) {
			const source = await loadSource(loader, name).catch(() => null);
			if (source !== null) return (typeof source === 'string' ? source : source.src) === '';
		}
		return false;
	}

	async run(
		scriptOverride?: string,
		contextOverride?: Context
	): Promise<TConfig extends { schema: SchemaType<OUTPUT> } ? OUTPUT : results.ScriptResult> {
		// Debug output if config.debug is true
		if ('debug' in this.config && this.config.debug) {
			console.log('[DEBUG] ScriptEngine.run called with:', { scriptOverride, contextOverride });
		}

		// Runtime check for missing script
		if (scriptOverride === undefined && this.config.script === undefined) {
			throw new ScriptError('No script provided. Either provide a script in the configuration or as a call argument.');
		}

		let rawResult: Record<string, any> | string | null;

		try {
			const mergedContext = contextOverride
				? { ...('context' in this.config ? this.config.context : {}) ?? {}, ...contextOverride }
				: ('context' in this.config ? this.config.context : {}) ?? {};

			if ('debug' in this.config && this.config.debug) {
				console.log('[DEBUG] ScriptEngine.run - merged context:', mergedContext);
			}

			const script = scriptOverride ?? this.config.script;
			if (typeof script !== 'string') {
				throw new ScriptError('No script available to render');
			}
			// Cascada's parser currently rejects empty source, which has the same result as returning none.
			const result = this.config.promptType === 'script-name' || this.config.promptType === 'async-script-name'
				? await this.renderNamedScript(script, mergedContext)
				: await this.env.renderScriptString(script === '' ? 'return none' : script, mergedContext);
			if ('debug' in this.config && this.config.debug) {
				console.log('[DEBUG] ScriptEngine.run - script result:', result);
			}
			rawResult = result;
		} catch (error) {
			if (error instanceof Error) {
				throw new ScriptError(`Script render failed: ${error.message}`, error);
			} else if (typeof error === 'string') {
				throw new ScriptError(`Script render failed: ${error}`);
			}
			throw new ScriptError('Script render failed due to an unknown error');
		}

		const schema: SchemaType<OUTPUT> | undefined = 'schema' in this.config ? this.config.schema : undefined;

		if (schema) {
			// Check if it's a Zod schema (has parse method)
			if ('parse' in schema && typeof schema.parse === 'function') {
				try {
					const validatedResult = (schema as z.Schema<OUTPUT>).parse(rawResult);
					if ('debug' in this.config && this.config.debug) {
						console.log('[DEBUG] ScriptEngine.run - Zod validation successful:', validatedResult);
					}
					return validatedResult as (TConfig extends { schema: SchemaType<OUTPUT> } ? OUTPUT : JSONValue);
				} catch (error) {
					if (error instanceof z.ZodError) {
						throw new ScriptError(`Script output validation failed: ${error.message}`, error);
					}
					// Re-throw other, unexpected errors
					throw error;
				}
			}
			// Check if it's a Vercel AI Schema (has validate method)
			else if ('validate' in schema && typeof schema.validate === 'function') {
				try {
					// Type assertion to access the validate method safely
					const vercelSchema = schema as { validate: (value: unknown) => { success: true; value: OUTPUT } | { success: false; error: Error } | PromiseLike<{ success: true; value: OUTPUT } | { success: false; error: Error }> };
					const validationResult = await vercelSchema.validate(rawResult);
					if (validationResult.success) {
						if ('debug' in this.config && this.config.debug) {
							console.log('[DEBUG] ScriptEngine.run - Vercel Schema validation successful:', validationResult.value);
						}
						return validationResult.value as TConfig extends { schema: SchemaType<OUTPUT> } ? OUTPUT : results.ScriptResult;
					} else {
						throw new ScriptError(`Script output validation failed: ${validationResult.error.message}`, validationResult.error);
					}
				} catch (error) {
					if (error instanceof ScriptError) {
						throw error;
					}
					throw new ScriptError(`Script output validation failed: ${error instanceof Error ? error.message : 'Unknown validation error'}`, error instanceof Error ? error : undefined);
				}
			} else if ('debug' in this.config && this.config.debug) {
				// Warn if a schema was provided but we can't do anything with it.
				console.warn('[DEBUG] ScriptEngine.run - a schema was provided, but it is not a Zod schema or Vercel Schema. Skipping validation.');
			}
		}

		return rawResult as TConfig extends { schema: SchemaType<OUTPUT> } ? OUTPUT : results.ScriptResult;
	}
}
