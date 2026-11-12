export default function render() {
  return { configuration: { component: 'Function', factory: 'Function', variable: 'quote', properties: ['context', 'inputSchema', 'execute'] },
    files: [{ name: 'Context.ts', language: 'typescript', code: `import { Function, z } from 'casai';

// Context holds application values and private dependencies.
export async function quoteDeliveryWithContext() {
  const context = {
    currency: 'GBP',
    shipping: (weightKg: number) => 4 + Math.ceil(weightKg) * 0.5,
  };
  const quote = Function({
    context,
    inputSchema: z.object({ weightKg: z.number().positive() }),
    execute: ({ weightKg, currency, shipping }) => ({
      amount: shipping(weightKg), currency,
    }),
  });
  // Only weightKg is public; callers do not replace shipping or currency.
  return await quote({ weightKg: 2 });
}
` }] };
}
