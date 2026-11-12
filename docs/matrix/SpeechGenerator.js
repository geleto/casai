import { has, prepared, source, lookup, contextField, renderExample, consumeAudio } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), streaming = has(options, 'asStream');
  const loadedText = has(options, 'loadText');
  const text = has(options, 'textStream') ? "['Hello Ada. ', 'Your Northstar order is due Friday.']" : "'Hello Ada. Your Northstar order is due Friday.'";
  const context = "{ name: 'Ada' }";
  const tool = lookup(options, { name: 'deliveryDay', description: 'Look up the delivery day.', value: "'Friday'" });
  return renderExample({ component: 'SpeechGenerator', variable: 'speakUpdate', functionName: 'speakDeliveryUpdate', options, modelType: 'SpeechModel',
    streamingFactory: 'StreamingSpeechGenerator',
    description: 'Turn a delivery update into spoken audio.', imports: coded ? tool.imports : [],
    toolDescription: loadedText ? 'Read aloud the saved delivery update for Ada.' : 'Generate spoken audio for a customer delivery update.',
    params: has(options, 'voice') ? ['voice: string'] : [],
    setup: coded ? [tool.setup] : [],
    fields: [...(has(options, 'voice') ? ['voice,'] : []), ...(coded ? [...contextField(tool.context), ...tool.fields] : [])],
    schema: coded ? 'z.object({ name: z.string() })' : has(options, 'asTool') ? loadedText ? 'z.object({})' : 'z.object({ text: z.string() })' : undefined,
    source: source('SpeechGenerator', 'text', options, resources, undefined,
      'async ({ name, deliveryDay }) => `Hello ${name}. Your Northstar order is due ${await deliveryDay()}.`'),
    call: `speakUpdate(${coded ? context : loadedText ? '' : text})`, named: coded ? `{ context: ${context} }` : loadedText ? '{}' : `{ text: ${text} }`,
    toolPrompt: "'Speak a delivery update for Ada: your Northstar order is due Friday.'",
    toolArgs: coded ? context : loadedText ? '{}' : `{ text: ${text} }`, result: streaming ? consumeAudio('usage') : 'return { bytes: result.audio.uint8Array, mediaType: result.audio.mediaType };',
  });
}
