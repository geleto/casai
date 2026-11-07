import type { PromptType } from '../types/prompt.js';
import type { ConfigValue, RuntimeContextFromConfig } from '../types/config.js';
import type { OptionalUndefined } from '../types/utils.js';
import type { ConfigForMode } from '../types/factory-config.js';
import type { CallableComponent, Source, SourceArguments, SourceSettings, BaseRunSettings, Configured, ConfiguredOutput, RunInput } from '../types/component.js';
import type { PreparedSourceArguments } from '../types/input.js';
import { rerank } from 'ai';
import { createComponentFactory, textModifiers, textModes } from './component-factory.js';
import { createComponentRuntime } from '../runtime/component-call.js';
import type { RuntimeComponentConfig } from '../runtime/component-call.js';
import type { ToolInvocation } from '../types/execution.js';
import type { Fields } from '../types/utils.js';
import { isPlainObject } from '../schema.js';

type Settings<Runtime extends Record<string, unknown> = Record<string, unknown>> = Omit<Parameters<typeof rerank<Parameters<typeof rerank>[0]['documents'][number], Runtime>>[0], '_internal'>;
export const definition = {
	name: 'Reranker', defaultMode: 'text', main: 'query', modifiers: textModifiers, toolModes: textModes, required: ['model'],
} as const satisfies import('./component-factory.js').ComponentDefinition<Settings>;

type QueryDocuments = Pick<Settings, 'query' | 'documents'>;
type Document<T> = T extends (infer D)[] ? D : never;
type RankedDocument<T, I, D> = Extract<Document<Exclude<D, undefined> | (undefined extends D ? I extends QueryDocuments ? I['documents'] : ConfigValue<T, 'documents'> : never)>, Settings['documents'][number]>;
type CallDocuments<Call> = Call extends unknown[]
	// Actual calls infer finite tuples; reflection retains the general document contract.
	? number extends Call['length'] ? Settings['documents'] | undefined
	: Call extends [unknown?, ...infer Rest]
		? Extract<Call[0], unknown[]> | (Exclude<Call[0], unknown[]> extends never ? never : Rest extends [] ? undefined : CallDocuments<Rest>)
		: undefined
	: ConfigValue<Call, 'documents'>;
type Result<T, I, Call = undefined> = import('ai').RerankResult<RankedDocument<T, I, CallDocuments<Call>>>;
// Script results remain runtime-owned; typed producers must supply documents on every branch.
type NeedsDocuments<P extends PromptType, T, Input> = Configured<T, 'documents'> extends true ? false
	: P extends 'async-script' | 'async-script-name' ? false : [Input] extends [QueryDocuments] ? false : true;
type CheckDocuments<P extends PromptType, T, Input, Documents> = NeedsDocuments<P, T, Input> extends false ? unknown
	: undefined extends Documents ? 'A query string requires documents.' : unknown;
type DocumentsArguments<P extends PromptType, T, Input> = OptionalUndefined<NeedsDocuments<P, T, Input> extends true
	? [documents: Settings['documents'], topN?: number]
	: [documents?: Settings['documents'], topN?: number] | [topN?: number]>;
type Arguments<P extends PromptType, T> = SourceArguments<'Reranker', P, T,
	DocumentsArguments<P, T, string>, Configured<T, 'query'>, DocumentsArguments<P, T, ConfiguredOutput<'Reranker', P, T>>>
	| (P extends 'function' ? PreparedSourceArguments<T, (...args: Parameters<Source<'Reranker', 'function', T>>) => QueryDocuments | PromiseLike<QueryDocuments>, false, DocumentsArguments<P, T, QueryDocuments>> : never);
type RunSettings<P extends PromptType, T> = BaseRunSettings<'Reranker', T, SourceSettings<'Reranker', P, T>
	& { documents?: Settings['documents'] }>;
export interface Calls<P extends PromptType, T> { arguments: Arguments<P, T>; settings: RunSettings<P, T> }

export interface Types<P extends PromptType, T, A extends boolean, Input, Call> {
	definition: typeof definition;
	settings: Settings<RuntimeContextFromConfig<T>>;
	preparedInput: string | QueryDocuments;
	component: CallableComponent<'Reranker', P, T, A, { [M in P]: Calls<M, ConfigForMode<T, M, P>> }>;
	result: Result<T, Input, Call>;
	toolResult: Result<T, Input>['ranking'];
	runCheck: CheckDocuments<P, T, RunInput<'Reranker', P, T, Call>, ConfigValue<Call, 'documents'>>;
	toolRequired: NeedsDocuments<P, T, ConfiguredOutput<'Reranker', P, T>> extends true ? 'documents' : never;
}

function createReranker(config: RuntimeComponentConfig) {
	const runtime = createComponentRuntime(config, definition);
	async function invoke(raw: Fields, tool?: ToolInvocation) {
		const prepared = await runtime.prepare(raw, tool);
		const query = prepared.settings.query;
		if (isPlainObject(query)) {
			prepared.settings.documents = prepared.supplied.documents ?? query.documents ?? prepared.settings.documents;
			prepared.settings.query = query.query;
		}
		const result = await rerank(runtime.request(prepared) as Settings);
		return tool ? result.ranking : result;
	}
	return runtime.callable(invoke, args => {
		const call = runtime.arguments(args, { literal: first => !Array.isArray(first) && typeof first !== 'number' });
		call.take('documents', Array.isArray);
		call.take('topN', value => typeof value === 'number');
		return call.done();
	});
}

type Factory = import('./component-factory.js').SourceFactory<'Reranker'>;
export const Reranker = createComponentFactory(definition, createReranker) as Factory;
