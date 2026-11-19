# Documentation contract regressions

These former README and chapter examples retain consumer type coverage after the guide migration and article extraction. They are test fixtures, not a second maintained guide. New reader-facing examples belong in `docs/matrix/documentation.md` or the canonical `docs/matrix/articles/` walkthroughs.

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

<!-- typecheck: current-sdk-ui -->
```typescript
import { createAgentUIStreamResponse } from 'ai';

const assistant = create.LLMAgent({ model, instructions: 'Be concise.' });
const response = await createAgentUIStreamResponse({ agent: assistant, uiMessages });
```

<!-- typecheck: current-agent-tool -->
```typescript
const summarize = create.LLMAgent.withFunction.asTool({
  model,
  inputSchema: z.object({ document: z.string() }),
  prompt: ({ document }) => `Summarize this document: ${document}`,
});
```

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
