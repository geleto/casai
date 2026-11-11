import { lookup, contextField, renderExample } from './shared.js';

export default function render(options) {
  const tool = lookup(options, { name: 'getRates', description: 'Look up delivery rates.',
    value: '({ standard: 4, express: 9 })', schema: 'z.object({ standard: z.number(), express: z.number() })' });
  return renderExample({ component: 'Function', variable: 'deliveryQuote', options,
    description: 'Calculate a delivery quote from package weight and service.', toolDescription: 'Calculate the delivery price for a package weight and service.', imports: tool.imports,
    setup: [tool.setup, "const input = { weightKg: 2, service: 'express' as const };"],
    fields: [...contextField(tool.context), ...tool.fields,
      "schema: z.object({ amount: z.number(), currency: z.literal('GBP') }),"],
    schema: "z.object({ weightKg: z.number().positive(), service: z.enum(['standard', 'express']) })",
    source: { fields: [`execute: async ({ weightKg, service, getRates }) => {
  const rates = await getRates();
  return { amount: rates[service] + Math.ceil(weightKg) * 0.5, currency: 'GBP' as const };
},`], files: [] },
    toolPrompt: "`Quote ${input.service} delivery for a ${input.weightKg} kg package.`",
    toolArgs: 'input', call: 'deliveryQuote(input)', named: '{ context: input }',
  });
}
