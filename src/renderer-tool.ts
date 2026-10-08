import type { Tool, ToolExecutionOptions } from 'ai';
import type { ContextSchemaConfig, ToolContextFromConfig } from './types/config.js';
import type { ComponentToolFromConfig } from './types/result.js';
import type { Context, SchemaType } from './types/types.js';

// AI SDK tool properties exposed on components created with .asTool().
const rendererToolKeys = ['description', 'inputSchema', 'contextSchema'] as const satisfies readonly (keyof Tool)[];

// Shared .asTool() adapter for Template, Script, TextGenerator, and ObjectGenerator.
// Adds the AI SDK execute wrapper and exposes execution options as _toolCallOptions during rendering.
export function attachRendererTool<
	INPUT extends Context,
	OUTPUT,
	TConfig extends ContextSchemaConfig & { description?: string, inputSchema?: SchemaType<any> },
	TRenderer extends { config: TConfig },
>(
	renderer: TRenderer & { config: TConfig },
	render: (context: INPUT & { _toolCallOptions: ToolExecutionOptions<ToolContextFromConfig<TConfig>> }) => PromiseLike<OUTPUT>,
): TRenderer & ComponentToolFromConfig<INPUT, OUTPUT, TConfig> {
	type RendererTool = ComponentToolFromConfig<INPUT, OUTPUT, TConfig>;
	const properties = Object.fromEntries(rendererToolKeys.map(key => [key, renderer.config[key]])) as
		Pick<RendererTool, typeof rendererToolKeys[number]>;
	return Object.assign(renderer, properties, {
		type: 'function' as const,
		execute: async (input: INPUT, options: ToolExecutionOptions<ToolContextFromConfig<TConfig>>) =>
			await render({ ...input, _toolCallOptions: options }),
	});
}
