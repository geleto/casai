# Casai: AI Orchestration That Writes Like a Story

> **Future version of Casai:** See [README2.md](README2.md) for the planned API. These features are not yet implemented:
>
> - **[LLMAgent](README2.md#llmagent)**: Unify text and structured-output generation and streaming, with [`.asStream`](README2.md#streaming-with-asstream) for a streaming ordinary call, optional tool loops, and AI SDK UI integration.
> - **[Decision](README2.md#decision)**: Answer choice, boolean, and scoring questions.
> - **[Embedding](README2.md#embedding) / [Reranker](README2.md#reranker)**: Generate vectors and rank retrieved documents for search and RAG.
> - **[ImageGenerator](README2.md#imagegenerator)**: Generate and edit images.
> - **[Transcriber](README2.md#transcriber) / [StreamingTranscriber](README2.md#streamingtranscriber)**: Transcribe recordings or live audio; **[SpeechGenerator](README2.md#speechgenerator)** produces speech, and **[VoiceSession](README2.md#voicesession)** supports live voice conversations.
> - **[Streaming workflows](README2.md#streaming-through-templates-and-scripts)**: Stream Template, Script, and Function output in order; a later phase adds out-of-order delivery.
>
> This README describes the existing components and the planned [Phase 1 `.asAgent` addition](#agents-with-asagent). The [implementation design](docs/agents-design.md) tracks the five-phase roadmap.

Building sophisticated and efficient AI systems - from multi-step agents to RAG pipelines - requires orchestrating numerous asynchronous tasks. **Casai is a TypeScript AI orchestration library that makes this radically simpler.** It lets you define these complex workflows with clean, declarative, synchronous-style code. The engine automatically runs independent operations concurrently, giving you the performance of concurrent execution without the complexity of managing it.

In the Cascada script below, `researcher`, `analyst`, and `writer` are distinct Casai components being orchestrated.

```javascript
// 1. These two agents run CONCURRENTLY, automatically.
// The engine sees 'researcher' and 'analyst' are independent and runs them concurrently.
var background = researcher({ topic: topic }).text
var analysis = analyst({ topic: topic }).object

// 2. This agent automatically WAITS for the concurrent tasks to finish.
// No 'await', no Promise.all. Just clean data-flow.
var finalReport = writer({ background: background, analysis: analysis }).text
```

**⚠️ Under active development:** Casai is evolving rapidly - bugs are possible. Issues and contributions are very welcome.

### The Casai Philosophy

Instead of forcing you into rigid graphs or `async/await` hell, Casai is built on a few simple principles:

*   **✍️ Write Logic, Not Graphs.** Express workflows as normal code - variables, functions, loops - not as a brittle graph of nodes and edges. You tell the story, the engine handles the orchestration.

*   **⚡ Parallel by Default, Sequential by Exception.** Independent operations run concurrently automatically. The data-flow engine ensures dependent steps run in the correct order, eliminating race conditions by design. For stateful tasks where order is critical (like database writes), you can enforce a strict sequential chain on those specific operations, without affecting other dataflows.

*   **🧩 Composable & Reusable Components.** Treat every piece of your AI workflow - from a simple generator to a multi-step agent - as a small, callable, and reusable component. This lets you build sophisticated systems from simple, testable parts, avoiding monolithic agent definitions.

*   **💡 Logic vs. Capabilities: A Clear Separation of Concerns.** Define your high-level orchestration **logic** in a script or template. Provide the concrete **capabilities** it uses - like tools, APIs, and data sources - in a separate `context` object. This keeps your workflows clean, readable, and easy to maintain.

### Built on a Solid Foundation

Casai combines its unique orchestration engine with the robust features of modern AI tooling, giving you a complete toolkit.

*   **Powered by the [Cascada Scripting and Templating Engine](https://github.com/geleto/cascada)**, which provides concurrency-first execution for scripts and templates, where async operations are handled implicitly - removing complexity and boilerplate code.

*   **Powered by the [Vercel AI SDK Core](https://ai-sdk.dev/docs/ai-sdk-core):** Get best-in-class features out of the box, including provider flexibility (OpenAI, Anthropic, etc.), structured data generation with Zod, model-driven tool use, and text streaming.

### Learn Casai by Example

The best way to see the power of Casai is to explore real-world code.

See [Smart DB Dashboard](https://github.com/geleto/smart-db-dashboard) and its article, [Cheap, Fast, Concurrent: AI Agents on a Budget](https://github.com/geleto/smart-db-dashboard/blob/main/article.md), for a practical example of building concurrent AI workflows with Casai and Cascada.

 In our [**Casai Examples Repository**](https://github.com/geleto/casai-examples), you'll find practical examples showing AI workflows you can understand at a glance: just clear logic that tells a story. **(Work in progress)**

#### Understanding Cascada

Casai is built on the **[Cascada engine](https://github.com/geleto/cascada)** - a concurrency-first execution engine that provides both scripts and templates for async orchestration. While you can use Casai without deep Cascada knowledge, understanding the fundamentals will help you build more sophisticated workflows.

**Learn the Concepts:**
- [Cascada Script Introduction](https://geleto.github.io/posts/cascada-script-intro/) - A comprehensive introduction to Cascada Script's syntax, features, and how it solves real async programming challenges

**Documentation:**
- [Cascada Script Documentation](https://github.com/geleto/cascada/blob/master/docs/cascada/script.md) - Complete reference for Cascada Script syntax, features, and API
- [Cascada Template Documentation](https://github.com/geleto/cascada/blob/master/docs/cascada/template.md) - Complete reference for Cascada Template syntax and features

# Table of Contents
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Understanding the Casai API](#understanding-the-casai-api)
- [Component Overview and Modifiers](#component-overview)
- [The `prompt` Property: Your Universal Input](#the-prompt-property-your-universal-input)
- [Configuration Management](#configuration-management)
- [The Casai Components](#the-casai-components)
- [Agents with `.asAgent` (Phase 1, planned)](#agents-with-asagent)
- [Agents and Specialized Components (Phase 2 and 3 design)](README2.md)
- [Specialized Components (Phase 3 design)](docs/agents-design.md#phase-3-specialized-components)
- [Callable Component Objects](#callable-component-objects)
- [Using Components as Tools](#using-components-as-tools)
- [Template and Script Properties](#template-and-script-properties)
- [Vercel AI Properties](#vercel-ai-properties)
- [Using Components in Templates and Scripts](#using-components-in-templates-and-scripts)
- [Choosing Your Orchestration Strategy: Scripts, Templates, Context Methods, and Tools](#choosing-your-orchestration-strategy-scripts-templates-context-methods-and-tools)
- [Embedding Integration](#embedding-integration)
- [RAG Integration](#rag-integration)
- [Input and Output Validation with Zod](#input-and-output-validation-with-zod)
- [Type Checking](#type-checking)
- [Project Status and Roadmap](#project-status-and-roadmap)


## Installation

Requires Node.js 24 or later.

Install a Vercel AI SDK 7.x version
```bash
npm install ai
```

Install Casai
```bash
npm install casai
```

Install the specific LLM providers that you plan to use:
```bash
npm install @ai-sdk/openai
```
Check the [Vercel AI SDK Core documentation](https://sdk.vercel.ai/docs/ai-sdk-core) for provider-specific setup details

Rendering uses Cascada's async APIs. `TemplatePromptType` accepts `async-template` and `async-template-name`; `ScriptPromptType` accepts `async-script` and `async-script-name`. The legacy sync variants have been removed. `RaceLoader` is a type-only export; use `race()` to configure concurrent loaders.

## Quick Start

This example demonstrates the core power of Casai by building a **self-improving content agent**. This agent orchestrates a multi-step workflow: it writes a draft, critiques its own work, and then iteratively revises the content until it meets a quality standard.

Here's how it works:

```javascript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { create } from 'casai';
import { z } from 'zod';

// Define a reusable base configuration
const baseConfig = create.Config({ model: openai('gpt-4o'), temperature: 0.7, maxRetries: 3 });

// A component to write drafts (inherits from baseConfig)
const draftGenerator = create.TextGenerator.withTemplate({
	prompt: 'Write a short, engaging blog post about {{ topic }}.',
}, baseConfig);

// A component to critique drafts using a structured schema.
const critiqueGenerator = create.ObjectGenerator.withTemplate({
	schema: z.object({
		score: z.number().describe('Quality score from 1-10.'),
		suggestions: z.array(z.string()).describe('Actionable suggestions for improvement.'),
	}),
	prompt: 'Critique this blog post: {{ draft }}',
}, baseConfig);

// A component to rewrite a draft based on feedback
const revisionGenerator = create.TextGenerator.withTemplate({
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
      var currentDraft = draftGenerator({ topic: topic }).text
      var critique = critiqueGenerator({ draft: currentDraft }).object

      // Iteratively revise until the quality threshold or maxRevisions is met
      while (critique.score < qualityThreshold or revisionCount < minRevisions) and revisionCount < maxRevisions
        revisionCount = revisionCount + 1
        currentDraft = revisionGenerator({ draft: currentDraft, suggestions: critique.suggestions }).text
        critique = critiqueGenerator({ draft: currentDraft, suggestions: critique.suggestions }).object
      endwhile

      return { finalDraft: currentDraft, finalScore: critique.score, revisionCount: revisionCount }`,
});

// Run the agent
const result = await contentAgent();
console.log(JSON.stringify(result, null, 2));
```

# Understanding the Casai API

## Components: The Heart of Casai

At the core of *Casai* are **components** - versatile objects that transform inputs into outputs. They are the building blocks for your workflows, designed to be both powerful and easy to compose. Every component is created using the `create` factory and is callable with `()`. LLM components also offer an advanced `.run()` method for runtime overrides.

### Component Overview

This table covers the current factories. `Config` creates reusable settings and is not a callable component. See the [Phase 2 and 3 overview](README2.md#component-overview) for the planned Agent and specialized factories. Component names link to Casai usage; SDK references cover detailed model settings and results. Linked result fields go directly to SDK return-value documentation, where available. Only the main inputs and result fields are listed here.

| Component | What it does | Main inputs → result | SDK reference |
| :--- | :--- | :--- | :--- |
| [Config](#configuration-management) | Share configuration | Settings and optional parent → `.config` | — |
| [Template](#template) | Render a Cascada template | Template and context → string | — |
| [Script](#script) | Execute a Cascada workflow | Script and context → returned value | — |
| [Function](#function) | Wrap JavaScript logic | Arguments/context → returned value | — |
| [TextGenerator](#textgenerator) | Generate a complete text response | Prompt/messages or rendering context → [.text](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text#returns) | [generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) |
| [TextStreamer](#textstreamer) | Stream a text response | Prompt/messages or rendering context → [.textStream, final .text](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#returns) | [streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) |
| [ObjectGenerator](#objectgenerator) | Generate validated structured data | Prompt/messages or rendering context → `.object` | [SDK Output](https://ai-sdk.dev/docs/reference/ai-sdk-core/output) |
| [ObjectStreamer](#objectstreamer) | Stream structured data | Prompt/messages or rendering context → `.partialObjectStream`, final `.object` | [SDK Output](https://ai-sdk.dev/docs/reference/ai-sdk-core/output) |

Model results also retain metadata and SDK features described in their component sections. Current Object components expose Casai's object result contract; the SDK Output reference describes the modern structured-output API. [Phase 1 `.asAgent`](#agents-with-asagent) opts into modern agent results with the documented object aliases.

#### Modifier Support

✅ = available; ❌ = not exposed; ✅¹ = planned for Phase 1, not implemented. Checkboxes describe factory modifiers, not methods on a created component.

| Component | [.withText](#the-default-behavior-plain-text) | [.withTemplate](#the-with-family-for-inline-content) | [.withScript](#the-with-family-for-inline-content) | [.withFunction](#the-with-family-for-inline-content) | [.loadsText](#the-loads-family-for-external-content) | [.loadsTemplate](#the-loads-family-for-external-content) | [.loadsScript](#the-loads-family-for-external-content) | [.asTool](#using-components-as-tools) | [.asAgent](#agents-with-asagent) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [Config](#configuration-management) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| [Template](#template) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| [Script](#script) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| [Function](#function) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| [TextGenerator](#textgenerator) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅¹ |
| [TextStreamer](#textstreamer) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅¹ |
| [ObjectGenerator](#objectgenerator) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅¹ |
| [ObjectStreamer](#objectstreamer) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅¹ |

`Template`, `Script`, and `Function` perform their named operation by default; they do not have matching `.withTemplate`, `.withScript`, or `.withFunction` aliases. `Script.loadsScriptAsTool` is an alias for `Script.loadsScript.asTool`. For LLM factories, `.withText` is the default. Supported modifiers compose in prompt-modifier, optional `.asAgent`, optional `.asTool` order; see [Phase 1](#agents-with-asagent) for planned combinations.

### Calling a Component

```typescript
const result = await component({ topic: 'AI' });                    // Standard call
const result = await component.run({ context: { topic: 'AI' }, temperature: 0.9 }); // Advanced override
```

The standard call can only set optional arguments for `prompt`, `context`, and `messages` - which covers the majority of use cases. The `.run()` method allows you to override any LLM parameter for advanced scenarios.

All components can be considered **renderers**, as they all produce an output (rendering text, data, or a stream). However, `Script` and `Function` components can also act as powerful **orchestrators**, defining and coordinating complex, multi-step workflows.

In Casai, you build workflows by making a **component** using the `create` factory for a specific task, like `TextGenerator`. You provide a configuration object with essential settings like the `model` to use and the `prompt` to send. To reuse settings, simply create a `Config` object and pass it as a second argument to have your component inherit from it. Or you can inherit the configuration of a component from another component.

```typescript
import { create } from 'casai';
import { openai } from '@ai-sdk/openai';

// Create a simple component with an inline configuration
const jokeGenerator = create.TextGenerator({
  model: openai('gpt-4o-mini'),
  prompt: 'Tell me a short, clean joke.',
});
```

A key feature is that **every component is a callable function**. This provides several powerful ways to use them:

1.  **With Pre-configured Input**: Call the component with no arguments (`await component()`) or just a context object (`await component({ user: 'Admin' })`) to use its configured prompt, script, or template.
2.  **With One-off Input**: Call the component with new arguments (`await component(newInput, newContext)`) for dynamic, on-the-fly execution. Both arguments are optional. The behavior of `newInput` depends on how the component was created.

### The Default Behavior: Plain Text

By default, LLM components (`TextGenerator`, `ObjectGenerator`, `TextStreamer`, `ObjectStreamer`) treat the `prompt` string as plain, unprocessed text.

```typescript
// The prompt is treated as static text, with no template processing.
const plainTextComponent = create.TextGenerator({
    model: openai('gpt-4o-mini'),
    prompt: 'Write a poem about the sea.'
});
```

### Adding Capabilities with Modifiers

To add dynamic processing capabilities like generating prompts with templates or scripts, or creating a tool - you use explicit modifiers on the base factory function. These modifiers "enhance" the base component with specific capabilities.

#### The `.with...` Family for Inline Content:
These modifiers create a component that adds the capability to render the prompt by processing it as a template, script, or function.
*   `default` with no modifier : the `prompt` property is a plain text.
*   `.withTemplate(...)`: the `prompt` property is a template.
*   `.withScript(...)`: the `prompt` property is a script
*   `.withFunction(...)`: the `prompt` property is a Javascript function.

#### The `.loads...` Family for External Content:
These modifiers create a component designed to load its prompt or script from an external source via a `loader`.

A loader, provided in the configuration objects, can be any of the built-in loaders - like FileSystemLoader (for Node.js), WebLoader (for browsers), or your own custom implementation.

*   `.loadsText(...)`: Loads the `prompt` and treats it as plain text.
*   `.loadsTemplate(...)`: Loads the `prompt` and treats it as a template.
*   `.loadsScript(...)`: Loads the `prompt` and treats it as a script.

#### The `.asTool` Modifier: Instantly Create LLM-Callable Tools
Turn non-streaming components into a powerful, model-driven tool by appending the `.asTool` modifier. This upgrades your component into a hybrid object: it remains a callable function for you to use directly in your code, while also becoming a fully-formed tool that an LLM can understand and decide to call.

To make this happen, just add two properties to your configuration:
*   `description`: A clear, natural language explanation of what the tool does. This is the LLM's guide.
*   `inputSchema`: A Zod schema defining the arguments the tool accepts, ensuring type-safe inputs from the model.

This modifier can be chained with any content loader, allowing you to create sophisticated tools from templates or scripts: `create.TextGenerator.withTemplate.asTool(...)`.

### Callable Component Objects

Every component can be invoked in two primary ways: the standard `()` call for most use cases, and the `.run()` method for advanced runtime overrides.

#### The Standard `()` Call
This is the most common and straightforward way to use a component. You can invoke it with optional arguments for `prompt`and `context` - which covers the majority of use cases. You can invoke it with a new prompt and/or context, or with no arguments to use its pre-configured settings. For conversational components (`TextGenerator` and `TextStreamer`), you can also pass a `messages` array to manage the chat history. See the [Conversational AI](#conversational-ai-managing-message-history) section for a detailed guide.

```typescript
// Created as a template component
const dynamicComponent = create.Template({
    template: 'Hello {{ name }}',
    context: { name: 'World' }
});

// 1. Using configured pre-compiled template and context
const result = await dynamicComponent();
console.log(result); // "Hello World"

// 2. With a one-off template and context
// The one-off input is also processed as a template
const result2 = await dynamicComponent('Hi {{ user }}', { user: 'Alice' });
console.log(result2); // "Hi Alice"
```

Configured inline templates and scripts are compiled for reuse; syntax errors are reported when the component is called. Named text, templates, and scripts load on first use, so a one-off name can bypass a missing configured resource. One-off inline inputs are compiled for that call.

#### Advanced Overrides with the `.run()` Method
For advanced scenarios where you need to temporarily adjust LLM parameters for a single call without creating a new component, Casai provides the `.run()` method.

This method is available specifically on **LLM components** (`TextGenerator`, `TextStreamer`, `ObjectGenerator`, and `ObjectStreamer`). It accepts a single configuration object where you can override properties like `model`, `temperature`, and `maxOutputTokens`, or replace configured tools with implementations that have compatible input, output, and SDK context types. Create a new component to add tools or change their contracts.

**Overridable Properties**

You can temporarily change supported generation settings and call inputs, depending on the component:

*   `model`
*   `temperature`
*   `maxOutputTokens`
*   `stopWhen`
*   `tools`
*   `toolsContext`
*   `prompt`
*   `messages`
*   `context`

**Immutable Properties**

Properties that are fundamental to the component's setup, compilation, or return type are locked in at creation and cannot be overridden. This includes:

*   `schema`
*   `inputSchema`
*   `contextSchema`
*   `promptType`
*   `output` (for `ObjectGenerator`/`Streamer`)
*   `enum` (for `ObjectGenerator`)
*   `filters`
*   `options`
*   `loader`

**Example:**

```typescript
const storyWriter = create.TextGenerator.withTemplate({
  model: openai('gpt-4o-mini'),
  temperature: 0.5, // Default setting for balanced output
  prompt: 'Write a short story about {{ topic }}.'
});

// Standard call with default temperature
const standardStory = await storyWriter({ topic: 'a friendly robot' });

// Use .run() to override the temperature for a more creative, one-off story
const creativeStory = await storyWriter.run({
  prompt: 'Write a very creative story about {{ topic }}.',
  context: { topic: 'a mischievous dragon' },
  temperature: 0.9, // Overridden for this call only
  maxOutputTokens: 50,
});
```

Use the standard `()` call for simplicity in most cases. Use `.run()` when you need control over LLM parameters for specific invocations.

## The `prompt` Property: Your Universal Input

In Casai, the `prompt` property is the versatile heart of every LLM component. Its behavior is determined by the factory method you use to create the component. The modifier - like `.withTemplate` or `.withScript` - sets the "mode" for how the `prompt` content will be processed before being sent to the LLM.

Here is a complete guide to its different modes:

| Creation Method | `prompt` Property Content | Processing Behavior |
| :--- | :--- | :--- |
| `create.TextGenerator(...)` | A static `string` or `ModelMessage[]` array. | The content is sent **directly** to the Vercel AI SDK with no processing. A call-time prompt replaces the configured prompt; configured `messages` precede it. |
| `create.TextGenerator.withTemplate(...)` | A `string` containing a Cascada **template**. | The template is **rendered** into a final `string`, which becomes the LLM prompt. It only renders text and thus cannot produce a `ModelMessage[]` array. |
| `create.TextGenerator.withScript(...)` | A `string` containing a Cascada **script**. | The script is **executed**. Its return value - which can be a `string` or a `ModelMessage[]` array - becomes the LLM prompt. |
| `create.TextGenerator.withFunction(...)` | A synchronous or asynchronous JavaScript **function**. | The function is **executed**. Its return value - which can be a `string` or a `ModelMessage[]` array - becomes the LLM prompt. |

By embracing this single-property pattern, you only need to remember one rule: **the factory modifier defines the `prompt`'s behavior.**

## Configuration Management

Casai allows you to define shared configuration through `Config` objects that can be inherited by other components:

```typescript
import { create } from 'casai';
import { openai } from '@ai-sdk/openai';

// Create a base configuration
const baseConfig = create.Config({
  model: openai('gpt-4o'),
  temperature: 0.7,
  context: {
    language: 'en'
  }
});

// Create a component that inherits from base config
const component = create.TextGenerator.withTemplate({
  prompt: 'Translate to {{ language }}: {{ text }}'
}, baseConfig);

// The component inherits model, temperature, and context from baseConfig
```

`create.Config` accepts incomplete configurations so that children can supply required properties later. It checks supplied properties for compatibility after merging with its parent. For example, a `schema` can be shared by a Function, Script, or ObjectGenerator, but combining `template` with `execute` is rejected. Concrete component factories then check required properties such as `model` or `execute`.

### Property Inheritance Explained

A child configuration inherits properties it omits; supplied properties either replace inherited values or merge with them, according to the rules below. These rules apply to parent `Config` objects, component inheritance, and [allowed `.run()` overrides](#advanced-overrides-with-the-run-method). A `.run()` override applies only to that call.

| Properties | Merging Strategy |
| :--- | :--- |
| All other properties, including `model`, `prompt`, `template`, `script`, `schema`, `inputSchema`, `contextSchema`, `execute`, `options`, and `providerOptions` | **Replace**: The child's entire value replaces the parent's, including when the value is an object. |
| `context`, `filters`, `tools`, `toolsContext` | **Shallow merge by key**: Keep keys unique to the parent; the child replaces values at matching keys. |
| `messages` | **Concatenate**: Parent messages come first, followed by child messages. |
| `loader` | **Merge loader chains**: Child loaders take priority; named `race()` groups combine and duplicate loader instances are removed. |

#### Detailed Merging Strategies

1. **Replace other properties.** A child can replace a property with a new value. For example, a new `schema` replaces the inherited schema, and a new `options` object replaces the entire inherited options object. The resulting configuration must still satisfy the component's requirements.

2. **Merge maps by key.** `context` and `filters` retain inherited entries unless the child supplies the same key. `tools` and `toolsContext` follow the same rule, using tool names as keys. Each matching entry is replaced in full, including nested objects and each tool's context value. Values are not recursively merged.

3. **Append messages.** A child's `messages` array is appended to the inherited array. This preserves the order of configured conversation messages.

4. **Merge loaders.** Child loaders are searched before parent loaders. Loaders in named `race()` groups with the same name are combined into one group, and duplicate loader instances are removed.

#### Nested Context Values

Context merging preserves top-level keys unique to the parent. A nested object at a matching key is replaced:

```typescript
const parent = create.Config({
  context: { language: 'en', settings: { tone: 'formal', length: 'short' } }
});
const child = create.Config({
  context: { name: 'Alice', settings: { tone: 'casual' } }
}, parent);

console.log(child.config.context);
// { language: 'en', name: 'Alice', settings: { tone: 'casual' } }
// language survives; settings.length is lost because settings is replaced.
```

#### Omitted Properties and Explicit `undefined`

Omitting a property keeps its inherited value. Explicit `undefined` follows the property's merging rule:

| Child setting | Effect on inherited configuration |
| :--- | :--- |
| An ordinary property set to `undefined`, such as `schema: undefined` | Replaces the inherited value with `undefined`. |
| `context: undefined`, `filters: undefined`, `tools: undefined`, or `toolsContext: undefined` | Keeps the inherited map entries. An empty object also keeps them. |
| An entry set to `undefined`, such as `context: { language: undefined }` | Replaces that entry's value with `undefined`; other entries survive. |
| `messages: undefined` or `messages: []` | Keeps the inherited messages. |
| `loader: undefined` or `loader: []` | Keeps the inherited loader chain. |

Component requirements still apply. Replacing a required `model`, `execute`, output `schema`, or tool `inputSchema` with `undefined` makes the configuration invalid. Reusable `Config` fragments can remain incomplete; concrete factories check these requirements at creation.

#### Example in Action

Here's how these rules play out in practice:

```typescript
const rootConfig = create.Config({
  model: openai('gpt-4o'),
  prompt: 'Output exactly: Root {{ var }}',
  context: { var: 'root', theme: 'dark' }, // Initial context
  filters: { uppercase: (s) => s.toUpperCase() }
});

const midConfig = create.Config({
  prompt: 'Output exactly: Mid {{ var }}', // Overrides root prompt
  context: { var: 'mid' }, // Overrides 'var', keeps 'theme' from root
  filters: { lowercase: (s) => s.toLowerCase() } // Merges with uppercase filter from root
}, rootConfig);
// Resulting context: { var: 'mid', theme: 'dark' }

const parentComponent = create.TextGenerator.withTemplate({
  prompt: 'Output exactly: Parent {{ var }}', // Overrides mid prompt
  context: { user: 'guest' }, // Adds 'user', keeps 'var' and 'theme' from mid
}, midConfig);
// Resulting context: { var: 'mid', theme: 'dark', user: 'guest' }

const childComponent = create.TextGenerator.withTemplate({
  prompt: 'Output exactly: Child {{ var }} {{ user }}', // Overrides parent prompt
}, parentComponent);
// Final context: { var: 'mid', theme: 'dark', user: 'guest' }

(async () => {
  console.log((await childComponent()).text); // "Child mid guest"
  // Final filters: { uppercase, lowercase }
})();
```

### Inspecting the Final Configuration
Inspect the resolved settings through `.config` on `Config`, `Template`, `Script`, and LLM components. `Function` and `Function.asTool` expose configuration properties directly on the callable, such as `fn.inputSchema`, `fn.schema`, and `fn.context`.
```typescript
console.log(childComponent.config);
// Outputs the fully resolved configuration object
```

Set `debug: true` on a component or a parent `Config` to log configuration merges, component creation, and calls to the console. A child can set `debug: false` to turn off inherited logging.

## The Casai Components

### Your Toolkit for Every Task

*Casai* offers a suite of components, each tailored to a specific job - whether it's executing scripts, rendering templates, generating or streaming text and data. The LLM components (Generate/Stream Object/Text), built on the Vercel AI SDK, share a common foundation where each LLM component has a corresponding Vercel AI SDK Core function.

Let's explore each component in detail.

### Template

**What it does**: Processes a Cascada template to produce a final string output, with no LLMs involved. Ideal for presentation-layer tasks like generating HTML or Markdown. An optional `inputSchema` can be used to validate the `context` data.

#### How to Create It
*   **Providing the Template Directly**: This is the default behavior. The `template` property contains the template string.
    ```typescript
    import { create } from 'casai';

    const component = create.Template({
      template: 'Hi {{ name }}! Today is {{ currentDay }}.',
      context: { name: 'User' }
    });
    ```
*   **Loading from a resource with `.loadsTemplate`**: Use this modifier to load the template from an external source. This requires a `loader`, and the `template` property now specifies the *name* of the template to load (e.g., a filename).
    ```typescript
    import { create, FileSystemLoader } from 'casai';

    const fileComponent = create.Template.loadsTemplate({
      loader: new FileSystemLoader('./templates'),
      template: 'welcome_email.njk', // This is the filename
      context: { name: 'User' }
    });
    ```

#### How to Call It
You can call any `Template` with a new template and context.
*   **With pre-configured input**:
    ```typescript
    const result = await component({ currentDay: 'Monday' }); // "Hi User! Today is Monday."
    ```
*   **With a one-off template string**:
    ```typescript
    const oneOffResult = await component('A new template for {{ name }}', { name: 'Alice' }); // "A new template for Alice"
    ```
*   **With a one-off template file** (if created with `.loadsTemplate`):
    ```typescript
    const otherFileResult = await fileComponent('goodbye_email.njk'); // Loads and renders a different file
    ```
**Use it for**: Generating HTML, dynamic reports, email templates, or any task needing flexible, non-LLM rendering where the final output is a string.

#### Using as a Tool (`.asTool`)
You can expose a `Template` component as a tool for an LLM to call. This is useful when you want the LLM to be able to generate a formatted string based on structured input.
```typescript
const reportTool = create.Template.asTool({
  description: 'Generates a formatted user summary string.',
  inputSchema: z.object({ name: z.string(), activity: z.number() }),
  template: 'User Report: {{ name }} has an activity score of {{ activity }}.'
});
```

### Script

**What it does**: Executes a Cascada script to produce a structured data object (JSON). It is the ideal tool for orchestrating data sources, running multi-step logic, and building the data layer of your application. An optional Zod `schema` can be provided to validate the script's output, and an `inputSchema` can validate the `context`.

#### How to Create It
*   **Providing the Script Directly**: This is the default behavior. The `script` property contains the script string.
```typescript
import { create } from 'casai';
import { z } from 'zod';

const dealFinder = create.Script({
  // Validate the final output object
  schema: z.record(
    z.string(), // e.g., "sku-a123"
    z.array(z.object({ vendor: z.string(), price: z.number() }))
  ),
  // Validate the input context
  inputSchema: z.object({
    productIds: z.array(z.string()),
    vendors: z.array(z.string())
  }),
  context: {
    getPrice: async (productId, vendor) => ({
      vendor,
      price: Math.floor(Math.random() * 101) + 100,
    }),
  },
  script: `
    data result
    for productId in productIds
      for vendor in vendors
        var priceInfo = getPrice(productId, vendor)
        result[productId].push(priceInfo)
      endfor
    endfor
    return result.snapshot()
  `,
});
```

*   **Loading from a resource with `.loadsScript`**: Use this modifier to load the script from an external source. This requires a `loader`, and the `script` property now specifies the *name* of the script to load.
    ```typescript
    const agentRunner = create.Script.loadsScript({
      loader: new FileSystemLoader('./scripts'),
      script: 'content_agent.csc', // The filename of the script
    });
    ```

#### How to Call It
You can execute a new script dynamically by passing it as an argument.
*   **With pre-configured input**:
    ```typescript
    const result = await dealFinder({
      productIds: ['sku-a123', 'sku-b456'],
      vendors: ['VendorX', 'VendorY']
    });
    ```
*   **With a one-off script string**:
    ```typescript
    const runner = create.Script({ script: 'return "configured-id"' });
    const oneOffResult = await runner(`
      return "new-id"
    `); // "new-id"
    ```
*   **With a one-off script file** (if created with `.loadsScript`):
    ```typescript
    const otherAgentResult = await agentRunner('cleanup_agent.csc'); // Loads and runs a different script
    ```

#### Using as a Tool (`.asTool`)
Exposing a `Script` as a tool allows an LLM to trigger complex, multi-step data orchestration tasks.
```typescript
const userOnboardingTool = create.Script.asTool({
    description: 'Onboards a new user by creating a profile and sending a welcome email.',
    inputSchema: z.object({ name: z.string(), email: z.string() }),
    context: { /* db, emailService, ... */ },
    script: `
      var profile = db.createUser({ name: name, email: email })
      var emailStatus = emailService.sendWelcome(email)
      return { userId: profile.id, emailSent: emailStatus.success }
    `
});
```

**Use it for**: Building type-safe data layers, orchestrating multi-step agentic workflows, and fetching and aggregating data from multiple APIs/databases. For a deep dive into the scripting language, see the **[Cascada Script Documentation](https://github.com/geleto/cascada/blob/master/docs/cascada/script.md)**.

### TextGenerator

**What it does**: Generates text via LLMs using Vercel's [`generateText` function](https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-text). It can operate on a single `prompt` or a full conversational `messages` history. The `prompt` for the LLM can be provided as static text, or generated dynamically via a template or a script. This component is ideal for use cases where you need the complete text before proceeding, such as summarizing a document or calling tools.

#### How to Create It
*   **Default (Plain Text)**: The `prompt` is a static string with no processing. You can also provide a `ModelMessage[]` array in the `prompt` property to define a multi-message prompt, which is possible only for text-only components, not as input to those created with `.withTemplate` or `.withScript`.
    ```typescript
    const staticGenerator = create.TextGenerator({ model: openai('gpt-4o'), prompt: 'Summarize the concept of photosynthesis.' });
    ```
*   **With a Template (`.withTemplate`)**: The `prompt` is a Cascada template string.
    ```typescript
    const templateGenerator = create.TextGenerator.withTemplate({ model: openai('gpt-4o'), prompt: 'Describe {{topic}} in a single paragraph.' });
    ```
*   **With a Script (`.withScript`)**: The `prompt` property contains a Cascada script. The script can return a `string` (which becomes the prompt) or a `ModelMessage[]` array (for a multi-message prompt).
    ```typescript
    const scriptGenerator = create.TextGenerator.withScript({
      model: openai('gpt-4o'),
      prompt: `
        return "Summarize the key points from: " + article
      `
    });
    ```
*   **Loading from a resource (`.loads...`)**: Load the `prompt` from a file or other resource using a loader. The input can be treated as plain text (`.loadsText`), a template (`.loadsTemplate`), or a script (`.loadsScript`).
    ```typescript
    const loadedGenerator = create.TextGenerator.loadsTemplate({ loader, model: openai('gpt-4o'), prompt: 'summarize_article.njk' });
    ```

#### How to Call It
You can call a `TextGenerator` with a new `prompt`, `messages` array, `context` object, or a combination. The call returns a promise that resolves when the model has finished generating its response.

```typescript
const { text, toolCalls } = await templateGenerator({ topic: 'The Sun' });
```

#### Using as a Tool (`.asTool`)
Wrap a `TextGenerator` to create a tool that generates text based on structured input.
```typescript
const summarizeTool = create.TextGenerator.withTemplate.asTool({
  model: openai('gpt-4o-mini'),
  description: 'Summarizes a given piece of text into a single sentence.',
  inputSchema: z.object({ text: z.string() }),
  prompt: 'Provide a concise, one-sentence summary of: {{ text }}',
});
```

#### Return Value
When you `await` a `TextGenerator` call, it returns a promise that resolves to a rich result object, identical to the one from the Vercel AI SDK's [`generateText`](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#generatetext) function. Key properties include:
*   **`text`**: The generated text as a string.
*   **`toolCalls`**: An array of tool calls from all generation steps.
*   **`toolResults`**: An array of results from the executed tools across all generation steps.
*   **`finishReason`**: The reason the model stopped generating (e.g., `'stop'`, `'tool-calls'`).
*   **`usage`**: Token usage information for the generation.
*   **`response`**: The raw response object, which contains:
    *   **`messages`**: An array of the new messages from the current turn (the user prompt message and the assistant's reply).
    *   **`messageHistory`**: The complete, updated message history, ready to be passed to the next conversational turn. It excludes static messages from the component's configuration.

***

### TextStreamer

**What it does**: Streams LLM text in real time using Vercel's [`streamText` function](https://sdk.vercel.ai/docs/ai-sdk-core/stream-text). It shares the same creation patterns and message handling capabilities as `TextGenerator`, making it ideal for interactive applications like chatbots.

> **Note**: Streaming components like `TextStreamer` cannot be exposed as tools to an LLM, as the tool-use protocol requires a single, resolved response, not a stream.

#### How to Create It
`TextStreamer` is created with the same flexible modifiers as `TextGenerator`, allowing you to provide the prompt as static text, a `ModelMessage[]` array, or generate it dynamically from a template or script.

*   **Default (Plain Text)**:
    ```typescript
    const staticStreamer = create.TextStreamer({ model: openai('gpt-4o'), prompt: 'Write a short story.' });
    ```
*   **With a Template (`.withTemplate`)**:
    ```typescript
    const templateStreamer = create.TextStreamer.withTemplate({
      model: openai('gpt-4o'),
      prompt: 'Write a short story about a robot named {{ name }}.'
    });
    ```
*   **With a Script (`.withScript`)**: The script (provided in the `prompt` property) can return a prompt string or a full `ModelMessage[]` array.
    ```typescript
    const scriptStreamer = create.TextStreamer.withScript({
      model: openai('gpt-4o'),
      prompt: `
        return "Write a story based on this premise: " + premise
      `
    });
    ```
*   **Loading from a resource (`.loads...`)**: Load the `prompt` from a file. It can be treated as plain text (`.loadsText`), a template (`.loadsTemplate`), or a script (`.loadsScript`).
    ```typescript
    const loadedStreamer = create.TextStreamer.loadsTemplate({ loader, model: openai('gpt-4o'), prompt: 'story_prompt.njk' });
    ```

#### How to Call It
Calling a `TextStreamer` returns its result object without waiting for the model to respond. This object contains the stream and promises that will resolve when the stream is complete. A plain-text streamer returns the result object directly. A streamer that renders or loads its prompt (`.withTemplate`, `.withScript`, `.withFunction`, and the `.loads...` modifiers) returns a promise that resolves to the result object once the prompt is ready.

```typescript
// A plain-text streamer returns the result directly
const staticResult = staticStreamer();

// A template streamer resolves once its prompt is rendered
const result = await templateStreamer({ name: 'Zorp' });

// You can then consume the stream
for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}
```

#### Return Value and Handling the Stream
The result object from a `TextStreamer` call is multifaceted, providing both streams for real-time consumption and promises for final data. It is identical to the one returned by the Vercel AI SDK's [`streamText`](https://sdk.vercel.ai/docs/ai-sdk-core/streaming-text#streamtext) function.

**Real-time Streams:**
*   **`textStream`**: A `ReadableStream` and `AsyncIterable` of text chunks. This is the primary stream for displaying generated text to a user in real time.
*   **`fullStream`**: A more advanced stream that provides all event types, including text deltas, tool calls, and lifecycle events (`'start'`, `'finish'`).

**Promises for Final Data:**
The result object also contains several promises that resolve **after** the stream has finished.
*   **`text`**: A promise that resolves to the full generated text string.
*   **`toolCalls`**: A promise that resolves to an array of any tool calls made.
*   **`finishReason`**: A promise that resolves to the reason the model stopped generating.
*   **`usage`**: A promise that resolves to the final token usage.
*   **`response`**: A promise that resolves to the raw response object, which contains:
    *   **`messages`**: An array of the new messages from the current turn (the user prompt message and the assistant's reply).
    *   **`messageHistory`**: The complete, updated message history, ready to be passed to the next conversational turn. It excludes static messages from the component's configuration.

**Callbacks for Fine-Grained Control:**
You can provide callbacks in the component's configuration to handle events as they happen.
*   **`onFinish`**: Called when the stream is complete, containing the final `text`, `usage`, and `response` (with `messages` and `messageHistory`).
*   **`onError`**: Called if an error occurs during streaming.
*   **`onChunk`**: Called for each individual chunk processed in the stream.

***

### Agents with `.asAgent`

> **Phase 1, planned:** `.asAgent` is not implemented yet. This is an opt-in addition to the four existing LLM factories. Their ordinary forms retain their current behavior. [Phase 2](README2.md) later introduces a universal `LLMAgent` factory, with `.asStream` for a streaming ordinary call, the SDK agent interface always available, and loop behavior configured through `stopWhen`, without an `.asAgent` modifier.

Add `.asAgent` to a factory to create a Casai component with a multi-step loop policy and the AI SDK [`Agent` interface](https://ai-sdk.dev/docs/reference/ai-sdk-core/agent). The returned component remains callable and supports `.run()`, `.config`, rendering, validation, inheritance, and conversation history. It also exposes native `.generate()` and `.stream()` methods for SDK consumers.

| Factory | Callable and `.run()` | Native `.generate()` | Native `.stream()` |
| :--- | :--- | :--- | :--- |
| `TextGenerator.asAgent` | Generate text | Generate | Stream |
| `TextStreamer.asAgent` | Stream text | Generate | Stream |
| `ObjectGenerator.asAgent` | Generate structured output | Generate | Stream |
| `ObjectStreamer.asAgent` | Stream structured output | Generate | Stream |

All four share an implementation backed by `generateText` and `streamText`. These SDK functions perform the model/tool loop. Casai implements the basic `Agent` interface directly; it does not need a `ToolLoopAgent` instance or a separate loop engine.

Phase 2 reuses this core. Its `LLMAgent` factory defaults to `Output.text()` and `isStepCount(1)` unless settings were supplied or inherited. It replaces `.run()` with `.generate()` and `.stream()`, which also implement the SDK interface; `.asStream` changes only the ordinary call's default operation.

#### Creation and Standard Calls

The examples assume an application-provided `model` and `tools` map.

```typescript
import { create } from 'casai';
import { isStepCount } from 'ai';
import { z } from 'zod';

const agentConfig = create.Config({
  model,
  tools,
  stopWhen: isStepCount(10),
});

const agent = create.TextGenerator.asAgent({}, agentConfig);
const result = await agent('Research battery recycling.');
console.log(result.text);

const streamingAgent = create.TextStreamer.asAgent({}, agentConfig);
const stream = await streamingAgent('Research battery recycling.');
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}

const researcher = create.ObjectGenerator.withTemplate.asAgent({
  prompt: 'Research {{ topic }}. Answer in {{ language }}.',
  inputSchema: z.object({ topic: z.string() }),
  context: { language: 'English' },
  schema: z.object({ summary: z.string(), findings: z.array(z.string()) }),
}, agentConfig);

const report = await researcher({ topic: 'battery recycling' });
console.log(report.object.summary); // Also available as report.output.summary.

const frenchReport = await researcher.run({
  context: { topic: 'battery recycling', language: 'French' },
  temperature: 0.4,
  stopWhen: isStepCount(5),
});
```

`.asAgent` supplies `isStepCount(20)` only when no stopping condition was supplied or inherited. An explicit `stopWhen` takes precedence, including through `.run()`. It limits the loop; execution can finish earlier. `isStepCount` is the AI SDK 7 name for the earlier `stepCountIs` helper. Existing text components already support multi-step execution with an explicit stopping condition; `.asAgent` adds a reusable agent contract and a convenient default policy.

The modifier works after `.withText` (the default), `.withTemplate`, `.withScript`, `.withFunction`, `.loadsText`, `.loadsTemplate`, and `.loadsScript`. It is a factory modifier, as in `create.TextGenerator.withTemplate.asAgent(config, parent)`. Pass a `Config` or another component as the second argument and inspect the resolved configuration through `.config`.

Calls follow the existing [component conventions](#callable-component-objects): plain-text components accept prompt strings and model messages; rendered components accept context. A configured prompt permits a no-argument call when required inputs are satisfied. Use `.run({ context, temperature, ... })` for overrides. There is no new `input` envelope, and a context field named `prompt` remains data.

`inputSchema` validates raw call-time context before configured context is merged. Required fields must be supplied on the call. Loaded prompts, prompt overrides, function prompts, and validation-only input semantics keep their existing contracts.

#### Overrides, Results, and Streaming

`.run()` applies allowed overrides to that invocation only, following Casai's [merge rules](#property-inheritance-explained). Concurrent runs cannot change each other's settings, the component's `.config`, or its public tools. Input/output contracts and renderer setup remain fixed.

The new `.asAgent` components use the modern SDK result family for both text and structured output. Results preserve steps, tool calls, usage, metadata, response methods, and streaming events. `.output` is the final parsed value, not a nested agent or result wrapper. Object variants additionally expose `.object` as an alias of `.output`, and `.partialObjectStream` as an alias of `.partialOutputStream`. Streaming final values are awaitable.

These aliases retain familiar object access; they do not reproduce the old `generateObject` / `streamObject` event and callback shapes. Agent streams carry the complete modern event protocol, including tool activity. The ordinary Object components retain their existing contracts. See the [output and result contract](docs/agents-design.md#output-and-result-contract) for the precise mapping and legacy-only options.

Casai calls add the existing `response.messages` and `response.messageHistory` conventions. Await a streaming result's `response` to read history, then pass history explicitly into the next call. Components do not retain conversations between invocations.

Generation calls return promises. Plain-text streaming calls return the stream result immediately when no asynchronous preparation is configured, matching `TextStreamer`. Rendered/loaded prompts, function prompts, or agent call preparation (`callOptionsSchema` / `prepareCall`) use the promise path. `await component(...)` works in either case and yields the stream handle without waiting for completion. Native `.stream()` always returns a promise as required by the SDK interface.

Generator variants retain `.asTool`, including `create.ObjectGenerator.withTemplate.asAgent.asTool(...)`. Direct invocation returns the full result; tool execution returns text for the Text variant and the parsed object/array/value for the Object variant. Streamer variants have no `.asTool` modifier.

#### Native AI SDK Compatibility

All four `.asAgent` variants expose `version`, `id`, `tools`, `.generate()`, and `.stream()`. The basic SDK `Agent` interface requires both methods, including promised native streaming. This contract is useful for UI helpers and any other consumer expecting an `Agent`; it is independent of the number of model steps and does not require `ToolLoopAgent`.

```typescript
// A streamer's native generate method performs generation directly.
const generated = await streamingAgent.generate({
  prompt: 'Explain battery recycling briefly.',
});

// A generator's native stream method performs real incremental streaming.
const streamed = await agent.stream({
  messages: [{ role: 'user', content: 'Explain battery recycling briefly.' }],
});

import { createAgentUIStreamResponse } from 'ai';

// uiMessages comes from the application's chat request.
const response = await createAgentUIStreamResponse({
  agent: streamingAgent,
  uiMessages,
});
```

Each method starts one execution in its requested mode, potentially containing several model/tool steps. Generation is not converted into an artificial one-chunk stream, and streaming does not trigger a second generation. Either factory's agent works with UI helpers.

Native `.generate()` delegates to `generateText()`; native `.stream()` delegates to `streamText()` through a promise-returning wrapper. Awaiting `.stream()` yields its live stream handle without waiting for completion. This mapping applies to all Phase 1 variants and both Phase 2 factories.

Native calls use the configured model, tools, output, instructions, loop controls, and hooks. They bypass Casai loading/rendering, `inputSchema`, rendering-context merging, configured prompt/history insertion, and result augmentation. Supply a complete SDK `prompt` or `messages`. For example, `researcher.generate({ prompt: 'Explain recycling.' })` neither requires `topic` nor renders the configured template; it still uses the configured output schema.

Shared instructions belong in `instructions`. SDK call-option validation and `prepareCall` still run on both entry paths. Native custom options use `options`; Casai uses `callOptions` in configuration or `.run()`, since `options` already configures Cascada. Required native options must be supplied explicitly; native methods do not borrow Casai `callOptions` defaults.

See the [implementation design](docs/agents-design.md) for preparation, type contracts, invocation isolation, and the five-phase roadmap, or [README2.md](README2.md) for the later `LLMAgent` API. When updating demos for that API, preserve your explicit or inherited `stopWhen`, or add `isStepCount(20)` if you relied on the Phase 1 modifier's default. The Phase 2 factory defaults to one step and omits `.asAgent`.

***

### ObjectGenerator
**What it does**: Produces structured data with Vercel's [`generateObject` function](https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-object), validated by a Zod schema. It follows the same creation and calling patterns as `TextGenerator`.

#### How to Create It
Like `TextGenerator`, it can operate on a single `prompt` or be given a conversational history via the `messages` property, making it useful for extracting structured data from a dialogue.

*   **Default (Plain Text)**: The `prompt` is a static string with no processing.
    ```typescript
    const staticObjGenerator = create.ObjectGenerator({ model: openai('gpt-4o'), schema: z.object({ ... }), prompt: 'Extract user data.' });
    ```
*   **With a Template (`.withTemplate`)**: The `prompt` is a Cascada template string.
    ```typescript
    import { z } from 'zod';

    const profileGenerator = create.ObjectGenerator.withTemplate({
      model: openai('gpt-4o'),
      schema: z.object({ name: z.string(), role: z.string() }),
      prompt: 'Generate a character profile for a {{ role }}.'
    });
    ```
*   **With a Script (`.withScript`)**: The `prompt` property contains a Cascada script whose output generates the prompt.
    ```typescript
    const scriptObjGenerator = create.ObjectGenerator.withScript({
      model: openai('gpt-4o'),
      schema: z.object({ ... }),
      prompt: `
        return "Extract key entities from: " + text
      `
    });
    ```
*   **Loading from a resource (`.loads...`)**: Load the `prompt` from a file. It can be treated as plain text (`.loadsText`), a template (`.loadsTemplate`), or a script (`.loadsScript`).
    ```typescript
    const loadedObjGenerator = create.ObjectGenerator.loadsTemplate({ loader, model: openai('gpt-4o'), schema: z.object({ ... }), prompt: 'extraction_prompt.njk' });
    ```

**Output Strategies:**
The `output` property in the configuration determines how the generated data is structured:
- **`object`** (default): Generates a single object matching the provided `schema`.
- **`array`**: Generates an array of objects, each matching the `schema`.
- **`enum`**: Generates a value from a provided list of enums. Requires an `enum` array in the configuration.
- **`no-schema`**: Generates data without a schema, useful for flexible outputs. Omit the `schema` property.

Additionally, you can provide `schemaName` and `schemaDescription` for better model guidance with some providers.

#### How to Call It
*   **With pre-configured input**:
    ```typescript
    const { object: profile } = await profileGenerator({ role: 'wizard' });
    ```
*   **With a one-off template**: The new input is processed as a template.
    ```typescript
    const { object: profile2 } = await profileGenerator('Create a profile for a {{ role }} named {{ name }}', { role: 'knight', name: 'Galahad' });
    ```

#### Using as a Tool (`.asTool`)
Create a tool that returns structured, validated JSON.
```typescript
const extractorTool = create.ObjectGenerator.withTemplate.asTool({
  model: openai('gpt-4o'),
  description: 'Extracts user name and email from text.',
  inputSchema: z.object({ text: z.string() }),
  schema: z.object({ name: z.string(), email: z.string().email() }),
  prompt: 'Extract the name and email from this text: {{ text }}',
});
```

#### Return Value
When you `await` an `ObjectGenerator` call, it returns a promise that resolves to a result object from the Vercel AI SDK's [`generateObject`](https://sdk.vercel.ai/docs/ai-sdk-core/generating-objects#generateobject) function. Key properties include:
*   **`object`**: The generated and validated JSON object.
*   **`usage`**: Token usage information.
*   **`finishReason`**: The reason the model stopped generating.

**Important Note**: Unlike `TextGenerator`, the return value for `ObjectGenerator` **does not** include `messages` or `messageHistory`. While you can provide a `messages` history to give the model context for its generation, its purpose is to produce a final, structured data object, not to continue a conversation.

**Use it for**: Data extraction, structured responses, or enum-based classification. [See Vercel docs on object generation](https://sdk.vercel.ai/docs/ai-sdk-core/generating-objects#generateobject) for return details.

### ObjectStreamer
**What it does**: Streams structured data incrementally via Vercel's [`streamObject` function](https://sdk.vercel.ai/docs/ai-sdk-core/stream-object). It follows the same creation and calling patterns as `TextGenerator`.

> **Note**: Streaming components like `ObjectStreamer` cannot be exposed as tools to an LLM, as the tool-use protocol requires a single, resolved response, not a stream.

#### How to Create It
Like `TextStreamer`, it can operate on a single `prompt` or be given a conversational history via the `messages` property, allowing for context-aware data streaming.

*   **Default (Plain Text)**: The `prompt` is a static string with no processing.
    ```typescript
    const staticObjStreamer = create.ObjectStreamer({ model: openai('gpt-4o'), schema: z.object({ ... }), prompt: 'Generate a list of users.' });
    ```
*   **With a Template (`.withTemplate`)**: The `prompt` is a Cascada template string.
    ```typescript
    const characterStreamer = create.ObjectStreamer.withTemplate({
      model: openai('gpt-4o'),
      schema: z.object({ name: z.string(), description: z.string() }),
      output: 'array',
      prompt: 'Generate 3 characters from the {{ genre }} genre.'
    });
    ```
*   **With a Script (`.withScript`)**: The `prompt` property contains a Cascada script whose output generates the prompt.
    ```typescript
    const scriptObjStreamer = create.ObjectStreamer.withScript({
      model: openai('gpt-4o'),
      schema: z.object({ ... }),
      prompt: `
        return "Generate characters based on: " + theme
      `
    });
    ```
*   **Loading from a resource (`.loads...`)**: Load the `prompt` from a file. It can be treated as plain text (`.loadsText`), a template (`.loadsTemplate`), or a script (`.loadsScript`).
    ```typescript
    const loadedObjStreamer = create.ObjectStreamer.loadsTemplate({ loader, model: openai('gpt-4o'), schema: z.object({ ... }), prompt: 'character_generation.njk' });
    ```

**Output Strategies:**
The `output` property in the configuration determines the structure of the streamed data:
- **`object`** (default): Streams a single object. Use `partialObjectStream` to access incremental updates of the object.
- **`array`**: Streams an array of objects. Use `elementStream` to access each element as it's generated.
- **`no-schema`**: Streams text data. Use `textStream` to access the streamed text.

The `enum` strategy is not supported for streaming.

#### How to Call It
*   **With pre-configured input**:
    ```typescript
    const { elementStream } = await characterStreamer({ genre: 'fantasy' });
    ```
*   **With a one-off template**: The new input is processed as a template.
    ```typescript
    const { elementStream: stream2 } = await characterStreamer('Generate 2 characters from {{ genre }}', { genre: 'sci-fi' });
    ```

#### Return Value and Handling the Stream
The result object from an `ObjectStreamer` call is returned without waiting for the model, directly for a plain-text streamer and through a promise for a streamer that renders or loads its prompt, as with `TextStreamer`. It contains streams for real-time consumption and promises for final data, mirroring the Vercel AI SDK's [`streamObject`](https://sdk.vercel.ai/docs/ai-sdk-core/streaming-objects#streamobject) function.

**Real-time Streams:**
*   **`partialObjectStream`**: A stream of partial updates to the object being generated (for `output: 'object'`).
*   **`elementStream`**: A stream that yields each complete element of an array as it's generated (for `output: 'array'`).
*   **`textStream`**: A stream of text chunks (for `output: 'no-schema'`).

**Promises for Final Data:**
The result object also contains promises that resolve **after** the stream has finished.
*   **`object`**: A promise that resolves to the full, validated JavaScript object.
*   **`finishReason`**: A promise that resolves to the reason the model stopped generating.
*   **`usage`**: A promise that resolves to the final token usage.

**Important Note**: Unlike `TextStreamer`, the final resolved values from an `ObjectStreamer` **do not** include `messages` or `messageHistory`. The focus is on delivering the structured data, not managing conversational state.

**Use it for**: Live dashboards, incremental JSON builds, or array streaming. [See Vercel docs on object streaming](https://sdk.vercel.ai/docs/ai-sdk-core/streaming-objects#streamobject) for streaming specifics.

### Function
**What it does**: Wraps a standard JavaScript function into a callable component, allowing for input and output validation. This is the primary way to integrate custom, non-LLM logic into your workflows and expose it as a **Vercel AI SDK-compatible tool**.

You can define the function's logic in two ways:

1.  **As a Standard Callable Function**: The default `create.Function` returns a simple async function. This is useful for encapsulating logic to be used within the `context` of other components.

    ```typescript
    const toUpperCase = create.Function({
        inputSchema: z.object({ text: z.string() }),
        schema: z.string(), // Validate the output is a string
        execute: async ({ text }) => text.toUpperCase()
    });
    // Can now be used in another component's context:
    // context: { toUpperCase }
    ```

2.  **As a Tool (`.asTool`)**: The `.asTool` modifier formats the function into a standardized tool object that can be provided to an LLM.

    ```typescript
    const getTimeTool = create.Function.asTool({
        description: 'Gets the current time for a specific timezone.',
        inputSchema: z.object({ timezone: z.string() }),
        execute: async ({ timezone }) => ({
          time: new Date().toLocaleTimeString('en-US', { timeZone: timezone })
        })
    });
    ```

With an `inputSchema` or output `schema`, `execute` must accept the schema input (plus configured `context`) and return the schema output. Without an `inputSchema`, callers pass what `execute` declares, with configured `context` fields optional; without an output `schema`, the result is `execute`'s return type.

A `Function` or `Function.asTool` can inherit from a `Config` or another `Function`. A child can replace `inputSchema`, `schema`, or `execute`, and its configured `context` merges by key. `Function.asTool` can also replace `contextSchema`. TypeScript checks the final `execute`, inherited or supplied, against the final configuration: if a change no longer matches the inherited callback's input, configured context, SDK context, or return type, the child must supply a compatible `execute`.

A `Config` can hold a partial `Function` configuration, including `execute`. Its callback is typed from the schemas and context that `Config` declares and must not contradict them; anything it leaves out is checked when a `Function` completes the configuration. Components that supply their own implementation, such as generators, templates, and their tools, reject `execute` in their own config and in a parent.

Inline callbacks in a `Config`, such as `onStart`, are typed for every component the `Config` could configure: a fragment usable by both text and object generators receives either kind of event.

## Using Components as Tools
A powerful feature of Casai is the ability to expose almost any component as a tool that an LLM can decide to call. This allows the model to trigger complex, multi-step, or even other LLM-driven actions to fulfill a user's request.

**How it Works:**
You can convert a component into a tool by appending the `.asTool` modifier to its factory call. This pattern applies to `TextGenerator`, `ObjectGenerator`, `Template`, `Script`, and `Function` components.

When using `.asTool`, you must provide two additional properties in the configuration:
-   **`description`**: A string explaining what the tool does. The LLM uses this to decide when to call the tool.
-   **`inputSchema`**: A Zod schema defining the arguments the tool accepts. This property is mandatory for tools.

**Key Limitation:**
Streaming components (`TextStreamer` and `ObjectStreamer`) **cannot** be used as tools. The Vercel AI SDK's tool-use protocol requires a single, resolved response (a `Promise`), not a real-time stream.

**Accessing Tool Call Context:**
When a tool is created from a template, script, or function-prompt (`.withFunction`) component, a special `_toolCallOptions` object is automatically injected into its `context`, providing metadata like the `toolCallId` and the `messages` history that triggered the call.

The `_toolCallOptions` object contains:
- **`toolCallId`**: `string` - The unique ID for this specific tool call. Useful for logging or streaming updates.
- **`messages`**: `ModelMessage[]` - The message history sent to the LLM that triggered this tool call. Does not include the system prompt or the assistant's response.
- **`abortSignal`**: `AbortSignal` (optional) - A signal to gracefully cancel the operation if the overall request is aborted.
- **`context`**: The tool-specific value described by `contextSchema`, or `undefined` when no tool context is configured.

You can use this context within your tool's template or script to add logging or change its behavior.
```typescript
const loggingSummarizer = create.TextGenerator.withTemplate.asTool({
  model: openai('gpt-4o-mini'),
  description: 'Summarizes text and logs the call ID.',
  inputSchema: z.object({ text: z.string() }),
  prompt: `
    SYSTEM LOG: Starting summarization for tool call ID {{ _toolCallOptions.toolCallId }}.
    TASK: Provide a concise, one-sentence summary of: {{ text }}
  `,
});

// To use the tool, provide it to an LLM component:
const agent = create.TextGenerator({
  model: openai('gpt-4o'),
  tools: { summarize: loggingSummarizer },
  prompt: "Please summarize this for me: 'Casai is an AI orchestration library...'",
});

// The LLM will decide whether to call the tool to fulfill the request
(async () => {
    const chatResult = await agent();
    console.log('Model-Driven Result:', chatResult.toolCalls);
})();
```
**Typed Tool Context:**
Use `contextSchema` to declare data supplied to a tool through the generator's `toolsContext` map. Callback context, direct calls, and `.execute()` are inferred from the schema without explicit type arguments.

```typescript
const multiply = create.Function.asTool({
    inputSchema: z.object({ value: z.number() }),
    contextSchema: z.object({ factor: z.number() }),
    execute: ({ value }, { context }) => value * context.factor
});

const generator = create.TextGenerator({
    model,
    tools: { multiply },
    toolsContext: { multiply: { factor: 3 } },
    prompt: 'Multiply 2 using the tool.'
});
```

`contextSchema` is **not a schema for Casai's configured `context`**. It describes the separate SDK execution context supplied through `toolsContext`. Configured `context` enriches input and supplies template/script variables; `inputSchema` validates call-time input. `Function.asTool` callbacks receive SDK context as `options.context`; `Template`, `Script`, and generator tools expose it through `_toolCallOptions.context`.

The AI SDK validates and parses tool context before execution. Calling a Casai tool directly or calling `.execute()` skips this context validation, so direct callers must supply an already valid value.

The SDK likewise validates model-issued tool input against `inputSchema` and reports invalid input as a tool error without running the tool, so `.execute()` does not validate input again. Calling a `Template`, `Script`, or generator tool directly validates its input like any other component call. A `Function.asTool` is its own `.execute()`, so a direct call skips input validation too.

A child keeps its parent's inferred SDK context unless it supplies `contextSchema`. For `Function.asTool`, an incompatible replacement also requires an `execute` callback that accepts the new context. `Template`, `Script`, and generator tools can replace the schema without a callback.

`tools` and `toolsContext` both merge by tool name under parent configs and `.run()` overrides. Children can add one tool and its context without restating inherited entries. Each supplied context entry replaces that tool's entire value; its individual fields are not merged. The final context map must match the final tool set, including replacement tools.

`Config` accepts partial fragments, including a context map before its tools are supplied. Creating a generator or streamer checks that the final merged map is complete. `.run()` can replace a configured tool with another implementation with compatible input, output, and SDK context types. Create a new component to add tools or change those types, so tool calls and results remain accurately typed.

```typescript
const child = create.TextGenerator({
    tools: { anotherTool },
    toolsContext: { anotherTool: { label: 'child' } },
    prompt: 'Use the available tools.'
}, create.Config(generator.config));

// Retains anotherTool's context for this run:
await child.run({ toolsContext: { multiply: { factor: 5 } } });
```

**Type migration:** Tools without `contextSchema` now infer `undefined` for SDK context. Use `ToolExecutionOptions<undefined>` for options passed to these tools. When forwarding options from a plain SDK `tool()` wrapper, pass `{ ...options, context: undefined }`. Tools that need execution context should declare a `contextSchema`.

**Use it for**: Creating modular, reusable, and type-safe functions that empower an autonomous agent to decide which actions to take.

## Template and Script Properties

For components created with `.withTemplate`, `.withScript`, or their `.loads...` variants, you can use a powerful set of properties to inject data, transform outputs, and manage dependencies. These properties are **only available** on components that use Cascada processing.

### prompt
The same 'prompt' property that by default has the text-only prompt is now the heart of your component - the template or script that gets processed. Set it in the configuration object when creating the component.

### context
Provides data and methods that can be accessed within templates and scripts. Both the data and method returns can be asynchronous (promises are automatically handled), keeping your logic clean and powerful.  Here's what you can add to the `context` object:
- **Static Values**: Simple strings, numbers, or objects (e.g., `'London'`, `42`, `{ key: 'value' }`).
- **Synchronous Functions**: Basic logic or transformations (e.g., `(x) => x.toUpperCase()`).
- **Asynchronous Functions**: API calls, database queries, or file reads (e.g., `async () => await fetch(...)`).
- **Other Components**: Nest components for chained operations (e.g., a `TextGenerator` to translate text).
- **Custom Integrations**: Anything callable - think service clients or utility libraries.

Example:
```typescript
const component = create.TextGenerator.withTemplate({
  prompt: 'Weather in {{ city }}: {{ getWeather(city) }} - {{ (translator({ text: "Updated" })).text }}',
  context: {
    city: 'London', // Static value
    getWeather: async (city) => (await fetch(`https://api.weather.com/${city}`)).json(), // Async function
    translator: create.TextGenerator.withTemplate({ // Nested component
      model: openai('gpt-4o'),
      prompt: 'Translate to Spanish: {{ text }}'
    })
  }
});
```

### filters
Transform data on the fly with custom functions, sync or async, using the `|` operator:
```typescript
import { create } from 'casai';
import translate from 'translate';

const component = create.Template({
  filters: {
    translate: async (text, lang) => await translate(text, lang)
  },
  template: `
    Original: {{ text }}
    Spanish: {{ text | translate('es') }}
  `
});

(async () => {
  console.log(await component({ text: 'Hello world' }));
})();
```

### loader
Provides a loader that retrieves templates or scripts by name from an external source, like the filesystem or a database. Loaders are essential when using modifiers like `.loadsTemplate` or `.loadsScript`, and they also power compositional features within your scripts and templates, such as `import`, `include`, and `extend`.

```typescript
import { create, FileSystemLoader } from 'casai';

// Use the built-in FileSystemLoader to load from a local directory
const component = create.Template.loadsTemplate({
  loader: new FileSystemLoader('./templates'),
  template: 'main.njk', // The filename to load
});
```

*Casai* offers several loading options:

*   **Built-in Loaders**:
    *   **`FileSystemLoader`**: (Node.js only) Loads files from the local filesystem. Relative paths in `include` and `import` (e.g., `./footer.njk`) resolve from the loading file's directory.
    *   **`WebLoader`**: (Browser only) Loads files over HTTP from a given base URL.
    *   **`PrecompiledLoader`**: Loads templates and scripts precompiled with Cascada's precompile functions (such as `precompileTemplateStringAsync` and `precompileScriptString` with `format: 'esm'`), keyed by name, for optimal performance. Plain-text prompts loaded with `.loadsText` need a loader that returns source text.

*   **Custom Loaders**: You can create a custom loader by providing either a simple asynchronous function or a more structured class. If a loader can't find an asset, it should return `null` to allow fallback to the next loader in the chain.

    **Example: Functional Loader**
    A loader can be a simple function. For more control, it can return a `LoaderSource` object (`{ src, path, noCache }`) to provide metadata for caching and error reporting.
    ```typescript
    // A custom loader that fetches templates from a network.
    const networkLoader = async (name: string) => {
      const response = await fetch(`https://my-cdn.com/templates/${name}`);
      if (!response.ok) return null;
      const src = await response.text();
      // Return a LoaderSource for better debugging and caching control
      return { src, path: name, noCache: false };
    };
    ```

    **Example: Class-based Loader**
    For advanced features like relative paths (`import`, `include`) and event-driven caching, use a class. A loader class has one required method and several optional ones for advanced functionality:

    | Method | Description | Required? |
    |---|---|:---:|
    | `load(name)` | The core method. Loads an asset by name and returns its content (as a string or `LoaderSource` object), or `null` if not found. Can be async. | **Yes** |
    | `isRelative(name)` | Returns `true` if a filename is relative (e.g., `./component.script`). This tells the engine that the path needs to be resolved. | No |
    | `resolve(from, to)`| Resolves a relative path (`to`) based on the path of a parent script (`from`). This is crucial for making features like `include "./child.csc"` work correctly. | No |
    | `on(event, handler)` | Listens for environment events (`'load'`, `'update'`). Useful for advanced, event-driven cache invalidation strategies. | No |

    Here is a class-based loader that supports relative paths:
    ```typescript
    class DatabaseLoader {
      constructor(private db: MyDatabaseClient) { }

      // The required 'load' method can be synchronous or asynchronous
      async load(name: string) {
        const scriptRecord = await this.db.scripts.findByName(name);
        return scriptRecord
          ? { src: scriptRecord.sourceCode, path: name, noCache: false }
          : null;
      }

      // Optional method to identify relative paths
      isRelative(filename: string): boolean {
        return filename.startsWith('./') || filename.startsWith('../');
      }

      // Optional method to resolve relative paths
      resolve(from: string, to: string): string {
        // A real implementation would use a robust path-joining library.
        // This is a simplified example.
        const fromDir = from.substring(0, from.lastIndexOf('/'));
        return `${fromDir}/${to}`;
      }
    }
    ```

*   **Declarative Loader Concurrency with `race()`**:

By default, child loaders are placed before parent loaders to create a sequential fallback chain. The `race()` function provides a more efficient alternative by running multiple loaders concurrently. Its key advantage is speed: the entire group resolves as soon as any loader finds the resource, without waiting for slower loaders (like a network request) to time out or fail. This makes `race()` beneficial even if only one loader in the group is expected to succeed, as it eliminates unnecessary delays from the others.

When you give `race()` a name (e.g., `race(..., 'cdn')`), you create a **named race group**. All loaders in groups with the same name across parent and child configurations are automatically merged into a single, combined race. This allows a child to add loaders to a parent's concurrent loading strategy instead of simply prepending to it.

Duplicate loader instances are removed from both named and anonymous race groups, including groups inherited through multiple `Config` objects.

```typescript
import { create, race, WebLoader, FileSystemLoader } from 'casai';

// Parent config defines a named race group for CDN loaders.
const parentConfig = create.Config({
  loader: race([
    new WebLoader('https://cdn.example.com/prompts/')
  ], 'cdn')
});

// Child generator ADDS a local loader to the 'cdn' race group.
const generator = create.TextGenerator.loadsText({
  loader: race([
    new FileSystemLoader('./local_prompts/')
  ], 'cdn'),
  prompt: 'daily-summary.txt'
}, parentConfig);

// Result: The final generator has one loader that runs the WebLoader
// and FileSystemLoader concurrently, using the first successful result.
```

### options
Fine-tune the Cascada engine with extras like `autoescape` or `trimBlocks`:

Standalone templates default `autoescape` to `false` and honor an explicit `true` for HTML output. LLM prompt renderers always disable autoescaping. Configured inline scripts compile once per component; named text, templates, and scripts use environment caches that respect loader updates and `noCache`.

```typescript
const component = create.Template({
  options: {
    autoescape: false,
    trimBlocks: true
  },
  template: '...'
});
```
See [Nunjucks docs](https://mozilla.github.io/nunjucks/api.html#configure) for more.

## Vercel AI Properties

*Casai* components inherit a robust set of properties from the [Vercel AI SDK](https://sdk.vercel.ai/), enabling fine-tuned control over language model behavior. These properties are available across all LLM component types unless noted, and can be set in a base `Config` object, during component creation, or, where applicable, overridden in runtime calls. Casai sets no defaults for them; an omitted setting uses the provider's default.

### model
**Purpose**: Specifies the language model to use for generation.
**Type**: Provider-specific model object (required).
**Details**: Must be supplied via a provider helper (e.g., `openai()`, `anthropic()`). Mandatory in component or `Config`.

### temperature
**Purpose**: Adjusts the randomness of the model's output.
**Type**: `number` (the valid range depends on the provider).

### maxOutputTokens
**Purpose**: Limits the number of tokens generated to manage size and cost.
**Type**: `number` (optional).

### topP
**Purpose**: Controls diversity via nucleus sampling. Limits tokens to the top probability mass; an alternative to `temperature` for finer diversity control.
**Type**: `number` (0 to 1).

### presencePenalty
**Purpose**: Discourages repetition of tokens already in the output. Positive values reduce reuse; negative encourage it.
**Type**: `number` (-2.0 to 2.0).

### frequencyPenalty
**Purpose**: Reduces repetition based on token frequency. Higher values penalize frequent tokens; negative promote them.
**Type**: `number` (-2.0 to 2.0).

### stopSequences
**Purpose**: Halts generation at specified sequences.
**Type**: `string[]` (optional).
**Details**: Supported by `TextGenerator` and `TextStreamer`. Stops before generating the sequence.
**Example**:
```typescript
import { openai } from '@ai-sdk/openai';
import { create } from 'casai';

const component = create.TextGenerator({
  model: openai('gpt-4o'),
  stopSequences: ['###', '\n\n'], // Stops at triple hash or double newline
  prompt: 'List 3 facts about space:\n1.'
});

(async () => {
  const { text } = await component();
  console.log(text); // Stops early if "###" or "\n\n" appears
})();
```

### tools
**Purpose**: Enables the model to call external functions *based on its own reasoning*.
**Details**: Supported by `TextGenerator` and `TextStreamer`. This is for model-driven tool use. For better organization, you can populate this with tools created by `create.Function.asTool`.
**Example**:
```typescript
import { openai } from '@ai-sdk/openai';
import { create } from 'casai';
import { z } from 'zod';

// Define a tool using create.Function.asTool
const getWeatherTool = create.Function.asTool({
  description: 'Gets the weather for a city.',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ temperature: Math.floor(Math.random() * 30) })
});

// Pass the tool to the LLM
const weatherAgent = create.TextGenerator({
  model: openai('gpt-4o'),
  tools: { getWeather: getWeatherTool },
  prompt: 'What's the weather like in San Francisco?',
});

(async () => {
  // The LLM will see the prompt and decide to call getWeather.
  const { text, toolCalls } = await weatherAgent();
  console.log(text); // May contain the weather or be empty if a tool was called.
  console.log(toolCalls); // Will show the call to getWeather.
})();
```

### stopWhen
**Purpose**: Controls when model-driven tool-calling stops. Works with the `tools` property in `TextGenerator` and `TextStreamer`.
**Type**: Stop condition, such as `stepCountIs(2)` from `ai`.

## Using Components in Templates and Scripts

Components in *Casai* can be embedded within scripts or templates by adding them to the `context` object, enabling seamless task chaining and orchestration. This approach leverages the engine's power to coordinate multiple components, execute them when their inputs are ready, and process their outputs dynamically.

### Example with `Script` for Data Orchestration

Use `Script` when your goal is to build a structured data object by orchestrating multiple steps.

```typescript
// ... (characterGenerator, storyGenerator, critiqueGenerator setup from previous examples) ...

// Orchestrating script
const mainOrchestrator = create.Script({
  context: {
    characterGenerator,
    storyGenerator,
    critiqueGenerator,
    topic: 'a lost astronaut'
  },
  script: `
    var character = characterGenerator({ topic: topic }).object
    var story = storyGenerator({ character: character, topic: topic }).text
    var critique = critiqueGenerator({ story: story }).text
    return { character: character, story: story, critique: critique }
  `
});

(async () => {
  const result = await mainOrchestrator();
  console.log(JSON.stringify(result, null, 2));
})();
```

### Example with `Template` for Presentation

Use `Template` when your primary goal is to generate a final string output, like an HTML page or a formatted report.

```typescript
// ... (characterGenerator, storyComponent, critiqueStreamer setup from previous examples) ...

// Orchestrating component for presentation
const mainComponent = create.Template({
  context: {
    characterGenerator,
    storyComponent,
    critiqueStreamer,
    topic: 'a lost astronaut'
  },
  template: `
    {% set character = characterGenerator({ topic: topic }).object %}
    Character: {{ character.name }}

    {% set storyContent = storyComponent({ character: character, topic: topic }).text %}
    Story: {{ storyContent }}

    Live Critique: {% for chunk in critiqueStreamer({ story: storyContent }).textStream %}{{ chunk }}{% endfor %}
  `
});

(async () => {
  const result = await mainComponent();
  console.log(result); // Outputs a single formatted string
})();
```

### Key Points
- **Concurrent Execution**: The critique stream runs after the story, which depends on the character, optimizing the dependency chain.
- **Result Handling**: Access `.object` for structured data, `.text` for stories, and `.textStream` for live critiques.
- **Dynamic Inputs**: Pass outputs (e.g., `character`) to subsequent components for cohesive workflows.
- **Versatility**: Combine different component types - like `ObjectGenerator`, `TextGenerator`, and `TextStreamer` - to handle varied tasks in one workflow.

## Conversational AI: Managing Message History

For building multi-turn chatbots and conversational agents, *Casai* provides robust message handling capabilities, specifically for the `TextGenerator` and `TextStreamer` components.

### The `messages` Property: Static vs. Dynamic History

The `messages` property plays a dual role depending on where you define it:

1.  **Static Configuration Messages**: When you set `messages` during component creation, it acts as a static "base layer" for every conversation. This is the ideal place for a `system` prompt, as it will be applied to every call without being part of the mutable chat history.

    ```typescript
    // The system message is part of the static configuration
    const chatAgent = create.TextStreamer({
      model: openai('gpt-4o'),
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      allowSystemInMessages: true
    });
    ```

2.  **Dynamic History (Call Argument)**: When you pass a `messages` array as an argument during a call, it represents the dynamic, turn-by-turn history of the conversation.

### The Conversational Calling Pattern

To continue a conversation, you pass the history as an argument. The `prompt` string will be automatically added as the latest user message.

```typescript
// The 'chatHistory' array contains previous user/assistant turns
const result = chatAgent(newUserInput, chatHistory);
```

### Understanding the Response: `messages` vs. `messageHistory`

To make chat loops easy, the response object from `TextGenerator` and `TextStreamer` separates the turn's new messages from the full, ready-to-use history.

*   **`response.messages`**: The *delta* for the current turn. This includes the message generated from the input `prompt` and every generated message, including tool calls, tool results, and the final assistant reply.
*   **`response.messageHistory`**: The *complete* dynamic history (input messages + delta), **excluding** any static messages from the component's configuration. This is the state you use for the next API call.

Response history arrays reflect the messages submitted for that call. Appending to or clearing the caller's input array later does not rewrite an earlier response's history.

| Property                  | Purpose                               | What it Contains                                                         | Primary Use Case                                |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| `config.messages`         | Static Base Layer                     | System prompts, fixed instructions.                                      | Defining the agent's core personality/behavior. |
| `messages` (argument)     | Dynamic Input History                 | The `messageHistory` from the previous turn.                             | Continuing a conversation.                      |
| `response.messages`       | Delta of the Current Turn             | The new prompt message + the LLM's reply message.                        | Logging or displaying the latest exchange.      |
| `response.messageHistory` | Dynamic Output History (Next State)   | The input `messages` argument + `response.messages`. **Excludes config.** | Storing and feeding into the next API call.     |

With AI SDK 7, `toolCalls` and `toolResults` include all steps, even after the agent produces its final answer. Use `finalStep.toolCalls` to inspect the final step. The SDK's `responseMessages` contains all generated messages without the input prompt, while `steps[i].response.messages` remains specific to that step. For `TextStreamer`, await these SDK properties.

### Advanced Message Composition
You can achieve more complex message structures using these advanced patterns:

**1. `prompt` as `ModelMessage[]`**
For plain-text components, you can provide an array of messages directly in the `prompt` property at configuration time. A call-time prompt replaces that array. To keep fixed few-shot examples before each new user prompt, put them in `messages` instead:
```typescript
const fewShotAgent = create.TextGenerator({
  model: openai('gpt-4o'),
  messages: [
    { role: 'user', content: 'Translate "hello" to French.' },
    { role: 'assistant', content: 'Bonjour' },
    // The final prompt will be appended here as a user message
  ]
});
```

**2. Script Returning `ModelMessage[]`**
For components created with `.withScript`, the script can return a `ModelMessage[]` array instead of a string. These messages will be **appended** to the history before the final call to the LLM. This allows for dynamic construction of few-shot examples based on context.
```typescript
const dynamicFewShotAgent = create.TextGenerator.withScript({
    model: openai('gpt-4o'),
    context: {
        getExamples: async (topic) => ([ // Fetch examples from a DB
            { role: 'user', content: `Example question about ${topic}` },
            { role: 'assistant', content: `Example answer about ${topic}` }
        ])
    },
    prompt: `
        return getExamples(topic)
    `
});
```
When called, the messages returned by `getExamples` become the prompt after any configured or call-time history. A positional string override replaces the script source for that call.

### Example: Building a Conversational Chatbot

Putting it all together, here's how you can build a complete, interactive chat loop using a `TextStreamer`.

```javascript
import { openai } from '@ai-sdk/openai';
import { create } from 'casai';
import { read, write } from 'promise-streams-and-pipes';

async function getUserInput(promptText) {
  await write(process.stdout, promptText);
  return (await read(process.stdin)).toString().trim();
}

// 1. Configure the agent with a static system prompt
const chatAgent = create.TextStreamer({
  model: openai('gpt-4o'),
  allowSystemInMessages: true,
  messages: [{
    role: 'system',
    content: 'You are a friendly chatbot. Keep answers concise.'
  }]
});

// 2. Initialize the dynamic history
let dynamicHistory = [];

// 3. Main chat loop
(async () => {
  while (true) {
    const userInput = await getUserInput('You: ');
    if (!userInput) {
      console.log('Chat ended.');
      break;
    }

    // 4. Call the agent with the user's prompt and the current dynamic history
    const result = chatAgent(userInput, dynamicHistory);

    process.stdout.write('Bot: ');
    // Stream the response in real-time
    for await (const textPart of result.textStream) {
      process.stdout.write(textPart);
    }
    process.stdout.write('\n');

    // 5. Once the stream is finished, update the history for the next turn
    const { response } = result;
    dynamicHistory = (await response).messageHistory;
  }
})().catch(console.error);
```

## Choosing Your Orchestration Strategy: Scripts, Templates, Context Methods, and Tools

In *Casai*, you have several powerful mechanisms to build workflows. Choosing the right one depends on your goal and who is in control: are you building a structured data object, or are you rendering a final text document, as well as who should be in control: the developer or the AI model.

### `Script` & `Template`: For Data and Presentation Layers
-   **`Script`**: Use when the primary output is a structured data object (JSON). Ideal for data-layer logic, multi-step agents, and orchestrating various data sources. It is the backbone of your application's data layer.

**Use When:**
-   **The output is data:** Your main goal is to create a complex object or array to be used by your application.
-   **Complex logic is needed:** You need loops (`for`, `while`), conditionals (`if/else`), and variables to manage state across multiple async steps.
-   **Orchestrating multiple sources:** You are fetching data from several APIs, databases, and other components and need to combine them into a single, coherent object.
-   **Readability is key for complex flows:** The top-to-bottom, `await`-free syntax makes complex data dependencies easy to follow.

-   **`Template`**: Use when the primary output is a rendered string (for instance an HTML or a Markdown). Ideal for the presentation layer.

**Use When:**
-   **The output is text:** You are generating a final, human-readable document.
-   **Logic is simple and presentation-focused:** The workflow involves embedding data into a string using `{{ variable }}` and simple conditionals or loops with `{% %}` tags.
-   **You are building UIs:** Generating HTML with included partials is a classic use case.

### Context Methods & Filters: The Building Blocks
These are the fundamental JS/TS functions you provide to *both* scripts and templates. They are the efficient, predictable actions that your orchestrator calls.

**Use When:**
-   **You need raw performance:** A plain local JavaScript/TypeScript function is always faster than an LLM call.
-   **The logic is deterministic:** You need to fetch data from a known API endpoint, query a database, or perform a specific data transformation.
-   **You want to expose utilities:** Provide helper functions (e.g., `formatDate`, `calculateTotal`) to your scripts and templates.

### `Tools`: For Developer-Defined Functionality
Using `.asTool` (on `create.Function`, `script`, `template` or LLM generator provides a clean, type-safe way to expose custom functionality to an LLM.

**Use When:**
-   **The workflow is unpredictable**: You can't know ahead of time what the user will ask. The LLM must infer intent and select the appropriate tool (e.g., `getWeather` vs. `sendEmail`).
-   **You are building a conversational agent**: The LLM can chain its own reasoning - calling a tool, getting a result, and using that result to decide its next step - all within a single, autonomous turn.

## Embedding Integration

*Casai* seamlessly integrates vector embeddings from the Vercel AI SDK. By adding embedding functions to the `context` object, you can use them directly in scripts for tasks like semantic search, similarity comparisons, or retrieval-augmented generation (RAG).

### Example
Here's how to find the most similar document to a user query using a `Script` to orchestrate the embedding and comparison tasks concurrently.

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

## RAG Integration

*Casai*'s script-driven approach simplifies retrieval-augmented generation (RAG) workflows. By using `Script`, you can clearly define the steps of your RAG pipeline: searching an index, retrieving context, and generating a final answer. This leverages automatic concurrency for maximum efficiency.

### Example
**Summary**: This example loads 10 documents, builds a vector index with LlamaIndex, and uses a `Script` to orchestrate the retrieval of relevant snippets about machine learning for cancer detection and then summarizes them.

```typescript
import { create } from 'casai';
import { openai } from '@ai-sdk/openai';
import { Document, VectorStoreIndex, OpenAIEmbedding } from 'llamaindex';
import fs from 'fs/promises';

const docs = await Promise.all(
  [...Array(10)].map(async (_, i) =>
    new Document({ text: await fs.readFile(`document${i + 1}.txt`, 'utf-8'), id_: `doc${i + 1}` })
  ));
const vectorIndex = await VectorStoreIndex.fromDocuments(docs, {
  embedModel: new OpenAIEmbedding({ model: 'text-embedding-3-small' })
});

// Answer generator component
const answerGenerator = create.TextGenerator.withTemplate({
  model: openai('gpt-4o'),
  prompt: 'Summarize the latest advancements in machine learning for cancer detection based on: {{ context }}'
});

// RAG orchestrator using Script
const ragOrchestrator = create.Script({
  context: {
    query: 'What are the latest advancements in machine learning for cancer detection?',
    searchIndex: async (queryText) => {
      const queryEngine = vectorIndex.asQueryEngine();
      const response = await queryEngine.query(queryText);
      return response.sourceNodes.map(n => n.text).join('\n');
    },
    answerGenerator
  },
  script: `
    var retrievedContext = searchIndex(query)
    var answer = answerGenerator({ context: retrievedContext }).text
    return { query: query, answer: answer }
  `
});

(async () => {
  const result = await ragOrchestrator();
  console.log(JSON.stringify(result, null, 2));
})();
```

### Vercel AI Embedding Adapter
To use Vercel AI SDK embeddings instead of LlamaIndex's embeddings with LlamaIndex, create an adapter:

```typescript
import { BaseEmbedding } from 'llamaindex';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

class VercelEmbeddingAdapter extends BaseEmbedding {
  constructor(private vercelModel = openai.embedding('text-embedding-3-small')) {
    super();
  }

  async getTextEmbedding(text: string): Promise<number[]> {
    const { embedding } = await embed({ model: this.vercelModel, value: text });
    return embedding;
  }

  async getQueryEmbedding(text: string): Promise<number[]> {
    return this.getTextEmbedding(text);
  }
}

// Usage:
const vectorIndex = await VectorStoreIndex.fromDocuments(docs, {
  embedModel: new VercelEmbeddingAdapter()
});
```

## Input and Output Validation with Zod

Casai integrates with Zod to provide automatic, runtime validation for both the data you provide to components and the data they produce, ensuring type safety throughout your workflows.

AI SDK schemas created with `jsonSchema` are also supported. For local input and output checks in Template, Script, and Function components, supply the schema's `validate` callback; it can be synchronous or asynchronous. JSON schema metadata alone does not perform local validation in these components. Output validation returns the parsed value, including transformations.

Local input and output validation failures throw `ConfigError`. Script and Function output validation failures preserve the original schema error in `cause`. Script and template rendering failures throw `ScriptError` and `TemplateError` respectively. Unexpected exceptions thrown by schema callbacks propagate unchanged.

### Ensuring Type-Safe Inputs with `inputSchema`

The `inputSchema` property validates call-time `context` before execution. Configured `context` does not satisfy missing required input fields. An omitted context is validated as an empty object: a schema whose fields are all optional accepts the call, and any other schema rejects it with an error asking for a context object. Input validation checks the supplied data without replacing it with parsed or transformed values.

-   **Applies to**: Any component that uses a `context` object (`Template`, `Script`, `Function`, and LLM components created with `.withTemplate`, `.withScript`, or `.withFunction`).
-   **Usage**: Define the expected input data for a component using a Zod schema.
-   **Requirement**: This property is **mandatory** when creating a tool with `.asTool`, as it defines the tool's arguments for the LLM.

```typescript
import { z } from 'zod';

const userProcessor = create.Script({
  inputSchema: z.object({
    userId: z.string(),
    db: z.object({
      getUser: z.function(),
    }),
  }),
  script: `
    return db.getUser(userId)
  `
});

// This will succeed
await userProcessor({ userId: '123', db: { getUser: (id) => ({ id }) } });

// This will throw a validation error at runtime
await userProcessor({ user_id: '123' });
```

### Ensuring Type-Safe Outputs with `schema`

The `schema` property validates the final output of a component, guaranteeing that the produced data conforms to a specific structure. This is crucial for building reliable, predictable data pipelines.

-   **Applies to**: Components that produce structured JSON data (`ObjectGenerator`, `ObjectStreamer`, `Script`, `Function`).
-   **Usage**: Provide a Zod schema in the configuration to validate the component's return value.
-   **Benefit**: This is the core of reliable structured data generation, ensuring the final object is always valid and strongly-typed.

```typescript
import { z } from 'zod';

// For ObjectGenerator, this schema guides the LLM and validates the output.
const userExtractor = create.ObjectGenerator({
  model: openai('gpt-4o'),
  schema: z.object({ name: z.string(), email: z.string().email() }),
  prompt: 'Extract user info from text...'
});

// For Script and Function, it validates the final return value of your logic.
const dataAggregator = create.Script({
  schema: z.object({ status: z.string(), count: z.number() }),
  script: `
    return { status: "completed", count: 100 }
  `
});

const { object } = await userExtractor(); // object is guaranteed to match the schema
const result = await dataAggregator(); // result is guaranteed to match the schema
```

## Type Checking

*Casai*'s TypeScript integration enforces strict configuration rules to catch errors at compile time, preventing runtime issues. Below are examples of common type violations and the required properties they enforce.

### Examples
```typescript
import { create } from 'casai';
import { openai } from '@ai-sdk/openai';

// Error: Missing required model
const noModelComponent = create.TextGenerator({
  prompt: 'Hello'
}); // Type error: 'model' must be provided

// Error: Missing loader for external template
const namedTemplate = create.TextGenerator.loadsTemplate({
  prompt: 'my-template'
}); // Type error: 'loader' required for .loadsTemplate

// Error: Mixing incompatible properties
const invalidComponent = create.TextGenerator({
  model: openai('gpt-4o'),
  filters: {} // Type error: Filters are only allowed on template/script components
});
```

### Enforced Rules
- **Model**: Must be set in component creation or a parent `Config`.
- **Loader**: Required for `.loadsTemplate`, `.loadsScript`, or `.loadsText`.
- **Rendering Properties**: `context`, `filters`, and `options` are available with Cascada prompt modifiers. `.withFunction` supports `context` and `inputSchema` for JavaScript prompt callbacks. `loader` supplies external prompts or script/template composition.

This type safety ensures robust, predictable workflows with early error detection.

## Project Status and Roadmap

*Casai* is evolving to enhance its capabilities and robustness. Here are the key features planned for future releases:

### Coming Soon

- **Phase 1: `.asAgent`**: Add the [agent modifier](#agents-with-asagent) to the four existing Text/Object generator and streamer factories, using a shared core backed directly by `generateText` and `streamText`.
- **Phase 2: `LLMAgent`**: Introduce the [final language-generation factory](README2.md) on that core, with text output and one model step as defaults, `.generate()` and `.stream()` serving both Casai calls and the SDK agent interface, `.asStream` for a streaming ordinary call, and loop behavior controlled solely by `stopWhen`. The factory omits `.asAgent` and `.run()`.
- **Phase 3: Specialized Components**: Add `Decision`, `Embedding`, `Reranker`, `ImageGenerator`, `Transcriber`, `StreamingTranscriber`, `SpeechGenerator`, and `VoiceSession`. Embeddings accept a string or string array plus optional call overrides; streaming transcription keeps the SDK's native transcription stream. Preserve each operation's native results and lifecycle. See the [Phase 3 design](docs/agents-design.md#phase-3-specialized-components).
- **Phase 4: Ordered Streaming Workflows**: Add `.stream()` to Template and Script, and `.asStream` to Template, Script, and Function. Cascada preserves logical output order while nested work runs concurrently: later output waits behind unfinished earlier positions. See the [Phase 4 design](docs/agents-design.md#phase-4-streaming-template-script-and-function) and the planned [Cascada streaming implementation](https://github.com/geleto/cascada/blob/master/docs/cascada/streaming.md).
- **Phase 5: Out-of-Order Streaming**: Adopt Cascada's proposed `.indexed()` and `.indexedPath()` live-stream views, plus `at(chunk, index)` for JavaScript producers. The proposed Casai surface augments existing output streams, keeping ordinary iteration ordered while indexed views can expose ready chunks before earlier positions. Reader lifecycle and structured-output details remain to be settled. See the [Phase 5 design](docs/agents-design.md#phase-5-out-of-order-streaming).
- **Improved Type Inference for AI SDK Configuration**: Better argument type inference for AI SDK functions passed through Casai configuration objects.

All five phases are planned; the new APIs above are not available exports yet.

### Longer-Term Roadmap
- **OpenTelemetry/MLflow integration**: MLflow's tracing, which captures your app's entire execution, including prompts, retrievals, tool calls.
- **Automated Prompt Optimization**: Go beyond manual prompt engineering with a built-in create.Optimizer. Inspired by frameworks like DSPy, this feature will allow you to attach an optimizer to any generator. It will use your existing Evaluator as a guide to programmatically test and evolve your prompts, automatically discovering the highest-performing version for your specific task. This creates a powerful feedback loop, using the same components that guard your production app to continuously improve its core logic with minimal effort.
- **Execution Replay and Debugging**: A planned Cascada feature - creating an advanced logging system, via a dedicated output handler, to capture the entire execution trace. This will allow developers to replay and inspect the sequence of operations and variable states for complex debugging, and will integrate seamlessly with the Evaluator's trace history.
- **Versioned Templates and Scripts**: Enable loading versioned prompts with a loader that wraps unversioned loaders for better template management. Choose different versions depending on the model or validate old and new prompts during tests.
- **More Integration Instructions**: Provide clear patterns and examples for integrating long-term memory, human-in-the-loop, etc...
