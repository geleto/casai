import type { PromptType } from '../types/prompt.js';
import type { StandardComponent } from '../types/component.js';
import { embed, embedMany } from 'ai';
import { createComponentFactory, textModifiers, textModes } from './component-factory.js';
import { createComponentRuntime } from '../runtime/component-call.js';
import type { RuntimeComponentConfig } from '../runtime/component-call.js';
import type { ToolInvocation } from '../types/execution.js';
import type { Fields } from '../types/utils.js';
import type { RuntimeContextFromConfig } from '../types/config.js';

type Settings<Runtime extends Record<string, unknown> = Record<string, unknown>> = Omit<Parameters<typeof embedMany<Runtime>>[0], '_internal' | 'values'> & { input: string | string[] };
export const definition = {
	name: 'Embedder', defaultMode: 'text', main: 'input', modifiers: textModifiers, toolModes: textModes, required: ['model'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;

export interface Types<P extends PromptType, T, A extends boolean, Input> {
	definition: typeof definition;
	settings: Settings<RuntimeContextFromConfig<T>>;
	component: StandardComponent<'Embedder', P, T, A>;
	result: Input extends string ? import('ai').EmbedResult : Input extends string[] ? import('ai').EmbedManyResult : import('ai').EmbedResult | import('ai').EmbedManyResult;
	toolResult: Input extends string ? number[] : Input extends string[] ? number[][] : number[] | number[][];
}

function createEmbedder(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields, tool?: ToolInvocation) {
		const request = runtime.request(await runtime.prepare(raw, tool)) as Settings;
		const { input, ...settings } = request;
		if (Array.isArray(input)) {
			const result = await embedMany({ ...settings, values: input });
			return tool ? result.embeddings : result;
		}
		const result = await embed({ ...settings, value: input });
		return tool ? result.embedding : result;
	}
	return runtime.callable(invoke, args => runtime.arguments(args).done());
}

type Factory = import('./component-factory.js').SourceFactory<'Embedder'>;
export const Embedder = createComponentFactory(definition, createEmbedder) as Factory;
