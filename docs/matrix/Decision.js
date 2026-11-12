import { has, prepared, source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options);
  const loadedText = has(options, 'loadText');
  const issue = "'My mug arrived cracked.'";
  const context = `{ issue: ${issue} }`;
  const tool = lookup(options, { description: 'Look up support routing guidance.', value: "'Damaged products go to returns; payment issues go to billing.'" });
  return renderExample({ component: 'Decision', variable: 'routeRequest', functionName: 'routeSupportRequest', options, modelType: 'Experimental_DecisionModel',
    description: 'Choose the team that should handle a damaged-mug request.',
    toolDescription: loadedText ? 'Route the saved damaged-mug request to the right support team.' : 'Route a support request to the returns, billing or delivery team.',
    imports: coded ? tool.imports : [], setup: coded ? [tool.setup] : [],
    fields: [`questions: {
  team: { type: 'choice', instructions: 'Choose the team best placed to resolve the request.',
    criteria: { returns: 'Damaged products and replacements', billing: 'Charges and invoices', delivery: 'Missing parcels' } },
},`, ...(coded ? [...contextField(tool.context), ...tool.fields] : [])],
    schema: coded ? 'z.object({ issue: z.string() })' : has(options, 'asTool') ? loadedText ? 'z.object({})' : 'z.object({ state: z.string() })' : undefined,
    source: source('Decision', 'state', options, resources, undefined,
      'async ({ issue, lookupInfo }) => `Customer request: ${issue}\\n${await lookupInfo()}`'),
    call: `routeRequest(${coded ? context : loadedText ? '' : issue})`, named: coded ? `{ context: ${context} }` : loadedText ? '{}' : `{ state: ${issue} }`,
    toolPrompt: issue,
    toolArgs: coded ? context : loadedText ? '{}' : `{ state: ${issue} }`, result: 'return result.answers.team.choice;',
  });
}
