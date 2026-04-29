import 'dotenv/config';
import type { LoaderInterface } from 'cascada-engine';
import type { LanguageModel } from 'ai';

import { openai, createOpenAI } from '@ai-sdk/openai';
export const providerName = 'openai';
export const modelName = 'gpt-5.4-nano';
export const createProvider = createOpenAI;
export const model: LanguageModel = openai(modelName);

// import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
// export const providerName = 'anthropic';
// export const modelName = 'claude-haiku-4-5';
// export const createProvider = createAnthropic;
// export const model: LanguageModel = anthropic(modelName);

export const timeout = 10000;
export const defaultTemperature = 0.2;
export const temperature: number | null = providerName === 'openai' ? null : defaultTemperature;
export const temperatureConfig: { temperature?: number } = temperature !== null ? { temperature } : {};

/**
 * StringLoader class for testing purposes.
 * Manages templates in memory for test scenarios.
 */
export class StringLoader implements LoaderInterface {
	private texts = new Map<string, string>();

	load(name: string): string | null {
		return this.texts.get(name) ?? null;
	}

	addString(name: string, content: string) {
		this.texts.set(name, content);
	}
}

/**
 * AsyncStringLoader class for testing async loader functionality.
 * Returns Promise<LoaderSource> from getSource to simulate async loading.
 */
export class AsyncStringLoader implements LoaderInterface {
	private texts = new Map<string, string>();
	constructor(private delay = 1) {
	}

	async load(name: string): Promise<string | null> {
		//wait 1 ms
		if (this.delay) {
			await new Promise(resolve => setTimeout(resolve, this.delay));
		}
		// return the value
		return this.texts.get(name) ?? null;
	}

	addString(name: string, content: string) {
		this.texts.set(name, content);
	}
}
