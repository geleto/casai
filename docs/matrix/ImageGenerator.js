import { has, prepared, source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), reference = has(options, 'referenceImage'), mask = has(options, 'mask');
  const tool = lookup(options, { description: 'Look up the product photography guidelines.', value: "'Keep the mug shape and markings unchanged.'" });
  return renderExample({ component: 'ImageGenerator', variable: 'productScene', options, modelType: 'ImageModel',
    params: [...(reference ? ['referenceImage: Uint8Array'] : []), ...(mask ? ['editMask: Uint8Array'] : [])], description: 'Create a product photo of a Trail mug in a mountain scene.',
    imports: coded ? tool.imports : [], setup: ["const input = { scene: 'a picnic table beside a mountain lake' };", ...(coded ? [tool.setup] : ['const prompt = `Place a Trail mug on ${input.scene}. Keep the mug shape and markings unchanged.`;'])],
    fields: [...(reference ? ['// Reference media stays in application configuration.', 'images: [referenceImage],'] : []), ...(mask ? ['mask: editMask,'] : []), ...(has(options, 'count') ? ['n: 3,'] : []), ...(coded ? [...contextField(tool.context), ...tool.fields] : [])],
    schema: coded ? 'z.object({ scene: z.string() })' : has(options, 'asTool') ? 'z.object({ prompt: z.string() })' : undefined,
    source: source('ImageGenerator', 'prompt', options, resources, undefined,
      'async ({ scene, lookupInfo }) => `Place a Trail mug on ${scene}. ${await lookupInfo()}`'),
    call: coded ? 'productScene(input)' : 'productScene(prompt)', named: coded ? '{ context: input }' : '{ prompt }',
    toolArgs: coded ? 'input' : '{ prompt }', result: 'return result.images.map(image => ({ bytes: image.uint8Array, mediaType: image.mediaType }));',
  });
}
