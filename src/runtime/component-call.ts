import { sourceMode } from '../config/source-mode.js';
import type { Tool } from 'ai';
import type { ComponentDefinition } from '../factories/component-factory.js';
import type { PromptType } from '../types/prompt.js';
import type { CascadaConfig } from '../types/config.js';
import type { Fields } from '../types/utils.js';
import type { ExecutionConfig, ToolInvocation } from '../types/execution.js';
import type { SchemaType } from '../types/schema.js';
import { ValidationError } from '../errors.js';
import { createSourceRenderer } from '../renderers/prompt-renderers.js';
import { mergeConfigs } from '../config/config-utils.js';
import { defineTool, definedSettings, descriptorKeys, invocationKeys, isContextArgument, namedArguments, prepareExecution, runSettings } from './execution.js';

export type RuntimeComponentConfig = ExecutionConfig & CascadaConfig & Fields & { [sourceMode]?: PromptType };
type InvokeComponent = (settings: Fields, tool?: ToolInvocation) => Promise<unknown>;

const configurationKeys = ['inputSchema', 'toolContextSchema', 'tools', 'asTool', 'debug', 'promptType', sourceMode, 'loader', 'filters', 'renderOptions',
	...descriptorKeys.filter(key => key !== 'providerOptions')];

/** Read the common source/context prefix. Components identify their own extra source forms. */
function sourceArguments(args: readonly unknown[], mode: PromptType, { name, main }: Pick<ComponentDefinition<Fields>, 'name' | 'main'>, forms: {
	literal?: (first: unknown) => boolean;
	prepared?: (values: unknown[]) => boolean;
	objectSource?: boolean;
} = {}, tool = false) {
	const { values, keywords } = namedArguments(args, forms.objectSource);
	const settings: Fields = {};
	if (mode === 'text' && !tool) {
		if (keywords) throw new ValidationError('Use .run() for named operation arguments.');
		if (forms.literal?.(values[0]) ?? true) settings[main] = values.shift();
	} else {
		const first = values[0];
		const source = mode === 'text'
			? (forms.literal?.(first) ?? true) && first !== undefined && !isContextArgument(first)
			: typeof first === 'string' && mode !== 'function' || typeof first === 'function' || forms.prepared?.(values);
		if (source
			|| first === undefined && values.length > 1) settings[main] = values.shift();
		if (keywords) settings.context = values.pop();
		else if (isContextArgument(values[0]) || values[0] === undefined) settings.context = values.shift();
	}
	return {
		take(key: string, matches: (value: unknown) => boolean) {
			if (values[0] === undefined || matches(values[0])) settings[key] = values.shift();
		},
		done() {
			if (values.some(value => value !== undefined)) throw new ValidationError(`Unexpected ${name} arguments. Use .run() for named settings.`);
			return settings;
		},
	};
}

export interface PreparedComponentCall extends ToolInvocation {
	supplied: Fields;
	settings: RuntimeComponentConfig;
}

/** Bind the component's construction facts for all invocation paths. */
export function createComponentRuntime(config: RuntimeComponentConfig, definition: ComponentDefinition<Fields>, render = createSourceRenderer(config, config[definition.main], definition.structured)) {
	const { main } = definition;
	const toolInputField = config[sourceMode] === 'text' && config.asTool ? main : undefined;
	const runKeys = definition.keys && [...definition.keys.filter(key => !definition.fixedSettings?.includes(key)), ...invocationKeys];
	function readRun(args: readonly unknown[]) {
		const settings = runSettings(args, runKeys);
		const fixed = [...configurationKeys, ...definition.fixedSettings ?? []].filter(key => Object.hasOwn(settings, key));
		if (fixed.length) throw new ValidationError(`Configuration-only settings: ${fixed.map(String).join(', ')}.`);
		return settings;
	}
	return {
		async prepare(raw: Fields, tool?: ToolInvocation): Promise<PreparedComponentCall> {
			(raw.abortSignal as AbortSignal | undefined)?.throwIfAborted();
			const supplied = definedSettings(raw);
			const settings = mergeConfigs(config, supplied, ValidationError) as RuntimeComponentConfig;
			const options = raw.abortSignal === undefined ? {} : { abortSignal: raw.abortSignal as AbortSignal };
			const prepared = tool ?? await prepareExecution(config, supplied.context, options, supplied.toolsContext as Fields | undefined, toolInputField);
			const publicInput = toolInputField !== undefined && prepared.inputNames.has(toolInputField);
			const source = supplied[main] ?? (publicInput ? prepared.input[main] : undefined);
			settings[main] = await render(source, prepared.context);
			return { supplied, settings, ...prepared };
		},
		runSettings: readRun,
		arguments: (args: readonly unknown[], forms?: Parameters<typeof sourceArguments>[3]) => sourceArguments(args, config[sourceMode]!, definition, forms, config.asTool),
		request(prepared: PreparedComponentCall, omit: readonly string[] = []): Fields {
			const request: Fields = { ...prepared.settings, abortSignal: prepared.context._toolOptions.abortSignal };
			for (const key of [...configurationKeys, 'context', 'toolsContext', ...omit]) Reflect.deleteProperty(request, key);
			prepared.context._toolOptions.abortSignal?.throwIfAborted();
			return request;
		},
		callable(invoke: InvokeComponent, callSettings: (args: readonly unknown[]) => Fields, toModelOutput?: Tool['toModelOutput']) {
			const component = Object.assign(async (...args: unknown[]) => invoke(callSettings(args)), {
				config, run: async (...args: unknown[]) => invoke(readRun(args)),
			});
			const { providerOptions: _innerProviderOptions, ...innerDescriptor } = config;
			// SDK-backed components own inner request options; coded tools expose descriptor options.
			const descriptor = definition.keys ? { ...config } : innerDescriptor;
			if (descriptor.toModelOutput === undefined && toModelOutput !== undefined) descriptor.toModelOutput = toModelOutput;
			return config.asTool ? defineTool(component, prepared => invoke({}, prepared), config.schema as SchemaType<unknown> | undefined, descriptor, toolInputField) : component;
		},
	};
}
