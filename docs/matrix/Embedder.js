import { has, prepared, sourceMode, source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), batch = has(options, 'batch');
  const tool = lookup(options, { description: 'Look up the product features.', value: "'Insulated steel. Leakproof lid.'" });
  return renderExample({ component: 'Embedder', variable: 'embedProduct', options, modelType: 'EmbeddingModel',
    description: 'Create a search embedding for the same product description.',
    toolDescription: 'Generate search embeddings for product descriptions.',
    imports: coded ? tool.imports : [], setup: ["const input = { title: 'Trail mug' };", ...(coded ? [tool.setup] : [`const text = ${batch ? "[`${input.title}. Insulated steel. Leakproof lid.`, 'Trail bottle. Insulated steel. Leakproof lid.']" : "`${input.title}. Insulated steel. Leakproof lid.`"};`])],
    fields: coded ? [...contextField([...tool.context, ...(sourceMode(options)?.includes('Script') ? [`batch: ${batch}`] : [])]), ...tool.fields] : [],
    schema: coded ? 'z.object({ title: z.string() })' : has(options, 'asTool') ? `z.object({ input: ${batch ? 'z.array(z.string())' : 'z.string()'} })` : undefined,
    source: source('Embedder', 'input', options, resources, undefined,
      batch ? 'async ({ title, lookupInfo }) => {\n  const features = await lookupInfo();\n  return [`${title}. ${features}`, `Trail bottle. ${features}`];\n}' : 'async ({ title, lookupInfo }) => `${title}. ${await lookupInfo()}`'),
    call: coded ? 'embedProduct(input)' : 'embedProduct(text)', named: coded ? '{ context: input }' : '{ input: text }',
    toolArgs: coded ? 'input' : '{ input: text }', toolCaller: 'script',
    result: sourceMode(options)?.includes('Script') ? "// Scripts may return one text or an array; narrow the native result.\nreturn 'embedding' in result ? result.embedding : result.embeddings;" : `return result.${batch ? 'embeddings' : 'embedding'};`,
  });
}
