# Casai: concurrent AI workflows

Casai combines the AI SDK's model execution with Cascada's concurrent scripts and templates. Write ordinary data dependencies; Cascada starts independent work concurrently and waits where one result depends on another.

```javascript
var background = researcher({ topic: topic }).output
var analysis = analyst({ topic: topic }).output
return writer({ background: background, analysis: analysis }).output
```

Use `Config` for shared settings, `Template` for text presentation, `Script` for workflows, `Function` for JavaScript logic, and `LLMAgent` for model calls and tool loops. Specialized components wrap native embedding, reranking, image, speech, transcription, decision and realtime setup operations.

## Contents

- [Installation](#installation) and [quick start](#quick-start)
- [Common component contracts](#common-component-contracts)
- [Template, Script, and Function](#template-script-and-function)
- [Streams from Function and Script](#streams-from-function-and-script)
- [LLMAgent](#llmagent)
  - [Steps, hooks and continuation](#steps-hooks-and-continuation)
  - [Results](#llmagent-results) and [streaming](#streaming-with-asstream)
- [Specialized AI components](#specialized-ai-components)
- [Sources, loaders and rendering](#sources-loaders-and-rendering)
- [Conversation history](#conversational-ai-managing-message-history)
- [Tool approvals and continuation](#tool-approvals-and-continuation)
- [Images and files](#images-and-files-in-llmagent-messages)
- [SDK Agent and UI integration](#sdk-agent-and-ui-integration)
- [Using components as tools](#using-components-as-tools)
- [Interchanging components](#interchanging-components-in-workflows)
- [Cancellation and errors](#cancellation-and-errors)
- [Embedding and RAG integration](#embedding-and-rag-integration)
- [Testing workflows](#testing-workflows)

## Installation

```sh
npm install casai ai zod @ai-sdk/openai
```

Use Node.js 24 or newer and TypeScript 7.0.2 or newer with `strictNullChecks` enabled (normally through `strict: true`). Provider packages are selected by your application. Casai currently targets Node.js; the Cascada dependency prevents browser/edge bundling. Browser chat and voice clients use the AI SDK and call your Casai server.

## Quick start

<!-- typecheck: current-quick-start -->
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
console.log(result.output); // string

const extract = create.LLMAgent({
  model,
  output: Output.object({ schema: z.object({ name: z.string() }) }),
});
const person = await extract('My name is Ada.');
console.log(person.output.name);
```

All components can also be imported by name, for example `import { LLMAgent, Script } from 'casai'`.

## Common component contracts

Factories accept a flat configuration object and an optional compatible parent. Components expose the resolved settings as `.config`. Ordinary calls supply input; `.run()` accepts named input and the execution overrides supported by that component. Both return promises and reject on invocation errors. Invalid configuration throws when the component is created.

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
| LLMAgent | The SDK result, with `.messageHistory`; see [results](#llmagent-results) |

Configuration is immutable by authoring contract. Derive a new component or use supported `.run()` overrides to change settings. Casai captures top-level map bindings; nested application resources can remain shared. Application context can be a plain object or an instance with own enumerable fields; preparation copies those fields, not its prototype. Bodies may deliberately change authorized state. Sequence effectful Cascada calls with `!`; independent invocations require application-level coordination.

When calling `.run()` or reading `.config` from Cascada, expose the component directly as a context binding. The current engine preserves `component.run(...)`, but nested function lookup such as `services.component` loses the function's attached properties; `services.component(...)` itself still works.

Template and script sources execute application code with access to their configured context. They are not a sandbox: even a template expression can execute arbitrary JavaScript. Use trusted authored sources, including stored/loaded templates, and pass end-user or model text as context data. Error messages can include values used by a failing expression; sanitize errors before exposing them to a model or browser.

`debug: true` logs configuration and invocation data without redaction, including headers and private context. Enable it only where those logs are appropriate.

### Configuration and inheritance

<!-- typecheck: current-config-inheritance -->
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
- Every component inherits modifiers, including through `Config`. A base factory preserves source mode; an explicit source modifier replaces it. `Config` supports `.withText`, `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate` and `.loadsScript`, optionally followed by `.asTool` or `.asStream`. For example, `Config.withTemplate.asTool(...)` creates a fragment for a template-prepared tool. Plain `Config(...)` leaves source selection to its parent or consuming component. Use modifiers to select sources; `promptType` is not an authored configuration property.
- A modifier-bearing fragment may remain incomplete, but its settings must fit one compatible component configuration. The finished component checks its own support and required settings. Current streaming and tool modifiers cannot be combined. Select the source first, then `.asTool` or `.asStream`; reverse chains are not provided.
- Configuration unions keep their source modes. A call must work in every possible mode: an Embedder with configured text/function alternatives supports `embedder()` and `.run({ headers })`; text/template alternatives also accept shared string replacements. You do not need to narrow the configuration before constructing the component.
- `.asTool` and LLMAgent `.asStream` remain enabled in derived components. Their resolved metadata is `asTool: true` and `streaming: true`; there are no reverse modifiers. Unsupported inherited settings are rejected.

Reusable `Config` fragments may be incomplete. Their runtime checks cover common configuration structure; the completed component validates its supported settings. TypeScript also checks known fragment incompatibilities during authoring. A finished callable must already have settings that its shorthand call cannot supply: an LLMAgent needs a model, loaded sources need a loader, and tools need an `inputSchema` plus any source/implementation their selected form requires.

Select reusable source and tool behavior on `Config` itself. Both agents below render the template and expose a tool interface:

<!-- typecheck: config-source-tool-modifiers -->
```typescript
const shared = create.Config.withTemplate.asTool({
  model,
  inputSchema: z.object({ topic: z.string() }),
  prompt: 'Explain {{ topic }}.',
});
const beginner = create.LLMAgent({ instructions: 'Use everyday language.' }, shared);
const technical = create.LLMAgent({ instructions: 'Use technical terminology.' }, shared);
await beginner({ topic: 'solar power' });
await technical({ topic: 'solar power' });
```

SDK callbacks stored in `Config` need explicit parameter or function types: a fragment does not select the component that owns events such as `onEnd`. The completed component validates inherited callbacks and infers callbacks supplied as overrides. For example, an Embedder's `onEnd: event => ...` override receives the native embedding event, including its configured `runtimeContext` type. Schema-driven `execute` callbacks and function-mode source preparers still infer application context from the fragment's schemas and context.

Custom loaders can be a function `(name) => ...` or an object/class with `load(name)`. Casai uses Cascada's support for both forms.

An array tries loaders in order; `raceLoaders([...])` tries them together. Child loaders run before parent loaders. Use `raceParent(...)` to try both together, or `overrideParent(...)` to use only the child's loaders. Both helpers work without a parent. See [combining loaders](#combining-loaders) for examples.

### Input, defaults, and private context

<!-- typecheck: current-input-defaults -->
```typescript
const scale = create.Function({
  inputSchema: z.object({ value: z.string().transform(Number), factor: z.number() }),
  context: { factor: 2, label: 'private' },
  execute: ({ value, factor, label }) => `${label}: ${value * factor}`,
});
await scale({ value: '3' }); // "private: 6"
await scale.run({ context: { value: '3', factor: 4 } }); // "private: 12"
```

Declared input fields select public defaults from `config.context`. Bound `toolsContext[toolName]` defaults override them; supplied payload fields override both. This is a shallow merge. No other configuration fields enter the payload, and payload properties never merge into configuration. Authored sources such as `config.prompt` remain separate from a same-named payload field.

Declared input fields select public defaults from context. Call arguments override those defaults, then the complete application input is parsed once. Execution receives parsed values plus private dependencies. Calls and configured public defaults use schema **input** types; callbacks and consumers use schema **output** types.

Undeclared configured names are private and cannot be replaced by caller/model arguments. Without an input schema, configured names remain private, while ordinary non-tool calls can supply unrelated fields. Closed caller types reject undeclared fields; runtime parsing follows the schema after privacy checks. Open ordinary schemas retain their native extra-field behavior. Changing a union discriminator does not delete old fields from a shallow-merged default object.

Casai schemas support Zod 4 Classic/Mini, SDK schemas, and Standard Schema. Direct Zod 3 schemas are rejected. Native third-party tools and native SDK `Output` specifications keep the SDK's schema support. Declaration discovery is required when partitioning defaults/private context or exposing a Casai tool; opaque schemas then need suitable metadata. Local validation without those needs does not require JSON conversion.

Schema callbacks must be pure. Casai preserves native parser copying, reference sharing, default evaluation, and `.readonly()` behavior; it does not deep-clone arbitrary data. Use fresh structured defaults where sharing would be inappropriate. Transforms return new values and copy any nested paths they change.

## Template, Script, and Function

<!-- typecheck: current-coded-components -->
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
      var currentDraft = draftGenerator({ topic: topic }).output
      var critique = critiqueGenerator({ draft: currentDraft }).output

      // Iteratively revise until the quality threshold or maxRevisions is met
      while (critique.score < qualityThreshold or revisionCount < minRevisions) and revisionCount < maxRevisions
        revisionCount = revisionCount + 1
        currentDraft = revisionGenerator({ draft: currentDraft, suggestions: critique.suggestions }).output
        critique = critiqueGenerator({ draft: currentDraft }).output
      endwhile

      return { finalDraft: currentDraft, finalScore: critique.score, revisionCount: revisionCount }`,
});

// Run the agent
const result = await contentAgent();
console.log(JSON.stringify(result, null, 2));
```

## Streams from Function and Script

Function and Script can return JavaScript async iterables. Declare `textStreamSchema()` for text chunks or `streamSchema(elementSchema)` for complete elements. Elements are parsed lazily as they are consumed, including schema transforms. Awaiting the component gives you the stream; it does not collect or validate the entire stream.

<!-- typecheck: function-stream -->
```typescript
const countdown = create.Function({
  inputSchema: z.object({ from: z.number() }),
  schema: textStreamSchema(),
  execute: async function* ({ from }) {
    for (let n = from; n > 0; n--) yield `${n}... `;
    yield 'Liftoff!';
  },
});

for await (const text of await countdown({ from: 3 })) {
  process.stdout.write(text);
}
console.log(await collectTextStream(await countdown({ from: 3 }))); // 3... 2... 1... Liftoff!
```

A Script can return an async iterable produced by a context helper:

<!-- typecheck: script-iterable -->
```typescript
import { collectStream } from 'casai';

const numbers = create.Script({
  context: {
    makeNumbers: async function* () { yield '1'; yield '2'; },
  },
  schema: streamSchema(z.string().transform(Number)),
  script: 'return makeNumbers()',
});

console.log(await collectStream(await numbers())); // [1, 2]
```

| Helper | Result |
| --- | --- |
| `collectTextStream(source)` | Join all text chunks into a string |
| `collectStream(source)` | Collect complete elements into an array |
| `toReadableStream(source)` | Adapt an async iterable to a web `ReadableStream` |
| `makeSharedIterable(source)` | Explicitly share a source among readers |

These helpers are exported from `casai`. Collection propagates failure; it does not return a successful partial result. A plain returned iterable has its own consumption rules and no automatic replay. For several readers, wrap the validated stream once with `makeSharedIterable`; the owner eventually calls `.dispose()` to release retained history. Cancelling one reader does not dispose the shared source.

Cascada loops share iteration by default, including across renders that receive the same source object. Use a fresh source for an independent run, or `renderOptions: { replayAsyncIterables: false }` for native single-use consumption. A returned stream does not regain already-consumed items.

A Function or Script used as a tool collects a finite declared root stream into a completed string or array. Ordinary calls still return the stream. Undeclared root async iterables are rejected in tool execution without being consumed. Iterables nested inside returned objects are opaque values.

Template renders a completed string. Native Script `stream`/`tstream` channels and Template streaming are not available in this API; return JavaScript iterables from Script or Function when callers need a stream.

## LLMAgent

LLMAgent delegates generation to `generateText` and streaming to `streamText`. It supports text, structured outputs, tool loops, and the SDK Agent interface through one factory.

| Source modifier | `prompt` means |
| --- | --- |
| Base without inherited source mode / `.withText` | Literal string, `ModelMessage`, or `ModelMessage[]` |
| `.withTemplate` | Cascada template string or text slots in one or more messages |
| `.withScript` | Cascada script returning a string or messages |
| `.withFunction` | Function receiving prepared context and returning a string or messages |
| `.loadsText` | Literal-text resource name |
| `.loadsTemplate` | Template resource name |
| `.loadsScript` | Script resource name |

Loaded forms require `loader`. Rendering settings are `context`, `filters`, and `renderOptions`. The source property is always `prompt`. Context and `inputSchema` are allowed even for literal text, including when only hooks need the context.

Choose a source modifier, then `.asStream` for a streaming agent or `.asTool` for a generation-only tool. LLMAgent rejects combining these modes, including through inheritance.

### Calls and history

<!-- typecheck: current-calls-history -->
```typescript
await writer({ topic: 'recycling' });
await writer('Explain {{ topic }} in one sentence.', { topic: 'recycling' });
await writer({ topic: 'composting' }, previousHistory);
await writer.run({ context: { topic: 'composting' }, messageHistory: previousHistory });

const chat = create.LLMAgent({ model });
const first = await chat('Hello.');
const next = await chat('Tell me more.', await first.messageHistory);
```

Rendered calls use `(context, messageHistory?)` with a configured source, or `(source, context, messageHistory?)`. Function preparation follows the same order. Literal calls use `(prompt, context?, messageHistory?)`; context can be omitted when no call data is required. On every agent, positional arrays are literal history; use configuration or `.run({ prompt })` for new message arrays, including authored templates. `.run({ messageHistory })` sends history alone only when there is no effective prompt; otherwise it prepares and appends the configured prompt. Empty strings still add a user message.

Configured and named prompts also accept a single native message: `agent.run({ prompt: { role: 'user', content: 'Hello' } })` is equivalent to supplying a one-element prompt array. Inline templates render that message's text slots; script/function preparers may also return a single message. A bare positional object remains application context.

History arguments accept `readonly ModelMessage[]`, including frozen arrays. Casai copies the outer array and borrows its messages; keep those messages unchanged while the call or stream is running. Native `.generate()`/`.stream()` parameters retain the SDK's own types.

`.run()` supports model settings and hook replacement. It ignores top-level `undefined` overrides. Source mode, input schema, output specification, identity, rendering settings, and modifiers are fixed at creation. Nested context/map entries retain their normal merge rules.

For a rendered agent, pass end-user text through the context fields its configured prompt consumes. A `prompt` override selects new executable source or a resource name. Text passed as context, including text containing `{{ ... }}`, is data and is not compiled again as template source.

### Hooks

Both hooks receive three arguments:

<!-- typecheck: current-hooks -->
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

`prepareCall(request, config, context)` runs once after input parsing and any prompt preparation. Resume and native SDK calls skip prompt preparation. `request.messages` contains the assembled conversation, including the rendered prompt. Return the **complete replacement request**; spread `request` to retain settings. The result wins over configuration and per-call overrides. Callers can replace the hook through `.run({ prepareCall })` or `.resume(history, { prepareCall })`.

On native `.generate()`/`.stream()` calls, pass `messages: []` when the hook supplies the entire conversation. JavaScript calls that omit both `prompt` and `messages` also reach the hook with an empty conversation. These calls skip configured prompt rendering; context validation still applies, and the SDK rejects an empty final request. Result history retains the original input plus response messages, so it does not include a conversation created only by the hook.

The editable request includes model controls, tools, timeout, stream transforms, and other supported native execution settings. Fixed output, the invocation signal, composed observers, approval policy/signing secret, and telemetry are installed separately at dispatch. They are not editable request fields and cannot be dropped by a minimal hook return.

`prepareStep(step, config, context)` runs inside the SDK's loop before each model step. Its first argument and partial return follow the SDK contract: it can change messages, model, instructions, active tools, and supported step settings. Return overrides instead of mutating shared settings. It does not itself execute another step. The SDK owns step scheduling and termination.

Both hooks share the invocation's flat merged `config` and prepared `context`. `config.context` contains the merged raw configuration and call settings; the third argument contains parsed application input, dependencies, tool helpers, and `_toolOptions`, exactly as supplied to the prompt renderer. SDK tool arguments enter that prepared context, without reconstructing raw arguments in `config`. Hooks do not receive a separate application `options` channel. Configuration must not be mutated.

Lifecycle observers from config and the call both run; observer failures do not fail execution. Use stable names such as `onStart`, `onStepEnd`, and `onEnd`. Control hooks such as `prepareCall`, `prepareStep`, `onError`, and stream transforms replace inherited controls rather than compose.

### Steps, hooks and continuation

An LLMAgent can execute tools during a model step, then use their results in later steps. For example, this agent allows up to five model steps:

<!-- typecheck: tools -->
```typescript
import { isStepCount } from 'ai';

const multiply = create.Function.asTool({
  description: 'Multiply two numbers.',
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => a * b,
});

const calculator = create.LLMAgent({
  model,
  tools: { multiply },
  stopWhen: isStepCount(5),
});

console.log((await calculator('Use the tool to multiply 37 by 29.')).output);
```

#### Calls and automatic steps

- One `component(...)` or `component.run(...)` call starts one invocation.
- Each step calls the model and handles its tool calls. The next step can use their results.
- Execution ends when the model finishes, external input is needed, or a stopping condition prevents another eligible step.

`stopWhen` is a function that receives the completed steps and returns **true** to stop or **false** to allow another eligible step. It may be asynchronous. An array stops when any condition returns true.

The default is `isStepCount(1)`: one model step per invocation. Set `stopWhen: isStepCount(20)`, or another condition, to allow a longer tool loop. A limit is a ceiling, not a request to run that many steps. Without tool activity, the SDK finishes after one model step and does not evaluate `stopWhen`. Both call forms remain valid without tools. See [SDK loop control](https://ai-sdk.dev/docs/agents/loop-control).

#### Hooks within an invocation

Hooks are application callbacks configured on the component or supplied through supported per-call overrides:

- `prepareCall` adjusts the request once, before SDK execution.
- `toolApproval` decides whether a requested tool may execute or needs later human approval. An asynchronous decision can be awaited within the current invocation. Denying all requested local tools does **not itself prevent the next step**; normal stopping rules still apply.
- `prepareStep` adjusts each scheduled model step, including the first. For example, it can select a stronger model after earlier steps fail to solve the task.

These callbacks do not restart execution or reset step counts. To continue with a stronger model, let `stopWhen` allow another step, then select its model through `prepareStep`. A step hook cannot override a stop condition that has already ended the loop.

#### Continuing with saved history

`component.resume(history, options)` starts a fresh invocation without loading or rendering another prompt:

- It uses tool replies already in history and can add approval decisions for pending tools.
- The model can use those results, answer, or request more tools.
- SDK step counts start afresh. There is no separate `prompt` argument; the supplied history is the conversation.
- With settled history and no tools available, resume still makes one new model step. It is not a no-op when nothing is pending.
- Recorded replies can be read without executing their tools again. An approved local call awaiting execution still needs its corresponding tool and executor.

#### Configuration and per-call overrides

- Component configuration supplies the model, `stopWhen`, registered `tools`, application `context` and per-tool `toolsContext`.
- Supported call settings can override them. Supply required inputs that configuration does not provide.
- `.run({ tools: ... })` can replace compatible declared tools or remove them. Add new tool names or change their contracts by deriving another component.
- Overrides from an earlier call are **not remembered**. Preserve and supply them again when needed; history does not contain that setup.
- Application objects and callback closures can hold state. Starting another invocation does not automatically reset that state.

#### New prompt or continuation

`component(...)` and `component.run(...)` prepare and append their configured or supplied prompt. `component.resume(...)` skips that preparation. All use earlier tool replies when their history is supplied.

Without an effective prompt, `.run({ messageHistory })` already sends history alone. An unchanged prompt source does not select continuation automatically: the same template can render a different message from new context.

Neither an ordinary call nor resume automatically denies pending tools. Denying a pending approval refuses that execution; it does not discard replies or undo completed work. Starting a separate conversation without old history does not stop external work already running. See [tool approvals and continuation](#tool-approvals-and-continuation) for recording decisions before a new turn.

#### LLMAgents used as tools

- An LLMAgent used as a tool performs its model steps inside one outer tool call, with the same callbacks.
- It returns completed output or fails if it pauses or a stop condition cuts off another eligible step.
- Natural completion on the last allowed step succeeds.
- It exposes no `.resume()`.

A one-step limit can succeed only if the inner run completes in that step. If a local tool call or deferred provider work makes another step eligible, the limit cuts it off and the tool invocation fails.

### LLMAgent results

Casai returns the native SDK result and adds only `messageHistory`. There is no `value` property. Use native `output` for the final step's parsed output, `textStream` for live text, and `stream` for execution events. These views share one execution and native parsing.

| Output configuration | Generation `output` | Streaming `output` |
| --- | --- | --- |
| Omitted, undefined, or `Output.text()` | `string` | `PromiseLike<string>` |
| Object, array, choice, JSON, or custom SDK Output | Parsed value `T` | `PromiseLike<T>` |

An optional output specification includes the native text fallback in its result type. Custom parsed iterables remain application-owned values; Casai does not consume or replay them.

Native output availability and schema validity do not prove workflow completion. The SDK can return text or schema-valid output while tool work is unresolved, or after an error finish reason. Applications inspect native finish reasons, raw provider reasons, tool/approval events and errors according to their workflow. A promise waits for the current invocation; a paused invocation needs a new continuation call and cannot finish by leaving its old promise pending.

`messageHistory` contains the original conversation and native response messages: an array after generation or a promise in streaming mode. Hooks may change the request sent to the provider without rewriting this retained conversation. History resolution does not establish success. Native structured generation may fail during parsing before returning a result; streaming can retain history after final parsing fails.

A provider can pause even when native output contains text. For example, Anthropic's raw `pause_turn` can be normalized to `stop`. Inspect both raw and normalized finish reasons, then [continue the conversation](#tool-approvals-and-continuation). An OpenAI Chat refusal can instead appear as empty `stop` text; an empty result is not proof that the requested task succeeded.

Continue with `agent.resume(history, { context: rawContext, ...overrides })`. Component configuration supplies the model, tools and other settings; supply again any per-call overrides needed from the paused invocation. Keep provider state, such as an `anthropic.container.id`, when the provider requires it. Resume uses the component's generation or streaming mode.


LLMAgent tools are generation-only. Combining `.asStream` and `.asTool`, including through inherited configuration, is rejected rather than silently changing execution mode. Ordinary calls and `.run()` on a tool component still return the native generation result with history. SDK descriptor execution and injected tool calls await that invocation, check completion, and return its native parsed `output`.

The tool adapter rejects a provider `pause_turn`, an error ending, or unresolved tool/approval work emitted during this invocation with `NoOutputGeneratedError`. Native `output` rejects a `tool-calls` ending or empty non-stop output; Casai does not duplicate those checks. A matching output schema alone cannot make an unfinished inner run a successful outer tool result. Native execution and parsing failures propagate; a parent SDK loop handles the rejection as a tool error. No inner history or resumable promise is returned as a successful tool result. Completed empty stop text is valid; nonempty truncated output remains subject to native parsing and the caller's finish-reason policy.

One tool invocation can contain multiple model steps, controlled by the configured SDK stop conditions. Approval policies may resolve asynchronously within that invocation. A `prepareStep` hook runs only when the SDK schedules another step; Casai does not restart a paused run or add a continuation loop.

If any effective `stopWhen` condition cuts off another eligible SDK step, tool execution rejects with `NoOutputGeneratedError`, even if all tool results exist and the model produced schema-valid text. This includes the default one-step limit, explicit limits, custom predicates and arrays, including intentional terminal-tool conditions. Natural completion on the last allowed step succeeds: the SDK does not evaluate stop conditions when no further step is eligible. Casai observes the SDK's normal predicate evaluations without rerunning them or adding a counter. Ordinary calls, `.run()` and native Agent methods retain native results. LLMAgent tools expose no `resume()`; a cutoff is a failed tool invocation.

Completion checks cover tool work emitted by the nested invocation and provider approval decisions supplied through its `prepareStep` hook. They do not certify settlement of tool work supplied in the initial prompt history; that follows native SDK/provider handling. Local calls and provider calls with deferred results need results before the tool can return successfully. Request-hook changes do not rewrite the retained conversation history.

For provider approvals, an automatic policy decision does not prove that the provider received it. Each outstanding approval request needs a matching decision sent on a scheduled model step, or a result that settles the call. A decision for another approval ID does not clear that wait.

Native `textStream`, `partialOutputStream`, `elementStream` and `stream` remain available. History retains the original conversation before request hooks and native response messages, independently of output parsing.

Streams have consumption and cleanup responsibilities. Use native stream/UI helpers, or `toReadableStream` for a JavaScript async iterable. `makeSharedIterable` is available for explicit sharing with Cascada's retention/disposal semantics; Casai adds no automatic replay. Do not use a partial stream as evidence of whole-output validity.

### Streaming with `.asStream`

The `.asStream` modifier makes ordinary calls and `.run()` return a live SDK result. Awaiting the call does not wait for completion. Consume `textStream` for live text or await `output` for completed parsed output.

<!-- typecheck: streaming -->
```typescript
const writerStream = create.LLMAgent.asStream({ model });
const textResult = await writerStream('Explain battery recycling briefly.');

for await (const text of textResult.textStream) {
  process.stdout.write(text);
}
console.log(await textResult.usage);
```

Create a streaming LLMAgent when callers need live output or SDK events, such as a chat handler or live text display. To stream an existing LLMAgent, derive one from it: `create.LLMAgent.asStream({}, writer)`. Within a Template or Script, select the child's streaming mode explicitly; the parent does not change ordinary nested calls. The [`output` table](#llmagent-results) shows delivery for each output specification.

`.asStream` follows an input modifier and remains enabled in derived components. LLMAgent tools cannot combine it with `.asTool`, directly or through inheritance.

#### Consuming a Stream

Use native `output` for completed parsed output. For live text, partial structured data or tool activity, select a native SDK stream:

| What you need | Result property | What it delivers |
| :--- | :--- | :--- |
| Live model text | `textStream` | Text chunks across model steps, including intermediate commentary. Structured output can appear here as JSON text. |
| Partial structured output | `partialOutputStream` | Partial parsed snapshots; they can be incomplete and do not establish final schema validity. |
| Array elements as they become available | `elementStream` | The SDK's element stream, when supported by the output specification. It retains native SDK semantics. |
| Execution activity for a UI or custom consumer | `stream` | SDK events for text, reasoning, tools, step boundaries, errors, and completion. |
| The SDK's completed parsed output | `output` | A promise with native SDK semantics, without an additional Casai completion check. |

For example, explicit `Output.text()` lets you display live text and then await the final answer:

<!-- typecheck: explicit-text -->
```typescript
const writer = create.LLMAgent.asStream({
  model,
  output: Output.text(),
});

const result = await writer('Explain battery recycling briefly.');
// The live result handle is available; generation may still be running.

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}

const text = await result.output; // Completed final string; the same execution.
```

In a tool loop, `textStream` might show "Let me check." followed by "It is 18 C."; native `output` contains the final step's text. See [final-answer streaming in tool loops](#final-answer-streaming-in-tool-loops) for an explicit writer phase.

For structured output, await `.output` for the completed parsed value. An array output gives an ordinary array, so iterate it with `for`, after awaiting:

<!-- typecheck: explicit-array -->
```typescript
const list = create.LLMAgent.asStream({
  model,
  output: Output.array({ element: z.object({ title: z.string() }) }),
});
const items = await list('Suggest three titles for an article about recycling.');

try {
  for (const item of await items.output) {
    console.log(item.title);
  }
} catch (error) {
  console.error('No valid final list is available:', error);
}
```

Stream consumption drives completion. Read a stream, forward an HTTP response, call `consumeStream()`, or await `output`, `usage` or `steps`. Each native stream handle keeps its consumption and locking rules. These views reuse one execution and parsed output; accessing the result again does not reset a custom iterator returned by its parser.

Native SDK streams retain their error behavior. `textStream` omits error event parts, so finishing that loop alone does not prove success. Observe callbacks or `stream` errors and inspect finish reasons. Transport or iterator failures can still throw.

Output schemas must be pure and deterministic. The SDK may validate elements repeatedly during partial updates and again for final output; Casai adds no redundant parsing or exactly-once guarantee. Keep validators inexpensive and add stateful enrichment, such as random IDs, after validation.

The native SDK result properties retain their types and behavior. In SDK 7, `stream` is the execution-event stream and `fullStream` is its deprecated alias. SDK methods select their own operation: `writer.stream()` returns a streaming result even when its ordinary call is complete.

#### Final-Answer Streaming in Tool Loops

Native `textStream` includes text from intermediate tool steps. Casai does not predict finality or filter this stream. For an answer-only stream, make the answer-producing phase explicit: gather research, then invoke a separate streaming writer without tools.

<!-- typecheck: research-then-stream -->
```typescript
import { isStepCount } from 'ai';

const research = create.LLMAgent.withTemplate({
  model,
  tools: { lookup },
  stopWhen: isStepCount(5),
  prompt: 'Gather factual research notes for this question: {{ question }}',
});

const answerWriter = create.LLMAgent.withTemplate.asStream({
  model,
  prompt: 'Answer {{ question }} using these findings:\n{{ findings }}',
  inputSchema: z.object({ question: z.string(), findings: z.string() }),
});

const question = 'How should a household recycle used batteries?';
const notes = await research({ question });
const answer = await answerWriter({ question, findings: notes.output });

for await (const chunk of answer.textStream) {
  process.stdout.write(chunk);
}
```

`lookup` is an application-provided research tool. The two phases are an explicit workflow choice. Casai never adds a synthesis call, disables tools or changes the stopping condition to force an answer.

## Specialized AI components

These components prepare inputs and call the corresponding AI SDK operations. Ordinary calls return native SDK results. Decision, StreamingTranscriber, StreamingSpeechGenerator, StreamingTranslator and VoiceSessionSetup depend on experimental AI SDK contracts.

### Decision

`Decision` answers named choice, boolean, score, or bounding-box questions against shared state. Use it to route requests, apply a rubric, or evaluate several related questions. It uses the AI SDK's experimental `experimental_decide` API.

<!-- typecheck: decision -->
```typescript
const route = create.Decision({
  model: decisionModel,
  questions: {
    department: {
      type: 'choice',
      instructions: 'Select the team responsible for this issue.',
      criteria: {
        returns: 'Damaged products and returns',
        billing: 'Payment problems',
      },
    },
  },
});

const decision = await route('My order arrived damaged.');
console.log(decision.answers.department.choice);
console.log(decision.answers.department.probabilities); // When supplied by the provider.
```

Configure the model and question definitions, then pass the `state` to each call; `.run({ state, ...settings })` adds per-call settings. Native state can be text, a JSON object, or an ordered array of text/file/JSON parts. Inline templates render explicit text parts and preserve the other parts; JSON parts stay literal. Script/function preparers can produce any native state. The result retains typed answers, any distributions, usage, metadata, and SDK refusal/error behavior.

Decision performs a decision request and does not run a tool loop. It can itself be exposed as a tool with `.asTool`. For choosing a value as part of a language-generation workflow, an `LLMAgent` can instead use `Output.choice()`; that uses the generation operation.

See [SDK Decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions) for question types, state formats, model support, and results.

### Embedder

`Embedder` converts text into vectors for semantic search, similarity, clustering, and retrieval. Pass one string or an array directly:

<!-- typecheck: embedder -->
```typescript
const embedder = create.Embedder({ model: embeddingModel });

const one = await embedder('First document');
const many = await embedder(['First document', 'Second document']);

console.log(one.embedding);   // number[]
console.log(many.embeddings); // number[][], in input order
```

An array always represents a batch, with one output vector per input. The SDK handles batch splitting and concurrency. The result retains usage and metadata as well as vectors.

Use `input` for either one string or an array in configuration and `.run()`. Per-call settings go through `.run()`:

<!-- typecheck: embedding-settings -->
```typescript
await embedder.run({ input: ['First document', 'Second document'], maxParallelCalls: 2 });
await embedder.run({ input: 'Another document', abortSignal: AbortSignal.timeout(5_000) });
```

Omit `input`, including with `embedder.run()`, when it is already configured. Child configuration and call-time inputs replace that one field, whether the replacement is a string or an array. Casai sends a string to native `embed` as `value` and an array to native `embedMany` as `values`; those native field names are not additional Casai input aliases. Native results retain their own properties, including `embedding` or `embeddings`.

All input modifiers and `.asTool` are supported. `.withText` keeps the plain call form: pass a string or string array directly. With a template, script, function or loading modifier, `input` holds the source and ordinary calls supply preparation context. Text loaders and templates produce one string; a script or function preparer can return a string or string array. A plain tool, including `.withText.asTool`, declares `{ input }` in its input schema; a prepared tool declares the context fields its source consumes.

As a tool, an Embedder returns vectors. Models can't compute with them, so this is an uncommon use, mainly for tool workflows where the application or another step consumes the vectors.

See [single-input results](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed#returns), [batch results](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many#returns), and [RAG integration](#embedding-and-rag-integration).

### Reranker

`Reranker` orders candidate documents by relevance to a query. Use it after keyword, vector, or hybrid retrieval to select useful context for an LLMAgent or improve search results.

<!-- typecheck: reranker -->
```typescript
const reranker = create.Reranker({ model: rerankingModel });
const ranked = await reranker.run({
  query: 'How are damaged orders replaced?',
  documents: [
    'Contact support with a photo of the damage to request a replacement.',
    'You can update your payment card in account settings.',
    'Keep the original packaging until your claim is resolved.',
  ],
  topN: 2,
});

console.log(ranked.rerankedDocuments);
console.log(ranked.ranking); // Original indices and relevance scores.
```

Supply `(query, documents, topN?)` by position, or the same fields in `.run()`. Configured documents permit `reranker(question)` or `reranker(question, undefined, 5)`. Text and template modifiers prepare the query; script/function modifiers can return a query or a complete `{ query, documents }` input. With a configured query/source and no required call context, a reranker can take the candidate array alone, `reranker(candidates)`. Otherwise, supply the query/source first. Explicit call-time documents override documents returned by a preparer; a `topN` override remains available in its own slot.

When a preparer returns the complete pair, its documents take precedence over configured defaults. Explicit positional or `.run({ documents })` values take precedence over the prepared pair. Configured documents serve as a fallback for a query-only result.

As a tool, the model supplies only the query. Candidates come from configured `documents` or from a preparer, so the model never copies documents into its tool arguments. A function preparer can fetch candidates for each query, making one component a retrieve-and-rerank tool:

<!-- typecheck: retrieval-tool -->
```typescript
const findPolicy = create.Reranker.withFunction.asTool({
  model: rerankingModel,
  description: 'Find the policy passages most relevant to a question.',
  inputSchema: z.object({ question: z.string() }),
  topN: 3,
  query: async ({ question }) => ({ query: question, documents: await searchPolicies(question) }),
});
```

The model receives the native ranking entries as `{ originalIndex, document, score }`, retaining the original candidate indices. The SDK passes `topN` to the reranking operation. `searchPolicies` stands for your search service.

The result preserves the SDK ranking and document mapping. Reranker operates on candidates you supply; your application or retrieval service manages the index. See [SDK reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking) and [return fields](https://ai-sdk.dev/docs/reference/ai-sdk-core/rerank#returns).

### ImageGenerator

`ImageGenerator` generates images from a prompt and supports editing when the model provides it.

<!-- typecheck: image-generator -->
```typescript
const illustrator = create.ImageGenerator({ model: imageModel });
const pictures = await illustrator.run({
  prompt: 'A watercolor illustration of a recycling workshop.',
  n: 2,
});

console.log(pictures.images);
```

Configure an image model and reusable defaults. Shorthand accepts text, reference images, mask and count: `(text, images?, mask?, n?)`. Prepared calls put context before media: `(source, context, images, mask, n)`, or `(context, images, mask, n)` with a configured source. This applies to templates, scripts, functions and loaded sources. Omit identifiable optional slots: `(textTemplate, context, images)` has no mask; `(textTemplate, images)` omits satisfied context; `(text, n)` requests a count without media. Required context still has to be supplied or configured. `.run({ prompt, images, mask, n, ...settings })` names these inputs and supports size, aspect ratio and seed. Available counts, sizes and editing options depend on the model.

All input modifiers and `.asTool` are supported. An inline template can be a string or an SDK image-prompt object: Casai renders the object's `text` and retains its `images` and `mask`. Script/function preparation can produce the complete text prompt or image-prompt object. As a tool, the generated images go to your application and, as image content, to the model; see [specialized components as tools](#specialized-components-as-tools).

Configured images can provide a reusable visual style while each call describes a new subject:

<!-- typecheck: image-style-tool -->
```typescript
const drawInStyle = create.ImageGenerator.withFunction.asTool({
  model: imageModel,
  description: 'Draw the requested subject using the reference style.',
  images: styleReferences,
  prompt: ({ prompt }) => prompt,
  inputSchema: z.object({ prompt: z.string() }),
});

const cabin = await drawInStyle({ prompt: 'A mountain cabin at sunset.' });
```

The preparer explicitly selects the validated payload text and retains `styleReferences`; model tool execution with the same payload does the same. For plain components, `.run({ prompt: 'New subject' })` retains configured images and mask. Positional or named media inputs override supplied fields and retain omitted defaults, with the image/mask coupling below. Image arrays replace rather than concatenate. In split/field overrides, an empty resolved array selects text-only generation; a mask without images is rejected, and a text value must be available. Complete native objects are passed through with native semantics. Supplying new images, including `[]`, drops the configured mask unless that call also supplies a mask. Text-only changes and omitted/undefined images retain the configured images and mask.

You can also configure `images` and `mask` separately from the source. This is useful when `prompt` holds a function, script or loaded resource rather than a native image-prompt object:

<!-- typecheck: image-preparer -->
```typescript
const drawSubject = create.ImageGenerator.withFunction({
  model: imageModel,
  images: styleReferences,
  inputSchema: z.object({ subject: z.string() }),
  prompt: ({ subject }) => `A watercolor illustration of ${subject}.`,
});

await drawSubject({ subject: 'a mountain cabin' }); // Uses styleReferences.
await drawSubject({ subject: 'a mountain cabin' }, otherReferences);
```

The same defaults work with text, template and loaded sources, including prepared tools; they are not published as model arguments. Call-time media override these defaults. Separate media defaults survive source-mode changes through ordinary configuration inheritance: replacing only configured `images` retains an inherited separate `mask`. To replace the images and remove that mask, use `{ images: newReferences, mask: undefined }` in child configuration. A mask-only update retains inherited images. Own undefined clears a configuration field, while invocation undefined retains its default. At call time, supplying new images still drops the configured mask unless that call also supplies a defined mask.

A configured native prompt object, including a structured template, supplies its own media bundle instead of borrowing separate configured defaults. Complete explicit prompt objects and complete function/script results likewise select their own media and ignore all configured media defaults. Separate invocation fields can override the selected bundle's images or mask.

An explicit native image-prompt source replaces the whole bundle and follows native source validation. A separate application-context schema does not validate that authored source or a preparer result. When an object is supplied inside a public model/tool `prompt` argument, that argument schema must permit it; a string-only tool argument rejects it. `.run({ prompt: { images: [newPhoto], text: 'New instructions' } })` selects those images and removes any configured mask. To remove references, use `.run({ prompt: 'New subject', images: [] })`; that field-override form sends text-only generation. An explicit native `{ images: [], text }` keeps native edit semantics and is not a clearing shortcut. Separate invocation `images` and `mask` override the corresponding fields of any complete prompt object, including function/script results. Replacing images drops the old mask unless the call supplies a defined mask; replacing only the mask keeps the images. For example, `image.run({ mask: newMask })` changes only the mask, and `image.run({ images: [newPhoto] })` replaces the images and drops the old mask. Text-only source updates retain configured media. Native bytes and input arrays are preserved without mutation.

The [result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-image#returns) includes generated images with their media data, warnings, and metadata. To understand an existing image with a language model, use [LLMAgent image messages](#images-and-files-in-llmagent-messages). See [SDK image generation](https://ai-sdk.dev/docs/ai-sdk-core/image-generation) for editing formats and provider options.

An image exposes `.uint8Array`, `.base64`, and `.mediaType`. For editing, supply the source bytes in a prompt object:

<!-- typecheck: image-edit -->
```typescript
import { readFile } from 'node:fs/promises';

const edited = await illustrator.run({
  prompt: {
    images: [await readFile('./workshop.png')],
    text: 'Change the wall color to light blue.',
  },
});
console.log(edited.images[0]?.mediaType);
```

This requires an editing-capable model. Serve image bytes with their reported media type, or construct a data URL from `.mediaType` and `.base64`.

Use the same native shape for an editing template:

<!-- typecheck: image-template -->
```typescript
const repaint = create.ImageGenerator.withTemplate({
  model: imageModel,
  inputSchema: z.object({ color: z.string() }),
  prompt: {
    images: [await readFile('./workshop.png')],
    text: 'Change the wall color to {{ color }}.',
  },
});

const blueWorkshop = await repaint({ color: 'light blue' });
```

### Transcriber

`Transcriber` turns a recording into a completed transcript.

<!-- typecheck: transcriber -->
```typescript
import { readFile } from 'node:fs/promises';

const transcriber = create.Transcriber({ model: transcriptionModel });
const recordedAudio = await readFile('./recording.wav');
const transcript = await transcriber(recordedAudio);

console.log(transcript.text);
console.log(transcript.segments);
```

`recordedAudio` is an SDK-supported audio value, such as audio bytes or a URL. The selected provider determines supported formats. The [result](https://ai-sdk.dev/docs/reference/ai-sdk-core/transcribe#returns) retains text, segments, language information, and other available SDK fields.

Use `.withScript`, `.withFunction`, or `.loadsScript` to obtain audio before transcription, and `.asTool` to expose the completed operation. Text/template modifiers do not apply to audio payloads. See [SDK transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription).

Native audio strings contain encoded audio; downloading requires a `URL` instance. A tool receiving a URL string can use its application schema to produce that native value:

<!-- typecheck: transcriber-url -->
```typescript
const transcribeUrl = create.Transcriber.asTool({
  model: transcriptionModel,
  description: 'Transcribe an audio recording at a URL.',
  inputSchema: z.object({
    audio: z.url().transform(value => new URL(value)),
  }),
});
```

The SDK handles the download and transcription. Casai does not guess whether a string is a URL or encoded audio. For model-selected URLs, set an application-appropriate limit with the native downloader:

<!-- typecheck: audio-download -->
```typescript
import { createDownload } from 'ai';

const downloadRecording = createDownload({ maxBytes: 20 * 1024 * 1024 });
// Set download: downloadRecording in the Transcriber configuration.
```

The native download path applies target/redirect checks and, on Node, resolved-address checks. A custom `download` replaces those protections as well as fetching; retain them through SDK helpers or your application's trusted retrieval policy.

### StreamingTranscriber

`StreamingTranscriber` produces transcript events while receiving live audio. It requires a streaming-capable transcription model and audio in the declared format. It uses the AI SDK's experimental `experimental_streamTranscribe` API.

<!-- typecheck: streaming-transcriber -->
```typescript
const transcriberStream = create.StreamingTranscriber({
  model: streamingTranscriptionModel,
});

// audioStream is a ReadableStream<Uint8Array | string> of raw audio chunks.
const transcriptStream = await transcriberStream(
  audioStream,
  { type: 'audio/pcm', rate: 24000 },
);

for await (const part of transcriptStream.fullStream) {
  console.log(part);
}
console.log(await transcriptStream.text);
```

Awaiting the call gives you the live result. The [result contract](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-transcribe#returns) has a single-consumer event stream: access and consume `fullStream` before awaiting final-result promises when you need both. Awaiting final results first lets the SDK consume the stream internally.

Casai preserves transcript delta, partial, and final events rather than converting them into `textStream` chunks. Consume `fullStream` explicitly for incremental transcription, or await `text` for use in a workflow. Automatic forwarding into a Template or Script text stream is not part of this contract. A transport or iteration failure can throw after delivering a prefix and reject pending final-result promises. An `error` event is different: native final results can still resolve if a valid finish follows. Casai preserves those SDK outcomes; it does not recover a final transcript from partial events or add a stricter error policy.

Use `(audio, inputAudioFormat)` or `.run({ audio, inputAudioFormat })`. Configure `inputAudioFormat` to shorten this to `transcriberStream(audioStream)`; both entry paths require an unconfigured format. Tool forms require a configured format because their model-facing arguments are preparation data.

A request-specific component can configure its one-shot audio and be called without arguments:

<!-- typecheck: configured-live-input -->
```typescript
const transcribeThisRequest = create.StreamingTranscriber({
  model: streamingTranscriptionModel,
  audio: requestAudio,
  inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
});
const transcript = await transcribeThisRequest();
console.log(await transcript.text);
```

The same rule applies to configured StreamingTranslator audio and StreamingSpeechGenerator text streams. Inheritance shares that input object; it does not make another stream. Once a ReadableStream is handed to an SDK call through this runtime's streaming adapters, handing that exact object off again throws ValidationError, even through a different component. A failed SDK attempt still spends the input; failures before dispatch do not. No stream is cloned, buffered, tagged or mutated. Consumption outside Casai, different wrappers over one resource and generic iterator reuse retain their native/source limitations.

For repeatable operations, a configured function/script preparer can open a fresh stream each time. Normal native LLMAgent results also provide independent textStream projections from the same execution: a preparer can obtain a new view per invocation. Capturing one view in configuration does not make that view reusable. Explicit `makeSharedIterable` sharing retains history; its owner controls disposal. Audio still needs a new `toReadableStream(sharedAudio)` bridge per call, while streaming speech can accept a replayable iterable directly. Casai does not enable replay automatically for live input.

On prepared components, one object is application context. To supply an audio format when context is optional, use `transcribe({}, format)`, `transcribe(undefined, undefined, format)`, or `.run({ inputAudioFormat: format })`. The format object cannot occupy the context slot.

Script/function modifiers can obtain raw audio; supply format after their context or through `.run()`. `.asTool` is available only after `.withScript`, `.withFunction`, or `.loadsScript`. Its model-facing arguments are the preparer's named input fields, not a raw stream:

<!-- typecheck: transcription-tool -->
```typescript
const transcribeRecording = create.StreamingTranscriber.withFunction.asTool({
  model: streamingTranscriptionModel,
  description: 'Transcribe a stored recording.',
  inputSchema: z.object({ recordingId: z.string() }),
  inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
  audio: async ({ recordingId, _toolOptions: { abortSignal } }) =>
    openRecordingAsPcmStream(recordingId, { signal: abortSignal }),
});
```

Here `openRecordingAsPcmStream` is an application helper that opens a fresh, finite raw PCM stream in the configured format for each execution. A preparer may also provide an explicit normal completion boundary. The tool selects `text`, `segments`, `language` and `durationInSeconds` from that execution's native final-result promises; the model receives transcript text by default. The SDK consumes the stream, and native promise rejection or success is preserved. Casai does not concatenate events, add another reader or share an already-consumed source between calls. An indefinitely open source is not a valid tool input. Direct component calls still return the live SDK result. See [SDK streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription).

### SpeechGenerator

`SpeechGenerator` converts text into spoken audio.

<!-- typecheck: speech -->
```typescript
const speaker = create.SpeechGenerator({ model: speechModel });
const spoken = await speaker('Your replacement is on its way.');

console.log(spoken.audio);
```

Configure a speech model and reusable defaults. Shorthand takes `(text, voice?)`, such as `speaker('Welcome home.', 'alloy')`. Format and narration controls use `.run({ text, voice, outputFormat, instructions, speed, language })`; for example, `.run({ text: 'Welcome home.', outputFormat: 'wav', instructions: 'Speak warmly.', speed: 0.9 })`. All input modifiers prepare the text to speak; `.asTool` is also supported. As a tool, audio goes to your application and the chat UI, while the model receives a short confirmation.

The [result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-speech#returns) retains generated audio, format information, and metadata. Combine Transcriber, LLMAgent, and SpeechGenerator for a recording-to-answer workflow. See [SDK speech generation](https://ai-sdk.dev/docs/ai-sdk-core/speech).

`spoken.audio` exposes `.uint8Array`, `.base64`, and `.mediaType`. To return playable audio from a server handler:

<!-- typecheck: speech-response -->
```typescript
const audioResponse = new Response(Uint8Array.from(spoken.audio.uint8Array), {
  headers: { 'Content-Type': spoken.audio.mediaType },
});
```

When saving to a file, choose an extension matching the actual media type or configure a supported output format explicitly.

### StreamingSpeechGenerator

`StreamingSpeechGenerator` speaks a complete string or a native stream of text deltas/parts. Use a streaming-capable speech model; the SDK reports unsupported models. The current OpenAI speech adapter generates complete audio, while the SDK's [streaming speech example](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-speech) uses ElevenLabs.

<!-- typecheck: streaming-speech -->
```typescript
const answerer = create.LLMAgent.asStream({ model });
const say = create.StreamingSpeechGenerator({
  model: streamingSpeechModel,
});

const reply = await answerer('Describe a peaceful mountain scene.');
const spoken = await say(reply.textStream);

for await (const part of spoken.fullStream) {
  if (part.type === 'audio') {
    await sendAudio(part.audio, part.audioFormat); // Your application's transport.
  }
}
console.log(await spoken.usage);
```

Shorthand is `(textOrTextStream, voice?)`; `.run()` accepts the native fields by name. Text can also be an iterable/array of strings or native text parts with per-part voice/provider options. Templates and text loaders produce a complete string; script/function preparation can return any native text input. Incoming text chunks stay data and are not templated. Whether synthesis begins before text ends depends on the provider. A configured stream/iterator can bind a single-use component; strings, arrays and genuinely replayable iterables can be reused. For repeated consumption, pass a fresh stream or obtain a new branch in a preparer.

Select either `audioStream` for bytes or `fullStream` for audio format, raw and error parts, before accessing final metadata promises. These are alternative single-consumer views. Chunks need not be standalone audio files. Native error events, callback behavior, cancellation and finish/failure behavior are preserved; `audioStream` skips error parts, while `fullStream` exposes them. Streaming output format is a native audio-format object, unlike SpeechGenerator's string format. The component returns a live SDK result and has no collected-audio tool mode.

### StreamingTranslator

`StreamingTranslator` translates live raw speech into target-language audio and text through the SDK's [streaming translation operation](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-translate). A supporting provider model is required; OpenAI exposes `translation('gpt-realtime-translate')`.

<!-- typecheck: streaming-translation -->
```typescript
const translate = create.StreamingTranslator({
  model: translationModel,
  inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
  targetLanguage: 'fr',
});

const translated = await translate(audioStream);
for await (const part of translated.fullStream) {
  console.log(part.type); // Audio and source/translated text events.
}
console.log(await translated.translationText);
```

Shorthand takes `(audio, inputAudioFormat?, targetLanguage?)`. Configure either secondary input or supply it at invocation; `translate(audioStream, 'es')` can omit a configured format. `.run()` names the same fields and native options, including source language and output format. Script/function preparers can open raw audio; text/template modifiers do not apply to it. Required context remains explicit where its object shape overlaps an audio-format object.

Consume the single `fullStream` before final text/metadata promises when both are needed. Audio parts keep their native bytes-or-base64 form; final source/translation text comes from the SDK's finish data. An audio-only provider may return empty translation text. There is no separate audioStream alias or collected-audio tool mode. Provider language/format validation, errors and cancellation retain native behavior.

### VoiceSessionSetup

`VoiceSessionSetup` prepares browser voice connections with a realtime model. It uses the AI SDK's experimental realtime API. The SDK distinguishes token-based turn-based sessions from current Live WebRTC/server-relay setup; their connection and delegation protocols differ.

In token-based turn-based sessions, the browser runs capture/playback, text input and supported interruption controls, and receives tool calls. The server creates a short-lived token with initial instructions/voice and runs tools that need server-side data or secrets. This setup form is:

<!-- typecheck: voice-token -->
```typescript
const support = create.VoiceSessionSetup.withTemplate({
  model: realtimeModel,
  instructions: 'You are the support agent for {{ company }}. Keep answers short.',
  inputSchema: z.object({ company: z.string() }),
  voice: 'alloy',
  tools: { lookupOrder },
  toolsContext: { lookupOrder: { accountId: authenticatedAccount.id } },
});

// In the token route: accept only this application's browser preferences.
const pcm24k = z.strictObject({
  type: z.literal('audio/pcm'),
  rate: z.literal(24000),
});
const browserRequest = z.object({
  sessionConfig: z.object({
    voice: z.enum(['alloy', 'verse']).optional(),
    inputAudioFormat: pcm24k.optional(),
    outputAudioFormat: pcm24k.optional(),
  }).optional(),
}).parse(await request.json());

const setup = await support.run({
  ...browserRequest.sessionConfig, // Parsed allowlist; server policy is excluded.
  context: { company: 'Acme' },
});
// Respond with setup: { token, url, expiresAt, tools }.

// In the route the browser calls from its onToolCall handler:
const output = await support.executeTool(
  { toolCallId, toolName, args },
  {
    abortSignal: request.signal,
  },
);
const toolResponse = Response.json(output === undefined ? null : output);
// Return toolResponse; the browser's onToolCall returns await response.json().
```

The SDK browser sends `{ sessionConfig }` to the token route. Select the preferences your application permits; the example accepts two voices and 24 kHz PCM. Other browser fields are not forwarded. Trusted server `.run()` calls can set native voice, modalities, audio formats/transcription, turn detection and provider options, along with token expiration. Instructions and registered tool definitions come from server configuration/preparation. Providers that require session config when creating the token receive the full prepared config.

The ordinary call prepares instructions and returns SDK session setup; `.run()` is its named form. The component holds no mutable session state. The browser owns the live connection. `executeTool(call, executionOptions)` selects an available registered tool, validates its arguments/context through the same runner as other Casai tool calls, and executes once, forwarding the supplied call ID and cancellation. Unknown or unavailable tools are rejected. Model arguments remain separate from server-supplied trusted context.

`executeTool()` is a direct executor, like a native tool's `execute()`: it does not evaluate `needsApproval` or run the LLMAgent approval loop. The application must authorize the call and obtain any required user approval before invoking it.

This method returns the tool's execution result. The realtime browser sends that result as native function-output JSON; it does not apply the language-generation tool's `toModelOutput` formatter. Returning encoded audio or images therefore sends tool data rather than playing audio or creating a rich media tool message. Use the native session's speech response or application playback for audio delivery.

Convert a completed `undefined` result to JSON `null` at the HTTP boundary, as above. Native `onToolCall` treats an `undefined` return as no automatic submission, so returning it directly leaves the call pending. `Response.json(undefined)` also fails. The helper preserves the original execution result; this conversion belongs to the application's transport response.

A rejected `onToolCall` callback only notifies native `onError`; it does not submit a function output. The browser relay must therefore choose how to settle HTTP, validation and transport failures. For an application that wants the conversation to continue with a bounded failure message:

<!-- typecheck: voice-relay-errors -->
```typescript
import type { Experimental_RealtimeSessionOptions } from 'ai';

const onToolCall: NonNullable<Experimental_RealtimeSessionOptions['onToolCall']> =
  async ({ toolCall }) => {
    try {
      const response = await fetch('/api/voice/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolCall),
      });
      if (!response.ok) return { error: 'The tool result could not be obtained.' };
      return await response.json();
    } catch {
      return { error: 'The tool result could not be obtained.' };
    }
  };
```

Supply this callback to the native browser session. The returned error object is application data sent through the native function-output protocol, rather than a Casai error envelope. It does not disclose server error details, assert that the action had no effects or retry it. An application may instead deliberately keep the call pending for later submission or close the session; an error notification alone does not settle it. Server `.executeTool()` keeps its normal throwing behavior.

Use authenticated application endpoints exposing only the account's allowed tool registry; the SDK recommends application-specific tool endpoints. Each route constructs or recovers the matching server-owned configuration and context, including public defaults selected during setup. The example's `authenticatedAccount` comes from server authentication, and `request` is the execution HTTP request. The browser relays the native call and returns its response to the SDK. `.executeTool()` reuses Casai's validation/dispatch within that boundary; the application still owns transport and authorization.

The helper exposes no global HTTP router and grants no operation permission. Prepared instructions are initial guidance; clients can update session guidance under the native protocol. The native token response carries tool definitions, rather than an authoritative replacement for all browser session configuration.

For Live, use the SDK's WebRTC SDP setup or server WebSocket relay capability. Live client delegations appear in session metadata/events and do not invoke `onToolCall` or use `addToolOutput`. The application selects its intended component/tool and sends context/results through native `sendEvent({ type: 'context-append', ... })`. Keep provider credentials and allowed native event/delegation policy on the server. Native experimental setup methods such as `doCreateWebRTCSession` are published SDK interfaces; they are usable while experimental.

With no tool definitions, prepared session configuration omits the `tools` property entirely. OpenAI Live rejects that property even when undefined; configuring function tools on Live preserves the native setup/startup error. Use its native delegation protocol rather than advertising turn-based function tools. The documented `executeTool` route serves turn-based sessions; Live applications call selected components directly and send native context/delegation events. The helper does not add Live function-tool support.

One `VoiceSessionSetup` accepts a native realtime model instance. Ordinary calls and `.run()` perform token setup; `createWebRTCSession` performs native SDP setup and returns `{ sdp, sessionId }`. `prepareSessionConfig` supplies prepared configuration for relay/browser startup, and `executeTool` runs allowed server tools. Use the existing model directly for server WebSocket connection information. Unsupported capabilities report their native limitation; the component does not silently choose another transport.

<!-- typecheck: voice-live -->
```typescript
const liveSupport = create.VoiceSessionSetup.withTemplate({
  model: liveModel,
  instructions: 'Help customers of {{ company }}. Keep answers concise.',
  inputSchema: z.object({ company: z.string() }),
  providerOptions: { openai: { delegation: { type: 'client' } } },
});

const answer = await liveSupport.createWebRTCSession({
  sdp: offerSdp,
  context: { company: 'Acme' },
  abortSignal: request.signal,
});
// Return the native answer to the SDK browser's api.session endpoint.
```

`liveModel` is a provider model with the native Live WebRTC capability. The server selects its allowed native delegation/event policy; do not replace it with policy submitted by the browser. For an application-owned WebSocket relay, obtain native connection information and prepared session configuration separately:

<!-- typecheck: voice-relay -->
```typescript
const connection = await liveModel.getServerWebSocketConfig!();
const sessionConfig = await liveSupport.prepareSessionConfig({
  context: { company: 'Acme' },
});
// Use connection only on the server; its headers can contain provider credentials.
// Use sessionConfig with the SDK's native startup serialization in your relay.
```

The component prepares configuration and setup responses; the native model supplies relay connection information. Neither opens a connection or captures audio. The browser continues to use the SDK's experimental realtime interface.

Text and template modifiers prepare the instructions; script and function modifiers return them. VoiceSessionSetup has no `.asTool`. See [SDK realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime) for the browser session and provider support.

## Sources, loaders and rendering

Templates, scripts, and their AI input modifiers add Cascada rendering settings to the [shared configuration](#common-component-contracts). This section covers source handling, context helpers, loading and rendering controls.

### Source Properties

Standalone Template uses `template`; standalone Script uses `script`. LLMAgent uses `prompt`, with the modifier determining whether it contains literal input, a template, a script, a function, or a resource name. A one-off replacement goes in the same property: as the first argument of the ordinary call, or as `prompt` in `.run()`.

Configured inline templates and scripts are compiled for reuse, with syntax errors reported when called. Loaded sources resolve on first use through Cascada's native environment cache, preserving source origin, declaring loaders, relative imports, reload policies, `noCache`, and invalidation. Casai adds no general compilation cache. A one-off resource name can bypass a missing configured resource.

### Context

The shared [context](#common-component-contracts) can contain values, synchronous or asynchronous functions, promises, and other components. In templates and scripts, Cascada resolves asynchronous values when their results are needed:

<!-- typecheck: template-context -->
```typescript
const orderStatus = create.Template({
  template: 'Order {{ id }}: {{ getStatus(id) }}',
  inputSchema: z.object({ id: z.string() }),
  context: {
    getStatus: async (id: string) => `ready for collection (${id})`,
  },
});

console.log(await orderStatus({ id: 'A123' }));
```

These helpers use the same [application input and private-binding rules](#input-defaults-and-private-context) as other components; Cascada adds asynchronous evaluation of the prepared values.

### Filters

Filters transform values using the template pipeline operator. They may be synchronous or asynchronous:

<!-- typecheck: filters -->
```typescript
const label = create.Template({
  template: '{{ title | shout }}',
  filters: { shout: (value: string) => value.toUpperCase() },
});

console.log(await label({ title: 'Weekly report' }));
```

### Loader

A loader resolves named sources for `.loadsText`, `.loadsTemplate`, and `.loadsScript`, as well as template/script imports and includes.

<!-- typecheck: loaded-agent -->
```typescript
import { FileSystemLoader } from 'casai';

const loadedWriter = create.LLMAgent.loadsTemplate({
  model,
  loader: new FileSystemLoader('./prompts'),
  prompt: 'summary.njk',
});

const summary = await loadedWriter({ text: 'A document to summarize.' });
```

Put a template such as `Summarize this document: {{ text }}` in `./prompts/summary.njk`. To select another resource for one call, pass its name as the first argument or as `prompt` in `.run()`.

| Loader | Use |
| :--- | :--- |
| `FileSystemLoader` | Read local files in Node.js; relative imports resolve from the containing file |
| `WebLoader` | Load sources from a base URL |
| `PrecompiledLoader` | Load sources precompiled with Cascada |

Custom loaders have two forms, both supported directly by Cascada:

| Form | API | Type from `cascada-engine` |
| :--- | :--- | :--- |
| Function | `loader(name)` | `LoaderFunction` |
| Object or class | `loader.load(name)` | `LoaderInterface` |

A plain object works; no class is required. Both forms return text, a `{ src, path, noCache }` object, or `null` for a missing resource. They may return a promise. Throw for a loading failure. Plain `.loadsText` requires text rather than a precompiled template or script.

<!-- typecheck: custom-loader -->
```typescript
const sources: Record<string, string> = {
  'welcome.njk': 'Welcome {{ name }}!',
};
const load = async (name: string) => sources[name] ?? null;
const loader = { load }; // Or pass the load function directly below.

const welcome = create.Template.loadsTemplate({
  loader,
  template: 'welcome.njk',
});
console.log(await welcome({ name: 'Ada' }));
```

Object/class loaders can also provide `isRelative(name)` and `resolve(from, to)` for relative paths, and `on(event, handler)` for load/update events. Existing `getSource` loaders are also supported.

#### Combining loaders

Use an array to try loaders in order. Use `raceLoaders` to try them together:

| Setting | What happens |
| :--- | :--- |
| `[loaderA, loaderB]` | Try A, then B only if A returns `null` |
| `raceLoaders([loaderA, loaderB])` | Start both; use the first source found |
| `raceLoaders([[loaderA, loaderB], loaderC])` | Start A and C; try B only if A misses |

Use `raceLoaders` when loaders hold different files, such as billing and support templates. If both hold the requested file, the first one to return it wins. Use an array when one loader should take priority.

A child normally tries its loaders before its parent's:

| Child's `loader` setting | What happens |
| :--- | :--- |
| A loader or array | Try the child, then the parent if the file is missing |
| `raceParent(loaders)` | Try the child and parent together |
| `overrideParent(loaders)` | Use only the child's loaders |
| Omitted or `undefined` | Keep the parent's loaders |

Put `raceParent` or `overrideParent` directly in `loader`, not inside an array or another helper. Both work without a parent. An empty array still allows parent lookup; `overrideParent([])` removes the parent's loaders.

For example, with configured `sharedLoader` and `localLoader`:

<!-- typecheck: loader-composition -->
```typescript
import { create, raceParent } from 'casai';

const parent = create.Config({ loader: sharedLoader });
const page = create.Template.loadsTemplate({
  template: 'billing/invoice.njk',
  loader: raceParent(localLoader),
}, parent);
```

Here, `localLoader` and the parent's loader start together. To give the local file priority instead, use `loader: localLoader`.

Cascada uses the configured loaders for `include`, `import`, and other file-loading operations.

With ordinary inheritance, a parent's `pages/main.njk` including `./part.njk` uses the child's `pages/part.njk` if present, then the parent's file if missing.

With `raceParent`, relative files stay with whichever side found the main file. If the child finds the template but only the parent has its `./part.njk`, that include fails.

`raceLoaders` takes one array, which may be empty or contain one loader. If all loaders miss, it returns `null`. If none succeeds and one fails, it reports an error. An array stops on a loading error. Started loads are not cancelled.

`.config.loader` contains the combined loaders without the parent helpers. Use `LoaderGroup` for that value and `LoaderInput` for a setting that may use those helpers. Cascada handles caching, reload policies, and loader updates.

### Render Options

`renderOptions` configures Cascada rendering, for example `trimBlocks` or standalone template HTML escaping:

<!-- typecheck: render-options -->
```typescript
const page = create.Template({
  template: '<h1>{{ title }}</h1>',
  renderOptions: { autoescape: true, trimBlocks: true },
});

console.log(await page({ title: 'Research & development' }));
```

Standalone templates default `autoescape` to `false`. All AI component source preparers disable HTML escaping, including image prompts and speech text, even when `renderOptions.autoescape` is true; use an explicit filter or function when your application needs escaping. Renderer options, filters, and loaders are creation-time settings. Source caches respect loader updates and `noCache`.

## Conversational AI: Managing Message History

Each call carries the conversation so far as its `messageHistory`. The ordinary call takes the new prompt or context first and the message history last, and the result's `messageHistory` holds that history, the new turn, and the reply. Store it and pass it to the next call. A component holds no conversation of its own, so one component serves many users.

Casai history inputs accept `readonly ModelMessage[]`, including frozen arrays: shorthand history, `.run({ messageHistory })` and `.resume(history)`. Casai copies the outer array and borrows its messages; keep those messages unchanged while the call or stream is running. Native `.generate()`/`.stream()` parameters retain the SDK's own types.

<!-- typecheck: history -->
```typescript
import type { ModelMessage } from 'ai';

const chat = create.LLMAgent({
  model,
  instructions: 'Answer clearly and concisely.',
});

let messageHistory: ModelMessage[] = [];

const first = await chat('My project is called Orchard.', messageHistory);
console.log(first.output); // Check final output before saving an ordinary answer.
messageHistory = first.messageHistory;

const second = await chat('What is my project called?', messageHistory);
console.log(second.output);
messageHistory = second.messageHistory;
```

`.run({ prompt, messageHistory, ...settings })` takes the same input with settings; rendered forms use `.run({ context, messageHistory })`.

To continue with history alone:

<!-- typecheck: history-run -->
```typescript
const continued = await chat.run({ messageHistory });
```

This example's `chat` has no configured prompt, so the call adds no new turn. If a prompt is configured, the same call prepares and appends it as usual. Execution settings and the presence of an empty `context` do not change prompt resolution. A positional array always means history. Supply new messages explicitly with `agent.run({ prompt: newMessages, messageHistory })`.

| Result field | Contents |
| :--- | :--- |
| `messageHistory` | The supplied `messageHistory`, the new turn, and all generated messages |
| SDK `responseMessages` | Generated messages across all model steps, without input history |
| SDK `response.messages` / `finalStep.response.messages` | The SDK's generated response messages for the final step |

Use `result.messageHistory` as the conversation state for the next turn. For streaming, use `await result.messageHistory` after consuming the stream.

All agents accept `agent(messageHistory)` when no payload is required, or `agent(context, messageHistory)` when it is. History is never rendered. The configured prompt is prepared and appended as a new turn; a string source override such as `agent("Explain {{ topic }}", { topic: "embeddings" }, messageHistory)` renders only that new prompt. For an authored message-array template, use configuration or `.run({ prompt: templateMessages, context, messageHistory })`. Do not put already rendered history into a prompt slot. Native message objects have no rendered/executed marker; the explicit source/history boundary supplies that distinction.

`messageHistory` is Casai's field; SDK results have no field holding the whole conversation. An SDK application keeps its input messages and appends `responseMessages`, but a rendered agent prepares the new turn itself, so the application never sees it. Casai adds the field without changing SDK response fields or callback payloads. Wherever Casai stores or passes a conversation, it uses the name `messageHistory`; `messages` remains only in the SDK's own APIs.

When appending to an existing SDK conversation, use SDK `responseMessages`. It remains generated messages only, so `[...inputMessages, ...result.responseMessages]` does not duplicate the input. When the [SDK methods](#sdk-agent-and-ui-integration) receive a complete conversation in `prompt` or `messages`, `messageHistory` includes it once; Casai does not guess where the new turn begins.

Fixed guidance belongs in `instructions`, which apply to every call. Messages returned by a script or function prompt are appended after the history. `messageHistory` records the conversation, not the request: if a `prepareCall` hook adds example turns or trims old history before sending, the stored history still holds the whole conversation.

History follows native `responseMessages` availability and rejection, without a separate execution-success check. It may retain partial or earlier messages after a provider failure or an error finish reason. Output parsing failure also does not erase available messages. Inspect native finish reasons and tool/approval events before deciding how to continue; resolved history is not proof of success or safe resumability. A generation call that rejects does not return a separate history handle.

For an ordinary answer, consume native output and inspect finish reasons and errors before saving history according to application policy. Schema validity alone does not certify completed tool work. For tool/approval pauses, save pending history deliberately and continue with a new invocation. Observe native error callbacks/events too; SDK limitations can retain earlier completed steps after later failure.

Casai does not persist, summarize, or truncate history automatically. Store it per conversation and manage its size in your application. Preserve tool calls with their corresponding results and approval messages when selecting history for another turn.

### Render Only the New Message

Pass a new message as data in rendering context, alongside previously prepared history. Casai renders the configured template for this call and keeps the rendered prompt in the returned history:

<!-- typecheck: rendered-history -->
```typescript
const templatedChat = create.LLMAgent.withTemplate({
  model,
  prompt: 'Help with this request:\n{{ message }}',
  inputSchema: z.object({ message: z.string() }),
});

let messageHistory: ModelMessage[] = [];
for (const message of ['My project is called Orchard.', 'What is my project called?']) {
  const result = await templatedChat({ message }, messageHistory);
  messageHistory = result.messageHistory;
  console.log(result.output);
}
```

`message` is an application-chosen template variable, not a reserved argument. Its contents are data, so text containing `{{ ... }}` is not evaluated again as template source. Only the current context is validated and prepared; earlier rendered messages pass through unchanged. Create the agent with `.asStream` for the same preparation with incremental generation, then obtain history from `await result.messageHistory`.

If a rendered turn pauses for approval, retain its raw `{ message }` with the pending history. The later call is `templatedChat.resume(saved.history, { context: saved.context, approve: selectedIds })`; the required field comes from the actual paused turn. Retain per-call `toolsContext` inputs too when used, and reconstruct compatible public defaults and trusted bindings. Hooks see that turn's newly prepared context without rendering it again.

For application-managed rendered conversations, store the prepared `messageHistory` and have the client send only the new turn's data. The SDK's complete conversation doesn't identify a new turn to render, so don't feed it through the rendered Casai call as fresh input. Native `.generate()`/`.stream()` accept that conversation literally, skip rendering and still require the agent's application context contract. To regenerate a reply, call again with the same input and the history before that turn. To continue after tool approvals, use [`resume()`](#tool-approvals-and-continuation), which adds no turn. Native UI-stream consumers additionally retain their UI messages; prepared model history and original text alone do not provide the tool-part state needed to continue a UI message.

## Images and Files in LLMAgent Messages

For image understanding, pass an image content part to a capable language model:

<!-- typecheck: vision -->
```typescript
const vision = create.LLMAgent({ model: visionModel });
const description = await vision([
  {
    role: 'user',
    content: [
      { type: 'text', text: 'Describe the visible damage.' },
      { type: 'image', image: new URL('https://example.com/product.png') },
    ],
  },
]);

console.log(description.output);
```

Replace the example URL with your own image. File parts and other supported message content also remain structured through Casai preparation. Script/function prompts can return these message arrays directly.

The model and provider determine supported media and formats. Generated files and content parts remain available on LLMAgent results. `output` controls parsed text or structured values; use ImageGenerator, Transcriber, or SpeechGenerator for their dedicated operations.

Inline multimodal templates use the SDK's own prompt shapes. Casai renders their text fields and retains image/file parts, masks, roles, order and metadata. For an LLMAgent, put the new message in `prompt`:

<!-- typecheck: multimodal-template -->
```typescript
const inspectPhoto = create.LLMAgent.withTemplate({
  model: visionModel,
  inputSchema: z.object({ focus: z.string() }),
  prompt: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Describe {{ focus }} in this photo.' },
      { type: 'image', image: new URL('https://example.com/photo.png') },
    ],
  }],
});

const description = await inspectPhoto({ focus: 'the furniture' });
```

Only text in the selected template source is rendered. Attachments, tool arguments/results, application data and existing `messageHistory` stay literal. Native `.generate()`/`.stream()` calls also keep their conversations literal. Loaded templates still load a string; a script/function preparer can combine a rendered Template with attachments when needed.

## SDK Agent and UI integration

An ordinary LLMAgent exposes `version`, `id`, `tools`, `.generate()`, and `.stream()` for SDK Agent/UI helpers.

<!-- typecheck: current-sdk-ui -->
```typescript
import { createAgentUIStreamResponse } from 'ai';

const assistant = create.LLMAgent({ model, instructions: 'Be concise.' });
const response = await createAgentUIStreamResponse({ agent: assistant, uiMessages });
```

`.generate({ prompt })` and `.stream({ messages })` accept native literal conversation arguments. They skip configured source loading/rendering while preserving input preparation, hooks, tools, and result augmentation. SDK `options` is solely the native entry-point spelling of Casai application context: `.generate({ prompt, options: { detail: 'deep' } })` sends that input through the same schema/privacy/default rules. Casai config and `.run()` use `context` and reject `options` / `callOptionsSchema`.

The SDK validates UI tool history against exposed `.tools` before `prepareCall`. Use the matching configured/bound descriptors for such history. Native transformed-argument history limitations remain native.

## Using components as tools

`.asTool` adds the SDK Tool descriptor while retaining ordinary calls, `.run()`, and `.config`. SDK execution returns completed application output; an LLMAgent tool returns its parsed final value, not its SDK result envelope. A tool form does not implement SDK Agent: it has no Agent-only `id`, `.generate()`, or `.stream()` properties. Derive ordinary Agent and tool forms from a common `Config` when you need both.

Every Casai tool requires an `inputSchema` with explicitly declared top-level public fields. Function, Template, Script and LLMAgent tools require a configured source/implementation. Specialized tools in plain form can instead read their operation input from the declared payload; prepared forms require their configured source. Open-root/catchall tool contracts are rejected; put dynamic dictionaries inside a declared `payload` or `attributes` field. Undeclared raw arguments are rejected before application parsing, even for stripping schemas. Native third-party tools retain native support.

Tool forms accept native function-tool settings such as `metadata`, `strict`, `inputExamples`, `toModelOutput` and input hooks. Use `toModelOutput` when the model should receive a smaller or differently encoded result than the application. Configure approval policy through the owning LLMAgent's `toolApproval`.

For Function, Template and Script tools, `providerOptions` configures the tool descriptor. For LLMAgent and the other model-backed tools, it configures the inner SDK operation and is not forwarded to the outer tool descriptor.

SDK-backed components forward native settings after removing Casai preparation and tool-descriptor fields. The SDK owns runtime handling of unknown native settings; Casai does not maintain a whitelist. TypeScript checks settings against the installed SDK types. Configuration-only Casai fields still cannot be replaced through `.run()`.

<!-- typecheck: current-agent-tool -->
```typescript
const summarize = create.LLMAgent.withFunction.asTool({
  model,
  inputSchema: z.object({ document: z.string() }),
  prompt: ({ document }) => `Summarize this document: ${document}`,
});
```

Literal/fixed-resource LLMAgent tools require a configured prompt. Use empty public input when no context is needed, or declared fields for hooks. Named inputs that affect prompt text require a template, script, or function preparer. A model-supplied property called `prompt` never automatically replaces executable/configured source.

### Specialized Components as Tools

Configuration and payload are separate. Only schema-declared fields from `config.context` provide public defaults; bound `toolsContext[toolName]` defaults override them, and supplied payload fields override both. This shallow merge is parsed by `inputSchema`. Undeclared context bindings remain private dependencies and cannot be replaced by payload fields. No other configuration fields enter the payload, and payload properties are never merged into configuration. Names such as `prompt` and `model` can be application fields without becoming configuration settings. Authored sources and prepared operation inputs are outside this schema boundary.

Every specialized `.run()` accepts a separate `context` payload. Plain non-tool shorthand supplies the native source and operation tail; any required payload must already be satisfied by `config.context`, or supplied through `.run({ context, ...settings })`. Plain `.asTool` components also accept their payload directly: `embedTool({ input: "hello" })`, or `embedTool(input="hello")` in Cascada. Both forms parse the payload and select its declared native input field. The priority is an explicit invocation source, then the parsed payload field, then the configured source. An object passed to a plain tool is payload; use `.run({ prompt: nativeBundle, context })` for a structured authored source. Ordinary calls return native results; registered tool helpers return the tool projection shown below.

In a specialized tool's plain literal form, including explicit `.withText`, its arguments are the operation input. Template/script/function and loaded-source forms take preparation context and keep their configured source/resource. `.withText` also selects literal input when deriving from a rendered parent; writing it explicitly does not discard the model's operation arguments. The tool result goes to your application and the chat UI, and the model can receive a different, smaller form:

| Component | Tool arguments without a modifier | The model receives | The application and UI receive |
| :--- | :--- | :--- | :--- |
| Decision | `{ state }` | Decision answers | Decision answers |
| Embedder | `{ input }`, a string or string array | Vectors | Vectors |
| Reranker | `{ query }`; candidates come from `documents` or a preparer | Native `{ originalIndex, document, score }` ranking entries | The same entries |
| ImageGenerator | `{ prompt }` | The generated images, as image content | Images as `{ mediaType, base64 }` |
| Transcriber | `{ audio }`; a URL-string schema can transform it to native `URL` | Transcript text | Transcript text, segments, language, and duration |
| StreamingTranscriber | No plain tool; named preparer context | Final transcript text | Final transcript text, segments, language, and duration |
| SpeechGenerator | `{ text }` | A short confirmation | Audio as `{ mediaType, base64 }` |

Model arguments supply operation input or preparation data, rather than an SDK settings envelope. A plain specialized tool's schema declares only its documented operation input fields, such as `prompt`, `audio`, `query`, or Embedder's `input`. The parsed field must supply the native input, or the component must configure a fallback source. For example, optional `{ input }` needs a configured Embedder `input` or a schema default; an ImageGenerator can use configured images without a prompt. A transform that removes the field needs a fallback too. Field-value transforms remain available, such as trimming `prompt` or converting a URL string in `audio` to `URL`. Custom argument names use an explicit preparer:

<!-- typecheck: image-tool-preparer -->
```typescript
const draw = create.ImageGenerator.withFunction.asTool({
  model: imageModel,
  description: 'Generate an image from a description.',
  inputSchema: z.object({ description: z.string() }),
  prompt: ({ description }) => description,
});
```

Loaded-text tools retain their configured resource. Declared arguments may be used by native tool callbacks such as `toModelOutput`, even when the loaded text is fixed; use a closed empty schema when no public data is needed. These fields do not become resource-name or model-settings overrides.

Plain schemas cannot declare settings such as `n`, `size`, `topN`, `model` or `providerOptions`; application-call positional parameters do not publish those settings to the model. To expose a model-selectable setting, use an application Function tool that validates the public choice and maps it to the operation's `.run()` call.

The model receives images as image content in the tool result, so no prompt rewriting is needed. Anthropic models and OpenAI's Responses API read such images; providers that can't read images in tool results reject or flatten them, and the SDK has no capability flag Casai could check in advance. For those models, set the SDK tool option `toModelOutput`, which `.asTool` accepts, to return text instead.

Transcription tool results contain only `text`, `segments`, `language`, and `durationInSeconds`. Provider responses, headers, warnings, and provider metadata remain available on ordinary native results, but are excluded from tool results and their UI history.

Base64 image/audio results can make saved and replayed UI history large. Image content may also be sent to the model again when that history is replayed. `toModelOutput` changes the model-facing form, not the execution result stored in the UI. For media storage or delivery, an application Function tool can store native generated bytes and return a reference or URL instead:

<!-- typecheck: image-storage-tool -->
```typescript
const makeIllustration = create.Function.asTool({
  description: 'Create an illustration and return its stored URL.',
  inputSchema: z.object({ prompt: z.string() }),
  context: { illustrator, mediaStore },
  execute: async ({ prompt, illustrator, mediaStore }) => {
    const result = await illustrator(prompt);
    return Promise.all(result.images.map(async image => ({
      mediaType: image.mediaType,
      url: await mediaStore.put(image.uint8Array, { mediaType: image.mediaType }),
    })));
  },
});
```

`mediaStore` is your application storage service. Returning URLs reduces the JSON history payload; it does not remove model image-processing costs if your formatter still supplies image content. For editing an uploaded image, prefer named attachment arguments and a preparer that resolves them to native image input. Native JSON-compatible encoded-image inputs also remain possible where the schema permits them; ordinary JavaScript callers can pass native bytes directly.

An LLM exposed as a tool must finish its own workflow within that tool execution. If it pauses for an inner approval, a client tool without `execute`, or a deferred provider result, the tool adapter rejects and the outer SDK records a tool error. The adapter exposes neither the inner history nor its pending approvals to the outer agent. Such tools are allowed because the pending path may never be taken or approval may be automatic. If the application must manage an inner pause, invoke that agent directly and retain its result/history for explicit continuation.

Tools expose completed application results. LLMAgent tools use generation only; Template tools return a rendered string; Script/Function declared stream results are collected, and StreamingTranscriber tools require a script/function preparer that opens bounded audio and return completed transcripts. VoiceSessionSetup has a separate session lifecycle and no implicit collection adapter. Plain SDK tools also work in an LLMAgent's `tools` map.

An SDK tool can yield preliminary results from an async generator. When called through a coded component's injected tool wrapper, a directly returned generator is consumed once and returns its final yielded value, following the [SDK convention](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preliminary-tool-results). Explicit SDK tools retain native result normalization, including the installed SDK's treatment of a promise resolving to an iterable as a single final value. Casai component tools require a declared stream kind: text joins into a string, and elements collect into an array. They reject an undeclared root async iterable instead of returning it to the SDK or guessing how to collect it. Progress updates are not collected into application data.


### Tool Approvals and Continuation

Use `resume(history, options?)` to continue a conversation without loading or rendering another prompt. Supply approval decisions through `approve`; use the other options for context and supported execution settings. It returns the same SDK result as an ordinary call, including `messageHistory`.

`resume()` belongs to non-tool LLMAgents, including `.asStream`. `.asTool` components do not expose it; they complete their tool execution and return a value.

An LLMAgent can return control when a tool needs approval or an external result. A larger `stopWhen` limit does not resolve that pending input. With SDK 7, use `toolApproval` for an approval policy:

<!-- typecheck: approvals -->
```typescript
const reviewCalculator = create.LLMAgent({
  model,
  tools: { multiply }, // The Function tool from the LLMAgent example.
  toolApproval: { multiply: 'user-approval' },
  stopWhen: isStepCount(5),
});

const pending = await reviewCalculator('Use multiply to calculate 37 times 29.');
const decided = new Set(pending.content.flatMap(
  part => part.type === 'tool-approval-response' ? [part.approvalId] : [],
));
const settled = new Set(pending.content.flatMap(
  part => part.type === 'tool-result' || part.type === 'tool-error' ? [part.toolCallId] : [],
));
const requests = pending.content.flatMap(
  part => part.type === 'tool-approval-request'
    && !decided.has(part.approvalId) && !settled.has(part.toolCall.toolCallId) ? [part] : [],
);
```

The call returns these requests; it does not remain open waiting for a person. Save this fresh paused step's request list together with its complete `messageHistory` and raw context/tool-context inputs as one conversation revision. Restore that record to show the requests after a reload or restart. Update the saved list with the history when recording decisions, external results or a later pause: display requests without a recorded decision or result, matching approval selection. Automatic requests normally have decisions; an automatic request missing its decision and result remains selectable. When rebuilding from history, use the active segment and last-write ID lookup described below rather than treating old step content as current state. Collect decisions against the displayed revision. If the user approves all displayed requests, pass their IDs explicitly:

<!-- typecheck: continuation -->
```typescript
const result = await reviewCalculator.resume(pending.messageHistory, {
  approve: requests.map(request => request.approvalId),
});
console.log(result.output);
```

Before applying a human decision, check the displayed revision against the application's authoritative conversation and coordinate concurrent updates. A stale tab's `approve: true` can approve new requests the person never saw. Explicit IDs reject resolved/unknown selections, but if the displayed IDs remain pending alongside a new request, the array denies that unseen request. IDs therefore do not replace a revision check. This persistence/concurrency check belongs to the application; `resume()` adds no revision option or pending-list service.

`resume(history, options?)` accepts `readonly ModelMessage[]` and starts a new invocation from saved history without rendering a prompt or adding a user turn. It does not reconnect to a live stream like the SDK UI client's `resumeStream()`. Its options are:

| Field | Contents |
| :--- | :--- |
| `context` | Application input, merged with configured defaults and validated as usual; required when configuration does not supply the necessary values |
| `approve` | `true` approves all remaining requests; `false` or `[]` denies all; a readonly ID array approves listed requests and denies the rest; omission, `undefined` or `null` supplies no decision |
| Execution settings | Applicable per-call settings such as `abortSignal`, `timeout`, tool settings and hooks |

To continue the **same paused turn**, retain its raw application `context` and any per-call `toolsContext` inputs alongside the history, then reuse or reconstruct them for resume. Required renderer fields still need their original values even though rendering is skipped: supply the actual earlier `message`, not a placeholder that changes what hooks see. Store raw schema input, not parsed hook output, and keep configured public defaults compatible. The application owns this record; Casai does not recover it from history. Reconstruct nonserializable trusted services as needed. Keep approved public arguments and defaults stable; private dependencies may change between requests.

Retain or deliberately reconstruct policy-dependent per-call settings too, such as `runtimeContext`, `toolApproval` and tool overrides. For local execution, the SDK re-evaluates policy using the continuation's inputs and messages; its last message may be a tool approval response. Current policy can deny a person's approval and skip local execution while the model still answers. Reconstruct current trusted authorization deliberately; do not treat an old runtime context as proof of continuing permission. Provider decisions need application authorization before forwarding.

Omitting `approve`, or explicitly passing `undefined` or `null`, supplies no new decisions and leaves approval handling to the SDK. Unanswered local approvals normally fail natively; a provider approval can be ignored without sending a decision. Cascada `none` and an unset decision variable produce null, so an unset variable does not catch a forgotten provider decision. Null never means denial or approval. IDs are `approvalId` values, not message or tool-call IDs. Repeated selector entries count once; unknown and already-resolved selections reject. These checks interpret the shorthand; they do not validate existing history or guarantee SDK execution. Supplying context or history with results never implicitly approves unrelated work. Per-request reasons can use native SDK messages.

When nothing is undecided, `approve: true`, `false` and `[]` add no decisions and still continue the conversation normally, including any already-approved work awaiting execution. They do not skip the next model step or make duplicate submissions idempotent. A nonempty list containing resolved IDs still rejects.

For results produced by a client or background worker, put native encoded `tool-result` parts in the final tool message alongside any matching approval responses. Preserve call IDs, tool names and provider metadata. Calls with recorded results need no new approval decision, and Casai does not reformat those results. Supply any tools still needing execution through configuration, supported call overrides or `prepareCall`.

Cascada keywords supply the options object: `agent.resume(history, approve=true, context={ topic: 'x' })`. Unlike ordinary shorthand calls, application data must be nested in `context`: writing `topic='x'` here makes it a setting and may silently leave the configured topic in use. JavaScript options variables can carry the same mistake. History stays positional; do not combine a positional options object with keywords. Resume options reject `prompt`, `messageHistory`, native `messages` and native `options`. For a new user message, use the source-appropriate data path described below; rendered agents receive user text through their configured context field.

Resume copies the history array and, when adding decisions, the final tool message and its content array. Other messages, parts, inputs, outputs and metadata remain borrowed: leave them unchanged until the invocation finishes, including stream consumption. Approval selections are consumed synchronously before asynchronous preparation. Casai does not deep-clone or freeze history.

New approval decisions apply to the segment after the last user/system message and exclude already-decided or result-bearing requests. Automatic requests normally have recorded decisions, which exclude them too; an automatic request without a decision or result remains selectable. Casai extends the final tool message when adding decisions, preserving native transport fields, and adds no empty message. It leaves existing message placement and decisions unchanged. Resume adds approval responses; the SDK creates any needed denial results in `responseMessages`. Empty history alone does not reject: `resume([])` still validates context and lets `prepareCall` supply messages; the SDK rejects if the final conversation remains empty. Hooks can replace messages and tools through their existing contract.

Supplied history follows the SDK's approval and tool-result protocol. Casai adds the requested decisions without repairing existing messages. If definitions reuse an ID, the last request/call definition in the supplied history is used, matching SDK lookup. Missing call definitions follow native validation after hooks, just like other history errors.

`resume()` generates, or streams on an `.asStream` component. When saving a continuation, **replace stored history with its complete `messageHistory`**, awaiting that property for streaming. Appending only `responseMessages` loses approval responses and external results supplied as input, including changes to an existing final tool message. The component retains no conversation state. Follow the [history and failure guidance](#conversational-ai-managing-message-history) when deciding what to save.

A tool may execute before the SDK discovers another missing result or protocol error. Duplicate existing responses or results outside the SDK's lookup window can also lead to repeated execution. Resume supplies no early-rejection or transaction guarantee; the application owns authoritative history, authorization, effect reconciliation and idempotency. Retrying the same pending snapshot can execute again. Reconstruct the approved call's public defaults for later requests; changed effective input can fail SDK revalidation. Private dependencies may change.

JSON storage must preserve the approved parsed input as well as recorded raw input. For example, a parsed `Date` becomes a string through JSON: unsigned revalidation then returns an input-error result without executing, while signed continuation rejects the changed signature. Prefer JSON-compatible parsed arguments such as ISO strings, converting inside `execute`, or a verified application-owned type-preserving format. Rich values have different serialization/signing limits; Casai adds no serializer or schema ban.

Inspect `responseMessages`/`messageHistory` for incoming approval outcomes. These tools run before the first model step, so step-derived `content`, `toolResults` and `steps` omit their successes, denials and input-revalidation errors. Streaming also exposes full-stream events. A successful native `output` does not prove the approved operation executed; the model can answer after a handled tool error.

Streaming can repeat `tool-output-denied` for an already-settled call whose negative response and `execution-denied` result remain in the final tool message, for example an automatic denial alongside another pending approval. This native event does not mean another execution or a new result. UI/full-stream consumers should reconcile it with existing state by tool-call ID; Casai does not suppress it.

UI stream consumers also need the paused assistant **UI message** containing those tool-call parts. For server completion callbacks, pass it last in `originalMessages` to the native UI stream helper; the browser must retain that message too (`readUIMessageStream` accepts it as `message`). Server `originalMessages` does not replay missing parts to an empty client. Without the matching UI state, processing incoming approval outcomes raises `UIMessageStreamError: No tool invocation found`, even though constructing/serializing a response without callbacks can succeed. If only model-message history is retained, use native stream/text/`output` consumption. Casai does not reconstruct UI messages from model history.

Every resume starts `stepNumber` at zero with empty `steps`; incoming approval results are in `prepareStep`'s `messages`/`responseMessages`. A hook forcing a tool on step zero will force it again. `isStepCount(n)` limits each invocation separately; applications own a budget across continuations.

`stopWhen: hasToolCall('submit')` cannot end resume immediately after an incoming approved `submit`: successful continuation still asks the model for a new step, and stop conditions see only the new model steps. An authored step-zero hook can request `toolChoice: 'none'` when the terminal result is already in messages, asking for a final answer; it still makes a model call. `activeTools`, `toolChoice` and tool-caller routing do not revoke already-approved incoming work, and `prepareStep` runs after it. Current approval policy and service authorization control execution.

Incoming approved tools receive the caller's cancellation signal and SDK total/tool timeouts (`totalMs`, `toolMs` and per-tool overrides). `stepMs` and streaming `firstChunkMs`/`chunkMs` start later and do not cover that work. Use tool/total timeouts with executors that honor cancellation; these do not forcibly interrupt tool code, and a handled tool timeout may still let the model answer. Narrowing `activeTools` does not withdraw approval; denying an undecided request or current policy can prevent execution. Missing executors retain native handling.

#### Starting a new message while approvals are pending

Call `denyPendingApprovals(history, reason?)` before adding a replacement user message. This synchronous helper returns a new history array. For each undecided local approval, it adds a negative approval response and a matching `execution-denied` tool result. For provider-executed approvals, it adds only a negative response with `providerExecuted: true`. It uses the same active-segment selection as resume. A local denial already recorded in that segment without its result also receives the `execution-denied` result, keeping the recorded reason, as the SDK's UI message conversion does. Other existing decisions and results are unchanged. It does not execute tools or contact a provider.

The helper accepts `readonly ModelMessage[]` and an optional string reason for the denials it adds. It copies only the outer array and a final tool message/content array it extends; other objects remain borrowed. Every request it denies or settles needs a matching tool-call definition so the helper can determine the tool name and execution kind; a missing definition raises `ValidationError`. With nothing to deny or settle, it returns a new outer array without adding any parts.

Other unfinished work still needs to be settled, including external results, already-approved calls awaiting execution and anything left unsettled in an older turn. The helper does not certify that history is ready for a new message, undo effects or stop work already running.

SDK chat UIs that build model messages with `convertToModelMessages` do not need the helper: that conversion already drops unanswered approval requests before a newer user message and adds denial results for recorded denials. Dropping a request sends no provider denial; see the MCP note below.

For the paused calculator above, when its unanswered approvals are the only unfinished work:

<!-- typecheck: continuation-denial -->
```typescript
import { denyPendingApprovals } from 'casai';

const settledHistory = denyPendingApprovals(
  pending.messageHistory,
  'The user sent a different request.',
);
const nextText = 'Explain multiplication without using a calculator.';
const nextResult = await reviewCalculator(nextText, settledHistory);
```

On a plain text agent, the ordinary call adds the new user message, replacing any configured text. Any non-tool form, including `.loadsText`, can instead append the message itself: `agent.resume([...settledHistory, { role: 'user', content: nextText }], { context: newTurnContext })`. This skips rendering and uses the component's generation/streaming mode. Supply the new turn's raw context, including required renderer fields.

When the new message needs configured template/script/function preparation, including loaded templates/scripts, use `.run({ messageHistory: settledHistory, context: { ...context, message: nextText } })`, with the application's declared field consumed by its preparer. Never pass end-user text as a rendered agent's `prompt`: that selects executable source, a resource name or a function. These recipes rely on the application to establish the earlier settlement. With a new user message last, the SDK does not synthesize earlier missing denial results, and missing local results are rejected before provider dispatch. See [rendering only the new message](#render-only-the-new-message).

For a pending OpenAI MCP approval, the helper's negative provider response is sent by the subsequent literal or rendered call. Retain provider history/metadata and the provider options used for continuation. The adapter forwards the response as an MCP denial even though the tool message is no longer last. Starting a new user/system turn without a negative response sends no denial and does not establish provider cancellation. Provider acceptance still depends on the saved conversation and available provider state.

**OpenAI MCP storage limitation:** approval and denial recipes assume the earlier response is available through default/enabled storage, or through `previousResponseId` referring to an available earlier response. In the installed adapter, a fully stateless `store: false` continuation sends the decision without the original approval-request item, an item reference or a response-chain ID. This does not reconstruct the prior request as described in [OpenAI's MCP guide](https://developers.openai.com/api/docs/guides/tools-connectors-mcp); provider acceptance of that stateless request is not guaranteed. Do not rely on these recipes for stateless approvals or cancellations. `previousResponseId` is not a workaround for an unavailable prior response, and [ZDR treats storage as disabled](https://developers.openai.com/api/docs/guides/your-data). Ignoring an approval sends no decision and is a separate case. Casai adds no provider-specific history reconstruction.

#### Protecting approval decisions

If approval history passes through a client, configure native `experimental_toolApprovalSecret` on the originating and resumed calls, or recover authoritative server-held history. For JSON-compatible parsed input, signing protects the recorded operation from forgery; it does not authenticate the human decision or external results, authorize the user/tenant, or prevent replay. Rich parsed values inherit the SDK's hashing and serialization limitations; type-preserving storage does not repair them.

Filtering `approve` on the server does not restrict affirmative responses already supplied in client history: even `approve: []` or `false` leaves those recorded decisions in effect. For local tools, enforce per-decision authorization in the SDK-rechecked `toolApproval` policy or the service executing the action. Alternatively, use authoritative server history and accept only authorized new selections. Provider decisions must be authorized before forwarding; the SDK's local policy recheck does not cover provider execution. Signing an operation does not authorize an embedded response.

`.run()` remains for ordinary calls. During an active invocation, use native async `toolApproval`/`execute` callbacks. SDK chat UIs already send complete approval conversations through native Agent methods and do not need `resume()`; see the [SDK approval guide](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-execution-approval).

### Trusted tool context

`toolContextSchema` validates incoming native `ToolExecutionOptions.context`; it is exposed as the descriptor's native `contextSchema`. Do not use top-level `contextSchema` in Casai configuration. Ordinary calls do not parse `config.context` through the tool-context schema.

Priority is explicit public arguments, then bound tool context, then configured public defaults. Private dependency collisions remain protected. Bare descriptors accept private-only incoming context. Bind incoming public defaults explicitly:

<!-- typecheck: current-bound-tool -->
```typescript
const lookup = create.Function.asTool({
  inputSchema: z.object({ city: z.string() }),
  toolContextSchema: z.object({ city: z.string() }),
  execute: ({ city }) => city,
});
const bound = lookup.bindToolContext({ city: 'London' });
// Pass bound.tool and the matching bound.context to native SDK tools/toolsContext.
```

Casai owners bind registered tools internally. Configured public defaults may be advertised as annotations where supported, without publishing private values. The component keeps its original schemas; a tool descriptor can expose a derived public schema. Function tool bodies remain available as `.config.execute`, while the tool's public `.execute(input, options)` is the SDK entry point. Binding retains native context-validation boundaries. Approval continuation must use stable defaults; otherwise native revalidation can reject execution.

Making a defaulted tool argument optional can conflict with a provider's strict schema requirements. Use compatible tool schemas and provider settings; Casai does not silently change `strict` or repair provider errors. Public defaults that require projecting union or reference-based root schemas have additional limits. Ordinary local schemas and unchanged native tools retain their native validation behavior.

Registered tools are also available as callable helpers in Template, Script and Function context. Those coded calls reuse validation and tool context but do not run the model's approval policy. If a model-facing outer tool performs a sensitive action through an inner helper, put the required approval on the outer tool and enforce service permissions where the action occurs.

Bodies and prompt functions receive `context._toolOptions`: actual invocation metadata such as the tool-call ID, messages, and abort signal. Ordinary calls have no fabricated tool metadata. Input/configuration cannot spoof this reserved field. Native descriptors retain `execute(input, options)`.

## Interchanging Components in Workflows

Keep the application operation's **input and returned value** stable, then put the selected implementation in a workflow's context. LLMAgent returns an SDK result; Template returns text; Script and Function return native values. A small adapter extracts the value the workflow needs from a model result. The workflow then depends on that value contract rather than a model-specific result envelope.

### Text Replacements

A Script can call the same `summarize({ text })` operation whether its implementation uses a model or coded logic:

<!-- typecheck: text-interchange -->
```typescript
const summaryInput = z.object({ text: z.string() });
const modelSummary = create.LLMAgent.withTemplate({
  model,
  inputSchema: summaryInput,
  prompt: 'Summarize in one sentence: {{ text }}',
});

const aiSummarize = async (input: z.input<typeof summaryInput>) =>
  (await modelSummary(input)).output;

const codedSummarize = create.Function({
  inputSchema: summaryInput,
  schema: z.string(),
  execute: ({ text }) => text.split('. ')[0],
});

const summaryPage = create.Script({
  inputSchema: summaryInput,
  context: { summarize: codedSummarize }, // Or aiSummarize.
  script: 'var summary = summarize({ text: text })\nreturn { summary: summary }',
});
```

A Template that accepts `{ text }` and returns a string can also occupy this context entry. Use a Script when the replacement needs dependencies or several operations, and a Function for JavaScript logic. The caller stays unchanged because every implementation returns the expected string. The example adapter defines complete execution. For a streaming replacement, every implementation returns a text stream: the adapter returns the streaming LLMAgent's `.textStream`, and a Script or Function declares `schema: textStreamSchema()`.

### Output Schemas and Structured Replacements

Reuse one application schema, with the configuration appropriate to each implementation:

<!-- typecheck: structured-interchange -->
```typescript
const answerInput = z.object({ question: z.string() });
const answerSchema = z.object({ answer: z.string(), confidence: z.number() });

const modelAnswer = create.LLMAgent.withTemplate({
  model,
  inputSchema: answerInput,
  prompt: 'Answer the question and estimate confidence: {{ question }}',
  output: Output.object({ schema: answerSchema }),
});
const aiAnswer = async (input: z.input<typeof answerInput>) =>
  (await modelAnswer(input)).output;

const codedAnswer = create.Function({
  inputSchema: answerInput,
  schema: answerSchema,
  execute: ({ question }) => ({ answer: `Received: ${question}`, confidence: 1 }),
});

const answerWorkflow = create.Script({
  inputSchema: answerInput,
  context: { answer: codedAnswer }, // Or aiAnswer.
  script: 'return answer({ question: question })',
});
```

LLMAgent's SDK `output` and Script/Function's native `schema` both return schema-produced application values. A deterministic string-to-number schema therefore produces a number in either implementation. Each has one declared output-parsing boundary; Casai does not reparse SDK output. Templates stay text-only. Share `inputSchema`, helper signatures, and the application result type; SDK events, conversation history and the native Agent call protocol remain LLMAgent concerns.

## Cancellation and errors

Pass `abortSignal` to `.run()` or native Agent methods, never reusable configuration. Casai checks it before preparation and before SDK dispatch and forwards actual signals through registered tool execution. Preparation is awaited normally. SDK `timeout` starts at the native execution boundary and does not cover preceding parsing, loading or rendering. Script, Template and Function accept an explicit signal for cooperative forwarding; they do not impose inherited deadlines or forcibly interrupt arbitrary code.

Configuration errors use `ConfigError`; invalid application input/output uses `ValidationError`. Cascada execution failures retain `ScriptError` and their cause. Native SDK/provider failures retain native behavior. Retrying an effectful workflow is an application decision; SDK model retries do not make arbitrary side effects safe to repeat.

## Embedding and RAG integration

Retrieval-augmented generation (RAG) supplies relevant documents to an LLMAgent before it answers. A typical flow is:

```text
question РІвЂ вЂ™ embedding/search РІвЂ вЂ™ candidate documents РІвЂ вЂ™ reranking РІвЂ вЂ™ LLMAgent answer
```

Use Embedder to index document text and embed search queries. Your vector store or search service stores and retrieves the documents. Reranker can improve the order of retrieved candidates before they enter the prompt.

The following example assumes your application provides `searchIndex(vector)`, which returns document strings from an index built with the same embedding model:

<!-- typecheck: rag -->
```typescript
const embedder = create.Embedder({ model: embeddingModel });
const reranker = create.Reranker({ model: rerankingModel });
const answerFromDocuments = create.LLMAgent.withTemplate({
  model,
  inputSchema: z.object({ question: z.string(), documents: z.string() }),
  prompt: `
    Answer the question using the supplied documents.
    If they do not contain the answer, say so.
    Documents: {{ documents }}
    Question: {{ question }}
  `,
});

const question = 'How are damaged orders replaced?';
const query = await embedder(question);
const candidates = await searchIndex(query.embedding);
const ranked = await reranker.run({ query: question, documents: candidates, topN: 5 });
const answer = await answerFromDocuments({
  question,
  documents: JSON.stringify(ranked.rerankedDocuments),
});

console.log(answer.output);
```

You can compose the same steps inside a Script or expose bounded retrieval through a Function tool. Casai prepares and orchestrates these operations; the search service owns document storage and retrieval.

## Migration

Replace `race(loaders, groupName?)` with `raceLoaders(loaders)`. Group names and the `RaceGroup`/`RaceLoader` types are removed. `.config.loader` now keeps nested arrays and races; use `LoaderGroup` for its type. `LoaderInput` also accepts `raceParent(...)` and `overrideParent(...)`.

Child files can now replace files included or imported by a parent's template. Previously, relative files always came from the loader that supplied the template. With `raceParent`, relative files stay on the side that found the main file; they do not fall back between child and parent.

`LLMAgent` replaces `TextGenerator`, `TextStreamer`, `ObjectGenerator`, and `ObjectStreamer`; the old exports and types are removed. Use `.asStream` for streaming and native `Output.object`, `Output.array`, `Output.choice`, or other SDK output specifications for structured results. Use native `.output` for parsed output and `.textStream` for live text.

Await streaming component calls before accessing the SDK result. Await `.output` for completed streaming output; iterate `.textStream` for live text. Use `prompt` for configured messages, `messageHistory` for call history, and `instructions` for system instructions. Rendered positional calls place context before history. Stable lifecycle names are `onEnd` and `onStepEnd` instead of `onFinish` and `onStepFinish`.

## Testing Workflows

Test orchestration with deterministic helpers in context, without making model calls. A test double only needs to supply the values that the workflow consumes:

<!-- typecheck: mock-workflow -->
```typescript
import assert from 'node:assert/strict';

const workflow = create.Script({
  inputSchema: z.object({ topic: z.string() }),
  schema: z.object({ summary: z.string() }),
  context: {
    summarize: async ({ topic }: { topic: string }) => ({
      output: `Summary of ${topic}`,
    }),
  },
  script: `
    return { summary: summarize({ topic: topic }).output }
  `,
});

assert.deepEqual(await workflow({ topic: 'recycling' }), {
  summary: 'Summary of recycling',
});
```

To exercise the LLMAgent's full model/tool protocol, supply an AI SDK mock model through `model`; see [SDK testing](https://ai-sdk.dev/docs/ai-sdk-core/testing). Test concurrent `.run()` calls with distinct inputs when verifying invocation isolation, and consume streams in tests that assert final results or completion callbacks. Type-check TypeScript examples separately from executing them.

## Development

`npm test` runs mock-only runtime tests. `npm run check` checks source/emitted types, lint, and runtime coverage without paid calls. `npm run test:live` explicitly opts into provider-backed tests. See [tests/README.md](tests/README.md) for focused checks and [the review process](docs/review-process.md) for contract review requirements.

TypeScript checks every alternative of a union-valued argument. A union of different component values may require narrowing before invoking it; do not cast away input checks.

Use `ComponentConfig<'Embedder'>` to annotate an ordinary Embedder configuration. Use `satisfies` when you want to preserve specific schema types and configured defaults; tool factories infer their configuration through `.asTool`.

Learn Cascada from its [script documentation](https://geleto.github.io/cascada-script/) and [repository](https://github.com/geleto/cascada). See [Casai examples](https://github.com/geleto/casai-examples) and [Smart DB Dashboard](https://github.com/geleto/smart-db-dashboard) for larger workflows.
