import { has, prepared, source, lookup, contextField, renderExample, consumeAudio, literal, invoke } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), streaming = has(options, 'asStream');
  const loadedText = has(options, 'loadText');
  const text = has(options, 'textStream') ? "['Hello Ada. ', 'Your Northstar order is due Friday.']" : "'Hello Ada. Your Northstar order is due Friday.'";
  const context = "{ name: 'Ada' }";
  const tool = lookup(options, { name: 'deliveryDay', description: 'Look up the delivery day.', value: "'Friday'" });
  return renderExample({ component: 'SpeechGenerator', variable: 'speakUpdate', functionName: 'speakDeliveryUpdate', options, modelType: 'SpeechModel',
    description: 'Turn a delivery update into spoken audio.', imports: coded ? tool.imports : [],
    toolDescription: loadedText ? 'Read aloud the saved delivery update for Ada.' : 'Generate spoken audio for a customer delivery update.',
    params: has(options, 'voice') ? ['voice: string'] : [],
    setup: coded ? [tool.setup] : [],
    fields: [...(has(options, 'voice') ? ['voice,'] : []), ...(has(options, 'nativeStream') ? ["outputFormat: { type: 'audio/pcm', rate: 24000 },"] : []), ...(coded ? [...contextField(tool.context), ...tool.fields] : []), ...(has(options, 'textStream') && has(options, 'asTool') ? [`text: ${text},`] : [])],
    schema: coded ? 'z.object({ name: z.string() })' : has(options, 'asTool') ? loadedText || has(options, 'textStream') ? 'z.object({})' : 'z.object({ text: z.string() })' : undefined,
    source: source('SpeechGenerator', 'text', options, resources, undefined,
      'async ({ name, deliveryDay }) =>\n  `Hello ${name}. Your Northstar order is due ${await deliveryDay()}.`'),
    call: invoke('speakUpdate', coded ? context : loadedText ? '' : text), named: coded ? `{ context: ${context} }` : loadedText ? '{}' : `{ text: ${text} }`,
    toolPrompt: literal('Speak a delivery update for Ada: your Northstar order is due Friday.'),
    toolArgs: coded ? context : loadedText || has(options, 'textStream') ? '{}' : `{ text: ${text} }`, result: streaming ? consumeAudio('usage') : `return {\n  bytes: result.audio.uint8Array,\n  mediaType: result.audio.mediaType,${has(options, 'textStream') || has(options, 'nativeStream') ? '\n  audioFormat: result.audioFormat,' : ''}\n};`,
  });
}
