// Internal implementation assertion; public SDK ownership checks live in type-safety/sdk-type-ownership.ts.
import type { AgentFactoryShape } from '../src/types/agent.js';
import type { FunctionConfigShape, ScriptConfig, TemplateConfig } from '../src/types/config.js';
import type { PromptType } from '../src/types/prompt.js';
import type { GenerateRequest, StreamRequest } from '../src/types/sdk.js';
import type { observers, aliases, retiredSettings, streamingSettings, fixedSettings, agentSourceConflicts } from '../src/runtime/agent-settings-policy.js';
import type { componentSettings } from '../src/runtime/llm-agent.js';
import { expectEqual } from './type-safety/assert.js';

// A new Casai-only property must be accounted for at the SDK request boundary.
type AgentSettings = keyof AgentFactoryShape<PromptType, true>;
type CasaiOnlySettings = Exclude<AgentSettings, keyof StreamRequest>;
expectEqual<Exclude<CasaiOnlySettings, typeof componentSettings[number]>, never>();
expectEqual<Exclude<typeof componentSettings[number], AgentSettings | 'messageHistory'>, never>();
expectEqual<Exclude<typeof fixedSettings[number], AgentSettings>, never>();

// Every native event callback needs an observer, alias or editable-error policy.
type NativeObservers = Extract<keyof StreamRequest, `on${string}` | `experimental_on${string}`>;
type ObserverAliases = typeof aliases[keyof typeof aliases];
expectEqual<typeof observers[number] | ObserverAliases | 'onError', NativeObservers>();

// New stream-only SDK settings need dispatch handling; retired ones remain rejected.
type StreamingSettings = Exclude<keyof StreamRequest, keyof GenerateRequest | typeof retiredSettings[number]>;
expectEqual<typeof streamingSettings[number], StreamingSettings>();

// New settings belonging only to coded components must stay out of agent configuration.
type CodedSettings = keyof FunctionConfigShape | keyof TemplateConfig<Record<string, unknown>> | keyof ScriptConfig<Record<string, unknown>, unknown>;
expectEqual<typeof agentSourceConflicts[number], Exclude<CodedSettings, AgentSettings>>();
