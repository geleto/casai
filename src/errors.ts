/** Invalid component configuration or an unsupported schema/binding contract. */
export class ConfigError extends Error {
	declare cause?: Error;
	constructor(message: string, cause?: Error) {
		super(message, { cause });
		this.name = 'ConfigError';
	}
}

/** Invalid invocation arguments or values at a Casai-owned validation boundary. */
export class ValidationError extends Error {
	declare cause?: Error;
	constructor(message: string, cause?: Error) {
		super(message, { cause });
		this.name = 'ValidationError';
	}
}

export class TemplateError extends Error {
	declare cause?: Error;
	name: string;
	constructor(message: string, cause?: Error) {
		super(message, { cause });
		this.name = 'TemplateError';
	}
}

export class ScriptError extends Error {
	declare cause?: Error;
	name: string;
	constructor(message: string, cause?: Error) {
		super(message, { cause });
		this.name = 'ScriptError';
	}
}
