import type { PromptType } from '../types/prompt.js';
import type { StandardComponent } from '../types/component.js';
import { transcribe } from 'ai';
import { createComponentFactory, audioModifiers, audioModes } from './component-factory.js';
import { createComponentRuntime } from '../runtime/component-call.js';
import type { RuntimeComponentConfig } from '../runtime/component-call.js';
import type { ToolInvocation } from '../types/execution.js';
import type { Fields } from '../types/utils.js';

type Settings = Omit<Parameters<typeof transcribe>[0], '_internal'>;
export type TranscriptSnapshot = Pick<import('ai').TranscriptionResult, 'text' | 'segments' | 'language' | 'durationInSeconds'>;
export const definition = {
	name: 'Transcriber', defaultMode: 'text', main: 'audio', modifiers: audioModifiers, toolModes: audioModes, required: ['model'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;

export interface Types<P extends PromptType, T, A extends boolean> {
	definition: typeof definition;
	settings: Settings;
	component: StandardComponent<'Transcriber', P, T, A>;
	result: import('ai').TranscriptionResult;
	toolResult: TranscriptSnapshot;
}

function createTranscriber(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields, tool?: ToolInvocation) {
		const result = await transcribe(runtime.request(await runtime.prepare(raw, tool)) as Settings);
		if (!tool) return result;
		const { text, segments, language, durationInSeconds } = result;
		return { text, segments, language, durationInSeconds };
	}
	return runtime.callable(invoke,
		args => runtime.arguments(args).done(),
		({ output }) => ({ type: 'text', value: (output as { text: string }).text }));
}

type Factory = import('./component-factory.js').SourceFactory<'Transcriber'>;
export const Transcriber = createComponentFactory(definition, createTranscriber) as Factory;
