# Casai: AI Orchestration That Writes Like a Story

> **API design draft:** This README documents the intended API, including components awaiting implementation. The [design document](docs/agents-design.md) tracks implementation stages, [settled contracts and remaining implementation work](docs/agents-design.md#design-status). [README.md](README.md) describes the implementation currently in the repository.

Casai is a TypeScript library for composing AI calls, tools, and application logic into reusable workflows. Configure a component's operation, input preparation, and validation rules, with a model when the operation needs one, then call it like a function. Components can share configuration, invoke each other, and work with the Vercel AI SDK.

**LLMAgent, Template, Script, and Function compose through callable components, context helpers, and schemas.** Keep the input and returned value of a workflow operation stable to switch between model-backed and coded implementations; see [interchanging components](#interchanging-components-in-workflows). LLMAgent also implements the AI SDK Agent interface for conversations, tools, and chat UI integration.

Use JavaScript for application logic, Cascada templates for text, and Cascada scripts for workflows that return data. Cascada resolves asynchronous values automatically and runs independent work concurrently, so a workflow can read in dependency order without manual promise coordination.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Understanding the Casai API](#understanding-the-casai-api)
  - [Creating and Calling Components](#creating-and-calling-components)
  - [Common Component Contracts](#common-component-contracts)
- [Configuration Management](#configuration-management)
- [The Casai Components](#the-casai-components)
- [Using Components as Tools](#using-components-as-tools)
- [Template and Script Properties](#template-and-script-properties)
- [AI SDK Properties](#ai-sdk-properties)
- [Using Components in Templates and Scripts](#using-components-in-templates-and-scripts)
- [Conversational AI: Managing Message History](#conversational-ai-managing-message-history)
- [Images and Files in LLMAgent Messages](#images-and-files-in-llmagent-messages)
- [AI SDK Agent Interface and UI Integration](#ai-sdk-agent-interface-and-ui-integration)
- [Interchanging Components in Workflows](#interchanging-components-in-workflows)
- [Cancellation, Timeouts, and Usage](#cancellation-timeouts-and-usage)
- [Choosing Your Orchestration Strategy](#choosing-your-orchestration-strategy)
- [Embedding and RAG Integration](#embedding-and-rag-integration)
- [Input and Output Validation](#input-and-output-validation)
- [Errors and Retries](#errors-and-retries)
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
console.log(result.value);
```

The `.withTemplate` modifier renders the prompt using the call's input and configured context. `inputSchema` validates the resolved application context after configured and call-time values merge; `.value` contains the generated text. The result also includes the SDK's usage, steps, and metadata.

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

const ideas = await extract({ text: result.value });
console.log(ideas.value.ideas);
```

You can call components from a Cascada script to describe the same workflow:

```typescript
const explainAndExtract = create.Script({
  context: { explain, extract },
  inputSchema: z.object({ topic: z.string() }),
  script: `
    var explanation = explain({ topic: topic }).value
    var ideas = extract({ text: explanation }).value.ideas
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

Choose a component by the operation you need. `Config` supplies shared settings and is not callable. Component names link to usage examples; reference links cover Cascada syntax and AI SDK contracts. The table describes ordinary calls. Components share configuration and composition conventions; their results reflect the operation they perform. Model results retain SDK usage, warnings, and metadata.

| Component | What it does | Main inputs → result | Reference |
| :--- | :--- | :--- | :--- |
| [Config](#config) | Shared configuration | Settings and optional parent → `.config` | — |
| [Template](#template) | Render a Cascada template | Template and context → string, or a text stream | [Cascada templates](https://github.com/geleto/cascada/blob/master/docs/cascada/template.md) |
| [Script](#script) | Execute a Cascada workflow | Script and context → returned value, or a stream | [Cascada scripts](https://geleto.github.io/cascada-script/#/) |
| [Function](#function) | Wrap JavaScript logic | Arguments/context → returned value, or the callback's stream | — |
| [LLMAgent](#llmagent) | Generate or stream text/data; optionally loop with tools | Prompt/messages or rendering context → `.value`, the final output or its native stream; plus the full [SDK result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text#returns) or [stream result](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#returns) | [generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text), [streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) |
| [Decision](#decision) | Answer choice, boolean, and score questions | `state`, configured `questions` → [.answers](https://ai-sdk.dev/docs/ai-sdk-core/decisions#question-types) | [Decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions) |
| [Embedder](#embedder) | Embed one or many texts | String or string array → [.embedding](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed#returns) or [.embeddings](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many#returns) | [Embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings) |
| [Reranker](#reranker) | Rank candidates for a query | `query`, `documents` → [.ranking, .rerankedDocuments](https://ai-sdk.dev/docs/reference/ai-sdk-core/rerank#returns) | [Reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking) |
| [ImageGenerator](#imagegenerator) | Generate or edit images | `prompt` and optional editing inputs → [.images](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-image#returns) | [Images](https://ai-sdk.dev/docs/ai-sdk-core/image-generation) |
| [Transcriber](#transcriber) | Transcribe a recording | `audio` → [.text, .segments](https://ai-sdk.dev/docs/reference/ai-sdk-core/transcribe#returns) | [Transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription) |
| [StreamingTranscriber](#streamingtranscriber) | Transcribe live audio | Audio stream and format → [.fullStream, final .text](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-transcribe#returns) | [Streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription) |
| [SpeechGenerator](#speechgenerator) | Generate spoken audio | `text` → [.audio](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-speech#returns) | [Speech](https://ai-sdk.dev/docs/ai-sdk-core/speech) |
| [VoiceSessionSetup](#voicesessionsetup) | Prepare a browser voice session and execute server tools | Instructions/context → session setup; separate `executeTool()` calls | [Realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime) |

Decision, StreamingTranscriber, and VoiceSessionSetup wrap SDK features that are still experimental, so Casai exports them as `Experimental_Decision`, `Experimental_StreamingTranscriber`, and `Experimental_VoiceSessionSetup` until those features are stable.

### Creating and Calling Components

Pass reusable settings to a factory, then supply task-specific input to the component it returns:

```typescript
const writer = create.LLMAgent({ model, prompt: 'Write a short welcome message.' });

const welcome = await writer();
console.log(welcome.value);
const invitation = await writer('Write a short invitation to a community dinner.');
```

Each component has a **main property**, the input its operation works on, such as an LLMAgent's `prompt` or a Template's `template`. You set it when creating the component, and a call can replace it for one invocation. The component's [input modifier](#adding-capabilities-with-modifiers) sets its type, never its name: on a plain LLMAgent, `prompt` is literal text or model messages; with `.withTemplate`, it is a template; with `.loadsTemplate`, a template's name. A replacement has the same type as the configured value.

The ordinary call, `component(...)`, takes inputs rather than execution settings. A plain component takes its main input first, including object or array inputs. A plain LLMAgent takes `(prompt, messageHistory?)`: the prompt can be a string or a message array. Rendered forms take their source, context, and any secondary input in that order, omitting source to use the configured one. Every callable component has `.run({ ... })` for named inputs and execution settings such as `abortSignal` and `timeout`.

| Component | Main property | Secondary input |
| :--- | :--- | :--- |
| LLMAgent | `prompt` | `messageHistory` |
| Template | `template` | None |
| Script | `script` | None |
| Function | `execute`, fixed at creation | None |
| Decision | `state` | None |
| Embedder | `value`, or `values` for a batch | None |
| Reranker | `query` | `documents` |
| ImageGenerator | `prompt` | None |
| Transcriber, StreamingTranscriber | `audio` | None |
| SpeechGenerator | `text` | None |
| VoiceSessionSetup | `instructions` | None |

A Function's callback can't be replaced per call, so a Function is called with its context alone. VoiceSessionSetup's main property is its session `instructions`; an LLMAgent's `instructions` setting is separate and never rendered.

Ordinary calls return promises. In complete mode, LLMAgent returns an SDK result whose `.value` holds the output, and Template returns a string. Script and Function return what their program returns, checked without modification by their `schema` when configured; that is a stream when the schema [declares one](#stream-schemas).

A Template, for example, accepts a one-off template before its context:

```typescript
const greeting = create.Template({
  template: 'Hello {{ name }}!',
  context: { name: 'World' },
});

console.log(await greeting());                        // Hello World!
console.log(await greeting({ name: 'Ada' }));         // Hello Ada!
console.log(await greeting('Welcome {{ name }}.', { name: 'Ada' }));
```

An object supplied as rendering context is data. For example, a field named `prompt` inside that object is a template variable; it does not override the component's prompt setting. There is no `input` wrapper around ordinary calls. Put user data in the context, never in a rendered component's main property, where it would run as template or script code.

To inherit shared settings, pass a [Config](#config) or a compatible component as the factory's second argument. See [configuration management](#configuration-management) for how settings are merged.

Factories are also named exports: `import { LLMAgent, Template, Script } from 'casai'` lets you write `LLMAgent(...)` instead of `create.LLMAgent(...)`.

### Adding Capabilities with Modifiers

Modifiers are properties of the factory, applied before creating the component: `create.LLMAgent.withTemplate(...)`. Input modifiers select how the main property is prepared; `.asStream` and `.asTool` select how the component exposes its result.

- [`.withText`](#text-and-template-modifiers): Use literal text directly, without rendering. LLMAgent also accepts model messages and uses this modifier by default.
- [`.withTemplate`](#text-and-template-modifiers): Render an inline Cascada template with context to prepare text input.
- [`.withScript`](#script-and-function-modifiers): Execute an inline Cascada script to prepare the component's input.
- [`.withFunction`](#script-and-function-modifiers): Call a JavaScript function with context to prepare the component's input.
- [`.loadsText`](#text-and-template-modifiers): Load literal text from a named resource through the configured loader.
- [`.loadsTemplate`](#text-and-template-modifiers): Load a named Cascada template through the configured loader, then render it with context.
- [`.loadsScript`](#script-and-function-modifiers): Load a named Cascada script through the configured loader, then execute it to prepare input.
- [`.asStream`](#streaming): Make an LLMAgent or Template stream: its calls return a live stream result.
- [`.asTool`](#using-components-as-tools): Expose the component as a tool a language model can invoke, while keeping it directly callable.

A modifier changes the type of the [main property](#creating-and-calling-components), not its name, so an LLMAgent's input is always `prompt`. With `.loads...`, that value is a resource name resolved by the configured [loader](#loader).

#### Text and Template Modifiers

Use a template when the input is text with variables, helper calls, or includes. Configured `context` supplies defaults; `inputSchema` validates the final context after call-time overrides merge:

```typescript
const translate = create.LLMAgent.withTemplate({
  model,
  prompt: 'Translate to {{ language }}: {{ text }}',
  context: { language: 'Spanish' },
  inputSchema: z.object({ text: z.string() }),
});

console.log((await translate({ text: 'Good morning' })).value);
```

#### Script and Function Modifiers

Use a script for a preparation workflow, or a JavaScript function for logic such as formatting, fetching data, or calling an API. The function may be asynchronous. It receives the merged context and, as its second argument, execution options such as `abortSignal`, which it can pass to its own requests:

```typescript
const summarize = create.LLMAgent.withFunction({
  model,
  inputSchema: z.object({ paragraphs: z.array(z.string()) }),
  prompt: ({ paragraphs }) => `Summarize this document:\n${paragraphs.join('\n\n')}`,
});

const summary = await summarize({ paragraphs: ['First paragraph.', 'Second paragraph.'] });
```

For an LLMAgent, scripts and functions can return text or model-message arrays that retain roles, tool messages, and media parts. Templates produce text.

Forward the preparer's signal when fetching input:

```typescript
const summarizeDocument = create.LLMAgent.withFunction({
  model,
  inputSchema: z.object({ documentId: z.string() }),
  prompt: async ({ documentId }, { abortSignal }) => {
    const response = await fetch(`https://example.com/documents/${encodeURIComponent(documentId)}`, {
      signal: abortSignal,
    });
    if (!response.ok) throw new Error(`Document request failed: ${response.status}`);
    return `Summarize this document: ${await response.text()}`;
  },
});
```

The same execution-options argument is available to specialized function preparers, such as those opening audio. Casai checks cancellation before starting the backend; external work must cooperate with the signal.

#### Combining Modifiers

Use modifiers in this order:

1. At most one input modifier (`.with...` or `.loads...`).
2. Optional `.asStream` on LLMAgent or Template.
3. Optional `.asTool` where a completed tool result is available.

For example, `create.LLMAgent.withTemplate.asStream.asTool(...)` creates a component whose ordinary call streams and whose tool execution collects one execution into a completed result. Tool adaptation preserves inherited streaming mode.

Two input modifiers cannot be combined. Script and Function have no `.asStream` because their schema declares whether they return a stream. StreamingTranscriber always streams and can become a tool only with a script/function preparer that opens audio with a completion boundary. An indefinitely open live session cannot be collected automatically into a tool result.

Unsupported combinations have no corresponding factory property; TypeScript reports them and JavaScript sees `undefined`.

#### Modifier Support

Choose a modifier supported by the component: ✅ = supported; ❌ = not applicable or not exposed.

| Component | [.withText](#text-and-template-modifiers) | [.withTemplate](#text-and-template-modifiers) | [.withScript](#script-and-function-modifiers) | [.withFunction](#script-and-function-modifiers) | [.loadsText](#text-and-template-modifiers) | [.loadsTemplate](#text-and-template-modifiers) | [.loadsScript](#script-and-function-modifiers) | [.asStream](#streaming) | [.asTool](#using-components-as-tools) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [Config](#config) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| [Template](#template) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| [Script](#script) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| [Function](#function) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| [LLMAgent](#llmagent) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| [Decision](#decision) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| [Embedder](#embedder) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| [Reranker](#reranker) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| [ImageGenerator](#imagegenerator) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| [Transcriber](#transcriber) | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| [StreamingTranscriber](#streamingtranscriber) | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅* |
| [SpeechGenerator](#speechgenerator) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| [VoiceSessionSetup](#voicesessionsetup) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

\* StreamingTranscriber supports `.asTool` only after `.withScript`, `.withFunction`, or `.loadsScript`; its preparer must open a bounded audio stream from named tool arguments.

`Template`, `Script`, and `Function` perform their named operation by default, so they have no matching `.with...` modifier. Their loading and tool forms adapt that operation, and Template can also stream. Script and Function return a stream when their schema declares one; see [streaming](#streaming).

#### Input Preparation by Component

Preparation targets the input appropriate to each operation:

| Component | Main property | Text/template preparation | Script/function return value |
| :--- | :--- | :--- | :--- |
| LLMAgent | `prompt` | Prompt text | Text or model messages |
| Decision | `state` | Text state | Decision state, including structured state |
| Embedder | `value` | One text value | A string, or a string array for a batch |
| Reranker | `query` | Query text | A query string or `{ query, documents }` |
| ImageGenerator | `prompt` | Prompt text, retaining editing inputs | Text or an SDK image-prompt object |
| Transcriber | `audio` | Not applicable | An SDK audio value, such as bytes or a URL |
| StreamingTranscriber | `audio` | Not applicable | A raw audio stream; format is an invocation setting |
| SpeechGenerator | `text` | Text to speak | Text to speak |
| VoiceSessionSetup | `instructions` | Session instructions | Instructions for a new session |

A main property passed with a call is prepared the same way as the configured one, and replaces it for that call.

Rendering context is passed through the ordinary rendered call or the component's named-argument method, such as `.run({ context, ...settings })`. Preparation preserves typed values such as arrays, URLs, audio bytes, and streams. It supplies operation input, rather than arbitrary model settings.

Modifiers apply only where their output fits the input. Text and template modifiers produce one string, so an Embedder prepared with them embeds a single value; a Script or Function can return a string array to embed a batch. Preparing a reranking query or image prompt retains separately supplied documents or editing inputs. Transcribers use script/function preparation for fetching or opening audio; encoded audio strings are not text prompts. Voice-session instructions are prepared once per new connection.

### LLMAgent Call Reference

On a plain LLMAgent, the first argument always means the new prompt: a string or a model-message array. The second is already-prepared history. These forms apply with or without streaming mode.

| Component form | Ordinary call | Meaning |
| :--- | :--- | :--- |
| Plain | `agent()` | Use the configured prompt |
| Plain | `agent('New prompt')` | Supply new prompt text |
| Plain | `agent(newMessages)` | Supply one or more new prompt messages |
| Plain | `agent('New prompt', messageHistory)` | Append prompt text after history |
| Plain | `agent(newMessages, messageHistory)` | Append new messages after history |
| Template/script, including loaded forms | `agent(context)` | Prepare the configured source |
| Template/script, including loaded forms | `agent(context, messageHistory)` | Prepare a new turn after history |
| Template/script, including loaded forms | `agent(source, context, messageHistory?)` | Prepare a one-off source |
| Function prompt | `agent(context, messageHistory?)` | Call the configured prompt function |

There is no positional history-only form. Message arrays carry no marker that distinguishes history from new messages: even a variable named `messageHistory` is interpreted as prompt messages when passed first to a plain agent. `agent.run({ messageHistory })` uses the configured prompt when one exists, including preparation and input validation; only an agent without an effective prompt sends history without adding a new turn. Fixed instructions, SDK custom options, and request hooks still apply.

Ordinary calls and `.run()` resolve inputs in the same way: supplied values override configuration, and an omitted or undefined prompt retains the configured prompt. Adding history, execution settings, or an empty `context` does not select a different operation. `messageHistory: []` means no earlier messages and still runs a configured prompt. If there is neither an effective prompt nor nonempty history, the call is invalid.

From Cascada, keyword arguments supply the named input/context object; a rendered `agent(messageHistory, topic='recycling')` normalizes to JavaScript `agent({ topic: 'recycling' }, messageHistory)`. Keywords must come last in Cascada, so this marked form is an explicit exception to positional ordering. JavaScript `agent(messageHistory, context)` and the equivalent Cascada call with an unmarked object literal are invalid; use context before history. A lone array is never inferred to be history.

### Common Component Contracts

LLMAgent, Template, Script, and Function share the parts that make workflows reusable:

- **Callable operations:** Put a component or application function in `context`, then call it from JavaScript or Cascada.
- **Named invocation:** Every callable has `.run({ ... })` for named inputs and execution settings, returning the same result as its ordinary call. Function's callback stays fixed at creation.
- **Application input:** Rendered LLMAgents, Template, Script, and Function accept context. Schema-declared fields are application input; undeclared configured keys are private dependencies. Resolve configured application defaults and call/model overrides, parse once, and execute with parsed values plus private/trusted bindings. Configuration and schema defaults can satisfy required fields even with empty arguments. Calls use schema input types; implementations use parsed types.
- **Configuration:** Reuse compatible settings through Config or component inheritance; each invocation keeps its own input and settings.
- **Shared inputs stay intact:** Calls and `.run()` do not mutate shared context, nested application data, or configuration. Schema callbacks and implementations treat inputs as read-only; structured transforms return replacements. Cascada's `!` sequences intentional external effects rather than authorizing context mutation.
- **Inherited execution mode:** LLMAgent and Template inherit streaming mode from a parent component. `.asStream` enables it; deriving a component cannot switch it off. Independently invoked components keep their own mode. Script and Function declare streaming through `schema`.
- **Tool adaptation:** `.asTool` exposes a completed operation to a model. Finite streaming operations are collected once for tool execution; ordinary calls retain their result and mode.

| Component | The call returns |
| :--- | :--- |
| LLMAgent | The full SDK result; its `.value` is final output, delivered as a value or native stream according to output kind and mode |
| Template | The rendered string; a text stream with `.asStream` |
| Script / Function | The program's return value: a value, or a stream when `schema` declares one |

Template, Script, and Function have native Casai contracts. They do not accept SDK conversations or implement the SDK Agent result/event protocol. LLMAgent additionally implements that protocol, because it delegates language generation and streaming to the SDK. See [AI SDK integration](#ai-sdk-agent-interface-and-ui-integration).

To replace a model operation inside a workflow, expose its application value through a small adapter and give the coded replacement the same input and value types. The [replacement examples](#interchanging-components-in-workflows) show that boundary. Reusable operations, including implementations also registered as model tools, are called explicitly through [context helpers](#calling-tools-from-coded-components).

### Named Arguments and Per-Call Overrides

Every callable component has `.run({ ... })`. It takes named inputs and permitted per-call settings, returning the same result in the same mode as the ordinary call. It returns a promise; for streaming, awaiting it obtains the live handle without waiting for completion.

Template accepts `.run({ template, context, toolsContext, abortSignal, timeout })`, Script accepts `.run({ script, context, toolsContext, abortSignal, timeout })`, and Function accepts `.run({ context, toolsContext, abortSignal, timeout })`. Omit a source to use its configured value. `toolsContext` supplies request-specific application data to registered tools; it merges by tool name, replacing each supplied entry as a whole. It does not change tool definitions or schemas. Function's `execute` callback and schemas remain fixed. See [cancellation](#cancellation-timeouts-and-usage) for the upstream work needed to interrupt and clean up nested execution.

```typescript
const detailed = await explain.run({
  prompt: 'Explain {{ topic }} with one practical example for {{ audience }}.',
  context: { topic: 'solar panels', audience: 'a homeowner' },
  maxOutputTokens: 600,
});
```

`explain` is a `.withTemplate` agent, so the call-time `prompt` is a template, like the configured one.

| LLMAgent field | Meaning |
| :--- | :--- |
| `prompt` | The new turn, replacing the configured prompt. On a plain agent, literal text or model messages; on a rendered agent, a template, script, function, or resource name |
| `context` | Rendering input for template, script, and function forms |
| `messageHistory` | The conversation so far, placed before the new turn |
| `options` | [Custom call options](#custom-call-options-and-hooks), validated by `callOptionsSchema` |
| `approvals`, `toolResults` | Decisions and external tool results that [continue](#tool-approvals-and-continuation) a conversation ending in pending tool calls; used with `messageHistory` |
| Other settings | Model settings, tools, callbacks, `stopWhen`, cancellation, and other supported per-call settings |

Configured `instructions` apply to every call. The [SDK methods](#ai-sdk-agent-interface-and-ui-integration) `.generate()` and `.stream()` take the SDK's own arguments instead, with a literal conversation.

At the top-level invocation/settings layer, `undefined` counts as not supplied and leaves the configured value in place. Inside a supplied `context` object, an own property set to `undefined` remains an explicit shallow override, just like any other value. With configured `name: 'Ada'` and a schema field `z.string().default('x')`, passing `{ name: undefined }` therefore produces `'x'`; omitting `name` retains `'Ada'`. This preserves the existing merge rules. LLMAgent callbacks passed for one call run in addition to configured callbacks.

Overrides are isolated: concurrent calls can use different inputs, settings, and history without changing shared components or data. Native parsers such as Zod copy declared containers; opaque references and unchanged branches may remain shared. Casai adds no generic copy planner or deep clone of models, helpers, clients, promises, or streams. All schema callbacks and implementations treat shared inputs as read-only; keep mutable request state invocation-local.

Output contracts, schemas, the Function `execute` implementation, and renderer setup stay fixed. Derive another component to change LLMAgent `output`, Script/Function `schema`, input schemas, filters, render options, or loaders. Per-call lifecycle callbacks on LLMAgent compose with configured callbacks.

Specialized components follow the same pattern. Their ordinary call takes the main property by position: `route('My order arrived damaged.')`, `reranker(question, candidates)`, `illustrator('A watercolor workshop')`, `transcriber(recordedAudio)`, or `speaker('Your replacement is on its way.')`. With an input modifier, it also takes the context the main property is prepared with. `.run()` takes the SDK's input fields and settings by name, such as `reranker.run({ query, documents, topN: 3 })`. `VoiceSessionSetup` has a [session lifecycle](#voicesessionsetup).

### Streaming

A component's mode is chosen when it is created and inherited by derived components. To choose complete or streaming mode independently for several variants, derive them from a shared `Config` rather than from a streaming component. `.asStream` enables streaming on LLMAgent or Template; deriving through the base factory does not disable it. Script and Function return what their schema declares, and StreamingTranscriber always streams. Each invocation executes once. Calling an independent nested component preserves that component's own mode.

| Component | Complete | Streaming |
| :--- | :--- | :--- |
| LLMAgent | SDK `generateText` result | With `.asStream`: SDK `streamText` result |
| Template | Rendered string | With `.asStream`: text stream from Cascada's future `renderStringStream` |
| Script | Returns a value | Returns a `stream` or `tstream` channel, declared by a [stream schema](#stream-schemas) |
| Function | `execute` returns a value | `execute` returns a stream, declared by a stream schema |

To enable streaming on an LLMAgent or Template in complete mode, derive a streaming component from it: `create.LLMAgent.asStream({}, writer)`.

Native streams are async iterables with two runtime kinds: `tstream` for text chunks and `stream` for complete elements. Their schemas preserve that distinction across JavaScript and Cascada, including empty streams. A Template always produces `tstream` when streaming. LLMAgent's native output view contains only final application output, using the appropriate kind; unknown tool-loop finality may delay delivery. Its SDK fields retain their separate contracts. See [final-answer streaming](#final-answer-streaming-in-tool-loops).

Streams are consumed as they are read. Passing a stream to a component allows it to consume the stream; returning that same source does not restore consumed items. It may have unread items, be exhausted, or have been closed. A Script, Template, or Function returning a stream adds no replay guarantee. Sharing must be explicitly supplied by the underlying source or a sharing helper. LLMAgent's [SDK result getters](#consuming-a-stream) retain their separate ability to create fresh views of one execution.

Two helpers exported from `casai` collect a native stream into its complete value: `collectTextStream(stream)` joins text chunks into one string, and `collectStream(stream)` collects elements into an array. Choose the one that matches the stream; both accept any async iterable, including a streaming LLMAgent's `.value`. In a Script, assigning a `stream` or `tstream` channel takes a snapshot instead: the elements emitted before the assignment in source order, as an array or a string.

Nested calls keep their declared contracts. A Template forwards a child's stream when it streams, and collects it when it renders complete text. See [composition](#streaming-through-templates-and-scripts).

**Implementation stages:** JavaScript stream kinds, schemas, collectors, and Function producers belong to [Phase 2a](docs/agents-design.md#phase-2a-coded-component-conventions-and-javascript-streams); LLMAgent output streams follow in Phase 2b. The installed Cascada engine already shares async iteration between its loops by default. This internal behavior does not make streams returned to JavaScript replayable. [Phase 4](docs/agents-design.md#phase-4-cascada-streaming-integration) integrates Cascada's future `renderStringStream`, native `stream`/`tstream` channels with live return, runtime kinds, source-order snapshots, validation, and native stream error behavior.

Cascada owns error handling for its complete returns and native `stream`/`tstream` types. A complete value is healthy or a poison/failure outcome. A native stream delivers its valid prefix and terminates at its first error; neither the failed nor later items are delivered. Casai forwards this behavior without scanning partially failed objects or choosing different stream semantics for different consumers.

Collectors and tool adapters propagate stream failure instead of returning successful partial results. Casai forwards supported cancellation and closure; Cascada and the SDK own their scheduling and shared-source cleanup. A returned live stream remains usable after the component call resolves. See the [stream lifecycle design](docs/agents-design.md#lifecycle).

#### Stream Schemas

Zod has no stream type, so `casai` exports two schema constructors, `textStreamSchema()` and `streamSchema()`, for the `schema` of a Script or Function that returns a stream:

| Schema | The program returns | Collect with |
| :--- | :--- | :--- |
| `textStreamSchema()` | `tstream`: an async iterable of text chunks | `collectTextStream()`: the joined string, `''` when empty |
| `streamSchema(elementSchema)` | `stream`: an async iterable of complete elements | `collectStream()`: the elements in order, `[]` when empty |

The schema declares whether strings are text chunks or elements of a list and preserves that kind at runtime. It checks a Function producer's TypeScript return type and a Script's returned stream at runtime. Script channels retain their declared `stream` or `tstream` kind; a configured schema must agree. Plain Function-produced async iterables acquire their declared kind at the schema boundary. Native streams do not publish partial object updates.

Elements are parsed lazily during consumption: producer, schema parser, then caller. Where needed, one wrapper reads each producer element once and forwards the parsed element, including transformations. Neither a new wrapper nor a new element duplicates producer execution, starts another source reader, or retains replay history. Preparing a wrapper reads nothing. Collection uses that view without reparsing. Reuse parsing already done by the SDK or Cascada for the same contract.

Text schemas parse string chunks; element schemas parse complete healthy elements and forward their schema-produced values. Failures stop JavaScript iteration after the valid prefix. Whole-result checks finish only at completion; guaranteeing whole-stream validity before exposing anything requires explicit collection.

Cascada owns validation and failure for native values and `stream`/`tstream`. Casai passes schemas through supported engine APIs and reuses that validation. Ordinary JavaScript Function streams use the lazy Casai validator; do not add another validation pass to an already validated native stream.

Stream schemas describe only a whole returned stream; a JavaScript stream nested in a returned object is an opaque value whose elements Casai doesn't validate.

`.asTool` collects finite native streams into a completed result: join `tstream` chunks or collect `stream` elements. The direct component call still returns its stream. The same rule applies to a streaming Template. Only a root stream is collected: a result that contains streams inside an object is returned as is, so a component used as a tool must produce a tool-suitable result.

LLMAgent uses SDK `Output.text()` or `Output.array({ element })`, with its SDK validation and result semantics. Its `partialOutputStream` remains available for compatibility.

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
  inputSchema: z.object({ text: z.string(), language: z.string() }),
}, defaults);

const shortSummarizer = create.LLMAgent.withTemplate({
  maxOutputTokens: 150,
}, summarizer);

console.log((await shortSummarizer({ text: 'A document to summarize.' })).value);
```

A `Config` can be partial. Children or the final call can supply values that are valid at those stages; a call-suppliable input such as `prompt` need not be fixed in configuration. Types require any input still missing at the call, while fixed creation-time requirements remain checked when the component is created. Preserve the existing merge/type-safety machinery; implementation changes require explicit user confirmation. Components can also inherit from compatible components. Local settings take precedence according to these rules:

| Property | Inheritance behavior |
| :--- | :--- |
| `context`, `filters`, `tools`, `toolsContext` | Merge by key; a child entry replaces the same parent entry |
| `loader` | Try child loaders before parent loaders; named race groups combine |
| Streaming mode on LLMAgent/Template | Inherit from the parent; `.asStream` enables it and no modifier disables it |
| Other properties, including `model`, `prompt`, schemas, `output`, `options`, `renderOptions`, and `providerOptions` | Replace the whole value |

Key merging is shallow. A child `context: { settings: { language: 'French' } }` replaces the entire inherited `settings` value. A `toolsContext` entry similarly replaces that tool's whole context value.

Omitting a property inherits it. Explicit `undefined` clears ordinary replacement properties. For merged maps, an omitted, empty, or `undefined` whole map retains inherited entries; an explicitly `undefined` entry replaces that entry. An empty or `undefined` `loader` value retains the inherited loaders. These rules apply to configuration inheritance; in call-time arguments, `undefined` means not supplied.

Tool definitions merge only by tool name: a supplied definition replaces the whole inherited definition, never its individual fields. A tool entry set to `undefined` or `null` removes that tool after resolution. For example, `tools: { search: undefined }` removes inherited `search` while retaining other tools. Remove cleared entries before exposing the effective SDK tool registry or passing it to the SDK; infer tool names and required tool context from that same effective registry. This is a tool-registry rule, not a reason to remove ordinary null/undefined application data.

Keep shared fragments compatible with their consumers. A context-only Config can be shared by a Script and an LLMAgent; a Config containing language-model settings is not a standalone Template configuration. The `execute` callback belongs to Function. LLMAgent describes model output with an SDK `Output` specification; Script and Function parse their native result with `schema` and return its produced value. Template produces text. Incompatible inherited properties are rejected along with incompatible local ones.

### Inspecting Configuration

`Config` and every callable component, including `Function` and tool forms, expose resolved configuration through `.config`:

```typescript
console.log(shortSummarizer.config.maxOutputTokens); // 150
console.log(shortSummarizer.config.context);         // { language: 'English' }
```

Function tools also retain the SDK-required tool properties on the callable. Use inheritance or per-call settings instead of mutating a shared component. Set `debug: true` for configuration and invocation diagnostics.

## The Casai Components

The following sections cover creating and calling each component and reading its result. [Config](#config) supplies shared settings. Choose a model suited to the operation: a language model for LLMAgents, an embedding model for Embedder, and the corresponding provider model for other AI operations.

LLMAgent, Template, Script, and Function share [composition conventions](#common-component-contracts), input validation, configuration inheritance, and tool adaptation. Preserve an operation's application input and value to [interchange implementations inside a workflow](#interchanging-components-in-workflows). LLMAgent alone adds the SDK Agent and chat UI contract.

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

The main property is `template`. Call with context, or with a one-off template followed by context. The result is a promise for the rendered string. Context can contain functions and other components; Cascada resolves asynchronous values during rendering.

For a file or named resource, use `.loadsTemplate`:

```typescript
import { FileSystemLoader } from 'casai';

const report = create.Template.loadsTemplate({
  loader: new FileSystemLoader('./templates'),
  template: 'report.njk',
});

console.log(await report({ title: 'Weekly report' }));
```

In this form, a one-off `template` is another resource name. `.asTool` and `.loadsTemplate.asTool` expose the rendered string as a tool result. Standalone templates default to no HTML escaping; set `renderOptions: { autoescape: true }` for HTML output.

Template's output is text; structured values belong in Script or Function.

#### Streaming a Template

Create a Template with `.asStream` to receive its text as it renders, from Cascada's future `renderStringStream`. Children that should stream into it are also created with `.asStream`; the same Template source collects or forwards their text:

```typescript
const writeIntro = create.LLMAgent.withTemplate.asStream({
  model,
  prompt: 'Write a two-sentence introduction to {{ topic }}.',
  inputSchema: z.object({ topic: z.string() }),
});

const newsletter = create.Template({
  template: 'Weekly update\n\n{{ writeIntro({ topic: topic }).value }}',
  inputSchema: z.object({ topic: z.string() }),
  context: { writeIntro },
});

const liveNewsletter = create.Template.asStream({}, newsletter);
const issue = await liveNewsletter({ topic: 'battery recycling' });
for await (const text of issue) {
  process.stdout.write(text);
}
```

The heading arrives at once, and the introduction follows as the model writes it. `await newsletter({ topic: 'battery recycling' })` renders the same source into a complete string. The native text stream and renderer are future capabilities. See [streaming](#streaming) and [streaming through templates and scripts](#streaming-through-templates-and-scripts).

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

The main property is `script`. Call with context, or with a one-off script followed by context. Use direct `return` values for strings, numbers, objects, arrays, or other supported workflow results. `schema` optionally validates the returned value.

`.loadsScript` loads a named script through a configured loader. `.asTool` and `.loadsScript.asTool` expose the workflow as a tool; `Script.loadsScriptAsTool` is an alias for `Script.loadsScript.asTool`. Both inline and loaded scripts can call helpers or components from context.

The returned value is parsed once by `schema` when configured, and the caller receives the schema-produced result. A producer returns the schema input type; the component returns its output type. Reuse that schema when [interchanging workflow implementations](#output-schemas-and-structured-replacements).

A Script streams by returning a `stream` or `tstream` channel, a **future Cascada capability**. This example declares an element stream with a [stream schema](#stream-schemas):

```typescript
const guideTitles = create.Script({
  inputSchema: z.object({ topics: z.array(z.string()) }),
  schema: streamSchema(z.object({ title: z.string() })),
  script: `
    stream titles
    for topic in topics
      titles({ title: 'Guide to ' + topic })
    endfor
    return titles
  `,
});

for await (const item of await guideTitles({ topics: ['Solar', 'Wind'] })) {
  console.log(item.title);
}
```

Returning the channel returns the live stream; `titles.snapshot()` returns a completed array. Elements are parsed lazily before delivery, forwarding their schema-produced values, and Cascada terminates the native stream at its first error after any valid prefix. `collectStream(await guideTitles(...))` collects the array or propagates failure. Text output uses a distinct `tstream` channel with `textStreamSchema()` and collects into a string. Assigning `titles` takes a snapshot of the elements emitted before that assignment in source order. An ordinary output schema validates the resulting array/string; assigning a JavaScript stream retains its reference without collecting it. Live channel return and these semantics require [upstream work](docs/agents-design.md#phase-4-cascada-streaming-integration).

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

`execute` may be synchronous or asynchronous; Function returns a promise for its result parsed by `schema` when supplied. Callback output uses the output schema's input type; callers receive its output type. Configured schema-declared context supplies application defaults, while configured undeclared helpers are private bindings outside `inputSchema`. Without `inputSchema`, the callback's declared argument type determines call input, with configured context fields optional.

A Function can inherit from a `Config` or another Function. If a child changes schemas or context incompatibly, provide an `execute` callback that matches the final configuration. Use `.asTool` to let an LLMAgent call the function; see [tools](#using-components-as-tools) for execution context and validation behavior.

#### Streaming from a Function

A Function streams when `execute` returns an async iterable, such as an async generator, and its `schema` is a [stream schema](#stream-schemas):

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

TypeScript requires `execute` to produce a stream accepted by its schema: `textStreamSchema()` accepts string chunks and `streamSchema(elementSchema)` accepts that element schema's input type. The caller receives parsed elements of its output type. One lazy wrapper applies the schema in the existing consumption pass with one reader and no duplicate producer. The callback runs once and needs no mode flag. Forwarding an input stream retains its current consumption state rather than making it fresh again.

To forward an LLMAgent's output, call a streaming LLMAgent and return its `.value`: `execute: async ({ topic }) => (await liveWriter({ topic })).value` with `schema: textStreamSchema()`, or with a `streamSchema(...)` schema for array output. The forwarded `.value` retains final-output selection, any buffering needed to identify the final step, and throwing terminal failures. The SDK's `textStream` instead includes text across steps and omits error event parts. Full SDK event streams and transcription events are different protocols.

The callback receives one flat context containing schema-produced application values, private configured dependencies, and separately parsed [tool-context fields](#tool-execution-context). Its second argument holds execution options, including cancellation. `.asTool` collects a finite returned stream into a completed tool result.

### LLMAgent

`LLMAgent` generates a complete language-model result, or streams it when created with [`.asStream`](#streaming-with-asstream). Use it for writing, extraction, classification, image understanding, or tasks involving tools. Text is the default output, and one model step is the default stopping condition.

```typescript
const writer = create.LLMAgent({ model });
const answer = await writer('Explain battery recycling briefly.');

console.log(answer.value); // Parsed output; a string by default.
console.log(answer.text);   // The SDK text accessor is also available.
```

Plain calls accept prompt text or model messages; rendered forms accept context. All seven input modifiers are supported. `.run()` accepts [named inputs and per-call settings](#named-arguments-and-per-call-overrides).

LLMAgent implements the SDK Agent interface directly. To replace its model operation with coded logic inside a workflow, adapt the SDK result to the workflow's [application value contract](#interchanging-components-in-workflows).

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
console.log(report.value.summary);
```

`output` determines parsing, validation, and the inferred type of `result.value`. It is fixed when the component is created. Structured output can be combined with tools. See [SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).

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

console.log((await calculator('Use the tool to multiply 37 by 29.')).value);
```

The default is `isStepCount(1)` when no stopping condition is supplied or inherited. This is the same default as the SDK's `generateText` and `streamText`, so an LLMAgent without `stopWhen` makes the same single model call; the SDK's `ToolLoopAgent` instead defaults to `isStepCount(20)`. A step limit counts model steps, not individual tool calls; execution can finish before reaching it. A single step can run tools but cannot make another model call to interpret their results.

`stopWhen` accepts a condition, such as `isStepCount(5)`, or an array of conditions; any matching condition stops continuation. It can also be overridden for one `.run()` call. See [SDK loop control](https://ai-sdk.dev/docs/agents/loop-control).

#### LLMAgent Results

The call returns the full [SDK generation result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text#returns) or [streaming result](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#returns). Casai adds `value` for final application output and `messageHistory` for conversation state. Streaming changes delivery, not which output `value` represents.

| Field | Complete result | Streaming result |
| :--- | :--- | :--- |
| `value` | Final application output | Native final-output stream for text/arrays; a promise of the final value for other output kinds |
| `output` | Native SDK parsed output | Promise of native SDK parsed output |
| `stream` | Absent | Native SDK execution-event stream |
| `steps` | Array of completed step records | Promise of that array |
| `finalStep` | Final step record | Promise of that record |
| `responseMessages` | Messages produced during this invocation | Promise of those messages |
| `messageHistory` | Prior history, new prompt, and produced messages | Promise of that history |

SDK `text` contains the final step's text. SDK `content`, `toolCalls`, `toolResults`, `files`, and `sources` accumulate across steps; `usage` is total usage. Inspect `finalStep` for its reasoning, usage, provider metadata, and response details; `finishReason` explains why execution ended and `warnings` holds provider warnings. SDK fields retain their native contracts.

An execution can stop at tool calls or an approval request without eligible final output. Reading complete `value` then throws `NoOutputGeneratedError`; consuming its streaming form rejects. Casai never substitutes intermediate commentary or an earlier step's answer. A legitimate pause still supplies completed steps and resumable `messageHistory`. See [approvals and continuation](#tool-approvals-and-continuation). A valid completed empty text answer remains an empty string.

Completed tools do not by themselves prevent a final answer in the same step. Conversely, unresolved tool work prevents successful `value` completion even when the model also emitted text. A nonempty output stopped by a token limit or content filter can still be returned if the SDK's final parser accepts it; inspect `finishReason` when your application requires an untruncated answer. An error ending never becomes a successful `value`. See the [output-availability rules](docs/agents-design.md#output-availability-and-failures).

`steps` is always completed records, or their promise; it never becomes an async iterable. Use `onStepEnd` for step-completion notifications and `stream` for live text, tool, reasoning, and other execution events. The event stream describes the current execution; `messageHistory` holds the conversation. There is no additional conversation or activity-stream alias.

`.asTool` exposes the same completed application output to another model while direct calls retain the full result. For SDK helpers, LLMAgent also implements the [AI SDK Agent interface](#ai-sdk-agent-interface-and-ui-integration).

### Streaming with `.asStream`

The `.asStream` modifier makes an LLMAgent stream: its ordinary call and `.run()` return a live stream result instead of a complete one.

```typescript
const writerStream = create.LLMAgent.asStream({ model });
const textResult = await writerStream('Explain battery recycling briefly.');

for await (const text of textResult.value) {
  process.stdout.write(text);
}
console.log(await textResult.usage);
```

Create a streaming LLMAgent when its callers should receive a stream, such as a chat handler or a streaming Template. To stream an existing LLMAgent, derive one from it: `create.LLMAgent.asStream({}, writer)`. Within a Template or Script, select the child's streaming mode explicitly; the parent does not change ordinary nested calls. For an array response, configure `Output.array(...)`, and `.value` yields complete elements of the final output, as shown below.

The [SDK streaming result](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#returns) includes text, partial-output and supported array-element streams, tool events, steps, usage, metadata, and response conversion methods. Use `result.stream` for the complete SDK 7 event stream; `fullStream` is its deprecated alias. Final values such as `.output` and `.response` are promises. SDK streams retain their own error behavior: `textStream` omits error event parts, while event streams, callbacks, and result promises expose failure information. Transport/iterator failures can also throw. Casai `value` reports terminal failures through iteration.

The streaming ordinary call and `.run()` always return a promise for the stream result. Awaiting it yields the live handle without waiting for generation to finish.

`.asStream` follows an input modifier and can be followed by `.asTool`. A component derived from a streaming parent also stays streaming, including `create.LLMAgent({}, writerStream)`. Tool execution consumes one execution and returns validated final output with the same availability and failure rules as `value`; direct invocation remains streaming.

#### Consuming a Stream

Choose the output representation you need:

| Output specification | Complete `value` | Streaming `value` |
| :--- | :--- | :--- |
| Text, the default | Final string | Native `tstream` of final-output text |
| `Output.array(...)` | Final validated array | Native `stream` of final-output elements |
| `Output.object(...)` | Final validated object | Promise of that object |
| `Output.choice(...)` | Final validated choice | Promise of that choice |
| `Output.json()` | Final parsed JSON | Promise of that JSON |

This table describes runtime delivery. Some SDK output specifications have identical TypeScript types even though their output kinds differ. In those cases, streaming `value` is typed as a union of the possible deliveries, such as a text stream or `Promise<string>`. Narrow it through its async-iterable capability, or use `result.output` when you want the completed value. The default text output retains its precise stream type; completed value and element types remain inferred from the output specification.

**Collecting a successful `value` stream produces the same application data as that execution's final parsed `output`.** This compares two views of one execution, not outputs of separate model calls. Intermediate commentary and tool activity are excluded. For a known single-step answer, text and array elements can arrive incrementally; [unrestricted loops may need buffering](#final-answer-streaming-in-tool-loops).

Incremental output requires pure, deterministic schemas: the same input must produce the same parsed value without side effects. The SDK may validate elements repeatedly while streaming and again for final `output`. Casai adds no redundant parsing, but cannot make SDK validation run only once. Keep validators inexpensive and add stateful enrichment, such as random IDs, after validation. This is a schema contract; Casai does not attempt to detect purity.

When an output has no reliable incremental representation, Casai waits for the final parsed SDK `output`. A text/array `value` stream then emits that final text or its elements; object, choice, and JSON outputs keep their promised final values. The execution still streams SDK events, and no second model call or artificial typing delay is introduced.

The SDK views remain available for other purposes:

| Stream | Contains |
| :--- | :--- |
| `value` | Final-output text or complete elements, with throwing terminal failures |
| `textStream` | Native SDK text deltas across steps, including intermediate commentary; error event parts are omitted |
| `elementStream` | Native SDK array-element delivery; it is not Casai's final-output selection |
| `stream` | Native SDK execution events, including text, tools, step boundaries, errors, and completion |
| `partialOutputStream` | Native SDK partial parsed snapshots; these are not complete, validated `value` elements |

SDK methods select their own operation: `writer.stream()` returns a streaming result even when its ordinary call is complete. Native SDK views and Casai `value` share one execution, but select different representations.

For example, process each completed item and handle a cut-off list:

```typescript
const list = create.LLMAgent.asStream({
  model,
  output: Output.array({ element: z.object({ title: z.string() }) }),
});
const items = await list('Suggest three titles for an article about recycling.');

try {
  for await (const item of items.value) {
    console.log(item.title);
  }
} catch (error) {
  console.error('The list was cut short:', error);
}
```

Stream consumption drives completion. Read a stream, forward it to an HTTP response, or call `await result.consumeStream()` when only completion matters. Final-result promises such as `.output`, `.usage`, and `.steps` also trigger consumption automatically; you do not need to drain a stream before awaiting them. Each SDK stream handle follows its native consumption and locking rules. Accessing a stream-valued result getter again obtains a fresh view of the same buffered execution; it does not reset a handle already consumed. Casai `.value` follows this SDK behavior. A fresh view obtained after completion replays buffered data through the SDK's mechanism; this is not a replay promise for arbitrary Script, Template, or Function streams. Consume a stream during generation to display incremental output. Awaiting the component call alone only obtains the result handle.

The native output view rejects on terminal execution failure, cancellation, unavailable final output, or unrecovered output-validation failure. Already delivered items remain delivered. Final validation must succeed before the iterator completes successfully. Recoverable tool errors and successful retries do not automatically fail the output; abandoned-attempt text must not become part of the final value. With SDK streams, use callbacks or the event stream to inspect error parts. See [error handling](#errors-and-retries).

#### Final-Answer Streaming in Tool Loops

A tool loop can emit `"Let me check."`, call a tool, and then produce `"It is 18 C."`. Casai `value` contains only `"It is 18 C."`. The SDK `textStream` contains text from both steps, and `stream` contains their execution events.

When a step starts producing text, Casai may not yet know whether another tool step will follow. An append-only stream cannot retract text already delivered. Casai therefore buffers candidate output until finality is established, discards intermediate candidates from `value`, and releases only final output. **An unrestricted loop may emit nothing through `value` until the loop finishes.** Buffered output is released without simulated typing delays. SDK execution events remain live throughout, so use `stream` or the [SDK UI helpers](#ai-sdk-agent-interface-and-ui-integration) to display progress.

Incremental `value` delivery is eligible when the effective step cannot call tools or continue deferred provider work—for example, after hooks resolve to no tools, `activeTools: []`, or `toolChoice: 'none'`. A one-step setting alone does not establish that an eligible final answer will exist; tool-enabled calls buffer until answer availability is known. When effective settings do not prove finality, buffer without inspecting stopping predicates or tracking default-condition provenance. Retry/transform output that could be replaced must also be buffered. See the [concrete finality rules](docs/agents-design.md#loop-finality-and-buffering).

For immediate final-answer streaming, make the answer-producing phase explicit. This example first gathers research notes, then uses a separate streaming writer with the default single model step and no tools:

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
const answer = await answerWriter({ question, findings: notes.value });

for await (const chunk of answer.value) {
  process.stdout.write(chunk);
}
```

`lookup` is an application-provided research tool. The two phases are an explicit workflow choice. Casai never adds a synthesis call, disables tools, or changes the stopping condition to force an answer. Templates and Functions forwarding `value` preserve both final-output selection and any required buffering; switching parent rendering mode cannot add intermediate commentary to their output.

### Decision

`Decision` answers named choice, boolean, or score questions against shared state. Use it to route requests, apply a rubric, or evaluate several related questions. It is exported as `Experimental_Decision` while the SDK's `experimental_decide` is experimental.

```typescript
const route = create.Experimental_Decision({
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

Configure the model and question definitions, then pass the `state` to each call; `.run({ state, ...settings })` adds per-call settings. Input modifiers prepare that state. The result retains typed answers, any distributions, usage, metadata, and SDK refusal/error behavior.

Decision performs a decision request and does not run a tool loop. It can itself be exposed as a tool with `.asTool`. For choosing a value as part of a language-generation workflow, an `LLMAgent` can instead use `Output.choice()`; that uses the generation operation.

See [SDK Decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions) for question types, state formats, model support, and results.

### Embedder

`Embedder` converts text into vectors for semantic search, similarity, clustering, and retrieval. Pass one string or an array directly:

```typescript
const embedder = create.Embedder({ model: embeddingModel });

const one = await embedder('First document');
const many = await embedder(['First document', 'Second document']);

console.log(one.embedding);   // number[]
console.log(many.embeddings); // number[][], in input order
```

An array always represents a batch, with one output vector per input. The SDK handles batch splitting and concurrency. The result retains usage and metadata as well as vectors.

Per-call settings go through `.run()`, which uses the SDK's input field names:

```typescript
await embedder.run({ values: ['First document', 'Second document'], maxParallelCalls: 2 });
await embedder.run({ value: 'Another document', abortSignal: AbortSignal.timeout(5_000) });
```

Use exactly one of `value` or `values` in `.run()`. With an input modifier, the ordinary call takes rendering context instead of the text. All input modifiers and `.asTool` are supported. Text and template modifiers prepare one value; a script or function preparer can return one string or a string array for a batch.

As a tool, an Embedder returns vectors. Models can't compute with them, so this is an uncommon use, mainly for tool workflows where the application or another step consumes the vectors.

See [single-input results](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed#returns), [batch results](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many#returns), and [RAG integration](#embedding-and-rag-integration).

### Reranker

`Reranker` orders candidate documents by relevance to a query. Use it after keyword, vector, or hybrid retrieval to select useful context for an LLMAgent or improve search results.

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

Supply `query`, `documents`, and optionally `topN` in `.run()`. The ordinary call takes the query and documents by position, `reranker(question, candidates)`, or just `reranker(question)` with configured documents. Text and template modifiers prepare the query; script/function modifiers can return a query or a complete `{ query, documents }` input.

As a tool, the model supplies only the query. Candidates come from configured `documents` or from a preparer, so the model never copies documents into its tool arguments. A function preparer can fetch candidates for each query, making one component a retrieve-and-rerank tool:

```typescript
const findPolicy = create.Reranker.withFunction.asTool({
  model: rerankingModel,
  description: 'Find the policy passages most relevant to a question.',
  inputSchema: z.object({ question: z.string() }),
  topN: 3,
  query: async ({ question }) => ({ query: question, documents: await searchPolicies(question) }),
});
```

The model receives the top `topN` candidates as `{ document, score }` entries. `searchPolicies` stands for your search service.

The result preserves the SDK ranking and document mapping. Reranker operates on candidates you supply; your application or retrieval service manages the index. See [SDK reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking) and [return fields](https://ai-sdk.dev/docs/reference/ai-sdk-core/rerank#returns).

### ImageGenerator

`ImageGenerator` generates images from a prompt and supports editing when the model provides it.

```typescript
const illustrator = create.ImageGenerator({ model: imageModel });
const pictures = await illustrator.run({
  prompt: 'A watercolor illustration of a recycling workshop.',
  n: 2,
});

console.log(pictures.images);
```

Configure an image model and reusable defaults, then pass prompt and image settings to `.run()`. Editing uses the SDK's image-prompt object and provider-supported inputs such as reference images or masks. Available sizes, output counts, and editing options depend on the model.

All input modifiers and `.asTool` are supported. Text preparation updates the prompt while retaining separately supplied editing inputs; script/function preparation can produce a text prompt or an image-prompt object. As a tool, the generated images go to your application and, as image content, to the model; see [specialized components as tools](#specialized-components-as-tools).

The [result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-image#returns) includes generated images with their media data, warnings, and metadata. To understand an existing image with a language model, use [LLMAgent image messages](#images-and-files-in-llmagent-messages). See [SDK image generation](https://ai-sdk.dev/docs/ai-sdk-core/image-generation) for editing formats and provider options.

An image exposes `.uint8Array`, `.base64`, and `.mediaType`. For editing, supply the source bytes in a prompt object:

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

### Transcriber

`Transcriber` turns a recording into a completed transcript.

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

### StreamingTranscriber

`StreamingTranscriber` produces transcript events while receiving live audio. It requires a streaming-capable transcription model and audio in the declared format. It is exported as `Experimental_StreamingTranscriber` while the SDK's `experimental_streamTranscribe` is experimental.

```typescript
const transcriberStream = create.Experimental_StreamingTranscriber({
  model: streamingTranscriptionModel,
});

const transcriptStream = await transcriberStream.run({
  audio: audioStream, // ReadableStream<Uint8Array | string> of raw audio chunks.
  inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
});

for await (const part of transcriptStream.fullStream) {
  console.log(part);
}
console.log(await transcriptStream.text);
```

Awaiting the call gives you the live result. The [result contract](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-transcribe#returns) has a single-consumer event stream: access and consume `fullStream` before awaiting final-result promises when you need both. Awaiting final results first lets the SDK consume the stream internally.

Casai preserves transcript delta, partial, and final events rather than converting them into `textStream` chunks. Consume `fullStream` explicitly for incremental transcription, or await `text` for use in a workflow. Automatic forwarding into a Template or Script text stream is not part of this contract. When transcription is stopped or fails, the stream ends as the SDK ends it; StreamingTranscriber has no native stream that fails as a whole.

Script/function modifiers can obtain raw audio; the format remains an invocation setting. `.asTool` is available only after `.withScript`, `.withFunction`, or `.loadsScript`. Its model-facing arguments are the preparer's named input fields, not a raw stream:

```typescript
const transcribeRecording = create.Experimental_StreamingTranscriber.withFunction.asTool({
  model: streamingTranscriptionModel,
  description: 'Transcribe a stored recording.',
  inputSchema: z.object({ recordingId: z.string() }),
  inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
  audio: async ({ recordingId }, { abortSignal }) =>
    openRecordingAsPcmStream(recordingId, { signal: abortSignal }),
});
```

Here `openRecordingAsPcmStream` is an application helper that opens a fresh, finite raw PCM stream in the configured format for each execution. A preparer may also provide an explicit normal completion boundary. The tool consumes one execution and returns the completed transcript with segments and SDK metadata; the model receives transcript text by default. It does not concatenate partial/final events or share an already-consumed source between calls. Failures reject collection, and an indefinitely open source is not a valid tool input. Direct component calls still return the live SDK result. See [SDK streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription).

### SpeechGenerator

`SpeechGenerator` converts text into spoken audio.

```typescript
const speaker = create.SpeechGenerator({ model: speechModel });
const spoken = await speaker('Your replacement is on its way.');

console.log(spoken.audio);
```

Configure a speech model and reusable defaults. `.run({ text, ...settings })` adds per-call settings, such as voice or output format. All input modifiers prepare the text to speak; `.asTool` is also supported. As a tool, the audio goes to your application and the chat UI, while the model receives a short confirmation.

The [result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-speech#returns) retains generated audio, format information, and metadata. Combine Transcriber, LLMAgent, and SpeechGenerator for a recording-to-answer workflow. See [SDK speech generation](https://ai-sdk.dev/docs/ai-sdk-core/speech).

`spoken.audio` exposes `.uint8Array`, `.base64`, and `.mediaType`. To return playable audio from a server handler:

```typescript
const audioResponse = new Response(Uint8Array.from(spoken.audio.uint8Array), {
  headers: { 'Content-Type': spoken.audio.mediaType },
});
```

When saving to a file, choose an extension matching the actual media type or configure a supported output format explicitly.

### VoiceSessionSetup

`VoiceSessionSetup` prepares live voice conversations with a realtime model. It is exported as `Experimental_VoiceSessionSetup` while the SDK's realtime API is experimental.

In the SDK's realtime design, the browser runs the session: it captures and plays audio, sends text, interrupts responses, and receives tool calls. The server creates a short-lived token for each session, with the instructions and voice included, and runs tools that need server-side data or secrets. `VoiceSessionSetup` is that server half:

```typescript
const support = create.Experimental_VoiceSessionSetup.withTemplate({
  model: realtimeModel,
  instructions: 'You are the support agent for {{ company }}. Keep answers short.',
  inputSchema: z.object({ company: z.string() }),
  voice: 'alloy',
  tools: { lookupOrder },
});

// In the route the browser calls before connecting:
const setup = await support({ company: 'Acme' });
// Respond with setup: { token, url, expiresAt, tools }.

// In the route the browser calls from its onToolCall handler:
const output = await support.executeTool(
  { toolCallId, toolName, args },
  {
    toolsContext: { lookupOrder: { accountId: authenticatedAccount.id } },
    abortSignal: request.signal,
  },
);
// Respond with output; the browser returns it to the session.
```

The ordinary call prepares instructions and returns SDK session setup; `.run()` is its named form. The component holds no mutable session state. The browser owns the live connection. `executeTool(call, executionOptions)` receives model arguments separately from server-supplied `toolsContext` and cancellation, validates the selected tool's arguments/context, and executes once. Unknown or unavailable tools are rejected. Both server routes must use the same server-owned tool configuration; recover session-specific settings in the application. In the example, `authenticatedAccount` comes from server authentication and `request` is the tool-execution HTTP request.

Text and template modifiers prepare the instructions; script and function modifiers return them. VoiceSessionSetup has no `.asTool`. See [SDK realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime) for the browser session and provider support.

**Separate future contract:** live `VoiceSession` connections, for telephony or agents hosted on the server, would take an audio input stream of raw chunks and their format, as StreamingTranscriber does, and return session events: output audio, transcripts, and interruptions. Casai would hold the provider connection; your application bridges its own transport, such as a telephony WebSocket, to those streams. See the [design](docs/agents-design.md#transcription-and-voice).

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
console.log(summary.value.summary);
```

When invoked as a tool, an LLMAgent returns its completed parsed output. A streaming LLMAgent consumes one execution and returns validated final output, applying the same output-availability and failure rules as `value`; it never runs generation a second time. Template tools return text, Script/Function tools return their native result, and finite native streams are collected according to kind. Direct calls retain their original result and streaming mode.

### Specialized Components as Tools

Without an input modifier, a specialized tool's arguments are its operation input; with one, they are the preparation context, as on LLMAgent. The tool result goes to your application and the chat UI, and the model can receive a different, smaller form:

| Component | Tool arguments without a modifier | The model receives | The application and UI receive |
| :--- | :--- | :--- | :--- |
| Decision | `{ state }` | Decision answers | Decision answers |
| Embedder | `{ value }` or `{ values }` | Vectors | Vectors |
| Reranker | `{ query }`; candidates come from `documents` or a preparer | The top `topN` `{ document, score }` entries | The same entries |
| ImageGenerator | `{ prompt }` | The generated images, as image content | Images as `{ mediaType, base64 }` |
| Transcriber | `{ audio }`, as a URL | Transcript text | Transcript text, segments, and metadata |
| StreamingTranscriber | No plain tool; named preparer context | Final transcript text | Final transcript text, segments, and metadata |
| SpeechGenerator | `{ text }` | A short confirmation | Audio as `{ mediaType, base64 }` |

The model receives images as image content in the tool result, so no prompt rewriting is needed. Anthropic models and OpenAI's Responses API read such images; providers that can't read images in tool results reject or flatten them, and the SDK has no capability flag Casai could check in advance. For those models, set the SDK tool option `toModelOutput`, which `.asTool` accepts, to return text instead.

Streaming components can be tools when they have a completion boundary. LLMAgent and Template support `.asStream.asTool`; Script/Function stream results are collected, and StreamingTranscriber tools require a script/function preparer that opens bounded audio and return completed transcripts. VoiceSessionSetup has a separate session lifecycle and no implicit collection adapter. Plain SDK tools also work in an LLMAgent's `tools` map.

An SDK tool can yield preliminary results from an async generator. When called through a coded component's injected tool wrapper, it is consumed once and returns its final yielded value, following the [SDK convention](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preliminary-tool-results). Casai data streams have different completion rules: a text stream joins into a string, and an element stream collects into an array. Tool adapters distinguish these protocols; they do not return an unconsumed iterator or collect progress updates into application data.

### Calling Tools from Coded Components

Template, Script, and Function call reusable operations as normal context methods. An LLMAgent can expose the same implementation as an SDK tool, allowing the model to choose when to call it. Native components need only the callable helper in `context`:

```typescript
const numberInput = z.object({ a: z.number(), b: z.number() });
const multiplyNumbers = create.Function({
  inputSchema: numberInput,
  execute: ({ a, b }) => a * b,
});

const calculatorSettings = {
  inputSchema: numberInput,
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

const multiplyTool = create.Function.asTool({
  description: 'Multiply two numbers.',
}, multiplyNumbers);
// Supply tools: { multiply: multiplyTool } to an LLMAgent.
```

A Template can use the same helper in `{{ multiply({ a: a, b: b }) }}`. Helpers can also be grouped under `context: { helpers: { multiply: multiplyNumbers } }` and called as `helpers.multiply(...)`.

Component context inputs use one object with named fields. JavaScript and Cascada both accept object literals; Cascada also accepts keyword arguments. For a component supplied directly in context, either Cascada spelling works:

```cascada
lookupOrder({ orderId: 123, quantity: 2, accountId: 1 })
lookupOrder(orderId=123, quantity=2, accountId=1)
```

Both pass the same named data. Fields are matched by name, optional fields can be omitted, and schema/property order has no calling semantics. Casai does not expand input fields into positional arguments such as `lookupOrder(123, 2, 1)`. An implementation still receives a flat context. When a tool declares separate input and trusted-context fields, direct calls supply them together as described [below](#tool-execution-context); calls through a tool registry obtain trusted fields from its owner.

Existing positional main-input, source, context, and history forms remain unchanged. For example, a Template still accepts `(template, context)`, and Cascada keyword arguments can supply its final context object: `greeting('Welcome {{ name }}.', name='Ada')`. Source overrides can also use explicit names: `greeting.run({ template: 'Welcome {{ name }}.', context: { name: 'Ada' } })`.

Template, Script, and Function also accept configured `tools` and `toolsContext`. Their `.run()` accepts request-specific `toolsContext` against those fixed tool contracts. Each run resolves its own map and creates wrappers bound to it, so one request cannot replace another request's tool data. After context resolution, isolation, and schema processing, Casai creates a fresh shallow context copy and adds a callable wrapper for each tool only where no own property already has that name. Each injected wrapper prepares and parses tool arguments and trusted context once, then returns the tool's completed result: a Casai component's root stream is collected, and a plain SDK tool that yields values returns the last one, as in the SDK. Configured context, call-time input, and the shared environment remain unchanged:

```typescript
const tools = { multiply: multiplyTool };

// The model decides when to call multiply:
const modelCalculator = create.LLMAgent({ model, tools, stopWhen: isStepCount(3) });
// The script calls it directly, with the same validation and result:
const fixedCalculator = create.Script({ tools, script: 'return multiply(a=6, b=7)' });
```

A plain SDK `tool()` with an `execute` handler works too; without a model caller, it receives a generated `toolCallId` and empty `messages`. Existing context properties shadow injected tools, even when their value is `undefined`, `null`, or a non-function. Calling a shadowing non-function fails normally, without tool fallback. This does not remove the tool from the model's tool registry; use another registration name if both bindings are needed. Code-driven calls do not apply model approval policies or manufacture chat tool events.

Putting a component in `context` instead calls the component itself, with its own validation and full result: an LLMAgent in context returns its full SDK result, while its tool execution returns the completed parsed output. SDK tool execution adds the SDK's argument parsing, execution metadata, and approval lifecycle; see [tool execution context](#tool-execution-context).

### Tool Execution Context

Casai implementations receive one flat context assembled from parsed application input, private configured dependencies, and separately parsed trusted tool data. `inputSchema` declares application/model arguments; `contextSchema` declares trusted fields; configured keys declared by neither are private dependencies. Field ownership must be discoverable and disjoint where these sources are partitioned:

```typescript
const scale = create.Function.asTool({
  description: 'Scale a number by the application-provided factor.',
  inputSchema: z.object({ value: z.number() }).strict(),
  contextSchema: z.object({ factor: z.number() }).strict(),
  execute: ({ value, factor }) => value * factor,
});

// Direct application calls supply one flat object:
console.log(await scale({ value: 2, factor: 3 })); // 6
console.log(await scale.run({ context: { value: 2, factor: 3 } })); // 6

// On model tool calls, the model supplies value; the application supplies factor:
const scalingAgent = create.LLMAgent({
  model,
  tools: { scale },
  toolsContext: { scale: { factor: 3 } },
  stopWhen: isStepCount(3),
});

// A reusable Script receives trusted tool data per request:
const scalingWorkflow = create.Script({
  tools: { scale },
  inputSchema: z.object({ value: z.number() }),
  script: 'return scale(value=value)',
});
console.log(await scalingWorkflow.run({
  context: { value: 2 },
  toolsContext: { scale: { factor: 3 } },
})); // 6
```

A direct call merges configured and call-time context using the existing rules, then separates known private dependency names and trusted fields before application-input parsing. Each schema runs once and its returned value is used. Direct applications retain the ability to override configured helpers; registry/model arguments do not. Unknown caller-only keys follow strict/strip/passthrough normally. Configured private helpers survive without being declared by the input schema or requiring passthrough. Combined source partitioning requires discoverable field ownership; root-level transforms/preprocessors or opaque shapes are unsupported where ownership cannot be established, while nested transforms and shape-preserving refinements remain allowed.

For calls through a model's or coded component's `tools` registry, trusted fields come only from the corresponding `toolsContext` entry. Adding `factor` to the arguments cannot override or supply that trusted value, even if the input schema accepts extra keys. Direct application calls can supply both sources in their object; the application controls where those values come from. A Template or Script reads validated fields directly, such as `{{ factor }}`.

Execute with parsed application values and private/trusted bindings. Exclude all reserved private/trusted names from application bindings before assembly, including optional trusted names absent from the trusted source. Direct dependency overrides come from the application merge; model arguments cannot supply them. Add fallback tool functions only for absent names. Keep caller/configuration objects, shared tool definitions, and recorded SDK arguments unchanged.

A Function callback receives execution options as its second argument, including `abortSignal` and model-tool metadata such as `toolCallId` and `messageHistory` when applicable. SDK hooks use a separate `runtimeContext`. Plain SDK `tool()` definitions keep their native `execute(input, options)` interface and `options.context`; Casai's flat callback convention does not change their interface.

Tool definitions and `toolsContext` merge by tool name through configuration and supported call overrides. Each supplied tool-context entry replaces that tool's whole context value. SDK tool execution supplies already-parsed arguments/context, and Casai's `execute` wrapper does not validate them again. Injected wrappers for calls from coded components validate once before execution; direct component calls perform their own schema partitioning and validation. Adding or changing tool contracts requires deriving a compatible component.

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

The call returns these requests; it does not remain open waiting for a person. Collect the decisions in your application, then continue with `.resume()`:

```typescript
const result = await reviewCalculator.resume({
  messageHistory: pending.messageHistory,
  approvals: requests.map(request => ({ approvalId: request.approvalId, approved: true })),
});
console.log(result.value);
```

| Field | Contents |
| :--- | :--- |
| `messageHistory` | The conversation ending with the pending requests, usually the pending result's `messageHistory` |
| `approvals` | `{ approvalId, approved, reason? }` for each pending approval request |
| `toolResults` | `{ toolCallId, output }` for a tool call your application executed, or `{ toolCallId, error }` when it failed |

`resume()` appends one `tool` message carrying the SDK `tool-approval-response` and `tool-result` parts, then continues without rendering a prompt or adding a user turn. Every pending request that isn't automatic needs a decision. Each ID must match a call still pending; unknown, duplicate, and already-resolved IDs are rejected. Each result has exactly one of `output` or `error`. Supply the completed application value in `output`, not an SDK result part; a present `output: undefined` is still success. Successes use the registered tool's `toModelOutput`, or the SDK default of text for strings and JSON for other values. Errors use the SDK error-text representation and bypass the success converter. Contradictory decisions/results are rejected, and an approved call supplied with an external result does not execute again. The history can come from storage, so a decision collected in a later request resumes the same way. Other per-call settings, such as `abortSignal`, are accepted as in `.run()`. The application owns persistence and deduplication across requests.

`resume()` runs in the component's mode: it generates, or streams on an `.asStream` component. `.run()` accepts the same `messageHistory`, `approvals`, and `toolResults` fields.

Chat UIs don't need `resume()`: the SDK UI client sends approval responses with the next request, and the UI helper passes the complete conversation. See the [SDK approval guide](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-execution-approval) for response formats.

## Template and Script Properties

Templates, scripts, and their AI input modifiers share Cascada rendering settings. Use these properties to provide data, helpers, source loading, and rendering options.

### Source Properties

Standalone Template uses `template`; standalone Script uses `script`. LLMAgent uses `prompt`, with the modifier determining whether it contains literal input, a template, a script, a function, or a resource name. A one-off replacement goes in the same property: as the first argument of the ordinary call, or as `prompt` in `.run()`. Other AI operations prepare the main property described in the [preparation table](#input-preparation-by-component).

Configured inline templates and scripts are compiled for reuse, with syntax errors reported when called. Loaded sources resolve on first use. Compiled sources are cached by environment, source, and template/script mode. Changing source reuses a compatible environment; changing loader, filters, or render options selects another environment. A one-off resource name can bypass a missing configured resource.

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

Call-time application values merge over configured declared defaults before input parsing, on direct and tool paths alike. Schema defaults apply afterward. Private configured dependencies stay outside that schema and are bound for execution; direct applications may override them, models may not. Calls use schema input types and require what remains missing; implementations receive parsed types plus private/trusted bindings. Existing parent/child and shallow override laws remain unchanged.

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

Put a template such as `Summarize this document: {{ text }}` in `./prompts/summary.njk`. To select another resource for one call, pass its name as the first argument or as `prompt` in `.run()`.

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

LLMAgent uses SDK Agent settings such as `output`, `callOptionsSchema`, `options`, `tools`, `runtimeContext`, and `id`, together with SDK lifecycle callbacks. Template, Script, and Function use their [native component contracts](#common-component-contracts); application data and callable helpers belong in `context`. Per-call cancellation and timeouts are described in [cancellation](#cancellation-timeouts-and-usage).

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
| `maxRetries`, `timeout` | Configure retries and timeouts; a defined call timeout replaces the configured value |
| `callOptionsSchema`, `options` | Validate and supply custom call options |
| `prepareCall`, `prepareStep` | Customize a request or individual model steps |
| `onStart`, `onStepEnd`, `onEnd` | Observe execution and completion |
| `onChunk`, `onError`, `onAbort` | Observe streaming output, errors, and cancellation |

Casai does not impose sampling defaults. An omitted setting uses SDK/provider behavior. Use current SDK setting names in configuration and `.run()`, such as `instructions`, `telemetry`, `repairToolCall`, and `include`; deprecated setting aliases are rejected. `abortSignal` is a per-call setting, not constructor configuration, until configured-signal combination is supported. For cancellation, pass an abort signal for one call:

```typescript
const result = await explain.run({
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

Streaming completion callbacks require the stream to progress to completion. `onChunk`, `onError`, and `onAbort` apply to streaming execution. Lifecycle observers passed to `.run()` run alongside the configured observers; both are awaited, their failures are ignored as in the SDK, and completion order is not guaranteed. `onChunk` still pauses stream processing until its observers settle. Control hooks use replacement semantics: a supplied `onError` replaces the configured handler and preserves its retry decision; supplied preparation/repair hooks and transform lists likewise replace configured values. See [SDK lifecycle callbacks](https://ai-sdk.dev/docs/ai-sdk-core/generating-text#lifecycle-callbacks-experimental).

Each LLMAgent reports its own usage through these callbacks and the SDK's `usage` fields. Usage for a whole Script or Template workflow will come from Cascada telemetry; see [future features](docs/future.md).

### Custom Call Options and Hooks

`callOptionsSchema` describes application-specific SDK Agent options on LLMAgent, supplied as `options`. AI SDK helpers such as `createAgentUIStreamResponse` forward their own `options` argument the same way. Cascada's rendering settings use `renderOptions`.

```typescript
const accountAgent = create.LLMAgent({
  model,
  callOptionsSchema: z.object({ accountId: z.string() }),
});

await accountAgent.run({
  prompt: 'Summarize the request.',
  options: { accountId: 'example-account' },
});
```

On LLMAgent, use `prepareCall` to consume these validated options and return the prepared request settings. It runs once per invocation, after input preparation. Preserve the other settings when changing a field, as in the [dynamic instructions example](#dynamic-instructions-for-chat-requests). `prepareStep` runs for individual model steps. Templates and scripts used to prepare the prompt run once, rather than rerendering for each tool-loop step. Template, Script, and Function receive their application input directly through `context`, rather than SDK options or conversation mapping.

When the custom schema requires options, configure default `options` for ordinary calls, or supply them with `.run()`. Configured `options` apply whenever a call does not supply its own. `callOptionsSchema` is fixed at creation, and a call's `options` replaces the configured value as a whole.

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
    var summary = summarizeText({ text: text }).value
    var tags = extractTags({ text: text }).value
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

A template can also invoke an asynchronous component directly, for example `{{ summarizeText({ text: text }).value }}` when `summarizeText` is an LLMAgent supplied in its context. Casai doesn't detect LLMAgent results, so a template reads `.value` explicitly, as a Script does. Use JavaScript helpers in context for application-specific behavior; Cascada resolves their promises like component calls.

### Streaming Through Templates and Scripts

Streaming a parent preserves each nested call's declared contract. A child streams when it was created with `.asStream`, or is a Script or Function whose schema declares a stream. In the newsletter above, `writeIntro` is explicitly a streaming LLMAgent; the Template can collect its text during generation or forward its chunks during streaming without changing source:

```typescript
const page = await newsletter({ topic: 'battery recycling' });
const live = await liveNewsletter({ topic: 'battery recycling' });
```

Assignments, property access, function arguments, and filters retain ordinary values when the called component is configured for complete execution:

```nunjucks
{% set summary = summarizeText({ text: text }).value %}
{{ summary | truncate(100) }}
```

Likewise, `var summary = summarizeText({ text: text }).value` in a Script still obtains the complete string. An explicit streaming child returns its declared stream/result in both parent modes; consume it intentionally before using a complete value in calculations.

A Script exposes live output by returning a future `tstream` channel for text or `stream` channel for elements, with a matching [stream schema](#stream-schemas). A channel snapshot or ordinary array is a completed value. Native streams preserve their kind and logical order across context and component calls. In a script, iterating or assigning a channel sees the elements emitted before that point in source order, and an assignment takes a snapshot: an array or a string. A JavaScript stream assigned in a script stays a reference. Cascada's default internal sharing lets several loops read its retained sequence; passing the source to JavaScript or returning it does not restore consumed items. Schema adapters may wrap a source while preserving its producer and consumption state.

Independent producers may finish out of order. Cascada delivers output in logical source order: for explicitly streaming `{{ slowA() }}{{ fastB() }}`, available text from `slowA` can be displayed immediately while `fastB` waits behind it. Intermediate calls do not publish output merely because they execute.

The JavaScript stream schemas, collectors, and Function producers are planned for [Phase 2a](docs/agents-design.md#phase-2a-coded-component-conventions-and-javascript-streams). Integration with Cascada's future Template renderer, native Script channels, kind metadata, source-order snapshots, native validation, and engine-owned stream termination belongs to [Phase 4](docs/agents-design.md#phase-4-cascada-streaming-integration). These are planned stages; the early JavaScript work does not require new Cascada features.

### Ordered and Unordered Streams

The native contract delivers text chunks and complete array elements in logical order. Out-of-order delivery remains a [deferred design extension](docs/agents-design.md#phase-5-out-of-order-streaming), dependent on Cascada's position-aware streaming support. Public unordered properties, position payloads, transport, branching, and buffering are not part of the core contract yet. This does not prevent independent work from running concurrently.

### Concurrency, Ordering, and Recovery

Cascada is a separate language with JavaScript-like expressions and its own control-flow syntax. It does not use JavaScript `await` or `try/catch` inside a script. Independent statements and `for` iterations run concurrently, so source order alone does not sequence external side effects.

Use `for item in items of 3` to limit a script loop to three concurrent iterations. Use `each item in items ... endeach` for sequential iterations, or Cascada's `sequence` / `!` facilities for ordered access to stateful services. This concurrency control is separate from an LLMAgent's step limit and Embedder's batch settings.

Script failures propagate through dependent values while unrelated work can continue. Bind a result and use `is error` when you want a fallback:

```typescript
const resilientSummary = create.Script({
  context: { summarizeText },
  inputSchema: z.object({ text: z.string() }),
  script: `
    var summary = summarizeText({ text: text }).value
    if summary is error
      summary = 'Summary unavailable.'
    endif
    return summary
  `,
});
```

A bare side-effect call discards its result, including a failure; bind and inspect it when the workflow must detect failure. Use direct return values for ordinary data, and channels when ordered concurrent collection is needed. See the [Cascada script reference](https://geleto.github.io/cascada-script/#/) for recovery and sequencing rules.

## Conversational AI: Managing Message History

Each call carries the conversation so far as its `messageHistory`. The ordinary call takes the new prompt or context first and the message history last, and the result's `messageHistory` holds that history, the new turn, and the reply. Store it and pass it to the next call. A component holds no conversation of its own, so one component serves many users.

```typescript
import type { ModelMessage } from 'ai';

const chat = create.LLMAgent({
  model,
  instructions: 'Answer clearly and concisely.',
});

let messageHistory: ModelMessage[] = [];

const first = await chat('My project is called Orchard.', messageHistory);
messageHistory = first.messageHistory;

const second = await chat('What is my project called?', messageHistory);
messageHistory = second.messageHistory;
console.log(second.value);
```

`.run({ prompt, messageHistory, ...settings })` takes the same input with settings; rendered forms use `.run({ context, messageHistory })`.

To continue with history alone:

```typescript
const continued = await chat.run({ messageHistory });
```

This example's `chat` has no configured prompt, so the call adds no new turn. If a prompt is configured, the same call prepares and appends it as usual. Execution settings and the presence of an empty `context` do not change prompt resolution. A positional array on a plain agent is always new prompt messages; two arrays mean `agent(newMessages, messageHistory)`.

| Result field | Contents |
| :--- | :--- |
| `messageHistory` | The supplied `messageHistory`, the new turn, and all generated messages |
| SDK `responseMessages` | Generated messages across all model steps, without input history |
| SDK `response.messages` / `finalStep.response.messages` | The SDK's generated response messages for the final step |

Use `result.messageHistory` as the conversation state for the next turn. For streaming, use `await result.messageHistory` after consuming the stream.

`messageHistory` is Casai's field; SDK results have no field holding the whole conversation. An SDK application keeps its input messages and appends `responseMessages`, but a rendered agent prepares the new turn itself, so the application never sees it. Casai adds the field without changing SDK response fields or callback payloads. Wherever Casai stores or passes a conversation, it uses the name `messageHistory`; `messages` remains only in the SDK's own APIs.

When appending to an existing SDK conversation, use SDK `responseMessages`. It remains generated messages only, so `[...inputMessages, ...result.responseMessages]` does not duplicate the input. When the [SDK methods](#ai-sdk-agent-interface-and-ui-integration) receive a complete conversation in `prompt` or `messages`, `messageHistory` includes it once; Casai does not guess where the new turn begins.

Fixed guidance belongs in `instructions`, which apply to every call. Messages returned by a script or function prompt are appended after the history. `messageHistory` records the conversation, not the request: if a `prepareCall` hook adds example turns or trims old history before sending, the stored history still holds the whole conversation.

A terminal execution failure or abort rejects Casai `messageHistory`; text already delivered remains with the consumer. Keep prior history after such a failure. SDK result fields retain their own completion behavior. A legitimate pause for tool approval or external tool results is different: completed steps and resumable `messageHistory` remain available even when `value` has no final output. Output availability alone does not determine whether conversation state is usable.

If the model exchange completes but its final output fails schema validation, `value` fails. History remains available when the SDK exposes that completed exchange, such as on a streaming result. A generation call that rejects does not return a separate history handle.

Casai does not persist, summarize, or truncate history automatically. Store it per conversation and manage its size in your application. Preserve tool calls with their corresponding results and approval messages when selecting history for another turn.

### Render Only the New Message

Pass a new message as data in rendering context, alongside previously prepared history. Casai renders the configured template for this call and keeps the rendered prompt in the returned history:

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
  console.log(result.value);
}
```

`message` is an application-chosen template variable, not a reserved argument. Its contents are data, so text containing `{{ ... }}` is not evaluated again as template source. Only the current context is validated and prepared; earlier rendered messages pass through unchanged. Create the agent with `.asStream` for the same preparation with incremental generation, then obtain history from `await result.messageHistory`.

For a UI conversation, store the prepared `messageHistory` in the application and have the client send only the new turn's data. The SDK's complete conversation doesn't tell Casai which messages were already rendered, so don't pass it to a rendered agent. To regenerate a reply, call again with the same input and the history before that turn. To continue after tool approvals, use [`resume()`](#tool-approvals-and-continuation), which adds no turn. Applications may store original UI text separately for display.

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

console.log(description.value);
```

Replace the example URL with your own image. File parts and other supported message content also remain structured through Casai preparation. Script/function prompts can return these message arrays directly.

The model and provider determine supported media and formats. Generated files and content parts remain available on LLMAgent results. `output` controls parsed text or structured values; use ImageGenerator, Transcriber, or SpeechGenerator for their dedicated operations.

## AI SDK Agent Interface and UI Integration

LLMAgent implements the [AI SDK Agent interface](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent) through two additional methods, `.generate()` and `.stream()`. They exist for SDK compatibility: SDK helpers such as `createAgentUIStreamResponse` call them. They take the SDK's call arguments, not Casai's: the complete conversation as a literal `prompt` or `messages`, plus custom `options`, `abortSignal`, `timeout`, and callbacks. They never prepare the configured prompt, so text they receive is never rendered. `.generate()` always generates and `.stream()` always streams, whatever the component's mode, and both return full SDK results. In your own code, use the ordinary call or `.run()`.

Template, Script, and Function use native Casai contracts. They can implement operations inside a chat application's workflow, but are not directly accepted by SDK Agent UI helpers. An application can present their text or structured data through its own UI protocol; Casai does not automatically turn native values into a multipart conversation.

### Agent Properties

LLMAgent supplies these SDK compatibility properties:

| Property | Meaning |
| :--- | :--- |
| `version` | The SDK compatibility marker, currently `'agent-v1'` |
| `id` | An optional application-assigned identifier; `undefined` when omitted |
| `tools` | Registered SDK tool definitions, including argument schemas and available execution handlers; defaults to `{}` |

The model may choose tools from this map. To reuse their application implementations from coded workflows, put [callable helpers in context](#calling-tools-from-coded-components).

### Generation, Streaming, and the Chat UI

The SDK methods choose the mode themselves, so a streaming helper can use any LLMAgent:

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

`.stream()` delegates to SDK model streaming regardless of `.asStream`. `.generate()` delegates to SDK generation. Each starts one execution with the configured stopping condition; Casai retains the SDK's result fields, events, usage, and callbacks.

### What the Chat UI Uses

The chat client sends `UIMessage[]` to a server handler. The SDK helper validates the messages, converts them to `ModelMessage[]`, calls LLMAgent's `.stream({ prompt: convertedMessages, ... })`, and consumes the SDK event stream to produce assistant message parts. A raw native text or element stream is a different contract. See the [SDK UI response helper](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-agent-ui-stream-response).

**Any LLMAgent can serve this handler, including one with `stopWhen: isStepCount(1)`.** The limit counts model steps within a request, not chat turns. A single step can execute tools and emit UI tool parts, but cannot make another model call to write an answer using their results. Increase the limit when that follow-up is needed.

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

Wire the returned `Response` into your server framework and use an SDK UI client to consume it. Text, tool, reasoning, source, and file displays depend on the parts actually emitted and the application's renderers. Structured `.output` does not by itself define a chat widget.

The helper supplies the conversation as literal `prompt`, sent as written after the configured `instructions`; no Casai rendering `context` is required. SDK tools with required execution context need configured `toolsContext` entries, which the native methods use; optional tool-context entries follow their schemas' optionality. These entries are separate from rendering context and `runtimeContext`. Custom `options` are parsed by `callOptionsSchema`; undefined fields preserve configured settings, and native lifecycle observers compose with configured observers under SDK alias precedence.

#### Dynamic Instructions for Chat Requests

Put shared behavior in `instructions`. For instructions that depend on the request, use typed call options and `prepareCall` to render a Template once, while keeping the full incoming conversation intact:

```typescript
const chatInstructions = create.Template({
  template: 'Answer clearly and concisely in {{ language }}.',
  inputSchema: z.object({ language: z.string() }),
});

const localizedChat = create.LLMAgent({
  model,
  callOptionsSchema: z.object({ language: z.string() }),
  options: { language: 'English' },
  prepareCall: async ({ options, ...settings }) => ({
    ...settings,
    instructions: await chatInstructions({ language: options.language }),
  }),
});

await localizedChat.run({
  prompt: 'What is a solar panel?',
  options: { language: 'Spanish' },
});
```

The SDK UI helper can pass the same typed `options` alongside its conversation. This prepares system instructions without rewriting user, tool, approval, or media messages. For an application that renders new user turns, [separate new input from saved prepared history](#render-only-the-new-message).

## Interchanging Components in Workflows

Keep the application operation's **input and returned value** stable, then put the selected implementation in a workflow's context. LLMAgent returns an SDK result; Template returns text; Script and Function return native values. A small adapter extracts the value the workflow needs from a model result. The workflow then depends on that value contract rather than a model-specific result envelope.

### Text Replacements

A Script can call the same `summarize({ text })` operation whether its implementation uses a model or coded logic:

```typescript
const summaryInput = z.object({ text: z.string() });
const modelSummary = create.LLMAgent.withTemplate({
  model,
  inputSchema: summaryInput,
  prompt: 'Summarize in one sentence: {{ text }}',
});

const aiSummarize = async (input: z.input<typeof summaryInput>) =>
  (await modelSummary(input)).value;

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

A Template that accepts `{ text }` and returns a string can also occupy this context entry. Use a Script when the replacement needs dependencies or several operations, and a Function for JavaScript logic. The caller stays unchanged because every implementation returns the expected string. The example adapter defines complete execution. For a streaming replacement, every implementation returns a text stream: the adapter returns the streaming LLMAgent's `.value`, a Template is created with `.asStream`, and a Script or Function declares `schema: textStreamSchema()`.

### Output Schemas and Structured Replacements

Reuse one application schema, with the configuration appropriate to each implementation:

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
  (await modelAnswer(input)).value;

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

LLMAgent's SDK `output` and Script/Function's native `schema` both return schema-produced application values. A deterministic string-to-number schema therefore produces a number in either implementation. Each has one declared output-parsing boundary; Casai does not reparse SDK output. Templates stay text-only. Share `inputSchema`, helper signatures, and the application result type; SDK events, conversation history, model settings, and custom SDK options remain LLMAgent concerns.

## Cancellation, Timeouts, and Usage

Every callable component accepts per-call `abortSignal` and `timeout` through `.run()`. For example, `workflow.run({ context: { document }, abortSignal: request.signal, timeout: 10_000 })` leaves its shared configuration unchanged. **For a Script or Template, this does not yet propagate cancellation to nested LLMAgent calls: those calls may continue making requests and consuming tokens.** Interrupting the engine itself also needs upstream support.

A numeric `timeout` or the SDK timeout object's `totalMs` covers asynchronous preparation plus execution. For example, three seconds spent fetching documents with `timeout: 10_000` leaves at most seven seconds for the model. Function preparers, loaders, and async request hooks share the same deadline; a preparation timeout prevents model dispatch. SDK step/chunk/tool limits retain their own meanings. A streaming handle keeps the invocation deadline until underlying execution completes or closes, and work ignoring cancellation is not force-stopped.

LLMAgent passes invocation cancellation to the SDK and its tools. Supply a request signal or `AbortSignal.timeout(...)` per call, or call `controller.abort()` on a supplied controller. LLMAgent constructor configuration rejects `abortSignal` until configured-signal combination is supported. Function callbacks and `.withFunction` preparers receive the signal in their execution options and must forward it to `fetch`, child `.run()` calls, or other external work. Stopping display alone is not cancellation.

The coded-component invocation contract is agreed. Phase 2 implements execution options, cooperative JavaScript cancellation, and SDK/tool signal forwarding without waiting for new Cascada features. Interrupting Cascada execution and cleaning up all nested work require upstream support. Automatic signal/deadline inheritance through Script, Template, and Function calls, configured limits on every component, and stopping in-flight producers on consumer exit remain planned. See [cancellation and timeouts](docs/abort.md). Explicit root settings do not imply that nested propagation already exists.

Each LLMAgent result reports that call's token usage through the SDK's `usage` and `totalUsage` fields and `onEnd` callbacks. Usage for a whole workflow, including models called inside a Script or Template, will come from Cascada telemetry; see [future features](docs/future.md).

**Implementation status:** JavaScript stream schemas, collectors, and Function producers are planned for Phase 2a. Cascada's native stream channels and streaming renderer follow in Phase 4; automatic context propagation remains separate upstream work.

## Choosing Your Orchestration Strategy

Choose the mechanism that expresses who controls the next operation:

| Mechanism | Best suited to |
| :--- | :--- |
| JavaScript / Function | Application logic, service integration, and explicit control flow |
| Script | A workflow you define, with dependencies and structured results |
| Template | Text preparation and presentation, including calls to helpers |
| LLMAgent tools | Operations the model chooses while responding to a task |
| Decision | Routing or evaluation through a configured set of questions |
| VoiceSessionSetup | Server setup and tool execution for a browser voice conversation |

These can be combined. A Script can call an LLMAgent that uses tools; an LLMAgent tool can run a Script or another LLMAgent; a Template can format the resulting data. Keep reusable application functions in context and expose them as tools when the model should decide whether to invoke them.

## Embedding and RAG Integration

Retrieval-augmented generation (RAG) supplies relevant documents to an LLMAgent before it answers. A typical flow is:

```text
question → embedding/search → candidate documents → reranking → LLMAgent answer
```

Use Embedder to index document text and embed search queries. Your vector store or search service stores and retrieves the documents. Reranker can improve the order of retrieved candidates before they enter the prompt.

The following example assumes your application provides `searchIndex(vector)`, which returns document strings from an index built with the same embedding model:

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

console.log(answer.value);
```

You can compose the same steps inside a Script or expose bounded retrieval through a Function tool. Casai prepares and orchestrates these operations; the search service owns document storage and retrieval.

## Input and Output Validation

Use schemas at the boundary where data enters or leaves a component:

| Setting | Validates |
| :--- | :--- |
| `inputSchema` | Final configured-plus-call application input on direct and model-tool paths, excluding private dependencies |
| Script / Function `schema` | The completed workflow or callback value, including collected text/arrays |
| LLMAgent `output` | Model output through an SDK output specification |
| Tool `contextSchema` | Application-supplied tool data, validated separately and merged into the flat Casai context |
| LLMAgent `callOptionsSchema` | Application-specific SDK call options |

Every schema boundary uses its produced value: input, trusted context, output, stream element, or custom call option. Defaults, stripping, coercions, and transforms affect the invocation; Casai does not write parsed results back into shared configuration or caller context. For application input, resolve configured declared values and call/model overrides before parsing once; private configured helpers stay outside that schema. Strict/strip/passthrough govern application data, not whether a configured helper survives. Producers/configuration use schema input types; implementations/consumers use output types. See [Phase 1b](docs/agents-design.md#phase-1b-schema-parsing-and-context-isolation).

Explicit SDK `Output` and tool objects retain native interfaces, parsing, and transformations. Casai does not rewrite hidden schemas or reparse their results. Casai's own preparation and execution leave supplied context, nested data, configured values, and shared defaults unchanged; native parser behavior, including `.readonly()` freezing, is preserved as described below.

Custom schema callbacks must be **pure**: check or compute a value without changing data they receive, changing shared data, or performing external operations. This applies to validators, refinements, preprocessors, transforms, and default/catch factories. If a transform changes an object or array, return a new one. Copy any nested object you change as well; unchanged parts can stay shared:

```typescript
const profileSchema = z.object({
  profile: z.object({ name: z.string(), city: z.string() })
    .transform(profile => ({
      ...profile,
      name: profile.name.trim(),
    })),
});
// Do not assign to profile.name inside the callback.
```

Ordinary Zod object/array parsing already creates new containers, so Casai does not copy them again. Some values can still be shared, including clients, values accepted without structural parsing, and objects returned by schema defaults. Casai preserves the SDK/Zod parser's behavior: `.readonly()` can freeze a shared input or default, and the installed Zod 4 can also freeze an invalid input before reporting a validation error. Native SDK Agent has the same behavior. Casai adds no copying or schema restrictions to prevent it. To avoid freezing shared defaults, return a fresh object, such as `.default(() => ({ enabled: true }))`; create fresh nested objects too if those will be affected. Custom callbacks, including validators supplied through SDK schema interfaces, must still leave received/shared data unchanged and return replacements for changes.

Casai context schemas accept and produce objects. Use a Zod object schema for templates/scripts, or an AI SDK object schema with a validator. JSON Schema metadata alone does not supply runtime checking. Script/Function output schemas may describe primitive, array, or object results. Zod is re-exported as `z` from `casai` as well as being available from `zod`.

Configuration may supply some required fields and the call supplies the rest. Resolve those values using the existing merge rules, then validate the merged application context once:

```typescript
const welcome = create.LLMAgent.withTemplate({
  model,
  prompt: 'Welcome {{ name }} in {{ language }}.',
  inputSchema: z.object({ name: z.string(), language: z.string() }),
  context: { language: 'English' },
});

await welcome({ name: 'Ada' }); // Configured language satisfies the schema.
await welcome({ name: 'Ada', language: 'French' }); // Call-time override.
// welcome() is a type error: name is still required.
```

For example, a schema can convert a string without modifying the caller's object:

```typescript
const increment = create.Function({
  inputSchema: z.object({ count: z.string().transform(Number) }),
  execute: ({ count }) => count + 1, // count is a number here.
});

const supplied = { count: '2' };
console.log(await increment(supplied)); // 3
console.log(supplied.count); // Still the original string '2'.
```

Ordinary calls and `.run()` resolve source maps, parse final application input, and execute with the produced values plus private/trusted bindings. Do not merge raw schema-governed defaults back afterward. SDK compatibility methods and calls without an effective prompt skip rendering input; history alone does not skip a configured prompt. LLMAgent rendering context is explicitly prepared before model dispatch, rather than automatically validated by the SDK.

For actual SDK tool execution, register a thin SDK-compatible schema wrapper: it merges configured declared application defaults with model arguments, then invokes the original parser once. The advertised schema keeps fields available for overrides but removes requirements supplied by non-`undefined` configured defaults; schema defaults retain their native optional behavior. Empty arguments work when the merged input is complete. Only parsed application fields enter SDK tool-call history/UI data. Private configured helpers and trusted context are bound inside `execute`, outside recorded arguments, without reparsing. A configured declared field such as `language` is public tool input and its resolved value may be recorded; a private `db` binding is not. The original component schema and shared tool definitions stay unchanged. `_toolCallOptions` never authorizes a parse bypass.

A default factory is a function such as `.default(() => [])` that creates a fallback value. SDK/Zod conversion can evaluate pure default factories while building the tool's JSON Schema description, as well as during parsing. Do not rely on a factory running only once or only when a tool executes. Casai does not trial-parse incomplete configuration to discover fields or defaults, and metadata conversion must not supply cached invocation context. The actual call still parses its final merged input and uses that result.

Script/Function `schema` parses completed values and returns the produced result, preserving output parsing already implemented today. Stream schemas parse elements lazily in the existing consumer pass and forward parsed elements. Custom options are parsed before `prepareCall`, which receives the schema output type. Reuse SDK/Cascada parsing already performed for that same boundary rather than adding another pass. See [shared output schemas](#output-schemas-and-structured-replacements).

Context parsing and rendering failures reject before model execution. Asynchronous parsing/preparation shares one invocation deadline. Native output/element parsing adds no eager stream consumption or replay; Casai returns a wrapper only where needed to forward parsed elements. Cascada owns healthy complete returns and first-error termination of native `stream`/`tstream`; its Phase 4 schema boundary must supply parsed values without a second Casai pass. Native copying and non-mutating callback contracts replace the generic copy planner. Never claim arbitrary JavaScript or every opaque schema is automatically isolated.

Prepared inputs are checked against the selected operation: model messages for LLMAgents, text or text arrays for Embedder, audio for transcription, and so on. Binary and live-stream inputs retain their native values.

## Errors and Retries

Wrap creation and `await component(...)` in `try/catch` when handling failures. Some invalid configurations throw during creation; input preparation and generation can fail during invocation.

| Error source | How to inspect it |
| :--- | :--- |
| Invalid configuration, invalid call arguments, or Casai schema validation, including unknown approvals in `resume()` and unknown tools in `executeTool()` | `ConfigError`, exported from `casai` |
| Template or script compilation/execution | `TemplateError` or `ScriptError`; inspect `cause` for the underlying failure |
| Provider requests or structured LLMAgent output | SDK error types and their documented instance checks |
| Streaming generation or tool execution | Full-stream `error` / `tool-error` parts, callbacks, and promise/iterator failures |
| Cascada native `stream`/`tstream` failure | Cascada terminates at the first error after the valid prefix; Casai forwards it unchanged |
| Cascada complete return failure | The engine returns its poison/failure outcome instead of a partially failed object |
| Full-stream source failure | All consumers stop at that failure; recovery cannot resume a closed producer |
| No eligible final LLMAgent output, including a legitimate tool/approval pause | `NoOutputGeneratedError` from `value` access or consumption; inspect steps and history for continuation |
| Native stream producers | Iterator failures and native completion/validation errors |

For streaming, handle event errors as well as thrown errors. This example uses the full event stream so tool failures are visible alongside text:

```typescript
const controller = new AbortController();

try {
  const stream = await create.LLMAgent.asStream({ model }).run({
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

For cancellation setup and the current limits on nested propagation, see [Cancellation, Timeouts, and Usage](#cancellation-timeouts-and-usage).

`maxRetries` controls SDK request retries; it does not restart your entire Casai script or input preparation. Streaming recovery has separate SDK settings such as `streamRetries`. Raw SDK views may replay text during recovery; Casai `value` must preserve final-output identity, buffering any output whose inclusion is not yet stable. See [SDK error handling](https://ai-sdk.dev/docs/ai-sdk-core/error-handling) for retry behavior and error types. A stopped or failed stream does not guarantee a valid final `.output`.

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
// classification.value is 'question' | 'feedback' | 'other'.

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
      value: `Summary of ${topic}`,
    }),
  },
  script: `
    return { summary: summarize({ topic: topic }).value }
  `,
});

assert.deepEqual(await workflow({ topic: 'recycling' }), {
  summary: 'Summary of recycling',
});
```

To exercise the LLMAgent's full model/tool protocol, supply an AI SDK mock model through `model`; see [SDK testing](https://ai-sdk.dev/docs/ai-sdk-core/testing). Test concurrent `.run()` calls with distinct inputs when verifying invocation isolation, and consume streams in tests that assert final results or completion callbacks. Type-check TypeScript examples separately from executing them.
