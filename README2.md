# Casai: Universal Generator and Streamer

> **Step 2 design, awaiting implementation.** This document describes the proposed universal LLM API. [README.md](README.md#agents-with-asagent) describes Step 1: `.asAgent` on the existing Text/Object factories. The [agent design](docs/agents-design.md) defines the shared implementation and migration sequence.

Casai keeps its callable components, prompt modifiers, context validation, configuration inheritance, and `.run()` overrides. Two factories cover LLM generation: `Generator` returns a complete result; `Streamer` returns a live stream result. The `output` setting selects text or structured data.

Every `Generator` and `Streamer` also implements the AI SDK [`Agent` interface](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent), exposing native `.generate()` and `.stream()` methods. `.asAgent` remains useful as a multi-step execution preset; the interface itself does not imply a tool loop.

Installation, `Config`, `Template`, `Script`, `Function`, rendering, loaders, embeddings, and RAG retain their [existing conventions](README.md). This design changes the LLM factory and output surface.

## Generate Text or Structured Data

Examples assume an application-provided `model` and, where used, a `tools` map.

```typescript
import { create } from 'casai';
import { Output } from 'ai';
import { z } from 'zod';

const writer = create.Generator({ model });
const answer = await writer('Explain battery recycling briefly.');
console.log(answer.output); // string; omitted output means Output.text().
console.log(answer.text);   // The SDK's text accessor remains available.

const researcher = create.Generator.withTemplate({
  model,
  prompt: 'Summarize {{ topic }} in {{ language }}.',
  inputSchema: z.object({ topic: z.string() }),
  context: { language: 'English' },
  output: Output.object({
    schema: z.object({ summary: z.string(), findings: z.array(z.string()) }),
  }),
});

const report = await researcher({ topic: 'battery recycling' });
console.log(report.output.summary);

const frenchReport = await researcher.run({
  context: { topic: 'battery recycling', language: 'French' },
  temperature: 0.4,
});
```

`output` is a creation-time contract. It controls parsing, validation, and the inferred type of `result.output`; it cannot change through `.run()`. Casai normalizes omitted output to `Output.text()`, including its `string` result type.

| Desired output | Configuration |
| :--- | :--- |
| Text | Omit `output`, or use `Output.text()` |
| Validated object | `Output.object({ schema })` |
| Array of validated elements | `Output.array({ element: schema })` |
| One allowed string | `Output.choice({ options: ['yes', 'no'] })` |
| JSON without a fixed schema | `Output.json()` |

Structured output and tool use share the same execution path. The SDK owns [structured output parsing and streaming](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data); Casai adds prompt preparation and component composition.

## Stream Incrementally

```typescript
const writerStream = create.Streamer({ model });
const textResult = await writerStream('Explain battery recycling briefly.');

for await (const text of textResult.textStream) {
  process.stdout.write(text);
}

// Inherit the researcher's schema, template, and other configuration.
const researchStream = create.Streamer.withTemplate({}, researcher);
const reportStream = await researchStream({ topic: 'battery recycling' });

for await (const partial of reportStream.partialOutputStream) {
  console.log(partial); // Partial values; fields may still be missing.
}

const completeReport = await reportStream.output;
console.log(completeReport.summary);
```

Streamers preserve the full SDK result: text and partial-output streams, array element streams where supported, tool events, steps, metadata, usage, and response conversion methods. The complete event stream is `result.stream` in SDK 7 (`fullStream` is its deprecated alias). `.output` is the final parsed value, not the full result or an agent instance.

Plain-text streaming without asynchronous preparation returns its result immediately. Rendered/loaded prompts and function prompts use the existing promise path; configuring `callOptionsSchema` or `prepareCall` also selects that path. Awaiting either form gives the stream handle without waiting for generation to finish. Native `.stream()` always returns a promise.

## Choose the Loop Policy

The SDK `Agent` interface specifies callable methods and metadata, not a minimum number of model steps. The same backend handles both a single step and a tool loop.

| Factory | Default callable operation | Fallback stopping condition | SDK methods |
| :--- | :--- | :--- | :--- |
| `Generator` | Generate | `isStepCount(1)` | Both |
| `Streamer` | Stream | `isStepCount(1)` | Both |
| `Generator.asAgent` | Generate | `isStepCount(20)` | Both |
| `Streamer.asAgent` | Stream | `isStepCount(20)` | Both |

The fallback applies only when no `stopWhen` was supplied or inherited. An explicit condition always wins. A single step can execute tools, but does not automatically make another model call using their results. Multi-step execution can finish before its limit or pause for external tool results or approvals.

```typescript
import { isStepCount } from 'ai';

const agent = create.Generator.withTemplate.asAgent({
  model,
  tools,
  prompt: 'Research {{ topic }}.',
  inputSchema: z.object({ topic: z.string() }),
  stopWhen: isStepCount(10),
});

const report = await agent({ topic: 'battery recycling' });
console.log(report.output); // Text is still the default output.

// An explicit policy also enables loops without the modifier.
const equivalentPolicy = create.Generator({
  model,
  tools,
  stopWhen: isStepCount(10),
});
```

`.asAgent` does not wrap an already running component or introduce a second execution engine. It selects defaults when creating the component. `generateText` and `streamText` execute the loop in both cases.

## Keep Casai Calling Conventions

Both factories support `.withText` (the default), `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, and `.loadsScript`. Append `.asAgent` after a prompt modifier when needed. Configuration inheritance still uses the second factory argument and `.config` exposes the resolved configuration.

Plain calls accept prompt strings and model messages; rendered calls accept context. There is no `input` wrapper. A context field named `prompt` remains data. `.withFunction` keeps its context-only callable and function-valued `.run({ prompt })` override. Other prompt overrides, loaders, and history arguments follow the [existing component contracts](README.md#callable-component-objects).

`inputSchema` validates raw call-time context before configured context is merged. Required input fields cannot be supplied solely through configured context. SDK `runtimeContext` and per-tool `toolsContext` remain separate from rendering `context`.

`.run()` keeps the factory's default operation and applies allowed configuration overrides to one invocation. Concurrent runs do not mutate shared configuration or exchange context, tools, settings, or history. Output/schema contracts and renderer setup stay fixed.

Casai calls retain `response.messages` and `response.messageHistory`. For streaming, await `result.response` to read them. History is passed explicitly between calls; the component does not retain a conversation.

## Use the Native Agent Interface

Every universal component exposes `version: 'agent-v1'`, `id`, `tools`, `.generate()`, and `.stream()`, including components without `.asAgent`. Both native methods return promises and full SDK results.

```typescript
import { createAgentUIStreamResponse } from 'ai';

// A Generator can stream natively, and a Streamer can generate natively.
const incremental = await writer.stream({ prompt: 'Explain recycling.' });
const complete = await writerStream.generate({ prompt: 'Explain recycling.' });

// uiMessages is supplied by the application's chat request.
const response = await createAgentUIStreamResponse({
  agent: writer,
  uiMessages,
});
```

The native operation executes directly in its requested mode. Streaming is incremental, and generating does not first run or drain a stream. Each invocation starts one execution, potentially containing multiple model/tool steps.

Native calls bypass Casai prompt rendering/loading, input validation, context merging, configured prompt/history insertion, and result augmentation. They use the configured model, tools, output, instructions, loop policy, and hooks with the supplied SDK `prompt` or `messages`. The UI helper therefore receives exactly the conversation supplied by its caller, plus configured instructions.

For example, `researcher.generate({ prompt: 'Summarize recycling.' })` uses the output schema but does not require `topic` or render the configured template. Put instructions shared by both entry paths in `instructions`.

Custom SDK call options remain separate from rendering input: native methods accept `options`; Casai configuration and `.run()` accept `callOptions`. Both use `callOptionsSchema` and `prepareCall`. Casai's existing `options` setting continues to configure Cascada. Native methods require their own custom options and do not borrow Casai defaults. See the [call-options contract](docs/agents-design.md#custom-call-options-and-hooks).

## Expose a Generator as a Tool

```typescript
const summarize = create.Generator.withTemplate.asTool({
  model,
  description: 'Summarize a topic.',
  prompt: 'Summarize {{ topic }}.',
  inputSchema: z.object({ topic: z.string() }),
  output: Output.object({ schema: z.object({ summary: z.string() }) }),
});

const result = await summarize({ topic: 'battery recycling' });
console.log(result.output.summary);

const assistant = create.Generator.asAgent({
  model,
  tools: { summarize },
});
```

Calling the tool component directly returns the full result. Its SDK tool `execute` returns `result.output`, so text and structured tool outputs both follow the configured output type. `.withTemplate.asAgent.asTool(...)` composes both modifiers. `Streamer` has no `.asTool` modifier.

## Migrate from Step 1

| Step 1 | Step 2 |
| :--- | :--- |
| `TextGenerator` / `TextStreamer` | `Generator` / `Streamer`, default text output |
| `TextGenerator.asAgent` / `TextStreamer.asAgent` | `Generator.asAgent` / `Streamer.asAgent` |
| `ObjectGenerator.asAgent({ schema })` | `Generator.asAgent({ output: Output.object({ schema }) })` |
| `ObjectStreamer.asAgent({ schema })` | `Streamer.asAgent({ output: Output.object({ schema }) })` |
| Object `output: 'array'`, with `schema` describing each element | `output: Output.array({ element: schema })` |
| Object `output: 'enum'`, with `enum` values | `output: Output.choice({ options: values })` |
| Object `output: 'no-schema'` | `output: Output.json()` |
| `.object` / `.partialObjectStream` | `.output` / `.partialOutputStream` |

Prompt modifiers, parents, `.run()`, rendering context, and explicit stopping conditions carry over. Ordinary Object components can also migrate to the universal pair, subject to the documented [legacy result and option differences](docs/agents-design.md#output-and-compatibility-boundary). In particular, old object event/callback shapes are not the modern SDK agent protocol.

Keep the old factory names available during migration. Their eventual removal is a separate breaking release; Step 2 introduces the universal API on the already tested Step 1 core. The shared core preserves complete SDK results and streaming hooks throughout both stages.
