import type { PromptType } from '../types/prompt.js';
import type { ConfigValue, RuntimeContextFromConfig } from '../types/config.js';
import type { StandardComponent } from '../types/component.js';
import { experimental_decide } from 'ai';
import { createComponentFactory, textModifiers, textModes } from './component-factory.js';
import { createComponentRuntime } from '../runtime/component-call.js';
import type { RuntimeComponentConfig } from '../runtime/component-call.js';
import type { ToolInvocation } from '../types/execution.js';
import type { Fields } from '../types/utils.js';

type Settings<Runtime extends Record<string, unknown> = Record<string, unknown>> = Omit<Parameters<typeof experimental_decide<Parameters<typeof experimental_decide>[0]['questions'], Runtime>>[0], '_internal'>;
export const definition = {
	name: 'Decision', defaultMode: 'text', main: 'state', structured: 'parts', modifiers: textModifiers, toolModes: textModes, required: ['model', 'questions'], fixedSettings: ['questions'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;

type Result<T> = import('ai').Experimental_DecisionResult<Extract<ConfigValue<T, 'questions'>, Record<string, import('ai').Experimental_DecisionQuestion>>>;

export interface Types<P extends PromptType, T, A extends boolean> {
	definition: typeof definition;
	settings: Settings<RuntimeContextFromConfig<T>>;
	templateInput: Extract<Settings['state'], string | readonly unknown[]>;
	component: StandardComponent<'Decision', P, T, A>;
	result: Result<T>;
	toolResult: Result<T>['answers'];
}

function createDecision(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields, tool?: ToolInvocation) {
		const result = await experimental_decide(runtime.request(await runtime.prepare(raw, tool)) as Settings);
		return tool ? result.answers : result;
	}
	return runtime.callable(invoke, args => runtime.arguments(args, {
		prepared: values => Array.isArray(values[0]),
	}).done());
}

type Factory = import('./component-factory.js').SourceFactory<'Decision'>;
/** @experimental Uses the AI SDK's experimental decision API. */
export const Decision = createComponentFactory(definition, createDecision) as Factory;
