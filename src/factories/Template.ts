import { createCodedComponent } from '../coded-component.js';
import type { EmptyMap } from '../types/utils.js';
import type { SchemaConfigInferShape, ConfigSchemas, FinalConfig, CallbackParent, ToolMode, ToolModeConfig, SourceModeConfig } from '../types/factory-config.js';
import type { ComponentToolFromConfig } from '../types/tool-binding.js';
import type { TemplatePromptType, PromptType } from '../types/prompt.js';
import type { ToolConfigShape, TemplateConfig, ToolContextSchemaConfig } from '../types/config.js';
import type { DescriptorInput } from '../types/callbacks.js';
import type { ComponentRun, SourceSetting, RendererCall } from '../types/input.js';
import type { ValidateResolved } from '../types/provisional.js';
import type { ProcessedConfig } from '../types/merge.js';
import type { ValidateTemplateConfig, ValidateTemplateParentConfig } from '../types/config-validation.js';
import type * as configs from '../types/config.js';

type FinalTemplateConfigShape = Partial<ToolConfigShape<TemplateConfig<any> & ToolContextSchemaConfig<any>>>;

type FactoryConfig<Named extends boolean, AsTool extends boolean> =
	(AsTool extends true ? configs.TemplateToolConfig<Record<string, any>> : configs.TemplateConfig<Record<string, any>>) & (Named extends true ? configs.LoaderConfig : EmptyMap);

type TemplateCallSignature<TConfig> = RendererCall<TConfig, Promise<string>, 'template'> & {
	config: ProcessedConfig<TConfig>;
	type: string;
	run: ComponentRun<TConfig, string, SourceSetting<TConfig, 'template'>>;
};

type TemplateFactory<Source extends TemplatePromptType | undefined = undefined, AsTool extends boolean = false> = <
	TConfig extends object & configs.ToolConfigInferShape<FactoryConfig<false, AsTool>>,
	TParentConfig extends object & NoInfer<Omit<configs.ParentToolConfigInferShape<FactoryConfig<false, AsTool>>, 'promptType'> & { promptType?: PromptType }> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaContext = never,
	Final = SourceModeConfig<ToolModeConfig<FinalConfig<TParentConfig, TConfig>, AsTool>, Source, 'async-template'>,
	EffectiveTool extends boolean = ToolMode<Final, AsTool>,
	EffectiveShape = FactoryConfig<'async-template-name' extends configs.ConfigValue<Final, 'promptType'> ? true : false, true extends EffectiveTool ? true : false>,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, never, TSchemaContext> & TConfig
		& (true extends EffectiveTool ? DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, never, TSchemaContext>, CallbackParent<TParentConfig>, string> : unknown)
		& ValidateTemplateConfig<TConfig, Final, EffectiveShape>
		& ValidateResolved<TConfig, [Final] extends [FinalTemplateConfigShape]
			? unknown : 'Config Error: Invalid template settings.'>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ValidateTemplateParentConfig<TParentConfig, FactoryConfig<false, true>>>]
) => TemplateCallSignature<Final>
	& (EffectiveTool extends true ? ComponentToolFromConfig<Record<string, any>, string, Final> : unknown);

function factory(promptType?: TemplatePromptType, asTool = false) {
	return (config: Partial<configs.TemplateConfig<any>>, parent?: configs.ConfigProvider<any>) =>
		createCodedComponent('Template', config, parent, promptType, asTool);
}

const inline = Object.assign(factory('async-template'), { asTool: factory('async-template', true) }) as TemplateFactory<'async-template'> & { asTool: TemplateFactory<'async-template', true> };
const loaded = Object.assign(factory('async-template-name'), { asTool: factory('async-template-name', true) }) as TemplateFactory<'async-template-name'> & { asTool: TemplateFactory<'async-template-name', true> };
export const Template = Object.assign(factory() as TemplateFactory, {
	withTemplate: inline, loadsTemplate: loaded, asTool: factory(undefined, true) as TemplateFactory<undefined, true>,
});
