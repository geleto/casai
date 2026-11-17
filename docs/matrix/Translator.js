import { has, prepared, source, lookup, contextField, renderExample, audioStreamSetup, consumeAudio } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), streaming = has(options, 'asStream'), loaded = has(options, 'loadAudio');
  const configuredTool = has(options, 'asTool') && !coded;
  const tool = lookup(options, { name: 'findRecording', description: 'Find a finite delivery-note recording.', value: "'delivery-note'" });
  return renderExample({ component: 'Translator', variable: 'translateNote', functionName: 'translateDeliveryNote', options,
    modelType: "Parameters<\n  typeof import('ai').experimental_streamTranslate\n>[0]['model']",
    params: [loaded ? 'recordingUrl: URL' : 'pcm24k: Uint8Array'], description: 'Translate the same spoken delivery note into French.\n// This model accepts 24 kHz mono PCM16.',
    toolDescription: 'Translate the available delivery-note recording into French.',
    imports: coded ? tool.imports : [], setup: [...(loaded ? ['// Supply an application-authorized recordingUrl, including trusted\n// redirects and playlist resources.'] : []), ...(!loaded && !configuredTool ? [audioStreamSetup] : []), ...(coded ? [tool.setup, "const recordings = { 'delivery-note': openRecording };"] : [])],
    fields: ["inputAudioFormat: { type: 'audio/pcm', rate: 24000 },", "targetLanguage: 'fr',", ...(loaded ? ['// Install node-av. Omit format to let FFmpeg detect the container.', 'mediaSettings: {},'] : []), ...(coded ? [...contextField(['recordings', ...tool.context]), ...tool.fields] : [])],
    schema: coded || configuredTool ? 'z.object({})' : undefined,
    source: source('Translator', 'audio', options, resources, configuredTool ? loaded ? 'recordingUrl' : 'pcm24k' : undefined,
      'async ({ findRecording, recordings }) =>\n  recordings[await findRecording() as keyof typeof recordings]()'),
    call: coded || configuredTool ? 'translateNote({})' : `translateNote(${loaded ? 'recordingUrl' : 'openRecording()'})`, named: coded || configuredTool ? '{ context: {} }' : `{ audio: ${loaded ? 'recordingUrl' : 'openRecording()'} }`,
    toolPrompt: "'Translate the available delivery note into French.'",
    toolArgs: '{}',
    result: streaming ? consumeAudio('translationText') : `// The completed result contains audio bytes and final text.
return {
  audio: result.audio,
  sourceText: result.sourceText,
  translationText: result.translationText,
};`,
  });
}
