# Casai: concurrent AI workflows

Casai combines the AI SDK's model execution with Cascada's concurrent scripts and templates. Write ordinary data dependencies; Cascada starts independent work concurrently and waits where one result depends on another.

```javascript
var background = researcher({ topic: topic }).value
var analysis = analyst({ topic: topic }).value
return writer({ background: background, analysis: analysis }).value
```

The current components are `Config`, `Template`, `Script`, `Function`, and `LLMAgent`. See [README2](README2.md) for the broader API design and [the implementation plan](docs/plan.md) for future components, workflow streaming, and inherited deadlines. The newer Cascada chain-resolution compiler handoff remains an upstream dependency; passing Casai boundary tests does not establish that handoff.

## Installation

```sh
npm install casai ai zod @ai-sdk/openai
```

Use Node.js 24 or newer and TypeScript 7.0.2 or newer. Provider packages are selected by your application.

## Quick start

```typescript
import { create, z } from 'casai';
import { openai } from '@ai-sdk/openai';
import { Output } from 'ai';

const model = openai('gpt-4o-mini');
const writer = create.LLMAgent.withTemplate({
  model,
  inputSchema: z.object({ topic: z.string() }),
  prompt: 'Explain {{ topic }} briefly.',
});

const result = await writer({ topic: 'recycling' });
console.log(result.value); // string

const extract = create.LLMAgent({
  model,
  output: Output.object({ schema: z.object({ name: z.string() }) }),
});
const person = await extract('My name is Ada.');
console.log(person.value.name);
```

All components can also be imported by name, for example `import { LLMAgent, Script } from 'casai'`.

## Common component contracts

Factories accept a flat configuration object and an optional compatible parent. Components expose the resolved settings as `.config`. Ordinary calls supply input; `.run()` accepts named input and the execution overrides supported by that component. Both return promises.

| Part | Purpose |
| --- | --- |
| `context` | Application defaults and private dependencies, such as clients and helper functions |
| `inputSchema` | Public application input, parsed after configured defaults and call input are merged |
| Implementation | Template `template`, Script `script`, Function `execute`, or LLMAgent `prompt` |
| Output | Optional `schema` for Script/Function; SDK `output` for LLMAgent; implicit text for Template |
| Settings | Supported rendering, model, and tool controls |

There is no common `outputSchema` property. The setting names reflect the underlying operation.

