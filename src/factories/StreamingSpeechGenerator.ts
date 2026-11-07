import type { PromptType } from '../types/prompt.js';
import type { OptionalUndefined } from '../types/utils.js';
import type { StandardComponent } from '../types/component.js';
import { experimental_streamSpeech } from 'ai';
import { createComponentFactory, textModifiers } from './component-factory.js';
import { createComponentRuntime } from '../runtime/component-call.js';
import type { RuntimeComponentConfig } from '../runtime/component-call.js';
import type { Fields } from '../types/utils.js';
import { claimLiveInput } from '../runtime/live-input.js';

type Settings = Omit<Parameters<typeof experimental_streamSpeech>[0], '_internal'>;
export const definition = {
	name: 'StreamingSpeechGenerator', defaultMode: 'text', main: 'text', modifiers: textModifiers, toolModes: [], required: ['model'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;

export interface Types<P extends PromptType, T, A extends boolean> {
	definition: typeof definition;
	settings: Settings;
	component: StandardComponent<'StreamingSpeechGenerator', P, T, A, OptionalUndefined<[voice?: string]>>;
	result: import('ai').Experimental_StreamSpeechResult;
	toolResult: never;
}

function createStreamingSpeechGenerator(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields) {
		const settings = runtime.request(await runtime.prepare(raw)) as Settings;
		claimLiveInput(settings.text);
		return experimental_streamSpeech(settings);
	}
	return runtime.callable(invoke, args => {
		const call = runtime.arguments(args);
		call.take('voice', value => typeof value === 'string');
		return call.done();
	});
}

type Factory = import('./component-factory.js').SourceFactory<'StreamingSpeechGenerator'>;
/** @experimental Uses the AI SDK's experimental streaming speech API. */
export const StreamingSpeechGenerator = createComponentFactory(definition, createStreamingSpeechGenerator) as Factory;
