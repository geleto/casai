# Casai: AI Orchestration That Writes Like a Story

> **API design draft:** This README documents the intended API, including components awaiting implementation. The [design document](docs/plan.md) tracks implementation stages, [settled contracts and remaining implementation work](docs/plan.md#design-status). [README.md](README.md) describes the implementation currently in the repository.

Casai is a TypeScript library for composing AI calls, tools, and application logic into reusable workflows. Configure a component's operation, input preparation, and validation rules, with a model when the operation needs one, then call it like a function. Components can share configuration, invoke each other, and work with the Vercel AI SDK.

**LLMAgent, Template, Script, and Function compose through callable components, context helpers, and schemas.** Keep the input and returned value of a workflow operation stable to switch between model-backed and coded implementations; see [interchanging components](#interchanging-components-in-workflows). LLMAgent also implements the AI SDK Agent interface for conversations, tools, and chat UI integration.

Use JavaScript for application logic, Cascada templates for text, and Cascada scripts for workflows that return data. Cascada resolves asynchronous values automatically and runs independent work concurrently, so a workflow can read in dependency order without manual promise coordination.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Understanding the Casai API](#understanding-the-casai-api)
  - [Common Component Contracts](#common-component-contracts)
  - [Creating and Calling Components](#creating-and-calling-components)
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

<!-- typecheck: quick-start -->
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
  inputSchema: z.object({ topic: z.string(), audience: z.string() }),
});

const result = await explain({ topic: 'solar panels' });
console.log(result.value);
```

The `.withTemplate` modifier renders the prompt using the call's input and configured context. `inputSchema` validates caller data merged over schema-declared configured defaults. Undeclared configured bindings, such as `audience` here, remain available to the template but stay outside that parser and cannot be overridden by callers. `.value` contains the generated text. The result also includes the SDK's usage, steps, and metadata.

Select an output schema when you need typed data:

<!-- typecheck: quick-extract -->
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

<!-- typecheck: quick-workflow -->
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
| [Template](#template) | Render a Cascada template | ? | [Cascada templates](https://github.com/geleto/cascada/blob/master/docs/cascada/template.md) |
| [Script](#script) | Execute a Cascada workflow | Script and context → returned value, or a stream | ? |
| [Function](#function) | Wrap JavaScript logic | Arguments/context → returned value, or the callback's stream | — |
| [LLMAgent](#llmagent) | Generate or stream text/data; optionally loop with tools | Prompt/messages and application context → the full SDK result, with `.value` for [final application output](#llmagent-results) | [generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text), [streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) |
| [Decision](#decision) | Answer choice, boolean, and score questions | `state`, configured `questions` → [.answers](https://ai-sdk.dev/docs/ai-sdk-core/decisions#question-types) | [Decisions](https://ai-sdk.dev/docs/ai-sdk-core/decisions) |
| [Embedder](#embedder) | Embed one or many texts | String or string array → [.embedding](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed#returns) or [.embeddings](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many#returns) | [Embeddings](https://ai-sdk.dev/docs/ai-sdk-core/embeddings) |
| [Reranker](#reranker) | Rank candidates for a query | `query`, `documents` → [.ranking, .rerankedDocuments](https://ai-sdk.dev/docs/reference/ai-sdk-core/rerank#returns) | [Reranking](https://ai-sdk.dev/docs/ai-sdk-core/reranking) |
| [ImageGenerator](#imagegenerator) | Generate or edit images | `prompt` and optional editing inputs → [.images](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-image#returns) | [Images](https://ai-sdk.dev/docs/ai-sdk-core/image-generation) |
| [Transcriber](#transcriber) | Transcribe a recording | `audio` → [.text, .segments](https://ai-sdk.dev/docs/reference/ai-sdk-core/transcribe#returns) | [Transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription) |
| [StreamingTranscriber](#streamingtranscriber) | Transcribe live audio | Audio stream and format → [.fullStream, final .text](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-transcribe#returns) | [Streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription) |
| [SpeechGenerator](#speechgenerator) | Generate spoken audio | `text` → [.audio](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-speech#returns) | [Speech](https://ai-sdk.dev/docs/ai-sdk-core/speech) |
| [VoiceSessionSetup](#voicesessionsetup) | Prepare a browser voice session and execute server tools | Instructions/context → session setup; separate `executeTool()` calls | [Realtime](https://ai-sdk.dev/docs/ai-sdk-core/realtime) |

Decision, StreamingTranscriber, and VoiceSessionSetup wrap SDK features that are still experimental, so Casai exports them as `Experimental_Decision`, `Experimental_StreamingTranscriber`, and `Experimental_VoiceSessionSetup` until those features are stable.

### Common Component Contracts

LLMAgent, Template, Script, and Function share configuration, application input and composition rules. Their output contracts reflect the operation each performs. Specialized model components use the same configuration conventions with the native inputs and results listed in the [overview](#component-overview).

#### Shared Configuration

Pass a flat settings object to a factory. The resulting component exposes its resolved reusable settings as `.config`; a [Config](#config) or compatible parent component can supply inherited settings. Supported `.run()` overrides apply to one invocation.

| Configuration part | Purpose |
| :--- | :--- |
| `context` | Application defaults and private dependencies, such as helpers or clients. Call data combines with these to form one prepared context for the body, prompt preparer and hooks |
| `inputSchema` | The application input contract. Select declared public defaults, merge call data, then parse before execution; private dependencies stay outside this schema |
| Source / implementation | The component's main property: `template`, `script`, Function `execute`, or LLMAgent `prompt` with its selected modifier. Other operations use their [own input property](#input-preparation-by-component) |
| Output contract | Describes the produced application value, using `schema`, SDK `output`, or an implicit/native contract as shown [below](#returned-values) |
| Operation settings | Model, tool, rendering and execution controls supported by that component |

`inputSchema` is optional for ordinary components. Its declared fields identify public input and which configured values callers may override. Merge those defaults with call input, parse once, then assemble parsed application values with private bindings. Calls/configuration use schema input types; implementations receive parsed types. Configured defaults can satisfy required fields. With no input schema, configured names remain private, while ordinary calls can supply other application fields. See [input and output validation](#input-and-output-validation) for transforms, extra fields and collision protection.

Context is available on every LLMAgent form, including literal text with no hooks. It need only be supplied when required input remains after defaults. Template and Script use it as their execution context; Function receives it as its callback argument; LLMAgent shares it between prompt preparation and [request/step hooks](#application-context-and-hooks). Schemas and context settings can be inherited through the same configuration rules.

There is one application context and one input schema. Native SDK Agent entry points spell the same call input `options`; Casai configuration and `.run()` use `context`. Tools additionally require a declared public input schema and may use `toolContextSchema` for the separate [trusted tool-context boundary](#tool-execution-context).

#### Returned Values

Ordinary calls and `.run()` return promises. After `await`, Template, Script and Function give you the application value itself. LLMAgent gives you an SDK result containing the application output in `.value`.

| Component | Output configuration | What `await component(...)` returns |
| :--- | :--- | :--- |
| Template | Implicit text; no output schema | A rendered string, or a text stream with `.asStream` |
| Script / Function | Optional `schema` | The schema's parsed output; without a schema, the program/callback's returned value |
| LLMAgent | SDK `output`, defaulting to text | The full SDK result, with `.value`, history and native SDK fields; see [LLMAgent results](#llmagent-results) |
| Other model components | The operation's native output contract | Its native result, such as embeddings, images or transcription data; see the [component overview](#component-overview) |

The actual output-setting names are `schema` for Script/Function and `output` for LLMAgent; there is no shared `outputSchema` property. A schema's returned value is used, including defaults, stripping and transforms. Script/Function producers return schema input; their callers receive schema output directly, without an added `.value` envelope.

A stream schema returns a stream whose elements are parsed as consumed; awaiting the component does not collect it or validate the entire stream in advance. See [stream schemas](#stream-schemas). LLMAgent's `.value` can be a completed value, a promise or a text stream depending on `output` and `.asStream`; the [agent result table](#llmagent-results) defines those cases and the alternatives such as `textStream`.

To interchange model and coded implementations in a workflow, have a small adapter extract the model result's application value. The workflow can then consume the same value type from either implementation; see [replacement examples](#interchanging-components-in-workflows).

#### Shared Execution Rules

- **Calls and composition:** Every callable has `.run()` for named inputs and supported execution settings, with the same result contract as its ordinary call. Put components or application functions in context to [call them from workflows](#calling-tools-from-coded-components).
- **Invocation isolation:** Casai's merging, preparation and execution leave shared configuration and caller data intact. Derive a component or use call overrides to select different settings.
- **Effects:** Schema callbacks stay pure. Component bodies may operate on authorized application state or perform external effects; sequence effectful Cascada calls with `!`. Independent invocations need application-level coordination for shared state.
- **Modifier inheritance:** Every component inherits its parent's modifiers, including through `Config`: source mode, `.asStream` and `.asTool` where supported. An explicit source modifier replaces the inherited source mode; a base factory preserves it. Use `.withText`, `.withTemplate` or `.withScript` to return to inline source. Streaming and tool mode stay enabled; no reverse modifiers are provided. Unsupported inherited settings are rejected, not silently discarded.
- **Streaming:** LLMAgent and Template inherit streaming mode, and `.asStream` enables it. Script/Function declare stream output through `schema`; independently invoked components keep their own modes. See [streaming](#streaming).
- **Tool adaptation:** `.asTool` exposes completed application output to a model, collecting declared finite streams where necessary. Direct calls retain their normal result and mode. See [using components as tools](#using-components-as-tools).

Template, Script and Function keep these native value contracts. LLMAgent's non-tool forms additionally implement the [SDK Agent and chat UI protocol](#ai-sdk-agent-interface-and-ui-integration).

### Creating and Calling Components

Pass reusable settings to a factory, then supply task-specific input to the component it returns:

<!-- typecheck: configured-prompt -->
```typescript
const writer = create.LLMAgent({ model, prompt: 'Write a short welcome message.' });

const welcome = await writer();
console.log(welcome.value);
const invitation = await writer('Write a short invitation to a community dinner.');
```

Each component has a **main property**, the input its operation works on, such as an LLMAgent's `prompt` or a Template's `template`. You set it when creating the component, and a call can replace it for one invocation. The component's [input modifier](#adding-capabilities-with-modifiers) sets its type, never its name: on a plain LLMAgent, `prompt` is literal text or model messages; with `.withTemplate`, it is a template; with `.loadsTemplate`, a template's name. A replacement has the same type as the configured value.

The ordinary call, `component(...)`, takes inputs rather than execution settings. A plain component takes its main input first, including object or array inputs. A plain LLMAgent takes `(prompt, context?, messageHistory?)`, with context omitted before history when no call data is required; the prompt can be a string or message array. Rendered forms take their source, context, and any secondary input in that order, omitting source to use the configured one. Every callable component has `.run({ ... })` for named inputs and its supported execution settings. Native SDK abort/timeout controls and explicit cooperative signals on coded-component `.run()` remain available. Script/Template timeouts and inherited end times wait for Phase 7 and Cascada async call context; native engine abort is separate.

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

Calls return promises; the shared [returned-value reference](#returned-values) explains direct values, streams and SDK result objects.

A Template, for example, accepts a one-off template before its context:

<!-- typecheck: template-defaults -->
```typescript
const greeting = create.Template({
  template: 'Hello {{ name }}!',
  context: { name: 'World' },
  inputSchema: z.object({ name: z.string() }),
});

console.log(await greeting());                        // Hello World!
console.log(await greeting({ name: 'Ada' }));         // Hello Ada!
console.log(await greeting('Welcome {{ name }}.', { name: 'Ada' }));
```

An object supplied as rendering context is data. For example, a field named `prompt` inside that object is a template variable; it does not override the component's prompt setting. There is no `input` wrapper around ordinary calls. Put user data in the context, never in a rendered component's main property, where it would run as template or script code.

If a model-derived value might be either an object or a string, put it in an explicitly declared data field: `component({ payload: modelValue })` or `.run({ context: { payload: modelValue } })`, with an input schema accepting that field's data. Passing `component(modelValue)` to a rendered component would interpret a string as source. Context values are not evaluated again as source, even when they contain template syntax or fields named `prompt`, `template`, or `script`.

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

Use a template when the input is text with variables, helper calls, or includes. Configured `context` supplies private bindings and explicitly declared public defaults. `inputSchema` parses caller data merged over those public defaults; other configured bindings stay outside validation. Here `language` is a private configured binding, so callers supply `text` but cannot override `language`:

<!-- typecheck: template-prompt -->
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

Use a script for a preparation workflow, or a JavaScript function for logic such as formatting, fetching data, or calling an API. The function may be asynchronous. It receives the prepared context; the [execution-metadata API](#tool-execution-context) exposes options such as `abortSignal` through that context's `_toolOptions` property:

<!-- typecheck: function-prompt -->
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

<!-- typecheck: async-prompt -->
```typescript
const summarizeDocument = create.LLMAgent.withFunction({
  model,
  inputSchema: z.object({ documentId: z.string() }),
  prompt: async ({ documentId, _toolOptions: { abortSignal } }) => {
    const response = await fetch(`https://example.com/documents/${encodeURIComponent(documentId)}`, {
      signal: abortSignal ?? null,
    });
    if (!response.ok) throw new Error(`Document request failed: ${response.status}`);
    return `Summarize this document: ${await response.text()}`;
  },
});
```

The same `context._toolOptions` property is available to specialized function preparers, such as those opening audio. Casai checks cancellation before starting the backend; external work must cooperate with the signal.

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
| [Template](#template) | ❌ | ? | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| [Script](#script) | ❌ | ❌ | ? | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
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

Use the order source, context, history, omitting configured sources and unneeded context. A first-position string or model-message array on a plain agent is always a new prompt. These forms apply with or without streaming mode; required context fields must be supplied unless defaults satisfy them.

| Component form | Ordinary call | Meaning |
| :--- | :--- | :--- |
| Plain | `agent()` | Use the configured prompt |
| Plain | `agent('New prompt')` | Supply new prompt text |
| Plain | `agent(newMessages)` | Supply one or more new prompt messages |
| Plain | `agent('New prompt', messageHistory)` | Append prompt text after history |
| Plain | `agent(newMessages, messageHistory)` | Append new messages after history |
| Plain | `agent(prompt, context, messageHistory?)` | Supply a literal prompt and application data |
| Plain or loaded text | `agent(context, messageHistory?)` | Use the configured prompt/resource with application data |
| Loaded text | `agent()` | Load the configured resource name as literal text |
| Loaded text | `agent(resourceName, context?, messageHistory?)` | Load a one-off resource as literal text; context may be omitted before history |
| Template/script, including loaded forms | `agent(context)` | Prepare the configured source |
| Template/script, including loaded forms | `agent(context, messageHistory)` | Prepare a new turn after history |
| Template/script, including loaded forms | `agent(source, context, messageHistory?)` | Prepare a one-off source |
| Function prompt | `agent(context, messageHistory?)` | Call the configured prompt function |
| Function prompt | `agent(promptFunction, context, messageHistory?)` | Call a one-off prompt function |

There is no positional history-only form. Message arrays carry no marker that distinguishes history from new messages: even a variable named `messageHistory` is interpreted as prompt messages when passed first to a plain agent. `agent.run({ messageHistory })` uses the configured prompt when one exists, including preparation and input validation; only an agent without an effective prompt sends history without adding a new turn. Fixed instructions, context validation, and request hooks still apply.

Literal and loaded-text agents accept context even without preparation hooks. Their text stays literal; context supplies hook data and follows the same input validation as rendered forms. On `.loadsText`, a lone array is invalid; use `.run({ messageHistory })` with a configured resource, optionally supplying `context` or a replacement `prompt: resourceName`.

Ordinary calls and `.run()` resolve inputs in the same way: supplied values override configuration, and an omitted or undefined prompt retains the configured prompt. Adding history, execution settings, or an empty `context` does not select a different operation. `messageHistory: []` means no earlier messages and still runs a configured prompt. Every effective prompt string, including `''`, adds a user message regardless of history; an absent prompt adds none. Empty text is not a portable history-only sentinel: [Anthropic text blocks require nonempty text](https://platform.claude.com/docs/en/api/messages/create). For history-only continuation, use no effective prompt, or have a script/function preparer return an empty message array (`[]`), rather than an empty string. The SDK rejects the call if its final conversation is still empty after `prepareCall`.

From Cascada, keyword arguments supply the named input/context object; a rendered `agent(messageHistory, topic='recycling')` normalizes to JavaScript `agent({ topic: 'recycling' }, messageHistory)`. Keywords must come last in Cascada, so this marked form is an explicit exception to positional ordering. On rendered/loaded forms, JavaScript `agent(messageHistory, context)` and the equivalent unmarked Cascada call are invalid; use context before history. On a plain agent, that first array is new prompt messages. A lone array is never inferred to be history.

### Named Arguments and Per-Call Overrides

The shorthand caller is the primary API and retains its input forms. Every callable component also has `.run({ ... })` for named inputs and permitted per-call settings, returning the same result in the same mode as the ordinary call. It returns a promise; for streaming, awaiting it obtains the live handle without waiting for completion.

Anything required that the shorthand cannot supply must be satisfied by resolved configuration, including inherited values. For example, registered tools with required trusted context need configured `toolsContext` entries. `.run()` can override that context for one call; it does not make an incomplete finished component usable. Reusable `Config` fragments may remain incomplete.

Template accepts `.run({ template, context, toolsContext, abortSignal })`, Script accepts `.run({ script, context, toolsContext, abortSignal })`, and Function accepts `.run({ context, toolsContext, abortSignal })`. Omit a source to use its configured value. `toolsContext` supplies request-specific application data to registered tools; it merges by tool name, replacing each supplied entry as a whole. It does not change tool definitions or schemas. Function's `execute` callback and schemas remain fixed. A signal is checked before starting and forwarded to cooperative callbacks and injected registered tools. It does not interrupt rendering or automatically reach arbitrary functions/components supplied in context. Script/Template and Function timeouts wait for [Phase 7](docs/plan.md#phase-7-async-call-context-and-deadlines) and Cascada async call context. Native engine abort is a separate enhancement.

<!-- typecheck: run-overrides -->
```typescript
const detailed = await explain.run({
  prompt: 'Explain {{ topic }} with one practical example for {{ audience }}.',
  context: { topic: 'solar panels', audience: 'a homeowner' },
  maxOutputTokens: 600,
});
```

`explain` is a `.withTemplate` agent, so the call-time `prompt` is a template, like the configured one.

The `.run()` object is an application-authored settings envelope. Put application/model data inside `context`; do not pass or spread that data as the settings object. Template, Script, and Function reject unknown top-level keys with `ValidationError`, while SDK settings retain SDK validation. This catches many mistaken calls, but recognized names still select their documented behavior: `.run({ template: text })` on Template executes `text` as source. It is not a safe way to forward model output. The restrictions on settings do not restrict unrelated keys inside `context`; its input schema and private-binding boundary apply there.

| LLMAgent field | Meaning |
| :--- | :--- |
| `prompt` | The new turn, replacing the configured prompt. On a plain agent, literal text or model messages; on a rendered agent, a template, script, function, or resource name |
| `context` | Application input shared by prompt preparation and [request/step hooks](#application-context-and-hooks), including with literal prompts |
| `messageHistory` | The conversation so far, placed before the new turn |
| `approvals`, `toolResults` | Decisions and external tool results that [continue](#tool-approvals-and-continuation) a conversation ending in pending tool calls; used with `messageHistory` |
| Other settings | Model settings, tools, callbacks, `stopWhen`, cancellation, and other supported per-call settings |

Configured `instructions` apply to every call. The [SDK methods](#ai-sdk-agent-interface-and-ui-integration) `.generate()` and `.stream()` take the SDK's own arguments instead, with a literal conversation.

At the top-level invocation/settings layer, `undefined` counts as not supplied and leaves the configured value in place. Inside a supplied `context` object, an own property set to `undefined` remains an explicit shallow override, just like any other value. With configured `name: 'Ada'` and a schema field `z.string().default('x')`, passing `{ name: undefined }` therefore produces `'x'`; omitting `name` retains `'Ada'`. This preserves the existing merge rules. LLMAgent lifecycle observers compose with configured observers; control hooks such as `prepareCall`, `prepareStep`, and `onError` replace the configured callback. See [callback policies](#lifecycle-callbacks).

Overrides are isolated: concurrent calls can use different inputs, settings, and history without Casai changing shared components or data. Native parsers such as Zod copy declared containers; opaque references and unchanged branches may remain shared. Casai adds no generic copy planner or deep clone of models, helpers, clients, promises, or streams. Schema callbacks must be pure. Component implementations may deliberately mutate authorized state held in context objects or closures; sequence effectful Cascada calls with `!` and coordinate shared state across independent runs in the host. Configuration settings stay fixed by contract. See [state and snapshot behavior](README.md#invocation-metadata-and-effects); no freeze or proxy is added.

Output contracts, schemas, the Function `execute` implementation, renderer setup, and LLMAgent `id` stay fixed. Derive another component to change them. Agent `id` is metadata, not a model-call setting or a `.run()` override.

Specialized components follow the same pattern. Their ordinary call takes the main property by position: `route('My order arrived damaged.')`, `reranker(question, candidates)`, `illustrator('A watercolor workshop')`, `transcriber(recordedAudio)`, or `speaker('Your replacement is on its way.')`. With an input modifier, it also takes the context the main property is prepared with. `.run()` takes the SDK's input fields and settings by name, such as `reranker.run({ query, documents, topN: 3 })`. `VoiceSessionSetup` has a [session lifecycle](#voicesessionsetup).

### Streaming

A component's mode is chosen when it is created and inherited by derived components. To choose complete or streaming mode independently for several variants, derive them from a shared `Config` rather than from a streaming component. `.asStream` enables streaming on LLMAgent or Template; deriving through the base factory does not disable it. Script and Function return what their schema declares, and StreamingTranscriber always streams. Each invocation executes once. Calling an independent nested component preserves that component's own mode.

| Component | Complete | Streaming |
| :--- | :--- | :--- |
| LLMAgent | SDK `generateText` result | With `.asStream`: SDK `streamText` result |
| Template | Rendered string | With `.asStream`: text stream from Cascada's future `renderStringStream` |
| Script | Returns a value | Returns a JavaScript async iterable declared by a [stream schema](#stream-schemas); native `stream`/`tstream` channels follow in Phase 6 |
| Function | `execute` returns a value | `execute` returns a stream, declared by a stream schema |

To enable streaming on an LLMAgent or Template in complete mode, derive a streaming component from it: `create.LLMAgent.asStream({}, writer)`.

Native streams are async iterables with two runtime kinds: `tstream` for text chunks and `stream` for complete elements. Their schemas preserve that distinction across JavaScript and Cascada, including empty streams. A Template always produces `tstream` when streaming. LLMAgent's native output view contains only final application output, using the appropriate kind; unknown tool-loop finality may delay delivery. Its SDK fields retain their separate contracts. See [final-answer streaming](#final-answer-streaming-in-tool-loops).

Streams are consumed as they are read. Passing a stream to a component allows it to consume the stream; returning that same source does not restore consumed items. It may have unread items, be exhausted, or have been closed. A Script, Template, or Function returning a stream adds no replay guarantee. Sharing must be explicitly supplied by the underlying source or a sharing helper. LLMAgent's [SDK result getters](#consuming-a-stream) retain their separate ability to create fresh views of one execution.

Two helpers exported from `casai` collect a native stream into its complete value: `collectTextStream(stream)` joins text chunks into one string, and `collectStream(stream)` collects elements into an array. Choose the one that matches the stream; both accept any async iterable. A streaming LLMAgent's default-text `.value` uses `collectTextStream`; an explicit SDK `Output` instead gives a promised final `.value`, which you await. In a Script, assigning a `stream` or `tstream` channel takes a snapshot instead: the elements emitted before the assignment in source order, as an array or a string.

Nested calls keep their declared contracts. A Template forwards a child's stream when it streams, and collects it when it renders complete text. See [composition](#streaming-through-templates-and-scripts).

**Implementation stages:** JavaScript stream kinds, schemas, collectors, Function producers, and Script returns of JavaScript async iterables belong to [Phase 2](docs/plan.md#coded-component-conventions-and-javascript-streams); LLMAgent output streams follow in Phase 3. The installed Cascada engine already shares async iteration between its loops by default. This internal behavior does not make streams returned to JavaScript replayable. [Phase 6](docs/plan.md#phase-6-cascada-streaming-integration) integrates Cascada's future `renderStringStream`, native `stream`/`tstream` channels with live return, runtime kinds, source-order snapshots, validation, and native stream error behavior.

Cascada's default loop sharing also spans renders that receive the same source object. A later call can replay earlier items and repeat the loop body's external operations. Supply a fresh source for independent runs, or use `renderOptions: { replayAsyncIterables: false }` for native loop consumption. The source owner can dispose shared history through `makeSharedIterable(source).dispose()`; disposal permanently ends replay for that source rather than resetting it. Casai does not automatically dispose sources when a render ends, since another reader or returned stream may still use them.

Cascada owns error handling for its complete returns and native `stream`/`tstream` types. A complete value is healthy or a poison/failure outcome. A native stream delivers its valid prefix and terminates at its first error; neither the failed nor later items are delivered. Casai forwards this behavior without scanning partially failed objects or choosing different stream semantics for different consumers.

Collectors and tool adapters propagate stream failure instead of returning successful partial results. Casai forwards supported cancellation and closure; Cascada and the SDK own their scheduling and shared-source cleanup. A returned live stream remains usable after the component call resolves. See the [stream lifecycle design](docs/plan.md#lifecycle).

Phase 2 also plans `toReadableStream(source)` for web/SDK response helpers and a re-export of Cascada's `makeSharedIterable`. Conversion consumes one iterator; it adds no validation, replay or new component execution. For several readers of a single-use source, wrap the **validated** stream once with `makeSharedIterable`, then convert or collect that shared view. The native helper retains the sequence until owner disposal; cancelling a reader does not dispose the shared source, and disposal is permanent. This is explicit opt-in sharing, not a replay guarantee for ordinary results.

#### Stream Schemas

Zod has no stream type, so `casai` exports two schema constructors, `textStreamSchema()` and `streamSchema()`, for the `schema` of a Script or Function that returns a stream:

| Schema | The program returns | Collect with |
| :--- | :--- | :--- |
| `textStreamSchema()` | `tstream`: an async iterable of text chunks | `collectTextStream()`: the joined string, `''` when empty |
| `streamSchema(elementSchema)` | `stream`: an async iterable of complete elements | `collectStream()`: the elements in order, `[]` when empty |

The schema declares whether strings are text chunks or elements of a list and preserves that kind at runtime. It checks a Function producer's TypeScript return type and a Script's returned stream at runtime. Plain JavaScript async iterables returned by Function or Script acquire their declared kind at the schema boundary in Phase 2, with the same lazy validation and finite-tool collection. Native Script channels follow in Phase 6 and retain their declared `stream` or `tstream` kind; a configured schema must agree. Native streams do not publish partial object updates.

Elements are parsed lazily during consumption: producer, schema parser, then caller. Where needed, one wrapper reads each producer element once and forwards the parsed element, including transformations. Neither a new wrapper nor a new element duplicates producer execution, starts another source reader, or retains replay history. Preparing a wrapper reads nothing. Collection uses that view without reparsing. Reuse parsing already done by the SDK or Cascada for the same contract.

Text schemas parse string chunks; element schemas parse complete healthy elements and forward their schema-produced values. Failures stop JavaScript iteration after the valid prefix. Whole-result checks finish only at completion; guaranteeing whole-stream validity before exposing anything requires explicit collection.

Each component applies its declared schema at its own boundary. When SDK/Cascada performs that same boundary's parsing, reuse its parsed values. A Function forwarding a native stream through a newly declared `streamSchema(...)` still applies its own schema: `z.number().positive()` must reject a forwarded `-1`, and two components each declaring a number-increment transform apply it once each. Forwarding adapters and collectors with no new schema add no validation pass, producer, or replay history.

Stream schemas describe only a whole returned stream; a JavaScript stream nested in a returned object is an opaque value whose elements Casai doesn't validate.

`.asTool` collects finite native streams into a completed result: join `tstream` chunks or collect `stream` elements. The direct component call still returns its stream. The same rule applies to a streaming Template. Only a root stream is collected: a result that contains streams inside an object is returned as is, so a component used as a tool must produce a tool-suitable result.

Ordinary Function/Script calls and `.run()` may also return plain JavaScript async iterables without a stream schema, including through an opaque ordinary output schema. Those values have no declared Casai stream kind. When used as a tool, a root async iterable requires `textStreamSchema()` or `streamSchema(elementSchema)`; an undeclared one fails with `ConfigError` without acquiring or reading its iterator. Where retained types prove that result, `.asTool` rejects it at type-checking time. Nested iterables remain opaque.

LLMAgent uses SDK `Output.text()` or `Output.array({ element })`, with its SDK validation and result semantics. Its `partialOutputStream` remains available for compatibility.

## Configuration Management

### Config

`Config` groups the [shared configuration properties](#shared-configuration) and compatible operation settings for reuse. Pass it as the second factory argument to inherit them:

<!-- typecheck: config-inheritance -->
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

A `Config` can be partial. Children supply fixed configuration requirements; the ordinary call supplies application inputs it accepts, such as an unconfigured source or required context fields. A finished callable must already have required settings its shorthand cannot supply, such as registered-tool context. `.run()` overrides settings for one invocation. Components can inherit from compatible components, using their original `.config` rather than projected SDK tool properties. Local settings take precedence according to these rules:

| Property | Inheritance behavior |
| :--- | :--- |
| `context`, `filters`, `tools`, `toolsContext` | Merge by key; a child entry replaces the same parent entry |
| `loader` | Try child loaders first; `raceParent(...)` tries both together and `overrideParent(...)` uses only the child. See [combining loaders](#combining-loaders). |
| Streaming mode on LLMAgent/Template | Inherit from the parent; `.asStream` enables it and no modifier disables it |
| Other properties, including `model`, `prompt`, schemas, `output`, `renderOptions`, and `providerOptions` | Replace the whole value |

Key merging is shallow. A child `context: { settings: { language: 'French' } }` replaces the entire inherited `settings` value. A `toolsContext` entry similarly replaces that tool's whole context value.

Omitting a property inherits it. Explicit `undefined` clears ordinary replacement properties. For merged maps, an omitted, empty, or `undefined` whole map retains inherited entries; an explicitly `undefined` entry replaces that entry. Loaders have [separate rules](#combining-loaders). These rules apply to configuration inheritance; in call-time arguments, `undefined` means not supplied.

Tool definitions merge only by tool name: a supplied definition replaces the whole inherited definition, never its individual fields. A tool entry set to `undefined` or `null` removes that tool after resolution. For example, `tools: { search: undefined }` removes inherited `search` while retaining other tools. Remove cleared entries before exposing the effective SDK tool registry or passing it to the SDK; infer tool names and required tool context from that same effective registry. This is a tool-registry rule, not a reason to remove ordinary null/undefined application data.

Keep shared fragments compatible with their consumers. A context-only Config can be shared by a Script and an LLMAgent; language-model settings require an appropriate model component. Source/implementation and output settings follow the [shared configuration and return contracts](#common-component-contracts). Incompatible inherited properties are rejected along with incompatible local ones.

### Inspecting Configuration

`Config` and every callable component, including `Function` and tool forms, expose resolved configuration through `.config`:

<!-- typecheck: config-inspection -->
```typescript
console.log(shortSummarizer.config.maxOutputTokens); // 150
console.log(shortSummarizer.config.context);         // { language: 'English' }
```

`.config` contains original schemas and the unwrapped implementation callback, including `.config.execute` on Function. Tool forms expose derived SDK-required properties on the callable: their public `execute` is the SDK tool entry, while `.config.execute` remains the implementation used by inheritance. Use inheritance or per-call settings instead of mutating a shared component. Set `debug: true` for configuration and invocation diagnostics.

## The Casai Components

The following sections cover creating and calling each component and reading its result. [Config](#config) supplies shared settings. Choose a model suited to the operation: a language model for LLMAgents, an embedding model for Embedder, and the corresponding provider model for other AI operations.

The shared [configuration properties](#shared-configuration), [returned values](#returned-values) and [execution rules](#shared-execution-rules) apply throughout these examples. The sections below focus on each component's operation and supported capabilities.

### Template

`Template` renders text with Cascada. Use it for prompts, reports, messages, or presentation without necessarily making a model call.

<!-- typecheck: template -->
```typescript
const receipt = create.Template({
  template: 'Order {{ orderId }} contains {{ count }} items.',
  inputSchema: z.object({ orderId: z.string(), count: z.number() }),
});

const text = await receipt({ orderId: 'A123', count: 3 });
console.log(text);
```

The main property is `template`. Call with context, or with a one-off template followed by context. Cascada resolves asynchronous context helpers during rendering; see [context in templates and scripts](#context).

For a file or named resource, use `.loadsTemplate`:

<!-- typecheck: loaded-template -->
```typescript
import { FileSystemLoader } from 'casai';

const report = create.Template.loadsTemplate({
  loader: new FileSystemLoader('./templates'),
  template: 'report.njk',
});

console.log(await report({ title: 'Weekly report' }));
```

In this form, a one-off `template` is another resource name. `.asTool` and `.loadsTemplate.asTool` expose the rendered string as a tool result. Standalone templates default to no HTML escaping; set `renderOptions: { autoescape: true }` for HTML output.

#### Streaming a Template

Create a Template with `.asStream` to receive its text as it renders, from Cascada's future `renderStringStream`. Children that should stream into it are also created with `.asStream`; the same Template source collects or forwards their text:

<!-- typecheck-skip: phase-6 -->
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

<!-- typecheck: script -->
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

The main property is `script`. Call with context, or with a one-off script followed by context. Use `return` for strings, numbers, objects, arrays, or other supported workflow results. Output validation follows the shared [returned-value rules](#returned-values).

`.loadsScript` loads a named script through a configured loader. `.asTool` and `.loadsScript.asTool` expose the workflow as a tool; `Script.loadsScriptAsTool` is an alias for `Script.loadsScript.asTool`. Both inline and loaded scripts can call helpers or components from context.

A Script streams by returning a `stream` or `tstream` channel, a **future Cascada capability**. This example declares an element stream with a [stream schema](#stream-schemas):

<!-- typecheck: script-stream -->
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

Returning the channel returns the live stream; `titles.snapshot()` returns a completed array. Elements are parsed lazily before delivery, forwarding their schema-produced values, and Cascada terminates the native stream at its first error after any valid prefix. `collectStream(await guideTitles(...))` collects the array or propagates failure. Text output uses a distinct `tstream` channel with `textStreamSchema()` and collects into a string. Assigning `titles` takes a snapshot of the elements emitted before that assignment in source order. An ordinary output schema validates the resulting array/string; assigning a JavaScript stream retains its reference without collecting it. Live channel return and these semantics require [upstream work](docs/plan.md#phase-6-cascada-streaming-integration).

See [Cascada script documentation](https://geleto.github.io/cascada-script/#/) for language syntax and concurrency, and [composition examples](#using-components-in-templates-and-scripts) below.

### Function

`Function` wraps JavaScript logic with reusable configuration and validation. Use it for application services, transformations, or SDK tools.

<!-- typecheck: function -->
```typescript
const normalize = create.Function({
  inputSchema: z.object({ text: z.string() }),
  schema: z.string(),
  execute: ({ text }) => text.trim().toLowerCase(),
});

console.log(await normalize({ text: '  HELLO  ' })); // hello
```

`execute` may be synchronous or asynchronous; the shared [input](#shared-configuration) and [output](#returned-values) rules apply. Without `inputSchema`, ordinary arguments beyond the configured private names are inferred from the callback. Declare intentional public overrides of configured fields in `inputSchema`.

A Function can inherit from a `Config` or another Function. If a child changes schemas or context incompatibly, provide an `execute` callback that matches the final configuration. Use `.asTool` to let an LLMAgent call the function; see [tools](#using-components-as-tools) for execution context and validation behavior.

#### Streaming from a Function

A Function streams when `execute` returns an async iterable, such as an async generator, and its `schema` is a [stream schema](#stream-schemas):

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

TypeScript requires `execute` to produce a stream accepted by its schema: `textStreamSchema()` accepts string chunks and `streamSchema(elementSchema)` accepts that element schema's input type. The caller receives parsed elements of its output type. One lazy wrapper applies the schema in the existing consumption pass with one reader and no duplicate producer. The callback runs once and needs no mode flag. Forwarding an input stream retains its current consumption state rather than making it fresh again.

To forward a streaming LLMAgent's default-text output, return its `.value`: `execute: async ({ topic }) => (await liveWriter({ topic })).value` with `schema: textStreamSchema()`. With an explicit SDK `Output`, `.value` is a promise; the same async function returns its completed parsed value, so use an ordinary matching output schema rather than a stream schema. Both paths retain final-output selection and failure checks. The SDK's `textStream` instead includes text across steps and omits error event parts. Full SDK event streams and transcription events are different protocols.

The callback receives one flat context containing schema-produced application values, private configured dependencies, and separately parsed [tool-context fields](#tool-execution-context). The `_toolOptions` property holds execution metadata, including cancellation. `.asTool` collects a finite returned stream into a completed tool result; it does not send intermediate stream values as SDK preliminary UI results. Use an explicit native SDK tool when that progress protocol is needed.

### LLMAgent

`LLMAgent` generates a complete language-model result, or streams it when created with [`.asStream`](#streaming-with-asstream). Use it for writing, extraction, classification, image understanding, or tasks involving tools. Text is the default output, and one model step is the default stopping condition.

<!-- typecheck: complete -->
```typescript
const writer = create.LLMAgent({ model });
const answer = await writer('Explain battery recycling briefly.');

console.log(answer.value); // Parsed output; a string by default.
console.log(answer.text);   // The SDK text accessor is also available.
```

Plain calls accept prompt text or model messages; rendered forms accept context. All seven input modifiers are supported. `.run()` accepts [named inputs and per-call settings](#named-arguments-and-per-call-overrides).

Non-tool LLMAgents implement the SDK Agent interface directly; `.asTool` forms implement the SDK Tool interface. To replace a model operation with coded logic inside a workflow, adapt the SDK result to the workflow's [application value contract](#interchanging-components-in-workflows).

#### Structured Output

Set `output` to describe the value you need:

| Desired result | Configuration |
| :--- | :--- |
| Text | Omit `output`, or use `Output.text()` |
| Validated object | `Output.object({ schema })` |
| Array of validated elements | `Output.array({ element: schema })` |
| One allowed string | `Output.choice({ options: ['yes', 'no'] })` |
| JSON without a fixed schema | `Output.json()` |

<!-- typecheck: structured -->
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

`output` determines parsing, validation, and the inferred type of the final application value. It is fixed when the component is created. With `.asStream`, delivery also depends on whether `output` is explicit; see the [result table](#llmagent-results). Structured output can be combined with tools. See [SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).

Use schema descriptions and the output specification's supported `name` and `description` fields to explain the desired data to the model. The selected model must support the requested output and tool capabilities; Casai does not make every model support every schema or media type.

#### Tool Loops and Stopping Conditions

An LLMAgent can execute tools during a model step. To let the model read their results and continue, configure more than one step:

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

console.log((await calculator('Use the tool to multiply 37 by 29.')).value);
```

The default is `isStepCount(1)` when no stopping condition is supplied or inherited. This is the same default as the SDK's `generateText` and `streamText`, so an LLMAgent without `stopWhen` makes the same single model call; the SDK's `ToolLoopAgent` instead defaults to `isStepCount(20)`. A step limit counts model steps, not individual tool calls; execution can finish before reaching it. A single step can run tools but cannot make another model call to interpret their results.

`stopWhen` accepts a condition, such as `isStepCount(5)`, or an array of conditions; any matching condition stops continuation. It can also be overridden for one `.run()` call. See [SDK loop control](https://ai-sdk.dev/docs/agents/loop-control).

#### LLMAgent Results

The call returns the full [SDK generation result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text#returns) or [streaming result](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#returns). Casai adds `value` for final application output and `messageHistory` for conversation state.

**`value` is the final answer parsed according to `output`. `output` selects the answer's type and validation; `.asStream` changes how it is delivered.** For example, `Output.object({ schema })` produces the schema's parsed object, including its transforms, rather than the model's raw JSON text. In a tool loop, `value` selects the final step's output and excludes earlier steps' text and tool activity. Text within that final step is preserved, including any commentary.

| Configured `output` | `value` without `.asStream` | `value` with `.asStream` |
| :--- | :--- | :--- |
| Omitted / default text | `string` | `AsyncIterable<string>` — final-answer text chunks |
| `Output.text()` | `string` | `Promise<string>` |
| `Output.object({ schema })` | Parsed object `T` | `Promise<T>` |
| `Output.array({ element })` | Parsed array `T[]` | `Promise<T[]>` |
| `Output.choice(...)`, `Output.json()`, or custom `Output` | Parsed value `T` | `Promise<T>` |

Without `.asStream`, `await agent(...)` waits for the completed result and you read `result.value` directly. With `.asStream`, it gives you a live result handle: use `for await` to consume default-text `.value`, or `await result.value` for any explicit `Output`. Awaiting a text iterable does not collect its chunks; use a loop or `collectTextStream(result.value)`.

**In streaming mode, omit `output` for a final-text stream; supply any explicit `Output` for a promised final value.** This includes `Output.text()`. A promised `.value` still leaves `textStream` and the other [SDK stream views](#consuming-a-stream) available while generation runs. All views reuse the same execution.

TypeScript infers `T` from the output specification, including transforms. The table uses the effective configuration, including inheritance: if `output` might be `undefined`, `.value` can be a default-text stream or a promised explicit value. Custom output names do not change delivery. If a custom parser returns an iterable, the promise resolves to that iterable without automatically consuming it.

The rest of the result retains the SDK's contracts, alongside Casai's `messageHistory`:

| Field | Complete result | Streaming result |
| :--- | :--- | :--- |
| `output` | Native SDK parsed output | Promise of native SDK parsed output |
| `stream` | Absent | Native SDK execution-event stream |
| `steps` | Array of completed step records | Promise of that array |
| `finalStep` | Final step record | Promise of that record |
| `responseMessages` | Messages produced during this invocation | Promise of those messages |
| `messageHistory` | Prior history, new prompt, and produced messages | Promise of that history |

SDK `text` contains the final step's text. SDK `content`, `toolCalls`, `toolResults`, `files`, and `sources` accumulate across steps; `usage` is total usage. Inspect `finalStep` for its reasoning, usage, provider metadata, and response details; `finishReason` explains why execution ended and `warnings` holds provider warnings. SDK fields retain their native contracts.

An execution can stop at tool calls or an approval request without eligible final output. Reading complete `value` then throws `NoOutputGeneratedError`; consuming its streaming form rejects. Casai selects the SDK-reported final step and adds no fallback to an earlier answer. When the SDK returns a result, `messageHistory` follows native `responseMessages` availability and rejection independently of `value`. It can retain partial or earlier messages after failure; resolution does not prove success or safe resumability. Inspect native finish reasons and tool/approval events when deciding how to continue. Structured generation can instead fail during eager parsing before returning any result, even after tool execution; streaming retains a history handle when final output parsing fails. See [approvals and continuation](#tool-approvals-and-continuation) and the [native continuation-failure exception](docs/plan.md#output-availability-and-failures). A valid completed empty text answer remains an empty string.

Completed tools do not by themselves prevent a final answer in the same step. Conversely, unresolved tool work prevents successful `value` completion even when the model also emitted text. A nonempty output stopped by a token limit or content filter can still be returned if the SDK's final parser accepts it; inspect `finishReason` when your application requires an untruncated answer. A final `finishReason: 'error'` never becomes a successful `value`. See the [output-availability rules](docs/plan.md#output-availability-and-failures).

Anthropic's raw `pause_turn` makes `value` unavailable even when normalized to `stop` and all server-tool results have arrived; continue explicitly using history. The installed OpenAI Chat adapter can instead discard a refusal and expose empty `stop` text, which remains eligible. Inspect raw finish reasons alongside normalized ones, and see the [documented adapter limitations](docs/plan.md#output-availability-and-failures).

`steps` is always completed records, or their promise; it never becomes an async iterable. Use `onStepEnd` for step-completion notifications and `stream` for live text, tool, reasoning, and other execution events. The event stream describes the current execution; `messageHistory` holds the conversation. There is no additional conversation or activity-stream alias.

`.asTool` exposes the same completed application output to another model while direct calls retain the full result. Use the non-tool LLMAgent with the [AI SDK Agent interface and UI helpers](#ai-sdk-agent-interface-and-ui-integration).

### Streaming with `.asStream`

The `.asStream` modifier makes an LLMAgent use streaming execution. Its ordinary call and `.run()` return a promise for a live result handle; awaiting it does not wait for generation to finish. With default text, consume `.value` as a text stream:

<!-- typecheck: streaming -->
```typescript
const writerStream = create.LLMAgent.asStream({ model });
const textResult = await writerStream('Explain battery recycling briefly.');

for await (const text of textResult.value) {
  process.stdout.write(text);
}
console.log(await textResult.usage);
```

Create a streaming LLMAgent when callers need live output or SDK events, such as a chat handler or a streaming Template. To stream an existing LLMAgent, derive one from it: `create.LLMAgent.asStream({}, writer)`. Within a Template or Script, select the child's streaming mode explicitly; the parent does not change ordinary nested calls. The [`value` table](#llmagent-results) shows delivery for each output specification.

`.asStream` follows an input modifier and can be followed by `.asTool`. A component derived from a streaming parent also stays streaming, including `create.LLMAgent({}, writerStream)`. Tool execution consumes one execution and returns validated final output with the same availability and failure rules as `value`; direct invocation remains streaming.

#### Consuming a Stream

Use `.value` when your application needs the final answer. For text as it arrives, partial structured data, or tool activity, choose a native SDK view:

| What you need | Result property | What it delivers |
| :--- | :--- | :--- |
| Live model text | `textStream` | Text chunks across model steps, including intermediate commentary. Structured output can appear here as JSON text. |
| Partial structured output | `partialOutputStream` | Partial parsed snapshots; they can be incomplete and do not establish final schema validity. |
| Array elements as they become available | `elementStream` | The SDK's element stream, when supported by the output specification. It does not apply Casai's final-answer selection. |
| Execution activity for a UI or custom consumer | `stream` | SDK events for text, reasoning, tools, step boundaries, errors, and completion. |
| The SDK's completed parsed output | `output` | A promise with native SDK semantics, without Casai's additional final-answer availability checks. |

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

const text = await result.value; // Completed final string; the same execution.
```

In a tool loop, `textStream` might show `"Let me check."` followed by `"It is 18 C."`; `.value` contains only `"It is 18 C."`. Default-text `.value` may buffer until the final step is known, so it is not always an immediate token stream. The native SDK streams remain live independently; see [final-answer streaming in tool loops](#final-answer-streaming-in-tool-loops).

For structured output, await `.value` for the completed parsed value. An array output gives an ordinary array, so iterate it with `for`, after awaiting:

<!-- typecheck: explicit-array -->
```typescript
const list = create.LLMAgent.asStream({
  model,
  output: Output.array({ element: z.object({ title: z.string() }) }),
});
const items = await list('Suggest three titles for an article about recycling.');

try {
  for (const item of await items.value) {
    console.log(item.title);
  }
} catch (error) {
  console.error('No valid final list is available:', error);
}
```

Stream consumption drives completion. Read a stream, forward it to an HTTP response, or call `await result.consumeStream()` when only completion matters. Final-result promises, including explicit-output `.value`, `.output`, `.usage`, and `.steps`, also trigger consumption; you do not need to drain a stream first. Each SDK stream handle follows its native consumption and locking rules. Accessing a stream-valued getter again obtains a fresh view of the same buffered execution. Casai `.value` reuses one execution and parsed output; awaiting it again does not reset a custom iterator returned by its parser. There is no extra Casai replay buffer or replay guarantee for arbitrary Script, Template, or Function streams. Awaiting the component call alone only obtains the live result handle.

Casai `value` rejects on terminal execution failure, cancellation, unavailable final output, or unrecovered output-validation failure. Already delivered default-text prefixes remain delivered, and its iterator closes successfully only after final checks pass. Recoverable tool errors and successful retries do not automatically fail the output; abandoned-attempt text must not become part of the final value. SDK streams retain their native error behavior: `textStream` omits error event parts, so finishing that loop alone does not prove a successful final answer. Transport/iterator failures can still throw. Use callbacks or `stream` to inspect error events. See [error handling](#errors-and-retries).

Output schemas must be pure and deterministic. The SDK may validate elements repeatedly during partial updates and again for final output; Casai adds no redundant parsing or exactly-once guarantee. Keep validators inexpensive and add stateful enrichment, such as random IDs, after validation.

The native SDK result properties retain their types and behavior. In SDK 7, `stream` is the execution-event stream and `fullStream` is its deprecated alias. SDK methods select their own operation: `writer.stream()` returns a streaming result even when its ordinary call is complete.

#### Final-Answer Streaming in Tool Loops

When a step starts producing text, Casai may not yet know whether another tool step will follow. An append-only stream cannot retract text already delivered. Casai therefore buffers candidate output until finality is established, discards intermediate candidates from `value`, and releases only final output. **An unrestricted loop may emit nothing through `value` until the loop finishes.** Buffered output is released without simulated typing delays. SDK execution events remain live throughout, so use `stream` or the [SDK UI helpers](#ai-sdk-agent-interface-and-ui-integration) to display progress.

Incremental `value` delivery is eligible when effective settings disallow tool calls and deferred continuation under the provider's declared protocol—for example, after hooks resolve to no tools, `activeTools: []`, or `toolChoice: 'none'`. This assumes the provider respects those controls. Even with no tools advertised, an unexpected call can cause the SDK to continue; `value` then fails after any prefix already delivered. A one-step setting alone does not establish that an eligible final answer will exist; tool-enabled calls buffer until answer availability is known. When controls permit continuation, buffer without inspecting stopping predicates or tracking default-condition provenance. Retries that could replace a default-text prefix still require buffering. Explicit outputs always use their completed-value promise, including custom parsers. SDK stream transforms, including `smoothStream`, feed both native final output and stream views, so they do not by themselves disable incremental `value` delivery. See the [concrete finality rules](docs/plan.md#loop-finality-and-buffering).

For immediate final-answer streaming, make the answer-producing phase explicit. This example first gathers research notes, then uses a separate streaming writer with the default single model step and no tools:

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
const answer = await answerWriter({ question, findings: notes.value });

for await (const chunk of answer.value) {
  process.stdout.write(chunk);
}
```

`lookup` is an application-provided research tool. The two phases are an explicit workflow choice. Casai never adds a synthesis call, disables tools, or changes the stopping condition to force an answer. Templates and Functions forwarding `value` preserve both final-output selection and any required buffering; switching parent rendering mode cannot add intermediate commentary to their output.

### Decision

`Decision` answers named choice, boolean, or score questions against shared state. Use it to route requests, apply a rubric, or evaluate several related questions. It is exported as `Experimental_Decision` while the SDK's `experimental_decide` is experimental.

<!-- typecheck-skip: phase-5 -->
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

<!-- typecheck-skip: phase-5 -->
```typescript
const embedder = create.Embedder({ model: embeddingModel });

const one = await embedder('First document');
const many = await embedder(['First document', 'Second document']);

console.log(one.embedding);   // number[]
console.log(many.embeddings); // number[][], in input order
```

An array always represents a batch, with one output vector per input. The SDK handles batch splitting and concurrency. The result retains usage and metadata as well as vectors.

Per-call settings go through `.run()`, which uses the SDK's input field names:

<!-- typecheck-skip: phase-5 -->
```typescript
await embedder.run({ values: ['First document', 'Second document'], maxParallelCalls: 2 });
await embedder.run({ value: 'Another document', abortSignal: AbortSignal.timeout(5_000) });
```

Use exactly one of `value` or `values` in `.run()`. With an input modifier, the ordinary call takes rendering context instead of the text. All input modifiers and `.asTool` are supported. Text and template modifiers prepare one value; a script or function preparer can return one string or a string array for a batch.

As a tool, an Embedder returns vectors. Models can't compute with them, so this is an uncommon use, mainly for tool workflows where the application or another step consumes the vectors.

See [single-input results](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed#returns), [batch results](https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many#returns), and [RAG integration](#embedding-and-rag-integration).

### Reranker

`Reranker` orders candidate documents by relevance to a query. Use it after keyword, vector, or hybrid retrieval to select useful context for an LLMAgent or improve search results.

<!-- typecheck-skip: phase-5 -->
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

<!-- typecheck-skip: phase-5 -->
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

<!-- typecheck-skip: phase-5 -->
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

<!-- typecheck-skip: phase-5 -->
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

<!-- typecheck-skip: phase-5 -->
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

<!-- typecheck-skip: phase-5 -->
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

<!-- typecheck-skip: phase-5 -->
```typescript
const transcribeRecording = create.Experimental_StreamingTranscriber.withFunction.asTool({
  model: streamingTranscriptionModel,
  description: 'Transcribe a stored recording.',
  inputSchema: z.object({ recordingId: z.string() }),
  inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
  audio: async ({ recordingId, _toolOptions: { abortSignal } }) =>
    openRecordingAsPcmStream(recordingId, { signal: abortSignal }),
});
```

Here `openRecordingAsPcmStream` is an application helper that opens a fresh, finite raw PCM stream in the configured format for each execution. A preparer may also provide an explicit normal completion boundary. The tool consumes one execution and returns the completed transcript with segments and SDK metadata; the model receives transcript text by default. It does not concatenate partial/final events or share an already-consumed source between calls. Failures reject collection, and an indefinitely open source is not a valid tool input. Direct component calls still return the live SDK result. See [SDK streaming transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription#streaming-transcription).

### SpeechGenerator

`SpeechGenerator` converts text into spoken audio.

<!-- typecheck-skip: phase-5 -->
```typescript
const speaker = create.SpeechGenerator({ model: speechModel });
const spoken = await speaker('Your replacement is on its way.');

console.log(spoken.audio);
```

Configure a speech model and reusable defaults. `.run({ text, ...settings })` adds per-call settings, such as voice or output format. All input modifiers prepare the text to speak; `.asTool` is also supported. As a tool, the audio goes to your application and the chat UI, while the model receives a short confirmation.

The [result](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-speech#returns) retains generated audio, format information, and metadata. Combine Transcriber, LLMAgent, and SpeechGenerator for a recording-to-answer workflow. See [SDK speech generation](https://ai-sdk.dev/docs/ai-sdk-core/speech).

`spoken.audio` exposes `.uint8Array`, `.base64`, and `.mediaType`. To return playable audio from a server handler:

<!-- typecheck-skip: phase-5 -->
```typescript
const audioResponse = new Response(Uint8Array.from(spoken.audio.uint8Array), {
  headers: { 'Content-Type': spoken.audio.mediaType },
});
```

When saving to a file, choose an extension matching the actual media type or configure a supported output format explicitly.

### VoiceSessionSetup

`VoiceSessionSetup` prepares live voice conversations with a realtime model. It is exported as `Experimental_VoiceSessionSetup` while the SDK's realtime API is experimental.

In the SDK's realtime design, the browser runs the session: it captures and plays audio, sends text, interrupts responses, and receives tool calls. The server creates a short-lived token for each session, with the instructions and voice included, and runs tools that need server-side data or secrets. `VoiceSessionSetup` is that server half:

<!-- typecheck-skip: phase-5 -->
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

**Separate future contract:** live `VoiceSession` connections, for telephony or agents hosted on the server, would take an audio input stream of raw chunks and their format, as StreamingTranscriber does, and return session events: output audio, transcripts, and interruptions. Casai would hold the provider connection; your application bridges its own transport, such as a telephony WebSocket, to those streams. See the [design](docs/plan.md#transcription-and-voice).

## Using Components as Tools

Append `.asTool` to a supported factory to let a language model invoke it. Supply a `description` explaining when to use it and an `inputSchema` describing the model-provided arguments.

An LLMAgent tool remains callable and has `.run()` and `.config`, but it is an SDK Tool, not an SDK Agent: it has no Agent `id`/`version` or `.generate()`/`.stream()` methods. Keep the non-tool agent for SDK UI helpers, and derive a matching `.asTool` component when the same behavior is needed as a tool. Derivation leaves the original agent unchanged. This separates the SDK's incompatible Agent and function-tool identity contracts.

Every field declared in a tool's `inputSchema` is model-controlled, including fields a host supplied through SDK `options` when using the Agent form. To keep an identifier such as `userId` trusted, remove it from the tool's public schema and supply it through private configuration or [trusted tool context](#tool-execution-context). A configured or tool-context default alone does not protect a still-public field.

LLMAgent tool arguments supply its application context. To turn named fields into prompt text, configure `.withTemplate`, `.withScript`, or `.withFunction` (including loaded template/script forms). The application owns that source; a model field named `prompt` never automatically overrides it. To deliberately use a field as the whole literal prompt, configure a function that returns it.

A plain `.asTool` uses a configured literal prompt; `.loadsText.asTool` uses a configured resource name. Both can accept declared context fields for hooks, such as `language`, or an empty input schema such as `z.object({})` when no public data is needed. Their ordinary application calls retain the usual explicit source overrides.

<!-- typecheck: agent-tool -->
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

`.asTool` accepts native function-tool settings such as `providerOptions`, `metadata`, `strict`, `inputExamples`, `toModelOutput`, and SDK input hooks, with the SDK's own types and callback protocols. Complete-input hooks receive parsed public input; input-delta hooks retain raw text. Configure approvals through the owning LLM's `toolApproval`. See the [supported descriptor properties](docs/plan.md#canonical-configuration-and-tool-descriptors).

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

An LLM exposed as a tool must finish its own workflow within that tool execution. If it pauses for an inner approval, a client tool without `execute`, or a deferred provider result, its unavailable `value` becomes an outer SDK tool error. The adapter exposes neither the inner history nor its pending approvals to the outer agent. Such tools are allowed because the pending path may never be taken or approval may be automatic. If the application must manage an inner pause, invoke that agent directly and retain its result/history for explicit continuation.

Streaming components can be tools when they have a completion boundary. LLMAgent and Template support `.asStream.asTool`; Script/Function stream results are collected, and StreamingTranscriber tools require a script/function preparer that opens bounded audio and return completed transcripts. VoiceSessionSetup has a separate session lifecycle and no implicit collection adapter. Plain SDK tools also work in an LLMAgent's `tools` map.

An SDK tool can yield preliminary results from an async generator. When called through a coded component's injected tool wrapper, a directly returned generator is consumed once and returns its final yielded value, following the [SDK convention](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preliminary-tool-results). Explicit SDK tools retain native result normalization, including the installed SDK's treatment of a promise resolving to an iterable as a single final value. Casai component tools require a declared stream kind: text joins into a string, and elements collect into an array. They reject an undeclared root async iterable instead of returning it to the SDK or guessing how to collect it. Progress updates are not collected into application data.

### Calling Tools from Coded Components

Template, Script, and Function call reusable operations as normal context methods. An LLMAgent can expose the same implementation as an SDK tool, allowing the model to choose when to call it. Native components need only the callable helper in `context`:

<!-- typecheck: coded-tools -->
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

Both pass the same named data. Use one spelling per call: keywords supply the whole context object, so combining them with a positional context object, as in `lookupOrder({ orderId: 123 }, quantity=2)`, is rejected rather than merged. Fields are matched by name, optional fields can be omitted, and schema/property order has no calling semantics. Casai does not expand input fields into positional arguments such as `lookupOrder(123, 2, 1)`. The input schema decides which fields are rejected, stripped, or retained. An implementation receives the ordinary merge of configured bindings and parsed input, as described [below](#tool-execution-context).

Existing positional main-input, source, context, and history forms remain unchanged. For example, a Template still accepts `(template, context)`, and Cascada keyword arguments can supply its final context object: `greeting('Welcome {{ name }}.', name='Ada')`. Source overrides can also use explicit names: `greeting.run({ template: 'Welcome {{ name }}.', context: { name: 'Ada' } })`.

Template, Script, and Function also accept configured `tools` and `toolsContext`. Required registered-tool context must be configured, directly or through inheritance, so shorthand calls are usable. `.run()` accepts compatible inputs for one invocation. Each run captures its effective map and creates immutable Casai tool bindings. After context/schema preparation, a fresh shallow context receives wrappers for unshadowed executable tool names. SDK and coded calls in the same binding use the same descriptor: its schema owns default merging/parsing, and its executor owns private bindings and completed output. Casai root streams are collected there; a plain SDK preliminary stream yields only its final value to the coded caller. Different bindings may have different derived descriptors, while component definitions, original schemas, configured context, and shared environments remain unchanged:

The [configuration merge rules](#configuration-management) apply to coded registries too: replacing an inherited tool replaces its whole definition; setting its entry to `null` or `undefined` removes it. Removed tools have no injected wrapper or required `toolsContext` entry. Coded `.run()` can override context for the fixed tools but cannot change their definitions.

<!-- typecheck: model-script-tools -->
```typescript
const tools = { multiply: multiplyTool };

// The model decides when to call multiply:
const modelCalculator = create.LLMAgent({ model, tools, stopWhen: isStepCount(3) });
// The script calls it directly, with the same validation and result:
const fixedCalculator = create.Script({ tools, script: 'return multiply(a=6, b=7)' });
```

A plain SDK `tool()` with an `execute` handler works too; without a model caller, it receives a generated `toolCallId`, an empty `messages` array, parsed `options.context`, and the caller's cancellation signal supplied through `.run()` or an owning SDK tool call. Deliberately configured context properties shadow injected tools, even when their value is `undefined`, `null`, or a non-function. Retained caller fields can shadow executable registered names only when explicitly declared public in `inputSchema`; an open schema does not authorize an undeclared collision. Stripped extras leave the wrapper available. This protection also applies to transform-created names and no-schema input, without reserving every Cascada built-in. Calling a shadowing non-function fails normally, without tool fallback. This does not remove the tool from the model's tool registry; use another registration name if both bindings are needed. Code-driven calls do not apply model approval policies or manufacture chat tool events. A component exposed as a model tool can therefore invoke an approval-gated tool through its injected wrapper without approval; when that inner effect needs human confirmation, require approval on the exposed outer tool.

Function and `.withFunction` callbacks infer these injected helpers. Casai tool helpers accept raw public arguments, including fields made optional by configuration, and return completed tool values: a string/array for declared streams or an application value for an LLM tool. Calling a component supplied directly in `context` retains its ordinary result instead. Native SDK tools keep their supported input shapes, including scalar or array arguments; the object-context requirement belongs to Casai components. Tools without a local `execute` handler have no injected callable.

Putting a component in `context` instead calls the component itself, with its own validation and full result: an LLMAgent in context returns its full SDK result, while its tool execution returns the completed parsed output. SDK tool execution adds the SDK's argument parsing, execution metadata, and approval lifecycle; see [tool execution context](#tool-execution-context).

### Tool Execution Context

**Casai tools have closed top-level public input.** Every public parameter must be explicitly declared in `inputSchema`. Unknown raw arguments fail before application parsing/preprocessing, including with a stripping `z.object`. Open-root/catchall tool schemas are rejected, including root `z.record` schemas; use a named object shape at the root. Dynamic keys belong inside a declared field such as `attributes: z.record(z.string(), z.string())`. This applies to direct/named calls on the tool component, SDK registration/binding and injected helpers. SDK/Standard schemas need explicit closed object input metadata, with local enforcement independent of provider strict mode. Ordinary non-tool components and native third-party tools retain their schema behavior; `toolContextSchema` need not be closed.

Keep one application `inputSchema`, parsed values, configured defaults and the private-collision checks after parsing and before execution. The closed raw boundary blocks arbitrary top-level injection, including absent private names. Trusted code must still keep nested public data separate from trusted identity and must not deliberately publish private dependencies through prompts/results or public declarations. See the [current contract and evidence](docs/phase2-review.md#closed-tool-input-contract-revision-2026-10-23).

Configured values need no separate schema merely to be available to an implementation:

<!-- typecheck: private-tool-context -->
```typescript
const scale = create.Function.asTool({
  description: 'Scale a number by the configured factor.',
  context: { factor: 3 },
  inputSchema: z.object({ value: z.number() }).strict(),
  execute: ({ value, factor }) => value * factor,
});

console.log(await scale({ value: 2 })); // 6
console.log(await scale.run({ context: { value: 2 } })); // 6
// Supplying factor fails because this inputSchema rejects that field.
```

To make configured `factor` a public, overrideable input, explicitly declare it in `inputSchema`. An open schema alone must not turn a private configured dependency into an overrideable model argument. A child's input schema does not validate or restrict the whole inherited context; extra configured dependencies remain available.

For ordinary components with open input, actual private context properties are identifiable without a context schema, including own properties whose values are `undefined`. Supported existing context declarations can also reserve absent optional names. Types can describe an optional field that is absent at runtime: `{}` annotated as `{ userId?: string }` does not itself reserve `userId` during runtime validation. Do not trust an arbitrary public extra as authenticated identity. Represent optional trusted fields at runtime, for example `{ userId: authenticatedUser?.id }`, or declare them in a supported `toolContextSchema`. Casai does not infer private names from erased types or arbitrary callback code.

**Tool strict mode is provider generation control, not a global SDK validation mode.** The installed AI SDK does not enable it by default. With `strict` omitted, its OpenAI Chat adapter omits the field, while its OpenAI Responses adapter explicitly sends `strict: false`. This differs from calling the Responses API directly, where omission attempts strict schema normalization and may fall back to non-strict mode. Set `strict: true` explicitly on compatible tools/providers; see the [verified defaults](docs/phase2-private-boundary-review.md#provider-strict-mode-defaults-and-scope) and [OpenAI's strict-mode contract](https://developers.openai.com/api/docs/guides/function-calling#strict-mode).

Casai's raw argument boundary rejects an undeclared root `userId` even without provider strictness. Provider strictness does not govern JavaScript/Cascada calls, supplied history, input transforms or later SDK refinement. Local validation and the post-parse private-binding checks remain active independently of the provider setting.

Named configured public defaults participate in input parsing: configured `{ language: 'en', db }` supplies required input `language` even for `{}` arguments, without publishing undeclared `db`. Inherited values work too. Required in complete application input does not mean required from the caller. Immutable per-run binding preserves this behavior when incoming tool context supplies public defaults too. An open schema must neither publish all configuration nor let model-supplied `db` replace the private binding. JavaScript and Cascada can supply non-JSON values where their schemas permit; actual model transport retains SDK/provider constraints.

Casai `.asTool` configuration accepts optional `toolContextSchema`. It validates incoming tool context, not `config.context`. Casai has no `contextSchema` configuration alias; its SDK descriptor exposes the same schema under the native name. This is a Tool interface property, not an Agent property. Every owner with a tool registry can configure `toolsContext` and supply per-invocation overrides. Casai owners bind descriptor/context pairs automatically. Direct native SDK integrations supplying public input defaults through context use `bindToolContext` to create the matching descriptor and raw context, as shown below; see the [binding contract](docs/plan.md#sdk-tool-boundary-and-configured-defaults). SDK history revalidation also checks declared raw names; root keys introduced by a transform cannot be replayed as raw arguments merely because a stripping schema could discard them. The accepted bare-tool revision supports private-only native `toolsContext` without binding. Public-input overlap requires explicit binding and can otherwise fail at execution after approval.

Top-level `contextSchema` is forbidden in Casai factory configuration and reusable `Config` fragments, including inherited configuration. Types reject it, and runtime construction throws `ConfigError` directing you to `toolContextSchema`, even if the wrong key is explicitly `undefined` or both names are supplied. Native SDK tools inside `tools` retain their valid `contextSchema` property. An ordinary application field named `contextSchema` inside `config.context` is unaffected.

<!-- typecheck: tool-context -->
```typescript
const contextualScale = create.Function.asTool({
  description: 'Scale a number by an application-provided factor.',
  context: { factor: 3 }, // Makes the ordinary caller usable.
  inputSchema: z.object({ value: z.number() }).strict(),
  toolContextSchema: z.object({ factor: z.number() }).strict(),
  execute: ({ value, factor }) => value * factor,
});

const scalingDefinition = create.Config({
  tools: { scale: contextualScale },
  inputSchema: z.object({ value: z.number() }),
  script: 'return scale(value=value)',
});

const scalingWorkflow = create.Script({
  toolsContext: { scale: { factor: 3 } },
}, scalingDefinition);
console.log(await scalingWorkflow({ value: 2 })); // 6
console.log(await scalingWorkflow.run({
  context: { value: 2 },
  toolsContext: { scale: { factor: 5 } },
})); // 10
console.log(await scalingWorkflow({ value: 2 })); // Still 6
```

Here `context: { value: 2 }` is input to the workflow; the script passes `value` as the registered tool's public argument. `toolsContext.scale` is a separate application-supplied input to that tool invocation. The wrapper captures the effective entry for this run and forwards it through the SDK's context channel. It does not assign to `scalingWorkflow.config`, change `contextualScale`, or remember `factor: 5` for another call. This is explicit argument passing, not persistent tool memory. An LLM can supply the public tool arguments; the application supplies the `toolsContext` map. A coded workflow can supply both, while keeping their roles explicit.

Required execution configuration must be bound when constructing the finished callable, directly or through inheritance. Reusable `Config` fragments may remain incomplete. An explicit `.run()` setting such as `toolsContext` or `abortSignal` has its own contract; it is not an application field admitted by `inputSchema`. Runtime schemas validate effective invocation values, without schema-requiredness probes at creation. Building a callable per request currently creates a fresh Cascada environment and recompiles inline source on first use; compatible compilation sharing is an optional optimization, not a context-sharing guarantee.

An ordinary `contextualScale({ value: 2 })` uses configured factor and does not run `toolContextSchema`, including its defaults. Types require the finished component to supply the dependencies needed for ordinary calls. Registry bindings preserve `undefined` versus `{}` and parse incoming context to select public defaults; configured dependencies are not substituted into that schema. Binding preparation is lazy and can validate advertised tools before model selection. SDK input hooks, approval, and execution still validate context independently with the original schema. Casai does not cache parsed context across those native stages. Injected calls through a Casai binding reuse its already-parsed fixed context instead; objects produced by context defaults remain shared and read-only within that binding. Plain SDK tools without a Casai binding retain per-call parsing and their separate `options.context` protocol.

Casai-owned binding-context failures have a stage-only public error message. The native cause can contain private values and is for trusted diagnostics. This matters on approval continuation too: streaming can emit tool errors before any model request, and UI error handlers may publish their text. Native SDK-owned context validation retains its native behavior.

Source priority is arguments over tool context over configuration. Binding selects named public defaults from configuration and parsed incoming context, then the original input schema parses those defaults plus arguments. Only that schema controls caller admission. Execution combines private bindings with parsed public input without restoring raw names removed by transforms. See the [binding preparation pipeline](docs/plan.md#context-sources-and-preparation).

For configured `factor: 3`, bound context `{ factor: 5 }`, and omitted arguments, the effective value is `5`; explicit caller `factor: 3` produces `3`, and explicit `7` produces `7`. Configured or bound defaults can satisfy required complete-input fields; making the schema optional is not a replacement for completing and parsing the input. The binding's entire context stays fixed across tool calls and SDK steps. A separate run may create a different binding without changing the component. Native `prepareStep` context replacement is unsupported for an existing Casai binding; plain SDK tools retain native behavior.

**Native SDK registration:** a Casai owner binds its registry automatically. To register a Casai tool directly with an SDK agent and also supply incoming context, create the matching pair with `bindToolContext`:

<!-- typecheck: bound-tool -->
```typescript
const scaleByFive = contextualScale.bindToolContext({ factor: 5 });
const agent = new ToolLoopAgent({
  model,
  tools: { scale: scaleByFive.tool },
  toolsContext: { scale: scaleByFive.context },
});
```

`bindToolContext(rawContext)` returns a fresh readonly `{ tool, context }` pair and leaves the component unchanged; another pair can bind a different value concurrently. Register both values together and keep the pair fixed for the whole run, including in `prepareStep`. This example supplies a public `factor` default, so it requires binding. A bare descriptor may instead accept private-only native context; it cannot use incoming context to revise already validated public arguments. `context` keeps the raw input type. When `toolContextSchema` transforms its input, the SDK's `toolsContext` type expects the parsed type, as it does for native transforming tools, so that registration needs a type assertion. The bound `tool` is a plain native descriptor: a Casai owner receiving it in `tools` treats it as a native tool and needs the pair's `context` as its `toolsContext` entry. Use the component itself, not its bound descriptor, as a configuration parent.

**Testing tools:** to test configured defaults, incoming tool context and validation together, call the tool through an owning Casai component or a mock-model `ToolLoopAgent` using the matching pair above. Calling `tool.execute(input, options)` directly follows native SDK executor semantics: it expects already parsed arguments/context and skips argument preparation. Ordinary component calls test ordinary semantics; they do not exercise incoming tool context. No separate public execution helper is needed.

**Execution metadata:** Function, Script, Template, and `.withFunction` all read an always-present reserved `_toolOptions` property from their prepared context. This replaces the separate Casai callback options argument and the old `_toolCallOptions` variable. Native `options.context` is flattened into application context and omitted from `_toolOptions`; the other native execution fields retain their SDK names/types, including optional `experimental_sandbox`. Ordinary calls have `{}` or their explicit `abortSignal`; SDK calls add native `toolCallId` and triggering `messages`; injected calls inherit the caller's native options (including signal and sandbox), replacing the ID and using `messages: []`. Each injected tool selects its own trusted `toolsContext` entry. These messages are not the result's assembled `messageHistory`, and SDK `runtimeContext` is not implicitly forwarded.

Function and `.withFunction` infer `_toolOptions` as the shared exported `ComponentExecutionOptions` type. It is derived from the SDK, with native `context` omitted and call ID/messages optional because the same callback also handles ordinary calls:

<!-- typecheck: execution-options-type -->
```typescript
import type { ToolExecutionOptions } from 'ai';

type SDKToolOptions = Omit<ToolExecutionOptions<unknown>, 'context'>;
type ComponentExecutionOptions =
  Omit<SDKToolOptions, 'toolCallId' | 'messages'> &
  Partial<Pick<SDKToolOptions, 'toolCallId' | 'messages'>>;
```

Applications normally use the inferred type; reusable helpers can import `ComponentExecutionOptions` from Casai rather than repeat this definition. Native SDK tool executors still receive the full SDK options type, with required tool metadata and separately typed `context`.

<!-- typecheck: execution-options -->
```typescript
// factor comes from configuration or tool context.
execute: ({ value, factor, _toolOptions }) => {
  _toolOptions.abortSignal?.throwIfAborted();
  return value * factor;
}
```

Casai supplies `_toolOptions` after application parsing/merging, so it needs no input-schema declaration and cannot be replaced by caller/configured data. It never authorizes skipping validation. The actual execution metadata is not inserted into SDK public arguments/history. Components must not mutate it or its referenced data. Plain SDK tools retain their native `execute(input, options)` contract, including `options.context`; the Casai descriptor also receives those native options before adapting them for its body.

Pass selected application fields to another component, for example `child({ value })`. Forwarding the whole execution context can fail a child's strict schema because it includes private dependencies, `_toolOptions`, and injected helpers. Returning that whole context can also publish those values, including native messages; tool results should contain the intended application output. No automatic output redaction is implied.

Incoming tool context is not automatically forwarded to an inner registry. A Function bridge can pass it explicitly to a reusable Script or Template through that component's `.run()` settings:

<!-- typecheck: forward-cancellation -->
```typescript
// pipeline is an existing component with a registered lookup tool.
execute: ({ id, db, _toolOptions }) => pipeline.run({
  context: { id },
  toolsContext: { lookup: { db } },
  abortSignal: _toolOptions.abortSignal,
})
```

Each call creates its own binding; the pipeline and its compiled source can be reused. An injected tool call itself supplies application arguments, not another tool-context map. Cascada code can likewise call a component made available in its context through `.run()` when explicit nested settings are needed.

Tool definitions and `toolsContext` merge by tool name through configuration and supported call overrides. Each supplied tool-context entry replaces that tool's whole context value. SDK tool execution supplies already-parsed arguments/context, and Casai's `execute` wrapper does not validate them again. Injected wrappers normalize named/keyword arguments, removing Cascada's `__hasKeywordArgs` marker before validation, then validate once before execution. This also applies to plain SDK tools and strict schemas; direct component calls use the same argument normalizer and their own preparation boundary. Adding or changing tool contracts requires deriving a compatible component.

### Tool Approvals and Continuation

**Implementation stages:** Basic conversation history and native SDK approval messages belong to Phase 3 LLMAgent. The `resume()` method and the `approvals` / `toolResults` convenience inputs below arrive in [Phase 4](docs/plan.md#phase-4-tool-continuations); they are not required for the initial LLMAgent release.

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
const requests = pending.content.filter(
  part => part.type === 'tool-approval-request' && !part.isAutomatic,
);
```

The call returns these requests; it does not remain open waiting for a person. Collect the decisions in your application, then continue with `.resume()`:

<!-- typecheck-skip: phase-4 -->
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

When an approval resumes in a later request, reconstruct the public defaults used by the approved call. For example, changing a defaulted `locale` can change the input being approved. The SDK revalidates recorded input and can return a tool error without executing if it differs. New private dependencies are allowed; a changed default also remains valid when an explicit recorded argument overrides it and preserves the same effective input. This applies to components created per request and to SDK UI continuations. The application owns any configuration persistence needed alongside history; see [approval stability](docs/plan.md#sdk-tool-boundary-and-configured-defaults).

Chat UIs don't need `resume()`: the SDK UI client sends approval responses with the next request, and the UI helper passes the complete conversation. See the [SDK approval guide](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-execution-approval) for response formats.

## Template and Script Properties

Templates, scripts, and their AI input modifiers add Cascada rendering settings to the [shared configuration](#shared-configuration). This section covers source handling, context helpers, loading and rendering controls.

### Source Properties

Standalone Template uses `template`; standalone Script uses `script`. LLMAgent uses `prompt`, with the modifier determining whether it contains literal input, a template, a script, a function, or a resource name. A one-off replacement goes in the same property: as the first argument of the ordinary call, or as `prompt` in `.run()`. Other AI operations prepare the main property described in the [preparation table](#input-preparation-by-component).

Configured inline templates and scripts are compiled for reuse, with syntax errors reported when called. Loaded sources resolve on first use through Cascada's native environment cache, preserving source origin, declaring loaders, relative imports, reload policies, `noCache`, and invalidation. Casai adds no general compilation cache. Environment sharing is an optional implementation optimization, not an API guarantee. A one-off resource name can bypass a missing configured resource.

### Context

The shared [context](#shared-configuration) can contain values, synchronous or asynchronous functions, promises, and other components. In templates and scripts, Cascada resolves asynchronous values when their results are needed:

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

These helpers use the same [application input and private-binding rules](#input-and-output-validation) as other components; Cascada adds asynchronous evaluation of the prepared values.

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

## AI SDK Properties

AI components use their operation's SDK settings and retain its result fields. Follow the reference links in the [component overview](#component-overview) for full input and return contracts. Support for individual settings depends on the model and provider.

LLMAgent exposes SDK generation settings, lifecycle callbacks, and [request/step preparation hooks](#application-context-and-hooks). Its non-tool forms also implement the SDK `Agent` interface. The hooks are optional; SDK Agent compatibility does not depend on using them. Template, Script, and Function use their [native component contracts](#common-component-contracts), with application data and callable helpers in `context`. See [cancellation](#cancellation-timeouts-and-usage) for per-call signals and timeouts.

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
| `prepareCall` | Prepare request settings once per invocation |
| `prepareStep` | Adjust settings before each model step, including the first |
| `onStart`, `onStepEnd`, `onEnd` | Observe execution and completion |
| `onChunk`, `onError`, `onAbort` | Observe streaming output, errors, and cancellation |

Casai does not impose sampling defaults. An omitted setting uses SDK/provider behavior. Use current SDK setting names in configuration and `.run()`, such as `instructions`, `telemetry`, `repairToolCall`, and `include`; deprecated setting aliases are rejected. `abortSignal` is a per-call setting and is rejected in constructor configuration. For cancellation, pass an abort signal for one call:

<!-- typecheck: caller-signal -->
```typescript
const result = await explain.run({
  context: { topic: 'solar panels' },
  abortSignal: AbortSignal.timeout(10_000),
});
```

### Lifecycle Callbacks

Callbacks are useful for recording usage, inspecting tool activity, and updating application state:

<!-- typecheck: observers -->
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

<a id="custom-call-options-and-hooks"></a>

### Application Context and Hooks

Use `prepareCall` for request-wide decisions and `prepareStep` for decisions based on model/tool execution so far. Both are optional LLMAgent callbacks and apply to ordinary calls, `.run()`, and SDK/UI calls.

| Hook signature | When it runs | What it returns |
| :--- | :--- | :--- |
| `prepareCall(request, config, context)` | Once, after context and prompt preparation | The complete editable request; spread `request` to retain its other settings |
| `prepareStep(step, config, context)` | Before each model step, starting at `stepNumber: 0` | Native partial step overrides, or `undefined` |

The arguments have distinct roles:

- `request` contains editable SDK settings and `messages`: the rendered/literal conversation plus history. It contains no application context or custom options. `step` contains native step information, including `stepNumber`, completed `steps`, and current messages/model; it is not a complete request to spread back.
- `config` is the flat configuration plus supported call overrides, resolved for this invocation before the hook. Its `context` includes caller overrides of public defaults, before parsing; its `prompt` is the selected source.
- `context` is the final prepared application object, after merging defaults, input-schema processing and private bindings. Rendered calls pass this same object to their prompt preparer. Defaults, stripping and transforms can make it differ from `config.context`. SDK tool arguments enter this object; their raw form is not reconstructed in `config`.

Both hooks receive the same config/context objects throughout the invocation; evolving state is in `step`. Reusable hooks can annotate an unused config parameter as `unknown`, or declare only the settings they consume, so unrelated config types do not become dependencies. Callbacks may ignore unused arguments. Native one-argument step callbacks work; native call hooks that read `options` need an explicit adapter to the third argument.

One schema covers data used by both the renderer and hooks. Here, `model` supports tools and `search` is an application-provided tool:

<!-- typecheck: hooks -->
```typescript
import { isStepCount } from 'ai';

const researcher = create.LLMAgent.withTemplate({
  model,
  prompt: 'Research this question: {{ question }}',
  context: { language: 'English' },
  inputSchema: z.object({
    question: z.string(),
    language: z.string(),
  }),
  tools: { search },
  stopWhen: isStepCount(2),

  prepareCall: (request, config, context) => ({
    ...request,
    instructions: `Answer in ${context.language}.`,
  }),

  prepareStep: ({ stepNumber }) => ({
    toolChoice: stepNumber === 0
      ? { type: 'tool', toolName: 'search' }
      : 'none',
  }),
});

await researcher({
  question: 'What are practical uses of perovskite solar cells?',
  language: 'Spanish',
});
```

The first step requests `search`; if the loop continues, the second answers with tools disabled. Context is prepared once, before rendering or either hook, including on plain-text agents with no renderer. No separate options object or schema is needed.

**SDK calls use `options` as the native name for that same raw context.** They apply the same `inputSchema` and configured defaults, but skip loading/rendering the configured prompt. Required fields remain required, even if only the skipped renderer uses them:

<!-- typecheck: native-context -->
```typescript
await researcher.generate({
  prompt: 'Research perovskite solar cells.', // Literal conversation.
  options: { question: 'Perovskite solar cells', language: 'Spanish' },
});
```

The types keep that boundary explicit:

| Surface | Application data |
| :--- | :--- |
| Casai configuration and `.run()` | `context`; custom `options` and `callOptionsSchema` are rejected |
| Preparation hooks | Third argument `context`; no custom `options` in request/config |
| Native SDK methods and UI helpers | `options` carries the same raw context input |

Casai's `.generate()`/`.stream()` let you omit `options` when no context input remains required after defaults; otherwise its required fields must be supplied. Omission still runs the shared input preparation. SDK helpers forward `options` to Casai so a reusable agent can receive request-specific data. Casai applies context's shallow merge, validation and private-binding rules, then consumes it before calling `generateText`/`streamText`. It is not automatically sent to the model or registered tools' `toolsContext`.

The call hook can change the admitted SDK request settings, including `timeout`, streaming error handling/transforms/retries and sandbox. Its complete return wins on every entry path, including explicit SDK/UI settings; omitted or `undefined` editable fields are not restored. Spread `request` to retain them. A replacement must include `toolsContext` when its declared tools require context. Use `.run({ prepareCall: anotherHook })` to replace its policy. SDK/UI callers use a differently configured agent for different policy: unlike native `ToolLoopAgent`, their timeout/transform/sandbox settings remain editable by the hook.

Fixed output, caller cancellation, composed observers, approval policy/signing (`toolApproval` and `experimental_toolApprovalSecret`) and the whole `telemetry` setting stay outside the editable request. Configure these normally; supported `.run()` overrides still apply. Use the native `toolApproval` callback for dynamic approval decisions. `prepareStep` keeps native partial overrides, with no timeout override.

Changed request messages do not rewrite original result history. This includes a hook that creates the entire conversation from empty input: only response messages are then recorded. Supply a persistent new turn through call input or a prompt preparer. Step hooks retain SDK rules: model/tool-choice overrides apply to one step; instruction/message/runtime-context/tool-context replacements carry forward. Bound Casai tool context stays fixed; see [tool execution context](#tool-execution-context).

Both hooks may be asynchronous and call ordinary components; see [dynamic instructions](#dynamic-instructions-for-chat-requests). They read explicit invocation cancellation from `context._toolOptions.abortSignal`; SDK-internal timeout signals are not exposed there. `request.tools` contains the authored tool entries from resolved config, before automatic dispatch binding; explicitly bound descriptors stay bound. Context tool helpers keep their earlier bindings even if the hook changes model tools/context. Return replacements and copy changed nested paths; do not mutate configuration or borrowed request/context data. Hooks never rewrite the component's `.config`; there is no deep cloning or freezing. The full `config` argument is not redacted, including configured signing keys. Inherited hooks must remain compatible with derived configuration and parsed context.

For example, with `detail` declared in `inputSchema`, a call hook can choose its timeout:

<!-- typecheck: context-timeout -->
```typescript
prepareCall: (request, config, context) => ({
  ...request,
  timeout: context.detail === 'deep' ? 60_000 : 10_000,
})
```

Before Phase 7, the SDK starts this timeout after preparation and the hook finish. Phase 7 includes preparation in the total budget; see [cancellation and timeouts](#cancellation-timeouts-and-usage).

## Using Components in Templates and Scripts

Place components in context to call them from Cascada. Use scripts to assemble data and templates to format it.

### Script for Data Orchestration

This workflow creates a summary and extracts tags independently:

<!-- typecheck: orchestration -->
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

<!-- typecheck: presentation -->
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

A template can also invoke an asynchronous component directly, for example `{{ summarizeText({ text: text }).value }}` when `summarizeText` is a non-streaming text LLMAgent supplied in its context. Casai doesn't detect LLMAgent results, so a template reads `.value` explicitly, as a Script does. Use JavaScript helpers in context for application-specific behavior; Cascada resolves their promises like component calls.

Before Phase 6, a streaming agent with omitted `output` returns an async iterable as `value`; it cannot be interpolated directly as a scalar. Consume it with the template's supported async loop, or use a non-streaming agent:

```nunjucks
{% for chunk in writeText({ text: text }).value %}{{ chunk }}{% endfor %}
```

Explicit `Output.text()` instead gives a promised final string through `value`. Reading native `.text` bypasses `value`'s output-availability checks and is not a general substitute. Automatic collection of iterable values during scalar interpolation belongs to the Phase 6 integration.

### Streaming Through Templates and Scripts

The Phase 6 integration preserves each nested call's declared contract when streaming a parent. A child streams when it was created with `.asStream`, or is a Script or Function whose schema declares a stream. In the newsletter above, `writeIntro` is explicitly a streaming LLMAgent; Phase 6 lets the Template collect its text during generation or forward its chunks during streaming without changing source:

<!-- typecheck-skip: phase-6 -->
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

The JavaScript stream schemas, collectors, and Function producers are planned for [Phase 2](docs/plan.md#coded-component-conventions-and-javascript-streams). Integration with Cascada's future Template renderer, native Script channels, kind metadata, source-order snapshots, native validation, and engine-owned stream termination belongs to [Phase 6](docs/plan.md#phase-6-cascada-streaming-integration). These are planned stages; the early JavaScript work does not require new Cascada features.

### Ordered and Unordered Streams

The native contract delivers text chunks and complete array elements in logical order. Out-of-order delivery remains a [deferred design extension](docs/plan.md#phase-8-out-of-order-streaming), dependent on Cascada's position-aware streaming support. Public unordered properties, position payloads, transport, branching, and buffering are not part of the core contract yet. This does not prevent independent work from running concurrently.

### Concurrency, Ordering, and Recovery

Cascada is a separate language with JavaScript-like expressions and its own control-flow syntax. It does not use JavaScript `await` or `try/catch` inside a script. Independent statements and `for` iterations run concurrently, so source order alone does not sequence external side effects.

Use `for item in items of 3` to limit a script loop to three concurrent iterations. Use `each item in items ... endeach` for sequential iterations, or Cascada's `sequence` / `!` facilities for ordered access to stateful services. This concurrency control is separate from an LLMAgent's step limit and Embedder's batch settings.

A deliberately stateful/effectful implementation is a supported use case, not a requirement for a separate stateful-component API. Its application-owned service/session or implementation-owned state may persist across calls; Casai does not automatically store tool results or carry invocation state into later calls. Keep configuration and input bindings unchanged while operating on that authorized state. `!` orders the selected scope; it does not make the operation pure, grant permission to change private input bindings, or provide a global lock. Different wrappers that secretly write the same resource are not automatically recognized as one scope. JavaScript calls and native SDK tool execution do not pass through Cascada's `!`; those callers retain their own ordering and authorization responsibilities.

Sequential calls may reuse state after prior work has finished. Overlapping independent executions need application-managed ownership or coordination; the newer runtime does not enforce a cross-execution lock. Approval also does not deduplicate effects: replaying valid approved history in another SDK invocation can execute the operation again, even when the SDK signs that history. The application or service owns any required idempotency and cross-request deduplication.

Associate persisted conversation and approval history with the authenticated user/session. SDK approval signatures authenticate the public operation; they do not bind it to private tool context such as the tenant, or authorize access to a requested resource. `toolChoice: 'none'` is a provider instruction. `activeTools` and tool-caller routing restrict fresh model calls but do not revoke registered calls already approved in history. Use the SDK's approval policy or service authorization when an operation must be denied.

Approval is also scoped to the model-loop call. A trusted Script, Template or Function that invokes another tool does not automatically run that child's model approval flow. If the outer operation needs approval, configure it there, and enforce essential resource permissions in the service. See the [protection assessment](docs/phase2-protection-assessment.md#native-control-probes) for native comparisons and limits.

Script failures propagate through dependent values while unrelated work can continue. Bind a result and use `is error` when you want a fallback:

<!-- typecheck: recovery -->
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

<!-- typecheck: history -->
```typescript
import type { ModelMessage } from 'ai';

const chat = create.LLMAgent({
  model,
  instructions: 'Answer clearly and concisely.',
});

let messageHistory: ModelMessage[] = [];

const first = await chat('My project is called Orchard.', messageHistory);
console.log(first.value); // Check final output before saving an ordinary answer.
messageHistory = first.messageHistory;

const second = await chat('What is my project called?', messageHistory);
console.log(second.value);
messageHistory = second.messageHistory;
```

`.run({ prompt, messageHistory, ...settings })` takes the same input with settings; rendered forms use `.run({ context, messageHistory })`.

To continue with history alone:

<!-- typecheck: history-run -->
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

History follows native `responseMessages` availability and rejection, without a separate execution-success check. It may retain partial or earlier messages after a provider failure or an error finish reason. Output parsing failure also does not erase available messages. Inspect native finish reasons and tool/approval events before deciding how to continue; resolved history is not proof of success or safe resumability. A generation call that rejects does not return a separate history handle.

For an ordinary answer, read `value` successfully before saving the new history; a streaming `value` must finish consumption successfully. Inspect `finishReason` when you require an untruncated answer, since nonempty length-limited output can still be eligible. After failure, keep the previous history unless your application deliberately saves the partial exchange. For a tool/approval pause, inspect its events and save the pending conversation explicitly for continuation even though it has no final `value`. Also observe native error callbacks/events: the [accepted SDK limitations](docs/plan.md#output-availability-and-failures) can retain earlier completed steps after a later failure.

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
  console.log(result.value);
}
```

`message` is an application-chosen template variable, not a reserved argument. Its contents are data, so text containing `{{ ... }}` is not evaluated again as template source. Only the current context is validated and prepared; earlier rendered messages pass through unchanged. Create the agent with `.asStream` for the same preparation with incremental generation, then obtain history from `await result.messageHistory`.

For a UI conversation, store the prepared `messageHistory` in the application and have the client send only the new turn's data. The SDK's complete conversation doesn't identify a new turn to render, so don't feed it through the rendered Casai call as fresh input. Native `.generate()`/`.stream()` accept that conversation literally, skip rendering and still require the agent's application context contract. To regenerate a reply, call again with the same input and the history before that turn. To continue after tool approvals, use [`resume()`](#tool-approvals-and-continuation), which adds no turn. Applications may store original UI text separately for display.

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

console.log(description.value);
```

Replace the example URL with your own image. File parts and other supported message content also remain structured through Casai preparation. Script/function prompts can return these message arrays directly.

The model and provider determine supported media and formats. Generated files and content parts remain available on LLMAgent results. `output` controls parsed text or structured values; use ImageGenerator, Transcriber, or SpeechGenerator for their dedicated operations.

## AI SDK Agent Interface and UI Integration

LLMAgent forms without `.asTool` implement the [AI SDK Agent interface](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent) through two additional methods, `.generate()` and `.stream()`. They exist for SDK compatibility: SDK helpers such as `createAgentUIStreamResponse` call them. They take the SDK's call arguments, not Casai's: the complete conversation as a literal `prompt` or `messages`, plus `options` for application context, `abortSignal`, `timeout`, and callbacks. They never prepare the configured prompt, so text they receive is never rendered. `.generate()` always generates and `.stream()` always streams, whatever the component's mode, and both return full SDK results. In your own code, use the ordinary call or `.run()`. An [LLMAgent tool](#using-components-as-tools) has the Tool interface instead; pass its non-tool parent or another non-tool component sharing its configuration to UI helpers.

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

<!-- typecheck: native-methods -->
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

These methods accept native Agent parameters, including `options` for application input. Use `.run()` for Casai settings overrides such as `model` or `prepareCall`; derive another component to change fixed contracts such as `output`.

### What the Chat UI Uses

The chat client sends `UIMessage[]` to a server handler. The SDK helper validates the messages, converts them to `ModelMessage[]`, calls LLMAgent's `.stream({ prompt: convertedMessages, ... })`, and consumes the SDK event stream to produce assistant message parts. A raw native text or element stream is a different contract. See the [SDK UI response helper](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-agent-ui-stream-response).

**Any non-tool LLMAgent whose input requirements are satisfied can serve this handler, including one with `stopWhen: isStepCount(1)`.** The limit counts model steps within a request, not chat turns. A single step can execute tools and emit UI tool parts, but cannot make another model call to write an answer using their results. Increase the limit when that follow-up is needed.

<!-- typecheck: ui -->
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

For SDK UI handlers, a plain agent with request context such as `language` is usually sufficient. Rendered agents also support the helper, but their configured renderer is skipped and every required context field must still be supplied or defaulted. Use the rendered Casai call when the agent should prepare the new turn.

The helper supplies a literal conversation and passes application context as native `options`. The same `inputSchema` and configured context defaults apply; only source loading/rendering is skipped. SDK tools with required execution context still need configured `toolsContext` entries, separate from application context and `runtimeContext`. Undefined settings preserve configured values; native lifecycle observers compose under SDK alias precedence.

#### Dynamic Instructions for Chat Requests

Put shared behavior in `instructions`. For instructions that depend on the request, use application context and `prepareCall` to render a Template once, while keeping the full incoming conversation intact:

<!-- typecheck: dynamic-instructions -->
```typescript
const chatInstructions = create.Template({
  template: 'Answer clearly and concisely in {{ language }}.',
  inputSchema: z.object({ language: z.string() }),
});

const localizedChat = create.LLMAgent({
  model,
  inputSchema: z.object({ language: z.string() }),
  context: { language: 'English' },
  prepareCall: async (request, config, context) => ({
    ...request,
    instructions: await chatInstructions({ language: context.language }),
  }),
});

await localizedChat.run({
  prompt: 'What is a solar panel?',
  context: { language: 'Spanish' },
});
```

The SDK UI helper passes the same raw context as `options: { language: 'Spanish' }` alongside its conversation. This prepares system instructions without rewriting user, tool, approval, or media messages. For an application that renders new user turns, [separate new input from saved prepared history](#render-only-the-new-message).

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

LLMAgent's SDK `output` and Script/Function's native `schema` both return schema-produced application values. A deterministic string-to-number schema therefore produces a number in either implementation. Each has one declared output-parsing boundary; Casai does not reparse SDK output. Templates stay text-only. Share `inputSchema`, helper signatures, and the application result type; SDK events, conversation history and the native Agent call protocol remain LLMAgent concerns.

## Cancellation, Timeouts, and Usage

LLMAgent and specialized SDK operations accept native per-call `abortSignal` and `timeout` settings. Script/Template and Function timeouts arrive in Phase 7, once Cascada provides async call context. In Phase 2, Function, Script, and Template `.run()` accept an explicit signal for cooperative forwarding and pre-start checks, without shared deadlines. Native Script/Template abort is separate and need not precede Phase 7.

Before Phase 7, a numeric `timeout` or the SDK timeout object's `totalMs` retains its native SDK meaning and begins at SDK execution. It does not cover preceding Casai parsing, loaders, or rendering. Casai forwards the final timeout unchanged, including any replacement or omission by `prepareCall`. Phase 7 makes the total cover preparation and execution by resolving an absolute end time at invocation entry and taking the earlier of that time and the inherited parent end time. This is an intentional semantic change for existing totals: its release notes and migration guidance must explain that preparation consumes the budget and may require increasing configured totals. In Phase 7, `prepareCall` may shorten, extend or remove the still-active local total: measure it from the original start and cap it by the parent deadline. It cannot revive an expired call. Work already started keeps its captured deadline; later children inherit the updated one. SDK non-total limits retain their native meanings.

`timeout` is replaced as a whole. Returning `timeout: { stepMs: 5_000 }` removes an earlier total limit, including the local total deadline in Phase 7. To add a step limit while retaining the total and other limits:

<!-- typecheck: step-timeout -->
```typescript
prepareCall: request => ({
  ...request,
  timeout: {
    ...(typeof request.timeout === 'number'
      ? { totalMs: request.timeout }
      : request.timeout),
    stepMs: 5_000,
  },
})
```

LLMAgent passes invocation cancellation to the SDK and its tools. Supply a request signal or `AbortSignal.timeout(...)` per call, or call `controller.abort()` on a supplied controller. Reusable component configuration rejects `abortSignal`; cancellation belongs to an invocation. Function callbacks and `.withFunction` preparers receive the signal in their execution options and must forward it to supported operations such as `fetch` or another SDK call. A Script/Template SDK tool entry also captures that signal for its injected registered tools, just as an explicit `.run({ abortSignal })` does. Forwarding does not interrupt rendering or reach arbitrary functions/components supplied in context. Stopping display alone is not cancellation.

Before Phase 7, await preparation normally and check the caller signal before dispatching the LLM. Phase 7 carries the end time implicitly through Cascada async call context, shared with its telemetry/call-tree foundation, including calls made by JavaScript Function callbacks. Implementations can query that context without manually passing it to every child. At SDK boundaries, derive the necessary signal from the remaining time and preserve SDK non-total timeout limits.

Once async call context exists, Function, Script, and Template can race completion against the remaining time even before the engine supports abort. A timeout rejects the wait; the underlying code may continue. Nested components inherit the same deadline, and new calls after expiry reject before execution. Returned streams keep the deadline for their execution lifetime. Actual engine interruption can be added when Cascada supports it. See [cancellation and timeouts](docs/abort.md).

Each LLMAgent result reports that call's token usage through the SDK's `usage` and `totalUsage` fields and `onEnd` callbacks. Usage for a whole workflow, including models called inside a Script or Template, will come from Cascada telemetry using the same async call ancestry; see [future features](docs/future.md).

**Implementation status:** JavaScript stream schemas, collectors, Function producers, and Script returns of JavaScript async iterables are implemented. The selected Cascada runtime and published-package handoff remain separate acceptance gates. Cascada's native stream channels and streaming renderer follow in Phase 6; async call context and shared deadlines are Phase 7, with their own upstream prerequisite.

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

<!-- typecheck-skip: phase-5 -->
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

Matching configured values, including inherited values, satisfy required input fields on direct and tool calls. Keep the complete-input schema required; caller requirements account for supplied defaults. Select all declared defaults, merge arguments over tool context over configuration, and parse the complete application object. Supported declaration forms and the remaining API design work are tracked in the [authoritative preparation contract](docs/plan.md#context-sources-and-preparation).

When an argument is missing, `inputSchema` validates the selected configured application value, overlaid by a bound tool-context value when present. A supplied argument replaces that fallback before validation. For configured numeric `factor: 3` without a context override, omission validates `3`, supplying `5` validates `5`, and supplying `'bad'` fails. Parse completed application input together so cross-field checks and transforms work normally. Unrelated configured/context dependencies remain outside this parse. Casai does not filter caller extras before parsing; it rejects retained private collisions afterward, including keys introduced by transforms. Binding creates a new descriptor for fixed defaults without changing the component; it preserves parsed public SDK arguments and native approval behavior.

The [shared configuration](#shared-configuration) and [returned-value reference](#returned-values) define schema settings and result shapes. Optional `toolContextSchema` validates the separate trusted-tool input described in [tool execution context](#tool-execution-context).

Every schema boundary uses its produced value: input, trusted context, output, or stream element. Defaults, stripping, coercions, and transforms affect the invocation; Casai does not write parsed results into shared configuration or caller context. Resolve named configured public defaults and call/model arguments before one input parse. Other configured bindings stay outside the parser, so unrelated inherited values survive a strict input schema. Reject retained private-name collisions before ordinary context merging; no second author-written input schema or silent private-value restoration is needed. Producers/configuration use schema input types where retained; implementations/consumers use output types and ordinary merge precedence. Explicit native SDK tools retain their output-based context typing, including erased raw-input limitations. See [Phase 2](docs/plan.md#schema-parsing-and-context-isolation).

Explicit SDK `Output` and tool objects retain native interfaces, parsing, and transformations. Casai does not rewrite hidden schemas or reparse their results. Casai's own preparation and execution leave supplied context, nested data, configured values, and shared defaults unchanged; native parser behavior, including `.readonly()` freezing, is preserved as described below.

Custom schema callbacks must be **pure**: check or compute a value without changing data they receive, changing shared data, or performing external operations. This applies to validators, refinements, preprocessors, transforms, and default/catch factories. If a transform changes an object or array, return a new one. Copy any nested object you change as well; unchanged parts can stay shared:

<!-- typecheck: pure-transform -->
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

Private binding protection is separate from JavaScript freezing. `Object.freeze(toolContext)` prevents changes to that container's own properties, but does not freeze nested objects, disable a database client's operations, or prevent a new merged object from containing an attacker-supplied replacement. Casai's private-argument checks remain necessary. Do not treat a frozen input as proof that a Cascada managed copy is read-only, either. No automatic deep-freezing of application contexts or clients is part of this contract.

Casai application context schemas accept and produce objects. Templates/scripts support object schemas with refinements and object-producing transforms, including async parsing, as well as SDK object schemas with validators. Configured default selection still requires discoverable raw field declarations. JSON Schema metadata alone does not supply runtime checking. Script/Function output schemas may describe primitive, array, object, or declared stream results. Without an output schema, a Script result is typed as `unknown`, since its source can return arbitrary JavaScript values; Function instead infers its callback return. Zod is re-exported as `z` from `casai` as well as being available from `zod`.

Schema processing uses the SDK's supported schema interfaces, including lazy SDK schemas and Standard Schema. Local validation does not itself require JSON metadata; using configured public defaults or exposing a model tool has the additional declaration/metadata requirements described in the plan.

Configuration may supply some required fields and the call supplies the rest. Resolve those values using the existing merge rules, then validate the merged application context once:

<!-- typecheck: input-defaults -->
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

The shorthand caller and `.run({ context })` use the same input types. A supplied field must match `inputSchema`; a required schema field may be omitted when resolved configuration supplies it. Inherited values count too. Unrelated configured dependencies do not become caller parameters or caller requirements. For a strict schema requiring numeric `value` and `factor`, configured `{ factor: 3, db }` permits `{ value: 2 }` and `{ value: 2, factor: 5 }`, rejects a string factor, still requires `value`, and rejects a caller-supplied `db`. An open schema retains its extra-field types for unrelated names; the composed caller signature must reject identifiable private collisions without making configured dependencies public. Execution settings such as `abortSignal` remain outside `.run()`'s application `context`.

For example, a schema can convert a string without modifying the caller's object:

<!-- typecheck: parsed-input -->
```typescript
const increment = create.Function({
  inputSchema: z.object({ count: z.string().transform(Number) }),
  execute: ({ count }) => count + 1, // count is a number here.
});

const supplied = { count: '2' };
console.log(await increment(supplied)); // 3
console.log(supplied.count); // Still the original string '2'.
```

Ordinary calls and `.run()` resolve source maps, parse final application input, and execute with the produced values plus private/trusted bindings. Do not merge raw schema-governed defaults back afterward. SDK compatibility methods and calls without an effective prompt skip source loading/rendering, but still prepare and validate application context. History alone does not skip a configured prompt. Casai owns this context preparation before model dispatch.

Tool calls follow the [binding preparation contract](docs/plan.md#context-sources-and-preparation). Each immutable binding pairs its descriptor with the raw incoming context used to select public defaults. Its schema awaits asynchronous preparation when necessary; a separate binding may have a different descriptor. Parsed public input enters native records, UI history, and subsequent model requests. Other configured bindings are never automatically copied there, even for open schemas. A retained extra field remains public input and cannot replace a private binding; the [tool execution context contract](#tool-execution-context) explains absent optional names and runtime declarations. The original component schema and shared tool definitions stay unchanged.

The planned tool descriptor also annotates supported JSON-valued public defaults with JSON Schema `default` when their effective source is configuration. A bound-context override prevents advertising the configured value as the fallback; private and incoming context values are never added as default annotations. This does not run application validation, certify an invalid configured placeholder, or modify the original schema in `.config`. See the [bounded projection rules](docs/plan.md#sdk-tool-boundary-and-configured-defaults).

Making a configured argument omittable removes it from the advertised schema's required list while leaving it available for overrides. This can make a previously compatible schema fail a provider's strict mode: [OpenAI strict schemas require all properties to be required](https://developers.openai.com/api/docs/guides/function-calling#strict-mode). Use a compatible non-strict setting for omission-based configured defaults. Casai preserves your strict setting and the provider's errors; it does not silently remove overrideable fields or change the setting.

Configured public defaults remain subject to the final merged parse: an omitted argument can expose an invalid placeholder, while a valid override can repair it. Explicit `{ language: undefined }` replaces the configured public entry before parsing, allowing a schema default to apply or a required schema to reject it. An undeclared configured `db`, including `undefined`, stays outside that parser and cannot be replaced by a retained public extra. Explicitly declare `db` in `inputSchema` to make it public and overrideable.

Bounded union-field discovery is selected for direct calls with configured defaults and union tools with private-only dependencies. It reads declared object-branch names without selecting a branch, and tools retain faithful union metadata when no public defaults require projection. Source-free local union parsing needs no declaration discovery. The [combined runtime/type proof](docs/phase2-composed-api-proof.md) demonstrates these bounded cases; production integration remains pending. General nested composition/reference discovery and union-tool public-default projection remain outside this extension.

Default-aware tool projection supports independent object-root requirements. Unsupported root composition, references, or property-presence/count constraints fail before execution; asynchronous metadata can defer this error until first use. If projection removes a root required field, schemas containing `$ref` in any schema-valued position are unsupported, including nested or recursive references. Literal `$ref` keys in data are unaffected. Nested references remain supported when the root required list is unchanged and the root constraints are supported. The restriction applies only when Casai projects a schema for configured declared defaults, not to unchanged native SDK tools. Provider strict-mode constraints still apply. In particular, OpenAI's strict function schemas require every property to be required, which conflicts with optional/defaulted fields even in native SDK tools. Casai preserves native behavior without nullable sentinels or a strict-mode workaround. See [the projection and native limitations](docs/plan.md#sdk-tool-boundary-and-configured-defaults).

Approval continuations revalidate public arguments with the current tool configuration. Keep declared configured defaults stable for the same approval: changing a default can prevent execution with an SDK tool-error result even while the model continues. Rebuilding a tool with the same public defaults and different trusted `toolsContext` is supported. Request-specific trusted values belong there; public application inputs can remain public. Casai does not rewrite history to bypass native approval validation.

SDK UI helpers validate history against `agent.tools` before invoking the agent or its `prepareCall`. For approval continuation, configure the matching public defaults on the agent passed to the helper; changing them only in `prepareCall` is too late. A mismatch can reject the UI request before the agent runs. See the [binding and UI boundary](docs/plan.md#sdk-tool-boundary-and-configured-defaults).

A default factory is a function such as `.default(() => [])` that creates a fallback value. SDK/Zod conversion can evaluate pure default factories while building the tool's JSON Schema description, as well as during parsing. Do not rely on a factory running only once or only when a tool executes. Casai does not trial-parse incomplete configuration to discover fields or defaults, and metadata conversion must not supply cached invocation context. The actual call still parses its final merged input and uses that result.

Casai-owned direct, `.run()`, and injected-runner argument failures reject with `ValidationError`, retaining the validation cause; Cascada may wrap that rejection through its normal script/render error path. Actual SDK tool validation keeps native SDK errors such as `InvalidToolInputError`. Callback execution errors retain their native behavior.

Script/Function `schema` parses completed values and returns the produced result, preserving output parsing already implemented today. Stream schemas parse elements lazily in the existing consumer pass and forward parsed elements. Application context is prepared before prompt rendering and `prepareCall`; both preparation hooks receive its parsed values. Reuse SDK/Cascada parsing already performed for that same boundary rather than adding another pass. See [shared output schemas](#output-schemas-and-structured-replacements).

**Migration from earlier factories:** input now executes with parsed values: stripping schemas remove undeclared fields, strict schemas reject them, and retained private collisions fail. `_toolCallOptions` no longer bypasses validation. Declare overrideable configured fields in `inputSchema`, and forward trusted dependencies through configuration/tool context. Cascada callers can observe the change even when TypeScript catches typed callers. Ordinary schema stripping gains no warning or extra error. Schema-less calls that override configured defaults need explicit public declarations for those fields; new unrelated arguments remain available without introducing a schema.

When migrating a schema-less component that accepts arbitrary template variables, use an open schema to retain unrelated inputs. A plain `z.object({ name: z.string() })` strips an undeclared `extra` at runtime, and closed-shape call types reject it. `z.looseObject` preserves it:

<!-- typecheck: open-input -->
```typescript
const greeting = create.Template({
  template: 'Hello {{ name }}! {{ extra }}',
  context: { name: 'World' },
  inputSchema: z.looseObject({ name: z.string() }),
});

await greeting({ name: 'Ada', extra: 'Welcome.' }); // Hello Ada! Welcome.
await greeting({ extra: 'Welcome.' });             // Hello World! Welcome.
```

Declare only fields intended to be public: an open schema still cannot replace an undeclared configured dependency. Use a stripping or strict schema instead when dropping or rejecting unrelated fields is intentional. Collision diagnostics identify protected key names, never their configured values; those names must not contain secrets. Supplying the same value as a private binding is also rejected, avoiding an equality-based guessing channel.

Context parsing and rendering failures reject before model execution. Before Phase 7, asynchronous parsing/preparation is awaited normally; shared deadlines require Cascada async call context. Native output/element parsing adds no eager stream consumption or replay; Casai returns a wrapper only where needed to forward parsed elements. Cascada owns healthy complete returns and first-error termination of native `stream`/`tstream`; its Phase 6 schema boundary must supply parsed values without a second Casai pass. Native copying and non-mutating callback contracts replace the generic copy planner. Never claim arbitrary JavaScript or every opaque schema is automatically isolated.

Prepared inputs are checked against the selected operation: model messages for LLMAgents, text or text arrays for Embedder, audio for transcription, and so on. Binary and live-stream inputs retain their native values.

## Errors and Retries

Wrap creation and `await component(...)` in `try/catch` when handling failures. Some invalid configurations throw during creation; input preparation and generation can fail during invocation.

| Error source | How to inspect it |
| :--- | :--- |
| Invalid configuration or unsupported schema/binding contracts, even when discovered lazily | `ConfigError`, exported from `casai` |
| Invalid call arguments or Casai input/context/output/stream-element validation, including unknown approvals in `resume()` and unknown tools in `executeTool()` | `ValidationError`, exported from `casai` |
| Template or script compilation/execution | `TemplateError` or `ScriptError`; inspect `cause` for the underlying failure |
| Provider requests or structured LLMAgent output | SDK error types and their documented instance checks |
| Streaming generation or tool execution | Full-stream `error` / `tool-error` parts, callbacks, and promise/iterator failures |
| Cascada native `stream`/`tstream` failure | Cascada terminates at the first error after the valid prefix; Casai forwards it unchanged |
| Cascada complete return failure | The engine returns its poison/failure outcome instead of a partially failed object |
| Full-stream source failure | All consumers stop at that failure; recovery cannot resume a closed producer |
| No eligible final LLMAgent output, including a legitimate tool/approval pause | `NoOutputGeneratedError` from `value` access or consumption; inspect steps and history for continuation |
| Native stream producers | Iterator failures and native completion/validation errors |

Injected tool calls use Casai's `ValidationError` for argument and tool-context validation, including when the registered tool is a native SDK tool. Private-context validation details remain in `cause`; the public message identifies the failed stage without exposing the rejected context. This matters when a coded workflow is itself a model tool, because execution error messages can become tool output sent to the model. Native SDK-owned validation and errors thrown by tool implementations retain their native behavior. Treat error causes as trusted diagnostics rather than model-facing output.

`ValidationError` and `ConfigError` are distinct classes. Use their `.isInstance(error)` guards across compatible package copies; runtime-validation catches that previously used `ConfigError` must now use `ValidationError`. All Casai error classes live in `src/errors.ts`.

For streaming, handle event errors as well as thrown errors. This example uses the full event stream so tool failures are visible alongside text:

<!-- typecheck: stream-errors -->
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

<!-- typecheck: type-checking -->
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

Inheritance checks the final configuration. A per-call override preserves the component's input and result contracts, so changing output schemas or tool types requires creating a component with that new contract. Native SDK `options` uses the same raw application-input contract as Casai `context`; bodies and hooks receive the prepared context's parsed types.

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
    return { summary: summarize({ topic: topic }).value }
  `,
});

assert.deepEqual(await workflow({ topic: 'recycling' }), {
  summary: 'Summary of recycling',
});
```

To exercise the LLMAgent's full model/tool protocol, supply an AI SDK mock model through `model`; see [SDK testing](https://ai-sdk.dev/docs/ai-sdk-core/testing). Test concurrent `.run()` calls with distinct inputs when verifying invocation isolation, and consume streams in tests that assert final results or completion callbacks. Type-check TypeScript examples separately from executing them.
