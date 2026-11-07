import { create, z } from 'casai';
import { tool, ToolLoopAgent } from 'ai';
import type { EmbeddingModel, Experimental_RealtimeModel, LanguageModel, ToolSet } from 'ai';
import { expectEqual } from './assert.js';

declare const model: LanguageModel;
declare const embedding: EmbeddingModel;
declare const realtime: Experimental_RealtimeModel;
declare const annotated: ToolSet;
declare const nativeDeferred: Extract<ToolSet[string], { outputSchema?: undefined }>;

// Native ToolSet includes no-output and no-input variants beyond default Tool.
// Use native-admitted literals so SDK tool-factory limitations do not mask this contract.
const deferred = { inputSchema: z.object({ query: z.string() }) };
const terminal = { inputSchema: z.object({ query: z.string() }), execute: () => { throw new Error('terminal'); } };
const executable = tool({ inputSchema: z.object({ query: z.string() }), execute: ({ query }) => query.length });
const registry = { deferred, terminal, executable };
new ToolLoopAgent({ model, tools: registry });
new ToolLoopAgent({ model, tools: annotated });
new ToolLoopAgent({ model, tools: { nativeDeferred } });

create.Config({ tools: annotated });
create.Function({ tools: annotated, execute: () => 1 });
create.Template({ template: 'ready', tools: annotated });
create.Script({ script: 'return 1', tools: annotated });
create.Embedder({ model: embedding, tools: annotated });
create.VoiceSessionSetup({ model: realtime, tools: annotated });
const annotatedAgent = create.LLMAgent({ model, tools: annotated });
expectEqual<typeof annotatedAgent.tools, ToolSet>();
void annotatedAgent.run({ tools: annotated, prompt: 'ready' });
const deferredAgent = create.LLMAgent({ model, tools: { nativeDeferred }, prepareCall: request => {
	const _nativeContext = request.toolsContext?.nativeDeferred;
	return request;
} });
expectEqual<typeof deferredAgent.tools.nativeDeferred, typeof nativeDeferred>();
void deferredAgent.run({ tools: { nativeDeferred }, prompt: 'ready' });

const agent = create.LLMAgent({ model, tools: registry });
expectEqual<typeof agent.tools.deferred, typeof deferred>();
void agent.run({ tools: registry, toolChoice: { type: 'tool', toolName: 'deferred' }, prompt: 'ready' });
create.Function({ tools: registry, inputSchema: z.object({}), execute: ({ terminal, executable }) => {
	expectEqual<Awaited<ReturnType<typeof executable>>, number>();
	void executable({ query: 'ready' });
	// @ts-expect-error Native helpers retain their declared input.
	void executable({ query: 1 });
	return terminal({ query: 'ready' });
} });
