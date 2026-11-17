# Change the implementation. Keep the workflow.

A support workflow needs to route a ticket. At first, a few rules are enough. Later, a model handles wording the rules miss. You can change how that decision is made without rewriting the workflow around it.

The useful boundary is a small application operation: accept a ticket and return its category. Casai's components make it straightforward to put a Function, an LLMAgent or a Script behind that operation. They do not all return the same kind of result, so make the boundary explicit.

## Choose the value the workflow needs

Our ticket has a subject and a message. The classifier returns `{ category }`, where the category is `billing`, `account` or `other`. The calling workflow turns that category into a queue name.

A [Function](https://casai.run/documentation/reference/function/) returns its application value directly. An [LLMAgent](https://casai.run/documentation/reference/llmagent/) returns an SDK result, so a small adapter extracts `.output`. A [Script](https://casai.run/documentation/reference/script/) can combine both approaches and return the same application value.

The example below builds all three implementations. It accepts an AI SDK language model from your application; see [the first workflow](https://casai.run/documentation/reference/#guide-first-workflow) for installation and provider setup.

## Three implementations, one caller

<!-- typecheck: switch-components -->
```typescript
import { create, z } from 'casai';
import { Output, type LanguageModel } from 'ai';

export function createTicketWorkflows(model: LanguageModel) {
  const ticketInput = z.object({
    subject: z.string(),
    message: z.string(),
  });
  const routeSchema = z.object({
    category: z.enum(['billing', 'account', 'other']),
  });
  type Ticket = z.input<typeof ticketInput>;
  type Route = z.output<typeof routeSchema>;
  type Classifier = (ticket: Ticket) => PromiseLike<Route>;

  const ruleClassifier = create.Function({
    inputSchema: ticketInput,
    schema: routeSchema,
    execute: ({ subject, message }) => {
      const text = `${subject} ${message}`.toLowerCase();
      if (/invoice|billing|refund/.test(text)) {
        return { category: 'billing' as const };
      }
      if (/password|sign.?in|login/.test(text)) {
        return { category: 'account' as const };
      }
      return { category: 'other' as const };
    },
  });

  const modelClassifier = create.LLMAgent.withTemplate({
    model,
    inputSchema: ticketInput,
    output: Output.object({ schema: routeSchema }),
    instructions: 'Classify support tickets as billing, account or other.',
    prompt: 'Subject: {{ subject }}\nMessage: {{ message }}',
  });
  const aiClassify: Classifier = async ticket =>
    (await modelClassifier(ticket)).output;

  const hybridClassifier = create.Script({
    inputSchema: ticketInput,
    schema: routeSchema,
    context: { ruleClassifier, aiClassify },
    script: `
      var ticket = { subject: subject, message: message }
      var route = ruleClassifier(ticket)
      if route.category != "other"
        return route
      endif
      return aiClassify(ticket)
    `,
  });

  const buildWorkflow = (classify: Classifier) => create.Script({
    inputSchema: ticketInput,
    context: { classify },
    script: `
      var route = classify({ subject: subject, message: message })
      return { category: route.category, queue: route.category + "-support" }
    `,
  });

  return {
    rules: buildWorkflow(ruleClassifier),
    model: buildWorkflow(aiClassify),
    hybrid: buildWorkflow(hybridClassifier),
  };
}
```

Choose one of the returned workflows, then call it with `{ subject, message }`. A ticket mentioning an invoice goes to `billing-support` under the rules implementation. A request such as "I cannot access my workspace" falls through to the model in the hybrid implementation.

The workflow's code does not change. The selected `classify` operation is supplied through its context when the component is created. Create a new workflow to change that binding; do not mutate a shared component's configuration.

## What the shared contract guarantees

The shared schema keeps the category's shape consistent. `Output.object` parses the model's structured output; Function and Script use `schema` for their returned values. The adapter returns the model's parsed value without adding a second parsing step.

The implementations can still make different decisions. Matching input and output types does not make a keyword rule as capable as a model. Evaluate the candidates against representative tickets before switching the implementation used by your application. The hybrid deliberately trusts a matching rule, so it saves a model call only where those rules are useful.

Conversation history, token usage and SDK events belong to the LLMAgent result. This application operation exposes only the category. If callers need those additional fields, include them deliberately in the operation's contract rather than expecting every component to supply them.

## Apply the same idea to text and streams

For an operation that returns text, a Template can be another implementation. A model-backed implementation extracts `.output`, while a Template or a string-returning Function already provides the value the caller needs.

Streaming is a separate contract. Every replacement must return the same kind of stream, with compatible completion and error behavior. An LLMAgent's `.textStream` is different from its complete `.output`. See [streaming contracts](https://casai.run/documentation/reference/#guide-streaming-contracts) before changing a complete operation into a streaming one; native Template and Script streaming remain marked as planned in the reference.

Keep [component replacement rules](https://casai.run/documentation/reference/#guide-interchanging-components-in-workflows) and the [orchestration strategy table](https://casai.run/documentation/reference/#guide-choosing-your-orchestration-strategy) nearby when choosing the implementation for another operation.
