import { has, prepared, source, lookup, contextField, renderExample, audioStreamSetup, consumeAudio } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), streaming = has(options, 'asStream');
  const tool = lookup(options, { name: 'findRecording', description: 'Find a finite delivery-note recording.', value: "'delivery-note'" });
  return renderExample({ component: 'Translator', variable: 'translateNote', functionName: 'translateDeliveryNote', options,
    streamingFactory: 'StreamingTranslator',
    modelType: "Parameters<typeof import('ai').experimental_streamTranslate>[0]['model']",
    params: ['pcm24k: Uint8Array'], description: 'Translate the same spoken delivery note into French.',
    imports: coded ? tool.imports : [], setup: [audioStreamSetup, ...(coded ? [tool.setup, "const recordings = { 'delivery-note': openRecording };"] : [])],
    fields: ["inputAudioFormat: { type: 'audio/pcm', rate: 24000 },", "targetLanguage: 'fr',", ...(coded ? [...contextField(['recordings', ...tool.context]), ...tool.fields] : [])],
    schema: coded ? 'z.object({})' : undefined,
    source: source('Translator', 'audio', options, resources, undefined,
      'async ({ findRecording, recordings }) => recordings[await findRecording() as keyof typeof recordings]()'),
    call: coded ? 'translateNote({})' : 'translateNote(openRecording())', named: coded ? '{ context: {} }' : '{ audio: openRecording() }',
    result: streaming ? consumeAudio('translationText') : `// The completed result contains audio bytes and the final source/translated text.
return { audio: result.audio, sourceText: result.sourceText, translationText: result.translationText };`,
  });
}
