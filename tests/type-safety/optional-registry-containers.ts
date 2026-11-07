import { create, z } from 'casai';
import type { EmbeddingModel, LanguageModel, Experimental_RealtimeModel } from 'ai';
import { expectEqual } from './assert.js';

declare const enabled: boolean;
declare const model: LanguageModel;
declare const embedding: EmbeddingModel;
declare const realtime: Experimental_RealtimeModel;
const helper = create.Function.asTool({ inputSchema: z.object({}), execute: () => 1 });
const optionalTools = enabled ? { helper } : undefined;
const optionalSettings = enabled ? { tools: { helper } } : {};

// Optional containers retain absence in inferred callback context, not only final validation.
create.Function({ tools: optionalTools, execute: ({ helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	// @ts-expect-error The complete registry can be absent.
	void helper({});
	return helper?.({});
} });
create.Function({ ...optionalSettings, execute: ({ helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	return helper?.({});
} });
create.Config({ inputSchema: z.object({}), tools: optionalTools, execute: ({ helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	expectEqual<Awaited<ReturnType<NonNullable<typeof helper>>>, number>();
	// @ts-expect-error The complete registry can be absent.
	void helper({});
	// @ts-expect-error Optional helpers retain their closed input contract.
	void helper?.({ extra: true });
	return helper?.({});
} });
create.Config({ inputSchema: z.object({}), ...optionalSettings, execute: ({ helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	expectEqual<Awaited<ReturnType<NonNullable<typeof helper>>>, number>();
	// @ts-expect-error A conditional spread may omit the complete registry.
	void helper({});
	// @ts-expect-error Optional helpers retain their closed input contract.
	void helper?.({ extra: true });
	return helper?.({});
} });
create.LLMAgent.withFunction({ model, inputSchema: z.object({}), tools: optionalTools, prompt: async ({ helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	expectEqual<Awaited<ReturnType<NonNullable<typeof helper>>>, number>();
	// @ts-expect-error The complete registry can be absent.
	void helper({});
	// @ts-expect-error Optional helpers retain their closed input contract.
	void helper?.({ extra: true });
	return String(await helper?.({}));
} });
create.LLMAgent.withFunction({ model, inputSchema: z.object({}), ...optionalSettings, prompt: async ({ helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	expectEqual<Awaited<ReturnType<NonNullable<typeof helper>>>, number>();
	// @ts-expect-error A conditional spread may omit the complete registry.
	void helper({});
	// @ts-expect-error Optional helpers retain their closed input contract.
	void helper?.({ extra: true });
	return String(await helper?.({}));
} });
create.Embedder.withFunction({ model: embedding, inputSchema: z.object({}), tools: optionalTools, input: async ({ helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	expectEqual<Awaited<ReturnType<NonNullable<typeof helper>>>, number>();
	// @ts-expect-error The complete registry can be absent.
	void helper({});
	// @ts-expect-error Optional helpers retain their closed input contract.
	void helper?.({ extra: true });
	return String(await helper?.({}));
} });
create.Embedder.withFunction({ model: embedding, inputSchema: z.object({}), ...optionalSettings, input: async ({ helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	expectEqual<Awaited<ReturnType<NonNullable<typeof helper>>>, number>();
	// @ts-expect-error A conditional spread may omit the complete registry.
	void helper({});
	// @ts-expect-error Optional helpers retain their closed input contract.
	void helper?.({ extra: true });
	return String(await helper?.({}));
} });

// Definite maps and ordinary inheritance keep definite helpers.
const parent = create.Config({ tools: { helper } });
create.Function({ tools: undefined, execute: ({ helper }) => helper({}) }, parent);
create.Function({ tools: optionalTools, execute: ({ helper }) => helper({}) }, parent);
create.Embedder.withFunction({ model: embedding, tools: undefined, input: async ({ helper }) => String(await helper({})) }, parent);
create.LLMAgent.withFunction({ model, tools: undefined, prompt: async ({ helper }) => String(await helper({})) }, parent);
create.Config({ tools: undefined, execute: ({ helper }) => helper({}) }, parent);
declare const optionalParent: { tools?: { helper: typeof helper } };
create.Function({ execute: ({ helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	return helper?.({});
} }, { config: optionalParent });

const secured = create.Function.asTool({ inputSchema: z.object({}), toolContextSchema: z.object({ tenant: z.string() }), execute: ({ tenant }) => tenant });
declare const optionalContext: { toolsContext?: { secured: { tenant: string } } };
declare const maybeContext: { secured: { tenant: string } } | undefined;
// @ts-expect-error An optional map cannot satisfy a required bound context.
create.Function({ tools: { secured }, toolsContext: maybeContext, execute: () => 1 });
// @ts-expect-error Inherited optional maps retain the same requirement.
create.Function({ tools: { secured }, execute: () => 1 }, { config: optionalContext });
// @ts-expect-error Renderers check every required context too.
create.Template({ template: 'ready', tools: { secured } }, { config: optionalContext });
// @ts-expect-error Scripts check every required context too.
create.Script({ script: 'return 1', tools: { secured } }, { config: optionalContext });
// @ts-expect-error Native agents cannot omit required bound context.
create.LLMAgent({ model, tools: { secured } }, { config: optionalContext });
// @ts-expect-error Specialized components use the shared registry requirement.
create.Embedder({ model: embedding, tools: { secured } }, { config: optionalContext });
// @ts-expect-error Supplementary voice methods need a complete registry.
create.VoiceSessionSetup({ model: realtime, tools: { secured } }, { config: optionalContext });
create.Config({ tools: { secured }, toolsContext: maybeContext });
create.Function({ tools: { secured }, toolsContext: { secured: { tenant: 'child' } }, execute: () => 1 }, { config: optionalContext });
const boundParent = create.Config({ tools: { secured }, toolsContext: { secured: { tenant: 'parent' } } });
create.Function({ toolsContext: undefined, execute: () => 1 }, boundParent);
create.Function({ toolsContext: maybeContext, execute: () => 1 }, boundParent);

// A possible binding supplies public defaults only when it actually exists.
const withDefault = create.Function.asTool({ inputSchema: z.object({ value: z.number() }), execute: ({ value }) => value });
const optionalDefaults = enabled ? { withDefault: { value: 2 } } : undefined;
create.Function({ tools: { withDefault }, toolsContext: optionalDefaults, execute: ({ withDefault }) => {
	// @ts-expect-error An absent binding cannot guarantee its public default.
	void withDefault();
	return withDefault({ value: 3 });
} });
create.Function({ tools: { withDefault }, toolsContext: { withDefault: { value: 2 } }, execute: ({ withDefault }) => withDefault() });

// Complete configuration alternatives keep each tool paired with its context.
declare const paired: { tools: { secured: typeof secured }; toolsContext: { secured: { tenant: string } } } | { tools: { helper: typeof helper } };
create.Function({ execute: () => 1 }, { config: paired });
create.LLMAgent({ model }, { config: paired });

// Missing keys in nested merged maps remain readable without erasing definite parent bindings.
const contextParent = create.Config({ context: { base: 1 } });
const contextChild = create.Config({ context: enabled ? { extra: 'new' } : undefined }, contextParent);
create.Function({ execute: ({ base: _base, extra }) => {
	expectEqual<typeof _base, number>();
	expectEqual<typeof extra, string | undefined>();
	return extra;
} }, contextChild);
const registryParent = create.Config({ tools: { always: helper } });
create.Function({ inputSchema: z.object({}), tools: optionalTools, execute: ({ always, helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	expectEqual<Awaited<ReturnType<NonNullable<typeof helper>>>, number>();
	void always({});
	// @ts-expect-error The optional helper retains its closed public input contract.
	void helper?.({ extra: true });
	return helper?.({});
} }, registryParent);
const _ownUndefined = create.Config({ context: { base: undefined } }, contextParent);
expectEqual<typeof _ownUndefined.config.context.base, undefined>();
const _disabledTool = create.Config({ tools: { helper: undefined } }, parent);
expectEqual<typeof _disabledTool.config.tools.helper, undefined>();
// @ts-expect-error Replacing an entry with undefined cannot satisfy its required tool context.
create.Function({ toolsContext: { secured: undefined }, execute: () => 1 }, boundParent);

declare const alternativeTools: { left: typeof helper } | { right: typeof helper };
create.Function({ inputSchema: z.object({}), tools: alternativeTools, execute: ({ left, right }) => {
	expectEqual<undefined extends typeof left ? true : false, true>();
	expectEqual<undefined extends typeof right ? true : false, true>();
	expectEqual<Awaited<ReturnType<NonNullable<typeof left>>>, number>();
	// @ts-expect-error A helper absent from one alternative cannot be called unconditionally.
	void left({});
	return left?.({}) ?? right?.({});
} });
create.Function({ inputSchema: z.object({}), tools: enabled ? { helper: undefined } : undefined, execute: ({ helper }) => {
	expectEqual<undefined extends typeof helper ? true : false, true>();
	return helper?.({});
} }, parent);
