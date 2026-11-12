import { has, prepared, sourceMode, source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), batch = has(options, 'batch');
  const loadedText = has(options, 'loadText');
  const text = batch ? "['Trail mug. Insulated steel. Leakproof lid.', 'Trail bottle. Insulated steel. Leakproof lid.']" : "'Trail mug. Insulated steel. Leakproof lid.'";
  const context = "{ title: 'Trail mug' }";
  const tool = lookup(options, { description: 'Look up the product features.', value: "'Insulated steel. Leakproof lid.'" });
  return renderExample({ component: 'Embedder', variable: 'embedProduct', functionName: 'embedProductDescription', options, modelType: 'EmbeddingModel',
    description: 'Create a search embedding for the same product description.',
    toolDescription: loadedText ? 'Generate a search embedding for the saved Trail mug description.' : 'Generate search embeddings for product descriptions.',
    imports: coded ? tool.imports : [], setup: coded ? [tool.setup] : [],
    fields: coded ? [...contextField([...tool.context, ...(sourceMode(options)?.includes('Script') ? [`batch: ${batch}`] : [])]), ...tool.fields] : [],
    schema: coded ? 'z.object({ title: z.string() })' : has(options, 'asTool') ? loadedText ? 'z.object({})' : `z.object({ input: ${batch ? 'z.array(z.string())' : 'z.string()'} })` : undefined,
    source: source('Embedder', 'input', options, resources, undefined,
      batch ? 'async ({ title, lookupInfo }) => {\n  const features = await lookupInfo();\n  return [`${title}. ${features}`, `Trail bottle. ${features}`];\n}' : 'async ({ title, lookupInfo }) => `${title}. ${await lookupInfo()}`'),
    call: `embedProduct(${coded ? context : loadedText ? '' : text})`, named: coded ? `{ context: ${context} }` : loadedText ? '{}' : `{ input: ${text} }`,
    toolArgs: coded ? context : loadedText ? '{}' : `{ input: ${text} }`, toolCaller: 'script',
    result: sourceMode(options)?.includes('Script') ? "// Scripts may return one text or an array; narrow the native result.\nreturn 'embedding' in result ? result.embedding : result.embeddings;" : `return result.${batch ? 'embeddings' : 'embedding'};`,
  });
}
