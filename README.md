# Casai

**AI orchestration for JavaScript and TypeScript**

**Casai is in active development.** APIs and syntax may change. [Feedback](https://github.com/geleto/casai/issues) and contributions are welcome.

## Simple code. Concurrent workflows.

AI agents spend most of their time waiting. They wait for models, tools, web pages, APIs and databases - sometimes for seconds, even minutes.

Casai makes AI workflows easier to write and faster to run with [CascadaScript](https://cascada.dev/cascada-script/) - a simple scripting language, instantly familiar to JavaScript and Python developers. You express your workflow in normal, sequential code, without wiring up a graph. Under the hood, the runtime follows logical dependencies to run all independent operations concurrently, starting each as soon as its inputs are ready. The results are identical to sequential execution, but your workflow can finish much faster.

Agents, templates, scripts and your own functions share a [consistent interface](#components-and-tools). Configure them once and reuse them across workflows. Model components use the [Vercel AI SDK](https://ai-sdk.dev/docs/introduction), so you can choose from its [supported providers](https://ai-sdk.dev/providers/ai-sdk-providers).

## Build your first workflow

Use Node.js 24 or later, ESM imports (`"type": "module"` in `package.json`), and TypeScript 7.0.2 or later with strict checking.

Install Casai and a model provider. This example uses [OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai).

```sh
npm install casai ai@7 zod@4
npm install @ai-sdk/openai@4
```

For a local example, create `.env` with your provider key.

```dotenv
OPENAI_API_KEY=your-api-key
```

Save this as `workflow.ts`.

<!-- typecheck: first-workflow -->
```typescript
import { create, z } from 'casai';
import { openai } from '@ai-sdk/openai';

const model = openai('gpt-4o-mini');
const explain = create.LLMAgent.withTemplate({
  model,
  inputSchema: z.object({ topic: z.string() }),
  prompt: 'Explain {{ topic }} in two sentences.',
});
const suggest = create.LLMAgent.withTemplate({
  model,
  inputSchema: z.object({ topic: z.string() }),
  prompt: 'Suggest one practical exercise for learning {{ topic }}.',
});
const workflow = create.Script({
  context: { explain, suggest },
  inputSchema: z.object({ topic: z.string() }),
  script: `
    var explanation = explain({ topic: topic }).output
    var exercise = suggest({ topic: topic }).output
    return { explanation: explanation, exercise: exercise }
  `,
});

console.log(await workflow({ topic: 'solar energy' }));
```

Run the workflow with Node's environment-file support.

```sh
node --env-file=.env workflow.ts
```

The two agents run concurrently because neither needs the other's result. The return waits for both and gives you an object with `explanation` and `exercise` strings. The wording varies with the model.

[Continue in the documentation](https://casai.run/documentation/reference/#guide-first-workflow)

<a id="components-and-tools"></a>

## Many components. Different capabilities. One consistent interface.

Configure once. Call with new inputs. Reuse across workflows.

Use AI agents, templates, scripts and your own functions through one familiar interface. A template, script or function can turn your data into the prompts and inputs each component needs.

Share models, tools and defaults with [`Config`](https://casai.run/documentation/reference/config/#component-factories), then customize each component. Keep inputs and returned values compatible, and you can swap an implementation without rewriting the workflow.

[Explore components and examples](https://casai.run/#components)

### Turn a component into a tool

Let an agent delegate work to almost any component. Add [`.asTool`](https://casai.run/documentation/reference/llmagent_withtemplate_astool/#component-factories), describe its task and declare its arguments with [`inputSchema`](https://casai.run/documentation/reference/llmagent_withtemplate_astool/?options=withTemplate%2CasTool&view=config#property-inputSchema). A [template](https://cascada.dev/cascada-template/), script or function turns those arguments into the prompt or other input the component needs. It remains callable directly from your code.

Use these tools alongside [AI SDK tools](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) and [MCP tools](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools) in [`LLMAgent`](https://casai.run/documentation/reference/llmagent/#component-factories), [`Template`](https://casai.run/documentation/reference/template/#component-factories), [`Script`](https://casai.run/documentation/reference/script/#component-factories), [`Function`](https://casai.run/documentation/reference/function/#component-factories) and [`VoiceAgentBackend`](https://casai.run/documentation/reference/voiceagentbackend/#component-factories), or while preparing another component's inputs.

In the homepage example, a research agent calls a page summarizer and receives a short summary, keeping the full page text out of its conversation. [See the agent and its summary tool](https://casai.run/#page-summary-code)

## Start sooner. Use results as they arrive.

Process the first result while the rest are still arriving, using normal, sequential code.

A regular `for` loop processes each streamed item as it arrives. Independent iterations run concurrently, while collected results keep their original order.

Your app can also display generated text or play supported audio as it arrives. Steps that need the whole result wait for the stream to finish.

[See a workflow in action](https://casai.run/#concurrency) and explore its code.

## Documentation and examples

- [Documentation and component reference](https://casai.run/documentation/reference/)
- [Read all without JavaScript](https://casai.run/documentation/reference/all/) and [download all documentation](https://casai.run/documentation/reference/documentation.md)
- [Read the authored chapters on GitHub](docs/matrix/documentation.md)
- [Examples](https://github.com/geleto/casai-examples) and [Smart DB Dashboard](https://github.com/geleto/smart-db-dashboard)
- [Tutorials and articles](https://casai.run/documentation/), [CascadaScript](https://cascada.dev/cascada-script/) and [Cascada templates](https://cascada.dev/cascada-template/)

## Development

`npm test` runs mock-only runtime tests. `npm run check` checks source/emitted types, documentation examples, lint and runtime coverage without paid calls. `npm run test:live` explicitly opts into provider-backed tests. See [test instructions](tests/README.md), [the review process](docs/review-process.md) and [documentation maintenance](docs/matrix/MAINTENANCE.md).

Casai is licensed under [Apache-2.0](LICENSE).
