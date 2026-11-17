import { has, prepared, source, lookup, contextField, renderExample, literal, invoke } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), loaded = has(options, 'loadText');
  const prompt = literal('A slow camera move around a Trail mug beside a mountain lake at sunrise.');
  const context = "{ scene: 'a mountain lake at sunrise' }";
  const helper = lookup(options, { description: 'Look up the product video guidelines.', value: "'Use a slow camera move and keep the product markings visible.'" });
  return renderExample({ component: 'VideoGenerator', variable: 'productClip', functionName: 'createProductVideo', options, modelType: 'VideoModel',
    description: 'Generate a short product video using the selected provider model.',
    toolDescription: 'Create a short product video of a Trail mug in the requested scene.',
    imports: coded ? helper.imports : [], setup: coded ? [helper.setup] : [],
    fields: [...(has(options, 'count') ? ['n: 2,'] : []), ...(coded ? [...contextField(helper.context), ...helper.fields] : [])],
    schema: coded ? 'z.object({ scene: z.string() })' : has(options, 'asTool') ? loaded ? 'z.object({})' : 'z.object({ prompt: z.string() })' : undefined,
    source: source('VideoGenerator', 'prompt', options, resources, undefined, 'async ({ scene, lookupInfo }) =>\n  `A Trail mug beside ${scene}. ${await lookupInfo()}`'),
    call: invoke('productClip', coded ? context : loaded ? '' : prompt), named: coded ? `{ context: ${context} }` : loaded ? '{}' : `{ prompt: ${prompt} }`,
    toolPrompt: literal('Create a short product video of a Trail mug beside a mountain lake at sunrise.'),
    toolArgs: coded ? context : loaded ? '{}' : `{ prompt: ${prompt} }`,
    result: 'return result.videos.map(video => ({\n  bytes: video.uint8Array,\n  mediaType: video.mediaType,\n}));',
  });
}
