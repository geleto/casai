import { has, prepared, source, lookup, contextField, renderExample, consumeAudio } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), streaming = has(options, 'asStream');
  const tool = lookup(options, { name: 'deliveryDay', description: 'Look up the delivery day.', value: "'Friday'" });
  return renderExample({ component: 'SpeechGenerator', variable: 'speakUpdate', options, modelType: 'SpeechModel',
    streamingFactory: 'StreamingSpeechGenerator',
    description: 'Turn a delivery update into spoken audio.', imports: coded ? tool.imports : [],
    params: has(options, 'voice') ? ['voice: string'] : [],
    setup: ["const input = { name: 'Ada' };", ...(coded ? [tool.setup] : [`const text = ${has(options, 'textStream') ? "[`Hello ${input.name}. `, 'Your Northstar order is due Friday.']" : "`Hello ${input.name}. Your Northstar order is due Friday.`"};`])],
    fields: [...(has(options, 'voice') ? ['voice,'] : []), ...(coded ? [...contextField(tool.context), ...tool.fields] : [])],
    schema: coded ? 'z.object({ name: z.string() })' : has(options, 'asTool') ? 'z.object({ text: z.string() })' : undefined,
    source: source('SpeechGenerator', 'text', options, resources, undefined,
      'async ({ name, deliveryDay }) => `Hello ${name}. Your Northstar order is due ${await deliveryDay()}.`'),
    call: coded ? 'speakUpdate(input)' : 'speakUpdate(text)', named: coded ? '{ context: input }' : '{ text }',
    toolPrompt: "`Speak a delivery update for ${input.name}: your Northstar order is due Friday.`",
    toolArgs: coded ? 'input' : '{ text }', result: streaming ? consumeAudio('usage') : 'return { bytes: result.audio.uint8Array, mediaType: result.audio.mediaType };',
  });
}
