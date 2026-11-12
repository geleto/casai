import { has, factory, prepared, source, lookup, literal, multiline, indent } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), asTool = has(options, 'asTool'), stream = has(options, 'asStream');
  const useTools = has(options, 'useTools');
  const input = source('Config', 'prompt', options, resources, literal('Write a delivery update for Ada.'),
    "({ name }: { name: string }) => 'Write a delivery update for ' + name + '.'");
  const tool = lookup(options, { name: 'deliveryDay', description: 'Look up the delivery day.', value: "'Friday'" });
  const imports = ['Config', 'LLMAgent', ...(asTool ? ['Script'] : []), ...(useTools ? ['Function'] : []), ...(coded || asTool || useTools ? ['z'] : []), ...(input.loaded ? ['FileSystemLoader'] : [])];
  const instruction = company => `${company}: ${useTools ? 'Call deliveryDay before writing' : 'Write'} a short delivery update.`;
  const fields = ['model,', `instructions: ${literal(instruction('Northstar'))},`, ...input.fields,
    ...(coded ? ["context: { name: 'Ada' },"] : []),
    ...(coded || asTool ? [`inputSchema: z.object(${coded ? '{ name: z.string() }' : '{}'}),`] : []),
    ...(asTool ? ["description: 'Write a customer delivery update.',"] : []),
    ...(useTools ? ['tools: { deliveryDay },', 'stopWhen: isStepCount(3),'] : [])];
  const call = asTool ? `// The inherited tool modifier makes the completed agent callable by a workflow.
const workflow = Script({ tools: { outlet }, script: 'return outlet({})' });
return await workflow();` : `const result = await outlet();
${stream ? 'for await (const text of result.textStream) console.log(text);\n' : ''}return ${stream ? 'await ' : ''}result.text;`;
  let code = `import { ${imports.join(', ')} } from 'casai';
import { ${useTools ? 'isStepCount, ' : ''}type LanguageModel } from 'ai';
${input.loaded ? "import { fileURLToPath } from 'node:url';\n" : ''}
// Every inheriting component must support the selected modifiers and settings.
export async function shareDeliverySettings(model: LanguageModel) {
${useTools ? indent(tool.setup) + '\n' : ''}  const shared = ${factory('Config', options)}({
${indent(fields.join('\n'), 4)}
  });
  // LLMAgent supports this selection; override just the outlet's instructions.
  const outlet = LLMAgent({ instructions: ${literal(instruction('Northstar Outlet'))} }, shared);
${indent(call)}
}
`;
  if (input.inlineText !== undefined) code = code.replace('__MATRIX_SOURCE__', () => multiline(input.inlineText));
  return { configuration: { component: 'Config', factory: factory('Config', options), variable: 'shared',
    properties: fields.flatMap(field => field.match(/^([\w$]+)\s*(?=[:,])/)?.slice(1) ?? []) },
    files: [{ name: 'Config.ts', language: 'typescript', code }, ...input.files] };
}
