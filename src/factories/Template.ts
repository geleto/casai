import { createCodedComponent } from '../runtime/coded-component.js';
import { createComponentFactory } from './component-factory.js';
import type { TemplateConfig } from '../types/config.js';
import type { RendererComponent } from '../types/component.js';
import type * as configs from '../types/config.js';

export const definition = {
	name: 'Template', main: 'template', defaultMode: 'async-template',
	modifiers: { withTemplate: 'async-template', loadsTemplate: 'async-template-name' },
	toolModes: ['async-template', 'async-template-name'], required: [], inlineRequired: ['template'], keys: ['template'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;
type Settings = configs.TemplateSettings<Record<string, any>>;

type Factory = import('./component-factory.js').RendererFactory<'Template'>;
export const Template = createComponentFactory(definition, createCodedComponent) as Factory;

export interface Types<T, A extends boolean, Input> {
	definition: typeof definition;
	settings: Settings;
	component: RendererComponent<'Template', T, A>;
	config: TemplateConfig<Record<string, any>>;
	configShape: configs.TemplateSettings<Extract<Input, Record<string, any>>> | configs.TemplateToolSettings<Extract<Input, Record<string, any>>>;
	result: string;
	toolResult: string;
}
