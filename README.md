# Casai: concurrent AI workflows

**AI orchestration for JavaScript and TypeScript.** Write the workflow. Let Cascada handle the concurrency.

AI agents spend much of their time waiting for models, tools, web pages, APIs and databases. Casai orchestrates them with [CascadaScript](https://cascada.dev/cascada-script/), a simple scripting language familiar to JavaScript and Python developers. Your normal sequential code describes the logic; the runtime follows logical dependencies and runs independent work concurrently, preserving source-order results.

- [Build your first workflow](#build-your-first-workflow)
- [Components and tools](#components-and-tools)
- [Documentation and examples](#documentation-and-examples)
- [Development](#development)

## Build your first workflow

Use Node.js 24 or later, ESM imports, and TypeScript 7.0.2 or later with strict checking. Install Casai with the latest AI SDK 7.x and Zod 4.x releases:

```sh
npm install casai ai@7 zod@4
```

Then install the provider you want to use. Choose one, or add more as needed:

| Provider | Install | API key environment variable |
| --- | --- | --- |
| [OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai) | `npm install @ai-sdk/openai@4` | `OPENAI_API_KEY` |
| [Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) | `npm install @ai-sdk/anthropic@4` | `ANTHROPIC_API_KEY` |
| [Google](https://ai-sdk.dev/providers/ai-sdk-providers/google) | `npm install @ai-sdk/google@4` | `GOOGLE_GENERATIVE_AI_API_KEY` |

Each command selects the latest 4.x release of that provider package. See the [AI SDK provider directory](https://ai-sdk.dev/providers/ai-sdk-providers) for more options.

The workflow below uses OpenAI. Set `OPENAI_API_KEY` in your server environment, or a local `.env` file. Save this as `workflow.ts`:

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

Run `node --env-file=.env workflow.ts`. Both agents start independently; the returned object contains their explanation and exercise. Casai does not load environment files itself.

## Components and tools

Share models, tools and defaults with Config. Compose agents, templates, scripts and JavaScript functions through a consistent calling interface. Add embedding, reranking, image, transcription, speech and voice capabilities as needed. Components keep reusable configuration; callers own conversations and session state.

Supported components become tools with `.asTool`, a task description and an `inputSchema`. Use them alongside [Vercel AI SDK](https://ai-sdk.dev/) and MCP tools. Stream model text and media as they arrive, or return completed values for the next workflow step. The reference identifies experimental SDK APIs and capabilities still in development.

Pass a WAV file or a Web Audio `AudioBuffer` directly to `Transcriber` or `Translator`. Casai reads its format and prepares it for the model. For other codecs or audio tracks in video, `.loadsAudio` uses FFmpeg in Node.js with `node-av` installed. [Audio with and without node-av](docs/matrix/documentation.md#guide-recorded-audio-and-optional-codecs)

## Documentation and examples

- [Documentation and component reference](https://casai.run/documentation/reference/)
- [Read all without JavaScript](https://casai.run/documentation/reference/all/) and [download all documentation](https://casai.run/documentation/reference/documentation.md)
- [Read the authored chapters on GitHub](docs/matrix/documentation.md)
- [Examples](https://github.com/geleto/casai-examples) and [Smart DB Dashboard](https://github.com/geleto/smart-db-dashboard)
- [Tutorials and articles](https://casai.run/documentation/), [CascadaScript](https://cascada.dev/cascada-script/) and [Cascada templates](https://cascada.dev/cascada-template/)

## Development

`npm test` runs mock-only runtime tests. `npm run check` checks source/emitted types, documentation examples, lint and runtime coverage without paid calls. `npm run test:live` explicitly opts into provider-backed tests. See [test instructions](tests/README.md), [the review process](docs/review-process.md) and [documentation maintenance](docs/matrix/MAINTENANCE.md).

MIT licensed. See [LICENSE](LICENSE).
