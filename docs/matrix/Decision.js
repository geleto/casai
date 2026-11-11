import { has, prepared, source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options);
  const tool = lookup(options, { description: 'Look up support routing guidance.', value: "'Damaged products go to returns; payment issues go to billing.'" });
  return renderExample({ component: 'Decision', variable: 'routeRequest', options, modelType: 'Experimental_DecisionModel',
    description: 'Choose the team that should handle a damaged-mug request.',
    imports: coded ? tool.imports : [], setup: ["const input = { issue: 'My mug arrived cracked.' };", ...(coded ? [tool.setup] : [])],
    fields: [`questions: {
  team: { type: 'choice', instructions: 'Choose the team best placed to resolve the request.',
    criteria: { returns: 'Damaged products and replacements', billing: 'Charges and invoices', delivery: 'Missing parcels' } },
},`, ...(coded ? [...contextField(tool.context), ...tool.fields] : [])],
    schema: coded ? 'z.object({ issue: z.string() })' : has(options, 'asTool') ? 'z.object({ state: z.string() })' : undefined,
    source: source('Decision', 'state', options, resources, undefined,
      'async ({ issue, lookupInfo }) => `Customer request: ${issue}\\n${await lookupInfo()}`'),
    call: coded ? 'routeRequest(input)' : 'routeRequest(input.issue)', named: coded ? '{ context: input }' : '{ state: input.issue }',
    toolArgs: coded ? 'input' : '{ state: input.issue }', result: 'return result.answers.team.choice;',
  });
}
