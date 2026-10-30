# Casai: concurrent AI workflows

Casai combines the AI SDK's model execution with Cascada's concurrent scripts and templates. Write ordinary data dependencies; Cascada starts independent work concurrently and waits where one result depends on another.

```javascript
var background = researcher({ topic: topic }).output
var analysis = analyst({ topic: topic }).output
return writer({ background: background, analysis: analysis }).output
```

Use `Config` for shared settings, `Template` for text presentation, `Script` for workflows, `Function` for JavaScript logic, and `LLMAgent` for model calls and tool loops.

## Contents

- [Installation](#installation) and [quick start](#quick-start)
- [Common component contracts](#common-component-contracts)
- [Template, Script, and Function](#template-script-and-function)
- [Streams from Function and Script](#streams-from-function-and-script)
- [LLMAgent](#llmagent)
  - [Steps, hooks and continuation](#steps-hooks-and-continuation)
  - [Results](#llmagent-results) and [streaming](#streaming-with-asstream)
- [Sources, loaders and rendering](#sources-loaders-and-rendering)
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
| LLMAgent | The SDK result, with `.messageHistory`; see [results](#llmagent-results) |

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

An array tries loaders in order; `raceLoaders([...])` tries them together. Child loaders run before parent loaders. Use `raceParent(...)` to try both together, or `overrideParent(...)` to use only the child's loaders. Both helpers work without a parent. See [combining loaders](#combining-loaders) for examples.

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
| Base without inherited source mode / `.withText` | Literal string or `ModelMessage[]` |
| `.withTemplate` | Cascada template |
| `.withScript` | Cascada script returning a string or messages |
| `.withFunction` | Function receiving prepared context and returning a string or messages |
| `.loadsText` | Literal-text resource name |
| `.loadsTemplate` | Template resource name |
| `.loadsScript` | Script resource name |

Loaded forms require `loader`. Rendering settings are `context`, `filters`, and `renderOptions`. The source property is always `prompt`. Context and `inputSchema` are allowed even for literal text, including when only hooks need the context.

Choose a source modifier, then `.asStream` for a streaming agent or `.asTool` for a generation-only tool. LLMAgent rejects combining these modes, including through inheritance.

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

Rendered calls use `(context, messageHistory?)` with a configured source, or `(source, context, messageHistory?)`. Function preparation follows the same order. Literal calls use `(prompt, context?, messageHistory?)`; context can be omitted when no call data is required. A first array is a new literal prompt, never an inferred history. `.run({ messageHistory })` sends history alone only when there is no effective prompt; otherwise it prepares and appends the configured prompt. Empty strings still add a user message.

History arguments accept `readonly ModelMessage[]`, including frozen arrays. Casai copies the outer array and borrows its messages; keep those messages unchanged while the call or stream is running. Native `.generate()`/`.stream()` parameters retain the SDK's own types.

`.run()` supports model settings and hook replacement. It ignores top-level `undefined` overrides. Source mode, input schema, output specification, identity, rendering settings, and modifiers are fixed at creation. Nested context/map entries retain their normal merge rules.

For a rendered agent, pass end-user text through the context fields its configured prompt consumes. A `prompt` override selects new executable source or a resource name. Text passed as context, including text containing `{{ ... }}`, is data and is not compiled again as template source.

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

On native `.generate()`/`.stream()` calls, pass `messages: []` when the hook supplies the entire conversation. JavaScript calls that omit both `prompt` and `messages` also reach the hook with an empty conversation. These calls skip configured prompt rendering; context validation still applies, and the SDK rejects an empty final request. Result history retains the original input plus response messages, so it does not include a conversation created only by the hook.

The editable request includes model controls, tools, timeout, stream transforms, and other supported native execution settings. Fixed output, the invocation signal, composed observers, approval policy/signing secret, and telemetry are installed separately at dispatch. They are not editable request fields and cannot be dropped by a minimal hook return.

`prepareStep(step, config, context)` runs inside the SDK's loop before each model step. Its first argument and partial return follow the SDK contract: it can change messages, model, instructions, active tools, and supported step settings. Return overrides instead of mutating shared settings. It does not itself execute another step. The SDK owns step scheduling and termination.

Both hooks share the invocation's flat merged `config` and prepared `context`. `config.context` contains the merged raw configuration and call settings; the third argument contains parsed application input, dependencies, tool helpers, and `_toolOptions`, exactly as supplied to the prompt renderer. SDK tool arguments enter that prepared context, without reconstructing raw arguments in `config`. Hooks do not receive a separate application `options` channel. Configuration must not be mutated.

Lifecycle observers from config and the call both run; observer failures do not fail execution. Use stable names such as `onStart`, `onStepEnd`, and `onEnd`. Control hooks such as `prepareCall`, `prepareStep`, `onError`, and stream transforms replace inherited controls rather than compose.

### Steps, hooks and continuation

```typescript
import { isStepCount } from 'ai';

const lookup = create.Function.asTool({
  description: 'Look up a city temperature.',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => weatherService.temperature(city),
});
const assistant = create.LLMAgent({ model, tools: { lookup }, stopWhen: isStepCount(5) });
const answer = await assistant('What is the temperature in London?');
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

Continue by calling `component.generate({ messages: history, options: rawContext })` or `component.stream({ messages: history, options: rawContext })`:

- These SDK methods send the conversation literally, skipping configured prompt loading/rendering.
- They start a fresh invocation with fresh SDK step counts, using tool replies already in history.
- Record approval decisions as native `tool-approval-response` parts; the SDK handles them before the new model step.
- With settled history and no tools available, continuation still makes one new model step. It is not a no-op when nothing is pending.
- Recorded replies do not require rerunning their tools. An approved local call awaiting execution still needs its corresponding tool and executor.

The native methods accept application context as `options`, plus their supported cancellation, timeout and observer settings. They do not accept all `.run()` overrides. To change the model, `stopWhen`, `toolsContext` or provider settings for a literal continuation, derive a component with those settings, then call its native method. Required application fields remain required even when rendering is skipped. See [approval decisions](#approval-decisions-and-literal-continuation).

#### Configuration and per-call overrides

- Component configuration supplies the model, `stopWhen`, registered `tools`, application `context` and per-tool `toolsContext`.
- Supported call settings can override them. Supply required inputs that configuration does not provide.
- `.run({ tools: ... })` can replace compatible declared tools or remove them. Add new tool names or change their contracts by deriving another component.
- Overrides from an earlier call are **not remembered**. Preserve and supply them again when needed; history does not contain that setup.
- Application objects and callback closures can hold state. Starting another invocation does not automatically reset that state.

#### New prompt or continuation

`component(...)` and `component.run(...)` prepare and append their configured or supplied prompt. The native `.generate()` and `.stream()` methods accept a literal conversation and skip prompt preparation. All use earlier tool replies when their history is supplied.

Without an effective prompt, `.run({ messageHistory })` already sends history alone. With a configured template, use a literal SDK call to continue without rendering it again. An unchanged template can render different messages from new context.

Starting a new turn does not automatically deny pending tools. Denying an approval refuses that execution; it does not discard replies or undo completed work. Starting a separate conversation without old history does not stop external work already running.

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
| `WebLoader` | Load sources from a base URL in a browser |
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

Standalone templates default `autoescape` to `false`; language-model prompt renderers disable HTML escaping. Renderer options, filters, and loaders are creation-time settings. Source caches respect loader updates and `noCache`.

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

Tool forms accept native function-tool settings such as `metadata`, `strict`, `inputExamples`, `toModelOutput` and input hooks. Use `toModelOutput` when the model should receive a smaller or differently encoded result than the application. Configure approval policy through the owning LLMAgent's `toolApproval`.

For Function, Template and Script tools, `providerOptions` configures the tool descriptor. For LLMAgent tools, it configures the inner model call and is not forwarded to the outer tool descriptor.

```typescript
const summarize = create.LLMAgent.withFunction.asTool({
  model,
  inputSchema: z.object({ document: z.string() }),
  prompt: ({ document }) => `Summarize this document: ${document}`,
});
```

Literal/fixed-resource LLMAgent tools require a configured prompt. Use empty public input when no context is needed, or declared fields for hooks. Named inputs that affect prompt text require a template, script, or function preparer. A model-supplied property called `prompt` never automatically replaces executable/configured source.

### Approval decisions and literal continuation

Set `toolApproval` on an LLMAgent to approve, deny or request human approval for tools. For example, `toolApproval: { lookup: 'user-approval' }` returns an approval request instead of executing `lookup`. Save the complete `messageHistory`, the paused call's raw context and any per-call overrides needed later.

For a local tool, add the selected approval response to the final tool message, preserving any existing results or decisions, then continue:

<!-- typecheck: native-approval-continuation -->
```typescript
const history = [...pending.messageHistory];
const decision = {
  type: 'tool-approval-response' as const,
  approvalId: selectedApprovalId,
  approved: true,
};
const last = history.at(-1);
if (last?.role === 'tool') {
  history[history.length - 1] = {
    ...last,
    content: [...last.content, decision],
  };
} else {
  history.push({ role: 'tool', content: [decision] });
}
const continued = await agent.generate({
  messages: history,
  options: savedContext,
});
```

Here `agent` is the configured non-tool LLMAgent, `pending` is its paused result, and `selectedApprovalId` identifies the request the application authorized. Use `approved: false` to deny it. Provider-executed approvals additionally require their native `providerExecuted` transport flag. Use `.stream()` instead of `.generate()` for streaming continuation; both skip prompt rendering.

Keep approved public arguments/defaults stable across the pause. The SDK rechecks local inputs and policy; changing them can prevent execution. Existing affirmative decisions remain effective, so authorize client-supplied history rather than treating a new selection as revocation. Signed operation data does not authenticate a human decision or prevent replay. Coordinate updates against server-held conversation state; repeating a pending history can repeat effects.

Approved incoming tools run before model step zero. Inspect `responseMessages` or `messageHistory` for their outcomes, including input errors and denials; step-derived `toolResults` does not include that earlier work. Save the complete new history. Tool effects can occur before a later SDK history/protocol error.

To send a new user turn instead of continuing a pending local approval, first record the negative approval response and its matching `execution-denied` tool result. Adding a user message does not itself deny the call or make missing results valid.

SDK chat clients can handle approval messages through their normal Agent/UI protocol. When continuing a UI stream, retain the paused assistant UI message with its tool-call parts and pass the matching `originalMessages` to UI-stream finish helpers. Model history alone cannot reconstruct that UI state. A repeated `tool-output-denied` event can describe an already-settled denial; reconcile events by tool-call ID.

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

A Template that accepts `{ text }` and returns a string can also occupy this context entry. Use a Script when the replacement needs dependencies or several operations, and a Function for JavaScript logic. The caller stays unchanged because every implementation returns the expected string. The example adapter defines complete execution. For a streaming replacement, every implementation returns a text stream: the adapter returns the streaming LLMAgent's `.textStream`, a Template is created with `.asStream`, and a Script or Function declares `schema: textStreamSchema()`.

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
    var answer = answerGenerator({ context: retrievedContext }).output
    return { query: query, answer: answer }
  `,
});
```

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
      value: `Summary of ${topic}`,
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

Learn Cascada from its [script documentation](https://geleto.github.io/cascada-script/) and [repository](https://github.com/geleto/cascada). See [Casai examples](https://github.com/geleto/casai-examples) and [Smart DB Dashboard](https://github.com/geleto/smart-db-dashboard) for larger workflows.
