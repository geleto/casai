import { has, prepared, source, lookup, contextField, renderExample, audioStreamSetup, consumeAudio } from './shared.js';

export default function render(options, resources) {
  const coded = prepared(options), streaming = has(options, 'asStream');
  const audio = streaming ? 'openRecording()' : 'recordingUrl';
  const tool = lookup(options, { name: 'findRecording', description: 'Find the available delivery recording.', value: "'delivery-note'" });
  return renderExample({ component: 'Transcriber', variable: 'transcribeNote', options, modelType: 'TranscriptionModel',
    streamingFactory: 'StreamingTranscriber',
    params: [streaming ? 'pcm24k: Uint8Array' : 'recordingUrl: URL'], description: 'Transcribe the same delivery note. Use complete mode for whole audio files.', imports: coded ? tool.imports : [],
    toolDescription: coded ? 'Transcribe the available delivery-note recording.' : 'Transcribe a delivery-note recording from its audio URL.',
    setup: [...(streaming ? [audioStreamSetup] : []), ...(coded ? [tool.setup,
      `const recordings = { 'delivery-note': ${streaming ? 'openRecording' : '() => recordingUrl'} };`,
      'const getRecording = (id: string) => recordings[id as keyof typeof recordings]();'] : [])],
    fields: [...(streaming ? ["inputAudioFormat: { type: 'audio/pcm', rate: 24000 },"] : []), ...(coded ? [...contextField(['getRecording', ...tool.context]), ...tool.fields] : [])],
    schema: coded ? 'z.object({})' : has(options, 'asTool') ? 'z.object({ audio: z.url().transform(value => new URL(value)) })' : undefined,
    source: source('Transcriber', 'audio', options, resources, undefined,
      'async ({ findRecording, getRecording }) => getRecording(await findRecording())'),
    call: coded ? 'transcribeNote({})' : `transcribeNote(${audio})`, named: coded ? '{ context: {} }' : `{ audio: ${audio} }`,
    toolPrompt: coded ? "'Transcribe the available delivery note.'" : '`Transcribe the delivery note at ${recordingUrl.href}.`',
    toolArgs: coded ? '{}' : '{ audio: recordingUrl.href }', result: streaming ? consumeAudio('text') : 'return result.text;',
  });
}
