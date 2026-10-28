import { createCodedComponent } from '../runtime/coded-component.js';
import type { InferSchema } from '../types/schema.js';
import type { EmptyMap } from '../types/utils.js';
import type { SchemaConfigInferShape, ConfigSchemas, FinalConfig, CallbackParent, ToolMode, ToolModeConfig, SourceModeConfig } from '../types/factory-config.js';
import type { ComponentToolFromConfig } from '../types/tool-binding.js';
import type { ScriptPromptType, PromptType } from '../types/prompt.js';
import type { ToolConfigShape, ScriptConfig, ToolContextSchemaConfig } from '../types/config.js';
import type { DescriptorInput } from '../types/callbacks.js';
import type { ComponentRun, SourceSetting, RendererCall } from '../types/input.js';
import type { ValidateResolved } from '../types/provisional.js';
import type { ProcessedConfig } from '../types/merge.js';
import type { ValidateScriptConfig, ValidateScriptParentConfig } from '../types/config-validation.js';
import type { CollectedResult } from '../types/result.js';
import type * as configs from '../types/config.js';
import type * as results from '../types/result.js';

type FinalScriptConfigShape = Partial<ToolConfigShape<ScriptConfig<any, any> & ToolContextSchemaConfig<any>>>;

type ScriptOutput<TConfig> = TConfig extends { schema: infer Schema } ? InferSchema<Schema> : results.ScriptResult;

type FactoryConfig<Named extends boolean, AsTool extends boolean> =
	(AsTool extends true ? configs.ScriptToolConfig<Record<string, any>, unknown> : configs.ScriptConfig<Record<string, any>, unknown>) & (Named extends true ? configs.LoaderConfig : EmptyMap);

type ScriptCallSignature<TConfig> = RendererCall<TConfig, Promise<ScriptOutput<TConfig>>, 'script'> & {
	config: ProcessedConfig<TConfig>;
	type: string;
	run: ComponentRun<TConfig, ScriptOutput<TConfig>, SourceSetting<TConfig, 'script'>>;
};

type ScriptFactory<Source extends ScriptPromptType | undefined = undefined, AsTool extends boolean = false> = <
	TConfig extends object & configs.ToolConfigInferShape<FactoryConfig<false, AsTool>>,
	TParentConfig extends object & NoInfer<Omit<configs.ParentToolConfigInferShape<FactoryConfig<false, AsTool>>, 'promptType'> & { promptType?: PromptType }> = never,

	TSchemaPresence extends object = object,
	TSchemaInput = never,
	TSchemaOutput = never,
	TSchemaContext = never,
	Final = SourceModeConfig<ToolModeConfig<FinalConfig<TParentConfig, TConfig>, AsTool>, Source, 'async-script'>,
	EffectiveTool extends boolean = ToolMode<Final, AsTool>,
	EffectiveShape = FactoryConfig<'async-script-name' extends configs.ConfigValue<Final, 'promptType'> ? true : false, true extends EffectiveTool ? true : false>,
>(
	config: SchemaConfigInferShape<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext> & TConfig
		& (true extends EffectiveTool ? DescriptorInput<ConfigSchemas<TSchemaPresence, TSchemaInput, TSchemaOutput, TSchemaContext>, CallbackParent<TParentConfig>> : unknown)
		& ValidateScriptConfig<TConfig, Final, EffectiveShape>
		& ValidateResolved<TConfig, [Final] extends [FinalScriptConfigShape]
			? unknown : 'Config Error: Invalid script settings.'>,
	...parent: [TParentConfig] extends [never] ? [] : [parent: configs.ConfigProvider<TParentConfig
		& ValidateScriptParentConfig<TParentConfig, FactoryConfig<false, true>>>]
) => ScriptCallSignature<Final>
	& (EffectiveTool extends true ? ComponentToolFromConfig<Record<string, any>, CollectedResult<Final>, Final> : unknown);

function factory(promptType?: ScriptPromptType, asTool = false) {
	return (config: Partial<configs.ScriptConfig<any, any>>, parent?: configs.ConfigProvider<any>) =>
		createCodedComponent('Script', config, parent, promptType, asTool);
}

const inline = Object.assign(factory('async-script'), { asTool: factory('async-script', true) }) as ScriptFactory<'async-script'> & { asTool: ScriptFactory<'async-script', true> };
const loaded = Object.assign(factory('async-script-name'), { asTool: factory('async-script-name', true) }) as ScriptFactory<'async-script-name'> & { asTool: ScriptFactory<'async-script-name', true> };
export const Script = Object.assign(factory() as ScriptFactory, {
	withScript: inline, loadsScript: loaded, asTool: factory(undefined, true) as ScriptFactory<undefined, true>,
	loadsScriptAsTool: loaded.asTool,
});