| Component | What `await component(...)` returns |
| --- | --- |
| Template | Rendered string |
| Script / Function | Parsed `schema` output, or the program's returned value when no schema is configured |
| LLMAgent | The SDK result, augmented with `.value` and `.messageHistory`; see [results](#llmagent-results) |

Configuration is immutable by authoring contract. Derive a new component or use supported `.run()` overrides to change settings. Casai captures top-level map bindings; nested application resources can remain shared. Bodies may deliberately change authorized state. Sequence effectful Cascada calls with `!`; independent invocations require application-level coordination.

### Configuration and inheritance

```typescript
const base = create.Config({ model, temperature: 0.3 });
const writer = create.LLMAgent.withTemplate({
  prompt: 'Explain {{ topic }}.',
  inputSchema: z.object({ topic: z.string() }),
  context: { topic: 'recycling' },
}, base);
const concise = create.LLMAgent({ maxOutputTokens: 100 }, writer);
await concise(); // still renders the inherited template
```

- Ordinary properties replace inherited values. An explicit `undefined` can clear an ordinary constructor setting; omitted settings inherit.
- `context`, `filters`, `tools`, and `toolsContext` merge by key. Their entries replace rather than deep-merge. A `null` tool entry removes that tool.
- Loader chains combine, with the child's loaders taking priority. `undefined` does not remove an inherited loader chain.
- Every component inherits modifiers, including through `Config`. A base factory preserves source mode; an explicit source modifier replaces it. Use `.withText`, `.withTemplate`, or `.withScript` to select inline source where supported.
- `.asTool` and LLMAgent `.asStream` remain enabled in derived components. Their resolved metadata is `asTool: true` and `streaming: true`; there are no reverse modifiers. Unsupported inherited settings are rejected.

Reusable `Config` fragments may be incomplete. A finished callable must already have settings that its shorthand call cannot supply: an LLMAgent needs a model, loaded sources need a loader, and tools need a configured implementation and `inputSchema`.

Custom loaders can be a function `(name) => ...` or an object/class with `load(name)`. Casai uses Cascada's support for both forms.

An array tries loaders in order; `raceLoaders([...])` tries them together. Child loaders run before parent loaders. Use `raceParent(...)` to try both together, or `overrideParent(...)` to use only the child's loaders. Both helpers work without a parent. See [combining loaders](README2.md#combining-loaders) for examples.

### Input, defaults, and private context

```typescript
const scale = create.Function({
  inputSchema: z.object({ value: z.string().transform(Number), factor: z.number() }),
  context: { factor: 2, label: 'private' },
  execute: ({ value, factor, label }) => `${label}: ${value * factor}`,
});
await scale({ value: '3' }); // "private: 6"
await scale.run({ context: { value: '3', factor: 4 } }); // "private: 12"
```

Declared input fields select public defaults from context. Call arguments override those defaults, then the complete application input is parsed once. Execution receives parsed values plus private dependencies. Calls and configured public defaults use schema **input** types; callbacks and consumers use schema **output** types.

Undeclared configured names are private and cannot be replaced by caller/model arguments. Without an input schema, configured names remain private, while ordinary non-tool calls can supply unrelated fields. Closed caller types reject undeclared fields; runtime parsing follows the schema after privacy checks. Open ordinary schemas retain their native extra-field behavior. Changing a union discriminator does not delete old fields from a shallow-merged default object.

Casai schemas support Zod 4 Classic/Mini, SDK schemas, and Standard Schema. Direct Zod 3 schemas are rejected. Native third-party tools and native SDK `Output` specifications keep the SDK's schema support. Declaration discovery is required when partitioning defaults/private context or exposing a Casai tool; opaque schemas then need suitable metadata. Local validation without those needs does not require JSON conversion.

Schema callbacks must be pure. Casai preserves native parser copying, reference sharing, default evaluation, and `.readonly()` behavior; it does not deep-clone arbitrary data. Use fresh structured defaults where sharing would be inappropriate. Transforms return new values and copy any nested paths they change.

## Template, Script, and Function

```typescript
const greeting = create.Template({ template: 'Hello {{ name }}!' });
await greeting({ name: 'Ada' });

const sum = create.Script({
  script: 'return a + b',
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  schema: z.number(),
});
await sum({ a: 2, b: 3 });

const double = create.Function({ execute: ({ value }: { value: number }) => value * 2 });
await double({ value: 3 });
```

Template and Script also accept `(source, context)` to replace source for a call. `.loadsTemplate` / `.loadsScript` interpret that source as a resource name and require a loader; `.withTemplate` / `.withScript` explicitly select inline source. Function's implementation is configured at creation.

Use `.run({ context, abortSignal })` for coded components; Template and Script also accept their named source property. Registered tools support invocation `toolsContext`. Explicit cancellation is forwarded cooperatively to registered tool calls; Casai does not interrupt arbitrary JavaScript or Cascada evaluation.

Put ordinary components or functions in `context` to invoke them from a workflow. Put SDK tools in `tools` to expose validated callable helpers. These are separate from the model deciding to call a tool.

### Revision workflow

This script revises a draft until it reaches a quality target or its revision limit.

```javascript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { create } from 'casai';
import { z } from 'zod';
import { Output } from 'ai';

// Define a reusable base configuration
const baseConfig = create.Config({ model: openai('gpt-4o'), temperature: 0.7, maxRetries: 3 });

// A component to write drafts (inherits from baseConfig)
const draftGenerator = create.LLMAgent.withTemplate({
	prompt: 'Write a short, engaging blog post about {{ topic }}.',
}, baseConfig);

// A component to critique drafts using a structured schema.
const critiqueGenerator = create.LLMAgent.withTemplate({
	output: Output.object({ schema: z.object({
		score: z.number().describe('Quality score from 1-10.'),
		suggestions: z.array(z.string()).describe('Actionable suggestions for improvement.'),
	}) }),
	prompt: 'Critique this blog post: {{ draft }}',
}, baseConfig);

// A component to rewrite a draft based on feedback
const revisionGenerator = create.LLMAgent.withTemplate({
	model: anthropic('claude-3-7-sonnet-latest'), //override the base model to use Claude Sonnet
	prompt: 'Rewrite the following post based on these suggestions:\n\nPOST:\n{{ draft }}\n\nSUGGESTIONS:\n- {{ suggestions | join("\n- ") }}',
}, baseConfig);

// Define the orchestration script for the agent
const contentAgent = create.Script({
	context: {
		draftGenerator, critiqueGenerator, revisionGenerator,
		topic: "the future of AI-powered development",
		qualityThreshold: 8, maxRevisions: 3, minRevisions: 1
	},
	script: `
      var revisionCount = 0
      var currentDraft = draftGenerator({ topic: topic }).value
      var critique = critiqueGenerator({ draft: currentDraft }).value

      // Iteratively revise until the quality threshold or maxRevisions is met
      while (critique.score < qualityThreshold or revisionCount < minRevisions) and revisionCount < maxRevisions
        revisionCount = revisionCount + 1
        currentDraft = revisionGenerator({ draft: currentDraft, suggestions: critique.suggestions }).value
        critique = critiqueGenerator({ draft: currentDraft }).value
      endwhile

      return { finalDraft: currentDraft, finalScore: critique.score, revisionCount: revisionCount }`,
});

// Run the agent
const result = await contentAgent();
console.log(JSON.stringify(result, null, 2));
```

## LLMAgent

LLMAgent delegates generation to `generateText` and streaming to `streamText`. It supports text, structured outputs, tool loops, and the SDK Agent interface through one factory.

| Source modifier | `prompt` means |
| --- | --- |
| Base without inherited source mode / `.withText` | Literal string or `ModelMessage[]` |
| `.withTemplate` | Cascada template |
| `.withScript` | Cascada script returning a string or messages |
| `.withFunction` | Function receiving prepared context and returning a string or messages |
| `.loadsText` | Literal-text resource name |
| `.loadsTemplate` | Template resource name |
| `.loadsScript` | Script resource name |

Loaded forms require `loader`. Rendering settings are `context`, `filters`, and `renderOptions`. The source property is always `prompt`. Context and `inputSchema` are allowed even for literal text, including when only hooks need the context.

Compose modifiers in source, streaming, tool order, for example `create.LLMAgent.withTemplate.asStream.asTool(...)`.

### Calls and history

```typescript
await writer({ topic: 'recycling' });
await writer('Explain {{ topic }} in one sentence.', { topic: 'recycling' });
await writer({ topic: 'composting' }, previousHistory);
await writer.run({ context: { topic: 'composting' }, messageHistory: previousHistory });

const chat = create.LLMAgent({ model });
const first = await chat('Hello.');
const next = await chat('Tell me more.', await first.messageHistory);
```

Rendered calls use `(context, messageHistory?)` with a configured source, or `(source, context, messageHistory?)`. Function preparation follows the same order. Literal calls use `(prompt, context?, messageHistory?)`; context can be omitted when no call data is required. A first array is a new literal prompt, never an inferred history. Use `.run({ messageHistory })` for history-only calls. Empty strings still add a user message.

`.run()` supports model settings and hook replacement. It ignores top-level `undefined` overrides. Source mode, input schema, output specification, identity, rendering settings, and modifiers are fixed at creation. Nested context/map entries retain their normal merge rules.

### Hooks

Both hooks receive three arguments:

```typescript
const assistant = create.LLMAgent.withTemplate({
  model: fastModel,
  inputSchema: z.object({ topic: z.string(), detail: z.enum(['brief', 'deep']) }),
  prompt: 'Explain {{ topic }}.',
  prepareCall: (request, config, context) => ({
    ...request,
    model: context.detail === 'deep' ? capableModel : config.model,
    timeout: context.detail === 'deep' ? 60_000 : 15_000,
  }),
  prepareStep: (step, config, context) => ({
    model: step.stepNumber > 0 && context.detail === 'deep' ? capableModel : config.model,
  }),
});
```

`prepareCall(request, config, context)` runs once after prompt rendering and input parsing. `request.messages` contains the assembled conversation, including the rendered prompt. Return the **complete replacement request**; spread `request` to retain settings. The result wins over configuration and `.run()` overrides. Callers can replace the hook through `.run({ prepareCall })`.

The editable request includes model controls, tools, timeout, stream transforms, and other supported native execution settings. Fixed output, the invocation signal, composed observers, approval policy/signing secret, and telemetry are installed separately at dispatch. They are not editable request fields and cannot be dropped by a minimal hook return.

`prepareStep(step, config, context)` runs inside the SDK's loop before each model step. Its first argument and partial return follow the SDK contract: it can change messages, model, instructions, active tools, and supported step settings. Return overrides instead of mutating shared settings. It does not itself execute another step. The SDK owns step scheduling and termination.

Both hooks share the invocation's flat merged `config` and prepared `context`. `config.context` contains the merged raw configuration and call settings; the third argument contains parsed application input, dependencies, tool helpers, and `_toolOptions`, exactly as supplied to the prompt renderer. SDK tool arguments enter that prepared context, without reconstructing raw arguments in `config`. Hooks do not receive a separate application `options` channel. Configuration must not be mutated.

Lifecycle observers from config and the call both run; observer failures do not fail execution. Use stable names such as `onStart`, `onStepEnd`, and `onEnd`. Control hooks such as `prepareCall`, `prepareStep`, `onError`, and stream transforms replace inherited controls rather than compose.

### Tool loops

```typescript
import { stepCountIs } from 'ai';

const lookup = create.Function.asTool({
  description: 'Look up a city temperature.',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => weatherService.temperature(city),
});
const assistant = create.LLMAgent({ model, tools: { lookup }, stopWhen: stepCountIs(5) });
const answer = await assistant('What is the temperature in London?');
```

The default is the SDK core's **one step**. Set `stopWhen` for a multi-step loop. Casai binds tool context per invocation and preserves native approvals/history. Tool defaults and trusted bindings must remain fixed for a binding's lifetime; use a new binding for different defaults. A step hook cannot replace a bound tool's context. Call preparation can select a new registry before dispatch.

### LLMAgent results

`value` means **final application output**. `output` selects its type; `.asStream` determines how it is delivered.

| Configuration | `result.value` | Usage |
| --- | --- | --- |
| Ordinary agent, no `output` | `string` | `const text = result.value` |
| Ordinary agent, explicit `Output` | Completed parsed output | `const data = result.value` |
| `.asStream`, no `output` or `output: undefined` | `AsyncIterable<string>` | `for await (const chunk of result.value)` |
| `.asStream`, any explicit `Output` | Promise of completed parsed output | `const data = await result.value` |

Explicit `Output.text()` therefore gives a promise when streaming; `Output.array(...)` gives a promise of the completed array. Custom explicit outputs also give a promise, even if their parsed value is itself iterable. An optional output setting has a union of the possible delivery types.

```typescript
const writer = create.LLMAgent.asStream({ model, output: Output.text() });
const result = await writer('Explain recycling briefly.');
for await (const delta of result.textStream) process.stdout.write(delta);
const finalText = await result.value; // string
```

The SDK's native views remain available on the **same execution**:

| View | Use it for |
| --- | --- |
| `textStream` | Text deltas as the SDK emits them, including intermediate tool-loop text |
| `partialOutputStream` | Partial structured output; not a promise of final schema validity |
| `elementStream` | Native array-element delivery when supported by the output specification |
| `fullStream` | SDK events, tools, reasoning, errors, and step boundaries |
| `output` | Native completed parsed output, with native availability/error semantics |
| `messageHistory` | Original application conversation plus native response messages |

`value` checks that the SDK-reported final answer is usable: pending approval/tool work and failed or aborted stream completion cannot be presented as a successful final value. Default-text `value` streams only when finality and stable-prefix guarantees allow it; otherwise it buffers until completion. Explicit outputs always await completion. Reading another result view does not rerun the model or parse the output again.

Request hooks may trim or rewrite provider messages. `messageHistory` and pending-work checks retain the original assembled application conversation. History is independent of `value` availability and preserves native response-message failures. SDK continuation/cancellation limitations remain native; Casai does not invent a second completion tracker.

Streams have consumption and cleanup responsibilities. Use native stream/UI helpers, or `toReadableStream` for a JavaScript async iterable. `makeSharedIterable` is available for explicit sharing with Cascada's retention/disposal semantics; Casai adds no automatic replay. Do not use a partial stream as evidence of whole-output validity.

## SDK Agent and UI integration

An ordinary LLMAgent exposes `version`, `id`, `tools`, `.generate()`, and `.stream()` for SDK Agent/UI helpers.

```typescript
import { createAgentUIStreamResponse } from 'ai';

const assistant = create.LLMAgent({ model, instructions: 'Be concise.' });
const response = await createAgentUIStreamResponse({ agent: assistant, uiMessages });
```

`.generate({ prompt })` and `.stream({ messages })` accept native literal conversation arguments. They skip configured source loading/rendering while preserving input preparation, hooks, tools, and result augmentation. SDK `options` is solely the native entry-point spelling of Casai application context: `.generate({ prompt, options: { detail: 'deep' } })` sends that input through the same schema/privacy/default rules. Casai config and `.run()` use `context` and reject `options` / `callOptionsSchema`.

The SDK validates UI tool history against exposed `.tools` before `prepareCall`. Use the matching configured/bound descriptors for such history. Native transformed-argument history limitations remain native.

## Using components as tools

`.asTool` adds the SDK Tool descriptor while retaining ordinary calls, `.run()`, and `.config`. SDK execution returns completed application output; an LLMAgent tool returns its parsed final value, not its SDK result envelope. A tool form does not implement SDK Agent: it has no Agent-only `id`, `.generate()`, or `.stream()` properties. Derive ordinary Agent and tool forms from a common `Config` when you need both.

Every Casai tool requires a configured source/implementation and `inputSchema` with explicitly declared top-level public fields. Open-root/catchall tool contracts are rejected; put dynamic dictionaries inside a declared `payload` or `attributes` field. Undeclared raw arguments are rejected before application parsing, even for stripping schemas. Native third-party tools retain native support.

```typescript
const summarize = create.LLMAgent.withFunction.asTool({
  model,
  inputSchema: z.object({ document: z.string() }),
  prompt: ({ document }) => `Summarize this document: ${document}`,
});
```

Literal/fixed-resource LLMAgent tools require a configured prompt. Use empty public input when no context is needed, or declared fields for hooks. Named inputs that affect prompt text require a template, script, or function preparer. A model-supplied property called `prompt` never automatically replaces executable/configured source.

### Trusted tool context

`toolContextSchema` validates incoming native `ToolExecutionOptions.context`; it is exposed as the descriptor's native `contextSchema`. Do not use top-level `contextSchema` in Casai configuration. Ordinary calls do not parse `config.context` through the tool-context schema.

Priority is explicit public arguments, then bound tool context, then configured public defaults. Private dependency collisions remain protected. Bare descriptors accept private-only incoming context. Bind incoming public defaults explicitly:

```typescript
const lookup = create.Function.asTool({
  inputSchema: z.object({ city: z.string() }),
  toolContextSchema: z.object({ city: z.string() }),
  execute: ({ city }) => city,
});
const bound = lookup.bindToolContext({ city: 'London' });
// Pass bound.tool and the matching bound.context to native SDK tools/toolsContext.
```

Casai owners bind registered tools internally. Configured public defaults may be advertised as annotations where supported, without publishing private values. Binding retains native context-validation boundaries. Approval continuation must use stable defaults; otherwise native revalidation can reject execution.

Bodies and prompt functions receive `context._toolOptions`: actual invocation metadata such as the tool-call ID, messages, and abort signal. Ordinary calls have no fabricated tool metadata. Input/configuration cannot spoof this reserved field. Native descriptors retain `execute(input, options)`.

## Cancellation and errors

Pass `abortSignal` to `.run()` or native Agent methods, never reusable configuration. Casai checks it before preparation and before SDK dispatch and forwards actual signals through registered tool execution. Preparation is awaited normally. SDK `timeout` starts at the native execution boundary; inherited whole-invocation deadlines remain planned work.

Configuration errors use `ConfigError`; invalid application input/output uses `ValidationError`. Cascada execution failures retain `ScriptError` and their cause. Native SDK/provider failures retain native behavior. Retrying an effectful workflow is an application decision; SDK model retries do not make arbitrary side effects safe to repeat.

## Embedding and RAG integration

Use native SDK embedding/search functions as context helpers. The following script gathers independent document lookups concurrently and preserves source order in the returned data.

```typescript
import { openai } from '@ai-sdk/openai';
import { embed, cosineSimilarity } from 'ai';
import { create } from 'casai';
import fs from 'fs/promises';

const documentFinder = create.Script({
  context: {
    userQuery: 'machine learning applications',
    readFile: async (filePath) => await fs.readFile(filePath, 'utf-8'),
    embedText: async (text) => (await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: text
    })).embedding,
    compareSimilarity: cosineSimilarity,
    range: (n) => [...Array(n).keys()], // Helper to generate numbers for the loop
  },
  script: `
    var queryEmbedding = embedText(userQuery)
    // Loop iterations can run concurrently, so documents are fetched and embedded as soon as possible.
    // The data channel collects the results in source-code order regardless of completion order.
    data result
    for i in range(10)
      var docPath = 'docs/document' ~ (i + 1) ~ '.txt'
      var docEmbedding = embedText(readFile(docPath))
      result.docs.push({
        filename: docPath,
        similarity: compareSimilarity(queryEmbedding, docEmbedding)
      })
    endfor
    return result.snapshot()
  `
});

(async () => {
  const { docs } = await documentFinder();
  const sortedDocs = [...docs].sort((a, b) => b.similarity - a.similarity);
  console.log('Most similar document:', sortedDocs[0]);
})();
```

A retrieval workflow can pass retrieved text to a configured answer component:

```typescript
const answerGenerator = create.LLMAgent.withTemplate({
  model,
  inputSchema: z.object({ context: z.string() }),
  prompt: 'Answer using these sources: {{ context }}',
});
const ragOrchestrator = create.Script({
  context: { query: 'Current research', searchIndex, answerGenerator },
  script: `
    var retrievedContext = searchIndex(query)
    var answer = answerGenerator({ context: retrievedContext }).value
    return { query: query, answer: answer }
  `,
});
```

## Migration

Replace `race(loaders, groupName?)` with `raceLoaders(loaders)`. Group names and the `RaceGroup`/`RaceLoader` types are removed. `.config.loader` now keeps nested arrays and races; use `LoaderGroup` for its type. `LoaderInput` also accepts `raceParent(...)` and `overrideParent(...)`.

Child files can now replace files included or imported by a parent's template. Previously, relative files always came from the loader that supplied the template. With `raceParent`, relative files stay on the side that found the main file; they do not fall back between child and parent.

`LLMAgent` replaces `TextGenerator`, `TextStreamer`, `ObjectGenerator`, and `ObjectStreamer`; the old exports and types are removed. Use `.asStream` for streaming and native `Output.object`, `Output.array`, `Output.choice`, or other SDK output specifications for structured results. Use `.value` for application output and keep native result properties where needed.

Await streaming component calls before accessing the SDK result. Await `.value` for explicit streaming outputs; iterate `.value` only for default text. Use `prompt` for configured messages, `messageHistory` for call history, and `instructions` for system instructions. Rendered positional calls place context before history. Stable lifecycle names are `onEnd` and `onStepEnd` instead of `onFinish` and `onStepFinish`.

## Development

`npm test` runs mock-only runtime tests. `npm run check` checks source/emitted types, lint, and runtime coverage without paid calls. `npm run test:live` explicitly opts into provider-backed tests. See [tests/README.md](tests/README.md) for focused checks and [the review process](docs/review-process.md) for contract review requirements.

TypeScript checks every alternative of a union-valued argument. A union of different component values may require narrowing before invoking it; do not cast away input checks.

Learn Cascada from its [script documentation](https://geleto.github.io/cascada-script/) and [repository](https://github.com/geleto/cascada). See [Casai examples](https://github.com/geleto/casai-examples) and [Smart DB Dashboard](https://github.com/geleto/smart-db-dashboard) for larger workflows.
