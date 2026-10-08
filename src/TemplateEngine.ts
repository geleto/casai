import * as cascada from 'cascada-engine';
import { Context } from './types/types.js';
import { TemplateConfig } from './types/config.js';
import * as types from './types/types.js';

export class TemplateError extends Error {
	declare cause?: Error;
	name: string;
	constructor(message: string, cause?: Error) {
		super(message, { cause });
		this.name = 'TemplateError';
	}
}

export class TemplateEngine<
	TConfig extends Partial<TemplateConfig<INPUT>>,
	INPUT extends Record<string, any>
> {
	protected env: cascada.AsyncEnvironment;
	protected template?: cascada.AsyncTemplate;
	protected config: TConfig;

	constructor(config: TConfig) {
		this.config = {
			...config,
			promptType: config.promptType ?? 'async-template'
		};

		if ('debug' in this.config && this.config.debug) {
			console.log('[DEBUG] TemplateEngine constructor called with config:', this.config);
		}

		try {
			const options = { ...this.config.options, autoescape: this.config.options?.autoescape ?? false };
			const loader = (this.config.loader as types.CascadaLoaders | undefined) ?? null;
			this.env = new cascada.AsyncEnvironment(loader, options);

			if (this.config.filters) {
				for (const [name, filter] of Object.entries(this.config.filters)) {
					if (typeof filter === 'function') {
						this.env.addFilter(name, filter);
					}
				}
			}

			if (this.config.template !== undefined && this.config.promptType === 'async-template') {
				this.template = cascada.compileTemplateAsync(this.config.template, this.env);
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new TemplateError(`Template initialization failed: ${error.message}`, error);
			}
			throw new TemplateError('Template initialization failed due to an unknown error');
		}
	}

	async render(
		promptOverride?: string,
		contextOverride?: Context
	): Promise<string> {
		if ('debug' in this.config && this.config.debug) {
			console.log('[DEBUG] TemplateEngine.render called with:', { promptOverride, contextOverride });
		}

		if (promptOverride === undefined && this.config.template === undefined) {
			throw new TemplateError('No template prompt provided. Either provide a prompt in the configuration or as a call argument.');
		}

		try {
			const mergedContext = contextOverride
				? { ...this.config.context ?? {}, ...contextOverride }
				: this.config.context ?? {};

			if ('debug' in this.config && this.config.debug) {
				console.log('[DEBUG] TemplateEngine.render - merged context:', mergedContext);
			}

			if (this.config.promptType === 'async-template-name') {
				const name = promptOverride ?? this.config.template;
				if (name === undefined) {
					throw new TemplateError('No template available to render');
				}
				return await this.env.renderTemplate(name, mergedContext);
			}

			if (promptOverride !== undefined) {
				return await this.env.renderTemplateString(promptOverride, mergedContext);
			}

			if (!this.template) {
				throw new TemplateError('No template available to render');
			}

			const result = await this.template.render(mergedContext);
			if ('debug' in this.config && this.config.debug) {
				console.log('[DEBUG] TemplateEngine.render - async template result:', result);
			}
			return result;
		} catch (error) {
			if (error instanceof Error) {
				throw new TemplateError(`Template render failed: ${error.message}`, error);
			} else if (typeof error === 'string') {
				throw new TemplateError(`Template render failed: ${error}`);
			}
			throw new TemplateError('Template render failed due to an unknown error');
		}
	}
}
