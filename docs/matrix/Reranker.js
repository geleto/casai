import { has, prepared, source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options);
  const loadedText = has(options, 'loadText');
  const question = "'How do I replace a damaged mug?'";
  const context = `{ question: ${question} }`;
  const tool = lookup(options, { description: 'Look up search guidance for the support query.', value: "'Prioritize the replacement policy.'" });
  return renderExample({ component: 'Reranker', variable: 'findPolicy', functionName: 'findRelevantPolicies', options, modelType: 'RerankingModel',
    description: 'Rank policy passages by relevance to a damaged-mug question.',
    toolDescription: loadedText ? 'Find store policies relevant to the saved damaged-mug question.' : 'Find the most relevant store policy passages for a customer question.',
    imports: coded ? tool.imports : [], setup: [`const policies = [
  'Send a photo of a damaged item within 30 days for a free replacement.',
  'Update payment cards from account settings.',
  'Follow your delivery using the tracking link.',
];`, ...(coded ? [tool.setup] : [])],
    fields: ['documents: policies,', ...(has(options, 'topN') ? ['topN: 2,'] : []), ...(coded ? [...contextField(tool.context), ...tool.fields] : [])],
    schema: coded ? 'z.object({ question: z.string() })' : has(options, 'asTool') ? loadedText ? 'z.object({})' : 'z.object({ query: z.string() })' : undefined,
    source: source('Reranker', 'query', options, resources, undefined,
      'async ({ question, lookupInfo }) => `${question} ${await lookupInfo()}`'),
    call: `findPolicy(${coded ? context : loadedText ? '' : question})`, named: coded ? `{ context: ${context} }` : loadedText ? '{}' : `{ query: ${question} }`,
    toolPrompt: question,
    toolArgs: coded ? context : loadedText ? '{}' : `{ query: ${question} }`, result: 'return result.ranking;',
  });
}
