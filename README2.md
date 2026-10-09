# Casai: Agents and Specialized AI Components

> **Phase 2 and Phase 3 design, awaiting implementation.** This document describes the target API for language agents and specialized AI components. [README.md](README.md#agents-with-asagent) describes the existing API and Phase 1: `.asAgent` on the Text/Object factories. The [implementation design](docs/agents-design.md) defines all three phases. Examples using the new factories describe planned APIs, not available exports.

Casai keeps its callable components, prompt modifiers, context validation, configuration inheritance, and `.run()` overrides. Phase 2 introduces two factories for language-model generation: `Agent` generates a complete result by default; `StreamingAgent` returns a live stream result by default. The `output` setting selects text or structured data. Phase 3 adds decisions, embeddings, reranking, image generation, transcription, speech generation, and live voice sessions.

Both factories implement the AI SDK [`Agent` interface](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent), which requires native `.generate()` and `.stream()` methods. Either component can generate or stream; the factory selects only the default operation of the Casai callable and `.run()`. There is no `.asAgent` modifier: configure loop behavior through `stopWhen`.

When omitted from both local and inherited configuration, `output` defaults to `Output.text()` and `stopWhen` defaults to `isStepCount(1)`. The backend calls `generateText()` and `streamText()` directly for both text and structured output. It implements the SDK agent interface without using `ToolLoopAgent`.

Installation, `Config`, `Template`, `Script`, `Function`, rendering, and loaders retain their [existing conventions](README.md). Existing embedding and RAG integration through functions remains usable; Phase 3 provides dedicated components alongside it.

## Component Overview

`Config`, `Template`, `Script`, and `Function` already exist. `Agent` and `StreamingAgent` arrive in Phase 2; the remaining AI components are Phase 3. `Config` is a configuration factory, not a callable component. Component names link to Casai usage; SDK links cover detailed settings and result properties. The input/result column lists only the main values, not the full contract.

| Component | What it does | Main inputs → result | SDK reference |
| :--- | :--- | :--- | :--- |
| [Config](README.md#configuration-management) | Share configuration | Settings and optional parent → `.config` | — |
| [Template](README.md#template) | Render a Cascada template | Template and context → string | — |
| [Script](README.md#script) | Execute a Cascada workflow | Script and context → returned value | — |
| [Function](README.md#function) | Wrap JavaScript logic | Arguments/context → returned value | — |
| [Agent](#generate-text-or-structured-data) | Generate text/data; optionally loop with tools | Prompt/messages or rendering context → `.output`, `.text` | [generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) |
| [StreamingAgent](#stream-incrementally) | Stream text/data and tool activity | Prompt/messages or rendering context → `.textStream`, `.partialOutputStream`, final `.output` | [streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) |
| [Decision](#make-decisions) | Answer choice, boolean, and score questions | `state`, configured `questions` → `.answers` | [Decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions) |
| [Embedding](#embed-one-or-many-inputs) | Embed one or many texts | String or string array → `.embedding` or `.embeddings` | [Embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings) |
| [Reranker](#rerank-retrieved-documents) | Rank candidates for a query | `query`, `documents` → `.ranking`, `.rerankedDocuments` | [Reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking) |
| [ImageGenerator](#generate-or-edit-images) | Generate or edit images | `prompt` and optional editing inputs → `.images` | [Images](https://ai-sdk.dev/docs/ai-sdk-core/image-generation) |
| [Transcriber](#transcriber) | Transcribe a recording | `audio` → `.text`, `.segments` | [Transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription) |
| [StreamingTranscriber](#streamingtranscriber) | Transcribe live audio | Audio stream and format → `.fullStream`, final `.text` | [Streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription) |
| [SpeechGenerator](#generate-speech) | Generate spoken audio | `text` → `.audio` | [Speech](https://ai-sdk.dev/docs/ai-sdk-core/speech) |
| [VoiceSession](#hold-a-voice-conversation) | Hold a live voice conversation | Audio/text exchange → session events; method names pending | [Realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime) |

Full model results retain usage, warnings, metadata, and other SDK fields where supplied. The two Agent factories both expose native generation and streaming regardless of their default operation; see [SDK interoperability](#use-the-native-agent-interface).

### Modifier Support

☑ = supported in the documented phase; ☐ = not applicable or intentionally not exposed. A checked box on a planned component does not mean it is already implemented. Support every modifier that has a meaningful input or tool adaptation for that component. These are factory modifiers; `.run()`, `.generate()`, and `.stream()` are invocation methods. Component names and modifier headings link to their usage and preparation rules.

| Component | [.withText](#text-and-template-modifiers) | [.withTemplate](#text-and-template-modifiers) | [.withScript](#script-and-function-modifiers) | [.withFunction](#script-and-function-modifiers) | [.loadsText](#text-and-template-modifiers) | [.loadsTemplate](#text-and-template-modifiers) | [.loadsScript](#script-and-function-modifiers) | [.asTool](#specialized-components-as-tools) | [.asAgent](README.md#agents-with-asagent) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [Config](README.md#configuration-management) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| [Template](README.md#template) | ☐ | ☐ | ☐ | ☐ | ☐ | ☑ | ☐ | ☑ | ☐ |
| [Script](README.md#script) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☑ | ☑ | ☐ |
| [Function](README.md#function) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☑ | ☐ |
| [Agent](#generate-text-or-structured-data) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ |
| [StreamingAgent](#stream-incrementally) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ | ☐ |
| [Decision](#make-decisions) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ |
| [Embedding](#embed-one-or-many-inputs) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ |
| [Reranker](#rerank-retrieved-documents) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ |
| [ImageGenerator](#generate-or-edit-images) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ |
| [Transcriber](#transcriber) | ☐ | ☐ | ☑ | ☑ | ☐ | ☐ | ☑ | ☑ | ☐ |
| [StreamingTranscriber](#streamingtranscriber) | ☐ | ☐ | ☑ | ☑ | ☐ | ☐ | ☑ | ☐ | ☐ |
| [SpeechGenerator](#generate-speech) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ |
| [VoiceSession](#hold-a-voice-conversation) | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | ☐ | ☐ |

`Template`, `Script`, and `Function` perform their named operation by default; they do not expose matching `.withTemplate`, `.withScript`, or `.withFunction` aliases. `Script.loadsScriptAsTool` is an existing alias for `Script.loadsScript.asTool`. Append `.asTool` after an input modifier where supported. Transcriber preparation returns audio values or streams; VoiceSession preparation supplies session instructions. Their checkboxes do not mean that audio passes through a text template. See [Phase 3 input modifiers](#phase-3-input-modifiers) and the [implementation rules](docs/agents-design.md#phase-3-modifier-contracts).

The language-agent sections below describe Phase 2. [Specialized components](#phase-3-specialized-components) describe Phase 3 and preserve each backend's own input and result contracts.

## Generate Text or Structured Data

Examples assume an application-provided `model` and, where used, a `tools` map.

```typescript
import { create } from 'casai';
import { Output } from 'ai';
import { z } from 'zod';

const writer = create.Agent({ model });
const answer = await writer('Explain battery recycling briefly.');
console.log(answer.output); // string; omitted output means Output.text().
console.log(answer.text);   // The SDK's text accessor remains available.

const researcher = create.Agent.withTemplate({
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
const writerStream = create.StreamingAgent({ model });
const textResult = await writerStream('Explain battery recycling briefly.');

for await (const text of textResult.textStream) {
  process.stdout.write(text);
}

// Inherit the researcher's schema, template, and other configuration.
const researchStream = create.StreamingAgent.withTemplate({}, researcher);
const reportStream = await researchStream({ topic: 'battery recycling' });

for await (const partial of reportStream.partialOutputStream) {
  console.log(partial); // Partial values; fields may still be missing.
}

const completeReport = await reportStream.output;
console.log(completeReport.summary);
```

Streaming results preserve the full SDK result: text and partial-output streams, array element streams where supported, tool events, steps, metadata, usage, and response conversion methods. The complete event stream is `result.stream` in SDK 7 (`fullStream` is its deprecated alias). `.output` is the final parsed value, not the full result or an agent instance.

Plain-text streaming without asynchronous preparation returns its result immediately. Rendered/loaded prompts and function prompts use the existing promise path; configuring `callOptionsSchema` or `prepareCall` also selects that path. Awaiting either form gives the stream handle without waiting for generation to finish. Native `.stream()` always returns a promise.

## Choose the Loop Policy

The SDK `Agent` interface specifies callable methods and metadata, not a minimum number of model steps. The same backend handles both a single step and a tool loop, with `stopWhen` controlling continuation. There is no separate agent mode to activate.

| Factory | Callable and `.run()` | Fallback stopping condition | Native `.generate()` | Native `.stream()` |
| :--- | :--- | :--- | :--- | :--- |
| `Agent` | Generate | `isStepCount(1)` | Generate | Stream |
| `StreamingAgent` | Stream | `isStepCount(1)` | Generate | Stream |

The fallback applies only when no `stopWhen` was supplied or inherited. An explicit condition always wins. A single step can execute tools, but does not automatically make another model call using their results. A step limit counts model steps, not individual tool calls. Multi-step execution can finish before its limit or pause for external tool results or approvals.

```typescript
import { isStepCount } from 'ai';

const agent = create.Agent.withTemplate({
  model,
  tools,
  prompt: 'Research {{ topic }}.',
  inputSchema: z.object({ topic: z.string() }),
  stopWhen: isStepCount(10),
});

const report = await agent({ topic: 'battery recycling' });
console.log(report.output); // Text is still the default output.

// Override the limit for this invocation only.
const shorterReport = await agent.run({
  context: { topic: 'battery recycling' },
  stopWhen: isStepCount(4),
});
```

The same configuration works on `StreamingAgent`. `stopWhen` takes a condition such as `isStepCount(10)`, not the number `10`. It also accepts custom predicates or arrays of conditions; execution stops when any supplied condition is met. See [SDK loop control](https://ai-sdk.dev/docs/agents/loop-control).

`generateText` and `streamText` execute the loop directly. Changing `stopWhen` through configuration, inheritance, or an isolated `.run()` override changes continuation behavior; it does not change rendering, output types, result interfaces, hooks, or SDK compatibility.

## Keep Casai Calling Conventions

Both factories support `.withText` (the default), `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, and `.loadsScript`. Configuration inheritance still uses the second factory argument and `.config` exposes the resolved configuration. Loop settings use the same configuration path as other SDK settings.

Plain calls accept prompt strings and model messages; rendered calls accept context. There is no `input` wrapper. A context field named `prompt` remains data. `.withFunction` keeps its context-only callable and function-valued `.run({ prompt })` override. Other prompt overrides, loaders, and history arguments follow the [existing component contracts](README.md#callable-component-objects).

`inputSchema` validates raw call-time context before configured context is merged. Required input fields cannot be supplied solely through configured context. SDK `runtimeContext` and per-tool `toolsContext` remain separate from rendering `context`.

`.run()` keeps the factory's default operation and applies allowed configuration overrides to one invocation. Concurrent runs do not mutate shared configuration or exchange context, tools, settings, or history. Output/schema contracts and renderer setup stay fixed.

Casai calls retain `response.messages` and `response.messageHistory`. For streaming, await `result.response` to read them. History is passed explicitly between calls; the component does not retain a conversation.

## Use Images and Files as Agent Input

Image understanding uses the existing model-message content parts. It does not need a separate factory or wait for Phase 3:

```typescript
const vision = create.Agent({ model: visionModel });
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

File parts, binary data, and messages returned by script/function prompts remain structured through preparation. Supported media and formats depend on the selected model and provider. Preserve generated files and content parts on Agent results as well; `output` controls parsed text/structured output, not which modality endpoint executes.

## Use the Native Agent Interface

Both components expose `version: 'agent-v1'`, `id`, `tools`, `.generate()`, and `.stream()`, regardless of their stopping condition. Streaming is part of the basic SDK `Agent` interface and does not require the `ToolLoopAgent` class. Both native methods return promises and full SDK results.

```typescript
import { createAgentUIStreamResponse } from 'ai';

// Agent can stream natively, and StreamingAgent can generate natively.
const incremental = await writer.stream({ prompt: 'Explain recycling.' });
const complete = await writerStream.generate({ prompt: 'Explain recycling.' });

for await (const text of incremental.textStream) {
  process.stdout.write(text);
}

// uiMessages is supplied by the application's chat request.
const response = await createAgentUIStreamResponse({
  agent: writer,
  uiMessages,
});
```

Native `.generate()` delegates to `generateText()`; native `.stream()` delegates to `streamText()` through a promise-returning wrapper. Awaiting `.stream()` yields the stream handle without waiting for generation to finish. Streaming is incremental, and generating does not first run or drain a stream. Each invocation starts one execution, potentially containing multiple model/tool steps. Either component works with SDK UI streaming helpers.

Native calls bypass Casai prompt rendering/loading, input validation, context merging, configured prompt/history insertion, and result augmentation. They use the configured model, tools, output, instructions, loop policy, and hooks with the supplied SDK `prompt` or `messages`. The UI helper therefore receives exactly the conversation supplied by its caller, plus configured instructions.

For example, `researcher.generate({ prompt: 'Summarize recycling.' })` uses the output schema but does not require `topic` or render the configured template. Put instructions shared by both entry paths in `instructions`.

Custom SDK call options remain separate from rendering input: native methods accept `options`; Casai configuration and `.run()` accept `callOptions`. Both use `callOptionsSchema` and `prepareCall`. Casai's existing `options` setting continues to configure Cascada. Native methods require their own custom options and do not borrow Casai defaults. See the [call-options contract](docs/agents-design.md#custom-call-options-and-hooks).

## Expose an Agent as a Tool

```typescript
const summarize = create.Agent.withTemplate.asTool({
  model,
  description: 'Summarize a topic.',
  prompt: 'Summarize {{ topic }}.',
  inputSchema: z.object({ topic: z.string() }),
  output: Output.object({ schema: z.object({ summary: z.string() }) }),
});

const result = await summarize({ topic: 'battery recycling' });
console.log(result.output.summary);

const assistant = create.Agent({
  model,
  tools: { summarize },
  stopWhen: isStepCount(10),
});
```

Calling the tool component directly returns the full result. Its SDK tool `execute` returns `result.output`, so text and structured tool outputs both follow the configured output type. An agent exposed through `.withTemplate.asTool(...)` can itself run a tool loop by configuring its own tools and `stopWhen`. `StreamingAgent` has no `.asTool` modifier.

## Update Existing Demos

Casai is in active development, and compatibility with existing demos is not a constraint on the final API. Phase 1 provides `.asAgent` on the existing factories; Phase 2 replaces those factories with `Agent` and `StreamingAgent`, which omit the modifier. No compatibility aliases or deprecation period is required when adopting Phase 2.

| Current demo API | Target API |
| :--- | :--- |
| `TextGenerator` / `TextStreamer` | `Agent` / `StreamingAgent`, default text output |
| `TextGenerator.asAgent` / `TextStreamer.asAgent` | `Agent` / `StreamingAgent`, preserving the desired `stopWhen` explicitly |
| `ObjectGenerator({ schema })` | `Agent({ output: Output.object({ schema }) })` |
| `ObjectStreamer({ schema })` | `StreamingAgent({ output: Output.object({ schema }) })` |
| Object `output: 'array'`, with element `schema` | `output: Output.array({ element: schema })` |
| Object `output: 'enum'`, with `enum` values | `output: Output.choice({ options: values })` |
| Object `output: 'no-schema'` | `output: Output.json()` |
| `.object` / `.partialObjectStream` | `.output` / `.partialOutputStream` |

The table shows changed fields; model, prompts, tools, and other relevant settings still apply. The Object mappings also apply to their Phase 1 `.asAgent` variants. Both final factories default to one step. Preserve an explicit or inherited `stopWhen`; where a Phase 1 demo relied on `.asAgent`'s twenty-step fallback, configure `stopWhen: isStepCount(20)` to retain that behavior.

Use the modern SDK output, event, and callback contracts described in the [result design](docs/agents-design.md#output-and-result-contract). Phase 1's object result aliases are not carried into the final factories. Phase 2 reuses the core built for Phase 1 and updates the public API, demos, and documentation together.

## Phase 3: Specialized Components

These planned factories reuse Casai configuration, validation, applicable input modifiers, and isolated overrides. They call the corresponding AI SDK operations directly and preserve their complete result types. The specialized operations do not implement the SDK Agent interface or expose Agent `.generate()` / `.stream()` methods. Completed-result components support `.asTool`; live streams and sessions retain their own lifecycle.

Examples below assume application-provided model instances appropriate for each operation. Explicit `.run()` calls use SDK request field names and isolate permitted overrides to that invocation. The direct embedding callable additionally accepts its input without a wrapper. Session state has a separate lifecycle from either call form.

### Phase 3 Input Modifiers

Use all applicable modifiers from the [support table](#modifier-support). Preparation follows the component's input contract:

| Component | Text/template preparation targets | Script/function preparation returns |
| :--- | :--- | :--- |
| [Decision](#make-decisions) | Text `state` | Native decision state, including structured state |
| [Embedding](#embed-one-or-many-inputs) | One text value or each value in a batch | A string or string array |
| [Reranker](#rerank-retrieved-documents) | `query` | A query string, or an explicit `{ query, documents }` input |
| [ImageGenerator](#generate-or-edit-images) | Prompt text, preserving any editing inputs | A prompt string or SDK image-prompt object |
| [Transcriber](#transcriber) | Not applicable to the audio payload | An SDK audio value, including bytes or a URL |
| [StreamingTranscriber](#streamingtranscriber) | Not applicable to the audio payload | A raw audio stream; format stays in invocation settings |
| [SpeechGenerator](#generate-speech) | `text` | Text to speak |
| [VoiceSession](#hold-a-voice-conversation) | Session instructions | Instructions for a new session |

#### Text and Template Modifiers

`.withText` uses literal text. `.withTemplate` renders it with context. `.loadsText` loads literal text, and `.loadsTemplate` loads and renders a template. The [existing Agent conventions](#keep-casai-calling-conventions) continue to apply to language prompts; Phase 3 maps prepared text to the destination above. Loading requires a configured loader.

For embeddings, an explicit text array remains a batch, with each template rendered independently in input order. For reranking and image editing, preparing text retains separately supplied documents, images, and masks. Voice-session instructions are prepared once per new connection; input modifiers do not process microphone audio or run on every conversation event.

The two transcribers omit these text modifiers because their primary input is audio. Base64 strings accepted by an audio backend are encoded audio, not text prompts. Loading a text source is not a binary-audio loader; use script/function preparation for fetching or opening audio inputs.

#### Script and Function Modifiers

`.withScript` executes an inline Cascada script, `.loadsScript` loads and executes one, and `.withFunction` calls a JavaScript preparer. Each returns the typed input in the table. Preserve bytes, URLs, arrays, and live streams without stringifying or consuming them.

Rendered variants take rendering context through Casai's normal call convention and explicit `.run({ context, ...overrides })`. `.withFunction` retains context-only calls. The plain Embedding callable continues to accept `(textOrTexts, executionOverrides?)`; its second argument is not silently reinterpreted as context. Validate raw call-time context before merging configured context, then validate prepared input against the operation contract. Preparation cannot change fixed output contracts or introduce arbitrary SDK configuration through its return value.

### Specialized Components as Tools

`Decision`, `Embedding`, `Reranker`, `ImageGenerator`, `Transcriber`, and `SpeechGenerator` support `.asTool`, including combinations with their input modifiers. Follow Casai's [tool conventions](README.md#using-components-as-tools): declare a description and input schema, map the validated tool input to the operation, and preserve tool execution context. Direct invocation keeps the full component result.

Tool execution uses a documented result mapping for each operation: decision answers, embedding vectors, ranked documents with scores, transcript data, or generated media. Media adapters preserve supported content types and use an explicit serializable representation for any remaining metadata; do not assume every result has `.output` or stringify binary payloads. Specify these mappings in the component's implementation and types.

StreamingTranscriber and VoiceSession have no `.asTool`: a live stream or session is not a completed tool response. Applications can wrap a bounded operation explicitly when needed. The existing [Agent tool contract](#expose-an-agent-as-a-tool) and [Template/Script/Function tool conventions](README.md#using-components-as-tools) remain unchanged. `.asAgent` remains exclusive to Phase 1.

### Embed One or Many Inputs

`Embedding` accepts text or a text array directly, with optional isolated execution overrides:

```typescript
// Proposed Phase 3 API; embeddingModel is application-provided.
const embedding = create.Embedding({ model: embeddingModel });

const one = await embedding('First document');
const many = await embedding(['First document', 'Second document']);
const limited = await embedding(['First document', 'Second document'], {
  maxParallelCalls: 2,
});
await embedding('Another document', {
  abortSignal: AbortSignal.timeout(5_000),
});

console.log(one.embedding);   // number[]
console.log(many.embeddings); // number[][], in input order

await embedding.run({ value: 'First document', maxRetries: 0 });
await embedding.run({ values: ['First document', 'Second document'] });
```

The backend uses SDK `embed` / `embedMany`. Keep their results, including usage and metadata, rather than returning only vectors. An array always means multiple inputs, with one vector per input in the same order. The SDK handles batching and concurrency. On the plain component, `.run()` accepts exactly one of `value` or `values`, and the callable's optional second argument contains execution settings. Rendered variants use the [input-modifier context convention](#script-and-function-modifiers). See [SDK embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings).

### Rerank Retrieved Documents

`Reranker` is useful in RAG and ordinary search. Initial retrieval finds candidates; reranking compares those candidates with the query so the most relevant ones can be passed to an answering agent:

```text
query -> vector/keyword/hybrid retrieval -> Reranker -> selected context -> Agent
```

```typescript
const reranker = create.Reranker({ model: rerankingModel });
const ranked = await reranker.run({
  query: 'How are damaged orders replaced?',
  documents: retrievedDocuments, // Candidates supplied by your search layer.
  topN: 5,
});

console.log(ranked.rerankedDocuments);
console.log(ranked.ranking); // Includes original indices and relevance scores.
```

Use SDK `rerank` and preserve its result. The component does not generate embeddings or manage the retrieval index. See [SDK reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking).

### Make Decisions

`Decision` answers named questions against shared state through `experimental_decide`:

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

const decision = await route.run({ state: 'My order arrived damaged.' });
console.log(decision.answers.department.choice);
console.log(decision.answers.department.probabilities); // Provider-dependent.
```

Keep question types, optional distributions, usage, metadata, and SDK refusal/error behavior. `Decision` can route a workflow or be called by an agent through a tool adapter; it is not itself the language-generation Agent interface. An Agent configured with `Output.choice()` continues to use generation and does not switch to the Decisions endpoint. See [SDK decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions).

### Generate or Edit Images

`ImageGenerator` uses SDK `generateImage`, including provider-supported image editing and multiple outputs:

```typescript
const illustrator = create.ImageGenerator({ model: imageModel });
const pictures = await illustrator.run({
  prompt: 'A watercolor illustration of a recycling workshop.',
  n: 2,
});
console.log(pictures.images);
```

Preserve the SDK's image data, media information, warnings, and metadata. Editing inputs, reference images, masks, size, and other settings follow model capabilities. This is separate from passing an image to an Agent for understanding or receiving generated images from a compatible language model. See [SDK image generation](https://ai-sdk.dev/docs/ai-sdk-core/image-generation).

### Transcribe Recordings or Live Audio

#### Transcriber

`Transcriber` calls SDK `transcribe` for complete recordings:

```typescript
const transcriber = create.Transcriber({ model: transcriptionModel });
const transcript = await transcriber.run({ audio: recordedAudio });
console.log(transcript.text);
console.log(transcript.segments);
```

#### StreamingTranscriber

`StreamingTranscriber` uses the installed SDK's `experimental_streamTranscribe`. It requires a streaming-capable model and raw audio in the declared format:

```typescript
const transcriberStream = create.StreamingTranscriber({
  model: streamingTranscriptionModel,
});
const transcriptStream = await transcriberStream.run({
  audio: audioStream, // ReadableStream<Uint8Array | string> of raw audio chunks.
  inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
});

for await (const part of transcriptStream.fullStream) {
  console.log(part); // Transcript delta, partial, final, or other SDK event.
}
console.log(await transcriptStream.text);
```

Awaiting the call yields the live result without draining it. Preserve the SDK's single-consumer contract: access `fullStream` before final-result promises when both are needed. Provider support is required; ordinary transcription support does not imply streaming support. See [SDK streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription).

### Generate Speech

`SpeechGenerator` uses SDK `generateSpeech`:

```typescript
const speaker = create.SpeechGenerator({ model: speechModel });
const spoken = await speaker.run({ text: 'Your replacement is on its way.' });
console.log(spoken.audio);
```

Keep generated audio, format information, and metadata accessible. Voice and other options follow provider capabilities. This operation can complete a transcription-to-Agent-to-speech pipeline. See [SDK speech generation](https://ai-sdk.dev/docs/ai-sdk-core/speech).

### Hold a Voice Conversation

`VoiceSession` represents a persistent live conversation. Its contract must cover connection setup, sending/receiving audio and text, conversation events, interruption, tool exchanges where supported, and closing the connection. Each session holds independent state; reusable configuration does not hold an implicit shared conversation.

This lifecycle is separate from returning a single Agent response stream or transcribing incoming audio. The underlying realtime provider determines transport and capabilities. Exact session method signatures remain an implementation-design decision. See [SDK realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime).

### Preserve Operation Contracts

Share configuration and orchestration machinery without forcing every operation into `GenerateTextResult` / `StreamTextResult`. Preserve multimodal inputs, native results, cancellation, and stream ownership. Tool adapters select the useful tool result explicitly; specialized results do not universally contain `.output`. Component input/override types must keep these boundaries clear, including fixed result-defining contracts and isolated concurrent runs.

See the [Phase 3 design](docs/agents-design.md#phase-3-specialized-components) for backend mappings, stream consumption, result contracts, and verification boundaries.
