import { source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const tool = lookup(options, { name: 'deliveryDay', description: 'Look up the delivery day.', value: "'Friday'" });
  return renderExample({ component: 'Template', variable: 'deliveryUpdate', options,
    description: 'Write a delivery update for the customer.', imports: tool.imports,
    setup: [tool.setup, "const input = { name: 'Ada', orderId: 'N-1042' };"],
    fields: [...contextField(["company: 'Northstar'", ...tool.context]), ...tool.fields],
    schema: 'z.object({ name: z.string(), orderId: z.string() })',
    source: source('Template', 'template', options, resources, undefined, undefined, 'cat'),
    toolArgs: 'input', call: 'deliveryUpdate(input)', named: '{ context: input }',
  });
}
