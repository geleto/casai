# Casai: AI Orchestration That Writes Like a Story

> **API design draft:** This README documents the intended API, including components awaiting implementation. The [design document](docs/agents-design.md) tracks implementation stages; [remaining API details](docs/agents-design.md#remaining-public-api-details) identify signatures and result formats that still need to be specified. [README.md](README.md) documents the implementation currently in the repository.

Casai is a TypeScript library for composing AI calls, tools, and application logic into reusable workflows. Configure a component's operation, input preparation, and validation rules, with a model when the operation needs one, then call it like a function. Components can share configuration, invoke each other, and work with the Vercel AI SDK.

**All four components—LLMAgent, Template, Script, and Function—support the AI SDK Agent interface.** Each exposes `.generate()` and `.stream()`, so a model-backed agent can be replaced by a template, a workflow, or JavaScript logic while keeping the same SDK caller and chat UI. Preserve the input, output, options, and tool contracts when switching implementations; see [replacing an LLMAgent](#replacing-an-llmagent-with-template-script-or-function).

Use JavaScript for application logic, Cascada templates for text, and Cascada scripts for workflows that return data. Cascada resolves asynchronous values automatically and runs independent work concurrently, so a workflow can read in dependency order without manual promise coordination.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Understanding the Casai API](#understanding-the-casai-api)
  - [Creating and Calling Components](#creating-and-calling-components)
  - [One Agent Interface, Four Implementations](#one-agent-interface-four-implementations)
- [Configuration Management](#configuration-management)
- [The Casai Components](#the-casai-components)
- [Using Components as Tools](#using-components-as-tools)
- [Template and Script Properties](#template-and-script-properties)
- [AI SDK Properties](#ai-sdk-properties)
- [Using Components in Templates and Scripts](#using-components-in-templates-and-scripts)
- [Conversational AI: Managing Message History](#conversational-ai-managing-message-history)
- [Images and Files in LLMAgent Messages](#images-and-files-in-llmagent-messages)
- [AI SDK Agent Interface and UI Integration](#ai-sdk-agent-interface-and-ui-integration)
- [Replacing an LLMAgent with Template, Script, or Function](#replacing-an-llmagent-with-template-script-or-function)
- [Choosing Your Orchestration Strategy](#choosing-your-orchestration-strategy)
- [Embedding and RAG Integration](#embedding-and-rag-integration)
- [Input and Output Validation](#input-and-output-validation)
- [Errors, Cancellation, and Retries](#errors-cancellation-and-retries)
- [Type Checking](#type-checking)
- [Testing Workflows](#testing-workflows)

## Installation

Use Node.js 24 or later and AI SDK 7, with a compatible provider package for the models you want to call. For the OpenAI examples in this README:

```bash
npm install casai ai@^7 @ai-sdk/openai@^4 zod
```

Use ESM imports in your JavaScript or TypeScript application (`"type": "module"` in `package.json`). Run provider calls in your server or Node.js process, with credentials in its environment. For a local example, create `.env`:

```dotenv
OPENAI_API_KEY=your-api-key
```

Save the first Quick Start example as `quick-start.ts`, then run it with Node's environment-file support:

```bash
node --env-file=.env quick-start.ts
```

Casai does not load `.env` itself. Other providers use their own packages and credentials. Specialized components require the corresponding provider model type, rather than reusing a language-model instance; see the [AI SDK provider directory](https://ai-sdk.dev/providers/ai-sdk-providers) for capabilities.

## Quick Start

An `LLMAgent` prepares a prompt and returns a complete model result. Its default output is text:

```typescript
import { create } from 'casai';
import { openai } from '@ai-sdk/openai';
import { Output } from 'ai';
import { z } from 'zod';

const model = openai('gpt-4o-mini');

const explain = create.LLMAgent.withTemplate({
  model,
  prompt: 'Explain {{ topic }} in three short sentences for {{ audience }}.',
  context: { audience: 'a beginner' },
  inputSchema: z.object({ topic: z.string() }),
});

const result = await explain({ topic: 'solar panels' });
console.log(result.output);
```

The `.withTemplate` modifier renders the prompt using the call's input and configured context. `inputSchema` validates the call input; `.output` contains the generated text. The result also includes the SDK's usage, steps, and metadata.

Select an output schema when you need typed data:

```typescript
const extract = create.LLMAgent.withTemplate({
  model,
  prompt: 'Extract the main ideas from this explanation: {{ text }}',
  inputSchema: z.object({ text: z.string() }),
  output: Output.object({
    schema: z.object({ ideas: z.array(z.string()) }),
  }),
});

const ideas = await extract({ text: result.output });
console.log(ideas.output.ideas);
```

You can call components from a Cascada script to describe the same workflow:

```typescript
const explainAndExtract = create.Script({
  context: { explain, extract },
  inputSchema: z.object({ topic: z.string() }),
  script: `
    var explanation = explain({ topic: topic }).output
    var ideas = extract({ text: explanation }).output.ideas
    return { explanation: explanation, ideas: ideas }
  `,
});

console.log(await explainAndExtract({ topic: 'solar panels' }));
```

Cascada waits for the explanation before extracting ideas. No `await` is needed inside the script. Independent operations can run concurrently.

The examples below use `create`, `Output`, `z`, and `model` from this setup. Specialized AI components require a model for their own operation; names such as `embeddingModel` and `speechModel` stand for instances supplied by your chosen provider.

## Understanding the Casai API

Factories such as `create.LLMAgent` and `create.Script` create callable components. A component holds reusable configuration and performs its operation when called.

### Component Overview

Choose a component by the operation you need. `Config` supplies shared settings and is not callable. Component names link to usage examples; reference links cover Cascada syntax and AI SDK contracts. The table describes ordinary calls; the four Agent-compatible components also expose the common methods below. Model results retain SDK usage, warnings, and metadata.

| Component | What it does | Main inputs → result | Reference |
| :--- | :--- | :--- | :--- |
| [Config](#config) | Shared configuration | Settings and optional parent → `.config` | — |
| [Template](#template) | Render a Cascada template | Template and context → string, or a text stream | [Cascada templates](https://github.com/geleto/cascada/blob/master/docs/cascada/template.md) |
| [Script](#script) | Execute a Cascada workflow | Script and context → returned value, or a stream | [Cascada scripts](https://geleto.github.io/cascada-script/#/) |
| [Function](#function) | Wrap JavaScript logic | Arguments/context → returned value, or the callback's stream | — |
| [LLMAgent](#llmagent) | Generate or stream text/data; optionally loop with tools | Prompt/messages or rendering context → [.output, .text](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text#returns), or when streaming [.textStream, .elementStream, final .output](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#returns) | [generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text), [streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) |
| [Decision](#decision) | Answer choice, boolean, and score questions | `state`, configured `questions` → [.answers](https://ai-sdk.dev/docs/ai-sdk-core/decisions#question-types) | [Decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions) |
| [Embedding](#embedding) | Embed one or many texts | String or string array → [.embedding](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed#returns) or [.embeddings](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many#returns) | [Embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings) |
| [Reranker](#reranker) | Rank candidates for a query | `query`, `documents` → [.ranking, .rerankedDocuments](https://ai-sdk.dev/docs/reference/ai-sdk-core/rerank#returns) | [Reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking) |
| [ImageGenerator](#imagegenerator) | Generate or edit images | `prompt` and optional editing inputs → [.images](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-image#returns) | [Images](https://ai-sdk.dev/docs/ai-sdk-core/image-generation) |
| [Transcriber](#transcriber) | Transcribe a recording | `audio` → [.text, .segments](https://ai-sdk.dev/docs/reference/ai-sdk-core/transcribe#returns) | [Transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription) |
| [StreamingTranscriber](#streamingtranscriber) | Transcribe live audio | Audio stream and format → [.fullStream, final .text](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-transcribe#returns) | [Streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription) |
| [SpeechGenerator](#speechgenerator) | Generate spoken audio | `text` → [.audio](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-speech#returns) | [Speech](https://ai-sdk.dev/docs/ai-sdk-core/speech) |
| [VoiceSession](#voicesession) | Hold a live voice conversation | Audio/text exchange → session events | [Realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime) |

### Creating and Calling Components

Pass reusable settings to a factory, then supply task-specific input to the component it returns:

```typescript
const writer = create.LLMAgent({ model, prompt: 'Write a short welcome message.' });

const welcome = await writer();
console.log(welcome.output);
const invitation = await writer('Write a short invitation to a community dinner.');
```

The ordinary call, `component(...)`, uses the component's own input convention. A plain LLMAgent accepts prompt text or model messages. Template and Script accept rendering context; Function accepts its callback input. An Embedding accepts a string or string array. The [component sections](#the-casai-components) describe the supported positional arguments.

Without `.asStream`, the ordinary calls of LLMAgent, Template, Script, and Function return promises for complete values. LLMAgent returns an SDK result, read through `.output`; Template returns a string directly; Script returns its workflow value; Function returns its callback value. A Script or Function's `schema`, when configured, parses that native value.

A call-time prompt replaces the configured prompt for that invocation. A rendered component can also accept a one-off source and context:

```typescript
const greeting = create.Template({
  template: 'Hello {{ name }}!',
  context: { name: 'World' },
});

console.log(await greeting());                        // Hello World!
console.log(await greeting({ name: 'Ada' }));         // Hello Ada!
console.log(await greeting('Welcome {{ name }}.', { name: 'Ada' }));
```

An object supplied as rendering context is data. For example, a field named `prompt` inside that object is a template variable; it does not override the component's prompt setting. There is no `input` wrapper around ordinary calls.

To inherit shared settings, pass a [Config](#config) or a compatible component as the factory's second argument. See [configuration management](#configuration-management) for how settings are merged.

Factories are also named exports: `import { LLMAgent, Template, Script } from 'casai'` lets you write `LLMAgent(...)` instead of `create.LLMAgent(...)`.

### Adding Capabilities with Modifiers

Modifiers are properties of the factory, applied before creating the component: `create.LLMAgent.withTemplate(...)`. Input modifiers select how the source is prepared; `.asStream` and `.asTool` select how the component exposes its result.

- [`.withText`](#text-and-template-modifiers): Use literal text directly, without rendering. LLMAgent also accepts model messages and uses this modifier by default.
- [`.withTemplate`](#text-and-template-modifiers): Render an inline Cascada template with context to prepare text input.
- [`.withScript`](#script-and-function-modifiers): Execute an inline Cascada script to prepare the component's input.
- [`.withFunction`](#script-and-function-modifiers): Call a JavaScript function with context to prepare the component's input.
- [`.loadsText`](#text-and-template-modifiers): Load literal text from a named resource through the configured loader.
- [`.loadsTemplate`](#text-and-template-modifiers): Load a named Cascada template through the configured loader, then render it with context.
- [`.loadsScript`](#script-and-function-modifiers): Load a named Cascada script through the configured loader, then execute it to prepare input.
- [`.asStream`](#streaming): Make the ordinary call return a live stream result. The component's other methods keep their behavior.
- [`.asTool`](#using-components-as-tools): Expose the component as a tool a language model can invoke, while keeping it directly callable.

For LLMAgents, configure the input source in `prompt`. With `.loads...`, that value is a resource name resolved by the configured [loader](#loader). Standalone Template and Script use `template` and `script` respectively.

#### Text and Template Modifiers

Use a template when the input is text with variables, helper calls, or includes. Configured `context` supplies defaults; `inputSchema` validates the data supplied with each call:

```typescript
const translate = create.LLMAgent.withTemplate({
  model,
  prompt: 'Translate to {{ language }}: {{ text }}',
  context: { language: 'Spanish' },
  inputSchema: z.object({ text: z.string() }),
});

console.log((await translate({ text: 'Good morning' })).output);
```

#### Script and Function Modifiers

Use a script for a preparation workflow, or a JavaScript function for logic such as formatting, fetching data, or calling an API. The function may be asynchronous and receives the merged context:

```typescript
const summarize = create.LLMAgent.withFunction({
  model,
  inputSchema: z.object({ paragraphs: z.array(z.string()) }),
  prompt: ({ paragraphs }) => `Summarize this document:\n${paragraphs.join('\n\n')}`,
});

const summary = await summarize({ paragraphs: ['First paragraph.', 'Second paragraph.'] });
```

For an LLMAgent, scripts and functions can return text or model-message arrays that retain roles, tool messages, and media parts. Templates produce text.

#### Combining Modifiers

A factory form takes at most one modifier from each group, in this order:

1. An input modifier (`.with...` or `.loads...`).
2. An output modifier: `.asStream` or `.asTool`.

For example, `create.LLMAgent.withTemplate.asStream(...)` and `create.Script.loadsScript.asTool(...)` are valid.

##### Invalid combinations

- **Two input modifiers**, such as `.withTemplate.withScript`: A component prepares its input in one way.
- **`.asStream` with `.asTool`, in either order**: A tool must return a completed result to the model, so neither modifier exposes the other.
- **`.asTool` on StreamingTranscriber or VoiceSession**: A live stream or session is not a completed tool result.
- **`.asStream` on components without a streaming operation**: Only LLMAgent, Template, Script, and Function offer it; StreamingTranscriber always streams.

Unsupported combinations have no corresponding factory property. TypeScript reports them, and JavaScript sees `undefined` for the missing modifier.

#### Modifier Support

Choose a modifier supported by the component: ✅ = supported; ❌ = not applicable or not exposed.

| Component | [.withText](#text-and-template-modifiers) | [.withTemplate](#text-and-template-modifiers) | [.withScript](#script-and-function-modifiers) | [.withFunction](#script-and-function-modifiers) | [.loadsText](#text-and-template-modifiers) | [.loadsTemplate](#text-and-template-modifiers) | [.loadsScript](#script-and-function-modifiers) | [.asStream](#streaming) | [.asTool](#using-components-as-tools) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [Config](#config) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| [Template](#template) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| [Script](#script) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| [Function](#function) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| [LLMAgent](#llmagent) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| [Decision](#decision) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| [Embedding](#embedding) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| [Reranker](#reranker) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| [ImageGenerator](#imagegenerator) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| [Transcriber](#transcriber) | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| [StreamingTranscriber](#streamingtranscriber) | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| [SpeechGenerator](#speechgenerator) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| [VoiceSession](#voicesession) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

`Template`, `Script`, and `Function` perform their named operation by default, so they have no matching `.with...` modifier. Their loading, streaming, and tool forms adapt that operation.

#### Input Preparation by Component

Preparation targets the input appropriate to each operation:

| Component | Text/template preparation | Script/function return value |
| :--- | :--- | :--- |
| LLMAgent | Prompt text | Text or model messages |
| Decision | Text `state` | Decision state, including structured state |
| Embedding | One text value or each value in a batch | A string or string array |
| Reranker | `query` | A query string or `{ query, documents }` |
| ImageGenerator | Prompt text, retaining editing inputs | Text or an SDK image-prompt object |
| Transcriber | Not applicable | An SDK audio value, such as bytes or a URL |
| StreamingTranscriber | Not applicable | A raw audio stream; format is an invocation setting |
| SpeechGenerator | Text to speak | Text to speak |
| VoiceSession | Session instructions | Instructions for a new session |

Rendering context is passed through the ordinary rendered call or the component's named-argument method, such as `.generate({ context, ...overrides })`. Preparation preserves typed values such as arrays, URLs, audio bytes, and streams. It supplies operation input, rather than arbitrary model settings.

For embedding batches, templates render independently in input order. Preparing a reranking query or image prompt retains separately supplied documents or editing inputs. Transcribers use script/function preparation for fetching or opening audio; encoded audio strings are not text prompts. Voice-session instructions are prepared once per new connection.

### LLMAgent Call Reference

These forms apply to every LLMAgent, with or without `.asStream`. Here, `history` is a `ModelMessage[]`, `context` is an object, and `source` is an inline prompt/template/script or a loaded resource name, as selected by the modifier.

| Component form | Ordinary call | Meaning |
| :--- | :--- | :--- |
| Plain text | `agent()` | Use configured prompt and messages |
| Plain text | `agent('New prompt')` | Replace the configured prompt for this call |
| Plain text | `agent(history)` | Supply dynamic history, followed by any configured prompt |
| Plain text | `agent('New prompt', history)` | Supply history and replace the prompt |
| Template/script, including loaded forms | `agent(context)` | Prepare the configured source with context |
| Template/script, including loaded forms | `agent(history, context)` | Add history before the prepared prompt |
| Template/script, including loaded forms | `agent(source, context)` | Prepare a one-off source |
| Template/script, including loaded forms | `agent(source, history, context)` | Combine a source override, history, and context |
| Function prompt | `agent(context)` | Call the configured prompt function |

Zero-argument calls require enough configured input, and schemas with required fields still require call-time context. Plain-text calls do not interpolate context; select a rendering modifier to use variables. A positional message array supplies history rather than replacing a configured prompt. To replace the prompt with a message array explicitly, use `.generate({ prompt: messageArray })` or `.stream(...)`.

Function prompts accept context only in the ordinary call. Use `.generate({ context, history })` to add history, or `.generate({ context, source: replacementFunction })` to change the preparer for that invocation. For all LLMAgent forms, `.generate()` and `.stream()` offer [named fields](#named-arguments-and-per-call-overrides) when a positional call would be unclear.

### One Agent Interface, Four Implementations

All four components—LLMAgent, Template, Script, and Function—support the **[AI SDK Agent interface](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent)**. This lets the same SDK caller or chat UI use a model, a template, a workflow, or JavaScript to produce its answer. The interface provides two operations:

- **`.generate(...)`** returns a complete SDK result with a typed `.output`.
- **`.stream(...)`** returns a live SDK result with text or complete-array-element streams, final-value promises, and events for SDK UI helpers.

These methods sit alongside the ordinary callable interface:

| Call | Arguments | Result |
| :--- | :--- | :--- |
| `component(...)` | Component-specific positional input, such as prompt text or a context object | The component's native value; `.asStream` selects a stream for the ordinary call |
| `component.generate({ ... })` | Named input and per-call settings | A complete SDK result with `.output`, on all four components |
| `component.stream({ ... })` | Named input and per-call settings | A live SDK stream result, on all four components |

For example, the Template created above returns text directly when called, and an SDK result when used through `.generate()`:

```typescript
const text = await greeting({ name: 'Ada' });
const result = await greeting.generate({ context: { name: 'Ada' } });
console.log(text, result.output); // Both contain Hello Ada!
```

Use the ordinary call when composing native operations and reading their own return values. Use `.generate()` or `.stream()` for a common SDK result contract, SDK/UI integration, or per-call settings. On Template, Script, and Function, the configured SDK `output` specification applies to these Agent methods; ordinary calls retain their native return-value and `schema` contracts.

The implementation chooses how to produce the answer: LLMAgent calls a language model, Template renders text, Script executes a workflow, and Function runs JavaScript. Agent compatibility itself makes no model request. Loaded and `.asStream` forms retain both methods; `.asStream` changes only the ordinary call. SDK chat integration works with any LLMAgent stopping condition, including the default one model step. The coded components supply their own response logic; see [what the chat UI uses](#what-the-chat-ui-uses).

Use these common Agent methods as the [drop-in replacement boundary](#replacing-an-llmagent-with-template-script-or-function), preserving the input, output, options, and tool contracts expected by the caller.

An LLMAgent can let the model choose configured tools. Template, Script, and Function can call reusable functions explicitly through their `context`, including the same implementations exposed as tools. Function's callback receives that merged context. See [calling tools from coded components](#calling-tools-from-coded-components). The SDK's compatibility properties are explained in the [Agent reference](#agent-properties).

### Named Arguments and Per-Call Overrides

LLMAgent, Template, Script, and Function implement the AI SDK Agent methods `.generate()` and `.stream()`. Casai extends their accepted arguments with application input and supported runtime overrides. Both methods take one named-argument object, accept SDK requests unchanged, and return full SDK results. `.generate()` always completes the operation; `.stream()` returns a live stream result, including on components created with `.asStream`.

| Request form | Defined by | Purpose |
| :--- | :--- | :--- |
| `{ prompt: ... }` or `{ messages: ... }`, with SDK options, callbacks, and cancellation | AI SDK Agent | Generate or stream from literal text or a conversation; SDK UI helpers use this form |
| `{ context: ... }`, with optional `source` and supported overrides | Casai | Execute the configured operation with typed application input, optionally changing its source or settings for this invocation |

For a Template, Script, or Function, supply application input in `context`, for example `receipt.generate({ context: { orderId: 'A123', count: 3 } })`. A source override accompanies `context` as `source`; it never comes from conversation content. SDK `prompt` or `messages` instead uses the component's [conversation mapper](#map-conversations-to-component-input). Choose either an explicit-context call or a conversation call; a coded component does not accept both together. Ordinary calls take their component-specific positional arguments.

LLMAgent additionally accepts model request overrides:

```typescript
const detailed = await explain.generate({
  source: 'Explain {{ topic }} with one practical example for {{ audience }}.',
  context: { topic: 'solar panels', audience: 'a homeowner' },
  maxOutputTokens: 600,
});
```

| Field | Meaning |
| :--- | :--- |
| `context` | Rendering input for template, script, and function forms |
| `history` | Already-prepared conversation history, placed after configured `messages` and before the new prompt |
| `messages` | A complete literal conversation, using the SDK meaning; replaces the configured prompt without rendering |
| `source` | A one-off template, script, preparer function, or resource name, prepared like the configured `prompt` |
| `prompt` | Literal text or model messages that replace the configured prompt; never rendered |
| `options` | [Custom call options](#custom-call-options-and-hooks), validated by `callOptionsSchema` |
| Other settings | Model settings, tools, callbacks, `stopWhen`, cancellation, and other per-call overrides |

For LLMAgent, use at most one of `source`, `prompt`, or `messages`. A call-time `prompt` or `messages` is used as written: the configured source is not prepared, so rendering and `inputSchema` validation are skipped and no `context` is needed. Use `history` with rendering context or a new literal `prompt`; a complete `messages` request cannot also supply `history`. Configured static `messages` and `instructions` still apply.

A field set to `undefined` counts as not supplied and leaves the configured value in place. Callbacks passed for one call run in addition to the configured callbacks. These rules also let [AI SDK helpers](#ai-sdk-agent-interface-and-ui-integration) call `.generate()` and `.stream()` directly.

Overrides are isolated: concurrent calls can use different context, settings, tools, and history without changing the component or each other.

Isolation applies to Casai's invocation settings; models, helper functions, and nested application objects are not deep-cloned. Keep mutable conversation or request state in per-call inputs rather than shared helper closures or configured objects.

All four components accept invocation input, custom options, lifecycle callbacks, cancellation, and timeouts; streaming calls also accept SDK transforms. LLMAgent accepts model settings and compatible tool implementation overrides. The output contract, validation schemas, conversation mapper, and renderer setup stay fixed. Create another component to change `output`, add tools with new types, or change `inputSchema`, `prepareInput`, `filters`, `renderOptions`, or `loader`.

Specialized components name their method after the operation and use its SDK input fields, such as `transcriber.transcribe({ audio })` or `reranker.rerank({ query, documents })`. `VoiceSession` has a [session lifecycle](#voicesession).

### Streaming

Use `.stream()` to stream a particular invocation, or create a component with `.asStream` to make its ordinary call stream. LLMAgent, Template, Script, and Function offer both forms. StreamingTranscriber always streams through its ordinary call or `.stream()` and does not need a modifier.

| Component | Ordinary call | Ordinary call with `.asStream` | `.stream()` arguments |
| :--- | :--- | :--- | :--- |
| LLMAgent | Complete result | Stream result | [Named arguments](#named-arguments-and-per-call-overrides) |
| Template | Complete text | Stream result | [Named arguments](#named-arguments-and-per-call-overrides) |
| Script | Returned value | Stream result | [Named arguments](#named-arguments-and-per-call-overrides) |
| Function | Callback result | The callback's stream | [Named arguments](#named-arguments-and-per-call-overrides) |

Streaming calls return a promise for the stream result; awaiting it yields the live handle without waiting for the output to finish. Text streams expose `textStream`, with the joined string in the final `text` promise. Array streams expose `elementStream`, with the collected array in the final `output` promise. Agent results also expose the final parsed `output` for text. [StreamingTranscriber](#streamingtranscriber) keeps its native transcription result with `fullStream` events and final `text`; it does not provide this common text/array streaming contract.

Without `.asStream`, Template and Script return a complete value from the ordinary call; with it, await the stream result's final value. A Function's callback supplies the stream when `.asStream` is selected. All four components retain SDK `.generate()` and `.stream()` regardless of that modifier. A regular Function's `.stream()` emits the completed callback value when ready; a streaming callback supplies incremental chunks. See the [execution rules](#agent-settings-streaming-and-tools).

When a Template or Script streams, the components it calls stream too; see [streaming through templates and scripts](#streaming-through-templates-and-scripts).

Results also offer [unordered output streams](#ordered-and-unordered-streams) for receiving ready chunks with their logical positions. Script and template loops consume them with the same syntax as ordinary streams.

#### Text and Array Element Streams

Streaming has two native output forms for Template, Script, and Function:

| Output | Incremental values | Final Agent `.output` |
| :--- | :--- | :--- |
| `Output.text()` | String chunks through `textStream` | One complete string |
| `Output.array({ element })` | Complete, validated elements through `elementStream` | An array of those elements in logical order |

The schema describes the final output in both generation and streaming modes. For an array, `element` describes one complete item. Each item is delivered once; consumers can render or process it immediately. `.generate()` returns the complete array, while `.stream()` exposes its elements as they become available and resolves `output` to the collected array.

A Template producing an array renders JSON text; Casai exposes each completed array item after parsing and validation. A Script selects a live sequence of complete items, and a Function can yield those items from an async generator. Plain returned arrays become available when complete and can then be delivered element by element. Text output is assembled by joining chunks. Neither mode asks the program to return a different final data type.

Standalone objects remain supported as complete outputs through `Output.object(...)` or `Output.json()`. Coded components deliver such a value when ready; incremental object updates are outside their native streaming contract. LLMAgent retains the SDK's `partialOutputStream` for compatibility. Casai's streaming examples and unordered output extensions focus on text and complete array elements.

## Configuration Management

### Config

`Config` groups settings for reuse. Pass it as the second factory argument to inherit them:

```typescript
const defaults = create.Config({
  model,
  maxOutputTokens: 500,
  context: { language: 'English' },
});

const summarizer = create.LLMAgent.withTemplate({
  prompt: 'Summarize in {{ language }}: {{ text }}',
  inputSchema: z.object({ text: z.string() }),
}, defaults);

const shortSummarizer = create.LLMAgent.withTemplate({
  maxOutputTokens: 150,
}, summarizer);

console.log((await shortSummarizer({ text: 'A document to summarize.' })).output);
```

A `Config` can be partial: the final component supplies any missing required settings. Components can also inherit from compatible components. Local settings take precedence according to these rules:

| Property | Inheritance behavior |
| :--- | :--- |
| `context`, `filters`, `tools`, `toolsContext` | Merge by key; a child entry replaces the same parent entry |
| `messages` | Concatenate, parent messages first |
| `loader` | Try child loaders before parent loaders; named race groups combine |
| Other properties, including `model`, `prompt`, schemas, `output`, `options`, `renderOptions`, and `providerOptions` | Replace the whole value |

Key merging is shallow. A child `context: { settings: { language: 'French' } }` replaces the entire inherited `settings` value. A `toolsContext` entry similarly replaces that tool's whole context value.

Omitting a property inherits it. Explicit `undefined` clears ordinary replacement properties. For merged maps, an omitted, empty, or `undefined` whole map retains inherited entries; an explicitly `undefined` entry replaces that entry. Empty or `undefined` `messages` and `loader` values retain the inherited collection. These rules apply to configuration inheritance; in call-time arguments, `undefined` means not supplied.

Keep shared fragments compatible with their consumers. A context-only Config can be shared by a Script and an LLMAgent; a Config containing language-model settings is not a standalone Template configuration. Settings such as `execute` belong to Function, while public Agent output schemas belong inside `Output.object(...)` or another `Output` specification on any of the four Agent-compatible components. Incompatible inherited properties are rejected along with incompatible local ones.

### Inspecting Configuration

`Config`, `Template`, `Script`, and AI request components expose their resolved configuration through `.config`:

```typescript
console.log(shortSummarizer.config.maxOutputTokens); // 150
console.log(shortSummarizer.config.context);         // { language: 'English' }
```

`Function` and `Function.asTool` expose configuration properties directly on the callable. Use inheritance or per-call arguments to vary settings instead of mutating a shared component. Set `debug: true` when you need configuration and invocation diagnostics.

## The Casai Components

The following sections cover creating and calling each component and reading its result. [Config](#config) supplies shared settings. Choose a model suited to the operation: a language model for LLMAgents, an embedding model for Embedding, and the corresponding provider model for other AI operations.

LLMAgent, Template, Script, and Function share the [Agent interface](#one-agent-interface-four-implementations), input validation, configuration inheritance, and tool adaptation. A Template, Script, or Function can [replace an LLMAgent directly](#replacing-an-llmagent-with-template-script-or-function) in SDK calls and UI handlers when its input, output, options, and tool contracts match.

### Template

`Template` renders text with Cascada. Use it for prompts, reports, messages, or presentation without necessarily making a model call.

```typescript
const receipt = create.Template({
  template: 'Order {{ orderId }} contains {{ count }} items.',
  inputSchema: z.object({ orderId: z.string(), count: z.number() }),
});

const text = await receipt({ orderId: 'A123', count: 3 });
console.log(text);
```

Configure the source with `template`. Call with context, or with a one-off template string followed by context. The result is a promise for the rendered string. Context can contain functions and other components; Cascada resolves asynchronous values during rendering.

For a file or named resource, use `.loadsTemplate`:

```typescript
import { FileSystemLoader } from 'casai';

const report = create.Template.loadsTemplate({
  loader: new FileSystemLoader('./templates'),
  template: 'report.njk',
});

console.log(await report({ title: 'Weekly report' }));
```

In this form, a call-time source override is another resource name. `.asTool` and `.loadsTemplate.asTool` expose the rendered string as a tool result. Standalone templates default to no HTML escaping; set `renderOptions: { autoescape: true }` for HTML output.

Template implements the Agent interface directly. `receipt.generate({ context: { orderId: 'A123', count: 3 } })` returns an SDK result whose `.output` contains the rendered text. Configure `prepareInput` to map SDK conversations into variables, and `output` for structured Agent output; see [replacing an LLMAgent](#replacing-an-llmagent-with-template-script-or-function). The ordinary call still returns a string.

#### Streaming a Template

`.stream()` takes named arguments and delivers the text as it renders. Put template variables in `context`. LLMAgents called by the template stream their output into it:

```typescript
const writeIntro = create.LLMAgent.withTemplate({
  model,
  prompt: 'Write a two-sentence introduction to {{ topic }}.',
  inputSchema: z.object({ topic: z.string() }),
});

const newsletter = create.Template({
  template: 'Weekly update\n\n{{ writeIntro({ topic: topic }) }}',
  inputSchema: z.object({ topic: z.string() }),
  context: { writeIntro },
});

const issue = await newsletter.stream({ context: { topic: 'battery recycling' } });
for await (const text of issue.textStream) {
  process.stdout.write(text);
}
```

The heading arrives at once, and the introduction follows as the model writes it. `await issue.text` gives the complete text. Create the Template with `.asStream` to make streaming its ordinary call. See [streaming](#streaming) and [streaming through templates and scripts](#streaming-through-templates-and-scripts).

See the [Cascada template reference](https://github.com/geleto/cascada/blob/master/docs/cascada/template.md) for expressions, loops, includes, and inheritance.

### Script

`Script` runs a Cascada workflow and returns its value. Use it to call components, combine data, and express dependencies between asynchronous operations.

```typescript
const totals = create.Script({
  inputSchema: z.object({ price: z.number(), quantity: z.number() }),
  schema: z.object({ subtotal: z.number() }),
  script: `
    var subtotal = price * quantity
    return { subtotal: subtotal }
  `,
});

console.log(await totals({ price: 12, quantity: 3 })); // { subtotal: 36 }
```

Configure source with `script`. Call with context, or a one-off script and context. Use direct `return` values for strings, numbers, objects, arrays, or other supported workflow results. `schema` optionally validates the returned value.

`.loadsScript` loads a named script through a configured loader. `.asTool` and `.loadsScript.asTool` expose the workflow as a tool; `Script.loadsScriptAsTool` is an alias for `Script.loadsScript.asTool`. Both inline and loaded scripts can call helpers or components from context.

Script implements the Agent interface directly. `.generate({ context: ... })` returns an SDK result; configure `output` to describe its public value and `prepareInput` to map SDK conversations into workflow input. The ordinary call keeps its own `schema` and return-value contract; see [shared input and output schemas](#output-schemas-and-structured-replacements).

`.stream({ context: ... })` returns a live SDK result whose `output` resolves to the value parsed by the configured SDK output specification. `.asStream` makes the ordinary call return a stream with the native final value. Components called by a streaming script stream too, as described in [streaming through templates and scripts](#streaming-through-templates-and-scripts).

Script streams text chunks or complete array elements. A plain returned value becomes available when complete; incremental output requires a selected live text or item sequence. **Draft API detail:** the exact syntax binding that live output to the Script result remains to be specified in the [streaming design](docs/agents-design.md#phase-4-streaming-template-script-and-function). The array result collects all emitted elements in logical order; there is no incremental object-update contract.

See [Cascada script documentation](https://geleto.github.io/cascada-script/#/) for language syntax and concurrency, and [composition examples](#using-components-in-templates-and-scripts) below.

### Function

`Function` wraps JavaScript logic with reusable configuration and validation. Use it for application services, transformations, or SDK tools.

```typescript
const normalize = create.Function({
  inputSchema: z.object({ text: z.string() }),
  schema: z.string(),
  execute: ({ text }) => text.trim().toLowerCase(),
});

console.log(await normalize({ text: '  HELLO  ' })); // hello
```

`execute` may be synchronous or asynchronous; the Function component itself returns a promise. Its resolved value is validated and parsed against `schema` when supplied. Configured `context` enriches the callback's input. Without `inputSchema`, the callback's declared argument type determines call input, with configured context fields optional.

A Function can inherit from a `Config` or another Function. If a child changes schemas or context incompatibly, provide an `execute` callback that matches the final configuration. Use `.asTool` to let an LLMAgent call the function; see [tools](#using-components-as-tools) for execution context and validation behavior.

Function implements the Agent interface directly. `normalize.generate({ context: { text: '  HELLO  ' } })` returns an SDK result with `.output === 'hello'`. Configure `prepareInput` for SDK conversations and `output` for structured results. A complete-value callback can serve the chat UI through `.stream()`; its value is emitted when ready. See [replacing an LLMAgent](#replacing-an-llmagent-with-template-script-or-function).

#### Streaming from a Function

With `.asStream`, the callback returns a text or array-element stream. It can return a compatible stream result from another component, such as `writer.stream(...)`, or an async iterable, including an async generator. Native transcription results retain their own event contract and need explicit consumption or adaptation. With the default text output, string chunks become `textStream`, and `text` resolves to the joined chunks:

```typescript
const countdown = create.Function.asStream({
  inputSchema: z.object({ from: z.number() }),
  execute: async function* ({ from }) {
    for (let n = from; n > 0; n--) yield `${n}... `;
    yield 'Liftoff!';
  },
});

const launch = await countdown({ from: 3 });
for await (const text of launch.textStream) {
  process.stdout.write(text);
}
```

TypeScript and runtime validation reject a callback that does not return a stream when `.asStream` is selected. `schema` validates the native final value. Function also exposes `.stream({ context: ... })` and `.generate({ context: ... })`: the former forwards the callback's stream, while the latter collects that one execution into a complete SDK result. `.asStream` cannot be combined with `.asTool`.

For an array stream, configure `Output.array(...)` and yield one complete element at a time:

```typescript
const titles = create.Function.asStream({
  inputSchema: z.object({ topics: z.array(z.string()) }),
  output: Output.array({ element: z.object({ title: z.string() }) }),
  execute: async function* ({ topics }) {
    for (const topic of topics) yield { title: `Guide to ${topic}` };
  },
});

const titleStream = await titles.stream({ context: { topics: ['Solar', 'Wind'] } });
for await (const item of titleStream.elementStream) {
  console.log(item.title); // Each item is complete.
}
console.log(await titleStream.output); // [{ title: 'Guide to Solar' }, { title: 'Guide to Wind' }]
```

Each yielded value is an array element, including when the element itself is a string or an array. The configured output kind determines whether strings are text chunks or array items. `.generate()` collects the elements into the complete array from one callback execution. A native `schema`, when supplied, describes that final array. See [text and array element streams](#text-and-array-element-streams) for the shared contract.

### LLMAgent

`LLMAgent` generates a complete language-model result, or streams it with [`.asStream`](#streaming-with-asstream) or `.stream()`. Use it for writing, extraction, classification, image understanding, or tasks involving tools. Text is the default output, and one model step is the default stopping condition.

```typescript
const writer = create.LLMAgent({ model });
const answer = await writer('Explain battery recycling briefly.');

console.log(answer.output); // Parsed output; a string by default.
console.log(answer.text);   // The SDK text accessor is also available.
```

Plain calls accept prompt text or model messages; rendered forms accept context. All seven input modifiers are supported. `.generate()` and `.stream()` accept [named inputs and isolated overrides](#named-arguments-and-per-call-overrides).

Code that consumes the SDK Agent interface can instead use a [Template, Script, or Function directly](#replacing-an-llmagent-with-template-script-or-function) with the same external input and output contracts.

#### Structured Output

Set `output` to describe the value you need:

| Desired result | Configuration |
| :--- | :--- |
| Text | Omit `output`, or use `Output.text()` |
| Validated object | `Output.object({ schema })` |
| Array of validated elements | `Output.array({ element: schema })` |
| One allowed string | `Output.choice({ options: ['yes', 'no'] })` |
| JSON without a fixed schema | `Output.json()` |

```typescript
const researcher = create.LLMAgent.withTemplate({
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
```

`output` determines parsing, validation, and the inferred type of `result.output`. It is fixed when the component is created. Structured output can be combined with tools. See [SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).

Use schema descriptions and the output specification's supported `name` and `description` fields to explain the desired data to the model. The selected model must support the requested output and tool capabilities; Casai does not make every model support every schema or media type.

#### Tool Loops and Stopping Conditions

An LLMAgent can execute tools during a model step. To let the model read their results and continue, configure more than one step:

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

The default is `isStepCount(1)` when no stopping condition is supplied or inherited. A step limit counts model steps, not individual tool calls; execution can finish before reaching it. A single step can run tools but cannot make another model call to interpret their results.

`stopWhen` accepts a condition, such as `isStepCount(5)`, or an array of conditions; any matching condition stops continuation. It can also be overridden for one `.generate()` or `.stream()` call. See [SDK loop control](https://ai-sdk.dev/docs/agents/loop-control).

#### LLMAgent Results

The call returns the full [SDK generation result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text#returns), including parsed output, text, tool calls and results, steps, usage, files, and provider metadata where available. `.output` is the parsed value, not the entire result.

| Field | Scope in AI SDK 7 |
| :--- | :--- |
| `output`, `text` | Parsed output and text from the final step |
| `content`, `toolCalls`, `toolResults`, `files`, `sources` | Accumulated across steps |
| `usage` | Total token usage across steps |
| `steps` | Individual model steps, with their own usage, content, and responses |
| `finalStep` | The last step, including reasoning, provider metadata, and response details |
| `finishReason`, `warnings` | Why execution ended and provider warnings |

An execution can end with tool calls, an approval request, or no generated answer. In such cases, reading `.output` can throw `NoOutputGeneratedError`, even with the default text output. Inspect `content`, `toolCalls`, `finishReason`, and `steps` when handling tool workflows; do not assume every successful request has a final answer. See [approvals and continuation](#tool-approvals-and-continuation).

Casai additionally supplies [conversation history](#conversational-ai-managing-message-history). `.asTool` exposes the LLMAgent's parsed output to another model while direct calls retain the full result. The same methods serve [AI SDK integration](#ai-sdk-agent-interface-and-ui-integration).

### Streaming with `.asStream`

The `.asStream` modifier affects only the ordinary call, which then returns a live stream result instead of a complete one. Nothing else changes: `.generate()` still returns a complete result and `.stream()` a stream result, with or without `.asStream`.

```typescript
const writerStream = create.LLMAgent.asStream({ model });
const textResult = await writerStream('Explain battery recycling briefly.');

for await (const text of textResult.textStream) {
  process.stdout.write(text);
}
console.log(await textResult.usage);
```

Use `.asStream` when code that only calls the component, such as a handler that receives it or a Script that does not itself stream, should get a stream. When you hold the component yourself, `.stream()` works without it, and a [streaming Template or Script](#streaming-through-templates-and-scripts) streams the LLMAgents it calls without it. For an array response, configure `Output.array(...)` and consume each complete item through `elementStream`, as shown below. Await `output` for the collected array.

The [SDK streaming result](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#returns) includes text, partial-output and supported array-element streams, tool events, steps, usage, metadata, and response conversion methods. Use `result.stream` for the complete SDK 7 event stream; `fullStream` is its deprecated alias. Final values such as `.output` and `.response` are promises.

The streaming ordinary call and `.stream()` always return a promise for the stream result. Awaiting it yields the live handle without waiting for generation to finish.

`.asStream` follows any input modifier, as in `create.LLMAgent.withTemplate.asStream(...)`. It cannot be combined with `.asTool`, because a tool returns a completed result; use an LLMAgent without `.asStream` for tools.

#### Consuming a Stream

Choose a stream for the information you need:

| Stream | Contains |
| :--- | :--- |
| `textStream` | Text deltas; no tool or error events |
| `elementStream` | Completed array elements, when using `Output.array(...)` |
| `stream` | All events, including tools, errors, and completion |
| `partialOutputStream` | The SDK's partial parsed output, retained on LLMAgent results; native coded streams use text or complete elements |

For example, use an element stream to process each completed item:

```typescript
const list = create.LLMAgent.asStream({
  model,
  output: Output.array({ element: z.object({ title: z.string() }) }),
});
const items = await list('Suggest three titles for an article about recycling.');

for await (const item of items.elementStream) {
  console.log(item.title);
}
console.log(await items.output); // Complete array of titles.
```

Stream consumption drives completion. Read a stream, forward it to an HTTP response, or call `await result.consumeStream()` when only completion matters. Final-result promises such as `.output`, `.usage`, and `.steps` also trigger consumption. Awaiting the component call alone only obtains the handle. To display incremental output, consume that stream before awaiting the final value.

Use `onError` or the full event stream to observe generation errors; `textStream` does not expose error events. See [error handling](#errors-cancellation-and-retries). StreamingTranscriber has its own single-consumer rules described in its section.

### Decision

`Decision` answers named choice, boolean, or score questions against shared state. Use it to route requests, apply a rubric, or evaluate several related questions.

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

const decision = await route.decide({ state: 'My order arrived damaged.' });
console.log(decision.answers.department.choice);
console.log(decision.answers.department.probabilities); // When supplied by the provider.
```

Configure the model and question definitions, then supply `state` to `.decide()` for each invocation. Input modifiers prepare that state. The result retains typed answers, any distributions, usage, metadata, and SDK refusal/error behavior.

Decision performs a decision request and does not run a tool loop. It can itself be exposed as a tool with `.asTool`. For choosing a value as part of a language-generation workflow, an `LLMAgent` can instead use `Output.choice()`; that uses the generation operation.

See [SDK Decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions) for question types, state formats, model support, and results.

### Embedding

`Embedding` converts text into vectors for semantic search, similarity, clustering, and retrieval. Pass one string or an array directly:

```typescript
const embedding = create.Embedding({ model: embeddingModel });

const one = await embedding('First document');
const many = await embedding(['First document', 'Second document']);

console.log(one.embedding);   // number[]
console.log(many.embeddings); // number[][], in input order
```

An array always represents a batch, with one output vector per input. The SDK handles batch splitting and concurrency. The result retains usage and metadata as well as vectors.

The plain callable accepts execution settings as its optional second argument:

```typescript
await embedding(['First document', 'Second document'], { maxParallelCalls: 2 });
await embedding('Another document', { abortSignal: AbortSignal.timeout(5_000) });

// Named-argument forms:
await embedding.embed({ value: 'First document', maxRetries: 0 });
await embedding.embed({ values: ['First document', 'Second document'] });
```

Use exactly one of `value` or `values` in `.embed()`. The plain callable's second argument contains execution overrides; rendered variants take rendering context through their own context convention. All input modifiers and `.asTool` are supported. A script or function preparer can return either one string or a batch.

See [single-input results](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed#returns), [batch results](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many#returns), and [RAG integration](#embedding-and-rag-integration).

### Reranker

`Reranker` orders candidate documents by relevance to a query. Use it after keyword, vector, or hybrid retrieval to select useful context for an LLMAgent or improve search results.

```typescript
const reranker = create.Reranker({ model: rerankingModel });
const ranked = await reranker.rerank({
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

Supply `query`, `documents`, and optionally `topN` in `.rerank()`. Text and template modifiers prepare the query; script/function modifiers can return a query or a complete `{ query, documents }` input. `.asTool` is supported.

The result preserves the SDK ranking and document mapping. Reranker operates on candidates you supply; your application or retrieval service manages the index. See [SDK reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking) and [return fields](https://ai-sdk.dev/docs/reference/ai-sdk-core/rerank#returns).

### ImageGenerator

`ImageGenerator` generates images from a prompt and supports editing when the model provides it.

```typescript
const illustrator = create.ImageGenerator({ model: imageModel });
const pictures = await illustrator.generate({
  prompt: 'A watercolor illustration of a recycling workshop.',
  n: 2,
});

console.log(pictures.images);
```

Configure an image model and reusable defaults, then pass prompt and image settings to `.generate()`. Editing uses the SDK's image-prompt object and provider-supported inputs such as reference images or masks. Available sizes, output counts, and editing options depend on the model.

All input modifiers and `.asTool` are supported. Text preparation updates the prompt while retaining separately supplied editing inputs; script/function preparation can produce a text prompt or an image-prompt object.

The [result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-image#returns) includes generated images with their media data, warnings, and metadata. To understand an existing image with a language model, use [LLMAgent image messages](#images-and-files-in-llmagent-messages). See [SDK image generation](https://ai-sdk.dev/docs/ai-sdk-core/image-generation) for editing formats and provider options.

An image exposes `.uint8Array`, `.base64`, and `.mediaType`. For editing, supply the source bytes in a prompt object:

```typescript
import { readFile } from 'node:fs/promises';

const edited = await illustrator.generate({
  prompt: {
    images: [await readFile('./workshop.png')],
    text: 'Change the wall color to light blue.',
  },
});
console.log(edited.images[0]?.mediaType);
```

This requires an editing-capable model. Serve image bytes with their reported media type, or construct a data URL from `.mediaType` and `.base64`.

### Transcriber

`Transcriber` turns a recording into a completed transcript.

```typescript
import { readFile } from 'node:fs/promises';

const transcriber = create.Transcriber({ model: transcriptionModel });
const recordedAudio = await readFile('./recording.wav');
const transcript = await transcriber.transcribe({ audio: recordedAudio });

console.log(transcript.text);
console.log(transcript.segments);
```

`recordedAudio` is an SDK-supported audio value, such as audio bytes or a URL. The selected provider determines supported formats. The [result](https://ai-sdk.dev/docs/reference/ai-sdk-core/transcribe#returns) retains text, segments, language information, and other available SDK fields.

Use `.withScript`, `.withFunction`, or `.loadsScript` to obtain audio before transcription, and `.asTool` to expose the completed operation. Text/template modifiers do not apply to audio payloads. See [SDK transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription).

### StreamingTranscriber

`StreamingTranscriber` produces transcript events while receiving live audio. It requires a streaming-capable transcription model and audio in the declared format.

```typescript
const transcriberStream = create.StreamingTranscriber({
  model: streamingTranscriptionModel,
});

const transcriptStream = await transcriberStream.stream({
  audio: audioStream, // ReadableStream<Uint8Array | string> of raw audio chunks.
  inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
});

for await (const part of transcriptStream.fullStream) {
  console.log(part);
}
console.log(await transcriptStream.text);
```

Awaiting `.stream()` gives you the live result. The [result contract](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-transcribe#returns) has a single-consumer event stream: access and consume `fullStream` before awaiting final-result promises when you need both. Awaiting final results first lets the SDK consume the stream internally.

Casai preserves transcript delta, partial, and final events rather than converting them into `textStream` chunks. Consume `fullStream` explicitly for incremental transcription, or await `text` for use in a workflow. Automatic forwarding into a Template or Script text stream is not part of this contract.

Script/function modifiers can open or obtain the raw audio stream; the audio format stays in invocation settings. `.asTool` is not available for this live operation. See [SDK streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription) for events and provider support.

### SpeechGenerator

`SpeechGenerator` converts text into spoken audio.

```typescript
const speaker = create.SpeechGenerator({ model: speechModel });
const spoken = await speaker.generate({ text: 'Your replacement is on its way.' });

console.log(spoken.audio);
```

Configure a speech model and reusable defaults. `.generate()` supplies the text and any supported overrides, such as voice or output-format settings. All input modifiers prepare the text to speak; `.asTool` is also supported.

The [result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-speech#returns) retains generated audio, format information, and metadata. Combine Transcriber, LLMAgent, and SpeechGenerator for a recording-to-answer workflow. See [SDK speech generation](https://ai-sdk.dev/docs/ai-sdk-core/speech).

`spoken.audio` exposes `.uint8Array`, `.base64`, and `.mediaType`. To return playable audio from a server handler:

```typescript
const audioResponse = new Response(Uint8Array.from(spoken.audio.uint8Array), {
  headers: { 'Content-Type': spoken.audio.mediaType },
});
```

When saving to a file, choose an extension matching the actual media type or configure a supported output format explicitly.

### VoiceSession

`VoiceSession` represents a live conversation that exchanges audio and text over a persistent connection. Use it for interactive voice applications that need conversation events, interruption, and tool exchanges where supported by the provider.

A session's lifecycle covers opening the connection, supplying audio or text, consuming events and responses, interrupting an active response, and closing the connection. Each connection owns its conversation state. Reusable component configuration supplies defaults without sharing one conversation between callers.

Input modifiers prepare session instructions once per new connection. They do not process microphone audio or run for every event. A VoiceSession has its own session and transport interface, and does not expose `.asTool` or the language LLMAgent result interface.

The selected realtime provider determines transport and capabilities; see [SDK realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime). **Draft API detail:** Casai's exact session method signatures are still to be specified in the [voice-session design](docs/agents-design.md#transcription-and-voice), so a callable example is not yet defined.

## Using Components as Tools

Append `.asTool` to a supported factory to let a language model invoke it. Supply a `description` explaining when to use it and an `inputSchema` describing the model-provided arguments.

```typescript
const summarizeTool = create.LLMAgent.withTemplate.asTool({
  model,
  description: 'Summarize a supplied document in one paragraph.',
  inputSchema: z.object({ text: z.string() }),
  prompt: 'Summarize this document in one paragraph: {{ text }}',
  output: Output.object({ schema: z.object({ summary: z.string() }) }),
});

const assistant = create.LLMAgent({
  model,
  tools: { summarize: summarizeTool },
  stopWhen: isStepCount(5),
});

// A direct component call still returns the full generation result.
const summary = await summarizeTool({ text: 'A document to summarize.' });
console.log(summary.output.summary);
```

When the SDK invokes this LLMAgent tool, its `execute` returns the parsed `.output`. Template tools return rendered text, Script tools return the script value, and Function tools return the callback result. Completed specialized operations expose their useful operation data, such as decision answers, vectors, ranked documents, transcript data, or generated media. Direct AI component calls retain the full SDK result.

Components created with `.asStream`, StreamingTranscriber, and VoiceSession cannot be tools; see [combining modifiers](#combining-modifiers). Use a completed operation when the model needs a tool response. Plain SDK tools can also be placed in an LLMAgent's `tools` map.

### Calling Tools from Coded Components

`tools` registers named SDK tool definitions: their descriptions, argument schemas, and execution handlers where available. On an LLMAgent, the model can select these tools. On a Template, Script, or Function, the program decides which operations to call. The public `.tools` map also tells SDK/UI integrations how to validate tool messages in a conversation.

Template, Script, and Function can call tool implementations as normal context methods. Put a callable component in `context` and register its `.asTool` form in `tools`. A Script calls the context method directly; a Function's `execute` callback receives it alongside the validated input:

```typescript
const numberInput = z.object({ a: z.number(), b: z.number() });

const multiplyNumbers = create.Function({
  inputSchema: numberInput,
  execute: ({ a, b }) => a * b,
});

const multiplyTool = create.Function.asTool({
  description: 'Multiply two numbers.',
}, multiplyNumbers);

const calculatorSettings = {
  inputSchema: numberInput,
  tools: { multiply: multiplyTool },
  context: { multiply: multiplyNumbers },
};

const scriptedCalculator = create.Script({
  ...calculatorSettings,
  script: 'return "Product: " ~ multiply({ a: a, b: b })',
});

const codedCalculator = create.Function({
  ...calculatorSettings,
  execute: async ({ a, b, multiply }) => `Product: ${await multiply({ a, b })}`,
});

console.log(await scriptedCalculator({ a: 6, b: 7 })); // Product: 42
console.log(await codedCalculator({ a: 6, b: 7 }));    // Product: 42
```

Both components reuse the same implementation: `tools.multiply` describes its SDK tool form, and `context.multiply` supplies the callable method. A Template can use that same context entry in `{{ multiply({ a: a, b: b }) }}`. Helpers can also be grouped under a context object, such as `context: { helpers: { multiply: multiplyNumbers } }`, and called as `helpers.multiply(...)`.

Context helpers are supplied explicitly; configuring `tools` alone does not insert functions into context. Plain SDK tool definitions are objects, and some have no local execution handler. To use one from application code, expose its underlying application function or an explicit callable wrapper in context. SDK tool execution metadata, validation, and lifecycle are described in [tool execution context](#tool-execution-context).

A direct helper call follows the component's normal call contract. Merely registering that helper as a tool does not emit SDK tool-call events or apply a model's tool approval policy. Coded workflows expose tool events only when they produce or forward actual SDK-compatible events.

### Tool Execution Context

Use `contextSchema` for application data supplied to a tool without asking the model to provide it. Pass that data through the LLMAgent's `toolsContext` map:

```typescript
const scale = create.Function.asTool({
  description: 'Scale a number by the configured factor.',
  inputSchema: z.object({ value: z.number() }),
  contextSchema: z.object({ factor: z.number() }),
  execute: ({ value }, { context }) => value * context.factor,
});

const scalingAgent = create.LLMAgent({
  model,
  tools: { scale },
  toolsContext: { scale: { factor: 3 } },
  stopWhen: isStepCount(3),
});
```

Function tools receive execution metadata in their second callback argument, including `context`, `toolCallId`, `messages`, and an optional `abortSignal`. Template, script, and function-prompt tools receive it as `_toolCallOptions` in rendering context.

These settings serve different purposes:

| Setting | Purpose |
| :--- | :--- |
| `inputSchema` | Describe and validate caller or model-provided arguments |
| `context` | Supply Casai rendering variables and helpers |
| `contextSchema` | Describe a tool's SDK execution context |
| `toolsContext` | Supply execution context by tool name |
| `runtimeContext` | Carry SDK generation context, independently of rendering input |

The SDK validates model-issued tool input and tool execution context before execution. Direct `.execute()` calls expect already valid values. A `Function.asTool` is its own `.execute()`, so direct calls also skip that validation. Direct Template, Script, and LLMAgent tool calls validate Casai input as usual.

Tool definitions and their context merge by tool name through configuration and per-call arguments. A replacement implementation must retain compatible input, output, and context types. Create another component when adding tools or changing their contracts.

### Tool Approvals and Continuation

An LLMAgent can return control when a tool needs approval or an external result. A larger `stopWhen` limit does not resolve that pending input. With SDK 7, use `toolApproval` for an approval policy:

```typescript
const reviewCalculator = create.LLMAgent({
  model,
  tools: { multiply }, // The Function tool from the LLMAgent example.
  toolApproval: { multiply: 'user-approval' },
  stopWhen: isStepCount(5),
});

const pending = await reviewCalculator('Use multiply to calculate 37 times 29.');
const requests = pending.content.filter(
  part => part.type === 'tool-approval-request' && !part.isAutomatic,
);
```

The call returns these requests; it does not remain open waiting for a person. Collect the decision in your application, append the matching SDK `tool-approval-response` parts to the conversation, and make another call. For tools executed elsewhere, append their `tool-result` parts with the original call IDs before continuing. Preserve complete message parts, including approval metadata, rather than reconstructing history from text.

Start from `pending.response.messageHistory`. To resume any LLMAgent form, pass the updated conversation as the call-time prompt: `.generate({ prompt: history })`. A call-time `prompt` replaces the configured prompt without rendering it, so the continuation adds no new user turn. A plain LLMAgent with no configured prompt can also resume with `agent(history)`. The [SDK approval guide](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-execution-approval) covers response formats and UI helpers.

## Template and Script Properties

Templates, scripts, and their AI input modifiers share Cascada rendering settings. Use these properties to provide data, helpers, source loading, and rendering options.

### Source Properties

Standalone Template uses `template`; standalone Script uses `script`. LLMAgent uses `prompt`, with the modifier determining whether it contains literal input, a template, a script, a function, or a resource name. A one-off replacement of that source is passed as `source` to `.generate()` or `.stream()`, or positionally in the ordinary call. Other AI operations prepare the input described in the [preparation table](#input-preparation-by-component).

Configured inline templates and scripts are compiled for reuse, with syntax errors reported when called. Loaded sources resolve on first use. One-off inline sources are compiled for that call; a one-off resource name can bypass a missing configured resource.

### Context

Context supplies values, synchronous or asynchronous functions, promises, and other components. Cascada resolves asynchronous values when their results are needed.

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

Call-time context merges over configured context after input validation. Required `inputSchema` fields must be present in the call itself; configured context supplies defaults and helpers, not missing required arguments.

### Filters

Filters transform values using the template pipeline operator. They may be synchronous or asynchronous:

```typescript
const label = create.Template({
  template: '{{ title | shout }}',
  filters: { shout: (value: string) => value.toUpperCase() },
});

console.log(await label({ title: 'Weekly report' }));
```

### Loader

A loader resolves named sources for `.loadsText`, `.loadsTemplate`, and `.loadsScript`, as well as template/script imports and includes.

```typescript
import { FileSystemLoader } from 'casai';

const loadedWriter = create.LLMAgent.loadsTemplate({
  model,
  loader: new FileSystemLoader('./prompts'),
  prompt: 'summary.njk',
});

const summary = await loadedWriter({ text: 'A document to summarize.' });
```

Put a template such as `Summarize this document: {{ text }}` in `./prompts/summary.njk`. To select another resource for one call, pass its name as a positional source override or as `source` in `.generate()` / `.stream()`. A named `prompt` override is literal text and does not load a resource.

| Loader | Use |
| :--- | :--- |
| `FileSystemLoader` | Read local files in Node.js; relative imports resolve from the containing file |
| `WebLoader` | Load sources from a base URL in a browser |
| `PrecompiledLoader` | Load sources precompiled with Cascada |
| Function or custom loader object | Retrieve sources from your own storage |

A loader function returns source text, a `{ src, path, noCache }` object, or `null` when it cannot find the resource. It may return a promise. Plain `.loadsText` requires text source, rather than a precompiled template or script.

```typescript
const sources: Record<string, string> = {
  'welcome.njk': 'Welcome {{ name }}!',
};
const loader = async (name: string) => sources[name] ?? null;

const welcome = create.Template.loadsTemplate({
  loader,
  template: 'welcome.njk',
});
console.log(await welcome({ name: 'Ada' }));
```

Loader arrays provide sequential fallback. Inheritance tries child loaders before parent loaders. Use `race([loaderA, loaderB], 'groupName')`, imported from `casai`, to load concurrently and use the first successful result. Matching named groups merge across inheritance, and duplicate loader instances are removed.

For custom object/class loaders, implement `load(name)` with the same return contract. Optional `isRelative(name)` and `resolve(from, to)` methods support relative imports; an optional `on(event, handler)` interface supports load/update events and cache invalidation. Return `null` for a missing resource to permit fallback, and throw for an actual loading failure.

### Render Options

`renderOptions` configures Cascada rendering, for example `trimBlocks` or standalone template HTML escaping:

```typescript
const page = create.Template({
  template: '<h1>{{ title }}</h1>',
  renderOptions: { autoescape: true, trimBlocks: true },
});

console.log(await page({ title: 'Research & development' }));
```

Standalone templates default `autoescape` to `false`; language-model prompt renderers disable HTML escaping. Renderer options, filters, and loaders are creation-time settings. Source caches respect loader updates and `noCache`.

## AI SDK Properties

AI components use their operation's SDK settings and retain its result fields. Follow the reference links in the [component overview](#component-overview) for full input and return contracts. Support for individual settings depends on the model and provider.

LLMAgent, Template, Script, and Function share the Agent settings `output`, `callOptionsSchema`, `options`, `tools`, `runtimeContext`, `id`, and SDK lifecycle/cancellation settings. Coded components additionally use `prepareInput` for conversation mapping. See [the common contract](#agent-settings-streaming-and-tools); model generation settings below belong to LLMAgent.

For LLMAgent, common settings include:

| Property | Purpose |
| :--- | :--- |
| `model` | Select the language model |
| `instructions` | Supply system instructions for every call, including calls whose `prompt` replaces the configured prompt |
| `output` | Select text or structured output; defaults to text |
| `maxOutputTokens` | Limit output length |
| `temperature`, `topP` | Control sampling where supported |
| `presencePenalty`, `frequencyPenalty`, `stopSequences` | Adjust supported generation behavior |
| `tools`, `toolChoice`, `toolsContext` | Configure tool use and execution context |
| `toolApproval` | Configure approval decisions for SDK-executed tools |
| `stopWhen` | Control continuation; defaults to one model step |
| `providerOptions` | Pass provider-specific settings |
| `maxRetries`, `abortSignal` | Control retries and cancellation |
| `callOptionsSchema`, `options` | Validate and supply custom call options |
| `prepareCall`, `prepareStep` | Customize a request or individual model steps |
| `onStart`, `onStepEnd`, `onEnd` | Observe execution and completion |
| `onChunk`, `onError`, `onAbort` | Observe streaming output, errors, and cancellation |

Casai does not impose sampling defaults. An omitted setting uses SDK/provider behavior. For cancellation, pass an abort signal for one call:

```typescript
const result = await explain.generate({
  context: { topic: 'solar panels' },
  abortSignal: AbortSignal.timeout(10_000),
});
```

### Lifecycle Callbacks

Callbacks are useful for recording usage, inspecting tool activity, and updating application state:

```typescript
const observed = create.LLMAgent({
  model,
  onStepEnd: ({ stepNumber, finishReason }) => {
    console.log('Step completed', stepNumber, finishReason);
  },
  onEnd: ({ usage }) => {
    console.log('Total usage', usage);
  },
});
```

Streaming completion callbacks require the stream to progress to completion. `onChunk`, `onError`, and `onAbort` apply to streaming execution. Callbacks passed to `.generate()` or `.stream()` run in addition to the configured callbacks, in the SDK's order, so a configured callback used for usage accounting is never dropped by a caller. See [SDK lifecycle callbacks](https://ai-sdk.dev/docs/ai-sdk-core/generating-text#lifecycle-callbacks-experimental).

Template, Script, and Function's Agent methods follow the same callback composition rules. A coded execution reports its local step and completion; tool callbacks describe actual compatible tool executions, and model usage is recorded only when available from a forwarded SDK result.

### Custom Call Options and Hooks

`callOptionsSchema` describes application-specific Agent options on LLMAgent, Template, Script, and Function, supplied as `options`. AI SDK helpers such as `createAgentUIStreamResponse` forward their own `options` argument the same way. Cascada's rendering settings use `renderOptions`.

```typescript
const accountAgent = create.LLMAgent({
  model,
  callOptionsSchema: z.object({ accountId: z.string() }),
});

await accountAgent.generate({
  prompt: 'Summarize the request.',
  options: { accountId: 'example-account' },
});
```

On LLMAgent, use `prepareCall` to consume these validated options and customize supported request settings. It runs once per invocation, after input preparation. `prepareStep` runs for individual model steps. Templates and scripts used to prepare the prompt run once, rather than rerendering for each tool-loop step. On coded components, `prepareInput` receives parsed options before it maps a conversation into input; there is no implicit model-step hook or tool loop.

When the custom schema requires options, configure default `options` for ordinary calls, or supply them with `.generate()` or `.stream()`. Configured `options` apply whenever a call does not supply its own. `callOptionsSchema` is fixed at creation, and a call's `options` replaces the configured value as a whole.

## Using Components in Templates and Scripts

Place components in context to call them from Cascada. Use scripts to assemble data and templates to format it.

### Script for Data Orchestration

This workflow creates a summary and extracts tags independently:

```typescript
const summarizeText = create.LLMAgent.withTemplate({
  model,
  inputSchema: z.object({ text: z.string() }),
  prompt: 'Summarize in one paragraph: {{ text }}',
});

const extractTags = create.LLMAgent.withTemplate({
  model,
  inputSchema: z.object({ text: z.string() }),
  prompt: 'Extract short topic tags from: {{ text }}',
  output: Output.array({ element: z.string() }),
});

const analyze = create.Script({
  inputSchema: z.object({ text: z.string() }),
  schema: z.object({ summary: z.string(), tags: z.array(z.string()) }),
  context: { summarizeText, extractTags },
  script: `
    var summary = summarizeText({ text: text }).output
    var tags = extractTags({ text: text }).output
    return { summary: summary, tags: tags }
  `,
});

const analysis = await analyze({ text: 'A document about battery recycling.' });
```

Both operations can run concurrently because neither depends on the other's result. The returned object waits for both. Use ordinary `var` values and direct returns when assembling structured data.

### Template for Presentation

```typescript
const report = create.Template({
  template: `
Summary: {{ summary }}
Tags:
{% for tag in tags %}
- {{ tag }}
{% endfor %}
  `,
});

console.log(await report(analysis));
```

A template can also invoke an asynchronous component directly, for example `{{ summarizeText({ text: text }) }}` when `summarizeText` is supplied in its context; an LLMAgent result in an output position renders as its text. Use JavaScript helpers in context for application-specific behavior; Cascada resolves their promises like component calls.

### Streaming Through Templates and Scripts

When a Template or Script streams, through `.stream()` or `.asStream`, the components it calls from its context stream too where they support the text/array-element streaming contract. Cascada forwards output selected by the template's output expressions or the script's output mechanism in logical output order. When the parent does not stream, called components use their ordinary call. The same components therefore work in both modes:

```typescript
const page = await newsletter({ topic: 'battery recycling' });  // complete text
const live = await newsletter.stream({ context: { topic: 'battery recycling' } });  // streamed text
```

Output a result directly, as in `{{ writeIntro({ topic: topic }) }}`, to let it stream. Reading a final value such as `.output` waits for the complete value, as it does outside a template.

Independent components may produce chunks out of order internally. Cascada buffers later output behind unfinished earlier positions and emits the next available prefix in order. For `{{ slowA() }}{{ fastB() }}`, chunks from `slowA` can be displayed immediately, but `fastB` waits until the preceding output finishes. A gap pauses delivery past that position; independent work can continue. Calling a component for an intermediate value does not by itself publish its output.

Use [unordered output streams](#ordered-and-unordered-streams) when you want to receive ready chunks before earlier positions are filled. Ordinary text streams remain ordered.

Nested components retain these behaviors:

- A called component created with `.asStream` returns a stream even when its caller does not stream; the caller waits for the final value when it uses it.
- A streaming caller cannot make a regular Function callback produce incremental chunks. Its complete value is emitted when ready; use a streaming callback and `.asStream` for incremental native output.

### Ordered and Unordered Streams

Results expose unordered output streams alongside their existing ordered streams. Both forms support `ReadableStream` and async iteration:

| Ordered property | Unordered property | Values |
| :--- | :--- | :--- |
| `textStream` | `unorderedTextStream` | Text chunks |
| `elementStream` | `unorderedElementStream` | Complete elements, where element streaming is supported |

In JavaScript, an ordered stream yields raw values in logical order. An unordered stream yields records as chunks become available, each containing both positions:

```typescript
type UnorderedChunk<T> = {
  chunk: T;
  indexpath: number[];              // Hierarchical position, available immediately.
  index: number | Promise<number>; // Zero-based flat position, possibly deferred.
};

const live = await newsletter.stream({ context: { topic: 'battery recycling' } });
for await (const { chunk, indexpath, index } of live.unorderedTextStream) {
  previewAtPath(indexpath, chunk);
  const flatIndex = await index; // Valid for both numbers and promises.
  recordPosition(flatIndex, chunk);
}
```

`previewAtPath` and `recordPosition` represent application callbacks. Use `live.textStream` and append its strings when you need ordered text. Each obtained stream handle has one consumer; choosing an output property does not start a second execution or replay consumed chunks. Independent consumers require explicit supported branching.

Flat indices can remain unresolved while earlier nested regions are still producing chunks. Awaiting an index inside the JavaScript loop pauses consumption of later chunks. Use the immediate path when a preview should proceed without waiting. Compare paths lexicographically by numeric elements, with shorter prefixes first; they describe stream positions, not JSON field paths.

Text indices count chunks, and element indices count completed elements. Final `.text` / `.output` promises retain their existing meaning. Plain SDK and untagged JavaScript sources wrapped by Casai expose unordered properties with sequential positions; only position-aware sources can deliver chunks ahead of earlier logical positions. The SDK's ordered partial-output property remains available on LLMAgent; Casai adds no unordered partial-object extension.

#### Consuming Either Form in Script and Template Loops

In Cascada scripts and templates, consume unordered streams exactly like ordinary streams. Bind `source` in context to either `live.textStream` or `live.unorderedTextStream`; the loop body stays the same. Cascada receives the position metadata internally, while the loop variable receives the chunk itself.

Script:

```cascada
text output
for chunk in source
  output(chunk)
endfor
return output.snapshot()
```

Template:

```nunjucks
{% for chunk in source %}{{ chunk }}{% endfor %}
```

These are alternative consumers, each needing its own source handle. If an unordered source delivers `world` at position 1 before `Hello ` at position 0, both loops assemble `Hello world`. There is no special loop syntax, `.chunk` access, manual sorting, or index awaiting. Array elements are likewise exposed as their original values. Ordinary loop concurrency still applies; output ordering does not sequence unrelated external side effects.

This behavior uses the recognized position-aware stream protocol. Ordinary iterables yielding application objects with fields such as `chunk` or `index` continue to yield those objects unchanged. JavaScript consumers of an unordered property see the full records shown above.

JavaScript producers can also supply logical positions through Cascada's planned `at(chunk, index)` integration. SDK event/UI streams and native transcription streams keep their own contracts. Promised indices are for in-process use; sending positioned chunks to a UI requires an explicit transport, typically using immediate paths.

These properties and loop behavior are agreed for [Phase 5](docs/agents-design.md#ordered-and-unordered-output-properties) and await implementation. Upstream protocol integration, explicit branching, cancellation, buffering, and complete-element validation remain documented in the design.

### Concurrency, Ordering, and Recovery

Cascada is a separate language with JavaScript-like expressions and its own control-flow syntax. It does not use JavaScript `await` or `try/catch` inside a script. Independent statements and `for` iterations run concurrently, so source order alone does not sequence external side effects.

Use `for item in items of 3` to limit a script loop to three concurrent iterations. Use `each item in items ... endeach` for sequential iterations, or Cascada's `sequence` / `!` facilities for ordered access to stateful services. This concurrency control is separate from an LLMAgent's step limit and Embedding's batch settings.

Script failures propagate through dependent values while unrelated work can continue. Bind a result and use `is error` when you want a fallback:

```typescript
const resilientSummary = create.Script({
  context: { summarizeText },
  inputSchema: z.object({ text: z.string() }),
  script: `
    var summary = summarizeText({ text: text }).output
    if summary is error
      summary = 'Summary unavailable.'
    endif
    return summary
  `,
});
```

A bare side-effect call discards its result, including a failure; bind and inspect it when the workflow must detect failure. Use direct return values for ordinary data, and channels when ordered concurrent collection is needed. See the [Cascada script reference](https://geleto.github.io/cascada-script/#/) for recovery and sequencing rules.

## Conversational AI: Managing Message History

LLMAgents accept model-message arrays and explicit conversation history. Components do not retain a conversation between calls, so the same component can serve separate users.

Configured `messages` are static context, such as examples. Dynamic history belongs to an invocation and uses the named field `history`. Casai combines static messages, supplied history, and the current prompt in that order. A call-time `messages` field instead supplies a complete literal conversation, as in the SDK.

```typescript
import type { ModelMessage } from 'ai';

const chat = create.LLMAgent({
  model,
  instructions: 'Answer clearly and concisely.',
});

let history: ModelMessage[] = [];

const first = await chat('My project is called Orchard.', history);
history = first.response.messageHistory;

const second = await chat('What is my project called?', history);
history = second.response.messageHistory;
console.log(second.output);
```

For explicit input and overrides, use `.generate({ prompt, history, ...settings })` or `.stream(...)`. Template/script forms can combine rendering context with history through `.generate({ context, history })`.

| Result field | Contents |
| :--- | :--- |
| `response.messages` | Prepared or literal input prompt messages plus generated messages for this invocation |
| `response.messageHistory` | Supplied `history` plus the input prompt and generated messages; excludes static configured messages |
| SDK `responseMessages` | Generated messages only |
| SDK per-step response messages | The SDK's original step-level messages |

Use `response.messageHistory` for the next turn to avoid duplicating static context. Streaming calls provide the same Casai history fields through `await result.response` after generation. Every call form returns these fields, including calls made by AI SDK helpers.

When a complete conversation is supplied through `messages` or SDK `prompt: messageArray`, that input block contains earlier turns too; Casai does not infer which messages are new. In this case, `response.messages` includes that supplied block, so use SDK `responseMessages` when appending generated messages only to an existing conversation.

Configured `prompt: messageArray` is replaceable prompt content; configured `messages` are persistent examples prepended on every Casai call. Keep these roles distinct when building few-shot prompts. Messages returned by a script/function prompt are appended after static messages and dynamic history.

Casai does not persist, summarize, or truncate history automatically. Store it per conversation and manage its size in your application. Preserve tool calls with their corresponding results and approval messages when selecting history for another turn.

### Render Only the New Message

Pass a new message as data in rendering context, alongside previously prepared history. Casai renders the configured template for this call and keeps the rendered prompt in the returned history:

```typescript
const templatedChat = create.LLMAgent.withTemplate({
  model,
  prompt: 'Help with this request:\n{{ message }}',
  inputSchema: z.object({ message: z.string() }),
});

let renderedHistory: ModelMessage[] = [];
for (const message of ['My project is called Orchard.', 'What is my project called?']) {
  const result = await templatedChat.generate({
    context: { message },
    history: renderedHistory,
  });
  renderedHistory = result.response.messageHistory;
  console.log(result.output);
}
```

`message` is an application-chosen template variable, not a reserved argument. Its contents are data, so text containing `{{ ... }}` is not evaluated again as template source. Only the current context is validated and prepared; earlier rendered messages pass through unchanged. Use `.stream({ context, history })` for the same preparation with incremental generation, then obtain history from `await result.response`.

For a UI conversation, identify the new user turn in the application and supply its data separately from saved, prepared history. The SDK's complete conversation does not tell Casai which messages have already been rendered. Regeneration and tool/approval continuations can reuse an earlier user message, so selecting the last user message and rendering it again is not a reliable rule. Reuse prepared messages for those requests; applications may store original UI text separately for display.

## Images and Files in LLMAgent Messages

For image understanding, pass an image content part to a capable language model:

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

## AI SDK Agent Interface and UI Integration

LLMAgent, Template, Script, and Function directly implement the [AI SDK Agent interface](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent). Their `.generate()` and `.stream()` methods accept the SDK's call arguments and return its complete result and stream contracts, including the event stream consumed by UI helpers. Casai's [additional named arguments](#named-arguments-and-per-call-overrides) provide rendering context, source overrides, and supported per-call settings through those same methods. Their ordinary calls and `.asStream` defaults are described in [streaming](#streaming).

### Agent Properties

The SDK interface also requires these properties on each component:

| Property | Meaning for the user |
| :--- | :--- |
| `version` | Identifies the SDK Agent contract, currently `'agent-v1'`; Casai supplies this compatibility marker |
| `id` | An optional identifier you assign to the component; `undefined` when omitted |
| `tools` | The configured named SDK tool definitions, including schemas and any execution handlers; defaults to `{}` |

Use `.tools` to inspect the registered definitions or retain the tool contract needed by SDK/UI callers. To call their reusable implementations from a Template, Script, or Function, supply [callable helpers in context](#calling-tools-from-coded-components).

### Generation, Streaming, and the Chat UI

```typescript
const writer = create.LLMAgent({ model });
const streamer = create.LLMAgent.asStream({ model });

const incremental = await writer.stream({ prompt: 'Explain recycling.' });
for await (const text of incremental.textStream) {
  process.stdout.write(text);
}

const complete = await streamer.generate({ prompt: 'Explain recycling.' });
console.log(complete.output);
```

On LLMAgent, `.stream()` uses incremental model streaming whichever operation the ordinary call performs, and `.generate()` generates directly rather than consuming a stream. Both return promises; awaiting `.stream()` yields the live handle. Each call starts one execution with the configured stopping condition. Template, Script, and Function use the [execution rules](#agent-settings-streaming-and-tools) of their own producers.

### What the Chat UI Uses

The chat client sends `UIMessage[]` to a server handler. The SDK helper validates those messages, converts them to `ModelMessage[]`, and calls the component's `.stream({ prompt: convertedMessages, ... })`. It converts the returned SDK event stream into assistant message parts for the client. This uses `.stream()` regardless of the component's ordinary-call default; a raw `textStream` alone is not the SDK UI protocol. See the [SDK UI response helper](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-agent-ui-stream-response).

**Any LLMAgent can serve this handler, including one with `stopWhen: isStepCount(1)`.** The stopping condition limits model steps within each server request, not the number of chat turns. Each subsequent request supplies its conversation and starts another invocation. A single step can execute tools and expose their results in UI tool parts, but cannot make a second model call to write an answer based on those results. A larger limit allows that follow-up within the same request; it is not required for chat integration.

The shared Agent contract lets all four implementations deliver a response through the same handler. Each uses the conversation differently:

| Component | How it uses chat input | Response available to the UI |
| :--- | :--- | :--- |
| LLMAgent | Sends the literal conversation to its model, together with configured instructions and static messages | Model-generated assistant text, plus tool or other message parts actually emitted by the SDK stream |
| Template | Maps the conversation into template variables, then renders its configured template and helper expressions | Rendered text as an assistant message; available portions can stream while asynchronous expressions resolve |
| Script | Maps the conversation into workflow input, then executes the configured script, including any explicit helper or model calls | The workflow's selected text or JSON output as an assistant message; internal operations appear only when their output is exposed |
| Function | Maps the conversation into callback input, then executes JavaScript with that input and configured context helpers | The callback's text or JSON output as an assistant message; a complete value arrives when ready, while a streaming callback can supply chunks |

For a coded component, the default conversation input is `{ messages }`. Configure `prepareInput` when its program expects other fields, such as `message` or `orderId`; `inputSchema` validates the mapped input. The incoming conversation remains data for the configured program. The [conversation mapping examples](#map-conversations-to-component-input) show all three implementations using the same latest-user-message input.

A static Template can simply return the same response on every chat request:

```typescript
const cannedReply = create.Template({
  template: 'Thanks for your message. We will reply shortly.',
});
```

Pass `cannedReply` as `agent` in the handler below and its rendered text becomes the assistant's reply. Use mapped variables and helpers for a personalized template, a Script for a workflow, or a Function for JavaScript response logic. These programs determine how to answer and which history to use; Agent support supplies the common request and response contract.

Text outputs become assistant text parts. Structured Agent output is carried as JSON text; the application's renderer decides how to present it. The parsed `.output` value is available to SDK callers and does not by itself define a chat widget. Tool, reasoning, source, and file displays likewise depend on emitted message parts and the client's renderers. Calling a context helper from coded logic does not automatically create a UI tool part. Preserve compatible `tools` declarations when existing conversation history includes tool parts; see [calling tools from coded components](#calling-tools-from-coded-components).

SDK UI helpers accept any of the four components directly when their conversation input and output contracts are configured for that application. This server handler accepts the SDK UI message format and returns a streaming response:

```typescript
import { createAgentUIStreamResponse } from 'ai';

const chatAgent = create.LLMAgent({
  model,
  instructions: 'Answer clearly and concisely.',
});

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  if (!body || !Array.isArray(body.messages)) {
    return new Response('Expected a messages array.', { status: 400 });
  }

  return createAgentUIStreamResponse({
    agent: chatAgent,
    uiMessages: body.messages,
    abortSignal: request.signal,
  });
}
```

Wire the returned `Response` into your server framework and use an AI SDK UI client to consume it.

SDK helpers call `.stream()` with SDK arguments and consume the returned SDK event stream. `createAgentUIStreamResponse` passes the converted conversation as `prompt`, along with `options`, `abortSignal`, and callbacks that may be `undefined`. For LLMAgent, the [per-call rules](#named-arguments-and-per-call-overrides) apply:

- The conversation in `prompt` replaces the configured prompt and is never rendered, so no `context` is required and user text is never treated as template code. The SDK's alternative `messages` form has the same literal behavior. Configured `messages` and `instructions` still apply.
- `options` is validated by `callOptionsSchema` and passed to `prepareCall`.
- `undefined` fields leave configured settings in place, and the helper's callbacks run in addition to configured ones.

Because a supplied `prompt` replaces the configured one, a template or script prompt does not run for UI chat requests. Put instructions shared with UI calls in `instructions`. For example, `researcher.generate({ prompt: 'Summarize recycling.' })` uses the researcher's output schema without requiring `topic` or rendering its template, while `researcher.generate({ context: { topic: 'recycling' } })` renders it.

Use `history` with rendering context to [render only a new message](#render-only-the-new-message). Direct SDK helper calls supply an already-prepared conversation and do not automatically identify or render new turns; an application that wants that preparation must explicitly separate the new input from its stored history before generation.

For Template, Script, or Function, the same helper conversation is mapped into component input and validated before the configured program executes, as described below. See the [SDK Agent interface](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent). Specialized AI components have their own operation methods or session interface and do not implement it. ImageGenerator and SpeechGenerator's `.generate()` and StreamingTranscriber's `.stream()` take their own operation inputs.

## Replacing an LLMAgent with Template, Script, or Function

Replace a model-backed LLMAgent with a Template, Script, or Function by supplying the coded component directly to the same caller or SDK UI handler. All four have `.generate()` and `.stream()` and the same SDK result contracts. Configure the coded component's input mapping and public output to match the interface the application already uses. Choose its response logic and emitted message parts to suit the application; the [UI capability comparison](#what-the-chat-ui-uses) explains what each implementation supplies.

**Implementation status:** direct Agent support for Template, Script, and Function, including loaded and `.asStream` forms, is planned for Phase 4. This guide describes the intended API; these methods are not available on the current coded components.

### The Shared Replacement Contract

| Boundary | Contract |
| :--- | :--- |
| SDK request | Exactly one of `prompt` or `messages`, with the SDK's string/conversation meaning |
| Application request | `.generate({ context: ... })` or `.stream({ context: ... })` uses typed input directly; an optional `source` overrides the program for that call |
| Component input | Configured `prepareInput` maps a conversation into call-time input, defaulting to `{ messages }`; `inputSchema` validates explicit or mapped input before configured context merges |
| Complete result | `.generate()` returns an SDK-compatible result with the typed `.output`, `.text`, response messages, and execution metadata |
| Streaming result | `.stream()` returns a live SDK-compatible result with text or complete-array-element streams, final-value promises, and the event stream used by UI helpers |
| Public output | The same SDK `Output` specification as the replaced LLMAgent; text is the default |
| Custom options | `callOptionsSchema` validates and parses `options` before `prepareInput`; configured defaults and per-call replacement follow LLMAgent's rules |
| Tools and lifecycle | Compatible `tools`, SDK callbacks, cancellation, timeouts, and streaming transforms; no hidden conversation state |

The replacement is at the **Agent boundary**: `.generate()`, `.stream()`, and SDK UI helpers. Keep the same input shape, custom-options type, public output type, and any tool declarations needed by the caller or conversation history. Model settings such as `temperature` and `stopWhen` belong to LLMAgent and are not part of the shared replacement contract.

Ordinary calls retain their own arguments and return values: a Template returns text, a Script its value, and a Function its callback result. Replacing `await llm(context)` with `await template(context)` also requires accounting for that difference; the common methods always return SDK results.

### Map Conversations to Component Input

Configure `prepareInput` on the Template, Script, or Function when its input expects application fields rather than a conversation. It receives normalized `messages: ModelMessage[]`, parsed custom `options` when configured, and the invocation's `abortSignal`. A string `prompt` becomes one user message; message arrays retain their roles and content parts. The mapper may be synchronous or asynchronous and returns the component's call-time input.

Without a mapper, a conversation call supplies `{ messages }` as input. This works for a program whose input contract accepts that field. If its `inputSchema` requires fields such as `message` or `orderId`, supply a mapper that produces them; validation rejects missing fields before execution. Ordinary calls and named calls with explicit `context` use that input directly and do not invoke `prepareInput`.

The application chooses how to interpret the conversation. This example explicitly uses the latest user's text and returns the same acknowledgement through all three coded components:

```typescript
import type { ModelMessage } from 'ai';

const messageInput = z.object({ message: z.string().min(1) });

function lastUserText(messages: ModelMessage[]): string {
  const content = messages.findLast(message => message.role === 'user')?.content;
  return typeof content === 'string'
    ? content
    : (content ?? []).filter(part => part.type === 'text').map(part => part.text).join('\n');
}

const prepareInput = ({ messages }: { messages: ModelMessage[] }) => ({
  message: lastUserText(messages),
});

const replyTemplate = create.Template({
  inputSchema: messageInput,
  prepareInput,
  template: 'Received: {{ message }}',
});

const replyScript = create.Script({
  inputSchema: messageInput,
  prepareInput,
  script: 'return "Received: " ~ message',
});

const replyFunction = create.Function({
  inputSchema: messageInput,
  prepareInput,
  execute: ({ message }) => `Received: ${message}`,
});

const reply = await replyFunction.generate({ prompt: 'Hello' });
console.log(reply.output); // Received: Hello

// Explicit application input uses the same Agent result contract.
const directReply = await replyFunction.generate({ context: { message: 'Hello' } });
console.log(directReply.output); // Received: Hello
```

Set `chatAgent` in the preceding server handler to `replyTemplate`, `replyScript`, or `replyFunction`; the handler and SDK UI client stay the same. All three also accept the complete converted conversation supplied by the helper.

`prepareInput` can instead retain the full conversation, extract structured application input, or use validated custom options. It must supply all required `inputSchema` fields itself. As with native calls, input validation is validation-only; use the mapper for coercion or normalization. Configured context supplies defaults and helpers after validation.

SDK conversation content is input data. It never replaces the configured `template`, `script`, resource name, or `execute` callback. An LLMAgent's literal `prompt` override instead replaces the prompt sent to the model and skips rendering input validation. A coded component validates the mapped input because that is the input to its executed program.

### Output Schemas and Structured Replacements

Reuse the replaced LLMAgent's `Output` specification directly in the coded component's configuration:

```typescript
const answerSchema = z.object({ answer: z.string() });
const answerOutput = Output.object({ schema: answerSchema });

const aiAnswer = create.LLMAgent.withTemplate({
  model,
  inputSchema: messageInput,
  prompt: 'Acknowledge this message: {{ message }}',
  output: answerOutput,
});

const codedAnswer = create.Function({
  inputSchema: messageInput,
  prepareInput,
  output: answerOutput,
  execute: ({ message }) => ({ answer: `Received: ${message}` }),
});

const answerAgent = codedAnswer; // Swap for aiAnswer; the caller below stays the same.
const answer = await answerAgent.generate({ prompt: 'Hello' });
console.log(answer.output.answer);
```

`Output.text()` and `Output.choice(...)` require a string result. For `Output.object(...)`, `Output.array(...)`, or `Output.json()`, a Template renders JSON text, while a Script or Function returns a JSON-compatible value. Casai parses rendered JSON or serializes the returned value and applies the selected SDK output parser. Non-serializable values need an explicit conversion in the component.

`inputSchema` describes the component's input; `output` describes the public Agent result. For Template, Script, and Function, `output` applies to `.generate()` and `.stream()`; ordinary calls retain their native return-value contract. Script/Function `schema` remains a separate boundary that parses the native result before Agent output validation. Set the public schema on `output` when only Agent callers need that validation. If both boundaries use transforming schemas, make the second schema accept the first boundary's parsed value so transformations are not inadvertently applied twice.

For array output, `elementStream` exposes complete elements and `output` resolves to their collected array. A complete-only producer delivers its array elements after the array is ready. Standalone objects are delivered as complete values; coded components have no incremental object-update contract. An application consuming an SDK result can render items directly from `elementStream`. The chat UI instead receives SDK message parts carrying JSON text; separate item cards require an application renderer or an explicit transport for complete item data.

### Agent Settings, Streaming, and Tools

Supply Agent settings in the component's factory configuration, alongside its program and native validation settings:

| Setting | Purpose |
| :--- | :--- |
| `prepareInput` | Conversation-to-input mapper; omitted means input is `{ messages }` |
| `output` | SDK `Output` specification; defaults to `Output.text()` |
| `callOptionsSchema`, `options` | Typed custom options and optional defaults, independent of the component's `inputSchema` |
| `tools` | SDK tool definitions used by SDK consumers and UI history validation; defaults to `{}`; callable implementations can also be supplied in `context` |
| `runtimeContext` | Application metadata for SDK lifecycle callbacks, separate from rendering context |
| `id` | Optional identifier; the component always exposes `id`, with `undefined` when omitted |

Each SDK method starts one component execution. Template and Script streams preserve their selected output in logical order. A Function returning a complete value emits it when ready; a streaming Function forwards its chunks. `.generate()` collects a streaming callback once when necessary, and never executes it a second time to obtain the final value. `.asStream` changes the ordinary call; all forms retain both Agent methods. Coded components need no model setting or model call to implement this interface. Ordinary complete-value calls do not construct SDK results or serialize values for Agent output.

Abort signals and timeouts cover mapping, execution, and stream consumption. The mapper receives the effective signal, and asynchronous helpers must cooperate with cancellation for their work to stop. Errors propagate through the SDK result and UI error protocol; Casai does not retry a coded callback with side effects automatically.

Pure coded execution reports a local execution step with zero model-token usage and no invented reasoning or tool calls. A workflow that calls models itself still incurs their real usage; metadata from a forwarded compatible SDK result is retained. Casai does not infer hidden model usage from arbitrary helper return values.

The component's `tools` must match any tool parts the UI history or output uses. Declaring tools does not start a model-driven tool loop: the coded workflow chooses what to execute. Reuse their callable implementations through [context helpers](#calling-tools-from-coded-components), including in a Function callback. Only actual SDK-compatible tool events are exposed; an ordinary helper call does not create one automatically. Agent compatibility and exposing a component through `.asTool` are separate operations; the `.asStream` / `.asTool` combination remains invalid.

## Choosing Your Orchestration Strategy

Choose the mechanism that expresses who controls the next operation:

| Mechanism | Best suited to |
| :--- | :--- |
| JavaScript / Function | Application logic, service integration, and explicit control flow |
| Script | A workflow you define, with dependencies and structured results |
| Template | Text preparation and presentation, including calls to helpers |
| LLMAgent tools | Operations the model chooses while responding to a task |
| Decision | Routing or evaluation through a configured set of questions |
| VoiceSession | A persistent, interactive audio/text conversation |

These can be combined. A Script can call an LLMAgent that uses tools; an LLMAgent tool can run a Script or another LLMAgent; a Template can format the resulting data. Keep reusable application functions in context and expose them as tools when the model should decide whether to invoke them.

## Embedding and RAG Integration

Retrieval-augmented generation (RAG) supplies relevant documents to an LLMAgent before it answers. A typical flow is:

```text
question → embedding/search → candidate documents → reranking → LLMAgent answer
```

Use Embedding to index document text and embed search queries. Your vector store or search service stores and retrieves the documents. Reranker can improve the order of retrieved candidates before they enter the prompt.

The following example assumes your application provides `searchIndex(vector)`, which returns document strings from an index built with the same embedding model:

```typescript
const embedding = create.Embedding({ model: embeddingModel });
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
const query = await embedding(question);
const candidates = await searchIndex(query.embedding);
const ranked = await reranker.rerank({ query: question, documents: candidates, topN: 5 });
const answer = await answerFromDocuments({
  question,
  documents: JSON.stringify(ranked.rerankedDocuments),
});

console.log(answer.output);
```

You can compose the same steps inside a Script or expose bounded retrieval through a Function tool. Casai prepares and orchestrates these operations; the search service owns document storage and retrieval.

## Input and Output Validation

Use schemas at the boundary where data enters or leaves a component:

| Setting | Validates |
| :--- | :--- |
| `inputSchema` | Explicit or mapped call-time context, or model-issued tool arguments |
| Script / Function `schema` | The returned workflow or callback value |
| Agent `output` | The public value through an SDK output specification on LLMAgent, Template, Script, or Function |
| Tool `contextSchema` | SDK tool execution context |
| Agent `callOptionsSchema` | Application-specific SDK call options on all four Agent-compatible components |

Casai context schemas describe object input. Use a Zod object schema for templates/scripts, or an AI SDK object schema with a validator. Script/Function output schemas may describe primitive, array, or object results. Zod is re-exported as `z` from `casai` as well as being available from `zod`.

Required input fields must be present in call-time context, supplied directly or by `prepareInput` for a conversation call. Validation happens before configured context merges, so place defaults and helpers outside required input-only fields:

```typescript
const welcome = create.LLMAgent.withTemplate({
  model,
  prompt: 'Welcome {{ name }} in {{ language }}.',
  inputSchema: z.object({ name: z.string() }),
  context: { language: 'English' },
});

await welcome({ name: 'Ada' });
```

For ordinary Casai calls, `inputSchema` is **validation-only**: the original input is passed on after validation. Schema coercions, transforms, defaults, and unknown-key stripping do not rewrite rendering context or Function arguments. Normalize data explicitly before calling the component, or in a preparer/callback. Use `.strict()` when unknown input keys should cause validation to fail.

Output `schema` on Script/Function returns the parsed value. SDK-managed tool arguments, tool execution context, Agent output on all four compatible components, and custom call options follow their respective SDK parsing contracts. Do not infer their parsing behavior from Casai's ordinary input validation. The [replacement guide](#replacing-an-llmagent-with-template-script-or-function) explains how native `schema` and public Agent `output` form separate validation boundaries.

Input validation and rendering failures reject before the model call. Output validation runs after the value is produced. Array elements are validated before publication; final array validation can still reject completion. Use the final `.output` for the completed result. Handle SDK/provider errors through the operation's normal promise or streaming error contract.

Prepared inputs are checked against the selected operation: model messages for LLMAgents, text or text arrays for Embedding, audio for transcription, and so on. Binary and live-stream inputs retain their native values.

## Errors, Cancellation, and Retries

Wrap creation and `await component(...)` in `try/catch` when handling failures. Some invalid configurations throw during creation; input preparation and generation can fail during invocation.

| Error source | How to inspect it |
| :--- | :--- |
| Invalid configuration or Casai schema validation | `ConfigError`, exported from `casai` |
| Template or script compilation/execution | `TemplateError` or `ScriptError`; inspect `cause` for the underlying failure |
| Provider requests or structured LLMAgent output | SDK error types and their documented instance checks |
| Streaming generation or tool execution | Full-stream `error` / `tool-error` parts, callbacks, and promise/iterator failures |

For streaming, handle event errors as well as thrown errors. This example uses the full event stream so tool failures are visible alongside text:

```typescript
const controller = new AbortController();

try {
  const stream = await create.LLMAgent({ model }).stream({
    prompt: 'Explain how batteries are recycled.',
    abortSignal: controller.signal,
  });

  for await (const part of stream.stream) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'error':
      case 'tool-error':
        console.error(part.error);
        break;
      case 'abort':
        console.log('Generation cancelled.');
        break;
    }
  }
} catch (error) {
  console.error('Request failed:', error);
}
```

Call `controller.abort()` from your application's cancellation handler, or pass a request's signal / `AbortSignal.timeout(...)` to `.generate()` or `.stream()`. Forward cancellation into asynchronous application helpers and tool I/O when they perform their own work. Stopping display of text alone is not a cancellation policy.

`maxRetries` controls SDK request retries; it does not restart your entire Casai script or input preparation. Streaming recovery has separate SDK settings such as `streamRetries`, and previously displayed partial text may be repeated by recovery. See [SDK error handling](https://ai-sdk.dev/docs/ai-sdk-core/error-handling) for retry behavior and error types. A stopped or failed stream does not guarantee a valid final `.output`.

## Type Checking

Casai infers input types from schemas, context, and function signatures. Output specifications determine the type of generated values; tool maps retain typed arguments and results. Use `import type` for SDK types such as `ModelMessage` and `ToolExecutionOptions`.

```typescript
const classify = create.LLMAgent.withTemplate({
  model,
  inputSchema: z.object({ text: z.string() }),
  prompt: 'Classify this message: {{ text }}',
  output: Output.choice({ options: ['question', 'feedback', 'other'] }),
});

const classification = await classify({ text: 'How can I reset my password?' });
// classification.output is 'question' | 'feedback' | 'other'.

// @ts-expect-error: text must be a string.
await classify({ text: 42 });
```

Inheritance checks the final configuration. A per-call override preserves the component's input and result contracts, so changing output schemas or tool types requires creating a component with that new contract. Custom call options (`options`) and rendering input (`context`) have separate inferred types.

## Testing Workflows

Test orchestration with deterministic helpers in context, without making model calls. A test double only needs to supply the values that the workflow consumes:

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

To exercise the LLMAgent's full model/tool protocol, supply an AI SDK mock model through `model`; see [SDK testing](https://ai-sdk.dev/docs/ai-sdk-core/testing). Test concurrent `.generate()` calls with distinct inputs when verifying invocation isolation, and consume streams in tests that assert final results or completion callbacks. Type-check TypeScript examples separately from executing them.
