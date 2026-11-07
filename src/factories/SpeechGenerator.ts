import type { PromptType } from '../types/prompt.js';
import type { FilePayload } from '../types/result.js';
import type { OptionalUndefined } from '../types/utils.js';
import type { StandardComponent } from '../types/component.js';
import { generateSpeech } from 'ai';
import { createComponentFactory, textModifiers, textModes } from './component-factory.js';
import { createComponentRuntime } from '../runtime/component-call.js';
import type { RuntimeComponentConfig } from '../runtime/component-call.js';
import type { ToolInvocation } from '../types/execution.js';
import type { Fields } from '../types/utils.js';

type Settings = Omit<Parameters<typeof generateSpeech>[0], '_internal'>;
export const definition = {
	name: 'SpeechGenerator', defaultMode: 'text', main: 'text', modifiers: textModifiers, toolModes: textModes, required: ['model'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;

export interface Types<P extends PromptType, T, A extends boolean> {
	definition: typeof definition;
	settings: Settings;
	component: StandardComponent<'SpeechGenerator', P, T, A, OptionalUndefined<[voice?: string]>>;
	result: import('ai').SpeechResult;
	toolResult: FilePayload;
}

function createSpeechGenerator(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields, tool?: ToolInvocation) {
		const result = await generateSpeech(runtime.request(await runtime.prepare(raw, tool)) as Settings);
		return tool ? { mediaType: result.audio.mediaType, base64: result.audio.base64 } : result;
	}
	return runtime.callable(invoke, args => {
		const call = runtime.arguments(args);
		call.take('voice', value => typeof value === 'string');
		return call.done();
	}, () => ({ type: 'text', value: 'Speech generated.' }));
}

type Factory = import('./component-factory.js').SourceFactory<'SpeechGenerator'>;
export const SpeechGenerator = createComponentFactory(definition, createSpeechGenerator) as Factory;
