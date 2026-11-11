import { has, prepared, source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options);
  const tool = lookup(options, { description: 'Look up search guidance for the support query.', value: "'Prioritize the replacement policy.'" });
  return renderExample({ component: 'Reranker', variable: 'findPolicy', options, modelType: 'RerankingModel',
    description: 'Rank policy passages by relevance to a damaged-mug question.',
    imports: coded ? tool.imports : [], setup: [`const policies = [
  'Send a photo of a damaged item within 30 days for a free replacement.',
  'Update payment cards from account settings.',
  'Follow your delivery using the tracking link.',
];`, "const input = { question: 'How do I replace a damaged mug?' };", ...(coded ? [tool.setup] : [])],
    fields: ['documents: policies,', ...(has(options, 'topN') ? ['topN: 2,'] : []), ...(coded ? [...contextField(tool.context), ...tool.fields] : [])],
    schema: coded ? 'z.object({ question: z.string() })' : has(options, 'asTool') ? 'z.object({ query: z.string() })' : undefined,
    source: source('Reranker', 'query', options, resources, undefined,
      'async ({ question, lookupInfo }) => `${question} ${await lookupInfo()}`'),
    call: coded ? 'findPolicy(input)' : 'findPolicy(input.question)', named: coded ? '{ context: input }' : '{ query: input.question }',
    toolArgs: coded ? 'input' : '{ query: input.question }', result: 'return result.ranking;',
  });
}
