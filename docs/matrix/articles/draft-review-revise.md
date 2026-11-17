# Draft, review, revise - with a stopping point

A useful writing workflow needs more than a request to "try again." It needs feedback the next step can use, a reason to stop, and a limit on how much work it can do.

Casai can express that process as a normal loop: produce a draft, review it, revise it, and review the new version. The models supply the text and feedback; your script controls the iterations.

## Give each component one job

The draft generator writes an initial post. The reviewer returns a score and a list of suggestions as structured output. The revision generator applies those suggestions. [Config](https://casai.run/documentation/reference/config/) shares the model and retry settings, while a separate revision model is optional.

The example accepts AI SDK language models, so you can use the [provider setup](https://casai.run/documentation/reference/#guide-first-workflow) from the documentation. It returns a reusable workflow whose call inputs include the topic and revision limits.

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

Create it with `createRevisionWorkflow(model)`, then call it with a topic, for example `{ topic: 'Reducing food waste at home' }`. With the defaults, it performs at least one revision and stops once the score reaches eight, or after three revisions. Set `minRevisions: 0` to accept a good first draft. Set `maxRevisions: 0` to draft and review once without revising.

The maximum always wins, including when it is lower than the minimum. The returned `finalScore` makes it visible when the workflow reached its limit without meeting the quality target. A model's score is feedback from your chosen rubric, not an independent guarantee of factual accuracy or quality.

## Dependencies decide what can run together

Reviewing requires the draft. Revising requires the review. This loop has real logical dependencies, so those operations wait for one another. Concurrent execution does not remove dependencies that the task needs.

You can still run this workflow for several topics concurrently, or add independent reviewers that inspect different aspects of the same draft. Cascada follows the dependencies in the code, so independent work can overlap while dependent steps keep their source-order results. See [concurrency and ordering](https://casai.run/documentation/reference/#guide-concurrency-ordering-and-recovery).

## Keep retries separate from revisions

`maxRetries` applies to a provider call through the AI SDK. `maxRevisions` limits successful passes through your editorial loop. One does not replace the other.

The component is reusable and stores no current draft. Each call owns its input, draft and iteration count. For application cancellation and provider time limits, follow the [current execution controls](https://casai.run/documentation/reference/#guide-errors); the reference distinguishes these from planned workflow-wide deadlines.

This article's workflow is tested with deterministic component replacements, including a good first review, a persistently low score, and zero allowed revisions. No model call is needed to verify the loop's stopping rules. The [testing chapter](https://casai.run/documentation/reference/#guide-testing) explains that separation.
