import { source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const tool = lookup(options, { name: 'getShipment', description: 'Look up shipping cost and delivery day.',
    value: "({ cost: 4, deliveryDay: 'Friday' })", schema: 'z.object({ cost: z.number(), deliveryDay: z.string() })' });
  return renderExample({ component: 'Script', variable: 'orderSummary', options,
    description: 'Combine order and shipping information. Independent lookups run concurrently.', toolDescription: 'Look up an order and return its total cost and delivery day.', imports: tool.imports,
    setup: ["const getOrder = async (orderId: string) => ({ orderId, subtotal: 48 });", tool.setup, "const input = { orderId: 'N-1042' };"],
    fields: [...contextField(['getOrder', ...tool.context]), ...tool.fields,
      'schema: z.object({ orderId: z.string(), total: z.number(), deliveryDay: z.string() }),'],
    schema: 'z.object({ orderId: z.string() })',
    source: source('Script', 'script', options, resources, undefined, undefined, 'cas'),
    toolPrompt: "`Summarize order ${input.orderId}, including its total cost and delivery day.`",
    toolArgs: 'input', call: 'orderSummary(input)', named: '{ context: input }',
  });
}
