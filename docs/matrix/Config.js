import { has, lookup, literal } from './shared.js';

export default function render(options) {
  const tool = lookup(options, { name: 'deliveryDay', description: 'Look up the delivery day.', value: "'Friday'" });
  const imports = has(options, 'useTools') ? 'Config, Function, Template, z' : 'Config, Template, z';
  return { configuration: { component: 'Config', factory: 'Config', variable: 'shared', properties: ['context', ...(has(options, 'useTools') ? ['tools'] : [])] },
    files: [{ name: 'Config.ts', language: 'typescript', code: `import { ${imports} } from 'casai';

// Share settings, then override the company for an outlet.
export async function example() {
${tool.setup.split('\n').map(line => '  ' + line).join('\n')}
  const shared = Config({
    context: { company: 'Northstar'${has(options, 'useTools') ? '' : ', deliveryDay'} },
${has(options, 'useTools') ? '    tools: { deliveryDay },\n' : ''}  });
  const update = Template({
    inputSchema: z.object({ name: z.string() }),
    template: ${literal('{{ company }}: Hello {{ name }}! Your order arrives {{ deliveryDay() }}.')},
  }, shared);
  const outlet = Template({ context: { company: 'Northstar Outlet' } }, update);
  return { main: await update({ name: 'Ada' }), outlet: await outlet({ name: 'Ada' }) };
}
` }] };
}
