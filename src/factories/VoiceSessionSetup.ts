import type { PromptType } from '../types/prompt.js';
import type { ToolRegistryFromConfig } from '../types/config.js';
import type { ToolContexts } from '../types/tool-binding.js';
import type { ValidateToolsContext } from '../types/config-validation.js';
import type { MergedConfig } from '../types/merge.js';
import type { CommonInputs, ComponentRun } from '../types/input.js';
import type { ConfigForMode } from '../types/factory-config.js';
import type { CallableComponent, SourceArguments, SourceSettings, BaseRunSettings, Configured } from '../types/component.js';
import { experimental_getRealtimeToolDefinitions, UnsupportedFunctionalityError } from 'ai';
import type { Experimental_RealtimeSessionConfig, Experimental_RealtimeModel } from 'ai';
import { createComponentFactory, textModifiers } from './component-factory.js';
import { createComponentRuntime } from '../runtime/component-call.js';
import type { RuntimeComponentConfig } from '../runtime/component-call.js';
import type { Fields } from '../types/utils.js';
import type { PreparedToolRegistry } from '../types/execution.js';
import { definedSettings, prepareRegistry } from '../runtime/execution.js';

type SecretOptions = Parameters<NonNullable<Experimental_RealtimeModel['doCreateClientSecret']>>[0];
type Settings = Omit<Experimental_RealtimeSessionConfig, 'tools'> & Pick<SecretOptions, 'expiresAfterSeconds'> & { model: Experimental_RealtimeModel };
export const definition = {
	name: 'VoiceSessionSetup', defaultMode: 'text', main: 'instructions', modifiers: textModifiers, toolModes: [], required: ['model'], fixedSettings: ['model'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;

export type VoiceSetupResult = Awaited<ReturnType<NonNullable<Experimental_RealtimeModel['doCreateClientSecret']>>>
	& { tools: NonNullable<Experimental_RealtimeSessionConfig['tools']> };
type HasSource<P extends PromptType, T> = P extends 'text' ? true : Configured<T, 'instructions'>;
export interface Calls<P extends PromptType, T> {
	arguments: SourceArguments<'VoiceSessionSetup', P, T, [], HasSource<P, T>>;
	settings: BaseRunSettings<'VoiceSessionSetup', T, SourceSettings<'VoiceSessionSetup', P, T, HasSource<P, T>>>;
}
type RunSettings<P extends PromptType, T> = CommonInputs<{ [M in P]: Calls<M, ConfigForMode<T, M, P>>['settings'] }>;
export interface VoiceMethods<P extends PromptType, T> {
	prepareSessionConfig: ComponentRun<T, Experimental_RealtimeSessionConfig, RunSettings<P, T>>;
	createWebRTCSession: ComponentRun<T, Awaited<ReturnType<NonNullable<Experimental_RealtimeModel['doCreateWebRTCSession']>>>, RunSettings<P, T> & { sdp: string }>;
	executeTool<Options extends object>(
		call: { toolCallId: string; toolName: keyof ToolRegistryFromConfig<T> & string; args: unknown },
		settings?: Options & { toolsContext?: Partial<ToolContexts<ToolRegistryFromConfig<T>>>; abortSignal?: AbortSignal }
			& NoInfer<ValidateToolsContext<Options, MergedConfig<T, Options>>>,
	): Promise<unknown>;
}

async function voiceConfig(request: Fields, registry: PreparedToolRegistry): Promise<Experimental_RealtimeSessionConfig> {
	const { model: _model, expiresAfterSeconds: _expiry, ...settings } = request;
	const tools = await experimental_getRealtimeToolDefinitions({ tools: registry.tools, toolsContext: registry.toolsContext });
	return { ...definedSettings(settings), ...(tools.length ? { tools } : {}) };
}

export interface Types<P extends PromptType, T, A extends boolean> {
	definition: typeof definition;
	settings: Settings;
	component: CallableComponent<'VoiceSessionSetup', P, T, A, { [M in P]: Calls<M, ConfigForMode<T, M, P>> }> & VoiceMethods<P, T>;
	result: VoiceSetupResult;
	toolResult: never;
}

function createVoiceSessionSetup(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	const model = config.model as Experimental_RealtimeModel;
	async function session(raw: Fields) {
		const prepared = await runtime.prepare(raw);
		const request = runtime.request(prepared, ['abortSignal', 'sdp']);
		const sessionConfig = await voiceConfig(request, prepared.registry);
		prepared.context._toolOptions.abortSignal?.throwIfAborted();
		return { sessionConfig, request, context: prepared.context };
	}
	async function invoke(raw: Fields) {
		const { sessionConfig, request } = await session(raw);
		if (!model.doCreateClientSecret) throw new UnsupportedFunctionalityError({ functionality: 'realtime client secrets' });
		return { ...await model.doCreateClientSecret({ sessionConfig, ...definedSettings({ expiresAfterSeconds: request.expiresAfterSeconds }) }), tools: sessionConfig.tools ?? [] };
	}
	return Object.assign(runtime.callable(invoke,
		args => runtime.arguments(args).done()), {
		async prepareSessionConfig(...args: unknown[]) {
			return (await session(runtime.runSettings(args))).sessionConfig;
		},
		async createWebRTCSession(...args: unknown[]) {
			const raw = runtime.runSettings(args);
			const { sessionConfig, context } = await session(raw);
			if (!model.doCreateWebRTCSession) throw new UnsupportedFunctionalityError({ functionality: 'realtime WebRTC session setup' });
			return model.doCreateWebRTCSession({ sdp: raw.sdp as string, sessionConfig, abortSignal: context._toolOptions.abortSignal });
		},
		async executeTool(call: { toolCallId: string; toolName: string; args: unknown }, options: { toolsContext?: Fields; abortSignal?: AbortSignal } = {}) {
			return prepareRegistry(config, options.toolsContext).invoke(call.toolName, call.args, { toolCallId: call.toolCallId, messages: [], abortSignal: options.abortSignal });
		},
	});
}

type Factory = import('./component-factory.js').SourceFactory<'VoiceSessionSetup'>;
/** @experimental Uses the AI SDK's experimental realtime session API. */
export const VoiceSessionSetup = createComponentFactory(definition, createVoiceSessionSetup) as Factory;
