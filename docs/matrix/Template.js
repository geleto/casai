import { source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const tool = lookup(options, { name: 'deliveryDay', description: 'Look up the delivery day.', value: "'Friday'" });
  return renderExample({ component: 'Template', variable: 'deliveryUpdate', options,
    description: 'Write a delivery update for the customer.', toolDescription: 'Write a delivery update for a customer and order.', imports: tool.imports,
    setup: [tool.setup, "const input = { name: 'Ada', orderId: 'N-1042' };"],
    fields: [...contextField(["company: 'Northstar'", ...tool.context]), ...tool.fields],
    schema: 'z.object({ name: z.string(), orderId: z.string() })',
    source: source('Template', 'template', options, resources, undefined, undefined, 'cat'),
    toolPrompt: "`Write a delivery update for ${input.name}, order ${input.orderId}.`",
    toolArgs: 'input', call: 'deliveryUpdate(input)', named: '{ context: input }',
  });
}
