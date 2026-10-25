const marker = Symbol.for('casai.error.ConfigError');

export class ConfigError extends Error {
	private readonly [marker] = true;
	declare cause?: Error;
	constructor(message: string, cause?: Error) {
		super(message, { cause });
		this.name = 'ConfigError';
	}
	/** Recognize errors across compatible package copies, like the SDK's error guards. */
	static isInstance(error: unknown): error is ConfigError {
		return error !== null && typeof error === 'object' && marker in error && error[marker] === true;
	}
}
