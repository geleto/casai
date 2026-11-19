# Change the implementation. Keep the workflow.

A support workflow needs to send each ticket to the right team. At first, a few keyword rules are enough. Later, you want a model to handle the tickets your rules miss. You can change how that decision is made without rewriting the workflow around it.

The trick is to give the decision one simple shape: an operation that takes a ticket and returns its category. Behind that operation, you can use any of Casai's components - a Function, an LLMAgent or a Script. They don't all return the same kind of result, though, so decide up front exactly what the operation returns.

## Decide what the workflow needs back

Each ticket has a subject and a message. The classifier returns `{ category }`, where the category is `billing`, `account` or `other`. The workflow then turns that category into the name of a support queue.

The three components hand back their results differently:

- A [Function](https://casai.run/documentation/reference/function/) returns your value directly.
- An [LLMAgent](https://casai.run/documentation/reference/llmagent/) returns the full AI SDK result, so a small wrapper (`aiClassify` below) picks out its `.output`.
- A [Script](https://casai.run/documentation/reference/script/) can combine the other two and still return the same value.

The example below builds all three versions. It takes an AI SDK language model from your application; see [the first workflow](https://casai.run/documentation/reference/#guide-first-workflow) for installation and provider setup.

## Three implementations, one workflow

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

Pick one of the returned workflows and call it with `{ subject, message }`. With the rules version, a ticket that mentions an invoice goes to `billing-support`. With the hybrid version, a request like "I cannot access my workspace" doesn't match any rule, so it goes to the model instead.

The workflow's code is the same in all three cases. The only difference is which `classify` operation you pass in through its context when you create it. To switch implementations, create a new workflow with a different `classify`. Don't change the configuration of a component that other code already uses.

## What the shared schema guarantees

Because all three versions use the same schema, the category always has the same shape. For the LLMAgent, `Output.object` parses the model's structured output. The Function and the Script use `schema` to check the values they return. The wrapper simply passes on the model's already-parsed value - there's no second parsing step.

Matching shapes don't mean matching decisions, though. A keyword rule and a model can return the same type and still classify the same ticket differently, and a keyword rule will never be as capable as a model. Test each option on a set of realistic tickets before you switch the one your application uses. Note also that the hybrid version always trusts a rule when one matches, so it only saves model calls where your rules are actually good.

An LLMAgent's result also includes the conversation history, token usage and SDK events. This operation returns only the category. If your callers need any of that extra information, add it to what the operation returns on purpose - don't expect every component to provide it.

## The same idea works for text and streams

If the operation returns text instead of a category, a Template can be one more option. A model-based version extracts `.output`, while a Template or a Function that returns a string already gives the caller the text it needs.

Streaming needs its own agreement. Every option must return the same kind of stream, and must finish and report errors in a compatible way. An LLMAgent's `.textStream` is not the same thing as its complete `.output`. Read about [streaming contracts](https://casai.run/documentation/reference/#guide-streaming-contracts) before turning an operation that returns a complete result into one that streams. Built-in streaming for Template and Script is still marked as planned in the reference.

When you choose an implementation for another operation, keep the [rules for replacing components](https://casai.run/documentation/reference/#guide-interchanging-components-in-workflows) and the [guide to choosing an orchestration strategy](https://casai.run/documentation/reference/#guide-choosing-your-orchestration-strategy) nearby.
