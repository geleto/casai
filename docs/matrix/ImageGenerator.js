import { has, prepared, source, lookup, contextField, renderExample } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), reference = has(options, 'referenceImage'), mask = has(options, 'mask');
  const loadedText = has(options, 'loadText');
  const prompt = "'Place a Trail mug on a picnic table beside a mountain lake. Keep the mug shape and markings unchanged.'";
  const context = "{ scene: 'a picnic table beside a mountain lake' }";
  const tool = lookup(options, { description: 'Look up the product photography guidelines.', value: "'Keep the mug shape and markings unchanged.'" });
  return renderExample({ component: 'ImageGenerator', variable: 'productScene', functionName: 'createProductPhoto', options, modelType: 'ImageModel',
    params: [...(reference ? ['referenceImage: Uint8Array'] : []), ...(mask ? ['editMask: Uint8Array'] : [])], description: 'Create a product photo of a Trail mug in a mountain scene.',
    toolDescription: loadedText ? 'Create a Trail mug product photo using the saved mountain scene description.' : 'Create a product photo of a Trail mug in the requested scene.',
    imports: coded ? tool.imports : [], setup: coded ? [tool.setup] : [],
    fields: [...(reference ? ['// Reference media stays in application configuration.', 'images: [referenceImage],'] : []), ...(mask ? ['mask: editMask,'] : []), ...(has(options, 'count') ? ['n: 3,'] : []), ...(coded ? [...contextField(tool.context), ...tool.fields] : [])],
    schema: coded ? 'z.object({ scene: z.string() })' : has(options, 'asTool') ? loadedText ? 'z.object({})' : 'z.object({ prompt: z.string() })' : undefined,
    source: source('ImageGenerator', 'prompt', options, resources, undefined,
      'async ({ scene, lookupInfo }) => `Place a Trail mug on ${scene}. ${await lookupInfo()}`'),
    call: `productScene(${coded ? context : loadedText ? '' : prompt})`, named: coded ? `{ context: ${context} }` : loadedText ? '{}' : `{ prompt: ${prompt} }`,
    toolPrompt: "'Create a product photo of a Trail mug on a picnic table beside a mountain lake. Keep its shape and markings unchanged.'",
    toolArgs: coded ? context : loadedText ? '{}' : `{ prompt: ${prompt} }`, result: 'return result.images.map(image => ({ bytes: image.uint8Array, mediaType: image.mediaType }));',
  });
}
