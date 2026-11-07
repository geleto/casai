import { createCodedComponent } from '../runtime/coded-component.js';
import { createComponentFactory } from './component-factory.js';
import type { InferSchema } from '../types/schema.js';
import type { ScriptConfig } from '../types/config.js';
import type { RendererComponent } from '../types/component.js';
import type { CollectedResult } from '../types/result.js';
import type * as configs from '../types/config.js';
import type * as results from '../types/result.js';

export const definition = {
	name: 'Script', main: 'script', defaultMode: 'async-script',
	modifiers: { withScript: 'async-script', loadsScript: 'async-script-name' },
	toolModes: ['async-script', 'async-script-name'], required: [], inlineRequired: ['script'], fixedSettings: ['schema'], keys: ['script', 'schema'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;
type Settings = ScriptConfig<Record<string, any>, unknown>;

type Factory = import('./component-factory.js').RendererFactory<'Script'>;
export const Script = createComponentFactory(definition, createCodedComponent) as Factory;

export interface Types<T, A extends boolean, Input, Output> {
	definition: typeof definition;
	settings: Settings;
	component: RendererComponent<'Script', T, A>;
	config: Settings;
	configShape: configs.ScriptConfig<Extract<Input, Record<string, any>>, Output> | configs.ScriptToolConfig<Extract<Input, Record<string, any>>, Output>;
	result: T extends { schema: infer Schema } ? InferSchema<Schema> : results.ScriptResult;
	toolResult: CollectedResult<T>;
}
