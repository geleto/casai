# Draft, review, revise - with a stopping point

A good writing workflow needs more than a request to "try again." Each round needs feedback the next step can act on, the loop needs a reason to stop, and there has to be a limit on how much work it does.

In Casai, this is an ordinary loop: write a draft, review it, revise it, then review the new version. The models write the text and the feedback; your script decides how many rounds to run.

## Give each component one job

Three components share the work:

- The **draft generator** writes the first version of the post.
- The **reviewer** returns a score and a list of suggestions as structured output.
- The **revision generator** rewrites the draft using those suggestions.

A [Config](https://casai.run/documentation/reference/config/) holds the model and retry settings they share. Using a different model for revisions is optional.

The example takes AI SDK language models, so you can use the [provider setup](https://casai.run/documentation/reference/#guide-first-workflow) from the documentation. It returns a workflow you can reuse. Each call takes a topic and, optionally, a quality target and revision limits.

## Put the stopping rules in the workflow

<!-- typecheck: revision-workflow -->
```typescript
import { create, z } from 'casai';
import { Output, type LanguageModel } from 'ai';

export function createRevisionWorkflow(
  model: LanguageModel,
  revisionModel: LanguageModel = model,
) {
  const baseConfig = create.Config({ model, maxRetries: 3 });
  const draftGenerator = create.LLMAgent.withTemplate({
    inputSchema: z.object({ topic: z.string() }),
    prompt: 'Write a short, practical blog post about {{ topic }}.',
  }, baseConfig);

  const critiqueGenerator = create.LLMAgent.withTemplate({
    inputSchema: z.object({ draft: z.string() }),
    output: Output.object({ schema: z.object({
      score: z.number().min(1).max(10),
      suggestions: z.array(z.string()),
    }) }),
    instructions: [
      'Review clarity, concrete examples and relevance to the topic.',
      'Give a score from 1 to 10 and actionable revision suggestions.',
    ].join(' '),
    prompt: 'Review this draft: {{ draft }}',
  }, baseConfig);

  const revisionGenerator = create.LLMAgent.withTemplate({
    model: revisionModel,
    inputSchema: z.object({
      draft: z.string(),
      suggestions: z.array(z.string()),
    }),
    prompt: [
      'Revise the draft using these suggestions.',
      'DRAFT: {{ draft }}',
      'SUGGESTIONS: {{ suggestions | join("; ") }}',
    ].join('\n\n'),
  }, baseConfig);

  return create.Script({
    inputSchema: z.object({
      topic: z.string(),
      qualityThreshold: z.number().min(1).max(10).default(8),
      maxRevisions: z.number().int().min(0).max(5).default(3),
      minRevisions: z.number().int().min(0).max(5).default(1),
    }),
    context: { draftGenerator, critiqueGenerator, revisionGenerator },
    script: `
      var revisionCount = 0
      var currentDraft = draftGenerator({ topic: topic }).output
      var critique = critiqueGenerator({ draft: currentDraft }).output

      while (critique.score < qualityThreshold or revisionCount < minRevisions)
          and revisionCount < maxRevisions
        revisionCount = revisionCount + 1
        currentDraft = revisionGenerator({
          draft: currentDraft, suggestions: critique.suggestions
        }).output
        critique = critiqueGenerator({ draft: currentDraft }).output
      endwhile

      return {
        finalDraft: currentDraft,
        finalScore: critique.score,
        revisionCount: revisionCount
      }
    `,
  });
}
```

Create the workflow with `createRevisionWorkflow(model)`, then call it with a topic, for example `{ topic: 'Reducing food waste at home' }`. With the default settings, it always revises at least once, then stops as soon as the score reaches eight - or after three revisions, whichever comes first.

You can change these limits on each call:

- Set `minRevisions: 0` to accept a good first draft as it is.
- Set `maxRevisions: 0` to write and review once, without revising.

The maximum always wins, even if you set it lower than the minimum. The returned `finalScore` shows you when the workflow hit its limit before reaching the quality target. Keep in mind that the score is the model's judgment, based on the review criteria you gave it. It doesn't guarantee that the post is accurate or good.

## Dependencies decide what can run together

Reviewing needs the draft. Revising needs the review. Each step really does depend on the one before it, so they run one after another. Running work at the same time can't remove a dependency the task actually has.

You can still run this workflow for several topics at once, or add more reviewers that each check a different aspect of the same draft. Cascada follows the dependencies in your code: independent work runs at the same time, and dependent steps still produce their results in the order they're written. See [concurrency and ordering](https://casai.run/documentation/reference/#guide-concurrency-ordering-and-recovery).

## Keep retries separate from revisions

`maxRetries` and `maxRevisions` limit different things:

- `maxRetries` is how many times the AI SDK retries a single provider call that fails.
- `maxRevisions` is how many successful rounds your editing loop can run.

One doesn't replace the other.

The workflow doesn't keep a draft between calls, so you can safely reuse it. Each call has its own input, draft and revision count. To cancel a run or put a time limit on provider calls, see the [current execution controls](https://casai.run/documentation/reference/#guide-errors). The reference explains how these differ from workflow-wide deadlines, which are still planned.

The tests for this article's workflow replace the models with stand-ins that always give the same answers. They cover a good first review, a score that stays low, and zero allowed revisions. No real model call is needed to check that the loop stops when it should. The [testing chapter](https://casai.run/documentation/reference/#guide-testing) explains this approach.
